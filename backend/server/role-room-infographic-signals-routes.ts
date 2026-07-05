/**
 * Infographic AI-signaler — KOLLEKTIV læring for Infographic Studios mal-velger.
 * Klienten pusher aksept/avvisning-signaler (anonymisert: mal-id + likt + vekt +
 * hash av beskrivelsen — ALDRI rå tekst), og henter AGGREGERTE signaler på tvers
 * av alle brukere for å trene sin lokale re-rangerer. Inkrementelt via `since`-
 * cursor, så bare det NYE hentes/pushes — grunnlaget for en modell som
 * forbedres kontinuerlig av alle brukere.
 *
 * Endepunkter (auth: RR_BEARER_TOKEN):
 *   POST /api/role-room/infographic-signals            (push nye signaler)
 *   GET  /api/role-room/infographic-signals/collective?since=<iso>
 *        → [{ tplId, net, n }] aggregert på tvers av ALLE brukere (anonymt)
 *
 * Tabell opprettes on-demand (ingen egen migrasjon).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import express from "express";
import { randomBytes } from "node:crypto";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData> }

function getUserId(req: Request, sessions: Map<string, SessionData>): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.slice(7).trim())?.userId ?? null;
  return null;
}

const MAX_BATCH = 200;

export function registerRoleRoomInfographicSignalsRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;
  let ready = false;
  void pool
    .query(
      `CREATE TABLE IF NOT EXISTS infographic_ai_signals (
         id          TEXT PRIMARY KEY,
         created_by  TEXT NOT NULL,
         tpl_id      TEXT NOT NULL,
         liked       BOOLEAN NOT NULL,
         weight      REAL NOT NULL DEFAULT 1,
         desc_hash   TEXT,
         created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )
    .then(() => pool.query(`CREATE INDEX IF NOT EXISTS idx_ig_signals_created_at ON infographic_ai_signals (created_at)`))
    .then(() => { ready = true; })
    .catch((e: Error) => console.warn("[ig-signals] tabell-feil:", e.message));

  // Push nye signaler (anonymisert). Klienten sender kun de som er nyere enn
  // sin lokale push-cursor → inkrementelt.
  app.post("/api/role-room/infographic-signals", express.json({ limit: "256kb" }), async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    if (!ready) { res.status(503).json({ error: "ikke_klar" }); return; }
    const signals = Array.isArray(req.body?.signals) ? req.body.signals.slice(0, MAX_BATCH) : [];
    if (!signals.length) { res.json({ ok: true, inserted: 0 }); return; }
    try {
      let inserted = 0;
      for (const s of signals) {
        const tplId = String(s?.tplId ?? "").slice(0, 120);
        if (!tplId) continue;
        const liked = !!s?.liked;
        const weight = Math.max(0, Math.min(1, Number(s?.weight) || 1));
        const descHash = s?.descHash ? String(s.descHash).slice(0, 64) : null;
        // Idempotens: klienten sender en stabil sigId per signal. Ved nettverks-
        // retry (POST kom fram, men svaret gikk tapt → køen tømmes ikke → re-push)
        // hindrer ON CONFLICT DO NOTHING at samme signal dobbelt-telles i aggregatet.
        const sigId = s?.sigId && /^[\w-]{1,64}$/.test(String(s.sigId)) ? String(s.sigId) : `s_${randomBytes(8).toString("hex")}`;
        const r = await pool.query(
          `INSERT INTO infographic_ai_signals (id, created_by, tpl_id, liked, weight, desc_hash) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id) DO NOTHING`,
          [sigId, uid, tplId, liked, weight, descHash],
        );
        inserted += r.rowCount ?? 0;
      }
      res.json({ ok: true, inserted });
    } catch (e) {
      res.status(500).json({ error: "lagre_feil", detail: (e as Error).message });
    }
  });

  // Aggregerte signaler på tvers av ALLE brukere siden `since` (anonymt: kun
  // mal-id + netto-vekt + antall). Ingen tekst, ingen identitet → trygt kollektivt.
  app.get("/api/role-room/infographic-signals/collective", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    // Tabellen ikke klar ennå: returnér IKKE en fersk `now`-cursor — klienten
    // ville lagret den og dermed hoppet over ALL historikk før tabellen kom opp.
    // `now: null` → klienten beholder sin gamle cursor (henter alt neste gang).
    if (!ready) { res.json({ signals: [], now: null }); return; }
    const since = String(req.query.since ?? "").trim();
    // Valider `since` FØR den sendes rått som timestamp-parameter — ellers kaster
    // Postgres på en uparsbar verdi og klienten får 500 i stedet for 400.
    if (since && Number.isNaN(Date.parse(since))) { res.status(400).json({ error: "ugyldig_since" }); return; }
    try {
      // Cursor MÅ komme fra SAMME snapshot som aggregatet. En egen MAX-spørring
      // ville kjørt på et senere snapshot → en rad som commit-er MELLOM de to
      // spørringene teller ikke i SUM, men løfter MAX → cursor avanserer forbi
      // raden → den telles ALDRI. `MAX(MAX(created_at)) OVER ()` gir global maks
      // created_at i ÉN spørring: indre MAX = per-gruppe (etter GROUP BY), ytre
      // MAX() OVER () = over gruppene. Cursor kan da aldri overstige det vi summerte.
      const { rows } = await pool.query(
        `SELECT tpl_id,
                SUM(CASE WHEN liked THEN weight ELSE -weight END)::float AS net,
                COUNT(*)::int AS n,
                MAX(MAX(created_at)) OVER () AS cursor
           FROM infographic_ai_signals
          ${since ? "WHERE created_at > $1" : ""}
          GROUP BY tpl_id
          ORDER BY n DESC LIMIT 1000`,
        since ? [since] : [],
      );
      // Ingen nye rader → behold klientens gamle cursor (`since`), ikke advancér.
      // (Merk: created_at settes ved INSERT-tid; en rad som commit-er ut av
      // created_at-rekkefølge KAN i sjeldne tilfeller havne ≤ cursor og hoppes
      // over — iboende i tidsstempel-cursors uten sekvens; signalene er lav-
      // frekvente enkelt-inserts så vinduet er svært smalt.)
      const cursor = rows[0]?.cursor ? new Date(rows[0].cursor).toISOString() : (since || null);
      res.json({ signals: rows.map((r) => ({ tplId: r.tpl_id, net: r.net, n: r.n })), now: cursor });
    } catch (e) {
      res.status(500).json({ error: "hent_feil", detail: (e as Error).message });
    }
  });

  // Innsikt: aggregert bevis på at modellen faktisk lærer i drift — totaler +
  // topp-maler på tvers av ALLE brukere (anonymt). Driver «Innsikt»-flaten i
  // studioet så læringen er synlig, ikke en black box.
  app.get("/api/role-room/infographic-signals/insight", async (req: Request, res: Response) => {
    const uid = getUserId(req, activeSessions);
    if (!uid) { res.status(401).json({ error: "krever_innlogging" }); return; }
    const now = new Date().toISOString();
    if (!ready) { res.json({ total: 0, contributors: 0, templates: 0, liked: 0, disliked: 0, top: [], now }); return; }
    try {
      const { rows: t } = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(DISTINCT created_by)::int AS contributors,
                COUNT(DISTINCT tpl_id)::int AS templates,
                SUM(CASE WHEN liked THEN 1 ELSE 0 END)::int AS liked,
                SUM(CASE WHEN NOT liked THEN 1 ELSE 0 END)::int AS disliked
           FROM infographic_ai_signals`,
      );
      const { rows: top } = await pool.query(
        `SELECT tpl_id,
                SUM(CASE WHEN liked THEN weight ELSE -weight END)::float AS net,
                COUNT(*)::int AS n
           FROM infographic_ai_signals
          GROUP BY tpl_id
          ORDER BY n DESC LIMIT 12`,
      );
      const s = t[0] || {};
      res.json({
        total: s.total || 0, contributors: s.contributors || 0, templates: s.templates || 0,
        liked: s.liked || 0, disliked: s.disliked || 0,
        top: top.map((r) => ({ tplId: r.tpl_id, net: r.net, n: r.n })), now,
      });
    } catch (e) {
      res.status(500).json({ error: "innsikt_feil", detail: (e as Error).message });
    }
  });
}
