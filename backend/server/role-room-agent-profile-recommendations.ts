/**
 * role-room-agent-profile-recommendations.ts
 *
 * Genererer plattform-spesifikke bio/cover/CTA-anbefalinger via Claude:
 *   - Facebook Page About (255 char)
 *   - Instagram Bio (150 char)
 *   - LinkedIn Company About (2000 char, struktur: hook + what + why + CTA)
 *   - TikTok Bio (80 char)
 *   - Link-in-bio liste (3-5 prioriterte links)
 *   - Anbefalt brand-username
 *   - Profile-picture + cover-image briefs
 *   - Hashtag-sett per plattform
 *
 * Input: bootstrap (samme shape som marketing-plan-engine bruker) + en
 * valgfri eksisterende MarketingPlanStrategy. Output: ProfileRecommendations.
 *
 * Cost: ~3000 tokens output med Sonnet 4.5 + ephemeral cache på system-
 * prompten → ca. 0.50 NOK per generering etter første call på en pillar.
 */

import { logAIUsage } from './ai-usage-tracker.js';

export interface ProfileRecBootstrap {
  companyName: string;
  industry: string;
  subIndustry?: string;
  positioning?: {
    valueProp?: string;
    differentiator?: string;
  };
  toneOfVoice?: {
    voice?: string;
    dos?: string[];
    donts?: string[];
  };
  targetAudience?: string[];
  offerings?: string[];
  primaryWebsite?: string;
  primaryPhone?: string;
  primaryLocation?: string;
  contentPillars?: Array<{ name: string; description: string }>;
  /** Hint to Claude — Norwegian or English. Defaults to detect-from-bootstrap. */
  language?: 'nb' | 'en';
}

export interface ProfileRecLink {
  label: string;
  url: string;
  reasoning: string;
}

export interface ProfileRecPlatform {
  bio: string;
  /** Char-count Claude computed. Sanity-check vs platform-limit. */
  charCount: number;
  /** Hashtags relevant for the platform (FB max 3, IG 8-15, TikTok 3-5). */
  recommendedHashtags: string[];
  /** Description for the producer of what should be in the cover image. */
  coverBrief: string;
}

export interface ProfileRecommendations {
  platforms: {
    facebook: ProfileRecPlatform & {
      ctaType: string;
      ctaLink: string;
      ctaReasoning: string;
    };
    instagram: ProfileRecPlatform & {
      linkInBio: ProfileRecLink[];
    };
    linkedin: ProfileRecPlatform & {
      tagline: string;
    };
    tiktok: ProfileRecPlatform;
  };
  brand: {
    recommendedUsername: string;
    usernameReasoning: string;
    profilePictureBrief: string;
    primaryColorHex: string;
    voiceSummary: string;
  };
  reasoning: string;
  generatedWithModel: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    costNok: number | null;
  };
}

// Platform character limits — used in prompt + post-validation.
const LIMITS = {
  facebook: 255,
  instagram: 150,
  linkedin: 2000,
  tiktok: 80,
};

const DEFAULT_MODEL = 'claude-sonnet-4-5';

function computeCostNok(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheRead = 0,
  cacheCreation = 0,
): number | null {
  const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1.00 },
  };
  const p = PRICING[model];
  if (!p) return null;
  const usd =
    (inputTokens * p.input) / 1_000_000 +
    (outputTokens * p.output) / 1_000_000 +
    (cacheRead * p.cacheRead) / 1_000_000 +
    (cacheCreation * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 10.5 * 100) / 100;
}

