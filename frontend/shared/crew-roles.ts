/**
 * crew-roles.ts — delt katalog over crew-roller i Team Workspace.
 *
 * Crew-roller er DATA, ikke konstanter: et prosjekts rollekolonner =
 * kategoriens default-sett ∪ roller teamet/boardet faktisk bruker (se
 * GET /api/projects/:id/crew-roles). Katalogen her gir visning (no/en-label,
 * ikon, tone) for kjente nøkler; ukjente nøkler får generisk visning slik at
 * et blandet team (fotograf + musikkprodusent på samme event) aldri mister
 * kolonner. Avhengighetsfri — importeres av både backend og frontend
 * (samme mønster som profession-types.ts).
 *
 * NB: `key` er lagringsverdien i project_board_tasks.crew_role og
 * project_team_members.crew_role (VARCHAR(20), ASCII — derfor
 * 'klargjoring'/'oppfolging' uten æøå).
 */
import type { WorkspaceCategory } from './profession-types';

export interface CrewRoleDef {
  key: string;
  label: string;    // nb
  labelEn: string;
  icon: string;     // emoji (brukes i board-kolonner)
  tone: 'accent' | 'green' | 'blue' | 'amber' | 'neutral';
}

export const CREW_ROLE_CATALOG: CrewRoleDef[] = [
  // Visuell (foto/video)
  { key: 'fotograf', label: 'Fotograf', labelEn: 'Photographer', icon: '📷', tone: 'accent' },
  { key: 'videograf', label: 'Videograf', labelEn: 'Videographer', icon: '🎥', tone: 'green' },
  { key: 'begge', label: 'Begge', labelEn: 'Both', icon: '👥', tone: 'accent' },
  { key: 'editor', label: 'Editor', labelEn: 'Editor', icon: '🎬', tone: 'blue' },
  // Musikk
  { key: 'produsent', label: 'Produsent', labelEn: 'Producer', icon: '🎹', tone: 'accent' },
  { key: 'vokal', label: 'Vokal', labelEn: 'Vocals', icon: '🎤', tone: 'green' },
  { key: 'musikere', label: 'Musikere', labelEn: 'Musicians', icon: '🎸', tone: 'amber' },
  { key: 'miks', label: 'Miks', labelEn: 'Mix', icon: '🎚️', tone: 'blue' },
  // Vendor (ordre/leveranse)
  { key: 'bestilling', label: 'Bestilling', labelEn: 'Orders', icon: '🧾', tone: 'accent' },
  { key: 'klargjoring', label: 'Klargjøring', labelEn: 'Preparation', icon: '📦', tone: 'green' },
  { key: 'levering', label: 'Levering', labelEn: 'Delivery', icon: '🚚', tone: 'amber' },
  { key: 'oppfolging', label: 'Oppfølging', labelEn: 'Follow-up', icon: '📞', tone: 'blue' },
  // Service (booking-baserte)
  { key: 'booking', label: 'Booking', labelEn: 'Booking', icon: '📅', tone: 'accent' },
  { key: 'forberedelse', label: 'Forberedelse', labelEn: 'Preparation', icon: '🧴', tone: 'green' },
  { key: 'gjennomforing', label: 'Gjennomføring', labelEn: 'Execution', icon: '✂️', tone: 'amber' },
  // Generelle (alle kategorier)
  { key: 'lyd', label: 'Lydtekniker', labelEn: 'Sound engineer', icon: '🎙️', tone: 'amber' },
  { key: 'assistent', label: 'Assistent', labelEn: 'Assistant', icon: '🧰', tone: 'neutral' },
];

const BY_KEY: Record<string, CrewRoleDef> = Object.fromEntries(CREW_ROLE_CATALOG.map((r) => [r.key, r]));

/**
 * Default kolonne-sett per workspace-kategori + fallback-nøkkelen oppgaver
 * uten crew_role bucketes i (historisk 'begge' for visuell).
 */
export const CATEGORY_DEFAULT_CREW: Record<WorkspaceCategory, { keys: string[]; fallbackKey: string }> = {
  visual: { keys: ['fotograf', 'videograf', 'begge', 'editor'], fallbackKey: 'begge' },
  music: { keys: ['produsent', 'vokal', 'musikere', 'miks'], fallbackKey: 'musikere' },
  vendor: { keys: ['bestilling', 'klargjoring', 'levering', 'oppfolging'], fallbackKey: 'levering' },
  service: { keys: ['booking', 'forberedelse', 'gjennomforing', 'oppfolging'], fallbackKey: 'gjennomforing' },
};

/** Slå opp rolle-definisjon; ukjent nøkkel → generisk (nøkkel kapitalisert). */
export function crewRoleDef(key: string): CrewRoleDef {
  const k = String(key || '').trim();
  return BY_KEY[k] || { key: k, label: k ? k[0].toUpperCase() + k.slice(1) : 'Medlem', labelEn: k ? k[0].toUpperCase() + k.slice(1) : 'Member', icon: '👤', tone: 'neutral' };
}

export function crewRoleLabel(key: string, locale: 'no' | 'en' = 'no'): string {
  const d = crewRoleDef(key);
  return locale === 'en' ? d.labelEn : d.label;
}

/**
 * Bygg et prosjekts rolleliste: kategori-defaults først (stabil rekkefølge),
 * deretter ekstra roller som teamet/boardet faktisk bruker. Ukjente nøkler
 * beholdes (generisk visning) — et blandet team mister aldri kolonner.
 */
export function resolveCrewRoles(category: WorkspaceCategory, usedKeys: string[]): { roles: CrewRoleDef[]; fallbackKey: string } {
  const def = CATEGORY_DEFAULT_CREW[category] || CATEGORY_DEFAULT_CREW.visual;
  const seen = new Set(def.keys);
  const roles = def.keys.map(crewRoleDef);
  for (const raw of usedKeys) {
    const k = String(raw || '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    roles.push(crewRoleDef(k));
  }
  return { roles, fallbackKey: def.fallbackKey };
}
