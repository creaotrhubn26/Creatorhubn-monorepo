import type {
  StoryboardReviewAccessMode,
  StoryboardReviewComment,
  StoryboardReviewDecision,
  StoryboardReviewDiff,
  StoryboardReviewRound,
  StoryboardReviewShareLink,
  StoryboardSharedReview,
} from '@shared/storyboard-review';

const BASE = '/api/role-room';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('role_room_auth_token')
    || sessionStorage.getItem('role_room_auth_token')
    || localStorage.getItem('authToken')
    || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string; detail?: string };
  if (!response.ok) {
    const error = new Error(body.detail || body.error || `HTTP ${response.status}`) as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body as T;
}

function reviewBase(projectId: string, manuscriptId: string) {
  return `${BASE}/projects/${encodeURIComponent(projectId)}/manuscripts/${encodeURIComponent(manuscriptId)}/storyboard-review-rounds`;
}

export async function listStoryboardReviewRounds(projectId: string, manuscriptId: string) {
  const response = await fetch(reviewBase(projectId, manuscriptId), { headers: authHeaders() });
  return (await readJson<{ data: StoryboardReviewRound[] }>(response)).data;
}

export async function createStoryboardReviewRound(
  projectId: string,
  manuscriptId: string,
  input: { label: string; summary?: string },
) {
  const response = await fetch(reviewBase(projectId, manuscriptId), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(input),
  });
  return (await readJson<{ data: StoryboardReviewRound }>(response)).data;
}

export async function getStoryboardReviewRound(projectId: string, manuscriptId: string, roundId: string) {
  const response = await fetch(`${reviewBase(projectId, manuscriptId)}/${encodeURIComponent(roundId)}`, {
    headers: authHeaders(),
  });
  return (await readJson<{ data: StoryboardReviewRound }>(response)).data;
}

export async function getStoryboardReviewDiff(projectId: string, manuscriptId: string, roundId: string) {
  const response = await fetch(`${reviewBase(projectId, manuscriptId)}/${encodeURIComponent(roundId)}/diff`, {
    headers: authHeaders(),
  });
  return (await readJson<{ data: StoryboardReviewDiff }>(response)).data;
}

export async function createStoryboardReviewShareLink(
  projectId: string,
  manuscriptId: string,
  roundId: string,
  input: { accessMode: StoryboardReviewAccessMode; requireIdentity: boolean; expiresAt?: string | null },
) {
  const response = await fetch(`${reviewBase(projectId, manuscriptId)}/${encodeURIComponent(roundId)}/share-links`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(input),
  });
  return (await readJson<{ data: StoryboardReviewShareLink & { token: string } }>(response)).data;
}

export async function revokeStoryboardReviewShareLink(
  projectId: string, manuscriptId: string, roundId: string, shareId: string,
) {
  const response = await fetch(
    `${reviewBase(projectId, manuscriptId)}/${encodeURIComponent(roundId)}/share-links/${encodeURIComponent(shareId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  await readJson(response);
}

export async function restoreStoryboardReviewRound(
  projectId: string,
  manuscriptId: string,
  roundId: string,
  input: { confirmSnapshotHash: string; expectedCurrentHash: string },
) {
  const response = await fetch(`${reviewBase(projectId, manuscriptId)}/${encodeURIComponent(roundId)}/restore`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(input),
  });
  return (await readJson<{ data: {
    restoredSceneIds: string[];
    skippedSceneIds: string[];
    restoredFromVersion: number;
    snapshotHash: string;
  } }>(response)).data;
}

const publicBase = (token: string) => `${BASE}/storyboard-review/${encodeURIComponent(token)}`;

export type StoryboardSharedReviewEnvelope =
  | { requiresIdentity: true; round: Pick<StoryboardReviewRound, 'id' | 'version' | 'label' | 'status' | 'snapshotHash' | 'frameCount'>;
      share: { accessMode: StoryboardReviewAccessMode; requireIdentity: true; expiresAt?: string | null } }
  | ({ requiresIdentity: false } & StoryboardSharedReview);

function reviewerHeaders(reviewerToken?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(reviewerToken ? { 'x-storyboard-reviewer': reviewerToken } : {}),
  };
}

export async function getSharedStoryboardReview(token: string, reviewerToken?: string) {
  const response = await fetch(publicBase(token), { headers: reviewerHeaders(reviewerToken) });
  return (await readJson<{ data: StoryboardSharedReviewEnvelope }>(response)).data;
}

export async function createStoryboardReviewerSession(
  token: string, input: { displayName: string; email?: string },
) {
  const response = await fetch(`${publicBase(token)}/sessions`, {
    method: 'POST', headers: reviewerHeaders(), body: JSON.stringify(input),
  });
  return (await readJson<{ data: { reviewerToken: string; reviewer: { id: string; displayName: string; email?: string } } }>(response)).data;
}

export async function addSharedStoryboardComment(
  token: string,
  reviewerToken: string,
  input: { frameId?: string | null; body: string; anchorX?: number | null; anchorY?: number | null },
) {
  const response = await fetch(`${publicBase(token)}/comments`, {
    method: 'POST', headers: reviewerHeaders(reviewerToken), body: JSON.stringify(input),
  });
  return (await readJson<{ data: StoryboardReviewComment }>(response)).data;
}

export async function decideSharedStoryboardReview(
  token: string,
  reviewerToken: string,
  input: { decision: 'approved' | 'changes_requested'; expectedSnapshotHash: string; note?: string | null },
) {
  const response = await fetch(`${publicBase(token)}/decisions`, {
    method: 'POST', headers: reviewerHeaders(reviewerToken), body: JSON.stringify(input),
  });
  return (await readJson<{ data: StoryboardReviewDecision }>(response)).data;
}
