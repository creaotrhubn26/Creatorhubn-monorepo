/**
 * Story Graph Fase 6 — «Scener & gameplay» + «Review & Godkjenning».
 *
 * Flyt: ny scene (kode foreslått, duplikat stoppes før lagring) → autosave
 * («Lagret») → koble element → «Åpne i Story Graph» → oppgave → be om review
 * → kommentar i tråden → godkjenn → chip «Godkjent». Pluss stale-vernet:
 * scenen endres bak ryggen → beslutning gir 409 → banner + «Send ny runde».
 */
import { test, expect, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockScenes } from './helpers/narrativeMocks';

const HARNESS = '/e2e-test.html?harness=game_studio&harness-project=proj-game-2026';

function withSession(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('role_room_auth_token', 'e2e-token');
    window.localStorage.setItem('role_room_auth_session', JSON.stringify({ currentUserId: 'u-e2e', adminUser: { id: 'u-e2e', name: 'Meg Selv', email: 'meg@example.com', role: 'user' } }));
  });
}

async function createScene(page: Page, title: string): Promise<string> {
  await page.getByTestId('narrative-scene-new').click();
  await expect(page.getByTestId('narrative-scene-new-dialog')).toBeVisible();
  await page.getByTestId('narrative-scene-new-title').fill(title);
  await page.getByTestId('narrative-scene-new-submit').click();
  await expect(page.getByTestId('narrative-scene-new-dialog')).toBeHidden();
  const card = page.locator('[data-testid^="narrative-scene-card-"]');
  await expect(card).toBeVisible();
  return (await card.getAttribute('data-testid'))!.replace('narrative-scene-card-', '');
}

