from __future__ import annotations
import threading
import time
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set
from collections import deque

from app.schemas.problem import ProblemDocument, RunConfig, Assignment
from app.schemas.events import SearchEvent, SearchEventKind
from app.schemas.runs import RunRecord, RunStatus, ValidationReport
from app.domain.normalized import NormalizedProblem
from app.search.engine import SearchEngine
from app.validation.validator import validate_schedule
from app.storage.db import save_run, get_run


TERMINAL_STATUSES = {"SUCCEEDED", "INFEASIBLE", "LIMIT_REACHED", "CANCELLED", "INTERRUPTED", "ERROR", "INVALID_INPUT"}


class RunSession:
    def __init__(self, run_id: str, revision_id: str, problem: ProblemDocument, config: RunConfig):
        self.run_id = run_id
        self.revision_id = revision_id
        self.problem = problem
        self.config = config
        self.norm = NormalizedProblem(problem)
        self.problem_hash = self.norm.problem_hash

        self.status: RunStatus = "CREATED"
        self.terminal_reason: Optional[str] = None
        self.optimality_proven: bool = False
        self.assignments: Optional[List[Assignment]] = None
        self.validation: Optional[ValidationReport] = None
        self.final_metrics: Optional[Any] = None

        self.created_at = datetime.now(timezone.utc).isoformat()
        self.completed_at: Optional[str] = None

        # Bounded event journal (max 5000)
        self.max_journal_size = 5000
        self.journal: List[SearchEvent] = []
        self.journal_lock = threading.Lock()
        self.state_lock = threading.Lock()

        # Thread synchronization
        self.worker_thread: Optional[threading.Thread] = None
        self.cancel_requested = threading.Event()
        self.pause_requested = threading.Event()
        self.pause_ack = threading.Event()
        self.resume_requested = threading.Event()
        self.step_requested = threading.Event()

        self.speed_ms: int = config.teaching_speed_ms
        self.last_sequence: int = 0

        # SSE subscriber queues
        self.subscribers: Set[asyncio.Queue] = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def add_subscriber(self, q: asyncio.Queue) -> None:
        self.subscribers.add(q)

    def remove_subscriber(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)

    def _publish_event(self, event: SearchEvent) -> None:
        with self.journal_lock:
            if len(self.journal) >= self.max_journal_size:
                self.journal.pop(0)
            self.journal.append(event)
            self.last_sequence = event.sequence

        if self.loop and self.subscribers:
            for q in list(self.subscribers):
                self.loop.call_soon_threadsafe(q.put_nowait, event)

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        with self.state_lock:
            if self.status != "CREATED":
                return
            self.loop = loop
            self.status = "RUNNING"
            save_run(self.to_record())
            self.worker_thread = threading.Thread(target=self._run_worker, daemon=True)
            self.worker_thread.start()

    def pause(self) -> int:
        with self.state_lock:
            if self.status in TERMINAL_STATUSES:
                return self.last_sequence
            if self.status == "RUNNING":
                self.pause_ack.clear()
                self.pause_requested.set()
        # Wait for worker barrier outside state_lock
        self.pause_ack.wait(timeout=0.5)
        with self.state_lock:
            if self.status not in TERMINAL_STATUSES:
                self.status = "PAUSED"
                save_run(self.to_record())
        return self.last_sequence

    def resume(self) -> None:
        with self.state_lock:
            if self.status in TERMINAL_STATUSES:
                return
            if self.status == "PAUSED":
                self.status = "RUNNING"
                self.pause_requested.clear()
                self.pause_ack.clear()
                self.resume_requested.set()
                save_run(self.to_record())

    def step(self) -> None:
        with self.state_lock:
            if self.status in TERMINAL_STATUSES:
                return
            if self.status == "PAUSED":
                self.step_requested.set()
                self.pause_ack.clear()
                self.resume_requested.set()

    def set_speed(self, speed_ms: int) -> None:
        self.speed_ms = max(0, speed_ms)

    def cancel(self) -> None:
        with self.state_lock:
            if self.status not in TERMINAL_STATUSES:
                self.cancel_requested.set()
                self.pause_requested.clear()
                self.resume_requested.set()

    def _run_worker(self) -> None:
        engine = SearchEngine(self.norm, self.config, self.run_id)
        generator = engine.run()

        wall_start_mono = time.monotonic()
        max_wall_sec = self.config.limits.max_wall_seconds
        terminal_event: Optional[SearchEvent] = None

        try:
            for event in generator:
                # Check wall deadline
                if time.monotonic() - wall_start_mono >= max_wall_sec:
                    event.kind = "run_finished"
                    event.status = "LIMIT_REACHED"
                    event.rejection_reason = f"Wall-clock deadline ({max_wall_sec}s) exceeded"
                    terminal_event = event
                    break

                # Check cancellation
                if self.cancel_requested.is_set():
                    event.kind = "run_finished"
                    event.status = "CANCELLED"
                    event.rejection_reason = "Cancelled by user"
                    terminal_event = event
                    break

                # If event from engine is already terminal:
                if event.kind == "run_finished":
                    terminal_event = event
                    break

                # Handle pause and stepping BEFORE committing to the next transition
                if self.pause_requested.is_set():
                    self.pause_ack.set()
                    with self.state_lock:
                        if self.status not in TERMINAL_STATUSES:
                            self.status = "PAUSED"
                            save_run(self.to_record())

                    while self.pause_requested.is_set() and not self.cancel_requested.is_set():
                        if time.monotonic() - wall_start_mono >= max_wall_sec:
                            with self.state_lock:
                                self.status = "LIMIT_REACHED"
                                self.terminal_reason = f"Wall-clock deadline ({max_wall_sec}s) exceeded"
                            break
                        self.resume_requested.wait(timeout=0.01)
                        if self.step_requested.is_set():
                            # Granted exactly one transition
                            self.step_requested.clear()
                            self.resume_requested.clear()
                            break
                        if not self.pause_requested.is_set():
                            self.resume_requested.clear()
                            break

                    if self.status == "LIMIT_REACHED":
                        terminal_event = SearchEvent(
                            sequence=self.last_sequence + 1,
                            run_id=self.run_id,
                            problem_hash=self.problem_hash,
                            kind="run_finished",
                            timestamp=time.time(),
                            status="LIMIT_REACHED",
                            rejection_reason=self.terminal_reason,
                            metrics=engine.metrics.model_copy(),
                        )
                        break

                # Publish non-terminal event
                self._publish_event(event)

                # Pacing speed delay if configured
                if self.speed_ms > 0 and not self.cancel_requested.is_set():
                    pacing_end = time.monotonic() + (self.speed_ms / 1000.0)
                    while time.monotonic() < pacing_end and not self.cancel_requested.is_set() and not self.pause_requested.is_set():
                        if time.monotonic() - wall_start_mono >= max_wall_sec:
                            with self.state_lock:
                                self.status = "LIMIT_REACHED"
                                self.terminal_reason = f"Wall-clock deadline ({max_wall_sec}s) exceeded"
                            break
                        time.sleep(0.005)
                    if self.status == "LIMIT_REACHED":
                        terminal_event = SearchEvent(
                            sequence=self.last_sequence + 1,
                            run_id=self.run_id,
                            problem_hash=self.problem_hash,
                            kind="run_finished",
                            timestamp=time.time(),
                            status="LIMIT_REACHED",
                            rejection_reason=self.terminal_reason,
                            metrics=engine.metrics.model_copy(),
                        )
                        break

        except Exception as e:
            terminal_event = SearchEvent(
                sequence=self.last_sequence + 1,
                run_id=self.run_id,
                problem_hash=self.problem_hash,
                kind="run_finished",
                timestamp=time.time(),
                status="ERROR",
                rejection_reason=f"Engine runtime exception: {str(e)}",
                metrics=engine.metrics.model_copy(),
            )

        self.completed_at = datetime.now(timezone.utc).isoformat()
        wall_end_mono = time.monotonic()
        engine.metrics.run_wall_ms = (wall_end_mono - wall_start_mono) * 1000.0
        self.final_metrics = engine.metrics.model_copy()

        with self.state_lock:
            if terminal_event:
                self.status = terminal_event.status or "ERROR"
                self.terminal_reason = terminal_event.rejection_reason
            else:
                self.status = "ERROR"
                self.terminal_reason = "Search ended without terminal event"

            # Final independent validation if succeeded
            if self.status == "SUCCEEDED" and terminal_event and terminal_event.assignments:
                self.assignments = [Assignment(**a) for a in terminal_event.assignments]
                v_start = time.perf_counter()
                val_out = validate_schedule(self.problem, self.assignments)
                v_ms = (time.perf_counter() - v_start) * 1000.0
                engine.metrics.final_validation_ms = v_ms
                self.final_metrics.final_validation_ms = v_ms

                self.validation = ValidationReport(
                    valid=val_out["valid"],
                    violations=val_out["violations"],
                    penalty=val_out["penalty"],
                    breakdown=val_out["breakdown"],
                )

                if not val_out["valid"]:
                    self.status = "ERROR"
                    self.terminal_reason = f"Independent validation failed: {val_out['violations']}"
                    self.optimality_proven = False
                else:
                    if self.config.algorithm.lower() == "astar" and self.config.heuristic == "admissible" and engine.metrics.budget_blocked_actions == 0:
                        self.optimality_proven = True
                    else:
                        self.optimality_proven = False
            else:
                self.assignments = None
                self.validation = None
                self.optimality_proven = False

            # Persist finalized record to SQLite BEFORE publishing terminal event!
            record = self.to_record()
            save_run(record)

        # Now publish terminal event
        if terminal_event:
            terminal_event.sequence = self.last_sequence + 1
            terminal_event.status = self.status
            terminal_event.rejection_reason = self.terminal_reason
            terminal_event.assignments = [a.model_dump() for a in self.assignments] if self.assignments else None
            terminal_event.metrics = self.final_metrics.model_copy()
            self._publish_event(terminal_event)

    def to_record(self) -> RunRecord:
        if self.final_metrics is not None:
            metrics = self.final_metrics
        elif self.journal and self.journal[-1].metrics:
            metrics = self.journal[-1].metrics
        else:
            metrics = engine_metrics_fallback(self)

        return RunRecord(
            run_id=self.run_id,
            revision_id=self.revision_id,
            problem_hash=self.problem_hash,
            algorithm=self.config.algorithm,
            status=self.status,
            optimality_proven=self.optimality_proven,
            config=self.config,
            problem=self.problem,
            assignments=self.assignments,
            metrics=metrics,
            validation=self.validation,
            terminal_reason=self.terminal_reason,
            created_at=self.created_at,
            completed_at=self.completed_at,
        )


