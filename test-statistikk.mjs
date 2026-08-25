import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5099/admin', { waitUntil: 'networkidle', timeout: 30000 });

// Click on "Statistikk" tab button
const statistikkButton = page.locator('button:has-text("Statistikk")');
await statistikkButton.click();
await page.waitForTimeout(3000);

const bodyText = await page.textContent('body');

const checks = [
  ['Ingen "Daniel"-referanse', !bodyText.includes('Daniel')],
  ['"Updates every 20 seconds" (korrekt)', bodyText.includes('20 seconds')],
  ['Ingen "5 seconds" (feil)', !bodyText.includes('every 5 seconds')],
  ['"oppdateres hvert 30. sek" (korrekt)', bodyText.includes('hvert 30. sek')],
  ['Ingen "hvert 15. sek" (feil)', !bodyText.includes('hvert 15. sek')],
  ['Ingen "Detaljert Analyse" (død knapp)', !bodyText.includes('Detaljert Analyse')],
  ['Enterprise KPI-kort', bodyText.includes('Total CRM Kunder') || bodyText.includes('Enterprise')],
  ['Email Conversion-seksjon', bodyText.includes('Email Conversion')],
  ['The Role Room-seksjon', bodyText.includes('The Role Room')],
  ['Kreative brukere', bodyText.includes('Kreative brukere')],
  ['Systemhelse/Uptime', bodyText.includes('Uptime') || bodyText.includes('uptime') || bodyText.includes('System Health')],
];

console.log('=== STATISTIKK-FANEN ===');
for (const [name, passed] of checks) {
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
}

console.log(`\nRuntime-feil: ${errors.length === 0 ? '✅ Ingen' : errors.length}`);
errors.forEach(e => console.log(`  ❌ ${e}`));

await page.screenshot({ path: '/tmp/statistikk-test.png', fullPage: true });
console.log('\nScreenshot: /tmp/statistikk-test.png');

await browser.close();
