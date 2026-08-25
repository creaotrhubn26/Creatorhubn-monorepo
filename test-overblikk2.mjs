import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('pageerror', (err) => console.log(`PAGE_ERROR: ${err.message}`));

await page.goto('http://localhost:5099/admin', { waitUntil: 'networkidle', timeout: 30000 });

// Siden er lastet - hent all synlig tekst
const bodyText = await page.textContent('body');

// Sjekk hva som faktisk er på siden
const checks = [
  'Sammendrag', 'Statistikk', 'Aktivitet',
  'CRM-kunder', 'Omsetning', 'abonnement', 'deals',
  'Trenger oppfølging', 'oppfølging', 'Systemhelse', 'Nøkkeltall',
  'aktivitet', 'Aktivitet',
  'Customer Success-snapshot', 'snapshot',
  'Brukere & roller', 'Quick Actions', 'quick action',
  'Rollenivå', 'Full admin', 'Sesjon',
  'Daniel', 'startflaten',
  'oppgaver', 'oppgave',
];

console.log('=== TEKST PÅ SIDEN (utvalg) ===');
for (const term of checks) {
  const found = bodyText.includes(term);
  console.log(`  ${found ? '✅' : '❌'} "${term}"`);
}

// Hent tabs
const tabs = await page.locator('[role="tab"]').allTextContents();
console.log('\n=== TABS ===');
console.log(`  ${JSON.stringify(tabs)}`);

// Hent KPI-verdier
const kpiCards = await page.locator('.MuiCard-root').allTextContents();
console.log('\n=== ALLE KORT (første 2000 chars) ===');
const allCards = kpiCards.join('\n---\n').substring(0, 2000);
console.log(allCards);

// Sjekk console errors
console.log('\n=== SØK ETTER "snapshot" i hele siden ===');
const snapshotMatches = bodyText.match(/.{0,50}snapshot.{0,50}/gi);
if (snapshotMatches) {
  snapshotMatches.forEach(m => console.log(`  FOUND: "${m.trim()}"`));
} else {
  console.log('  Ingen snapshot-tekst funnet');
}

console.log('\n=== SØK ETTER "Daniel" i hele siden ===');
const danielMatches = bodyText.match(/.{0,50}[Dd]aniel.{0,50}/g);
if (danielMatches) {
  danielMatches.forEach(m => console.log(`  FOUND: "${m.trim()}"`));
} else {
  console.log('  Ingen Daniel-tekst funnet');
}

await browser.close();
