/**
 * role-room-ads-recommendations.ts
 *
 * Lag 2: AI-anbefalinger om hvordan budsjett, kampanjer og creative bør
 * justeres basert på faktiske resultater. Kjøres daglig av cron etter
 * attribution-sweep + auto-pause-sweep; surface-es både til produsenten og
 * kunden (Økonomi-fanen) som et sett av human-readable forslag med rationale.
 *
 * Forskjellen fra Lag 3 (auto-pause): Lag 3 enforce-er HARDE regler kunden
 * har slått på (over taket → pause). Lag 2 tilbyr MYKE forslag som mennesker
 * vurderer ("Meta ROAS faller — vurder å flytte 5k fra LinkedIn"). Lag 2
 * gjør INGEN outward action; alt er informasjon. Det er bevisst slik — at
 * Claude foreslår å pause noen andres kampanje uten menneskelig review er
 * et brudd på prinsippet "ingen automatisert handling kunden ikke har valgt".
 *
 * Designet identisk med role-room-ad-creatives.ts: injiserbar LLM-klient
 * (__setAdRecommendationsLlmClient) så hele generate-pathen er unit-testet
 * uten SDK eller API-key.
 */

import { logAIUsage } from "./ai-usage-tracker.js";

// ── Context: tallene Claude leser ───────────────────────────────────────

export interface RecommendationChannelMetrics {
  platform: string; // 'meta' | 'google' | 'linkedin' | 'tiktok' | 'total'
  spendNok: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValueNok: number;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
  costPerConversionNok: number | null;
}

export interface RecommendationBudgetSnapshot {
  hasBudget: boolean;
  maxSpendNok: number;
  actualSpendNok: number;
  utilizationPct: number;
  // Fra pacing:
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyRunRateNok: number;
  projectedPeriodSpendNok: number;
  projectedOverspendNok: number;
  recommendedDailyBudgetNok: number;
  projectedExhaustionDate: string | null;
  pace: "no_budget" | "on_track" | "at_risk" | "over_pace" | "exhausted";
}

export interface RecommendationContext {
  businessName?: string | null;
  industry?: string | null;
  /** Marketing-plan-konteksten (verdiløfte, posisjonering) — gir Claude
   *  forretningsforståelse, ikke bare tall. */
  valueProp?: string | null;
  differentiator?: string | null;
  toneVoice?: string | null;
  period: string; // YYYY-MM
  channels: RecommendationChannelMetrics[]; // per-channel + totals
  budget?: RecommendationBudgetSnapshot | null;
  /** Forrige periodes channels — gir Claude trend-perspektiv. Valgfritt. */
  previousChannels?: RecommendationChannelMetrics[] | null;
  language?: "no" | "en";
}

// ── Output: hva Claude returnerer ───────────────────────────────────────

export type RecommendationType =
  | "reallocate_budget"
  | "pause_underperformer"
  | "scale_winner"
  | "refresh_creative"
  | "fix_tracking"
  | "investigate";

export type RecommendationSeverity = "info" | "warning" | "critical";

export interface AdRecommendation {
  /** Stabil-ish id (slug av tittel) så frontend kan track-e dismiss/acted-on
   *  uten å treffe samme reco to ganger. */
  id: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  /** Norsk én-linjes overskrift. */
  title: string;
  /** 1–3 setninger forklaring i klart språk. */
  body: string;
  /** Tallene anbefalingen bygger på (gjøres synlig så mennesker kan
   *  ettergå). */
  evidence: string[];
  /** Hvilke kanaler dette gjelder (for filtrering i UI). */
  affectsChannels?: string[];
  /** Konkret handling: "manual" = vurder/diskuter; ingen Lag 2-auto. */
  suggestedAction: { kind: "manual"; detail?: string };
  confidence: "low" | "medium" | "high";
}

export interface GeneratedAdRecommendationsUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  costNok: number | null;
}

