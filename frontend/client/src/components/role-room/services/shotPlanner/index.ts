/**
 * Shot Planner Module Index
 * 
 * 2D Visual Shot Planning System
 * Exports all components, types, and utilities for the shot planner.
 */

// Types
export * from './types';

// Store
export {
  useShotPlannerStore,
  useCurrentScene,
  useScenes,
  useActiveTool,
  useSelection,
  useCameras,
  useActors,
  useProps,
  useShots,
  useActiveShot,
  useSelectedCamera,
} from './store';

// Asset Library
export {
  ASSET_LIBRARY,
  ALL_ASSETS,
  FURNITURE_ASSETS,
  PROP_ASSETS,
  VEHICLE_ASSETS,
  ACTOR_ASSETS,
  CAMERA_ASSETS,
  NATURE_ASSETS,
  ARCHITECTURAL_ASSETS,
  EQUIPMENT_ASSETS,
  ASSET_ICONS,
  searchAssets,
  getAssetsByType,
  getAssetsByCategory,
  getAssetCategories,
  getAssetById,
} from './assetLibrary';

// Vector Graphics
export * as VectorGraphics from './vectorGraphics';

// Demo Scenes
export { 
  createSafehouseScene,
  createBoardroomScene,
  createBedroomScene,
  createKitchenScene,
  createWarehouseScene,
  createRestaurantScene,
  createHospitalScene,
  DEMO_SCENES,
  SCENE_TEMPLATES,
} from './demoScenes';

// Components
export { ShotPlannerCanvas } from './ShotPlannerCanvas';
export { ShotListSidebar } from './ShotListSidebar';
export { CameraSettingsPanel } from './CameraSettingsPanel';
export { AssetLibraryPanel } from './AssetLibraryPanel';
export { ShotPlannerPanel } from './ShotPlannerPanel';

// Default export is the main panel
export { default } from './ShotPlannerPanel';
