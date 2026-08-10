/**
 * AI-økonomi: kostnad (hva vi betaler AI-/API-leverandører) vs inntekt (hva vi
 * fakturerer kundene for AI-forbruk) — side ved side, per produkt.
 *
 * To dedikerte kontoer:
 *   - 6555 AI-tjenester og API-forbruk (kostnad)
 *   - 3210 Bruksbasert inntekt (AI/kreditt) (inntekt)
 *
 * AI-inntekt tagges automatisk av Stripe-synken (overage-linjer → 3210).
 * AI-kostnad bokføres når leverandørbilag (Anthropic/OpenAI/…) godkjennes på
 * 6555, gjerne med produktdimensjon. `aiMarginReport` viser inntekt − kostnad
 * per produkt. Tallene fylles når data flyter inn — strukturen ligger klar.
 */

import { getAccountDef } from '../coa/accounts.js';
import { newId } from '../shared/ids.js';
import type { Db } from '../db/pool.js';

export const AI_COST_ACCOUNT = '6555';
export const AI_REVENUE_ACCOUNT = '3210';

/** Kjenner igjen en AI-/bruksbasert linje fra Stripe (overage/kreditt). */
export function isAiUsageLine(text: string | null | undefined): boolean {
  if (!text) return false;
  // «ai» krever ordgrenser (unngå air/aid/aim); resten matcher også som ord-prefiks
  // (f.eks. «Kredittpakke», «tokens»).
  return /(\bai\b|overage|over\s?forbruk|\bcredit|\bkreditt|\busage|\bmetered|\btoken)/i.test(text);
}

/** Idempotent: sikrer at AI-kontoene finnes for organisasjonen. */
export async function ensureAiAccounts(db: Db, organizationId: string): Promise<void> {
  for (const number of [AI_COST_ACCOUNT, AI_REVENUE_ACCOUNT]) {
    const def = getAccountDef(number);
    if (!def) continue;
    await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, account_number) DO NOTHING`,
      [newId(), organizationId, def.number, def.name, def.type],
    );
  }
}

export interface AiMarginRow {
  /** Produktkode (dimensjon), eller '(uallokert)' for utagget. */
  code: string;
  aiRevenueMinor: bigint;
  aiCostMinor: bigint;
  marginMinor: bigint;
}

/** AI-inntekt vs AI-kostnad per produkt (fra POSTERTE journallinjer). */
export async function aiMarginReport(
  db: Db,
  params: { organizationId: string; fromDate?: string; toDate?: string },
): Promise<AiMarginRow[]> {
  const args: unknown[] = [params.organizationId, AI_REVENUE_ACCOUNT, AI_COST_ACCOUNT];
  let dateSql = '';
  if (params.fromDate) {
    args.push(params.fromDate);
    dateSql += ` AND e.entry_date >= $${args.length}`;
  }
  if (params.toDate) {
    args.push(params.toDate);
    dateSql += ` AND e.entry_date <= $${args.length}`;
  }
  const res = await db.query<{ code: string; ai_revenue: string; ai_cost: string }>(
    `SELECT COALESCE(l.project, '(uallokert)') AS code,
            COALESCE(SUM(CASE WHEN l.account_number = $2 THEN l.credit_minor - l.debit_minor ELSE 0 END), 0)::TEXT AS ai_revenue,
            COALESCE(SUM(CASE WHEN l.account_number = $3 THEN l.debit_minor - l.credit_minor ELSE 0 END), 0)::TEXT AS ai_cost
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1 AND l.account_number IN ($2, $3)${dateSql}
     GROUP BY COALESCE(l.project, '(uallokert)')
     ORDER BY 1`,
    args,
  );
  return res.rows.map((r) => {
    const rev = BigInt(r.ai_revenue);
    const cost = BigInt(r.ai_cost);
    return { code: r.code, aiRevenueMinor: rev, aiCostMinor: cost, marginMinor: rev - cost };
  });
}
