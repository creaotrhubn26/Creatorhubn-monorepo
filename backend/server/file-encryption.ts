// file-encryption.ts — envelope-encryption for filer ved hvile.
//
// Modell:
//   - Master KEK (Key Encryption Key): 32 byte fra env STORAGE_MASTER_KEK_HEX
//   - Per-bruker KEK: HKDF(masterKek, salt=userId) — gir hver bruker
//     effektivt unik KEK uten å lagre N nøkler
//   - Per-fil DEK (Data Encryption Key): tilfeldig 32 byte
//   - Fil-bytes krypteres med DEK via AES-256-GCM
//   - DEK krypteres med per-bruker-KEK via AES-256-GCM og lagres i
//     chunked_uploads.metadata.encryptedDek (base64)
//
// Når en fil leses:
//   1. Hent encryptedDek fra DB
//   2. Deriver per-bruker-KEK på nytt
//   3. Dekrypter DEK
//   4. Dekrypter file-bytes med DEK
//
// Hvorfor envelope og ikke direkte-kryptering med KEK?
//   - DEK-rotering = bare re-krypter ett ~80-byte ciphertext, ikke hele
//     den 80GB-store RAW-fila
//   - Hvis vi mister DEK-en for én fil, mister vi kun den fila (ikke
//     alle filer)
//   - Standard mønster (AWS S3 SSE-C, Cloudflare, GCP KMS bruker alle
//     envelope-encryption)
//
// Threat-model dekket:
//   - Backend-breach (RCE): angriper får R2-nøklene + DB, men trenger
//     ALSO master-KEK fra env. På Render kommer den fra secret-store
//     som ikke er på disk
//   - R2-bucket-policy-feil: angriper kan laste ned alt fra bucket men
//     ser kun ciphertext
//   - DB-dump: angriper får encryptedDek-er men trenger master-KEK
//
// Threat-model IKKE dekket:
//   - Full server-takeover: angriper får ALT (KEK + DB + R2). Mitigering:
//     bruk KMS for master-KEK i fremtiden (Cloudflare Workers KV med
//     restricted access er nærmeste vi har uten dedikert KMS)
//   - Side-channel-angrep på crypto-implementasjonen
//
// Stream-videoer kan IKKE envelope-encryptes på vår side — Cloudflare
// må kunne lese råfila for transcoding/playback. Stream har sin egen
// at-rest encryption (Cloudflare-managed). For full kontroll: hold
// sensitive video utenfor Stream og send dem som R2-encrypted istedenfor.

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  createHash,
} from "crypto";
import { Transform, type TransformCallback } from "stream";

const KEK_LENGTH = 32; // 256 bit
const DEK_LENGTH = 32; // 256 bit
const IV_LENGTH_GCM = 12; // anbefalt for GCM
const AUTH_TAG_LENGTH = 16;
const HKDF_DIGEST = "sha256";
const HKDF_INFO = Buffer.from("creatorhub-file-encryption-v1", "utf8");

const isHex64 = (s: string): boolean => /^[0-9a-fA-F]{64}$/.test(s);

let masterKekCache: Buffer | null = null;

/**
 * Hent master-KEK fra env. Returnerer null hvis ikke konfigurert
 * (encryption er da deaktivert som default — backwards compatible).
 *
 * Forventet format: 64-hex-tegn = 32 bytes. Generér med:
 *   openssl rand -hex 32
 */
export const getMasterKek = (): Buffer | null => {
  if (masterKekCache) return masterKekCache;
  const raw = process.env.STORAGE_MASTER_KEK_HEX;
  if (!raw || raw.trim().length === 0) return null;
  if (!isHex64(raw.trim())) {
    console.error(
      "[file-encryption] STORAGE_MASTER_KEK_HEX må være eksakt 64 hex-tegn (32 bytes)",
    );
    return null;
  }
  masterKekCache = Buffer.from(raw.trim(), "hex");
  return masterKekCache;
};

export const isEncryptionAvailable = (): boolean => getMasterKek() !== null;

/**
 * Deriver per-bruker KEK fra master-KEK via HKDF.
 *
 * Salt = sha256(userId) — sikrer fixed-length salt + samme bruker gir
 * alltid samme deriverte nøkkel.
 */
