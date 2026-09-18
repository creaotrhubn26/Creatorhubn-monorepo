/**
 * Eksempelprosjekt for runtime-pakken. Dekker det dokumenterte arcscript-
 * DELSETTET som C#-/GDScript-lasterne implementerer: tilordning, if/elseif/
 * else/endif rundt prose, sammenligning, and/or/not, visits(), forgrening med
 * else-betingelse, jumper, etikett-skript ved valg.
 *
 * Eksporteres til packages/story-graph-runtime/fixtures/sample-project.json
 * (Arcweave project.json) + sample-project.expected.txt av byggeskriptet.
 */

import type { ExportGraph } from '../narrative-format/types';

const code = (s: string) => `<pre><code>${s}</code></pre>`;

export const SAMPLE_GRAPH: ExportGraph = {
  settings: { title: 'Pungen', startingElementId: 'nel_start', coverAssetId: null },
  boards: [{ id: 'nbd_main', name: 'Landsbyen', customId: 'village', folderPath: '', sortOrder: 0 }],
  elements: [
    { id: 'nel_start', boardId: 'nbd_main', kind: 'element', titleHtml: '<p>Torget</p>', contentHtml: `<p>Du finner en pung på torget.</p>${code('gold += 10')}${code('if visits() > 1')}<p>Pungen er lettere denne gangen.</p>${code('gold -= 5')}${code('endif')}`, x: 40, y: 80, width: 260, height: 120, theme: 'green', coverAssetId: null, customId: 'start', jumperTargetId: null, branchConditions: [], sortOrder: 0 },
    { id: 'nel_market', boardId: 'nbd_main', kind: 'element', titleHtml: '<p>Markedet</p>', contentHtml: `${code('if gold >= 10 and not visits(@[rich])')}<p>Kjøpmannen smiler.</p>${code('elseif gold > 0')}<p>Kjøpmannen nikker.</p>${code('else')}<p>Kjøpmannen snur ryggen til.</p>${code('endif')}`, x: 400, y: 80, width: 260, height: 120, theme: 'amber', coverAssetId: null, customId: 'market', jumperTargetId: null, branchConditions: [], sortOrder: 1 },
    { id: 'nel_choice', boardId: 'nbd_main', kind: 'branch', titleHtml: '', contentHtml: '', x: 760, y: 80, width: 200, height: 80, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c_rich', script: 'gold >= 10', label: 'Rik' }, { id: 'c_poor', script: null, label: 'Ellers' }], sortOrder: 2 },
    { id: 'nel_rich', boardId: 'nbd_main', kind: 'element', titleHtml: '<p>Rik</p>', contentHtml: '<p>Du kjøper et sverd.</p>', x: 1100, y: 20, width: 260, height: 120, theme: 'blue', coverAssetId: null, customId: 'rich', jumperTargetId: null, branchConditions: [], sortOrder: 3 },
    { id: 'nel_poor', boardId: 'nbd_main', kind: 'element', titleHtml: '<p>Fattig</p>', contentHtml: '<p>Tomme lommer.</p>', x: 1100, y: 200, width: 260, height: 120, theme: 'red', coverAssetId: null, customId: 'poor', jumperTargetId: null, branchConditions: [], sortOrder: 4 },
    { id: 'nel_end', boardId: 'nbd_main', kind: 'element', titleHtml: '<p>Slutt</p>', contentHtml: '<p>Historien er over.</p>', x: 1450, y: 20, width: 260, height: 120, theme: 'gray', coverAssetId: null, customId: 'end', jumperTargetId: null, branchConditions: [], sortOrder: 5 },
    { id: 'nel_giveup', boardId: 'nbd_main', kind: 'branch', titleHtml: '', contentHtml: '', x: 1450, y: 200, width: 200, height: 80, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c_giveup', script: 'gold < 0 or not brave', label: 'Gir opp' }, { id: 'c_again', script: null, label: 'Igjen' }], sortOrder: 6 },
    { id: 'nel_jump', boardId: 'nbd_main', kind: 'jumper', titleHtml: '', contentHtml: '', x: 1800, y: 200, width: 160, height: 60, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: 'nel_start', branchConditions: [], sortOrder: 7 },
  ],
  connections: [
    { id: 'ncn_k1', boardId: 'nbd_main', sourceId: 'nel_start', targetId: 'nel_market', sourceOutputKey: 'default', labelHtml: '<p>Gå til markedet</p>', sortOrder: 0 },
    { id: 'ncn_k2', boardId: 'nbd_main', sourceId: 'nel_start', targetId: 'nel_end', sourceOutputKey: 'default', labelHtml: '<p>Gå hjem</p>', sortOrder: 1 },
    { id: 'ncn_k3', boardId: 'nbd_main', sourceId: 'nel_market', targetId: 'nel_choice', sourceOutputKey: 'default', labelHtml: `<p>Handle</p>${code('gold -= 10')}`, sortOrder: 2 },
    { id: 'ncn_k4', boardId: 'nbd_main', sourceId: 'nel_market', targetId: 'nel_end', sourceOutputKey: 'default', labelHtml: '<p>Gå videre uten å handle</p>', sortOrder: 3 },
    { id: 'ncn_k5', boardId: 'nbd_main', sourceId: 'nel_choice', targetId: 'nel_rich', sourceOutputKey: 'c_rich', labelHtml: '', sortOrder: 4 },
    { id: 'ncn_k6', boardId: 'nbd_main', sourceId: 'nel_choice', targetId: 'nel_poor', sourceOutputKey: 'c_poor', labelHtml: '', sortOrder: 5 },
    { id: 'ncn_k7', boardId: 'nbd_main', sourceId: 'nel_rich', targetId: 'nel_end', sourceOutputKey: 'default', labelHtml: '<p>Ferdig</p>', sortOrder: 6 },
    { id: 'ncn_k8', boardId: 'nbd_main', sourceId: 'nel_poor', targetId: 'nel_giveup', sourceOutputKey: 'default', labelHtml: '<p>Tilbake til torget</p>', sortOrder: 7 },
    { id: 'ncn_k9', boardId: 'nbd_main', sourceId: 'nel_giveup', targetId: 'nel_end', sourceOutputKey: 'c_giveup', labelHtml: '', sortOrder: 8 },
    { id: 'ncn_k10', boardId: 'nbd_main', sourceId: 'nel_giveup', targetId: 'nel_jump', sourceOutputKey: 'c_again', labelHtml: '', sortOrder: 9 },
  ],
  components: [{ id: 'ncp_merchant', name: 'Kjøpmannen', folderPath: '', coverAssetId: null, customId: 'merchant', sortOrder: 0 }],
  elementComponents: [{ elementId: 'nel_market', componentId: 'ncp_merchant', sortOrder: 0 }],
  attributes: [{ id: 'nat_mood', ownerKind: 'component', ownerId: 'ncp_merchant', name: 'mood', type: 'string', value: 'grådig', sortOrder: 0 }],
  variables: [
    { id: 'nvr_gold', name: 'gold', type: 'int', defaultValue: 0, sortOrder: 0 },
    { id: 'nvr_brave', name: 'brave', type: 'bool', defaultValue: true, sortOrder: 1 },
  ],
  assets: [],
};
