/**
 * Social-strategy cache for the feed-planner AI recommendations.
 *
 * Design goal: automatic + stable.
 *
 *  - Recommendation requests read a cached per-platform "strategy summary"
 *    (algorithm priorities, posting times, caption structure, hashtags,
 *    recent changes) — synchronous, fast, deterministic.
 *
 *  - A refresh job rebuilds the cache using Claude with web_search tool
 *    enabled. Runs opportunistically: if the cache is past its validity
 *    when a recommendation is requested, a refresh fires in the background
 *    and the current (stale) cache serves the request. No cron required;
 *    the first user of the day triggers the refresh.
 *
 *  - Seed defaults are shipped in this file so the system works the very
 *    first time before any refresh has completed.
 */

import type { Pool } from 'pg';

export type RoleRoomFeedStrategyPlatform = 'instagram' | 'tiktok' | 'linkedin' | 'facebook';

export interface RoleRoomFeedStrategySummary {
  algorithmPriorities: string[];
  captionStructure: string[];
  hashtagGuidance: string;
  postingWindows: Array<{
    audience: string;
    bestWindows: string[]; // e.g., "tir 19–21", "tor 07–09"
  }>;
  recentChanges: string[];
  generatedAt: string;
}

export interface RoleRoomFeedStrategyRow {
  platform: RoleRoomFeedStrategyPlatform;
  summary: RoleRoomFeedStrategySummary;
  sourceUrls: string[];
  refreshedAt: Date;
  validUntil: Date;
  status: 'fresh' | 'stale' | 'failed' | 'seed';
  lastError: string | null;
}

