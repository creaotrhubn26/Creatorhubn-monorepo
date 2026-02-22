import { test, expect } from '@playwright/test';

const TEST_PAGE = '/e2e-casting-test.html';

test('debug tab2 buttons', async ({ page }) => {
  await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(3000);
  
  // Click tab-kandidater
  await page.locator('#tab-kandidater').click({ force: true });
  await page.waitForTimeout(2000);
  
  // Check the "Ny kandidat" button
  const btn1 = page.locator('button').filter({ hasText: /ny kandidat/i }).first();
  const isVis = await btn1.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('NY_KANDIDAT_VISIBLE:', isVis);
  
  // Check tooltip version  
  const tooltipBtn = page.locator('button[aria-label*="kandidat"]').first();
  const isTooltip = await tooltipBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('TOOLTIP_BTN_VISIBLE:', isTooltip);
  
  // Check all visible buttons with text
  const allBtns = await page.locator('button:visible').allTextContents();
  console.log('ALL_VISIBLE_BUTTONS:', JSON.stringify(allBtns.filter(t => t.trim()).slice(0, 20)));
  
  // What role="tabpanel" is visible?
  const panels = page.locator('[role="tabpanel"]');
  const panelCount = await panels.count();
  console.log('TOTAL_TABPANELS:', panelCount);
  for (let i = 0; i < panelCount; i++) {
    const p = panels.nth(i);
    const id = await p.getAttribute('id');
    const vis = await p.isVisible();
    if (vis) console.log('VISIBLE_PANEL:', id);
  }
  
  // Check project selector status
  const projDialog = page.locator('[role="dialog"]');
  const dialogCount = await projDialog.count();
  console.log('DIALOG_COUNT:', dialogCount);
  for (let i = 0; i < dialogCount; i++) {
    const d = projDialog.nth(i);
    const vis = await d.isVisible();
    if (vis) {
      const text = await d.textContent();
      console.log('VISIBLE_DIALOG:', text?.substring(0, 150));
    }
  }
  
  // Check project name
  const projName = page.locator('text=/TROLL/i').first();
  const hasTroll = await projName.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('TROLL_PROJECT_VISIBLE:', hasTroll);
  
  // Tab 6 debug
  await page.locator('#tab-rekvisitter').click({ force: true });
  await page.waitForTimeout(2000);
  const tab6Text = await page.locator('[role="tabpanel"]:visible').textContent().catch(() => 'NONE');
  console.log('TAB6_TEXT:', tab6Text?.substring(0, 200));
  
  console.log('DONE');
});
