/**
 * Skip Link Component
 * 
 * Accessibility skip link for keyboard navigation
 */

import React from 'react';
import { Box } from '@mui/material';
import { colors, spacing, borderRadius } from '../../styles/designTokens';

export interface SkipLinkProps {
  href: string;
  label?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  href,
  label = 'Skip to main content',
}) => {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        zIndex: 10000,
        padding: `${spacing.sm}px ${spacing.md}px`,
        backgroundColor: colors.primary,
        color: colors.text.inverse,
        textDecoration: 'none',
        borderRadius: borderRadius.md,
        fontWeight: 600,
        fontSize: 14,
        transform: 'translateY(-100%)',
        transition: 'transform 0.2s ease',
        '&:focus': {
          transform: 'translateY(0)',
          outline: `2px solid ${colors.border.focus}`,
          outlineOffset: '2px',
        },
      }}
    >
      {label}
    </Box>
  );
};


