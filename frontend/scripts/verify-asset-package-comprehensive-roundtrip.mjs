/**
 * Comprehensive Asset Package Roundtrip Test
 *
 * Tests that:
 * 1. Multi-layer strokes are distributed by layerId and fully restored
 * 2. Shapes (vector objects) roundtrip through kind:'vector' layer
 * 3. Text annotations roundtrip through kind:'vector' layer
 * 4. Frame annotations roundtrip through kind:'annotation' layer
 * 5. Vector/tool state (cinematography, overlay, activeLayerId) roundtrips
 * 6. Reference image roundtrips with position/size
 * 7. Pack selection + render settings roundtrip
 * 8. Multi-format exports are preserved
 * 9. V1→V2 migration produces valid V2 output
 * 10. Large payloads (boundary conditions) do not break
 * 11. Corrupt/missing data fails gracefully
 */

const now = new Date().toISOString();
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`  ✓ ${message}`);
    passed++;
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Reproduce production build/parse logic ──────────────────────────────────

const MAX_STROKES_PER_PACKAGE = 10000;
const MAX_LAYERS_PER_PACKAGE = 64;
const MAX_SHAPES_PER_PACKAGE = 500;
const MAX_TEXT_ANNOTATIONS_PER_PACKAGE = 200;

function buildFrameAssetPackage(params) {
  const layers = params.drawingLayers.length
    ? params.drawingLayers.map(layer => ({
        id: layer.id,
        kind: 'stroke',
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        strokeData: JSON.stringify(params.strokes.filter(s => s.layerId === layer.id)),
      }))
    : [{
        id: 'layer-strokes-primary',
        kind: 'stroke',
        name: 'Primary Strokes',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        strokeData: JSON.stringify(params.strokes),
      }];

  if (params.referenceImage?.src) {
    layers.unshift({
      id: 'layer-reference-base',
      kind: 'reference',
      name: 'Reference Image',
      visible: Boolean(params.referenceImage.visible),
      locked: true,
      opacity: params.referenceImage.opacity,
      blendMode: 'normal',
      referenceSrc: params.referenceImage.src,
      vectorData: JSON.stringify({
        x: params.referenceImage.x,
        y: params.referenceImage.y,
        width: params.referenceImage.width,
        height: params.referenceImage.height,
      }),
    });
  }

  if (params.annotations?.length) {
    layers.push({
      id: 'layer-annotations',
      kind: 'annotation',
      name: 'Frame Annotations',
      visible: true,
      locked: false,
      opacity: 1,
      annotationData: JSON.stringify(params.annotations),
    });
  }

  if (params.shapes?.length) {
    layers.push({
      id: 'layer-shapes',
      kind: 'vector',
      name: 'Shape Objects',
      visible: true,
      locked: false,
      opacity: 1,
      vectorData: JSON.stringify({ shapes: params.shapes.slice(0, MAX_SHAPES_PER_PACKAGE) }),
    });
  }

  if (params.textAnnotations?.length) {
    layers.push({
      id: 'layer-text-annotations',
      kind: 'vector',
      name: 'Text Annotations',
      visible: true,
      locked: false,
      opacity: 1,
      vectorData: JSON.stringify({ textAnnotations: params.textAnnotations.slice(0, MAX_TEXT_ANNOTATIONS_PER_PACKAGE) }),
    });
  }

  layers.push({
    id: 'layer-vector-settings',
    kind: 'vector',
    name: 'Vector & Tool State',
    visible: true,
    locked: false,
    opacity: 1,
    vectorData: JSON.stringify({
      activeShot: params.activeCinematography,
      overlay: params.overlaySettings,
      drawingState: {
        activeLayerId: params.activeLayerId ?? params.drawingLayers[0]?.id,
      },
    }),
  });

  const exports = [
    { id: 'export-primary-png', format: 'png', dataUrl: params.imageData, createdAt: now },
    { id: 'export-jpeg-85', format: 'jpeg', dataUrl: 'data:image/jpeg;base64,mock', createdAt: now },
    { id: 'export-webp-80', format: 'webp', dataUrl: 'data:image/webp;base64,mock', createdAt: now },
    { id: 'export-thumbnail-256', format: 'webp', dataUrl: 'data:image/webp;base64,thumb', createdAt: now },
  ];

  return {
    version: 2,
    baseBitmap: params.referenceImage?.src,
    layers: layers.slice(0, MAX_LAYERS_PER_PACKAGE),
    renderSettings: {
      storyboardPackSelection: params.activePackId && params.activeSlotId
        ? { packId: params.activePackId, slotId: params.activeSlotId }
        : undefined,
      cinematography: params.activeCinematography,
      overlay: params.overlaySettings,
    },
    exports,
    authoringMetadata: params.authoringMetadata,
    updatedAt: now,
  };
}

