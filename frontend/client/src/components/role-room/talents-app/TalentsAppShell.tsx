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

import * as React from 'react';
import {
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  InputBase,
  ListItemIcon,
  Menu,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LanguageIcon from '@mui/icons-material/Language';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import DashboardIcon from '@mui/icons-material/Home';
import GroupIcon from '@mui/icons-material/Group';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';

import TalentsLogo from './TalentsLogo';
import { palette, radius } from './theme';

export type TalentsAppPage =
  | 'dashboard'
  | 'registry'
  | 'profiles'
  | 'selftapes'
  | 'auditions'
  | 'partners'
  | 'partnerships'
  | 'audit'
  | 'permissions'
  | 'settings';

interface TalentsAppShellProps {
  active: TalentsAppPage;
  onNavigate: (page: TalentsAppPage) => void;
  searchPlaceholder?: string;
  user?: { name: string; role: string; avatarUrl?: string };
  /** Hvis null/undefined, vises ingen logout-meny — for demo-modus. */
  onLogout?: () => void;
  children: React.ReactNode;
}

// Markerer hvilke menypunkter som har fullt innhold. De andre er disabled
// med "Kommer snart"-tag (matcher Irlins forventning, ikke false promises).
const MENU: Array<{ id: TalentsAppPage; label: string; Icon: React.ComponentType; ready?: boolean }> = [
  { id: 'dashboard', label: 'Hjem', Icon: DashboardIcon, ready: true },
  { id: 'registry', label: 'Talent Registry', Icon: GroupIcon, ready: true },
  { id: 'profiles', label: 'Min profil', Icon: PersonOutlineIcon, ready: true },
  { id: 'partners', label: 'Partnere', Icon: HandshakeOutlinedIcon, ready: true },
  { id: 'partnerships', label: 'Partnerships', Icon: BusinessCenterOutlinedIcon, ready: true },
  { id: 'audit', label: 'Hvem har sett meg?', Icon: VisibilityIcon, ready: true },
  { id: 'selftapes', label: 'Self-Tapes', Icon: PlayCircleOutlineIcon },
  { id: 'auditions', label: 'Auditions', Icon: EventNoteIcon },
  { id: 'settings', label: 'Innstillinger', Icon: SettingsOutlinedIcon, ready: true },
];

const SIDEBAR_W = 240;

export default function TalentsAppShell({
  active,
  onNavigate,
  searchPlaceholder = 'Søk etter partnere, roller, auditions…',
  user = { name: 'Ingrid Nilsen', role: 'Talent' },
  onLogout,
  children,
}: TalentsAppShellProps) {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userChipRef = React.useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Wrap navigate slik at mobile-drawer lukkes etter valg
  const handleMobileNav = (page: TalentsAppPage) => {
    setMobileNavOpen(false);
    onNavigate(page);
  };
  const sidebarSx = {
    width: SIDEBAR_W,
    flexShrink: 0,
    bgcolor: palette.bgShell,
    borderRight: `1px solid ${palette.borderSubtle}`,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative' as const,
    backgroundImage: `linear-gradient(180deg, ${palette.bgShell} 0%, ${palette.bgRoot} 100%)`,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: '14px',
      backgroundImage: `repeating-linear-gradient(180deg, transparent 0, transparent 6px, ${palette.filmstrip} 6px, ${palette.filmstrip} 10px, transparent 10px, transparent 18px)`,
      pointerEvents: 'none',
    },
  };

  // Sidebar-innholdet — gjenbrukt mellom desktop (statisk) og mobile (Drawer)
  const sidebarContent = (forMobile: boolean) => {
    const onClick = forMobile ? handleMobileNav : onNavigate;
    return (
      <>
        {/* Logo */}
        <Box sx={{ p: 2.4, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <TalentsLogo variant="large" />
          {forMobile ? (
            <IconButton onClick={() => setMobileNavOpen(false)} sx={{ color: palette.textMuted }}>
              <CloseIcon />
            </IconButton>
          ) : null}
        </Box>

        {/* Meny */}
        <Stack component="nav" spacing={0.4} sx={{ px: 1.2, flexGrow: 1 }}>
          {MENU.map(({ id, label, Icon, ready }) => {
            const isActive = active === id;
            const isDisabled = !ready;
            return (
              <Button
                key={id}
                onClick={() => !isDisabled && onClick(id)}
                startIcon={<Icon />}
                disabled={isDisabled}
                sx={{
                  justifyContent: 'flex-start', textTransform: 'none',
                  fontWeight: isActive ? 700 : 500, fontSize: '0.9rem',
                  py: 1.1, pl: 1.4, pr: 1.4, borderRadius: radius.sm,
                  color: isActive ? palette.textPrimary : palette.textMuted,
                  bgcolor: isActive ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? palette.accent : 'transparent'}`,
                  letterSpacing: '0.005em', opacity: isDisabled ? 0.5 : 1,
                  '& .MuiButton-startIcon': { color: isActive ? palette.accentBright : palette.textMuted, mr: 1.4 },
                  '&:hover': isDisabled ? {} : { bgcolor: isActive ? 'rgba(168, 85, 247, 0.22)' : 'rgba(168, 85, 247, 0.06)', color: palette.textPrimary },
                  '&.Mui-disabled': { color: palette.textMuted },
                }}
              >
                <Box sx={{ flexGrow: 1, textAlign: 'left' }}>{label}</Box>
                {isDisabled ? (
                  <Box sx={{ ml: 0.6, px: 0.7, py: 0.1, bgcolor: 'rgba(168, 85, 247, 0.1)', borderRadius: radius.xs, color: palette.accentBright, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Snart
                  </Box>
                ) : null}
              </Button>
            );
          })}
        </Stack>

        <Box sx={{ px: 1.4, py: 1.4 }}>
          <Box sx={{ p: 1.6, borderRadius: radius.md, bgcolor: palette.bgCard, border: `1px solid ${palette.border}` }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.85rem' }}>Trenger du hjelp?</Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.75rem', mt: 0.3, lineHeight: 1.4 }}>
              Send oss en e-post — vi svarer innen 24 timer.
            </Typography>
            <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} href="mailto:support@theroleroom.com?subject=Talents-portalen"
              sx={{ mt: 1.2, width: '100%', bgcolor: 'rgba(168, 85, 247, 0.12)', color: palette.textPrimary, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: radius.sm, border: `1px solid ${palette.borderStrong}`, '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.22)' } }}>
              Kontakt support
            </Button>
          </Box>
        </Box>

        <Box sx={{ px: 1.4, pb: 1 }}>
          <Select value="en-NO" size="small" startAdornment={<LanguageIcon sx={{ color: palette.textMuted, mr: 0.8, fontSize: 18 }} />}
            sx={{ width: '100%', color: palette.textPrimary, fontSize: '0.82rem', bgcolor: palette.bgCard, borderRadius: radius.sm, '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderSubtle }, '& .MuiSvgIcon-root.MuiSelect-icon': { color: palette.textMuted } }}>
            <MenuItem value="en-NO">English (NO)</MenuItem>
            <MenuItem value="nb-NO">Norsk (bokmål)</MenuItem>
          </Select>
        </Box>

        <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem', textAlign: 'center', pb: 1.4, opacity: 0.7 }}>
          © The Role Room Talents {new Date().getFullYear()}
        </Typography>
      </>
    );
  };

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
      {/* ─── DESKTOP SIDEBAR (skjult på mobile) ─── */}
      <Box component="aside" sx={{ ...sidebarSx, display: { xs: 'none', md: 'flex' } }}>
        {sidebarContent(false)}
      </Box>

      {/* ─── MOBILE DRAWER (kun synlig på mobile, lukker etter nav) ─── */}
      <Drawer
        anchor="left"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        PaperProps={{ sx: { ...sidebarSx, display: 'flex' } }}
      >
        {sidebarContent(true)}
      </Drawer>

      {/* ─── MAIN ─── */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <Box
          component="header"
          sx={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, md: 2 },
            px: { xs: 1.5, md: 3 },
            borderBottom: `1px solid ${palette.borderSubtle}`,
            bgcolor: palette.bgRoot,
          }}
        >
          {/* Hamburger — kun mobile */}
          {isMobile ? (
            <IconButton onClick={() => setMobileNavOpen(true)} sx={{ color: palette.textPrimary }}>
              <MenuIcon />
            </IconButton>
          ) : null}

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
            ref={userChipRef}
            direction="row"
            alignItems="center"
            spacing={1.2}
            onClick={() => setUserMenuOpen(true)}
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
            <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
              <Typography
                sx={{ color: palette.textPrimary, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.1 }}
              >
                {user.name}
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>
                {user.role}
              </Typography>
            </Box>
            <KeyboardArrowDownIcon sx={{ color: palette.textMuted, fontSize: 18, display: { xs: 'none', sm: 'block' } }} />
          </Stack>
          <Menu
            open={userMenuOpen}
            anchorEl={userChipRef.current}
            onClose={() => setUserMenuOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.border}`,
                mt: 0.6,
                minWidth: 200,
              },
            }}
          >
            <MenuItem
              onClick={() => { setUserMenuOpen(false); onNavigate('profiles'); }}
              sx={{ color: palette.textPrimary, fontSize: '0.88rem' }}
            >
              <ListItemIcon><PersonOutlineIcon fontSize="small" sx={{ color: palette.textSecondary }} /></ListItemIcon>
              Min profil
            </MenuItem>
            <MenuItem
              onClick={() => { setUserMenuOpen(false); onNavigate('settings'); }}
              sx={{ color: palette.textPrimary, fontSize: '0.88rem' }}
            >
              <ListItemIcon><SettingsOutlinedIcon fontSize="small" sx={{ color: palette.textSecondary }} /></ListItemIcon>
              Innstillinger
            </MenuItem>
            {onLogout ? (
              <MenuItem
                onClick={() => { setUserMenuOpen(false); onLogout(); }}
                sx={{ color: '#f87171', fontSize: '0.88rem' }}
              >
                <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#f87171' }} /></ListItemIcon>
                Logg ut
              </MenuItem>
            ) : null}
          </Menu>
        </Box>

        {/* Page content */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  );
}
