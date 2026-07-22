/**
 * Smart bilagsfilter for Gmail-skanning. En innboks har tusenvis av e-poster —
 * de aller fleste er IKKE regnskapsbilag. Dette filteret avgjør, VELDIG presist,
 * hvilke e-poster som faktisk er faktura/kvittering verdt å hente inn.
 *
 * To lag:
 *  1) Deterministiske heuristikker (gratis, raske): avsender-, emne- og
 *     vedleggssignaler på norsk OG engelsk, med sterke NEGATIVE signaler
 *     (nyhetsbrev, markedsføring, varsler) som luker ut støy.
 *  2) AI-klassifisering (Claude) på de tvilsomme: leser avsender/emne/utdrag/
 *     vedleggsnavn og dømmer «er dette et regnskapsbilag?» med type, leverandør,
 *     konfidens og begrunnelse. AI-en LESER og SORTERER — den bokfører aldri.
 *
 * Resultat per e-post: import (klart bilag) / review (usikkert → mennesket
 * bekrefter) / skip (klart ikke bilag). Menneskelig bekreftelse er alltid mulig.
 */

export interface EmailSignals {
  from: string;
  subject: string;
  snippet: string;
  attachmentNames: string[];
  hasPdf: boolean;
}

export type FilterDecision = 'import' | 'review' | 'skip';
export type BilagType = 'invoice' | 'receipt' | 'order_confirmation' | 'reminder' | 'unknown';

export interface FilterVerdict {
  decision: FilterDecision;
  confidence: number; // 0..1
  documentType: BilagType;
  vendorGuess?: string;
  reason: string;
  source: 'heuristic' | 'ai';
}

// ── Lag 1: deterministiske heuristikker (norsk + engelsk) ────────────────────

const POSITIVE_SUBJECT = [
  'faktura', 'kvittering', 'ordrebekreftelse', 'ordre', 'kjøpsbekreftelse', 'kjøp',
  'betaling', 'betalt', 'kreditnota', 'purring', 'påminnelse om betaling', 'kid',
  'invoice', 'receipt', 'order confirmation', 'your order', 'payment', 'paid', 'billing',
  'subscription', 'renewal', 'your receipt', 'purchase', 'din bestilling', 'takk for kjøpet',
];
const POSITIVE_SENDER = [
  'faktura', 'invoice', 'billing', 'receipt', 'receipts', 'no-reply', 'noreply', 'order',
  'ordre', 'kvittering', 'kundeservice', 'payment', 'betaling', 'accounts', 'regnskap',
];
const POSITIVE_FILENAME = ['faktura', 'invoice', 'kvittering', 'receipt', 'ordre', 'order', 'bilag', 'kreditnota'];
const NEGATIVE = [
  'nyhetsbrev', 'newsletter', 'avmeld', 'unsubscribe', 'kampanje', 'campaign', 'tilbud', 'rabatt',
  'discount', 'sale', 'webinar', 'invitasjon', 'invitation', 'digest', 'oppdatering fra',
  'følg oss', 'follow us', 'nyheter', 'blogg', 'blog', 'undersøkelse', 'survey', 'quiz',
];

function hasAny(haystack: string, needles: string[]): string[] {
  const h = haystack.toLowerCase();
  return needles.filter((n) => h.includes(n));
}

export interface HeuristicResult {
  score: number;
  positives: string[];
  negatives: string[];
}

/** Deterministisk score: positive signaler løfter, negative trekker ned. */
export function heuristicScore(sig: EmailSignals): HeuristicResult {
  const positives: string[] = [];
  const negatives: string[] = [];
  let score = 0;

  const subjHits = hasAny(sig.subject, POSITIVE_SUBJECT);
  if (subjHits.length) {
    score += 2;
    positives.push(`emne: ${subjHits[0]}`);
  }
  const senderHits = hasAny(sig.from, POSITIVE_SENDER);
  if (senderHits.length) {
    score += 1;
    positives.push(`avsender: ${senderHits[0]}`);
  }
  const fileHits = hasAny(sig.attachmentNames.join(' '), POSITIVE_FILENAME);
  if (fileHits.length) {
    score += 2;
    positives.push(`vedleggsnavn: ${fileHits[0]}`);
  }
  if (sig.hasPdf) {
    score += 1;
    positives.push('PDF-vedlegg');
  }
  const negHits = [...hasAny(sig.subject, NEGATIVE), ...hasAny(sig.snippet, NEGATIVE)];
  if (negHits.length) {
    score -= 3;
    negatives.push(negHits[0]!);
  }
  return { score, positives, negatives };
}

// ── Lag 2: AI-klassifisering (Claude) ────────────────────────────────────────

export class EmailClassifierError extends Error {}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

export interface AiVerdict {
  isAccountingDocument: boolean;
  documentType: BilagType;
  vendor?: string;
  confidence: number;
  reason: string;
}

export interface EmailClassifier {
  readonly available: boolean;
  classify(sig: EmailSignals): Promise<AiVerdict>;
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    isAccountingDocument: {
      type: 'boolean',
      description: 'true KUN hvis e-posten inneholder et faktisk regnskapsbilag (faktura/kvittering/kreditnota for et kjøp virksomheten kan bokføre). Nyhetsbrev, reklame, ordre-STATUS uten beløp, varsler = false.',
    },
    documentType: { type: 'string', enum: ['invoice', 'receipt', 'order_confirmation', 'reminder', 'unknown'] },
    vendor: { type: 'string', description: 'Leverandør/avsender-firma om det er tydelig' },
    confidence: { type: 'number', description: '0.0–1.0' },
    reason: { type: 'string', description: 'Kort begrunnelse på norsk' },
  },
  required: ['isAccountingDocument', 'documentType', 'confidence', 'reason'],
} as const;

