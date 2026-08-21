/**
 * Registrer et enkelt kjøp (kostnad) for ENK uten MVA: bokfør på kostnadskonto,
 * betalt privat eller fra bank. Fradragsberettigede kostnader reduserer skatten
 * automatisk (via resultatet); ikke-fradragsberettigede legges tilbake i
 * skatteanslaget. Returnerer fradragsstatus + hvor mye mindre skatt å sette av.
 *
 * Delt privat/næringsbruk: kun næringsandelen (businessSharePct) bokføres som
 * kostnad — privatandelen er ikke en næringstransaksjon og skal ikke gi fradrag.
 * Valgfri kvittering lagres som kildebilag (source_document) for ettersyn.
 */
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { registerDocument } from '../documents/service.js';
import { postJournalEntry } from '../ledger/engine.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { newId } from '../shared/ids.js';
import type { ObjectStorage } from '../storage/port.js';
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
  /** Beløp bokført som næringskostnad (amount × businessSharePct). */
  businessAmountMinor: bigint;
  /** Privatandel som IKKE er bokført som kostnad. */
  privateAmountMinor: bigint;
  /** Hvor mye MINDRE skatt å sette av (næringsandel × marginalsats). 0 hvis ikke fradrag. */
  taxReductionMinor: bigint;
  /** Kvitterings-id hvis vedlegg ble lagret. */
  receiptDocumentId?: string;
}

export async function registerPurchase(
  db: Db,
  rules: RuleRegister,
  params: {
    organizationId: string; orgForm: OrganizationForm; actor: Actor;
    amountMinor: bigint; description: string; accountNumber: string;
    paidPrivately: boolean; date: string;
    /** Andel næringsbruk 1–100 (default 100). Resten er privat og gir ikke fradrag. */
    businessSharePct?: number;
    /** Valgfri kvittering (base64) — lagres som kildebilag. */
    receipt?: { filename: string; mimeType: string; base64: string };
  },
  storage?: ObjectStorage,
): Promise<PurchaseResult> {
  const acc = getAccountDef(params.accountNumber);
  if (!acc) throw new Error(`Ukjent konto: ${params.accountNumber}`);

  const share = Math.min(100, Math.max(1, Math.round(params.businessSharePct ?? 100)));
  const businessAmount = (params.amountMinor * BigInt(share)) / 100n;
  const privateAmount = params.amountMinor - businessAmount;

  // Bokfør kun næringsandelen som kostnad. Privatandelen:
  //  - betalt privat: ikke en næringstransaksjon → ignoreres helt.
  //  - betalt fra bank: privat uttak (2060) så hovedboken balanserer mot 1920.
  const lines = params.paidPrivately
    ? [
        { accountNumber: params.accountNumber, debitMinor: businessAmount },
        { accountNumber: '2060', creditMinor: businessAmount },
      ]
    : [
        { accountNumber: params.accountNumber, debitMinor: businessAmount },
        ...(privateAmount > 0n ? [{ accountNumber: '2060', debitMinor: privateAmount }] : []),
        { accountNumber: '1920', creditMinor: params.amountMinor },
      ];
  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: { userId: params.actor.userId, role: params.actor.role },
    entryDate: params.date,
    description: params.description,
    lines,
    idempotencyKey: `purchase-${newId()}`,
  });

  const deductible = acc.taxDeductible ?? 'depends';
  let taxReduction = 0n;
  if (deductible === 'yes') {
    // Fradraget reduserer resultatet på toppen → marginalsats, ikke snitt.
    const ov = await taxReserveOverview(db, rules, { organizationId: params.organizationId, orgForm: params.orgForm, asOf: params.date });
    const rate = ov.marginalRatePer1000 > 0 ? ov.marginalRatePer1000 : 400;
    taxReduction = (businessAmount * BigInt(Math.round(rate))) / 1000n;
  }

  let receiptDocumentId: string | undefined;
  if (params.receipt && storage) {
    const doc = await registerDocument(db, {
      organizationId: params.organizationId,
      actor: { userId: params.actor.userId, role: params.actor.role },
      source: 'upload',
      filename: params.receipt.filename,
      mimeType: params.receipt.mimeType,
      content: Buffer.from(params.receipt.base64, 'base64'),
    }, storage);
    receiptDocumentId = doc.id;
  }

  return {
    entryId: entry.id,
    accountNumber: acc.number,
    accountName: acc.name,
    taxDeductible: deductible,
    businessAmountMinor: businessAmount,
    privateAmountMinor: privateAmount,
    taxReductionMinor: taxReduction,
    ...(receiptDocumentId ? { receiptDocumentId } : {}),
  };
}
