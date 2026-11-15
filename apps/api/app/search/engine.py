from __future__ import annotations
import time
import heapq
from collections import deque
from typing import Dict, List, Optional, Tuple, Generator, Any
from dataclasses import dataclass, field

from app.schemas.problem import RunConfig, Assignment
from app.schemas.events import SearchEvent, MetricsSnapshot
from app.domain.normalized import NormalizedProblem, ExamPlacement
from app.search.objective import compute_incremental_cost, compute_total_penalty
from app.search.heuristic import is_action_valid_against_partial, compute_heuristic_and_forward_check


@dataclass
class SearchNode:
    node_id: str
    parent_id: Optional[str]
    depth: int
    assigned_placements: Dict[str, ExamPlacement]  # course_id -> placement
    g: int
    h: int
    f: int
    last_course_id: Optional[str] = None
    last_slot_id: Optional[str] = None
    last_room_id: Optional[str] = None


class SearchEngine:
    def __init__(self, norm: NormalizedProblem, config: RunConfig, run_id: str):
        self.norm = norm
        self.config = config
        self.run_id = run_id
        self.metrics = MetricsSnapshot()
        self.sequence = 0
        self.node_counter = 0
        self.total_courses = len(norm.ordered_courses)

    def _next_sequence(self) -> int:
        self.sequence += 1
        return self.sequence

    def _next_node_id(self) -> str:
        self.node_counter += 1
        return f"node_{self.node_counter}"

    def run(self) -> Generator[SearchEvent, None, None]:
        active_compute_seconds = 0.0
        active_start = time.perf_counter()

        def emit(event: SearchEvent) -> SearchEvent:
            nonlocal active_compute_seconds, active_start
            active_compute_seconds += (time.perf_counter() - active_start)
            self.metrics.search_compute_ms = active_compute_seconds * 1000.0
            event.metrics = self.metrics.model_copy()
            return event

        # Check preflight feasibility:
        # 1. Any course has an empty static base domain?
        for course in self.norm.ordered_courses:
            if not self.norm.static_base_domains[course.id]:
                reason = "No candidate slot/room satisfies static constraints (capacity, duration, allowlist, blackout)"
                yield emit(SearchEvent(
                    sequence=self._next_sequence(),
                    run_id=self.run_id,
                    problem_hash=self.norm.problem_hash,
                    kind="run_started",
                    timestamp=time.time(),
                ))
                active_start = time.perf_counter()
                yield emit(SearchEvent(
                    sequence=self._next_sequence(),
                    run_id=self.run_id,
                    problem_hash=self.norm.problem_hash,
                    kind="run_finished",
                    timestamp=time.time(),
                    status="INFEASIBLE",
                    rejection_code="empty_static_domain",
                    rejection_reason=f"Course {course.code} ({course.id}): {reason}",
                ))
                return

        # Initialize root node
        root_h, empty_cid = compute_heuristic_and_forward_check(
            self.norm,
            [c.id for c in self.norm.ordered_courses],
            {},
            self.config.heuristic,
        )

        if root_h is None:
            # Root forward check failed
            yield emit(SearchEvent(
                sequence=self._next_sequence(),
                run_id=self.run_id,
                problem_hash=self.norm.problem_hash,
                kind="run_started",
                timestamp=time.time(),
            ))
            active_start = time.perf_counter()
            yield emit(SearchEvent(
                sequence=self._next_sequence(),
                run_id=self.run_id,
                problem_hash=self.norm.problem_hash,
                kind="run_finished",
                timestamp=time.time(),
                status="INFEASIBLE",
                rejection_code="root_domain_empty",
                rejection_reason=f"Course {empty_cid} has no viable placement at root",
            ))
            return

        root_node = SearchNode(
            node_id=self._next_node_id(),
            parent_id=None,
            depth=0,
            assigned_placements={},
            g=0,
            h=root_h,
            f=root_h,
        )

        self.metrics.generated_nodes = 1
        self.metrics.frontier_size = 1
        self.metrics.peak_frontier_size = 1
        self.metrics.max_depth = 0

        yield emit(SearchEvent(
            sequence=self._next_sequence(),
            run_id=self.run_id,
            problem_hash=self.norm.problem_hash,
            kind="run_started",
            timestamp=time.time(),
            node_id=root_node.node_id,
            depth=0,
            g=0,
            h=root_h,
            f=root_h,
        ))
        active_start = time.perf_counter()

        algorithm = self.config.algorithm.lower()
        bfs_queue: deque[SearchNode] = deque()
        dfs_stack: List[SearchNode] = []
        pq: List[Tuple[int, int, int, SearchNode]] = []
        insertion_seq = 0

        if algorithm == "bfs":
            bfs_queue.append(root_node)
        elif algorithm == "dfs":
            dfs_stack.append(root_node)
        elif algorithm == "greedy":
            insertion_seq += 1
            heapq.heappush(pq, (root_node.h, 0, insertion_seq, root_node))
        elif algorithm == "astar":
            insertion_seq += 1
            heapq.heappush(pq, (root_node.f, 0, insertion_seq, root_node))
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        goal_node: Optional[SearchNode] = None
        terminal_status = "INFEASIBLE"
        terminal_reason: Optional[str] = "Frontier exhausted with no complete feasible schedule found"
        branches_dropped = False

        while True:
            # Check compute time limit
            current_compute_sec = active_compute_seconds + (time.perf_counter() - active_start)
            if current_compute_sec >= self.config.limits.max_search_seconds:
                terminal_status = "LIMIT_REACHED"
                terminal_reason = f"Search compute time limit ({self.config.limits.max_search_seconds}s) reached"
                break

            if self.metrics.frontier_size == 0:
                break

            # Pop next node from frontier
            if algorithm == "bfs":
                current_node = bfs_queue.popleft()
            elif algorithm == "dfs":
                current_node = dfs_stack.pop()
            else:
                _, _, _, current_node = heapq.heappop(pq)

            self.metrics.frontier_size -= 1
            self.metrics.explored_nodes += 1

            # Format current assignments for UI inspector
            curr_assignments = [
                {"course_id": p.course_id, "slot_id": p.slot_id, "room_id": p.room_id}
                for p in current_node.assigned_placements.values()
            ]

            yield emit(SearchEvent(
                sequence=self._next_sequence(),
                run_id=self.run_id,
                problem_hash=self.norm.problem_hash,
                kind="node_popped",
                timestamp=time.time(),
                node_id=current_node.node_id,
                parent_id=current_node.parent_id,
                course_id=current_node.last_course_id,
                slot_id=current_node.last_slot_id,
                room_id=current_node.last_room_id,
                depth=current_node.depth,
                g=current_node.g,
                h=current_node.h,
                f=current_node.f,
                assignments=curr_assignments,
            ))
            active_start = time.perf_counter()

            # Goal check upon popping
            if current_node.depth == self.total_courses:
                goal_node = current_node
                terminal_status = "SUCCEEDED"
                terminal_reason = "Valid full schedule found"
                yield emit(SearchEvent(
                    sequence=self._next_sequence(),
                    run_id=self.run_id,
                    problem_hash=self.norm.problem_hash,
                    kind="goal_found",
                    timestamp=time.time(),
                    node_id=goal_node.node_id,
                    parent_id=goal_node.parent_id,
                    depth=goal_node.depth,
                    g=goal_node.g,
                    h=goal_node.h,
                    f=goal_node.f,
                    assignments=curr_assignments,
                ))
                active_start = time.perf_counter()
                break

            # Check expansion budget
            if self.metrics.expanded_nodes >= self.config.limits.max_expanded_nodes:
                terminal_status = "LIMIT_REACHED"
                terminal_reason = f"Expanded node cap ({self.config.limits.max_expanded_nodes}) reached"
                break

            # Check generation budget before expanding
            if self.metrics.generated_nodes >= self.config.limits.max_generated_nodes:
                terminal_status = "LIMIT_REACHED"
                terminal_reason = f"Generated node cap ({self.config.limits.max_generated_nodes}) reached"
                break

            # Expansion of current non-goal node
            self.metrics.expanded_nodes += 1
            next_course = self.norm.ordered_courses[current_node.depth]
            base_domain = self.norm.static_base_domains[next_course.id]

            remaining_unassigned = [
                c.id for c in self.norm.ordered_courses[current_node.depth + 1 :]
            ]

            valid_children_to_enqueue: List[SearchNode] = []

            for slot, room in base_domain:
                self.metrics.candidate_actions += 1

                candidate_placement = self.norm.create_placement(next_course.id, slot.id, room.id)
                valid, rej_code, rej_reason = is_action_valid_against_partial(
                    self.norm, candidate_placement, current_node.assigned_placements
                )

                if not valid:
                    self.metrics.invalid_actions += 1
                    yield emit(SearchEvent(
                        sequence=self._next_sequence(),
                        run_id=self.run_id,
                        problem_hash=self.norm.problem_hash,
                        kind="action_rejected",
                        timestamp=time.time(),
                        parent_id=current_node.node_id,
                        course_id=next_course.id,
                        slot_id=slot.id,
                        room_id=room.id,
                        depth=current_node.depth + 1,
                        rejection_code=rej_code,
                        rejection_reason=rej_reason,
                    ))
                    active_start = time.perf_counter()
                    continue

                self.metrics.valid_actions += 1

                # Dynamic hard constraints passed! Construct new assignments dict
                new_assignments = dict(current_node.assigned_placements)
                new_assignments[next_course.id] = candidate_placement

                # Forward check & heuristic computation
                h_val, empty_future_cid = compute_heuristic_and_forward_check(
                    self.norm,
                    remaining_unassigned,
                    new_assignments,
                    self.config.heuristic,
                )

                if h_val is None:
                    # A future course has no valid placement! Forward prune this action
                    self.metrics.forward_pruned_actions += 1
                    yield emit(SearchEvent(
                        sequence=self._next_sequence(),
                        run_id=self.run_id,
                        problem_hash=self.norm.problem_hash,
                        kind="forward_pruned",
                        timestamp=time.time(),
                        parent_id=current_node.node_id,
                        course_id=next_course.id,
                        slot_id=slot.id,
                        room_id=room.id,
                        depth=current_node.depth + 1,
                        rejection_code="future_domain_empty",
                        rejection_reason=f"Causes future course {empty_future_cid} to have 0 valid options",
                    ))
                    active_start = time.perf_counter()
                    continue

                # Compute new g
                inc_cost = compute_incremental_cost(self.norm, candidate_placement, current_node.assigned_placements)
                child_g = current_node.g + inc_cost
                child_f = child_g + h_val

                # Check budget limit for enqueuing
                if (
                    self.metrics.generated_nodes + len(valid_children_to_enqueue) + 1 > self.config.limits.max_generated_nodes
                    or self.metrics.frontier_size + len(valid_children_to_enqueue) + 1 > self.config.limits.max_frontier_nodes
                ):
                    self.metrics.budget_blocked_actions += 1
                    branches_dropped = True
                    break

                child_node = SearchNode(
                    node_id=self._next_node_id(),
                    parent_id=current_node.node_id,
                    depth=current_node.depth + 1,
                    assigned_placements=new_assignments,
                    g=child_g,
                    h=h_val,
                    f=child_f,
                    last_course_id=next_course.id,
                    last_slot_id=slot.id,
                    last_room_id=room.id,
                )
                valid_children_to_enqueue.append(child_node)

            # Enqueue valid children into frontier
            # For DFS: To explore in deterministic order, push onto stack in reverse order!
            if algorithm == "dfs":
                for child in reversed(valid_children_to_enqueue):
                    dfs_stack.append(child)
            elif algorithm == "bfs":
                for child in valid_children_to_enqueue:
                    bfs_queue.append(child)
            elif algorithm == "greedy":
                for child in valid_children_to_enqueue:
                    insertion_seq += 1
                    heapq.heappush(pq, (child.h, -child.depth, insertion_seq, child))
            elif algorithm == "astar":
                for child in valid_children_to_enqueue:
                    insertion_seq += 1
                    heapq.heappush(pq, (child.f, -child.depth, insertion_seq, child))

            # Emit child_enqueued events and update metrics
            for child in valid_children_to_enqueue:
                self.metrics.generated_nodes += 1
                self.metrics.enqueued_actions += 1
                self.metrics.frontier_size += 1
                if self.metrics.frontier_size > self.metrics.peak_frontier_size:
                    self.metrics.peak_frontier_size = self.metrics.frontier_size
                if child.depth > self.metrics.max_depth:
                    self.metrics.max_depth = child.depth

                child_assignments = [
                    {"course_id": p.course_id, "slot_id": p.slot_id, "room_id": p.room_id}
                    for p in child.assigned_placements.values()
                ]

                yield emit(SearchEvent(
                    sequence=self._next_sequence(),
                    run_id=self.run_id,
                    problem_hash=self.norm.problem_hash,
                    kind="child_enqueued",
                    timestamp=time.time(),
                    node_id=child.node_id,
                    parent_id=child.parent_id,
                    course_id=child.last_course_id,
                    slot_id=child.last_slot_id,
                    room_id=child.last_room_id,
                    depth=child.depth,
                    g=child.g,
                    h=child.h,
                    f=child.f,
                    assignments=child_assignments,
                ))
                active_start = time.perf_counter()

            if branches_dropped:
                if algorithm == "astar":
                    terminal_status = "LIMIT_REACHED"
                    terminal_reason = "Frontier or node budget prevented retaining required branch for exact A*"
                    break

        # Finished search loop
        if terminal_status == "INFEASIBLE" and branches_dropped:
            terminal_status = "LIMIT_REACHED"
            terminal_reason = "Resource limit prevented retaining all candidate search branches; problem cannot be proven infeasible."

        final_assignments = None
        if goal_node is not None:
            final_assignments = [
                {"course_id": p.course_id, "slot_id": p.slot_id, "room_id": p.room_id}
                for p in goal_node.assigned_placements.values()
            ]

        yield emit(SearchEvent(
            sequence=self._next_sequence(),
            run_id=self.run_id,
            problem_hash=self.norm.problem_hash,
            kind="run_finished",
            timestamp=time.time(),
            node_id=goal_node.node_id if goal_node else None,
            status=terminal_status,
            rejection_reason=terminal_reason if terminal_status != "SUCCEEDED" else None,
            assignments=final_assignments,
        ))
