/**
 * admin-room-role-room-economy-routes.ts
 *
 * Role Room-spesifikk Stripe + kostnads-oversikt for Admin Room.
 * Joiner Stripe-konto (egen for theroleroom.com) mot lokal users-tabell
 * og ai_usage_log slik at Daniel ser per bruker:
 *   - Stripe-revenue (MRR-bidrag, lifetime, status, plan)
 *   - AI-kost siste 30d (Claude tokens × USD)
 *   - Beregnet margin
 *
 * Endpoints:
 *   GET  /api/admin-room/role-room/economy/subscribers
 *   GET  /api/admin-room/role-room/economy/subscribers/:userId
 *   GET  /api/admin-room/role-room/economy/aggregate
 *   GET  /api/admin-room/role-room/economy/timeseries
 *
 * Alle gated via requireAdminRoomAccess.
 */

import type Stripe from "stripe";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, asNumberOrNull } from "./_shared";

interface RoleRoomEconomyDeps extends AdminRoomRoutesDeps {
  getRoleRoomStripeClient: () => Stripe | null;
}

const ROLE_ROOM_PROFESSIONS = [
  "production",
  "photographer",
  "content_producer",
  "content_creator",
  "dance_studio",
  "dance_freelance",
] as const;

const NOK_USD = Number.parseFloat(process.env.ROLE_ROOM_NOK_PER_USD ?? "10.7");
const HOSTING_ALLOCATION_USD_PER_USER_MONTHLY = Number.parseFloat(
  process.env.ROLE_ROOM_HOSTING_ALLOC_USD ?? "1.20",
);

const VALID_CATEGORIES = new Set([
  "ai",
  "hosting",
  "cdn",
  "storage",
  "database",
  "devtool",
  "monitoring",
  "email",
  "other",
]);
const VALID_ALLOC = new Set(["role_room_only", "total_platform", "per_active_user"]);
const VALID_BILLING = new Set(["monthly", "yearly", "one_time"]);

interface FixedCostAllocation {
  totalMonthlyUsd: number;
  roleRoomAllocatedUsd: number;
  byCategoryUsd: Record<string, number>;
  byVendorUsd: Array<{ name: string; vendor: string | null; allocatedUsd: number }>;
}

async function loadPlatformFixedCostAllocation(
  pool: AdminRoomRoutesDeps["pool"],
  userId: string,
  activeRoleRoomCount: number,
): Promise<FixedCostAllocation> {
  const result = await pool.query(
    `SELECT name, vendor, category, amount_usd_monthly,
            allocation_method, role_room_share_pct, billing_interval
       FROM platform_fixed_costs
      WHERE user_id = $1 AND active = TRUE
        AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
        AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)`,
    [userId],
  );

  let totalMonthly = 0;
  let roleRoomAlloc = 0;
  const byCategory: Record<string, number> = {};
  const byVendor: Array<{ name: string; vendor: string | null; allocatedUsd: number }> = [];

  for (const row of result.rows) {
    const amount = Number(row.amount_usd_monthly) || 0;
    const monthly = row.billing_interval === "yearly"
      ? amount / 12
      : row.billing_interval === "one_time"
        ? 0
        : amount;
    totalMonthly += monthly;

    let allocated = 0;
    if (row.allocation_method === "role_room_only") {
      allocated = monthly;
    } else if (row.allocation_method === "per_active_user") {
      allocated = monthly * activeRoleRoomCount;
    } else {
      const sharePct = Number(row.role_room_share_pct);
      allocated = monthly * (Number.isFinite(sharePct) ? sharePct / 100 : 0);
    }
    roleRoomAlloc += allocated;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + allocated;
    byVendor.push({ name: row.name, vendor: row.vendor, allocatedUsd: allocated });
  }

  byVendor.sort((a, b) => b.allocatedUsd - a.allocatedUsd);

  return {
    totalMonthlyUsd: totalMonthly,
    roleRoomAllocatedUsd: roleRoomAlloc,
    byCategoryUsd: byCategory,
    byVendorUsd: byVendor,
  };
}

