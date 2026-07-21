/**
 * MVA-koder basert på SAF-T standard tax codes (Skatteetatens kodeliste).
 * MVA-meldingen fra 2022 rapporteres direkte på disse kodene, så mappingen
 * mot meldingen er kodene selv (mvaMeldingCode).
 *
 * Kilde: skatteetaten-saf-t i kilderegisteret.
 */

export type VatDirection = 'output' | 'input' | 'none';

export interface VatCode {
  /** SAF-T standard mva-kode, f.eks. '1', '3', '81'. */
  code: string;
  name: string;
  /** Forklaring på vanlig norsk. */
  plainExplanation: string;
  direction: VatDirection;
  /** Regel-ID i regelregisteret som gir satsen, null for 0-sats/utenfor loven. */
  rateRuleId: string | null;
  /** Om inngående mva er fradragsberettiget for denne koden. */
  deductible: boolean;
  /** Omvendt avgiftsplikt: kjøper beregner både utgående og ev. inngående. */
  reverseCharge: boolean;
  /** Kode i mva-meldingen (SAF-T-basert melding bruker samme koder). */
  mvaMeldingCode: string;
  usedFor: string;
}

export const VAT_CODES: VatCode[] = [
  {
    code: '0',
    name: 'Ingen mva-behandling (anskaffelser)',
    plainExplanation: 'Kjøp uten mva-behandling, for eksempel fra selger som ikke er mva-registrert.',
    direction: 'none',
    rateRuleId: null,
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '0',
    usedFor: 'Kjøp uten mva',
  },
  {
    code: '1',
    name: 'Fradragsberettiget inngående mva, høy sats',
    plainExplanation:
      'Kjøp i Norge med 25 % mva der virksomheten har fradragsrett. Mva-beløpet får du tilbake i mva-oppgjøret.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: true,
    reverseCharge: false,
    mvaMeldingCode: '1',
    usedFor: 'Vanlige kjøp av varer og tjenester i Norge',
  },
  {
    code: '11',
    name: 'Fradragsberettiget inngående mva, middels sats',
    plainExplanation: 'Kjøp av næringsmidler (15 % mva) med fradragsrett.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.food',
    deductible: true,
    reverseCharge: false,
    mvaMeldingCode: '11',
    usedFor: 'Kjøp av mat og drikke til videresalg/bruk i avgiftspliktig virksomhet',
  },
  {
    code: '13',
    name: 'Fradragsberettiget inngående mva, lav sats',
    plainExplanation: 'Kjøp med 12 % mva (f.eks. persontransport, overnatting) med fradragsrett.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.low',
    deductible: true,
    reverseCharge: false,
    mvaMeldingCode: '13',
    usedFor: 'Togbilletter, hotellovernatting o.l. i næring',
  },
  {
    code: '14',
    name: 'Fradragsberettiget innførselsmerverdiavgift, høy sats',
    plainExplanation: 'Import av varer der du selv beregner 25 % innførselsmva med fradragsrett.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: true,
    reverseCharge: true,
    mvaMeldingCode: '14',
    usedFor: 'Vareimport',
  },
  {
    code: '3',
    name: 'Utgående mva, høy sats',
    plainExplanation: 'Salg i Norge med 25 % mva.',
    direction: 'output',
    rateRuleId: 'no.vat.rate.standard',
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '3',
    usedFor: 'Vanlig avgiftspliktig salg',
  },
  {
    code: '31',
    name: 'Utgående mva, middels sats',
    plainExplanation: 'Salg av næringsmidler med 15 % mva.',
    direction: 'output',
    rateRuleId: 'no.vat.rate.food',
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '31',
    usedFor: 'Salg av mat og drikke',
  },
  {
    code: '33',
    name: 'Utgående mva, lav sats',
    plainExplanation: 'Salg med 12 % mva, f.eks. persontransport og overnatting.',
    direction: 'output',
    rateRuleId: 'no.vat.rate.low',
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '33',
    usedFor: 'Persontransport, overnatting, kino m.m.',
  },
  {
    code: '5',
    name: 'Mva-fritt salg (fritatt, 0 %)',
    plainExplanation:
      'Salg som er innenfor mva-loven, men med nullsats. Du krever ikke mva, men beholder fradragsretten for kjøp.',
    direction: 'output',
    rateRuleId: null,
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '5',
    usedFor: 'F.eks. bøker, aviser, brukte kjøretøy etter særregler',
  },
  {
    code: '52',
    name: 'Utførsel av varer og tjenester (eksport)',
    plainExplanation: 'Salg til utlandet er fritatt for norsk mva (nullsats), men gir fradragsrett.',
    direction: 'output',
    rateRuleId: null,
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '52',
    usedFor: 'Eksportsalg',
  },
  {
    code: '6',
    name: 'Omsetning utenfor mva-loven (unntatt)',
    plainExplanation:
      'Salg som er unntatt fra mva-loven, f.eks. helsetjenester og undervisning. Gir IKKE fradragsrett for tilhørende kjøp.',
    direction: 'output',
    rateRuleId: null,
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '6',
    usedFor: 'Unntatt omsetning',
  },
  {
    code: '7',
    name: 'Ingen mva-behandling (inntekter)',
    plainExplanation: 'Inntekter uten mva-behandling, f.eks. offentlige tilskudd og erstatninger.',
    direction: 'none',
    rateRuleId: null,
    deductible: false,
    reverseCharge: false,
    mvaMeldingCode: '7',
    usedFor: 'Tilskudd, gaver, erstatninger',
  },
  {
    code: '81',
    name: 'Kjøp av varer fra utlandet, høy sats, med fradrag',
    plainExplanation:
      'Vareimport der du beregner 25 % innførselsmva og samtidig har full fradragsrett. Netto mva-effekt blir null hvis du har full fradragsrett.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: true,
    reverseCharge: true,
    mvaMeldingCode: '81',
    usedFor: 'Vareimport med fradragsrett',
  },
  {
    code: '82',
    name: 'Kjøp av varer fra utlandet, høy sats, uten fradrag',
    plainExplanation: 'Vareimport med beregnet innførselsmva uten fradragsrett.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: false,
    reverseCharge: true,
    mvaMeldingCode: '82',
    usedFor: 'Vareimport uten fradragsrett',
  },
  {
    code: '86',
    name: 'Kjøp av tjenester fra utlandet, høy sats, med fradrag',
    plainExplanation:
      'Kjøp av fjernleverbare tjenester fra utlandet (f.eks. programvare, annonser, skytjenester). Du beregner selv 25 % mva (omvendt avgiftsplikt), og trekker den fra hvis du har fradragsrett.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: true,
    reverseCharge: true,
    mvaMeldingCode: '86',
    usedFor: 'Utenlandske digitale tjenester: SaaS, annonsering, hosting',
  },
  {
    code: '87',
    name: 'Kjøp av tjenester fra utlandet, høy sats, uten fradrag',
    plainExplanation:
      'Som kode 86, men uten fradragsrett — mva-en blir en reell kostnad.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: false,
    reverseCharge: true,
    mvaMeldingCode: '87',
    usedFor: 'Tjenesteimport uten fradragsrett',
  },
  {
    code: '91',
    name: 'Kjøp med omvendt avgiftsplikt innenlands, med fradrag',
    plainExplanation:
      'Enkelte innenlandske kjøp (klimakvoter, gull) der kjøper beregner mva selv.',
    direction: 'input',
    rateRuleId: 'no.vat.rate.standard',
    deductible: true,
    reverseCharge: true,
    mvaMeldingCode: '91',
    usedFor: 'Klimakvoter og gull',
  },
];

const byCode = new Map(VAT_CODES.map((c) => [c.code, c]));

export function getVatCode(code: string): VatCode | undefined {
  return byCode.get(code);
}
