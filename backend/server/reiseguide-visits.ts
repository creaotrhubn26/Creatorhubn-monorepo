/**
 * SenseAid Explore: personlig besøkslogg på serveren, med GDPR som premiss
 * (Daniel 18.09.2026: «ja vil ha loggen på serveren … samtidig er det viktig
 * med GDPR»). Datamodell: migrations/0632_reiseguide_visits.sql.
 *
 * Prinsipper:
 *   * Ingen konto. Enheten identifiseres av appens anonyme, tilfeldige ID, som
 *     sendes i headeren X-SenseAid-Device (ikke i URL-en, så den havner ikke i
 *     Renders tilgangslogger). ID-en er i praksis en hemmelig nøkkel: den som
 *     har den, kan lese og slette loggen til enheten.
 *   * Dataminimering: kun sted-id, tidspunkter, stjerner og quiz-resultat.
 *     Ingen posisjon, ingen IP, ingen fritekst.
 *   * Samtykke: appen synker bare når brukeren har slått det på.
 *   * Innsyn og portabilitet: GET /api/guide/device/data (alt om enheten, JSON).
 *   * Sletting: DELETE /api/guide/device/visits/:id (ett besøk),
 *     DELETE /api/guide/device/visits (hele loggen),
 *     DELETE /api/guide/device/data (alt, også vurderinger).
 *   * Lagringsbegrensning: purge av rader eldre enn SENSEAID_VISIT_RETENTION_DAYS
 *     (standard 365) kjøres opportunistisk ved synk, maks én gang i timen per prosess.
 *
 * Ren logikk (parsing, visning, retention) ligger øverst og enhetstestes uten
 * Express; rutene registreres av registerReiseguideVisitRoutes, som
 * registerReiseguideRoutes kaller.
 */
import express, { type Express, type Request, type Response } from "express";
import type { Pool } from "pg";

import { DEVICE_ID_RE, createRateLimiter } from "./reiseguide-after-visit.js";

export const DEVICE_HEADER = "x-senseaid-device";
export const VISIT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const POI_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;
export const VISIT_SYNC_MAX = 200;
export const VISIT_LIST_MAX = 500;
export const DEFAULT_VISIT_RETENTION_DAYS = 365;
export const VISIT_PURGE_INTERVAL_MS = 60 * 60 * 1000;
export const DEVICE_LIMIT_PER_MINUTE = 60;
/** Tidspunkt lenger fram enn dette avvises (klokka på telefonen kan gå litt feil). */
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const MIN_VISIT_TIME = Date.parse("2020-01-01T00:00:00Z");

/** Formålstekst som følger innsynssvaret, så brukeren ser hvorfor vi lagrer. */
export const VISIT_PURPOSE = {
  nb: "Personlig logg over steder du har besøkt i SenseAid Explore, med tid, stjerner og quiz-resultat. Lagres bare når du har slått på «Lagre loggen på serveren», uten navn, konto eller posisjon, og slettes automatisk etter oppbevaringstiden eller når du sletter dataene dine.",
  en: "Personal log of places you have visited in SenseAid Explore, with time, stars and quiz score. Stored only when you have turned on “Keep my log on the server”, without name, account or location, and deleted automatically after the retention period or when you delete your data.",
} as const;

export interface VisitInput {
  id: string;
  poiId: string;
  startedAt: Date;
  completedAt: Date | null;
  stars: number | null;
  quizCorrect: number | null;
  quizTotal: number | null;
}

export interface VisitRow {
  id: string;
  device_id: string;
  poi_id: string;
  poi_slug: string | null;
  started_at: Date | string;
  completed_at: Date | string | null;
  stars: number | null;
  quiz_correct: number | null;
  quiz_total: number | null;
  updated_at: Date | string;
}

export interface VisitView {
  id: string;
  poiId: string;
  poiSlug: string | null;
  startedAt: string;
  completedAt: string | null;
  stars: number | null;
  quizCorrect: number | null;
  quizTotal: number | null;
  updatedAt: string;
}

export interface DeviceRatingRow {
  poi_id: string;
  stars: number;
  lang: string | null;
  comment: string | null;
  updated_at: Date | string;
}

export type VisitSyncParseResult =
  | { ok: true; value: VisitInput[] }
  | { ok: false; error: string; message: string };

/** Enhets-ID fra headeren; null hvis den mangler eller er ugyldig. */
export function readDeviceId(headerValue: unknown): string | null {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DEVICE_ID_RE.test(trimmed) ? trimmed : null;
}

