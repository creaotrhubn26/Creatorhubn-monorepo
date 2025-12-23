/**
 * CreatorHub Norge - Google Pay Acceptance Badge
 * Official Google Pay acceptance mark following brand guidelines
 */

import React from 'react';
import { Box, Tooltip } from '@mui/material';

interface GooglePayBadgeProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'svg' | 'png';
  showTooltip?: boolean;
  style?: React.CSSProperties;
}

const sizeMap = {
  small: { width: 60, height: 'auto' },
  medium: { width: 100, height: 'auto' },
  large: { width: 150, height: 'auto' },
};

export default function GooglePayBadge({
  size = 'medium',
  variant = 'svg',
  showTooltip = true,
  style,
}: GooglePayBadgeProps) {
  const dimensions = sizeMap[size];
  const imagePath =
    variant === 'svg'
      ? '/assets/google-pay/google-pay-mark_800.svg' : '/assets/google-pay/GPay_Acceptance_Mark_800.png';

  const badge = (
    <Box
      component="img"
      src={imagePath}
      alt="Google Pay akseptert"
      sx={{
        ...dimensions,
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style}} />
  );

  if (showTooltip) {
    return (
      <Tooltip title="Vi aksepterer Google Pay for rask og sikker betaling" arrow>
        {badge}
      </Tooltip>
    );
  }

  return badge;
}
