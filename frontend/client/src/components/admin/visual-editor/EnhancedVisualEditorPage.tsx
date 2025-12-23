/**
 * Enhanced Visual Editor Page - Integrates all advanced features
 */

import React, { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip, Fab } from '@mui/material';
import {
  Code,
  Visibility,
  Accessible,
  CloudUpload,
  Keyboard,
  Folder,
  Settings as SettingsIcon,
} from '@mui/icons-material';

// Existing components
import { VisualEditorProvider, useVisualEditor } from './VisualEditorContext';
import { EnhancedTopToolbar } from './EnhancedTopToolbar';
import { FabricCanvas } from './FabricCanvas';
import VisualEditorSidebar from './VisualEditorSidebar';
import { EnhancedPropertiesPanel } from './EnhancedPropertiesPanel';

// New enhanced components
import { CodeEditorPanel } from './CodeEditorPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { AccessibilityChecker } from './AccessibilityChecker';
import { PlatformExporter } from './PlatformExporter';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ComponentLibrary } from './ComponentLibrary';
import { UnifiedCodeStudio } from './UnifiedCodeStudio';

interface EnhancedVisualEditorPageProps {
  projectId?: string;
}

const EnhancedVisualEditorContent: React.FC = () => {
  const { state, dispatch } = useVisualEditor();

  // Panel visibility states
  const [showUnifiedStudio, setShowUnifiedStudio] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showLivePreviewPanel, setShowLivePreviewPanel] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'react' | 'vue'>('react');

  // Generated code state
  const [generatedCode, setGeneratedCode] = useState({
    html: '',
    react: '',
    css: '',
    javascript: '',
  });

  // Update generated code when elements change
  useEffect(() => {
    if (state.elements) {
      // Generate code from current elements
      const code = generateCodeFromElements(state.elements);
      setGeneratedCode(code);
    }
  }, [state.elements]);

  const generateCodeFromElements = (elements: any[]) => {
    // Generate React code
    let react = `import React from 'react';\n\nexport default function GeneratedComponent() {\n  return (\n    <div className="container">\n`;

    elements.forEach((element: any) => {
      react += `      <div className="${element.type}" style={{ position: 'absolute', left: ${element.x}px, top: ${element.y}px, width: ${element.width}px, height: ${element.height}px }}>\n`;
      if (element.props?.text) {
        react += `        ${element.props.text}\n`;
      }
      react += `      </div>\n`;
    });

    react += `    </div>\n  );\n}`;

    // Generate CSS
    let css = `.container {\n  position: relative;\n  width: 100%;\n  min-height: 100vh;\n}\n\n`;

    elements.forEach((element: any) => {
      css += `.${element.type} {\n`;
      if (element.styles) {
        Object.entries(element.styles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          css += `  ${cssKey}: ${value};\n`;
        });
      }
      css += `}\n\n`;
    });

    return {
      html: '', // HTML generation
      react,
      css,
      javascript: '',
    };
  };

  const handleCommandExecute = (commandId: string) => {
    switch (commandId) {
      case 'save': // Save project logic
        break;
      case 'export': setShowExporter(true);
        break;
      case 'accessibility-check': setShowAccessibility(true);
        break;
      case 'format-code': // Format code logic
        break;
      case 'refresh-preview': setShowLivePreview(false);
        setTimeout(() => setShowLivePreview(true), 100);
        break;
      case 'export-html': setExportFormat('html');
        setShowExporter(true);
        break;
      case 'export-react': setExportFormat('react');
        setShowExporter(true);
        break;
      case 'export-vue': setExportFormat('vue');
        setShowExporter(true);
        break;
      case 'toggle-format': 
        // Cycle through export formats
        setExportFormat(prev => {
          if (prev === 'html') return 'react';
          if (prev === 'react') return 'vue';
          return 'html';
        });
        break;
      default: console.log('Command: ', commandId);
    }
  };

  const handleUseComponent = (component: any) => {
    // Add component to canvas
    dispatch({
      type: 'ADD_ELEMENT',
      payload: {
        id: `component-${Date.now()}`,
        type: component.category?.toLowerCase() || 'container',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        styles: {},
        props: { ...component.props },
      },
    });
    setShowComponentLibrary(false);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Cmd/Ctrl + E for export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setShowExporter(true);
      }

      // Cmd/Ctrl + Shift + A for accessibility
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setShowAccessibility(true);
      }

      // Cmd/Ctrl + Shift + C for unified code studio
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        setShowUnifiedStudio(!showUnifiedStudio);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnifiedStudio]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <EnhancedTopToolbar />

      {/* Main Editor Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Component Library */}
        <VisualEditorSidebar
          onClientSelect={(clientId) => console.log('Client selected:', clientId)}
          onComponentDrag={(componentType) => console.log('Drag:', componentType)}
          onComponentAdd={(componentType, position) => {
            dispatch({
              type: 'ADD_ELEMENT',
              payload: {
                id: `component-${Date.now()}`,
                type: componentType as any,
                x: position.x,
                y: position.y,
                width: 200,
                height: 100,
                styles: {},
                props: {},
              },
            });
          }}
          searchQuery=""
          onSearchChange={() => {}}
          selectedCategory="all"
          onCategoryChange={() => {}}
          onOpenAssetLibrary={() => setShowComponentLibrary(true)}
          onOpenScrollStories={() => {}}
          onOpenGoogleServices={() => {}}
          onOpenNoteEditor={() => {}}
        />

        {/* Canvas Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'}}>
          <FabricCanvas />

          {/* Floating Action Buttons */}
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 100}}>
            <Tooltip title="Unified Code Studio (Cmd+Shift+C)" placement="left">
              <Fab
                size="small"
                color={showUnifiedStudio ? 'primary' : 'default'}
                onClick={() => setShowUnifiedStudio(!showUnifiedStudio)}
              >
                <Code />
              </Fab>
            </Tooltip>

            <Tooltip title="Accessibility (Cmd+Shift+A)" placement="left">
              <Fab
                size="small"
                color={showAccessibility ? 'primary' : 'default'}
                onClick={() => setShowAccessibility(!showAccessibility)}
              >
                <Accessible />
              </Fab>
            </Tooltip>

            <Tooltip title="Export (Cmd+E)" placement="left">
              <Fab size="small" onClick={() => setShowExporter(true)}>
                <CloudUpload />
              </Fab>
            </Tooltip>

            <Tooltip title="Component Library" placement="left">
              <Fab
                size="small"
                color={showComponentLibrary ? 'primary' : 'default'}
                onClick={() => setShowComponentLibrary(!showComponentLibrary)}
              >
                <Folder />
              </Fab>
            </Tooltip>

            <Tooltip title="Shortcuts (Cmd+K)" placement="left">
              <Fab size="small" onClick={() => setShowShortcuts(true)}>
                <Keyboard />
              </Fab>
            </Tooltip>

            <Tooltip title="Code Editor" placement="left">
              <Fab
                size="small"
                color={showCodeEditor ? 'primary' : 'default'}
                onClick={() => setShowCodeEditor(!showCodeEditor)}
              >
                <Code />
              </Fab>
            </Tooltip>

            <Tooltip title="Live Preview Panel" placement="left">
              <Fab
                size="small"
                color={showLivePreviewPanel ? 'primary' : 'default'}
                onClick={() => setShowLivePreviewPanel(!showLivePreviewPanel)}
              >
                <Visibility />
              </Fab>
            </Tooltip>

            <Tooltip title="Preview Mode" placement="left">
              <Fab
                size="small"
                color={showLivePreview ? 'primary' : 'default'}
                onClick={() => setShowLivePreview(!showLivePreview)}
              >
                <Visibility />
              </Fab>
            </Tooltip>

            <Tooltip title="Settings" placement="left">
              <IconButton
                size="small"
                color={showSettings ? 'primary' : 'default'}
                onClick={() => setShowSettings(!showSettings)}
                sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Right Properties Panel */}
        <EnhancedPropertiesPanel />
      </Box>

      {/* Enhanced Panels - Overlays */}

      {/* Unified Code Studio (replaces separate Code Editor + Live Preview) */}
      <UnifiedCodeStudio
        open={showUnifiedStudio}
        onClose={() => setShowUnifiedStudio(false)}
        initialCode={generatedCode}
      />

      {/* Accessibility Checker Drawer */}
      <AccessibilityChecker
        open={showAccessibility}
        onClose={() => setShowAccessibility(false)}
        iframeRef={React.createRef()}
      />

      {/* Platform Exporter Dialog */}
      <PlatformExporter
        open={showExporter}
        onClose={() => setShowExporter(false)}
        code={generatedCode}
        exportFormat={exportFormat}
      />

      {/* Component Library Drawer */}
      <ComponentLibrary
        open={showComponentLibrary}
        onClose={() => setShowComponentLibrary(false)}
        onUseComponent={handleUseComponent}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        onExecuteCommand={handleCommandExecute}
      />

      {/* Code Editor Panel - conditionally rendered */}
      {showCodeEditor && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '50vh', zIndex: 1000 }}>
          <CodeEditorPanel
            onCodeChange={(code: string, language: string) => {
              if (language === 'javascript' || language === 'typescript') {
                setGeneratedCode(prev => ({ ...prev, react: code }));
              } else if (language === 'css') {
                setGeneratedCode(prev => ({ ...prev, css: code }));
              }
            }}
            readOnly={false}
          />
        </Box>
      )}

      {/* Live Preview Panel - conditionally rendered */}
      {showLivePreviewPanel && (
        <Box sx={{ position: 'fixed', top: 64, right: 300, width: 400, height: 'calc(100vh - 64px)', zIndex: 1000 }}>
          <LivePreviewPanel
            code={generatedCode}
            mode={exportFormat === 'react' ? 'react' : 'html'}
          />
        </Box>
      )}
    </Box>
  );
};

// Main component with provider
export const EnhancedVisualEditorPage: React.FC<EnhancedVisualEditorPageProps> = ({
  projectId,
}) => {
  // Use projectId for project-specific loading
  console.log('Loading project:', projectId);
  
  return (
    <VisualEditorProvider>
      <EnhancedVisualEditorContent />
    </VisualEditorProvider>
  );
};
