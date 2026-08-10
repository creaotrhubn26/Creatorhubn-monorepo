/**
 * AI-bilagslesing: les eit foto/PDF/tekst-bilag med Claude (vision) og trekk ut
 * dei strukturerte rekneskapsfelta. Ligg bak same `DocumentExtractor`-port som den
 * deterministiske motoren — så resten av pipelinen (sumvalidering, forslag,
 * MENNESKELEG godkjenning) er uendra. AI LES det som står på bilaget; han reknar
 * ALDRI ut mva-satsar (dei kjem frå regelregisteret) og bokfører ingenting sjølv.
 *
 * Ærleg status: utan API-nøkkel (`REKNAREN_ANTHROPIC_API_KEY`) er han ikkje aktiv
 * og `extract` kastar `DocumentExtractionNotConfiguredError` FØR nettverkskall.
 * `fetchImpl` er injiserbar for testar.
 */

import { moneyFromDecimalString } from '../shared/money.js';
import type { DocumentExtractor } from './extract.js';
import type { DocumentType, ExtractedData, VatBreakdownLine } from '../documents/types.js';

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

export class DocumentExtractionNotConfiguredError extends DocumentExtractionError {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentExtractionNotConfiguredError';
  }
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

const DOC_TYPES: DocumentType[] = [
  'receipt',
  'supplier_invoice',
  'credit_note',
  'order_confirmation',
  'payment_confirmation',
  'customs',
  'unknown',
];

/** JSON-skjema for tool-use — tvingar Claude til strukturert, validerbart svar. */
const BILAG_SCHEMA = {
  type: 'object',
  properties: {
    documentType: { type: 'string', enum: DOC_TYPES },
    vendorName: { type: 'string' },
    vendorOrgNumber: { type: 'string', description: '9-sifra norsk org.nr utan mellomrom, om oppgitt' },
    invoiceNumber: { type: 'string' },
    invoiceDate: { type: 'string', description: 'ISO yyyy-mm-dd' },
    dueDate: { type: 'string', description: 'ISO yyyy-mm-dd' },
    kid: { type: 'string' },
    bankAccount: { type: 'string' },
    currency: { type: 'string', description: 'ISO 4217, t.d. NOK. Default NOK.' },
    net: { type: 'string', description: 'Nettobeløp eks. mva som desimaltal, maks 2 desimalar (t.d. "1234.56")' },
    vat: { type: 'string', description: 'Mva-beløp som desimaltal' },
    gross: { type: 'string', description: 'Bruttobeløp inkl. mva som desimaltal' },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: { description: { type: 'string' }, amount: { type: 'string' } },
        required: ['description', 'amount'],
      },
    },
    vatBreakdown: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ratePct: { type: 'string', description: 'Mva-sats i prosent, t.d. "25"' },
          base: { type: 'string' },
          vat: { type: 'string' },
        },
        required: ['ratePct', 'base', 'vat'],
      },
    },
    purchaseCountry: { type: 'string', description: 'ISO-landkode når selgar er utanlandsk' },
    foreignService: { type: 'boolean', description: 'true for tenester kjøpt frå utlandet' },
  },
  required: ['documentType'],
} as const;

const INSTRUCTION =
  'Du er ein norsk rekneskapsassistent. Les bilaget og trekk ut felta NØYAKTIG slik dei ' +
  'står på dokumentet. Beløp som desimaltal i dokumentets valuta (t.d. "1234.56"), maks 2 ' +
  'desimalar. IKKJE gjett eller rekn ut mva-satsar — les det som står. La felt vere tomme ' +
  'når dei ikkje finst. Bruk verktøyet record_bilag.';

export class ClaudeDocumentExtractor implements DocumentExtractor {
  readonly name = 'claude-vision';

  constructor(
    private readonly apiKey: string | undefined = undefined,
    private readonly model: string = 'claude-sonnet-4-6',
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 40000,
  ) {}

