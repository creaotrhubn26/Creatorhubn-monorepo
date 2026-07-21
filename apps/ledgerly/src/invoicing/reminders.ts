/**
 * Betalingspåminnelser (purring) for UTSTEDTE, forfalte Ledgerly-fakturaer.
 * (Stripe-abonnement dunes av Stripe selv — dette er for fakturaer Ledgerly
 * sender direkte.) En faktura er forfalt når status='issued', due_date har
 * passert, og den ikke er fullt betalt (paid_minor < gross_minor).
 *
 * Sender via `EmailPort` og logger hver purring i `invoice_reminders`. Maser
 * ikke: hopper over fakturaer som er purret innen `minDaysBetween` dager.
 * Beløp holdes som bigint øre til visning.
 */

import { newId } from '../shared/ids.js';
import type { Db } from '../db/pool.js';
import { EmailNotConfiguredError, type EmailPort } from '../integrations/email.js';

export interface OverdueInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  dueDate: string;
  outstandingMinor: bigint;
  currency: string;
}

export interface ReminderOptions {
  organizationId: string;
  /** Dato purringen kjøres for (ISO yyyy-mm-dd). */
  asOfDate: string;
  /** Minste antall dager mellom purringer på samme faktura. Default 7. */
  minDaysBetween?: number;
}

export interface ReminderResult {
  overdue: number;
  sent: number;
  skippedRecent: number;
  skippedNoEmail: number;
  failed: number;
}

/** Forfalte, utstedte, ikke fullt betalte fakturaer per dato. */
export async function findOverdueInvoices(
  db: Db,
  organizationId: string,
  asOfDate: string,
): Promise<OverdueInvoice[]> {
  const res = await db.query<{
    id: string;
    invoice_number: string | null;
    customer_name: string | null;
    customer_email: string | null;
    due_date: string;
    outstanding: string;
    currency: string;
  }>(
    `SELECT i.id, i.invoice_number::TEXT AS invoice_number,
            c.name AS customer_name, c.email AS customer_email,
            i.due_date::TEXT AS due_date,
            (i.gross_minor - i.paid_minor)::TEXT AS outstanding,
            i.currency
     FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.organization_id = $1
       AND i.status = 'issued'
       AND i.due_date IS NOT NULL
       AND i.due_date < $2
       AND i.paid_minor < i.gross_minor
     ORDER BY i.due_date`,
    [organizationId, asOfDate],
  );
  return res.rows.map((r) => ({
    invoiceId: r.id,
    invoiceNumber: r.invoice_number,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    dueDate: r.due_date,
    outstandingMinor: BigInt(r.outstanding),
    currency: r.currency,
  }));
}

function minorToAmount(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  return `${neg ? '-' : ''}${abs / 100n},${(abs % 100n).toString().padStart(2, '0')}`;
}

export async function sendInvoiceReminders(
  db: Db,
  email: EmailPort,
  opts: ReminderOptions,
): Promise<ReminderResult> {
  if (!email.configured) {
    // Feil raskt i stedet for å logge N mislykkede sendinger.
    throw new EmailNotConfiguredError('E-postsending er ikke konfigurert — kan ikke sende påminnelser.');
  }
  const minDays = opts.minDaysBetween ?? 7;
  const overdue = await findOverdueInvoices(db, opts.organizationId, opts.asOfDate);
  const result: ReminderResult = {
    overdue: overdue.length,
    sent: 0,
    skippedRecent: 0,
    skippedNoEmail: 0,
    failed: 0,
  };

  for (const inv of overdue) {
    if (!inv.customerEmail) {
      result.skippedNoEmail++;
      continue;
    }
    // Ikke mas: hopp over hvis purret innen minDays.
    const recent = await db.query(
      `SELECT 1 FROM invoice_reminders
       WHERE invoice_id = $1 AND status = 'sent'
         AND sent_at > ($2::date - ($3 || ' days')::interval)`,
      [inv.invoiceId, opts.asOfDate, String(minDays)],
    );
    if ((recent.rowCount ?? 0) > 0) {
      result.skippedRecent++;
      continue;
    }

    const nr = inv.invoiceNumber ? ` ${inv.invoiceNumber}` : '';
    const message = {
      to: inv.customerEmail,
      subject: `Påminnelse: ubetalt faktura${nr}`,
      text:
        `Hei${inv.customerName ? ' ' + inv.customerName : ''},\n\n` +
        `Vi minner om at faktura${nr} på ${minorToAmount(inv.outstandingMinor)} ${inv.currency} ` +
        `hadde forfall ${inv.dueDate} og fortsatt står som ubetalt.\n\n` +
        `Har du allerede betalt, kan du se bort fra denne påminnelsen.\n\n` +
        `Vennlig hilsen`,
    };

    try {
      await email.send(message); // kaster EmailNotConfiguredError uten konfig
      await db.query(
        `INSERT INTO invoice_reminders (id, organization_id, invoice_id, channel, recipient, status)
         VALUES ($1,$2,$3,'email',$4,'sent')`,
        [newId(), opts.organizationId, inv.invoiceId, inv.customerEmail],
      );
      result.sent++;
    } catch (err) {
      await db.query(
        `INSERT INTO invoice_reminders (id, organization_id, invoice_id, channel, recipient, status, detail)
         VALUES ($1,$2,$3,'email',$4,'failed',$5)`,
        [newId(), opts.organizationId, inv.invoiceId, inv.customerEmail, err instanceof Error ? err.message.slice(0, 200) : 'ukjent feil'],
      );
      result.failed++;
    }
  }

  return result;
}
