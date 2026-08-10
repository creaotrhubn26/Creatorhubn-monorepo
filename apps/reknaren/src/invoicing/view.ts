/**
 * Delt, presentasjons-nøytral modell for salgsdokumentet (faktura/kreditnota).
 * Både HTML-visningen (`document.ts`) og PDF-en (`pdf.ts`) bygger på DENNE modellen,
 * slik at de aldri kommer i utakt. All formatering (øre→kr, org.nr-gruppering,
 * mva per sats) skjer her, én gang. Modellen er ren tekst — ingen HTML — så PDF-en
 * slipper å strippe markup.
 *
 * Innholdet følger bokføringsforskriften § 5-1-1 (partene, ytelsen, vederlag,
 * forfall, mva per sats). Kun UTSTEDTE dokumenter kan bygges — kladder mangler
 * nummer og er ikke gyldige salgsdokumenter.
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { getVatCode } from '../coa/vat-codes.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { vatOfNet } from '../vat/engine.js';

/** Øre → «24 000,00» (norsk gruppering, alltid to desimaler). */
export function formatMinorAsKr(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '−' : ''}${whole},${cents}`;
}

/** Tusendeler → «2,5» (uten unødige nuller). */
export function formatQuantity(thousandths: bigint): string {
  const whole = thousandths / 1000n;
  const frac = (thousandths % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return frac ? `${whole},${frac}` : whole.toString();
}

/** «987654325» → «987 654 325». */
export function formatOrgNumber(orgNumber: string): string {
  return orgNumber.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
}

export interface InvoiceViewLine {
  description: string;
  qty: string;
  unitPrice: string;
  vat: string;
  net: string;
}

export interface InvoiceViewVatRow {
  treatment: string;
  rate: string;
  base: string;
  vat: string;
}

/** Presentasjons-nøytral fakturamodell. `sellerLines[0]`/`buyerLines[0]` er navnet (utheves). */
export interface InvoiceView {
  kind: 'invoice' | 'credit_note';
  title: string;
  invoiceNumber: string;
  orgName: string;
  sellerLines: string[];
  buyerHeading: string;
  buyerLines: string[];
  meta: [string, string][];
  lines: InvoiceViewLine[];
  vat: InvoiceViewVatRow[];
  netTotal: string;
  vatTotal: string;
  grossTotal: string;
  grandLabel: string;
  hasExemptFootnote: boolean;
  customerName: string;
  customerEmail: string | null;
}

export async function loadInvoiceView(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; invoiceId: string },
): Promise<InvoiceView> {
  const res = await db.query(
    `SELECT i.id, i.kind, i.status, i.invoice_number, i.kid,
            i.invoice_date::TEXT AS invoice_date, i.due_date::TEXT AS due_date,
            i.delivery_date::TEXT AS delivery_date, i.delivery_place,
            i.net_minor, i.vat_minor, i.gross_minor, i.credits_invoice_id,
            o.name AS org_name, o.org_number AS org_number, o.org_form,
            o.vat_status, o.street_address AS org_street, o.postal_code AS org_postal,
            o.city AS org_city,
            c.name AS customer_name, c.org_number AS customer_org_number,
            c.email AS customer_email,
            c.street_address AS customer_street, c.postal_code AS customer_postal,
            c.city AS customer_city
     FROM invoices i
     JOIN organizations o ON o.id = i.organization_id
     JOIN customers c ON c.id = i.customer_id
     WHERE i.id = $1 AND i.organization_id = $2`,
    [params.invoiceId, params.organizationId],
  );
  if (!res.rowCount) throw new NotFoundError('Fakturaen finnes ikke.');
  const inv = res.rows[0];
  if (inv.status === 'draft' || !inv.invoice_number) {
    throw new ValidationError(
      'Kladder har ikke fakturanummer og er ikke gyldige salgsdokumenter. Utsted fakturaen først.',
    );
  }

  const original =
    inv.kind === 'credit_note' && inv.credits_invoice_id
      ? await db.query(`SELECT invoice_number FROM invoices WHERE id = $1`, [inv.credits_invoice_id])
      : null;

  const lines = await db.query(
    `SELECT description, quantity_thousandths, unit_price_minor, vat_code, net_minor, vat_minor
     FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
    [params.invoiceId],
  );

  const isCreditNote = inv.kind === 'credit_note';
  const title = isCreditNote ? 'Kreditnota' : 'Faktura';
  const invoiceDate: string = inv.invoice_date;

  // MVA spesifisert per sats (grunnlag + beløp per kode).
  const vatSummary = new Map<string, { baseMinor: bigint; vatMinor: bigint }>();
  for (const line of lines.rows) {
    const agg = vatSummary.get(line.vat_code) ?? { baseMinor: 0n, vatMinor: 0n };
    agg.baseMinor += BigInt(line.net_minor);
    agg.vatMinor += BigInt(line.vat_minor);
    vatSummary.set(line.vat_code, agg);
  }
  const rateFor = (vatCode: string): string => vatOfNet(rules, vatCode, 0n, invoiceDate).ratePct;

  const sellerOrgNumber = inv.org_number
    ? `Org.nr.: NO ${formatOrgNumber(inv.org_number)}${inv.vat_status === 'registered' ? ' MVA' : ''}`
    : '';
  const sellerLines = [
    String(inv.org_name),
    inv.org_street ? String(inv.org_street) : '',
    inv.org_postal || inv.org_city ? `${inv.org_postal ?? ''} ${inv.org_city ?? ''}`.trim() : '',
    sellerOrgNumber,
    inv.org_form === 'AS' ? 'Foretaksregisteret' : '',
  ].filter(Boolean);

  const buyerLines = [
    String(inv.customer_name),
    inv.customer_street ? String(inv.customer_street) : '',
    inv.customer_postal || inv.customer_city
      ? `${inv.customer_postal ?? ''} ${inv.customer_city ?? ''}`.trim()
      : '',
    inv.customer_org_number ? `Org.nr.: ${formatOrgNumber(inv.customer_org_number)}` : '',
  ].filter(Boolean);

  const meta: [string, string][] = [
    [`${title}nummer`, String(inv.invoice_number)],
    ...(isCreditNote && original?.rowCount
      ? ([['Gjelder faktura', String(original.rows[0].invoice_number)]] as [string, string][])
      : []),
    ['Dokumentdato', invoiceDate],
    ['Leveringsdato', inv.delivery_date ?? invoiceDate],
    ...(inv.delivery_place ? ([['Leveringssted', String(inv.delivery_place)]] as [string, string][]) : []),
    ...(!isCreditNote && inv.due_date ? ([['Forfallsdato', String(inv.due_date)]] as [string, string][]) : []),
    ...(!isCreditNote && inv.kid ? ([['KID', String(inv.kid)]] as [string, string][]) : []),
  ];

  const viewLines: InvoiceViewLine[] = lines.rows.map((l) => {
    const code = getVatCode(l.vat_code);
    return {
      description: String(l.description),
      qty: formatQuantity(BigInt(l.quantity_thousandths)),
      unitPrice: formatMinorAsKr(BigInt(l.unit_price_minor)),
      vat: `${rateFor(l.vat_code)} %${code && !code.rateRuleId ? '*' : ''}`,
      net: formatMinorAsKr(BigInt(l.net_minor)),
    };
  });

  const vat: InvoiceViewVatRow[] = [...vatSummary.entries()].map(([codeId, agg]) => {
    const code = getVatCode(codeId);
    return {
      treatment: code?.name ?? `Kode ${codeId}`,
      rate: rateFor(codeId),
      base: formatMinorAsKr(agg.baseMinor),
      vat: formatMinorAsKr(agg.vatMinor),
    };
  });

  const hasExemptFootnote = [...vatSummary.keys()].some((codeId) => {
    const code = getVatCode(codeId);
    return code && !code.rateRuleId;
  });

  return {
    kind: inv.kind,
    title,
    invoiceNumber: String(inv.invoice_number),
    orgName: String(inv.org_name),
    sellerLines,
    buyerHeading: isCreditNote ? 'Kreditnota til' : 'Fakturert til',
    buyerLines,
    meta,
    lines: viewLines,
    vat,
    netTotal: formatMinorAsKr(BigInt(inv.net_minor)),
    vatTotal: formatMinorAsKr(BigInt(inv.vat_minor)),
    grossTotal: formatMinorAsKr(BigInt(inv.gross_minor)),
    grandLabel: isCreditNote ? 'Til gode' : 'Å betale',
    hasExemptFootnote,
    customerName: String(inv.customer_name),
    customerEmail: inv.customer_email ? String(inv.customer_email) : null,
  };
}
