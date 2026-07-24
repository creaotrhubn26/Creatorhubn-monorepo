/**
 * Kontinuerlig regnskapsavslutning. I stedet for å rydde regnskapet ved
 * månedsslutt, kontrolleres perioden LØPENDE: hvor klar er måneden til å låses,
 * og hva gjenstår? Gir en «ferdig-avstemt»-prosent + en dynamisk liste over det
 * som må ryddes, med et sammendrag på vanlig norsk.
 *
 * Komponerer eksisterende sjekker (feil-deteksjon, bankavstemming) og legger til
 * periode-spesifikke: transaksjoner uten bilag, uvanlige MVA-koder, mulig
 * periodisering, negativ bankbeholdning og leverandørfaktura ført som privat.
 * REN LESING.
 */
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import type { RuleRegister } from '../rules/register.js';
import { detectBookkeepingErrors } from './anomalies.js';

const MONTHS = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
];

// Kontoer der en stor engangskostnad ofte dekker en lengre periode (forsikring,
// husleie, årsabonnement) og bør periodiseres.
const PERIODIZE_ACCOUNTS = ['6300', '6810', '7500', '7770', '7900'];
const PERIODIZE_THRESHOLD_MINOR = 1200000n; // 12 000 kr

export type CloseSeverity = 'blocker' | 'warning' | 'info';

export interface CloseItem {
  code: string;
  severity: CloseSeverity;
  title: string;
  detail: string;
  count: number;
  /** Kort setningsledd til sammendraget, f.eks. «tre bilag mangler». */
  phrase: string;
  ruleReferences?: string[];
  actionScreen?: string;
}

