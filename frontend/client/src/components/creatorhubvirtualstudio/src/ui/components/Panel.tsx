/**
 * Enhanced Panel Component
 * 
 * Styled panel wrapper with header and consistent styling
 */

import React from 'react';
import { Box, Typography, BoxProps } from '@mui/material';
import { colors, spacing, borderRadius, shadows } from '../../styles/designTokens';

export interface PanelProps extends BoxProps {
  title?: string;
  header?: React.ReactNode;
  headerHeight?: number;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  header,
  headerHeight = 48,
  sx,
  children,
  ...props
}) => {
  return (
    <Box
      {...props}
      sx={{
        backgroundColor: colors.background.panel,
        border: `1px solid ${colors.border.default}`,
        borderRadius: borderRadius.md,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {(title || header) && (
        <Box
          sx={{
            height: headerHeight,
            padding: `0 ${spacing.md}px`,
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${colors.border.divider}`,
            backgroundColor: colors.background.base,
          }}
        >
          {header || (
            <Typography
              variant="h6"
              sx={{
                fontSize: 14,
                fontWeight: 600,
                color: colors.text.primary,
              }}
            >
              {title}
            </Typography>
          )}
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          padding: spacing.md,
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};


