import React from 'react';
import { Chip, type ChipProps } from '@mui/material';

interface BadgeProps extends Omit<ChipProps, 'label' | 'color'> {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const variantToColor = (variant: BadgeProps['variant']): ChipProps['color'] => {
  switch (variant) {
    case 'secondary':
      return 'secondary';
    case 'destructive':
      return 'error';
    case 'outline':
      return 'default';
    case 'default':
    default:
      return 'primary';
  }
};

function MaterialBadgeComponent({ children, variant = 'default', className, ...props }: BadgeProps) {
  return (
    <Chip
      label={children}
      color={variantToColor(variant)}
      size="small"
      className={className}
      variant={variant === 'outline' ? 'outlined' : 'filled'}
      {...props}
    />
  );
}

export const MaterialBadge = MaterialBadgeComponent;
export const Badge = MaterialBadgeComponent;
export default MaterialBadgeComponent;
