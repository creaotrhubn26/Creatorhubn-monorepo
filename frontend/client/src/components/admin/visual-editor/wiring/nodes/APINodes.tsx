/**
 * API Nodes
 * Nodes for API calls and external integrations
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
  IconButton,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Api,
  Http,
  CloudSync,
  Code,
  Send,
  Add,
  Remove,
  ExpandMore,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

interface HeaderEntry {
  key: string;
  value: string;
}

const getBooleanValue = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

const toHeaders = (value: unknown): HeaderEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) return null;
      const key =
        'key' in entry && typeof entry.key === 'string' ? entry.key : '';
      const headerValue =
        'value' in entry && typeof entry.value === 'string' ? entry.value : '';
      return { key, value: headerValue };
    })
    .filter((entry): entry is HeaderEntry => entry !== null);
};

// REST API Node
export const RESTNode = memo(function RESTNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  const headers = toHeaders(config.data.headers);

  const addHeader = () => {
    onDataChange?.('headers', [...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    const newHeaders = headers.filter((_, i: number) => i !== index);
    onDataChange?.('headers', newHeaders);
  };

  const updateHeader = (index: number, field: string, value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onDataChange?.('headers', newHeaders);
  };

  return (
    <BaseNode
      config={{
        ...config,
        name: 'REST API',
        color: '#ff9800',
        icon: <Api sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Method</InputLabel>
              <Select
                value={data.method || 'GET'}
                onChange={(e) => onChange('method', e.target.value)}
                label="Method"
              >
                <MenuItem value="GET">GET</MenuItem>
                <MenuItem value="POST">POST</MenuItem>
                <MenuItem value="PUT">PUT</MenuItem>
                <MenuItem value="PATCH">PATCH</MenuItem>
                <MenuItem value="DELETE">DELETE</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              label="URL"
              value={data.url || ''}
              onChange={(e) => onChange('url', e.target.value)}
              placeholder="/api/endpoint or https://..."
            />
          </Stack>

          <Accordion sx={{ bgcolor: 'rgba(0,0,0,0.2)', mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="caption">Headers ({headers.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {headers.map((header: { key: string; value: string }, index: number) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      placeholder="Header key"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      placeholder="Value"
                      sx={{ flex: 1 }}
                    />
                    <IconButton size="small" onClick={() => removeHeader(index)}>
                      <Remove fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Chip
                  size="small"
                  icon={<Add />}
                  label="Add Header"
                  onClick={addHeader}
                  sx={{ bgcolor: 'rgba(255,152,0,0.2)', color: '#ff9800' }}
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.includeCredentials, false)}
                onChange={(e) => onChange('includeCredentials', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Include Credentials</Typography>}
          />

          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Response Type</InputLabel>
            <Select
              value={data.responseType || 'json'}
              onChange={(e) => onChange('responseType', e.target.value)}
              label="Response Type"
            >
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="blob">Blob</MenuItem>
              <MenuItem value="arrayBuffer">ArrayBuffer</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
      {...props}
    />
  );
});

// GraphQL Node
export const GraphQLNode = memo(function GraphQLNode({
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
        name: 'GraphQL',
        color: '#ff9800',
        icon: <Code sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Endpoint"
            value={data.endpoint || ''}
            onChange={(e) => onChange('endpoint', e.target.value)}
            placeholder="/graphql or https://..."
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Operation Type</InputLabel>
            <Select
              value={data.operationType || 'query'}
              onChange={(e) => onChange('operationType', e.target.value)}
              label="Operation Type"
            >
              <MenuItem value="query">Query</MenuItem>
              <MenuItem value="mutation">Mutation</MenuItem>
              <MenuItem value="subscription">Subscription</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Query / Mutation"
            value={data.query || ''}
            onChange={(e) => onChange('query', e.target.value)}
            placeholder={`query { users { id name } }`}
            multiline
            rows={4}
            sx={{ mb: 1, fontFamily: 'monospace' }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Variables connected via input port
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// WebSocket Node
export const WebSocketNode = memo(function WebSocketNode({
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
        name: 'WebSocket',
        color: '#ff9800',
        icon: <CloudSync sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="WebSocket URL"
            value={data.url || ''}
            onChange={(e) => onChange('url', e.target.value)}
            placeholder="wss://example.com/ws"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Protocols (comma-separated)"
            value={data.protocols || ''}
            onChange={(e) => onChange('protocols', e.target.value)}
            placeholder="json, binary"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.autoReconnect !== false}
                onChange={(e) => onChange('autoReconnect', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Auto Reconnect</Typography>}
          />

          {data.autoReconnect !== false && (
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Reconnect Interval (ms)"
              value={data.reconnectInterval || 3000}
              onChange={(e) => onChange('reconnectInterval', parseInt(e.target.value))}
              sx={{ mt: 1 }}
            />
          )}

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Outputs: message, status, error
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Mock Data Node
export const MockDataNode = memo(function MockDataNode({
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
        name: 'Mock Data',
        color: '#ff9800',
        icon: <Code sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Data Type</InputLabel>
            <Select
              value={data.dataType || 'custom'}
              onChange={(e) => onChange('dataType', e.target.value)}
              label="Data Type"
            >
              <MenuItem value="custom">Custom JSON</MenuItem>
              <MenuItem value="users">Sample Users</MenuItem>
              <MenuItem value="products">Sample Products</MenuItem>
              <MenuItem value="posts">Sample Posts</MenuItem>
              <MenuItem value="lorem">Lorem Ipsum</MenuItem>
            </Select>
          </FormControl>

          {data.dataType === 'custom' && (
            <TextField
              fullWidth
              size="small"
              label="Mock Data (JSON)"
              value={data.mockData || '{}'}
              onChange={(e) => onChange('mockData', e.target.value)}
              placeholder='{ "key": "value" }'
              multiline
              rows={4}
              sx={{ fontFamily: 'monospace' }}
            />
          )}

          {data.dataType !== 'custom' && (
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Number of Items"
              value={data.count || 10}
              onChange={(e) => onChange('count', parseInt(e.target.value))}
              sx={{ mb: 1 }}
            />
          )}

          <TextField
            fullWidth
            size="small"
            type="number"
            label="Simulated Delay (ms)"
            value={data.delay || 0}
            onChange={(e) => onChange('delay', parseInt(e.target.value))}
            sx={{ mt: 1 }}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Fetch Node (simplified REST)
export const FetchNode = memo(function FetchNode({
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
        name: 'Fetch',
        color: '#ff9800',
        icon: <Http sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="URL"
            value={data.url || ''}
            onChange={(e) => onChange('url', e.target.value)}
            placeholder="https://api.example.com/data"
            sx={{ mb: 1 }}
          />

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Method</InputLabel>
              <Select
                value={data.method || 'GET'}
                onChange={(e) => onChange('method', e.target.value)}
                label="Method"
              >
                <MenuItem value="GET">GET</MenuItem>
                <MenuItem value="POST">POST</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="Timeout (ms)"
              value={data.timeout || 30000}
              onChange={(e) => onChange('timeout', parseInt(e.target.value))}
              sx={{ flex: 1 }}
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={data.cache !== false}
                onChange={(e) => onChange('cache', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Cache Response</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const API_NODE_DEFINITIONS = [
  {
    type: 'RESTNode',
    name: 'REST API',
    category: 'api',
    description: 'Make REST API calls',
    icon: <Api />,
    color: '#ff9800',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'body', name: 'body', type: 'input' as const, dataType: 'object' as const },
      { id: 'params', name: 'params', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'response', name: 'response', type: 'output' as const, dataType: 'any' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
      { id: 'loading', name: 'loading', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'status', name: 'status', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { method: 'GET', url: '', headers: [], responseType: 'json' },
    component: RESTNode,
  },
  {
    type: 'GraphQLNode',
    name: 'GraphQL',
    category: 'api',
    description: 'Execute GraphQL queries and mutations',
    icon: <Code />,
    color: '#ff9800',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'variables', name: 'variables', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'data', name: 'data', type: 'output' as const, dataType: 'object' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
      { id: 'loading', name: 'loading', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { endpoint: '', operationType: 'query', query: '' },
    component: GraphQLNode,
  },
  {
    type: 'WebSocketNode',
    name: 'WebSocket',
    category: 'api',
    description: 'Real-time WebSocket connection',
    icon: <CloudSync />,
    color: '#ff9800',
    inputs: [
      { id: 'connect', name: 'connect', type: 'input' as const, dataType: 'event' as const },
      { id: 'send', name: 'send', type: 'input' as const, dataType: 'any' as const },
      { id: 'disconnect', name: 'disconnect', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'message', name: 'message', type: 'output' as const, dataType: 'any' as const },
      { id: 'status', name: 'status', type: 'output' as const, dataType: 'string' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { url: '', autoReconnect: true, reconnectInterval: 3000 },
    component: WebSocketNode,
  },
  {
    type: 'MockDataNode',
    name: 'Mock Data',
    category: 'api',
    description: 'Generate mock data for testing',
    icon: <Code />,
    color: '#ff9800',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'data', name: 'data', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { dataType: 'custom', mockData: '{}', count: 10, delay: 0 },
    component: MockDataNode,
  },
  {
    type: 'FetchNode',
    name: 'Fetch',
    category: 'api',
    description: 'Simple HTTP fetch',
    icon: <Http />,
    color: '#ff9800',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'data', name: 'data', type: 'output' as const, dataType: 'any' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { url: '', method: 'GET', timeout: 30000, cache: true },
    component: FetchNode,
  },
];

export default API_NODE_DEFINITIONS;
