# ExamCraft AI — Product and QA Acceptance Contract

This document specifies proposed product behavior and evidence required before declaring the application complete. It is a build specification, not a claim that features or tests have already passed. Search mathematics and algorithm invariants belong to the separate engine contract.

## 1. Delivery scope

Deliver a polished, locally runnable academic product that demonstrates authentic BFS, DFS, Greedy Best-First, and A* search on exam scheduling. The essential user journey is **sample or user data → validated setup → selected algorithm → real search trace → verified timetable → exports and comparison**.

All requested features are part of the acceptance scope: landing page, editable setup, sample data, four algorithms, interactive visualization controls, truthful terminal outcomes, table/calendar/room views, search/filter/sort, timetable statistics, PDF and XLSX export, independent re-validation, and comparative charts using actual runs.

For the first deliverable, explicitly document these modeling assumptions in the setup screen and README:

- A course has one exam, assigned wholly to one room and one allowed exam period. Multi-room splitting is outside this release.
- Exam enrollment is derived from student-course enrollment records, not a separately editable count that can disagree with those records.
- Use explicit examination dates and a documented university timezone. Slots may overlap; exams start at a chosen slot start and must fit the slot. Validate actual half-open exam intervals, including aliases with different slot IDs.
- Each room has positive integer capacity. Each exam occupies its room exclusively for its full assigned interval.
- Hard constraints and optional weighted preferences have separate controls and explanations. A preference penalty is not a feasibility violation.
- Data are for one local workspace. Authentication, roles, multi-tenant operation, real university integrations, payments, an LLM chatbot, invigilator planning, and simultaneous collaborative edits are outside the first deliverable.

These boundaries keep the requested product coherent. Do not advertise the release as ready for real university operations without an additional deployment, security, and operational review.

## 2. Shared product rules

1. **One source of truth.** Setup, search trace, final views, exports, statistics, and comparison reference the same immutable problem revision and run identifier.
2. **Honest freshness.** An edit creates a new revision. Existing results remain available as historical results with their old revision; never silently present them as solutions to edited data.
3. **Explicit saved state.** Show whether setup data and results are saved. Refresh must restore committed data, or clearly state that the workspace is temporary before users enter it. A failed save must not display a success toast.
4. **No fabricated content.** Production result components contain no hard-coded metrics, random search events, prefilled success charts, placeholder downloads, or unconditional success notifications.
5. **Recoverable interaction.** Validation errors preserve entered values. Destructive reset of user input has a clear scope and a cancel action. Load sample data into a new saved problem so existing work is preserved; do not add unnecessary confirmation steps.
6. **Usable errors.** User-facing errors say what failed and what can be done next. Raw stack traces remain in development diagnostics.
7. **Visible boundaries.** Explain resource limits before running large cases. A bounded visualization can show only part of a real trace, but must display that it is a subset.
8. **Consistent vocabulary.** “Valid schedule” means independent validation passed. “Optimal” requires the engine's proof conditions. “No solution found within limits” is distinct from proven infeasibility.

## 3. Screen-by-screen acceptance

### Home

- Clear name and concise explanation of the scheduling task, supported algorithms, and educational visualization.
- Working **Start scheduling** and **Try sample** actions. Navigation must lead into the working flow, not a static mockup.
- Use a small product illustration or genuine seeded example rather than fake success counters or unsupported claims.
- Desktop and narrow-screen layouts remain readable; buttons are usable without hover.

### Problem setup

- Organize into understandable sections: courses, students/enrollments, rooms, dates/periods, and constraints. Keep a persistent summary of counts and readiness.
- Support add/edit/remove rows, practical bulk entry or a documented JSON import/export path, and explicit sample loading. Validate imports before changing the current workspace.
- Use stable internal IDs, distinguish IDs from editable course codes/names, and prevent dangling references when rows are removed. Tell the user which dependent enrollments would be affected.
- Validate duplicate IDs/codes, empty required names, unknown course/student references, duplicate enrollment pairs, invalid dates, end time before or equal to start time, non-integer or non-positive capacities, and invalid blackout intervals. Warn about overlapping slots and check actual exam intervals; overlapping slot definitions alone are not a schema error.
- Support zero-enrollment courses consistently: each still requires one exam assignment. Mark them clearly in setup.
- Show field-level messages and an error summary linked to the relevant fields. Do not replace an invalid value with a convenient default silently.
- Run cheap necessary checks before search, such as an exam larger than every eligible room or an exam with no allowed period. These checks must not imply that passing guarantees feasibility.
- Expose a conflict summary or graph derived from shared enrollments. Make it useful for explaining constraints, not a decorative graph unrelated to input.
- The **Continue** action is enabled only for structurally valid data. Valid data may still be infeasible; the user can run it to examine that outcome.

### Algorithm selection

