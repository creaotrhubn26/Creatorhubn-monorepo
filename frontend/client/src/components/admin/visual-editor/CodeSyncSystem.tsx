/**
 * Code Synchronization System
 * Handles bidirectional sync between visual editor and TSX/MDX code
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Grid,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Code,
  Sync,
  Download,
  Upload,
  CheckCircle,
  Error,
  Warning,
  Visibility,
  VisibilityOff,
  Settings,
  Refresh,
  Compare,
  AccountTree,
  Commit,
  Merge,
  History
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { EditorElement, Project } from './VisualEditorContext';

// Code generation and parsing utilities
interface CodeGenerator {
  generateTSX: (project: Project) => string;
  generateMDX: (project: Project) => string;
  generateImports: (project: Project) => string[];
  generateTypes: (project: Project) => string; 
}

interface CodeParser {
  parseTSX: (code: string) => Project;
  parseMDX: (code: string) => Project;
  validateCode: (code: string) => { valid: boolean; errors: string[] };
  extractImports: (code: string) => string[]; 
}

interface CodeSyncState {
  lastSync: Date | null;
  hasChanges: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  conflicts: ConflictItem[];
  codeStyle: CodeStyleSettings; 
}

interface ConflictItem {
  id: string;
  type: 'element' | 'style' | 'prop' | 'import';
  elementId?: string;
  visualValue: any;
  codeValue: any;
  resolution: 'keep_visual' | 'keep_code' | 'manual';
  description: string; 
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

interface CodeSyncSystemProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
  onCodeUpdate: (code: string, type: 'tsx' | 'mdx') => void; 
}

export const CodeSyncSystem: React.FC<CodeSyncSystemProps> = ({
  project,
  onProjectUpdate,
  onCodeUpdate
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester, ');
  
  const [syncState, setSyncState] = useState<CodeSyncState>({
    lastSync: null,
    hasChanges: false,
    syncStatus: 'idle',
    conflicts: [],
    codeStyle: {
      indentSize: 2,
      useSpaces: true,
      quoteStyle: 'single',
      semicolons: true,
      trailingCommas: true,
      maxLineLength: 100,
      importOrder: ['react','@mui/material','@mui/icons-material','./components','./utils']
    }
  });

  const [activeTab, setActiveTab] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [generatedCode, setGeneratedCode] = useState({
    tsx: ',',
    mdx: '',
    imports: [] as string[],
    types: ''
  });

  // Component registration
  useEffect(() => {
    lifecycle.registerComponent('code-sync-system, ', {
      capabilities: [
        'code:generate','code:parse','code:sync','code:validate','code:format'
      ],
      metadata: {
        version: '1.0.0',
        dependencies: ['typescript','mdx','ast-parser']
      }
    });

    analytics.trackEvent('code_sync_system_mounted', {
      projectId: project.id,
      elementsCount: Object.keys(project.elements).length,
      timestamp: Date.now()
    });

    return () => {
      lifecycle.unregisterComponent('code-sync-system');
      analytics.trackEvent('code_sync_system_unmounted', {
        projectId: project.id,
        timestamp: Date.now()
      });
    };
  }, [lifecycle, analytics, project]);

  // Code generation functions
  const generateElementCode = useCallback((element: EditorElement): string => {
    const indent = ', '.repeat(syncState.codeStyle.indentSize);
    const quote = syncState.codeStyle.quoteStyle === 'single' ? "'" : '"';
    
    const styles = Object.entries(element.styles)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? `${quote}${value}${quote}` : value}`)
      .join('');

    const props = Object.entries(element.props)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}={${JSON.stringify(value)}}`)
      .join('');

    const styleProps = styles ? ` sx={{${styles}}}` : '';
    const elementProps = props ? ` ${props}` : '';

    switch (element.type) {
      case 'button':
        return `${indent}<Button${styleProps}${elementProps}>\n${indent}  ${element.props.text || 'Button'}\n${indent}</Button>`;
      case 'text':
        return `${indent}<Typography${styleProps}${elementProps}>\n${indent}  ${element.props.text || 'Text'}\n${indent}</Typography>`;
      case 'image':
        return `${indent}<Box component="img"${styleProps} src="${element.props.src || ', '}, "${elementProps} />`;
      case 'card':
        return `${indent}<Card${styleProps}${elementProps} sx={theming.getThemedCardSx()}>\n${indent}  <CardContent sx={theming.getThemedCardSx()}>\n${indent}    {/* Card content */}\n${indent}  </CardContent>\n${indent}</Card>`;
      case 'container':
        return `${indent}<Box${styleProps}${elementProps}>\n${indent}  {/* Container content */}\n${indent}</Box>`;
      case 'grid':
        return `${indent}<Grid container${styleProps}${elementProps}>\n${indent}  {/* Grid items */}\n${indent}</Grid>`;
      default:
        return `${indent}<Box${styleProps}${elementProps}>\n${indent}  {/* ${element.type} */}\n${indent}</Box>`;
    }
  }, [syncState.codeStyle]);

  const generateProjectTSX = useCallback((project: Project): string => {
    const imports = generateImports(project);
    const elements = Object.values(project.elements).map(generateElementCode).join('\n');
    
    return `${imports}

