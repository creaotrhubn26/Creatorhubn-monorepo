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
  /** URL til offisiell kilde (menneskelesbar). */
  url: string;
  /**
   * Maskinlesbart, offisielt API-endepunkt når kilden tilbyr det.
   * Brukes til lovlig, lisensiert innhenting i stedet for skraping —
   * f.eks. Lovdata API (lovtekst) eller Skatteetatens datadeling (satser).
   */
  apiUrl?: string;
  /** Lisens for maskinlesbar gjenbruk, f.eks. 'NLOD 2.0'. */
  license?: string;
  /**
   * Tilgangsmodell for API-et: 'open' = fritt/ingen nøkkel (Lovdata API),
   * 'granted' = krever innvilget tilgang/Maskinporten (Skatteetatens datadeling).
   */
  apiAccess?: 'open' | 'granted';
  /** Når kilden sist ble kontrollert mot regelinnholdet (ISO-dato). */
  lastVerified: string;
  verifiedBy: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Skattyter-målgruppe for en regel (særlig fradragskatalogen):
 * A = enkeltpersonforetak, B = aksjeselskap/SMB, C = privatperson/lønnstaker.
 * En regel kan gjelde flere. Tom/utelatt = generell.
 */
export type TaxpayerGroup = 'sole-proprietor' | 'company' | 'personal';

/**
 * Fradragsbehandling — skillet ikke-regnskapsførere oftest bommer på:
 *  - direct-expense: kostnadsføres direkte i året
 *  - capitalize-depreciate: aktiveres som eiendel og avskrives over tid
 *  - personal-deduction: fradrag i den personlige skattemeldingen
 *  - not-deductible: ikke fradragsberettiget (f.eks. representasjon som hovedregel)
 */
export type DeductionTreatment =
  | 'direct-expense'
  | 'capitalize-depreciate'
  | 'personal-deduction'
  | 'not-deductible';

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

  // ── Fradragskatalog-metadata (valgfritt; utelatt = eldre satsregler) ──────
  /** Skattyter-målgruppe(r). Utelatt = generell regel. */
  taxpayerGroups?: TaxpayerGroup[];
  /** Hjemmelsreferanse (paragraf), f.eks. 'sktl. § 6-20'. */
  legalReference?: string;
  /** Direkte kostnadsføring vs. aktivering vs. personfradrag vs. ikke fradrag. */
  deductionTreatment?: DeductionTreatment;
  /**
   * Krever kontroll av statsautorisert regnskapsfører/skatterådgiver før
   * produksjonsbruk. Regler med dette flagget skal ALDRI presenteres som
   * endelige — kun som forslag med tydelig forbehold.
   */
  needsProfessionalVerification?: boolean;
  /** Hva som konkret må fagkontrolleres (paragraf, årsbeløp, kildekvalitet). */
  verificationNote?: string;
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
