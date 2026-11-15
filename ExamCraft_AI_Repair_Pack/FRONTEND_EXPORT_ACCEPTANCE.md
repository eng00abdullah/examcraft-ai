# ExamCraft AI — Frontend and Export Repair Acceptance

## Purpose and evidence boundary

Repair the existing React/FastAPI application in place. Preserve the working solver integration, snapshot-based timetable, shared filtering, numeric result metrics, and current export routes. This document is not a request to rebuild the application or replace its architecture.

**Live browser tests were not run independently in this environment during this review.** Frontend findings below come from source inspection. Supplied XLSX/PDF inspection and ReportLab text-parser probes were executed separately; they are identified explicitly. The acceptance cases are work to perform after repair, not claims that those cases have already passed.

All source pointers are relative to the application repository root.

## 1. P1 — Bind editable data to the correct saved revision

**Source finding:** Setup edits and `handleImportJson` update `problem` without invalidating or distinguishing `revisionId`. `SearchLab.handleStartSearch` sends the saved ID while the interface receives the editable problem. Continue is gated by structural validation, not by whether that exact document was committed.

**Pointers:** `apps/web/src/features/setup/Setup.tsx` (`handleImportJson`, edit handlers, Continue button); `apps/web/src/features/search/SearchLab.tsx` (`handleStartSearch`); `apps/web/src/App.tsx`.

**Repair:** Track draft versus committed identity explicitly. Starting a search or comparison must either save and use the current validated draft or require committing it first with a clear dirty-state indication. A previous result may remain available as history, but must identify its original revision and must not look like the result of the edited draft.

**Acceptance — manual and Playwright:**

1. Commit Tiny Feasible and record revision A. Change a course name, a room capacity, and a constraint without committing.
2. Attempt both Search and Compare. Assert that neither silently submits revision A while presenting the changed document as the input.
3. Commit the changes as revision B. Assert the start request uses B and the returned run contains the edited values and B's hash.
4. Repeat with a valid imported JSON document. Check the same identity guarantees.
5. Open an earlier schedule after editing. Its original snapshot must remain intact and its relationship to the current draft must be clear.

## 2. P1 — Restore named SSE listeners on Reset

**Source finding:** Initial Start registers named listeners for `run_started`, `node_popped`, `action_rejected`, `child_enqueued`, `forward_pruned`, `goal_found`, and `run_finished`. `handleReset` creates a new EventSource with only `onmessage`. The API emits named events, so those messages do not reach the reset handler. The UI also extracts the new run ID by splitting a prose response.

**Pointers:** `apps/web/src/features/search/SearchLab.tsx` (`handleStartSearch`, `handleReset`); `apps/api/app/main.py` (SSE event serialization and reset response).

**Repair:** Reuse one connection/subscription function for Start, Reset, and reconnection. Use a structured new-run identifier. Clear state that belongs to the old run, reject late old-run events, and handle terminal events on the replacement run.

**Acceptance:** Start a paced run, pause it, then Reset. Assert a new run ID, receipt of named events for that ID, cleared old selection/log, advancing new metrics, and a terminal UI state matching `GET /api/runs/{new_id}`. Assert the final timetable belongs to the new run. Repeat Reset after completion. Do not accept only a changed button label or HTTP 200 as proof.

## 3. P1 — Retain run ownership across navigation and reload

**Source finding:** `App.tsx` conditionally unmounts SearchLab. Its run ID and status are local state, and cleanup only closes SSE. App reload initializes Tiny Feasible, auto-commits it, and does not restore a saved revision or run. Database persistence alone therefore does not provide a recoverable user workflow.

**Pointers:** `apps/web/src/App.tsx`; `apps/web/src/features/search/SearchLab.tsx` (local state and unmount cleanup); `apps/web/src/api/client.ts` (available revision/run APIs).

**Repair:** Retain active-run identity outside the conditional page component and restore it from durable references when appropriate. Reconnect or fetch the authoritative snapshot on return. Expose a way to reopen saved revisions and completed runs. Do not silently replace a returning user's workspace with a newly committed sample.

**Acceptance:**

- Start and pause a slow run; visit Setup and Compare; return. Assert the same run ID, PAUSED state, counters, and working Resume/Step/Cancel controls.
- Navigate away while running, allow completion, and return. Assert the completed result is recoverable.
- Reload during a paused run and after a completed run. Assert no duplicate start, no orphaned active run from the user's perspective, and access to the saved result.
- Load a saved custom problem after refresh. Assert its identity and data are preserved rather than replaced with Tiny Feasible.

## 4. P1 — Validate imports before replacing usable state