function buildSystemPrompt(): string {
  return [
    'You are The Role Room brand & SoMe-strategist.',
    'Your job: given a company\'s positioning + voice + audience, produce',
    'platform-specific profile content the marketer can paste directly into',
    'Facebook, Instagram, LinkedIn, TikTok.',
    '',
    'Output a JSON object — nothing else — matching exactly this TypeScript type:',
    '```',
    'type ProfileRecommendations = {',
    '  platforms: {',
    '    facebook: { bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;',
    '                ctaType: string; ctaLink: string; ctaReasoning: string; };',
    '    instagram: { bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;',
    '                 linkInBio: Array<{label: string; url: string; reasoning: string}>; };',
    '    linkedin: { bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;',
    '                tagline: string; };',
    '    tiktok: { bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string; };',
    '  };',
    '  brand: {',
    '    recommendedUsername: string;     // lowercase, no spaces, available across all 4 platforms',
    '    usernameReasoning: string;',
    '    profilePictureBrief: string;     // what should be IN the picture (must work in 40x40 px circle)',
    '    primaryColorHex: string;         // single brand color hex like "#0ea5e9"',
    '    voiceSummary: string;            // 1-sentence summary of tone',
    '  };',
    '  reasoning: string;                 // 2-4 sentences explaining the positioning choices',
    '};',
    '```',
    '',
    'Hard rules per platform:',
    '- Facebook About: ≤255 chars. Search-friendly. Should answer "what does this business do?"',
    '  in the first 80 chars (preview cutoff). Max 3 hashtags.',
    '- Instagram bio: ≤150 chars (including emoji + line breaks counted by IG as chars).',
    '  Lead with one emoji, end with CTA. 8-15 hashtags MUST go in the recommendedHashtags',
    '  array — NEVER cram hashtags into the 150-char bio itself.',
    '- LinkedIn About: 1500-2000 chars. Structure: hook (1 line) → what you do (2 paragraphs)',
    '  → why it matters / proof (1 paragraph) → CTA (1 line). Search-optimized. No hashtags in bio.',
    '- TikTok bio: ≤80 chars. One emoji, one sentence, one CTA. 3-5 trending hashtags in',
    '  recommendedHashtags.',
    '',
    'Hard rules for cross-platform consistency:',
    '- Same brand voice across all 4. Use the toneOfVoice from input as ground truth.',
    '- Same primary value-prop, just adapted to platform tone (more formal on LinkedIn,',
    '  punchier on TikTok).',
    '- recommendedUsername must work as one handle that\'s plausible on all 4. No special',
    '  chars except underscore. 15 chars max for IG.',
    '- coverBrief is a description for a designer, not the design itself. Include intended',
    '  message, suggested elements, and aspect ratio note (FB 1640×856, IG no cover,',
    '  LinkedIn 1128×191, TikTok no cover).',
    '- profilePictureBrief: what to put in the picture so it\'s recognizable at 40×40 px.',
    '- ctaType MUST be one of: BOOK_NOW, CALL_NOW, CONTACT_US, LEARN_MORE, MESSAGE_PAGE,',
    '  SHOP_NOW, SIGN_UP, USE_APP, WATCH_NOW. Match to current stage of business.',
    '- linkInBio: 3-5 entries, ordered by priority. Each has clear label + reasoning.',
    '',
    'Output language: match the language of the input bootstrap. If companyName/positioning',
    'is in Norwegian, output all bios + reasoning in Norwegian (bokmål). Otherwise English.',
    '',
    'Return ONLY the JSON object. No markdown, no prose, no backticks.',
  ].join('\n');
}

function buildUserMessage(bootstrap: ProfileRecBootstrap): string {
  const lines: string[] = [];
  lines.push(`# Company: ${bootstrap.companyName}`);
  lines.push(`Industry: ${bootstrap.industry}${bootstrap.subIndustry ? ` / ${bootstrap.subIndustry}` : ''}`);
  if (bootstrap.primaryLocation) lines.push(`Location: ${bootstrap.primaryLocation}`);
  if (bootstrap.primaryWebsite) lines.push(`Website: ${bootstrap.primaryWebsite}`);
  if (bootstrap.primaryPhone) lines.push(`Phone: ${bootstrap.primaryPhone}`);

  if (bootstrap.positioning) {
    lines.push('');
    lines.push('## Positioning');
    if (bootstrap.positioning.valueProp) lines.push(`Value prop: ${bootstrap.positioning.valueProp}`);
    if (bootstrap.positioning.differentiator) lines.push(`Differentiator: ${bootstrap.positioning.differentiator}`);
  }

  if (bootstrap.toneOfVoice) {
    lines.push('');
    lines.push('## Tone of voice');
    if (bootstrap.toneOfVoice.voice) lines.push(`Voice: ${bootstrap.toneOfVoice.voice}`);
    if (bootstrap.toneOfVoice.dos?.length) lines.push(`Do: ${bootstrap.toneOfVoice.dos.map((d) => `"${d}"`).join(', ')}`);
    if (bootstrap.toneOfVoice.donts?.length) lines.push(`Don't: ${bootstrap.toneOfVoice.donts.map((d) => `"${d}"`).join(', ')}`);
  }

  if (bootstrap.targetAudience?.length) {
    lines.push('');
    lines.push(`## Target audience: ${bootstrap.targetAudience.join(', ')}`);
  }

  if (bootstrap.offerings?.length) {
    lines.push('');
    lines.push(`## Offerings: ${bootstrap.offerings.join(', ')}`);
  }

  if (bootstrap.contentPillars?.length) {
    lines.push('');
    lines.push('## Content pillars');
    for (const p of bootstrap.contentPillars) {
      lines.push(`- ${p.name}: ${p.description}`);
    }
  }

  if (bootstrap.language) {
    lines.push('');
    lines.push(`## Output language: ${bootstrap.language === 'nb' ? 'Norwegian bokmål' : 'English'}`);
  }

  return lines.join('\n');
}

