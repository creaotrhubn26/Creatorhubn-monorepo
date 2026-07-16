/**
 * leadgrid-quality-routes.ts
 *
 * Kvalitet-avdelingen (Sales QA / verifisering): vunnede salg havner i en
 * verifiseringskø der en kvalitetskontrollør ringer kunden med en SAMTALE-MAL
 * (intro + spørsmål per produkt), krysser av at alt stemmer, og feller verdikt:
 * verifisert / underkjent (m/ årsakskode) / trenger oppfølging.
 *
 * Kø-populering er LAT og selv-helende: GET /queue oppretter pending-rader for
 * vunnede salg i org-en som mangler verifisering (ingen hook i deals-service).
 *
 * Roller: kvalitet + admin/salgssjef (+ permission leadgrid_quality.verify).
 * Underkjente salg trekkes IKKE automatisk fra provisjon i v1 — de flagges
 * til salgssjef via status + stats-endepunktet.
 *
 * Mount: /api/leadgrid/quality/*
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import { assertAnyEntitled, LEADGRID_KVALITET_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";

const QUALITY_FEATURE_KEYS = LEADGRID_KVALITET_FEATURE_KEYS;
const QUALITY_ROLES = new Set(["admin", "salgssjef", "kvalitet"]);
const VALID_VERDICTS = new Set(["verified", "rejected", "needs_followup"]);
const VALID_REASONS = new Set([
  "feil_pris", "kunde_angret", "mangelfull_dokumentasjon",
  "feilinformert_kunde", "ikke_kontakt", "annet",
]);
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  // Samtale-maler (mig 0377) — per produkt: intro + spørsmål m/ sjekk-hint.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_verification_templates (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      intro_script TEXT NOT NULL DEFAULT '',
      questions JSONB NOT NULL DEFAULT '[]',
      outro_script TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_lg_vtempl_org ON leadgrid_verification_templates (organization_id, is_active)`,
  );
  // Verifiseringer — én pr vunnet salg (kø + historikk).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_sales_verifications (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_phone TEXT,
      seller_user_id TEXT,
      seller_name TEXT,
      deal_amount NUMERIC,
      deal_currency TEXT,
      won_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'pending',
      template_id UUID,
      answers JSONB NOT NULL DEFAULT '[]',
      reason_code TEXT,
      note TEXT NOT NULL DEFAULT '',
      call_outcome TEXT,
      verified_by TEXT,
      verified_by_name TEXT,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_sverif_org_customer
       ON leadgrid_sales_verifications (organization_id, customer_id)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_lg_sverif_org_status
       ON leadgrid_sales_verifications (organization_id, status, created_at DESC)`,
  );
  schemaReady = true;
}

/** Standard-mal seedes for org uten maler — kontrolløren skal aldri møte tomt verktøy. */
const DEFAULT_TEMPLATE = {
  name: "Standard velkomstsamtale",
  product_name: "",
  intro_script:
    "Hei, du snakker med {ditt navn} fra kvalitetsavdelingen i {din bedrift}. " +
    "Gratulerer med avtalen! Dette er en kort velkomstsamtale — vi ringer alle nye " +
    "kunder for å sikre at alt er riktig før vi setter i gang. Det tar to minutter.",
  questions: [
    { id: "q_product", question: "Kan du bekrefte hvilket produkt/tjeneste du har bestilt?",
      checkHint: "Skal stemme med produktet på salget — ordrett fra kunden, ikke ledende." },
    { id: "q_price", question: "Hvilken pris og betalingsfrekvens har du fått oppgitt?",
      checkHint: "Skal stemme med avtalt beløp og periode (mnd/år). Avvik = stopp og noter." },
    { id: "q_terms", question: "Fikk du informasjon om bindingstid og oppsigelse?",
      checkHint: "Kunden skal kunne gjengi hovedtrekkene uten hjelp." },
    { id: "q_cancel", question: "Er du kjent med angreretten din på 14 dager?",
      checkHint: "Lovpålagt ved telefonsalg — hvis nei: informer nå og noter." },
    { id: "q_expect", question: "Hva forventer du skjer videre nå?",
      checkHint: "Skal matche faktisk leveranse/oppstart. Feil forventning = følg opp selger." },
    { id: "q_experience", question: "Hvordan opplevde du samtalen med selgeren vår?",
      checkHint: "Fritt svar — press/utydelighet noteres og går til salgssjef." },
  ],
  outro_script:
    "Tusen takk for tiden din! Da er alt bekreftet og du hører fra oss ved oppstart. " +
    "Velkommen som kunde.",
};

