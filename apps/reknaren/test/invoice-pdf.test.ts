import { describe, expect, it } from 'vitest';
import { renderInvoicePdf } from '../src/invoicing/pdf.js';
import type { InvoiceView } from '../src/invoicing/view.js';

const view: InvoiceView = {
  kind: 'invoice',
  title: 'Faktura',
  invoiceNumber: '1',
  orgName: 'Innholdstest AS',
  sellerLines: ['Innholdstest AS', 'Regnskapsgata 8', '0155 Oslo', 'Org.nr.: NO 910 023 764 MVA', 'Foretaksregisteret'],
  buyerHeading: 'Fakturert til',
  buyerLines: ['Kjøper & Co AS', 'Kjøpergata 1', '0250 Oslo', 'Org.nr.: 923 609 016'],
  meta: [
    ['Fakturanummer', '1'],
    ['Dokumentdato', '2025-12-01'],
    ['Forfallsdato', '2025-12-15'],
    ['KID', '1234561'],
  ],
  lines: [
    { description: 'Rådgivning og konsulentbistand desember', qty: '2,5', unitPrice: '2 000,00', vat: '25 %', net: '5 000,00' },
    { description: 'Utleggsrefusjon (fritatt)', qty: '1', unitPrice: '3 000,00', vat: '0 %*', net: '3 000,00' },
  ],
  vat: [
    { treatment: 'Utgående mva 25 %', rate: '25', base: '5 000,00', vat: '1 250,00' },
    { treatment: 'Fritatt', rate: '0', base: '3 000,00', vat: '0,00' },
  ],
  netTotal: '8 000,00',
  vatTotal: '1 250,00',
  grossTotal: '9 250,00',
  grandLabel: 'Å betale',
  hasExemptFootnote: true,
  customerName: 'Kjøper & Co AS',
  customerEmail: 'kunde@example.com',
};

describe('renderInvoicePdf', () => {
  const pdf = renderInvoicePdf(view);
  const latin1 = pdf.toString('latin1');

  it('gir en gyldig PDF-struktur (header, xref, EOF, fonter)', () => {
    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(latin1).toContain('%%EOF');
    expect(latin1).toContain('xref');
    expect(latin1).toContain('/Type /Catalog');
    expect(latin1).toContain('/BaseFont /Helvetica');
    expect(latin1).toContain('/BaseFont /Courier');
    expect(latin1).toContain('/WinAnsiEncoding');
  });

  it('inneholder ASCII-innhold ordrett (nummer, tittel, beløp)', () => {
    expect(latin1).toContain('Faktura');
    expect(latin1).toContain('Fakturanummer');
    expect(latin1).toContain('9 250,00'); // å betale, ASCII-siffer med gruppering
    expect(latin1).toContain('1 250,00'); // mva
    expect(latin1).toContain('Foretaksregisteret'); // selgerblokk
  });

  it('koder norske tegn som WinAnsi oktal-escape (æøå utenfor ASCII)', () => {
    // «Rådgivning» → å = 0xE5 → \345 ; «Kjøper» → ø = 0xF8 → \370 ; «Å betale» → Å = 0xC5 → \305
    expect(latin1).toContain('\\345'); // å
    expect(latin1).toContain('\\370'); // ø
    expect(latin1).toContain('\\305'); // Å
    // og aldri rå UTF-8-multibyte for disse
    expect(pdf.includes(Buffer.from('Rådgivning', 'utf8'))).toBe(false);
  });

  it('xref-tabellen refererer alle objekter', () => {
    const m = latin1.match(/xref\n0 (\d+)\n/);
    expect(m).not.toBeNull();
    // Catalog, Pages, Page, Contents + 4 fonter = 8 objekter → Size 9 (inkl. objekt 0)
    expect(Number(m![1])).toBe(9);
  });
});
