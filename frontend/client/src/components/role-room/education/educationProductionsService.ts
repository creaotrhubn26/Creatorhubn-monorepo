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
 * artifact_kind (studioAccessModel tab-nøkkel, f.eks. fra en oppgaves
 * `artifactKind`) → CastingPlannerPanel sin SPA-tab-slug (`?tab=`,
 * matchet mot `tabpanel-<slug>`). Indeksene i STUDIO_TABS
 * (studioAccessModel.ts) og TAB_IDS (CastingPlannerPanel.tsx) er 1:1 —
 * de fleste nøklene har en annen (norsk) slug enn den engelske
 * artifact_kind-nøkkelen. `shotlist` (index 99) har ingen egen tabpanel-
 * slug (den lever som en view inni story-arc-studio), så den faller
 * tilbake til identity som alle ukjente nøkler.
 */
const ARTIFACT_KIND_TO_TAB_SLUG: Record<string, string> = {
  'story-arc': 'story-arc-studio',
  roles: 'roller',
  candidates: 'kandidater',
  selection: 'utvelgelse',
  locations: 'lokasjoner',
  callsheet: 'produksjonsplan',
  crew: 'team',
  equipment: 'rekvisitter',
  workspace: 'producer-media',
  economy: 'producer-okonomi',
  timeline: 'producer-tidslinje',
  approval: 'producer-reviews',
  delivery: 'producer-eksport',
};

export function artifactToTab(artifactKind: string): string {
  return ARTIFACT_KIND_TO_TAB_SLUG[artifactKind] ?? artifactKind;
}

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
 *
 * `tab` er en artifact_kind (f.eks. `a.artifactKind` fra AssignmentsTab) —
 * den mappes internt via `artifactToTab` før den blir `?tab=`. `opts.view`
 * blir `?view=` (f.eks. `story-logic`) for dyp-lenking inn i en spesifikk
 * visning i Story Arc Studio.
 */
export function openProductionInRoleRoom(
  projectId: string,
  tab?: string,
  opts?: { asStudent?: boolean; view?: string },
): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'production');
    url.searchParams.set('project', projectId);
    if (tab) url.searchParams.set('tab', artifactToTab(tab));
    else url.searchParams.delete('tab');
    if (opts?.view) url.searchParams.set('view', opts.view);
    else url.searchParams.delete('view');
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
