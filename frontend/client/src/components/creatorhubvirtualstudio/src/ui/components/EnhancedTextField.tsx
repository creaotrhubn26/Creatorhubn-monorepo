/**
 * Enhanced TextField Component
 * 
 * Styled TextField wrapper with design system tokens
 */

import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { colors, borderRadius, transitions } from '../../styles/designTokens';

export interface EnhancedTextFieldProps extends TextFieldProps {
  // Additional props can be added here
}

export const EnhancedTextField: React.FC<EnhancedTextFieldProps> = ({
  sx,
  ...props
}) => {
  return (
    <TextField
      {...props}
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
          '&::placeholder': {
            color: colors.text.tertiary,
            opacity: 1,
          },
        },
        '& .MuiInputLabel-root': {
          color: colors.text.secondary,
          '&.Mui-focused': {
            color: colors.border.focus,
          },
        },
        '&:focus-visible': {
          outline: `2px solid ${colors.border.focus}`,
          outlineOffset: '2px',
          borderRadius: borderRadius.md,
        },
        ...sx,
      }}
    />
  );
};


