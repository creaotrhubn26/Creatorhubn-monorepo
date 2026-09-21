import { describe, expect, it } from 'vitest';
import { composeScenesScriptPdf, composeStoryGraphPdf, renderScenesScriptPdf, renderStoryGraphPdf, scenesScriptPdfFilename, storyGraphPdfFilename, type PdfDocLike } from './narrative-pdf.js';
import type { ExportGraph } from '../../frontend/shared/narrative-format/index.ts';

const code = (s: string) => `<pre><code>${s}</code></pre>`;
function graph(): ExportGraph {
  return {
    settings: { title: 'Pungen', startingElementId: 'nel_start', coverAssetId: null },
    boards: [{ id: 'nbd_1', name: 'Landsbyen', customId: null, folderPath: 'Akt 1', sortOrder: 0 }],
    elements: [
      { id: 'nel_start', boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Torget</p>', contentHtml: `<p>Du finner en pung på torget.</p>${code('gold += 10')}`, x: 0, y: 0, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: 'start', jumperTargetId: null, branchConditions: [], sortOrder: 0, i18n: { en: { contentHtml: '<p>You find a purse.</p>' } } },
      { id: 'nel_b', boardId: 'nbd_1', kind: 'branch', titleHtml: '', contentHtml: '', x: 0, y: 0, width: 200, height: 80, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c1', script: 'gold >= 10', label: null }, { id: 'c2', script: null, label: null }], sortOrder: 1 },
      { id: 'nel_rich', boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Rik</p>', contentHtml: '<p>Æøå fungerer.</p>', x: 0, y: 0, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], sortOrder: 2 },
      { id: 'nel_j', boardId: 'nbd_1', kind: 'jumper', titleHtml: '', contentHtml: '', x: 0, y: 0, width: 160, height: 60, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: 'nel_start', branchConditions: [], sortOrder: 3 },
      { id: 'nel_note', boardId: 'nbd_1', kind: 'note', titleHtml: '', contentHtml: '<p>Husk gull.</p>', x: 0, y: 0, width: 200, height: 100, theme: 'gray', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], sortOrder: 4 },
    ],
    connections: [
      { id: 'k1', boardId: 'nbd_1', sourceId: 'nel_start', targetId: 'nel_b', sourceOutputKey: 'default', labelHtml: `<p>Handle</p>${code('gold -= 10')}`, sortOrder: 0 },
      { id: 'k2', boardId: 'nbd_1', sourceId: 'nel_b', targetId: 'nel_rich', sourceOutputKey: 'c1', labelHtml: '', sortOrder: 1 },
    ],
    components: [{ id: 'ncp_m', name: 'Kjøpmannen', folderPath: 'Karakterer', coverAssetId: null, customId: 'merchant', sortOrder: 0 }],
    elementComponents: [{ elementId: 'nel_rich', componentId: 'ncp_m', sortOrder: 0 }],
    attributes: [{ id: 'a1', ownerKind: 'component', ownerId: 'ncp_m', name: 'mood', type: 'string', value: 'grådig', sortOrder: 0 }],
    variables: [{ id: 'v1', name: 'gold', type: 'int', defaultValue: 0, sortOrder: 0 }],
    assets: [],
  };
}

/** Opptaker som oppfyller PdfDocLike. */
function recorder() {
  const calls: Array<{ op: string; arg?: unknown }> = [];
  const doc = {
    font(n: string) { calls.push({ op: 'font', arg: n }); return doc; },
    fontSize(n: number) { calls.push({ op: 'fontSize', arg: n }); return doc; },
    fillColor(c: string) { calls.push({ op: 'fillColor', arg: c }); return doc; },
    text(t: string) { calls.push({ op: 'text', arg: t }); return doc; },
    moveDown() { calls.push({ op: 'moveDown' }); return doc; },
    addPage() { calls.push({ op: 'addPage' }); return doc; },
  } as unknown as PdfDocLike & { calls: typeof calls };
  (doc as { calls: typeof calls }).calls = calls;
  return doc;
}

describe('narrative-pdf', () => {
  it('komponerer tittelside, brett med elementer/valg/forgrening/jumper/notat og vedlegg', () => {
    const doc = recorder();
    composeStoryGraphPdf(doc, graph(), { generatedAt: new Date('2026-09-16T10:00:00Z') });
    const texts = doc.calls.filter((c) => c.op === 'text').map((c) => String(c.arg));
    expect(texts).toContain('Pungen');
    expect(texts).toContain('Startelement: Torget');
    expect(texts.some((t) => t.startsWith('1 brett · 2 elementer · 1 valg'))).toBe(true);
    expect(texts).toContain('Landsbyen');
    expect(texts).toContain('Torget');
    expect(texts).toContain('#start · START');
    expect(texts).toContain('Du finner en pung på torget.');
    expect(texts).toContain('gold += 10');
    expect(texts).toContain('• «Handle» → Forgrening   [gold -= 10]');
    expect(texts).toContain('• if gold >= 10 → Rik');
    expect(texts).toContain('• ellers → (ikke koblet)');
    expect(texts).toContain('→ Jumper til Torget');
    expect(texts).toContain('Notat: Husk gull.');
    expect(texts).toContain('Komponenter: Kjøpmannen');
    expect(texts).toContain('Variabler');
    expect(texts).toContain('gold  (int)  standard: 0');
    expect(texts).toContain('Kjøpmannen  #merchant');
    expect(texts).toContain('• mood: grådig');
    expect(doc.calls.filter((c) => c.op === 'addPage')).toHaveLength(2); // brett + vedlegg
    // Kodeblokker settes i kursiv-fonten
    const codeIdx = texts.indexOf('gold += 10');
    expect(codeIdx).toBeGreaterThan(0);
  });

  it('locale-override brukes i innholdet', () => {
    const doc = recorder();
    composeStoryGraphPdf(doc, graph(), { locale: 'en' });
    const texts = doc.calls.filter((c) => c.op === 'text').map((c) => String(c.arg));
    expect(texts).toContain('You find a purse.');
    expect(texts).toContain('Språk: en');
  });

  it('renderStoryGraphPdf gir ekte PDF-bytes med innebygde fonter', async () => {
    const buf = await renderStoryGraphPdf(graph());
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(5_000);
    expect(buf.toString('latin1')).toContain('DejaVuSans');
    expect(storyGraphPdfFilename(graph(), 'en')).toBe('pungen-en.pdf');
    expect(storyGraphPdfFilename(graph(), null)).toBe('pungen.pdf');
  });

  it('manus-PDF av scener: tittelside, scene med Før/Handling/replikker/gater, sceneliste (UX-28)', async () => {
    const doc = recorder();
    composeScenesScriptPdf(doc, { projectName: 'What Follows Us', generatedAt: new Date('2026-09-21T00:00:00Z'), scenes: [{
      code: 'P01', title: 'Skoleveien', subtitle: 'W01 · 1797, ettermiddag', workingId: 'P01', era: '1797', location: 'Skoleveien', status: 'in_progress', episodeCode: 'E01', episodeTitle: 'Da alle kunne bli fri',
      beforeState: 'Bok hos Elise.', action: 'Nora tar boken.', control: 'Rolig bevegelse.', afterState: 'Alle har nådd lekeplassen.', audio: 'Skoleveisamtale.', changeNote: '', bridge: '', timeNote: '', challenge: '', gameplayMechanic: '', environment: '',
      sourceRefs: [{ tag: 'W', ref: 'OPENING-HYBRID-v2' }],
      lines: [{ cueId: 'W01.01', speakerLabel: 'NORA', textEn: 'Must you read all the way home?', textNb: '', sourceType: 'E', recordingStatus: 'none' }],
      gates: [{ gateKey: 'greybox', status: 'passed', evidence: '68 bestått' }, { gateKey: 'audio', status: 'not_started', evidence: '' }],
    }] });
    const texts = doc.calls.filter((c) => c.op === 'text').map((c) => String(c.arg));
    expect(texts).toContain('What Follows Us');
    expect(texts.some((t) => t.startsWith('P01 – Skoleveien'))).toBe(true);
    expect(texts).toContain('FØR');
    expect(texts).toContain('Bok hos Elise.');
    expect(texts.some((t) => t.includes('W01.01') && t.includes('Must you read'))).toBe(true);
    expect(texts.some((t) => t.includes('Gråboks / regelprøve: Bestått — 68 bestått'))).toBe(true);
    expect(texts).toContain('Sceneliste');
    const pdf = await renderScenesScriptPdf({ projectName: 'Æøå', scenes: [] });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(scenesScriptPdfFilename('What Follows Us — Episode One')).toMatch(/-manus\.pdf$/);
  });
});
