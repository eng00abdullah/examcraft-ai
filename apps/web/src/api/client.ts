import {
  ProblemDocument,
  RunConfig,
  RunRecord,
  ValidationReport,
  ComparisonSummary,
} from './types';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
export const API_BASE = RAW_BASE
  ? (RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE.replace(/\/$/, '')}/api`)
  : '/api';

export async function checkHealth(): Promise<{ status: string; service: string; active_run: string | null }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function validateProblem(problem: ProblemDocument): Promise<{ valid: boolean; errors: any[]; preflight: any }> {
  const res = await fetch(`${API_BASE}/problems/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(problem),
  });
  if (!res.ok) throw new Error(`Validation request failed: ${res.statusText}`);
  return res.json();
}

export async function saveProblemRevision(
  problem: ProblemDocument,
  isDraft: boolean = false
): Promise<{ revision_id: string; problem_hash: string; name: string; is_draft: boolean }> {
  const res = await fetch(`${API_BASE}/problems?is_draft=${isDraft}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(problem),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ? JSON.stringify(err.detail) : `Save revision failed: ${res.statusText}`);
  }
  return res.json();
}

export async function listRevisions(): Promise<Array<{ revision_id: string; problem_hash: string; name: string; created_at: string; is_draft: boolean }>> {
  const res = await fetch(`${API_BASE}/problems`);
  if (!res.ok) throw new Error(`List revisions failed: ${res.statusText}`);
  return res.json();
}

export async function getRevision(revisionId: string): Promise<{ revision_id: string; problem_hash: string; name: string; problem: ProblemDocument; created_at: string }> {
  const res = await fetch(`${API_BASE}/problems/${revisionId}`);
  if (!res.ok) throw new Error(`Get revision failed: ${res.statusText}`);
  return res.json();
}

export async function startRun(
  revisionId: string,
  config: Partial<RunConfig>
): Promise<{ run_id: string; revision_id: string; problem_hash: string; status: string }> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision_id: revisionId, config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 409) {
      throw new Error(`Runner is currently busy with another active job (${err.detail?.active_run_id || 'active'})`);
    }
    throw new Error(err.detail?.message || `Start run failed: ${res.statusText}`);
  }
  return res.json();
}

export async function getRun(runId: string): Promise<RunRecord> {
  const res = await fetch(`${API_BASE}/runs/${runId}`);
  if (!res.ok) throw new Error(`Get run failed: ${res.statusText}`);
  return res.json();
}

export async function sendControl(
  runId: string,
  command: "pause" | "resume" | "step" | "cancel" | "reset" | "speed",
  speedMs?: number
): Promise<{ success: boolean; status: string; last_sequence: number; message: string; run_id?: string }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, speed_ms: speedMs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Control command failed: ${res.statusText}`);
  }
  return res.json();
}

export async function revalidateRun(runId: string, targetRevisionId?: string): Promise<ValidationReport & { target_revision_id: string; original_revision_id: string }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(targetRevisionId ? { target_revision_id: targetRevisionId } : {}),
  });
  if (!res.ok) throw new Error(`Revalidation failed: ${res.statusText}`);
  return res.json();
}

export async function runComparison(revisionId: string): Promise<ComparisonSummary> {
  const res = await fetch(`${API_BASE}/comparisons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision_id: revisionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || `Comparison failed: ${res.statusText}`);
  }
  return res.json();
}

export function getExportUrl(runId: string, format: 'json' | 'xlsx' | 'pdf', filterCourse?: string, filterRoom?: string, filterDate?: string): string {
  const params = new URLSearchParams({ format });
  if (filterCourse) params.append('course', filterCourse);
  if (filterRoom) params.append('room', filterRoom);
  if (filterDate) params.append('date', filterDate);
  return `${API_BASE}/runs/${runId}/export?${params.toString()}`;
}
