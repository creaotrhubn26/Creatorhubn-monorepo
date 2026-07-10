/**
 * superadmin-debug-routes.ts
 *
 * Admin debug-/diagnose-verktøy. To moduser:
 *   A) Bruker-diagnose  — GET /api/superadmin/debug/user?q=<e-post|id>
 *      Rolle-bevisst sjekk: identitet, godkjenning, compliance (cleared + missing),
 *      magic-link/sesjon, payout, hvilken workspace de lander i. Viser root-cause.
 *   B) System-helse     — GET /api/superadmin/debug/system-health
 *      Integrasjoner/config: DB, PayPal (OAuth), Stripe, Resend, PAYPAL_ENV.
 *
 * Gjenbruker EKTE kodebaner (buildComplianceSummary, paypalHealthCheck) og samme
 * routing-regel som innlogging, så diagnosen matcher virkeligheten. Read-only.
 */

import type express from "express";
import type { Pool } from "pg";
import { buildComplianceSummary, type ComplianceProfile } from "./editing-compliance";
import { paypalHealthCheck } from "./editing-payments-service";

interface Deps {
  app: express.Application;
  pool: Pool;
  activeSessions: Map<string, { userId: string; role: string; impersonatedByAdmin?: boolean }>;
  readSessionToken: (req: express.Request) => string | null | undefined;
}

type Status = "pass" | "fail" | "warn" | "info";
interface Check { key: string; label: string; status: Status; detail: string; fix?: { action: string; label: string } }

// Samme regel som resolvePostLoginRoute (frontend) — hvor lander rollen.
function routeForRole(role: string): string {
  const r = (role || "").toLowerCase();
  if (r === "vendor") return "/vendor-dashboard";
  if (r === "editing_vendor" || r === "editing") return "/partner-portal";
  if (r === "admin" || r === "super_admin") return "/admin";
  return "/workspace";
}