test.describe('Story Graph — Scener & gameplay', () => {
  test('tom-state, ny scene med foreslått kode, duplikat stoppes før lagring, autosave med «Lagret»', async ({ page }) => {
    await withSession(page);
    await installNarrativeMocks(page, { gamePlan: 'studio' });
    await page.goto(`${HARNESS}&tab=scenes`);
    await expect(page.getByTestId('narrative-scenes-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-scenes-empty')).toBeVisible();

    await page.getByTestId('narrative-scene-new').click();
    await expect(page.getByTestId('narrative-scene-new-code')).toHaveValue('S1');
    await page.getByTestId('narrative-scene-new-title').fill('Skogpassasjen');
    await page.getByTestId('narrative-scene-new-title').press('Enter');
    await expect(page.getByTestId('narrative-scene-new-dialog')).toBeHidden();
    await expect(page.getByTestId('narrative-scene-title')).toContainText('S1 – Skogpassasjen');
    await expect(page.locator('[data-testid^="narrative-scene-row-"]')).toHaveCount(1);

    // Duplikat: forslaget er nå S2; skriv S1 → feil vises og knappen låses FØR noe sendes.
    await page.getByTestId('narrative-scene-new').click();
    await expect(page.getByTestId('narrative-scene-new-code')).toHaveValue('S2');
    await page.getByTestId('narrative-scene-new-code').fill('s1');
    await expect(page.getByText('«S1» er allerede i bruk.')).toBeVisible();
    await expect(page.getByTestId('narrative-scene-new-submit')).toBeDisabled();
    await page.getByTestId('narrative-scene-new-code').fill('B3');
    await page.getByTestId('narrative-scene-new-title').fill('Torget');
    await page.getByTestId('narrative-scene-new-submit').click();
    await expect(page.getByTestId('narrative-scene-title')).toContainText('B3 – Torget');
    await expect(page.locator('[data-testid^="narrative-scene-row-"]')).toHaveCount(2);

    // Autosave ved blur → «Lagret HH:MM», og lista speiler endringen.
    await page.getByTestId('narrative-scene-field-location').fill('Torget i Bergen');
    await page.getByTestId('narrative-scene-field-location').blur();
    await expect(page.getByTestId('narrative-scene-saved')).toBeVisible();
    const scenes = getMockScenes(page)!;
    expect(scenes.find((s) => s.code === 'B3')?.location).toBe('Torget i Bergen');

    // Søk og statusfilter
    await page.getByTestId('narrative-scenes-search').fill('skog');
    await expect(page.locator('[data-testid^="narrative-scene-row-"]')).toHaveCount(1);
    await page.getByTestId('narrative-scenes-search').fill('');
    await page.getByTestId('narrative-scenes-filter-approved').click();
    await expect(page.getByTestId('narrative-scenes-nomatch')).toBeVisible();
  });

  test('koble element, åpne i Story Graph, oppgave, review-runde med kommentar og godkjenning', async ({ page }) => {
    await withSession(page);
    await installNarrativeMocks(page, { gamePlan: 'studio' });
    await page.goto(`${HARNESS}&tab=scenes`);
    await expect(page.getByTestId('narrative-scenes-panel')).toBeVisible({ timeout: 15_000 });
    const sceneId = await createScene(page, 'Skogpassasjen');

    // Gameplay: koble «Landsbyen» (nel_start)
    await page.getByTestId('narrative-scene-tab-gameplay').click();
    await page.getByTestId('narrative-scene-field-challenge').fill('Finn veien gjennom skogen før mørket faller.');
    await page.getByTestId('narrative-scene-field-challenge').blur();
    await expect(page.getByTestId('narrative-scene-saved')).toBeVisible();
    await page.getByTestId('narrative-scene-link-picker').fill('Lands');
    await page.getByTestId('narrative-scene-link-option-nel_start').click();
    await expect(page.getByTestId('narrative-scene-link-chip-nel_start')).toBeVisible();
    await expect(page.getByTestId('narrative-scene-linked-nel_start')).toBeVisible();

    // «Åpne i Story Graph» → Brett-fanen med elementet valgt (skuffen åpnes)
    await page.getByTestId('narrative-scene-open-element-nel_start').click();
    await expect(page.getByTestId('narrative-element-drawer')).toBeVisible();
    await expect(page.getByTestId('narrative-element-title')).toHaveValue('Landsbyen');

    // Tilbake til scenen (URL husker scene + fane)
    await page.getByTestId('narrative-tab-scenes').click();
    await expect(page.getByTestId(`narrative-scene-card-${sceneId}`)).toBeVisible();
    await expect(page.getByTestId('narrative-scene-linked-nel_start')).toBeVisible();

    // Oppgave med ansvarlig fra members-lite; avkryssing er umiddelbar
    await page.getByTestId('narrative-scene-tab-tasks').click();
    await page.getByTestId('narrative-scene-task-title').fill('Lys-pass i skogen');
    await page.getByTestId('narrative-scene-task-assignee').fill('Kari');
    await page.getByTestId('narrative-scene-task-assignee-option-u-kari').click();
    await page.getByTestId('narrative-scene-task-add').click();
    const task = page.locator('[data-testid^="narrative-scene-task-nst_"]').first();
    await expect(task).toBeVisible();
    await expect(task).toHaveAttribute('data-status', 'todo');
    await task.locator('input[type="checkbox"]').check();
    await expect(task).toHaveAttribute('data-status', 'done');
    await expect(page.getByTestId('narrative-scene-task-progress')).toHaveText('100%');
    await expect(page.getByTestId('narrative-scene-tab-tasks')).toContainText('1/1');

    // Review: ingen runde → be om review → runde 1 åpen, knappen deaktivert med forklaring
    await page.getByTestId('narrative-scene-tab-review').click();
    await expect(page.getByTestId('narrative-plan-gate-scene_review')).toHaveCount(0);
    await expect(page.getByTestId('narrative-scene-review-status')).toHaveAttribute('data-status', 'none');
    await page.getByTestId('narrative-scene-review-request').click();
    await page.getByTestId('narrative-scene-review-note').fill('Klar for gjennomgang');
    await page.getByTestId('narrative-scene-review-submit').click();
    await expect(page.getByTestId('narrative-scene-review-request-dialog')).toBeHidden();
    await expect(page.getByTestId('narrative-scene-review-status')).toHaveAttribute('data-status', 'in_review');
    await expect(page.getByTestId('narrative-scene-review-request')).toBeDisabled();
    await expect(page.getByTestId('narrative-scene-header-status')).toHaveAttribute('data-status', 'in_review');

    // Kommentar i tråden (editor-comments, anker narrative_scene)
    await page.getByPlaceholder('Skriv en kommentar til scenen…').fill('Tempoet i midten er for lavt.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Tempoet i midten er for lavt.')).toBeVisible();

    // Godkjenn → runde godkjent, scenestatus «Godkjent», historikk viser runden
    await page.getByTestId('narrative-scene-review-approve').click();
    await page.getByTestId('narrative-scene-decision-note').fill('Fint!');
    await page.getByTestId('narrative-scene-decision-confirm').click();
    await expect(page.getByTestId('narrative-scene-decision-dialog')).toBeHidden();
    await expect(page.getByTestId('narrative-scene-review-status')).toHaveAttribute('data-status', 'approved');
    await expect(page.getByTestId('narrative-scene-header-status')).toHaveAttribute('data-status', 'approved');
    await expect(page.getByTestId('narrative-scene-header-status')).toHaveText('Godkjent');
    await page.getByTestId('narrative-scene-review-history-toggle').click();
    await expect(page.getByTestId('narrative-scene-review-round-1')).toHaveAttribute('data-status', 'approved');
    await expect(page.getByTestId(`narrative-scene-row-${sceneId}`)).toContainText('Godkjent');
  });

  test('stale-vern: scenen endres etter at runden ble sendt → beslutning sperres, 409 håndteres, ny runde kan sendes', async ({ page }) => {
    await withSession(page);
    await installNarrativeMocks(page, { gamePlan: 'pro' });
    await page.goto(`${HARNESS}&tab=scenes`);
    await expect(page.getByTestId('narrative-scenes-panel')).toBeVisible({ timeout: 15_000 });
    await createScene(page, 'Grotten');
    await page.getByTestId('narrative-scene-tab-review').click();
    await page.getByTestId('narrative-scene-review-request').click();
    await page.getByTestId('narrative-scene-review-submit').click();
    await expect(page.getByTestId('narrative-scene-review-status')).toHaveAttribute('data-status', 'in_review');
    await expect(page.getByTestId('narrative-scene-review-approve')).toBeEnabled();

    // 1) En kollega endrer scenen bak ryggen (mock-state), uten at kortet vet det ennå:
    //    beslutningen går til serveren → 409 snapshot_stale → banner + «Send ny runde».
    getMockScenes(page)!.find((s) => s.code === 'S1')!.title = 'Grotten (revidert)';
    await page.getByTestId('narrative-scene-review-approve').click();
    await page.getByTestId('narrative-scene-decision-confirm').click();
    await expect(page.getByTestId('narrative-scene-review-stale')).toBeVisible();
    await expect(page.getByTestId('narrative-notice')).toContainText('Scenen er endret siden runden ble sendt');
    await expect(page.getByTestId('narrative-scene-review-approve')).toBeDisabled();
    await expect(page.getByTestId('narrative-scene-review-status')).toHaveAttribute('data-status', 'in_review');

    // 2) «Send ny runde» → runde 2 åpen, runde 1 erstattet, beslutning mulig igjen.
    await expect(page.getByTestId('narrative-scene-review-request')).toBeEnabled();
    await expect(page.getByTestId('narrative-scene-review-request')).toHaveText('Send ny runde');
    await page.getByTestId('narrative-scene-review-request').click();
    await page.getByTestId('narrative-scene-review-submit').click();
    await expect(page.getByTestId('narrative-scene-review-stale')).toHaveCount(0);
    await expect(page.getByTestId('narrative-scene-review-approve')).toBeEnabled();
    await page.getByTestId('narrative-scene-review-history-toggle').click();
    await expect(page.getByTestId('narrative-scene-review-round-1')).toHaveAttribute('data-status', 'superseded');
    await expect(page.getByTestId('narrative-scene-review-round-2')).toHaveAttribute('data-status', 'in_review');

    // 3) Egen endring i kortet (autosave) → stale-banner vises FØR noen trykker «Godkjenn».
    await page.getByTestId('narrative-scene-tab-overview').click();
    await page.getByTestId('narrative-scene-field-location').fill('Under fjellet');
    await page.getByTestId('narrative-scene-field-location').blur();
    await expect(page.getByTestId('narrative-scene-saved')).toBeVisible();
    await page.getByTestId('narrative-scene-tab-review').click();
    await expect(page.getByTestId('narrative-scene-review-stale')).toBeVisible();
    await expect(page.getByTestId('narrative-scene-review-approve')).toBeDisabled();
  });

  test('storyboard: ramme via URL, bildetekst med autosave, rekkefølge, scenebilde i oversikten', async ({ page }) => {
    await withSession(page);
    await installNarrativeMocks(page, { gamePlan: 'studio' });
    await page.goto(`${HARNESS}&tab=scenes`);
    await expect(page.getByTestId('narrative-scenes-panel')).toBeVisible({ timeout: 15_000 });
    await createScene(page, 'Elva');
    await expect(page.getByTestId('narrative-scene-hero-empty')).toBeVisible();
    await page.getByTestId('narrative-scene-tab-storyboard').click();
    await expect(page.getByTestId('narrative-scene-frames-empty')).toBeVisible();
    await expect(page.getByTestId('narrative-scene-frame-add')).toBeDisabled();
    await page.getByTestId('narrative-scene-frame-url').fill('not a url');
    await expect(page.getByText('Må starte med http:// eller https://')).toBeVisible();
    await page.getByTestId('narrative-scene-frame-url').fill('https://picsum.photos/seed/a/400/200');
    await page.getByTestId('narrative-scene-frame-add').click();
    await page.getByTestId('narrative-scene-frame-url').fill('https://picsum.photos/seed/b/400/200');
    await page.getByTestId('narrative-scene-frame-url').press('Enter');
    await expect(page.locator('[data-testid^="narrative-scene-frame-"][data-testid$="-2"]').first()).toBeVisible();
    await page.getByTestId('narrative-scene-frame-caption-2').fill('Brua');
    await page.getByTestId('narrative-scene-frame-caption-2').blur();
    await page.getByTestId('narrative-scene-frame-left-2').click();
    await expect(page.getByTestId('narrative-scene-frame-caption-1')).toHaveValue('Brua');
    await page.getByTestId('narrative-scene-tab-overview').click();
    await expect(page.getByTestId('narrative-scene-hero')).toHaveAttribute('src', 'https://picsum.photos/seed/b/400/200');
  });
});
