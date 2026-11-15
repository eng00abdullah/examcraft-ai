import unittest
import json
import os
import sys
import subprocess
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from app.schemas.problem import ProblemDocument, RunConfig, Assignment
from app.domain.normalized import NormalizedProblem
from app.search.engine import SearchEngine
from app.search.objective import compute_total_penalty, compute_incremental_cost
from app.search.heuristic import compute_heuristic_and_forward_check
from app.validation.validator import validate_schedule
from app.storage.db import (
    init_db,
    save_revision,
    get_revision,
    save_run,
    get_run,
    get_db_connection,
)
from app.runs.manager import RunSession


class GateBTests(unittest.TestCase):
    def setUp(self):
        init_db()
        self.fixtures_dir = Path(__file__).parent.parent / "fixtures"
        with open(self.fixtures_dir / "tiny_feasible.json", "r", encoding="utf-8") as f:
            self.tiny_feasible_data = json.load(f)
        self.tiny_feasible = ProblemDocument(**self.tiny_feasible_data)

    def _run_oracle(self, problem_path: Path, solution_assignments: list) -> dict:
        sol_path = self.fixtures_dir / "solutions" / f"temp_{int(time.time() * 1000)}.json"
        sol_path.parent.mkdir(parents=True, exist_ok=True)
        with open(sol_path, "w", encoding="utf-8") as f:
            json.dump(solution_assignments, f)
        try:
            res = subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).parent.parent / "verification" / "oracle.py"),
                    str(problem_path),
                    "--solution",
                    str(sol_path),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(res.returncode, 0, f"Oracle rejected solution: {res.stderr}\n{res.stdout}")
            return json.loads(res.stdout)
        finally:
            if sol_path.exists():
                sol_path.unlink()

    def test_four_algorithms_on_tiny_feasible(self):
        """
        Verify that:
        - BFS returns valid schedule with penalty 130 (same-day).
        - DFS returns valid schedule with penalty 130 (same-day).
        - Greedy returns valid schedule with penalty 130 (same-day).
        - A* returns optimal schedule with penalty 0 (different days: A=T1, B=T3).
        All solutions must be validated by independent oracle.
        """
        algorithms = ["bfs", "dfs", "greedy", "astar"]
        results = {}

        for alg in algorithms:
            norm = NormalizedProblem(self.tiny_feasible)
            cfg = RunConfig(algorithm=alg, heuristic="admissible", teaching_speed_ms=0)
            engine = SearchEngine(norm, cfg, run_id=f"gate_b_{alg}")
            events = list(engine.run())
            final_ev = events[-1]

            self.assertEqual(final_ev.status, "SUCCEEDED", f"{alg} failed to find solution")
            self.assertIsNotNone(final_ev.assignments)
            self.assertEqual(len(final_ev.assignments), 2)

            # Independent validation
            assignments_objs = [Assignment(**a) for a in final_ev.assignments]
            val = validate_schedule(self.tiny_feasible, assignments_objs)
            self.assertTrue(val["valid"], f"{alg} produced invalid schedule")

            # Acceptance Oracle validation
            oracle_out = self._run_oracle(self.fixtures_dir / "tiny_feasible.json", final_ev.assignments)
            self.assertTrue(oracle_out["valid"])
            self.assertEqual(oracle_out["penalty"], val["penalty"])

            results[alg] = {
                "penalty": val["penalty"],
                "assignments": final_ev.assignments,
                "explored": final_ev.metrics.explored_nodes,
                "generated": final_ev.metrics.generated_nodes,
            }

        # Check penalty distinctions
        self.assertEqual(results["bfs"]["penalty"], 130, "BFS should return penalty 130")
        self.assertEqual(results["dfs"]["penalty"], 130, "DFS should return penalty 130")
        self.assertEqual(results["greedy"]["penalty"], 130, "Greedy should return penalty 130")
        self.assertEqual(results["astar"]["penalty"], 0, "A* must return optimal penalty 0")

        # Verify A* chose different dates
        slots_by_id = {s.id: s for s in self.tiny_feasible.slots}
        astar_slots = [slots_by_id[a["slot_id"]] for a in results["astar"]["assignments"]]
        self.assertNotEqual(astar_slots[0].date, astar_slots[1].date, "A* must place exams on different dates to get penalty 0")

        print("Four algorithms tested on tiny_feasible:")
        for alg, r in results.items():
            print(f"  {alg.upper()}: penalty={r['penalty']}, explored={r['explored']}, generated={r['generated']}")

    def test_all_fixtures_ground_truth(self):
        """Test all standard fixtures against expected ground truth."""
        # 1. tiny_infeasible.json -> Exhaustive INFEASIBLE
        with open(self.fixtures_dir / "tiny_infeasible.json", "r", encoding="utf-8") as f:
            p_inf = ProblemDocument(**json.load(f))
        norm_inf = NormalizedProblem(p_inf)
        engine_inf = SearchEngine(norm_inf, RunConfig(algorithm="astar"), "test_inf")
        events_inf = list(engine_inf.run())
        self.assertEqual(events_inf[-1].status, "INFEASIBLE")

        # 2. capacity_boundary.json -> Feasible, penalty 0 (capacity == student count)
        with open(self.fixtures_dir / "capacity_boundary.json", "r", encoding="utf-8") as f:
            p_cap = ProblemDocument(**json.load(f))
        norm_cap = NormalizedProblem(p_cap)
        engine_cap = SearchEngine(norm_cap, RunConfig(algorithm="astar"), "test_cap")
        events_cap = list(engine_cap.run())
        self.assertEqual(events_cap[-1].status, "SUCCEEDED")
        oracle_cap = self._run_oracle(self.fixtures_dir / "capacity_boundary.json", events_cap[-1].assignments)
        self.assertEqual(oracle_cap["penalty"], 0)

        # 3. overlap_alias.json -> Overlapping different slot IDs handled properly
        with open(self.fixtures_dir / "overlap_alias.json", "r", encoding="utf-8") as f:
            p_alias = ProblemDocument(**json.load(f))
        norm_alias = NormalizedProblem(p_alias)
        engine_alias = SearchEngine(norm_alias, RunConfig(algorithm="astar"), "test_alias")
        events_alias = list(engine_alias.run())
        self.assertEqual(events_alias[-1].status, "SUCCEEDED")
        oracle_alias = self._run_oracle(self.fixtures_dir / "overlap_alias.json", events_alias[-1].assignments)
        self.assertEqual(oracle_alias["penalty"], 130)

        # 4. room_blackout.json -> Room blackout respected
        with open(self.fixtures_dir / "room_blackout.json", "r", encoding="utf-8") as f:
            p_blk = ProblemDocument(**json.load(f))
        norm_blk = NormalizedProblem(p_blk)
        engine_blk = SearchEngine(norm_blk, RunConfig(algorithm="astar"), "test_blk")
        events_blk = list(engine_blk.run())
        self.assertEqual(events_blk[-1].status, "SUCCEEDED")
        oracle_blk = self._run_oracle(self.fixtures_dir / "room_blackout.json", events_blk[-1].assignments)
        self.assertEqual(oracle_blk["penalty"], 0)

        # 5. demo_small.json -> 4-course demo with valid penalty 200
        with open(self.fixtures_dir / "demo_small.json", "r", encoding="utf-8") as f:
            p_demo = ProblemDocument(**json.load(f))
        norm_demo = NormalizedProblem(p_demo)
        engine_demo = SearchEngine(norm_demo, RunConfig(algorithm="astar"), "test_demo")
        events_demo = list(engine_demo.run())
        self.assertEqual(events_demo[-1].status, "SUCCEEDED")
        val_demo = validate_schedule(p_demo, [Assignment(**a) for a in events_demo[-1].assignments])
        self.assertTrue(val_demo["valid"])
        self.assertEqual(val_demo["penalty"], 200)

        print("All 5 ground truth fixtures verified successfully!")

    def test_heuristic_admissibility_and_consistency(self):
        """
        Verify:
        - h(goal) == 0
        - For every enumerated partial state S:
          h(S) <= true optimal completion cost (admissibility)
        - For every child S':
          h(S) <= c(S, S') + h(S') (consistency)
        - Incremental delta equals full recomputed delta
        """
        norm = NormalizedProblem(self.tiny_feasible)
        all_cids = [c.id for c in norm.ordered_courses]

        # Root state
        h_root, _ = compute_heuristic_and_forward_check(norm, all_cids, {}, "admissible")
        self.assertIsNotNone(h_root)
        self.assertLessEqual(h_root, 0, "Optimal completion is 0, so h(root) must be <= 0")
        self.assertEqual(h_root, 0)

        # Goal state
        h_goal, _ = compute_heuristic_and_forward_check(norm, [], {}, "admissible")
        self.assertEqual(h_goal, 0, "h(goal) must be 0")

        # Test partial states of depth 1 (Course A assigned)
        course_a = norm.ordered_courses[0]
        unassigned_after_a = [norm.ordered_courses[1].id]

        for slot, room in norm.static_base_domains[course_a.id]:
            pA = norm.create_placement(course_a.id, slot.id, room.id)
            partial = {course_a.id: pA}

            h_partial, _ = compute_heuristic_and_forward_check(norm, unassigned_after_a, partial, "admissible")
            self.assertIsNotNone(h_partial)

            # Test incremental cost equality
            inc_cost_a = compute_incremental_cost(norm, pA, {})
            tot_cost_a = compute_total_penalty(norm, partial)
            self.assertEqual(inc_cost_a, tot_cost_a)

            # Consistency from root to partial
            # h(root) <= inc_cost_a + h(partial)
            self.assertLessEqual(h_root, inc_cost_a + h_partial)

            # Now test depth 2 children (Course B assigned)
            course_b = norm.ordered_courses[1]
            for sB, rB in norm.static_base_domains[course_b.id]:
                pB = norm.create_placement(course_b.id, sB.id, rB.id)
                # Check if valid against partial
                from app.search.heuristic import is_action_valid_against_partial
                valid, _, _ = is_action_valid_against_partial(norm, pB, partial)
                if not valid:
                    continue

                full_state = {course_a.id: pA, course_b.id: pB}
                inc_cost_b = compute_incremental_cost(norm, pB, partial)
                tot_full = compute_total_penalty(norm, full_state)
                self.assertEqual(tot_cost_a + inc_cost_b, tot_full, "Incremental cost must equal full recomputed penalty")

                # Consistency check: h(partial) <= inc_cost_b + h(goal)
                self.assertLessEqual(h_partial, inc_cost_b + 0)

        print("Heuristic admissibility and consistency verified over state space!")

    def test_resource_limits_vs_exhaustion(self):
        """
        Verify that a resource limit produces LIMIT_REACHED,
        while exhaustive impossibility produces INFEASIBLE.
        """
        with open(self.fixtures_dir / "demo_small.json", "r", encoding="utf-8") as f:
            p_demo = ProblemDocument(**json.load(f))
        norm_demo = NormalizedProblem(p_demo)

        # Deliberately restrict generated nodes to 2
        cfg_capped = RunConfig(
            algorithm="bfs",
            limits={"max_generated_nodes": 2, "max_expanded_nodes": 1000, "max_frontier_nodes": 1000, "max_search_seconds": 10.0, "max_wall_seconds": 300.0},
        )
        engine_capped = SearchEngine(norm_demo, cfg_capped, "capped_run")
        events_capped = list(engine_capped.run())
        self.assertEqual(events_capped[-1].status, "LIMIT_REACHED", "Capped run must return LIMIT_REACHED")
        self.assertIn("Generated node cap", events_capped[-1].rejection_reason)

        # Infeasible toy
        with open(self.fixtures_dir / "tiny_infeasible.json", "r", encoding="utf-8") as f:
            p_inf = ProblemDocument(**json.load(f))
        norm_inf = NormalizedProblem(p_inf)
        engine_inf = SearchEngine(norm_inf, RunConfig(algorithm="bfs"), "inf_run")
        events_inf = list(engine_inf.run())
        self.assertEqual(events_inf[-1].status, "INFEASIBLE", "Exhaustive failure must return INFEASIBLE")

        print("Distinct statuses for LIMIT_REACHED vs INFEASIBLE verified!")

    def test_controls_pause_step_cancel(self):
        """
        Verify that:
        - Pause freezes worker progression.
        - Step advances exactly one transition.
        - Cancel stops worker cleanly.
        """
        norm = NormalizedProblem(self.tiny_feasible)
        cfg = RunConfig(algorithm="dfs", teaching_speed_ms=50)
        session = RunSession("test_control_run", "rev_test", self.tiny_feasible, cfg)

        import asyncio
        loop = asyncio.new_event_loop()
        session.start(loop)

        time.sleep(0.06)
        # 1. Pause
        last_seq = session.pause()
        self.assertEqual(session.status, "PAUSED")
        time.sleep(0.12)
        # Verify it stays frozen
        self.assertEqual(session.last_sequence, last_seq, "Paused session must not advance sequence")

        # 2. Step forward
        session.step()
        time.sleep(0.1)
        self.assertEqual(session.last_sequence, last_seq + 1, "Step must advance exactly one transition")

        # 3. Cancel
        session.cancel()
        time.sleep(0.1)
        self.assertEqual(session.status, "CANCELLED")

        loop.close()
        print("Pause, Step, and Cancel execution controls verified!")

    def test_revision_immutability_and_restart(self):
        """
        Verify that editing data creates a new revision with new hash,
        and restarting cleanly marks active runs INTERRUPTED.
        """
        # Save rev 1
        save_revision("rev_1", self.tiny_feasible, "hash_1")
        r1 = get_revision("rev_1")
        self.assertEqual(r1["name"], self.tiny_feasible.name)

        # Modify problem data and save as rev 2
        mod_problem = self.tiny_feasible.model_copy(deep=True)
        mod_problem.name = "Modified Exam Problem"
        save_revision("rev_2", mod_problem, "hash_2")

        # Verify rev 1 was not modified
        r1_after = get_revision("rev_1")
        self.assertEqual(r1_after["name"], self.tiny_feasible.name)
        r2 = get_revision("rev_2")
        self.assertEqual(r2["name"], "Modified Exam Problem")

        # Test abandoned run marked INTERRUPTED on init_db()
        conn = get_db_connection()
        conn.execute(
            """
            INSERT OR REPLACE INTO runs (
                run_id, revision_id, problem_hash, algorithm, status, optimality_proven,
                config_json, problem_json, metrics_json, created_at
            ) VALUES ('abandoned_run', 'rev_1', 'hash_1', 'astar', 'RUNNING', 0, '{}', '{}', '{}', '2026-11-14T00:00:00Z')
            """
        )
        conn.commit()
        conn.close()

        # Run init_db (simulating restart)
        init_db()

        abandoned = get_run("abandoned_run")
        self.assertIsNotNone(abandoned)
        self.assertEqual(abandoned.status, "INTERRUPTED")
        self.assertIn("restarted", abandoned.terminal_reason)
        print("Revisions immutability and restart INTERRUPTED cleanup verified!")


if __name__ == "__main__":
    unittest.main()
