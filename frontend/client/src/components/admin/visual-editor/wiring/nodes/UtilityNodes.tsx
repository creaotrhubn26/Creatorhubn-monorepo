/**
 * Utility Nodes
 * Helper nodes for debugging, comments, delays, and flow control
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
} from '@mui/material';
import {
  BugReport,
  Comment,
  Timer,
  Speed,
  AccountTree,
  Info,
  Code,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

// Debug Node
export const DebugNode = memo(function DebugNode({
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
        name: 'Debug',
        color: '#9e9e9e',
        icon: <BugReport sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Label"
            value={data.label || ''}
            onChange={(e) => onChange('label', e.target.value)}
            placeholder="Debug: user data"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Log Level</InputLabel>
            <Select
              value={data.level || 'log'}
              onChange={(e) => onChange('level', e.target.value)}
              label="Log Level"
            >
              <MenuItem value="log">console.log</MenuItem>
              <MenuItem value="info">console.info</MenuItem>
              <MenuItem value="warn">console.warn</MenuItem>
              <MenuItem value="error">console.error</MenuItem>
              <MenuItem value="table">console.table</MenuItem>
              <MenuItem value="trace">console.trace</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.enabled !== false}
                onChange={(e) => onChange('enabled', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Enabled</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.breakpoint || false}
                onChange={(e) => onChange('breakpoint', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Breakpoint (debugger)</Typography>}
          />

          <Alert severity="info" sx={{ mt: 1, py: 0 }}>
            <Typography variant="caption">
              Passes data through unchanged
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// Comment Node
export const CommentNode = memo(function CommentNode({
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
        name: 'Comment',
        color: '#9e9e9e',
        icon: <Comment sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Comment"
            value={data.comment || ''}
            onChange={(e) => onChange('comment', e.target.value)}
            placeholder="Describe this part of the flow..."
            multiline
            rows={3}
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Color</InputLabel>
            <Select
              value={data.color || 'default'}
              onChange={(e) => onChange('color', e.target.value)}
              label="Color"
            >
              <MenuItem value="default">Default (Gray)</MenuItem>
              <MenuItem value="yellow">Yellow (Note)</MenuItem>
              <MenuItem value="green">Green (Done)</MenuItem>
              <MenuItem value="red">Red (Warning)</MenuItem>
              <MenuItem value="blue">Blue (Info)</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            No inputs or outputs - documentation only
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Delay Node
export const DelayNode = memo(function DelayNode({
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
        name: 'Delay',
        color: '#9e9e9e',
        icon: <Timer sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Delay (ms)"
            value={data.delay || 1000}
            onChange={(e) => onChange('delay', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.cancelable !== false}
                onChange={(e) => onChange('cancelable', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Cancelable</Typography>}
          />

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Chip size="small" label="100ms" onClick={() => onChange('delay', 100)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
            <Chip size="small" label="500ms" onClick={() => onChange('delay', 500)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
            <Chip size="small" label="1s" onClick={() => onChange('delay', 1000)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
            <Chip size="small" label="2s" onClick={() => onChange('delay', 2000)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Throttle Node
export const ThrottleNode = memo(function ThrottleNode({
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
        name: 'Throttle',
        color: '#9e9e9e',
        icon: <Speed sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Throttle (ms)"
            value={data.wait || 200}
            onChange={(e) => onChange('wait', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.leading !== false}
                onChange={(e) => onChange('leading', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Leading (fire immediately)</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.trailing !== false}
                onChange={(e) => onChange('trailing', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Trailing (fire at end)</Typography>}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Limits execution to once per {data.wait || 200}ms
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Debounce Node
export const DebounceNode = memo(function DebounceNode({
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
        name: 'Debounce',
        color: '#9e9e9e',
        icon: <Timer sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Wait (ms)"
            value={data.wait || 300}
            onChange={(e) => onChange('wait', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.immediate || false}
                onChange={(e) => onChange('immediate', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Immediate (leading edge)</Typography>}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Waits {data.wait || 300}ms after last call before executing
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Chip size="small" label="Search" onClick={() => onChange('wait', 300)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
            <Chip size="small" label="Resize" onClick={() => onChange('wait', 150)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
            <Chip size="small" label="Scroll" onClick={() => onChange('wait', 100)} sx={{ bgcolor: 'rgba(158,158,158,0.2)', color: '#9e9e9e' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Subgraph Node
export const SubgraphNode = memo(function SubgraphNode({
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
        name: 'Subgraph',
        color: '#673ab7',
        icon: <AccountTree sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Subgraph Name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Authentication Flow"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={data.source || 'saved'}
              onChange={(e) => onChange('source', e.target.value)}
              label="Source"
            >
              <MenuItem value="saved">Saved Subgraph</MenuItem>
              <MenuItem value="inline">Inline (embedded)</MenuItem>
              <MenuItem value="external">External File</MenuItem>
            </Select>
          </FormControl>

          {data.source === 'saved' && (
            <TextField
              fullWidth
              size="small"
              label="Subgraph ID"
              value={data.subgraphId || ''}
              onChange={(e) => onChange('subgraphId', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Reusable group of nodes
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Log Node
export const LogNode = memo(function LogNode({
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
        name: 'Log',
        color: '#9e9e9e',
        icon: <Info sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Message Template"
            value={data.message || ''}
            onChange={(e) => onChange('message', e.target.value)}
            placeholder="User {{user.name}} clicked"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.timestamp !== false}
                onChange={(e) => onChange('timestamp', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Include timestamp</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.sendToServer || false}
                onChange={(e) => onChange('sendToServer', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Send to analytics</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Code Node (custom JS)
export const CodeNode = memo(function CodeNode({
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
        name: 'Custom Code',
        color: '#9e9e9e',
        icon: <Code sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Code"
            value={data.code || ''}
            onChange={(e) => onChange('code', e.target.value)}
            placeholder="return input * 2;"
            multiline
            rows={4}
            sx={{ mb: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
          />

          <Alert severity="warning" sx={{ py: 0 }}>
            <Typography variant="caption">
              Access inputs via `input` variable. Return value goes to output.
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const UTILITY_NODE_DEFINITIONS = [
  {
    type: 'DebugNode',
    name: 'Debug',
    category: 'utility',
    description: 'Log data to console',
    icon: <BugReport />,
    color: '#9e9e9e',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'output', name: 'output', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { label: '', level: 'log', enabled: true, breakpoint: false },
    component: DebugNode,
  },
  {
    type: 'CommentNode',
    name: 'Comment',
    category: 'utility',
    description: 'Add documentation note',
    icon: <Comment />,
    color: '#9e9e9e',
    inputs: [],
    outputs: [],
    defaultData: { comment: '', color: 'default' },
    component: CommentNode,
  },
  {
    type: 'DelayNode',
    name: 'Delay',
    category: 'utility',
    description: 'Delay execution',
    icon: <Timer />,
    color: '#9e9e9e',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'cancel', name: 'cancel', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'delayed', name: 'delayed', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { delay: 1000, cancelable: true },
    component: DelayNode,
  },
  {
    type: 'ThrottleNode',
    name: 'Throttle',
    category: 'utility',
    description: 'Limit execution rate',
    icon: <Speed />,
    color: '#9e9e9e',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'output', name: 'output', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { wait: 200, leading: true, trailing: true },
    component: ThrottleNode,
  },
  {
    type: 'DebounceNode',
    name: 'Debounce',
    category: 'utility',
    description: 'Wait for inactivity',
    icon: <Timer />,
    color: '#9e9e9e',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'output', name: 'output', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { wait: 300, immediate: false },
    component: DebounceNode,
  },
  {
    type: 'SubgraphNode',
    name: 'Subgraph',
    category: 'utility',
    description: 'Reusable node group',
    icon: <AccountTree />,
    color: '#673ab7',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'output', name: 'output', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { name: '', source: 'saved', subgraphId: '' },
    component: SubgraphNode,
  },
  {
    type: 'LogNode',
    name: 'Log',
    category: 'utility',
    description: 'Log with template',
    icon: <Info />,
    color: '#9e9e9e',
    inputs: [
      { id: 'data', name: 'data', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'data', name: 'data', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { message: '', timestamp: true, sendToServer: false },
    component: LogNode,
  },
  {
    type: 'CodeNode',
    name: 'Custom Code',
    category: 'utility',
    description: 'Execute custom JavaScript',
    icon: <Code />,
    color: '#9e9e9e',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'output', name: 'output', type: 'output' as const, dataType: 'any' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { code: '' },
    component: CodeNode,
  },
];

export default UTILITY_NODE_DEFINITIONS;