function migrateFrameAssetPackage(assetPackage) {
  if (!assetPackage) return null;
  const normalizeV1 = (input) => ({
    version: 1,
    baseBitmap: input.baseBitmap,
    layers: (input.layers || []).map(l => ({ ...l, locked: l.locked ?? false })),
    renderSettings: input.renderSettings || {},
    exports: input.exports || [],
    authoringMetadata: input.authoringMetadata,
    updatedAt: input.updatedAt || now,
  });
  const migrateV1ToV2 = (input) => {
    const normalized = normalizeV1(input);
    return {
      ...normalized,
      version: 2,
      layers: normalized.layers.map((l, i) => ({
        ...l,
        id: l.id || `layer-${i}`,
        name: l.name || `Layer ${i + 1}`,
        blendMode: l.blendMode || 'normal',
      })),
      exports: normalized.exports.map((e, i) => ({
        ...e,
        id: e.id || `export-${i}`,
        createdAt: e.createdAt || normalized.updatedAt,
      })),
      updatedAt: normalized.updatedAt || now,
    };
  };
  const migrate = { 1: migrateV1ToV2, 2: migrateV1ToV2 }[assetPackage.version] || migrateV1ToV2;
  return migrate(assetPackage);
}

function parseFrameAssetPackage(assetPackage) {
  const migrated = migrateFrameAssetPackage(assetPackage);
  if (!migrated) return null;

  const referenceLayer = migrated.layers.find(l => l.kind === 'reference' && l.referenceSrc);
  const strokeLayers = migrated.layers.filter(l => l.kind === 'stroke' && l.strokeData);

  // Merge strokes from ALL stroke layers
  let strokesFromPackage = null;
  if (strokeLayers.length) {
    const merged = [];
    for (const sl of strokeLayers) {
      if (!sl.strokeData) continue;
      try {
        const parsed = JSON.parse(sl.strokeData);
        for (const s of parsed) merged.push({ ...s, layerId: s.layerId || sl.id });
      } catch { /* skip */ }
    }
    strokesFromPackage = merged.length ? merged : null;
  }

  let referenceRect = null;
  if (referenceLayer?.vectorData) {
    try { referenceRect = JSON.parse(referenceLayer.vectorData); } catch { /* skip */ }
  }

  const settingsLayer = migrated.layers.find(l => l.kind === 'vector' && l.id === 'layer-vector-settings' && l.vectorData);
  let vectorState = null;
  if (settingsLayer?.vectorData) {
    try { vectorState = JSON.parse(settingsLayer.vectorData); } catch { /* skip */ }
  }

  const annotationLayer = migrated.layers.find(l => l.kind === 'annotation' && l.annotationData);
  let annotations = [];
  if (annotationLayer?.annotationData) {
    try { annotations = JSON.parse(annotationLayer.annotationData); } catch { /* skip */ }
  }

  const shapesLayer = migrated.layers.find(l => l.kind === 'vector' && l.id === 'layer-shapes' && l.vectorData);
  let shapes = [];
  if (shapesLayer?.vectorData) {
    try {
      const parsed = JSON.parse(shapesLayer.vectorData);
      shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
    } catch { /* skip */ }
  }

  const textAnnotationsLayer = migrated.layers.find(l => l.kind === 'vector' && l.id === 'layer-text-annotations' && l.vectorData);
  let textAnnotations = [];
  if (textAnnotationsLayer?.vectorData) {
    try {
      const parsed = JSON.parse(textAnnotationsLayer.vectorData);
      textAnnotations = Array.isArray(parsed.textAnnotations) ? parsed.textAnnotations : [];
    } catch { /* skip */ }
  }

  return {
    strokes: strokesFromPackage,
    drawingLayers: strokeLayers.map((layer, index) => {
      let layerStrokes = [];
      try { layerStrokes = JSON.parse(layer.strokeData || '[]'); } catch { /* skip */ }
      return {
        id: layer.id || `asset-layer-${index}`,
        name: layer.name || `Layer ${index + 1}`,
        visible: layer.visible,
        locked: layer.locked ?? false,
        opacity: layer.opacity,
        blendMode: layer.blendMode || 'normal',
        strokes: layerStrokes,
      };
    }),
    storyboardPackSelection: migrated.renderSettings.storyboardPackSelection,
    cinematography: migrated.renderSettings.cinematography ?? vectorState?.activeShot,
    overlay: migrated.renderSettings.overlay ?? vectorState?.overlay,
    annotations,
    shapes,
    textAnnotations,
    activeLayerId: vectorState?.drawingState?.activeLayerId,
    reference: referenceLayer?.referenceSrc ? {
      src: referenceLayer.referenceSrc,
      visible: referenceLayer.visible,
      opacity: referenceLayer.opacity,
      x: referenceRect?.x ?? 0,
      y: referenceRect?.y ?? 0,
      width: referenceRect?.width ?? 0,
      height: referenceRect?.height ?? 0,
    } : null,
    authoringMetadata: migrated.authoringMetadata ?? null,
    exports: migrated.exports,
  };
}

