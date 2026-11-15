# Independent acceptance oracle

These files validate the proposed scheduling contract. They are not the application, its four search algorithms, a backend, or evidence that the future application passes its tests.

The implementation deliberately imports no application code. Keep that independence when integrating the project. Do not rewrite the expected penalties to make the application pass.

## Run the checked baseline

From the kit/project root, with Python 3.10 or later:

```sh
python -m unittest discover -s verification -v
```

The baseline contains 15 test methods, including subcases for all supplied fixture expectations. It checks conflicts across different slot IDs, capacity equality, half-open interval boundaries, room blackouts, hard daily and break limits, malformed references, duplicate enrollments and assignments, normalized course-code uniqueness, required names, empty scheduling domains, exact soft penalties, and brute-force guardrails.

## Check an application's exported solution

The solution file must be either an assignment list or an object containing an `assignments` list. Each assignment has `course_id`, `slot_id`, and `room_id`.

```sh
python verification/oracle.py fixtures/tiny_feasible.json --solution path/to/application-result.json
```

An invalid result prints structured violations and exits with code 1. A valid result prints a separately recomputed penalty and its components and exits with code 0. Infeasible assignments receive `penalty: null`; they must never appear to beat feasible results in a comparison.

## Establish tiny-instance ground truth

```sh
python verification/oracle.py fixtures/tiny_feasible.json --enumerate
python verification/oracle.py fixtures/tiny_infeasible.json --enumerate
```

The exhaustive oracle refuses more than three courses or more than 100,000 raw complete candidate assignments. Its `candidate_count` is not the application's generated/explored-node metric. An `INFEASIBLE` oracle result exhausts this finite tiny assignment space; an application timeout does not establish infeasibility.

## Contract details

- Missing `allowed_slot_ids` means all defined slots; an empty list means no legal slot.
- Courses with no available rooms or slots form a structurally valid but infeasible scheduling problem. A draft with no courses is not runnable and is rejected with `empty_courses`.
- Course codes must be nonblank and unique after trimming and case folding.
- Room unavailability is an interval, not a slot-ID equality check.
- Exam occupancy begins at the selected slot's start and ends after the course's duration. The entire exam must fit inside that slot.
- Intervals are half-open. An exam ending at 10:00 may be followed by one starting at 10:00 unless a positive hard break is configured.
- The short-gap penalty applies only to shared students, on the same date, with a nonnegative actual break strictly less than `preferred_gap_minutes`.
- `same_day_student_pairs` counts each unordered course pair once for each student enrolled in both; three same-day exams for one student contribute three pairs.
- Spare seats are counted per scheduled exam, not per room for the entire day.
- All weights are nonnegative integers. Default weights are test choices, not a claim about a university's preferred policy.
- Times are interpreted in the problem's IANA timezone and compared in UTC. This standard-library verifier needs a system IANA timezone database. Some Windows installations need the Python `tzdata` package or a configured system database; application dependency provisioning should handle that explicitly.
- Schema v1 does not represent an explicit UTC offset/fold. Ambiguous or nonexistent campus-local times at daylight-saving transitions are rejected instead of guessed.
- This is a deliberately small reference verifier, not the complete UI/import schema validator or a production scheduling service.

## Fixture results

| Fixture | Ground truth | Purpose |
| --- | --- | --- |
| `tiny_feasible.json` | Optimum penalty 0; another valid solution has penalty 130 | Demonstrate feasibility vs solution quality |
| `tiny_infeasible.json` | No feasible assignment among 64 complete candidates | One student has three exams but only two mutually overlapping choices of time; adding a second room does not help |
| `capacity_boundary.json` | Optimum 0; exactly full room is valid | Check `students <= capacity`, not strict inequality |
| `overlap_alias.json` | Optimum 130; different slot IDs may still conflict | Check actual intervals and half-open boundary |
| `room_blackout.json` | Optimum 0; a room becomes usable exactly when its blackout ends | Check explicit room availability |
| `demo_small.json` | Supplied valid schedule has penalty 200 | Four-course visual demo; deliberately outside this oracle's course-count guard |

`fixtures/expectations.json` identifies the valid and deliberately invalid saved solutions. The four-course demo's penalty of 200 can also be justified manually: every course pair shares exactly one student, four mutually conflicting exams use four time slots across two days with two slots per day, and the exact-capacity room creates no spare-seat penalty. There are two same-day pairs, each costing 100; the one-hour between-slot break avoids the strict short-gap threshold.