export interface GeneratedAdRecommendations {
  period: string;
  recommendations: AdRecommendation[];
  /** Claude kan eksplisitt si "alt ser bra ut" — vi viser det da som info-state. */
  overallNote?: string | null;
  generatedWithModel: string;
  usage?: GeneratedAdRecommendationsUsage;
}

// ── Pricing (delt med marketing-plan/ad-creatives) ──────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-5";

function computeClaudeCostNok(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
): number | null {
  const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 },
    "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  };
  const p = PRICING[model];
  if (!p) return null;
  const usd =
    (inputTokens * p.input) / 1_000_000 +
    (outputTokens * p.output) / 1_000_000 +
    (cacheReadTokens * p.cacheRead) / 1_000_000 +
    (cacheCreationTokens * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 10.5 * 100) / 100;
}

// ── Prompt construction (pure, exported for testing) ──────────────────────

export function buildRecommendationsSystemPrompt(): string {
  return [
    "You are The Role Room ad performance analyst.",
    "Your job is to look at one client's ad results for the current period and",
    "suggest concrete, evidence-backed actions a producer + client can take.",
    "",
    "Output a JSON object — nothing else — matching this TypeScript type:",
    "```",
    "type Output = {",
    "  recommendations: Array<{",
    "    id: string;             // kebab-case slug of title, e.g. 'pause-linkedin-low-roas'",
    "    type: 'reallocate_budget' | 'pause_underperformer' | 'scale_winner'",
    "        | 'refresh_creative' | 'fix_tracking' | 'investigate';",
    "    severity: 'info' | 'warning' | 'critical';",
    "    title: string;          // 1 line, Norwegian (bokmål) by default",
    "    body: string;           // 1-3 sentences, plain language",
    "    evidence: string[];     // the data points your reco rests on, each one a",
    "                            // short factual line like 'LinkedIn ROAS 0.9 vs Meta 4.8'",
    "    affectsChannels?: string[]; // ['meta'] | ['linkedin','google'] etc.",
    "    suggestedAction: { kind: 'manual'; detail?: string };",
    "    confidence: 'low' | 'medium' | 'high';",
    "  }>;",
    "  overallNote?: string;     // optional 1-sentence summary of period",
    "};",
    "```",
    "",
    "Rules:",
    "- 0–6 recommendations. Fewer is better — only what is genuinely actionable.",
    "  If everything looks healthy, return an empty array and an overallNote.",
    "- Every recommendation MUST cite specific numbers in `evidence`. No vague",
    "  'engagement is low' — say 'CTR 0.4 % vs platform-benchmark 0.9 %'.",
    "- 'pause_underperformer' is the strongest reco — use ONLY when a channel has",
    "  meaningful spend (>=2 000 NOK over the period) AND clearly weak result",
    "  (ROAS<1 with conversions tracking working, OR cost-per-conversion >3× best",
    "  channel, OR CTR <half of platform benchmark with >5k impressions).",
    "- 'fix_tracking' applies when a channel has spend + clicks but 0 conversions —",
    "  pixel/tag likely missing.",
    "- 'reallocate_budget' should be concrete: name source channel + destination",
    "  channel + a rough amount based on the budget snapshot if available.",
    "- 'scale_winner' is for ROAS clearly above target with budget still available.",
    "- 'refresh_creative' uses week-over-week CTR decay (if previousChannels given).",
    "- severity: 'critical' for projected overspend or zero-conversion-with-spend;",
    "  'warning' for clear underperformers; 'info' for nudges.",
    "- NEVER recommend an action that could mislead clients in regulated industries:",
    "  no claims about clinical efficacy, no medical promises, no comparison to",
    "  competitors not in the data.",
    "",
    "If channels list is empty (no spend yet) → return empty recommendations + a",
    "neutral overallNote.",
    "",
    "Return ONLY the JSON object. No markdown, no prose, no backticks.",
  ].join("\n");
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 }).format(n);
}

