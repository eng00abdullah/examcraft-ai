# Product and visual direction

## Experience goal

An academic evaluator should understand the problem, see a genuine rejected scheduling action, inspect why it failed, watch a valid assignment become a complete timetable, and compare measurable results in a few minutes. The interface should support that explanation even when an algorithm reaches a limit.

Use English UI labels and concise explanations, consistent with the project's academic terminology. Keep user-entered Unicode text intact. A full bilingual translation system is not required for the first delivery.

## Identity and tokens

Product name: **ExamCraft AI**. Descriptor: **Intelligent Examination Scheduling**. Create a simple calendar/grid-and-node SVG mark; no unrelated university or IEEE branding unless the user supplies an approved asset.

| Role | Value |
| --- | --- |
| Search Lab background | `#0B1220` |
| Search Lab panel | `#111C2E` |
| Search Lab border | `#26364C` |
| Primary action | `#2563EB` |
| Dark-lab highlight | `#22D3EE` |
| Light workspace background | `#F8FAFC` |
| Light card | `#FFFFFF` |
| Main text | `#0F172A` |
| Secondary text | `#64748B` |
| Success | `#16A34A` |
| Rejection/error | `#DC2626` |
| Resource limit/warning | `#D97706` |

These are design defaults. Verify text contrast in actual combinations; cyan and amber are not automatically appropriate for small text on white. Use a readable locally available sans-serif family, a restrained type scale, 8px spacing rhythm, and subtle borders. Avoid filling the page with gradients or glowing cards. Add reduced-motion support and visible keyboard focus.

## Navigation

Persistent top navigation: Overview, Setup, Search Lab, Timetable, Compare. Show the active problem name and revision near the page title. Disabled destinations explain the missing prerequisite. A progress indicator tracks Setup → Algorithm → Search → Result without treating a failed search as a successful completion.

### Home

Headline: **Build a valid exam timetable. Understand every decision.**

Show a compact, clearly labeled example connecting two conflicting course cards to two different exam times. Main CTA: Start Scheduling. Secondary: Try Sample. Explain the four algorithms and the three product outcomes—valid timetable, trace, comparison—in short copy. Do not invent user counts, time savings, university adoption, or success percentages.

### Setup

Use a guided workspace with tabs/sections for Courses, Students & Enrollments, Rooms, Dates & Slots, and Constraints. Avoid a single enormous form. Keep a sticky readiness summary showing exams, students, rooms, slots, conflicts, errors, and soft preferences.

Provide inline add/edit rows, clear required fields, an enrollment editor, batch JSON import with a preview/validation summary, save state, and sample selection. Loading a sample creates a separate problem. Date and time controls use real values; the backend stays authoritative. A small actual student-conflict graph is useful here, but is optional polish after core features work.

Separate **Must satisfy** from **Prefer** controls. Explain that a hard daily limit may make a case infeasible; a preference only adds penalty. Show the exact objective units and weights. Make one-exam/one-room modeling explicit.

### Algorithm selection

Four cards use the same structure: name, frontier behavior, strength, constraint on claims. A* explains `g`, `h`, and `f` with the configured objective. BFS explains that complete schedules have equal depth. Show selected data revision and resource caps before Start. Include Run Comparison as a separate action that states it benchmarks sequentially.

### Search Lab — the centerpiece

Desktop layout: slim contextual sidebar; large center graph canvas; right inspector; bottom control bar and event strip. The graph owns most of the area. The right inspector displays selected node depth, real assignments, `g/h/f` when defined, and a miniature timetable derived from that state.

Node styles must convey meaning with both text/shape and color:

- Frontier: outlined card marked Queued.
- Current: highlighted border marked Exploring.
- Explored: subdued card.
- Rejected action: compact red action marker linked to its parent, with a reason; not a fake explored node.
- Forward-pruned action: amber marker with the future course whose domain became empty.
- Solution path: green path plus the validated terminal label.

Metric strip: explored, generated, rejected actions, frontier, depth, search compute time. Tooltips explain counts; show preprocessing exclusions separately. Node count on the canvas is not the generated count.

Control bar stays visible: Start / Pause / Resume, Step Forward, Speed, Reset, Cancel. Show Running, Paused, Finished, Reconnecting, or Limited in text. When paused, the inspector and selected state stay inspectable. Fast pacing batches transport/rendering without changing solver order. Reveal trace truncation honestly, e.g. “250 nodes shown; 4,120 generated.”

On a narrow screen, use tabs for Graph / State / Events; keep controls reachable. Do not squeeze three unreadable columns onto a phone.

### Outcome

Show one decisive title: **Validated timetable found**, **No feasible timetable exists**, **Search limit reached**, **Cancelled**, **Interrupted**, or **Unexpected error**. Display the reason, actual stats, and relevant next step. A resource limit has an amber presentation, not the red semantic claim that data are impossible.

The successful state highlights the total penalty and its components, with “optimality proven” only when justified. Primary action: Open Timetable. Secondary: Compare Algorithms or Inspect Search.

### Timetable — professional light workspace

White cards on a pale background. Header: problem title, date range, revision, algorithm, validation badge, Export menu, Re-validate. Summary cards: scheduled exams, enrolled students, used rooms, and preference penalty. Avoid ornamental metrics unrelated to the task.

One shared toolbar controls search, date, room, course, sorting, and Clear. Segmented views: Table, Calendar, Rooms. Preserve selection/filter state across views, or explicitly display view-specific filters. Show matching count and export scope.

Table: course code as a readable identifier; name beneath or alongside it; date; start–end; room; students. Use consistent alignment and a sticky header. No gratuitous badge around every cell.

Calendar: real dated day columns and time positions with actual durations. Overlapping events in different rooms should remain readable. Clicking an event opens its full details. Do not use a static sample calendar.

Rooms: select a room or show room lanes with its date/time allocations and capacity/use. All three views use the same assignments. Filtered-out records still exist; never accidentally export a partial timetable as the complete solution.

### Comparison

Start with an understandable result table and status chips, then real charts for compute time, explored/generated nodes, and penalty. Show missing measurements as unavailable, and limits as bounded attempts. Use separate recognitions for fastest successful, least exploration, and lowest observed penalty. Display dataset hash/revision and run method in expandable details. Keep raw trial results accessible.

## High-value polish after correctness

Prioritize a useful node inspector, smooth graph focus, keyboard controls, polished PDF layout, visible saved/history state, and a guided sample demo. A shallow marketing animation, chatbot, login page, and unrelated AI text generator do not improve the required scheduling product.

## Visual review checklist

Inspect at 1440px desktop and about 390px mobile, plus a practical laptop width. Verify no page-wide horizontal overflow, no controls behind fixed panels, no illegible chart labels, no stale success badge, no dead buttons, and no broken assets. Make screenshots only from the actual running application. Pair screenshots with functional evidence, not as a substitute for it.
