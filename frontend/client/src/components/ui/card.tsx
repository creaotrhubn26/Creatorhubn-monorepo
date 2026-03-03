import * as React from 'react';
import { Box, Card as MuiCard, CardContent as MuiCardContent, Typography, type CardProps as MuiCardProps } from '@mui/material';

export interface CardProps extends MuiCardProps {
  children: React.ReactNode;
}

export function Card({ children, ...props }: CardProps) {
  return <MuiCard {...props}>{children}</MuiCard>;
}

export function CardHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Box> & { children: React.ReactNode }) {
  return (
    <Box {...props} className={className} sx={{ px: 2, pt: 2, pb: 1, ...(props.sx ?? {}) }}>
      {children}
    </Box>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Typography> & { children: React.ReactNode }) {
  return (
    <Typography {...props} className={className} variant="h6">
      {children}
    </Typography>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Typography> & { children: React.ReactNode }) {
  return (
    <Typography {...props} className={className} variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof MuiCardContent> & { children: React.ReactNode }) {
  return (
    <MuiCardContent {...props} className={className}>
      {children}
    </MuiCardContent>
  );
}

export default Card;