// ── Test Data ─────────────────────────────────────────────────────────────────

const layerA = { id: 'layer-a', name: 'Background', visible: true, locked: false, opacity: 0.8, blendMode: 'multiply', strokes: [] };
const layerB = { id: 'layer-b', name: 'Characters', visible: true, locked: false, opacity: 1, blendMode: 'normal', strokes: [] };
const layerC = { id: 'layer-c', name: 'FX', visible: false, locked: true, opacity: 0.5, blendMode: 'screen', strokes: [] };

const strokesFlat = [
  { id: 's1', layerId: 'layer-a', points: [{ x: 10, y: 20 }], brushSettings: { type: 'pen', size: 3 } },
  { id: 's2', layerId: 'layer-a', points: [{ x: 30, y: 40 }], brushSettings: { type: 'pen', size: 5 } },
  { id: 's3', layerId: 'layer-b', points: [{ x: 50, y: 60 }, { x: 70, y: 80 }], brushSettings: { type: 'brush', size: 10 } },
  { id: 's4', layerId: 'layer-c', points: [{ x: 100, y: 200 }], brushSettings: { type: 'marker', size: 8 } },
];

const shapes = [
  { id: 'shape-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, rotation: 0, style: { fillColor: '#3b82f6', fillOpacity: 0.3, strokeColor: '#fff', strokeWidth: 2, strokeOpacity: 1 } },
  { id: 'shape-2', type: 'ellipse', x: 200, y: 100, width: 80, height: 80, rotation: 45, style: { fillColor: '#ef4444', fillOpacity: 0.5, strokeColor: '#000', strokeWidth: 1, strokeOpacity: 0.8 } },
  { id: 'shape-3', type: 'arrow', x: 0, y: 0, width: 50, height: 10, rotation: 0, x2: 50, y2: 10, style: { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#fff', strokeWidth: 3, strokeOpacity: 1 } },
];

const textAnnotations = [
  { id: 'text-1', text: 'HERO enters frame left', x: 50, y: 300, width: 200, height: 40, rotation: 0, style: { fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', color: '#ffffff', backgroundColor: '#000000', backgroundOpacity: 0.5, showBackground: true, padding: 8, lineHeight: 1.5 } },
  { id: 'text-2', text: 'CUT TO:', x: 300, y: 50, width: 100, height: 30, rotation: 0, style: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'normal', fontStyle: 'italic', textDecoration: 'underline', textAlign: 'center', color: '#fbbf24', backgroundColor: 'transparent', backgroundOpacity: 0, showBackground: false, padding: 4, lineHeight: 1.2 } },
];

const frameAnnotations = [
  { id: 'ann-1', type: 'arrow', label: 'Camera pan', notes: '3s pan left', x: 100, y: 200, rotation: 15, color: '#ff0000' },
  { id: 'ann-2', type: 'circle', label: 'Focus point', x: 320, y: 180, color: '#00ff00' },
];

const referenceImage = { src: '/api/storyboard-packs/admin/slot-image/pack/slot/hero.png', visible: true, opacity: 0.45, x: 0, y: 0, width: 1920, height: 1080 };

const cinematography = { shotType: 'close-up', cameraAngle: 'eye-level', lens: '50mm', movement: 'static' };
const overlay = { showGrid: true, showSafeArea: true, notes: 'Rule of thirds' };

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n═══ Test 1: Multi-layer stroke distribution ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: strokesFlat,
    activePackId: 'cinematic-drama',
    activeSlotId: 'hero-close',
    activeCinematography: cinematography,
    overlaySettings: overlay,
    referenceImage,
    drawingLayers: [layerA, layerB, layerC],
    activeLayerId: 'layer-b',
    annotations: frameAnnotations,
    shapes,
    textAnnotations,
  });

  const out = parseFrameAssetPackage(pkg);

  assert(out.strokes !== null, 'Strokes are not null');
  assert(out.strokes.length === 4, `All 4 strokes recovered (got ${out.strokes?.length})`);

  // Check layer-a got its 2 strokes
  const layerAStrokes = out.strokes.filter(s => s.layerId === 'layer-a');
  assert(layerAStrokes.length === 2, `Layer A has 2 strokes (got ${layerAStrokes.length})`);
  assert(layerAStrokes[0].id === 's1', 'Layer A stroke 1 is s1');
  assert(layerAStrokes[1].id === 's2', 'Layer A stroke 2 is s2');

  // Check layer-b got its 1 stroke
  const layerBStrokes = out.strokes.filter(s => s.layerId === 'layer-b');
  assert(layerBStrokes.length === 1, `Layer B has 1 stroke (got ${layerBStrokes.length})`);
  assert(layerBStrokes[0].points.length === 2, 'Layer B stroke has 2 points');

  // Check layer-c got its 1 stroke
  const layerCStrokes = out.strokes.filter(s => s.layerId === 'layer-c');
  assert(layerCStrokes.length === 1, `Layer C has 1 stroke (got ${layerCStrokes.length})`);

  // Check drawingLayers metadata
  assert(out.drawingLayers.length === 3, `3 drawing layers restored (got ${out.drawingLayers.length})`);
  assert(out.drawingLayers[0].id === 'layer-a', 'First layer is layer-a');
  assert(out.drawingLayers[0].blendMode === 'multiply', 'Layer A blend mode is multiply');
  assert(out.drawingLayers[0].opacity === 0.8, 'Layer A opacity is 0.8');
  assert(out.drawingLayers[1].name === 'Characters', 'Layer B name is Characters');
  assert(out.drawingLayers[2].visible === false, 'Layer C is not visible');
  assert(out.drawingLayers[2].locked === true, 'Layer C is locked');

  // Per-layer strokes on the drawingLayer objects
  assert(out.drawingLayers[0].strokes.length === 2, 'DrawingLayer A has 2 strokes');
  assert(out.drawingLayers[1].strokes.length === 1, 'DrawingLayer B has 1 stroke');
  assert(out.drawingLayers[2].strokes.length === 1, 'DrawingLayer C has 1 stroke');
}

console.log('\n═══ Test 2: Shapes (vector objects) roundtrip ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [layerA],
    annotations: [],
    shapes,
    textAnnotations: [],
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.shapes.length === 3, `3 shapes restored (got ${out.shapes.length})`);
  assert(out.shapes[0].id === 'shape-1', 'Shape 1 ID matches');
  assert(out.shapes[0].type === 'rectangle', 'Shape 1 type is rectangle');
  assert(out.shapes[1].rotation === 45, 'Shape 2 rotation is 45');
  assert(out.shapes[2].x2 === 50, 'Shape 3 arrow endpoint x2 is 50');
  assert(deepEqual(out.shapes[0].style, shapes[0].style), 'Shape 1 style roundtrips exactly');
}

