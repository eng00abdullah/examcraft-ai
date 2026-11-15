# Evidence index

These are baseline observations against the uploaded application, before any application repair. Timing values are observations from the review environment, not universal benchmark results.

| File | Evidence |
| --- | --- |
| review_metadata.json | Source ZIP SHA-256, scope, counts, and explicit browser/runtime limitations |
| original_oracle_suite.txt | 15 original oracle tests passed |
| original_application_suite.txt | 12 original application tests passed |
| independent_combined_regression_baseline.txt | Root reviewer execution: 12 methods, 1 pass, 11 failed methods, 13 failure records |
| portable_runner_baseline.txt | The portable runner reproduces the same failures |
| engine_regression_baseline.txt | Component execution of seven engine regression methods |
| lifecycle_regression_baseline.txt | Component execution of five lifecycle regression methods |
| engine_findings.json | Exact engine inputs/results, oracle outcomes, and cap/timezone/schema probes |
| uncapped_tiny_crosscheck.json | Forty bounded uncapped A* observations; not a general proof |
| session_results.json | Teaching-time contamination, paused deadline, missing active persistence, stale final timings |
| finalization_results.json | False optimality and publication-before-finalization observations |
| pause_finish_race_results.json | Dead worker with PAUSED state and blocked next admission |
| api_results.json | Client-error, comparison scheduling/config, and repeated-step probes |
| export_inspection.json | Extracted supplied PDF text and supplied XLSX date/time types |
| export_text_probes.json | Actual ReportLab literal-text handling and available font/shaping state |
| runtime_versions.json | Installed review library versions |

The source audit and browser acceptance instructions distinguish executed behavior from source-only findings. Logs contain the review machine's original paths as provenance; runnable code uses EXAMCRAFT_PROJECT_ROOT and does not depend on those paths.
