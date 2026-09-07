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
import { PanelEmpty } from './admin-workspace/panelKit';
import CommandPalette from './admin-workspace/CommandPalette';
import KalenderTab from './admin-workspace/KalenderTab';
import OppgaverTab from './admin-workspace/OppgaverTab';
import ProsjekterTab from './admin-workspace/ProsjekterTab';
import DokumenterTab from './admin-workspace/DokumenterTab';
import FilerTab from './admin-workspace/FilerTab';
import TeamchatTab from './admin-workspace/TeamchatTab';
import AutomatiseringerTab from './admin-workspace/AutomatiseringerTab';
import KundeprosjektTab from './admin-workspace/KundeprosjektTab';
import HrTab from './admin-workspace/HrTab';
import InnstillingerTab, {
  readStoredWorkspacePrefs,
  type WorkspacePrefs,
} from './admin-workspace/InnstillingerTab';
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

import {
  BusinessPlanTab,
  FundingAppsTab,
  InvestorContactsTab,
  PartnerContactsTab,
  ActivityLogTab,
} from './AdminRoom';
import { IndustryTargetsTab } from '../components/admin/content-marketing/IndustryTargetsTab';
import { MarketingSegmentsTab } from '../components/admin/content-marketing/MarketingSegmentsTab';
import { BusinessDnaOnboarding } from '../components/admin/content-marketing/BusinessDnaOnboarding';
import { MarketingCatalogTab } from '../components/admin/content-marketing/MarketingCatalogTab';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { ContentMarketingTab } from '../components/admin/content-marketing/ContentMarketingTab';
import { OperatingSystemTab } from '../components/admin/content-marketing/OperatingSystemTab';
import { AiCitationTab } from '../components/admin/content-marketing/AiCitationTab';
import { RoleRoomEconomyTab } from '../components/admin/content-marketing/RoleRoomEconomyTab';
import { NewsletterStudioTab } from '../components/admin/content-marketing/NewsletterStudioTab';
import { MigrationsTab } from '../components/role-room/components/admin-room/MigrationsTab';
import { WhatsNewTab } from '../components/role-room/components/admin-room/WhatsNewTab';
import MarketingCockpitTab from './admin-room/MarketingCockpitTab';
import RoleRoomAgentTab from './admin-room/RoleRoomAgentTab';
import ContentCalendarTab from './admin-room/ContentCalendarTab';
import { SakerTab } from './admin-workspace/SakerTab';
import { LeadgridAppWaitlistTab } from './admin-workspace/LeadgridAppWaitlistTab';

import {
  activityLogApi,
  type ActivityLogEntry,
  workspaceAggregatorApi,
  workspaceNotificationsApi,
  type WorkspaceNotification,
  type WorkspaceProductScope,
  type AgendaItem,
  type DeadlineItem,
  DEADLINE_SOURCE_LABEL,
} from '../services/adminRoomApi';
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