function parseTime(value: unknown, now: number): Date | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms < MIN_VISIT_TIME || ms > now + MAX_FUTURE_SKEW_MS) return undefined;
  return new Date(ms);
}

function parseSmallInt(value: unknown, min: number, max: number): number | null | undefined {
  if (value == null) return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}

/**
 * Validerer PUT-kroppen `{ visits: [...] }`. Feltnavnene er de samme som
 * VisitEntry i appen (Core/VisitLog.swift); title sendes ikke (den finnes i
 * guide_poi_translations, og vi lagrer ikke mer enn vi må).
 */
export function parseVisitSync(body: unknown, now: number = Date.now()): VisitSyncParseResult {
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).visits)) {
    return { ok: false, error: "invalid_body", message: "Kroppen må være { visits: [...] }." };
  }
  const raw = (body as { visits: unknown[] }).visits;
  if (raw.length > VISIT_SYNC_MAX) {
    return { ok: false, error: "too_many_visits", message: `Maks ${VISIT_SYNC_MAX} besøk per synk.` };
  }
  const visits: VisitInput[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const at = `visits[${index}]`;
    if (!item || typeof item !== "object") {
      return { ok: false, error: "invalid_visit", message: `${at} må være et objekt.` };
    }
    const v = item as Record<string, unknown>;
    if (typeof v.id !== "string" || !VISIT_ID_RE.test(v.id)) {
      return { ok: false, error: "invalid_visit", message: `${at}.id må være 8–64 tegn [A-Za-z0-9_-].` };
    }
    if (seen.has(v.id)) {
      return { ok: false, error: "invalid_visit", message: `${at}.id er sendt flere ganger.` };
    }
    seen.add(v.id);
    if (typeof v.poiId !== "string" || !POI_ID_RE.test(v.poiId)) {
      return { ok: false, error: "invalid_visit", message: `${at}.poiId mangler eller er ugyldig.` };
    }
    const startedAt = parseTime(v.startedAt, now);
    if (!startedAt) {
      return { ok: false, error: "invalid_visit", message: `${at}.startedAt må være et gyldig ISO 8601-tidspunkt.` };
    }
    const completedAt = parseTime(v.completedAt, now);
    if (completedAt === undefined || (completedAt && completedAt < startedAt)) {
      return { ok: false, error: "invalid_visit", message: `${at}.completedAt må være tom eller etter startedAt.` };
    }
    const stars = parseSmallInt(v.stars, 1, 5);
    if (stars === undefined) {
      return { ok: false, error: "invalid_visit", message: `${at}.stars må være tom eller 1–5.` };
    }
    const quizCorrect = parseSmallInt(v.quizCorrect, 0, 100);
    const quizTotal = parseSmallInt(v.quizTotal, 0, 100);
    if (
      quizCorrect === undefined ||
      quizTotal === undefined ||
      (quizCorrect === null) !== (quizTotal === null) ||
      (quizCorrect != null && quizTotal != null && quizCorrect > quizTotal)
    ) {
      return { ok: false, error: "invalid_visit", message: `${at}.quizCorrect/quizTotal må komme sammen, 0 ≤ riktige ≤ totalt.` };
    }
    visits.push({ id: v.id, poiId: v.poiId, startedAt, completedAt, stars, quizCorrect, quizTotal });
  }
  return { ok: true, value: visits };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function visitView(row: VisitRow): VisitView {
  return {
    id: row.id,
    poiId: row.poi_id,
    poiSlug: row.poi_slug ?? null,
    startedAt: iso(row.started_at),
    completedAt: row.completed_at == null ? null : iso(row.completed_at),
    stars: row.stars == null ? null : Number(row.stars),
    quizCorrect: row.quiz_correct == null ? null : Number(row.quiz_correct),
    quizTotal: row.quiz_total == null ? null : Number(row.quiz_total),
    updatedAt: iso(row.updated_at),
  };
}

/** SENSEAID_VISIT_RETENTION_DAYS: heltall 1–3650, ellers standard 365. */
export function retentionDaysFrom(value: string | undefined | null): number {
  if (value == null || value.trim() === "") return DEFAULT_VISIT_RETENTION_DAYS;
  const n = Number(value.trim());
  if (!Number.isInteger(n) || n < 1 || n > 3650) return DEFAULT_VISIT_RETENTION_DAYS;
  return n;
}

