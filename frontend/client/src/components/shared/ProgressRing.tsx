/**
 * ProgressRing Component
 * SVG-based circular progress indicator with customization options
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { progressUtils } from '@/utils/svg-render';

export interface ProgressRingProps {
  /** Progress percentage (0-100) */
  percentage: number;
  /** Radius of the ring */
  radius?: number;
  /** Width of the ring stroke */
  strokeWidth?: number;
  /** Color of the progress indicator */
  color?: string;
  /** Background color of the ring */
  backgroundColor?: string;
  /** Show percentage label in center */
  showLabel?: boolean;
  /** Custom label text (overrides percentage) */
  label?: string;
  /** Label font size */
  labelSize?: string;
  /** Label color */
  labelColor?: string;
  /** Additional className */
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  radius = 40,
  strokeWidth = 8,
  color = '#4caf50',
  backgroundColor = '#e0e0e0',
  showLabel = true,
  label,
  labelSize = '1.2rem',
  labelColor = '#333',
  className,
}) => {
  const size = radius * 2 + strokeWidth;

  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'}}>
      {progressUtils.progressRing(percentage, radius, strokeWidth, color, backgroundColor)}

      {showLabel && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'}}>
          <Typography
            variant="h6"
            sx={{
              fontSize: labelSize,
              fontWeight: 70,
              color: labelColor,
              lineHeight: 1}}>
            {label || `${Math.round(percentage)}%`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ProgressRing;
