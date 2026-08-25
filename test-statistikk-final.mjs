import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5099/admin', { waitUntil: 'networkidle', timeout: 30000 });
const statistikkButton = page.locator('button:has-text("Statistikk")');
await statistikkButton.click();
await page.waitForTimeout(3000);

const bodyText = await page.textContent('body');

// "Enterprise"-CHIPS should be gone, but "Enterprise Omsetning" label text is OK
const hasEnterpriseChip = await page.locator('.MuiChip-root:has-text("Enterprise")').count();
console.log(`=== FINAL VERIFICATION ===`);
console.log(`  ${hasEnterpriseChip === 0 ? '✅' : '❌'} Ingen "Enterprise" chips (${hasEnterpriseChip} funnet)`);
console.log(`  ${bodyText.includes('Enterprise Omsetning') ? '✅' : '❌'} "Enterprise Omsetning" label vises`);

// Check skeleton pulse animation exists
const pulseElements = await page.evaluate(() => {
  const els = document.querySelectorAll('[class*="MuiBox-root"]');
  let pulseCount = 0;
  for (const el of els) {
    const style = getComputedStyle(el);
    if (style.animation && style.animation.includes('pulse')) pulseCount++;
  }
  return pulseCount;
});
console.log(`  ${pulseElements > 0 ? '✅' : '❌'} Skeleton pulse-animation aktiv (${pulseElements} elementer)`);

// Check retry button (only visible when no data)
console.log(`  ⏭️  "Prøv igjen" — bare synlig når ingen data (data er lastet her)`);

// Check a11y
const a11yCards = await page.locator('[role="button"][tabindex="0"]').count();
console.log(`  ${a11yCards >= 4 ? '✅' : '❌'} Klikkbare kort med role="button" + tabIndex (${a11yCards})`);

// Check System Health margin
const systemHealthCard = await page.locator('text=Systemhelse').first();
const parentBox = await systemHealthCard.locator('xpath=ancestor::div[contains(@class, "MuiCard-root")]').first();
const marginBottom = await parentBox.evaluate(el => getComputedStyle(el.parentElement).marginBottom);
console.log(`  ${marginBottom !== '0px' ? '✅' : '❌'} Systemhelse har bunnmargin (${marginBottom})`);

console.log(`\nRuntime-feil: ${errors.length === 0 ? '✅ Ingen' : errors.length}`);
errors.forEach(e => console.log(`  ❌ ${e}`));

await browser.close();
