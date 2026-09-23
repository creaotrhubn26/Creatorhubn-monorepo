/**
 * Story Graph Fase 7c — Historie, scenekort v2 (Manus/Replikker/Gater),
 * Karakterer, Lokasjoner og Plattform mot det ekte prosjektet (fixture).
 */
import { expect, test, type Page } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

async function open(page: Page, tab: string, extra = '') {
  await installNarrativeMocks(page, { seed: 'what-follows-us' });
  await page.goto(`/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=${tab}${extra}`);
  await expect(page.getByTestId('narrative-workspace')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — historie, scenekort v2, karakterer, lokasjoner, plattform', () => {
  test('Hjem: «Neste scene å bygge» peker på en uferdig scene og åpner scenekortet (Fase 9)', async ({ page }) => {
    await open(page, 'home');
    const card = page.getByTestId('narrative-home-next-scene');
    await expect(card).toBeVisible();
    const title = (await page.getByTestId('narrative-home-next-scene-title').innerText()).trim();
    const code = title.split(' – ')[0];
    expect(code).toMatch(/^[A-Z]{1,3}\d{1,4}[A-Z]?$/);
    await page.getByTestId('narrative-home-next-scene-open').click();
    await expect(page.getByTestId('narrative-scenes-panel')).toBeVisible();
    await expect(page).toHaveURL(/scene=nsc_/);
  });

  test('Historie: E01 vises med P01–P03, tidslinje, åpne spørsmål kan avgjøres, kilder med SHA-256', async ({ page }) => {
    await open(page, 'story');
    const e01 = page.getByTestId('narrative-episode-E01');
    await expect(e01).toBeVisible();
    for (const code of ['P01', 'P02', 'P03']) await expect(e01.getByTestId(`narrative-episode-scene-${code}`)).toBeVisible();
    await page.getByTestId('narrative-story-tab-timeline').click();
    await expect(page.getByTestId('narrative-timeline-1797')).toBeVisible();
    await expect(page.getByTestId('narrative-timeline-1817')).toContainText('1817');
    await page.getByTestId('narrative-story-tab-questions').click();
    const q01 = page.getByTestId('narrative-question-Q01');
    await expect(q01).toHaveAttribute('data-status', 'open');
    await page.getByTestId('narrative-question-decide-Q01').click();
    await page.getByTestId('narrative-question-decision').fill('Kartet lokker Elise; de tre andre har egne grunner som vises i G01.');
    await page.getByTestId('narrative-question-decide-save').click();
    await expect(page.getByTestId('narrative-question-Q01')).toHaveCount(0); // filter «bare åpne»
    await page.getByTestId('narrative-story-tab-sources').click();
    await expect(page.getByTestId('narrative-source-sha-W')).toHaveText('553a5e2f0ea0a8302e6981f4a219c4ef8329b1226803c7259885aa26e6201633');
    await page.getByTestId('narrative-source-verify-W').click();
    await expect(page.getByTestId('narrative-source-verified-W')).toBeVisible();
  });

  test('Scenekort P01: Manus har Før/Handling, Replikker viser W01.01–W01.07, ny replikk får foreslått cue', async ({ page }) => {
    await open(page, 'scenes', '&scene=nsc_p01&sceneTab=script');
    await expect(page.getByTestId('narrative-scene-field-beforeState')).toHaveValue(/Bok hos Elise/);
    await expect(page.getByTestId('narrative-scene-field-action')).toHaveValue(/Nora tar boken/);
    await expect(page.getByTestId('narrative-scene-era')).toHaveValue('1797');
    await expect(page.getByTestId('narrative-scene-source-ref-0')).toBeVisible();
    await page.getByTestId('narrative-scene-tab-lines').click();
    for (const cue of ['W01.01', 'W01.02', 'W01.07']) await expect(page.getByTestId(`narrative-line-${cue}`)).toBeVisible();
    await expect(page.getByTestId('narrative-line-en-W01.01')).toHaveValue('Must you read all the way home?');
    await expect(page.getByTestId('narrative-line-new-cue')).toHaveValue('W01.08');
    await page.getByTestId('narrative-line-new-label').fill('NORA');
    await page.getByTestId('narrative-line-new-text').fill('Come on, then.');
    await page.getByTestId('narrative-line-add').click();
    await expect(page.getByTestId('narrative-line-W01.08')).toBeVisible();
    // Duplikat cue → 409 → melding
    await page.getByTestId('narrative-line-new-cue').fill('W01.01');
    await expect(page.getByTestId('narrative-line-add')).toBeDisabled();
  });

  test('Gater: gråboks er bestått med bevis fra kilden; «Bestått» kan ikke settes uten bevis', async ({ page }) => {
    await open(page, 'scenes', '&scene=nsc_p01&sceneTab=gates');
    await expect(page.getByTestId('narrative-gate-greybox')).toHaveAttribute('data-status', 'passed');
    await expect(page.getByTestId('narrative-gate-evidence-greybox')).toHaveValue(/68 bestått/);
    const audio = page.getByTestId('narrative-gate-audio');
    await expect(audio).toHaveAttribute('data-status', 'not_started');
    await page.getByTestId('narrative-gate-evidence-audio').fill('');
    await page.getByTestId('narrative-gate-evidence-audio').blur();
    await expect(page.getByTestId('narrative-gate-set-audio-passed')).toBeDisabled();
    await page.getByTestId('narrative-gate-evidence-audio').fill('Miks godkjent i Foley-runde 2, fil Prologue-P01-mix-v2.wav');
    await page.getByTestId('narrative-gate-evidence-audio').blur();
    await expect(page.getByTestId('narrative-gate-set-audio-passed')).toBeEnabled();
    await page.getByTestId('narrative-gate-set-audio-passed').click();
    await expect(page.getByTestId('narrative-gate-audio')).toHaveAttribute('data-status', 'passed');
    await page.getByTestId('narrative-scene-tab-overview').click();
    await expect(page.getByTestId('narrative-scene-gate-chip-audio')).toHaveAttribute('data-status', 'passed');
  });

  test('Karakterer: Elise har minnespor R01–R06, replikker som taler og scener; forfatterfasit er skjult bak toggle', async ({ page }) => {
    await open(page, 'characters');
    await page.getByTestId('narrative-gallery-card-char_elise').click();
    await expect(page.getByTestId('narrative-gallery-detail-char_elise')).toBeVisible();
    await expect(page.getByTestId('narrative-gallery-memory-track')).toContainText('R01');
    await expect(page.getByTestId('narrative-gallery-memory-track')).toContainText('R06');
    await expect(page.getByTestId('narrative-gallery-line-W01.02')).toBeVisible();
    await expect(page.getByTestId('narrative-gallery-scene-P01')).toBeVisible();
    await expect(page.getByTestId('narrative-gallery-field-authorTruth')).toBeHidden();
    await page.getByTestId('narrative-gallery-internal-toggle').click();
    await expect(page.getByTestId('narrative-gallery-field-authorTruth')).toBeVisible();
    await page.getByTestId('narrative-gallery-scene-P01').click();
    await expect(page.getByTestId('narrative-tab-scenes')).toHaveAttribute('aria-selected', 'true');
  });

  test('Lokasjoner: Husken er koblet til P04 og P11 og har epoker', async ({ page }) => {
    await open(page, 'locations');
    await page.getByTestId('narrative-gallery-card-loc_swing').click();
    await expect(page.getByTestId('narrative-gallery-scene-P04')).toBeVisible();
    await expect(page.getByTestId('narrative-gallery-scene-P11')).toBeVisible();
    await expect(page.getByTestId('narrative-location-era-1797')).toHaveAttribute('data-on', 'true');
  });

  test('Plattform: iPad Pro M1 er primært mål med budsjett og krav; verifisert krever bevis', async ({ page }) => {
    await open(page, 'platform');
    await expect(page.getByTestId('narrative-platform-name')).toHaveValue(/iPad Pro M1/);
    await expect(page.getByTestId('narrative-platform-kind')).toHaveValue('ipad');
    await expect(page.getByTestId('narrative-platform-budget-fps')).toHaveValue(/30/);
    await expect(page.getByTestId('narrative-platform-req-MTLFX-device')).toHaveAttribute('data-status', 'unverified');
    await expect(page.getByTestId('narrative-platform-visual-lighting')).not.toHaveValue('');
    // Nytt krav → uverifisert
    await page.getByTestId('narrative-platform-req-new').click();
    await page.getByTestId('narrative-platform-req-new-text').fill('8 GB-varianten testes fysisk i 45 min');
    await page.getByTestId('narrative-platform-req-create').click();
    await expect(page.getByTestId('narrative-platform-req-R6')).toHaveAttribute('data-status', 'unverified');
  });
});
