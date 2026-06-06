/**
 * role-room-competitor-report-claude.ts
 *
 * Genererer en AI-rapport som leser konkurrent-snapshot-historikken
 * (siste 30 dager per tracked Page) + The Role Rooms egne content pillars
 * og produserer:
 *   - Prioriterte insights (opportunity/threat/gap/trend)
 *   - Content-gaps (temaer ingen konkurrent dekker)
 *   - Anbefalte neste handlinger
 *
 * Kostnad: ~0.50 NOK per rapport (Sonnet 4.5 + cache på system-prompten).
 */

import { logAIUsage } from './ai-usage-tracker.js';

export interface BrandMetricsInput {
  facebook?: {
    fanCount: number | null;
    followersCount: number | null;
    pageImpressions7d: number | null;
    pageEngagedUsers7d: number | null;
    posts7d: number | null;
    posts30d: number | null;
  };
  instagram?: {
    username: string | null;
    followersCount: number | null;
    mediaCount: number | null;
    recent10MediaAvgLikes: number | null;
    recent10MediaAvgComments: number | null;
  };
  facebookSnapshotsCount?: number;
  instagramSnapshotsCount?: number;
  /** Top-3-5 publiserte posts siste 30d med engagement-data — feedback-loop
   *  fra hva som faktisk har funket på The Role Rooms egne kanaler. */
  topPerformers?: Array<{
    platform: string;
    caption: string;  // first 200 chars
    sourceInsight: string | null;
    publishedAt: string;
    reach: number | null;
    reactionsTotal: number | null;
    commentsCount: number | null;
    engagementRate: number | null;
    hoursLive: number | null;
  }>;
}

export interface CompetitorReportInput {
  brand: {
    name: string;
    industry: string;
    positioning?: { valueProp?: string; differentiator?: string };
    voice?: string;
    contentPillars?: Array<{ name: string; description: string }>;
    currentFanCount?: number | null;
    currentIgFollowers?: number | null;
    selfMetrics?: BrandMetricsInput;
  };
  competitors: Array<{
    id: number;
    nickname: string;
    pageId: string;
    category: string | null;
    latestFanCount: number | null;
    fanCount30dAgo: number | null;
    fanCountDelta30d: number | null;
    fanCountDeltaPct30d: number | null;
    recentPostCount7d: number | null;
    recentPostCount30d: number | null;
    postCount7d_30dAgo?: number | null;
    snapshotCount: number;  // how many data points we have
    about?: string | null;
    website?: string | null;
  }>;
  language?: 'nb' | 'en';
}

export interface CompetitorReportInsight {
  category: 'opportunity' | 'threat' | 'gap' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  actionableSteps: string[];
  relatedCompetitors?: string[];  // nicknames
}

export interface CompetitorReportAction {
  action: string;
  rationale: string;
  expectedImpact: string;
  timeframe?: string;
}

export interface KpiTarget {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'ga4';
  metric: string;             // 'fan_count', 'avg_likes_per_post', 'engaged_users_7d', etc.
  currentValue: number | null;
  targetValue: number;
  timeframe: '7d' | '30d' | '90d';
  reasoning: string;
  difficulty: 'easy' | 'realistic' | 'stretch';
}

export interface CompetitorReport {
  summary: string;
  insights: CompetitorReportInsight[];
  contentGaps: string[];
  recommendedNextActions: CompetitorReportAction[];
  competitorScorecard: Array<{
    nickname: string;
    momentum: 'fast-growth' | 'steady' | 'flat' | 'declining';
    notableActivity: string;
  }>;
  kpiTargets?: KpiTarget[];
  generatedWithModel: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    costNok: number | null;
  };
}

const DEFAULT_MODEL = 'claude-sonnet-4-5';

function computeCostNok(model: string, input: number, output: number, cacheRead = 0, cacheWrite = 0): number | null {
  const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1.00 },
  };
  const p = PRICING[model];
  if (!p) return null;
  const usd =
    (input * p.input) / 1_000_000 +
    (output * p.output) / 1_000_000 +
    (cacheRead * p.cacheRead) / 1_000_000 +
    (cacheWrite * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 10.5 * 100) / 100;
}

