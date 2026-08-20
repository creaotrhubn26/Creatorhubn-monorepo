import { describe, expect, it } from 'vitest';
import { purchaseGuidanceFor, suggestBankCategory } from '../src/bank/categorize.js';

describe('suggestBankCategory — deterministisk «hva dette kan være»', () => {
  it('gjenkjenner bankgebyr på utbetaling', () => {
    const s = suggestBankCategory({ description: 'Månedsgebyr bedriftskonto', counterparty: null, amountMinor: -6500n, orgForm: 'AS' });
    expect(s).toMatchObject({ key: 'bankgebyr', account: '7770' });
    expect(s?.reason).toContain('gebyr');
  });

  it('gjenkjenner ekte SpareBank 1-tekster som bankgebyr', () => {
    for (const desc of ['Transpris Nettbank Bedrift', 'Prisbelastning kontohold', 'Månedspris Nettbank Bedrift']) {
      expect(suggestBankCategory({ description: desc, amountMinor: -4900n, orgForm: 'AS' })?.key).toBe('bankgebyr');
    }
  });

  it('gjenkjenner skatt før gebyr (spesifisitet)', () => {
    const s = suggestBankCategory({ description: 'Skatteetaten forskuddsskatt', counterparty: 'SKATTEETATEN', amountMinor: -1200000n, orgForm: 'AS' });
    expect(s?.key).toBe('skatt');
  });

  it('skiller rente inn vs ut på fortegn', () => {
    expect(suggestBankCategory({ description: 'Renter', amountMinor: -100n, orgForm: 'AS' })?.key).toBe('rentekostnad');
    expect(suggestBankCategory({ description: 'Renter', amountMinor: 100n, orgForm: 'AS' })?.key).toBe('renteinntekt');
  });

  it('foreslår privatuttak KUN for ENK (organisasjonsform respekteres)', () => {
    expect(suggestBankCategory({ description: 'Privatuttak', amountMinor: -500000n, orgForm: 'ENK' })?.key).toBe('privatuttak');
    // AS: privatuttak gjelder ikke → ingen regel treffer denne teksten for AS
    expect(suggestBankCategory({ description: 'Privatuttak', amountMinor: -500000n, orgForm: 'AS' })).toBeNull();
  });

  it('bruker riktig skattekonto per organisasjonsform', () => {
    expect(suggestBankCategory({ description: 'Restskatt', amountMinor: -1n, orgForm: 'ENK' })?.account).toBe('2060');
    expect(suggestBankCategory({ description: 'Restskatt', amountMinor: -1n, orgForm: 'AS' })?.account).toBe('2500');
  });

  it('returnerer null (ærlig, ingen gjetning) når ingenting treffer', () => {
    expect(suggestBankCategory({ description: 'Vipps til Ola', counterparty: 'Ola Nordmann', amountMinor: -25000n, orgForm: 'AS' })).toBeNull();
  });
});

describe('purchaseGuidanceFor — guidet spørsmål for tvetydige butikkjøp', () => {
  it('stiller spørsmål for dagligvare/servering-kjøp (utbetaling)', () => {
    for (const desc of ['REMA 1000 OSLO', 'KIWI MINIPRIS', 'Coop Extra', 'Vinmonopolet', 'Restaurant Louise']) {
      const g = purchaseGuidanceFor({ description: desc, amountMinor: -19900n });
      expect(g).toBeTruthy();
      expect(g).toContain('bedriftskjøp');
      expect(g).toContain('privat');
    }
  });

  it('ingen guidance for tydelige ikke-butikk-tekster eller innbetalinger', () => {
    expect(purchaseGuidanceFor({ description: 'Transpris Nettbank Bedrift', amountMinor: -4900n })).toBeNull();
    expect(purchaseGuidanceFor({ description: 'KIWI MINIPRIS', amountMinor: 19900n })).toBeNull(); // innbetaling
  });
});
