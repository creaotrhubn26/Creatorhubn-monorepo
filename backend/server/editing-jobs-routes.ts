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
  createClientGalleryFromJob,
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
import { redeemPortalToken } from "./editing-partner-portal-service";
import crypto from "crypto";
import {
  createCheckoutForJob,
  isCheckoutPaid,
  releasePayoutForJob,
} from "./editing-payments-service";

export interface EditingJobsRoutesDeps {
  app: express.Application;
  pool: Pool;
  // Async: løser også PERSISTERTE sesjoner (creatorhub_auth_sessions), ikke bare
  // in-memory. Robust mot backend-restart (in-memory activeSessions tømmes da).
  requireUserSession: (
    req: express.Request,
    res: express.Response,
  ) => Promise<{ userId: string; email: string; name: string; role: string } | null>;
  // For magic-link portal-innløsning: mint en ekte session. Valgfri (graceful om mangler).
  activeSessions?: Map<string, { userId: string; role?: string; email?: string }>;
  persistSession?: (
    pool: Pool,
    args: { token: string; session: { userId: string; role?: string; email?: string }; source?: string; ttlDays?: number; ip?: string; userAgent?: string },
  ) => Promise<void>;
}

// Plattform-cut PER VENDOR. Admin bestemmer ved godkjenning:
//  - 'prototype'  → 0 % så lenge prototype_until er i framtiden (eller NULL = ubegrenset);
//                   etter utløp faller den tilbake til platform_fee_bps (eller default).
//  - 'standard'   → platform_fee_bps (default 1500 bps = 15 %).
//  - NULL/uavklart → behold prototype-fase-default (global env), bakoverkompatibelt.
const DEFAULT_FEE_BPS = Math.round(Number(process.env.EDITING_PLATFORM_FEE_PCT || "0.15") * 10000);
type FeeConfig = { partner_type?: string | null; prototype_until?: string | Date | null; platform_fee_bps?: number | null };

function prototypeActive(cfg: FeeConfig): boolean {
  if (cfg.partner_type !== "prototype") return false;
  if (!cfg.prototype_until) return true; // ubegrenset prototype
  return new Date() < new Date(cfg.prototype_until);
}
function feeBpsFor(cfg: FeeConfig): number {
  if (cfg.partner_type === "prototype") return prototypeActive(cfg) ? 0 : (cfg.platform_fee_bps ?? DEFAULT_FEE_BPS);
  if (cfg.partner_type === "standard") return cfg.platform_fee_bps ?? DEFAULT_FEE_BPS;
  // uavklart → global prototype-fase-default
  return process.env.EDITING_PROTOTYPE_NO_FEE === "1" ? 0 : DEFAULT_FEE_BPS;
}
function platformFeeCents(amountCents: number, cfg: FeeConfig): number {
  return Math.max(0, Math.round((amountCents * feeBpsFor(cfg)) / 10000));
}
// ÉN sannhetskilde for plattform-gebyret som VISES — samme config som charges.
function platformFeeInfo(cfg: FeeConfig): { pct: number; prototype: boolean; prototypeUntil: string | null } {
  return {
    pct: Math.round((feeBpsFor(cfg) / 100) * 10) / 10,
    prototype: prototypeActive(cfg),
    prototypeUntil: cfg.prototype_until ? new Date(cfg.prototype_until).toISOString() : null,
  };
}

// MVA-beregning (formidler-modell), jf. norsk snudd avregning for fjernleverbare
// tjenester kjøpt fra utlandet:
//  - utenlandsk vendor → reverse charge: vendor fakturerer uten MVA, norsk kjøper
//    selv-avregner 25% (netto-null v/ fradrag). Ingen MVA legges på beløpet til vendor.
//  - innenlands norsk vendor → 25% MVA på tjenesten.
//  - plattform-provisjon → 25% MVA (faktureres norsk fotograf).
function computeJobVat(amountCents: number, feeCents: number, vendorIsForeign: boolean): {
  reverseCharge: boolean; vatRate: number; serviceVatCents: number; commissionVatCents: number;
} {
  const vatRate = 0.25;
  const reverseCharge = vendorIsForeign;
  const serviceVatCents = reverseCharge ? 0 : Math.round(amountCents * vatRate);
  const commissionVatCents = Math.round(feeCents * vatRate);
  return { reverseCharge, vatRate, serviceVatCents, commissionVatCents };
}

