# ExamCraft AI — Search Engine Contract

This is an implementation specification derived for this project. It is not a claim that an implementation already exists.

## 1. Shared problem model

All four algorithms receive the same immutable, validated problem snapshot, objective configuration, deterministic course order, action order, pruning rules, and resource budgets. The algorithm changes the frontier policy; it does not change the problem.

- A course represents exactly one exam. Every course must receive exactly one slot and one room. Room splitting is outside this initial model.
- A slot is concrete: `{id, date, start_time, end_time}`. An exam starts at the slot's start and ends at `start + course.duration_minutes`; its actual interval must fit inside the slot.
- A room is `{id, name, capacity, unavailable:[{date,start_time,end_time}]}`. Blackouts are actual intervals, not slot identifiers, so overlapping slot aliases cannot evade them.
- Enrollment records link student IDs to course IDs. Enrollment count and shared-student counts come from these records, not separately editable totals.
- Course domains respect optional `allowed_slot_ids`.
- All date/time calculations use one documented campus-local civil-time convention. The initial product forbids overnight slots and exams. Do not accidentally convert a displayed date through UTC and change the day.
- Validate IDs, references, duplicate enrollments, integer capacities/durations, date/time ordering, nonnegative weights, valid slot restrictions, and constraint ranges before running. Distinguish invalid input from a valid but impossible problem.

### Hard constraints

1. Every course appears exactly once in a complete solution.
2. Room capacity is at least the number of unique students enrolled in the exam.
3. An exam occupies a permitted slot and fits its interval.
4. Two exams cannot occupy overlapping intervals in the same room.
5. Two exams with a shared student cannot overlap.
6. Exams cannot intersect a room blackout.
7. If set, `max_exams_per_student_per_day` cannot be exceeded.
8. If positive, `minimum_gap_minutes` must hold between each pair of exams taken by the same student. Apply this to actual elapsed time separation between all pairs, including across local examination dates. The soft short-gap penalty remains same-day only.

Intervals are half-open: `[start,end)`. Overlap means `start_a < end_b && start_b < end_a`. Therefore 09:00–10:00 and 10:00–11:00 do not overlap, although a positive minimum gap can still prohibit them. Room and student conflicts must use actual intervals, never only equality of slot IDs.

### State and action

Let the fixed course order be decreasing conflict-graph degree, decreasing enrollment, then course ID. Compute this once for the run and show it in the explanation panel. A state at depth `d` contains assignments for exactly the first `d` courses. An action assigns the next course to one candidate slot/room pair.

Use slots ordered by date, start time, then slot ID, and rooms ordered by ID. Do not apply a favorable action order only to one algorithm. DFS pushes children in reverse order so its first explored child is the same earliest candidate shown by the UI.

States must be immutable or correctly copied. A shared mutable assignments dictionary is a serious correctness bug. Fixed variable order makes this a finite tree with no repeated complete assignment prefixes, so a visited-state set is unnecessary in the first implementation. Do not add hidden symmetry pruning without documenting and applying it to all algorithms.

## 2. Objective with nonnegative incremental costs

Use an explicit penalty with smaller values meaning better student comfort and room utilization. Never invent a quality percentage without a defined normalization.

For course `i`, assignment `a`, and enrollment count `n_i`, define:

`unary(i,a) = w_room * (capacity(room(a)) - n_i)`.

Capacity is already a hard constraint, so this is nonnegative. For each unordered course pair `i,j`, let `shared(i,j)` be their shared-student count. Define:

`pair(i,a,j,b) = shared(i,j) * (w_same * same_date(a,b) + w_short * short_gap(a,b))`.

`short_gap` is 1 only when the exams are on the same date and the nonnegative gap between their actual intervals is less than `preferred_gap_minutes`; otherwise it is 0. Overlapping shared-student exams are hard-invalid and never scored as feasible candidates.

For a partial state `S` with assigned-course set `A`:

`P(S) = sum_{i in A} unary(i,S[i]) + sum_{i<j; i,j in A} pair(i,S[i],j,S[j])`.

Reasonable explicit starting weights are `w_same=100`, `w_short=30`, `w_room=1`, with `preferred_gap_minutes=60`; these are product choices, not scientifically calibrated constants. Expose them and show a cost breakdown. If student comfort is intended to dominate room use absolutely, use a lexicographic objective or prove a sufficient weight bound; these defaults do not guarantee that dominance for arbitrary datasets.

