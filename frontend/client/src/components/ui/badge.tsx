import * as React from 'react';
import { Chip, type ChipProps } from '@mui/material';

type UIBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends Omit<ChipProps, 'label' | 'variant' | 'color' | 'children'> {
  variant?: UIBadgeVariant;
  children?: React.ReactNode;
}

function mapBadgeVariant(variant: UIBadgeVariant): NonNullable<ChipProps['variant']> {
  if (variant === 'outline') return 'outlined';
  return 'filled';
}

function mapBadgeColor(variant: UIBadgeVariant): NonNullable<ChipProps['color']> {
  if (variant === 'destructive') return 'error';
  if (variant === 'secondary') return 'secondary';
  return 'default';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { variant = 'default', children, size = 'small', ...props },
  ref,
) {
  return (
    <Chip
      {...props}
      ref={ref}
      label={children}
      size={size}
      color={mapBadgeColor(variant)}
      variant={mapBadgeVariant(variant)}
    />
  );
});

export default Badge;
