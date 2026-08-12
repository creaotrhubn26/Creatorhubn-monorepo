/**
 * leadgrid-doffin-routes.ts
 *
 * Anbud (Doffin) — tilleggstjeneste: søk i Doffin (Database for offentlige
 * anskaffelser) direkte fra Leadgrid, med lagrede overvåkninger per org.
 * Oppdragsgivere kommer med organisasjonsnummer → «Opprett lead fra anbud»
 * på iPad kan koble kunngjøringen rett inn i CRM-et.
 *
 * Upstream: api.doffin.no/public/v2/search (Ocp-Apim-Subscription-Key =
 * env DOFFIN_API_KEY). Ingen detalj-endepunkt i v2 — søket returnerer full
 * kunngjøringsstruktur, og doffin.no/notices/{id} lenkes for dokumentene.
 * Svar caches i 5 min (in-memory) for å skåne kvoten.
 *
 * Entitlement: feature-nøkkel `leadgridAnbud` (server-håndhevet, gruppen
 * gates som Kvalitet/Go). Fail-open for org-er uten matrise-rader.
 *
 * Mount: /api/leadgrid/doffin/*
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled, LEADGRID_ANBUD_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { sendAPNs } from "./lead-map-apns-client.js";
import { withAIQuota } from "./leadgrid-ai-queue.js";
import { sendEmail, isEmailConfigured } from "./casting-reminder-sender.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Cron-trigger for overvåknings-sjekk (samme token-mønster som AI-billing).
const DOFFIN_CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";

// ── Kunde-match (nivå 1, 2026-08-03) ─────────────────────────────────
// Kjernen i integrasjonsverdien: kunngjøringer der oppdragsgiverens
// org.nr allerede finnes i org-ens CRM flagges med lead + eier. Skal
// ALDRI velte søket — fail-open overalt.

type KundeMatch = {
  lead_id: string;
  lead_navn: string;
  lead_status: string | null;
  eier: string | null;
};

const ORG_MEMBERS_SUBQUERY =
  `SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid`;

async function matchKunder(
  pool: Pool, orgId: string, orgnrs: string[],
): Promise<Map<string, KundeMatch>> {
  const unique = [...new Set(orgnrs.filter((o) => /^\d{9}$/.test(o)))];
  if (unique.length === 0) return new Map();
  try {
    const r = await pool.query<{
      lead_id: string; name: string; lead_status: string | null;
      org_nr: string; eier: string | null;
    }>(
      `SELECT c.id::text AS lead_id, c.name, c.lead_status,
              c.enrichment_org_nr AS org_nr,
              NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS eier
         FROM crm_customers c
         LEFT JOIN users u
           ON u.id::text = COALESCE(c.assigned_user_id, c.owner_user_id)
        WHERE c.enrichment_org_nr = ANY($2)
          AND c.owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        ORDER BY c.updated_at DESC`,
      [orgId, unique],
    );
    const map = new Map<string, KundeMatch>();
    for (const row of r.rows) {
      // Nyeste lead vinner ved duplikater (ORDER BY + first-write-wins).
      if (!map.has(row.org_nr)) {
        map.set(row.org_nr, {
          lead_id: row.lead_id,
          lead_navn: row.name,
          lead_status: row.lead_status,
          eier: row.eier,
        });
      }
    }
    return map;
  } catch (e) {
    console.warn("[doffin] kunde-match feilet:", String(e).slice(0, 120));
    return new Map();
  }
}

/** Legg kunde_match på normaliserte kunngjøringer (ny kopi — det
 *  cachede søkesvaret er delt på tvers av org-er og må forbli generisk). */
function withKundeMatch(
  body: unknown, matches: Map<string, KundeMatch>,
): unknown {
  const b = body as { total?: number; kunngjoringer?: Record<string, unknown>[] };
  if (!Array.isArray(b?.kunngjoringer) || matches.size === 0) return body;
  return {
    ...b,
    kunngjoringer: b.kunngjoringer.map((k) => {
      const buyers = (k.oppdragsgivere as { orgnr?: string }[] | undefined) ?? [];
      const hit = buyers.map((o) => matches.get(String(o.orgnr ?? ""))).find(Boolean);
      return hit ? { ...k, kunde_match: hit } : k;
    }),
  };
}

const DOFFIN_BASE = "https://api.doffin.no/public/v2";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HITS = 50;

type CacheEntry = { at: number; body: unknown };
const searchCache = new Map<string, CacheEntry>();

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  // Lagrede overvåkninger: navngitte søk org-en følger med på.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_doffin_watches (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      query JSONB NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_doffin_watches_org
      ON leadgrid_doffin_watches (organization_id)`);
  // Fase 2 (2026-08-02): varsler ved nye treff — lat selvheler, ingen
  // manuell migrasjon (samme mønster som NRPS-roster-syncen).
  await pool.query(`
    ALTER TABLE leadgrid_doffin_watches
      ADD COLUMN IF NOT EXISTS seen_ids JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS new_hits_count INT NOT NULL DEFAULT 0`);
  // Nivå 2 (2026-08-03): anbuds-pipeline — anbudet gjennom salgsprosessen
  // (vurderer → går for → tilbud levert → vant/tapt) med frist-motor og
  // team-tildeling. Kunngjørings-feltene denormaliseres inn (Doffin har
  // ikke detalj-oppslag, og pipelinen skal overleve at søket endres).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_anbud_pipeline (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      doffin_id TEXT NOT NULL,
      tittel TEXT NOT NULL,
      oppdragsgiver TEXT NOT NULL DEFAULT '',
      orgnr TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      frist TIMESTAMPTZ,
      verdi NUMERIC,
      status TEXT NOT NULL DEFAULT 'vurderer',
      assigned_user_id TEXT,
      notat TEXT NOT NULL DEFAULT '',
      varslet_7d BOOLEAN NOT NULL DEFAULT FALSE,
      varslet_1d BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (organization_id, doffin_id)
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_anbud_pipeline_org
      ON leadgrid_anbud_pipeline (organization_id, status)`);
  // Nivå 3 (2026-08-03): geokoding (Brreg-adresse → Geonorge) + tapt-årsak
  // for læringssløyfen. Lat selvheler som resten.
  await pool.query(`
    ALTER TABLE leadgrid_anbud_pipeline
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS adresse TEXT,
      ADD COLUMN IF NOT EXISTS tapt_aarsak TEXT`);
  schemaReady = true;
}

