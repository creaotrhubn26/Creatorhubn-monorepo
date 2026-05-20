/**
 * admin-room-funding-routes.ts
 *
 * Setup-funksjon for /api/admin-room/funding-apps endpoints.
 * 5 endpoints: list, create, update (patch), delete, samt AI-utkast-generator
 * (`POST /:id/generate`) som bruker forretningsplan som kontekst.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminFundingRoutes } from "./admin-room-funding-routes";
 *
 *   setupAdminFundingRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Mode-noter: ingen Role Room-modes (Produksjonsteam / Innholdsprodusent /
 * Utdanningsinstitusjon / Dansestudio) påvirker disse endpoints. Funding er
 * Admin Room-funksjonalitet og er kun synlig for produkteier.
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, asNumberOrNull, asJsonbArray, asJsonbObject } from "./_shared";
import { logAIUsage } from "./ai-usage-tracker.js";

export function setupAdminFundingRoutes(deps: AdminRoomRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminRoomAccess,
    logAdminActivity,
  } = deps;

  // ── AI-utkast for søknads-tekst ────────────────────────────────────
  app.post("/api/admin-room/funding-apps/:id/generate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        res.status(503).json({ error: "ANTHROPIC_API_KEY er ikke satt" });
        return;
      }
      // Hent søknaden + forretningsplan som kontekst
      const appResult = await pool.query(
        `SELECT * FROM admin_funding_apps WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!appResult.rowCount) {
        res.status(404).json({ error: "Søknad ikke funnet" });
        return;
      }
      const app_ = appResult.rows[0];
      const planResult = await pool.query(
        `SELECT * FROM admin_business_plan WHERE user_id = $1`,
        [session.userId],
      );
      const plan = planResult.rows[0] ?? null;

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });

      const planContext = plan
        ? [
            `EXEC SUMMARY: ${plan.exec_summary ?? ""}`,
            `INTRO: ${plan.intro_overview ?? ""}`,
            `MARKED: ${plan.intro_industry ?? ""}`,
            `KONKURRANSE: ${plan.external_competitors ?? ""}`,
            `STYRKER: ${plan.swot_strengths ?? ""}`,
            `MULIGHETER: ${plan.swot_opportunities ?? ""}`,
            `STRATEGI: ${plan.strategic_recommendation ?? ""}`,
          ].filter((s) => s.split(":")[1]?.trim()).join("\n\n")
        : "";

      const schemeInstructions: Record<string, string> = {
        innovasjon_norge_1: "IN-Markedsavklaring: 1500-2000 tegn. Fokus på markedsbehov-validering, konkrete intervju-/pilot-mål, ROI-måling.",
        innovasjon_norge_2: "IN-Kommersialisering: 2500-3500 tegn. Fokus på skalering, GTM-strategi, leveranse-operasjoner, ARR-mål.",
        in_innovasjonskontrakter: "IN-Innovasjonskontrakter: 2000-3000 tegn. Fokus på samutvikling med kunde, problem-løsning-fit.",
        eu_horizon_eic: "EIC Accelerator: 3000-4000 tegn. Fokus på europeisk skalering, breakthrough-teknologi, sosial impact.",
      };
      const schemeGuide = schemeInstructions[app_.scheme] ?? "Generell støttesøknad: 1500-2500 tegn med markedsbehov, mål, og konkrete tiltak.";

      const systemPrompt = `Du er en søknadsskriver for norske støtteordninger (Innovasjon Norge, EU Horizon).

Skrivestil:
- Norsk, formell forretnings-stil
- Konkret og datadrevet, ikke hype
- Strukturert med kortfattede punkter eller nummererte avsnitt
- Ingen anførselstegn rundt outputen
- Ingen forspil — returner kun innholdet selv`;

      const userPrompt = [
        `Skriv søknadstekst for: ${app_.scheme_label}`,
        `Prosjekt: ${app_.project_name}`,
        `Søker: ${app_.applicant_company ?? "CreatorHub Norge AS"}`,
        `Beløp: ${app_.amount_requested ? `${app_.amount_requested} ${app_.currency}` : "ikke satt"}`,
        "",
        `Format-krav: ${schemeGuide}`,
        "",
        app_.description ? `Eksisterende utkast (utvid eller forbedre):\n${app_.description}` : "Skriv et førsteutkast.",
        "",
        planContext ? `Forretningskontekst:\n${planContext}` : "",
      ].filter(Boolean).join("\n");

      const aiStartedAt = Date.now();
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      logAIUsage(response as any, {
        feature: 'admin-funding-app-draft',
        route: '/api/admin-room/funding/generate',
        userId: session.userId,
        durationMs: Date.now() - aiStartedAt,
      }).catch(() => undefined);

      type ContentBlock = { type: string; text?: string };
      const generatedText = (response.content as ContentBlock[])
        .filter((b): b is { type: 'text'; text: string } => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();

      // Lagre + logg
      const updated = await pool.query(
        `UPDATE admin_funding_apps SET description = $1, updated_at = now()
          WHERE id = $2 AND user_id = $3 RETURNING *`,
        [generatedText, req.params.id, session.userId],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "funding_app",
        entityId: req.params.id,
        action: "generated",
        summary: `AI-utkast generert (${response.usage.output_tokens} tokens)`,
        details: { tokens: response.usage },
      });
      res.json({
        item: updated.rows[0],
        tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      });
    } catch (err) {
      console.error("admin-room funding-apps generate error", err);
      res.status(500).json({
        error: "Kunne ikke generere via Claude",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  // ── Funding apps ────────────────────────────────────────────────────
  app.get("/api/admin-room/funding-apps", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM admin_funding_apps WHERE user_id = $1 ORDER BY created_at DESC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("admin-room funding-apps list error", err);
      res.status(500).json({ error: "Kunne ikke hente søknader" });
    }
  });

  app.post("/api/admin-room/funding-apps", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!asString(body.scheme) || !asString(body.schemeLabel) || !asString(body.projectName)) {
      res.status(400).json({ error: "scheme, schemeLabel og projectName er påkrevd" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO admin_funding_apps
           (user_id, scheme, scheme_label, project_name, applicant_company, status,
            amount_requested, currency, description, milestones, budget_breakdown,
            contact_person, contact_email, submission_date, decision_date, deadline,
            notes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
                 $12, $13, $14, $15, $16, $17, $18::jsonb)
         RETURNING *`,
        [
          session.userId,
          asString(body.scheme),
          asString(body.schemeLabel),
          asString(body.projectName),
          asString(body.applicantCompany),
          asString(body.status, "draft"),
          asNumberOrNull(body.amountRequested),
          asString(body.currency, "NOK"),
          asString(body.description),
          asJsonbArray(body.milestones),
          asJsonbArray(body.budgetBreakdown),
          asString(body.contactPerson),
          asString(body.contactEmail),
          asString(body.submissionDate),
          asString(body.decisionDate),
          asString(body.deadline),
          asString(body.notes),
          asJsonbObject(body.metadata),
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "funding_app",
        entityId: result.rows[0].id,
        action: "created",
        summary: `${result.rows[0].scheme_label} — ${result.rows[0].project_name}`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("admin-room funding-apps create error", err);
      res.status(500).json({ error: "Kunne ikke opprette søknad" });
    }
  });

  app.patch("/api/admin-room/funding-apps/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id, session.userId];
    const push = (sqlExpr: string, value: unknown) => {
      params.push(value);
      sets.push(`${sqlExpr} = $${params.length}`);
    };
    if ("scheme" in body) push("scheme", asString(body.scheme));
    if ("schemeLabel" in body) push("scheme_label", asString(body.schemeLabel));
    if ("projectName" in body) push("project_name", asString(body.projectName));
    if ("applicantCompany" in body) push("applicant_company", asString(body.applicantCompany));
    if ("status" in body) push("status", asString(body.status, "draft"));
    if ("amountRequested" in body) push("amount_requested", asNumberOrNull(body.amountRequested));
    if ("currency" in body) push("currency", asString(body.currency, "NOK"));
    if ("description" in body) push("description", asString(body.description));
    if ("milestones" in body) sets.push(`milestones = '${asJsonbArray(body.milestones).replace(/'/g, "''")}'::jsonb`);
    if ("budgetBreakdown" in body) sets.push(`budget_breakdown = '${asJsonbArray(body.budgetBreakdown).replace(/'/g, "''")}'::jsonb`);
    if ("contactPerson" in body) push("contact_person", asString(body.contactPerson));
    if ("contactEmail" in body) push("contact_email", asString(body.contactEmail));
    if ("submissionDate" in body) push("submission_date", asString(body.submissionDate));
    if ("decisionDate" in body) push("decision_date", asString(body.decisionDate));
    if ("deadline" in body) push("deadline", asString(body.deadline));
    if ("notes" in body) push("notes", asString(body.notes));
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = now()");
    try {
      const result = await pool.query(
        `UPDATE admin_funding_apps SET ${sets.join(", ")}
          WHERE id = $1 AND user_id = $2 RETURNING *`,
        params,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Søknad ikke funnet" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("admin-room funding-apps patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere søknad" });
    }
  });

  app.delete("/api/admin-room/funding-apps/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_funding_apps WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Søknad ikke funnet" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("admin-room funding-apps delete error", err);
      res.status(500).json({ error: "Kunne ikke slette søknad" });
    }
  });
}
