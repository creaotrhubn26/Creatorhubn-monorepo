/**
 * SourceConnector-porten: en inngående data-connector normaliserer eksterne
 * poster (betalinger, bilag) til `ConnectorRecord` som synk-motoren fører inn i
 * bilagsinnboksen — idempotent, aldri autobokført. Samme ærlige status/stub-
 * disiplin som resten av integrasjonene: uten legitimasjon er connectoren
 * `configured=false` og henter aldri noe.
 */

/** En normalisert post fra en ekstern kilde → blir ett bilag. */
export interface ConnectorRecord {
  /** Kildens stabile id (idempotensnøkkel), f.eks. Stripe ch_…. */
  externalId: string;
  /** Kort beskrivelse (blir bilagets navn/leverandør). */
  summary: string;
  occurredAt: string; // ISO yyyy-mm-dd
  amountMinor: bigint;
  currency: string;
  vendorName: string | null;
  documentType: 'receipt' | 'supplier_invoice' | 'payment_confirmation';
  /** Menneskelesbart kvitteringsinnhold som lagres som bilagets fil (XML). */
  receiptXml: string;
}

export interface ConnectorFetch {
  records: ConnectorRecord[];
  /** Ny synk-markør å lagre (f.eks. seneste unix-sekund). Uendret om null. */
  nextCursor: string | null;
}

export interface SourceConnector {
  /** Stabil id brukt i URL/DB, f.eks. 'stripe-charges'. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Er kilden konfigurert (legitimasjon finnes)? Ærlig status. */
  configured(): boolean;
  /** Hent nye poster siden `cursor` (unix-sekunder e.l.). */
  fetch(cursor: string | null): Promise<ConnectorFetch>;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Bygger et enkelt, velformet XML-kvitteringsbilag (application/xml er tillatt bilagsformat). */
export function receiptXml(fields: {
  source: string;
  externalId: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  vendorName?: string | null;
  extra?: Record<string, string | null>;
}): string {
  const amount = `${(fields.amountMinor < 0n ? -fields.amountMinor : fields.amountMinor).toString().replace(/(\d\d)$/, '.$1')}`;
  const extra = Object.entries(fields.extra ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `  <${k}>${esc(String(v))}</${k}>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Receipt source="${esc(fields.source)}">
  <ExternalId>${esc(fields.externalId)}</ExternalId>
  <Date>${esc(fields.date)}</Date>
  <Amount currency="${esc(fields.currency)}">${amount}</Amount>
  <Description>${esc(fields.description)}</Description>
${fields.vendorName ? `  <Vendor>${esc(fields.vendorName)}</Vendor>\n` : ''}${extra ? extra + '\n' : ''}</Receipt>
`;
}
