import React from 'react';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Cpu,
  Layers,
  ArrowRight,
  Clock,
  Building,
  Users,
  Check,
  FileSpreadsheet,
  FileText,
  Sliders,
  ChevronRight,
} from 'lucide-react';

interface OverviewProps {
  onStartScheduling: () => void;
  onLoadSample: (sampleKey: 'tiny_feasible' | 'demo_small') => void;
}

export const Overview: React.FC<OverviewProps> = ({ onStartScheduling, onLoadSample }) => {
  return (
    <div className="relative min-h-screen bg-[#17191A] text-[#F5F2EC] overflow-hidden selection:bg-[#E64B3C]/30 selection:text-white">
      {/* Background Architectural Lighting & Geometric Linework */}
      <div className="absolute inset-0 bg-vermilion-subtle-glow pointer-events-none" />
      <div className="absolute inset-0 bg-vermilion-edge-glow pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-96 bg-grid-graphite opacity-30 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto pt-16 pb-24 px-4 sm:px-6 lg:px-8 space-y-24">
        {/* ========================================================= */}
        {/* HERO SECTION: Editorial SaaS Meets Academic Precision     */}
        {/* ========================================================= */}
        <section className="space-y-12">
          {/* Top Eyebrow */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E2224] border border-[#373C3E] text-[#B9BEBC] text-xs font-medium shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#E64B3C]" />
              <span className="tracking-wide">Vermilion Edition</span>
              <span className="text-[#373C3E]">|</span>
              <span className="text-[#F5F2EC] font-semibold">Deterministic State Space Search</span>
            </div>
          </div>

          {/* Main Hero Headline & Copy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8 space-y-6">
              <h1 className="font-display font-extrabold text-5xl sm:text-6xl md:text-7xl tracking-tight leading-[1.08] text-white">
                Complex scheduling. <br />
                <span className="text-[#E64B3C]">Beautifully solved.</span>
              </h1>
              <p className="text-lg sm:text-xl text-[#B9BEBC] max-w-2xl font-normal leading-relaxed">
                An intelligent workspace for planning, exploring, and validating university examinations.
                Watch real BFS, DFS, Greedy, and A* explore state spaces, resolve student conflicts,
                and generate mathematically verified, conflict-free schedules.
              </p>

              {/* Hero CTA Group */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={onStartScheduling}
                  aria-label="Start Scheduling"
                  className="flex items-center gap-2 px-6 py-3.5 bg-[#E64B3C] hover:bg-[#CC3E31] active:bg-[#B73529] text-white font-semibold text-sm rounded-xl shadow-vermilion transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Create timetable
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  onClick={() => onLoadSample('tiny_feasible')}
                  className="flex items-center gap-2 px-5 py-3.5 bg-[#1E2224] hover:bg-[#292D2F] active:bg-[#1E2224] text-[#F5F2EC] font-medium text-sm rounded-xl border border-[#373C3E] transition-all duration-150"
                >
                  Explore tiny benchmark
                </button>
                <button
                  onClick={() => onLoadSample('demo_small')}
                  className="flex items-center gap-2 px-5 py-3.5 bg-[#1E2224] hover:bg-[#292D2F] active:bg-[#1E2224] text-[#B9BEBC] hover:text-white font-medium text-sm rounded-xl border border-[#373C3E] transition-all duration-150"
                >
                  4-Course sample
                </button>
              </div>
            </div>

            {/* Quick Spec Highlights */}
            <div className="lg:col-span-4 bg-[#1E2224] border border-[#373C3E] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#373C3E] pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#B9BEBC]">Standard</span>
                <span className="text-xs font-mono font-bold text-[#E64B3C]">WCAG 2.2 · AA</span>
              </div>
              <ul className="space-y-2.5 text-xs text-[#B9BEBC]">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#168A65]" />
                  <span>Independent acceptance verification oracle</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#168A65]" />
                  <span>True A* penalty optimality guarantees</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#168A65]" />
                  <span>Audit-grade XLSX and PDF multi-format exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#168A65]" />
                  <span>Zero fabricated or simulated benchmark data</span>
                </li>
              </ul>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 5.4 SCHEDULING WORKSPACE PREVIEW (Warm Paper & White)     */}
          {/* ========================================================= */}
          <div className="pt-4">
            <div className="bg-[#F5F2EC] text-[#202426] rounded-2xl md:rounded-3xl p-6 md:p-8 border border-[#E7E2DA] shadow-2xl space-y-6">
              {/* Preview Window Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E2DA] pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E64B3C]" />
                    <span className="font-display font-bold text-sm tracking-tight text-[#202426]">
                      Academic Scheduling Workspace Preview
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#FAF8F4] border border-[#E7E2DA] font-mono text-[#667078]">
                      Sample Dataset: Fall Term
                    </span>
                  </div>
                  <p className="text-xs text-[#667078]">
                    Real-time operational dashboard with constraint monitoring and room allocation telemetry.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E8F5EE] border border-[#168A65]/30 text-[#168A65] text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Feasible & Verified
                  </span>
                </div>
              </div>

              {/* KPI Tiles (Clean Pure White cards on Warm Paper) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#E7E2DA] shadow-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#667078]">Exams Placed</span>
                    <Calendar className="w-4 h-4 text-[#E64B3C]" />
                  </div>
                  <div className="font-display font-bold text-2xl text-[#202426] tabular-nums">4 / 4</div>
                  <div className="text-[11px] text-[#168A65] font-medium">100% completion</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E7E2DA] shadow-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#667078]">Rooms Allocated</span>
                    <Building className="w-4 h-4 text-[#467B87]" />
                  </div>
                  <div className="font-display font-bold text-2xl text-[#202426] tabular-nums">2 Halls</div>
                  <div className="text-[11px] text-[#667078]">Main Hall 1 & 2</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E7E2DA] shadow-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#667078]">Enrolled Students</span>
                    <Users className="w-4 h-4 text-[#467B87]" />
                  </div>
                  <div className="font-display font-bold text-2xl text-[#202426] tabular-nums">120</div>
                  <div className="text-[11px] text-[#667078]">Zero overlaps</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E7E2DA] shadow-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#667078]">Conflict Count</span>
                    <ShieldAlert className="w-4 h-4 text-[#168A65]" />
                  </div>
                  <div className="font-display font-bold text-2xl text-[#168A65] tabular-nums">0 Hard Violations</div>
                  <div className="text-[11px] text-[#168A65] font-medium">Oracle validated</div>
                </div>
              </div>

              {/* Mini Timetable Timeline Preview */}
              <div className="bg-white rounded-xl border border-[#E7E2DA] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#667078]">
                  <span>Timeline Matrix: Session 2026-12-01</span>
                  <span className="font-mono text-[#E64B3C]">Slot 09:00 — 12:00</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E7E2DA] flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-[#E64B3C]">CS101 · Artificial Intelligence</div>
                      <div className="text-[11px] text-[#667078]">Room: Main Hall 1 (Cap: 60) · 32 Students</div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#168A65] bg-[#E8F5EE] px-2 py-0.5 rounded">
                      09:00–10:30
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E7E2DA] flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-[#202426]">CS102 · Algorithms & Complexity</div>
                      <div className="text-[11px] text-[#667078]">Room: Main Hall 2 (Cap: 80) · 45 Students</div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#168A65] bg-[#E8F5EE] px-2 py-0.5 rounded">
                      10:00–11:30
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* TRANSPARENT SCHEDULING DYNAMICS: Conflict & Resolution     */}
        {/* ========================================================= */}
        <section className="bg-[#1E2224] border border-[#373C3E] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#E64B3C]/10 text-[#E64B3C]">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold text-sm tracking-wide text-white uppercase">
              Transparent Scheduling Dynamics: Shared Student Conflict Resolution
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Candidate A */}
            <div className="bg-[#17191A] p-5 rounded-xl border border-[#373C3E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#E64B3C]">CS101</span>
                <span className="text-[10px] bg-[#E64B3C]/10 text-[#E64B3C] px-2 py-0.5 rounded border border-[#E64B3C]/20 font-semibold">
                  Course A (60m)
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Artificial Intelligence</p>
                <p className="text-xs text-[#B9BEBC] mt-0.5">
                  Enrolled: <span className="text-white font-medium">Student S1</span> (Degree: 1)
                </p>
              </div>
              <div className="pt-2 text-[11px] text-[#168A65] bg-[#168A65]/10 p-2.5 rounded-lg border border-[#168A65]/20 font-mono">
                Assigned: <strong>2026-12-01 09:00–10:00 (Hall 1)</strong>
              </div>
            </div>

            {/* Central Conflict Logic Indicator */}
            <div className="text-center space-y-3 px-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#C94444]/15 text-[#C94444] border border-[#C94444]/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#C94444] uppercase tracking-wider">
                  Direct Student Conflict
                </h4>
                <p className="text-xs text-[#B9BEBC] mt-1 leading-relaxed">
                  Candidate placement of Course B in the same time slot (09:00–10:00) is rejected immediately because Student S1 cannot sit two exams simultaneously.
                </p>
              </div>
            </div>

            {/* Candidate B Resolved */}
            <div className="bg-[#17191A] p-5 rounded-xl border border-[#373C3E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#F5F2EC]">DS201</span>
                <span className="text-[10px] bg-[#FAF8F4]/10 text-[#F5F2EC] px-2 py-0.5 rounded border border-[#373C3E] font-semibold">
                  Course B (60m)
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Data Structures</p>
                <p className="text-xs text-[#B9BEBC] mt-0.5">
                  Enrolled: <span className="text-white font-medium">Student S1</span> (Degree: 1)
                </p>
              </div>
              <div className="pt-2 text-[11px] text-[#168A65] bg-[#168A65]/10 p-2.5 rounded-lg border border-[#168A65]/20 font-mono">
                Resolved: <strong>2026-12-02 09:00–10:00 (Hall 1)</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FOUR REAL SEARCH ALGORITHMS OVER ONE SHARED MODEL         */}
        {/* ========================================================= */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#E64B3C] uppercase tracking-wider">
                Algorithm Matrix
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight mt-1">
                Four Real Search Algorithms Over One Shared Model
              </h2>
            </div>
            <p className="text-xs text-[#B9BEBC] max-w-md">
              Same deterministic course ordering, identical candidate action domains, and equal resource caps. No fake simulations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* BFS */}
            <div className="bg-[#1E2224] border border-[#373C3E] hover:border-[#E64B3C]/50 p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-colors duration-150">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-lg bg-[#17191A] text-white flex items-center justify-center font-mono font-bold text-xs border border-[#373C3E]">
                    BFS
                  </span>
                  <span className="text-[10px] font-semibold text-[#B9BEBC] bg-[#17191A] px-2 py-0.5 rounded border border-[#373C3E]">
                    FIFO Queue
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm text-white">Breadth-First Search</h4>
                <p className="text-xs text-[#B9BEBC] leading-relaxed">
                  Explores shallowest nodes first. Since all valid complete timetables have equal assignment depth (N exams), BFS yields the first feasible candidate found without penalty minimization.
                </p>
              </div>
              <div className="text-[11px] bg-[#17191A] p-2.5 rounded-xl text-[#B9BEBC] border border-[#373C3E]">
                Guarantee: <strong className="text-white">Feasible, shallowest goal</strong>
              </div>
            </div>

            {/* DFS */}
            <div className="bg-[#1E2224] border border-[#373C3E] hover:border-[#E64B3C]/50 p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-colors duration-150">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-lg bg-[#17191A] text-white flex items-center justify-center font-mono font-bold text-xs border border-[#373C3E]">
                    DFS
                  </span>
                  <span className="text-[10px] font-semibold text-[#B9BEBC] bg-[#17191A] px-2 py-0.5 rounded border border-[#373C3E]">
                    LIFO Stack
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm text-white">Depth-First Search</h4>
                <p className="text-xs text-[#B9BEBC] leading-relaxed">
                  Fast search committing deeply down the leftmost deterministic branch. Minimal memory footprint, but final solution quality depends strictly on candidate action ordering.
                </p>
              </div>
              <div className="text-[11px] bg-[#17191A] p-2.5 rounded-xl text-[#B9BEBC] border border-[#373C3E]">
                Guarantee: <strong className="text-white">First feasible schedule</strong>
              </div>
            </div>

            {/* GBFS */}
            <div className="bg-[#1E2224] border border-[#373C3E] hover:border-[#E64B3C]/50 p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-colors duration-150">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-lg bg-[#17191A] text-[#B7791F] flex items-center justify-center font-mono font-bold text-xs border border-[#B7791F]/30">
                    GBFS
                  </span>
                  <span className="text-[10px] font-semibold text-[#B7791F] bg-[#FFF4D8]/10 px-2 py-0.5 rounded border border-[#B7791F]/30">
                    Min h(S)
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm text-white">Greedy Best-First</h4>
                <p className="text-xs text-[#B9BEBC] leading-relaxed">
                  Priority queue ordered solely by minimum heuristic estimate <span className="font-mono text-white">h(S)</span>.
                  Steers aggressively towards states that appear near completion, omitting path cost <span className="font-mono text-white">g(S)</span>.
                </p>
              </div>
              <div className="text-[11px] bg-[#17191A] p-2.5 rounded-xl text-[#B9BEBC] border border-[#373C3E]">
                Guarantee: <strong className="text-white">Heuristic-guided first feasible</strong>
              </div>
            </div>

            {/* A* Search */}
            <div className="bg-[#1E2224] border border-[#E64B3C] p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-vermilion">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-lg bg-[#E64B3C] text-white flex items-center justify-center font-mono font-bold text-xs shadow-sm">
                    A*
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#E64B3C] px-2 py-0.5 rounded">
                    Optimal
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                  A* Search
                </h4>
                <p className="text-xs text-[#F5F2EC] leading-relaxed">
                  Ordered by <span className="font-mono text-[#E64B3C] font-semibold">f(S) = g(S) + h(S)</span>.
                  Combines exact accrued penalty <span className="font-mono">g</span> and an admissible lower bound <span className="font-mono">h</span>. Popping from priority frontier mathematically guarantees minimum penalty!
                </p>
              </div>
              <div className="text-[11px] bg-[#17191A] p-2.5 rounded-xl text-white border border-[#E64B3C]/40">
                Guarantee: <strong className="text-[#E64B3C]">Proven minimum penalty</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* WORKFLOW STEPS: End-to-End Integrity                      */}
        {/* ========================================================= */}
        <section className="bg-[#1E2224] border border-[#373C3E] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6">
          <div className="text-xs font-semibold text-[#E64B3C] uppercase tracking-wider">
            Execution Flow
          </div>
          <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">
            Designed for Rigorous Institutional Scheduling
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#17191A] p-4 rounded-xl border border-[#373C3E] space-y-2">
              <div className="text-xs font-mono font-bold text-[#E64B3C]">01</div>
              <h5 className="font-semibold text-sm text-white">Problem Setup</h5>
              <p className="text-xs text-[#B9BEBC] leading-relaxed">
                Define courses, student enrollments, room capacities, allowed slots, and room blackouts with instant structural validation.
              </p>
            </div>

            <div className="bg-[#17191A] p-4 rounded-xl border border-[#373C3E] space-y-2">
              <div className="text-xs font-mono font-bold text-[#E64B3C]">02</div>
              <h5 className="font-semibold text-sm text-white">Search Lab</h5>
              <p className="text-xs text-[#B9BEBC] leading-relaxed">
                Observe the live engine stream with interactive graph controls, exact step advancement, and deep Node Inspector telemetry.
              </p>
            </div>

            <div className="bg-[#17191A] p-4 rounded-xl border border-[#373C3E] space-y-2">
              <div className="text-xs font-mono font-bold text-[#E64B3C]">03</div>
              <h5 className="font-semibold text-sm text-white">Independent Oracle</h5>
              <p className="text-xs text-[#B9BEBC] leading-relaxed">
                Completed schedules are validated by an isolated constraint checker ensuring zero room double-booking or student conflicts.
              </p>
            </div>

            <div className="bg-[#17191A] p-4 rounded-xl border border-[#373C3E] space-y-2">
              <div className="text-xs font-mono font-bold text-[#E64B3C]">04</div>
              <h5 className="font-semibold text-sm text-white">Multi-Format Exports</h5>
              <p className="text-xs text-[#B9BEBC] leading-relaxed">
                Generate paginated audit-ready PDFs, structured XLSX workbooks with summary metrics, and machine-readable JSON files.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-[#373C3E] flex flex-wrap items-center justify-between gap-4 text-xs text-[#B9BEBC]">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white">ExamCraft AI</span>
            <span>·</span>
            <span>Vermilion Edition</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Deterministic AI Scheduling System</span>
            <span>·</span>
            <span className="font-mono text-[#E64B3C]">v1.0-release</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
