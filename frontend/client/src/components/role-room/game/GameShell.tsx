/**
 * GameShell — sidebar + topbar for Story Graph (Fase 7b).
 *
 * Navigasjonen er `<Tabs orientation="vertical">` slik at `role=tab` /
 * `aria-selected` består (specs sjekker `narrative-tab-<id>`). På mobil
 * ligger samme Tabs i en Drawer; kun én instans rendres om gangen så
 * testid-ene er unike.
 */
import React, { useMemo, useState } from 'react';
import { Box, Chip, Divider, Drawer, IconButton, Stack, Tab, Tabs, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon, Search as SearchIcon } from '@mui/icons-material';
import type { TabConfig } from '../config/professionTabs';
import { narrativeColors } from '../narrative/narrativeTheme';
import { GAME_SECTION_LABELS, gameTabIcon } from './gameShellIcons';

export const GAME_SHELL_SIDEBAR_WIDTH = 252;

export interface GameShellProps {
  tabs: readonly TabConfig[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  labels: Record<string, string | undefined>;
  /** Venstre del av topbaren (modus-chip, tittel). */
  header: React.ReactNode;
  /** Høyre del av topbaren (presence, prosjekt, bjelle). */
  headerActions?: React.ReactNode;
  /** Klikk på ⌘K-chipen. */
  onOpenSearch?: () => void;
  children: React.ReactNode;
}

const SECTION_ORDER: Array<'core' | 'production' | 'resources' | 'finance'> = ['core', 'production', 'resources', 'finance'];

export function GameShell({ tabs, activeTabId, onSelectTab, labels, header, headerActions, onOpenSearch, children }: GameShellProps): React.ReactElement {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sections = useMemo(() => SECTION_ORDER
    .map((feature) => ({ feature, tabs: tabs.filter((t) => (t.feature ?? 'core') === feature) }))
    .filter((s) => s.tabs.length > 0), [tabs]);

  // NB: MUI's <Tabs> clones tab-only props (textColor, fullWidth, indicator,
  // selectionFollowsFocus, …) onto EVERY direct child, not just <Tab>
  // elements. Mixing the section-header <Typography> in as a Tabs child (as
  // this used to do via one big flatMap) made those internal props land on
  // Typography's underlying DOM node → "React does not recognize the
  // `textColor`/`indicator`/… prop" warnings (UX-15). Fix: one <Tabs> per
  // section containing ONLY <Tab> children; headers render as plain
  // siblings outside the Tabs tree. `textColor="inherit"` also stops MUI's
  // own selected-state color from fighting our custom contrast-safe style
  // below (UX-16).
  const navSx = {
    '& .MuiTabs-flexContainer': { gap: 0 },
    '& .MuiTab-root': {
      textTransform: 'none', fontWeight: 600, color: narrativeColors.textDim, minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.84rem',
      opacity: 1, // MUI textColorInherit setter 0.6 → 3,5:1 sammen med textDim (UX-16)
      justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row', gap: 1.25, borderRadius: 1.5, mx: 1,
      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: narrativeColors.text },
    },
    // rgba(34,197,94,0.10) + #eafff2 clears WCAG AA (≥4.5:1) against the dark
    // panel background — the previous 0.15-alpha green + white combo read
    // close to accent-on-accent under some renderers.
    '& .Mui-selected': { color: '#eafff2', bgcolor: 'rgba(34,197,94,0.10)' },
  } as const;

