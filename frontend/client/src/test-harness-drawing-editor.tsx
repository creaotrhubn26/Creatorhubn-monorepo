import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Box, Button, Chip, CssBaseline, Stack, ThemeProvider, Typography, createTheme } from '@mui/material';
import FrameDrawingEditor from './components/role-room/components/FrameDrawingEditor';
import { PencilCanvasPro, type StrokeTransform } from './components/role-room/components/PencilCanvasPro';
import type { PencilStroke } from './components/role-room/hooks/useApplePencil';
import {
  addStoryboardDrawingDocumentMarker,
  addStoryboardDrawingDocumentBookmark,
  addStoryboardDrawingDocumentCanvas,
  addStoryboardDrawingDocumentLayer,
  addStoryboardDrawingDocumentReference,
  addStoryboardDrawingDocumentSheet,
  addStoryboardDrawingDocumentTransformationLayer,
  createStoryboardDrawingDocument,
  duplicateStoryboardDrawingDocumentSheet,
  getStoryboardDocumentSheetLayers,
  groupStoryboardDrawingDocumentLayers,
  setStoryboardDrawingDocumentActiveLayer,
  setStoryboardDrawingDocumentScrubFrame,
  upsertStoryboardDrawingDocumentTransformationKeyframe,
  updateStoryboardDrawingDocumentProjection,
  updateStoryboardDrawingDocumentSheetContent,
  updateStoryboardDrawingDocumentLayer,
} from './components/role-room/state/storyboardDrawingDocument';
import type { FrameDrawingData } from './components/role-room/state/storyboardStore';

type WorkflowLevel = 'idea' | 'blocking' | 'shot' | 'presentation';
type AspectRatio = '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
type HarnessScenario = 'default' | 'selection';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#06070b',
      paper: '#0b0d14',
    },
  },
  shape: {
    borderRadius: 20,
  },
  typography: {
    fontFamily: '"SF Pro Display", "Inter", "Segoe UI", sans-serif',
  },
});

const getWorkflowLevel = (): WorkflowLevel => {
  const value = new URLSearchParams(window.location.search).get('workflow');
  return value === 'idea' || value === 'blocking' || value === 'presentation' ? value : 'shot';
};

const getAspectRatio = (): AspectRatio => {
  const value = new URLSearchParams(window.location.search).get('aspect');
  return value === '16:9' || value === '4:3' || value === '1:1' || value === '9:16' ? value : '2.35:1';
};

const getHarnessScenario = (): HarnessScenario => {
  const value = new URLSearchParams(window.location.search).get('scenario');
  return value === 'selection' ? 'selection' : 'default';
};

const SAMPLE_IMAGE_URL = '/test-assets/storyboard-noir-reference.svg';

const createStroke = (
  color: string,
  width: number,
  points: Array<[number, number]>
): PencilStroke => ({
  inputType: 'pen',
  color,
  width,
  opacity: 1,
  brush: {
    type: 'pen',
    size: width,
    color,
    opacity: 1,
    hardness: 0.78,
    flow: 0.72,
    wetness: 0.1,
    grain: 0.04,
    tiltSensitivity: 0.18,
    pressureSensitivity: 0.86,
  },
  points: points.map(([x, y], index) => ({
    x,
    y,
    pressure: 0.55 + ((index % 3) * 0.12),
    tiltX: 0,
    tiltY: 0,
    timestamp: 1000 + index * 16,
  })),
});

const BASE_STROKES: PencilStroke[] = [
  createStroke('#f8fafc', 9, [[420, 710], [760, 520], [1080, 420], [1340, 380]]),
  createStroke('#dbeafe', 6, [[860, 790], [1020, 690], [1160, 560], [1360, 460]]),
  createStroke('#f6b24d', 5, [[520, 340], [760, 300], [980, 326], [1210, 368]]),
];

const BLOCKING_STROKES: PencilStroke[] = [
  createStroke('#f8fafc', 8, [[320, 760], [620, 640], [960, 520], [1380, 430]]),
  createStroke('#cbd5e1', 4, [[460, 290], [760, 260], [1040, 290], [1280, 356]]),
];

