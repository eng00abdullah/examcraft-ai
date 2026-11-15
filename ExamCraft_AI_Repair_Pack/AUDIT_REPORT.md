# ExamCraft AI — independent source and execution review

Review date: 2026-11-14.

## Decision

**Keep the implementation and repair it before accepting the project as complete.** The application contains real search algorithms and useful working product components. However, reproduced defects affect the truth of its conclusions, run lifecycle, and reported performance. These are delivery blockers for an examination scheduling project.

This review did not change application source. This pack contains regression tests, additional fixtures, review evidence, and implementation instructions.

## What was actually verified

| Check | Observed result | Scope |
| --- | --- | --- |
| Existing independent oracle suite | 15 passed | The supplied verification suite was executed. |
| Existing application suite | 12 passed | The supplied Python application tests were executed. |
| Additional desired-behavior regressions | 12 test methods: 1 passed, 11 failed | The unittest output contains 13 failure records because two methods have independently failing subcases. These tests expect correct behavior; they do not expect the bugs. |
| Independent tiny-instance cross-check | Uncapped A* matched oracle feasibility and optimum on 40 deterministic varied cases | 1–3 courses, seed 1827. This is limited empirical evidence, not a proof for arbitrary instances. |
| Supplied PDF/XLSX artifacts | Both PDF files parsed; both XLSX files reopened | The demo PDF was also rendered and visually inspected. It is a readable English timetable. |
| Frontend | Source and supplied screenshots inspected | Live browser operation was not independently completed in this review environment. |

The available runtime was Python 3.12.14, FastAPI 0.141.1, Pydantic 2.13.4, Uvicorn 0.52.1, HTTPX 0.28.1, ReportLab 4.4.9, and openpyxl 3.1.5. This was not a clean installation of every pinned dependency from the uploaded project. The repair must also be checked in the project's own supported environment.

A local server started, but the review browser could not reach it across the execution environment's network boundary. Consequently, source-confirmed frontend defects below are not represented as independently reproduced browser interactions.

## Positive findings worth preserving

- BFS, DFS, Greedy, and A* have distinct FIFO, LIFO, minimum-h, and minimum-(g+h) frontier policies. They are not four labels on one solver.
- Streamed visualization data comes from actual engine events.
- The supplied independent oracle and its tests match the original handoff assets.
- Uncapped A* performed correctly in the bounded cross-check above.
- The timetable derives its rows from the completed run's problem snapshot and assignments.
- Table, Calendar, and Room presentations share the same filtered exam collection.
- Real sorting and file export implementations exist.
- The supplied English PDF has a clear table, metadata, and pagination. The XLSX has the expected Timetable and Run Summary sheets.

## Repair order

| Stage | Required outcome |
| --- | --- |
| 1 — Search truth | Caps never manufacture infeasibility or optimality; budgets are respected; actual elapsed time determines validity. |
| 2 — Run reliability | Timing excludes teaching waits; active runs are durable; completion is validated and persisted before publication; terminal status cannot be overwritten. |
| 3 — User-data integrity | A displayed problem and its submitted revision agree; Reset, navigation, reload, and imports preserve a coherent workflow. |
| 4 — Product completion | Implement the actual tree, useful charts and calendar, finish setup controls, and harden exports and responsive behavior. |

Stages 1–3 are correctness requirements. A visual polish pass cannot compensate for them.

## 1. Search limits can produce false scientific conclusions

**Severity: P1. Evidence: executed engine and session probes.**

Locations:

- apps/api/app/search/engine.py — SearchEngine.run, child-budget handling and terminal selection.
- apps/api/app/runs/manager.py — RunSession finalization and optimality_proven.

When the frontier limit prevents retaining a valid child, the engine increments budget_blocked_actions and continues. It silently loses an unexplored branch, then treats the remaining search as complete.

| Reproduction | Actual application result | Independent result |
| --- | --- | --- |
| tiny_feasible.json, A*, max_frontier_nodes=1 | SUCCEEDED, penalty 130; actual RunSession sets optimality_proven=true; three actions were dropped | Minimum feasible penalty is 0 |
| fixtures/false_infeasible_frontier.json, A*, max_frontier_nodes=1 | INFEASIBLE after dropping one alternative | Two feasible schedules exist; minimum penalty is 130 |

