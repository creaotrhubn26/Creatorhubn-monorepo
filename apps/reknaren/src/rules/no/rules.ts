import type { TaxRule } from '../types.js';
import { RuleRegister } from '../register.js';
import { NORWEGIAN_SOURCES } from './sources.js';

/**
 * Norske grunnregler, versjonert.
 *
 * VIKTIG OM DATAKVALITET: Verdiene her er lagt inn per kunnskapsdato 2026-01
 * og må kontrolleres mot Skatteetaten før produksjonsbruk for inntektsåret 2026.
 * Se docs/compliance-source-register.md. Registeret er bygget nettopp for at
 * slike kontroller og fremtidige satsendringer skal kunne gjøres ETT sted,
 * med gyldighetsperiode og revisjonshistorikk.
 */
export const NORWEGIAN_RULES: TaxRule[] = [
  {
    ruleId: 'no.vat.rate.standard',
    shortName: 'MVA ordinær sats',
    plainExplanation:
      'De fleste varer og tjenester har 25 prosent merverdiavgift. Selger du for 100 kroner pluss mva, legger du til 25 kroner.',
    technicalExplanation:
      'Alminnelig sats etter Stortingets årlige merverdiavgiftsvedtak § 2, jf. mval. § 5-1. 25 % siden 1. januar 2005.',
    sourceIds: ['stortinget-mva-vedtak', 'skatteetaten-mva-satser', 'lovdata-mval'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: ['registered'],
    appliesToSituations: [],
    calculationMethod: 'utgående = grunnlag × sats; mva-andel av bruttobeløp = brutto × sats/(100+sats)',
    documentationRequirements: ['Salgsdokument etter bokføringsforskriften kap. 5'],
    riskLevel: 'low',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2005-01-01',
        parameters: { rate: { numerator: '25', denominator: '100' } },
      },
    ],
  },
  {
    ruleId: 'no.vat.rate.food',
    shortName: 'MVA næringsmidler',
    plainExplanation: 'Mat og drikke (næringsmidler) har redusert sats på 15 prosent.',
    technicalExplanation:
      'Redusert sats for næringsmidler, jf. mval. § 5-2 og Stortingets mva-vedtak § 3. 15 % siden 1. januar 2012.',
    sourceIds: ['stortinget-mva-vedtak', 'skatteetaten-mva-satser', 'lovdata-mval'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: ['registered'],
    appliesToSituations: ['næringsmidler'],
    calculationMethod: 'som ordinær sats, med 15 %',
    documentationRequirements: ['Salgsdokument etter bokføringsforskriften kap. 5'],
    riskLevel: 'low',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2012-01-01',
        parameters: { rate: { numerator: '15', denominator: '100' } },
      },
    ],
  },
  {
    ruleId: 'no.vat.rate.low',
    shortName: 'MVA lav sats',
    plainExplanation:
      'Persontransport, overnatting, kinobilletter og enkelte andre tjenester har lav sats på 12 prosent.',
    technicalExplanation:
      'Lav sats, jf. mval. §§ 5-3 til 5-11 og Stortingets mva-vedtak § 4. 12 % siden 1. januar 2018 (midlertidig 6 % i 2020–2021 under pandemien er ikke lagt inn som egen versjon i MVP).',
    sourceIds: ['stortinget-mva-vedtak', 'skatteetaten-mva-satser', 'lovdata-mval'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: ['registered'],
    appliesToSituations: ['persontransport', 'overnatting', 'kino', 'museer', 'idrettsarrangement'],
    calculationMethod: 'som ordinær sats, med 12 %',
    documentationRequirements: ['Salgsdokument etter bokføringsforskriften kap. 5'],
    riskLevel: 'low',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2018-01-01',
        parameters: { rate: { numerator: '12', denominator: '100' } },
      },
    ],
  },
  {
    ruleId: 'no.vat.registration-threshold',
    shortName: 'MVA-registreringsgrense',
    plainExplanation:
      'Du må registrere virksomheten i Merverdiavgiftsregisteret når avgiftspliktig omsetning har passert 50 000 kroner i løpet av tolv måneder. Før det skal du ikke kreve inn mva.',
    technicalExplanation:
      'Registreringsplikt etter mval. § 2-1 første ledd: beløpsgrense 50 000 kr i en periode på tolv måneder.',
    sourceIds: ['lovdata-mval', 'skatteetaten-mva-registrering'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: ['not_registered', 'pending'],
    appliesToSituations: [],
    calculationMethod: 'løpende sum av avgiftspliktig omsetning siste 12 måneder sammenlignes med grensen',
    documentationRequirements: ['Omsetningsdokumentasjon som viser når grensen passeres'],
    riskLevel: 'medium',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2004-01-01',
        parameters: { thresholdNokMinor: '5000000' }, // 50 000,00 kr i øre
      },
    ],
  },
  {
    ruleId: 'no.tax.corporate-rate',
    shortName: 'Skattesats alminnelig inntekt (selskap)',
    plainExplanation: 'Aksjeselskap betaler 22 prosent skatt av skattepliktig overskudd.',
    technicalExplanation:
      'Skattesats på alminnelig inntekt for selskaper, jf. Stortingets skattevedtak. 22 % siden inntektsåret 2019.',
    sourceIds: ['skatteetaten-selskapsskatt', 'lovdata-sktl'],
    appliesToOrgForms: ['AS', 'NUF', 'SA'],
    appliesToVatStatus: 'all',
    appliesToSituations: [],
    calculationMethod: 'skattepliktig alminnelig inntekt × sats',
    documentationRequirements: ['Skattemelding med næringsspesifikasjon'],
    riskLevel: 'low',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2019-01-01',
        parameters: { rate: { numerator: '22', denominator: '100' } },
      },
    ],
  },
  {
    ruleId: 'no.tax.personal-base-rate',
    shortName: 'Skattesats alminnelig inntekt (person/ENK)',
    plainExplanation:
      'Overskudd i enkeltpersonforetak skattlegges som alminnelig inntekt med 22 prosent, pluss trygdeavgift og eventuell trinnskatt. Estimatet vårt viser komponentene hver for seg.',
    technicalExplanation:
      'Alminnelig inntekt for personlige skattytere: 22 % siden 2019. Trinnskatt og trygdeavgift kommer i tillegg og beregnes av personinntekt.',
    sourceIds: ['skatteetaten-selskapsskatt', 'lovdata-sktl'],
    appliesToOrgForms: ['ENK', 'ANS', 'DA'],
    appliesToVatStatus: 'all',
    appliesToSituations: [],
    calculationMethod: 'alminnelig inntekt × sats; trinnskatt/trygdeavgift beregnes separat',
    documentationRequirements: ['Skattemelding med næringsspesifikasjon'],
    riskLevel: 'medium',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2019-01-01',
        parameters: { rate: { numerator: '22', denominator: '100' } },
      },
    ],
  },
  {
    ruleId: 'no.tax.social-security-self-employed',
    shortName: 'Trygdeavgift næringsinntekt',
    plainExplanation:
      'Selvstendig næringsdrivende betaler trygdeavgift av næringsinntekten i tillegg til inntektsskatt.',
    technicalExplanation:
      'Trygdeavgift på næringsinntekt, folketrygdloven § 23-3. 11,0 % for 2024, 10,9 % for 2025, 10,8 % for 2026 (verifisert mot Skatteetaten).',
    sourceIds: ['skatteetaten-trygdeavgift'],
    appliesToOrgForms: ['ENK', 'ANS', 'DA'],
    appliesToVatStatus: 'all',
    appliesToSituations: [],
    calculationMethod: 'personinntekt fra næring × sats',
    documentationRequirements: [],
    riskLevel: 'medium',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
        parameters: { rate: { numerator: '110', denominator: '1000' } },
      },
      {
        version: 2,
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        parameters: { rate: { numerator: '109', denominator: '1000' } },
        changeNote: 'Sats redusert til 10,9 % fra 2025.',
      },
      {
        version: 3,
        validFrom: '2026-01-01',
        parameters: { rate: { numerator: '108', denominator: '1000' } },
        changeNote: 'Sats redusert til 10,8 % fra 2026 (Skatteetaten).',
      },
    ],
  },
  {
    ruleId: 'no.asset.expense-threshold',
    shortName: 'Grense for direkte kostnadsføring',
    plainExplanation:
      'Utstyr som koster mindre enn 30 000 kroner (eks. mva ved fradragsrett), eller som har kortere levetid enn tre år, kan kostnadsføres direkte. Dyrere utstyr med lengre levetid skal registreres som eiendel og avskrives over flere år.',
    technicalExplanation:
      'Sktl. § 14-40: driftsmiddel er betydelig når kostpris er 30 000 kr eller høyere (hevet fra 15 000 kr med virkning fra inntektsåret 2024) og varig når forventet levetid er minst 3 år.',
    sourceIds: ['skatteetaten-direkte-kostnadsforing', 'lovdata-sktl'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: 'all',
    appliesToSituations: [],
    calculationMethod: 'kostpris sammenlignes med grense; levetid vurderes',
    documentationRequirements: ['Kjøpsdokumentasjon med spesifikasjon av driftsmiddelet'],
    riskLevel: 'medium',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '1992-01-01',
        validTo: '2023-12-31',
        parameters: { thresholdNokMinor: '1500000' }, // 15 000,00 kr
      },
      {
        version: 2,
        validFrom: '2024-01-01',
        parameters: { thresholdNokMinor: '3000000' }, // 30 000,00 kr
        changeNote: 'Grensen hevet fra 15 000 til 30 000 kr fra inntektsåret 2024.',
      },
    ],
  },
  {
    ruleId: 'no.asset.depreciation-groups',
    shortName: 'Saldogrupper og avskrivningssatser',
    plainExplanation:
      'Eiendeler avskrives skattemessig etter saldometoden. Hver gruppe har sin maksimale årlige sats — for eksempel 30 prosent for kontormaskiner og 20 prosent for inventar og maskiner.',
    technicalExplanation:
      'Saldogrupper etter sktl. § 14-41 med maksimalsatser etter § 14-43. Satsene i parameters er prosent (teller/nevner).',
    sourceIds: ['skatteetaten-saldoavskrivning', 'lovdata-sktl'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: 'all',
    appliesToSituations: [],
    calculationMethod: 'saldo × gruppesats per inntektsår',
    documentationRequirements: ['Anleggsregister med kostpris, anskaffelsesdato og saldogruppe'],
    riskLevel: 'medium',
    lastReviewed: '2026-01-01',
    reviewedBy: 'system-bootstrap',
    versions: [
      {
        version: 1,
        validFrom: '2017-01-01',
        parameters: {
          'a.kontormaskiner': { numerator: '30', denominator: '100' },
          'b.forretningsverdi': { numerator: '20', denominator: '100' },
          'c.vogntog-lastebiler-busser': { numerator: '24', denominator: '100' },
          'd.personbiler-maskiner-inventar': { numerator: '20', denominator: '100' },
          'e.skip-fartoy': { numerator: '14', denominator: '100' },
          'f.fly-helikopter': { numerator: '12', denominator: '100' },
          'g.el-anlegg': { numerator: '5', denominator: '100' },
          'h.bygg-anlegg': { numerator: '4', denominator: '100' },
          'i.forretningsbygg': { numerator: '2', denominator: '100' },
          'j.tekniske-installasjoner': { numerator: '10', denominator: '100' },
        },
      },
    ],
  },
  // ── Fradragskatalog ────────────────────────────────────────────────────────
  // Første oppføring i fradragskatalogen (målgruppe C, privatperson/lønnstaker).
  // Lagt inn som fungerende eksempel på den nye strukturen. Kildekvalitet:
  // verifisert via WebSearch mot skatteetaten.no (3-0), IKKE direkte lest fra
  // primærkilden (henting blokkert). Derfor needsProfessionalVerification: true.
  {
    ruleId: 'no.deduction.union-fee',
    shortName: 'Fradrag for fagforeningskontingent',
    plainExplanation:
      'Betalt fagforeningskontingent gir fradrag i inntekten opp til et årlig maksbeløp. Taket gjelder samlet uansett hvor mange fagforeninger du er medlem av, og beløpet er normalt forhåndsutfylt i skattemeldingen.',
    technicalExplanation:
      'Fradrag for fagforeningskontingent, antatt hjemmel sktl. § 6-20 (paragraf må verifiseres mot Lovdata). Årlig maksbeløp fastsettes i Stortingets skattevedtak: 8 250 kr for inntektsåret 2025 og 8 700 kr for inntektsåret 2026 (kilde: Skatteetaten). Taket er kumulativt uavhengig av antall medlemskap.',
    sourceIds: ['skatteetaten-fradrag-fagforening', 'lovdata-sktl'],
    appliesToOrgForms: 'all',
    appliesToVatStatus: 'all',
    appliesToSituations: ['lønnstaker', 'fagforeningsmedlem'],
    taxpayerGroups: ['personal'],
    legalReference: 'sktl. § 6-20 (antatt — må verifiseres mot Lovdata)',
    deductionTreatment: 'personal-deduction',
    needsProfessionalVerification: true,
    verificationNote:
      'Hjemmelsparagraf og årsbeløp må kontrolleres mot Lovdata/Skatte-ABC per inntektsår. Innholdet er bekreftet via WebSearch mot skatteetaten.no (3-0), ikke direkte lesing av primærsiden (henting blokkert).',
    calculationMethod: 'fradrag = min(betalt kontingent, årets maksbeløp)',
    documentationRequirements: [
      'Beløp innrapportert av arbeidsgiver via a-melding, eller av fagforeningen ved direkte innbetaling',
    ],
    riskLevel: 'medium',
    lastReviewed: '2026-07-20',
    reviewedBy: 'deep-research-workflow (uverifisert — må fagkontrolleres)',
    versions: [
      {
        version: 1,
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        parameters: { maxDeductionNokMinor: '825000' }, // 8 250,00 kr
      },
      {
        version: 2,
        validFrom: '2026-01-01',
        parameters: { maxDeductionNokMinor: '870000' }, // 8 700,00 kr
        changeNote: 'Maksbeløp økt fra 8 250 til 8 700 kr for inntektsåret 2026.',
      },
    ],
  },
];

/** Bygger et ferdig register med norske kilder og regler. */
export function buildNorwegianRuleRegister(): RuleRegister {
  const register = new RuleRegister();
  for (const source of NORWEGIAN_SOURCES) register.registerSource(source);
  for (const rule of NORWEGIAN_RULES) register.registerRule(rule);
  return register;
}
