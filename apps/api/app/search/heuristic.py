from __future__ import annotations
from typing import Dict, List, Optional, Tuple
from app.domain.normalized import NormalizedProblem, ExamPlacement, Slot, Room
from app.search.objective import compute_unary_penalty, compute_pair_penalty


def is_action_valid_against_partial(
    norm: NormalizedProblem,
    candidate: ExamPlacement,
    assigned_placements: Dict[str, ExamPlacement],
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Checks if candidate exam placement satisfies all dynamic hard constraints
    against the already assigned placements.
    Returns (is_valid, rejection_code, rejection_reason).
    """
    min_gap = norm.problem.constraints.minimum_gap_minutes
    max_daily = norm.problem.constraints.max_exams_per_student_per_day

    # 1. Room overlap
    for assigned in assigned_placements.values():
        if assigned.room_id == candidate.room_id and assigned.overlaps(candidate):
            return False, "room_overlap", f"Overlaps with {assigned.course_id} in room {candidate.room_id}"

    # 2. Student overlap & minimum gap
    for assigned in assigned_placements.values():
        shared = norm.shared_students.get((candidate.course_id, assigned.course_id), 0)
        if shared > 0:
            if candidate.overlaps(assigned):
                return False, "student_overlap", f"Shares {shared} student(s) with {assigned.course_id} and intervals overlap"
            if min_gap > 0:
                gap = candidate.gap_minutes(assigned)
                if gap < min_gap:
                    return False, "minimum_gap", f"Shares student(s) with {assigned.course_id} but gap ({gap}m) < minimum ({min_gap}m)"

    # 3. Max exams per student per day
    if max_daily is not None and max_daily > 0:
        c_students = norm.course_students[candidate.course_id]
        if c_students:
            for s_id in c_students:
                count = 1  # Candidate exam on candidate.date
                for assigned in assigned_placements.values():
                    if assigned.date == candidate.date and s_id in norm.course_students[assigned.course_id]:
                        count += 1
                        if count > max_daily:
                            return False, "maximum_per_day", f"Student {s_id} would have {count} exams on {candidate.date} (max {max_daily})"

    return True, None, None


def compute_heuristic_and_forward_check(
    norm: NormalizedProblem,
    unassigned_courses: List[str],
    assigned_placements: Dict[str, ExamPlacement],
    heuristic_mode: str = "admissible",
) -> Tuple[Optional[int], Optional[str]]:
    """
    Computes h(S) and checks if any unassigned course's domain becomes empty.
    Returns (h_val, empty_course_id).
    If any domain is empty, returns (None, empty_course_id).
    """
    if not unassigned_courses:
        return 0, None

    h_total = 0

    for cid in unassigned_courses:
        base_domain = norm.static_base_domains[cid]
        min_course_cost: Optional[int] = None
        has_valid_assignment = False

        for slot, room in base_domain:
            candidate = norm.create_placement(cid, slot.id, room.id)
            valid, _, _ = is_action_valid_against_partial(norm, candidate, assigned_placements)
            if not valid:
                continue

            has_valid_assignment = True
            if heuristic_mode == "admissible":
                # cost = unary + sum(pair with assigned)
                cost = compute_unary_penalty(norm, cid, room.id)
                for assigned in assigned_placements.values():
                    cost += compute_pair_penalty(norm, candidate, assigned)
                if min_course_cost is None or cost < min_course_cost:
                    min_course_cost = cost

        if not has_valid_assignment:
            # Domain is empty! Forward check fails
            return None, cid

        if heuristic_mode == "admissible" and min_course_cost is not None:
            h_total += min_course_cost

    if heuristic_mode == "zero":
        return 0, None

    return h_total, None
