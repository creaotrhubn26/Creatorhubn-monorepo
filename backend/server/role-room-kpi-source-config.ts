/**
 * KPI-datakilde-konfigurasjon (item: koble Vault til KPI-fetchere).
 *
 * Sentralisert lese/skrive-API for role_room_kpi_source_config-tabellen.
 * Alle KPI-connectors leser sine config-verdier her før de fetcher data:
 *
 *   GA4-connector:
 *     getConfig(projectId, 'google_analytics', 'property_id')
 *
 *   Google Business Profile-connector:
 *     getConfig(projectId, 'google_business', 'location_id')
 *
 *   YouTube-connector:
 *     getConfig(projectId, 'youtube', 'channel_id')
 *
 * Hver write logges som vault_audit_event for transparens (samme audit-
 * trail som secret_saved/secret_revoked), slik at brukeren ser hele
 * historikken — både hvem som la inn GA4-property-ID og hvem som
 * delte passordet — i samme aktivitetslogg.
 */

import type { Pool } from "pg";

export type KpiSourcePlatform =
  | "google_analytics"
  | "google_business"
  | "google_search_console"
  | "youtube"
  | "meta_business"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok";

export interface KpiSourceConfigEntry {
  id: string;
  projectId: string;
  platform: KpiSourcePlatform;
  configKey: string;
  configValue: string;
  displayLabel: string | null;
  setByUserId: string | null;
  validatedAt: string | null;
  lastTestResult: KpiTestResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface KpiTestResult {
  success: boolean;
  timestamp: string;
  error?: string;
  sample?: unknown;
  durationMs?: number;
}

interface ConfigRow {
  id: string;
  project_id: string;
  platform: string;
  config_key: string;
  config_value: string;
  display_label: string | null;
  set_by_user_id: string | null;
  validated_at: Date | null;
  last_test_result: unknown;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: ConfigRow): KpiSourceConfigEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    platform: row.platform as KpiSourcePlatform,
    configKey: row.config_key,
    configValue: row.config_value,
    displayLabel: row.display_label,
    setByUserId: row.set_by_user_id,
    validatedAt: row.validated_at?.toISOString() ?? null,
    lastTestResult: (row.last_test_result as KpiTestResult | null) ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Robust validering: project_id, platform, config_key skal alle være
 *  ikke-tomme strings; config_value må eksistere men kan være tom under
 *  upsert (vi sanitizer i loggen). */
const ALLOWED_PLATFORMS: ReadonlySet<KpiSourcePlatform> = new Set<KpiSourcePlatform>([
  "google_analytics", "google_business", "google_search_console",
  "youtube", "meta_business", "instagram", "facebook", "linkedin", "tiktok",
]);

const MAX_VALUE_LENGTH = 500;  // Property-IDs er typisk <100 tegn; bredt nok til URLs
const MAX_LABEL_LENGTH = 200;
const MAX_KEY_LENGTH = 100;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateConfigInput(input: {
  projectId?: string;
  platform?: string;
  configKey?: string;
  configValue?: string;
  displayLabel?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!input.projectId || input.projectId.trim().length === 0) {
    errors.push({ field: "projectId", message: "projectId er påkrevd." });
  }
  if (!input.platform || !ALLOWED_PLATFORMS.has(input.platform as KpiSourcePlatform)) {
    errors.push({ field: "platform", message: `platform må være en av: ${Array.from(ALLOWED_PLATFORMS).join(", ")}` });
  }
  if (!input.configKey || input.configKey.trim().length === 0) {
    errors.push({ field: "configKey", message: "configKey er påkrevd." });
  } else if (input.configKey.length > MAX_KEY_LENGTH) {
    errors.push({ field: "configKey", message: `configKey for lang (max ${MAX_KEY_LENGTH}).` });
  } else if (!/^[a-z][a-z0-9_]*$/.test(input.configKey)) {
    errors.push({ field: "configKey", message: "configKey må være snake_case (a-z, 0-9, _; må starte med bokstav)." });
  }
  if (typeof input.configValue !== "string") {
    errors.push({ field: "configValue", message: "configValue er påkrevd (kan være tom streng for sletting)." });
  } else if (input.configValue.length > MAX_VALUE_LENGTH) {
    errors.push({ field: "configValue", message: `configValue for lang (max ${MAX_VALUE_LENGTH}).` });
  }
  if (input.displayLabel !== undefined && input.displayLabel !== null) {
    if (typeof input.displayLabel !== "string") {
      errors.push({ field: "displayLabel", message: "displayLabel må være string eller null." });
    } else if (input.displayLabel.length > MAX_LABEL_LENGTH) {
      errors.push({ field: "displayLabel", message: `displayLabel for lang (max ${MAX_LABEL_LENGTH}).` });
    }
  }
  return errors;
}

/** Upsert config-entry. Returnerer den oppdaterte raden, eller null ved feil.
 *  Validering må kjøres separat (validateConfigInput) før dette kalles. */
export async function upsertKpiSourceConfig(
  pool: Pool,
  input: {
    projectId: string;
    platform: KpiSourcePlatform;
    configKey: string;
    configValue: string;
    displayLabel?: string | null;
    setByUserId?: string | null;
  },
): Promise<KpiSourceConfigEntry | null> {
  try {
    const r = await pool.query<ConfigRow>(
      `INSERT INTO role_room_kpi_source_config
         (project_id, platform, config_key, config_value, display_label, set_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id, platform, config_key)
       DO UPDATE SET
         config_value = EXCLUDED.config_value,
         display_label = EXCLUDED.display_label,
         set_by_user_id = EXCLUDED.set_by_user_id,
         updated_at = now(),
         -- Når verdien endrer seg, nullstill validated_at — testen må kjøres på nytt
         validated_at = CASE
           WHEN role_room_kpi_source_config.config_value != EXCLUDED.config_value
             THEN NULL
           ELSE role_room_kpi_source_config.validated_at
         END,
         last_test_result = CASE
           WHEN role_room_kpi_source_config.config_value != EXCLUDED.config_value
             THEN NULL
           ELSE role_room_kpi_source_config.last_test_result
         END
       RETURNING id, project_id, platform, config_key, config_value,
                 display_label, set_by_user_id, validated_at, last_test_result,
                 created_at, updated_at`,
      [
        input.projectId,
        input.platform,
        input.configKey,
        input.configValue,
        input.displayLabel ?? null,
        input.setByUserId ?? null,
      ],
    );
    if (!r.rows[0]) return null;
    // Logg til vault-audit-trail (best-effort — feil her skal ikke
    // blokkere upsert)
    void writeVaultAuditEvent(pool, {
      projectId: input.projectId,
      platform: input.platform,
      eventType: "kpi_config_saved",
      actorUserId: input.setByUserId ?? null,
      metadata: { configKey: input.configKey, hasValue: input.configValue.length > 0 },
    });
    return mapRow(r.rows[0]);
  } catch (error) {
    console.error("[role-room-kpi-source-config] upsert failed", {
      projectId: input.projectId,
      platform: input.platform,
      configKey: input.configKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** List alle config-entries for et prosjekt. Hvis platform-filter er
 *  satt, returnerer kun den platformen. */
export async function listKpiSourceConfig(
  pool: Pool,
  projectId: string,
  platform?: KpiSourcePlatform,
): Promise<KpiSourceConfigEntry[]> {
  try {
    const params: unknown[] = [projectId];
    let sql = `SELECT id, project_id, platform, config_key, config_value,
                      display_label, set_by_user_id, validated_at, last_test_result,
                      created_at, updated_at
                 FROM role_room_kpi_source_config
                WHERE project_id = $1`;
    if (platform) {
      sql += ` AND platform = $2`;
      params.push(platform);
    }
    sql += ` ORDER BY platform, config_key`;
    const r = await pool.query<ConfigRow>(sql, params);
    return r.rows.map(mapRow);
  } catch (error) {
    console.error("[role-room-kpi-source-config] list failed", { projectId, error });
    return [];
  }
}

/** Hent én config-verdi. Convenience for connectorer som vet
 *  hvilken nøkkel de trenger (f.eks. GA4 vil ha 'property_id'). */
export async function getKpiSourceConfigValue(
  pool: Pool,
  projectId: string,
  platform: KpiSourcePlatform,
  configKey: string,
): Promise<string | null> {
  try {
    const r = await pool.query<{ config_value: string }>(
      `SELECT config_value FROM role_room_kpi_source_config
        WHERE project_id = $1 AND platform = $2 AND config_key = $3
        LIMIT 1`,
      [projectId, platform, configKey],
    );
    return r.rows[0]?.config_value ?? null;
  } catch {
    return null;
  }
}

/** Slett en config-entry. Bruker DELETE i stedet for å sette tomt
 *  verdi slik at UI tydelig kan skille "ikke satt" fra "tom string". */
export async function deleteKpiSourceConfig(
  pool: Pool,
  projectId: string,
  platform: KpiSourcePlatform,
  configKey: string,
  deletedByUserId?: string | null,
): Promise<boolean> {
  try {
    const r = await pool.query(
      `DELETE FROM role_room_kpi_source_config
        WHERE project_id = $1 AND platform = $2 AND config_key = $3
        RETURNING id`,
      [projectId, platform, configKey],
    );
    if (r.rowCount === 0) return false;
    void writeVaultAuditEvent(pool, {
      projectId,
      platform,
      eventType: "kpi_config_deleted",
      actorUserId: deletedByUserId ?? null,
      metadata: { configKey },
    });
    return true;
  } catch (error) {
    console.error("[role-room-kpi-source-config] delete failed", { projectId, platform, configKey, error });
    return false;
  }
}

/** Markér en config som verifisert — connectoren har kjørt test mot
 *  API'et og fått 200. validated_at + last_test_result oppdateres,
 *  config_value forblir uendret. */
export async function recordKpiSourceTestResult(
  pool: Pool,
  projectId: string,
  platform: KpiSourcePlatform,
  configKey: string,
  result: KpiTestResult,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE role_room_kpi_source_config
          SET validated_at = CASE WHEN $4::boolean THEN now() ELSE validated_at END,
              last_test_result = $5::jsonb,
              updated_at = now()
        WHERE project_id = $1 AND platform = $2 AND config_key = $3`,
      [projectId, platform, configKey, result.success, JSON.stringify(result)],
    );
  } catch (error) {
    console.error("[role-room-kpi-source-config] recordTestResult failed", { projectId, platform, configKey, error });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Audit-log helper — gjenbruker eksisterende vault-audit-tabell
// ─────────────────────────────────────────────────────────────────────

async function writeVaultAuditEvent(
  pool: Pool,
  params: {
    projectId: string;
    platform: string;
    eventType: string;
    actorUserId: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO role_room_access_vault_audit_events
         (project_id, platform, event_type, actor_user_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        params.projectId,
        params.platform,
        params.eventType,
        params.actorUserId,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
  } catch {
    // Audit-failure er ikke kritisk. Tabellen kan mangle i tidlige
    // miljøer. Loggføres ikke videre for å unngå støy.
  }
}
