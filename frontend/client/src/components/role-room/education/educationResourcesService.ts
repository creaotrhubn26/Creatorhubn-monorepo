/**
 * educationResourcesService.ts — fag-bibliotek (opplæringslag 3).
 *
 * Eksplisitt Bearer via authSessionService (Role Room autentiserer på header).
 */

import authSessionService from '../services/authSessionService';

export type ResourceCategory = 'idea' | 'casting' | 'planning' | 'shoot' | 'post' | 'delivery' | 'general';

export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  description: string | null;
  url: string | null;
  body: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceInput {
  title: string;
  category?: ResourceCategory;
  description?: string;
  url?: string;
  body?: string;
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

export const educationResourcesService = {
  async listResources(category?: ResourceCategory): Promise<Resource[]> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const data = await req<{ resources: Resource[] }>(`${BASE}/resources${qs}`);
    return data.resources ?? [];
  },
  async createResource(input: ResourceInput): Promise<Resource> {
    const data = await req<{ resource: Resource }>(`${BASE}/resources`, { method: 'POST', body: JSON.stringify(input) });
    return data.resource;
  },
  async updateResource(id: string, patch: Partial<ResourceInput>): Promise<Resource> {
    const data = await req<{ resource: Resource }>(`${BASE}/resources/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return data.resource;
  },
  async deleteResource(id: string): Promise<void> {
    await req(`${BASE}/resources/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

/** Kategori-metadata: rekkefølge følger produksjonsflyten. */
export const RESOURCE_CATEGORIES: { key: ResourceCategory; label: string }[] = [
  { key: 'idea', label: 'Idé & manus' },
  { key: 'casting', label: 'Casting' },
  { key: 'planning', label: 'Planlegging' },
  { key: 'shoot', label: 'Opptak' },
  { key: 'post', label: 'Etterarbeid' },
  { key: 'delivery', label: 'Levering' },
  { key: 'general', label: 'Generelt' },
];

/**
 * Kuraterte startforslag — ett-klikks «Legg til». Bevisst knyttet til EKTE
 * Role Room-funksjoner (story-arc, casting/audition, call-sheet, leveranser)
 * så faget læres gjennom verktøyet studentene faktisk bruker.
 */
export const SUGGESTED_RESOURCES: { category: ResourceCategory; title: string; description: string }[] = [
  { category: 'idea', title: 'Fra idé til logline', description: 'Kok konseptet ned til én setning før dere bygger story-arc i Role Room.' },
  { category: 'idea', title: 'Slik bygger du en story-arc', description: 'Struktur, vendepunkter og beats — bruk Story Arc Studio i produksjonen.' },
  { category: 'casting', title: 'Slik holder du en audition', description: 'Forberedelse, sider og vurdering — kjør prosessen i Casting-fanen.' },
  { category: 'casting', title: 'Callback og utvelgelse', description: 'Sammenlign kandidater og lås rollebesetningen i Utvelgelse.' },
  { category: 'planning', title: 'Hva er en call sheet?', description: 'Hvem, hvor, når — generer og del call sheet fra Role Room.' },
  { category: 'planning', title: 'Lag en opptaksplan', description: 'Scener, lokasjoner og dager i produksjonskalenderen.' },
  { category: 'shoot', title: 'Rollene på et filmsett', description: 'Hvem gjør hva under opptak, og hvordan teamet er satt opp i Role Room.' },
  { category: 'shoot', title: 'Kontinuitet under opptak', description: 'Hold styr på detaljer mellom tagninger og scener.' },
  { category: 'post', title: 'Fra grovklipp til finklipp', description: 'Klippeprosessen og leveranse-milepæler i etterarbeidet.' },
  { category: 'delivery', title: 'Leveranseformater og visning', description: 'Eksport, formater og hvordan produksjonen leveres og vises.' },
];