export function setupSuperadminDebugRoutes({ app, pool, activeSessions, readSessionToken }: Deps): void {
  const requireSuperAdmin = async (req: express.Request, res: express.Response): Promise<boolean> => {
    const token = readSessionToken(req);
    const s = token ? activeSessions.get(token) : null;
    if (!s || String(s.role).toLowerCase() !== "super_admin" || s.impersonatedByAdmin) {
      res.status(403).json({ error: "krever_super_admin" });
      return false;
    }
    return true;
  };

  // ── A) Bruker-diagnose ──
  app.get("/api/superadmin/debug/user", async (req, res) => {
    if (!(await requireSuperAdmin(req, res))) return;
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "mangler_q" });
    try {
      const u = (await pool.query<{ id: string; email: string; name: string; role: string; profession: string | null; is_active: boolean | null }>(
        `SELECT id, email, COALESCE(company_name, username, email) AS name, role, profession, is_active
           FROM users WHERE id = $1 OR lower(email) = lower($1) OR email ILIKE $2 LIMIT 1`,
        [q, `%${q}%`],
      )).rows[0];
      if (!u) return res.json({ found: false, query: q });

      const role = String(u.role).toLowerCase();
      const checks: Check[] = [];
      checks.push({ key: "identity", label: "Identitet", status: "pass", detail: `rolle=${u.role} · profesjon=${u.profession || "—"} · ${u.email}` });
      checks.push({ key: "account", label: "Konto aktiv", status: u.is_active === false ? "fail" : "pass", detail: u.is_active === false ? "is_active = false (deaktivert)" : "aktiv" });
      const routesTo = routeForRole(u.role);
      checks.push({ key: "routing", label: "Lander på (innlogging)", status: "info", detail: routesTo });

      // Editing-partner: full compliance-/payout-/magic-link-diagnose.
      if (role === "editing_vendor") {
        const p = (await pool.query(
          `SELECT * FROM vendor_onboarding_profiles WHERE user_id = $1 LIMIT 1`, [u.id],
        )).rows[0];
        if (!p) {
          checks.push({ key: "profile", label: "Vendor-profil", status: "fail", detail: "Ingen vendor_onboarding_profiles-rad" });
        } else {
          checks.push({
            key: "approval", label: "Godkjenning",
            status: p.approval_status === "approved" ? "pass" : "fail",
            detail: `approval_status = ${p.approval_status}`,
          });
          const summary = buildComplianceSummary(p as ComplianceProfile);
          checks.push({
            key: "compliance", label: "Compliance (cleared)",
            status: summary.cleared ? "pass" : "fail",
            detail: summary.cleared ? `Alle krav oppfylt (${summary.verificationPercent}%)` : `${summary.verificationPercent}% · mangler: ${summary.missing.join(", ")}`,
          });
          checks.push({
            key: "payout", label: "Utbetaling konfigurert",
            status: p.payment_connected ? "pass" : "warn",
            detail: p.payment_connected ? `metode = ${p.payout_method || "—"}` : "payment_connected = false (ingen payout-metode registrert)",
          });
          checks.push({
            key: "discovery", label: "Synlig i discovery",
            status: p.quality_flagged ? "warn" : summary.cleared ? "pass" : "info",
            detail: p.quality_flagged
              ? "Kvalitetsflagget → skjult fra discovery (klager)"
              : summary.cleared ? "Synlig (godkjent + cleared)" : "Skjult til compliance er fullført",
          });
        }
        const tok = (await pool.query<{ created_at: string; consumed_at: string | null; revoked_at: string | null; valid: boolean }>(
          `SELECT created_at, consumed_at, revoked_at, (revoked_at IS NULL AND expires_at > now()) AS valid
             FROM editing_partner_portal_tokens WHERE vendor_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [u.id],
        )).rows[0];
        checks.push({
          key: "magic_link", label: "Magic-link / sesjon",
          status: !tok ? "fail" : tok.valid ? (tok.consumed_at ? "pass" : "warn") : "fail",
          detail: !tok ? "Ingen magic-link sendt" : `sendt ${new Date(tok.created_at).toLocaleString("nb-NO")} · ${tok.consumed_at ? `åpnet ${new Date(tok.consumed_at).toLocaleString("nb-NO")}` : "IKKE åpnet"} · ${tok.valid ? "gyldig" : "utløpt/tilbakekalt"}`,
          fix: { action: "resend_link", label: "Send fersk magic-link" },
        });
      }

      // Skaper-brukere (fotograf/videograf/produsent — role 'user'): profesjon,
      // prosjekter (WorkspaceHome-atferd) og abonnement. Defensivt (degraderer).
      if (role === "user" || role === "photographer" || role === "videographer" || role === "music_producer") {
        checks.push({
          key: "profession", label: "Profesjon satt",
          status: u.profession ? "pass" : "warn",
          detail: u.profession ? String(u.profession) : "Ingen profesjon → workspace-ruting kan bli feil/tom",
        });
        try {
          const pc = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM projects WHERE user_id=$1`, [u.id])).rows[0]?.n ?? 0;
          checks.push({ key: "projects", label: "Prosjekter", status: "info", detail: pc === 0 ? "0 prosjekter → «lag ditt første prosjekt»-tilstand" : `${pc} prosjekt(er)` });
        } catch { /* degrader */ }
        try {
          const sub = (await pool.query<{ status: string; plan_id: string | null }>(
            `SELECT status, plan_id FROM user_subscriptions WHERE user_id=$1 ORDER BY created_at DESC NULLS LAST LIMIT 1`, [u.id],
          )).rows[0];
          const active = sub && (sub.status === "active" || sub.status === "trialing");
          checks.push({ key: "subscription", label: "Abonnement", status: active ? "pass" : sub ? "warn" : "info", detail: sub ? `status=${sub.status} · plan=${sub.plan_id || "—"}` : "Ingen abonnement (gratis/uten plan)" });
        } catch { /* degrader */ }
      }

      const rootCause = checks.find((c) => c.status === "fail") || null;
      res.json({ found: true, user: u, routesTo, checks, rootCause });
    } catch (err) {
      console.error("[debug/user]", err);
      res.status(500).json({ error: "diagnose_feilet" });
    }
  });

  // ── B) System-helse ──
  app.get("/api/superadmin/debug/system-health", async (req, res) => {
    if (!(await requireSuperAdmin(req, res))) return;
    const checks: Check[] = [];
    // DB
    try {
      await pool.query("SELECT 1");
      checks.push({ key: "db", label: "Database (Neon)", status: "pass", detail: "Tilkobling OK" });
    } catch (e) {
      checks.push({ key: "db", label: "Database (Neon)", status: "fail", detail: String((e as Error)?.message).slice(0, 120) });
    }
    // PayPal
    try {
      const h = await paypalHealthCheck();
      checks.push({ key: "paypal", label: "PayPal (Payouts)", status: h.ok ? "pass" : h.configured ? "fail" : "warn", detail: h.ok ? `OK (${h.env})` : (h.error || "ikke konfigurert") });
    } catch { checks.push({ key: "paypal", label: "PayPal (Payouts)", status: "fail", detail: "helse-sjekk feilet" }); }
    // Stripe
    checks.push({ key: "stripe", label: "Stripe (innbetaling/payout)", status: process.env.STRIPE_SECRET_KEY ? "pass" : "warn", detail: process.env.STRIPE_SECRET_KEY ? "STRIPE_SECRET_KEY satt" : "STRIPE_SECRET_KEY mangler (kun faktura-vei virker)" });
    // Resend (e-post)
    checks.push({ key: "email", label: "E-post (Resend)", status: process.env.ROLE_ROOM_RESEND_API_KEY ? "pass" : "fail", detail: process.env.ROLE_ROOM_RESEND_API_KEY ? "Resend-nøkkel satt" : "ingen Resend-nøkkel" });
    // Webhook-id
    checks.push({ key: "paypal_webhook", label: "PayPal webhook-verifisering", status: process.env.PAYPAL_WEBHOOK_ID ? "pass" : "warn", detail: process.env.PAYPAL_WEBHOOK_ID ? "PAYPAL_WEBHOOK_ID satt (signatur verifiseres)" : "PAYPAL_WEBHOOK_ID mangler (webhook uverifisert)" });
    // Pending migrations
    try {
      const applied = (await pool.query<{ filename: string }>(`SELECT filename FROM _migrations_applied`)).rows.map((r) => r.filename);
      checks.push({ key: "migrations", label: "Migrasjoner", status: "info", detail: `${applied.length} anvendt (siste: ${applied.sort().slice(-1)[0] || "—"})` });
    } catch {
      checks.push({ key: "migrations", label: "Migrasjoner", status: "info", detail: "_migrations_applied ikke lesbar" });
    }
    res.json({ checks, env: { paypal: process.env.PAYPAL_ENV || "sandbox" } });
  });
}
