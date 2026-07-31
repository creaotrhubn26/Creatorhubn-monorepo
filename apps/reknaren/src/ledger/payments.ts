/**
 * Utbetalingsfil for leverandørfakturaer (ISO 20022 pain.001.001.03).
 *
 * En novise slipper å taste inn kontonummer, beløp og KID manuelt i nettbanken:
 * vi bygger en betalingsfil fra de leste leverandørfakturaene (bankkonto + KID +
 * beløp er alt trukket ut ved bilagslesing), som lastes opp i nettbanken.
 *
 * 🔒 Vi FLYTTER ingen penger — vi lager kun fila. Betaling bekreftes i nettbanken.
 * Beløp holdes som bigint øre til XML-formatering (aldri flyttall i beregning).
 */
import type { Actor } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { newId } from '../shared/ids.js';
import { ValidationError } from '../shared/errors.js';

export interface PayableInvoice {
  documentId: string;
  vendorName: string | null;
  bankAccount: string | null;
  kid: string | null;
  invoiceNumber: string | null;
  amountMinor: bigint;
  currency: string;
  invoiceDate: string | null;
  dueDate: string | null;
  payable: boolean; // har konto + beløp
}

/** Leverandørfakturaer som kan betales (lest, ikke alt eksportert). */
export async function listPayableInvoices(db: Db, organizationId: string): Promise<PayableInvoice[]> {
  const rows = (await db.query(
    `SELECT DISTINCT ON (d.id) d.id::text AS document_id, e.vendor_name, e.bank_account, e.kid, e.invoice_number,
            e.gross_minor, COALESCE(e.currency,'NOK') AS currency, e.invoice_date::text, e.due_date::text
     FROM source_documents d
     JOIN extracted_document_data e ON e.document_id = d.id
     WHERE d.organization_id = $1
       AND d.status IN ('extracted','needs_review','approved','posted')
       AND e.gross_minor IS NOT NULL AND e.gross_minor > 0
       AND (e.document_type IS NULL OR e.document_type NOT IN ('credit_note','payment_confirmation'))
       AND NOT EXISTS (SELECT 1 FROM payment_exports p WHERE p.document_id = d.id)
     ORDER BY d.id, e.extraction_version DESC`,
    [organizationId],
  )).rows;
  const list = rows.map((r) => ({
    documentId: r.document_id,
    vendorName: r.vendor_name,
    bankAccount: r.bank_account ? String(r.bank_account).replace(/\s/g, '') : null,
    kid: r.kid,
    invoiceNumber: r.invoice_number,
    amountMinor: BigInt(r.gross_minor),
    currency: r.currency,
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    payable: Boolean(r.bank_account),
  }));
  // Sortér til visning: forfallsdato først (tomme sist), så leverandør.
  list.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (a.vendorName ?? '').localeCompare(b.vendorName ?? ''));
  return list;
}

/** Øre → desimalkroner «1234.00» (eksakt, uten flyttall). */
function minorToDecimal(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  return `${neg ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}
function xmlEsc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string);
}

export interface PaymentFileInput {
  debtorName: string;
  debtorOrgNumber: string | null;
  debtorAccount: string;
  msgId: string;
  creationDateTime: string; // ISO
  requestedExecutionDate: string; // YYYY-MM-DD
  payments: { endToEndId: string; creditorName: string; creditorAccount: string; amountMinor: bigint; currency: string; kid: string | null; message: string | null }[];
}

/** Bygger pain.001.001.03-XML (Customer Credit Transfer Initiation). */
export function buildPaymentFile(input: PaymentFileInput): string {
  if (input.payments.length === 0) throw new ValidationError('Ingen betalinger å eksportere.');
  const NS = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03';
  const total = input.payments.reduce((s, p) => s + p.amountMinor, 0n);
  const nb = input.payments.length;
  const acct = (id: string) => `<Id><Othr><Id>${xmlEsc(id)}</Id></Othr></Id>`;
  const tx = input.payments
    .map((p) => {
      const rmt = p.kid
        ? `<Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry></Tp><Ref>${xmlEsc(p.kid)}</Ref></CdtrRefInf></Strd>`
        : `<Ustrd>${xmlEsc((p.message ?? 'Betaling').slice(0, 140))}</Ustrd>`;
      return (
        `      <CdtTrfTxInf>` +
        `<PmtId><EndToEndId>${xmlEsc(p.endToEndId)}</EndToEndId></PmtId>` +
        `<Amt><InstdAmt Ccy="${xmlEsc(p.currency)}">${minorToDecimal(p.amountMinor)}</InstdAmt></Amt>` +
        `<CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>` +
        `<Cdtr><Nm>${xmlEsc((p.creditorName ?? 'Leverandør').slice(0, 140))}</Nm></Cdtr>` +
        `<CdtrAcct>${acct(p.creditorAccount)}</CdtrAcct>` +
        `<RmtInf>${rmt}</RmtInf>` +
        `</CdtTrfTxInf>`
      );
    })
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Document xmlns="${NS}">\n` +
    `  <CstmrCdtTrfInitn>\n` +
    `    <GrpHdr><MsgId>${xmlEsc(input.msgId)}</MsgId><CreDtTm>${input.creationDateTime}</CreDtTm>` +
    `<NbOfTxs>${nb}</NbOfTxs><CtrlSum>${minorToDecimal(total)}</CtrlSum>` +
    `<InitgPty><Nm>${xmlEsc(input.debtorName)}</Nm>${input.debtorOrgNumber ? `<Id><OrgId><Othr><Id>${xmlEsc(input.debtorOrgNumber)}</Id></Othr></OrgId></Id>` : ''}</InitgPty></GrpHdr>\n` +
    `    <PmtInf><PmtInfId>${xmlEsc(input.msgId)}-1</PmtInfId><PmtMtd>TRF</PmtMtd>` +
    `<NbOfTxs>${nb}</NbOfTxs><CtrlSum>${minorToDecimal(total)}</CtrlSum>` +
    `<ReqdExctnDt>${input.requestedExecutionDate}</ReqdExctnDt>` +
    `<Dbtr><Nm>${xmlEsc(input.debtorName)}</Nm></Dbtr>` +
    `<DbtrAcct>${acct(input.debtorAccount)}</DbtrAcct>` +
    `<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>` +
    `<ChrgBr>SLEV</ChrgBr>\n${tx}\n    </PmtInf>\n` +
    `  </CstmrCdtTrfInitn>\n</Document>`
  );
}

/** Registrerer at dokumentene er tatt med i en betalingsfil (idempotent per doc). */
export async function recordPaymentExports(
  db: Db,
  params: { organizationId: string; actor: Actor; messageRef: string; items: { documentId: string; amountMinor: bigint; creditorAccount: string | null }[] },
): Promise<void> {
  for (const it of params.items) {
    await db.query(
      `INSERT INTO payment_exports (id, organization_id, document_id, amount_minor, creditor_account, message_ref, exported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (organization_id, document_id) DO NOTHING`,
      [newId(), params.organizationId, it.documentId, it.amountMinor.toString(), it.creditorAccount, params.messageRef, params.actor.userId],
    );
  }
}
