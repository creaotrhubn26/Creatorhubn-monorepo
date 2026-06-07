// Admin Academy routes.
//
// Driver Academy-fanen i AdminDashboard. Erstatter de gamle hardkodede
// tallene (5 000 kr revenue / 25 000 kr payouts / 80–20-split) med ekte
// aggregat fra academy_courses + academy_instructors + academy_enrollments
// (migrasjon 243).
//
// Endepunkter:
//   GET /api/admin/academy/summary
//        → { totalRevenue, totalPayouts, platformShare, instructorShare,
//            courseCount, enrollmentCount, activeInstructorCount }
//        Aggregert over alle enrollments + per-instruktør revenue_share.
//
//   GET /api/admin/academy/courses?limit=50&status=published
//        → { courses: [...], total }
//        Courses JOIN'et med instructor. Status er valgfritt filter.
//
//   GET /api/admin/academy/instructors?active=true
//        → { instructors: [...], total }
//        Instruktører + per-instruktør enrollment/revenue-aggregat.
//
//   GET /api/admin/academy/payouts?instructorId=X
//        → { payouts: [...], total }
//        Liste over registrerte utbetalinger. Ingen payouts-tabell
//        finnes enda — vi returnerer tom liste, men endepunktet er
//        klart til å hentes så snart en payouts-tabell legges til.
//
// Alle endepunkter krever admin-sesjon. Hvis migrasjon 243 ikke er
// kjørt → returner tom struktur med 200 (ikke 500) slik at frontend
// kan rendre "ingen data".

import express from "express";
import type { Pool } from "pg";

export interface AdminAcademyRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ─── Constants ────────────────────────────────────────────────

const VALID_COURSE_STATUSES = new Set<string>([
  "draft",
  "published",
  "archived",
]);

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

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return null;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Trygg "ingen tabell"-detektor — Postgres SQLSTATE 42P01.
// Når migrasjonen ikke er kjørt, returnerer endepunktene tom struktur
// i stedet for 500.
function isUndefinedTableError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: string }).code === "42P01";
  }
  return false;
}

// ─── Row-typer ────────────────────────────────────────────────

interface SummaryRow {
  total_revenue: string | null;
  enrollment_count: string;
  course_count: string;
  active_instructor_count: string;
}

interface InstructorRevenueShareRow {
  instructor_id: string | null;
  revenue: string | null;
  revenue_share: string | null;
}

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor_id: string | null;
  price_nok: number;
  duration_minutes: number | null;
  status: string;
  thumbnail_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  instructor_display_name: string | null;
  instructor_email: string | null;
  enrollment_count: string;
}

interface InstructorRow {
  id: string;
  user_id: string | null;
  display_name: string;
  bio: string | null;
  email: string | null;
  revenue_share: string;
  total_revenue_nok: number;
  total_payouts_nok: number;
  is_active: boolean;
  created_at: Date | string;
  course_count: string;
  active_enrollment_count: string;
  aggregate_revenue: string | null;
}

// ─── Serializers ──────────────────────────────────────────────

function serializeCourse(row: CourseRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    instructorId: row.instructor_id,
    instructorName: row.instructor_display_name,
    instructorEmail: row.instructor_email,
    priceNok: row.price_nok,
    durationMinutes: row.duration_minutes,
    status: row.status,
    thumbnailUrl: row.thumbnail_url,
    enrollmentCount: Number(row.enrollment_count) || 0,
    createdAt: toIsoOrNull(row.created_at),
    updatedAt: toIsoOrNull(row.updated_at),
  };
}

function serializeInstructor(row: InstructorRow) {
  const revenueShare = Number(row.revenue_share) || 0;
  const aggregateRevenue = Number(row.aggregate_revenue) || 0;
  // Forventet utbetaling = aggregert kurs-inntekt × instructor-andel.
  const expectedPayout = Math.round((aggregateRevenue * revenueShare) / 100);
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    email: row.email,
    revenueShare,
    totalRevenueNok: row.total_revenue_nok,
    totalPayoutsNok: row.total_payouts_nok,
    isActive: row.is_active,
    courseCount: Number(row.course_count) || 0,
    activeEnrollmentCount: Number(row.active_enrollment_count) || 0,
    aggregateRevenueNok: aggregateRevenue,
    expectedPayoutNok: expectedPayout,
    createdAt: toIsoOrNull(row.created_at),
  };
}

// ─── Setup ────────────────────────────────────────────────────

