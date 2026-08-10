/**
 * EHF / PEPPOL BIS Billing 3.0 — salgsfakturaen som UBL 2.1-XML, det formatet
 * norske bedrifter og offentlig sektor krever for e-faktura. Bygges deterministisk
 * fra fakturadataene (ingen AI, ingen gjetting). Selve OVERFØRINGEN til mottaker
 * går gjennom et PEPPOL-aksesspunkt — det ligger bak en egen port med ærlig status
 * (ikke aktiv uten aksesspunkt-avtale). XML-en kan uansett lastes ned og sendes
 * manuelt / lastes opp hos et aksesspunkt.
 *
 * Dekker BIS Billing 3.0 for både salgsfaktura (380, UBL Invoice) og kreditnota
 * (381, UBL CreditNote — med påkrevd BillingReference til fakturaen som krediteres).
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { getVatCode } from '../coa/vat-codes.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { vatOfNet } from '../vat/engine.js';

const CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
const PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
/** Norsk PEPPOL-adresseskjema = organisasjonsnummer. */
const NO_SCHEME = '0192';

export interface EhfParty {
  name: string;
  orgNumber: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  vatRegistered: boolean;
}

export interface EhfTaxSubtotal {
  category: string; // UNCL5305: S, Z, E, AE
  ratePct: string;
  baseMinor: bigint;
  vatMinor: bigint;
  exemptionReason?: string;
}

export interface EhfLine {
  id: string;
  description: string;
  quantityThousandths: bigint;
  unitPriceMinor: bigint;
  netMinor: bigint;
  category: string;
  ratePct: string;
}

export interface EhfInvoice {
  kind: 'invoice' | 'credit_note';
  /** For kreditnota: fakturaen den krediterer (påkrevd BillingReference i UBL). */
  billingReference: { invoiceNumber: string; issueDate: string } | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  kid: string | null;
  bankAccount: string | null;
  seller: EhfParty;
  buyer: EhfParty;
  lines: EhfLine[];
  taxSubtotals: EhfTaxSubtotal[];
  netMinor: bigint;
  vatMinor: bigint;
  grossMinor: bigint;
}

/**
 * Mva-kode → UBL avgiftskategori (UNCL5305). Omvendt avgiftsplikt = AE; med sats
 * og sats>0 = S (standard); med regel men 0-sats = Z; ingen sats/utenfor loven = E.
 */
function taxCategory(vatCode: string, ratePct: string): { category: string; reason?: string } {
  const code = getVatCode(vatCode);
  if (code?.reverseCharge) return { category: 'AE', reason: 'Reverse charge' };
  if (!code?.rateRuleId) return { category: 'E', reason: 'Fritatt/unntatt merverdiavgift' };
  if (ratePct === '0') return { category: 'Z', reason: 'Nullsats' };
  return { category: 'S' };
}

