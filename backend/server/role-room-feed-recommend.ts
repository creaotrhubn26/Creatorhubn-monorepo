/**
 * AI caption / timing recommendations for the feed planner.
 *
 * Consumes the cached strategy summary (see role-room-feed-strategy.ts)
 * plus the bootstrap brand context and returns one post-level suggestion.
 *
 * Design: strategy cache is read synchronously and injected into the
 * system prompt. This keeps the user-facing latency stable (no web_search
 * during the request) while still reflecting current algorithm knowledge
 * via the nightly refresh loop.
 */

import crypto from 'crypto';
import type { Pool } from 'pg';
import type { RoleRoomFeedPostInput } from './role-room-feed-plan.js';
import {
  type RoleRoomFeedStrategyPlatform,
  loadStrategy,
  isStale,
  triggerBackgroundRefresh,
} from './role-room-feed-strategy.js';
import {
  buildCacheKey,
  hashContext,
  lookupCachedResponse,
  storeCachedResponse,
} from './role-room-agent-cache.js';
import { appendMessage, createThread } from './role-room-agent-threads.js';

const FEED_THREAD_TITLE_PREFIX = 'feed-planner:';
const FEED_THREAD_HISTORY_LIMIT = 8;

interface FeedThreadHistoryEntry {
  role: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}

interface FeedThreadHandle {
  threadId: string;
  history: FeedThreadHistoryEntry[];
  hash: string;
}

