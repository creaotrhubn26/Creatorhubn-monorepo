/**
 * Logic Nodes
 * Nodes for conditional logic and flow control
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
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import {
  CallSplit,
  Compare,
  Functions,
  Add,
  Remove,
  AllInclusive,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

// IfElse Node
export const IfElseNode = memo(function IfElseNode({
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
        name: 'If / Else',
        color: '#9c27b0',
        icon: <CallSplit sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Routes flow based on boolean condition
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: '#4caf50',
              }}
            />
            <Typography variant="caption" color="rgba(255,255,255,0.7)">
              True → executes when condition is truthy
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: '#f44336',
              }}
            />
            <Typography variant="caption" color="rgba(255,255,255,0.7)">
              False → executes when condition is falsy
            </Typography>
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// Switch Node
export const SwitchNode = memo(function SwitchNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  const cases = config.data.cases || ['case1', 'case2'];

  const addCase = () => {
    const newCases = [...cases, `case${cases.length + 1}`];
    onDataChange?.('cases', newCases);
  };

  const removeCase = (index: number) => {
    if (cases.length > 1) {
      const newCases = cases.filter((_: string, i: number) => i !== index);
      onDataChange?.('cases', newCases);
    }
  };

  const updateCase = (index: number, value: string) => {
    const newCases = [...cases];
    newCases[index] = value;
    onDataChange?.('cases', newCases);
  };

  return (
    <BaseNode
      config={{
        ...config,
        name: 'Switch',
        color: '#9c27b0',
        icon: <Functions sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Multi-way branching based on value
          </Typography>
          
          <Stack spacing={1}>
            {cases.map((caseValue: string, index: number) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  value={caseValue}
                  onChange={(e) => updateCase(index, e.target.value)}
                  placeholder={`Case ${index + 1}`}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeCase(index)}
                  disabled={cases.length <= 1}
                  sx={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  <Remove fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
          
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip
              size="small"
              icon={<Add />}
              label="Add Case"
              onClick={addCase}
              sx={{
                bgcolor: 'rgba(156,39,176,0.2)',
                color: '#9c27b0',
                '&:hover': { bgcolor: 'rgba(156,39,176,0.3)' },
              }}
            />
            <Typography variant="caption" color="rgba(255,255,255,0.4)">
              + default case
            </Typography>
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// Compare Node
export const CompareNode = memo(function CompareNode({
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
        name: 'Compare',
        color: '#9c27b0',
        icon: <Compare sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              value={data.operator || '=='}
              onChange={(e) => onChange('operator', e.target.value)}
              label="Operator"
            >
              <MenuItem value="==">== (Equal)</MenuItem>
              <MenuItem value="===">=== (Strict Equal)</MenuItem>
              <MenuItem value="!=">!= (Not Equal)</MenuItem>
              <MenuItem value="!==">!== (Strict Not Equal)</MenuItem>
              <MenuItem value=">">{'>'} (Greater Than)</MenuItem>
              <MenuItem value=">=">{'≥'} (Greater or Equal)</MenuItem>
              <MenuItem value="<">{'<'} (Less Than)</MenuItem>
              <MenuItem value="<=">{'≤'} (Less or Equal)</MenuItem>
              <MenuItem value="contains">Contains</MenuItem>
              <MenuItem value="startsWith">Starts With</MenuItem>
              <MenuItem value="endsWith">Ends With</MenuItem>
              <MenuItem value="regex">Regex Match</MenuItem>
            </Select>
          </FormControl>
          
          {data.operator === 'regex' && (
            <TextField
              fullWidth
              size="small"
              label="Regex Pattern"
              value={data.pattern || ''}
              onChange={(e) => onChange('pattern', e.target.value)}
              placeholder="/pattern/flags"
            />
          )}
          
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Compares input A {data.operator || '=='} input B → boolean
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// And Node
export const AndNode = memo(function AndNode({
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
        name: 'AND',
        color: '#9c27b0',
        icon: <Typography sx={{ fontSize: 14, fontWeight: 'bold' }}>&&</Typography>,
      }}
      onDataChange={onDataChange}
      renderContent={() => (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="rgba(255,255,255,0.7)">
            A && B
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            True only if both inputs are true
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Or Node
export const OrNode = memo(function OrNode({
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
        name: 'OR',
        color: '#9c27b0',
        icon: <Typography sx={{ fontSize: 14, fontWeight: 'bold' }}>||</Typography>,
      }}
      onDataChange={onDataChange}
      renderContent={() => (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="rgba(255,255,255,0.7)">
            A || B
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            True if either input is true
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Not Node
export const NotNode = memo(function NotNode({
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
        name: 'NOT',
        color: '#9c27b0',
        icon: <Typography sx={{ fontSize: 14, fontWeight: 'bold' }}>!</Typography>,
      }}
      onDataChange={onDataChange}
      renderContent={() => (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="rgba(255,255,255,0.7)">
            !A
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Inverts the boolean value
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Merge Node (combines multiple flows)
export const MergeNode = memo(function MergeNode({
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
        name: 'Merge',
        color: '#9c27b0',
        icon: <AllInclusive sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small">
            <InputLabel>Merge Mode</InputLabel>
            <Select
              value={data.mode || 'any'}
              onChange={(e) => onChange('mode', e.target.value)}
              label="Merge Mode"
            >
              <MenuItem value="any">Any (first to arrive)</MenuItem>
              <MenuItem value="all">All (wait for all)</MenuItem>
              <MenuItem value="race">Race (first wins)</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Combines multiple event flows into one
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const LOGIC_NODE_DEFINITIONS = [
  {
    type: 'IfElseNode',
    name: 'If / Else',
    category: 'logic',
    description: 'Conditional branching based on boolean',
    icon: <CallSplit />,
    color: '#9c27b0',
    inputs: [
      { id: 'condition', name: 'condition', type: 'input' as const, dataType: 'boolean' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'true', name: 'true', type: 'output' as const, dataType: 'event' as const },
      { id: 'false', name: 'false', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: {},
    component: IfElseNode,
  },
  {
    type: 'SwitchNode',
    name: 'Switch',
    category: 'logic',
    description: 'Multi-way branching based on value',
    icon: <Functions />,
    color: '#9c27b0',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'case1', name: 'case1', type: 'output' as const, dataType: 'event' as const },
      { id: 'case2', name: 'case2', type: 'output' as const, dataType: 'event' as const },
      { id: 'default', name: 'default', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { cases: ['case1', 'case2'] },
    component: SwitchNode,
  },
  {
    type: 'CompareNode',
    name: 'Compare',
    category: 'logic',
    description: 'Compare two values',
    icon: <Compare />,
    color: '#9c27b0',
    inputs: [
      { id: 'a', name: 'A', type: 'input' as const, dataType: 'any' as const },
      { id: 'b', name: 'B', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { operator: '==' },
    component: CompareNode,
  },
  {
    type: 'AndNode',
    name: 'AND',
    category: 'logic',
    description: 'Boolean AND operation',
    icon: <Typography sx={{ fontWeight: 'bold' }}>&&</Typography>,
    color: '#9c27b0',
    inputs: [
      { id: 'a', name: 'A', type: 'input' as const, dataType: 'boolean' as const },
      { id: 'b', name: 'B', type: 'input' as const, dataType: 'boolean' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: {},
    component: AndNode,
  },
  {
    type: 'OrNode',
    name: 'OR',
    category: 'logic',
    description: 'Boolean OR operation',
    icon: <Typography sx={{ fontWeight: 'bold' }}>||</Typography>,
    color: '#9c27b0',
    inputs: [
      { id: 'a', name: 'A', type: 'input' as const, dataType: 'boolean' as const },
      { id: 'b', name: 'B', type: 'input' as const, dataType: 'boolean' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: {},
    component: OrNode,
  },
  {
    type: 'NotNode',
    name: 'NOT',
    category: 'logic',
    description: 'Boolean NOT operation',
    icon: <Typography sx={{ fontWeight: 'bold' }}>!</Typography>,
    color: '#9c27b0',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'boolean' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: {},
    component: NotNode,
  },
  {
    type: 'MergeNode',
    name: 'Merge',
    category: 'logic',
    description: 'Combine multiple event flows',
    icon: <AllInclusive />,
    color: '#9c27b0',
    inputs: [
      { id: 'input1', name: 'input 1', type: 'input' as const, dataType: 'event' as const },
      { id: 'input2', name: 'input 2', type: 'input' as const, dataType: 'event' as const },
      { id: 'input3', name: 'input 3', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'output', name: 'output', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { mode: 'any' },
    component: MergeNode,
  },
];

export default LOGIC_NODE_DEFINITIONS;

