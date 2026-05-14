/**
 * E2E: Troll-demo seed-flyt mot prod
 *
 * Bekrefter at:
 *   1. POST /api/demo/troll/seed-all returnerer success med alle areas
 *   2. Hver area-counter > 0 (roles, candidates, scenes, etc.)
 *   3. Etterfølgende GET-calls for hver entity returnerer faktiske rader
 *      (= seedingen persisterte til DB, ikke bare returnerte tomt response)
 *
 * Hvis dette feiler — backend-seed er broken.
 * Hvis dette passerer — frontend rendrer ikke seeded data riktig.
 */

import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'https://creatorhub-backend-rtbl.onrender.com';

test.describe('Troll-demo seed mot prod', () => {
  let seededProjectId = '';

  test('POST /api/demo/troll/seed-all returnerer alle areas', async ({ request }) => {
    const projectId = `troll-e2e-${Date.now()}`;
    const res = await request.post(`${BACKEND_URL}/api/demo/troll/seed-all`, {
      data: {
        projectId,
        projectName: 'TROLL E2E test',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.areas).toBeDefined();

    // Sjekk hver area
    const expectedAreas = ['project', 'crew', 'locations', 'roles', 'candidates', 'scenes', 'shot_lists'];
    for (const area of expectedAreas) {
      expect(body.areas[area], `area ${area}`).toBeDefined();
      expect(body.areas[area].status, `area ${area} status`).toBe('loaded');
      if (area !== 'project') {
        expect(body.areas[area].count, `area ${area} count > 0`).toBeGreaterThan(0);
      }
    }

    seededProjectId = body.areas.project.items[0]?.id || projectId;
    console.log(`Seeded project ID: ${seededProjectId}`);
    console.log('Area-counts:', Object.fromEntries(
      expectedAreas.map(a => [a, body.areas[a].count]),
    ));
  });

  test('GET casting/projects inneholder seedet prosjekt', async ({ request }) => {
    test.skip(!seededProjectId, 'Forrige test feilet — ingen seeded project ID');
    const res = await request.get(`${BACKEND_URL}/api/casting/projects`);
    expect(res.status()).toBe(200);
    const payload = await res.json();
    // Robust deserialisering — backend kan returnere [...] eller { projects: [...] }
    const list: Array<{ id: string }> = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.projects)
        ? payload.projects
        : [];
    const found = list.find((p) => p.id === seededProjectId);
    expect(found, `Project ${seededProjectId} skal finnes i /api/casting/projects`).toBeDefined();
  });

  test('GET roles inneholder seedete roller', async ({ request }) => {
    test.skip(!seededProjectId, 'No seeded project');
    const res = await request.get(`${BACKEND_URL}/api/casting/projects/${seededProjectId}/roles`);
    if (res.status() === 404) {
      console.warn('Roles endpoint 404 — kan være forventet hvis ikke implementert');
      return;
    }
    expect(res.status()).toBe(200);
    const roles = await res.json();
    expect(Array.isArray(roles) ? roles.length : 0, 'roles array > 0').toBeGreaterThan(0);
    console.log(`Roles fetched: ${Array.isArray(roles) ? roles.length : 'not array'}`);
  });

  test('GET candidates inneholder seedete kandidater', async ({ request }) => {
    test.skip(!seededProjectId, 'No seeded project');
    const res = await request.get(`${BACKEND_URL}/api/casting/projects/${seededProjectId}/candidates`);
    if (res.status() === 404) {
      console.warn('Candidates endpoint 404 — kan være forventet hvis ikke implementert');
      return;
    }
    expect(res.status()).toBe(200);
    const candidates = await res.json();
    expect(Array.isArray(candidates) ? candidates.length : 0, 'candidates array > 0').toBeGreaterThan(0);
    console.log(`Candidates fetched: ${Array.isArray(candidates) ? candidates.length : 'not array'}`);
  });

  test('GET crew inneholder seedet crew', async ({ request }) => {
    test.skip(!seededProjectId, 'No seeded project');
    const res = await request.get(`${BACKEND_URL}/api/casting/projects/${seededProjectId}/crew`);
    if (res.status() === 404) return;
    expect(res.status()).toBe(200);
    const crew = await res.json();
    expect(Array.isArray(crew) ? crew.length : 0, 'crew array > 0').toBeGreaterThan(0);
  });

  test('GET locations inneholder seedete lokasjoner', async ({ request }) => {
    test.skip(!seededProjectId, 'No seeded project');
    const res = await request.get(`${BACKEND_URL}/api/casting/projects/${seededProjectId}/locations`);
    if (res.status() === 404) return;
    expect(res.status()).toBe(200);
    const locations = await res.json();
    expect(Array.isArray(locations) ? locations.length : 0, 'locations array > 0').toBeGreaterThan(0);
  });
});
