import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5099/admin', { waitUntil: 'networkidle', timeout: 30000 });
await page.locator('button:has-text("Statistikk")').click();
await page.waitForTimeout(3000);

// Scroll down to see the Google Analytics section
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(2000);

const bodyText = await page.textContent('body');

const checks = [
  ['Datakvalitet-seksjon', bodyText.includes('Datakvalitet')],
  ['"Siste event" vises', bodyText.includes('Siste event')],
  ['"Siste innlogging registrert" vises', bodyText.includes('Siste innlogging registrert')],
  ['Ingen "creatorhub_users" i UI', !bodyText.includes('creatorhub_users')],
  ['"users" tabellnavn', bodyText.includes('users')],
  ['"analytics_events" tabellnavn', bodyText.includes('analytics_events')],
];

console.log('=== DATAKVALITET (SCROLLT) ===');
for (const [name, passed] of checks) {
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
}

console.log(`\nRuntime-feil: ${errors.length === 0 ? '✅ Ingen' : errors.length}`);
errors.forEach(e => console.log(`  ❌ ${e}`));

await browser.close();
