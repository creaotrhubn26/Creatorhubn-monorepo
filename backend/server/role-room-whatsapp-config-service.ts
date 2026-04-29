// Per-bedrift WhatsApp-config-service.
//
// Lagrer kryptert access_token + phone_number_id + business_account_id
// per Role Room-bedrift. Validerer mot Meta API ved skriving så team-leder
// får umiddelbar feedback hvis credentials er feil.

import crypto from "node:crypto";
import type { Pool } from "pg";

const META_GRAPH_VERSION = "v22.0";

export interface WhatsAppOrgConfig {
  orgKey: string;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  displayName: string;
  templateLanguage: string;
  template24hName: string;
  template1hName: string;
  configuredByUserId: string | null;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}

interface RawRow {
  org_key: string;
  business_account_id: string;
  phone_number_id: string;
  access_token_encrypted: string;
  display_name: string;
  template_language: string | null;
  template_24h_name: string | null;
  template_1h_name: string | null;
  configured_by_user_id: string | null;
  last_validated_at: string | null;
  last_validation_error: string | null;
}

function deriveEncryptionKey(): Buffer | null {
  const secret =
    process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptWhatsAppToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveEncryptionKey();
  if (!key) throw new Error("ROLE_ROOM_TOKEN_ENCRYPTION_KEY mangler");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptWhatsAppToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveEncryptionKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encryptedPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function rowToConfig(row: RawRow): WhatsAppOrgConfig | null {
  const accessToken = decryptWhatsAppToken(row.access_token_encrypted);
  if (!accessToken) return null;
  return {
    orgKey: row.org_key,
    businessAccountId: row.business_account_id,
    phoneNumberId: row.phone_number_id,
    accessToken,
    displayName: row.display_name,
    templateLanguage: row.template_language || "nb_NO",
    template24hName: row.template_24h_name || "audition_reminder_24h_no",
    template1hName: row.template_1h_name || "audition_reminder_1h_no",
    configuredByUserId: row.configured_by_user_id,
    lastValidatedAt: row.last_validated_at,
    lastValidationError: row.last_validation_error,
  };
}

export async function getWhatsAppOrgConfig(
  pool: Pool,
  orgKey: string,
): Promise<WhatsAppOrgConfig | null> {
  const result = await pool.query<RawRow>(
    `SELECT * FROM role_room_org_whatsapp_config WHERE org_key = $1 LIMIT 1`,
    [orgKey],
  );
  const row = result.rows[0];
  return row ? rowToConfig(row) : null;
}

export async function getWhatsAppOrgConfigSafe(
  pool: Pool,
  orgKey: string,
): Promise<{
  hasConfig: boolean;
  displayName: string | null;
  phoneNumberMasked: string | null;
  templateLanguage: string | null;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}> {
  const result = await pool.query<RawRow>(
    `SELECT * FROM role_room_org_whatsapp_config WHERE org_key = $1 LIMIT 1`,
    [orgKey],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      hasConfig: false,
      displayName: null,
      phoneNumberMasked: null,
      templateLanguage: null,
      lastValidatedAt: null,
      lastValidationError: null,
    };
  }
  return {
    hasConfig: true,
    displayName: row.display_name,
    phoneNumberMasked: maskPhoneNumberId(row.phone_number_id),
    templateLanguage: row.template_language,
    lastValidatedAt: row.last_validated_at,
    lastValidationError: row.last_validation_error,
  };
}

function maskPhoneNumberId(phoneNumberId: string): string {
  if (phoneNumberId.length <= 6) return phoneNumberId;
  return `${phoneNumberId.slice(0, 3)}…${phoneNumberId.slice(-3)}`;
}

export interface UpsertWhatsAppOrgConfigInput {
  orgKey: string;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  displayName: string;
  templateLanguage?: string;
  template24hName?: string;
  template1hName?: string;
  configuredByUserId?: string | null;
}

export async function validateAndUpsertWhatsAppOrgConfig(
  pool: Pool,
  input: UpsertWhatsAppOrgConfigInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ success: true; config: WhatsAppOrgConfig } | { success: false; error: string }> {
  const validation = await pingWhatsAppPhoneNumber({
    accessToken: input.accessToken,
    phoneNumberId: input.phoneNumberId,
    fetchImpl,
  });

  const encryptedToken = encryptWhatsAppToken(input.accessToken);
  if (!encryptedToken) {
    return { success: false, error: "encryption_unavailable" };
  }

  await pool.query(
    `INSERT INTO role_room_org_whatsapp_config (
       org_key, business_account_id, phone_number_id, access_token_encrypted,
       display_name, template_language, template_24h_name, template_1h_name,
       configured_by_user_id, last_validated_at, last_validation_error,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (org_key) DO UPDATE SET
       business_account_id    = EXCLUDED.business_account_id,
       phone_number_id        = EXCLUDED.phone_number_id,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       display_name           = EXCLUDED.display_name,
       template_language      = EXCLUDED.template_language,
       template_24h_name      = EXCLUDED.template_24h_name,
       template_1h_name       = EXCLUDED.template_1h_name,
       configured_by_user_id  = EXCLUDED.configured_by_user_id,
       last_validated_at      = EXCLUDED.last_validated_at,
       last_validation_error  = EXCLUDED.last_validation_error,
       updated_at             = NOW()`,
    [
      input.orgKey,
      input.businessAccountId,
      input.phoneNumberId,
      encryptedToken,
      input.displayName,
      input.templateLanguage || "nb_NO",
      input.template24hName || "audition_reminder_24h_no",
      input.template1hName || "audition_reminder_1h_no",
      input.configuredByUserId ?? null,
      validation.success ? new Date().toISOString() : null,
      validation.success ? null : validation.error,
    ],
  );

  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  const stored = await getWhatsAppOrgConfig(pool, input.orgKey);
  if (!stored) {
    return { success: false, error: "stored_config_unreadable" };
  }
  return { success: true, config: stored };
}

interface PingInput {
  accessToken: string;
  phoneNumberId: string;
  fetchImpl?: typeof fetch;
}

export async function pingWhatsAppPhoneNumber(
  input: PingInput,
): Promise<{ success: true; verifiedName: string | null } | { success: false; error: string }> {
  const fetchFn = input.fetchImpl ?? fetch;
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`;

  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `meta_${response.status}: ${errBody.slice(0, 300)}`,
      };
    }

    const json = (await response.json().catch(() => ({}))) as {
      verified_name?: unknown;
    };
    return {
      success: true,
      verifiedName:
        typeof json.verified_name === "string" ? json.verified_name : null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteWhatsAppOrgConfig(
  pool: Pool,
  orgKey: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM role_room_org_whatsapp_config WHERE org_key = $1`,
    [orgKey],
  );
}
