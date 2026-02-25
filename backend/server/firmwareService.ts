/**
 * Firmware Service — Backend logic for firmware catalog, matching, and version checking.
 *
 * Responsibilities:
 *   - CRUD on firmware_catalog table (canonical firmware versions per model)
 *   - "Track key" normalizer: messy brand/model names → deterministic match key
 *   - Per-equipment firmware status evaluation (up-to-date / update-available / unknown / needs-mapping)
 *   - Batch evaluation of all equipment with auto-check enabled
 *   - Match result caching in firmware_match_results table
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// Firmware Track Key — Normalizer
// ═══════════════════════════════════════════════════════════════════

const MARK_REPLACEMENTS: Record<string, string> = {
  'MARK IV': 'MK4', 'MARK III': 'MK3', 'MARK II': 'MK2',
  'MK IV': 'MK4', 'MK III': 'MK3', 'MK II': 'MK2',
  'MKIV': 'MK4', 'MKIII': 'MK3', 'MKII': 'MK2',
};

const STRIP_WORDS = [
  'BODY', 'CAMERA', 'KIT', 'ONLY', 'WITH', 'LENS', 'BLACK',
  'SILVER', '(', ')', '[', ']',
];

const BRAND_ALIASES: Record<string, string> = {
  'BMD': 'BLACKMAGIC',
  'BLACKMAGIC DESIGN': 'BLACKMAGIC',
  'BM': 'BLACKMAGIC',
  'SOUND DEVICES': 'SOUNDDEVICES',
};

const MODEL_ALIASES: Record<string, string> = {
  'POCKET CINEMA CAMERA 4K': 'BMPCC4K',
  'POCKET CINEMA CAMERA 6K': 'BMPCC6K',
  'POCKET CINEMA CAMERA 6K G2': 'BMPCC6KG2',
  'POCKET CINEMA CAMERA 6K PRO': 'BMPCC6KPRO',
  'CINEMA CAMERA 6K': 'BMCC6K',
  'URSA MINI PRO 12K': 'URSAMINIPRO12K',
  'MAVIC 3 PRO CINE': 'MAVIC3PROCINE',
};

/**
 * Creates a normalized firmware track key from brand + model.
 * Ensures "Canon EOS R5" and "Canon EOS R5 (Body)" both map to "CANON|EOSR5".
 */
export function buildFirmwareTrackKey(brand: string, model: string): string {
  let b = (brand || '').toUpperCase().trim();
  let m = (model || '').toUpperCase().trim();

  // Apply brand aliases
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (b === alias) b = canonical;
  }

  // Apply full model aliases first (before stripping words)
  for (const [alias, canonical] of Object.entries(MODEL_ALIASES)) {
    if (m === alias || m.includes(alias)) {
      m = canonical;
      break;
    }
  }

  // Apply mark replacements
  for (const [pattern, replacement] of Object.entries(MARK_REPLACEMENTS)) {
    m = m.replace(pattern, replacement);
  }

  // Strip noise words
  for (const word of STRIP_WORDS) {
    m = m.replace(new RegExp(word.replace(/[()[\]]/g, '\\$&'), 'g'), '');
  }

  // Remove all non-alphanumeric characters
  b = b.replace(/[^A-Z0-9]/g, '');
  m = m.replace(/[^A-Z0-9]/g, '');

  return `${b}|${m}`;
}

// ═══════════════════════════════════════════════════════════════════
// Version Comparison
// ═══════════════════════════════════════════════════════════════════

