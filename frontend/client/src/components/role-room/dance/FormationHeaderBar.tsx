/**
 * FormationHeaderBar — DanceFlow header for formations-flaten.
 *
 * Layout (md+):
 *   [ Breadcrumbs | Sub-tabs | Share · Export · Save-pill ]
 *
 * På mobil/tablet (under md) kollapser breadcrumbs til kun siste segment, og
 * sub-tabs blir scrollbare horisontalt. Share + Export samles i én
 * overflow-meny.
 *
 * Sub-tabsene:
 *   - Annotate (placeholder — Phase 6 lager drawer)
 *   - Formation (default — nåværende view)
 *   - Dancers   → dispatcher `dance:set-tab` med tabId='students'
 *   - Analysis  → dispatcher `dance:set-tab` med tabId='analysis'
 *   - Review    → dispatcher `dance:set-tab` med tabId='video'
 *
 * Save-pillen flyttes hit fra FormationViewConnected.tsx (linje 206-236).
 * FormationViewConnected må sette `hideSavePill` så vi ikke får dobbel pill.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import {
  CloudDone as SavedIcon,
  CloudOff as ErrorIcon,
  CloudSync as SavingIcon,
  Share as ShareIcon,
  FileDownload as ExportIcon,
  Image as ImageIcon,
  DataObject as JsonIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';

import PlannerBreadcrumb, {
  type PlannerBreadcrumbSegment,
} from '../components/PlannerBreadcrumb';
import { danceFlowColors, danceFlowSpacing } from './danceFlowTheme';
import {
  requestFormationExport,
  type FormationExportFormat,
} from './formationExport';

export type FormationSubTab =
  | 'annotate'
  | 'formation'
  | 'dancers'
  | 'analysis'
  | 'review';

export type FormationSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SubTabSpec {
  id: FormationSubTab;
  label: string;
  /** Når satt: dispatcher `dance:set-tab` med dette ID-et i stedet for å bytte
   *  lokal sub-tab-state. Brukt for tabs som hører til top-level DanceWorkspace. */
  forwardToTopLevelTab?: string;
}

const SUB_TABS: readonly SubTabSpec[] = [
  { id: 'annotate', label: 'Annotate' },
  { id: 'formation', label: 'Formation' },
  { id: 'dancers', label: 'Dancers', forwardToTopLevelTab: 'students' },
  { id: 'analysis', label: 'Analysis', forwardToTopLevelTab: 'analysis' },
  { id: 'review', label: 'Review', forwardToTopLevelTab: 'video' },
];

export interface FormationHeaderBarProps {
  /** Brødsmuler til venstre. */
  breadcrumbs: PlannerBreadcrumbSegment[];
  /** Aktiv sub-tab (default 'formation'). */
  activeSubTab?: FormationSubTab;
  /** Kallt for lokale sub-tab-skifter (de uten `forwardToTopLevelTab`). */
  onSubTabChange?: (next: FormationSubTab) => void;
  /** Save-pill state. */
  saveStatus?: FormationSaveStatus;
  saveError?: string | null;
  /** Audit A5: sist-lagret-timestamp (ms-epoch). Vises som 'Lagret 14:32'
   *  når saveStatus er idle. */
  lastSavedAt?: number | null;
  /** Share-handler. Når undefined, skjules knappen. */
  onShare?: () => void;
  /** Audit G_2: disable Export-knapp (e.g. på tomt projekt). */
  disableExport?: boolean;
  /** G25/J1: presence-users som vises som avatar-strip ved siden av save-pill. */
  presenceUsers?: ReadonlyArray<{
    userId: string;
    displayName: string;
    color: string;
  }>;
  /** Test-id-override. */
  'data-testid'?: string;
}

