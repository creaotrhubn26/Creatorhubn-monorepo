/**
 * sales-trigger-sync.ts — trigger-basert salg (samle-laget)
 *
 * Henter salgsvindu-hendelser fra åpne, vilkårsrene kilder og lagrer dem
 * i trigger_events (0385). sales-trigger-detektoren i innsiktsmotoren
 * konverterer nye hendelser til innsikter med dedup.
 *
 * Kilder i v1 (begge verifisert empirisk 2026-07-13):
 *  - TED (EU-kunngjøringer, åpen API): norske anbud over terskelverdi,
 *    matchet mot vertikal-nøkkelord → kind 'tender'
 *  - GDELT (åpen): strategisignaler i norske medier per vertikal og per
 *    aktivt lead-selskap → kind 'strategy_media'
 *
 * Doffin (under terskelverdi) og NAV-utlysninger krever gratis API-nøkkel
 * — registrert i integrasjonsregisteret som availableNotConfigured; koden
 * her hopper ÆRLIG over dem til DOFFIN_API_KEY / NAV_FEED_TOKEN finnes.
 *
 * Nøkkelordene per vertikal er justeringsflater (samme mønster som
 * NACE-mappingen) — endres når treffbildet viser støy.
 */

import type { Pool } from "pg";
import { callExternalApi } from "../external-api.js";

export interface TriggerEvent {
  source: "ted" | "gdelt" | "doffin";
  eventId: string;
  kind: "tender" | "strategy_media";
  title: string;
  url: string | null;
  publishedAt: string | null; // YYYY-MM-DD
  matchedTopic: string;
}

/** Anbud eldre enn dette er ikke et salgsvindu — filtreres før lagring. */
export const MAX_TRIGGER_AGE_DAYS = 60;

export function isFreshTrigger(e: TriggerEvent, now: Date): boolean {
  if (!e.publishedAt) return true; // ukjent dato → behold (detektoren viser det)
  const age = (now.getTime() - new Date(`${e.publishedAt}T00:00:00Z`).getTime()) / 86_400_000;
  return age <= MAX_TRIGGER_AGE_DAYS;
}

/** Vertikal → søkeord. Nøkkel = geo_prompt_sets.name (samme kobling som ellers). */
export const TRIGGER_KEYWORDS: Record<string, string[]> = {
  "CreatorHub — fotografer og videografer": ["foto", "video", "film"],
  "The Role Room — casting og produksjon": ["film", "tv-produksjon", "casting"],
  "The Role Room — dansestudio": ["dans", "kulturskole"],
  "The Role Room — utdanningsinstitusjoner": ["medieutdanning", "filmutdanning"],
  "Leadgrid — små bedrifter (feltsalg/leads)": ["håndverk", "vedlikehold"],
  "Leadgrid — salgsteam og større organisasjoner": ["crm", "salgsverktøy"],
};

const GDELT_STRATEGY_TERMS = '(bærekraftstrategi OR "ny strategi" OR satsing OR klimamål)';

// ─────────────────────────────────────────────────────────────────────
// Rene mappere (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

interface TedNotice {
  "publication-number"?: string;
  "notice-title"?: Record<string, string | string[]>;
  "publication-date"?: string;
  links?: { html?: Record<string, string>; pdf?: Record<string, string> };
}

function firstText(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function mapTedNotices(notices: TedNotice[], topic: string): TriggerEvent[] {
  const out: TriggerEvent[] = [];
  for (const n of notices) {
    const id = n["publication-number"];
    if (!id) continue;
    const titles = n["notice-title"] ?? {};
    const title =
      firstText(titles.nor) ?? firstText(titles.eng) ?? firstText(Object.values(titles)[0]);
    if (!title) continue;
    out.push({
      source: "ted",
      eventId: id,
      kind: "tender",
      title,
      url: `https://ted.europa.eu/en/notice/${id}`,
      publishedAt: n["publication-date"]?.slice(0, 10) ?? null,
      matchedTopic: topic,
    });
  }
  return out;
}

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string; // YYYYMMDDTHHMMSSZ
  domain?: string;
  language?: string;
}