- Each algorithm card explains its frontier policy, practical tradeoff, and whether a returned result has a quality guarantee under current conditions.
- Show problem revision, number of exams, allowed periods and rooms, configured hard constraints, preference weights, and execution limits.
- Users can choose one run or all four. Comparison uses one frozen problem/configuration snapshot.
- Do not promise that every algorithm will finish on every data set. Keep a small sample that all four can finish for teaching.
- Starting a run locks its input snapshot. Editing setup creates another revision instead of mutating a running search.

### Search laboratory

- Professional dark theme, distinct from the light timetable workspace. Main area: search tree/graph; side panel: selected state and proposed exam placement; footer or side panel: event log and live metrics.
- Required controls: **Start, Pause, Resume, Step forward, Reset, Speed**. Also provide **Cancel** for terminating a run without implying infeasibility.
- Before start, show an initial state and instructions. During running/paused/finished/error states, controls have appropriate enabled states and clear labels.
- Pause freezes engine advancement after the current atomic operation, not merely animation. Step advances exactly the documented unit (one event or one expansion); tell the user which. Resume continues that run.
- Distinguish **live execution controls** from **recorded trace replay controls** if both exist. A completed run must not pretend it is still computing.
- Speed changes pedagogical pacing, not the algorithm's decision order or its measured search cost. Benchmark execution bypasses visualization pacing.
- Reset returns a run to its documented initial state and isolates it from old events. Late events from an obsolete run cannot overwrite the new view.
- Show real parent/child relationships, current node, frontier membership where practical, accepted placements, rejected actions with reasons, and the final path. Rejected actions must not be misrepresented as expanded search states.
- Use color plus shape/text to identify states. Selecting a node reveals assignments and why its candidate was accepted or rejected.
- Provide zoom, pan, fit-to-view, and a legend. Cap rendered nodes, cluster/collapse old sections, and display total observed versus currently rendered counts.
- Handle run cancellation, engine exceptions, connection loss if a backend is used, and reconnect/replay recovery without duplicate or reordered events. Running indicators must clear when a run has ended.

### Outcome

- A successful search transitions to a summary only after a separate validator checks the candidate schedule.
- Show algorithm, run status, problem revision, configured limits, observed metrics, and preference quality in understandable units.
- Distinguish validated solution, proven infeasible, time limit, node/memory limit, cancelled, and internal error. A resource limit does not prove that no timetable exists.
- If an incumbent solution exists when a limit is reached, show it as a validated candidate with unproven optimality, together with the actual terminal status.
- Failure states preserve the setup and offer relevant actions: inspect conflict, adjust inputs, change limits, run another algorithm, or return to setup.

### Final timetable

- Light background, clear typography, restrained accent color, strong table hierarchy, meaningful spacing. Show a validation badge, last validation time, problem revision, and algorithm provenance.
- Table includes course code, course name, date, start/end time, room, and enrolled students. Sorting is stable and dates/times sort chronologically.
- Search and filters cover at least course, date, and room. Show matching count and a clear-filters action. Include a useful no-results state.
- Calendar and room views render exactly the same assignments as the table. Calendar uses actual dates and times, and room view allows simultaneous exams in different rooms.
- Show scheduled/total exams, used periods/rooms, student load measures, and preference penalty with definitions. Do not label a preference penalty as a percentage quality score without a documented normalization.
- Re-validation runs against a specific problem revision and detects missing/duplicate exam assignments, unknown references, student overlaps, room overlaps, availability violations, and capacity violations.
- If validation fails, show each offending exam/room/student reference and rule. Do not keep a green validation badge or silently export the result as valid.
- Exports state whether they include the full timetable or current filtered view. The default should be clearly labeled and consistent across PDF/XLSX.

### Analytics and comparison

- Compare genuine completed or bounded attempts on the same input revision, constraints, weights, ordering, and resource limits. Record these in the results.
- Run comparable benchmarks without animation delay and without parallel competing algorithm jobs unless explicitly labeling that methodology.
- Show terminal status beside every row. Timeouts and failures are not successful zero-cost/zero-time entries.
- Include execution time, explored/generated counts, valid/rejected actions, depth, frontier peak if available, and objective penalty. Explain metric definitions with tooltips.
- Prefer separate badges for fastest validated solution, fewest explored nodes among successful runs, and lowest observed penalty. Do not invent one overall winner by adding unrelated quantities without a published scoring rule.
- “Lowest observed penalty” is not “globally optimal.” A failed or incomplete run cannot win on solution quality.
- When durations are tiny/noisy, display units and acknowledge ties; repeated benchmark medians are preferable if there is time. Never fabricate smooth measurements for prettier charts.
- Add clear empty, in-progress, partial-results, all-failed, and stale-comparison states. Charts handle zeros, large ranges, and missing values correctly.

## 4. Export acceptance

### PDF

- Generate a real PDF from current validated assignments; include title, revision, algorithm, constraints/quality summary, and generation time.
- Use a readable landscape or appropriately paginated layout. Repeat column headers on new pages. Wrap long names and keep rows inside printable margins.
- Include page numbers and an explicit status if exporting a non-optimal candidate. Ensure real dates, times, student counts, and room names match the UI.
- Open/render the exported document during verification. Confirm text is readable and no columns, legends, or final rows are clipped.

