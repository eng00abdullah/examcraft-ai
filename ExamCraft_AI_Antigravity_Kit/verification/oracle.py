"""Independent ExamCraft AI acceptance oracle; not the application's search engine.

Python 3.10+, standard library only. A system IANA time-zone database is needed.
The exhaustive oracle is deliberately restricted to three courses and a small
Cartesian-product budget. Never use it as the application's scheduling engine.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
import itertools
import json
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def _integer(value: Any, minimum: int = 0) -> bool:
    return type(value) is int and value >= minimum


def _local_datetime(day: str, clock: str, tz: ZoneInfo) -> datetime:
    """Resolve an unambiguous campus-local minute to an aware UTC datetime."""
    if not isinstance(day, str) or len(day) != 10:
        raise ValueError("date must be YYYY-MM-DD")
    if not isinstance(clock, str) or len(clock) != 5:
        raise ValueError("time must be HH:MM")
    local = datetime.combine(date.fromisoformat(day), time.fromisoformat(clock))
    if local.strftime("%Y-%m-%d") != day or local.strftime("%H:%M") != clock:
        raise ValueError("date/time format is not canonical")
    candidates = []
    for fold in (0, 1):
        aware = local.replace(tzinfo=tz, fold=fold)
        utc = aware.astimezone(timezone.utc)
        if utc.astimezone(tz).replace(tzinfo=None) == local:
            candidates.append(utc)
    if not candidates:
        raise ValueError("local time does not exist due to a timezone transition")
    if len(set(candidates)) > 1:
        raise ValueError("ambiguous local time requires a schema with UTC offset/fold")
    return candidates[0]


def _overlap(a: tuple[datetime, datetime], b: tuple[datetime, datetime]) -> bool:
    # Half-open intervals: an exam ending at 10:00 does not overlap one at 10:00.
    return a[0] < b[1] and b[0] < a[1]


def _gap(a: tuple[datetime, datetime], b: tuple[datetime, datetime]) -> float:
    return (max(a[0], b[0]) - min(a[1], b[1])).total_seconds() / 60


def _prepare(problem: dict[str, Any]) -> tuple[dict[str, Any] | None, list[dict]]:
    errors: list[dict] = []

    def error(code: str, message: str, **details: Any) -> None:
        errors.append({"code": code, "message": message, **details})

    if not isinstance(problem, dict):
        return None, [{"code": "invalid_problem", "message": "Problem must be an object."}]
    if problem.get("schema_version") != "1.0":
        error("schema_version", "Expected schema_version 1.0.")
    for key in ("id", "name"):
        value = problem.get(key)
        if not isinstance(value, str) or not value.strip():
            error("problem_metadata", f"Problem {key} must be a nonblank string.")
    try:
        tz = ZoneInfo(problem.get("timezone", ""))
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        error("timezone", "Unknown timezone or missing system IANA timezone database.")
        tz = timezone.utc

    indexed: dict[str, dict[str, dict]] = {}
    for kind in ("courses", "students", "slots", "rooms"):
        rows = problem.get(kind)
        indexed[kind] = {}
        if not isinstance(rows, list):
            error("invalid_collection", f"{kind} must be a list.")
            continue
        if not rows and kind == "courses":
            error("empty_courses", "A draft without courses cannot be scheduled.")
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"]:
                error("invalid_id", f"Every {kind} row needs a nonempty string id.")
                continue
            identifier = row["id"]
            if identifier in indexed[kind]:
                error("duplicate_id", f"Duplicate id in {kind}.", id=identifier)
            indexed[kind][identifier] = row

    courses, students, slots, rooms = (indexed[k] for k in ("courses", "students", "slots", "rooms"))
    codes: set[str] = set()
    for course in courses.values():
        if not isinstance(course.get("name"), str) or not course["name"].strip():
            error("course_name", "Course name must be a nonblank string.", course_id=course["id"])
        if not _integer(course.get("duration_minutes"), 1):
            error("duration", "Exam duration must be a positive integer.", course_id=course["id"])
        code = course.get("code")
        if not isinstance(code, str) or not code.strip():
            error("course_code", "Course code must be a nonempty string after trimming.", course_id=course["id"])
        else:
            normalized_code = code.strip().casefold()
            if normalized_code in codes:
                error("duplicate_course_code", "Course codes must be unique after trimming and case folding.", code_value=code)
            codes.add(normalized_code)
        if "allowed_slot_ids" in course:
            allowed = course["allowed_slot_ids"]
            if not isinstance(allowed, list) or any(not isinstance(s, str) for s in allowed):
                error("allowed_slots", "allowed_slot_ids must be a list of slot IDs.", course_id=course["id"])
            elif len(set(allowed)) != len(allowed) or any(s not in slots for s in allowed):
                error("allowed_slots", "allowed_slot_ids has duplicate or unknown IDs.", course_id=course["id"])

    intervals: dict[str, tuple[datetime, datetime]] = {}
    for slot in slots.values():
        try:
            start = _local_datetime(slot["date"], slot["start_time"], tz)
            end = _local_datetime(slot["date"], slot["end_time"], tz)
            if end <= start:
                raise ValueError("slot end must follow start on the same date")
            intervals[slot["id"]] = (start, end)
        except (KeyError, TypeError, ValueError) as exc:
            error("slot_interval", str(exc), slot_id=slot["id"])

    blackouts: dict[str, list[tuple[datetime, datetime]]] = {}
    for room in rooms.values():
        if not isinstance(room.get("name"), str) or not room["name"].strip():
            error("room_name", "Room name must be a nonblank string.", room_id=room["id"])
        if not _integer(room.get("capacity"), 1):
            error("capacity", "Room capacity must be a positive integer.", room_id=room["id"])
        blackouts[room["id"]] = []
        unavailable = room.get("unavailable", [])
        if not isinstance(unavailable, list):
            error("room_blackout", "unavailable must be a list.", room_id=room["id"])
            continue
        for blackout in unavailable:
            try:
                start = _local_datetime(blackout["date"], blackout["start_time"], tz)
                end = _local_datetime(blackout["date"], blackout["end_time"], tz)
                if end <= start:
                    raise ValueError("blackout end must follow start on the same date")
                blackouts[room["id"]].append((start, end))
            except (KeyError, TypeError, ValueError) as exc:
                error("room_blackout", str(exc), room_id=room["id"])

    roster = {course_id: set() for course_id in courses}
    enrollments = problem.get("enrollments")
    seen: set[tuple[str, str]] = set()
    if not isinstance(enrollments, list):
        error("enrollments", "enrollments must be a list.")
    else:
        for enrollment in enrollments:
            if not isinstance(enrollment, dict):
                error("enrollment", "Enrollment must be an object.")
                continue
            student_id, course_id = enrollment.get("student_id"), enrollment.get("course_id")
            if not isinstance(student_id, str) or not isinstance(course_id, str):
                error("enrollment", "Enrollment IDs must be strings.")
                continue
            pair = (student_id, course_id)
            if student_id not in students or course_id not in courses:
                error("enrollment_reference", "Enrollment references an unknown student or course.")
            elif pair in seen:
                error("duplicate_enrollment", "Duplicate student-course enrollment.", student_id=student_id, course_id=course_id)
            else:
                roster[course_id].add(student_id)
            seen.add(pair)

    constraints = problem.get("constraints", {})
    objective = problem.get("objective", {})
    if not isinstance(constraints, dict):
        error("constraints", "constraints must be an object.")
        constraints = {}
    if not isinstance(objective, dict):
        error("objective", "objective must be an object.")
        objective = {}
    max_per_day = constraints.get("max_exams_per_student_per_day")
    if max_per_day is not None and not _integer(max_per_day, 1):
        error("maximum_per_day", "Maximum exams/day must be null or a positive integer.")
    if not _integer(constraints.get("minimum_gap_minutes", 0)):
        error("minimum_gap", "Minimum gap must be a nonnegative integer.")
    for key in ("same_day_weight", "short_gap_weight", "spare_seat_weight", "preferred_gap_minutes"):
        if not _integer(objective.get(key)):
            error("objective_weight", f"{key} must be a nonnegative integer.")
    if errors:
        return None, errors
    return {**indexed, "intervals": intervals, "blackouts": blackouts, "roster": roster,
            "constraints": constraints, "objective": objective, "timezone": tz}, []


def verify(problem: dict, assignments: list[dict]) -> dict:
    """Check an entire claimed solution independently; never trust app metrics.

    Invalid solutions have penalty=None: they are not comparable to feasible
    solutions. Violations include input errors, missing/duplicate assignments,
    unknown IDs, duration, capacity, blackouts, room and student conflicts,
    maximum exams/day, and minimum hard break.
    """
    context, errors = _prepare(problem)
    if errors:
        return {"valid": False, "violations": errors, "penalty": None, "breakdown": None}
    assert context is not None
    if not isinstance(assignments, list):
        return {"valid": False, "violations": [{"code": "assignments", "message": "assignments must be a list."}],
                "penalty": None, "breakdown": None}
    courses, slots, rooms = (context[k] for k in ("courses", "slots", "rooms"))
    roster, objective, constraints = (context[k] for k in ("roster", "objective", "constraints"))
    counts: Counter = Counter()
    prepared: list[dict] = []

    def violation(code: str, message: str, **details: Any) -> None:
        errors.append({"code": code, "message": message, **details})

    for row in assignments:
        if not isinstance(row, dict):
            violation("assignment", "Assignment must be an object.")
            continue
        course_id, slot_id, room_id = (row.get(k) for k in ("course_id", "slot_id", "room_id"))
        if not all(isinstance(identifier, str) for identifier in (course_id, slot_id, room_id)):
            violation("assignment_reference", "Assignment IDs must be strings.")
            continue
        counts[course_id] += 1
        if course_id not in courses or slot_id not in slots or room_id not in rooms:
            violation("assignment_reference", "Assignment references an unknown course, slot, or room.",
                      course_id=course_id, slot_id=slot_id, room_id=room_id)
            continue
        course, slot, room = courses[course_id], slots[slot_id], rooms[room_id]
        slot_start, slot_end = context["intervals"][slot_id]
        if course["duration_minutes"] > (slot_end - slot_start).total_seconds() / 60:
            violation("duration", "Exam does not fit in its slot.", course_id=course_id)
            continue
        exam_interval = (slot_start, slot_start + timedelta(minutes=course["duration_minutes"]))
        if "allowed_slot_ids" in course and slot_id not in course["allowed_slot_ids"]:
            violation("course_unavailable", "Selected slot is outside course's allowed slots.", course_id=course_id)
        if len(roster[course_id]) > room["capacity"]:
            violation("capacity", "Enrolled student count exceeds room capacity.", course_id=course_id, room_id=room_id)
        if any(_overlap(exam_interval, blocked) for blocked in context["blackouts"][room_id]):
            violation("room_unavailable", "Exam overlaps a room blackout.", course_id=course_id, room_id=room_id)
        prepared.append({**row, "date": slot["date"], "interval": exam_interval})
    for course_id in courses:
        if counts[course_id] != 1:
            violation("assignment_count", "Every course must occur exactly once.", course_id=course_id, count=counts[course_id])

    same_day_pairs = 0
    short_gap_pairs = 0
    for left, right in itertools.combinations(prepared, 2):
        common = roster[left["course_id"]] & roster[right["course_id"]]
        overlapping = _overlap(left["interval"], right["interval"])
        pair_ids = [left["course_id"], right["course_id"]]
        if overlapping and left["room_id"] == right["room_id"]:
            violation("room_overlap", "Two exams occupy the same room at overlapping times.", course_ids=pair_ids)
        if overlapping and common:
            violation("student_overlap", "Shared students have overlapping exams.", course_ids=pair_ids, students=sorted(common))
        gap = _gap(left["interval"], right["interval"])
        if common and not overlapping and gap < constraints.get("minimum_gap_minutes", 0):
            violation("minimum_gap", "Shared students do not receive the configured hard break.", course_ids=pair_ids, gap_minutes=gap)
        if left["date"] == right["date"]:
            same_day_pairs += len(common)
            if 0 <= gap < objective["preferred_gap_minutes"]:
                short_gap_pairs += len(common)

    per_day: Counter = Counter()
    for row in prepared:
        for student_id in roster[row["course_id"]]:
            per_day[(student_id, row["date"])] += 1
    maximum = constraints.get("max_exams_per_student_per_day")
    if maximum is not None:
        for (student_id, day), count in per_day.items():
            if count > maximum:
                violation("maximum_per_day", "Student exceeds configured daily exam maximum.", student_id=student_id, date=day, count=count)
    if errors:
        return {"valid": False, "violations": errors, "penalty": None, "breakdown": None}

    spare_seats = sum(rooms[row["room_id"]]["capacity"] - len(roster[row["course_id"]]) for row in prepared)
    breakdown = {
        "same_day_student_pairs": same_day_pairs,
        "short_gap_student_pairs": short_gap_pairs,
        "spare_seats": spare_seats,
        "same_day_penalty": same_day_pairs * objective["same_day_weight"],
        "short_gap_penalty": short_gap_pairs * objective["short_gap_weight"],
        "spare_seat_penalty": spare_seats * objective["spare_seat_weight"],
    }
    penalty = sum(breakdown[key] for key in ("same_day_penalty", "short_gap_penalty", "spare_seat_penalty"))
    return {"valid": True, "violations": [], "penalty": penalty, "breakdown": breakdown}


def brute_force(problem: dict, max_candidates: int = 100_000) -> dict:
    """Enumerate complete assignments for tiny tests; no application code imported."""
    context, errors = _prepare(problem)
    if errors:
        return {"status": "INVALID_INPUT", "violations": errors}
    assert context is not None
    if len(context["courses"]) > 3:
        raise ValueError("Oracle supports at most three courses; this is a correctness fixture tool.")
    course_ids = sorted(context["courses"])
    # Check the Cartesian-product budget before allocating assignment dictionaries.
    # An empty domain proves infeasibility even if another raw domain is enormous.
    room_ids = sorted(context["rooms"])
    slot_choices = []
    candidate_count = 1
    for course_id in course_ids:
        course = context["courses"][course_id]
        slot_ids = sorted(course.get("allowed_slot_ids", context["slots"]))
        slot_choices.append(slot_ids)
        candidate_count *= len(slot_ids) * len(room_ids)
    if candidate_count == 0:
        return {"status": "INFEASIBLE", "candidate_count": 0, "feasible_count": 0,
                "optimal_penalty": None, "assignments": None}
    if candidate_count > max_candidates:
        raise ValueError(f"Oracle candidate budget exceeded: {candidate_count} > {max_candidates}.")
    domains = [
        [{"course_id": course_id, "slot_id": s, "room_id": r}
         for s in slot_ids for r in room_ids]
        for course_id, slot_ids in zip(course_ids, slot_choices)
    ]
    best = None
    best_penalty = None
    feasible_count = 0
    evaluated = 0
    for candidate in itertools.product(*domains):
        evaluated += 1
        result = verify(problem, list(candidate))
        if result["valid"]:
            feasible_count += 1
            if best_penalty is None or result["penalty"] < best_penalty:
                best_penalty = result["penalty"]
                best = list(candidate)
    return {"status": "OPTIMAL" if best is not None else "INFEASIBLE",
            "candidate_count": evaluated, "feasible_count": feasible_count,
            "optimal_penalty": best_penalty, "assignments": best}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("problem", type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--solution", type=Path, help="JSON list or object with assignments list")
    group.add_argument("--enumerate", action="store_true", help="Tiny fixtures only, <=3 courses")
    args = parser.parse_args()
    problem = json.loads(args.problem.read_text(encoding="utf-8"))
    if args.enumerate:
        result = brute_force(problem)
        success = result["status"] != "INVALID_INPUT"
    else:
        solution = json.loads(args.solution.read_text(encoding="utf-8"))
        assignments = solution.get("assignments") if isinstance(solution, dict) else solution
        result = verify(problem, assignments)
        success = result["valid"]
    print(json.dumps(result, indent=2))
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
