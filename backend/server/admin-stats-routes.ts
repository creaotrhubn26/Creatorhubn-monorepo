/**
 * admin-stats-routes.ts
 *
 * Setup-funksjon for de 5 stats/analytics-overview-endpointene under
 * /api/admin/ som leverer aggregert telemetri til admin-dashboardet.
 *
 * 5 endpoints:
 *   GET /api/admin/platform-stats              — top-level KPIs (users, revenue, signups)
 *   GET /api/admin/profession-stats            — per-yrkesgruppe-metrics
 *   GET /api/admin/dashboard                   — kombinert quick-stats
 *   GET /api/admin/email-conversion-stats      — invite-flow funnel
 *   GET /api/admin/academy/analytics/overview  — academy revenue/enrollments
 *
 * Alle krever `requireAdminSession`. Pure read-only — ingen state-mutasjon.
 * Modulen er pass-through på 13 deps (alle aggregat-helpers blir værende
 * i index.ts).
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminStatsRoutesDeps {
  app: express.Application;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
  hasTable: (tableName: string) => Promise<boolean>;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  queryExistingTableRows: (tableName: string, sql: string, params?: any[]) => Promise<any[]>;
  getAdminStatsTimeWindow: (days: number) => any;
  listAdminStatsUsers: () => Promise<any[]>;
  listAdminStatsProjectRows: () => Promise<any[]>;
  listAdminInvitePaymentRows: () => Promise<any[]>;
  getAdminAcademyRevenueSnapshot: () => Promise<any>;
  getAdminSystemHealthSnapshot: () => Promise<any>;
  getAdminCrmOverview: () => Promise<any>;
  getAdminSubscriptionSnapshot: () => Promise<any>;
  initializeAdminStatsProfessionBreakdown: () => Record<string, number>;
  initializeAdminStatsProfessionMetrics: () => Record<string, { activeProjects: number; totalRevenue: number }>;
  isDateWithinWindow: (date: any, start: Date, endExclusive: Date) => boolean;
  roundAdminMetric: (value: number, decimals?: number) => number;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminStatsRoutes(deps: AdminStatsRoutesDeps): void {
  const {
    app,
    requireAdminSession,
    hasTable,
    getTableColumns,
    queryExistingTableRows,
    getAdminStatsTimeWindow,
    listAdminStatsUsers,
    listAdminStatsProjectRows,
    listAdminInvitePaymentRows,
    getAdminAcademyRevenueSnapshot,
    getAdminSystemHealthSnapshot,
    getAdminCrmOverview,
    getAdminSubscriptionSnapshot,
    initializeAdminStatsProfessionBreakdown,
    initializeAdminStatsProfessionMetrics,
    isDateWithinWindow,
    roundAdminMetric,
  } = deps;

  app.get("/api/admin/platform-stats", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const window = getAdminStatsTimeWindow(30);
      const [
        statsUsers,
        projectRows,
        invitePaymentRows,
        academyRevenue,
        systemHealth,
      ] = await Promise.all([
        listAdminStatsUsers(),
        listAdminStatsProjectRows(),
        listAdminInvitePaymentRows(),
        getAdminAcademyRevenueSnapshot(),
        getAdminSystemHealthSnapshot(),
      ]);

      const professionBreakdown = initializeAdminStatsProfessionBreakdown();
      for (const user of statsUsers) {
        if (user.profession) {
          professionBreakdown[user.profession] += 1;
        }
      }

      const totalUsersCurrent = statsUsers.length;
      const totalUsersPrevious = statsUsers.filter(
        (user) =>
          user.createdAt && user.createdAt.getTime() < window.currentStart.getTime(),
      ).length;

      const newSignupsCurrent = statsUsers.filter((user) =>
        isDateWithinWindow(user.createdAt, window.currentStart, window.endExclusive),
      ).length;
      const newSignupsPrevious = statsUsers.filter((user) =>
        isDateWithinWindow(user.createdAt, window.previousStart, window.currentStart),
      ).length;

      const activeProjectsCurrent = projectRows.filter((row) => row.isActive).length;
      const activeProjectsPrevious = projectRows.filter(
        (row) =>
          row.isActive &&
          row.createdAt &&
          row.createdAt.getTime() < window.currentStart.getTime(),
      ).length;

      const creatorRevenueCurrent = invitePaymentRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );
      const creatorRevenuePrevious = invitePaymentRows
        .filter(
          (row) => row.paidAt && row.paidAt.getTime() < window.currentStart.getTime(),
        )
        .reduce((sum, row) => sum + row.amount, 0);
      const academyRevenueCurrent = academyRevenue.totalRevenue;
      const academyRevenuePrevious = academyRevenue.rows
        .filter(
          (row: { createdAt?: Date }) =>
            row.createdAt && row.createdAt.getTime() < window.currentStart.getTime(),
        )
        .reduce((sum: number, row: { amount: number }) => sum + row.amount, 0);

      res.json({
        totalUsers: {
          current: totalUsersCurrent,
          previous: totalUsersPrevious,
        },
        activeProjects: {
          current: activeProjectsCurrent,
          previous: activeProjectsPrevious,
        },
        totalRevenue: {
          current: roundAdminMetric(creatorRevenueCurrent + academyRevenueCurrent, 2),
          previous: roundAdminMetric(
            creatorRevenuePrevious + academyRevenuePrevious,
            2,
          ),
        },
        newSignups: {
          current: newSignupsCurrent,
          previous: newSignupsPrevious,
        },
        professionBreakdown,
        systemHealth,
      });
    } catch (error) {
      console.error("Admin platform stats error:", error);
      res.status(500).json({ error: "Could not fetch platform stats" });
    }
  });

  app.get("/api/admin/profession-stats", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const [projectRows, invitePaymentRows] = await Promise.all([
        listAdminStatsProjectRows(),
        listAdminInvitePaymentRows(),
      ]);

      const metrics = initializeAdminStatsProfessionMetrics();

      for (const row of projectRows) {
        if (row.isActive && row.profession) {
          metrics[row.profession].activeProjects += 1;
        }
      }

      for (const row of invitePaymentRows) {
        if (row.profession) {
          metrics[row.profession].totalRevenue = roundAdminMetric(
            metrics[row.profession].totalRevenue + row.amount,
            2,
          );
        }
      }

      res.json(metrics);
    } catch (error) {
      console.error("Admin profession stats error:", error);
      res.status(500).json({ error: "Could not fetch profession stats" });
    }
  });

  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const [crmOverview, subscriptionSnapshot] = await Promise.all([
        getAdminCrmOverview(),
        getAdminSubscriptionSnapshot(),
      ]);

      res.json({
        dashboard: {
          quickStats: {
            totalCustomers: crmOverview?.totalCustomers || 0,
            totalRevenue: crmOverview?.wonRevenue || 0,
            activeDeals: crmOverview?.activeDeals || 0,
            activeSubscriptions: subscriptionSnapshot.activeSubscriptions,
            subscriptionBreakdown: subscriptionSnapshot.breakdown,
          },
        },
      });
    } catch (error) {
      console.error("Admin dashboard overview error:", error);
      res.status(500).json({ error: "Could not fetch dashboard overview" });
    }
  });

  app.get("/api/admin/email-conversion-stats", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      if (!(await hasTable("invite_requests"))) {
        return res.json({
          totalSent: 0,
          avgOpenRate: 0,
          avgClickRate: 0,
          avgConversionRate: 0,
        });
      }

      const inviteColumns = await getTableColumns("invite_requests");
      const rows = await queryExistingTableRows(
        "invite_requests",
        `SELECT COUNT(*) FILTER (
                  WHERE ${
                    inviteColumns.has("invite_sent_at")
                      ? "invite_sent_at IS NOT NULL"
                      : "FALSE"
                  }
                )::int AS total_sent,
                COUNT(*) FILTER (
                  WHERE ${
                    inviteColumns.has("invite_email_opened_at")
                      ? "invite_email_opened_at IS NOT NULL"
                      : "FALSE"
                  }
                )::int AS opened,
                COUNT(*) FILTER (
                  WHERE ${
                    inviteColumns.has("invite_link_clicked_at")
                      ? "invite_link_clicked_at IS NOT NULL"
                      : "FALSE"
                  }
                )::int AS clicked,
                COUNT(*) FILTER (
                  WHERE ${
                    inviteColumns.has("payment_completed")
                      ? "payment_completed = TRUE"
                      : "FALSE"
                  }
                  OR ${
                    inviteColumns.has("onboarding_completed_at")
                      ? "onboarding_completed_at IS NOT NULL"
                      : "FALSE"
                  }
                )::int AS converted
           FROM invite_requests`,
      );

      const totalSent = Number(rows[0]?.total_sent || 0);
      const opened = Number(rows[0]?.opened || 0);
      const clicked = Number(rows[0]?.clicked || 0);
      const converted = Number(rows[0]?.converted || 0);

      res.json({
        totalSent,
        avgOpenRate: totalSent > 0 ? roundAdminMetric((opened / totalSent) * 100) : 0,
        avgClickRate: totalSent > 0 ? roundAdminMetric((clicked / totalSent) * 100) : 0,
        avgConversionRate:
          totalSent > 0 ? roundAdminMetric((converted / totalSent) * 100) : 0,
      });
    } catch (error) {
      console.error("Admin email conversion stats error:", error);
      res.status(500).json({ error: "Could not fetch email conversion stats" });
    }
  });

  app.get("/api/admin/academy/analytics/overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const overview = await getAdminAcademyRevenueSnapshot();
      const totalCoursesRows = await queryExistingTableRows(
        "courses",
        `SELECT COUNT(*)::int AS total_courses,
                COUNT(*) FILTER (WHERE COALESCE(is_published, FALSE) = TRUE)::int AS published_courses,
                COUNT(DISTINCT instructor)::int AS total_instructors
           FROM courses`,
      );

      res.json({
        totalCourses: Number(totalCoursesRows[0]?.total_courses || 0),
        publishedCourses: Number(totalCoursesRows[0]?.published_courses || 0),
        totalEnrollments: overview.totalEnrollments,
        totalInstructors: Number(totalCoursesRows[0]?.total_instructors || 0),
        totalRevenue: overview.totalRevenue,
      });
    } catch (error) {
      console.error("Admin academy analytics overview error:", error);
      res.status(500).json({ error: "Could not fetch academy analytics overview" });
    }
  });
}
