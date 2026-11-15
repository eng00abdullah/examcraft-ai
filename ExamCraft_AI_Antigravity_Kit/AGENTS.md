# ExamCraft AI — implementation instructions

Build the requested exam-scheduling product. This folder initially contains a specification and independent verification assets, **not an implemented application**.

## Working agreement

- Read `01_MASTER_PROMPT.md`, `docs/PRODUCT_AND_ACCEPTANCE.md`, `docs/DATA_CONTRACT.md`, `docs/SEARCH_CONTRACT.md`, `docs/ARCHITECTURE.md`, and `docs/UX_DIRECTION.md` before implementation.
- Preserve the user's existing code and instructions. Inspect a pre-existing repository before choosing changes; never replace it merely because this kit describes a default stack.
- Resolve routine reversible choices using these defaults. Record decisions in `docs/IMPLEMENTATION_STATUS.md`. Continue between milestones when their gates pass; honor the tool's actual permission and review controls.
- Implement every requested core feature. Do not declare success from a landing page, screenshots, or a scaffold alone.
- Produce actual code, run it, execute meaningful checks, fix failures, and report the commands and observed results. Distinguish implemented, verified, blocked, and planned work.

## Non-negotiable correctness

- Implement real BFS, DFS, Greedy Best-First, and A* over the same deterministic problem model. Do not route every button to one solver, use a hidden optimizer, hard-code schedules, or generate fictitious metrics/events.
- Search constraints and final schedule validation are separate paths. Use the supplied independent oracle for small acceptance fixtures; the application must not import the oracle as its scheduling engine.
- Costs, heuristic, ordering, tie breaks, metrics, terminal states, and limits follow `docs/SEARCH_CONTRACT.md`. An execution limit does not prove infeasibility.
- Run inputs are immutable revisions. Views, exports, comparisons, and validation refer to the exact saved revision and run.
- Pause stops actual engine advancement at a documented transition boundary. Speed delays and paused time do not contaminate benchmark time. Step advances one engine transition.
- Reject invalid inputs with useful messages. Do not silently discard unknown references, duplicate enrollments, or invalid dates.
- A displayed tree may be bounded; exact aggregate counters and final validation may not be sampled or fabricated.
- Rejected actions are not expanded states. A valid full assignment is not automatically a proven optimal solution.
- Do not weaken tests or edit fixture expectations merely to make an implementation pass. A genuine specification defect needs an explicit explanation and regression case.

## Delivery priorities

1. Working engine-to-screen flow with verified schedules.
2. Four algorithms, correct controls, saved data, honest comparison.
3. Complete timetable views and genuine PDF/XLSX exports.
4. Distinct polished dark search laboratory and light timetable workspace.

Default: Python/FastAPI + React/Vite/TypeScript + SQLite, local operation, no external AI API required. Select compatible current stable dependencies and commit lockfiles. Do not add unrelated auth, payments, chatbot, cloud provisioning, or public deployment to this first delivery.

If agents work concurrently, freeze the schema first and give each agent disjoint file ownership. One integrator owns shared models and dependencies. Update `docs/IMPLEMENTATION_STATUS.md` at milestones and before context changes.
