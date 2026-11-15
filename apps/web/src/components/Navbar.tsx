import React from 'react';
import { Calendar, Cpu, Table, BarChart2, Sliders, CheckCircle2, Sparkles, Layers } from 'lucide-react';

interface NavbarProps {
  currentTab: 'overview' | 'setup' | 'lab' | 'timetable' | 'compare';
  setCurrentTab: (tab: 'overview' | 'setup' | 'lab' | 'timetable' | 'compare') => void;
  activeProblemName: string;
  revisionId: string | null;
  isDirty: boolean;
  hasSchedule: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeProblemName,
  revisionId,
  isDirty,
  hasSchedule,
}) => {
  return (
    <header className="bg-[#17191A] border-b border-[#373C3E] sticky top-0 z-50 px-4 py-2.5 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => setCurrentTab('overview')}
        >
          <div className="w-8 h-8 rounded-lg bg-[#E64B3C] flex items-center justify-center text-white shadow-sm shadow-[#E64B3C]/30 transition-transform duration-150 group-hover:scale-105">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold tracking-tight text-white text-base">
                ExamCraft <span className="text-[#E64B3C]">AI</span>
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[#FFF0EC]/10 text-[#E64B3C] border border-[#E64B3C]/30">
                Vermilion
              </span>
            </div>
            <p className="text-[11px] text-[#B9BEBC] font-medium hidden sm:block">
              Intelligent Examination Scheduling
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#1E2224] p-1 rounded-xl border border-[#373C3E] overflow-x-auto max-w-full">
          <button
            onClick={() => setCurrentTab('overview')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
              currentTab === 'overview'
                ? 'bg-[#E64B3C] text-white font-semibold shadow-sm shadow-[#E64B3C]/30'
                : 'text-[#B9BEBC] hover:text-white hover:bg-[#292D2F]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setCurrentTab('setup')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
              currentTab === 'setup'
                ? 'bg-[#E64B3C] text-white font-semibold shadow-sm shadow-[#E64B3C]/30'
                : 'text-[#B9BEBC] hover:text-white hover:bg-[#292D2F]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Setup
            {isDirty && (
              <span
                className="w-2 h-2 rounded-full bg-[#B7791F] animate-pulse"
                title="Unsaved modifications detected"
              />
            )}
          </button>
          <button
            onClick={() => setCurrentTab('lab')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
              currentTab === 'lab'
                ? 'bg-[#E64B3C] text-white font-semibold shadow-sm shadow-[#E64B3C]/30'
                : 'text-[#B9BEBC] hover:text-white hover:bg-[#292D2F]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Search Lab
          </button>
          <button
            onClick={() => setCurrentTab('timetable')}
            disabled={!hasSchedule}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
              !hasSchedule
                ? 'text-[#5A6063] cursor-not-allowed opacity-60'
                : currentTab === 'timetable'
                ? 'bg-[#E64B3C] text-white font-semibold shadow-sm shadow-[#E64B3C]/30'
                : 'text-[#B9BEBC] hover:text-white hover:bg-[#292D2F]'
            }`}
            title={!hasSchedule ? 'Run a search to generate a timetable first' : 'View Timetable'}
          >
            <Table className="w-3.5 h-3.5" />
            Timetable
          </button>
          <button
            onClick={() => setCurrentTab('compare')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
              currentTab === 'compare'
                ? 'bg-[#E64B3C] text-white font-semibold shadow-sm shadow-[#E64B3C]/30'
                : 'text-[#B9BEBC] hover:text-white hover:bg-[#292D2F]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Compare
          </button>
        </nav>

        {/* Right Info: Active Problem & Revision Status */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#1E2224] border border-[#373C3E]">
            <Layers className="w-3.5 h-3.5 text-[#B9BEBC]" />
            <span className="text-[#B9BEBC]">Problem:</span>
            <span className="font-semibold text-white truncate max-w-[140px]" title={activeProblemName}>
              {activeProblemName}
            </span>
          </div>

          {isDirty ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF4D8]/10 border border-[#B7791F]/40 text-[#B7791F] font-mono text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#B7791F] animate-pulse" />
              Unsaved Draft
            </div>
          ) : revisionId ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E2224] border border-[#373C3E]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#168A65]" />
              <span className="text-[#B9BEBC] text-[11px]">Rev:</span>
              <span className="font-mono text-white text-[11px]">{revisionId.slice(0, 10)}</span>
            </div>
          ) : (
            <div className="text-[11px] text-[#B9BEBC] px-2 py-1 rounded bg-[#1E2224] border border-[#373C3E]">
              Uncommitted
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
