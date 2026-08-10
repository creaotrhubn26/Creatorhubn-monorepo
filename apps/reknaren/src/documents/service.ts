/**
 * Dokumenttjeneste: mottak, integritetssjekk (sha256), duplikatkontroll
 * og lagring av strukturert uttrekk. Samme faktura skal aldri bokføres to ganger,
 * uansett om den kommer via Gmail, opplasting eller mobil.
 */
import { createHash } from 'node:crypto';
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { newId } from '../shared/ids.js';
import { NotFoundError } from '../shared/errors.js';
import type { ObjectStorage } from '../storage/port.js';
import type { DocumentSource, DocumentStatus, ExtractedData, ValidationIssue } from './types.js';

export function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

export interface RegisterDocumentInput {
  organizationId: string;
  actor: Actor;
  source: DocumentSource;
  filename: string;
  mimeType: string;
  content: Buffer;
  gmailMessageId?: string;
  gmailAttachmentId?: string;
  /** Nøkkel i objektlager. I MVP genereres en lokal nøkkel. */
  storageKey?: string;
}

export interface RegisteredDocument {
  id: string;
  sha256: string;
  status: DocumentStatus;
  duplicateOf?: string;
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'text/xml', // EHF
  'application/xml',
]);

export async function registerDocument(
  db: Db,
  input: RegisterDocumentInput,
  storage?: ObjectStorage,
): Promise<RegisteredDocument> {
  const hash = sha256Hex(input.content);
  return withTransaction(db, async (client) => {
    // Duplikat på innhold: samme bytes er alltid samme bilag.
    const byHash = await client.query(
      `SELECT id FROM source_documents
       WHERE organization_id = $1 AND sha256 = $2 AND status <> 'rejected'
       LIMIT 1`,
      [input.organizationId, hash],
    );
    // Duplikat på Gmail-id: samme vedlegg i samme melding importeres én gang.
    if (input.gmailMessageId) {
      const byGmail = await client.query(
        `SELECT id, status FROM source_documents
         WHERE organization_id = $1 AND gmail_message_id = $2
           AND gmail_attachment_id IS NOT DISTINCT FROM $3
         LIMIT 1`,
        [input.organizationId, input.gmailMessageId, input.gmailAttachmentId ?? null],
      );
      if (byGmail.rowCount) {
        // Idempotent re-import: samme Gmail-vedlegg gir ikke ny rad.
        await recordAuditEvent(client, {
          organizationId: input.organizationId,
          actor: input.actor,
          action: 'document.duplicate_detected',
          entityType: 'source_document',
          entityId: byGmail.rows[0].id,
          reason: 'Samme Gmail-melding og vedlegg er allerede importert.',
          newValue: { gmailMessageId: input.gmailMessageId },
        });
        return { id: byGmail.rows[0].id, sha256: hash, status: 'duplicate', duplicateOf: byGmail.rows[0].id };
      }
    }
    const duplicateOf: string | undefined = byHash.rowCount ? byHash.rows[0].id : undefined;

    const id = newId();
    const status: DocumentStatus = ALLOWED_MIME.has(input.mimeType)
      ? duplicateOf
        ? 'duplicate'
        : 'received'
      : 'quarantined';

    // Dokumentinnholdet lagres i objektlageret FØR databaseraden committes —
    // feiler lagringen, rulles hele mottaket tilbake. Bilag skal aldri kunne
    // finnes i regnskapet uten at innholdet er oppbevart (bokføringsloven).
    const storageKey = input.storageKey ?? `org/${input.organizationId}/doc/${id}`;
    if (storage) {
      await storage.put(storageKey, input.content, input.mimeType);
    }

    await client.query(
      `INSERT INTO source_documents
         (id, organization_id, source, gmail_message_id, gmail_attachment_id,
          filename, mime_type, byte_size, sha256, storage_key, status, duplicate_of, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        input.organizationId,
        input.source,
        input.gmailMessageId ?? null,
        input.gmailAttachmentId ?? null,
        input.filename,
        input.mimeType,
        input.content.length,
        hash,
        storageKey,
        status,
        duplicateOf ?? null,
        input.actor.userId,
      ],
    );
    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: `document.${status === 'duplicate' ? 'duplicate_detected' : status === 'quarantined' ? 'quarantined' : 'received'}`,
      entityType: 'source_document',
      entityId: id,
      newValue: { filename: input.filename, sha256: hash, source: input.source, duplicateOf },
    });
    const result: RegisteredDocument = { id, sha256: hash, status };
    if (duplicateOf !== undefined) result.duplicateOf = duplicateOf;
    return result;
  });
}

/**
 * Duplikat på forretningsnøkkel: samme leverandør + fakturanummer + beløp
 * fanger duplikater der filene er ulike (f.eks. skann vs. PDF).
 */
export async function findBusinessKeyDuplicate(
  db: Db,
  organizationId: string,
  data: ExtractedData,
  excludeDocumentId: string,
): Promise<string | null> {
  if (!data.invoiceNumber || !data.vendorName || data.grossMinor === undefined) return null;
  const res = await db.query(
    `SELECT e.document_id FROM extracted_document_data e
     JOIN source_documents d ON d.id = e.document_id
     WHERE e.organization_id = $1
       AND e.invoice_number = $2
       AND lower(e.vendor_name) = lower($3)
       AND e.gross_minor = $4
       AND e.document_id <> $5
       AND d.status NOT IN ('rejected','duplicate')
     LIMIT 1`,
    [organizationId, data.invoiceNumber, data.vendorName, data.grossMinor.toString(), excludeDocumentId],
  );
  return res.rowCount ? res.rows[0].document_id : null;
}

export async function storeExtraction(
  db: Db,
  params: {
    organizationId: string;
    documentId: string;
    actor: Actor;
    data: ExtractedData;
    issues: ValidationIssue[];
    engine?: string;
  },
): Promise<{ extractionId: string; documentStatus: DocumentStatus }> {
  const { organizationId, documentId, actor, data, issues } = params;
  return withTransaction(db, async (client) => {
    const doc = await client.query(
      `SELECT status FROM source_documents WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [documentId, organizationId],
    );
    if (!doc.rowCount) throw new NotFoundError('Dokumentet finnes ikke.');

    const extractionId = newId();
    const hasErrors = issues.some((i) => i.severity === 'error');
    await client.query(
      `INSERT INTO extracted_document_data
         (id, document_id, organization_id, document_type, vendor_name, vendor_org_number,
          invoice_number, invoice_date, due_date, kid, bank_account, currency,
          net_minor, vat_minor, gross_minor, vat_breakdown, line_items,
          purchase_country, foreign_service, extraction_engine, validation_status, validation_issues)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        extractionId,
        documentId,
        organizationId,
        data.documentType,
        data.vendorName ?? null,
        data.vendorOrgNumber ?? null,
        data.invoiceNumber ?? null,
        data.invoiceDate ?? null,
        data.dueDate ?? null,
        data.kid ?? null,
        data.bankAccount ?? null,
        data.currency ?? null,
        data.netMinor?.toString() ?? null,
        data.vatMinor?.toString() ?? null,
        data.grossMinor?.toString() ?? null,
        data.vatBreakdown
          ? JSON.stringify(
              data.vatBreakdown.map((v) => ({
                ratePct: v.ratePct,
                baseMinor: v.baseMinor.toString(),
                vatMinor: v.vatMinor.toString(),
              })),
            )
          : null,
        data.lineItems
          ? JSON.stringify(
              data.lineItems.map((l) => ({ description: l.description, amountMinor: l.amountMinor.toString() })),
            )
          : null,
        data.purchaseCountry ?? null,
        data.foreignService ?? null,
        params.engine ?? 'deterministic-mvp',
        hasErrors ? 'discrepancy' : 'valid',
        JSON.stringify(issues),
      ],
    );

    const newStatus: DocumentStatus = hasErrors ? 'needs_review' : 'extracted';
    await client.query(
      `UPDATE source_documents SET status = $3, updated_at = now(), version = version + 1
       WHERE id = $1 AND organization_id = $2`,
      [documentId, organizationId, newStatus],
    );
    await recordAuditEvent(client, {
      organizationId,
      actor,
      action: hasErrors ? 'document.sent_to_review_queue' : 'document.extracted',
      entityType: 'source_document',
      entityId: documentId,
      previousValue: { status: doc.rows[0].status },
      newValue: { status: newStatus, issues },
    });
    return { extractionId, documentStatus: newStatus };
  });
}

export async function markDocumentStatus(
  db: Db,
  params: {
    organizationId: string;
    documentId: string;
    actor: Actor;
    status: DocumentStatus;
    reason?: string;
  },
): Promise<void> {
  await withTransaction(db, async (client) => {
    const doc = await client.query(
      `SELECT status FROM source_documents WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [params.documentId, params.organizationId],
    );
    if (!doc.rowCount) throw new NotFoundError('Dokumentet finnes ikke.');
    await client.query(
      `UPDATE source_documents SET status = $3, updated_at = now(), version = version + 1
       WHERE id = $1 AND organization_id = $2`,
      [params.documentId, params.organizationId, params.status],
    );
    const audit: Parameters<typeof recordAuditEvent>[1] = {
      organizationId: params.organizationId,
      actor: params.actor,
      action: `document.status_changed`,
      entityType: 'source_document',
      entityId: params.documentId,
      previousValue: { status: doc.rows[0].status },
      newValue: { status: params.status },
    };
    if (params.reason !== undefined) audit.reason = params.reason;
    await recordAuditEvent(client, audit);
  });
}
