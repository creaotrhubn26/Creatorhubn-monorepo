/**
 * Marketing Plan Engine — strategy + pillar generation for The Role Room.
 *
 * Takes the producer-bootstrap output (company profile, story logic,
 * competitor analysis) and produces a content-pillar-led marketing
 * strategy the feed-planner can then slot 30 days of posts into.
 *
 * Gating: generation is blocked until the bootstrap has enough signal.
 * The gate exists in `checkMarketingPlanReadiness` so both the UI and
 * the route can surface the same missing-fields list before we spend
 * Claude tokens on a shallow plan.
 */

import type { Pool } from 'pg';
import { logAIUsage } from './ai-usage-tracker.js';

// ── Readiness gate ──────────────────────────────────────────────────────

export interface MarketingPlanBootstrapInput {
  companyProfile?: {
    companyName?: string | null;
    industry?: string | null;
    subIndustry?: string | null;
    businessModel?: string | null;
    targetAudience?: string[] | null;
    toneAndBrandSignals?: string[] | null;
    offerings?: string[] | null;
    contentCategory?: string | null;
  } | null;
  storyLogicDraft?: {
    classification?: Record<string, unknown> | null;
    concept?: { corePremise?: string | null } | null;
    contentStoryLogic?: {
      businessObjective?: string | null;
      audienceProblem?: string | null;
      keyPromise?: string | null;
      desiredAction?: string | null;
      visualFocus?: string | null;
    } | null;
  } | null;
  competitorAnalysis?: {
    marketContext?: string | null;
    marketingOpportunities?: string[] | null;
    positioningRecommendations?: string[] | null;
  } | null;
  localPresencePlan?: {
    industryContext?: string | null;
    marketArea?: string | null;
  } | null;
  intakeDraft?: {
    keyMessage?: string | null;
    projectGoal?: string | null;
    targetAudience?: string | null;
  } | null;
}

export interface MarketingPlanReadiness {
  ready: boolean;
  missingFields: string[];
  /** Gating is relaxed when an IG connection exists — without one,
   *  cross-post strategy is moot, so we also require an acknowledgement
   *  from the producer ("I'll plan without a channel"). */
  hasInstagramConnection: boolean;
}

export function checkMarketingPlanReadiness(
  bootstrap: MarketingPlanBootstrapInput,
  hasInstagramConnection: boolean,
): MarketingPlanReadiness {
  const missing: string[] = [];
  const profile = bootstrap.companyProfile ?? {};
  if (!profile.companyName?.trim()) missing.push('companyProfile.companyName');
  if (!profile.industry?.trim()) missing.push('companyProfile.industry');
  if (!profile.targetAudience || profile.targetAudience.length === 0) {
    missing.push('companyProfile.targetAudience');
  }
  if (!profile.toneAndBrandSignals || profile.toneAndBrandSignals.length < 3) {
    missing.push('companyProfile.toneAndBrandSignals (minst 3)');
  }
  const csl = bootstrap.storyLogicDraft?.contentStoryLogic ?? {};
  if (!csl.businessObjective?.trim()) missing.push('storyLogicDraft.contentStoryLogic.businessObjective');
  if (!csl.audienceProblem?.trim()) missing.push('storyLogicDraft.contentStoryLogic.audienceProblem');
  if (!csl.keyPromise?.trim()) missing.push('storyLogicDraft.contentStoryLogic.keyPromise');

  return {
    ready: missing.length === 0,
    missingFields: missing,
    hasInstagramConnection,
  };
}

// ── Plan shape ──────────────────────────────────────────────────────────

export interface MarketingPlanStrategy {
  channelStrategy: {
    primary: string;            // 'instagram' etc.
    cadencePerWeek: number;     // total posts/week across channels
    secondary: string[];        // e.g. ['tiktok', 'linkedin']
    reasoning: string;
  };
  toneOfVoice: {
    voice: string;              // one-sentence voice description
    dos: string[];
    donts: string[];
  };
  positioning: {
    valueProp: string;
    differentiator: string;
  };
  kpiTargets: Array<{
    metric: string;             // 'reach', 'saves', 'engagement_rate', 'followers_gained'
    target: number;
    per: 'post' | 'week' | 'month' | 'quarter';
    rationale: string;
  }>;
}

