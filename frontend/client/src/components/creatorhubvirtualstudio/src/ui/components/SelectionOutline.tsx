/**
 * Selection Outline Component
 * 
 * Visual outline for selected objects in 3D scene
 */

import React from 'react';
import { Box } from '@mui/material';
import { colors, borderRadius } from '../../styles/designTokens';

export interface SelectionOutlineProps {
  selected: boolean;
  children: React.ReactNode;
  outlineColor?: string;
  outlineWidth?: number;
}

export const SelectionOutline: React.FC<SelectionOutlineProps> = ({
  selected,
  children,
  outlineColor = colors.border.focus,
  outlineWidth = 2,
}) => {
  if (!selected) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -outlineWidth,
          left: -outlineWidth,
          right: -outlineWidth,
          bottom: -outlineWidth,
          border: `${outlineWidth}px solid ${outlineColor}`,
          borderRadius: borderRadius.md,
          pointerEvents: 'none',
          zIndex: 1,
        },
      }}
    >
      {children}
    </Box>
  );
};


