/**
 * Environment Nodes
 * Nodes for environment variables and configuration
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
  Alert,
  Switch,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import {
  Settings,
  VpnKey,
  Security,
  Storage,
  Api,
  Lock,
  Check,
  Warning,
  ContentCopy,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import type { NodeConfig } from './BaseNode';
import { BaseNode } from './BaseNode';

const getBooleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

// Common env variables
const COMMON_ENV_VARS = [
  'DATABASE_URL',
  'NODE_ENV',
  'PORT',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'OPENAI_API_KEY',
  'REPLICATE_API_TOKEN',
  'ML_SERVICE_URL',
  'SENTRY_DSN',
];

// EnvFile Node
export const EnvFileNode = memo(function EnvFileNode({
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
        name: 'Env File',
        color: '#607d8b',
        icon: <Settings sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              value={data.environment || 'development'}
              onChange={(e) => onChange('environment', e.target.value)}
              label="Environment"
            >
              <MenuItem value="development">Development (.env)</MenuItem>
              <MenuItem value="production">Production (.env.production)</MenuItem>
              <MenuItem value="test">Test (.env.test)</MenuItem>
              <MenuItem value="local">Local (.env.local)</MenuItem>
            </Select>
          </FormControl>

          <Alert severity="info" sx={{ py: 0 }}>
            <Typography variant="caption">
              Reads from /Users/usmanqazi/creatorhub-backend/.env
            </Typography>
          </Alert>

          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Outputs all variables from the env file
            </Typography>
          </Box>
        </Box>
      )}
      {...props}
    />
  );
});

// EnvVariable Node
export const EnvVariableNode = memo(function EnvVariableNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  const [showValue, setShowValue] = React.useState(false);

  return (
    <BaseNode
      config={{
        ...config,
        name: 'Env Variable',
        color: '#607d8b',
        icon: <VpnKey sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Variable Name</InputLabel>
            <Select
              value={data.variableName || ''}
              onChange={(e) => onChange('variableName', e.target.value)}
              label="Variable Name"
              MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
            >
              {COMMON_ENV_VARS.map((varName) => (
                <MenuItem key={varName} value={varName}>
                  {varName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Or Custom Variable"
            value={data.customVariable || ''}
            onChange={(e) => onChange('customVariable', e.target.value)}
            placeholder="MY_CUSTOM_VAR"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Default Value (if not set)"
            value={data.defaultValue || ''}
            onChange={(e) => onChange('defaultValue', e.target.value)}
            type={showValue ? 'text' : 'password'}
            InputProps={{
              endAdornment: (
                <IconButton size="small" onClick={() => setShowValue(!showValue)}>
                  {showValue ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              ),
            }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.required)}
                onChange={(e) => onChange('required', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Required (error if missing)</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Secret Node
export const SecretNode = memo(function SecretNode({
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
        name: 'Secret',
        color: '#f44336',
        icon: <Lock sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Alert severity="warning" sx={{ py: 0, mb: 1 }}>
            <Typography variant="caption">
              Secrets are encrypted at rest
            </Typography>
          </Alert>

          <TextField
            fullWidth
            size="small"
            label="Secret Name"
            value={data.secretName || ''}
            onChange={(e) => onChange('secretName', e.target.value)}
            placeholder="api_key, auth_token"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Secret Type</InputLabel>
            <Select
              value={data.secretType || 'string'}
              onChange={(e) => onChange('secretType', e.target.value)}
              label="Secret Type"
            >
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="apiKey">API Key</MenuItem>
              <MenuItem value="oauth">OAuth Token</MenuItem>
              <MenuItem value="certificate">Certificate</MenuItem>
              <MenuItem value="privateKey">Private Key</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            <Chip size="small" label="encrypted" sx={{ bgcolor: 'rgba(244,67,54,0.2)', color: '#f44336' }} />
            <Chip size="small" label="no-log" sx={{ bgcolor: 'rgba(244,67,54,0.2)', color: '#f44336' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Database URL Node
export const DatabaseURLNode = memo(function DatabaseURLNode({
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
        name: 'Database URL',
        color: '#00bcd4',
        icon: <Storage sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={data.source || 'DATABASE_URL'}
              onChange={(e) => onChange('source', e.target.value)}
              label="Source"
            >
              <MenuItem value="DATABASE_URL">DATABASE_URL (Neon)</MenuItem>
              <MenuItem value="DIRECT_URL">DIRECT_URL</MenuItem>
              <MenuItem value="custom">Custom Variable</MenuItem>
            </Select>
          </FormControl>

          {data.source === 'custom' && (
            <TextField
              fullWidth
              size="small"
              label="Custom Variable Name"
              value={data.customVar || ''}
              onChange={(e) => onChange('customVar', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Check sx={{ fontSize: 14, color: '#4caf50' }} />
              <Typography variant="caption" color="rgba(255,255,255,0.7)">
                SSL: require (Neon)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Check sx={{ fontSize: 14, color: '#4caf50' }} />
              <Typography variant="caption" color="rgba(255,255,255,0.7)">
                Connection pooling enabled
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// API Key Node
export const APIKeyNode = memo(function APIKeyNode({
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
        name: 'API Key',
        color: '#ff9800',
        icon: <Api sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Service</InputLabel>
            <Select
              value={data.service || 'openai'}
              onChange={(e) => onChange('service', e.target.value)}
              label="Service"
            >
              <MenuItem value="openai">OpenAI (OPENAI_API_KEY)</MenuItem>
              <MenuItem value="replicate">Replicate (REPLICATE_API_TOKEN)</MenuItem>
              <MenuItem value="stripe">Stripe (STRIPE_SECRET_KEY)</MenuItem>
              <MenuItem value="google">Google (GOOGLE_API_KEY)</MenuItem>
              <MenuItem value="cloudflare">Cloudflare (CF_API_TOKEN)</MenuItem>
              <MenuItem value="sentry">Sentry (SENTRY_DSN)</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          {data.service === 'custom' && (
            <TextField
              fullWidth
              size="small"
              label="Variable Name"
              value={data.customKey || ''}
              onChange={(e) => onChange('customKey', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <Alert severity="info" sx={{ py: 0 }}>
            <Typography variant="caption">
              Key is masked in logs and debug output
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// Config Validator Node
export const ConfigValidatorNode = memo(function ConfigValidatorNode({
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
        name: 'Config Validator',
        color: '#8bc34a',
        icon: <Check sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Validates required configuration
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Required Variables (comma-separated)"
            value={data.required || ''}
            onChange={(e) => onChange('required', e.target.value)}
            placeholder="DATABASE_URL, SESSION_SECRET"
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.failOnMissing !== false}
                onChange={(e) => onChange('failOnMissing', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Throw error if missing</Typography>}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              size="small"
              icon={<Check />}
              label="Valid"
              sx={{ bgcolor: 'rgba(76,175,80,0.2)', color: '#4caf50' }}
            />
            <Chip
              size="small"
              icon={<Warning />}
              label="Missing"
              sx={{ bgcolor: 'rgba(255,152,0,0.2)', color: '#ff9800' }}
            />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Feature Flag Node
export const FeatureFlagNode = memo(function FeatureFlagNode({
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
        name: 'Feature Flag',
        color: '#9c27b0',
        icon: <Security sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Flag Name"
            value={data.flagName || ''}
            onChange={(e) => onChange('flagName', e.target.value)}
            placeholder="enable_new_feature"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Default State</InputLabel>
            <Select
              value={data.defaultState || 'false'}
              onChange={(e) => onChange('defaultState', e.target.value)}
              label="Default State"
            >
              <MenuItem value="true">Enabled</MenuItem>
              <MenuItem value="false">Disabled</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Checks FEATURE_{'{flagName}'} environment variable
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const ENVIRONMENT_NODE_DEFINITIONS = [
  {
    type: 'EnvFileNode',
    name: 'Env File',
    category: 'env',
    description: 'Read entire .env file',
    icon: <Settings />,
    color: '#607d8b',
    inputs: [],
    outputs: [
      { id: 'variables', name: 'variables', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { environment: 'development' },
    component: EnvFileNode,
  },
  {
    type: 'EnvVariableNode',
    name: 'Env Variable',
    category: 'env',
    description: 'Get single environment variable',
    icon: <VpnKey />,
    color: '#607d8b',
    inputs: [],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'string' as const },
      { id: 'exists', name: 'exists', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { variableName: '', defaultValue: '', required: false },
    component: EnvVariableNode,
  },
  {
    type: 'SecretNode',
    name: 'Secret',
    category: 'env',
    description: 'Secure secret management',
    icon: <Lock />,
    color: '#f44336',
    inputs: [],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { secretName: '', secretType: 'string' },
    component: SecretNode,
  },
  {
    type: 'DatabaseURLNode',
    name: 'Database URL',
    category: 'env',
    description: 'Database connection string',
    icon: <Storage />,
    color: '#00bcd4',
    inputs: [],
    outputs: [
      { id: 'url', name: 'url', type: 'output' as const, dataType: 'string' as const },
      { id: 'parsed', name: 'parsed', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { source: 'DATABASE_URL' },
    component: DatabaseURLNode,
  },
  {
    type: 'APIKeyNode',
    name: 'API Key',
    category: 'env',
    description: 'API key for external services',
    icon: <Api />,
    color: '#ff9800',
    inputs: [],
    outputs: [
      { id: 'key', name: 'key', type: 'output' as const, dataType: 'string' as const },
      { id: 'exists', name: 'exists', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { service: 'openai' },
    component: APIKeyNode,
  },
  {
    type: 'ConfigValidatorNode',
    name: 'Config Validator',
    category: 'env',
    description: 'Validate required configuration',
    icon: <Check />,
    color: '#8bc34a',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'missing', name: 'missing', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { required: '', failOnMissing: true },
    component: ConfigValidatorNode,
  },
  {
    type: 'FeatureFlagNode',
    name: 'Feature Flag',
    category: 'env',
    description: 'Check feature flag status',
    icon: <Security />,
    color: '#9c27b0',
    inputs: [],
    outputs: [
      { id: 'enabled', name: 'enabled', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { flagName: '', defaultState: 'false' },
    component: FeatureFlagNode,
  },
];

export default ENVIRONMENT_NODE_DEFINITIONS;