The second fixture forces one student to take A, B, and C. A can use T1 or T3; B and C can use T1 or T2. Retaining A=T1 and discarding A=T3 destroys the only useful root alternative. Exhausting that retained branch does not establish that the original problem is infeasible.

**Repair:** For the specified exact-search behavior, return LIMIT_REACHED when a necessary unexplored branch cannot be retained. An optional incumbent may be retained separately, with unknown optimality. Only claim INFEASIBLE after a complete search or a valid infeasibility proof. Only claim A* optimality when the actual execution preserves the relevant search and heuristic guarantees.

Evidence: evidence/engine_findings.json and evidence/finalization_results.json. Regression methods contain frontier_cap in their names.

## 2. Generated and expanded limits have incorrect accounting

**Severity: P1. Evidence: executed regressions.**

Location: apps/api/app/search/engine.py.

- Setting max_generated_nodes=2 on the tiny fixture produces a final generated_nodes=4.
- Child allocation checks ignore already buffered children because the counter increments later.
- The expanded-node limit compares explored_nodes instead of expanded_nodes.
- Limits are checked before popping an already-generated goal. A one-course case requiring exactly two generated nodes and one expansion incorrectly returns LIMIT_REACHED at either exact boundary.
- All children are inserted into the actual frontier before individual enqueue events increment the displayed counters. Intermediate snapshots therefore do not match the queue at that event boundary.

**Repair:** Define what each operation consumes. Reserve or increment generation budget before allocation, charge expansion only when expanding a non-goal, and allow a generated goal to be recognized without charging another expansion. Make insert/counter/event transitions atomic. Check time and cancellation within large expansion loops, not only between potentially expensive nodes.

Evidence: generated_cap_overshoot in evidence/engine_findings.json and the exact-boundary regression subcases.

## 3. Shared timezone logic can validate an invalid timetable

**Severity: P1 for the contract; exposure depends on dates/timezone. Evidence: executed regression against an independent raw-input oracle.**

Location: apps/api/app/domain/normalized.py, Interval and ExamPlacement; reused by validation/validator.py.

The application attaches ZoneInfo with replace(tzinfo=...) and performs arithmetic between local datetimes sharing that zone. It also accepts local times that do not exist during a DST transition.

The supplied regression fixture uses Africa/Cairo:

- Exam A: 2026-04-23, 23:00–23:30.
- Exam B: 2026-04-24, 01:00–01:30.
- Both exams have the same student and a required minimum break of 60 minutes.

With the runtime timezone data, the actual elapsed break is 30 minutes. The local-clock subtraction gives 90. The engine returns SUCCEEDED and the application's final validator reports valid=true. The independent oracle rejects the schedule for minimum_gap.

This demonstrates why revalidation alone is insufficient when it shares the same faulty time representation as search.

**Repair:** Resolve local endpoints explicitly, reject nonexistent and ambiguous times under the current schema contract, and perform duration, overlap, gap, and exam-end arithmetic using UTC instants. Preserve local dates for display and local-day rules. Retain a raw-input independent test.

Evidence: fixtures/dst_gap_invalid_solution.json and evidence/engine_findings.json.

## 4. Animation speed changes the measured computation and even the outcome

**Severity: P1. Evidence: executed session probes and a desired-behavior regression.**

Locations: search/engine.py timing and runs/manager.py pacing/pause handling.

The engine measures wall time from the start of a generator, including time spent suspended between yields. The session sleeps between those yields to pace teaching mode.

The same tiny A* problem with a 100 ms compute budget:

| Teaching delay | Actual result |
| --- | --- |
| 0 ms | SUCCEEDED; reported compute approximately 0.53 ms |
| 20 ms per event | LIMIT_REACHED; reported compute approximately 101.71 ms |

The portable regression uses a larger margin: 200 ms compute budget and 50 ms teaching delay. It reproduces the same incorrect change of outcome.

Final timing is also stale: engine.metrics receives wall and validation durations after the final event's metrics were copied, while to_record reads that older copy. Persisted successful runs in the probe show run_wall_ms=0 and final_validation_ms=0.

