/**
 * Rapporter genereres deterministisk fra bokførte posteringer.
 * Rapporterte tall kommer ALDRI fra en AI-modell — bare fra hovedboken.
 */
import type { Db } from '../db/pool.js';
import { getAccountDef, type AccountType } from '../coa/accounts.js';

export interface TrialBalanceRow {
  accountNumber: string;
  accountName: string;
  accountType: AccountType | 'unknown';
  debitMinor: bigint;
  creditMinor: bigint;
  /** positiv = debetsaldo, negativ = kreditsaldo */
  balanceMinor: bigint;
}

export interface ReportFilter {
  organizationId: string;
  /** ISO-datoer, inklusiv. */
  fromDate?: string;
  toDate?: string;
  /** Ta med linjer fra reverserte bilag (default true — reverseringen nuller dem ut). */
  project?: string;
  department?: string;
  /** Ta med årsavslutnings-/disponeringsbilag (default true). Resultatregnskapet setter false. */
  includeClosing?: boolean;
}

function dateFilterSql(filter: ReportFilter, params: unknown[]): string {
  let sql = '';
  if (filter.fromDate) {
    params.push(filter.fromDate);
    sql += ` AND e.entry_date >= $${params.length}`;
  }
  if (filter.toDate) {
    params.push(filter.toDate);
    sql += ` AND e.entry_date <= $${params.length}`;
  }
  if (filter.project) {
    params.push(filter.project);
    sql += ` AND l.project = $${params.length}`;
  }
  if (filter.department) {
    params.push(filter.department);
    sql += ` AND l.department = $${params.length}`;
  }
  // Årsavslutningsbilag holdes utenfor resultatregnskapet (men er med i balansen).
  if (filter.includeClosing === false) {
    sql += ` AND e.is_closing = FALSE`;
  }
  return sql;
}

export async function trialBalance(db: Db, filter: ReportFilter): Promise<TrialBalanceRow[]> {
  const params: unknown[] = [filter.organizationId];
  const res = await db.query(
    `SELECT l.account_number,
            COALESCE(a.name, l.account_number) AS account_name,
            a.account_type,
            SUM(l.debit_minor)::TEXT AS debit,
            SUM(l.credit_minor)::TEXT AS credit
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     LEFT JOIN ledger_accounts a
       ON a.organization_id = l.organization_id AND a.account_number = l.account_number
     WHERE l.organization_id = $1${dateFilterSql(filter, params)}
     GROUP BY l.account_number, a.name, a.account_type
     ORDER BY l.account_number`,
    params,
  );
  return res.rows.map((r) => {
    const debit = BigInt(r.debit);
    const credit = BigInt(r.credit);
    return {
      accountNumber: r.account_number,
      accountName: r.account_name,
      accountType: (r.account_type ?? getAccountDef(r.account_number)?.type ?? 'unknown') as
        | AccountType
        | 'unknown',
      debitMinor: debit,
      creditMinor: credit,
      balanceMinor: debit - credit,
    };
  });
}

export interface IncomeStatement {
  revenueMinor: bigint; // positivt = inntekt
  expenseMinor: bigint; // positivt = kostnad
  resultMinor: bigint; // inntekt - kostnad (positivt = overskudd)
  byAccount: TrialBalanceRow[];
}

export async function incomeStatement(db: Db, filter: ReportFilter): Promise<IncomeStatement> {
  // Resultatregnskapet viser driften — årsavslutningsbilag (som nuller P&L mot
  // egenkapital) holdes utenfor, ellers ville avslutningsåret vist null.
  const rows = await trialBalance(db, { ...filter, includeClosing: false });
  const pnl = rows.filter((r) => r.accountType === 'revenue' || r.accountType === 'expense');
  let revenue = 0n;
  let expense = 0n;
  for (const row of pnl) {
    if (row.accountType === 'revenue') revenue += -row.balanceMinor; // kreditsaldo = inntekt
    else expense += row.balanceMinor; // debetsaldo = kostnad
  }
  return { revenueMinor: revenue, expenseMinor: expense, resultMinor: revenue - expense, byAccount: pnl };
}

export interface VatThreshold {
  asOf: string;
  windowFrom: string;
  thresholdMinor: bigint;
  taxableTurnoverMinor: bigint;
  remainingMinor: bigint;
  /** Prosent av terskelen (én desimal), kan overstige 100. */
  pct: number;
  crossed: boolean;
  monthly: { month: string; minor: bigint }[];
}

/**
 * Terskel for MVA-registreringsplikt: avgiftspliktig omsetning over 50 000 kr i en
 * LØPENDE 12-måneders periode (mval. § 2-1). Vi summerer salgsinntekt (konto
 * 3000–3799 — omsetning, ikke annen driftsinntekt/tilskudd) fra bokførte
 * posteringer i vinduet (asOf−12 mnd, asOf]. Terskelen gjelder AVGIFTSPLIKTIG
 * omsetning; salg som er unntatt mva må trekkes fra — det synliggjøres i UI-et.
 */
