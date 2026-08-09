/**
 * SendGrid Inbound Parse: SendGrid tar imot e-post til virksomhetenes bilag-adresse
 * (MX peker på mx.sendgrid.net) og POST-er en multipart/form-data med feltene
 * (to, from, envelope, …) + vedleggene som fil-deler (attachment1, attachment2 …).
 * Vi ruter på mottakeradressen og lagrer vedleggene som `forward`-bilag.
 *
 * Autentiseres med en hemmelighet i webhook-URL-en (?token=…), siden SendGrid ikke
 * signerer Inbound Parse-kall. Inaktiv uten REKNAREN_INBOUND_SECRET.
 */
import Busboy from 'busboy';
import type { IncomingMessage } from 'node:http';
import type { Db } from '../db/pool.js';
import type { ObjectStorage } from '../storage/port.js';
import { ingestForwardedEmail, type InboundAttachment } from './inbound-email.js';
import { NotFoundError } from '../shared/errors.js';

export interface ParsedMultipart {
  fields: Record<string, string>;
  files: { field: string; filename: string; mimeType: string; content: Buffer }[];
}

/** Strømmer multipart-body-en gjennom busboy og samler felt + filer i minnet. */
export function parseSendgridMultipart(req: IncomingMessage): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024, files: 25 } });
    const fields: Record<string, string> = {};
    const files: ParsedMultipart['files'] = [];
    bb.on('field', (name, val) => {
      fields[name] = val;
    });
    bb.on('file', (name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => files.push({ field: name, filename: info.filename, mimeType: info.mimeType, content: Buffer.concat(chunks) }));
    });
    bb.on('close', () => resolve({ fields, files }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

/** Finn mottakeradressen: helst envelope.to (SMTP-mottaker), ellers To-headeren. */
export function sendgridRecipient(fields: Record<string, string>): string | null {
  try {
    if (fields.envelope) {
      const env = JSON.parse(fields.envelope) as { to?: string[] };
      if (Array.isArray(env.to) && env.to[0]) return env.to[0];
    }
  } catch {
    /* faller tilbake til to-feltet */
  }
  return fields.to ?? null;
}

/** Ruter en parset SendGrid-melding til rett virksomhet og lagrer vedleggene. */
export async function ingestSendgridEmail(
  db: Db,
  storage: ObjectStorage,
  parsed: ParsedMultipart,
): Promise<{ organizationId: string; ingested: number; skipped: number }> {
  const recipient = sendgridRecipient(parsed.fields);
  if (!recipient) throw new NotFoundError('Ingen mottakeradresse i meldingen.');
  const attachments: InboundAttachment[] = parsed.files
    .filter((f) => f.filename)
    .map((f) => ({ filename: f.filename, mimeType: f.mimeType, content: f.content }));
  return ingestForwardedEmail(db, storage, { recipient, attachments });
}
