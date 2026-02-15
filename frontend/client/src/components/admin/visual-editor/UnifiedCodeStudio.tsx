/**
 * Unified Code Studio - Bridges Visual Editor with Code Generation Studio
 * Integrates: * - CodeEditorPanel (Monaco Editor)
 * - LivePreviewPanel (Device simulation)
 * - CodeGenerationStudio (Backend code generation)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Button,
  Chip,
  Divider,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
} from '@mui/material';
import {
  Code,
  Visibility,
  Storage,
  PlayArrow,
  Sync,
  CompareArrows,
  Close,
  Settings,
  CloudUpload,
  AutoAwesome,
  Psychology,
  Description,
  AttachMoney,
  Computer,
  BugReport,
  Folder,
} from '@mui/icons-material';

// Visual Editor Components
import { CodeEditorPanel } from './CodeEditorPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { useVisualEditor } from './VisualEditorContext';
import { parseCode, ParseResult } from './CodeToCanvasParser';
import { useHotReload, HotReloadIndicator } from './HotReloadSystem';

// Code Generation Studio (existing)
import CodeGenerationStudio from '@/components/CodeGenerationStudio';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

// AI Code Completion
import { useAICodeCompletion, AIContext } from './AICodeCompletionSystem';
import AISettingsDialog from './AISettingsDialog';
import AICompletionPanel from './AICompletionPanel';

// ✨ NEW: AI Enhancement Components
import AIModelComparison from './AIModelComparison';
import AIPromptTemplates from './AIPromptTemplates';
import AIUsageAnalytics from './AIUsageAnalytics';
import AILocalModelProvider from './AILocalModelProvider';
import AIDebugAssistant from './AIDebugAssistant';
import AIMultiFileContext from './AIMultiFileContext';
import AIVisionCodeGenerator from './AIVisionCodeGenerator';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index} style={{ height: '100%' }}>
      {value === index && <Box sx={{ height: '100%' }}>{children}</Box>}
    </div>
  );
}

interface UnifiedCodeStudioProps {
  open: boolean;
  onClose: () => void;
  initialCode?: {
    html?: string;
    react?: string;
    css?: string;
    javascript?: string;
  };
}

export const UnifiedCodeStudio: React.FC<UnifiedCodeStudioProps> = ({
  open,
  onClose,
  initialCode,
}) => {
  const { state } = useVisualEditor();
  const { communication, analytics } = useEnhancedMasterIntegration();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 🔥 Hot Reload System
  const hotReload = useHotReload({
    enabled: true,
    preserveState: true,
    showLoadingIndicator: true,
    debounceMs: 300,
    maxRetries: 3,
  });

  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [generatedCode, setGeneratedCode] = useState(
    initialCode || {
      html: '',
      react: '',
      css: '',
      javascript: '',
    },
  );
  const [backendCode, setBackendCode] = useState<unknown>(null);
  const [isSync, setIsSync] = useState(true);
  const [exportFormat, setExportFormat] = useState<'html' | 'react' | 'vue'>('react');
  const [isBidirectionalSync, setIsBidirectionalSync] = useState(false);
  const [parseErrors, setParseErrors] = useState<ParseResult['errors']>([]);
  const [parseWarnings, setParseWarnings] = useState<ParseResult['warnings']>([]);
  const codeChangeTimer = useRef<NodeJS.Timeout | null>(null);

  // 🤖 AI Code Completion
  const aiCompletion = useAICodeCompletion();
  const [showAISettings, setShowAISettings] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [currentCursor, setCurrentCursor] = useState({ line: 0, column: 0 });
  const [currentSelectedText, setCurrentSelectedText] = useState<string>();

  // ✨ NEW: AI Enhancement Dialog States
  const [showModelComparison, setShowModelComparison] = useState(false);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);
  const [showUsageAnalytics, setShowUsageAnalytics] = useState(false);
  const [showLocalModels, setShowLocalModels] = useState(false);
  const [showDebugAssistant, setShowDebugAssistant] = useState(false);
  const [showMultiFileContext, setShowMultiFileContext] = useState(false);
  const [showVisionCodeGen, setShowVisionCodeGen] = useState(false);

  // Set iframe ref for hot reload
  useEffect(() => {
    if (iframeRef.current) {
      hotReload.setIframeRef(iframeRef);
    }
  }, [iframeRef.current, hotReload]);

  // Sync code when elements change + Hot Reload
  useEffect(() => {
    if (isSync && state.elements) {
      const code = generateCodeFromElements(state.elements);
      setGeneratedCode(code);

      // 🔥 Trigger hot reload
      if (code.react) {
        hotReload.reload(code.react);
      }
    }
  }, [state.elements, isSync, hotReload]);

  // Listen for code generation from CodeGenerationStudio
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: unknown) => {
      if (message.type === 'code-generation:completed' && message.data) {
        console.log('🎉 Backend code generated: ', message.data);
        setBackendCode(message.data);

        // Optionally switch to backend tab
        if (activeTab === 0) {
          // Show notification
            analytics.trackEvent('backend_code_received', {
            service: message.data.service,
          });
        }
      }
    });

    return unsubscribe;
  }, [communication, analytics, activeTab]);

  const generateCodeFromElements = (elements: unknown[]) => {
    // Generate React code
    let react = `import React, { useState } from 'react';\nimport'./styles.css';\n\n`;
    react += `export default function GeneratedComponent() {\n`;
    react += `  const [state, setState] = useState({});\n\n`;
    react += `  return (\n`;
    react += `    <div className="container" style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>\n`;

    elements.forEach((element) => {
      const style = `{{ position: 'absolute', left: ${element.x}px, top: ${element.y}px, width: ${element.width}px, height: ${element.height}px }`;

      switch (element.type) {
        case 'button': react += `      <button style=${style} className="btn-${element.id},">\n`;
          react += `        ${element.props?.text || 'Button'}\n`;
          react += `      </button>\n`;
          break;
        case 'text': react += `      <p style=${style} className="text-${element.id}">\n`;
          react += `        ${element.props?.text || 'Text'}\n`;
          react += `      </p>\n`;
          break;
        case 'image': react += `      <img style=${style} src="${element.props?.src || 'placeholder.jpg'}" alt="${element.props?.alt || 'Image'}" />\n`;
          break;
        default: react += `      <div style=${style} className="${element.type}-${element.id}"></div>\n`;
      }
    });

    react += `    </div>\n`;
    react += `  );\n`;
    react += `}`;

    // Generate CSS
    let css = `/* Generated Styles */\n\n`;
    css += `.container {\n  width: 100%;\n  min-height: 100vh;\n  position: relative;\n , background: #f5f5f5;\n}\n\n`;

    elements.forEach((element) => {
      css += `.${element.type}-${element.id} {\n`;
      if (element.styles) {
        Object.entries(element.styles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          css += `  ${cssKey}: ${value};\n`;
        });
      }
      css += `}\n\n`;
    });

    return {
      html: '', // HTML generation can be added
      react,
      css,
      javascript: '',
    };
  };

  const handleCodeChange = (newCode: string, language: string) => {
    setGeneratedCode((prev) => ({
      ...prev,
      [language]: newCode,
    }));

    // Broadcast code change
    communication.sendBroadcast('code:changed', {
      language,
      code: newCode,
    });

    // 🔥 Hot Reload: Update preview when code changes
    if (language === 'react') {
      hotReload.reload(newCode);
    }

    // 🆕 Bi-directional sync: Parse code and update canvas
    if (isBidirectionalSync && (language === 'react' || language === 'html')) {
      // Debounce parsing to avoid excessive updates
      if (codeChangeTimer.current) {
        clearTimeout(codeChangeTimer.current);
      }

      codeChangeTimer.current = setTimeout(() => {
        try {
          const result = parseCode(newCode, language as 'react' | 'html');

          setParseErrors(result.errors);
          setParseWarnings(result.warnings);

          if (result.errors.length === 0 && result.elements.length > 0) {
            // Update canvas with parsed elements
            communication.sendBroadcast('code:sync-to-canvas', {
              elements: result.elements,
              source: 'code-editor',
            });

            analytics.trackEvent('code_synced_to_canvas', {
              elementCount: result.elements.length,
              language,
            });
          }
        } catch (error) {
          console.error('Code parsing failed: ', error);
          setParseErrors([
            {
              line: 0,
              column: 0,
              message: error instanceof Error ? error.message : 'Parse failed',
              severity: 'error',
            },
          ]);
        }
      }, 1000); // 1 second debounce
    }
  };

  const handleSyncToggle = () => {
    setIsSync(!isSync);
    analytics.trackEvent('code_sync_toggled', { enabled: !isSync });
  };

  const handleExportToBackend = () => {
    // Send frontend code to CodeGenerationStudio for backend generation
    communication.sendBroadcast('code:export-to-backend', {
      frontend: generatedCode,
      elements: state.elements,
    });

    // Switch to backend tab
    setActiveTab(1);
  };

  // 🤖 AI Code Completion Handlers
  const handleAIApplyCode = useCallback(
    (code: string) => {
      setGeneratedCode((prev) => ({
        ...prev,
        react: code,
      }));

      // Trigger hot reload
      hotReload.reload(code);

      // Track event
      analytics.trackEvent('ai_code_applied', {
        codeLength: code.length,
      });
    },
    [hotReload, analytics],
  );

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'white',
        zIndex: 130,
        display: 'flex',
        flexDirection: 'column'}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: '#f5f5f5'}}>
        <Box display="flex" alignItems="center" gap={2}>
          <Code color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" fontWeight={600}>
            Unified Code Studio
          </Typography>
          <Chip
            label={isSync ? 'Canvas → Code' : 'Manual'}
            color={isSync ? 'success' : 'default'}
            size="small"
            icon={<Sync />}
            onClick={handleSyncToggle}
          />
          <Chip
            label={isBidirectionalSync ? 'Code ↔ Canvas' : 'Code → Canvas Only'}
            color={isBidirectionalSync ? 'primary' : 'default'}
            size="small"
            icon={<CompareArrows />}
            onClick={() => {
              setIsBidirectionalSync(!isBidirectionalSync);
              analytics.trackEvent('bidirectional_sync_toggled', { enabled: !isBidirectionalSync });
            }}
          />
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          {/* View Mode Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="split">
              <Tooltip title="Split View">
                <CompareArrows fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="editor">
              <Tooltip title="Editor Only">
                <Code fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="preview">
              <Tooltip title="Preview Only">
                <Visibility fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* 🤖 AI Code Completion Buttons */}
          <Tooltip
            title={aiCompletion.isConfigured ? 'AI Assistant' : 'Configure AI (Click to setup)'}
          >
            <Button
              startIcon={<Psychology />}
              variant={showAIPanel ? 'contained' : 'outlined'}
              size="small"
              color={aiCompletion.isConfigured ? 'secondary' : 'warning'}
              onClick={() =>
                aiCompletion.isConfigured ? setShowAIPanel(!showAIPanel) : setShowAISettings(true)
              }
            >
              AI
            </Button>
          </Tooltip>

          <Tooltip title="AI Settings">
            <IconButton size="small" onClick={() => setShowAISettings(true)}>
              <Settings fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* ✨ NEW: AI Enhancement Buttons */}
          <Tooltip title="Compare AI Models">
            <IconButton size="small" onClick={() => setShowModelComparison(true)}>
              <CompareArrows fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Prompt Templates">
            <IconButton size="small" onClick={() => setShowPromptTemplates(true)}>
              <Description fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Usage Analytics">
            <IconButton size="small" onClick={() => setShowUsageAnalytics(true)}>
              <AttachMoney fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Local AI Models">
            <IconButton size="small" onClick={() => setShowLocalModels(true)}>
              <Computer fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Debug Assistant">
            <IconButton size="small" onClick={() => setShowDebugAssistant(true)}>
              <BugReport fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Multi-File Context">
            <IconButton size="small" onClick={() => setShowMultiFileContext(true)}>
              <Folder fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {/* 📸 AI Vision Code Generator */}
          <Tooltip title="Screenshot → Code (AI Vision)">
            <IconButton
              size="small"
              onClick={() => setShowVisionCodeGen(true)}
              sx={{
                bgcolor: 'primary.main',
                color: 'white', '&:hover': { bgcolor: 'primary.dark' }}}
            >
              <PhotoCamera fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          <Button
            startIcon={<CloudUpload />}
            variant="outlined"
            size="small"
            onClick={handleExportToBackend}
          >
            Generate Backend
          </Button>

          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
        <Tab icon={<Code fontSize="small" />} label="Frontend Code" iconPosition="start" />
        <Tab icon={<Storage fontSize="small" />} label="Backend Code" iconPosition="start" />
      </Tabs>

      {/* Parse Errors/Warnings */}
      {(parseErrors.length > 0 || parseWarnings.length > 0) && activeTab === 0 && (
        <Box sx={{ px: 2, py: 1, bgcolor: '#fff3cd', borderBottom: 1, borderColor: 'divider' }}>
          {parseErrors.map((error, idx) => (
            <Alert key={`error-${idx}`} severity="error" sx={{ mb: 0.5 }}>
              Line {error.line}: {error.message}
            </Alert>
          ))}
          {parseWarnings.map((warning, idx) => (
            <Alert key={`warning-${idx}`} severity="warning" sx={{ mb: 0.5 }}>
              {warning.message} - {warning.suggestion}
            </Alert>
          ))}
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Frontend Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', height: '100%' }}>
            {/* Code Editor */}
            {(viewMode === 'split' || viewMode === 'editor') && (
              <Box
                sx={{
                  flex: viewMode === 'split' ? 1 : 2,
                  borderRight: viewMode === 'split' ? 1 : 0,
                  borderColor: 'divider'}}>
                <CodeEditorPanel onCodeChange={handleCodeChange} readOnly={false} />
              </Box>
            )}

            {/* Live Preview */}
            {(viewMode === 'split' || viewMode === 'preview') && (
              <Box sx={{ flex: 1, position: 'relative' }}>
                {/* 🔥 Hot Reload Indicator */}
                <HotReloadIndicator visible={hotReload.state.isReloading} />

                <LivePreviewPanel code={generatedCode} mode={exportFormat} />
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Backend Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
            {backendCode ? (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Backend code generated successfully for {backendCode.service}
                </Alert>

                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Backend Service
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Service: {backendCode.service}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Environment: {backendCode.environment}
                  </Typography>
                </Paper>

                <Box
                  component="pre"
                  sx={{
                    bgcolor: '#1E1E1E',
                    color: '#D4D4D4',
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    fontFamily: 'Monaco, Consolas, monospace',
                    fontSize: '13px'}}>
                  <code>{JSON.stringify(backendCode, null, 2)}</code>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Storage sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Backend Code Yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Click "Generate Backend" to create backend code from your frontend
                </Typography>
                <Button
                  startIcon={<PlayArrow />}
                  variant="contained"
                  onClick={handleExportToBackend}
                >
                  Generate Backend Code
                </Button>
              </Box>
            )}

            {/* Embedded Code Generation Studio */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Code Generation Studio
              </Typography>
              <Paper variant="outlined" sx={{ p: 0 }}>
                <CodeGenerationStudio />
              </Paper>
            </Box>
          </Box>
        </TabPanel>
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.75,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: '#f5f5f5',
          fontSize: '0.75rem'}}>
        {/* 🔥 Hot Reload Stats */}
        <Typography variant="caption">
          Hot Reload: {hotReload.state.reloadCount} reloads
          {hotReload.state.lastReloadTime > 0 &&
            ` • Last: ${new Date(hotReload.state.lastReloadTime).toLocaleTimeString()}`}
          {hotReload.state.errors.length > 0 && ` • ${hotReload.state.errors.length} error(s)`}
        </Typography>
        <Typography variant="caption">
          {state.elements?.length || 0} elements • {generatedCode.react?.split('\n').length || 0}{' '}
          lines
          {aiCompletion.isConfigured && (
            <Chip
              icon={<AutoAwesome fontSize="small" />}
              label="AI Ready"
              size="small"
              color="success"
              sx={{ ml: 1, height: 18 }} />
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {viewMode.toUpperCase()} MODE • {exportFormat.toUpperCase()}
        </Typography>
      </Box>

      {/* 🤖 AI Settings Dialog */}
      <AISettingsDialog
        open={showAISettings}
        onClose={() => setShowAISettings(false)}
        config={aiCompletion.updateConfig ? ({} as Record<string, unknown>) : ({} as Record<string, unknown>)}
        onSave={(config, apiKey) => {
          if (apiKey) {
            aiCompletion.setApiKey(apiKey);
          }
          if (aiCompletion.updateConfig) {
            aiCompletion.updateConfig(config);
          }
          analytics.trackEvent('ai_settings_saved', { provider: config.provider });
        }}
        isConfigured={aiCompletion.isConfigured}
      />

      {/* 🤖 AI Completion Panel */}
      <AICompletionPanel
        open={showAIPanel}
        onClose={() => setShowAIPanel(false)}
        currentCode={generatedCode.react || ''}
        language="typescript"
        cursor={currentCursor}
        selectedText={currentSelectedText}
        elements={state.elements}
        onApplyCode={handleAIApplyCode}
        onGetCompletions={aiCompletion.getCompletions}
        onGenerateComponent={aiCompletion.generateComponent}
        onSuggestRefactoring={aiCompletion.suggestRefactoring}
        onExplainCode={aiCompletion.explainCode}
        isLoading={aiCompletion.isLoading}
        error={aiCompletion.error}
      />

      {/* ✨ NEW: AI Enhancement Dialogs */}
      <AIModelComparison
        open={showModelComparison}
        onClose={() => setShowModelComparison(false)}
        currentCode={generatedCode.react || ''}
        operation="code_completion"
        onApplyResult={(code) => {
          handleCodeChange(code, 'react');
          setShowModelComparison(false);
        }}
      />

      <AIPromptTemplates
        open={showPromptTemplates}
        onClose={() => setShowPromptTemplates(false)}
        onApplyTemplate={(template) => {
          // Template applied - could trigger AI with the template
          analytics.trackEvent('prompt_template_used', { template: template.name });
        }}
      />

      <AIUsageAnalytics open={showUsageAnalytics} onClose={() => setShowUsageAnalytics(false)} />

      <AILocalModelProvider
        open={showLocalModels}
        onClose={() => setShowLocalModels(false)}
        onModelActivated={(config) => {
          analytics.trackEvent('local_model_activated', { provider: config.provider });
        }}
      />

      <AIDebugAssistant
        open={showDebugAssistant}
        onClose={() => setShowDebugAssistant(false)}
        code={generatedCode.react || ''}
        language="typescript"
        framework="react"
        onApplyFix={(fixedCode) => {
          handleCodeChange(fixedCode, 'react');
          analytics.trackEvent('debug_fix_applied');
        }}
      />

      <AIMultiFileContext
        open={showMultiFileContext}
        onClose={() => setShowMultiFileContext(false)}
        projectId="visual-editor-project"
        onContextSaved={(context) => {
          analytics.trackEvent('multi_file_context_saved', { fileCount: context.files?.length });
        }}
      />

      {/* 📸 AI Vision Code Generator */}
      <AIVisionCodeGenerator
        open={showVisionCodeGen}
        onClose={() => setShowVisionCodeGen(false)}
        onCodeGenerated={(code) => {
          handleCodeChange(code, 'react');
          analytics.trackEvent('vision_code_generated');
          setShowVisionCodeGen(false);
        }}
      />
    </Box>
  );
};