function dollarsFromMinor(amount: number | null | undefined, currency: string | null | undefined) {
  if (!Number.isFinite(amount ?? NaN)) return 0;
  const divisor = currency?.toLowerCase() === "jpy" ? 1 : 100;
  return (amount ?? 0) / divisor;
}

function toMonthlyAmount(amount: number, interval: Stripe.Price.Recurring.Interval | null | undefined, intervalCount: number | null | undefined) {
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1;
  switch (interval) {
    case "year": return amount / (12 * count);
    case "month": return amount / count;
    case "week": return (amount * 52) / 12 / count;
    case "day": return (amount * 30) / count;
    default: return amount;
  }
}

interface StripeSubscriberRow {
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  customerCreated: string | null;
  subscriptionId: string | null;
  status: Stripe.Subscription.Status | "no_subscription";
  planNickname: string | null;
  planAmountUsd: number;
  monthlyContributionUsd: number;
  currency: string | null;
  interval: string | null;
  trialEndsAt: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  currentPeriodEnd: string | null;
}

async function fetchAllRoleRoomSubscribers(stripe: Stripe): Promise<StripeSubscriberRow[]> {
  const rows: StripeSubscriberRow[] = [];
  let startingAfter: string | undefined;
  // Hent alle subscriptions først, så map mot customers — så ingen blir glemt
  // som har kansellert.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page: Stripe.ApiList<Stripe.Subscription> = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      expand: ["data.customer", "data.items.data.price"],
      starting_after: startingAfter,
    });
    for (const sub of page.data) {
      const customer = sub.customer as Stripe.Customer | Stripe.DeletedCustomer;
      const isDeleted = (customer as Stripe.DeletedCustomer).deleted === true;
      const firstItem = sub.items.data[0];
      const price = firstItem?.price;
      const amountUsd =
        price?.unit_amount != null
          ? dollarsFromMinor(price.unit_amount, price.currency)
          : 0;
      const monthly = toMonthlyAmount(
        amountUsd,
        price?.recurring?.interval ?? null,
        price?.recurring?.interval_count ?? null,
      );
      // Stripe v19: current_period_end er flyttet fra Subscription til items.data[i].
      const firstItem = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
      const periodEnd = firstItem?.current_period_end ?? null;
      rows.push({
        customerId: typeof customer === "string" ? customer : customer.id,
        customerEmail: !isDeleted ? (customer as Stripe.Customer).email ?? null : null,
        customerName: !isDeleted ? (customer as Stripe.Customer).name ?? null : null,
        customerCreated: !isDeleted && (customer as Stripe.Customer).created
          ? new Date((customer as Stripe.Customer).created * 1000).toISOString()
          : null,
        subscriptionId: sub.id,
        status: sub.status,
        planNickname: price?.nickname ?? price?.product?.toString() ?? null,
        planAmountUsd: amountUsd,
        monthlyContributionUsd: ["active", "trialing", "past_due"].includes(sub.status) ? monthly : 0,
        currency: price?.currency ?? null,
        interval: price?.recurring?.interval ?? null,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      });
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return rows;
}