const VENDOR_PROFILE_COLS = `
  user_id, vendor_name, vendor_type, business_info, logo_url, tagline, rating, review_count,
  turnaround_days, availability_status, approval_status, is_foreign, country, is_eea,
  compliance_accepted, compliance_quality_status, compliance_storage_status,
  compliance_gdpr_status, compliance_delivery_status, dpa_signed, nda_signed,
  scc_signed, tia_completed, subcontractors_allowed, portfolio_use_allowed,
  portfolio_submitted, payment_connected, dpa_document_key,
  vendor_nda_governing_law, vendor_nda_url, vendor_nda_uploaded_at, quality_flagged,
  partner_type, prototype_until, platform_fee_bps
`;

export function setupEditingJobsRoutes(deps: EditingJobsRoutesDeps): void {
  const { app, pool, requireUserSession, activeSessions, persistSession } = deps;

  // Lett in-memory rate-limit for offentlige endepunkter (best-effort pr IP+e-post).
  const _appRate = new Map<string, { n: number; reset: number }>();
  const rateLimited = (key: string, max: number, windowMs: number): boolean => {
    const now = Date.now();
    const e = _appRate.get(key);
    if (!e || now > e.reset) { _appRate.set(key, { n: 1, reset: now + windowMs }); return false; }
    e.n += 1;
    return e.n > max;
  };

  // ── iPad Capture-app beta-påmelding (offentlig, ingen auth) ──
  app.post("/api/capture-beta/signup", async (req, res) => {
    try {
      const b = req.body || {};
      const email = String(b.email || "").trim();
      if (!email || !email.includes("@")) return res.status(400).json({ error: "ugyldig_epost" });
      await pool.query(
        `INSERT INTO capture_beta_signups (name, email, device, note, user_id) VALUES ($1, $2, $3, $4, $5)`,
        [b.name || null, email, b.device || null, b.note || null, b.userId || null],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[capture-beta:signup] error", err);
      res.status(500).json({ error: "kunne_ikke_melde_pa" });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Partner Program — OFFENTLIG søknad fra ekstern redigerings-studio.
  // is_foreign/is_eea ALLTID server-derivert (aldri fra body). Samtykke påkrevd.
  // ════════════════════════════════════════════════════════════════════
  app.post("/api/editing/partner-applications", async (req, res) => {
    try {
      const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
      if (rateLimited(`epa:${ip}`, 5, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "for_mange_forsok" });
      }
      const b = req.body || {};
      const cap = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));
      const companyName = cap(b.companyName, 300);
      const contactName = cap(b.contactName, 200);
      const email = String(b.contactEmail || b.email || "").trim().slice(0, 255);
      const country = String(b.country || "NO").trim().toUpperCase().slice(0, 2);
      if (!companyName || !contactName || !email.includes("@")) {
        return res.status(400).json({ error: "mangler_pakrevde_felt" });
      }
      if (b.consentPrivacy !== true) {
        return res.status(400).json({ error: "samtykke_pakrevd" });
      }
      const urlOk = (u: unknown) => !u || /^https?:\/\//i.test(String(u));
      if (!urlOk(b.website) || !urlOk(b.portfolioUrl)) {
        return res.status(400).json({ error: "ugyldig_url" });
      }
      // ALLTID server-derivert — ignorer evt. client-sendt is_foreign/is_eea.
      const isForeign = country !== "NO";
      const isEea = isEeaCountry(country);
      const services = Array.isArray(b.services) ? b.services.slice(0, 40).map((s: unknown) => String(s).slice(0, 80)) : [];
      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO editing_partner_applications
             (company_name, country, is_foreign, is_eea, registration_number, vat_number,
              contact_name, contact_email, phone, website, team_size, services, pricing_model,
              currency, price_range, portfolio_url, notes, consent_contact, consent_privacy,
              privacy_policy_version, consent_text_hash, consent_ip, consent_user_agent, consent_at,
              locale, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,
                   $20,$21,$22,$23, now(), $24, 'public_form')
           RETURNING id`,
          [
            companyName, country, isForeign, isEea, cap(b.registrationNumber, 120), cap(b.vatNumber, 120),
            contactName, email, cap(b.phone, 60), cap(b.website, 500),
            b.teamSize != null ? Number(b.teamSize) : null, JSON.stringify(services), cap(b.pricingModel, 40),
            cap(b.currency, 8), cap(b.priceRange, 120), cap(b.portfolioUrl, 500), cap(b.notes, 4000),
            b.consentContact === true, true,
            cap(b.privacyPolicyVersion || COMPLIANCE_VERSION, 40),
            crypto.createHash("sha256").update(String(b.consentText || "creatorhub-partner-standard")).digest("hex"),
            ip || null, cap(req.headers["user-agent"], 500),
            isForeign ? "en" : "no",
          ],
        );
        return res.json({ ok: true, applicationId: r.rows[0].id });
      } catch (e: unknown) {
        // Myk dedupe: aktiv søknad finnes allerede → vennlig svar, ikke 500.
        if ((e as { code?: string })?.code === "23505") {
          return res.json({ ok: true, alreadyReceived: true });
        }
        throw e;
      }
    } catch (err) {
      console.error("[editing/partner-applications] error", err);
      res.status(500).json({ error: "kunne_ikke_sende_soknad" });
    }
  });

  // Partner Program — OFFENTLIG innløsning av magic-link → mint kort session.
  app.post("/api/editing/partner/portal/redeem", async (req, res) => {
    try {
      const jti = String(req.body?.jti || "").trim();
      const t = String(req.body?.t || "").trim();
      if (!jti || !t) return res.status(400).json({ error: "mangler_token" });
      const ua = String(req.headers["user-agent"] || "").slice(0, 500);
      const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
      const redeemed = await redeemPortalToken(pool, { jti, rawToken: t, ip, userAgent: ua });
      if (!redeemed) return res.status(400).json({ error: "ugyldig_eller_brukt_lenke" });
      // Hent rolle/e-post for session
      const ur = await pool.query<{ role: string; email: string }>(
        `SELECT role, email FROM users WHERE id = $1 LIMIT 1`,
        [redeemed.vendorUserId],
      );
      const role = ur.rows[0]?.role || "editing_vendor";
      const email = ur.rows[0]?.email || redeemed.email;
      const sessionToken = crypto.randomBytes(32).toString("base64url");
      const session = { userId: redeemed.vendorUserId, role, email };
      // Dokumentert rekkefølge: activeSessions.set FØR persistSession.
      if (activeSessions) activeSessions.set(sessionToken, session);
      if (persistSession) {
        await persistSession(pool, { token: sessionToken, session, source: "partner_portal_magic_link", ttlDays: 7, ip, userAgent: ua });
      }
      res.json({ ok: true, sessionToken, user: { id: redeemed.vendorUserId, email, role } });
    } catch (err) {
      console.error("[editing/partner/portal/redeem] error", err);
      res.status(500).json({ error: "kunne_ikke_lose_inn" });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Valutakurs → NOK. Primær: Norges Bank (offisiell daglig referansekurs,
  // mest pålitelig for norsk regnskap). Fallback: open.er-api.com. Cache 1t.
  // Returnerer NOK-per-1-enhet (håndterer Norges Banks unit-multiplikator,
  // f.eks. SEK/DKK quotes per 100).
  // ════════════════════════════════════════════════════════════════════
  let _fxCache: { at: number; data: { rates: Record<string, number>; source: string; asOf: string | null } } | null = null;
  app.get("/api/fx/nok", async (req, res) => {
    const wanted = String(req.query.currencies || "USD,GBP,EUR,SEK,DKK")
      .toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
    try {
      if (_fxCache && Date.now() - _fxCache.at < 60 * 60 * 1000) return res.json(_fxCache.data);

      // 1) Norges Bank (SDMX-JSON)
      try {
        const url = `https://data.norges-bank.no/api/data/EXR/B.${wanted.join("+")}.NOK.SP?lastNObservations=1&format=sdmx-json&locale=en`;
        const r = await fetch(url);
        if (r.ok) {
          const j = (await r.json()) as any;
          const dims = j.data.structure.dimensions.series;
          const baseDim = dims.findIndex((d: any) => d.id === "BASE_CUR");
          const baseVals = dims[baseDim].values;
          const attrs = j.data.structure.attributes?.series || [];
          const umIdx = attrs.findIndex((a: any) => a.id === "UNIT_MULT");
          const umVals = umIdx >= 0 ? attrs[umIdx].values : [];
          const series = j.data.dataSets[0].series;
          const rates: Record<string, number> = {};
          for (const key of Object.keys(series)) {
            const idxs = key.split(":").map(Number);
            const cur = baseVals[idxs[baseDim]]?.id;
            const obs = series[key].observations?.["0"];
            const val = obs ? Number(obs[0]) : NaN;
            if (cur && Number.isFinite(val)) {
              const sAttrs = series[key].attributes || [];
              let mult = 0;
              if (umIdx >= 0 && sAttrs[umIdx] != null) mult = Number(umVals[sAttrs[umIdx]]?.id ?? 0) || 0;
              rates[cur] = val / Math.pow(10, mult); // NOK per 1 enhet
            }
          }
          if (Object.keys(rates).length) {
            const asOf = j.data.structure.dimensions.observation?.[0]?.values?.[0]?.id || null;
            _fxCache = { at: Date.now(), data: { rates, source: "norges-bank", asOf } };
            return res.json(_fxCache.data);
          }
        }
      } catch (e) {
        console.warn("[fx] Norges Bank feilet, faller tilbake til er-api", e);
      }

      // 2) Fallback: open.er-api.com (base NOK → invertér)
      const r2 = await fetch("https://open.er-api.com/v6/latest/NOK");
      const j2 = (await r2.json()) as any;
      const rates: Record<string, number> = {};
      for (const c of wanted) {
        const v = j2.rates?.[c];
        if (v && v > 0) rates[c] = 1 / v;
      }
      _fxCache = { at: Date.now(), data: { rates, source: "open.er-api.com (fallback)", asOf: j2.time_last_update_utc || null } };
      res.json(_fxCache.data);
    } catch (err) {
      console.error("[fx/nok] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_kurs", rates: {}, source: "feil", asOf: null });
    }
  });

  // ── Discovery: liste over godkjente, compliance-klare redigeringsvendors ──
  app.get("/api/editing/vendors", async (req, res) => {
    const session = await requireUserSession(req, res);
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
        if (row.quality_flagged) continue; // kvalitets-flaggede skjules til opprydding
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
          // Paritet med partnerportalen — samme tier/verifiserings-%/pilarer.
          tier: summary.tier,
          verificationPercent: summary.verificationPercent,
          pillars: summary.pillars,
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
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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

      // MVA + fee: slå opp vendorens utenlandsk-status + partner-type/fee-config.
      let vendorIsForeign = false;
      let feeCfg: FeeConfig = {};
      if (vendorId) {
        const vf = await pool.query<{ is_foreign: boolean; partner_type: string | null; prototype_until: string | null; platform_fee_bps: number | null }>(
          `SELECT is_foreign, partner_type, prototype_until, platform_fee_bps FROM vendor_onboarding_profiles WHERE user_id = $1 LIMIT 1`, [vendorId],
        );
        vendorIsForeign = !!vf.rows[0]?.is_foreign;
        if (vf.rows[0]) feeCfg = { partner_type: vf.rows[0].partner_type, prototype_until: vf.rows[0].prototype_until, platform_fee_bps: vf.rows[0].platform_fee_bps };
      }
      const feeCents = platformFeeCents(amountCents, feeCfg);
      const vat = computeJobVat(amountCents, feeCents, vendorIsForeign);

      const ins = await pool.query(
        `INSERT INTO editing_jobs
           (project_id, project_title, photographer_id, photographer_email, vendor_id, vendor_name,
            status, requested_services, brief, amount_cents, currency, platform_fee_cents,
            max_revisions, quality_spec, confidentiality_ack, staging_prefix, requested_at,
            cost_model, revenue_share_pct, split_sheet_id,
            vat_reverse_charge, vat_rate, service_vat_cents, commission_vat_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'NOK',$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
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
          feeCents,
          Number.isFinite(Number(b.maxRevisions)) ? Number(b.maxRevisions) : 2,
          b.qualitySpec ? JSON.stringify(b.qualitySpec) : null,
          !!b.confidentialityAck,
          null,
          vendorId ? new Date() : null,
          costModel,
          revenueSharePct,
          splitSheetId,
          vat.reverseCharge,
          vat.vatRate,
          vat.serviceVatCents,
          vat.commissionVatCents,
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
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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

  const MESSAGING_STATUSES = ["in_progress", "delivered", "approved", "delivered_to_client"];

  // ── Meldinger pr oppdrag (fotograf <-> vendor, kun når avtale inngått) ──
  app.get("/api/editing/jobs/:id/messages", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth) return res.status(404).json({ error: "ikke_funnet" });
      const r = await pool.query(
        `SELECT id, sender_id, sender_role, body, created_at
           FROM editing_job_messages WHERE job_id = $1 ORDER BY created_at ASC`,
        [req.params.id],
      );
      // Marker motpartens meldinger som lest
      await pool.query(
        `UPDATE editing_job_messages SET read_at = NOW()
          WHERE job_id = $1 AND sender_role <> $2 AND read_at IS NULL`,
        [req.params.id, auth.role],
      );
      res.json({ messages: r.rows, canMessage: MESSAGING_STATUSES.includes(auth.job.status) });
    } catch (err) {
      console.error("[editing/jobs:messages:list] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_meldinger" });
    }
  });

  app.post("/api/editing/jobs/:id/messages", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth) return res.status(404).json({ error: "ikke_funnet" });
      if (!MESSAGING_STATUSES.includes(auth.job.status)) {
        return res.status(400).json({ error: "kommunikasjon_ikke_apen" });
      }
      const body = (req.body?.body || "").trim();
      if (!body) return res.status(400).json({ error: "tom_melding" });
      const ins = await pool.query(
        `INSERT INTO editing_job_messages (job_id, sender_id, sender_role, body)
         VALUES ($1, $2, $3, $4) RETURNING id, sender_id, sender_role, body, created_at`,
        [req.params.id, session.userId, auth.role, body],
      );
      res.json({ ok: true, message: ins.rows[0] });
    } catch (err) {
      console.error("[editing/jobs:messages:post] error", err);
      res.status(500).json({ error: "kunne_ikke_sende_melding" });
    }
  });

  // ── Tildel vendor til et draft-oppdrag ──
  app.post("/api/editing/jobs/:id/assign-vendor", async (req, res) => {
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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

  // ════════════════════════════════════════════════════════════════════
  // Editing-vendorens EGEN priskatalog — SAMME kilde (vendor_showcase_products)
  // som discovery + forespørsel leser fra, slik at det vendoren legger inn er
  // nøyaktig det fotografen ser og hyrer fra. Scoped til session.userId.
  // ════════════════════════════════════════════════════════════════════
  app.get("/api/editing/vendor/products", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT id, category, name, product_name, price, currency, description, image_url, status
           FROM vendor_showcase_products WHERE vendor_id = $1
          ORDER BY category ASC, price ASC NULLS LAST`,
        [session.userId],
      );
      res.json({
        products: r.rows.map((p) => ({
          id: p.id,
          category: p.category,
          name: p.name || p.product_name,
          price: p.price != null ? Number(p.price) : null,
          currency: p.currency || "NOK",
          description: p.description,
          imageUrl: p.image_url,
          status: p.status || "active",
        })),
      });
    } catch (err) {
      console.error("[editing/vendor/products] list", err);
      res.status(500).json({ error: "kunne_ikke_hente_produkter" });
    }
  });

  app.post("/api/editing/vendor/products", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    const { name, category, price, currency, description, imageUrl } = req.body || {};
    if (!name) return res.status(400).json({ error: "navn_pakrevd" });
    try {
      const r = await pool.query(
        `INSERT INTO vendor_showcase_products
           (vendor_id, product_type, name, product_name, category, price, currency, description, image_url, status)
         VALUES ($1, 'editing', $2, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id`,
        [
          session.userId,
          name,
          category || "all",
          price != null ? Number(price) : null,
          currency || "NOK",
          description || null,
          imageUrl || null,
        ],
      );
      res.json({ ok: true, id: r.rows[0].id });
    } catch (err) {
      console.error("[editing/vendor/products] create", err);
      res.status(500).json({ error: "kunne_ikke_opprette_produkt" });
    }
  });

  app.put("/api/editing/vendor/products/:id", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    const { name, category, price, currency, description, imageUrl } = req.body || {};
    try {
      const r = await pool.query(
        `UPDATE vendor_showcase_products
            SET name = COALESCE($3, name),
                product_name = COALESCE($3, product_name),
                category = COALESCE($4, category),
                price = $5,
                currency = COALESCE($6, currency),
                description = COALESCE($7, description),
                image_url = COALESCE($8, image_url),
                updated_at = NOW()
          WHERE id = $1 AND vendor_id = $2
          RETURNING id`,
        [
          req.params.id,
          session.userId,
          name ?? null,
          category ?? null,
          price != null ? Number(price) : null,
          currency ?? null,
          description ?? null,
          imageUrl ?? null,
        ],
      );
      if (!r.rows[0]) return res.status(404).json({ error: "ikke_funnet" });
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/vendor/products] update", err);
      res.status(500).json({ error: "kunne_ikke_oppdatere_produkt" });
    }
  });

  app.delete("/api/editing/vendor/products/:id", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `DELETE FROM vendor_showcase_products WHERE id = $1 AND vendor_id = $2 RETURNING id`,
        [req.params.id, session.userId],
      );
      if (!r.rows[0]) return res.status(404).json({ error: "ikke_funnet" });
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/vendor/products] delete", err);
      res.status(500).json({ error: "kunne_ikke_slette_produkt" });
    }
  });

  app.post("/api/editing/vendor/products/:id/status", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    const status = req.body?.status === "inactive" ? "inactive" : "active";
    try {
      const r = await pool.query(
        `UPDATE vendor_showcase_products SET status = $3, updated_at = NOW()
          WHERE id = $1 AND vendor_id = $2 RETURNING id`,
        [req.params.id, session.userId, status],
      );
      if (!r.rows[0]) return res.status(404).json({ error: "ikke_funnet" });
      res.json({ ok: true, status });
    } catch (err) {
      console.error("[editing/vendor/products] status", err);
      res.status(500).json({ error: "kunne_ikke_endre_status" });
    }
  });

  // Vendor registrerer sin EGEN NDA (f.eks. utenlandsk vendor med egen lov-valgt NDA).
  // Spores som motpart-dokument; vår DPA er fortsatt gjeldende avtale.
  app.post("/api/editing/vendor/nda", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    const b = req.body || {};
    const url = b.url ? String(b.url).slice(0, 500) : null;
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "ugyldig_url" });
    try {
      await pool.query(
        `UPDATE vendor_onboarding_profiles
            SET vendor_nda_governing_law = $2, vendor_nda_url = $3, vendor_nda_uploaded_at = now(), updated_at = now()
          WHERE user_id = $1`,
        [session.userId, b.governingLaw ? String(b.governingLaw).slice(0, 120) : null, url],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/vendor/nda] error", err);
      res.status(500).json({ error: "kunne_ikke_lagre_nda" });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Kvalitet/tillit: fotograf-anmeldelser + leverings-klager.
  // Mange klager → vendor flagges (skjules fra discovery) → kan avsluttes.
  // ════════════════════════════════════════════════════════════════════
  const QUALITY_FLAG_THRESHOLD = 3; // antall åpne klager før auto-flagg

  // Fotograf anmelder vendor (etter levering/godkjenning).
  app.post("/api/editing/jobs/:id/review", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      if (!["delivered", "approved", "delivered_to_client"].includes(auth.job.status)) {
        return res.status(400).json({ error: "kan_anmelde_kun_etter_levering" });
      }
      const rating = Math.max(1, Math.min(5, Number(req.body?.rating) || 0));
      if (!rating) return res.status(400).json({ error: "rating_pakrevd" });
      const vendorUserId = auth.job.vendor_id;
      await pool.query(
        `INSERT INTO editing_vendor_reviews (job_id, vendor_user_id, photographer_id, rating, aspects, comment)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)
         ON CONFLICT (job_id, photographer_id) WHERE job_id IS NOT NULL
         DO UPDATE SET rating = EXCLUDED.rating, aspects = EXCLUDED.aspects, comment = EXCLUDED.comment, created_at = now()`,
        [req.params.id, vendorUserId, session.userId, rating,
         JSON.stringify(req.body?.aspects || {}), req.body?.comment ? String(req.body.comment).slice(0, 2000) : null],
      );
      // Recompute aggregat → vendor_onboarding_profiles (discovery + tier leser disse).
      await pool.query(
        `UPDATE vendor_onboarding_profiles p SET
            rating = sub.avg_rating, review_count = sub.cnt, updated_at = now()
           FROM (SELECT AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*) AS cnt
                   FROM editing_vendor_reviews WHERE vendor_user_id = $1) sub
          WHERE p.user_id = $1`,
        [vendorUserId],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[editing/jobs/review] error", err);
      res.status(500).json({ error: "kunne_ikke_anmelde" });
    }
  });

  // Fotograf melder inn leverings-klage.
  app.post("/api/editing/jobs/:id/complaint", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      const category = ["quality", "deadline", "scope", "communication", "other"].includes(req.body?.category)
        ? req.body.category : "other";
      const vendorUserId = auth.job.vendor_id;
      await pool.query(
        `INSERT INTO editing_vendor_complaints (job_id, vendor_user_id, photographer_id, category, detail)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, vendorUserId, session.userId, category, req.body?.detail ? String(req.body.detail).slice(0, 4000) : null],
      );
      // Tell åpne klager + auto-flagg ved terskel.
      const cnt = (await pool.query<{ open: string; total: string }>(
        `SELECT COUNT(*) FILTER (WHERE status='open') AS open, COUNT(*) AS total
           FROM editing_vendor_complaints WHERE vendor_user_id = $1`, [vendorUserId],
      )).rows[0];
      const openCount = Number(cnt?.open || 0);
      const flagged = openCount >= QUALITY_FLAG_THRESHOLD;
      await pool.query(
        `UPDATE vendor_onboarding_profiles
            SET open_complaint_count = $2, complaint_total = $3,
                quality_flagged = quality_flagged OR $4,
                quality_flagged_at = CASE WHEN $4 AND NOT quality_flagged THEN now() ELSE quality_flagged_at END,
                updated_at = now()
          WHERE user_id = $1`,
        [vendorUserId, openCount, Number(cnt?.total || 0), flagged],
      );
      res.json({ ok: true, flagged });
    } catch (err) {
      console.error("[editing/jobs/complaint] error", err);
      res.status(500).json({ error: "kunne_ikke_melde_klage" });
    }
  });

  // Offentlig (innlogget) liste over en vendors anmeldelser — for discovery-profil.
  app.get("/api/editing/vendors/:vendorUserId/reviews", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT rating, aspects, comment, created_at FROM editing_vendor_reviews
          WHERE vendor_user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.params.vendorUserId],
      );
      res.json({ reviews: r.rows });
    } catch (err) {
      console.error("[editing/vendor/reviews] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_anmeldelser" });
    }
  });

  // ── Vendor aksepterer (krever compliance) -> mint opplastings-token ──
  app.post("/api/editing/jobs/:id/accept", async (req, res) => {
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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
        const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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
      // Escrow: frigi utbetaling til vendor (Stripe Connect / PayPal) ved godkjenning
      const payout = await releasePayoutForJob(pool, req.params.id);
      await logJobEvent(pool, req.params.id, "payment_released", "system", "system", {
        status: payout.status,
        method: payout.method,
        reference: payout.reference,
        error: payout.error,
      });
      // TODO(#10): opprett Showcase-galleri fra leverte filer
      res.json({ ok: true, payout });
    } catch (err) {
      console.error("[editing/jobs:approve] error", err);
      res.status(500).json({ error: "kunne_ikke_godkjenne" });
    }
  });

  // ── Fotograf starter betaling (Stripe checkout ELLER faktura) ──
  app.post("/api/editing/jobs/:id/pay", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      const method = req.body?.paymentMethod === "invoice" ? "invoice" : "stripe";
      await pool.query(`UPDATE editing_jobs SET payment_method = $2, updated_at = NOW() WHERE id = $1`, [
        req.params.id,
        method,
      ]);

      if (method === "invoice") {
        // Faktura-flyt: marker som «held» (escrow) i påvente av fakturabetaling.
        await pool.query(`UPDATE editing_jobs SET payment_status = 'held' WHERE id = $1`, [req.params.id]);
        await logJobEvent(pool, req.params.id, "payment_held", session.userId, "photographer", { method });
        return res.json({ ok: true, method, status: "held" });
      }

      const successUrl = req.body?.successUrl || `${req.headers.origin || ""}/?editing_pay=success&job=${req.params.id}`;
      const cancelUrl = req.body?.cancelUrl || `${req.headers.origin || ""}/?editing_pay=cancel&job=${req.params.id}`;
      const out = await createCheckoutForJob(auth.job, successUrl, cancelUrl);
      if (!out.ok) return res.status(503).json({ error: out.error });
      await pool.query(`UPDATE editing_jobs SET stripe_checkout_session_id = $2 WHERE id = $1`, [
        req.params.id,
        out.sessionId || null,
      ]);
      res.json({ ok: true, method, checkoutUrl: out.url });
    } catch (err) {
      console.error("[editing/jobs:pay] error", err);
      res.status(500).json({ error: "kunne_ikke_starte_betaling" });
    }
  });

  // ── Bekreft Stripe-betaling (success-redirect) -> escrow «held» ──
  app.post("/api/editing/jobs/:id/payment/confirm", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      const sid = auth.job.stripe_checkout_session_id;
      if (!sid) return res.status(400).json({ error: "ingen_session" });
      const paid = await isCheckoutPaid(sid);
      if (!paid) return res.json({ ok: false, status: auth.job.payment_status });
      await pool.query(`UPDATE editing_jobs SET payment_status = 'held' WHERE id = $1`, [req.params.id]);
      await logJobEvent(pool, req.params.id, "payment_held", session.userId, "photographer", { method: "stripe" });
      res.json({ ok: true, status: "held" });
    } catch (err) {
      console.error("[editing/jobs:payment-confirm] error", err);
      res.status(500).json({ error: "kunne_ikke_bekrefte_betaling" });
    }
  });

  // ── Lever til kunde: opprett Showcase/klient-galleri fra godkjent leveranse ──
  app.post("/api/editing/jobs/:id/deliver-to-client", async (req, res) => {
    const session = await requireUserSession(req, res);
    if (!session) return;
    try {
      const auth = await loadAuthorizedJob(req.params.id, session.userId);
      if (!auth || auth.role !== "photographer") return res.status(404).json({ error: "ikke_funnet" });
      if (!["approved", "delivered_to_client"].includes(auth.job.status)) {
        return res.status(400).json({ error: "ikke_godkjent" });
      }
      const clientName = (req.body?.clientName || "").trim();
      const clientEmail = (req.body?.clientEmail || "").trim();
      if (!clientName || !clientEmail) return res.status(400).json({ error: "mangler_klientinfo" });

      const result = await createClientGalleryFromJob(pool, req.params.id, clientName, clientEmail);
      if (!result.ok) return res.status(502).json({ error: result.error });

      await pool.query(
        `UPDATE editing_jobs SET status = 'delivered_to_client', delivered_to_client_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      await logJobEvent(pool, req.params.id, "delivered_to_client", session.userId, "photographer", {
        galleryId: result.galleryId,
        imageCount: result.imageCount,
      });
      const origin = req.headers.origin || process.env.PUBLIC_APP_URL || "";
      res.json({
        ok: true,
        galleryId: result.galleryId,
        imageCount: result.imageCount,
        shareUrl: result.accessToken ? `${origin}/client/gallery/${result.accessToken}` : null,
      });
    } catch (err) {
      console.error("[editing/jobs:deliver-to-client] error", err);
      res.status(500).json({ error: "kunne_ikke_levere_til_kunde" });
    }
  });

  // ── Be om revisjon (innenfor maks-grense) ──
  app.post("/api/editing/jobs/:id/request-revision", async (req, res) => {
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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
    const session = await requireUserSession(req, res);
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
        platformFee: platformFeeInfo((row || {}) as FeeConfig),
      });
    } catch (err) {
      console.error("[editing/vendor/me] error", err);
      res.status(500).json({ error: "kunne_ikke_hente_profil" });
    }
  });

  // ── Vendor aksepterer Creatorhub Vendor Standard (compliance) ──
  app.post("/api/editing/vendor/compliance/accept", async (req, res) => {
    const session = await requireUserSession(req, res);
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
