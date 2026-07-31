import { describe, expect, it } from 'vitest';
import { renderEhfXml, type EhfInvoice } from '../src/invoicing/ehf.js';

const inv: EhfInvoice = {
  kind: 'invoice',
  billingReference: null,
  invoiceNumber: '1',
  issueDate: '2025-12-01',
  dueDate: '2025-12-15',
  currency: 'NOK',
  kid: '1234561',
  bankAccount: '15060312345',
  seller: {
    name: 'Selger & Co AS',
    orgNumber: '910023764',
    street: 'Regnskapsgata 8',
    city: 'Oslo',
    postalCode: '0155',
    vatRegistered: true,
  },
  buyer: {
    name: 'Kjøper AS',
    orgNumber: '923609016',
    street: 'Kjøpergata 1',
    city: 'Bergen',
    postalCode: '5011',
    vatRegistered: false,
  },
  lines: [
    { id: '1', description: 'Rådgivning', quantityThousandths: 2500n, unitPriceMinor: 200000n, netMinor: 500000n, category: 'S', ratePct: '25' },
    { id: '2', description: 'Unntatt <tjeneste> & mer', quantityThousandths: 1000n, unitPriceMinor: 300000n, netMinor: 300000n, category: 'E', ratePct: '0' },
  ],
  taxSubtotals: [
    { category: 'S', ratePct: '25', baseMinor: 500000n, vatMinor: 125000n },
    { category: 'E', ratePct: '0', baseMinor: 300000n, vatMinor: 0n, exemptionReason: 'Fritatt/unntatt merverdiavgift' },
  ],
  netMinor: 800000n,
  vatMinor: 125000n,
  grossMinor: 925000n,
};

describe('renderEhfXml (PEPPOL BIS Billing 3.0)', () => {
  const xml = renderEhfXml(inv);

  it('har BIS 3.0-profil, korrekt dokumenttype og valuta', () => {
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0');
    expect(xml).toContain('<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>NOK</cbc:DocumentCurrencyCode>');
    expect(xml).toContain('<cbc:ID>1</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2025-12-01</cbc:IssueDate>');
    expect(xml).toContain('<cbc:DueDate>2025-12-15</cbc:DueDate>');
  });

  it('setter partene med norsk PEPPOL-adresse (0192:org) og mva-id på registrert selger', () => {
    expect(xml).toContain('<cbc:EndpointID schemeID="0192">910023764</cbc:EndpointID>');
    expect(xml).toContain('<cbc:EndpointID schemeID="0192">923609016</cbc:EndpointID>');
    expect(xml).toContain('<cbc:CompanyID>NO910023764MVA</cbc:CompanyID>'); // selger mva-registrert
    expect(xml).not.toContain('NO923609016MVA'); // kjøper ikke mva-registrert
    expect(xml).toContain('<cbc:CityName>Oslo</cbc:CityName>');
    expect(xml).toContain('<cbc:IdentificationCode>NO</cbc:IdentificationCode>');
  });

  it('betalingsmiddel med KID + kontonummer', () => {
    expect(xml).toContain('<cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>');
    expect(xml).toContain('<cbc:PaymentID>1234561</cbc:PaymentID>');
    expect(xml).toContain('<cbc:ID>15060312345</cbc:ID>');
  });

  it('avgift per kategori (S + E med fritaksgrunn) og korrekte totaler', () => {
    expect(xml).toContain('<cbc:TaxAmount currencyID="NOK">1250.00</cbc:TaxAmount>');
    expect(xml).toMatch(/<cbc:ID>S<\/cbc:ID>\s*<cbc:Percent>25<\/cbc:Percent>/);
    expect(xml).toMatch(/<cbc:ID>E<\/cbc:ID>/);
    expect(xml).toContain('<cbc:TaxExemptionReason>Fritatt/unntatt merverdiavgift</cbc:TaxExemptionReason>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="NOK">8000.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="NOK">9250.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="NOK">9250.00</cbc:PayableAmount>');
  });

  it('fakturalinjer med mengde, beløp og linjeskatt-kategori', () => {
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="EA">2.500</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="NOK">2000.00</cbc:PriceAmount>');
    expect(xml).toContain('<cbc:Name>Rådgivning</cbc:Name>');
  });

  it('escaper XML-spesialtegn i fritekst', () => {
    expect(xml).toContain('Unntatt &lt;tjeneste&gt; &amp; mer');
    expect(xml).not.toContain('<tjeneste>');
  });

  it('er velformet: balanserte rot- og nøkkeltagger, ingen naken &', () => {
    expect((xml.match(/<Invoice[ >]/g) ?? []).length).toBe(1);
    expect((xml.match(/<\/Invoice>/g) ?? []).length).toBe(1);
    const open = (xml.match(/<cac:InvoiceLine>/g) ?? []).length;
    const close = (xml.match(/<\/cac:InvoiceLine>/g) ?? []).length;
    expect(open).toBe(2);
    expect(close).toBe(2);
    // ingen naken & (alle er entiteter)
    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  });
});

describe('renderEhfXml — kreditnota (381)', () => {
  const credit: EhfInvoice = {
    ...inv,
    kind: 'credit_note',
    invoiceNumber: '2',
    issueDate: '2026-01-10',
    dueDate: null,
    billingReference: { invoiceNumber: '1', issueDate: '2025-12-01' },
  };
  const xml = renderEhfXml(credit);

  it('bruker CreditNote-rot, namespace og type 381', () => {
    expect(xml).toContain('<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"');
    expect(xml).toContain('<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>');
    expect((xml.match(/<CreditNote[ >]/g) ?? []).length).toBe(1);
    expect((xml.match(/<\/CreditNote>/g) ?? []).length).toBe(1);
    expect(xml).not.toContain('<cbc:InvoiceTypeCode>');
  });

  it('refererer fakturaen som krediteres (BillingReference)', () => {
    expect(xml).toContain('<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>1</cbc:ID><cbc:IssueDate>2025-12-01</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>');
  });

  it('bruker CreditNoteLine + CreditedQuantity, og ingen betalingsinstruks', () => {
    expect((xml.match(/<cac:CreditNoteLine>/g) ?? []).length).toBe(2);
    expect(xml).toContain('<cbc:CreditedQuantity unitCode="EA">2.500</cbc:CreditedQuantity>');
    expect(xml).not.toContain('<cac:InvoiceLine>');
    expect(xml).not.toContain('<cac:PaymentMeans>'); // kreditnota har ikke betalingsmiddel
    expect(xml).not.toContain('<cbc:DueDate>');
  });
});
