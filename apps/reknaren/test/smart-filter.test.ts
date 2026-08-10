import { describe, expect, it } from 'vitest';
import {
  ClaudeEmailClassifier,
  heuristicScore,
  SmartGmailFilter,
  type AiVerdict,
  type EmailClassifier,
  type EmailSignals,
} from '../src/ingestion/gmail/smart-filter.js';

const faktura: EmailSignals = {
  from: 'Elkjøp <faktura@elkjop.no>',
  subject: 'Faktura 55012 – takk for kjøpet',
  snippet: 'Din faktura er vedlagt. KID 1234561.',
  attachmentNames: ['faktura-55012.pdf'],
  hasPdf: true,
};
const newsletter: EmailSignals = {
  from: 'Nyheter <nyhetsbrev@shop.no>',
  subject: 'Ukens kampanje: 30% rabatt!',
  snippet: 'Meld deg av / unsubscribe nederst.',
  attachmentNames: [],
  hasPdf: false,
};
// Svake signaler (bare PDF-vedlegg, ingen nøkkelord) → havner i AI-laget.
const ambiguous: EmailSignals = {
  from: 'kontakt@ukjentfirma.no',
  subject: 'Dokument til deg',
  snippet: 'Se vedlagt dokument.',
  attachmentNames: ['vedlegg.pdf'],
  hasPdf: true,
};

describe('heuristicScore', () => {
  it('løfter tydelige bilag, straffer markedsføring', () => {
    const f = heuristicScore(faktura);
    expect(f.score).toBeGreaterThanOrEqual(4);
    expect(f.positives.length).toBeGreaterThan(0);
    const n = heuristicScore(newsletter);
    expect(n.score).toBeLessThan(2);
    expect(n.negatives.length).toBeGreaterThan(0);
  });
});

function stubClassifier(verdict: Partial<AiVerdict>, available = true): EmailClassifier {
  return {
    available,
    async classify() {
      return {
        isAccountingDocument: true,
        documentType: 'invoice',
        confidence: 0.9,
        reason: 'faktura',
        ...verdict,
      } as AiVerdict;
    },
  };
}

describe('SmartGmailFilter', () => {
  it('uten vedlegg → skip (bilag ligger som fil)', async () => {
    const v = await new SmartGmailFilter().evaluate({ ...newsletter, attachmentNames: [], hasPdf: false });
    expect(v.decision).toBe('skip');
  });

  it('åpenbar markedsføring m/ vedlegg men bare negative signaler → skip uten AI', async () => {
    const v = await new SmartGmailFilter().evaluate({
      from: 'x@shop.no',
      subject: 'Kampanje – stor rabatt',
      snippet: 'unsubscribe',
      attachmentNames: ['flyer.pdf'],
      hasPdf: true,
    });
    expect(v.decision).toBe('skip');
    expect(v.source).toBe('heuristic');
  });

  it('tvilsom e-post + AI: høy konfidens bilag → import; ikke-bilag → skip', async () => {
    const imp = await new SmartGmailFilter(stubClassifier({ confidence: 0.95 })).evaluate(ambiguous);
    expect(imp.decision).toBe('import');
    expect(imp.source).toBe('ai');

    const skip = await new SmartGmailFilter(
      stubClassifier({ isAccountingDocument: false, documentType: 'unknown', confidence: 0.9 }),
    ).evaluate(ambiguous);
    expect(skip.decision).toBe('skip');
  });

  it('tvilsom e-post + AI: middels konfidens → review (mennesket bekrefter)', async () => {
    const v = await new SmartGmailFilter(stubClassifier({ confidence: 0.6 })).evaluate(ambiguous);
    expect(v.decision).toBe('review');
  });

  it('tydelig bilag → import via heuristikk UTEN AI-kall (spar tid)', async () => {
    // med klassifiserer tilstede, men sterke signaler → hopp over AI.
    let aiCalls = 0;
    const spy: EmailClassifier = {
      available: true,
      async classify() {
        aiCalls++;
        return { isAccountingDocument: true, documentType: 'invoice', confidence: 0.9, reason: '' };
      },
    };
    const v = await new SmartGmailFilter(spy).evaluate(faktura);
    expect(v.decision).toBe('import');
    expect(v.source).toBe('heuristic');
    expect(aiCalls).toBe(0);
  });
});

describe('ClaudeEmailClassifier', () => {
  it('uten nøkkel er den ikke tilgjengelig', () => {
    expect(new ClaudeEmailClassifier(undefined).available).toBe(false);
  });

  it('mapper tvunget tool-use-svar til verdict', async () => {
    const fakeFetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'ok' },
          {
            type: 'tool_use',
            name: 'classify_email',
            input: { isAccountingDocument: true, documentType: 'receipt', vendor: 'Rema 1000', confidence: 0.88, reason: 'kvittering' },
          },
        ],
      }),
      text: async () => '',
    });
    const c = new ClaudeEmailClassifier('sk-key', 'claude-haiku-4-5-20251001', fakeFetch as never);
    const v = await c.classify(faktura);
    expect(v).toMatchObject({ isAccountingDocument: true, documentType: 'receipt', vendor: 'Rema 1000', confidence: 0.88 });
  });
});
