import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SCENE, DEFAULT_CAMERA, DEFAULT_ACTOR, DEFAULT_PROP, LENS_FOV_MAP, ShotType, CameraHeight, CameraAngleType, CameraMovement, calculateFocusFromFocalLength, getFocalLengthFromLensType, type Scene2D, type Camera2D, type Actor2D, type Prop2D, type Shot2D, type Point2D, type PlannerTool, type SelectionState, type SceneViewport, type LensType, type HistoryEntry } from "./types";
import { shotPlannerApi } from "./api";

// =============================================================================
// Store State Interface
// =============================================================================

interface ShotPlannerState {
  // Current scene
  scene: Scene2D | null;
  scenes: Scene2D[];
  
  // Tool state
  activeTool: PlannerTool;
  
  // Selection
  selection: SelectionState;
  
  // History
  history: HistoryEntry[];
  historyIndex: number;
  maxHistory: number;
  
  // UI state
  showAssetLibrary: boolean;
  showCameraSettings: boolean;
  showShotList: boolean;
  sidebarTab: 'shots' | 'assets' | 'settings';
  
  // Clipboard
  clipboard: (Camera2D | Actor2D | Prop2D)[] | null;
  
  // Sync state
  isSyncing: boolean;
}

interface ShotPlannerActions {
  // Scene management
  createScene: (name: string, location?: string) => Promise<string>;
  loadScene: (sceneId: string) => void;
  loadDemoScene: (scene: Scene2D) => void;
  updateScene: (updates: Partial<Scene2D>) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  syncScenes: () => Promise<void>;
  
  // Camera management
  addCamera: (position: Point2D, name?: string) => string;
  updateCamera: (cameraId: string, updates: Partial<Camera2D>) => void;
  deleteCamera: (cameraId: string) => void;
  selectCamera: (cameraId: string) => void;
  
  // Actor management
  addActor: (position: Point2D, name?: string) => string;
  updateActor: (actorId: string, updates: Partial<Actor2D>) => void;
  deleteActor: (actorId: string) => void;
  
  // Prop management
  addProp: (position: Point2D, name?: string, category?: string) => string;
  updateProp: (propId: string, updates: Partial<Prop2D>) => void;
  deleteProp: (propId: string) => void;
  
  // Shot management
  addShot: (cameraId: string) => string;
  updateShot: (shotId: string, updates: Partial<Shot2D>) => void;
  deleteShot: (shotId: string) => void;
  selectShot: (shotId: string | null) => void;
  reorderShots: (startIndex: number, endIndex: number) => void;
  generateShotThumbnail: (shotId: string) => Promise<string | null>;
  addMeasurementLine: (shotId: string, start: Point2D, end: Point2D, label?: string) => void;
  deleteMeasurementLine: (shotId: string, lineId: string) => void;
  
  // Export functions
  exportAsPNG: (canvas: HTMLCanvasElement) => Promise<Blob | null>;
  exportAsPDF: (filename?: string) => Promise<void>;
  exportShotCallsheet: (format: 'pdf' | 'csv') => Promise<Blob | null>;
  
  // Visualization toggles
  toggleVisualization: (key: 'showFrustums' | 'showMotionPaths' | 'showMeasurements' | 'show180Line') => void;
  
  // Selection
  setSelection: (ids: string[], type: SelectionState['selectionType']) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  // Tool
  setActiveTool: (tool: PlannerTool) => void;
  
  // Viewport
  setViewport: (viewport: Partial<SceneViewport>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  fitToContent: () => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: (action: string) => void;
  
  // Clipboard
  copy: () => void;
  paste: (position: Point2D) => void;
  duplicate: () => void;
  
  // UI
  toggleAssetLibrary: () => void;
  toggleCameraSettings: () => void;
  toggleShotList: () => void;
  setSidebarTab: (tab: 'shots' | 'assets' | 'settings') => void;
  
  // Bulk operations
  deleteSelected: () => void;
  lockSelected: () => void;
  unlockSelected: () => void;
  
  // Import/Export
  exportScene: () => string;
  importScene: (json: string) => void;
}

type ShotPlannerStore = ShotPlannerState & ShotPlannerActions;

// =============================================================================
// Helper Functions
// =============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getNextCameraName = (cameras: Camera2D[]): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const usedLetters = new Set(cameras.map(c => c.name.replace('Cam ', '')));
  for (const letter of letters) {
    if (!usedLetters.has(letter)) {
      return `Cam ${letter}`;
    }
  }
  return `Cam ${cameras.length + 1}`;
};

