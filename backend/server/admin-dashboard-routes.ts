/**
 * admin-dashboard-routes.ts
 *
 * Setup-funksjon for 15 admin-dashboard read-only-endpoints: activity-
 * feed, analytics, audit, system-health, integrations, security og
 * automations.
 *
 * Endpoints:
 *   GET /api/admin/activity-feed                    — filtered feed
 *   GET /api/admin/activity-feed/export             — CSV export
 *   GET /api/admin/pending-counts                   — invite/feedback/bugs
 *   GET /api/admin/crm/overview                     — CRM KPIs
 *   GET /api/admin/billing/overview                 — subscription totals
 *   GET /api/admin/analytics/cancellations          — cancel analytics
 *   GET /api/admin/analytics/refunds                — refund analytics
 *   GET /api/admin/analytics/revenue-trends         — revenue trends
 *   GET /api/admin/analytics/churn-rate             — churn analytics
 *   GET /api/admin/analytics/platform               — platform-wide events
 *   GET /api/admin/audit/recent                     — recent audit-feed
 *   GET /api/admin/system/health                    — health snapshot
 *   GET /api/admin/integrations/status              — integrations status
 *   GET /api/admin/security/status                  — security counts
 *   GET /api/admin/automations/status               — automation rules
 *
 * Alle krever `requireAdminSession`. Read-only — ingen state-mutasjon.
 * Pass-through på 21 deps.
 */

import type express from "express";

