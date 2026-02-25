/**
 * Equipment Management API Routes (v2)
 *
 * Mounted at /api/equipment/v2/...
 * Provides:
 *  - Full CRUD for user_equipment (GET, POST, PUT, PATCH, DELETE)
 *  - Equipment library catalog search with autocomplete
 *  - User stats & firmware status
 *  - Scene‑aware equipment intelligence
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { EquipmentIntelligenceService } from './equipmentIntelligenceService';

// ─────────────────────────────────────────────────────────────
// Scene-aware intelligence data (static recommendations)
// ─────────────────────────────────────────────────────────────

interface SceneSuggestion {
  category: string;
  brand: string;
  model: string;
  reason: string;
}

interface SceneProfile {
  required: string[];
  recommended: string[];
  suggested: SceneSuggestion[];
  tips: string[];
}

const SCENE_PROFILES: Record<string, SceneProfile> = {
  interview: {
    required: ['camera', 'audio', 'lighting'],
    recommended: ['monitor', 'support', 'power'],
    suggested: [
      { category: 'camera', brand: 'Sony', model: 'FX6', reason: 'Utmerket dual-base ISO for intervjuer med variabelt lys' },
      { category: 'audio', brand: 'Sennheiser', model: 'MKE 600', reason: 'Bransjestandard hagle-mikrofon for dialog' },
      { category: 'audio', brand: 'Rode', model: 'Wireless PRO', reason: 'Pålitelig trådløs lav for gjester' },
      { category: 'lighting', brand: 'Aputure', model: '600d Pro', reason: 'Kraftig key-light med Bowens-feste' },
    ],
    tips: [
      'Bruk 3-punkts belysning: key, fill og bakgrunn',
      'Plasser lav-mikrofon 15-20cm fra munnen',
      'Sett bakgrunn minst 2 meter fra subjekt for dybdeskarphet',
      'Ha alltid backup trådløs mikrofon klar',
    ],
  },
  dialogue: {
    required: ['camera', 'audio', 'lighting'],
    recommended: ['monitor', 'stabilizer', 'wireless_video'],
    suggested: [
      { category: 'audio', brand: 'Sound Devices', model: 'MixPre 6 III', reason: 'Flerkanals opptak for dialog-miks' },
      { category: 'audio', brand: 'Deity', model: 'Theos', reason: 'Dual-kanal trådløs for to skuespillere' },
    ],
    tips: [
      'Boom-mikrofon over kamera for beste dialog-kvalitet',
      'Bruk trådløs lav som backup, ikke primærkilde',
      'Unngå harde flater som skaper romklang',
    ],
  },
  action: {
    required: ['camera', 'stabilizer', 'audio'],
    recommended: ['wireless_video', 'monitor', 'power', 'media'],
    suggested: [
      { category: 'stabilizer', brand: 'DJI', model: 'RS 4 Pro', reason: 'Sterk nok for kino-kameraer med objektiv' },
      { category: 'camera', brand: 'Blackmagic Design', model: 'Pocket Cinema Camera 6K G2', reason: 'Lett kamerahaus for gimbal-bruk' },
      { category: 'wireless_video', brand: 'Teradek', model: 'Bolt 4K LT 750', reason: 'Lav latens for live monitoring på avstand' },
    ],
    tips: [
      'Alltid test gimbal-balanse med fullt rig før opptak',
      'Ha V-mount batterier for full dags dreie',
      'Bruk 2x CFexpress-kort for dual-slot backup',
    ],
  },
  establishing: {
    required: ['camera', 'lens', 'support'],
    recommended: ['drone', 'media', 'power'],
    suggested: [
      { category: 'drone', brand: 'DJI', model: 'Mavic 3 Pro', reason: 'Tre kameraer gir fleksible brennvidder' },
      { category: 'support', brand: 'Sachtler', model: 'aktiv10T', reason: 'Presis panorering for bredt oversiktsbilde' },
    ],
    tips: [
      'Bruk ND-filter for å holde lukkertid på 180° shutter angle',
      'Plan drone-flyging i forkant — sjekk luftrom og vær',
      'Etablerende bilder trenger lav ISO for maksimal dynamikk',
    ],
  },
  close_up: {
    required: ['camera', 'lens', 'lighting'],
    recommended: ['support', 'monitor'],
    suggested: [
      { category: 'lens', brand: 'Canon', model: 'RF 100mm f/2.8L Macro IS USM', reason: 'Ekte 1:1 makro med IS' },
      { category: 'support', brand: 'Edelkrone', model: 'SliderPLUS v5', reason: 'Presis bevegelse for reveal-shots' },
    ],
    tips: [
      'Bruk fokus-peaking på monitoren for manuell fokus',
      'Minimer kamerabevegelse — bruk stativ eller slider',
      'Soft-light nær objektet gir best teksturvisning',
    ],
  },
  product: {
    required: ['camera', 'lens', 'lighting'],
    recommended: ['support', 'monitor', 'media'],
    suggested: [
      { category: 'lighting', brand: 'Nanlite', model: 'Forza 150B', reason: 'Bi-color for presis fargetemperatur' },
      { category: 'support', brand: 'Edelkrone', model: 'HeadPLUS v2', reason: 'Motorisert 360° produktrotasjon' },
    ],
    tips: [
      'Hvit/grå bakgrunn for lettest etterarbeid',
      'Diffusert lys eliminerer refleksjoner på blanke produkter',
      'Skyt RAW for maksimal fleksibilitet i fargekorrigering',
    ],
  },
  documentary: {
    required: ['camera', 'audio', 'lighting'],
    recommended: ['stabilizer', 'drone', 'media', 'power'],
    suggested: [
      { category: 'camera', brand: 'Sony', model: 'FX3', reason: 'Kompakt full-frame i dokumentar-stil gehus' },
      { category: 'audio', brand: 'DJI', model: 'Mic 2', reason: 'Brukervennlig trådløs for run-and-gun' },
      { category: 'media', brand: 'Samsung', model: 'T9 4TB', reason: 'Rask feltlagring for lange dreiedager' },
    ],
    tips: [
      'Pakk lett — dokumentararbeid krever mobilitet',
      'Ha alltid ekstra batteri og minne tilgjengelig',
      'Bruk intern ND fremfor variabelt ND-filter for bedre skarphet',
    ],
  },
  wedding: {
    required: ['camera', 'lens', 'audio', 'lighting'],
    recommended: ['stabilizer', 'media', 'power', 'drone'],
    suggested: [
      { category: 'camera', brand: 'Canon', model: 'EOS R5 Mark II', reason: 'Utmerket autofokus i skiftende lys' },
      { category: 'lens', brand: 'Canon', model: 'RF 28-70mm f/2L USM', reason: 'Lyssterkt allround-zoom' },
      { category: 'audio', brand: 'Rode', model: 'Wireless PRO', reason: 'Diskret trådløs for taleopptak' },
      { category: 'stabilizer', brand: 'DJI', model: 'RS 4', reason: 'Lett gimbal for håndholdt ceremoni-video' },
    ],
    tips: [
      'Ha to kamerahus — alltid backup',
      'Test all lyd i lokalet FØR seremonien',
      'Lad alle batterier kvelden før — pack dobbelt',
      'Scout lokasjon i forkant for lysforhold',
    ],
  },
  live_event: {
    required: ['camera', 'audio', 'lighting', 'wireless_video'],
    recommended: ['monitor', 'power', 'media', 'support'],
    suggested: [
      { category: 'wireless_video', brand: 'Hollyland', model: 'Mars 4K', reason: 'Flerkanals mottak for live-regi' },
      { category: 'camera', brand: 'Blackmagic Design', model: 'URSA Broadcast G2', reason: 'Robust kamera med B4-feste og SDI-ut' },
      { category: 'monitor', brand: 'SmallHD', model: 'Cine 24', reason: 'Stor storskjerm for live-preview' },
    ],
    tips: [
      'Kabel-trekk planlegges før rigging — tape ned alle kabler',
      'Ha UPS/backup-strøm for kritisk utstyr',
      'Genprøve med fullt utstyr minst 1 time før event',
    ],
  },
  commercial: {
    required: ['camera', 'lens', 'lighting', 'audio'],
    recommended: ['stabilizer', 'monitor', 'wireless_video', 'support', 'power'],
    suggested: [
      { category: 'camera', brand: 'RED Digital Cinema', model: 'V-RAPTOR [X]', reason: '8K sensor for maksimal post-fleksibilitet' },
      { category: 'lighting', brand: 'ARRI', model: 'SkyPanel S60-C', reason: 'Perfekt fargenøyaktighet (CRI 95+)' },
      { category: 'monitor', brand: 'SmallHD', model: 'Cine 13', reason: 'HDR-preview for klient-godkjenning' },
    ],
    tips: [
      'Bruk fargesjekk (X-Rite) ved oppstart av hver dreiedag',
      'Sett opp klient-monitor med wireless feed',
      'Lag utstyrsliste og sjekkliste per shot/scene',
    ],
  },
  music_video: {
    required: ['camera', 'lighting', 'stabilizer', 'audio'],
    recommended: ['monitor', 'wireless_video', 'media', 'support'],
    suggested: [
      { category: 'stabilizer', brand: 'DJI', model: 'Ronin 4D', reason: 'Integrert kamera+gimbal for flytende bevegelse' },
      { category: 'lighting', brand: 'Nanlite', model: 'PavoTube II 30X', reason: 'RGB-rør for kreative lyseffekter' },
    ],
    tips: [
      'Playback-system med høyttaler er kritisk for lipsync',
      'Bruk timecode-synk mellom kamera og lyd',
      'Ha variasjon i bevegelse: gimbal, dolly, stativ, håndholdt',
    ],
  },
  aerial: {
    required: ['drone'],
    recommended: ['camera', 'monitor', 'power', 'media'],
    suggested: [
      { category: 'drone', brand: 'DJI', model: 'Inspire 3', reason: 'Full-frame sensor med utskiftbare objektiver' },
      { category: 'drone', brand: 'DJI', model: 'Mavic 3 Pro', reason: 'Tre brennvidder i kompakt droneformat' },
    ],
    tips: [
      'Sjekk NOTAM/UAS-soner før flyging — Flydatas app er påkrevd i Norge',
      'Aldri fly ved vind over 10 m/s med forbrukerdrone',
      'Ha spotter dedikert som ser dronen under hele flyturen',
    ],
  },
  timelapse: {
    required: ['camera', 'support'],
    recommended: ['power', 'media', 'lens'],
    suggested: [
      { category: 'support', brand: 'Edelkrone', model: 'HeadPLUS v2', reason: 'Motorisert panorering for hyperlapse' },
      { category: 'power', brand: 'Anton Bauer', model: 'Titon SL 240', reason: 'Lang batteritid for nattlige timelapse' },
    ],
    tips: [
      'Bruk intervallometer med manuell eksponering',
      'RAW er foretrukket for flicker-reduksjon i post',
      'Beregn lagringsbruk: 1 bilde/5 sek × 4 timer = 2880 RAW-bilder',
    ],
  },
  vlog: {
    required: ['camera', 'audio'],
    recommended: ['lighting', 'stabilizer', 'media'],
    suggested: [
      { category: 'camera', brand: 'Sony', model: 'ZV-E1', reason: 'Full-frame vlog-kamera med utmerket autofokus' },
      { category: 'audio', brand: 'DJI', model: 'Mic 2', reason: 'Ultrakompakt trådløs med innebygd opptak' },
      { category: 'lighting', brand: 'Godox', model: 'ML60', reason: 'Bærbar key-light for vlog-oppsett' },
    ],
    tips: [
      'Test lyden før du starter — dårlig lyd ødelegger alt',
      'Naturlig lys pluss én LED gir best resultat on-the-go',
      'Kort brennvidde (16-35mm) for selfie-modus',
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Router factory
// ─────────────────────────────────────────────────────────────

export function createEquipmentRouter(pool: Pool): Router {
  const router = Router();

  // ── Helpers ──

  async function query(text: string, params: unknown[] = []) {
    const result = await pool.query(text, params);
    return result.rows;
  }

  function normalizeRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name || `${row.brand || ''} ${row.model || ''}`.trim(),
      brand: row.brand,
      model: row.model,
      category: row.category,
      serial_number: row.serial_number,
      status: row.status || row.condition || 'available',
      condition: row.condition || 'good',
      purchase_date: row.purchase_date,
      purchase_price: row.purchase_price ? Number(row.purchase_price) : null,
      current_value: row.current_value ? Number(row.current_value) : null,
      warranty_expiry: row.warranty_expiry,
      last_maintenance: row.last_maintenance,
      next_maintenance: row.next_maintenance,
      maintenance_interval: row.maintenance_interval,
      firmware_current: row.firmware_current,
      firmware_track_key: row.firmware_track_key,
      firmware_auto_check_enabled: row.firmware_auto_check_enabled ?? false,
      notes: row.notes,
      image_url: row.image_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // USER EQUIPMENT CRUD
  // ══════════════════════════════════════════════════════════════

  /**
   * GET /
   * List equipment for a user.  ?userId=xxx  (required)
   * Optional: ?category=camera&search=sony
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(400).json({ ok: false, error: 'Missing userId' });
        return;
      }

      let sql = `SELECT * FROM user_equipment WHERE user_id = $1`;
      const params: unknown[] = [userId];

      if (req.query.category) {
        sql += ` AND category = $${params.length + 1}`;
        params.push(req.query.category);
      }
      if (req.query.search) {
        sql += ` AND (brand ILIKE $${params.length + 1} OR model ILIKE $${params.length + 1})`;
        params.push(`%${req.query.search}%`);
      }

      sql += ` ORDER BY created_at DESC`;
      const rows = await query(sql, params);
      res.json({ ok: true, data: rows.map(normalizeRow), count: rows.length });
    } catch (err) {
      console.error('[equipment] GET / error:', err);
      res.status(500).json({ ok: false, error: 'Failed to list equipment' });
    }
  });

  /**
   * GET /user/:userId
   * Alias for GET /?userId=... — fixes broken frontend endpoint.
   */
  router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const rows = await query(
        `SELECT * FROM user_equipment WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      // Map to legacy camelCase format expected by EquipmentManagement.tsx
      const mapped = rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        userId: row.user_id,
        profession: row.user_type,
        equipmentType: row.category,
        brand: row.brand,
        model: row.model,
        serialNumber: row.serial_number,
        condition: row.condition || 'good',
        isActive: (row.condition as string) !== 'retired',
        currentFirmwareVersion: row.firmware_current || row.firmware_version,
        latestFirmwareVersion: null,
        firmwareUpdateAvailable: false,
        purchaseDate: row.purchase_date,
        purchasePrice: row.purchase_price ? Number(row.purchase_price) : null,
        warrantyExpiry: row.warranty_expiry,
        lastUsed: row.updated_at,
        totalShots: null,
        totalHours: null,
        location: null,
      }));

      res.json(mapped);
    } catch (err) {
      console.error('[equipment] GET /user/:userId error:', err);
      res.status(500).json({ error: 'Failed to list equipment' });
    }
  });

  /**
   * GET /stats/:userId
   * Equipment statistics for a user — fixes broken frontend endpoint.
   */
  router.get('/stats/:userId', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const rows = await query(
        `SELECT category, condition, count(*)::int as cnt FROM user_equipment WHERE user_id = $1 GROUP BY category, condition`,
        [userId]
      );

      const total = rows.reduce((s: number, r: Record<string, unknown>) => s + (r.cnt as number), 0);
      const byCategory: Record<string, number> = {};
      const byCondition: Record<string, number> = {};
      rows.forEach((r: Record<string, unknown>) => {
        const cat = (r.category as string) || 'other';
        const cond = (r.condition as string) || 'unknown';
        byCategory[cat] = (byCategory[cat] || 0) + (r.cnt as number);
        byCondition[cond] = (byCondition[cond] || 0) + (r.cnt as number);
      });

      // Firmware stats
      const fwRows = await query(
        `SELECT
           count(*)::int as total,
           count(firmware_current)::int as with_firmware,
           count(firmware_track_key)::int as tracked
         FROM user_equipment WHERE user_id = $1`,
        [userId]
      );
      const fw = fwRows[0] || { total: 0, with_firmware: 0, tracked: 0 };

      // Maintenance due
      const maintRows = await query(
        `SELECT count(*)::int as due
         FROM user_equipment
         WHERE user_id = $1
           AND next_maintenance IS NOT NULL
           AND next_maintenance::date <= CURRENT_DATE + interval '30 days'`,
        [userId]
      );

      res.json({
        totalEquipment: total,
        byCategory,
        byCondition,
        firmware: {
          total: fw.total,
          withFirmware: fw.with_firmware,
          tracked: fw.tracked,
        },
        maintenanceDueSoon: (maintRows[0] as Record<string, unknown>)?.due || 0,
      });
    } catch (err) {
      console.error('[equipment] GET /stats/:userId error:', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  /**
   * GET /firmware-updates/:userId
   * Firmware status for a user's tracked equipment — fixes broken endpoint.
   */
  router.get('/firmware-updates/:userId', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const rows = await query(
        `SELECT ue.id, ue.brand, ue.model, ue.category,
                ue.firmware_current, ue.firmware_track_key,
                fc.version as latest_version, fc.release_date,
                fc.release_notes_url
         FROM user_equipment ue
         LEFT JOIN firmware_catalog fc
           ON ue.firmware_track_key = fc.track_key
           AND fc.is_latest = true
         WHERE ue.user_id = $1
           AND ue.firmware_track_key IS NOT NULL
         ORDER BY ue.brand, ue.model`,
        [userId]
      );

      const mapped = rows.map((r: Record<string, unknown>) => ({
        equipmentId: r.id,
        brand: r.brand,
        model: r.model,
        category: r.category,
        currentVersion: r.firmware_current,
        latestVersion: r.latest_version,
        updateAvailable:
          r.latest_version && r.firmware_current
            ? String(r.latest_version) !== String(r.firmware_current)
            : false,
        releaseDate: r.release_date,
        releaseNotesUrl: r.release_notes_url,
      }));

      res.json(mapped);
    } catch (err) {
      console.error('[equipment] GET /firmware-updates/:userId error:', err);
      res.status(500).json({ error: 'Failed to get firmware updates' });
    }
  });

  /**
   * GET /:id
   * Get single equipment item by ID.
   */
  router.get('/:id(\\d+)', async (req: Request, res: Response) => {
    try {
      const rows = await query(`SELECT * FROM user_equipment WHERE id = $1`, [req.params.id]);
      if (!rows.length) {
        res.status(404).json({ ok: false, error: 'Equipment not found' });
        return;
      }
      res.json({ ok: true, data: normalizeRow(rows[0]) });
    } catch (err) {
      console.error('[equipment] GET /:id error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get equipment' });
    }
  });

  /**
   * POST /
   * Create a new equipment item.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const {
        userId, user_id, profession, brand, model, category,
        serial_number, serialNumber, condition, status,
        purchase_date, purchaseDate, purchase_price, purchasePrice,
        warranty_expiry, warrantyExpiry, notes, image_url,
        firmware_current, firmware_track_key, firmware_auto_check_enabled,
      } = req.body || {};

      const uid = userId || user_id;
      if (!uid || !brand || !model) {
        res.status(400).json({ ok: false, error: 'Missing required fields: userId, brand, model' });
        return;
      }

      const rows = await query(
        `INSERT INTO user_equipment (
           user_id, user_type, brand, model, category,
           serial_number, condition, purchase_date, purchase_price,
           warranty_expiry, notes, image_url,
           firmware_current, firmware_track_key, firmware_auto_check_enabled,
           settings, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
         RETURNING *`,
        [
          uid,
          profession || null,
          brand,
          model,
          category || null,
          serial_number || serialNumber || null,
          condition || status || 'good',
          purchase_date || purchaseDate || null,
          purchase_price || purchasePrice || null,
          warranty_expiry || warrantyExpiry || null,
          notes || null,
          image_url || null,
          firmware_current || null,
          firmware_track_key || null,
          firmware_auto_check_enabled ?? null,
          JSON.stringify({ status: status || condition || 'Tilgjengelig' }),
        ]
      );

      res.json({ ok: true, data: normalizeRow(rows[0]) });
    } catch (err) {
      console.error('[equipment] POST / error:', err);
      res.status(500).json({ ok: false, error: 'Failed to create equipment' });
    }
  });

  /**
   * PUT /:id
   * Full update of an equipment item.
   */
  router.put('/:id(\\d+)', async (req: Request, res: Response) => {
    try {
      const {
        brand, model, category, serial_number, condition, status,
        purchase_date, purchase_price, current_value,
        warranty_expiry, last_maintenance, next_maintenance,
        maintenance_interval, notes, image_url,
        firmware_current, firmware_track_key, firmware_auto_check_enabled,
      } = req.body || {};

      const rows = await query(
        `UPDATE user_equipment SET
           brand = COALESCE($1, brand),
           model = COALESCE($2, model),
           category = COALESCE($3, category),
           serial_number = COALESCE($4, serial_number),
           condition = COALESCE($5, condition),
           purchase_date = COALESCE($6, purchase_date),
           purchase_price = COALESCE($7, purchase_price),
           current_value = COALESCE($8, current_value),
           warranty_expiry = COALESCE($9, warranty_expiry),
           last_maintenance = COALESCE($10, last_maintenance),
           next_maintenance = COALESCE($11, next_maintenance),
           maintenance_interval = COALESCE($12, maintenance_interval),
           notes = COALESCE($13, notes),
           image_url = COALESCE($14, image_url),
           firmware_current = COALESCE($15, firmware_current),
           firmware_track_key = COALESCE($16, firmware_track_key),
           firmware_auto_check_enabled = COALESCE($17, firmware_auto_check_enabled),
           updated_at = NOW()
         WHERE id = $18
         RETURNING *`,
        [
          brand, model, category, serial_number,
          condition || status, purchase_date, purchase_price, current_value,
          warranty_expiry, last_maintenance, next_maintenance,
          maintenance_interval, notes, image_url,
          firmware_current, firmware_track_key, firmware_auto_check_enabled,
          req.params.id,
        ]
      );

      if (!rows.length) {
        res.status(404).json({ ok: false, error: 'Equipment not found' });
        return;
      }
      res.json({ ok: true, data: normalizeRow(rows[0]) });
    } catch (err) {
      console.error('[equipment] PUT /:id error:', err);
      res.status(500).json({ ok: false, error: 'Failed to update equipment' });
    }
  });

  /**
   * PATCH /:id
   * Partial update — only provided fields are updated.
   */
  router.patch('/:id(\\d+)', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const allowedFields: Record<string, string> = {
        brand: 'brand', model: 'model', category: 'category',
        serial_number: 'serial_number', condition: 'condition',
        purchase_date: 'purchase_date', purchase_price: 'purchase_price',
        current_value: 'current_value', warranty_expiry: 'warranty_expiry',
        last_maintenance: 'last_maintenance', next_maintenance: 'next_maintenance',
        maintenance_interval: 'maintenance_interval',
        notes: 'notes', image_url: 'image_url',
        firmware_current: 'firmware_current',
        firmware_track_key: 'firmware_track_key',
        firmware_auto_check_enabled: 'firmware_auto_check_enabled',
        firmware_version: 'firmware_version',
        status: 'condition',
      };

      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [inputKey, dbCol] of Object.entries(allowedFields)) {
        if (body[inputKey] !== undefined) {
          vals.push(body[inputKey]);
          sets.push(`${dbCol} = $${vals.length}`);
        }
      }

      if (!sets.length) {
        res.status(400).json({ ok: false, error: 'No updatable fields provided' });
        return;
      }

      vals.push(req.params.id);
      sets.push('updated_at = NOW()');
      const rows = await query(
        `UPDATE user_equipment SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
        vals
      );

      if (!rows.length) {
        res.status(404).json({ ok: false, error: 'Equipment not found' });
        return;
      }
      res.json({ ok: true, data: normalizeRow(rows[0]) });
    } catch (err) {
      console.error('[equipment] PATCH /:id error:', err);
      res.status(500).json({ ok: false, error: 'Failed to patch equipment' });
    }
  });

  /**
   * DELETE /:id
   * Delete an equipment item.
   */
  router.delete('/:id(\\d+)', async (req: Request, res: Response) => {
    try {
      const rows = await query(
        `DELETE FROM user_equipment WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ ok: false, error: 'Equipment not found' });
        return;
      }
      res.json({ ok: true, deleted: rows[0].id });
    } catch (err) {
      console.error('[equipment] DELETE /:id error:', err);
      res.status(500).json({ ok: false, error: 'Failed to delete equipment' });
    }
  });

  /**
   * POST /check-firmware/:equipmentId
   * Check firmware for a specific equipment — fixes broken endpoint.
   */
  router.post('/check-firmware/:equipmentId', async (req: Request, res: Response) => {
    try {
      const equipmentId = req.params.equipmentId;

      // Get equipment track key
      const eqRows = await query(
        `SELECT firmware_track_key, firmware_current FROM user_equipment WHERE id = $1`,
        [equipmentId]
      );
      if (!eqRows.length) {
        res.status(404).json({ error: 'Equipment not found' });
        return;
      }

      const eq = eqRows[0] as Record<string, unknown>;
      if (!eq.firmware_track_key) {
        res.json({
          equipmentId,
          updateAvailable: false,
          message: 'No firmware tracking configured for this equipment',
        });
        return;
      }

      // Check against firmware_catalog
      const fwRows = await query(
        `SELECT version, release_date, release_notes_url
         FROM firmware_catalog
         WHERE track_key = $1 AND is_latest = true
         LIMIT 1`,
        [eq.firmware_track_key]
      );

      if (!fwRows.length) {
        res.json({
          equipmentId,
          currentVersion: eq.firmware_current,
          updateAvailable: false,
          message: 'No catalog entry found for this equipment',
        });
        return;
      }

      const fw = fwRows[0] as Record<string, unknown>;
      const updateAvailable = fw.version && eq.firmware_current
        ? String(fw.version) !== String(eq.firmware_current)
        : false;

      res.json({
        equipmentId,
        currentVersion: eq.firmware_current,
        latestVersion: fw.version,
        updateAvailable,
        releaseDate: fw.release_date,
        releaseNotesUrl: fw.release_notes_url,
      });
    } catch (err) {
      console.error('[equipment] POST /check-firmware/:id error:', err);
      res.status(500).json({ error: 'Failed to check firmware' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // EQUIPMENT LIBRARY (CATALOG) SEARCH
  // ══════════════════════════════════════════════════════════════

  /**
   * GET /library/search
   * Autocomplete search across the equipment_library reference catalog.
   * Query params: ?q=canon+r5&category=camera&limit=20
   */
  router.get('/library/search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || '').trim();
      const category = req.query.category as string;
      const limit = Math.min(Number(req.query.limit) || 20, 100);

      if (!q && !category) {
        res.status(400).json({ ok: false, error: 'Provide ?q= or ?category=' });
        return;
      }

      let sql: string;
      const params: unknown[] = [];

      if (q) {
        // Use trigram similarity for fuzzy matching
        params.push(`%${q}%`);
        sql = `SELECT id, name, category, brand, model, type,
                      similarity(name, $${params.length}) as score
               FROM equipment_library
               WHERE name ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1`;

        if (category) {
          params.push(category);
          sql += ` AND category = $${params.length}`;
        }
        sql += ` ORDER BY score DESC, name LIMIT $${params.length + 1}`;
        params.push(limit);
      } else {
        params.push(category);
        sql = `SELECT id, name, category, brand, model, type
               FROM equipment_library
               WHERE category = $1
               ORDER BY brand, model
               LIMIT $2`;
        params.push(limit);
      }

      const rows = await query(sql, params);
      res.json({ ok: true, data: rows, count: rows.length });
    } catch (err: unknown) {
      // Fallback if pg_trgm not available — use plain ILIKE
      if (err instanceof Error && err.message?.includes('similarity')) {
        try {
          const q = `%${(req.query.q as string || '').trim()}%`;
          const category = req.query.category as string;
          const limit = Math.min(Number(req.query.limit) || 20, 100);

          let sql = `SELECT id, name, category, brand, model, type
                     FROM equipment_library
                     WHERE (name ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1)`;
          const params: unknown[] = [q];

          if (category) {
            params.push(category);
            sql += ` AND category = $${params.length}`;
          }
          sql += ` ORDER BY name LIMIT $${params.length + 1}`;
          params.push(limit);

          const rows = await query(sql, params);
          res.json({ ok: true, data: rows, count: rows.length });
          return;
        } catch {
          // fall through
        }
      }
      console.error('[equipment] GET /library/search error:', err);
      res.status(500).json({ ok: false, error: 'Failed to search catalog' });
    }
  });

  /**
   * GET /library/categories
   * List all categories with counts from the equipment_library.
   */
  router.get('/library/categories', async (req: Request, res: Response) => {
    try {
      const rows = await query(
        `SELECT category, count(*)::int as count
         FROM equipment_library
         WHERE category IS NOT NULL AND category NOT LIKE 'Default%'
         GROUP BY category
         ORDER BY count DESC`
      );
      res.json({ ok: true, data: rows });
    } catch (err) {
      console.error('[equipment] GET /library/categories error:', err);
      res.status(500).json({ ok: false, error: 'Failed to list categories' });
    }
  });

  /**
   * GET /library/brands
   * List all brands with counts, optionally filtered by category.
   * ?category=camera
   */
  router.get('/library/brands', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      let sql = `SELECT brand, count(*)::int as count
                 FROM equipment_library
                 WHERE brand IS NOT NULL`;
      const params: unknown[] = [];

      if (category) {
        params.push(category);
        sql += ` AND category = $1`;
      }
      sql += ` GROUP BY brand ORDER BY count DESC`;

      const rows = await query(sql, params);
      res.json({ ok: true, data: rows });
    } catch (err) {
      console.error('[equipment] GET /library/brands error:', err);
      res.status(500).json({ ok: false, error: 'Failed to list brands' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SCENE-AWARE EQUIPMENT INTELLIGENCE
  // ══════════════════════════════════════════════════════════════

  /**
   * GET /scenes
   * List all available scene types.
   */
  router.get('/scenes', async (_req: Request, res: Response) => {
    const types = Object.keys(SCENE_PROFILES).map((key) => ({
      id: key,
      requiredCategories: SCENE_PROFILES[key].required,
      recommendedCategories: SCENE_PROFILES[key].recommended,
    }));
    res.json({ ok: true, data: types });
  });

  /**
   * GET /scenes/:type/recommendations
   * Get equipment recommendations for a scene type.
   * Optional ?userId=xxx to compare against user's inventory.
   */
  router.get('/scenes/:type/recommendations', async (req: Request, res: Response) => {
    try {
      const sceneType = req.params.type;
      const profile = SCENE_PROFILES[sceneType];

      if (!profile) {
        res.status(404).json({ ok: false, error: `Unknown scene type: ${sceneType}` });
        return;
      }

      const userId = req.query.userId as string;
      let userEquipment: Record<string, unknown>[] = [];
      let gapAnalysis: { category: string; status: 'covered' | 'missing' | 'recommended' }[] = [];

      if (userId) {
        // Fetch user's equipment
        userEquipment = await query(
          `SELECT id, brand, model, category FROM user_equipment WHERE user_id = $1`,
          [userId]
        );

        const userCategories = new Set(userEquipment.map((e) => e.category as string));

        // Analyze gaps
        gapAnalysis = [
          ...profile.required.map((cat) => ({
            category: cat,
            status: userCategories.has(cat) ? 'covered' as const : 'missing' as const,
          })),
          ...profile.recommended
            .filter((cat) => !profile.required.includes(cat))
            .map((cat) => ({
              category: cat,
              status: userCategories.has(cat) ? 'covered' as const : 'recommended' as const,
            })),
        ];
      }

      // Find matching items in the catalog for suggested equipment
      const catalogMatches: Record<string, unknown>[] = [];
      for (const suggestion of profile.suggested) {
        const matches = await query(
          `SELECT id, name, brand, model, category, type
           FROM equipment_library
           WHERE brand ILIKE $1 AND model ILIKE $2
           LIMIT 1`,
          [suggestion.brand, `%${suggestion.model}%`]
        );
        catalogMatches.push({
          ...suggestion,
          catalogMatch: matches[0] || null,
        });
      }

      res.json({
        ok: true,
        sceneType,
        required: profile.required,
        recommended: profile.recommended,
        suggested: catalogMatches,
        tips: profile.tips,
        gapAnalysis: gapAnalysis.length ? gapAnalysis : undefined,
        userEquipmentCount: userEquipment.length || undefined,
      });
    } catch (err) {
      console.error('[equipment] GET /scenes/:type/recommendations error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get recommendations' });
    }
  });

  /**
   * POST /scenes/analyze
   * Analyze a user's equipment against multiple scene types.
   * Body: { userId, sceneTypes: ['interview', 'wedding'] }
   */
  router.post('/scenes/analyze', async (req: Request, res: Response) => {
    try {
      const { userId, sceneTypes } = req.body || {};
      if (!userId) {
        res.status(400).json({ ok: false, error: 'Missing userId' });
        return;
      }

      const types = Array.isArray(sceneTypes) ? sceneTypes : Object.keys(SCENE_PROFILES);

      // Fetch user's equipment
      const userEquip = await query(
        `SELECT id, brand, model, category FROM user_equipment WHERE user_id = $1`,
        [userId]
      );
      const userCategories = new Set(userEquip.map((e: Record<string, unknown>) => e.category as string));

      const analysis = types
        .filter((t: string) => SCENE_PROFILES[t])
        .map((sceneType: string) => {
          const profile = SCENE_PROFILES[sceneType];
          const requiredCovered = profile.required.filter((c) => userCategories.has(c)).length;
          const requiredTotal = profile.required.length;
          const recommendedCovered = profile.recommended.filter((c) => userCategories.has(c)).length;
          const recommendedTotal = profile.recommended.length;
          const readiness = requiredTotal
            ? Math.round((requiredCovered / requiredTotal) * 100)
            : 100;

          return {
            sceneType,
            readiness,
            requiredCoverage: `${requiredCovered}/${requiredTotal}`,
            recommendedCoverage: `${recommendedCovered}/${recommendedTotal}`,
            missingRequired: profile.required.filter((c) => !userCategories.has(c)),
            missingRecommended: profile.recommended.filter((c) => !userCategories.has(c)),
          };
        })
        .sort((a, b) => b.readiness - a.readiness);

      res.json({
        ok: true,
        totalEquipment: userEquip.length,
        categoriesCovered: [...userCategories],
        analysis,
      });
    } catch (err) {
      console.error('[equipment] POST /scenes/analyze error:', err);
      res.status(500).json({ ok: false, error: 'Failed to analyze scenes' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // EQUIPMENT INTELLIGENCE ENGINES
  // ═══════════════════════════════════════════════════════════════

  const intelligence = new EquipmentIntelligenceService(pool);

  // ── Predictive Failure Detection ──

  router.get('/intelligence/predictions/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const ambientTempC = req.query.temp ? Number(req.query.temp) : undefined;
      const plannedDurationHrs = req.query.hours ? Number(req.query.hours) : undefined;
      const results = await intelligence.predictAllFailures(userId, { ambientTempC, plannedDurationHrs });
      res.json({ ok: true, predictions: results });
    } catch (err) {
      console.error('[intelligence] GET /predictions error:', err);
      res.status(500).json({ ok: false, error: 'Failed to compute predictions' });
    }
  });

  router.get('/intelligence/predictions/:userId/:equipmentId', async (req: Request, res: Response) => {
    try {
      const { userId, equipmentId } = req.params;
      const ambientTempC = req.query.temp ? Number(req.query.temp) : undefined;
      const plannedDurationHrs = req.query.hours ? Number(req.query.hours) : undefined;
      const result = await intelligence.predictFailure(equipmentId, userId, { ambientTempC, plannedDurationHrs });
      res.json({ ok: true, prediction: result });
    } catch (err) {
      console.error('[intelligence] GET /predictions/:id error:', err);
      res.status(500).json({ ok: false, error: 'Failed to compute prediction' });
    }
  });

  // ── Health Metrics ──

  router.get('/intelligence/health/:equipmentId', async (req: Request, res: Response) => {
    try {
      const metrics = await intelligence.getHealthMetrics(req.params.equipmentId);
      res.json({ ok: true, metrics });
    } catch (err) {
      console.error('[intelligence] GET /health error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get health metrics' });
    }
  });

  router.put('/intelligence/health/:equipmentId', async (req: Request, res: Response) => {
    try {
      const { equipmentId } = req.params;
      const { userId, ...data } = req.body;
      if (!userId) {
        res.status(400).json({ ok: false, error: 'userId is required' });
        return;
      }
      await intelligence.upsertHealthMetrics(equipmentId, userId, data);
      res.json({ ok: true });
    } catch (err) {
      console.error('[intelligence] PUT /health error:', err);
      res.status(500).json({ ok: false, error: 'Failed to update health metrics' });
    }
  });

  // ── Gear Compatibility ──

  router.post('/intelligence/compatibility/lens', async (req: Request, res: Response) => {
    try {
      const { camera, lens } = req.body;
      if (!camera?.brand || !camera?.model || !lens?.brand || !lens?.model) {
        res.status(400).json({ ok: false, error: 'camera and lens with brand+model required' });
        return;
      }
      const result = await intelligence.checkLensCompatibility(camera, lens);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[intelligence] POST /compatibility/lens error:', err);
      res.status(500).json({ ok: false, error: 'Failed to check compatibility' });
    }
  });

  router.post('/intelligence/compatibility/battery', async (req: Request, res: Response) => {
    try {
      const { equipmentIds, plannedHours } = req.body;
      const result = await intelligence.checkBatteryEndurance(equipmentIds || [], plannedHours || 4);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[intelligence] POST /compatibility/battery error:', err);
      res.status(500).json({ ok: false, error: 'Failed to check battery endurance' });
    }
  });

  router.post('/intelligence/compatibility/io', async (req: Request, res: Response) => {
    try {
      const { recorder, sources } = req.body;
      if (!recorder?.brand || !recorder?.model) {
        res.status(400).json({ ok: false, error: 'recorder with brand+model required' });
        return;
      }
      const result = await intelligence.checkIOCompatibility(recorder, sources || []);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[intelligence] POST /compatibility/io error:', err);
      res.status(500).json({ ok: false, error: 'Failed to check I/O compatibility' });
    }
  });

  // ── Weight & Load Simulation ──

  router.post('/intelligence/rig-weight', async (req: Request, res: Response) => {
    try {
      const { equipment, carrierId } = req.body;
      if (!Array.isArray(equipment)) {
        res.status(400).json({ ok: false, error: 'equipment array required with {brand, model} items' });
        return;
      }
      const result = await intelligence.simulateLoad(equipment, carrierId);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[intelligence] POST /rig-weight error:', err);
      res.status(500).json({ ok: false, error: 'Failed to simulate weight' });
    }
  });

  // ── Scene Continuity Tracker ──

  router.get('/intelligence/scene-gear/:projectId', async (req: Request, res: Response) => {
    try {
      const scenes = await intelligence.getSceneContinuity(req.params.projectId);
      res.json({ ok: true, scenes });
    } catch (err) {
      console.error('[intelligence] GET /scene-gear error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get scene gear' });
    }
  });

  router.get('/intelligence/scene-gear/:projectId/breaks', async (req: Request, res: Response) => {
    try {
      const breaks = await intelligence.detectContinuityBreaks(req.params.projectId);
      res.json({ ok: true, breaks, hasIssues: breaks.length > 0 });
    } catch (err) {
      console.error('[intelligence] GET /scene-gear breaks error:', err);
      res.status(500).json({ ok: false, error: 'Failed to detect continuity breaks' });
    }
  });

  router.post('/intelligence/scene-gear', async (req: Request, res: Response) => {
    try {
      const { projectId, userId, sceneNumber, sceneLabel, sceneType, gearSetup, lightingSetup, audioSetup, notes, shootDate } = req.body;
      if (!projectId || !userId || !sceneLabel || !sceneType || !gearSetup) {
        res.status(400).json({ ok: false, error: 'projectId, userId, sceneLabel, sceneType, gearSetup required' });
        return;
      }
      const result = await intelligence.logSceneGear({
        projectId, userId, sceneNumber, sceneLabel, sceneType,
        gearSetup, lightingSetup, audioSetup, notes, shootDate,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[intelligence] POST /scene-gear error:', err);
      res.status(500).json({ ok: false, error: 'Failed to log scene gear' });
    }
  });

  // ── Equipment Memory Engine ──

  router.post('/intelligence/usage', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      if (!data.userId || !data.equipmentId || !data.category || !data.brand || !data.model) {
        res.status(400).json({ ok: false, error: 'userId, equipmentId, category, brand, model required' });
        return;
      }
      await intelligence.logUsage(data);
      res.json({ ok: true });
    } catch (err) {
      console.error('[intelligence] POST /usage error:', err);
      res.status(500).json({ ok: false, error: 'Failed to log usage' });
    }
  });

  router.get('/intelligence/preferences/:userId', async (req: Request, res: Response) => {
    try {
      const prefs = await intelligence.getEquipmentPreferences(req.params.userId);
      res.json({ ok: true, preferences: prefs });
    } catch (err) {
      console.error('[intelligence] GET /preferences error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get preferences' });
    }
  });

  router.get('/intelligence/recommendations/:userId/:sceneType', async (req: Request, res: Response) => {
    try {
      const result = await intelligence.getMemoryBasedRecommendation(req.params.userId, req.params.sceneType);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[intelligence] GET /recommendations error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get recommendations' });
    }
  });

  // ── Style Memory Engine ──

  router.get('/intelligence/style/:userId', async (req: Request, res: Response) => {
    try {
      const profile = await intelligence.getStyleProfile(req.params.userId);
      if (!profile) {
        res.json({ ok: true, profile: null, message: 'Ingen stilprofil beregnet ennå. Logg utstyrsbruk for å bygge din profil.' });
        return;
      }
      res.json({ ok: true, profile });
    } catch (err) {
      console.error('[intelligence] GET /style error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get style profile' });
    }
  });

  router.post('/intelligence/style/:userId/compute', async (req: Request, res: Response) => {
    try {
      const profile = await intelligence.computeStyleProfile(req.params.userId);
      res.json({ ok: true, profile });
    } catch (err) {
      console.error('[intelligence] POST /style/compute error:', err);
      res.status(500).json({ ok: false, error: 'Failed to compute style profile' });
    }
  });

  // ── Explanation Layer ──

  router.post('/intelligence/explain', async (req: Request, res: Response) => {
    try {
      const { userId, sceneType, equipment, context } = req.body;
      if (!userId || !sceneType || !equipment?.brand || !equipment?.model || !equipment?.category) {
        res.status(400).json({ ok: false, error: 'userId, sceneType, equipment{brand,model,category} required' });
        return;
      }
      const explanation = await intelligence.explainRecommendation(userId, sceneType, equipment, context);
      res.json({ ok: true, explanation });
    } catch (err) {
      console.error('[intelligence] POST /explain error:', err);
      res.status(500).json({ ok: false, error: 'Failed to generate explanation' });
    }
  });

  // ── Compatibility Specs Catalog ──

  router.get('/intelligence/specs', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const brand = req.query.brand as string | undefined;
      const specs = await intelligence.getCompatibilitySpecs({ category, brand });
      res.json({ ok: true, specs, count: specs.length });
    } catch (err) {
      console.error('[intelligence] GET /specs error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get specs' });
    }
  });

  router.post('/intelligence/specs', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      if (!data.brand || !data.model || !data.category) {
        res.status(400).json({ ok: false, error: 'brand, model, category required' });
        return;
      }
      await intelligence.upsertCompatibilitySpec(data);
      res.json({ ok: true });
    } catch (err) {
      console.error('[intelligence] POST /specs error:', err);
      res.status(500).json({ ok: false, error: 'Failed to upsert spec' });
    }
  });

  return router;
}
