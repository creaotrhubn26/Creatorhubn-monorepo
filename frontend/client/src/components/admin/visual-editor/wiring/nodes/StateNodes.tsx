/**
 * State Nodes
 * Nodes for state management and storage
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
} from '@mui/material';
import {
  DataObject,
  Storage,
  Memory,
  Layers,
  Save,
  Cached,
} from '@mui/icons-material';
import type { NodeConfig } from './BaseNode';
import { BaseNode } from './BaseNode';

const getBooleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

// Global State Node
export const GlobalStateNode = memo(function GlobalStateNode({
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
        name: 'Global State',
        color: '#3f51b5',
        icon: <Layers sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="State Key"
            value={data.key || ''}
            onChange={(e) => onChange('key', e.target.value)}
            placeholder="user.preferences.theme"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Initial Value (JSON)"
            value={data.initialValue || ''}
            onChange={(e) => onChange('initialValue', e.target.value)}
            placeholder='null, "value", 123, {...}'
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Store</InputLabel>
            <Select
              value={data.store || 'zustand'}
              onChange={(e) => onChange('store', e.target.value)}
              label="Store"
            >
              <MenuItem value="zustand">Zustand</MenuItem>
              <MenuItem value="redux">Redux</MenuItem>
              <MenuItem value="jotai">Jotai</MenuItem>
              <MenuItem value="context">React Context</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.persist)}
                onChange={(e) => onChange('persist', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Persist to storage</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Local State Node
export const LocalStateNode = memo(function LocalStateNode({
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
        name: 'Local State',
        color: '#3f51b5',
        icon: <Memory sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="State Name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="isOpen, count, formData"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Initial Value"
            value={data.initialValue || ''}
            onChange={(e) => onChange('initialValue', e.target.value)}
            placeholder='false, 0, "", {...}'
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={data.type || 'any'}
              onChange={(e) => onChange('type', e.target.value)}
              label="Type"
            >
              <MenuItem value="any">Any</MenuItem>
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="boolean">Boolean</MenuItem>
              <MenuItem value="object">Object</MenuItem>
              <MenuItem value="array">Array</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Creates useState hook in component
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Context Node
export const ContextNode = memo(function ContextNode({
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
        name: 'Context',
        color: '#3f51b5',
        icon: <DataObject sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Context</InputLabel>
            <Select
              value={data.context || ''}
              onChange={(e) => onChange('context', e.target.value)}
              label="Context"
            >
              <MenuItem value="AuthContext">Auth Context</MenuItem>
              <MenuItem value="ThemeContext">Theme Context</MenuItem>
              <MenuItem value="UserContext">User Context</MenuItem>
              <MenuItem value="SettingsContext">Settings Context</MenuItem>
              <MenuItem value="custom">Custom Context</MenuItem>
            </Select>
          </FormControl>

          {data.context === 'custom' && (
            <TextField
              fullWidth
              size="small"
              label="Context Name"
              value={data.customContext || ''}
              onChange={(e) => onChange('customContext', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <TextField
            fullWidth
            size="small"
            label="Value Path"
            value={data.path || ''}
            onChange={(e) => onChange('path', e.target.value)}
            placeholder="user.name, settings.darkMode"
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Accesses React Context value
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Local Storage Node
export const LocalStorageNode = memo(function LocalStorageNode({
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
        name: 'Local Storage',
        color: '#3f51b5',
        icon: <Storage sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Storage Key"
            value={data.key || ''}
            onChange={(e) => onChange('key', e.target.value)}
            placeholder="creatorhub_settings"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Operation</InputLabel>
            <Select
              value={data.operation || 'get'}
              onChange={(e) => onChange('operation', e.target.value)}
              label="Operation"
            >
              <MenuItem value="get">Get</MenuItem>
              <MenuItem value="set">Set</MenuItem>
              <MenuItem value="remove">Remove</MenuItem>
              <MenuItem value="watch">Watch Changes</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.parseJson !== false}
                onChange={(e) => onChange('parseJson', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Parse as JSON</Typography>}
          />

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Chip size="small" label="localStorage" sx={{ bgcolor: 'rgba(63,81,181,0.2)', color: '#3f51b5' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Session Storage Node
export const SessionStorageNode = memo(function SessionStorageNode({
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
        name: 'Session Storage',
        color: '#3f51b5',
        icon: <Save sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Storage Key"
            value={data.key || ''}
            onChange={(e) => onChange('key', e.target.value)}
            placeholder="session_data"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Operation</InputLabel>
            <Select
              value={data.operation || 'get'}
              onChange={(e) => onChange('operation', e.target.value)}
              label="Operation"
            >
              <MenuItem value="get">Get</MenuItem>
              <MenuItem value="set">Set</MenuItem>
              <MenuItem value="remove">Remove</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Clears when browser tab closes
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Memoized Value Node
export const MemoizedValueNode = memo(function MemoizedValueNode({
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
        name: 'Memoized Value',
        color: '#3f51b5',
        icon: <Cached sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Computation"
            value={data.computation || ''}
            onChange={(e) => onChange('computation', e.target.value)}
            placeholder="() => expensiveCalculation()"
            multiline
            rows={2}
            sx={{ mb: 1, fontFamily: 'monospace' }}
          />

          <TextField
            fullWidth
            size="small"
            label="Dependencies"
            value={data.dependencies || ''}
            onChange={(e) => onChange('dependencies', e.target.value)}
            placeholder="[dep1, dep2]"
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Creates useMemo hook - recomputes only when dependencies change
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Ref Node
export const RefNode = memo(function RefNode({
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
        name: 'Ref',
        color: '#3f51b5',
        icon: <DataObject sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Ref Name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="inputRef, containerRef"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Initial Value"
            value={data.initialValue || 'null'}
            onChange={(e) => onChange('initialValue', e.target.value)}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Creates useRef hook - persists across renders without causing re-render
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const STATE_NODE_DEFINITIONS = [
  {
    type: 'GlobalStateNode',
    name: 'Global State',
    category: 'state',
    description: 'Global state management',
    icon: <Layers />,
    color: '#3f51b5',
    inputs: [
      { id: 'setValue', name: 'set', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
      { id: 'setter', name: 'setter', type: 'output' as const, dataType: 'function' as const },
    ],
    defaultData: { key: '', initialValue: '', store: 'zustand', persist: false },
    component: GlobalStateNode,
  },
  {
    type: 'LocalStateNode',
    name: 'Local State',
    category: 'state',
    description: 'Component local state (useState)',
    icon: <Memory />,
    color: '#3f51b5',
    inputs: [
      { id: 'setValue', name: 'set', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
      { id: 'setter', name: 'setter', type: 'output' as const, dataType: 'function' as const },
    ],
    defaultData: { name: '', initialValue: '', type: 'any' },
    component: LocalStateNode,
  },
  {
    type: 'ContextNode',
    name: 'Context',
    category: 'state',
    description: 'Access React Context',
    icon: <DataObject />,
    color: '#3f51b5',
    inputs: [],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { context: '', path: '' },
    component: ContextNode,
  },
  {
    type: 'LocalStorageNode',
    name: 'Local Storage',
    category: 'state',
    description: 'Browser localStorage',
    icon: <Storage />,
    color: '#3f51b5',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
      { id: 'success', name: 'success', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { key: '', operation: 'get', parseJson: true },
    component: LocalStorageNode,
  },
  {
    type: 'SessionStorageNode',
    name: 'Session Storage',
    category: 'state',
    description: 'Browser sessionStorage',
    icon: <Save />,
    color: '#3f51b5',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { key: '', operation: 'get' },
    component: SessionStorageNode,
  },
  {
    type: 'MemoizedValueNode',
    name: 'Memoized Value',
    category: 'state',
    description: 'useMemo hook',
    icon: <Cached />,
    color: '#3f51b5',
    inputs: [
      { id: 'deps', name: 'dependencies', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { computation: '', dependencies: '' },
    component: MemoizedValueNode,
  },
  {
    type: 'RefNode',
    name: 'Ref',
    category: 'state',
    description: 'useRef hook',
    icon: <DataObject />,
    color: '#3f51b5',
    inputs: [],
    outputs: [
      { id: 'ref', name: 'ref', type: 'output' as const, dataType: 'object' as const },
      { id: 'current', name: 'current', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { name: '', initialValue: 'null' },
    component: RefNode,
  },
];

export default STATE_NODE_DEFINITIONS;
