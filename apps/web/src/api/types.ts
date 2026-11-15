export interface Course {
  id: string;
  code: string;
  name: string;
  duration_minutes: number;
  allowed_slot_ids?: string[] | null;
}

export interface Student {
  id: string;
  display_name: string;
}

export interface Enrollment {
  student_id: string;
  course_id: string;
}

export interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface RoomUnavailable {
  date: string;
  start_time: string;
  end_time: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  unavailable: RoomUnavailable[];
}

export interface Constraints {
  max_exams_per_student_per_day?: number | null;
  minimum_gap_minutes: number;
}

export interface Objective {
  same_day_weight: number;
  short_gap_weight: number;
  spare_seat_weight: number;
  preferred_gap_minutes: number;
}

export interface ProblemDocument {
  schema_version: string;
  id: string;
  name: string;
  timezone: string;
  courses: Course[];
  students: Student[];
  enrollments: Enrollment[];
  slots: Slot[];
  rooms: Room[];
  constraints: Constraints;
  objective: Objective;
}

export interface Assignment {
  course_id: string;
  slot_id: string;
  room_id: string;
}

export interface RunLimits {
  max_expanded_nodes: number;
  max_generated_nodes: number;
  max_frontier_nodes: number;
  max_search_seconds: number;
  max_wall_seconds: number;
}

export interface RunConfig {
  algorithm: "bfs" | "dfs" | "greedy" | "astar";
  heuristic: "admissible" | "zero";
  limits: RunLimits;
  teaching_speed_ms: number;
}

export type SearchEventKind =
  | "run_started"
  | "node_popped"
  | "action_rejected"
  | "child_enqueued"
  | "forward_pruned"
  | "goal_found"
  | "run_finished";

export interface MetricsSnapshot {
  generated_nodes: number;
  explored_nodes: number;
  expanded_nodes: number;
  candidate_actions: number;
  valid_actions: number;
  invalid_actions: number;
  forward_pruned_actions: number;
  enqueued_actions: number;
  budget_blocked_actions: number;
  frontier_size: number;
  peak_frontier_size: number;
  max_depth: number;
  search_compute_ms: number;
  preprocessing_ms: number;
  final_validation_ms: number;
  run_wall_ms: number;
}

export interface SearchEvent {
  sequence: number;
  run_id: string;
  problem_hash: string;
  kind: SearchEventKind;
  timestamp: number;
  node_id?: string | null;
  parent_id?: string | null;
  course_id?: string | null;
  slot_id?: string | null;
  room_id?: string | null;
  depth?: number | null;
  g?: number | null;
  h?: number | null;
  f?: number | null;
  rejection_code?: string | null;
  rejection_reason?: string | null;
  rejection_details?: Record<string, any> | null;
  assignments?: Array<{ course_id: string; slot_id: string; room_id: string }> | null;
  metrics?: MetricsSnapshot | null;
  status?: string | null;
}

export type RunStatus =
  | "CREATED"
  | "RUNNING"
  | "PAUSED"
  | "SUCCEEDED"
  | "INFEASIBLE"
  | "LIMIT_REACHED"
  | "CANCELLED"
  | "INTERRUPTED"
  | "ERROR"
  | "INVALID_INPUT";

export interface ValidationReport {
  valid: boolean;
  violations: Array<Record<string, any>>;
  penalty?: number | null;
  breakdown?: Record<string, any> | null;
}

export interface RunRecord {
  run_id: string;
  revision_id: string;
  problem_hash: string;
  algorithm: string;
  status: RunStatus;
  optimality_proven: boolean;
  config: RunConfig;
  problem: ProblemDocument;
  assignments?: Assignment[] | null;
  metrics: MetricsSnapshot;
  validation?: ValidationReport | null;
  terminal_reason?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface ComparisonTrial {
  algorithm: string;
  status: string;
  optimality_proven: boolean;
  penalty?: number | null;
  penalty_breakdown?: Record<string, any> | null;
  metrics: MetricsSnapshot;
  terminal_reason?: string | null;
}

export interface ComparisonSummary {
  comparison_id: string;
  revision_id: string;
  problem_hash: string;
  method: string;
  trials: ComparisonTrial[];
  recognitions: {
    fastest_successful?: string | null;
    fewest_explored?: string | null;
    lowest_observed_penalty?: string | null;
  };
}
