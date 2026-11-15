# Independent review and repair

Review this ExamCraft AI implementation against the supplied contracts. Do not assume previous success messages are correct. Start by running the app and reproducing the core flow, then inspect the engine and actual outputs.

Prioritize:

1. All four buttons invoke the claimed frontier policy over the same model. A* uses accrued penalty plus the proved lower bound, tests goals when popped, and preserves its guarantees.
2. An independent validator catches student overlap, room overlap, capacity, actual duration, blackouts, daily limits, missing/duplicate exams, and different slot IDs with overlapping times.
3. Live events and metrics are real. Pause stops computation, Step advances one transition, and Reset/Cancel cannot leak stale events or orphan workers.
4. Resource limits differ from proven infeasibility. Final statuses, optional incumbents, and optimality claims are honest.
5. Setup revisions are immutable. Table/calendar/room views, filters, validation and exports use the intended snapshot.
6. Comparisons use equal configuration and sequential unpaced trials. Failed measurements cannot win or appear as zero penalties.
7. PDF and XLSX are genuine, open correctly, contain the expected rows and metadata, and preserve long/non-ASCII names.

Run the independent fixture verifier against actual application JSON exports. Compare A* against exhaustive tiny minima. Find and fix concrete correctness and integration defects before visual refinements. Keep passing work. Report each material defect with reproduction, change, and observed verification; do not make a generic praise report. Update docs/IMPLEMENTATION_STATUS.md and mark anything you could not test.