interface NavItem {
  id: WorkspaceItemId;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

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
  const sections: NavSection[] = useMemo(
    () => [
      {
        id: 'main',
        items: [
          { id: 'overview', label: 'Oversikt', icon: <DashboardOutlinedIcon /> },
          {
            id: 'inbox',
            label: 'Innboks',
            icon: <InboxOutlinedIcon />,
            badge: inboxBadge,
          },
          { id: 'cases', label: 'Saker', icon: <GavelOutlinedIcon /> },
          { id: 'tasks', label: 'Oppgaver', icon: <TaskAltOutlinedIcon /> },
          { id: 'calendar', label: 'Kalender', icon: <EventOutlinedIcon /> },
        ],
      },
      {
        id: 'operations',
        label: 'Drift',
        items: [
          { id: 'projects', label: 'Prosjekter', icon: <FolderOpenOutlinedIcon /> },
          { id: 'kundeprosjekt', label: 'Kundeprosjekt', icon: <GroupsOutlinedIcon /> },
          { id: 'documents', label: 'Dokumenter', icon: <DescriptionOutlinedIcon /> },
          { id: 'files', label: 'Filer', icon: <InsertDriveFileOutlinedIcon /> },
          { id: 'teamchat', label: 'Teamchat', icon: <ChatBubbleOutlineOutlinedIcon /> },
          { id: 'automations', label: 'Automatiseringer', icon: <AutoFixHighOutlinedIcon /> },
        ],
      },
      {
        id: 'ledelse-group',
        label: 'Ledelse',
        items: [
          { id: 'business-plan', label: 'Forretningsplan', icon: <ArticleOutlinedIcon /> },
          { id: 'funding', label: 'Søknader (IN/EU)', icon: <DescriptionOutlinedIcon /> },
          { id: 'investors', label: 'Investor-pipeline', icon: <LeaderboardOutlinedIcon /> },
          { id: 'partners', label: 'Samarbeidspartnere', icon: <HubOutlinedIcon /> },
          { id: 'role-room-economy', label: 'RR Økonomi', icon: <SsidChartOutlinedIcon /> },
        ],
      },
      {
        id: 'marketing-group',
        label: 'Markedsføring',
        items: [
          { id: 'marketing-cockpit', label: 'Marketing Cockpit', icon: <SsidChartOutlinedIcon /> },
          { id: 'industry-crm', label: 'Tier-1 outreach', icon: <LeaderboardOutlinedIcon /> },
          { id: 'marketing-segments', label: 'Målgrupper', icon: <GroupsOutlinedIcon /> },
          { id: 'newsletter-studio', label: 'Newsletter Studio', icon: <EmailOutlinedIcon /> },
          { id: 'content-calendar', label: 'Content-kalender', icon: <CampaignOutlinedIcon /> },
        ],
      },
      {
        id: 'product-group',
        label: 'Produkt',
        items: [
          { id: 'role-room-agent', label: 'Role Room Agent', icon: <SmartToyOutlinedIcon /> },
          { id: 'operating-system', label: 'Operativsystem', icon: <HubOutlinedIcon /> },
          { id: 'migrations', label: 'Migrasjoner', icon: <StorageOutlinedIcon /> },
          { id: 'activity', label: 'Aktivitetslogg', icon: <HistoryOutlinedIcon /> },
        ],
      },
      {
        id: 'teamspaces',
        label: 'Teamspaces',
        items: [
          { id: 'ledelse', label: 'Ledelse', icon: <BusinessCenterOutlinedIcon /> },
          { id: 'markedsforing', label: 'Markedsføring', icon: <CampaignOutlinedIcon /> },
          { id: 'produkt', label: 'Produkt', icon: <ScienceOutlinedIcon /> },
          { id: 'hr', label: 'HR', icon: <PersonOutlineOutlinedIcon /> },
        ],
      },
    ],
    [inboxBadge],
  );

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
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
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
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    onClick={() => onSelect(item.id)}
                    sx={{
                      cursor: 'pointer',
                      px: collapsed ? 1.5 : 1.5,
                      mx: collapsed ? 0.5 : 1,
                      py: 0.75,
                      borderRadius: 1.5,
                      color: isSelected ? BRAND.text : BRAND.textMuted,
                      bgcolor: isSelected ? BRAND.selectedBg : 'transparent',
                      borderLeft: isSelected
                        ? `3px solid ${BRAND.accent}`
                        : '3px solid transparent',
                      transition: 'background-color 120ms ease',
                      '&:hover': {
                        bgcolor: isSelected ? BRAND.selectedBg : BRAND.hoverBg,
                        color: BRAND.text,
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
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={() => onSelect('settings')}
            sx={{
              cursor: 'pointer',
              px: 1.5,
              mx: collapsed ? 0.5 : 1,
              py: 0.75,
              borderRadius: 1.5,
              color: selected === 'settings' ? BRAND.text : BRAND.textMuted,
              bgcolor: selected === 'settings' ? BRAND.selectedBg : 'transparent',
              '&:hover': { bgcolor: BRAND.hoverBg, color: BRAND.text },
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
}: {
  selected: WorkspaceItemId;
  onSelect: (id: WorkspaceItemId) => void;
  inboxBadge: number;
}) {
  const items: NavItem[] = [
    { id: 'overview', label: 'Oversikt', icon: <DashboardOutlinedIcon /> },
    { id: 'inbox', label: 'Innboks', icon: <InboxOutlinedIcon />, badge: inboxBadge },
    { id: 'tasks', label: 'Oppgaver', icon: <TaskAltOutlinedIcon /> },
    { id: 'teamchat', label: 'Chat', icon: <ChatBubbleOutlineOutlinedIcon /> },
    { id: 'settings', label: 'Meny', icon: <MenuIcon /> },
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
        <TeamchatTab compact />
      </Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Dagens agenda — live fra workspaceAggregatorApi.todayAgenda()
// 60s polling så åpne tabs holder seg friske uten manuell refresh.
// ─────────────────────────────────────────────────────────

function TodayAgendaSection({ product }: { product: WorkspaceProductScope }) {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const refresh = () => {
      workspaceAggregatorApi.todayAgenda(product)
        .then((rows) => { if (!cancelled) { setItems(rows); setError(null); } })
        .catch((err) => { if (!cancelled) setError((err as Error).message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    refresh();
    timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [product]);

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
  const [items, setItems] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const refresh = () => {
      workspaceAggregatorApi.upcomingDeadlines(14, product)
        .then((data) => { if (!cancelled) { setItems(data.items); setError(null); } })
        .catch((err) => { if (!cancelled) setError((err as Error).message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    refresh();
    timer = setInterval(refresh, 120_000); // 2 min — frister endrer seg sjeldnere enn agenda
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [product]);

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
                sx={{
                  p: 0.75,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(167,139,250,0.04)',
                  border: '1px solid rgba(167,139,250,0.12)',
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.10)' },
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
// Innboks-side (hovedinnhold)
// ─────────────────────────────────────────────────────────

function InboxView({
  notifications,
  loading,
  error,
  onMarkSeen,
}: {
  notifications: WorkspaceNotification[];
  loading: boolean;
  error: string | null;
  onMarkSeen: (id: string) => void;
}) {
  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress sx={{ color: BRAND.accent }} />
      </Stack>
    );
  }

  // Feil FØR tomhet. «Tom innboks» når backend er nede er den dyreste
  // løgnen en driftsflate kan fortelle.
  if (error) {
    return (
      <Alert
        severity="error"
        sx={{
          bgcolor: 'rgba(220, 38, 38, 0.16)',
          color: '#fecaca',
          border: '1px solid rgba(220, 38, 38, 0.4)',
        }}
      >
        Kunne ikke hente varsler — {error}. Listen under kan være utdatert eller ufullstendig.
      </Alert>
    );
  }

  if (notifications.length === 0) {
    return (
      <PanelEmpty
        icon={<InboxOutlinedIcon />}
        title="Tom innboks"
        description="Du har ingen uleste varsler. Når noe trenger oppmerksomhet — fra leads, søknader, prosjekter eller systemvarsler — havner det her."
      />
    );
  }

  return (
    <Stack spacing={1}>
      {notifications.map((n) => (
        <Box
          key={n.id}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: BRAND.panelBg,
            border: `1px solid ${BRAND.border}`,
            '&:hover': { borderColor: BRAND.borderHover },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
                {n.title ?? n.type ?? 'Varsel'}
              </Typography>
              {n.message ? (
                <Typography sx={{ color: BRAND.textMuted, fontSize: '0.84rem', mt: 0.5, lineHeight: 1.5 }}>
                  {n.message}
                </Typography>
              ) : null}
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
                {n.createdAt ? (
                  <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}>
                    {new Date(n.createdAt).toLocaleString('nb-NO')}
                  </Typography>
                ) : null}
                {/* Click-through til kilden. Uten denne var innboksen en
                    liste du ikke kunne gjøre noe fra. */}
                {n.actionUrl ? (
                  <Button
                    size="small"
                    href={n.actionUrl}
                    endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      textTransform: 'none',
                      color: BRAND.accent,
                      fontSize: '0.76rem',
                      p: 0,
                      minWidth: 0,
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    {n.actionLabel ?? 'Åpne'}
                  </Button>
                ) : null}
              </Stack>
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {n.priority === 'urgent' || n.priority === 'high' ? (
                <Chip
                  label={n.priority === 'urgent' ? 'Haster' : 'Høy'}
                  size="small"
                  sx={{
                    bgcolor: n.priority === 'urgent' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: n.priority === 'urgent' ? '#fca5a5' : '#fcd34d',
                    fontWeight: 700,
                    height: 22,
                  }}
                />
              ) : null}
              {/* En innboks du ikke kan tømme slutter folk å åpne. */}
              <Tooltip title="Markér som lest">
                <IconButton
                  size="small"
                  onClick={() => onMarkSeen(n.id)}
                  aria-label={`Markér «${n.title ?? 'varsel'}» som lest`}
                  sx={{ color: BRAND.textDim, '&:hover': { color: BRAND.success } }}
                >
                  <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Oversikt-side (hovedinnhold)
// ─────────────────────────────────────────────────────────

function OverviewView({
  onJumpTo,
  product,
}: {
  onJumpTo: (id: WorkspaceItemId) => void;
  product: AdminProductId;
}) {
  const cards: { id: WorkspaceItemId; label: string; description: string; icon: ReactNode }[] = [
    {
      id: 'business-plan',
      label: 'Forretningsplan',
      description: 'BBI-strukturert plan, autosave + Claude-generering per felt.',
      icon: <ArticleOutlinedIcon />,
    },
    {
      id: 'industry-crm',
      label: 'Tier-1 outreach (CRM)',
      description: 'Bransje-mål, produksjoner og kontakt-pipeline.',
      icon: <LeaderboardOutlinedIcon />,
    },
    {
      id: 'business-dna',
      label: 'Business DNA',
      description: 'Lim inn URL → merkevaren din + første kampanje, med dine egne bilder.',
      icon: <AutoAwesomeOutlinedIcon />,
    },
    {
      id: 'marketing-catalog',
      label: 'Katalog',
      description: 'Produkter og vertikaler kampanjene trekker fra — auto-oppdaget fra systemet.',
      icon: <Inventory2OutlinedIcon />,
    },
    {
      id: 'marketing-segments',
      label: 'Målgrupper',
      description: 'Segmenter → synkroniserte Google/Meta/LinkedIn-audiences.',
      icon: <GroupsOutlinedIcon />,
    },
    {
      id: 'marketing-cockpit',
      label: 'Marketing Cockpit',
      description: 'B2B-funnel, content-kalender, Claude lead-scoring.',
      icon: <CampaignOutlinedIcon />,
    },
    {
      id: 'role-room-agent',
      label: 'Role Room Agent',
      description: 'AI-assistent for research, kampanjer og innholds-utkast.',
      icon: <SmartToyOutlinedIcon />,
    },
    {
      id: 'operating-system',
      label: 'Operativsystem',
      description: 'Bransje-organisasjoner og kvalitets-partnere.',
      icon: <HubOutlinedIcon />,
    },
    {
      id: 'ai-citation',
      label: 'GEO-effekt',
      description: 'AI-citation-måling for søkemotor-LLM-svar.',
      icon: <SsidChartOutlinedIcon />,
    },
    {
      id: 'newsletter-studio',
      label: 'Newsletter Studio',
      description: 'Block-builder, segmenter og AI-genererte emnefelter.',
      icon: <EmailOutlinedIcon />,
    },
    {
      id: 'migrations',
      label: 'Migrasjoner',
      description: 'Pending DB-migrasjoner + auto-detect + trigger.',
      icon: <StorageOutlinedIcon />,
    },
  ];

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          background:
            product === 'leadgrid'
              ? 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(167,139,250,0.10))'
              : 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(124,58,237,0.08))',
          border: `1px solid ${BRAND.border}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <RocketLaunchOutlinedIcon sx={{ color: BRAND.accent, fontSize: 28 }} />
          <Box>
            <Typography sx={{ color: BRAND.text, fontWeight: 800, fontSize: '1.2rem' }}>
              Velkommen tilbake, Daniel
            </Typography>
            <Typography sx={{ color: BRAND.textMuted, fontSize: '0.88rem' }}>
              Aktivt produkt:{' '}
              <strong style={{ color: BRAND.text }}>
                {ADMIN_PRODUCTS.find((p) => p.id === product)?.label}
              </strong>
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box>
        <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.96rem', mb: 1.5 }}>
          Hurtigvalg
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 1.5,
          }}
        >
          {cards.map((c) => (
            <Box
              key={c.id}
              onClick={() => onJumpTo(c.id)}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: BRAND.panelBg,
                border: `1px solid ${BRAND.border}`,
                cursor: 'pointer',
                transition: 'transform 120ms ease, border-color 120ms ease',
                '&:hover': {
                  borderColor: BRAND.borderHover,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(124, 58, 237, 0.18)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(167, 139, 250, 0.14)',
                    color: BRAND.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& svg': { fontSize: 18 },
                  }}
                >
                  {c.icon}
                </Box>
                <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.88rem' }}>
                  {c.label}
                </Typography>
              </Stack>
              <Typography sx={{ color: BRAND.textMuted, fontSize: '0.76rem', lineHeight: 1.4 }}>
                {c.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Resolve hovedinnhold for valgt item
// ─────────────────────────────────────────────────────────

interface ResolvedContent {
  title: string;
  breadcrumbs: string[];
  statusChip?: { label: string; color: string };
  contentTabs?: string[];
  render: (activeContentTab: number) => ReactNode;
}

interface ResolveContentDeps {
  selected: WorkspaceItemId;
  product: AdminProductId;
  notifications: WorkspaceNotification[];
  notificationsLoading: boolean;
  notificationsError: string | null;
  onMarkNotificationSeen: (id: string) => void;
  onJumpTo: (id: WorkspaceItemId) => void;
  onNavigate: (target: WorkspaceLinkTarget) => void;
  onOpenCase: (caseId: string) => void;
  pendingCaseId: string | null;
  onCaseConsumed: () => void;
  onPrefsChange: (prefs: WorkspacePrefs) => void;
}

function resolveContent({
  selected,
  product,
  notifications,
  notificationsLoading,
  notificationsError,
  onMarkNotificationSeen,
  onJumpTo,
  onNavigate,
  onOpenCase,
  pendingCaseId,
  onCaseConsumed,
  onPrefsChange,
}: ResolveContentDeps): ResolvedContent {
  switch (selected) {
    case 'overview':
      return {
        title: 'Oversikt',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Oversikt'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <OverviewView onJumpTo={onJumpTo} product={product} />,
      };
    case 'inbox':
      return {
        title: 'Innboks',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Innboks'],
        statusChip: notificationsError
          ? { label: 'Ukjent', color: BRAND.danger }
          : notifications.length > 0
            ? { label: `${notifications.length} uleste`, color: BRAND.accentStrong }
            : { label: 'Alt klart', color: '#22c55e' },
        render: () => (
          <InboxView
            notifications={notifications}
            loading={notificationsLoading}
            error={notificationsError}
            onMarkSeen={onMarkNotificationSeen}
          />
        ),
      };
    case 'cases':
      return {
        title: 'Saker',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Saker'],
        render: () => (
          <SakerTab
            parentProduct={product}
            initialCaseId={pendingCaseId}
            onInitialCaseConsumed={onCaseConsumed}
          />
        ),
      };
    case 'projects':
      return {
        title: 'Prosjekter',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Prosjekter'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <ProsjekterTab product={product} />,
      };
    case 'documents':
      return {
        title: 'Dokumenter',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Dokumenter'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <DokumenterTab product={product} />,
      };
    case 'tasks':
      return {
        title: 'Oppgaver',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Oppgaver'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <OppgaverTab parentProduct={product} onOpenCase={onOpenCase} />,
      };
    case 'calendar':
      return {
        title: 'Kalender',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Kalender'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <KalenderTab product={product} onNavigate={onNavigate} />,
      };
    case 'files':
      return {
        title: 'Filer',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Filer'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <FilerTab product={product} />,
      };
    case 'teamchat':
      return {
        title: 'Teamchat',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Teamchat'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <TeamchatTab />,
      };
    case 'automations':
      return {
        title: 'Automatiseringer',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Automatiseringer'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <AutomatiseringerTab />,
      };
    case 'business-plan':
      return {
        title: 'Forretningsplan',
        breadcrumbs: ['Creatorhub AS', 'Ledelse', 'Forretningsplan'],
        statusChip: { label: 'Autosave', color: '#22c55e' },
        contentTabs: ['Oversikt', 'Aktivitet'],
        render: (activeTab) =>
          activeTab === 1 ? <ActivityLogTab /> : <BusinessPlanTab />,
      };
    case 'funding':
      return {
        title: 'Søknader (IN/EU)',
        breadcrumbs: ['Creatorhub AS', 'Ledelse', 'Søknader'],
        render: () => <FundingAppsTab />,
      };
    case 'investors':
      return {
        title: 'Investor-pipeline',
        breadcrumbs: ['Creatorhub AS', 'Ledelse', 'Investor-pipeline'],
        render: () => <InvestorContactsTab />,
      };
    case 'partners':
      return {
        title: 'Samarbeidspartnere',
        breadcrumbs: ['Creatorhub AS', 'Ledelse', 'Samarbeidspartnere'],
        render: () => <PartnerContactsTab />,
      };
    case 'industry-crm':
      return {
        title: 'Tier-1 outreach (CRM)',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Tier-1 CRM'],
        render: () => <IndustryTargetsTab />,
      };
    case 'business-dna':
      return {
        title: 'Business DNA',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Business DNA'],
        render: () => <BusinessDnaOnboarding />,
      };
    case 'marketing-catalog':
      return {
        title: 'Katalog',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Katalog'],
        render: () => <MarketingCatalogTab />,
      };
    case 'marketing-segments':
      return {
        title: 'Målgrupper',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Målgrupper'],
        render: () => <MarketingSegmentsTab />,
      };
    case 'content-marketing':
      return {
        title: 'Content marketing',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Content marketing'],
        render: () => <ContentMarketingTab />,
      };
    case 'marketing-cockpit':
      return {
        title: 'Marketing Cockpit',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Cockpit'],
        render: () => <MarketingCockpitTab />,
      };
    case 'leadgrid-app-waitlist':
      return {
        title: 'App-venteliste',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Leadgrid: App-venteliste'],
        render: () => <LeadgridAppWaitlistTab />,
      };
    case 'operating-system':
      return {
        title: 'Operativsystem',
        breadcrumbs: ['Creatorhub AS', 'Produkt', 'Operativsystem'],
        render: () => <OperatingSystemTab />,
      };
    case 'role-room-agent':
      return {
        title: 'Role Room Agent',
        breadcrumbs: ['Creatorhub AS', 'Produkt', 'AI Agent'],
        render: () => <RoleRoomAgentTab />,
      };
    case 'content-calendar':
      return {
        title: 'Content-kalender',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Kalender'],
        render: () => <ContentCalendarTab />,
      };
    case 'role-room-economy':
      return {
        title: 'RR Økonomi',
        breadcrumbs: ['Creatorhub AS', 'Ledelse', 'Økonomi'],
        render: () => <RoleRoomEconomyTab />,
      };
    case 'newsletter-studio':
      return {
        title: 'Newsletter Studio',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'Newsletter'],
        render: () => <NewsletterStudioTab />,
      };
    case 'ai-citation':
      return {
        title: 'GEO-effekt',
        breadcrumbs: ['Creatorhub AS', 'Markedsføring', 'GEO-effekt'],
        render: () => <AiCitationTab />,
      };
    case 'whats-new':
      return {
        title: 'Hva er nytt',
        breadcrumbs: ['Creatorhub AS', 'Produkt', 'Hva er nytt'],
        render: () => <WhatsNewTab />,
      };
    case 'activity':
      return {
        title: 'Aktivitets-logg',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Aktivitet'],
        render: () => <ActivityLogTab />,
      };
    case 'migrations':
      return {
        title: 'Migrasjoner',
        breadcrumbs: ['Creatorhub AS', 'Produkt', 'Migrasjoner'],
        render: () => <MigrationsTab />,
      };
    case 'ledelse':
      return {
        title: 'Ledelse',
        breadcrumbs: ['Creatorhub AS', 'Teamspaces', 'Ledelse'],
        render: () => (
          <TeamspaceLanding
            label="Ledelse"
            cards={[
              { id: 'business-plan', label: 'Forretningsplan' },
              { id: 'funding', label: 'Søknader (IN/EU)' },
              { id: 'investors', label: 'Investor-pipeline' },
              { id: 'partners', label: 'Samarbeidspartnere' },
              { id: 'role-room-economy', label: 'RR Økonomi' },
            ]}
            onJumpTo={onJumpTo}
          />
        ),
      };
    case 'kundeprosjekt':
      return {
        title: 'Kundeprosjekt',
        breadcrumbs: ['Creatorhub AS', 'Teamspaces', 'Kundeprosjekt'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <KundeprosjektTab />,
      };
    case 'markedsforing':
      return {
        title: 'Markedsføring',
        breadcrumbs: ['Creatorhub AS', 'Teamspaces', 'Markedsføring'],
        render: () => (
          <TeamspaceLanding
            label="Markedsføring"
            cards={[
              { id: 'business-dna', label: 'Business DNA' },
              { id: 'marketing-catalog', label: 'Katalog' },
              { id: 'marketing-cockpit', label: 'Marketing Cockpit' },
              { id: 'leadgrid-app-waitlist', label: 'Leadgrid: App-venteliste' },
              { id: 'content-marketing', label: 'Content marketing' },
              { id: 'content-calendar', label: 'Content-kalender' },
              { id: 'newsletter-studio', label: 'Newsletter Studio' },
              { id: 'ai-citation', label: 'GEO-effekt' },
              { id: 'industry-crm', label: 'Tier-1 outreach' },
              { id: 'marketing-segments', label: 'Målgrupper' },
            ]}
            onJumpTo={onJumpTo}
          />
        ),
      };
    case 'produkt':
      return {
        title: 'Produkt',
        breadcrumbs: ['Creatorhub AS', 'Teamspaces', 'Produkt'],
        render: () => (
          <TeamspaceLanding
            label="Produkt"
            cards={[
              { id: 'operating-system', label: 'Operativsystem' },
              { id: 'role-room-agent', label: 'Role Room Agent' },
              { id: 'whats-new', label: 'Hva er nytt' },
              { id: 'migrations', label: 'Migrasjoner' },
            ]}
            onJumpTo={onJumpTo}
          />
        ),
      };
    case 'hr':
      return {
        title: 'HR',
        breadcrumbs: ['Creatorhub AS', 'Teamspaces', 'HR'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <HrTab product={product} />,
      };
    case 'settings':
      return {
        title: 'Innstillinger',
        breadcrumbs: ['Creatorhub AS', 'Innstillinger'],
        statusChip: { label: 'Live', color: '#22c55e' },
        render: () => <InnstillingerTab onPrefsChange={onPrefsChange} />,
      };
    default:
      return {
        title: 'Workspace',
        breadcrumbs: ['Creatorhub AS', 'Workspace'],
        render: () => null,
      };
  }
}

// ─────────────────────────────────────────────────────────
// Teamspace-landing (lister cards som hopper til sub-items)
// ─────────────────────────────────────────────────────────

function TeamspaceLanding({
  label,
  cards,
  onJumpTo,
}: {
  label: string;
  cards: { id: WorkspaceItemId; label: string }[];
  onJumpTo: (id: WorkspaceItemId) => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.86rem' }}>
        {label}-team bruker disse verktøyene:
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {cards.map((c) => (
          <Stack
            key={c.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => onJumpTo(c.id)}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: BRAND.panelBg,
              border: `1px solid ${BRAND.border}`,
              cursor: 'pointer',
              '&:hover': { borderColor: BRAND.borderHover, bgcolor: BRAND.hoverBg },
            }}
          >
            <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.88rem' }}>
              {c.label}
            </Typography>
            <ChevronRightIcon sx={{ color: BRAND.accent }} />
          </Stack>
        ))}
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
  resolved: ResolvedContent;
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
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  // ⌘K-palett
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Teamchat-kolonnen er skjult som default: den er en låst composer inntil
  // et workspace-bredt chat-endepunkt finnes, og 320px permanent til en
  // tom lovnad er dyrere enn en toggle.
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

  // Last varsler ved mount + poll hvert 60s.
  // Ved feil BEHOLDER vi forrige liste og setter en feilmelding: en
  // driftsflate skal ikke tømme skjermen fordi ett poll-kall feilet, og
  // den skal aldri påstå «Alt klart» når den ikke vet.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const items = await workspaceNotificationsApi.inbox();
        if (cancelled) return;
        setNotifications(items);
        setNotificationsError(null);
      } catch (err) {
        if (cancelled) return;
        setNotificationsError((err as Error).message || 'Kunne ikke hente varsler');
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    };
    void load();
    timer = setInterval(load, Math.max(15, prefs.notificationPollSeconds) * 1000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [prefs.notificationPollSeconds]);

  // Markér ett varsel som lest. Backend fjerner det fra inbox-spørringen,
  // så vi tar det ut av listen optimistisk og ruller tilbake ved feil.
  const handleMarkNotificationSeen = useCallback(async (id: string) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await workspaceNotificationsApi.markSeen(id);
    } catch (err) {
      setNotifications(previous);
      setNotificationsError((err as Error).message || 'Kunne ikke markere varselet som lest');
    }
  }, [notifications]);

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

  const resolved = resolveContent({
    selected,
    product,
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
            {resolved.render(contentTab)}
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
        />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handleSelect}
      />
    </Box>
    </ThemeProvider>
  );
}