export function setupAdminRoleRoomEconomyRoutes(deps: RoleRoomEconomyDeps): void {
  const { app, pool, requireAdminRoomAccess, getRoleRoomStripeClient } = deps;

  app.get("/api/admin-room/role-room/economy/subscribers", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const subscribers = await fetchAllRoleRoomSubscribers(stripe);

      const emails = subscribers
        .map((row) => row.customerEmail?.toLowerCase())
        .filter((email): email is string => !!email);

      // DB-side: hent matching users + AI-kost siste 30d per user
      const userMap = new Map<string, { id: string; firstName: string | null; lastName: string | null; profession: string | null; createdAt: string }>();
      const aiCostMap = new Map<string, number>();

      if (emails.length > 0) {
        const usersResult = await pool.query(
          `SELECT id, email, first_name, last_name, profession, created_at
             FROM users
            WHERE LOWER(email) = ANY($1::text[])`,
          [emails],
        );
        for (const row of usersResult.rows) {
          userMap.set(row.email.toLowerCase(), {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            profession: row.profession,
            createdAt: row.created_at,
          });
        }

        const userIds = Array.from(userMap.values()).map((u) => u.id);
        if (userIds.length > 0) {
          const aiResult = await pool.query(
            `SELECT user_id, COALESCE(SUM(cost_usd), 0)::float AS cost_usd
               FROM ai_usage_log
              WHERE user_id = ANY($1::text[])
                AND created_at > NOW() - INTERVAL '30 days'
              GROUP BY user_id`,
            [userIds],
          );
          for (const row of aiResult.rows) {
            aiCostMap.set(row.user_id, Number(row.cost_usd) || 0);
          }
        }
      }

      const enriched = subscribers.map((row) => {
        const user = row.customerEmail
          ? userMap.get(row.customerEmail.toLowerCase())
          : undefined;
        const aiCostUsd30d = user ? aiCostMap.get(user.id) ?? 0 : 0;
        const hostingUsd30d = HOSTING_ALLOCATION_USD_PER_USER_MONTHLY;
        const totalCostUsd30d = aiCostUsd30d + hostingUsd30d;
        const revenueUsd30d = row.monthlyContributionUsd;
        const marginUsd30d = revenueUsd30d - totalCostUsd30d;
        const marginPct = revenueUsd30d > 0 ? (marginUsd30d / revenueUsd30d) * 100 : null;
        return {
          ...row,
          userId: user?.id ?? null,
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          profession: user?.profession ?? null,
          isRoleRoomProfession: user?.profession
            ? (ROLE_ROOM_PROFESSIONS as readonly string[]).includes(user.profession)
            : false,
          userCreatedAt: user?.createdAt ?? null,
          aiCostUsd30d,
          hostingUsd30d,
          totalCostUsd30d,
          marginUsd30d,
          marginPct,
        };
      });

      res.json({
        items: enriched,
        meta: {
          nokPerUsd: NOK_USD,
          hostingAllocationUsdMonthly: HOSTING_ALLOCATION_USD_PER_USER_MONTHLY,
          totalCount: enriched.length,
          activeCount: enriched.filter((r) => r.status === "active").length,
        },
      });
    } catch (err) {
      console.error("[admin-room role-room economy] subscribers error", err);
      res.status(500).json({ error: "Kunne ikke hente subscribers fra Stripe" });
    }
  });

  app.get("/api/admin-room/role-room/economy/subscribers/:userId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const userResult = await pool.query(
        `SELECT id, email, first_name, last_name, profession, company_name, created_at
           FROM users WHERE id = $1`,
        [req.params.userId],
      );
      const user = userResult.rows[0];
      if (!user) {
        res.status(404).json({ error: "Bruker ikke funnet" });
        return;
      }

      let stripeCustomer: Stripe.Customer | null = null;
      let subscriptions: Stripe.Subscription[] = [];
      let invoices: Stripe.Invoice[] = [];
      let upcomingInvoice: Stripe.Invoice | null = null;
      let paymentMethods: Stripe.PaymentMethod[] = [];

      if (user.email) {
        const customers = await stripe.customers.list({ email: user.email, limit: 5 });
        stripeCustomer = customers.data[0] ?? null;
        if (stripeCustomer) {
          const subList = await stripe.subscriptions.list({
            customer: stripeCustomer.id,
            status: "all",
            limit: 100,
            expand: ["data.items.data.price"],
          });
          subscriptions = subList.data;

          const invoiceList = await stripe.invoices.list({
            customer: stripeCustomer.id,
            limit: 24,
          });
          invoices = invoiceList.data;

          try {
            // @ts-expect-error — Stripe-types mismatch på enkelte versjoner, men endpoint finnes
            upcomingInvoice = await stripe.invoices.retrieveUpcoming({ customer: stripeCustomer.id });
          } catch {
            upcomingInvoice = null;
          }

          const pmList = await stripe.paymentMethods.list({
            customer: stripeCustomer.id,
            type: "card",
            limit: 10,
          });
          paymentMethods = pmList.data;
        }
      }

      const aiUsage = await pool.query(
        `SELECT
           DATE_TRUNC('day', created_at)::date AS day,
           SUM(input_tokens)::bigint AS input_tokens,
           SUM(output_tokens)::bigint AS output_tokens,
           SUM(cache_read_tokens)::bigint AS cache_read_tokens,
           SUM(cache_write_tokens)::bigint AS cache_write_tokens,
           SUM(cost_usd)::float AS cost_usd,
           COUNT(*)::int AS call_count
         FROM ai_usage_log
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY day
         ORDER BY day ASC`,
        [user.id],
      );

      const aiByFeature = await pool.query(
        `SELECT
           feature,
           SUM(cost_usd)::float AS cost_usd,
           COUNT(*)::int AS call_count
         FROM ai_usage_log
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY feature
         ORDER BY cost_usd DESC
         LIMIT 10`,
        [user.id],
      );

      const aiTotal30d = aiByFeature.rows.reduce((acc, row) => acc + (Number(row.cost_usd) || 0), 0);
      const hostingTotal30d = HOSTING_ALLOCATION_USD_PER_USER_MONTHLY;

      const monthlyContribution = subscriptions
        .filter((sub) => ["active", "trialing", "past_due"].includes(sub.status))
        .reduce((acc, sub) => {
          const price = sub.items.data[0]?.price;
          if (!price?.unit_amount) return acc;
          const amount = dollarsFromMinor(price.unit_amount, price.currency);
          return acc + toMonthlyAmount(
            amount,
            price.recurring?.interval ?? null,
            price.recurring?.interval_count ?? null,
          );
        }, 0);

      const lifetimeRevenueUsd = invoices
        .filter((inv) => inv.status === "paid")
        .reduce((acc, inv) => acc + dollarsFromMinor(inv.amount_paid, inv.currency), 0);

      res.json({
        user,
        stripeCustomer,
        subscriptions: subscriptions.map((sub) => {
          const price = sub.items.data[0]?.price;
          // Stripe v19: current_period_end er flyttet fra Subscription til items.data[i].
      const firstItem = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
      const periodEnd = firstItem?.current_period_end ?? null;
          return {
            id: sub.id,
            status: sub.status,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            priceNickname: price?.nickname ?? null,
            priceUsd: price?.unit_amount ? dollarsFromMinor(price.unit_amount, price.currency) : 0,
            currency: price?.currency ?? null,
            interval: price?.recurring?.interval ?? null,
            intervalCount: price?.recurring?.interval_count ?? null,
          };
        }),
        invoices: invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          total: dollarsFromMinor(inv.total, inv.currency),
          amountPaid: dollarsFromMinor(inv.amount_paid, inv.currency),
          amountDue: dollarsFromMinor(inv.amount_due, inv.currency),
          currency: inv.currency,
          created: new Date(inv.created * 1000).toISOString(),
          hostedInvoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf,
        })),
        upcomingInvoice: upcomingInvoice
          ? {
              total: dollarsFromMinor(upcomingInvoice.total, upcomingInvoice.currency),
              amountDue: dollarsFromMinor(upcomingInvoice.amount_due, upcomingInvoice.currency),
              currency: upcomingInvoice.currency,
              periodEnd: upcomingInvoice.period_end
                ? new Date(upcomingInvoice.period_end * 1000).toISOString()
                : null,
            }
          : null,
        paymentMethods: paymentMethods.map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand ?? null,
          last4: pm.card?.last4 ?? null,
          expMonth: pm.card?.exp_month ?? null,
          expYear: pm.card?.exp_year ?? null,
          country: pm.card?.country ?? null,
        })),
        economy: {
          monthlyContributionUsd: monthlyContribution,
          lifetimeRevenueUsd,
          aiCostUsd30d: aiTotal30d,
          hostingUsd30d: hostingTotal30d,
          totalCostUsd30d: aiTotal30d + hostingTotal30d,
          marginUsd30d: monthlyContribution - (aiTotal30d + hostingTotal30d),
          marginPct:
            monthlyContribution > 0
              ? ((monthlyContribution - (aiTotal30d + hostingTotal30d)) / monthlyContribution) * 100
              : null,
          aiUsageByDay: aiUsage.rows,
          aiUsageByFeature: aiByFeature.rows,
          nokPerUsd: NOK_USD,
        },
      });
    } catch (err) {
      console.error("[admin-room role-room economy] subscriber detail error", err);
      res.status(500).json({ error: "Kunne ikke hente bruker-detaljer" });
    }
  });

  app.get("/api/admin-room/role-room/economy/aggregate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const subscribers = await fetchAllRoleRoomSubscribers(stripe);

      const mrr = subscribers
        .filter((row) => ["active", "trialing"].includes(row.status))
        .reduce((acc, row) => acc + row.monthlyContributionUsd, 0);
      const activeCount = subscribers.filter((row) => row.status === "active").length;
      const trialingCount = subscribers.filter((row) => row.status === "trialing").length;
      const pastDueCount = subscribers.filter((row) => row.status === "past_due").length;
      const canceledLast30d = subscribers.filter((row) => {
        if (!row.canceledAt) return false;
        const t = Date.parse(row.canceledAt);
        return Number.isFinite(t) && t > Date.now() - 30 * 24 * 60 * 60 * 1000;
      }).length;
      const newLast30d = subscribers.filter((row) => {
        if (!row.customerCreated) return false;
        const t = Date.parse(row.customerCreated);
        return Number.isFinite(t) && t > Date.now() - 30 * 24 * 60 * 60 * 1000;
      }).length;

      // AI-kost siste 30 dager for ALLE Role Room-users (profession-match)
      const aiCostResult = await pool.query(
        `SELECT COALESCE(SUM(cost_usd), 0)::float AS cost_usd
           FROM ai_usage_log a
           JOIN users u ON u.id = a.user_id
          WHERE u.profession = ANY($1::text[])
            AND a.created_at > NOW() - INTERVAL '30 days'`,
        [ROLE_ROOM_PROFESSIONS],
      );
      const aiCost30d = Number(aiCostResult.rows[0]?.cost_usd) || 0;
      const hostingTotal30d = HOSTING_ALLOCATION_USD_PER_USER_MONTHLY * activeCount;

      const fixedCosts = await loadPlatformFixedCostAllocation(pool, session.userId, activeCount);
      const totalCost30d = aiCost30d + hostingTotal30d + fixedCosts.roleRoomAllocatedUsd;
      const marginUsd30d = mrr - totalCost30d;
      const marginPct = mrr > 0 ? (marginUsd30d / mrr) * 100 : null;

      const churnRatePct = activeCount + canceledLast30d > 0
        ? (canceledLast30d / (activeCount + canceledLast30d)) * 100
        : 0;

      res.json({
        mrrUsd: mrr,
        arrUsd: mrr * 12,
        mrrNok: mrr * NOK_USD,
        arrNok: mrr * 12 * NOK_USD,
        activeCount,
        trialingCount,
        pastDueCount,
        canceledLast30d,
        newLast30d,
        churnRatePct,
        aiCostUsd30d: aiCost30d,
        hostingUsd30d: hostingTotal30d,
        platformFixedCostsUsd30d: fixedCosts.roleRoomAllocatedUsd,
        platformFixedCostsTotalMonthlyUsd: fixedCosts.totalMonthlyUsd,
        fixedCostsByCategoryUsd: fixedCosts.byCategoryUsd,
        fixedCostsByVendorUsd: fixedCosts.byVendorUsd,
        totalCostUsd30d: totalCost30d,
        marginUsd30d,
        marginPct,
        meta: { nokPerUsd: NOK_USD },
      });
    } catch (err) {
      console.error("[admin-room role-room economy] aggregate error", err);
      res.status(500).json({ error: "Kunne ikke hente aggregat" });
    }
  });

  app.get("/api/admin-room/role-room/economy/timeseries", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const subscribers = await fetchAllRoleRoomSubscribers(stripe);

      // 12 mnd MRR-tidsserie: for hver måned, summerer vi monthlyContributionUsd
      // for alle subscriptions som var aktive den måneden. En sub var aktiv hvis
      // customer_created <= månedsslutt OG (canceled_at IS NULL OR canceled_at > månedsstart)
      const months: Array<{ monthLabel: string; mrrUsd: number; activeCount: number; newCount: number; churnCount: number; aiCostUsd: number }> = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const monthLabel = monthStart.toISOString().slice(0, 7);

        let mrrSnapshot = 0;
        let active = 0;
        let newCount = 0;
        let churnCount = 0;

        for (const sub of subscribers) {
          const createdMs = sub.customerCreated ? Date.parse(sub.customerCreated) : null;
          const canceledMs = sub.canceledAt ? Date.parse(sub.canceledAt) : null;
          const wasActive =
            createdMs != null &&
            createdMs <= monthEnd.getTime() &&
            (canceledMs == null || canceledMs > monthStart.getTime());
          if (wasActive) {
            active += 1;
            mrrSnapshot += sub.monthlyContributionUsd;
          }
          if (createdMs != null && createdMs >= monthStart.getTime() && createdMs < monthEnd.getTime()) {
            newCount += 1;
          }
          if (canceledMs != null && canceledMs >= monthStart.getTime() && canceledMs < monthEnd.getTime()) {
            churnCount += 1;
          }
        }

        const aiResult = await pool.query(
          `SELECT COALESCE(SUM(cost_usd), 0)::float AS cost_usd
             FROM ai_usage_log a
             JOIN users u ON u.id = a.user_id
            WHERE u.profession = ANY($1::text[])
              AND a.created_at >= $2
              AND a.created_at < $3`,
          [ROLE_ROOM_PROFESSIONS, monthStart.toISOString(), monthEnd.toISOString()],
        );

        months.push({
          monthLabel,
          mrrUsd: mrrSnapshot,
          activeCount: active,
          newCount,
          churnCount,
          aiCostUsd: Number(aiResult.rows[0]?.cost_usd) || 0,
        });
      }

      res.json({ months, meta: { nokPerUsd: NOK_USD } });
    } catch (err) {
      console.error("[admin-room role-room economy] timeseries error", err);
      res.status(500).json({ error: "Kunne ikke beregne tidsserie" });
    }
  });

  // ── Subscription-actions: pause / resume / cancel / reactivate ─────────

  app.post("/api/admin-room/role-room/subscription/:subscriptionId/pause", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const sub = await stripe.subscriptions.update(req.params.subscriptionId, {
        pause_collection: { behavior: "mark_uncollectible" },
      });
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "role_room_subscription",
        entityId: sub.id,
        action: "paused",
        summary: `Stripe sub ${sub.id} pauset (mark_uncollectible)`,
      });
      res.json({ ok: true, subscription: { id: sub.id, status: sub.status, pauseCollection: sub.pause_collection } });
    } catch (err) {
      console.error("[admin-room role-room] pause error", err);
      res.status(500).json({ error: (err as Error).message || "Kunne ikke pause subscription" });
    }
  });

  app.post("/api/admin-room/role-room/subscription/:subscriptionId/resume", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const sub = await stripe.subscriptions.update(req.params.subscriptionId, {
        pause_collection: null,
      });
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "role_room_subscription",
        entityId: sub.id,
        action: "resumed",
        summary: `Stripe sub ${sub.id} resumed`,
      });
      res.json({ ok: true, subscription: { id: sub.id, status: sub.status, pauseCollection: sub.pause_collection } });
    } catch (err) {
      console.error("[admin-room role-room] resume error", err);
      res.status(500).json({ error: (err as Error).message || "Kunne ikke gjenoppta subscription" });
    }
  });

  app.post("/api/admin-room/role-room/subscription/:subscriptionId/cancel", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const immediate = body.immediate === true;
    try {
      const sub = immediate
        ? await stripe.subscriptions.cancel(req.params.subscriptionId)
        : await stripe.subscriptions.update(req.params.subscriptionId, {
            cancel_at_period_end: true,
            cancellation_details: typeof body.reason === "string" ? { comment: body.reason } : undefined,
          });
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "role_room_subscription",
        entityId: sub.id,
        action: immediate ? "canceled_immediate" : "canceled_at_period_end",
        summary: `Stripe sub ${sub.id} ${immediate ? "kansellert umiddelbart" : "kanselleres ved periode-slutt"}`,
        details: typeof body.reason === "string" ? { reason: body.reason } : undefined,
      });
      // Stripe v19: current_period_end er flyttet fra Subscription til items.data[i].
      const firstItem = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
      const periodEnd = firstItem?.current_period_end ?? null;
      res.json({
        ok: true,
        subscription: {
          id: sub.id,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        },
      });
    } catch (err) {
      console.error("[admin-room role-room] cancel error", err);
      res.status(500).json({ error: (err as Error).message || "Kunne ikke kansellere subscription" });
    }
  });

  app.post("/api/admin-room/role-room/subscription/:subscriptionId/reactivate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Role Room Stripe-konto er ikke konfigurert" });
      return;
    }
    try {
      const sub = await stripe.subscriptions.update(req.params.subscriptionId, {
        cancel_at_period_end: false,
      });
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "role_room_subscription",
        entityId: sub.id,
        action: "reactivated",
        summary: `Stripe sub ${sub.id} reaktivert (cancel-at-period-end fjernet)`,
      });
      res.json({ ok: true, subscription: { id: sub.id, status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end } });
    } catch (err) {
      console.error("[admin-room role-room] reactivate error", err);
      res.status(500).json({ error: (err as Error).message || "Kunne ikke reaktivere subscription" });
    }
  });

  // ── Platform fixed costs CRUD ─────────────────────────────────────────

  app.get("/api/admin-room/platform-fixed-costs", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM platform_fixed_costs WHERE user_id = $1 ORDER BY active DESC, amount_usd_monthly DESC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[admin-room platform-fixed-costs] list error", err);
      res.status(500).json({ error: "Kunne ikke hente plattform-kostnader" });
    }
  });

  app.post("/api/admin-room/platform-fixed-costs", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    const amount = asNumberOrNull(body.amountUsdMonthly);
    if (!name || amount == null) {
      res.status(400).json({ error: "name og amountUsdMonthly er påkrevd" });
      return;
    }
    const category = asString(body.category, "other") ?? "other";
    const allocation = asString(body.allocationMethod, "total_platform") ?? "total_platform";
    const billing = asString(body.billingInterval, "monthly") ?? "monthly";
    if (!VALID_CATEGORIES.has(category) || !VALID_ALLOC.has(allocation) || !VALID_BILLING.has(billing)) {
      res.status(400).json({ error: "Ugyldig category/allocation/billing" });
      return;
    }
    const sharePct = asNumberOrNull(body.roleRoomSharePct) ?? 25;
    try {
      const result = await pool.query(
        `INSERT INTO platform_fixed_costs
           (user_id, name, vendor, category, amount_usd_monthly,
            amount_native_monthly, native_currency, allocation_method,
            role_room_share_pct, billing_interval, active, starts_on, ends_on, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, TRUE), $12, $13, $14)
         RETURNING *`,
        [
          session.userId,
          name,
          asString(body.vendor),
          category,
          amount,
          asNumberOrNull(body.amountNativeMonthly),
          asString(body.nativeCurrency),
          allocation,
          sharePct,
          billing,
          typeof body.active === "boolean" ? body.active : true,
          asString(body.startsOn),
          asString(body.endsOn),
          asString(body.notes),
        ],
      );
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "platform_fixed_cost",
        entityId: result.rows[0].id,
        action: "created",
        summary: `${name} ($${amount}/mnd, ${allocation})`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-room platform-fixed-costs] create error", err);
      res.status(500).json({ error: "Kunne ikke opprette plattform-kostnad" });
    }
  });

  app.patch("/api/admin-room/platform-fixed-costs/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [];
    function set(column: string, value: unknown) {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    }
    if (body.name !== undefined) set("name", asString(body.name));
    if (body.vendor !== undefined) set("vendor", asString(body.vendor));
    if (body.category !== undefined) {
      const next = asString(body.category);
      if (!next || !VALID_CATEGORIES.has(next)) { res.status(400).json({ error: "Ugyldig category" }); return; }
      set("category", next);
    }
    if (body.amountUsdMonthly !== undefined) set("amount_usd_monthly", asNumberOrNull(body.amountUsdMonthly));
    if (body.amountNativeMonthly !== undefined) set("amount_native_monthly", asNumberOrNull(body.amountNativeMonthly));
    if (body.nativeCurrency !== undefined) set("native_currency", asString(body.nativeCurrency));
    if (body.allocationMethod !== undefined) {
      const next = asString(body.allocationMethod);
      if (!next || !VALID_ALLOC.has(next)) { res.status(400).json({ error: "Ugyldig allocation" }); return; }
      set("allocation_method", next);
    }
    if (body.roleRoomSharePct !== undefined) set("role_room_share_pct", asNumberOrNull(body.roleRoomSharePct));
    if (body.billingInterval !== undefined) {
      const next = asString(body.billingInterval);
      if (!next || !VALID_BILLING.has(next)) { res.status(400).json({ error: "Ugyldig billing" }); return; }
      set("billing_interval", next);
    }
    if (body.active !== undefined && typeof body.active === "boolean") set("active", body.active);
    if (body.startsOn !== undefined) set("starts_on", asString(body.startsOn));
    if (body.endsOn !== undefined) set("ends_on", asString(body.endsOn));
    if (body.notes !== undefined) set("notes", asString(body.notes));

    if (updates.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    updates.push(`updated_at = NOW()`);
    params.push(session.userId);
    params.push(req.params.id);
    try {
      const result = await pool.query(
        `UPDATE platform_fixed_costs
            SET ${updates.join(", ")}
          WHERE user_id = $${params.length - 1} AND id = $${params.length}
          RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Kostnad ikke funnet" });
        return;
      }
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "platform_fixed_cost",
        entityId: req.params.id,
        action: "updated",
        summary: result.rows[0].name,
      });
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-room platform-fixed-costs] update error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere kostnad" });
    }
  });

  app.delete("/api/admin-room/platform-fixed-costs/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM platform_fixed_costs WHERE user_id = $1 AND id = $2 RETURNING name`,
        [session.userId, req.params.id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Kostnad ikke funnet" });
        return;
      }
      await deps.logAdminActivity({
        userId: session.userId,
        entityType: "platform_fixed_cost",
        entityId: req.params.id,
        action: "deleted",
        summary: result.rows[0].name,
      });
      res.status(204).end();
    } catch (err) {
      console.error("[admin-room platform-fixed-costs] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette kostnad" });
    }
  });
}
