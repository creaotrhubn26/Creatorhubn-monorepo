/**
 * «Spør virksomheten» — svar på vanlig norsk, alltid forankret i underliggende
 * transaksjoner, dokumenter og beregninger. Språklaget RUTER spørsmålet til en
 * deterministisk svarer; TALLENE kommer fra hovedboken, aldri fra en språkmodell.
 * Hvert svar bærer klikkbare bevis så brukeren kan gå fra forklaring til fakta.
 * REN LESING.
 */
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import type { RuleRegister } from '../rules/register.js';
import { incomeStatement } from './reports.js';
import { buildVatReport } from '../vat/engine.js';

export type EvidenceType = 'document' | 'journal_entry' | 'invoice' | 'account' | 'customer';

export interface Evidence {
  type: EvidenceType;
  label: string;
  amountMinor?: string;
  documentId?: string;
  entryNumber?: number;
  invoiceId?: string;
  customerId?: string;
  account?: string;
}

export interface Answer {
  understood: boolean;
  intent: string;
  question: string;
  headline: string;
  figures: { label: string; value: string }[];
  calculation: string;
  evidence: Evidence[];
  followUps: string[];
}

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

const SUGGESTIONS = [
  'Hva bruker vi på programvare?',
  'Hva har vi kjøpt fra utlandet?',
  'Hvilke fakturaer mangler bilag?',
  'Hvor mye MVA må vi sannsynligvis betale?',
  'Hva har endret seg siden forrige måned?',
  'Hvilke kunder har aldri betalt innen fristen?',
  'Hvilke kunder er mest lønnsomme?',
];

/** Enkel, deterministisk intent-ruting (språkmodell kan plugges inn senere). */
function detectIntent(q: string): string {
  const s = q.toLowerCase();
  if (/programvare|software|edb|abonnement/.test(s) && !/øk|dyr|pris/.test(s)) return 'software_spend';
  if (/utland|utenlands|import|omvendt/.test(s)) return 'foreign_purchases';
  if (/mangl\w*\s*bilag|uten bilag|dokumentasjon mangler/.test(s)) return 'missing_docs';
  if (/mva|merverdiavgift/.test(s)) return 'expected_vat';
  if (/endr\w+ .*(måned|siden)|siden forrige måned|tjente .*mindre|mindre i|hvorfor.*mindre|resultat/.test(s)) return 'month_compare';
  if (/betal\w*.*(frist|sent|forsinket)|aldri betalt|forfalt|purring/.test(s)) return 'late_payers';
  if (/lønnsom|mest.*kunde|beste kunde|størst\w* kunde/.test(s)) return 'top_customers';
  return 'unknown';
}