interface ${project.name.replace(/\s+/g, ', ')}Props {
  // Component props
}

const ${project.name.replace(/\s+/g, ', ')}: React.FC<${project.name.replace(/\s+/g, ', ')}Props> = (props) => {
  return (
    <Box
      sx={{
        width: ${project.settings.width},
        height: ${project.settings.height},
        backgroundColor: '${project.settings.backgroundColor},',
        position: 'relative'
      }}
    >
      ${elements}
    </Box>
  );
};

export default ${project.name.replace(/\s+/g, ', ')};`;
}, [generateElementCode]);

  const generateProjectMDX = useCallback((project: Project): string => {
    const imports = generateImports(project);
    const elements = Object.values(project.elements).map(generateElementCode).join('\n');
    
    return `${imports}

# ${project.name}

${project.description as any || ', '}

${elements}`;
}, [generateElementCode]);

  const generateImports = useCallback((project: Project): string[] => {
    const imports = new Set(['React']);
    
    // Add imports based on element types
    Object.values(project.elements).forEach(element => {
      switch (element.type) {
        case 'button':
        case 'text':
        case 'card':
        case 'container':
        case 'grid':
          imports.add('@mui/material');
          break;
        case 'image':
          imports.add('@mui/material');
          break;
      }
    });

    // Add specific component imports
    if (Object.values(project.elements).some(el => el.type === 'button')) {
      imports.add('Button');
    }
    if (Object.values(project.elements).some(el => el.type === 'text')) {
      imports.add('Typography');
    }
    if (Object.values(project.elements).some(el => el.type === 'card')) {
      imports.add('Card, CardContent');
    }
    if (Object.values(project.elements).some(el => el.type === 'container' || el.type === 'grid' || el.type === 'image')) {
      imports.add('Box');
    }
    if (Object.values(project.elements).some(el => el.type === 'grid')) {
      imports.add('Grid');
    }

    return Array.from(imports);
}, []);

  const generateTypes = useCallback((project: Project): string => {
    const elementTypes = Array.from(new Set(Object.values(project.elements).map(el => el.type)));
    
    return `export interface EditorElement {
  id: string;
  type: ${elementTypes.map(type => `'${type},'`).join(' | ')};
  x: number;
  y: number;
  width: number;
  height: number;
  styles: React.CSSProperties;
  props: Record<string, any>;
  children?: string[];
  parent?: string;
}

