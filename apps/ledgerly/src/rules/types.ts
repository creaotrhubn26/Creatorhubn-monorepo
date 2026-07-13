/**
 * Versjonert regel- og kilderegister for norsk regnskap, skatt og MVA.
 *
 * Satser, grenser og frister skal ALDRI hardkodes rundt i applikasjonen.
 * De hentes herfra, med gyldighetsperiode, kilde og versjon.
 * Juridisk/matematisk sannhet ligger i deterministisk kode + disse tabellene,
 * aldri i en språkmodellprompt.
 */

export type OrganizationForm = 'ENK' | 'AS' | 'ANS' | 'DA' | 'SA' | 'NUF';

export type VatRegistrationStatus = 'registered' | 'not_registered' | 'pending';

export type SourceType =
  | 'lov' // Lovdata: lover og forskrifter
  | 'forskrift'
  | 'skatteetaten' // Skatteetatens veiledninger og satser
  | 'altinn'
  | 'bronnoysund'
  | 'regnskapsstandard' // NRS m.m.
  | 'saf-t-dokumentasjon'
  | 'google-dokumentasjon';

export interface RuleSource {
  sourceId: string;
  title: string;
  type: SourceType;
  /** URL til offisiell kilde. */
  url: string;
  /** Når kilden sist ble kontrollert mot regelinnholdet (ISO-dato). */
  lastVerified: string;
  verifiedBy: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface TaxRuleVersion {
  version: number;
  /** ISO-dato regelen gjelder fra (inklusiv). */
  validFrom: string;
  /** ISO-dato regelen gjelder til (inklusiv), udefinert = fortsatt gyldig. */
  validTo?: string;
  /** Numeriske parametre som rasjonale tall (teller/nevner) eller heltall — aldri flyttall. */
  parameters: Record<string, { numerator: string; denominator: string } | string>;
  changeNote?: string;
}

export interface TaxRule {
  ruleId: string;
  shortName: string;
  /** Forklaring på vanlig norsk, uten fagsjargong. */
  plainExplanation: string;
  technicalExplanation: string;
  sourceIds: string[];
  appliesToOrgForms: OrganizationForm[] | 'all';
  appliesToVatStatus: VatRegistrationStatus[] | 'all';
  /** Bransjer/situasjoner, fritekst-tagger, tom = generell. */
  appliesToSituations: string[];
  calculationMethod: string;
  documentationRequirements: string[];
  riskLevel: RiskLevel;
  lastReviewed: string;
  reviewedBy: string;
  versions: TaxRuleVersion[];
}

/** Rasjonalt tall for eksakt aritmetikk. */
export interface Rational {
  numerator: bigint;
  denominator: bigint;
}

export function rational(numerator: bigint | number, denominator: bigint | number): Rational {
  return { numerator: BigInt(numerator), denominator: BigInt(denominator) };
}

export function parseRationalParam(
  p: { numerator: string; denominator: string } | string,
): Rational {
  if (typeof p === 'string') return { numerator: BigInt(p), denominator: 1n };
  return { numerator: BigInt(p.numerator), denominator: BigInt(p.denominator) };
}
