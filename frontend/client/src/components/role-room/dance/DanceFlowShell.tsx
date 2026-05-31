/**
 * DanceFlowShell — ytre layout-skall for dans-formasjons-flaten.
 *
 * Mockup-referanse: DanceFlow har 3 ytre kolonner:
 *   [ CLIPS-sidebar | Workspace (header + stage + timeline) | Details-sidebar ]
 *
 * Phase 1: skallet eksisterer, men slots er valgfrie. Hvis `clipsSidebar`
 * eller `details` er undefined, kollapses den kolonnen så vi ikke får tomme
 * bånd før Phase 3/4 wirer dem inn. `header` legges over hele bredden.
 *
 * Phase 2 wirer header-prop (FormationHeaderBar).
 * Phase 3 wirer clipsSidebar-prop (ClipsSidebar).
 * Phase 4 forutsetter at center-children (FormationViewConnected) gjør sin
 * egen video|stage-sub-grid; shellet bryr seg ikke om indre struktur.
 *
 * Responsiv: under md kollapser begge sidebars (mobile fokuserer på workspace).
 */
import React from 'react';
import Box from '@mui/material/Box';

import { danceFlowColors, danceFlowSpacing } from './danceFlowTheme';

export interface DanceFlowShellProps {
  /** Toppfelt på tvers av hele shellet (FormationHeaderBar i Phase 2). */
  header?: React.ReactNode;
  /** Venstre kolonne — ClipsSidebar i Phase 3. */
  clipsSidebar?: React.ReactNode;
  /** Senterkolonne — workspace (FormationViewConnected etc.). */
  children: React.ReactNode;
  /** Høyre kolonne — Details/Inspector (eksisterer allerede inne i FormationView). */
  details?: React.ReactNode;
  /** Test-id for Playwright/RTL — default 'dance-flow-shell'. */
  'data-testid'?: string;
}

export default function DanceFlowShell({
  header,
  clipsSidebar,
  children,
  details,
  'data-testid': testId = 'dance-flow-shell',
}: DanceFlowShellProps): React.ReactElement {
  const cols = [
    clipsSidebar ? `${danceFlowSpacing.clipsSidebarWidth}px` : null,
    '1fr',
    details ? `${danceFlowSpacing.detailsSidebarWidth}px` : null,
  ]
    .filter((c): c is string => c !== null)
    .join(' ');

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '100%',
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textPrimary,
      }}
    >
      {header ? (
        <Box
          component="header"
          data-testid={`${testId}-header`}
          sx={{
            flex: '0 0 auto',
            borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
            bgcolor: danceFlowColors.bgPanel,
          }}
        >
          {header}
        </Box>
      ) : null}

      <Box
        sx={{
          flex: '1 1 auto',
          display: 'grid',
          // Sidebars skjules under md slik at workspace får full bredde på mobil/tablet
          gridTemplateColumns: { xs: '1fr', md: cols },
          minHeight: 0,
        }}
      >
        {clipsSidebar ? (
          <Box
            component="aside"
            data-testid={`${testId}-clips`}
            sx={{
              display: { xs: 'none', md: 'block' },
              borderRight: `1px solid ${danceFlowColors.borderStrong}`,
              bgcolor: danceFlowColors.bgPanel,
              overflow: 'auto',
              minHeight: 0,
            }}
          >
            {clipsSidebar}
          </Box>
        ) : null}

        <Box
          component="main"
          data-testid={`${testId}-main`}
          sx={{
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Box>

        {details ? (
          <Box
            component="aside"
            data-testid={`${testId}-details`}
            sx={{
              display: { xs: 'none', md: 'block' },
              borderLeft: `1px solid ${danceFlowColors.borderStrong}`,
              bgcolor: danceFlowColors.bgPanel,
              overflow: 'auto',
              minHeight: 0,
            }}
          >
            {details}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
