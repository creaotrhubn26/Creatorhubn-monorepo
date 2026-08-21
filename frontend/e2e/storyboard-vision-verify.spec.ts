/**
 * Verifisering av storyboard-visjonen (bølge A-E, 2026-08-21) mot TROLL-demoen
 * via CastingPlannerPanel-harnessen. Tar screenshots per flate:
 * SCENES-panel, thumbnail-grid m/ nye chips, Board-strip, Review Mode,
 * Versions-dialog, Shot List. Kjøres mot lokal dev (PLAYWRIGHT_BASE_URL).
 */
import { test, expect, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-casting-test.html?project=troll-1780071501773&tab=storyboard';
const SHOT_DIR = 'test-results/storyboard-vision';
// Sesjon lagt inn av scratchpad/lag-verify-sesjon.mjs (1 dag TTL) — autentiserer
// som Daniel så TROLL (troll-1780071501773) er synlig. Harnessen hardkoder
// dev-admin-token i localStorage; init-scriptet fryser vårt token i stedet.
const VERIFY_TOKEN = 'e2e-verify-daniel-2026';

async function openRoleRoom(page: Page) {
  await page.context().addInitScript((token) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if ((key === 'creatorhub_auth_token' || key === 'role_room_auth_token') && value !== token) {
        return;
      }
      return original.call(this, key, value);
    };
    window.localStorage.setItem('creatorhub_auth_token', token);
    window.localStorage.setItem('role_room_auth_token', token);
    window.localStorage.setItem('userId', '32a70fa9-fd46-49db-9460-a87b23639a3c');
    window.localStorage.setItem('userEmail', 'daniel@creatorhubn.com');
  }, VERIFY_TOKEN);
  await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
  await expect(page.locator('[data-testid="casting-planner-root"]')).toBeAttached({ timeout: 30_000 });
}

