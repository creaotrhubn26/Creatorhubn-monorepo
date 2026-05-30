/**
 * PartnersCollaborationPage.tsx
 *
 * Pixel-implementasjon av Daniels mockup #11. Sjekkliste i MOCKUP_SPEC.md.
 *
 * 10 regioner: page header → 4 stat-kort → tabs/search → partner-table +
 * permissions-matrix (split) → right-sidebar med valgt partner-detalj →
 * Collaboration Feed (bunn).
 *
 * Data er på MVP-nivå hardcoded for å matche mockup-tallene eksakt
 * (18 partners, 6 pools, 3 pending, 100%). Steg 2: erstatt med live
 * data fra /api/role-room/agencies + /api/role-room/talents/me/consents
 * + /api/role-room/talents/me/access-audit.
 */

import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupIcon from '@mui/icons-material/Group';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ShieldIcon from '@mui/icons-material/Shield';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useMemo, useState } from 'react';

import { palette, radius } from '../theme';

// ──────────────────────────────────────────────────────────────────
// Data (matchet mot mockup EKSAKT — disse 5 partnerne, disse tallene)
// ──────────────────────────────────────────────────────────────────

type AccessKind = 'full' | 'limited' | 'custom' | 'view_only';
type PartnerRole = 'Casting Partner' | 'Professional Center';

interface Partner {
  id: string;
  initials: string;
  avatarColor: string;
  name: string;
  location: string;
  role: PartnerRole;
  access: AccessKind;
  lastActivity: string;
  perms: { profiles: boolean; selftapes: boolean; workshops: boolean; auditions: boolean };
  contact: { location: string; email: string; phone: string; website: string };
  visibility: {
    accessLevel: string;
    dataResidency: string;
    profiles: string;
    selftapes: string;
    auditionInvites: string;
    workshops: string;
  };
}

const PARTNERS: Partner[] = [
  {
    id: 'NL',
    initials: 'NL',
    avatarColor: '#a855f7',
    name: 'Northern Lights Casting',
    location: 'Oslo, Norway',
    role: 'Casting Partner',
    access: 'full',
    lastActivity: 'Today, 10:24',
    perms: { profiles: true, selftapes: true, workshops: true, auditions: true },
    contact: {
      location: 'Oslo, Norway',
      email: 'contact@northernlights.no',
      phone: '+47 22 33 44 55',
      website: 'northernlights.no',
    },
    visibility: {
      accessLevel: 'Full Access',
      dataResidency: 'EU/EEA',
      profiles: 'All profiles',
      selftapes: 'All self-tapes',
      auditionInvites: 'View & Send',
      workshops: 'View only',
    },
  },
  {
    id: 'SC',
    initials: 'SC',
    avatarColor: '#ec4899',
    name: 'Stella Casting',
    location: 'Copenhagen, Denmark',
    role: 'Casting Partner',
    access: 'limited',
    lastActivity: 'Yesterday, 16:45',
    perms: { profiles: true, selftapes: true, workshops: false, auditions: true },
    contact: {
      location: 'Copenhagen, Denmark',
      email: 'info@stellacasting.dk',
      phone: '+45 33 22 11 00',
      website: 'stellacasting.dk',
    },
    visibility: {
      accessLevel: 'Limited Access',
      dataResidency: 'EU/EEA',
      profiles: 'Featured only',
      selftapes: 'Requested only',
      auditionInvites: 'View only',
      workshops: 'No access',
    },
  },
  {
    id: 'NS',
    initials: 'NS',
    avatarColor: '#8b5cf6',
    name: 'Nordic Skuespillersenter',
    location: 'Oslo, Norway',
    role: 'Professional Center',
    access: 'custom',
    lastActivity: 'May 18, 2024',
    perms: { profiles: true, selftapes: true, workshops: false, auditions: false },
    contact: {
      location: 'Oslo, Norway',
      email: 'post@skuespillersenter.no',
      phone: '+47 23 00 00 00',
      website: 'skuespillersenter.no',
    },
    visibility: {
      accessLevel: 'Custom Access',
      dataResidency: 'EU/EEA',
      profiles: 'All profiles',
      selftapes: 'All self-tapes',
      auditionInvites: 'View only',
      workshops: 'No access',
    },
  },
  {
    id: 'BF',
    initials: 'BF',
    avatarColor: '#f59e0b',
    name: 'Bergen Film Academy',
    location: 'Bergen, Norway',
    role: 'Professional Center',
    access: 'limited',
    lastActivity: 'May 17, 2024',
    perms: { profiles: true, selftapes: false, workshops: true, auditions: false },
    contact: {
      location: 'Bergen, Norway',
      email: 'hello@bergenfilmacademy.no',
      phone: '+47 55 00 00 00',
      website: 'bergenfilmacademy.no',
    },
    visibility: {
      accessLevel: 'Limited Access',
      dataResidency: 'EU/EEA',
      profiles: 'Featured only',
      selftapes: 'No access',
      auditionInvites: 'No access',
      workshops: 'View & Enroll',
    },
  },
  {
    id: 'DR',
    initials: 'DR',
    avatarColor: '#10b981',
    name: 'Dramatikkens Hus',
    location: 'Oslo, Norway',
    role: 'Professional Center',
    access: 'view_only',
    lastActivity: 'May 15, 2024',
    perms: { profiles: true, selftapes: false, workshops: false, auditions: false },
    contact: {
      location: 'Oslo, Norway',
      email: 'post@dramatikkenshus.no',
      phone: '+47 22 00 00 00',
      website: 'dramatikkenshus.no',
    },
    visibility: {
      accessLevel: 'View Only',
      dataResidency: 'EU/EEA',
      profiles: 'Featured only',
      selftapes: 'No access',
      auditionInvites: 'No access',
      workshops: 'View only',
    },
  },
];

