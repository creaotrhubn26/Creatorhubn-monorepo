/**
 * Code Synchronization System
 * Handles bidirectional sync between visual editor and TSX/MDX code
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Code,
  Compare,
  Download,
  Error as ErrorIcon,
  Settings,
  Sync,
  Upload,
  Visibility,
  VisibilityOff,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '@/utils/theming-helper';
import type { EditorElement, Project } from './VisualEditorContext';

interface CodeSyncState {
  lastSync: Date | null;
  hasChanges: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  codeStyle: CodeStyleSettings;
}

interface CodeStyleSettings {
  indentSize: number;
  useSpaces: boolean;
  quoteStyle: 'single' | 'double';
  semicolons: boolean;
  trailingCommas: boolean;
  maxLineLength: number;
  importOrder: string[];
}

interface GeneratedCode {
  tsx: string;
  mdx: string;
  imports: string[];
  types: string;
}

interface CodeSyncSystemProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
  onCodeUpdate: (code: string, type: 'tsx' | 'mdx') => void;
}

const toComponentName = (name: string): string => {
  const normalized = name
    .trim()
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
  return normalized || 'GeneratedProject';
};

const getElementText = (element: EditorElement, fallback: string): string => {
  const textValue = element.props.text;
  return typeof textValue === 'string' && textValue.trim().length > 0 ? textValue : fallback;
};

const getImageSrc = (element: EditorElement): string => {
  const srcValue = element.props.src;
  if (typeof srcValue === 'string' && srcValue.trim().length > 0) {
    return srcValue;
  }
  return '';
};

const serializeStyleValue = (value: unknown, quote: "'" | '"'): string => {
  if (typeof value === 'string') {
    return `${quote}${value}${quote}`;
  }
  return JSON.stringify(value);
};

const serializePropValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return `{${JSON.stringify(value)}}`;
};

export const CodeSyncSystem: React.FC<CodeSyncSystemProps> = ({
  project,
  onProjectUpdate,
  onCodeUpdate,
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');

  const [syncState, setSyncState] = useState<CodeSyncState>({
    lastSync: null,
    hasChanges: false,
    syncStatus: 'idle',
    codeStyle: {
      indentSize: 2,
      useSpaces: true,
      quoteStyle: 'single',
      semicolons: true,
      trailingCommas: true,
      maxLineLength: 100,
      importOrder: ['react', '@mui/material', '@mui/icons-material', './components', './utils'],
    },
  });
  const [activeTab, setActiveTab] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [importText, setImportText] = useState('');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode>({
    tsx: '',
    mdx: '',
    imports: [],
    types: '',
  });

  useEffect(() => {
    lifecycle.registerComponent({
      id: 'code-sync-system',
      type: 'code-sync',
      version: '1.0.0',
      capabilities: {
        data: ['code:generate', 'code:parse', 'code:validate'],
        events: ['code:generated', 'code:imported', 'code:synced'],
        actions: ['code:sync-to', 'code:sync-from'],
        ui: ['code:tabs', 'code:settings'],
        system: ['analytics:track', 'performance:monitor'],
      },
      dependencies: ['@mui/material'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('code_sync_system_mounted', {
      projectId: project.id,
      elementsCount: project.elements.length,
      timestamp: Date.now(),
    });

    return () => {
      lifecycle.unregisterComponent('code-sync-system');
      analytics.trackEvent('code_sync_system_unmounted', {
        projectId: project.id,
        timestamp: Date.now(),
      });
    };
  }, [analytics, lifecycle, project.elements.length, project.id]);

  const quoteCharacter = syncState.codeStyle.quoteStyle === 'single' ? "'" : '"';
  const indent = useMemo(
    () => (syncState.codeStyle.useSpaces ? ' ' : '\t').repeat(syncState.codeStyle.indentSize),
    [syncState.codeStyle.indentSize, syncState.codeStyle.useSpaces],
  );
  const lineEnd = syncState.codeStyle.semicolons ? ';' : '';

  const generateImports = useCallback((currentProject: Project): string[] => {
    const muiImports = new Set<string>(['Box']);

    currentProject.elements.forEach((element) => {
      switch (element.type) {
        case 'button':
          muiImports.add('Button');
          break;
        case 'text':
          muiImports.add('Typography');
          break;
        case 'card':
          muiImports.add('Card');
          muiImports.add('CardContent');
          break;
        case 'grid':
          muiImports.add('Grid');
          break;
        case 'container':
        case 'image':
        case 'audio':
        case 'video':
          muiImports.add('Box');
          break;
        default:
          muiImports.add('Box');
      }
    });

    return Array.from(muiImports).sort();
  }, []);

  const generateImportBlock = useCallback(
    (currentProject: Project): string => {
      const muiImports = generateImports(currentProject);
      return [
        "import React from 'react';",
        `import { ${muiImports.join(', ')} } from '@mui/material';`,
      ].join('\n');
    },
    [generateImports],
  );

  const generateElementCode = useCallback(
    (element: EditorElement): string => {
      const styleEntries = Object.entries(element.styles)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}: ${serializeStyleValue(value, quoteCharacter)}`);

      const styleProp = styleEntries.length > 0 ? ` sx={{ ${styleEntries.join(', ')} }}` : '';

      const propEntries = Object.entries(element.props).filter(
        ([key, value]) => key !== 'text' && key !== 'src' && value !== undefined && value !== null,
      );
      const propsString = propEntries
        .map(([key, value]) => ` ${key}=${serializePropValue(value)}`)
        .join('');

      switch (element.type) {
        case 'button':
          return `${indent}<Button${styleProp}${propsString}>${getElementText(element, 'Button')}</Button>`;
        case 'text':
          return `${indent}<Typography${styleProp}${propsString}>${getElementText(element, 'Text')}</Typography>`;
        case 'image':
          return `${indent}<Box component="img"${styleProp}${propsString} src=${JSON.stringify(getImageSrc(element))} />`;
        case 'card':
          return `${indent}<Card${styleProp}${propsString}>\n${indent.repeat(2)}<CardContent>\n${indent.repeat(3)}${getElementText(
            element,
            'Card content',
          )}\n${indent.repeat(2)}</CardContent>\n${indent}</Card>`;
        case 'grid':
          return `${indent}<Grid container${styleProp}${propsString}>{/* Grid items */}</Grid>`;
        case 'container':
          return `${indent}<Box${styleProp}${propsString}>{/* Container content */}</Box>`;
        case 'audio':
          return `${indent}<Box component="audio"${styleProp}${propsString} controls />`;
        case 'video':
          return `${indent}<Box component="video"${styleProp}${propsString} controls />`;
        default:
          return `${indent}<Box${styleProp}${propsString}>{/* ${element.type} */}</Box>`;
      }
    },
    [indent, quoteCharacter],
  );

  const generateProjectTSX = useCallback(
    (currentProject: Project): string => {
      const componentName = toComponentName(currentProject.name);
      const imports = generateImportBlock(currentProject);
      const body = currentProject.elements.map(generateElementCode).join('\n');
      const canvas = currentProject.settings;

      return `${imports}

