/**
 * Ad Creative Engine — turns the business + marketing-plan context into
 * platform-shaped ad copy the producer can review, edit, and ship.
 *
 * This is the "agent lager riktige ads basert på bedriften" layer (Lag 1).
 * It mirrors the marketing-plan generator (role-room-marketing-plan.ts):
 * a Claude call with a stable cached system prompt, structured JSON output,
 * usage/cost logging, and graceful null on failure.
 *
 * Two deliberate differences from the marketing-plan generator:
 *  1. The LLM client is injectable (`__setAdCreativesLlmClient`) so the full
 *     generate path is unit-testable without the SDK or an API key.
 *  2. Output is PLATFORM-SHAPED — Meta/LinkedIn use primaryText+headline+CTA,
 *     Google uses RSA headlines[]/descriptions[] — because each ad platform
 *     has hard character/asset constraints that copy must respect to be
 *     uploadable at all.
 *
 * Compliance: when the caller passes complianceNotes (or a regulated industry
 * like health/medical), the system prompt forbids unverifiable claims and the
 * model returns a `complianceChecklist` of statements to verify before
 * publishing. MedInnova/PreVisit is healthcare — this is not optional.
 */

import { logAIUsage } from './ai-usage-tracker.js';
import type { AdsGoal, AdsPlatform } from './role-room-ads-shared.js';

// ── Context (assembled by the route from the persisted marketing plan + ad inputs) ──

export interface AdGenerationContext {
  businessName: string;
  /** What is actually being advertised (product/service/offer landing). */
  productOrService?: string | null;
  industry?: string | null;
  /** Strongest brand signal — pulled from the active marketing plan. */
  valueProp?: string | null;
  differentiator?: string | null;
  toneVoice?: string | null;
  toneDos?: string[];
  toneDonts?: string[];
  pillars?: Array<{ name: string; description?: string | null }>;
  targetAudience?: string | null;
  keyMessage?: string | null;
  /** Per-generation ad inputs the producer supplies in the generate dialog. */
  landingUrl?: string | null;
  offer?: string | null;
  /** Forbidden claims / regulatory limits — critical for health/medical. */
  complianceNotes?: string | null;
  /** Output language. Defaults to Norwegian (bokmål) — the MedInnova case. */
  language?: 'no' | 'en';
}

export interface AdGenerationReadiness {
  ready: boolean;
  missingFields: string[];
}

/**
 * Minimal gate before spending tokens: we need a business name and at least
 * one thing to say about it (what's advertised, its value prop, or the key
 * message). Everything else sharpens the copy but isn't strictly required.
 */
export function checkAdGenerationReadiness(ctx: AdGenerationContext): AdGenerationReadiness {
  const missing: string[] = [];
  if (!ctx.businessName?.trim()) missing.push('businessName');
  const hasSubstance =
    !!ctx.productOrService?.trim() ||
    !!ctx.valueProp?.trim() ||
    !!ctx.keyMessage?.trim() ||
    !!ctx.offer?.trim();
  if (!hasSubstance) missing.push('productOrService | valueProp | keyMessage | offer (minst én)');
  return { ready: missing.length === 0, missingFields: missing };
}

// ── Output shape ─────────────────────────────────────────────────────────

export interface GeneratedAdVariant {
  /** Primary headline. For Google this is also headlines[0]. */
  headline: string;
  /** Google RSA needs many short headlines (≤30 chars); Meta can use alt headlines. */
  headlines?: string[];
  /** Meta primary text / LinkedIn intro text. Not used by Google RSA. */
  primaryText?: string | null;
  /** Single link description (Meta). */
  description?: string | null;
  /** Google RSA descriptions (≤90 chars each). */
  descriptions?: string[];
  /** CTA button label (platform-constrained — see PLATFORM_CTA). */
  callToAction?: string | null;
  /** Art-direction brief for the producer / designer. */
  imageBrief?: string | null;
  /** Text-to-image prompt (for generated visuals). */
  imagePrompt?: string | null;
  /** Why this angle — helps the producer choose between variants. */
  rationale?: string | null;
}

export interface GeneratedAdCreativeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  costNok: number | null;
}

export interface GeneratedAdCreativeSet {
  platform: AdsPlatform;
  goal: AdsGoal;
  /** 2–3 distinct A/B variants. */
  variants: GeneratedAdVariant[];
  landingUrl?: string | null;
  /** Claims to verify before publishing (esp. regulated industries). */
  complianceChecklist?: string[];
  generatedWithModel: string;
  usage?: GeneratedAdCreativeUsage;
}

