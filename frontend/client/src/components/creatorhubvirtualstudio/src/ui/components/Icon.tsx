/**
 * Icon Component
 * 
 * Consistent icon wrapper with design system styling
 */

import React from 'react';
import { SvgIconProps } from '@mui/material/SvgIcon';
import { colors } from '../../styles/designTokens';

export type IconSize = 16 | 20 | 24 | 32;
export type IconColor = 'primary' | 'secondary' | 'disabled' | 'inherit' | 'error' | 'success' | 'warning' | 'info';

export interface IconProps extends Omit<SvgIconProps, 'color'> {
  size?: IconSize;
  color?: IconColor | string;
  component: React.ComponentType<SvgIconProps>;
}

const getColorValue = (color: IconColor | string): string => {
  if (typeof color === 'string' && color.startsWith('#')) {
    return color;
  }

  switch (color) {
    case 'primary':
      return colors.primary;
    case 'secondary':
      return colors.secondary;
    case 'disabled':
      return colors.text.disabled;
    case 'error':
      return colors.error;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'info':
      return colors.info;
    case 'inherit':
    default:
      return 'inherit';
  }
};

export const Icon: React.FC<IconProps> = ({
  size = 24,
  color = 'inherit',
  component: Component,
  sx,
  ...props
}) => {
  const colorValue = getColorValue(color as IconColor);

  return (
    <Component
      {...props}
      sx={{
        fontSize: size,
        color: colorValue,
        ...sx,
      }}
    />
  );
};