interface FeedItem {
  id: string;
  initials?: string;
  avatarColor?: string;
  icon?: 'package';
  text: React.ReactNode;
  timestamp: string;
  badge?: 'pending';
}

const FEED: FeedItem[] = [
  {
    id: 'f1',
    initials: 'NL',
    avatarColor: '#a855f7',
    text: (
      <>
        <strong>Northern Lights Casting</strong> viewed 12 new profiles from the Oslo Pool.
      </>
    ),
    timestamp: '10 minutes ago',
  },
  {
    id: 'f2',
    initials: 'SC',
    avatarColor: '#ec4899',
    text: (
      <>
        <strong>Stella Casting</strong> requested access to <em>Self-Tapes</em> library.
      </>
    ),
    timestamp: '2 hours ago',
    badge: 'pending',
  },
  {
    id: 'f3',
    initials: 'NS',
    avatarColor: '#8b5cf6',
    text: (
      <>
        <strong>Nordic Skuespillersenter</strong> shared Workshop: <em>Scene Study Masterclass</em>.
      </>
    ),
    timestamp: 'Yesterday, 11:32',
  },
  {
    id: 'f4',
    initials: 'BF',
    avatarColor: '#f59e0b',
    text: (
      <>
        <strong>Bergen Film Academy</strong> downloaded 5 self-tapes from your shared pool.
      </>
    ),
    timestamp: 'May 19, 14:08',
  },
  {
    id: 'f5',
    icon: 'package',
    text: (
      <>
        <strong>You</strong> updated access permissions for <em>Stella Casting</em>.
      </>
    ),
    timestamp: 'May 18, 09:41',
  },
];

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function accessChip(access: AccessKind) {
  const map: Record<AccessKind, { label: string; bg: string; fg: string; Icon: React.ComponentType<{ sx?: object }> }> = {
    full:      { label: 'Full Access',   bg: 'rgba(34, 197, 94, 0.16)',  fg: '#4ade80', Icon: CheckCircleIcon },
    limited:   { label: 'Limited Access', bg: 'rgba(245, 158, 11, 0.16)', fg: '#fbbf24', Icon: HourglassEmptyIcon },
    custom:    { label: 'Custom Access',  bg: 'rgba(168, 85, 247, 0.16)', fg: '#c084fc', Icon: ShieldIcon },
    view_only: { label: 'View Only',      bg: 'rgba(56, 189, 248, 0.16)', fg: '#7dd3fc', Icon: VisibilityOutlinedIcon },
  };
  const { label, bg, fg, Icon } = map[access];
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Icon sx={{ color: fg, fontSize: 16 }} />
      <Typography sx={{ color: fg, fontSize: '0.82rem', fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );
}

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

export default function PartnersCollaborationPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedId, setSelectedId] = useState<string>('NL');
  const selected = useMemo(() => PARTNERS.find((p) => p.id === selectedId)!, [selectedId]);

  return (
    <Box sx={{ display: 'flex', minWidth: 0 }}>
      {/* Hovedinnhold (uten right-sidebar) */}
      <Box sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
        {/* ─── Page header ─── */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15 }}>
              Partners &amp; Collaboration
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 0.6, maxWidth: 720 }}>
              Collaborate securely with casting partners and professional centers. Share talent,
              resources, and opportunities.
            </Typography>
          </Box>
          <Button
            startIcon={<PersonAddAltOutlinedIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              px: 2.4,
              py: 1.1,
              borderRadius: radius.sm,
              background: palette.accentGradient,
              color: '#fff',
              '&:hover': { filter: 'brightness(1.08)' },
              boxShadow: '0 8px 24px rgba(168, 85, 247, 0.28)',
            }}
          >
            Invite Partner
          </Button>
        </Stack>

        {/* ─── 4 stat-cards ─── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 2,
            mb: 3,
          }}
        >
          <StatCard label="Active Partners" value="18" desc="Partners with active access" Icon={GroupIcon} />
          <StatCard label="Shared Talent Pools" value="6" desc="Pools shared across partners" Icon={PeopleOutlineOutlinedIcon} />
          <StatCard label="Pending Requests" value="3" desc="Awaiting your approval" Icon={HourglassEmptyIcon} />
          <StatCard label="GDPR-Compliant Permissions" value="100%" desc="All data access is controlled" Icon={ShieldIcon} />
        </Box>

        {/* ─── Tabs + søk/filter ─── */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2, gap: 2 }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '0.92rem',
                fontWeight: 600,
                color: palette.textMuted,
                minHeight: 36,
                px: 1.6,
              },
              '& .Mui-selected': { color: `${palette.textPrimary} !important` },
              '& .MuiTabs-indicator': { backgroundColor: palette.accent, height: 2.5 },
            }}
          >
            <Tab label="All Partners" />
            <Tab label="Casting Partners" />
            <Tab label="Professional Centers" />
            <Tab label="Invitations" />
          </Tabs>
          <Stack direction="row" spacing={1.2}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.6,
                py: 0.7,
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: radius.sm,
                minWidth: 240,
              }}
            >
              <SearchIcon sx={{ color: palette.textMuted, fontSize: 18 }} />
              <InputBase placeholder="Search partners…" sx={{ flexGrow: 1, color: palette.textPrimary, fontSize: '0.85rem' }} />
            </Box>
            <Button
              startIcon={<TuneIcon />}
              endIcon={<ChevronRightIcon sx={{ transform: 'rotate(90deg)' }} />}
              sx={{
                textTransform: 'none',
                color: palette.textPrimary,
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: radius.sm,
                px: 1.6,
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Filters
            </Button>
          </Stack>
        </Stack>

        {/* ─── Partner-tabell + Permissions Matrix (split) ─── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 2,
            mb: 3,
          }}
        >
          {/* Partner-tabell */}
          <Box sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '36px 1.6fr 1fr 1fr 1fr 36px',
                gap: 1.2,
                px: 2,
                py: 1.4,
                borderBottom: `1px solid ${palette.borderSubtle}`,
                color: palette.textMuted,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <Box />
              <Box>Partner</Box>
              <Box>Role</Box>
              <Box>Access Level</Box>
              <Box>Last Activity</Box>
              <Box />
            </Box>
            {PARTNERS.map((p) => {
              const isSel = p.id === selectedId;
              return (
                <Box
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1.6fr 1fr 1fr 1fr 36px',
                    gap: 1.2,
                    px: 2,
                    py: 1.4,
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${palette.borderSubtle}`,
                    bgcolor: isSel ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                    transition: 'background 0.12s',
                    '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.05)' },
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: `2px solid ${isSel ? palette.accent : palette.borderStrong}`,
                      bgcolor: isSel ? palette.accent : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSel ? (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fff' }} />
                    ) : null}
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1.4}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: `${p.avatarColor}28`,
                        color: p.avatarColor,
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        border: `1px solid ${p.avatarColor}44`,
                      }}
                    >
                      {p.initials}
                    </Avatar>
                    <Box>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem' }}>
                        {p.name}
                      </Typography>
                      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{p.location}</Typography>
                    </Box>
                  </Stack>
                  <Box>
                    <Chip
                      label={p.role}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(168, 85, 247, 0.12)',
                        color: palette.accentBright,
                        fontWeight: 600,
                        fontSize: '0.72rem',
                        height: 22,
                      }}
                    />
                  </Box>
                  <Box>{accessChip(p.access)}</Box>
                  <Stack direction="row" alignItems="center" spacing={0.7}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: palette.success }} />
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.83rem' }}>
                      {p.lastActivity}
                    </Typography>
                  </Stack>
                  <IconButton size="small" sx={{ color: palette.textMuted }}>
                    <MoreHorizIcon />
                  </IconButton>
                </Box>
              );
            })}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ px: 2, py: 1.6, borderTop: `1px solid ${palette.borderSubtle}` }}
            >
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                Showing 1–5 of 18 partners
              </Typography>
              <Stack direction="row" spacing={0.6}>
                <PageBtn><ChevronLeftIcon sx={{ fontSize: 16 }} /></PageBtn>
                <PageBtn active>1</PageBtn>
                <PageBtn>2</PageBtn>
                <PageBtn>3</PageBtn>
                <PageBtn>4</PageBtn>
                <PageBtn><ChevronRightIcon sx={{ fontSize: 16 }} /></PageBtn>
              </Stack>
            </Stack>
          </Box>

          {/* Permissions Matrix */}
          <Box sx={cardSx}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>
                Permissions Matrix
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 2 }}>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                What partners can view and access
              </Typography>
              <InfoOutlinedIcon sx={{ color: palette.textMuted, fontSize: 14 }} />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '60px repeat(4, 1fr)',
                gap: 0,
                rowGap: 1.2,
                alignItems: 'center',
              }}
            >
              <Box />
              <MatrixHeader Icon={PersonOutlineIcon} label="Profiles" />
              <MatrixHeader Icon={PlayCircleOutlineIcon} label="Self-Tapes" />
              <MatrixHeader Icon={SchoolOutlinedIcon} label="Workshops" />
              <MatrixHeader Icon={EventNoteOutlinedIcon} label="Auditions" />
              {PARTNERS.map((p) => (
                <>
                  <Avatar
                    key={`${p.id}-av`}
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: `${p.avatarColor}28`,
                      color: p.avatarColor,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: `1px solid ${p.avatarColor}44`,
                    }}
                  >
                    {p.initials}
                  </Avatar>
                  <MatrixCell key={`${p.id}-1`} on={p.perms.profiles} />
                  <MatrixCell key={`${p.id}-2`} on={p.perms.selftapes} />
                  <MatrixCell key={`${p.id}-3`} on={p.perms.workshops} />
                  <MatrixCell key={`${p.id}-4`} on={p.perms.auditions} />
                </>
              ))}
            </Box>
            <Box sx={{ mt: 2.4, pt: 1.6, borderTop: `1px solid ${palette.borderSubtle}` }}>
              <Button
                endIcon={<ChevronRightIcon />}
                sx={{
                  textTransform: 'none',
                  color: palette.accentBright,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  pl: 0,
                  '&:hover': { bgcolor: 'transparent', color: palette.accent },
                }}
              >
                Manage global permission presets
              </Button>
            </Box>
          </Box>
        </Box>

        {/* ─── Collaboration Feed ─── */}
        <Box sx={cardSx}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>
              Collaboration Feed
            </Typography>
            <Button
              sx={{
                textTransform: 'none',
                color: palette.accentBright,
                fontWeight: 600,
                fontSize: '0.85rem',
                '&:hover': { bgcolor: 'transparent', color: palette.accent },
              }}
            >
              View all activity
            </Button>
          </Stack>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 2 }}>
            Recent activity across your partner network
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 1.4,
            }}
          >
            {FEED.map((f) => (
              <FeedCard key={f.id} item={f} />
            ))}
          </Box>
        </Box>
      </Box>

      {/* ─── Right sidebar (selected partner detail) ─── */}
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          p: 3,
          pl: 0,
          display: { xs: 'none', lg: 'block' },
        }}
      >
        <SelectedPartnerSidebar partner={selected} />
      </Box>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  desc: string;
  Icon: React.ComponentType<{ sx?: object }>;
}

function StatCard({ label, value, desc, Icon }: StatCardProps) {
  return (
    <Box sx={cardSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 500, mb: 0.6 }}>
            {label}
          </Typography>
          <Typography sx={{ color: palette.textPrimary, fontSize: '2.2rem', fontWeight: 800, lineHeight: 1 }}>
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: radius.sm,
            bgcolor: 'rgba(168, 85, 247, 0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color: palette.accentBright, fontSize: 20 }} />
        </Box>
      </Stack>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 1.4 }}>{desc}</Typography>
    </Box>
  );
}

function MatrixHeader({ Icon, label }: { Icon: React.ComponentType<{ sx?: object }>; label: string }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="center">
      <Icon sx={{ color: palette.textMuted, fontSize: 16 }} />
      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );
}

function MatrixCell({ on }: { on: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {on ? (
        <CheckCircleIcon sx={{ color: palette.success, fontSize: 20 }} />
      ) : (
        <Box sx={{ width: 14, height: 2, bgcolor: palette.textMuted, opacity: 0.5, borderRadius: 1 }} />
      )}
    </Box>
  );
}

function PageBtn({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <Box
      sx={{
        minWidth: 28,
        height: 28,
        px: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.xs,
        bgcolor: active ? palette.accent : 'transparent',
        color: active ? '#fff' : palette.textMuted,
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
        '&:hover': { bgcolor: active ? palette.accent : 'rgba(168, 85, 247, 0.12)' },
      }}
    >
      {children}
    </Box>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: radius.md,
        bgcolor: palette.bgCardElevated,
        border: `1px solid ${palette.borderSubtle}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        {item.icon === 'package' ? (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              bgcolor: 'rgba(168, 85, 247, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <InventoryOutlinedIcon sx={{ color: palette.accentBright, fontSize: 18 }} />
          </Box>
        ) : (
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: `${item.avatarColor}28`,
              color: item.avatarColor,
              fontSize: '0.7rem',
              fontWeight: 700,
              border: `1px solid ${item.avatarColor}44`,
            }}
          >
            {item.initials}
          </Avatar>
        )}
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.8rem', lineHeight: 1.45 }}>
          {item.text}
        </Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: item.badge === 'pending' ? palette.warning : palette.success }} />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>{item.timestamp}</Typography>
        </Stack>
        {item.badge === 'pending' ? (
          <Chip
            label="Pending"
            size="small"
            sx={{
              bgcolor: 'rgba(245, 158, 11, 0.16)',
              color: palette.warning,
              fontWeight: 600,
              fontSize: '0.68rem',
              height: 18,
            }}
          />
        ) : null}
      </Stack>
    </Box>
  );
}