export function buildRecommendationsUserMessage(ctx: RecommendationContext): string {
  const language = ctx.language ?? "no";
  const s: string[] = [];

  s.push("## Business");
  if (ctx.businessName) s.push(`Name: ${ctx.businessName}`);
  if (ctx.industry) s.push(`Industry: ${ctx.industry}`);
  if (ctx.valueProp) s.push(`Value proposition: ${ctx.valueProp}`);
  if (ctx.differentiator) s.push(`Differentiator: ${ctx.differentiator}`);
  if (ctx.toneVoice) s.push(`Voice: ${ctx.toneVoice}`);

  s.push(`\n## Period: ${ctx.period}`);

  if (ctx.budget) {
    const b = ctx.budget;
    s.push("\n## Budget pacing");
    if (b.hasBudget) {
      s.push(`Cap: ${fmt(b.maxSpendNok)} NOK. Spent so far: ${fmt(b.actualSpendNok)} (${fmt(b.utilizationPct)}%).`);
      s.push(`Days: ${b.daysElapsed} of ${b.daysInPeriod} elapsed (${b.daysRemaining} remaining).`);
      s.push(`Daily run-rate: ${fmt(b.dailyRunRateNok)} NOK. Projected period spend: ${fmt(b.projectedPeriodSpendNok)} NOK.`);
      if (b.projectedOverspendNok > 0) s.push(`Projected overspend: ${fmt(b.projectedOverspendNok)} NOK.`);
      if (b.projectedExhaustionDate) s.push(`Projected exhaustion: ${b.projectedExhaustionDate}.`);
      s.push(`Recommended daily budget to land on cap: ${fmt(b.recommendedDailyBudgetNok)} NOK.`);
      s.push(`Pace status: ${b.pace}.`);
    } else {
      s.push("No budget cap set for this period.");
    }
  }

  s.push("\n## Channels this period");
  if (ctx.channels.length === 0) {
    s.push("No spend recorded yet this period.");
  } else {
    s.push("| Channel | Spend | Impr | Clicks | CTR % | CPC | Conv | Conv.value | ROAS | Cost/Conv |");
    s.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const c of ctx.channels) {
      s.push(
        `| ${c.platform} | ${fmt(c.spendNok)} | ${fmt(c.impressions)} | ${fmt(c.clicks)} | ${fmt(c.ctr)} | ${fmt(c.cpc)} | ${fmt(c.conversions)} | ${fmt(c.conversionValueNok)} | ${fmt(c.roas)} | ${fmt(c.costPerConversionNok)} |`,
      );
    }
  }

  if (ctx.previousChannels && ctx.previousChannels.length > 0) {
    s.push("\n## Previous period (for trend)");
    s.push("| Channel | Spend | CTR % | CPC | ROAS |");
    s.push("|---|---|---|---|---|");
    for (const c of ctx.previousChannels) {
      s.push(`| ${c.platform} | ${fmt(c.spendNok)} | ${fmt(c.ctr)} | ${fmt(c.cpc)} | ${fmt(c.roas)} |`);
    }
  }

  s.push("\n## Output");
  s.push(
    language === "no"
      ? "Write the title/body/evidence/overallNote in Norwegian (bokmål). Keep the JSON keys + enum values in English."
      : "Write everything in English.",
  );
  s.push("Return the recommendations JSON now.");
  return s.join("\n");
}

// ── Parse + validate (pure, exported for testing) ─────────────────────────

const VALID_TYPES = new Set<RecommendationType>([
  "reallocate_budget",
  "pause_underperformer",
  "scale_winner",
  "refresh_creative",
  "fix_tracking",
  "investigate",
]);
const VALID_SEVERITY = new Set<RecommendationSeverity>(["info", "warning", "critical"]);

