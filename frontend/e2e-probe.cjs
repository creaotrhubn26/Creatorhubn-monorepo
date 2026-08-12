const { chromium } = require('@playwright/test');
const OWNER = { id: '43724096-0b81-4f0b-b819-a52c24e1bfeb', email: 'qazifotoreel@gmail.com', name: 'Qazi Foto', role: 'photographer', profession: 'photographer' };
const TOKEN = '4e0161b08c464151a42b9e01e3129d48b12bd09584338e6fed371fa40a153bf8';
const PROJECT = '1e9d8333-f892-4643-8694-0eb727f32615';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(([tok, user]) => {
    localStorage.setItem('creatorhub_auth_token', tok);
    localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
  }, [TOKEN, OWNER]);
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto(`http://localhost:5001/workspace/${PROJECT}/produksjonskart`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByText('Production Map').waitFor({ timeout: 90000 });

  await page.getByRole('tab', { name: 'Board' }).click();
  await page.getByRole('tab', { name: 'Kart' }).click();
  await page.getByRole('tab', { name: 'Timeline' }).click();

  const row = page.getByText('Forberedelser brud', { exact: true }).first();
  console.log('row count:', await row.count());
  await row.click();
  await page.waitForTimeout(2500);
  console.log('dialoger:', await page.getByRole('dialog').count());
  console.log('dialog tekst:', (await page.getByRole('dialog').allTextContents()).join(' | ').slice(0, 120));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
