# Delivery plan and review gates

This is a scope-and-evidence plan, not a guaranteed delivery-time estimate. Actual duration depends on the existing repository, local environment, agent capacity, and observed failures. Finish the working flow before spending time on optional decoration.

## Gate A — real vertical slice

Build the normalized domain and input validation; an independent complete-schedule validator; deterministic DFS; a minimal FastAPI run endpoint/event stream; and a React page that loads the tiny sample, starts search, shows genuine events, and displays its validated result.

Acceptance: launch from documented commands; an actual selected DFS run produces a full schedule; the saved result passes `verification/oracle.py`; a visible rejected action names its real reason; status and counts come from the backend. A screenshot backed by a hard-coded answer does not pass.

Record the actual route, command output, and result JSON. Define stable API types before parallel work.

## Gate B — correctness, controls, and editable data

Implement BFS, Greedy, A*, the weighted objective and lower bound, common forward checking, shared counters, sound preflight, resource caps, and honest terminal states. Add editable setup, saved immutable revisions, validation feedback, and persistence. Connect real pause/resume/step/cancel/reset/speed with an ordered event protocol.

Acceptance:

- All four algorithms return independently valid tiny schedules.
- A* penalty matches exhaustive oracle minima on tiny cases, including 0 on `tiny_feasible.json`.
- The two-course fixture distinguishes feasible penalty 130 from optimal penalty 0; never fabricate wall times or node counts from this expected outcome.
- Check heuristic admissibility/consistency on enumerable partial states, `h(goal)=0`, and full objective vs incremental cost equality.
- Search exhaustive impossibility and a deliberately capped run produce different statuses. A preflight proof may end a run before a cap; choose a nontrivial fixture for cap tests.
- Pause acknowledgment freezes actual progression; one Step advances exactly one transition; Reset isolates old events; Cancel stops the worker.
- Editing data creates a new revision and leaves historical results visibly attached to the original.
- Reload restores saved setup and completed results; restarting the service marks active runs `INTERRUPTED`.

Do not proceed with a falsely labeled A* implementation or a UI that cannot stop its worker.

## Gate C — complete product workflow

Complete the home page, setup flow, algorithm selection, Search Lab, result states, timetable table/calendar/room views, search/filter/sort, statistics, independent re-validation, PDF/XLSX/JSON export, and actual comparison.

Acceptance: the critical journeys in `PRODUCT_AND_ACCEPTANCE.md` work in the browser. All three timetable views reference the same assignments. Exported content matches the selected full/filtered scope. Re-open XLSX and inspect cell types/values; render PDF and inspect its pages. Check a non-ASCII/long-name case. Every visible control performs its labeled action.

Benchmark runs use a frozen snapshot, equal caps, and a sequential schedule without teaching delays. Failures remain visible. Export comparison methodology and raw trials.

## Gate D — polish and delivery evidence

Apply the dark Search Lab and light timetable direction. Inspect laptop/desktop and narrow layouts, keyboard paths, focus states, empty/loading/error states, graph truncation, and chart labels. Fix concrete defects rather than repeating unchanged tests.

Deliver:

1. Running application and tested startup commands.
2. README with prerequisites, assumptions, constraints, limits, and code map.
3. Locked dependencies and deterministic fixtures.
4. Actual backend/type/build/end-to-end results with commands and exit outcomes.
5. Screenshots from the running Search Lab, timetable, and comparison.
6. PDF, XLSX, and JSON from a real run.
7. A 3–5 minute demo script.
8. `docs/IMPLEMENTATION_STATUS.md` with completed, blocked, and unverified items.

## Suggested parallel ownership after Gate A

| Track | Owns | Must not change independently |
| --- | --- | --- |
| Search engineer | Pure engine, objective, heuristic, algorithm tests | Shared API schema, UI, dependencies |
| Frontend engineer | Setup, lab renderer, timetable, comparison UI | Solver semantics, result enum meanings |
| Integration engineer | Sessions, storage, exports, API tests | Engine priority policy or fixture expected values |
| Integrator/reviewer | Shared contracts, dependency changes, end-to-end review | Must verify merged flow before success claims |

If the available environment has fewer agents, use the same boundaries sequentially. Parallelism is optional; contract stability is essential. Do not let multiple agents overwrite the same store/types files.

## What to omit if optional time runs out

Optional after all requested features: fancy home-page animation, a conflict graph in setup, extended full-trace replay, multiple theme settings, advanced drag-and-drop rescheduling, user authentication, and cloud deployment. Do not silently omit PDF, XLSX, required controls, or one of the three timetable views; those are requested scope.

## Suggested demonstration

1. Load `demo_small`, explain the enrollment-derived conflict constraints, and show the objective and limits.
2. Start a real teaching run; pause on a rejection, inspect its reason, step, and resume.
3. Show the validated timetable in table, calendar, and room views. Filter and export it.
4. Run the four-way comparison on the tiny quality fixture. Explain actual timing, counts, and penalty, without declaring a universal winner.
5. Show proven infeasibility on the tiny impossible case; then a genuinely capped attempt on a case that was not resolved by preflight. Explain why the statuses differ.

Use real runs during the demo. Saved traces may be used only when labeled Replay. Keep a saved run as a recovery aid, not a fake live result.