export interface PeriodCloseAssessment {
  year: number;
  month: number;
  monthName: string;
  status: 'open' | 'locked';
  readinessPct: number;
  ready: boolean;
  items: CloseItem[];
  summary: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function nWord(n: number, one: string, many: string): string {
  if (n === 1) return `én ${one}`;
  const words: Record<number, string> = { 2: 'to', 3: 'tre', 4: 'fire', 5: 'fem' };
  return `${words[n] ?? n} ${many}`;
}

export async function assessPeriodClose(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; year: number; month: number },
): Promise<PeriodCloseAssessment> {
  const { organizationId: org, year, month } = params;
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const items: CloseItem[] = [];

  const periodRow = await db.query(
    `SELECT status FROM accounting_periods WHERE organization_id = $1 AND year = $2 AND month = $3`,
    [org, year, month],
  );
  const status: 'open' | 'locked' = periodRow.rows[0]?.status === 'locked' ? 'locked' : 'open';

  const one = async (sql: string, p: unknown[]) => (await db.query(sql, p)).rows[0];

  // Nevner for ferdig-prosenten: «arbeidsenheter» i måneden.
  const totals = await one(
    `SELECT
       (SELECT COUNT(*) FROM bank_transactions WHERE organization_id=$1 AND booked_date BETWEEN $2 AND $3)::int AS bank,
       (SELECT COUNT(*) FROM journal_entries WHERE organization_id=$1 AND status='posted' AND entry_date BETWEEN $2 AND $3)::int AS entries`,
    [org, monthStart, monthEnd],
  );
  const pendingDocs = (
    await one(
      `SELECT COUNT(*)::int AS n FROM source_documents WHERE organization_id=$1 AND status IN ('needs_review','extracted')`,
      [org],
    )
  ).n as number;

  // 1) Bankavstemming — uavstemte transaksjoner i måneden.
  const unmatched = (
    await one(
      `SELECT COUNT(*)::int AS n FROM bank_transactions
       WHERE organization_id=$1 AND booked_date BETWEEN $2 AND $3 AND status='unmatched'`,
      [org, monthStart, monthEnd],
    )
  ).n as number;
  if (unmatched > 0) {
    items.push({
      code: 'bank_uavstemt',
      severity: 'blocker',
      title: `${unmatched} uavstemt${unmatched > 1 ? 'e' : ''} banktransaksjon${unmatched > 1 ? 'er' : ''}`,
      detail: 'Banktransaksjoner i måneden er ikke koblet til et bilag. Avstemming sikrer at alt du har betalt og fått inn er bokført.',
      count: unmatched,
      phrase: `${nWord(unmatched, 'banktransaksjon', 'banktransaksjoner')} er ikke avstemt`,
      actionScreen: 'bank',
    });
  }

  // 2) Bilag som venter på behandling.
  if (pendingDocs > 0) {
    items.push({
      code: 'bilag_mangler',
      severity: 'blocker',
      title: `${pendingDocs} bilag venter på behandling`,
      detail: 'Bilag er lest, men ikke godkjent og bokført. Perioden er ikke komplett før de er behandlet.',
      count: pendingDocs,
      phrase: `${nWord(pendingDocs, 'bilag mangler', 'bilag mangler')}`,
      actionScreen: 'documents',
    });
  }

  // 3) Transaksjoner uten bilag — posterte kostnadsbilag uten kildedokument.
  const noDoc = (
    await one(
      `SELECT COUNT(DISTINCT je.id)::int AS n
       FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
       WHERE je.organization_id=$1 AND je.status='posted' AND je.is_closing=FALSE
         AND je.reversal_of IS NULL AND je.source_document_id IS NULL
         AND je.entry_date BETWEEN $2 AND $3
         AND l.debit_minor > 0 AND l.account_number ~ '^[4-7]'`,
      [org, monthStart, monthEnd],
    )
  ).n as number;
  if (noDoc > 0) {
    items.push({
      code: 'uten_bilag',
      severity: 'warning',
      title: `${noDoc} kostnadsføring${noDoc > 1 ? 'er' : ''} uten bilag`,
      detail: 'Kostnader er bokført uten et kildedokument (kvittering/faktura). Bokføringsloven krever dokumentasjon — last opp bilaget eller legg ved en forklaring.',
      count: noDoc,
      phrase: `${nWord(noDoc, 'kostnad mangler bilag', 'kostnader mangler bilag')}`,
      actionScreen: 'journal',
    });
  }

  // 4) Feil-deteksjon på månedens bilag (dobbeltføring, glemt MVA, bør aktiveres).
  const anomalies = await detectBookkeepingErrors(db, rules, { organizationId: org, fromDate: monthStart, toDate: monthEnd });
  const dupes = anomalies.errors.filter((e) => e.code === 'mulig_dobbeltforing').length;
  if (dupes > 0) {
    items.push({
      code: 'dobbeltforing',
      severity: 'warning',
      title: `${dupes} mulig${dupes > 1 ? 'e' : ''} dobbeltføring${dupes > 1 ? 'er' : ''}`,
      detail: 'Bilag med samme leverandør og beløp innen få dager — kontroller at samme kjøp ikke er ført to ganger.',
      count: dupes,
      phrase: `${nWord(dupes, 'betaling kan være bokført dobbelt', 'betalinger kan være bokført dobbelt')}`,
      actionScreen: 'overview',
    });
  }
  const glemtMva = anomalies.errors.filter((e) => e.code === 'glemt_mva_fradrag').length;
  if (glemtMva > 0) {
    items.push({
      code: 'mva_kontroll',
      severity: 'warning',
      title: `${glemtMva} bilag med mulig glemt MVA-fradrag`,
      detail: 'Dokumentet viser MVA, men bilaget er bokført uten fradrag. Kontroller MVA-koden.',
      count: glemtMva,
      phrase: `${nWord(glemtMva, 'bilag kan mangle MVA-fradrag', 'bilag kan mangle MVA-fradrag')}`,
      ruleReferences: ['no.vat.rate.standard'],
      actionScreen: 'overview',
    });
  }

  // 5) Uvanlige MVA-koder — omvendt avgiftsplikt krever alltid kontroll.
  const reverseCharge = (
    await one(
      `SELECT COUNT(DISTINCT je.id)::int AS n
       FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
       WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         AND l.vat_code IN ('86','87','88','89','91','92')`,
      [org, monthStart, monthEnd],
    )
  ).n as number;
  if (reverseCharge > 0) {
    items.push({
      code: 'uvanlig_mva',
      severity: 'info',
      title: `${reverseCharge} bilag med omvendt avgiftsplikt`,
      detail: 'Bilag bruker MVA-koder for omvendt avgiftsplikt (utland/innførsel). Disse er lette å bomme på — bekreft at behandlingen er riktig.',
      count: reverseCharge,
      phrase: `${nWord(reverseCharge, 'bilag har uvanlig MVA-kode', 'bilag har uvanlig MVA-kode')}`,
      actionScreen: 'overview',
    });
  }

  // 6) Mulig periodisering — store engangskostnader som ofte dekker en lengre periode.
  const periodize = await db.query(
    `SELECT je.entry_number, l.account_number, l.debit_minor
     FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
     WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
       AND l.debit_minor >= $4 AND l.account_number = ANY($5)
     ORDER BY l.debit_minor DESC`,
    [org, monthStart, monthEnd, PERIODIZE_THRESHOLD_MINOR.toString(), PERIODIZE_ACCOUNTS],
  );
  if (periodize.rowCount && periodize.rowCount > 0) {
    const biggest = periodize.rows[0];
    const def = getAccountDef(biggest.account_number);
    items.push({
      code: 'periodisering',
      severity: 'info',
      title: `${periodize.rowCount} kostnad${periodize.rowCount > 1 ? 'er' : ''} bør kanskje periodiseres`,
      detail: `Store engangskostnader (f.eks. ${def?.name ?? 'forsikring/husleie/abonnement'}) dekker ofte en lengre periode. ${formatMinorAsKr(BigInt(biggest.debit_minor))} kr på bilag ${biggest.entry_number} kan fordeles over månedene den gjelder.`,
      count: periodize.rowCount,
      phrase: `${nWord(periodize.rowCount, 'faktura bør periodiseres', 'fakturaer bør periodiseres')}`,
      actionScreen: 'journal',
    });
  }

  // 7) Negativ bankbeholdning — en umulig/brutt regnskapstilstand ved periodeslutt.
  const negBank = (
    await one(
      `SELECT COALESCE(SUM(l.debit_minor - l.credit_minor),0)::TEXT AS bal
       FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
       WHERE l.organization_id=$1 AND e.entry_date <= $2 AND l.account_number BETWEEN '1900' AND '1999'`,
      [org, monthEnd],
    )
  ).bal as string;
  if (BigInt(negBank) < 0n) {
    items.push({
      code: 'negativ_bank',
      severity: 'blocker',
      title: 'Bankkontoen viser negativ saldo',
      detail: `Hovedboken viser ${formatMinorAsKr(BigInt(negBank))} kr på bank ved månedsslutt. Det betyr som regel manglende innbetalinger eller feil ført uttak — kontroller før perioden låses.`,
      count: 1,
      phrase: 'bankkontoen står negativt',
      actionScreen: 'bank',
    });
  }

  // 8) Leverandørfaktura ført som privatkjøp — debet på privatkonto (2060) med leverandør/bilag.
  const privateMisc = (
    await one(
      `SELECT COUNT(DISTINCT je.id)::int AS n
       FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
       WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         AND l.account_number='2060' AND l.debit_minor > 0
         AND (l.vendor_id IS NOT NULL OR je.source_document_id IS NOT NULL)`,
      [org, monthStart, monthEnd],
    )
  ).n as number;
  if (privateMisc > 0) {
    items.push({
      code: 'privat_feil',
      severity: 'warning',
      title: `${privateMisc} mulig leverandørkjøp ført som privat`,
      detail: 'Beløp er ført mot privatkonto (2060), men har en leverandør eller et bilag knyttet til seg. Er dette egentlig en fradragsberettiget virksomhetskostnad?',
      count: privateMisc,
      phrase: `${nWord(privateMisc, 'privatføring bør sjekkes', 'privatføringer bør sjekkes')}`,
      actionScreen: 'journal',
    });
  }

  // Ferdig-prosent: andel av månedens arbeidsenheter (bilag + banktransaksjoner)
  // som er «rene». Ett bilag flagget av flere sjekker telles bare én gang.
  const flaggedEntries = (
    await one(
      `SELECT COUNT(DISTINCT je.id)::int AS n
       FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
       WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         AND (
           (je.is_closing=FALSE AND je.reversal_of IS NULL AND je.source_document_id IS NULL AND l.debit_minor>0 AND l.account_number ~ '^[4-7]')
           OR (l.debit_minor >= $4 AND l.account_number = ANY($5))
           OR (l.vat_code IN ('86','87','88','89','91','92'))
           OR (l.account_number='2060' AND l.debit_minor>0 AND (l.vendor_id IS NOT NULL OR je.source_document_id IS NOT NULL))
         )`,
      [org, monthStart, monthEnd, PERIODIZE_THRESHOLD_MINOR.toString(), PERIODIZE_ACCOUNTS],
    )
  ).n as number;
  const entryCount = totals.entries as number;
  const bankCount = totals.bank as number;
  const cleanUnits = Math.max(0, entryCount - flaggedEntries) + Math.max(0, bankCount - unmatched);
  const workUnits = entryCount + bankCount + pendingDocs;
  // Ingen aktivitet = ingenting å avstemme = ferdig.
  const readinessPct = workUnits === 0 ? 100 : Math.max(0, Math.min(100, Math.round((100 * cleanUnits) / workUnits)));
  const ready = !items.some((i) => i.severity === 'blocker');

  // Sammendrag på vanlig norsk.
  const monthName = MONTHS[month - 1] ?? `Måned ${month}`;
  let summary: string;
  if (status === 'locked') {
    summary = `${monthName} er avsluttet og låst.`;
  } else if (items.length === 0) {
    summary = `${monthName} er 100 % avstemt og klar til å låses.`;
  } else {
    const phrases = items.slice(0, 4).map((i) => i.phrase);
    const joined =
      phrases.length === 1
        ? phrases[0]!
        : `${phrases.slice(0, -1).join(', ')} og ${phrases[phrases.length - 1]}`;
    summary = `${monthName} er ${readinessPct} % ferdig avstemt. ${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
  }

  return { year, month, monthName, status, readinessPct, ready, items, summary };
}
