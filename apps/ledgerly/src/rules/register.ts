import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import type {
  OrganizationForm,
  Rational,
  RuleSource,
  TaxRule,
  TaxRuleVersion,
  VatRegistrationStatus,
} from './types.js';
import { parseRationalParam } from './types.js';

/**
 * Regelregisteret er et rent oppslagsverk: gitt en regel-ID og en dato,
 * finn versjonen som gjaldt på datoen. All beregning skjer i deterministisk
 * kode som henter parametre herfra.
 */
export class RuleRegister {
  private rules = new Map<string, TaxRule>();
  private sources = new Map<string, RuleSource>();

  registerSource(source: RuleSource): void {
    if (this.sources.has(source.sourceId)) {
      throw new ConflictError(`Kilde ${source.sourceId} er allerede registrert`);
    }
    this.sources.set(source.sourceId, source);
  }

  registerRule(rule: TaxRule): void {
    if (this.rules.has(rule.ruleId)) {
      throw new ConflictError(`Regel ${rule.ruleId} er allerede registrert`);
    }
    for (const sid of rule.sourceIds) {
      if (!this.sources.has(sid)) {
        throw new ValidationError(`Regel ${rule.ruleId} refererer til ukjent kilde ${sid}`);
      }
    }
    this.assertNonOverlappingVersions(rule);
    this.rules.set(rule.ruleId, rule);
  }

  private assertNonOverlappingVersions(rule: TaxRule): void {
    const sorted = [...rule.versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (!prev.validTo || prev.validTo >= curr.validFrom) {
        throw new ValidationError(
          `Regel ${rule.ruleId}: versjonene ${prev.version} og ${curr.version} overlapper i tid`,
        );
      }
    }
  }

  getRule(ruleId: string): TaxRule {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new NotFoundError(`Ukjent regel: ${ruleId}`);
    return rule;
  }

  getSource(sourceId: string): RuleSource {
    const s = this.sources.get(sourceId);
    if (!s) throw new NotFoundError(`Ukjent kilde: ${sourceId}`);
    return s;
  }

  listRules(): TaxRule[] {
    return [...this.rules.values()];
  }

  listSources(): RuleSource[] {
    return [...this.sources.values()];
  }

  /**
   * Regler som ennå ikke er fagkontrollert. Disse skal aldri presenteres som
   * endelige — kun som forslag med tydelig forbehold. Brukes til å drive
   * «må-fagkontrolleres»-varsler og til å holde oversikt før produksjon.
   */
  rulesNeedingVerification(): TaxRule[] {
    return [...this.rules.values()].filter((r) => r.needsProfessionalVerification === true);
  }

  /** Kilder med offisielt, maskinlesbart API (lovlig innhenting vs. skraping). */
  sourcesWithApi(): RuleSource[] {
    return [...this.sources.values()].filter((s) => s.apiUrl !== undefined);
  }

  /** Finner regelversjonen som gjaldt på gitt ISO-dato. */
  getVersionAt(ruleId: string, isoDate: string): TaxRuleVersion {
    const rule = this.getRule(ruleId);
    const match = rule.versions.find(
      (v) => v.validFrom <= isoDate && (!v.validTo || v.validTo >= isoDate),
    );
    if (!match) {
      throw new NotFoundError(`Regel ${ruleId} har ingen gyldig versjon per ${isoDate}`);
    }
    return match;
  }

  /** Henter en rasjonal parameter (f.eks. en sats) fra regelversjonen på gitt dato. */
  getRationalParamAt(ruleId: string, paramName: string, isoDate: string): Rational {
    const version = this.getVersionAt(ruleId, isoDate);
    const p = version.parameters[paramName];
    if (p === undefined) {
      throw new NotFoundError(`Regel ${ruleId} v${version.version} mangler parameter ${paramName}`);
    }
    return parseRationalParam(p);
  }

  appliesTo(
    ruleId: string,
    orgForm: OrganizationForm,
    vatStatus: VatRegistrationStatus,
  ): boolean {
    const rule = this.getRule(ruleId);
    const orgOk = rule.appliesToOrgForms === 'all' || rule.appliesToOrgForms.includes(orgForm);
    const vatOk =
      rule.appliesToVatStatus === 'all' || rule.appliesToVatStatus.includes(vatStatus);
    return orgOk && vatOk;
  }
}
