/**
 * Dokumentuttrekk. OCR/dokumentforståelse ligger bak `DocumentExtractor`-porten.
 * MVP-implementasjonen er deterministisk tekstparsing (fungerer på tekstbærende
 * PDF-er som sandbox-fixturene). En AI/OCR-motor kan plugges inn senere bak
 * samme grensesnitt — output valideres uansett av documents/validate.ts.
 */
import { moneyFromDecimalString } from '../shared/money.js';
import type { DocumentType, ExtractedData } from '../documents/types.js';

export interface DocumentExtractor {
  readonly name: string;
  extract(content: Buffer, filename: string, mimeType: string): Promise<ExtractedData>;
}

function parseAmount(raw: string, currency: string): bigint | undefined {
  try {
    const cleaned = raw.replace(/\s| /g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
    return moneyFromDecimalString(cleaned, currency).minorUnits;
  } catch {
    return undefined;
  }
}

const CURRENCY_RE = /\b(NOK|EUR|USD|SEK|DKK|GBP)\b/;

/**
 * Parser dokumenttekst (fra tekst-PDF, OCR eller råtekst) til strukturert skjema.
 * Deles av DeterministicTextExtractor og OcrExtractor.
 */
export function parseDocumentText(text: string, filename: string): ExtractedData {
  {
    const lower = text.toLowerCase();

    let documentType: DocumentType = 'unknown';
    if (/kreditnota|credit note/.test(lower)) documentType = 'credit_note';
    else if (/faktura|invoice/.test(lower) || /faktura|invoice/.test(filename.toLowerCase()))
      documentType = 'supplier_invoice';
    else if (/kvittering|receipt/.test(lower)) documentType = 'receipt';

    const currency = CURRENCY_RE.exec(text)?.[1] ?? (/,\d{2}\b/.test(text) ? 'NOK' : undefined);

    const orgNumber = /org\.?\s*nr\.?:?\s*(\d{3}\s?\d{3}\s?\d{3})/i
      .exec(text)?.[1]
      ?.replace(/\s/g, '');
    const invoiceNumber = /(?:faktura|invoice)\s*(?:nr\.?|number)?[:\s]\s*([A-Za-z0-9-]+)/i.exec(
      text,
    )?.[1];
    const invoiceDate = /(?:fakturadato|invoice date)[:\s]+(\d{4}-\d{2}-\d{2})/i.exec(text)?.[1];
    const dueDate = /(?:forfall|due date)[:\s]+(\d{4}-\d{2}-\d{2})/i.exec(text)?.[1];
    const kid = /kid[:\s]+(\d{4,25})/i.exec(text)?.[1];

    const cur = currency ?? 'NOK';
    const net = /(?:netto|net amount|subtotal)[:\s]+(?:[A-Z]{3}\s*)?([\d\s.,  ]+)/i.exec(text)?.[1];
    const vat = /(?:mva|vat)\s*(?:\d+\s*%)?[:\s]+(?:[A-Z]{3}\s*)?([\d\s.,  ]+)/i.exec(text)?.[1];
    const gross = /(?:å betale|total|totalt|amount due)[:\s]+(?:[A-Z]{3}\s*)?([\d\s.,  ]+)/i.exec(
      text,
    )?.[1];
    const vatRate = /(?:mva|vat)\s*(\d{1,2})\s*%/i.exec(text)?.[1];

    // Første ikke-tomme linje etter PDF-headerlinjene er typisk leverandørnavnet.
    const vendorName = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('%'))
      .at(0);

    const foreignService =
      /reverse charge/i.test(text) ||
      (cur !== 'NOK' && /(ireland|luxembourg|inc\.|llc|ltd|b\.v\.|gmbh)/i.test(text));

    const netMinor = net ? parseAmount(net, cur) : undefined;
    const vatMinor = vat ? parseAmount(vat, cur) : undefined;
    const grossMinor = gross ? parseAmount(gross, cur) : undefined;

    const result: ExtractedData = { documentType };
    if (vendorName !== undefined) result.vendorName = vendorName;
    if (orgNumber !== undefined) result.vendorOrgNumber = orgNumber;
    if (invoiceNumber !== undefined) result.invoiceNumber = invoiceNumber;
    if (invoiceDate !== undefined) result.invoiceDate = invoiceDate;
    if (dueDate !== undefined) result.dueDate = dueDate;
    if (kid !== undefined) result.kid = kid;
    if (currency !== undefined) result.currency = currency;
    if (netMinor !== undefined) result.netMinor = netMinor;
    if (vatMinor !== undefined) result.vatMinor = vatMinor;
    if (grossMinor !== undefined) result.grossMinor = grossMinor;
    if (foreignService) result.foreignService = true;
    if (vatRate !== undefined && netMinor !== undefined && vatMinor !== undefined) {
      result.vatBreakdown = [{ ratePct: vatRate, baseMinor: netMinor, vatMinor }];
    }
    return result;
  }
}

export class DeterministicTextExtractor implements DocumentExtractor {
  readonly name = 'deterministic-mvp';

  async extract(content: Buffer, filename: string, _mimeType: string): Promise<ExtractedData> {
    return parseDocumentText(content.toString('utf8'), filename);
  }
}
