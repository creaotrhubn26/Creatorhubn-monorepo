/**
 * Inn-e-post: hver virksomhet får en unik bilag-adresse (avledet av org-id, ingen
 * lagring/migrasjon). Forbrukeren videresender kvitteringer dit, eller oppgir den
 * som fakturamottaker; en inn-e-post-leverandør POST-er meldingen til webhooken,
 * som ruter på mottakeradressen og lagrer vedleggene som `forward`-bilag.
 *
 * ÆRLIG STATUS: adressen er alltid gyldig, men mottak er kun aktivt når
 * REKNAREN_INBOUND_SECRET (+ en leverandør pekt på webhooken) er satt — ellers
 * er webhooken av, på samme måte som Gmail/IMAP er sandbox uten legitimasjon.
 */
import type { Db } from '../db/pool.js';
import type { ObjectStorage } from '../storage/port.js';
import { registerDocument } from '../documents/service.js';
import { NotFoundError } from '../shared/errors.js';

/** 8 hex fra org-id gir en kort, unik adresse. Kollisjon er usannsynlig; ved
 *  tvetydig oppslag rutes ingenting (fail-closed). */
export function inboundEmailFor(orgId: string, domain: string): string {
  return `bilag.${orgId.replace(/-/g, '').slice(0, 8)}@${domain}`;
}

const ALIAS_RE = /(?:^|<)\s*bilag\.([0-9a-f]{8})@/i;

/** Plukker prefikset ut av en mottakeradresse («Navn <bilag.abc12345@…>»). */
export function parseInboundAlias(recipient: string): string | null {
  const m = ALIAS_RE.exec(recipient);
  return m ? m[1]!.toLowerCase() : null;
}

export async function resolveOrgIdByInbound(db: Db, recipient: string): Promise<string | null> {
  const prefix = parseInboundAlias(recipient);
  if (!prefix) return null;
  const r = await db.query(
    `SELECT id FROM organizations WHERE replace(id::text, '-', '') LIKE $1 || '%'`,
    [prefix],
  );
  return r.rowCount === 1 ? (r.rows[0].id as string) : null;
}

export interface InboundAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

/** Bare ekte bilag-vedlegg tas inn — signaturer, sporingsbilder o.l. hoppes over. */
const BILAG_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'text/xml', 'application/xml']);

/** Ruter en videresendt e-post til rett virksomhet og lagrer vedleggene som
 *  `forward`-bilag (samme integritets-/duplikatkontroll som opplasting). */
export async function ingestForwardedEmail(
  db: Db,
  storage: ObjectStorage,
  params: { recipient: string; attachments: InboundAttachment[] },
): Promise<{ organizationId: string; ingested: number; skipped: number }> {
  const organizationId = await resolveOrgIdByInbound(db, params.recipient);
  if (!organizationId) throw new NotFoundError('Ingen virksomhet matcher mottakeradressen.');
  const owner = (
    await db.query(
      `SELECT user_id FROM memberships
       WHERE organization_id = $1 AND role = 'owner' AND status = 'active'
       ORDER BY created_at LIMIT 1`,
      [organizationId],
    )
  ).rows[0];
  if (!owner) throw new NotFoundError('Virksomheten mangler en aktiv eier.');
  const actor = { userId: owner.user_id as string, role: 'owner' };

  let ingested = 0;
  let skipped = 0;
  for (const att of params.attachments) {
    if (!BILAG_MIME.has(att.mimeType.toLowerCase())) {
      skipped++;
      continue;
    }
    try {
      await registerDocument(
        db,
        { organizationId, actor, source: 'forward', filename: att.filename, mimeType: att.mimeType, content: att.content },
        storage,
      );
      ingested++;
    } catch {
      // Ikke-tillatt vedleggstype e.l. hopper vi over — resten av e-posten skal likevel inn.
      skipped++;
    }
  }
  return { organizationId, ingested, skipped };
}
