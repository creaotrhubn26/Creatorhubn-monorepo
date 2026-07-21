/**
 * Gmail-integrasjonen ligger bak dette grensesnittet. Produksjonsadapteren
 * bruker Gmail API / Google Workspace MCP med OAuth 2.0 og minst mulig scope
 * (gmail.readonly). Sandbox-adapteren brukes i test og når ekte nøkler mangler —
 * integrasjonen presenteres da ALDRI som aktiv i UI/API (se integration-status).
 */

export interface GmailSearchFilter {
  /** Brukervalgt: bare disse etikettene skannes. Tom liste = ingen skanning. */
  labels: string[];
  /** Brukervalgte avsendere (valgfritt innsnevring). */
  senders?: string[];
  afterDate?: string; // ISO
  beforeDate?: string; // ISO
  /** Søkeord som kombineres med resten (invoice, kvittering, faktura, …). */
  keywords?: string[];
}

export interface GmailAttachmentRef {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface GmailMessageSummary {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  /** Kort tekstutdrag — behandles alltid som UBETRODD data. */
  snippet: string;
  attachments: GmailAttachmentRef[];
}

export type GmailConnectionState = 'active' | 'expired' | 'revoked' | 'disconnected';

export class GmailAuthError extends Error {
  constructor(
    message: string,
    readonly state: Exclude<GmailConnectionState, 'active'>,
  ) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

export interface GmailPort {
  /** Tilstand for tilkoblingen. Kastes GmailAuthError fra andre kall når ikke 'active'. */
  connectionState(): Promise<GmailConnectionState>;
  /** Søker KUN innenfor brukerens valgte filter. Leser aldri hele postkassen. */
  searchMessages(filter: GmailSearchFilter): Promise<GmailMessageSummary[]>;
  fetchAttachment(ref: GmailAttachmentRef): Promise<Buffer>;
}
