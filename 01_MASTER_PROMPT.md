# ExamCraft AI — master execution prompt

Paste the text below into Antigravity with this extracted folder open as the workspace. If an application already exists, keep this kit as a reference folder and point the prompt to its actual path. Do not replace existing project instructions blindly.

---

You are implementing **ExamCraft AI — Intelligent University Examination Scheduling System**. Act as the engineering lead and implementation agent. Deliver a genuinely working, polished academic product, including the search engine, live explanation, data management, timetable dashboard, exports, and evidence of correctness.

The attached workspace contains the complete build contract and independent verification assets. Treat them as implementation requirements, not as evidence that an app already exists. Read:

1. `AGENTS.md`
2. `docs/PRODUCT_AND_ACCEPTANCE.md`
3. `docs/DATA_CONTRACT.md`
4. `docs/SEARCH_CONTRACT.md`
5. `docs/ARCHITECTURE.md`
6. `docs/UX_DIRECTION.md`
7. `docs/DELIVERY_PLAN.md`
8. `verification/README.md` and the fixture manifest.

## Your first actions

Inspect the actual repository, available runtimes, package managers, existing instructions, and existing application. Preserve working code. If this is only the specification kit, create the application inside this workspace. Use Python/FastAPI for the pure Python scheduling engine/API, React/Vite/TypeScript for the frontend, and SQLite for local persistence unless an existing coherent implementation gives a concrete reason to retain another stack. Document such a reason before proceeding.

Create a short implementation plan and `docs/IMPLEMENTATION_STATUS.md`, then **implement and verify the plan**. Do not finish after a plan or a UI mockup. Continue through the milestones automatically when their acceptance gates pass, within existing permissions. Do not alter permission policies. If a real external prerequisite or required review blocks execution, report exactly what is blocked and the smallest action needed.

## Product requirements

- Home page with a clear product story, Start Scheduling, and Try Sample.
- Editable problem setup for courses, students, enrollments, real examination dates/time slots, rooms, capacities, room availability, hard constraints, and soft preference weights. Include deterministic sample data and validated JSON import/export.
- Four real search implementations: BFS, DFS, Greedy Best-First, and A*. Use one state model, deterministic course/action ordering, identical hard constraints, and equal resource policies. Explain their actual frontier behavior.
- Dark **Search Lab** with a real bounded search tree, parent-child relationships, node inspector, current partial timetable, accepted/rejected placements with reasons, frontier information, and exact live metrics.
- Working Start, Pause, Resume, Step Forward, Reset, Speed, and Cancel controls. Pause must stop real engine progress; Step must advance one documented engine transition. Ignore stale events from replaced runs. Do not label replay as live computation.
- Truthful outcomes: validated solution, proven infeasible, execution/resource limit, cancelled, interrupted, and internal error. Explain infeasibility only with a sound proof or exhaustive search. Preserve a valid candidate when applicable without claiming unproved optimality.
- Light professional **Timetable Dashboard** with table, calendar, and room views backed by one immutable saved schedule. Include course name/code, date, actual start/end, room, and enrollment-derived student count. Implement search, filters, stable sorting, statistics, and independent re-validation.
- Real downloadable PDF and XLSX exports. Include revision/run provenance and clearly selected full or filtered scope. Read the XLSX back and render/inspect the PDF during verification. Export JSON for independent validation as well.
- **Algorithm Comparison** with actual sequential benchmark runs on the same snapshot. Report status, measured search time, generated/explored/expanded nodes, considered/rejected actions, depth, frontier peak, and penalty. Separate fastest successful run, fewest explored nodes, and lowest observed penalty. Never invent a universal winner or fill failed measurements with zeros.
- Local persistence of committed setup revisions and completed runs. Refresh must restore them. A restarted backend must mark abandoned active runs honestly.

## Search correctness

Each action assigns one course to one slot and one room. No multi-room splitting in v1. Use actual half-open exam intervals, enrollment-derived capacity checks, room blackouts, student overlaps, room overlaps, optional hard daily limits, and minimum gaps.

All complete states have the same assignment depth; BFS does not therefore minimize student inconvenience. Implement the explicit nonnegative weighted objective from the search contract. A* uses `f = g + h`, with `g` equal to accrued preference penalty and the specified admissible lower bound `h`. Include `h = 0` as a tested diagnostic baseline. Never use “remaining exams” as an A* lower bound for a penalty objective that can be zero.

Use the supplied tiny fixture where a same-day back-to-back schedule costs 130 and a different-day schedule costs 0. Validate the oracle independently, then require A* to return the exact optimal penalty on exhaustively enumerable instances. Verify heuristic admissibility and consistency over tiny partial states. BFS/DFS/Greedy need a feasible result, not a false quality guarantee.

Protect runtime and memory with explicit active-time, generated-node, expanded-node, and frontier caps. Use identical caps for comparisons. Visualization pacing, paused time, rendering, and network delays are not search runtime. Exact counters must come from engine transitions.

## Visual direction

Use `docs/UX_DIRECTION.md`. The experience should look like a carefully designed university product. The dark Search Lab is the visual centerpiece: graph canvas, readable state cards, decision inspector, and persistent controls. The final dashboard is bright, restrained, spacious, and data-focused. Use a coherent type scale, consistent spacing, accessible focus states, and meaningful motion. Every visible control works. Include empty/loading/error/no-results/disconnected/limited states. Avoid invented promotional statistics, decorative chatbot panels, and large animations that obscure the schedule.

## Work sequence and collaboration

Follow four acceptance gates:

**A — Vertical slice:** one real algorithm, one fixture, true events, independent validation, and a schedule on screen.

**B — Correct engine and editable data:** all algorithms, objective/heuristic tests, infeasible/limited cases, validated setup, immutable revisions, real controls and persistence.

**C — Complete requested product:** all timetable views, filters, sorting, re-validation, downloadable PDF/XLSX/JSON, and real comparison.

**D — Presentation and handoff:** visual polish, responsive/keyboard checks, clean startup, demo script, export inspection, tests, and evidence.

After contracts are fixed, parallel work is allowed: engine/tests; frontend; API/integration/exports. Give each track disjoint file ownership. One integrator owns shared types and dependencies. Do not run competing benchmark workers in parallel.

## Verification and final evidence

Run the independent verifier's self-tests first. Do not substitute those tests for application testing. Then run backend correctness tests, frontend type/build checks, and browser end-to-end journeys for the actual application. Test pause/step/resume, cancel/reset, reconnect, stale revision detection, capacity boundary, overlapping slot aliases, infeasible vs capped, consistent views, export contents, and repeated sequential comparisons.

Open the running app and exercise the full user journey. Fix the failures you observe. If browser tools are unavailable, say which checks remain unverified; do not fabricate screenshots or test outcomes.

At each gate, update `docs/IMPLEMENTATION_STATUS.md` with completed features, actual commands/results, failures, decisions, and next work. At completion provide:

1. Exact startup commands for the current platform and the tested local URL.
2. A concise feature/gate status table.
3. Real test results and relevant command output.
4. Screenshots of the running Search Lab, timetable, and comparison.
5. A PDF, XLSX, and JSON from a genuinely solved sample.
6. A 3–5 minute demo script with a valid schedule, an algorithm comparison, and an honest limit/infeasible case.
7. Explicit known limits and anything not verified.

Start now by inspecting the workspace, writing the short plan, and building Gate A. Continue to B, C, and D when their prerequisites pass. Do not return a generic list of recommendations in place of the working product.