async function findOrCreateFeedThread(
  pool: Pool,
  projectId: string,
  userId: string,
  platform: RoleRoomFeedStrategyPlatform,
): Promise<FeedThreadHandle | null> {
  const title = `${FEED_THREAD_TITLE_PREFIX}${platform}`;
  try {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM role_room_agent_threads
        WHERE project_id = $1 AND user_id = $2 AND title = $3 AND archived_at IS NULL
        ORDER BY last_active_at DESC NULLS LAST
        LIMIT 1`,
      [projectId, userId, title],
    );
    let threadId: string | null = existing.rows[0]?.id ?? null;
    if (!threadId) {
      const created = await createThread(pool, projectId, userId, title);
      threadId = created?.id ?? null;
    }
    if (!threadId) return null;
    const resolvedThreadId: string = threadId;

    const messagesResult = await pool.query<{ role: string; text: string; created_at: Date }>(
      `SELECT role, text, created_at
         FROM role_room_agent_messages
        WHERE thread_id = $1 AND role IN ('user', 'assistant')
        ORDER BY created_at DESC
        LIMIT $2`,
      [resolvedThreadId, FEED_THREAD_HISTORY_LIMIT],
    );
    const history = messagesResult.rows
      .reverse()
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        text: row.text || '',
        createdAt: row.created_at,
      }));
    const hashSource = history.map((entry) => `${entry.role}:${entry.text.length}`).join('|');
    const hash = crypto.createHash('sha256').update(hashSource).digest('hex').slice(0, 16);
    return { threadId: resolvedThreadId, history, hash };
  } catch (error) {
    console.error('[role-room-feed-recommend] thread setup failed', error);
    return null;
  }
}

export interface RoleRoomFeedRecommendation {
  caption: string;
  hashtags: string[];
  callToAction: string;
  scheduledFor: string | null;
  strategyNotes: string;
  bestTimeRationale: string;
  strategyFreshness: 'fresh' | 'stale' | 'seed' | 'failed';
  refreshedAt: string | null;
  visionUsed: boolean;
  imageObservations?: string | null;
}

export interface RoleRoomFeedRecommendInput {
  platform: RoleRoomFeedStrategyPlatform;
  post: Pick<
    RoleRoomFeedPostInput,
    'concept' | 'title' | 'caption' | 'callToAction' | 'hashtags' | 'mediaType'
  > & { customImageUrl?: string | null };
  brand: {
    companyName?: string | null;
    industry?: string | null;
    subIndustry?: string | null;
    businessModel?: string | null;
    targetAudience?: string[];
    offerings?: string[];
    toneOfVoice?: string | null;
    visualStyle?: string | null;
    keyMessage?: string | null;
    dos?: string[];
    donts?: string[];
  };
  scheduleHint?: string | null;
}

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

function formatList(items: string[] | undefined, bullet = '•'): string {
  if (!items || items.length === 0) return '(ingen)';
  return items.map((entry) => `${bullet} ${entry}`).join('\n');
}

function buildSystemPrompt(
  strategy: Awaited<ReturnType<typeof loadStrategy>>,
  platform: RoleRoomFeedStrategyPlatform,
  hasImage: boolean,
): string {
  const s = strategy.summary;
  const freshnessNote =
    strategy.status === 'fresh'
      ? `Oppdatert ${strategy.refreshedAt.toISOString().slice(0, 10)}`
      : strategy.status === 'seed'
        ? 'Utgangs-heuristikk — webkilder ikke hentet ennå'
        : `Sist oppdatert ${strategy.refreshedAt.toISOString().slice(0, 10)} (status: ${strategy.status})`;

  const windows = s.postingWindows
    .map((window) => `  - ${window.audience}: ${window.bestWindows.join(', ')}`)
    .join('\n');

  return [
    `Du er en spesialisert norsk sosial-medier-strateg for ${platform.toUpperCase()}.`,
    '',
    'Ansvarsområde:',
    '- Lag caption på norsk (bokmål som standard) i riktig tone for merket.',
    hasImage
      ? '- Bruk bildet som er vedlagt: beskriv det som faktisk er synlig, og flett detaljene naturlig inn i hook og kjernebudskap.'
      : '- Jobb fra tekst-konteksten (bildet er en stylet placeholder, ikke ekte foto).',
    '- Foreslå realistisk publiseringstidspunkt basert på målgruppen.',
    '- Begrunn valget kort.',
    `- Hold fokus KUN på denne fasen — ikke blande inn andre deler av kundeprosessen.`,
    '',
    `Gjeldende plattform-strategi (${freshnessNote}):`,
    '',
    'Algoritme-prioriteringer:',
    formatList(s.algorithmPriorities),
    '',
    'Caption-struktur:',
    formatList(s.captionStructure),
    '',
    `Hashtag-veiledning: ${s.hashtagGuidance || '(ingen spesifikk)'}`,
    '',
    'Beste posteringstidspunkter:',
    windows || '  (ingen data)',
    '',
    'Nylige endringer:',
    formatList(s.recentChanges),
    '',
    'Svar KUN med gyldig JSON (ingen markdown-kodeblokk) på dette skjemaet:',
    '{',
    '  "caption": "Hele captionen klar til publisering (norsk)",',
    '  "hashtags": ["#eksempel", ...],',
    '  "callToAction": "Kort CTA",',
    '  "scheduledFor": "ISO-8601 (UTC) eller null",',
    '  "strategyNotes": "Kort: hvorfor denne captionen passer algoritmen",',
    '  "bestTimeRationale": "Kort: hvorfor dette tidspunktet",',
    hasImage
      ? '  "imageObservations": "Kort objektiv beskrivelse av bildet (maks 2 setninger)"'
      : '  "imageObservations": null',
    '}',
  ].join('\n');
}

function buildUserMessage(input: RoleRoomFeedRecommendInput): string {
  return [
    `Post-konsept: ${input.post.concept}`,
    `Medietype: ${input.post.mediaType ?? 'image'}`,
    `Nåværende tittel (utkast): ${input.post.title || '(tom)'}`,
    `Nåværende caption (utkast): ${input.post.caption || '(tom)'}`,
    `Nåværende CTA (utkast): ${input.post.callToAction || '(tom)'}`,
    '',
    'Merke-kontekst:',
    `- Navn: ${input.brand.companyName || '(ukjent)'}`,
    `- Bransje: ${input.brand.industry || '(ukjent)'}${input.brand.subIndustry ? ` / ${input.brand.subIndustry}` : ''}`,
    `- Forretningsmodell: ${input.brand.businessModel || '(ukjent)'}`,
    `- Målgruppe: ${(input.brand.targetAudience || []).join(', ') || '(ukjent)'}`,
    `- Tjenester/tilbud: ${(input.brand.offerings || []).join(', ') || '(ukjent)'}`,
    `- Tone: ${input.brand.toneOfVoice || '(ukjent)'}`,
    `- Visuell stil: ${input.brand.visualStyle || '(ukjent)'}`,
    `- Nøkkelbudskap: ${input.brand.keyMessage || '(ukjent)'}`,
    `- Gjør: ${(input.brand.dos || []).join(', ') || '(ingen)'}`,
    `- Unngå: ${(input.brand.donts || []).join(', ') || '(ingen)'}`,
    input.scheduleHint ? `- Ønsket publiseringsvindu (hvis satt): ${input.scheduleHint}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseRecommendationJson(
  text: string,
  fallback: RoleRoomFeedRecommendInput,
): Omit<RoleRoomFeedRecommendation, 'strategyFreshness' | 'refreshedAt' | 'visionUsed'> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return {
      caption: fallback.post.caption || '',
      hashtags: fallback.post.hashtags || [],
      callToAction: fallback.post.callToAction || '',
      scheduledFor: null,
      strategyNotes: '',
      bestTimeRationale: '',
      imageObservations: null,
    };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      caption: typeof parsed.caption === 'string' ? parsed.caption : fallback.post.caption || '',
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags
            .filter((entry: unknown) => typeof entry === 'string')
            .slice(0, 30)
            .map((entry: string) => (entry.startsWith('#') ? entry : `#${entry}`))
        : fallback.post.hashtags || [],
      callToAction:
        typeof parsed.callToAction === 'string' ? parsed.callToAction : fallback.post.callToAction || '',
      scheduledFor: typeof parsed.scheduledFor === 'string' ? parsed.scheduledFor : null,
      strategyNotes: typeof parsed.strategyNotes === 'string' ? parsed.strategyNotes : '',
      bestTimeRationale:
        typeof parsed.bestTimeRationale === 'string' ? parsed.bestTimeRationale : '',
      imageObservations:
        typeof parsed.imageObservations === 'string' ? parsed.imageObservations : null,
    };
  } catch {
    return {
      caption: fallback.post.caption || '',
      hashtags: fallback.post.hashtags || [],
      callToAction: fallback.post.callToAction || '',
      scheduledFor: null,
      strategyNotes: '',
      bestTimeRationale: '',
      imageObservations: null,
    };
  }
}

