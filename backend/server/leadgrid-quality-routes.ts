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
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  assertAnyEntitledForOrganization,
  LEADGRID_KVALITET_FEATURE_KEYS,
} from "./leadgrid-entitlement-guard.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

const QUALITY_FEATURE_KEYS = LEADGRID_KVALITET_FEATURE_KEYS;
const QUALITY_ROLES = new Set(["admin", "salgssjef", "kvalitet"]);
const VALID_VERDICTS = new Set(["verified", "rejected", "needs_followup"]);
const VALID_REASONS = new Set([
  "feil_pris", "kunde_angret", "mangelfull_dokumentasjon",
  "feilinformert_kunde", "ikke_kontakt", "annet",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      Promise<{
        userId: string;
        orgId: string;
        projectId: string;
        isVerifier: boolean;
        isAdmin: boolean;
        name: string;
      } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = String(req.body?.projectId ?? req.query.projectId ?? "").trim();
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    const claimedOrgId = String(
      req.body?.organizationId ?? req.body?.organization_id
        ?? req.query.organizationId ?? req.query.organization_id ?? "",
    ).trim();
    if (claimedOrgId && claimedOrgId !== project.organizationId) {
      res.status(409).json({ error: "organization_project_mismatch" });
      return null;
    }
    const ok = await assertAnyEntitledForOrganization(
      pool,
      project.organizationId,
      QUALITY_FEATURE_KEYS,
      res,
    );
    if (!ok) return null;
    const orgId = project.organizationId;
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
    return { userId: session.userId, orgId, projectId: project.id, isVerifier, isAdmin,
             name: nameRow.rows[0]?.name ?? session.userId };
  }

  const templateDto = (t: any) => ({
    id: t.id, project_id: t.project_id, name: t.name, product_name: t.product_name,
    intro_script: t.intro_script, questions: t.questions,
    outro_script: t.outro_script, is_active: t.is_active, sort_order: t.sort_order,
  });

  const verificationDto = (v: any) => ({
    id: v.id, project_id: v.project_id,
    customer_id: v.customer_id, customer_name: v.customer_name,
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
          WHERE organization_id = $1 AND project_id = $2
          ORDER BY sort_order, name`,
        [s.orgId, s.projectId],
      );
      if (existing.rowCount === 0) {
        const id = (globalThis.crypto as any).randomUUID();
        await pool.query(
          `INSERT INTO leadgrid_verification_templates
             (id, organization_id, project_id, name, product_name, intro_script, questions, outro_script)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, s.orgId, s.projectId, DEFAULT_TEMPLATE.name, DEFAULT_TEMPLATE.product_name,
           DEFAULT_TEMPLATE.intro_script, JSON.stringify(DEFAULT_TEMPLATE.questions),
           DEFAULT_TEMPLATE.outro_script],
        );
        const seeded = await pool.query(
          `SELECT * FROM leadgrid_verification_templates
            WHERE organization_id = $1 AND project_id = $2`,
          [s.orgId, s.projectId],
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
           (id, organization_id, project_id, name, product_name, intro_script, questions, outro_script, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, s.orgId, s.projectId, name, String(b.productName ?? b.product_name ?? ""),
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
      const params: any[] = [id, s.orgId, s.projectId];
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
          WHERE id = $1 AND organization_id = $2 AND project_id = $3`,
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
           (id, organization_id, project_id, customer_id, customer_name, customer_phone,
            seller_user_id, seller_name, deal_amount, deal_currency, won_at)
         SELECT gen_random_uuid(), $1, $2, c.id::text, COALESCE(c.name, ''), c.phone,
                c.owner_user_id,
                COALESCE(up.display_name, u.email, c.owner_user_id),
                c.deal_amount, c.deal_currency, c.deal_stage_changed_at
           FROM crm_customers c
           LEFT JOIN users u ON u.id::text = c.owner_user_id
           LEFT JOIN user_profiles up
             ON up.user_id::text = c.owner_user_id AND up.organization_id::text = $1
          WHERE c.archived_at IS NULL
            AND c.pipeline_stage = 'won'
            AND c.organization_id::text = $1
            AND c.project_id = $2
         ON CONFLICT (organization_id, project_id, customer_id)
           WHERE project_id IS NOT NULL
         DO NOTHING`,
        [s.orgId, s.projectId],
      );
      const status = String(req.query.status || "");
      const params: any[] = [s.orgId, s.projectId];
      let where = "organization_id = $1 AND project_id = $2";
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
          WHERE organization_id = $1 AND project_id = $2 GROUP BY status`,
        [s.orgId, s.projectId],
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (templateId) {
          const template = await client.query(
            `SELECT 1 FROM leadgrid_verification_templates
              WHERE id = $1 AND organization_id = $2 AND project_id = $3
              LIMIT 1`,
            [templateId, s.orgId, s.projectId],
          );
          if (template.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "template_not_in_project" });
          }
        }
        const r = await client.query(
          `UPDATE leadgrid_sales_verifications SET
             status = $4, answers = $5, reason_code = $6, note = $7,
             call_outcome = $8, template_id = $9,
             verified_by = $10, verified_by_name = $11,
             verified_at = now(), updated_at = now()
           WHERE id = $1 AND organization_id = $2 AND project_id = $3
           RETURNING customer_name, seller_user_id, seller_name, deal_amount, won_at`,
          [id, s.orgId, s.projectId, status, JSON.stringify(answers),
           status === "rejected" ? String(reason) : null,
           String(b.note ?? ""), b.callOutcome ?? b.call_outcome ?? null,
           templateId, s.userId, s.name],
        );
        if (r.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "not_found" });
        }

        // Verdikt + ønsket Leadbook-utkast er én atomisk brukerhandling. En
        // feil skal derfor ikke kvitteres som suksess med et tapt eksempel.
        if (b.flagAsExample === true || b.flag_as_example === true) {
          const row = r.rows[0];
          await client.query(
            `INSERT INTO leadbook_examples
               (id, organization_id, project_id, status, title, customer_label, outcome,
                seller_user_id, seller_name, happened_on, deal_value_nok,
                summary, source_verification_id, created_by, created_by_name)
             VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (organization_id, project_id, source_verification_id)
               WHERE project_id IS NOT NULL
                 AND source_verification_id IS NOT NULL
             DO NOTHING`,
            [
              (globalThis.crypto as { randomUUID: () => string }).randomUUID(),
              s.orgId, s.projectId,
              `Samtale: ${row.customer_name || "kunde"}`,
              String(row.customer_name ?? ""),
              status === "verified" ? "won" : "lost",
              row.seller_user_id, String(row.seller_name ?? ""),
              row.won_at ?? null,
              row.deal_amount != null ? Math.trunc(Number(row.deal_amount)) : null,
              String(b.note ?? ""), id, s.userId, s.name,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw transactionError;
      } finally {
        client.release();
      }

      // Dørsalg-kobling (mig 0400): verifisert dørsalg = kontrolløren fikk
      // kunden på tråden → salget flippes til telefon_bekreftet (med mindre
      // det alt er BankID-signert). Best effort — velter aldri verdiktet.
      if (status === "verified") {
        try {
          await pool.query(
            `UPDATE leadgrid_dorsalg_sales ds SET
               verifisering = CASE WHEN ds.verifisering IN ('uverifisert', 'kunde_bekreftet')
                                   THEN 'telefon_bekreftet' ELSE ds.verifisering END,
               updated_at = now()
             FROM leadgrid_sales_verifications v
            WHERE v.id = $1 AND v.organization_id = $2 AND v.project_id = $3
              AND v.customer_id LIKE 'dorsalg:%'
              AND ds.org_id = v.organization_id
              AND ds.project_id = v.project_id
              AND ds.adresse_id = SUBSTRING(v.customer_id FROM 9)`,
            [id, s.orgId, s.projectId],
          );
        } catch (dsErr) {
          console.warn("[leadgrid-quality] dorsalg-flip failed:", (dsErr as Error).message);
        }
      }

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
          WHERE organization_id = $1 AND project_id = $2
          GROUP BY seller_user_id
          ORDER BY rejected DESC, total DESC`,
        [s.orgId, s.projectId],
      );
      const reasons = await pool.query(
        `SELECT reason_code, COUNT(*)::int AS n
           FROM leadgrid_sales_verifications
          WHERE organization_id = $1 AND project_id = $2
            AND status = 'rejected' AND reason_code IS NOT NULL
          GROUP BY reason_code ORDER BY n DESC`,
        [s.orgId, s.projectId],
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
