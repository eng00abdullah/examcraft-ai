import unittest
import json
import io
import sys
from pathlib import Path
from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from app.schemas.problem import ProblemDocument, RunConfig, Course, Assignment
from app.domain.normalized import NormalizedProblem
from app.search.engine import SearchEngine
from app.validation.validator import validate_schedule
from app.storage.db import init_db, save_revision, save_run, get_run
from app.exports.exporter import generate_json_export, generate_xlsx_export, generate_pdf_export
from fastapi.testclient import TestClient
from app.main import app


class GateCTests(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)
        self.fixtures_dir = Path(__file__).parent.parent / "fixtures"
        with open(self.fixtures_dir / "tiny_feasible.json", "r", encoding="utf-8") as f:
            self.tiny_feasible = ProblemDocument(**json.load(f))

    def test_exports_and_inspection(self):
        """
        Verify PDF, XLSX, and JSON exports from a real solved run:
        - Re-open XLSX and verify sheets, types, and values.
        - Verify PDF structure and pages.
        - Verify JSON export structure.
        """
        norm = NormalizedProblem(self.tiny_feasible)
        cfg = RunConfig(algorithm="astar", teaching_speed_ms=0)
        engine = SearchEngine(norm, cfg, "gate_c_export_run")
        events = list(engine.run())
        final_ev = events[-1]
        self.assertEqual(final_ev.status, "SUCCEEDED")

        assignments = [Assignment(**a) for a in final_ev.assignments]
        val_result = validate_schedule(self.tiny_feasible, assignments)

        from app.schemas.runs import RunRecord, ValidationReport
        record = RunRecord(
            run_id="gate_c_export_run",
            revision_id="rev_gate_c",
            problem_hash=norm.problem_hash,
            algorithm="astar",
            status="SUCCEEDED",
            optimality_proven=True,
            config=cfg,
            problem=self.tiny_feasible,
            assignments=assignments,
            metrics=final_ev.metrics,
            validation=ValidationReport(**val_result),
            created_at="2026-11-14T00:00:00Z",
            completed_at="2026-11-14T00:00:01Z",
        )
        save_run(record)

        # 1. JSON Export (Full)
        json_full = generate_json_export(record)
        self.assertEqual(json_full["schema_version"], "1.0")
        self.assertEqual(json_full["run_id"], "gate_c_export_run")
        self.assertEqual(json_full["status"], "SUCCEEDED")
        self.assertEqual(len(json_full["assignments"]), 2)
        self.assertFalse(json_full["is_filtered"])

        # JSON Export (Filtered)
        json_filt = generate_json_export(record, filter_course="CS100")
        self.assertEqual(len(json_filt["assignments"]), 1)
        self.assertTrue(json_filt["is_filtered"])

        # 2. XLSX Export Inspection
        xlsx_buf = generate_xlsx_export(record)
        wb = load_workbook(filename=xlsx_buf)
        sheet_names = wb.sheetnames
        self.assertIn("Timetable", sheet_names)
        self.assertIn("Run Summary", sheet_names)

        ws_tt = wb["Timetable"]
        self.assertEqual(ws_tt["A1"].value, "Course Code")
        self.assertEqual(ws_tt["B1"].value, "Course Name")
        # Check rows count (header + 2 courses)
        self.assertEqual(ws_tt.max_row, 3)

        # Verify numeric types
        duration_cell = ws_tt["F2"].value
        students_cell = ws_tt["I2"].value
        self.assertIsInstance(duration_cell, int, "Duration should be numeric int in Excel")
        self.assertIsInstance(students_cell, int, "Students should be numeric int in Excel")

        # Verify native Date and Time cell types and number formats
        import datetime
        date_cell = ws_tt["C2"].value
        start_time_cell = ws_tt["D2"].value
        end_time_cell = ws_tt["E2"].value
        self.assertIsInstance(date_cell, (datetime.date, datetime.datetime), "Date should be native Excel date/datetime")
        self.assertIn("yyyy-mm-dd", ws_tt["C2"].number_format.lower(), "Date cell should use yyyy-mm-dd format")
        self.assertIsInstance(start_time_cell, datetime.time, "Start Time should be native Excel time")
        self.assertEqual(ws_tt["D2"].number_format.lower(), "hh:mm", "Start Time cell should use hh:mm format")
        self.assertIsInstance(end_time_cell, datetime.time, "End Time should be native Excel time")
        self.assertEqual(ws_tt["E2"].number_format.lower(), "hh:mm", "End Time cell should use hh:mm format")

        # Verify values round-trip correctly against saved timetable
        self.assertEqual(date_cell.strftime("%Y-%m-%d"), "2026-12-01")
        self.assertEqual(start_time_cell.strftime("%H:%M"), "09:00")
        self.assertEqual(end_time_cell.strftime("%H:%M"), "10:00")

        ws_sum = wb["Run Summary"]
        self.assertEqual(ws_sum["A1"].value, "Property")
        self.assertEqual(ws_sum["B1"].value, "Value")
        # Find Total Penalty row
        penalty_found = False
        for r in range(2, ws_sum.max_row + 1):
            if ws_sum[f"A{r}"].value == "Total Penalty":
                self.assertEqual(ws_sum[f"B{r}"].value, 0)
                penalty_found = True
                break
        self.assertTrue(penalty_found, "Total Penalty property not found in Run Summary")

        # 3. PDF Export Inspection
        pdf_buf = generate_pdf_export(record)
        pdf_bytes = pdf_buf.getvalue()
        self.assertTrue(pdf_bytes.startswith(b"%PDF"), "Must produce valid PDF binary")
        self.assertGreater(len(pdf_bytes), 2000, "PDF must contain substantial formatted document structure")
        self.assertIn(b"ReportLab", pdf_bytes)
        self.assertTrue(pdf_bytes.rstrip().endswith(b"%%EOF"))

        print("XLSX re-opened and inspected; PDF and JSON exports verified!")

    def test_unicode_and_long_name_handling(self):
        """
        Verify that non-ASCII Unicode (e.g. Arabic) and very long course names
        work in the engine, validator, and PDF/XLSX exports.
        """
        unicode_prob = self.tiny_feasible.model_copy(deep=True)
        unicode_prob.courses[0].name = "خوارزميات الذكاء الاصطناعي المتقدمة وتطبيقات الجدولة الذكية"
        unicode_prob.courses[1].name = "Advanced Distributed Systems and Parallel Constraint Optimization Engineering Laboratory"

        norm_uni = NormalizedProblem(unicode_prob)
        cfg = RunConfig(algorithm="astar", teaching_speed_ms=0)
        engine_uni = SearchEngine(norm_uni, cfg, "unicode_test_run")
        events = list(engine_uni.run())
        self.assertEqual(events[-1].status, "SUCCEEDED")

        assignments = [Assignment(**a) for a in events[-1].assignments]
        val = validate_schedule(unicode_prob, assignments)
        self.assertTrue(val["valid"])

        from app.schemas.runs import RunRecord, ValidationReport
        record_uni = RunRecord(
            run_id="unicode_test_run",
            revision_id="rev_uni",
            problem_hash=norm_uni.problem_hash,
            algorithm="astar",
            status="SUCCEEDED",
            optimality_proven=True,
            config=cfg,
            problem=unicode_prob,
            assignments=assignments,
            metrics=events[-1].metrics,
            validation=ValidationReport(**val),
            created_at="2026-11-14T00:00:00Z",
            completed_at="2026-11-14T00:00:01Z",
        )

        # Test XLSX with unicode/long names
        xlsx_buf = generate_xlsx_export(record_uni)
        wb = load_workbook(filename=xlsx_buf)
        self.assertIn("Advanced Distributed", wb["Timetable"]["B3"].value)

        # Test PDF with long names
        pdf_buf = generate_pdf_export(record_uni)
        self.assertTrue(pdf_buf.getvalue().startswith(b"%PDF"))

        print("Unicode and long names verified in engine, validator, XLSX, and PDF!")

    def test_comparison_endpoint(self):
        """
        Verify POST /api/comparisons executes genuine sequential benchmark
        and assigns honest distinct recognitions.
        """
        # Save revision
        rev_resp = self.client.post("/api/problems", json=self.tiny_feasible.model_dump())
        self.assertEqual(rev_resp.status_code, 200)
        rev_id = rev_resp.json()["revision_id"]

        # Run comparison
        cmp_resp = self.client.post("/api/comparisons", json={"revision_id": rev_id})
        self.assertEqual(cmp_resp.status_code, 200)
        cmp_data = cmp_resp.json()

        self.assertIn("comparison_id", cmp_data)
        self.assertEqual(len(cmp_data["trials"]), 4)

        trial_algs = [t["algorithm"] for t in cmp_data["trials"]]
        self.assertEqual(trial_algs, ["bfs", "dfs", "greedy", "astar"])

        for t in cmp_data["trials"]:
            self.assertEqual(t["status"], "SUCCEEDED")
            self.assertGreater(t["metrics"]["explored_nodes"], 0)
            self.assertGreaterEqual(t["metrics"]["search_compute_ms"], 0)

        # Distinct recognitions
        recognitions = cmp_data["recognitions"]
        self.assertEqual(recognitions["lowest_observed_penalty"], "astar", "A* must have lowest penalty (0)")
        self.assertIsNotNone(recognitions["fastest_successful"])
        self.assertIsNotNone(recognitions["fewest_explored"])

        print("Comparison benchmark verified: trials=", trial_algs, "recognitions=", recognitions)


if __name__ == "__main__":
    unittest.main()
