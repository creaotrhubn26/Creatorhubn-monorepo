import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../migrations/0673_photo_room_workspace_organization.sql', import.meta.url),
  'utf8',
);
const routes = readFileSync(new URL('./project-workspace-routes.ts', import.meta.url), 'utf8');

describe('Photo Room organization migration', () => {
  it('keeps collections logical and constrained to project master assets', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS asset_refs');
    expect(migration).toContain('asset_refs_project_fk');
    expect(migration).toContain('asset_refs_capture_master_fk');
    expect(migration).toContain('idx_ar_dedupe');
    expect(routes).toContain('photo-review/organize');
    expect(routes).toContain("master_kind='capture'");
    expect(routes).not.toContain('CREATE TABLE IF NOT EXISTS asset_refs');
    expect(routes).not.toContain('CREATE TABLE IF NOT EXISTS project_media_folders');
  });

  it('freezes every delivery round and its exact asset membership', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS project_photo_delivery_rounds');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS project_photo_delivery_assets');
    expect(routes).toContain('INSERT INTO project_photo_delivery_rounds');
    expect(routes).toContain('INSERT INTO project_photo_delivery_assets');
    const deliveryRoute = routes.slice(routes.indexOf('app.post("/api/projects/:projectId/photo-deliveries"'));
    expect(deliveryRoute.indexOf('INSERT INTO project_photo_delivery_rounds'))
      .toBeLessThan(deliveryRoute.indexOf('sendTransactionalEmail'));
  });
});