export function mapGdeltArticles(articles: GdeltArticle[], topic: string): TriggerEvent[] {
  const out: TriggerEvent[] = [];
  const seen = new Set<string>();
  for (const a of articles) {
    if (!a.url || !a.title) continue;
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    const d = a.seendate;
    out.push({
      source: "gdelt",
      eventId: a.url,
      kind: "strategy_media",
      title: a.title.trim(),
      url: a.url,
      publishedAt:
        d && d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null,
      matchedTopic: topic,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Kilde-kall
// ─────────────────────────────────────────────────────────────────────

async function fetchTedTenders(keyword: string, topic: string): Promise<TriggerEvent[]> {
  const result = await callExternalApi<{ notices?: TedNotice[] }>(
    "https://api.ted.europa.eu/v3/notices/search",
    {
      method: "POST",
      timeoutMs: 15_000,
      label: "ted-tenders",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // SORT BY må stå i spørrestrengen — eget sort-felt avvises av API-et
        // (verifisert 2026-07-13; feilen var stille og ga 0 hendelser)
        query: `place-of-performance IN (NOR) AND notice-title ~ ("${keyword}") SORT BY publication-date DESC`,
        fields: ["publication-number", "notice-title", "publication-date"],
        limit: 10,
      }),
    },
  );
  if (!result.ok) {
    console.warn("[sales-triggers] TED-kall feilet for", topic);
    return [];
  }
  return mapTedNotices(result.data.notices ?? [], topic);
}

async function fetchGdeltMentions(query: string, topic: string): Promise<TriggerEvent[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
    encodeURIComponent(`${query} sourcecountry:NO`) +
    "&mode=artlist&format=json&maxrecords=10&timespan=7d";
  const result = await callExternalApi<{ articles?: GdeltArticle[] }>(url, {
    method: "GET",
    timeoutMs: 15_000,
    label: "gdelt-strategy",
  });
  if (!result.ok) return [];
  return mapGdeltArticles(result.data.articles ?? [], topic);
}

interface DoffinHit {
  id?: string;
  heading?: string;
  title?: string;
  publicationDate?: string;
}

/** Defensiv mapping — Doffin-strukturen finjusteres når nøkkelen er på plass. */
export function mapDoffinHits(hits: DoffinHit[], topic: string): TriggerEvent[] {
  const out: TriggerEvent[] = [];
  for (const h of hits) {
    const title = h.heading ?? h.title;
    if (!h.id || !title) continue;
    out.push({
      source: "doffin",
      eventId: String(h.id),
      kind: "tender",
      title: title.trim(),
      url: `https://www.doffin.no/notices/${h.id}`,
      publishedAt: h.publicationDate?.slice(0, 10) ?? null,
      matchedTopic: topic,
    });
  }
  return out;
}

/**
 * Doffin public API (Azure APIM — dof-notices-prod-api). Aktiveres av
 * DOFFIN_API_KEY (gratis abonnementsnøkkel fra utviklerportalen).
 */
async function fetchDoffinTenders(keyword: string, topic: string): Promise<TriggerEvent[]> {
  const key = process.env.DOFFIN_API_KEY;
  if (!key) return [];
  const result = await callExternalApi<{ hits?: DoffinHit[]; notices?: DoffinHit[] }>(
    `https://api.doffin.no/public/v2/search?searchString=${encodeURIComponent(keyword)}&numHitsPerPage=10`,
    {
      method: "GET",
      timeoutMs: 15_000,
      label: "doffin-tenders",
      headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
    },
  );
  if (!result.ok) return [];
  return mapDoffinHits(result.data.hits ?? result.data.notices ?? [], topic);
}

// ─────────────────────────────────────────────────────────────────────
// Synk
// ─────────────────────────────────────────────────────────────────────

export interface TriggerSyncResult {
  organizations: number;
  verticalsChecked: number;
  leadsChecked: number;
  eventsInserted: number;
  skippedSources: string[]; // kilder uten nøkkel — rapportert, aldri stille
  errors: string[];
}

export async function syncSalesTriggers(pool: Pool): Promise<TriggerSyncResult> {
  const errors: string[] = [];
  const skippedSources: string[] = [];
  if (!process.env.DOFFIN_API_KEY) skippedSources.push("doffin (DOFFIN_API_KEY mangler)");
  if (!process.env.NAV_FEED_TOKEN) skippedSources.push("nav (NAV_FEED_TOKEN mangler)");

  const sets = await pool.query<{ organization_id: string; name: string }>(
    `SELECT DISTINCT organization_id::text, name FROM geo_prompt_sets
      WHERE status = 'approved' AND organization_id IS NOT NULL`,
  );

  let inserted = 0;
  let verticalsChecked = 0;
  const now = new Date();
  const insertEvent = async (orgId: string, e: TriggerEvent) => {
    if (!isFreshTrigger(e, now)) return;
    const r = await pool.query(
      `INSERT INTO trigger_events
         (organization_id, source, event_id, kind, title, url, published_at, matched_topic)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, source, event_id) DO NOTHING`,
      [orgId, e.source, e.eventId, e.kind, e.title.slice(0, 500), e.url, e.publishedAt, e.matchedTopic],
    );
    inserted += r.rowCount ?? 0;
  };

  for (const set of sets.rows) {
    const keywords = TRIGGER_KEYWORDS[set.name];
    if (!keywords) continue;
    verticalsChecked += 1;
    try {
      const tenders = await fetchTedTenders(keywords[0], set.name);
      const doffin = await fetchDoffinTenders(keywords[0], set.name);
      const media = await fetchGdeltMentions(`(${keywords.join(" OR ")}) ${GDELT_STRATEGY_TERMS}`, set.name);
      for (const e of [...tenders, ...doffin, ...media]) await insertEvent(set.organization_id, e);
    } catch (err) {
      errors.push(`${set.name}: ${String(err).slice(0, 100)}`);
    }
  }

  // Lead-nivå: strategisignaler for aktive pipeline-selskaper (topp 10 per org)
  const leads = await pool.query<{ organization_id: string; name: string }>(
    `SELECT DISTINCT ON (c.organization_id, c.name) c.organization_id::text, c.name
       FROM crm_customers c
      WHERE c.organization_id IS NOT NULL AND c.archived_at IS NULL
        AND c.pipeline_stage NOT IN ('won','lost')
        AND length(c.name) >= 4
      ORDER BY c.organization_id, c.name, c.updated_at DESC
      LIMIT 10`,
  );
  for (const lead of leads.rows) {
    try {
      const media = await fetchGdeltMentions(`"${lead.name}" ${GDELT_STRATEGY_TERMS}`, lead.name);
      for (const e of media) await insertEvent(lead.organization_id, e);
    } catch (err) {
      errors.push(`lead ${lead.name}: ${String(err).slice(0, 100)}`);
    }
  }

  return {
    organizations: new Set(sets.rows.map((s) => s.organization_id)).size,
    verticalsChecked,
    leadsChecked: leads.rows.length,
    eventsInserted: inserted,
    skippedSources,
    errors,
  };
}
