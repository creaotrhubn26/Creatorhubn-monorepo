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
} from '@mui/material';
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

import {
  activityLogApi,
  type ActivityLogEntry,
} from '../services/adminRoomApi';

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

// Branding — deep purple gradient + violet accent for Leadgrid-look.
const BRAND = {
  bgGradient: 'linear-gradient(180deg, #0b0518 0%, #1a0a2e 100%)',
  sidebarBg: 'rgba(11, 5, 24, 0.92)',
  panelBg: 'rgba(26, 10, 46, 0.72)',
  accent: '#a78bfa',
  accentStrong: '#7c3aed',
  border: 'rgba(167, 139, 250, 0.2)',
  borderHover: 'rgba(167, 139, 250, 0.4)',
  text: '#f1f5f9',
  textMuted: 'rgba(241, 245, 249, 0.78)',
  textDim: 'rgba(241, 245, 249, 0.55)',
  hoverBg: 'rgba(167, 139, 250, 0.08)',
  selectedBg: 'rgba(167, 139, 250, 0.16)',
};

// ─────────────────────────────────────────────────────────
// Sidebar-struktur
// ─────────────────────────────────────────────────────────

type WorkspaceItemId =
  // Hoved-nav
  | 'overview'
  | 'inbox'
  | 'cases'
  | 'projects'
  | 'documents'
  | 'tasks'
  | 'calendar'
  | 'files'
  | 'teamchat'
  | 'automations'
  // Teamspaces
  | 'ledelse'
  | 'kundeprosjekt'
  | 'markedsforing'
  | 'produkt'
  | 'hr'
  // Innstillinger
  | 'settings'
  // Sub-items mountet i Teamspaces / Overview
  | 'business-plan'
  | 'funding'
  | 'investors'
  | 'partners'
  | 'industry-crm'
  | 'content-marketing'
  | 'marketing-cockpit'
  | 'operating-system'
  | 'role-room-agent'
  | 'content-calendar'
  | 'role-room-economy'
  | 'newsletter-studio'
  | 'ai-citation'
  | 'whats-new'
  | 'activity'
  | 'migrations';

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
// Notifications inbox API (samme endepunkt som BellInbox/CRM)
// ─────────────────────────────────────────────────────────

interface InboxNotification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  created_at?: string;
  type?: string;
  seen?: boolean;
}

async function fetchNotifications(): Promise<InboxNotification[]> {
  try {
    const token =
      localStorage.getItem('creatorhub_auth_token') ||
      localStorage.getItem('authToken') ||
      '';
    const r = await fetch('/api/notifications/inbox', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return [];
    const data = await r.json();
    if (Array.isArray(data)) return data as InboxNotification[];
    if (Array.isArray(data?.items)) return data.items as InboxNotification[];
    return [];
  } catch {
    return [];
  }
}

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
// Empty-state komponent
// ─────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  todo?: string;
}