const SEED_DEFAULTS: Record<RoleRoomFeedStrategyPlatform, RoleRoomFeedStrategySummary> = {
  instagram: {
    algorithmPriorities: [
      'Retensjon (watch-time og gjennomføringsgrad) er sterkeste signal for Reels.',
      'Deling og lagring teller mer enn likes for feed-rangering.',
      'Korte kommentarer og DM-svar løfter rekkevidde de første 60 min.',
      'Konsistens (3–5 innlegg/uke) gir bedre distribusjon enn volum-pushes.',
    ],
    captionStructure: [
      'Hook på første linje (7–12 ord, konkret løfte eller overraskelse).',
      'Kjernebudskap 2–4 korte avsnitt, med linjeskift for lesbarhet.',
      'Avslutt med én tydelig CTA — spørsmål, lenkeguide eller DM-oppfordring.',
    ],
    hashtagGuidance:
      '5–12 hashtags, bland 1–2 brede (brand/by), 3–5 nisje (bransje/målgruppe), 2–4 lange "long tail". Unngå bannede og generiske (#love).',
    postingWindows: [
      { audience: 'B2C norsk forbruker', bestWindows: ['tir 19–21', 'tor 19–21', 'søn 11–13'] },
      { audience: 'B2B / profesjonell', bestWindows: ['tir 07–09', 'ons 12–13', 'tor 07–09'] },
      { audience: 'Lokal handel / servering', bestWindows: ['fre 16–18', 'lør 10–12', 'søn 17–19'] },
    ],
    recentChanges: [
      'Reels under 30 sekunder prioriteres; karusell-innlegg med 7+ slides gir høy retensjon.',
      'Originalt innhold (ikke gjenbrukt fra TikTok med vannmerke) får distribusjonsløft.',
    ],
    generatedAt: new Date().toISOString(),
  },
  tiktok: {
    algorithmPriorities: [
      'Watch-time og loops er viktigste signal; "stikk" slutten til starten.',
      'Sterk hook i første 2 sekunder kritisk — ellers swipe.',
      'Kommentar-engasjement og deling vekter mer enn likes.',
      'Native lyd / trending sounds hjelper, men kun hvis det passer brandet.',
    ],
    captionStructure: [
      'Kort caption (50–90 tegn) med én krok — tekst på selve videoen gjør mer jobb.',
      'Avslutt med åpent spørsmål eller "følg for mer [spesifikk verdi]".',
    ],
    hashtagGuidance:
      '3–6 hashtags: 1 bred (#nordmenn, #norge), 2–3 nisje (bransje + produkt), 1–2 trend om relevant. Ikke bruk #fyp — det teller ikke lenger.',
    postingWindows: [
      { audience: 'Gen Z / UGC', bestWindows: ['tir 19–22', 'tor 19–22', 'søn 14–17'] },
      { audience: 'Bredere 25–45', bestWindows: ['ons 17–19', 'fre 17–20', 'søn 11–13'] },
    ],
    recentChanges: [
      'Carousel-posts (bilder) får distribusjon igjen — en fin måte for brand-feeds på TikTok.',
      'Lenker i bio krever minst 1000 følgere; bruk TikTok-shop for e-com.',
    ],
    generatedAt: new Date().toISOString(),
  },
  linkedin: {
    algorithmPriorities: [
      'Kommentarer fra andre enn forfatter teller mer enn likes.',
      'Dvelings-tid (leses hele posten?) er primært ranking-signal.',
      'Originalt tekst-innhold uten eksterne lenker får mest løft; legg lenke i kommentar.',
      'Karusell/PDF-dokument får høyest organisk rekkevidde av alle formater.',
    ],
    captionStructure: [
      'Hook + "se mer"-linje — første 3 linjer må tvinge klikk.',
      'Bygg som en mini-artikkel: 3–5 avsnitt, hver linje bær ett poeng.',
      'Avslutt med én åpen spørsmål-CTA som inviterer erfaringsdeling.',
    ],
    hashtagGuidance:
      '3–5 hashtags, profesjonelle og bransjerelevante. Ikke over 5 — det vekter ned.',
    postingWindows: [
      { audience: 'B2B beslutningstaker', bestWindows: ['tir 07–09', 'ons 07–09', 'tor 07–09'] },
      { audience: 'Fag/håndverk', bestWindows: ['tir 11–13', 'tor 11–13'] },
    ],
    recentChanges: [
      'LinkedIn Collaborative Articles kan gi eksperts-badge — vurder deltakelse.',
      'Videoinnlegg under 90 sek prioriteres på feed siden Q1.',
    ],
    generatedAt: new Date().toISOString(),
  },
  // Facebook seed — Feed Planner 2.0 Fase A. Replaces det meste fra IG-
  // logikken, men FB Page-feeden vekter delinger og lenge-kommentarer
  // tyngre, og favoriserer link-posts og lange video-formater.
  facebook: {
    algorithmPriorities: [
      'Meaningful interactions (kommentarer 3+ ord, deling med kontekst) er sterkeste signal.',
      'Video over 1 minutt med høy retention får løft i Watch-feeden.',
      'Reels deler distribusjons-modell med IG — kort, hook-først, høy gjennomføring.',
      'Pages med stabil 3–5 posts/uke beholder organisk rekkevidde bedre enn burst-publisering.',
    ],
    captionStructure: [
      'Hook + utdypning på 2–4 setninger; FB tåler lengre tekst enn IG.',
      'Inkluder 1–2 spørsmål eller debatt-prompts for å trigge kommentar-tråder.',
      'Avslutt med tydelig CTA — "del om du kjenner noen som…" eller link-i-kommentar.',
    ],
    hashtagGuidance:
      '0–3 hashtags på FB; #brand + #lokasjon er det meste folk ser etter. Ikke kopier IG-hashtag-strategi rett over.',
    postingWindows: [
      { audience: 'B2C bredt', bestWindows: ['tir 13–15', 'tor 13–15', 'søn 12–14'] },
      { audience: 'Lokal handel / servering', bestWindows: ['fre 16–18', 'lør 10–12'] },
    ],
    recentChanges: [
      'FB Reels-monetisering rullet ut til flere markeder; cross-posting fra IG fungerer.',
      'Page-mentions (@[PAGE_ID]) gir ekstra rekkevidde når den nevnte siden samhandler.',
    ],
    generatedAt: new Date().toISOString(),
  },
};

