/**
 * roleRoomSelfTapesService.ts
 *
 * Self-Tape Studio frontend service-lag.
 *
 * Backend: talent-selftapes-routes.ts (Fase A).
 * Spec: docs/specs/SELF_TAPE_STUDIO_SPEC.md
 *
 * Bevarer ?demo=1 fra URL i alle requests (samme mønster som
 * roleRoomPartnershipsService.ts).
 */

export type SelftapeTakeStatus = 'uploading' | 'processing' | 'ready' | 'failed';
export type SelftapeProjectStatus = 'active' | 'submitted' | 'archived';
export type SelftapeTargetType = 'agency_direct' | 'private_link' | 'role_specific';
export type SelftapeSubmissionStatus =
  | 'draft' | 'ready' | 'submitted' | 'viewed' | 'shortlisted' | 'passed';

export interface SelftapeProject {
  id: string;
  name: string;
  poster_url: string | null;
  poster_color: string | null;
  status: SelftapeProjectStatus;
  role_name: string | null;
  role_type: string | null;
  scene_label: string | null;
  sides_pages: number | null;
  sides_content: string | null;
  brief_url?: string | null;
  current_take_id: string | null;
  takes_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SelftapeTake {
  id: string;
  take_number: number;
  duration_ms: number;
  thumbnail_url: string | null;
  video_url: string | null;
  stream_uid: string | null;
  hls_manifest?: string | null;
  status: SelftapeTakeStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  ai_feedback_id: string | null;
  recorded_at: string;
  created_at: string;
}

export interface SelftapeAIFeedbackCategory {
  grade: 'Great' | 'Good' | 'Needs work' | string;
  note: string;
}

export interface SelftapeAIFeedback {
  id: string;
  take_id: string;
  model_version: string | null;
  eye_line: SelftapeAIFeedbackCategory | null;
  pacing: SelftapeAIFeedbackCategory | null;
  sound: SelftapeAIFeedbackCategory | null;
  lighting: SelftapeAIFeedbackCategory | null;
  performance: SelftapeAIFeedbackCategory | null;
  camera_check: Record<string, string> | null;
  audio_check: Record<string, string> | null;
  framing_check: Record<string, string> | null;
  overall_grade: string | null;
  detailed_md: string | null;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  error_message?: string | null;
  generated_at: string | null;
  created_at: string;
}

export interface SelftapeSubmission {
  id: string;
  target_type: SelftapeTargetType;
  enabled: boolean;
  status: SelftapeSubmissionStatus;
  deadline_at: string | null;
  agency_org_id: string | null;
  agency_name?: string | null;
  agency_logo_url?: string | null;
  agency_preferred: boolean;
  private_token: string | null;
  private_expires_at?: string | null;
  casting_project_id: string | null;
  casting_project_name?: string | null;
  casting_role_id: string | null;
  submitted_at: string | null;
  viewed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface SelftapeSubmissionEvent {
  id: string;
  event_type: string;
  actor_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const BASE = '/api/role-room/talents/selftapes';

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  let url = `${BASE}${path}`;
  const qp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qp.set(k, String(v));
    });
  }
  // Bevar ?demo=1 fra nåværende URL i ALLE requests
  if (typeof window !== 'undefined' && !qp.has('demo')) {
    const cur = new URLSearchParams(window.location.search);
    if (cur.get('demo') === '1' || cur.get('demo') === 'true') qp.set('demo', '1');
  }
  const qs = qp.toString();
  if (qs) url += `?${qs}`;
  return url;
}

async function api<T>(
  path: string,
  init?: RequestInit & { params?: Record<string, string | undefined> },
): Promise<T> {
  const { params, ...rest } = init || {};
  const r = await fetch(buildUrl(path, params), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
    ...rest,
  });
  const payload: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    const errorField = payload && typeof payload === 'object'
      ? (payload as { error?: string }).error
      : null;
    const msg = errorField ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

// ── Projects ──────────────────────────────────────────────────────
export function listProjects(): Promise<{ projects: SelftapeProject[] }> {
  return api('/projects');
}

export interface ProjectDetail {
  project: SelftapeProject;
  takes: SelftapeTake[];
  feedback: SelftapeAIFeedback | null;
  submissions: SelftapeSubmission[];
}

export function getProject(projectId: string): Promise<ProjectDetail> {
  return api(`/projects/${projectId}`);
}

export function createProject(args: {
  name: string;
  role_name?: string;
  role_type?: string;
  scene_label?: string;
  sides_pages?: number;
  sides_content?: string;
  source_casting_project_id?: string;
  source_partnership_id?: string;
}): Promise<{ project: SelftapeProject }> {
  return api('/projects', { method: 'POST', body: JSON.stringify(args) });
}