export async function answerQuestion(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; question: string; asOf: string },
): Promise<Answer> {
  const { organizationId: org, question, asOf } = params;
  const year = Number(asOf.slice(0, 4));
  const asOfMonth = Number(asOf.slice(5, 7));
  const yearStart = `${year}-01-01`;
  const intent = detectIntent(question);
  const base = { understood: true, intent, question, figures: [] as Answer['figures'], evidence: [] as Evidence[], followUps: SUGGESTIONS };

  if (intent === 'software_spend') {
    const rows = await db.query(
      `SELECT je.entry_number, je.source_document_id AS document_id, l.debit_minor::TEXT AS amount, l.description
       FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
       WHERE l.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         AND l.account_number='6810' AND l.debit_minor > 0
       ORDER BY l.debit_minor DESC LIMIT 20`,
      [org, yearStart, asOf],
    );
    const total = rows.rows.reduce((a, r) => a + BigInt(r.amount), 0n);
    return {
      ...base,
      headline: `Hittil i år har dere brukt ${formatMinorAsKr(total)} kr på programvare og datakostnad (konto 6810).`,
      figures: [{ label: 'Programvare hittil i år', value: `${formatMinorAsKr(total)} kr` }, { label: 'Antall bilag', value: String(rows.rowCount ?? 0) }],
      calculation: `Sum av debet på konto 6810 (Data/EDB-kostnad) fra ${yearStart} til ${asOf}.`,
      evidence: rows.rows.slice(0, 8).map((r) => ({ type: 'journal_entry' as const, label: `Bilag ${r.entry_number}${r.description ? ` — ${r.description}` : ''}`, amountMinor: r.amount, ...(r.document_id ? { documentId: r.document_id } : {}), entryNumber: Number(r.entry_number) })),
    };
  }

  if (intent === 'foreign_purchases') {
    const rows = await db.query(
      `SELECT DISTINCT je.entry_number, je.entry_date::TEXT AS d, je.source_document_id AS document_id,
              (SELECT SUM(debit_minor) FROM journal_lines x WHERE x.entry_id=je.id AND x.account_number ~ '^[4-7]')::TEXT AS amount
       FROM journal_entries je JOIN journal_lines l ON l.entry_id=je.id
       WHERE je.organization_id=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         AND l.vat_code IN ('86','87','88','89','91','92')
       ORDER BY je.entry_number DESC LIMIT 20`,
      [org, yearStart, asOf],
    );
    const total = rows.rows.reduce((a, r) => a + BigInt(r.amount ?? '0'), 0n);
    return {
      ...base,
      headline: rows.rowCount ? `Dere har ${rows.rowCount} kjøp fra utlandet (omvendt avgiftsplikt) hittil i år, til sammen ${formatMinorAsKr(total)} kr.` : 'Vi fant ingen kjøp fra utlandet (omvendt avgiftsplikt) hittil i år.',
      figures: [{ label: 'Utlandskjøp', value: `${formatMinorAsKr(total)} kr` }, { label: 'Antall bilag', value: String(rows.rowCount ?? 0) }],
      calculation: `Bilag med MVA-kode for omvendt avgiftsplikt (86–92) fra ${yearStart} til ${asOf}.`,
      evidence: rows.rows.slice(0, 8).map((r) => ({ type: 'journal_entry' as const, label: `Bilag ${r.entry_number} · ${r.d}`, amountMinor: r.amount, ...(r.document_id ? { documentId: r.document_id } : {}), entryNumber: Number(r.entry_number) })),
    };
  }

  if (intent === 'missing_docs') {
    const rows = await db.query(
      `SELECT je.entry_number, je.entry_date::TEXT AS d,
              (SELECT SUM(debit_minor) FROM journal_lines x WHERE x.entry_id=je.id AND x.account_number ~ '^[4-7]')::TEXT AS amount
       FROM journal_entries je
       WHERE je.organization_id=$1 AND je.status='posted' AND je.is_closing=FALSE AND je.reversal_of IS NULL
         AND je.source_document_id IS NULL AND je.entry_date BETWEEN $2 AND $3
         AND EXISTS (SELECT 1 FROM journal_lines l WHERE l.entry_id=je.id AND l.debit_minor>0 AND l.account_number ~ '^[4-7]')
       ORDER BY je.entry_number DESC LIMIT 20`,
      [org, yearStart, asOf],
    );
    return {
      ...base,
      headline: rows.rowCount ? `${rows.rowCount} kostnadsføringer mangler bilag hittil i år. Bokføringsloven krever dokumentasjon.` : 'Alle kostnadsføringer hittil i år har et bilag knyttet til seg. 🎉',
      figures: [{ label: 'Uten bilag', value: String(rows.rowCount ?? 0) }],
      calculation: `Posterte kostnadsbilag (konto 4–7) uten kildedokument fra ${yearStart} til ${asOf}.`,
      evidence: rows.rows.slice(0, 8).map((r) => ({ type: 'journal_entry' as const, label: `Bilag ${r.entry_number} · ${r.d}`, amountMinor: r.amount ?? undefined, entryNumber: Number(r.entry_number) })),
    };
  }

  if (intent === 'expected_vat') {
    const idx = Math.floor((asOfMonth - 1) / 2);
    const term = { from: `${year}-${pad(idx * 2 + 1)}-01`, endMonth: idx * 2 + 2 };
    const vat = await buildVatReport(db, org, term.from, asOf);
    const net = vat.netPayableMinor;
    return {
      ...base,
      intent: 'expected_vat',
      headline: `Så langt i inneværende termin ligger MVA-oppgjøret an til ${net >= 0n ? `å betale ${formatMinorAsKr(net)} kr` : `${formatMinorAsKr(-net)} kr til gode`}.`,
      figures: [
        { label: 'Utgående MVA', value: `${formatMinorAsKr(vat.outputVatMinor)} kr` },
        { label: 'Fradragsberettiget inngående', value: `${formatMinorAsKr(vat.deductibleInputVatMinor)} kr` },
        { label: net >= 0n ? 'Å betale' : 'Til gode', value: `${formatMinorAsKr(net < 0n ? -net : net)} kr` },
      ],
      calculation: `Utgående minus fradragsberettiget inngående MVA i terminen (${term.from} til i dag). Et estimat — avstem før innsending.`,
      evidence: [{ type: 'account', label: 'Se MVA-spesifikasjon', account: '2740' }],
    };
  }

  if (intent === 'month_compare') {
    let m = asOfMonth;
    for (let i = 0; i < 12; i++) if (question.toLowerCase().includes(MONTHS[i]!)) m = i + 1;
    const cur = monthRange(year, m);
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? year - 1 : year;
    const prev = monthRange(prevYear, prevMonth);
    const [a, b] = await Promise.all([
      incomeStatement(db, { organizationId: org, fromDate: cur.from, toDate: cur.to }),
      incomeStatement(db, { organizationId: org, fromDate: prev.from, toDate: prev.to }),
    ]);
    const delta = a.resultMinor - b.resultMinor;
    // Kontoer med størst endring.
    const byAcc = new Map<string, { name: string; cur: bigint; prev: bigint }>();
    for (const r of a.byAccount) byAcc.set(r.accountNumber, { name: r.accountName, cur: r.accountType === 'revenue' ? -r.balanceMinor : r.balanceMinor, prev: 0n });
    for (const r of b.byAccount) { const e = byAcc.get(r.accountNumber) ?? { name: r.accountName, cur: 0n, prev: 0n }; e.prev = r.accountType === 'revenue' ? -r.balanceMinor : r.balanceMinor; byAcc.set(r.accountNumber, e); }
    const changes = [...byAcc.entries()].map(([acc, e]) => ({ acc, name: e.name, diff: e.cur - e.prev })).filter((x) => x.diff !== 0n).sort((x, y) => (y.diff > x.diff ? 1 : y.diff < x.diff ? -1 : 0));
    return {
      ...base,
      intent: 'month_compare',
      headline: `Resultatet i ${MONTHS[m - 1]} var ${formatMinorAsKr(a.resultMinor)} kr, ${delta >= 0n ? `${formatMinorAsKr(delta)} kr høyere` : `${formatMinorAsKr(-delta)} kr lavere`} enn ${MONTHS[prevMonth - 1]}.`,
      figures: [
        { label: `${MONTHS[m - 1]}`, value: `${formatMinorAsKr(a.resultMinor)} kr` },
        { label: `${MONTHS[prevMonth - 1]}`, value: `${formatMinorAsKr(b.resultMinor)} kr` },
        { label: 'Endring', value: `${delta >= 0n ? '+' : '−'}${formatMinorAsKr(delta < 0n ? -delta : delta)} kr` },
      ],
      calculation: `Resultatregnskap (inntekt − kostnad) for ${MONTHS[m - 1]} mot ${MONTHS[prevMonth - 1]}. Kontoene med størst endring vises som bevis.`,
      evidence: changes.slice(0, 6).map((c) => ({ type: 'account' as const, label: `${c.acc} ${c.name}: ${c.diff >= 0n ? '+' : '−'}${formatMinorAsKr(c.diff < 0n ? -c.diff : c.diff)} kr`, account: c.acc, amountMinor: c.diff.toString() })),
    };
  }

  if (intent === 'late_payers') {
    const rows = await db.query(
      `SELECT c.id AS customer_id, c.name, COUNT(*)::int AS n,
              COALESCE(SUM(i.gross_minor - i.paid_minor),0)::TEXT AS outstanding
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.organization_id=$1 AND i.status='issued' AND i.due_date IS NOT NULL
         AND i.due_date < $2 AND i.paid_minor < i.gross_minor
       GROUP BY c.id, c.name ORDER BY n DESC LIMIT 20`,
      [org, asOf],
    );
    const total = rows.rows.reduce((a, r) => a + BigInt(r.outstanding), 0n);
    return {
      ...base,
      intent: 'late_payers',
      headline: rows.rowCount ? `${rows.rowCount} kunde(r) har forfalte, ubetalte fakturaer — til sammen ${formatMinorAsKr(total)} kr utestående.` : 'Ingen kunder har forfalte, ubetalte fakturaer akkurat nå.',
      figures: [{ label: 'Kunder med forfalt', value: String(rows.rowCount ?? 0) }, { label: 'Utestående', value: `${formatMinorAsKr(total)} kr` }],
      calculation: `Utstedte fakturaer med forfallsdato før ${asOf} som ikke er fullt betalt, gruppert per kunde.`,
      evidence: rows.rows.slice(0, 8).map((r) => ({ type: 'customer' as const, label: `${r.name} — ${r.n} forfalt (${formatMinorAsKr(BigInt(r.outstanding))} kr)`, amountMinor: r.outstanding, customerId: r.customer_id })),
    };
  }

  if (intent === 'top_customers') {
    const rows = await db.query(
      `SELECT c.id AS customer_id, c.name, COALESCE(SUM(i.gross_minor),0)::TEXT AS revenue
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.organization_id=$1 AND i.status IN ('issued','paid') AND i.invoice_date >= $2
       GROUP BY c.id, c.name ORDER BY SUM(i.gross_minor) DESC LIMIT 10`,
      [org, yearStart],
    );
    const top = rows.rows[0];
    return {
      ...base,
      intent: 'top_customers',
      headline: top ? `${top.name} er den største kunden hittil i år med ${formatMinorAsKr(BigInt(top.revenue))} kr fakturert.` : 'Ingen fakturerte kunder hittil i år.',
      figures: top ? [{ label: 'Største kunde', value: top.name }, { label: 'Fakturert', value: `${formatMinorAsKr(BigInt(top.revenue))} kr` }] : [],
      calculation: `Fakturert beløp per kunde (utstedt/betalt) fra ${yearStart}. Lønnsomhet krever kostnadsfordeling — dette viser omsetning.`,
      evidence: rows.rows.slice(0, 8).map((r) => ({ type: 'customer' as const, label: `${r.name}: ${formatMinorAsKr(BigInt(r.revenue))} kr`, amountMinor: r.revenue, customerId: r.customer_id })),
    };
  }

  return {
    understood: false,
    intent: 'unknown',
    question,
    headline: 'Det spørsmålet forstår jeg ikke ennå. Prøv et av forslagene under.',
    figures: [],
    calculation: '',
    evidence: [],
    followUps: SUGGESTIONS,
  };
}
