# ExamCraft AI — Implementation Plan

## Executive Summary
ExamCraft AI is an intelligent examination scheduling system built with a pure Python scheduling engine, FastAPI backend, React/Vite/TypeScript frontend, and SQLite persistence. It provides real search implementations (BFS, DFS, Greedy Best-First, A*), live event streaming with fine-grained execution controls (Pause, Resume, Step, Reset, Speed, Cancel), an editable problem setup with immutable revisions, a dark Search Lab visualization, a professional light Timetable dashboard (Table, Calendar, Room views), XLSX/PDF/JSON exports, and sequential algorithm comparisons.

---

## Architecture & Technology Stack
- **Engine & Backend**: Python 3.13 (`.venv`), FastAPI, Pydantic v2, SQLite, OpenPyXL, ReportLab, ZoneInfo (`tzdata`).
- **Frontend**: React 18 / Vite / TypeScript, Tailwind CSS, SVG/Canvas Search Graph, Lucide icons.
- **Persistence**: SQLite (`examcraft.db`) storing immutable problem revisions, run configs, search traces, assignments, validations, and benchmarks.
- **Testing & QA**: Independent acceptance oracle (`verification/oracle.py`), unittest suite, end-to-end API and browser verification.

---

## Delivery Gates

### Gate A: Real Vertical Slice
- **Normalized Domain & Validation**: Course codes, dates, half-open intervals `[start, end)`, enrollment counts, capacity checks, room blackouts, conflict graph degrees.
- **Independent Complete-Schedule Validator**: Verifies all 8 hard constraints and penalty breakdowns completely separate from search engine.
- **Deterministic DFS**: LIFO stack, fixed ordering (decreasing degree, enrollment, course ID; slots by date, time, ID; rooms by ID), candidate evaluation and rejection reasons.
- **FastAPI SSE Run Endpoint**: Event streaming (`run_started`, `node_popped`, `action_rejected`, `child_enqueued`, `goal_found`, `run_finished`), authoritative metrics.
- **Frontend Slice**: Load tiny sample (`tiny_feasible.json`), start search, stream live events, display validated schedule, verify against `verification/oracle.py`.

### Gate B: Correct Engine, Full Algorithms, Controls & Editable Data
- **Algorithms**: BFS (FIFO), Greedy Best-First (heuristic priority), A* (`g + h` priority with admissible lower bound), diagnostic `h = 0`.
- **Heuristic & Objective**: Incremental `g` (same-day pair, short gap, spare room capacity), admissible and consistent `h` using relaxed independent unassigned minima, common forward-checking.
- **Execution Controls**: Real Pause (freezes at transition boundary), Resume, Step (single transition advance), Reset (isolates run), Speed (pacing), Cancel (stops worker).
- **Setup & Revisions**: Editable courses, slots, rooms, constraints, weights. SHA-256 canonical hashing, immutable problem snapshots, SQLite persistence.
- **Terminal States**: `SUCCEEDED`, `INFEASIBLE`, `LIMIT_REACHED`, `CANCELLED`, `INTERRUPTED`, `INVALID_INPUT`.

### Gate C: Complete Product Workflow
- **Search Lab**: Dark theme (`#0B1220`), bounded search tree, node inspector with partial schedule and `g/h/f`, rejected action markers with reasons, live metric strip.
- **Timetable Dashboard**: Professional light theme (`#F8FAFC`), Table view (sortable, filterable), Calendar view (time/date blocks), Room view (occupancy tracks), independent re-validation.
- **Exports**: Real PDF (ReportLab, paginated, styled), XLSX (OpenPyXL, Timetable + Summary sheets), JSON (complete problem + assignments).
- **Algorithm Comparison**: Sequential automated trials across BFS, DFS, Greedy, A* on identical snapshots with identical caps; distinct recognition for Fastest, Fewest Explored, Lowest Penalty.

### Gate D: Presentation, Polish & Verification Evidence
- Responsive layouts (desktop, laptop, mobile), accessibility, error states.
- End-to-end verification across all supplied fixtures (`tiny_feasible`, `tiny_infeasible`, `capacity_boundary`, `overlap_alias`, `room_blackout`, `demo_small`).
- Production startup scripts, export inspection, demo script, and final documentation.
