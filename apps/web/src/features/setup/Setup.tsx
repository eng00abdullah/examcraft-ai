import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileCode,
  Layers,
  Users,
  Building,
  Calendar,
  Sliders,
  Play,
  Globe,
  Clock,
  Check,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { ProblemDocument, Course, Student, Slot, Room } from '../../api/types';
import { validateProblem } from '../../api/client';
import {
  TINY_FEASIBLE,
  TINY_INFEASIBLE,
  DEMO_SMALL,
  SIMULTANEOUS_AND_OFFHOURS,
} from '../samples/sampleData';

interface SetupProps {
  problem: ProblemDocument;
  setProblem: React.Dispatch<React.SetStateAction<ProblemDocument>>;
  revisionId: string | null;
  problemHash: string | null;
  isDirty: boolean;
  onCommitRevision: (prob?: ProblemDocument) => Promise<any>;
  onProceedToLab: () => void;
}

export const Setup: React.FC<SetupProps> = ({
  problem,
  setProblem,
  revisionId,
  problemHash,
  isDirty,
  onCommitRevision,
  onProceedToLab,
}) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'courses' | 'students' | 'rooms' | 'slots' | 'constraints'
  >('courses');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: any[];
    preflight: any;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSavingLocal, setIsSavingLocal] = useState<boolean>(false);

  // Course slot picker modal state
  const [editingCourseSlots, setEditingCourseSlots] = useState<Course | null>(null);

  // New room blackout state
  const [blackoutInput, setBlackoutInput] = useState<{
    roomId: string;
    date: string;
    start_time: string;
    end_time: string;
  }>({
    roomId: '',
    date: '2026-12-01',
    start_time: '09:00',
    end_time: '12:00',
  });

  // Re-validate problem on any change
  useEffect(() => {
    let isCancelled = false;
    validateProblem(problem)
      .then((res) => {
        if (!isCancelled) setValidationResult(res);
      })
      .catch((err) => {
        if (!isCancelled) {
          setValidationResult({
            valid: false,
            errors: [{ field: 'root', code: 'network', message: err.message }],
            preflight: null,
          });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [problem]);

  // Handle Save revision using centralized commit
  const handleSaveRevision = async () => {
    try {
      setIsSavingLocal(true);
      setSaveStatus('Committing revision to database...');
      const res = await onCommitRevision(problem);
      setSaveStatus(`Committed revision ${res.revision_id.slice(0, 8)} (${res.problem_hash.slice(0, 8)})`);
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setSaveStatus(`Save error: ${err.message}`);
    } finally {
      setIsSavingLocal(false);
    }
  };

  // Sample loading with deep cloning
  const handleLoadSample = (sample: ProblemDocument) => {
    const cloned = JSON.parse(JSON.stringify(sample));
    setProblem(cloned);
    setSaveStatus('Loaded sample into workspace. Please commit revision to schedule.');
    setTimeout(() => setSaveStatus(null), 4000);
  };

  // Import JSON with strict pre-validation
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.courses || !parsed.slots || !parsed.rooms) {
          throw new Error('Missing essential collections (courses, slots, rooms)');
        }
        // Strict pre-validation with server before replacing state
        const valRes = await validateProblem(parsed);
        if (!valRes.valid) {
          const errMsgs = valRes.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ');
          setJsonError(`Import rejected: Structural validation failed (${errMsgs})`);
          return;
        }
        setProblem(parsed);
        setJsonError(null);
        setSaveStatus(`Successfully imported and validated ${file.name}. Please commit revision.`);
        setTimeout(() => setSaveStatus(null), 4000);
      } catch (err: any) {
        setJsonError(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(problem, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `problem-${problem.id || 'setup'}.json`);
    dlAnchor.click();
  };

  // Helper collision-free ID generators
  const getNextCourseId = () => {
    const maxNum = problem.courses.reduce((max, c) => {
      const n = parseInt(c.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `C${maxNum + 1}`;
  };

  const getNextStudentId = () => {
    const maxNum = problem.students.reduce((max, s) => {
      const n = parseInt(s.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `S${maxNum + 1}`;
  };

  const getNextRoomId = () => {
    const maxNum = problem.rooms.reduce((max, r) => {
      const n = parseInt(r.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `R${maxNum + 1}`;
  };

  const getNextSlotId = () => {
    const maxNum = problem.slots.reduce((max, s) => {
      const n = parseInt(s.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `T${maxNum + 1}`;
  };

  // Student counts map
  const studentCountPerCourse = problem.courses.reduce((acc, c) => {
    acc[c.id] = problem.enrollments.filter((e) => e.course_id === c.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 font-sans text-[#202426]">
      {/* Top Header Card (Warm Paper / Pure White) */}
      <div className="bg-white rounded-2xl border border-[#E7E2DA] shadow-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-[#202426] tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#E64B3C]" />
              Problem Configuration & Data Setup
            </h1>
            {isDirty ? (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-md font-semibold bg-[#FFF4D8] text-[#B7791F] border border-[#B7791F]/30 flex items-center gap-1.5 shadow-xs">
                <AlertCircle className="w-3.5 h-3.5 text-[#B7791F]" />
                Unsaved Draft Modifications
              </span>
            ) : revisionId ? (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-md font-semibold bg-[#E8F5EE] text-[#168A65] border border-[#168A65]/30 flex items-center gap-1.5 shadow-xs">
                <Check className="w-3.5 h-3.5 text-[#168A65]" />
                Committed: {revisionId.slice(0, 8)}
              </span>
            ) : (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-md font-semibold bg-[#FCEAEA] text-[#C94444] border border-[#C94444]/30">
                Uncommitted Draft
              </span>
            )}
          </div>
          <p className="text-xs text-[#667078] mt-1.5 max-w-2xl leading-relaxed">
            Define courses, student enrollments, exam slots, room capacities, hard scheduling constraints, and soft objective penalty weights.
          </p>
        </div>

        {/* Action Controls & Sample Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sample Loader */}
          <div className="flex items-center gap-1 bg-[#FAF8F4] p-1 rounded-xl border border-[#E7E2DA] text-xs">
            <span className="text-[#667078] px-2 font-medium">Load Sample:</span>
            <button
              onClick={() => handleLoadSample(TINY_FEASIBLE)}
              className="px-2.5 py-1.5 bg-white hover:bg-[#F5F2EC] text-[#202426] rounded-lg font-medium border border-[#E7E2DA] shadow-xs transition"
            >
              Tiny Feasible
            </button>
            <button
              onClick={() => handleLoadSample(TINY_INFEASIBLE)}
              className="px-2.5 py-1.5 bg-white hover:bg-[#F5F2EC] text-[#202426] rounded-lg font-medium border border-[#E7E2DA] shadow-xs transition"
            >
              Tiny Infeasible
            </button>
            <button
              onClick={() => handleLoadSample(DEMO_SMALL)}
              className="px-2.5 py-1.5 bg-white hover:bg-[#F5F2EC] text-[#202426] rounded-lg font-medium border border-[#E7E2DA] shadow-xs transition"
            >
              Demo Small
            </button>
            <button
              onClick={() => handleLoadSample(SIMULTANEOUS_AND_OFFHOURS)}
              className="px-2.5 py-1.5 bg-[#FFF0EC] hover:bg-[#FFE0D8] text-[#E64B3C] border border-[#F4C1B8] rounded-lg font-medium transition"
              title="Parallel room lanes and off-hours exam window"
            >
              Simultaneous & Off-Hours
            </button>
          </div>

          {/* Import / Export Buttons */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#FAF8F4] text-[#202426] text-xs font-medium rounded-xl border border-[#E7E2DA] cursor-pointer shadow-xs transition">
            <Upload className="w-3.5 h-3.5 text-[#667078]" />
            Import JSON
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#FAF8F4] text-[#202426] text-xs font-medium rounded-xl border border-[#E7E2DA] shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-[#667078]" />
            Export JSON
          </button>

          {/* Commit Revision Button */}
          <button
            onClick={handleSaveRevision}
            disabled={isSavingLocal}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition ${
              isDirty
                ? 'bg-[#E64B3C] hover:bg-[#CC3E31] text-white shadow-vermilion'
                : 'bg-[#FAF8F4] hover:bg-[#E7E2DA] text-[#202426] border border-[#E7E2DA]'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingLocal ? 'Committing...' : 'Commit Revision'}
          </button>
        </div>
      </div>

      {/* Notification Banners */}
      {saveStatus && (
        <div className="bg-[#EAF3F4] border border-[#467B87]/30 text-[#467B87] px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#467B87]" />
          {saveStatus}
        </div>
      )}
      {jsonError && (
        <div className="bg-[#FCEAEA] border border-[#C94444]/30 text-[#C94444] px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#C94444]" />
          {jsonError}
        </div>
      )}

      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="bg-[#FFF4D8] border border-[#B7791F]/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-subtle">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#B7791F] flex-shrink-0" />
            <div>
              <span className="font-bold text-[#B7791F] block">Unsaved Modifications in Working Problem Draft</span>
              <p className="text-[#8C5E16] mt-0.5">
                Modifications have been made in this session. Remember to click "Commit Revision" before running searches so the solver schedules your exact edits.
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveRevision}
            disabled={isSavingLocal}
            className="px-3.5 py-1.5 bg-[#B7791F] hover:bg-[#966318] text-white font-semibold rounded-lg shadow-xs transition"
          >
            {isSavingLocal ? 'Saving...' : 'Commit Revision'}
          </button>
        </div>
      )}

      {/* Main Workspace Layout: 3 Columns for editing tabs + 1 Column for readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Guided Tabs & Form Panels (Span 3) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Step Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#E7E2DA] shadow-subtle">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition ${
                activeTab === 'general'
                  ? 'bg-[#E64B3C] text-white shadow-xs'
                  : 'text-[#667078] hover:text-[#202426] hover:bg-[#FAF8F4]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              General & Timezone
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition ${
                activeTab === 'courses'
                  ? 'bg-[#E64B3C] text-white shadow-xs'
                  : 'text-[#667078] hover:text-[#202426] hover:bg-[#FAF8F4]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Courses ({problem.courses.length})
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition ${
                activeTab === 'students'
                  ? 'bg-[#E64B3C] text-white shadow-xs'
                  : 'text-[#667078] hover:text-[#202426] hover:bg-[#FAF8F4]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Students & Enrollments ({problem.students.length})
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition ${
                activeTab === 'rooms'
                  ? 'bg-[#E64B3C] text-white shadow-xs'
                  : 'text-[#667078] hover:text-[#202426] hover:bg-[#FAF8F4]'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Rooms & Blackouts ({problem.rooms.length})
            </button>
            <button
              onClick={() => setActiveTab('slots')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition ${
                activeTab === 'slots'
                  ? 'bg-[#E64B3C] text-white shadow-xs'
                  : 'text-[#667078] hover:text-[#202426] hover:bg-[#FAF8F4]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Dates & Slots ({problem.slots.length})
            </button>
            <button
              onClick={() => setActiveTab('constraints')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition ${
                activeTab === 'constraints'
                  ? 'bg-[#E64B3C] text-white shadow-xs'
                  : 'text-[#667078] hover:text-[#202426] hover:bg-[#FAF8F4]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Constraints & Preferences
            </button>
          </div>

          {/* TAB 0: GENERAL & TIMEZONE */}
          {activeTab === 'general' && (
            <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
              <div>
                <h3 className="font-display font-bold text-sm text-[#202426]">Problem Identification & Timezone</h3>
                <p className="text-xs text-[#667078]">
                  Timezone governs UTC instant translation and daylight saving boundary accounting.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#202426] mb-1">Problem Title / Name</label>
                  <input
                    type="text"
                    value={problem.name}
                    onChange={(e) => setProblem((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] focus:ring-1 focus:ring-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] shadow-xs outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#202426] mb-1">IANA Timezone</label>
                  <input
                    type="text"
                    value={problem.timezone}
                    onChange={(e) => setProblem((p) => ({ ...p, timezone: e.target.value }))}
                    placeholder="UTC, Africa/Cairo, Europe/London, America/New_York"
                    className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] focus:ring-1 focus:ring-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] font-mono shadow-xs outline-none transition"
                  />
                  <span className="text-[11px] text-[#667078] mt-1.5 block">
                    Default: <code className="text-[#E64B3C] font-semibold">UTC</code>. Transitions are strictly validated for ambiguous or nonexistent local times.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: COURSES */}
          {activeTab === 'courses' && (
            <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-[#202426]">Courses to Schedule</h3>
                  <p className="text-xs text-[#667078]">Each course requires exactly one examination placement in a suitable slot and room.</p>
                </div>
                <button
                  onClick={() => {
                    const newId = getNextCourseId();
                    setProblem((p) => ({
                      ...p,
                      courses: [
                        ...p.courses,
                        { id: newId, code: `CS${100 + p.courses.length}`, name: 'New Course', duration_minutes: 60, allowed_slot_ids: null },
                      ],
                    }));
                  }}
                  className="flex items-center gap-1 px-3.5 py-2 bg-[#E64B3C] hover:bg-[#CC3E31] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
              </div>

              <div className="overflow-x-auto border border-[#E7E2DA] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F4] border-b border-[#E7E2DA] text-[#667078] font-semibold">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Course Name</th>
                      <th className="py-2.5 px-3">Duration (min)</th>
                      <th className="py-2.5 px-3">Enrolled</th>
                      <th className="py-2.5 px-3">Allowed Slots</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E2DA]">
                    {problem.courses.map((course, idx) => (
                      <tr key={course.id} className="hover:bg-[#FAF8F4]/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-[#E64B3C] font-semibold">{course.id}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={course.code}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const courses = [...p.courses];
                                courses[idx].code = val;
                                return { ...p, courses };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] font-mono text-xs w-24 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={course.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const courses = [...p.courses];
                                courses[idx].name = val;
                                return { ...p, courses };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs w-48 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            data-testid="course-duration-input"
                            value={course.duration_minutes}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 60;
                              setProblem((p) => ({
                                ...p,
                                courses: p.courses.map((c, i) => (i === idx ? { ...c, duration_minutes: val } : c)),
                              }));
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs w-20 text-center outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#202426] tabular-nums">
                          {studentCountPerCourse[course.id] || 0} students
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setEditingCourseSlots(course)}
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-[#FAF8F4] hover:bg-[#E7E2DA] border border-[#E7E2DA] text-[#202426] font-medium transition"
                          >
                            {course.allowed_slot_ids && course.allowed_slot_ids.length > 0 ? (
                              <span>{course.allowed_slot_ids.length} restricted</span>
                            ) : (
                              <span className="text-[#168A65] font-semibold">All Slots</span>
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => {
                              setProblem((p) => ({
                                ...p,
                                courses: p.courses.filter((_, i) => i !== idx),
                                enrollments: p.enrollments.filter((e) => e.course_id !== course.id),
                              }));
                            }}
                            className="text-[#C94444] hover:text-[#B73529] p-1.5 rounded-lg hover:bg-[#FCEAEA] transition"
                            title="Delete course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS & ENROLLMENTS */}
          {activeTab === 'students' && (
            <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-[#202426]">Students & Course Enrollments</h3>
                  <p className="text-xs text-[#667078]">Students taking multiple courses create conflict constraints and soft gap penalties.</p>
                </div>
                <button
                  onClick={() => {
                    const newId = getNextStudentId();
                    setProblem((p) => ({
                      ...p,
                      students: [...p.students, { id: newId, display_name: `Student ${newId}` }],
                    }));
                  }}
                  className="flex items-center gap-1 px-3.5 py-2 bg-[#E64B3C] hover:bg-[#CC3E31] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Student
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {problem.students.map((student, sIdx) => {
                  const studentCourseIds = problem.enrollments
                    .filter((e) => e.student_id === student.id)
                    .map((e) => e.course_id);

                  return (
                    <div key={student.id} className="p-3.5 rounded-xl border border-[#E7E2DA] bg-[#FAF8F4] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#E64B3C]">{student.id}</span>
                          <input
                            type="text"
                            value={student.display_name || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const students = [...p.students];
                                students[sIdx].display_name = val;
                                return { ...p, students };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-0.5 text-xs text-[#202426] font-medium outline-none"
                            placeholder="Student Name"
                          />
                        </div>
                        <button
                          onClick={() => {
                            setProblem((p) => ({
                              ...p,
                              students: p.students.filter((_, i) => i !== sIdx),
                              enrollments: p.enrollments.filter((e) => e.student_id !== student.id),
                            }));
                          }}
                          className="text-[#C94444] hover:text-[#B73529] p-1 rounded-lg hover:bg-[#FCEAEA] transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Course Selection Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-[#667078] font-medium mr-1">Enrolled Courses:</span>
                        {problem.courses.map((course) => {
                          const isEnrolled = studentCourseIds.includes(course.id);
                          return (
                            <button
                              key={course.id}
                              onClick={() => {
                                setProblem((p) => {
                                  if (isEnrolled) {
                                    return {
                                      ...p,
                                      enrollments: p.enrollments.filter(
                                        (e) => !(e.student_id === student.id && e.course_id === course.id)
                                      ),
                                    };
                                  } else {
                                    return {
                                      ...p,
                                      enrollments: [...p.enrollments, { student_id: student.id, course_id: course.id }],
                                    };
                                  }
                                });
                              }}
                              className={`px-2.5 py-1 text-[11px] rounded-lg font-mono transition ${
                                isEnrolled
                                  ? 'bg-[#E64B3C] text-white font-bold shadow-xs'
                                  : 'bg-white hover:bg-[#E7E2DA] text-[#667078] border border-[#E7E2DA]'
                              }`}
                            >
                              {course.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ROOMS & BLACKOUTS */}
          {activeTab === 'rooms' && (
            <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-[#202426]">Rooms & Capacities</h3>
                  <p className="text-xs text-[#667078]">Room capacity restricts total exam enrollment. Rooms can have blackout maintenance windows.</p>
                </div>
                <button
                  onClick={() => {
                    const newId = getNextRoomId();
                    setProblem((p) => ({
                      ...p,
                      rooms: [
                        ...p.rooms,
                        { id: newId, name: `Room ${newId}`, capacity: 40, unavailable: [] },
                      ],
                    }));
                  }}
                  className="flex items-center gap-1 px-3.5 py-2 bg-[#E64B3C] hover:bg-[#CC3E31] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Room
                </button>
              </div>

              <div className="overflow-x-auto border border-[#E7E2DA] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F4] border-b border-[#E7E2DA] text-[#667078] font-semibold">
                      <th className="py-2.5 px-3">Room ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Capacity (seats)</th>
                      <th className="py-2.5 px-3">Blackouts</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E2DA]">
                    {problem.rooms.map((room, idx) => (
                      <tr key={room.id} className="hover:bg-[#FAF8F4]/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-[#E64B3C] font-semibold">{room.id}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={room.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const rooms = [...p.rooms];
                                rooms[idx].name = val;
                                return { ...p, rooms };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            value={room.capacity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setProblem((p) => {
                                const rooms = [...p.rooms];
                                rooms[idx].capacity = val;
                                return { ...p, rooms };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs w-20 text-center outline-none tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-xs text-[#667078] font-mono">
                            {room.unavailable ? room.unavailable.length : 0} window(s)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => {
                              setProblem((p) => ({
                                ...p,
                                rooms: p.rooms.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-[#C94444] hover:text-[#B73529] p-1.5 rounded-lg hover:bg-[#FCEAEA] transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Room Blackout Window */}
              <div className="p-4 rounded-xl border border-[#E7E2DA] bg-[#FAF8F4] space-y-3">
                <span className="text-xs font-bold text-[#202426] uppercase tracking-wider block">
                  Add Room Maintenance Blackout Window
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end text-xs">
                  <div>
                    <label className="block text-[#667078] mb-1 font-medium">Select Room</label>
                    <select
                      value={blackoutInput.roomId || problem.rooms[0]?.id || ''}
                      onChange={(e) => setBlackoutInput({ ...blackoutInput, roomId: e.target.value })}
                      className="w-full bg-white border border-[#E7E2DA] rounded-lg p-1.5 text-xs text-[#202426] outline-none"
                    >
                      {problem.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#667078] mb-1 font-medium">Date</label>
                    <input
                      type="date"
                      value={blackoutInput.date}
                      onChange={(e) => setBlackoutInput({ ...blackoutInput, date: e.target.value })}
                      className="w-full bg-white border border-[#E7E2DA] rounded-lg p-1.5 text-xs text-[#202426] outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#667078] mb-1 font-medium">Start Time</label>
                    <input
                      type="time"
                      value={blackoutInput.start_time}
                      onChange={(e) => setBlackoutInput({ ...blackoutInput, start_time: e.target.value })}
                      className="w-full bg-white border border-[#E7E2DA] rounded-lg p-1.5 text-xs text-[#202426] outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#667078] mb-1 font-medium">End Time</label>
                    <input
                      type="time"
                      value={blackoutInput.end_time}
                      onChange={(e) => setBlackoutInput({ ...blackoutInput, end_time: e.target.value })}
                      className="w-full bg-white border border-[#E7E2DA] rounded-lg p-1.5 text-xs text-[#202426] outline-none font-mono"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const targetRoomId = blackoutInput.roomId || problem.rooms[0]?.id;
                      if (!targetRoomId) return;
                      setProblem((p) => {
                        const rooms = p.rooms.map((r) => {
                          if (r.id === targetRoomId) {
                            return {
                              ...r,
                              unavailable: [
                                ...r.unavailable,
                                {
                                  date: blackoutInput.date,
                                  start_time: blackoutInput.start_time,
                                  end_time: blackoutInput.end_time,
                                },
                              ],
                            };
                          }
                          return r;
                        });
                        return { ...p, rooms };
                      });
                    }}
                    className="px-3.5 py-1.5 bg-[#C94444] hover:bg-[#B73529] text-white rounded-lg font-semibold transition"
                  >
                    Add Blackout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SLOTS */}
          {activeTab === 'slots' && (
            <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-[#202426]">Dates & Examination Slots</h3>
                  <p className="text-xs text-[#667078]">
                    Half-open intervals <span className="font-mono text-[#E64B3C] font-semibold">[start, end)</span>. Overlapping slots represent valid candidate placement windows.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newId = getNextSlotId();
                    setProblem((p) => ({
                      ...p,
                      slots: [
                        ...p.slots,
                        { id: newId, date: '2026-12-01', start_time: '09:00', end_time: '11:00' },
                      ],
                    }));
                  }}
                  className="flex items-center gap-1 px-3.5 py-2 bg-[#E64B3C] hover:bg-[#CC3E31] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slot
                </button>
              </div>

              <div className="overflow-x-auto border border-[#E7E2DA] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F4] border-b border-[#E7E2DA] text-[#667078] font-semibold">
                      <th className="py-2.5 px-3">Slot ID</th>
                      <th className="py-2.5 px-3">Date (YYYY-MM-DD)</th>
                      <th className="py-2.5 px-3">Start Time (HH:MM)</th>
                      <th className="py-2.5 px-3">End Time (HH:MM)</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E2DA]">
                    {problem.slots.map((slot, idx) => (
                      <tr key={slot.id} className="hover:bg-[#FAF8F4]/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-[#E64B3C] font-semibold">{slot.id}</td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={slot.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const slots = [...p.slots];
                                slots[idx].date = val;
                                return { ...p, slots };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs font-mono outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="time"
                            value={slot.start_time}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const slots = [...p.slots];
                                slots[idx].start_time = val;
                                return { ...p, slots };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs font-mono outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="time"
                            value={slot.end_time}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProblem((p) => {
                                const slots = [...p.slots];
                                slots[idx].end_time = val;
                                return { ...p, slots };
                              });
                            }}
                            className="bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-lg px-2 py-1 text-[#202426] text-xs font-mono outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => {
                              setProblem((p) => ({
                                ...p,
                                slots: p.slots.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-[#C94444] hover:text-[#B73529] p-1.5 rounded-lg hover:bg-[#FCEAEA] transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: CONSTRAINTS & PREFERENCES */}
          {activeTab === 'constraints' && (
            <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-6 shadow-card">
              <div>
                <h3 className="font-display font-bold text-sm text-[#202426]">Hard Constraints & Soft Preferences</h3>
                <p className="text-xs text-[#667078]">Hard constraints must be satisfied for feasibility. Preferences calculate non-negative penalty metrics.</p>
              </div>

              {/* Hard Constraints Box */}
              <div className="bg-[#FAF8F4] p-5 rounded-xl border border-[#E7E2DA] space-y-4">
                <span className="text-xs font-bold text-[#C94444] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#C94444]" />
                  Must Satisfy (Hard Constraints)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#202426] font-semibold mb-1">
                      Max Exams per Student per Day (optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="None (unbounded)"
                      value={problem.constraints.max_exams_per_student_per_day || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        setProblem((p) => ({
                          ...p,
                          constraints: { ...p.constraints, max_exams_per_student_per_day: val },
                        }));
                      }}
                      className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#202426] font-semibold mb-1">
                      Hard Minimum Gap Between Exams (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={problem.constraints.minimum_gap_minutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setProblem((p) => ({
                          ...p,
                          constraints: { ...p.constraints, minimum_gap_minutes: val },
                        }));
                      }}
                      className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Soft Preferences Box */}
              <div className="bg-[#FAF8F4] p-5 rounded-xl border border-[#E7E2DA] space-y-4">
                <span className="text-xs font-bold text-[#E64B3C] uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#E64B3C]" />
                  Preferences (Non-negative Objective Weights)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#202426] font-semibold mb-1">
                      Same-Day Exam Weight (per shared student pair)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={problem.objective.same_day_weight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setProblem((p) => ({
                          ...p,
                          objective: { ...p.objective, same_day_weight: val },
                        }));
                      }}
                      className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#202426] font-semibold mb-1">
                      Short-Gap Weight (gap &lt; preferred minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={problem.objective.short_gap_weight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setProblem((p) => ({
                          ...p,
                          objective: { ...p.objective, short_gap_weight: val },
                        }));
                      }}
                      className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#202426] font-semibold mb-1">
                      Preferred Rest Gap (minutes, default 60)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={problem.objective.preferred_gap_minutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setProblem((p) => ({
                          ...p,
                          objective: { ...p.objective, preferred_gap_minutes: val },
                        }));
                      }}
                      className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#202426] font-semibold mb-1">
                      Spare Room Seat Weight (room capacity - students)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={problem.objective.spare_seat_weight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setProblem((p) => ({
                          ...p,
                          objective: { ...p.objective, spare_seat_weight: val },
                        }));
                      }}
                      className="w-full bg-white border border-[#E7E2DA] focus:border-[#E64B3C] rounded-xl px-3 py-2 text-xs text-[#202426] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Persistent Readiness & Summary (Span 1) */}
        <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-5 shadow-card">
          <h3 className="font-display font-bold text-xs text-[#202426] uppercase tracking-wider">Readiness & Validation</h3>

          {/* Counts */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#E7E2DA]">
              <span className="text-[#667078] block text-[10px]">Courses</span>
              <span className="font-bold text-[#202426] text-sm tabular-nums">{problem.courses.length}</span>
            </div>
            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#E7E2DA]">
              <span className="text-[#667078] block text-[10px]">Students</span>
              <span className="font-bold text-[#202426] text-sm tabular-nums">{problem.students.length}</span>
            </div>
            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#E7E2DA]">
              <span className="text-[#667078] block text-[10px]">Enrollments</span>
              <span className="font-bold text-[#202426] text-sm tabular-nums">{problem.enrollments.length}</span>
            </div>
            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#E7E2DA]">
              <span className="text-[#667078] block text-[10px]">Rooms</span>
              <span className="font-bold text-[#202426] text-sm tabular-nums">{problem.rooms.length}</span>
            </div>
            <div className="col-span-2 bg-[#FAF8F4] p-3 rounded-xl border border-[#E7E2DA]">
              <span className="text-[#667078] block text-[10px]">Time Slots</span>
              <span className="font-bold text-[#202426] text-sm tabular-nums">{problem.slots.length}</span>
            </div>
          </div>

          {/* Validation Status */}
          {validationResult && (
            <div className="space-y-2">
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  validationResult.valid
                    ? 'bg-[#E8F5EE] border-[#168A65]/40 text-[#168A65]'
                    : 'bg-[#FCEAEA] border-[#C94444]/40 text-[#C94444]'
                }`}
              >
                {validationResult.valid ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#168A65]" />
                    <span>Structurally Valid Setup</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-[#C94444]" />
                    <span>{validationResult.errors.length} Validation Error(s)</span>
                  </>
                )}
              </div>

              {!validationResult.valid && (
                <div className="bg-[#FAF8F4] p-2.5 rounded-xl border border-[#E7E2DA] max-h-40 overflow-y-auto space-y-1 text-[11px] text-[#C94444]">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="leading-tight">
                      • {err.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Preflight warnings */}
              {validationResult.preflight && validationResult.preflight.warnings.length > 0 && (
                <div className="bg-[#FFF4D8] p-3 rounded-xl border border-[#B7791F]/40 text-[11px] text-[#8C5E16] space-y-1">
                  <span className="font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#B7791F]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Preflight Warnings:
                  </span>
                  {validationResult.preflight.warnings.map((w: string, i: number) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Continue Action */}
          <button
            onClick={onProceedToLab}
            disabled={!validationResult?.valid}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition ${
              validationResult?.valid
                ? 'bg-[#E64B3C] hover:bg-[#CC3E31] text-white cursor-pointer shadow-vermilion'
                : 'bg-[#FAF8F4] text-[#667078] cursor-not-allowed border border-[#E7E2DA]'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Continue to Search Lab
          </button>
        </div>
      </div>

      {/* Course Allowed Slots Modal */}
      {editingCourseSlots && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h4 className="font-display font-bold text-sm text-[#202426]">Allowed Slots for {editingCourseSlots.code}</h4>
                <p className="text-xs text-[#667078]">Restrict which examination time windows this course can use.</p>
              </div>
              <button onClick={() => setEditingCourseSlots(null)} className="text-[#667078] hover:text-[#202426]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <label className="flex items-center gap-2 text-xs text-[#202426] cursor-pointer p-2 rounded-xl hover:bg-[#FAF8F4]">
                <input
                  type="checkbox"
                  checked={editingCourseSlots.allowed_slot_ids === null}
                  onChange={(e) => {
                    const newSlots = e.target.checked ? null : [];
                    setEditingCourseSlots({ ...editingCourseSlots, allowed_slot_ids: newSlots });
                    setProblem((p) => ({
                      ...p,
                      courses: p.courses.map((c) =>
                        c.id === editingCourseSlots.id ? { ...c, allowed_slot_ids: newSlots } : c
                      ),
                    }));
                  }}
                  className="rounded border-[#E7E2DA] text-[#E64B3C] focus:ring-[#E64B3C]"
                />
                <span className="font-semibold text-[#E64B3C]">Allow in All Slots (Unrestricted)</span>
              </label>

              {editingCourseSlots.allowed_slot_ids !== null && (
                <div className="pl-4 border-l-2 border-[#E7E2DA] space-y-1">
                  {problem.slots.map((s) => {
                    const isChecked = editingCourseSlots.allowed_slot_ids?.includes(s.id) ?? false;
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-[#202426] cursor-pointer p-1.5 rounded-lg hover:bg-[#FAF8F4]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = editingCourseSlots.allowed_slot_ids || [];
                            const updated = e.target.checked ? [...cur, s.id] : cur.filter((id) => id !== s.id);
                            setEditingCourseSlots({ ...editingCourseSlots, allowed_slot_ids: updated });
                            setProblem((p) => ({
                              ...p,
                              courses: p.courses.map((c) =>
                                c.id === editingCourseSlots.id ? { ...c, allowed_slot_ids: updated } : c
                              ),
                            }));
                          }}
                          className="rounded border-[#E7E2DA] text-[#E64B3C] focus:ring-[#E64B3C]"
                        />
                        <span className="font-mono text-[#E64B3C] font-semibold">{s.id}:</span>
                        <span className="text-[#667078]">{s.date} {s.start_time}–{s.end_time}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E7E2DA]">
              <button
                onClick={() => setEditingCourseSlots(null)}
                className="px-4 py-2 bg-[#E64B3C] hover:bg-[#CC3E31] text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
