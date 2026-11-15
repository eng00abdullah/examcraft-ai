# ExamCraft AI — Third Bundle Independent Acceptance Review

Date: 2026-11-14
Source: user-provided `ExamCraft_AI_Review_Bundle(3).zip`

## Verdict
**Ready for academic demonstration with one truthfulness/presentation correction recommended before final handoff.** The evidence supports the core scheduling implementation and the four previous fixes. This is *not* a certification of production readiness at university scale.

## Independently executed checks
- Repair regressions: **12 / 12 PASSED** (`python ExamCraft_AI_Repair_Pack/run_regressions.py --project-root .`).
- Independent verification oracle self-tests: **15 / 15 PASSED** (`PYTHONPATH=apps/api python -m unittest discover -s verification -q`).
- Application tests: **12 / 12 PASSED** (`PYTHONPATH=apps/api python -m unittest discover -s tests -q`).
- XLSX native dates and times verified using `openpyxl`: `docs/sample_exports/sample_schedule.xlsx` and `docs/sample_exports/demo_small_timetable.xlsx` contain Excel date/time cells, not strings.
- Independent oracle checked `sample_schedule.json` as valid, penalty 0; `demo_small_timetable.json` as valid, penalty 200.
- Rendered and visually examined the one-page `sample_schedule.pdf`; table text legible in this English sample.
- Reviewed supplied `08_calendar_dynamic_lanes.png` and `09_mobile_layout.png`; the captured calendar shows simultaneous exams in separate room lanes.

## Four formerly blocking issues
1. **Unsaved revision prevention**: `apps/web/src/App.tsx` computes dirty state from committed snapshot; SearchLab and Comparison receive `isDirty` and block execution. Existing browser script additionally asserts dirty-state behavior. Code and reported browser evidence support the fix.
2. **Refresh recovery**: `App.tsx` hydrates the active run; `SearchLab.tsx` retrieves the saved record and reconnects SSE for active/paused runs; `main.py` emits typed `run_finished` SSE for completed ones. Browser script covers paused and completed reload. Code supports the main workflow.
3. **Calendar rendering**: `TimetableDashboard.tsx` derives start/end hours from scheduled exams and assigns dedicated lanes per room; inspected screenshot shows this working for the fixture. The v1 contract explicitly *does not support cross-midnight exams*, so midnight is not a required test for this release.
4. **XLSX cell types**: Independently confirmed native date/time cell values in both supplied XLSX samples.

## Remaining confirmed issue — Search visualization integrity after completed-run reload
`apps/web/src/features/search/SearchLab.tsx`, inside `reconstructTreeFromAssignments`, creates synthetic visual nodes and sets **g: 0, h: 0, f: 0** for every node. For a completed A* run restored after browser refresh, these are not the true historical search-node metrics. They can mislead users when displayed in the node inspector, especially if the real solution has positive accrued cost. Reconstructed nodes also need to be clearly marked as *solution-path summary*, not genuine replayed search history.

**Minimal correction:** For synthesized nodes, use nullable/undefined g, h, f and show 'Not available (reconstructed from saved solution)' in the inspector, with a clear 'Reconstructed solution path' label; or persist and replay actual original node events and metrics. Do not hard-code zeros. Add a test for F5 after a successful positive-penalty run, checking that no synthetic search values are presented as real.

## Evidence boundaries
- The included `tests/browser_verification.js` and screenshots indicate that the developer ran Edge/Playwright browser journeys. I did **not independently run a live browser journey** in this audit; screenshots and script source are inspected artifacts, not proof of fresh execution by this reviewer.
- Arabic export output was not independently visually tested; the inspected PDF is an English sample.
- The described solution assigns one room per exam and excludes cross-midnight exams according to its explicit v1 contract. Performance/scale beyond tiny samples and the configured search limits is not established by the reported tests.

## Recommended finishing action
Apply only the completed-run visualization integrity patch, rerun the 39 Python tests plus a focused browser test for completed-run refresh with positive penalty, then freeze the academic demo build. Do not undertake a general architectural rewrite or unneeded feature expansion before presentation.
