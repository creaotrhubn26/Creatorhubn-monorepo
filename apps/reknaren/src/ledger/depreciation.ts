/**
 * Anleggsmiddelregister + saldoavskrivning (skatteloven §14-41/§14-43).
 *
 * Norske driftsmidler avskrives DEGRESSIVT på saldo, gruppert i saldogrupper a–j
 * med lovbestemte maks-satser. Avskrivning = gruppens avskrivningsgrunnlag × sats.
 * Grunnlaget er inngående saldo + årets anskaffelser − vederlag ved utrangering.
 * Er saldoen under 15 000 kr kan hele restsaldoen avskrives (§14-47).
 *
 * Vi beregner alt DETERMINISTISK fra registeret (år for år fra første anskaffelse)
 * — ingen årlig saldo lagres. Ren lesing for beregning; bokføring av avskrivnings-
 * bilaget skjer via postJournalEntry (idempotent per år).
 */
import type { Actor } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { postJournalEntry } from './engine.js';
import { newId } from '../shared/ids.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { ValidationError } from '../shared/errors.js';

export type SaldoGroup = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';

export const SALDO_GROUPS: Record<SaldoGroup, { name: string; ratePct: number }> = {
  a: { name: 'Kontormaskiner, datautstyr o.l.', ratePct: 30 },
  b: { name: 'Ervervet forretningsverdi (goodwill)', ratePct: 20 },
  c: { name: 'Vogntog, lastebiler, busser, varebiler mv.', ratePct: 24 },
  d: { name: 'Personbiler, maskiner, inventar mv.', ratePct: 20 },
  e: { name: 'Skip, fartøyer, rigger mv.', ratePct: 14 },
  f: { name: 'Fly, helikopter', ratePct: 12 },
  g: { name: 'Anlegg for overføring/distribusjon av elektrisk kraft', ratePct: 5 },
  h: { name: 'Bygg og anlegg, hoteller o.l.', ratePct: 4 },
  i: { name: 'Forretningsbygg', ratePct: 2 },
  j: { name: 'Faste tekniske installasjoner i bygninger', ratePct: 10 },
};

/** Grense for direkte kostnadsføring / full utskriving av restsaldo (§14-40/§14-47). */
export const SMALL_ASSET_LIMIT_MINOR = 1_500_000n; // 15 000 kr

export interface FixedAsset {
  id: string;
  name: string;
  saldoGroup: SaldoGroup;
  acquisitionDate: string;
  costMinor: bigint;
  ledgerAccount: string;
  status: 'active' | 'disposed' | 'expensed';
  disposalDate: string | null;
  disposalProceedsMinor: bigint | null;
  notes: string | null;
}

export interface DepreciationYearRow {
  year: number;
  openingSaldoMinor: bigint;
  acquisitionsMinor: bigint;
  disposalProceedsMinor: bigint;
  basisMinor: bigint; // avskrivningsgrunnlag
  ratePct: number;
  depreciationMinor: bigint;
  closingSaldoMinor: bigint;
  fullWriteOff: boolean; // restsaldo < 15 000 → hele avskrevet
}

export interface DepreciationGroup {
  group: SaldoGroup;
  name: string;
  ratePct: number;
  rows: DepreciationYearRow[];
  /** Avskrivning for det etterspurte året. */
  depreciationThisYearMinor: bigint;
  closingSaldoMinor: bigint;
}

export interface DepreciationResult {
  year: number;
  groups: DepreciationGroup[];
  totalDepreciationThisYearMinor: bigint;
  totalClosingSaldoMinor: bigint;
  smallAssets: { id: string; name: string; costMinor: bigint }[]; // kan kostnadsføres direkte
  notes: string[];
}

