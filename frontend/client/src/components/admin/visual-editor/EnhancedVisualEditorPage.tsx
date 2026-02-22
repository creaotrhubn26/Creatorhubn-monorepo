/**
 * Enhanced Visual Editor Page - Integrates all advanced features
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Fab,
} from '@mui/material';
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
import { VisualEditorProvider, useVisualEditor, EditorElement } from './VisualEditorContext';
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
import { getVisualEditorTokens } from './visualEditorTokens';

/** Shape passed by ComponentLibrary's onUseComponent callback */
interface LibraryComponent {
  id: string;
  name: string;
  category?: string;
  props?: Record<string, unknown>;
}

interface EnhancedVisualEditorPageProps {
  projectId?: string;
}

const VALID_ELEMENT_TYPES: EditorElement['type'][] = [
  'button', 'text', 'image', 'card', 'container', 'grid', 'audio', 'video',
];

const toElementType = (raw: string): EditorElement['type'] => {
  const lower = raw.toLowerCase() as EditorElement['type'];
  return VALID_ELEMENT_TYPES.includes(lower) ? lower : 'container';
};

export const EnhancedVisualEditorContent: React.FC = () => {
  const { state, dispatch, saveProject, loadProject } = useVisualEditor();
  const tokens = getVisualEditorTokens();

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
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

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

  const generateCodeFromElements = useCallback((elements: EditorElement[]) => {
    // Generate HTML
    let html = `<!DOCTYPE html>\n<html>\n<head><style>\n.container { position: relative; width: 100%; min-height: 100vh; }\n`;
    elements.forEach((element) => {
      html += `.el-${element.id} {\n  position: absolute;\n  left: ${element.x}px;\n  top: ${element.y}px;\n  width: ${element.width}px;\n  height: ${element.height}px;\n`;
      if (element.styles) {
        Object.entries(element.styles).forEach(([key, value]) => {
          if (value !== undefined) {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            html += `  ${cssKey}: ${String(value)};\n`;
          }
        });
      }
      html += `}\n`;
    });
    html += `</style></head>\n<body>\n<div class="container">\n`;
    elements.forEach((element) => {
      const text = typeof element.props?.text === 'string' ? element.props.text : '';
      html += `  <div class="el-${element.id}">${text}</div>\n`;
    });
    html += `</div>\n</body>\n</html>`;

    // Generate React code
    let react = `import React from 'react';\n\nexport default function GeneratedComponent() {\n  return (\n    <div className="container">\n`;
    elements.forEach((element) => {
      react += `      <div className="${element.type}" style={{ position: 'absolute', left: ${element.x}, top: ${element.y}, width: ${element.width}, height: ${element.height} }}>\n`;
      if (typeof element.props?.text === 'string') {
        react += `        ${element.props.text}\n`;
      }
      react += `      </div>\n`;
    });
    react += `    </div>\n  );\n}`;

    // Generate CSS
    let css = `.container {\n  position: relative;\n  width: 100%;\n  min-height: 100vh;\n}\n\n`;
    elements.forEach((element) => {
      css += `.${element.type} {\n`;
      if (element.styles) {
        Object.entries(element.styles).forEach(([key, value]) => {
          if (value !== undefined) {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            css += `  ${cssKey}: ${String(value)};\n`;
          }
        });
      }
      css += `}\n\n`;
    });

    // Generate JavaScript
    let javascript = `// Auto-generated event handlers\n`;
    elements.forEach((element) => {
      if (element.type === 'button') {
        javascript += `document.querySelector('.el-${element.id}')?.addEventListener('click', () => {\n  console.log('${String(element.props?.text ?? element.id)} clicked');\n});\n\n`;
      }
    });

    return { html, react, css, javascript };
  }, []);

  const handleCommandExecute = useCallback((commandId: string) => {
    switch (commandId) {
      case 'save':
        saveProject();
        break;
      case 'export': setShowExporter(true);
        break;
      case 'accessibility-check': setShowAccessibility(true);
        break;
      case 'format-code': {
        // Re-generate code from current elements to get a clean formatted version
        const freshCode = generateCodeFromElements(state.elements);
        setGeneratedCode(freshCode);
        break;
      }
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
        setExportFormat(prev => {
          if (prev === 'html') return 'react';
          if (prev === 'react') return 'vue';
          return 'html';
        });
        break;
      case 'toggle-code-editor': setShowCodeEditor(prev => !prev);
        break;
      case 'toggle-preview': setShowLivePreviewPanel(prev => !prev);
        break;
      case 'toggle-settings': setShowSettings(prev => !prev);
        break;
      default: break;
    }
  }, [saveProject, generateCodeFromElements, state.elements]);

  const handleUseComponent = useCallback((component: LibraryComponent) => {
    dispatch({
      type: 'ADD_ELEMENT',
      payload: {
        id: `component-${Date.now()}`,
        type: toElementType(component.category ?? 'container'),
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        styles: {},
        props: { ...(component.props ?? {}) },
      },
    });
    setShowComponentLibrary(false);
  }, [dispatch]);

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
          onClientSelect={(clientId) => {
            dispatch({ type: 'ADD_NOTIFICATION', payload: { id: `notif-${Date.now()}`, type: 'info', title: 'Client Selected', message: `Client selected: ${clientId}`, timestamp: new Date(), read: false } });
          }}
          onComponentDrag={(componentType) => {
            dispatch({ type: 'ADD_NOTIFICATION', payload: { id: `notif-${Date.now()}`, type: 'info', title: 'Component Drag', message: `Dragging: ${componentType}`, timestamp: new Date(), read: false } });
          }}
          onComponentAdd={(componentType, position) => {
            dispatch({
              type: 'ADD_ELEMENT',
              payload: {
                id: `component-${Date.now()}`,
                type: toElementType(componentType),
                x: position.x,
                y: position.y,
                width: 200,
                height: 100,
                styles: {},
                props: {},
              },
            });
          }}
          searchQuery={sidebarSearch}
          onSearchChange={setSidebarSearch}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onOpenAssetLibrary={() => setShowComponentLibrary(true)}
          onOpenScrollStories={() => setShowLivePreviewPanel(true)}
          onOpenGoogleServices={() => setShowSettings(true)}
          onOpenNoteEditor={() => setShowCodeEditor(true)}
          onOpenSettings={() => setShowSettings(true)}
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
            <Tooltip title={tokens.enhancedPage.fabs.unifiedStudio} placement="left">
              <Fab
                size="small"
                color={showUnifiedStudio ? 'primary' : 'default'}
                onClick={() => setShowUnifiedStudio(!showUnifiedStudio)}
              >
                <Code />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.accessibility} placement="left">
              <Fab
                size="small"
                color={showAccessibility ? 'primary' : 'default'}
                onClick={() => setShowAccessibility(!showAccessibility)}
              >
                <Accessible />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.exportPanel} placement="left">
              <Fab size="small" onClick={() => setShowExporter(true)}>
                <CloudUpload />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.componentLibrary} placement="left">
              <Fab
                size="small"
                color={showComponentLibrary ? 'primary' : 'default'}
                onClick={() => setShowComponentLibrary(!showComponentLibrary)}
              >
                <Folder />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.shortcuts} placement="left">
              <Fab size="small" onClick={() => setShowShortcuts(true)}>
                <Keyboard />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.codeEditor} placement="left">
              <Fab
                size="small"
                color={showCodeEditor ? 'primary' : 'default'}
                onClick={() => setShowCodeEditor(!showCodeEditor)}
              >
                <Code />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.livePreviewPanel} placement="left">
              <Fab
                size="small"
                color={showLivePreviewPanel ? 'primary' : 'default'}
                onClick={() => setShowLivePreviewPanel(!showLivePreviewPanel)}
              >
                <Visibility />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.previewMode} placement="left">
              <Fab
                size="small"
                color={showLivePreview ? 'primary' : 'default'}
                onClick={() => setShowLivePreview(!showLivePreview)}
              >
                <Visibility />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.settings} placement="left">
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
  return (
    <VisualEditorProvider>
      <EnhancedVisualEditorPageLoader projectId={projectId} />
    </VisualEditorProvider>
  );
};

/** Inner component that can access the visual editor context to load a project */
const EnhancedVisualEditorPageLoader: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { loadProject } = useVisualEditor();

  useEffect(() => {
    if (projectId) {
      loadProject({
        id: projectId,
        name: `Project ${projectId}`,
        elements: [],
        settings: {
          width: 1200,
          height: 800,
          backgroundColor: '#ffffff',
          gridSize: 10,
          snapToGrid: true,
        },
        metadata: {
          createdBy: 'current-user',
          createdAt: new Date(),
          lastModified: new Date(),
          version: 1,
        },
        status: 'draft',
      });
    }
  }, [projectId, loadProject]);

  return <EnhancedVisualEditorContent />;
};
