import { create } from 'zustand';
import { Scene } from '@/core/models/scene';
import { addObject } from '@/core/commands/addObject';
import { updateObject } from '@/core/commands/updateObject';
import { deleteObject } from '@/core/commands/deleteObject';
import { transformObject } from '@/core/commands/transformObject';

export type Measurement = {
  id: string;
  a: [number, number];
  b: [number, number];
  label?: string;
  name?: string;
  color?: string;
};

export type StudioGuideSettings = {
  showDistanceGuides: boolean;
  showAngleGuides: boolean;
  showPositionMarkers: boolean;
  showGridOverlay: boolean;
  subjectPosition: [number, number, number];
  backgroundDistance: number;
  keyLightDistance: number;
  keyLightAngle: number;
  keyLightHeight: number;
  fillDistance: number;
  cameraDistance: number;
  shootType: 'headshot' | 'full_body' | 'small_group' | 'class_photo' | 'custom';
};

export type AdvancedGuideSettings = {
  composition: {
    enabled: boolean;
    guides: string[];
    color: string;
    opacity: number;
  };
  lighting: {
    enabled: boolean;
    showShadowDirection: boolean;
    showLightFalloff: boolean;
    showCatchlightPreview: boolean;
    showLightingRatio: boolean;
    showReflectorBounce: boolean;
  };
  depthOfField: {
    enabled: boolean;
    showFocusPlane: boolean;
    showInFocusZone: boolean;
    showHyperfocalDistance: boolean;
    showNearFarLimits: boolean;
  };
  videoProduction: {
    enabled: boolean;
    showTitleSafe: boolean;
    showActionSafe: boolean;
    showAspectRatioMask: boolean;
    showCenterMarkers: boolean;
    aspectRatio: string;
  };
  heightReferences: {
    enabled: boolean;
    showSubjectHeights: boolean;
    showCameraHeights: boolean;
    showLightHeights: boolean;
    showBackgroundHeight: boolean;
  };
  safetySpacing: {
    enabled: boolean;
    showEquipmentClearance: boolean;
    showCableRoutes: boolean;
    showMovementZones: boolean;
    showHotLightWarning: boolean;
  };
  colorExposure: {
    enabled: boolean;
    showColorTemperatureScale: boolean;
    showGrayCardPosition: boolean;
    showExposureZones: boolean;
    showColorCheckerPosition: boolean;
  };
  glassesReflection: {
    enabled: boolean;
    headTiltAngle: number;
    glassesAngle: number;
  };
};

type AppState = {
  scene: Scene;
  past: Scene[];
  future: Scene[];
  measurements: Measurement[];
  measureMode: boolean;
  showLightCones: boolean;
  showStudioGuides: boolean;
  studioGuideSettings: StudioGuideSettings;
  advancedGuideSettings: AdvancedGuideSettings;
  // actions
  addNode: (partial: any) => void;
  updateNode: (id: string, patch: any) => void;
  transformNode: (id: string, t: any) => void;
  deleteNode: (id: string) => void;
  select: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  setScene: (s: Scene) => void;
  toggleLightCones: () => void;
  toggleStudioGuides: () => void;
  updateStudioGuideSettings: (settings: Partial<StudioGuideSettings>) => void;
  updateAdvancedGuideSettings: (settings: Partial<AdvancedGuideSettings>) => void;
};

const initialScene: Scene = {
  id: 'scene-1',
  version: '0.1.0',
  nodes: [
    {
      id: 'bdrop',
      type: 'backdrop',
      name: 'Backdrop',
      visible: true,
      userData: {},
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    },
    {
      id: 'soft1',
      type: 'softbox',
      visible: true,
      userData: {},
      transform: { position: [-2.4, 1.6, 1.3], rotation: [0, 0, 0], scale: [1, 1, 1] },
      light: { power: 0.42, beam: 28, modifier: 'softbox', modifierSize: [0.6, 0.6] },
    },
    {
      id: 'cam1',
      type: 'camera',
      visible: true,
      userData: {},
      transform: { position: [2.6, 1.4, 1.2], rotation: [0, 0, 0], scale: [1, 1, 1] },
      camera: { sensor: [36, 24], focalLength: 50, aperture: 2.8, iso: 100, shutter: 1 / 125 },
    },
    {
      id: 'model1',
      type: 'model',
      visible: true,
      userData: {},
      transform: { position: [0, 1.7, 1.2], rotation: [0, 0, 0], scale: [1, 1, 1] },
    },
  ],
  selection: ['soft1'],
  environment: { room: { size: [10, 6, 3], wallColor: '#ffffff', floorColor: '#eeeeee' } },
  units: 'metric',
};

function commit(prev: Scene, next: Scene, set: any) {
  set((s: AppState) => ({ scene: next, past: [...s.past, prev], future: [] }));
}

