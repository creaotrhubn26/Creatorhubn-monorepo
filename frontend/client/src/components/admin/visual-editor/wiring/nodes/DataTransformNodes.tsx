/**
 * Data Transform Nodes
 * Nodes for data manipulation and transformation
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
} from '@mui/material';
import {
  Transform,
  FilterList,
  Functions,
  MergeType,
  DataObject,
  TextFormat,
  Numbers,
  CalendarToday,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

// Map Node
export const MapNode = memo(function MapNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Map',
        color: '#2196f3',
        icon: <Transform sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Transform Expression"
            value={data.expression || 'item => item'}
            onChange={(e) => onChange('expression', e.target.value)}
            placeholder="item => item.name"
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Maps each item in the array using the expression
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Chip 
              size="small" 
              label="item" 
              sx={{ mr: 0.5, bgcolor: 'rgba(33,150,243,0.2)', color: '#2196f3' }} 
            />
            <Chip 
              size="small" 
              label="index" 
              sx={{ mr: 0.5, bgcolor: 'rgba(33,150,243,0.2)', color: '#2196f3' }} 
            />
            <Chip 
              size="small" 
              label="array" 
              sx={{ bgcolor: 'rgba(33,150,243,0.2)', color: '#2196f3' }} 
            />
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// Filter Node
export const FilterNode = memo(function FilterNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Filter',
        color: '#2196f3',
        icon: <FilterList sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Condition Expression"
            value={data.expression || 'item => true'}
            onChange={(e) => onChange('expression', e.target.value)}
            placeholder="item => item.active === true"
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Keeps items where condition returns true
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Reduce Node
export const ReduceNode = memo(function ReduceNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Reduce',
        color: '#2196f3',
        icon: <Functions sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Reducer Expression"
            value={data.expression || '(acc, item) => acc + item'}
            onChange={(e) => onChange('expression', e.target.value)}
            placeholder="(acc, item) => acc + item.value"
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Initial Value"
            value={data.initialValue || '0'}
            onChange={(e) => onChange('initialValue', e.target.value)}
            placeholder="0, [], {}"
          />
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Reduces array to single value
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Format Node
export const FormatNode = memo(function FormatNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Format',
        color: '#2196f3',
        icon: <TextFormat sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Format Type</InputLabel>
            <Select
              value={data.formatType || 'string'}
              onChange={(e) => onChange('formatType', e.target.value)}
              label="Format Type"
            >
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="currency">Currency</MenuItem>
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="time">Time</MenuItem>
              <MenuItem value="datetime">Date & Time</MenuItem>
              <MenuItem value="percentage">Percentage</MenuItem>
              <MenuItem value="phone">Phone Number</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>

          {data.formatType === 'currency' && (
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={data.currency || 'NOK'}
                onChange={(e) => onChange('currency', e.target.value)}
                label="Currency"
              >
                <MenuItem value="NOK">NOK (kr)</MenuItem>
                <MenuItem value="USD">USD ($)</MenuItem>
                <MenuItem value="EUR">EUR (€)</MenuItem>
                <MenuItem value="GBP">GBP (£)</MenuItem>
              </Select>
            </FormControl>
          )}

          {(data.formatType === 'date' || data.formatType === 'datetime') && (
            <TextField
              fullWidth
              size="small"
              label="Date Format"
              value={data.dateFormat || 'dd.MM.yyyy'}
              onChange={(e) => onChange('dateFormat', e.target.value)}
              placeholder="dd.MM.yyyy HH:mm"
            />
          )}

          {data.formatType === 'number' && (
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                type="number"
                label="Decimals"
                value={data.decimals || 0}
                onChange={(e) => onChange('decimals', parseInt(e.target.value))}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="Separator"
                value={data.separator || ' '}
                onChange={(e) => onChange('separator', e.target.value)}
                sx={{ width: 100 }}
              />
            </Stack>
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// Merge Node
export const MergeDataNode = memo(function MergeDataNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Merge',
        color: '#2196f3',
        icon: <MergeType sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Merge Strategy</InputLabel>
            <Select
              value={data.strategy || 'shallow'}
              onChange={(e) => onChange('strategy', e.target.value)}
              label="Merge Strategy"
            >
              <MenuItem value="shallow">Shallow Merge</MenuItem>
              <MenuItem value="deep">Deep Merge</MenuItem>
              <MenuItem value="concat">Concat Arrays</MenuItem>
              <MenuItem value="unique">Unique Values</MenuItem>
              <MenuItem value="overwrite">Overwrite</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Combines multiple objects or arrays into one
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Parse Node
export const ParseNode = memo(function ParseNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Parse',
        color: '#2196f3',
        icon: <DataObject sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Parse Type</InputLabel>
            <Select
              value={data.parseType || 'json'}
              onChange={(e) => onChange('parseType', e.target.value)}
              label="Parse Type"
            >
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="xml">XML</MenuItem>
              <MenuItem value="yaml">YAML</MenuItem>
              <MenuItem value="url">URL Params</MenuItem>
              <MenuItem value="formData">Form Data</MenuItem>
            </Select>
          </FormControl>

          {data.parseType === 'csv' && (
            <TextField
              fullWidth
              size="small"
              label="Delimiter"
              value={data.delimiter || ','}
              onChange={(e) => onChange('delimiter', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Parses string input into structured data
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Pick Node (extract specific fields)
export const PickNode = memo(function PickNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Pick Fields',
        color: '#2196f3',
        icon: <DataObject sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Fields to Pick"
            value={data.fields || ''}
            onChange={(e) => onChange('fields', e.target.value)}
            placeholder="id, name, email"
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Extracts only specified fields from object
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Sort Node
export const SortNode = memo(function SortNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Sort',
        color: '#2196f3',
        icon: <FilterList sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Sort By Field"
            value={data.field || ''}
            onChange={(e) => onChange('field', e.target.value)}
            placeholder="name, createdAt, price"
            sx={{ mb: 1 }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Direction</InputLabel>
            <Select
              value={data.direction || 'asc'}
              onChange={(e) => onChange('direction', e.target.value)}
              label="Direction"
            >
              <MenuItem value="asc">Ascending (A-Z, 0-9)</MenuItem>
              <MenuItem value="desc">Descending (Z-A, 9-0)</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const DATA_TRANSFORM_NODE_DEFINITIONS = [
  {
    type: 'MapNode',
    name: 'Map',
    category: 'data',
    description: 'Transform each array item',
    icon: <Transform />,
    color: '#2196f3',
    inputs: [
      { id: 'array', name: 'array', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { expression: 'item => item' },
    component: MapNode,
  },
  {
    type: 'FilterNode',
    name: 'Filter',
    category: 'data',
    description: 'Filter array by condition',
    icon: <FilterList />,
    color: '#2196f3',
    inputs: [
      { id: 'array', name: 'array', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'array' as const },
      { id: 'rejected', name: 'rejected', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { expression: 'item => true' },
    component: FilterNode,
  },
  {
    type: 'ReduceNode',
    name: 'Reduce',
    category: 'data',
    description: 'Reduce array to single value',
    icon: <Functions />,
    color: '#2196f3',
    inputs: [
      { id: 'array', name: 'array', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { expression: '(acc, item) => acc + item', initialValue: '0' },
    component: ReduceNode,
  },
  {
    type: 'FormatNode',
    name: 'Format',
    category: 'data',
    description: 'Format data (date, currency, etc.)',
    icon: <TextFormat />,
    color: '#2196f3',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'formatted', name: 'formatted', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { formatType: 'string' },
    component: FormatNode,
  },
  {
    type: 'MergeDataNode',
    name: 'Merge',
    category: 'data',
    description: 'Merge multiple objects or arrays',
    icon: <MergeType />,
    color: '#2196f3',
    inputs: [
      { id: 'input1', name: 'input 1', type: 'input' as const, dataType: 'any' as const },
      { id: 'input2', name: 'input 2', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { strategy: 'shallow' },
    component: MergeDataNode,
  },
  {
    type: 'ParseNode',
    name: 'Parse',
    category: 'data',
    description: 'Parse string to structured data',
    icon: <DataObject />,
    color: '#2196f3',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'string' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'any' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { parseType: 'json' },
    component: ParseNode,
  },
  {
    type: 'PickNode',
    name: 'Pick Fields',
    category: 'data',
    description: 'Extract specific fields from object',
    icon: <DataObject />,
    color: '#2196f3',
    inputs: [
      { id: 'object', name: 'object', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { fields: '' },
    component: PickNode,
  },
  {
    type: 'SortNode',
    name: 'Sort',
    category: 'data',
    description: 'Sort array by field',
    icon: <FilterList />,
    color: '#2196f3',
    inputs: [
      { id: 'array', name: 'array', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { field: '', direction: 'asc' },
    component: SortNode,
  },
];

export default DATA_TRANSFORM_NODE_DEFINITIONS;

