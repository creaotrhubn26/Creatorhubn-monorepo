const now = new Date().toISOString();

const build = ({ strokes, packId, slotId }) => ({
  version: 2,
  baseBitmap: '/api/storyboard-packs/admin/slot-image/cinematic-drama/hero-close/example.png',
  layers: [
    {
      id: 'layer-reference-base',
      kind: 'reference',
      name: 'Reference Image',
      visible: true,
      locked: true,
      opacity: 0.45,
      referenceSrc: '/api/storyboard-packs/admin/slot-image/cinematic-drama/hero-close/example.png',
      vectorData: JSON.stringify({ x: 12, y: 8, width: 640, height: 360 }),
    },
    {
      id: 'layer-strokes-primary',
      kind: 'stroke',
      name: 'Primary Strokes',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      strokeData: JSON.stringify(strokes),
    },
  ],
  renderSettings: {
    storyboardPackSelection: { packId, slotId },
    cinematography: { shotType: 'close-up', lens: '50mm' },
    overlay: { showGrid: true, showSafeArea: true },
  },
  exports: [{ id: 'export-primary-png', format: 'png', dataUrl: 'data:image/png;base64,abc', createdAt: now }],
  updatedAt: now,
});

const normalizeV1 = (assetPackage) => ({
  version: 1,
  baseBitmap: assetPackage.baseBitmap,
  layers: (assetPackage.layers || []).map((layer) => ({ ...layer, locked: layer.locked ?? false })),
  renderSettings: assetPackage.renderSettings || {},
  exports: assetPackage.exports || [],
  updatedAt: assetPackage.updatedAt || now,
});

const migrateV1ToV2 = (assetPackage) => {
  const normalized = normalizeV1(assetPackage);
  return {
    ...normalized,
    version: 2,
    layers: normalized.layers.map((layer, index) => ({
      ...layer,
      id: layer.id || `layer-${index}`,
      name: layer.name || `Layer ${index + 1}`,
      blendMode: layer.blendMode || 'normal',
    })),
    exports: normalized.exports.map((assetExport, index) => ({
      ...assetExport,
      id: assetExport.id || `export-${index}`,
      createdAt: assetExport.createdAt || normalized.updatedAt,
    })),
  };
};

const migrationMap = {
  1: migrateV1ToV2,
  2: migrateV1ToV2,
};

const fixtureMissingLayers = {
  version: 1,
  renderSettings: {},
  exports: [],
};

const fixtureUnknownVersion = {
  version: 99,
  baseBitmap: 'x',
  layers: [{ id: 'stroke-a', kind: 'stroke', name: 'A', visible: true, opacity: 1, strokeData: '[]' }],
  renderSettings: {},
  exports: [],
};

const fixtureCorruptStrokeData = {
  version: 2,
  layers: [{ id: 'bad', kind: 'stroke', name: 'Bad', visible: true, opacity: 1, strokeData: '{bad' }],
  renderSettings: {},
  exports: [],
};


const fixtureV2SparseIds = {
  version: 2,
  layers: [{ kind: 'stroke', visible: true, opacity: 1, strokeData: '[]' }],
  renderSettings: {},
  exports: [{}],
};

const fixtureLargeLayerArray = {
  version: 1,
  layers: Array.from({ length: 250 }, (_, i) => ({
    id: `layer-${i}`,
    kind: 'stroke',
    name: `Layer ${i}`,
    visible: true,
    opacity: 1,
    strokeData: '[]',
  })),
  renderSettings: {},
  exports: [],
};

const parse = (assetPackage) => {
  const migrate = migrationMap[assetPackage?.version] || migrateV1ToV2;
  const migrated = migrate(assetPackage);
  const strokeLayer = migrated.layers.find((l) => l.kind === 'stroke');
  const refLayer = migrated.layers.find((l) => l.kind === 'reference');
  return {
    strokes: strokeLayer?.strokeData ? JSON.parse(strokeLayer.strokeData) : [],
    selection: migrated.renderSettings.storyboardPackSelection,
    reference: refLayer?.referenceSrc,
    layerLockStates: migrated.layers.map((l) => Boolean(l.locked)),
  };
};

const input = [{ id: 's1', points: [{ x: 1, y: 1 }] }];
const pkg = build({ strokes: input, packId: 'cinematic-drama', slotId: 'hero-close' });
const out = parse(pkg);

if (JSON.stringify(input) !== JSON.stringify(out.strokes)) {
  throw new Error('Roundtrip stroke mismatch');
}
if (out.selection.packId !== 'cinematic-drama' || out.selection.slotId !== 'hero-close') {
  throw new Error('Roundtrip selection mismatch');
}
if (!out.reference) {
  throw new Error('Roundtrip reference mismatch');
}
if (!out.layerLockStates.includes(true)) {
  throw new Error('Roundtrip layer lock state mismatch');
}

const missingLayersOut = parse(fixtureMissingLayers);
if (!Array.isArray(missingLayersOut.strokes)) {
  throw new Error('Missing layers fixture failed');
}

const unknownVersionOut = parse(fixtureUnknownVersion);
if (!Array.isArray(unknownVersionOut.strokes)) {
  throw new Error('Unknown version fixture failed');
}

let corruptFailedAsExpected = false;
try {
  parse(fixtureCorruptStrokeData);
} catch {
  corruptFailedAsExpected = true;
}
if (!corruptFailedAsExpected) {
  throw new Error('Corrupt stroke fixture should fail parse');
}

const v2SparseOut = parse(fixtureV2SparseIds);
if (!Array.isArray(v2SparseOut.layerLockStates) || v2SparseOut.layerLockStates.length !== 1) {
  throw new Error('V2 sparse-id fixture failed');
}

const largeOut = parse(fixtureLargeLayerArray);
if (!Array.isArray(largeOut.layerLockStates) || largeOut.layerLockStates.length !== 250) {
  throw new Error('Large layer fixture failed');
}

console.log('Storyboard asset package roundtrip verification: OK');
