# Verified results — handoff assets only

Date: 2026-11-14. Environment: Python 3.12.14.

## What was executed

From the kit root:

```sh
python3 -m unittest discover -s verification -v
python3 verification/oracle.py fixtures/tiny_feasible.json --enumerate
python3 verification/oracle.py fixtures/tiny_infeasible.json --enumerate
```

Observed combined exit code: **0**.

The verifier suite contains **15 test methods**, with additional fixture subcases. All passed. They cover exact penalties, half-open intervals, shared-student and room conflicts, capacity equality, room blackouts, hard break/daily limits, duration and allowed slots, duplicate/missing/unknown references, invalid numeric inputs, normalized course codes, required names, empty scheduling domains, and oracle resource guardrails.

## Established tiny-instance results

| Case | Raw complete candidates evaluated | Feasible schedules | Best penalty |
| --- | ---: | ---: | ---: |
| Tiny feasible | 9 | 6 | 0 |
| Tiny infeasible | 64 | 0 | Not applicable |

The saved same-day schedule in the feasible case has independently verified penalty 130. Its different-day counterpart has penalty 0. These are quality/feasibility facts about the fixtures, **not algorithm runtime measurements**.

Capacity-boundary, overlapping-slot, and blackout cases are checked through the fixture manifest. The four-course visual sample's supplied solution is valid with penalty 200; the exhaustive oracle intentionally refuses problems above three courses.

## Scope of this evidence

The application has not been implemented or run by this kit. No real BFS/DFS/Greedy/A* implementation, frontend, API lifecycle, browser interaction, PDF/XLSX export, or comparative performance measurement is claimed to have passed.

Antigravity must implement those features, run the actual application tests, and validate its own exported results with this independent checker. The oracle does not import application code and must not become the application's hidden solver.

## Captured command output

```text
test_course_codes_are_trimmed_case_insensitive_and_nonblank (test_oracle.IndependentOracleTests.test_course_codes_are_trimmed_case_insensitive_and_nonblank) ... ok
test_duplicate_enrollment_and_unknown_reference (test_oracle.IndependentOracleTests.test_duplicate_enrollment_and_unknown_reference) ... ok
test_duplicate_or_missing_course_is_not_complete (test_oracle.IndependentOracleTests.test_duplicate_or_missing_course_is_not_complete) ... ok
test_duration_and_allowlist (test_oracle.IndependentOracleTests.test_duration_and_allowlist) ... ok
test_empty_domains_are_infeasible_but_empty_courses_are_not_runnable (test_oracle.IndependentOracleTests.test_empty_domains_are_infeasible_but_empty_courses_are_not_runnable) ... ok
test_fixture_expectations (test_oracle.IndependentOracleTests.test_fixture_expectations) ... ok
test_hard_daily_limit_differs_from_soft_penalty (test_oracle.IndependentOracleTests.test_hard_daily_limit_differs_from_soft_penalty) ... ok
test_minimum_hard_break (test_oracle.IndependentOracleTests.test_minimum_hard_break) ... ok
test_negative_weight_and_boolean_capacity_rejected (test_oracle.IndependentOracleTests.test_negative_weight_and_boolean_capacity_rejected) ... ok
test_oracle_limits_are_enforced (test_oracle.IndependentOracleTests.test_oracle_limits_are_enforced) ... ok
test_required_names_and_problem_metadata_are_nonblank (test_oracle.IndependentOracleTests.test_required_names_and_problem_metadata_are_nonblank) ... ok
test_room_overlap_without_shared_students (test_oracle.IndependentOracleTests.test_room_overlap_without_shared_students) ... ok
test_room_spare_seats_have_separate_penalty (test_oracle.IndependentOracleTests.test_room_spare_seats_have_separate_penalty) ... ok
test_short_gap_threshold_is_strict (test_oracle.IndependentOracleTests.test_short_gap_threshold_is_strict) ... ok
test_unknown_assignment_is_invalid (test_oracle.IndependentOracleTests.test_unknown_assignment_is_invalid) ... ok

----------------------------------------------------------------------
Ran 15 tests in 0.012s

OK
{
  "status": "OPTIMAL",
  "candidate_count": 9,
  "feasible_count": 6,
  "optimal_penalty": 0,
  "assignments": [
    {
      "course_id": "A",
      "slot_id": "T1",
      "room_id": "R1"
    },
    {
      "course_id": "B",
      "slot_id": "T3",
      "room_id": "R1"
    }
  ]
}
{
  "status": "INFEASIBLE",
  "candidate_count": 64,
  "feasible_count": 0,
  "optimal_penalty": null,
  "assignments": null
}
```

