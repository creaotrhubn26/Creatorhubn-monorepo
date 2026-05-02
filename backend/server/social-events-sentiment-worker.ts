/**
 * Sentiment-scoring batch worker for social_events.
 *
 * Plukker rader hvor sentiment_processed_at IS NULL og scorer dem via
 * Claude Haiku (cost-effective for kort tekst, fortsatt nuansert nok for
 * brand-monitoring). Skriver score (-1..1) + label (negative/neutral/
 * positive/mixed) tilbake.
 *
 * Sweep-intervall: 60 sek default. Batch-størrelse: 25 events per sweep.
 * Når køen er tom, no-op fram til neste sweep — billig å la stå på alltid.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Pool } from 'pg';
import {
  listPendingSentimentEvents,
  setEventSentiment,
} from './social-events.js';
import { modelIdForTier } from './role-room-agent-cache.js';

const SWEEP_INTERVAL_MS = 60_000;
const BATCH_SIZE = 25;

const SYSTEM_PROMPT = `You are a sentiment classifier for social media comments and mentions.

For each input message, return ONLY a single JSON object on its own line:
{ "id": "<message-id>", "score": <number between -1.0 and 1.0>, "label": "negative" | "neutral" | "positive" | "mixed" }

Score rubric:
  -1.0 strong hostility, attacks, threats
  -0.5 clear complaint, frustration, disappointment
   0.0 factual question, neutral observation
   0.5 positive feedback, appreciation
   1.0 strong enthusiasm, advocacy

"mixed" applies when a message contains both positive and negative content (e.g. praise with constructive criticism). Pick the closest single score in those cases (typically near 0).

Be culture-aware: Norwegian sarcasm and dry humor often read as neutral on the surface.

Return one JSON object per line. No markdown, no explanations, no surrounding text. If a message is empty or unparseable, return label="neutral" with score=0.`;

export interface SentimentResult {
  id: string;
  score: number;
  label: 'negative' | 'neutral' | 'positive' | 'mixed';
}

function parseClaudeJsonLines(text: string): SentimentResult[] {
  const out: SentimentResult[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed) as {
        id?: string;
        score?: number;
        label?: string;
      };
      if (
        typeof obj.id === 'string' &&
        typeof obj.score === 'number' &&
        (obj.label === 'negative' ||
          obj.label === 'neutral' ||
          obj.label === 'positive' ||
          obj.label === 'mixed')
      ) {
        const clamped = Math.max(-1, Math.min(1, obj.score));
        out.push({ id: obj.id, score: clamped, label: obj.label });
      }
    } catch {
      // Skip malformed lines silently
    }
  }
  return out;
}

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

export async function scoreSentimentBatch(
  events: Array<{ id: string; body: string | null }>,
): Promise<SentimentResult[]> {
  const client = getClient();
  if (!client) {
    console.warn('[sentiment-worker] ANTHROPIC_API_KEY not set; skipping batch');
    return [];
  }
  const items = events
    .filter((e): e is { id: string; body: string } => Boolean(e.body))
    .map((e) => ({ id: e.id, text: e.body }));
  if (items.length === 0) return [];

  const userMessage = items
    .map((it) => `id=${it.id} | text=${JSON.stringify(it.text.slice(0, 1000))}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: modelIdForTier('haiku'),
      max_tokens: 1024,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return parseClaudeJsonLines(text);
  } catch (error) {
    console.warn('[sentiment-worker] Claude call failed', error);
    return [];
  }
}

export async function sweepOnce(pool: Pool, batchSize = BATCH_SIZE): Promise<number> {
  const pending = await listPendingSentimentEvents(pool, batchSize);
  if (pending.length === 0) return 0;

  const results = await scoreSentimentBatch(pending);
  const byId = new Map(results.map((r) => [r.id, r]));

  let updated = 0;
  const model = modelIdForTier('haiku');
  for (const event of pending) {
    const r = byId.get(event.id);
    if (r) {
      await setEventSentiment(pool, event.id, r.score, r.label, model);
      updated += 1;
    } else {
      // Score returned nothing for this id — mark as processed with neutral
      // so we don't loop forever. Sentiment-model lagrer 'fallback' så vi
      // kan filtrere bort senere hvis ønskelig.
      await setEventSentiment(pool, event.id, 0, 'neutral', `${model}+fallback`);
    }
  }
  return updated;
}

let workerHandle: NodeJS.Timeout | null = null;

export function startSentimentWorker(pool: Pool): void {
  if (workerHandle) return;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[sentiment-worker] ANTHROPIC_API_KEY not set; worker disabled');
    return;
  }
  console.log('[sentiment-worker] starting (sweep every 60s)');
  workerHandle = setInterval(() => {
    sweepOnce(pool).catch((err) => {
      console.warn('[sentiment-worker] sweep failed', err);
    });
  }, SWEEP_INTERVAL_MS);
  // Run one immediately so the first batch doesn't wait 60s after boot
  sweepOnce(pool).catch(() => {});
}

export function stopSentimentWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}
