/**
 * Ekte Gmail-adapter via IMAP med app-passord (samme konto Reknaren allerede sender
 * fra). Leser KUN innenfor brukerens valgte etiketter/filter, plukker ut PDF- og
 * bilde-vedlegg (kvitteringer/fakturaer) og mater dem inn i samme bilags-pipeline
 * (sanitering, duplikat, karantene, forslag) som resten. Ligger bak samme
 * `GmailPort` — sandbox brukes fortsatt når app-passord mangler.
 *
 * App-passordet gir kun IMAP/SMTP-tilgang (ikke full konto). Vi leser aldri hele
 * postkassen: tom etikettliste = ingen skanning.
 */
import type {
  GmailAttachmentRef,
  GmailConnectionState,
  GmailMessageSummary,
  GmailPort,
  GmailSearchFilter,
} from './port.js';
import { GmailAuthError } from './port.js';

export interface ImapGmailConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Plukker PDF/bilde-vedlegg ut av en IMAP bodyStructure (rekursivt over multipart). */
export function collectAttachments(node: any, out: { part: string; filename?: string; mimeType: string; size: number }[] = []) {
  if (!node) return out;
  const type = String(node.type ?? '').toLowerCase();
  const isBilag = type === 'application/pdf' || type.startsWith('image/');
  if (isBilag && node.part) {
    out.push({
      part: String(node.part),
      filename: node.dispositionParameters?.filename ?? node.parameters?.name,
      mimeType: type,
      size: Number(node.size ?? 0),
    });
  }
  for (const child of node.childNodes ?? []) collectAttachments(child, out);
  return out;
}

function formatFrom(envelope: any): string {
  const f = envelope?.from?.[0];
  if (!f) return '';
  const addr = f.address ?? '';
  return f.name ? `${f.name} <${addr}>` : addr;
}

export class ImapGmailAdapter implements GmailPort {
  constructor(
    private readonly cfg: ImapGmailConfig,
    // Injiserbar for test; default lazy-importerer imapflow.
    private readonly clientFactory?: (cfg: ImapGmailConfig) => any,
  ) {}

  get configured(): boolean {
    return Boolean(this.cfg.user && this.cfg.password);
  }

  private async makeClient(): Promise<any> {
    if (this.clientFactory) return this.clientFactory(this.cfg);
    const { ImapFlow } = await import('imapflow');
    return new ImapFlow({
      host: this.cfg.host ?? 'imap.gmail.com',
      port: this.cfg.port ?? 993,
      secure: true,
      auth: { user: this.cfg.user, pass: this.cfg.password.replace(/\s/g, '') },
      logger: false,
    });
  }

  private async withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = await this.makeClient();
    try {
      await client.connect();
    } catch (e) {
      throw new GmailAuthError(`IMAP-innlogging feilet: ${(e as Error).message}`, 'expired');
    }
    try {
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch {
        /* ignorer */
      }
    }
  }

  async connectionState(): Promise<GmailConnectionState> {
    if (!this.configured) return 'disconnected';
    try {
      return await this.withClient(async () => 'active' as const);
    } catch (e) {
      return e instanceof GmailAuthError ? e.state : 'disconnected';
    }
  }

  async searchMessages(filter: GmailSearchFilter): Promise<GmailMessageSummary[]> {
    if (!filter.labels || filter.labels.length === 0) return []; // ingen etiketter = ingen skanning
    return this.withClient(async (client) => {
      const results: GmailMessageSummary[] = [];
      for (const mailbox of filter.labels) {
        let lock: any;
        try {
          lock = await client.getMailboxLock(mailbox);
        } catch {
          continue; // ukjent etikett/mappe — hopp over
        }
        try {
          const total: number = client.mailbox?.exists ?? 0;
          if (total === 0) continue;
          // Nøkkelord (faktura/invoice/…) driver et IMAP-søk som finner relevante
          // meldinger i en støyete innboks; ellers de siste ~150 etter sekvensnummer.
          let range: string | number[];
          if (filter.keywords?.length) {
            const search: any = { or: filter.keywords.map((k) => ({ subject: k })) };
            if (filter.afterDate) search.since = new Date(filter.afterDate);
            const uids: number[] = (await client.search(search, { uid: true })) || [];
            if (uids.length === 0) continue;
            range = uids.slice(-200);
          } else {
            range = `${Math.max(1, total - 149)}:${total}`;
          }
          const afterTs = filter.afterDate ? new Date(filter.afterDate).getTime() : null;
          const beforeTs = filter.beforeDate ? new Date(filter.beforeDate).getTime() : null;
          for await (const msg of client.fetch(range, { uid: true, envelope: true, bodyStructure: true }, { uid: Array.isArray(range) })) {
            const when = msg.envelope?.date instanceof Date ? msg.envelope.date.getTime() : null;
            if (afterTs !== null && when !== null && when < afterTs) continue;
            if (beforeTs !== null && when !== null && when > beforeTs) continue;
            const atts = collectAttachments(msg.bodyStructure);
            if (atts.length === 0) continue;
            const from = formatFrom(msg.envelope);
            if (filter.senders?.length && !filter.senders.some((s) => from.toLowerCase().includes(s.toLowerCase()))) {
              continue;
            }
            const messageId = `${mailbox}|${msg.uid}`;
            const date = msg.envelope?.date instanceof Date ? msg.envelope.date.toISOString() : new Date().toISOString();
            results.push({
              messageId,
              threadId: String(msg.threadId ?? msg.uid),
              from,
              subject: msg.envelope?.subject ?? '',
              date,
              snippet: '',
              attachments: atts.map(
                (a, i): GmailAttachmentRef => ({
                  messageId,
                  attachmentId: a.part,
                  filename: a.filename ?? `vedlegg-${i + 1}`,
                  mimeType: a.mimeType,
                  sizeBytes: a.size,
                }),
              ),
            });
          }
        } finally {
          lock.release();
        }
      }
      return results;
    });
  }

  async fetchAttachment(ref: GmailAttachmentRef): Promise<Buffer> {
    const sep = ref.messageId.indexOf('|');
    const mailbox = sep >= 0 ? ref.messageId.slice(0, sep) : 'INBOX';
    const uid = sep >= 0 ? ref.messageId.slice(sep + 1) : ref.messageId;
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(mailbox);
      try {
        const dl = await client.download(uid, ref.attachmentId, { uid: true });
        const chunks: Buffer[] = [];
        for await (const chunk of dl.content) chunks.push(chunk as Buffer);
        return Buffer.concat(chunks);
      } finally {
        lock.release();
      }
    });
  }
}
