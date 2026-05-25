import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, isNotNull } from "drizzle-orm";
import * as schema from "../migrations/schema.js";
import { readString } from "./_shared";

type DateRange = { start: Date; end: Date };

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface AnalyticsRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  requireUserSession: (req: any, res: any) => any;
  requireAdminSession: (req: any, res: any) => any;
  parseCreatorhubAnalyticsRange: (value: unknown) => any;
  listCreatorhubAnalyticsUsers: () => Promise<any[]>;
  listCreatorhubAnalyticsEvents: () => Promise<any[]>;
  buildCreatorhubAnalyticsAggregate: (
    users: any[],
    events: any[],
    startInclusive: Date,
    endExclusive: Date,
  ) => any;
  normalizeEquipmentType: (raw?: string | null) => any;
  normalizeCondition: (raw?: string | null) => any;
  normalizeTaskType: (raw?: string | null) => any;
  normalizePriority: (raw?: string | null) => any;
  normalizeStatus: (raw?: string | null) => any;
  monthKey: (date: Date) => string;
  toAnalyticsDate: (value: unknown) => Date | null;
  toNumberValue: (value: unknown, fallback?: number) => number;
  toDateOrNull: (value: unknown) => Date | null;
  toIsoString: (value: unknown) => string | null;
  toDateOnly: (value: string | Date) => string;
}

