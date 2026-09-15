/**
 * Story Graph — import av Twine (.twee) og Ink (.ink) via Eksport-fanen:
 * format gjenkjennes, forhåndsvisning bygges klient-side av det delte
 * format-laget, serveren (mock) erstatter grafen, merknader listes.
 */
import { test, expect, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockGraph } from './helpers/narrativeMocks';

async function openExports(page: Page) {
  await installNarrativeMocks(page);
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=exports');
  await expect(page.getByTestId('narrative-exports-panel')).toBeVisible({ timeout: 15_000 });
}

const TWEE = [
  ':: StoryTitle', 'Pungen', '',
  ':: StoryData', '{"ifid":"D674C58C-DEFA-4F70-B7A2-27742230C0FC","format":"SugarCube","format-version":"2.37.3","start":"Landsbyen"}', '',
  ':: Landsbyen', '<<set $gold to 0>>', 'Du våkner i en stille landsby.', '[[Gå til markedet->Markedet]]', '',
  ':: Markedet', '<<set $gold += 10>>', 'Boder i alle farger.', '[[Gå hjem->Landsbyen]]', '[[Til passasje som mangler->Borte]]', '',
].join('\n');

const INK = [
  'VAR gold = 0', '',
  'Du våkner i en stille landsby.', '-> village', '',
  '=== village ===', '~ gold += 10',
  'Du finner en pung.', '* [Gå til markedet] Du går.', '    -> market', '+ [Sov videre]', '    Du sover.', '- Dagen går.', '-> END', '',
  '=== market ===', 'Boder i alle farger.', '-> END',
].join('\n');

test.describe('Story Graph — import av Twine og Ink', () => {
  test('.twee: gjenkjennes som Twine, forhåndsvisning viser antall og merknad om manglende passasje, grafen erstattes', async ({ page }) => {
    await openExports(page);
    await page.getByTestId('narrative-import-file').setInputFiles({ name: 'pungen.twee', mimeType: 'text/plain', buffer: Buffer.from(TWEE, 'utf8') });
    const dialog = page.getByTestId('narrative-import-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Twine (Twee 3)');
    await expect(dialog).toContainText('1 brett, 2 elementer, 2 koblinger');
    await expect(dialog).toContainText('«Borte» som ikke finnes');
    await page.getByTestId('narrative-import-confirm').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('narrative-import-warnings')).toContainText('Borte');

    const g = getMockGraph(page)!;
    expect(g.settings.title).toBe('pungen');
    expect(g.elements.map((e) => e.titleHtml)).toEqual(['<p>Landsbyen</p>', '<p>Markedet</p>']);
    expect(g.connections).toHaveLength(2);

    await page.getByTestId('narrative-tab-boards').click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  });

  test('.ink: gjenkjennes som Ink, valg blir koblinger, engangs-valg varsles, spillbar etterpå', async ({ page }) => {
    await openExports(page);
    await page.getByTestId('narrative-import-file').setInputFiles({ name: 'story.ink', mimeType: 'text/plain', buffer: Buffer.from(INK, 'utf8') });
    const dialog = page.getByTestId('narrative-import-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ink');
    await expect(dialog).toContainText('engangs-valg');
    await page.getByTestId('narrative-import-confirm').click();
    await expect(dialog).toBeHidden();
    const g = getMockGraph(page)!;
    expect(g.elements.length).toBeGreaterThanOrEqual(3);
    await page.getByTestId('narrative-tab-play').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Start');
    await expect(page.getByTestId('narrative-play-content')).toContainText('Du våkner i en stille landsby.');
  });

  test('ukjent tekstformat gir feilmelding uten å endre grafen', async ({ page }) => {
    await openExports(page);
    await page.getByTestId('narrative-import-file').setInputFiles({ name: 'notat.txt', mimeType: 'text/plain', buffer: Buffer.from('bare et notat', 'utf8') });
    await expect(page.getByText('Kjenner ikke igjen formatet')).toBeVisible();
    await expect(page.getByTestId('narrative-import-dialog')).toBeHidden();
    expect(getMockGraph(page)!.elements).toHaveLength(2);
  });
});