Every pair is counted once. Both same-day and short-gap penalties apply when both conditions hold. Adding an exam only adds nonnegative terms, so `g(S)=P(S)` and `c(S,S')=P(S')-P(S)>=0` are suitable A* costs.

Do not score only currently consecutive exams in a student's partial schedule: inserting a new exam can change adjacency and remove a previous penalty. Fixed pairwise penalties avoid that failure. Likewise, do not use a nonmonotone partial average as `g`.

## 3. Admissible, consistent A* heuristic

Let `D_i(S)` contain assignments for unassigned course `i` that satisfy all hard constraints against the assignments already present in `S`. Adding assignments can only shrink these domains.

Define:

`h(S) = sum_{i unassigned} min_{a in D_i(S)} [ unary(i,a) + sum_{j assigned} pair(i,a,j,S[j]) ]`.

This deliberately omits penalties between two currently unassigned courses. It also allows different unassigned courses to independently choose mutually incompatible minima. Both relaxations make it a lower bound, not an overestimate.

**Admissibility.** In any completion, the new cost for each unassigned course's unary term and its interactions with already assigned courses is at least that course's minimum above. All omitted future/future pair costs are nonnegative. Therefore `h(S)` does not exceed the minimum additional cost of completing `S`.

**Consistency.** Suppose the next action assigns course `k` to `a`. Its own old minimum is at most its actual edge cost. Every other unassigned domain shrinks, and every remaining assignment gains the nonnegative interaction with `k`; therefore its new minimum cannot be smaller than its old minimum. Summing gives `h(S) <= c(S,S') + h(S')`. Also, `h(goal)=0`.

An empty domain proves this partial state cannot be completed. Implement the same sound forward check for all four algorithms so A* does not receive undisclosed extra pruning. Do not report arbitrary heuristic infinity as a proof of infeasibility. A valid baseline is `h=0`; it reduces A* to uniform-cost search with this objective. The heuristic may be weak, especially near the root. A correct weak bound is preferable to a fabricated strong one.

Include all heuristic-computation work in search timing. Fewer explored nodes do not necessarily mean less computation.

## 4. Frontier policies and guarantees

| Algorithm | Frontier policy | Return condition | Honest guarantee |
|---|---|---|---|
| BFS | FIFO queue | First complete state popped | Shallowest goal; all full schedules here have the same depth, so this does not imply best penalty |
| DFS | LIFO stack | First complete state popped | First feasible schedule under its traversal order; no best-penalty guarantee |
| Greedy Best-First | Minimum `h`, then deeper depth, then insertion sequence | First complete state popped | Heuristic-guided first feasible schedule; no best-penalty guarantee |
| A* | Minimum `g+h`, then deeper depth, then insertion sequence | First complete state popped from the min-priority frontier | Minimum penalty, provided the specified costs/heuristic are used and no budget or destructive frontier pruning invalidates the search |

The depth tie-break is explicit and deterministic; it improves behavior on large zero-cost plateaus without changing A*'s optimality argument. Do not test a generated goal and immediately stop A*: a lower-cost completion may still be in the frontier. A*'s `g` cannot simply be the number of scheduled exams if the stated optimization target is student comfort.

The first implementation may use the same `h` for Greedy and A*. A distinct Greedy heuristic is allowed only if named, defined, and displayed explicitly. Do not describe `g+h` as Greedy's `h` just to make it perform well.

The finite fixed-order tree makes exhaustive search complete in the absence of limits, but real runs are bounded. Avoid universal claims of scalability from classroom samples.

## 5. Exact metrics

Use one shared instrumentation layer. Do not derive engine counts from the number of nodes currently visible in the browser.

