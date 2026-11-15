import { ProblemDocument } from '../../api/types';

export const TINY_FEASIBLE: ProblemDocument = {
  schema_version: "1.0",
  id: "tiny_feasible",
  name: "Tiny Feasible (Feasibility vs Solution Quality)",
  timezone: "Africa/Cairo",
  courses: [
    { id: "A", code: "AI101", name: "Artificial Intelligence", duration_minutes: 60, allowed_slot_ids: null },
    { id: "B", code: "DS201", name: "Data Structures", duration_minutes: 60, allowed_slot_ids: null }
  ],
  students: [
    { id: "S1", display_name: "Student One" }
  ],
  enrollments: [
    { student_id: "S1", course_id: "A" },
    { student_id: "S1", course_id: "B" }
  ],
  slots: [
    { id: "T1", date: "2026-12-01", start_time: "09:00", end_time: "10:00" },
    { id: "T2", date: "2026-12-01", start_time: "10:00", end_time: "11:00" },
    { id: "T3", date: "2026-12-02", start_time: "09:00", end_time: "10:00" }
  ],
  rooms: [
    { id: "R1", name: "Hall 1", capacity: 1, unavailable: [] }
  ],
  constraints: {
    max_exams_per_student_per_day: null,
    minimum_gap_minutes: 0
  },
  objective: {
    same_day_weight: 100,
    short_gap_weight: 30,
    spare_seat_weight: 1,
    preferred_gap_minutes: 60
  }
};

export const TINY_INFEASIBLE: ProblemDocument = {
  schema_version: "1.0",
  id: "tiny_infeasible",
  name: "Tiny Infeasible (Overconstrained Slots)",
  timezone: "Africa/Cairo",
  courses: [
    { id: "A", code: "CS101", name: "Intro to CS", duration_minutes: 60, allowed_slot_ids: null },
    { id: "B", code: "CS102", name: "Discrete Math", duration_minutes: 60, allowed_slot_ids: null },
    { id: "C", code: "CS103", name: "Linear Algebra", duration_minutes: 60, allowed_slot_ids: null }
  ],
  students: [
    { id: "S1", display_name: "Student One" }
  ],
  enrollments: [
    { student_id: "S1", course_id: "A" },
    { student_id: "S1", course_id: "B" },
    { student_id: "S1", course_id: "C" }
  ],
  slots: [
    { id: "T1", date: "2026-12-01", start_time: "09:00", end_time: "10:00" },
    { id: "T2", date: "2026-12-01", start_time: "09:30", end_time: "10:30" }
  ],
  rooms: [
    { id: "R1", name: "Room 101", capacity: 10, unavailable: [] },
    { id: "R2", name: "Room 102", capacity: 10, unavailable: [] }
  ],
  constraints: {
    max_exams_per_student_per_day: null,
    minimum_gap_minutes: 0
  },
  objective: {
    same_day_weight: 100,
    short_gap_weight: 30,
    spare_seat_weight: 1,
    preferred_gap_minutes: 60
  }
};

export const DEMO_SMALL: ProblemDocument = {
  schema_version: "1.0",
  id: "demo_small",
  name: "Demo Small (4-Course University Benchmark)",
  timezone: "Africa/Cairo",
  courses: [
    { id: "A", code: "CS101", name: "Introduction to Computer Science", duration_minutes: 120, allowed_slot_ids: null },
    { id: "B", code: "MATH201", name: "Linear Algebra", duration_minutes: 120, allowed_slot_ids: null },
    { id: "C", code: "AI301", name: "Artificial Intelligence", duration_minutes: 120, allowed_slot_ids: null },
    { id: "D", code: "SE401", name: "Software Engineering", duration_minutes: 120, allowed_slot_ids: null }
  ],
  students: [
    { id: "S1", display_name: "Student 01" },
    { id: "S2", display_name: "Student 02" },
    { id: "S3", display_name: "Student 03" },
    { id: "S4", display_name: "Student 04" },
    { id: "S5", display_name: "Student 05" },
    { id: "S6", display_name: "Student 06" }
  ],
  enrollments: [
    { student_id: "S1", course_id: "A" },
    { student_id: "S1", course_id: "B" },
    { student_id: "S2", course_id: "A" },
    { student_id: "S2", course_id: "C" },
    { student_id: "S3", course_id: "A" },
    { student_id: "S3", course_id: "D" },
    { student_id: "S4", course_id: "B" },
    { student_id: "S4", course_id: "C" },
    { student_id: "S5", course_id: "B" },
    { student_id: "S5", course_id: "D" },
    { student_id: "S6", course_id: "C" },
    { student_id: "S6", course_id: "D" }
  ],
  slots: [
    { id: "D1_M", date: "2026-12-01", start_time: "09:00", end_time: "11:00" },
    { id: "D1_A", date: "2026-12-01", start_time: "12:00", end_time: "14:00" },
    { id: "D2_M", date: "2026-12-02", start_time: "09:00", end_time: "11:00" },
    { id: "D2_A", date: "2026-12-02", start_time: "12:00", end_time: "14:00" }
  ],
  rooms: [
    { id: "R1", name: "Main Exam Hall", capacity: 3, unavailable: [] }
  ],
  constraints: {
    max_exams_per_student_per_day: 2,
    minimum_gap_minutes: 30
  },
  objective: {
    same_day_weight: 100,
    short_gap_weight: 30,
    spare_seat_weight: 1,
    preferred_gap_minutes: 60
  }
};

export const SIMULTANEOUS_AND_OFFHOURS: ProblemDocument = {
  schema_version: "1.0",
  id: "simultaneous_and_offhours",
  name: "Simultaneous & Off-Hours Benchmark",
  timezone: "Africa/Cairo",
  courses: [
    { id: "A", code: "EARLY101", name: "Early Morning Physics", duration_minutes: 60, allowed_slot_ids: ["T_EARLY"] },
    { id: "B", code: "PAR101", name: "Parallel Algorithms (Hall 1)", duration_minutes: 90, allowed_slot_ids: ["T_SIMUL"] },
    { id: "C", code: "PAR102", name: "Distributed Systems (Hall 2)", duration_minutes: 90, allowed_slot_ids: ["T_SIMUL"] },
    { id: "D", code: "LATE101", name: "Late Night Cryptography", duration_minutes: 60, allowed_slot_ids: ["T_LATE"] }
  ],
  students: [
    { id: "S1", display_name: "Student S1" },
    { id: "S2", display_name: "Student S2" },
    { id: "S3", display_name: "Student S3" },
    { id: "S4", display_name: "Student S4" }
  ],
  enrollments: [
    { student_id: "S1", course_id: "A" },
    { student_id: "S2", course_id: "B" },
    { student_id: "S3", course_id: "C" },
    { student_id: "S4", course_id: "D" }
  ],
  slots: [
    { id: "T_EARLY", date: "2026-12-01", start_time: "06:30", end_time: "08:00" },
    { id: "T_SIMUL", date: "2026-12-01", start_time: "09:00", end_time: "11:00" },
    { id: "T_LATE", date: "2026-12-01", start_time: "21:00", end_time: "22:30" }
  ],
  rooms: [
    { id: "R1", name: "Main Examination Hall 1", capacity: 15, unavailable: [] },
    { id: "R2", name: "Science Auditorium 2", capacity: 15, unavailable: [] }
  ],
  constraints: {
    max_exams_per_student_per_day: null,
    minimum_gap_minutes: 0
  },
  objective: {
    same_day_weight: 10,
    short_gap_weight: 10,
    spare_seat_weight: 1,
    preferred_gap_minutes: 60
  }
};
