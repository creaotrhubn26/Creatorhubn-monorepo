/**
 * RoleCard — kanonisk Card-wrapper for Role Room-paneler.
 *
 * Bakgrunn: hver panel har sin egen Card-styling (border, bg, radius,
 * hover, transition). Den lille variasjonen mellom paneler skaper drift
 * over tid. Denne primitiven gir én standard.
 *
 * Bruk:
 *   <RoleCard>
 *     <CardContent>...</CardContent>
 *   </RoleCard>
 *
 *   // Klikkbar med hover-elevation:
 *   <RoleCard onClick={...} selected={isSelected}>
 *     ...
 *   </RoleCard>
 */

import React from 'react';
import { Card, type CardProps } from '@mui/material';

export interface RoleCardProps extends Omit<CardProps, 'onClick'> {
  /** Når true, vis selected-state border + bg */
  selected?: boolean;
  /** Optional onClick — gjør kortet klikkbart med hover-elevation */
  onClick?: () => void;
  children: React.ReactNode;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  selected,
  onClick,
  children,
  sx,
  ...rest
}) => {
  const interactive = Boolean(onClick);
  return (
    <Card
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      sx={{
        bgcolor: 'rgba(28, 33, 40, 0.8)',
        backdropFilter: 'blur(10px)',
        border: selected
          ? '2px solid #9333ea'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        cursor: interactive ? 'pointer' : 'default',
        '&:hover': interactive
          ? {
              borderColor: selected ? '#c084fc' : 'rgba(147,51,234,0.5)',
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(147,51,234,0.2)',
            }
          : undefined,
        '&:focus-visible': interactive
          ? { outline: '2px solid #60a5fa', outlineOffset: 2 }
          : undefined,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Card>
  );
};
