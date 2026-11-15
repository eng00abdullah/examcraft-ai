import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from app.schemas.problem import ProblemDocument, RunConfig, Assignment
from app.domain.normalized import NormalizedProblem
from app.search.engine import SearchEngine
from app.validation.validator import validate_schedule
from app.schemas.runs import RunRecord, ValidationReport
from app.exports.exporter import generate_json_export, generate_xlsx_export, generate_pdf_export


def export_sample(fixture_name: str):
    fixtures_dir = Path(__file__).parent.parent / "fixtures"
    exports_dir = Path(__file__).parent.parent / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    with open(fixtures_dir / f"{fixture_name}.json", "r", encoding="utf-8") as f:
        problem_data = json.load(f)
    problem = ProblemDocument(**problem_data)

    norm = NormalizedProblem(problem)
    cfg = RunConfig(algorithm="astar", teaching_speed_ms=0)
    engine = SearchEngine(norm, cfg, run_id=f"run_{fixture_name}_astar")
    events = list(engine.run())
    final_ev = events[-1]

    assignments = [Assignment(**a) for a in final_ev.assignments]
    val = validate_schedule(problem, assignments)

    record = RunRecord(
        run_id=f"run_{fixture_name}_astar",
        revision_id=f"rev_{fixture_name}",
        problem_hash=norm.problem_hash,
        algorithm="astar",
        status="SUCCEEDED",
        optimality_proven=True,
        config=cfg,
        problem=problem,
        assignments=assignments,
        metrics=final_ev.metrics,
        validation=ValidationReport(**val),
        created_at="2026-11-14T18:00:00Z",
        completed_at="2026-11-14T18:00:01Z",
    )

    # 1. JSON
    json_data = generate_json_export(record)
    with open(exports_dir / f"{fixture_name}_timetable.json", "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2)

    # 2. XLSX
    xlsx_buf = generate_xlsx_export(record)
    with open(exports_dir / f"{fixture_name}_timetable.xlsx", "wb") as f:
        f.write(xlsx_buf.getvalue())

    # 3. PDF
    pdf_buf = generate_pdf_export(record)
    with open(exports_dir / f"{fixture_name}_timetable.pdf", "wb") as f:
        f.write(pdf_buf.getvalue())

    print(f"Generated exports for {fixture_name}: penalty={val['penalty']}, assignments={len(assignments)}")


if __name__ == "__main__":
    export_sample("tiny_feasible")
    export_sample("demo_small")
