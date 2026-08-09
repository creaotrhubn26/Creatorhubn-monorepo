/**
 * Org-eksponering: rentebærende gjeld, valutaeksponering og NACE-bransjekode.
 * Grunnlag for markedsinnsikt-regler (fx_timing/fx_retro m.fl.).
 */
import type { Db } from '../db/pool.js';
import type { CompanyRegistry } from '../integrations/company-registry.js';

export interface OrgExposure {
  interestBearingDebtMinor: bigint;
  fxCurrencies: string[];
  /** Median månedlig NOK-innkjøp per utenlandsk valuta (fx_timing). */
  fxSpend: { currency: string; medianMonthlyMinor: bigint }[];
  /** Faktiske utenlandskjøp siste 90 dager per valuta (fx_retro). */
  fxPurchases: { currency: string; purchaseCount: number; totalForeignMinor: bigint; actualNokMinor: bigint }[];
  naceCode: string | null;
}

export async function getOrgExposure(
  db: Db,
  registry: CompanyRegistry,
  organizationId: string,
): Promise<OrgExposure> {
  // Rentebærende gjeld: kontoklasse 2200–2499, kredittsaldo.
  const debt = await db.query(
    `SELECT COALESCE(SUM(l.credit_minor - l.debit_minor), 0)::TEXT AS net
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
      WHERE l.organization_id = $1
        AND l.account_number ~ '^[0-9]{4}$'
        AND l.account_number::int BETWEEN 2200 AND 2499`,
    [organizationId],
  );
  const interestBearingDebtMinor = BigInt(debt.rows[0]?.net ?? '0');

  // Valutaeksponering — distinkte utenlandske valutaer i bokførte linjer.
  const fx = await db.query(
    `SELECT DISTINCT l.original_currency AS cur
       FROM journal_lines l
      WHERE l.organization_id = $1 AND l.original_currency IS NOT NULL AND l.original_currency <> 'NOK'`,
    [organizationId],
  );
  const fxCurrencies = fx.rows.map((r: { cur: string }) => r.cur).filter(Boolean);

  // FX-innkjøpsvolum: median månedlig NOK-innkjøp (debet-linjer) per utenlandsk valuta.
  const spend = await db.query(
    `SELECT currency, percentile_cont(0.5) WITHIN GROUP (ORDER BY monthly)::bigint::text AS median
       FROM (
         SELECT l.original_currency AS currency,
                date_trunc('month', e.entry_date) AS m,
                SUM(l.debit_minor) AS monthly
           FROM journal_lines l
           JOIN journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
          WHERE l.organization_id = $1
            AND l.original_currency IS NOT NULL AND l.original_currency <> 'NOK'
            AND l.debit_minor > 0
          GROUP BY currency, m
       ) t
      GROUP BY currency`,
    [organizationId],
  );
  const fxSpend = spend.rows.map((r: { currency: string; median: string }) => ({
    currency: r.currency,
    medianMonthlyMinor: BigInt(r.median ?? '0'),
  }));

  // Faktiske utenlandskjøp siste 90 dager per valuta (fx_retro): antall, sum utenlandsk-beløp, sum bokført NOK.
  const purch = await db.query(
    `SELECT l.original_currency AS currency,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(l.original_amount_minor), 0)::text AS foreign_sum,
            COALESCE(SUM(l.debit_minor), 0)::text AS nok_sum
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
      WHERE l.organization_id = $1
        AND l.original_currency IS NOT NULL AND l.original_currency <> 'NOK'
        AND l.debit_minor > 0 AND l.original_amount_minor IS NOT NULL AND l.original_amount_minor > 0
        AND e.entry_date >= (CURRENT_DATE - INTERVAL '90 days')
      GROUP BY l.original_currency`,
    [organizationId],
  );
  const fxPurchases = purch.rows.map(
    (r: { currency: string; cnt: number; foreign_sum: string; nok_sum: string }) => ({
      currency: r.currency,
      purchaseCount: r.cnt,
      totalForeignMinor: BigInt(r.foreign_sum ?? '0'),
      actualNokMinor: BigInt(r.nok_sum ?? '0'),
    }),
  );

  // NACE fra Brreg via org.nr.
  const orgRow = await db.query(`SELECT org_number FROM organizations WHERE id = $1`, [organizationId]);
  const orgNumber = orgRow.rows[0]?.org_number as string | undefined;
  let naceCode: string | null = null;
  if (orgNumber && /^\d{9}$/.test(orgNumber)) {
    try {
      naceCode = (await registry.lookup(orgNumber)).naceCode ?? null;
    } catch {
      naceCode = null;
    }
  }
  return { interestBearingDebtMinor, fxCurrencies, fxSpend, fxPurchases, naceCode };
}
