/**
 * Story Graph — Eksport-fanen: nedlasting (Arcweave-JSON, Markdown, HTML),
 * import fra Arcweave (erstatter grafen) og delbare spill-lenker.
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Download, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockGraph } from './helpers/narrativeMocks';

async function openExports(page: Page) {
  await installNarrativeMocks(page);
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=exports');
  await expect(page.getByTestId('narrative-exports-panel')).toBeVisible({ timeout: 15_000 });
}

async function downloadVia(page: Page, testId: string): Promise<{ download: Download; text: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testId).click(),
  ]);
  const path = await download.path();
  return { download, text: readFileSync(path!, 'utf8') };
}

const ARCWEAVE_PROJECT = {
  name: 'Fra Arcweave',
  cover: null,
  startingElement: 'e1',
  boards: {
    root: { name: 'Root', root: true, children: ['b1'] },
    b1: { name: 'Importert brett', customId: null, notes: [], jumpers: [], branches: [], elements: ['e1', 'e2', 'e3'], connections: ['c1', 'c2'] },
  },
  notes: {},
  elements: {
    e1: { x: 0, y: 0, theme: 'default', title: '<p>Inngang</p>', content: '<p>Velkommen.</p>', outputs: ['c1', 'c2'], components: [], attributes: [], assets: {} },
    e2: { x: 400, y: 0, theme: 'blue', title: '<p>Venstre</p>', content: '', outputs: [], components: [], attributes: [], assets: {} },
    e3: { x: 400, y: 200, theme: 'red', title: '<p>Høyre</p>', content: '', outputs: [], components: [], attributes: [], assets: {} },
  },
  jumpers: { j1: { x: 0, y: 0, elementId: 'finnes-ikke' } },
  connections: {
    c1: { type: 'Straight', theme: 'default', sourceid: 'e1', targetid: 'e2', sourceType: 'elements', targetType: 'elements', label: '<p>Gå venstre</p>' },
    c2: { type: 'Straight', theme: 'default', sourceid: 'e1', targetid: 'e3', sourceType: 'elements', targetType: 'elements', label: '<p>Gå høyre</p>' },
  },
  branches: {}, components: {}, attributes: {}, assets: {}, variables: {}, conditions: {},
};

test.describe('Story Graph — Eksport-fanen', () => {
  test('laster ned Arcweave-JSON, Markdown og spillbar HTML bygd fra grafen', async ({ page }) => {
    await openExports(page);

    const json = await downloadVia(page, 'narrative-export-json');
    expect(json.download.suggestedFilename()).toBe('demo-spill.json');
    const project = JSON.parse(json.text) as Record<string, unknown>;
    expect(Object.keys(project)).toEqual(expect.arrayContaining(['boards', 'elements', 'connections', 'branches', 'conditions', 'variables', 'startingElement']));
    expect(project.name).toBe('Demo-spill');
    expect(project.startingElement).toBe('start');
    expect(Object.keys(project.branches as object)).toHaveLength(1);

    const md = await downloadVia(page, 'narrative-export-markdown');
    expect(md.download.suggestedFilename()).toBe('demo-spill.md');
    expect(md.text).toContain('# Demo-spill');
    expect(md.text).toContain('- «Gå til markedet» → Har du gull?');
    expect(md.text).toContain('- if `gold >= 10`');

    const html = await downloadVia(page, 'narrative-export-html');
    expect(html.download.suggestedFilename()).toBe('demo-spill.html');
    expect(html.text).toContain('StoryGraphPlayer.mount(');
    expect(html.text).toContain('window.__STORY_GRAPH__=');
    expect(html.text).toContain('Du våkner i en stille landsby.');
  });

  test('import fra Arcweave viser forhåndsvisning, erstatter grafen og lister merknader', async ({ page }) => {
    await openExports(page);
    await page.getByTestId('narrative-import-file').setInputFiles({
      name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ARCWEAVE_PROJECT)),
    });
    const dialog = page.getByTestId('narrative-import-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('1 brett, 4 elementer, 2 koblinger');
    await page.getByTestId('narrative-import-confirm').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('narrative-import-warnings')).toContainText('Jumperen peker på et element som ikke finnes');

    const g = getMockGraph(page)!;
    expect(g.settings.title).toBe('Fra Arcweave');
    expect(g.boards.map((b) => b.name)).toEqual(['Importert brett']);
    expect(g.elements).toHaveLength(4);

    // Brettet viser den importerte grafen.
    await page.getByTestId('narrative-tab-boards').click();
    await expect(page.getByTestId('narrative-canvas')).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(4);
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  });

  test('ugyldig fil gir feilmelding uten å endre grafen', async ({ page }) => {
    await openExports(page);
    await page.getByTestId('narrative-import-file').setInputFiles({
      name: 'ikke-arcweave.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}'),
    });
    await expect(page.getByText('Dokumentet ser ikke ut som en Arcweave-eksport')).toBeVisible();
    await expect(page.getByTestId('narrative-import-dialog')).toBeHidden();
    expect(getMockGraph(page)!.elements).toHaveLength(2);
  });

  test('delingslenke opprettes (vises én gang), listes og kan tilbakekalles', async ({ page }) => {
    await openExports(page);
    await expect(page.getByText('Ingen delingslenker ennå.')).toBeVisible();

    await page.getByTestId('narrative-share-mode').click();
    await page.getByRole('option', { name: 'Spill + debugger' }).click();
    await page.getByTestId('narrative-share-create').click();

    const url = page.getByTestId('narrative-share-url');
    await expect(url).toHaveValue(/\/story\/sgs_e2e_nsl_\d+$/);
    await expect(page.getByTestId('narrative-share-fresh')).toContainText('Spill + debugger');

    const list = page.getByTestId('narrative-share-list');
    await expect(list.locator('[data-testid^="narrative-share-link-"]')).toHaveCount(1);
    const linkId = (await list.locator('[data-testid^="narrative-share-link-"]').first().getAttribute('data-testid'))!.replace('narrative-share-link-', '');
    await expect(page.getByTestId(`narrative-share-status-${linkId}`)).toHaveText('Aktiv');

    await page.getByTestId(`narrative-share-revoke-${linkId}`).click();
    await expect(page.getByTestId(`narrative-share-status-${linkId}`)).toHaveText('Tilbakekalt');
    await expect(page.getByTestId(`narrative-share-revoke-${linkId}`)).toHaveCount(0);
  });
});