**Repair:** Accumulate active engine work separately from pause, teaching, transport, and rendering waits. Use a monotonic wall deadline for total session lifetime, including pauses. Publish and persist one final metrics snapshot after final validation.

Evidence: evidence/session_results.json and the lifecycle regression log.

## 5. Run lifecycle has durability and completion races

**Severity: P1, except wall-limit handling also described as P2 in the component review. Evidence: actual threads and a disposable child-process restart test.**

Locations: apps/api/app/runs/manager.py; apps/api/app/storage/db.py.

### Active runs are not durable

The application saves a run only at the end. After starting and pausing a real run, the database has no record for that run. Terminating its process loses it entirely; restart cleanup cannot mark a nonexistent row INTERRUPTED. The existing recovery test manually inserts a RUNNING row and therefore misses the actual admission path.

### Completion is announced too early

At the moment a SUCCEEDED terminal event is published, the authoritative record still has:

- status=RUNNING;
- no final assignments;
- no validation report;
- no persisted result.

Finalization happens afterward, including a teaching delay after publishing the terminal event. A frontend that immediately fetches the completed run can receive an unfinished record.

### Late pause can resurrect a finished session

pause() waits up to 0.5 seconds and then unconditionally writes PAUSED. A reproduced race ends with:

- in-memory status PAUSED;
- worker already exited;
- persisted status SUCCEEDED;
- admission of the next run blocked;
- cancel unable to repair the dead worker.

### Wall deadline is ignored

A session paused with max_wall_seconds=0.3 is still active after the regression's 1.2-second observation window. The field exists but is not enforced.

**Repair:** Use a synchronized state machine with immutable terminal states. Persist admission and lifecycle changes, acknowledge pause only at the actual barrier, make waits interruptible, and check wall deadlines during waits. Finalize assignments, validation, terminal reason, status, and metrics; persist that coherent result; then emit the single terminal event. Failed validation must prevent a validated-success result.

Evidence: evidence/session_results.json, evidence/finalization_results.json, evidence/pause_finish_race_results.json, and tests/test_lifecycle_regressions.py.

## 6. Frontend can show one problem while running another

**Severity: P1. Evidence: source inspection, not an independently operated browser session.**

Locations: apps/web/src/features/setup/Setup.tsx; apps/web/src/features/search/SearchLab.tsx; apps/web/src/App.tsx.

- Edits and imports update problem but do not invalidate revisionId. Start submits the old ID while the UI shows the new problem.
- Reset attaches only EventSource.onmessage. Initial Start correctly registers named listeners, and the backend emits named SSE events. Reset therefore omits the normal event handlers.
- Navigating away unmounts SearchLab and discards activeRunId/status/control ownership. A paused backend session may remain while the returning page presents a new Start.
- Reload initializes a sample and does not restore accessible run/revision history.
- JSON import only checks that three fields are truthy. Missing students/enrollments or courses with the wrong type can replace valid state and crash subsequent rendering.

**Repair:** Bind the visible draft, canonical hash, persisted revision, and run snapshot explicitly. Commit the current validated draft before Start, or require a clearly enforced save; never silently use an older revision. Centralize run state and SSE connection/recovery, reuse the same connection function for Start/Reset/reconnect, and validate imports fully before replacing state.

Additional setup defects include length-based IDs that collide after deletions and shallow mutations that change the original sample fixture.

Concrete reproduction and browser assertions are in FRONTEND_EXPORT_ACCEPTANCE.md.

## 7. The signature product requirements are partially implemented

**Evidence: source plus supplied screenshots.**

- The search visualization is a flex-wrapped grid of cards. It has real event content, but no parent-child edges, hierarchical tree layout, pan/zoom, or highlighted ancestor solution path. Previously popped nodes also retain their exploring appearance.
- The comparison page presents recognition cards and a table, but no charts.
- The Calendar tab presents date-grouped exam cards without a time axis or duration-based placement. It is an agenda-style presentation; a scheduling calendar remains to be implemented.
- Guided setup does not edit several supported fields, including allowed slots, room unavailability, student display names, problem name, and timezone.
- The supplied mobile screenshot shows the header navigation extending beyond the visible width. It does not establish usable mobile navigation or Search Lab controls.