export async function loadInvoiceEhf(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; invoiceId: string },
): Promise<EhfInvoice> {
  const res = await db.query(
    `SELECT i.kind, i.status, i.invoice_number, i.kid,
            i.invoice_date::TEXT AS invoice_date, i.due_date::TEXT AS due_date,
            i.net_minor, i.vat_minor, i.gross_minor, i.credits_invoice_id,
            orig.invoice_number AS orig_number, orig.invoice_date::TEXT AS orig_date,
            o.name AS org_name, o.org_number AS org_number, o.vat_status,
            o.street_address AS org_street, o.postal_code AS org_postal, o.city AS org_city,
            c.name AS customer_name, c.org_number AS customer_org_number,
            c.street_address AS customer_street, c.postal_code AS customer_postal, c.city AS customer_city
     FROM invoices i
     JOIN organizations o ON o.id = i.organization_id
     JOIN customers c ON c.id = i.customer_id
     LEFT JOIN invoices orig ON orig.id = i.credits_invoice_id
     WHERE i.id = $1 AND i.organization_id = $2`,
    [params.invoiceId, params.organizationId],
  );
  if (!res.rowCount) throw new NotFoundError('Fakturaen finnes ikke.');
  const inv = res.rows[0];
  if (inv.status === 'draft' || !inv.invoice_number) {
    throw new ValidationError('Kladder er ikke gyldige salgsdokumenter. Utsted dokumentet først.');
  }
  const kind: 'invoice' | 'credit_note' = inv.kind === 'credit_note' ? 'credit_note' : 'invoice';

  const linesRes = await db.query(
    `SELECT description, quantity_thousandths, unit_price_minor, vat_code, net_minor, vat_minor
     FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
    [params.invoiceId],
  );
  const bankRes = await db.query(
    `SELECT iban_or_account FROM bank_accounts
     WHERE organization_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
    [params.organizationId],
  );

  const issueDate: string = inv.invoice_date;
  const rateFor = (vatCode: string): string => vatOfNet(rules, vatCode, 0n, issueDate).ratePct;

  const lines: EhfLine[] = linesRes.rows.map((l, i) => {
    const ratePct = rateFor(l.vat_code);
    return {
      id: String(i + 1),
      description: String(l.description),
      quantityThousandths: BigInt(l.quantity_thousandths),
      unitPriceMinor: BigInt(l.unit_price_minor),
      netMinor: BigInt(l.net_minor),
      category: taxCategory(l.vat_code, ratePct).category,
      ratePct,
    };
  });

  // Avgift oppsummert per (kategori + sats).
  const subtotals = new Map<string, EhfTaxSubtotal>();
  for (const l of linesRes.rows) {
    const ratePct = rateFor(l.vat_code);
    const { category, reason } = taxCategory(l.vat_code, ratePct);
    const key = `${category}:${ratePct}`;
    const agg =
      subtotals.get(key) ??
      ({ category, ratePct, baseMinor: 0n, vatMinor: 0n, ...(reason ? { exemptionReason: reason } : {}) } as EhfTaxSubtotal);
    agg.baseMinor += BigInt(l.net_minor);
    agg.vatMinor += BigInt(l.vat_minor);
    subtotals.set(key, agg);
  }

  return {
    kind,
    billingReference: kind === 'credit_note' && inv.orig_number ? { invoiceNumber: String(inv.orig_number), issueDate: inv.orig_date } : null,
    invoiceNumber: String(inv.invoice_number),
    issueDate,
    dueDate: kind === 'credit_note' ? null : (inv.due_date ?? null),
    currency: 'NOK',
    kid: inv.kid ?? null,
    bankAccount: bankRes.rowCount ? String(bankRes.rows[0].iban_or_account).replace(/\s/g, '') : null,
    seller: {
      name: String(inv.org_name),
      orgNumber: inv.org_number ? String(inv.org_number) : null,
      street: inv.org_street ?? null,
      city: inv.org_city ?? null,
      postalCode: inv.org_postal ?? null,
      vatRegistered: inv.vat_status === 'registered',
    },
    buyer: {
      name: String(inv.customer_name),
      orgNumber: inv.customer_org_number ? String(inv.customer_org_number) : null,
      street: inv.customer_street ?? null,
      city: inv.customer_city ?? null,
      postalCode: inv.customer_postal ?? null,
      vatRegistered: false,
    },
    lines,
    taxSubtotals: [...subtotals.values()],
    netMinor: BigInt(inv.net_minor),
    vatMinor: BigInt(inv.vat_minor),
    grossMinor: BigInt(inv.gross_minor),
  };
}

// ── XML-hjelpere ─────────────────────────────────────────────────────────────

function xmlEsc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Øre → «1234.56» (to desimaler, UBL-format). */
function dec(minor: bigint): string {
  const neg = minor < 0n;
  const a = neg ? -minor : minor;
  return `${neg ? '-' : ''}${a / 100n}.${(a % 100n).toString().padStart(2, '0')}`;
}

/** Tusendeler → «2.500» (tre desimaler). */
function qty(th: bigint): string {
  const neg = th < 0n;
  const a = neg ? -th : th;
  return `${neg ? '-' : ''}${a / 1000n}.${(a % 1000n).toString().padStart(3, '0')}`;
}

