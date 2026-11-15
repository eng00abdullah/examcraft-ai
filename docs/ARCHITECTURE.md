# Implementation architecture

## 1. Deliberate default

Use a local application with a pure Python search engine, a FastAPI API, a React/Vite/TypeScript frontend, and SQLite persistence. This matches a university AI project while keeping the algorithm code readable during discussion. No LLM, model download, vector database, API key, or internet connection is needed for scheduling after dependencies are installed.

This is a proposed implementation, not a benchmarked deployment architecture. Retain a coherent existing stack when adapting this kit and document the change. Do not spend the deadline migrating a working repository merely to match these defaults.

Suggested libraries, subject to compatible current stable versions: Pydantic for schemas, pytest for backend tests, React Router, a small state store or React context, TanStack Table for the timetable, React Flow for the graph, Recharts for comparisons, openpyxl for XLSX, and ReportLab or another verified PDF generator. Bundle fonts and other required assets locally. Select and pin compatible versions during implementation; do not guess version numbers from memory.

Use one package manager and lockfile per ecosystem. Provide a single documented start command plus explicit fallback commands. Test instructions on the actual target platform, and provide Windows PowerShell equivalents for a Windows user. Include timezone data support where the platform lacks it.

## 2. Repository boundaries

```text
apps/api/
  app/main.py
  app/schemas/            # structural input and API models
  app/domain/            # normalized data, intervals, enrollment indices
  app/search/            # pure BFS/DFS/Greedy/A*, objective, heuristic, events
  app/validation/        # independent complete-schedule checks
  app/runs/              # lifecycle, worker, pacing, event journal, commands
  app/storage/           # SQLite revisions and run records
  app/exports/           # PDF/XLSX generation from saved run
  tests/
apps/web/
  src/features/setup/
  src/features/search/
  src/features/timetable/
  src/features/comparison/
  src/components/
  src/api/
  e2e/
fixtures/                # supplied deterministic inputs/known answers
verification/            # supplied independent acceptance oracle
docs/
```

Do not put Python scheduling logic in React components. Do not implement a second JavaScript constraint engine that can diverge from the backend. UI validation may improve feedback, but API validation is authoritative. Generate or align frontend types from the backend schema and include schema version fields.

## 3. Search execution and responsiveness

Keep the pure solver independent of HTTP, storage, sleep, React, and exported document formatting. Expose a transition iterator and a final result. The session controller calls one transition at a time.

For this local v1, run at most one active solver job in a dedicated worker thread owned by a single application process. Keep expensive search work out of the async request/event-stream loop. The thread is a responsiveness boundary, not CPU parallelism or a hard memory-isolation guarantee. Budgets, cancellation checks, and bounded structures still apply. Use a worker process instead if measured responsiveness or interruption requirements cannot be satisfied; do not introduce a distributed queue by default.

Do not deploy this in-memory controller under multiple independent API worker processes without a real shared run coordinator. Local SQLite persists inputs/results, not a running Python generator. Completed runs survive restart; active/paused runs become `INTERRUPTED` after restart. Document this clearly.

Canonical nonterminal states are `CREATED`, `RUNNING`, and `PAUSED`. A single admission controller owns the solver slot. A paused run still holds it. A competing manual start or comparison receives `409 RUN_BUSY` with the current run ID and options to inspect or cancel it. A comparison reserves the slot for all of its sequential trials; manual jobs cannot interleave. No general job queue is required. Idempotency returns the existing run for a retried identical start request. Release the slot after a terminal record is committed, including cancellation or failure.

Teaching mode and benchmark mode call the **same engine** with the same decisions and exact counter logic. Teaching mode permits pacing between transitions. Benchmark mode removes pacing and detailed UI work; each compared algorithm uses the same benchmark instrumentation mode. Record preprocessing separately from measured engine advancement.

Use a monotonic timer around actual solver advancement. Exclude sleep, pause, event queue waiting, network serialization, rendering, and export creation. Name the value `search_compute_ms` and document that shared instrumentation within the engine is included. Do not claim it is pure CPU time. Store a separate end-to-end wall time.

## 4. Suggested API surface

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | API and persistence readiness; no fake ready state |
| `POST /api/problems/validate` | Structural errors and necessary feasibility checks, without overwriting data |
| `POST /api/problems` | Commit a new immutable snapshot; return revision and hash |
| `GET /api/problems` | Saved problems/revisions metadata |
| `GET /api/problems/{revision_id}` | Exact saved snapshot |
| `POST /api/runs` | Create a run from a revision and explicit config; return run ID and initial snapshot |
| `GET /api/runs/{run_id}` | Authoritative lifecycle, metrics, validation, and result |
| `GET /api/runs/{run_id}/events` | Ordered SSE events with sequence IDs and reconnect support |
| `POST /api/runs/{run_id}/control` | Pause, resume, step, cancel, speed; acknowledge applied state and sequence |
| `POST /api/runs/{run_id}/validate` | Re-validate saved assignments against an explicit revision |
| `GET /api/runs/{run_id}/export` | PDF/XLSX/JSON using the saved run and declared selection scope |
| `POST /api/comparisons` | Queue sequential trials of all four algorithms against one snapshot |
| `GET /api/comparisons/{id}` | Individual trial results, aggregates, statuses, and method |

