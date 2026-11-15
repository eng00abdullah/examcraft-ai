from __future__ import annotations
from typing import Optional, Literal, Dict, Any, List
from pydantic import BaseModel, Field
from app.schemas.problem import ProblemDocument, Assignment, RunConfig
from app.schemas.events import MetricsSnapshot

RunStatus = Literal[
    "CREATED",
    "RUNNING",
    "PAUSED",
    "SUCCEEDED",
    "INFEASIBLE",
    "LIMIT_REACHED",
    "CANCELLED",
    "INTERRUPTED",
    "ERROR",
    "INVALID_INPUT",
]


class ValidationReport(BaseModel):
    valid: bool
    violations: List[Dict[str, Any]] = Field(default_factory=list)
    penalty: Optional[int] = None
    breakdown: Optional[Dict[str, Any]] = None


class RunRecord(BaseModel):
    run_id: str
    revision_id: str
    problem_hash: str
    algorithm: str
    status: RunStatus
    optimality_proven: bool = False
    config: RunConfig
    problem: ProblemDocument
    assignments: Optional[List[Assignment]] = None
    metrics: MetricsSnapshot = Field(default_factory=MetricsSnapshot)
    validation: Optional[ValidationReport] = None
    terminal_reason: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class RunControlRequest(BaseModel):
    command: Literal["pause", "resume", "step", "cancel", "reset", "speed"]
    request_id: Optional[str] = None
    speed_ms: Optional[int] = None


class RunControlResponse(BaseModel):
    success: bool
    status: RunStatus
    last_sequence: int
    message: str
