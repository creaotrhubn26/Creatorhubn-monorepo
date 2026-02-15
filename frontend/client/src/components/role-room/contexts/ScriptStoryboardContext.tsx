/**
 * ScriptStoryboardContext - Syncs script position with storyboard frames
 * 
 * Provides shared state between ScreenplayEditor and StoryboardIntegrationView:
 * - Current scene/line position in script
 * - Active storyboard frame
 * - Bidirectional navigation (script → storyboard, storyboard → script)
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

// =============================================================================
// Types
// =============================================================================

export type FountainElement = 
  | 'scene_heading' | 'action' | 'character' | 'dialogue' 
  | 'parenthetical' | 'transition' | 'centered' | 'title_page'
  | 'section' | 'synopsis' | 'note' | 'boneyard' | 'page_break' 
  | 'dual_dialogue';

export interface ScriptPosition {
  lineNumber: number;
  column: number;
  element: FountainElement | null;
}

export interface SceneContext {
  sceneId: string;
  sceneNumber: number | string;
  sceneHeading: string;
  sceneType?: 'INT' | 'EXT' | 'INT/EXT' | 'I/E';
  location?: string;
  timeOfDay?: string;
  startLine: number;
  endLine: number;
}

export interface DialogueContext {
  characterName: string;
  dialogueText: string;
  parenthetical?: string;
  lineNumber: number;
}

export interface StoryboardFrameLink {
  frameId: string;
  frameIndex: number;
  sceneId: string;
  scriptLineRange: [number, number];
  shotDescription: string;
  dialogueCharacter?: string;
}

export interface ScriptStoryboardState {
  // Script position
  scriptPosition: ScriptPosition;
  currentScene: SceneContext | null;
  currentDialogue: DialogueContext | null;
  scenes: SceneContext[];
  
  // Storyboard state
  activeFrameId: string | null;
  activeFrameIndex: number;
  frameLinks: StoryboardFrameLink[];
  
  // Sync mode
  syncEnabled: boolean;
  autoScrollScript: boolean;
  autoScrollStoryboard: boolean;
  
  // Layout
  splitRatio: number; // 0-100, percentage for script pane
  scriptPaneCollapsed: boolean;
  storyboardPaneCollapsed: boolean;
}

export interface ScriptStoryboardActions {
  // Script navigation
  setScriptPosition: (position: ScriptPosition) => void;
  setCurrentScene: (scene: SceneContext | null) => void;
  setCurrentDialogue: (dialogue: DialogueContext | null) => void;
  setScenes: (scenes: SceneContext[]) => void;
  goToScriptLine: (lineNumber: number) => void;
  goToScene: (sceneId: string) => void;
  
  // Storyboard navigation
  setActiveFrame: (frameId: string | null, index: number) => void;
  goToFrameForLine: (lineNumber: number) => void;
  
  // Frame linking
  linkFrameToScript: (frameId: string, sceneId: string, lineRange: [number, number]) => void;
  unlinkFrame: (frameId: string) => void;
  updateFrameLink: (frameId: string, updates: Partial<StoryboardFrameLink>) => void;
  getFramesForScene: (sceneId: string) => StoryboardFrameLink[];
  getFrameForLine: (lineNumber: number) => StoryboardFrameLink | null;
  
  // Sync settings
  toggleSync: () => void;
  setAutoScrollScript: (enabled: boolean) => void;
  setAutoScrollStoryboard: (enabled: boolean) => void;
  
  // Layout
  setSplitRatio: (ratio: number) => void;
  toggleScriptPane: () => void;
  toggleStoryboardPane: () => void;
  resetLayout: () => void;
}

export interface ScriptStoryboardContextValue extends ScriptStoryboardState, ScriptStoryboardActions {}

// =============================================================================
// Default State
// =============================================================================

const DEFAULT_STATE: ScriptStoryboardState = {
  scriptPosition: { lineNumber: 1, column: 0, element: null },
  currentScene: null,
  currentDialogue: null,
  scenes: [],
  activeFrameId: null,
  activeFrameIndex: 0,
  frameLinks: [],
  syncEnabled: true,
  autoScrollScript: true,
  autoScrollStoryboard: true,
  splitRatio: 40, // 40% script, 60% storyboard
  scriptPaneCollapsed: false,
  storyboardPaneCollapsed: false,
};

// =============================================================================
// Context
// =============================================================================

const ScriptStoryboardContext = createContext<ScriptStoryboardContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export interface ScriptStoryboardProviderProps {
  children: ReactNode;
  initialState?: Partial<ScriptStoryboardState>;
  onScriptLineChange?: (lineNumber: number) => void;
  onFrameChange?: (frameId: string | null) => void;
  onSceneChange?: (scene: SceneContext | null) => void;
}

export const ScriptStoryboardProvider: React.FC<ScriptStoryboardProviderProps> = ({
  children,
  initialState = {},
  onScriptLineChange,
  onFrameChange,
  onSceneChange,
}) => {
  const [state, setState] = useState<ScriptStoryboardState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  // Script navigation
  const setScriptPosition = useCallback((position: ScriptPosition) => {
    setState(prev => {
      if (prev.scriptPosition.lineNumber !== position.lineNumber) {
        onScriptLineChange?.(position.lineNumber);
      }
      return { ...prev, scriptPosition: position };
    });
  }, [onScriptLineChange]);

  const setCurrentScene = useCallback((scene: SceneContext | null) => {
    setState(prev => {
      if (prev.currentScene?.sceneId !== scene?.sceneId) {
        onSceneChange?.(scene);
      }
      return { ...prev, currentScene: scene };
    });
  }, [onSceneChange]);

  const setCurrentDialogue = useCallback((dialogue: DialogueContext | null) => {
    setState(prev => ({ ...prev, currentDialogue: dialogue }));
  }, []);

  const setScenes = useCallback((scenes: SceneContext[]) => {
    setState(prev => ({ ...prev, scenes }));
  }, []);

  const goToScriptLine = useCallback((lineNumber: number) => {
    setState(prev => ({
      ...prev,
      scriptPosition: { ...prev.scriptPosition, lineNumber },
    }));
    onScriptLineChange?.(lineNumber);
  }, [onScriptLineChange]);

  const goToScene = useCallback((sceneId: string) => {
    setState(prev => {
      const scene = prev.scenes.find(s => s.sceneId === sceneId);
      if (scene) {
        onScriptLineChange?.(scene.startLine);
        onSceneChange?.(scene);
        return {
          ...prev,
          currentScene: scene,
          scriptPosition: { ...prev.scriptPosition, lineNumber: scene.startLine },
        };
      }
      return prev;
    });
  }, [onScriptLineChange, onSceneChange]);

  // Storyboard navigation
  const setActiveFrame = useCallback((frameId: string | null, index: number) => {
    setState(prev => {
      onFrameChange?.(frameId);
      
      // Auto-scroll script if enabled
      if (prev.syncEnabled && prev.autoScrollScript && frameId) {
        const link = prev.frameLinks.find(l => l.frameId === frameId);
        if (link) {
          onScriptLineChange?.(link.scriptLineRange[0]);
        }
      }
      
      return { ...prev, activeFrameId: frameId, activeFrameIndex: index };
    });
  }, [onFrameChange, onScriptLineChange]);

  const goToFrameForLine = useCallback((lineNumber: number) => {
    setState(prev => {
      const link = prev.frameLinks.find(
        l => lineNumber >= l.scriptLineRange[0] && lineNumber <= l.scriptLineRange[1]
      );
      if (link) {
        onFrameChange?.(link.frameId);
        return {
          ...prev,
          activeFrameId: link.frameId,
          activeFrameIndex: link.frameIndex,
        };
      }
      return prev;
    });
  }, [onFrameChange]);

  // Frame linking
  const linkFrameToScript = useCallback((
    frameId: string,
    sceneId: string,
    lineRange: [number, number]
  ) => {
    setState(prev => {
      const existingIndex = prev.frameLinks.findIndex(l => l.frameId === frameId);
      const newLink: StoryboardFrameLink = {
        frameId,
        frameIndex: existingIndex >= 0 ? prev.frameLinks[existingIndex].frameIndex : prev.frameLinks.length,
        sceneId,
        scriptLineRange: lineRange,
        shotDescription: '',
      };
      
      if (existingIndex >= 0) {
        const newLinks = [...prev.frameLinks];
        newLinks[existingIndex] = { ...newLinks[existingIndex], ...newLink };
        return { ...prev, frameLinks: newLinks };
      }
      
      return { ...prev, frameLinks: [...prev.frameLinks, newLink] };
    });
  }, []);

  const unlinkFrame = useCallback((frameId: string) => {
    setState(prev => ({
      ...prev,
      frameLinks: prev.frameLinks.filter(l => l.frameId !== frameId),
    }));
  }, []);

  const updateFrameLink = useCallback((frameId: string, updates: Partial<StoryboardFrameLink>) => {
    setState(prev => ({
      ...prev,
      frameLinks: prev.frameLinks.map(l =>
        l.frameId === frameId ? { ...l, ...updates } : l
      ),
    }));
  }, []);

  const getFramesForScene = useCallback((sceneId: string) => {
    return state.frameLinks.filter(l => l.sceneId === sceneId);
  }, [state.frameLinks]);

  const getFrameForLine = useCallback((lineNumber: number) => {
    return state.frameLinks.find(
      l => lineNumber >= l.scriptLineRange[0] && lineNumber <= l.scriptLineRange[1]
    ) || null;
  }, [state.frameLinks]);

  // Sync settings
  const toggleSync = useCallback(() => {
    setState(prev => ({ ...prev, syncEnabled: !prev.syncEnabled }));
  }, []);

  const setAutoScrollScript = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, autoScrollScript: enabled }));
  }, []);

  const setAutoScrollStoryboard = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, autoScrollStoryboard: enabled }));
  }, []);

  // Layout
  const setSplitRatio = useCallback((ratio: number) => {
    setState(prev => ({ ...prev, splitRatio: Math.max(20, Math.min(80, ratio)) }));
  }, []);

  const toggleScriptPane = useCallback(() => {
    setState(prev => ({ ...prev, scriptPaneCollapsed: !prev.scriptPaneCollapsed }));
  }, []);

  const toggleStoryboardPane = useCallback(() => {
    setState(prev => ({ ...prev, storyboardPaneCollapsed: !prev.storyboardPaneCollapsed }));
  }, []);

  const resetLayout = useCallback(() => {
    setState(prev => ({
      ...prev,
      splitRatio: 40,
      scriptPaneCollapsed: false,
      storyboardPaneCollapsed: false,
    }));
  }, []);

  // Memoized context value
  const value = useMemo<ScriptStoryboardContextValue>(() => ({
    ...state,
    setScriptPosition,
    setCurrentScene,
    setCurrentDialogue,
    setScenes,
    goToScriptLine,
    goToScene,
    setActiveFrame,
    goToFrameForLine,
    linkFrameToScript,
    unlinkFrame,
    updateFrameLink,
    getFramesForScene,
    getFrameForLine,
    toggleSync,
    setAutoScrollScript,
    setAutoScrollStoryboard,
    setSplitRatio,
    toggleScriptPane,
    toggleStoryboardPane,
    resetLayout,
  }), [
    state,
    setScriptPosition,
    setCurrentScene,
    setCurrentDialogue,
    setScenes,
    goToScriptLine,
    goToScene,
    setActiveFrame,
    goToFrameForLine,
    linkFrameToScript,
    unlinkFrame,
    updateFrameLink,
    getFramesForScene,
    getFrameForLine,
    toggleSync,
    setAutoScrollScript,
    setAutoScrollStoryboard,
    setSplitRatio,
    toggleScriptPane,
    toggleStoryboardPane,
    resetLayout,
  ]);

  return (
    <ScriptStoryboardContext.Provider value={value}>
      {children}
    </ScriptStoryboardContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

export const useScriptStoryboard = (): ScriptStoryboardContextValue => {
  const context = useContext(ScriptStoryboardContext);
  if (!context) {
    throw new Error('useScriptStoryboard must be used within a ScriptStoryboardProvider');
  }
  return context;
};

// Optional hook that doesn't throw if outside provider
export const useScriptStoryboardOptional = (): ScriptStoryboardContextValue | null => {
  return useContext(ScriptStoryboardContext);
};

export default ScriptStoryboardContext;
