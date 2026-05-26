/**
 * admin-room-ai-citation-routes.ts
 *
 * AI-citation-tracker: måler om GEO-strategien (14 pillar-sider med
 * Article-schema, FAQPage, DefinedTermSet, Speakable) faktisk fører til
 * at AI-modeller siterer The Role Room.
 *
 * Sjekker hver registrert query mot Claude og GPT-4 (Perplexity kan
 * legges til senere). Lagrer raw response + om "The Role Room" er nevnt
 * + om theroleroom.com-URL siteres + om konkurrenter nevnes i stedet.
 *
 * Endpoints:
 *   GET    /api/admin-room/ai-citation/queries           — list aktive queries
 *   POST   /api/admin-room/ai-citation/queries           — opprett egen query
 *   PATCH  /api/admin-room/ai-citation/queries/:id       — toggle active / oppdater
 *   GET    /api/admin-room/ai-citation/results           — siste 90 dager resultater
 *   GET    /api/admin-room/ai-citation/dashboard         — aggregat: mention-rate per provider/uke
 *   POST   /api/admin-room/ai-citation/run               — trigger sjekk manuelt (alle aktive queries)
 *
 * In-process cron: sjekker alle aktive queries hver mandag 03:00.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

const CLAUDE_MODEL = "claude-opus-4-7";
const OPENAI_MODEL = "gpt-4o";

interface ProviderResult {
  provider: string;
  model: string;
  responseText: string;
  mentioned: boolean;
  mentionPosition: number | null;
  urlCited: boolean;
  competitorMentions: string[];
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  errorMessage: string | null;
}

let cachedAnthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (cachedAnthropic) return cachedAnthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY er ikke satt");
  cachedAnthropic = new Anthropic({ apiKey });
  return cachedAnthropic;
}

function analyzeResponse(
  responseText: string,
  expectedMention: string,
  expectedUrlFragment: string,
  competitorTerms: string[],
): {
  mentioned: boolean;
  mentionPosition: number | null;
  urlCited: boolean;
  competitorMentions: string[];
} {
  const lower = responseText.toLowerCase();
  const mentionLower = expectedMention.toLowerCase();
  const position = lower.indexOf(mentionLower);
  const mentioned = position !== -1;
  const urlCited = expectedUrlFragment
    ? lower.includes(expectedUrlFragment.toLowerCase())
    : false;
  const competitorMentions = competitorTerms.filter((c) =>
    lower.includes(c.toLowerCase()),
  );
  return {
    mentioned,
    mentionPosition: mentioned ? position : null,
    urlCited,
    competitorMentions,
  };
}

async function queryClaude(queryText: string): Promise<{
  responseText: string;
  tokensInput: number | null;
  tokensOutput: number | null;
}> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: queryText }],
  });
  const block = response.content[0];
  const responseText = block?.type === "text" ? block.text : "";
  return {
    responseText,
    tokensInput: response.usage?.input_tokens ?? null,
    tokensOutput: response.usage?.output_tokens ?? null,
  };
}

async function queryOpenAi(queryText: string): Promise<{
  responseText: string;
  tokensInput: number | null;
  tokensOutput: number | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke satt");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: queryText }],
      max_tokens: 1500,
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    responseText: data.choices?.[0]?.message?.content ?? "",
    tokensInput: data.usage?.prompt_tokens ?? null,
    tokensOutput: data.usage?.completion_tokens ?? null,
  };
}

const PROVIDERS = [
  { name: "anthropic_claude", model: CLAUDE_MODEL, fn: queryClaude },
  { name: "openai_gpt4", model: OPENAI_MODEL, fn: queryOpenAi },
];

async function runQueryAcrossProviders(
  queryText: string,
  expectedMention: string,
  expectedUrlFragment: string,
  competitorTerms: string[],
): Promise<ProviderResult[]> {
  const results: ProviderResult[] = [];
  for (const provider of PROVIDERS) {
    try {
      const r = await provider.fn(queryText);
      const analysis = analyzeResponse(
        r.responseText,
        expectedMention,
        expectedUrlFragment,
        competitorTerms,
      );
      results.push({
        provider: provider.name,
        model: provider.model,
        responseText: r.responseText,
        ...analysis,
        tokensInput: r.tokensInput,
        tokensOutput: r.tokensOutput,
        costUsd: null,
        errorMessage: null,
      });
    } catch (err) {
      results.push({
        provider: provider.name,
        model: provider.model,
        responseText: "",
        mentioned: false,
        mentionPosition: null,
        urlCited: false,
        competitorMentions: [],
        tokensInput: null,
        tokensOutput: null,
        costUsd: null,
        errorMessage: (err as Error).message,
      });
    }
  }
  return results;
}

export function setupAdminAiCitationRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // ── List queries ──────────────────────────────────────────────
  app.get("/api/admin-room/ai-citation/queries", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM role_room_ai_citation_queries
          WHERE user_id IS NULL OR user_id = $1
          ORDER BY category ASC, query_text ASC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[ai-citation queries] list error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Create egen query ─────────────────────────────────────────
  app.post("/api/admin-room/ai-citation/queries", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const queryText = asString(body.queryText);
    const category = asString(body.category) ?? "casting";
    const language = asString(body.language) ?? "no";
    const competitorTerms = Array.isArray(body.competitorTerms) ? body.competitorTerms : [];
    if (!queryText) {
      res.status(400).json({ error: "queryText er påkrevd" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO role_room_ai_citation_queries
          (user_id, query_text, language, category, competitor_terms, active)
         VALUES ($1, $2, $3, $4, $5::jsonb, TRUE)
         RETURNING *`,
        [session.userId, queryText, language, category, JSON.stringify(competitorTerms)],
      );
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[ai-citation queries] create error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Toggle active ─────────────────────────────────────────────
  app.patch("/api/admin-room/ai-citation/queries/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const { id } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.active !== "boolean") {
      res.status(400).json({ error: "active (boolean) er påkrevd" });
      return;
    }
    try {
      // Defaults (user_id NULL) kan toggles av admin også
      const result = await pool.query(
        `UPDATE role_room_ai_citation_queries
            SET active = $1
          WHERE id = $2 AND (user_id IS NULL OR user_id = $3)
          RETURNING *`,
        [body.active, id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Query ikke funnet" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("[ai-citation queries] patch error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Hent resultater ───────────────────────────────────────────
  app.get("/api/admin-room/ai-citation/results", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const queryIdFilter = asString(req.query.queryId);
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    try {
      const params: unknown[] = [session.userId, limit];
      const where = ["(q.user_id IS NULL OR q.user_id = $1)"];
      if (queryIdFilter) {
        params.push(queryIdFilter);
        where.push(`r.query_id = $${params.length}`);
      }
      const result = await pool.query(
        `SELECT r.id, r.query_id, r.provider, r.model, r.mentioned, r.mention_position,
                r.url_cited, r.competitor_mentions, r.tokens_input, r.tokens_output,
                r.cost_usd, r.checked_at, r.error_message,
                LEFT(r.response_text, 500) AS response_preview,
                q.query_text, q.category
           FROM role_room_ai_citation_results r
           JOIN role_room_ai_citation_queries q ON q.id = r.query_id
          WHERE ${where.join(" AND ")}
          ORDER BY r.checked_at DESC
          LIMIT $2`,
        params,
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[ai-citation results] list error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Dashboard-aggregat ────────────────────────────────────────
  app.get("/api/admin-room/ai-citation/dashboard", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const overall = await pool.query(
        `SELECT
            COUNT(*)::int AS total_checks,
            COUNT(*) FILTER (WHERE r.mentioned)::int AS mentions,
            COUNT(*) FILTER (WHERE r.url_cited)::int AS url_citations,
            COUNT(DISTINCT r.query_id)::int AS queries_checked,
            COUNT(DISTINCT r.provider)::int AS providers_checked,
            MAX(r.checked_at) AS last_check_at
          FROM role_room_ai_citation_results r
          JOIN role_room_ai_citation_queries q ON q.id = r.query_id
         WHERE (q.user_id IS NULL OR q.user_id = $1)
           AND r.error_message IS NULL`,
        [session.userId],
      );

      const perProvider = await pool.query(
        `SELECT r.provider, r.model,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE r.mentioned)::int AS mentions,
                COUNT(*) FILTER (WHERE r.url_cited)::int AS url_citations
           FROM role_room_ai_citation_results r
           JOIN role_room_ai_citation_queries q ON q.id = r.query_id
          WHERE (q.user_id IS NULL OR q.user_id = $1)
            AND r.error_message IS NULL
          GROUP BY r.provider, r.model
          ORDER BY r.provider`,
        [session.userId],
      );

      const perQuery = await pool.query(
        `SELECT q.id, q.query_text, q.category,
                COUNT(r.id)::int AS total_checks,
                COUNT(r.id) FILTER (WHERE r.mentioned)::int AS mentions,
                MAX(r.checked_at) AS last_check_at
           FROM role_room_ai_citation_queries q
           LEFT JOIN role_room_ai_citation_results r
                  ON r.query_id = q.id AND r.error_message IS NULL
          WHERE (q.user_id IS NULL OR q.user_id = $1)
            AND q.active = TRUE
          GROUP BY q.id, q.query_text, q.category
          ORDER BY mentions DESC, q.category ASC`,
        [session.userId],
      );

      // Timeseries: mentions per uke, siste 12 uker
      const timeseries = await pool.query(
        `SELECT
            date_trunc('week', r.checked_at) AS week_start,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE r.mentioned)::int AS mentions
           FROM role_room_ai_citation_results r
           JOIN role_room_ai_citation_queries q ON q.id = r.query_id
          WHERE (q.user_id IS NULL OR q.user_id = $1)
            AND r.error_message IS NULL
            AND r.checked_at > NOW() - INTERVAL '12 weeks'
          GROUP BY date_trunc('week', r.checked_at)
          ORDER BY week_start ASC`,
        [session.userId],
      );

      res.json({
        overall: overall.rows[0] ?? {},
        perProvider: perProvider.rows,
        perQuery: perQuery.rows,
        timeseries: timeseries.rows,
      });
    } catch (err) {
      console.error("[ai-citation dashboard] error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Trigger sjekk manuelt ─────────────────────────────────────
  app.post("/api/admin-room/ai-citation/run", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const queries = await pool.query(
        `SELECT id, query_text, expected_mention, expected_url_fragment, competitor_terms
           FROM role_room_ai_citation_queries
          WHERE active = TRUE AND (user_id IS NULL OR user_id = $1)
          ORDER BY category ASC`,
        [session.userId],
      );

      let totalChecks = 0;
      let totalMentions = 0;
      const errors: string[] = [];

      for (const q of queries.rows) {
        const competitorTerms = Array.isArray(q.competitor_terms) ? q.competitor_terms : [];
        const results = await runQueryAcrossProviders(
          q.query_text,
          q.expected_mention,
          q.expected_url_fragment ?? "theroleroom.com",
          competitorTerms,
        );
        for (const r of results) {
          totalChecks += 1;
          if (r.mentioned) totalMentions += 1;
          if (r.errorMessage) errors.push(`${q.query_text.slice(0, 40)}… [${r.provider}]: ${r.errorMessage}`);
          await pool.query(
            `INSERT INTO role_room_ai_citation_results
              (query_id, provider, model, response_text, mentioned, mention_position,
               url_cited, competitor_mentions, tokens_input, tokens_output, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
            [
              q.id,
              r.provider,
              r.model,
              r.responseText,
              r.mentioned,
              r.mentionPosition,
              r.urlCited,
              JSON.stringify(r.competitorMentions),
              r.tokensInput,
              r.tokensOutput,
              r.errorMessage,
            ],
          );
        }
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "ai_citation_run",
        action: "completed",
        summary: `${totalMentions}/${totalChecks} mentions across ${queries.rowCount} queries`,
        details: { totalChecks, totalMentions, errorCount: errors.length },
      });

      res.json({
        ok: true,
        queriesChecked: queries.rowCount,
        totalChecks,
        totalMentions,
        mentionRate: totalChecks > 0 ? totalMentions / totalChecks : 0,
        errors: errors.slice(0, 10),
      });
    } catch (err) {
      console.error("[ai-citation run] error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── In-process cron: ukentlig mandag 03:00 ─────────────────────
  // Beste-effort. Hvis flere instanser kjører kan flere runs starte
  // samtidig — mention-rate-en blir bare litt høyere oppløst.
  let lastRunWeek: number | null = null;
  function maybeRunWeekly(): void {
    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    const isEarlyMorning = now.getUTCHours() === 2; // 03:00 CET / 02:00 UTC
    if (!isMonday || !isEarlyMorning) return;
    const weekNumber = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
    if (lastRunWeek === weekNumber) return;
    lastRunWeek = weekNumber;

    void (async () => {
      try {
        const queries = await pool.query(
          `SELECT id, query_text, expected_mention, expected_url_fragment, competitor_terms
             FROM role_room_ai_citation_queries
            WHERE active = TRUE
            ORDER BY id`,
        );
        for (const q of queries.rows) {
          const competitorTerms = Array.isArray(q.competitor_terms) ? q.competitor_terms : [];
          const results = await runQueryAcrossProviders(
            q.query_text,
            q.expected_mention,
            q.expected_url_fragment ?? "theroleroom.com",
            competitorTerms,
          );
          for (const r of results) {
            await pool.query(
              `INSERT INTO role_room_ai_citation_results
                (query_id, provider, model, response_text, mentioned, mention_position,
                 url_cited, competitor_mentions, tokens_input, tokens_output, error_message)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
              [
                q.id, r.provider, r.model, r.responseText, r.mentioned,
                r.mentionPosition, r.urlCited, JSON.stringify(r.competitorMentions),
                r.tokensInput, r.tokensOutput, r.errorMessage,
              ],
            );
          }
        }
        console.log(`[ai-citation cron] processed ${queries.rowCount} queries`);
      } catch (err) {
        console.error("[ai-citation cron] error", err);
      }
    })();
  }
  setInterval(maybeRunWeekly, 60 * 60 * 1000); // sjekk hver time
}