  get configured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async extract(content: Buffer, filename: string, mimeType: string): Promise<ExtractedData> {
    if (!this.configured) {
      throw new DocumentExtractionNotConfiguredError(
        'AI-bilagslesing er ikkje konfigurert (REKNAREN_ANTHROPIC_API_KEY manglar).',
      );
    }
    const block = this.contentBlock(content, mimeType);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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
          max_tokens: 1500,
          tools: [{ name: 'record_bilag', description: 'Registrer bilag-felta', input_schema: BILAG_SCHEMA }],
          tool_choice: { type: 'tool', name: 'record_bilag' },
          messages: [{ role: 'user', content: [block, { type: 'text', text: `${INSTRUCTION}\n\nFilnamn: ${filename}` }] }],
        }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new DocumentExtractionNotConfiguredError(`Anthropic avviste nøkkelen (${res.status}).`);
      }
      if (!res.ok) {
        throw new DocumentExtractionError(`Anthropic svarte med status ${res.status}.`, res.status);
      }
      const body = (await res.json()) as { content?: Array<{ type: string; input?: unknown }> };
      const tool = (body.content ?? []).find((c) => c.type === 'tool_use');
      if (!tool || typeof tool.input !== 'object' || tool.input === null) {
        throw new DocumentExtractionError('Claude returnerte ikkje strukturert bilag-svar.');
      }
      return mapToExtractedData(tool.input as Record<string, unknown>);
    } finally {
      clearTimeout(timer);
    }
  }

  private contentBlock(content: Buffer, mimeType: string): Record<string, unknown> {
    const data = content.toString('base64');
    if (mimeType.includes('pdf')) {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
    }
    if (mimeType.startsWith('image/')) {
      return { type: 'image', source: { type: 'base64', media_type: mimeType, data } };
    }
    // Ren tekst: send som tekst-blokk.
    return { type: 'text', text: content.toString('utf8').slice(0, 20000) };
  }
}

/** Trygg desimal→øre; returnerer undefined ved tom/ugyldig verdi (i staden for å krasje). */
function toMinor(value: unknown, currency: string): bigint | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    return moneyFromDecimalString(value, currency).minorUnits;
  } catch {
    return undefined;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function mapToExtractedData(input: Record<string, unknown>): ExtractedData {
  const currency = str(input['currency']) ?? 'NOK';
  const dt = DOC_TYPES.includes(input['documentType'] as DocumentType)
    ? (input['documentType'] as DocumentType)
    : 'unknown';

  const out: ExtractedData = { documentType: dt, currency };
  const assign = <K extends keyof ExtractedData>(k: K, v: ExtractedData[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  assign('vendorName', str(input['vendorName']));
  assign('vendorOrgNumber', str(input['vendorOrgNumber'])?.replace(/\s/g, ''));
  assign('invoiceNumber', str(input['invoiceNumber']));
  assign('invoiceDate', str(input['invoiceDate']));
  assign('dueDate', str(input['dueDate']));
  assign('kid', str(input['kid']));
  assign('bankAccount', str(input['bankAccount']));
  assign('netMinor', toMinor(input['net'], currency));
  assign('vatMinor', toMinor(input['vat'], currency));
  assign('grossMinor', toMinor(input['gross'], currency));
  assign('purchaseCountry', str(input['purchaseCountry']));
  if (typeof input['foreignService'] === 'boolean') out.foreignService = input['foreignService'];

  if (Array.isArray(input['lineItems'])) {
    const lines = input['lineItems']
      .map((l): { description: string; amountMinor: bigint } | null => {
        const li = l as Record<string, unknown>;
        const desc = str(li['description']);
        const amt = toMinor(li['amount'], currency);
        return desc && amt !== undefined ? { description: desc, amountMinor: amt } : null;
      })
      .filter((l): l is { description: string; amountMinor: bigint } => l !== null);
    if (lines.length) out.lineItems = lines;
  }
  if (Array.isArray(input['vatBreakdown'])) {
    const vb = input['vatBreakdown']
      .map((l): VatBreakdownLine | null => {
        const li = l as Record<string, unknown>;
        const ratePct = str(li['ratePct']);
        const baseMinor = toMinor(li['base'], currency);
        const vatMinor = toMinor(li['vat'], currency);
        return ratePct && baseMinor !== undefined && vatMinor !== undefined
          ? { ratePct, baseMinor, vatMinor }
          : null;
      })
      .filter((l): l is VatBreakdownLine => l !== null);
    if (vb.length) out.vatBreakdown = vb;
  }
  return out;
}
