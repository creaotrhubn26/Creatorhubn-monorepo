import { describe, expect, it } from 'vitest';
import { assessCompanyRisk } from '../src/ledger/company-risk.js';
import type { CompanyProfile } from '../src/integrations/company-registry.js';

const at = '2026-07-25';
const base = (over: Partial<CompanyProfile>): CompanyProfile => ({ found: true, orgNumber: '910023764', name: 'Test AS', orgForm: 'AS', registeredInVatRegister: true, bankrupt: false, underLiquidation: false, forcedLiquidation: false, deletedDate: null, foundedDate: '2015-01-01', ...over });

describe('assessCompanyRisk', () => {
  it('aktiv virksomhet → ok, ett «i orden»-signal', () => {
    const r = assessCompanyRisk('910023764', base({}), { checkedAt: at });
    expect(r.overall).toBe('ok');
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0]!.code).toBe('aktiv');
    // Kilde er alltid oppgitt.
    expect(r.signals[0]!.source).toContain('Enhetsregisteret');
    // Ingen automatisk kredittscore.
    expect(r.creditNote.toLowerCase()).toContain('ingen automatisk kredittgrense');
    expect(r.disclaimer.toLowerCase()).toContain('ikke en automatisk risikoscore');
  });

  it('ukjent org.nr → risk', () => {
    const r = assessCompanyRisk('999999999', { found: false, orgNumber: '999999999' }, { checkedAt: at });
    expect(r.overall).toBe('risk');
    expect(r.signals[0]!.code).toBe('ikke_funnet');
  });

  it('konkurs + slettet → flere risiko-signaler, samlet risk', () => {
    const r = assessCompanyRisk('910023764', base({ bankrupt: true, deletedDate: '2025-03-01' }), { checkedAt: at });
    expect(r.overall).toBe('risk');
    expect(r.signals.map((s) => s.code)).toEqual(expect.arrayContaining(['slettet', 'konkurs']));
  });

  it('under avvikling → oppmerksomhet', () => {
    const r = assessCompanyRisk('910023764', base({ underLiquidation: true }), { checkedAt: at });
    expect(r.overall).toBe('attention');
    expect(r.signals.some((s) => s.code === 'under_avvikling')).toBe(true);
  });

  it('MVA på faktura men ikke i MVA-registeret → avviks-signal', () => {
    const r = assessCompanyRisk('910023764', base({ registeredInVatRegister: false }), { checkedAt: at, invoiceHasVat: true });
    expect(r.signals.some((s) => s.code === 'mva_avvik')).toBe(true);
  });

  it('nystiftet under seks måneder → oppmerksomhet', () => {
    const r = assessCompanyRisk('910023764', base({ foundedDate: '2026-05-01' }), { checkedAt: at });
    expect(r.signals.some((s) => s.code === 'nystiftet')).toBe(true);
  });

  it('EHF-status er ærlig «ukjent» (ELMA ikke automatisert)', () => {
    const r = assessCompanyRisk('910023764', base({}), { checkedAt: at });
    expect(r.ehf.status).toBe('unknown');
    expect(r.ehf.note).toContain('ELMA');
  });
});
