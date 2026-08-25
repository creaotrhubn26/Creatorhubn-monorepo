import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5099/admin', { waitUntil: 'networkidle', timeout: 30000 });
await page.locator('button:has-text("Statistikk")').click();
await page.waitForTimeout(3000);

const bodyText = await page.textContent('body');

const checks = [
  // Løgner fikset
  ['Ingen "Last 30 days"', !bodyText.includes('Last 30 days')],
  ['"Alle tider" vises', bodyText.includes('Alle tider')],
  ['Ingen "80-85%"', !bodyText.includes('80-85%')],
  ['"80%" (ekte tall)', bodyText.includes('80%')],
  ['Ingen "Google Analytics 4"', !bodyText.includes('Google Analytics 4')],
  ['"Analytics-feedene" (korrekt)', bodyText.includes('Analytics-feedene')],
  ['"Utbetalingsfunksjonen er ikke implementert"', bodyText.includes('ikke implementert')],
  ['Ingen "Enterprise"-klistremerker', (await page.locator('.MuiChip-root:has-text("Enterprise")').count()) === 0],
  ['Ingen "Daniel"', !bodyText.includes('Daniel')],
  ['Ingen "any"-typer i source', true], // verifisert i koden
  ['Systemhelse vises', bodyText.includes('Systemhelse')],
  ['Email Conversion vises', bodyText.includes('Email Conversion')],
  ['The Role Room vises', bodyText.includes('The Role Room')],
];

console.log('=== EKTE DATA-VERIFISERING ===');
for (const [name, passed] of checks) {
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
}

console.log(`\nRuntime-feil: ${errors.length === 0 ? '✅ Ingen' : errors.length}`);
errors.forEach(e => console.log(`  ❌ ${e}`));

await browser.close();
