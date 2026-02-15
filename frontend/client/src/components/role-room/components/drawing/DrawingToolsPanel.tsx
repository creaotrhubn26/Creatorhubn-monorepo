/**
 * DrawingToolsPanel - Unified panel integrating all professional drawing tools
 * 
 * This component provides a comprehensive sidebar/panel that combines:
 * - Layers management
 * - Brush library with presets
 * - Shape tools
 * - Text annotations
 * - Selection/transform tools
 * - Symmetry mode
 * - Pressure curve editor
 * - Onion skinning
 * - Eyedropper
 * - Export options
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tabs,
  Tab,
  Tooltip,
  Collapse,
  Divider,
  Badge,
} from '@mui/material';
import {
  Layers,
  Brush,
  Category,
  TextFields,
  SelectAll,
  Flip,
  Timeline,
  Colorize,
  Gesture,
  FileDownload,
  ExpandMore,
  ExpandLess,
  Settings,
  Movie,
  AspectRatio,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Import all drawing components
import { LayersPanel, DrawingLayer, BlendMode } from './LayersPanel';
import { BrushLibrary } from './BrushLibrary';
import { ShapeTools, ShapeType, ShapeStyle, DEFAULT_SHAPE_STYLE } from './ShapeTools';
import { TextAnnotation, TextStyle, DEFAULT_TEXT_STYLE } from './TextAnnotations';
import TextAnnotationsToolbar from './TextAnnotations';
import { SelectionTools, SelectionMode, SelectionBounds, Transform } from './SelectionTools';
import { SymmetryMode, SymmetryType, SymmetrySettings, DEFAULT_SYMMETRY_SETTINGS } from './SymmetryMode';
import { PressureCurveEditor, PressureCurve, DEFAULT_PRESSURE_CURVE } from './PressureCurveEditor';
import { OnionSkinning, OnionSkinSettings, DEFAULT_ONION_SKIN_SETTINGS } from './OnionSkinning';
import { Eyedropper, SampledColor } from './Eyedropper';
import { ExportOptions, ExportSettings, ExportFrame, DEFAULT_EXPORT_SETTINGS } from './ExportOptions';
import { GestureShortcuts, GestureSettings, GestureAction, DEFAULT_GESTURE_SETTINGS } from './GestureShortcuts';
import { StoryboardTemplates, StoryboardTemplate, FrameGuides, DEFAULT_GUIDES, drawGuides } from './StoryboardTemplates';
import { BrushConfig, DEFAULT_BRUSH_CONFIG } from './AdvancedBrushEngine';
import { PencilStroke } from '../../hooks/useApplePencil';

// =============================================================================
// Types
// =============================================================================

export type ActiveTool = 
  | 'brush'
  | 'shape'
  | 'text'
  | 'select'
  | 'eyedropper'
  | 'pan'
  | 'zoom';

export interface ScriptContext {
  sceneId: string | null;
  sceneNumber: number | null;
  sceneHeading: string;
  dialogueCharacter?: string;
  dialogueText?: string;
  actionDescription?: string;
  scriptLineNumber: number;
}

export interface DrawingState {
  layers: DrawingLayer[];
  activeLayerId: string;
  brushConfig: BrushConfig;
  shapeStyle: ShapeStyle;
  textStyle: TextStyle;
  symmetrySettings: SymmetrySettings;
  pressureCurve: PressureCurve;
  onionSkinSettings: OnionSkinSettings;
  gestureSettings: GestureSettings;
  selectionBounds: SelectionBounds | null;
  transform: Transform;
  activeTool: ActiveTool;
  activeShapeType: ShapeType | null;
  selectionMode: SelectionMode;
  selectedStrokeIds: string[];
  storyboardTemplate: StoryboardTemplate | null;
  customTemplates: StoryboardTemplate[];
  scriptContext: ScriptContext | null;
}

export interface DrawingToolsPanelProps {
  // Canvas reference for eyedropper
  canvas: HTMLCanvasElement | null;
  
  // Current drawing state
  state: DrawingState;
  onStateChange: (state: Partial<DrawingState>) => void;
  
  // Layer operations
  onLayerSelect: (id: string) => void;
  onLayerAdd: () => void;
  onLayerDelete: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerOpacityChange: (id: string, opacity: number) => void;
  onLayerReorder: (fromIndex: number, toIndex: number) => void;
  onLayerMerge: (id: string) => void;
  onLayerDuplicate: (id: string) => void;
  
  // Stroke operations
  strokes: PencilStroke[];
  onStrokesChange: (strokes: PencilStroke[]) => void;
  
  // Frame data for onion skinning
  currentFrameIndex: number;
  totalFrames: number;
  getFrameImage: (index: number) => HTMLCanvasElement | null;
  
  // Export frames
  exportFrames: ExportFrame[];
  selectedFrameIndices: number[];
  
  // Callbacks
  onColorPick: (color: string) => void;
  onExport: (settings: ExportSettings, frameIndices: number[]) => Promise<void>;
  onGestureAction: (action: GestureAction, data?: any) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  onDelete: () => void;
  
  // Display options
  position?: 'left' | 'right';
  defaultTab?: number;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// =============================================================================
// Default State
// =============================================================================

export const DEFAULT_DRAWING_STATE: DrawingState = {
  layers: [{
    id: 'default',
    name: 'Layer 1',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    strokes: [],
  }],
  activeLayerId: 'default',
  brushConfig: DEFAULT_BRUSH_CONFIG,
  shapeStyle: DEFAULT_SHAPE_STYLE,
  textStyle: DEFAULT_TEXT_STYLE,
  symmetrySettings: DEFAULT_SYMMETRY_SETTINGS,
  pressureCurve: DEFAULT_PRESSURE_CURVE,
  onionSkinSettings: DEFAULT_ONION_SKIN_SETTINGS,
  gestureSettings: DEFAULT_GESTURE_SETTINGS,
  selectionBounds: null,
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  activeTool: 'brush',
  activeShapeType: null,
  selectionMode: 'none',
  selectedStrokeIds: [],
  storyboardTemplate: null,
  customTemplates: [],
  scriptContext: null,
};

// =============================================================================
// Styled Components
// =============================================================================

const PanelContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'position' && prop !== 'collapsed',
})<{ position: 'left' | 'right'; collapsed: boolean }>(({ position, collapsed }) => ({
  position: 'absolute',
  top: 16,
  [position]: 16,
  bottom: 16,
  width: collapsed ? 48 : 300,
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  flexDirection: 'column',
  transition: 'width 0.3s ease',
  zIndex: 100,
}));

const TabPanel = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 0,
});

const ToolButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
  border: active ? '2px solid rgba(59, 130, 246, 0.5)' : '2px solid transparent',
  '&:hover': {
    backgroundColor: active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)',
  },
}));

const SectionHeader = styled(Box)({
  padding: '8px 12px',
  backgroundColor: 'rgba(0,0,0,0.2)',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

// =============================================================================
// Component
// =============================================================================

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  canvas,
  state,
  onStateChange,
  onLayerSelect,
  onLayerAdd,
  onLayerDelete,
  onLayerVisibilityToggle,
  onLayerOpacityChange,
  onLayerReorder,
  onLayerMerge,
  onLayerDuplicate,
  strokes,
  onStrokesChange,
  currentFrameIndex,
  totalFrames,
  getFrameImage,
  exportFrames,
  selectedFrameIndices,
  onColorPick,
  onExport,
  onGestureAction,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onCut,
  onDelete,
  position = 'right',
  defaultTab = 0,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    layers: true,
    brushes: true,
    shapes: false,
    text: false,
    selection: false,
    symmetry: false,
    pressure: false,
    onion: false,
    gestures: false,
    export: false,
  });
  
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [recentColors, setRecentColors] = useState<SampledColor[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleBrushSelect = useCallback((config: BrushConfig) => {
    onStateChange({ brushConfig: config, activeTool: 'brush' });
  }, [onStateChange]);

  const handleShapeSelect = useCallback((shapeType: ShapeType | null) => {
    onStateChange({ 
      activeShapeType: shapeType, 
      activeTool: shapeType ? 'shape' : 'brush' 
    });
  }, [onStateChange]);

  const handleColorPickFromEyedropper = useCallback((color: string) => {
    onColorPick(color);
    onStateChange({ 
      brushConfig: { ...state.brushConfig, color },
      activeTool: 'brush',
    });
    setEyedropperActive(false);
  }, [onColorPick, onStateChange, state.brushConfig]);

  const handleExport = useCallback(async (settings: ExportSettings, frameIndices: number[]) => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      // Simulate progress for now
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(r => setTimeout(r, 100));
        setExportProgress(i);
      }
      await onExport(settings, frameIndices);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [onExport]);

  const handleGestureAction = useCallback((action: GestureAction, data?: any) => {
    switch (action) {
      case 'undo':
        onUndo();
        break;
      case 'redo':
        onRedo();
        break;
      case 'copy':
        onCopy();
        break;
      case 'paste':
        onPaste();
        break;
      case 'cut':
        onCut();
        break;
      default:
        onGestureAction(action, data);
    }
  }, [onUndo, onRedo, onCopy, onPaste, onCut, onGestureAction]);

  // Collapsed toolbar view
  if (collapsed) {
    return (
      <PanelContainer position={position} collapsed elevation={8}>
        <Stack spacing={0.5} sx={{ p: 0.5, alignItems: 'center' }}>
          <Tooltip title="Expand" placement={position === 'right' ? 'left' : 'right'}>
            <IconButton size="small" onClick={() => setCollapsed(false)}>
              {position === 'right' ? <ExpandLess sx={{ transform: 'rotate(-90deg)' }} /> : <ExpandMore sx={{ transform: 'rotate(-90deg)' }} />}
            </IconButton>
          </Tooltip>
          
          <Divider sx={{ width: '100%', my: 0.5 }} />
          
          <Tooltip title="Brush" placement={position === 'right' ? 'left' : 'right'}>
            <ToolButton 
              active={state.activeTool === 'brush'}
              onClick={() => { setCollapsed(false); setActiveTab(0); }}
            >
              <Brush sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          
          <Tooltip title="Shapes" placement={position === 'right' ? 'left' : 'right'}>
            <ToolButton
              active={state.activeTool === 'shape'}
              onClick={() => { setCollapsed(false); setActiveTab(1); }}
            >
              <Category sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          
          <Tooltip title="Text" placement={position === 'right' ? 'left' : 'right'}>
            <ToolButton
              active={state.activeTool === 'text'}
              onClick={() => { setCollapsed(false); setActiveTab(1); }}
            >
              <TextFields sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          
          <Tooltip title="Layers" placement={position === 'right' ? 'left' : 'right'}>
            <Badge badgeContent={state.layers.length} color="primary" max={9}>
              <ToolButton onClick={() => { setCollapsed(false); setActiveTab(0); }}>
                <Layers sx={{ fontSize: 18 }} />
              </ToolButton>
            </Badge>
          </Tooltip>
          
          <Tooltip title="Eyedropper" placement={position === 'right' ? 'left' : 'right'}>
            <ToolButton
              active={eyedropperActive}
              onClick={() => setEyedropperActive(!eyedropperActive)}
            >
              <Colorize sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          
          <Divider sx={{ width: '100%', my: 0.5 }} />
          
          <Tooltip title="Settings" placement={position === 'right' ? 'left' : 'right'}>
            <ToolButton onClick={() => { setCollapsed(false); setActiveTab(2); }}>
              <Settings sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        </Stack>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer position={position} collapsed={false} elevation={8}>
      {/* Header */}
      <Box sx={{ 
        p: 1, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, pl: 1 }}>
          Drawing Tools
        </Typography>
        <IconButton size="small" onClick={() => setCollapsed(true)}>
          {position === 'right' ? <ExpandMore sx={{ transform: 'rotate(90deg)' }} /> : <ExpandLess sx={{ transform: 'rotate(90deg)' }} />}
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          '& .MuiTab-root': { minHeight: 40, py: 0 },
        }}
      >
        <Tab icon={<Brush sx={{ fontSize: 16 }} />} sx={{ minWidth: 0 }} />
        <Tab icon={<Category sx={{ fontSize: 16 }} />} sx={{ minWidth: 0 }} />
        <Tab icon={<AspectRatio sx={{ fontSize: 16 }} />} sx={{ minWidth: 0 }} />
        <Tab icon={<Settings sx={{ fontSize: 16 }} />} sx={{ minWidth: 0 }} />
        <Tab icon={<FileDownload sx={{ fontSize: 16 }} />} sx={{ minWidth: 0 }} />
      </Tabs>

      {/* Script Context Banner */}
      {state.scriptContext && (
        <Box sx={{
          px: 1.5,
          py: 1,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Movie sx={{ fontSize: 14, color: '#60a5fa' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#60a5fa' }}>
                {state.scriptContext.sceneHeading || `Scene ${state.scriptContext.sceneNumber}`}
              </Typography>
            </Stack>
            {state.scriptContext.dialogueCharacter && (
              <Stack direction="row" alignItems="center" gap={1}>
                <Badge sx={{ 
                  px: 0.75, 
                  py: 0.25, 
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  borderRadius: 1,
                  fontSize: 10,
                  color: '#a78bfa',
                }}>
                  {state.scriptContext.dialogueCharacter}
                </Badge>
                <Typography variant="caption" sx={{ 
                  fontStyle: 'italic', 
                  color: 'text.secondary',
                  fontSize: 10,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  "{state.scriptContext.dialogueText?.slice(0, 50)}..."
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      )}

      {/* Tab panels */}
      <TabPanel sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
        {/* Layers Section */}
        <SectionHeader onClick={() => toggleSection('layers')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Layers sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Layers</Typography>
            <Badge badgeContent={state.layers.length} color="primary" sx={{ ml: 1 }} />
          </Stack>
          {expandedSections.layers ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.layers}>
          <LayersPanel
            layers={state.layers}
            activeLayerId={state.activeLayerId}
            onLayersChange={(layers) => onStateChange({ layers })}
            onActiveLayerChange={(id) => onStateChange({ activeLayerId: id })}
          />
        </Collapse>

        {/* Brush Library Section */}
        <SectionHeader onClick={() => toggleSection('brushes')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Brush sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Brush Library</Typography>
          </Stack>
          {expandedSections.brushes ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.brushes}>
          <BrushLibrary
            currentConfig={state.brushConfig}
            onBrushSelect={handleBrushSelect}
            onSaveCurrentBrush={() => {}}
          />
        </Collapse>

        {/* Pressure Curve Section */}
        <SectionHeader onClick={() => toggleSection('pressure')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Timeline sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Pressure Curve</Typography>
          </Stack>
          {expandedSections.pressure ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.pressure}>
          <Box sx={{ p: 1 }}>
            <PressureCurveEditor
              curve={state.pressureCurve}
              onCurveChange={(curve) => onStateChange({ pressureCurve: curve })}
              width={268}
              height={150}
            />
          </Box>
        </Collapse>
      </TabPanel>

      <TabPanel sx={{ display: activeTab === 1 ? 'block' : 'none' }}>
        {/* Shape Tools Section */}
        <SectionHeader onClick={() => toggleSection('shapes')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Category sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Shapes</Typography>
          </Stack>
          {expandedSections.shapes ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.shapes}>
          <ShapeTools
            selectedShape={state.activeShapeType}
            onShapeSelect={handleShapeSelect}
            style={state.shapeStyle}
            onStyleChange={(style) => onStateChange({ shapeStyle: { ...state.shapeStyle, ...style } })}
          />
        </Collapse>

        {/* Text Annotations Section */}
        <SectionHeader onClick={() => toggleSection('text')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <TextFields sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Text</Typography>
          </Stack>
          {expandedSections.text ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.text}>
          <TextAnnotationsToolbar
            annotations={[]}
            selectedId={null}
            onAnnotationsChange={() => {}}
            onSelectedChange={() => {}}
            onAddText={() => {}}
            style={state.textStyle}
            onStyleChange={(style: Partial<TextStyle>) => onStateChange({ textStyle: { ...state.textStyle, ...style } })}
          />
        </Collapse>

        {/* Selection Tools Section */}
        <SectionHeader onClick={() => toggleSection('selection')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <SelectAll sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Selection</Typography>
          </Stack>
          {expandedSections.selection ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.selection}>
          <SelectionTools
            mode={state.selectionMode}
            onModeChange={(mode) => onStateChange({ selectionMode: mode })}
            selectedStrokeIds={state.selectedStrokeIds}
            onSelectionChange={(ids) => onStateChange({ selectedStrokeIds: ids })}
            bounds={state.selectionBounds}
            onTransform={(transform) => onStateChange({ transform })}
            onCopy={onCopy}
            onPaste={onPaste}
            onDelete={onDelete}
            onSelectAll={() => {}}
            onDeselectAll={() => onStateChange({ selectedStrokeIds: [] })}
            canPaste={false}
            hasSelection={state.selectedStrokeIds.length > 0}
          />
        </Collapse>

        {/* Symmetry Mode Section */}
        <SectionHeader onClick={() => toggleSection('symmetry')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Flip sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Symmetry</Typography>
            {state.symmetrySettings.type !== 'none' && (
              <Badge color="primary" variant="dot" />
            )}
          </Stack>
          {expandedSections.symmetry ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.symmetry}>
          <SymmetryMode
            settings={state.symmetrySettings}
            onSettingsChange={(settings: Partial<SymmetrySettings>) => onStateChange({ symmetrySettings: { ...state.symmetrySettings, ...settings } as SymmetrySettings })}
            canvasWidth={800}
            canvasHeight={600}
          />
        </Collapse>
      </TabPanel>

      <TabPanel sx={{ display: activeTab === 2 ? 'block' : 'none' }}>
        {/* Storyboard Templates */}
        <StoryboardTemplates
          selectedTemplate={state.storyboardTemplate}
          onTemplateSelect={(template) => onStateChange({ storyboardTemplate: template })}
          onTemplateCreate={(template) => onStateChange({ 
            customTemplates: [...state.customTemplates, template],
            storyboardTemplate: template,
          })}
          onTemplateDelete={(templateId) => onStateChange({
            customTemplates: state.customTemplates.filter(t => t.id !== templateId),
            storyboardTemplate: state.storyboardTemplate?.id === templateId ? null : state.storyboardTemplate,
          })}
          customTemplates={state.customTemplates}
          canvasWidth={canvas?.width || 1920}
          canvasHeight={canvas?.height || 1080}
        />
      </TabPanel>

      <TabPanel sx={{ display: activeTab === 3 ? 'block' : 'none' }}>
        {/* Onion Skinning Section */}
        <SectionHeader onClick={() => toggleSection('onion')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Movie sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Onion Skinning</Typography>
            {state.onionSkinSettings.enabled && (
              <Badge color="primary" variant="dot" />
            )}
          </Stack>
          {expandedSections.onion ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.onion}>
          <OnionSkinning
            settings={state.onionSkinSettings}
            onSettingsChange={(settings) => onStateChange({ onionSkinSettings: settings })}
            currentFrameIndex={currentFrameIndex}
            totalFrames={totalFrames}
            getFrameImage={getFrameImage}
          />
        </Collapse>

        {/* Eyedropper Section */}
        <SectionHeader onClick={() => toggleSection('eyedropper')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Colorize sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Eyedropper</Typography>
          </Stack>
          {expandedSections.eyedropper ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.eyedropper}>
          <Eyedropper
            canvas={canvas}
            onColorPick={handleColorPickFromEyedropper}
            isActive={eyedropperActive}
            onActiveChange={setEyedropperActive}
            recentColors={recentColors}
            onRecentColorsChange={setRecentColors}
          />
        </Collapse>

        {/* Gesture Shortcuts Section */}
        <SectionHeader onClick={() => toggleSection('gestures')}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Gesture sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>Gestures</Typography>
            {state.gestureSettings.enabled && (
              <Badge color="primary" variant="dot" />
            )}
          </Stack>
          {expandedSections.gestures ? <ExpandLess /> : <ExpandMore />}
        </SectionHeader>
        <Collapse in={expandedSections.gestures}>
          <GestureShortcuts
            settings={state.gestureSettings}
            onSettingsChange={(settings) => onStateChange({ gestureSettings: settings })}
            onGestureAction={handleGestureAction}
          />
        </Collapse>
      </TabPanel>

      <TabPanel sx={{ display: activeTab === 4 ? 'block' : 'none' }}>
        {/* Export Options */}
        <ExportOptions
          frames={exportFrames}
          selectedFrameIndices={selectedFrameIndices}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </TabPanel>
    </PanelContainer>
  );
};

export default DrawingToolsPanel;
