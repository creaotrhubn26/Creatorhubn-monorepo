/**
 * Fakturamodulen (utgående). Regler:
 *  - Nummerserien er kontrollert og uten hull: nummer tildeles først ved
 *    utstedelse, under radlås på tellerraden.
 *  - Utstedte fakturaer er uforanderlige (DB-trigger); feil rettes med kreditnota.
 *  - Utstedelse bokfører automatisk: debet 1500 (kundereskontro) brutto,
 *    kredit inntektskonto netto per linje, kredit 2700 utgående mva.
 *  - All mva beregnes deterministisk fra regelregisteret per fakturadato.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { getVatCode } from '../coa/vat-codes.js';
import { getAccountDef } from '../coa/accounts.js';
import type { Db, DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { postJournalEntry } from '../ledger/engine.js';
import type { RuleRegister } from '../rules/register.js';
import { assertDimensionExists } from '../dimensions/service.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';
import { multiplyRational, money } from '../shared/money.js';
import { vatOfNet } from '../vat/engine.js';

/** MOD10 (Luhn) kontrollsiffer for KID. */
export function generateKid(organizationSeq: string, invoiceNumber: bigint): string {
  const base = `${organizationSeq}${invoiceNumber.toString().padStart(7, '0')}`;
  let sum = 0;
  let double = true; // start fra høyre
  for (let i = base.length - 1; i >= 0; i--) {
    let digit = Number(base[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  const control = (10 - (sum % 10)) % 10;
  return `${base}${control}`;
}

export function isValidKid(kid: string): boolean {
  if (!/^\d{3,25}$/.test(kid)) return false;
  return generateKid(kid.slice(0, -8), BigInt(kid.slice(-8, -1))) === kid;
}

export interface InvoiceLineInput {
  description: string;
  /** Antall i tusendeler (2,5 stk = 2500) for eksakt aritmetikk. */
  quantityThousandths: bigint;
  /** Enhetspris i øre, eks. mva. */
  unitPriceMinor: bigint;
  vatCode: string;
  revenueAccount?: string;
  productId?: string;
  /** Prosjektkode — valideres mot dimensjonsregisteret. */
  project?: string;
}

export interface CreateInvoiceInput {
  organizationId: string;
  actor: Actor;
  customerId: string;
  lines: InvoiceLineInput[];
  invoiceDate?: string;
  dueDate?: string;
}

interface ComputedLine {
  description: string;
  quantityThousandths: bigint;
  unitPriceMinor: bigint;
  vatCode: string;
  revenueAccount: string;
  productId: string | null;
  project: string | null;
  netMinor: bigint;
  vatMinor: bigint;
}

function computeLines(
  rules: RuleRegister,
  lines: InvoiceLineInput[],
  isoDate: string,
): { computed: ComputedLine[]; netMinor: bigint; vatMinor: bigint; grossMinor: bigint } {
  if (lines.length === 0) throw new ValidationError('Fakturaen må ha minst én linje.');
  const computed: ComputedLine[] = [];
  let net = 0n;
  let vat = 0n;
  for (const [i, line] of lines.entries()) {
    const code = getVatCode(line.vatCode);
    if (!code || code.direction !== 'output') {
      throw new ValidationError(
        `Linje ${i + 1}: mva-koden ${line.vatCode} er ikke en utgående kode.`,
      );
    }
    const account = line.revenueAccount ?? '3000';
    const accountDef = getAccountDef(account);
    if (!accountDef || accountDef.type !== 'revenue') {
      throw new ValidationError(`Linje ${i + 1}: ${account} er ikke en inntektskonto.`);
    }
    if (!line.description.trim()) {
      throw new ValidationError(`Linje ${i + 1}: beskrivelse er påkrevd.`);
    }
    // netto = enhetspris × antall/1000, avrundet half-up på øret.
    const lineNet = multiplyRational(
      money(line.unitPriceMinor, 'NOK'),
      line.quantityThousandths,
      1000n,
    ).minorUnits;
    const lineVat = vatOfNet(rules, line.vatCode, lineNet, isoDate).vatMinor;
    computed.push({
      description: line.description,
      quantityThousandths: line.quantityThousandths,
      unitPriceMinor: line.unitPriceMinor,
      vatCode: line.vatCode,
      revenueAccount: account,
      productId: line.productId ?? null,
      project: line.project ? line.project.toUpperCase() : null,
      netMinor: lineNet,
      vatMinor: lineVat,
    });
    net += lineNet;
    vat += lineVat;
  }
  return { computed, netMinor: net, vatMinor: vat, grossMinor: net + vat };
}

async function insertInvoice(
  client: DbClient,
  params: {
    organizationId: string;
    actor: Actor;
    customerId: string;
    kind: 'invoice' | 'credit_note';
    creditsInvoiceId?: string;
    invoiceDate?: string;
    dueDate?: string;
    computed: ReturnType<typeof computeLines>;
  },
): Promise<string> {
  const customer = await client.query(
    `SELECT id FROM customers WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [params.customerId, params.organizationId],
  );
  if (!customer.rowCount) throw new NotFoundError('Kunden finnes ikke.');
  const id = newId();
  await client.query(
    `INSERT INTO invoices
       (id, organization_id, customer_id, kind, credits_invoice_id, invoice_date, due_date,
        net_minor, vat_minor, gross_minor, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      params.organizationId,
      params.customerId,
      params.kind,
      params.creditsInvoiceId ?? null,
      params.invoiceDate ?? null,
      params.dueDate ?? null,
      params.computed.netMinor.toString(),
      params.computed.vatMinor.toString(),
      params.computed.grossMinor.toString(),
      params.actor.userId,
    ],
  );
  for (const [i, line] of params.computed.computed.entries()) {
    await client.query(
      `INSERT INTO invoice_lines
         (id, invoice_id, organization_id, line_number, product_id, description,
          quantity_thousandths, unit_price_minor, vat_code, revenue_account, net_minor, vat_minor, project)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        newId(),
        id,
        params.organizationId,
        i + 1,
        line.productId,
        line.description,
        line.quantityThousandths.toString(),
        line.unitPriceMinor.toString(),
        line.vatCode,
        line.revenueAccount,
        line.netMinor.toString(),
        line.vatMinor.toString(),
        line.project,
      ],
    );
  }
  return id;
}

/** Oppretter fakturakladd. Ingen bokføring, intet nummer — det skjer ved utstedelse. */
export async function createInvoiceDraft(
  db: Db,
  rules: RuleRegister,
  input: CreateInvoiceInput,
): Promise<{ id: string; netMinor: bigint; vatMinor: bigint; grossMinor: bigint }> {
  const isoDate = input.invoiceDate ?? new Date().toISOString().slice(0, 10);
  const computed = computeLines(rules, input.lines, isoDate);
  for (const line of computed.computed) {
    if (line.project) {
      await assertDimensionExists(db, input.organizationId, 'project', line.project);
    }
  }
  return withTransaction(db, async (client) => {
    const insertParams: Parameters<typeof insertInvoice>[1] = {
      organizationId: input.organizationId,
      actor: input.actor,
      customerId: input.customerId,
      kind: 'invoice',
      computed,
    };
    if (input.invoiceDate !== undefined) insertParams.invoiceDate = input.invoiceDate;
    if (input.dueDate !== undefined) insertParams.dueDate = input.dueDate;
    const id = await insertInvoice(client, insertParams);
    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'invoice.draft_created',
      entityType: 'invoice',
      entityId: id,
      newValue: { grossMinor: computed.grossMinor.toString(), lineCount: input.lines.length },
    });
    return { id, ...computed };
  });
}

/**
 * Utsteder fakturaen: tildeler neste nummer i serien (uten hull), genererer KID,
 * bokfører og låser innholdet. Idempotent: gjentatte kall (også etter delvis
 * feil mellom utstedelse og bokføring) konvergerer til én utstedt, bokført faktura.
 */
export async function issueInvoice(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; actor: Actor; invoiceId: string; invoiceDate?: string },
): Promise<{ invoiceNumber: bigint; kid: string; journalEntryId: string }> {
  void rules; // mva ble beregnet ved kladd; satsene er låst til fakturadato via linjene

  // Fase 1 (transaksjon): tildel nummer/KID og lås fakturaen.
  const issued = await withTransaction(db, async (client) => {
    const inv = await client.query(
      `SELECT i.*, c.name AS customer_name FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1 AND i.organization_id = $2 FOR UPDATE OF i`,
      [params.invoiceId, params.organizationId],
    );
    if (!inv.rowCount) throw new NotFoundError('Fakturaen finnes ikke.');
    const invoice = inv.rows[0];
    if (invoice.kind === 'credit_note') {
      throw new ValidationError('Kreditnotaer utstedes via createCreditNote-flyten.');
    }
    if (!['draft', 'issued', 'paid'].includes(invoice.status)) {
      throw new ConflictError(`Fakturaen kan ikke utstedes fra status «${invoice.status}».`);
    }

    let invoiceNumber: bigint;
    let kid: string;
    let invoiceDate: string;
    if (invoice.status === 'draft') {
      invoiceDate =
        params.invoiceDate ??
        (invoice.invoice_date
          ? String(
              invoice.invoice_date instanceof Date
                ? invoice.invoice_date.toISOString().slice(0, 10)
                : invoice.invoice_date,
            )
          : new Date().toISOString().slice(0, 10));
      const counter = await client.query(
        `UPDATE organization_counters SET next_invoice_number = next_invoice_number + 1
         WHERE organization_id = $1
         RETURNING next_invoice_number - 1 AS invoice_number`,
        [params.organizationId],
      );
      if (!counter.rowCount) throw new NotFoundError('Organisasjonen mangler fakturateller.');
      invoiceNumber = BigInt(counter.rows[0].invoice_number);
      kid = generateKid('42', invoiceNumber);
      await client.query(
        `UPDATE invoices SET invoice_number = $3, kid = $4, invoice_date = $5, status = 'issued',
                updated_at = now(), version = version + 1
         WHERE id = $1 AND organization_id = $2`,
        [params.invoiceId, params.organizationId, invoiceNumber.toString(), kid, invoiceDate],
      );
      await recordAuditEvent(client, {
        organizationId: params.organizationId,
        actor: params.actor,
        action: 'invoice.issued',
        entityType: 'invoice',
        entityId: params.invoiceId,
        newValue: { invoiceNumber: invoiceNumber.toString(), kid, invoiceDate },
      });
    } else {
      // Allerede utstedt (idempotent gjenopptak): bruk eksisterende verdier.
      invoiceNumber = BigInt(invoice.invoice_number);
      kid = invoice.kid;
      invoiceDate = String(
        invoice.invoice_date instanceof Date
          ? invoice.invoice_date.toISOString().slice(0, 10)
          : invoice.invoice_date,
      );
    }

    const lines = await client.query(
      `SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
      [params.invoiceId],
    );
    return {
      invoiceNumber,
      kid,
      invoiceDate,
      customerName: invoice.customer_name as string,
      customerId: invoice.customer_id as string,
      grossMinor: BigInt(invoice.gross_minor),
      existingJournalEntryId: invoice.journal_entry_id as string | null,
      lineRows: lines.rows,
    };
  });

  if (issued.existingJournalEntryId) {
    return {
      invoiceNumber: issued.invoiceNumber,
      kid: issued.kid,
      journalEntryId: issued.existingJournalEntryId,
    };
  }

  // Fase 2: bokfør (idempotensnøkkelen sikrer nøyaktig én postering selv ved
  // gjenopptak/kappløp), og lagre koblingen faktura -> bilag.
  const revenueByKey = new Map<
    string,
    { account: string; vatCode: string; project: string | null; netMinor: bigint }
  >();
  const vatByCode = new Map<string, bigint>();
  for (const line of issued.lineRows) {
    const key = `${line.revenue_account}:${line.vat_code}:${line.project ?? ''}`;
    const agg =
      revenueByKey.get(key) ??
      { account: line.revenue_account, vatCode: line.vat_code, project: line.project ?? null, netMinor: 0n };
    agg.netMinor += BigInt(line.net_minor);
    revenueByKey.set(key, agg);
    vatByCode.set(line.vat_code, (vatByCode.get(line.vat_code) ?? 0n) + BigInt(line.vat_minor));
  }
  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: params.actor,
    entryDate: issued.invoiceDate,
    description: `Faktura ${issued.invoiceNumber} — ${issued.customerName}`,
    lines: [
      {
        accountNumber: '1500',
        debitMinor: issued.grossMinor,
        customerId: issued.customerId,
        description: `Faktura ${issued.invoiceNumber}`,
      },
      ...[...revenueByKey.values()].map((r) => ({
        accountNumber: r.account,
        creditMinor: r.netMinor,
        vatCode: r.vatCode,
        ...(r.project ? { project: r.project } : {}),
      })),
      ...[...vatByCode.entries()]
        .filter(([, amount]) => amount > 0n)
        .map(([code, amount]) => ({
          accountNumber: '2700',
          creditMinor: amount,
          vatCode: code,
          description: 'Utgående mva',
        })),
    ],
    idempotencyKey: `invoice:${params.invoiceId}`,
  });
  await withTransaction(db, async (client) => {
    await client.query(
      `UPDATE invoices SET journal_entry_id = $3, updated_at = now(), version = version + 1
       WHERE id = $1 AND organization_id = $2 AND journal_entry_id IS NULL`,
      [params.invoiceId, params.organizationId, entry.id],
    );
  });
  return { invoiceNumber: issued.invoiceNumber, kid: issued.kid, journalEntryId: entry.id };
}

