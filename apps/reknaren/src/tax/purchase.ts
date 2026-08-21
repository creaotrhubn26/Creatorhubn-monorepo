/**
 * Registrer et enkelt kjøp (kostnad) for ENK uten MVA: bokfør på kostnadskonto,
 * betalt privat eller fra bank. Fradragsberettigede kostnader reduserer skatten
 * automatisk (via resultatet); ikke-fradragsberettigede legges tilbake i
 * skatteanslaget. Returnerer fradragsstatus + hvor mye mindre skatt å sette av.
 */
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { postJournalEntry } from '../ledger/engine.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { newId } from '../shared/ids.js';
import { taxReserveOverview } from './reserve.js';

interface Actor { userId: string; role: string }

/** Vanlige kjøpskategorier for ENK (konto + fradragsstatus fra kontoplanen). */
export function commonPurchaseCategories(): { accountNumber: string; name: string; taxDeductible: string }[] {
  const nums = ['6551', '6553', '6540', '6300', '6900', '7140', '7350', '6800'];
  return nums.flatMap((n) => {
    const a = getAccountDef(n);
    return a ? [{ accountNumber: a.number, name: a.name, taxDeductible: a.taxDeductible ?? 'depends' }] : [];
  });
}

export interface PurchaseResult {
  entryId: string;
  accountNumber: string;
  accountName: string;
  taxDeductible: string;        // yes | no | depends
  /** Hvor mye MINDRE skatt å sette av (fradragsberettiget × effektiv sats). 0 hvis ikke fradrag. */
  taxReductionMinor: bigint;
}

export async function registerPurchase(
  db: Db,
  rules: RuleRegister,
  params: {
    organizationId: string; orgForm: OrganizationForm; actor: Actor;
    amountMinor: bigint; description: string; accountNumber: string;
    paidPrivately: boolean; date: string;
  },
): Promise<PurchaseResult> {
  const acc = getAccountDef(params.accountNumber);
  if (!acc) throw new Error(`Ukjent konto: ${params.accountNumber}`);
  const creditAccount = params.paidPrivately ? '2061' : '1920'; // privat overføring / bank
  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: { userId: params.actor.userId, role: params.actor.role },
    entryDate: params.date,
    description: params.description,
    lines: [
      { accountNumber: params.accountNumber, debitMinor: params.amountMinor },
      { accountNumber: creditAccount, creditMinor: params.amountMinor },
    ],
    idempotencyKey: `purchase-${newId()}`,
  });
  const deductible = acc.taxDeductible ?? 'depends';
  let taxReduction = 0n;
  if (deductible === 'yes') {
    const ov = await taxReserveOverview(db, rules, { organizationId: params.organizationId, orgForm: params.orgForm, asOf: params.date });
    const rate = ov.effectiveRatePer1000 > 0 ? ov.effectiveRatePer1000 : 350;
    taxReduction = (params.amountMinor * BigInt(Math.round(rate))) / 1000n;
  }
  return {
    entryId: entry.id,
    accountNumber: acc.number,
    accountName: acc.name,
    taxDeductible: deductible,
    taxReductionMinor: taxReduction,
  };
}
