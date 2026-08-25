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
  ['Datakvalitet-seksjon', bodyText.includes('Datakvalitet')],
  ['Ingen "creatorhub_users" i UI', !bodyText.includes('creatorhub_users')],
  ['"users" tabellnavn', bodyText.includes('users')],
  ['"analytics_events" tabellnavn', bodyText.includes('analytics_events')],
  ['"Siste event" vises', bodyText.includes('Siste event')],
  ['"Siste innlogging registrert" vises', bodyText.includes('Siste innlogging registrert')],
];

console.log('=== DATAKVALITET-VERIFISERING ===');
for (const [name, passed] of checks) {
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
}

console.log(`\nRuntime-feil: ${errors.length === 0 ? '✅ Ingen' : errors.length}`);
errors.forEach(e => console.log(`  ❌ ${e}`));

await browser.close();
