/**
 * PlannerBreadcrumb — viser nåværende plassering i Casting Planner.
 *
 * Sti: Root › Prosjekt › Tab. Når prosjekt mangler hopper vi over det
 * mellomste segmentet. Hvert segment unntatt det siste er klikkbart.
 */

import { Box, Typography } from '@mui/material';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';

export interface PlannerBreadcrumbSegment {
  label: string;
  /** Når satt: segmentet er klikkbart. Det siste (nåværende) segment skal
   * normalt ikke ha onClick. */
  onClick?: () => void;
  /** Aria-label-override; default er label */
  ariaLabel?: string;
}

interface PlannerBreadcrumbProps {
  segments: PlannerBreadcrumbSegment[];
  /** Skjul komponenten helt når true (f.eks. i fullskjerm Live Set). */
  hidden?: boolean;
}

export const PlannerBreadcrumb = ({ segments, hidden }: PlannerBreadcrumbProps) => {
  if (hidden) return null;
  if (segments.length === 0) return null;

  return (
    <Box
      role="navigation"
      aria-label="Brødsmuler"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'wrap',
        px: { xs: 1.25, sm: 1.75 },
        py: 0.75,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        bgcolor: 'rgba(255,255,255,0.015)',
      }}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const interactive = !isLast && typeof segment.onClick === 'function';

        return (
          <Box key={`${segment.label}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {index > 0 && (
              <ChevronRightIcon
                aria-hidden
                sx={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}
              />
            )}
            <Typography
              component={interactive ? 'button' : 'span'}
              aria-current={isLast ? 'page' : undefined}
              aria-label={segment.ariaLabel || segment.label}
              onClick={interactive ? segment.onClick : undefined}
              sx={{
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
                fontWeight: isLast ? 600 : 500,
                color: isLast ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)',
                background: 'none',
                border: 'none',
                p: 0,
                cursor: interactive ? 'pointer' : 'default',
                font: 'inherit',
                letterSpacing: 0.2,
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 120ms',
                '&:hover': interactive ? { color: '#fff' } : undefined,
                '&:focus-visible': interactive
                  ? { outline: '2px solid rgba(184,107,255,0.55)', outlineOffset: 2, borderRadius: 1 }
                  : undefined,
              }}
            >
              {segment.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default PlannerBreadcrumb;
