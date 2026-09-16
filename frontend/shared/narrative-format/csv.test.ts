import { describe, expect, it } from 'vitest';
import { CSV_BOM, csvCell, toCsv, type ExportGraph } from './index';

const code = (s: string) => `<pre><code>${s}</code></pre>`;

function fixture(): ExportGraph {
  return {
    settings: { title: 'Demo', startingElementId: 'nel_start', coverAssetId: null },
    boards: [{ id: 'nbd_b1', name: 'Landsbyen', customId: null, folderPath: 'Akt 1', sortOrder: 0 }],
    elements: [
      { id: 'nel_start', boardId: 'nbd_b1', kind: 'element', titleHtml: '<p>=1+1</p>', contentHtml: `<p>Du finner en pung; den er tung.</p>${code('gold += 10')}`, x: 0, y: 0, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: 'start', jumperTargetId: null, branchConditions: [], sortOrder: 0, i18n: { en: { contentHtml: '<p>You find a purse; it is heavy.</p>' } } },
      { id: 'nel_choice', boardId: 'nbd_b1', kind: 'branch', titleHtml: '', contentHtml: '', x: 0, y: 0, width: 200, height: 80, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c_yes', script: 'gold >= 10', label: null }, { id: 'c_no', script: null, label: null }], sortOrder: 1 },
      { id: 'nel_rich', boardId: 'nbd_b1', kind: 'element', titleHtml: '<p>Rik</p>', contentHtml: '<p>Linje 1</p><p>Linje 2</p>', x: 0, y: 0, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], sortOrder: 2 },
      { id: 'nel_jump', boardId: 'nbd_b1', kind: 'jumper', titleHtml: '', contentHtml: '', x: 0, y: 0, width: 160, height: 60, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: 'nel_start', branchConditions: [], sortOrder: 3 },
    ],
    connections: [
      { id: 'k1', boardId: 'nbd_b1', sourceId: 'nel_start', targetId: 'nel_choice', sourceOutputKey: 'default', labelHtml: `<p>Gå til markedet</p>${code('gold -= 1')}`, sortOrder: 0 },
      { id: 'k2', boardId: 'nbd_b1', sourceId: 'nel_choice', targetId: 'nel_rich', sourceOutputKey: 'c_yes', labelHtml: '', sortOrder: 1 },
    ],
    components: [{ id: 'ncp_m', name: 'Kjøpmannen', folderPath: '', coverAssetId: null, customId: 'merchant', sortOrder: 0 }],
    elementComponents: [{ elementId: 'nel_rich', componentId: 'ncp_m', sortOrder: 0 }],
    attributes: [{ id: 'a1', ownerKind: 'component', ownerId: 'ncp_m', name: 'mood', type: 'string', value: 'grådig', sortOrder: 0 }],
    variables: [{ id: 'v1', name: 'gold', type: 'int', defaultValue: 0, sortOrder: 0 }],
    assets: [],
  };
}

describe('narrative-format — CSV', () => {
  it('BOM, header, `;`-skilletegn, CRLF og quoting av celler med ; og linjeskift', () => {
    const csv = toCsv(fixture());
    expect(csv.startsWith(CSV_BOM + 'Brett;Mappe;ElementId;CustomId;Type;Tittel;Innhold;')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toContain('"Du finner en pung; den er tung."');
    expect(lines[1]).toContain('Landsbyen;Akt 1;nel_start;start;Element;');
    expect(lines[1]).toMatch(/;ja$/);
    // Innhold med flere avsnitt → linjeskift i én quotet celle
    expect(csv).toContain('"Linje 1\nLinje 2"');
  });

  it('nøytraliserer formel-prefiks og skriver valg, betingelser, jumper og skript', () => {
    const csv = toCsv(fixture());
    expect(csv).toContain(";'=1+1;");
    expect(csv).toContain('Gå til markedet → Forgrening');
    expect(csv).toContain('if gold >= 10 → Rik | ellers → (ikke koblet)');
    expect(csv).toContain(";Jumper;;;;;;'=1+1;;");
    expect(csv).toContain('"gold += 10\n[valg] gold -= 1"');
    expect(csv).toContain('Kjøpmannen');
  });

  it('vedlegg for variabler og komponenter; locale-override brukes i innhold', () => {
    const csv = toCsv(fixture(), { locale: 'en' });
    expect(csv).toContain('"You find a purse; it is heavy."');
    expect(csv).toContain('\r\n\r\nVariabler\r\nNavn;Type;Standard\r\ngold;int;0\r\n');
    expect(csv).toContain('Komponenter\r\nNavn;Mappe;CustomId;Attributter\r\nKjøpmannen;;merchant;mood=grådig\r\n');
  });

  it('csvCell: tall/bool/objekt/null', () => {
    expect(csvCell(3)).toBe('3');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvCell('-5')).toBe("'-5");
  });
});