**Source finding:** JSON import checks only truthiness of `courses`, `slots`, and `rooms`. Missing arrays subsequently cause render errors; wrong collection types fail at `.reduce`. The import callback's try/catch does not catch a later React render failure.

**Pointers:** `apps/web/src/features/setup/Setup.tsx` (`handleImportJson`, `studentCountPerCourse`, enrollment/student count rendering).

**Acceptance:** Begin with a valid custom setup, then import each of these:

```json
{"courses":[],"slots":[],"rooms":[]}
```

```json
{"courses":{},"slots":[],"rooms":[]}
```

Also try invalid JSON, duplicate IDs, and unknown enrollment references. Every unsuccessful import must produce actionable validation feedback without a blank screen, uncaught page error, or replacement of the last usable document. If omitted optional collections are supported, normalize them consistently before rendering and validate the resulting document. A structurally valid but infeasible scheduling problem should be distinguished from malformed input.

## 5. P2 — Fix generated IDs and sample mutation

**Source findings:** New IDs use collection length plus one. Deleting a middle item can therefore duplicate an existing ID. The initial App state references `TINY_FEASIBLE` directly, while several edit handlers shallow-copy arrays and mutate their contained objects, which can modify the sample constant.

**Pointers:** `apps/web/src/features/setup/Setup.tsx` (Add Course/Student/Room/Slot and edit handlers); `apps/web/src/App.tsx` (initial problem); `apps/web/src/features/samples/sampleData.ts`.

**Acceptance:**

- From slots T1/T2/T3, delete T2 and add a slot. Assert three unique IDs; the new slot must not duplicate T3. Repeat deletion/addition for rooms, students, and courses.
- On a fresh session, edit a Tiny Feasible course name, room capacity, and slot time. Load another sample, then reload Tiny Feasible. Assert its original fixture values are restored.
- Editing a draft must not mutate a previously retained result snapshot.

## 6. P1 product requirement — Render a genuine search tree

**Source finding:** The current “Search Tree State Space Canvas” is a flex-wrapped list of event-derived cards. There are no parent/child edges, hierarchical layout, or highlighted ancestor path. Previously popped nodes remain “exploring”. Rejected-action cards count toward “search nodes”, and the bounded 301-item display does not explain its coverage.

**Pointers:** `apps/web/src/features/search/SearchLab.tsx` (`processSearchEvent`, node rendering, inspector).

**Repair:** Keep actual events as the source of truth. Render parent/child relationships using real node IDs. Distinguish queued, current, explored, goal-path, rejected-action, and forward-pruned states. Rejected actions must not masquerade as generated search states. Keep rendering bounded with an explicit visible-subset indicator and exact global counters. Preserve enough ancestry to explain the selected node and solution.

**Acceptance:**

1. Run a small fixture that branches and rejects at least one action. Match displayed edges, node IDs, assignments, depth, and g/h/f values to recorded events.
2. Step through multiple node pops. Assert only the current node is marked as currently exploring and previous nodes transition correctly.
3. Select a rejection. Assert its reason and attempted course/slot/room match the event.
4. Finish a successful search. Assert the highlighted root-to-goal path corresponds to the actual parent chain and final assignments.
5. Run beyond the display cap. Assert the displayed subset is disclosed, totals remain accurate, interactions remain usable, and duplicate replayed events do not create duplicate nodes.
6. Exercise zoom/pan/fit and keyboard-accessible inspection using deterministic controls.

## 7. P2 product requirements — Complete setup, calendar, and charts

**Source findings:** Allowed slots and room unavailability are display-only; student names are not editable; there are no problem-name/timezone controls. Calendar View is a day-grouped list of equal-size cards without time positioning. Comparison has actual result cards and a table, but no charts.

**Pointers:** `apps/web/src/features/setup/Setup.tsx`; `apps/web/src/features/timetable/TimetableDashboard.tsx` (calendar branch); `apps/web/src/features/comparison/Comparison.tsx`.

**Acceptance:**

- Create and edit a problem name/timezone, student names, allowed exam slots, and room blackout intervals through guided setup; commit, reopen, and verify each value. Exercise their effect on a real run.
- Calendar placement must reflect actual start/end times and course duration, with readable room/course details. Two exams at different times must occupy different temporal positions; simultaneous exams in different rooms must remain distinguishable.
- Run all four algorithms on one revision. Render charts for measured time, explored/generated states, and solution penalty, using the returned results. Labels/tooltips must agree with the table and expose units. Failed or limited runs must not appear as valid zero-penalty solutions. Rankings must remain based on actual eligible results.
- Apply the same course/room/date filters across Table, Calendar, and Room views. Compare assignment identities and displayed fields across views. Preserve the existing shared-filter implementation.

