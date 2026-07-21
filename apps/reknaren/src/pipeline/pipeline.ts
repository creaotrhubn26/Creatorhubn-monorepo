/**
 * Bilagspipelinen — den vertikale flyten:
 * innhenting → filkontroll → uttrekk → validering → duplikatkontroll →
 * forslag → menneskelig godkjenning → bokføring → rapporter.
 *
 * AI/heuristikk FORESLÅR. Bokføringsmotoren BEREGNER. Mennesker GODKJENNER.
 * Ingen usikker transaksjon posteres automatisk.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import {
  findBusinessKeyDuplicate,
  markDocumentStatus,
  registerDocument,
  storeExtraction,
} from '../documents/service.js';
import type { ExtractedData } from '../documents/types.js';
import { validateExtraction } from '../documents/validate.js';
import { assertDimensionExists } from '../dimensions/service.js';
import { GmailAuthError, type GmailPort, type GmailSearchFilter } from '../ingestion/gmail/port.js';
import type { ObjectStorage } from '../storage/port.js';
import { sanitizeUntrustedText } from '../ingestion/gmail/sanitize.js';
import { postJournalEntry, type PostedJournalEntry } from '../ledger/engine.js';
import type { RuleRegister } from '../rules/register.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../shared/errors.js';
import { convertToNok, money } from '../shared/money.js';
import { newId } from '../shared/ids.js';
import { splitGrossByVatCode, vatOfNet } from '../vat/engine.js';
import type { DocumentExtractor } from './extract.js';
import {
  postingSuggestionSchema,
  type PostingSuggestion,
  type SuggestionEngine,
} from './suggest.js';
import { getVatCode } from '../coa/vat-codes.js';

export interface PipelineDeps {
  db: Db;
  rules: RuleRegister;
  extractor: DocumentExtractor;
  suggestionEngine: SuggestionEngine;
  /** Objektlager for dokumentinnhold. Uten lager beholdes kun hash + metadata. */
  storage?: ObjectStorage | undefined;
}

export interface IngestResultItem {
  documentId: string;
  filename: string;
  status: string;
  suggestionId?: string;
  issues?: { code: string; message: string; severity: string }[];
  quarantineReason?: string;
}

export interface GmailIngestSummary {
  scannedMessages: number;
  importedDocuments: IngestResultItem[];
  connectionState: string;
}

/**
 * Importerer dokumenter fra Gmail innenfor brukerens valgte filter.
 * Tilbakekalt/utløpt token stopper synkronisering kontrollert — tidligere
 * godkjente bilag berøres ikke.
 */
export async function ingestFromGmail(
  deps: PipelineDeps,
  params: {
    organizationId: string;
    actor: Actor;
    gmail: GmailPort;
    filter: GmailSearchFilter;
    vatStatus: 'registered' | 'not_registered' | 'pending';
  },
): Promise<GmailIngestSummary> {
  let messages;
  try {
    messages = await params.gmail.searchMessages(params.filter);
  } catch (err) {
    if (err instanceof GmailAuthError) {
      await withTransaction(deps.db, async (client) => {
        await client.query(
          `UPDATE integration_connections SET status = $2, updated_at = now()
           WHERE organization_id = $1 AND provider = 'gmail' AND status = 'active'`,
          [params.organizationId, err.state],
        );
        await recordAuditEvent(client, {
          organizationId: params.organizationId,
          actor: params.actor,
          action: 'integration.gmail.sync_stopped',
          entityType: 'integration_connection',
          reason: err.message,
          newValue: { state: err.state },
        });
      });
      return { scannedMessages: 0, importedDocuments: [], connectionState: err.state };
    }
    throw err;
  }

  const imported: IngestResultItem[] = [];
  for (const message of messages) {
    for (const attachment of message.attachments) {
      const content = await params.gmail.fetchAttachment(attachment);
      const item = await processIncomingDocument(deps, {
        organizationId: params.organizationId,
        actor: params.actor,
        source: 'gmail',
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        content,
        gmailMessageId: message.messageId,
        gmailAttachmentId: attachment.attachmentId,
        vatStatus: params.vatStatus,
      });
      imported.push(item);
    }
  }
  return {
    scannedMessages: messages.length,
    importedDocuments: imported,
    connectionState: 'active',
  };
}