function buildSystemPrompt(): string {
  return [
    'You are The Role Room marketing-intelligence analyst.',
    'Your job: given snapshot-data for a brand + its tracked competitors,',
    'produce a prioritized intelligence report a digital marketer can act on this week.',
    '',
    'Output a JSON object — nothing else — matching exactly this TypeScript type:',
    '```',
    'type Report = {',
    '  summary: string;        // 2-3 sentences at the top — what should the marketer know first',
    '  insights: Array<{',
    '    category: "opportunity" | "threat" | "gap" | "trend";',
    '    priority: "high" | "medium" | "low";',
    '    title: string;        // 6-12 words, scannable',
    '    body: string;         // 2-4 sentences explaining the insight',
    '    actionableSteps: string[];   // 1-4 concrete steps the marketer can take this week',
    '    relatedCompetitors?: string[];  // nicknames triggering this insight',
    '  }>;',
    '  contentGaps: string[];  // 2-5 topics no competitor covers that audience cares about',
    '  recommendedNextActions: Array<{',
    '    action: string;       // imperative — "Publiser …", "Sett CTA til …"',
    '    rationale: string;    // 1-2 sentences why',
    '    expectedImpact: string; // 1 sentence with rough estimate',
    '    timeframe?: string;   // "this week", "within 7 days", etc.',
    '  }>;',
    '  competitorScorecard: Array<{',
    '    nickname: string;',
    '    momentum: "fast-growth" | "steady" | "flat" | "declining";',
    '    notableActivity: string;   // 1 sentence',
    '  }>;',
    '  kpiTargets?: Array<{',
    '    platform: "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube" | "ga4";',
    '    metric: string;            // e.g. "fan_count", "page_impressions_7d", "ig_avg_likes_per_post", "posts_per_30d"',
    '    currentValue: number | null;  // null if no self-metrics for that platform yet',
    '    targetValue: number;       // realistic target',
    '    timeframe: "7d" | "30d" | "90d";',
    '    reasoning: string;         // 1-2 sentences why this target',
    '    difficulty: "easy" | "realistic" | "stretch";',
    '  }>;',
    '};',
    '```',
    '',
    'Rules:',
    '- 3-6 insights total. Mix categories. Prioritize "high" only when truly actionable this week.',
    '- "opportunity" = something we can do that competitors aren\'t.',
    '- "threat" = something a competitor is doing that risks our position.',
    '- "gap" = content topic / channel / format no competitor covers.',
    '- "trend" = pattern across multiple competitors that signals where the market is going.',
    '- actionableSteps must be CONCRETE — "Publiser case-study om norsk produksjon" not "Lag mer innhold".',
    '- contentGaps: must be specific topics, NOT generic ("how-to videos" is too vague — "Bak kulissene fra norsk casting-prosess" is good).',
    '- recommendedNextActions: 2-4 max. Each ties back to either an insight or a content-gap.',
    '- competitorScorecard: ONE entry per competitor in the input. Momentum based on fan_count delta:',
    '    fast-growth: >5% / 30d',
    '    steady:      1-5% / 30d',
    '    flat:        -1 to +1% / 30d',
    '    declining:   <-1% / 30d',
    '  notableActivity must reference SPECIFIC data: "Posted 22 times last 7d vs 8 the week before" not "Active poster".',
    '- If a competitor has only 1 snapshot, mark momentum "flat" + note "trenger flere snapshots for trend".',
    '',
    'kpiTargets-rules (only output if brand.selfMetrics is provided):',
    '- 3-6 KPI-mål total. Mix av plattformer som har self-metrics-data.',
    '- Mål må være REALISTISKE for SMB i Norge: fan_count vekst 5-30/uke er normalt,',
    '  ig followers 5-50/uke for ny konto, posts/30d 12-30 for aktiv strategi.',
    '- difficulty: easy = vil sannsynligvis skje uten endring; realistic = krever',
    '  konsekvent eksekvering av planen; stretch = ambisiøst men oppnåelig.',
    '- currentValue = leses fra brand.selfMetrics. Hvis ingen self-metrics: null.',
    '- timeframe: "7d" for daglige metrics, "30d" for kvartalsvekst, "90d" for transformasjon.',
    '- reasoning må REFERERE konkurrent-data: "Norwedfilm har 226 fans — vi kan',
    '  realistisk treffe 100 innen 30d ved 3 posts/uke + cross-promotion fra industri-CRM"',
    '- Use the language hint. Default Norwegian bokmål if brand is Norwegian.',
    '',
    'Return ONLY the JSON object. No markdown, no prose, no backticks.',
  ].join('\n');
}

