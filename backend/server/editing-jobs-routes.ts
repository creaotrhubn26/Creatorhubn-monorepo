/**
 * editing-jobs-routes.ts
 *
 * Foto & Video redigerings-marketplace. Fotografer/videografer hyrer inn
 * eksterne redigeringsvendors (vendor_type='editing'); filflyt går sikkert
 * via Creatorhub staging-B2 -> fotografens egen B2 (se editing-jobs-service).
 *
 * Endepunkter:
 *   Discovery (fotograf):
 *     GET    /api/editing/vendors                 — godkjente, compliance-klare vendors
 *     GET    /api/editing/vendors/:vendorUserId    — profil + full priskatalog + compliance
 *   Oppdrag (fotograf):
 *     POST   /api/editing/jobs                      — opprett forespørsel/oppdrag
 *     GET    /api/editing/jobs                      — egne oppdrag
 *     GET    /api/editing/jobs/:id                  — detalj (+ filer + events)
 *     POST   /api/editing/jobs/:id/assign-vendor    — velg vendor for draft
 *     POST   /api/editing/jobs/:id/approve          — godkjenn levering
 *     POST   /api/editing/jobs/:id/request-revision — be om revisjon (maks-grense)
 *     POST   /api/editing/jobs/:id/cancel           — avbryt
 *   Vendor:
 *     GET    /api/editing/vendor/jobs               — innkommende oppdrag
 *     POST   /api/editing/jobs/:id/accept           — aksepter (krever compliance) -> token
 *     POST   /api/editing/jobs/:id/decline          — avslå
 *     POST   /api/editing/jobs/:id/upload-url       — presignert PUT (session ELLER token)
 *     POST   /api/editing/jobs/:id/deliver          — ferdig -> server-side overføring
 *     POST   /api/editing/vendor/compliance/accept  — aksepter Creatorhub Vendor Standard
 */

import type express from "express";
import type { Pool } from "pg";
import {
  mintUploadToken,
  resolveJobFromUploadToken,
  revokeUploadToken,
  presignStagingUpload,
  transferStagingToPhotographer,
  stagingPrefix,
  logJobEvent,
} from "./editing-jobs-service";
import {
  buildComplianceSummary,
  requiredAcceptances,
  isEeaCountry,
  COMPLIANCE_VERSION,
  type ComplianceProfile,
} from "./editing-compliance";

export interface EditingJobsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// Plattform-cut. Under prototype-testing kan vendor-fee være betinget/null
// (EDITING_PROTOTYPE_NO_FEE=1). Ellers default 15% (overstyrbar via env).
function platformFeeCents(amountCents: number): number {
  if (process.env.EDITING_PROTOTYPE_NO_FEE === "1") return 0;
  const pct = Number(process.env.EDITING_PLATFORM_FEE_PCT || "0.15");
  return Math.max(0, Math.round(amountCents * pct));
}

const VENDOR_PROFILE_COLS = `
  user_id, vendor_name, vendor_type, business_info, logo_url, tagline, rating, review_count,
  turnaround_days, availability_status, approval_status, is_foreign, country, is_eea,
  compliance_accepted, compliance_quality_status, compliance_storage_status,
  compliance_gdpr_status, compliance_delivery_status, dpa_signed, nda_signed,
  scc_signed, tia_completed, subcontractors_allowed, portfolio_use_allowed
`;

