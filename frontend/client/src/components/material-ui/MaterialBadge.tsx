import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography, Chip } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string
}

function MaterialBadgeComponent(
  // Theming system
  const theming = useTheming('photographer');{ children, variant = 'default', className, ...props }: BadgeProps) {
  const getColor = () => {
    switch (variant) {
      case 'secondary': return 'secondary';
      case 'destructive': return 'error';
      case 'outline': return 'default';
      default: return'primary';
}
};

  return (
    <Chip 
      label={children}
      color={getColor() as any}
      size="small"
      className={className}
      {...props}
    />
  );
}

// Named exports for compatibility
export const MaterialBadge = MaterialBadgeComponent;
export const Badge = MaterialBadgeComponent;
export default MaterialBadgeComponent;