function buildUserMessage(input: CompetitorReportInput): string {
  const lines: string[] = [];
  lines.push(`# Brand: ${input.brand.name}`);
  lines.push(`Industry: ${input.brand.industry}`);
  if (input.brand.positioning?.valueProp) lines.push(`Value prop: ${input.brand.positioning.valueProp}`);
  if (input.brand.positioning?.differentiator) lines.push(`Differentiator: ${input.brand.positioning.differentiator}`);
  if (input.brand.voice) lines.push(`Voice: ${input.brand.voice}`);
  if (typeof input.brand.currentFanCount === 'number') lines.push(`Current FB fan_count: ${input.brand.currentFanCount}`);
  if (typeof input.brand.currentIgFollowers === 'number') lines.push(`Current IG followers: ${input.brand.currentIgFollowers}`);

  if (input.brand.contentPillars?.length) {
    lines.push('');
    lines.push('## Content pillars');
    for (const p of input.brand.contentPillars) lines.push(`- ${p.name}: ${p.description}`);
  }

  if (input.brand.selfMetrics) {
    lines.push('');
    lines.push('## OUR self-metrics (use to set realistic kpiTargets)');
    const sm = input.brand.selfMetrics;
    if (sm.facebook) {
      lines.push(`Facebook: fan_count=${sm.facebook.fanCount} followers=${sm.facebook.followersCount} page_impressions_7d=${sm.facebook.pageImpressions7d} engaged_users_7d=${sm.facebook.pageEngagedUsers7d} posts_7d=${sm.facebook.posts7d} posts_30d=${sm.facebook.posts30d}`);
      lines.push(`Facebook snapshot history: ${sm.facebookSnapshotsCount ?? 0} data points`);
    }
    if (sm.instagram) {
      lines.push(`Instagram @${sm.instagram.username}: followers=${sm.instagram.followersCount} posts=${sm.instagram.mediaCount} avg_likes_recent_10=${sm.instagram.recent10MediaAvgLikes} avg_comments_recent_10=${sm.instagram.recent10MediaAvgComments}`);
      lines.push(`Instagram snapshot history: ${sm.instagramSnapshotsCount ?? 0} data points`);
    }
    if (sm.topPerformers && sm.topPerformers.length > 0) {
      lines.push('');
      lines.push('## Top-performing publiserte posts siste 30d (feedback fra hva som har funket)');
      for (const t of sm.topPerformers) {
        lines.push(`- [${t.platform}] reach=${t.reach} reactions=${t.reactionsTotal} comments=${t.commentsCount} engagement_rate=${t.engagementRate} (${t.hoursLive}h live)`);
        if (t.sourceInsight) lines.push(`  Fra insight: "${t.sourceInsight}"`);
        lines.push(`  Caption: ${t.caption.slice(0, 120)}…`);
      }
      lines.push('');
      lines.push('Bruk top-performers til å foreslå MØNSTRE: hvilken pillar/format/vinkel som har drevet engagement, og hvilke kpiTargets som bør justeres opp/ned basert på faktisk performance.');
    }
  }

  lines.push('');
  lines.push(`## Tracked competitors (${input.competitors.length})`);
  for (const c of input.competitors) {
    lines.push('');
    lines.push(`### ${c.nickname} (page ${c.pageId})`);
    if (c.category) lines.push(`Category: ${c.category}`);
    if (c.about) lines.push(`About: ${c.about.slice(0, 200)}`);
    if (c.website) lines.push(`Website: ${c.website}`);
    if (c.latestFanCount != null) {
      const delta = c.fanCountDelta30d != null ? ` (${c.fanCountDelta30d > 0 ? '+' : ''}${c.fanCountDelta30d} fans / 30d, ${c.fanCountDeltaPct30d?.toFixed(1) ?? '?'}%)` : '';
      lines.push(`Fan count: ${c.latestFanCount}${delta}`);
    }
    if (c.recentPostCount7d != null) {
      lines.push(`Posts last 7d: ${c.recentPostCount7d}, last 30d: ${c.recentPostCount30d ?? '?'}`);
    }
    lines.push(`Snapshots in DB: ${c.snapshotCount} (need ≥2 for trend signals)`);
  }

  if (input.language) {
    lines.push('');
    lines.push(`## Output language: ${input.language === 'nb' ? 'Norwegian bokmål' : 'English'}`);
  }

  return lines.join('\n');
}

function parseJson(raw: string): CompetitorReport | null {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed.insights || !Array.isArray(parsed.insights)) return null;
    return parsed as CompetitorReport;
  } catch {
    return null;
  }
}

export async function generateCompetitorReport(
  input: CompetitorReportInput,
  options?: { model?: string },
): Promise<CompetitorReport | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[competitor-report] ANTHROPIC_API_KEY missing');
    return null;
  }
  const model = options?.model || process.env.ROLE_ROOM_COMPETITOR_REPORT_MODEL || DEFAULT_MODEL;

  let client: { messages: { create: Function } };
  try {
    // @ts-ignore
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (error) {
    console.error('[competitor-report] @anthropic-ai/sdk not available', error);
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    logAIUsage(response, { feature: 'role-room/competitor-report' }).catch(() => undefined);

    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    const parsed = parseJson(text);
    if (!parsed) {
      console.error('[competitor-report] failed to parse Claude response', text.slice(0, 500));
      return null;
    }

    const usage = response.usage ?? {};
    parsed.generatedWithModel = model;
    parsed.usage = {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens,
      costNok: computeCostNok(
        model,
        usage.input_tokens ?? 0,
        usage.output_tokens ?? 0,
        usage.cache_read_input_tokens ?? 0,
        usage.cache_creation_input_tokens ?? 0,
      ),
    };
    return parsed;
  } catch (error) {
    console.error('[competitor-report] Claude call failed', error);
    return null;
  }
}
