/**
 * admin-room-business-plan-routes.ts
 *
 * Setup-funksjon for /api/admin-room/business-plan endpoints.
 * 3 endpoints: GET (les), POST /generate (AI-utkast for ett felt via
 * Claude), PATCH (UPSERT — første kall oppretter rad hvis ikke finnes).
 *
 * Tabellen `admin_business_plan` har én rad per user_id med 35 tekst-felt
 * for forretningsplan i BI/BBI-stil (intro, internal, external, swot,
 * strategic, safe). Felt-listen `BUSINESS_PLAN_TEXT_FIELDS` styrer hvilke
 * kolonner PATCH godtar.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminBusinessPlanRoutes } from "./admin-room-business-plan-routes";
 *
 *   setupAdminBusinessPlanRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Mode-noter: AI-system-prompten nevner "produksjonsteam og innholds-
 * produsenter" som kontekst, men det er statisk tekst — ingen kode-
 * brancing på Role Room-modes. Admin Room-funksjonalitet låst til
 * produkteier (orthogonalt til alle 4 modes).
 */

import type { AdminRoomRoutesDeps } from "./_shared";

const BUSINESS_PLAN_TEXT_FIELDS = [
  "exec_summary",
  "intro_overview",
  "intro_vision",
  "intro_sustainability",
  "intro_industry",
  "intro_financials",
  "internal_value_network_primary",
  "internal_value_network_support",
  "internal_drivers_customer",
  "internal_drivers_capacity",
  "internal_drivers_learning",
  "internal_resource_analysis",
  "internal_operational",
  "internal_dynamic",
  "internal_vrio",
  "internal_network_structure",
  "internal_strengths_weaknesses",
  "external_pestel",
  "external_pestel_conclusion",
  "external_porter",
  "external_porter_conclusion",
  "external_competitors",
  "external_competitor_summary",
  "external_stakeholders",
  "external_stakeholder_conclusion",
  "swot_strengths",
  "swot_weaknesses",
  "swot_opportunities",
  "swot_threats",
  "strategic_wheel",
  "current_strategy",
  "strategic_recommendation",
  "safe_suitability",
  "safe_acceptability",
  "safe_feasibility",
] as const;

const TEXT_FIELD_TO_BODY_KEY: Record<string, string> = {};
for (const field of BUSINESS_PLAN_TEXT_FIELDS) {
  // snake_case → camelCase
  TEXT_FIELD_TO_BODY_KEY[field] = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function setupAdminBusinessPlanRoutes(deps: AdminRoomRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminRoomAccess,
  } = deps;

  app.get("/api/admin-room/business-plan", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM admin_business_plan WHERE user_id = $1`,
        [session.userId],
      );
      res.json({ plan: result.rows[0] ?? null });
    } catch (err) {
      console.error("admin-room business-plan get error", err);
      res.status(500).json({ error: "Kunne ikke hente forretningsplan" });
    }
  });

  // AI-utkast for hvert felt i forretningsplan via Claude
  app.post("/api/admin-room/business-plan/generate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const fieldKey = typeof body.fieldKey === "string" ? body.fieldKey : "";
    const fieldLabel = typeof body.fieldLabel === "string" ? body.fieldLabel : "";
    const existingContent = typeof body.existingContent === "string" ? body.existingContent : "";
    if (!fieldKey || !fieldLabel) {
      res.status(400).json({ error: "fieldKey og fieldLabel er påkrevd" });
      return;
    }
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        res.status(503).json({ error: "ANTHROPIC_API_KEY er ikke satt" });
        return;
      }

      // Hent eksisterende plan-data som kontekst — Claude kan referere til
      // andre seksjoner for å lage konsistent tekst på tvers.
      const planResult = await pool.query(
        `SELECT * FROM admin_business_plan WHERE user_id = $1`,
        [session.userId],
      );
      const plan = planResult.rows[0] ?? {};

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });

      const systemPrompt = `Du er en norsk strategirådgiver som skriver forretningsplaner i BI/BBI-stil.

Skrivestil:
- Norsk, formell forretnings-stil
- Konkret og datadrevet, ikke hype
- 200-400 ord for vanlige seksjoner, 600+ for analyser (PESTEL, Porter, VRIO, SWOT)
- Bruk Markdown-bullets der det gir mening
- Ingen anførselstegn rundt outputen
- Ingen forspil — returner kun innholdet selv

Selskapet er The Role Room — en helhetlig produksjonsplattform for det norske
film- og innholdsmarkedet. Stable produktfunksjonalitet: casting (roller,
kandidater, kanban), crew & lokasjoner, storyboard og shotlists, budsjett-
styring (kategori-grupper, Avvik, Cashflow, Rapporter), avtaler (NDA,
samarbeidsavtaler, signering via Google), TROLL-demo for fremvisning.
Multi-vertikal: produksjonsteam og innholdsprodusenter. Pilotkunde:
Holy Crust (Oslo).`;

      const planSummary = Object.entries(plan)
        .filter(([key, value]) => (
          typeof value === "string" && value.trim().length > 0
          && key !== fieldKey
          && !["id", "user_id", "metadata", "created_at", "updated_at"].includes(key)
        ))
        .slice(0, 10)
        .map(([key, value]) => `${key}: ${(value as string).slice(0, 200)}`)
        .join("\n");

      const userPrompt = [
        `Skriv innhold for seksjonen "${fieldLabel}" i en forretningsplan for The Role Room.`,
        existingContent ? `\nEksisterende utkast (utvid eller forbedre):\n${existingContent}` : null,
        planSummary ? `\nKontekst fra andre seksjoner:\n${planSummary}` : null,
      ].filter(Boolean).join("\n");

      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      type ContentBlock = { type: string; text?: string };
      const generatedText = (response.content as ContentBlock[])
        .filter((b): b is { type: 'text'; text: string } => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();

      res.json({
        text: generatedText,
        tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      });
    } catch (err) {
      console.error("admin-room business-plan generate error", err);
      res.status(500).json({
        error: "Kunne ikke generere via Claude",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  app.patch("/api/admin-room/business-plan", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [session.userId];
    for (const field of BUSINESS_PLAN_TEXT_FIELDS) {
      const bodyKey = TEXT_FIELD_TO_BODY_KEY[field];
      if (bodyKey in body) {
        const value = typeof body[bodyKey] === "string" ? (body[bodyKey] as string) : null;
        params.push(value);
        sets.push(`${field} = $${params.length}`);
      }
    }
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = now()");
    try {
      // UPSERT så første PATCH oppretter rad hvis ikke finnes
      const upsertResult = await pool.query(
        `INSERT INTO admin_business_plan (user_id) VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
        [session.userId],
      );
      void upsertResult;
      const result = await pool.query(
        `UPDATE admin_business_plan SET ${sets.join(", ")} WHERE user_id = $1 RETURNING *`,
        params,
      );
      res.json({ plan: result.rows[0] });
    } catch (err) {
      console.error("admin-room business-plan patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere forretningsplan" });
    }
  });
}
