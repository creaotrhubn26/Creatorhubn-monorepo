/**
 * Skattemessige justeringer (permanente forskjeller) — broen fra REGNSKAPSMESSIG
 * til SKATTEMESSIG resultat. En novise ser overskuddet i regnskapet, men
 * skattbar inntekt er noe annet: enkelte kostnader er bokført, men gir IKKE
 * skattefradrag (representasjon uten fradrag, kostnader «uten skattefradrag»,
 * bøter/gebyrer til det offentlige). De må legges TILBAKE til resultatet før
 * skatten beregnes — ellers betaler man for lite skatt.
 *
 * Vi oppdager disse KONSERVATIVT fra kontoplanen: kontonavn som eksplisitt sier
 * «uten skattefradrag» / «ikke fradragsberettiget», pluss et lite sett kjente
 * NS4102-kontoer. Hver justering vises med konto, beløp og begrunnelse — dette
 * er et FORSLAG til kontroll, aldri en svart boks. Ren lesing; bokfører aldri.
 */
import type { Db } from '../db/pool.js';
import { incomeStatement, type TrialBalanceRow } from '../ledger/reports.js';

export interface TaxAdjustment {
  accountNumber: string;
  accountName: string;
  /** Beløp som legges TILBAKE til resultatet (positivt = øker skattbar inntekt). */
  addBackMinor: bigint;
  reason: string;
}

export interface TaxAdjustments {
  lines: TaxAdjustment[];
  /** Sum tilbakeføringer (permanente forskjeller). */
  totalMinor: bigint;
  notes: string[];
}

/** Kontonavn som utvetydig markerer at kostnaden IKKE gir skattefradrag. */
const NON_DEDUCTIBLE_NAME = /uten skattefradrag|ikke\s*fradragsberettiget|ikke\s*fradragsber\b|ikke\s*skattemessig\s*fradrag/i;

/** Kjente NS4102-kontoer for ikke-fradragsberettigede kostnader (konservativt sett). */
const NON_DEDUCTIBLE_CODES: Record<string, string> = {
  '7360': 'Representasjon, ikke fradragsberettiget',
  '7395': 'Reklame/tilskudd, ikke fradragsberettiget',
  '7420': 'Gaver, ikke fradragsberettiget',
  '7575': 'Bøter og gebyrer (offentlige) — ikke fradragsberettiget',
  '7799': 'Annen kostnad uten skattefradrag',
};

/**
 * Oppdager permanente forskjeller for perioden. Kun EKSPLISITT ikke-fradrags-
 * berettigede kostnadskontoer (etter navn eller kjent kode) tas med — for å
 * unngå falske positiver. Beløpet er kostnadens magnitude (debetsaldo).
 */
export async function computeTaxAdjustments(
  db: Db,
  params: { organizationId: string; fromDate: string; toDate: string },
): Promise<TaxAdjustments> {
  const pnl = await incomeStatement(db, {
    organizationId: params.organizationId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  const lines: TaxAdjustment[] = [];
  for (const row of pnl.byAccount as TrialBalanceRow[]) {
    if (row.accountType !== 'expense') continue;
    const byName = NON_DEDUCTIBLE_NAME.test(row.accountName);
    const byCode = NON_DEDUCTIBLE_CODES[row.accountNumber];
    if (!byName && !byCode) continue;
    // Kostnadens magnitude (debet positiv). Bare positive kostnader legges tilbake.
    const addBack = row.balanceMinor;
    if (addBack <= 0n) continue;
    lines.push({
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      addBackMinor: addBack,
      reason: byCode ?? 'Kostnad uten skattefradrag (fra kontonavn)',
    });
  }
  lines.sort((a, b) => (b.addBackMinor > a.addBackMinor ? 1 : -1));
  const totalMinor = lines.reduce((a, l) => a + l.addBackMinor, 0n);
  const notes: string[] = [];
  if (lines.length) {
    notes.push(
      `${lines.length} kostnad(er) uten skattefradrag er lagt tilbake til resultatet (permanente forskjeller). Kontroller at disse stemmer.`,
    );
  }
  notes.push(
    'Oppdager kun kostnader som er EKSPLISITT merket ikke-fradragsberettiget. Andre justeringer (avskrivningsdifferanser, gevinst/tap-konto, privat bruk utover det som alt er bokført, fremførbart underskudd) må vurderes manuelt.',
  );
  return { lines, totalMinor, notes };
}
