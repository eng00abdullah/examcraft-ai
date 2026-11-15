"""Run with: python -m unittest discover -s verification -v"""

from copy import deepcopy
import json
from pathlib import Path
import unittest

from oracle import brute_force, verify


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def read(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class IndependentOracleTests(unittest.TestCase):
    def test_fixture_expectations(self):
        for case in read("expectations.json")["cases"]:
            with self.subTest(problem=case["problem"]):
                problem = read(case["problem"])
                if case["oracle_status"] != "SKIP_MORE_THAN_THREE_COURSES":
                    result = brute_force(problem)
                    self.assertEqual(result["status"], case["oracle_status"])
                    if "optimal_penalty" in case:
                        self.assertEqual(result["optimal_penalty"], case["optimal_penalty"])
                    if "feasible_count" in case:
                        self.assertEqual(result["feasible_count"], case["feasible_count"])
                for solution in case.get("valid_solutions", []):
                    result = verify(problem, read(solution["file"])["assignments"])
                    self.assertTrue(result["valid"], result)
                    self.assertEqual(result["penalty"], solution["penalty"])
                for solution in case.get("invalid_solutions", []):
                    result = verify(problem, read(solution["file"])["assignments"])
                    self.assertFalse(result["valid"])
                    self.assertIsNone(result["penalty"])
                    self.assertIn(solution["required_violation"], {v["code"] for v in result["violations"]})

    def setUp(self):
        self.problem = read("tiny_feasible.json")
        self.solution = read("solutions/tiny_feasible_penalty_130.json")["assignments"]

    def codes(self, problem=None, assignments=None):
        result = verify(self.problem if problem is None else problem,
                        self.solution if assignments is None else assignments)
        self.assertFalse(result["valid"])
        return {violation["code"] for violation in result["violations"]}

    def test_room_overlap_without_shared_students(self):
        problem = deepcopy(self.problem)
        problem["students"].append({"id": "S2"})
        problem["enrollments"][1]["student_id"] = "S2"
        solution = deepcopy(self.solution)
        solution[1]["slot_id"] = "T1"
        codes = self.codes(problem, solution)
        self.assertIn("room_overlap", codes)
        self.assertNotIn("student_overlap", codes)

    def test_duplicate_or_missing_course_is_not_complete(self):
        self.assertIn("assignment_count", self.codes(assignments=self.solution[:1]))
        self.assertIn("assignment_count", self.codes(assignments=self.solution + self.solution[:1]))

    def test_duplicate_enrollment_and_unknown_reference(self):
        problem = deepcopy(self.problem)
        problem["enrollments"].append(problem["enrollments"][0])
        self.assertIn("duplicate_enrollment", self.codes(problem))
        problem = deepcopy(self.problem)
        problem["enrollments"][0]["course_id"] = "UNKNOWN"
        self.assertIn("enrollment_reference", self.codes(problem))

    def test_unknown_assignment_is_invalid(self):
        solution = deepcopy(self.solution)
        solution[0]["room_id"] = "UNKNOWN"
        self.assertIn("assignment_reference", self.codes(assignments=solution))

    def test_hard_daily_limit_differs_from_soft_penalty(self):
        problem = deepcopy(self.problem)
        problem["constraints"]["max_exams_per_student_per_day"] = 1
        self.assertIn("maximum_per_day", self.codes(problem))
        optimal = read("solutions/tiny_feasible_optimal.json")["assignments"]
        self.assertTrue(verify(problem, optimal)["valid"])

    def test_minimum_hard_break(self):
        problem = deepcopy(self.problem)
        problem["constraints"]["minimum_gap_minutes"] = 1
        self.assertIn("minimum_gap", self.codes(problem))

    def test_short_gap_threshold_is_strict(self):
        problem = deepcopy(self.problem)
        problem["slots"][1].update(start_time="11:00", end_time="12:00")
        result = verify(problem, self.solution)
        self.assertTrue(result["valid"])
        self.assertEqual(result["penalty"], 100)
        self.assertEqual(result["breakdown"]["short_gap_student_pairs"], 0)

    def test_room_spare_seats_have_separate_penalty(self):
        problem = deepcopy(self.problem)
        problem["rooms"][0]["capacity"] = 3
        result = verify(problem, self.solution)
        self.assertTrue(result["valid"])
        self.assertEqual(result["penalty"], 134)
        self.assertEqual(result["breakdown"]["spare_seats"], 4)

    def test_duration_and_allowlist(self):
        problem = deepcopy(self.problem)
        problem["courses"][0]["duration_minutes"] = 61
        self.assertIn("duration", self.codes(problem))
        problem = deepcopy(self.problem)
        problem["courses"][0]["allowed_slot_ids"] = ["T3"]
        self.assertIn("course_unavailable", self.codes(problem))
        problem["courses"][0]["allowed_slot_ids"] = []
        self.assertEqual(brute_force(problem)["status"], "INFEASIBLE")

    def test_oracle_limits_are_enforced(self):
        with self.assertRaisesRegex(ValueError, "three courses"):
            brute_force(read("demo_small.json"))
        with self.assertRaisesRegex(ValueError, "budget"):
            brute_force(self.problem, max_candidates=1)

    def test_negative_weight_and_boolean_capacity_rejected(self):
        problem = deepcopy(self.problem)
        problem["objective"]["same_day_weight"] = -1
        self.assertIn("objective_weight", self.codes(problem))
        problem = deepcopy(self.problem)
        problem["rooms"][0]["capacity"] = True
        self.assertIn("capacity", self.codes(problem))

    def test_empty_domains_are_infeasible_but_empty_courses_are_not_runnable(self):
        for kind in ("rooms", "slots"):
            with self.subTest(empty=kind):
                problem = deepcopy(self.problem)
                problem[kind] = []
                result = brute_force(problem)
                self.assertEqual(result["status"], "INFEASIBLE")
                self.assertEqual(result["candidate_count"], 0)
                self.assertEqual(self.codes(problem, []), {"assignment_count"})
        problem = deepcopy(self.problem)
        problem["courses"] = []
        problem["enrollments"] = []
        result = brute_force(problem)
        self.assertEqual(result["status"], "INVALID_INPUT")
        self.assertIn("empty_courses", {v["code"] for v in result["violations"]})

    def test_course_codes_are_trimmed_case_insensitive_and_nonblank(self):
        problem = deepcopy(self.problem)
        problem["courses"][0]["code"] = " Ai101 "
        problem["courses"][1]["code"] = "ai101"
        self.assertIn("duplicate_course_code", self.codes(problem))
        problem = deepcopy(self.problem)
        problem["courses"][0]["code"] = " \t "
        self.assertIn("course_code", self.codes(problem))

    def test_required_names_and_problem_metadata_are_nonblank(self):
        for kind, code in (("courses", "course_name"), ("rooms", "room_name")):
            for value in (None, "", " \t "):
                with self.subTest(collection=kind, value=value):
                    problem = deepcopy(self.problem)
                    problem[kind][0]["name"] = value
                    self.assertIn(code, self.codes(problem))
        for key in ("id", "name"):
            problem = deepcopy(self.problem)
            problem[key] = " "
            self.assertIn("problem_metadata", self.codes(problem))


if __name__ == "__main__":
    unittest.main()
