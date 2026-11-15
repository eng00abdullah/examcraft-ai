# Data contract — version 1.0

This contract fixes the application inputs before parallel implementation. See `fixtures/` for executable examples. The fixture verifier is independent test tooling; implement production schema validation separately.

## Problem document

```json
{
  "schema_version": "1.0",
  "id": "demo",
  "name": "ExamCraft demonstration",
  "timezone": "Africa/Cairo",
  "courses": [
    {"id": "A", "code": "AI101", "name": "Artificial Intelligence", "duration_minutes": 60}
  ],
  "students": [{"id": "S001", "display_name": "Student 001"}],
  "enrollments": [{"student_id": "S001", "course_id": "A"}],
  "slots": [
    {"id": "T1", "date": "2026-12-01", "start_time": "09:00", "end_time": "11:00"}
  ],
  "rooms": [
    {"id": "R1", "name": "Hall 1", "capacity": 60, "unavailable": []}
  ],
  "constraints": {
    "max_exams_per_student_per_day": null,
    "minimum_gap_minutes": 0
  },
  "objective": {
    "same_day_weight": 100,
    "short_gap_weight": 30,
    "spare_seat_weight": 1,
    "preferred_gap_minutes": 60
  }
}
```

Optional course `allowed_slot_ids`:

- Omitted: every defined slot is a candidate, subject to all other constraints.
- Nonempty array: only those exact slots are candidates.
- Empty array: no allowed placements. This is a structurally valid but infeasible instance, with an understandable explanation.

A room blackout is `{"date":"2026-12-01","start_time":"09:00","end_time":"12:00"}` in `unavailable`. It blocks actual overlapping exam time even when the chosen slot has a different ID.

## Structural validation

- IDs are nonempty strings and unique within their collection. Course codes are nonempty and unique after trimming and case folding. Names are nonempty. Preserve non-ASCII display text.
- References must resolve. Enrollment pairs must be unique. A student count is always the count of distinct enrollment records for that course, never a separately editable field.
- Durations and capacities are strictly positive integers, not booleans or numeric strings. Dates are ISO calendar dates and times use 24-hour `HH:MM`. An end time must be strictly later than its start on the same date.
- Weights are nonnegative integers. Preferred gap and hard minimum gap are nonnegative integer minutes. Maximum daily exams is null or a positive integer.
- An empty course list is valid draft setup but not runnable. Missing rooms or slots with nonempty courses is a structurally valid infeasible problem and may be explained by preflight.
- Zero-enrollment courses are supported: they still require one exam assignment. Indicate them in setup. Students without enrollments are allowed.
- Validate the IANA timezone. Reject ambiguous or nonexistent local slot/blackout times in schema v1, which has no UTC-offset/fold field. Ensure timezone data is available on the target platform, including Windows.
- **Overlapping slot definitions are allowed.** They are candidate start windows, not proof that exams are disjoint. Always validate actual intervals; different slot IDs can still collide. Warn in setup, but do not silently merge or reject all overlapping definitions.
- Parse an import completely before committing it. On error, preserve the previous saved revision and show paths/row indices for fixes.

## Time and placement semantics

An exam starts at its chosen slot's start time. Its end is start plus the course duration. It must fit entirely within the slot. Exams do not cross midnight in v1. Use half-open intervals `[start, end)`: an exam ending at 10:00 can be followed by another at 10:00 when the hard minimum gap is zero.

Shared students cannot have overlapping exams; a room hosts only one exam at a time. Hard minimum gaps apply to shared-student pairs using actual elapsed minutes, including pairs across dates. A hard daily maximum groups exams by their local examination date. Room blackouts use interval intersection. Every constraint is enforced against actual start/end instants, not slot IDs alone.

One course has one exam assigned wholly to one room. No splitting students across rooms, simultaneous copies of an exam, multi-campus travel time, invigilators, or accommodation modeling in this first version. Describe these boundaries visibly.

## Immutable revisions and run configuration

Store drafts separately from committed problem snapshots. A save creates an immutable revision, with a canonical SHA-256 content hash. Canonicalize collections by IDs and enrollment pairs, normalize explicit defaults, then use stable JSON field ordering. Exclude save timestamps from the problem hash. Document the normalization so the same semantic input has the same hash.

A run records `run_id`, revision ID, problem hash, the full snapshot, algorithm, engine version, course/action order version, heuristic version, preference weights, pruning settings, limits, timing method, mode, timestamps, terminal reason, metrics, validation result, and optional assignments. Editing inputs never mutates a running or historical run.

Baseline shared run limits (product defaults, configurable):

```json
{
  "max_expanded_nodes": 10000,
  "max_generated_nodes": 50000,
  "max_frontier_nodes": 25000,
  "max_search_seconds": 5,
  "max_wall_seconds": 300
}
```

These are protective defaults, not promised capacities. Keep hard service ceilings documented. A frontier-node count is not a measurement of bytes of RAM. `max_wall_seconds` protects abandoned teaching sessions; distinguish it from active search time.

## Solution export

```json
{
  "schema_version": "1.0",
  "run_id": "assigned-by-application",
  "problem_revision_id": "assigned-by-application",
  "problem_hash": "computed-by-application",
  "algorithm": "astar",
  "status": "SUCCEEDED",
  "optimality_proven": true,
  "assignments": [{"course_id":"A","slot_id":"T1","room_id":"R1"}],
  "problem": "replace this explanatory placeholder with the full problem object",
  "metrics": "replace with the real metrics object",
  "validation": "replace with the independent application validation report"
}
```

The example above illustrates the wrapper; placeholder strings must never appear in a real export. The checker consumes the actual problem JSON plus the `assignments` array (see its CLI documentation). A partial assignment is never a successful final timetable. Missing measurements remain null with a reason; they are not converted to zero.
