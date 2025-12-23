/**
 * Hooks Index
 * 
 * Central export for all Virtual Studio hooks.
 */

// Director Mode
export { useDirectorMode } from './useDirectorMode';
export type { DirectorModeHookState, DirectorModeHookActions } from './useDirectorMode';

// Viewfinder
export { useViewfinder, ViewfinderProvider } from './useViewfinder';

// Flash Controller
export { useFlashController } from './useFlashController';

// Virtual Studio Integration
export { useVirtualStudioIntegration, exposeMasterIntegration } from './useVirtualStudioIntegration';

// Keyboard Shortcuts
export { useKeyboardShortcuts, SHORTCUT_REFERENCE } from './useKeyboardShortcuts';

// Project Manager
export { useProjectManager } from './useProjectManager';

// Studio Guides
export { useStudioGuides } from './useStudioGuides';

// Apple Pencil
export { useApplePencil } from './useApplePencil';

// Touch Gestures
export { useTouchGestures } from './useTouchGestures';

// Device Detection
export { useDeviceDetection } from './useDeviceDetection';

// Animations
export { 
  useEyeAnimation,
  useActorAnimation,
  useCatchlightAnimation,
  useGuideAnimation,
  useVirtualStudioAnimations,
} from'./useAnimations';

