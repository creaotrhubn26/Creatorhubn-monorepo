/**
 * Validation Nodes
 * Nodes for form and data validation
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
  Check,
  Email,
  Pattern,
  Numbers,
  TextFields,
  Rule,
  Warning,
} from '@mui/icons-material';
import type { NodeConfig } from './BaseNode';
import { BaseNode } from './BaseNode';

const getBooleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

// Required Validator Node
export const RequiredNode = memo(function RequiredNode({
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
        name: 'Required',
        color: '#8bc34a',
        icon: <Check sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Error Message"
            value={data.message || 'This field is required'}
            onChange={(e) => onChange('message', e.target.value)}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.allowEmpty !== true}
                onChange={(e) => onChange('allowEmpty', !e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Trim whitespace</Typography>}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Validates that input is not empty
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Email Validator Node
export const EmailValidatorNode = memo(function EmailValidatorNode({
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
        name: 'Email',
        color: '#8bc34a',
        icon: <Email sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Error Message"
            value={data.message || 'Please enter a valid email'}
            onChange={(e) => onChange('message', e.target.value)}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.checkDomain)}
                onChange={(e) => onChange('checkDomain', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Validate domain (MX check)</Typography>}
          />

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Chip size="small" label="RFC 5322" sx={{ bgcolor: 'rgba(139,195,74,0.2)', color: '#8bc34a' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Pattern Validator Node
export const PatternValidatorNode = memo(function PatternValidatorNode({
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
        name: 'Pattern',
        color: '#8bc34a',
        icon: <Pattern sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Regex Pattern"
            value={data.pattern || ''}
            onChange={(e) => onChange('pattern', e.target.value)}
            placeholder="^[a-zA-Z0-9]+$"
            sx={{ mb: 1, fontFamily: 'monospace' }}
          />

          <TextField
            fullWidth
            size="small"
            label="Error Message"
            value={data.message || 'Invalid format'}
            onChange={(e) => onChange('message', e.target.value)}
            sx={{ mb: 1 }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Presets:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {[
              { label: 'Phone', pattern: '^\\+?[0-9]{8,15}$' },
              { label: 'URL', pattern: '^https?://' },
              { label: 'Alphanumeric', pattern: '^[a-zA-Z0-9]+$' },
              { label: 'No Spaces', pattern: '^\\S+$' },
            ].map((preset) => (
              <Chip
                key={preset.label}
                size="small"
                label={preset.label}
                onClick={() => onChange('pattern', preset.pattern)}
                sx={{ bgcolor: 'rgba(139,195,74,0.2)', color: '#8bc34a', mb: 0.5 }}
              />
            ))}
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Range Validator Node
export const RangeValidatorNode = memo(function RangeValidatorNode({
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
        name: 'Range',
        color: '#8bc34a',
        icon: <Numbers sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Validate</InputLabel>
            <Select
              value={data.validateType || 'number'}
              onChange={(e) => onChange('validateType', e.target.value)}
              label="Validate"
            >
              <MenuItem value="number">Number Value</MenuItem>
              <MenuItem value="length">String Length</MenuItem>
              <MenuItem value="arrayLength">Array Length</MenuItem>
              <MenuItem value="date">Date Range</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              label="Min"
              type="number"
              value={data.min ?? ''}
              onChange={(e) => onChange('min', e.target.value ? parseFloat(e.target.value) : undefined)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Max"
              type="number"
              value={data.max ?? ''}
              onChange={(e) => onChange('max', e.target.value ? parseFloat(e.target.value) : undefined)}
              sx={{ flex: 1 }}
            />
          </Stack>

          <TextField
            fullWidth
            size="small"
            label="Error Message"
            value={data.message || 'Value out of range'}
            onChange={(e) => onChange('message', e.target.value)}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Length Validator Node
export const LengthValidatorNode = memo(function LengthValidatorNode({
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
        name: 'Length',
        color: '#8bc34a',
        icon: <TextFields sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              label="Min Length"
              type="number"
              value={data.minLength ?? ''}
              onChange={(e) => onChange('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Max Length"
              type="number"
              value={data.maxLength ?? ''}
              onChange={(e) => onChange('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
              sx={{ flex: 1 }}
            />
          </Stack>

          <TextField
            fullWidth
            size="small"
            label="Too Short Message"
            value={data.minMessage || 'Too short'}
            onChange={(e) => onChange('minMessage', e.target.value)}
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Too Long Message"
            value={data.maxMessage || 'Too long'}
            onChange={(e) => onChange('maxMessage', e.target.value)}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Custom Validator Node
export const CustomValidatorNode = memo(function CustomValidatorNode({
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
        name: 'Custom Validator',
        color: '#8bc34a',
        icon: <Rule sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Validation Function"
            value={data.validator || ''}
            onChange={(e) => onChange('validator', e.target.value)}
            placeholder="(value) => value.length > 0"
            multiline
            rows={3}
            sx={{ mb: 1, fontFamily: 'monospace' }}
          />

          <TextField
            fullWidth
            size="small"
            label="Error Message"
            value={data.message || 'Validation failed'}
            onChange={(e) => onChange('message', e.target.value)}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.async)}
                onChange={(e) => onChange('async', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Async validation</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Form Validator Node (combines multiple validations)
export const FormValidatorNode = memo(function FormValidatorNode({
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
        name: 'Form Validator',
        color: '#8bc34a',
        icon: <Warning sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Validation Mode</InputLabel>
            <Select
              value={data.mode || 'onChange'}
              onChange={(e) => onChange('mode', e.target.value)}
              label="Validation Mode"
            >
              <MenuItem value="onChange">On Change</MenuItem>
              <MenuItem value="onBlur">On Blur</MenuItem>
              <MenuItem value="onSubmit">On Submit</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.revalidateOnChange !== false}
                onChange={(e) => onChange('revalidateOnChange', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Revalidate on change</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.showAllErrors)}
                onChange={(e) => onChange('showAllErrors', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Show all errors at once</Typography>}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Connect individual validators to the rules input
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const VALIDATION_NODE_DEFINITIONS = [
  {
    type: 'RequiredNode',
    name: 'Required',
    category: 'validation',
    description: 'Validates field is not empty',
    icon: <Check />,
    color: '#8bc34a',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { message: 'This field is required', allowEmpty: false },
    component: RequiredNode,
  },
  {
    type: 'EmailValidatorNode',
    name: 'Email',
    category: 'validation',
    description: 'Validates email format',
    icon: <Email />,
    color: '#8bc34a',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'string' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { message: 'Please enter a valid email', checkDomain: false },
    component: EmailValidatorNode,
  },
  {
    type: 'PatternValidatorNode',
    name: 'Pattern',
    category: 'validation',
    description: 'Validates against regex pattern',
    icon: <Pattern />,
    color: '#8bc34a',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'string' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { pattern: '', message: 'Invalid format' },
    component: PatternValidatorNode,
  },
  {
    type: 'RangeValidatorNode',
    name: 'Range',
    category: 'validation',
    description: 'Validates number/length range',
    icon: <Numbers />,
    color: '#8bc34a',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { validateType: 'number', message: 'Value out of range' },
    component: RangeValidatorNode,
  },
  {
    type: 'LengthValidatorNode',
    name: 'Length',
    category: 'validation',
    description: 'Validates string length',
    icon: <TextFields />,
    color: '#8bc34a',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'string' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { minMessage: 'Too short', maxMessage: 'Too long' },
    component: LengthValidatorNode,
  },
  {
    type: 'CustomValidatorNode',
    name: 'Custom Validator',
    category: 'validation',
    description: 'Custom validation function',
    icon: <Rule />,
    color: '#8bc34a',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'valid', name: 'valid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { validator: '', message: 'Validation failed', async: false },
    component: CustomValidatorNode,
  },
  {
    type: 'FormValidatorNode',
    name: 'Form Validator',
    category: 'validation',
    description: 'Combines multiple validators',
    icon: <Warning />,
    color: '#8bc34a',
    inputs: [
      { id: 'formData', name: 'formData', type: 'input' as const, dataType: 'object' as const },
      { id: 'rules', name: 'rules', type: 'input' as const, dataType: 'array' as const },
    ],
    outputs: [
      { id: 'isValid', name: 'isValid', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'errors', name: 'errors', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { mode: 'onChange', revalidateOnChange: true, showAllErrors: false },
    component: FormValidatorNode,
  },
];

export default VALIDATION_NODE_DEFINITIONS;