function mapRow(row: Record<string, unknown>): RoleRoomFeedStrategyRow {
  return {
    platform: row.platform as RoleRoomFeedStrategyPlatform,
    summary: row.summary as RoleRoomFeedStrategySummary,
    sourceUrls: Array.isArray(row.source_urls) ? (row.source_urls as string[]) : [],
    refreshedAt: row.refreshed_at as Date,
    validUntil: row.valid_until as Date,
    status: (row.status as RoleRoomFeedStrategyRow['status']) ?? 'seed',
    lastError: (row.last_error as string | null) ?? null,
  };
}

export function seedStrategyFor(platform: RoleRoomFeedStrategyPlatform): RoleRoomFeedStrategyRow {
  return {
    platform,
    summary: SEED_DEFAULTS[platform],
    sourceUrls: [],
    refreshedAt: new Date(),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'seed',
    lastError: null,
  };
}

export async function loadStrategy(
  pool: Pool,
  platform: RoleRoomFeedStrategyPlatform,
): Promise<RoleRoomFeedStrategyRow> {
  try {
    const result = await pool.query(
      `SELECT platform, summary, source_urls, refreshed_at, valid_until, status, last_error
         FROM role_room_feed_strategy_cache
        WHERE platform = $1
        LIMIT 1`,
      [platform],
    );
    if (result.rows[0]) {
      return mapRow(result.rows[0]);
    }
  } catch (error) {
    console.error('[role-room-feed-strategy] loadStrategy failed', error);
  }
  return seedStrategyFor(platform);
}

export async function upsertStrategy(
  pool: Pool,
  platform: RoleRoomFeedStrategyPlatform,
  summary: RoleRoomFeedStrategySummary,
  sourceUrls: string[],
  options: { validHours?: number; refreshedBy?: string | null } = {},
): Promise<void> {
  const validHours = options.validHours ?? 24;
  try {
    await pool.query(
      `INSERT INTO role_room_feed_strategy_cache
         (platform, summary, source_urls, refreshed_at, valid_until, status, last_error, refreshed_by)
       VALUES ($1, $2::jsonb, $3::jsonb, now(), now() + ($4::int * interval '1 hour'), 'fresh', NULL, $5)
       ON CONFLICT (platform) DO UPDATE SET
         summary = EXCLUDED.summary,
         source_urls = EXCLUDED.source_urls,
         refreshed_at = now(),
         valid_until = EXCLUDED.valid_until,
         status = 'fresh',
         last_error = NULL,
         refreshed_by = EXCLUDED.refreshed_by`,
      [platform, JSON.stringify(summary), JSON.stringify(sourceUrls), validHours, options.refreshedBy ?? null],
    );
  } catch (error) {
    console.error('[role-room-feed-strategy] upsertStrategy failed', error);
  }
}