def engine_metrics_fallback(session: RunSession):
    from app.schemas.events import MetricsSnapshot
    return MetricsSnapshot()


class RunManager:
    def __init__(self):
        self.active_session: Optional[RunSession] = None
        self.lock = threading.Lock()

    def create_run(
        self,
        run_id: str,
        revision_id: str,
        problem: ProblemDocument,
        config: RunConfig,
        loop: asyncio.AbstractEventLoop,
    ) -> RunSession:
        with self.lock:
            if self.active_session and self.active_session.status in ("RUNNING", "PAUSED"):
                raise RuntimeError(f"Run {self.active_session.run_id} is currently active")

            session = RunSession(run_id, revision_id, problem, config)
            self.active_session = session
            session.start(loop)
            return session

    def get_active_session(self) -> Optional[RunSession]:
        return self.active_session

    def reset_run(self, new_run_id: str, loop: asyncio.AbstractEventLoop) -> RunSession:
        with self.lock:
            if not self.active_session:
                raise RuntimeError("No run to reset")
            old_session = self.active_session
            old_session.cancel()

            new_session = RunSession(
                new_run_id,
                old_session.revision_id,
                old_session.problem,
                old_session.config,
            )
            self.active_session = new_session
            new_session.start(loop)
            return new_session


# Singleton run manager
run_manager = RunManager()