/** Felles flyt for gmail/opplasting/mobil: registrer → skann → uttrekk → valider → forslå. */
export async function processIncomingDocument(
  deps: PipelineDeps,
  params: {
    organizationId: string;
    actor: Actor;
    source: 'gmail' | 'upload' | 'mobile' | 'forward';
    filename: string;
    mimeType: string;
    content: Buffer;
    gmailMessageId?: string;
    gmailAttachmentId?: string;
    vatStatus: 'registered' | 'not_registered' | 'pending';
  },
): Promise<IngestResultItem> {
  const registerInput: Parameters<typeof registerDocument>[1] = {
    organizationId: params.organizationId,
    actor: params.actor,
    source: params.source,
    filename: params.filename,
    mimeType: params.mimeType,
    content: params.content,
  };
  if (params.gmailMessageId !== undefined) registerInput.gmailMessageId = params.gmailMessageId;
  if (params.gmailAttachmentId !== undefined)
    registerInput.gmailAttachmentId = params.gmailAttachmentId;
  const doc = await registerDocument(deps.db, registerInput, deps.storage);
  if (doc.status === 'duplicate' || doc.status === 'quarantined') {
    return { documentId: doc.id, filename: params.filename, status: doc.status };
  }

  // Sikkerhetskontroll av innhold: prompt-injection og skadelige mønstre.
  const scan = sanitizeUntrustedText(params.content.toString('utf8'));
  if (scan.suspicious) {
    await markDocumentStatus(deps.db, {
      organizationId: params.organizationId,
      documentId: doc.id,
      actor: params.actor,
      status: 'quarantined',
      reason: `Mistenkelig innhold: ${scan.matches.join('; ')}`,
    });
    return {
      documentId: doc.id,
      filename: params.filename,
      status: 'quarantined',
      quarantineReason: 'Dokumentet inneholder mønstre som ligner manipulasjonsforsøk og må kontrolleres manuelt.',
    };
  }

  const data = await deps.extractor.extract(params.content, params.filename, params.mimeType);

  // Sikkerhetskontroll også av det uttrekksmotoren faktisk LESTE (OCR-tekst
  // fra bilder er usynlig i bytekontrollen over).
  if (data.rawText) {
    const textScan = sanitizeUntrustedText(data.rawText);
    if (textScan.suspicious) {
      await markDocumentStatus(deps.db, {
        organizationId: params.organizationId,
        documentId: doc.id,
        actor: params.actor,
        status: 'quarantined',
        reason: `Mistenkelig innhold i tolket tekst: ${textScan.matches.join('; ')}`,
      });
      return {
        documentId: doc.id,
        filename: params.filename,
        status: 'quarantined',
        quarantineReason:
          'Den tolkede teksten inneholder mønstre som ligner manipulasjonsforsøk og må kontrolleres manuelt.',
      };
    }
    delete data.rawText; // persisteres aldri
  }

  const issues = validateExtraction(deps.rules, data);

  // Duplikat på forretningsnøkkel (leverandør + fakturanr + beløp).
  const businessDupe = await findBusinessKeyDuplicate(deps.db, params.organizationId, data, doc.id);
  if (businessDupe) {
    await storeExtraction(deps.db, {
      organizationId: params.organizationId,
      documentId: doc.id,
      actor: params.actor,
      data,
      issues,
      engine: deps.extractor.name,
    });
    await markDocumentStatus(deps.db, {
      organizationId: params.organizationId,
      documentId: doc.id,
      actor: params.actor,
      status: 'duplicate',
      reason: `Samme fakturanummer, leverandør og beløp som dokument ${businessDupe}.`,
    });
    return { documentId: doc.id, filename: params.filename, status: 'duplicate' };
  }

  const { documentStatus } = await storeExtraction(deps.db, {
    organizationId: params.organizationId,
    documentId: doc.id,
    actor: params.actor,
    data,
    issues,
    engine: deps.extractor.name,
  });

  if (documentStatus === 'needs_review') {
    return {
      documentId: doc.id,
      filename: params.filename,
      status: documentStatus,
      issues,
    };
  }

  // Leverandørhistorikk som kontekst for forslaget.
  const vendorDefaults = await lookupVendorDefaults(deps.db, params.organizationId, data);
  const suggestion = await deps.suggestionEngine.suggest(data, {
    rules: deps.rules,
    vatStatus: params.vatStatus,
    isoDate: data.invoiceDate ?? new Date().toISOString().slice(0, 10),
    ...(vendorDefaults ? { vendorDefaults } : {}),
  });
  // Forsvar i dybden: også deterministiske forslag valideres mot skjema.
  const validated = postingSuggestionSchema.parse(suggestion);

  const suggestionId = newId();
  await withTransaction(deps.db, async (client) => {
    await client.query(
      `INSERT INTO posting_suggestions (id, organization_id, document_id, suggestion, engine)
       VALUES ($1,$2,$3,$4,$5)`,
      [suggestionId, params.organizationId, doc.id, JSON.stringify(validated), deps.suggestionEngine.name],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: null, // systemgenerert forslag
      action: 'posting_suggestion.created',
      entityType: 'posting_suggestion',
      entityId: suggestionId,
      newValue: { documentId: doc.id, engine: deps.suggestionEngine.name },
    });
  });

  return {
    documentId: doc.id,
    filename: params.filename,
    status: documentStatus,
    suggestionId,
    issues,
  };
}

