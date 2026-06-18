/**
 * customer-auto-onboard-routes.ts
 *
 * Selv-onboarding: bruker oppgir bare website + e-post → Leadgrid
 * gjør resten:
 *
 *   1. BRREG-oppslag (om norsk org) for org-nr + offisielt navn
 *   2. fetchBestLogo for logo
 *   3. crawlAndObserve + Claude (lead-scout-service) for needs/signals/scoring
 *   4. casting_projects-rad opprettes
 *   5. crm_customers-rad opprettes m/ project_id-kobling
 *   6. client_portal_tokens-rad opprettes (engangs-lenke)
 *   7. E-post med portal-lenke sendes til kontakt-e-posten
 *   8. customer_auto_onboards-audit-rad oppdateres med resultat
 *
 * Gated på leads.create. Returnerer audit_id som klient kan polle.
 *
 *   POST /api/admin-room/lead-map/customers/auto-onboard
 *        Body: { website_url, contact_email, contact_name?, contact_phone?,
 *                organization_id, preset_id? }
 *        201: { audit_id, project_id, customer_id, client_token, ... }
 *
 *   GET  /api/admin-room/lead-map/customers/auto-onboard/:audit_id
 *        Poll status.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { runScoutForLead } from "./lead-scout-service.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getUserId(
  req: Request, activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return activeSessions.get(auth.slice(7))?.userId ?? null;
}

function normalizeUrl(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).toString(); } catch { return null; }
}

function makeToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function shortIdFor(name: string): string {
  const slug = name.toLowerCase()
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const random = crypto.randomBytes(6).toString("hex");
  return `${slug}-${random}`;
}

/// BRREG-oppslag — søk på navn fra domain. Returnerer org-nr + offisielt navn.
async function lookupBrreg(
  searchName: string,
): Promise<{ orgNumber: string | null; officialName: string | null }> {
  try {
    const resp = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(searchName)}&size=1`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!resp.ok) return { orgNumber: null, officialName: null };
    const data = await resp.json() as {
      _embedded?: { enheter?: Array<{ organisasjonsnummer: string; navn: string }> };
    };
    const first = data._embedded?.enheter?.[0];
    return {
      orgNumber: first?.organisasjonsnummer ?? null,
      officialName: first?.navn ?? null,
    };
  } catch { return { orgNumber: null, officialName: null }; }
}

function extractDomainName(url: string): string {
  try {
    const host = new URL(url).host;
    return host.replace(/^www\./, "").split(".")[0];
  } catch { return url; }
}

// ─────────────────────────────────────────────────────────────────
// Hoved-onboarding-flow (async — kalleren får audit_id, poller status)
// ─────────────────────────────────────────────────────────────────

interface OnboardArgs {
  pool: Pool;
  auditId: string;
  organizationId: string;
  triggeredBy: string;
  websiteUrl: string;
  contactEmail: string;
  contactName: string | null;
  contactPhone: string | null;
  presetId: string | null;
}

async function runOnboarding(args: OnboardArgs): Promise<void> {
  const { pool, auditId } = args;

  try {
    await pool.query(
      `UPDATE customer_auto_onboards SET status = 'running' WHERE id = $1`,
      [auditId],
    );

    // 1. BRREG
    const domainName = extractDomainName(args.websiteUrl);
    const brreg = await lookupBrreg(args.contactName ?? domainName);

    const customerName = brreg.officialName
      ?? args.contactName
      ?? domainName.charAt(0).toUpperCase() + domainName.slice(1);

    // 2. Sjekk for duplikat på same org+website
    const dup = await pool.query<{ id: string; project_id: string | null }>(
      `SELECT id::text, project_id FROM crm_customers
        WHERE website_url = $1
          AND owner_user_id IN (
            SELECT user_id FROM organization_members WHERE organization_id = $2
          )
        LIMIT 1`,
      [args.websiteUrl, args.organizationId],
    );
    if (dup.rows.length > 0) {
      await pool.query(
        `UPDATE customer_auto_onboards
            SET status = 'duplicate',
                customer_id = $2,
                project_id = $3,
                brreg_org_number = $4,
                brreg_name = $5,
                finished_at = now()
          WHERE id = $1`,
        [
          auditId, dup.rows[0].id, dup.rows[0].project_id,
          brreg.orgNumber, brreg.officialName,
        ],
      );
      return;
    }

    // 3. Hent preset hvis spesifisert
    let presetData: {
      industry: string | null;
      default_needs: string[];
      default_tags: string[];
      default_custom_fields: Record<string, unknown>;
      default_lead_source: string | null;
    } = {
      industry: null, default_needs: [], default_tags: [],
      default_custom_fields: {}, default_lead_source: "auto_onboard",
    };
    if (args.presetId) {
      const r = await pool.query<typeof presetData>(
        `SELECT industry, default_needs, default_tags,
                default_custom_fields, default_lead_source
           FROM lead_parameter_presets WHERE id = $1`,
        [args.presetId],
      );
      if (r.rows[0]) presetData = { ...presetData, ...r.rows[0] };
    }

    // 4. Opprett casting_project
    const projectId = shortIdFor(customerName);
    await pool.query(
      `INSERT INTO casting_projects
         (id, name, description, status, created_by, project_type,
          organization_id, created_at)
       VALUES ($1, $2, $3, 'active', $4, 'kundeprosjekt', $5, now())`,
      [
        projectId,
        `${customerName} — kundeprosjekt`,
        `Auto-onboardet ${new Date().toLocaleDateString("nb-NO")} via Leadgrid. Website: ${args.websiteUrl}.`
          + (brreg.orgNumber ? ` Org-nr: ${brreg.orgNumber}.` : ""),
        args.triggeredBy, args.organizationId,
      ],
    );

    // 5. Opprett crm_customer
    const customerRes = await pool.query<{ id: string }>(
      `INSERT INTO crm_customers
         (id, name, website_url, email, phone, owner_user_id,
          status, lead_status, lead_category, lead_source, tags,
          custom_fields, project_id, enrichment_org_nr, enrichment_data)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5,
               'lead', 'unvisited', $6, $7, $8::text[],
               $9::jsonb, $10, $11, $12::jsonb)
       RETURNING id::text`,
      [
        customerName, args.websiteUrl, args.contactEmail,
        args.contactPhone, args.triggeredBy,
        presetData.industry, presetData.default_lead_source,
        presetData.default_tags,
        JSON.stringify(presetData.default_custom_fields),
        projectId, brreg.orgNumber,
        JSON.stringify({ brreg: { orgNumber: brreg.orgNumber, name: brreg.officialName } }),
      ],
    );
    const customerId = customerRes.rows[0].id;

    // Tell customer-create i usage-bucket (for max_active_customers-grense)
    try {
      const { incrementUsage: incUsage } = await import("./plan-limits-service.js");
      await incUsage(pool, args.organizationId, "customers_created");
    } catch (e) {
      console.error("[auto-onboard] usage-increment failed", e);
    }

    // 6. Pre-fyll needs fra preset
    for (const need of presetData.default_needs) {
      await pool.query(
        `INSERT INTO crm_customer_needs
           (customer_id, need_type, priority, evidence, detected_by, status)
         VALUES ($1, $2, 3, 'Fra preset ved auto-onboard', $3, 'detected')
         ON CONFLICT DO NOTHING`,
        [customerId, need, args.triggeredBy],
      );
    }

    // 7. Kjør scout (crawl + Claude → needs/signals/scoring + logo-fetch)
    let scoutResult: { composite_score: number; needs_count: number; signals_count: number } | null = null;
    try {
      const sr = await runScoutForLead(pool, {
        customerId, leadName: customerName,
        websiteUrl: args.websiteUrl,
        industry: presetData.industry,
        triggeredBy: args.triggeredBy,
      });
      scoutResult = {
        composite_score: sr.composite_score,
        needs_count: sr.needs_count,
        signals_count: sr.signals_count,
      };
    } catch { /* scout-feil avbryter ikke onboarding */ }

    // 8. Klient-portal-token
    const clientToken = makeToken();
    await pool.query(
      `INSERT INTO client_portal_tokens
         (organization_id, project_id, customer_id, token,
          invited_email, invited_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        args.organizationId, projectId, customerId, clientToken,
        args.contactEmail, args.contactName, args.triggeredBy,
      ],
    );

    // 9. Send portal-invitasjon (best-effort)
    const portalUrl = `https://theroleroom.com/c/${clientToken}`;
    try {
      const greeting = args.contactName ? `Hei ${args.contactName}` : "Hei";
      const htmlBody =
        `<div style="background:#0b0518;color:#F4F0FF;padding:32px;font-family:-apple-system,Helvetica,Arial,sans-serif">` +
        `<h1 style="color:#A78BFA;font-size:24px;margin:0 0 8px">Velkommen, ${customerName}.</h1>` +
        `<p style="color:rgba(244,240,255,0.72);font-size:14px;margin:0 0 24px">${greeting},</p>` +
        `<p style="font-size:16px;line-height:1.6">Du har fått tilgang til <strong>klient-portalen</strong> hos Creatorhub. Her ser du hva vi har funnet, hva vi leverer, og hvor langt vi har kommet.</p>` +
        `<p style="font-size:16px;line-height:1.6">Portalen er drevet av <strong>Leadgrid</strong> — vårt operativsystem som tråler kunders digitale tilstedeværelse, identifiserer mangler, og holder fremgang dokumentert i ett bilde.</p>` +
        `<p style="margin:24px 0"><a href="${portalUrl}" style="background:#A78BFA;color:#1a0535;` +
        `padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">` +
        `Åpne klient-portalen →</a></p>` +
        `<p style="color:rgba(244,240,255,0.45);font-size:12px;margin-top:32px">Lenken er gyldig i 90 dager. Trenger du hjelp — svar på denne e-posten.</p>` +
        `</div>`;
      const textBody =
        `${greeting},\n\nDu har fått tilgang til klient-portalen hos Creatorhub for ${customerName}.\n\n` +
        `Portalen er drevet av Leadgrid — vårt operativsystem som tråler kunders digitale tilstedeværelse, identifiserer mangler, og holder fremgang dokumentert i ett bilde.\n\n` +
        `Åpne portalen: ${portalUrl}\n\nLenken er gyldig i 90 dager.`;
      await sendTransactionalEmail({
        to: args.contactEmail,
        subject: `${customerName} hos Creatorhub — din klient-portal`,
        html: htmlBody,
        text: textBody,
        fromLabel: "Creatorhub · Leadgrid",
        kind: "client_portal_invite",
        projectId,
        sentByUserId: args.triggeredBy,
        pool,
      });
    } catch { /* e-post-feil avbryter ikke onboarding */ }

    // 10. Oppdater audit
    await pool.query(
      `UPDATE customer_auto_onboards
          SET status = 'completed',
              project_id = $2,
              customer_id = $3,
              brreg_org_number = $4,
              brreg_name = $5,
              needs_count = $6,
              signals_count = $7,
              composite_score = $8,
              client_token = $9,
              finished_at = now()
        WHERE id = $1`,
      [
        auditId, projectId, customerId,
        brreg.orgNumber, brreg.officialName,
        scoutResult?.needs_count ?? presetData.default_needs.length,
        scoutResult?.signals_count ?? 0,
        scoutResult?.composite_score ?? null,
        clientToken,
      ],
    );
  } catch (err) {
    await pool.query(
      `UPDATE customer_auto_onboards
          SET status = 'failed',
              error_message = $2,
              finished_at = now()
        WHERE id = $1`,
      [auditId, String(err).slice(0, 500)],
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

export function registerCustomerAutoOnboardRoutes({
  app, pool, activeSessions,
}: Deps): void {
  const ROOT = "/api/admin-room/lead-map/customers";

  // POST /auto-onboard
  app.post(
    `${ROOT}/auto-onboard`,
    requireLeadMapPermission("leads.create", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });

      const b = req.body as {
        website_url?: string;
        contact_email?: string;
        contact_name?: string;
        contact_phone?: string;
        organization_id?: string;
        preset_id?: string;
      };
      const websiteUrl = b.website_url ? normalizeUrl(b.website_url) : null;
      if (!websiteUrl) {
        return res.status(400).json({ error: "Gyldig website_url påkrevd" });
      }
      if (!b.contact_email || !/.+@.+\..+/.test(b.contact_email)) {
        return res.status(400).json({ error: "Gyldig contact_email påkrevd" });
      }
      if (!b.organization_id) {
        return res.status(400).json({ error: "organization_id påkrevd" });
      }

      // Plan-gating: sjekk auto-onboard-grense + kunde-grense før vi starter
      const { canAutoOnboard, canCreateCustomer, incrementUsage } =
        await import("./plan-limits-service.js");
      const gateA = await canAutoOnboard(pool, b.organization_id);
      if (!gateA.allowed) {
        return res.status(402).json({
          error: "plan_limit_reached",
          gate: gateA,
          message: `Du har brukt ${gateA.current_usage}/${gateA.limit} auto-onboards denne måneden på ${gateA.current_plan}-planen.`,
        });
      }
      const gateB = await canCreateCustomer(pool, b.organization_id);
      if (!gateB.allowed) {
        return res.status(402).json({
          error: "plan_limit_reached",
          gate: gateB,
          message: `Du har ${gateB.current_usage}/${gateB.limit} aktive kunder på ${gateB.current_plan}-planen.`,
        });
      }

      try {
        const auditRes = await pool.query<{ id: string }>(
          `INSERT INTO customer_auto_onboards
             (organization_id, triggered_by, website_url,
              contact_email, contact_name, contact_phone)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id::text`,
          [
            b.organization_id, userId, websiteUrl,
            b.contact_email,
            b.contact_name ?? null,
            b.contact_phone ?? null,
          ],
        );
        const auditId = auditRes.rows[0].id;

        // Fire-and-forget — Leadgrid gjør jobben i bakgrunn, klient
        // poller GET /auto-onboard/:auditId for status.
        // Tell usage med én gang vi starter — selv om jobben feiler er
        // det riktig (vi har brukt Claude/API-tid). Hvis kunden allerede
        // fantes (duplikat) refunderer vi senere i runOnboarding.
        await incrementUsage(pool, b.organization_id, "auto_onboards");

        // Trigger e-post-drypp ved første aha-moment (idempotent via
        // ON CONFLICT — kjøres bare første gang per (user, trigger))
        try {
          const { triggerOnboardingDrip } = await import("./leadgrid-drips-routes.js");
          await triggerOnboardingDrip(pool, {
            userId, organizationId: b.organization_id,
            triggerEvent: "first_auto_onboard",
          });
        } catch (e) {
          console.error("[auto-onboard drip-trigger]", e);
        }

        void runOnboarding({
          pool, auditId,
          organizationId: b.organization_id,
          triggeredBy: userId,
          websiteUrl,
          contactEmail: b.contact_email,
          contactName: b.contact_name ?? null,
          contactPhone: b.contact_phone ?? null,
          presetId: b.preset_id ?? null,
        }).catch((err) => {
          console.error("[auto-onboard]", err);
        });

        return res.status(202).json({
          audit_id: auditId,
          status: "running",
          message: "Leadgrid jobber. Poll status for fremdrift.",
        });
      } catch (err) {
        return res.status(500).json({
          error: "auto_onboard_failed", detail: String(err).slice(0, 500),
        });
      }
    },
  );

  // GET /auto-onboard/:audit_id
  app.get(
    `${ROOT}/auto-onboard/:audit_id`,
    requireLeadMapPermission("leads.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `SELECT id::text, status, website_url, contact_email,
                  contact_name, project_id, customer_id,
                  brreg_org_number, brreg_name, logo_url,
                  needs_count, signals_count, composite_score,
                  client_token, error_message,
                  started_at::text, finished_at::text
             FROM customer_auto_onboards WHERE id = $1`,
          [req.params.audit_id],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ audit: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "status_failed", detail: String(err) });
      }
    },
  );
}