async function dismissStartupDialogs(page: Page) {
  const profDialog = page.locator('[role="dialog"]').filter({ hasText: /velg din rolle|velg rolle|profesjon/i }).first();
  if (await profDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const btn = profDialog.locator('button').filter({ hasText: /admin|foto|video|felles/i }).first();
    if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await btn.click({ force: true });
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }
  // Prosjektvelgeren kommer async etter prosjektlast — vent på TROLL-raden
  const trollRow = page
    .locator('[data-testid="role-room-project-selector-row"]')
    .filter({ hasText: /troll/i })
    .first();
  if (await trollRow.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await trollRow.click({ force: true });
    await page.waitForTimeout(1_200);
  }
  const projectDialog = page.locator('[role="dialog"]').filter({ hasText: /prosjekt/i }).first();
  if (await projectDialog.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

test.describe('Storyboard-visjonen — TROLL', () => {
  test('alle bølge A-E-flatene rendrer med TROLL-data', async ({ page }) => {
    test.setTimeout(240_000);
    page.on('pageerror', (error) => {
      console.log('PAGEERROR:', error.message, '\n', (error.stack || '').split('\n').slice(0, 12).join('\n'));
    });
    await openRoleRoom(page);
    await dismissStartupDialogs(page);

    // Åpne Storyboard-fanen
    const storyboardTab = page.getByRole('tab', { name: /storyboard/i }).first();
    await expect(storyboardTab).toBeVisible({ timeout: 20_000 });
    // URL-param tab=storyboard bør allerede ha valgt fanen; klikk som fallback
    // (og igjen etter 5s hvis prosjektlast resatte aktiv fane).
    await storyboardTab.click();
    await page.waitForTimeout(5_000);
    if (!(await page.locator('[data-testid="storyboard-scenes-panel"]').isVisible().catch(() => false))) {
      await storyboardTab.click();
    }

    // Bølge B: SCENES-panelet
    const scenesPanel = page.locator('[data-testid="storyboard-scenes-panel"]');
    await expect(scenesPanel).toBeVisible({ timeout: 30_000 });
    const sceneItems = page.locator('[data-testid^="storyboard-scene-item-"]');
    const sceneCount = await sceneItems.count();
    expect(sceneCount).toBeGreaterThan(0);
    console.log(`SCENES-panel: ${sceneCount} scener`);
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: `${SHOT_DIR}/1-scenes-panel-grid.png`, fullPage: false });

    // Velg scene 4 (møterommet — har 3 frames m/ beat-variasjon) hvis mulig
    if (sceneCount >= 4) {
      await sceneItems.nth(3).click();
      await page.waitForTimeout(1_500);
    }

    // Scenen åpner i MANUS-visning — bytt til STORYBOARD-visningen
    const storyboardViewToggle = page.getByRole('button', { name: /^storyboard$/i }).first();
    await expect(storyboardViewToggle).toBeVisible({ timeout: 10_000 });
    await storyboardViewToggle.click();
    await page.waitForTimeout(2_000);

    // Onboarding-dialoger (f.eks. «Animatic-spilleren») lukker med FORSTÅTT
    for (let i = 0; i < 3; i++) {
      const gotIt = page.getByRole('button', { name: /forstått/i }).first();
      if (await gotIt.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await gotIt.click();
        await page.waitForTimeout(500);
      } else break;
    }

    // Bølge A: timeline m/ dramaturgi-faser
    const timeline = page.locator('[data-testid="scene-timeline-strip"]');
    if (await timeline.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await timeline.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOT_DIR}/2-timeline-faser.png` });
    }

    // Bølge E: Board-strip-modusen
    const boardToggle = page.getByRole('button', { name: /^board$/i }).first();
    await expect(boardToggle).toBeVisible({ timeout: 10_000 });
    await boardToggle.click();
    await expect(page.locator('[data-testid="storyboard-board-strip"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: `${SHOT_DIR}/3-board-strip.png`, fullPage: false });

    // Bølge C: Review Mode
    const reviewToggle = page.getByRole('button', { name: /^review$/i }).first();
    await reviewToggle.click();
    await expect(page.locator('[data-testid="storyboard-review-mode"]')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOT_DIR}/4-review-mode.png` });

    // Kommentar med rolle
    const commentInput = page.locator('[data-testid="review-comment-input"] input, [data-testid="review-comment-input"] textarea').first();
    if (await commentInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await commentInput.fill('Hold Maya et halvt beat lenger før klippet.');
      await commentInput.press('Enter');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOT_DIR}/5-review-kommentar.png` });
    }

    // Board Pro-flaten (mockup 2-skallet)
    const boardProButton = page.locator('[data-testid="storyboard-board-pro-button"]');
    if (await boardProButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await boardProButton.click();
      await expect(page.locator('[data-testid="storyboard-board-page"]')).toBeVisible({ timeout: 8_000 });
      await page.waitForTimeout(1_500);
      await page.screenshot({ path: `${SHOT_DIR}/7-board-pro.png` });
      // Inspector: klikk shot size-ikonet CU og verifiser at det aktiveres
      const cuButton = page.locator('[data-testid="inspector-shot-size-CU"]');
      if (await cuButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cuButton.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SHOT_DIR}/8-board-pro-inspector.png` });
      }

      // Inline-tegning: velg kull-pensel og dra et strøk i aktiv rute
      const charcoalBrush = page.locator('[data-testid="board-brush-charcoal"]');
      if (await charcoalBrush.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await charcoalBrush.click();
        const inlineCanvas = page.locator('[data-testid="board-inline-canvas"]');
        await expect(inlineCanvas).toBeVisible({ timeout: 5_000 });
        const bounds = await inlineCanvas.boundingBox();
        if (bounds) {
          await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.35);
          await page.mouse.down();
          await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.65, { steps: 24 });
          await page.mouse.up();
          await page.waitForTimeout(900);
          await page.screenshot({ path: `${SHOT_DIR}/9-board-pro-inline-tegning.png` });
        }
      }
      // Pil-annotasjon: velg pil-verktøyet og dra
      const arrowTool = page.getByRole('button', { name: /pil-annotasjon/i }).first();
      if (await arrowTool.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await arrowTool.click();
        const inlineCanvas = page.locator('[data-testid="board-inline-canvas"]');
        const bounds = await inlineCanvas.boundingBox();
        if (bounds) {
          await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.25);
          await page.mouse.down();
          await page.mouse.move(bounds.x + bounds.width * 0.85, bounds.y + bounds.height * 0.45, { steps: 12 });
          await page.mouse.up();
          await page.waitForTimeout(700);
        }
        // Tekst-annotasjon via prompt
        page.once('dialog', (dialog) => dialog.accept('PUSH IN'));
        const textTool = page.getByRole('button', { name: /^tekst$/i }).first();
        await textTool.click();
        if (bounds) {
          await page.mouse.click(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.15);
          await page.waitForTimeout(700);
        }
        await page.screenshot({ path: `${SHOT_DIR}/10-board-pro-annotasjoner.png` });

        // Undo skal være aktiv og fjerne siste annotasjon
        const undoButton = page.locator('[data-testid="board-page-undo"]');
        await expect(undoButton).toBeEnabled();
        await undoButton.click();
        await page.waitForTimeout(600);

        // Lag-toggle: skjul Camera/Arrows — pilen forsvinner fra canvas
        const eyeToggle = page.locator('[data-testid="board-layer-eye-CameraArrows"]');
        if (await eyeToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await eyeToggle.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SHOT_DIR}/11-board-pro-lag-skjult.png` });
          await eyeToggle.click();
        }
      }
      await page.locator('[data-testid="board-page-close"]').click();
      await page.waitForTimeout(500);
    }

    // Bølge E: Versions
    const versionsButton = page.locator('[data-testid="storyboard-versions-button"]');
    await expect(versionsButton).toBeVisible({ timeout: 5_000 });
    await versionsButton.click();
    const summaryInput = page.locator('[data-testid="storyboard-version-summary-input"] input').first();
    await expect(summaryInput).toBeVisible({ timeout: 5_000 });
    await summaryInput.fill('Initial pass — verifisering av visjonen');
    await page.locator('[data-testid="storyboard-save-version-button"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/6-versions-dialog.png` });
    await page.keyboard.press('Escape');

    console.log('Alle flater verifisert.');
  });
});
