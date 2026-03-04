/**
 * Event Nodes
 * Nodes for handling DOM and component events
 */

import React, { memo } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Typography,
} from '@mui/material';
import {
  TouchApp,
  Mouse,
  Send,
  PlayArrow,
  Edit,
  Timer,
  Keyboard,
  Refresh,
} from '@mui/icons-material';
import type { NodeConfig} from './BaseNode';
import { BaseNode, NodePort } from './BaseNode';

const getStringArrayValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

// Event node types
export type EventNodeType = 
  | 'OnClickNode'
  | 'OnHoverNode'
  | 'OnSubmitNode'
  | 'OnLoadNode'
  | 'OnChangeNode'
  | 'CustomEventNode'
  | 'OnKeyPressNode'
  | 'OnScrollNode'
  | 'OnFocusNode'
  | 'TimerNode';

// Base event node config
interface EventNodeData {
  elementId?: string;
  selector?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  debounce?: number;
  throttle?: number;
}

// OnClick Node
export const OnClickNode = memo(function OnClickNode({
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
        name: 'On Click',
        color: '#4caf50',
        icon: <TouchApp sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
	      renderContent={(data, onChange) => (
	        <Box>
          <TextField
            fullWidth
            size="small"
            label="Element ID / Selector"
            value={data.elementId || ''}
            onChange={(e) => onChange('elementId', e.target.value)}
            placeholder="#button-id or .class"
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              size="small"
              label="Prevent Default"
              onClick={() => onChange('preventDefault', !data.preventDefault)}
              variant={data.preventDefault ? 'filled' : 'outlined'}
              sx={{ 
                bgcolor: data.preventDefault ? 'rgba(76,175,80,0.2)' : 'transparent',
                borderColor: '#4caf50',
                color: '#4caf50',
              }}
            />
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// OnHover Node
export const OnHoverNode = memo(function OnHoverNode({
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
        name: 'On Hover',
        color: '#4caf50',
        icon: <Mouse sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Element Selector"
            value={data.selector || ''}
            onChange={(e) => onChange('selector', e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Debounce (ms)"
            value={data.debounce || 0}
            onChange={(e) => onChange('debounce', parseInt(e.target.value) || 0)}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// OnSubmit Node
export const OnSubmitNode = memo(function OnSubmitNode({
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
        name: 'On Submit',
        color: '#4caf50',
        icon: <Send sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Form ID / Selector"
            value={data.formId || ''}
            onChange={(e) => onChange('formId', e.target.value)}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Outputs: event, formData (object)
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// OnLoad Node
export const OnLoadNode = memo(function OnLoadNode({
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
        name: 'On Load',
        color: '#4caf50',
        icon: <PlayArrow sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Trigger On</InputLabel>
            <Select
              value={data.triggerOn || 'mount'}
              onChange={(e) => onChange('triggerOn', e.target.value)}
              label="Trigger On"
            >
              <MenuItem value="mount">Component Mount</MenuItem>
              <MenuItem value="window">Window Load</MenuItem>
              <MenuItem value="dom">DOM Ready</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              size="small"
              label="Run Once"
              onClick={() => onChange('runOnce', !data.runOnce)}
              variant={data.runOnce !== false ? 'filled' : 'outlined'}
              sx={{ 
                bgcolor: data.runOnce !== false ? 'rgba(76,175,80,0.2)' : 'transparent',
                borderColor: '#4caf50',
                color: '#4caf50',
              }}
            />
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// OnChange Node
export const OnChangeNode = memo(function OnChangeNode({
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
        name: 'On Change',
        color: '#4caf50',
        icon: <Edit sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Input Selector"
            value={data.selector || ''}
            onChange={(e) => onChange('selector', e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Debounce (ms)"
            value={data.debounce || 300}
            onChange={(e) => onChange('debounce', parseInt(e.target.value) || 0)}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// CustomEvent Node
export const CustomEventNode = memo(function CustomEventNode({
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
        name: 'Custom Event',
        color: '#4caf50',
        icon: <Refresh sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Event Name"
            value={data.eventName || ''}
            onChange={(e) => onChange('eventName', e.target.value)}
            placeholder="my-custom-event"
            sx={{ mb: 1 }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Listen On</InputLabel>
            <Select
              value={data.listenOn || 'window'}
              onChange={(e) => onChange('listenOn', e.target.value)}
              label="Listen On"
            >
              <MenuItem value="window">Window</MenuItem>
              <MenuItem value="document">Document</MenuItem>
              <MenuItem value="element">Specific Element</MenuItem>
            </Select>
          </FormControl>
          {data.listenOn === 'element' && (
            <TextField
              fullWidth
              size="small"
              label="Element Selector"
              value={data.selector || ''}
              onChange={(e) => onChange('selector', e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// Timer Node
export const TimerNode = memo(function TimerNode({
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
        name: 'Timer',
        color: '#4caf50',
        icon: <Timer sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Timer Type</InputLabel>
            <Select
              value={data.type || 'timeout'}
              onChange={(e) => onChange('type', e.target.value)}
              label="Timer Type"
            >
              <MenuItem value="timeout">Timeout (once)</MenuItem>
              <MenuItem value="interval">Interval (repeat)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Delay (ms)"
            value={data.delay || 1000}
            onChange={(e) => onChange('delay', parseInt(e.target.value) || 1000)}
            sx={{ mb: 1 }}
          />
          {data.type === 'interval' && (
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Max Iterations (0 = infinite)"
              value={data.maxIterations || 0}
              onChange={(e) => onChange('maxIterations', parseInt(e.target.value) || 0)}
            />
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// OnKeyPress Node
export const OnKeyPressNode = memo(function OnKeyPressNode({
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
        name: 'On Key Press',
        color: '#4caf50',
        icon: <Keyboard sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Key"
            value={data.key || ''}
            onChange={(e) => onChange('key', e.target.value)}
            placeholder="Enter, Escape, a, b..."
            sx={{ mb: 1 }}
          />
	          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
	            {['Ctrl', 'Alt', 'Shift', 'Meta'].map((modifier) => (
	              <Chip
                key={modifier}
                size="small"
                label={modifier}
	                onClick={() => {
	                  const modifiers = getStringArrayValue(data.modifiers);
	                  const newModifiers = modifiers.includes(modifier)
	                    ? modifiers.filter((m) => m !== modifier)
	                    : [...modifiers, modifier];
	                  onChange('modifiers', newModifiers);
	                }}
	                variant={getStringArrayValue(data.modifiers).includes(modifier) ? 'filled' : 'outlined'}
	                sx={{
	                  bgcolor: getStringArrayValue(data.modifiers).includes(modifier)
	                    ? 'rgba(76,175,80,0.2)'
	                    : 'transparent',
	                  borderColor: '#4caf50',
                  color: '#4caf50',
                }}
              />
            ))}
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const EVENT_NODE_DEFINITIONS = [
  {
    type: 'OnClickNode',
    name: 'On Click',
    category: 'events',
    description: 'Triggers when an element is clicked',
    icon: <TouchApp />,
    color: '#4caf50',
    inputs: [{ id: 'element', name: 'element', type: 'input' as const, dataType: 'any' as const }],
    outputs: [{ id: 'event', name: 'event', type: 'output' as const, dataType: 'event' as const }],
    defaultData: { elementId: '', preventDefault: false },
    component: OnClickNode,
  },
  {
    type: 'OnHoverNode',
    name: 'On Hover',
    category: 'events',
    description: 'Triggers on mouse enter/leave',
    icon: <Mouse />,
    color: '#4caf50',
    inputs: [{ id: 'element', name: 'element', type: 'input' as const, dataType: 'any' as const }],
    outputs: [
      { id: 'onEnter', name: 'onEnter', type: 'output' as const, dataType: 'event' as const },
      { id: 'onLeave', name: 'onLeave', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { selector: '', debounce: 0 },
    component: OnHoverNode,
  },
  {
    type: 'OnSubmitNode',
    name: 'On Submit',
    category: 'events',
    description: 'Triggers on form submission',
    icon: <Send />,
    color: '#4caf50',
    inputs: [{ id: 'form', name: 'form', type: 'input' as const, dataType: 'any' as const }],
    outputs: [
      { id: 'event', name: 'event', type: 'output' as const, dataType: 'event' as const },
      { id: 'formData', name: 'formData', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { formId: '' },
    component: OnSubmitNode,
  },
  {
    type: 'OnLoadNode',
    name: 'On Load',
    category: 'events',
    description: 'Triggers when component mounts',
    icon: <PlayArrow />,
    color: '#4caf50',
    inputs: [],
    outputs: [{ id: 'trigger', name: 'trigger', type: 'output' as const, dataType: 'event' as const }],
    defaultData: { triggerOn: 'mount', runOnce: true },
    component: OnLoadNode,
  },
  {
    type: 'OnChangeNode',
    name: 'On Change',
    category: 'events',
    description: 'Triggers on input value changes',
    icon: <Edit />,
    color: '#4caf50',
    inputs: [{ id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const }],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
      { id: 'event', name: 'event', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { selector: '', debounce: 300 },
    component: OnChangeNode,
  },
  {
    type: 'CustomEventNode',
    name: 'Custom Event',
    category: 'events',
    description: 'Listen for custom events',
    icon: <Refresh />,
    color: '#4caf50',
    inputs: [],
    outputs: [
      { id: 'event', name: 'event', type: 'output' as const, dataType: 'event' as const },
      { id: 'data', name: 'data', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { eventName: '', listenOn: 'window' },
    component: CustomEventNode,
  },
  {
    type: 'TimerNode',
    name: 'Timer',
    category: 'events',
    description: 'Trigger after delay or interval',
    icon: <Timer />,
    color: '#4caf50',
    inputs: [{ id: 'start', name: 'start', type: 'input' as const, dataType: 'event' as const }],
    outputs: [
      { id: 'tick', name: 'tick', type: 'output' as const, dataType: 'event' as const },
      { id: 'count', name: 'count', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { type: 'timeout', delay: 1000, maxIterations: 0 },
    component: TimerNode,
  },
  {
    type: 'OnKeyPressNode',
    name: 'On Key Press',
    category: 'events',
    description: 'Triggers on keyboard events',
    icon: <Keyboard />,
    color: '#4caf50',
    inputs: [],
    outputs: [
      { id: 'event', name: 'event', type: 'output' as const, dataType: 'event' as const },
      { id: 'key', name: 'key', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { key: '', modifiers: [] },
    component: OnKeyPressNode,
  },
];

export default EVENT_NODE_DEFINITIONS;
