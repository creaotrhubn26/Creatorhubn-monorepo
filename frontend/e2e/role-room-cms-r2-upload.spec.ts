/**
 * E2E: CMS-media-opplasting til Cloudflare R2
 *
 * To moduser:
 *   1. Smoke (default — kjører i CI/smoke uten secrets):
 *      verifiserer at endpoints eksisterer + krever auth korrekt.
 *
 *   2. Full upload (gated på env var `E2E_ADMIN_SESSION_COOKIE`):
 *      bruker admin-cookie til å laste opp en faktisk fil,
 *      verifiserer respons-shape og henter tilbake bildet via
 *      returnert URL. Kjøres bare når env-vars er satt.
 *
 * Kjør lokalt:
 *   npx playwright test e2e/role-room-cms-r2-upload.spec.ts --project=chromium
 *
 * Kjør mot prod (kun smoke):
 *   E2E_BASE_URL=https://theroleroom.com \
 *     npx playwright test --config=playwright.smoke.config.ts \
 *     e2e/role-room-cms-r2-upload.spec.ts
 *
 * Full opplasting-test mot prod:
 *   E2E_BASE_URL=https://theroleroom.com \
 *     E2E_ADMIN_SESSION_COOKIE="session_id=..." \
 *     npx playwright test --config=playwright.smoke.config.ts \
 *     e2e/role-room-cms-r2-upload.spec.ts
 *
 * Hvordan finne admin-cookie:
 *   1. Logg inn i AdminRoom som daniel@creatorhubn.com på prod
 *   2. DevTools → Application → Cookies → kopier verdien (typisk
 *      "creatorhub_session_v2" eller hva server bruker)
 *   3. Format: "<cookie_name>=<value>" (semicolon-separert hvis flere)
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'https://creatorhub-backend-rtbl.onrender.com';
const ADMIN_COOKIE = process.env.E2E_ADMIN_SESSION_COOKIE ?? '';

// 1x1 transparent PNG (smallest valid PNG — 67 bytes)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test.describe('CMS media R2 — endpoint smoke (uten auth)', () => {
  test('POST /api/admin/cms/media/upload uten auth returnerer 401', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/admin/cms/media/upload`, {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
        },
      },
    });
    expect(res.status(), 'admin-endpoint må kreve auth').toBe(401);
  });

  test('GET /api/admin/cms/media/config uten auth returnerer 401', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/admin/cms/media/config`);
    expect(res.status()).toBe(401);
  });

  test('Backend health rapporterer commit-info', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.commit).toBe('string');
    expect(body.commit.length).toBeGreaterThanOrEqual(7);
    console.log(`Backend deployed commit: ${body.commit}`);
  });
});

test.describe('CMS media R2 — full upload (gated på admin-cookie)', () => {
  test.skip(!ADMIN_COOKIE, 'E2E_ADMIN_SESSION_COOKIE ikke satt — hopper over full upload-test');

  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      extraHTTPHeaders: ADMIN_COOKIE
        ? { Cookie: ADMIN_COOKIE }
        : {},
    });
  });

  test.afterAll(async () => {
    await request?.dispose();
  });

  test('Config endpoint rapporterer R2 som konfigurert', async () => {
    const res = await request.get(`${BACKEND_URL}/api/admin/cms/media/config`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    if (!body.configured) {
      throw new Error(
        'R2 er ikke konfigurert. Sett CLOUDFLARE_R2_ENDPOINT / BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY i Render-env-vars.',
      );
    }
    expect(body.configured).toBe(true);
  });

  test('Upload av tiny PNG returnerer gyldig URL', async () => {
    const buffer = Buffer.from(TINY_PNG_BASE64, 'base64');
    const res = await request.post(`${BACKEND_URL}/api/admin/cms/media/upload`, {
      multipart: {
        file: {
          name: 'e2e-tiny-test.png',
          mimeType: 'image/png',
          buffer,
        },
      },
    });
    expect(res.status(), 'opplasting skal returnere 200').toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.url).toBe('string');
    expect(body.url).toMatch(/^https?:\/\//);
    expect(typeof body.key).toBe('string');
    expect(body.key).toMatch(/^cms\//);
    expect(['public', 'signed']).toContain(body.mode);
    console.log(`Upload OK: mode=${body.mode}, key=${body.key}`);
    console.log(`URL: ${body.url}`);

    // Verifiser at det opplastede bildet faktisk er tilgjengelig
    const fetchRes = await request.get(body.url);
    expect(fetchRes.status(), 'opplastet bilde må være hentbart').toBe(200);
    const contentType = fetchRes.headers()['content-type'] ?? '';
    expect(contentType, `content-type skal være image/*, fikk ${contentType}`).toMatch(/^image\//);

    // PNG-signatur (89 50 4E 47) — bekreft binær integritet
    const bytes = await fetchRes.body();
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  test('Avvist mime-type (text/plain) returnerer 415', async () => {
    const res = await request.post(`${BACKEND_URL}/api/admin/cms/media/upload`, {
      multipart: {
        file: {
          name: 'evil.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('definitely not an image'),
        },
      },
    });
    expect(res.status()).toBe(415);
  });

  test('For stor fil (> 10 MB) avvises av multer', async () => {
    // 11 MB Buffer
    const oversize = Buffer.alloc(11 * 1024 * 1024, 0xff);
    const res = await request.post(`${BACKEND_URL}/api/admin/cms/media/upload`, {
      multipart: {
        file: {
          name: 'big.png',
          mimeType: 'image/png',
          buffer: oversize,
        },
      },
      // Lengre timeout for stor opplasting
      timeout: 60_000,
    });
    // Multer returnerer 413 eller 500 ved file-size-overrun; godta begge
    expect([413, 500]).toContain(res.status());
  });
});
