/**
 * consent-ledger-service.ts — samtykke-logg med hash-kjede.
 *
 * Bevisverdien ligger i tre bindinger, ikke i at raden finnes:
 *
 *   innhold   — document_hash peker på den eksakte teksten som ble vist
 *   person    — auth_event_id peker på en BankID-autentisering
 *   rekkefølge — row_hash = sha256(prev_hash + kanonisk rad)
 *
 * Kjeden gjør at en endret gammel rad bryter alle radene etter den. Den gjør
 * IKKE at vi ikke kan regne om hele kjeden selv — det hullet lukkes av
 * anchorChainHead(), som skriver hodet til et sted utenfor vår kontroll.
 *
 * 🔑 Dette er BankID-autentisert samtykke, ikke BankID-signert. Et
 * signaturbevis utstedes av en tredjepart; dette er vår egen logg, gjort så
 * vanskelig å bestride som den kan bli uten den pakken.
 */

import crypto from "node:crypto";
import type { Pool } from "pg";

/** Første rad i kjeden har ingen forgjenger. */
export const GENESIS_HASH = "0".repeat(64);

export type ConsentAction = "granted" | "withdrawn";
export type ConsentAuthMethod = "bankid" | "buypass" | "session";

export interface ConsentRowCore {
  seq: number;
  user_id: string;
  subject_type: string;
  subject_ref: string | null;
  document_hash: string;
  action: ConsentAction;
  auth_method: ConsentAuthMethod;
  auth_event_id: string | null;
  created_at: string;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Kanonisk form av en rad. Feltrekkefølgen er fast og eksplisitt — hadde vi
 * brukt JSON.stringify på et objekt, ville en ny nøkkel eller en annen
 * nøkkelrekkefølge endret alle hasher stilltiende.
 */
export function canonicalRow(row: ConsentRowCore): string {
  return [
    row.seq,
    row.user_id,
    row.subject_type,
    row.subject_ref ?? "",
    row.document_hash,
    row.action,
    row.auth_method,
    row.auth_event_id ?? "",
    new Date(row.created_at).toISOString(),
  ].join("");
}

export function computeRowHash(prevHash: string, row: ConsentRowCore): string {
  return sha256(`${prevHash}${canonicalRow(row)}`);
}

export interface RecordConsentInput {
  userId: string;
  subjectType: string;
  subjectRef?: string | null;
  /** Dokumentet brukeren faktisk så. Hashen bindes til raden. */
  documentHash: string;
  documentId?: string | null;
  action: ConsentAction;
  authMethod: ConsentAuthMethod;
  authEventId?: string | null;
}

/**
 * Skriver én rad i kjeden.
 *
 * Alt skjer i én transaksjon med lås på tabellen: to samtidige samtykker som
 * leser samme forgjenger ville ellers fått samme prev_hash og grenet kjeden.
 * En logg som grener er ikke en kjede.
 */
export async function recordConsent(
  pool: Pool,
  input: RecordConsentInput,
): Promise<{ seq: number; rowHash: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialiser skrivingene. Loggen er lavfrekvent; korrekt rekkefølge er
    // verdt mer enn samtidighet her.
    await client.query("LOCK TABLE consent_ledger IN EXCLUSIVE MODE");

    const prev = await client.query<{ row_hash: string }>(
      `SELECT row_hash FROM consent_ledger ORDER BY seq DESC LIMIT 1`,
    );
    const prevHash = prev.rows[0]?.row_hash ?? GENESIS_HASH;

    // Sekvens og tidspunkt må være kjent FØR hashen regnes, ellers hasher vi
    // noe annet enn det som lagres.
    const seqResult = await client.query<{ seq: string }>(
      `SELECT nextval(pg_get_serial_sequence('consent_ledger', 'seq')) AS seq`,
    );
    const seq = Number(seqResult.rows[0].seq);
    const createdAt = new Date().toISOString();

    const core: ConsentRowCore = {
      seq,
      user_id: input.userId,
      subject_type: input.subjectType,
      subject_ref: input.subjectRef ?? null,
      document_hash: input.documentHash,
      action: input.action,
      auth_method: input.authMethod,
      auth_event_id: input.authEventId ?? null,
      created_at: createdAt,
    };
    const rowHash = computeRowHash(prevHash, core);

    await client.query(
      `INSERT INTO consent_ledger
         (seq, user_id, subject_type, subject_ref, document_id, document_hash,
          action, auth_method, auth_event_id, created_at, prev_hash, row_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        seq,
        core.user_id,
        core.subject_type,
        core.subject_ref,
        input.documentId ?? null,
        core.document_hash,
        core.action,
        core.auth_method,
        core.auth_event_id,
        createdAt,
        prevHash,
        rowHash,
      ],
    );

    await client.query("COMMIT");
    return { seq, rowHash };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    // Stille feil i en samtykkelogg er verdiløs — da tror vi vi har bevis vi
    // ikke har. Kallstedet må få vite det.
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Hvilken autentisering hadde brukeren i dette øyeblikket.
 *
 * «session» er svakere bevis enn «bankid», og skal stå i loggen som det.
 * Å skrive «bankid» fordi brukeren en gang verifiserte seg ville være den
 * ene feilen som gjør hele loggen verdiløs i en tvist.
 */
export async function resolveAuthMethod(pool: Pool, userId: string): Promise<ConsentAuthMethod> {
  const r = await pool.query<{ provider: string }>(
    `SELECT provider FROM eid_identities WHERE user_id = $1 ORDER BY verified_at DESC LIMIT 1`,
    [userId],
  );
  const provider = r.rows[0]?.provider;
  return provider === "bankid" || provider === "buypass" ? provider : "session";
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  /** Første rad som ikke stemmer. Alle rader etter den er også mistenkelige. */
  brokenAtSeq: number | null;
  reason: "prev_mismatch" | "hash_mismatch" | null;
}

/**
 * Går gjennom kjeden og sjekker at hver rad peker på forrige, og at hashen
 * stemmer med innholdet. Dette er spørringen man kjører når noen bestrider
 * et samtykke — og den bør kjøres jevnlig, ikke bare i en tvist.
 */
export async function verifyChain(pool: Pool, limit = 100_000): Promise<ChainVerification> {
  const rows = await pool.query<ConsentRowCore & { prev_hash: string; row_hash: string }>(
    `SELECT seq, user_id, subject_type, subject_ref, document_hash, action,
            auth_method, auth_event_id, created_at, prev_hash, row_hash
       FROM consent_ledger
      ORDER BY seq ASC
      LIMIT $1`,
    [limit],
  );

  let expectedPrev = GENESIS_HASH;
  let checked = 0;

  for (const row of rows.rows) {
    if (row.prev_hash !== expectedPrev) {
      return { ok: false, checked, brokenAtSeq: Number(row.seq), reason: "prev_mismatch" };
    }
    const recomputed = computeRowHash(row.prev_hash, {
      seq: Number(row.seq),
      user_id: row.user_id,
      subject_type: row.subject_type,
      subject_ref: row.subject_ref,
      document_hash: row.document_hash,
      action: row.action,
      auth_method: row.auth_method,
      auth_event_id: row.auth_event_id,
      created_at: row.created_at,
    });
    if (recomputed !== row.row_hash) {
      return { ok: false, checked, brokenAtSeq: Number(row.seq), reason: "hash_mismatch" };
    }
    expectedPrev = row.row_hash;
    checked += 1;
  }

  return { ok: true, checked, brokenAtSeq: null, reason: null };
}

/** Lagrer dokumentteksten én gang per versjon og returnerer hash + id. */
export async function upsertConsentDocument(
  pool: Pool,
  input: { kind: string; version: string; locale?: string; body: string },
): Promise<{ id: string; hash: string }> {
  const hash = sha256(input.body);
  const locale = input.locale ?? "nb-NO";
  const r = await pool.query<{ id: string }>(
    `INSERT INTO consent_documents (kind, version, locale, body, body_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (kind, version, locale) DO UPDATE
        SET body = consent_documents.body
     RETURNING id`,
    [input.kind, input.version, locale, input.body, hash],
  );
  return { id: r.rows[0].id, hash };
}

/**
 * Forankrer kjedens hode utenfor vår egen database.
 *
 * Uten dette kan vi regne om hele kjeden og ingen ville se det. Med det må
 * en endring også passere den som holder ankeret — en tidsstempeltjeneste,
 * en e-post til revisor, eller hva dere velger. Selve utsendingen ligger hos
 * kallstedet; her lagres kvitteringen.
 */
export async function anchorChainHead(
  pool: Pool,
  input: { anchorKind: string; anchorRef: string | null },
): Promise<{ seq: number; rowHash: string } | null> {
  const head = await pool.query<{ seq: string; row_hash: string }>(
    `SELECT seq, row_hash FROM consent_ledger ORDER BY seq DESC LIMIT 1`,
  );
  if (!head.rowCount) return null;

  const seq = Number(head.rows[0].seq);
  const rowHash = head.rows[0].row_hash;
  await pool.query(
    `INSERT INTO consent_chain_anchors (seq, row_hash, anchor_kind, anchor_ref)
     VALUES ($1, $2, $3, $4)`,
    [seq, rowHash, input.anchorKind, input.anchorRef],
  );
  return { seq, rowHash };
}