async function lookupVendorDefaults(
  db: Db,
  organizationId: string,
  data: ExtractedData,
): Promise<{ accountNumber?: string; vatCode?: string } | undefined> {
  if (!data.vendorName) return undefined;
  const res = await db.query(
    `SELECT default_account_number, default_vat_code FROM vendors
     WHERE organization_id = $1 AND (lower(name) = lower($2) OR (org_number IS NOT NULL AND org_number = $3))
     LIMIT 1`,
    [organizationId, data.vendorName, data.vendorOrgNumber ?? null],
  );
  if (!res.rowCount) return undefined;
  const defaults: { accountNumber?: string; vatCode?: string } = {};
  if (res.rows[0].default_account_number) defaults.accountNumber = res.rows[0].default_account_number;
  if (res.rows[0].default_vat_code) defaults.vatCode = res.rows[0].default_vat_code;
  return defaults;
}

export interface ApproveAndPostInput {
  organizationId: string;
  actor: Actor;
  actorRoleVerified: boolean; // settes av API-laget etter RBAC-sjekk
  documentId: string;
  suggestionId: string;
  /** Brukeren kan overstyre forslaget ved godkjenning. */
  overrides?: {
    accountNumber?: string | undefined;
    vatCode?: string | undefined;
    businessUsePercentage?: number | undefined;
    /** Kostnadsbærere — valideres mot dimensjonsregisteret. */
    project?: string | undefined;
    department?: string | undefined;
  };
  /** Kreves for dokumenter i utenlandsk valuta. */
  exchangeRate?: { rateDecimal: string; source: string };
  postingDate?: string;
}

/**
 * Menneskelig godkjenning → bokføring. Bygger balanserte posteringslinjer
 * deterministisk fra uttrekk + godkjent forslag, med komplett kontrollspor
 * dokument ↔ forslag ↔ postering.
 */