export const deriveUserKek = (userId: string): Buffer => {
  const master = getMasterKek();
  if (!master) {
    throw new Error("encryption_not_configured");
  }
  const salt = createHash("sha256").update(userId).digest();
  const derived = hkdfSync(HKDF_DIGEST, master, salt, HKDF_INFO, KEK_LENGTH);
  return Buffer.from(derived);
};

/**
 * Generer en ny per-fil DEK.
 */
export const generateDek = (): Buffer => randomBytes(DEK_LENGTH);

/**
 * Krypter DEK med per-bruker-KEK.
 * Output-format: base64(iv || tag || ciphertext)
 *
 * AES-256-GCM gir både konfidensialitet og integritetssjekk på DEK-en.
 */
export const encryptDek = (dek: Buffer, userKek: Buffer): string => {
  const iv = randomBytes(IV_LENGTH_GCM);
  const cipher = createCipheriv("aes-256-gcm", userKek, iv);
  const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
};

/**
 * Dekrypter DEK. Kaster ved manipulasjon (GCM auth-tag-mismatch).
 */
export const decryptDek = (encryptedDek: string, userKek: Buffer): Buffer => {
  const buf = Buffer.from(encryptedDek, "base64");
  if (buf.length < IV_LENGTH_GCM + AUTH_TAG_LENGTH) {
    throw new Error("encrypted_dek_invalid_length");
  }
  const iv = buf.subarray(0, IV_LENGTH_GCM);
  const tag = buf.subarray(IV_LENGTH_GCM, IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const dec = createDecipheriv("aes-256-gcm", userKek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]);
};

/**
 * Krypter en hel buffer med en DEK. Brukes for små filer som
 * single-shot-uploads. Returnerer Buffer av formatet iv || tag || ct.
 */
export const encryptBuffer = (
  plaintext: Buffer,
  dek: Buffer,
): { ciphertext: Buffer; iv: Buffer } => {
  const iv = randomBytes(IV_LENGTH_GCM);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([iv, tag, ct]), iv };
};

