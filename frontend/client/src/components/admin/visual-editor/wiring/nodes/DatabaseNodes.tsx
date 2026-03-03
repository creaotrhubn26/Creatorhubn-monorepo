/**
 * Database Nodes
 * Nodes for database operations - Neon/PostgreSQL via Drizzle ORM
 */

import React, { memo, useState } from 'react';
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
  Autocomplete,
  Switch,
  FormControlLabel,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Storage,
  TableChart,
  Add,
  Remove,
  ExpandMore,
  PlayArrow,
  Check,
  Warning,
  Link,
  Security,
  Speed as Speed,
  History,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

const getBooleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const getStringArrayValue = (value: unknown, fallback: string[] = []): string[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
};

// Common database tables (would be dynamic in production)
const COMMON_TABLES = [
  'users',
  'projects',
  'sessions',
  'page_customizations',
  'visual_editor_nodes',
  'visual_editor_connections',
  'worklog_entries',
  'client_gallery_sessions',
  'onboarding_profiles',
];

// NeonConnection Node
export const NeonConnectionNode = memo(function NeonConnectionNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <BaseNode
      config={{
        ...config,
        name: 'Neon Connection',
        color: '#00bcd4',
        icon: <Link sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Alert severity="info" sx={{ mb: 1, py: 0 }}>
            <Typography variant="caption">
              Connects to Neon PostgreSQL via DATABASE_URL
            </Typography>
          </Alert>
          
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Connection Source</InputLabel>
            <Select
              value={data.source || 'env'}
              onChange={(e) => onChange('source', e.target.value)}
              label="Connection Source"
            >
              <MenuItem value="env">Environment Variable (DATABASE_URL)</MenuItem>
              <MenuItem value="direct">Direct Connection String</MenuItem>
            </Select>
          </FormControl>

          {data.source === 'direct' && (
            <TextField
              fullWidth
              size="small"
              type="password"
              label="Connection String"
              value={data.connectionString || ''}
              onChange={(e) => onChange('connectionString', e.target.value)}
              placeholder="postgres://user:pass@host/db"
              sx={{ mb: 1 }}
            />
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              type="number"
              label="Pool Max"
              value={data.poolMax || 20}
              onChange={(e) => onChange('poolMax', parseInt(e.target.value))}
              sx={{ width: 100 }}
            />
            <TextField
              size="small"
              type="number"
              label="Pool Min"
              value={data.poolMin || 2}
              onChange={(e) => onChange('poolMin', parseInt(e.target.value))}
              sx={{ width: 100 }}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={data.ssl !== false}
                onChange={(e) => onChange('ssl', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">SSL Enabled (required for Neon)</Typography>}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: isConnected ? '#4caf50' : '#f44336',
              }}
            />
            <Typography variant="caption" color="rgba(255,255,255,0.7)">
              {isConnected ? 'Connected' : 'Not connected'}
            </Typography>
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// Select Node
export const SelectNode = memo(function SelectNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  const columns = getStringArrayValue(config.data.columns, ['*']);

  return (
    <BaseNode
      config={{
        ...config,
        name: 'SELECT',
        color: '#00bcd4',
        icon: <Storage sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Autocomplete
            size="small"
            freeSolo
            options={COMMON_TABLES}
            value={data.table || ''}
            onChange={(_, value) => onChange('table', value)}
            renderInput={(params) => (
              <TextField {...params} label="Table" sx={{ mb: 1 }} />
            )}
          />

          <TextField
            fullWidth
            size="small"
            label="Columns (comma-separated)"
            value={columns.join(', ')}
            onChange={(e) => onChange('columns', e.target.value.split(',').map((c: string) => c.trim()))}
            placeholder="* or id, name, email"
            sx={{ mb: 1 }}
          />

          <Accordion sx={{ bgcolor: 'rgba(0,0,0,0.2)', mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="caption">WHERE Conditions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="WHERE clause"
                value={data.where || ''}
                onChange={(e) => onChange('where', e.target.value)}
                placeholder="id = $1 AND status = 'active'"
              />
            </AccordionDetails>
          </Accordion>

          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>ORDER BY</InputLabel>
              <Select
                value={data.orderBy || ''}
                onChange={(e) => onChange('orderBy', e.target.value)}
                label="ORDER BY"
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="id">id</MenuItem>
                <MenuItem value="created_at">created_at</MenuItem>
                <MenuItem value="updated_at">updated_at</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="LIMIT"
              value={data.limit || ''}
              onChange={(e) => onChange('limit', e.target.value)}
              sx={{ width: 80 }}
            />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Insert Node
export const InsertNode = memo(function InsertNode({
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
        name: 'INSERT',
        color: '#00bcd4',
        icon: <Add sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Autocomplete
            size="small"
            freeSolo
            options={COMMON_TABLES}
            value={data.table || ''}
            onChange={(_, value) => onChange('table', value)}
            renderInput={(params) => (
              <TextField {...params} label="Table" sx={{ mb: 1 }} />
            )}
          />

          <TextField
            fullWidth
            size="small"
            label="Columns"
            value={data.columns || ''}
            onChange={(e) => onChange('columns', e.target.value)}
            placeholder="name, email, status"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.returning !== false}
                onChange={(e) => onChange('returning', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">RETURNING *</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.onConflict)}
                onChange={(e) => onChange('onConflict', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">ON CONFLICT DO UPDATE</Typography>}
          />

          {getBooleanValue(data.onConflict) && (
            <TextField
              fullWidth
              size="small"
              label="Conflict Column"
              value={data.conflictColumn || 'id'}
              onChange={(e) => onChange('conflictColumn', e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// Update Node
export const UpdateNode = memo(function UpdateNode({
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
        name: 'UPDATE',
        color: '#00bcd4',
        icon: <Storage sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Autocomplete
            size="small"
            freeSolo
            options={COMMON_TABLES}
            value={data.table || ''}
            onChange={(_, value) => onChange('table', value)}
            renderInput={(params) => (
              <TextField {...params} label="Table" sx={{ mb: 1 }} />
            )}
          />

          <TextField
            fullWidth
            size="small"
            label="SET columns"
            value={data.setColumns || ''}
            onChange={(e) => onChange('setColumns', e.target.value)}
            placeholder="name = $1, status = $2"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="WHERE"
            value={data.where || ''}
            onChange={(e) => onChange('where', e.target.value)}
            placeholder="id = $3"
            sx={{ mb: 1 }}
          />

          <Alert severity="warning" sx={{ py: 0 }}>
            <Typography variant="caption">
              WHERE clause required to prevent updating all rows
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// Delete Node
export const DeleteNode = memo(function DeleteNode({
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
        name: 'DELETE',
        color: '#f44336',
        icon: <Remove sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Autocomplete
            size="small"
            freeSolo
            options={COMMON_TABLES}
            value={data.table || ''}
            onChange={(_, value) => onChange('table', value)}
            renderInput={(params) => (
              <TextField {...params} label="Table" sx={{ mb: 1 }} />
            )}
          />

          <TextField
            fullWidth
            size="small"
            label="WHERE (required)"
            value={data.where || ''}
            onChange={(e) => onChange('where', e.target.value)}
            placeholder="id = $1"
            error={!data.where}
            helperText={!data.where ? 'WHERE clause is required for safety' : ''}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.softDelete)}
                onChange={(e) => onChange('softDelete', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Soft Delete (set deleted_at)</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Table Node (Schema Visualization)
export const TableNode = memo(function TableNode({
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
        name: 'Table Schema',
        color: '#00bcd4',
        icon: <TableChart sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Autocomplete
            size="small"
            freeSolo
            options={COMMON_TABLES}
            value={data.table || ''}
            onChange={(_, value) => onChange('table', value)}
            renderInput={(params) => (
              <TextField {...params} label="Table Name" sx={{ mb: 1 }} />
            )}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Outputs table schema information
          </Typography>

          <Stack spacing={0.5}>
            <Chip size="small" label="columns" sx={{ bgcolor: 'rgba(0,188,212,0.2)', color: '#00bcd4' }} />
            <Chip size="small" label="primaryKey" sx={{ bgcolor: 'rgba(0,188,212,0.2)', color: '#00bcd4' }} />
            <Chip size="small" label="foreignKeys" sx={{ bgcolor: 'rgba(0,188,212,0.2)', color: '#00bcd4' }} />
            <Chip size="small" label="indexes" sx={{ bgcolor: 'rgba(0,188,212,0.2)', color: '#00bcd4' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Migration Node
export const MigrationNode = memo(function MigrationNode({
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
        name: 'Migration',
        color: '#ff9800',
        icon: <History sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Operation</InputLabel>
            <Select
              value={data.operation || 'createTable'}
              onChange={(e) => onChange('operation', e.target.value)}
              label="Operation"
            >
              <MenuItem value="createTable">CREATE TABLE</MenuItem>
              <MenuItem value="alterTable">ALTER TABLE</MenuItem>
              <MenuItem value="dropTable">DROP TABLE</MenuItem>
              <MenuItem value="addColumn">ADD COLUMN</MenuItem>
              <MenuItem value="dropColumn">DROP COLUMN</MenuItem>
              <MenuItem value="createIndex">CREATE INDEX</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Table Name"
            value={data.tableName || ''}
            onChange={(e) => onChange('tableName', e.target.value)}
            sx={{ mb: 1 }}
          />

          {data.operation === 'addColumn' && (
            <>
              <TextField
                fullWidth
                size="small"
                label="Column Name"
                value={data.columnName || ''}
                onChange={(e) => onChange('columnName', e.target.value)}
                sx={{ mb: 1 }}
              />
              <FormControl fullWidth size="small">
                <InputLabel>Column Type</InputLabel>
                <Select
                  value={data.columnType || 'VARCHAR'}
                  onChange={(e) => onChange('columnType', e.target.value)}
                  label="Column Type"
                >
                  <MenuItem value="VARCHAR(255)">VARCHAR(255)</MenuItem>
                  <MenuItem value="TEXT">TEXT</MenuItem>
                  <MenuItem value="INTEGER">INTEGER</MenuItem>
                  <MenuItem value="BIGINT">BIGINT</MenuItem>
                  <MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                  <MenuItem value="TIMESTAMP">TIMESTAMP</MenuItem>
                  <MenuItem value="JSONB">JSONB</MenuItem>
                  <MenuItem value="UUID">UUID</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
            <Typography variant="caption">
              Preview SQL before running migrations
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const DATABASE_NODE_DEFINITIONS = [
  {
    type: 'NeonConnectionNode',
    name: 'Neon Connection',
    category: 'database',
    description: 'Connect to Neon PostgreSQL database',
    icon: <Link />,
    color: '#00bcd4',
    inputs: [],
    outputs: [
      { id: 'connection', name: 'connection', type: 'output' as const, dataType: 'object' as const },
      { id: 'status', name: 'status', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { source: 'env', poolMax: 20, poolMin: 2, ssl: true },
    component: NeonConnectionNode,
  },
  {
    type: 'SelectNode',
    name: 'SELECT',
    category: 'database',
    description: 'Query database with SELECT',
    icon: <Storage />,
    color: '#00bcd4',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'params', name: 'params', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'rows', name: 'rows', type: 'output' as const, dataType: 'array' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
      { id: 'count', name: 'count', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { table: '', columns: ['*'], where: ', ', orderBy: '', limit: '' },
    component: SelectNode,
  },
  {
    type: 'InsertNode',
    name: 'INSERT',
    category: 'database',
    description: 'Insert data into database',
    icon: <Add />,
    color: '#00bcd4',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'data', name: 'data', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'object' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
      { id: 'id', name: 'id', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { table: '', columns: '', returning: true, onConflict: false },
    component: InsertNode,
  },
  {
    type: 'UpdateNode',
    name: 'UPDATE',
    category: 'database',
    description: 'Update data in database',
    icon: <Storage />,
    color: '#00bcd4',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'data', name: 'data', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'object' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
      { id: 'affected', name: 'affected', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { table: '', setColumns: '', where: '' },
    component: UpdateNode,
  },
  {
    type: 'DeleteNode',
    name: 'DELETE',
    category: 'database',
    description: 'Delete data from database',
    icon: <Remove />,
    color: '#f44336',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'params', name: 'params', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'object' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
      { id: 'affected', name: 'affected', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { table: '', where: '', softDelete: false },
    component: DeleteNode,
  },
  {
    type: 'TableNode',
    name: 'Table Schema',
    category: 'database',
    description: 'Get table schema information',
    icon: <TableChart />,
    color: '#00bcd4',
    inputs: [],
    outputs: [
      { id: 'schema', name: 'schema', type: 'output' as const, dataType: 'object' as const },
      { id: 'columns', name: 'columns', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { table: '' },
    component: TableNode,
  },
  {
    type: 'MigrationNode',
    name: 'Migration',
    category: 'database',
    description: 'Create database migrations',
    icon: <History />,
    color: '#ff9800',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'sql', name: 'sql', type: 'output' as const, dataType: 'string' as const },
      { id: 'success', name: 'success', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { operation: 'createTable', tableName: '' },
    component: MigrationNode,
  },
];

export default DATABASE_NODE_DEFINITIONS;