export interface ${project.name.replace(/\s+/g, ', ')}Project {
  id: string;
  name: string;
  elements: Record<string, EditorElement>;
  settings: {
    width: number;
    height: number;
    backgroundColor: string;
  };
}`;
}, []);

  // Code parsing functions
  const parseTSX = useCallback((code: string): Project => {
    // Simplified TSX parser - in production, use proper AST parsing
    const lines = code.split('\n');
    const newProject: Project = {
      id: project.id,
      name: project.name,
      elements: {},
      settings: {
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff'
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date(),
        lastModified: new Date(),
        version: project.metadata.version + 1
      },
      status: 'draft'
    };

    // Parse elements from code (simplified)
    let elementId = 0;
    lines.forEach((line, index) => {
      if (line.includes('<Button') || line.includes('<Typography') || line.includes('<Card')) {
        const element: EditorElement = {
          id: `element_${elementId++}`,
          type: line.includes('<Button') ? 'button' : 
                line.includes('<Typography') ? 'text' : 'card',
          x: 0,
          y: index * 50,
          width: 100,
          height: 40,
          styles: {},
          props: {}
        };
        newProject.elements[element.id] = element;
      }
    });

    return newProject;
  }, [project]);

  const validateCode = useCallback((code: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Basic validation
    if (!code.includes('React')) {
      errors.push('Missing React import');
    }
    
    if (!code.includes('export default')) {
      errors.push('Missing default export');
    }
    
    // Check for syntax errors (simplified)
    const openTags = (code.match(/</g) || []).length;
    const closeTags = (code.match(/>/g) || []).length;
    if (openTags !== closeTags) {
      errors.push('Mismatched JSX tags');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }, []);

  // Sync operations
  const handleGenerateCode = useCallback(() => {
    const endTiming = performance.startTiming('code_generation');
    
    try {
      const tsx = generateProjectTSX(project);
      const mdx = generateProjectMDX(project);
      const imports = generateImports(project);
      const types = generateTypes(project);

      setGeneratedCode({ tsx, mdx, imports, types });
      
      analytics.trackEvent('code_generated', {
        projectId: project.id,
        elementsCount: Object.keys(project.elements).length,
        codeLength: tsx.length,
        timestamp: Date.now()
      });

      setSyncState(prev => ({
        ...prev,
        lastSync: new Date(),
        hasChanges: false,
        syncStatus: 'success'
      }));
    } catch (error) {
      setSyncState(prev => ({
        ...prev,
        syncStatus: 'error'
      }));
      
      debugging.logIntegration('error','Code generation failed', { error });
    } finally {
      endTiming();
  }
}, [project, generateProjectTSX, generateProjectMDX, generateImports, generateTypes, performance, analytics, debugging]);

  const handleImportCode = useCallback((code: string, type: 'tsx' | 'mdx') => {
    const endTiming = performance.startTiming('code_import');
    
    try {
      const validation = validateCode(code);
      if (!validation.valid) {
        throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
      }

      const parsedProject = type === 'tsx' ? parseTSX(code) : project;
      onProjectUpdate(parsedProject);
      
      analytics.trackEvent('code_imported', {
        projectId: project.id,
        codeType: type,
        elementsCount: Object.keys(parsedProject.elements).length,
        timestamp: Date.now()
      });

      setSyncState(prev => ({
        ...prev,
        lastSync: new Date(),
        hasChanges: false,
        syncStatus: 'success'
      }));
    } catch (error) {
      setSyncState(prev => ({
        ...prev,
        syncStatus: 'error'
      }));
      
      debugging.logIntegration('error', 'Code import failed', { error });
    } finally {
      endTiming();
  }
}, [project, parseTSX, validateCode, onProjectUpdate, performance, analytics, debugging]);

  const handleSyncToCode = useCallback(() => {
    setSyncState(prev => ({ ...prev, syncStatus: 'syncing' }));
    
    try {
      const code = generateProjectTSX(project);
      onCodeUpdate(code'tsx');
      
      analytics.trackEvent('code_sync_visual_to_code', {
        projectId: project.id,
        timestamp: Date.now()
      });
      
      setSyncState(prev => ({
        ...prev,
        lastSync: new Date(),
        hasChanges: false,
        syncStatus: 'success'
      }));
    } catch (error) {
      setSyncState(prev => ({
        ...prev,
        syncStatus: 'error'
      }));
    }
  }, [project, generateProjectTSX, onCodeUpdate, analytics]);

  const handleSyncFromCode = useCallback((code: string) => {
    setSyncState(prev => ({ ...prev, syncStatus: 'syncing' }));
    
    try {
      const parsedProject = parseTSX(code);
      onProjectUpdate(parsedProject);
      
      analytics.trackEvent('code_sync_code_to_visual', {
        projectId: project.id,
        timestamp: Date.now()
      });
      
      setSyncState(prev => ({
        ...prev,
        lastSync: new Date(),
        hasChanges: false,
        syncStatus: 'success'
      }));
    } catch (error) {
      setSyncState(prev => ({
        ...prev,
        syncStatus: 'error'
      }));
    }
  }, [parseTSX, onProjectUpdate, analytics]);

  // Render status indicator
  const renderSyncStatus = () => {
    switch (syncState.syncStatus) {
      case 'syncing':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">Syncing...</Typography>
          </Box>
        );
      case 'success':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" fontSize="small" />
            <Typography variant="body2" color="success.main">Synced</Typography>
          </Box>
        );
      case 'error':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Error color="error" fontSize="small" />
            <Typography variant="body2" color="error.main">Sync failed</Typography>
          </Box>
        );
      default:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" fontSize="small" />
            <Typography variant="body2" color="warning.main">Pending sync</Typography>
          </Box>
        );
    }
  };

  return (
    <Card sx={{ height: '100%', ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <Code color="primary" />
            Code Synchronization
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {renderSyncStatus()}
            <IconButton size="small" onClick={() => setShowSettings(true)}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          </Box>
        </Box>

        {syncState.hasChanges && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You have unsaved changes. Sync to update the code.
          </Alert>
        )}

        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="Generate" icon={<Download />} />
          <Tab label="Import" icon={<Upload />} />
          <Tab label="Sync" icon={<Sync />} />
          <Tab label="Compare" icon={<Compare />} />
        </Tabs>

        {/* Generate Tab */}
        {activeTab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button variant="contained"
                startIcon={<Code />}
                onClick={handleGenerateCode}
                fullWidth
              >
                Generate TSX
              </Button>
              <Button
                variant="outlined"
                startIcon={<Code />}
                onClick={() => {
                  const mdx = generateProjectMDX(project);
                  setGeneratedCode(prev => ({ ...prev, mdx }));
              }}
                fullWidth
              >
                Generate MDX
              </Button>
            </Box>

            {generatedCode.tsx && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Generated TSX Code:
                </Typography>
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
              </Box>
            )}
          </Box>
        )}

        {/* Import Tab */}
        {activeTab === 1 && (
          <Box>
            <TextField
              multiline
              rows={8}
              placeholder="Paste your TSX/MDX code here..."
              variant="outlined"
              fullWidth
              sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mb: 2 }}
            />
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => {
                // Handle import logic
              }}
              fullWidth
              sx={theming.getThemedButtonSx()}
            >
              Import Code
            </Button>
          </Box>
        )}

        {/* Sync Tab */}
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
                  Visual → Code
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  startIcon={<VisibilityOff />}
                  onClick={() => {
                    // Handle sync from code
                  }}
                  fullWidth
                  disabled={syncState.syncStatus === 'syncing'}
                >
                  Code → Visual
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

        {/* Compare Tab */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Compare visual changes with code changes
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Compare />}
              fullWidth
              disabled
            >
              Compare Changes
            </Button>
          </Box>
        )}

        {/* Settings Dialog */}
        <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Code Style Settings</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Indent Size</InputLabel>
                  <Select
                    value={syncState.codeStyle.indentSize}
                    onChange={(e) => setSyncState(prev => ({
                      ...prev,
                      codeStyle: { ...prev.codeStyle, indentSize: Number(e.target.value) }
                    }))}
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
                    onChange={(e) => setSyncState(prev => ({
                      ...prev,
                      codeStyle: { ...prev.codeStyle, quoteStyle: e.target.value as 'single' |'double' }
                    }))}
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
                      onChange={(e) => setSyncState(prev => ({
                        ...prev,
                        codeStyle: { ...prev.codeStyle, semicolons: e.target.checked }
                      }))}
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
                      onChange={(e) => setSyncState(prev => ({
                        ...prev,
                        codeStyle: { ...prev.codeStyle, trailingCommas: e.target.checked }
                      }))}
                    />
                }
                  label="Trailing commas"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
            <Button
              variant="contained"
              onClick={() => setShowSettings(false)}
              sx={theming.getThemedButtonSx()}
            >
              Save Settings
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CodeSyncSystem;

