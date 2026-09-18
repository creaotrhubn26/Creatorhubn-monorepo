/**
 * PreprodSubTabStrip — context-strip som vises under hoved-tabs når brukeren
 * er på en av pre-prod-fanene (Lokasjoner / Plan / Team / Rekvisitter).
 * Gir tydelig grupperings-kontekst + raskt switch mellom de fire uten å
 * gå tilbake til hoved-tab-baren.
 *
 * MVP-versjon av tab-grupperingen fra UX-auditen. Full virtuell tab-collapse
 * (16→13) kommer i egen sprint.
 */

import { Box, Chip, Typography } from '@mui/material';
import {
  Construction as ConstructionIcon,
} from '@mui/icons-material';

export interface PreprodSubTabItem {
  tabIndex: number;
  label: string;
}

interface PreprodSubTabStripProps {
  /** Tab-indeksen som er aktiv akkurat nå. Hvis ikke i pre-prod-gruppen
   * returnerer komponenten null. */
  activeTab: number;
  /** Tab-indekser som teller som pre-prod-gruppen. */
  preprodTabs: ReadonlyArray<PreprodSubTabItem>;
  /** Naviger til en av sub-tabsene. */
  onSelectTab: (tabIndex: number) => void;
  /** Skjul (f.eks. i Live Set fullskjerm). */
  hidden?: boolean;
}

export const PreprodSubTabStrip = ({
  activeTab,
  preprodTabs,
  onSelectTab,
  hidden,
}: PreprodSubTabStripProps) => {
  if (hidden) return null;

  const isInPreprodGroup = preprodTabs.some((tab) => tab.tabIndex === activeTab);
  if (!isInPreprodGroup) return null;

  return (
    <Box
      role="navigation"
      aria-label="Pre-prod undermeny"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 1.25, sm: 1.75 },
        py: 0.65,
        borderBottom: '1px solid rgba(147, 164, 220,0.18)',
        bgcolor: 'rgba(93, 118, 203,0.06)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <ConstructionIcon sx={{ fontSize: 14, color: 'var(--role-cyan, #93a4dc)' }} />
        <Typography
          sx={{
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: 'var(--role-cyan, #93a4dc)',
          }}
        >
          Pre-prod
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
        {preprodTabs.map((tab) => {
          const isActive = activeTab === tab.tabIndex;
          return (
            <Chip
              key={tab.tabIndex}
              label={tab.label}
              onClick={() => {
                if (!isActive) onSelectTab(tab.tabIndex);
              }}
              size="small"
              aria-current={isActive ? 'page' : undefined}
              sx={{
                height: 24,
                fontWeight: 700,
                fontSize: '0.74rem',
                bgcolor: isActive ? '#3f51b5' : 'rgba(63, 81, 181,0.12)',
                color: isActive ? '#2a3d56' : '#c3cbe6',
                border: `1px solid ${isActive ? '#5d76cb' : 'rgba(93, 118, 203,0.32)'}`,
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 0.14s',
                '&:hover': isActive ? {} : {
                  bgcolor: 'rgba(63, 81, 181,0.22)',
                  borderColor: 'rgba(93, 118, 203,0.55)',
                  color: '#dfe4f3',
                },
                whiteSpace: 'nowrap',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default PreprodSubTabStrip;
