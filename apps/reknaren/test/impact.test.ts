import { describe, expect, it } from 'vitest';
import { computeDocumentImpact } from '../src/pipeline/impact.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';

const rules = buildNorwegianRuleRegister();
const iso = '2026-02-01';

describe('computeDocumentImpact', () => {
  it('splitter norsk 25 %-kjøp i fradragsberettiget MVA + kostnad til resultat', () => {
    // Adobe-eksempelet: 1245 kr brutto med 25 % → 249 kr inngående MVA, 996 kr kostnad.
    const r = computeDocumentImpact(rules, {
      grossMinor: 124500n,
      currency: 'NOK',
      vatCode: '1',
      businessUsePercentage: 100,
      capitalization: 'expense',
      orgForm: 'AS',
      isoDate: iso,
    });
    expect(r.computable).toBe(true);
    expect(r.deductibleInputVatMinor).toBe(24900n); // 249,00 kr
    expect(r.costToResultMinor).toBe(99600n); // 996,00 kr
    expect(r.deductibleInputVatMinor + r.costToResultMinor).toBe(124500n); // ingen kroner forsvinner
    // Selskapsskatt 22 % av kostnaden ≈ 219,12 kr redusert skatt.
    expect(r.taxEffect?.reducesTaxByMinor).toBe(21912n);
    expect(r.taxEffect?.combinedRateLabel).toBe('22 %');
  });

  it('ENK får både inntektsskatt og trygdeavgift i skatteeffekten', () => {
    const r = computeDocumentImpact(rules, {
      grossMinor: 124500n,
      currency: 'NOK',
      vatCode: '1',
      businessUsePercentage: 100,
      capitalization: 'expense',
      orgForm: 'ENK',
      isoDate: iso,
    });
    expect(r.taxEffect?.components).toHaveLength(2);
    // to satser summeres — mer enn selskapsskatten alene
    expect(r.taxEffect!.reducesTaxByMinor).toBeGreaterThan(21912n);
  });

  it('respekterer næringsandel — privat del holdes utenfor kostnad og MVA', () => {
    const r = computeDocumentImpact(rules, {
      grossMinor: 100000n,
      currency: 'NOK',
      vatCode: '1',
      businessUsePercentage: 50,
      capitalization: 'expense',
      orgForm: 'AS',
      isoDate: iso,
    });
    expect(r.businessGrossMinor).toBe(50000n);
    expect(r.privateGrossMinor).toBe(50000n);
    // MVA + kostnad beregnes kun av næringsdelen (50 000 øre)
    expect(r.deductibleInputVatMinor + r.costToResultMinor).toBe(50000n);
  });

  it('aktiverer store beløp: ingen kostnad i år, men MVA trekkes fullt', () => {
    const r = computeDocumentImpact(rules, {
      grossMinor: 5000000n,
      currency: 'NOK',
      vatCode: '1',
      businessUsePercentage: 100,
      capitalization: 'asset',
      orgForm: 'AS',
      isoDate: iso,
    });
    expect(r.capitalized).toBe(true);
    expect(r.deductibleInputVatMinor).toBeGreaterThan(0n); // MVA trekkes umiddelbart
    expect(r.taxEffect).toBeNull(); // spres over år via avskrivning
  });

  it('utenlandsk valuta uten kurs: ikke beregnbar, ærlig forklaring', () => {
    const r = computeDocumentImpact(rules, {
      grossMinor: 10000n,
      currency: 'EUR',
      vatCode: '86',
      businessUsePercentage: 100,
      capitalization: 'expense',
      orgForm: 'AS',
      isoDate: iso,
    });
    expect(r.computable).toBe(false);
    expect(r.reason).toContain('EUR');
  });

  it('manglende beløp: ikke beregnbar', () => {
    const r = computeDocumentImpact(rules, {
      grossMinor: null,
      currency: 'NOK',
      vatCode: '1',
      businessUsePercentage: 100,
      capitalization: 'expense',
      orgForm: 'AS',
      isoDate: iso,
    });
    expect(r.computable).toBe(false);
  });
});