export async function vatRegistrationThreshold(
  db: Db,
  params: { organizationId: string; asOf: string },
): Promise<VatThreshold> {
  const THRESHOLD = 5_000_000n; // 50 000 kr i øre
  const totalSql = `
    SELECT COALESCE(SUM(l.credit_minor - l.debit_minor), 0)::TEXT AS net,
           ($2::date - INTERVAL '12 months')::date::text AS window_from
    FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
    WHERE l.organization_id = $1
      AND l.account_number ~ '^[0-9]{4}$' AND l.account_number::int BETWEEN 3000 AND 3799
      AND e.entry_date > ($2::date - INTERVAL '12 months') AND e.entry_date <= $2::date`;
  const monthlySql = `
    SELECT to_char(date_trunc('month', e.entry_date), 'YYYY-MM') AS month,
           COALESCE(SUM(l.credit_minor - l.debit_minor), 0)::TEXT AS net
    FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
    WHERE l.organization_id = $1
      AND l.account_number ~ '^[0-9]{4}$' AND l.account_number::int BETWEEN 3000 AND 3799
      AND e.entry_date > ($2::date - INTERVAL '12 months') AND e.entry_date <= $2::date
    GROUP BY 1 ORDER BY 1`;
  const [total, monthly] = await Promise.all([
    db.query(totalSql, [params.organizationId, params.asOf]),
    db.query(monthlySql, [params.organizationId, params.asOf]),
  ]);
  const raw = BigInt(total.rows[0].net);
  const turnover = raw < 0n ? 0n : raw;
  const remaining = THRESHOLD > turnover ? THRESHOLD - turnover : 0n;
  const pct = Math.round(Number((turnover * 1000n) / THRESHOLD)) / 10;
  return {
    asOf: params.asOf,
    windowFrom: total.rows[0].window_from,
    thresholdMinor: THRESHOLD,
    taxableTurnoverMinor: turnover,
    remainingMinor: remaining,
    pct,
    crossed: turnover >= THRESHOLD,
    monthly: monthly.rows.map((m) => ({ month: m.month, minor: BigInt(m.net) })),
  };
}

export interface BalanceSheet {
  assetsMinor: bigint;
  liabilitiesMinor: bigint;
  equityMinor: bigint;
  /** Udisponert resultat i perioden (inngår i egenkapital ved kontroll). */
  retainedResultMinor: bigint;
  balances: TrialBalanceRow[];
}

export async function balanceSheet(db: Db, filter: ReportFilter): Promise<BalanceSheet> {
  const rows = await trialBalance(db, filter);
  let assets = 0n;
  let liabilities = 0n;
  let equity = 0n;
  let result = 0n;
  for (const row of rows) {
    switch (row.accountType) {
      case 'asset':
        assets += row.balanceMinor;
        break;
      case 'liability':
        liabilities += -row.balanceMinor;
        break;
      case 'equity':
        equity += -row.balanceMinor;
        break;
      case 'revenue':
        result += -row.balanceMinor;
        break;
      case 'expense':
        result -= row.balanceMinor;
        break;
      default:
        break;
    }
  }
  return {
    assetsMinor: assets,
    liabilitiesMinor: liabilities,
    equityMinor: equity,
    retainedResultMinor: result,
    balances: rows.filter((r) => ['asset', 'liability', 'equity'].includes(r.accountType)),
  };
}

export interface GeneralLedgerLine {
  entryId: string;
  entryNumber: number;
  entryDate: string;
  entryStatus: string;
  description: string | null;
  accountNumber: string;
  vatCode: string | null;
  debitMinor: bigint;
  creditMinor: bigint;
  sourceDocumentId: string | null;
  vendorId: string | null;
  customerId: string | null;
}

/** Hovedbok: alle bevegelser per konto, med toveis spor til bilag og dokument. */
export async function generalLedger(
  db: Db,
  filter: ReportFilter & { accountNumber?: string },
): Promise<GeneralLedgerLine[]> {
  const params: unknown[] = [filter.organizationId];
  let accountSql = '';
  if (filter.accountNumber) {
    params.push(filter.accountNumber);
    accountSql = ` AND l.account_number = $${params.length}`;
  }
  const res = await db.query(
    `SELECT e.id AS entry_id, e.entry_number, e.entry_date::TEXT AS entry_date, e.status,
            COALESCE(l.description, e.description) AS description,
            l.account_number, l.vat_code, l.debit_minor::TEXT AS debit, l.credit_minor::TEXT AS credit,
            e.source_document_id, l.vendor_id, l.customer_id
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1${accountSql}${dateFilterSql(filter, params)}
     ORDER BY l.account_number, e.entry_date, e.entry_number, l.line_number`,
    params,
  );
  return res.rows.map((r) => ({
    entryId: r.entry_id,
    entryNumber: Number(r.entry_number),
    entryDate: r.entry_date,
    entryStatus: r.status,
    description: r.description,
    accountNumber: r.account_number,
    vatCode: r.vat_code,
    debitMinor: BigInt(r.debit),
    creditMinor: BigInt(r.credit),
    sourceDocumentId: r.source_document_id,
    vendorId: r.vendor_id,
    customerId: r.customer_id,
  }));
}

export interface SubledgerRow {
  counterpartyId: string;
  counterpartyName: string;
  balanceMinor: bigint;
}

/** Reskontro: saldo per leverandør (2400) eller kunde (1500). */
export async function subledger(
  db: Db,
  organizationId: string,
  kind: 'vendors' | 'customers',
): Promise<SubledgerRow[]> {
  const idColumn = kind === 'vendors' ? 'vendor_id' : 'customer_id';
  const table = kind === 'vendors' ? 'vendors' : 'customers';
  const res = await db.query(
    `SELECT l.${idColumn} AS id, c.name,
            SUM(l.debit_minor - l.credit_minor)::TEXT AS balance
     FROM journal_lines l
     JOIN ${table} c ON c.id = l.${idColumn}
     WHERE l.organization_id = $1 AND l.${idColumn} IS NOT NULL
     GROUP BY l.${idColumn}, c.name
     ORDER BY c.name`,
    [organizationId],
  );
  return res.rows.map((r) => ({
    counterpartyId: r.id,
    counterpartyName: r.name,
    balanceMinor: BigInt(r.balance),
  }));
}
