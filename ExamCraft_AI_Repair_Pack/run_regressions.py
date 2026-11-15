#!/usr/bin/env python3
"""Run the pack's desired-behavior tests against an existing ExamCraft checkout."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main() -> int:
    pack = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project-root",
        type=Path,
        default=pack.parent,
        help="ExamCraft checkout containing apps/api/app and verification/oracle.py",
    )
    args = parser.parse_args()
    project = args.project_root.expanduser().resolve()
    required = (
        project / "apps" / "api" / "app" / "search" / "engine.py",
        project / "verification" / "oracle.py",
        project / "fixtures" / "tiny_feasible.json",
    )
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        parser.error("Cannot locate the expected application files: " + ", ".join(missing))
    environment = os.environ.copy()
    environment["EXAMCRAFT_PROJECT_ROOT"] = str(project)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    print(f"Testing existing project: {project}", flush=True)
    print(
        "These tests assert correct behavior. Failure is expected on the reviewed baseline.",
        flush=True,
    )
    with tempfile.TemporaryDirectory(prefix="examcraft-review-runner-") as directory:
        result = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", str(pack / "tests"), "-v"],
            env=environment,
            cwd=directory,
            check=False,
        )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
