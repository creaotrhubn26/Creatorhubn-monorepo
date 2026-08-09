/**
 * educationProductionsService.ts — studentproduksjoner (lag: Role Room-kobling).
 *
 * En studentproduksjon ER et ekte Role Room-prosjekt. createProduction() poster
 * KUN til /education/productions (uten projectId) — serveren oppretter da et
 * ekte casting_projects-prosjekt server-side og lagrer koblingen (kull ↔ prosjekt)
 * i utdannings-tabellen. (Tidligere kalte klienten roleRoomService.createProject
 * FØRST via roleRoomFetch, men den leser bare auth-token fra localStorage —
 * ikke education-sesjonens authSessionService — og feilet derfor med 401.)
 */

import authSessionService from '../services/authSessionService';

export interface Production {
  id: string;
  cohortId: string | null;
  projectId: string;
  title: string;
  projectStatus: string | null;
  assignmentCount: number;
  createdAt: string;
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

export const educationProductionsService = {
  async listProductions(cohortId?: string): Promise<Production[]> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const data = await req<{ productions: Production[] }>(`${BASE}/productions${qs}`);
    return data.productions ?? [];
  },
  async createProduction(input: { title: string; cohortId?: string }): Promise<Production> {
    // Serveren oppretter det ekte casting_projects-prosjektet når projectId er utelatt.
    const data = await req<{ production: Production }>(`${BASE}/productions`, {
      method: 'POST',
      body: JSON.stringify({ title: input.title, cohortId: input.cohortId || undefined }),
    });
    return data.production;
  },
  async deleteProduction(id: string): Promise<void> {
    await req(`${BASE}/productions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

/**
 * Åpner det ekte Role Room-prosjektet (production-modus + deep-link
 * ?project=<id>). URL-param `mode` vinner over lagret education-modus, så
 * utdannings-fanen blir uberørt.
 *
 * Default: ny fane (faglærer/produsent-bruk — AssessmentTab, AssignmentsTab,
 * ProductionsTab). Når `opts.asStudent` er satt (StudentWorkspace — «Min
 * side») navigerer vi i SAMME fane og setter `?edu=1` slik at produksjons-
 * headeren kan vise en «Min side»-knapp tilbake. Uten dette har studenten
 * ingen vei tilbake til oppgavene sine på iPad/iPhone (ingen ny-fane-støtte
 * der de kan bytte tilbake).
 */
export function openProductionInRoleRoom(
  projectId: string,
  tab?: string,
  opts?: { asStudent?: boolean },
): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'production');
    url.searchParams.set('project', projectId);
    if (tab) url.searchParams.set('tab', tab);
    else url.searchParams.delete('tab');
    if (opts?.asStudent) {
      url.searchParams.set('edu', '1');
      window.location.assign(url.toString());
    } else {
      window.open(url.toString(), '_blank', 'noopener');
    }
  } catch {
    /* no-op */
  }
}
