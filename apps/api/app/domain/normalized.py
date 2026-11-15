from __future__ import annotations
import json
import hashlib
from datetime import datetime, date, time, timezone, timedelta
from typing import Dict, List, Set, Tuple, Optional, Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.schemas.problem import ProblemDocument, Course, Student, Slot, Room, RoomUnavailable


def _local_datetime_to_utc(day: str, clock: str, tz: ZoneInfo) -> datetime:
    """Resolve an unambiguous campus-local minute to an aware UTC datetime."""
    if not isinstance(day, str) or len(day) != 10:
        raise ValueError("date must be YYYY-MM-DD")
    if not isinstance(clock, str) or len(clock) != 5:
        raise ValueError("time must be HH:MM")
    local = datetime.combine(datetime.strptime(day, "%Y-%m-%d").date(), datetime.strptime(clock, "%H:%M").time())
    if local.strftime("%Y-%m-%d") != day or local.strftime("%H:%M") != clock:
        raise ValueError("date/time format is not canonical")
    candidates = []
    for fold in (0, 1):
        aware = local.replace(tzinfo=tz, fold=fold)
        utc = aware.astimezone(timezone.utc)
        if utc.astimezone(tz).replace(tzinfo=None) == local:
            candidates.append(utc)
    if not candidates:
        raise ValueError(f"Local time {day} {clock} does not exist due to a timezone transition")
    if len(set(candidates)) > 1:
        raise ValueError(f"Ambiguous local time {day} {clock} requires a schema with UTC offset/fold")
    return candidates[0]


