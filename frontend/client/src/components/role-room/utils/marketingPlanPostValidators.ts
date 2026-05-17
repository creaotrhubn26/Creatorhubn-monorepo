/**
 * Marketing-plan post validators — items #161 (duplikate hooks),
 * #162 (emoji-spam), #171 (beskyttede merkenavn), #172 (platform-policy),
 * #173 (Flesch-NO leselighet).
 *
 * Alle er pure functions. Returnerer flagg per post-id slik at UI kan
 * rendre advarsler inline ved hvert post-kort. Ingen Claude-calls,
 * ingen DB. Validatorene er konservative — vi flagger heller for mye
 * enn for lite, fordi falske positiver er enkle å avvise mens falske
 * negativer ender i en publisert post med problem.
 */

import type { MarketingPlanPost } from '../services/roleRoomAgentService';

export type PostFlagSeverity = 'warning' | 'info';

export interface PostFlag {
  postId: string;
  severity: PostFlagSeverity;
  title: string;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────
// #161 — duplikate hooks
// ─────────────────────────────────────────────────────────────────────
function detectDuplicateHooks(posts: MarketingPlanPost[]): PostFlag[] {
  const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const buckets = new Map<string, string[]>();
  for (const post of posts) {
    if (!post.hook) continue;
    const key = normalize(post.hook).slice(0, 60); // first 60 chars catches near-dupes
    const existing = buckets.get(key) ?? [];
    existing.push(post.id);
    buckets.set(key, existing);
  }
  const flags: PostFlag[] = [];
  for (const [, postIds] of buckets.entries()) {
    if (postIds.length < 2) continue;
    for (const postId of postIds) {
      flags.push({
        postId,
        severity: 'warning',
        title: `Lignende hook brukt i ${postIds.length} posts`,
        detail: 'Variér hookene mer — algoritmen straffer repetisjon i samme feed.',
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────
// #162 — emoji-spam (Claude liker dem litt mye)
// ─────────────────────────────────────────────────────────────────────
function countEmojis(text: string): number {
  // Bred Unicode-deteksjon: Symbol, Emoji-presentation, Misc Symbols & Pictographs,
  // Transport, Supplemental, etc. Ikke 100% perfekt men dekker ~95% av
  // emojiene Claude faktisk produserer.
  const re = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;
  return (text.match(re) ?? []).length;
}

function detectEmojiSpam(posts: MarketingPlanPost[]): PostFlag[] {
  const flags: PostFlag[] = [];
  for (const post of posts) {
    const fullText = `${post.hook ?? ''} ${post.captionDraft ?? ''} ${post.callToAction ?? ''}`;
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const emojiCount = countEmojis(fullText);
    if (emojiCount === 0) continue;
    // Ratio > 1 emoji per 8 ord eller flere enn 6 totalt = spammy
    if (emojiCount >= 6 || (wordCount > 0 && emojiCount / wordCount > 0.125)) {
      flags.push({
        postId: post.id,
        severity: 'info',
        title: `${emojiCount} emojier i posten`,
        detail: 'Vurder å redusere — for mange emojier oppleves spammy og senker tillit hos B2B-publikum.',
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────
// #171 — beskyttede merkenavn
// Vi advarer kun mot åpenbar merkebruk; vi gjør ikke jus. Brukeren
// avgjør om de har lisens/avtale.
// ─────────────────────────────────────────────────────────────────────
const PROTECTED_BRANDS = [
  'apple', 'iphone', 'ipad', 'macbook',
  'google', 'youtube', 'gmail',
  'meta', 'facebook', 'instagram', 'whatsapp',
  'microsoft', 'windows', 'xbox',
  'amazon', 'aws', 'alexa',
  'tiktok', 'bytedance',
  'netflix', 'spotify',
  'coca-cola', 'pepsi',
  'nike', 'adidas', 'puma',
  'mcdonalds', 'mcdonald', 'burger king', 'starbucks',
  'tesla', 'rolex',
  'samsung', 'sony', 'lg',
  'rema 1000', 'rema1000', 'kiwi', 'meny', 'coop',
];

function detectProtectedBrands(posts: MarketingPlanPost[]): PostFlag[] {
  const flags: PostFlag[] = [];
  for (const post of posts) {
    const text = `${post.hook ?? ''} ${post.captionDraft ?? ''} ${post.script ?? ''}`.toLowerCase();
    const hits = PROTECTED_BRANDS.filter((brand) => {
      const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\\\\\\]]/g, '\\\\$&')}\\b`, 'i');
      return re.test(text);
    });
    if (hits.length === 0) continue;
    flags.push({
      postId: post.id,
      severity: 'warning',
      title: `Bruker beskyttet merke: ${hits.slice(0, 3).join(', ')}${hits.length > 3 ? '...' : ''}`,
      detail: 'Bekreft at dere har lisens/avtale — eller endre referansen for å unngå varemerke-konflikt.',
    });
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────
// #172 — platform-policy: alkohol, spill, helsekrav
// Plattformene har stramme regler her; advarsel er ikke = brudd, men
// noe brukeren bør sjekke før publisering.
// ─────────────────────────────────────────────────────────────────────
const POLICY_KEYWORDS: Array<{ category: string; pattern: RegExp; detail: string }> = [
  {
    category: 'Alkohol',
    pattern: /\b(øl|vin|whisky|cocktail|drinks?|alkohol|gin|vodka|champagne|prosecco|tequila|rom)\b/i,
    detail: 'Alkohol-promo har strenge regler på IG/TT (alder-gate, geo-restriksjon). Sjekk lokal lov.',
  },
  {
    category: 'Spill/gambling',
    pattern: /\b(casino|odds|betting|spillebrett|lotteri|tipping|poker|jackpot)\b/i,
    detail: 'Spillinnhold er sterkt regulert i Norge (Lotteritilsynet). Meta blokkerer ofte uten lisens.',
  },
  {
    category: 'Helsekrav',
    pattern: /\b(helbreder|kurerer|garantert|risikofri|miraklet|umiddelbar effekt|vitenskapelig bevist)\b/i,
    detail: 'Helsepåstander uten dokumentasjon kan trigge Forbrukertilsynet og platform-fjerning.',
  },
  {
    category: 'Finansiell',
    pattern: /\b(garantert avkastning|riskofri investering|doble pengene|krypto-profitt|trading-signal)\b/i,
    detail: 'Plattformer flagger finansielle løfter aggressivt. Finanstilsynet kan også agere.',
  },
];

function detectPolicyRisks(posts: MarketingPlanPost[]): PostFlag[] {
  const flags: PostFlag[] = [];
  for (const post of posts) {
    const text = `${post.hook ?? ''} ${post.captionDraft ?? ''} ${post.script ?? ''}`;
    for (const policy of POLICY_KEYWORDS) {
      if (!policy.pattern.test(text)) continue;
      flags.push({
        postId: post.id,
        severity: 'warning',
        title: `Mulig ${policy.category}-policy-risiko`,
        detail: policy.detail,
      });
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────
// #173 — Flesch-NO leselighet (norsk variant)
// Standard Flesch: 206.835 - 1.015 * (ord/setninger) - 84.6 * (stavelser/ord)
// Norsk variant (Björnsson LIX er enklere): LIX = ord/setninger + 100 * (lange ord / ord)
// hvor "lange ord" = ord ≥ 7 tegn. Vi bruker LIX siden den er enklere
// å beregne uten norsk stavelses-segmentering (som er ikke-triviell).
// LIX-skala:
//   <30: lett (barnebok)
//   30-40: enkelt (avis)
//   40-50: middels (faglitteratur)
//   50-60: vanskelig (fagartikkel)
//   60+: meget vanskelig (lover, forskning)
// For social-content er optimalt LIX ~25-35.
// ─────────────────────────────────────────────────────────────────────
function calculateLix(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const longWords = words.filter((w) => w.length >= 7).length;
  return (words.length / sentenceCount) + (100 * longWords / words.length);
}

function detectLowReadability(posts: MarketingPlanPost[]): PostFlag[] {
  const flags: PostFlag[] = [];
  for (const post of posts) {
    const text = post.captionDraft ?? post.script ?? '';
    // 10-ord-minimum: kort nok til å fange tette captioner med sjeldne
    // ord (akademisk vokabular), langt nok til at LIX ikke svinger på
    // én tilfeldig stavelse.
    if (text.split(/\s+/).filter(Boolean).length < 10) continue;
    const lix = calculateLix(text);
    if (lix < 45) continue; // OK readability
    flags.push({
      postId: post.id,
      severity: lix >= 55 ? 'warning' : 'info',
      title: `Tung tekst (LIX ${Math.round(lix)})`,
      detail: lix >= 55
        ? 'For vanskelig for social-feed. Bryt opp lange ord/setninger.'
        : 'Litt tung — sosial-publikum scroller forbi over LIX 40.',
    });
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────
// Public entry — kjør alle validators
// ─────────────────────────────────────────────────────────────────────
export function validateMarketingPlanPosts(posts: MarketingPlanPost[]): PostFlag[] {
  if (posts.length === 0) return [];
  return [
    ...detectDuplicateHooks(posts),
    ...detectEmojiSpam(posts),
    ...detectProtectedBrands(posts),
    ...detectPolicyRisks(posts),
    ...detectLowReadability(posts),
  ];
}

/** Gruppér flagg per post for raskt oppslag i render-loopen. */
export function groupFlagsByPost(flags: PostFlag[]): Map<string, PostFlag[]> {
  const out = new Map<string, PostFlag[]>();
  for (const flag of flags) {
    const existing = out.get(flag.postId) ?? [];
    existing.push(flag);
    out.set(flag.postId, existing);
  }
  return out;
}
