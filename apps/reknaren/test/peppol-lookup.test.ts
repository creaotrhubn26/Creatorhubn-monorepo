/**
 * PEPPOL/ELMA-oppslag: kan mottaker ta imot EHF-faktura? Ren lesing mot
 * OpenPeppols katalog, mock-et her (deterministisk, ingen nett i test).
 */
import { describe, expect, it } from 'vitest';
import { classifyDocTypes, lookupPeppolParticipant } from '../src/invoicing/peppol-lookup.js';

const EHF_INVOICE = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1';
const CREDITNOTE = 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1';

function fakeFetch(status: number, body: unknown) {
  return async () => ({ status, ok: status >= 200 && status < 300, json: async () => body, text: async () => JSON.stringify(body) });
}

describe('classifyDocTypes', () => {
  it('kjenner igjen EHF/BIS Billing 3.0-faktura', () => {
    expect(classifyDocTypes([EHF_INVOICE])).toBe(true);
    expect(classifyDocTypes([CREDITNOTE])).toBe(false); // bare kreditnota → ikke faktura
    expect(classifyDocTypes([])).toBe(false);
  });
});

describe('lookupPeppolParticipant', () => {
  it('avviser ugyldig organisasjonsnummer uten nettverkskall', async () => {
    let called = false;
    const r = await lookupPeppolParticipant('123', { fetchImpl: (async () => { called = true; return { status: 200, ok: true, json: async () => ({}), text: async () => '' }; }) });
    expect(r.registered).toBe(false);
    expect(called).toBe(false);
  });

  it('registrert + støtter EHF når katalogen har faktura-dokumenttypen', async () => {
    const body = { matches: [{ entities: [{ name: 'EQUINOR ASA' }], docTypes: [{ value: EHF_INVOICE }, { value: CREDITNOTE }] }] };
    const r = await lookupPeppolParticipant('923609016', { fetchImpl: fakeFetch(200, body) });
    expect(r.registered).toBe(true);
    expect(r.supportsEhfInvoice).toBe(true);
    expect(r.name).toBe('EQUINOR ASA');
    expect(r.participantId).toBe('0192:923609016');
  });

  it('registrert men uten faktura-tjeneste → supportsEhfInvoice=false', async () => {
    const body = { matches: [{ entities: [{ name: 'X' }], docTypes: [{ value: CREDITNOTE }] }] };
    const r = await lookupPeppolParticipant('987654321', { fetchImpl: fakeFetch(200, body) });
    expect(r.registered).toBe(true);
    expect(r.supportsEhfInvoice).toBe(false);
  });

  it('ikke funnet i katalogen → ikke registrert', async () => {
    const r = await lookupPeppolParticipant('987654321', { fetchImpl: fakeFetch(200, { matches: [] }) });
    expect(r.registered).toBe(false);
    expect(r.supportsEhfInvoice).toBe(false);
  });

  it('nettverksfeil håndteres ærlig (ikke kast)', async () => {
    const r = await lookupPeppolParticipant('987654321', { fetchImpl: (async () => { throw new Error('timeout'); }) });
    expect(r.registered).toBe(false);
    expect(r.note).toContain('kontakt');
  });
});
