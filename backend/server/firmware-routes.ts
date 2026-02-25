/**
 * Firmware Management API Routes
 *
 * Mounted at /api/firmware/v2/...
 * Uses the new firmware_catalog table + FirmwareService for proper
 * track-key matching, version comparison, and per-equipment status.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { FirmwareService, buildFirmwareTrackKey } from './firmwareService.js';

export function createFirmwareRouter(pool: Pool): Router {
  const router = Router();
  const svc = new FirmwareService(pool);

  // ── Catalog CRUD ───────────────────────────────────────────────

  /**
   * GET /catalog
   * List all catalog entries. Optional ?manufacturer=Canon filter.
   * Returns DISTINCT manufacturer+model (latest version only).
   */
  router.get('/catalog', async (req: Request, res: Response) => {
    try {
      const manufacturer = req.query.manufacturer as string | undefined;
      const entries = await svc.getCatalog(manufacturer);
      res.json({ ok: true, data: entries, count: entries.length });
    } catch (err) {
      console.error('[firmware] GET /catalog error:', err);
      res.status(500).json({ ok: false, error: 'Failed to fetch catalog' });
    }
  });

  /**
   * POST /catalog
   * Upsert a catalog entry.
   * Accepts both scraper format (manufacturer/version) and legacy format (brand/latestVersion).
   */
  router.post('/catalog', async (req: Request, res: Response) => {
    try {
      const {
        manufacturer, brand, model, version, latestVersion,
        releaseDate, downloadUrl, releaseNotesUrl, checksum,
        sourceType, sourceUrl, description, importance,
      } = req.body;

      const mfr = (manufacturer || brand || '').trim();
      const mdl = (model || '').trim();
      const ver = (version || latestVersion || '').trim();

      if (!mfr || !mdl || !ver) {
        res.status(400).json({
          ok: false,
          error: 'manufacturer (or brand), model, and version (or latestVersion) are required',
        });
        return;
      }

      const entry = await svc.upsertCatalogEntry({
        manufacturer: mfr,
        model: mdl,
        version: ver,
        releaseDate: releaseDate || null,
        downloadUrl: downloadUrl || '',
        releaseNotesUrl: releaseNotesUrl || null,
        checksum: checksum || null,
        sourceType: sourceType || 'manual',
        sourceUrl: sourceUrl || null,
        description: description || null,
        importance: importance || 'optional',
      });

      res.json({ ok: true, data: entry });
    } catch (err) {
      console.error('[firmware] POST /catalog error:', err);
      res.status(500).json({ ok: false, error: 'Failed to upsert catalog entry' });
    }
  });

  /**
   * DELETE /catalog/:id
   */
  router.delete('/catalog/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await svc.deleteCatalogEntry(Number(req.params.id));
      res.json({ ok: true, deleted });
    } catch (err) {
      console.error('[firmware] DELETE /catalog error:', err);
      res.status(500).json({ ok: false, error: 'Failed to delete' });
    }
  });

  /**
   * GET /catalog/search?q=canon+r5
   * Search catalog entries (for "needs mapping" UI suggestions)
   */
  router.get('/catalog/search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || '';
      if (!q.trim()) {
        res.json({ ok: true, data: [] });
        return;
      }
      const entries = await svc.searchCatalog(q);
      res.json({ ok: true, data: entries });
    } catch (err) {
      console.error('[firmware] GET /catalog/search error:', err);
      res.status(500).json({ ok: false, error: 'Search failed' });
    }
  });

  // ── Equipment firmware check ───────────────────────────────────

  /**
   * POST /check
   * Check firmware for a single equipment item.
   * Body: { equipmentId, brand, model, currentVersion? }
   */
  router.post('/check', async (req: Request, res: Response) => {
    try {
      const { equipmentId, brand, model, currentVersion } = req.body;

      if (!brand || !model) {
        res.status(400).json({
          ok: false, error: 'brand and model are required',
        });
        return;
      }

      const status = await svc.checkEquipmentFirmware(
        equipmentId || 'anon',
        brand, model,
        currentVersion || null
      );

      res.json({ ok: true, data: status });
    } catch (err) {
      console.error('[firmware] POST /check error:', err);
      res.status(500).json({ ok: false, error: 'Firmware check failed' });
    }
  });

  /**
   * POST /check-batch
   * Check firmware for multiple equipment items at once.
   * Body: { items: [{ equipmentId, brand, model, currentVersion? }, ...] }
   */
  router.post('/check-batch', async (req: Request, res: Response) => {
    try {
      const items = req.body.items;
      if (!Array.isArray(items)) {
        res.status(400).json({ ok: false, error: 'items array is required' });
        return;
      }

      const results: Record<string, unknown> = {};
      for (const item of items) {
        if (!item.brand || !item.model) continue;
        const status = await svc.checkEquipmentFirmware(
          item.equipmentId || item.id || 'anon',
          item.brand, item.model,
          item.currentVersion || item.firmwareCurrent || null
        );
        results[item.equipmentId || item.id || item.model] = status;
      }

      res.json({ ok: true, data: results });
    } catch (err) {
      console.error('[firmware] POST /check-batch error:', err);
      res.status(500).json({ ok: false, error: 'Batch check failed' });
    }
  });

  /**
   * POST /check-all
   * Evaluate ALL equipment with firmwareAutoCheckEnabled = true
   */
  router.post('/check-all', async (_req: Request, res: Response) => {
    try {
      const results = await svc.checkAllEquipment();
      const updatesAvailable = results.filter(r => r.isUpdateAvailable).length;
      res.json({
        ok: true,
        data: results,
        summary: {
          total: results.length,
          updatesAvailable,
          upToDate: results.length - updatesAvailable,
        },
      });
    } catch (err) {
      console.error('[firmware] POST /check-all error:', err);
      res.status(500).json({ ok: false, error: 'Batch check failed' });
    }
  });

  // ── Match result lookup ─────────────────────────────────────────

  /**
   * GET /status/:equipmentId
   * Get cached firmware match result for a specific equipment item
   */
  router.get('/status/:equipmentId', async (req: Request, res: Response) => {
    try {
      const match = await svc.getMatchResult(req.params.equipmentId);
      if (!match) {
        res.json({ ok: true, data: null, message: 'No check performed yet' });
        return;
      }
      res.json({ ok: true, data: match });
    } catch (err) {
      console.error('[firmware] GET /status error:', err);
      res.status(500).json({ ok: false, error: 'Failed to get status' });
    }
  });

  // ── Track key utilities ────────────────────────────────────────

  /**
   * GET /track-key?brand=Canon&model=EOS R5 (Body)
   * Preview a track key before saving (debug/demo)
   */
  router.get('/track-key', (req: Request, res: Response) => {
    const brand = (req.query.brand as string) || '';
    const model = (req.query.model as string) || '';
    const key = buildFirmwareTrackKey(brand, model);
    res.json({ ok: true, brand, model, trackKey: key });
  });

  /**
   * POST /rebuild-keys
   * Rebuild all equipment track keys (admin)
   */
  router.post('/rebuild-keys', async (_req: Request, res: Response) => {
    try {
      const count = await svc.rebuildTrackKeys();
      res.json({ ok: true, updated: count });
    } catch (err) {
      console.error('[firmware] POST /rebuild-keys error:', err);
      res.status(500).json({ ok: false, error: 'Rebuild failed' });
    }
  });

  /**
   * POST /map-equipment
   * Map an equipment item to a specific catalog model (for "needs mapping" UI)
   * Body: { equipmentId, catalogManufacturer, catalogModel }
   */
  router.post('/map-equipment', async (req: Request, res: Response) => {
    try {
      const { equipmentId, catalogManufacturer, catalogModel } = req.body;
      if (!equipmentId || !catalogManufacturer || !catalogModel) {
        res.status(400).json({
          ok: false,
          error: 'equipmentId, catalogManufacturer, and catalogModel are required',
        });
        return;
      }
      await svc.mapEquipmentToModel(equipmentId, catalogManufacturer, catalogModel);
      res.json({ ok: true });
    } catch (err) {
      console.error('[firmware] POST /map-equipment error:', err);
      res.status(500).json({ ok: false, error: 'Mapping failed' });
    }
  });

  return router;
}
