/**
 * Per-bilag konsekvensberegning: hva ETT forslag betyr for MVA, resultat og skatt.
 *
 * «Adobe-abonnementet … Beregnet fradragsberettiget inngående MVA: 249 kr.»
 *
 * Deterministisk og eksakt (bigint-øre, aldri flyttall). Satser hentes fra
 * regelregisteret per bilagsdato — aldri hardkodet. Skatteeffekten er et
 * ESTIMAT (marginal reduksjon av skattepliktig overskudd) og merkes som det.
 * Speiler posteringslogikken i approveAndPost, men bokfører ingenting.
 */
import { getVatCode } from '../coa/vat-codes.js';
import { money, multiplyRational } from '../shared/money.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { splitGrossByVatCode, vatOfNet } from '../vat/engine.js';
import type { PostingSuggestion } from './suggest.js';

export interface TaxEffectComponent {
  name: string;
  ratePct: string;
  ruleId: string;
  amountMinor: bigint;
}

export interface DocumentImpact {
  /** false når beløp/kurs mangler; da forklarer `reason` hvorfor. */
  computable: boolean;
  reason?: string;
  businessGrossMinor: bigint;
  privateGrossMinor: bigint;
  /** Kostnad som treffer resultatet i år (0 hvis aktiveres og avskrives). */
  costToResultMinor: bigint;
  /** Inngående mva du får tilbake i mva-oppgjøret. */
  deductibleInputVatMinor: bigint;
  /** Mva uten fradragsrett — blir en del av kostnaden. */
  nonDeductibleVatMinor: bigint;
  /** Utgående mva ved omvendt avgiftsplikt (nulles av inngående ved fradrag). */
  reverseChargeOutputVatMinor: bigint;
  /** true = aktiveres som eiendel; påvirker resultatet gradvis via avskrivning. */
  capitalized: boolean;
  taxEffect: {
    isEstimate: true;
    combinedRateLabel: string;
    reducesTaxByMinor: bigint;
    components: TaxEffectComponent[];
  } | null;
  notes: string[];
}

function displayRate(numerator: bigint, denominator: bigint): string {
  if (denominator === 100n) return numerator.toString();
  if (denominator === 1000n) {
    const frac = numerator % 10n;
    return frac === 0n ? (numerator / 10n).toString() : `${numerator / 10n}.${frac}`;
  }
  return `${numerator}/${denominator}`;
}

const COMPANY_FORMS: OrganizationForm[] = ['AS', 'NUF', 'SA'];

export interface DocumentImpactInput {
  grossMinor: bigint | null | undefined;
  currency: string | null | undefined;
  vatCode: string;
  businessUsePercentage: number;
  capitalization: PostingSuggestion['capitalizationAssessment'];
  orgForm: OrganizationForm;
  isoDate: string;
}

/**
 * Regner ut konsekvensen av å bokføre ett bilag etter det gjeldende forslaget.
 * Alle beløp returneres i NOK-øre. Utenlandsk valuta uten kurs → computable=false.
 */