/**
 * Compare two version strings.
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const pa = (a || '').split('.').map(Number);
  const pb = (b || '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface CatalogEntry {
  id?: number;
  manufacturer: string;
  model: string;
  version: string;
  releaseDate: string | null;
  downloadUrl: string;
  releaseNotesUrl: string | null;
  checksum: string | null;
  sourceType: 'api' | 'scrape' | 'manual' | 'builtin';
  sourceUrl: string | null;
  description: string | null;
  importance: 'critical' | 'important' | 'recommended' | 'optional';
  fetchedAt?: string;
}

export interface MatchResult {
  equipmentId: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  severity: string;
  downloadUrl: string | null;
  releaseNotesUrl: string | null;
  checkedAt: string;
}

export interface FirmwareStatus {
  status: 'up-to-date' | 'update-available' | 'unknown' | 'needs-mapping';
  currentVersion: string | null;
  latestVersion: string | null;
  severity: string | null;
  downloadUrl: string | null;
  releaseNotesUrl: string | null;
  catalogEntry: CatalogEntry | null;
  checkedAt: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// Firmware Service
// ═══════════════════════════════════════════════════════════════════

export class FirmwareService {
  constructor(private pool: Pool) {}

  // ── Catalog CRUD ───────────────────────────────────────────────

  /**
   * Upsert a catalog entry using the DB function.
   * Falls back to raw INSERT/UPDATE if the function doesn't exist.
   */
  async upsertCatalogEntry(entry: CatalogEntry): Promise<CatalogEntry> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM upsert_firmware_catalog($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          entry.manufacturer,
          entry.model,
          entry.version,
          entry.releaseDate || null,
          entry.downloadUrl || null,
          entry.releaseNotesUrl || null,
          entry.checksum || null,
          entry.sourceType || 'manual',
          entry.sourceUrl || null,
          entry.description || null,
          entry.importance || 'optional',
        ]
      );
      return this.rowToCatalogEntry(result.rows[0]);
    } catch {
      // Fallback: direct INSERT ON CONFLICT
      const result = await this.pool.query(
        `INSERT INTO firmware_catalog
           (manufacturer, model, version, release_date, download_url,
            release_notes_url, checksum, source_type, source_url,
            description, importance, fetched_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
         ON CONFLICT (manufacturer, model, version)
         DO UPDATE SET
           release_date = COALESCE(EXCLUDED.release_date, firmware_catalog.release_date),
           download_url = COALESCE(EXCLUDED.download_url, firmware_catalog.download_url),
           release_notes_url = COALESCE(EXCLUDED.release_notes_url, firmware_catalog.release_notes_url),
           checksum = COALESCE(EXCLUDED.checksum, firmware_catalog.checksum),
           source_type = EXCLUDED.source_type,
           source_url = COALESCE(EXCLUDED.source_url, firmware_catalog.source_url),
           description = COALESCE(EXCLUDED.description, firmware_catalog.description),
           importance = EXCLUDED.importance,
           fetched_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [
          entry.manufacturer, entry.model, entry.version,
          entry.releaseDate || null, entry.downloadUrl || null,
          entry.releaseNotesUrl || null, entry.checksum || null,
          entry.sourceType || 'manual', entry.sourceUrl || null,
          entry.description || null, entry.importance || 'optional',
        ]
      );
      return this.rowToCatalogEntry(result.rows[0]);
    }
  }

  /** Get all catalog entries, optionally filtered by manufacturer */
  async getCatalog(manufacturer?: string): Promise<CatalogEntry[]> {
    let query: string;
    const params: string[] = [];

    if (manufacturer) {
      query = `SELECT DISTINCT ON (manufacturer, model)
               * FROM firmware_catalog
               WHERE LOWER(manufacturer) = LOWER($1)
               ORDER BY manufacturer, model, release_date DESC NULLS LAST`;
      params.push(manufacturer);
    } else {
      query = `SELECT DISTINCT ON (manufacturer, model)
               * FROM firmware_catalog
               ORDER BY manufacturer, model, release_date DESC NULLS LAST`;
    }

    const result = await this.pool.query(query, params);
    return result.rows.map((r: Record<string, unknown>) => this.rowToCatalogEntry(r));
  }

  /** Find the latest catalog entry for a given manufacturer+model */
  async getLatestForModel(manufacturer: string, model: string): Promise<CatalogEntry | null> {
    // 1. Exact match
    let result = await this.pool.query(
      `SELECT * FROM firmware_catalog
       WHERE LOWER(manufacturer) = LOWER($1) AND LOWER(model) = LOWER($2)
       ORDER BY release_date DESC NULLS LAST, version DESC LIMIT 1`,
      [manufacturer, model]
    );
    if (result.rows.length > 0) {
      return this.rowToCatalogEntry(result.rows[0]);
    }

    // 2. Track-key fuzzy match
    const trackKey = buildFirmwareTrackKey(manufacturer, model);
    const [brandKey, modelKey] = trackKey.split('|');

    result = await this.pool.query(
      `SELECT * FROM firmware_catalog
       ORDER BY release_date DESC NULLS LAST, version DESC`
    );

    for (const row of result.rows) {
      const rowKey = buildFirmwareTrackKey(row.manufacturer, row.model);
      const [rowBrand, rowModel] = rowKey.split('|');
      if (rowBrand === brandKey && rowModel === modelKey) {
        return this.rowToCatalogEntry(row);
      }
    }

    return null;
  }

  /** Search catalog entries for model mapping UI */
  async searchCatalog(query: string): Promise<CatalogEntry[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (manufacturer, model) *
       FROM firmware_catalog
       WHERE LOWER(manufacturer) || ' ' || LOWER(model) LIKE $1
       ORDER BY manufacturer, model, release_date DESC NULLS LAST
       LIMIT 20`,
      [`%${query.toLowerCase()}%`]
    );
    return result.rows.map((r: Record<string, unknown>) => this.rowToCatalogEntry(r));
  }

  /** Delete a catalog entry by ID */
  async deleteCatalogEntry(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM firmware_catalog WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Equipment Firmware Check ───────────────────────────────────

  /**
   * Check firmware status for a single equipment item.
   */
  async checkEquipmentFirmware(
    equipmentId: string,
    brand: string,
    model: string,
    currentVersion: string | null
  ): Promise<FirmwareStatus> {
    const catalogEntry = await this.getLatestForModel(brand, model);

    if (!catalogEntry) {
      return {
        status: 'needs-mapping',
        currentVersion,
        latestVersion: null,
        severity: null,
        downloadUrl: null,
        releaseNotesUrl: null,
        catalogEntry: null,
        checkedAt: new Date().toISOString(),
      };
    }

    if (!currentVersion) {
      return {
        status: 'unknown',
        currentVersion: null,
        latestVersion: catalogEntry.version,
        severity: catalogEntry.importance,
        downloadUrl: catalogEntry.downloadUrl,
        releaseNotesUrl: catalogEntry.releaseNotesUrl,
        catalogEntry,
        checkedAt: new Date().toISOString(),
      };
    }

    const cmp = compareVersions(catalogEntry.version, currentVersion);
    const isUpdateAvailable = cmp > 0;

    // Cache match result
    await this.saveMatchResult({
      equipmentId,
      latestVersion: catalogEntry.version,
      isUpdateAvailable,
      severity: catalogEntry.importance,
      downloadUrl: catalogEntry.downloadUrl,
      releaseNotesUrl: catalogEntry.releaseNotesUrl,
      checkedAt: new Date().toISOString(),
    });

    return {
      status: isUpdateAvailable ? 'update-available' : 'up-to-date',
      currentVersion,
      latestVersion: catalogEntry.version,
      severity: catalogEntry.importance,
      downloadUrl: catalogEntry.downloadUrl,
      releaseNotesUrl: catalogEntry.releaseNotesUrl,
      catalogEntry,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Batch check: evaluate all equipment items with auto-check enabled
   */
  async checkAllEquipment(): Promise<MatchResult[]> {
    const eqResult = await this.pool.query(
      `SELECT id, brand, model, firmware_current, firmware_version, firmware_track_key
       FROM user_equipment
       WHERE (firmware_auto_check_enabled IS NULL OR firmware_auto_check_enabled = TRUE)
         AND brand IS NOT NULL AND model IS NOT NULL`
    );

    const results: MatchResult[] = [];

    for (const row of eqResult.rows) {
      const status = await this.checkEquipmentFirmware(
        String(row.id),
        row.brand,
        row.model,
        row.firmware_current || row.firmware_version || null
      );
      if (status.latestVersion) {
        results.push({
          equipmentId: String(row.id),
          latestVersion: status.latestVersion,
          isUpdateAvailable: status.status === 'update-available',
          severity: status.severity || 'optional',
          downloadUrl: status.downloadUrl,
          releaseNotesUrl: status.releaseNotesUrl,
          checkedAt: status.checkedAt || new Date().toISOString(),
        });
      }
    }

    return results;
  }

  // ── Match Results ──────────────────────────────────────────────

  async saveMatchResult(match: MatchResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO firmware_match_results
           (equipment_id, latest_version, is_update_available, severity,
            download_url, release_notes_url, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (equipment_id)
         DO UPDATE SET
           latest_version = EXCLUDED.latest_version,
           is_update_available = EXCLUDED.is_update_available,
           severity = EXCLUDED.severity,
           download_url = EXCLUDED.download_url,
           release_notes_url = EXCLUDED.release_notes_url,
           checked_at = EXCLUDED.checked_at`,
        [
          match.equipmentId,
          match.latestVersion,
          match.isUpdateAvailable,
          match.severity,
          match.downloadUrl,
          match.releaseNotesUrl,
          match.checkedAt,
        ]
      );
    } catch (err) {
      console.warn('[firmware] Could not save match result:', err);
    }
  }

  async getMatchResult(equipmentId: string): Promise<MatchResult | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM firmware_match_results WHERE equipment_id = $1',
        [equipmentId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        equipmentId: row.equipment_id,
        latestVersion: row.latest_version,
        isUpdateAvailable: row.is_update_available,
        severity: row.severity,
        downloadUrl: row.download_url,
        releaseNotesUrl: row.release_notes_url,
        checkedAt: row.checked_at,
      };
    } catch {
      return null;
    }
  }

  // ── Track Key Management ───────────────────────────────────────

  /**
   * Rebuild track keys for all equipment rows.
   */
  async rebuildTrackKeys(): Promise<number> {
    const eqResult = await this.pool.query(
      `SELECT id, brand, model FROM user_equipment WHERE brand IS NOT NULL AND model IS NOT NULL`
    );

    let updated = 0;
    for (const row of eqResult.rows) {
      const key = buildFirmwareTrackKey(row.brand, row.model);
      await this.pool.query(
        `UPDATE user_equipment SET firmware_track_key = $1 WHERE id = $2`,
        [key, row.id]
      );
      updated++;
    }
    return updated;
  }

  /**
   * Map an equipment item to a specific catalog model (for "needs mapping" UX)
   */
  async mapEquipmentToModel(
    equipmentId: string,
    catalogManufacturer: string,
    catalogModel: string
  ): Promise<void> {
    const key = buildFirmwareTrackKey(catalogManufacturer, catalogModel);
    await this.pool.query(
      `UPDATE user_equipment SET firmware_track_key = $1 WHERE id = $2`,
      [key, equipmentId]
    );
  }

  // ── Helpers ────────────────────────────────────────────────────

  private rowToCatalogEntry(row: Record<string, unknown>): CatalogEntry {
    return {
      id: row.id as number,
      manufacturer: row.manufacturer as string,
      model: row.model as string,
      version: row.version as string,
      releaseDate: row.release_date ? String(row.release_date) : null,
      downloadUrl: (row.download_url as string) || '',
      releaseNotesUrl: (row.release_notes_url as string) || null,
      checksum: (row.checksum as string) || null,
      sourceType: (row.source_type as CatalogEntry['sourceType']) || 'manual',
      sourceUrl: (row.source_url as string) || null,
      description: (row.description as string) || null,
      importance: (row.importance as CatalogEntry['importance']) || 'optional',
      fetchedAt: row.fetched_at ? String(row.fetched_at) : undefined,
    };
  }
}
