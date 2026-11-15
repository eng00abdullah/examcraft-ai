from __future__ import annotations
from typing import Dict, List, Tuple
from app.domain.normalized import NormalizedProblem, ExamPlacement


def compute_unary_penalty(norm: NormalizedProblem, course_id: str, room_id: str) -> int:
    room = norm.rooms_by_id[room_id]
    n_stus = norm.course_student_count[course_id]
    spare = room.capacity - n_stus
    return norm.problem.objective.spare_seat_weight * spare


def compute_pair_penalty(norm: NormalizedProblem, p1: ExamPlacement, p2: ExamPlacement) -> int:
    shared = norm.shared_students.get((p1.course_id, p2.course_id), 0)
    if shared == 0:
        return 0

    if p1.date != p2.date:
        return 0

    w_same = norm.problem.objective.same_day_weight
    w_short = norm.problem.objective.short_gap_weight
    pref_gap = norm.problem.objective.preferred_gap_minutes

    penalty = shared * w_same
    gap = p1.gap_minutes(p2)
    if gap < pref_gap:
        penalty += shared * w_short

    return penalty


def compute_incremental_cost(
    norm: NormalizedProblem,
    new_placement: ExamPlacement,
    assigned_placements: Dict[str, ExamPlacement],
) -> int:
    cost = compute_unary_penalty(norm, new_placement.course_id, new_placement.room_id)
    for existing_placement in assigned_placements.values():
        cost += compute_pair_penalty(norm, new_placement, existing_placement)
    return cost


def compute_total_penalty(
    norm: NormalizedProblem,
    assigned_placements: Dict[str, ExamPlacement],
) -> int:
    total = 0
    placements = list(assigned_placements.values())
    for p in placements:
        total += compute_unary_penalty(norm, p.course_id, p.room_id)
    for i in range(len(placements)):
        for j in range(i + 1, len(placements)):
            total += compute_pair_penalty(norm, placements[i], placements[j])
    return total