import { readNumber, readString } from "./_shared";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminDashboardRoutesDeps {
  app: express.Application;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
  activeSessions: Map<string, any>;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  queryExistingTableRows: (tableName: string, sql: string, params?: any[]) => Promise<any[]>;
  buildAdminActivityFeedItems: () => Promise<any[]>;
  toAdminStatsDate: (value: any) => Date | null;
  escapeAdminCsv: (value: any) => string;
  getAdminCrmOverview: () => Promise<any>;
  getAdminSubscriptionSnapshot: () => Promise<any>;
  listAdminInvitePaymentRows: () => Promise<any[]>;
  getAdminAcademyRevenueSnapshot: () => Promise<any>;
  parseAdminDashboardRange: (value: any) => any;
  getAdminCancellationAnalytics: (range: any) => Promise<any>;
  getAdminRefundAnalytics: (range: any, statusFilter: any) => Promise<any>;
  getAdminRevenueTrendAnalytics: (range: any) => Promise<any>;
  getAdminChurnAnalytics: (range: any) => Promise<any>;
  parseCreatorhubAnalyticsRange: (value: any) => any;
  listCreatorhubAnalyticsUsers: () => Promise<any[]>;
  listCreatorhubAnalyticsEvents: () => Promise<any[]>;
  buildCreatorhubAnalyticsAggregate: (users: any[], events: any[], start: Date, endEx: Date) => any;
  getAdminSystemHealthSnapshot: () => Promise<any>;
  listAdminUsersSnapshot: () => Promise<any[]>;
  toAdminString: (value: any) => string | null;
  roundAdminMetric: (value: number, decimals?: number) => number;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminDashboardRoutes(deps: AdminDashboardRoutesDeps): void {
  const {
    app,
    requireAdminSession,
    activeSessions,
    getTableColumns,
    queryExistingTableRows,
    buildAdminActivityFeedItems,
    toAdminStatsDate,
    escapeAdminCsv,
    getAdminCrmOverview,
    getAdminSubscriptionSnapshot,
    listAdminInvitePaymentRows,
    getAdminAcademyRevenueSnapshot,
    parseAdminDashboardRange,
    getAdminCancellationAnalytics,
    getAdminRefundAnalytics,
    getAdminRevenueTrendAnalytics,
    getAdminChurnAnalytics,
    parseCreatorhubAnalyticsRange,
    listCreatorhubAnalyticsUsers,
    listCreatorhubAnalyticsEvents,
    buildCreatorhubAnalyticsAggregate,
    getAdminSystemHealthSnapshot,
    listAdminUsersSnapshot,
    toAdminString,
    roundAdminMetric,
  } = deps;

  app.get("/api/admin/activity-feed", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const typeFilter = (readString(req.query.type) || "all").toLowerCase();
      const limit = Math.min(Math.max(readNumber(req.query.limit) || 20, 1), 200);
      const search = (readString(req.query.search) || "").toLowerCase();
      const startDate = toAdminStatsDate(req.query.startDate);
      const endDate = toAdminStatsDate(req.query.endDate);
      const category = (readString(req.query.category) || "all").toLowerCase();
      const priority = (readString(req.query.priority) || "all").toLowerCase();

      let activities = await buildAdminActivityFeedItems();

      activities = activities.filter((activity) => {
        if (typeFilter !== "all" && activity.type !== typeFilter) {
          return false;
        }

        if (category !== "all" && (activity.category || "").toLowerCase() !== category) {
          return false;
        }

        if (priority !== "all" && (activity.priority || "").toLowerCase() !== priority) {
          return false;
        }

        const timestamp = toAdminStatsDate(activity.timestamp);
        if (startDate && (!timestamp || timestamp.getTime() < startDate.getTime())) {
          return false;
        }
        if (endDate) {
          const endExclusive = new Date(endDate);
          endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
          if (!timestamp || timestamp.getTime() >= endExclusive.getTime()) {
            return false;
          }
        }

        if (!search) {
          return true;
        }

        const haystack = [
          activity.title,
          activity.description,
          activity.user.name,
          activity.user.email,
          activity.user.profession,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      });

      res.json({
        activities: activities.slice(0, limit),
        total: activities.length,
        hasMore: activities.length > limit,
      });
    } catch (error) {
      console.error("Admin activity feed error:", error);
      res.status(500).json({ error: "Could not fetch activity feed" });
    }
  });

  app.get("/api/admin/activity-feed/export", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const items = await buildAdminActivityFeedItems();
      const typeFilter = (readString(req.query.type) || "all").toLowerCase();
      const category = (readString(req.query.category) || "all").toLowerCase();
      const priority = (readString(req.query.priority) || "all").toLowerCase();
      const startDate = toAdminStatsDate(req.query.startDate);
      const endDate = toAdminStatsDate(req.query.endDate);

      const filtered = items.filter((activity) => {
        if (typeFilter !== "all" && activity.type !== typeFilter) {
          return false;
        }
        if (category !== "all" && (activity.category || "").toLowerCase() !== category) {
          return false;
        }
        if (priority !== "all" && (activity.priority || "").toLowerCase() !== priority) {
          return false;
        }
        const timestamp = toAdminStatsDate(activity.timestamp);
        if (startDate && (!timestamp || timestamp.getTime() < startDate.getTime())) {
          return false;
        }
        if (endDate) {
          const endExclusive = new Date(endDate);
          endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
          if (!timestamp || timestamp.getTime() >= endExclusive.getTime()) {
            return false;
          }
        }
        return true;
      });

      const header = [
        "timestamp",
        "type",
        "title",
        "description",
        "user_name",
        "user_email",
        "profession",
        "status",
        "priority",
        "category",
      ];
      const lines = [
        header.join(","),
        ...filtered.map((activity) =>
          [
            activity.timestamp,
            activity.type,
            activity.title,
            activity.description,
            activity.user.name,
            activity.user.email,
            activity.user.profession || "",
            activity.status || "",
            activity.priority || "",
            activity.category || "",
          ]
            .map(escapeAdminCsv)
            .join(","),
        ),
      ];

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="admin-activity-feed-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      );
      res.send(lines.join("\n"));
    } catch (error) {
      console.error("Admin activity export error:", error);
      res.status(500).json({ error: "Could not export activity feed" });
    }
  });

  app.get("/api/admin/pending-counts", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const inviteRows = await queryExistingTableRows(
        "invite_requests",
        `SELECT COUNT(*) FILTER (
                  WHERE LOWER(COALESCE(status, 'pending')) = 'pending'
                )::int AS invite_requests
           FROM invite_requests`,
      );
      const feedbackRows = await queryExistingTableRows(
        "prototype_feedback",
        `SELECT COUNT(*) FILTER (
                  WHERE LOWER(COALESCE(status, 'pending')) NOT IN ('resolved', 'closed')
                )::int AS prototype_feedback,
                COUNT(*) FILTER (
                  WHERE LOWER(COALESCE(feedback_type, 'general')) = 'bug_report'
                    AND LOWER(COALESCE(status, 'pending')) NOT IN ('resolved', 'closed')
                )::int AS bug_reports
           FROM prototype_feedback`,
      );

      const inviteRequests = Number(inviteRows[0]?.invite_requests || 0);
      const prototypeFeedback = Number(feedbackRows[0]?.prototype_feedback || 0);
      const bugReports = Number(feedbackRows[0]?.bug_reports || 0);

      res.json({
        total: inviteRequests + prototypeFeedback,
        inviteRequests,
        prototypeFeedback,
        bugReports,
      });
    } catch (error) {
      console.error("Admin pending counts error:", error);
      res.status(500).json({ error: "Could not fetch pending counts" });
    }
  });

  app.get("/api/admin/crm/overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      res.json((await getAdminCrmOverview()) || {
        totalCustomers: 0,
        recentCustomers: 0,
        activeDeals: 0,
        wonRevenue: 0,
        pendingTasks: 0,
      });
    } catch (error) {
      console.error("Admin CRM overview error:", error);
      res.status(500).json({ error: "Could not fetch CRM overview" });
    }
  });

  app.get("/api/admin/billing/overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const [subscriptionSnapshot, invitePayments, academyRevenue] = await Promise.all([
        getAdminSubscriptionSnapshot(),
        listAdminInvitePaymentRows(),
        getAdminAcademyRevenueSnapshot(),
      ]);

      res.json({
        activeSubscriptions: subscriptionSnapshot.activeSubscriptions,
        subscriptionBreakdown: subscriptionSnapshot.breakdown,
        creatorRevenue: roundAdminMetric(
          invitePayments.reduce((sum: number, row: any) => sum + row.amount, 0),
          2,
        ),
        academyRevenue: academyRevenue.totalRevenue,
        totalRevenue: roundAdminMetric(
          invitePayments.reduce((sum: number, row: any) => sum + row.amount, 0) +
            academyRevenue.totalRevenue,
          2,
        ),
      });
    } catch (error) {
      console.error("Admin billing overview error:", error);
      res.status(500).json({ error: "Could not fetch billing overview" });
    }
  });

  app.get("/api/admin/analytics/cancellations", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const range = parseAdminDashboardRange(req.query.dateRange);
      const cancellations = await getAdminCancellationAnalytics(range);

      res.json({
        data: {
          totalCancellations: cancellations.totalCancellations,
          cancellationReasons: cancellations.reasonBreakdown,
          reasonBreakdown: cancellations.reasonBreakdown,
          planBreakdown: cancellations.planBreakdown,
        },
      });
    } catch (error) {
      console.error("Admin cancellation analytics error:", error);
      res.status(500).json({ error: "Could not fetch cancellation analytics" });
    }
  });

  app.get("/api/admin/analytics/refunds", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const range = parseAdminDashboardRange(req.query.dateRange);
      const rawStatus =
        typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "all";
      const statusFilter =
        rawStatus === "pending" || rawStatus === "approved" || rawStatus === "rejected"
          ? rawStatus
          : "all";
      const refunds = await getAdminRefundAnalytics(range, statusFilter);

      res.json({
        data: {
          totalRequests: refunds.totalRequests,
          approved: refunds.approved,
          pending: refunds.pending,
          rejected: refunds.rejected,
          totalRefunded: refunds.totalRefunded,
          avgRefundAmount: refunds.avgRefundAmount,
        },
      });
    } catch (error) {
      console.error("Admin refund analytics error:", error);
      res.status(500).json({ error: "Could not fetch refund analytics" });
    }
  });

  app.get("/api/admin/analytics/revenue-trends", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const range = parseAdminDashboardRange(req.query.dateRange);
      const revenue = await getAdminRevenueTrendAnalytics(range);

      res.json({
        data: revenue,
      });
    } catch (error) {
      console.error("Admin revenue trends analytics error:", error);
      res.status(500).json({ error: "Could not fetch revenue trends" });
    }
  });

  app.get("/api/admin/analytics/churn-rate", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const range = parseAdminDashboardRange(req.query.dateRange);
      const churn = await getAdminChurnAnalytics(range);

      res.json({
        data: churn,
      });
    } catch (error) {
      console.error("Admin churn analytics error:", error);
      res.status(500).json({ error: "Could not fetch churn analytics" });
    }
  });

  app.get("/api/admin/analytics/platform", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const range = parseCreatorhubAnalyticsRange(
        req.query.startDate ?? req.query.range,
      );
      const [users, events] = await Promise.all([
        listCreatorhubAnalyticsUsers(),
        listCreatorhubAnalyticsEvents(),
      ]);

      const aggregate = buildCreatorhubAnalyticsAggregate(
        users,
        events,
        range.startInclusive,
        range.endExclusive,
      );

      res.json({
        range: {
          key: range.key,
          label: range.label,
          days: range.days,
        },
        summary: aggregate.summary,
        eventTypes: aggregate.eventTypes.slice(0, 5),
        topPages: aggregate.topPages.slice(0, 5),
        sources: aggregate.sources.slice(0, 5),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Admin analytics platform error:", error);
      res.status(500).json({ error: "Could not fetch analytics platform overview" });
    }
  });

  app.get("/api/admin/audit/recent", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const activities = await buildAdminActivityFeedItems();
      res.json(
        activities.slice(0, 12).map((activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          status: activity.status || null,
          category: activity.category || null,
          priority: activity.priority || null,
          timestamp: activity.timestamp,
        })),
      );
    } catch (error) {
      console.error("Admin audit recent error:", error);
      res.status(500).json({ error: "Could not fetch recent audit events" });
    }
  });

  app.get("/api/admin/system/health", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      res.json(await getAdminSystemHealthSnapshot());
    } catch (error) {
      console.error("Admin system health error:", error);
      res.status(500).json({ error: "Could not fetch system health" });
    }
  });

  app.get("/api/admin/integrations/status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const userColumns = await getTableColumns("users");
      const googleWorkspaceExpr = userColumns.has("google_workspace_connected")
        ? "COALESCE(google_workspace_connected, FALSE) = TRUE"
        : "FALSE";
      const googleDriveExpr = userColumns.has("google_drive_connected")
        ? "COALESCE(google_drive_connected, FALSE) = TRUE"
        : "FALSE";
      const googleCalendarExpr = userColumns.has("google_calendar_connected")
        ? "COALESCE(google_calendar_connected, FALSE) = TRUE"
        : "FALSE";
      const gmailExpr = userColumns.has("gmail_connected")
        ? "COALESCE(gmail_connected, FALSE) = TRUE"
        : "FALSE";

      const userRows = await queryExistingTableRows(
        "users",
        `SELECT COUNT(*) FILTER (WHERE ${googleWorkspaceExpr})::int AS google_workspace_users,
                COUNT(*) FILTER (WHERE ${googleDriveExpr})::int AS google_drive_users,
                COUNT(*) FILTER (WHERE ${googleCalendarExpr})::int AS google_calendar_users,
                COUNT(*) FILTER (WHERE ${gmailExpr})::int AS gmail_users
           FROM users`,
      );

      res.json({
        connectedUsers: {
          googleWorkspace: Number(userRows[0]?.google_workspace_users || 0),
          googleDrive: Number(userRows[0]?.google_drive_users || 0),
          googleCalendar: Number(userRows[0]?.google_calendar_users || 0),
          gmail: Number(userRows[0]?.gmail_users || 0),
        },
        environment: {
          stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
          googleAnalyticsConfigured: Boolean(
            process.env.GOOGLE_ANALYTICS_ID || process.env.VITE_GOOGLE_ANALYTICS_ID,
          ),
          googleTagManagerConfigured: Boolean(
            process.env.GOOGLE_TAG_MANAGER_ID || process.env.VITE_GOOGLE_TAG_MANAGER_ID,
          ),
          openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
        },
      });
    } catch (error) {
      console.error("Admin integrations status error:", error);
      res.status(500).json({ error: "Could not fetch integrations status" });
    }
  });

  app.get("/api/admin/security/status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const users = await listAdminUsersSnapshot();
      const unreadCriticalRows = await queryExistingTableRows(
        "admin_notifications",
        `SELECT COUNT(*) FILTER (
                  WHERE COALESCE(is_read, FALSE) = FALSE
                    AND LOWER(COALESCE(severity, 'info')) IN ('critical', 'error')
                )::int AS unread_critical
           FROM admin_notifications`,
      );

      const totalAdmins = users.filter((entry: any) => {
        const role = (toAdminString(entry.role) || "").toLowerCase();
        return role === "admin" || role === "super_admin";
      }).length;

      res.json({
        totalAdmins,
        activeSessions: activeSessions.size,
        unreadCriticalAlerts: Number(unreadCriticalRows[0]?.unread_critical || 0),
        localDevelopmentBypassEnabled: process.env.NODE_ENV !== "production",
      });
    } catch (error) {
      console.error("Admin security status error:", error);
      res.status(500).json({ error: "Could not fetch security status" });
    }
  });

  app.get("/api/admin/automations/status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const automationRows = await queryExistingTableRows(
        "automation_rules",
        `SELECT COUNT(*)::int AS total_rules,
                COUNT(*) FILTER (WHERE COALESCE(is_active, FALSE) = TRUE)::int AS active_rules
           FROM automation_rules`,
      );

      const totalRules = Number(automationRows[0]?.total_rules || 0);
      const activeRules = Number(automationRows[0]?.active_rules || 0);

      res.json({
        totalRules,
        activeRules,
        inactiveRules: Math.max(0, totalRules - activeRules),
      });
    } catch (error) {
      console.error("Admin automations status error:", error);
      res.status(500).json({ error: "Could not fetch automations status" });
    }
  });
}
