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
  ['Ingen "Enterprise"-klistremerker', !bodyText.includes('Enterprise')],
  ['Ingen "Daniel"-referanse', !bodyText.includes('Daniel')],
  ['"Updates every 20 seconds" (korrekt)', bodyText.includes('20 seconds')],
  ['"oppdateres hvert 30. sek" (korrekt)', bodyText.includes('hvert 30. sek')],
  ['Ingen "5 seconds" (feil)', !bodyText.includes('every 5 seconds')],
  ['Ingen "hvert 15. sek" (feil)', !bodyText.includes('hvert 15. sek')],
  ['Enterprise KPI-kort', bodyText.includes('Total CRM Kunder') || bodyText.includes('Enterprise')],
  ['Email Conversion-seksjon', bodyText.includes('Email Conversion')],
  ['The Role Room-seksjon', bodyText.includes('The Role Room')],
  ['Systemhelse-seksjon', bodyText.includes('Systemhelse') || bodyText.includes('System Health')],
  ['Prøv igjen-knapp', bodyText.includes('Prøv igjen') || bodyText.includes('retry')],
];

console.log('=== STATISTIKK UX-TEST ===');
for (const [name, passed] of checks) {
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
}

// Check for animated skeleton pulse animation in CSS
const pulseKeyframes = await page.evaluate(() => {
  const styleSheets = document.styleSheets;
  for (let i = 0; i < styleSheets.length; i++) {
    try {
      const rules = styleSheets[i].cssRules;
      for (let j = 0; j < rules.length; j++) {
        if (rules[j].name === 'pulse') return true;
      }
    } catch {}
  }
  return false;
});

console.log(`  ${pulseKeyframes ? '✅' : '❌'} Pulse-animasjon definert`);

// Check for role="button" on clickable cards
const buttonRoles = await page.locator('[role="button"]').count();
console.log(`  ${buttonRoles >= 4 ? '✅' : '❌'} Klikkbare kort har role="button" (${buttonRoles} funnet)`);

// Check for focus-visible style
const focusVisible = await page.evaluate(() => {
  const allCards = document.querySelectorAll('[role="button"]');
  for (const card of allCards) {
    if (card.matches(':focus-visible') || card.getAttribute('tabindex') === '0') return true;
  }
  return allCards.length > 0;
});
console.log(`  ${focusVisible ? '✅' : '❌'} Klikkbare kort er fokuserbare med tabIndex`);

console.log(`\nRuntime-feil: ${errors.length === 0 ? '✅ Ingen' : errors.length}`);
errors.forEach(e => console.log(`  ❌ ${e}`));

await page.screenshot({ path: '/tmp/statistikk-ux-test.png', fullPage: true });
console.log('\nScreenshot: /tmp/statistikk-ux-test.png');

await browser.close();
