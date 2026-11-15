from __future__ import annotations
from typing import List, Dict, Any, Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from app.schemas.problem import ProblemDocument, Assignment
from app.domain.normalized import NormalizedProblem, ExamPlacement


def validate_schedule(problem: ProblemDocument, assignments: List[Assignment]) -> Dict[str, Any]:
    """
    Independent complete-schedule validator.
    Validates hard constraints and computes objective penalty breakdown.
    Does not import or rely on any search engine code.
    """
    violations: List[Dict[str, Any]] = []

    try:
        norm = NormalizedProblem(problem)
    except Exception as e:
        return {
            "valid": False,
            "violations": [{"code": "problem_invalid", "message": str(e)}],
            "penalty": None,
            "breakdown": None,
        }

    # 1. Assignment count and completeness
    assigned_courses = set()
    for a in assignments:
        if a.course_id in assigned_courses:
            violations.append({
                "code": "duplicate_assignment",
                "message": f"Course {a.course_id} is assigned multiple times",
                "course_id": a.course_id,
            })
        assigned_courses.add(a.course_id)

    expected_courses = set(norm.courses_by_id.keys())
    if assigned_courses != expected_courses:
        missing = expected_courses - assigned_courses
        if missing:
            violations.append({
                "code": "assignment_count",
                "message": f"Missing assignments for courses: {sorted(missing)}",
                "missing": sorted(missing),
            })
        extra = assigned_courses - expected_courses
        if extra:
            violations.append({
                "code": "assignment_reference",
                "message": f"Assigned unknown courses: {sorted(extra)}",
                "extra": sorted(extra),
            })

    # 2. Reference validation and exam placement construction
    placements: Dict[str, ExamPlacement] = {}
    for a in assignments:
        if a.course_id not in norm.courses_by_id:
            continue
        if a.slot_id not in norm.slots_by_id:
            violations.append({
                "code": "assignment_reference",
                "message": f"Unknown slot {a.slot_id} in assignment for course {a.course_id}",
                "course_id": a.course_id,
                "slot_id": a.slot_id,
            })
            continue
        if a.room_id not in norm.rooms_by_id:
            violations.append({
                "code": "assignment_reference",
                "message": f"Unknown room {a.room_id} in assignment for course {a.course_id}",
                "course_id": a.course_id,
                "room_id": a.room_id,
            })
            continue

        course = norm.courses_by_id[a.course_id]
        slot = norm.slots_by_id[a.slot_id]
        room = norm.rooms_by_id[a.room_id]

        # Allowed slots
        if course.allowed_slot_ids is not None and a.slot_id not in course.allowed_slot_ids:
            violations.append({
                "code": "allowed_slot",
                "message": f"Slot {a.slot_id} is not in allowed slots for course {a.course_id}",
                "course_id": a.course_id,
                "slot_id": a.slot_id,
            })

        # Slot duration fit
        slot_interval = norm.slot_intervals[a.slot_id]
        if course.duration_minutes > slot_interval.duration_minutes:
            violations.append({
                "code": "duration",
                "message": f"Course {a.course_id} duration ({course.duration_minutes}m) exceeds slot {a.slot_id} duration ({slot_interval.duration_minutes}m)",
                "course_id": a.course_id,
                "slot_id": a.slot_id,
            })

        # Room capacity
        n_stus = norm.course_student_count[a.course_id]
        if room.capacity < n_stus:
            violations.append({
                "code": "capacity",
                "message": f"Room {a.room_id} capacity ({room.capacity}) is less than course {a.course_id} enrollment ({n_stus})",
                "course_id": a.course_id,
                "room_id": a.room_id,
                "capacity": room.capacity,
                "enrolled": n_stus,
            })

        placement = norm.create_placement(a.course_id, a.slot_id, a.room_id)
        placements[a.course_id] = placement

        # Room blackout check
        for b_interval in norm.room_blackouts.get(a.room_id, []):
            if placement.start_dt < b_interval.end_dt and b_interval.start_dt < placement.end_dt:
                violations.append({
                    "code": "room_blackout",
                    "message": f"Exam for course {a.course_id} overlaps blackout period in room {a.room_id}",
                    "course_id": a.course_id,
                    "room_id": a.room_id,
                })

    # 3. Pairwise checks: Room overlap, Student conflict, Minimum gap
    cids = list(placements.keys())
    for i in range(len(cids)):
        c1 = cids[i]
        p1 = placements[c1]
        for j in range(i + 1, len(cids)):
            c2 = cids[j]
            p2 = placements[c2]

            # Room overlap
            if p1.room_id == p2.room_id and p1.overlaps(p2):
                violations.append({
                    "code": "room_overlap",
                    "message": f"Courses {c1} and {c2} overlap in room {p1.room_id}",
                    "course_1": c1,
                    "course_2": c2,
                    "room_id": p1.room_id,
                })

            shared_count = norm.shared_students.get((c1, c2), 0)
            if shared_count > 0:
                # Student overlap
                if p1.overlaps(p2):
                    violations.append({
                        "code": "student_overlap",
                        "message": f"Courses {c1} and {c2} share {shared_count} student(s) and have overlapping intervals",
                        "course_1": c1,
                        "course_2": c2,
                        "shared_students": shared_count,
                    })
                else:
                    # Minimum gap
                    min_gap = norm.problem.constraints.minimum_gap_minutes
                    if min_gap > 0:
                        gap = p1.gap_minutes(p2)
                        if gap < min_gap:
                            violations.append({
                                "code": "minimum_gap",
                                "message": f"Courses {c1} and {c2} share students but gap ({gap}m) is less than required minimum ({min_gap}m)",
                                "course_1": c1,
                                "course_2": c2,
                                "gap_minutes": gap,
                                "minimum_gap_minutes": min_gap,
                            })

    # 4. Max exams per student per day
    max_daily = norm.problem.constraints.max_exams_per_student_per_day
    if max_daily is not None and max_daily > 0:
        for s_id, s_cids in norm.student_courses.items():
            daily_counts: Dict[str, int] = {}
            for cid in s_cids:
                if cid in placements:
                    date = placements[cid].date
                    daily_counts[date] = daily_counts.get(date, 0) + 1
                    if daily_counts[date] > max_daily:
                        violations.append({
                            "code": "maximum_per_day",
                            "message": f"Student {s_id} has {daily_counts[date]} exams on {date}, exceeding max {max_daily}",
                            "student_id": s_id,
                            "date": date,
                            "count": daily_counts[date],
                            "max_allowed": max_daily,
                        })

    if violations:
        return {
            "valid": False,
            "violations": violations,
            "penalty": None,
            "breakdown": None,
        }

    # 5. Compute objective penalty and breakdown
    w_same = norm.problem.objective.same_day_weight
    w_short = norm.problem.objective.short_gap_weight
    w_room = norm.problem.objective.spare_seat_weight
    pref_gap = norm.problem.objective.preferred_gap_minutes

    same_day_pairs = 0
    short_gap_pairs = 0
    total_spare_seats = 0

    # Unary spare seats
    for cid, placement in placements.items():
        room = norm.rooms_by_id[placement.room_id]
        n_stus = norm.course_student_count[cid]
        spare = room.capacity - n_stus
        total_spare_seats += spare

    # Binary pairs
    for i in range(len(cids)):
        c1 = cids[i]
        p1 = placements[c1]
        for j in range(i + 1, len(cids)):
            c2 = cids[j]
            p2 = placements[c2]
            shared = norm.shared_students.get((c1, c2), 0)
            if shared > 0:
                if p1.date == p2.date:
                    same_day_pairs += shared
                    gap = p1.gap_minutes(p2)
                    if gap < pref_gap:
                        short_gap_pairs += shared

    penalty = (
        same_day_pairs * w_same
        + short_gap_pairs * w_short
        + total_spare_seats * w_room
    )

    breakdown = {
        "same_day_student_pairs": same_day_pairs,
        "same_day_penalty": same_day_pairs * w_same,
        "short_gap_student_pairs": short_gap_pairs,
        "short_gap_penalty": short_gap_pairs * w_short,
        "total_spare_seats": total_spare_seats,
        "spare_seats_penalty": total_spare_seats * w_room,
        "total_penalty": penalty,
    }

    return {
        "valid": True,
        "violations": [],
        "penalty": penalty,
        "breakdown": breakdown,
    }
