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

  const nav = (
    <Tabs
      orientation="vertical"
      value={tabs.some((t) => t.id === activeTabId) ? activeTabId : false}
      onChange={(_, value) => { onSelectTab(value); setDrawerOpen(false); }}
      aria-label="Story Graph-navigasjon"
      data-testid="narrative-sidebar-nav"
      TabIndicatorProps={{ sx: { left: 0, width: 3, bgcolor: narrativeColors.accent, borderRadius: 1.5 } }}
      sx={{
        '& .MuiTabs-flexContainer': { gap: 0 },
        '& .MuiTab-root': {
          textTransform: 'none', fontWeight: 600, color: narrativeColors.textDim, minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.84rem',
          justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row', gap: 1.25, borderRadius: 1.5, mx: 1,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: narrativeColors.text },
        },
        '& .Mui-selected': { color: '#fff', bgcolor: narrativeColors.accentSoft },
      }}
    >
      {sections.flatMap((section, si) => [
        <Typography
          key={`section-${section.feature}`}
          component="div"
          sx={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700, px: 2.5, pt: si === 0 ? 1 : 2, pb: 0.5 }}
          data-testid={`narrative-sidebar-section-${section.feature}`}
        >
          {GAME_SECTION_LABELS[section.feature ?? 'core']}
        </Typography>,
        ...section.tabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            icon={gameTabIcon(tab.id) ?? undefined}
            iconPosition="start"
            label={labels[tab.labelToken] ?? tab.id}
            data-testid={`narrative-tab-${tab.id}`}
            sx={{ '& .MuiTab-iconWrapper': { mb: 0, mr: 0 } }}
          />
        )),
      ])}
    </Tabs>
  );

  const sidebarInner = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: narrativeColors.bgPanel, borderRight: `1px solid ${narrativeColors.borderStrong}` }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>Story Graph</Typography>
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
            sx={{ width: '100%', justifyContent: 'flex-start', color: narrativeColors.textDim, bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${narrativeColors.borderStrong}`, '& .MuiChip-label': { fontSize: 12 } }}
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
            <Tooltip title="Meny">
              <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: narrativeColors.textDim }} aria-label="Åpne meny" data-testid="narrative-shell-menu">
                <MenuIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          {header}
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center">{headerActions}</Stack>
        </Box>
        <Box role="tabpanel" sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default GameShell;
