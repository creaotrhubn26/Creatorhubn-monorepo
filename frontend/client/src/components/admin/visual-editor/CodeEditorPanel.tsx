/**
 * Code Editor Panel - View and edit generated code
 * Supports HTML, React, CSS, and JavaScript with Monaco Editor
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  Typography,
  ButtonGroup,
  Button,
  Divider,
  Switch,
  FormControlLabel,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Code,
  ContentCopy,
  Download,
  Refresh,
  FormatAlignLeft,
  Visibility,
  Settings,
  DarkMode,
  LightMode,
  Undo,
  Redo,
  Search,
  MoreVert,
  History,
  CompareArrows,
  Extension,
} from '@mui/icons-material';
import { useVisualEditor } from './VisualEditorContext';
import Editor from '@monaco-editor/react';
import prettier from 'prettier/standalone';
import prettierBabel from 'prettier/parser-babel';
import prettierHtml from 'prettier/parser-html';
import prettierCss from 'prettier/parser-postcss';

interface CodeEditorPanelProps {
  onCodeChange?: (code: string, language: string) => void;
  readOnly?: boolean;
}

type EditorTheme = 'vs-dark' | 'vs-light' | 'hc-black';

interface VersionHistory {
  id: string;
  code: string;
  timestamp: number;
  message?: string;
}

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

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  onCodeChange,
  readOnly = false,
}) => {
  const { state, dispatch } = useVisualEditor();
  const [activeTab, setActiveTab] = useState(0);
  const [exportFormat, setExportFormat] = useState<'html' | 'react' | 'vue'>('react');
  const [code, setCode] = useState({
    html:  ',',
    react: '',
    css: '',
    javascript: '',
  });
  const [editorTheme, setEditorTheme] = useState<EditorTheme>('vs-dark');
  const [showMinimap, setShowMinimap] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const editorRef = useRef<any>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [liveSync, setLiveSync] = useState(true);

  // Generate code from canvas elements
  useEffect(() => {
    generateCode();
  }, [state.elements, exportFormat]);

  const generateCode = () => {
    if (exportFormat === 'html') {
      setCode({
        html: generateHTML(),
        react: '',
        css: generateCSS(),
        javascript: generateJS(),
      });
    } else if (exportFormat === 'react') {
      setCode({
        html: ',',
        react: generateReact(),
        css: generateCSS(),
        javascript: '',
      });
    }
  };

  const generateHTML = () => {
    if (state.elements.length === 0) {
      return '<!-- No elements on canvas -->\n<div class="container">\n  <!-- Drag components to canvas to generate HTML -->\n</div>';
    }

    let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '  <meta charset="UTF-8">\n';
    html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html += '  <title>Generated Page</title>\n';
    html += '  <link rel="stylesheet" href="styles.css">\n';
    html += '</head>\n<body>\n\n';

    // Generate HTML for each element
    state.elements.forEach((element) => {
      html += generateElementHTML(element);
    });

    html += '\n  <script src="script.js"></script>\n';
    html += '</body>\n</html>';

    return html;
  };

  const generateElementHTML = (element: unknown): string => {
    const styles = `style="position: absolute; left: ${element.x}px; top: ${element.y}px; width: ${element.width}px; height: ${element.height}px;"`;

    switch (element.type) {
      case 'button': return `  <button ${styles} class="btn-${element.id},">${element.props.text || 'Button'}</button>\n`;
      case 'text': return `  <p ${styles} class="text-${element.id},">${element.props.text || 'Text'}</p>\n`;
      case 'container': return `  <div ${styles} class="container-${element.id},">\n    <!-- Container content -->\n  </div>\n`;
      case 'image': return `  <img ${styles} class="img-${element.id}" src="${element.props.src || 'placeholder.jpg'}" alt="${element.props.alt || 'Image'}">\n`;
      default: return `  <div ${styles} class="element-${element.id}"></div>\n`;
    }
  };

  const generateReact = () => {
    if (state.elements.length === 0) {
      return `import React from 'react';\nimport'./styles.css';\n\nexport default function GeneratedComponent() {\n  return (\n    <div className="container">\n      {/* Drag components to canvas to generate React code */}\n    </div>\n  );\n}`;
    }

    let jsx = `import React, { useState } from 'react';\nimport'./styles.css';\n\n`;
    jsx += `export default function GeneratedComponent() {\n`;
    jsx += `  // State management\n`;
    jsx += `  const [state, setState] = useState({});\n\n`;
    jsx += `  // Event handlers\n`;
    jsx += `  const handleClick = (id) => {\n    console.log('Clicked: ', id);\n  };\n\n`;
    jsx += `  return (\n`;
    jsx += `    <div className="container" style={{ position: 'relative', width: '100%', height: '100%' }}>\n`;

    state.elements.forEach((element) => {
      jsx += generateElementReact(element);
    });

    jsx += `    </div>\n`;
    jsx += `  );\n`;
    jsx += `}`;

    return jsx;
  };

  const generateElementReact = (element: unknown): string => {
    const style = `{{ position: 'absolute', left: ${element.x}, top: ${element.y}, width: ${element.width}, height: ${element.height} }`;
    const className = `"${element.type}-${element.id}"`;

    switch (element.type) {
      case 'button': return `      <button style=${style} className=${className} onClick={() => handleClick('${element.id},')}>\n        ${element.props.text || 'Button'}\n      </button>\n`;
      case 'text': return `      <p style=${style} className=${className}>${element.props.text || 'Text'}</p>\n`;
      case 'container': return `      <div style=${style} className=${className}>\n        {/* Container content */}\n      </div>\n`;
      case 'image': return `      <img style=${style} className=${className} src="${element.props.src || 'placeholder.jpg'}" alt="${element.props.alt || 'Image'}" />\n`;
      default: return `      <div style=${style} className=${className}></div>\n`;
    }}
  };

  const generateCSS = () => {
    if (state.elements.length === 0) {
      return '/* No elements on canvas */\n\n.container {\n  width: 100%;\n  height: 100vh;\n , background: #f5f5f5;\n}, ';
    }

    let css = '/* Generated Styles */\n\n';
    css += '* {\n  margin: 0;\n , padding: 0;\n  box-sizing: border-box;\n}\n\n';
    css +=
      'body {\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n}\n\n';
    css += '.container {\n  width: 100%;\n  min-height: 100vh;\n , position: relative;\n}\n\n';

    state.elements.forEach((element) => {
      css += `.${element.type}-${element.id} {\n`;
      if (element.styles.backgroundColor) {
        css += `  background-color: ${element.styles.backgroundColor};\n`;
      }
      if (element.styles.color) {
        css += `  color: ${element.styles.color};\n`;
      }
      if (element.styles.borderRadius) {
        css += `  border-radius: ${element.styles.borderRadius};\n`;
      }
      if (element.styles.fontSize) {
        css += `  font-size: ${element.styles.fontSize};\n`;
      }
      if (element.styles.fontWeight) {
        css += `  font-weight: ${element.styles.fontWeight};\n`;
      }
      css += `}\n\n`;
    });

    return css;
  };

  const generateJS = () => {
    let js = '// Generated JavaScript\n\n';
    js += 'document.addEventListener("DOMContentLoaded", function() {\n';
    js += '  console.log("Page loaded successfully");\n\n';

    state.elements.forEach((element) => {
      if (element.type === 'button') {
        js += `  // Button: ${element.id}\n`;
        js += `  document.querySelector('.btn-${element.id},')?.addEventListener('click', function() {\n`;
        js += `    console.log('Button clicked: ${element.id}');\n`;
        js += `    // Add your custom logic here\n`;
        js += `  });\n\n`;
      }
    });

    js += '});';
    return js;
  };

  const handleCopy = () => {
    const currentCode =
      activeTab === 0
        ? exportFormat === 'react'
          ? code.react
          : code.html
        : activeTab === 1
          ? code.css
          : code.javascript;
    navigator.clipboard.writeText(currentCode);
  };

  const handleDownload = () => {
    const currentCode =
      activeTab === 0
        ? exportFormat === 'react'
          ? code.react
          : code.html
        : activeTab === 1
          ? code.css
          : code.javascript;
    const extension =
      activeTab === 0
        ? exportFormat === 'react'
          ? 'jsx'
          : 'html'
        : activeTab === 1
          ? 'css'
          : 'js';
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-code.${extension}`;
    a.click();
  };

  const handleFormat = async () => {
    try {
      const currentCode =
        activeTab === 0
          ? exportFormat === 'react'
            ? code.react
            : code.html
          : activeTab === 1
            ? code.css
            : code.javascript;
      const parser =
        activeTab === 0
          ? exportFormat === 'react'
            ? 'babel'
            : 'html'
          : activeTab === 1
            ? 'css'
            : 'babel';

      const formatted = prettier.format(currentCode, {
        parser,
        plugins: [prettierBabel, prettierHtml, prettierCss],
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        printWidth: 80,
      });

      if (activeTab === 0) {
        setCode((prev) => ({
          ...prev,
          [exportFormat === 'react' ? 'react' : 'html']: formatted,
        }));
      } else if (activeTab === 1) {
        setCode((prev) => ({ ...prev, css: formatted }));
      } else {
        setCode((prev) => ({ ...prev, javascript: formatted }));
      }
    } catch (error) {
      console.error('Format error: ', error);
    }
  };

  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor;

    // Add custom keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveVersion();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.trigger('keyboard', 'actions.find');
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !liveSync) return;

    const newCode = { ...code };
    if (activeTab === 0) {
      if (exportFormat === 'react') {
        newCode.react = value;
      } else {
        newCode.html = value;
      }
    } else if (activeTab === 1) {
      newCode.css = value;
    } else {
      newCode.javascript = value;
    }

    setCode(newCode);

    if (onCodeChange) {
      const lang = activeTab === 0 ? exportFormat : activeTab === 1 ? 'css' : 'javascript';
      onCodeChange(value, lang);
    }

    // Auto-save to history
    if (autoSave) {
      const timeoutId = setTimeout(() => {
        handleSaveVersion('Auto-save');
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSaveVersion = (message?: string) => {
    const currentCode =
      activeTab === 0
        ? exportFormat === 'react'
          ? code.react
          : code.html
        : activeTab === 1
          ? code.css
          : code.javascript;

    const newVersion: VersionHistory = {
      id: Date.now().toString(),
      code: currentCode,
      timestamp: Date.now(),
      message,
    };

    setVersionHistory((prev) => [newVersion, ...prev.slice(0, 19)]); // Keep last 20 versions
  };

  const handleRestoreVersion = (version: VersionHistory) => {
    if (activeTab === 0) {
      setCode((prev) => ({
        ...prev,
        [exportFormat === 'react' ? 'react' : 'html']: version.code,
      }));
    } else if (activeTab === 1) {
      setCode((prev) => ({ ...prev, css: version.code }));
    } else {
      setCode((prev) => ({ ...prev, javascript: version.code }));
    }
  };

  const handleThemeToggle = () => {
    setEditorTheme((prev) => (prev === 'vs-dark' ? 'vs-light' : 'vs-dark'));
  };

  const handleUndo = () => {
    editorRef.current?.trigger('keyboard', 'undo');
  };

  const handleRedo = () => {
    editorRef.current?.trigger('keyboard', 'redo');
  };

  const handleSearch = () => {
    editorRef.current?.trigger('keyboard', 'actions.find');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1E1E1E' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          bgcolor: '#252526',
          borderBottom: '1px solid #3E3E42'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code sx={{ color: '#569CD6', fontSize: 20 }} />
          <Typography variant="body2" sx={{ color: '#CCCCCC', fontWeight: 600}}>
            Code Editor
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'html' | 'react' | 'vue')}
            size="small"
            sx={{
              color: '#CCCCCC',
              bgcolor: '#3C3C3C','& .MuiOutlinedInput-notchedOutline': { border: 'none' }, '& .MuiSelect-icon': { color: '#CCCCCC' }}}
          >
            <MenuItem value="html">HTML</MenuItem>
            <MenuItem value="react">React</MenuItem>
            <MenuItem value="vue">Vue</MenuItem>
          </Select>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: '#3E3E42' }} />

          <ButtonGroup size="small">
            <Tooltip title="Undo">
              <IconButton onClick={handleUndo} size="small" sx={{ color: '#CCCCCC' }}>
                <Undo fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo">
              <IconButton onClick={handleRedo} size="small" sx={{ color: '#CCCCCC' }}>
                <Redo fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Search">
              <IconButton onClick={handleSearch} size="small" sx={{ color: '#CCCCCC' }}>
                <Search fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: '#3E3E42' }} />

          <ButtonGroup size="small">
            <Tooltip title="Copy Code">
              <IconButton onClick={handleCopy} size="small" sx={{ color: '#CCCCCC' }}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton onClick={handleDownload} size="small" sx={{ color: '#CCCCCC' }}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Format Code">
              <IconButton onClick={handleFormat} size="small" sx={{ color: '#CCCCCC' }}>
                <FormatAlignLeft fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={generateCode} size="small" sx={{ color: '#CCCCCC' }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ bgcolor: '#3E3E42' }} />

          <Tooltip title={editorTheme === 'vs-dark' ? 'Light Theme' : 'Dark Theme'}>
            <IconButton onClick={handleThemeToggle} size="small" sx={{ color: '#CCCCCC' }}>
              {editorTheme === 'vs-dark' ? (
                <LightMode fontSize="small" />
              ) : (
                <DarkMode fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="More Options">
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
              sx={{ color: '#CCCCCC' }}>
              <MoreVert fontSize="small" />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              sx: { bgcolor: '#252526', color: '#CCCCCC' }}}
          >
            <MenuItem
              onClick={() => {
                handleSaveVersion();
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <History fontSize="small" sx={{ color: '#CCCCCC' }} />
              </ListItemIcon>
              <ListItemText>Save Version</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => setSettingsOpen(!settingsOpen)}>
              <ListItemIcon>
                <Settings fontSize="small" sx={{ color: '#CCCCCC' }} />
              </ListItemIcon>
              <ListItemText>Editor Settings</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{
          bgcolor: '#252526',
          minHeight: 36, '& .MuiTab-root': { color: '#969696',
            minHeight: 36,
            textTransform: 'none',
            fontSize: '0.8125rem','&.Mui-selected': {
              color: '#FFFFFF',
            },
          }, '& .MuiTabs-indicator': {
            bgcolor: '#007ACC',
          }}}
      >
        <Tab label={exportFormat === 'react' ? 'Component.jsx' : 'index.html'} />
        <Tab label="styles.css" />
        {exportFormat === 'html' && <Tab label="script.js" />}
      </Tabs>

      {/* Code Editor */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TabPanel value={activeTab} index={0}>
            <Editor
              height="100%"
              language={exportFormat === 'react' ? 'typescript' : 'html'}
              value={exportFormat === 'react' ? code.react : code.html}
              theme={editorTheme}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: showMinimap },
                wordWrap: wordWrap ? 'on' : 'off',
                fontSize: fontSize,
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                readOnly: readOnly,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                folding: true,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                bracketPairColorization: { enabled: true },
              }
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Editor
              height="100%"
              language="css"
              value={code.css}
              theme={editorTheme}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: showMinimap },
                wordWrap: wordWrap ? 'on' : 'off',
                fontSize: fontSize,
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                readOnly: readOnly,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
              }
            />
          </TabPanel>

          {exportFormat === 'html' && (
            <TabPanel value={activeTab} index={2}>
              <Editor
                height="100%"
                language="javascript"
                value={code.javascript}
                theme={editorTheme}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: showMinimap },
                  wordWrap: wordWrap ? 'on' : 'off',
                  fontSize: fontSize,
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  readOnly: readOnly,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  formatOnPaste: true,
                  formatOnType: true,
                }
              />
            </TabPanel>
          )}
        </Box>

        {/* Settings Sidebar */}
        {settingsOpen && (
          <Box
            sx={{
              width: 280,
              bgcolor: '#252526',
              borderLeft: '1px solid #3E3E42',
              p: 2,
              overflowY: 'auto'}}>
            <Typography variant="subtitle2" sx={{ color: '#CCCCCC', mb: 2, fontWeight: 600}}>
              Editor Settings
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={showMinimap}
                  onChange={(e) => setShowMinimap(e.target.checked)}
                  size="small"
                />
              }}
              label="Show Minimap"
              sx={{ color: '#CCCCCC', mb: 1, display: 'flex' }} />

            <FormControlLabel
              control={
                <Switch
                  checked={wordWrap}
                  onChange={(e) => setWordWrap(e.target.checked)}
                  size="small"
                />
              }}
              label="Word Wrap"
              sx={{ color: '#CCCCCC', mb: 1, display: 'flex' }} />

            <FormControlLabel
              control={
                <Switch
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  size="small"
                />
              }}
              label="Auto Save"
              sx={{ color: '#CCCCCC', mb: 1, display: 'flex' }} />

            <FormControlLabel
              control={
                <Switch
                  checked={liveSync}
                  onChange={(e) => setLiveSync(e.target.checked)}
                  size="small"
                />
              }}
              label="Live Sync"
              sx={{ color: '#CCCCCC', mb: 2, display: 'flex' }} />

            <Typography variant="caption" sx={{ color: '#969696', display: 'block', mb: 1 }}>
              Font Size: {fontSize}px
            </Typography>
            <input
              type="range"
              min="10"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value)}
              style={{ width: '100%', marginBottom: 16 }} />

            {versionHistory.length > 0 && (
              <>
                <Divider sx={{ bgcolor: '#3E3E42', my: 2 }} />
                <Typography variant="subtitle2" sx={{ color: '#CCCCCC', mb: 1, fontWeight: 600}}>
                  Version History
                </Typography>
                {versionHistory.slice(0, 5).map((version) => (
                  <Box
                    key={version.id}
                    onClick={() => handleRestoreVersion(version)}
                    sx={{
                      p: 1,
                      mb: 1,
                      bgcolor: '#1E1E1E',
                      borderRadius: 1,
                      cursor: 'pointer', '&:hover': { bgcolor: '#2D2D30' }}}
                  >
                    <Typography variant="caption" sx={{ color: '#CCCCCC', display: 'block' }}>
                      {version.message || 'Untitled'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#969696', fontSize: '0.7rem' }}>
                      {new Date(version.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.5
         , bgcolor: '#007ACC',
          color: 'white',
          fontSize: '0.75rem'}}>
        <Typography variant="caption" sx={{ color: 'white' }}>
          {state.elements.length} element{state.elements.length !== 1 ? 's' : ','} •{''}
          {exportFormat.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: 'white' }}>
          {readOnly ? 'Read Only' : 'Editable'}
        </Typography>
      </Box>
    </Box>
  );
};
