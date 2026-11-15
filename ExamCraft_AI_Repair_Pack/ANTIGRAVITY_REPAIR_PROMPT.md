# ExamCraft AI — repair and complete the existing application

You are continuing an existing ExamCraft AI implementation. Work in the current repository. Preserve its working architecture and build on it. Read this entire prompt, AUDIT_REPORT.md, FRONTEND_EXPORT_ACCEPTANCE.md, and the regression tests before changing implementation.

## Objective

Deliver a correct, impressive university exam scheduling product with real BFS, DFS, Greedy Best-First, and A*, an actual event-driven search tree, reliable interactive controls, complete setup, a professional timetable, exports, and evidence-based comparisons.

The independent review found genuine strengths and reproducible defects. The four algorithms exist. The original 15 oracle tests and 12 application tests pass. However, the new pack's 12 test methods have 1 pass and 11 failing methods on the reviewed build. Fix the implementation against the desired behavior. The baseline output has 13 failure records because of subtests.

Do not replace the project with a new framework, add an LLM API to solve this search problem, or spend this pass on unrelated authentication/billing features. Choose routine implementation details yourself and carry the work through verification.

## Non-negotiable scientific behavior

1. Never claim infeasibility after silently discarding an unexplored branch for a resource limit.
2. Never claim proven optimality merely because an A* run returned a valid schedule.
3. Distinguish a validated feasible result, proven optimum, exhausted infeasibility, resource limit, cancellation, interruption, invalid input, and internal error.
4. Real search events must drive visualization. A real queue/stack/heap and the displayed metrics must agree at each published transition.
5. Teaching speed, pause time, network delay, and animation must not be charged to search compute time.
6. The problem shown to the user, the submitted revision/hash, the run snapshot, and the exported timetable must agree.
7. Keep the independent oracle independent from production search/normalization code.

## Stage 1 — repair the search engine and validation

Start with tests/test_engine_regressions.py and the two added fixtures.

- Replace silent budget pruning with truthful LIMIT_REACHED behavior when exact search can no longer retain required work. Preserve an optional incumbent separately without manufacturing an optimality guarantee.
- Fix generated-node reservation, buffered-child accounting, and the actual expanded-node counter. A generated goal must not require an extra expansion. Numeric caps must never be exceeded.
- Make frontier mutation, counters, node state, and emitted events atomic and consistent.
- Check resource deadlines and cancellation within potentially large expansion work as well as between nodes.
- Use valid, unambiguous local endpoints and UTC instant arithmetic for durations, exam ends, overlaps, and elapsed gaps. Retain local-day semantics where appropriate. Reject DST gaps/folds according to the current schema contract.
- Use strict numeric input validation that rejects booleans/numeric strings where required, validates limits and schema_version, and preserves optional student display names.
- Keep deterministic course/candidate ordering and genuinely distinct frontier policies.
- Test positive heuristic bounds against independent exact remaining costs on bounded cases. Document the admissibility argument and any assumptions behind optimality.

Required reproductions: frontier=1 must not return penalty130 as a proven optimum when optimum0 exists; a discarded branch must not manufacture INFEASIBLE; generated cap2 must stay at or below2; exact one-expansion goal boundaries must work; the DST fixture must fail validity.

## Stage 2 — make execution and persistence coherent

Start with tests/test_lifecycle_regressions.py.

- Persist run admission and lifecycle state so an actual backend crash leaves a recoverable run that becomes INTERRUPTED on restart.
- Use a synchronized state machine; terminal states are immutable. A late pause must not resurrect a completed run. Pause acknowledgement must correspond to the actual worker barrier.
- Keep cancellation, pause, step, speed changes, and waits responsive. Enforce a monotonic wall deadline even while paused.
- Measure active engine compute separately from pacing/waiting and preserve accurate preprocessing, validation, compute, and wall metrics.
- Finalize assignments, independent validation, status, reason, and metrics; persist a coherent final record; then publish exactly one terminal event. An immediate GET after completion must see the finalized result.
- Final validation failure must prevent a validated-success outcome.
- Make reset ownership explicit and stop/cancel the old worker safely before admitting replacement work.
- Bound event journals and subscriber queues; support reconnect with sequence deduplication and an explicit gap/snapshot protocol.
- Handle command retries safely, including duplicate step request IDs.
- Validate API requests with structured client errors.
- Run comparisons through bounded workers rather than blocking the API event loop. Honor and persist the same effective input/config/limits for all algorithms, exclude teaching delay, and avoid retaining all events unnecessarily.

## Stage 3 — repair the complete user journey

Follow FRONTEND_EXPORT_ACCEPTANCE.md.