Keep the existing light timetable direction and improve the actual search explanation. A connected tree, readable state inspector, honest truncation notice, real benchmark charts, and a usable time-grid calendar are more valuable than additional decorative sections.

## 8. Export support exists, with concrete data and portability defects

**Evidence: file inspection and executed ReportLab text probes.**

- XLSX date/start/end cells are strings with General formatting. They should be genuine date/time values with appropriate number formats.
- Formula protection prepends a literal apostrophe to input beginning with =, +, -, or @. Preserve the original text value while explicitly ensuring it is not a formula cell.
- PDF user fields enter ReportLab Paragraph markup without escaping. Algorithms <Graphs> loses the bracketed text; Intro <b> raises a parsing error.
- PDF Arabic font lookup depends on C:/Windows/Fonts/arial*.ttf and otherwise falls back to Helvetica. In this environment Arabic shaping dependencies were unavailable and the fallback was selected. Supplied English PDFs do not establish Arabic support.
- Filtered PDF/XLSX exports do not disclose filters and exported/total row counts, while showing full-run validation/penalty metadata.

**Repair:** Escape user content before paragraph rendering, bundle a redistributable Unicode font with its license and necessary shaping support, type spreadsheet cells correctly, and label filter scope. Download actual exports in acceptance tests, reopen them, verify exact values, and visually inspect representative rendered PDF pages.

## 9. Comparison and API boundaries need tightening

**Evidence: API probes plus source inspection.**

- /api/comparisons executes list(engine.run()) synchronously inside an async endpoint. The scheduled event-loop callback in the probe ran only after the comparison completed. The observed tiny run was short; the blocking design is the issue for larger instances.
- The endpoint builds default configs and ignores supplied comparison limits. It retains full event lists unnecessarily.
- Invalid run configuration produced HTTP 500 in the probe instead of a structured client-validation response.
- Repeating a step command with the same request ID advanced sequence twice. Retry safety needs a real command acknowledgement/idempotency contract.
- SSE subscriber queues are unbounded. Expired replay history has no explicit snapshot/gap handshake, and client reduction does not reject duplicates or events from an obsolete run.

**Repair:** Put benchmark work behind the same bounded worker/admission model, honor and persist the effective config, stream or consume events without retaining the whole trace, and return typed validation errors. Bound queues, specify replay-gap recovery, and deduplicate commands/events by their proper identifiers.

Evidence: evidence/api_results.json. These API findings are additional to the twelve portable regression methods.

## Why the previous green tests did not establish completion

Passing tests establish only their assertions.

- The existing limit test checks a terminal status, not whether counters exceeded the limits.
- The heuristic test uses one tiny fixture whose tested bounds are zero. It does not independently enumerate exact future costs across meaningful positive-bound states.
- The restart test inserts the RUNNING row itself instead of crashing a real admitted run.
- The browser script logs pause sequences, sort output, console errors, and page errors rather than enforcing those conditions with assertions.
- Several browser steps are inside isVisible guards, allowing required controls to be skipped.
- It searches for CS100 while the UI sample uses AI101 and DS201. Zero matching exams produce one empty-state table row; counting tbody tr then reports one row. That is not proof that filtering returned an exam.
- Export verification reads href values rather than downloading and opening files.
- PDF checks primarily assert a signature, minimum size, producer marker, and EOF. They do not establish Arabic rendering or layout correctness.

The repair must add behavioral assertions and retain the independent oracle. It must not turn failures green by weakening expected results or relabeling untested behavior as complete.

## Completion evidence required from Antigravity

Return the revised source, reproducible commands, full test logs, and a requirement-to-evidence table. Include actual browser assertions for the main journey and repaired failure paths, downloaded PDF/XLSX examples, and visual inspection evidence. Clearly label every item as executed, source-reviewed, not executed, or blocked.

Run the original 15 oracle tests, the original 12 application tests, and all additional regressions. Add focused API/browser/export tests for the relevant repairs. Update tests for legitimate interface refactors only while preserving the asserted guarantees.

An improved screenshot alone is not completion evidence. A passing Python suite alone is not browser evidence. A feasible schedule alone is not an optimality proof.