/** Deterministic heuristic fallback when Claude is disabled or errors. */
function fallbackRecommendation(
  input: RoleRoomFeedRecommendInput,
  strategy: Awaited<ReturnType<typeof loadStrategy>>,
): Omit<RoleRoomFeedRecommendation, 'strategyFreshness' | 'refreshedAt'> {
  const window = strategy.summary.postingWindows[0]?.bestWindows[0] ?? '';
  return {
    caption: input.post.caption || `${input.post.title}\n\n${input.brand.keyMessage ?? ''}`.trim(),
    hashtags: input.post.hashtags || [],
    callToAction: input.post.callToAction || 'Les mer',
    scheduledFor: null,
    strategyNotes: strategy.summary.captionStructure.join(' · '),
    bestTimeRationale: window
      ? `Anbefalt vindu for målgruppen: ${window}.`
      : 'Tidspunkt ikke satt — velg manuelt.',
    visionUsed: false,
    imageObservations: null,
  };
}

/**
 * Short, deterministic fingerprint of the image payload for cache keying.
 * We hash the full data URL — the base64 body alone is sufficient — so two
 * identical uploads produce the same cache key and we skip Claude entirely.
 */
function hashImageForCache(dataUrl: string | null | undefined): string {
  if (!dataUrl) return 'no-image';
  return crypto.createHash('sha256').update(dataUrl).digest('hex').slice(0, 32);
}

export interface RoleRoomFeedRecommendRequest {
  projectId: string;
  userId: string;
  input: RoleRoomFeedRecommendInput;
}

