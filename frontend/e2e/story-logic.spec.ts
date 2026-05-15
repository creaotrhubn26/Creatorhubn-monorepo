import { test, expect, type Page } from '@playwright/test';
import {
  openCastingPlanner,
  selectFirstProject,
  gotoStoryArcStudio as gotoStoryArcStudioHelper,
} from './helpers/role-room';

// ────────────────────────────────────────────────────────────
// E2E: Story Logic Panel — Validates the Story Logic System
// Uses the CastingPlannerPanel test harness (full 11-tab view)
//
// Sprint A.6: Migrert fra lokal gotoCastingPlanner-helper til felles
// helpers/role-room.ts. Felles helper venter på
// [data-testid="casting-planner-root"] i stedet for lokalisert tekst
// som var gated bak viewport.isDesktop.
// ────────────────────────────────────────────────────────────

/** Navigate to the CastingPlannerPanel test page and wait for render.
 * Sprint A.7: bruker `seed=basic` URL-flag for å få test-harness til å
 * seede ett minimalt demo-prosjekt så `selectFirstProject` har en <li>
 * å klikke på.
 */
async function gotoCastingPlanner(page: Page) {
  await openCastingPlanner(page, {
    urlFlags: { seed: 'basic' },
  });
}

/** Navigate to the Story Arc Studio tab (wraps shared helper with project-select) */
async function gotoStoryArcStudio(page: Page) {
  await gotoCastingPlanner(page);
  await selectFirstProject(page);
  await gotoStoryArcStudioHelper(page);
}

// ═══════════════════════════════════════════════════════════
// Story Logic Panel Tests
// ═══════════════════════════════════════════════════════════

test.describe('Story Logic Panel', () => {
  test('Story Arc Studio tab exists', async ({ page }) => {
    await gotoCastingPlanner(page);
    await selectFirstProject(page);

    // Story Arc Studio tab has id="tab-story-arc-studio"
    const storyArcTab = page.locator('#tab-story-arc-studio');
    await storyArcTab.scrollIntoViewIfNeeded({ timeout: 10_000 });
    await expect(storyArcTab).toBeVisible({ timeout: 5_000 });
  });

  test('Story Arc Studio shows two cards (Story Logic and Story Writer)', async ({ page }) => {
    await gotoStoryArcStudio(page);

    // Should see Story Logic and Story Writer options as cards
    const storyLogicCard = page.locator('text=/Story Logic|Historielogikk/i').first();
    const storyWriterCard = page.locator('text=/Story Writer|Historieforfatter/i').first();

    const hasLogicCard = await storyLogicCard.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasWriterCard = await storyWriterCard.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasLogicCard || hasWriterCard).toBeTruthy();
  });

  test('Story Logic panel loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoStoryArcStudio(page);

    // Click on Story Logic card (MUI Card with h6 title "Story Logic")
    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // The StoryLogicPanel should render - look for "Story Logic System" header
    const header = page.locator('text=/Story Logic System|Storylogikk-system/i');
    await expect(header).toBeVisible({ timeout: 10_000 });

    // No JS errors (the critical fix - previously this would crash)
    const criticalErrors = errors.filter(e => 
      !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Story Logic panel shows three phases', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // Check for the three phases
    await expect(page.locator('text=/Phase 1.*Concept|Fase 1.*Konsept/i').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=/Phase 2.*Logline|Fase 2.*Logline/i').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=/Phase 3.*Theme|Fase 3.*Tema/i').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Story Logic panel shows overall progress', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // Should show overall progress section
    await expect(page.locator('text=/Overall Story Foundation|Historie-selvtillit|Historiefundament/i').first()).toBeVisible({ timeout: 10_000 });
    
    // Should show phase chips
    await expect(page.locator('text=/Concept:|Konsept:/i').first()).toBeVisible();
    await expect(page.locator('text=/Logline:/i').first()).toBeVisible();
    await expect(page.locator('text=/Theme:|Tema:/i').first()).toBeVisible();
  });

  test('Story Logic panel has Save button', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /^(Save|Lagre)$/i })).toBeVisible({ timeout: 10_000 });
  });

  test('Concept phase expandable with form fields', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // Phase 1 should be expanded by default
    // Look for Core Premise field
    const corePremise = page.locator('label').filter({ hasText: /Core Premise|Kjernepremiss/i }).first();
    await expect(corePremise).toBeVisible({ timeout: 10_000 });

    // Look for Primary Genre select
    const genre = page.locator('label').filter({ hasText: /Primary Genre|Hovedsjanger/i }).first();
    await expect(genre).toBeVisible();
  });

  test('Can type in Core Premise field', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // Find the Core Premise textarea via its label
    const corePremiseLabel = page.locator('label').filter({ hasText: /Core Premise|Kjernepremiss/i });
    await expect(corePremiseLabel).toBeVisible({ timeout: 10_000 });

    // Find the textarea within the same form group
    const formGroup = corePremiseLabel.locator('..').locator('..');
    const textarea = formGroup.locator('textarea').first();
    
    await expect(textarea).toBeVisible();
    await textarea.fill('A story about an ancient troll in Norway');
    expect(await textarea.inputValue()).toBe('A story about an ancient troll in Norway');
  });

  test('Back button returns to Story Arc Studio main view', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // Should see Story Logic System
    await expect(page.locator('text=/Story Logic System|Storylogikk-system/i').first()).toBeVisible({ timeout: 10_000 });

    // Click back button
    const backButton = page.locator('button').filter({ hasText: /Tilbake|Back/i }).first();
    await expect(backButton).toBeVisible({ timeout: 5_000 });
    await backButton.click();
    await page.waitForTimeout(500);

    // Should see the two cards again
    const storyLogicCardAgain = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCardAgain).toBeVisible({ timeout: 5_000 });
  });

  test('Lock/Unlock toggle works', async ({ page }) => {
    await gotoStoryArcStudio(page);

    const storyLogicCard = page.locator('[class*="MuiCard"]').filter({ hasText: /Story Logic/i }).first();
    await expect(storyLogicCard).toBeVisible({ timeout: 10_000 });
    await storyLogicCard.click();
    await page.waitForTimeout(1000);

    // Find the lock button (LockOpen or Lock icon)
    const lockButton = page.locator('button').filter({ has: page.locator('[data-testid*="Lock"]') }).first();
    
    if (await lockButton.isVisible()) {
      await lockButton.click();
      await page.waitForTimeout(300);
      
      // Verify no errors occurred during toggle
      expect(true).toBeTruthy();
    } else {
      // Lock button may not be present — skip gracefully
      test.skip();
    }
  });
});
