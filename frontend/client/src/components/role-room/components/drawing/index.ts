/**
 * Drawing Components Index
 * 
 * Professional drawing tools for storyboard and manuscript creation
 * Complete Apple Storyboards feature parity
 */

// Core brush engine
export { AdvancedBrushEngine, DEFAULT_BRUSH_SETTINGS } from './AdvancedBrushEngine';
export type { ProBrushType, ProBrushSettings, BrushConfig } from './AdvancedBrushEngine';

export { ProBrushToolbar } from './ProBrushToolbar';
export type { ProBrushToolbarProps } from './ProBrushToolbar';

// Layers system
export { LayersPanel, DEFAULT_LAYER } from './LayersPanel';
export type { DrawingLayer, BlendMode, LayersPanelProps } from './LayersPanel';

// Shape tools
export { ShapeTools, drawShape } from './ShapeTools';
export type { ShapeType, ShapeStyle, ShapeToolsProps } from './ShapeTools';

// Text annotations
export { TextAnnotations, drawTextAnnotation } from './TextAnnotations';
export type { TextAnnotation, TextStyle, TextAnnotationsProps } from './TextAnnotations';

// Selection and transform
export { SelectionTools, SelectionBox, transformStroke } from './SelectionTools';
export type { SelectionMode, SelectionBounds, Transform, SelectionToolsProps } from './SelectionTools';

// Symmetry mode
export { SymmetryMode, getMirroredPoints, drawSymmetryGuides } from './SymmetryMode';
export type { SymmetryType, SymmetrySettings, SymmetryModeProps } from './SymmetryMode';

// Brush library
export { BrushLibrary } from './BrushLibrary';
export type { BrushPreset, BrushLibraryProps } from './BrushLibrary';

// Pressure curve editor
export { PressureCurveEditor, evaluatePressureCurve, DEFAULT_PRESSURE_CURVE } from './PressureCurveEditor';
export type { PressureCurve, CurvePoint, PressureCurveEditorProps } from './PressureCurveEditor';

// Onion skinning
export { OnionSkinning, getOnionFrames, renderOnionSkins, DEFAULT_ONION_SKIN_SETTINGS } from './OnionSkinning';
export type { OnionSkinSettings, OnionFrame, OnionSkinningProps } from './OnionSkinning';

// Eyedropper
export { Eyedropper, getPixelColor, getAverageColor } from './Eyedropper';
export type { SampledColor, EyedropperProps } from './Eyedropper';

// Gesture shortcuts
export { GestureShortcuts, useGestureHandler, DEFAULT_GESTURE_SETTINGS } from './GestureShortcuts';
export type { GestureType, GestureAction, GestureBinding, GestureSettings, GestureShortcutsProps } from './GestureShortcuts';

// Export options
export { ExportOptions, exportAsImage, exportAsSVG, exportAsPDF, exportAsPSD, downloadBlob, generateFilename, DEFAULT_EXPORT_SETTINGS } from './ExportOptions';
export type { ExportFormat, ExportSettings, ExportFrame, ExportResult, ExportOptionsProps } from './ExportOptions';

// Storyboard templates
export { StoryboardTemplates, ASPECT_RATIO_PRESETS, DEFAULT_GUIDES, calculateAspectRatio, getFrameDimensions, formatAspectRatio, drawGuides, createTemplateFromPreset } from './StoryboardTemplates';
export type { AspectRatioCategory, GuideType, AspectRatioPreset, FrameGuides, StoryboardTemplate, StoryboardTemplatesProps } from './StoryboardTemplates';

// Unified drawing tools panel
export { DrawingToolsPanel, DEFAULT_DRAWING_STATE } from './DrawingToolsPanel';
export type { ActiveTool, DrawingState, DrawingToolsPanelProps } from './DrawingToolsPanel';

// Re-export ColorWheelPicker from parent
export { default as ColorWheelPicker } from '../ColorWheelPicker';
