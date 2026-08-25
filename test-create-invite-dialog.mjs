import { chromium } from 'playwright';

const BASE = 'http://localhost:5099';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.addCookies([{
    name: 'session',
    value: 'dev-admin-local-session',
    domain: 'localhost',
    path: '/',
  }]);

  let apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('/api/invites/admin/create-and-send')) {
      apiCalls.push({ method: req.method(), url: req.url(), body: req.postData() });
    }
  });

  console.log('=== Full 4-step invite flow test ===');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Navigate to Tilgangsforespørsler
  await page.getByText('Tilgangsforespørsler', { exact: false }).first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);

  // Click "Inviter ny bruker"
  await page.getByText('Inviter ny bruker', { exact: false }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  const dialog = page.locator('[role="dialog"]');
  console.log('Dialog opened');

  // === STEP 0: Bedrift (BRREG) ===
  const searchField = page.locator('input[placeholder*="Bedriftsnavn"]');
  await searchField.fill('Equinor');
  await page.waitForTimeout(2000);
  
  const cards = dialog.locator('.MuiCard-root');
  console.log(`Step 0 - BRREG results: ${await cards.count()}`);
  await cards.first().click();
  await page.waitForTimeout(500);
  console.log('Step 0 - Company selected');

  await page.locator('button:has-text("Neste")').click();
  await page.waitForTimeout(500);
  console.log('→ Step 1: Kontakt');

  // === STEP 1: Kontakt ===
  // Fill fornavn by placeholder/label
  await page.getByLabel('Fornavn', { exact: false }).fill('Test');
  await page.getByLabel('Etternavn', { exact: false }).fill('Bruker');
  
  // Email
  const emailField = page.locator('input[type="email"]');
  if (await emailField.count() > 0) {
    await emailField.fill('test@example.com');
  } else {
    await page.getByLabel('E-post', { exact: false }).fill('test@example.com');
  }
  
  // Telefon (optional, skip)

  // Profession select
  const profSelect = page.locator('[role="combobox"]').first();
  if (await profSelect.isVisible().catch(() => false)) {
    await profSelect.click();
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: /fotograf/i }).first().click();
    await page.waitForTimeout(300);
    console.log('Step 1 - Profession: Fotograf');
  }

  const nesteBtn = page.locator('button:has-text("Neste")');
  console.log(`Step 1 - Neste enabled: ${await nesteBtn.isEnabled()}`);
  await nesteBtn.click();
  await page.waitForTimeout(500);
  console.log('→ Step 2: Abonnement');

  // === STEP 2: Abonnement ===
  const step2Text = await dialog.textContent();
  console.log(`Step 2 - Basic visible: ${step2Text.includes('249')}`);
  console.log(`Step 2 - Pro visible: ${step2Text.includes('449')}`);
  console.log(`Step 2 - Enterprise visible: ${step2Text.includes('3 990')}`);

  // Click Pro plan
  try {
    await dialog.getByText(/449.*kr/).first().click();
    await page.waitForTimeout(300);
    console.log('Step 2 - Selected Pro plan');
  } catch {
    console.log('Step 2 - Fallback: clicking second card');
    const planCards = dialog.locator('.MuiCard-root');
    if (await planCards.count() > 1) await planCards.nth(1).click();
  }

  await page.locator('button:has-text("Neste")').click();
  await page.waitForTimeout(500);
  console.log('→ Step 3: E-post');

  // === STEP 3: E-post ===
  const step3Text = await dialog.textContent();
  console.log(`Step 3 - Email templates visible: ${step3Text.includes('Tilgang') || step3Text.includes('Velkomst')}`);

  // Fill personal message
  const textareas = dialog.locator('textarea');
  if (await textareas.count() > 0) {
    await textareas.first().fill('Velkommen til Creatorhubn!');
    console.log('Step 3 - Personal message filled');
  }

  // Check send button
  const sendBtn = page.locator('button:has-text("Opprett og send")');
  console.log(`Step 3 - Send button visible: ${await sendBtn.isVisible().catch(() => false)}`);
  console.log(`Step 3 - Send button enabled: ${await sendBtn.isEnabled()}`);

  await page.screenshot({ path: '/tmp/invite-step3-final.png', fullPage: true });

  // Click send — expect 503 since no email config locally
  await sendBtn.click();
  await page.waitForTimeout(3000);

  // Check result
  const dialogAfter = await dialog.textContent();
  if (dialogAfter.includes('E-post er ikke konfigurert')) {
    console.log('Result: 503 "E-post er ikke konfigurert" (expected locally, works on Render)');
  } else if (dialogAfter.includes('Opprettet og sendt')) {
    console.log('Result: SUCCESS! Invite created and sent');
  } else {
    console.log(`Result: ${dialogAfter.substring(0, 200)}`);
  }

  console.log(`\nAPI calls to /api/invites/admin/create-and-send: ${apiCalls.length}`);
  for (const call of apiCalls) {
    const body = JSON.parse(call.body || '{}');
    console.log(`  Payload:`);
    console.log(`    email: ${body.email}`);
    console.log(`    firstName: ${body.firstName}`);
    console.log(`    lastName: ${body.lastName}`);
    console.log(`    profession: ${body.profession}`);
    console.log(`    companyName: ${body.companyName}`);
    console.log(`    organizationNumber: ${body.organizationNumber}`);
    console.log(`    selectedPlan: ${body.selectedPlan}`);
    console.log(`    planName: ${body.planName}`);
    console.log(`    templateId: ${body.templateId}`);
    console.log(`    personalMessage: ${body.personalMessage}`);
  }

  await browser.close();
  console.log('\n=== FLOW TEST COMPLETE ===');
})();