const CLASSIFY_INSTRUCTION =
  'Du er en norsk regnskapsassistent som sorterer e-post. Avgjør om e-posten er et ' +
  'REGNSKAPSBILAG (faktura, kvittering eller kreditnota for et kjøp/salg som kan bokføres). ' +
  'Vær STRENG: nyhetsbrev, reklame, kampanjer, generelle varsler, ordrebekreftelser uten beløp, ' +
  'og «velkommen»-e-poster er IKKE bilag. Bruk verktøyet classify_email.';

/** Klassifiserer e-post med Claude (tvunget tool-use). Ingen nøkkel ⇒ available=false. */
export class ClaudeEmailClassifier implements EmailClassifier {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model = 'claude-haiku-4-5-20251001',
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 20000,
  ) {}

  get available(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async classify(sig: EmailSignals): Promise<AiVerdict> {
    if (!this.available) throw new EmailClassifierError('AI-klassifisering er ikke konfigurert.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const content =
      `Avsender: ${sig.from}\nEmne: ${sig.subject}\nUtdrag: ${sig.snippet.slice(0, 500)}\n` +
      `Vedlegg: ${sig.attachmentNames.join(', ') || '(ingen)'}\n\n${CLASSIFY_INSTRUCTION}`;
    try {
      const res = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: 400,
          tools: [{ name: 'classify_email', description: 'Klassifiser e-posten', input_schema: CLASSIFY_SCHEMA }],
          tool_choice: { type: 'tool', name: 'classify_email' },
          messages: [{ role: 'user', content }],
        }),
      });
      if (!res.ok) throw new EmailClassifierError(`Anthropic svarte ${res.status}.`);
      const body = (await res.json()) as { content?: Array<{ type: string; input?: unknown }> };
      const tool = (body.content ?? []).find((c) => c.type === 'tool_use');
      const input = (tool?.input ?? {}) as Record<string, unknown>;
      return {
        isAccountingDocument: input['isAccountingDocument'] === true,
        documentType: (['invoice', 'receipt', 'order_confirmation', 'reminder', 'unknown'].includes(
          input['documentType'] as string,
        )
          ? input['documentType']
          : 'unknown') as BilagType,
        ...(typeof input['vendor'] === 'string' && input['vendor'] ? { vendor: input['vendor'] as string } : {}),
        confidence: typeof input['confidence'] === 'number' ? Math.max(0, Math.min(1, input['confidence'])) : 0.5,
        reason: typeof input['reason'] === 'string' ? (input['reason'] as string) : '',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── Kombinert smart-filter ───────────────────────────────────────────────────

export class SmartGmailFilter {
  constructor(private readonly classifier?: EmailClassifier | undefined) {}

  /** Én e-post → import/review/skip. Kjører AI kun når det er verdt det (sparer kall). */
  async evaluate(sig: EmailSignals): Promise<FilterVerdict> {
    const h = heuristicScore(sig);

    // Ingen vedlegg i det hele tatt → aldri et bilag her (bilag ligger som fil).
    if (!sig.hasPdf && sig.attachmentNames.length === 0) {
      return { decision: 'skip', confidence: 0.95, documentType: 'unknown', reason: 'Ingen vedlegg', source: 'heuristic' };
    }
    // Klar støy (sterke negative, ingen positive) → hopp over uten AI.
    if (h.negatives.length > 0 && h.positives.length === 0) {
      return {
        decision: 'skip',
        confidence: 0.85,
        documentType: 'unknown',
        reason: `Ser ut som ${h.negatives[0]} (markedsføring/varsel)`,
        source: 'heuristic',
      };
    }

    // Har AI? La den dømme de som har vedlegg og ikke er åpenbar støy.
    if (this.classifier?.available) {
      try {
        const ai = await this.classifier.classify(sig);
        const decision: FilterDecision = !ai.isAccountingDocument
          ? 'skip'
          : ai.confidence >= 0.8
            ? 'import'
            : 'review';
        return {
          decision,
          confidence: ai.confidence,
          documentType: ai.documentType,
          ...(ai.vendor ? { vendorGuess: ai.vendor } : {}),
          reason: ai.reason || (ai.isAccountingDocument ? 'Vurdert som bilag av AI' : 'Ikke et bilag'),
          source: 'ai',
        };
      } catch {
        // AI feilet → fall tilbake til heuristikk under.
      }
    }

    // Heuristikk-only: sterk score → import, litt signal → review, ellers skip.
    const decision: FilterDecision = h.score >= 4 ? 'import' : h.score >= 2 ? 'review' : 'skip';
    return {
      decision,
      confidence: decision === 'import' ? 0.7 : decision === 'review' ? 0.5 : 0.6,
      documentType: 'unknown',
      reason: h.positives.length ? `Signaler: ${h.positives.join(', ')}` : 'Svake signaler',
      source: 'heuristic',
    };
  }
}
