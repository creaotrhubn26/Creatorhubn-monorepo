/**
 * Bankavstemmings-status — «har du fått med alt?». Sammenligner hva som har skjedd
 * i banken (importerte transaksjoner) med hva som er håndtert i regnskapet, og sier
 * ifra når du er FERDIG: alle transaksjoner matchet/behandlet og ingen forslag som
 * venter. Ren lesing — dette signalet bokfører ingenting selv.
 */
import type { Db } from '../db/pool.js';

export interface BankReconciliation {
  bankAccountId: string;
  name: string;
  total: number;
  matched: number;
  unmatched: number;
  ignored: number;
  /** Forslag som venter på din godkjenning (menneskelig bekreftelse). */
  pendingSuggestions: number;
  /** Ferdig når det finnes transaksjoner, ingen er uavstemte, og ingen forslag venter. */
  done: boolean;
}

export interface ReconciliationStatus {
  accounts: BankReconciliation[];
  /** Alle kontoer med transaksjoner er ferdig avstemt. */
  allDone: boolean;
  totalUnmatched: number;
  totalPending: number;
}

export async function reconciliationStatus(
  db: Db,
  params: { organizationId: string },
): Promise<ReconciliationStatus> {
  const counts = await db.query(
    `SELECT ba.id, ba.name,
            COUNT(t.id)::int AS total,
            COUNT(t.id) FILTER (WHERE t.status IN ('matched', 'reconciled'))::int AS matched,
            COUNT(t.id) FILTER (WHERE t.status = 'unmatched')::int AS unmatched,
            COUNT(t.id) FILTER (WHERE t.status = 'ignored')::int AS ignored
     FROM bank_accounts ba
     LEFT JOIN bank_transactions t ON t.bank_account_id = ba.id
     WHERE ba.organization_id = $1 AND ba.status = 'active'
     GROUP BY ba.id, ba.name
     ORDER BY ba.name`,
    [params.organizationId],
  );
  const pendingRows = await db.query(
    `SELECT t.bank_account_id AS id, COUNT(*)::int AS n
     FROM reconciliation_matches m
     JOIN bank_transactions t ON t.id = m.bank_transaction_id
     WHERE m.organization_id = $1 AND m.status = 'suggested'
     GROUP BY t.bank_account_id`,
    [params.organizationId],
  );
  const pendingByAccount = new Map<string, number>(pendingRows.rows.map((r) => [r.id, r.n as number]));

  const accounts: BankReconciliation[] = counts.rows.map((r) => {
    const pending = pendingByAccount.get(r.id) ?? 0;
    return {
      bankAccountId: r.id,
      name: r.name,
      total: r.total,
      matched: r.matched,
      unmatched: r.unmatched,
      ignored: r.ignored,
      pendingSuggestions: pending,
      done: r.total > 0 && r.unmatched === 0 && pending === 0,
    };
  });

  const withTx = accounts.filter((a) => a.total > 0);
  return {
    accounts,
    allDone: withTx.length > 0 && withTx.every((a) => a.done),
    totalUnmatched: accounts.reduce((s, a) => s + a.unmatched, 0),
    totalPending: accounts.reduce((s, a) => s + a.pendingSuggestions, 0),
  };
}
