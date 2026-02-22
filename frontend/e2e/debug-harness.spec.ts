import { test, expect, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-casting-test.html';

async function openRoleRoom(page: Page) {
  await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
  await expect(
    page.locator('text=/Role Room|Casting|produksjonsplanlegging/i').first()
  ).toBeVisible({ timeout: 30_000 });
}

async function ensureProject(page: Page) {
  const projectDialog = page.locator('[role="dialog"]').filter({ hasText: /prosjekt|project/i });
  const isDialogVisible = await projectDialog.isVisible().catch(() => false);
  console.log('ensureProject: dialog visible?', isDialogVisible);
  if (isDialogVisible) {
    const projectItem = projectDialog.locator('[role="listitem"], li, [data-testid*="project"]').first();
    const hasProject = await projectItem.isVisible({ timeout: 3_000 }).catch(() => false);
    console.log('ensureProject: hasProject?', hasProject);
    if (hasProject) {
      await projectItem.click();
      await page.waitForTimeout(500);
    }
  }
}

async function clickTab(page: Page, tabId: string) {
  const tab = page.locator(`#${tabId}`);
  const isVis = await tab.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log('clickTab:', tabId, 'visible?', isVis);
  await tab.scrollIntoViewIfNeeded({ timeout: 5_000 });
  await tab.click();
  await page.waitForTimeout(600);
}

test('debug: dismiss both dialogs and click tab', async ({ page }) => {
  console.log('1. openRoleRoom...');
  await openRoleRoom(page);
  
  // Count initial dialogs
  const dCount = await page.locator('[role="dialog"]').count();
  console.log('Initial dialogs:', dCount);
  
  // List dialog content
  for (let i = 0; i < dCount; i++) {
    const d = page.locator('[role="dialog"]').nth(i);
    const text = await d.textContent().catch(() => '');
    console.log(`Dialog ${i}: "${text?.substring(0, 100)}"`);
  }
  
  // If only project selector remains, click a project or close it
  if (dCount > 0) {
    // Try to click the close button (X) on the project selector
    const closeBtn = page.locator('[role="dialog"] button').filter({ has: page.locator('svg') }).first();
    const hasClose = await closeBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Close button visible:', hasClose);
    if (hasClose) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Or try clicking a project item
    const trollItem = page.locator('text=/TROLL/i').first();
    const hasTroll = await trollItem.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('TROLL visible:', hasTroll);
    if (hasTroll) {
      await trollItem.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }
  
  const remaining = await page.locator('[role="dialog"]').count();
  console.log('Remaining dialogs:', remaining);
  
  // Try clicking a tab
  const tab = page.locator('#tab-roller');
  try {
    await tab.click({ timeout: 5000 });
    console.log('Tab click SUCCESS');
  } catch (e: any) {
    console.log('Tab click FAILED:', e.message.substring(0, 200));
  }
});

test('debug: all tab IDs exist', async ({ page }) => {
  await openRoleRoom(page);
  const tabIds = ['tab-oversikt', 'tab-roller', 'tab-kandidater', 'tab-auditions', 
    'tab-team', 'tab-lokasjoner', 'tab-rekvisitter', 'tab-produksjonsplan', 
    'tab-shot-lists', 'tab-story-arc-studio', 'tab-deling'];
  
  for (const id of tabIds) {
    const vis = await page.locator(`#${id}`).isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Tab ${id}: ${vis ? 'FOUND' : 'MISSING'}`);
  }
});
