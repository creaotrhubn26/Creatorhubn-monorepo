/**
 * admin-competitor-report-routes.ts
 *
 * Claude-generert dybde-rapport per konkurrent: SWOT + pricing-analyse
 * + posisjonering + anbefalte trekk. Brukes for å vise CompetitorReport-
 * panel på iPad LeadMap.
 *
 * Endpoint:
 *   GET /api/admin-room/lead-map/leads/:id/competitor-report
 *     (lead-id må peke på en konkurrent-rad i crm_customers/market_scan_competitors)
 *
 * Cacher rapporter i `competitor_reports`-tabellen (auto-opprettes hvis ikke
 * eksisterer) i 7 dager før re-generering.
 */

import type { AdminRoomRoutesDeps } from "./_shared";

interface CompetitorReportRow {
  competitor_id: string;
  report_md: string;
  swot_strengths: string[] | null;
  swot_weaknesses: string[] | null;
  swot_opportunities: string[] | null;
  swot_threats: string[] | null;
  recommended_actions: string[] | null;
  generated_at: string;
  model_used: string;
}

const REPORT_CACHE_DAYS = 7;

async function ensureTable(pool: AdminRoomRoutesDeps["pool"]): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitor_reports (
      competitor_id TEXT PRIMARY KEY,
      report_md TEXT NOT NULL,
      swot_strengths TEXT[],
      swot_weaknesses TEXT[],
      swot_opportunities TEXT[],
      swot_threats TEXT[],
      recommended_actions TEXT[],
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      model_used TEXT NOT NULL DEFAULT 'claude-opus-4-7'
    )
  `).catch(() => { /* best-effort */ });
}

async function generateClaudeReport(
  competitorName: string,
  competitorContext: Record<string, unknown>,
): Promise<{
  report_md: string;
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  recommendations: string[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback uten Claude — generer enkel rapport fra context.
    return {
      report_md: `# ${competitorName}\n\nClaude er ikke konfigurert (ANTHROPIC_API_KEY mangler). Kjør med ekte nøkkel for full SWOT-analyse.`,
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
      recommendations: ["Sett ANTHROPIC_API_KEY for å aktivere AI-rapport"],
    };
  }

  const prompt = `Du er en B2B-strategirådgiver. Analyser konkurrenten ${competitorName} basert på følgende data:

${JSON.stringify(competitorContext, null, 2)}

Returner JSON med følgende felter:
- report_md: Markdown-rapport (300-500 ord) med posisjonering, prising, kundebase
- swot: { strengths[], weaknesses[], opportunities[], threats[] } (4-6 punkter hver)
- recommendations: 3-5 konkrete trekk vi kan gjøre for å vinne deres kunder

Svar KUN med valid JSON.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`Claude API ${r.status}`);
    const data = await r.json() as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? "{}";
    const json = JSON.parse(text);
    return {
      report_md: json.report_md ?? "",
      swot: {
        strengths: json.swot?.strengths ?? [],
        weaknesses: json.swot?.weaknesses ?? [],
        opportunities: json.swot?.opportunities ?? [],
        threats: json.swot?.threats ?? [],
      },
      recommendations: json.recommendations ?? [],
    };
  } catch (err) {
    console.error("[competitor-report] Claude API error", err);
    return {
      report_md: `# ${competitorName}\n\nKunne ikke generere AI-rapport: ${String(err).slice(0, 200)}`,
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
      recommendations: [],
    };
  }
}

export function setupAdminCompetitorReportRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.get("/api/admin-room/lead-map/leads/:id/competitor-report", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const competitorId = req.params.id;
    await ensureTable(pool);

    try {
      // 1. Sjekk cache (< 7 dager gammel)
      const cached = await pool.query<CompetitorReportRow>(
        `SELECT competitor_id, report_md,
                swot_strengths, swot_weaknesses, swot_opportunities, swot_threats,
                recommended_actions, generated_at::text, model_used
           FROM competitor_reports
          WHERE competitor_id = $1
            AND generated_at > now() - INTERVAL '${REPORT_CACHE_DAYS} days'`,
        [competitorId],
      );

      if (cached.rows.length > 0) {
        const r = cached.rows[0];
        return res.json({
          competitorId: r.competitor_id,
          reportMd: r.report_md,
          swot: {
            strengths: r.swot_strengths ?? [],
            weaknesses: r.swot_weaknesses ?? [],
            opportunities: r.swot_opportunities ?? [],
            threats: r.swot_threats ?? [],
          },
          recommendations: r.recommended_actions ?? [],
          generatedAt: r.generated_at,
          modelUsed: r.model_used,
          cached: true,
        });
      }

      // 2. Hent context for Claude
      const ctx = await pool.query<{
        name: string;
        company: string | null;
        city: string | null;
        website_url: string | null;
        google_rating: number | null;
        estimated_value: number | null;
        notes: string | null;
      }>(
        `SELECT name, company, city, website_url, google_rating,
                estimated_value, notes
           FROM crm_customers WHERE id = $1`,
        [competitorId],
      );

      if (ctx.rows.length === 0) {
        return res.status(404).json({ error: "Konkurrent ikke funnet" });
      }
      const c = ctx.rows[0];

      // 3. Generer rapport
      const generated = await generateClaudeReport(c.name, {
        name: c.name, company: c.company, city: c.city,
        website: c.website_url, google_rating: c.google_rating,
        estimated_value: c.estimated_value, notes: c.notes,
      });

      // 4. Cache
      await pool.query(
        `INSERT INTO competitor_reports (
           competitor_id, report_md,
           swot_strengths, swot_weaknesses, swot_opportunities, swot_threats,
           recommended_actions
         ) VALUES ($1, $2, $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
         ON CONFLICT (competitor_id) DO UPDATE SET
           report_md = EXCLUDED.report_md,
           swot_strengths = EXCLUDED.swot_strengths,
           swot_weaknesses = EXCLUDED.swot_weaknesses,
           swot_opportunities = EXCLUDED.swot_opportunities,
           swot_threats = EXCLUDED.swot_threats,
           recommended_actions = EXCLUDED.recommended_actions,
           generated_at = now()`,
        [
          competitorId, generated.report_md,
          generated.swot.strengths, generated.swot.weaknesses,
          generated.swot.opportunities, generated.swot.threats,
          generated.recommendations,
        ],
      );

      return res.json({
        competitorId,
        reportMd: generated.report_md,
        swot: generated.swot,
        recommendations: generated.recommendations,
        generatedAt: new Date().toISOString(),
        modelUsed: "claude-opus-4-7",
        cached: false,
      });
    } catch (err) {
      console.error("[competitor-report] error", err);
      return res.status(500).json({ error: "Kunne ikke generere rapport" });
    }
  });
}