export function computeDocumentImpact(
  rules: RuleRegister,
  input: DocumentImpactInput,
): DocumentImpact {
  const empty = {
    businessGrossMinor: 0n,
    privateGrossMinor: 0n,
    costToResultMinor: 0n,
    deductibleInputVatMinor: 0n,
    nonDeductibleVatMinor: 0n,
    reverseChargeOutputVatMinor: 0n,
    capitalized: false,
    taxEffect: null,
    notes: [] as string[],
  };

  if (input.grossMinor === null || input.grossMinor === undefined) {
    return { ...empty, computable: false, reason: 'Totalbeløp mangler i uttrekket, så konsekvensen kan ikke beregnes ennå.' };
  }
  if (input.currency && input.currency !== 'NOK') {
    return {
      ...empty,
      computable: false,
      reason: `Beløpet er i ${input.currency}. Den eksakte konsekvensen beregnes ved bokføring når du oppgir valutakurs.`,
    };
  }

  const gross = input.grossMinor;
  const businessUse = BigInt(Math.max(0, Math.min(100, Math.round(input.businessUsePercentage))));
  const businessGross = (gross * businessUse) / 100n;
  const privateGross = gross - businessGross;

  const notes: string[] = [];
  const code = getVatCode(input.vatCode);
  let deductibleInputVat = 0n;
  let nonDeductibleVat = 0n;
  let reverseOut = 0n;
  let costToResult = 0n;

  if (code?.reverseCharge) {
    const v = vatOfNet(rules, input.vatCode, businessGross, input.isoDate);
    reverseOut = v.vatMinor;
    if (code.deductible) {
      deductibleInputVat = v.vatMinor;
      costToResult = businessGross;
    } else {
      nonDeductibleVat = v.vatMinor;
      costToResult = businessGross + v.vatMinor;
    }
    notes.push('Omvendt avgiftsplikt: du beregner både utgående og inngående mva selv — de nuller hverandre ved full fradragsrett.');
  } else if (code?.direction === 'input' && code.deductible) {
    const parts = splitGrossByVatCode(rules, input.vatCode, businessGross, input.isoDate);
    deductibleInputVat = parts.vatMinor;
    costToResult = parts.netMinor;
  } else {
    // Uten fradrag: hele næringsbeløpet er kostnad.
    costToResult = businessGross;
  }

  if (privateGross > 0n) {
    notes.push(`Privat andel (${100n - businessUse} %) føres mot privatuttak og påvirker verken kostnad eller mva.`);
  }

  const capitalized = input.capitalization === 'asset';
  if (capitalized) {
    notes.push('Beløpet aktiveres som eiendel og påvirker resultatet gradvis via avskrivning — ikke som kostnad i år. Inngående mva trekkes likevel fullt i år.');
  } else if (input.capitalization === 'uncertain') {
    notes.push('Behandlingen (kostnad eller eiendel) er usikker og må bekreftes av deg før bokføring.');
  }

  // Skatteeffekt: estimert redusert skatt fordi kostnaden reduserer skattepliktig
  // overskudd. Bare for direkte kostnadsføring (aktiverte beløp avskrives over år).
  let taxEffect: DocumentImpact['taxEffect'] = null;
  if (!capitalized && costToResult > 0n) {
    const ruleIds = COMPANY_FORMS.includes(input.orgForm)
      ? [{ id: 'no.tax.corporate-rate', name: 'Selskapsskatt' }]
      : [
          { id: 'no.tax.personal-base-rate', name: 'Skatt på alminnelig inntekt' },
          { id: 'no.tax.social-security-self-employed', name: 'Trygdeavgift' },
        ];
    const components: TaxEffectComponent[] = [];
    let reducesBy = 0n;
    for (const { id, name } of ruleIds) {
      const rate = rules.getRationalParamAt(id, 'rate', input.isoDate);
      const part = multiplyRational(money(costToResult, 'NOK'), rate.numerator, rate.denominator);
      components.push({ name, ratePct: displayRate(rate.numerator, rate.denominator), ruleId: id, amountMinor: part.minorUnits });
      reducesBy += part.minorUnits;
    }
    taxEffect = {
      isEstimate: true,
      combinedRateLabel: components.map((c) => `${c.ratePct} %`).join(' + '),
      reducesTaxByMinor: reducesBy,
      components,
    };
    notes.push(
      COMPANY_FORMS.includes(input.orgForm)
        ? 'Skatteeffekten er et estimat — faktisk effekt avhenger av selskapets samlede årsresultat.'
        : 'Skatteeffekten er et estimat som forutsetter at overskuddet er personinntekt fra næring; trinnskatt og personfradrag er ikke medregnet.',
    );
  }

  return {
    computable: true,
    businessGrossMinor: businessGross,
    privateGrossMinor: privateGross,
    costToResultMinor: costToResult,
    deductibleInputVatMinor: deductibleInputVat,
    nonDeductibleVatMinor: nonDeductibleVat,
    reverseChargeOutputVatMinor: reverseOut,
    capitalized,
    taxEffect,
    notes,
  };
}