export function setupAdminAcademyRoutes(deps: AdminAcademyRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── GET /api/admin/academy/summary ───────────────────────
  // Aggregert oversikt. Totals respekterer kun status='active' eller
  // 'completed' for enrollments (refunded teller ikke som inntekt).
  app.get("/api/admin/academy/summary", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      let totalRevenue = 0;
      let enrollmentCount = 0;
      let courseCount = 0;
      let activeInstructorCount = 0;
      let instructorShare = 0;

      try {
        const summaryResult = await pool.query<SummaryRow>(
          `SELECT
             COALESCE(SUM(e.amount_paid_nok), 0)::text AS total_revenue,
             COUNT(e.id)::text                          AS enrollment_count,
             (SELECT COUNT(*)::text FROM academy_courses)                                AS course_count,
             (SELECT COUNT(*)::text FROM academy_instructors WHERE is_active = TRUE)    AS active_instructor_count
           FROM academy_enrollments e
           WHERE e.status IN ('active', 'completed')`,
        );

        const summaryRow = summaryResult.rows[0];
        if (summaryRow) {
          totalRevenue = Number(summaryRow.total_revenue) || 0;
          enrollmentCount = Number(summaryRow.enrollment_count) || 0;
          courseCount = Number(summaryRow.course_count) || 0;
          activeInstructorCount =
            Number(summaryRow.active_instructor_count) || 0;
        }

        // Instruktør-andel = sum over hver instruktør:
        //   sum_of_their_course_revenue × revenue_share / 100.
        // Gjøres pr. instruktør slik at ulike revenue_share-prosenter
        // teller riktig.
        const shareResult = await pool.query<InstructorRevenueShareRow>(
          `SELECT
             i.id::text AS instructor_id,
             COALESCE(SUM(e.amount_paid_nok), 0)::text AS revenue,
             i.revenue_share::text                     AS revenue_share
           FROM academy_instructors i
           LEFT JOIN academy_courses c       ON c.instructor_id = i.id
           LEFT JOIN academy_enrollments e   ON e.course_id = c.id
                                            AND e.status IN ('active', 'completed')
           GROUP BY i.id, i.revenue_share`,
        );

        for (const row of shareResult.rows) {
          const revenue = Number(row.revenue) || 0;
          const share = Number(row.revenue_share) || 0;
          instructorShare += (revenue * share) / 100;
        }
        instructorShare = Math.round(instructorShare);
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.json({
            totalRevenue: 0,
            totalPayouts: 0,
            platformShare: 0,
            instructorShare: 0,
            courseCount: 0,
            enrollmentCount: 0,
            activeInstructorCount: 0,
          });
        }
        throw err;
      }

      const platformShare = Math.max(0, totalRevenue - instructorShare);

      // totalPayouts = aggregat fra academy_instructors.total_payouts_nok.
      // Hvis ingen payouts-tabell finnes, er dette eneste kilde.
      let totalPayouts = 0;
      try {
        const payoutsResult = await pool.query<{ total: string | null }>(
          `SELECT COALESCE(SUM(total_payouts_nok), 0)::text AS total
             FROM academy_instructors`,
        );
        totalPayouts = Number(payoutsResult.rows[0]?.total) || 0;
      } catch (err) {
        if (!isUndefinedTableError(err)) throw err;
      }

      res.json({
        totalRevenue,
        totalPayouts,
        platformShare,
        instructorShare,
        courseCount,
        enrollmentCount,
        activeInstructorCount,
      });
    } catch (err) {
      console.error("[admin-academy] summary failed:", err);
      res.status(500).json({ error: "Could not fetch academy summary" });
    }
  });

  // ─── GET /api/admin/academy/courses ───────────────────────
  // Kurslisting + instruktør-JOIN + enrollment-count pr. kurs.
  // Status-filter: ?status=draft|published|archived (valgfritt).
  app.get("/api/admin/academy/courses", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const status = readString(req.query.status);
      const limit = readLimit(req.query.limit, 50, 500);

      if (status && !VALID_COURSE_STATUSES.has(status)) {
        return res.status(400).json({
          error:
            "Ugyldig status. Lovlige: " +
            Array.from(VALID_COURSE_STATUSES).join(", "),
        });
      }

      const params: unknown[] = [];
      let whereClause = "";
      if (status) {
        params.push(status);
        whereClause = `WHERE c.status = $${params.length}`;
      }
      params.push(limit);

      let rows: CourseRow[] = [];
      let total = 0;
      try {
        const result = await pool.query<CourseRow>(
          `SELECT c.id::text AS id, c.title, c.slug, c.description,
                  c.instructor_id::text AS instructor_id,
                  c.price_nok, c.duration_minutes, c.status, c.thumbnail_url,
                  c.created_at, c.updated_at,
                  i.display_name AS instructor_display_name,
                  i.email        AS instructor_email,
                  COALESCE(
                    (SELECT COUNT(*) FROM academy_enrollments e WHERE e.course_id = c.id),
                    0
                  )::text AS enrollment_count
             FROM academy_courses c
             LEFT JOIN academy_instructors i ON i.id = c.instructor_id
             ${whereClause}
             ORDER BY c.created_at DESC
             LIMIT $${params.length}`,
          params,
        );
        rows = result.rows;

        const countParams: unknown[] = [];
        let countWhere = "";
        if (status) {
          countParams.push(status);
          countWhere = `WHERE status = $1`;
        }
        const countResult = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM academy_courses ${countWhere}`,
          countParams,
        );
        total = Number(countResult.rows[0]?.n ?? 0);
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.json({ courses: [], total: 0 });
        }
        throw err;
      }

      res.json({
        courses: rows.map(serializeCourse),
        total,
      });
    } catch (err) {
      console.error("[admin-academy] courses list failed:", err);
      res.status(500).json({ error: "Could not fetch academy courses" });
    }
  });

  // ─── GET /api/admin/academy/instructors ───────────────────
  // Instruktør-listing + per-instruktør course-count, enrollment-count
  // og aggregert revenue (sum av amount_paid_nok over deres kurs).
  app.get("/api/admin/academy/instructors", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const activeFilter = readBoolean(req.query.active);
      const limit = readLimit(req.query.limit, 100, 500);

      const params: unknown[] = [];
      let whereClause = "";
      if (activeFilter !== null) {
        params.push(activeFilter);
        whereClause = `WHERE i.is_active = $${params.length}`;
      }
      params.push(limit);

      let rows: InstructorRow[] = [];
      let total = 0;
      try {
        const result = await pool.query<InstructorRow>(
          `SELECT i.id::text AS id,
                  i.user_id::text AS user_id,
                  i.display_name, i.bio, i.email,
                  i.revenue_share::text AS revenue_share,
                  i.total_revenue_nok, i.total_payouts_nok,
                  i.is_active, i.created_at,
                  COALESCE(
                    (SELECT COUNT(*) FROM academy_courses c
                      WHERE c.instructor_id = i.id),
                    0
                  )::text AS course_count,
                  COALESCE(
                    (SELECT COUNT(*) FROM academy_enrollments e
                       JOIN academy_courses c ON c.id = e.course_id
                      WHERE c.instructor_id = i.id
                        AND e.status IN ('active', 'completed')),
                    0
                  )::text AS active_enrollment_count,
                  COALESCE(
                    (SELECT SUM(e.amount_paid_nok) FROM academy_enrollments e
                       JOIN academy_courses c ON c.id = e.course_id
                      WHERE c.instructor_id = i.id
                        AND e.status IN ('active', 'completed')),
                    0
                  )::text AS aggregate_revenue
             FROM academy_instructors i
             ${whereClause}
             ORDER BY i.is_active DESC, i.display_name ASC
             LIMIT $${params.length}`,
          params,
        );
        rows = result.rows;

        const countParams: unknown[] = [];
        let countWhere = "";
        if (activeFilter !== null) {
          countParams.push(activeFilter);
          countWhere = `WHERE is_active = $1`;
        }
        const countResult = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM academy_instructors ${countWhere}`,
          countParams,
        );
        total = Number(countResult.rows[0]?.n ?? 0);
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.json({ instructors: [], total: 0 });
        }
        throw err;
      }

      res.json({
        instructors: rows.map(serializeInstructor),
        total,
      });
    } catch (err) {
      console.error("[admin-academy] instructors list failed:", err);
      res.status(500).json({ error: "Could not fetch academy instructors" });
    }
  });

  // ─── GET /api/admin/academy/payouts ───────────────────────
  // Utbetalingsforespørsler. Vi har ingen payouts-tabell enda (det vil
  // sannsynligvis komme i en senere migrasjon når flowen er klar), så
  // dette endepunktet returnerer tom liste — frontend skal håndtere
  // tomt sett uten å feile.
  //
  // ?instructorId=X (valgfritt) — filter når payouts-tabell finnes.
  app.get("/api/admin/academy/payouts", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const instructorId = readString(req.query.instructorId);

      // Forsøk å spørre fra en eventuell academy_payouts-tabell. Hvis
      // tabellen ikke finnes (42P01), returner tom liste med 200.
      const params: unknown[] = [];
      let whereClause = "";
      if (instructorId) {
        params.push(instructorId);
        whereClause = `WHERE instructor_id = $${params.length}::uuid`;
      }

      try {
        const result = await pool.query<{
          id: string;
          instructor_id: string;
          amount_nok: number;
          status: string;
          requested_at: Date | string;
          completed_at: Date | string | null;
        }>(
          `SELECT id::text, instructor_id::text, amount_nok, status,
                  requested_at, completed_at
             FROM academy_payouts
             ${whereClause}
             ORDER BY requested_at DESC
             LIMIT 200`,
          params,
        );

        const payouts = result.rows.map((row) => ({
          id: row.id,
          instructorId: row.instructor_id,
          amountNok: row.amount_nok,
          status: row.status,
          requestedAt: toIsoOrNull(row.requested_at),
          completedAt: toIsoOrNull(row.completed_at),
        }));

        return res.json({ payouts, total: payouts.length });
      } catch (err) {
        if (isUndefinedTableError(err)) {
          // Ingen payouts-tabell enda — tomt sett er forventet.
          return res.json({ payouts: [], total: 0 });
        }
        throw err;
      }
    } catch (err) {
      console.error("[admin-academy] payouts list failed:", err);
      res.status(500).json({ error: "Could not fetch academy payouts" });
    }
  });
}
