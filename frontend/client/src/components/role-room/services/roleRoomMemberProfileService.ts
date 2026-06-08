/**
 * Role Room Member Profile — API-client.
 * Bruker apiFetch som vedlegger session-bearer-token automatisk.
 */

import { apiFetch } from '@/lib/queryClient';

export type ProfileVisibility = 'public' | 'connections' | 'private';

export interface RoleRoomMemberProfile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  professions: string[];
  companyName: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  website: string | null;
  socialLinks: Record<string, string>;
  showreelUrl: string | null;
  skills: string[];
  languages: string[];
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  visibility: ProfileVisibility;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  onboardingProgress: Record<string, unknown>;
  updatedAt: string;
}

export interface OnboardingStatus {
  completed: boolean;
  completedAt?: string;
  progress: Record<string, unknown>;
  requiresOnboarding: boolean;
}

export interface OnboardingConfig {
  welcomeMessage: string;
  professionsOptions: string[];
  skillsOptions: string[];
  languageOptions: Array<{ code: string; name: string }>;
  stepsEnabled: {
    welcome?: boolean;
    image?: boolean;
    profession?: boolean;
    about?: boolean;
    links?: boolean;
    privacy?: boolean;
  };
  requiredFields: {
    displayName?: boolean;
    professions?: boolean;
    bio?: boolean;
    profileImage?: boolean;
  };
}

export interface MemberListItem {
  userId: string;
  displayName: string | null;
  bio: string | null;
  professions: string[];
  skills: string[];
  companyName: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  profileImageUrl: string | null;
  visibility: ProfileVisibility;
}

export interface AdminOnboardingConfigResponse {
  config: OnboardingConfig;
  defaults: OnboardingConfig;
  updatedByUserId: string | null;
  updatedAt: string | null;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  // apiFetch accepts the same shape as RequestInit (plus optional plain-object
  // bodies). The cast is purely a TS narrowing aid.
  const res = await apiFetch(url, init as Parameters<typeof apiFetch>[1]);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${url}: ${res.status} ${detail || res.statusText}`.trim());
  }
  return (await res.json()) as T;
}

export const roleRoomMemberProfileService = {
  async getMyProfile(): Promise<RoleRoomMemberProfile> {
    const data = await jsonRequest<{ profile: RoleRoomMemberProfile }>(
      '/api/role-room/profile/me',
      { method: 'GET' },
    );
    return data.profile;
  },

  async updateMyProfile(updates: Partial<Omit<RoleRoomMemberProfile, 'userId' | 'updatedAt'>>): Promise<RoleRoomMemberProfile> {
    const data = await jsonRequest<{ profile: RoleRoomMemberProfile }>(
      '/api/role-room/profile/me',
      { method: 'PATCH', body: JSON.stringify(updates) },
    );
    return data.profile;
  },

  async uploadProfileImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiFetch('/api/role-room/profile/me/image', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Image upload: ${res.status} ${detail || res.statusText}`.trim());
    }
    const data = (await res.json()) as { profileImageUrl: string };
    return data.profileImageUrl;
  },

  async deleteProfileImage(): Promise<void> {
    await jsonRequest('/api/role-room/profile/me/image', { method: 'DELETE' });
  },

  async getOnboardingStatus(): Promise<OnboardingStatus> {
    return jsonRequest<OnboardingStatus>('/api/role-room/profile/me/onboarding', { method: 'GET' });
  },

  async updateOnboarding(payload: { progress?: Record<string, unknown>; complete?: boolean }): Promise<{ ok: boolean; completed?: boolean }> {
    return jsonRequest<{ ok: boolean; completed?: boolean }>(
      '/api/role-room/profile/me/onboarding',
      { method: 'POST', body: JSON.stringify(payload) },
    );
  },

  async listMembers(params?: {
    q?: string; profession?: string; projectId?: string;
    limit?: number; offset?: number;
  }): Promise<{ members: MemberListItem[]; hasMore: boolean; offset: number; limit: number }> {
    const u = new URLSearchParams();
    if (params?.q) u.set('q', params.q);
    if (params?.profession) u.set('profession', params.profession);
    if (params?.projectId) u.set('projectId', params.projectId);
    if (params?.limit != null) u.set('limit', String(params.limit));
    if (params?.offset != null) u.set('offset', String(params.offset));
    return jsonRequest(`/api/role-room/members?${u.toString()}`, { method: 'GET' });
  },

  async getPublicProfile(userId: string): Promise<RoleRoomMemberProfile> {
    const data = await jsonRequest<{ profile: RoleRoomMemberProfile }>(
      `/api/role-room/profile/${encodeURIComponent(userId)}`,
      { method: 'GET' },
    );
    return data.profile;
  },

  async getOnboardingConfig(): Promise<OnboardingConfig> {
    const data = await jsonRequest<{ config: OnboardingConfig }>(
      '/api/role-room/onboarding-config',
      { method: 'GET' },
    );
    return data.config;
  },

  async adminGetOnboardingConfig(): Promise<AdminOnboardingConfigResponse> {
    return jsonRequest<AdminOnboardingConfigResponse>(
      '/api/role-room/admin/onboarding-config',
      { method: 'GET' },
    );
  },

  async adminUpdateOnboardingConfig(
    patch: Partial<OnboardingConfig>,
  ): Promise<{ ok: boolean; config: OnboardingConfig }> {
    return jsonRequest<{ ok: boolean; config: OnboardingConfig }>(
      '/api/role-room/admin/onboarding-config',
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
  },

  async adminResetOnboardingConfig(): Promise<{ ok: boolean; config: OnboardingConfig }> {
    return jsonRequest<{ ok: boolean; config: OnboardingConfig }>(
      '/api/role-room/admin/onboarding-config/reset',
      { method: 'POST' },
    );
  },
};