export interface MarketingPlanPillar {
  name: string;
  description: string;
  rationale: string;
  targetKpi?: {
    metric: string;
    target: number;
    per: 'post' | 'week' | 'month' | 'quarter';
  };
}

export interface GeneratedMarketingPlanUsage {
  inputTokens: number;
  outputTokens: number;
  /** Cache-read tokens — koster 10× mindre enn vanlig input. Returnert
   *  av Anthropic når system-prompten treffer ephemeral cache. */
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  /** Beregnet NOK-kostnad basert på modell-pricing. Null hvis ukjent. */
  costNok: number | null;
}

export interface GeneratedMarketingPlan {
  strategy: MarketingPlanStrategy;
  pillars: MarketingPlanPillar[];
  generatedWithModel: string;
  usage?: GeneratedMarketingPlanUsage;
}

/** Anthropic Sonnet 4.5 pricing (per 1M tokens, USD). NOK-rate hardkodet
 *  ~10.5 — refresh hvis FX-svingninger blir relevante. Cache-reads er
 *  $0.30/1M (10% av input-pris). */
function computeClaudeCostNok(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
): number | null {
  const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-haiku-4-5-20251001": { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1.00 },
    "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
  };
  const p = PRICING[model];
  if (!p) return null;
  const usd =
    (inputTokens * p.input) / 1_000_000
    + (outputTokens * p.output) / 1_000_000
    + (cacheReadTokens * p.cacheRead) / 1_000_000
    + (cacheCreationTokens * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 10.5 * 100) / 100;
}

// ── Claude generation ───────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const HORIZON_DAYS_DEFAULT = 30;

function buildSystemPrompt(): string {
  return [
    'You are The Role Room marketing strategist.',
    'Your job is to turn a producer\'s company-profile + story logic into a concrete',
    'content marketing plan the photographer can execute against.',
    '',
    'Output a JSON object — nothing else — matching exactly this TypeScript type:',
    '```',
    'type Plan = {',
    '  strategy: {',
    '    channelStrategy: { primary: string; cadencePerWeek: number; secondary: string[]; reasoning: string };',
    '    toneOfVoice: { voice: string; dos: string[]; donts: string[] };',
    '    positioning: { valueProp: string; differentiator: string };',
    '    kpiTargets: Array<{ metric: string; target: number; per: "post"|"week"|"month"|"quarter"; rationale: string }>;',
    '  };',
    '  pillars: Array<{',
    '    name: string;',
    '    description: string;',
    '    rationale: string;',
    '    targetKpi?: { metric: string; target: number; per: "post"|"week"|"month"|"quarter" };',
    '  }>; // 3-5 content pillars',
    '};',
    '```',
    '',
    'Rules:',
    '- 3-5 pillars. Fewer = too generic; more = unfocused.',
    '- Each pillar should be a theme the business CAN actually produce content about,',
    '  given their offerings + tone-and-brand signals.',
    '- Every pillar has a distinct angle — no overlap.',
    '- KPI numbers are realistic for a Norwegian SMB audience: followers_gained per',
    '  month 50-500 is normal; engagement_rate per post 2-6% is normal; reach per',
    '  month 5k-50k is normal for an active feed.',
    '- toneOfVoice.dos + donts are concrete — "Bruk fornavn" not "Be friendly".',
    '- positioning.differentiator must explicitly contrast against something (a',
    '  competitor category, a common-practice approach) — it\'s not a differentiator',
    '  if everyone could say it.',
    '- Channel cadence: 5-7/week for IG-primary, scale down for less intensive.',
    '- Language matches the bootstrap — if the company is Norwegian, output',
    '  everything in Norwegian (bokmål). English if the bootstrap is in English.',
    '',
    'Return ONLY the JSON object. No markdown, no prose, no backticks.',
  ].join('\n');
}