export function patchProject(
  projectId: string,
  patch: Partial<SelftapeProject>,
): Promise<{ project: SelftapeProject }> {
  return api(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function archiveProject(projectId: string): Promise<{ archived: true }> {
  return api(`/projects/${projectId}`, { method: 'DELETE' });
}

// ── Takes ─────────────────────────────────────────────────────────
export function listTakes(projectId: string): Promise<{ takes: SelftapeTake[] }> {
  return api(`/projects/${projectId}/takes`);
}

export function initUpload(projectId: string): Promise<{
  take: { id: string; take_number: number; status: SelftapeTakeStatus };
  upload: { provider: string; note?: string; uploadUrl?: string; streamUid?: string };
}> {
  return api(`/projects/${projectId}/takes/init-upload`, { method: 'POST' });
}

export function finalizeTake(
  projectId: string,
  args: {
    take_id: string;
    duration_ms?: number;
    video_url?: string;
    stream_uid?: string;
    hls_manifest?: string;
    thumbnail_url?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ take: SelftapeTake }> {
  return api(`/projects/${projectId}/takes/finalize`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function selectTake(takeId: string): Promise<{ project: { id: string; current_take_id: string } }> {
  return api(`/takes/${takeId}/select`, { method: 'POST' });
}

export function patchTake(
  takeId: string,
  patch: { notes?: string; metadata?: Record<string, unknown> },
): Promise<{ take: SelftapeTake }> {
  return api(`/takes/${takeId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteTake(takeId: string): Promise<{ deleted: true }> {
  return api(`/takes/${takeId}`, { method: 'DELETE' });
}

/**
 * Upload en innspilt take direkte (multipart) — backend pusher til CF Stream
 * og kjører finalize automatisk. Returnerer den ferdige raden.
 */
export async function uploadRecordedTake(
  projectId: string,
  blob: Blob,
  args: {
    durationMs: number;
    onProgress?: (pct: number) => void;
    filename?: string;
  },
): Promise<{ take: SelftapeTake }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = buildUrl(`/projects/${projectId}/takes/upload`);
    const form = new FormData();
    form.append('duration_ms', String(args.durationMs));
    form.append('video', blob, args.filename ?? 'take.webm');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && args.onProgress) {
        args.onProgress((e.loaded / e.total) * 100);
      }
    };
    xhr.onerror = () => reject(new Error('network_error'));
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 400) {
          reject(new Error(payload.error ?? `HTTP ${xhr.status}`));
        } else {
          resolve(payload);
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error('parse_failed'));
      }
    };
    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    xhr.send(form);
  });
}

// ── AI Feedback ───────────────────────────────────────────────────
export function getFeedback(takeId: string): Promise<{ feedback: SelftapeAIFeedback | null }> {
  return api(`/takes/${takeId}/feedback`);
}

export function regenerateFeedback(
  takeId: string,
): Promise<{ feedback: { id: string; status: string }; note?: string }> {
  return api(`/takes/${takeId}/feedback/regenerate`, { method: 'POST' });
}

// ── Submissions ───────────────────────────────────────────────────
export function listSubmissions(
  projectId: string,
): Promise<{ submissions: SelftapeSubmission[] }> {
  return api(`/projects/${projectId}/submissions`);
}

export function addSubmissionTarget(
  projectId: string,
  args: {
    take_id: string;
    target_type: SelftapeTargetType;
    agency_org_id?: string;
    casting_project_id?: string;
    casting_role_id?: string;
    deadline_at?: string;
  },
): Promise<{ submission: SelftapeSubmission }> {
  return api(`/projects/${projectId}/submissions`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function patchSubmission(
  submissionId: string,
  patch: { enabled?: boolean; deadline_at?: string; status?: SelftapeSubmissionStatus; agency_preferred?: boolean },
): Promise<{ submission: SelftapeSubmission }> {
  return api(`/submissions/${submissionId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function sendSubmission(submissionId: string): Promise<{ submission: SelftapeSubmission }> {
  return api(`/submissions/${submissionId}/send`, { method: 'POST' });
}

export function rotatePrivateLink(submissionId: string): Promise<{ submission: SelftapeSubmission }> {
  return api(`/submissions/${submissionId}/rotate-link`, { method: 'POST' });
}

export function submissionHistory(
  submissionId: string,
): Promise<{ events: SelftapeSubmissionEvent[] }> {
  return api(`/submissions/${submissionId}/history`);
}

// ── Helpers ───────────────────────────────────────────────────────

/** Format duration_ms til "MM:SS" */
export function formatDuration(durationMs: number): string {
  const total = Math.max(0, Math.floor(durationMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Bygg public-URL for private-link-deling. */
export function publicSelftapeUrl(privateToken: string): string {
  if (typeof window === 'undefined') return `/selftape/${privateToken}`;
  return `${window.location.origin}/selftape/${privateToken}`;
}
