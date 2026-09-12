/**
 * educationLicenseService.ts — API-klient for TRR-lisens (seter).
 *
 * Eksplisitt Bearer via authSessionService (samme mønster som cohorts-service).
 */

import authSessionService from '../services/authSessionService';

export interface License {
  seatLimit: number | null;
  unlimited: boolean;
  model: string;
  used: number;
  available: number | null; // null = ubegrenset eller ingen grense satt
}

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const educationLicenseService = {
  async getLicense(): Promise<License> {
    const data = await req<{ license: License }>(`${BASE}/license`);
    return data.license;
  },
  async updateLicense(patch: { seatLimit?: number | null; unlimited?: boolean; model?: string }): Promise<License> {
    const data = await req<{ license: License }>(`${BASE}/license`, { method: 'PUT', body: JSON.stringify(patch) });
    return data.license;
  },
};
