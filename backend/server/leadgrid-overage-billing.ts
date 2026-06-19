/**
 * leadgrid-overage-billing.ts
 *
 * Daglig cron-job som:
 *   1. Beregner gårsdagens overage per API-key (via computeDailyOverage)
 *   2. Sender Stripe meter-events for hver overage-rad
 *   3. Markerer rader som billed
 *
 * Stripe Meter: STRIPE_LEADGRID_OVERAGE_METER + event_name
 *               leadgrid_api_overage_call
 *
 * Payload til Stripe:
 *   { event_name, payload: { stripe_customer_id, value: <overage_calls> },
 *     identifier: <api_key_id-day-uniq>, timestamp }
 *
 * Auth: x-cron-trigger-token (samme som drips + grace + reverification)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { computeDailyOverage } from "./partner-api-rate-limiter.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";
const METER_EVENT_NAME = process.env.STRIPE_LEADGRID_OVERAGE_METER_EVENT_NAME
  ?? "leadgrid_api_overage_call";
const STRIPE_KEY = process.env.CREATORHUB_STRIPE_SECRET_KEY
  ?? process.env.STRIPE_SECRET_KEY
  ?? "";

function isCronAuthorized(req: Request): boolean {
  const t = req.headers["x-cron-trigger-token"] as string | undefined;
  return !!t && !!CRON_TOKEN && t === CRON_TOKEN;
}

interface UnbilledOverage {
  log_id: string;
  api_key_id: string;
  day: string;
  overage_calls: number;
  overage_charge_oere: number;
  stripe_customer_id: string | null;
  org_name: string;
  tier: string;
}

async function reportMeterEvent(
  identifier: string, stripeCustomerId: string, valueUnits: number,
  timestampUnix: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!STRIPE_KEY) return { ok: false, error: "Stripe ikke konfigurert" };
  try {
    const body = new URLSearchParams();
    body.set("event_name", METER_EVENT_NAME);
    body.set("identifier", identifier);
    body.set("timestamp", String(timestampUnix));
    body.set("payload[stripe_customer_id]", stripeCustomerId);
    body.set("payload[value]", String(valueUnits));

    const r = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (r.ok || r.status === 200 || r.status === 201) {
      return { ok: true };
    }
    const errText = await r.text();
    return { ok: false, error: `HTTP ${r.status}: ${errText.slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

export function registerLeadgridOverageBillingRoutes({
  app, pool, activeSessions,
}: Deps): void {

  // ---------- Compute + report daily overage ----------
  app.post("/api/leadgrid/api-overage/process", async (req, res) => {
    if (!isCronAuthorized(req)) {
      const auth = req.headers.authorization;
      const token = auth?.startsWith("Bearer ") ? auth.substring(7)
                  : (req as any).cookies?.sessionToken;
      const s = token ? activeSessions.get(token) : null;
      if (s?.role !== "super_admin") {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const start = Date.now();
    const results = { computed: 0, reported: 0, errors: 0, total_oere: 0 };

    try {
      // Steg 1: Beregn gårsdagens overage
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const computed = await computeDailyOverage(pool, yesterday);
      results.computed = computed.processed;
      results.total_oere = computed.total_overage_oere;

      // Steg 2: Hent unbilled rows som har overage > 0
      const unbilledR = await pool.query<UnbilledOverage>(
        `SELECT o.id::text AS log_id, o.api_key_id::text, o.day::text,
                o.overage_calls, o.overage_charge_oere,
                org.stripe_customer_id, org.name AS org_name,
                COALESCE(p.tier, 'production') AS tier
           FROM api_overage_log o
           JOIN partner_api_keys k ON k.id = o.api_key_id
           JOIN organizations org ON org.id = k.organization_id
           LEFT JOIN leadgrid_partners p ON p.id = k.partner_id
          WHERE o.billed_at IS NULL
            AND o.overage_calls > 0
            AND o.overage_charge_oere > 0
            AND org.stripe_customer_id IS NOT NULL
          ORDER BY o.day ASC
          LIMIT 100`,
      );

      // Steg 3: Send meter-events per rad
      for (const row of unbilledR.rows) {
        const identifier = `lg_overage_${row.api_key_id}_${row.day}`;
        const timestamp = Math.floor(new Date(row.day).getTime() / 1000);
        const r = await reportMeterEvent(
          identifier, row.stripe_customer_id!,
          row.overage_calls, timestamp,
        );
        if (r.ok) {
          await pool.query(
            `UPDATE api_overage_log SET billed_at = now() WHERE id = $1`,
            [row.log_id],
          );
          results.reported++;
          console.log(`[overage-billing] reported ${row.overage_calls} calls for ${row.org_name}, ${(row.overage_charge_oere / 100).toFixed(2)} NOK`);
        } else {
          results.errors++;
          console.error(`[overage-billing] meter-report failed for ${row.log_id}: ${r.error}`);
        }
      }

      res.json({
        ok: true, duration_ms: Date.now() - start, ...results,
      });
    } catch (e: any) {
      console.error("[overage-billing]", e);
      res.status(500).json({ error: e.message ?? "Feil" });
    }
  });

  // ---------- Superadmin: hent overage-stats ----------
  app.get("/api/superadmin/overage-stats", async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.substring(7)
                : (req as any).cookies?.sessionToken;
    const s = token ? activeSessions.get(token) : null;
    if (s?.role !== "super_admin") return res.status(403).json({ error: "Krever super-admin" });

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE billed_at IS NULL AND overage_calls > 0) AS unbilled_rows,
         COALESCE(SUM(overage_charge_oere) FILTER (WHERE billed_at IS NULL), 0) AS unbilled_oere,
         COALESCE(SUM(overage_charge_oere) FILTER (WHERE billed_at IS NOT NULL
           AND billed_at > now() - interval '30 days'), 0) AS billed_30d_oere,
         COALESCE(SUM(overage_calls) FILTER (WHERE day > now()::date - interval '30 days'), 0) AS overage_calls_30d
        FROM api_overage_log`,
    );
    const topR = await pool.query(
      `SELECT k.name AS key_name, org.name AS org_name,
              SUM(o.overage_calls) AS overage_30d,
              SUM(o.overage_charge_oere) AS charge_30d_oere
         FROM api_overage_log o
         JOIN partner_api_keys k ON k.id = o.api_key_id
         JOIN organizations org ON org.id = k.organization_id
        WHERE o.day > now()::date - interval '30 days'
        GROUP BY k.name, org.name
        ORDER BY overage_30d DESC LIMIT 10`,
    );

    res.json({
      ...stats.rows[0],
      top_consumers: topR.rows,
    });
  });
}
