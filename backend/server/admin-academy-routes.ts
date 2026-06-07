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
//   GET /api/admin/academy/payouts?status=pending&limit=50
//        → { payouts: [...], total, tableMissing? }
//        Liste over utbetalingsforespørsler JOIN'et med instruktør-navn.
//        Status-filter: 'pending' | 'approved' | 'paid' | 'rejected'.
//        Hvis academy_payouts ikke finnes (migrasjon 254 ikke kjørt) →
//        tableMissing: true.
//
//   POST /api/admin/academy/payouts/:id/approve
//        → status pending → approved. approved_by = session.email.
//
//   POST /api/admin/academy/payouts/:id/reject
//        body: { reason } — påkrevd
//        → status pending → rejected.
//
//   POST /api/admin/academy/payouts/:id/mark-paid
//        body: { stripeTransferId? }
//        → status approved → paid. paid_at = now().
//
// Alle endepunkter krever admin-sesjon. Hvis migrasjon 243 ikke er
// kjørt → returner tom struktur med 200 (ikke 500) slik at frontend
// kan rendre "ingen data".

import express from "express";
import type { Pool } from "pg";
import Stripe from "stripe";

export interface AdminAcademyRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ─── Stripe singleton ─────────────────────────────────────────
// Lat instansiert; null hvis ingen secret-key er satt (lokal dev uten
// Stripe-konfig). Endepunktene returnerer 503 stripe_not_configured i
// så tilfelle, i stedet for å krasje.
let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.CREATORHUB_STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key.trim());
  return stripeClient;
}

function getReturnBaseUrl(): string {
  return (
    process.env.ACADEMY_ONBOARDING_RETURN_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://creatorhubn.com"
  );
}

// ─── Constants ────────────────────────────────────────────────

const VALID_COURSE_STATUSES = new Set<string>([
  "draft",
  "published",
  "archived",
]);

