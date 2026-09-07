/**
 * AdminWorkspace — Notion+Slack-aktig intern arbeidsflate for daniel@creatorhubn.com.
 *
 * Parallell rute til /admin-room (som beholdes som det er). Mountet på
 * /admin-workspace. Layout:
 *
 *   Sidebar (240px, Cmd+B → 56px)  │  Hovedinnhold  │  Teamchat (320)  │  Varsler/Agenda (280)
 *
 * Innholdet i hovedflaten skiftes basert på valgt sidebar-item. Vi mounter
 * eksisterende tab-komponenter fra AdminRoom og /components/admin/* der det
 * finnes. For seksjoner som ikke har et eksisterende ekvivalent (Saker,
 * Automatiseringer m.fl.) vises en pen tom-stand-skjerm.
 *
 * Auth: samme email-gating som AdminRoom (kun produkteier).
 */

import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputBase,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { BRAND } from './admin-workspace/brand';
import {
  WORKSPACE_ITEMS,
  getWorkspaceItem,
  readViewFromUrl,
  parseWorkspaceLink,
  type WorkspaceItemId,
  type WorkspaceLinkTarget,
} from './admin-workspace/workspaceItems';
import CommandPalette from './admin-workspace/CommandPalette';
import { resolvePanel, type ResolvedPanel } from './admin-workspace/panels';
import MobileNavDrawer from './admin-workspace/MobileNavDrawer';
import { buildNavSections, type NavItem, type NavSection } from './admin-workspace/navSections';
import { readStoredWorkspacePrefs, type WorkspacePrefs } from './admin-workspace/prefs';

// Teamchat-kolonnen er skjult som default — last den først når den åpnes.
const TeamchatTab = lazy(() => import('./admin-workspace/TeamchatTab'));
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import SsidChartOutlinedIcon from '@mui/icons-material/SsidChartOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';

import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

import {
  activityLogApi,
  type ActivityLogEntry,
  type DeadlineItem,
  type WorkspaceNotification,
  type WorkspaceProductScope,
  DEADLINE_SOURCE_LABEL,
} from '../services/adminRoomApi';
import {
  queryError,
  useMarkNotificationSeen,
  useTodayAgenda,
  useUpcomingDeadlines,
  useWorkspaceNotifications,
} from './admin-workspace/useWorkspaceData';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';

// ─────────────────────────────────────────────────────────
// Konstanter
// ─────────────────────────────────────────────────────────

const ADMIN_ROOM_OWNER_EMAIL = 'daniel@creatorhubn.com';

// Multi-produkt: tomatisk vist i topp-bar og brukt som URL-state slik at
// produkt-spesifikke flater kan filtrere senere. Vi mounter samme komponent
// i alle tilfeller i dag — flateringen er klargjort for når Forretningsplan
// + Outreach faktisk tar imot et produkt-filter.
const ADMIN_PRODUCTS = [
  { id: 'roleroom', label: 'The Role Room', color: '#a78bfa' },
  { id: 'leadgrid', label: 'Leadgrid', color: '#22d3ee' },
] as const;
type AdminProductId = (typeof ADMIN_PRODUCTS)[number]['id'];

// Branding: delt palett i ./admin-workspace/brand.ts

// Lokal mørk MUI-theme i BRAND-paletten: paneler som bruker MUI-defaults
// (Card/Paper/action.hover/text.secondary/ikoner) følger workspace-designet
// automatisk i stedet for å falle tilbake til lys standard-theme.
const workspaceTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: BRAND.accent },
    secondary: { main: BRAND.accentStrong },
    background: { default: '#0b0518', paper: '#1a0a2e' },
    text: { primary: BRAND.text, secondary: BRAND.textMuted },
    divider: BRAND.border,
    success: { main: '#22c55e' },
    warning: { main: '#fbbf24' },
    error: { main: '#fda4af' },
    info: { main: '#22d3ee' },
  },
});

// ─────────────────────────────────────────────────────────
// Sidebar-struktur
// ─────────────────────────────────────────────────────────

// NavItem/NavSection og selve nav-strukturen bor i ./admin-workspace/navSections.tsx,
// slik at sidebaren og mobil-drawer-en ikke kan komme i utakt.

// ─────────────────────────────────────────────────────────
// Varsler
//
// Lå tidligere som en håndrullet fetch her, med to feil som gjorde
// innboksen permanent tom OG stille:
//   1. Den leste `data.items`, mens /api/notifications/inbox svarer med
//      { notifications: [...] } — så listen ble alltid tom, også når
//      backend hadde data.
//   2. Den returnerte [] ved både !r.ok og throw, så «backend nede» så
//      nøyaktig ut som «ingen varsler».
// Nå går alt gjennom workspaceNotificationsApi, som normaliserer
// konvolutten ett sted og KASTER ved feil.
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// Auth helper (samme mønster som AdminRoom)
// ─────────────────────────────────────────────────────────

