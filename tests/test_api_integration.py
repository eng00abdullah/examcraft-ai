import unittest
import json
import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))
from app.main import app


class ApiIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        fixtures_dir = Path(__file__).parent.parent / "fixtures"
        with open(fixtures_dir / "tiny_feasible.json", "r", encoding="utf-8") as f:
            self.tiny_feasible = json.load(f)

    def test_health_check(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "ExamCraft AI")

    def test_problem_create_and_run_lifecycle(self):
        # 1. Validate problem
        val_resp = self.client.post("/api/problems/validate", json=self.tiny_feasible)
        self.assertEqual(val_resp.status_code, 200)
        self.assertTrue(val_resp.json()["valid"])

        # 2. Save revision
        rev_resp = self.client.post("/api/problems", json=self.tiny_feasible)
        self.assertEqual(rev_resp.status_code, 200)
        rev_data = rev_resp.json()
        rev_id = rev_data["revision_id"]
        self.assertTrue(rev_id.startswith("rev_"))

        # 3. Start a DFS run
        run_resp = self.client.post("/api/runs", json={
            "revision_id": rev_id,
            "config": {
                "algorithm": "dfs",
                "teaching_speed_ms": 0,
            }
        })
        self.assertEqual(run_resp.status_code, 200)
        run_data = run_resp.json()
        run_id = run_data["run_id"]
        self.assertTrue(run_id.startswith("run_"))

        # Wait briefly for worker thread to finish
        import time
        for _ in range(50):
            time.sleep(0.05)
            status_resp = self.client.get(f"/api/runs/{run_id}")
            self.assertEqual(status_resp.status_code, 200)
            status_data = status_resp.json()
            if status_data["status"] in ("SUCCEEDED", "INFEASIBLE", "LIMIT_REACHED", "ERROR"):
                break

        self.assertEqual(status_data["status"], "SUCCEEDED")
        self.assertIsNotNone(status_data["assignments"])
        self.assertEqual(len(status_data["assignments"]), 2)
        self.assertTrue(status_data["validation"]["valid"])
        self.assertEqual(status_data["validation"]["penalty"], 130)

        # 4. Test re-validation endpoint
        reval_resp = self.client.post(f"/api/runs/{run_id}/validate")
        self.assertEqual(reval_resp.status_code, 200)
        self.assertTrue(reval_resp.json()["valid"])

        # 5. Test JSON export
        exp_json = self.client.get(f"/api/runs/{run_id}/export?format=json")
        self.assertEqual(exp_json.status_code, 200)
        exp_json_data = exp_json.json()
        self.assertEqual(exp_json_data["status"], "SUCCEEDED")

        # 6. Test XLSX export
        exp_xlsx = self.client.get(f"/api/runs/{run_id}/export?format=xlsx")
        self.assertEqual(exp_xlsx.status_code, 200)
        self.assertEqual(exp_xlsx.headers["content-type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertGreater(len(exp_xlsx.content), 1000)

        # 7. Test PDF export
        exp_pdf = self.client.get(f"/api/runs/{run_id}/export?format=pdf")
        self.assertEqual(exp_pdf.status_code, 200)
        self.assertEqual(exp_pdf.headers["content-type"], "application/pdf")
        self.assertTrue(exp_pdf.content.startswith(b"%PDF"))
        self.assertGreater(len(exp_pdf.content), 1000)

        # 8. Test SSE events stream
        sse_resp = self.client.get(f"/api/runs/{run_id}/events")
        self.assertEqual(sse_resp.status_code, 200)
        self.assertIn("text/event-stream", sse_resp.headers["content-type"])
        self.assertIn("event: run_finished", sse_resp.text)

        print("Full API Integration test passed successfully!")


if __name__ == "__main__":
    unittest.main()