// ── Platform constraints (single source of truth for prompt + validation) ──

interface PlatformSpec {
  label: string;
  /** Hard/recommended character limits we tell Claude to respect. */
  headlineMax: number;
  primaryTextMax?: number;
  descriptionMax?: number;
  /** Google RSA wants many headlines; Meta/LinkedIn want few. */
  headlineCount: [min: number, max: number];
  /** Allowed CTA-button labels for the platform. */
  cta: string[];
  /** Whether the platform uses long-form primary/intro text. */
  usesPrimaryText: boolean;
  /** Google Responsive Search Ads: many headlines + descriptions, no body. */
  isResponsiveSearch: boolean;
}

export const PLATFORM_SPECS: Record<AdsPlatform, PlatformSpec> = {
  meta: {
    label: 'Meta (Facebook/Instagram)',
    headlineMax: 40,
    primaryTextMax: 125,
    descriptionMax: 30,
    headlineCount: [1, 1],
    cta: ['LEARN_MORE', 'SIGN_UP', 'BOOK_NOW', 'CONTACT_US', 'GET_OFFER', 'SUBSCRIBE', 'DOWNLOAD', 'SEE_MORE'],
    usesPrimaryText: true,
    isResponsiveSearch: false,
  },
  linkedin: {
    label: 'LinkedIn',
    headlineMax: 70,
    primaryTextMax: 150,
    headlineCount: [1, 1],
    cta: ['LEARN_MORE', 'SIGN_UP', 'REGISTER', 'DOWNLOAD', 'REQUEST_DEMO', 'SUBSCRIBE'],
    usesPrimaryText: true,
    isResponsiveSearch: false,
  },
  google: {
    label: 'Google Ads (Responsive Search)',
    headlineMax: 30,
    descriptionMax: 90,
    headlineCount: [5, 12],
    cta: [],
    usesPrimaryText: false,
    isResponsiveSearch: true,
  },
  tiktok: {
    label: 'TikTok',
    headlineMax: 100,
    primaryTextMax: 100,
    headlineCount: [1, 1],
    cta: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'CONTACT_US'],
    usesPrimaryText: true,
    isResponsiveSearch: false,
  },
};

// ── Pricing (shared with marketing-plan; refresh together if FX shifts) ──

const DEFAULT_MODEL = 'claude-sonnet-4-5';

function computeClaudeCostNok(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
): number | null {
  const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 },
    'claude-opus-4-7': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
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

const GOAL_GUIDANCE: Record<AdsGoal, string> = {
  brand_awareness: 'Maximize memorability + brand recall. Lead with the differentiator, not a hard sell.',
  engagement: 'Invite interaction — a question, a relatable tension, a reason to comment/save.',
  lead_generation: 'Drive a single clear action (book/contact/sign up). Make the value of acting explicit.',
  ecommerce_conversion: 'Sell the product + offer directly. Concrete benefit, urgency, clear price/promo if given.',
  retargeting: 'Assume prior awareness — overcome the last objection, reinforce trust, nudge to convert.',
};