console.log('\n═══ Test 3: Text annotations roundtrip ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [layerA],
    annotations: [],
    shapes: [],
    textAnnotations,
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.textAnnotations.length === 2, `2 text annotations restored (got ${out.textAnnotations.length})`);
  assert(out.textAnnotations[0].text === 'HERO enters frame left', 'Text 1 content matches');
  assert(out.textAnnotations[1].style.fontFamily === 'Courier New', 'Text 2 font family matches');
  assert(out.textAnnotations[0].style.fontWeight === 'bold', 'Text 1 font weight is bold');
}

console.log('\n═══ Test 4: Frame annotations roundtrip ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [layerA],
    annotations: frameAnnotations,
    shapes: [],
    textAnnotations: [],
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.annotations.length === 2, `2 annotations restored (got ${out.annotations.length})`);
  assert(out.annotations[0].type === 'arrow', 'Annotation 1 type is arrow');
  assert(out.annotations[0].label === 'Camera pan', 'Annotation 1 label matches');
  assert(out.annotations[1].color === '#00ff00', 'Annotation 2 color matches');
}

console.log('\n═══ Test 5: Vector/tool state roundtrip ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: strokesFlat,
    activePackId: 'cinematic-drama',
    activeSlotId: 'hero-close',
    activeCinematography: cinematography,
    overlaySettings: overlay,
    referenceImage: null,
    drawingLayers: [layerA, layerB],
    activeLayerId: 'layer-b',
    annotations: [],
    shapes: [],
    textAnnotations: [],
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.activeLayerId === 'layer-b', `Active layer ID is layer-b (got ${out.activeLayerId})`);
  assert(deepEqual(out.cinematography, cinematography), 'Cinematography roundtrips exactly');
  assert(deepEqual(out.overlay, overlay), 'Overlay roundtrips exactly');
  assert(out.storyboardPackSelection?.packId === 'cinematic-drama', 'Pack selection packId matches');
  assert(out.storyboardPackSelection?.slotId === 'hero-close', 'Pack selection slotId matches');
}

