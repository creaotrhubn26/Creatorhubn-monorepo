/**
 * workspaceItems — ett register over alle flatene i AdminWorkspace.
 *
 * Dette er sannheten om hvilke flater som finnes, hva de heter, hvor de
 * hører hjemme og om de faktisk er bygget. Fire ting leser det samme
 * registeret, slik at de ikke kan komme i utakt:
 *
 *   1. URL-validering  — `?view=` må peke på en kjent flate (ellers
 *      landet man på en helt blank skjerm).
 *   2. Sidebaren       — grupperer på `status`, så navigasjonen viser det
 *      som virker øverst og det ubygde samlet nederst.
 *   3. ⌘K-paletten     — søker i label + keywords.
 *   4. Breadcrumbs     — `group` gir midtleddet.
 *
 * `status: 'live'` betyr at flaten rendrer en EmptyState med en TODO.
 * Når en flate kobles på: flytt den til 'live' her, og sidebaren følger.
 */

export type WorkspaceItemId =
  // Hoved-nav
  | 'overview'
  | 'inbox'
  | 'cases'
  | 'projects'
  | 'documents'
  | 'tasks'
  | 'calendar'
  | 'files'
  | 'teamchat'
  | 'automations'
  // Teamspaces
  | 'ledelse'
  | 'kundeprosjekt'
  | 'markedsforing'
  | 'produkt'
  | 'hr'
  // Innstillinger
  | 'settings'
  // Sub-items mountet i Teamspaces / Overview
  | 'business-plan'
  | 'funding'
  | 'investors'
  | 'partners'
  | 'industry-crm'
  | 'business-dna'
  | 'marketing-catalog'
  | 'marketing-segments'
  | 'content-marketing'
  | 'marketing-cockpit'
  | 'operating-system'
  | 'role-room-agent'
  | 'content-calendar'
  | 'leadgrid-app-waitlist'
  | 'role-room-economy'
  | 'newsletter-studio'
  | 'ai-citation'
  | 'whats-new'
  | 'activity'
  | 'migrations';

export type WorkspaceItemGroup =
  | 'Workspace'
  | 'Ledelse'
  | 'Markedsføring'
  | 'Produkt'
  | 'Teamspaces'
  | 'Innstillinger';

export interface WorkspaceItemMeta {
  id: WorkspaceItemId;
  label: string;
  group: WorkspaceItemGroup;
  /**
   * Alle flater er i dag implementert mot ekte datakilder. Feltet
   * beholdes som kontrakt for framtidige flater som mountes før de er
   * ferdige — de skal merkes 'planned' her, ikke smugles inn i
   * navigasjonen som om de virker.
   */
  status: 'live' | 'planned';
  /** Ekstra søkeord for ⌘K (synonymer, gamle navn, domenebegreper). */
  keywords?: string[];
}