function EmptyState({ title, description, icon, todo }: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{
        py: 8,
        px: 4,
        textAlign: 'center',
        borderRadius: 3,
        bgcolor: BRAND.panelBg,
        border: `1px solid ${BRAND.border}`,
        minHeight: 360,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(167, 139, 250, 0.12)',
          color: BRAND.accent,
          '& svg': { fontSize: 32 },
        }}
      >
        {icon ?? <ConstructionOutlinedIcon />}
      </Box>
      <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '1.1rem' }}>
        {title}
      </Typography>
      <Typography sx={{ color: BRAND.textMuted, maxWidth: 480, lineHeight: 1.6 }}>
        {description}
      </Typography>
      <Chip
        label="Kommer snart — under utvikling"
        sx={{
          mt: 1,
          bgcolor: 'rgba(167, 139, 250, 0.16)',
          color: '#ddd6fe',
          fontWeight: 700,
          border: `1px solid ${BRAND.border}`,
        }}
      />
      {todo ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.75rem', mt: 1 }}>
          TODO: {todo}
        </Typography>
      ) : null}
    </Stack>
  );
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
          { id: 'projects', label: 'Prosjekter', icon: <FolderOpenOutlinedIcon /> },
          { id: 'documents', label: 'Dokumenter', icon: <DescriptionOutlinedIcon /> },
          { id: 'tasks', label: 'Oppgaver', icon: <TaskAltOutlinedIcon /> },
          { id: 'calendar', label: 'Kalender', icon: <EventOutlinedIcon /> },
          { id: 'files', label: 'Filer', icon: <InsertDriveFileOutlinedIcon /> },
          { id: 'teamchat', label: 'Teamchat', icon: <ChatBubbleOutlineOutlinedIcon /> },
          { id: 'automations', label: 'Automatiseringer', icon: <AutoFixHighOutlinedIcon /> },
        ],
      },
      {
        id: 'teamspaces',
        label: 'Teamspaces',
        items: [
          { id: 'ledelse', label: 'Ledelse', icon: <BusinessCenterOutlinedIcon /> },
          { id: 'kundeprosjekt', label: 'Kundeprosjekt', icon: <GroupsOutlinedIcon /> },
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
// ─────────────────────────────────────────────────────────

function TeamchatPanel() {
  // Backend: /api/role-room/projects/:projectId/messages krever projectId,
  // og det finnes ikke et "team-wide" admin-chat-endepunkt. Vi viser empty-
  // state med write-feltet låst, og lister TODO.
  const [message, setMessage] = useState('');

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
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${BRAND.border}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <ChatBubbleOutlineOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
            Teamchat
          </Typography>
        </Stack>
        <Chip
          label="Solo"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.66rem',
            bgcolor: 'rgba(167, 139, 250, 0.16)',
            color: '#ddd6fe',
          }}
        />
      </Stack>

      <Box sx={{ flex: 1, px: 2, py: 2, overflowY: 'auto' }}>
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{
            py: 6,
            px: 2,
            textAlign: 'center',
            color: BRAND.textMuted,
          }}
        >
          <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 36, color: BRAND.accent, opacity: 0.6 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 600, fontSize: '0.92rem' }}>
            Ingen team ennå
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
            Workspace-bred teamchat krever et felles rom-endepunkt — i dag er
            <code style={{ color: BRAND.accent, margin: '0 4px' }}>/api/role-room/projects/:projectId/messages</code>
            scoped per prosjekt.
          </Typography>
        </Stack>
        {/* TODO: koble på workspace-bred chat (eget endepunkt eller pinned
            project messages) før dette panelet viser ekte tråder. */}
      </Box>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 1.5,
          py: 1.25,
          borderTop: `1px solid ${BRAND.border}`,
          bgcolor: 'rgba(11,5,24,0.5)',
        }}
      >
        <InputBase
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Skriv en melding…"
          disabled
          sx={{
            flex: 1,
            color: BRAND.text,
            fontSize: '0.84rem',
            bgcolor: 'rgba(167, 139, 250, 0.06)',
            border: `1px solid ${BRAND.border}`,
            borderRadius: 1.5,
            px: 1,
            py: 0.5,
          }}
        />
        <IconButton size="small" disabled sx={{ color: BRAND.accent }}>
          <SendOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Varsler / Agenda-panel (høyre kolonne 2)
// ─────────────────────────────────────────────────────────

