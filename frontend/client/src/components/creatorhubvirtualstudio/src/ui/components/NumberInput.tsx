/**
 * Enhanced Number Input Component
 * 
 * Numeric input with increment/decrement buttons
 * Supports mouse wheel and keyboard shortcuts
 */

import React, { useState, useCallback } from 'react';
import { TextField, IconButton, Box, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { colors, spacing, borderRadius, transitions } from '../../styles/designTokens';

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  precision?: number;
  suffix?: string;
  prefix?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  disabled = false,
  precision = 2,
  suffix,
  prefix,
  fullWidth = false,
  size = 'medium',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleIncrement = useCallback(() => {
    const newValue = value + step;
    if (max === undefined || newValue <= max) {
      onChange(Number(newValue.toFixed(precision)));
    }
  }, [value, step, max, precision, onChange]);

  const handleDecrement = useCallback(() => {
    const newValue = value - step;
    if (min === undefined || newValue >= min) {
      onChange(Number(newValue.toFixed(precision)));
    }
  }, [value, step, min, precision, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '' || inputValue === '-') {
      onChange(0);
      return;
    }
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      let clampedValue = numValue;
      if (min !== undefined && clampedValue < min) clampedValue = min;
      if (max !== undefined && clampedValue > max) clampedValue = max;
      onChange(Number(clampedValue.toFixed(precision)));
    }
  }, [min, max, precision, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  }, [handleIncrement, handleDecrement]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    if (isFocused) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleIncrement();
      } else {
        handleDecrement();
      }
    }
  }, [isFocused, handleIncrement, handleDecrement]);

  return (
    <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
      <TextField
        type="number"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        label={label}
        disabled={disabled}
        size={size}
        fullWidth={fullWidth}
        InputProps={{
          startAdornment: prefix ? (
            <InputAdornment position="start">{prefix}</InputAdornment>
          ) : undefined,
          endAdornment: (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {suffix && (
                <InputAdornment position="end">{suffix}</InputAdornment>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <IconButton
                  size="small"
                  onClick={handleIncrement}
                  disabled={disabled || (max !== undefined && value >= max)}
                  sx={{
                    height: 16,
                    width: 16,
                    padding: 0,
                    color: colors.text.secondary,
                    '&:hover': {
                      color: colors.text.primary,
                      backgroundColor: colors.background.elevated,
                    },
                    '&:disabled': {
                      opacity: 0.3,
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleDecrement}
                  disabled={disabled || (min !== undefined && value <= min)}
                  sx={{
                    height: 16,
                    width: 16,
                    padding: 0,
                    color: colors.text.secondary,
                    '&:hover': {
                      color: colors.text.primary,
                      backgroundColor: colors.background.elevated,
                    },
                    '&:disabled': {
                      opacity: 0.3,
                    },
                  }}
                >
                  <RemoveIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            </Box>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.md,
            transition: transitions.normal,
            '& fieldset': {
              borderColor: colors.border.default,
            },
            '&:hover fieldset': {
              borderColor: colors.border.hover,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.border.focus,
            },
          },
          '& .MuiInputBase-input': {
            color: colors.text.primary,
            '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
              opacity: 1,
            },
          },
        }}
      />
    </Box>
  );
};

