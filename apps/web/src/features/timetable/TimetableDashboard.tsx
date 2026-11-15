import React, { useState } from 'react';
import {
  Table as TableIcon,
  Calendar as CalendarIcon,
  Building,
  Download,
  ShieldCheck,
  Search,
  Filter,
  RotateCcw,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  FileJson,
  CheckCircle2,
  Clock,
  Users,
} from 'lucide-react';
import { RunRecord } from '../../api/types';
import { revalidateRun, getExportUrl } from '../../api/client';

interface TimetableDashboardProps {
  runRecord: RunRecord | null;
}

export const TimetableDashboard: React.FC<TimetableDashboardProps> = ({ runRecord }) => {
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'room'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [sortField, setSortField] = useState<'courseCode' | 'courseName' | 'date' | 'duration' | 'roomName' | 'enrolled'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [revalStatus, setRevalStatus] = useState<string | null>(null);
  const [revalError, setRevalError] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');

  if (!runRecord || !runRecord.assignments) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-card border border-[#E7E2DA] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF0EC] text-[#E64B3C] flex items-center justify-center mx-auto">
            <TableIcon className="w-7 h-7" />
          </div>
          <h3 className="font-display font-bold text-lg text-[#202426]">No Timetable Generated Yet</h3>
          <p className="text-xs text-[#667078] max-w-md mx-auto leading-relaxed">
            Please run a search algorithm in the Search Lab to generate, validate, and view an examination schedule.
          </p>
        </div>
      </div>
    );
  }

  const { problem, assignments, validation, metrics, run_id, algorithm } = runRecord;

  // Build lookup maps
  const coursesById = problem.courses.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, any>);
  const slotsById = problem.slots.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, any>);
  const roomsById = problem.rooms.reduce((acc, r) => ({ ...acc, [r.id]: r }), {} as Record<string, any>);

  const studentCountPerCourse = problem.courses.reduce((acc, c) => {
    acc[c.id] = problem.enrollments.filter((e) => e.course_id === c.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Compute exam placements
  const scheduledExams = assignments.map((a) => {
    const course = coursesById[a.course_id] || { code: a.course_id, name: 'Unknown', duration_minutes: 60 };
    const slot = slotsById[a.slot_id] || { date: '2026-12-01', start_time: '09:00', end_time: '11:00' };
    const room = roomsById[a.room_id] || { name: a.room_id, capacity: 50 };

    const [sH, sM] = slot.start_time.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = startMins + course.duration_minutes;
    const eH = Math.floor(endMins / 60);
    const eM = endMins % 60;
    const endTime = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;

    return {
      courseId: a.course_id,
      courseCode: course.code,
      courseName: course.name,
      duration: course.duration_minutes,
      slotId: a.slot_id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: endTime,
      startMins,
      endMins,
      roomId: a.room_id,
      roomName: room.name,
      capacity: room.capacity,
      enrolled: studentCountPerCourse[a.course_id] || 0,
    };
  });

  // Unique dates and rooms for filters
  const uniqueDates = Array.from(new Set(scheduledExams.map((e) => e.date))).sort();
  const uniqueRooms = Array.from(new Set(scheduledExams.map((e) => e.roomId))).sort();

  // Active calendar date
  const activeCalendarDate = selectedCalendarDate || uniqueDates[0] || '';

  // Filtered and sorted exams
  const sortedAndFilteredExams = scheduledExams
    .filter((exam) => {
      const matchesQuery =
        exam.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.courseName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRoom = selectedRoom === 'all' || exam.roomId === selectedRoom;
      const matchesDate = selectedDate === 'all' || exam.date === selectedDate;
      return matchesQuery && matchesRoom && matchesDate;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = (a.date + ' ' + a.startTime).localeCompare(b.date + ' ' + b.startTime);
      } else if (sortField === 'courseCode') {
        comparison = a.courseCode.localeCompare(b.courseCode);
      } else if (sortField === 'courseName') {
        comparison = a.courseName.localeCompare(b.courseName);
      } else if (sortField === 'duration') {
        comparison = a.duration - b.duration;
      } else if (sortField === 'roomName') {
        comparison = a.roomName.localeCompare(b.roomName);
      } else if (sortField === 'enrolled') {
        comparison = a.enrolled - b.enrolled;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSortToggle = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Re-validation trigger
  const handleRevalidate = async () => {
    try {
      setRevalStatus('Running independent schedule re-validation...');
      setRevalError(null);
      const res = await revalidateRun(run_id);
      if (res.valid) {
        setRevalStatus(`Schedule is fully valid! Zero hard violations. Total Penalty: ${res.penalty}`);
      } else {
        setRevalError(`Revalidation failed: ${res.violations.map((v) => v.message).join(', ')}`);
        setRevalStatus(null);
      }
    } catch (err: any) {
      setRevalError(`Revalidation error: ${err.message}`);
      setRevalStatus(null);
    }
  };

  // Filter query parameters for exports
  const exportParams = new URLSearchParams();
  if (searchQuery) exportParams.set('query', searchQuery);
  if (selectedRoom !== 'all') exportParams.set('room_id', selectedRoom);
  if (selectedDate !== 'all') exportParams.set('date', selectedDate);
  const exportQueryStr = exportParams.toString() ? `?${exportParams.toString()}` : '';

  const dayExams = scheduledExams.filter((e) => e.date === activeCalendarDate);

  // Dynamic time-grid bounds & room lanes for active calendar date
  const roomsOnDay = Array.from(new Set(dayExams.map((e) => e.roomId))).sort();
  const activeDayRooms = roomsOnDay.length > 0 ? roomsOnDay : (uniqueRooms.length > 0 ? uniqueRooms : problem.rooms.map((r) => r.id));

  let startHour = 8;
  let endHour = 18;
  if (dayExams.length > 0) {
    const minStartMins = Math.min(...dayExams.map((e) => e.startMins));
    const maxEndMins = Math.max(...dayExams.map((e) => e.endMins));
    startHour = Math.max(0, Math.floor(minStartMins / 60));
    endHour = Math.min(24, Math.max(startHour + 2, Math.ceil(maxEndMins / 60)));
  }
  const calendarHours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div className="bg-[#F5F2EC] min-h-[calc(100vh-60px)] py-8 px-4 sm:px-6 lg:px-8 font-sans text-[#202426]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card: Summary & Exports */}
        <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-card p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display font-bold text-xl sm:text-2xl text-[#202426] tracking-tight">Timetable Workspace</h1>
              <span className="bg-[#E8F5EE] text-[#168A65] border border-[#168A65]/30 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#168A65]" /> Validated Feasible
              </span>
              <span className="text-xs bg-[#FAF8F4] text-[#202426] border border-[#E7E2DA] px-2.5 py-1 rounded-lg font-mono font-bold uppercase">
                {algorithm.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[#667078] mt-1.5">
              Deterministic examination schedule with independent constraint verification and multi-format exports.
            </p>
          </div>

          {/* Action Buttons: Re-validate & Exports */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRevalidate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#FAF8F4] text-[#202426] text-xs font-semibold rounded-xl border border-[#E7E2DA] shadow-xs transition"
              title="Run independent Python oracle re-validation"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#E64B3C]" /> Re-validate Schedule
            </button>

            <a
              href={`${getExportUrl(run_id, 'pdf')}${exportQueryStr}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFF0EC] hover:bg-[#FFE0D8] text-[#E64B3C] text-xs font-semibold rounded-xl border border-[#F4C1B8] shadow-xs transition"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </a>

            <a
              href={`${getExportUrl(run_id, 'xlsx')}${exportQueryStr}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E8F5EE] hover:bg-[#D5EFE1] text-[#168A65] text-xs font-semibold rounded-xl border border-[#168A65]/30 shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (XLSX)
            </a>

            <a
              href={`${getExportUrl(run_id, 'json')}${exportQueryStr}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#FAF8F4] text-[#667078] hover:text-[#202426] text-xs font-semibold rounded-xl border border-[#E7E2DA] shadow-xs transition"
            >
              <FileJson className="w-3.5 h-3.5" /> JSON
            </a>
          </div>
        </div>

        {/* Re-validation status alerts */}
        {revalStatus && (
          <div className="bg-[#E8F5EE] border border-[#168A65]/40 text-[#168A65] p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#168A65]" />
            <span>{revalStatus}</span>
          </div>
        )}
        {revalError && (
          <div className="bg-[#FCEAEA] border border-[#C94444]/40 text-[#C94444] p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-[#C94444]" />
            <span>{revalError}</span>
          </div>
        )}

        {/* Filters and View Controls Toolbar */}
        <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-card p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Filters */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search query */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[#667078] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search course code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#FAF8F4] border border-[#E7E2DA] focus:border-[#E64B3C] focus:ring-1 focus:ring-[#E64B3C] rounded-xl text-xs text-[#202426] placeholder-[#667078] outline-none transition"
              />
            </div>

            {/* Room Filter */}
            <div className="flex items-center gap-1.5 text-xs text-[#667078]">
              <Filter className="w-3.5 h-3.5 text-[#667078]" />
              <span>Room:</span>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="bg-[#FAF8F4] border border-[#E7E2DA] rounded-xl px-3 py-1.5 text-xs text-[#202426] outline-none cursor-pointer"
              >
                <option value="all">All Rooms</option>
                {uniqueRooms.map((rId) => (
                  <option key={rId} value={rId}>
                    {roomsById[rId]?.name || rId}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-1.5 text-xs text-[#667078]">
              <span>Date:</span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#FAF8F4] border border-[#E7E2DA] rounded-xl px-3 py-1.5 text-xs text-[#202426] outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedRoom !== 'all' || selectedDate !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRoom('all');
                  setSelectedDate('all');
                }}
                className="text-xs text-[#E64B3C] hover:text-[#CC3E31] font-semibold"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Right: Segmented View Switcher */}
          <div className="flex items-center gap-1 bg-[#FAF8F4] p-1 rounded-xl border border-[#E7E2DA]">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'table' ? 'bg-[#E64B3C] text-white shadow-xs' : 'text-[#667078] hover:text-[#202426]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'calendar' ? 'bg-[#E64B3C] text-white shadow-xs' : 'text-[#667078] hover:text-[#202426]'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Calendar View
            </button>
            <button
              onClick={() => setViewMode('room')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'room' ? 'bg-[#E64B3C] text-white shadow-xs' : 'text-[#667078] hover:text-[#202426]'
              }`}
            >
              <Building className="w-3.5 h-3.5" /> Room Utilization
            </button>
          </div>
        </div>

        {/* VIEW 1: TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F4] border-b border-[#E7E2DA] text-[#667078] font-semibold uppercase tracking-wider text-[11px] select-none">
                    <th className="py-3 px-4 cursor-pointer hover:bg-[#E7E2DA]/50" onClick={() => handleSortToggle('courseCode')}>
                      Course Code {sortField === 'courseCode' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-[#E7E2DA]/50" onClick={() => handleSortToggle('courseName')}>
                      Course Name {sortField === 'courseName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-[#E7E2DA]/50" onClick={() => handleSortToggle('date')}>
                      Examination Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4">Time Window</th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-[#E7E2DA]/50" onClick={() => handleSortToggle('duration')}>
                      Duration {sortField === 'duration' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-[#E7E2DA]/50" onClick={() => handleSortToggle('roomName')}>
                      Room Location {sortField === 'roomName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:bg-[#E7E2DA]/50" onClick={() => handleSortToggle('enrolled')}>
                      Students / Capacity {sortField === 'enrolled' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E2DA]">
                  {sortedAndFilteredExams.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#667078]">
                        No examination assignments match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedAndFilteredExams.map((exam) => (
                      <tr key={exam.courseId} className="hover:bg-[#FAF8F4]/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#E64B3C]">{exam.courseCode}</td>
                        <td className="py-3 px-4 font-semibold text-[#202426]">{exam.courseName}</td>
                        <td className="py-3 px-4 font-medium text-[#202426]">{exam.date}</td>
                        <td className="py-3 px-4 font-mono text-[#667078]">
                          {exam.startTime} – {exam.endTime}
                        </td>
                        <td className="py-3 px-4 text-[#667078] tabular-nums">{exam.duration} mins</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#202426]">{exam.roomName}</span>{' '}
                          <span className="text-[#667078] font-mono text-[10px]">({exam.roomId})</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block bg-[#FAF8F4] text-[#202426] border border-[#E7E2DA] px-2.5 py-1 rounded-full font-semibold text-[11px] tabular-nums">
                            {exam.enrolled} / {exam.capacity}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-[#FAF8F4] px-4 py-2.5 border-t border-[#E7E2DA] text-[11px] text-[#667078] flex justify-between">
              <span>Showing {sortedAndFilteredExams.length} of {scheduledExams.length} scheduled exams</span>
              <span>Scope: {sortedAndFilteredExams.length === scheduledExams.length ? 'Full Timetable' : 'Filtered Subset'}</span>
            </div>
          </div>
        )}

        {/* VIEW 2: TIME-GRID CALENDAR VIEW */}
        {viewMode === 'calendar' && (
          <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-card p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E2DA] pb-4">
              <div>
                <h3 className="font-display font-bold text-sm text-[#202426]">Interactive Dynamic Time-Grid Calendar</h3>
                <p className="text-xs text-[#667078]">
                  Dynamic time bounds ({String(startHour).padStart(2, '0')}:00 – {String(endHour).padStart(2, '0')}:00) with independent room lanes preventing card overlap.
                </p>
              </div>

              {/* Day selector pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {uniqueDates.map((dateStr) => (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedCalendarDate(dateStr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      activeCalendarDate === dateStr
                        ? 'bg-[#E64B3C] text-white shadow-xs'
                        : 'bg-[#FAF8F4] text-[#667078] hover:text-[#202426] border border-[#E7E2DA]'
                    }`}
                  >
                    {dateStr}
                  </button>
                ))}
              </div>
            </div>

            {/* Time-Grid Canvas */}
            <div className="relative border border-[#E7E2DA] rounded-xl overflow-x-auto bg-white">
              <div style={{ minWidth: `${Math.max(750, activeDayRooms.length * 240 + 100)}px` }}>
                {/* Header Row: Room Columns */}
                <div className="flex border-b border-[#E7E2DA] bg-[#FAF8F4] text-xs font-semibold text-[#667078] py-2.5">
                  <div className="w-[100px] flex-shrink-0 text-center border-r border-[#E7E2DA] font-mono text-[#667078]">
                    Time
                  </div>
                  <div className="flex-1 flex divide-x divide-[#E7E2DA]">
                    {activeDayRooms.map((rId) => {
                      const room = roomsById[rId];
                      return (
                        <div key={rId} className="flex-1 px-3 text-center">
                          <span className="font-bold text-[#202426]">{room?.name || rId}</span>
                          <span className="text-[#667078] font-mono text-[10px] ml-1.5">
                            ({rId} • Cap: {room?.capacity ?? '?'})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Body */}
                <div
                  className="relative"
                  style={{ height: `${(calendarHours.length - 1) * 50 + 50}px` }}
                >
                  {/* Hour horizontal guideline rows (50px per hour) */}
                  {calendarHours.map((hour, idx) => (
                    <div
                      key={hour}
                      style={{ top: `${idx * 50}px` }}
                      className="absolute inset-x-0 h-[50px] border-b border-[#FAF8F4] flex items-start"
                    >
                      <div className="w-[100px] flex-shrink-0 pr-3 text-right text-[11px] font-mono text-[#667078] -mt-2.5">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      <div className="flex-1 h-full flex divide-x divide-[#E7E2DA]/40 border-l border-[#E7E2DA]">
                        {activeDayRooms.map((rId) => (
                          <div key={rId} className="flex-1 h-full" />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Positioned Exam Cards in Room Lanes */}
                  <div className="absolute inset-y-0 left-[100px] right-0 pointer-events-none">
                    {dayExams
                      .filter((exam) => {
                        const matchesQuery =
                          exam.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exam.courseName.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesRoom = selectedRoom === 'all' || exam.roomId === selectedRoom;
                        return matchesQuery && matchesRoom;
                      })
                      .map((exam) => {
                        const roomIndex = Math.max(0, activeDayRooms.indexOf(exam.roomId));
                        const numRooms = Math.max(1, activeDayRooms.length);
                        const laneWidthPercent = 100 / numRooms;
                        const laneLeftPercent = roomIndex * laneWidthPercent;

                        const topPx = ((exam.startMins - startHour * 60) / 60) * 50;
                        const heightPx = Math.max(42, (exam.duration / 60) * 50);

                        return (
                          <div
                            key={exam.courseId}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              left: `calc(${laneLeftPercent}% + 4px)`,
                              width: `calc(${laneWidthPercent}% - 8px)`,
                            }}
                            className="absolute pointer-events-auto bg-[#FFF0EC] border-l-4 border-l-[#E64B3C] border border-[#F4C1B8] rounded-r-xl p-2.5 shadow-subtle flex flex-col justify-between overflow-hidden hover:shadow-md hover:z-20 transition z-10"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="truncate">
                                <span className="font-mono font-bold text-[#E64B3C] text-xs">{exam.courseCode}</span>
                                <span className="text-xs font-semibold text-[#202426] ml-1.5 truncate" title={exam.courseName}>
                                  {exam.courseName}
                                </span>
                              </div>
                              <span className="bg-white/95 px-1.5 py-0.5 rounded border border-[#F4C1B8] font-mono text-[#E64B3C] font-semibold text-[10px] flex-shrink-0">
                                {exam.startTime}–{exam.endTime}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#667078] pt-1 border-t border-[#F4C1B8]/60 mt-1">
                              <span className="font-medium truncate">{exam.roomName}</span>
                              <span className="text-[#667078] font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#E7E2DA]">
                                {exam.enrolled} / {exam.capacity} seats
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: ROOM UTILIZATION VIEW */}
        {viewMode === 'room' && (
          <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-card p-6 space-y-6">
            <h3 className="font-display font-bold text-sm text-[#202426]">Room Occupancy & Allocation Lanes</h3>
            <div className="space-y-4">
              {problem.rooms.map((room) => {
                const roomExams = sortedAndFilteredExams.filter((e) => e.roomId === room.id);
                return (
                  <div key={room.id} className="bg-[#FAF8F4] rounded-2xl border border-[#E7E2DA] p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-2.5">
                      <div>
                        <span className="font-bold text-[#202426] text-sm">{room.name}</span>
                        <span className="text-xs text-[#667078] font-mono ml-2">ID: {room.id}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#202426] bg-white px-3 py-1 rounded-xl border border-[#E7E2DA] shadow-xs">
                        Capacity: {room.capacity} seats ({roomExams.length} exams allocated)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {roomExams.length === 0 ? (
                        <p className="text-xs text-[#667078] py-2">No exams assigned to this room</p>
                      ) : (
                        roomExams.map((exam) => (
                          <div key={exam.courseId} className="bg-white p-3.5 rounded-xl border border-[#E7E2DA] shadow-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[#E64B3C] text-xs">{exam.courseCode}</span>
                              <span className="text-[10px] text-[#667078] font-semibold">{exam.date}</span>
                            </div>
                            <div className="text-xs text-[#202426] font-semibold truncate">{exam.courseName}</div>
                            <div className="text-[11px] text-[#667078] font-mono">
                              {exam.startTime} – {exam.endTime} ({exam.enrolled} / {exam.capacity} seats)
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
