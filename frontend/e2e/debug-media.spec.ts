import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const PROJECT_ID = '62541498-eec0-4868-b3d9-b0db86b3513a';
const EMERGENCY_TOKEN = process.env.E2E_SUPER_ADMIN_EMERGENCY_TOKEN ?? '';
const USER_EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? '';
const USER_ID = process.env.E2E_SUPER_ADMIN_USER_ID ?? '';

test.skip(
  !EMERGENCY_TOKEN || !USER_EMAIL || !USER_ID,
  'Set the three E2E_SUPER_ADMIN_* variables for emergency-login E2E',
);

async function getAuthToken() {
  if (!EMERGENCY_TOKEN || !USER_EMAIL || !USER_ID) {
    throw new Error(
      'E2E_SUPER_ADMIN_EMERGENCY_TOKEN, E2E_SUPER_ADMIN_EMAIL and E2E_SUPER_ADMIN_USER_ID are required',
    );
  }
  const authRes = await fetch(`http://localhost:3003/api/super-admin/emergency-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: EMERGENCY_TOKEN, email: USER_EMAIL }),
  });
  const authData = await authRes.json();
  const token = authData.token || authData.sessionToken;
  if (!authRes.ok || !token) throw new Error(`Emergency login failed (${authRes.status})`);
  return token;
}

test('Debug test', async ({ browser }) => {
  const sessionToken = await getAuthToken();
  
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text().slice(0, 200)));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('creatorhub_auth_token', token);
    window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
  }, { token: sessionToken, user: { id: USER_ID, email: USER_EMAIL, role: 'super_admin' } });

  await page.goto(`http://localhost:5001/workspace/62541498-eec0-4868-b3d9-b0db86b3513a/media`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  
  // Check if tiles exist
  const tiles = await page.locator('[data-im-id]').count();
  console.log('Tile count:', tiles);
  
  // Check network requests
  page.on('response', response => {
    if (response.url().includes('/api/projects/') && response.url().includes('/images')) {
      console.log('API Response:', response.status(), response.url());
      response.json().then(data => console.log('API Data:', JSON.stringify(data).slice(0, 500))).catch(() => {});
    }
  });
  
  await new Promise(r => setTimeout(r, 10000));
});
