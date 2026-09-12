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
import { fetchIprProfile } from "../lead-ip-service.js";

export interface TriggerEvent {
  source: "ted" | "gdelt" | "doffin" | "patentstyret";
  eventId: string;
  kind: "tender" | "strategy_media" | "ip_filing" | "award";
  title: string;
  url: string | null;
  publishedAt: string | null; // YYYY-MM-DD
  matchedTopic: string;
  /** Anbudsdetaljer (Doffin): frist, verdi, oppdragsgiver — vises i innsikten. */
  raw?: Record<string, unknown>;
}

/** Anbud eldre enn dette er ikke et salgsvindu — filtreres før lagring. */
export const MAX_TRIGGER_AGE_DAYS = 60;

export function isFreshTrigger(e: TriggerEvent, now: Date): boolean {
  if (!e.publishedAt) return true; // ukjent dato → behold (detektoren viser det)
  const age = (now.getTime() - new Date(`${e.publishedAt}T00:00:00Z`).getTime()) / 86_400_000;
  return age <= MAX_TRIGGER_AGE_DAYS;
}

/**
 * Anbuds-sourcing per vertikal — KVALITETSRUNDEN 2026-07-13:
 * Tekstsøk ga 60-70 % støy (TED matcher alle EU-språk — fransk «dans»
 * traff vintervedlikehold; «foto» traff photocopy/beskrivelser).
 * CPV-koder er anbudsverdenens NACE: presise, verifiserte mot begge
 * API-er (treff-tall i kommentar). Norsk tekstsøk beholdes KUN der det
 * beviste seg i første fangst.
 */
export const TENDER_SOURCING: Record<string, { cpv: string[]; doffinText: string[] }> = {
  "CreatorHub — fotografer og videografer": {
    cpv: ["79961000"], // fototjenester — 63 Doffin-treff verifisert, inkl. «Kjøp av foto- og videotenester»
    doffinText: [],
  },
  "The Role Room — casting og produksjon": {
    cpv: ["92111000"], // film-/videoproduksjon — 166 treff verifisert
    doffinText: [],
  },
  "The Role Room — dansestudio": {
    cpv: ["92312000", "92310000"], // kunstneriske tjenester — 69/90 treff; dans-anbud er sjeldne, ærlig bredde
    doffinText: [],
  },
  // Utdanning: 80000000 er for bred (2459 treff) — bevisst usourcet inntil presis kode finnes
  "Leadgrid — små bedrifter (feltsalg/leads)": {
    cpv: [],
    doffinText: ["håndverkertjenester"], // beviste seg: rammeavtalene er leads for Leadgrids kunder
  },
  "Leadgrid — salgsteam og større organisasjoner": {
    cpv: [],
    doffinText: ["CRM"], // beviste seg: fant markedsdialogen
  },
};

/** Vertikal → søkeord for MEDIE-kilder (GDELT/RSS — ord-grense-matchet). */
export const TRIGGER_KEYWORDS: Record<string, string[]> = {
  "CreatorHub — fotografer og videografer": ["foto", "video", "film"],
  "The Role Room — casting og produksjon": ["film", "tv-produksjon", "casting"],
  "The Role Room — dansestudio": ["dans", "kulturskole"],
  "The Role Room — utdanningsinstitusjoner": ["medieutdanning", "filmutdanning"],
  "Leadgrid — små bedrifter (feltsalg/leads)": ["håndverk", "vedlikehold"],
  "Leadgrid — salgsteam og større organisasjoner": ["crm", "salgsverktøy"],
};

const GDELT_STRATEGY_TERMS = '(bærekraftstrategi OR "ny strategi" OR satsing OR klimamål)';

/**
 * Krav-leksikon for anbudstekster (deterministisk — ingen LLM-gjetting).
 * Justeringsflate: utvides når aggregatet viser hull.
 */
export const TENDER_REQUIREMENT_LEXICON: Array<{ key: string; label: string; patterns: string[] }> = [
  { key: "miljo", label: "Miljøkrav", patterns: ["miljøkrav", "miljøsertifis", "iso 14001", "svanemerk", "miljøfyrtårn", "klimakrav", "utslippsfri"] },
  { key: "kvalitet", label: "Kvalitetssystem", patterns: ["iso 9001", "kvalitetssystem", "kvalitetssikringssystem"] },
  { key: "rammeavtale", label: "Rammeavtale", patterns: ["rammeavtale"] },
  { key: "sikkerhet", label: "Sikkerhetsklarering", patterns: ["sikkerhetsklarering", "sikkerhetsavtale", "klarert personell"] },
  { key: "personvern", label: "Personvern/GDPR", patterns: ["gdpr", "databehandleravtale", "personvernforordning"] },
  { key: "universell", label: "Universell utforming", patterns: ["universell utforming", "wcag"] },
  { key: "laerling", label: "Lærlingkrav", patterns: ["lærling"] },
  { key: "ehf", label: "EHF-faktura", patterns: ["ehf", "elektronisk faktura"] },
];