export function buildAdSystemPrompt(platform: AdsPlatform): string {
  const spec = PLATFORM_SPECS[platform];
  const lines: string[] = [
    'You are The Role Room ad copywriter — a senior performance-marketing creative.',
    `You write ${spec.label} ad copy that respects the platform's hard limits and is ready to ship.`,
    '',
    'Output a JSON object — nothing else — matching exactly this TypeScript type:',
    '```',
    'type CreativeSet = {',
    '  variants: Array<{',
    '    headline: string;',
    spec.isResponsiveSearch
      ? '    headlines: string[];      // 5-12 distinct short headlines'
      : '    headlines?: string[];     // optional alt headlines',
    spec.usesPrimaryText
      ? '    primaryText: string;      // the main body/intro text'
      : '    primaryText?: null;       // not used on this platform',
    spec.isResponsiveSearch
      ? '    descriptions: string[];   // 2-4 descriptions'
      : '    description?: string;     // short link description',
    spec.cta.length ? '    callToAction: string;     // one of the allowed CTA values below' : '    callToAction?: null;',
    '    imageBrief: string;       // art-direction for the visual (1-2 sentences)',
    '    imagePrompt: string;      // a text-to-image prompt for the visual',
    '    rationale: string;        // why this angle (1 sentence)',
    '  }>;                          // 2-3 distinct variants',
    '  complianceChecklist: string[]; // claims a human must verify before publishing',
    '};',
    '```',
    '',
    'Hard rules:',
    `- Headline ≤ ${spec.headlineMax} characters. Never exceed it — over-limit copy is rejected by the platform.`,
  ];
  if (spec.primaryTextMax) lines.push(`- primaryText ≤ ${spec.primaryTextMax} characters (the strong part must land in the first ${Math.min(spec.primaryTextMax, 90)}).`);
  if (spec.descriptionMax) lines.push(`- description(s) ≤ ${spec.descriptionMax} characters.`);
  if (spec.isResponsiveSearch) {
    lines.push(`- Provide ${spec.headlineCount[0]}-${spec.headlineCount[1]} headlines per variant — each a distinct angle, not rephrasings.`);
    lines.push('- Provide 2-4 descriptions per variant.');
  }
  if (spec.cta.length) lines.push(`- callToAction MUST be exactly one of: ${spec.cta.join(', ')}.`);
  lines.push(
    '- 2-3 variants, each a genuinely different angle (e.g. problem-led vs outcome-led vs social-proof) — not paraphrases.',
    '- Concrete over generic. Name the audience benefit; avoid "best", "leading", "world-class" filler.',
    '- No clickbait, no fake urgency, no claims the business cannot back up.',
    '',
    'Compliance (NON-NEGOTIABLE):',
    '- Do NOT invent statistics, certifications, guarantees, medical/health outcomes, or regulatory approvals.',
    '- For health/medical/clinical context: avoid claims of curing, diagnosing, or guaranteed outcomes. Stay within informational/educational framing.',
    '- Put EVERY factual claim that a human must verify (numbers, certifications, outcome claims, comparative claims) into complianceChecklist.',
    '- If the caller provided compliance notes, treat them as absolute constraints.',
    '',
    'Return ONLY the JSON object. No markdown, no prose, no backticks.',
  );
  return lines.join('\n');
}

export function buildAdUserMessage(ctx: AdGenerationContext, platform: AdsPlatform, goal: AdsGoal): string {
  const language = ctx.language ?? 'no';
  const s: string[] = [];
  s.push('## Business');
  s.push(`Name: ${ctx.businessName}`);
  if (ctx.industry) s.push(`Industry: ${ctx.industry}`);
  if (ctx.productOrService) s.push(`Advertising: ${ctx.productOrService}`);
  if (ctx.valueProp) s.push(`Value proposition: ${ctx.valueProp}`);
  if (ctx.differentiator) s.push(`Differentiator: ${ctx.differentiator}`);
  if (ctx.keyMessage) s.push(`Key message: ${ctx.keyMessage}`);

  if (ctx.toneVoice || ctx.toneDos?.length || ctx.toneDonts?.length) {
    s.push('\n## Brand voice');
    if (ctx.toneVoice) s.push(`Voice: ${ctx.toneVoice}`);
    if (ctx.toneDos?.length) s.push(`Do:\n${ctx.toneDos.map((d) => `  - ${d}`).join('\n')}`);
    if (ctx.toneDonts?.length) s.push(`Don't:\n${ctx.toneDonts.map((d) => `  - ${d}`).join('\n')}`);
  }

  if (ctx.targetAudience) {
    s.push('\n## Target audience');
    s.push(ctx.targetAudience);
  }

  if (ctx.pillars?.length) {
    s.push('\n## Content pillars (angles already established for this brand)');
    s.push(ctx.pillars.map((p) => `  - ${p.name}${p.description ? `: ${p.description}` : ''}`).join('\n'));
  }

  s.push('\n## This ad');
  s.push(`Platform: ${PLATFORM_SPECS[platform].label}`);
  s.push(`Goal: ${goal} — ${GOAL_GUIDANCE[goal]}`);
  if (ctx.offer) s.push(`Offer/hook: ${ctx.offer}`);
  if (ctx.landingUrl) s.push(`Landing page: ${ctx.landingUrl}`);
  if (ctx.complianceNotes) s.push(`COMPLIANCE CONSTRAINTS (absolute): ${ctx.complianceNotes}`);

  s.push('\n## Output');
  s.push(
    language === 'no'
      ? 'Write ALL ad copy in Norwegian (bokmål). Keep the JSON keys in English.'
      : 'Write all ad copy in English.',
  );
  s.push('Generate the creative set JSON now.');
  return s.join('\n');
}

// ── Parse + validate (pure, exported for testing) ─────────────────────────