function getCurrentUserEmail(): string {
  try {
    const userObjRaw =
      localStorage.getItem('creatorhub_auth_user') ||
      localStorage.getItem('user') ||
      localStorage.getItem('creatorhub_user');
    if (userObjRaw) {
      const parsed = JSON.parse(userObjRaw) as { email?: string };
      if (typeof parsed?.email === 'string' && parsed.email) {
        return parsed.email.toLowerCase();
      }
    }
    const directEmail = localStorage.getItem('userEmail');
    if (typeof directEmail === 'string' && directEmail.includes('@')) {
      return directEmail.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return '';
}

// ─────────────────────────────────────────────────────────
// Hovedinnhold-tabs (Notion-style undertabs på hver flate)
// ─────────────────────────────────────────────────────────

interface ContentTabsProps {
  tabs: string[];
  active: number;
  onChange: (next: number) => void;
}

function ContentTabs({ tabs, active, onChange }: ContentTabsProps) {
  return (
    <Tabs
      value={active}
      onChange={(_e, next: number) => onChange(next)}
      variant="scrollable"
      allowScrollButtonsMobile
      sx={{
        minHeight: 36,
        borderBottom: `1px solid ${BRAND.border}`,
        '& .MuiTab-root': {
          minHeight: 36,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.84rem',
          color: BRAND.textMuted,
          px: 1.5,
        },
        '& .Mui-selected': { color: BRAND.text },
        '& .MuiTabs-indicator': {
          backgroundColor: BRAND.accent,
          height: 2,
        },
      }}
    >
      {tabs.map((t) => (
        <Tab key={t} label={t} />
      ))}
    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selected: WorkspaceItemId;
  onSelect: (id: WorkspaceItemId) => void;
  inboxBadge: number;
  product: AdminProductId;
  onProductChange: (p: AdminProductId) => void;
}

function Sidebar({
  collapsed,
  onToggleCollapse,
  selected,
  onSelect,
  inboxBadge,
  product,
  onProductChange,
}: SidebarProps) {
  // Sidebaren er organisert rundt arbeidet, ikke rundt planen. Tidligere
  // lå 7 av 10 hoved-oppføringer som tomme TODO-skjermer side om side med
  // de ekte modulene, mens de faktisk fungerende verktøyene bare var
  // nåbare via kort-rutenettet på Oversikt. Nå er alle flatene bygget, og
  // grupperingen følger hva du holder på med: daglig arbeid øverst, drift
  // under, så de fagvise teamspacene.
  const sections: NavSection[] = useMemo(() => buildNavSections(inboxBadge), [inboxBadge]);

  const width = collapsed ? 56 : 240;

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        bgcolor: BRAND.sidebarBg,
        borderRight: `1px solid ${BRAND.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 180ms ease',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Org-velger + collapse */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: collapsed ? 1 : 2,
          py: 1.5,
          borderBottom: `1px solid ${BRAND.border}`,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: BRAND.accentStrong,
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          C
        </Avatar>
        {!collapsed ? (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: BRAND.text,
                fontWeight: 700,
                fontSize: '0.86rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Creatorhub AS
            </Typography>
            <Typography
              sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}
            >
              Admin workspace
            </Typography>
          </Box>
        ) : null}
        {!collapsed ? (
          <IconButton
            size="small"
            onClick={onToggleCollapse}
            sx={{ color: BRAND.textMuted }}
            aria-label="Skjul sidebar"
          >
            <MenuOpenIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Stack>

      {/* Produkt-velger */}
      {!collapsed ? (
        <Stack spacing={0.5} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.border}` }}>
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Produkt
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {ADMIN_PRODUCTS.map((p) => {
              const isActive = p.id === product;
              return (
                <Button
                  key={p.id}
                  size="small"
                  onClick={() => onProductChange(p.id)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    color: isActive ? '#fff' : BRAND.textMuted,
                    bgcolor: isActive ? p.color : 'transparent',
                    border: `1px solid ${isActive ? p.color : BRAND.border}`,
                    borderRadius: 1.5,
                    '&:hover': {
                      bgcolor: isActive ? p.color : BRAND.hoverBg,
                      borderColor: p.color,
                    },
                  }}
                >
                  {p.label}
                </Button>
              );
            })}
          </Stack>
        </Stack>
      ) : (
        // Collapsed: vis bare collapse-toggle nederst, og en liten dot
        <Stack alignItems="center" sx={{ py: 1 }}>
          <IconButton
            size="small"
            onClick={onToggleCollapse}
            sx={{ color: BRAND.textMuted }}
            aria-label="Vis sidebar"
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      {/* Nav-seksjoner */}
      <Box component="nav" aria-label="Workspace-navigasjon" sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {sections.map((section) => (
          <Box key={section.id} sx={{ mb: 1.5 }}>
            {!collapsed && section.label ? (
              <Typography
                sx={{
                  color: BRAND.textDim,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  px: 2,
                  py: 0.5,
                }}
              >
                {section.label}
              </Typography>
            ) : null}
            {section.items.map((item) => {
              const isSelected = item.id === selected;
              return (
                <Tooltip
                  key={item.id}
                  title={collapsed ? item.label : ''}
                  placement="right"
                  arrow
                >
                  {/* component="button": navigasjonen var klikkbare div-er,
                      altså umulig å nå med tastatur. aria-current gir
                      skjermlesere hvilken flate som er åpen. */}
                  <Stack
                    component="button"
                    type="button"
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    onClick={() => onSelect(item.id)}
                    aria-current={isSelected ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    sx={{
                      cursor: 'pointer',
                      width: collapsed ? 'calc(100% - 8px)' : 'calc(100% - 16px)',
                      font: 'inherit',
                      textAlign: 'left',
                      border: 'none',
                      borderLeft: isSelected
                        ? `3px solid ${BRAND.accent}`
                        : '3px solid transparent',
                      px: collapsed ? 1.5 : 1.5,
                      mx: collapsed ? 0.5 : 1,
                      py: 0.75,
                      borderRadius: 1.5,
                      color: isSelected ? BRAND.text : BRAND.textMuted,
                      bgcolor: isSelected ? BRAND.selectedBg : 'transparent',
                      transition: 'background-color 120ms ease',
                      '&:hover': {
                        bgcolor: isSelected ? BRAND.selectedBg : BRAND.hoverBg,
                        color: BRAND.text,
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${BRAND.accent}`,
                        outlineOffset: -2,
                      },
                      '& svg': { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                    {!collapsed ? (
                      <>
                        <Typography
                          sx={{
                            flex: 1,
                            fontSize: '0.86rem',
                            fontWeight: isSelected ? 700 : 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.label}
                        </Typography>
                        {item.badge && item.badge > 0 ? (
                          <Chip
                            label={item.badge > 99 ? '99+' : String(item.badge)}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              bgcolor: BRAND.accentStrong,
                              color: '#fff',
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </Stack>
                </Tooltip>
              );
            })}
          </Box>
        ))}

      </Box>

      {/* Innstillinger nederst */}
      <Box sx={{ borderTop: `1px solid ${BRAND.border}`, py: 0.75 }}>
        <Tooltip title={collapsed ? 'Innstillinger' : ''} placement="right" arrow>
          <Stack
            component="button"
            type="button"
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={() => onSelect('settings')}
            aria-current={selected === 'settings' ? 'page' : undefined}
            aria-label={collapsed ? 'Innstillinger' : undefined}
            sx={{
              cursor: 'pointer',
              width: collapsed ? 'calc(100% - 8px)' : 'calc(100% - 16px)',
              font: 'inherit',
              textAlign: 'left',
              border: 'none',
              px: 1.5,
              mx: collapsed ? 0.5 : 1,
              py: 0.75,
              borderRadius: 1.5,
              color: selected === 'settings' ? BRAND.text : BRAND.textMuted,
              bgcolor: selected === 'settings' ? BRAND.selectedBg : 'transparent',
              '&:hover': { bgcolor: BRAND.hoverBg, color: BRAND.text },
              '&:focus-visible': { outline: `2px solid ${BRAND.accent}`, outlineOffset: -2 },
              '& svg': { fontSize: 20 },
            }}
          >
            <SettingsOutlinedIcon />
            {!collapsed ? (
              <Typography
                sx={{ flex: 1, fontSize: '0.86rem', fontWeight: 500 }}
              >
                Innstillinger
              </Typography>
            ) : null}
          </Stack>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────
// Bottom-nav (mobil)
// ─────────────────────────────────────────────────────────

function MobileBottomNav({
  selected,
  onSelect,
  inboxBadge,
  onOpenMenu,
}: {
  selected: WorkspaceItemId;
  onSelect: (id: WorkspaceItemId) => void;
  inboxBadge: number;
  onOpenMenu: () => void;
}) {
  // «Meny» navigerte tidligere til `settings` — altså en knapp som lovet
  // en meny og ga deg innstillinger, mens resten av navigasjonen ikke
  // fantes på mobil i det hele tatt. Nå åpner den drawer-en.
  const items: NavItem[] = [
    { id: 'overview', label: 'Oversikt', icon: <DashboardOutlinedIcon /> },
    { id: 'inbox', label: 'Innboks', icon: <InboxOutlinedIcon />, badge: inboxBadge },
    { id: 'tasks', label: 'Oppgaver', icon: <TaskAltOutlinedIcon /> },
    { id: 'teamchat', label: 'Chat', icon: <ChatBubbleOutlineOutlinedIcon /> },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: BRAND.sidebarBg,
        borderTop: `1px solid ${BRAND.border}`,
        display: 'flex',
        justifyContent: 'space-around',
        py: 0.75,
        zIndex: 1200,
      }}
    >
      {items.map((item) => {
        const isSelected = item.id === selected;
        return (
          <IconButton
            key={item.id}
            onClick={() => onSelect(item.id)}
            sx={{
              flexDirection: 'column',
              color: isSelected ? BRAND.accent : BRAND.textMuted,
              fontSize: '0.66rem',
              fontWeight: 600,
              borderRadius: 1,
              minWidth: 56,
            }}
          >
            <Badge
              color="secondary"
              badgeContent={item.badge ?? 0}
              max={99}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: BRAND.accentStrong,
                  color: '#fff',
                  fontSize: '0.62rem',
                  height: 14,
                  minWidth: 14,
                },
              }}
            >
              {item.icon}
            </Badge>
            <Typography sx={{ fontSize: '0.62rem', mt: 0.25 }}>
              {item.label}
            </Typography>
          </IconButton>
        );
      })}

      <IconButton
        onClick={onOpenMenu}
        aria-label="Åpne meny"
        sx={{
          flexDirection: 'column',
          color: BRAND.textMuted,
          fontSize: '0.66rem',
          fontWeight: 600,
          borderRadius: 1,
          minWidth: 56,
        }}
      >
        <MenuIcon />
        <Typography sx={{ fontSize: '0.62rem', mt: 0.25 }}>Meny</Typography>
      </IconButton>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────
// Teamchat-panel (høyre kolonne 1)
//
// Var en låst composer med en forklaring på at endepunktet manglet.
// Migrasjon 0350 ga workspacet ekte kanaler, så kolonnen kjører nå
// samme TeamchatTab i kompakt modus — én implementasjon, ikke to som
// kan drive fra hverandre.
// ─────────────────────────────────────────────────────────

function TeamchatPanel({ onClose }: { onClose: () => void }) {
  return (
    <Stack
      sx={{
        width: 320,
        flexShrink: 0,
        bgcolor: BRAND.panelBg,
        borderLeft: `1px solid ${BRAND.border}`,
        height: '100vh',
        position: 'sticky',
        top: 0,
        minHeight: 0,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.border}` }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <ChatBubbleOutlineOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
            Teamchat
          </Typography>
        </Stack>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Skjul teamchat"
          sx={{ color: BRAND.textDim }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Suspense
          fallback={
            <Stack alignItems="center" sx={{ flex: 1, py: 4 }}>
              <CircularProgress size={20} sx={{ color: BRAND.accent }} />
            </Stack>
          }
        >
          <TeamchatTab compact />
        </Suspense>
      </Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Dagens agenda — live fra workspaceAggregatorApi.todayAgenda()
// 60s polling så åpne tabs holder seg friske uten manuell refresh.
// ─────────────────────────────────────────────────────────

function TodayAgendaSection({ product }: { product: WorkspaceProductScope }) {
  // Delt nøkkel med Kalender-flaten: står begge åpne blir det ett kall.
  const query = useTodayAgenda(product);
  const items = query.data ?? [];
  const loading = query.isPending;
  const error = queryError(query.error, 'Kunne ikke laste agenda');

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
        <ScheduleOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
        <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.86rem' }}>
          Dagens agenda
        </Typography>
        {items.length > 0 ? (
          <Chip
            size="small"
            label={items.length}
            sx={{
              height: 18,
              fontSize: '0.66rem',
              fontWeight: 700,
              bgcolor: `${BRAND.accent}22`,
              color: BRAND.accent,
              ml: 'auto',
            }}
          />
        ) : null}
      </Stack>
      {loading ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>Laster…</Typography>
      ) : error ? (
        <Typography sx={{ color: '#fda4af', fontSize: '0.78rem' }}>Kunne ikke laste agenda</Typography>
      ) : items.length === 0 ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
          Ingen møter i dag.
        </Typography>
      ) : (
        <Stack spacing={0.6}>
          {items.map((item) => {
            const startTime = (() => {
              try {
                return new Date(item.starts_at).toLocaleTimeString('nb-NO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: item.time_zone || 'Europe/Oslo',
                });
              } catch {
                return '–';
              }
            })();
            return (
              <Stack
                key={item.id}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  p: 0.75,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(167,139,250,0.04)',
                  border: '1px solid rgba(167,139,250,0.12)',
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.10)' },
                }}
              >
                <Box
                  sx={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: BRAND.accent,
                    minWidth: 38,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {startTime}
                </Box>
                <Typography
                  sx={{
                    color: BRAND.text,
                    fontSize: '0.78rem',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.title}
                >
                  {item.title}
                </Typography>
                {item.meet_link ? (
                  <IconButton
                    size="small"
                    component="a"
                    href={item.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: BRAND.accent, p: 0.25 }}
                    title="Åpne Google Meet"
                  >
                    <OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────
// Kommende frister — aggregat fra funding-apps + cases + meetings
// Kilde-chips fargekoder per type, sortert chronologisk.
// ─────────────────────────────────────────────────────────

const DEADLINE_SOURCE_COLOR: Record<DeadlineItem['source'], string> = {
  funding_app: '#fbbf24', // amber — søknader
  case: '#a78bfa',        // violet — saker (Leadgrid-accent)
  meeting: '#22d3ee',     // cyan — møter
};

function formatDeadlineLabel(due: string): string {
  try {
    const d = new Date(due);
    if (Number.isNaN(d.getTime())) return due;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays === 0) return 'I dag';
    if (diffDays === 1) return 'I morgen';
    if (diffDays > 0 && diffDays < 7) return `Om ${diffDays} dager`;
    return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
  } catch {
    return due;
  }
}

function UpcomingDeadlinesSection({
  product,
  onNavigate,
}: {
  product: WorkspaceProductScope;
  onNavigate: (target: WorkspaceLinkTarget) => void;
}) {
  const query = useUpcomingDeadlines(14, product);
  const items = query.data?.items ?? [];
  const loading = query.isPending;
  const error = queryError(query.error, 'Kunne ikke laste frister');

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
        <EventAvailableOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
        <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.86rem' }}>
          Kommende frister
        </Typography>
        {items.length > 0 ? (
          <Chip
            size="small"
            label={items.length}
            sx={{
              height: 18,
              fontSize: '0.66rem',
              fontWeight: 700,
              bgcolor: `${BRAND.accent}22`,
              color: BRAND.accent,
              ml: 'auto',
            }}
          />
        ) : null}
      </Stack>
      {loading ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>Laster…</Typography>
      ) : error ? (
        <Typography sx={{ color: '#fda4af', fontSize: '0.78rem' }}>Kunne ikke laste frister</Typography>
      ) : items.length === 0 ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
          Ingen frister kommer opp.
        </Typography>
      ) : (
        <Stack spacing={0.6}>
          {items.slice(0, 8).map((item) => {
            const sourceColor = DEADLINE_SOURCE_COLOR[item.source];
            const dueLabel = formatDeadlineLabel(item.due_date);
            const isUrgent = (() => {
              try {
                const diff = (new Date(item.due_date).getTime() - Date.now()) / 86_400_000;
                return diff <= 1;
              } catch { return false; }
            })();
            return (
              <Box
                key={item.id}
                // Ekte knapp når raden er klikkbar, ellers en div — en
                // tom knapp uten handling er verre enn ingen knapp.
                component={item.link_path ? 'button' : 'div'}
                type={item.link_path ? 'button' : undefined}
                sx={{
                  display: 'block',
                  width: '100%',
                  font: 'inherit',
                  textAlign: 'left',
                  p: 0.75,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(167,139,250,0.04)',
                  border: '1px solid rgba(167,139,250,0.12)',
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.10)' },
                  '&:focus-visible': {
                    outline: `2px solid ${BRAND.accent}`,
                    outlineOffset: 2,
                  },
                  cursor: item.link_path ? 'pointer' : 'default',
                }}
                onClick={item.link_path ? () => {
                  // Peker lenken inn i workspacet bytter vi panel i React.
                  // window.location.assign her betød full sidelast av en
                  // tung SPA for å hoppe til en sak i samme flate.
                  const target = parseWorkspaceLink(item.link_path);
                  if (target) {
                    onNavigate(target);
                    return;
                  }
                  if (typeof window !== 'undefined' && item.link_path) {
                    window.location.assign(item.link_path);
                  }
                } : undefined}
              >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: sourceColor,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      color: BRAND.text,
                      fontSize: '0.78rem',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.title}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      color: isUrgent ? '#fda4af' : BRAND.accent,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dueLabel}
                  </Typography>
                </Stack>
                <Typography sx={{ color: BRAND.textDim, fontSize: '0.66rem', pl: 1.5 }}>
                  {DEADLINE_SOURCE_LABEL[item.source]}
                  {item.product_key ? ` · ${item.product_key === 'leadgrid' ? 'Leadgrid' : 'Role Room'}` : ''}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────
// Varsler / Agenda-panel (høyre kolonne 2)
// ─────────────────────────────────────────────────────────

function NotificationsAgendaPanel({
  notifications,
  notificationsLoading,
  notificationsError,
  product,
  onNavigate,
}: {
  notifications: WorkspaceNotification[];
  notificationsLoading: boolean;
  notificationsError: string | null;
  product: WorkspaceProductScope;
  onNavigate: (target: WorkspaceLinkTarget) => void;
}) {
  const [activityItems, setActivityItems] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    activityLogApi
      .list({ limit: 8 })
      .then((items) => {
        if (!cancelled) setActivityItems(items);
      })
      .catch(() => {
        if (!cancelled) setActivityItems([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack
      spacing={2}
      sx={{
        width: 280,
        flexShrink: 0,
        bgcolor: BRAND.panelBg,
        borderLeft: `1px solid ${BRAND.border}`,
        p: 2,
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
      }}
    >
      {/* Varsler */}
      <Box>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <NotificationsNoneOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
            <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.86rem' }}>
              Varsler
            </Typography>
          </Stack>
          {notifications.length > 0 ? (
            <Chip
              label={notifications.length}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.68rem',
                fontWeight: 700,
                bgcolor: BRAND.accentStrong,
                color: '#fff',
              }}
            />
          ) : null}
        </Stack>
        {notificationsLoading ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={16} sx={{ color: BRAND.accent }} />
          </Stack>
        ) : notificationsError ? (
          <Typography sx={{ color: BRAND.danger, fontSize: '0.78rem' }}>
            Kunne ikke laste varsler
          </Typography>
        ) : notifications.length === 0 ? (
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
            Ingen uleste varsler.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {notifications.slice(0, 5).map((n) => (
              <Stack
                key={n.id}
                spacing={0.25}
                sx={{
                  px: 1,
                  py: 0.75,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(167, 139, 250, 0.06)',
                  border: `1px solid ${BRAND.border}`,
                }}
              >
                <Typography sx={{ color: BRAND.text, fontWeight: 600, fontSize: '0.78rem' }}>
                  {n.title ?? n.type ?? 'Varsel'}
                </Typography>
                {n.message ? (
                  <Typography
                    sx={{
                      color: BRAND.textMuted,
                      fontSize: '0.72rem',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {n.message}
                  </Typography>
                ) : null}
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ borderColor: BRAND.border }} />

      {/* Dagens agenda — live fra /api/admin-room/workspace/today-agenda */}
      <TodayAgendaSection product={product} />

      <Divider sx={{ borderColor: BRAND.border }} />

      {/* Kommende frister — live aggregat (funding + cases + meetings)
          fra /api/admin-room/workspace/upcoming-deadlines */}
      <UpcomingDeadlinesSection product={product} onNavigate={onNavigate} />

      <Divider sx={{ borderColor: BRAND.border }} />

      {/* Nylig aktivitet */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <HistoryOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.86rem' }}>
            Nylig aktivitet
          </Typography>
        </Stack>
        {activityLoading ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={16} sx={{ color: BRAND.accent }} />
          </Stack>
        ) : activityItems.length === 0 ? (
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
            Ingen aktivitet logget.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {activityItems.slice(0, 6).map((a) => (
              <Stack
                key={a.id}
                direction="row"
                spacing={0.75}
                alignItems="flex-start"
              >
                <CircleIcon
                  sx={{ fontSize: 6, mt: 0.75, color: BRAND.accent }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      color: BRAND.text,
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {a.action}
                  </Typography>
                  {a.summary ? (
                    <Typography
                      sx={{
                        color: BRAND.textMuted,
                        fontSize: '0.7rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {a.summary}
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Top bar (brødsmuler + tittel + status + søk)
// ─────────────────────────────────────────────────────────

function TopBar({
  resolved,
  contentTab,
  onContentTabChange,
  onOpenPalette,
  teamchatOpen,
  onToggleTeamchat,
  showTeamchatToggle,
}: {
  resolved: ResolvedPanel;
  contentTab: number;
  onContentTabChange: (next: number) => void;
  onOpenPalette: () => void;
  teamchatOpen: boolean;
  onToggleTeamchat: () => void;
  showTeamchatToggle: boolean;
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        px: { xs: 2, md: 3 },
        pt: 2,
        pb: 1.5,
        borderBottom: `1px solid ${BRAND.border}`,
        bgcolor: 'rgba(11, 5, 24, 0.55)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {resolved.breadcrumbs.map((b, i) => (
              <Stack key={`${b}-${i}`} direction="row" alignItems="center" spacing={0.5}>
                <Typography
                  sx={{
                    color: i === resolved.breadcrumbs.length - 1 ? BRAND.text : BRAND.textDim,
                    fontSize: '0.74rem',
                    fontWeight: i === resolved.breadcrumbs.length - 1 ? 700 : 500,
                  }}
                >
                  {b}
                </Typography>
                {i < resolved.breadcrumbs.length - 1 ? (
                  <ChevronRightIcon sx={{ color: BRAND.textDim, fontSize: 14 }} />
                ) : null}
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography sx={{ color: BRAND.text, fontWeight: 800, fontSize: '1.2rem' }}>
              {resolved.title}
            </Typography>
            {resolved.statusChip ? (
              <Chip
                label={resolved.statusChip.label}
                size="small"
                sx={{
                  bgcolor: `${resolved.statusChip.color}1a`,
                  color: resolved.statusChip.color,
                  fontWeight: 700,
                  height: 22,
                  border: `1px solid ${resolved.statusChip.color}55`,
                }}
              />
            ) : null}
          </Stack>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Åpner ⌘K-paletten. Var tidligere et `disabled` felt med en
              ⌘K-chip uten handler — altså en snarvei som ikke fantes. */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            role="button"
            tabIndex={0}
            aria-label="Hopp til flate (⌘K)"
            onClick={onOpenPalette}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenPalette();
              }
            }}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: 'rgba(167, 139, 250, 0.06)',
              border: `1px solid ${BRAND.border}`,
              minWidth: 180,
              display: { xs: 'none', md: 'flex' },
              '&:hover': { borderColor: BRAND.borderHover },
            }}
          >
            <SearchOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 16 }} />
            <Typography sx={{ flex: 1, color: BRAND.textDim, fontSize: '0.8rem' }}>
              Hopp til flate…
            </Typography>
            <Chip
              label="⌘K"
              size="small"
              sx={{
                height: 16,
                fontSize: '0.62rem',
                bgcolor: 'rgba(167, 139, 250, 0.16)',
                color: '#ddd6fe',
              }}
            />
          </Stack>

          {/* Teamchat-toggle — kolonnen er skjult som default. */}
          {showTeamchatToggle ? (
            <Tooltip title={teamchatOpen ? 'Skjul teamchat' : 'Vis teamchat'}>
              <IconButton
                size="small"
                onClick={onToggleTeamchat}
                aria-label={teamchatOpen ? 'Skjul teamchat' : 'Vis teamchat'}
                sx={{
                  color: teamchatOpen ? BRAND.accent : BRAND.textDim,
                  bgcolor: teamchatOpen ? BRAND.selectedBg : 'transparent',
                  border: `1px solid ${teamchatOpen ? BRAND.borderHover : BRAND.border}`,
                  borderRadius: 1.5,
                }}
              >
                <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>

      {resolved.contentTabs && resolved.contentTabs.length > 0 ? (
        <ContentTabs
          tabs={resolved.contentTabs}
          active={contentTab}
          onChange={onContentTabChange}
        />
      ) : null}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Hoved-komponent
// ─────────────────────────────────────────────────────────

export default function AdminWorkspace() {
  const [collapsed, setCollapsed] = useState(false);
  // Valider mot registeret: en ukjent `?view=` (gammelt bokmerke, omdøpt
  // flate) ga tidligere en helt blank hovedflate uten forklaring.
  const [selected, setSelected] = useState<WorkspaceItemId>(() => {
    if (typeof window === 'undefined') return 'overview';
    return readViewFromUrl(window.location.search);
  });
  // Preferanser fra Innstillinger-flaten. Speilet i localStorage, så
  // første render bruker riktig produkt/layout uten å vente på API-et.
  const [prefs, setPrefs] = useState<WorkspacePrefs>(() =>
    typeof window === 'undefined'
      ? { defaultProduct: 'roleroom', teamchatOpenByDefault: false, notificationPollSeconds: 60 }
      : readStoredWorkspacePrefs(),
  );

  const [product, setProduct] = useState<AdminProductId>(() => {
    if (typeof window === 'undefined') return 'roleroom';
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('product');
      if (fromUrl === 'leadgrid') return 'leadgrid';
      if (fromUrl === 'roleroom') return 'roleroom';
    } catch {
      /* ignore */
    }
    // URL-en vinner; ellers styrer preferansen.
    return readStoredWorkspacePrefs().defaultProduct;
  });
  const [contentTab, setContentTab] = useState(0);
  // ⌘K-palett
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Teamchat-kolonnen er skjult som default: den er en låst composer inntil
  // et workspace-bredt chat-endepunkt finnes, og 320px permanent til en
  // tom lovnad er dyrere enn en toggle.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [teamchatOpen, setTeamchatOpen] = useState(
    () => (typeof window === 'undefined' ? false : readStoredWorkspacePrefs().teamchatOpenByDefault),
  );
  // Deep-link fra frist-lenker: /admin-workspace?view=cases&caseId=…
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new URLSearchParams(window.location.search).get('caseId');
    } catch {
      return null;
    }
  });

  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(max-width: 1199px)');

  // Cmd+B toggle for sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sync URL state (uten å trigge router-navigasjon)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('view', selected);
    params.set('product', product);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', next);
  }, [selected, product]);

  // Reset content-tab når man bytter side
  useEffect(() => {
    setContentTab(0);
  }, [selected]);

  // Varsler via React Query. Deduper på tvers av innboksen, badgen og
  // høyre kolonne — én timer, ett kall, uansett hvor mange lesere.
  const notificationsQuery = useWorkspaceNotifications(prefs.notificationPollSeconds);
  const notifications = notificationsQuery.data ?? [];
  const notificationsLoading = notificationsQuery.isPending;
  const notificationsError = queryError(notificationsQuery.error, 'Kunne ikke hente varsler');

  const markSeen = useMarkNotificationSeen();
  const handleMarkNotificationSeen = useCallback(
    (id: string) => {
      markSeen.mutate(id);
    },
    [markSeen],
  );

  // ⌘K / Ctrl+K åpner hopp-til-paletten.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auth-gating
  const localEmail = useMemo(() => getCurrentUserEmail(), []);
  const [serverEmail, setServerEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (localEmail) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/auth/user', { credentials: 'include' });
        if (!cancelled && r.ok) {
          const body = await r.json().catch(() => ({}));
          const email =
            typeof body?.user?.email === 'string'
              ? body.user.email.toLowerCase()
              : typeof body?.email === 'string'
                ? body.email.toLowerCase()
                : null;
          setServerEmail(email);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localEmail]);

  const effectiveEmail = localEmail || serverEmail || '';

  // startTransition: panel-bytte kan mounte innhold som suspender (lazy
  // undertrær). Synkron setState fra klikk + suspend = React #426 som blanker
  // flaten til ErrorBoundary. Transition lar React holde forrige panel synlig.
  const handleSelect = useCallback((id: WorkspaceItemId) => {
    startTransition(() => setSelected(id));
  }, []);

  // Produkt-toggelen er ikke lenger bare en gradient: den sendes med til
  // aggregatorene, som filtrerer bort det som hører til det andre
  // produktet (og alltid beholder selskaps-nivå, f.eks. funding-frister).
  const productScope: WorkspaceProductScope = product;

  // Deep-link fra aggregatorens link_path. Peker den inn i workspacet
  // bytter vi panel i React; ellers vanlig navigasjon. Tidligere gjorde
  // alle disse en full sidelast av en tung SPA — og lenken til en sak var
  // dessuten død, fordi backend sendte ?sidebar= mens vi leser ?view=.
  const handleWorkspaceNavigate = useCallback((target: WorkspaceLinkTarget) => {
    if (target.caseId) setPendingCaseId(target.caseId);
    startTransition(() => setSelected(target.view));
  }, []);

  const handleOpenCase = useCallback((caseId: string) => {
    setPendingCaseId(caseId);
    startTransition(() => setSelected('cases'));
  }, []);

  // Saken er åpnet — ta caseId ut av URL-en så en refresh ikke tvinger
  // den opp igjen etter at du har navigert videre.
  // Innstillinger-flaten melder tilbake så endringer slår inn med én
  // gang (f.eks. poll-intervallet), uten reload. Default-produkt og
  // teamchat-kolonnen leses ved oppstart — vi overstyrer ikke et valg
  // brukeren allerede har gjort i denne økten.
  const handlePrefsChange = useCallback((next: WorkspacePrefs) => {
    setPrefs(next);
  }, []);

  const handleCaseConsumed = useCallback(() => {
    setPendingCaseId(null);
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('caseId')) return;
      params.delete('caseId');
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {
      /* ignore */
    }
  }, []);

  if (!authChecked) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: BRAND.bgGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: BRAND.accent }} />
      </Box>
    );
  }

  if (effectiveEmail !== ADMIN_ROOM_OWNER_EMAIL) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: BRAND.bgGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
        }}
      >
        <Box sx={{ maxWidth: 480, width: '100%' }}>
          <Alert
            severity="error"
            sx={{
              mb: 2,
              bgcolor: 'rgba(220, 38, 38, 0.16)',
              color: '#fecaca',
              border: '1px solid rgba(220, 38, 38, 0.4)',
            }}
          >
            Admin Workspace er kun tilgjengelig for produkteier ({ADMIN_ROOM_OWNER_EMAIL}).
          </Alert>
          <Alert
            severity="info"
            sx={{
              bgcolor: 'rgba(167, 139, 250, 0.10)',
              color: '#ddd6fe',
              border: `1px solid ${BRAND.border}`,
            }}
          >
            Innlogget som: <code>{effectiveEmail || '(ingen session funnet)'}</code> ·{' '}
            <a href="/login" style={{ color: BRAND.accent }}>
              Logg inn på nytt
            </a>
          </Alert>
        </Box>
      </Box>
    );
  }

  const resolved = resolvePanel(selected, {
    product,
    productScope,
    notifications,
    notificationsLoading,
    notificationsError,
    onMarkNotificationSeen: handleMarkNotificationSeen,
    onJumpTo: handleSelect,
    onNavigate: handleWorkspaceNavigate,
    onOpenCase: handleOpenCase,
    pendingCaseId,
    onCaseConsumed: handleCaseConsumed,
    onPrefsChange: handlePrefsChange,
    activeContentTab: contentTab,
  });
  const inboxBadge = notifications.length;

  return (
    <ThemeProvider theme={workspaceTheme}>
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: BRAND.bgGradient,
        color: BRAND.text,
        position: 'relative',
        // Plassér plass for bottom-nav på mobil
        pb: isMobile ? 7 : 0,
      }}
    >
      {/* Sidebar (skjules på mobil) */}
      {!isMobile ? (
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((p) => !p)}
          selected={selected}
          onSelect={handleSelect}
          inboxBadge={inboxBadge}
          product={product}
          onProductChange={(next) => startTransition(() => setProduct(next))}
        />
      ) : null}

      {/* Hovedinnhold */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          resolved={resolved}
          contentTab={contentTab}
          onContentTabChange={(tab) => startTransition(() => setContentTab(tab))}
          onOpenPalette={() => setPaletteOpen(true)}
          teamchatOpen={teamchatOpen}
          onToggleTeamchat={() => setTeamchatOpen((v) => !v)}
          showTeamchatToggle={!isTablet}
        />
        <Box sx={{ flex: 1, px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 } }}>
          {/* key: boundary nullstilles automatisk ved panel-/fane-bytte, ellers
              låses fallbacken fordi sidebar/topbar ligger utenfor boundaryen. */}
          <ErrorBoundary
            key={`${selected}-${contentTab}`}
            componentName={`admin-workspace-panel:${selected}`}
            fallback={
              <Box
                sx={{
                  p: 4,
                  borderRadius: 2,
                  bgcolor: BRAND.panelBg,
                  border: `1px solid ${BRAND.border}`,
                  color: BRAND.text,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  alignItems: 'flex-start',
                }}
              >
                <Typography variant="h6" sx={{ color: BRAND.text }}>
                  Panelet krasjet
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
                  Noe gikk galt i dette panelet. Velg et annet panel i menyen,
                  eller last siden på nytt.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.location.reload()}
                  sx={{
                    color: BRAND.accent,
                    borderColor: BRAND.border,
                    '&:hover': { borderColor: BRAND.borderHover, bgcolor: BRAND.hoverBg },
                  }}
                >
                  Last på nytt
                </Button>
              </Box>
            }
          >
            {/* Suspense: hver flate er lazy, så det må finnes en grense
                her. Fallbacken er bevisst lav-profil — en spinner der
                innholdet kommer, ikke en full skjerm som blinker. */}
            <Suspense
              fallback={
                <Stack alignItems="center" sx={{ py: 8 }}>
                  <CircularProgress sx={{ color: BRAND.accent }} />
                </Stack>
              }
            >
              {resolved.render()}
            </Suspense>
          </ErrorBoundary>
        </Box>
      </Box>

      {/* Høyre kolonner (skjules på tablet+mobil).
          Teamchat er bak en toggle: så lenge composeren er låst i påvente
          av et workspace-bredt chat-endepunkt, er 320px permanent for en
          tom lovnad dyrere enn ett klikk. */}
      {!isTablet && teamchatOpen ? <TeamchatPanel onClose={() => setTeamchatOpen(false)} /> : null}
      {!isTablet ? (
        <NotificationsAgendaPanel
          notifications={notifications}
          notificationsLoading={notificationsLoading}
          notificationsError={notificationsError}
          product={productScope}
          onNavigate={handleWorkspaceNavigate}
        />
      ) : null}

      {/* Mobil bottom-nav */}
      {isMobile ? (
        <MobileBottomNav
          selected={selected}
          onSelect={handleSelect}
          inboxBadge={inboxBadge}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      ) : null}

      {/* Hele navigasjonen på mobil. Uten denne er 27 av 32 flater
          utilgjengelige når sidebaren skjules. */}
      <MobileNavDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        selected={selected}
        onSelect={handleSelect}
        inboxBadge={inboxBadge}
        product={product}
        onProductChange={setProduct}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handleSelect}
      />
    </Box>
    </ThemeProvider>
  );
}