export function setupEditingJobsRoutes(deps: EditingJobsRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── Discovery: liste over godkjente, compliance-klare redigeringsvendors ──
  app.get("/api/editing/vendors", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT ${VENDOR_PROFILE_COLS}
           FROM vendor_onboarding_profiles
          WHERE vendor_type = 'editing' AND approval_status = 'approved'
          ORDER BY rating DESC NULLS LAST, vendor_name ASC`,
      );
      // Tjenester/priser pr vendor (fra priskatalogen)
      const vendors = [];
      for (const row of r.rows) {
        const summary = buildComplianceSummary(row as ComplianceProfile);
        if (!summary.cleared) continue; // kun vendors som oppfyller alle krav
        const prods = await pool.query(
          `SELECT category, name, product_name, price, currency
             FROM vendor_showcase_products
            WHERE vendor_id = $1 AND (status IS NULL OR status = 'active')
            ORDER BY price ASC NULLS LAST LIMIT 12`,
          [row.user_id],
        );
        vendors.push({
          vendorUserId: row.user_id,
          vendorName: row.vendor_name,
          tagline: row.tagline,
          logoUrl: row.logo_url,
          rating: row.rating != null ? Number(row.rating) : null,
          reviewCount: row.review_count ?? 0,
          turnaroundDays: row.turnaround_days,
          availabilityStatus: row.availability_status || "available",
          isInternational: summary.isInternational,
          requiresExtraGdpr: summary.requiresExtraGdpr,
          badges: summary.badges,
          services: prods.rows.map((p) => ({
            category: p.category,
            name: p.name || p.product_name,
            price: p.price != null ? Number(p.price) : null,
            currency: p.currency || "NOK",
          })),
        });
      }
      res.json({ vendors, count: vendors.length });
    } catch (err) {
      console.error("[editing/vendors] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_vendors" });
    }
  });

  // ── Vendor-profil + full priskatalog + compliance-status-tabell ──
  app.get("/api/editing/vendors/:vendorUserId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT ${VENDOR_PROFILE_COLS}
           FROM vendor_onboarding_profiles
          WHERE vendor_type = 'editing' AND user_id = $1
          LIMIT 1`,
        [req.params.vendorUserId],
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: "vendor_ikke_funnet" });
      const summary = buildComplianceSummary(row as ComplianceProfile);
      const prods = await pool.query(
        `SELECT id, category, name, product_name, price, currency, description, image_url, average_rating
           FROM vendor_showcase_products
          WHERE vendor_id = $1 AND (status IS NULL OR status = 'active')
          ORDER BY category ASC, price ASC NULLS LAST`,
        [row.user_id],
      );
      res.json({
        vendorUserId: row.user_id,
        vendorName: row.vendor_name,
        tagline: row.tagline,
        logoUrl: row.logo_url,
        rating: row.rating != null ? Number(row.rating) : null,
        reviewCount: row.review_count ?? 0,
        turnaroundDays: row.turnaround_days,
        availabilityStatus: row.availability_status || "available",
        approvalStatus: row.approval_status,
        country: row.country,
        compliance: summary,
        services: prods.rows.map((p) => ({
          id: p.id,
          category: p.category,
          name: p.name || p.product_name,
          price: p.price != null ? Number(p.price) : null,
          currency: p.currency || "NOK",
          description: p.description,
          imageUrl: p.image_url,
          rating: p.average_rating != null ? Number(p.average_rating) : null,
        })),
      });
    } catch (err) {
      console.error("[editing/vendor-profile] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_vendor" });
    }
  });

  // ── Opprett oppdrag (forespørsel) ──
  app.post("/api/editing/jobs", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const b = req.body || {};
    const amountCents = Math.max(0, Math.round(Number(b.amountCents) || 0));
    const vendorId: string | null = b.vendorId || null;

    try {
      let vendorName: string | null = null;
      if (vendorId) {
        const vr = await pool.query(
          `SELECT ${VENDOR_PROFILE_COLS} FROM vendor_onboarding_profiles
            WHERE user_id = $1 AND vendor_type = 'editing' LIMIT 1`,
          [vendorId],
        );
        const vrow = vr.rows[0];
        if (!vrow) return res.status(400).json({ error: "vendor_ikke_funnet" });
        const summary = buildComplianceSummary(vrow as ComplianceProfile);
        if (vrow.approval_status !== "approved" || !summary.cleared) {
          return res.status(400).json({ error: "vendor_ikke_kvalifisert", missing: summary.missing });
        }
        vendorName = vrow.vendor_name;
      }

      const status = vendorId ? "requested" : "draft";
      // Kalkyle-modell (velges pr oppdrag): fixed_fee (kostnad av-toppen) | revenue_share (% av inntekt)
      const costModel = b.costModel === "revenue_share" ? "revenue_share" : "fixed_fee";
      const revenueSharePct =
        costModel === "revenue_share" && Number.isFinite(Number(b.revenueSharePct))
          ? Number(b.revenueSharePct)
          : null;
      const splitSheetId: string | null = b.splitSheetId || null;

      const ins = await pool.query(
        `INSERT INTO editing_jobs
           (project_id, project_title, photographer_id, photographer_email, vendor_id, vendor_name,
            status, requested_services, brief, amount_cents, currency, platform_fee_cents,
            max_revisions, quality_spec, confidentiality_ack, staging_prefix, requested_at,
            cost_model, revenue_share_pct, split_sheet_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'NOK',$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`,
        [
          b.projectId || null,
          b.projectTitle || null,
          session.userId,
          session.email || null,
          vendorId,
          vendorName,
          status,
          JSON.stringify(Array.isArray(b.requestedServices) ? b.requestedServices : []),
          b.brief || null,
          amountCents,
          platformFeeCents(amountCents),
          Number.isFinite(Number(b.maxRevisions)) ? Number(b.maxRevisions) : 2,
          b.qualitySpec ? JSON.stringify(b.qualitySpec) : null,
          !!b.confidentialityAck,
          null,
          vendorId ? new Date() : null,
          costModel,
          revenueSharePct,
          splitSheetId,
        ],
      );
      const jobId = ins.rows[0].id;
      // staging_prefix settes nå som vi har jobId
      await pool.query(`UPDATE editing_jobs SET staging_prefix = $2 WHERE id = $1`, [
        jobId,
        stagingPrefix(jobId),
      ]);

      // Revenue-share -> legg vendor inn i split-sheet-kalkylen som bidragsyter
      if (costModel === "revenue_share" && splitSheetId && revenueSharePct != null) {
        try {
          const contrib = await pool.query(
            `INSERT INTO split_sheet_contributors (split_sheet_id, name, role, percentage, user_id, notes)
             VALUES ($1, $2, 'collaborator', $3, $4, 'Ekstern redigering (Creatorhub vendor)')
             RETURNING id`,
            [splitSheetId, vendorName || "Redigering", revenueSharePct, vendorId],
          );
          await pool.query(`UPDATE editing_jobs SET split_sheet_contributor_id = $2 WHERE id = $1`, [
            jobId,
            contrib.rows[0].id,
          ]);
        } catch (e) {
          console.warn("[editing/jobs] split-sheet contributor-kobling feilet", (e as Error).message);
        }
      }
      await logJobEvent(pool, jobId, vendorId ? "requested" : "created", session.userId, "photographer", {
        vendorId,
        amountCents,
      });
      res.json({ ok: true, jobId, status });
    } catch (err) {
      console.error("[editing/jobs:create] error", err);
      res.status(500).json({ error: "kunne_ikke_opprette_oppdrag" });
    }
  });

  // ── Fotografens egne oppdrag ──
  app.get("/api/editing/jobs", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const status = typeof req.query.status === "string" ? req.query.status : null;
      const r = await pool.query(
        `SELECT * FROM editing_jobs
          WHERE photographer_id = $1 ${status ? "AND status = $2" : ""}
          ORDER BY created_at DESC`,
        status ? [session.userId, status] : [session.userId],
      );
      res.json({ jobs: r.rows });
    } catch (err) {
      console.error("[editing/jobs:list] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_oppdrag" });
    }
  });

  // Hjelper: hent jobb + autoriser (fotograf-eier eller tildelt vendor)
  async function loadAuthorizedJob(
    jobId: string,
    userId: string,
  ): Promise<{ job: any; role: "photographer" | "vendor" } | null> {
    const r = await pool.query(`SELECT * FROM editing_jobs WHERE id = $1 LIMIT 1`, [jobId]);
    const job = r.rows[0];
    if (!job) return null;
    if (job.photographer_id === userId) return { job, role: "photographer" };
    if (job.vendor_id === userId) return { job, role: "vendor" };
    return null;
  }

  // ── Oppdrags-detalj (+ filer + events) ──
  app.get("/api/editing/jobs/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth) return res.status(404).json({ error: "ikke_funnet" });
      const files = await pool.query(
        `SELECT id, file_name, transfer_status, size_bytes, content_type, uploaded_at, copied_at
           FROM editing_job_files WHERE job_id = $1 ORDER BY created_at ASC`,
        [req.params.id],
      );
      const events = await pool.query(
        `SELECT event_type, actor_role, detail, created_at
           FROM editing_job_events WHERE job_id = $1 ORDER BY created_at ASC`,
        [req.params.id],
      );
      res.json({ job: auth.job, role: auth.role, files: files.rows, events: events.rows });
    } catch (err) {
      console.error("[editing/jobs:detail] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_oppdrag" });
    }
  });

  // ── Tildel vendor til et draft-oppdrag ──
  app.post("/api/editing/jobs/:id/assign-vendor", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      if (auth.job.status !== "draft") return res.status(400).json({ error: "ikke_draft" });
      const vendorId = req.body?.vendorId;
      const vr = await pool.query(
        `SELECT ${VENDOR_PROFILE_COLS} FROM vendor_onboarding_profiles
          WHERE user_id = $1 AND vendor_type = 'editing' LIMIT 1`,
        [vendorId],
      );
      const vrow = vr.rows[0];
      if (!vrow) return res.status(400).json({ error: "vendor_ikke_funnet" });
      const summary = buildComplianceSummary(vrow as ComplianceProfile);
      if (vrow.approval_status !== "approved" || !summary.cleared) {
        return res.status(400).json({ error: "vendor_ikke_kvalifisert", missing: summary.missing });
      }
      await pool.query(
        `UPDATE editing_jobs SET vendor_id = $2, vendor_name = $3, status = 'requested', requested_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id, vendorId, vrow.vendor_name],
      );
      await logJobEvent(pool, req.params.id, "requested", session.userId, "photographer", { vendorId });
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/jobs:assign] error", err);
      res.status(500).json({ error: "kunne_ikke_tildele_vendor" });
    }
  });

  // ── Vendorens innkommende oppdrag ──
  app.get("/api/editing/vendor/jobs", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT * FROM editing_jobs WHERE vendor_id = $1 ORDER BY created_at DESC`,
        [session.userId],
      );
      res.json({ jobs: r.rows });
    } catch (err) {
      console.error("[editing/vendor/jobs] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_oppdrag" });
    }
  });

  // ── Vendor aksepterer (krever compliance) -> mint opplastings-token ──
  app.post("/api/editing/jobs/:id/accept", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "vendor") return res.status(404).json({ error: "ikke_funnet" });
      if (!["requested", "declined"].includes(auth.job.status)) {
        return res.status(400).json({ error: "ugyldig_status" });
      }
      // Compliance-gate
      const vr = await pool.query(
        `SELECT ${VENDOR_PROFILE_COLS} FROM vendor_onboarding_profiles WHERE user_id = $1 LIMIT 1`,
        [session.userId],
      );
      const summary = buildComplianceSummary((vr.rows[0] || {}) as ComplianceProfile);
      if (!summary.cleared) {
        return res.status(403).json({ error: "compliance_ikke_oppfylt", missing: summary.missing });
      }
      await pool.query(
        `UPDATE editing_jobs SET status = 'in_progress', accepted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      const { token, expiresAt } = await mintUploadToken(pool, req.params.id);
      await logJobEvent(pool, req.params.id, "accepted", session.userId, "vendor", {});
      await logJobEvent(pool, req.params.id, "token_minted", session.userId, "vendor", { expiresAt });
      res.json({ ok: true, uploadToken: token, expiresAt, stagingPrefix: stagingPrefix(req.params.id) });
    } catch (err) {
      console.error("[editing/jobs:accept] error", err);
      res.status(500).json({ error: "kunne_ikke_akseptere" });
    }
  });

  // ── Vendor avslår ──
  app.post("/api/editing/jobs/:id/decline", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "vendor") return res.status(404).json({ error: "ikke_funnet" });
      await pool.query(
        `UPDATE editing_jobs SET status = 'declined', declined_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      await logJobEvent(pool, req.params.id, "declined", session.userId, "vendor", {
        reason: req.body?.reason || null,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/jobs:decline] error", err);
      res.status(500).json({ error: "kunne_ikke_avsla" });
    }
  });

  // ── Presignert PUT for vendor (session ELLER opplastings-token) ──
  app.post("/api/editing/jobs/:id/upload-url", async (req, res) => {
    try {
      const jobId = req.params.id;
      const fileName = req.body?.fileName;
      const contentType = req.body?.contentType || "application/octet-stream";
      if (!fileName) return res.status(400).json({ error: "mangler_filnavn" });

      // Autentisering: enten innlogget vendor på oppdraget, eller gyldig token
      const token = (req.headers["x-editing-upload-token"] as string) || req.body?.uploadToken;
      let authed = false;
      let actor = "system";
      if (token && (await resolveJobFromUploadToken(pool, jobId, token))) {
        authed = true;
        actor = "vendor_token";
      } else {
        const session = requireUserSession(req, res);
        if (!session) return; // requireUserSession sendte 401
        const auth = await loadAuthorizedJob(jobId, session.userId);
        if (!auth || auth.role !== "vendor") return res.status(403).json({ error: "ikke_tillatt" });
        authed = true;
        actor = session.userId;
      }
      if (!authed) return res.status(403).json({ error: "ikke_tillatt" });

      const jr = await pool.query(`SELECT status FROM editing_jobs WHERE id = $1`, [jobId]);
      if (!jr.rows[0]) return res.status(404).json({ error: "ikke_funnet" });
      if (jr.rows[0].status !== "in_progress") {
        return res.status(400).json({ error: "oppdrag_ikke_aktivt" });
      }

      const presigned = await presignStagingUpload(jobId, fileName, contentType);
      if (!presigned) return res.status(503).json({ error: "staging_ikke_konfigurert" });

      await pool.query(
        `INSERT INTO editing_job_files (job_id, file_name, staging_key, content_type, transfer_status, uploaded_at)
         VALUES ($1, $2, $3, $4, 'staged', NOW())`,
        [jobId, fileName, presigned.key, contentType],
      );
      await logJobEvent(pool, jobId, "file_uploaded", actor, "vendor", { fileName, key: presigned.key });
      res.json({ ok: true, uploadUrl: presigned.url, key: presigned.key });
    } catch (err) {
      console.error("[editing/jobs:upload-url] error", err);
      res.status(500).json({ error: "kunne_ikke_lage_upload_url" });
    }
  });

  // ── Vendor leverer -> server-side overføring staging -> fotografens B2 ──
  app.post("/api/editing/jobs/:id/deliver", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "vendor") return res.status(404).json({ error: "ikke_funnet" });
      if (auth.job.status !== "in_progress") return res.status(400).json({ error: "ugyldig_status" });

      await logJobEvent(pool, req.params.id, "transfer_started", session.userId, "vendor", {});
      const result = await transferStagingToPhotographer(pool, req.params.id, auth.job.photographer_id);
      if (!result.ok && result.copied === 0) {
        await logJobEvent(pool, req.params.id, "transfer_failed", "system", "system", { error: result.error });
        return res.status(502).json({ error: result.error || "overforing_feilet", ...result });
      }
      await pool.query(
        `UPDATE editing_jobs SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      await revokeUploadToken(pool, req.params.id);
      await logJobEvent(pool, req.params.id, "transfer_completed", "system", "system", {
        copied: result.copied,
        failed: result.failed,
      });
      res.json({ ...result, ok: true });
    } catch (err) {
      console.error("[editing/jobs:deliver] error", err);
      res.status(500).json({ error: "kunne_ikke_levere" });
    }
  });

  // ── Fotograf godkjenner levering (Showcase-godkjent flyt) ──
  app.post("/api/editing/jobs/:id/approve", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      if (auth.job.status !== "delivered") return res.status(400).json({ error: "ikke_levert" });
      await pool.query(
        `UPDATE editing_jobs SET status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      await logJobEvent(pool, req.params.id, "approved", session.userId, "photographer", {});
      // TODO(#9/#10): frigi Stripe-utbetaling til vendor + opprett Showcase-galleri
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/jobs:approve] error", err);
      res.status(500).json({ error: "kunne_ikke_godkjenne" });
    }
  });

  // ── Be om revisjon (innenfor maks-grense) ──
  app.post("/api/editing/jobs/:id/request-revision", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      const job = auth.job;
      if (job.status !== "delivered") return res.status(400).json({ error: "ikke_levert" });
      if ((job.revisions_used ?? 0) >= (job.max_revisions ?? 2)) {
        return res.status(400).json({ error: "maks_revisjoner_nadd" });
      }
      await pool.query(
        `UPDATE editing_jobs
            SET status = 'in_progress', revisions_used = COALESCE(revisions_used,0) + 1, updated_at = NOW()
          WHERE id = $1`,
        [req.params.id],
      );
      // Ny token så vendor kan laste opp revidert materiale
      const { token, expiresAt } = await mintUploadToken(pool, req.params.id);
      await logJobEvent(pool, req.params.id, "revision_requested", session.userId, "photographer", {
        note: req.body?.note || null,
      });
      res.json({ ok: true, uploadToken: token, expiresAt });
    } catch (err) {
      console.error("[editing/jobs:revision] error", err);
      res.status(500).json({ error: "kunne_ikke_be_om_revisjon" });
    }
  });

  // ── Avbryt oppdrag ──
  app.post("/api/editing/jobs/:id/cancel", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      await pool.query(
        `UPDATE editing_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      await revokeUploadToken(pool, req.params.id);
      await logJobEvent(pool, req.params.id, "cancelled", session.userId, "photographer", {});
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/jobs:cancel] error", err);
      res.status(500).json({ error: "kunne_ikke_avbryte" });
    }
  });

  // ── Vendorens egen profil + compliance-status (for vendor-workspace) ──
  app.get("/api/editing/vendor/me", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT ${VENDOR_PROFILE_COLS} FROM vendor_onboarding_profiles WHERE user_id = $1 LIMIT 1`,
        [session.userId],
      );
      const row = r.rows[0];
      const isEditingVendor = !!row && row.vendor_type === "editing";
      const compliance = buildComplianceSummary((row || {}) as ComplianceProfile);
      res.json({
        hasProfile: !!row,
        isEditingVendor,
        vendorName: row?.vendor_name || session.name || null,
        approvalStatus: row?.approval_status || "pending",
        country: row?.country || "NO",
        isForeign: !!row?.is_foreign,
        compliance,
      });
    } catch (err) {
      console.error("[editing/vendor/me] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_profil" });
    }
  });

  // ── Vendor aksepterer Creatorhub Vendor Standard (compliance) ──
  app.post("/api/editing/vendor/compliance/accept", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const b = req.body || {};
      const country: string = (b.country || "NO").toUpperCase();
      const isForeign = !!b.isForeign || country !== "NO";
      const isEea = isEeaCountry(country);
      const required = requiredAcceptances(isForeign, isEea);
      const accepted: string[] = Array.isArray(b.acceptedRequirements) ? b.acceptedRequirements : [];
      const missing = required.filter((r) => !accepted.includes(r));
      if (missing.length > 0) {
        return res.status(400).json({ error: "mangler_aksept", missing });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      for (const requirement of required) {
        await pool.query(
          `INSERT INTO vendor_compliance_acceptances (vendor_user_id, requirement, accepted, version, ip_address)
           VALUES ($1, $2, true, $3, $4)`,
          [session.userId, requirement, COMPLIANCE_VERSION, ip],
        );
      }

      // Selv-attestert: setter pilar-statuser + signaturer. Creatorhub kan
      // senere legge på manuell verifisering (status -> rejected ved avvik).
      await pool.query(
        `UPDATE vendor_onboarding_profiles
            SET compliance_accepted = true,
                compliance_accepted_at = NOW(),
                compliance_version = $2,
                country = $3,
                is_foreign = $4,
                is_eea = $5,
                compliance_quality_status = 'approved',
                compliance_storage_status = 'approved',
                compliance_gdpr_status = 'approved',
                compliance_delivery_status = 'approved',
                dpa_signed = true, dpa_signed_at = NOW(),
                nda_signed = true, nda_signed_at = NOW(),
                scc_signed = CASE WHEN $5 = false THEN true ELSE scc_signed END,
                scc_signed_at = CASE WHEN $5 = false THEN NOW() ELSE scc_signed_at END,
                tia_completed = CASE WHEN $5 = false THEN true ELSE tia_completed END,
                tia_completed_at = CASE WHEN $5 = false THEN NOW() ELSE tia_completed_at END,
                updated_at = NOW()
          WHERE user_id = $1`,
        [session.userId, COMPLIANCE_VERSION, country, isForeign, isEea],
      );

      const vr = await pool.query(
        `SELECT ${VENDOR_PROFILE_COLS} FROM vendor_onboarding_profiles WHERE user_id = $1 LIMIT 1`,
        [session.userId],
      );
      res.json({ ok: true, compliance: buildComplianceSummary((vr.rows[0] || {}) as ComplianceProfile) });
    } catch (err) {
      console.error("[editing/compliance:accept] error", err);
      res.status(500).json({ error: "kunne_ikke_registrere_aksept" });
    }
  });
}