console.log('\n═══ Test 6: Reference image roundtrip ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage,
    drawingLayers: [layerA],
    annotations: [],
    shapes: [],
    textAnnotations: [],
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.reference !== null, 'Reference image is not null');
  assert(out.reference.src === referenceImage.src, 'Reference src matches');
  assert(out.reference.opacity === 0.45, 'Reference opacity matches');
  assert(out.reference.width === 1920, 'Reference width matches');
  assert(out.reference.height === 1080, 'Reference height matches');
  assert(out.reference.visible === true, 'Reference visible matches');
}

console.log('\n═══ Test 7: Multi-format exports ═══');
{
  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [layerA],
    annotations: [],
    shapes: [],
    textAnnotations: [],
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.exports.length === 4, `4 exports generated (got ${out.exports.length})`);
  const formats = out.exports.map(e => e.id);
  assert(formats.includes('export-primary-png'), 'PNG export present');
  assert(formats.includes('export-jpeg-85'), 'JPEG export present');
  assert(formats.includes('export-webp-80'), 'WebP export present');
  assert(formats.includes('export-thumbnail-256'), 'Thumbnail export present');
  assert(out.exports.every(e => e.createdAt), 'All exports have timestamps');
}

console.log('\n═══ Test 8: V1→V2 migration ═══');
{
  const v1Package = {
    version: 1,
    layers: [
      { kind: 'stroke', visible: true, opacity: 1, strokeData: JSON.stringify([{ id: 's1', points: [{ x: 1, y: 2 }] }]) },
    ],
    renderSettings: { storyboardPackSelection: { packId: 'test', slotId: 'slot' } },
    exports: [{ format: 'png', dataUrl: 'data:image/png;base64,v1' }],
  };

  const out = parseFrameAssetPackage(v1Package);
  assert(out !== null, 'V1 package migrates successfully');
  assert(out.strokes?.length === 1, 'V1 strokes preserved');
  assert(out.storyboardPackSelection?.packId === 'test', 'V1 pack selection preserved');
  assert(out.drawingLayers[0].id === 'layer-0', 'V1 layer gets auto-generated ID');
  assert(out.drawingLayers[0].blendMode === 'normal', 'V1 layer gets default blendMode');
  assert(out.exports[0].id === 'export-0', 'V1 export gets auto-generated ID');
}