export const WORKSPACE_ITEMS: readonly WorkspaceItemMeta[] = [
  // ─── Workspace ───────────────────────────────────────────────
  { id: 'overview', label: 'Oversikt', group: 'Workspace', status: 'live', keywords: ['hjem', 'dashboard', 'start'] },
  { id: 'inbox', label: 'Innboks', group: 'Workspace', status: 'live', keywords: ['varsler', 'notifikasjoner'] },
  { id: 'cases', label: 'Saker', group: 'Workspace', status: 'live', keywords: ['oppfølging', 'tråd', 'case'] },
  { id: 'tasks', label: 'Oppgaver', group: 'Workspace', status: 'live', keywords: ['todo', 'gjøremål', 'frister'] },
  { id: 'calendar', label: 'Kalender', group: 'Workspace', status: 'live', keywords: ['agenda', 'møter', 'frister', 'deadline'] },
  { id: 'activity', label: 'Aktivitetslogg', group: 'Workspace', status: 'live', keywords: ['historikk', 'logg', 'endringer'] },

  { id: 'projects', label: 'Prosjekter', group: 'Workspace', status: 'live', keywords: ['kundeprosjekt'] },
  { id: 'documents', label: 'Dokumenter', group: 'Workspace', status: 'live', keywords: ['kontrakter', 'brief'] },
  { id: 'files', label: 'Filer', group: 'Workspace', status: 'live', keywords: ['arkiv', 'b2', 'lagring'] },
  { id: 'teamchat', label: 'Teamchat', group: 'Workspace', status: 'live', keywords: ['chat', 'melding'] },
  { id: 'automations', label: 'Automatiseringer', group: 'Workspace', status: 'live', keywords: ['cron', 'trigger', 'workflow'] },

  // ─── Ledelse ─────────────────────────────────────────────────
  { id: 'business-plan', label: 'Forretningsplan', group: 'Ledelse', status: 'live', keywords: ['bbi', 'strategi'] },
  { id: 'funding', label: 'Søknader (IN/EU)', group: 'Ledelse', status: 'live', keywords: ['innovasjon norge', 'støtte', 'funding', 'tilskudd'] },
  { id: 'investors', label: 'Investor-pipeline', group: 'Ledelse', status: 'live', keywords: ['investor', 'kapital', 'emisjon'] },
  { id: 'partners', label: 'Samarbeidspartnere', group: 'Ledelse', status: 'live', keywords: ['partner', 'samarbeid'] },
  { id: 'role-room-economy', label: 'RR Økonomi', group: 'Ledelse', status: 'live', keywords: ['enhetsøkonomi', 'unit economics', 'tall'] },

  // ─── Markedsføring ───────────────────────────────────────────
  { id: 'business-dna', label: 'Business DNA', group: 'Markedsføring', status: 'live', keywords: ['merkevare', 'brand', 'onboarding'] },
  { id: 'marketing-catalog', label: 'Katalog', group: 'Markedsføring', status: 'live', keywords: ['produkter', 'vertikaler'] },
  { id: 'marketing-cockpit', label: 'Marketing Cockpit', group: 'Markedsføring', status: 'live', keywords: ['funnel', 'b2b', 'lead scoring'] },
  { id: 'marketing-segments', label: 'Målgrupper', group: 'Markedsføring', status: 'live', keywords: ['segment', 'audience', 'google', 'meta', 'linkedin'] },
  { id: 'leadgrid-app-waitlist', label: 'Leadgrid: App-venteliste', group: 'Markedsføring', status: 'live', keywords: ['venteliste', 'waitlist', 'leadgrid'] },
  { id: 'content-marketing', label: 'Content marketing', group: 'Markedsføring', status: 'live', keywords: ['innhold', 'blogg'] },
  { id: 'content-calendar', label: 'Content-kalender', group: 'Markedsføring', status: 'live', keywords: ['publisering', 'innholdsplan'] },
  { id: 'newsletter-studio', label: 'Newsletter Studio', group: 'Markedsføring', status: 'live', keywords: ['nyhetsbrev', 'e-post', 'epost'] },
  { id: 'ai-citation', label: 'GEO-effekt', group: 'Markedsføring', status: 'live', keywords: ['ai citation', 'llm', 'søkemotor', 'seo'] },
  { id: 'industry-crm', label: 'Tier-1 outreach (CRM)', group: 'Markedsføring', status: 'live', keywords: ['crm', 'kontakt', 'pipeline', 'bransje'] },

  // ─── Produkt ─────────────────────────────────────────────────
  { id: 'operating-system', label: 'Operativsystem', group: 'Produkt', status: 'live', keywords: ['bransjeorganisasjoner', 'kvalitetspartnere'] },
  { id: 'role-room-agent', label: 'Role Room Agent', group: 'Produkt', status: 'live', keywords: ['ai', 'assistent', 'research'] },
  { id: 'whats-new', label: 'Hva er nytt', group: 'Produkt', status: 'live', keywords: ['changelog', 'release', 'nyheter'] },
  { id: 'migrations', label: 'Migrasjoner', group: 'Produkt', status: 'live', keywords: ['db', 'database', 'sql', 'migrering'] },

  // ─── Teamspaces (landinger) ──────────────────────────────────
  { id: 'ledelse', label: 'Ledelse', group: 'Teamspaces', status: 'live' },
  { id: 'markedsforing', label: 'Markedsføring', group: 'Teamspaces', status: 'live' },
  { id: 'produkt', label: 'Produkt', group: 'Teamspaces', status: 'live' },
  { id: 'kundeprosjekt', label: 'Kundeprosjekt', group: 'Teamspaces', status: 'live' },
  { id: 'hr', label: 'HR', group: 'Teamspaces', status: 'live', keywords: ['ansatte', 'team', 'kontrakter'] },

  // ─── Innstillinger ───────────────────────────────────────────
  { id: 'settings', label: 'Innstillinger', group: 'Innstillinger', status: 'live', keywords: ['settings', 'oppsett', 'integrasjoner'] },
] as const;

