/**
 * Enhanced Select Component
 * 
 * Styled Select wrapper with design system tokens
 */

import React from 'react';
import { Select, SelectProps, MenuItem, FormControl, InputLabel } from '@mui/material';
import { colors, borderRadius, transitions } from '../../styles/designTokens';

export interface EnhancedSelectProps extends SelectProps {
  options?: Array<{ value: string | number; label: string }>;
  label?: string;
}

export const EnhancedSelect: React.FC<EnhancedSelectProps> = ({
  options = [],
  label,
  sx,
  children,
  ...props
}) => {
  return (
    <FormControl fullWidth={props.fullWidth}>
      {label && (
        <InputLabel
          sx={{
            color: colors.text.secondary,
            '&.Mui-focused': {
              color: colors.border.focus,
            },
          }}
        >
          {label}
        </InputLabel>
      )}
      <Select
        {...props}
        sx={{
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.md,
          color: colors.text.primary,
          transition: transitions.normal,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.border.default,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.border.hover,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.border.focus,
          },
          '& .MuiSelect-icon': {
            color: colors.text.secondary,
          },
          '&:focus-visible': {
            outline: `2px solid ${colors.border.focus}`,
            outlineOffset: '2px',
          },
          ...sx,
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              backgroundColor: colors.background.panel,
              border: `1px solid ${colors.border.default}`,
              borderRadius: borderRadius.md,
              marginTop: 1,
              '& .MuiMenuItem-root': {
                color: colors.text.primary,
                '&:hover': {
                  backgroundColor: colors.background.elevated,
                },
                '&.Mui-selected': {
                  backgroundColor: colors.background.elevated,
                  color: colors.primary,
                  '&:hover': {
                    backgroundColor: colors.background.elevated,
                  },
                },
              },
            },
          },
        }}
      >
        {options.length > 0
          ? options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))
          : children}
      </Select>
    </FormControl>
  );
};