const VALID_PAYOUT_STATUSES = new Set<string>([
  "pending",
  "approved",
  "paid",
  "rejected",
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
            pendingPayoutsCount: 0,
            pendingPayoutsAmount: 0,
            paidThisMonth: 0,
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

      // Pending payouts + paid-this-month aggregeres fra academy_payouts.
      // Hvis migrasjon 254 ikke er kjørt — returner 0/0/0 (frontend tåler det).
      let pendingPayoutsCount = 0;
      let pendingPayoutsAmount = 0;
      let paidThisMonth = 0;
      try {
        const payoutAggResult = await pool.query<{
          pending_count: string | null;
          pending_amount: string | null;
          paid_this_month: string | null;
        }>(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)::text         AS pending_count,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_nok ELSE 0 END), 0)::text AS pending_amount,
             COALESCE(SUM(
               CASE WHEN status = 'paid' AND paid_at >= date_trunc('month', now())
                    THEN amount_nok ELSE 0 END
             ), 0)::text AS paid_this_month
           FROM academy_payouts`,
        );
        const row = payoutAggResult.rows[0];
        if (row) {
          pendingPayoutsCount = Number(row.pending_count) || 0;
          pendingPayoutsAmount = Number(row.pending_amount) || 0;
          paidThisMonth = Number(row.paid_this_month) || 0;
        }
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
        pendingPayoutsCount,
        pendingPayoutsAmount,
        paidThisMonth,
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
  // Utbetalingsforespørsler JOIN'et med instruktør-navn fra
  // academy_instructors. Migrasjon 254 oppretter academy_payouts;
  // før den er kjørt returneres tableMissing: true.
  //
  // Query-params:
  //   ?status=pending|approved|paid|rejected (valgfritt)
  //   ?instructorId=X                        (valgfritt)
  //   ?limit=50                              (default 50, max 500)
  app.get("/api/admin/academy/payouts", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const status = readString(req.query.status);
      const instructorId = readString(req.query.instructorId);
      const limit = readLimit(req.query.limit, 50, 500);

      if (status && !VALID_PAYOUT_STATUSES.has(status)) {
        return res.status(400).json({
          error:
            "Ugyldig status. Lovlige: " +
            Array.from(VALID_PAYOUT_STATUSES).join(", "),
        });
      }

      const params: unknown[] = [];
      const whereParts: string[] = [];
      if (status) {
        params.push(status);
        whereParts.push(`p.status = $${params.length}`);
      }
      if (instructorId) {
        params.push(instructorId);
        whereParts.push(`p.instructor_id = $${params.length}::uuid`);
      }
      const whereClause =
        whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
      params.push(limit);
      const limitPlaceholder = `$${params.length}`;

      try {
        const result = await pool.query<{
          id: string;
          instructor_id: string;
          instructor_name: string | null;
          amount_nok: number;
          status: string;
          bank_account_last4: string | null;
          requested_at: Date | string;
          approved_at: Date | string | null;
          paid_at: Date | string | null;
          rejected_at: Date | string | null;
          rejection_reason: string | null;
          stripe_transfer_id: string | null;
          notes: string | null;
        }>(
          `SELECT p.id::text                  AS id,
                  p.instructor_id::text       AS instructor_id,
                  i.display_name              AS instructor_name,
                  p.amount_nok,
                  p.status,
                  p.bank_account_last4,
                  p.requested_at,
                  p.approved_at,
                  p.paid_at,
                  p.rejected_at,
                  p.rejection_reason,
                  p.stripe_transfer_id,
                  p.notes
             FROM academy_payouts p
             LEFT JOIN academy_instructors i ON i.id = p.instructor_id
             ${whereClause}
             ORDER BY p.requested_at DESC
             LIMIT ${limitPlaceholder}`,
          params,
        );

        const payouts = result.rows.map((row) => ({
          id: row.id,
          instructorId: row.instructor_id,
          instructorName: row.instructor_name,
          amount: row.amount_nok,
          status: row.status,
          bankAccountLast4: row.bank_account_last4,
          requestedAt: toIsoOrNull(row.requested_at),
          approvedAt: toIsoOrNull(row.approved_at),
          paidAt: toIsoOrNull(row.paid_at),
          rejectedAt: toIsoOrNull(row.rejected_at),
          rejectionReason: row.rejection_reason,
          stripeTransferId: row.stripe_transfer_id,
          notes: row.notes,
        }));

        return res.json({ payouts, total: payouts.length });
      } catch (err) {
        if (isUndefinedTableError(err)) {
          // Migrasjon 254 ikke kjørt — frontend tåler tableMissing.
          return res.json({ payouts: [], total: 0, tableMissing: true });
        }
        throw err;
      }
    } catch (err) {
      console.error("[admin-academy] payouts list failed:", err);
      res.status(500).json({ error: "Could not fetch academy payouts" });
    }
  });

  // ─── POST /api/admin/academy/payouts/:id/approve ──────────
  // Sett pending → approved. approved_by = session.email.
  // 400 hvis status ikke er 'pending' (invalid_status_transition).
  // 404 hvis payout-rad ikke finnes.
  app.post("/api/admin/academy/payouts/:id/approve", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = readString(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "missing_payout_id" });
    }
    try {
      const current = await pool.query<{ status: string }>(
        `SELECT status FROM academy_payouts WHERE id = $1::uuid`,
        [id],
      );
      if (current.rowCount === 0) {
        return res.status(404).json({ error: "payout_not_found" });
      }
      if (current.rows[0].status !== "pending") {
        return res.status(400).json({
          error: "invalid_status_transition",
          currentStatus: current.rows[0].status,
          message: "Bare 'pending' payouts kan godkjennes",
        });
      }

      const updated = await pool.query<{
        id: string;
        instructor_id: string;
        amount_nok: number;
        status: string;
        approved_at: Date | string | null;
        approved_by: string | null;
      }>(
        `UPDATE academy_payouts
            SET status = 'approved',
                approved_at = now(),
                approved_by = $2
          WHERE id = $1::uuid
          RETURNING id::text, instructor_id::text, amount_nok, status,
                    approved_at, approved_by`,
        [id, session.email],
      );

      const row = updated.rows[0];
      return res.json({
        success: true,
        payout: {
          id: row.id,
          instructorId: row.instructor_id,
          amount: row.amount_nok,
          status: row.status,
          approvedAt: toIsoOrNull(row.approved_at),
          approvedBy: row.approved_by,
        },
      });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        return res.status(503).json({
          error: "payouts_table_missing",
          message: "Migrasjon 254 må kjøres først",
        });
      }
      console.error("[admin-academy] payout approve failed:", err);
      return res.status(500).json({ error: "Could not approve payout" });
    }
  });

  // ─── POST /api/admin/academy/payouts/:id/reject ───────────
  // Body: { reason: string } — påkrevd.
  // Sett pending → rejected.
  app.post("/api/admin/academy/payouts/:id/reject", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = readString(req.params.id);
    if (!id) return res.status(400).json({ error: "missing_payout_id" });
    const reason = readString((req.body ?? {}).reason);
    if (!reason) {
      return res.status(400).json({ error: "missing_reason" });
    }
    try {
      const current = await pool.query<{ status: string }>(
        `SELECT status FROM academy_payouts WHERE id = $1::uuid`,
        [id],
      );
      if (current.rowCount === 0) {
        return res.status(404).json({ error: "payout_not_found" });
      }
      if (current.rows[0].status !== "pending") {
        return res.status(400).json({
          error: "invalid_status_transition",
          currentStatus: current.rows[0].status,
          message: "Bare 'pending' payouts kan avvises",
        });
      }
      await pool.query(
        `UPDATE academy_payouts
            SET status = 'rejected',
                rejected_at = now(),
                rejected_by = $2,
                rejection_reason = $3
          WHERE id = $1::uuid`,
        [id, session.email, reason],
      );
      return res.json({ success: true });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        return res.status(503).json({
          error: "payouts_table_missing",
          message: "Migrasjon 254 må kjøres først",
        });
      }
      console.error("[admin-academy] payout reject failed:", err);
      return res.status(500).json({ error: "Could not reject payout" });
    }
  });

  // ─── POST /api/admin/academy/payouts/:id/mark-paid ────────
  // Faktisk Stripe Transfer (Connect Express) — overfører
  // instructor-revenue til deres Express Connect-konto.
  //
  // Krav:
  //   * Payout-status = 'approved'
  //   * Instructor.stripe_account_id satt + payouts_enabled = TRUE
  //   * Stripe Connect Express må være onboardet (KYC ferdig)
  //
  // Body: { stripeTransferId? } — valgfri override for manuell entry
  //   (brukes hvis transfer ble gjort utenfor systemet, f.eks. bankgiro).
  //   Hvis stripeTransferId mangler: Stripe-transfer opprettes via SDK.
  //
  // Skriver til academy_transfers (audit-trail), oppdaterer
  // academy_payouts.stripe_transfer_id + paid_at, og setter
  // instructor.total_payouts_nok += amount.
  //
  // Returnerer 502 hvis Stripe-API feiler, 503 hvis Stripe ikke konfigurert.
  app.post("/api/admin/academy/payouts/:id/mark-paid", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = readString(req.params.id);
    if (!id) return res.status(400).json({ error: "missing_payout_id" });
    const manualTransferId = readString((req.body ?? {}).stripeTransferId);

    try {
      // Hent payout + instructor for å validere precondition.
      const ctxResult = await pool.query<{
        payout_status: string;
        amount_nok: number;
        instructor_id: string;
        stripe_account_id: string | null;
        payouts_enabled: boolean | null;
        onboarding_status: string | null;
        display_name: string | null;
      }>(
        `SELECT p.status::text                AS payout_status,
                p.amount_nok                  AS amount_nok,
                p.instructor_id::text         AS instructor_id,
                i.stripe_account_id           AS stripe_account_id,
                i.payouts_enabled             AS payouts_enabled,
                i.onboarding_status           AS onboarding_status,
                i.display_name                AS display_name
           FROM academy_payouts p
           LEFT JOIN academy_instructors i ON i.id = p.instructor_id
          WHERE p.id = $1::uuid`,
        [id],
      );
      if (ctxResult.rowCount === 0) {
        return res.status(404).json({ error: "payout_not_found" });
      }
      const ctx = ctxResult.rows[0];

      if (ctx.payout_status !== "approved") {
        return res.status(400).json({
          error: "invalid_status_transition",
          currentStatus: ctx.payout_status,
          message: "Bare 'approved' payouts kan markeres betalt",
        });
      }

      // Manuell override: admin har transferred utenfor Stripe Connect.
      // Skip Stripe-API-kallet og bare logg transferen.
      if (manualTransferId) {
        await pool.query(
          `UPDATE academy_payouts
              SET status = 'paid',
                  paid_at = now(),
                  stripe_transfer_id = COALESCE($2, stripe_transfer_id)
            WHERE id = $1::uuid`,
          [id, manualTransferId],
        );
        await pool.query(
          `UPDATE academy_instructors
              SET total_payouts_nok = COALESCE(total_payouts_nok, 0) + $1
            WHERE id = $2::uuid`,
          [ctx.amount_nok, ctx.instructor_id],
        );
        return res.json({
          success: true,
          mode: "manual",
          stripeTransferId: manualTransferId,
        });
      }

      // Faktisk Stripe Transfer.
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({
          error: "stripe_not_configured",
          message:
            "STRIPE_SECRET_KEY må være satt for å gjøre Stripe-overføringer",
        });
      }
      if (!ctx.stripe_account_id) {
        return res.status(400).json({
          error: "instructor_not_onboarded",
          message:
            "Instruktør mangler Stripe Connect-konto. Send onboarding-link først.",
        });
      }
      if (!ctx.payouts_enabled) {
        return res.status(400).json({
          error: "payouts_not_enabled",
          message:
            "Stripe Connect-kontoen har ikke fullført KYC (payouts_enabled=false). " +
            "Status: " +
            (ctx.onboarding_status ?? "unknown"),
        });
      }

      let transfer: Stripe.Transfer;
      try {
        transfer = await stripe.transfers.create({
          amount: ctx.amount_nok * 100, // NOK → øre
          currency: "nok",
          destination: ctx.stripe_account_id,
          transfer_group: `academy-payout-${id}`,
          metadata: {
            payout_id: id,
            instructor_id: ctx.instructor_id,
            initiated_by: session.email,
          },
        });
      } catch (stripeErr) {
        const message =
          stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        console.error("[admin-academy] stripe transfer failed:", stripeErr);
        return res.status(502).json({
          error: "stripe_transfer_failed",
          message,
        });
      }

      // Lag academy_transfers-audit-rad + oppdater payout-status.
      // Gjør i transaksjon slik at vi ikke ender opp med transfer i Stripe
      // og inkonsistent state i DB.
      try {
        await pool.query("BEGIN");
        await pool.query(
          `INSERT INTO academy_transfers
             (payout_id, stripe_transfer_id, instructor_id, amount_nok,
              destination_account_id, source_transaction, status,
              initiated_by, metadata)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, 'pending', $7, $8::jsonb)
           ON CONFLICT (stripe_transfer_id) DO NOTHING`,
          [
            id,
            transfer.id,
            ctx.instructor_id,
            ctx.amount_nok,
            ctx.stripe_account_id,
            typeof transfer.source_transaction === "string"
              ? transfer.source_transaction
              : null,
            session.email,
            JSON.stringify({
              currency: transfer.currency,
              created: transfer.created,
            }),
          ],
        );
        await pool.query(
          `UPDATE academy_payouts
              SET status = 'paid',
                  paid_at = now(),
                  stripe_transfer_id = $2
            WHERE id = $1::uuid`,
          [id, transfer.id],
        );
        await pool.query(
          `UPDATE academy_instructors
              SET total_payouts_nok = COALESCE(total_payouts_nok, 0) + $1
            WHERE id = $2::uuid`,
          [ctx.amount_nok, ctx.instructor_id],
        );
        await pool.query("COMMIT");
      } catch (dbErr) {
        await pool.query("ROLLBACK").catch(() => {});
        console.error(
          "[admin-academy] mark-paid: stripe transfer ok but DB write failed",
          { transferId: transfer.id, dbErr },
        );
        // Transferen ER opprettet i Stripe — gi 200 men flagg inkonsistens
        // slik at admin manuelt kan rekonsilere via academy_transfers.
        return res.status(200).json({
          success: true,
          warning: "stripe_ok_db_inconsistent",
          stripeTransferId: transfer.id,
          message:
            "Stripe-overføringen lyktes, men DB-skriv feilet. Sjekk audit-trail.",
        });
      }

      return res.json({
        success: true,
        mode: "stripe",
        transfer: {
          id: transfer.id,
          amount: ctx.amount_nok,
          currency: "nok",
          destination: ctx.stripe_account_id,
          status: transfer.reversed ? "reversed" : "pending",
        },
      });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        return res.status(503).json({
          error: "payouts_table_missing",
          message: "Migrasjon 254/255 må kjøres først",
        });
      }
      console.error("[admin-academy] payout mark-paid failed:", err);
      return res.status(500).json({ error: "Could not mark payout paid" });
    }
  });

  // ─── POST /api/admin/academy/instructors/:id/onboarding-link ──
  // Oppretter Stripe Connect Express-konto for instruktøren hvis den
  // ikke finnes, og returnerer en AccountLink-URL hvor instruktøren
  // gjennomfører KYC (Stripe håndterer BankID for norske kontoer).
  //
  // Response: { onboardingUrl, expiresAt, accountId }
  app.post(
    "/api/admin/academy/instructors/:id/onboarding-link",
    async (req, res) => {
      const session = requireAdminSession(req, res);
      if (!session) return;
      const id = readString(req.params.id);
      if (!id) return res.status(400).json({ error: "missing_instructor_id" });

      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({
          error: "stripe_not_configured",
          message: "STRIPE_SECRET_KEY må være satt",
        });
      }

      try {
        const instructorResult = await pool.query<{
          email: string | null;
          stripe_account_id: string | null;
          stripe_account_country: string | null;
          display_name: string;
        }>(
          `SELECT email, stripe_account_id, stripe_account_country, display_name
             FROM academy_instructors
            WHERE id = $1::uuid`,
          [id],
        );
        if (instructorResult.rowCount === 0) {
          return res.status(404).json({ error: "instructor_not_found" });
        }
        const instructor = instructorResult.rows[0];

        let accountId = instructor.stripe_account_id;
        if (!accountId) {
          let account: Stripe.Account;
          try {
            account = await stripe.accounts.create({
              type: "express",
              country: instructor.stripe_account_country || "NO",
              email: instructor.email || undefined,
              capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
              },
              business_type: "individual",
              metadata: {
                academy_instructor_id: id,
                display_name: instructor.display_name,
              },
            });
          } catch (stripeErr) {
            const message =
              stripeErr instanceof Error
                ? stripeErr.message
                : String(stripeErr);
            console.error(
              "[admin-academy] stripe account create failed:",
              stripeErr,
            );
            return res.status(502).json({
              error: "stripe_account_create_failed",
              message,
            });
          }
          accountId = account.id;
          await pool.query(
            `UPDATE academy_instructors
                SET stripe_account_id = $2,
                    onboarding_status = 'pending'
              WHERE id = $1::uuid`,
            [id, accountId],
          );
        }

        const base = getReturnBaseUrl();
        let accountLink: Stripe.AccountLink;
        try {
          accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${base}/admin?academy_onboarding_refresh=${id}`,
            return_url: `${base}/admin?academy_onboarding_complete=${id}`,
            type: "account_onboarding",
          });
        } catch (stripeErr) {
          const message =
            stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
          console.error(
            "[admin-academy] stripe account link create failed:",
            stripeErr,
          );
          return res.status(502).json({
            error: "stripe_account_link_failed",
            message,
          });
        }

        return res.json({
          onboardingUrl: accountLink.url,
          expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
          accountId,
        });
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({
            error: "instructors_table_missing",
            message: "Migrasjon 243/255 må kjøres først",
          });
        }
        console.error("[admin-academy] onboarding-link failed:", err);
        return res
          .status(500)
          .json({ error: "Could not create onboarding link" });
      }
    },
  );

  // ─── GET /api/admin/academy/instructors/:id/onboarding-status ─
  // Henter fresh status fra Stripe og oppdaterer DB med
  // payouts_enabled, charges_enabled, requirements.currently_due.
  // Returnerer full status + Stripe Account-objektet.
  app.get(
    "/api/admin/academy/instructors/:id/onboarding-status",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      const id = readString(req.params.id);
      if (!id) return res.status(400).json({ error: "missing_instructor_id" });

      try {
        const row = await pool.query<{
          stripe_account_id: string | null;
          onboarding_status: string | null;
          onboarding_completed_at: Date | string | null;
          payouts_enabled: boolean | null;
          charges_enabled: boolean | null;
          requirements_currently_due: string[] | null;
        }>(
          `SELECT stripe_account_id, onboarding_status,
                  onboarding_completed_at, payouts_enabled, charges_enabled,
                  requirements_currently_due
             FROM academy_instructors WHERE id = $1::uuid`,
          [id],
        );
        if (row.rowCount === 0) {
          return res.status(404).json({ error: "instructor_not_found" });
        }
        const local = row.rows[0];
        if (!local.stripe_account_id) {
          return res.json({
            status: "not_started",
            payoutsEnabled: false,
            chargesEnabled: false,
            requirementsCurrentlyDue: [],
            onboardingCompletedAt: null,
            stripeAccountId: null,
            stripeSynced: false,
          });
        }

        const stripe = getStripeClient();
        if (!stripe) {
          // Returner DB-state uten å sync mot Stripe.
          return res.json({
            status: local.onboarding_status ?? "pending",
            payoutsEnabled: !!local.payouts_enabled,
            chargesEnabled: !!local.charges_enabled,
            requirementsCurrentlyDue: local.requirements_currently_due ?? [],
            onboardingCompletedAt: toIsoOrNull(local.onboarding_completed_at),
            stripeAccountId: local.stripe_account_id,
            stripeSynced: false,
            warning: "stripe_not_configured",
          });
        }

        let account: Stripe.Account;
        try {
          account = await stripe.accounts.retrieve(local.stripe_account_id);
        } catch (stripeErr) {
          const message =
            stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
          console.error(
            "[admin-academy] stripe accounts.retrieve failed:",
            stripeErr,
          );
          return res.status(502).json({
            error: "stripe_account_retrieve_failed",
            message,
          });
        }

        const payoutsEnabled = !!account.payouts_enabled;
        const chargesEnabled = !!account.charges_enabled;
        const currentlyDue = (account.requirements?.currently_due ??
          []) as string[];
        const disabled = !!account.requirements?.disabled_reason;
        const newStatus = payoutsEnabled
          ? "enabled"
          : disabled
            ? "restricted"
            : "pending";

        await pool.query(
          `UPDATE academy_instructors
              SET payouts_enabled = $2,
                  charges_enabled = $3,
                  requirements_currently_due = $4,
                  onboarding_status = $5,
                  onboarding_completed_at = COALESCE(
                    onboarding_completed_at,
                    CASE WHEN $2 = TRUE THEN now() ELSE NULL END
                  )
            WHERE id = $1::uuid`,
          [id, payoutsEnabled, chargesEnabled, currentlyDue, newStatus],
        );

        return res.json({
          status: newStatus,
          payoutsEnabled,
          chargesEnabled,
          requirementsCurrentlyDue: currentlyDue,
          detailsSubmitted: !!account.details_submitted,
          disabledReason: account.requirements?.disabled_reason ?? null,
          stripeAccountId: local.stripe_account_id,
          stripeSynced: true,
        });
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({
            error: "instructors_table_missing",
            message: "Migrasjon 243/255 må kjøres først",
          });
        }
        console.error("[admin-academy] onboarding-status failed:", err);
        return res
          .status(500)
          .json({ error: "Could not fetch onboarding status" });
      }
    },
  );

  // ─── POST /api/admin/academy/enrollments ─────────────────────
  // Demo-endepunkt for å registrere enrollment med revenue-split.
  // Normalt opprettes enrollments via Stripe Checkout-flow + webhook,
  // men dette gir admin/test-suite en eksplisitt entry-point.
  //
  // Body: { courseId, userId, priceNok, stripePaymentIntentId?, stripeChargeId? }
  // Returnerer enrollment-rad m/ platform_fee_nok + instructor_revenue_nok.
  app.post("/api/admin/academy/enrollments", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const courseId = readString(body.courseId);
    const userId = readString(body.userId);
    const priceNok = readInteger(body.priceNok);
    const stripePaymentIntentId = readString(body.stripePaymentIntentId);
    const stripeChargeId = readString(body.stripeChargeId);

    if (!courseId || !userId || priceNok === null || priceNok < 0) {
      return res.status(400).json({
        error: "missing_fields",
        required: ["courseId", "userId", "priceNok"],
      });
    }

    try {
      // Slå opp instructor via course → for å avgjøre Stripe-konto.
      const courseResult = await pool.query<{
        instructor_id: string | null;
        revenue_share: string | null;
      }>(
        `SELECT c.instructor_id::text AS instructor_id,
                i.revenue_share::text  AS revenue_share
           FROM academy_courses c
           LEFT JOIN academy_instructors i ON i.id = c.instructor_id
          WHERE c.id = $1::uuid`,
        [courseId],
      );
      if (courseResult.rowCount === 0) {
        return res.status(404).json({ error: "course_not_found" });
      }
      const revenueSharePct = Number(courseResult.rows[0].revenue_share) || 80;
      const instructorRevenueNok = Math.round(
        (priceNok * revenueSharePct) / 100,
      );
      const platformFeeNok = priceNok - instructorRevenueNok;

      const insertResult = await pool.query<{
        id: string;
        course_id: string;
        user_id: string;
        amount_paid_nok: number;
        platform_fee_nok: number;
        instructor_revenue_nok: number;
        payout_status: string;
      }>(
        `INSERT INTO academy_enrollments
           (course_id, user_id, amount_paid_nok, platform_fee_nok,
            instructor_revenue_nok, stripe_payment_intent_id,
            stripe_charge_id, status, payout_status)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'active', 'pending')
         ON CONFLICT (course_id, user_id) DO UPDATE
            SET amount_paid_nok        = EXCLUDED.amount_paid_nok,
                platform_fee_nok       = EXCLUDED.platform_fee_nok,
                instructor_revenue_nok = EXCLUDED.instructor_revenue_nok,
                stripe_payment_intent_id = COALESCE(
                  EXCLUDED.stripe_payment_intent_id,
                  academy_enrollments.stripe_payment_intent_id
                ),
                stripe_charge_id = COALESCE(
                  EXCLUDED.stripe_charge_id,
                  academy_enrollments.stripe_charge_id
                )
         RETURNING id::text, course_id::text, user_id, amount_paid_nok,
                   platform_fee_nok, instructor_revenue_nok, payout_status`,
        [
          courseId,
          userId,
          priceNok,
          platformFeeNok,
          instructorRevenueNok,
          stripePaymentIntentId,
          stripeChargeId,
        ],
      );

      const enrollment = insertResult.rows[0];
      return res.json({
        success: true,
        enrollment: {
          id: enrollment.id,
          courseId: enrollment.course_id,
          userId: enrollment.user_id,
          amountPaidNok: enrollment.amount_paid_nok,
          platformFeeNok: enrollment.platform_fee_nok,
          instructorRevenueNok: enrollment.instructor_revenue_nok,
          payoutStatus: enrollment.payout_status,
          revenueSharePct,
        },
      });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        return res.status(503).json({
          error: "tables_missing",
          message: "Migrasjon 243/255 må kjøres først",
        });
      }
      console.error("[admin-academy] enrollment create failed:", err);
      return res.status(500).json({ error: "Could not create enrollment" });
    }
  });

  // ─── GET /api/admin/academy/transfers ────────────────────────
  // List Stripe-transfers JOIN'et med instructor-navn for admin-oversikt.
  // Filter: ?status=pending|in_transit|paid|failed|reversed
  app.get("/api/admin/academy/transfers", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const status = readString(req.query.status);
    const limit = readLimit(req.query.limit, 50, 500);
    const params: unknown[] = [];
    let whereClause = "";
    if (status) {
      params.push(status);
      whereClause = `WHERE t.status = $${params.length}`;
    }
    params.push(limit);

    try {
      const result = await pool.query<{
        id: string;
        payout_id: string | null;
        stripe_transfer_id: string;
        instructor_id: string;
        instructor_name: string | null;
        amount_nok: number;
        destination_account_id: string;
        status: string;
        failure_code: string | null;
        failure_message: string | null;
        initiated_by: string | null;
        initiated_at: Date | string;
        completed_at: Date | string | null;
        reversed_at: Date | string | null;
      }>(
        `SELECT t.id::text                    AS id,
                t.payout_id::text             AS payout_id,
                t.stripe_transfer_id          AS stripe_transfer_id,
                t.instructor_id::text         AS instructor_id,
                i.display_name                AS instructor_name,
                t.amount_nok,
                t.destination_account_id,
                t.status,
                t.failure_code,
                t.failure_message,
                t.initiated_by,
                t.initiated_at,
                t.completed_at,
                t.reversed_at
           FROM academy_transfers t
           LEFT JOIN academy_instructors i ON i.id = t.instructor_id
           ${whereClause}
           ORDER BY t.initiated_at DESC
           LIMIT $${params.length}`,
        params,
      );
      const transfers = result.rows.map((row) => ({
        id: row.id,
        payoutId: row.payout_id,
        stripeTransferId: row.stripe_transfer_id,
        instructorId: row.instructor_id,
        instructorName: row.instructor_name,
        amountNok: row.amount_nok,
        destinationAccountId: row.destination_account_id,
        status: row.status,
        failureCode: row.failure_code,
        failureMessage: row.failure_message,
        initiatedBy: row.initiated_by,
        initiatedAt: toIsoOrNull(row.initiated_at),
        completedAt: toIsoOrNull(row.completed_at),
        reversedAt: toIsoOrNull(row.reversed_at),
      }));
      return res.json({ transfers, total: transfers.length });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        return res.json({ transfers: [], total: 0, tableMissing: true });
      }
      console.error("[admin-academy] transfers list failed:", err);
      return res.status(500).json({ error: "Could not fetch transfers" });
    }
  });
}
