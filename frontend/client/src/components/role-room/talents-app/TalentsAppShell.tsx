/**
 * TalentsAppShell.tsx — sidebar + topbar + content-slot.
 *
 * Matchet mot mockup #11 (Partners & Collaboration) sidebar-spec:
 *   8 menu-items (Dashboard, Talent Registry, Profiles, Self-Tapes,
 *   Auditions, Partners & Collaboration, Permissions, Settings) +
 *   help-card + language-dropdown + copyright.
 *
 * Topbar har global søk + bell + user-chip.
 */

import {
  Avatar,
  Box,
  Button,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LanguageIcon from '@mui/icons-material/Language';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupIcon from '@mui/icons-material/Group';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import TalentsLogo from './TalentsLogo';
import { palette, radius } from './theme';

export type TalentsAppPage =
  | 'dashboard'
  | 'registry'
  | 'profiles'
  | 'selftapes'
  | 'auditions'
  | 'partners'
  | 'permissions'
  | 'settings';

interface TalentsAppShellProps {
  active: TalentsAppPage;
  onNavigate: (page: TalentsAppPage) => void;
  searchPlaceholder?: string;
  user?: { name: string; role: string; avatarUrl?: string };
  children: React.ReactNode;
}

const MENU: Array<{ id: TalentsAppPage; label: string; Icon: React.ComponentType }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'registry', label: 'Talent Registry', Icon: GroupIcon },
  { id: 'profiles', label: 'Profiles', Icon: PersonOutlineIcon },
  { id: 'selftapes', label: 'Self-Tapes', Icon: PlayCircleOutlineIcon },
  { id: 'auditions', label: 'Auditions', Icon: EventNoteIcon },
  { id: 'partners', label: 'Partners & Collaboration', Icon: HandshakeOutlinedIcon },
  { id: 'permissions', label: 'Permissions', Icon: LockOutlinedIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsOutlinedIcon },
];

const SIDEBAR_W = 252;

export default function TalentsAppShell({
  active,
  onNavigate,
  searchPlaceholder = 'Search talents, roles, partners…',
  user = { name: 'Ingrid Nilsen', role: 'Talent' },
  children,
}: TalentsAppShellProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: palette.bgRoot,
        color: palette.textPrimary,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ─── SIDEBAR ─── */}
      <Box
        component="aside"
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          bgcolor: palette.bgShell,
          borderRight: `1px solid ${palette.borderSubtle}`,
          display: 'flex',
          flexDirection: 'column',
          // Subtle filmstrip-perforert kant (matcher mockupens venstre-bar)
          backgroundImage: `linear-gradient(180deg, ${palette.bgShell} 0%, ${palette.bgRoot} 100%)`,
        }}
      >
        {/* Logo */}
        <Box sx={{ p: 2.4, pb: 2 }}>
          <TalentsLogo variant="large" />
        </Box>

        {/* Meny */}
        <Stack component="nav" spacing={0.4} sx={{ px: 1.2, flexGrow: 1 }}>
          {MENU.map(({ id, label, Icon }) => {
            const isActive = active === id;
            return (
              <Button
                key={id}
                onClick={() => onNavigate(id)}
                startIcon={<Icon />}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  py: 1.1,
                  pl: 1.4,
                  pr: 1.4,
                  borderRadius: radius.sm,
                  color: isActive ? palette.textPrimary : palette.textMuted,
                  bgcolor: isActive ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? palette.accent : 'transparent'}`,
                  letterSpacing: '0.005em',
                  '& .MuiButton-startIcon': {
                    color: isActive ? palette.accentBright : palette.textMuted,
                    mr: 1.4,
                  },
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(168, 85, 247, 0.22)' : 'rgba(168, 85, 247, 0.06)',
                    color: palette.textPrimary,
                  },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Stack>

        {/* Help-card */}
        <Box sx={{ px: 1.4, py: 1.4 }}>
          <Box
            sx={{
              p: 1.6,
              borderRadius: radius.md,
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.border}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.85rem' }}>
              Need help?
            </Typography>
            <Typography
              sx={{ color: palette.textMuted, fontSize: '0.75rem', mt: 0.3, lineHeight: 1.4 }}
            >
              Visit our Help Center for guides and tips.
            </Typography>
            <Button
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              sx={{
                mt: 1.2,
                width: '100%',
                bgcolor: 'rgba(168, 85, 247, 0.12)',
                color: palette.textPrimary,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderRadius: radius.sm,
                border: `1px solid ${palette.borderStrong}`,
                '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.22)' },
              }}
            >
              Go to Help Center
            </Button>
          </Box>
        </Box>

        {/* Language */}
        <Box sx={{ px: 1.4, pb: 1 }}>
          <Select
            value="en-NO"
            size="small"
            startAdornment={<LanguageIcon sx={{ color: palette.textMuted, mr: 0.8, fontSize: 18 }} />}
            sx={{
              width: '100%',
              color: palette.textPrimary,
              fontSize: '0.82rem',
              bgcolor: palette.bgCard,
              borderRadius: radius.sm,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderSubtle },
              '& .MuiSvgIcon-root.MuiSelect-icon': { color: palette.textMuted },
            }}
          >
            <MenuItem value="en-NO">English (NO)</MenuItem>
            <MenuItem value="nb-NO">Norsk (bokmål)</MenuItem>
          </Select>
        </Box>

        {/* Footer */}
        <Typography
          sx={{
            color: palette.textMuted,
            fontSize: '0.7rem',
            textAlign: 'center',
            pb: 1.4,
            opacity: 0.7,
          }}
        >
          © The Role Room Talents 2024
        </Typography>
      </Box>

      {/* ─── MAIN ─── */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <Box
          component="header"
          sx={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 3,
            borderBottom: `1px solid ${palette.borderSubtle}`,
            bgcolor: palette.bgRoot,
          }}
        >
          <Box
            sx={{
              flexGrow: 1,
              maxWidth: 720,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.8,
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: radius.pill,
            }}
          >
            <SearchIcon sx={{ color: palette.textMuted, fontSize: 18 }} />
            <InputBase
              placeholder={searchPlaceholder}
              sx={{ flexGrow: 1, color: palette.textPrimary, fontSize: '0.88rem' }}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <IconButton sx={{ color: palette.textMuted }}>
            <NotificationsNoneIcon />
          </IconButton>

          <Stack
            direction="row"
            alignItems="center"
            spacing={1.2}
            sx={{
              pl: 1,
              pr: 1.4,
              py: 0.6,
              borderRadius: radius.pill,
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              cursor: 'pointer',
              '&:hover': { borderColor: palette.borderStrong },
            }}
          >
            <Avatar
              src={user.avatarUrl}
              sx={{ width: 32, height: 32, bgcolor: palette.accentMuted }}
            >
              {user.name.slice(0, 1)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{ color: palette.textPrimary, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.1 }}
              >
                {user.name}
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>
                {user.role}
              </Typography>
            </Box>
            <KeyboardArrowDownIcon sx={{ color: palette.textMuted, fontSize: 18 }} />
          </Stack>
        </Box>

        {/* Page content */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  );
}