- Track dirty state and saved revisions explicitly. Start should validate and save the current draft, or enforce a clear save step. It must never submit an older revision silently.
- Centralize run ownership/state so navigation and reload can reconnect to a live or completed run. Make persisted history accessible.
- Use one named-event SSE connection routine for Start, Reset, and reconnect. Reject old-run events and deduplicate sequences.
- Validate full JSON documents before replacing the draft. Invalid input must leave the last usable state intact and show actionable errors.
- Generate collision-free IDs after deletion. Clone sample fixtures and use immutable state updates.
- Finish problem name/timezone, student display name, course allowed-slot, and room-unavailability controls with proper validation.
- Show honest infeasible/limited/cancelled/error states and useful next actions. Do not leave the interface stuck at RUNNING or block future work after a terminal run.

## Stage 4 — finish the distinctive product

Preserve the dark Search Lab and light timetable direction, then make the product visually coherent and useful.

- Replace the flex-card pseudo-tree with a hierarchical graph using actual node_id and parent_id. Draw edges, distinguish frontier/current/explored/rejected/pruned/goal states, highlight the solution ancestry, and support pan/zoom, fit view, inspector, and keyboard-accessible controls.
- A rejected action may appear as an action decoration; do not inflate generated-state counts by counting it as a search node.
- Bound rendered history without hiding that it is truncated. Provide a clear notice and preserve meaningful current/solution context.
- Keep Start, Pause, Resume, Step, Reset, Cancel, and speed controls tied to the real state machine.
- Add actual comparison charts for compute, explored/generated nodes, frontier pressure, and penalty. Display status, sample/trial count, effective limits, ties, and limitations. Failed/limited runs cannot win by appearing fast. Avoid declaring a universal winner from one tiny timing sample.
- Implement a time-grid Calendar with visible dates/times and exam durations, plus useful Room and Table views over the same assignments.
- Preserve search, filters, sorting, statistics, and revalidation across views. Show filter scope in exports.
- Fix mobile navigation and verify Setup, Search Lab, Table, Calendar, and Room at narrow widths. Essential controls must remain reachable. Respect reduced motion and visible keyboard focus.

## Stage 5 — harden exports and prove the fixes

- Escape all user-controlled text before ReportLab Paragraph markup. Preserve names containing angle brackets, ampersands, mixed Arabic/English, and long text.
- Bundle an appropriate redistributable Unicode font with its license and shaping support. Test on the documented supported platform; do not rely only on a developer's Windows font directory.
- Write genuine Excel dates/times and numeric counts. Preserve literal text beginning with =, +, -, or @ without converting it into a formula or inserting an extra visible character.
- Label full versus filtered export scope, applied filters, exported/total exam counts, revision, and algorithm. Do not imply a subset is the full timetable.
- Download actual exported files in tests, reopen them, compare row identities and values, and inspect rendered representative PDF pages.

Use the existing project environment. Run:

    python -m unittest discover -s verification -v
    python -m unittest discover -s tests -v
    python ExamCraft_AI_Repair_Pack/run_regressions.py --project-root .

If the pack is in another location, invoke that path and pass the repository root. The provided runner sets EXAMCRAFT_PROJECT_ROOT and uses a disposable working directory. The lifecycle tests use isolated SQLite databases and terminate their disposable workers/processes.

Add focused behavioral browser/API/export tests. The existing browser script's console logs and optional isVisible branches are insufficient. Assert the real expected results. In particular:

- stable sequence after acknowledged pause and exactly one accepted step;
- Reset receives the same named event types as Start;
- navigation/reload restores control of the same run;
- edit/import then Start uses the current snapshot;
- malformed import leaves the usable draft intact;
- filtering uses actual fixture codes and counts exam rows, excluding the empty-state row;
- sorting has an asserted order and views preserve the assignment set;
- immediate post-completion fetch has validation, assignments, metrics, and persisted status;
- console/page errors fail the browser test;
- exports are downloaded and parsed, not just linked.

Do not weaken assertions or alter independent oracle results to manufacture green tests. If a legitimate refactor changes an internal interface, adapt test wiring while preserving its behavior guarantees and explain the change. Record every command that actually ran. Mark anything blocked or not executed honestly.

## Final handoff

Return a revised review ZIP containing source, dependency declarations/lockfiles, tests/fixtures, a concise setup README, actual test logs, representative exports, and a requirement-to-evidence report. Include a clear list of remaining limitations.

Do not include dependency directories, virtual environments, generated caches, secrets, real student data, or an unnecessary copied database. Keep a clean sample-data path and a reproducible one-command development start if feasible.

Lead your response with repaired behavior and actual verification results. Continue through the stages; do not stop after writing a plan or after one passing test file.
