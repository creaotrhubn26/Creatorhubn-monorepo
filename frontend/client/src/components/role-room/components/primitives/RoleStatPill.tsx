/**
 * RoleStatPill / RoleStatPillRow — kanoniske stat-kort for Role Room-paneler.
 *
 * Bakgrunn: 3 paneler (Equipment 5-stat, Crew 6-stat, Audition 5-stat) har
 * implementert essensielt samme stat-kort-rad fra scratch. Hver har sine
 * mikro-forskjeller i padding/fontSize/responsivitet. Denne primitiven
 * konsoliderer dem til én komponent.
 *
 * Bruk:
 *   <RoleStatPillRow
 *     pills={[
 *       { icon: <InventoryIcon />, count: 324, label: 'Totalt utstyr', color: '#a78bfa' },
 *       { icon: <CheckIcon />, count: 212, label: 'Tilgjengelig nå', color: '#10b981' },
 *       ...
 *     ]}
 *     columns={5}  // valgfri — defaultes til pills.length
 *   />
 *
 * Eller for én enkelt pill:
 *   <RoleStatPill icon={...} count={324} label="Totalt utstyr" color="#a78bfa" />
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

export interface RoleStatPillProps {
  /** Ikonet som vises i farge-tonet boks til venstre */
  icon: React.ReactNode;
  /** Tallet — kan være number eller pre-formatert string (eks "1 248 750 kr") */
  count: number | string;
  /** Label under tallet — eks "Totalt utstyr" */
  label: string;
  /** Hex-farge for ikon-bg + tall — eks "#a78bfa" (lilla), "#10b981" (grønn) */
  color: string;
  /** Optional onClick — gjør pill-en klikkbar (eks. for filter-toggle) */
  onClick?: () => void;
  /** Active-state visuell highlight (brukes når pill-en er valgt som filter) */
  active?: boolean;
}

export const RoleStatPill: React.FC<RoleStatPillProps> = ({
  icon,
  count,
  label,
  color,
  onClick,
  active,
}) => {
  const interactive = Boolean(onClick);
  return (
    <Box
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
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
      aria-pressed={interactive ? active : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        bgcolor: active ? `${color}28` : `${color}14`,
        border: `1px solid ${color}${active ? '66' : '33'}`,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background-color 160ms ease-out, transform 120ms ease-out',
        '&:hover': interactive
          ? { bgcolor: `${color}22`, transform: 'translateY(-1px)' }
          : undefined,
        '&:focus-visible': interactive
          ? { outline: `2px solid ${color}`, outlineOffset: 2 }
          : undefined,
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: `${color}22`,
          color,
          flexShrink: 0,
          '& svg': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>
          {count}
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: '0.7rem',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
};

export interface RoleStatPillRowProps {
  pills: Array<Omit<RoleStatPillProps, 'icon'> & { icon: React.ReactNode; key?: string }>;
  /** Antall kolonner på md+ breakpoint. Default = pills.length (1-rads-grid). */
  columns?: number;
}

export const RoleStatPillRow: React.FC<RoleStatPillRowProps> = ({ pills, columns }) => {
  const cols = columns ?? pills.length;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: cols >= 4 ? 'repeat(3, 1fr)' : `repeat(${Math.min(cols, 2)}, 1fr)`,
          md: `repeat(${cols}, 1fr)`,
        },
        gap: 1.25,
      }}
    >
      {pills.map((p) => (
        <RoleStatPill
          key={p.key ?? p.label}
          icon={p.icon}
          count={p.count}
          label={p.label}
          color={p.color}
          onClick={p.onClick}
          active={p.active}
        />
      ))}
    </Box>
  );
};