## 8. P2 — Export correctness and portability

### Executed evidence

- Opened both supplied workbooks, `exports/tiny_feasible_timetable.xlsx` and `exports/demo_small_timetable.xlsx`, with openpyxl. Date C2, Start D2, and End E2 are strings (`data_type='s'`, `number_format='General'`). Duration and student-count cells are correctly numeric.
- Opened both supplied English PDF files with pypdf: each has one parseable page and extractable timetable text. These files do not establish Arabic rendering.
- Executed the exporter's text handling through ReportLab Paragraph. `Algorithms <Graphs>` became `Algorithms `; `Intro <b>` raised a mismatched-tag `ValueError`. No PDF was authored by this probe.
- Imported the exporter on Linux: regular/bold fonts defaulted to Helvetica/Helvetica-Bold and `HAS_BIDI` was false. Source only searches Windows Arial font paths.

### Source findings and required checks

**Pointer:** `apps/api/app/exports/exporter.py` (`sanitize_excel_cell`, font registration, `generate_xlsx_export`, `generate_pdf_export`).

- **Typed XLSX dates/times:** Export actual date/time values with appropriate number formats. Download and reopen the workbook; assert date/time cell types, values, formats, and numeric counts/durations. Do not only check column headers.
- **Literal text preservation:** Use names containing `Algorithms <Graphs>`, `Intro <b>`, and `Research & Development`. PDF must preserve the full literal names and produce no parser error. Escape user text before placing it in ReportLab markup contexts.
- **Arabic portability:** Bundle or otherwise reliably provide an Arabic-capable font and shaping support. Test on a clean non-Windows environment. Render the PDF and inspect connected glyphs, direction, mixed Arabic/Latin text, clipping, and long names. A `%PDF` header does not establish readable Arabic.
- **Formula-like XLSX strings:** Test `=1+1`, `+SUM(A1:A2)`, `-TEST`, and `@name` as text fields. Reopen and assert exact original values and no formula cells. The current apostrophe prefix prevents formula interpretation but changes stored text.
- **Filtered export scope:** PDF/XLSX must state active filters and exported-versus-total assignment counts, and clearly identify full-run validation/penalty metadata. Compare the exported assignment subset to the current UI. Preserve JSON scope disclosure.
- **Download verification:** Exercise the actual HTTP download routes. Parse XLSX/JSON, render PDF, and compare course/date/time/room/student values to the solved run. Verify a zero-match export has an explicit empty result rather than appearing to be a complete validated timetable.

## 9. Replace weak verification with assertions

**Pointers:** `tests/browser_verification.js`; `tests/test_gate_c.py`.

The existing browser script logs pause sequence values, step sequence, row counts, sorting output, and export hrefs without asserting their expected values. Optional `isVisible()` branches can skip controls. Calendar/Room checks only click tabs. Console/page errors are logged but do not fail the run. The final success sentence is not acceptance evidence.

**Exact existing false positive:** The script searches for `CS100`, while the UI Tiny Feasible fixture contains `AI101` and `DS201`. Zero matches render one empty-state `<tr>`. Counting `tbody tr` therefore logs **1** even though there are **zero examination rows**.

Repair the test to assert course identity, not merely row count. Add stable data attributes if necessary. For example, after implementing those selectors:

```js
await page.getByPlaceholder(/Search/).fill('AI101');
await expect(page.locator('tbody tr[data-course-id]')).toHaveCount(1);
await expect(page.locator('tbody tr[data-course-id]')).toContainText('AI101');

await page.getByPlaceholder(/Search/).fill('CS100');
await expect(page.locator('tbody tr[data-course-id]')).toHaveCount(0);
await expect(page.getByText('No examination assignments match the current filter criteria.')).toBeVisible();
```

Required controls must fail if missing rather than silently skip. Assert acknowledged pause stability and exactly one defined step advancement; assert both sorting directions; compare assignment sets across views; wait for and inspect downloads. Fail on unexpected page errors. Test the mobile setup/lab/timetable journeys as well as the overview.

Gate C's current PDF assertions check binary markers/size, and its Unicode test checks an English XLSX cell plus a PDF header. Replace those overclaims with typed-cell assertions, actual parsed/rendered export evidence, and a recorded Arabic inspection.

## Completion evidence

For each repaired issue, report the changed repository files and the specific acceptance cases executed. Include actual failing-before/passing-after evidence where practical. Attach screenshots for the real tree, timed calendar, comparison charts, mobile workflows, and rendered Arabic PDF. Distinguish automated assertions, manual inspection, and anything still unverified. Do not declare all browser journeys verified based on screenshots or logged values alone.
