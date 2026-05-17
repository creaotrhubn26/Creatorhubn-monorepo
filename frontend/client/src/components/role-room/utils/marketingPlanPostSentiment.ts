/**
 * Client-side norsk sentiment-scoring — item #163.
 *
 * Lexicon-basert tilnærming: små lister med positive/negative ord på
 * norsk + emoji-deteksjon. Returnerer score i [-1, +1]:
 *   +1: utelukkende positiv
 *   0: nøytral eller balansert
 *   -1: utelukkende negativ
 *
 * Bevisst enkel — vi sammenligner ikke med Claude sentiment-analyse (som
 * ville være mer presis), fordi:
 *   1. Ingen API-call = øyeblikkelig + null kost per post
 *   2. Marketing-content er typisk eksplisitt positivt — det er
 *      negativ-deteksjon som er viktigst (advarsel hvis posten har
 *      utilsiktet negativ tone)
 *
 * Ikke til klinisk bruk. Til pitch og varsel.
 */

import type { MarketingPlanPost } from '../services/roleRoomAgentService';

const POSITIVE_WORDS = new Set([
  // Generelle positive
  'god', 'godt', 'gode', 'bra', 'flott', 'fantastisk', 'utmerket', 'super',
  'beste', 'topp', 'perfekt', 'nydelig', 'praktfull', 'herlig', 'deilig',
  'kjempebra', 'kjempegod', 'kjempefin', 'fin', 'fint', 'fine',
  // Marketing-spesifikke
  'velkommen', 'gratis', 'tilbud', 'nyhet', 'eksklusiv', 'ny', 'nye', 'nytt',
  'spennende', 'inspirerende', 'unik', 'ekte', 'autentisk',
  'lykkelig', 'glad', 'fornøyd', 'happy', 'wow', 'yes', 'ja',
  'kjærlighet', 'elsker', 'elsk', 'favoritt', 'anbefaler', 'anbefal',
  'suksess', 'vinn', 'vinner', 'vunnet',
  'lett', 'enkelt', 'rask', 'effektiv', 'kvalitet', 'profesjonell',
  'lokal', 'fersk', 'naturlig', 'organisk', 'bærekraftig',
  'tradisjon', 'håndverk', 'kjærlig', 'omsorg',
]);

const NEGATIVE_WORDS = new Set([
  'dårlig', 'verst', 'verste', 'feil', 'fail', 'mislykket',
  'trist', 'lei', 'tap', 'tapte', 'mister', 'mistet',
  'umulig', 'kjedelig', 'vanskelig', 'problem', 'problemer',
  'aldri', 'ingen', 'nei', 'stopp', 'unngå', 'farlig',
  'risiko', 'krise', 'katastrofe', 'frykt', 'redd',
  'hate', 'hater', 'avskyr', 'misliker',
  'kjipt', 'kjip', 'kjede', 'krise',
  'sint', 'irritert', 'frustrert', 'skuffet',
  // Marketing-policy-røde
  'kjøp nå eller mist', 'siste sjanse', 'bare for deg',
]);

const POSITIVE_EMOJI = ['😀', '😃', '😄', '😁', '😊', '😍', '🥰', '😘', '❤️', '💕', '💖', '🔥', '⭐', '✨', '🎉', '🎊', '👍', '💪', '🙌', '👏', '☀️', '🌟'];
const NEGATIVE_EMOJI = ['😢', '😭', '😞', '😔', '😟', '😩', '😫', '😡', '😠', '🤬', '💔', '👎', '⚠️', '❌'];

export type SentimentLabel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface PostSentiment {
  postId: string;
  score: number;        // -1 .. +1
  label: SentimentLabel;
  positiveHits: string[];
  negativeHits: string[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:()"']/g, ' ');
}

function scoreText(text: string): { score: number; positiveHits: string[]; negativeHits: string[] } {
  if (!text) return { score: 0, positiveHits: [], negativeHits: [] };
  const lower = normalize(text);
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { score: 0, positiveHits: [], negativeHits: [] };

  const positiveHits: string[] = [];
  const negativeHits: string[] = [];
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveHits.push(word);
    if (NEGATIVE_WORDS.has(word)) negativeHits.push(word);
  }
  // Emoji-scoring kjøres på original-teksten (lowercase ødelegger ikke emojier)
  for (const emoji of POSITIVE_EMOJI) {
    if (text.includes(emoji)) positiveHits.push(emoji);
  }
  for (const emoji of NEGATIVE_EMOJI) {
    if (text.includes(emoji)) negativeHits.push(emoji);
  }

  // Score = (pos - neg) / sqrt(total-meningfulle-ord)
  // sqrt-normaliseringen gjør at korte tekster med 2 pos-ord ikke skyter
  // score til +1.0 mens lange tekster med 5 pos-ord scorer +0.5.
  const positiveCount = positiveHits.length;
  const negativeCount = negativeHits.length;
  const denominator = Math.max(3, Math.sqrt(words.length));
  let score = (positiveCount - negativeCount) / denominator;
  // Clamp til [-1, +1]
  score = Math.max(-1, Math.min(1, score));
  return { score: Number(score.toFixed(2)), positiveHits, negativeHits };
}

function labelForScore(score: number): SentimentLabel {
  if (score >= 0.5) return 'very_positive';
  if (score >= 0.15) return 'positive';
  if (score >= -0.15) return 'neutral';
  if (score >= -0.5) return 'negative';
  return 'very_negative';
}

export function scorePost(post: MarketingPlanPost): PostSentiment {
  const fullText = [post.hook, post.captionDraft, post.callToAction]
    .filter(Boolean)
    .join(' ');
  const { score, positiveHits, negativeHits } = scoreText(fullText);
  return {
    postId: post.id,
    score,
    label: labelForScore(score),
    positiveHits,
    negativeHits,
  };
}

export function scoreAllPosts(posts: MarketingPlanPost[]): Map<string, PostSentiment> {
  const out = new Map<string, PostSentiment>();
  for (const post of posts) {
    out.set(post.id, scorePost(post));
  }
  return out;
}

export function buildDistribution(sentiments: Map<string, PostSentiment>): Record<SentimentLabel, number> {
  const out: Record<SentimentLabel, number> = {
    very_positive: 0, positive: 0, neutral: 0, negative: 0, very_negative: 0,
  };
  for (const s of sentiments.values()) out[s.label]++;
  return out;
}

export function emojiForLabel(label: SentimentLabel): string {
  switch (label) {
    case 'very_positive': return '😄';
    case 'positive': return '🙂';
    case 'neutral': return '😐';
    case 'negative': return '🙁';
    case 'very_negative': return '😞';
  }
}

export function colorForLabel(label: SentimentLabel): string {
  switch (label) {
    case 'very_positive': return '#34d399';
    case 'positive': return '#86efac';
    case 'neutral': return '#94a3b8';
    case 'negative': return '#fca5a5';
    case 'very_negative': return '#f87171';
  }
}
