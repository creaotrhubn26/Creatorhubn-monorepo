/**
 * Kildekritisk fradragshjelper: verdiktet (fradrag ja/nei/avhenger) kommer ALLTID
 * fra kontoplanens taxDeductible-flagg — aldri fra språkmodellen. AI-en formulerer
 * bare forklaringen, forankret i de hentede kontofaktaene.
 */
import { describe, expect, it } from 'vitest';
import { assessDeduction, findCandidateAccounts } from '../src/ledger/deduction-advisor.js';

function fakeAnthropic(accountNumber: string, summary: string) {
  return async () => ({ status: 200, ok: true, json: async () => ({ content: [{ type: 'tool_use', input: { accountNumber, summary } }] }) });
}

describe('findCandidateAccounts', () => {
  it('matcher deterministisk på nøkkelord', () => {
    expect(findCandidateAccounts('kontorrekvisita').map((a) => a.number)).toContain('6800');
    expect(findCandidateAccounts('kamera til opptak').map((a) => a.number)).toContain('1280');
    expect(findCandidateAccounts('xyzqwerty tull')).toHaveLength(0);
  });
});

describe('assessDeduction — kildekritisk', () => {
  it('uten AI: deterministisk konto + verdikt fra flagget', async () => {
    const a = await assessDeduction('kontorrekvisita'); // ingen apiKey
    expect(a.aiUsed).toBe(false);
    expect(a.source!.accountNumber).toBe('6800');
    expect(a.verdict).toBe(a.source!.taxDeductible); // 'yes'
    expect(a.disclaimer).toContain('ikke bindende skatteråd');
  });

  it('VERDIKTET overstyres ALDRI av AI-ens påstand', async () => {
    // AI velger 1280 (taxDeductible='depends') men påstår «trekk fra alt 100 %».
    const a = await assessDeduction('kamera til opptak', {
      apiKey: 'k', fetchImpl: fakeAnthropic('1280', 'Ja, dette kan du helt sikkert trekke fra 100 %!'),
    });
    expect(a.aiUsed).toBe(true);
    expect(a.source!.accountNumber).toBe('1280');
    expect(a.verdict).toBe('depends'); // fra flagget, IKKE 'yes' fra AI-teksten
    expect(a.source!.plainExplanation).toBeTruthy(); // kilden vises alltid
  });

  it('AI kan bare velge blant kandidatene (svarer none → ukjent)', async () => {
    const a = await assessDeduction('kontorrekvisita', { apiKey: 'k', fetchImpl: fakeAnthropic('none', 'Ingen passer helt.') });
    expect(a.verdict).toBe('unknown');
    expect(a.alternatives.length).toBeGreaterThan(0); // viser likevel kandidatene
  });

  it('ingen match → ukjent, ber om mer info', async () => {
    const a = await assessDeduction('xyzqwerty tull');
    expect(a.verdict).toBe('unknown');
    expect(a.source).toBeNull();
  });

  it('AI-feil (ikke-ok svar) → faller tilbake til deterministisk, ikke kast', async () => {
    const a = await assessDeduction('kontorrekvisita', { apiKey: 'k', fetchImpl: (async () => ({ status: 500, ok: false, json: async () => ({}) })) });
    expect(a.aiUsed).toBe(false);
    expect(a.source!.accountNumber).toBe('6800');
    expect(a.verdict).toBe('yes');
  });
});
