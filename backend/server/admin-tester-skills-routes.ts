// Admin tester-skills + testing-leaderboard routes.
//
// Driver tracking-flaten for tester-ferdigheter og leaderboard bak
// AdminDashboard. Sporer ferdigheter pr. (bruker, skill-kategori)
// basert på prototype-feedback og test-aktivitet.
//
// Persistens: `tester_skill_ratings`-tabellen (migrasjon 242).
// En rad pr. (user_id, skill_category). UNIQUE-constraint i DB gjør at
// POST /award kan upserte via ON CONFLICT.
//
// Endepunkter:
//   GET  /api/admin/tester-skills?category=X&limit=50
//          → ratings pr. kategori, JOIN'et med users (navn/email)
//   GET  /api/admin/testing-leaderboard?range=30d
//          → top-10 testere overall (SUM(score)) + lastActive
//   POST /api/admin/tester-skills/:userId/award
//          body { category, points, reason }
//          → INSERT eller bump score (upsert), returnerer newScore
//
// Alle krever admin-sesjon via requireAdminSession. Tomme tabeller
// returnerer 200 med tom liste — IKKE 500 — slik at frontend kan rendre
// "ingen data" uten å vise feilmelding.

import express from "express";
import type { Pool } from "pg";

// ─── Constants ────────────────────────────────────────────────
// Lovlige skill-kategorier. Spec'en låser settet, så vi validerer
// både i list-filter og i award-body.
const VALID_SKILL_CATEGORIES = new Set<string>([
  "bug-hunting",
  "ux-feedback",
  "regression-testing",
  "integration-testing",
  "edge-cases",
]);

// Lovlige tidsrom for leaderboard. NULL = all-time.
const VALID_LEADERBOARD_RANGES: Record<string, string | null> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "all": null,
};

export interface AdminTesterSkillsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readLimit(value: unknown, fallback: number, max: number): number {
  const parsed = readInteger(value);
  if (parsed === null || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function highQualityRate(total: number, highQuality: number): number {
  if (total <= 0) return 0;
  return Math.round((highQuality / total) * 1000) / 10; // 1 desimal som prosent
}

// Trygg "ingen tabell"-detektor — Postgres SQLSTATE 42P01.
// Hvis migrasjonen ikke er kjørt, vil hele endepunktet returnere tom
// liste i stedet for 500 (per spec).
function isUndefinedTableError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: string }).code === "42P01";
  }
  return false;
}

// ─── Row-typer fra DB ─────────────────────────────────────────

interface SkillRatingRow {
  id: string;
  user_id: string;
  skill_category: string;
  score: number;
  total_submissions: number;
  high_quality_submissions: number;
  last_active_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
}

interface LeaderboardRow {
  user_id: string;
  total_score: string; // SUM => numeric som tekst i pg
  ratings_count: string; // COUNT => bigint som tekst
  last_active: Date | string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
}

interface AwardReturningRow {
  id: string;
  user_id: string;
  skill_category: string;
  score: number;
  total_submissions: number;
  high_quality_submissions: number;
  last_active_at: Date | string | null;
}

// ─── Serializers ──────────────────────────────────────────────

function userDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const composed = [firstName, lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  if (composed) return composed;
  if (email) return email;
  return "Ukjent bruker";
}

function serializeRating(row: SkillRatingRow) {
  return {
    userId: row.user_id,
    userName: userDisplayName(row.user_first_name, row.user_last_name, row.user_email),
    userEmail: row.user_email,
    skillCategory: row.skill_category,
    score: row.score,
    totalSubmissions: row.total_submissions,
    highQualityRate: highQualityRate(row.total_submissions, row.high_quality_submissions),
  };
}

function serializeLeaderboardEntry(row: LeaderboardRow) {
  return {
    userId: row.user_id,
    userName: userDisplayName(row.user_first_name, row.user_last_name, row.user_email),
    userEmail: row.user_email,
    totalScore: Number(row.total_score) || 0,
    ratingsCount: Number(row.ratings_count) || 0,
    lastActive: toIsoOrNull(row.last_active),
  };
}

// ─── Setup ────────────────────────────────────────────────────