export function registerLeadgridQualityRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  async function gate(req: Request, res: Response):
      Promise<{ userId: string; orgId: string; isVerifier: boolean; isAdmin: boolean; name: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const ok = await assertAnyEntitled(pool, session.userId, QUALITY_FEATURE_KEYS, res);
    if (!ok) return null;
    await ensureSchema(pool);
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const { role, permissions } = await resolveEffectivePermissions(pool, orgId, session.userId);
    const isAdmin = role === "admin" || role === "salgssjef" || permissions.has("leadgrid_quality.admin");
    const isVerifier = isAdmin || (role != null && QUALITY_ROLES.has(role)) ||
      permissions.has("leadgrid_quality.verify");
    const nameRow = await pool.query(
      `SELECT COALESCE(up.display_name, u.email, $2) AS name
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id AND up.organization_id::text = $1
        WHERE u.id = $2`,
      [orgId, session.userId],
    );
    return { userId: session.userId, orgId, isVerifier, isAdmin,
             name: nameRow.rows[0]?.name ?? session.userId };
  }

  const templateDto = (t: any) => ({
    id: t.id, name: t.name, product_name: t.product_name,
    intro_script: t.intro_script, questions: t.questions,
    outro_script: t.outro_script, is_active: t.is_active, sort_order: t.sort_order,
  });

  const verificationDto = (v: any) => ({
    id: v.id, customer_id: v.customer_id, customer_name: v.customer_name,
    customer_phone: v.customer_phone, seller_user_id: v.seller_user_id,
    seller_name: v.seller_name,
    deal_amount: v.deal_amount == null ? null : Number(v.deal_amount),
    deal_currency: v.deal_currency,
    won_at: v.won_at ? new Date(v.won_at).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
    status: v.status, template_id: v.template_id, answers: v.answers,
    reason_code: v.reason_code, note: v.note, call_outcome: v.call_outcome,
    verified_by_name: v.verified_by_name,
    verified_at: v.verified_at ? new Date(v.verified_at).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
  });

  // ── GET /quality/templates — maler (seed default hvis org er tom) ──
  app.get("/api/leadgrid/quality/templates", async (req, res) => {
    const s = await gate(req, res);
    if (!s) return;
    if (!s.isVerifier) return res.status(403).json({ error: "not_quality" });
    try {
      const existing = await pool.query(
        `SELECT * FROM leadgrid_verification_templates
          WHERE organization_id = $1 ORDER BY sort_order, name`,
        [s.orgId],
      );
      if (existing.rowCount === 0) {
        const id = (globalThis.crypto as any).randomUUID();
        await pool.query(
          `INSERT INTO leadgrid_verification_templates
             (id, organization_id, name, product_name, intro_script, questions, outro_script)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, s.orgId, DEFAULT_TEMPLATE.name, DEFAULT_TEMPLATE.product_name,
           DEFAULT_TEMPLATE.intro_script, JSON.stringify(DEFAULT_TEMPLATE.questions),
           DEFAULT_TEMPLATE.outro_script],
        );
        const seeded = await pool.query(
          `SELECT * FROM leadgrid_verification_templates WHERE organization_id = $1`,
          [s.orgId],
        );
        return res.json({ templates: seeded.rows.map(templateDto) });
      }
      return res.json({ templates: existing.rows.map(templateDto) });
    } catch (err) {
      console.warn("[leadgrid-quality] templates failed:", (err as Error).message);
      return res.status(500).json({ error: "templates_failed" });
    }
  });

  // ── POST /quality/templates — ny mal (admin) ──────────────────────
  app.post("/api/leadgrid/quality/templates", async (req, res) => {
    const s = await gate(req, res);
    if (!s) return;
    if (!s.isAdmin) return res.status(403).json({ error: "not_quality_admin" });
    try {
      const b = req.body || {};
      const name = String(b.name ?? "").trim();
      if (!name) return res.status(400).json({ error: "missing_name" });
      const questions = Array.isArray(b.questions) ? b.questions.slice(0, 40) : [];
      const id = (globalThis.crypto as any).randomUUID();
      await pool.query(
        `INSERT INTO leadgrid_verification_templates
           (id, organization_id, name, product_name, intro_script, questions, outro_script, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, s.orgId, name, String(b.productName ?? b.product_name ?? ""),
         String(b.introScript ?? b.intro_script ?? ""), JSON.stringify(questions),
         String(b.outroScript ?? b.outro_script ?? ""), Number(b.sortOrder ?? b.sort_order ?? 0)],
      );
      return res.json({ ok: true, id });
    } catch (err) {
      console.warn("[leadgrid-quality] template create failed:", (err as Error).message);
      return res.status(500).json({ error: "template_create_failed" });
    }
  });

  // ── PATCH /quality/templates/:id (admin) ──────────────────────────
  app.patch("/api/leadgrid/quality/templates/:id", async (req, res) => {
    const s = await gate(req, res);
    if (!s) return;
    if (!s.isAdmin) return res.status(403).json({ error: "not_quality_admin" });
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      const b = req.body || {};
      const sets: string[] = [];
      const params: any[] = [id, s.orgId];
      const push = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
      if (b.name !== undefined) push("name", String(b.name));
      if (b.productName !== undefined || b.product_name !== undefined)
        push("product_name", String(b.productName ?? b.product_name ?? ""));
      if (b.introScript !== undefined || b.intro_script !== undefined)
        push("intro_script", String(b.introScript ?? b.intro_script ?? ""));
      if (b.outroScript !== undefined || b.outro_script !== undefined)
        push("outro_script", String(b.outroScript ?? b.outro_script ?? ""));
      if (b.questions !== undefined)
        push("questions", JSON.stringify(Array.isArray(b.questions) ? b.questions.slice(0, 40) : []));
      if (b.isActive !== undefined || b.is_active !== undefined)
        push("is_active", !!(b.isActive ?? b.is_active));
      if (b.sortOrder !== undefined || b.sort_order !== undefined)
        push("sort_order", Number(b.sortOrder ?? b.sort_order ?? 0));
      if (sets.length === 0) return res.status(400).json({ error: "no_fields" });
      sets.push("updated_at = now()");
      const r = await pool.query(
        `UPDATE leadgrid_verification_templates SET ${sets.join(", ")}
          WHERE id = $1 AND organization_id = $2`,
        params,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-quality] template update failed:", (err as Error).message);
      return res.status(500).json({ error: "template_update_failed" });
    }
  });

  // ── GET /quality/queue — kø (lat backfill av vunnede salg) ────────
  app.get("/api/leadgrid/quality/queue", async (req, res) => {
    const s = await gate(req, res);
    if (!s) return;
    if (!s.isVerifier) return res.status(403).json({ error: "not_quality" });
    try {
      // Selv-helende backfill: vunnede, uarkiverte salg i org-en uten
      // verifiseringsrad får en pending. ON CONFLICT gjør den idempotent.
      await pool.query(
        `INSERT INTO leadgrid_sales_verifications
           (id, organization_id, customer_id, customer_name, customer_phone,
            seller_user_id, seller_name, deal_amount, deal_currency, won_at)
         SELECT gen_random_uuid(), $1, c.id::text, COALESCE(c.name, ''), c.phone,
                c.owner_user_id,
                COALESCE(up.display_name, u.email, c.owner_user_id),
                c.deal_amount, c.deal_currency, c.deal_stage_changed_at
           FROM crm_customers c
           LEFT JOIN users u ON u.id::text = c.owner_user_id
           LEFT JOIN user_profiles up
             ON up.user_id::text = c.owner_user_id AND up.organization_id::text = $1
          WHERE c.archived_at IS NULL
            AND c.pipeline_stage = 'won'
            AND c.owner_user_id IN (
              SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid
            )
         ON CONFLICT (organization_id, customer_id) DO NOTHING`,
        [s.orgId],
      );
      const status = String(req.query.status || "");
      const params: any[] = [s.orgId];
      let where = "organization_id = $1";
      if (status && ["pending", "verified", "rejected", "needs_followup"].includes(status)) {
        params.push(status); where += ` AND status = $${params.length}`;
      }
      const r = await pool.query(
        `SELECT * FROM leadgrid_sales_verifications
          WHERE ${where}
          ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'needs_followup' THEN 1 ELSE 2 END,
                   created_at DESC
          LIMIT 300`,
        params,
      );
      const counts = await pool.query(
        `SELECT status, COUNT(*)::int AS n FROM leadgrid_sales_verifications
          WHERE organization_id = $1 GROUP BY status`,
        [s.orgId],
      );
      const byStatus: Record<string, number> = {};
      for (const row of counts.rows) byStatus[row.status] = row.n;
      return res.json({ verifications: r.rows.map(verificationDto), counts: byStatus });
    } catch (err) {
      console.warn("[leadgrid-quality] queue failed:", (err as Error).message);
      return res.status(500).json({ error: "queue_failed" });
    }
  });

  // ── POST /quality/verifications/:id/verdict — fell verdikt ────────
  app.post("/api/leadgrid/quality/verifications/:id/verdict", async (req, res) => {
    const s = await gate(req, res);
    if (!s) return;
    if (!s.isVerifier) return res.status(403).json({ error: "not_quality" });
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      const b = req.body || {};
      const status = String(b.status ?? "");
      if (!VALID_VERDICTS.has(status)) return res.status(400).json({ error: "invalid_status" });
      const reason = b.reasonCode ?? b.reason_code ?? null;
      if (status === "rejected" && !VALID_REASONS.has(String(reason)))
        return res.status(400).json({ error: "missing_reason_code" });
      const answers = Array.isArray(b.answers) ? b.answers.slice(0, 60) : [];
      const templateId = b.templateId ?? b.template_id ?? null;
      if (templateId && !UUID_RE.test(String(templateId)))
        return res.status(400).json({ error: "invalid_template_id" });
      const r = await pool.query(
        `UPDATE leadgrid_sales_verifications SET
           status = $3, answers = $4, reason_code = $5, note = $6,
           call_outcome = $7, template_id = $8,
           verified_by = $9, verified_by_name = $10, verified_at = now(), updated_at = now()
         WHERE id = $1 AND organization_id = $2`,
        [id, s.orgId, status, JSON.stringify(answers),
         status === "rejected" ? String(reason) : null,
         String(b.note ?? ""), b.callOutcome ?? b.call_outcome ?? null,
         templateId, s.userId, s.name],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-quality] verdict failed:", (err as Error).message);
      return res.status(500).json({ error: "verdict_failed" });
    }
  });

  // ── GET /quality/stats — kvalitetsgrad per selger + årsakskoder ────
  app.get("/api/leadgrid/quality/stats", async (req, res) => {
    const s = await gate(req, res);
    if (!s) return;
    if (!s.isVerifier) return res.status(403).json({ error: "not_quality" });
    try {
      const per = await pool.query(
        `SELECT seller_user_id, MAX(seller_name) AS seller_name,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'verified')::int AS verified,
                COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE status = 'needs_followup')::int AS followup
           FROM leadgrid_sales_verifications
          WHERE organization_id = $1
          GROUP BY seller_user_id
          ORDER BY rejected DESC, total DESC`,
        [s.orgId],
      );
      const reasons = await pool.query(
        `SELECT reason_code, COUNT(*)::int AS n
           FROM leadgrid_sales_verifications
          WHERE organization_id = $1 AND status = 'rejected' AND reason_code IS NOT NULL
          GROUP BY reason_code ORDER BY n DESC`,
        [s.orgId],
      );
      return res.json({
        sellers: per.rows.map((x) => ({
          seller_user_id: x.seller_user_id, seller_name: x.seller_name,
          total: x.total, verified: x.verified, rejected: x.rejected,
          pending: x.pending, followup: x.followup,
        })),
        reasons: reasons.rows.map((x) => ({ reason_code: x.reason_code, count: x.n })),
      });
    } catch (err) {
      console.warn("[leadgrid-quality] stats failed:", (err as Error).message);
      return res.status(500).json({ error: "stats_failed" });
    }
  });
}
