import { describe, expect, it } from 'vitest';
import { createPlaySession } from '../narrative-runtime';
import { applyLocaleToGraph, listTranslatableSegments, mergeCodeBlocks, replaceProseChunk, translatedTextFor, translationProgress } from './locale';
import type { ExportGraph } from './types';

function graph(): ExportGraph {
  return {
    settings: { title: 'Pungen', startingElementId: 'nel_1', coverAssetId: null, locales: ['nb', 'en'], i18n: { en: { title: 'The Purse' } } },
    boards: [{ id: 'nbd_1', name: 'Akt 1' }],
    elements: [
      {
        id: 'nel_1', boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Landsbyen</p>',
        contentHtml: '<p>Du finner en pung.</p><pre><code>gold += 10</code></pre><pre><code>if gold &gt;= 10</code></pre><p>Du er rik.</p><pre><code>endif</code></pre>',
        x: 0, y: 0, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [],
        i18n: { en: { titleHtml: '<p>The Village</p>', contentHtml: '<p>You find a purse.</p><pre><code>gold += 10</code></pre><pre><code>if gold &gt;= 10</code></pre><p>You are rich.</p><pre><code>endif</code></pre>' } },
      },
      { id: 'nel_2', boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Markedet</p>', contentHtml: '<p>Boder.</p>', x: 0, y: 0, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [] },
      { id: 'nel_n', boardId: 'nbd_1', kind: 'note', titleHtml: '', contentHtml: '<p>notat</p>', x: 0, y: 0, width: 200, height: 100, theme: 'gray', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [] },
    ],
    connections: [
      { id: 'ncn_1', boardId: 'nbd_1', sourceId: 'nel_1', targetId: 'nel_2', sourceOutputKey: 'default', labelHtml: '<p>Gå til markedet</p><pre><code>gold -= 1</code></pre>', i18n: { en: { labelHtml: '<p>Go to the market</p><pre><code>gold -= 999</code></pre>' } } },
    ],
    components: [], elementComponents: [], attributes: [],
    variables: [{ id: 'nvr_1', name: 'gold', type: 'int', defaultValue: 0 }],
    assets: [],
  };
}

describe('locale — mergeCodeBlocks / replaceProseChunk', () => {
  it('fletter kildens kodeblokker inn i oversatt prose på samme indekser', () => {
    const src = '<p>A</p><pre><code>x = 1</code></pre><p>B</p>';
    // Oversettelsen lagres med samme struktur som kilden; koden hentes ALLTID fra kilden.
    expect(mergeCodeBlocks(src, '<p>a</p><pre><code>GAMMEL</code></pre><p>b</p>')).toBe('<p>a</p><pre><code>x = 1</code></pre><p>b</p>');
    expect(mergeCodeBlocks(src, '<p>a</p>')).toBe('<p>a</p><pre><code>x = 1</code></pre><p>B</p>');
    expect(mergeCodeBlocks(src, '<p>a</p><pre><code>x</code></pre><p>b</p><pre><code>y</code></pre><p>c</p>')).toBe('<p>a</p><pre><code>x = 1</code></pre><p>b</p><p>c</p>');
    expect(mergeCodeBlocks('<p>A</p>', '<p>a</p>')).toBe('<p>a</p>');
    expect(mergeCodeBlocks(src, '')).toBe(src);
  });

  it('replaceProseChunk bytter én bit og lar kode stå', () => {
    const src = '<p>A</p><pre><code>x = 1</code></pre><p>B</p>';
    expect(replaceProseChunk(src, 1, 'b')).toBe('<p>A</p><pre><code>x = 1</code></pre><p>b</p>');
    expect(replaceProseChunk('', 0, 'ny')).toBe('<p>ny</p>');
  });
});

describe('locale — segmenter, fremdrift, apply', () => {
  const g = graph();
  it('lister tittel, prose-biter og etiketter (ikke notater, ikke kode)', () => {
    const segs = listTranslatableSegments(g);
    expect(segs.map((s) => s.key)).toEqual([
      'settings:settings:title:0',
      'element:nel_1:titleHtml:0', 'element:nel_1:contentHtml:0', 'element:nel_1:contentHtml:1',
      'element:nel_2:titleHtml:0', 'element:nel_2:contentHtml:0',
      'connection:ncn_1:labelHtml:0',
    ]);
    expect(segs[3].sourceText).toBe('Du er rik.');
    expect(segs[6].context).toBe('Valg fra «Landsbyen» til «Markedet»');
    expect(translatedTextFor(g, segs[3], 'en')).toBe('You are rich.');
    expect(translatedTextFor(g, segs[4], 'en')).toBeNull();
    expect(translationProgress(g, 'en')).toEqual({ total: 7, done: 5 });
  });

  it('applyLocaleToGraph: overrides + kildens kode; nb er identitet', () => {
    expect(applyLocaleToGraph(g, 'nb')).toBe(g);
    const en = applyLocaleToGraph(g, 'en');
    expect(en.settings.title).toBe('The Purse');
    expect(en.elements[0].titleHtml).toBe('<p>The Village</p>');
    expect(en.elements[0].contentHtml).toBe('<p>You find a purse.</p><pre><code>gold += 10</code></pre><pre><code>if gold &gt;= 10</code></pre><p>You are rich.</p><pre><code>endif</code></pre>');
    expect(en.elements[1].contentHtml).toBe('<p>Boder.</p>');
    expect(en.connections[0].labelHtml).toBe('<p>Go to the market</p><pre><code>gold -= 1</code></pre>');
    // Skriptet kjører fortsatt i oversatt versjon
    const s = createPlaySession(en);
    const view = s.start()!;
    expect(view.html).toContain('You are rich.');
    expect(s.getState().variables.gold).toBe(10);
    expect(view.options[0].labelHtml).toBe('<p>Go to the market</p>');
  });
});
