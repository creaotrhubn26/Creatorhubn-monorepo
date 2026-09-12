import type express from 'express';
import { canAccessProject, canEditProject } from './project-team-routes';
import { broadcastEventToRoom } from './websocket-chat';

interface WeddingProductionMapDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => any;
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query('ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6)').catch(() => undefined);
  await pool.query('ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6)').catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS wedding_location_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), wedding_id VARCHAR(64) NOT NULL,
    location_id UUID NOT NULL, member_name VARCHAR(255) NOT NULL, member_role VARCHAR(64),
    checked_in_by VARCHAR(64) NOT NULL, checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_checkins_member ON wedding_location_checkins (wedding_id, LOWER(member_name))').catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS wedding_crew_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), wedding_id VARCHAR(64) NOT NULL,
    member_name VARCHAR(255) NOT NULL, member_role VARCHAR(64), latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL, accuracy_m NUMERIC(8, 2), updated_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_positions_actor ON wedding_crew_positions (wedding_id, updated_by)').catch(() => undefined);
}

async function weddingAccess(pool: any, weddingId: string, userId: string, edit: boolean): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT project_id, user_id, photographer_id FROM wedding_timelines WHERE id::text = $1 LIMIT 1',
      [weddingId],
    );
    const wedding = result.rows[0];
    if (!wedding) return false;
    if (String(wedding.user_id || '') === userId || String(wedding.photographer_id || '') === userId) return true;
    if (!wedding.project_id) return false;
    return edit
      ? canEditProject(pool, userId, String(wedding.project_id))
      : canAccessProject(pool, userId, String(wedding.project_id));
  } catch {
    return false;
  }
}

async function actorProfile(pool: any, weddingId: string, userId: string, fallbackName: unknown, fallbackRole: unknown) {
  const result = await pool.query(
    `SELECT COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), u.email, m.name, m.email) AS name,
            m.crew_role
       FROM wedding_timelines w
       LEFT JOIN users u ON u.id::text = $2
       LEFT JOIN project_team_members m ON m.project_id = w.project_id::text AND m.user_id = $2
      WHERE w.id::text = $1 LIMIT 1`,
    [weddingId, userId],
  ).catch(() => ({ rows: [] }));
  const row = result.rows[0] || {};
  return {
    name: String(row.name || fallbackName || 'Teammedlem').trim().slice(0, 255),
    role: String(row.crew_role || fallbackRole || 'medlem').trim().slice(0, 64),
  };
}

function point(body: any): { lat: number; lng: number; accuracy: number | null } | null {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const accuracy = body?.accuracyM == null ? null : Number(body.accuracyM);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, accuracy: Number.isFinite(accuracy) && accuracy! >= 0 ? accuracy : null };
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(address)}&fuzzy=true&treffPerSide=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return null;
    const payload = await response.json() as any;
    const hit = payload?.adresser?.[0]?.representasjonspunkt;
    return typeof hit?.lat === 'number' && typeof hit?.lon === 'number'
      ? { lat: hit.lat, lng: hit.lon }
      : null;
  } catch {
    return null;
  }
}