const TAPT_AARSAKER = new Set(["pris", "kapasitet", "krav", "referanser", "annet"]);

/** Nivå 3: orgnr → forretningsadresse (Brreg, åpen) → koordinater
 *  (Geonorge adresse-søk, åpen). Best effort — null ved alt annet enn treff. */
async function geocodeOrgnr(
  orgnr: string,
): Promise<{ lat: number; lng: number; adresse: string } | null> {
  if (!/^\d{9}$/.test(orgnr)) return null;
  try {
    const enhetResp = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
      { signal: AbortSignal.timeout(10_000) });
    if (!enhetResp.ok) return null;
    const enhet = (await enhetResp.json()) as {
      forretningsadresse?: { adresse?: string[]; postnummer?: string; poststed?: string };
    };
    const fa = enhet.forretningsadresse;
    const gate = (fa?.adresse ?? [])[0] ?? "";
    const adresse = [gate, [fa?.postnummer, fa?.poststed].filter(Boolean).join(" ")]
      .filter((s) => s && s.length > 0).join(", ");
    if (!adresse) return null;
    const geoResp = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adresse)}&treffPerSide=1`,
      { signal: AbortSignal.timeout(10_000) });
    if (!geoResp.ok) return null;
    const geo = (await geoResp.json()) as {
      adresser?: { representasjonspunkt?: { lat?: number; lon?: number } }[];
    };
    const pkt = geo.adresser?.[0]?.representasjonspunkt;
    if (pkt?.lat == null || pkt?.lon == null) return null;
    return { lat: pkt.lat, lng: pkt.lon, adresse };
  } catch {
    return null;
  }
}

const PIPELINE_STATUSES = new Set(["vurderer", "gaar_for", "tilbud_levert", "vant", "tapt"]);

/** Normalisert kunngjøring — stabil form mot iPad uavhengig av upstream. */
function normalizeHit(hit: Record<string, unknown>): Record<string, unknown> {
  const buyers = Array.isArray(hit.buyer) ? (hit.buyer as Record<string, unknown>[]) : [];
  const value = (hit.estimatedValue ?? null) as { currencyCode?: string; amount?: number } | null;
  return {
    id: String(hit.id ?? ""),
    tittel: String(hit.heading ?? ""),
    beskrivelse: String(hit.description ?? ""),
    oppdragsgivere: buyers.map((b) => ({
      navn: String(b.name ?? ""),
      // Doffin leverer orgnr både med og uten mellomrom («921 770 669»).
      orgnr: String(b.organizationId ?? "").replace(/\s+/g, ""),
    })),
    verdi: value?.amount != null
      ? { belop: value.amount, valuta: value.currencyCode ?? "NOK" }
      : null,
    type: String(hit.type ?? ""),
    status: String(hit.status ?? ""),
    kunngjort: (hit.publicationDate as string | null) ?? null,
    frist: (hit.deadline as string | null) ?? null,
    nutsKoder: Array.isArray(hit.locationId) ? hit.locationId : [],
    cpvKoder: Array.isArray(hit.cpvCodes) ? hit.cpvCodes : [],
    url: `https://doffin.no/notices/${String(hit.id ?? "")}`,
    // Vinnere på AWARDED-kunngjøringer — BEST EFFORT: feltnavnet er ikke
    // dokumentert i v2; vi leser de vanligste kandidatene defensivt og
    // utelater feltet når ingenting finnes (aldri gjett).
    vinnere: extractWinners(hit),
  };
}

function extractWinners(hit: Record<string, unknown>): { navn: string; orgnr: string }[] {
  const candidates = [hit.winners, hit.awardedSuppliers, hit.winner, hit.suppliers];
  for (const c of candidates) {
    const arr = Array.isArray(c) ? c : (c && typeof c === "object" ? [c] : []);
    const parsed = (arr as Record<string, unknown>[])
      .map((w) => ({
        navn: String(w.name ?? w.navn ?? ""),
        orgnr: String(w.organizationId ?? w.orgnr ?? "").replace(/\s+/g, ""),
      }))
      .filter((w) => w.navn.length > 0);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

/** Hvitlistet param-bygging mot upstream. */
function buildUpstreamQuery(req: Request): URLSearchParams | { error: string } {
  const q = new URLSearchParams();
  const hits = Math.min(MAX_HITS, Math.max(1, Number(req.query.hits) || 20));
  q.set("numHitsPerPage", String(hits));
  const page = Math.max(1, Number(req.query.page) || 1);
  if (page > 1) q.set("page", String(page));
  const text = String(req.query.q ?? "").trim();
  if (text.length > 200) return { error: "Søketekst over 200 tegn." };
  if (text) q.set("searchString", text);
  const location = String(req.query.location ?? "").trim();
  if (location) {
    if (!/^[A-Z0-9,]{2,60}$/i.test(location)) return { error: "Ugyldig location (NUTS-koder, kommaseparert)." };
    for (const l of location.split(",")) q.append("location", l.trim());
  }
  const cpv = String(req.query.cpv ?? "").trim();
  if (cpv) {
    if (!/^[0-9,]{2,120}$/.test(cpv)) return { error: "Ugyldig cpv (sifre, kommaseparert)." };
    for (const c of cpv.split(",")) q.append("cpvCode", c.trim());
  }
  const status = String(req.query.status ?? "ACTIVE").trim().toUpperCase();
  if (!["ACTIVE", "EXPIRED", "AWARDED", "CANCELLED", "ALL"].includes(status)) {
    return { error: "Ugyldig status." };
  }
  if (status !== "ALL") q.set("status", status);
  return q;
}

async function doffinSearch(params: URLSearchParams): Promise<{ ok: boolean; status: number; body: unknown }> {
  const apiKey = process.env.DOFFIN_API_KEY || "";
  if (!apiKey) {
    return { ok: false, status: 503, body: { error: "doffin_not_configured", message: "DOFFIN_API_KEY mangler på serveren." } };
  }
  const cacheKey = params.toString();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, status: 200, body: cached.body };
  }
  const resp = await fetch(`${DOFFIN_BASE}/search?${cacheKey}`, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    return { ok: false, status: resp.status === 429 ? 429 : 502,
             body: { error: "doffin_upstream", message: `Doffin svarte ${resp.status}.` } };
  }
  const raw = (await resp.json()) as { numHitsTotal?: number; hits?: Record<string, unknown>[] };
  const body = {
    total: raw.numHitsTotal ?? 0,
    kunngjoringer: (raw.hits ?? []).map(normalizeHit),
  };
  searchCache.set(cacheKey, { at: Date.now(), body });
  if (searchCache.size > 300) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) searchCache.delete(oldest[0]);
  }
  return { ok: true, status: 200, body };
}

