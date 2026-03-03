/**
 * Documentation Nodes
 * Nodes for auto-documentation generation
 */

import React, { memo } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Description,
  Code,
  Api,
  Storage,
  AutoAwesome,
  Article,
  Schema,
  MenuBook,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

const getBooleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

// Component Doc Node
export const ComponentDocNode = memo(function ComponentDocNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Component Doc',
        color: '#795548',
        icon: <Code sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Component Path"
            value={data.componentPath || ''}
            onChange={(e) => onChange('componentPath', e.target.value)}
            placeholder="src/components/MyComponent.tsx"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Output Format</InputLabel>
            <Select
              value={data.format || 'markdown'}
              onChange={(e) => onChange('format', e.target.value)}
              label="Output Format"
            >
              <MenuItem value="markdown">Markdown</MenuItem>
              <MenuItem value="html">HTML</MenuItem>
              <MenuItem value="json">JSON (Structured)</MenuItem>
              <MenuItem value="jsdoc">JSDoc</MenuItem>
            </Select>
          </FormControl>

          <Stack spacing={0.5} sx={{ mb: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={data.includeProps !== false}
                  onChange={(e) => onChange('includeProps', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">Include Props</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={data.includeExamples !== false}
                  onChange={(e) => onChange('includeExamples', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">Include Examples</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={getBooleanValue(data.includeDependencies)}
                  onChange={(e) => onChange('includeDependencies', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">Include Dependencies</Typography>}
            />
          </Stack>

          <Chip
            size="small"
            icon={<AutoAwesome />}
            label="AI-Enhanced"
            sx={{ bgcolor: 'rgba(121,85,72,0.2)', color: '#795548' }}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// OpenAPI Doc Node
export const OpenAPIDocNode = memo(function OpenAPIDocNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'OpenAPI Spec',
        color: '#4caf50',
        icon: <Api sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Routes Path"
            value={data.routesPath || ''}
            onChange={(e) => onChange('routesPath', e.target.value)}
            placeholder="server/routes/*.ts"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>OpenAPI Version</InputLabel>
            <Select
              value={data.version || '3.0.3'}
              onChange={(e) => onChange('version', e.target.value)}
              label="OpenAPI Version"
            >
              <MenuItem value="3.0.3">OpenAPI 3.0.3</MenuItem>
              <MenuItem value="3.1.0">OpenAPI 3.1.0</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="API Title"
            value={data.title || 'CreatorHub API'}
            onChange={(e) => onChange('title', e.target.value)}
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Base URL"
            value={data.baseUrl || '/api'}
            onChange={(e) => onChange('baseUrl', e.target.value)}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.includeAuth !== false}
                onChange={(e) => onChange('includeAuth', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Include Auth Schemes</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Schema Doc Node (for database)
export const SchemaDocNode = memo(function SchemaDocNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Schema Doc',
        color: '#00bcd4',
        icon: <Storage sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={data.source || 'drizzle'}
              onChange={(e) => onChange('source', e.target.value)}
              label="Source"
            >
              <MenuItem value="drizzle">Drizzle Schema</MenuItem>
              <MenuItem value="migrations">Migrations Folder</MenuItem>
              <MenuItem value="database">Live Database</MenuItem>
            </Select>
          </FormControl>

          {data.source === 'migrations' && (
            <TextField
              fullWidth
              size="small"
              label="Migrations Path"
              value={data.migrationsPath || 'migrations/'}
              onChange={(e) => onChange('migrationsPath', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Output Format</InputLabel>
            <Select
              value={data.format || 'markdown'}
              onChange={(e) => onChange('format', e.target.value)}
              label="Output Format"
            >
              <MenuItem value="markdown">Markdown Table</MenuItem>
              <MenuItem value="dbml">DBML</MenuItem>
              <MenuItem value="erd">ERD (Mermaid)</MenuItem>
              <MenuItem value="sql">SQL Comments</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.includeRelations !== false}
                onChange={(e) => onChange('includeRelations', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Include Relations</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// README Node
export const READMENode = memo(function READMENode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'README Generator',
        color: '#795548',
        icon: <MenuBook sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Project Name"
            value={data.projectName || 'CreatorHub'}
            onChange={(e) => onChange('projectName', e.target.value)}
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Description"
            value={data.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Include sections:
          </Typography>

          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={data.includeInstall !== false}
                  onChange={(e) => onChange('includeInstall', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">Installation</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={data.includeUsage !== false}
                  onChange={(e) => onChange('includeUsage', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">Usage</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={getBooleanValue(data.includeAPI)}
                  onChange={(e) => onChange('includeAPI', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">API Reference</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={data.includeEnv !== false}
                  onChange={(e) => onChange('includeEnv', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">Environment Variables</Typography>}
            />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Workflow Doc Node
export const WorkflowDocNode = memo(function WorkflowDocNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Workflow Doc',
        color: '#9c27b0',
        icon: <Schema sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Alert severity="info" sx={{ py: 0, mb: 1 }}>
            <Typography variant="caption">
              Documents the current node workflow
            </Typography>
          </Alert>

          <TextField
            fullWidth
            size="small"
            label="Workflow Name"
            value={data.workflowName || ''}
            onChange={(e) => onChange('workflowName', e.target.value)}
            placeholder="User Registration Flow"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Output Format</InputLabel>
            <Select
              value={data.format || 'mermaid'}
              onChange={(e) => onChange('format', e.target.value)}
              label="Output Format"
            >
              <MenuItem value="mermaid">Mermaid Flowchart</MenuItem>
              <MenuItem value="markdown">Markdown Steps</MenuItem>
              <MenuItem value="json">JSON Structure</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.includeDataTypes !== false}
                onChange={(e) => onChange('includeDataTypes', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Include Data Types</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Auto-Doc Trigger Node
export const AutoDocTriggerNode = memo(function AutoDocTriggerNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Auto-Doc Trigger',
        color: '#ff9800',
        icon: <AutoAwesome sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Automatically regenerates documentation when:
          </Typography>

          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                  <Switch
                    checked={getBooleanValue(data.onSave)}
                    onChange={(e) => onChange('onSave', e.target.checked)}
                    size="small"
                  />
              }
              label={<Typography variant="caption">On File Save</Typography>}
            />
            <FormControlLabel
              control={
                  <Switch
                    checked={getBooleanValue(data.onCommit)}
                    onChange={(e) => onChange('onCommit', e.target.checked)}
                    size="small"
                  />
              }
              label={<Typography variant="caption">On Git Commit</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={data.onBuild !== false}
                  onChange={(e) => onChange('onBuild', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption">On Build</Typography>}
            />
            <FormControlLabel
              control={
                  <Switch
                    checked={getBooleanValue(data.scheduled)}
                    onChange={(e) => onChange('scheduled', e.target.checked)}
                    size="small"
                  />
              }
              label={<Typography variant="caption">Scheduled (daily)</Typography>}
            />
          </Stack>

          {config.isRunning && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress sx={{ bgcolor: 'rgba(255,152,0,0.2)', '& .MuiLinearProgress-bar': { bgcolor: '#ff9800' } }} />
              <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 0.5 }}>
                Generating documentation...
              </Typography>
            </Box>
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const DOCUMENTATION_NODE_DEFINITIONS = [
  {
    type: 'ComponentDocNode',
    name: 'Component Doc',
    category: 'docs',
    description: 'Generate component documentation',
    icon: <Code />,
    color: '#795548',
    inputs: [
      { id: 'component', name: 'component', type: 'input' as const, dataType: 'any' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'documentation', name: 'documentation', type: 'output' as const, dataType: 'string' as const },
      { id: 'metadata', name: 'metadata', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { format: 'markdown', includeProps: true, includeExamples: true },
    component: ComponentDocNode,
  },
  {
    type: 'OpenAPIDocNode',
    name: 'OpenAPI Spec',
    category: 'docs',
    description: 'Generate OpenAPI specification',
    icon: <Api />,
    color: '#4caf50',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'spec', name: 'spec', type: 'output' as const, dataType: 'object' as const },
      { id: 'yaml', name: 'yaml', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { version: '3.0.3', title: 'CreatorHub API', baseUrl: '/api', includeAuth: true },
    component: OpenAPIDocNode,
  },
  {
    type: 'SchemaDocNode',
    name: 'Schema Doc',
    category: 'docs',
    description: 'Generate database schema documentation',
    icon: <Storage />,
    color: '#00bcd4',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'documentation', name: 'documentation', type: 'output' as const, dataType: 'string' as const },
      { id: 'tables', name: 'tables', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { source: 'drizzle', format: 'markdown', includeRelations: true },
    component: SchemaDocNode,
  },
  {
    type: 'READMENode',
    name: 'README Generator',
    category: 'docs',
    description: 'Generate README documentation',
    icon: <MenuBook />,
    color: '#795548',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'readme', name: 'readme', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { projectName: 'CreatorHub', includeInstall: true, includeUsage: true, includeEnv: true },
    component: READMENode,
  },
  {
    type: 'WorkflowDocNode',
    name: 'Workflow Doc',
    category: 'docs',
    description: 'Document node workflows',
    icon: <Schema />,
    color: '#9c27b0',
    inputs: [
      { id: 'nodes', name: 'nodes', type: 'input' as const, dataType: 'array' as const },
      { id: 'connections', name: 'connections', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'documentation', name: 'documentation', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { format: 'mermaid', includeDataTypes: true },
    component: WorkflowDocNode,
  },
  {
    type: 'AutoDocTriggerNode',
    name: 'Auto-Doc Trigger',
    category: 'docs',
    description: 'Automatic documentation triggers',
    icon: <AutoAwesome />,
    color: '#ff9800',
    inputs: [],
    outputs: [
      { id: 'trigger', name: 'trigger', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { onSave: false, onCommit: false, onBuild: true, scheduled: false },
    component: AutoDocTriggerNode,
  },
];

export default DOCUMENTATION_NODE_DEFINITIONS;