export function setupAdminTesterSkillsRoutes(
  deps: AdminTesterSkillsRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── GET /api/admin/tester-skills ──────────────────────────
  // Ratings pr. kategori, JOIN'et med users for navn + email.
  // Hvis tabellen ikke finnes (migrasjon ikke kjørt) → tom liste.
  app.get("/api/admin/tester-skills", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const category = readString(req.query.category);
      const limit = readLimit(req.query.limit, 50, 500);

      if (category && !VALID_SKILL_CATEGORIES.has(category)) {
        return res.status(400).json({
          error:
            "Ugyldig category. Lovlige: " +
            Array.from(VALID_SKILL_CATEGORIES).join(", "),
        });
      }

      const params: unknown[] = [];
      let whereClause = "";
      if (category) {
        params.push(category);
        whereClause = `WHERE r.skill_category = $${params.length}`;
      }
      params.push(limit);

      let rows: SkillRatingRow[] = [];
      let total = 0;
      try {
        const result = await pool.query<SkillRatingRow>(
          `SELECT r.id, r.user_id::text AS user_id, r.skill_category, r.score,
                  r.total_submissions, r.high_quality_submissions,
                  r.last_active_at, r.created_at, r.updated_at,
                  u.email AS user_email,
                  u.first_name AS user_first_name,
                  u.last_name  AS user_last_name
             FROM tester_skill_ratings r
             LEFT JOIN users u ON u.id = r.user_id::text
            ${whereClause}
            ORDER BY r.score DESC, r.updated_at DESC
            LIMIT $${params.length}`,
          params,
        );
        rows = result.rows;

        // Total-tellingen respekterer category-filter, men ikke limit.
        const countParams: unknown[] = [];
        let countWhere = "";
        if (category) {
          countParams.push(category);
          countWhere = `WHERE skill_category = $1`;
        }
        const countResult = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM tester_skill_ratings ${countWhere}`,
          countParams,
        );
        total = Number(countResult.rows[0]?.n ?? 0);
      } catch (err) {
        if (isUndefinedTableError(err)) {
          // Migrasjon ikke kjørt enda — returner tomt sett i stedet for 500.
          return res.json({ ratings: [], total: 0 });
        }
        throw err;
      }

      res.json({
        ratings: rows.map(serializeRating),
        total,
      });
    } catch (err) {
      console.error("[admin-tester-skills] list failed:", err);
      res.status(500).json({ error: "Could not fetch tester skills" });
    }
  });

  // ─── GET /api/admin/testing-leaderboard ────────────────────
  // Top-10 testere overall: SUM(score) pr. user, ratings-count, sist aktiv.
  // range=7d|30d|90d|all (default 30d).
  app.get("/api/admin/testing-leaderboard", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const rangeRaw = readString(req.query.range) ?? "30d";
      if (!(rangeRaw in VALID_LEADERBOARD_RANGES)) {
        return res.status(400).json({
          error:
            "Ugyldig range. Lovlige: " +
            Object.keys(VALID_LEADERBOARD_RANGES).join(", "),
        });
      }
      const interval = VALID_LEADERBOARD_RANGES[rangeRaw];

      // Bygg WHERE basert på range — bruker last_active_at som
      // aktivitets-vindu (faller tilbake på updated_at hvis last_active
      // er NULL, slik at nye rader uten activity-stempel telles).
      // NB: Vi har to varianter — én med `r.`-prefiks (for SELECT-en som
      // joiner mot users — der `users.updated_at` ellers ville være
      // tvetydig) og én uten prefiks (for COUNT-en som ikke joiner).
      let activityFilterJoined = "";
      let activityFilterCount = "";
      if (interval !== null) {
        activityFilterJoined = `WHERE COALESCE(r.last_active_at, r.updated_at) >= now() - INTERVAL '${interval}'`;
        activityFilterCount = `WHERE COALESCE(last_active_at, updated_at) >= now() - INTERVAL '${interval}'`;
      }

      let rows: LeaderboardRow[] = [];
      let totalParticipants = 0;
      try {
        const result = await pool.query<LeaderboardRow>(
          `SELECT r.user_id::text AS user_id,
                  SUM(r.score)::text AS total_score,
                  COUNT(*)::text     AS ratings_count,
                  MAX(COALESCE(r.last_active_at, r.updated_at)) AS last_active,
                  u.email AS user_email,
                  u.first_name AS user_first_name,
                  u.last_name  AS user_last_name
             FROM tester_skill_ratings r
             LEFT JOIN users u ON u.id = r.user_id::text
            ${activityFilterJoined}
            GROUP BY r.user_id, u.email, u.first_name, u.last_name
            ORDER BY SUM(r.score) DESC NULLS LAST, MAX(COALESCE(r.last_active_at, r.updated_at)) DESC NULLS LAST
            LIMIT 10`,
        );
        rows = result.rows;

        const countResult = await pool.query<{ n: string }>(
          `SELECT COUNT(DISTINCT user_id)::text AS n
             FROM tester_skill_ratings
             ${activityFilterCount}`,
        );
        totalParticipants = Number(countResult.rows[0]?.n ?? 0);
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.json({ leaderboard: [], totalParticipants: 0 });
        }
        throw err;
      }

      res.json({
        leaderboard: rows.map(serializeLeaderboardEntry),
        totalParticipants,
        range: rangeRaw,
      });
    } catch (err) {
      console.error("[admin-tester-skills] leaderboard failed:", err);
      res.status(500).json({ error: "Could not fetch testing leaderboard" });
    }
  });

  // ─── POST /api/admin/tester-skills/:userId/award ───────────
  // body: { category, points, reason? }
  // Upsert: hvis (user, kategori) finnes → bump score; ellers INSERT.
  // Vi bumper også total_submissions med 1 og high_quality_submissions
  // med 1 hvis points >= 5 (heuristikk: "high quality" når reviewer
  // anerkjenner submission med mer enn baseline-poeng).
  app.post("/api/admin/tester-skills/:userId/award", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const userId = readString(req.params.userId);
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      const category = readString(body.category);
      const points = readInteger(body.points);
      const reason = readString(body.reason);

      if (!userId) {
        return res.status(400).json({ error: "userId i path er påkrevd" });
      }
      if (!category) {
        return res.status(400).json({ error: "category er påkrevd" });
      }
      if (!VALID_SKILL_CATEGORIES.has(category)) {
        return res.status(400).json({
          error:
            "Ugyldig category. Lovlige: " +
            Array.from(VALID_SKILL_CATEGORIES).join(", "),
        });
      }
      if (points === null) {
        return res.status(400).json({ error: "points (integer) er påkrevd" });
      }

      const highQualityIncrement = points >= 5 ? 1 : 0;

      let result;
      try {
        result = await pool.query<AwardReturningRow>(
          `INSERT INTO tester_skill_ratings
              (user_id, skill_category, score, total_submissions,
               high_quality_submissions, last_active_at, updated_at)
           VALUES ($1::uuid, $2, $3, 1, $4, now(), now())
           ON CONFLICT (user_id, skill_category) DO UPDATE
              SET score                     = tester_skill_ratings.score + EXCLUDED.score,
                  total_submissions         = tester_skill_ratings.total_submissions + 1,
                  high_quality_submissions  = tester_skill_ratings.high_quality_submissions + $4,
                  last_active_at            = now(),
                  updated_at                = now()
           RETURNING id, user_id::text AS user_id, skill_category, score,
                     total_submissions, high_quality_submissions, last_active_at`,
          [userId, category, points, highQualityIncrement],
        );
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({
            error:
              "tester_skill_ratings-tabellen finnes ikke — kjør migrasjon 242.",
          });
        }
        throw err;
      }

      const row = result.rows[0];
      if (!row) {
        return res
          .status(500)
          .json({ error: "Award returnerte ingen rad" });
      }

      res.json({
        success: true,
        newScore: row.score,
        rating: {
          userId: row.user_id,
          skillCategory: row.skill_category,
          score: row.score,
          totalSubmissions: row.total_submissions,
          highQualityRate: highQualityRate(
            row.total_submissions,
            row.high_quality_submissions,
          ),
          lastActiveAt: toIsoOrNull(row.last_active_at),
        },
        reason: reason ?? null,
      });
    } catch (err) {
      console.error("[admin-tester-skills] award failed:", err);
      res.status(500).json({ error: "Could not award tester points" });
    }
  });
}