function buildUserMessage(
  bootstrap: MarketingPlanBootstrapInput,
  horizonDays: number,
  hasInstagramConnection: boolean,
): string {
  const profile = bootstrap.companyProfile ?? {};
  const csl = bootstrap.storyLogicDraft?.contentStoryLogic ?? {};
  const competitor = bootstrap.competitorAnalysis ?? {};
  const local = bootstrap.localPresencePlan ?? {};
  const intake = bootstrap.intakeDraft ?? {};
  const sections: string[] = [];

  sections.push(`## Company profile`);
  sections.push(`Name: ${profile.companyName ?? 'unknown'}`);
  sections.push(`Industry: ${profile.industry ?? 'unknown'}${profile.subIndustry ? ` / ${profile.subIndustry}` : ''}`);
  sections.push(`Business model: ${profile.businessModel ?? 'unknown'}`);
  if (profile.targetAudience?.length) {
    sections.push(`Target audience:\n${profile.targetAudience.map((t) => `  - ${t}`).join('\n')}`);
  }
  if (profile.offerings?.length) {
    sections.push(`Offerings:\n${profile.offerings.map((o) => `  - ${o}`).join('\n')}`);
  }
  if (profile.toneAndBrandSignals?.length) {
    sections.push(`Tone & brand signals:\n${profile.toneAndBrandSignals.map((t) => `  - ${t}`).join('\n')}`);
  }

  sections.push(`\n## Content story logic`);
  if (bootstrap.storyLogicDraft?.concept?.corePremise) {
    sections.push(`Core premise: ${bootstrap.storyLogicDraft.concept.corePremise}`);
  }
  if (csl.businessObjective) sections.push(`Business objective: ${csl.businessObjective}`);
  if (csl.audienceProblem) sections.push(`Audience problem: ${csl.audienceProblem}`);
  if (csl.keyPromise) sections.push(`Key promise: ${csl.keyPromise}`);
  if (csl.desiredAction) sections.push(`Desired action: ${csl.desiredAction}`);
  if (csl.visualFocus) sections.push(`Visual focus: ${csl.visualFocus}`);

  if (competitor.marketContext || competitor.positioningRecommendations?.length || competitor.marketingOpportunities?.length) {
    sections.push(`\n## Competitor + market`);
    if (competitor.marketContext) sections.push(`Market context: ${competitor.marketContext}`);
    if (competitor.marketingOpportunities?.length) {
      sections.push(`Opportunities:\n${competitor.marketingOpportunities.map((o) => `  - ${o}`).join('\n')}`);
    }
    if (competitor.positioningRecommendations?.length) {
      sections.push(`Positioning recs:\n${competitor.positioningRecommendations.map((p) => `  - ${p}`).join('\n')}`);
    }
  }

  if (local.industryContext || local.marketArea) {
    sections.push(`\n## Local context`);
    if (local.industryContext) sections.push(`Industry context: ${local.industryContext}`);
    if (local.marketArea) sections.push(`Market area: ${local.marketArea}`);
  }

  if (intake.keyMessage || intake.projectGoal) {
    sections.push(`\n## Project intake`);
    if (intake.keyMessage) sections.push(`Key message: ${intake.keyMessage}`);
    if (intake.projectGoal) sections.push(`Project goal: ${intake.projectGoal}`);
  }

  sections.push(`\n## Plan parameters`);
  sections.push(`Horizon: ${horizonDays} days`);
  sections.push(`Instagram connection available: ${hasInstagramConnection ? 'yes' : 'no — plan for IG but cross-post rules should degrade gracefully'}`);
  sections.push(`\nGenerate the marketing plan JSON now.`);
  return sections.join('\n');
}

