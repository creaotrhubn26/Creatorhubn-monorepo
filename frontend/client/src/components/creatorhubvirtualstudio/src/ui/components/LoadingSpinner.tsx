/**
 * Loading Spinner Component
 * 
 * Circular progress indicator with design system styling
 */

import React from 'react';
import { CircularProgress, Box, BoxProps, Typography } from '@mui/material';
import { colors } from '../../styles/designTokens';

export interface LoadingSpinnerProps extends BoxProps {
  size?: number;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  message,
  fullScreen = false,
  sx,
  ...props
}) => {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        ...sx,
      }}
      {...props}
    >
      <CircularProgress
        size={size}
        sx={{
          color: colors.primary,
        }}
      />
      {message && (
        <Typography
          variant="body2"
          sx={{
            color: colors.text.secondary,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
};


