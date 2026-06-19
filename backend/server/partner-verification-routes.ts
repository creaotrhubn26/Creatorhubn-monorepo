/**
 * partner-verification-routes.ts
 *
 * Multi-step partner-søknad m/ verification-state-machine, document
 * upload, risk-scoring, sandbox-→-production-flow.
 *
 * State-machine:
 *   draft → submitted → under_review → (needs_more_info | business_verified)
 *   → technical_review → sandbox_approved → production_pending
 *   → approved → active → (restricted | suspended) → rejected | expired
 *
 * Public endpoints:
 *   POST /api/leadgrid/partner-application/save-step (lagre én seksjon — draft)
 *   POST /api/leadgrid/partner-application/submit (signal at draft er ferdig)
 *   POST /api/leadgrid/partner-application/document (upload-URL — TBD)
 *   GET  /api/leadgrid/partner-application/my (hent egen pågående søknad)
 *
 * Superadmin endpoints:
 *   POST /api/superadmin/partner-applications/:id/transition (state-bytte)
 *   POST .../:id/risk-scores (sett alle 5 + risk_level)
 *   POST .../:id/grant-sandbox (opprett sandbox-key + environment)
 *   POST .../:id/promote-to-production (krever sandbox tested OK)
 *   GET  .../:id/full (alle felter + dokumenter + history + alerts)
 *   POST .../:id/alert (manuelt opprett alert)
 *   POST .../alerts/:alertId/acknowledge
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import multer from "multer";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import {
  uploadPartnerDocument, presignPartnerDocument, deletePartnerDocument,
} from "./partner-documents-service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";

function isCronAuthorized(req: Request): boolean {
  const t = req.headers["x-cron-trigger-token"] as string | undefined;
  return !!t && !!CRON_TOKEN && t === CRON_TOKEN;
}

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response, pool: Pool, sessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, sessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [s.userId]);
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" }); return null;
  }
  return s;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn", "rejected"],
  under_review: ["needs_more_info", "business_verified", "rejected"],
  needs_more_info: ["under_review", "withdrawn"],
  business_verified: ["technical_review", "approved", "rejected"],
  technical_review: ["sandbox_approved", "needs_more_info", "rejected"],
  sandbox_approved: ["production_pending", "needs_more_info", "rejected"],
  production_pending: ["approved", "needs_more_info", "rejected"],
  approved: ["active", "restricted", "suspended"],
  active: ["restricted", "suspended", "expired"],
  restricted: ["active", "suspended", "expired"],
  suspended: ["active", "rejected", "expired"],
  rejected: [],
  expired: ["active"],
  withdrawn: [],
  pending: ["under_review", "rejected", "withdrawn"],  // back-compat
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Risk-scoring helper
// ---------------------------------------------------------------------------

function calculateRiskLevel(scores: {
  business: number; technical: number; security: number; gdpr: number; customer: number;
}): "low" | "medium" | "high" | "very_high" {
  const avg = (scores.business + scores.technical + scores.security + scores.gdpr + scores.customer) / 5;
  // Sikkerhet og GDPR er kritiske — lav score her = automatisk høyere risk
  if (scores.security < 40 || scores.gdpr < 40) return "very_high";
  if (avg < 50) return "high";
  if (avg < 70) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Auto webhook test
// ---------------------------------------------------------------------------

async function testWebhookEndpoint(url: string, signingSecret: string): Promise<{
  passed: boolean; status: number; duration_ms: number; error?: string;
}> {
  const start = Date.now();
  const eventId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    test: true,
    event_type: "test.verification_ping",
    message: "Dette er en automatisk test fra Leadgrid",
  });
  const signature = crypto.createHmac("sha256", signingSecret)
    .update(`${timestamp}.${payload}`).digest("hex");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Leadgrid-Signature": `sha256=${signature}`,
        "X-Leadgrid-Event": "test.verification_ping",
        "X-Leadgrid-Delivery": eventId,
        "X-Leadgrid-Timestamp": String(timestamp),
        "User-Agent": "Leadgrid-Webhook-Test/1.0",
      },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const duration_ms = Date.now() - start;
    return {
      passed: r.status >= 200 && r.status < 300,
      status: r.status, duration_ms,
    };
  } catch (e: any) {
    return {
      passed: false, status: 0,
      duration_ms: Date.now() - start,
      error: e.message ?? String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerPartnerVerificationRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Public: lagre én step (draft) ----------
  // POST { applicationId?, stepNumber, data: { ... } }
  app.post("/api/leadgrid/partner-application/save-step", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const { applicationId, stepNumber, data } = req.body ?? {};
    if (!stepNumber || stepNumber < 1 || stepNumber > 7) {
      return res.status(400).json({ error: "Ugyldig stepNumber (1-7)" });
    }
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "data påkrevd" });
    }

    try {
      let appId = applicationId;
      let orgId: string | null = null;

      if (appId) {
        const own = await pool.query(
          `SELECT 1 FROM partner_applications WHERE id = $1 AND applicant_user_id = $2`,
          [appId, session.userId],
        );
        if (own.rows.length === 0) return res.status(403).json({ error: "Ikke din søknad" });
      } else {
        // Opprett ny draft + tilhørende stub-org hvis ikke finnes
        const memR = await pool.query<{ organization_id: string }>(
          `SELECT organization_id FROM organization_members WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
          [session.userId],
        );
        if (memR.rows.length === 0) {
          return res.status(400).json({ error: "Du må være org-admin for å starte en partner-søknad" });
        }
        orgId = memR.rows[0].organization_id;
        const newR = await pool.query<{ id: string }>(
          `INSERT INTO partner_applications
            (organization_id, applicant_user_id, origin, partner_type,
             status, current_step, draft_saved_at)
           VALUES ($1, $2, 'self_service', 'integration',
                   'draft', $3, now())
           RETURNING id::text`,
          [orgId, session.userId, stepNumber],
        );
        appId = newR.rows[0].id;
      }

      // Bygg dynamisk UPDATE-set basert på hvilken step
      const allowedColumnsByStep: Record<number, string[]> = {
        1: ["org_number", "country", "industry", "employees_count", "contact_phone"],
        2: ["partner_type", "requested_tier", "service_description", "customer_segments", "why_leadgrid"],
        3: ["use_case_description", "uses_api", "uses_webhooks", "wants_marketplace_listing", "wants_reseller"],
        4: ["requested_scopes", "data_flow_description", "webhook_endpoint_url", "expected_volume",
            "has_developer_docs", "developer_docs_url", "technical_contact_email", "technical_contact_name"],
        5: ["processes_personal_data", "personal_data_types", "data_storage_location",
            "data_within_eu_eea", "uses_subprocessors", "subprocessors_list", "has_dpa",
            "can_sign_leadgrid_dpa", "data_deletion_routine", "access_request_routine",
            "incident_response_contact", "data_retention_days", "encrypts_in_transit",
            "encrypts_at_rest", "has_internal_access_control"],
        6: [], // Documents — håndteres separat
        7: ["terms_version"], // Confirmation
      };
      const cols = allowedColumnsByStep[stepNumber] ?? [];
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      for (const col of cols) {
        if (col in data) {
          if (col === "requested_scopes") {
            updates.push(`${col} = $${i++}::text[]`);
          } else {
            updates.push(`${col} = $${i++}`);
          }
          values.push(data[col]);
        }
      }

      updates.push(`current_step = GREATEST(current_step, $${i++})`);
      values.push(stepNumber);
      updates.push(`steps_completed = (
        SELECT array_agg(DISTINCT s) FROM unnest(steps_completed || ARRAY[$${i++}]::int[]) AS s
      )`);
      values.push(stepNumber);
      updates.push(`draft_saved_at = now()`);

      values.push(appId);
      await pool.query(
        `UPDATE partner_applications SET ${updates.join(", ")} WHERE id = $${i}`,
        values,
      );

      res.json({ ok: true, application_id: appId, step: stepNumber });
    } catch (e: any) {
      console.error("[save-step]", e);
      res.status(500).json({ error: "Kunne ikke lagre step", detail: e.message?.slice(0, 200) });
    }
  });

  // ---------- Public: hent min pågående søknad ----------
  app.get("/api/leadgrid/partner-application/my", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const r = await pool.query(
      `SELECT pa.*, o.name AS organization_name,
              (SELECT COUNT(*) FROM partner_application_documents WHERE application_id = pa.id) AS document_count
         FROM partner_applications pa
         JOIN organizations o ON o.id = pa.organization_id
        WHERE pa.applicant_user_id = $1
        ORDER BY pa.created_at DESC LIMIT 1`,
      [session.userId],
    );
    res.json({ application: r.rows[0] ?? null });
  });

  // ---------- Public: submit draft ----------
  app.post("/api/leadgrid/partner-application/submit", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const { applicationId } = req.body ?? {};
    if (!applicationId) return res.status(400).json({ error: "applicationId påkrevd" });

    const own = await pool.query<{ status: string; uses_api: boolean }>(
      `SELECT status, uses_api FROM partner_applications
        WHERE id = $1 AND applicant_user_id = $2`,
      [applicationId, session.userId],
    );
    if (own.rows.length === 0) return res.status(403).json({ error: "Ikke din søknad" });
    if (own.rows[0].status !== "draft") {
      return res.status(409).json({ error: `Kan ikke submitte i status '${own.rows[0].status}'` });
    }

    const newStatus = "submitted";
    await pool.query(
      `UPDATE partner_applications
          SET status = $1, submitted_at = now(),
              consent_at = now(), updated_at = now()
        WHERE id = $2`,
      [newStatus, applicationId],
    );
    await pool.query(
      `INSERT INTO partner_application_history
        (application_id, from_status, to_status, transitioned_by, internal_notes)
       VALUES ($1, 'draft', $2, $3, 'Submitted via public form')`,
      [applicationId, newStatus, session.userId],
    );

    // Lag admin-alert
    await pool.query(
      `INSERT INTO partner_admin_alerts
        (application_id, alert_type, severity, message)
       VALUES ($1, 'new_application', 'info', $2)`,
      [applicationId, `Ny partner-søknad submittet${own.rows[0].uses_api ? " (krever API-tilgang)" : ""}`],
    );

    res.json({ ok: true, status: newStatus });
  });

  // ---------- Superadmin: state-transition ----------
  app.post("/api/superadmin/partner-applications/:id/transition", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { toStatus, internalNotes, clientMessage, visibleToApplicant } = req.body ?? {};
    if (!toStatus) return res.status(400).json({ error: "toStatus påkrevd" });

    const cur = await pool.query<{ status: string; applicant_user_id: string;
                                    organization_id: string; partner_type: string; }>(
      `SELECT status, applicant_user_id, organization_id, partner_type
         FROM partner_applications WHERE id = $1`,
      [req.params.id],
    );
    if (cur.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const fromStatus = cur.rows[0].status;
    if (!canTransition(fromStatus, toStatus)) {
      return res.status(409).json({
        error: `Ugyldig overgang ${fromStatus} → ${toStatus}`,
        allowed: VALID_TRANSITIONS[fromStatus] ?? [],
      });
    }

    await pool.query(
      `UPDATE partner_applications SET status = $1, updated_at = now() WHERE id = $2`,
      [toStatus, req.params.id],
    );
    await pool.query(
      `INSERT INTO partner_application_history
        (application_id, from_status, to_status, transitioned_by,
         internal_notes, visible_to_applicant, client_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.params.id, fromStatus, toStatus, s.userId,
        internalNotes ?? null, !!visibleToApplicant, clientMessage ?? null,
      ],
    );

    // Notify applicant hvis visible_to_applicant
    if (visibleToApplicant && clientMessage) {
      const userR = await pool.query<{ email: string }>(
        `SELECT email FROM users WHERE id = $1`,
        [cur.rows[0].applicant_user_id],
      );
      if (userR.rows[0]?.email) {
        try {
          await sendTransactionalEmail({
            to: userR.rows[0].email,
            subject: `Oppdatering om partner-søknaden`,
            html: `<p>Hei,</p>
                   <p>Det er en oppdatering på partner-søknaden din:</p>
                   <p><strong>Status:</strong> ${toStatus}</p>
                   <blockquote>${clientMessage}</blockquote>
                   <p><a href="${PUBLIC_BASE}/leadgrid/innstillinger/partnerskap">Åpne partner-dashboard</a></p>`,
            text: `Status: ${toStatus}\n\n${clientMessage}\n\n${PUBLIC_BASE}/leadgrid/innstillinger/partnerskap`,
            kind: "partner_application_status_change",
            sentByUserId: s.userId, pool,
          });
        } catch (e) { console.error("[notify mail]", e); }
      }
    }

    res.json({ ok: true, from_status: fromStatus, to_status: toStatus });
  });

  // ---------- Superadmin: sett risk-scores ----------
  app.post("/api/superadmin/partner-applications/:id/risk-scores", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { business, technical, security, gdpr, customer } = req.body ?? {};
    for (const v of [business, technical, security, gdpr, customer]) {
      if (typeof v !== "number" || v < 0 || v > 100) {
        return res.status(400).json({ error: "Alle scores må være tall 0-100" });
      }
    }
    const riskLevel = calculateRiskLevel({ business, technical, security, gdpr, customer });
    await pool.query(
      `UPDATE partner_applications
          SET risk_business_fit = $1, risk_technical_readiness = $2,
              risk_security_readiness = $3, risk_gdpr_readiness = $4,
              risk_customer_value = $5, risk_level = $6, updated_at = now()
        WHERE id = $7`,
      [business, technical, security, gdpr, customer, riskLevel, req.params.id],
    );
    res.json({ ok: true, risk_level: riskLevel });
  });

  // ---------- Superadmin: grant sandbox ----------
  // Genererer en sandbox API-key + miljø-rad
  app.post("/api/superadmin/partner-applications/:id/grant-sandbox", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const appR = await pool.query<{
      organization_id: string; partner_type: string; requested_scopes: string[];
    }>(
      `SELECT organization_id, partner_type, COALESCE(requested_scopes, '{}')
         FROM partner_applications WHERE id = $1`,
      [req.params.id],
    );
    if (appR.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const a = appR.rows[0];

    const rawKey = `lg_sandbox_${crypto.randomBytes(24).toString("hex")}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const keyR = await pool.query<{ id: string }>(
      `INSERT INTO partner_api_keys
        (organization_id, key_prefix, key_hash, name, scopes,
         environment, created_by, expires_at)
       VALUES ($1, $2, $3, 'Sandbox key', $4::text[],
               'sandbox', $5, now() + interval '90 days')
       RETURNING id::text`,
      [
        a.organization_id, keyPrefix, keyHash,
        a.requested_scopes && a.requested_scopes.length > 0
          ? a.requested_scopes
          : ["customers.read", "needs.read", "signals.read", "deliverables.read"],
        s.userId,
      ],
    );

    await pool.query(
      `INSERT INTO partner_environments
        (organization_id, environment, granted_by, expires_at, api_key_id)
       VALUES ($1, 'sandbox', $2, now() + interval '90 days', $3)`,
      [a.organization_id, s.userId, keyR.rows[0].id],
    );

    res.status(201).json({
      ok: true,
      raw_key: rawKey,
      warning: "Sandbox-keyen vises kun nå. Kopier den.",
      expires_in_days: 90,
    });
  });

  // ---------- Superadmin: hent full søknadsinfo ----------
  app.get("/api/superadmin/partner-applications/:id/full", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const appR = await pool.query(
      `SELECT pa.*, o.name AS org_name, u.email AS applicant_email
         FROM partner_applications pa
         JOIN organizations o ON o.id = pa.organization_id
         LEFT JOIN users u ON u.id = pa.applicant_user_id
        WHERE pa.id = $1`,
      [req.params.id],
    );
    if (appR.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const [docs, history, alerts] = await Promise.all([
      pool.query(`SELECT * FROM partner_application_documents WHERE application_id = $1 ORDER BY uploaded_at DESC`, [req.params.id]),
      pool.query(`SELECT * FROM partner_application_history WHERE application_id = $1 ORDER BY transitioned_at DESC`, [req.params.id]),
      pool.query(`SELECT * FROM partner_admin_alerts WHERE application_id = $1 ORDER BY created_at DESC`, [req.params.id]),
    ]);
    res.json({
      application: appR.rows[0],
      documents: docs.rows,
      history: history.rows,
      alerts: alerts.rows,
    });
  });

  // ---------- Superadmin: alerts ----------
  app.get("/api/superadmin/partner-alerts", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT a.*, p.name AS partner_name, o.name AS app_org_name
         FROM partner_admin_alerts a
         LEFT JOIN leadgrid_partners p ON p.id = a.partner_id
         LEFT JOIN partner_applications pa ON pa.id = a.application_id
         LEFT JOIN organizations o ON o.id = pa.organization_id
        WHERE a.acknowledged_at IS NULL
        ORDER BY a.severity DESC, a.created_at DESC
        LIMIT 100`,
    );
    res.json({ alerts: r.rows });
  });

  app.post("/api/superadmin/partner-alerts/:id/acknowledge", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    await pool.query(
      `UPDATE partner_admin_alerts
          SET acknowledged_at = now(), acknowledged_by = $1
        WHERE id = $2 AND acknowledged_at IS NULL`,
      [s.userId, req.params.id],
    );
    res.json({ ok: true });
  });

  // ---------- Public: upload document for partner application ----------
  app.post(
    "/api/leadgrid/partner-application/upload-document",
    upload.single("file"),
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) return res.status(401).json({ error: "Ikke innlogget" });
      const file = (req as any).file;
      const { applicationId, documentType } = req.body ?? {};
      if (!file) return res.status(400).json({ error: "Ingen fil mottatt" });
      if (!applicationId || !documentType) {
        return res.status(400).json({ error: "applicationId og documentType påkrevd" });
      }

      // Bekreft eierskap
      const own = await pool.query(
        `SELECT 1 FROM partner_applications WHERE id = $1 AND applicant_user_id = $2`,
        [applicationId, session.userId],
      );
      if (own.rows.length === 0) return res.status(403).json({ error: "Ikke din søknad" });

      const r = await uploadPartnerDocument(pool, {
        applicationId, documentType,
        filename: file.originalname,
        mimeType: file.mimetype,
        fileBuffer: file.buffer,
        uploadedBy: session.userId,
      });
      if (!r.ok) return res.status(400).json({ error: r.error });
      res.status(201).json({ ok: true, document_id: r.document_id });
    },
  );

  // ---------- Public: liste egne dokumenter ----------
  app.get("/api/leadgrid/partner-application/:appId/documents", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const own = await pool.query(
      `SELECT 1 FROM partner_applications WHERE id = $1 AND applicant_user_id = $2`,
      [req.params.appId, session.userId],
    );
    if (own.rows.length === 0) return res.status(403).json({ error: "Ikke din søknad" });
    const r = await pool.query(
      `SELECT id::text, document_type, filename, file_size_bytes, mime_type,
              uploaded_at::text, verified_at::text, verification_notes
         FROM partner_application_documents
        WHERE application_id = $1
        ORDER BY uploaded_at DESC`,
      [req.params.appId],
    );
    res.json({ documents: r.rows });
  });

  // ---------- Public: slett eget dokument ----------
  app.delete("/api/leadgrid/partner-application/document/:docId", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const own = await pool.query(
      `SELECT 1 FROM partner_application_documents d
         JOIN partner_applications pa ON pa.id = d.application_id
        WHERE d.id = $1 AND pa.applicant_user_id = $2`,
      [req.params.docId, session.userId],
    );
    if (own.rows.length === 0) return res.status(403).json({ error: "Ikke din fil" });
    await deletePartnerDocument(pool, req.params.docId);
    res.json({ ok: true });
  });

  // ---------- Superadmin: hent presigned download-URL ----------
  app.get("/api/superadmin/partner-documents/:id/url", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query<{ storage_url: string; filename: string }>(
      `SELECT storage_url, filename FROM partner_application_documents WHERE id = $1`,
      [req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const url = await presignPartnerDocument(r.rows[0].storage_url, 600);
    if (!url) return res.status(500).json({ error: "Kunne ikke generere URL" });
    res.json({ url, filename: r.rows[0].filename });
  });

  // ---------- Public marketplace ----------
  app.get("/api/leadgrid/marketplace", async (req, res) => {
    const partnerType = req.query.type as string | undefined;
    const tier = req.query.tier as string | undefined;
    const r = await pool.query(
      `SELECT id::text, name, slug, logo_url, website, tagline,
              partner_type, tier
         FROM leadgrid_partners
        WHERE is_active = TRUE
          AND status = 'approved'
          AND show_on_landing = TRUE
          ${partnerType ? "AND partner_type = $1" : ""}
          ${tier ? `AND tier = $${partnerType ? 2 : 1}` : ""}
        ORDER BY
          CASE tier
            WHEN 'strategic' THEN 1
            WHEN 'verified_integration' THEN 2
            WHEN 'integration' THEN 3
            WHEN 'certified' THEN 4
            WHEN 'listed' THEN 5
            ELSE 6 END,
          name ASC`,
      [partnerType, tier].filter(Boolean) as string[],
    );
    res.json({ partners: r.rows });
  });

  // ---------- Cron: re-verification check ----------
  app.post("/api/leadgrid/reverifications/check", async (req, res) => {
    if (!isCronAuthorized(req)) {
      const s = await requireSuperAdmin(req, res, pool, activeSessions);
      if (!s) return;
    }

    // Initialiser re-verifisering for nye partnere som mangler rad
    await pool.query(
      `INSERT INTO partner_re_verifications (partner_id, last_verified_at, next_verification_due, frequency_months)
       SELECT p.id, p.approved_at,
              CASE
                WHEN p.partner_type IN ('integration', 'verified_integration', 'strategic') THEN
                  p.approved_at + interval '12 months'
                ELSE p.approved_at + interval '24 months'
              END,
              CASE
                WHEN p.partner_type IN ('integration', 'verified_integration', 'strategic') THEN 12
                ELSE 24
              END
         FROM leadgrid_partners p
        WHERE p.status = 'approved'
          AND p.approved_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM partner_re_verifications r WHERE r.partner_id = p.id)`,
    );

    // Send admin-alert for partnere som har <30 dager til due
    const dueR = await pool.query<{ partner_id: string; partner_name: string; due_in_days: number }>(
      `SELECT r.partner_id::text, p.name AS partner_name,
              EXTRACT(EPOCH FROM (r.next_verification_due - now())) / 86400 AS due_in_days
         FROM partner_re_verifications r
         JOIN leadgrid_partners p ON p.id = r.partner_id
        WHERE r.next_verification_due <= now() + interval '30 days'
          AND (r.last_warning_sent_at IS NULL
            OR r.last_warning_sent_at < now() - interval '7 days')`,
    );

    let alerted = 0;
    for (const row of dueR.rows) {
      await pool.query(
        `INSERT INTO partner_admin_alerts
          (partner_id, alert_type, severity, message, meta)
         VALUES ($1, 'reverification_due_soon',
                 CASE WHEN $2 < 0 THEN 'critical'
                      WHEN $2 < 7 THEN 'warning'
                      ELSE 'info' END,
                 $3, $4::jsonb)`,
        [
          row.partner_id, row.due_in_days,
          `Re-verification due in ${Math.round(row.due_in_days)} days for ${row.partner_name}`,
          JSON.stringify({ partner_name: row.partner_name, due_in_days: row.due_in_days }),
        ],
      );
      await pool.query(
        `UPDATE partner_re_verifications SET last_warning_sent_at = now() WHERE partner_id = $1`,
        [row.partner_id],
      );
      alerted++;
    }

    res.json({ ok: true, alerted });
  });

  // ---------- Superadmin: auto-test webhook ----------
  app.post("/api/superadmin/webhook-endpoints/:id/auto-test", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query<{ url: string; signing_secret: string }>(
      `SELECT url, signing_secret FROM partner_webhook_endpoints WHERE id = $1`,
      [req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const result = await testWebhookEndpoint(r.rows[0].url, r.rows[0].signing_secret);
    if (result.passed) {
      await pool.query(
        `UPDATE partner_webhook_endpoints
            SET auto_test_passed_at = now(),
                auto_test_last_status = $1
          WHERE id = $2`,
        [result.status, req.params.id],
      );
    } else {
      await pool.query(
        `UPDATE partner_webhook_endpoints
            SET auto_test_last_status = $1
          WHERE id = $2`,
        [result.status, req.params.id],
      );
    }
    res.json(result);
  });
}
