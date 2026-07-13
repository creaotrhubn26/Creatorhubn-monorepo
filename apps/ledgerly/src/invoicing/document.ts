/**
 * Salgsdokumentet (faktura/kreditnota) som utskriftsvennlig HTML.
 * Innholdet følger bokføringsforskriften § 5-1-1:
 *  1. nummer og dokumentasjonsdato
 *  2. partene: selgers navn, adresse og org.nr. (med «MVA» bak når selger er
 *     registrert i MVA-registeret), kjøpers navn og adresse/org.nr.
 *  3. ytelsens art og omfang
 *  4. tidspunkt og sted for levering
 *  5. vederlag og betalingsforfall
 *  6. merverdiavgift spesifisert per sats
 * Kun utstedte dokumenter kan gjengis — kladder har ikke nummer og er ikke
 * gyldige salgsdokumenter.
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { getVatCode } from '../coa/vat-codes.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { vatOfNet } from '../vat/engine.js';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Øre → «24 000,00» (norsk gruppering, alltid to desimaler). */
export function formatMinorAsKr(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '−' : ''}${whole},${cents}`;
}

/** Tusendeler → «2,5» (uten unødige nuller). */
function formatQuantity(thousandths: bigint): string {
  const whole = thousandths / 1000n;
  const frac = (thousandths % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return frac ? `${whole},${frac}` : whole.toString();
}

/** «987654325» → «987 654 325». */
function formatOrgNumber(orgNumber: string): string {
  return orgNumber.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
}

export interface InvoiceDocument {
  html: string;
  invoiceNumber: string;
  kind: 'invoice' | 'credit_note';
}

export async function renderInvoiceDocument(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; invoiceId: string },
): Promise<InvoiceDocument> {
  const res = await db.query(
    `SELECT i.id, i.kind, i.status, i.invoice_number, i.kid,
            i.invoice_date::TEXT AS invoice_date, i.due_date::TEXT AS due_date,
            i.delivery_date::TEXT AS delivery_date, i.delivery_place,
            i.net_minor, i.vat_minor, i.gross_minor, i.credits_invoice_id,
            o.name AS org_name, o.org_number AS org_number, o.org_form,
            o.vat_status, o.street_address AS org_street, o.postal_code AS org_postal,
            o.city AS org_city,
            c.name AS customer_name, c.org_number AS customer_org_number,
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
  const rateFor = (vatCode: string): string =>
    vatOfNet(rules, vatCode, 0n, invoiceDate).ratePct;

  const sellerOrgNumber = inv.org_number
    ? `Org.nr.: NO ${formatOrgNumber(inv.org_number)}${inv.vat_status === 'registered' ? ' MVA' : ''}`
    : '';
  const sellerLines = [
    `<strong>${esc(inv.org_name)}</strong>`,
    inv.org_street ? esc(inv.org_street) : '',
    inv.org_postal || inv.org_city ? esc(`${inv.org_postal ?? ''} ${inv.org_city ?? ''}`.trim()) : '',
    esc(sellerOrgNumber),
    inv.org_form === 'AS' ? 'Foretaksregisteret' : '',
  ].filter(Boolean);

  const buyerLines = [
    `<strong>${esc(inv.customer_name)}</strong>`,
    inv.customer_street ? esc(inv.customer_street) : '',
    inv.customer_postal || inv.customer_city
      ? esc(`${inv.customer_postal ?? ''} ${inv.customer_city ?? ''}`.trim())
      : '',
    inv.customer_org_number ? `Org.nr.: ${esc(formatOrgNumber(inv.customer_org_number))}` : '',
  ].filter(Boolean);

  const meta: [string, string][] = [
    [`${title}nummer`, String(inv.invoice_number)],
    ...(isCreditNote && original?.rowCount
      ? ([['Gjelder faktura', String(original.rows[0].invoice_number)]] as [string, string][])
      : []),
    ['Dokumentdato', invoiceDate],
    ['Leveringsdato', inv.delivery_date ?? invoiceDate],
    ...(inv.delivery_place ? ([['Leveringssted', inv.delivery_place]] as [string, string][]) : []),
    ...(!isCreditNote && inv.due_date ? ([['Forfallsdato', inv.due_date]] as [string, string][]) : []),
    ...(!isCreditNote && inv.kid ? ([['KID', inv.kid]] as [string, string][]) : []),
  ];

  const lineRows = lines.rows
    .map((l) => {
      const code = getVatCode(l.vat_code);
      return `<tr>
        <td>${esc(l.description)}</td>
        <td class="num">${formatQuantity(BigInt(l.quantity_thousandths))}</td>
        <td class="num">${formatMinorAsKr(BigInt(l.unit_price_minor))}</td>
        <td class="num">${esc(rateFor(l.vat_code))} %${code && !code.rateRuleId ? '*' : ''}</td>
        <td class="num">${formatMinorAsKr(BigInt(l.net_minor))}</td>
      </tr>`;
    })
    .join('\n');

  const vatRows = [...vatSummary.entries()]
    .map(([codeId, agg]) => {
      const code = getVatCode(codeId);
      return `<tr>
        <td>${esc(code?.name ?? `Kode ${codeId}`)}</td>
        <td class="num">${esc(rateFor(codeId))} %</td>
        <td class="num">${formatMinorAsKr(agg.baseMinor)}</td>
        <td class="num">${formatMinorAsKr(agg.vatMinor)}</td>
      </tr>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<title>${title} ${esc(String(inv.invoice_number))} — ${esc(inv.org_name)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a;
         max-width: 800px; margin: 40px auto; padding: 0 24px; font-size: 14px; }
  h1 { font-size: 26px; margin: 0 0 2px; }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .parties { display: flex; gap: 48px; margin-bottom: 28px; }
  .parties h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin: 0 0 6px; }
  .parties p { margin: 0; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
       color: #666; border-bottom: 2px solid #1a1a1a; padding: 6px 8px; }
  td { padding: 8px; border-bottom: 1px solid #e2e2e2; vertical-align: top; }
  .num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .meta td { border: none; padding: 2px 8px 2px 0; }
  .meta td:first-child { color: #666; }
  .totals { margin-left: auto; width: 320px; }
  .totals td { border: none; padding: 4px 8px; }
  .totals tr.grand td { border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 16px; }
  .footnote { color: #666; font-size: 12px; }
  @media print { body { margin: 0 auto; } }
</style>
</head>
<body>
<div class="doc-head">
  <div>
    <h1>${title}</h1>
    <table class="meta">${meta
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('\n')}</table>
  </div>
  <div style="text-align:right">${sellerLines.join('<br>')}</div>
</div>
<div class="parties">
  <div><h2>${isCreditNote ? 'Kreditnota til' : 'Fakturert til'}</h2><p>${buyerLines.join('<br>')}</p></div>
</div>
<table>
  <thead><tr><th>Beskrivelse</th><th class="num">Antall</th><th class="num">Pris eks. mva</th><th class="num">Mva</th><th class="num">Beløp eks. mva</th></tr></thead>
  <tbody>
${lineRows}
  </tbody>
</table>
<h2 style="font-size:13px">Merverdiavgift per sats</h2>
<table>
  <thead><tr><th>Behandling</th><th class="num">Sats</th><th class="num">Grunnlag</th><th class="num">Mva-beløp</th></tr></thead>
  <tbody>
${vatRows}
  </tbody>
</table>
<table class="totals">
  <tr><td>Sum eks. mva</td><td class="num">${formatMinorAsKr(BigInt(inv.net_minor))}</td></tr>
  <tr><td>Merverdiavgift</td><td class="num">${formatMinorAsKr(BigInt(inv.vat_minor))}</td></tr>
  <tr class="grand"><td>${isCreditNote ? 'Til gode' : 'Å betale'}</td><td class="num">${formatMinorAsKr(BigInt(inv.gross_minor))} kr</td></tr>
</table>
${
  [...vatSummary.keys()].some((codeId) => {
    const code = getVatCode(codeId);
    return code && !code.rateRuleId;
  })
    ? '<p class="footnote">* Omsetning fritatt for eller unntatt fra merverdiavgift.</p>'
    : ''
}
</body>
</html>`;

  return { html, invoiceNumber: String(inv.invoice_number), kind: inv.kind };
}