const CLOSEUP_STROKES: PencilStroke[] = [
  createStroke('#fde68a', 10, [[760, 820], [920, 640], [1080, 520], [1210, 420]]),
  createStroke('#f8fafc', 6, [[660, 340], [820, 310], [980, 330], [1140, 366]]),
];

const WIDE_STROKES: PencilStroke[] = [
  createStroke('#94a3b8', 5, [[220, 820], [520, 720], [920, 660], [1510, 620]]),
  createStroke('#f8fafc', 4, [[380, 310], [680, 270], [1120, 286], [1480, 340]]),
];

const SKETCH_STROKES: PencilStroke[] = [
  createStroke('#cbd5e1', 4, [[280, 790], [620, 650], [980, 560], [1420, 498]]),
];

const LIGHTING_STROKES: PencilStroke[] = [
  createStroke('#fde68a', 6, [[1240, 260], [1320, 330], [1400, 410], [1450, 520]]),
];

const GRAIN_STROKES: PencilStroke[] = [
  createStroke('#94a3b8', 3, [[310, 250], [510, 280], [760, 300], [1080, 320], [1410, 360]]),
];

const SELECTION_STROKES: PencilStroke[] = [
  createStroke('#f8fafc', 8, [[180, 220], [360, 220], [360, 340], [180, 340], [180, 220]]),
  createStroke('#fde68a', 5, [[200, 240], [340, 320]]),
  createStroke('#93c5fd', 4, [[200, 320], [340, 240]]),
];

const SELECTION_TRANSFORMS: StrokeTransform[] = [
  {
    translateX: 210,
    translateY: 48,
    scaleX: 1.16,
    scaleY: 0.94,
    rotation: -14,
    pivotX: 270,
    pivotY: 280,
  },
];

const applyTransformToPoint = (
  point: { x: number; y: number },
  transforms: StrokeTransform[],
) => {
  let x = point.x;
  let y = point.y;
  transforms.forEach((transform) => {
    const perspectiveX = transform.perspectiveX ?? 0;
    const perspectiveY = transform.perspectiveY ?? 0;
    const rotationRadians = (transform.rotation * Math.PI) / 180;
    const relativeX = x - transform.pivotX;
    const relativeY = y - transform.pivotY;
    const scaledX = relativeX * transform.scaleX;
    const scaledY = relativeY * transform.scaleY;
    const perspectiveXPosition = scaledX + (scaledY * perspectiveX);
    const perspectiveYPosition = (scaledX * perspectiveY) + scaledY;
    const rotatedX = (perspectiveXPosition * Math.cos(rotationRadians)) - (perspectiveYPosition * Math.sin(rotationRadians));
    const rotatedY = (perspectiveXPosition * Math.sin(rotationRadians)) + (perspectiveYPosition * Math.cos(rotationRadians));
    x = transform.pivotX + transform.translateX + rotatedX;
    y = transform.pivotY + transform.translateY + rotatedY;
  });
  return { x, y };
};

const applyTransformsToStroke = (stroke: PencilStroke, transforms: StrokeTransform[]): PencilStroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({
    ...point,
    ...applyTransformToPoint(point, transforms),
  })),
});

