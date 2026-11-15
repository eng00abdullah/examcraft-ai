"""Desired-behavior regression tests for the uploaded ExamCraft implementation.

Run with EXAMCRAFT_PROJECT_ROOT pointing at the application root, for example:
  python -m unittest discover -s ExamCraft_AI_Repair_Pack/tests -v

These tests intentionally fail on the reviewed baseline. They use a temporary
SQLite database and disposable workers/processes, never the project's database.
They test lifecycle guarantees, not expected broken behavior.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch


PROJECT_ROOT = Path(
    os.environ.get("EXAMCRAFT_PROJECT_ROOT", str(Path(__file__).resolve().parents[2]))
).resolve()
if not (PROJECT_ROOT / "apps" / "api" / "app").is_dir():
    raise RuntimeError("Set EXAMCRAFT_PROJECT_ROOT to the actual ExamCraft application root.")
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "api"))

from app.runs.manager import RunSession
from app.schemas.problem import ProblemDocument, RunConfig
from app.storage import db


TERMINAL = {"SUCCEEDED", "INFEASIBLE", "LIMIT_REACHED", "CANCELLED", "INTERRUPTED", "ERROR", "INVALID_INPUT"}


class LifecycleRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="examcraft-lifecycle-")
        self.original_cwd = Path.cwd()
        os.chdir(self.temp.name)
        self.db_path = Path(self.temp.name) / "isolated.sqlite"
        self.db_patch = patch.object(db, "DB_PATH", self.db_path)
        self.db_patch.start()
        db.init_db()
        self.loop = asyncio.new_event_loop()
        self.sessions = []
        self.problem = ProblemDocument(**json.loads(
            (PROJECT_ROOT / "fixtures" / "tiny_feasible.json").read_text(encoding="utf-8")
        ))

    def tearDown(self):
        try:
            for session in self.sessions:
                session.cancel()
                if session.worker_thread is not None:
                    session.worker_thread.join(timeout=2.5)
                    self.assertFalse(session.worker_thread.is_alive(), "Cleanup could not stop the worker")
        finally:
            self.loop.close()
            self.db_patch.stop()
            os.chdir(self.original_cwd)
            self.temp.cleanup()

    def make_session(self, run_id, *, speed_ms=0, compute_seconds=10.0, wall_seconds=10.0):
        session = RunSession(
            run_id,
            "isolated-revision",
            self.problem,
            RunConfig(
                algorithm="astar",
                teaching_speed_ms=speed_ms,
                limits={"max_search_seconds": compute_seconds, "max_wall_seconds": wall_seconds},
            ),
        )
        self.sessions.append(session)
        return session

    def wait_for(self, predicate, *, timeout=2.5, message="Condition was not reached"):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(0.005)
        self.fail(message)

    def finish(self, session):
        session.worker_thread.join(timeout=2.5)
        self.assertFalse(session.worker_thread.is_alive(), "Worker did not finish within the fixture budget")
        return session.to_record()

    def test_teaching_delay_does_not_consume_compute_budget(self):
        fast = self.make_session("unpaced-control", compute_seconds=0.2)
        fast.start(self.loop)
        self.assertEqual(self.finish(fast).status, "SUCCEEDED", "Control fixture must be solvable within the compute budget")

        paced = self.make_session("paced-same-budget", speed_ms=50, compute_seconds=0.2)
        paced.start(self.loop)
        record = self.finish(paced)
        self.assertEqual(
            record.status, "SUCCEEDED",
            "Teaching sleeps must not turn an otherwise sub-budget search into LIMIT_REACHED",
        )
        self.assertLess(record.metrics.search_compute_ms, 200.0)
        self.assertTrue(record.validation and record.validation.valid)

    def test_actual_active_run_survives_process_restart_as_interrupted(self):
        # A real child process owns the run. Termination simulates an actual
        # backend crash; no fabricated RUNNING row is inserted by this test.
        ready_path = Path(self.temp.name) / "child-ready"
        child_code = r'''
import asyncio,json,sys,time
from pathlib import Path
root,db_path,ready_path=map(Path,sys.argv[1:])
sys.path.insert(0,str(root/'apps/api'))
from app.storage import db
from app.schemas.problem import ProblemDocument,RunConfig
from app.runs.manager import RunSession
db.DB_PATH=db_path
db.init_db()
problem=ProblemDocument(**json.loads((root/'fixtures/tiny_feasible.json').read_text(encoding='utf-8')))
session=RunSession('crash-recovery-probe','isolated-revision',problem,RunConfig(algorithm='astar',teaching_speed_ms=50))
loop=asyncio.new_event_loop()
session.start(loop)
deadline=time.monotonic()+2
while session.last_sequence<1 and time.monotonic()<deadline:
    time.sleep(.005)
session.pause()
ready_path.write_text(session.status,encoding='utf-8')
while True:
    time.sleep(.1)
'''
        child = subprocess.Popen(
            [sys.executable, "-c", child_code, str(PROJECT_ROOT), str(self.db_path), str(ready_path)],
            cwd=self.temp.name,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            self.wait_for(lambda: ready_path.exists() or child.poll() is not None,
                          message="Disposable backend failed to start")
            self.assertTrue(ready_path.exists(), "Disposable backend exited before creating an active run")
            self.assertEqual(ready_path.read_text(encoding="utf-8"), "PAUSED")
            child.terminate()
            child.wait(timeout=2.0)
            persisted = db.get_run("crash-recovery-probe")
            self.assertIsNotNone(persisted, "A real active run must be durable before the backend can crash")
            db.init_db()
            recovered = db.get_run("crash-recovery-probe")
            self.assertEqual(recovered.status, "INTERRUPTED")
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=1.0)

    def test_success_event_is_published_only_after_validation_and_persistence(self):
        session = self.make_session("publication-order")
        observations = []
        original_publish = session._publish_event

        def observe_publication(event):
            if event.kind == "run_finished" and event.status == "SUCCEEDED":
                record = session.to_record()
                stored = db.get_run(session.run_id)
                observations.append({
                    "status": record.status,
                    "validation_ok": bool(record.validation and record.validation.valid),
                    "assignment_count": len(record.assignments or []),
                    "persisted_success": bool(stored and stored.status == "SUCCEEDED" and stored.validation and stored.validation.valid),
                })
            original_publish(event)

        session._publish_event = observe_publication
        session.start(self.loop)
        self.finish(session)
        self.assertEqual(len(observations), 1)
        observed = observations[0]
        self.assertEqual(observed["status"], "SUCCEEDED", "Terminal event must agree with the authoritative run record")
        self.assertTrue(observed["validation_ok"], "Success must wait for independent final validation")
        self.assertEqual(observed["assignment_count"], len(self.problem.courses))
        self.assertTrue(observed["persisted_success"], "The final result must be durable before announcing completion")

    def test_wall_deadline_terminates_an_abandoned_paused_session(self):
        session = self.make_session("paused-wall-deadline", speed_ms=20, wall_seconds=0.3)
        session.start(self.loop)
        self.wait_for(lambda: session.last_sequence >= 1)
        session.pause()
        self.assertEqual(session.status, "PAUSED")
        self.wait_for(lambda: session.status in TERMINAL, timeout=1.2,
                      message="Paused session ignored max_wall_seconds and kept its worker alive")
        self.assertEqual(session.status, "LIMIT_REACHED")
        self.assertIn("wall", (session.terminal_reason or "").lower())
        self.finish(session)

    def test_pause_cannot_resurrect_a_completed_run(self):
        session = self.make_session("pause-completion-race", speed_ms=30)
        terminal_published = threading.Event()
        original_publish = session._publish_event

        def signal_terminal(event):
            original_publish(event)
            if event.kind == "run_finished":
                terminal_published.set()

        session._publish_event = signal_terminal
        session.start(self.loop)
        self.assertTrue(terminal_published.wait(timeout=2.5))
        try:
            session.pause()
        except RuntimeError:
            # Rejecting a command against a terminal run is also valid behavior.
            pass
        self.finish(session)
        self.assertEqual(session.status, "SUCCEEDED", "A late pause must not overwrite terminal state with PAUSED")
        self.assertEqual(db.get_run(session.run_id).status, session.status)


if __name__ == "__main__":
    unittest.main()
