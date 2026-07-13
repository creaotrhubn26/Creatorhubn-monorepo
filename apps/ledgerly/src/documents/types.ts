export type DocumentSource = 'gmail' | 'upload' | 'mobile' | 'forward' | 'integration';

export type DocumentStatus =
  | 'received'
  | 'scanning'
  | 'extracted'
  | 'needs_review' // avvikskø
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'duplicate'
  | 'quarantined'; // mistenkelig innhold (f.eks. prompt injection)

export type DocumentType =
  | 'receipt'
  | 'supplier_invoice'
  | 'credit_note'
  | 'order_confirmation'
  | 'payment_confirmation'
  | 'customs'
  | 'unknown';

export interface SourceDocument {
  id: string;
  organizationId: string;
  source: DocumentSource;
  gmailMessageId?: string;
  gmailAttachmentId?: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  status: DocumentStatus;
  duplicateOf?: string;
}

export interface VatBreakdownLine {
  ratePct: string;
  baseMinor: bigint;
  vatMinor: bigint;
}

export interface ExtractedData {
  documentType: DocumentType;
  vendorName?: string;
  vendorOrgNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  kid?: string;
  bankAccount?: string;
  currency?: string;
  netMinor?: bigint;
  vatMinor?: bigint;
  grossMinor?: bigint;
  vatBreakdown?: VatBreakdownLine[];
  lineItems?: { description: string; amountMinor: bigint }[];
  purchaseCountry?: string;
  foreignService?: boolean;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'warning' | 'error';
}