export const decryptBuffer = (ciphertext: Buffer, dek: Buffer): Buffer => {
  if (ciphertext.length < IV_LENGTH_GCM + AUTH_TAG_LENGTH) {
    throw new Error("ciphertext_invalid_length");
  }
  const iv = ciphertext.subarray(0, IV_LENGTH_GCM);
  const tag = ciphertext.subarray(IV_LENGTH_GCM, IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const ct = ciphertext.subarray(IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const dec = createDecipheriv("aes-256-gcm", dek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]);
};

/**
 * Streaming-kryptering. Brukes for store filer (>= 25MB) hvor vi ikke
 * vil laste hele bufferen i minnet.
 *
 * Format på output-strømmen: iv || ciphertext || authTag.
 * Vi prepender iv før ciphertext og appender authTag når strømmen er
 * ferdig (GCM-tag kan ikke beregnes før hele input er konsumert).
 */
export class EncryptStream extends Transform {
  // Bruk `any` for å hoppe over Node-types som ikke vet at createCipheriv
  // med "aes-256-gcm" returnerer en CipherGCM med getAuthTag/setAuthTag.
  private cipher: any;
  private ivWritten = false;
  private iv: Buffer;

  constructor(dek: Buffer) {
    super();
    this.iv = randomBytes(IV_LENGTH_GCM);
    this.cipher = createCipheriv("aes-256-gcm", dek, this.iv);
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (!this.ivWritten) {
      this.push(this.iv);
      this.ivWritten = true;
    }
    try {
      const ct = this.cipher.update(chunk);
      if (ct.length > 0) this.push(ct);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      const final = this.cipher.final();
      if (final.length > 0) this.push(final);
      // Appender auth-tag på slutten — leseren MÅ vite at de siste
      // 16 byte er taggen, ikke ciphertext.
      this.push(this.cipher.getAuthTag());
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * Streaming-dekryptering. Bruker buffring for å trekke ut iv (første
 * 12 byte) og auth-tag (siste 16 byte) før den emitterer plaintext.
 *
 * NOTE: Vi MÅ kjenne total ciphertext-størrelse på forhånd for å vite
 * hvor authTag-en starter. Hvis ukjent, fall tilbake til buffer-mode.
 */
export class DecryptStream extends Transform {
  private dek: Buffer;
  private buffered: Buffer[] = [];
  private bufferedLength = 0;
  private ivExtracted = false;
  private iv: Buffer | null = null;
  // Bruk `any` for å hoppe over Node-types som ikke vet at "aes-256-gcm"
  // gir DecipherGCM med setAuthTag.
  private decipher: any = null;
  private totalCiphertextLength: number;
  private bytesProcessed = 0;

  constructor(dek: Buffer, totalCiphertextLength: number) {
    super();
    this.dek = dek;
    this.totalCiphertextLength = totalCiphertextLength;
    if (totalCiphertextLength < IV_LENGTH_GCM + AUTH_TAG_LENGTH) {
      throw new Error("totalCiphertextLength_invalid");
    }
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      this.buffered.push(chunk);
      this.bufferedLength += chunk.length;

      // Vent til vi har minst IV
      if (!this.ivExtracted) {
        if (this.bufferedLength < IV_LENGTH_GCM) {
          return callback();
        }
        const concat = Buffer.concat(this.buffered);
        this.iv = concat.subarray(0, IV_LENGTH_GCM);
        const rest = concat.subarray(IV_LENGTH_GCM);
        this.decipher = createDecipheriv("aes-256-gcm", this.dek, this.iv);
        this.buffered = [rest];
        this.bufferedLength = rest.length;
        this.ivExtracted = true;
      }

      // Beregn hvor mye av det vi har buffret som er ciphertext (alt
      // unntatt de siste AUTH_TAG_LENGTH-bytene av total-strømmen)
      const ciphertextOnlyLength =
        this.totalCiphertextLength - IV_LENGTH_GCM - AUTH_TAG_LENGTH;
      const remainingCtBytes = ciphertextOnlyLength - this.bytesProcessed;

      const allBuffered = Buffer.concat(this.buffered);
      if (remainingCtBytes <= 0) {
        // All ciphertext er sendt, nå akkumulerer vi taggen
        this.buffered = [allBuffered];
        this.bufferedLength = allBuffered.length;
        return callback();
      }

      // Send ciphertext gjennom dekrypter, men hold tilbake de siste
      // AUTH_TAG_LENGTH bytene (de er auth-tag, ikke ciphertext)
      const usableNow = Math.min(allBuffered.length, remainingCtBytes);
      if (usableNow > 0) {
        const pt = this.decipher!.update(allBuffered.subarray(0, usableNow));
        if (pt.length > 0) this.push(pt);
        this.bytesProcessed += usableNow;
      }
      const leftover = allBuffered.subarray(usableNow);
      this.buffered = [leftover];
      this.bufferedLength = leftover.length;

      callback();
    } catch (err) {
      callback(err as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      // Det som er igjen i bufferen burde være eksakt AUTH_TAG_LENGTH bytes
      const remaining = Buffer.concat(this.buffered);
      if (remaining.length !== AUTH_TAG_LENGTH) {
        return callback(
          new Error(
            `decrypt_stream_tag_length_mismatch: expected ${AUTH_TAG_LENGTH}, got ${remaining.length}`,
          ),
        );
      }
      this.decipher!.setAuthTag(remaining);
      const final = this.decipher!.final();
      if (final.length > 0) this.push(final);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * Helper: gitt en plaintext-størrelse, returner ciphertext-størrelse.
 * Brukes for Content-Length-header på upload til R2.
 */
export const ciphertextSizeFor = (plaintextSize: number): number => {
  return plaintextSize + IV_LENGTH_GCM + AUTH_TAG_LENGTH;
};

/**
 * Helper: gitt en ciphertext-størrelse, returner plaintext-størrelse.
 */
export const plaintextSizeFor = (ciphertextSize: number): number => {
  return Math.max(0, ciphertextSize - IV_LENGTH_GCM - AUTH_TAG_LENGTH);
};

export const ENCRYPTION_INTERNAL = {
  KEK_LENGTH,
  DEK_LENGTH,
  IV_LENGTH_GCM,
  AUTH_TAG_LENGTH,
};
