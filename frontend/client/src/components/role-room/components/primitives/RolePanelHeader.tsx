/**
 * RolePanelHeader — kanonisk header for Role Room-paneler.
 *
 * Bakgrunn: hver panel har sin egen header-rad med tittel + subtittel
 * + action-knapper, alle implementert lokalt med subtil divergens i
 * padding, font-size og responsiv-strategi. Denne primitiven gir én
 * konsistent header-løsning.
 *
 * Bruk:
 *   <RolePanelHeader
 *     title="Lokasjoner"
 *     subtitle="Studio, location, set"
 *     icon={<LocationIcon />}
 *     actions={
 *       <>
 *         <Button>Eksporter</Button>
 *         <Button variant="contained">+ Ny lokasjon</Button>
 *       </>
 *     }
 *   />
 */

import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

export interface RolePanelHeaderProps {
  /** Hoved-tittel — vises som h6 fontWeight 700 */
  title: string;
  /** Optional subtittel — vises muted under tittelen */
  subtitle?: string;
  /** Optional ikon — vises i lilla rounded-square til venstre for tittel */
  icon?: React.ReactNode;
  /** Action-elementer (knapper, chips) som vises til høyre. Bruk Button/IconButton. */
  actions?: React.ReactNode;
  /** Optional border-bottom for å skille fra innholdet. Default true. */
  showBorderBottom?: boolean;
}

export const RolePanelHeader: React.FC<RolePanelHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  showBorderBottom = true,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
        pb: showBorderBottom ? 1.5 : 0,
        borderBottom: showBorderBottom ? '1px solid rgba(184,107,255,0.18)' : 'none',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        {icon && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: 'rgba(184,107,255,0.22)',
              color: '#c4b5fd',
              flexShrink: 0,
              '& svg': { fontSize: 22 },
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: '#fff',
              fontSize: { xs: '1.05rem', sm: '1.18rem', md: '1.12rem', lg: '1.25rem', xl: '1.4rem' },
              fontWeight: 700,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.62)',
                fontSize: { xs: '0.75rem', sm: '0.82rem', md: '0.78rem', lg: '0.85rem', xl: '0.95rem' },
                lineHeight: 1.3,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {actions}
        </Stack>
      )}
    </Box>
  );
};
