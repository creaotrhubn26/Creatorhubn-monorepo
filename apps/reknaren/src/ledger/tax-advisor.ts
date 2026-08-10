/**
 * Proaktiv skatte- og MVA-assistent. I stedet for at brukeren må spørre, skanner
 * Reknaren løpende etter forhold som fortjener oppmerksomhet — formulert som
 * MULIGHETER og KONTROLLPUNKTER, aldri som løfter om «maksimalt fradrag».
 *
 * Hvert funn har kilde/regelreferanse, en begrunnelse på vanlig norsk, og krever
 * menneskelig vurdering/godkjenning. REN LESING — assistenten bokfører aldri noe.
 */
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import type { OrganizationForm } from '../rules/types.js';
import type { RuleRegister } from '../rules/register.js';
import { buildTaxEstimate } from '../tax/estimate.js';
import { buildVatReport } from '../vat/engine.js';
import { detectBookkeepingErrors } from './anomalies.js';

export type AdvisoryKind = 'mulighet' | 'kontrollpunkt' | 'risiko';

export interface Advisory {
  code: string;
  kind: AdvisoryKind;
  title: string;
  detail: string;
  ruleReferences: string[];
  legalReference?: string;
  needsProfessional?: boolean;
  actionScreen?: string;
}

export interface TaxAdvisories {
  fromDate: string;
  toDate: string;
  advisories: Advisory[];
  disclaimer: string;
}

const REVERSE_CHARGE_CODES = ['86', '87', '88', '89', '91', '92'];
const MIXED_USE_ACCOUNTS = ['6900', '6907', '7100']; // telefon, datakommunikasjon, bil
const PRO_REVIEW_THRESHOLD = 10000000n; // 100 000 kr

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Inneværende 2-måneders MVA-termin for en dato, med forfall. */
function currentVatTerm(iso: string): { from: string; to: string; due: string } {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const idx = Math.floor((m - 1) / 2);
  const startMonth = idx * 2 + 1;
  const endMonth = idx * 2 + 2;
  const lastDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
  let dueMonth = endMonth + 2;
  let dueYear = y;
  if (dueMonth > 12) {
    dueMonth -= 12;
    dueYear += 1;
  }
  return { from: `${y}-${pad(startMonth)}-01`, to: `${y}-${pad(endMonth)}-${pad(lastDay)}`, due: `${dueYear}-${pad(dueMonth)}-10` };
}