const ITEM_BY_ID = new Map<string, WorkspaceItemMeta>(
  WORKSPACE_ITEMS.map((item) => [item.id, item]),
);

export function isWorkspaceItemId(value: unknown): value is WorkspaceItemId {
  return typeof value === 'string' && ITEM_BY_ID.has(value);
}

export function getWorkspaceItem(id: WorkspaceItemId): WorkspaceItemMeta | undefined {
  return ITEM_BY_ID.get(id);
}

export function getWorkspaceItemLabel(id: WorkspaceItemId): string {
  return ITEM_BY_ID.get(id)?.label ?? 'Workspace';
}

/**
 * Leser og validerer `?view=`. En ukjent eller utdatert verdi (gammelt
 * bokmerke, omdøpt flate) faller tilbake til `overview` i stedet for å
 * rendre en tom skjerm uten forklaring.
 */
export function readViewFromUrl(search: string, fallback: WorkspaceItemId = 'overview'): WorkspaceItemId {
  try {
    const raw = new URLSearchParams(search).get('view');
    return isWorkspaceItemId(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Enkel subsekvens-match («mkcp» treffer «Marketing Cockpit»), med
 * rangering: eksakt prefiks > ord-prefiks > subsekvens. Holder paletten
 * brukbar uten å dra inn en fuzzy-search-avhengighet.
 */
export function scoreWorkspaceItem(item: WorkspaceItemMeta, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const haystacks = [item.label.toLowerCase(), ...(item.keywords ?? []).map((k) => k.toLowerCase())];

  let best = 0;
  for (const hay of haystacks) {
    if (hay === q) {
      best = Math.max(best, 1000);
      continue;
    }
    if (hay.startsWith(q)) {
      best = Math.max(best, 500);
      continue;
    }
    if (hay.split(/[\s:()-]+/).some((word) => word.startsWith(q))) {
      best = Math.max(best, 300);
      continue;
    }
    if (hay.includes(q)) {
      best = Math.max(best, 200);
      continue;
    }
    // Subsekvens: alle tegn i q i riktig rekkefølge i hay.
    let hi = 0;
    let matched = 0;
    for (const ch of q) {
      const found = hay.indexOf(ch, hi);
      if (found === -1) {
        matched = -1;
        break;
      }
      hi = found + 1;
      matched += 1;
    }
    if (matched === q.length) {
      best = Math.max(best, 100);
    }
  }
  return best;
}

export function searchWorkspaceItems(query: string): WorkspaceItemMeta[] {
  const scored = WORKSPACE_ITEMS.map((item) => ({ item, score: scoreWorkspaceItem(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Bygget innhold før planlagt, deretter alfabetisk.
      if (a.item.status !== b.item.status) return a.item.status === 'live' ? -1 : 1;
      return a.item.label.localeCompare(b.item.label, 'nb');
    });
  return scored.map((entry) => entry.item);
}

/**
 * Deep-link-mål inne i workspacet.
 *
 * Aggregatoren sender `link_path` som en full sti
 * (`/admin-workspace?view=cases&caseId=…`). Når den peker inn i
 * workspacet skal vi bytte panel i React, ikke gjøre en full sidelast av
 * en tung SPA. Returnerer null for alt annet, så kalleren kan falle
 * tilbake til vanlig navigasjon.
 */
export interface WorkspaceLinkTarget {
  view: WorkspaceItemId;
  caseId?: string;
  fundingId?: string;
}

export function parseWorkspaceLink(linkPath: string | null | undefined): WorkspaceLinkTarget | null {
  if (!linkPath) return null;
  try {
    // Relativ sti → gi den en base for å kunne bruke URL-parseren.
    const url = new URL(linkPath, 'https://local.invalid');
    if (url.pathname !== '/admin-workspace') return null;
    const view = url.searchParams.get('view');
    if (!isWorkspaceItemId(view)) return null;
    const target: WorkspaceLinkTarget = { view };
    const caseId = url.searchParams.get('caseId');
    if (caseId) target.caseId = caseId;
    const fundingId = url.searchParams.get('fundingId');
    if (fundingId) target.fundingId = fundingId;
    return target;
  } catch {
    return null;
  }
}