interface ${componentName}Props {}

const ${componentName}: React.FC<${componentName}Props> = () => {
  return (
    <Box
      sx={{
        width: ${canvas.width},
        height: ${canvas.height},
        backgroundColor: ${JSON.stringify(canvas.backgroundColor)},
        position: 'relative',
      }}
    >
${body || `${indent}{/* No elements yet */}`}
    </Box>
  )${lineEnd}
}

export default ${componentName}${lineEnd}
`;
    },
    [generateElementCode, generateImportBlock, indent, lineEnd],
  );

  const generateProjectMDX = useCallback(
    (currentProject: Project): string => {
      const imports = generateImportBlock(currentProject);
      const body = currentProject.elements.map(generateElementCode).join('\n');
      return `${imports}

# ${currentProject.name}

${currentProject.description ?? ''}

${body}
`;
    },
    [generateElementCode, generateImportBlock],
  );

  const generateTypes = useCallback((currentProject: Project): string => {
    const elementTypes = Array.from(new Set(currentProject.elements.map((element) => element.type)));
    const projectName = toComponentName(currentProject.name);

    return `export interface EditorElement {
  id: string;
  type: ${elementTypes.map((type) => `'${type}'`).join(' | ')};
  x: number;
  y: number;
  width: number;
  height: number;
  styles: React.CSSProperties;
  props: Record<string, unknown>;
  children?: string[];
  parent?: string;
}

