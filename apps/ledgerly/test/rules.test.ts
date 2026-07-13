import { describe, expect, it } from 'vitest';
import { RuleRegister } from '../src/rules/register.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { NotFoundError, ValidationError } from '../src/shared/errors.js';

describe('Versjonert regelregister', () => {
  const register = buildNorwegianRuleRegister();

  it('finner riktig sats per dato', () => {
    const rate = register.getRationalParamAt('no.vat.rate.standard', 'rate', '2025-06-01');
    expect(rate.numerator).toBe(25n);
    expect(rate.denominator).toBe(100n);
  });

  it('regelendring midt i tidslinjen: aktiveringsgrensen 2023 vs. 2024', () => {
    const v2023 = register.getVersionAt('no.asset.expense-threshold', '2023-06-01');
    const v2024 = register.getVersionAt('no.asset.expense-threshold', '2024-06-01');
    expect(v2023.parameters['thresholdNokMinor']).toBe('1500000');
    expect(v2024.parameters['thresholdNokMinor']).toBe('3000000');
  });

  it('trygdeavgift har egne versjoner for 2024 og 2025', () => {
    expect(
      register.getRationalParamAt('no.tax.social-security-self-employed', 'rate', '2024-06-01')
        .numerator,
    ).toBe(110n);
    expect(
      register.getRationalParamAt('no.tax.social-security-self-employed', 'rate', '2025-06-01')
        .numerator,
    ).toBe(109n);
  });

  it('feiler tydelig når ingen versjon gjelder for datoen', () => {
    expect(() => register.getVersionAt('no.vat.rate.standard', '1999-01-01')).toThrow(
      NotFoundError,
    );
  });

  it('avviser overlappende versjoner', () => {
    const r = new RuleRegister();
    expect(() =>
      r.registerRule({
        ruleId: 'test.overlap',
        shortName: 'x',
        plainExplanation: 'x',
        technicalExplanation: 'x',
        sourceIds: [],
        appliesToOrgForms: 'all',
        appliesToVatStatus: 'all',
        appliesToSituations: [],
        calculationMethod: 'x',
        documentationRequirements: [],
        riskLevel: 'low',
        lastReviewed: '2026-01-01',
        reviewedBy: 'test',
        versions: [
          { version: 1, validFrom: '2020-01-01', parameters: {} },
          { version: 2, validFrom: '2022-01-01', parameters: {} },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it('avviser regler med ukjente kilder', () => {
    const r = new RuleRegister();
    expect(() =>
      r.registerRule({
        ruleId: 'test.unknown-source',
        shortName: 'x',
        plainExplanation: 'x',
        technicalExplanation: 'x',
        sourceIds: ['finnes-ikke'],
        appliesToOrgForms: 'all',
        appliesToVatStatus: 'all',
        appliesToSituations: [],
        calculationMethod: 'x',
        documentationRequirements: [],
        riskLevel: 'low',
        lastReviewed: '2026-01-01',
        reviewedBy: 'test',
        versions: [{ version: 1, validFrom: '2020-01-01', parameters: {} }],
      }),
    ).toThrow(ValidationError);
  });

  it('alle norske regler har offisiell kilde og kontrolldato', () => {
    for (const rule of register.listRules()) {
      expect(rule.sourceIds.length, `${rule.ruleId} mangler kilde`).toBeGreaterThan(0);
      expect(rule.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const sid of rule.sourceIds) {
        const source = register.getSource(sid);
        expect(source.url).toMatch(/^https:\/\//);
        expect(['lov', 'forskrift', 'skatteetaten', 'altinn', 'bronnoysund', 'regnskapsstandard', 'saf-t-dokumentasjon', 'google-dokumentasjon']).toContain(source.type);
      }
    }
  });

  it('regelfiltrering på organisasjonsform og mva-status', () => {
    expect(register.appliesTo('no.tax.corporate-rate', 'AS', 'registered')).toBe(true);
    expect(register.appliesTo('no.tax.corporate-rate', 'ENK', 'registered')).toBe(false);
    expect(register.appliesTo('no.vat.rate.standard', 'ENK', 'not_registered')).toBe(false);
  });
});
