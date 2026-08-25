import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});

console.log('1. Navigerer til /admin...');
await page.goto('http://localhost:5099/admin', { waitUntil: 'networkidle', timeout: 30000 });

console.log('2. Sjekker om vi blir sendt til login...');
const url = page.url();
console.log(`   URL: ${url}`);

if (url.includes('login')) {
  console.log('   -> Krever innlogging. Sjekker om det er en admin-side...');
  const loginText = await page.textContent('body');
  console.log(`   Sidetekst (first 500 chars): ${loginText.substring(0, 500)}`);
}

// Sjekk om "Sammendrag" fanen / overblikk vises
console.log('3. Sjekker for Sammendrag-innhold...');
const bodyText = await page.textContent('body');

const checks = [
  ['KPI-kort (CRM-kunder)', bodyText.includes('CRM-kunder')],
  ['KPI-kort (Omsetning)', bodyText.includes('Omsetning')],
  ['KPI-kort (abonnement)', bodyText.includes('abonnement')],
  ['KPI-kort (deals)', bodyText.includes('deals')],
  ['Trenger oppfølging', bodyText.includes('Trenger oppfølging') || bodyText.includes('oppfølging')],
  ['Systemhelse', bodyText.includes('Systemhelse') || bodyText.includes('helse')],
  ['Nylig aktivitet', bodyText.includes('aktivitet') || bodyText.includes('Aktivitet')],
  ['Ingen "CustomerSuccessSnapshot"', !bodyText.includes('Customer Success-snapshot')],
  ['Ingen "Quick Actions" snarveier', !bodyText.includes('Brukere & roller') || bodyText.includes('Brukere & roller') === false],
];

for (const [name, passed] of checks) {
  console.log(`   ${passed ? '✅' : '❌'} ${name}`);
}

// Sjekk for skeletons (loading state)
console.log('4. Sjekker for loading-skeletons...');
const skeletons = await page.locator('.MuiSkeleton-root').count();
console.log(`   Antall skeletons: ${skeletons}`);

// Sjekk for runtime errors
console.log('5. Runtime-feil:');
if (errors.length === 0) {
  console.log('   ✅ Ingen runtime-feil');
} else {
  errors.forEach(e => console.log(`   ❌ ${e}`));
}

// Ta screenshot
await page.screenshot({ path: '/tmp/overblikk-test.png', fullPage: true });
console.log('6. Screenshot lagret: /tmp/overblikk-test.png');

await browser.close();
