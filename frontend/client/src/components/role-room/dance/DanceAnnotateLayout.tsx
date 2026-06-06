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
  Edit as AnnotateIcon,
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

export type DanceAnnotateSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Hvilken sub-flate som vises i main-content-area. */
export type DanceAnnotateActiveView = 'annotate' | 'annotations' | 'statistics' | 'dashboard' | 'dancers' | 'settings';

export interface DanceAnnotateLayoutProps {
  /** Prosjekt-navn til topp-center 'Project: <name>'. */
  projectName?: string;
  /** Callback ved klikk Save (top-right). */
  onSave?: () => void;
  /** Save-status fra child (DanceAnnotateView). Driver Save-knapp-label. */
  saveStatus?: DanceAnnotateSaveStatus;
  /** Sist-lagret-timestamp (ms-epoch). Vises som 'Saved kl 14:32'. */
  lastSavedAt?: number | null;
  /** Save-feilmelding (vises som tooltip på Save-knappen). */
  saveError?: string | null;
  /** Callback ved klikk Export (top-right lavender). */
  onExport?: () => void;
  /** Callback ved klikk på Project-dropdown. Åpner project-switcher. */
  onOpenProjectSwitcher?: () => void;
  /** Bruker-navn + foto for top-right avatar. */
  user?: { name?: string; avatarUrl?: string };
  /** Prosjekt-ID for ClipsSidebar (videresendt). */
  projectId: string | null;
  /** Innhold (typisk DanceAnnotateView). */
  children: React.ReactNode;
  /** Aktiv view — driver hvilken nav-item som er highlighted. */
  activeView?: DanceAnnotateActiveView;
  /** Når satt, kalles ved nav-item-click i stedet for fallback dance:set-tab. */
  onViewChange?: (view: DanceAnnotateActiveView) => void;
  /** Test-id-override. */
  'data-testid'?: string;
}

const NAV_WIDTH = 240;
const TOP_BAR_HEIGHT = 56;
const PURPLE = danceFlowColors.lavender;
const PURPLE_DARK = danceFlowColors.lavenderDeep;

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactElement;
};

const PRIMARY_NAV: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
];
// Mockup-paritet: 'Annotate' er IKKE et nav-item — brukeren navigerer tilbake
// til Annotate-flaten ved å klikke en clip i CLIPS-section. AnnotateIcon
// importen beholdes for fremtidig bruk.

const SECONDARY_NAV: readonly NavItem[] = [
  { id: 'annotations', label: 'Annotations', icon: <AnnotationsIcon sx={{ fontSize: 18 }} /> },
  { id: 'statistics',  label: 'Statistics',  icon: <StatisticsIcon sx={{ fontSize: 18 }} /> },
  { id: 'dancers',     label: 'Dancers',     icon: <DancersIcon sx={{ fontSize: 18 }} /> },
  { id: 'settings',    label: 'Settings',    icon: <SettingsIcon sx={{ fontSize: 18 }} /> },
];