export async function markStrategyFailed(
  pool: Pool,
  platform: RoleRoomFeedStrategyPlatform,
  reason: string,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE role_room_feed_strategy_cache
          SET status = 'failed', last_error = $2
        WHERE platform = $1`,
      [platform, reason.slice(0, 500)],
    );
  } catch (error) {
    console.error('[role-room-feed-strategy] markStrategyFailed failed', error);
  }
}

export function isStale(row: RoleRoomFeedStrategyRow): boolean {
  return row.status === 'seed' || row.validUntil.getTime() < Date.now();
}

/**
 * Call Claude with web_search tool to produce a fresh platform strategy
 * summary. Returns null if Claude is not configured or the call fails —
 * callers should fall back to the existing cache/seed.
 */
export async function refreshStrategyWithClaude(
  platform: RoleRoomFeedStrategyPlatform,
): Promise<{ summary: RoleRoomFeedStrategySummary; sourceUrls: string[] } | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== 'true' || !process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  // Lazy import so this file has no hard dep on the SDK.
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch {
    return null;
  }

  const platformSources: Record<RoleRoomFeedStrategyPlatform, string[]> = {
    instagram: [
      'https://about.instagram.com/blog',
      'https://creators.instagram.com/blog',
      'https://business.instagram.com/blog',
    ],
    tiktok: [
      'https://newsroom.tiktok.com/en-us',
      'https://www.tiktok.com/business/en/blog',
    ],
    linkedin: [
      'https://www.linkedin.com/business/marketing/blog',
      'https://www.linkedin.com/pulse/topics/marketing-s1146',
    ],
    facebook: [
      'https://www.facebook.com/business/news',
      'https://www.facebook.com/business/insights',
      'https://about.fb.com/news/',
    ],
  };

  const prompt = `Du er en norsk sosial-strateg. Lag en kort, handlingsrettet oppsummering av hvordan ${platform.toUpperCase()} fungerer akkurat nå.

Fokus:
- Algoritme-prioriteringer (hvilke signaler teller mest)
- Caption-struktur (hook, kjernebudskap, CTA)
- Hashtag-veiledning (antall, type)
- Beste posteringstidspunkter for ulike norske målgrupper (B2C, B2B, lokal handel)
- Nylige endringer (siste 90 dager)

Bruk web_search for å hente ferske kilder fra plattformens egne kanaler. Foreslåtte startpunkter: ${platformSources[platform].join(', ')}.

Svar KUN med gyldig JSON på dette skjemaet, ingen markdown:
{
  "algorithmPriorities": ["string", ...],
  "captionStructure": ["string", ...],
  "hashtagGuidance": "string",
  "postingWindows": [
    { "audience": "string", "bestWindows": ["tir 19–21", ...] }
  ],
  "recentChanges": ["string", ...],
  "sourceUrls": ["https://...", ...]
}`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        },
      ],
    });

    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      return null;
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    const summary: RoleRoomFeedStrategySummary = {
      algorithmPriorities: Array.isArray(parsed.algorithmPriorities)
        ? parsed.algorithmPriorities.filter((s: unknown) => typeof s === 'string')
        : [],
      captionStructure: Array.isArray(parsed.captionStructure)
        ? parsed.captionStructure.filter((s: unknown) => typeof s === 'string')
        : [],
      hashtagGuidance: typeof parsed.hashtagGuidance === 'string' ? parsed.hashtagGuidance : '',
      postingWindows: Array.isArray(parsed.postingWindows)
        ? parsed.postingWindows
            .filter(
              (entry: unknown): entry is { audience: string; bestWindows: string[] } =>
                Boolean(entry && typeof entry === 'object' && 'audience' in entry),
            )
            .map((entry: any) => ({
              audience: String(entry.audience),
              bestWindows: Array.isArray(entry.bestWindows) ? entry.bestWindows.map(String) : [],
            }))
        : [],
      recentChanges: Array.isArray(parsed.recentChanges)
        ? parsed.recentChanges.filter((s: unknown) => typeof s === 'string')
        : [],
      generatedAt: new Date().toISOString(),
    };

    const sourceUrls = Array.isArray(parsed.sourceUrls)
      ? parsed.sourceUrls.filter((s: unknown) => typeof s === 'string')
      : [];

    return { summary, sourceUrls };
  } catch (error) {
    console.error('[role-room-feed-strategy] Claude refresh failed', error);
    return null;
  }
}

/**
 * Non-blocking refresh trigger. Fires if the current row is stale and a
 * refresh isn't already in progress for this platform.
 */
const activeRefreshes = new Set<string>();
export function triggerBackgroundRefresh(pool: Pool, platform: RoleRoomFeedStrategyPlatform): void {
  if (activeRefreshes.has(platform)) return;
  activeRefreshes.add(platform);
  void (async () => {
    try {
      const result = await refreshStrategyWithClaude(platform);
      if (result) {
        await upsertStrategy(pool, platform, result.summary, result.sourceUrls, {
          refreshedBy: 'background_refresh',
        });
      } else {
        await markStrategyFailed(pool, platform, 'Claude refresh skipped or returned no JSON.');
      }
    } catch (error) {
      await markStrategyFailed(pool, platform, error instanceof Error ? error.message : 'unknown');
    } finally {
      activeRefreshes.delete(platform);
    }
  })();
}