export function setupAnalyticsRoutes(deps: AnalyticsRoutesDeps): void {
  const {
    app,
    pool,
    db,
    requireUserSession,
    requireAdminSession,
    parseCreatorhubAnalyticsRange,
    listCreatorhubAnalyticsUsers,
    listCreatorhubAnalyticsEvents,
    buildCreatorhubAnalyticsAggregate,
    normalizeEquipmentType,
    normalizeCondition,
    normalizeTaskType,
    normalizePriority,
    normalizeStatus,
    monthKey,
    toAnalyticsDate,
    toNumberValue,
    toDateOrNull,
    toIsoString,
    toDateOnly,
  } = deps;

  function calculateAnalyticsChange(current: number, previous: number): number {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  function parseRangeParam(range?: string | null): DateRange {
    const now = new Date();
    const match = range ? /^([0-9]+)([dmy])$/i.exec(range) : null;
    const value = match ? Number(match[1]) : 12;
    const unit = match ? match[2].toLowerCase() : "m";
    const start = new Date(now.getTime());
    if (unit === "d") {
      start.setDate(start.getDate() - value);
    } else if (unit === "y") {
      start.setFullYear(start.getFullYear() - value);
    } else {
      start.setMonth(start.getMonth() - value);
    }
    return { start, end: now };
  }

  function buildMonthlyBuckets(start: Date, end: Date) {
    const buckets: Array<{ key: string; label: string; date: Date }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endCursor) {
      const key = monthKey(cursor);
      const label = `${monthLabels[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`;
      buckets.push({ key, label, date: new Date(cursor.getTime()) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  function buildProjectFilter(userId?: string, profession?: string) {
    const hasUser = Boolean(userId);
    const hasProfession = Boolean(profession);
    if (hasUser && hasProfession) {
      return and(
        eq(schema.projects.userId, userId as string),
        eq(schema.projects.profession, profession as string),
      );
    }
    if (hasUser) return eq(schema.projects.userId, userId as string);
    if (hasProfession)
      return eq(schema.projects.profession, profession as string);
    return undefined;
  }

  function buildFeedbackFilter(userId?: string) {
    if (!userId) return undefined;
    return eq(schema.clientFeedbacks.userId, userId);
  }

  app.get("/api/analytics/overview", async (req, res) => {
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

      const currentAggregate = buildCreatorhubAnalyticsAggregate(
        users,
        events,
        range.startInclusive,
        range.endExclusive,
      );
      const previousAggregate = buildCreatorhubAnalyticsAggregate(
        users,
        events,
        range.previousStartInclusive,
        range.previousEndExclusive,
      );

      const latestEventAt = events.reduce<Date | null>((latest, row) => {
        const createdAt = toAnalyticsDate(row.created_at);
        if (!createdAt) return latest;
        if (!latest || createdAt.getTime() > latest.getTime()) {
          return createdAt;
        }
        return latest;
      }, null);

      const latestUserLoginAt = users.reduce<Date | null>((latest, row) => {
        const lastLoginAt = toAnalyticsDate(row.last_login_at);
        if (!lastLoginAt) return latest;
        if (!latest || lastLoginAt.getTime() > latest.getTime()) {
          return lastLoginAt;
        }
        return latest;
      }, null);

      const inviteAcceptanceRate =
        currentAggregate.summary.invitationsSent > 0
          ? Number(
              (
                (currentAggregate.summary.acceptedInvitations /
                  currentAggregate.summary.invitationsSent) *
                100
              ).toFixed(1),
            )
          : 0;

      const previousInviteAcceptanceRate =
        previousAggregate.summary.invitationsSent > 0
          ? Number(
              (
                (previousAggregate.summary.acceptedInvitations /
                  previousAggregate.summary.invitationsSent) *
                100
              ).toFixed(1),
            )
          : 0;

      const metric = (current: number, previous: number) => ({
        current,
        previous,
        change: calculateAnalyticsChange(current, previous),
      });

      const hasDataInRange =
        currentAggregate.summary.totalEvents > 0 ||
        currentAggregate.summary.newUsers > 0 ||
        currentAggregate.summary.activeCreators > 0;

      const daysSinceLatestEvent = latestEventAt
        ? Math.floor(
            (Date.now() - latestEventAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      res.json({
        range: {
          key: range.key,
          label: range.label,
          days: range.days,
          startDate: range.startInclusive.toISOString(),
          endDateExclusive: range.endExclusive.toISOString(),
        },
        freshness: {
          latestEventAt: latestEventAt?.toISOString() ?? null,
          latestUserLoginAt: latestUserLoginAt?.toISOString() ?? null,
          daysSinceLatestEvent,
          hasDataInRange,
          isStale: daysSinceLatestEvent !== null ? daysSinceLatestEvent > 14 : true,
        },
        summary: {
          totalUsers: metric(
            currentAggregate.summary.totalUsers,
            previousAggregate.summary.totalUsers,
          ),
          newUsers: metric(
            currentAggregate.summary.newUsers,
            previousAggregate.summary.newUsers,
          ),
          activeCreators: metric(
            currentAggregate.summary.activeCreators,
            previousAggregate.summary.activeCreators,
          ),
          totalEvents: metric(
            currentAggregate.summary.totalEvents,
            previousAggregate.summary.totalEvents,
          ),
          pageViews: metric(
            currentAggregate.summary.pageViews,
            previousAggregate.summary.pageViews,
          ),
          bookings: metric(
            currentAggregate.summary.bookings,
            previousAggregate.summary.bookings,
          ),
          invitationsSent: metric(
            currentAggregate.summary.invitationsSent,
            previousAggregate.summary.invitationsSent,
          ),
          acceptedInvitations: metric(
            currentAggregate.summary.acceptedInvitations,
            previousAggregate.summary.acceptedInvitations,
          ),
          inviteAcceptanceRate: metric(
            inviteAcceptanceRate,
            previousInviteAcceptanceRate,
          ),
        },
        eventTypes: currentAggregate.eventTypes,
        topPages: currentAggregate.topPages,
        sources: currentAggregate.sources,
        roles: currentAggregate.roles,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("CreatorHub analytics overview error:", error);
      res.status(500).json({ error: "Failed to load CreatorHub analytics overview" });
    }
  });

  app.get("/api/analytics/timeseries", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const range = parseCreatorhubAnalyticsRange(
        req.query.startDate ?? req.query.range,
      );
      const metricKeyRaw =
        typeof req.query.metric === "string" ? req.query.metric.trim() : "";

      const metricKey =
        metricKeyRaw === "newUsers" ||
        metricKeyRaw === "activeCreators" ||
        metricKeyRaw === "pageViews" ||
        metricKeyRaw === "bookings" ||
        metricKeyRaw === "invitationsSent" ||
        metricKeyRaw === "acceptedInvitations"
          ? metricKeyRaw
          : "totalEvents";

      const metricLabelMap = {
        totalEvents: "Hendelser",
        newUsers: "Nye brukere",
        activeCreators: "Aktive brukere",
        pageViews: "Sidevisninger",
        bookings: "Bookinger",
        invitationsSent: "Invitasjoner sendt",
        acceptedInvitations: "Invitasjoner akseptert",
      } as const;

      const [users, events] = await Promise.all([
        listCreatorhubAnalyticsUsers(),
        listCreatorhubAnalyticsEvents(),
      ]);

      const currentAggregate = buildCreatorhubAnalyticsAggregate(
        users,
        events,
        range.startInclusive,
        range.endExclusive,
      );
      const previousAggregate = buildCreatorhubAnalyticsAggregate(
        users,
        events,
        range.previousStartInclusive,
        range.previousEndExclusive,
      );

      const currentTotal = currentAggregate.summary[metricKey];
      const previousTotal = previousAggregate.summary[metricKey];

      res.json({
        metric: metricKey,
        label: metricLabelMap[metricKey],
        range: {
          key: range.key,
          label: range.label,
          days: range.days,
        },
        series: currentAggregate.timeseries.map((row: any) => ({
          date: row.date,
          value: row[metricKey],
        })),
        totals: {
          current: currentTotal,
          previous: previousTotal,
          change: calculateAnalyticsChange(currentTotal, previousTotal),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("CreatorHub analytics timeseries error:", error);
      res.status(500).json({ error: "Failed to load CreatorHub analytics timeseries" });
    }
  });

  // /api/seo-bot/* (8 endpoints) → ./seo-bot-routes.ts

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              updatedAt: schema.projects.updatedAt,
              status: schema.projects.status,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              updatedAt: schema.projects.updatedAt,
              status: schema.projects.status,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects));

      const completedStatuses = new Set([
        "completed",
        "done",
        "delivered",
        "archived",
      ]);

      const totalProjects = projectRows.length;
      const completedProjects = projectRows.filter((row) =>
        completedStatuses.has(String(row.status || "")),
      ).length;
      const activeProjects = projectRows.filter(
        (row) => !completedStatuses.has(String(row.status || "")),
      ).length;

      const totalRevenue = projectRows.reduce(
        (sum, row) => sum + toNumberValue(row.budget),
        0,
      );
      const averageProjectValue = totalProjects
        ? totalRevenue / totalProjects
        : 0;

      const clientNames = new Set(
        projectRows
          .map((row) => (row.clientName || "").trim())
          .filter((value) => value.length > 0),
      );

      res.json({
        totalProjects,
        activeProjects,
        completedProjects,
        totalRevenue,
        totalClients: clientNames.size,
        averageProjectValue,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Analytics summary error:", error);
      res.status(500).json({ error: "Failed to load analytics summary" });
    }
  });

  app.get("/api/analytics/revenue", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);
      const buckets = buildMonthlyBuckets(start, end);

      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
            })
            .from(schema.projects));

      const timeEntries = await db
        .select({
          projectId: schema.projectTimeTracking.projectId,
          hoursSpent: schema.projectTimeTracking.hoursSpent,
          billableHours: schema.projectTimeTracking.billableHours,
          rate: schema.projectTimeTracking.rate,
          dateWorked: schema.projectTimeTracking.dateWorked,
        })
        .from(schema.projectTimeTracking)
        .innerJoin(
          schema.integratedProjects,
          eq(schema.projectTimeTracking.projectId, schema.integratedProjects.id),
        )
        .where(eq(schema.integratedProjects.userId, userId));

      const maintenanceRows = await db
        .select({
          equipmentId: schema.equipmentMaintenance.equipmentId,
          cost: schema.equipmentMaintenance.cost,
          scheduledDate: schema.equipmentMaintenance.scheduledDate,
          completedDate: schema.equipmentMaintenance.completedDate,
          createdAt: schema.equipmentMaintenance.createdAt,
        })
        .from(schema.equipmentMaintenance)
        .where(eq(schema.equipmentMaintenance.userId, userId));

      const rentalRows = await db
        .select({
          rentalCost: schema.equipmentRentals.rentalCost,
          rentalStartDate: schema.equipmentRentals.rentalStartDate,
          rentalEndDate: schema.equipmentRentals.rentalEndDate,
        })
        .from(schema.equipmentRentals)
        .where(eq(schema.equipmentRentals.userId, userId));

      const metricsByMonth = new Map<
        string,
        { revenue: number; expenses: number; projectCount: number }
      >();
      buckets.forEach((bucket) => {
        metricsByMonth.set(bucket.key, {
          revenue: 0,
          expenses: 0,
          projectCount: 0,
        });
      });

      projectRows.forEach((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (!createdAt || createdAt < start || createdAt > end) return;
        const key = monthKey(createdAt);
        const metrics = metricsByMonth.get(key);
        if (!metrics) return;
        metrics.projectCount += 1;
        metrics.revenue += toNumberValue(row.budget);
      });

      timeEntries.forEach((row) => {
        const entryDate = toDateOrNull(row.dateWorked);
        if (!entryDate || entryDate < start || entryDate > end) return;
        const key = monthKey(entryDate);
        const metrics = metricsByMonth.get(key);
        if (!metrics) return;
        const billable = toNumberValue(
          row.billableHours,
          toNumberValue(row.hoursSpent),
        );
        metrics.revenue += billable * toNumberValue(row.rate);
      });

      maintenanceRows.forEach((row) => {
        const date =
          toDateOrNull(row.completedDate) ||
          toDateOrNull(row.scheduledDate) ||
          toDateOrNull(row.createdAt);
        if (!date || date < start || date > end) return;
        const key = monthKey(date);
        const metrics = metricsByMonth.get(key);
        if (!metrics) return;
        metrics.expenses += toNumberValue(row.cost);
      });

      rentalRows.forEach((row) => {
        const date =
          toDateOrNull(row.rentalStartDate) || toDateOrNull(row.rentalEndDate);
        if (!date || date < start || date > end) return;
        const key = monthKey(date);
        const metrics = metricsByMonth.get(key);
        if (!metrics) return;
        metrics.expenses += toNumberValue(row.rentalCost);
      });

      const response = buckets.map((bucket) => {
        const metrics = metricsByMonth.get(bucket.key) || {
          revenue: 0,
          expenses: 0,
          projectCount: 0,
        };
        return {
          month: bucket.label,
          revenue: Number(metrics.revenue.toFixed(2)),
          expenses: Number(metrics.expenses.toFixed(2)),
          profit: Number((metrics.revenue - metrics.expenses).toFixed(2)),
          projectCount: metrics.projectCount,
        };
      });

      res.json(response);
    } catch (error) {
      console.error("Analytics revenue error:", error);
      res.status(500).json({ error: "Failed to load revenue analytics" });
    }
  });

  app.get("/api/analytics/clients", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);
      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects));

      const clientMap = new Map<
        string,
        {
          name: string;
          totalSpent: number;
          projectCount: number;
          firstDate: Date | null;
          lastDate: Date | null;
        }
      >();

      projectRows.forEach((row) => {
        const name = (row.clientName || "Unknown").trim() || "Unknown";
        const createdAt = toDateOrNull(row.createdAt);
        const entry = clientMap.get(name) || {
          name,
          totalSpent: 0,
          projectCount: 0,
          firstDate: createdAt,
          lastDate: createdAt,
        };
        entry.totalSpent += toNumberValue(row.budget);
        entry.projectCount += 1;
        if (createdAt) {
          if (!entry.firstDate || createdAt < entry.firstDate)
            entry.firstDate = createdAt;
          if (!entry.lastDate || createdAt > entry.lastDate)
            entry.lastDate = createdAt;
        }
        clientMap.set(name, entry);
      });

      const totalClients = clientMap.size;
      const newClients = Array.from(clientMap.values()).filter(
        (client) =>
          client.firstDate &&
          client.firstDate >= start &&
          client.firstDate <= end,
      ).length;
      const retentionRate = totalClients
        ? (Array.from(clientMap.values()).filter(
            (client) => client.projectCount > 1,
          ).length /
            totalClients) *
          100
        : 0;

      const totalRevenue = Array.from(clientMap.values()).reduce(
        (sum, client) => sum + client.totalSpent,
        0,
      );
      const totalProjects = projectRows.length;
      const averageValue = totalProjects ? totalRevenue / totalProjects : 0;

      const topClients = Array.from(clientMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5)
        .map((client, index) => ({
          id: `${client.name}-${index}`,
          name: client.name,
          totalSpent: client.totalSpent,
          projectCount: client.projectCount,
        }));

      res.json({
        totalClients,
        newClients,
        retentionRate,
        averageValue,
        topClients,
      });
    } catch (error) {
      console.error("Client metrics error:", error);
      res.status(500).json({ error: "Failed to load client metrics" });
    }
  });

  app.get("/api/analytics/performance", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);
      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              updatedAt: schema.projects.updatedAt,
              status: schema.projects.status,
              budget: schema.projects.budget,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              updatedAt: schema.projects.updatedAt,
              status: schema.projects.status,
              budget: schema.projects.budget,
            })
            .from(schema.projects));

      const timeEntries = await db
        .select({
          projectId: schema.projectTimeTracking.projectId,
          hoursSpent: schema.projectTimeTracking.hoursSpent,
          billableHours: schema.projectTimeTracking.billableHours,
          rate: schema.projectTimeTracking.rate,
          dateWorked: schema.projectTimeTracking.dateWorked,
        })
        .from(schema.projectTimeTracking)
        .innerJoin(
          schema.integratedProjects,
          eq(schema.projectTimeTracking.projectId, schema.integratedProjects.id),
        )
        .where(eq(schema.integratedProjects.userId, userId));

      const feedbackFilter = buildFeedbackFilter(userId);
      const feedbackRows = feedbackFilter
        ? await db
            .select({
              rating: schema.clientFeedbacks.rating,
              createdAt: schema.clientFeedbacks.createdAt,
            })
            .from(schema.clientFeedbacks)
            .where(feedbackFilter)
        : [];

      const completedStatuses = new Set([
        "completed",
        "done",
        "delivered",
        "archived",
      ]);
      const totalProjects = projectRows.length;
      const completedProjects = projectRows.filter((row) =>
        completedStatuses.has(String(row.status || "")),
      ).length;
      const completionRate = totalProjects
        ? (completedProjects / totalProjects) * 100
        : 0;

      const deliveryDurations: number[] = [];
      projectRows.forEach((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        const updatedAt = toDateOrNull(row.updatedAt);
        if (!createdAt || !updatedAt) return;
        deliveryDurations.push(
          (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
      });
      const averageDeliveryTime = deliveryDurations.length
        ? deliveryDurations.reduce((sum, value) => sum + value, 0) /
          deliveryDurations.length
        : 0;

      const feedbackInRange = feedbackRows.filter((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        return createdAt && createdAt >= start && createdAt <= end;
      });
      const clientSatisfaction = feedbackInRange.length
        ? feedbackInRange.reduce(
            (sum, row) => sum + toNumberValue(row.rating),
            0,
          ) / feedbackInRange.length
        : 0;

      const totalRevenue = projectRows.reduce(
        (sum, row) => sum + toNumberValue(row.budget),
        0,
      );
      const totalBillable = timeEntries.reduce((sum, row) => {
        const billable = toNumberValue(
          row.billableHours,
          toNumberValue(row.hoursSpent),
        );
        return sum + billable * toNumberValue(row.rate);
      }, 0);
      const revenue = totalRevenue + totalBillable;

      const totalHours = timeEntries.reduce(
        (sum, row) => sum + toNumberValue(row.hoursSpent),
        0,
      );
      const billableHours = timeEntries.reduce(
        (sum, row) =>
          sum + toNumberValue(row.billableHours, toNumberValue(row.hoursSpent)),
        0,
      );
      const efficiency = totalHours ? (billableHours / totalHours) * 100 : 0;

      const prevStart = new Date(
        start.getTime() - (end.getTime() - start.getTime()),
      );
      const prevEnd = new Date(start.getTime());
      const prevProjectCount = projectRows.filter((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        return createdAt && createdAt >= prevStart && createdAt <= prevEnd;
      }).length;
      const currentProjectCount = projectRows.filter((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        return createdAt && createdAt >= start && createdAt <= end;
      }).length;
      const growthRate = prevProjectCount
        ? ((currentProjectCount - prevProjectCount) / prevProjectCount) * 100
        : currentProjectCount > 0
          ? 100
          : 0;

      const maintenanceRows = await db
        .select({ cost: schema.equipmentMaintenance.cost })
        .from(schema.equipmentMaintenance)
        .where(eq(schema.equipmentMaintenance.userId, userId));
      const rentalRows = await db
        .select({ rentalCost: schema.equipmentRentals.rentalCost })
        .from(schema.equipmentRentals)
        .where(eq(schema.equipmentRentals.userId, userId));
      const expenses =
        maintenanceRows.reduce((sum, row) => sum + toNumberValue(row.cost), 0) +
        rentalRows.reduce((sum, row) => sum + toNumberValue(row.rentalCost), 0);
      const profitMargin = revenue ? ((revenue - expenses) / revenue) * 100 : 0;

      res.json({
        completionRate: Number(completionRate.toFixed(2)),
        averageDeliveryTime: Number(averageDeliveryTime.toFixed(2)),
        clientSatisfaction: Number(clientSatisfaction.toFixed(2)),
        profitMargin: Number(profitMargin.toFixed(2)),
        growthRate: Number(growthRate.toFixed(2)),
        efficiency: Number(efficiency.toFixed(2)),
      });
    } catch (error) {
      console.error("Performance metrics error:", error);
      res.status(500).json({ error: "Failed to load performance metrics" });
    }
  });

  app.get("/api/analytics/growth", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);
      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              status: schema.projects.status,
              budget: schema.projects.budget,
              profession: schema.projects.profession,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              status: schema.projects.status,
              budget: schema.projects.budget,
              profession: schema.projects.profession,
            })
            .from(schema.projects));

      const prevStart = new Date(
        start.getTime() - (end.getTime() - start.getTime()),
      );
      const prevEnd = new Date(start.getTime());

      const currentRevenue = projectRows.reduce((sum, row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (!createdAt || createdAt < start || createdAt > end) return sum;
        return sum + toNumberValue(row.budget);
      }, 0);

      const previousRevenue = projectRows.reduce((sum, row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (!createdAt || createdAt < prevStart || createdAt > prevEnd)
          return sum;
        return sum + toNumberValue(row.budget);
      }, 0);

      const monthlyGrowth = previousRevenue
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0
          ? 100
          : 0;

      const yearStart = new Date(
        end.getFullYear() - 1,
        end.getMonth(),
        end.getDate(),
      );
      const prevYearStart = new Date(
        end.getFullYear() - 2,
        end.getMonth(),
        end.getDate(),
      );
      const prevYearEnd = new Date(
        end.getFullYear() - 1,
        end.getMonth(),
        end.getDate(),
      );
      const yearRevenue = projectRows.reduce((sum, row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (!createdAt || createdAt < yearStart || createdAt > end) return sum;
        return sum + toNumberValue(row.budget);
      }, 0);
      const prevYearRevenue = projectRows.reduce((sum, row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (!createdAt || createdAt < prevYearStart || createdAt > prevYearEnd)
          return sum;
        return sum + toNumberValue(row.budget);
      }, 0);
      const yearlyGrowth = prevYearRevenue
        ? ((yearRevenue - prevYearRevenue) / prevYearRevenue) * 100
        : yearRevenue > 0
          ? 100
          : 0;

      let marketShare = 0;
      if (profession) {
        const professionProjects = await db
          .select({
            id: schema.projects.id,
            createdAt: schema.projects.createdAt,
            budget: schema.projects.budget,
          })
          .from(schema.projects)
          .where(eq(schema.projects.profession, profession));
        const totalProfessionProjects = professionProjects.filter((row) => {
          const createdAt = toDateOrNull(row.createdAt);
          return createdAt && createdAt >= start && createdAt <= end;
        }).length;
        const userProjects = projectRows.filter((row) => {
          const createdAt = toDateOrNull(row.createdAt);
          return createdAt && createdAt >= start && createdAt <= end;
        }).length;
        marketShare = totalProfessionProjects
          ? (userProjects / totalProfessionProjects) * 100
          : 0;
      }

      const completedStatuses = new Set([
        "completed",
        "done",
        "delivered",
        "archived",
      ]);
      const userCompletionRate = projectRows.length
        ? (projectRows.filter((row) =>
            completedStatuses.has(String(row.status || "")),
          ).length /
            projectRows.length) *
          100
        : 0;

      const industryProjects = profession
        ? await db
            .select({
              id: schema.projects.id,
              status: schema.projects.status,
              budget: schema.projects.budget,
            })
            .from(schema.projects)
            .where(eq(schema.projects.profession, profession))
        : [];
      const industryRevenue = industryProjects.reduce(
        (sum, row) => sum + toNumberValue(row.budget),
        0,
      );
      const industryRevenuePerProject = industryProjects.length
        ? industryRevenue / industryProjects.length
        : 0;
      const userRevenuePerProject = projectRows.length
        ? currentRevenue / projectRows.length
        : 0;
      const industryCompletionRate = industryProjects.length
        ? (industryProjects.filter((row) =>
            completedStatuses.has(String(row.status || "")),
          ).length /
            industryProjects.length) *
          100
        : 0;

      const competitorAnalysis = [
        {
          metric: "Revenue per project",
          value: userRevenuePerProject,
          industry: industryRevenuePerProject,
        },
        {
          metric: "Completion rate",
          value: userCompletionRate,
          industry: industryCompletionRate,
        },
        { metric: "Market share", value: marketShare, industry: 100 },
      ];

      res.json({
        monthlyGrowth: Number(monthlyGrowth.toFixed(2)),
        yearlyGrowth: Number(yearlyGrowth.toFixed(2)),
        marketShare: Number(marketShare.toFixed(2)),
        competitorAnalysis,
      });
    } catch (error) {
      console.error("Growth metrics error:", error);
      res.status(500).json({ error: "Failed to load growth metrics" });
    }
  });

  app.post("/api/analytics/export", async (req, res) => {
    try {
      const { profession, userId, reportType, timeRange } = req.body || {};
      const payload = {
        profession,
        userId,
        reportType,
        timeRange,
        generatedAt: new Date().toISOString(),
      };
      const downloadUrl = `data:application/json;base64,${Buffer.from(
        JSON.stringify(payload, null, 2),
      ).toString("base64")}`;
      res.json({ downloadUrl });
    } catch (error) {
      console.error("Analytics export error:", error);
      res.status(500).json({ error: "Failed to export analytics" });
    }
  });

  app.get("/api/analytics/clients/behavior", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);
      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects));

      const feedbackFilter = buildFeedbackFilter(userId);
      const feedbackRows = feedbackFilter
        ? await db
            .select({
              clientName: schema.clientFeedbacks.clientName,
              rating: schema.clientFeedbacks.rating,
              createdAt: schema.clientFeedbacks.createdAt,
              isPublic: schema.clientFeedbacks.isPublic,
              feedbackType: schema.clientFeedbacks.feedbackType,
            })
            .from(schema.clientFeedbacks)
            .where(feedbackFilter)
        : [];

      const clientMap = new Map<
        string,
        {
          name: string;
          email: string;
          totalProjects: number;
          totalSpent: number;
          dates: Date[];
          ratings: number[];
          feedbacks: number;
          publicReviews: number;
        }
      >();

      projectRows.forEach((row) => {
        const name = (row.clientName || "Unknown").trim() || "Unknown";
        const createdAt = toDateOrNull(row.createdAt);
        const entry = clientMap.get(name) || {
          name,
          email: "",
          totalProjects: 0,
          totalSpent: 0,
          dates: [],
          ratings: [],
          feedbacks: 0,
          publicReviews: 0,
        };
        entry.totalProjects += 1;
        entry.totalSpent += toNumberValue(row.budget);
        if (createdAt) entry.dates.push(createdAt);
        clientMap.set(name, entry);
      });

      feedbackRows.forEach((row) => {
        const name = (row.clientName || "Unknown").trim() || "Unknown";
        const entry = clientMap.get(name);
        if (!entry) return;
        const rating = toNumberValue(row.rating);
        if (rating) entry.ratings.push(rating);
        entry.feedbacks += 1;
        if (row.isPublic) entry.publicReviews += 1;
      });

      const data = Array.from(clientMap.values()).map((client, index) => {
        const sortedDates = client.dates.sort(
          (a, b) => a.getTime() - b.getTime(),
        );
        const lastInteraction = sortedDates[sortedDates.length - 1] || new Date();
        const responseTime =
          sortedDates.length > 1
            ? (sortedDates[sortedDates.length - 1].getTime() -
                sortedDates[0].getTime()) /
              (1000 * 60 * 60 * 24)
            : 0;
        const averageProjectValue = client.totalProjects
          ? client.totalSpent / client.totalProjects
          : 0;
        const avgRating = client.ratings.length
          ? client.ratings.reduce((sum, value) => sum + value, 0) /
            client.ratings.length
          : 0;
        const engagementScore = Math.min(
          100,
          client.totalProjects * 15 + avgRating * 10 + client.publicReviews * 5,
        );
        const bookingPattern = client.totalProjects > 3 ? "recurrent" : "single";
        const seasonalTrend =
          lastInteraction.getMonth() < 3 || lastInteraction.getMonth() === 11
            ? "winter"
            : lastInteraction.getMonth() < 6
              ? "spring"
              : lastInteraction.getMonth() < 9
                ? "summer"
                : "fall";
        return {
          clientId: `${client.name}-${index}`,
          name: client.name,
          email: client.email,
          totalProjects: client.totalProjects,
          totalSpent: Number(client.totalSpent.toFixed(2)),
          averageProjectValue: Number(averageProjectValue.toFixed(2)),
          preferredCommunication: "email",
          responseTime: Number(responseTime.toFixed(1)),
          bookingPattern,
          seasonalTrend,
          lastInteraction: lastInteraction.toISOString(),
          engagementScore: Number(engagementScore.toFixed(1)),
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Client behavior error:", error);
      res.status(500).json({ error: "Failed to load client behavior" });
    }
  });

  app.get("/api/analytics/clients/satisfaction", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({ id: schema.projects.id, name: schema.projects.name })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({ id: schema.projects.id, name: schema.projects.name })
            .from(schema.projects));

      const projectNameById = new Map(
        projectRows.map((row) => [row.id, row.name || "Prosjekt"]),
      );

      const feedbackFilter = buildFeedbackFilter(userId);
      const feedbackRows = feedbackFilter
        ? await db
            .select({
              clientId: schema.clientFeedbacks.clientId,
              clientName: schema.clientFeedbacks.clientName,
              projectId: schema.clientFeedbacks.projectId,
              rating: schema.clientFeedbacks.rating,
              content: schema.clientFeedbacks.content,
              createdAt: schema.clientFeedbacks.createdAt,
              aspectRatings: schema.clientFeedbacks.aspectRatings,
            })
            .from(schema.clientFeedbacks)
            .where(feedbackFilter)
        : [];

      const data = feedbackRows.map((row) => {
        const projectName = row.projectId
          ? projectNameById.get(row.projectId) || "Prosjekt"
          : "Prosjekt";
        const overallRating = toNumberValue(row.rating);
        const aspectRatings = row.aspectRatings as Record<string, number> | null;
        return {
          clientId: row.clientId,
          clientName: row.clientName,
          projectId: row.projectId || "",
          projectName,
          overallRating,
          qualityRating: toNumberValue(aspectRatings?.quality, overallRating),
          communicationRating: toNumberValue(
            aspectRatings?.communication,
            overallRating,
          ),
          timelinessRating: toNumberValue(
            aspectRatings?.timeliness,
            overallRating,
          ),
          valueRating: toNumberValue(aspectRatings?.value, overallRating),
          reviewText: row.content,
          submittedAt: row.createdAt || new Date().toISOString(),
          wouldRecommend: overallRating >= 4,
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Client satisfaction error:", error);
      res.status(500).json({ error: "Failed to load satisfaction data" });
    }
  });

  app.get("/api/analytics/clients/lifetime-value", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects));

      const clientMap = new Map<
        string,
        {
          name: string;
          totalRevenue: number;
          dates: Date[];
          projectCount: number;
        }
      >();

      projectRows.forEach((row) => {
        const name = (row.clientName || "Unknown").trim() || "Unknown";
        const createdAt = toDateOrNull(row.createdAt);
        const entry = clientMap.get(name) || {
          name,
          totalRevenue: 0,
          dates: [],
          projectCount: 0,
        };
        entry.totalRevenue += toNumberValue(row.budget);
        entry.projectCount += 1;
        if (createdAt) entry.dates.push(createdAt);
        clientMap.set(name, entry);
      });

      const data = Array.from(clientMap.values()).map((client, index) => {
        const sortedDates = client.dates.sort(
          (a, b) => a.getTime() - b.getTime(),
        );
        const acquisitionDate = sortedDates[0] || new Date();
        const lastDate = sortedDates[sortedDates.length - 1] || acquisitionDate;
        const yearsActive = Math.max(
          1,
          (lastDate.getTime() - acquisitionDate.getTime()) /
            (1000 * 60 * 60 * 24 * 365),
        );
        const projectFrequency = client.projectCount / yearsActive;
        const averageProjectValue = client.projectCount
          ? client.totalRevenue / client.projectCount
          : 0;
        const projectedRevenue = averageProjectValue * projectFrequency * 2;
        const retentionProbability = Math.min(
          100,
          client.projectCount * 15 + projectFrequency * 10,
        );
        const lifetimeValueEstimate = client.totalRevenue + projectedRevenue;
        const segment =
          lifetimeValueEstimate > 100000
            ? "high_value"
            : lifetimeValueEstimate > 40000
              ? "medium_value"
              : lifetimeValueEstimate > 15000
                ? "low_value"
                : "at_risk";

        return {
          clientId: `${client.name}-${index}`,
          name: client.name,
          acquisitionDate: acquisitionDate.toISOString(),
          totalRevenue: Number(client.totalRevenue.toFixed(2)),
          projectedRevenue: Number(projectedRevenue.toFixed(2)),
          averageProjectValue: Number(averageProjectValue.toFixed(2)),
          projectFrequency: Number(projectFrequency.toFixed(2)),
          retentionProbability: Number(retentionProbability.toFixed(2)),
          lifetimeValueEstimate: Number(lifetimeValueEstimate.toFixed(2)),
          segment,
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Lifetime value error:", error);
      res.status(500).json({ error: "Failed to load lifetime value data" });
    }
  });

  app.get("/api/analytics/clients/referrals", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const projectFilter = buildProjectFilter(userId, profession || undefined);
      const projectRows = await (projectFilter
        ? db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              id: schema.projects.id,
              createdAt: schema.projects.createdAt,
              budget: schema.projects.budget,
              clientName: schema.projects.clientName,
            })
            .from(schema.projects));

      const feedbackFilter = buildFeedbackFilter(userId);
      const feedbackRows = feedbackFilter
        ? await db
            .select({
              clientName: schema.clientFeedbacks.clientName,
              rating: schema.clientFeedbacks.rating,
              isPublic: schema.clientFeedbacks.isPublic,
            })
            .from(schema.clientFeedbacks)
            .where(feedbackFilter)
        : [];

      const feedbackByClient = new Map<
        string,
        { ratings: number[]; publicReviews: number }
      >();
      feedbackRows.forEach((row) => {
        const name = (row.clientName || "Unknown").trim() || "Unknown";
        const entry = feedbackByClient.get(name) || {
          ratings: [],
          publicReviews: 0,
        };
        if (row.rating) entry.ratings.push(toNumberValue(row.rating));
        if (row.isPublic) entry.publicReviews += 1;
        feedbackByClient.set(name, entry);
      });

      const clientMap = new Map<
        string,
        { name: string; projectCount: number; totalRevenue: number }
      >();
      projectRows.forEach((row) => {
        const name = (row.clientName || "Unknown").trim() || "Unknown";
        const entry = clientMap.get(name) || {
          name,
          projectCount: 0,
          totalRevenue: 0,
        };
        entry.projectCount += 1;
        entry.totalRevenue += toNumberValue(row.budget);
        clientMap.set(name, entry);
      });

      const data = Array.from(clientMap.values()).map((client, index) => {
        const referralsGiven = Math.max(0, client.projectCount - 1);
        const referralRevenue =
          client.totalRevenue -
          (client.projectCount ? client.totalRevenue / client.projectCount : 0);
        const feedback = feedbackByClient.get(client.name) || {
          ratings: [],
          publicReviews: 0,
        };
        const avgRating = feedback.ratings.length
          ? feedback.ratings.reduce((sum, value) => sum + value, 0) /
            feedback.ratings.length
          : 0;
        const advocacyScore = Math.min(
          100,
          referralsGiven * 15 + avgRating * 10 + feedback.publicReviews * 5,
        );
        const referralConversionRate = referralsGiven ? 100 : 0;
        return {
          clientId: `${client.name}-${index}`,
          clientName: client.name,
          referralsGiven,
          referralsReceived: referralsGiven > 0,
          referralRevenue: Number(referralRevenue.toFixed(2)),
          referralConversionRate,
          advocacyScore: Number(advocacyScore.toFixed(1)),
          socialShares: feedback.publicReviews,
          reviewsWritten: feedback.ratings.length,
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Referral analytics error:", error);
      res.status(500).json({ error: "Failed to load referral analytics" });
    }
  });

  app.post("/api/analytics/clients/export", async (req, res) => {
    try {
      const { profession, userId, reportType, timeRange } = req.body || {};
      const payload = {
        profession,
        userId,
        reportType,
        timeRange,
        generatedAt: new Date().toISOString(),
      };
      const downloadUrl = `data:application/json;base64,${Buffer.from(
        JSON.stringify(payload, null, 2),
      ).toString("base64")}`;
      res.json({ downloadUrl });
    } catch (error) {
      console.error("Client export error:", error);
      res.status(500).json({ error: "Failed to export client insights" });
    }
  });

  app.get("/api/analytics/equipment/usage", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);
      const equipmentRows = await db
        .select({
          id: schema.userEquipment.id,
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
          category: schema.userEquipment.category,
          condition: schema.userEquipment.condition,
          purchaseDate: schema.userEquipment.purchaseDate,
          lastMaintenance: schema.userEquipment.lastMaintenance,
          nextMaintenance: schema.userEquipment.nextMaintenance,
        })
        .from(schema.userEquipment)
        .where(eq(schema.userEquipment.userId, userId));

      const rentalRows = await db
        .select({
          equipmentId: schema.equipmentRentals.equipmentId,
          rentalCost: schema.equipmentRentals.rentalCost,
          rentalStartDate: schema.equipmentRentals.rentalStartDate,
          rentalEndDate: schema.equipmentRentals.rentalEndDate,
          projectId: schema.equipmentRentals.projectId,
        })
        .from(schema.equipmentRentals)
        .where(eq(schema.equipmentRentals.userId, userId));

      const maintenanceRows = await db
        .select({
          equipmentId: schema.equipmentMaintenance.equipmentId,
          nextScheduledDate: schema.equipmentMaintenance.nextScheduledDate,
        })
        .from(schema.equipmentMaintenance)
        .where(eq(schema.equipmentMaintenance.userId, userId));

      const maintenanceByEquipment = new Map<
        string,
        { scheduled: boolean; lastScheduled?: string | null }
      >();
      maintenanceRows.forEach((row) => {
        const key = String(row.equipmentId);
        const existing = maintenanceByEquipment.get(key) || {
          scheduled: false,
          lastScheduled: null,
        };
        existing.scheduled = true;
        if (row.nextScheduledDate) existing.lastScheduled = row.nextScheduledDate;
        maintenanceByEquipment.set(key, existing);
      });

      const rentalsByEquipment = new Map<string, typeof rentalRows>();
      rentalRows.forEach((row) => {
        const key = String(row.equipmentId || "");
        if (!key) return;
        const entries = rentalsByEquipment.get(key) || [];
        entries.push(row);
        rentalsByEquipment.set(key, entries);
      });

      const rangeHours = Math.max(
        1,
        (end.getTime() - start.getTime()) / (1000 * 60 * 60),
      );

      const data = equipmentRows.map((row) => {
        const key = String(row.id);
        const rentals = rentalsByEquipment.get(key) || [];
        const rentalHours = rentals.reduce((sum, rental) => {
          const startDate = toDateOrNull(rental.rentalStartDate);
          const endDate = toDateOrNull(rental.rentalEndDate) || startDate;
          if (!startDate || !endDate) return sum;
          const hours = Math.max(
            0,
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60),
          );
          return sum + hours;
        }, 0);
        const revenueGenerated = rentals.reduce(
          (sum, rental) => sum + toNumberValue(rental.rentalCost),
          0,
        );
        const projectsUsed = rentals.filter((rental) =>
          Boolean(rental.projectId),
        ).length;
        const utilizationRate = rangeHours ? (rentalHours / rangeHours) * 100 : 0;
        const maintenance = maintenanceByEquipment.get(key);
        const lastUsed =
          rentals
            .map(
              (rental) =>
                toDateOrNull(rental.rentalEndDate) ||
                toDateOrNull(rental.rentalStartDate),
            )
            .filter((value): value is Date => Boolean(value))
            .sort((a, b) => b.getTime() - a.getTime())[0] ||
          toDateOrNull(row.lastMaintenance) ||
          toDateOrNull(row.purchaseDate) ||
          new Date();

        return {
          id: key,
          name: `${row.brand} ${row.model}`.trim(),
          type: normalizeEquipmentType(row.category),
          totalHours: Number(rentalHours.toFixed(1)),
          projectsUsed,
          utilizationRate: Number(utilizationRate.toFixed(2)),
          revenueGenerated: Number(revenueGenerated.toFixed(2)),
          lastUsed: lastUsed.toISOString(),
          condition: normalizeCondition(row.condition),
          maintenanceScheduled: maintenance?.scheduled || false,
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Equipment usage error:", error);
      res.status(500).json({ error: "Failed to load equipment usage" });
    }
  });

  app.get("/api/analytics/equipment/roi", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const equipmentRows = await db
        .select({
          id: schema.userEquipment.id,
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
          purchasePrice: schema.userEquipment.purchasePrice,
          currentValue: schema.userEquipment.currentValue,
          purchaseDate: schema.userEquipment.purchaseDate,
        })
        .from(schema.userEquipment)
        .where(eq(schema.userEquipment.userId, userId));

      const rentalRows = await db
        .select({
          equipmentId: schema.equipmentRentals.equipmentId,
          rentalCost: schema.equipmentRentals.rentalCost,
          rentalStartDate: schema.equipmentRentals.rentalStartDate,
        })
        .from(schema.equipmentRentals)
        .where(eq(schema.equipmentRentals.userId, userId));

      const rentalsByEquipment = new Map<string, typeof rentalRows>();
      rentalRows.forEach((row) => {
        const key = String(row.equipmentId || "");
        if (!key) return;
        const entries = rentalsByEquipment.get(key) || [];
        entries.push(row);
        rentalsByEquipment.set(key, entries);
      });

      const data = equipmentRows.map((row) => {
        const key = String(row.id);
        const rentals = rentalsByEquipment.get(key) || [];
        const totalRevenue = rentals.reduce(
          (sum, rental) => sum + toNumberValue(rental.rentalCost),
          0,
        );
        const purchasePrice = toNumberValue(row.purchasePrice);
        const roiPercentage = purchasePrice
          ? ((totalRevenue - purchasePrice) / purchasePrice) * 100
          : 0;
        const annualRevenue = rentals.reduce((sum, rental) => {
          const rentalDate = toDateOrNull(rental.rentalStartDate);
          if (!rentalDate) return sum;
          return sum + toNumberValue(rental.rentalCost);
        }, 0);
        const paybackPeriod = annualRevenue ? purchasePrice / annualRevenue : 0;
        return {
          equipmentId: key,
          name: `${row.brand} ${row.model}`.trim(),
          purchasePrice,
          currentValue: toNumberValue(row.currentValue),
          totalRevenue: Number(totalRevenue.toFixed(2)),
          roiPercentage: Number(roiPercentage.toFixed(2)),
          paybackPeriod: Number(paybackPeriod.toFixed(2)),
          annualRevenue: Number(annualRevenue.toFixed(2)),
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Equipment ROI error:", error);
      res.status(500).json({ error: "Failed to load equipment ROI" });
    }
  });

  app.get("/api/analytics/equipment/maintenance", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const equipmentRows = await db
        .select({
          id: schema.userEquipment.id,
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
        })
        .from(schema.userEquipment)
        .where(eq(schema.userEquipment.userId, userId));

      const equipmentById = new Map(
        equipmentRows.map((row) => [
          String(row.id),
          `${row.brand} ${row.model}`.trim(),
        ]),
      );

      const maintenanceRows = await db
        .select({
          equipmentId: schema.equipmentMaintenance.equipmentId,
          maintenanceType: schema.equipmentMaintenance.maintenanceType,
          scheduledDate: schema.equipmentMaintenance.scheduledDate,
          nextScheduledDate: schema.equipmentMaintenance.nextScheduledDate,
          cost: schema.equipmentMaintenance.cost,
        })
        .from(schema.equipmentMaintenance)
        .where(eq(schema.equipmentMaintenance.userId, userId));

      const data = maintenanceRows.map((row) => {
        const nextDate =
          row.nextScheduledDate ||
          toIsoString(row.scheduledDate) ||
          new Date().toISOString();
        return {
          equipmentId: String(row.equipmentId),
          equipmentName: equipmentById.get(String(row.equipmentId)) || "Utstyr",
          lastMaintenance:
            toIsoString(row.scheduledDate) || new Date().toISOString(),
          nextMaintenance: nextDate,
          maintenanceType: normalizeTaskType(row.maintenanceType),
          cost: toNumberValue(row.cost),
          status: normalizeStatus(row.maintenanceType) || "scheduled",
          urgency: normalizePriority(row.maintenanceType),
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Equipment maintenance error:", error);
      res.status(500).json({ error: "Failed to load equipment maintenance" });
    }
  });

  app.get("/api/analytics/equipment/recommendations", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const range = readString(req.query.range) || "12m";
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { start, end } = parseRangeParam(range);

      const equipmentRows = await db
        .select({
          id: schema.userEquipment.id,
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
          purchaseDate: schema.userEquipment.purchaseDate,
          purchasePrice: schema.userEquipment.purchasePrice,
          currentValue: schema.userEquipment.currentValue,
          condition: schema.userEquipment.condition,
        })
        .from(schema.userEquipment)
        .where(eq(schema.userEquipment.userId, userId));

      const maintenanceRows = await db
        .select({
          equipmentId: schema.equipmentMaintenance.equipmentId,
          cost: schema.equipmentMaintenance.cost,
        })
        .from(schema.equipmentMaintenance)
        .where(eq(schema.equipmentMaintenance.userId, userId));

      const rentalRows = await db
        .select({
          equipmentId: schema.equipmentRentals.equipmentId,
          rentalStartDate: schema.equipmentRentals.rentalStartDate,
          rentalEndDate: schema.equipmentRentals.rentalEndDate,
        })
        .from(schema.equipmentRentals)
        .where(eq(schema.equipmentRentals.userId, userId));

      const maintenanceCostByEquipment = new Map<string, number>();
      maintenanceRows.forEach((row) => {
        const key = String(row.equipmentId);
        maintenanceCostByEquipment.set(
          key,
          (maintenanceCostByEquipment.get(key) || 0) + toNumberValue(row.cost),
        );
      });

      const rentalHoursByEquipment = new Map<string, number>();
      rentalRows.forEach((row) => {
        const key = String(row.equipmentId || "");
        if (!key) return;
        const startDate = toDateOrNull(row.rentalStartDate);
        const endDate = toDateOrNull(row.rentalEndDate) || startDate;
        if (!startDate || !endDate) return;
        if (endDate < start || startDate > end) return;
        const hours = Math.max(
          0,
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60),
        );
        rentalHoursByEquipment.set(
          key,
          (rentalHoursByEquipment.get(key) || 0) + hours,
        );
      });

      const rangeHours = Math.max(
        1,
        (end.getTime() - start.getTime()) / (1000 * 60 * 60),
      );

      const data = equipmentRows.map((row) => {
        const key = String(row.id);
        const condition = normalizeCondition(row.condition);
        const purchaseDate = toDateOrNull(row.purchaseDate) || new Date();
        const currentAge = Math.max(
          0,
          Math.round(
            (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365),
          ),
        );
        const maintenanceCost = maintenanceCostByEquipment.get(key) || 0;
        const utilizationRate = rentalHoursByEquipment.get(key)
          ? ((rentalHoursByEquipment.get(key) || 0) / rangeHours) * 100
          : 0;
        const currentValue = toNumberValue(row.currentValue);
        const estimatedCost = currentValue || toNumberValue(row.purchasePrice);
        const recommendedAction =
          condition === "poor" || maintenanceCost > estimatedCost * 0.4
            ? "replace"
            : condition === "fair"
              ? "upgrade"
              : "maintain";
        const timeframe =
          recommendedAction === "replace"
            ? "immediate"
            : recommendedAction === "upgrade"
              ? "within_6_months"
              : "within_year";
        const potentialSavings = Math.max(0, maintenanceCost * 0.5);

        return {
          equipmentId: key,
          name: `${row.brand} ${row.model}`.trim(),
          currentAge,
          condition,
          utilizationRate: Number(utilizationRate.toFixed(2)),
          maintenanceCost: Number(maintenanceCost.toFixed(2)),
          recommendedAction,
          timeframe,
          estimatedCost: Number(estimatedCost.toFixed(2)),
          potentialSavings: Number(potentialSavings.toFixed(2)),
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Equipment recommendations error:", error);
      res.status(500).json({ error: "Failed to load equipment recommendations" });
    }
  });

  app.post("/api/equipment/schedule-maintenance", async (req, res) => {
    try {
      const { equipmentId, date, type } = req.body || {};
      const userId =
        readString(req.body?.userId) || readString(req.query.userId) || "";
      if (!equipmentId || !userId)
        return res.status(400).json({ error: "Missing equipmentId or userId" });

      const scheduledDate = toDateOnly(date || new Date());
      const [row] = await db
        .insert(schema.equipmentMaintenance)
        .values({
          equipmentId: String(equipmentId),
          userId: String(userId),
          maintenanceType: normalizeTaskType(type),
          description: `Planned ${type || "maintenance"}`,
          scheduledDate,
        } as any)
        .returning();

      res.json({ success: true, maintenance: row });
    } catch (error) {
      console.error("Schedule maintenance error:", error);
      res.status(500).json({ error: "Failed to schedule maintenance" });
    }
  });

  app.post("/api/analytics/equipment/export", async (req, res) => {
    try {
      const { profession, userId, reportType, timeRange } = req.body || {};
      const payload = {
        profession,
        userId,
        reportType,
        timeRange,
        generatedAt: new Date().toISOString(),
      };
      const downloadUrl = `data:application/json;base64,${Buffer.from(
        JSON.stringify(payload, null, 2),
      ).toString("base64")}`;
      res.json({ downloadUrl });
    } catch (error) {
      console.error("Equipment export error:", error);
      res.status(500).json({ error: "Failed to export equipment analytics" });
    }
  });

  app.get("/api/analytics/performance/summary", async (req, res) => {
    try {
      const range = readString(req.query.range) || "30d";
      const { start, end } = parseRangeParam(range);
      const metrics = await db
        .select({
          metricType: schema.performanceMetrics.metricType,
          metricValue: schema.performanceMetrics.metricValue,
          createdAt: schema.performanceMetrics.createdAt,
        })
        .from(schema.performanceMetrics)
        .where(and(isNotNull(schema.performanceMetrics.createdAt)));

      const inRange = metrics.filter((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        return createdAt && createdAt >= start && createdAt <= end;
      });

      const averageByType = new Map<string, number>();
      const countsByType = new Map<string, number>();
      inRange.forEach((row) => {
        const value = toNumberValue(row.metricValue);
        averageByType.set(
          row.metricType,
          (averageByType.get(row.metricType) || 0) + value,
        );
        countsByType.set(
          row.metricType,
          (countsByType.get(row.metricType) || 0) + 1,
        );
      });
      const average = (type: string) => {
        const total = averageByType.get(type) || 0;
        const count = countsByType.get(type) || 0;
        return count ? total / count : 0;
      };

      res.json({
        pageLoad: {
          avgLoadTime: Number(average("page_load_avg").toFixed(2)),
          p95LoadTime: Number(average("page_load_p95").toFixed(2)),
        },
        api: {
          avgResponseTime: Number(average("api_response_avg").toFixed(2)),
          p95ResponseTime: Number(average("api_response_p95").toFixed(2)),
        },
        webVitals: [
          {
            name: "lcp",
            avgValue: Number(average("lcp_avg").toFixed(2)),
            p75Value: Number(average("lcp_p75").toFixed(2)),
          },
          {
            name: "cls",
            avgValue: Number(average("cls_avg").toFixed(2)),
            p75Value: Number(average("cls_p75").toFixed(2)),
          },
          {
            name: "fid",
            avgValue: Number(average("fid_avg").toFixed(2)),
            p75Value: Number(average("fid_p75").toFixed(2)),
          },
        ],
      });
    } catch (error) {
      console.error("Performance summary error:", error);
      res.status(500).json({ error: "Failed to load performance summary" });
    }
  });

  app.get("/api/analytics/business-intelligence", async (req, res) => {
    try {
      const range = readString(req.query.range) || "30d";
      const profession = readString(req.query.profession);
      const { start, end } = parseRangeParam(range);

      const projectFilter = profession
        ? eq(schema.projects.profession, profession)
        : undefined;
      const projectRows = await (projectFilter
        ? db
            .select({
              profession: schema.projects.profession,
              budget: schema.projects.budget,
              createdAt: schema.projects.createdAt,
            })
            .from(schema.projects)
            .where(projectFilter)
        : db
            .select({
              profession: schema.projects.profession,
              budget: schema.projects.budget,
              createdAt: schema.projects.createdAt,
            })
            .from(schema.projects));

      const projectMetricsMap = new Map<
        string,
        { totalProjects: number; totalRevenue: number }
      >();
      projectRows.forEach((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (createdAt && (createdAt < start || createdAt > end)) return;
        const key = row.profession || "unknown";
        const entry = projectMetricsMap.get(key) || {
          totalProjects: 0,
          totalRevenue: 0,
        };
        entry.totalProjects += 1;
        entry.totalRevenue += toNumberValue(row.budget);
        projectMetricsMap.set(key, entry);
      });

      const featureUsage = [
        { component: "Project Tracking", usageCount: projectRows.length },
        {
          component: "Client Feedback",
          usageCount: await db
            .select({ id: schema.clientFeedbacks.id })
            .from(schema.clientFeedbacks)
            .then((rows) => rows.length),
        },
        {
          component: "Equipment Maintenance",
          usageCount: await db
            .select({ id: schema.equipmentMaintenance.id })
            .from(schema.equipmentMaintenance)
            .then((rows) => rows.length),
        },
      ];

      const deviceMetrics = [
        {
          deviceType: "Desktop",
          sessionCount: Math.round(featureUsage[0].usageCount * 0.6),
        },
        {
          deviceType: "Mobile",
          sessionCount: Math.round(featureUsage[0].usageCount * 0.3),
        },
        {
          deviceType: "Tablet",
          sessionCount: Math.round(featureUsage[0].usageCount * 0.1),
        },
      ];

      res.json({
        projectMetrics: Array.from(projectMetricsMap.entries()).map(
          ([key, value]) => ({
            profession: key,
            totalProjects: value.totalProjects,
            totalRevenue: Number(value.totalRevenue.toFixed(2)),
          }),
        ),
        featureUsage,
        deviceMetrics,
      });
    } catch (error) {
      console.error("Business intelligence error:", error);
      res
        .status(500)
        .json({ error: "Failed to load business intelligence data" });
    }
  });

  app.get("/api/analytics/norwegian-market", async (req, res) => {
    try {
      const users = await db
        .select({ profession: schema.users.profession })
        .from(schema.users);
      const projects = await db
        .select({
          profession: schema.projects.profession,
          createdAt: schema.projects.createdAt,
          location: schema.projects.location,
        })
        .from(schema.projects);
      const equipment = await db
        .select({
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
        })
        .from(schema.userEquipment);

      const marketInsightsMap = new Map<string, number>();
      users.forEach((row) => {
        const key = row.profession || "unknown";
        marketInsightsMap.set(key, (marketInsightsMap.get(key) || 0) + 1);
      });

      const marketInsights = Array.from(marketInsightsMap.entries()).map(
        ([profession, count]) => ({
          profession,
          userCount: count,
          avgHourlyRate: 0,
        }),
      );

      const equipmentMap = new Map<string, number>();
      equipment.forEach((row) => {
        const name = `${row.brand} ${row.model}`.trim();
        equipmentMap.set(name, (equipmentMap.get(name) || 0) + 1);
      });
      const equipmentTrends = Array.from(equipmentMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([equipmentName, usageCount]) => ({ equipmentName, usageCount }));

      const geographicData = projects
        .filter((row) => Boolean(row.location))
        .slice(0, 10)
        .map((row) => ({
          county: row.location || "Unknown",
          municipality: row.location || "Unknown",
          userCount: 1,
          profession: row.profession || "unknown",
        }));

      const seasonalMap = new Map<number, number>();
      projects.forEach((row) => {
        const createdAt = toDateOrNull(row.createdAt);
        if (!createdAt) return;
        const month = createdAt.getMonth() + 1;
        seasonalMap.set(month, (seasonalMap.get(month) || 0) + 1);
      });
      const seasonalTrends = Array.from(seasonalMap.entries()).map(
        ([month, projectCount]) => ({
          month,
          projectCount,
        }),
      );

      res.json({
        marketInsights,
        equipmentTrends,
        geographicData,
        seasonalTrends,
      });
    } catch (error) {
      console.error("Norwegian market error:", error);
      res.status(500).json({ error: "Failed to load market data" });
    }
  });

  app.get("/api/analytics/real-time", async (req, res) => {
    try {
      const users = await db
        .select({ lastLoginAt: schema.users.lastLoginAt })
        .from(schema.users);
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
      const activeUsers = users.filter((row) => {
        const lastLogin = toDateOrNull(row.lastLoginAt);
        return lastLogin && lastLogin.getTime() >= fifteenMinutesAgo;
      }).length;

      const metrics = await db
        .select({
          metricType: schema.performanceMetrics.metricType,
          metricValue: schema.performanceMetrics.metricValue,
        })
        .from(schema.performanceMetrics);
      const avg = (type: string) => {
        const values = metrics
          .filter((row) => row.metricType === type)
          .map((row) => toNumberValue(row.metricValue));
        return values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;
      };

      res.json({
        activeUsers,
        errorRate: Number(avg("error_rate").toFixed(2)),
        systemLoad: {
          avgMemoryMb: Number(avg("memory_mb").toFixed(2)),
          cpuUsage: Number(avg("cpu_usage").toFixed(2)),
        },
      });
    } catch (error) {
      console.error("Real-time analytics error:", error);
      res.status(500).json({ error: "Failed to load real-time analytics" });
    }
  });

  // Analytics - accept and acknowledge
  app.post("/api/analytics", (req, res) => {
    try {
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(200).json({ success: true });
    }
  });
}
