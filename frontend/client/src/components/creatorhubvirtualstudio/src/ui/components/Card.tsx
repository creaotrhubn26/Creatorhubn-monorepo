/**
 * Enhanced Card Component
 * 
 * Styled card with consistent styling and hover effects
 */

import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { colors, borderRadius, shadows, transitions, spacing } from '../../styles/designTokens';
import { interactiveStyles } from '../../styles/interactiveStates';

export interface CardProps extends BoxProps {
  hoverable?: boolean;
  selected?: boolean;
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  selected = false,
  sx,
  children,
  ...props
}) => {
  return (
    <Box
      {...props}
      sx={{
        backgroundColor: colors.background.card,
        border: `1px solid ${selected ? colors.border.focus : colors.border.default}`,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        transition: transitions.normal,
        ...(hoverable && interactiveStyles.card),
        ...(selected && {
          borderColor: colors.border.focus,
          boxShadow: shadows.md,
        }),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};


