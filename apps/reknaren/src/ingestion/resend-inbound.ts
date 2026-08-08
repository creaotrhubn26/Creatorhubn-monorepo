/**
 * Resend inn-e-post: Resend tar imot e-post til virksomhetenes bilag-adresse
 * (MX peker på Resend) og POST-er et `email.received`-event til webhooken vår.
 * Vedleggene ligger IKKE i eventet — vi henter dem via Resends attachments-API
 * (download_url, gyldig 1 time) og lagrer dem som `forward`-bilag.
 *
 * Autentiseres med Svix-signatur (samme som Resend bruker). Inaktiv uten
 * REKNAREN_RESEND_WEBHOOK_SECRET.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db/pool.js';
import type { ObjectStorage } from '../storage/port.js';
import { ingestForwardedEmail, parseInboundAlias, type InboundAttachment } from './inbound-email.js';
import { NotFoundError } from '../shared/errors.js';

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface ResendReceivedEvent {
  type: string;
  data?: { email_id?: string; to?: string[]; received_for?: string[] };
}

/**
 * Svix-signaturverifisering (Resends webhook-signering). Header `svix-signature`
 * er mellomromsseparerte «v1,<base64sig>»-oppføringer; minst én må matche
 * HMAC-SHA256 av «id.timestamp.body» med den base64-dekodede hemmeligheten.
 */
export function verifyResendSignature(
  secret: string | undefined,
  headers: { id?: string | undefined; timestamp?: string | undefined; signature?: string | undefined },
  rawBody: string,
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest('base64');
  const expectedBuf = Buffer.from(expected);
  for (const part of headers.signature.split(' ')) {
    const sig = part.includes(',') ? part.slice(part.indexOf(',') + 1) : part;
    const got = Buffer.from(sig);
    if (got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf)) return true;
  }
  return false;
}

interface ResendAttachmentMeta {
  filename?: string;
  content_type?: string;
  download_url?: string;
}

async function listAttachments(fetchImpl: FetchLike, apiKey: string, emailId: string): Promise<ResendAttachmentMeta[]> {
  const res = await fetchImpl(`https://api.resend.com/emails/${emailId}/attachments`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Resend attachments-liste feilet (${res.status}).`);
  const body = (await res.json()) as { data?: ResendAttachmentMeta[] };
  return body.data ?? [];
}

/** Ruter et Resend-`email.received`-event til rett virksomhet og lagrer vedleggene. */
export async function ingestResendEmail(
  db: Db,
  storage: ObjectStorage,
  opts: { apiKey: string; fetchImpl?: FetchLike },
  event: ResendReceivedEvent,
): Promise<{ organizationId: string; ingested: number; skipped: number }> {
  if (event.type !== 'email.received' || !event.data?.email_id) {
    throw new NotFoundError('Ikke et email.received-event med e-post-id.');
  }
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const recipients = [...(event.data.received_for ?? []), ...(event.data.to ?? [])];
  const recipient = recipients.find((r) => parseInboundAlias(r));
  if (!recipient) throw new NotFoundError('Ingen bilag-adresse blant mottakerne.');

  const metas = await listAttachments(fetchImpl, opts.apiKey, event.data.email_id);
  const attachments: InboundAttachment[] = [];
  for (const m of metas) {
    if (!m.filename || !m.download_url) continue;
    const dl = await fetchImpl(m.download_url);
    if (!dl.ok) continue;
    attachments.push({
      filename: m.filename,
      mimeType: m.content_type ?? 'application/octet-stream',
      content: Buffer.from(await dl.arrayBuffer()),
    });
  }
  // ingestForwardedEmail gjør MIME-filter, eier-oppslag og duplikat-/integritetskontroll.
  return ingestForwardedEmail(db, storage, { recipient, attachments });
}
