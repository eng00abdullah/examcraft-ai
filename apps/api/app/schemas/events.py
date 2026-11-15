from __future__ import annotations
from typing import Optional, Literal, Dict, Any, List
from pydantic import BaseModel, Field

SearchEventKind = Literal[
    "run_started",
    "node_popped",
    "action_rejected",
    "child_enqueued",
    "forward_pruned",
    "goal_found",
    "run_finished",
]


class MetricsSnapshot(BaseModel):
    generated_nodes: int = 0
    explored_nodes: int = 0
    expanded_nodes: int = 0
    candidate_actions: int = 0
    valid_actions: int = 0
    invalid_actions: int = 0
    forward_pruned_actions: int = 0
    enqueued_actions: int = 0
    budget_blocked_actions: int = 0
    frontier_size: int = 0
    peak_frontier_size: int = 0
    max_depth: int = 0
    search_compute_ms: float = 0.0
    preprocessing_ms: float = 0.0
    final_validation_ms: float = 0.0
    run_wall_ms: float = 0.0


class SearchEvent(BaseModel):
    sequence: int
    run_id: str
    problem_hash: str
    kind: SearchEventKind
    timestamp: float
    node_id: Optional[str] = None
    parent_id: Optional[str] = None
    course_id: Optional[str] = None
    slot_id: Optional[str] = None
    room_id: Optional[str] = None
    depth: Optional[int] = None
    g: Optional[int] = None
    h: Optional[int] = None
    f: Optional[int] = None
    rejection_code: Optional[str] = None
    rejection_reason: Optional[str] = None
    rejection_details: Optional[Dict[str, Any]] = None
    assignments: Optional[List[Dict[str, str]]] = None
    metrics: Optional[MetricsSnapshot] = None
    status: Optional[str] = None
