from __future__ import annotations
import asyncio
import json
import uuid
import time
from typing import Optional, List, Dict, Any, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.schemas.problem import ProblemDocument, RunConfig, Assignment, RunLimits
from app.schemas.runs import (
    RunRecord,
    RunStatus,
    RunControlRequest,
    RunControlResponse,
    ValidationReport,
)
from app.domain.normalized import (
    NormalizedProblem,
    validate_problem_structural,
    compute_canonical_hash,
)
from app.storage.db import (
    init_db,
    save_revision,
    get_revision,
    list_revisions,
    save_run,
    get_run,
    list_runs,
    save_comparison,
    get_comparison,
)
from app.runs.manager import run_manager, RunSession
from app.search.engine import SearchEngine
from app.validation.validator import validate_schedule
from app.exports.exporter import (
    generate_json_export,
    generate_xlsx_export,
    generate_pdf_export,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


# Ensure database tables exist
init_db()

app = FastAPI(
    title="ExamCraft AI API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ExamCraft AI",
        "engine": "pure-python-v1",
        "active_run": run_manager.active_session.run_id if (run_manager.active_session and run_manager.active_session.status in ("RUNNING", "PAUSED")) else None,
    }


@app.post("/api/problems/validate")
async def validate_problem(problem: ProblemDocument):
    errors = validate_problem_structural(problem)
    if errors:
        return {"valid": False, "errors": errors, "preflight": None}

    # Run preflight feasibility checks
    preflight_warnings = []
    try:
        norm = NormalizedProblem(problem)
        for c in norm.ordered_courses:
            if not norm.static_base_domains[c.id]:
                preflight_warnings.append(f"Course {c.code} ({c.id}) has zero viable slot/room candidates under static constraints")
    except Exception as e:
        preflight_warnings.append(f"Preflight error: {str(e)}")

    return {
        "valid": True,
        "errors": [],
        "preflight": {
            "feasible_candidate": len(preflight_warnings) == 0,
            "warnings": preflight_warnings,
            "problem_hash": compute_canonical_hash(problem),
        },
    }


@app.post("/api/problems")
async def create_problem_revision(problem: ProblemDocument, is_draft: bool = False):
    errors = validate_problem_structural(problem)
    if errors and not is_draft:
        raise HTTPException(status_code=400, detail={"errors": errors})

    revision_id = f"rev_{uuid.uuid4().hex[:12]}"
    problem_hash = compute_canonical_hash(problem)
    save_revision(revision_id, problem, problem_hash, is_draft=is_draft)

    return {
        "revision_id": revision_id,
        "problem_hash": problem_hash,
        "name": problem.name,
        "is_draft": is_draft,
    }


@app.get("/api/problems")
async def get_revisions():
    return list_revisions()


@app.get("/api/problems/{revision_id}")
async def get_problem_revision(revision_id: str):
    rev = get_revision(revision_id)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found")
    return rev


@app.post("/api/runs")
async def start_run(payload: Dict[str, Any]):
    revision_id = payload.get("revision_id")
    if not revision_id:
        raise HTTPException(status_code=400, detail="Missing revision_id")

    rev = get_revision(revision_id)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found")

    problem = ProblemDocument(**rev["problem"])
    config_dict = payload.get("config", {})
    config = RunConfig(**config_dict)

    run_id = f"run_{uuid.uuid4().hex[:12]}"
    loop = asyncio.get_running_loop()

    try:
        session = run_manager.create_run(run_id, revision_id, problem, config, loop)
    except RuntimeError as e:
        active = run_manager.get_active_session()
        raise HTTPException(
            status_code=409,
            detail={
                "code": "RUN_BUSY",
                "message": str(e),
                "active_run_id": active.run_id if active else None,
            },
        )

    return {
        "run_id": run_id,
        "revision_id": revision_id,
        "problem_hash": session.problem_hash,
        "status": session.status,
    }


@app.get("/api/runs/{run_id}")
async def get_run_status(run_id: str):
    active = run_manager.get_active_session()
    if active and active.run_id == run_id:
        return active.to_record()

    record = get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    return record


@app.get("/api/runs/{run_id}/events")
async def stream_run_events(run_id: str, request: Request, last_event_id: Optional[int] = Query(None)):
    active = run_manager.get_active_session()

    # If completed run in SQLite, replay terminal event
    if not active or active.run_id != run_id:
        record = get_run(run_id)
        if not record:
            raise HTTPException(status_code=404, detail="Run not found")

        from app.schemas.events import SearchEvent
        seq = (record.metrics.expanded_nodes + record.metrics.invalid_actions) if record.metrics else 1
        terminal_ev = SearchEvent(
            sequence=seq,
            run_id=record.run_id,
            problem_hash=record.problem_hash,
            kind="run_finished",
            timestamp=time.time(),
            status=record.status,
            rejection_reason=None if record.status == "SUCCEEDED" else "Terminal state reached",
            assignments=[a.model_dump() for a in record.assignments] if record.assignments else None,
            metrics=record.metrics,
        )

        async def static_event_stream():
            yield f"id: {terminal_ev.sequence}\nevent: run_finished\ndata: {terminal_ev.model_dump_json()}\n\n"

        return StreamingResponse(static_event_stream(), media_type="text/event-stream")

    # Active run SSE stream
    subscriber_queue: asyncio.Queue = asyncio.Queue()
    active.add_subscriber(subscriber_queue)

    # Check Last-Event-ID header or query param
    header_last_id = request.headers.get("last-event-id")
    replay_from = None
    if header_last_id and header_last_id.isdigit():
        replay_from = int(header_last_id)
    elif last_event_id is not None:
        replay_from = last_event_id

    async def event_generator():
        try:
            # Replay journal events
            with active.journal_lock:
                journal_events = list(active.journal)

            for ev in journal_events:
                if replay_from is None or ev.sequence > replay_from:
                    yield f"id: {ev.sequence}\nevent: {ev.kind}\ndata: {ev.model_dump_json()}\n\n"
                    if ev.kind == "run_finished":
                        return

            # Stream live events
            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(subscriber_queue.get(), timeout=1.0)
                    yield f"id: {event.sequence}\nevent: {event.kind}\ndata: {event.model_dump_json()}\n\n"
                    if event.kind == "run_finished":
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat
                    yield f": heartbeat\n\n"

        finally:
            active.remove_subscriber(subscriber_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/runs/{run_id}/control")
async def control_run(run_id: str, cmd: RunControlRequest):
    active = run_manager.get_active_session()
    if not active or active.run_id != run_id:
        raise HTTPException(status_code=404, detail="Active run session not found")

    if cmd.command == "pause":
        seq = active.pause()
        return RunControlResponse(success=True, status=active.status, last_sequence=seq, message="Run paused")
    elif cmd.command == "resume":
        active.resume()
        return RunControlResponse(success=True, status=active.status, last_sequence=active.last_sequence, message="Run resumed")
    elif cmd.command == "step":
        if getattr(cmd, "request_id", None) and getattr(active, "_last_step_request_id", None) == cmd.request_id:
            return RunControlResponse(success=True, status=active.status, last_sequence=active.last_sequence, message="Step request already processed")
        if getattr(cmd, "request_id", None):
            active._last_step_request_id = cmd.request_id
        active.step()
        return RunControlResponse(success=True, status=active.status, last_sequence=active.last_sequence, message="Single step transition granted")
    elif cmd.command == "speed":
        active.set_speed(cmd.speed_ms or 0)
        return RunControlResponse(success=True, status=active.status, last_sequence=active.last_sequence, message=f"Speed set to {active.speed_ms}ms")
    elif cmd.command == "cancel":
        active.cancel()
        return RunControlResponse(success=True, status="CANCELLED", last_sequence=active.last_sequence, message="Run cancelled")
    elif cmd.command == "reset":
        loop = asyncio.get_running_loop()
        new_run_id = f"run_{uuid.uuid4().hex[:12]}"
        new_session = run_manager.reset_run(new_run_id, loop)
        return RunControlResponse(
            success=True,
            status=new_session.status,
            last_sequence=new_session.last_sequence,
            message=f"Reset created new run {new_run_id}",
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown command {cmd.command}")


@app.post("/api/runs/{run_id}/validate")
async def validate_saved_run(run_id: str, payload: Optional[Dict[str, Any]] = None):
    record = get_run(run_id)
    if not record:
        active = run_manager.get_active_session()
        if active and active.run_id == run_id:
            record = active.to_record()
        else:
            raise HTTPException(status_code=404, detail="Run not found")

    target_problem = record.problem
    target_revision_id = record.revision_id

    # If payload requests validation against a different revision
    if payload and "target_revision_id" in payload:
        target_revision_id = payload["target_revision_id"]
        target_rev = get_revision(target_revision_id)
        if not target_rev:
            raise HTTPException(status_code=404, detail="Target revision not found")
        target_problem = ProblemDocument(**target_rev["problem"])

    if not record.assignments:
        return {
            "valid": False,
            "violations": [{"code": "no_assignments", "message": "Run contains no assignments"}],
            "penalty": None,
            "breakdown": None,
            "target_revision_id": target_revision_id,
        }

    val_result = validate_schedule(target_problem, record.assignments)
    val_result["target_revision_id"] = target_revision_id
    val_result["original_revision_id"] = record.revision_id
    return val_result


@app.get("/api/runs/{run_id}/export")
async def export_run(
    run_id: str,
    format: Literal["json", "xlsx", "pdf"] = "json",
    course: Optional[str] = None,
    room: Optional[str] = None,
    date: Optional[str] = None,
):
    record = get_run(run_id)
    if not record:
        active = run_manager.get_active_session()
        if active and active.run_id == run_id:
            record = active.to_record()
        else:
            raise HTTPException(status_code=404, detail="Run not found")

    if format == "json":
        data = generate_json_export(record, filter_course=course, filter_room=room, filter_date=date)
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="timetable-{run_id}.json"'},
        )
    elif format == "xlsx":
        buf = generate_xlsx_export(record, filter_course=course, filter_room=room, filter_date=date)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="timetable-{run_id}.xlsx"'},
        )
    elif format == "pdf":
        buf = generate_pdf_export(record, filter_course=course, filter_room=room, filter_date=date)
        return Response(
            content=buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="timetable-{run_id}.pdf"'},
        )


@app.post("/api/comparisons")
async def run_comparison(payload: Dict[str, Any]):
    """
    Runs sequential benchmarks of BFS, DFS, Greedy, A* on the specified problem snapshot.
    Honest execution with zero teaching delay and equal caps.
    """
    revision_id = payload.get("revision_id")
    if not revision_id:
        raise HTTPException(status_code=400, detail="Missing revision_id")

    rev = get_revision(revision_id)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found")

    active = run_manager.get_active_session()
    if active and active.status in ("RUNNING", "PAUSED"):
        raise HTTPException(status_code=409, detail={"code": "RUN_BUSY", "message": "Cannot benchmark while solver is busy"})

    problem = ProblemDocument(**rev["problem"])
    norm = NormalizedProblem(problem)
    comparison_limits = RunLimits(**payload.get("limits", {})) if payload.get("limits") else RunLimits()

    def _execute_benchmark_sync():
        algorithms = ["bfs", "dfs", "greedy", "astar"]
        trials = []

        # Sequential execution
        for alg in algorithms:
            cfg = RunConfig(
                algorithm=alg,  # type: ignore
                heuristic="admissible",
                teaching_speed_ms=0,
                limits=comparison_limits,
            )
            engine = SearchEngine(norm, cfg, run_id=f"bench_{alg}_{uuid.uuid4().hex[:6]}")
            final_ev = None
            for ev in engine.run():
                if ev.kind == "run_finished":
                    final_ev = ev

            if not final_ev:
                continue

            assignments = None
            val_result = None
            if final_ev.status == "SUCCEEDED" and final_ev.assignments:
                assignments = [Assignment(**a) for a in final_ev.assignments]
                v_start = time.perf_counter()
                val_result = validate_schedule(problem, assignments)
                final_ev.metrics.final_validation_ms = (time.perf_counter() - v_start) * 1000.0

            trials.append({
                "algorithm": alg,
                "status": final_ev.status,
                "optimality_proven": alg == "astar" and final_ev.status == "SUCCEEDED" and final_ev.metrics.budget_blocked_actions == 0,
                "penalty": val_result["penalty"] if val_result else None,
                "penalty_breakdown": val_result["breakdown"] if val_result else None,
                "metrics": final_ev.metrics.model_dump(),
                "terminal_reason": final_ev.rejection_reason,
            })

        # Determine honest distinct recognitions
        successful = [t for t in trials if t["status"] == "SUCCEEDED" and t["penalty"] is not None]
        fastest = min(successful, key=lambda t: t["metrics"]["search_compute_ms"]) if successful else None
        fewest_explored = min(successful, key=lambda t: t["metrics"]["explored_nodes"]) if successful else None
        lowest_penalty = min(successful, key=lambda t: t["penalty"]) if successful else None

        comparison_id = f"cmp_{uuid.uuid4().hex[:12]}"
        summary = {
            "comparison_id": comparison_id,
            "revision_id": revision_id,
            "problem_hash": norm.problem_hash,
            "method": "Sequential single-run benchmark with identical resource caps and zero teaching delay",
            "trials": trials,
            "recognitions": {
                "fastest_successful": fastest["algorithm"] if fastest else None,
                "fewest_explored": fewest_explored["algorithm"] if fewest_explored else None,
                "lowest_observed_penalty": lowest_penalty["algorithm"] if lowest_penalty else None,
            },
        }

        save_comparison(comparison_id, revision_id, {"algorithms": algorithms}, summary)
        return summary

    summary = await asyncio.to_thread(_execute_benchmark_sync)
    return summary


@app.get("/api/comparisons/{comparison_id}")
async def get_comparison_results(comparison_id: str):
    res = get_comparison(comparison_id)
    if not res:
        raise HTTPException(status_code=404, detail="Comparison not found")
    return res["results"]


# Serve frontend static assets if built
from pathlib import Path

frontend_dist = Path("apps/web/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