function rowToAsset(r: Record<string, unknown>): FixedAsset {
  return {
    id: String(r.id),
    name: String(r.name),
    saldoGroup: r.saldo_group as SaldoGroup,
    acquisitionDate: String(r.acquisition_date).slice(0, 10),
    costMinor: BigInt(r.cost_minor as string),
    ledgerAccount: String(r.ledger_account),
    status: r.status as FixedAsset['status'],
    disposalDate: r.disposal_date ? String(r.disposal_date).slice(0, 10) : null,
    disposalProceedsMinor: r.disposal_proceeds_minor != null ? BigInt(r.disposal_proceeds_minor as string) : null,
    notes: r.notes != null ? String(r.notes) : null,
  };
}

export async function listFixedAssets(db: Db, organizationId: string): Promise<FixedAsset[]> {
  const rows = (await db.query(
    `SELECT id::text, name, saldo_group, acquisition_date::text, cost_minor, ledger_account, status,
            disposal_date::text, disposal_proceeds_minor, notes
     FROM fixed_assets WHERE organization_id=$1 ORDER BY acquisition_date, name`,
    [organizationId],
  )).rows;
  return rows.map(rowToAsset);
}

export async function createFixedAsset(
  db: Db,
  params: { organizationId: string; actor: Actor; name: string; saldoGroup: SaldoGroup; acquisitionDate: string; costMinor: bigint; ledgerAccount?: string; notes?: string },
): Promise<FixedAsset> {
  if (!SALDO_GROUPS[params.saldoGroup]) throw new ValidationError('Ugyldig saldogruppe.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.acquisitionDate)) throw new ValidationError('Ugyldig anskaffelsesdato.');
  if (params.costMinor <= 0n) throw new ValidationError('Kostpris må være positiv.');
  const id = newId();
  // Under grensen → foreslå direkte kostnadsføring (status 'expensed'), men lagre.
  const status = params.costMinor < SMALL_ASSET_LIMIT_MINOR ? 'expensed' : 'active';
  await db.query(
    `INSERT INTO fixed_assets (id, organization_id, name, saldo_group, acquisition_date, cost_minor, ledger_account, status, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, params.organizationId, params.name, params.saldoGroup, params.acquisitionDate, params.costMinor.toString(), params.ledgerAccount ?? '1200', status, params.notes ?? null, params.actor.userId],
  );
  return (await listFixedAssets(db, params.organizationId)).find((a) => a.id === id)!;
}

export async function disposeFixedAsset(
  db: Db,
  params: { organizationId: string; assetId: string; disposalDate: string; proceedsMinor: bigint },
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.disposalDate)) throw new ValidationError('Ugyldig utrangeringsdato.');
  const res = await db.query(
    `UPDATE fixed_assets SET status='disposed', disposal_date=$3, disposal_proceeds_minor=$4
     WHERE id=$1 AND organization_id=$2 AND status<>'disposed'`,
    [params.assetId, params.organizationId, params.disposalDate, params.proceedsMinor.toString()],
  );
  if (!res.rowCount) throw new ValidationError('Fant ikke aktiv eiendel å utrangere.');
}

/** Beregner saldoavskrivning år for år, per saldogruppe, fram til og med `year`. */
export async function computeDepreciation(db: Db, params: { organizationId: string; year: number }): Promise<DepreciationResult> {
  const assets = (await listFixedAssets(db, params.organizationId)).filter((a) => a.status !== 'expensed');
  const smallAssets = (await listFixedAssets(db, params.organizationId))
    .filter((a) => a.status === 'expensed')
    .map((a) => ({ id: a.id, name: a.name, costMinor: a.costMinor }));

  const byGroup = new Map<SaldoGroup, FixedAsset[]>();
  for (const a of assets) {
    const arr = byGroup.get(a.saldoGroup) ?? [];
    arr.push(a);
    byGroup.set(a.saldoGroup, arr);
  }

  const groups: DepreciationGroup[] = [];
  for (const [group, groupAssets] of [...byGroup.entries()].sort()) {
    const ratePct = SALDO_GROUPS[group].ratePct;
    const firstYear = Math.min(...groupAssets.map((a) => Number(a.acquisitionDate.slice(0, 4))));
    const rows: DepreciationYearRow[] = [];
    let saldo = 0n;
    for (let y = firstYear; y <= params.year; y++) {
      const opening = saldo;
      const acquisitions = groupAssets
        .filter((a) => Number(a.acquisitionDate.slice(0, 4)) === y)
        .reduce((s, a) => s + a.costMinor, 0n);
      const disposals = groupAssets
        .filter((a) => a.disposalDate && Number(a.disposalDate.slice(0, 4)) === y)
        .reduce((s, a) => s + (a.disposalProceedsMinor ?? 0n), 0n);
      let basis = opening + acquisitions - disposals;
      if (basis < 0n) basis = 0n; // negativ saldo (gevinst) — forenklet i v1
      let depreciation: bigint;
      let fullWriteOff = false;
      if (basis > 0n && basis < SMALL_ASSET_LIMIT_MINOR) {
        depreciation = basis; // §14-47: restsaldo under 15 000 kan avskrives fullt
        fullWriteOff = true;
      } else {
        depreciation = (basis * BigInt(ratePct) + 50n) / 100n; // avrund til øre
      }
      const closing = basis - depreciation;
      rows.push({ year: y, openingSaldoMinor: opening, acquisitionsMinor: acquisitions, disposalProceedsMinor: disposals, basisMinor: basis, ratePct, depreciationMinor: depreciation, closingSaldoMinor: closing, fullWriteOff });
      saldo = closing;
    }
    const last = rows[rows.length - 1]!;
    groups.push({ group, name: SALDO_GROUPS[group].name, ratePct, rows, depreciationThisYearMinor: last.year === params.year ? last.depreciationMinor : 0n, closingSaldoMinor: last.closingSaldoMinor });
  }

  const totalDep = groups.reduce((s, g) => s + g.depreciationThisYearMinor, 0n);
  const totalSaldo = groups.reduce((s, g) => s + g.closingSaldoMinor, 0n);
  const notes: string[] = [
    'Saldoavskrivning etter skatteloven §14-43 (maks-satser). Degressivt på gruppens samlede saldo.',
  ];
  if (smallAssets.length) notes.push(`${smallAssets.length} eiendel(er) er under 15 000 kr og kan kostnadsføres direkte (ikke aktivert).`);
  return { year: params.year, groups, totalDepreciationThisYearMinor: totalDep, totalClosingSaldoMinor: totalSaldo, smallAssets, notes };
}

/**
 * Bokfører årets avskrivning som ETT bilag: debet 6000 (avskrivning), kredit 1290
 * (akkumulerte avskrivninger). Idempotent per år. Kontoene sikres ved behov.
 */
export async function bookDepreciation(db: Db, params: { organizationId: string; actor: Actor; year: number }): Promise<{ entryNumber: number; amountMinor: bigint } | { skipped: 'zero' }> {
  const result = await computeDepreciation(db, { organizationId: params.organizationId, year: params.year });
  const amount = result.totalDepreciationThisYearMinor;
  if (amount <= 0n) return { skipped: 'zero' };
  for (const [num, name, type] of [['6000', 'Avskrivning på varige driftsmidler', 'expense'], ['1290', 'Akkumulerte avskrivninger', 'asset']] as const) {
    await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id, account_number) DO NOTHING`,
      [newId(), params.organizationId, num, name, type],
    );
  }
  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: params.actor,
    entryDate: `${params.year}-12-31`,
    description: `Avskrivning ${params.year} (saldoavskrivning, ${formatMinorAsKr(amount)} kr)`,
    idempotencyKey: `depreciation:${params.year}`,
    lines: [
      { accountNumber: '6000', debitMinor: amount },
      { accountNumber: '1290', creditMinor: amount },
    ],
  });
  return { entryNumber: entry.entryNumber, amountMinor: amount };
}
