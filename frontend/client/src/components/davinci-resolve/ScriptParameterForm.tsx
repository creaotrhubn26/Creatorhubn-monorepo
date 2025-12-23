/**
 * ScriptParameterForm - Dynamic form builder for script parameters
 * Supports multiple input types with validation and presets
 */

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Typography,
  Button,
  Chip,
  Stack,
  Alert,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Help,
  ExpandMore,
  Refresh,
  Star,
} from '@mui/icons-material';
import { ScriptParameter, ScriptPreset } from './scriptData';

interface ScriptParameterFormProps {
  parameters: ScriptParameter[];
  presets?: ScriptPreset[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onValidate?: (isValid: boolean, errors: Record<string, string>) => void;
}

export default function ScriptParameterForm({
  parameters,
  presets = [],
  values,
  onChange,
  onValidate,
}: ScriptParameterFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPresets, setShowPresets] = useState(presets.length > 0);

  // Handle value change with validation
  const handleChange = (name: string, value: any) => {
    const newValues = { ...values, [name]: value };
    onChange(newValues);

    // Validate
    const param = parameters.find((p) => p.name === name);
    if (param) {
      const error = validateParameter(param, value);
      const newErrors = { ...errors };
      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }
      setErrors(newErrors);
      
      if (onValidate) {
        onValidate(Object.keys(newErrors).length === 0, newErrors);
      }
    }
  };

  // Validate a single parameter
  const validateParameter = (param: ScriptParameter, value: any): string | null => {
    if (param.required && (value === undefined || value === null || value === '')) {
      return `${param.description} is required`;
    }

    if (param.validation) {
      const result = param.validation(value);
      if (typeof result === 'string') {
        return result;
      }
      if (result === false) {
        return `Invalid value for ${param.description}`;
      }
    }

    if (param.type === 'range' && param.min !== undefined && param.max !== undefined) {
      if (value < param.min || value > param.max) {
        return `Value must be between ${param.min} and ${param.max}`;
      }
    }

    return null;
  };

  // Apply a preset
  const applyPreset = (preset: ScriptPreset) => {
    onChange({ ...values, ...preset.parameters });
    setErrors({});
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const defaults: Record<string, any> = {};
    parameters.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    });
    onChange(defaults);
    setErrors({});
  };

  // Render input based on parameter type
  const renderInput = (param: ScriptParameter) => {
    const value = values[param.name] ?? param.default;
    const error = errors[param.name];

    switch (param.type) {
      case 'string':
        return (
          <TextField
            fullWidth
            label={param.description}
            value={value || ''}
            onChange={(e) => handleChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            required={param.required}
            error={!!error}
            helperText={error || param.helpText}
            size="small"
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={param.description}
            value={value || ''}
            onChange={(e) => handleChange(param.name, parseFloat(e.target.value))}
            placeholder={param.placeholder}
            required={param.required}
            error={!!error}
            helperText={error || param.helpText}
            size="small"
            slotProps={{
              htmlInput: {
                min: param.min,
                max: param.max,
                step: param.step,
              }}}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={value || false}
                onChange={(e) => handleChange(param.name, e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{param.description}</Typography>
                {param.helpText && (
                  <Typography variant="caption" color="text.secondary">
                    {param.helpText}
                  </Typography>
                )}
              </Box>
            }
          />
        );

      case 'select':
        return (
          <FormControl fullWidth size="small" error={!!error} required={param.required}>
            <InputLabel>{param.description}</InputLabel>
            <Select
              value={value || ''}
              label={param.description}
              onChange={(e) => handleChange(param.name, e.target.value)}
            >
              {param.options?.map((option) => {
                const optionValue = typeof option === 'string' ? option : option.value;
                const optionLabel = typeof option === 'string' ? option : option.label;
                return (
                  <MenuItem key={optionValue} value={optionValue}>
                    {optionLabel}
                  </MenuItem>
                );
              })}
            </Select>
            {(error || param.helpText) && (
              <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.5 }}>
                {error || param.helpText}
              </Typography>
            )}
          </FormControl>
        );

      case 'range':
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">{param.description}</Typography>
              <Typography variant="body2" fontWeight={600}>
                {value ?? param.default}
              </Typography>
            </Box>
            <Slider
              value={value ?? param.default ?? 50}
              onChange={(_, newValue) => handleChange(param.name, newValue)}
              min={param.min}
              max={param.max}
              step={param.step}
              marks
              valueLabelDisplay="auto"
            />
            {param.helpText && (
              <Typography variant="caption" color="text.secondary">
                {param.helpText}
              </Typography>
            )}
          </Box>
        );

      case 'file':
        return (
          <Box>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              size="small"
            >
              {value ? `Selected: ${value.name || value}` : param.description}
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleChange(param.name, file);
                  }
                }}
              />
            </Button>
            {param.helpText && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {param.helpText}
              </Typography>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Presets Section */}
      {presets.length > 0 && (
        <Accordion expanded={showPresets} onChange={() => setShowPresets(!showPresets)} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Star sx={{ color: 'warning.main' }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Quick Start Presets
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {presets.map((preset) => (
                <Chip
                  key={preset.name}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {preset.icon && <span>{preset.icon}</span>}
                      <span>{preset.name}</span>
                    </Box>
                  }
                  onClick={() => applyPreset(preset)}
                  variant="outlined"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Click a preset to quickly configure parameters
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Parameters Form */}
      <Stack spacing={2.5}>
        {parameters.map((param) => (
          <Box key={param.name}>
            {renderInput(param)}
          </Box>
        ))}
      </Stack>

      {/* Actions */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          startIcon={<Refresh />}
          onClick={resetToDefaults}
          size="small"
        >
          Reset to Defaults
        </Button>
      </Box>

      {/* Validation Summary */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            Please fix the following errors:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.values(errors).map((error, index) => (
              <li key={index}>
                <Typography variant="caption">{error}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </Box>
  );
}