function parseJson(raw: string): ProfileRecommendations | null {
  let text = raw.trim();
  // Strip markdown fences if Claude regressed.
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed.platforms || !parsed.brand) return null;
    return parsed as ProfileRecommendations;
  } catch {
    return null;
  }
}

/**
 * Default bootstrap for "The Role Room" itself — used for the Marketing
 * Cockpit's "Generate bio-pakke for The Role Room"-button so the producer
 * doesn't have to fill out the form for the brand-Page demo.
 */
export const THEROLERROOM_BOOTSTRAP: ProfileRecBootstrap = {
  companyName: 'The Role Room',
  industry: 'B2B SaaS',
  subIndustry: 'Casting & produksjonsstyring',
  primaryWebsite: 'https://theroleroom.com',
  primaryLocation: 'Norge',
  language: 'nb',
  positioning: {
    valueProp:
      'Casting- og produksjonsplattformen for det norske film/TV/teater-miljøet — fra rolleliste til ' +
      'opptaksdag i én flate.',
    differentiator:
      'Mens andre verktøy splitter casting, crew, budsjett og kommunikasjon i 4–6 separate appene, ' +
      'samler The Role Room hele produksjonen i én flyt med innebygd kasting-pipeline (7 statuser), ' +
      'crew-sync mot opptaksdager, storyboard, budsjettstyring og signerte kontrakter.',
  },
  toneOfVoice: {
    voice: 'Profesjonell håndverker som snakker som en kollega — kort, presist, uten markedsføringssvada.',
    dos: ['Bruk konkrete eksempler', 'Snakk om opptaksdager, kasting-pipeline, sluttkjøring', 'Be direkte om feedback'],
    donts: ['Buzzwords ("game-changer", "next-gen")', 'Hype uten konkretiseringer', 'Generiske selger-fraser'],
  },
  targetAudience: [
    'Casting directors i Norge',
    'Produksjonsteam (1–10 personer)',
    'Filmskolestudenter på 2.–3. året',
    'Frilans skuespillere som bygger CV',
  ],
  offerings: [
    'Casting-pipeline (roller, kandidater, 7-status kanban)',
    'Crew & lokasjoner synket mot opptaksdager',
    'Storyboard + shotlist per scene',
    'Budsjett (kategori-grupper, avvik, cashflow)',
    'Kontrakter (e-signering, prefylt fra prosjekt-data)',
    'Talentportal for skuespillere',
  ],
  contentPillars: [
    {
      name: 'Produksjonshåndverk',
      description: 'Tips fra casting-directors og produsenter — konkret prosess, ikke teori.',
    },
    {
      name: 'Talent-skuespillere',
      description: 'Spotlight på norske skuespillere — fra audition til opptak.',
    },
    {
      name: 'Bransje-pulse',
      description: 'Norsk film/TV/teater-industri i kontekst — hva skjer, hvem caster, hvilke trender.',
    },
  ],
};

export async function generateProfileRecommendations(
  bootstrap: ProfileRecBootstrap,
  options?: { model?: string },
): Promise<ProfileRecommendations | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[profile-recs] ANTHROPIC_API_KEY missing');
    return null;
  }
  const model = options?.model || process.env.ROLE_ROOM_PROFILE_RECS_MODEL || DEFAULT_MODEL;

  let client: { messages: { create: Function } };
  try {
    // @ts-ignore
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (error) {
    console.error('[profile-recs] @anthropic-ai/sdk not available', error);
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(bootstrap);

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // System prompt is stable → cache it (10× cheaper on repeat calls).
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    logAIUsage(response, { feature: 'role-room/profile-recommendations' }).catch(() => undefined);

    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    const parsed = parseJson(text);
    if (!parsed) {
      console.error('[profile-recs] failed to parse Claude response', text.slice(0, 500));
      return null;
    }

    // Validate platform char-limits — clip + warn but don't fail.
    const limits: Array<[keyof typeof LIMITS, ProfileRecPlatform]> = [
      ['facebook', parsed.platforms.facebook],
      ['instagram', parsed.platforms.instagram],
      ['linkedin', parsed.platforms.linkedin],
      ['tiktok', parsed.platforms.tiktok],
    ];
    for (const [platform, p] of limits) {
      const max = LIMITS[platform];
      if (p.bio && p.bio.length > max) {
        console.warn(`[profile-recs] ${platform} bio over limit: ${p.bio.length}/${max} chars — clipping`);
        p.bio = p.bio.slice(0, max);
      }
      p.charCount = p.bio.length;
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
    console.error('[profile-recs] Claude call failed', error);
    return null;
  }
}