export function registerLeadgridDoffinRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Søk i Doffin. Params: q, location (NUTS, komma), cpv (komma),
   *  status (ACTIVE default), hits (<=50), page. */
  app.get("/api/leadgrid/doffin/search", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      const params = buildUpstreamQuery(req);
      if (params instanceof URLSearchParams === false) {
        res.status(400).json({ error: "bad_request", message: (params as { error: string }).error });
        return;
      }
      const r = await doffinSearch(params);
      // Kunde-match (nivå 1): flagg treff der oppdragsgiveren allerede er
      // i org-ens CRM. Per-request-berikelse — cachen forblir generisk.
      let body = r.body;
      if (r.ok) {
        const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
        if (orgId) {
          const hits = (r.body as { kunngjoringer?: { oppdragsgivere?: { orgnr?: string }[] }[] })
            .kunngjoringer ?? [];
          const orgnrs = hits.flatMap((k) => (k.oppdragsgivere ?? []).map((o) => String(o.orgnr ?? "")));
          const matches = await matchKunder(pool, orgId, orgnrs);
          body = withKundeMatch(r.body, matches);
        }
      }
      res.status(r.status).json(body);
    } catch (e) {
      console.error("[doffin] search failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Lagrede overvåkninger for org-en. */
  app.get("/api/leadgrid/doffin/watches", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ watches: [] }); return; }
      const r = await pool.query(
        `SELECT id, name, query, created_at, new_hits_count FROM leadgrid_doffin_watches
          WHERE organization_id = $1 ORDER BY created_at DESC`, [orgId]);
      res.json({ watches: r.rows });
    } catch (e) {
      console.error("[doffin] watches failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Marker overvåkning som sett: nullstiller «nye treff»-telleren
   *  (badgen på iPad). Kalles når brukeren kjører/åpner overvåkningen. */
  app.post("/api/leadgrid/doffin/watches/:id/mark-seen", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      await pool.query(
        `UPDATE leadgrid_doffin_watches SET new_hits_count = 0, updated_at = now()
          WHERE id = $1 AND organization_id = $2`,
        [String(req.params.id), orgId]);
      res.json({ ok: true });
    } catch (e) {
      console.error("[doffin] mark-seen failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Opprett overvåkning: { name, query: { q?, location?, cpv? } } */
  app.post("/api/leadgrid/doffin/watches", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const name = String(req.body?.name ?? "").trim().slice(0, 120);
      const query = req.body?.query && typeof req.body.query === "object" ? req.body.query : {};
      if (!name) { res.status(400).json({ error: "bad_request", message: "name er påkrevd." }); return; }
      const count = await pool.query(
        `SELECT COUNT(*)::int AS n FROM leadgrid_doffin_watches WHERE organization_id = $1`, [orgId]);
      if ((count.rows[0]?.n ?? 0) >= 25) {
        res.status(400).json({ error: "too_many_watches", message: "Maks 25 overvåkninger per organisasjon." });
        return;
      }
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadgrid_doffin_watches (id, organization_id, name, query, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, orgId, name, JSON.stringify(query), session.userId]);
      res.json({ ok: true, id });
    } catch (e) {
      console.error("[doffin] create watch failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** AI-prioritering (nivå 1): batch-scorer kunngjøringer mot org-ens
   *  LAGREDE OVERVÅKNINGER (de uttrykker intensjonen — ærligere enn å
   *  gjette profil). Krever minst én overvåkning. Kostnadsbærende →
   *  logges i leadbook_ai_usage (feature 'anbud_score'). */
  app.post("/api/leadgrid/doffin/score", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      if (!ANTHROPIC_API_KEY) {
        res.status(503).json({ error: "ai_ikke_konfigurert" });
        return;
      }
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const watches = await pool.query<{ name: string; query: Record<string, unknown> }>(
        `SELECT name, query FROM leadgrid_doffin_watches
          WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 25`, [orgId]);
      if (watches.rowCount === 0) {
        res.status(400).json({
          error: "ingen_overvaakninger",
          message: "AI-prioritering bruker overvåkningene dine som profil — lagre minst ett søk først.",
        });
        return;
      }
      const raw = Array.isArray(req.body?.kunngjoringer) ? req.body.kunngjoringer : [];
      const items = (raw as Record<string, unknown>[]).slice(0, 20).map((k) => ({
        id: String(k.id ?? ""),
        tittel: String(k.tittel ?? "").slice(0, 150),
        beskrivelse: String(k.beskrivelse ?? "").slice(0, 350),
        cpv: Array.isArray(k.cpvKoder) ? (k.cpvKoder as string[]).slice(0, 4) : [],
        fylker: Array.isArray(k.nutsKoder) ? (k.nutsKoder as string[]).slice(0, 3) : [],
        verdi: (k.verdi as { belop?: number } | null)?.belop ?? null,
      })).filter((k) => k.id && k.tittel);
      if (items.length === 0) {
        res.status(400).json({ error: "bad_request", message: "kunngjoringer er påkrevd." });
        return;
      }
      const profil = watches.rows
        .map((w) => `- «${w.name}» (søk: ${JSON.stringify(w.query)})`)
        .join("\n");
      const prompt = `Du prioriterer offentlige anbud for en norsk feltsalg-bedrift. Bedriftens lagrede overvåkninger (dette er intensjonen deres):
${profil}

Scor hver kunngjøring 0-100 for hvor godt den passer intensjonen (bransje/CPV-nærhet, geografi, kontraktstype). Vær edruelig: 80+ kun ved tydelig match. Returner KUN gyldig JSON:
{"scores":[{"id":"...","score":0-100,"hvorfor":"<maks 12 ord på norsk>"}]}

Kunngjøringer:
${JSON.stringify(items)}`;
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await withAIQuota("claude", null, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }));
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text).join("");
      // Kostnadslogg — best effort (samme tabell/priser som leadbook-AI).
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null ? (inTok * 3 + outTok * 15) / 1_000_000 : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,'anbud_score',$5,$6,$7,$8,$9)`,
          [randomUUID(), orgId, session.userId, "", "claude-sonnet-4-6",
           JSON.stringify(items).length, inTok, outTok, cost]);
      } catch { /* logging velter aldri svaret */ }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ error: "ai_svar_uparsbart" }); return; }
      const parsed = JSON.parse(match[0]) as { scores?: unknown[] };
      res.json({ scores: Array.isArray(parsed.scores) ? parsed.scores : [] });
    } catch (e) {
      console.error("[doffin] score failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Tildelings-innsikt (nivå 1): aggregert AWARDED for valgt cpv/fylke —
   *  antall, samlet verdi, topp oppdragsgivere og (best effort) vinnere.
   *  Ingen AI — ren aggregering av Doffin-data ingen SMB ser samlet i dag. */
  app.get("/api/leadgrid/doffin/tildelinger", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      const q = new URLSearchParams();
      q.set("numHitsPerPage", "50");
      q.set("status", "AWARDED");
      const cpv = String(req.query.cpv ?? "").trim();
      if (cpv && /^[0-9,]{2,120}$/.test(cpv)) {
        for (const c of cpv.split(",")) q.append("cpvCode", c.trim());
      }
      const location = String(req.query.location ?? "").trim();
      if (location && /^[A-Z0-9,]{2,60}$/i.test(location)) {
        for (const l of location.split(",")) q.append("location", l.trim());
      }
      const r = await doffinSearch(q);
      if (!r.ok) { res.status(r.status).json(r.body); return; }
      const hits = (r.body as { total?: number; kunngjoringer?: Record<string, unknown>[] });
      const list = hits.kunngjoringer ?? [];
      let sumVerdi = 0;
      const perOppdragsgiver = new Map<string, { navn: string; antall: number; verdi: number }>();
      const perVinner = new Map<string, { navn: string; antall: number }>();
      for (const k of list) {
        const belop = (k.verdi as { belop?: number } | null)?.belop ?? 0;
        sumVerdi += belop;
        for (const og of (k.oppdragsgivere as { navn?: string; orgnr?: string }[] | undefined) ?? []) {
          const key = String(og.orgnr || og.navn || "");
          if (!key) continue;
          const cur = perOppdragsgiver.get(key) ?? { navn: String(og.navn ?? ""), antall: 0, verdi: 0 };
          cur.antall += 1; cur.verdi += belop;
          perOppdragsgiver.set(key, cur);
        }
        for (const v of (k.vinnere as { navn?: string; orgnr?: string }[] | undefined) ?? []) {
          const key = String(v.orgnr || v.navn || "");
          if (!key) continue;
          const cur = perVinner.get(key) ?? { navn: String(v.navn ?? ""), antall: 0 };
          cur.antall += 1;
          perVinner.set(key, cur);
        }
      }
      res.json({
        total: hits.total ?? list.length,
        utvalg: list.length,
        sum_verdi: sumVerdi,
        topp_oppdragsgivere: [...perOppdragsgiver.values()]
          .sort((a, b) => b.antall - a.antall).slice(0, 5),
        // Tom liste = Doffin v2 eksponerer ikke vinnere i søket — UI-et
        // skal si det ærlig, ikke late som innsikten finnes.
        topp_vinnere: [...perVinner.values()]
          .sort((a, b) => b.antall - a.antall).slice(0, 5),
      });
    } catch (e) {
      console.error("[doffin] tildelinger failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ── Anbuds-pipeline (nivå 2, 2026-08-03) ──────────────────────────

  /** Liste + stats for org-ens pipeline. */
  app.get("/api/leadgrid/doffin/pipeline", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ items: [], stats: null }); return; }
      const r = await pool.query(
        `SELECT p.id, p.doffin_id, p.tittel, p.oppdragsgiver, p.orgnr, p.url,
                p.frist, p.verdi::float8 AS verdi, p.status, p.assigned_user_id,
                p.notat, p.created_at, p.lat, p.lng, p.adresse, p.tapt_aarsak,
                NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS assigned_navn
           FROM leadgrid_anbud_pipeline p
           LEFT JOIN users u ON u.id::text = p.assigned_user_id
          WHERE p.organization_id = $1
          ORDER BY CASE WHEN p.status IN ('vant','tapt') THEN 1 ELSE 0 END,
                   p.frist ASC NULLS LAST, p.created_at DESC`,
        [orgId]);
      const vant = r.rows.filter((x) => x.status === "vant").length;
      const tapt = r.rows.filter((x) => x.status === "tapt").length;
      const aapne = r.rows.length - vant - tapt;
      const sumAapneVerdi = r.rows
        .filter((x) => x.status !== "vant" && x.status !== "tapt")
        .reduce((s, x) => s + (Number(x.verdi) || 0), 0);
      // Nivå 3: tapsårsaker → læringssløyfe (samme mønster som Kvalitets
      // underkjenningsårsaker → Pondus).
      const aarsaker = new Map<string, number>();
      for (const row of r.rows) {
        if (row.status === "tapt" && row.tapt_aarsak) {
          aarsaker.set(row.tapt_aarsak, (aarsaker.get(row.tapt_aarsak) ?? 0) + 1);
        }
      }
      res.json({
        items: r.rows,
        stats: {
          aapne, vant, tapt,
          vinnrate: vant + tapt > 0 ? vant / (vant + tapt) : null,
          sum_aapne_verdi: sumAapneVerdi,
          tapsaarsaker: [...aarsaker.entries()]
            .map(([aarsak, antall]) => ({ aarsak, antall }))
            .sort((a, b) => b.antall - a.antall),
        },
      });
    } catch (e) {
      console.error("[doffin] pipeline list failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Legg kunngjøring i pipelinen (dedupe per org+doffin_id). */
  app.post("/api/leadgrid/doffin/pipeline", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const doffinId = String(b.doffin_id ?? "").trim();
      const tittel = String(b.tittel ?? "").trim().slice(0, 300);
      if (!doffinId || !tittel) {
        res.status(400).json({ error: "bad_request", message: "doffin_id og tittel er påkrevd." });
        return;
      }
      const frist = typeof b.frist === "string" && b.frist ? new Date(b.frist) : null;
      const id = randomUUID();
      const r = await pool.query(
        `INSERT INTO leadgrid_anbud_pipeline
           (id, organization_id, doffin_id, tittel, oppdragsgiver, orgnr, url,
            frist, verdi, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (organization_id, doffin_id) DO NOTHING
         RETURNING id`,
        [id, orgId, doffinId, tittel,
         String(b.oppdragsgiver ?? "").slice(0, 200),
         String(b.orgnr ?? "").replace(/\s+/g, "").slice(0, 9),
         String(b.url ?? "").slice(0, 300),
         frist && !Number.isNaN(frist.getTime()) ? frist : null,
         Number.isFinite(Number(b.verdi)) ? Number(b.verdi) : null,
         session.userId]);
      // Nivå 3: geokod oppdragsgiveren i bakgrunnen (Brreg → Geonorge) —
      // fire-and-forget, pins dukker opp ved neste pipeline-henting.
      const insertedId = r.rows[0]?.id as string | undefined;
      const orgnrForGeo = String(b.orgnr ?? "").replace(/\s+/g, "");
      if (insertedId && orgnrForGeo) {
        void (async () => {
          const geo = await geocodeOrgnr(orgnrForGeo);
          if (geo) {
            await pool.query(
              `UPDATE leadgrid_anbud_pipeline
                  SET lat = $2, lng = $3, adresse = $4, updated_at = now()
                WHERE id = $1`,
              [insertedId, geo.lat, geo.lng, geo.adresse]).catch(() => {});
          }
        })();
      }
      res.json({ ok: true, id: r.rows[0]?.id ?? null, allerede: r.rowCount === 0 });
    } catch (e) {
      console.error("[doffin] pipeline add failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Oppdater status/tildeling/notat. Tildeling varsler den tildelte. */
  app.patch("/api/leadgrid/doffin/pipeline/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const vals: unknown[] = [String(req.params.id), orgId];
      const push = (col: string, v: unknown) => {
        vals.push(v);
        sets.push(`${col} = $${vals.length}`);
      };
      if (typeof b.status === "string") {
        if (!PIPELINE_STATUSES.has(b.status)) {
          res.status(400).json({ error: "bad_request", message: "Ugyldig status." });
          return;
        }
        push("status", b.status);
      }
      let nyTildelt: string | null = null;
      if (b.assigned_user_id !== undefined) {
        nyTildelt = b.assigned_user_id === null ? null : String(b.assigned_user_id);
        push("assigned_user_id", nyTildelt);
      }
      if (typeof b.notat === "string") push("notat", b.notat.slice(0, 2000));
      // Nivå 3: tapt-årsak — læringssløyfen. Kun whitelistede verdier.
      if (typeof b.tapt_aarsak === "string") {
        if (!TAPT_AARSAKER.has(b.tapt_aarsak)) {
          res.status(400).json({ error: "bad_request", message: "Ugyldig tapt_aarsak." });
          return;
        }
        push("tapt_aarsak", b.tapt_aarsak);
      }
      if (sets.length === 0) {
        res.status(400).json({ error: "bad_request", message: "Ingen felt å oppdatere." });
        return;
      }
      sets.push("updated_at = now()");
      const r = await pool.query(
        `UPDATE leadgrid_anbud_pipeline SET ${sets.join(", ")}
          WHERE id = $1 AND organization_id = $2
          RETURNING tittel, assigned_user_id`,
        vals);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      // Tildelings-varsel (best effort) — ikke ved selv-tildeling.
      if (nyTildelt && nyTildelt !== session.userId) {
        const tittel = String(r.rows[0].tittel ?? "anbud");
        try {
          await pool.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, event_type, title, body,
                triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, 'doffin_anbud_tildelt', $3, $4, $5, 'leadgrid://anbud', $6::jsonb, FALSE)`,
            [nyTildelt, orgId, "Du er tildelt et anbud", tittel,
             session.userId, JSON.stringify({ pipeline_id: String(req.params.id) })]);
          const tok = await pool.query<{ token: string }>(
            `SELECT token FROM notification_device_tokens
              WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`, [nyTildelt]);
          for (const t of tok.rows) {
            const pr = await sendAPNs(t.token, "Du er tildelt et anbud", tittel, {
              customData: { event_type: "doffin_anbud_tildelt", deep_link: "leadgrid://anbud" },
            });
            if (pr.sent) break;
          }
        } catch (notifErr) {
          console.warn("[doffin] tildelings-varsel feilet:", String(notifErr).slice(0, 120));
        }
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[doffin] pipeline patch failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Fjern fra pipelinen. */
  app.delete("/api/leadgrid/doffin/pipeline/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      await pool.query(
        `DELETE FROM leadgrid_anbud_pipeline WHERE id = $1 AND organization_id = $2`,
        [String(req.params.id), orgId]);
      res.json({ ok: true });
    } catch (e) {
      console.error("[doffin] pipeline delete failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Tilbuds-assistent (siste idé fra salgbarhets-lista, 2026-08-04):
   *  AI-UTKAST til tilbudsdisposisjon + følgebrev + sjekkliste fra
   *  kunngjøringen. Eksplisitt utkast — skal alltid redigeres av mennesker
   *  før innsending. Kostnadslogget som anbud_tilbud. */
  app.post("/api/leadgrid/doffin/tilbudsutkast", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      if (!ANTHROPIC_API_KEY) { res.status(503).json({ error: "ai_ikke_konfigurert" }); return; }
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      const tittel = String(req.body?.tittel ?? "").slice(0, 300);
      const beskrivelse = String(req.body?.beskrivelse ?? "").slice(0, 6000);
      const krav = Array.isArray(req.body?.krav)
        ? (req.body.krav as unknown[]).map((k) => String(k).slice(0, 200)).slice(0, 10)
        : [];
      if (beskrivelse.trim().length < 40) {
        res.status(400).json({ error: "for_kort_tekst", message: "Kunngjøringen har for lite tekst til et utkast." });
        return;
      }
      const prompt = `Du hjelper en norsk feltsalg-bedrift å STRUKTURERE et tilbud på en offentlig kunngjøring. Dette er et UTKAST som mennesker skal redigere — vær konkret der teksten gir grunnlag, og skriv [FYLL INN: …] der bedriftsspesifikk info trengs. Ikke finn på fakta om bedriften. Returner KUN gyldig JSON:
{"disposisjon":[{"seksjon":"<seksjonstittel>","innhold":"<2-4 setninger utkast eller [FYLL INN]-instruks>"}],
 "folgebrev":"<kort følgebrev-utkast på norsk, 4-6 setninger, med [FYLL INN]-markører>",
 "sjekkliste":["<konkrete ting som må på plass før innsending, utledet av kunngjøringen>"]}

Kunngjøring: ${tittel}
${krav.length > 0 ? `\nKjente krav:\n${krav.map((k) => `- ${k}`).join("\n")}` : ""}

Beskrivelse:
${beskrivelse}`;
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await withAIQuota("claude", null, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }));
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text).join("");
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null ? (inTok * 3 + outTok * 15) / 1_000_000 : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,'anbud_tilbud',$5,$6,$7,$8,$9)`,
          [randomUUID(), orgId ?? "", session.userId, "", "claude-sonnet-4-6",
           beskrivelse.length, inTok, outTok, cost]);
      } catch { /* logging velter aldri svaret */ }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ error: "ai_svar_uparsbart" }); return; }
      res.json(JSON.parse(match[0]));
    } catch (e) {
      console.error("[doffin] tilbudsutkast failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** AI-lesehjelp (nivå 2): oppsummering + krav-ekstraksjon fra
   *  kunngjøringsteksten. Kostnadslogget som anbud_oppsummer. */
  app.post("/api/leadgrid/doffin/oppsummer", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      if (!ANTHROPIC_API_KEY) { res.status(503).json({ error: "ai_ikke_konfigurert" }); return; }
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      const tittel = String(req.body?.tittel ?? "").slice(0, 300);
      const beskrivelse = String(req.body?.beskrivelse ?? "").slice(0, 6000);
      if (beskrivelse.trim().length < 40) {
        res.status(400).json({ error: "for_kort_tekst", message: "Kunngjøringen har for lite tekst å oppsummere." });
        return;
      }
      const prompt = `Du hjelper en norsk feltsalg-bedrift å lese en offentlig kunngjøring. Returner KUN gyldig JSON:
{"sammendrag":"<2-3 setninger på norsk — hva anskaffes, for hvem, omfang>",
 "krav":["<konkrete leverandørkrav nevnt i teksten: sertifiseringer, omsetning, referanser, bemanning — kun det som faktisk står>"],
 "verdt_aa_vite":"<1 setning: frist-/opsjon-/delkontrakt-detalj hvis nevnt, ellers tom streng>"}

