"""Portable desired-behavior regressions for ExamCraft AI.

Use EXAMCRAFT_PROJECT_ROOT to point to the application repository. If it is
unset, this pack is expected at <project>/review_fixpack (any one-level pack
folder name works). These tests assert correct behavior: several intentionally
fail on the reviewed build. They never modify application source or fixtures.
"""
from __future__ import annotations

from copy import deepcopy
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest


PACK_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(os.environ.get(
    "EXAMCRAFT_PROJECT_ROOT", str(PACK_ROOT.parent)
)).expanduser().resolve()
API_ROOT = PROJECT_ROOT / "apps" / "api"
ORACLE_PATH = PROJECT_ROOT / "verification" / "oracle.py"
if not (API_ROOT / "app" / "search" / "engine.py").is_file() or not ORACLE_PATH.is_file():
    raise RuntimeError(
        "Cannot locate the ExamCraft application and independent oracle. "
        "Set EXAMCRAFT_PROJECT_ROOT to the application repository, or extract "
        "this pack as <project>/review_fixpack."
    )
sys.path.insert(0, str(API_ROOT))

from pydantic import ValidationError
from app.schemas.problem import Assignment, ProblemDocument, RunConfig, RunLimits
from app.domain.normalized import NormalizedProblem, validate_problem_structural
from app.search.engine import SearchEngine
from app.validation.validator import validate_schedule


oracle_spec = importlib.util.spec_from_file_location("examcraft_audit_oracle", ORACLE_PATH)
if oracle_spec is None or oracle_spec.loader is None:
    raise RuntimeError(f"Cannot load independent oracle: {ORACLE_PATH}")
oracle = importlib.util.module_from_spec(oracle_spec)
oracle_spec.loader.exec_module(oracle)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


class EngineRegressionTests(unittest.TestCase):
    """Seven focused cases; these are not the application's entire test suite."""

    def setUp(self):
        self.tiny = read_json(PROJECT_ROOT / "fixtures" / "tiny_feasible.json")

    def run_engine(self, problem_data: dict, **limits):
        model = ProblemDocument(**problem_data)
        errors = validate_problem_structural(model)
        self.assertFalse(errors, f"Regression fixture must be structurally valid: {errors}")
        config = RunConfig(algorithm="astar", limits=RunLimits(**limits))
        events = list(SearchEngine(NormalizedProblem(model), config, "regression").run())
        self.assertTrue(events, "Engine must emit an outcome")
        return events

    def test_uncapped_astar_matches_independent_zero_optimum(self):
        truth = oracle.brute_force(self.tiny)
        self.assertEqual(truth["status"], "OPTIMAL")
        self.assertEqual(truth["optimal_penalty"], 0)
        final = self.run_engine(self.tiny)[-1]
        self.assertEqual(final.status, "SUCCEEDED")
        checked = oracle.verify(self.tiny, final.assignments)
        self.assertTrue(checked["valid"], checked)
        self.assertEqual(checked["penalty"], truth["optimal_penalty"])

    def test_frontier_cap_cannot_return_a_suboptimal_exact_astar_success(self):
        truth = oracle.brute_force(self.tiny)
        self.assertEqual(truth["optimal_penalty"], 0)
        final = self.run_engine(self.tiny, max_frontier_nodes=1)[-1]
        # Conservative exact-search behavior is LIMIT_REACHED. If an improved
        # implementation still succeeds within this cap, its exact A* result
        # must retain the optimality guarantee and match independent truth.
        self.assertIn(final.status, ("LIMIT_REACHED", "SUCCEEDED"))
        if final.status == "SUCCEEDED":
            checked = oracle.verify(self.tiny, final.assignments)
            self.assertTrue(checked["valid"], checked)
            self.assertEqual(
                checked["penalty"], truth["optimal_penalty"],
                "Discarding frontier branches must not produce an exact A* success",
            )

    def test_frontier_cap_cannot_prove_a_feasible_problem_infeasible(self):
        problem = read_json(PACK_ROOT / "fixtures" / "false_infeasible_frontier.json")
        truth = oracle.brute_force(problem)
        self.assertEqual(truth["status"], "OPTIMAL")
        self.assertEqual(truth["optimal_penalty"], 130)
        final = self.run_engine(problem, max_frontier_nodes=1)[-1]
        self.assertIn(
            final.status, ("LIMIT_REACHED", "SUCCEEDED"),
            "A dropped unexplored branch does not establish global infeasibility",
        )
        if final.status == "SUCCEEDED":
            self.assertTrue(oracle.verify(problem, final.assignments)["valid"])

    def test_generated_node_budget_is_never_exceeded(self):
        cap = 2
        events = self.run_engine(self.tiny, max_generated_nodes=cap)
        for event in events:
            if event.metrics is not None:
                self.assertLessEqual(
                    event.metrics.generated_nodes, cap,
                    "Buffered children must consume generation budget before allocation",
                )
        self.assertEqual(events[-1].status, "LIMIT_REACHED")

    def test_already_generated_goal_does_not_consume_another_expansion(self):
        # Exactly one expansion creates exactly one goal: 2 generated nodes,
        # 1 expanded node, 2 explored nodes. Both exact budget boundaries fit.
        problem = deepcopy(self.tiny)
        first_course = problem["courses"][0]["id"]
        problem["courses"] = problem["courses"][:1]
        problem["slots"] = problem["slots"][:1]
        problem["enrollments"] = [
            e for e in problem["enrollments"] if e["course_id"] == first_course
        ]
        for limits in ({"max_generated_nodes": 2}, {"max_expanded_nodes": 1}):
            with self.subTest(limits=limits):
                final = self.run_engine(problem, **limits)[-1]
                self.assertEqual(final.status, "SUCCEEDED")
                self.assertEqual(final.metrics.generated_nodes, 2)
                self.assertEqual(final.metrics.expanded_nodes, 1)
                self.assertTrue(oracle.verify(problem, final.assignments)["valid"])

    def test_dst_elapsed_break_is_checked_independently_and_by_engine(self):
        problem = read_json(PACK_ROOT / "fixtures" / "dst_gap_invalid_solution.json")
        assignments = [
            {"course_id": "A", "slot_id": "BEFORE", "room_id": "R1"},
            {"course_id": "B", "slot_id": "AFTER", "room_id": "R1"},
        ]
        independent = oracle.verify(problem, assignments)
        self.assertFalse(independent["valid"])
        self.assertIn("minimum_gap", {v["code"] for v in independent["violations"]})
        # Both endpoints are valid local times, but the change in UTC offset
        # leaves only a 30-minute actual break, below the required 60 minutes.
        with self.subTest(component="complete_validator"):
            model = ProblemDocument(**problem)
            checked = validate_schedule(model, [Assignment(**a) for a in assignments])
            self.assertFalse(checked["valid"], "UTC elapsed break must govern validity")
        with self.subTest(component="search_engine"):
            final = self.run_engine(problem)[-1]
            self.assertEqual(final.status, "INFEASIBLE")

    def test_boolean_room_capacity_is_rejected_without_coercion(self):
        problem = deepcopy(self.tiny)
        problem["rooms"][0]["capacity"] = True
        try:
            model = ProblemDocument(**problem)
        except ValidationError:
            return  # Strict schema rejection is the preferred behavior.
        self.assertTrue(
            validate_problem_structural(model),
            "Boolean capacity must not be silently converted to integer 1",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