/** Hvilke krav nevnes i anbudsteksten? Ren tekst-match, små bokstaver. */
export function extractTenderRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TENDER_REQUIREMENT_LEXICON
    .filter((req) => req.patterns.some((p) => lower.includes(p)))
    .map((req) => req.key);
}

// ─────────────────────────────────────────────────────────────────────
// Rene mappere (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

interface TedNotice {
  "publication-number"?: string;
  "notice-title"?: Record<string, string | string[]>;
  "publication-date"?: string;
  "notice-type"?: string;
  "buyer-name"?: Record<string, string | string[]>;
  "deadline-receipt-tender-date-lot"?: string[];
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
    // eForms notice-type skiller utlysning fra resultat: can-* og veat er
    // tildelinger — ikke salgsvindu, men mat for re-utlysningsradaren.
    // (Fanget 17.07: can-standard ble servert som «vurder om dere kan
    // levere» på en kontrakt signert to dager før.) pin-only/pin-buyer er
    // planlegging: kravene formes NÅ — speiler Doffin-mapperens RFI-gren.
    const type = n["notice-type"] ?? "";
    const isAward = type.startsWith("can-") || type === "veat";
    const isRfi = type === "pin-only" || type === "pin-buyer";
    const buyers = n["buyer-name"] ?? {};
    const buyerName =
      firstText(buyers.nor) ?? firstText(buyers.eng) ?? firstText(Object.values(buyers)[0]);
    out.push({
      source: "ted",
      eventId: id,
      kind: isAward ? "award" : "tender",
      title,
      url: `https://ted.europa.eu/en/notice/${id}`,
      publishedAt: n["publication-date"]?.slice(0, 10) ?? null,
      matchedTopic: topic,
      raw: {
        deadline: n["deadline-receipt-tender-date-lot"]?.[0]?.slice(0, 10) ?? null,
        buyerName,
        noticeType: type || null,
        requirements: extractTenderRequirements(title),
        ...(isRfi ? { isRfi: true } : {}),
      },
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

async function fetchTedTenders(cpv: string, topic: string): Promise<TriggerEvent[]> {
  const result = await callExternalApi<{ notices?: TedNotice[] }>(
    "https://api.ted.europa.eu/v3/notices/search",
    {
      method: "POST",
      timeoutMs: 15_000,
      label: "ted-tenders",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // CPV i stedet for tittel-tekst: TED søker titler på ALLE EU-språk,
        // så fransk «dans» traff vintervedlikehold (kvalitetsrunden 13.07).
        // SORT BY må stå i spørrestrengen — eget sort-felt avvises av API-et.
        query: `place-of-performance IN (NOR) AND classification-cpv IN (${cpv}) SORT BY publication-date DESC`,
        fields: [
          "publication-number",
          "notice-title",
          "publication-date",
          "notice-type",
          "buyer-name",
          "deadline-receipt-tender-date-lot",
        ],
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
  description?: string;
  publicationDate?: string;
  deadline?: string;
  status?: string;
  estimatedValue?: { currencyCode?: string; amount?: number };
  buyer?: Array<{ name?: string }>;
  cpvCodes?: string[];
  allTypes?: string[];
  receivedTenders?: number | null;
  lots?: Array<{ winner?: Array<{ name?: string; organizationId?: string }> }>;
}

/** Mapping verifisert mot faktisk API-respons 2026-07-13 (nøkkel aktiv). */
export function mapDoffinHits(hits: DoffinHit[], topic: string): TriggerEvent[] {
  const out: TriggerEvent[] = [];
  for (const h of hits) {
    const title = h.heading ?? h.title;
    if (!h.id || !title) continue;
    const types = h.allTypes ?? [];
    if (types.some((t) => t.startsWith("CANCELLED"))) continue;

    const isAward = types.includes("RESULT") || types.includes("ANNOUNCEMENT_OF_CONCLUSION_OF_CONTRACT");
    // RFI/markedsdialog: kravene formes NÅ — tidligere og mer verdt enn anbudet
    const isRfi = types.includes("PLANNING") || types.includes("ADVISORY_NOTICE");
    if (!isAward && h.status && h.status !== "ACTIVE") continue; // utgåtte anbud er ikke salgsvindu

    const winner = h.lots?.flatMap((l) => l.winner ?? [])[0];
    out.push({
      source: "doffin",
      eventId: String(h.id),
      kind: isAward ? "award" : "tender",
      title: title.trim(),
      url: `https://www.doffin.no/notices/${h.id}`,
      publishedAt: h.publicationDate?.slice(0, 10) ?? null,
      matchedTopic: topic,
      raw: {
        deadline: h.deadline?.slice(0, 10) ?? null,
        valueNok: h.estimatedValue?.currencyCode === "NOK" ? h.estimatedValue.amount ?? null : null,
        buyerName: h.buyer?.[0]?.name ?? null,
        cpvCodes: (h.cpvCodes ?? []).slice(0, 10),
        description: h.description?.slice(0, 1200) ?? null,
        requirements: extractTenderRequirements(`${title} ${h.description ?? ""}`),
        ...(isRfi ? { isRfi: true } : {}),
        ...(isAward
          ? {
              winnerName: winner?.name ?? null,
              winnerOrgNr: winner?.organizationId ?? null,
              receivedTenders: h.receivedTenders ?? null,
            }
          : {}),
      },
    });
  }
  return out;
}

/**
 * Doffin public API (Azure APIM — dof-notices-prod-api). Aktiveres av
 * DOFFIN_API_KEY (gratis abonnementsnøkkel fra utviklerportalen).
 */
async function fetchDoffinTenders(
  query: { cpv?: string; text?: string },
  topic: string,
): Promise<TriggerEvent[]> {
  const key = process.env.DOFFIN_API_KEY;
  if (!key) return [];
  const param = query.cpv
    ? `cpvCode=${encodeURIComponent(query.cpv)}`
    : `searchString=${encodeURIComponent(query.text ?? "")}`;
  const result = await callExternalApi<{ hits?: DoffinHit[]; notices?: DoffinHit[] }>(
    `https://api.doffin.no/public/v2/search?${param}&numHitsPerPage=10`,
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
         (organization_id, source, event_id, kind, title, url, published_at, matched_topic, raw)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (organization_id, source, event_id) DO UPDATE
         SET kind = EXCLUDED.kind, raw = EXCLUDED.raw
       WHERE trigger_events.kind IS DISTINCT FROM EXCLUDED.kind`,
      [orgId, e.source, e.eventId, e.kind, e.title.slice(0, 500), e.url, e.publishedAt, e.matchedTopic, JSON.stringify(e.raw ?? {})],
    );
    inserted += r.rowCount ?? 0;
  };

  for (const set of sets.rows) {
    const sourcing = TENDER_SOURCING[set.name];
    const keywords = TRIGGER_KEYWORDS[set.name];
    if (!sourcing && !keywords) continue;
    verticalsChecked += 1;
    try {
      const events: TriggerEvent[] = [];
      for (const cpv of sourcing?.cpv ?? []) {
        events.push(...(await fetchTedTenders(cpv, set.name)));
        events.push(...(await fetchDoffinTenders({ cpv }, set.name)));
      }
      for (const text of sourcing?.doffinText ?? []) {
        events.push(...(await fetchDoffinTenders({ text }, set.name)));
      }
      if (keywords) {
        events.push(...(await fetchGdeltMentions(`(${keywords.join(" OR ")}) ${GDELT_STRATEGY_TERMS}`, set.name)));
      }
      for (const e of events) await insertEvent(set.organization_id, e);
    } catch (err) {
      errors.push(`${set.name}: ${String(err).slice(0, 100)}`);
    }
  }

  // Lead-nivå: strategisignaler + fersk varemerke-aktivitet for aktive
  // pipeline-selskaper (topp 10 per org)
  const leads = await pool.query<{ organization_id: string; name: string; enrichment_org_nr: string | null }>(
    `SELECT DISTINCT ON (c.organization_id, c.name) c.organization_id::text, c.name, c.enrichment_org_nr
       FROM crm_customers c
      WHERE c.organization_id IS NOT NULL AND c.archived_at IS NULL
        AND c.pipeline_stage NOT IN ('won','lost')
        AND length(c.name) >= 4
      ORDER BY c.organization_id, c.name, c.updated_at DESC
      LIMIT 10`,
  );
  const ipFreshCutoff = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  for (const lead of leads.rows) {
    try {
      const media = await fetchGdeltMentions(`"${lead.name}" ${GDELT_STRATEGY_TERMS}`, lead.name);
      for (const e of media) await insertEvent(lead.organization_id, e);
      const ip = await fetchIprProfile(lead.enrichment_org_nr, lead.name);
      for (const tm of ip?.recentTrademarks ?? []) {
        if (!tm.statusDate || tm.statusDate < ipFreshCutoff || !tm.applicationNumber) continue;
        await insertEvent(lead.organization_id, {
          source: "patentstyret",
          eventId: tm.applicationNumber,
          kind: "ip_filing",
          title: `${lead.name}: varemerke «${tm.text}» (${tm.status ?? "ny status"})`,
          url: tm.caseUrl,
          publishedAt: tm.statusDate,
          matchedTopic: lead.name,
          raw: { matchedBy: ip?.matchedBy ?? null },
        });
      }
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