export function parseAdCreativeJson(
  text: string,
  platform: AdsPlatform,
  goal: AdsGoal,
): Omit<GeneratedAdCreativeSet, 'generatedWithModel' | 'usage'> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace < 0) return null;
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
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(firstBrace, end + 1));
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.variants) || parsed.variants.length === 0) return null;

  const variants: GeneratedAdVariant[] = [];
  for (const v of parsed.variants) {
    if (!v || typeof v.headline !== 'string' || !v.headline.trim()) continue;
    variants.push({
      headline: String(v.headline).trim(),
      headlines: Array.isArray(v.headlines) ? v.headlines.map((h: unknown) => String(h)).filter(Boolean) : undefined,
      primaryText: typeof v.primaryText === 'string' ? v.primaryText : null,
      description: typeof v.description === 'string' ? v.description : null,
      descriptions: Array.isArray(v.descriptions) ? v.descriptions.map((d: unknown) => String(d)).filter(Boolean) : undefined,
      callToAction: typeof v.callToAction === 'string' ? v.callToAction : null,
      imageBrief: typeof v.imageBrief === 'string' ? v.imageBrief : null,
      imagePrompt: typeof v.imagePrompt === 'string' ? v.imagePrompt : null,
      rationale: typeof v.rationale === 'string' ? v.rationale : null,
    });
  }
  if (variants.length === 0) return null;

  const complianceChecklist = Array.isArray(parsed.complianceChecklist)
    ? parsed.complianceChecklist.map((c: unknown) => String(c)).filter(Boolean)
    : [];

  return { platform, goal, variants, complianceChecklist };
}

// ── Injectable LLM client (so the generate path is unit-testable) ─────────

export interface AdCreativesLlmClient {
  messages: { create: (args: unknown) => Promise<unknown> };
}

let injectedClient: AdCreativesLlmClient | null = null;

/** Test seam — inject a fake Anthropic client. Pass null to reset. */
export function __setAdCreativesLlmClient(client: AdCreativesLlmClient | null): void {
  injectedClient = client;
}

async function resolveLlmClient(): Promise<AdCreativesLlmClient | null> {
  if (injectedClient) return injectedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[ad-creatives] ANTHROPIC_API_KEY missing — cannot generate');
    return null;
  }
  try {
    // @ts-ignore — optional SDK, dynamic import so the backend boots without it
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    return new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY }) as AdCreativesLlmClient;
  } catch (error) {
    console.error('[ad-creatives] @anthropic-ai/sdk not available', error);
    return null;
  }
}

/**
 * Generate platform-shaped ad copy from the business + marketing-plan context.
 * Returns null when the LLM is unavailable or the response didn't parse —
 * the route surfaces a "generator unavailable, try again" message.
 */
export async function generateAdCreatives(input: {
  context: AdGenerationContext;
  platform: AdsPlatform;
  goal: AdsGoal;
  model?: string;
}): Promise<GeneratedAdCreativeSet | null> {
  const { context, platform, goal } = input;
  const client = await resolveLlmClient();
  if (!client) return null;

  const model = input.model || process.env.ROLE_ROOM_AD_CREATIVES_MODEL || DEFAULT_MODEL;
  const systemPrompt = buildAdSystemPrompt(platform);
  const userMessage = buildAdUserMessage(context, platform, goal);

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // System prompt is stable per platform — caching cuts recurring
          // input tokens when the producer regenerates / tries other goals.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    logAIUsage(response, { feature: 'role-room/ad-creatives' }).catch(() => undefined);

    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    const parsed = parseAdCreativeJson(text, platform, goal);
    if (!parsed) {
      console.error('[ad-creatives] failed to parse Claude response', text.slice(0, 500));
      return null;
    }

    const u = response?.usage ?? {};
    const inputTokens = Number(u.input_tokens) || 0;
    const outputTokens = Number(u.output_tokens) || 0;
    const cacheReadInputTokens = Number(u.cache_read_input_tokens) || 0;
    const cacheCreationInputTokens = Number(u.cache_creation_input_tokens) || 0;
    const usage: GeneratedAdCreativeUsage = {
      inputTokens,
      outputTokens,
      cacheReadInputTokens: cacheReadInputTokens || undefined,
      cacheCreationInputTokens: cacheCreationInputTokens || undefined,
      costNok: computeClaudeCostNok(model, inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens),
    };
    return {
      ...parsed,
      landingUrl: context.landingUrl ?? null,
      generatedWithModel: model,
      usage,
    };
  } catch (error) {
    console.error('[ad-creatives] Claude request failed', error);
    return null;
  }
}
