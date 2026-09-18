/**
 * Story Graph Fase 8b — manusimport: last opp dokument → diff (ny/endret/mangler)
 * → godkjenn → scener og replikker oppdatert, åpent spørsmål for det som mangler.
 */
import { expect, test } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

const DOC = `# Spillmanus v3

### P01 — Skoleveien · W01 · 1797, ettermiddag

**Før:** Bok hos Elise, løs skolisse, Oskar har filleballen.
**Handling:** Nora tar boken, gir den tilbake og knyter skolissen. NY SETNING FRA V3.

### P99 — Testscene fra import · W99 · 1817

**Før:** Noe helt nytt.
**Lyd:** stille skog.

## W01 — Skoleveien · 1797

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W01.01 | NORA | E | Must you read all the way home? |
| W01.02 | ELISE | E | You will not drop my book, will you? |

## W99 — Testscene · 1817

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W99.01 | ELISE | T | Nothing here is ours. |
`;

test.describe('Story Graph — manusimport (Fase 8b)', () => {
  test('dry-run viser diff, apply oppdaterer scener og oppretter åpent spørsmål for manglende replikk', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes');
    await expect(page.getByTestId('narrative-scenes-panel')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('narrative-import-open').click();
    await expect(page.getByTestId('narrative-import-dialog')).toBeVisible();
    // Ingen fil → Analyser er deaktivert.
    await expect(page.getByTestId('narrative-import-analyze')).toBeDisabled();

    await page.getByTestId('narrative-import-file').setInputFiles({ name: 'SPILLMANUS-v3.md', mimeType: 'text/markdown', buffer: Buffer.from(DOC, 'utf8') });
    await expect(page.getByTestId('narrative-import-filename')).toContainText('SPILLMANUS-v3.md');
    await page.getByTestId('narrative-import-analyze').click();

    // Diff: P01 endret (Handling + ny replikk W01.02), P99 ny, W01.03–W01.07 mangler i dokumentet.
    await expect(page.getByTestId('narrative-import-summary')).toContainText('1 nye scener');
    await expect(page.getByTestId('narrative-import-summary')).toContainText('1 endrede');
    await expect(page.getByTestId('narrative-import-row-P01')).toContainText('Handling');
    await expect(page.getByTestId('narrative-import-row-P99')).toContainText('Testscene fra import');
    await expect(page.getByTestId('narrative-import-missing')).toBeVisible();
    await expect(page.getByTestId('narrative-import-missing-W01.03')).toBeChecked();
    // Etiketten forhåndsutfylles fra dokumenttittelen.
    await expect(page.getByTestId('narrative-import-source-label')).toHaveValue('Spillmanus v3');

    await page.getByTestId('narrative-import-apply').click();
    await expect(page.getByTestId('narrative-import-result')).toContainText('1 nye scener');
    await expect(page.getByTestId('narrative-import-result')).toContainText('åpne spørsmål');
    await page.getByRole('button', { name: 'Lukk' }).click();

    // Scenelista har P99, og P01 fikk den nye handlingsteksten.
    await expect(page.getByTestId('narrative-scene-row-nsc_p99')).toBeVisible();
    await page.getByTestId('narrative-scene-row-nsc_p01').click();
    await page.getByTestId('narrative-scene-tab-script').click();
    await expect(page.getByTestId('narrative-scene-field-action')).toHaveValue(/NY SETNING FRA V3/);
  });

  test('ukjent filtype gir tydelig feil uten å skrive noe', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes');
    await page.getByTestId('narrative-import-open').click();
    await page.getByTestId('narrative-import-file').setInputFiles({ name: 'bilde.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
    await page.getByTestId('narrative-import-analyze').click();
    await expect(page.getByTestId('narrative-import-error')).toContainText('Filtypen støttes ikke');
    await expect(page.getByTestId('narrative-import-apply')).toBeDisabled();
  });
});
