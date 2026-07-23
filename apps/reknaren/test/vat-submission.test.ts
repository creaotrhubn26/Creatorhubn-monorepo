import { describe, expect, it } from 'vitest';
import {
  MaskinportenAuthError,
  MaskinportenClient,
  StaticMaskinportenStub,
} from '../src/integrations/maskinporten.js';
import {
  MaskinportenError,
  SkatteetatenVatSubmissionClient,
  StubVatSubmission,
  buildMvaMeldingXml,
} from '../src/integrations/vat-submission.js';
import type { VatReport } from '../src/vat/engine.js';

const report: VatReport = {
  organizationId: 'org-1',
  fromDate: '2026-01-01',
  toDate: '2026-02-28',
  status: 'draft',
  lines: [
    { vatCode: '3', name: 'Utgående 25 %', mvaMeldingCode: '3', baseMinor: 100000n, vatMinor: 25000n },
    { vatCode: '1', name: 'Fradrag inngående', mvaMeldingCode: '1', baseMinor: 40000n, vatMinor: 10000n },
  ],
  outputVatMinor: 25000n,
  deductibleInputVatMinor: 10000n,
  netPayableMinor: 15000n,
  generatedAt: '2026-03-01T00:00:00.000Z',
  warnings: [],
};

function fakeFetch(responder: (url: string, method: string, body?: string) => { status: number; body?: unknown; text?: string }) {
  const calls: Array<{ url: string; method: string; body: string | undefined; headers: Record<string, string> }> = [];
  const impl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, body: init.body, headers: init.headers });
    const r = responder(url, init.method, init.body);
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => {
        if (r.body === undefined) throw new Error('ikke JSON');
        return r.body;
      },
      text: async () => r.text ?? '',
    };
  };
  return { impl, calls };
}

describe('buildMvaMeldingXml', () => {
  it('bygger konvolutt i riktig namespace med eksakt kronebeløp (øre uten flyttall)', () => {
    const xml = buildMvaMeldingXml(report);
    expect(xml).toContain('xmlns="no:skatteetaten:fastsetting:avgift:mva:skattemeldingformerverdiavgift:v1.0"');
    expect(xml).toContain('<fra>2026-01-01</fra>');
    expect(xml).toContain('<mvaLinje kode="3">');
    expect(xml).toContain('<grunnlag>1000.00</grunnlag>'); // 100000 øre
    expect(xml).toContain('<merverdiavgift>250.00</merverdiavgift>'); // 25000 øre
    expect(xml).toContain('<sumBetalbar>150.00</sumBetalbar>'); // 15000 øre
  });

  it('formaterer negative beløp (til gode) med fortegn', () => {
    const credit = buildMvaMeldingXml({ ...report, netPayableMinor: -15005n });
    expect(credit).toContain('<sumBetalbar>-150.05</sumBetalbar>');
  });
});

describe('SkatteetatenVatSubmissionClient — ærlig aktivering', () => {
  it('active=false og validate() kaster FØR nettverkskall uten Maskinporten-legitimasjon', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const client = new SkatteetatenVatSubmissionClient(new MaskinportenClient(undefined), impl);
    expect(client.active).toBe(false);
    await expect(client.validate(report)).rejects.toBeInstanceOf(MaskinportenAuthError);
    expect(calls).toHaveLength(0);
  });

  it('med token: POST-er XML med Bearer til grensesnittstøtte-valideringen', async () => {
    // Token leveres av stub; valideringskallet fanges av fake fetch.
    const validateFetch = fakeFetch((url) => {
      expect(url).toBe('https://idporten-api-sbstest.sits.no/api/mva/grensesnittstoette/mva-melding/valider');
      return { status: 200, body: { messages: [] } };
    });
    const client = new SkatteetatenVatSubmissionClient(new StaticMaskinportenStub(), validateFetch.impl);
    const res = await client.validate(report);
    expect(res.valid).toBe(true);
    expect(validateFetch.calls[0]!.headers['authorization']).toBe('Bearer stub-access-token');
    expect(validateFetch.calls[0]!.headers['content-type']).toBe('application/xml');
    expect(validateFetch.calls[0]!.body).toContain('<mvaMeldingDto');
  });

  it('valideringsavvik gir valid=false med meldinger', async () => {
    const validateFetch = fakeFetch(() => ({ status: 200, body: { valideringsfeil: ['Ugyldig periode'] } }));
    const client = new SkatteetatenVatSubmissionClient(new StaticMaskinportenStub(), validateFetch.impl);
    const res = await client.validate(report);
    expect(res.valid).toBe(false);
    expect(res.messages).toContain('Ugyldig periode');
  });

  it('submit() kjører Altinn 3-flyten: veksle token → opprett instans → last opp → fullfør → kvittering', async () => {
    const f = fakeFetch((url, method) => {
      if (url.includes('/exchange/maskinporten')) return { status: 200, text: '"altinn-token"' };
      if (url.endsWith('/instances') && method === 'POST')
        return { status: 201, body: { id: '51234/abcd-guid', data: [{ id: 'env-1', dataType: 'mvameldinginnsending' }] } };
      if (url.includes('/data?dataType=mvamelding')) return { status: 201, body: {} };
      if (url.includes('/data/env-1')) return { status: 200, body: {} };
      if (url.endsWith('/process/next')) return { status: 200, body: {} };
      if (url.endsWith('/feedback/status')) return { status: 200, body: { status: 'godkjent' } };
      return { status: 404, body: {} };
    });
    const client = new SkatteetatenVatSubmissionClient(new StaticMaskinportenStub(), f.impl);
    const receipt = await client.submit(report, { orgNumber: '910023764' });
    expect(receipt.reference).toBe('51234/abcd-guid');
    expect(receipt.status).toBe('godkjent');
    // instansen ble opprettet med virksomheten som eier, og Altinn-token brukt som Bearer
    const create = f.calls.find((c) => c.url.endsWith('/instances') && c.method === 'POST')!;
    expect(create.body).toContain('910023764');
    expect(create.headers['authorization']).toBe('Bearer altinn-token');
    // konvolutten ble PUT-et til det forhåndsopprettede data-elementet
    expect(f.calls.some((c) => c.url.includes('/data/env-1') && c.method === 'PUT')).toBe(true);
    // to prosess-steg (fullfør)
    expect(f.calls.filter((c) => c.url.endsWith('/process/next')).length).toBe(2);
  });

  it('submit() melder feil hvis instansopprettelse feiler', async () => {
    const f = fakeFetch((url) => (url.includes('/exchange') ? { status: 200, text: 'tok' } : { status: 403, body: {} }));
    const client = new SkatteetatenVatSubmissionClient(new StaticMaskinportenStub(), f.impl);
    await expect(client.submit(report, { orgNumber: '910023764' })).rejects.toBeInstanceOf(MaskinportenError);
  });
});

describe('StubVatSubmission', () => {
  it('round-trip: validate + submit', async () => {
    const stub = new StubVatSubmission(
      { valid: true, messages: [], raw: null },
      { reference: 'ALTINN-1', status: 'submitted', submittedAt: '2026-03-01T00:00:00.000Z' },
    );
    expect((await stub.validate(report)).valid).toBe(true);
    expect((await stub.submit(report, { orgNumber: '910023764' })).reference).toBe('ALTINN-1');
  });

  it('inaktiv stub kaster på validate/submit', async () => {
    const stub = new StubVatSubmission(undefined, null, { active: false });
    expect(stub.active).toBe(false);
    await expect(stub.validate(report)).rejects.toBeInstanceOf(MaskinportenAuthError);
  });
});