/**
 * «Skal vi kjøre nå?»-port: sant første gang og deretter høyst én gang per
 * intervall. Brukes så purge ikke kjører på hver synk.
 */
export function createIntervalGate(intervalMs: number, now: () => number = Date.now): () => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const t = now();
    if (t - last < intervalMs) return false;
    last = t;
    return true;
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────

export const VISIT_LIST_SELECT = `
  SELECT v.id, v.device_id, v.poi_id, p.slug AS poi_slug, v.started_at, v.completed_at,
         v.stars, v.quiz_correct, v.quiz_total, v.updated_at
    FROM guide_poi_visits v
    LEFT JOIN guide_pois p ON p.id = v.poi_id
   WHERE v.device_id = $1
   ORDER BY v.started_at DESC
   LIMIT ${VISIT_LIST_MAX}`;

/**
 * Upsert av en hel batch i én spørring. Ved konflikt beholdes det som
 * allerede er satt hvis appen sender tomt (COALESCE), så en eldre telefon
 * uten quiz-resultat ikke nuller ut et resultat som er lagret.
 */
export const VISIT_UPSERT = `
  INSERT INTO guide_poi_visits (device_id, id, poi_id, started_at, completed_at, stars, quiz_correct, quiz_total)
  SELECT $1, u.id, u.poi_id, u.started_at, u.completed_at, u.stars, u.quiz_correct, u.quiz_total
    FROM unnest(
      $2::text[], $3::text[], $4::timestamptz[], $5::timestamptz[], $6::smallint[], $7::smallint[], $8::smallint[]
    ) AS u(id, poi_id, started_at, completed_at, stars, quiz_correct, quiz_total)
   WHERE EXISTS (SELECT 1 FROM guide_pois p WHERE p.id = u.poi_id)
  ON CONFLICT (device_id, id) DO UPDATE SET
    poi_id = EXCLUDED.poi_id,
    started_at = EXCLUDED.started_at,
    completed_at = COALESCE(EXCLUDED.completed_at, guide_poi_visits.completed_at),
    stars = COALESCE(EXCLUDED.stars, guide_poi_visits.stars),
    quiz_correct = COALESCE(EXCLUDED.quiz_correct, guide_poi_visits.quiz_correct),
    quiz_total = COALESCE(EXCLUDED.quiz_total, guide_poi_visits.quiz_total),
    updated_at = now()
  RETURNING id`;

export const VISIT_PURGE = `DELETE FROM guide_poi_visits WHERE started_at < now() - ($1::int * interval '1 day')`;

export const DEVICE_RATINGS_SELECT = `
  SELECT poi_id, stars, lang, comment, updated_at
    FROM guide_poi_ratings
   WHERE device_id = $1
   ORDER BY updated_at DESC`;

// ── Ruter ────────────────────────────────────────────────────────────────

export interface VisitRouteDeps {
  pool: Pick<Pool, "query">;
  /** Dager loggen beholdes; standard fra SENSEAID_VISIT_RETENTION_DAYS. */
  retentionDays?: number;
  now?: () => number;
}

