/**
 * DanceAnnotateLayout — dedikert shell for DanceAnnotate-flaten matching
 * mockup #2 pixel-perfect.
 *
 * Distinct fra DanceFlowShell (som brukes for Formation-flaten):
 *   - Egen "DanceAnnotate"-branding i top-bar (ikke "DanceFlow")
 *   - Simplifisert venstre-nav: Dashboard / CLIPS / Annotations / Statistics
 *     / Dancers / Settings / Help (6 items, ikke 25 som NavRail)
 *   - Save (outline) + Export (filled lavender) + avatar i top-right
 *   - "Project: <name> ▼" som dropdown-trigger i top-center
 *
 * Layout (md+):
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ ⌃ DanceAnnotate  │ Project: X ▼  │   Save │ Export │ avatar    │
 *   ├──────────────┬──────────────────────────────────────────────────┤
 *   │ Dashboard    │                                                  │
 *   │              │                                                  │
 *   │ CLIPS        │      <children = DanceAnnotateView>             │
 *   │  + New Clip  │                                                  │
 *   │  search      │                                                  │
 *   │  clip cards  │                                                  │
 *   │              │                                                  │
 *   │ Annotations  │                                                  │
 *   │ Statistics   │                                                  │
 *   │ Dancers      │                                                  │
 *   │ Settings     │                                                  │
 *   │              │                                                  │
 *   │ Help         │                                                  │
 *   └──────────────┴──────────────────────────────────────────────────┘
 *
 * På mobile/tablet (< md): top-bar + main, sidebar kollapser (TODO drawer).
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import {
  Dashboard as DashboardIcon,
  Comment as AnnotationsIcon,
  BarChart as StatisticsIcon,
  Group as DancersIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpIcon,
  KeyboardArrowDown as ChevronDownIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';

import ClipsSidebar from './ClipsSidebar';
import { danceFlowColors } from './danceFlowTheme';

export interface DanceAnnotateLayoutProps {
  /** Prosjekt-navn til topp-center 'Project: <name>'. */
  projectName?: string;
  /** Callback ved klikk Save (top-right). */
  onSave?: () => void;
  /** Callback ved klikk Export (top-right lavender). */
  onExport?: () => void;
  /** Bruker-navn + foto for top-right avatar. */
  user?: { name?: string; avatarUrl?: string };
  /** Prosjekt-ID for ClipsSidebar (videresendt). */
  projectId: string | null;
  /** Innhold (typisk DanceAnnotateView). */
  children: React.ReactNode;
  /** Test-id-override. */
  'data-testid'?: string;
}

const NAV_WIDTH = 240;
const TOP_BAR_HEIGHT = 56;
const PURPLE = '#a78bfa';
const PURPLE_DARK = '#7c3aed';

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactElement;
};

const PRIMARY_NAV: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
];

const SECONDARY_NAV: readonly NavItem[] = [
  { id: 'annotations', label: 'Annotations', icon: <AnnotationsIcon sx={{ fontSize: 18 }} /> },
  { id: 'statistics',  label: 'Statistics',  icon: <StatisticsIcon sx={{ fontSize: 18 }} /> },
  { id: 'dancers',     label: 'Dancers',     icon: <DancersIcon sx={{ fontSize: 18 }} /> },
  { id: 'settings',    label: 'Settings',    icon: <SettingsIcon sx={{ fontSize: 18 }} /> },
];

