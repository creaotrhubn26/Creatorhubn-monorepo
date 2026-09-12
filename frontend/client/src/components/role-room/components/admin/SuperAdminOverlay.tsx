// SuperAdminOverlay.tsx
// ─────────────────────────────────────────────────────────────────────────
// Alltid-tilgjengelig Super Admin-shell for daniel@creatorhubn.com.
//
// Hvorfor finnes denne?
//
// Admin Room var tidligere gjemt som subtab i RoleRoomDashboardPanel —
// kun synlig når et prosjekt var åpent OG email-gaten holdt. I praksis:
//
//   - localStorage `creatorhub_auth_user.email` var ofte tom etter Google-
//     OAuth-redirect → email-gate feilet → Admin Room-subtab usynlig.
//   - Auto-restore av sist åpnet prosjekt (Holy Crust etc.) brakte Daniel
//     inn i project-room — Admin Room-subtab er innenfor projekt-shellen,
//     så det å «komme seg ut» krevde flere klikk.
//
// Denne overlayen mountes på toppen av Role Room-shellen og bypasser begge
// problemene:
//
//   1) Egen email-sjekk med både localStorage- og /api/auth/user-fallback
//      (samme mønster som PR #517 introduserte for AdminRoom-siden selv).
//   2) Render-uavhengig av selectedProjectId — vises selv når et prosjekt
//      er åpent. Action-knappene kan også lukke prosjektet.
//   3) URL-trigger: `?super=1` eller `/super-admin` åpner overlayen
//      automatisk, så Daniel kan dyplenke uten å manuelt finne knappen.
//
// Komponenten kjenner IKKE AdminRoom-tab-state direkte. Den setter en
// sessionStorage-flagg (superAdminTargetAdminTab) som AdminRoom-shellen
// leser ved mount for å hoppe rett til ønsket subtab.
// ─────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CampaignIcon from '@mui/icons-material/Campaign';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PaymentsIcon from '@mui/icons-material/Payments';
import ChairIcon from '@mui/icons-material/Chair';
import GroupsIcon from '@mui/icons-material/Groups';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import HistoryIcon from '@mui/icons-material/History';
import ArticleIcon from '@mui/icons-material/Article';
import EmailIcon from '@mui/icons-material/Email';
import StorageIcon from '@mui/icons-material/Storage';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import settingsService from '../../services/settingsService';
import { useSuperAdminGate, SUPER_ADMIN_OWNER_EMAIL } from './useSuperAdminGate';

// ─────────────────────────────────────────────────────────────────────────
// Konstanter for handoff til AdminRoom.tsx — keys er stabile slik at
// AdminRoom kan lese dem uten dynamic-import.
// ─────────────────────────────────────────────────────────────────────────
export const SUPER_ADMIN_TARGET_TAB_KEY = 'superAdmin:targetAdminRoomTab';
export const SUPER_ADMIN_OPEN_FROM_URL_KEY = 'superAdmin:openedFromUrl';

// ─────────────────────────────────────────────────────────────────────────
// AdminRoom-subtabs som vi tilbyr fra Super Admin-gridet. Speiler verdiene
// definert som `AdminRoomTab`-union i pages/AdminRoom.tsx. Subset valgt for
// hverdagsbruk; resten av tab'ene er fortsatt tilgjengelig inni AdminRoom.
// ─────────────────────────────────────────────────────────────────────────
interface AdminTabEntry {
  /** Verdi som matcher `AdminRoomTab` i pages/AdminRoom.tsx. */
  value: string;
  label: string;
  Icon: React.ComponentType<{ fontSize?: 'small' | 'medium' | 'large' }>;
  description: string;
}

