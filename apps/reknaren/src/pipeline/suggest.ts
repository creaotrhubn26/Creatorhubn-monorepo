/**
 * Forslagsmotor: foreslår konto, mva-kode og behandling for et dokument.
 *
 * Arkitektur:
 *  - En deterministisk regelbasert motor (denne filen) er alltid tilgjengelig
 *    og er fasit for hva som er LOV å foreslå.
 *  - En AI-motor kan plugges inn bak `SuggestionEngine`-grensesnittet, men
 *    svaret MÅ validere mot `postingSuggestionSchema`, og satser/regler
 *    hentes alltid fra regelregisteret — aldri fra modellens tekst.
 *  - Ingen forslag bokføres uten menneskelig godkjenning
 *    (`requiresHumanReview` kan aldri overstyres til automatisk bokføring).
 */
import { z } from 'zod';
import { getAccountDef, STANDARD_ACCOUNTS } from '../coa/accounts.js';
import { getVatCode } from '../coa/vat-codes.js';
import type { RuleRegister } from '../rules/register.js';
import type { ExtractedData } from '../documents/types.js';

export const postingSuggestionSchema = z.object({
  suggestedAccountNumber: z.string().regex(/^\d{4}$/),
  suggestedVatCode: z.string().min(1),
  businessUsePercentage: z.number().int().min(0).max(100),
  capitalizationAssessment: z.enum(['expense', 'asset', 'uncertain']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  missingInformation: z.array(z.string()),
  alternatives: z.array(
    z.object({
      accountNumber: z.string().regex(/^\d{4}$/),
      vatCode: z.string(),
      whenApplicable: z.string(),
    }),
  ),
  ruleReferences: z.array(z.string()),
  requiresHumanReview: z.literal(true), // MVP: alltid menneskelig kontroll
});

export type PostingSuggestion = z.infer<typeof postingSuggestionSchema>;

/** Grensesnitt for utskiftbare forslagsmotorer (deterministisk, AI, hybrid). */
export interface SuggestionEngine {
  readonly name: string;
  suggest(data: ExtractedData, context: SuggestionContext): Promise<PostingSuggestion>;
}

export interface SuggestionContext {
  rules: RuleRegister;
  vatStatus: 'registered' | 'not_registered' | 'pending';
  /** Leverandørens standardkonto/-kode fra tidligere godkjente bilag. */
  vendorDefaults?: { accountNumber?: string; vatCode?: string };
  isoDate: string;
}

interface KeywordRule {
  keywords: RegExp;
  accountNumber: string;
  evidenceLabel: string;
}

/** Nøkkelordregler i prioritert rekkefølge. Første treff vinner. */
const KEYWORD_RULES: KeywordRule[] = [
  { keywords: /(kamera|camera|objektiv|lens|lighting|mikrofon|microphone)/i, accountNumber: '6551', evidenceLabel: 'kamerautstyr/produksjonsutstyr' },
  { keywords: /(laptop|pc\b|macbook|skjerm|monitor|server|datautstyr|tastatur|keyboard)/i, accountNumber: '6551', evidenceLabel: 'datautstyr' },
  { keywords: /(adobe|figma|dropbox|google workspace|microsoft 365|saas|subscription|abonnement|cloud|hosting|domene|domain)/i, accountNumber: '6810', evidenceLabel: 'programvareabonnement/skytjeneste' },
  { keywords: /(annonse|ads\b|advertising|markedsføring|marketing|kampanje)/i, accountNumber: '7320', evidenceLabel: 'markedsføring/annonsering' },
  { keywords: /(husleie|kontorleie|leie av lokale)/i, accountNumber: '6300', evidenceLabel: 'leie av lokale' },
  { keywords: /(strøm|elektrisitet|kraft|fjernvarme)/i, accountNumber: '6340', evidenceLabel: 'strøm/oppvarming' },
  { keywords: /(mobil|telefon|telenor|telia|ice\b)/i, accountNumber: '6900', evidenceLabel: 'telefon' },
  { keywords: /(bredbånd|fiber|internett|internet)/i, accountNumber: '6907', evidenceLabel: 'internett' },
  { keywords: /(fly|flight|tog|train|hotell|hotel|overnatting|taxi)/i, accountNumber: '7140', evidenceLabel: 'reisekostnad' },
  { keywords: /(drivstoff|bensin|diesel|lading|bompenger|parkering)/i, accountNumber: '7100', evidenceLabel: 'bilkostnad' },
  { keywords: /(forsikring|insurance)/i, accountNumber: '7500', evidenceLabel: 'forsikring' },
  { keywords: /(regnskap|revisor|accounting)/i, accountNumber: '6700', evidenceLabel: 'regnskap/revisjon' },
  { keywords: /(advokat|juridisk|legal)/i, accountNumber: '6720', evidenceLabel: 'juridisk bistand' },
  { keywords: /(gebyr|fee\b|stripe|vipps)/i, accountNumber: '7770', evidenceLabel: 'bank-/betalingsgebyr' },
  { keywords: /(rekvisita|papir|penn|toner)/i, accountNumber: '6800', evidenceLabel: 'kontorrekvisita' },
];

const FOREIGN_SERVICE_HINTS = /(irland|ireland|luxembourg|usa|united states|inc\.|llc|ltd|b\.v\.|gmbh)/i;

/**
 * Deterministisk forslagsmotor. Bruker leverandørhistorikk først,
 * deretter nøkkelord, og faller tilbake til "annen kostnad" med lav confidence.
 */
export class DeterministicSuggestionEngine implements SuggestionEngine {
  readonly name = 'deterministic';

  async suggest(data: ExtractedData, context: SuggestionContext): Promise<PostingSuggestion> {
    const text = [
      data.vendorName ?? '',
      ...(data.lineItems?.map((l) => l.description) ?? []),
    ].join(' ');

    const evidence: string[] = [];
    const assumptions: string[] = [];
    const missing: string[] = [];
    const ruleReferences: string[] = [];
    let accountNumber: string | undefined;
    let confidence = 0.3;

    if (context.vendorDefaults?.accountNumber) {
      accountNumber = context.vendorDefaults.accountNumber;
      evidence.push('Leverandøren er tidligere bokført mot denne kontoen.');
      confidence = 0.85;
    } else {
      for (const rule of KEYWORD_RULES) {
        if (rule.keywords.test(text)) {
          accountNumber = rule.accountNumber;
          evidence.push(`Dokumentet gjelder ${rule.evidenceLabel} («${text.match(rule.keywords)?.[0]}»).`);
          confidence = 0.65;
          break;
        }
      }
    }
    if (!accountNumber) {
      accountNumber = '7790';
      assumptions.push('Fant ingen kjent kategori — foreslår «Andre kostnader» med lav sikkerhet.');
      confidence = 0.2;
    }

    // MVA-kode: utenlandsk tjeneste → omvendt avgiftsplikt; ellers kontoens vanligste kode.
    const foreignService =
      data.foreignService === true ||
      (data.currency !== undefined && data.currency !== 'NOK' && FOREIGN_SERVICE_HINTS.test(text));
    let vatCode: string;
    if (context.vatStatus !== 'registered') {
      vatCode = '0';
      evidence.push('Virksomheten er ikke mva-registrert — ingen fradragsrett for inngående mva.');
      ruleReferences.push('no.vat.registration-threshold');
    } else if (foreignService) {
      vatCode = '86';
      evidence.push('Leverandøren ser ut til å være utenlandsk tjenesteleverandør — omvendt avgiftsplikt.');
      assumptions.push('Antar fjernleverbar tjeneste kjøpt til bruk i avgiftspliktig virksomhet.');
    } else {
      const accountDef = getAccountDef(accountNumber);
      vatCode = context.vendorDefaults?.vatCode ?? accountDef?.commonVatCodes[0] ?? '1';
      if (data.vatMinor === 0n || data.vatMinor === undefined) {
        if (vatCode === '1') {
          vatCode = '0';
          assumptions.push('Dokumentet viser ingen mva — behandles uten fradrag.');
        }
      }
    }
    if (!getVatCode(vatCode)) vatCode = '0';

    // Aktivering vs. kostnadsføring, fra regelregisteret (aldri hardkodet grense).
    let capitalization: PostingSuggestion['capitalizationAssessment'] = 'expense';
    const threshold = context.rules.getVersionAt('no.asset.expense-threshold', context.isoDate);
    const thresholdMinor = BigInt(String(threshold.parameters['thresholdNokMinor'] ?? '3000000'));
    ruleReferences.push('no.asset.expense-threshold');
    const netAmount = data.netMinor ?? data.grossMinor;
    if (netAmount !== undefined && netAmount >= thresholdMinor) {
      const def = getAccountDef(accountNumber);
      capitalization = def?.capitalizationCandidate ? 'asset' : 'uncertain';
      evidence.push(
        `Beløpet er over grensen for direkte kostnadsføring (${thresholdMinor / 100n} kr) — vurder aktivering og avskrivning.`,
      );
      ruleReferences.push('no.asset.depreciation-groups');
    }
    if (netAmount === undefined) missing.push('Nettobeløp mangler.');
    if (!data.vendorName) missing.push('Leverandørnavn mangler.');
    if (!data.invoiceDate) missing.push('Fakturadato mangler.');

    const alternatives: PostingSuggestion['alternatives'] = [];
    if (capitalization !== 'expense') {
      alternatives.push({
        accountNumber: '1280',
        vatCode,
        whenApplicable: 'Hvis utstyret skal vare i minst tre år, aktiveres det og avskrives (saldogruppe a).',
      });
    }
    if (accountNumber === '6900' || accountNumber === '6907') {
      assumptions.push('Telefon/internett kan ha privat bruk — fordelingen må bekreftes av brukeren.');
    }

    return postingSuggestionSchema.parse({
      suggestedAccountNumber: accountNumber,
      suggestedVatCode: vatCode,
      businessUsePercentage: 100,
      capitalizationAssessment: capitalization,
      confidence,
      evidence,
      assumptions,
      missingInformation: missing,
      alternatives,
      ruleReferences,
      requiresHumanReview: true,
    });
  }
}

/** Sikrer at kontoen i et (evt. AI-generert) forslag finnes i standardplanen. */
export function isKnownAccount(accountNumber: string): boolean {
  return STANDARD_ACCOUNTS.some((a) => a.number === accountNumber);
}
