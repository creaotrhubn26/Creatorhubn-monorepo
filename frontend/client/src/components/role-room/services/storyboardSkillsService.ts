import type {
  StoryboardSkillContext,
  StoryboardSkillDefinition,
  StoryboardSkillId,
  StoryboardSkillSuggestion,
} from '@shared/storyboard-skills';
import { apiRequest } from './castingApiService';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function fetchStoryboardSkillCatalog(
  projectId: string,
): Promise<StoryboardSkillDefinition[]> {
  const response = await apiRequest<ApiEnvelope<StoryboardSkillDefinition[]>>(
    `/projects/${encodeURIComponent(projectId)}/storyboard-skills/catalog`,
  );
  return response.data;
}

export async function fetchStoryboardSkillSuggestions(
  projectId: string,
  statuses: StoryboardSkillSuggestion['status'][] = ['pending'],
): Promise<StoryboardSkillSuggestion[]> {
  const query = new URLSearchParams({ status: statuses.join(',') });
  const response = await apiRequest<ApiEnvelope<StoryboardSkillSuggestion[]>>(
    `/projects/${encodeURIComponent(projectId)}/storyboard-skills/suggestions?${query}`,
  );
  return response.data;
}

export async function runStoryboardSkill(
  projectId: string,
  skillId: StoryboardSkillId,
  context: StoryboardSkillContext,
): Promise<StoryboardSkillSuggestion> {
  const response = await apiRequest<ApiEnvelope<StoryboardSkillSuggestion[]>>(
    `/projects/${encodeURIComponent(projectId)}/storyboard-skills/${encodeURIComponent(skillId)}/run`,
    {
      method: 'POST',
      body: JSON.stringify({ context }),
    },
  );
  const suggestion = response.data[0];
  if (!suggestion) throw new Error('Skillen returnerte ikke et forslag.');
  return suggestion;
}

async function reviewStoryboardSkillSuggestion(
  projectId: string,
  suggestionId: string,
  action: 'accept' | 'reject',
  note?: string,
): Promise<StoryboardSkillSuggestion> {
  const response = await apiRequest<ApiEnvelope<StoryboardSkillSuggestion>>(
    `/projects/${encodeURIComponent(projectId)}/storyboard-skills/suggestions/${encodeURIComponent(suggestionId)}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify({ note: note ?? null }),
    },
  );
  return response.data;
}

export function acceptStoryboardSkillSuggestion(
  projectId: string,
  suggestionId: string,
  note?: string,
): Promise<StoryboardSkillSuggestion> {
  return reviewStoryboardSkillSuggestion(projectId, suggestionId, 'accept', note);
}

export function rejectStoryboardSkillSuggestion(
  projectId: string,
  suggestionId: string,
  note?: string,
): Promise<StoryboardSkillSuggestion> {
  return reviewStoryboardSkillSuggestion(projectId, suggestionId, 'reject', note);
}
