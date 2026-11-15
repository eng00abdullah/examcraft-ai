# ExamCraft AI — Live Demonstration Script (3–5 Minutes)

This script guides an academic presentation or QA walk-through of ExamCraft AI. All demonstrated actions run against the live system without fabricated metrics or pre-recorded answers.

---

## 1. Introduction & Problem Domain (45 seconds)
1. **Open the Application**: Navigate to `http://127.0.0.1:8000/` in any standard web browser.
2. **Review Headline & Product Story**:
   - Point out the headline: *"Build a valid exam timetable. Understand every decision."*
   - Highlight the concrete visual example: Course `CS100` and Course `CS101` sharing Student `S1` cannot be assigned to overlapping intervals `[09:00, 10:00)`.
   - Explain the 8 hard constraints: no duplicate course assignment, room capacity $\ge$ enrolled students, half-open slot intervals $[start, end)$, exclusive room occupancy, shared student non-overlap, room blackouts, max daily exams, and hard minimum rest gaps.
   - Explain the non-negative preference objective: same-day student pairs ($w=100$), short rest gaps $< 60$ minutes ($w=30$), and spare room capacity ($w=1$).

---

## 2. Problem Setup & Immutable Revisions (45 seconds)
1. **Navigate to "Setup"**: Click the **Setup** tab in the top navigation bar.
2. **Inspect Guided Collections**:
   - Show the **Courses** tab (with course codes, durations, allowed slots).
   - Show the **Students & Enrollments** matrix: student counts and conflict-graph degrees are strictly derived from enrollment records.
   - Show the **Rooms & Blackouts** tab (hall capacities, unavailable maintenance intervals).
   - Show the **Dates & Slots** tab (real ISO dates and half-open time windows).
   - Show the **Constraints & Preferences** tab (hard daily caps, minimum gap minutes, preference weights).
3. **Commit Revision**:
   - Click **Commit Revision**. Note the persistent revision identifier (e.g. `rev_...`) and canonical SHA-256 hash.
   - Click **Continue to Search Lab**.

---

## 3. Search Lab: Real Transitions, Controls & Inspection (90 seconds)
1. **Select Algorithm & Pacing**:
   - In Search Lab header, select **A* Search (Optimal f = g + h)**.
   - Set **Speed** to **Teaching (250ms)** so transitions can be clearly observed.
2. **Start Search & Trigger Pause**:
   - Click **Start Search**.
   - As the engine runs, click **Pause**.
   - Notice that search progression freezes immediately at the atomic transition boundary.
3. **Inspect Rejected Actions & Nodes**:
   - In the canvas, click one of the red **Rejected Action** markers.
   - In the right-hand **Decision Inspector**, observe the exact rejection reason: e.g. `room_overlap: Overlaps with CS100 in room R1`.
   - Click an **Exploring** node: observe the exact accrued cost $g(S)$, admissible lower bound $h(S)$, and total priority $f(S) = g + h$.
   - Observe the miniature partial timetable rendering currently assigned exams.
4. **Step Forward & Resume**:
   - Click **Step Forward**: observe the engine advance by exactly **one** search transition.
   - Click **Resume**: the search continues to completion.
   - Notice the green **Validated Timetable Found!** outcome banner with the **Optimality Proven** badge!

---

## 4. Timetable Dashboard & Verified Exports (60 seconds)
1. **Open Timetable**: Click **Open Timetable Dashboard** (or click **Timetable** in the navigation bar).
2. **Inspect Views**:
   - **Table View**: Shows Course Code, Name, Date, Time Window, Room, and Students / Capacity.
   - Test the Search input: filter by course name or code.
   - Switch to **Calendar View**: observe exams placed in chronological day columns with duration intervals.
   - Switch to **Room View**: observe room occupancy lanes confirming no two exams overlap in the same hall.
3. **Trigger Independent Re-Validation**:
   - Click the **Re-Validate** button: the independent validator checks all 8 hard constraints and confirms 0 violations.
4. **Export Artifacts**:
   - Click **Export -> PDF**: download the paginated, styled examination schedule.
   - Click **Export -> XLSX**: download the Excel workbook with formatted dates, numeric counts, and the Run Summary sheet.
   - Click **Export -> JSON**: download the reproducible problem and assignment export.

---

## 5. Comparative Evaluation & Infeasibility Proof (60 seconds)
1. **Navigate to "Compare"**: Click the **Compare** tab in the navigation bar.
2. **Run 4-Way Sequential Benchmark**:
   - Click **Run 4-Algorithm Benchmark**.
   - Watch BFS, DFS, Greedy, and A* execute sequentially on the exact same problem snapshot without teaching delays.
   - Point out the distinct recognition badges:
     - **Lowest Observed Penalty**: Awarded to **A*** (Penalty: 0).
     - **Fastest Successful**: Awarded to Greedy or DFS.
     - **Fewest Explored Nodes**: Awarded to DFS or Greedy.
   - Explain why BFS, DFS, and Greedy placed both exams on the same day (Penalty 130), while A* guided search to different days (Penalty 0).
3. **Demonstrate Proven Infeasibility**:
   - Return to **Setup**, click **Load Sample -> Tiny Infeasible**.
   - Commit revision and run A* in Search Lab.
   - Point out the terminal status: **No Feasible Timetable Exists** (exhaustive proof across all assignments, not a timeout).
4. **Conclude**: Summarize that ExamCraft AI delivers authentic academic search, full constraint rigor, truthful visualization, and complete verified exports.
