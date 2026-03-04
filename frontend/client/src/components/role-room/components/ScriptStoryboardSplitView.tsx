/**
 * ScriptStoryboardSplitView - Side-by-side script and storyboard editing
 * 
 * Features:
 * - Resizable split pane layout
 * - Script editor on left, storyboard on right
 * - Synchronized scrolling and navigation
 * - Collapsible panels
 * - Scene context header
 * - Frame-to-script linking
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  Divider,
  Chip,
  Button,
  Switch,
  FormControlLabel,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Fade,
  Collapse,
  Alert,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Sync,
  SyncDisabled,
  VerticalSplit,
  ViewColumn,
  Article,
  Image,
  Link,
  LinkOff,
  ZoomIn,
  ZoomOut,
  FullscreenExit,
  Fullscreen,
  Settings,
  Movie,
  Edit,
  Visibility,
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
  Add,
  PhotoCamera,
  Brush,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useScriptStoryboard, SceneContext, type FountainElement } from '../contexts/ScriptStoryboardContext';
import type { SceneBreakdown } from '../models/casting';

// =============================================================================
// Types
// =============================================================================

export interface ScriptStoryboardSplitViewProps {
  // Script content
  scriptContent: string;
  onScriptChange: (content: string) => void;
  
  // Storyboard data
  scene: SceneBreakdown;
  onSceneUpdate: (scene: SceneBreakdown) => void;
  
  // Optional components to render
  renderScriptEditor?: (props: ScriptEditorRenderProps) => React.ReactNode;
  renderStoryboard?: (props: StoryboardRenderProps) => React.ReactNode;
  
  // Layout options
  initialSplitRatio?: number;
  minPaneWidth?: number;
  showSyncControls?: boolean;
  showSceneHeader?: boolean;
  
  // Callbacks
  onFrameSelect?: (frameId: string, index: number) => void;
  onCreateFrame?: () => void;
  onGenerateFromScript?: () => void;
}

export interface ScriptEditorRenderProps {
  content: string;
  onChange: (content: string) => void;
  currentLine: number;
  onCursorChange: (line: number, column: number, element: string | null) => void;
  highlightedLines?: number[];
}

export interface StoryboardRenderProps {
  scene: SceneBreakdown;
  onUpdate: (scene: SceneBreakdown) => void;
  activeFrameIndex: number;
  onFrameSelect: (index: number) => void;
  scriptContext?: {
    sceneHeading: string;
    currentDialogue?: string;
    shotDescription?: string;
  };
}

// =============================================================================
// Styled Components
// =============================================================================

const SplitContainer = styled(Box)({
  display: 'flex',
  height: '100%',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'rgba(18, 18, 24, 0.98)',
});

const Pane = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ collapsed }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  transition: 'width 0.3s ease, min-width 0.3s ease',
  ...(collapsed && {
    width: '48px !important',
    minWidth: '48px !important',
  }),
}));

const PaneHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: 'rgba(30, 30, 40, 0.95)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  minHeight: 48,
});

const PaneContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
});

const ResizeHandle = styled(Box)({
  width: 6,
  cursor: 'col-resize',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  transition: 'background-color 0.2s ease',
  position: 'relative',
  '&:hover': {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  '&:active': {
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 2,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
  },
});

const SceneHeaderBar = styled(Paper)({
  padding: '12px 16px',
  backgroundColor: 'rgba(25, 25, 35, 0.98)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 0,
});

const CollapsedPane = styled(Box)({
  width: 48,
  height: '100%',
  backgroundColor: 'rgba(30, 30, 40, 0.95)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
  gap: 8,
  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
});

const SyncIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'synced',
})<{ synced?: boolean }>(({ synced }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 12,
  backgroundColor: synced ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
  border: `1px solid ${synced ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
  fontSize: 11,
  color: synced ? '#22c55e' : '#ef4444',
}));

const FrameCounter = styled(Chip)({
  height: 24,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  color: '#60a5fa',
});

// =============================================================================
// Component
// =============================================================================

export const ScriptStoryboardSplitView: React.FC<ScriptStoryboardSplitViewProps> = ({
  scriptContent,
  onScriptChange,
  scene,
  onSceneUpdate,
  renderScriptEditor,
  renderStoryboard,
  initialSplitRatio = 40,
  minPaneWidth = 300,
  showSyncControls = true,
  showSceneHeader = true,
  onFrameSelect,
  onCreateFrame,
  onGenerateFromScript,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
  const [scriptCollapsed, setScriptCollapsed] = useState(false);
  const [storyboardCollapsed, setStoryboardCollapsed] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  
  // Try to use context if available
  const scriptStoryboard = (() => {
    try {
      return useScriptStoryboard();
    } catch {
      return null;
    }
  })();
  
  const syncEnabled = scriptStoryboard?.syncEnabled ?? true;
  const currentScene = scriptStoryboard?.currentScene;
  const currentDialogue = scriptStoryboard?.currentDialogue;
  const activeFrameIndex = scriptStoryboard?.activeFrameIndex ?? 0;
  
  // Resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      
      // Enforce min pane widths
      const minRatio = (minPaneWidth / rect.width) * 100;
      const maxRatio = 100 - minRatio;
      
      setSplitRatio(Math.max(minRatio, Math.min(maxRatio, newRatio)));
      scriptStoryboard?.setSplitRatio?.(newRatio);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minPaneWidth, scriptStoryboard]);
  
  // Handle cursor change from script editor
  const handleCursorChange = useCallback((line: number, column: number, element: string | null) => {
    scriptStoryboard?.setScriptPosition?.({ 
      lineNumber: line, 
      column, 
      element: element as FountainElement | null 
    });
    
    // Auto-scroll to linked frame if sync enabled
    if (syncEnabled && scriptStoryboard?.autoScrollStoryboard) {
      scriptStoryboard?.goToFrameForLine?.(line);
    }
  }, [scriptStoryboard, syncEnabled]);
  
  // Handle frame selection from storyboard
  const handleFrameSelectInternal = useCallback((index: number) => {
    const frameId = scene.storyboardFrames?.[index]?.id;
    scriptStoryboard?.setActiveFrame?.(frameId || null, index);
    onFrameSelect?.(frameId || '', index);
    
    // Auto-scroll script if sync enabled
    if (syncEnabled && scriptStoryboard?.autoScrollScript && frameId) {
      const link = scriptStoryboard?.getFrameForLine?.(index);
      if (link) {
        scriptStoryboard?.goToScriptLine?.(link.scriptLineRange[0]);
      }
    }
  }, [scene.storyboardFrames, scriptStoryboard, syncEnabled, onFrameSelect]);
  
  // Script context for storyboard
  const scriptContext = useMemo(() => ({
    sceneHeading: currentScene?.sceneHeading || scene.sceneHeading || '',
    currentDialogue: currentDialogue?.dialogueText,
    shotDescription: scene.storyboardFrames?.[activeFrameIndex]?.description,
  }), [currentScene, currentDialogue, scene, activeFrameIndex]);
  
  // Highlighted lines (lines linked to current frame)
  const highlightedLines = useMemo(() => {
    const link = scriptStoryboard?.frameLinks.find(
      l => l.frameIndex === activeFrameIndex
    );
    if (link) {
      const lines: number[] = [];
      for (let i = link.scriptLineRange[0]; i <= link.scriptLineRange[1]; i++) {
        lines.push(i);
      }
      return lines;
    }
    return [];
  }, [scriptStoryboard?.frameLinks, activeFrameIndex]);
  
  const frameCount = scene.storyboardFrames?.length || 0;
  
  return (
    <SplitContainer ref={containerRef}>
      {/* Scene Header */}
      {showSceneHeader && currentScene && (
        <SceneHeaderBar sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" gap={2}>
              <Chip
                icon={<Movie sx={{ fontSize: 14 }} />}
                label={`Scene ${currentScene.sceneNumber}`}
                size="small"
                sx={{ fontWeight: 600 }}
              />
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {currentScene.sceneHeading}
              </Typography>
              {currentDialogue && (
                <Chip
                  label={currentDialogue.characterName}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11 }}
                />
              )}
            </Stack>
            
            <Stack direction="row" alignItems="center" gap={1}>
              {showSyncControls && (
                <SyncIndicator synced={syncEnabled}>
                  {syncEnabled ? <Sync sx={{ fontSize: 14 }} /> : <SyncDisabled sx={{ fontSize: 14 }} />}
                  {syncEnabled ? 'Synced' : 'Unsynced'}
                </SyncIndicator>
              )}
              <FrameCounter
                label={`Frame ${activeFrameIndex + 1} / ${frameCount}`}
                size="small"
              />
            </Stack>
          </Stack>
        </SceneHeaderBar>
      )}
      
      {/* Script Pane */}
      {scriptCollapsed ? (
        <CollapsedPane>
          <Tooltip title="Expand Script" placement="right">
            <IconButton size="small" onClick={() => setScriptCollapsed(false)}>
              <Article sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Script Editor" placement="right">
            <IconButton size="small" onClick={() => setScriptCollapsed(false)}>
              <ChevronRight sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </CollapsedPane>
      ) : (
        <Pane 
          sx={{ 
            width: `${splitRatio}%`,
            minWidth: minPaneWidth,
            mt: showSceneHeader && currentScene ? '56px' : 0,
          }}
        >
          <PaneHeader>
            <Stack direction="row" alignItems="center" gap={1}>
              <Article sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2">Script</Typography>
              <Chip 
                label={`Line ${scriptStoryboard?.scriptPosition.lineNumber || 1}`}
                size="small"
                sx={{ height: 20, fontSize: 10 }}
              />
            </Stack>
            <Stack direction="row" gap={0.5}>
              <Tooltip title="Link to Frame">
                <IconButton 
                  size="small"
                  onClick={() => {
                    const frameId = scene.storyboardFrames?.[activeFrameIndex]?.id;
                    if (frameId && currentScene) {
                      scriptStoryboard?.linkFrameToScript?.(
                        frameId,
                        currentScene.sceneId,
                        [scriptStoryboard?.scriptPosition.lineNumber || 1, scriptStoryboard?.scriptPosition.lineNumber || 1]
                      );
                    }
                  }}
                >
                  <Link sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Collapse Script">
                <IconButton size="small" onClick={() => setScriptCollapsed(true)}>
                  <ChevronLeft sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </PaneHeader>
          
          <PaneContent>
            {renderScriptEditor ? (
              renderScriptEditor({
                content: scriptContent,
                onChange: onScriptChange,
                currentLine: scriptStoryboard?.scriptPosition.lineNumber || 1,
                onCursorChange: handleCursorChange,
                highlightedLines,
              })
            ) : (
              <Box sx={{ p: 2, color: 'text.secondary' }}>
                <Typography variant="body2">
                  No script editor provided. Pass a renderScriptEditor prop.
                </Typography>
              </Box>
            )}
          </PaneContent>
        </Pane>
      )}
      
      {/* Resize Handle */}
      {!scriptCollapsed && !storyboardCollapsed && (
        <ResizeHandle 
          onMouseDown={handleMouseDown}
          sx={{ cursor: isDragging ? 'col-resize' : undefined }}
        />
      )}
      
      {/* Storyboard Pane */}
      {storyboardCollapsed ? (
        <CollapsedPane sx={{ borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: 'none' }}>
          <Tooltip title="Expand Storyboard" placement="left">
            <IconButton size="small" onClick={() => setStoryboardCollapsed(false)}>
              <Image sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Storyboard" placement="left">
            <IconButton size="small" onClick={() => setStoryboardCollapsed(false)}>
              <ChevronLeft sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </CollapsedPane>
      ) : (
        <Pane 
          sx={{ 
            flex: 1,
            minWidth: minPaneWidth,
            mt: showSceneHeader && currentScene ? '56px' : 0,
          }}
        >
          <PaneHeader>
            <Stack direction="row" alignItems="center" gap={1}>
              <Image sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2">Storyboard</Typography>
              <FrameCounter
                label={`${frameCount} frames`}
                size="small"
              />
            </Stack>
            <Stack direction="row" gap={0.5}>
              {/* Frame navigation */}
              <Tooltip title="Previous Frame">
                <IconButton 
                  size="small"
                  disabled={activeFrameIndex === 0}
                  onClick={() => handleFrameSelectInternal(activeFrameIndex - 1)}
                >
                  <NavigateBefore sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Next Frame">
                <IconButton 
                  size="small"
                  disabled={activeFrameIndex >= frameCount - 1}
                  onClick={() => handleFrameSelectInternal(activeFrameIndex + 1)}
                >
                  <NavigateNext sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Actions */}
              <Tooltip title="Add Frame">
                <IconButton size="small" onClick={onCreateFrame}>
                  <Add sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Draw Frame">
                <IconButton size="small">
                  <Brush sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Generate from Script">
                <IconButton size="small" onClick={onGenerateFromScript}>
                  <PhotoCamera sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              <Tooltip title="Settings">
                <IconButton 
                  size="small"
                  onClick={(e) => setSettingsAnchor(e.currentTarget)}
                >
                  <Settings sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Collapse Storyboard">
                <IconButton size="small" onClick={() => setStoryboardCollapsed(true)}>
                  <ChevronRight sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </PaneHeader>
          
          {/* Script Context Banner */}
          <Collapse in={!!currentDialogue}>
            <Alert 
              severity="info" 
              icon={false}
              sx={{ 
                borderRadius: 0, 
                py: 0.5,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <Chip 
                  label={currentDialogue?.characterName} 
                  size="small" 
                  sx={{ fontWeight: 600, fontSize: 11 }}
                />
                <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                  "{currentDialogue?.dialogueText?.slice(0, 80)}..."
                </Typography>
              </Stack>
            </Alert>
          </Collapse>
          
          <PaneContent>
            {renderStoryboard ? (
              renderStoryboard({
                scene,
                onUpdate: onSceneUpdate,
                activeFrameIndex,
                onFrameSelect: handleFrameSelectInternal,
                scriptContext,
              })
            ) : (
              <Box sx={{ p: 2, color: 'text.secondary' }}>
                <Typography variant="body2">
                  No storyboard renderer provided. Pass a renderStoryboard prop.
                </Typography>
              </Box>
            )}
          </PaneContent>
        </Pane>
      )}
      
      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
        PaperProps={{
          sx: { 
            backgroundColor: 'rgba(30, 30, 40, 0.98)',
            minWidth: 220,
          },
        }}
      >
        <MenuItem onClick={() => scriptStoryboard?.toggleSync?.()}>
          <ListItemIcon>
            {syncEnabled ? <Sync fontSize="small" /> : <SyncDisabled fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {syncEnabled ? 'Disable Sync' : 'Enable Sync'}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <Article fontSize="small" />
          </ListItemIcon>
          <ListItemText>Auto-scroll Script</ListItemText>
          <Switch
            size="small"
            checked={scriptStoryboard?.autoScrollScript ?? true}
            onChange={(e) => scriptStoryboard?.setAutoScrollScript?.(e.target.checked)}
          />
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <Image fontSize="small" />
          </ListItemIcon>
          <ListItemText>Auto-scroll Storyboard</ListItemText>
          <Switch
            size="small"
            checked={scriptStoryboard?.autoScrollStoryboard ?? true}
            onChange={(e) => scriptStoryboard?.setAutoScrollStoryboard?.(e.target.checked)}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          setSplitRatio(40);
          setScriptCollapsed(false);
          setStoryboardCollapsed(false);
          scriptStoryboard?.resetLayout?.();
          setSettingsAnchor(null);
        }}>
          <ListItemIcon>
            <VerticalSplit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reset Layout</ListItemText>
        </MenuItem>
      </Menu>
    </SplitContainer>
  );
};

export default ScriptStoryboardSplitView;
