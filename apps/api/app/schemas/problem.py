from __future__ import annotations
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RoomUnavailable(BaseModel):
    date: str
    start_time: str
    end_time: str


class Room(BaseModel):
    id: str
    name: str
    capacity: int
    unavailable: List[RoomUnavailable] = Field(default_factory=list)

    @field_validator("capacity", mode="before")
    @classmethod
    def check_capacity_type(cls, v: Any) -> Any:
        if type(v) is bool:
            raise ValueError("Boolean capacity is rejected without coercion")
        return v


class Slot(BaseModel):
    id: str
    date: str
    start_time: str
    end_time: str


class Student(BaseModel):
    id: str
    display_name: str


class Course(BaseModel):
    id: str
    code: str
    name: str
    duration_minutes: int
    allowed_slot_ids: Optional[List[str]] = None

    @field_validator("duration_minutes", mode="before")
    @classmethod
    def check_duration_type(cls, v: Any) -> Any:
        if type(v) is bool:
            raise ValueError("Boolean duration is rejected without coercion")
        return v


class Enrollment(BaseModel):
    student_id: str
    course_id: str


class Constraints(BaseModel):
    max_exams_per_student_per_day: Optional[int] = None
    minimum_gap_minutes: int = 0

    @field_validator("minimum_gap_minutes", "max_exams_per_student_per_day", mode="before")
    @classmethod
    def check_constraints_types(cls, v: Any) -> Any:
        if type(v) is bool:
            raise ValueError("Boolean constraint values are rejected without coercion")
        return v


class Objective(BaseModel):
    same_day_weight: int = 100
    short_gap_weight: int = 30
    spare_seat_weight: int = 1
    preferred_gap_minutes: int = 60


class ProblemDocument(BaseModel):
    schema_version: str = "1.0"
    id: str = "demo"
    name: str = "Exam Scheduling Problem"
    timezone: str = "Africa/Cairo"
    courses: List[Course] = Field(default_factory=list)
    students: List[Student] = Field(default_factory=list)
    enrollments: List[Enrollment] = Field(default_factory=list)
    slots: List[Slot] = Field(default_factory=list)
    rooms: List[Room] = Field(default_factory=list)
    constraints: Constraints = Field(default_factory=Constraints)
    objective: Objective = Field(default_factory=Objective)


class Assignment(BaseModel):
    course_id: str
    slot_id: str
    room_id: str


class RunLimits(BaseModel):
    max_expanded_nodes: int = 10000
    max_generated_nodes: int = 50000
    max_frontier_nodes: int = 25000
    max_search_seconds: float = 5.0
    max_wall_seconds: float = 300.0

    @field_validator("max_expanded_nodes", "max_generated_nodes", "max_frontier_nodes", "max_search_seconds", "max_wall_seconds", mode="before")
    @classmethod
    def check_limits_types(cls, v: Any) -> Any:
        if type(v) is bool:
            raise ValueError("Boolean limit values are rejected without coercion")
        return v


class RunConfig(BaseModel):
    algorithm: Literal["bfs", "dfs", "greedy", "astar"] = "dfs"
    heuristic: Literal["admissible", "zero"] = "admissible"
    limits: RunLimits = Field(default_factory=RunLimits)
    teaching_speed_ms: int = 0