function NotificationsAgendaPanel({
  notifications,
  notificationsLoading,
}: {
  notifications: InboxNotification[];
  notificationsLoading: boolean;
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
                {n.message || n.body ? (
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
                    {n.message ?? n.body}
                  </Typography>
                ) : null}
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ borderColor: BRAND.border }} />

      {/* Dagens agenda */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <ScheduleOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.86rem' }}>
            Dagens agenda
          </Typography>
        </Stack>
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
          Ingen møter i dag.
        </Typography>
        {/* TODO: aggregér fra /api/role-room/projects/:projectId/meetings
            på tvers av prosjekter når et user-wide endepunkt er på plass. */}
      </Box>

      <Divider sx={{ borderColor: BRAND.border }} />

      {/* Kommende frister */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <EventAvailableOutlinedIcon sx={{ color: BRAND.accent, fontSize: 18 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.86rem' }}>
            Kommende frister
          </Typography>
        </Stack>
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
          Ingen frister kommer opp.
        </Typography>
        {/* TODO: aggregér IN/EU-søknadsfrister (funding-apps) + showcase
            deadline-feed + talent-milestones når et felles endepunkt er
            tilgjengelig. */}
      </Box>

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
}: {
  notifications: InboxNotification[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress sx={{ color: BRAND.accent }} />
      </Stack>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Tom innboks"
        description="Du har ingen uleste varsler. Når noe trenger oppmerksomhet — fra leads, søknader, prosjekter eller systemvarsler — havner det her."
        icon={<InboxOutlinedIcon />}
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
              {n.message || n.body ? (
                <Typography sx={{ color: BRAND.textMuted, fontSize: '0.84rem', mt: 0.5, lineHeight: 1.5 }}>
                  {n.message ?? n.body}
                </Typography>
              ) : null}
              {n.created_at ? (
                <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem', mt: 0.75 }}>
                  {new Date(n.created_at).toLocaleString('nb-NO')}
                </Typography>
              ) : null}
            </Box>
            {n.seen === false ? (
              <Chip
                label="Ny"
                size="small"
                sx={{
                  bgcolor: BRAND.accentStrong,
                  color: '#fff',
                  fontWeight: 700,
                  height: 22,
                }}
              />
            ) : null}
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

function resolveContent(
  selected: WorkspaceItemId,
  product: AdminProductId,
  notifications: InboxNotification[],
  notificationsLoading: boolean,
  onJumpTo: (id: WorkspaceItemId) => void,
): ResolvedContent {
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
        statusChip:
          notifications.length > 0
            ? { label: `${notifications.length} uleste`, color: BRAND.accentStrong }
            : { label: 'Alt klart', color: '#22c55e' },
        render: () => (
          <InboxView notifications={notifications} loading={notificationsLoading} />
        ),
      };
    case 'cases':
      return {
        title: 'Saker',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Saker'],
        render: () => (
          <EmptyState
            title="Saker"
            description="Strukturert sak-håndtering (kontrakt, support-tickets, klage-saker) er ikke implementert ennå. Når det kommer, samles alle sak-typene her med eier, status og SLA."
            icon={<GavelOutlinedIcon />}
            todo="Velg datamodell (cases-tabell) + RBAC + SLA-felt før første visning."
          />
        ),
      };
    case 'projects':
      return {
        title: 'Prosjekter',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Prosjekter'],
        render: () => (
          <EmptyState
            title="Prosjekter"
            description="Workspace-bred prosjekt-oversikt på tvers av kundeprosjekter er ikke koblet på ennå. Bruk Creative Sync Workspace (i Role Room) for prosjekt-detaljer i mellomtiden."
            icon={<FolderOpenOutlinedIcon />}
            todo="Aggregér casting_projects + showcase_galleries + role_room_projects til én feed."
          />
        ),
      };
    case 'documents':
      return {
        title: 'Dokumenter',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Dokumenter'],
        render: () => (
          <EmptyState
            title="Dokumenter"
            description="Sentralt dokument-bibliotek (kontrakter, briefer, notater) er ikke koblet på ennå."
            icon={<DescriptionOutlinedIcon />}
            todo="Koble på vendor_documents + contracts + role_room_briefs til én bibliotek-visning."
          />
        ),
      };
    case 'tasks':
      return {
        title: 'Oppgaver',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Oppgaver'],
        render: () => (
          <EmptyState
            title="Oppgaver"
            description="Workspace-bred oppgave-feed er ikke implementert ennå. CRM-task-inbox finnes per kunde."
            icon={<TaskAltOutlinedIcon />}
            todo="Aggregér crm_tasks + role_room_tasks + leadgrid_tasks i én feed."
          />
        ),
      };
    case 'calendar':
      return {
        title: 'Kalender',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Kalender'],
        render: () => (
          <EmptyState
            title="Kalender"
            description="Workspace-bred kalender (møter + frister + opptaksdager) er ikke implementert ennå. Bruk Google Calendar via integrasjons-fane i mellomtiden."
            icon={<EventOutlinedIcon />}
            todo="Aggregér role_room_meetings + funding_apps.deadline + showcase deadline-feed."
          />
        ),
      };
    case 'files':
      return {
        title: 'Filer',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Filer'],
        render: () => (
          <EmptyState
            title="Filer"
            description="Workspace-bredt fil-bibliotek (B2-arkiv på tvers av prosjekter) er ikke implementert ennå."
            icon={<InsertDriveFileOutlinedIcon />}
            todo="Koble på B2-bucket-lister + showcase-galleri-filer."
          />
        ),
      };
    case 'teamchat':
      return {
        title: 'Teamchat',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Teamchat'],
        render: () => (
          <EmptyState
            title="Teamchat"
            description="Workspace-bred chat-kanal er ikke implementert ennå. Per-prosjekt-chat finnes i Creative Sync Workspace."
            icon={<ChatBubbleOutlineOutlinedIcon />}
            todo="Bygg et workspace-level chat-room (eget endepunkt utenfor projects)."
          />
        ),
      };
    case 'automations':
      return {
        title: 'Automatiseringer',
        breadcrumbs: ['Creatorhub AS', 'Workspace', 'Automatiseringer'],
        render: () => (
          <EmptyState
            title="Automatiseringer"
            description="Sentralisert automatisering-builder (trigger → handling) er ikke implementert ennå. I dag administreres cron-jobs via GitHub Actions og Render."
            icon={<AutoFixHighOutlinedIcon />}
            todo="Vurder n8n-style builder eller bare lese-skjerm fra eksisterende cron-config."
          />
        ),
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
        render: () => (
          <EmptyState
            title="Kundeprosjekt"
            description="Teamspace for kundeprosjekt er ikke koblet på workspace-laget ennå. Bruk Creative Sync Workspace (i Role Room) i mellomtiden."
            icon={<GroupsOutlinedIcon />}
            todo="Aggregér aktive role_room_projects til denne flaten."
          />
        ),
      };
    case 'markedsforing':
      return {
        title: 'Markedsføring',
        breadcrumbs: ['Creatorhub AS', 'Teamspaces', 'Markedsføring'],
        render: () => (
          <TeamspaceLanding
            label="Markedsføring"
            cards={[
              { id: 'marketing-cockpit', label: 'Marketing Cockpit' },
              { id: 'content-marketing', label: 'Content marketing' },
              { id: 'content-calendar', label: 'Content-kalender' },
              { id: 'newsletter-studio', label: 'Newsletter Studio' },
              { id: 'ai-citation', label: 'GEO-effekt' },
              { id: 'industry-crm', label: 'Tier-1 outreach' },
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
        render: () => (
          <EmptyState
            title="HR"
            description="HR-flaten er ikke implementert ennå. Vil samle teammedlemmer, kontrakter, kompensasjon og fravær når den kommer."
            icon={<PersonOutlineOutlinedIcon />}
            todo="Velg datamodell (team_members + comp + leave) eller integrer med ekstern HR-løsning."
          />
        ),
      };
    case 'settings':
      return {
        title: 'Innstillinger',
        breadcrumbs: ['Creatorhub AS', 'Innstillinger'],
        render: () => (
          <EmptyState
            title="Innstillinger"
            description="Workspace-innstillinger (org-profil, brand, integrasjoner, varsler) er ikke implementert ennå. Innstillinger administreres per modul i mellomtiden."
            icon={<SettingsOutlinedIcon />}
            todo="Bygg gruppert settings-flate som peker til eksisterende modul-innstillinger."
          />
        ),
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
}: {
  resolved: ResolvedContent;
  contentTab: number;
  onContentTabChange: (next: number) => void;
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
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(167, 139, 250, 0.06)',
              border: `1px solid ${BRAND.border}`,
              minWidth: 180,
              display: { xs: 'none', md: 'flex' },
            }}
          >
            <SearchOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 16 }} />
            <InputBase
              placeholder="Søk i workspace…"
              disabled
              sx={{
                flex: 1,
                color: BRAND.text,
                fontSize: '0.8rem',
                '& input::placeholder': { color: BRAND.textDim, opacity: 1 },
              }}
            />
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
  const [selected, setSelected] = useState<WorkspaceItemId>(() => {
    if (typeof window === 'undefined') return 'overview';
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('view');
      if (fromUrl) return fromUrl as WorkspaceItemId;
    } catch {
      /* ignore */
    }
    return 'overview';
  });
  const [product, setProduct] = useState<AdminProductId>(() => {
    if (typeof window === 'undefined') return 'roleroom';
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('product');
      if (fromUrl === 'leadgrid') return 'leadgrid';
    } catch {
      /* ignore */
    }
    return 'roleroom';
  });
  const [contentTab, setContentTab] = useState(0);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

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

  // Last varsler ved mount + poll hvert 60s
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      const items = await fetchNotifications();
      if (!cancelled) {
        setNotifications(items);
        setNotificationsLoading(false);
      }
    };
    void load();
    timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
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

  const handleSelect = useCallback((id: WorkspaceItemId) => {
    setSelected(id);
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

  const resolved = resolveContent(
    selected,
    product,
    notifications,
    notificationsLoading,
    handleSelect,
  );
  const inboxBadge = notifications.length;

  return (
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
          onProductChange={setProduct}
        />
      ) : null}

      {/* Hovedinnhold */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          resolved={resolved}
          contentTab={contentTab}
          onContentTabChange={setContentTab}
        />
        <Box sx={{ flex: 1, px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 } }}>
          {resolved.render(contentTab)}
        </Box>
      </Box>

      {/* Høyre kolonner (skjules på tablet+mobil) */}
      {!isTablet ? <TeamchatPanel /> : null}
      {!isTablet ? (
        <NotificationsAgendaPanel
          notifications={notifications}
          notificationsLoading={notificationsLoading}
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
    </Box>
  );
}
