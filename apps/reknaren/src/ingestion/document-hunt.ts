/**
 * Smart dokumentjakt. Reknaren henter allerede bilag fra flere kilder (e-post,
 * bank-feed, kvitteringsbilder, opplasting). Denne motoren lukker gapet MELLOM
 * kildene: finner betalinger uten bilag og foreslår en sannsynlig faktura vi
 * allerede har hentet inn et annet sted.
 *
 * «Vi fant en betaling til Adobe på 1 249 kr, men mangler faktura. Vi fant en
 *  sannsynlig faktura i e-posten din fra 14. juli. Skal den kobles til betalingen?»
 *
 * REN LESING og forslag — kobling krever menneskelig godkjenning.
 */
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';

export interface DocCandidate {
  documentId: string;
  vendor: string | null;
  dateText: string | null;
  grossMinor: bigint;
  score: number;
  reasons: string[];
}

export interface PaymentGap {
  transactionId: string;
  bookedDate: string;
  amountMinor: bigint; // negativt = ut
  description: string;
  counterparty: string | null;
  candidates: DocCandidate[];
}

export interface DocumentHunt {
  asOf: string;
  paymentsMissingDoc: number;
  gapsWithCandidates: number;
  gaps: PaymentGap[];
}

function tokens(s: string | null | undefined): Set<string> {
  return new Set(
    (s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9æøå ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['den', 'til', 'for', 'fra', 'faktura', 'betaling'].includes(t)),
  );
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000));
}

function nbDate(iso: string | null): string {
  if (!iso) return 'ukjent dato';
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const months = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  return `${d}. ${months[m - 1]}`;
}

export async function huntDocuments(
  db: Db,
  params: { organizationId: string; asOf: string },
): Promise<DocumentHunt> {
  const { organizationId: org, asOf } = params;

  // Betalinger uten bilag: uavstemte banktransaksjoner (penger ut).
  const txRes = await db.query(
    `SELECT id, booked_date::TEXT AS booked_date, amount_minor::TEXT AS amount_minor, description, counterparty
     FROM bank_transactions
     WHERE organization_id=$1 AND status='unmatched' AND amount_minor < 0 AND booked_date <= $2
     ORDER BY booked_date DESC`,
    [org, asOf],
  );

  // Innhentede bilag som ikke er koblet til noen postering (kandidater å koble).
  const docRes = await db.query(
    `SELECT d.id, ed.vendor_name, ed.invoice_date::TEXT AS invoice_date, ed.gross_minor::TEXT AS gross_minor
     FROM source_documents d
     JOIN LATERAL (
       SELECT vendor_name, invoice_date, gross_minor FROM extracted_document_data
       WHERE document_id = d.id ORDER BY extraction_version DESC LIMIT 1
     ) ed ON true
     WHERE d.organization_id=$1 AND ed.gross_minor IS NOT NULL AND ed.gross_minor > 0
       AND d.status <> 'quarantined'
       AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_document_id = d.id)`,
    [org],
  );
  const docs = docRes.rows.map((r) => ({
    id: r.id as string,
    vendor: (r.vendor_name as string | null) ?? null,
    dateText: (r.invoice_date as string | null) ?? null,
    grossMinor: BigInt(r.gross_minor),
  }));

  const gaps: PaymentGap[] = [];
  for (const tx of txRes.rows) {
    const amount = BigInt(tx.amount_minor);
    const absAmount = amount < 0n ? -amount : amount;
    const txText = tokens(`${tx.description} ${tx.counterparty ?? ''}`);
    const candidates: DocCandidate[] = [];
    for (const doc of docs) {
      const reasons: string[] = [];
      let score = 0;
      // Beløp — nødvendig signal.
      const diff = doc.grossMinor > absAmount ? doc.grossMinor - absAmount : absAmount - doc.grossMinor;
      if (diff === 0n) {
        score += 50;
        reasons.push(`Samme beløp (${formatMinorAsKr(absAmount)} kr)`);
      } else if (diff * 100n <= absAmount * 2n) {
        score += 25;
        reasons.push(`Nesten samme beløp (${formatMinorAsKr(doc.grossMinor)} kr)`);
      } else {
        continue; // beløp for langt unna → ikke en kandidat
      }
      // Leverandør/tekst.
      const docTokens = tokens(doc.vendor);
      const overlap = [...docTokens].filter((t) => txText.has(t));
      if (overlap.length > 0) {
        score += 30;
        reasons.push(`Leverandør «${doc.vendor}» matcher betalingsteksten`);
      }
      // Dato.
      if (doc.dateText) {
        const dd = daysBetween(doc.dateText, tx.booked_date);
        if (dd <= 3) {
          score += 20;
          reasons.push(`Fakturadato ${nbDate(doc.dateText)}, ${dd} dag${dd === 1 ? '' : 'er'} fra betalingen`);
        } else if (dd <= 10) {
          score += 10;
          reasons.push(`Fakturadato ${nbDate(doc.dateText)}, innen ti dager fra betalingen`);
        } else if (dd <= 30) {
          score += 5;
          reasons.push(`Fakturadato ${nbDate(doc.dateText)}`);
        }
      }
      if (score >= 50) {
        candidates.push({ documentId: doc.id, vendor: doc.vendor, dateText: doc.dateText, grossMinor: doc.grossMinor, score, reasons });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((x, y) => y.score - x.score);
      gaps.push({
        transactionId: tx.id,
        bookedDate: tx.booked_date,
        amountMinor: amount,
        description: tx.description,
        counterparty: (tx.counterparty as string | null) ?? null,
        candidates: candidates.slice(0, 3),
      });
    }
  }
  gaps.sort((a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0));

  return {
    asOf,
    paymentsMissingDoc: txRes.rowCount ?? 0,
    gapsWithCandidates: gaps.length,
    gaps,
  };
}
