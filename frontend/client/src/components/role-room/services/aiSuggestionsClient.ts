/**
 * aiSuggestionsClient.ts
 *
 * Frontend-klient for AI Suggestion System. Bruker felles `apiRequest`-
 * helperen i castingApiService for auth-headers og feilhåndtering.
 *
 * Arkitekturreferanse:
 *   ../ai-suggestion-architecture.md
 *
 * Endepunkter (forventet implementasjon på backend, ikke ennå rutet):
 *   GET    /api/role-room/projects/:projectId/ai-suggestions
 *   POST   /api/role-room/ai-suggestions/:id/accept
 *   POST   /api/role-room/ai-suggestions/:id/reject
 *   POST   /api/role-room/projects/:projectId/ai-suggestions/generate
 */

import { apiRequest } from './castingApiService';
import type {
  AISuggestion,
  AISuggestionFilter,
  AISuggestionSourceType,
} from '../models/casting';

interface GenerateRequest {
  agentName: string;
  sourceType: AISuggestionSourceType;
  sourceId: string;
  payload: unknown;
}

function buildQuery(filter?: AISuggestionFilter): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.sourceType) params.set('sourceType', filter.sourceType);
  if (filter.sourceId) params.set('sourceId', filter.sourceId);
  if (filter.agentName) params.set('agentName', filter.agentName);
  if (filter.suggestionType) params.set('suggestionType', filter.suggestionType);
  if (filter.status) {
    const statusValue = Array.isArray(filter.status)
      ? filter.status.join(',')
      : filter.status;
    params.set('status', statusValue);
  }
  if (typeof filter.minConfidence === 'number') {
    params.set('minConfidence', String(filter.minConfidence));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchSuggestions(
  projectId: string,
  filter?: AISuggestionFilter,
): Promise<AISuggestion[]> {
  return apiRequest<AISuggestion[]>(
    `/projects/${encodeURIComponent(projectId)}/ai-suggestions${buildQuery(filter)}`,
  );
}

export async function acceptSuggestion(
  id: string,
  note?: string,
): Promise<AISuggestion> {
  return apiRequest<AISuggestion>(
    `/ai-suggestions/${encodeURIComponent(id)}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ note: note ?? null }),
    },
  );
}

export async function rejectSuggestion(
  id: string,
  note?: string,
): Promise<AISuggestion> {
  return apiRequest<AISuggestion>(
    `/ai-suggestions/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ note: note ?? null }),
    },
  );
}

export async function generateSuggestions(
  projectId: string,
  request: GenerateRequest,
): Promise<AISuggestion[]> {
  return apiRequest<AISuggestion[]>(
    `/projects/${encodeURIComponent(projectId)}/ai-suggestions/generate`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
  );
}