export async function buildTaxAdvisories(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; asOf: string },
): Promise<TaxAdvisories> {
  const { organizationId: org, orgForm, asOf } = params;
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const advisories: Advisory[] = [];
  const orgRow = (await db.query(`SELECT vat_status FROM organizations WHERE id = $1`, [org])).rows[0];
  const isVatRegistered = orgRow?.vat_status === 'registered';
  const first = async (sql: string, p: unknown[]) => (await db.query(sql, p)).rows[0];

  // 1) Mulig ubenyttet MVA-fradrag (MULIGHET) — dokument viser mva, men ikke fradragsført.
  const anomalies = await detectBookkeepingErrors(db, rules, { organizationId: org, fromDate: yearStart, toDate: asOf });
  const glemtMva = anomalies.errors.filter((e) => e.code === 'glemt_mva_fradrag').length;
  if (glemtMva > 0) {
    advisories.push({
      code: 'ubenyttet_mva_fradrag',
      kind: 'mulighet',
      title: `${glemtMva} bilag kan ha ubenyttet inngående MVA`,
      detail: `Kvitteringen viser MVA, men bilaget er bokført uten fradrag. Er dette et vanlig kjøp til virksomheten, kan du ha rett på fradraget. Kontroller MVA-koden før du eventuelt korrigerer.`,
      ruleReferences: ['no.vat.rate.standard'],
      actionScreen: 'overview',
    });
  }

  // 2) Blandet privat/næringsbruk (KONTROLLPUNKT) — telefon/internett/bil ført 100 % næring.
  const mixed = await first(
    `SELECT COUNT(DISTINCT je.id)::int AS n
     FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
     WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
       AND l.account_number = ANY($4) AND l.debit_minor > 0
       AND NOT EXISTS (SELECT 1 FROM journal_lines p WHERE p.entry_id = je.id AND p.account_number='2060')`,
    [org, yearStart, asOf, MIXED_USE_ACCOUNTS],
  );
  if ((mixed.n as number) > 0) {
    advisories.push({
      code: 'blandet_bruk',
      kind: 'kontrollpunkt',
      title: `${mixed.n} bilag på telefon/bil kan ha privat andel`,
      detail: 'Telefon, datakommunikasjon og bil brukes ofte både privat og i næring. Bilagene er ført 100 % som næring. Vurder om en privat andel skal skilles ut — det påvirker både fradrag og skatt.',
      ruleReferences: [],
      legalReference: 'sktl. § 6-1 / § 6-12',
      actionScreen: 'journal',
    });
  }

  // 3) Representasjon (KONTROLLPUNKT) — begrenset fradragsrett.
  const repr = await first(
    `SELECT COALESCE(SUM(l.debit_minor),0)::TEXT AS sum
     FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
     WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
       AND l.account_number = '7350'`,
    [org, yearStart, asOf],
  );
  if (BigInt(repr.sum) > 0n) {
    advisories.push({
      code: 'representasjon',
      kind: 'kontrollpunkt',
      title: `Representasjon ført: ${formatMinorAsKr(BigInt(repr.sum))} kr`,
      detail: 'Representasjon har begrenset fradragsrett, og det er egne satser/vilkår (f.eks. bevertning). Kontroller at bare den fradragsberettigede delen er ført, og at bilagene dokumenterer anledning og deltakere.',
      ruleReferences: [],
      legalReference: 'sktl. § 6-21 / FSFIN § 6-21',
      actionScreen: 'journal',
    });
  }

  // 4) Kjøp fra utlandet / omvendt avgiftsplikt (KONTROLLPUNKT).
  const utland = await first(
    `SELECT COUNT(DISTINCT je.id)::int AS n
     FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
     WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
       AND l.vat_code = ANY($4)`,
    [org, yearStart, asOf, REVERSE_CHARGE_CODES],
  );
  if ((utland.n as number) > 0) {
    advisories.push({
      code: 'utland_mva',
      kind: 'kontrollpunkt',
      title: `${utland.n} kjøp fra utlandet med omvendt avgiftsplikt`,
      detail: 'Kjøp av fjernleverbare tjenester og varer fra utlandet krever ofte at du selv beregner og rapporterer MVA (omvendt avgiftsplikt). Bekreft at behandlingen er riktig — dette er lett å bomme på.',
      ruleReferences: [],
      legalReference: 'mval. § 3-30',
      actionScreen: 'overview',
    });
  }

  // 5) Manglende dokumentasjon (KONTROLLPUNKT).
  const nodoc = await first(
    `SELECT COUNT(DISTINCT je.id)::int AS n
     FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
     WHERE je.organization_id=$1 AND je.status='posted' AND je.is_closing=FALSE AND je.reversal_of IS NULL
       AND je.source_document_id IS NULL AND je.entry_date BETWEEN $2 AND $3
       AND l.debit_minor > 0 AND l.account_number ~ '^[4-7]'`,
    [org, yearStart, asOf],
  );
  if ((nodoc.n as number) > 0) {
    advisories.push({
      code: 'manglende_dok',
      kind: 'kontrollpunkt',
      title: `${nodoc.n} kostnadsføringer mangler bilag`,
      detail: 'Kostnader er bokført uten et kildedokument. Bokføringsloven krever dokumentasjon, og manglende bilag kan gi tapt fradrag ved kontroll. Last opp bilaget eller legg ved en forklaring.',
      ruleReferences: [],
      legalReference: 'bokføringsloven § 10',
      actionScreen: 'period-close',
    });
  }

  // 6) Store transaksjoner (KONTROLLPUNKT) — bør vurderes av regnskapsfører.
  const stor = await first(
    `SELECT COUNT(DISTINCT je.id)::int AS n
     FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
     WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
       AND l.debit_minor >= $4`,
    [org, yearStart, asOf, PRO_REVIEW_THRESHOLD.toString()],
  );
  if ((stor.n as number) > 0) {
    advisories.push({
      code: 'profesjonell_vurdering',
      kind: 'kontrollpunkt',
      title: `${stor.n} store transaksjoner (over ${formatMinorAsKr(PRO_REVIEW_THRESHOLD)} kr)`,
      detail: 'Store eller uvanlige transaksjoner (investeringer, aktivering/avskrivning, aksjer) bør kvalitetssikres av en regnskapsfører. Reknaren flagger dem, men gir ikke endelig vurdering.',
      ruleReferences: [],
      needsProfessional: true,
      actionScreen: 'journal',
    });
  }

  // 7) Forventet MVA neste termin (KONTROLLPUNKT).
  if (isVatRegistered) {
    const term = currentVatTerm(asOf);
    const vat = await buildVatReport(db, org, term.from, asOf);
    if (vat.outputVatMinor !== 0n || vat.deductibleInputVatMinor !== 0n) {
      const net = vat.netPayableMinor;
      advisories.push({
        code: 'forventet_mva',
        kind: 'kontrollpunkt',
        title: `Forventet MVA ved neste termin: ${net >= 0n ? 'å betale' : 'til gode'} ${formatMinorAsKr(net < 0n ? -net : net)} kr`,
        detail: `Så langt i terminen (${term.from} til i dag) ligger MVA-oppgjøret an til ${net >= 0n ? `å betale ${formatMinorAsKr(net)} kr` : `${formatMinorAsKr(-net)} kr til gode`}. Forfall ${term.due}. Sett av beløpet, og avstem før innsending.`,
        ruleReferences: [],
        actionScreen: 'vat',
      });
    }
  }

  // 8) Risiko for restskatt (RISIKO) — estimert skatt du bør sette av.
  const tax = await buildTaxEstimate(db, rules, { organizationId: org, orgForm, fromDate: yearStart, toDate: asOf });
  if (tax.estimatedTaxMinor > 0n) {
    advisories.push({
      code: 'restskatt_risiko',
      kind: 'risiko',
      title: `Sett av ca ${formatMinorAsKr(tax.recommendedReserveMinor)} kr til skatt og MVA`,
      detail: `Basert på resultatet hittil i år er estimert skatt ${formatMinorAsKr(tax.estimatedTaxMinor)} kr. Setter du ikke av nok underveis, risikerer du restskatt. Dette er et estimat — ikke et fastsatt beløp.`,
      ruleReferences: tax.components.map((c) => c.ruleId),
      actionScreen: 'tax',
    });
  }

  const order: Record<AdvisoryKind, number> = { risiko: 0, mulighet: 1, kontrollpunkt: 2 };
  advisories.sort((a, b) => order[a.kind] - order[b.kind]);

  return {
    fromDate: yearStart,
    toDate: asOf,
    advisories,
    disclaimer:
      'Dette er muligheter og kontrollpunkter — ikke løfter om maksimalt fradrag eller endelige vurderinger. Hvert punkt har en kilde og krever din godkjenning. Ved tvil, rådfør deg med en regnskapsfører.',
  };
}