const getStrokeBounds = (strokes: PencilStroke[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  strokes.forEach((stroke) => {
    stroke.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    x: Number.isFinite(minX) ? minX : 0,
    y: Number.isFinite(minY) ? minY : 0,
    width: Number.isFinite(maxX - minX) ? maxX - minX : 0,
    height: Number.isFinite(maxY - minY) ? maxY - minY : 0,
  };
};

const buildHarnessDocument = (aspectRatio: AspectRatio, workflowLevel: WorkflowLevel) => {
  const timestamp = '2026-03-24T10:00:00.000Z';
  let document = createStoryboardDrawingDocument({
    aspectRatio,
    workflowLevel,
    baseImageUrl: SAMPLE_IMAGE_URL,
    imageDataUrl: SAMPLE_IMAGE_URL,
    strokes: BASE_STROKES,
    brushSettings: {
      type: 'pen',
      size: 6,
      color: '#f8fafc',
      opacity: 1,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const firstSheetId = document.primarySheetId;
  document = duplicateStoryboardDrawingDocumentSheet(document, firstSheetId, { name: 'Sheet 2' }, timestamp);
  const secondSheetId = document.primarySheetId;
  document = updateStoryboardDrawingDocumentLayer(document, getStoryboardDocumentSheetLayers(document, secondSheetId)[0].id, {
    name: 'Sketch',
    opacity: 0.84,
    blendMode: 'normal',
  }, timestamp);
  document = addStoryboardDrawingDocumentLayer(document, secondSheetId, { name: 'Line Art' }, timestamp);
  document = addStoryboardDrawingDocumentLayer(document, secondSheetId, { name: 'Shadows' }, timestamp);
  document = addStoryboardDrawingDocumentLayer(document, secondSheetId, { name: 'Lighting' }, timestamp);
  document = addStoryboardDrawingDocumentLayer(document, secondSheetId, { name: 'PX / Grain' }, timestamp);

  const secondSheetLayers = getStoryboardDocumentSheetLayers(document, secondSheetId);
  const sketchLayerId = secondSheetLayers[0]?.id;
  const lineArtLayerId = secondSheetLayers[1]?.id;
  const shadowsLayerId = secondSheetLayers[2]?.id;
  const lightingLayerId = secondSheetLayers[3]?.id;
  const grainLayerId = secondSheetLayers[4]?.id;

  if (lineArtLayerId) {
    document = updateStoryboardDrawingDocumentLayer(document, lineArtLayerId, {
      opacity: 1,
      locked: true,
      blendMode: 'multiply',
    }, timestamp);
    document = updateStoryboardDrawingDocumentSheetContent(document, secondSheetId, {
      layerId: lineArtLayerId,
      strokes: CLOSEUP_STROKES,
      updatedAt: timestamp,
    });
  }

  if (shadowsLayerId) {
    document = updateStoryboardDrawingDocumentLayer(document, shadowsLayerId, {
      opacity: 1,
      blendMode: 'multiply',
    }, timestamp);
    document = updateStoryboardDrawingDocumentSheetContent(document, secondSheetId, {
      layerId: shadowsLayerId,
      strokes: BLOCKING_STROKES,
      updatedAt: timestamp,
    });
  }

  if (lightingLayerId) {
    document = updateStoryboardDrawingDocumentLayer(document, lightingLayerId, {
      opacity: 0.72,
      blendMode: 'screen',
    }, timestamp);
    document = updateStoryboardDrawingDocumentSheetContent(document, secondSheetId, {
      layerId: lightingLayerId,
      strokes: LIGHTING_STROKES,
      updatedAt: timestamp,
    });
  }

  if (grainLayerId) {
    document = updateStoryboardDrawingDocumentLayer(document, grainLayerId, {
      opacity: 0.42,
      locked: true,
      blendMode: 'overlay',
    }, timestamp);
    document = updateStoryboardDrawingDocumentSheetContent(document, secondSheetId, {
      layerId: grainLayerId,
      strokes: GRAIN_STROKES,
      updatedAt: timestamp,
    });
  }

  if (sketchLayerId) {
    document = updateStoryboardDrawingDocumentSheetContent(document, secondSheetId, {
      layerId: sketchLayerId,
      strokes: SKETCH_STROKES,
      updatedAt: timestamp,
    });
  }

  if (sketchLayerId && lineArtLayerId) {
    document = groupStoryboardDrawingDocumentLayers(
      document,
      secondSheetId,
      [sketchLayerId, lineArtLayerId],
      { name: 'Ink Pass' },
      timestamp,
    );
  }

  if (shadowsLayerId) {
    document = addStoryboardDrawingDocumentTransformationLayer(
      document,
      secondSheetId,
      [shadowsLayerId],
      { name: 'Camera Push', frame: 2, pivotMode: 'per-layer' },
      timestamp,
    );
    const cameraPushLayerId = document.layers.find((layer) => layer.type === 'transformation' && layer.name === 'Camera Push')?.id;
    if (cameraPushLayerId) {
      document = upsertStoryboardDrawingDocumentTransformationKeyframe(document, cameraPushLayerId, 2, {
        translateX: 18,
        translateY: -8,
        scaleX: 1.04,
        scaleY: 1.04,
        rotation: -1,
        cornerWarp: {
          nw: { x: -10, y: -6 },
          ne: { x: 18, y: -8 },
          se: { x: 12, y: 10 },
          sw: { x: -6, y: 8 },
        },
        easing: 'ease',
      }, timestamp);
      document = upsertStoryboardDrawingDocumentTransformationKeyframe(document, cameraPushLayerId, 6, {
        translateX: 62,
        translateY: -20,
        scaleX: 1.1,
        scaleY: 1.1,
        rotation: -3,
        cornerWarp: {
          nw: { x: -18, y: -12 },
          ne: { x: 28, y: -14 },
          se: { x: 18, y: 16 },
          sw: { x: -10, y: 12 },
        },
        easing: 'ease',
      }, timestamp);
    }
  }

  if (shadowsLayerId) {
    document = setStoryboardDrawingDocumentActiveLayer(document, secondSheetId, shadowsLayerId, timestamp);
  }

  document = duplicateStoryboardDrawingDocumentSheet(document, secondSheetId, { linked: true, name: 'Sheet 3 Link' }, timestamp);
  const thirdSheetId = document.primarySheetId;
  document = addStoryboardDrawingDocumentSheet(document, {
    afterSheetId: thirdSheetId,
    name: 'Sheet 4',
    exposure: 2,
  }, timestamp);
  const fourthSheetId = document.primarySheetId;
  document = updateStoryboardDrawingDocumentSheetContent(document, fourthSheetId, {
    strokes: WIDE_STROKES,
    updatedAt: timestamp,
  });

  document = updateStoryboardDrawingDocumentSheetContent(document, firstSheetId, {
    strokes: CLOSEUP_STROKES,
    updatedAt: timestamp,
  });

  document = addStoryboardDrawingDocumentMarker(document, { frame: 0, label: 'Beat 01' }, timestamp);
  document = addStoryboardDrawingDocumentMarker(document, { frame: 2, label: 'Beat 02' }, timestamp);
  document = addStoryboardDrawingDocumentMarker(document, { frame: 4, label: 'Beat 03' }, timestamp);
  document = addStoryboardDrawingDocumentMarker(document, { frame: 6, label: 'Beat 04' }, timestamp);
  document = addStoryboardDrawingDocumentReference(document, {
    name: 'Board Ref A',
    src: SAMPLE_IMAGE_URL,
    opacity: 0.62,
    visible: true,
    x: 96,
    y: 88,
    width: 420,
    height: 236,
    rotation: -2,
    fitMode: 'contain',
  }, timestamp);
  document = addStoryboardDrawingDocumentReference(document, {
    name: 'Board Ref B',
    src: SAMPLE_IMAGE_URL,
    opacity: 0.54,
    visible: false,
    x: 164,
    y: 126,
    width: 456,
    height: 260,
    rotation: 12,
    fitMode: 'cover',
  }, timestamp);
  document = addStoryboardDrawingDocumentCanvas(document, {
    name: 'Canvas 2',
    sheetIds: [secondSheetId, fourthSheetId],
  }, timestamp);
  const secondCanvasId = document.primaryCanvasId;
  document = addStoryboardDrawingDocumentBookmark(document, {
    canvasId: secondCanvasId,
    name: 'Flythrough Start',
    timingMs: 1600,
    transition: 'ease',
    visibleCanvasIds: [secondCanvasId],
    camera: {
      x: 220,
      y: 120,
      z: 24,
      zoom: 1.08,
      rotationX: 0,
      rotationY: 4,
      rotationZ: -2,
    },
  }, timestamp);
  document = addStoryboardDrawingDocumentBookmark(document, {
    canvasId: secondCanvasId,
    name: 'Flythrough Push',
    timingMs: 2300,
    transition: 'linear',
    visibleCanvasIds: [document.canvases[0]?.id || secondCanvasId, secondCanvasId],
    camera: {
      x: 260,
      y: 136,
      z: 42,
      zoom: 1.18,
      rotationX: 0,
      rotationY: 9,
      rotationZ: -4,
    },
  }, timestamp);
  document = addStoryboardDrawingDocumentCanvas(document, {
    name: 'Canvas 3',
    sheetIds: [fourthSheetId],
    select: false,
  }, timestamp);
  const thirdCanvasId = document.canvases.find((canvas) => canvas.name === 'Canvas 3')?.id;
  document = updateStoryboardDrawingDocumentProjection(document, {
    mode: 'projection',
    reinterpretExistingStrokes: true,
    arrangeAfterDrawing: true,
    sourceCanvasId: secondCanvasId,
    targetCanvasId: thirdCanvasId || secondCanvasId,
  }, timestamp);
  document = setStoryboardDrawingDocumentScrubFrame(document, 2, timestamp);

  return document;
};

function DrawingEditorHarness() {
  const workflowLevel = getWorkflowLevel();
  const aspectRatio = getAspectRatio();
  const scenario = getHarnessScenario();
  const initialDocument = useMemo(
    () => buildHarnessDocument(aspectRatio, workflowLevel),
    [aspectRatio, workflowLevel]
  );
  const seedDrawingData = useMemo<FrameDrawingData>(() => ({
    dataUrl: SAMPLE_IMAGE_URL,
    strokes: JSON.stringify(BLOCKING_STROKES),
    document: initialDocument,
    baseImageUrl: SAMPLE_IMAGE_URL,
    createdAt: '2026-03-24T10:00:00.000Z',
    updatedAt: '2026-03-24T10:00:00.000Z',
  }), [initialDocument]);
  const [saveCount, setSaveCount] = useState(0);
  const [editorRevision, setEditorRevision] = useState(0);
  const [mountedDrawingData, setMountedDrawingData] = useState<FrameDrawingData>(seedDrawingData);
  const [stagedDrawingData, setStagedDrawingData] = useState<FrameDrawingData | null>(null);
  const [selectionStrokes, setSelectionStrokes] = useState<PencilStroke[]>(SELECTION_STROKES);

  useEffect(() => {
    setSaveCount(0);
    setEditorRevision(0);
    setMountedDrawingData(seedDrawingData);
    setStagedDrawingData(null);
  }, [seedDrawingData]);

  const handleEditorSave = (drawingData: FrameDrawingData) => {
    setSaveCount((count) => count + 1);
    setStagedDrawingData(drawingData);
  };

  const handleHarnessRemount = () => {
    setMountedDrawingData(stagedDrawingData || mountedDrawingData);
    setEditorRevision((revision) => revision + 1);
  };

  const selectionDisplayStrokes = useMemo(
    () => selectionStrokes.map((stroke) => applyTransformsToStroke(stroke, SELECTION_TRANSFORMS)),
    [selectionStrokes]
  );
  const selectionLocalBounds = useMemo(
    () => getStrokeBounds(selectionStrokes),
    [selectionStrokes]
  );
  const selectionDisplayBounds = useMemo(
    () => getStrokeBounds(selectionDisplayStrokes),
    [selectionDisplayStrokes]
  );
  const selectionDisplaySignature = useMemo(() => {
    const signaturePoints = selectionDisplayStrokes
      .flatMap((stroke) => {
        const firstPoint = stroke.points[0];
        const lastPoint = stroke.points[stroke.points.length - 1];
        return [firstPoint, lastPoint].filter(Boolean);
      })
      .slice(0, 6);

    return signaturePoints
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' | ');
  }, [selectionDisplayStrokes]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        data-testid="drawing-editor-harness-ready"
        sx={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top, rgba(245,158,11,0.18), transparent 28%), linear-gradient(180deg, #090b10 0%, #030507 100%)',
          p: { xs: 1, md: 2.5 },
        }}
      >
        <Stack spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              Storyboard Drawing Editor Harness
            </Typography>
            <Chip label={`scenario=${scenario}`} size="small" variant="outlined" />
            <Chip label={`workflow=${workflowLevel}`} size="small" color="primary" variant="outlined" />
            <Chip label={`aspect=${aspectRatio}`} size="small" variant="outlined" />
            <Chip data-testid="drawing-editor-harness-save-count" label={`saves=${saveCount}`} size="small" variant="outlined" />
            {scenario !== 'selection' && (
              <>
                <Chip
                  data-testid="drawing-editor-harness-staged-state"
                  label={stagedDrawingData ? 'saved-session=ready' : 'saved-session=empty'}
                  size="small"
                  variant="outlined"
                />
                <Button
                  size="small"
                  variant="outlined"
                  data-testid="drawing-editor-harness-remount"
                  onClick={handleHarnessRemount}
                  disabled={!stagedDrawingData}
                >
                  Remount Editor
                </Button>
              </>
            )}
          </Stack>
          <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.72)' }}>
            {scenario === 'selection'
              ? 'Dedicated Playwright target for selection move, scale, and rotate on transformed layers.'
              : 'Dedicated Playwright target for polishing Tegneeditoren layout and desktop chrome.'}
          </Typography>
        </Stack>

        {scenario === 'selection' ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                data-testid="selection-harness-local-bounds"
                label={`local:${selectionLocalBounds.x.toFixed(1)},${selectionLocalBounds.y.toFixed(1)},${selectionLocalBounds.width.toFixed(1)},${selectionLocalBounds.height.toFixed(1)}`}
                size="small"
                variant="outlined"
              />
              <Chip
                data-testid="selection-harness-display-bounds"
                label={`display:${selectionDisplayBounds.x.toFixed(1)},${selectionDisplayBounds.y.toFixed(1)},${selectionDisplayBounds.width.toFixed(1)},${selectionDisplayBounds.height.toFixed(1)}`}
                size="small"
                variant="outlined"
              />
              <Chip
                data-testid="selection-harness-stroke-count"
                label={`strokes:${selectionStrokes.length}`}
                size="small"
                variant="outlined"
              />
              <Chip
                data-testid="selection-harness-display-signature"
                label={`signature:${selectionDisplaySignature}`}
                size="small"
                variant="outlined"
              />
            </Stack>

            <Box
              sx={{
                position: 'relative',
                width: 1080,
                maxWidth: '100%',
              }}
            >
              <Box
                data-testid="selection-harness-target-region"
                sx={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  left: selectionDisplayBounds.x,
                  top: selectionDisplayBounds.y,
                  width: selectionDisplayBounds.width,
                  height: selectionDisplayBounds.height,
                  border: '1px dashed rgba(125,211,252,0.85)',
                  bgcolor: 'rgba(56,189,248,0.08)',
                  boxShadow: '0 0 0 1px rgba(125,211,252,0.22) inset',
                  zIndex: 4,
                }}
              />
              <PencilCanvasPro
                width={1080}
                height={720}
                initialStrokes={selectionStrokes}
                activeStrokeTransforms={SELECTION_TRANSFORMS}
                showToolbar
                showDrawingToolsPanel={false}
                showPressureIndicator={false}
                showGridOverlay={false}
                onStrokesChange={setSelectionStrokes}
              />
            </Box>
          </Stack>
        ) : (
          <FrameDrawingEditor
            key={`drawing-editor-${editorRevision}`}
            frameId="shot-5b"
            aspectRatio={aspectRatio}
            initialImage={SAMPLE_IMAGE_URL}
            initialDrawingData={mountedDrawingData}
            workflowLevel={workflowLevel}
            mode="inline"
            sceneId="15"
            manuscriptId="scene-15"
            onSave={handleEditorSave}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DrawingEditorHarness />
  </React.StrictMode>
);
