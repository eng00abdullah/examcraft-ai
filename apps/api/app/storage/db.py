from __future__ import annotations
import sqlite3
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.schemas.problem import ProblemDocument, Assignment, RunConfig
from app.schemas.runs import RunRecord, ValidationReport
from app.schemas.events import MetricsSnapshot

DB_PATH = Path("examcraft.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS problem_revisions (
                revision_id TEXT PRIMARY KEY,
                problem_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                problem_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_draft INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                revision_id TEXT NOT NULL,
                problem_hash TEXT NOT NULL,
                algorithm TEXT NOT NULL,
                status TEXT NOT NULL,
                optimality_proven INTEGER NOT NULL DEFAULT 0,
                config_json TEXT NOT NULL,
                problem_json TEXT NOT NULL,
                assignments_json TEXT,
                metrics_json TEXT NOT NULL,
                validation_json TEXT,
                terminal_reason TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (revision_id) REFERENCES problem_revisions(revision_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comparisons (
                comparison_id TEXT PRIMARY KEY,
                revision_id TEXT NOT NULL,
                config_json TEXT NOT NULL,
                results_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (revision_id) REFERENCES problem_revisions(revision_id)
            )
        """)

        # Clean up any abandoned active runs on restart
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            UPDATE runs
            SET status = 'INTERRUPTED', terminal_reason = 'Backend process restarted during run', completed_at = ?
            WHERE status IN ('RUNNING', 'PAUSED', 'CREATED')
            """,
            (now_iso,),
        )
    conn.close()


def save_revision(revision_id: str, problem: ProblemDocument, problem_hash: str, is_draft: bool = False) -> None:
    conn = get_db_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO problem_revisions (revision_id, problem_hash, name, problem_json, created_at, is_draft)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (revision_id, problem_hash, problem.name, problem.model_dump_json(), now_iso, 1 if is_draft else 0),
        )
    conn.close()


def get_revision(revision_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM problem_revisions WHERE revision_id = ?", (revision_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "revision_id": row["revision_id"],
        "problem_hash": row["problem_hash"],
        "name": row["name"],
        "problem": json.loads(row["problem_json"]),
        "created_at": row["created_at"],
        "is_draft": bool(row["is_draft"]),
    }


def list_revisions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT revision_id, problem_hash, name, created_at, is_draft FROM problem_revisions ORDER BY created_at DESC").fetchall()
    conn.close()
    return [
        {
            "revision_id": r["revision_id"],
            "problem_hash": r["problem_hash"],
            "name": r["name"],
            "created_at": r["created_at"],
            "is_draft": bool(r["is_draft"]),
        }
        for r in rows
    ]


def save_run(record: RunRecord) -> None:
    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO runs (
                run_id, revision_id, problem_hash, algorithm, status, optimality_proven,
                config_json, problem_json, assignments_json, metrics_json, validation_json,
                terminal_reason, created_at, completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.run_id,
                record.revision_id,
                record.problem_hash,
                record.algorithm,
                record.status,
                1 if record.optimality_proven else 0,
                record.config.model_dump_json(),
                record.problem.model_dump_json(),
                json.dumps([a.model_dump() for a in record.assignments]) if record.assignments else None,
                record.metrics.model_dump_json(),
                record.validation.model_dump_json() if record.validation else None,
                record.terminal_reason,
                record.created_at,
                record.completed_at,
            ),
        )
    conn.close()


def get_run(run_id: str) -> Optional[RunRecord]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    conn.close()
    if not row:
        return None

    assignments = None
    if row["assignments_json"]:
        assignments = [Assignment(**a) for a in json.loads(row["assignments_json"])]

    validation = None
    if row["validation_json"]:
        validation = ValidationReport(**json.loads(row["validation_json"]))

    return RunRecord(
        run_id=row["run_id"],
        revision_id=row["revision_id"],
        problem_hash=row["problem_hash"],
        algorithm=row["algorithm"],
        status=row["status"],
        optimality_proven=bool(row["optimality_proven"]),
        config=RunConfig(**json.loads(row["config_json"])),
        problem=ProblemDocument(**json.loads(row["problem_json"])),
        assignments=assignments,
        metrics=MetricsSnapshot(**json.loads(row["metrics_json"])),
        validation=validation,
        terminal_reason=row["terminal_reason"],
        created_at=row["created_at"],
        completed_at=row["completed_at"],
    )


def list_runs(revision_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    if revision_id:
        rows = conn.execute("SELECT run_id, revision_id, problem_hash, algorithm, status, optimality_proven, terminal_reason, created_at, completed_at FROM runs WHERE revision_id = ? ORDER BY created_at DESC", (revision_id,)).fetchall()
    else:
        rows = conn.execute("SELECT run_id, revision_id, problem_hash, algorithm, status, optimality_proven, terminal_reason, created_at, completed_at FROM runs ORDER BY created_at DESC").fetchall()
    conn.close()
    return [
        {
            "run_id": r["run_id"],
            "revision_id": r["revision_id"],
            "problem_hash": r["problem_hash"],
            "algorithm": r["algorithm"],
            "status": r["status"],
            "optimality_proven": bool(r["optimality_proven"]),
            "terminal_reason": r["terminal_reason"],
            "created_at": r["created_at"],
            "completed_at": r["completed_at"],
        }
        for r in rows
    ]


def save_comparison(comparison_id: str, revision_id: str, config: Dict[str, Any], results: Dict[str, Any]) -> None:
    conn = get_db_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO comparisons (comparison_id, revision_id, config_json, results_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (comparison_id, revision_id, json.dumps(config), json.dumps(results), now_iso),
        )
    conn.close()


def get_comparison(comparison_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM comparisons WHERE comparison_id = ?", (comparison_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "comparison_id": row["comparison_id"],
        "revision_id": row["revision_id"],
        "config": json.loads(row["config_json"]),
        "results": json.loads(row["results_json"]),
        "created_at": row["created_at"],
    }