Exact route names may change once, before implementation, if all callers and tests agree. Avoid silent drift.

Use appropriate status codes. Structural input errors provide field paths. Invalid lifecycle commands return a useful conflict response. Start submissions should have idempotency keys or an equivalent double-submit guard. Commands that advance execution, especially Step, need request IDs so a retry cannot advance twice.

## 5. Live protocol and control contract

Use Server-Sent Events for server-to-browser transitions and REST for control commands. A WebSocket is an acceptable alternative if already implemented correctly; it is not required for this architecture.

Every event contains run ID, revision/hash, strictly increasing sequence, event kind, relevant node/action references, real counter snapshot/deltas, and optional state information. The browser reducer ignores old run IDs and duplicate sequences. It detects gaps and fetches an authoritative snapshot when necessary.

Pause requests take effect at the next atomic transition boundary. A pause acknowledgment includes the last committed sequence; after that acknowledgment, search advancement stays frozen until Step or Resume. Administrative terminal transitions for Cancel, reset cancellation, wall-time expiry, interruption, and unexpected error remain permitted; they do not count as continued search exploration. Step is legal only while paused and grants exactly one search transition. A transition can be a node pop, rejected action, enqueued child, or solver terminal event; label the control tooltip accordingly. A separate `node_expanded` transition, if used, must be documented consistently.

Reset cancels and finishes the old run, then creates a fresh run ID from the same snapshot/config. Cancel also stops processing inside long domain/heuristic loops at regular checkpoints. Neither action turns the old run into `INFEASIBLE`. Speed is a pacing delay between transitions only.

Bound the event journal (initial default: 5,000 detailed events), graph display (initial default: 250 search nodes plus the selected path), and outgoing transport buffers. Keep exact metrics in the authoritative run state and persist final results. Slow clients cannot accumulate unlimited memory or block cancellation. Older graph history may be aggregated or evicted with a visible disclosure. `Last-Event-ID` recovery replays retained events; if the requested history has expired, send a snapshot/reset marker and explicitly report the missing trace. Do not pretend a truncated journal is a full replay.

If the connection is lost, show Reconnecting with last received sequence. Reconnect to the same run. After a service restart, read its persisted `INTERRUPTED` outcome and offer to start a fresh run. Never run a second solver merely because SSE reconnects.

## 6. Persistence and output integrity

SQLite stores immutable problem revisions, run configurations, terminal records, assignments, validation reports, comparison trials, and selected trace metadata. Use transactions and schema migrations or an explicit versioned bootstrap. Avoid holding a write transaction while searching. Each thread owns its database connection.

The final validator checks the entire candidate schedule independently of the incremental action validator. A solution is displayed as valid only after this check passes. Final validation failures indicate an internal correctness defect and must not produce a success badge. Record this work as `final_validation_ms`, separate from preprocessing and search computation.

Re-validating against the original snapshot creates a dated report for that snapshot. Checking a historical run against a different revision creates a separate report with the target revision/hash; it never rewrites the run's original snapshot, original validation, objective value, or optimality claim. A timetable valid under a new snapshot is not thereby proven optimal for that new problem. The UI distinguishes the original saved result from this compatibility check.

Exports read the saved run plus the selected filter scope. They do not read a partially edited setup form. Include algorithm, revision/hash, real dates/times, status, validation result, objective breakdown, and timing definitions. XLSX strings must remain strings, including names starting with `=`; use genuine date/time/numeric cell types where appropriate. PDF must paginate long names and preserve non-ASCII text with a verified font/shaping strategy. Do not rely on an external font CDN at demo time.

JSON result export includes the original snapshot and assignments so a third party can reproduce validation without the UI. The supplied independent checker is an acceptance tool, not a production dependency.

## 7. Comparison method

The default quick comparison runs each algorithm once sequentially with equal caps and no teaching delays. It must say **single run** and must not imply statistical significance. An optional repeated mode performs one warm-up and three measured trials per algorithm on small cases, rotates algorithm order between repeats, and reports individual statuses plus medians for successful trials. Persist the complete methodology.

Do not benchmark while another teaching/benchmark solver job is active. Failures retain their elapsed time and explored work but have no successful-solution time or penalty rank. Show timer resolution and raw trial values when tiny durations are effectively tied.

## 8. Operational boundary

The first release is a local, single-workspace academic application. Multi-user authentication, internet exposure, university identity integration, production deployment, and large-instance optimization need their own requirements. A clean local run with fully working requested features is the delivery target. If public deployment becomes required, design its coordinator and persistence for that actual host instead of assuming the local process survives serverless restarts.