console.log('\n═══ Test 9: Edge cases ═══');
{
  // Null/undefined input
  assert(parseFrameAssetPackage(null) === null, 'null input returns null');
  assert(parseFrameAssetPackage(undefined) === null, 'undefined input returns null');

  // Empty layers
  const emptyPkg = { version: 2, layers: [], renderSettings: {}, exports: [], updatedAt: now };
  const emptyOut = parseFrameAssetPackage(emptyPkg);
  assert(emptyOut.strokes === null, 'Empty layers → null strokes');
  assert(emptyOut.shapes.length === 0, 'Empty layers → no shapes');
  assert(emptyOut.textAnnotations.length === 0, 'Empty layers → no text annotations');

  // Corrupt stroke data (graceful skip)
  const corruptPkg = {
    version: 2,
    layers: [
      { id: 'bad', kind: 'stroke', name: 'Bad', visible: true, opacity: 1, strokeData: '{{{corrupt' },
      { id: 'good', kind: 'stroke', name: 'Good', visible: true, opacity: 1, strokeData: JSON.stringify([{ id: 'ok', points: [] }]) },
    ],
    renderSettings: {},
    exports: [],
    updatedAt: now,
  };
  const corruptOut = parseFrameAssetPackage(corruptPkg);
  assert(corruptOut.strokes?.length === 1, 'Corrupt layer skipped, good layer preserved');
  assert(corruptOut.strokes[0].id === 'ok', 'Good stroke survived');

  // Unknown version (fallback migration)
  const v99 = { version: 99, layers: [{ id: 'x', kind: 'stroke', name: 'X', visible: true, opacity: 1, strokeData: '[]' }], renderSettings: {}, exports: [] };
  const v99Out = parseFrameAssetPackage(v99);
  assert(v99Out !== null, 'Unknown version still parses');

  // No drawingLayers (fallback to single primary layer)
  const noLayersPkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,test',
    strokes: [{ id: 's1', points: [{ x: 1, y: 1 }] }],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [],
    annotations: [],
    shapes: [],
    textAnnotations: [],
  });
  const noLayersOut = parseFrameAssetPackage(noLayersPkg);
  assert(noLayersOut.drawingLayers.length === 1, 'Fallback creates single primary layer');
  assert(noLayersOut.drawingLayers[0].id === 'layer-strokes-primary', 'Fallback layer has expected ID');
  assert(noLayersOut.strokes?.length === 1, 'Fallback layer contains the stroke');
}

console.log('\n═══ Test 10: Large payload boundary ═══');
{
  const manyStrokes = Array.from({ length: 500 }, (_, i) => ({
    id: `stroke-${i}`,
    layerId: `layer-${i % 3}`,
    points: Array.from({ length: 50 }, (_, j) => ({ x: j, y: j * 2, pressure: 0.5 })),
    brushSettings: { type: 'pen', size: 3 },
  }));

  const manyLayers = Array.from({ length: 3 }, (_, i) => ({
    id: `layer-${i}`,
    name: `Layer ${i}`,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    strokes: [],
  }));

  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,large',
    strokes: manyStrokes,
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: manyLayers,
    annotations: [],
    shapes: Array.from({ length: 50 }, (_, i) => ({ id: `s-${i}`, type: 'rectangle', x: i, y: i, width: 10, height: 10, rotation: 0, style: {} })),
    textAnnotations: Array.from({ length: 20 }, (_, i) => ({ id: `t-${i}`, text: `Text ${i}`, x: i, y: i, width: 100, height: 20, rotation: 0, style: {} })),
  });

  const out = parseFrameAssetPackage(pkg);
  assert(out.strokes.length === 500, `All 500 strokes preserved (got ${out.strokes.length})`);
  assert(out.drawingLayers.length === 3, `3 layers preserved`);
  assert(out.shapes.length === 50, `50 shapes preserved (got ${out.shapes.length})`);
  assert(out.textAnnotations.length === 20, `20 text annotations preserved (got ${out.textAnnotations.length})`);

  // Verify stroke distribution
  const layer0Count = out.strokes.filter(s => s.layerId === 'layer-0').length;
  const layer1Count = out.strokes.filter(s => s.layerId === 'layer-1').length;
  const layer2Count = out.strokes.filter(s => s.layerId === 'layer-2').length;
  assert(layer0Count === 167, `Layer 0 has 167 strokes (got ${layer0Count})`);
  assert(layer1Count === 167, `Layer 1 has 167 strokes (got ${layer1Count})`);
  assert(layer2Count === 166, `Layer 2 has 166 strokes (got ${layer2Count})`);
}