const ADMIN_TABS: AdminTabEntry[] = [
  { value: 'dashboard', label: 'Oversikt', Icon: DashboardIcon, description: 'Daniels dashboard — KPI, varsler.' },
  { value: 'marketing-cockpit', label: 'Marketing Cockpit', Icon: CampaignIcon, description: 'B2B-pipeline, LinkedIn, leads.' },
  { value: 'content-marketing', label: 'Content marketing', Icon: ArticleIcon, description: 'Pillar-sider og CMS.' },
  { value: 'content-calendar', label: 'Content-kalender', Icon: EventNoteIcon, description: 'Planlegging av publiseringer.' },
  { value: 'role-room-economy', label: 'RR Økonomi', Icon: MoneyIcon, description: 'Inntekter, kunder, MRR.' },
  { value: 'post-agent-seats', label: 'Post Agent Seats', Icon: ChairIcon, description: 'Lisens-/seat-administrasjon.' },
  { value: 'role-room-agent', label: 'Role Room Agent', Icon: SmartToyIcon, description: 'Agent-konfig (beta).' },
  { value: 'industry-crm', label: 'Tier-1 CRM', Icon: GroupsIcon, description: 'Outreach-targets og pipeline.' },
  { value: 'investors', label: 'Investor-pipeline', Icon: PaymentsIcon, description: 'Tickets, intro-status.' },
  { value: 'funding', label: 'Søknader (IN/EU)', Icon: RocketLaunchIcon, description: 'Innovasjon Norge / EU-søknader.' },
  { value: 'newsletter-studio', label: 'Newsletter Studio', Icon: EmailIcon, description: 'Weekly Brief, kampanjer.' },
  { value: 'b2-archive', label: 'B2-arkiv', Icon: StorageIcon, description: 'Backblaze-buckets.' },
  { value: 'whats-new', label: 'Hva er nytt', Icon: HistoryIcon, description: 'Per-modus changelog-CMS.' },
  { value: 'analytics', label: 'Analytics', Icon: AnalyticsIcon, description: 'Trafikk og events.' },
  { value: 'migrations', label: 'Migrasjoner', Icon: StorageIcon, description: 'DB-migrasjoner og status.' },
  { value: 'activity', label: 'Aktivitets-logg', Icon: HistoryIcon, description: 'Audit trail.' },
  { value: 'observability', label: 'Observability', Icon: AnalyticsIcon, description: 'Errors + Clarity-sessions samlet.' },
];

// Localstorage-nøkler for prosjekt-tilstand som vi vil rydde i.
const PROJECT_LAST_WORKSPACE_KEYS = [
  'roleRoom_lastWorkspace',
  'roleRoom_recentProjects',
];

// Settings-namespaces vi tilbyr å rydde via settingsService.
const WORKSPACE_STATE_NAMESPACES = [
  'roleRoom_workspaceState_production_team',
  'roleRoom_workspaceState_content_producer',
  'roleRoom_workspaceState_client_reviewer',
];

const GOLD = '#fbbf24';
const GOLD_DARK = '#b58420';
const BG_DARK = 'rgba(8, 12, 24, 0.96)';
const PANEL_BG = 'rgba(20, 26, 44, 0.85)';

// URL-detektorer
function detectSuperAdminUrlIntent(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = (window.location.pathname || '').toLowerCase();
  if (pathname === '/super-admin' || pathname === '/super-admin/') return true;
  const params = new URLSearchParams(window.location.search || '');
  const flag = params.get('super');
  if (flag === '1' || flag === 'true') return true;
  return false;
}

function clearSuperAdminUrlIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const path = url.pathname.toLowerCase();
    url.searchParams.delete('super');
    if (path === '/super-admin' || path === '/super-admin/') {
      url.pathname = '/';
    }
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Ignore
  }
}

interface SuperAdminOverlayProps {
  /** Forced-open via prop (for testing). Normalt styres open via URL + FAB-klikk. */
  forceOpen?: boolean;
}