export function setupWeddingProductionMapRoutes({ app, pool, requireUserSession }: WeddingProductionMapDeps): void {
  app.get('/api/wedding/:weddingId/checkins', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    if (!(await weddingAccess(pool, req.params.weddingId, session.userId, false))) return res.status(404).json({ error: 'not_found' });
    await ensureSchema(pool);
    const result = await pool.query(
      `SELECT location_id, member_name, member_role, checked_in_at
         FROM wedding_location_checkins WHERE wedding_id = $1 ORDER BY checked_in_at DESC`,
      [req.params.weddingId],
    );
    res.json({ checkins: result.rows.map((r: any) => ({ locationId: r.location_id, memberName: r.member_name, memberRole: r.member_role, checkedInAt: r.checked_in_at })) });
  });

  app.post('/api/wedding/:weddingId/checkins', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const weddingId = req.params.weddingId;
    if (!(await weddingAccess(pool, weddingId, session.userId, true))) return res.status(403).json({ error: 'read_only' });
    const locationId = String(req.body?.locationId || '').trim();
    const memberName = String(req.body?.memberName || '').trim().slice(0, 255);
    if (!locationId || !memberName) return res.status(400).json({ error: 'locationId og memberName er påkrevd' });
    await ensureSchema(pool);
    const location = await pool.query('SELECT 1 FROM wedding_locations WHERE id::text = $1 AND wedding_id = $2', [locationId, weddingId]);
    if (!location.rows.length) return res.status(404).json({ error: 'location_not_found' });
    const result = await pool.query(
      `INSERT INTO wedding_location_checkins (wedding_id, location_id, member_name, member_role, checked_in_by)
       VALUES ($1, $2::uuid, $3, $4, $5)
       ON CONFLICT (wedding_id, (LOWER(member_name))) DO UPDATE SET
         location_id = EXCLUDED.location_id, member_role = EXCLUDED.member_role,
         checked_in_by = EXCLUDED.checked_in_by, checked_in_at = NOW()
       RETURNING location_id, member_name, member_role, checked_in_at`,
      [weddingId, locationId, memberName, String(req.body?.memberRole || '').slice(0, 64) || null, session.userId],
    );
    broadcastEventToRoom(`wedding:${weddingId}`, { type: 'checkin_updated', payload: { weddingId }, timestamp: new Date().toISOString() });
    const row = result.rows[0];
    res.status(201).json({ checkin: { locationId: row.location_id, memberName: row.member_name, memberRole: row.member_role, checkedInAt: row.checked_in_at } });
  });

  app.delete('/api/wedding/:weddingId/checkins', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const weddingId = req.params.weddingId;
    if (!(await weddingAccess(pool, weddingId, session.userId, true))) return res.status(403).json({ error: 'read_only' });
    const memberName = String(req.body?.memberName || '').trim();
    if (!memberName) return res.status(400).json({ error: 'memberName er påkrevd' });
    await ensureSchema(pool);
    await pool.query('DELETE FROM wedding_location_checkins WHERE wedding_id = $1 AND LOWER(member_name) = LOWER($2)', [weddingId, memberName]);
    broadcastEventToRoom(`wedding:${weddingId}`, { type: 'checkin_updated', payload: { weddingId }, timestamp: new Date().toISOString() });
    res.json({ success: true });
  });

  app.get('/api/wedding/:weddingId/positions', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const weddingId = req.params.weddingId;
    if (!(await weddingAccess(pool, weddingId, session.userId, false))) return res.status(404).json({ error: 'not_found' });
    await ensureSchema(pool);
    const result = await pool.query(
      `SELECT member_name, member_role, latitude, longitude, accuracy_m, updated_at
         FROM wedding_crew_positions
        WHERE wedding_id = $1 AND updated_at > NOW() - INTERVAL '10 minutes'
        ORDER BY updated_at DESC`,
      [weddingId],
    );
    res.json({ positions: result.rows.map((r: any) => ({ memberName: r.member_name, memberRole: r.member_role, lat: Number(r.latitude), lng: Number(r.longitude), accuracyM: r.accuracy_m == null ? null : Number(r.accuracy_m), updatedAt: r.updated_at })) });
  });

  app.post('/api/wedding/:weddingId/positions', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const weddingId = req.params.weddingId;
    if (!(await weddingAccess(pool, weddingId, session.userId, true))) return res.status(403).json({ error: 'read_only' });
    const coords = point(req.body);
    if (!coords) return res.status(400).json({ error: 'Ugyldige koordinater' });
    await ensureSchema(pool);
    const actor = await actorProfile(pool, weddingId, session.userId, req.body?.memberName, req.body?.memberRole);
    await pool.query(
      `INSERT INTO wedding_crew_positions (wedding_id, member_name, member_role, latitude, longitude, accuracy_m, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (wedding_id, updated_by) DO UPDATE SET
         member_name = EXCLUDED.member_name, member_role = EXCLUDED.member_role,
         latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
         accuracy_m = EXCLUDED.accuracy_m, updated_at = NOW()`,
      [weddingId, actor.name, actor.role, coords.lat, coords.lng, coords.accuracy, session.userId],
    );
    broadcastEventToRoom(`wedding:${weddingId}`, { type: 'position_updated', payload: { weddingId }, timestamp: new Date().toISOString() });
    res.json({ success: true });
  });

  app.delete('/api/wedding/:weddingId/positions', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const weddingId = req.params.weddingId;
    if (!(await weddingAccess(pool, weddingId, session.userId, true))) return res.status(403).json({ error: 'read_only' });
    await ensureSchema(pool);
    await pool.query('DELETE FROM wedding_crew_positions WHERE wedding_id = $1 AND updated_by = $2', [weddingId, session.userId]);
    broadcastEventToRoom(`wedding:${weddingId}`, { type: 'position_updated', payload: { weddingId }, timestamp: new Date().toISOString() });
    res.json({ success: true });
  });

  app.put('/api/wedding/:weddingId/locations/:locationId', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const { weddingId, locationId } = req.params;
    if (!(await weddingAccess(pool, weddingId, session.userId, true))) return res.status(403).json({ error: 'read_only' });
    const label = String(req.body?.label || '').trim().slice(0, 255);
    if (!label) return res.status(400).json({ error: 'label er påkrevd' });
    await ensureSchema(pool);
    const result = await pool.query(
      `UPDATE wedding_locations SET label = $1, address = $2, postal_code = $3, city = $4, notes = $5
        WHERE id::text = $6 AND wedding_id = $7 RETURNING *`,
      [label, req.body?.address || null, req.body?.postalCode || null, req.body?.city || null, req.body?.notes || null, locationId, weddingId],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'location_not_found' });
    broadcastEventToRoom(`wedding:${weddingId}`, { type: 'location_updated', payload: { weddingId, locationId }, timestamp: new Date().toISOString() });
    res.json({ location: result.rows[0] });
  });

  app.post('/api/wedding/:weddingId/locations/geocode', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    const weddingId = req.params.weddingId;
    if (!(await weddingAccess(pool, weddingId, session.userId, true))) return res.status(403).json({ error: 'read_only' });
    await ensureSchema(pool);
    const locations = await pool.query(
      `SELECT id, label, address, postal_code, city FROM wedding_locations
        WHERE wedding_id = $1 AND (latitude IS NULL OR longitude IS NULL) ORDER BY sort_order LIMIT 20`,
      [weddingId],
    );
    let updated = 0;
    for (const location of locations.rows) {
      const address = [location.address, location.postal_code, location.city].filter(Boolean).join(', ') || location.label;
      const coords = await geocodeAddress(address);
      if (!coords) continue;
      await pool.query('UPDATE wedding_locations SET latitude = $1, longitude = $2 WHERE id = $3 AND wedding_id = $4', [coords.lat, coords.lng, location.id, weddingId]);
      updated += 1;
    }
    res.json({ success: true, updated });
  });
}