- `generated_nodes`: root plus search children actually inserted into the frontier. Rejected candidate decorations in the visualization are not generated search states.
- `explored_nodes`: states popped from the frontier, including a popped goal.
- `expanded_nodes`: popped non-goal states whose successor enumeration starts. A goal is explored, not expanded.
- `candidate_actions`: completed candidate checks for the next course during expansion.
- `valid_actions`: candidates that pass the immediate hard-constraint check.
- `invalid_actions`: candidates rejected by immediate hard constraints. Thus `candidate_actions = valid_actions + invalid_actions`.
- `forward_pruned_actions`: immediately valid candidates rejected because a remaining course has no legal domain.
- `enqueued_actions`: valid candidates enqueued after common pruning. In an unrestricted run, `generated_nodes = 1 + enqueued_actions` and `valid_actions = enqueued_actions + forward_pruned_actions`.
- If a valid candidate is blocked at the resource boundary, record `budget_blocked_actions` explicitly so the same identities remain exact with `valid_actions = enqueued_actions + forward_pruned_actions + budget_blocked_actions`.
- `frontier_size` and `peak_frontier_size`: actual queue/stack/heap counts.
- `max_depth`: maximum depth of generated states. Every successful full schedule has depth equal to the number of courses; this fact should be visible in the teaching explanation.
- `search_compute_ms`: sum of monotonic durations spent advancing the engine, including dynamic action checks, forward checking, scoring, heuristics, and shared search instrumentation; exclude user pauses, intentional visualization pacing, networking, and browser rendering.
- `run_wall_ms`: elapsed wall time from start through finish, including pauses. Keep it separate.
- `preprocessing_ms`: structural schema validation, conflict graph, and static domain preparation, measured separately and treated identically in comparisons.
- `final_validation_ms`: independent complete-schedule validation after the search returns a candidate; measured separately from preprocessing and search computation.

If static domain preprocessing excludes capacity, duration, allowed-slot, or blackout failures, report them as preprocessing exclusions. Do not count them again as dynamic search action rejections. Use prefiltered static base domains for allowed-slot, duration, capacity, and blackout restrictions. Enumerate each next-course base domain during expansion, check dynamic constraints against assigned exams, and apply the common forward check. Preprocessing exclusions have their own reason counts; they are not dynamic candidate actions. Constraint probes performed while computing forward domains or h are not next-course candidate actions either. Use this convention for every algorithm.

Do not call frontier count or an object-size estimate actual RAM usage. Display `peak_frontier_nodes`; measured process-memory data is a separate optional metric.

## 6. Results and resource limits

Use explicit terminal states:

- `SUCCEEDED`: a complete independently validated schedule exists. Include penalty breakdown, assignments, metrics, and `optimality_proven`. For standard BFS/DFS/Greedy this flag is false; A* can set it true only under its stated guarantees. A separately proved global lower bound may establish optimality for any returned solution, but do not silently make that inference.
- `INFEASIBLE`: the complete permitted search space was exhausted, or a sound necessary-condition/domain proof establishes impossibility. Return the reason.
- `LIMIT_REACHED`: a configured compute-time, generated-node, frontier-node, or other resource limit stopped the run. Feasibility remains unknown unless an incumbent solution was separately found and validated. Never label this impossible.
- `CANCELLED`: explicit user cancellation.
- `ERROR`: unexpected engine failure; preserve a useful diagnostic without turning it into an algorithm failure result.
- `INTERRUPTED`: a backend restart or lost worker prevents this run from continuing; never relabel it infeasible.
- `INVALID_INPUT`: request rejected before a valid run starts; list field-level errors.

Check limits before substantial allocation and frequently during candidate/heuristic loops. Bound both total generated states and current frontier size; a time limit alone cannot protect BFS from rapid memory growth. Cancelling a run must actually stop work. Pausing must block engine advancement, not merely freeze the animation.

The minimal version does not need anytime incumbents. If added, a feasible result found before a limit must be presented as `feasible, optimality unknown`, with the stopping reason retained. Never discard frontier nodes silently and continue claiming exact A* optimality.

## 7. Truthful live visualization and controls

The engine emits ordered events from real state transitions. Suggested event kinds: `run_started`, `node_popped`, `action_rejected`, `child_enqueued`, `forward_pruned`, `goal_found`, and `run_finished`.

Each event contains `run_id`, monotonic `sequence`, `problem_hash`, algorithm/config identity, relevant node/parent/action IDs, reason codes with course/student/room references as appropriate, `depth/g/h/f` where meaningful, and an authoritative metrics snapshot or reproducible deltas. Browser timestamps are never engine runtimes.