/**
 * Kreditnota: speiler en utstedt faktura, bokfører motsatt og merker originalen
 * som kreditert. Historikken beholdes komplett.
 */
export async function createCreditNote(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; actor: Actor; invoiceId: string; reason: string },
): Promise<{ creditNoteId: string; creditNoteNumber: bigint; journalEntryId: string }> {
  void rules;
  if (!params.reason.trim()) throw new ValidationError('Kreditnota krever begrunnelse.');
  const prepared = await withTransaction(db, async (client) => {
    const inv = await client.query(
      `SELECT i.*, c.name AS customer_name FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1 AND i.organization_id = $2 FOR UPDATE OF i`,
      [params.invoiceId, params.organizationId],
    );
    if (!inv.rowCount) throw new NotFoundError('Fakturaen finnes ikke.');
    const invoice = inv.rows[0];
    if (!['issued', 'paid'].includes(invoice.status)) {
      throw new ValidationError(`Kun utstedte fakturaer kan krediteres (status: ${invoice.status}).`);
    }
    const existing = await client.query(
      `SELECT id FROM invoices WHERE organization_id = $1 AND credits_invoice_id = $2`,
      [params.organizationId, params.invoiceId],
    );
    if (existing.rowCount) throw new ConflictError('Fakturaen er allerede kreditert.');

    const lines = await client.query(
      `SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
      [params.invoiceId],
    );
    const counter = await client.query(
      `UPDATE organization_counters SET next_invoice_number = next_invoice_number + 1
       WHERE organization_id = $1
       RETURNING next_invoice_number - 1 AS invoice_number`,
      [params.organizationId],
    );
    const creditNumber = BigInt(counter.rows[0].invoice_number);
    const today = new Date().toISOString().slice(0, 10);

    const creditId = newId();
    await client.query(
      `INSERT INTO invoices
         (id, organization_id, customer_id, invoice_number, kind, credits_invoice_id,
          invoice_date, net_minor, vat_minor, gross_minor, status, created_by)
       VALUES ($1,$2,$3,$4,'credit_note',$5,$6,$7,$8,$9,'issued',$10)`,
      [
        creditId,
        params.organizationId,
        invoice.customer_id,
        creditNumber.toString(),
        params.invoiceId,
        today,
        invoice.net_minor,
        invoice.vat_minor,
        invoice.gross_minor,
        params.actor.userId,
      ],
    );
    for (const line of lines.rows) {
      await client.query(
        `INSERT INTO invoice_lines
           (id, invoice_id, organization_id, line_number, product_id, description,
            quantity_thousandths, unit_price_minor, vat_code, revenue_account, net_minor, vat_minor, project)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          newId(),
          creditId,
          params.organizationId,
          line.line_number,
          line.product_id,
          `Kreditering: ${line.description}`,
          line.quantity_thousandths,
          line.unit_price_minor,
          line.vat_code,
          line.revenue_account,
          line.net_minor,
          line.vat_minor,
          line.project,
        ],
      );
    }
    await client.query(
      `UPDATE invoices SET status = 'credited', updated_at = now(), version = version + 1
       WHERE id = $1`,
      [params.invoiceId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'invoice.credited',
      entityType: 'invoice',
      entityId: params.invoiceId,
      reason: params.reason,
      newValue: { creditNoteId: creditId, creditNoteNumber: creditNumber.toString() },
    });
    return {
      creditId,
      creditNumber,
      today,
      customerName: invoice.customer_name as string,
      customerId: invoice.customer_id as string,
      grossMinor: BigInt(invoice.gross_minor),
      lineRows: lines.rows,
      originalNumber: invoice.invoice_number,
    };
  });

  // Bokfør kreditnotaen (motsatt av fakturaen), idempotent.
  const revenueByKey = new Map<
    string,
    { account: string; vatCode: string; project: string | null; netMinor: bigint }
  >();
  const vatByCode = new Map<string, bigint>();
  for (const line of prepared.lineRows) {
    const key = `${line.revenue_account}:${line.vat_code}:${line.project ?? ''}`;
    const agg =
      revenueByKey.get(key) ??
      { account: line.revenue_account, vatCode: line.vat_code, project: line.project ?? null, netMinor: 0n };
    agg.netMinor += BigInt(line.net_minor);
    revenueByKey.set(key, agg);
    vatByCode.set(line.vat_code, (vatByCode.get(line.vat_code) ?? 0n) + BigInt(line.vat_minor));
  }
  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: params.actor,
    entryDate: prepared.today,
    description: `Kreditnota ${prepared.creditNumber} (faktura ${prepared.originalNumber}) — ${prepared.customerName}`,
    lines: [
      { accountNumber: '1500', creditMinor: prepared.grossMinor, customerId: prepared.customerId, description: `Kreditnota ${prepared.creditNumber}` },
      ...[...revenueByKey.values()].map((r) => ({
        accountNumber: r.account,
        debitMinor: r.netMinor,
        vatCode: r.vatCode,
        ...(r.project ? { project: r.project } : {}),
      })),
      ...[...vatByCode.entries()]
        .filter(([, amount]) => amount > 0n)
        .map(([code, amount]) => ({ accountNumber: '2700', debitMinor: amount, vatCode: code, description: 'Utgående mva, kreditert' })),
    ],
    idempotencyKey: `credit-note:${prepared.creditId}`,
  });
  await withTransaction(db, async (client) => {
    await client.query(
      `UPDATE invoices SET journal_entry_id = $2, updated_at = now(), version = version + 1
       WHERE id = $1 AND journal_entry_id IS NULL`,
      [prepared.creditId, entry.id],
    );
  });
  return { creditNoteId: prepared.creditId, creditNoteNumber: prepared.creditNumber, journalEntryId: entry.id };
}

/** Registrerer innbetaling på faktura (kalles fra bankmatching etter godkjenning). */
export async function registerInvoicePayment(
  client: DbClient,
  params: { organizationId: string; invoiceId: string; amountMinor: bigint },
): Promise<void> {
  const res = await client.query(
    `UPDATE invoices
     SET paid_minor = paid_minor + $3,
         status = CASE WHEN paid_minor + $3 >= gross_minor THEN 'paid' ELSE status END,
         updated_at = now(), version = version + 1
     WHERE id = $1 AND organization_id = $2 AND status IN ('issued','paid')
     RETURNING id`,
    [params.invoiceId, params.organizationId, params.amountMinor.toString()],
  );
  if (!res.rowCount) throw new NotFoundError('Fakturaen finnes ikke eller kan ikke motta betaling.');
}