export async function approveAndPost(
  deps: PipelineDeps,
  input: ApproveAndPostInput,
): Promise<PostedJournalEntry> {
  if (!input.actorRoleVerified) {
    throw new ForbiddenError('Godkjenning krever verifisert rolle med bokføringsrettighet.');
  }
  const docRes = await deps.db.query(
    `SELECT d.status, e.document_type, e.vendor_name, e.vendor_org_number, e.invoice_number,
            e.invoice_date::TEXT AS invoice_date, e.currency, e.net_minor, e.vat_minor, e.gross_minor
     FROM source_documents d
     JOIN extracted_document_data e ON e.document_id = d.id
     WHERE d.id = $1 AND d.organization_id = $2
     ORDER BY e.extraction_version DESC
     LIMIT 1`,
    [input.documentId, input.organizationId],
  );
  if (!docRes.rowCount) throw new NotFoundError('Dokument eller uttrekk finnes ikke.');
  const doc = docRes.rows[0];
  if (!['extracted', 'needs_review', 'approved'].includes(doc.status)) {
    throw new ValidationError(`Dokumentet kan ikke bokføres fra status «${doc.status}».`);
  }

  const sugRes = await deps.db.query(
    `SELECT suggestion, status FROM posting_suggestions
     WHERE id = $1 AND organization_id = $2 AND document_id = $3`,
    [input.suggestionId, input.organizationId, input.documentId],
  );
  if (!sugRes.rowCount) throw new NotFoundError('Forslaget finnes ikke for dette dokumentet.');
  if (sugRes.rows[0].status !== 'proposed') {
    throw new ValidationError('Forslaget er allerede behandlet.');
  }
  const suggestion: PostingSuggestion = postingSuggestionSchema.parse(sugRes.rows[0].suggestion);

  const accountNumber = input.overrides?.accountNumber ?? suggestion.suggestedAccountNumber;
  const vatCodeStr = input.overrides?.vatCode ?? suggestion.suggestedVatCode;
  const vatCode = getVatCode(vatCodeStr);
  if (!vatCode) throw new ValidationError(`Ukjent mva-kode: ${vatCodeStr}`);
  const businessUse = BigInt(
    input.overrides?.businessUsePercentage ?? suggestion.businessUsePercentage,
  );
  // Dimensjoner valideres mot registeret og settes på kostnadslinjene.
  const dims: { project?: string; department?: string } = {};
  if (input.overrides?.project) {
    const code = input.overrides.project.toUpperCase();
    await assertDimensionExists(deps.db, input.organizationId, 'project', code);
    dims.project = code;
  }
  if (input.overrides?.department) {
    const code = input.overrides.department.toUpperCase();
    await assertDimensionExists(deps.db, input.organizationId, 'department', code);
    dims.department = code;
  }
  if (businessUse < 0n || businessUse > 100n) {
    throw new ValidationError('Næringsandel må være mellom 0 og 100 prosent.');
  }

  const currency: string = doc.currency ?? 'NOK';
  const grossOriginal: bigint | null = doc.gross_minor === null ? null : BigInt(doc.gross_minor);
  if (grossOriginal === null) {
    throw new ValidationError('Dokumentet mangler totalbeløp og kan ikke bokføres.');
  }
  // invoice_date hentes som ::TEXT fra databasen — aldri som JS Date, som ville
  // gitt tidssoneavhengig dato (UTC-konvertering kan flytte bilaget en dag/periode).
  const invoiceDate: string =
    input.postingDate ?? doc.invoice_date ?? new Date().toISOString().slice(0, 10);

  // Valuta: alt bokføres i NOK med lagret originalvaluta, kurs og kilde.
  let grossNok = grossOriginal;
  let fxInfo: { originalCurrency: string; originalAmountMinor: bigint; exchangeRate: string; exchangeRateSource: string } | undefined;
  if (currency !== 'NOK') {
    if (!input.exchangeRate) {
      throw new ValidationError(
        `Dokumentet er i ${currency}. Oppgi valutakurs med kilde for å bokføre.`,
      );
    }
    grossNok = convertToNok(money(grossOriginal, currency), input.exchangeRate.rateDecimal).minorUnits;
    fxInfo = {
      originalCurrency: currency,
      originalAmountMinor: grossOriginal,
      exchangeRate: input.exchangeRate.rateDecimal,
      exchangeRateSource: input.exchangeRate.source,
    };
  }

  // Næringsandel: bare næringsdelen bokføres som kostnad/fradrag; resten er privat (2060).
  const businessGross = (grossNok * businessUse) / 100n;
  const privateGross = grossNok - businessGross;

  const lines: Parameters<typeof postJournalEntry>[1]['lines'] = [];
  const vendorId = await ensureVendor(deps.db, input.organizationId, input.actor, doc);

  if (vatCode.reverseCharge) {
    // Omvendt avgiftsplikt (f.eks. kode 86): beregn norsk mva av grunnlaget,
    // bokfør både utgående og (ved fradragsrett) inngående.
    const basis = businessGross;
    const calc = vatOfNet(deps.rules, vatCodeStr, basis, invoiceDate);
    lines.push({
      accountNumber,
      debitMinor: basis,
      vatCode: vatCodeStr,
      ...(doc.vendor_name ? { description: doc.vendor_name } : {}),
      ...(fxInfo ?? {}),
      ...dims,
    });
    if (vatCode.deductible) {
      lines.push({ accountNumber: '2710', debitMinor: calc.vatMinor, vatCode: vatCodeStr, description: 'Inngående mva, omvendt avgiftsplikt' });
    } else {
      lines.push({ accountNumber, debitMinor: calc.vatMinor, vatCode: vatCodeStr, description: 'Ikke-fradragsberettiget mva, omvendt avgiftsplikt' });
    }
    lines.push({ accountNumber: '2700', creditMinor: calc.vatMinor, vatCode: vatCodeStr, description: 'Utgående mva, omvendt avgiftsplikt' });
    if (privateGross > 0n) lines.push({ accountNumber: '2060', debitMinor: privateGross, description: 'Privat andel' });
    lines.push({ accountNumber: '2400', creditMinor: grossNok, vendorId, description: doc.invoice_number ? `Faktura ${doc.invoice_number}` : undefined });
  } else if (vatCode.direction === 'input' && vatCode.deductible) {
    // Innenlands kjøp med fradrag: splitt brutto i netto + mva per sats fra regelregisteret.
    const parts = splitGrossByVatCode(deps.rules, vatCodeStr, businessGross, invoiceDate);
    lines.push({ accountNumber, debitMinor: parts.netMinor, vatCode: vatCodeStr, description: doc.vendor_name ?? undefined, ...(fxInfo ?? {}), ...dims });
    if (parts.vatMinor > 0n) {
      lines.push({ accountNumber: '2710', debitMinor: parts.vatMinor, vatCode: vatCodeStr, description: `Inngående mva ${parts.ratePct} %` });
    }
    if (privateGross > 0n) lines.push({ accountNumber: '2060', debitMinor: privateGross, description: 'Privat andel' });
    lines.push({ accountNumber: '2400', creditMinor: grossNok, vendorId, description: doc.invoice_number ? `Faktura ${doc.invoice_number}` : undefined });
  } else {
    // Uten fradrag/mva-behandling: hele beløpet er kostnad (næringsdelen).
    if (businessGross > 0n) {
      lines.push({ accountNumber, debitMinor: businessGross, vatCode: vatCodeStr, description: doc.vendor_name ?? undefined, ...(fxInfo ?? {}), ...dims });
    }
    if (privateGross > 0n) lines.push({ accountNumber: '2060', debitMinor: privateGross, description: 'Privat andel' });
    lines.push({ accountNumber: '2400', creditMinor: grossNok, vendorId, description: doc.invoice_number ? `Faktura ${doc.invoice_number}` : undefined });
  }

  const entry = await postJournalEntry(deps.db, {
    organizationId: input.organizationId,
    actor: input.actor,
    entryDate: invoiceDate,
    description: `${doc.vendor_name ?? 'Ukjent leverandør'}${doc.invoice_number ? ` — faktura ${doc.invoice_number}` : ''}`,
    lines,
    idempotencyKey: `document:${input.documentId}`,
    sourceDocumentId: input.documentId,
  });

  await withTransaction(deps.db, async (client) => {
    await client.query(
      `UPDATE posting_suggestions SET status = 'approved', decided_by = $2, decided_at = now()
       WHERE id = $1 AND status = 'proposed'`,
      [input.suggestionId, input.actor.userId],
    );
    await client.query(
      `UPDATE source_documents SET status = 'posted', updated_at = now(), version = version + 1
       WHERE id = $1 AND organization_id = $2`,
      [input.documentId, input.organizationId],
    );
    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'document.approved_and_posted',
      entityType: 'source_document',
      entityId: input.documentId,
      newValue: {
        journalEntryId: entry.id,
        entryNumber: entry.entryNumber,
        suggestionId: input.suggestionId,
        overrides: input.overrides ?? null,
      },
    });
  });

  return entry;
}

async function ensureVendor(
  db: Db,
  organizationId: string,
  actor: Actor,
  doc: { vendor_name: string | null; vendor_org_number: string | null },
): Promise<string | undefined> {
  if (!doc.vendor_name) return undefined;
  const existing = await db.query(
    `SELECT id FROM vendors WHERE organization_id = $1 AND lower(name) = lower($2) LIMIT 1`,
    [organizationId, doc.vendor_name],
  );
  if (existing.rowCount) return existing.rows[0].id;
  const id = newId();
  await db.query(
    `INSERT INTO vendors (id, organization_id, name, org_number, created_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, organizationId, doc.vendor_name, doc.vendor_org_number, actor.userId],
  );
  return id;
}