function parsePlanJson(text: string): GeneratedMarketingPlan | null {
  // Claude occasionally wraps output in ```json fences despite the rule.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace < 0) return null;
  // Find the matching closing brace by walking the string — more robust
  // than regex when Claude adds a trailing note.
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, end + 1));
    if (!parsed?.strategy || !Array.isArray(parsed.pillars)) return null;
    if (parsed.pillars.length < 3 || parsed.pillars.length > 5) return null;
    return {
      strategy: parsed.strategy as MarketingPlanStrategy,
      pillars: parsed.pillars as MarketingPlanPillar[],
      generatedWithModel: 'unknown', // caller overrides
    };
  } catch {
    return null;
  }
}

/**
 * Call Claude with the bootstrap context + gate state and parse a
 * structured marketing plan. Returns null if Claude is disabled,
 * the API key is missing, or the response didn't parse — caller
 * should surface a "generator unavailable, try again" message.
 */
export async function generateMarketingPlan(input: {
  bootstrap: MarketingPlanBootstrapInput;
  hasInstagramConnection: boolean;
  horizonDays?: number;
  model?: string;
  /** Item #194 — forrige plans KPI-resultat passes som context for
   *  feedback-loop. Inneholder topp-performende pillar/format/platform
   *  fra de siste 30 dagene + missed targets. Claude bruker dette til
   *  å skifte vekt i ny plan. */
  previousPlanKpiContext?: {
    topPillar?: { name: string; primaryMetric: string; value: number } | null;
    topFormat?: { name: string; primaryMetric: string; value: number } | null;
    topPlatform?: { name: string; primaryMetric: string; value: number } | null;
    missedTargets?: Array<{ metric: string; target: number; actual: number; ratio: number }>;
    totalSnapshots?: number;
  };
}): Promise<GeneratedMarketingPlan | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[marketing-plan] ANTHROPIC_API_KEY missing — cannot generate');
    return null;
  }
  const horizonDays = input.horizonDays ?? HORIZON_DAYS_DEFAULT;
  const model = input.model || process.env.ROLE_ROOM_MARKETING_PLAN_MODEL || DEFAULT_MODEL;

  let client: { messages: { create: Function } };
  try {
    // Dynamic import so the backend still boots if @anthropic-ai/sdk
    // isn't in node_modules during local dev.
    // @ts-ignore — optional SDK
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (error) {
    console.error('[marketing-plan] @anthropic-ai/sdk not available', error);
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  let userMessage = buildUserMessage(input.bootstrap, horizonDays, input.hasInstagramConnection);

  // Item #194 — KPI-feedback-loop: legg til "what worked / what didn't"
  // som ekstra context. Holder Claude fra å gjenta strategier som
  // konsekvent underperform.
  if (input.previousPlanKpiContext) {
    const ctx = input.previousPlanKpiContext;
    const lines: string[] = ['\n## Previous plan performance (last 30 days)'];
    if (typeof ctx.totalSnapshots === 'number') {
      lines.push(`Total KPI snapshots: ${ctx.totalSnapshots}`);
    }
    if (ctx.topPillar) {
      lines.push(`Best-performing pillar: "${ctx.topPillar.name}" — ${ctx.topPillar.primaryMetric}=${ctx.topPillar.value}. Keep this angle prominent in the new plan.`);
    }
    if (ctx.topFormat) {
      lines.push(`Best-performing format: ${ctx.topFormat.name} — ${ctx.topFormat.primaryMetric}=${ctx.topFormat.value}. Weight the new plan toward this format.`);
    }
    if (ctx.topPlatform) {
      lines.push(`Best-performing platform: ${ctx.topPlatform.name} — ${ctx.topPlatform.primaryMetric}=${ctx.topPlatform.value}. Consider boosting cadence here.`);
    }
    if (ctx.missedTargets && ctx.missedTargets.length > 0) {
      lines.push('Targets missed (actual vs target ratio):');
      for (const m of ctx.missedTargets) {
        lines.push(`  - ${m.metric}: actual ${m.actual} vs target ${m.target} (${Math.round(m.ratio * 100)}%)`);
      }
      lines.push('Adjust KPI targets in the new plan to be realistic OR change strategy to actually hit them.');
    }
    if (lines.length > 1) {
      userMessage += '\n' + lines.join('\n');
    }
  }

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // The system prompt is stable across every generation — caching
          // it cuts ~80% of the recurring input tokens when the same
          // producer re-generates.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    logAIUsage(response, { feature: 'role-room/marketing-plan' }).catch(() => undefined);
    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    const parsed = parsePlanJson(text);
    if (!parsed) {
      console.error('[marketing-plan] failed to parse Claude response', text.slice(0, 500));
      return null;
    }
    // Item #146 — capture token usage from Anthropic response.
    const u = response?.usage ?? {};
    const inputTokens = Number(u.input_tokens) || 0;
    const outputTokens = Number(u.output_tokens) || 0;
    const cacheReadInputTokens = Number(u.cache_read_input_tokens) || 0;
    const cacheCreationInputTokens = Number(u.cache_creation_input_tokens) || 0;
    const usage: GeneratedMarketingPlanUsage = {
      inputTokens,
      outputTokens,
      cacheReadInputTokens: cacheReadInputTokens || undefined,
      cacheCreationInputTokens: cacheCreationInputTokens || undefined,
      costNok: computeClaudeCostNok(model, inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens),
    };
    return { ...parsed, generatedWithModel: model, usage };
  } catch (error) {
    console.error('[marketing-plan] Claude request failed', error);
    return null;
  }
}