console.log('\n═══ Test 11: Authoring metadata roundtrip ═══');
{
  const authoringMetadata = {
    authorName: 'Jane Doe',
    authorId: 'user-abc-123',
    signatureDataUrl: 'data:image/png;base64,sig-mock',
    license: 'cc-by-sa',
    customLicense: undefined,
    createdAt: now,
    notes: 'Concept art for scene 3',
  };

  const pkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,auth-test',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [{ id: 'layer-default', name: 'Layer 1', visible: true, locked: false, opacity: 1, blendMode: 'normal', strokes: [] }],
    annotations: [],
    shapes: [],
    textAnnotations: [],
    authoringMetadata,
  });

  assert(pkg.authoringMetadata !== undefined, 'Package carries authoringMetadata');
  assert(pkg.authoringMetadata.authorName === 'Jane Doe', 'Author name preserved in package');
  assert(pkg.authoringMetadata.signatureDataUrl === 'data:image/png;base64,sig-mock', 'Signature data URL preserved');
  assert(pkg.authoringMetadata.license === 'cc-by-sa', 'License preserved');
  assert(pkg.authoringMetadata.notes === 'Concept art for scene 3', 'Notes preserved');

  const out = parseFrameAssetPackage(pkg);
  assert(out.authoringMetadata !== null, 'Parsed authoring metadata is not null');
  assert(out.authoringMetadata.authorName === 'Jane Doe', 'Roundtrip: author name');
  assert(out.authoringMetadata.authorId === 'user-abc-123', 'Roundtrip: author ID');
  assert(out.authoringMetadata.signatureDataUrl === 'data:image/png;base64,sig-mock', 'Roundtrip: signature');
  assert(out.authoringMetadata.license === 'cc-by-sa', 'Roundtrip: license');
  assert(out.authoringMetadata.notes === 'Concept art for scene 3', 'Roundtrip: notes');

  // Without metadata — should be null
  const pkgNoAuth = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,no-auth',
    strokes: [],
    activePackId: '',
    activeSlotId: '',
    activeCinematography: {},
    overlaySettings: {},
    referenceImage: null,
    drawingLayers: [{ id: 'layer-default', name: 'Layer 1', visible: true, locked: false, opacity: 1, blendMode: 'normal', strokes: [] }],
    annotations: [],
  });
  const outNoAuth = parseFrameAssetPackage(pkgNoAuth);
  assert(outNoAuth.authoringMetadata === null, 'No authoring metadata when omitted');
}

console.log('\n═══ Test 12: Full combined roundtrip (the confidence gate) ═══');
{
  // Build with ALL features active simultaneously
  const fullPkg = buildFrameAssetPackage({
    imageData: 'data:image/png;base64,full-test',
    strokes: strokesFlat,
    activePackId: 'cinematic-drama',
    activeSlotId: 'hero-close',
    activeCinematography: cinematography,
    overlaySettings: overlay,
    referenceImage,
    drawingLayers: [layerA, layerB, layerC],
    activeLayerId: 'layer-b',
    annotations: frameAnnotations,
    shapes,
    textAnnotations,
    authoringMetadata: {
      authorName: 'Full Test Artist',
      license: 'cc-by',
      signatureDataUrl: 'data:image/png;base64,full-sig',
      createdAt: now,
    },
  });

  const out = parseFrameAssetPackage(fullPkg);

  // Strokes
  assert(out.strokes.length === 4, 'Full: all 4 strokes');
  // Layers
  assert(out.drawingLayers.length === 3, 'Full: 3 drawing layers');
  // Shapes
  assert(out.shapes.length === 3, 'Full: 3 shapes');
  // Text annotations
  assert(out.textAnnotations.length === 2, 'Full: 2 text annotations');
  // Annotations
  assert(out.annotations.length === 2, 'Full: 2 frame annotations');
  // Reference
  assert(out.reference?.src === referenceImage.src, 'Full: reference image');
  // Cinematography
  assert(out.cinematography?.shotType === 'close-up', 'Full: cinematography');
  // Overlay
  assert(out.overlay?.showGrid === true, 'Full: overlay grid');
  // Active layer
  assert(out.activeLayerId === 'layer-b', 'Full: active layer ID');
  // Pack selection
  assert(out.storyboardPackSelection?.packId === 'cinematic-drama', 'Full: pack selection');
  // Exports
  assert(out.exports.length === 4, 'Full: 4 exports');

  // Deep equality check on shapes
  assert(deepEqual(out.shapes, shapes), 'Full: shapes deep equal');
  // Deep equality check on text annotations
  assert(deepEqual(out.textAnnotations, textAnnotations), 'Full: text annotations deep equal');
  // Deep equality check on frame annotations
  assert(deepEqual(out.annotations, frameAnnotations), 'Full: frame annotations deep equal');
  // Authoring metadata
  assert(out.authoringMetadata !== null, 'Full: authoring metadata present');
  assert(out.authoringMetadata.authorName === 'Full Test Artist', 'Full: author name');
  assert(out.authoringMetadata.license === 'cc-by', 'Full: license');
  assert(out.authoringMetadata.signatureDataUrl === 'data:image/png;base64,full-sig', 'Full: signature');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
console.log('Comprehensive asset package roundtrip verification: OK');
