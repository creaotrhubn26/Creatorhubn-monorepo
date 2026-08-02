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
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled, LEADGRID_ANBUD_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { sendAPNs } from "./lead-map-apns-client.js";

// Cron-trigger for overvåknings-sjekk (samme token-mønster som AI-billing).
const DOFFIN_CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";

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
      ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ`);
  schemaReady = true;
}

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
  };
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
  requireUserSession: (req: Request, res: Response) => Promise<{ userId: string } | null>;
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
      res.status(r.status).json(r.body);
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
        `SELECT id, name, query, created_at FROM leadgrid_doffin_watches
          WHERE organization_id = $1 ORDER BY created_at DESC`, [orgId]);
      res.json({ watches: r.rows });
    } catch (e) {
      console.error("[doffin] watches failed:", e);
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
                SET seen_ids = $2::jsonb, last_checked_at = now(), updated_at = now()
              WHERE id = $1`,
            [w.id, JSON.stringify(nextSeen)]);
          if (isFirstRun) { seeded++; continue; }
          if (fresh.length === 0) continue;
          // Varsle oppretteren: in-app + push (best effort).
          const first = fresh[0];
          const title = `Nye anbud: ${w.name}`;
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
      res.json({ ok: true, watches: watches.rowCount, checked, notified, seeded, failed });
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