export function registerReiseguideVisitRoutes(app: Express, deps: VisitRouteDeps): void {
  const { pool } = deps;
  const now = deps.now ?? Date.now;
  const retentionDays = deps.retentionDays ?? retentionDaysFrom(process.env.SENSEAID_VISIT_RETENTION_DAYS);
  const limited = createRateLimiter(DEVICE_LIMIT_PER_MINUTE, 60_000, now);
  const shouldPurge = createIntervalGate(VISIT_PURGE_INTERVAL_MS, now);

  const clientIp = (req: Request): string =>
    req.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";

  const guard = (req: Request, res: Response): string | null => {
    res.setHeader("Cache-Control", "private, no-store");
    const deviceId = readDeviceId(req.headers[DEVICE_HEADER]);
    if (!deviceId) {
      res.status(400).json({
        error: "missing_device_id",
        message: `Headeren X-SenseAid-Device må være 8–64 tegn [A-Za-z0-9_-].`,
      });
      return null;
    }
    if (limited(`guide-device:${clientIp(req)}`)) {
      res.status(429).json({ error: "rate_limited" });
      return null;
    }
    return deviceId;
  };

  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (err) {
        console.error("[reiseguide] visit route error", err);
        if (!res.headersSent) res.status(500).json({ error: "internal_error" });
      }
    };

  const listVisits = async (deviceId: string): Promise<VisitView[]> => {
    const { rows } = await pool.query<VisitRow>(VISIT_LIST_SELECT, [deviceId]);
    return rows.map(visitView);
  };

  const purgeIfDue = async (): Promise<void> => {
    if (!shouldPurge()) return;
    try {
      await pool.query(VISIT_PURGE, [retentionDays]);
    } catch (err) {
      console.error("[reiseguide] visit purge failed", err);
    }
  };

  // Innsyn og dataportabilitet (art. 15 og 20): alt vi har om enheten.
  app.get(
    "/api/guide/device/data",
    wrap(async (req, res) => {
      const deviceId = guard(req, res);
      if (!deviceId) return;
      const [visits, ratings] = await Promise.all([
        listVisits(deviceId),
        pool.query<DeviceRatingRow>(DEVICE_RATINGS_SELECT, [deviceId]),
      ]);
      res.json({
        deviceId,
        purpose: VISIT_PURPOSE,
        retentionDays,
        exportedAt: new Date(now()).toISOString(),
        visits,
        ratings: ratings.rows.map((r) => ({
          poiId: r.poi_id,
          stars: Number(r.stars),
          lang: r.lang,
          comment: r.comment,
          updatedAt: iso(r.updated_at),
        })),
      });
    }),
  );

  // Synk fra appen: upsert per (enhet, besøk). Ukjente steder hoppes over.
  app.put(
    "/api/guide/device/visits",
    express.json({ limit: "256kb" }),
    wrap(async (req, res) => {
      const deviceId = guard(req, res);
      if (!deviceId) return;
      const parsed = parseVisitSync(req.body, now());
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error, message: parsed.message });
        return;
      }
      const input = parsed.value;
      let savedIds: string[] = [];
      if (input.length > 0) {
        const { rows } = await pool.query<{ id: string }>(VISIT_UPSERT, [
          deviceId,
          input.map((v) => v.id),
          input.map((v) => v.poiId),
          input.map((v) => v.startedAt),
          input.map((v) => v.completedAt),
          input.map((v) => v.stars),
          input.map((v) => v.quizCorrect),
          input.map((v) => v.quizTotal),
        ]);
        savedIds = rows.map((r) => r.id);
      }
      const savedSet = new Set(savedIds);
      const skipped = input.filter((v) => !savedSet.has(v.id)).map((v) => v.id);
      await purgeIfDue();
      res.json({ deviceId, saved: savedIds.length, skipped, retentionDays, visits: await listVisits(deviceId) });
    }),
  );

  app.get(
    "/api/guide/device/visits",
    wrap(async (req, res) => {
      const deviceId = guard(req, res);
      if (!deviceId) return;
      res.json({ deviceId, retentionDays, visits: await listVisits(deviceId) });
    }),
  );

  app.delete(
    "/api/guide/device/visits/:visitId",
    wrap(async (req, res) => {
      const deviceId = guard(req, res);
      if (!deviceId) return;
      const visitId = String(req.params.visitId ?? "");
      if (!VISIT_ID_RE.test(visitId)) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }
      const { rowCount } = await pool.query(`DELETE FROM guide_poi_visits WHERE device_id = $1 AND id = $2`, [
        deviceId,
        visitId,
      ]);
      res.json({ deviceId, deleted: { visits: rowCount ?? 0 } });
    }),
  );

  // Hele loggen (brukeren slår av «Lagre loggen på serveren»).
  app.delete(
    "/api/guide/device/visits",
    wrap(async (req, res) => {
      const deviceId = guard(req, res);
      if (!deviceId) return;
      const { rowCount } = await pool.query(`DELETE FROM guide_poi_visits WHERE device_id = $1`, [deviceId]);
      res.json({ deviceId, deleted: { visits: rowCount ?? 0 } });
    }),
  );

  // Retten til sletting (art. 17): alt om enheten, også vurderinger.
  app.delete(
    "/api/guide/device/data",
    wrap(async (req, res) => {
      const deviceId = guard(req, res);
      if (!deviceId) return;
      const [visits, ratings] = await Promise.all([
        pool.query(`DELETE FROM guide_poi_visits WHERE device_id = $1`, [deviceId]),
        pool.query(`DELETE FROM guide_poi_ratings WHERE device_id = $1`, [deviceId]),
      ]);
      res.json({ deviceId, deleted: { visits: visits.rowCount ?? 0, ratings: ratings.rowCount ?? 0 } });
    }),
  );
}