export default function DanceAnnotateLayout({
  projectName = 'Untitled Project',
  onSave,
  onExport,
  user,
  projectId,
  children,
  'data-testid': testId = 'dance-annotate-layout',
}: DanceAnnotateLayoutProps): React.ReactElement {
  const handleNavClick = React.useCallback((id: string): void => {
    if (typeof window === 'undefined') return;
    // Map til eksisterende top-level dance-tabs der mulig.
    const mapping: Record<string, string> = {
      dashboard: 'dashboard',
      dancers: 'students',
      statistics: 'analysis',
      settings: 'admin_settings',
    };
    const tabId = mapping[id];
    if (tabId) {
      window.dispatchEvent(new CustomEvent('dance:set-tab', { detail: { tabId } }));
    }
  }, []);

  const handleHelp = React.useCallback((): void => {
    if (typeof window === 'undefined') return;
    // Gjenbruker eksisterende ?-cheat-sheet (audit I2)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
  }, []);

  const renderNavItem = (item: NavItem): React.ReactElement => (
    <Box
      key={item.id}
      component="button"
      type="button"
      onClick={() => handleNavClick(item.id)}
      data-testid={`${testId}-nav-${item.id}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        width: '100%', px: 1.5, py: 1,
        border: 'none', borderRadius: 1,
        cursor: 'pointer', font: 'inherit',
        bgcolor: 'transparent',
        color: danceFlowColors.textSecondary,
        textAlign: 'left',
        fontSize: 13, fontWeight: 500,
        transition: 'background-color 120ms, color 120ms',
        '&:hover': {
          bgcolor: 'rgba(167,139,250,0.08)',
          color: danceFlowColors.lavender,
        },
        '&:focus-visible': {
          outline: `2px solid ${danceFlowColors.lavender}`,
          outlineOffset: -2,
        },
      }}
    >
      <Box sx={{ display: 'flex', color: danceFlowColors.textMuted }}>
        {item.icon}
      </Box>
      {item.label}
    </Box>
  );

  return (
    <Box
      data-testid={testId}
      sx={{
        height: '100%', minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textPrimary,
      }}
    >
      {/* ─── Top-bar ─── */}
      <Box
        data-testid={`${testId}-top-bar`}
        sx={{
          display: 'flex', alignItems: 'center',
          minHeight: TOP_BAR_HEIGHT,
          px: 2,
          borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
          bgcolor: danceFlowColors.bgBase,
        }}
      >
        {/* Logo "DanceAnnotate" — lavender ring + svart innerring (mockup-paritet) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: NAV_WIDTH - 16 }}>
          <Box
            data-testid={`${testId}-logo`}
            sx={{
              width: 28, height: 28,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${PURPLE}, ${PURPLE_DARK}, ${PURPLE})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `inset 0 0 0 2px ${danceFlowColors.bgBase}`,
              flexShrink: 0,
            }}
          >
            <Box sx={{
              width: 16, height: 16, borderRadius: '50%',
              bgcolor: danceFlowColors.bgBase,
            }} />
          </Box>
          <Typography sx={{
            fontSize: 16, fontWeight: 700, letterSpacing: 0.2,
            color: danceFlowColors.textPrimary,
          }}>
            DanceAnnotate
          </Typography>
        </Box>

        {/* Project: <name> ▼ — sentralt */}
        <Box
          component="button"
          type="button"
          data-testid={`${testId}-project-trigger`}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            border: 'none', bgcolor: 'transparent',
            cursor: 'pointer', font: 'inherit',
            color: danceFlowColors.textSecondary,
            fontSize: 13, fontWeight: 600,
            px: 1, py: 0.5, borderRadius: 1,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.03)',
              color: danceFlowColors.textPrimary,
            },
          }}
          onClick={() => {
            // Stub: full dropdown krever prosjekt-bytte-modal.
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('dance:open-project-switcher'));
            }
          }}
        >
          <Box component="span" sx={{ color: danceFlowColors.textMuted }}>
            Project:
          </Box>
          {projectName}
          <ChevronDownIcon sx={{ fontSize: 16, color: danceFlowColors.textMuted }} />
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Top-right: Save + Export + avatar */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
            onClick={onSave}
            disabled={!onSave}
            data-testid={`${testId}-save`}
            variant="outlined"
            sx={{
              textTransform: 'none',
              color: danceFlowColors.textSecondary,
              borderColor: danceFlowColors.borderStrong,
              fontWeight: 600, fontSize: 12,
              '&:hover': {
                bgcolor: 'rgba(167,139,250,0.08)',
                color: danceFlowColors.lavender,
                borderColor: danceFlowColors.lavender,
              },
            }}
          >
            Save
          </Button>
          <Button
            size="small"
            startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
            onClick={onExport}
            disabled={!onExport}
            data-testid={`${testId}-export`}
            variant="contained"
            sx={{
              textTransform: 'none',
              bgcolor: PURPLE,
              fontWeight: 700, fontSize: 12,
              boxShadow: 'none',
              '&:hover': { bgcolor: PURPLE_DARK, boxShadow: 'none' },
            }}
          >
            Export
          </Button>
          {user ? (
            <Tooltip title={user.name ?? 'Avatar'}>
              <Avatar
                src={user.avatarUrl}
                sx={{
                  width: 32, height: 32,
                  bgcolor: danceFlowColors.bgPanel,
                  fontSize: 12, fontWeight: 700,
                  color: danceFlowColors.lavender,
                  ml: 0.5,
                }}
                data-testid={`${testId}-avatar`}
              >
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'A'}
              </Avatar>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>

      {/* ─── Main: left-nav + content ─── */}
      <Box sx={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        {/* Left nav-rail */}
        <Box
          component="aside"
          data-testid={`${testId}-nav-rail`}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            width: NAV_WIDTH,
            flex: `0 0 ${NAV_WIDTH}px`,
            borderRight: `1px solid ${danceFlowColors.borderStrong}`,
            bgcolor: danceFlowColors.bgBase,
            p: 1, gap: 1.5,
            overflowY: 'auto',
          }}
        >
          <Stack spacing={0.25}>
            {PRIMARY_NAV.map(renderNavItem)}
          </Stack>

          {/* CLIPS — gjenbruker eksisterende ClipsSidebar */}
          <Box
            sx={{
              border: `1px solid ${danceFlowColors.borderStrong}`,
              borderRadius: 1,
              bgcolor: danceFlowColors.bgPanel,
              flex: '1 1 auto', minHeight: 200,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <ClipsSidebar projectId={projectId} />
          </Box>

          <Stack spacing={0.25}>
            {SECONDARY_NAV.map(renderNavItem)}
          </Stack>

          <Box sx={{ flex: '1 1 auto' }} />

          {/* Help nederst */}
          <Box
            component="button"
            type="button"
            onClick={handleHelp}
            data-testid={`${testId}-nav-help`}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              width: '100%', px: 1.5, py: 1,
              border: 'none', borderRadius: 1,
              cursor: 'pointer', font: 'inherit',
              bgcolor: 'transparent',
              color: danceFlowColors.textMuted,
              textAlign: 'left',
              fontSize: 13, fontWeight: 500,
              '&:hover': {
                bgcolor: 'rgba(167,139,250,0.08)',
                color: danceFlowColors.lavender,
              },
            }}
          >
            <HelpIcon sx={{ fontSize: 18 }} />
            Help
          </Box>
        </Box>

        {/* Main content area */}
        <Box
          component="main"
          data-testid={`${testId}-main`}
          sx={{
            flex: '1 1 auto', minWidth: 0,
            overflow: 'auto',
            bgcolor: danceFlowColors.bgBase,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
