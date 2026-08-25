import { chromium } from 'playwright';

const BASE = 'http://localhost:5099';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await ctx.addCookies([{
    name: 'session',
    value: 'dev-admin-local-session',
    domain: 'localhost',
    path: '/',
  }]);

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click Tilgangsforespørsler
  await page.getByText('Tilgangsforespørsler', { exact: false }).first().click({ timeout: 5000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/admin-invites-overview.png', fullPage: false });
  console.log('1. Invitasjonshåndtering oversikt');

  // Click "Inviter ny bruker"
  await page.getByText('Inviter ny bruker', { exact: false }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  // Step 0 - BRREG search
  await page.screenshot({ path: '/tmp/admin-invite-step0-empty.png', fullPage: false });
  console.log('2. Steg 0 - BRREG søk (tomt)');

  const searchField = page.locator('input[placeholder*="Bedriftsnavn"]');
  await searchField.fill('Fotograf');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/admin-invite-step0-results.png', fullPage: false });
  console.log('3. Steg 0 - BRREG søkresultater');

  // Select first result
  const dialog = page.locator('[role="dialog"]');
  const cards = dialog.locator('.MuiCard-root');
  if (await cards.count() > 0) {
    await cards.first().click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: '/tmp/admin-invite-step0-selected.png', fullPage: false });
  console.log('4. Steg 0 - Bedrift valgt');

  // Step 1
  await page.locator('button:has-text("Neste")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/admin-invite-step1.png', fullPage: false });
  console.log('5. Steg 1 - Kontakt og profesjon');

  // Step 2
  await page.locator('button:has-text("Neste")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/admin-invite-step2.png', fullPage: false });
  console.log('6. Steg 2 - Abonnement');

  // Step 3
  await page.locator('button:has-text("Neste")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/admin-invite-step3.png', fullPage: false });
  console.log('7. Steg 3 - E-postmal');

  await browser.close();
  console.log('\nScreenshots lagret i /tmp/admin-invite-*.png');
})();
