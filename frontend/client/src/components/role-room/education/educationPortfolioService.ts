/**
 * educationPortfolioService.ts — API-klient for studentporteføljer.
 *
 * Eksplisitt Bearer via authSessionService (samme mønster som cohorts-service).
 */

import authSessionService from '../services/authSessionService';

export type PortfolioKind = 'showreel' | 'exam';
export type PortfolioStatus = 'draft' | 'published';

export interface Portfolio {
  id: string;
  studentId: string;
  studentName: string;
  cohortId: string | null;
  cohortName: string | null;
  kind: PortfolioKind;
  status: PortfolioStatus;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  updatedAt: string;
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

export const educationPortfolioService = {
  async listPortfolios(): Promise<Portfolio[]> {
    const data = await req<{ portfolios: Portfolio[] }>(`${BASE}/portfolios`);
    return data.portfolios ?? [];
  },
  async createPortfolio(input: { studentId: string; kind?: PortfolioKind; title?: string; url?: string }): Promise<Portfolio> {
    const data = await req<{ portfolio: Portfolio }>(`${BASE}/portfolios`, { method: 'POST', body: JSON.stringify(input) });
    return data.portfolio;
  },
  async updatePortfolio(id: string, patch: Partial<{ status: PortfolioStatus; kind: PortfolioKind; title: string; url: string }>): Promise<Portfolio> {
    const data = await req<{ portfolio: Portfolio }>(`${BASE}/portfolios/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return data.portfolio;
  },
  async deletePortfolio(id: string): Promise<void> {
    await req(`${BASE}/portfolios/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