export function parseRecommendationsJson(text: string, period: string): Omit<GeneratedAdRecommendations, "generatedWithModel" | "usage"> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(firstBrace, end + 1));
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.recommendations)) return null;

  const recs: AdRecommendation[] = [];
  for (const r of parsed.recommendations) {
    if (!r || typeof r.title !== "string" || !r.title.trim()) continue;
    if (!VALID_TYPES.has(r.type)) continue;
    if (!VALID_SEVERITY.has(r.severity)) continue;
    recs.push({
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : slugify(r.title),
      type: r.type,
      severity: r.severity,
      title: String(r.title).trim(),
      body: typeof r.body === "string" ? r.body.trim() : "",
      evidence: Array.isArray(r.evidence) ? r.evidence.map((e: unknown) => String(e)).filter(Boolean) : [],
      affectsChannels: Array.isArray(r.affectsChannels) ? r.affectsChannels.map((c: unknown) => String(c)) : undefined,
      suggestedAction: { kind: "manual", detail: r.suggestedAction?.detail ? String(r.suggestedAction.detail) : undefined },
      confidence: r.confidence === "low" || r.confidence === "medium" || r.confidence === "high" ? r.confidence : "medium",
    });
  }

  return {
    period,
    recommendations: recs,
    overallNote: typeof parsed.overallNote === "string" ? parsed.overallNote : null,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Injectable LLM client ──────────────────────────────────────────────

export interface AdRecommendationsLlmClient {
  messages: { create: (args: unknown) => Promise<unknown> };
}

let injectedClient: AdRecommendationsLlmClient | null = null;

/** Test seam — inject a fake Anthropic client. Pass null to reset. */
export function __setAdRecommendationsLlmClient(client: AdRecommendationsLlmClient | null): void {
  injectedClient = client;
}

async function resolveLlmClient(): Promise<AdRecommendationsLlmClient | null> {
  if (injectedClient) return injectedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[ads-recommendations] ANTHROPIC_API_KEY missing — cannot generate");
    return null;
  }
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    return new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY }) as AdRecommendationsLlmClient;
  } catch (error) {
    console.error("[ads-recommendations] @anthropic-ai/sdk not available", error);
    return null;
  }
}

/**
 * Generer anbefalinger fra konteksten. Returnerer null hvis LLM ikke er
 * tilgjengelig eller responsen ikke parser. Tom anbefalingsliste er IKKE en
 * feil — det betyr "Claude fant ingenting å foreslå", som er gyldig output.
 */
export async function generateAdRecommendations(input: {
  context: RecommendationContext;
  model?: string;
}): Promise<GeneratedAdRecommendations | null> {
  const client = await resolveLlmClient();
  if (!client) return null;

  const model = input.model || process.env.ROLE_ROOM_AD_RECOMMENDATIONS_MODEL || DEFAULT_MODEL;
  const systemPrompt = buildRecommendationsSystemPrompt();
  const userMessage = buildRecommendationsUserMessage(input.context);

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
    logAIUsage(response, { feature: "role-room/ad-recommendations" }).catch(() => undefined);

    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const parsed = parseRecommendationsJson(text, input.context.period);
    if (!parsed) {
      console.error("[ads-recommendations] failed to parse Claude response", text.slice(0, 500));
      return null;
    }

    const u = response?.usage ?? {};
    const inputTokens = Number(u.input_tokens) || 0;
    const outputTokens = Number(u.output_tokens) || 0;
    const cacheReadInputTokens = Number(u.cache_read_input_tokens) || 0;
    const cacheCreationInputTokens = Number(u.cache_creation_input_tokens) || 0;

    return {
      ...parsed,
      generatedWithModel: model,
      usage: {
        inputTokens,
        outputTokens,
        cacheReadInputTokens: cacheReadInputTokens || undefined,
        cacheCreationInputTokens: cacheCreationInputTokens || undefined,
        costNok: computeClaudeCostNok(model, inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens),
      },
    };
  } catch (error) {
    console.error("[ads-recommendations] Claude request failed", error);
    return null;
  }
}