export const SuperAdminOverlay: React.FC<SuperAdminOverlayProps> = ({ forceOpen }) => {
  const { isSuperAdmin, email, ready } = useSuperAdminGate();
  const [open, setOpen] = useState<boolean>(false);
  const [busyClearing, setBusyClearing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // URL-intent: åpne automatisk hvis ?super=1 eller /super-admin
  useEffect(() => {
    if (!ready) return;
    if (!isSuperAdmin) return;
    if (forceOpen) {
      setOpen(true);
      return;
    }
    if (detectSuperAdminUrlIntent()) {
      setOpen(true);
      sessionStorage.setItem(SUPER_ADMIN_OPEN_FROM_URL_KEY, '1');
      clearSuperAdminUrlIntent();
    }
  }, [ready, isSuperAdmin, forceOpen]);

  // Globale keyboard-shortcuts:
  //   - Option/Alt + Shift + A (primær — kolliderer ikke med Chrome)
  //   - Backtick `  trippelklikk (raskt 3×) som backup
  // Chrome 132+ stjeler Cmd/Ctrl+Shift+A til "Search tabs", så vi bruker
  // Option+Shift+A på Mac og Alt+Shift+A på Windows i stedet.
  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const handler = (event: KeyboardEvent) => {
      // Alt+Shift+A — primær snarvei
      if (event.altKey && event.shiftKey && (event.key === 'A' || event.key === 'a' || event.code === 'KeyA')) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSuperAdmin]);

  const navigateToAdminTab = useCallback((adminTab: string) => {
    // Lagre target før navigasjon — AdminRoom leser denne ved mount.
    try {
      sessionStorage.setItem(SUPER_ADMIN_TARGET_TAB_KEY, adminTab);
    } catch {
      // Ignore storage failures.
    }

    // 1) Hvis vi allerede er på et host som rendrer AdminRoom direkte
    //    (f.eks. /admin-room eller når URL-hash brukes), behold path.
    //    For Role Room-shellen er det enkleste å navigere til
    //    /admin-room (mountes via egen AdminRoom-mount-point — se
    //    casting-main.tsx). Subtab='admin-room' i RoleRoomDashboardPanel
    //    krever et åpent prosjekt, så vi unngår den ruten.
    const target = `/admin-room?adminTab=${encodeURIComponent(adminTab)}`;
    window.location.href = target;
  }, []);

  const handleCloseProject = useCallback(() => {
    // Rydd lokale "sist åpnet prosjekt"-nøkler.
    try {
      for (const key of PROJECT_LAST_WORKSPACE_KEYS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }

    // Fjern ?project= og ?surface= fra URL slik at auto-restore-logikken i
    // RoleRoomDashboardPanel ikke kicker inn på neste reload.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      url.searchParams.delete('surface');
      url.searchParams.delete('subTab');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Ignore
    }

    setStatusMessage('Prosjekt lukket. Reloader for å gå til dashboard…');
    setTimeout(() => {
      window.location.href = '/';
    }, 600);
  }, []);

  const handleClearWorkspaceState = useCallback(async () => {
    setBusyClearing(true);
    setStatusMessage('Tømmer workspace-state…');
    let cleared = 0;
    for (const namespace of WORKSPACE_STATE_NAMESPACES) {
      try {
        await settingsService.deleteSetting(namespace);
        cleared += 1;
      } catch {
        // Ignore single-namespace failures — fortsett.
      }
    }
    // Rydd også lokale localStorage-speil hvis de finnes.
    try {
      const prefix = 'app_settings_cache:';
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (!key.startsWith(prefix)) continue;
        if (WORKSPACE_STATE_NAMESPACES.some((ns) => key.endsWith(`:${ns}`) || key.includes(`:${ns}`))) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore
    }
    setBusyClearing(false);
    setStatusMessage(`Tømt ${cleared} av ${WORKSPACE_STATE_NAMESPACES.length} workspace-namespaces.`);
  }, []);

  // ALDRI rendre noe synlig hvis ikke admin — selv ikke FAB-en.
  if (!ready || !isSuperAdmin) {
    return null;
  }

  return (
    <>
      <SuperAdminFAB onOpen={() => setOpen(true)} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: BG_DARK,
            backgroundImage: `linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(251,191,36,0) 60%)`,
            border: `1px solid ${GOLD_DARK}`,
            color: 'rgba(255,255,255,0.92)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <AdminPanelSettingsIcon sx={{ color: GOLD, fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  Super Admin
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>
                  Alltid-tilgjengelig kontroll for produkteier.
                </Typography>
              </Box>
            </Stack>
            <IconButton
              onClick={() => setOpen(false)}
              sx={{ color: 'rgba(255,255,255,0.62)' }}
              aria-label="Lukk Super Admin"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: 'rgba(251,191,36,0.18)' }}>
          {/* Tydelig admin-badge */}
          <Box sx={{ mb: 2 }}>
            <Chip
              icon={<AdminPanelSettingsIcon style={{ color: '#1a1407' }} />}
              label={`SUPER ADMIN — ${email || SUPER_ADMIN_OWNER_EMAIL}`}
              sx={{
                bgcolor: GOLD,
                color: '#1a1407',
                fontWeight: 800,
                letterSpacing: 0.4,
                fontSize: '0.78rem',
                px: 1.5,
                height: 32,
              }}
            />
          </Box>

          {statusMessage && (
            <Box
              sx={{
                mb: 2,
                p: 1.2,
                borderRadius: 1,
                bgcolor: 'rgba(251,191,36,0.10)',
                border: '1px solid rgba(251,191,36,0.30)',
                fontSize: '0.85rem',
                color: GOLD,
              }}
            >
              {statusMessage}
            </Box>
          )}

          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.72)', mb: 1 }}>
            Admin Room-faner
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1.2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
            }}
          >
            {ADMIN_TABS.map(({ value, label, Icon, description }) => (
              <Tooltip key={value} title={description} arrow placement="top">
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigateToAdminTab(value)}
                  startIcon={<Icon fontSize="small" />}
                  endIcon={<OpenInNewIcon fontSize="small" sx={{ opacity: 0.6 }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 1.5,
                    py: 1.2,
                    borderColor: 'rgba(251,191,36,0.30)',
                    color: 'rgba(255,255,255,0.92)',
                    bgcolor: PANEL_BG,
                    '&:hover': {
                      borderColor: GOLD,
                      bgcolor: 'rgba(251,191,36,0.10)',
                    },
                    textTransform: 'none',
                  }}
                >
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.52)',
                        fontSize: '0.68rem',
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {description}
                    </Typography>
                  </Box>
                </Button>
              </Tooltip>
            ))}
          </Box>

          <Divider sx={{ my: 2.5, borderColor: 'rgba(251,191,36,0.18)' }} />

          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.72)', mb: 1 }}>
            Hurtig-handlinger
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <Button
              variant="contained"
              startIcon={<ExitToAppIcon />}
              onClick={handleCloseProject}
              sx={{
                bgcolor: 'rgba(56, 64, 88, 0.9)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(76, 84, 108, 0.9)' },
                textTransform: 'none',
                flex: 1,
              }}
            >
              Lukk prosjekt og gå til dashboard
            </Button>
            <Button
              variant="contained"
              startIcon={<CleaningServicesIcon />}
              onClick={() => void handleClearWorkspaceState()}
              disabled={busyClearing}
              sx={{
                bgcolor: 'rgba(180, 36, 36, 0.85)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(214, 48, 48, 0.95)' },
                textTransform: 'none',
                flex: 1,
              }}
            >
              {busyClearing ? 'Tømmer…' : 'Tøm workspace state (alle moduser)'}
            </Button>
          </Stack>

          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 2, color: 'rgba(255,255,255,0.40)', fontSize: '0.68rem' }}
          >
            Tips: Alt + Shift + A åpner/lukker. URL <code>?super=1</code> eller <code>/super-admin</code> åpner overlayen direkte.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Floating action button — gull, alltid-synlig, plassert nederst-venstre
// for ikke å kollidere med eksisterende help-knapp (?-knappen nederst-
// høyre i RoleRoomUXLayer).
// ─────────────────────────────────────────────────────────────────────────
interface SuperAdminFABProps {
  onOpen: () => void;
}

const SuperAdminFAB: React.FC<SuperAdminFABProps> = ({ onOpen }) => {
  return (
    <Tooltip title="Super Admin (Cmd+Shift+A)" placement="right" arrow>
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: (theme) => theme.zIndex.tooltip + 10,
          pointerEvents: 'auto',
        }}
      >
        <Button
          onClick={onOpen}
          variant="contained"
          startIcon={<AdminPanelSettingsIcon />}
          sx={{
            bgcolor: GOLD,
            color: '#1a1407',
            fontWeight: 800,
            letterSpacing: 0.4,
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            boxShadow: '0 6px 18px rgba(251,191,36,0.42)',
            '&:hover': { bgcolor: '#fcc94f' },
            px: 1.6,
            py: 0.8,
            borderRadius: 999,
          }}
        >
          Super Admin
        </Button>
      </Box>
    </Tooltip>
  );
};

export default SuperAdminOverlay;