  const nav = (
    <Box aria-label="Story Graph-navigasjon" data-testid="narrative-sidebar-nav" sx={navSx}>
      {sections.map((section, si) => (
        <React.Fragment key={section.feature}>
          <Typography
            component="div"
            sx={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700, px: 2.5, pt: si === 0 ? 1 : 2, pb: 0.5 }}
            data-testid={`narrative-sidebar-section-${section.feature}`}
          >
            {GAME_SECTION_LABELS[section.feature ?? 'core']}
          </Typography>
          <Tabs
            orientation="vertical"
            textColor="inherit"
            value={section.tabs.some((t) => t.id === activeTabId) ? activeTabId : false}
            onChange={(_, value) => { onSelectTab(value); setDrawerOpen(false); }}
            TabIndicatorProps={{ sx: { left: 0, width: 3, bgcolor: narrativeColors.accent, borderRadius: 1.5 } }}
          >
            {section.tabs.map((tab) => (
              <Tab
                key={tab.id}
                value={tab.id}
                icon={gameTabIcon(tab.id) ?? undefined}
                iconPosition="start"
                label={labels[tab.labelToken] ?? tab.id}
                data-testid={`narrative-tab-${tab.id}`}
                sx={{ '& .MuiTab-iconWrapper': { mb: 0, mr: 0 } }}
              />
            ))}
          </Tabs>
        </React.Fragment>
      ))}
    </Box>
  );

  const sidebarInner = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: narrativeColors.bgPanel, borderRight: `1px solid ${narrativeColors.borderStrong}` }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography component="div" sx={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>Story Graph</Typography>
        <Chip size="small" label="Beta" sx={{ height: 20, fontSize: 10, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} />
      </Box>
      <Divider sx={{ borderColor: narrativeColors.borderStrong }} />
      <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>{nav}</Box>
      {onOpenSearch ? (
        <Box sx={{ p: 1.5, borderTop: `1px solid ${narrativeColors.borderStrong}` }}>
          <Chip
            icon={<SearchIcon sx={{ fontSize: 16 }} />}
            label="Søk eller hopp til… ⌘K"
            onClick={onOpenSearch}
            data-testid="narrative-shell-search"
            sx={{ width: '100%', height: { xs: 40, md: 32 }, justifyContent: 'flex-start', color: narrativeColors.textDim, bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${narrativeColors.borderStrong}`, '& .MuiChip-label': { fontSize: 12 } }}
          />
        </Box>
      ) : null}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#050505', color: narrativeColors.text }} data-testid="narrative-shell">
      {isDesktop ? (
        <Box component="aside" sx={{ width: GAME_SHELL_SIDEBAR_WIDTH, flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }} data-testid="narrative-sidebar">
          {sidebarInner}
        </Box>
      ) : (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: GAME_SHELL_SIDEBAR_WIDTH, bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } }} data-testid="narrative-sidebar-drawer">
          {sidebarInner}
        </Drawer>
      )}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid rgba(34,197,94,0.18)`, px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }} data-testid="narrative-topbar">
          {!isDesktop ? (
            <>
              <Tooltip title="Meny">
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  sx={{ color: narrativeColors.textDim, width: 40, height: 40 }}
                  aria-label="Åpne meny"
                  data-testid="narrative-shell-menu"
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* Sidebaren (som eier «Story Graph»-tittelen) er skjult bak et
                  Drawer på mobil — vis en fallback-tittel i topbaren her så
                  siden ikke mangler identitet. Desktop har den allerede i
                  den faste sidebaren, så ikke gjenta den der (UX-11). */}
              <Typography component="div"
                sx={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 0.75 }}
                data-testid="narrative-topbar-title"
              >
                Story Graph
                <Chip size="small" label="Beta" sx={{ height: 18, fontSize: 9, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} />
              </Typography>
            </>
          ) : null}
          {header}
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center">{headerActions}</Stack>
        </Box>
        {/* pb reserverer plass under siste innholdsrad slik at den fastlåste
            hjelpe-FAB-en (shared/HelpButton, ~56px nederst til høyre) ikke
            dekker den (UX-13). */}
        <Box role="tabpanel" sx={{ flex: 1, minHeight: 0, pb: { xs: 12, md: 10 }, '@media (max-width:899.95px)': { '& .MuiButton-sizeSmall': { minHeight: 36 }, '& .MuiIconButton-sizeSmall': { minWidth: 36, minHeight: 36 }, '& .MuiChip-clickable': { minHeight: 32 }, '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': { width: 36, height: 36 } } }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default GameShell;
