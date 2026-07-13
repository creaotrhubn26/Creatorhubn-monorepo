/**
 * butler-chat.ts — JARVIS J2: samtalen (BETA)
 *
 * Chat-endepunkt der butleren har LES-verktøy mot plattformens egne
 * data: innsikter, Opportunity Score, anbud, lead-dossier, prospekter,
 * markedskrav og forbruk. Claude med tool-use; maks MAX_TOOL_ROUNDS
 * runder per melding.
 *
 * Redelighet:
 *  - KUN les-verktøy i J2 — ingen skriveoperasjoner (J3 kommer med
 *    eksplisitt bekreftelses-UI).
 *  - Verktøy-sporet returneres til UI-et: brukeren SER hvilke data
 *    butleren konsulterte. Ingen verktøykall = merket «uten oppslag».
 *  - System-prompten forbyr påstander uten verktøygrunnlag; historikk
 *    og verktøysvar er størrelses-begrenset; forbruk bokføres.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { getAiUsageSummary, recordAiUsage } from "./ai-usage.js";
import { computeGeoOpportunityScores } from "../market-intelligence/geo-opportunity-score.js";
import { buildDossierFacts } from "./outreach-composer.js";

const CHAT_MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY = 12;

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const BUTLER_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_insights",
    description: "Hent innsikter fra feeden (detektorfunn: GEO-endringer, anbud, risiko, triggere).",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["new", "all"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_opportunity_scores",
    description: "Hent GEO Opportunity Score-rangeringen (temaer scoret av faktormodellen).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_tenders",
    description: "Hent innsamlede anbud/tildelinger (tittel, frist, verdi, oppdragsgiver, krav, bud-status).",
    input_schema: {
      type: "object" as const,
      properties: { kind: { type: "string", enum: ["tender", "award"] } },
    },
  },
  {
    name: "get_lead_dossier",
    description: "Hent dossier for et CRM-selskap (BRREG, regnskap, IP, triggere). Søk på navn.",
    input_schema: {
      type: "object" as const,
      properties: { leadName: { type: "string" } },
      required: ["leadName"],
    },
  },
  {
    name: "get_prospects",
    description: "Hent prospektsegmentene (antall per segment; topp selskaper, valgfritt kommunefilter).",
    input_schema: {
      type: "object" as const,
      properties: { segment: { type: "string" }, municipality: { type: "string" } },
    },
  },
  {
    name: "get_market_requirements",
    description: "Hent «hva krever markedet»-aggregatet (krav-forekomster i anbud siste 180 dager).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_ai_usage",
    description: "Hent AI-forbruket (tokens/kall per leverandør og operasjon siste 30 dager).",
    input_schema: { type: "object" as const, properties: {} },
  },
];

export async function executeButlerTool(
  pool: Pool,
  organizationId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_insights": {
      const onlyNew = input.status !== "all";
      const limit = Math.min(Number(input.limit) || 15, 30);
      const r = await pool.query(
        `SELECT severity, detector, title, topic, detected_at::date::text AS date
           FROM insights WHERE organization_id = $1::uuid ${onlyNew ? "AND status = 'new'" : ""}
          ORDER BY detected_at DESC LIMIT ${limit}`,
        [organizationId],
      );
      return r.rows;
    }
    case "get_opportunity_scores": {
      const res = await computeGeoOpportunityScores(pool, organizationId);
      return {
        isDraft: res.isDraft,
        entries: res.entries.slice(0, 15).map((e) => ({
          topic: e.topic, set: e.setName, score: e.score, coverage: e.coverage,
        })),
      };
    }
    case "get_tenders": {
      const kind = input.kind === "award" ? "award" : "tender";
      const r = await pool.query(
        `SELECT title, raw->>'deadline' AS deadline, raw->>'buyerName' AS buyer,
                raw->>'valueNok' AS value_nok, raw->'requirements' AS requirements,
                raw->>'bidStatus' AS bid_status, raw->>'winnerName' AS winner,
                matched_topic, published_at::text
           FROM trigger_events
          WHERE organization_id = $1::uuid AND kind = $2
          ORDER BY created_at DESC LIMIT 20`,
        [organizationId, kind],
      );
      return r.rows;
    }
    case "get_lead_dossier": {
      const name = String(input.leadName ?? "").slice(0, 100);
      const lead = await pool.query<{
        id: string; name: string; pipeline_stage: string | null;
        deal_amount: string | null; enrichment_data: Record<string, unknown> | null;
      }>(
        `SELECT id::text, name, pipeline_stage, deal_amount::text, enrichment_data
           FROM crm_customers
          WHERE organization_id = $1::uuid AND archived_at IS NULL AND name ILIKE $2
          ORDER BY updated_at DESC LIMIT 1`,
        [organizationId, `%${name}%`],
      );
      if (lead.rows.length === 0) return { found: false, note: "ingen CRM-treff på navnet" };
      const triggers = await pool.query<{ kind: string; title: string; published_at: string | null }>(
        `SELECT kind, title, published_at::text FROM trigger_events
          WHERE organization_id = $1::uuid AND matched_topic = $2
          ORDER BY created_at DESC LIMIT 3`,
        [organizationId, lead.rows[0].name],
      );
      return { found: true, facts: buildDossierFacts(lead.rows[0], triggers.rows) };
    }
    case "get_prospects": {
      const segments = await pool.query(
        `SELECT segment_key, display_name, total_found, truncated FROM prospect_segments ORDER BY 1`,
      );
      if (typeof input.segment !== "string") return { segments: segments.rows };
      const params: unknown[] = [input.segment];
      let where = "segment_key = $1";
      if (typeof input.municipality === "string" && input.municipality.trim()) {
        params.push(`%${input.municipality.trim()}%`);
        where += ` AND municipality ILIKE $${params.length}`;
      }
      const companies = await pool.query(
        `SELECT name, municipality, employees FROM prospect_companies
          WHERE ${where} ORDER BY employees DESC NULLS LAST LIMIT 15`,
        params,
      );
      return { segments: segments.rows, companies: companies.rows };
    }
    case "get_market_requirements": {
      const r = await pool.query(
        `SELECT matched_topic, req.requirement, COUNT(*)::int AS hits
           FROM trigger_events t,
                jsonb_array_elements_text(COALESCE(t.raw->'requirements','[]'::jsonb)) req(requirement)
          WHERE t.organization_id = $1::uuid AND t.kind = 'tender'
            AND t.created_at > now() - interval '180 days'
          GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 25`,
        [organizationId],
      );
      return r.rows;
    }
    case "get_ai_usage":
      return await getAiUsageSummary(pool, organizationId, 30);
    default:
      return { error: `ukjent verktøy: ${name}` };
  }
}

const CHAT_SYSTEM = `Du er butleren i Creatorhubns markedsintelligens-plattform — rolig, presis, norsk. BETA.

ABSOLUTTE REGLER:
- Påstander om brukerens data skal bygge på VERKTØYENE. Har du ikke slått opp, si det og slå opp.
- Finner verktøyene ingenting: si det ærlig. Aldri fyll hull med antakelser.
- Skill syntetiske målinger (GEO-probing) fra ekte data (GA4/regnskap/register) når det er relevant.
- Du kan IKKE utføre handlinger (endre, sende, slette) — si at handlinger kommer i neste versjon og pek til riktig panel.
- Svar kort og konkret. Avslutt gjerne med ett forslag til neste spørsmål.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  reply: string;
  toolTrace: Array<{ tool: string; input: Record<string, unknown> }>;
}

export async function butlerChat(
  pool: Pool,
  organizationId: string,
  history: ChatMessage[],
): Promise<{ result: ChatResult } | { error: string; status: number }> {
  const anthropic = getAnthropic();
  if (!anthropic) return { error: "anthropic_ikke_konfigurert", status: 503 };

  const trimmed = history.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: String(m.content).slice(0, 4000),
  }));
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user") {
    return { error: "siste_melding_maa_vaere_bruker", status: 400 };
  }

  const messages: Anthropic.MessageParam[] = [...trimmed];
  const toolTrace: ChatResult["toolTrace"] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1000,
      system: CHAT_SYSTEM,
      tools: BUTLER_TOOLS,
      messages,
    });
    totalIn += response.usage?.input_tokens ?? 0;
    totalOut += response.usage?.output_tokens ?? 0;

    const toolUses = response.content.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    if (toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
      const reply = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
      await recordAiUsage(pool, {
        organizationId, provider: "anthropic", operation: "butler-chat",
        calls: round + 1, inputTokens: totalIn, outputTokens: totalOut,
      });
      return { result: { reply: reply || "(tomt svar)", toolTrace } };
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      toolTrace.push({ tool: tu.name, input });
      let output: unknown;
      try {
        output = await executeButlerTool(pool, organizationId, tu.name, input);
      } catch (err) {
        output = { error: String(err).slice(0, 150) };
      }
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(output).slice(0, 6000),
      });
    }
    messages.push({ role: "user", content: results });
  }
  return { error: "chat_loop_avsluttet_uventet", status: 500 };
}
