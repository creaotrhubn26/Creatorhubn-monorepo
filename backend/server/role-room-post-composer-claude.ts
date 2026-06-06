/**
 * role-room-post-composer-claude.ts
 *
 * Tar én rapport-insight + en konkret actionableStep og produserer et
 * ferdig-skrevet innlegg for en gitt plattform (FB / IG / LinkedIn / TikTok).
 *
 * Cost: ~0.12 NOK per innlegg med Sonnet 4.5 (kortere output enn rapport).
 */

import { logAIUsage } from './ai-usage-tracker.js';

export interface ComposePostInput {
  brand: {
    name: string;
    industry: string;
    voice?: string;
    positioning?: { valueProp?: string; differentiator?: string };
    contentPillars?: Array<{ name: string; description: string }>;
    website?: string;
  };
  insight: {
    title: string;
    body: string;
    category: 'opportunity' | 'threat' | 'gap' | 'trend';
  };
  actionableStep: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
  language?: 'nb' | 'en';
}

export interface ComposedPost {
  caption: string;
  charCount: number;
  hashtags: string[];
  imageBrief: string;        // Beskrivelse av bilde
  ctaText: string;
  ctaLink: string;
  suggestedPublishTime: string | null;  // ISO 8601, eller null
  generatedWithModel: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    costNok: number | null;
  };
}

const PLATFORM_LIMITS = {
  facebook: 63206,    // Praktisk max — vi targeter 100-500 chars
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
};
const PLATFORM_TARGET_LENGTH = {
  facebook: '150-300',
  instagram: '120-220',
  linkedin: '400-1200',
  tiktok: '80-150',
};

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
    'You are The Role Room social-media copywriter.',
    'Your job: given an insight + a specific action ("publiser X om Y"),',
    'produce a ready-to-post draft for the named platform.',
    '',
    'Output a JSON object — nothing else — matching exactly this TypeScript type:',
    '```',
    'type ComposedPost = {',
    '  caption: string;            // The actual post copy (post-ready)',
    '  charCount: number;          // length of caption',
    '  hashtags: string[];         // Platform-appropriate count + format (#withhash)',
    '  imageBrief: string;         // 1-2 sentences describing the visual to pair with this post',
    '  ctaText: string;            // The action you want the reader to take (Les mer, Book demo, etc.)',
    '  ctaLink: string;            // URL (use brand.website if not specified)',
    '  suggestedPublishTime: string | null;  // ISO 8601 timestamp, or null. Pick based on platform-typical engagement window.',
    '};',
    '```',
    '',
    'Platform-specific rules:',
    '- FACEBOOK Post: 150-300 chars in caption (text-first, but can include 1 image-brief).',
    '  Max 3 hashtags. Direct + conversational. Skip emojis on LinkedIn but use 1-2 on FB.',
    '  Suggest publish time within typical FB-engagement window (Tue-Thu 12-15 CET).',
    '- INSTAGRAM Post: 120-220 chars in caption (hook + 1-2 emoji + value).',
    '  8-15 hashtags as SEPARATE array (NEVER in caption). suggestedPublishTime: Tue-Fri 18-21 CET.',
    '- LINKEDIN: 400-1200 chars. Hook (line 1) → value (2-3 paragraphs) → CTA.',
    '  NO hashtags in caption — use 3-5 in hashtags array. Professional tone, no emoji.',
    '  Suggested time: Tue-Thu 08:00-10:00 CET.',
    '- TIKTOK: 80-150 chars. Punchy hook + 1 emoji. 3-5 trending hashtags.',
    '  Suggested time: weekday evenings 19-22 CET.',
    '',
    'Universal rules:',
    '- The caption must DELIVER on what the actionableStep promised. If step says',
    '  "Publiser om 7-stegs casting-pipeline" — the caption must actually describe',
    '  those 7 steps (or hook with the most surprising one).',
    '- Match the brand voice exactly. If voice says "no buzzwords" — no buzzwords.',
    '- imageBrief: describe the visual at brief level ("Screenshot fra The Role Room',
    '  casting-kanban med 7 statuser, dark UI, casting-direktor i bakgrunn"), not abstract.',
    '- ctaLink: use brand.website unless the actionableStep clearly references a sub-page.',
    '- Output in the same language as the insight + brand voice (Norwegian if brand is Norwegian).',
    '',
    'Return ONLY the JSON object. No markdown, no prose, no backticks.',
  ].join('\n');
}

function buildUserMessage(input: ComposePostInput): string {
  const lines: string[] = [];
  lines.push(`# Brand: ${input.brand.name}`);
  lines.push(`Industry: ${input.brand.industry}`);
  if (input.brand.voice) lines.push(`Voice: ${input.brand.voice}`);
  if (input.brand.positioning?.valueProp) lines.push(`Value prop: ${input.brand.positioning.valueProp}`);
  if (input.brand.positioning?.differentiator) lines.push(`Differentiator: ${input.brand.positioning.differentiator}`);
  if (input.brand.website) lines.push(`Website: ${input.brand.website}`);

  if (input.brand.contentPillars?.length) {
    lines.push('');
    lines.push('## Content pillars (use to ground the post)');
    for (const p of input.brand.contentPillars) lines.push(`- ${p.name}: ${p.description}`);
  }

  lines.push('');
  lines.push(`## Source insight`);
  lines.push(`Category: ${input.insight.category}`);
  lines.push(`Title: ${input.insight.title}`);
  lines.push(`Body: ${input.insight.body}`);

  lines.push('');
  lines.push(`## Action to execute as a post`);
  lines.push(input.actionableStep);

  lines.push('');
  lines.push(`## Target platform: ${input.platform.toUpperCase()}`);
  lines.push(`Target caption length: ${PLATFORM_TARGET_LENGTH[input.platform]} chars`);
  lines.push(`Max caption length (hard): ${PLATFORM_LIMITS[input.platform]}`);

  if (input.language) {
    lines.push('');
    lines.push(`## Output language: ${input.language === 'nb' ? 'Norwegian bokmål' : 'English'}`);
  }

  return lines.join('\n');
}

function parseJson(raw: string): ComposedPost | null {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.caption !== 'string') return null;
    return parsed as ComposedPost;
  } catch {
    return null;
  }
}

export async function composePost(
  input: ComposePostInput,
  options?: { model?: string },
): Promise<ComposedPost | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[post-composer] ANTHROPIC_API_KEY missing');
    return null;
  }
  const model = options?.model || process.env.ROLE_ROOM_POST_COMPOSER_MODEL || DEFAULT_MODEL;

  let client: { messages: { create: Function } };
  try {
    // @ts-ignore
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (error) {
    console.error('[post-composer] @anthropic-ai/sdk not available', error);
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    logAIUsage(response, { feature: 'role-room/post-composer' }).catch(() => undefined);

    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    const parsed = parseJson(text);
    if (!parsed) {
      console.error('[post-composer] failed to parse Claude response', text.slice(0, 500));
      return null;
    }

    // Clip caption if over limit.
    const limit = PLATFORM_LIMITS[input.platform];
    if (parsed.caption.length > limit) {
      parsed.caption = parsed.caption.slice(0, limit);
    }
    parsed.charCount = parsed.caption.length;
    parsed.generatedWithModel = model;

    const usage = response.usage ?? {};
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
    console.error('[post-composer] Claude call failed', error);
    return null;
  }
}