Pause/Resume commands control whether the next engine transition may occur. `Step` commits exactly one documented unit; prefer labeling it **Next event** if the unit is one event. Reset cancels the old run and creates a new run identity from the same problem snapshot. Events from old run IDs must never mutate the new view. An immutable run snapshot prevents setup edits from corrupting an in-progress search.

Bound event retention and displayed tree size separately from solver limits. Show a clear count such as `Showing 500 of 24,300 generated nodes`; counters remain exact even when the canvas renders only a window or selected branch. Retained checkpoints and sequence IDs support reconnection and limited replay. If the retained trace is truncated, state that honestly. Do not invent omitted nodes or claim a full tree is visible.

The visualization may pace delivery and replay an actual completed trace, provided replay is clearly labeled. It must not replace live execution with fabricated animation. Do not render every BFS node in an unbounded React canvas.

## 8. Fair benchmark and winner policy

Run comparisons on one immutable dataset hash, objective, ordering, pruning configuration, and budget policy. Run algorithms sequentially to avoid mutual CPU/memory interference. Disable intentional pacing for all runs and use the same trace/instrumentation mode. Use an optional warm-up plus several repetitions when the dataset is small enough; report medians and the actual number of successful/limited runs. Never average successes and failures into one misleading runtime.

Prefer distinct labels: **Fastest successful**, **Lowest penalty**, and **Fewest explored nodes**. If a single winner is required, state a lexicographic rule, for example success first, lower penalty second, median compute time third. “Best observed solution” is not “proven globally optimal.” No successful run means no winner. Values close to timer noise should be treated as tied or inconclusive.

Store engine version, dataset hash, full configuration, seed if any randomness exists, timing mode, and repeat count with the comparison/export.

## 9. Small deterministic oracle fixtures

### A. A valid but unnecessarily stressful BFS result

- Courses `A` and `B`, each duration 60 minutes.
- Student `S1` enrolled in both; one room `R1`, capacity 1.
- Slots: `D1_09`, 2026-12-01 09:00–10:00; `D1_10`, 2026-12-01 10:00–11:00; `D2_09`, 2026-12-02 09:00–10:00.
- Hard minimum gap 0; daily exam limit unset (or 2); preferred gap 60.
- Weights same-day/short-gap/unused-seat = 100/30/1.

Under the specified order, BFS and DFS first return `A=D1_09, B=D1_10`, penalty 130. Greedy with the specified shared `h` and depth tie-break also returns this penalty-130 solution. A* must return a penalty-0 schedule with the two exams on different dates. All returned schedules must be hard-valid. This fixture demonstrates a real distinction without fabricated measurements.

### B. Infeasible room capacity

One course with two enrolled students, one room of capacity 1, any fitting slot. Input is structurally valid. The empty capacity-feasible domain proves infeasibility; it is not a schema error.

### C. Different slot IDs that still overlap

One room, one 09:00–10:00 exam and one 09:30–10:30 exam, represented by different slots. Reject the room collision. With different rooms and a shared student, reject the student collision. With different rooms and disjoint students, allow it.

### D. Boundary and gap behavior

09:00–10:00 followed by 10:00–11:00 in the same room is legal with minimum gap 0 and disjoint students; for a shared student it is legal at gap 0 and illegal at hard minimum gap 1. It still receives a soft short-gap penalty if the preferred gap is positive.

### E. Exhaustion versus budget

Use a fully enumerable infeasible toy and verify exhaustive runs return `INFEASIBLE`. For the capped test, choose a toy whose structural preflight and root-domain checks pass, and a generation limit that demonstrably interrupts before proof or exhaustion. That interrupted run must return `LIMIT_REACHED`. A sound infeasibility proof already obtained remains valid even when the configured budget is small; the test must not demand that a cap erase a proof. A too-small budget by itself establishes nothing about feasibility.

### F. Independent optimality oracle

For tiny instances, enumerate every complete assignment combination outside the four search implementations, independently validate it, and compute its penalty. A*'s returned penalty must equal the oracle minimum whenever it succeeds without limits. For every enumerated partial state, test `h <= exact remaining optimum` when a completion exists and `h(parent) <= edge_cost + h(child)` for viable children. Check objective nonnegativity, permutation invariance of the final penalty, and exact incremental-versus-full recomputation equality.

The useful tests are invariants and distinct known-answer cases, not tests that merely reproduce the implementation's own sorting or arithmetic line by line.