export async function recommendFeedPost(
  pool: Pool,
  request: RoleRoomFeedRecommendRequest,
): Promise<RoleRoomFeedRecommendation & { cached: boolean }> {
  const { projectId, userId, input } = request;
  const strategy = await loadStrategy(pool, input.platform);

  // Opportunistic background refresh if stale — this request still serves
  // from the current cache so latency stays predictable.
  if (isStale(strategy)) {
    triggerBackgroundRefresh(pool, input.platform);
  }

  const imageDataUrl = input.post.customImageUrl ?? null;
  const hasImage = Boolean(imageDataUrl);

  // Cost-besparende: samme prosjekt + samme brand-kontekst + samme bilde +
  // samme strategi-dato → retur fra databasen, ingen Claude-kall. Speiler
  // cachene som allerede er i bruk av The Role Room Agent (24t TTL, SHA-256
  // nøkkel, `role_room_agent_response_cache`). Bildet hashes separat så
  // bytte av bildet ugyldiggjør cachen automatisk.
  // Trådkontekst — beholder samme samtaletråd per (prosjekt, bruker, plattform)
  // så Claude husker tidligere captions og kan unngå repetisjon.
  const thread = await findOrCreateFeedThread(pool, projectId, userId, input.platform);

  const cacheContextHash = hashContext({
    platform: input.platform,
    brand: input.brand,
    strategyDate: strategy.refreshedAt.toISOString().slice(0, 10),
    imageHash: hashImageForCache(imageDataUrl),
    scheduleHint: input.scheduleHint ?? null,
    threadHash: thread?.hash ?? 'no-thread',
  });
  const cacheUserMessage = [
    input.post.concept,
    input.post.title ?? '',
    input.post.caption ?? '',
    input.post.mediaType ?? 'image',
  ].join('::');
  const cacheKey = buildCacheKey(`${projectId}:feed-recommend`, cacheContextHash, cacheUserMessage);

  const cached = await lookupCachedResponse(pool, cacheKey);
  if (cached) {
    const cachedValue = cached.response as RoleRoomFeedRecommendation;
    return {
      ...cachedValue,
      strategyFreshness: strategy.status,
      refreshedAt: strategy.refreshedAt.toISOString(),
      cached: true,
    };
  }

  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== 'true' || !process.env.ANTHROPIC_API_KEY) {
    const fallback = fallbackRecommendation(input, strategy);
    const result: RoleRoomFeedRecommendation = {
      ...fallback,
      strategyFreshness: strategy.status,
      refreshedAt: strategy.refreshedAt.toISOString(),
      visionUsed: false,
      imageObservations: null,
    };
    // Cache heuristic fallback too — cheap win, same TTL.
    await storeCachedResponse(pool, {
      cacheKey,
      projectId,
      userId,
      model: 'heuristic_fallback',
      response: result,
      ttlMinutes: 24 * 60,
    });
    return { ...result, cached: false };
  }

  try {
    // @ts-ignore — optional SDK
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    const client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = buildSystemPrompt(strategy, input.platform, hasImage);
    const userMessageText = buildUserMessage(input);

    // Multimodal message: if bruker har lastet opp bilde fra Drive, sender
    // vi det som vision-input så Claude kan beskrive motivet og flette inn
    // i captionen. Ellers ren tekst-forespørsel.
    let userContent: any;
    const model = process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5';
    if (hasImage && imageDataUrl) {
      const parsed = parseDataUrl(imageDataUrl);
      if (parsed) {
        userContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: parsed.mediaType,
              data: parsed.base64,
            },
          },
          { type: 'text', text: userMessageText },
        ];
      } else {
        userContent = userMessageText;
      }
    } else {
      userContent = userMessageText;
    }

    // Build full message list: previous turns from the platform-specific thread
    // + current ask. Claude treats older messages as context and avoids
    // repeating captions. Vision-bilder fra tidligere turn beholdes ikke
    // (kun aktuelt bilde sendes med) for å holde token-bruken nede.
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
    if (thread?.history?.length) {
      for (const entry of thread.history) {
        messages.push({ role: entry.role, content: entry.text });
      }
    }
    messages.push({ role: 'user', content: userContent });

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }

    const parsed = parseRecommendationJson(text, input);
    const result: RoleRoomFeedRecommendation = {
      ...parsed,
      strategyFreshness: strategy.status,
      refreshedAt: strategy.refreshedAt.toISOString(),
      visionUsed: hasImage && Array.isArray(userContent),
    };

    await storeCachedResponse(pool, {
      cacheKey,
      projectId,
      userId,
      model,
      response: result,
      promptTokens: response.usage?.input_tokens ?? null,
      completionTokens: response.usage?.output_tokens ?? null,
      ttlMinutes: 24 * 60,
    });

    // Persister samtaleturn — neste kall får denne som kontekst.
    // Lagrer kun tekst (ingen bildedata) for å holde tabellen slank og
    // GDPR-tilpasset. Bildet er allerede lagret i feed-planen.
    if (thread) {
      await appendMessage(pool, {
        threadId: thread.threadId,
        role: 'user',
        text: userMessageText,
      });
      await appendMessage(pool, {
        threadId: thread.threadId,
        role: 'assistant',
        text: text.slice(0, 4000),
        response: { type: 'feed_recommend', model, visionUsed: result.visionUsed },
      });
    }

    return { ...result, cached: false };
  } catch (error) {
    console.error('[role-room-feed-recommend] Claude call failed', error);
    const fallback = fallbackRecommendation(input, strategy);
    return {
      ...fallback,
      strategyFreshness: strategy.status,
      refreshedAt: strategy.refreshedAt.toISOString(),
      visionUsed: false,
      imageObservations: null,
      cached: false,
    };
  }
}