Ikke finn på krav som ikke står i teksten. Tittel: ${tittel}

Kunngjøring:
${beskrivelse}`;
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await withAIQuota("claude", null, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 700,
          messages: [{ role: "user", content: prompt }],
        }));
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text).join("");
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null ? (inTok * 3 + outTok * 15) / 1_000_000 : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,'anbud_oppsummer',$5,$6,$7,$8,$9)`,
          [randomUUID(), orgId ?? "", session.userId, "", "claude-sonnet-4-6",
           beskrivelse.length, inTok, outTok, cost]);
      } catch { /* logging velter aldri svaret */ }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ error: "ai_svar_uparsbart" }); return; }
      res.json(JSON.parse(match[0]));
    } catch (e) {
      console.error("[doffin] oppsummer failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Cron: ukentlig anbuds-digest på e-post til org-ens ledere (nivå 3).
   *  Per org med overvåkninger: ferske treff (kunngjort siste 7 d) per
   *  watch + kunde-matcher + pipeline-frister neste 14 d. Trigges av
   *  ekstern cron (f.eks. mandag 07:00) med x-cron-trigger-token. */
  app.post("/api/leadgrid/doffin/cron/ukesdigest", async (req, res) => {
    const t = req.headers["x-cron-trigger-token"] as string | undefined;
    if (!t || !DOFFIN_CRON_TOKEN || t !== DOFFIN_CRON_TOKEN) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!isEmailConfigured()) {
      res.json({ ok: false, error: "email_not_configured" });
      return;
    }
    try {
      await ensureSchema(pool);
      const watches = await pool.query<{
        organization_id: string; name: string; query: Record<string, unknown>;
      }>(
        `SELECT organization_id, name, query FROM leadgrid_doffin_watches
          ORDER BY organization_id, created_at ASC LIMIT 500`);
      const perOrg = new Map<string, { name: string; query: Record<string, unknown> }[]>();
      for (const w of watches.rows) {
        (perOrg.get(w.organization_id) ?? perOrg.set(w.organization_id, []).get(w.organization_id)!)
          .push({ name: w.name, query: w.query });
      }
      const enUkeSiden = Date.now() - 7 * 86_400_000;
      let sendt = 0, hoppet = 0;
      for (const [orgId, orgWatches] of perOrg) {
        try {
          // Mottakere: org-ens ledere med e-post.
          const ledere = await pool.query<{ email: string }>(
            `SELECT DISTINCT u.email
               FROM organization_members om
               JOIN users u ON u.id = om.user_id
              WHERE om.organization_id = $1::uuid
                AND om.role IN ('admin','salgssjef','teamleder')
                AND u.email IS NOT NULL AND u.email <> ''`, [orgId]);
          if (ledere.rowCount === 0) { hoppet++; continue; }
          // Ferske treff per overvåkning (maks 3 watches × 5 treff).
          type DigestTreff = { tittel: string; oppdragsgiver: string; frist: string | null; url: string; kunde: boolean };
          const seksjoner: { watch: string; treff: DigestTreff[] }[] = [];
          for (const w of orgWatches.slice(0, 3)) {
            const q = new URLSearchParams();
            q.set("numHitsPerPage", "20");
            q.set("status", "ACTIVE");
            const text = String(w.query.q ?? "").trim();
            if (text) q.set("searchString", text.slice(0, 200));
            const location = String(w.query.location ?? "").trim();
            if (location && /^[A-Z0-9,]{2,60}$/i.test(location)) {
              for (const l of location.split(",")) q.append("location", l.trim());
            }
            const cpv = String(w.query.cpv ?? "").trim();
            if (cpv && /^[0-9,]{2,120}$/.test(cpv)) {
              for (const c of cpv.split(",")) q.append("cpvCode", c.trim());
            }
            const r = await doffinSearch(q);
            if (!r.ok) continue;
            const hits = ((r.body as { kunngjoringer?: Record<string, unknown>[] }).kunngjoringer ?? [])
              .filter((h) => {
                const pub = h.kunngjort ? Date.parse(String(h.kunngjort)) : NaN;
                return Number.isFinite(pub) && pub >= enUkeSiden;
              })
              .slice(0, 5);
            if (hits.length === 0) continue;
            const orgnrs = hits.flatMap((h) =>
              ((h.oppdragsgivere as { orgnr?: string }[] | undefined) ?? [])
                .map((o) => String(o.orgnr ?? "")));
            const matches = await matchKunder(pool, orgId, orgnrs);
            seksjoner.push({
              watch: w.name,
              treff: hits.map((h) => ({
                tittel: String(h.tittel ?? ""),
                oppdragsgiver: String(((h.oppdragsgivere as { navn?: string }[] | undefined) ?? [])[0]?.navn ?? ""),
                frist: (h.frist as string | null) ?? null,
                url: String(h.url ?? ""),
                kunde: ((h.oppdragsgivere as { orgnr?: string }[] | undefined) ?? [])
                  .some((o) => matches.has(String(o.orgnr ?? ""))),
              })),
            });
          }
          // Pipeline-frister neste 14 dager.
          const frister = await pool.query<{ tittel: string; frist: string; status: string }>(
            `SELECT tittel, frist::text, status FROM leadgrid_anbud_pipeline
              WHERE organization_id = $1 AND status IN ('vurderer','gaar_for','tilbud_levert')
                AND frist IS NOT NULL AND frist > now() AND frist < now() + INTERVAL '14 days'
              ORDER BY frist ASC LIMIT 10`, [orgId]);
          if (seksjoner.length === 0 && frister.rowCount === 0) { hoppet++; continue; }
          // Enkel, ærlig HTML — tabell-basert (ingen bilder, ingen sporing).
          const fmt = (iso: string | null) => {
            if (!iso) return "";
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? "" :
              d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
          };
          const html = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e">
  <h2 style="color:#5b21b6">Ukens anbud — Leadgrid</h2>
  ${seksjoner.map((s) => `
  <h3 style="margin-bottom:4px">${s.watch}</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${s.treff.map((tr) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:8px 4px">
        ${tr.kunde ? '<span style="color:#059669;font-weight:700">⚡ KUNDE</span> ' : ""}
        <a href="${tr.url}" style="color:#4f46e5;text-decoration:none">${tr.tittel}</a><br>
        <span style="color:#666">${tr.oppdragsgiver}</span>
      </td>
      <td style="padding:8px 4px;white-space:nowrap;color:#b45309">${tr.frist ? "Frist " + fmt(tr.frist) : ""}</td>
    </tr>`).join("")}
  </table>`).join("")}
  ${frister.rowCount ? `
  <h3 style="margin-bottom:4px">Dine anbudsfrister neste 14 dager</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${frister.rows.map((f) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:8px 4px">${f.tittel}</td>
      <td style="padding:8px 4px;white-space:nowrap;color:#b45309">${fmt(f.frist)}</td>
    </tr>`).join("")}
  </table>` : ""}
  <p style="color:#999;font-size:12px;margin-top:24px">Sendt av Leadgrid Anbud — administrer overvåkninger i appen.</p>
</div>`;
          for (const mottaker of ledere.rows) {
            await sendEmail({
              to: mottaker.email,
              subject: "Ukens anbud — nye treff og frister",
              html,
              fromName: "Leadgrid Anbud",
            });
          }
          sendt++;
        } catch (orgErr) {
          console.warn("[doffin] digest for org feilet:", orgId, String(orgErr).slice(0, 120));
        }
      }
      res.json({ ok: true, orger: perOrg.size, sendt, hoppet });
    } catch (e) {
      console.error("[doffin] ukesdigest failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Cron: sjekk alle overvåkninger for nye treff → varsle oppretteren
   *  (in-app notification_events + APNs push). Trigges av ekstern cron med
   *  x-cron-trigger-token (samme token som øvrige leadgrid-crons).
   *  Første kjøring per watch SEEDER seen_ids uten å varsle (ellers ville
   *  hver ny overvåkning spamme med hele det eksisterende resultatsettet). */
  app.post("/api/leadgrid/doffin/cron/check-watches", async (req, res) => {
    const t = req.headers["x-cron-trigger-token"] as string | undefined;
    if (!t || !DOFFIN_CRON_TOKEN || t !== DOFFIN_CRON_TOKEN) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      await ensureSchema(pool);
      const watches = await pool.query<{
        id: string; organization_id: string; name: string;
        query: Record<string, unknown>; created_by: string; seen_ids: string[];
      }>(
        `SELECT id, organization_id, name, query, created_by, seen_ids
           FROM leadgrid_doffin_watches ORDER BY created_at ASC LIMIT 200`);
      let checked = 0, notified = 0, seeded = 0, failed = 0;
      for (const w of watches.rows) {
        try {
          const q = new URLSearchParams();
          q.set("numHitsPerPage", "20");
          q.set("status", "ACTIVE");
          const text = String((w.query as Record<string, unknown>).q ?? "").trim();
          if (text) q.set("searchString", text.slice(0, 200));
          const location = String((w.query as Record<string, unknown>).location ?? "").trim();
          if (location && /^[A-Z0-9,]{2,60}$/i.test(location)) {
            for (const l of location.split(",")) q.append("location", l.trim());
          }
          const cpv = String((w.query as Record<string, unknown>).cpv ?? "").trim();
          if (cpv && /^[0-9,]{2,120}$/.test(cpv)) {
            for (const c of cpv.split(",")) q.append("cpvCode", c.trim());
          }
          const r = await doffinSearch(q);
          if (!r.ok) { failed++; continue; }
          checked++;
          const hits = (r.body as { kunngjoringer?: Record<string, unknown>[] }).kunngjoringer ?? [];
          const seen = new Set(Array.isArray(w.seen_ids) ? w.seen_ids : []);
          const fresh = hits.filter((h) => h.id && !seen.has(String(h.id)));
          const isFirstRun = seen.size === 0;
          // Oppdater seen_ids (nyeste først, cap 300 så raden ikke vokser evig).
          const nextSeen = [
            ...fresh.map((h) => String(h.id)),
            ...[...seen],
          ].slice(0, 300);
          await pool.query(
            `UPDATE leadgrid_doffin_watches
                SET seen_ids = $2::jsonb, last_checked_at = now(), updated_at = now(),
                    new_hits_count = CASE WHEN $3::boolean THEN new_hits_count ELSE new_hits_count + $4::int END
              WHERE id = $1`,
            [w.id, JSON.stringify(nextSeen), isFirstRun, fresh.length]);
          if (isFirstRun) { seeded++; continue; }
          if (fresh.length === 0) continue;
          // Kunde-match i varselet (nivå 1): en eksisterende kunde som
          // lyser ut er det sterkeste signalet vi kan gi.
          const freshOrgnrs = fresh.flatMap((h) =>
            ((h.oppdragsgivere as { orgnr?: string }[] | undefined) ?? [])
              .map((o) => String(o.orgnr ?? "")));
          const kundeMatches = await matchKunder(pool, w.organization_id, freshOrgnrs);
          // Varsle oppretteren: in-app + push (best effort).
          const first = fresh[0];
          const harKunde = kundeMatches.size > 0;
          const title = harKunde
            ? `⚡ Eksisterende kunde lyser ut: ${w.name}`
            : `Nye anbud: ${w.name}`;
          const body = fresh.length === 1
            ? String(first.tittel ?? "1 ny kunngjøring")
            : `${String(first.tittel ?? "Ny kunngjøring")} +${fresh.length - 1} til`;
          const deepLink = "leadgrid://anbud";
          await pool.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, event_type, title, body,
                triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, 'doffin_watch_hit', $3, $4, NULL, $5, $6::jsonb, FALSE)`,
            [w.created_by, w.organization_id, title, body, deepLink,
             JSON.stringify({ watch_id: w.id, new_ids: fresh.map((h) => String(h.id)).slice(0, 20) })]);
          notified++;
          try {
            const tokRes = await pool.query<{ token: string }>(
              `SELECT token FROM notification_device_tokens
                WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`,
              [w.created_by]);
            for (const tok of tokRes.rows) {
              const pr = await sendAPNs(tok.token, title, body, {
                customData: { event_type: "doffin_watch_hit", deep_link: deepLink },
              });
              if (pr.sent) break;
              if (pr.shouldDisableToken) {
                await pool.query(
                  `UPDATE notification_device_tokens SET enabled = FALSE
                    WHERE token = $1 AND user_id = $2`,
                  [tok.token, w.created_by]).catch(() => {});
              }
            }
          } catch (pushErr) {
            console.warn("[doffin] push feilet:", String(pushErr).slice(0, 120));
          }
        } catch (watchErr) {
          failed++;
          console.warn("[doffin] watch-sjekk feilet:", w.id, String(watchErr).slice(0, 120));
        }
      }
      // Frist-motor (nivå 2): varsle tildelt (ellers oppretter) når åpne
      // pipeline-anbud har frist om ≤7 dager og ≤1 dag. Én gang per nivå
      // (varslet_7d/varslet_1d-flagg).
      let fristVarsler = 0;
      try {
        const due = await pool.query<{
          id: string; organization_id: string; tittel: string; frist: string;
          assigned_user_id: string | null; created_by: string;
          varslet_7d: boolean; varslet_1d: boolean;
        }>(
          `SELECT id, organization_id, tittel, frist, assigned_user_id,
                  created_by, varslet_7d, varslet_1d
             FROM leadgrid_anbud_pipeline
            WHERE status IN ('vurderer','gaar_for')
              AND frist IS NOT NULL
              AND frist > now()
              AND frist < now() + INTERVAL '7 days'
            LIMIT 100`);
        for (const p of due.rows) {
          const dagerIgjen = Math.ceil(
            (new Date(p.frist).getTime() - Date.now()) / 86_400_000);
          const nivaa1d = dagerIgjen <= 1 && !p.varslet_1d;
          const nivaa7d = dagerIgjen > 1 && !p.varslet_7d;
          if (!nivaa1d && !nivaa7d) continue;
          const mottaker = p.assigned_user_id ?? p.created_by;
          if (!mottaker) continue;
          const title = nivaa1d
            ? `⏰ Anbudsfrist I MORGEN: ${p.tittel.slice(0, 80)}`
            : `Anbudsfrist om ${dagerIgjen} dager`;
          await pool.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, event_type, title, body,
                triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, 'doffin_frist', $3, $4, NULL, 'leadgrid://anbud', $5::jsonb, FALSE)`,
            [mottaker, p.organization_id, title, p.tittel,
             JSON.stringify({ pipeline_id: p.id, dager_igjen: dagerIgjen })]);
          await pool.query(
            `UPDATE leadgrid_anbud_pipeline
                SET ${nivaa1d ? "varslet_1d = TRUE, varslet_7d = TRUE" : "varslet_7d = TRUE"},
                    updated_at = now()
              WHERE id = $1`, [p.id]);
          fristVarsler++;
          try {
            const tok = await pool.query<{ token: string }>(
              `SELECT token FROM notification_device_tokens
                WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`, [mottaker]);
            for (const t of tok.rows) {
              const pr = await sendAPNs(t.token, title, p.tittel, {
                customData: { event_type: "doffin_frist", deep_link: "leadgrid://anbud" },
              });
              if (pr.sent) break;
            }
          } catch { /* push best effort */ }
        }
      } catch (fristErr) {
        console.warn("[doffin] frist-motor feilet:", String(fristErr).slice(0, 120));
      }
      res.json({ ok: true, watches: watches.rowCount, checked, notified, seeded, failed,
                 frist_varsler: fristVarsler });
    } catch (e) {
      console.error("[doffin] cron check failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Slett overvåkning (kun egen org). */
  app.delete("/api/leadgrid/doffin/watches/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_ANBUD_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const r = await pool.query(
        `DELETE FROM leadgrid_doffin_watches WHERE id = $1 AND organization_id = $2`,
        [String(req.params.id), orgId]);
      res.json({ ok: true, deleted: r.rowCount ?? 0 });
    } catch (e) {
      console.error("[doffin] delete watch failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