class Interval:
    __slots__ = ("date", "start_time", "end_time", "start_dt", "end_dt", "duration_minutes")

    def __init__(self, date: str, start_time: str, end_time: str, tz: ZoneInfo):
        self.date = date
        self.start_time = start_time
        self.end_time = end_time
        self.start_dt = _local_datetime_to_utc(date, start_time, tz)
        self.end_dt = _local_datetime_to_utc(date, end_time, tz)
        if self.end_dt <= self.start_dt:
            raise ValueError(f"End time {end_time} must be strictly after start time {start_time}")
        self.duration_minutes = int((self.end_dt - self.start_dt).total_seconds() // 60)

    def overlaps(self, other: Interval) -> bool:
        return self.start_dt < other.end_dt and other.start_dt < self.end_dt

    def gap_minutes(self, other: Interval) -> int:
        """Nonnegative actual elapsed minutes between disjoint intervals."""
        if self.overlaps(other):
            return 0
        return int((max(self.start_dt, other.start_dt) - min(self.end_dt, other.end_dt)).total_seconds() // 60)


class ExamPlacement:
    __slots__ = ("course_id", "slot_id", "room_id", "date", "start_time", "end_time", "start_dt", "end_dt")

    def __init__(self, course_id: str, slot_id: str, room_id: str, date: str, start_time: str, duration_minutes: int, tz: ZoneInfo):
        self.course_id = course_id
        self.slot_id = slot_id
        self.room_id = room_id
        self.date = date
        self.start_time = start_time
        self.start_dt = _local_datetime_to_utc(date, start_time, tz)
        self.end_dt = self.start_dt + timedelta(minutes=duration_minutes)
        local_end = self.end_dt.astimezone(tz)
        self.end_time = local_end.strftime("%H:%M")

    def overlaps(self, other: ExamPlacement) -> bool:
        return self.start_dt < other.end_dt and other.start_dt < self.end_dt

    def gap_minutes(self, other: ExamPlacement) -> int:
        if self.overlaps(other):
            return 0
        return int((max(self.start_dt, other.start_dt) - min(self.end_dt, other.end_dt)).total_seconds() // 60)


def compute_canonical_hash(problem: ProblemDocument) -> str:
    """Computes a deterministic SHA-256 hash of the normalized problem document."""
    canonical_dict = {
        "schema_version": problem.schema_version,
        "id": problem.id,
        "name": problem.name,
        "timezone": problem.timezone,
        "courses": sorted(
            [
                {
                    "id": c.id,
                    "code": c.code.strip(),
                    "name": c.name,
                    "duration_minutes": c.duration_minutes,
                    "allowed_slot_ids": sorted(c.allowed_slot_ids) if c.allowed_slot_ids is not None else None,
                }
                for c in problem.courses
            ],
            key=lambda x: x["id"],
        ),
        "students": sorted(
            [{"id": s.id, "display_name": s.display_name} for s in problem.students],
            key=lambda x: x["id"],
        ),
        "enrollments": sorted(
            [{"student_id": e.student_id, "course_id": e.course_id} for e in problem.enrollments],
            key=lambda x: (x["student_id"], x["course_id"]),
        ),
        "slots": sorted(
            [
                {
                    "id": sl.id,
                    "date": sl.date,
                    "start_time": sl.start_time,
                    "end_time": sl.end_time,
                }
                for sl in problem.slots
            ],
            key=lambda x: (x["date"], x["start_time"], x["id"]),
        ),
        "rooms": sorted(
            [
                {
                    "id": r.id,
                    "name": r.name,
                    "capacity": r.capacity,
                    "unavailable": sorted(
                        [{"date": u.date, "start_time": u.start_time, "end_time": u.end_time} for u in r.unavailable],
                        key=lambda x: (x["date"], x["start_time"], x["end_time"]),
                    ),
                }
                for r in problem.rooms
            ],
            key=lambda x: x["id"],
        ),
        "constraints": {
            "max_exams_per_student_per_day": problem.constraints.max_exams_per_student_per_day,
            "minimum_gap_minutes": problem.constraints.minimum_gap_minutes,
        },
        "objective": {
            "same_day_weight": problem.objective.same_day_weight,
            "short_gap_weight": problem.objective.short_gap_weight,
            "spare_seat_weight": problem.objective.spare_seat_weight,
            "preferred_gap_minutes": problem.objective.preferred_gap_minutes,
        },
    }
    raw = json.dumps(canonical_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class NormalizedProblem:
    def __init__(self, problem: ProblemDocument):
        self.problem = problem
        self.problem_hash = compute_canonical_hash(problem)

        # Timezone
        try:
            self.tz = ZoneInfo(problem.timezone)
        except Exception as e:
            raise ValueError(f"Invalid timezone: {problem.timezone}") from e

        # Index courses
        self.courses_by_id: Dict[str, Course] = {}
        for c in problem.courses:
            self.courses_by_id[c.id] = c

        # Index slots
        self.slots_by_id: Dict[str, Slot] = {}
        self.slot_intervals: Dict[str, Interval] = {}
        for sl in problem.slots:
            self.slots_by_id[sl.id] = sl
            self.slot_intervals[sl.id] = Interval(sl.date, sl.start_time, sl.end_time, self.tz)

        # Candidate slot ordering: date, start_time, id
        self.ordered_slots: List[Slot] = sorted(
            problem.slots,
            key=lambda s: (s.date, s.start_time, s.id),
        )

        # Index rooms
        self.rooms_by_id: Dict[str, Room] = {}
        self.room_blackouts: Dict[str, List[Interval]] = {}
        for r in problem.rooms:
            self.rooms_by_id[r.id] = r
            self.room_blackouts[r.id] = [
                Interval(u.date, u.start_time, u.end_time, self.tz) for u in r.unavailable
            ]

        # Candidate room ordering: id
        self.ordered_rooms: List[Room] = sorted(problem.rooms, key=lambda r: r.id)

        # Index enrollments
        self.course_students: Dict[str, Set[str]] = {c.id: set() for c in problem.courses}
        self.student_courses: Dict[str, Set[str]] = {s.id: set() for s in problem.students}
        for e in problem.enrollments:
            if e.course_id in self.course_students:
                self.course_students[e.course_id].add(e.student_id)
            if e.student_id in self.student_courses:
                self.student_courses[e.student_id].add(e.course_id)

        self.course_student_count: Dict[str, int] = {
            cid: len(stus) for cid, stus in self.course_students.items()
        }

        # Shared students between pairs
        self.shared_students: Dict[Tuple[str, str], int] = {}
        cids = list(self.courses_by_id.keys())
        for i in range(len(cids)):
            c1 = cids[i]
            s1 = self.course_students[c1]
            for j in range(i + 1, len(cids)):
                c2 = cids[j]
                s2 = self.course_students[c2]
                count = len(s1 & s2)
                self.shared_students[(c1, c2)] = count
                self.shared_students[(c2, c1)] = count

        # Static conflict graph degree: number of other courses sharing >= 1 student
        self.conflict_degree: Dict[str, int] = {}
        for c1 in cids:
            deg = sum(1 for c2 in cids if c1 != c2 and self.shared_students.get((c1, c2), 0) > 0)
            self.conflict_degree[c1] = deg

        # Deterministic course ordering: decreasing degree, decreasing enrollment, course id
        self.ordered_courses: List[Course] = sorted(
            problem.courses,
            key=lambda c: (-self.conflict_degree[c.id], -self.course_student_count[c.id], c.id),
        )

        # Precompute static base domains per course:
        # A static base domain consists of (slot, room) pairs that pass:
        # 1. slot in course.allowed_slot_ids (if specified)
        # 2. exam duration fits within slot (slot start + duration <= slot end)
        # 3. room capacity >= course_student_count
        # 4. exam interval does not overlap any blackout interval of the room
        self.static_base_domains: Dict[str, List[Tuple[Slot, Room]]] = {}
        self.static_domain_exclusions: Dict[str, Dict[str, int]] = {}

        for course in problem.courses:
            domain = []
            exclusions = {
                "disallowed_slot": 0,
                "duration_exceeds_slot": 0,
                "insufficient_capacity": 0,
                "room_blackout": 0,
            }
            n_stus = self.course_student_count[course.id]

            for slot in self.ordered_slots:
                # 1. Allowed slot check
                if course.allowed_slot_ids is not None and slot.id not in course.allowed_slot_ids:
                    exclusions["disallowed_slot"] += len(self.ordered_rooms)
                    continue

                # 2. Exam fits slot check
                sl_interval = self.slot_intervals[slot.id]
                if course.duration_minutes > sl_interval.duration_minutes:
                    exclusions["duration_exceeds_slot"] += len(self.ordered_rooms)
                    continue

                exam = ExamPlacement(
                    course.id, slot.id, "", slot.date, slot.start_time, course.duration_minutes, self.tz
                )

                for room in self.ordered_rooms:
                    # 3. Capacity check
                    if room.capacity < n_stus:
                        exclusions["insufficient_capacity"] += 1
                        continue

                    # 4. Room blackout check
                    has_blackout = False
                    for b_interval in self.room_blackouts[room.id]:
                        if exam.start_dt < b_interval.end_dt and b_interval.start_dt < exam.end_dt:
                            has_blackout = True
                            break
                    if has_blackout:
                        exclusions["room_blackout"] += 1
                        continue

                    domain.append((slot, room))

            self.static_base_domains[course.id] = domain
            self.static_domain_exclusions[course.id] = exclusions

    def create_placement(self, course_id: str, slot_id: str, room_id: str) -> ExamPlacement:
        course = self.courses_by_id[course_id]
        slot = self.slots_by_id[slot_id]
        return ExamPlacement(
            course_id=course_id,
            slot_id=slot_id,
            room_id=room_id,
            date=slot.date,
            start_time=slot.start_time,
            duration_minutes=course.duration_minutes,
            tz=self.tz,
        )


def validate_problem_structural(problem: ProblemDocument) -> List[Dict[str, Any]]:
    """Validates structural constraints and returns list of error violations."""
    violations: List[Dict[str, Any]] = []

    # Timezone
    try:
        tz = ZoneInfo(problem.timezone)
    except Exception:
        violations.append({
            "field": "timezone",
            "code": "timezone",
            "message": f"Unknown timezone or missing system IANA timezone database: {problem.timezone}",
        })
        return violations

    # Required problem metadata
    if not problem.id.strip():
        violations.append({"field": "id", "code": "required", "message": "Problem ID cannot be blank"})
    if not problem.name.strip():
        violations.append({"field": "name", "code": "required", "message": "Problem Name cannot be blank"})

    # Courses
    course_ids = set()
    course_codes = set()
    for i, c in enumerate(problem.courses):
        if not c.id.strip():
            violations.append({"field": f"courses[{i}].id", "code": "required", "message": "Course ID cannot be blank"})
        elif c.id in course_ids:
            violations.append({"field": f"courses[{i}].id", "code": "duplicate", "message": f"Duplicate course ID: {c.id}"})
        course_ids.add(c.id)

        clean_code = c.code.strip().casefold()
        if not clean_code:
            violations.append({"field": f"courses[{i}].code", "code": "required", "message": "Course code cannot be blank"})
        elif clean_code in course_codes:
            violations.append({"field": f"courses[{i}].code", "code": "duplicate", "message": f"Duplicate course code: {c.code}"})
        course_codes.add(clean_code)

        if not c.name.strip():
            violations.append({"field": f"courses[{i}].name", "code": "required", "message": "Course name cannot be blank"})

        if c.duration_minutes <= 0:
            violations.append({"field": f"courses[{i}].duration_minutes", "code": "positive_integer", "message": "Duration must be strictly positive"})

    # Students
    student_ids = set()
    for i, s in enumerate(problem.students):
        if not s.id.strip():
            violations.append({"field": f"students[{i}].id", "code": "required", "message": "Student ID cannot be blank"})
        elif s.id in student_ids:
            violations.append({"field": f"students[{i}].id", "code": "duplicate", "message": f"Duplicate student ID: {s.id}"})
        student_ids.add(s.id)

        if not s.display_name.strip():
            violations.append({"field": f"students[{i}].display_name", "code": "required", "message": "Display name cannot be blank"})

    # Enrollments
    seen_enrollments = set()
    for i, e in enumerate(problem.enrollments):
        if e.student_id not in student_ids:
            violations.append({"field": f"enrollments[{i}].student_id", "code": "unknown_reference", "message": f"Unknown student reference: {e.student_id}"})
        if e.course_id not in course_ids:
            violations.append({"field": f"enrollments[{i}].course_id", "code": "unknown_reference", "message": f"Unknown course reference: {e.course_id}"})
        pair = (e.student_id, e.course_id)
        if pair in seen_enrollments:
            violations.append({"field": f"enrollments[{i}]", "code": "duplicate_enrollment", "message": f"Duplicate enrollment for student {e.student_id} in course {e.course_id}"})
        seen_enrollments.add(pair)

    # Slots
    slot_ids = set()
    for i, sl in enumerate(problem.slots):
        if not sl.id.strip():
            violations.append({"field": f"slots[{i}].id", "code": "required", "message": "Slot ID cannot be blank"})
        elif sl.id in slot_ids:
            violations.append({"field": f"slots[{i}].id", "code": "duplicate", "message": f"Duplicate slot ID: {sl.id}"})
        slot_ids.add(sl.id)

        try:
            s_dt = _local_datetime_to_utc(sl.date, sl.start_time, tz)
            e_dt = _local_datetime_to_utc(sl.date, sl.end_time, tz)
            if e_dt <= s_dt:
                violations.append({"field": f"slots[{i}].end_time", "code": "time_order", "message": f"End time must be strictly after start time on {sl.date}"})
        except ValueError as err:
            violations.append({"field": f"slots[{i}]", "code": "invalid_datetime", "message": f"Invalid date or time: {err}"})

    # Validate allowed_slot_ids references
    for i, c in enumerate(problem.courses):
        if c.allowed_slot_ids is not None:
            for s_id in c.allowed_slot_ids:
                if s_id not in slot_ids:
                    violations.append({"field": f"courses[{i}].allowed_slot_ids", "code": "unknown_reference", "message": f"Unknown slot reference: {s_id}"})

    # Rooms
    room_ids = set()
    for i, r in enumerate(problem.rooms):
        if not r.id.strip():
            violations.append({"field": f"rooms[{i}].id", "code": "required", "message": "Room ID cannot be blank"})
        elif r.id in room_ids:
            violations.append({"field": f"rooms[{i}].id", "code": "duplicate", "message": f"Duplicate room ID: {r.id}"})
        room_ids.add(r.id)

        if not r.name.strip():
            violations.append({"field": f"rooms[{i}].name", "code": "required", "message": "Room name cannot be blank"})

        if type(r.capacity) is bool or r.capacity <= 0:
            violations.append({"field": f"rooms[{i}].capacity", "code": "positive_integer", "message": "Capacity must be strictly positive integer"})

        for j, u in enumerate(r.unavailable):
            try:
                us_dt = _local_datetime_to_utc(u.date, u.start_time, tz)
                ue_dt = _local_datetime_to_utc(u.date, u.end_time, tz)
                if ue_dt <= us_dt:
                    violations.append({"field": f"rooms[{i}].unavailable[{j}]", "code": "time_order", "message": f"Blackout end time must be after start time on {u.date}"})
            except ValueError as err:
                violations.append({"field": f"rooms[{i}].unavailable[{j}]", "code": "invalid_datetime", "message": f"Invalid blackout datetime: {err}"})

    # Constraints & Objective
    if problem.constraints.max_exams_per_student_per_day is not None and problem.constraints.max_exams_per_student_per_day <= 0:
        violations.append({"field": "constraints.max_exams_per_student_per_day", "code": "positive_integer", "message": "Max exams per student per day must be positive"})
    if problem.constraints.minimum_gap_minutes < 0:
        violations.append({"field": "constraints.minimum_gap_minutes", "code": "non_negative", "message": "Minimum gap minutes cannot be negative"})

    if problem.objective.same_day_weight < 0:
        violations.append({"field": "objective.same_day_weight", "code": "non_negative", "message": "Weight cannot be negative"})
    if problem.objective.short_gap_weight < 0:
        violations.append({"field": "objective.short_gap_weight", "code": "non_negative", "message": "Weight cannot be negative"})
    if problem.objective.spare_seat_weight < 0:
        violations.append({"field": "objective.spare_seat_weight", "code": "non_negative", "message": "Weight cannot be negative"})
    if problem.objective.preferred_gap_minutes < 0:
        violations.append({"field": "objective.preferred_gap_minutes", "code": "non_negative", "message": "Preferred gap cannot be negative"})

    return violations