export default function FormationHeaderBar({
  breadcrumbs,
  activeSubTab = 'formation',
  onSubTabChange,
  saveStatus = 'idle',
  saveError = null,
  lastSavedAt = null,
  onShare,
  disableExport = false,
  presenceUsers,
  'data-testid': testId = 'formation-header-bar',
}: FormationHeaderBarProps): React.ReactElement {
  const [exportAnchor, setExportAnchor] = React.useState<HTMLElement | null>(null);

  const handleSubTabChange = React.useCallback(
    (_e: React.SyntheticEvent, next: FormationSubTab) => {
      const spec = SUB_TABS.find((t) => t.id === next);
      if (spec?.forwardToTopLevelTab) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('dance:set-tab', {
              detail: { tabId: spec.forwardToTopLevelTab },
            }),
          );
        }
        // Forward gjorde sin egen tab-bytte; ikke endre lokal state.
        return;
      }
      onSubTabChange?.(next);
    },
    [onSubTabChange],
  );

  const handleExport = React.useCallback((format: FormationExportFormat): void => {
    setExportAnchor(null);
    requestFormationExport(format);
  }, []);

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        gap: { xs: 0.5, md: 1 },
        px: { xs: 1, md: 1.5 },
        py: 0.5,
        minHeight: { md: danceFlowSpacing.headerHeight },
        bgcolor: danceFlowColors.bgPanel,
      }}
    >
      {/* Left: breadcrumbs */}
      <Box sx={{ flex: { md: '0 1 auto' }, minWidth: 0, overflow: 'hidden' }}>
        <PlannerBreadcrumb segments={breadcrumbs} />
      </Box>

      {/* Center: sub-tabs */}
      <Box
        sx={{
          flex: '1 1 auto',
          display: 'flex',
          justifyContent: { xs: 'flex-start', md: 'center' },
          minWidth: 0,
        }}
      >
        <Tabs
          value={activeSubTab}
          onChange={handleSubTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Formasjons-undermenyer"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              minWidth: 88,
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: danceFlowColors.textMuted,
              px: 1.5,
              py: 0.5,
            },
            '& .Mui-selected': {
              color: `${danceFlowColors.lavender} !important`,
              fontWeight: 600,
            },
            '& .MuiTabs-indicator': {
              backgroundColor: danceFlowColors.lavender,
              height: 2,
            },
          }}
        >
          {SUB_TABS.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={tab.label}
              data-testid={`${testId}-tab-${tab.id}`}
            />
          ))}
        </Tabs>
      </Box>

      {/* Right: actions + save-pill */}
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ flex: { md: '0 0 auto' }, justifyContent: 'flex-end' }}
      >
        {/* Audit E1: engelsk header-tekst matcher mockup-spec
            (Annotate/Formation/Dancers/Analysis/Review). Norsk for
            content-tekster (placeholders, helper-text, snackbar). */}
        {onShare ? (
          <Button
            size="small"
            startIcon={<ShareIcon sx={{ fontSize: 16 }} />}
            onClick={onShare}
            data-testid={`${testId}-share`}
            sx={{
              textTransform: 'none',
              color: danceFlowColors.textSecondary,
              borderColor: danceFlowColors.borderStrong,
              minHeight: 30,
              '&:hover': {
                bgcolor: 'rgba(167,139,250,0.08)',
                color: danceFlowColors.lavender,
              },
            }}
            variant="outlined"
          >
            Share
          </Button>
        ) : null}

        <Button
          size="small"
          startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
          onClick={(e) => setExportAnchor(e.currentTarget)}
          data-testid={`${testId}-export`}
          aria-haspopup="menu"
          aria-expanded={exportAnchor ? 'true' : 'false'}
          disabled={disableExport}
          title={disableExport ? 'Legg til en formasjon før du eksporterer' : undefined}
          sx={{
            textTransform: 'none',
            color: danceFlowColors.textSecondary,
            borderColor: danceFlowColors.borderStrong,
            minHeight: 30,
            '&:hover': {
              bgcolor: 'rgba(167,139,250,0.08)',
              color: danceFlowColors.lavender,
            },
            '&.Mui-disabled': {
              color: danceFlowColors.textDisabled,
              borderColor: danceFlowColors.borderSoft,
            },
          }}
          variant="outlined"
        >
          Export
        </Button>
        <Menu
          anchorEl={exportAnchor}
          open={Boolean(exportAnchor)}
          onClose={() => setExportAnchor(null)}
          data-testid={`${testId}-export-menu`}
        >
          <MenuItem onClick={() => handleExport('png')} data-testid={`${testId}-export-png`}>
            <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="PNG (snapshot)" secondary="Scene som bilde" />
          </MenuItem>
          <MenuItem onClick={() => handleExport('json')} data-testid={`${testId}-export-json`}>
            <ListItemIcon><JsonIcon fontSize="small" /></ListItemIcon>
            {/* Workflow-audit G22: brukervennlig label i stedet for teknisk "JSON" */}
            <ListItemText primary="Backup-fil" secondary="For å re-importere eller dele med en annen DanceFlow-bruker" />
          </MenuItem>
          <MenuItem
            onClick={() => handleExport('pdf')}
            data-testid={`${testId}-export-pdf`}
          >
            <ListItemIcon><PdfIcon fontSize="small" /></ListItemIcon>
            {/* Workflow-audit G21: enabled — åpner print-overlay m/ stage-plot
                for alle formasjoner. Bruker browser's print-to-PDF. */}
            <ListItemText primary="Stage plot (PDF)" secondary="Print eller lagre — én side per formasjon" />
          </MenuItem>
        </Menu>

        {/* G25/J1: presence-strip — viser hvem andre som er tilkoblet i
            samme prosjekt. Hver avatar = en farget sirkel med initialer +
            tooltip på hover. Max 5 vises; resten samles i '+N'-chip. */}
        {presenceUsers && presenceUsers.length > 0 ? (
          <Box
            data-testid={`${testId}-presence`}
            sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}
          >
            {presenceUsers.slice(0, 5).map((u) => (
              <Box
                key={u.userId}
                title={`${u.displayName} ser denne flaten nå`}
                data-testid={`${testId}-presence-${u.userId}`}
                sx={{
                  width: 22, height: 22, borderRadius: '50%',
                  bgcolor: u.color, color: '#0a0a0a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700,
                  border: `2px solid ${danceFlowColors.bgPanel}`,
                  marginLeft: '-6px',
                }}
              >
                {u.displayName.slice(0, 2).toUpperCase()}
              </Box>
            ))}
            {presenceUsers.length > 5 ? (
              <Box sx={{
                ml: 0.5, fontSize: 10, fontWeight: 600,
                color: danceFlowColors.textMuted,
              }}>
                +{presenceUsers.length - 5}
              </Box>
            ) : null}
          </Box>
        ) : null}

        {/* Save-pill (flyttet hit fra FormationViewConnected).
            Audit A5: 'idle' viser persistent 'Lagret kl HH:MM' når
            lastSavedAt finnes, i stedet for tom plass. */}
        <Box sx={{ minWidth: 120, display: 'flex', justifyContent: 'flex-end' }}>
          {saveStatus === 'idle' && lastSavedAt ? (
            <Typography
              variant="caption"
              data-testid={`${testId}-last-saved`}
              sx={{
                fontSize: '0.6875rem',
                color: danceFlowColors.textDisabled,
                fontVariantNumeric: 'tabular-nums',
              }}
              title={new Date(lastSavedAt).toLocaleString('nb-NO')}
            >
              Lagret kl {new Date(lastSavedAt).toLocaleTimeString('nb-NO', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Typography>
          ) : null}
          {saveStatus === 'saving' ? (
            <Chip
              icon={<SavingIcon sx={{ fontSize: 16 }} />}
              label="Lagrer…"
              size="small"
              data-testid={`${testId}-save-pill`}
              sx={{
                bgcolor: 'rgba(167,139,250,0.18)',
                color: danceFlowColors.lavender,
                fontWeight: 600,
              }}
            />
          ) : null}
          {saveStatus === 'saved' ? (
            <Chip
              icon={<SavedIcon sx={{ fontSize: 16 }} />}
              label="Lagret"
              size="small"
              data-testid={`${testId}-save-pill`}
              sx={{
                bgcolor: 'rgba(16,185,129,0.18)',
                color: danceFlowColors.successDark,
                fontWeight: 600,
              }}
            />
          ) : null}
          {saveStatus === 'error' ? (
            <Chip
              icon={<ErrorIcon sx={{ fontSize: 16 }} />}
              label={saveError ?? 'Lagring feilet'}
              size="small"
              data-testid={`${testId}-save-pill`}
              sx={{
                bgcolor: 'rgba(248,113,113,0.18)',
                color: danceFlowColors.errorPrimary,
                fontWeight: 600,
              }}
            />
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}
