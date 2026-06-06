import { useState, type ReactNode } from 'react';
import { Box, Collapse, Stack, Typography } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

interface CollapsibleSectionProps {
  title: string;
  /** Én linje vist når seksjonen er sammenslått, så Oversikt er skannbar. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Valgfri badge/chip ved siden av tittelen (f.eks. et antall). */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Sammenslåbar seksjon for å gjøre tette flater (som Planner-Oversikt)
 * skannbare: tunge seksjoner vises sammenslått med en oppsummeringslinje og
 * utvides ved klikk (progressive disclosure). Ingen funksjon fjernes — bare
 * skjult til man trenger den.
 */
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.18)',
        background: 'rgba(15,23,42,0.55)',
        overflow: 'hidden',
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.05,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
          fontFamily: 'inherit',
          transition: 'background 120ms',
          '&:hover': { background: 'rgba(255,255,255,0.04)' },
          '&:focus-visible': { outline: '2px solid rgba(184,107,255,0.5)', outlineOffset: -2 },
        }}
      >
        <ExpandMoreIcon
          sx={{
            color: 'rgba(203,213,225,0.7)',
            transition: 'transform 150ms',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        />
        <Stack spacing={0.1} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>
              {title}
            </Typography>
            {badge}
          </Stack>
          {!open && summary ? (
            <Typography
              component="div"
              sx={{
                color: 'rgba(148,163,184,0.85)',
                fontSize: '0.76rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {summary}
            </Typography>
          ) : null}
        </Stack>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.25, pb: 1.25, pt: 0 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

export default CollapsibleSection;