const getNextActorName = (actors: Actor2D[]): string => {
  return `Actor ${actors.length + 1}`;
};

const getNextShotNumber = (shots: Shot2D[]): number => {
  if (shots.length === 0) return 1;
  return Math.max(...shots.map(s => s.number)) + 1;
};

// =============================================================================
// Store Implementation
// =============================================================================

export const useShotPlannerStore = create<ShotPlannerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      scene: null,
      scenes: [],
      activeTool: 'select',
      selection: {
        selectedIds: [],
        selectionType: null,
        selectionBounds: null,
      },
      history: [],
      historyIndex: -1,
      maxHistory: 50,
      showAssetLibrary: true,
      showCameraSettings: true,
      showShotList: true,
      sidebarTab: 'shots',
      clipboard: null,
      isSyncing: false,

      // Scene management
      createScene: async (name, location = '') => {
        const id = generateId();
        const newScene: Scene2D = {
          ...DEFAULT_SCENE,
          id,
          name,
          location,
        };
        
        set(state => ({
          scenes: [...state.scenes, newScene],
          scene: newScene,
        }));
        
        // Save to database
        await shotPlannerApi.saveScene(newScene);
        
        get().saveToHistory('Create scene');
        return id;
      },

      loadScene: (sceneId) => {
        const scene = get().scenes.find(s => s.id === sceneId);
        if (scene) {
          set({ scene, selection: { selectedIds: [], selectionType: null, selectionBounds: null } });
        }
      },

      loadDemoScene: async (demoScene) => {
        set(state => ({
          scenes: [...state.scenes, demoScene],
          scene: demoScene,
          selection: { selectedIds: [], selectionType: null, selectionBounds: null },
        }));
        
        // Save to database
        await shotPlannerApi.saveScene(demoScene);
      },

      updateScene: async (updates) => {
        let updatedScene: Scene2D | null = null;
        
        set(state => {
          if (!state.scene) return state;
          updatedScene = { ...state.scene, ...updates };
          return {
            scene: updatedScene,
            scenes: state.scenes.map(s => s.id === updatedScene!.id ? updatedScene! : s),
          };
        });
        
        // Save to database
        if (updatedScene) {
          await shotPlannerApi.saveScene(updatedScene);
        }
      },

      deleteScene: async (sceneId) => {
        set(state => ({
          scenes: state.scenes.filter(s => s.id !== sceneId),
          scene: state.scene?.id === sceneId ? null : state.scene,
        }));
        
        // Delete from database
        await shotPlannerApi.deleteScene(sceneId);
      },

      syncScenes: async () => {
        set({ isSyncing: true });
        try {
          const scenes = await shotPlannerApi.getScenes();
          set({ scenes, isSyncing: false });
        } catch (error) {
          console.error('Failed to sync scenes:', error);
          set({ isSyncing: false });
        }
      },

      // Camera management
      addCamera: (position, name) => {
        const state = get();
        if (!state.scene) return '';
        
        const id = generateId();
        const cameraName = name || getNextCameraName(state.scene.cameras);
        const colorIndex = state.scene.cameras.length % 8;
        const colors = ['#4FC3F7', '#81C784', '#FFD54F', '#FFB74D', '#E57373', '#BA68C8', '#4DD0E1', '#F06292'];
        
        // Calculate cinematography-accurate focus distance based on default lens
        const defaultLens = DEFAULT_CAMERA.lens;
        const focalLength = getFocalLengthFromLensType(defaultLens);
        const { focusDistance, depthOfField } = calculateFocusFromFocalLength(focalLength);
        
        const newCamera: Camera2D = {
          ...DEFAULT_CAMERA,
          id,
          name: cameraName,
          label: cameraName,
          position,
          color: colors[colorIndex],
          focusDistance, // Set cinematographically correct focus
          depthOfField,  // Set appropriate depth of field
        };
        
        set(state => ({
          scene: state.scene ? {
            ...state.scene,
            cameras: [...state.scene.cameras, newCamera],
          } : null,
        }));
        
        get().saveToHistory(`Add camera ${cameraName}`);
        return id;
      },

      updateCamera: (cameraId, updates) => {
        set(state => {
          if (!state.scene) return state;
          
          // Update FOV and focus if lens changes
          let finalUpdates = { ...updates };
          if (updates.lens) {
            const focalLength = getFocalLengthFromLensType(updates.lens);
            const { focusDistance, depthOfField } = calculateFocusFromFocalLength(focalLength);
            
            finalUpdates = {
              ...finalUpdates,
              frustum: {
                ...state.scene.cameras.find(c => c.id === cameraId)?.frustum,
                fov: LENS_FOV_MAP[updates.lens as LensType],
              } as Camera2D['frustum'],
              focusDistance, // Update focus for new focal length
              depthOfField,  // Update depth of field for new focal length
            };
          }
          
          return {
            scene: {
              ...state.scene,
              cameras: state.scene.cameras.map(c =>
                c.id === cameraId ? { ...c, ...finalUpdates } : c
              ),
            },
          };
        });
      },

      deleteCamera: (cameraId) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              cameras: state.scene.cameras.filter(c => c.id !== cameraId),
              shots: state.scene.shots.filter(s => s.cameraId !== cameraId),
            },
            selection: {
              ...state.selection,
              selectedIds: state.selection.selectedIds.filter(id => id !== cameraId),
            },
          };
        });
        get().saveToHistory('Delete camera');
      },

      selectCamera: (cameraId) => {
        set(state => ({
          selection: {
            selectedIds: [cameraId],
            selectionType: 'camera',
            selectionBounds: null,
          },
        }));
      },

      // Actor management
      addActor: (position, name) => {
        const state = get();
        if (!state.scene) return '';
        
        const id = generateId();
        const actorName = name || getNextActorName(state.scene.actors);
        
        const newActor: Actor2D = {
          ...DEFAULT_ACTOR,
          id,
          name: actorName,
          position,
        };
        
        set(state => ({
          scene: state.scene ? {
            ...state.scene,
            actors: [...state.scene.actors, newActor],
          } : null,
        }));
        
        get().saveToHistory(`Add actor ${actorName}`);
        return id;
      },

      updateActor: (actorId, updates) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              actors: state.scene.actors.map(a =>
                a.id === actorId ? { ...a, ...updates } : a
              ),
            },
          };
        });
      },

      deleteActor: (actorId) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              actors: state.scene.actors.filter(a => a.id !== actorId),
            },
            selection: {
              ...state.selection,
              selectedIds: state.selection.selectedIds.filter(id => id !== actorId),
            },
          };
        });
        get().saveToHistory('Delete actor');
      },

      // Prop management
      addProp: (position, name, category) => {
        const state = get();
        if (!state.scene) return '';
        
        const id = generateId();
        const propName = name || `Prop ${state.scene.props.length + 1}`;
        
        const newProp: Prop2D = {
          ...DEFAULT_PROP,
          id,
          name: propName,
          position,
          category: (category as Prop2D['category']) || 'Furniture',
        };
        
        set(state => ({
          scene: state.scene ? {
            ...state.scene,
            props: [...state.scene.props, newProp],
          } : null,
        }));
        
        get().saveToHistory(`Add prop ${propName}`);
        return id;
      },

      updateProp: (propId, updates) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              props: state.scene.props.map(p =>
                p.id === propId ? { ...p, ...updates } : p
              ),
            },
          };
        });
      },

      deleteProp: (propId) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              props: state.scene.props.filter(p => p.id !== propId),
            },
            selection: {
              ...state.selection,
              selectedIds: state.selection.selectedIds.filter(id => id !== propId),
            },
          };
        });
        get().saveToHistory('Delete prop');
      },

      // Shot management
      addShot: (cameraId) => {
        const state = get();
        if (!state.scene) return '';
        
        const camera = state.scene.cameras.find(c => c.id === cameraId);
        if (!camera) return '';
        
        const id = generateId();
        const shotNumber = getNextShotNumber(state.scene.shots);
        
        const newShot: Shot2D = {
          id,
          number: shotNumber,
          name: `Shot ${String(shotNumber).padStart(2, '0')}`,
          description: '',
          cameraId,
          shotType: camera.shotType,
          lens: camera.lens,
          height: camera.height,
          angle: camera.angle,
          movement: camera.movement,
          framingGuide: {
            type: 'rule-of-thirds',
            visible: true,
            opacity: 0.5,
          },
          subjectActorIds: [],
          status: 'Planned',
        };
        
        set(state => ({
          scene: state.scene ? {
            ...state.scene,
            shots: [...state.scene.shots, newShot],
          } : null,
        }));
        
        get().saveToHistory(`Add shot ${shotNumber}`);
        return id;
      },

      updateShot: (shotId, updates) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              shots: state.scene.shots.map(s =>
                s.id === shotId ? { ...s, ...updates } : s
              ),
            },
          };
        });
      },

      deleteShot: (shotId) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              shots: state.scene.shots.filter(s => s.id !== shotId),
              activeShotId: state.scene.activeShotId === shotId ? null : state.scene.activeShotId,
            },
          };
        });
        get().saveToHistory('Delete shot');
      },

      generateShotThumbnail: async (shotId) => {
        const state = get();
        if (!state.scene) return null;
        
        const shot = state.scene.shots.find(s => s.id === shotId);
        const camera = state.scene.cameras.find(c => c.id === shot?.cameraId);
        if (!shot || !camera) return null;
        
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          
          ctx.fillStyle = '#0A1929';
          ctx.fillRect(0, 0, 320, 180);
          
          ctx.save();
          ctx.translate(160, 90);
          ctx.rotate(-camera.rotation * Math.PI / 180);
          
          state.scene.actors.forEach(actor => {
            const dx = actor.position.x - camera.position.x;
            const dy = actor.position.y - camera.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 500) {
              ctx.fillStyle = actor.color;
              ctx.beginPath();
              ctx.arc(dx / 3, dy / 3, 10, 0, Math.PI * 2);
              ctx.fill();
            }
          });
          
          ctx.restore();
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, 0, 320, 30);
          ctx.fillStyle = '#fff';
          ctx.font = '12px Inter, system-ui';
          ctx.fillText(`${shot.name} - ${shot.shotType}`, 10, 20);
          
          const dataUrl = canvas.toDataURL('image/png');
          get().updateShot(shotId, { thumbnailUrl: dataUrl });
          
          return dataUrl;
        } catch (error) {
          console.error('Error generating shot thumbnail:', error);
          return null;
        }
      },

      selectShot: (shotId) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              activeShotId: shotId,
            },
          };
        });
      },

      reorderShots: (startIndex, endIndex) => {
        set(state => {
          if (!state.scene) return state;
          const shots = [...state.scene.shots];
          const [removed] = shots.splice(startIndex, 1);
          shots.splice(endIndex, 0, removed);
          
          // Renumber shots
          const renumbered = shots.map((shot, index) => ({
            ...shot,
            number: index + 1,
            name: `Shot ${String(index + 1).padStart(2, '0')}`,
          }));
          
          return {
            scene: {
              ...state.scene,
              shots: renumbered,
            },
          };
        });
        get().saveToHistory('Reorder shots');
      },

      addMeasurementLine: (shotId, start, end, label) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              shots: state.scene.shots.map(shot => {
                if (shot.id === shotId) {
                  return {
                    ...shot,
                    measurementLines: [
                      ...(shot.measurementLines || []),
                      {
                        id: `measure-${Date.now()}`,
                        start,
                        end,
                        label: label || 'Measurement',
                      },
                    ],
                  };
                }
                return shot;
              }),
            },
          };
        });
        get().saveToHistory('Add measurement');
      },

      deleteMeasurementLine: (shotId, lineId) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              shots: state.scene.shots.map(shot => {
                if (shot.id === shotId) {
                  return {
                    ...shot,
                    measurementLines: (shot.measurementLines || []).filter(
                      line => line.id !== lineId
                    ),
                  };
                }
                return shot;
              }),
            },
          };
        });
        get().saveToHistory('Delete measurement');
      },

      // Export functions
      exportAsPNG: async (canvas) => {
        try {
          return new Promise((resolve) => {
            canvas.toBlob(blob => {
              resolve(blob);
            }, 'image/png');
          });
        } catch (error) {
          console.error('PNG export failed:', error);
          return null;
        }
      },

      exportAsPDF: async (filename = 'shot-planner.pdf') => {
        try {
          // Dynamically import jsPDF to avoid bundling if not used
          const { jsPDF } = await import('jspdf');
          const state = get();
          
          if (!state.scene) return;

          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
          });

          let yPos = 10;
          const pageHeight = pdf.internal.pageSize.height;
          const margin = 10;

          // Title
          pdf.setFontSize(16);
          pdf.text('Shot Plan - Scene Overview', margin, yPos);
          yPos += 10;

          // Scene info
          pdf.setFontSize(10);
          pdf.text(`Scene: ${state.scene.name}`, margin, yPos);
          yPos += 5;
          pdf.text(`Total Shots: ${state.scene.shots.length}`, margin, yPos);
          yPos += 10;

          // Shot list table
          const shots = state.scene.shots.slice(0, 10); // Limit to 10 per PDF
          const camera = state.scene.cameras[0];
          
          shots.forEach((shot) => {
            if (yPos > pageHeight - 30) {
              pdf.addPage();
              yPos = 10;
            }

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Shot ${shot.number}: ${shot.name}`, margin, yPos);
            yPos += 5;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            
            const details = [
              `Type: ${shot.shotType} | ${shot.lens}`,
              `Status: ${shot.status}`,
              `Notes: ${shot.directorNotes || 'None'}`,
            ];

            details.forEach(detail => {
              pdf.text(detail, margin + 5, yPos);
              yPos += 4;
            });

            yPos += 3;
          });

          // Save PDF
          pdf.save(filename);
        } catch (error) {
          console.error('PDF export failed:', error);
        }
      },

      exportShotCallsheet: async (format = 'csv') => {
        try {
          const state = get();
          if (!state.scene) return null;

          if (format === 'csv') {
            // Generate CSV
            const headers = [
              'Shot #',
              'Name',
              'Type',
              'Lens',
              'Status',
              'Notes',
            ];

            const rows = state.scene.shots.map(shot => [
              shot.number,
              shot.name,
              shot.shotType,
              shot.lens,
              shot.status,
              shot.directorNotes || '',
            ]);

            const csvContent = [
              headers.join(','),
              ...rows.map(row =>
                row.map(cell => `"${cell}"`).join(',')
              ),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            return blob;
          } else {
            // PDF format
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF();

            pdf.setFontSize(14);
            pdf.text('Shot Callsheet', 10, 10);

            pdf.setFontSize(10);
            let yPos = 20;

            state.scene.shots.forEach((shot) => {
              pdf.text(`${shot.number}. ${shot.name}`, 10, yPos);
              yPos += 5;
              pdf.setFontSize(8);
              pdf.text(`Type: ${shot.shotType} | Lens: ${shot.lens}`, 15, yPos);
              yPos += 4;
              pdf.text(`Status: ${shot.status}`, 15, yPos);
              yPos += 6;
              pdf.setFontSize(10);

              if (yPos > 270) {
                pdf.addPage();
                yPos = 10;
              }
            });

            const blob = pdf.output('blob');
            return blob as Blob;
          }
        } catch (error) {
          console.error('Callsheet export failed:', error);
          return null;
        }
      },

      // Selection
      setSelection: (ids, type) => {
        set({
          selection: {
            selectedIds: ids,
            selectionType: type,
            selectionBounds: null,
          },
        });
      },

      clearSelection: () => {
        set({
          selection: {
            selectedIds: [],
            selectionType: null,
            selectionBounds: null,
          },
        });
      },

      selectAll: () => {
        const state = get();
        if (!state.scene) return;
        
        const allIds = [
          ...state.scene.cameras.map(c => c.id),
          ...state.scene.actors.map(a => a.id),
          ...state.scene.props.map(p => p.id),
        ];
        
        set({
          selection: {
            selectedIds: allIds,
            selectionType: 'mixed',
            selectionBounds: null,
          },
        });
      },

      // Tool
      setActiveTool: (tool) => {
        set({ activeTool: tool });
      },

      // Viewport
      setViewport: (viewport) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              viewport: { ...state.scene.viewport, ...viewport },
            },
          };
        });
      },

      zoomIn: () => {
        const state = get();
        if (!state.scene) return;
        const newZoom = Math.min(state.scene.viewport.zoom * 1.2, state.scene.viewport.maxZoom);
        get().setViewport({ zoom: newZoom });
      },

      zoomOut: () => {
        const state = get();
        if (!state.scene) return;
        const newZoom = Math.max(state.scene.viewport.zoom / 1.2, state.scene.viewport.minZoom);
        get().setViewport({ zoom: newZoom });
      },

      resetViewport: () => {
        get().setViewport({ offset: { x: 0, y: 0 }, zoom: 1 });
      },

      fitToContent: () => {
        // Implementation for fitting viewport to content
        get().setViewport({ offset: { x: 0, y: 0 }, zoom: 1 });
      },

      // History
      undo: () => {
        const state = get();
        if (state.historyIndex <= 0) return;
        
        const newIndex = state.historyIndex - 1;
        const entry = state.history[newIndex];
        
        if (entry && entry.state.cameras && entry.state.actors && entry.state.props) {
          set(s => ({
            historyIndex: newIndex,
            scene: s.scene ? {
              ...s.scene,
              cameras: entry.state.cameras!,
              actors: entry.state.actors!,
              props: entry.state.props!,
            } : null,
          }));
        }
      },

      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1) return;
        
        const newIndex = state.historyIndex + 1;
        const entry = state.history[newIndex];
        
        if (entry && entry.state.cameras && entry.state.actors && entry.state.props) {
          set(s => ({
            historyIndex: newIndex,
            scene: s.scene ? {
              ...s.scene,
              cameras: entry.state.cameras!,
              actors: entry.state.actors!,
              props: entry.state.props!,
            } : null,
          }));
        }
      },

      saveToHistory: (action) => {
        const state = get();
        if (!state.scene) return;
        
        const entry: HistoryEntry = {
          id: generateId(),
          timestamp: Date.now(),
          action,
          state: {
            cameras: [...state.scene.cameras],
            actors: [...state.scene.actors],
            props: [...state.scene.props],
          },
        };
        
        // Remove any redo history
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(entry);
        
        // Limit history length
        if (newHistory.length > state.maxHistory) {
          newHistory.shift();
        }
        
        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      // Clipboard
      copy: () => {
        const state = get();
        if (!state.scene || state.selection.selectedIds.length === 0) return;
        
        const items: (Camera2D | Actor2D | Prop2D)[] = [];
        
        for (const id of state.selection.selectedIds) {
          const camera = state.scene.cameras.find(c => c.id === id);
          if (camera) items.push({ ...camera });
          
          const actor = state.scene.actors.find(a => a.id === id);
          if (actor) items.push({ ...actor });
          
          const prop = state.scene.props.find(p => p.id === id);
          if (prop) items.push({ ...prop });
        }
        
        set({ clipboard: items });
      },

      paste: (position) => {
        const state = get();
        if (!state.clipboard || state.clipboard.length === 0) return;
        
        for (const item of state.clipboard) {
          const offset = {
            x: position.x - item.position.x,
            y: position.y - item.position.y,
          };
          
          if ('frustum' in item) {
            // Camera
            get().addCamera({ x: item.position.x + offset.x + 20, y: item.position.y + offset.y + 20 });
          } else if ('pose' in item) {
            // Actor
            get().addActor({ x: item.position.x + offset.x + 20, y: item.position.y + offset.y + 20 });
          } else {
            // Prop
            get().addProp({ x: item.position.x + offset.x + 20, y: item.position.y + offset.y + 20 });
          }
        }
      },

      duplicate: () => {
        const state = get();
        if (!state.scene || state.selection.selectedIds.length === 0) return;
        
        get().copy();
        if (state.clipboard && state.clipboard.length > 0) {
          get().paste(state.clipboard[0].position);
        }
      },

      // UI
      toggleAssetLibrary: () => set(s => ({ showAssetLibrary: !s.showAssetLibrary })),
      toggleCameraSettings: () => set(s => ({ showCameraSettings: !s.showCameraSettings })),
      toggleShotList: () => set(s => ({ showShotList: !s.showShotList })),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),

      // Visualization toggles
      toggleVisualization: (key) => {
        set(state => {
          if (!state.scene) return state;
          return {
            scene: {
              ...state.scene,
              [key]: !state.scene[key],
            },
          };
        });
      },

      // Bulk operations
      deleteSelected: () => {
        const state = get();
        if (!state.scene) return;
        
        for (const id of state.selection.selectedIds) {
          const camera = state.scene.cameras.find(c => c.id === id);
          if (camera) get().deleteCamera(id);
          
          const actor = state.scene.actors.find(a => a.id === id);
          if (actor) get().deleteActor(id);
          
          const prop = state.scene.props.find(p => p.id === id);
          if (prop) get().deleteProp(id);
        }
        
        get().clearSelection();
      },

      lockSelected: () => {
        const state = get();
        if (!state.scene) return;
        
        for (const id of state.selection.selectedIds) {
          get().updateCamera(id, { locked: true });
          get().updateActor(id, { locked: true });
          get().updateProp(id, { locked: true });
        }
      },

      unlockSelected: () => {
        const state = get();
        if (!state.scene) return;
        
        for (const id of state.selection.selectedIds) {
          get().updateCamera(id, { locked: false });
          get().updateActor(id, { locked: false });
          get().updateProp(id, { locked: false });
        }
      },

      // Import/Export
      exportScene: () => {
        const state = get();
        if (!state.scene) return '';
        return JSON.stringify(state.scene, null, 2);
      },

      importScene: (json) => {
        try {
          const scene = JSON.parse(json) as Scene2D;
          set(state => ({
            scenes: [...state.scenes, scene],
            scene,
          }));
        } catch (e) {
          console.error('Failed to import scene:', e);
        }
      },
    }),
    {
      name: 'shot-planner-storage',
      partialize: (state) => ({
        scenes: state.scenes,
      }),
    }
  )
);

// =============================================================================
// Selector Hooks
// =============================================================================

const EMPTY_CAMERAS: Camera2D[] = [];
const EMPTY_ACTORS: Actor2D[] = [];
const EMPTY_PROPS: Prop2D[] = [];
const EMPTY_SHOTS: Shot2D[] = [];

export const useCurrentScene = () => useShotPlannerStore(state => state.scene);
export const useScenes = () => useShotPlannerStore(state => state.scenes);
export const useActiveTool = () => useShotPlannerStore(state => state.activeTool);
export const useSelection = () => useShotPlannerStore(state => state.selection);
export const useCameras = () => useShotPlannerStore(state => state.scene?.cameras ?? EMPTY_CAMERAS);
export const useActors = () => useShotPlannerStore(state => state.scene?.actors ?? EMPTY_ACTORS);
export const useProps = () => useShotPlannerStore(state => state.scene?.props ?? EMPTY_PROPS);
export const useShots = () => useShotPlannerStore(state => state.scene?.shots ?? EMPTY_SHOTS);
export const useActiveShot = () => useShotPlannerStore(state => {
  if (!state.scene?.activeShotId) return null;
  return state.scene.shots.find(s => s.id === state.scene?.activeShotId) ?? null;
});

export const useSelectedCamera = () => useShotPlannerStore(state => {
  if (!state.scene || state.selection.selectionType !== 'camera') return null;
  return state.scene.cameras.find(c => state.selection.selectedIds.includes(c.id)) ?? null;
});
