import unittest
import json
import os
import subprocess
import sys
from pathlib import Path

# Add apps/api to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from app.schemas.problem import ProblemDocument, RunConfig, Assignment
from app.domain.normalized import NormalizedProblem
from app.search.engine import SearchEngine
from app.validation.validator import validate_schedule


class GateATests(unittest.TestCase):
    def setUp(self):
        self.fixtures_dir = Path(__file__).parent.parent / "fixtures"
        with open(self.fixtures_dir / "tiny_feasible.json", "r", encoding="utf-8") as f:
            self.problem_data = json.load(f)
        self.problem = ProblemDocument(**self.problem_data)

    def test_gate_a_dfs_slice(self):
        norm = NormalizedProblem(self.problem)
        config = RunConfig(algorithm="dfs")
        engine = SearchEngine(norm, config, run_id="gate_a_test_run")

        events = list(engine.run())
        self.assertGreater(len(events), 3)

        kinds = [e.kind for e in events]
        self.assertIn("run_started", kinds)
        self.assertIn("node_popped", kinds)
        self.assertIn("child_enqueued", kinds)
        self.assertIn("goal_found", kinds)
        self.assertIn("run_finished", kinds)

        # Check for visible rejected action with reason
        rejected_events = [e for e in events if e.kind == "action_rejected"]
        self.assertGreater(len(rejected_events), 0, "DFS should encounter rejected actions on tiny_feasible")
        first_rejection = rejected_events[0]
        self.assertIsNotNone(first_rejection.rejection_code)
        self.assertIsNotNone(first_rejection.rejection_reason)
        print(f"Observed rejected action: code={first_rejection.rejection_code}, reason={first_rejection.rejection_reason}")

        # Terminal event
        terminal = events[-1]
        self.assertEqual(terminal.status, "SUCCEEDED")
        self.assertIsNotNone(terminal.assignments)
        self.assertEqual(len(terminal.assignments), 2)
        print("Generated assignments:", terminal.assignments)

        # Validate with independent validator
        assignments_objs = [Assignment(**a) for a in terminal.assignments]
        val_result = validate_schedule(self.problem, assignments_objs)
        self.assertTrue(val_result["valid"], val_result)
        self.assertIsNotNone(val_result["penalty"])
        print(f"Independent validator passed with penalty: {val_result['penalty']}")

        # Save solution to temp file and test with independent acceptance oracle CLI
        temp_solution_path = self.fixtures_dir / "solutions" / "gate_a_solution.json"
        temp_solution_path.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_solution_path, "w", encoding="utf-8") as f:
            json.dump(terminal.assignments, f, indent=2)

        # Run verification/oracle.py CLI
        res = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).parent.parent / "verification" / "oracle.py"),
                str(self.fixtures_dir / "tiny_feasible.json"),
                "--solution",
                str(temp_solution_path),
            ],
            capture_output=True,
            text=True,
        )
        print("Oracle stdout:\n", res.stdout)
        if res.stderr:
            print("Oracle stderr:\n", res.stderr)
        self.assertEqual(res.returncode, 0, f"Oracle failed: {res.stderr}")
        oracle_out = json.loads(res.stdout)
        self.assertTrue(oracle_out["valid"])


if __name__ == "__main__":
    unittest.main()