### Excel

- Produce a genuine `.xlsx` workbook, not CSV renamed as Excel.
- Include a Timetable sheet and a Run Summary sheet with provenance, status, limits and metrics; optionally include rule/quality detail.
- Use numeric student counts, suitable date/time cell formatting, a header style, sensible widths, filters, and a frozen header row.
- Treat user-provided names/codes as text rather than formulas. Confirm exported values round-trip and totals agree with the underlying schedule.
- Read the workbook back with a library to verify sheet names, row count, course IDs and expected cell values.

## 5. Required fixtures

| Fixture | Purpose and expected outcome |
| --- | --- |
| Tiny feasible | All four algorithms finish quickly and produce independently valid schedules. Suitable for a live class demonstration. |
| Shared-student conflict | Exams sharing a student are never assigned overlapping periods; the rejection reason identifies the conflict. |
| Room collision | Different exams cannot occupy the same room during overlapping intervals, even when they have disjoint enrollments. |
| Capacity boundary | Enrollment equal to capacity is permitted; enrollment one above capacity is rejected for that room. |
| Proven impossible | A tiny exhaustible case reports infeasible only after a valid proof/check or exhaustive search. |
| Limit reached | An intentionally tight cap reports the appropriate limit and keeps distinct any validated incumbent. |
| Preference tradeoff | At least two feasible schedules have different student-load penalties; charts and exports report the actual difference. |
| Bad input/import | Duplicate IDs, orphaned enrollments, invalid times and invalid capacities yield actionable errors without corrupting the workspace. |
| Long names and non-ASCII | Display, search and export preserve text and remain readable. |
| Edited revision | Changing enrollment or capacity marks old results stale and prevents silently reusing their validity badge. |

Fixtures must be deterministic, small enough for diagnosis, and committed with expected properties. Do not make every demo trivial or guarantee success by displaying a prebuilt answer instead of invoking the selected algorithm.

## 6. Critical automated and manual acceptance journeys

1. Load tiny sample → select each algorithm → run → independently validate → compare actual metrics → open all three timetable views.
2. Run at slow speed → pause → observe no further engine progression → step the specified unit → resume → finish. Validate that pacing did not alter assignments or ordered algorithm decisions.
3. Run → reset → immediately start another run → verify no previous run events or metrics leak into the new session.
4. Start a longer run → cancel → verify no false “infeasible” message and no orphaned worker continuing to consume resources.
5. Edit a capacity or enrollment after success → verify revision changes and historic results are clearly marked; re-run and re-validate.
6. Load impossible fixture → exhaust search → receive infeasible. For the limited case, use an instance that passes preflight and a cap that interrupts before a proof is obtained → receive limit reached. A sound proof already established is not invalidated by a small configured cap.
7. Search/filter/sort a timetable → switch table/calendar/room views → confirm assignment identity and filter behavior remain coherent.
8. Export PDF and XLSX → parse/read both and visually inspect PDF → verify rows, dates, rooms, student counts, status and revision match the chosen full/filtered scope.
9. Run comparison with one success and one capped attempt → ensure successful ranking ignores failed candidates appropriately and preserves failure metrics/status.
10. Reload the app → verify declared persistence behavior, including setup and completed run history. Handle an interrupted prior run honestly.
11. Inject a backend error/disconnect when applicable → see a recoverable failure state; no infinite spinner or blank app. Resume/recovery semantics must be explicit.
12. Use keyboard navigation and narrow viewport → reach core controls, read validation errors, use all primary actions, and avoid horizontal page overflow.

## 7. Rapid build sequence and gates

### Gate A — Engine-to-screen vertical slice

One fixture, one algorithm, real ordered events, terminal status, independent validation, and a minimal timetable work end to end. This exposes integration risk before visual polish.

### Gate B — Algorithm and data completeness

All four algorithms share validated inputs and produce genuine metrics. Required feasible/impossible/limit fixtures pass. Setup editing and revision semantics work. No UI-only mock controls remain.

### Gate C — Complete requested workflow

Search controls, comparison, all three final views, filters, sorting, re-validation, PDF and XLSX are connected to real data. Critical automated journeys pass.

### Gate D — Presentation quality and handoff

Polish both themes, empty/error/loading states, responsive layouts, keyboard access, chart labels and visual hierarchy. Run the sample demonstration from a clean startup. Deliver setup instructions, run/test commands, assumptions, architecture overview, reproducible fixtures, and known limits.

**Required completion evidence:** commands executed with their outcomes, screenshots of the real search lab and final timetable, an exported PDF and XLSX from a current successful run, a run showing a truthful limit/infeasible outcome, and a short known-limitations list. Report any incomplete gate explicitly. A landing-page screenshot alone cannot establish product completion.
