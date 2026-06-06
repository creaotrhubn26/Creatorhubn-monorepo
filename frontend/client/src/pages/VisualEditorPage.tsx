// @ts-nocheck
import React, { useState } from 'react';
import { Box } from '@mui/material';
import { VisualEditorProvider } from '../components/admin/visual-editor/VisualEditorContext';
import { FabricCanvas } from '../components/admin/visual-editor/FabricCanvas';
import { EnhancedTopToolbar } from '../components/admin/visual-editor/EnhancedTopToolbar';
import { PageTreeNavigator } from '../components/admin/visual-editor/PageTreeNavigator';
import { ComponentLibrarySidebar } from '../components/admin/visual-editor/ComponentLibrarySidebar';
import { EnhancedPropertiesPanel } from '../components/admin/visual-editor/EnhancedPropertiesPanel';
import { BottomToolbar } from '../components/admin/visual-editor/BottomToolbar';
import {
  CanvasGridOverlay,
  GridControls,
} from '../components/admin/visual-editor/CanvasGridOverlay';
import { useKeyboardShortcuts } from '../components/admin/visual-editor/useKeyboardShortcuts';
import {
  FloatingLayersPanel,
  LayersPanelToggle,
} from '../components/admin/visual-editor/FloatingLayersPanel';
import { ToolsPanel, ToolsPanelToggle } from '../components/admin/visual-editor/ToolsPanel';

export default function VisualEditorPage() {
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(16);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [toolsPanelMode, setToolsPanelMode] = useState<'drawer' | 'dialog'>('drawer');

  return (
    <VisualEditorProvider>
      <VisualEditorContent
        showGrid={showGrid}
        gridSize={gridSize}
        snapToGrid={snapToGrid}
        onToggleGrid={setShowGrid}
        onChangeGridSize={setGridSize}
        onToggleSnap={setSnapToGrid}
        showLayersPanel={showLayersPanel}
        onToggleLayersPanel={setShowLayersPanel}
        showComponentLibrary={showComponentLibrary}
        onToggleComponentLibrary={setShowComponentLibrary}
        showToolsPanel={showToolsPanel}
        onToggleToolsPanel={setShowToolsPanel}
      />
    </VisualEditorProvider>
  );
}

// Separate component to use hooks inside VisualEditorProvider
interface VisualEditorContentProps {
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  onToggleGrid: (show: boolean) => void;
  onChangeGridSize: (size: number) => void;
  onToggleSnap: (snap: boolean) => void;
  showLayersPanel: boolean;
  onToggleLayersPanel: (show: boolean) => void;
  showComponentLibrary: boolean;
  onToggleComponentLibrary: (show: boolean) => void;
  showToolsPanel: boolean;
  onToggleToolsPanel: (show: boolean) => void;
}

const VisualEditorContent: React.FC<VisualEditorContentProps> = ({
  showGrid,
  gridSize,
  snapToGrid,
  onToggleGrid,
  onChangeGridSize,
  onToggleSnap,
  showLayersPanel,
  onToggleLayersPanel,
  showComponentLibrary,
  onToggleComponentLibrary,
  showToolsPanel,
  onToggleToolsPanel,
}) => {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const handlePageSelect = (pageId: string) => {
    console.log('Selected page: ', pageId);
    // TODO: Load page content into canvas
  };

  const handleSectionSelect = (sectionId: string) => {
    console.log('Selected section:', sectionId);
    // TODO: Navigate to section in canvas
  };

  const handleOpenTool = (toolIndex: number, mode: 'drawer' | 'dialog') => {
    setToolsPanelMode(mode);
    onToggleToolsPanel(true);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: 'rgba(15,23,42,0.96)',
        color: '#fff',
      }}>
      {/* Top Toolbar with Grid Controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'rgba(15,23,42,0.96)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          color: '#fff',
        }}>
        <Box sx={{ flex: 1 }}>
          <EnhancedTopToolbar />
        </Box>
        <Box sx={{ px: 2 }}>
          <GridControls
            showGrid={showGrid}
            gridSize={gridSize}
            snapToGrid={snapToGrid}
            onToggleGrid={onToggleGrid}
            onChangeGridSize={onChangeGridSize}
            onToggleSnap={onToggleSnap}
          />
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Page Tree Navigator */}
        <PageTreeNavigator onPageSelect={handlePageSelect} onSectionSelect={handleSectionSelect} />

        {/* Component Library Sidebar (toggle) */}
        {showComponentLibrary && <ComponentLibrarySidebar />}

        {/* Center - Canvas Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: 'rgba(15,23,42,0.96)',
          }}>
          {/* Canvas frame (mørk ramme rundt artboard — som Figma/Photoshop) */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#1a1f2e',
            }}>
            {/* Artboard-flaten — bevart lys: dette er selve design-canvas (Figma/Photoshop-konvensjon) */}
            <Box
              sx={{
                width: '100%',
                maxWidth: 1200,
                height: '100%',
                bgcolor: 'white',
                boxShadow: '0 0 40px rgba(0,0,0,0.4)',
                position:'relative',
              }}>
              <CanvasGridOverlay
                width={1200}
                height={800}
                gridSize={gridSize}
                showGrid={showGrid}
                onToggleGrid={onToggleGrid}
              />
              <FabricCanvas />
            </Box>
          </Box>

          {/* Bottom Toolbar */}
          <BottomToolbar />
        </Box>

        {/* Right Sidebar - Enhanced Properties Panel */}
        <EnhancedPropertiesPanel />
      </Box>

      {/* Floating Layers Panel */}
      <FloatingLayersPanel isOpen={showLayersPanel} onClose={() => onToggleLayersPanel(false)} />
      <LayersPanelToggle
        isOpen={showLayersPanel}
        onToggle={() => onToggleLayersPanel(!showLayersPanel)}
      />

      {/* Tools Panel */}
      <ToolsPanel
        isOpen={showToolsPanel}
        onClose={() => onToggleToolsPanel(false)}
        mode={toolsPanelMode}
      />
      <ToolsPanelToggle
        isOpen={showToolsPanel}
        onToggle={() => {
          setToolsPanelMode('drawer');
          onToggleToolsPanel(!showToolsPanel);
        }}
        onOpenTool={handleOpenTool}
      />
    </Box>
  );
};
