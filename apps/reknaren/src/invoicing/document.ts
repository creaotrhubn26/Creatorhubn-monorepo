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
 *
 * Data hentes av `loadInvoiceView` (delt med PDF-en) — denne fila bygger kun HTML.
 * Kun utstedte dokumenter kan gjengis — kladder er ikke gyldige salgsdokumenter.
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { formatMinorAsKr, loadInvoiceView, type InvoiceView } from './view.js';

// Re-eksport for bakoverkompatibilitet (andre moduler importerer herfra).
export { formatMinorAsKr };

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Uthev første linje (navnet), esc resten — felles for selger/kjøper. */
function partyHtml(lines: string[]): string {
  return lines.map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : esc(l))).join('<br>');
}

export interface InvoiceDocument {
  html: string;
  invoiceNumber: string;
  kind: 'invoice' | 'credit_note';
}

/** Bygger § 5-1-1-HTML fra den delte modellen. */
export function renderInvoiceHtml(view: InvoiceView): string {
  const { title } = view;
  const lineRows = view.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.description)}</td>
        <td class="num">${esc(l.qty)}</td>
        <td class="num">${esc(l.unitPrice)}</td>
        <td class="num">${esc(l.vat)}</td>
        <td class="num">${esc(l.net)}</td>
      </tr>`,
    )
    .join('\n');

  const vatRows = view.vat
    .map(
      (v) => `<tr>
        <td>${esc(v.treatment)}</td>
        <td class="num">${esc(v.rate)} %</td>
        <td class="num">${esc(v.base)}</td>
        <td class="num">${esc(v.vat)}</td>
      </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<title>${title} ${esc(view.invoiceNumber)} — ${esc(view.orgName)}</title>
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
    <table class="meta">${view.meta
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('\n')}</table>
  </div>
  <div style="text-align:right">${partyHtml(view.sellerLines)}</div>
</div>
<div class="parties">
  <div><h2>${esc(view.buyerHeading)}</h2><p>${partyHtml(view.buyerLines)}</p></div>
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
  <tr><td>Sum eks. mva</td><td class="num">${esc(view.netTotal)}</td></tr>
  <tr><td>Merverdiavgift</td><td class="num">${esc(view.vatTotal)}</td></tr>
  <tr class="grand"><td>${esc(view.grandLabel)}</td><td class="num">${esc(view.grossTotal)} kr</td></tr>
</table>
${
  view.hasExemptFootnote
    ? '<p class="footnote">* Omsetning fritatt for eller unntatt fra merverdiavgift.</p>'
    : ''
}
</body>
</html>`;
}

export async function renderInvoiceDocument(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; invoiceId: string },
): Promise<InvoiceDocument> {
  const view = await loadInvoiceView(db, rules, params);
  return { html: renderInvoiceHtml(view), invoiceNumber: view.invoiceNumber, kind: view.kind };
}