export default function DanceAnnotateLayout({
  projectName = 'Untitled Project',
  onSave,
  saveStatus = 'idle',
  lastSavedAt = null,
  saveError = null,
  onExport,
  onOpenProjectSwitcher,
  user,
  projectId,
  children,
  activeView = 'annotate',
  onViewChange,
  'data-testid': testId = 'dance-annotate-layout',
}: DanceAnnotateLayoutProps): React.ReactElement {
  const handleNavClick = React.useCallback((id: string): void => {
    // Lokal view-bytte for items som har dedikert flate i DanceAnnotateLayout:
    // 'annotations' og 'statistics' (og 'annotate' tilbake til hoved-flaten).
    // Andre items routes til top-level dance-tabs.
    if (onViewChange && (id === 'annotate' || id === 'annotations' || id === 'statistics' || id === 'dashboard' || id === 'dancers' || id === 'settings')) {
      onViewChange(id as DanceAnnotateActiveView);
      return;
    }
    if (typeof window === 'undefined') return;
    const mapping: Record<string, string> = {
      dashboard: 'dashboard',
      dancers: 'students',
      settings: 'admin_settings',
    };
    const tabId = mapping[id];
    if (tabId) {
      window.dispatchEvent(new CustomEvent('dance:set-tab', { detail: { tabId } }));
    }
  }, [onViewChange]);

  const handleHelp = React.useCallback((): void => {
    if (typeof window === 'undefined') return;
    // Gjenbruker eksisterende ?-cheat-sheet (audit I2)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
  }, []);

  const renderNavItem = (item: NavItem): React.ReactElement => {
    const isActive = item.id === activeView;
    return (
      <Box
        key={item.id}
        component="button"
        type="button"
        onClick={() => handleNavClick(item.id)}
        data-testid={`${testId}-nav-${item.id}`}
        aria-current={isActive ? 'page' : undefined}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          width: '100%', px: 1.5, py: 1,
          border: 'none', borderRadius: 1,
          cursor: 'pointer', font: 'inherit',
          bgcolor: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
          color: isActive ? danceFlowColors.lavender : danceFlowColors.textSecondary,
          textAlign: 'left',
          fontSize: 13, fontWeight: isActive ? 700 : 500,
          transition: 'background-color 120ms, color 120ms',
          '&:hover': {
            bgcolor: isActive ? 'rgba(167,139,250,0.16)' : 'rgba(167,139,250,0.08)',
            color: danceFlowColors.lavender,
          },
          '&:focus-visible': {
            outline: `2px solid ${danceFlowColors.lavender}`,
            outlineOffset: -2,
          },
        }}
      >
        <Box sx={{
          display: 'flex',
          color: isActive ? danceFlowColors.lavender : danceFlowColors.textMuted,
        }}>
          {item.icon}
        </Box>
        {item.label}
      </Box>
    );
  };

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
            if (onOpenProjectSwitcher) {
              onOpenProjectSwitcher();
            } else if (typeof window !== 'undefined') {
              // Fallback: dispatch event hvis parent ikke har bundet handler
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
          {/* Save-knapp m/ live status-label:
              idle = 'Save' (default)
              saving = 'Saving…' (lavender)
              saved = '✓ Saved kl HH:MM' (grønn)
              error = '⚠ Save failed' (rød, m/ tooltip) */}
          <Tooltip title={saveStatus === 'error' && saveError ? saveError : ''}>
            <span>
              <Button
                size="small"
                startIcon={
                  saveStatus === 'saving'
                    ? null
                    : <SaveIcon sx={{ fontSize: 16 }} />
                }
                onClick={onSave}
                disabled={!onSave || saveStatus === 'saving'}
                data-testid={`${testId}-save`}
                variant="outlined"
                aria-busy={saveStatus === 'saving'}
                sx={{
                  textTransform: 'none',
                  color: saveStatus === 'saved'
                    ? danceFlowColors.successPrimary
                    : saveStatus === 'error'
                      ? danceFlowColors.errorPrimary
                      : saveStatus === 'saving'
                        ? danceFlowColors.lavender
                        : danceFlowColors.textSecondary,
                  borderColor: saveStatus === 'saved'
                    ? '#34d39955'
                    : saveStatus === 'error'
                      ? '#f8717155'
                      : saveStatus === 'saving'
                        ? danceFlowColors.lavender
                        : danceFlowColors.borderStrong,
                  fontWeight: 600, fontSize: 12,
                  minWidth: 140,
                  fontVariantNumeric: 'tabular-nums',
                  '&:hover': saveStatus === 'idle' ? {
                    bgcolor: 'rgba(167,139,250,0.08)',
                    color: danceFlowColors.lavender,
                    borderColor: danceFlowColors.lavender,
                  } : undefined,
                }}
              >
                {saveStatus === 'saving' ? 'Saving…'
                  : saveStatus === 'saved' && lastSavedAt
                    ? `Saved kl ${new Date(lastSavedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
                    : saveStatus === 'error' ? 'Save failed'
                      : lastSavedAt
                        ? `Saved kl ${new Date(lastSavedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Save'}
              </Button>
            </span>
          </Tooltip>
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