export const useAppStore = create<AppState>((set, get) => ({
  scene: initialScene,
  past: [],
  future: [],

  measurements: [],
  measureMode: false,
  showLightCones: false,
  showStudioGuides: true,
  studioGuideSettings: {
    showDistanceGuides: true,
    showAngleGuides: true,
    showPositionMarkers: true,
    showGridOverlay: true,
    subjectPosition: [0, 0, 0] as [number, number, number],
    backgroundDistance: 2.5,
    keyLightDistance: 1.5,
    keyLightAngle: 45,
    keyLightHeight: 2.0,
    fillDistance: 1.0,
    cameraDistance: 3,
    shootType: 'headshot' as const,
  },

  advancedGuideSettings: {
    composition: { enabled: false, guides: ['rule_of_thirds'], color: '#00ff88', opacity: 0.5 },
    lighting: { enabled: false, showShadowDirection: true, showLightFalloff: true, showCatchlightPreview: true, showLightingRatio: true, showReflectorBounce: false },
    depthOfField: { enabled: false, showFocusPlane: true, showInFocusZone: true, showHyperfocalDistance: false, showNearFarLimits: true },
    videoProduction: { enabled: false, showTitleSafe: true, showActionSafe: true, showAspectRatioMask: false, showCenterMarkers: true, aspectRatio: '16:9' },
    heightReferences: { enabled: false, showSubjectHeights: true, showCameraHeights: true, showLightHeights: true, showBackgroundHeight: true },
    safetySpacing: { enabled: false, showEquipmentClearance: true, showCableRoutes: true, showMovementZones: true, showHotLightWarning: false },
    colorExposure: { enabled: false, showColorTemperatureScale: true, showGrayCardPosition: true, showExposureZones: true, showColorCheckerPosition: false },
    glassesReflection: { enabled: false, headTiltAngle: 0, glassesAngle: 12 },
  },

  ...(typeof window !== 'undefined'
    ? (() => {
        window.addEventListener('ch-add-asset-at', ((e: any) => {
          const { asset, position } = e.detail || {};
          if (!asset || !position) return;
          const s = useAppStore.getState();
          const id = 'node_' + Math.random().toString(36).slice(2, 8);
          const node: any = {
            id,
            name: asset.title,
            type: asset.type,
            transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
            visible: true,
            // Preserve all userData from the asset
            userData: {
              ...asset.data?.userData,
            },
          };
          
          // Handle light type - add light node with 3D model config
          if (asset.type === 'light') {
            node.light = {
              power: asset.data?.light?.power ?? 0.5,
              cct: asset.data?.light?.cct ?? 5600,
              beam: asset.data?.light?.beam ?? 60,
              modifier: asset.data?.light?.modifier,
              modifierSize: asset.data?.light?.modifierSize,
            };
            
            // Add 3D model configuration for procedural/GLB rendering
            if (asset.data?.model3d) {
              node.model3d = {
                type: asset.data.model3d.type || 'procedural',
                proceduralType: asset.data.model3d.proceduralType || 'studio_light',
                brandStyle: asset.data.model3d.brandStyle || 'generic',
                modifierModelUrl: asset.data.model3d.modifierModelUrl,
              };
            }
            
            applyLibraryPreset(node, asset);
          }
          
          // Handle model type
          if (asset.type === 'model') {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'store.ts:238',message:'Adding model asset to scene',data:{assetId:asset.id,assetTitle:asset.title,hasModelUrl:!!asset.data?.modelUrl,modelUrl:asset.data?.modelUrl,position},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            node.model = {
              kind: 'builtin',
              height: asset.data?.height ?? 1.75,
              url: asset.data?.modelUrl,
            };
            // Also store in userData for compatibility with SceneNodes component
            if (asset.data?.modelUrl) {
              node.userData = {
                ...node.userData,
                modelUrl: asset.data.modelUrl,
              };
            }
          }
          
          // Handle camera type - add camera node with 3D model config
          if (asset.type === 'camera') {
            node.camera = {
              sensor: asset.data?.camera?.sensor ?? [36, 24], // Full-frame default
              focalLength: asset.data?.camera?.focalLength ?? 50,
              aperture: asset.data?.camera?.aperture ?? 2.8,
              iso: asset.data?.camera?.iso ?? 100,
              shutter: asset.data?.camera?.shutter ?? 1 / 125,
            };
            
            // Add 3D model configuration for procedural/GLB rendering
            if (asset.data?.model3d) {
              node.model3d = {
                type: asset.data.model3d.type || 'procedural',
                proceduralType: asset.data.model3d.proceduralType || 'camera',
                modelUrl: asset.data.model3d.modelUrl,
              };
            }
          }
          
          const nodes = [...s.scene.nodes, node];
          useAppStore.setState({ scene: { ...s.scene, nodes }, selection: [id] });
        }) as any);
        return {};
      })()
    : {}),
  ...(typeof window !== 'undefined'
    ? (() => {
        window.addEventListener('ch-add-asset', ((e: any) => {
          const { asset } = e.detail || {};
          if (!asset) return;
          const s = useAppStore.getState();
          const id = 'node_' + Math.random().toString(36).slice(2, 8);
          const pos: [number, number, number] = [
            (Math.random() * 2 - 1) * 2,
            0,
            (Math.random() * 2 - 1) * 2,
          ];
          const node: any = {
            id,
            name: asset.title,
            type: asset.type,
            transform: { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1] },
            visible: true,
          };
          if (asset.type === 'light') {
            node.light = {
              power: asset.data?.light?.power ?? 0.5,
              cct: asset.data?.light?.cct ?? 5600,
              beam: asset.data?.light?.beam ?? 60,
              modifier: asset.data?.light?.modifier,
            };
            applyLibraryPreset(node, asset);
          }
          if (asset.type === 'model') {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'store.ts:310',message:'Adding model via ch-add-asset',data:{assetId:asset.id,assetTitle:asset.title,hasDataModelUrl:!!asset.data?.modelUrl,modelUrl:asset.data?.modelUrl,hasModelUrl:!!asset.modelUrl,assetModelUrl:asset.modelUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            const modelUrl = asset.data?.modelUrl || asset.modelUrl;
            node.model = { 
              kind: 'builtin', 
              height: asset.data?.height ?? 1.75,
              url: modelUrl,
            };
            // Also set in userData for compatibility with SceneNodes.tsx
            if (modelUrl) {
              node.userData = {
                ...node.userData,
                modelUrl: modelUrl,
              };
            }
          }
          // Handle camera type
          if (asset.type === 'camera') {
            node.camera = {
              sensor: asset.data?.camera?.sensor ?? [36, 24],
              focalLength: asset.data?.camera?.focalLength ?? 50,
              aperture: asset.data?.camera?.aperture ?? 2.8,
              iso: asset.data?.camera?.iso ?? 100,
              shutter: asset.data?.camera?.shutter ?? 1 / 125,
            };
            node.userData = {
              ...node.userData,
              brand: asset.data?.userData?.brand,
              model: asset.data?.userData?.model,
              equipmentId: asset.data?.userData?.equipmentId,
              realEquipment: asset.data?.userData?.realEquipment ?? false,
            };
          }
          const nodes = [...s.scene.nodes, node];
          useAppStore.setState({ scene: { ...s.scene, nodes }, selection: [id] });
        }) as any);
        return {};
      })()
    : {}),

  // wire window event updates for measurement edits
  ...(typeof window !=='undefined'
    ? (() => {
        window.addEventListener('ch-measure-update', ((e: any) => {
          const { id, name, color } = e.detail || {};
          const s = useAppStore.getState();
          const ms = s.measurements.map((m) =>
            m.id === id
              ? {
                  ...m,
                  ...(name !== undefined ? { name } : {}),
                  ...(color !== undefined ? { color } : {}),
                  label: (name ?? m.name) || m.label,
                }
              : m,
          );
          useAppStore.setState({ measurements: ms });
        }) as any);
        return {};
      })()
    : {}),

  addNode: (partial) => {
    const prev = get().scene;
    const next = addObject(prev, partial);
    commit(prev, next, set);
  },
  updateNode: (id, patch) => {
    const prev = get().scene;
    const next = updateObject(prev, id, patch);
    commit(prev, next, set);
  },
  transformNode: (id, t) => {
    const prev = get().scene;
    const next = transformObject(prev, id, t);
    commit(prev, next, set);
  },
  deleteNode: (id) => {
    const prev = get().scene;
    const next = deleteObject(prev, id);
    commit(prev, next, set);
  },
  select: (ids) => set((s) => ({ scene: { ...s.scene, selection: ids } })),
  undo: () => {
    const { past, scene, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ scene: prev, past: past.slice(0, -1), future: [scene, ...future] });
  },
  redo: () => {
    const { future, past, scene } = get();
    const nxt = future[0];
    if (!nxt) return;
    set({ scene: nxt, past: [...past, scene], future: future.slice(1) });
  },
  setScene: (s) => set({ scene: s }),
  toggleMeasureMode: () => set((s) => ({ measureMode: !s.measureMode })),
  toggleLightCones: () => set((s) => ({ showLightCones: !s.showLightCones })),
  toggleStudioGuides: () => set((s) => ({ showStudioGuides: !s.showStudioGuides })),
  updateStudioGuideSettings: (settings) => set((s) => ({
    studioGuideSettings: { ...s.studioGuideSettings, ...settings },
  })),
  updateAdvancedGuideSettings: (settings) => set((s) => ({
    advancedGuideSettings: { ...s.advancedGuideSettings, ...settings },
  })),
  addMeasurementPoints: (a, b, label) =>
    set((s: AppState) => ({
      measurements: [...s.measurements, { id: `m-${Date.now().toString(36)}`, a, b, label }],
    })),
  addMeasurementBetween: (aId, bId, label) =>
    set((s: AppState) => {
      const A = s.scene.nodes.find((n) => n.id === aId);
      const B = s.scene.nodes.find((n) => n.id === bId);
      if (!A || !B) return {};
      const a: [number, number] = [A.transform.position[0], A.transform.position[2]];
      const b: [number, number] = [B.transform.position[0], B.transform.position[2]];
      return {
        measurements: [...s.measurements, { id: `m-${Date.now().toString(36)}`, a, b, label }],
      };
    }),
  removeMeasurement: (id) =>
    set((s: AppState) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
}));