export interface ${projectName}Project {
  id: string;
  name: string;
  elements: EditorElement[];
  settings: {
    width: number;
    height: number;
    backgroundColor: string;
    gridSize: number;
    snapToGrid: boolean;
  };
}
`;
  }, []);

  const parseTSX = useCallback(
    (code: string): Project => {
      const lines = code.split('\n');
      const parsedElements: EditorElement[] = [];

      lines.forEach((line, index) => {
        if (line.includes('<Button') || line.includes('<Typography') || line.includes('<Card')) {
          const elementType: EditorElement['type'] = line.includes('<Button')
            ? 'button'
            : line.includes('<Typography')
              ? 'text'
              : 'card';

          parsedElements.push({
            id: `element_${index}`,
            type: elementType,
            x: 0,
            y: index * 50,
            width: 220,
            height: 60,
            styles: {},
            props: {},
          });
        }
      });

      return {
        ...project,
        elements: parsedElements,
        settings: {
          width: project.settings.width,
          height: project.settings.height,
          backgroundColor: project.settings.backgroundColor,
          gridSize: project.settings.gridSize,
          snapToGrid: project.settings.snapToGrid,
        },
        metadata: {
          ...project.metadata,
          lastModified: new Date(),
          version: project.metadata.version + 1,
        },
        status: 'draft',
      };
    },
    [project],
  );

  const validateCode = useCallback((code: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!code.includes('import React')) {
      errors.push('Missing React import');
    }

    if (!code.includes('export default')) {
      errors.push('Missing default export');
    }

    const openTagCount = (code.match(/</g) || []).length;
    const closeTagCount = (code.match(/>/g) || []).length;
    if (openTagCount !== closeTagCount) {
      errors.push('Mismatched JSX tag delimiters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }, []);

  const handleGenerateCode = useCallback(() => {
    const endTiming = performance.startTiming('code_generation');

    try {
      const tsx = generateProjectTSX(project);
      const mdx = generateProjectMDX(project);
      const imports = generateImports(project);
      const types = generateTypes(project);

      setGeneratedCode({ tsx, mdx, imports, types });
      setSyncState((prev) => ({
        ...prev,
        lastSync: new Date(),
        hasChanges: false,
        syncStatus: 'success',
      }));

      analytics.trackEvent('code_generated', {
        projectId: project.id,
        elementsCount: project.elements.length,
        codeLength: tsx.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      debugging.logIntegration('error', 'Code generation failed', { error });
      setSyncState((prev) => ({ ...prev, syncStatus: 'error' }));
    } finally {
      endTiming();
    }
  }, [analytics, debugging, generateImports, generateProjectMDX, generateProjectTSX, generateTypes, performance, project]);

  const handleImportCode = useCallback(
    (code: string, type: 'tsx' | 'mdx') => {
      const endTiming = performance.startTiming('code_import');

      try {
        const validation = validateCode(code);
        if (!validation.valid) {
          throw new globalThis.Error(`Code validation failed: ${validation.errors.join(', ')}`);
        }

        const parsedProject = type === 'tsx' ? parseTSX(code) : project;
        onProjectUpdate(parsedProject);

        setSyncState((prev) => ({
          ...prev,
          lastSync: new Date(),
          hasChanges: false,
          syncStatus: 'success',
        }));

        analytics.trackEvent('code_imported', {
          projectId: project.id,
          codeType: type,
          elementsCount: parsedProject.elements.length,
          timestamp: Date.now(),
        });
      } catch (error) {
        debugging.logIntegration('error', 'Code import failed', { error });
        setSyncState((prev) => ({ ...prev, syncStatus: 'error' }));
      } finally {
        endTiming();
      }
    },
    [analytics, debugging, onProjectUpdate, parseTSX, performance, project, validateCode],
  );

  const handleSyncToCode = useCallback(() => {
    setSyncState((prev) => ({ ...prev, syncStatus: 'syncing' }));
    try {
      const code = generateProjectTSX(project);
      onCodeUpdate(code, 'tsx');
      setSyncState((prev) => ({
        ...prev,
        syncStatus: 'success',
        lastSync: new Date(),
        hasChanges: false,
      }));
      analytics.trackEvent('code_sync_visual_to_code', { projectId: project.id, timestamp: Date.now() });
    } catch (error) {
      debugging.logIntegration('error', 'Sync visual to code failed', { error });
      setSyncState((prev) => ({ ...prev, syncStatus: 'error' }));
    }
  }, [analytics, debugging, generateProjectTSX, onCodeUpdate, project]);

  const handleSyncFromCode = useCallback(
    (code: string) => {
      setSyncState((prev) => ({ ...prev, syncStatus: 'syncing' }));
      try {
        const parsedProject = parseTSX(code);
        onProjectUpdate(parsedProject);
        setSyncState((prev) => ({
          ...prev,
          syncStatus: 'success',
          lastSync: new Date(),
          hasChanges: false,
        }));
        analytics.trackEvent('code_sync_code_to_visual', { projectId: project.id, timestamp: Date.now() });
      } catch (error) {
        debugging.logIntegration('error', 'Sync code to visual failed', { error });
        setSyncState((prev) => ({ ...prev, syncStatus: 'error' }));
      }
    },
    [analytics, debugging, onProjectUpdate, parseTSX, project.id],
  );

  const renderSyncStatus = (): React.ReactElement => {
    if (syncState.syncStatus === 'syncing') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Syncing...</Typography>
        </Box>
      );
    }

    if (syncState.syncStatus === 'success') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle color="success" fontSize="small" />
          <Typography variant="body2" color="success.main">
            Synced
          </Typography>
        </Box>
      );
    }

    if (syncState.syncStatus === 'error') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="error" fontSize="small" />
          <Typography variant="body2" color="error.main">
            Sync failed
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" fontSize="small" />
        <Typography variant="body2" color="warning.main">
          Pending sync
        </Typography>
      </Box>
    );
  };

  return (
    <Card sx={{ height: '100%', ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <Code color="primary" />
            Code Synchronization
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {renderSyncStatus()}
            <IconButton size="small" onClick={() => setShowSettings(true)}>
              <Settings fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {syncState.hasChanges && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You have unsaved changes. Sync to update the code.
          </Alert>
        )}

        <Tabs value={activeTab} onChange={(_, nextValue: number) => setActiveTab(nextValue)} sx={{ mb: 2 }}>
          <Tab label="Generate" icon={<Download />} />
          <Tab label="Import" icon={<Upload />} />
          <Tab label="Sync" icon={<Sync />} />
          <Tab label="Compare" icon={<Compare />} />
        </Tabs>

        {activeTab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button variant="contained" startIcon={<Code />} onClick={handleGenerateCode} fullWidth>
                Generate TSX
              </Button>
              <Button
                variant="outlined"
                startIcon={<Code />}
                onClick={() => setGeneratedCode((prev) => ({ ...prev, mdx: generateProjectMDX(project) }))}
                fullWidth
              >
                Generate MDX
              </Button>
            </Box>

            {generatedCode.tsx && (
              <TextField
                multiline
                rows={10}
                value={generatedCode.tsx}
                variant="outlined"
                fullWidth
                size="small"
                sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                InputProps={{ readOnly: true }}
              />
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            <TextField
              multiline
              rows={8}
              placeholder="Paste your TSX/MDX code here..."
              variant="outlined"
              fullWidth
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mb: 2 }}
            />
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => handleImportCode(importText, 'tsx')}
              fullWidth
              sx={theming.getThemedButtonSx()}
            >
              Import Code
            </Button>
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button
                  variant="contained"
                  startIcon={<Visibility />}
                  onClick={handleSyncToCode}
                  fullWidth
                  disabled={syncState.syncStatus === 'syncing'}
                  sx={theming.getThemedButtonSx()}
                >
                  Visual to Code
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  startIcon={<VisibilityOff />}
                  onClick={() => handleSyncFromCode(generatedCode.tsx)}
                  fullWidth
                  disabled={syncState.syncStatus === 'syncing' || generatedCode.tsx.length === 0}
                >
                  Code to Visual
                </Button>
              </Grid>
            </Grid>

            {syncState.lastSync && (
              <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Last sync: {syncState.lastSync.toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {activeTab === 3 && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Compare visual changes with code changes
            </Typography>
            <Button variant="outlined" startIcon={<Compare />} fullWidth disabled>
              Compare Changes
            </Button>
          </Box>
        )}

        <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Code Style Settings</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Indent Size</InputLabel>
                  <Select
                    value={syncState.codeStyle.indentSize}
                    label="Indent Size"
                    onChange={(event) =>
                      setSyncState((prev) => ({
                        ...prev,
                        codeStyle: { ...prev.codeStyle, indentSize: Number(event.target.value) },
                      }))
                    }
                  >
                    <MenuItem value={2}>2 spaces</MenuItem>
                    <MenuItem value={4}>4 spaces</MenuItem>
                    <MenuItem value={8}>8 spaces</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Quote Style</InputLabel>
                  <Select
                    value={syncState.codeStyle.quoteStyle}
                    label="Quote Style"
                    onChange={(event) =>
                      setSyncState((prev) => ({
                        ...prev,
                        codeStyle: {
                          ...prev.codeStyle,
                          quoteStyle: event.target.value as CodeStyleSettings['quoteStyle'],
                        },
                      }))
                    }
                  >
                    <MenuItem value="single">Single quotes</MenuItem>
                    <MenuItem value="double">Double quotes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={syncState.codeStyle.semicolons}
                      onChange={(event) =>
                        setSyncState((prev) => ({
                          ...prev,
                          codeStyle: { ...prev.codeStyle, semicolons: event.target.checked },
                        }))
                      }
                    />
                  }
                  label="Use semicolons"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={syncState.codeStyle.trailingCommas}
                      onChange={(event) =>
                        setSyncState((prev) => ({
                          ...prev,
                          codeStyle: { ...prev.codeStyle, trailingCommas: event.target.checked },
                        }))
                      }
                    />
                  }
                  label="Trailing commas"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
            <Button variant="contained" onClick={() => setShowSettings(false)} sx={theming.getThemedButtonSx()}>
              Save Settings
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CodeSyncSystem;
