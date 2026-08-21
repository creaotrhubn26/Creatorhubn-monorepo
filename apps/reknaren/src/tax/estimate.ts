/**
 * Skattepanelet: et løpende ESTIMAT, aldri en garanti.
 * Alle beregninger er deterministiske, bruker regelregisteret per dato,
 * og viser alltid beregningsdato, regelversjoner, datagrunnlag, usikkerhet
 * og hva som IKKE er medregnet. Skiller tydelig mellom regnskapsmessig
 * resultat, skattemessig resultat, MVA og likviditet.
 */
import type { Db } from '../db/pool.js';
import { incomeStatement } from '../ledger/reports.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { money, multiplyRational } from '../shared/money.js';
import { buildVatReport } from '../vat/engine.js';
import { computeTaxAdjustments, type TaxAdjustment } from './adjustments.js';
import { computeTrinnskattMinor, marginalTrinnskattPer1000 } from './brackets.js';

/** Formaterer en rasjonal sats (n/100 eller n/1000) for visning — alltid fra registeret. */
function displayRatePct(numerator: bigint, denominator: bigint): string {
  if (denominator === 100n) return numerator.toString();
  if (denominator === 1000n) {
    const frac = numerator % 10n;
    return frac === 0n ? (numerator / 10n).toString() : `${numerator / 10n}.${frac}`;
  }
  return `${numerator}/${denominator}`;
}

export interface TaxEstimateScenario {
  label: 'low' | 'expected' | 'high';
  taxableResultMinor: bigint;
  estimatedTaxMinor: bigint;
}

export interface TaxEstimate {
  organizationId: string;
  orgForm: OrganizationForm;
  calculatedAt: string;
  periodFrom: string;
  periodTo: string;
  /** Regnskapsmessig resultat fra hovedboken. */
  accountingResultMinor: bigint;
  /** Skattemessige justeringer (permanente forskjeller lagt tilbake). */
  taxAdjustmentsMinor: bigint;
  /** Linjene bak justeringen — hver med konto og begrunnelse (til kontroll). */
  taxAdjustments: TaxAdjustment[];
  estimatedTaxableResultMinor: bigint;
  /** Komponenter, hver med regelreferanse og versjon. */
  components: {
    name: string;
    ruleId: string;
    ruleVersion: number;
    ratePct: string;
    amountMinor: bigint;
  }[];
  estimatedTaxMinor: bigint;
  /** Marginalsats på neste krone overskudd, i promille (til per-faktura-avsetning). */
  marginalRatePer1000: number;
  /** Anbefalt reservasjon (skatt + estimert skyldig mva). */
  recommendedReserveMinor: bigint;
  vatNetPayableMinor: bigint;
  scenarios: TaxEstimateScenario[];
  dataBasis: string;
  uncertaintyNotes: string[];
  notIncluded: string[];
}

/**
 * MERK: For ENK beregnes kun alminnelig inntektsskatt og trygdeavgift.
 * Trinnskatt, personfradrag og samordning med annen inntekt krever
 * opplysninger systemet ikke har, og er eksplisitt listet som ikke medregnet.
 */