// ── Persistence ─────────────────────────────────────────────────────────

export interface PersistedMarketingPlan {
  id: string;
  projectId: string;
  ownerUserId: string;
  status: 'draft' | 'active' | 'archived';
  strategy: MarketingPlanStrategy;
  pillars: PersistedPillar[];
  generatedAt: Date | null;
  generatedWithModel: string | null;
  startDate: Date | null;
  horizonDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedPillar extends MarketingPlanPillar {
  id: string;
  planId: string;
  sortOrder: number;
  isActive: boolean;
  isCustom: boolean;
}

/**
 * Upsert a freshly-generated plan as the project's active draft. If the
 * project already has a draft, it is archived in-place so producers can
 * compare plans over time without losing history.
 */
export async function persistGeneratedMarketingPlan(
  pool: Pool,
  input: {
    projectId: string;
    ownerUserId: string;
    horizonDays?: number;
    generated: GeneratedMarketingPlan;
  },
): Promise<PersistedMarketingPlan | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE role_room_marketing_plans
          SET status = 'archived', updated_at = now()
        WHERE project_id = $1 AND status = 'draft'`,
      [input.projectId],
    );
    // Stuff usage into the strategy JSONB blob so we don't need a
    // migration just to surface tokens + cost. Frontend reads
    // plan.strategy.usage transparently.
    const strategyWithUsage = input.generated.usage
      ? { ...input.generated.strategy, usage: input.generated.usage }
      : input.generated.strategy;
    const planInsert = await client.query(
      `INSERT INTO role_room_marketing_plans
         (project_id, owner_user_id, status, strategy, generated_at,
          generated_with_model, horizon_days)
       VALUES ($1, $2, 'draft', $3::jsonb, now(), $4, $5)
       RETURNING id, created_at, updated_at`,
      [
        input.projectId,
        input.ownerUserId,
        JSON.stringify(strategyWithUsage),
        input.generated.generatedWithModel,
        input.horizonDays ?? HORIZON_DAYS_DEFAULT,
      ],
    );
    const planId = String(planInsert.rows[0].id);
    const pillars: PersistedPillar[] = [];
    let sortOrder = 0;
    for (const pillar of input.generated.pillars) {
      const pillarInsert = await client.query(
        `INSERT INTO role_room_marketing_plan_pillars
           (plan_id, name, description, rationale, target_kpi, sort_order)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING id`,
        [
          planId,
          pillar.name,
          pillar.description,
          pillar.rationale,
          pillar.targetKpi ? JSON.stringify(pillar.targetKpi) : null,
          sortOrder,
        ],
      );
      pillars.push({
        id: String(pillarInsert.rows[0].id),
        planId,
        sortOrder,
        isActive: true,    // AI-genererte pillars starter alltid aktive
        isCustom: false,   // custom-flagget settes kun via POST /pillars
        ...pillar,
      });
      sortOrder += 1;
    }
    await client.query('COMMIT');
    return {
      id: planId,
      projectId: input.projectId,
      ownerUserId: input.ownerUserId,
      status: 'draft',
      strategy: input.generated.strategy,
      pillars,
      generatedAt: new Date(),
      generatedWithModel: input.generated.generatedWithModel,
      startDate: null,
      horizonDays: input.horizonDays ?? HORIZON_DAYS_DEFAULT,
      createdAt: planInsert.rows[0].created_at as Date,
      updatedAt: planInsert.rows[0].updated_at as Date,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[marketing-plan] persist failed', error);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Fetch the current draft/active plan for a project. Returns null when
 * the project has no plan or only archived plans.
 */
export async function fetchActiveMarketingPlan(
  pool: Pool,
  projectId: string,
): Promise<PersistedMarketingPlan | null> {
  try {
    const planResult = await pool.query(
      `SELECT id, project_id, owner_user_id, status, strategy,
              generated_at, generated_with_model, start_date, horizon_days,
              created_at, updated_at
         FROM role_room_marketing_plans
        WHERE project_id = $1
          AND status IN ('draft', 'active')
        ORDER BY updated_at DESC
        LIMIT 1`,
      [projectId],
    );
    const row = planResult.rows[0];
    if (!row) return null;
    // is_active + is_custom kom i migrasjon 0090. COALESCE gjør spørringen
    // tolerant mot databaser som ikke har kjørt migrasjonen ennå (returnerer
    // TRUE/FALSE som om feltene var defaultverdier).
    const pillarsResult = await pool.query(
      `SELECT id, name, description, rationale, target_kpi, sort_order,
              COALESCE(is_active, TRUE) AS is_active,
              COALESCE(is_custom, FALSE) AS is_custom
         FROM role_room_marketing_plan_pillars
        WHERE plan_id = $1
        ORDER BY sort_order`,
      [row.id],
    );
    const pillars: PersistedPillar[] = pillarsResult.rows.map((p) => ({
      id: String(p.id),
      planId: String(row.id),
      name: p.name,
      description: p.description ?? '',
      rationale: p.rationale ?? '',
      targetKpi: p.target_kpi ?? undefined,
      sortOrder: Number(p.sort_order ?? 0),
      isActive: Boolean(p.is_active),
      isCustom: Boolean(p.is_custom),
    }));
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      ownerUserId: String(row.owner_user_id),
      status: row.status,
      strategy: row.strategy as MarketingPlanStrategy,
      pillars,
      generatedAt: (row.generated_at as Date | null) ?? null,
      generatedWithModel: (row.generated_with_model as string | null) ?? null,
      startDate: (row.start_date as Date | null) ?? null,
      horizonDays: Number(row.horizon_days ?? HORIZON_DAYS_DEFAULT),
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  } catch (error) {
    console.error('[marketing-plan] fetch active failed', error);
    return null;
  }
}

/**
 * Flip a draft plan to active (and mark start_date = today). Activation
 * is the signal the client-facing dashboard uses to start counting days
 * + measuring KPI actuals against the plan.
 */
export async function activateMarketingPlan(
  pool: Pool,
  planId: string,
  projectId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_marketing_plans
          SET status = 'active',
              start_date = CURRENT_DATE,
              updated_at = now()
        WHERE id = $1 AND project_id = $2 AND status = 'draft'`,
      [planId, projectId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[marketing-plan] activate failed', error);
    return false;
  }
}
