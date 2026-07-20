import { describe, expect, it } from 'vitest';
import {
  LovdataApiClient,
  LovdataAccessError,
  LovdataAuthError,
  StaticLovdataStub,
  buildLawRefID,
  lawRefIDFromUrl,
  legalReferenceRefID,
  normalizeParagraph,
  type LegalTextResult,
} from '../src/integrations/lovdata.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';

/** Fake fetch som fanger opp URL + headers og returnerer et forhåndsdefinert svar. */
function fakeFetch(
  responder: (url: string, headers: Record<string, string>) => {
    status: number;
    body?: unknown;
    text?: string;
  },
) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const impl = async (
    url: string,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ) => {
    const headers = init?.headers ?? {};
    calls.push({ url, headers });
    const r = responder(url, headers);
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

describe('Lovdata-klient — tilgangsmodell og ærlig status', () => {
  it('ping() bruker det åpne endepunktet uten API-nøkkel', async () => {
    const { impl, calls } = fakeFetch((url) => {
      expect(url).toContain('/ping');
      return { status: 200, text: 'Pong' };
    });
    const client = new LovdataApiClient('hemmelig-nøkkel', impl);
    expect(await client.ping()).toBe(true);
    // Selv med nøkkel konfigurert skal /ping ALDRI sende X-API-Key.
    expect(calls[0]!.headers['X-API-Key']).toBeUndefined();
  });

  it('ping() returnerer false ved feilstatus eller nettverksfeil', async () => {
    const down = new LovdataApiClient('k', fakeFetch(() => ({ status: 503, text: '' })).impl);
    expect(await down.ping()).toBe(false);
    const throwing = new LovdataApiClient('k', async () => {
      throw new Error('nettverk nede');
    });
    expect(await throwing.ping()).toBe(false);
  });

  it('listPublicDatasets() er keyless og parser NLOD-katalogen', async () => {
    const { impl, calls } = fakeFetch((url) => {
      expect(url).toContain('/v1/publicData/list');
      return {
        status: 200,
        body: [
          {
            filename: 'gjeldende-lover.tar.bz2',
            description: 'Gjeldende lover, ajourført med endringer',
            sizeBytes: '5847951',
            lastModified: '2026-07-07T01:31:00Z',
          },
        ],
      };
    });
    const client = new LovdataApiClient(undefined, impl);
    const sets = await client.listPublicDatasets();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.filename).toBe('gjeldende-lover.tar.bz2');
    expect(sets[0]!.sizeBytes).toBe(5847951); // string → number
    expect(calls[0]!.headers['X-API-Key']).toBeUndefined();
  });

  it('fetchLegalText() uten nøkkel kaster LovdataAuthError UTEN å gjøre nettverkskall', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const client = new LovdataApiClient(undefined, impl);
    expect(client.hasApiKey).toBe(false);
    await expect(client.fetchLegalText('NL/lov/1999-03-26-14/§6-20')).rejects.toBeInstanceOf(
      LovdataAuthError,
    );
    expect(calls).toHaveLength(0); // ærlig og tidlig — ingen 401-runde mot API-et
  });

  it('fetchLegalText() med nøkkel sender X-API-Key + riktig spørring og parser HTML-konvolutten', async () => {
    const { impl, calls } = fakeFetch((url, headers) => {
      expect(headers['X-API-Key']).toBe('min-nøkkel');
      expect(url).toContain('/renderRefID');
      expect(url).toContain('format=json');
      expect(decodeURIComponent(url)).toContain('refID=NL/lov/1999-03-26-14/§6-20');
      return { status: 200, body: { html: '<p>§ 6-20. Fradrag for fagforeningskontingent …</p>' } };
    });
    const client = new LovdataApiClient('min-nøkkel', impl);
    const res = await client.fetchLegalText('NL/lov/1999-03-26-14/§6-20');
    expect(res.found).toBe(true);
    expect(res.html).toContain('fagforeningskontingent');
    expect(calls).toHaveLength(1);
  });

  it('fetchLegalText() mapper statuskoder til presise feil', async () => {
    const auth = new LovdataApiClient('k', fakeFetch(() => ({ status: 401 })).impl);
    await expect(auth.fetchLegalText('NL/lov/1999-03-26-14')).rejects.toBeInstanceOf(LovdataAuthError);

    const forbidden = new LovdataApiClient('k', fakeFetch(() => ({ status: 403 })).impl);
    await expect(forbidden.fetchLegalText('NL/lov/1999-03-26-14')).rejects.toBeInstanceOf(
      LovdataAccessError,
    );

    const notFound = new LovdataApiClient('k', fakeFetch(() => ({ status: 404 })).impl);
    const res = await notFound.fetchLegalText('NL/lov/9999-99-99-99');
    expect(res.found).toBe(false);
    expect(res.html).toBe('');
  });
});

describe('Lovdata refID-hjelpere', () => {
  it('utleder base-refID fra lovdata.no-URL', () => {
    expect(lawRefIDFromUrl('https://lovdata.no/dokument/NL/lov/1999-03-26-14')).toBe(
      'NL/lov/1999-03-26-14',
    );
    expect(lawRefIDFromUrl('https://lovdata.no/dokument/NL/forskrift/2004-11-19-73')).toBe(
      'NL/forskrift/2004-11-19-73',
    );
    expect(lawRefIDFromUrl('https://www.skatteetaten.no/satser/')).toBeNull();
  });

  it('normaliserer paragrafstrenger til §-notasjon', () => {
    expect(normalizeParagraph('§ 6-20')).toBe('§6-20');
    expect(normalizeParagraph('sktl. § 6-20 (antatt — må verifiseres)')).toBe('§6-20');
    expect(normalizeParagraph('14-41')).toBe('§14-41');
    expect(normalizeParagraph('ingen paragraf her')).toBeNull();
  });

  it('bygger refID ned til paragraf, eller base uten paragraf', () => {
    expect(buildLawRefID('NL/lov/1999-03-26-14', '§ 6-20')).toBe('NL/lov/1999-03-26-14/§6-20');
    expect(buildLawRefID('NL/lov/1999-03-26-14')).toBe('NL/lov/1999-03-26-14');
  });
});

describe('Kobling regel → offisiell lovtekst', () => {
  const register = buildNorwegianRuleRegister();

  it('legalReferenceRefID mapper fradragsregelen til skattelovens paragraf', () => {
    const rule = register.getRule('no.deduction.union-fee');
    expect(legalReferenceRefID(rule, register)).toBe('NL/lov/1999-03-26-14/§6-20');
  });

  it('en stub kan levere den ordrette lovteksten for refID-en (offisiell kilde, ikke hukommelse)', async () => {
    const rule = register.getRule('no.deduction.union-fee');
    const refID = legalReferenceRefID(rule, register)!;
    const stub = new StaticLovdataStub({
      [refID]: {
        refID,
        found: true,
        html: '<p>§ 6-20. Særskilt fradrag for fagforeningskontingent …</p>',
        raw: null,
      } satisfies LegalTextResult,
    });
    const text = await stub.fetchLegalText(refID);
    expect(text.found).toBe(true);
    expect(text.html).toContain('fagforeningskontingent');
  });

  it('stub uten nøkkel oppfører seg som klienten: kaster LovdataAuthError', async () => {
    const stub = new StaticLovdataStub({}, [], { hasApiKey: false });
    expect(stub.hasApiKey).toBe(false);
    await expect(stub.fetchLegalText('NL/lov/1999-03-26-14')).rejects.toBeInstanceOf(
      LovdataAuthError,
    );
  });
});