function partyXml(role: 'AccountingSupplierParty' | 'AccountingCustomerParty', p: EhfParty): string {
  const endpoint = p.orgNumber
    ? `<cbc:EndpointID schemeID="${NO_SCHEME}">${xmlEsc(p.orgNumber)}</cbc:EndpointID>`
    : '';
  const taxScheme =
    p.vatRegistered && p.orgNumber
      ? `<cac:PartyTaxScheme>
          <cbc:CompanyID>NO${xmlEsc(p.orgNumber)}MVA</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>`
      : '';
  const legal = p.orgNumber
    ? `<cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEsc(p.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="${NO_SCHEME}">${xmlEsc(p.orgNumber)}</cbc:CompanyID>
      </cac:PartyLegalEntity>`
    : `<cac:PartyLegalEntity><cbc:RegistrationName>${xmlEsc(p.name)}</cbc:RegistrationName></cac:PartyLegalEntity>`;
  return `<cac:${role}>
    <cac:Party>
      ${endpoint}
      <cac:PartyName><cbc:Name>${xmlEsc(p.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ${p.street ? `<cbc:StreetName>${xmlEsc(p.street)}</cbc:StreetName>` : ''}
        ${p.city ? `<cbc:CityName>${xmlEsc(p.city)}</cbc:CityName>` : ''}
        ${p.postalCode ? `<cbc:PostalZone>${xmlEsc(p.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>NO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${taxScheme}
      ${legal}
    </cac:Party>
  </cac:${role}>`;
}

function taxCategoryXml(category: string, ratePct: string, reason?: string): string {
  const reasonEl = reason && category !== 'S' ? `<cbc:TaxExemptionReason>${xmlEsc(reason)}</cbc:TaxExemptionReason>` : '';
  return `<cac:TaxCategory>
    <cbc:ID>${category}</cbc:ID>
    <cbc:Percent>${xmlEsc(ratePct)}</cbc:Percent>
    ${reasonEl}
    <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
  </cac:TaxCategory>`;
}

/** Renser XML for tomme linjer og overflødig whitespace (holder den lesbar + kompakt). */
function tidy(xml: string): string {
  return xml
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n');
}

/** Bygger PEPPOL BIS Billing 3.0 UBL-dokument (EHF) — faktura (380) eller kreditnota (381). */
export function renderEhfXml(inv: EhfInvoice): string {
  const cur = inv.currency;
  const isCredit = inv.kind === 'credit_note';
  const rootEl = isCredit ? 'CreditNote' : 'Invoice';
  const ns = isCredit ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2' : 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
  const typeCode = isCredit ? '<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>' : '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>';
  const lineEl = isCredit ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyEl = isCredit ? 'CreditedQuantity' : 'InvoicedQuantity';
  const billingRef = inv.billingReference
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${xmlEsc(inv.billingReference.invoiceNumber)}</cbc:ID><cbc:IssueDate>${inv.billingReference.issueDate}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>`
    : '';
  const taxTotal = `<cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${dec(inv.vatMinor)}</cbc:TaxAmount>
    ${inv.taxSubtotals
      .map(
        (s) => `<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${cur}">${dec(s.baseMinor)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${cur}">${dec(s.vatMinor)}</cbc:TaxAmount>
      ${taxCategoryXml(s.category, s.ratePct, s.exemptionReason)}
    </cac:TaxSubtotal>`,
      )
      .join('\n')}
  </cac:TaxTotal>`;

  // Kreditnota har normalt ikke betalingsinstruks.
  const paymentMeans = !isCredit && inv.bankAccount
    ? `<cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    ${inv.kid ? `<cbc:PaymentID>${xmlEsc(inv.kid)}</cbc:PaymentID>` : ''}
    <cac:PayeeFinancialAccount><cbc:ID>${xmlEsc(inv.bankAccount)}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : '';

  const lines = inv.lines
    .map(
      (l) => `<cac:${lineEl}>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:${qtyEl} unitCode="EA">${qty(l.quantityThousandths)}</cbc:${qtyEl}>
    <cbc:LineExtensionAmount currencyID="${cur}">${dec(l.netMinor)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xmlEsc(l.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${l.category}</cbc:ID>
        <cbc:Percent>${xmlEsc(l.ratePct)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${cur}">${dec(l.unitPriceMinor)}</cbc:PriceAmount></cac:Price>
  </cac:${lineEl}>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootEl} xmlns="${ns}"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${xmlEsc(inv.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${inv.issueDate}</cbc:IssueDate>
  ${inv.dueDate ? `<cbc:DueDate>${inv.dueDate}</cbc:DueDate>` : ''}
  ${typeCode}
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  ${billingRef}
  ${partyXml('AccountingSupplierParty', inv.seller)}
  ${partyXml('AccountingCustomerParty', inv.buyer)}
  ${paymentMeans}
  ${taxTotal}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${dec(inv.netMinor)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${dec(inv.netMinor)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${dec(inv.grossMinor)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${dec(inv.grossMinor)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</${rootEl}>`;
  return tidy(xml);
}

// ── Overføring via PEPPOL-aksesspunkt (egen port, ærlig status) ───────────────

export class PeppolTransmissionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PeppolTransmissionError';
  }
}

export class PeppolNotConfiguredError extends PeppolTransmissionError {
  constructor(message: string) {
    super(message);
    this.name = 'PeppolNotConfiguredError';
  }
}

export interface PeppolAccessPoint {
  readonly name: string;
  readonly configured: boolean;
  /** Sender EHF-XML til mottaker via aksesspunktet. */
  send(params: { xml: string; recipientOrgNumber: string; invoiceNumber: string }): Promise<void>;
}

/** Ærlig no-op når intet aksesspunkt er konfigurert. */
export class UnconfiguredPeppolAccessPoint implements PeppolAccessPoint {
  readonly name = 'none';
  readonly configured = false;
  async send(): Promise<void> {
    throw new PeppolNotConfiguredError(
      'Intet PEPPOL-aksesspunkt er konfigurert. Last ned EHF-XML og send den via ditt aksesspunkt.',
    );
  }
}
