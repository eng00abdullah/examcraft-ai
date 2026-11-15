# ExamCraft AI — Independent Audit of Revised Bundle

Reviewed package: `ExamCraft_AI_Review_Bundle(1).zip` (2026-11-14).

## Independently executed checks

- Repair pack: **12/12 passing** (`python ExamCraft_AI_Repair_Pack/run_regressions.py --project-root .`).
- Verification oracle self-tests: **15/15 passing** (`python -m unittest discover -s verification -v`).
- Application suite: **12/12 passing** (`python -m unittest discover -s tests -v`).
- Sample JSON output checked using independent oracle:
  - `tiny_feasible`: valid, 0 violations, penalty **0**.
  - `demo_small`: valid, 0 violations, penalty **200**.
- PDF sample visually rendered and inspected (English table legible).
- XLSX sample opened using `openpyxl`; timetable rows and numeric duration cells present. However, sample Date/Start Time/End Time cells are **strings** rather than native Excel date/time values.
- Seven supplied UI screenshots inspected. These are evidence of captured layouts, not a substitute for independently exercising the browser.

## Remaining issues

### P1 — Unsaved data can run against an older revision

`apps/web/src/App.tsx` owns `problem` and `revisionId` independently. Edits in `Setup.tsx` can change `problem` without clearing `revisionId`. `SearchLab.tsx` calls `startRun(revisionId, ...)`, and `Comparison.tsx` calls `runComparison(revisionId)`. The Setup page displays the dirty state but does not enforce a save before starting search or comparison. Tests should assert that fresh changes are either committed automatically or block both actions, and that the committed snapshot/hash matches what the UI displays.

### P1 — Refresh and completed-run recovery are incomplete

`SearchLab.tsx` initializes `activeRunId` from `sessionStorage` but does not fetch that run or reconnect the SSE stream on mount. App state (`revisionId`, `activeRunRecord`) starts empty on each page reload. For a completed run, `apps/api/app/main.py` streams `record.model_dump()` as a `run_finished` SSE payload; `SearchLab.tsx` expects a `SearchEvent` with `kind='run_finished'`. The stored ID alone does not restore the run, graph, state, or timetable. Verify F5 both while paused and after completion.

### P1/P2 — Calendar range is hard-coded and parallel exams overlap visually

`TimetableDashboard.tsx` sets `calendarHours` from 08:00 to 20:00 and positions exam cards using `((exam.startMins - 8*60)/60)*50`. A 07:00 exam will have negative top position; an exam starting late can overflow the 660px grid. All cards use the same `left: '18%'` and `right: '3%'`, so simultaneous exams in distinct rooms overlap instead of appearing in separate lanes. Compute vertical bounds from the actual schedule and create non-overlapping visual lanes.

### P2 — Excel samples lack native date/time cells

`exports/demo_small_timetable.xlsx`, sheet `Timetable`, columns C/D/E contain strings, although the delivery report claims typed date/time cells. Validate fresh export results against the requirement and produce `datetime.date` and `datetime.time` values with suitable Excel formats.

### P2 — Test coverage/evidence wording is overstated

`tests/browser_verification.js` downloads PDF and XLSX, but its assertions shown in the script check primarily that binary files exceed 1 KB. It does not itself prove Arabic shaping, row parity, or Excel value types. Distinguish backend inspection from browser-only verification in the acceptance table. Independent full browser E2E was not rerun in this audit environment.

## Recommended acceptance order

1. Revision integrity on Search and Compare, including stale request races.
2. Refresh/reconnect and record restoration for active, paused, and completed runs.
3. Calendar dynamic bounds and room lanes.
4. Date/time XLSX types and output parity.
5. Stronger frontend E2E assertions; rerun all 39 Python tests, build, real browser journey, and inspect generated exports.

## Overall status

**Core search functionality and prior repair regressions: independently passing.**
**Full product acceptance: conditional; unresolved frontend state-integrity, recovery, calendar, and export-quality items.**