function SelectedPartnerSidebar({ partner }: { partner: Partner }) {
  return (
    <Box sx={{ ...cardSx, position: 'sticky', top: 16 }}>
      {/* Header */}
      <Stack direction="row" spacing={1.4} alignItems="center" sx={{ mb: 2 }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            bgcolor: `${partner.avatarColor}28`,
            color: partner.avatarColor,
            fontWeight: 700,
            fontSize: '1rem',
            border: `1px solid ${partner.avatarColor}44`,
          }}
        >
          {partner.initials}
        </Avatar>
        <Box>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>
            {partner.name}
          </Typography>
          <Chip
            label={partner.role}
            size="small"
            sx={{
              mt: 0.4,
              bgcolor: 'rgba(168, 85, 247, 0.12)',
              color: palette.accentBright,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>
      </Stack>

      {/* Kontakt */}
      <Stack spacing={1.2} sx={{ mb: 2.4 }}>
        <ContactRow Icon={LocationOnOutlinedIcon} text={partner.contact.location} />
        <ContactRow Icon={EmailOutlinedIcon} text={partner.contact.email} />
        <ContactRow Icon={PhoneOutlinedIcon} text={partner.contact.phone} />
        <ContactRow Icon={PublicIcon} text={partner.contact.website} />
      </Stack>

      {/* Visibility & Access */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
          Visibility &amp; Access
        </Typography>
        <Button
          sx={{
            textTransform: 'none',
            color: palette.accentBright,
            fontWeight: 600,
            fontSize: '0.78rem',
            minWidth: 'auto',
            p: 0,
            '&:hover': { bgcolor: 'transparent', color: palette.accent },
          }}
        >
          Edit
        </Button>
      </Stack>
      <Stack spacing={1.2} sx={{ mb: 2.4 }}>
        <VisRow Icon={ShieldIcon} label="Access Level" value={partner.visibility.accessLevel} highlight />
        <VisRow Icon={PublicIcon} label="Data Residency" value={partner.visibility.dataResidency} />
        <VisRow Icon={PersonOutlineIcon} label="Profiles" value={partner.visibility.profiles} />
        <VisRow Icon={PlayCircleOutlineIcon} label="Self-Tapes" value={partner.visibility.selftapes} />
        <VisRow Icon={EventNoteOutlinedIcon} label="Audition Invites" value={partner.visibility.auditionInvites} />
        <VisRow Icon={SchoolOutlinedIcon} label="Workshops" value={partner.visibility.workshops} />
      </Stack>

      {/* Action-knapper */}
      <Stack spacing={1}>
        <Button
          startIcon={<LockOutlinedIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            py: 1.2,
            borderRadius: radius.sm,
            background: palette.accentGradient,
            color: '#fff',
            '&:hover': { filter: 'brightness(1.08)' },
            boxShadow: '0 6px 18px rgba(168, 85, 247, 0.32)',
          }}
        >
          Edit Access
        </Button>
        <Button
          startIcon={<PersonAddAltOutlinedIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            py: 1.1,
            borderRadius: radius.sm,
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.08)' },
          }}
        >
          Send Invite
        </Button>
        <Button
          startIcon={<GroupIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            py: 1.1,
            borderRadius: radius.sm,
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.08)' },
          }}
        >
          View Shared Talents
        </Button>
      </Stack>
    </Box>
  );
}

function ContactRow({ Icon, text }: { Icon: React.ComponentType<{ sx?: object }>; text: string }) {
  return (
    <Stack direction="row" spacing={1.2} alignItems="center">
      <Icon sx={{ color: palette.textMuted, fontSize: 16 }} />
      <Typography sx={{ color: palette.textSecondary, fontSize: '0.85rem' }}>{text}</Typography>
    </Stack>
  );
}

function VisRow({
  Icon,
  label,
  value,
  highlight = false,
}: {
  Icon: React.ComponentType<{ sx?: object }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" spacing={1} alignItems="center">
        <Icon sx={{ color: palette.textMuted, fontSize: 15 }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem' }}>{label}</Typography>
      </Stack>
      <Typography
        sx={{
          color: highlight ? palette.accentBright : palette.textPrimary,
          fontSize: '0.82rem',
          fontWeight: highlight ? 700 : 500,
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
