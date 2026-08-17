import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const PROJECT_ID = '62541498-eec0-4868-b3d9-b0db86b3513a';
const EMERGENCY_TOKEN = '3389fa994209cd8e4678ebff3889be8c67f4e8b8b7e148d7cff324291feb2209';
const USER_EMAIL = 'daniel@creatorhubn.com';
const USER_ID = '53391080-8437-471e-800b-8b0d01e8b465';

async function getAuthToken() {
  const randomIp = `127.0.0.${Math.floor(Math.random() * 200 + 10)}`;
  const authRes = await fetch(`http://localhost:3003/api/super-admin/emergency-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `127.0.0.${Math.floor(Math.random() * 200 + 10)}`,
    },
    body: JSON.stringify({ token: EMERGENCY_TOKEN, email: USER_EMAIL, userId: USER_ID }),
  });
  const authData = await authRes.json();
  return authData.token || authData.sessionToken;
}

test('Debug test', async ({ browser }) => {
  const sessionToken = await getAuthToken();
  console.log('Session token:', sessionToken?.slice(0, 20) + '...');
  
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text().slice(0, 200)));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('creatorhub_auth_token', token);
    window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
  }, { token: 'dummy-token', user: { id: '53391080-8437-471e-800b-8b0d01e8b465', email: 'daniel@creatorhubn.com', role: 'admin' } });

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