export async function buildTaxEstimate(
  db: Db,
  rules: RuleRegister,
  params: {
    organizationId: string;
    orgForm: OrganizationForm;
    fromDate: string;
    toDate: string;
  },
): Promise<TaxEstimate> {
  const pnl = await incomeStatement(db, {
    organizationId: params.organizationId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  const vat = await buildVatReport(db, params.organizationId, params.fromDate, params.toDate);

  // Bro fra regnskapsmessig til skattemessig resultat: legg tilbake permanente
  // forskjeller (kostnader uten skattefradrag). Kun eksplisitt merkede kontoer.
  const adjustments = await computeTaxAdjustments(db, {
    organizationId: params.organizationId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  const accountingResult = pnl.resultMinor;
  const taxableResult = accountingResult + adjustments.totalMinor;
  const taxable = taxableResult > 0n ? taxableResult : 0n;
  const asOf = params.toDate;

  const components: TaxEstimate['components'] = [];
  const uncertainty: string[] = [...adjustments.notes];
  const notIncluded: string[] = [
    'Periodiseringer som ikke er bokført',
    'Ikke-bokførte transaksjoner og manglende bilag',
    'Avskrivningsdifferanser (regnskap vs. skattemessig saldoavskrivning)',
    'Fremførbart underskudd fra tidligere år',
  ];

  const isCompany = ['AS', 'NUF', 'SA'].includes(params.orgForm);
  if (isCompany) {
    const ruleId = 'no.tax.corporate-rate';
    const version = rules.getVersionAt(ruleId, asOf);
    const rate = rules.getRationalParamAt(ruleId, 'rate', asOf);
    const tax = multiplyRational(money(taxable, 'NOK'), rate.numerator, rate.denominator);
    components.push({
      name: 'Selskapsskatt (alminnelig inntekt)',
      ruleId,
      ruleVersion: version.version,
      ratePct: displayRatePct(rate.numerator, rate.denominator),
      amountMinor: tax.minorUnits,
    });
  } else {
    const incomeRuleId = 'no.tax.personal-base-rate';
    const incomeVersion = rules.getVersionAt(incomeRuleId, asOf);
    const incomeRate = rules.getRationalParamAt(incomeRuleId, 'rate', asOf);
    const incomeTax = multiplyRational(money(taxable, 'NOK'), incomeRate.numerator, incomeRate.denominator);
    components.push({
      name: 'Skatt på alminnelig inntekt',
      ruleId: incomeRuleId,
      ruleVersion: incomeVersion.version,
      ratePct: displayRatePct(incomeRate.numerator, incomeRate.denominator),
      amountMinor: incomeTax.minorUnits,
    });
    const ssRuleId = 'no.tax.social-security-self-employed';
    const ssVersion = rules.getVersionAt(ssRuleId, asOf);
    const ssRate = rules.getRationalParamAt(ssRuleId, 'rate', asOf);
    const ssTax = multiplyRational(money(taxable, 'NOK'), ssRate.numerator, ssRate.denominator);
    components.push({
      name: 'Trygdeavgift (næringsinntekt)',
      ruleId: ssRuleId,
      ruleVersion: ssVersion.version,
      ratePct: displayRatePct(ssRate.numerator, ssRate.denominator),
      amountMinor: ssTax.minorUnits,
    });
    // Trinnskatt (progressiv på personinntekt). Forutsetter at hele overskuddet er
    // personinntekt fra denne næringen. Satser 2025 (se brackets.ts).
    const trinnskattMinor = computeTrinnskattMinor(taxable);
    if (trinnskattMinor > 0n) {
      components.push({
        name: 'Trinnskatt',
        ruleId: 'no.tax.bracket-tax-2025',
        ruleVersion: 1,
        ratePct: 'progressiv',
        amountMinor: trinnskattMinor,
      });
    }
    notIncluded.push('Personfradrag og minstefradrag', 'Annen personinntekt (lønn/pensjon) som endrer trinnskatt-nivået');
    uncertainty.push(
      'Estimatet forutsetter at hele overskuddet er personinntekt fra næring, uten annen inntekt. Trinnskatt beregnet med 2025-satser.',
    );
  }

  const estimatedTax = components.reduce((acc, c) => acc + c.amountMinor, 0n);
  const vatDue = vat.netPayableMinor > 0n ? vat.netPayableMinor : 0n;

  // Scenarioer: ±15 % på skattepliktig resultat som usikkerhetsbånd for
  // ubokførte kostnader/inntekter. Faktoren er en presentasjonsparameter,
  // ikke en skattesats, og vises som forutsetning.
  const scenario = (factorNum: bigint, factorDen: bigint, label: TaxEstimateScenario['label']): TaxEstimateScenario => {
    const scenarioTaxable = multiplyRational(money(taxable, 'NOK'), factorNum, factorDen).minorUnits;
    let scenarioTax = 0n;
    for (const c of components) {
      // Skaler komponentene proporsjonalt — samme satser, annet grunnlag.
      const scaled = taxable === 0n ? 0n : (c.amountMinor * scenarioTaxable) / taxable;
      scenarioTax += scaled;
    }
    return { label, taxableResultMinor: scenarioTaxable, estimatedTaxMinor: scenarioTax };
  };
  const scenarios: TaxEstimateScenario[] = [
    scenario(85n, 100n, 'low'),
    scenario(100n, 100n, 'expected'),
    scenario(115n, 100n, 'high'),
  ];

  uncertainty.push(
    'Lav/høy-scenario er ±15 % på skattepliktig resultat for å illustrere usikkerhet i ubokførte poster.',
  );
  if (vat.warnings.length) {
    uncertainty.push(`MVA-rapporten har ${vat.warnings.length} advarsel(er) som kan påvirke tallene.`);
  }

  // Marginalsats på neste krone: AS = selskapsskatt; ENK = 22% + 11% + trinnskatt-trinn.
  const marginalRatePer1000 = isCompany
    ? 220
    : 220 + 110 + marginalTrinnskattPer1000(taxable);

  return {
    organizationId: params.organizationId,
    orgForm: params.orgForm,
    calculatedAt: new Date().toISOString(),
    periodFrom: params.fromDate,
    periodTo: params.toDate,
    accountingResultMinor: accountingResult,
    taxAdjustmentsMinor: adjustments.totalMinor,
    taxAdjustments: adjustments.lines,
    estimatedTaxableResultMinor: taxable,
    components,
    estimatedTaxMinor: estimatedTax,
    marginalRatePer1000,
    recommendedReserveMinor: estimatedTax + vatDue,
    vatNetPayableMinor: vat.netPayableMinor,
    scenarios,
    dataBasis: 'Bokførte posteringer i hovedboken for perioden. AI-tall inngår aldri i grunnlaget.',
    uncertaintyNotes: uncertainty,
    notIncluded,
  };
}
