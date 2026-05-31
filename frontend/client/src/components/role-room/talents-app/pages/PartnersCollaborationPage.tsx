/**
 * PartnersCollaborationPage.tsx
 *
 * Pixel-implementasjon av Daniels mockup #11. Sjekkliste i MOCKUP_SPEC.md.
 *
 * Phase 2 iterasjon 2 — alt e2e:
 *   - Data fra GET /talents/me/partners-overview (stats + partners + feed)
 *   - Permissions Matrix klikkbar → POST /me/consents/bulk-set
 *   - "Invite Partner"-knapp → POST /me/partner-invites + dialog med kopierbar
 *     accept-URL
 *   - Tab-filtrering (Casting Partners / Professional Centers)
 *   - "Edit Access" på right-sidebar → invite-eksisterende-partner-flow
 *
 * Tomt-tilstand: ny talent uten consents → 0/0/0 stats + tom partner-tabell
 * + "Inviter første partner"-prompt.
 */

import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
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
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type PartnerOverviewRow,
  type PartnersOverview,
  type FeedEvent,
  type RoleRoomPartnerInvite,
  type RoleRoomTalentConsentScope,
  type RoleRoomTalentPartnerType,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#a855f7', '#ec4899', '#8b5cf6', '#f59e0b', '#10b981', '#7dd3fc', '#fb7185'];
const colorForKey = (key: string) => AVATAR_COLORS[hashString(key) % AVATAR_COLORS.length];
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function formatRelative(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'akkurat nå';
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} timer siden`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'I går';
  if (days < 7) return `${days} dager siden`;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function accessChip(access: PartnerOverviewRow['access_level']) {
  const map: Record<PartnerOverviewRow['access_level'], { label: string; fg: string; Icon: React.ComponentType<{ sx?: object }> }> = {
    full:      { label: 'Full Access',    fg: '#4ade80', Icon: CheckCircleIcon },
    limited:   { label: 'Limited Access', fg: '#fbbf24', Icon: HourglassEmptyIcon },
    custom:    { label: 'Custom Access',  fg: '#c084fc', Icon: ShieldIcon },
    view_only: { label: 'View Only',      fg: '#7dd3fc', Icon: VisibilityOutlinedIcon },
  };
  const { label, fg, Icon } = map[access];
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<PartnersOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Demo-modus: ?demo=1 i URL → isolert demo-talent (read-only).
  // Forhindrer at hovedstrøm-data noensinne blandes med demo.
  const demoMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );

  const reload = useCallback(async () => {
    setError(null);
    const data = await roleRoomTalentsService.fetchPartnersOverview({ demo: demoMode });
    setOverview(data);
    setLoading(false);
    if (data.partners.length > 0 && !selectedId) {
      setSelectedId(data.partners[0].id);
    }
  }, [selectedId, demoMode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredPartners = useMemo(() => {
    const partners = overview?.partners ?? [];
    if (activeTab === 1) return partners.filter((p) => p.role_label === 'Casting Partner');
    if (activeTab === 2) return partners.filter((p) => p.role_label === 'Professional Center');
    if (activeTab === 3) return []; // Invitations-fanen håndteres separat — TODO
    return partners;
  }, [activeTab, overview?.partners]);

  const selected = useMemo(
    () => filteredPartners.find((p) => p.id === selectedId) ?? filteredPartners[0] ?? null,
    [filteredPartners, selectedId],
  );

  const handleTogglePerm = useCallback(
    async (row: PartnerOverviewRow, key: keyof PartnerOverviewRow['perms']) => {
      if (demoMode) {
        setSnack('Demo-modus er read-only — toggling er deaktivert');
        return;
      }
      const next = { ...row.perms, [key]: !row.perms[key] };
      setBusyRow(row.id);
      // Optimistisk oppdater
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              partners: prev.partners.map((p) => (p.id === row.id ? { ...p, perms: next } : p)),
            }
          : prev,
      );
      const result = await roleRoomTalentsService.bulkSetConsents({
        partner_type: row.partner_type,
        partner_ref: row.id,
        partner_display_name: row.display_name,
        perms: next,
      });
      setBusyRow(null);
      if ('error' in result) {
        setError(result.error);
        await reload();
      } else {
        setSnack(`Tillatelse oppdatert for ${row.display_name}`);
        await reload();
      }
    },
    [reload],
  );

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Henter partnere…</Typography>
      </Box>
    );
  }

  if (!overview?.talent) {
    return <NoProfileState onCreated={() => void reload()} />;
  }

  return (
    <Box sx={{ display: 'flex', minWidth: 0 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
        {demoMode ? (
          <Box
            sx={{
              mb: 2,
              px: 2,
              py: 1.2,
              borderRadius: radius.sm,
              background: 'linear-gradient(90deg, rgba(168,85,247,0.18), rgba(217,70,239,0.12))',
              border: `1px solid ${palette.borderStrong}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1.4,
            }}
          >
            <Chip
              label="DEMO MODE"
              size="small"
              sx={{ bgcolor: palette.accent, color: '#fff', fontWeight: 800, letterSpacing: '0.12em' }}
            />
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.85rem' }}>
              Du ser isolert demo-data (talent: Ingrid Nilsen). Ingen handlinger lagres. Fjern <code>?demo=1</code> fra URL for å se ekte data.
            </Typography>
          </Box>
        ) : null}

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
            onClick={() => {
              if (demoMode) {
                setSnack('Demo-modus er read-only — kan ikke invitere');
                return;
              }
              setInviteOpen(true);
            }}
            disabled={demoMode}
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
              '&.Mui-disabled': { opacity: 0.55, color: '#fff' },
            }}
          >
            Invite Partner
          </Button>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}

        {/* ─── 4 stat-cards ─── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          <StatCard label="Active Partners" value={String(overview.stats.activePartners)} desc="Partners with active access" Icon={GroupIcon} />
          <StatCard label="Shared Talent Pools" value={String(overview.stats.sharedTalentPools)} desc="Pools shared across partners" Icon={PeopleOutlineOutlinedIcon} />
          <StatCard label="Pending Requests" value={String(overview.stats.pendingRequests)} desc="Awaiting your approval" Icon={HourglassEmptyIcon} />
          <StatCard label="GDPR-Compliant Permissions" value={`${overview.stats.gdprCompliantPercent}%`} desc="All data access is controlled" Icon={ShieldIcon} />
        </Box>

        {/* ─── Tabs + søk/filter ─── */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, gap: 2 }}>
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
            <Tab label={`All Partners (${overview.partners.length})`} />
            <Tab label="Casting Partners" />
            <Tab label="Professional Centers" />
            <Tab label={`Invitations${overview.stats.pendingRequests ? ` (${overview.stats.pendingRequests})` : ''}`} />
          </Tabs>
          <Stack direction="row" spacing={1.2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.6, py: 0.7, bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, borderRadius: radius.sm, minWidth: 240 }}>
              <SearchIcon sx={{ color: palette.textMuted, fontSize: 18 }} />
              <InputBase placeholder="Search partners…" sx={{ flexGrow: 1, color: palette.textPrimary, fontSize: '0.85rem' }} />
            </Box>
            <Button startIcon={<TuneIcon />} endIcon={<ChevronRightIcon sx={{ transform: 'rotate(90deg)' }} />} sx={{ textTransform: 'none', color: palette.textPrimary, bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, borderRadius: radius.sm, px: 1.6, fontWeight: 600, fontSize: '0.85rem' }}>
              Filters
            </Button>
          </Stack>
        </Stack>

        {/* ─── Partner-tabell + Permissions Matrix (split) ─── */}
        {activeTab === 3 ? (
          <InvitationsTab onChanged={() => void reload()} />
        ) : filteredPartners.length === 0 ? (
          <EmptyTabState onInvite={() => setInviteOpen(true)} hasAnyPartners={overview.partners.length > 0} />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 2, mb: 3 }}>
            <Box sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '36px 1.6fr 1fr 1fr 1fr 36px', gap: 1.2, px: 2, py: 1.4, borderBottom: `1px solid ${palette.borderSubtle}`, color: palette.textMuted, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Box />
                <Box>Partner</Box>
                <Box>Role</Box>
                <Box>Access Level</Box>
                <Box>Last Activity</Box>
                <Box />
              </Box>
              {filteredPartners.map((p) => {
                const isSel = p.id === (selected?.id ?? '');
                const color = colorForKey(p.id);
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
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isSel ? palette.accent : palette.borderStrong}`, bgcolor: isSel ? palette.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSel ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fff' }} /> : null}
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1.4}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: `${color}28`, color, fontWeight: 700, fontSize: '0.85rem', border: `1px solid ${color}44` }}>
                        {p.initials}
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem' }}>{p.display_name}</Typography>
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{p.location || (p.email ?? '—')}</Typography>
                      </Box>
                    </Stack>
                    <Box>
                      <Chip label={p.role_label} size="small" sx={{ bgcolor: 'rgba(168, 85, 247, 0.12)', color: palette.accentBright, fontWeight: 600, fontSize: '0.72rem', height: 22 }} />
                    </Box>
                    <Box>{accessChip(p.access_level)}</Box>
                    <Stack direction="row" alignItems="center" spacing={0.7}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: palette.success }} />
                      <Typography sx={{ color: palette.textSecondary, fontSize: '0.83rem' }}>{formatRelative(p.last_activity)}</Typography>
                    </Stack>
                    <IconButton size="small" sx={{ color: palette.textMuted }} onClick={(e) => e.stopPropagation()}>
                      <MoreHorizIcon />
                    </IconButton>
                  </Box>
                );
              })}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.6, borderTop: `1px solid ${palette.borderSubtle}` }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                  Showing 1–{filteredPartners.length} of {filteredPartners.length} partners
                </Typography>
                <Stack direction="row" spacing={0.6}>
                  <PageBtn><ChevronLeftIcon sx={{ fontSize: 16 }} /></PageBtn>
                  <PageBtn active>1</PageBtn>
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
                <Tooltip title="Klikk en celle for å gi eller trekke tilgang. Endring lagres umiddelbart.">
                  <InfoOutlinedIcon sx={{ color: palette.textMuted, fontSize: 14 }} />
                </Tooltip>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: '60px repeat(4, 1fr)', gap: 0, rowGap: 1.2, alignItems: 'center' }}>
                <Box />
                <MatrixHeader Icon={PersonOutlineIcon} label="Profiles" />
                <MatrixHeader Icon={PlayCircleOutlineIcon} label="Self-Tapes" />
                <MatrixHeader Icon={SchoolOutlinedIcon} label="Workshops" />
                <MatrixHeader Icon={EventNoteOutlinedIcon} label="Auditions" />
                {filteredPartners.map((p) => {
                  const color = colorForKey(p.id);
                  const busy = busyRow === p.id;
                  return (
                    <Box key={p.id} sx={{ display: 'contents' }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: `${color}28`, color, fontSize: '0.75rem', fontWeight: 700, border: `1px solid ${color}44` }}>
                        {p.initials}
                      </Avatar>
                      <MatrixCell on={p.perms.profiles} busy={busy} onToggle={() => void handleTogglePerm(p, 'profiles')} />
                      <MatrixCell on={p.perms.selftapes} busy={busy} onToggle={() => void handleTogglePerm(p, 'selftapes')} />
                      <MatrixCell on={p.perms.workshops} busy={busy} onToggle={() => void handleTogglePerm(p, 'workshops')} />
                      <MatrixCell on={p.perms.auditions} busy={busy} onToggle={() => void handleTogglePerm(p, 'auditions')} />
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ mt: 2.4, pt: 1.6, borderTop: `1px solid ${palette.borderSubtle}` }}>
                <Button endIcon={<ChevronRightIcon />} sx={{ textTransform: 'none', color: palette.accentBright, fontWeight: 600, fontSize: '0.85rem', pl: 0, '&:hover': { bgcolor: 'transparent', color: palette.accent } }}>
                  Manage global permission presets
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* ─── Collaboration Feed ─── */}
        <Box sx={cardSx}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>Collaboration Feed</Typography>
            <Button sx={{ textTransform: 'none', color: palette.accentBright, fontWeight: 600, fontSize: '0.85rem', '&:hover': { bgcolor: 'transparent', color: palette.accent } }}>
              View all activity
            </Button>
          </Stack>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 2 }}>Recent activity across your partner network</Typography>
          {overview.feed.length === 0 ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', py: 2 }}>
              Ingen partner-aktivitet ennå. Aktivitet vises her når en partner viser profilen din eller når du gjør endringer i tillatelser.
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1.4 }}>
              {overview.feed.slice(0, 5).map((f) => (
                <FeedCard key={`${f.kind}-${f.id}`} event={f} />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ─── Right sidebar ─── */}
      <Box sx={{ width: 320, flexShrink: 0, p: 3, pl: 0, display: { xs: 'none', lg: 'block' } }}>
        {selected ? <SelectedPartnerSidebar partner={selected} onInvite={() => setInviteOpen(true)} /> : null}
      </Box>

      {/* Invite-dialog */}
      <InvitePartnerDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={() => {
          setInviteOpen(false);
          void reload();
        }}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snack}
      />
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
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 500, mb: 0.6 }}>{label}</Typography>
          <Typography sx={{ color: palette.textPrimary, fontSize: '2.2rem', fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
        </Box>
        <Box sx={{ width: 38, height: 38, borderRadius: radius.sm, bgcolor: 'rgba(168, 85, 247, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

function MatrixCell({ on, busy, onToggle }: { on: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Checkbox
        checked={on}
        onChange={onToggle}
        disabled={busy}
        icon={<Box sx={{ width: 14, height: 2, bgcolor: palette.textMuted, opacity: 0.5, borderRadius: 1 }} />}
        checkedIcon={<CheckCircleIcon sx={{ color: palette.success, fontSize: 20 }} />}
        sx={{ p: 0.4 }}
      />
    </Box>
  );
}

function PageBtn({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <Box sx={{ minWidth: 28, height: 28, px: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius.xs, bgcolor: active ? palette.accent : 'transparent', color: active ? '#fff' : palette.textMuted, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: active ? palette.accent : 'rgba(168, 85, 247, 0.12)' } }}>
      {children}
    </Box>
  );
}

function FeedCard({ event }: { event: FeedEvent }) {
  const name = event.display_name || (event.details?.email as string) || 'Ukjent partner';
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0] || '').join('').toUpperCase();
  const color = colorForKey(name);
  let text: React.ReactNode;
  if (event.kind === 'access') {
    const endpoint = String(event.details?.endpoint ?? '');
    text = endpoint.includes('/talents')
      ? <><strong>{name}</strong> så talent-listen din.</>
      : <><strong>{name}</strong> så profilen din.</>;
  } else if (event.kind === 'invite') {
    text = <><strong>Du</strong> inviterte <em>{name}</em>.</>;
  } else {
    text = <><strong>{name}</strong> fikk tilgang ({String(event.details?.scope ?? '')}).</>;
  }
  return (
    <Box sx={{ p: 1.4, borderRadius: radius.md, bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        {event.kind === 'invite' && !event.display_name ? (
          <Box sx={{ width: 32, height: 32, borderRadius: radius.sm, bgcolor: 'rgba(168, 85, 247, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <InventoryOutlinedIcon sx={{ color: palette.accentBright, fontSize: 18 }} />
          </Box>
        ) : (
          <Avatar sx={{ width: 32, height: 32, bgcolor: `${color}28`, color, fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${color}44` }}>
            {initials}
          </Avatar>
        )}
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.8rem', lineHeight: 1.45 }}>{text}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: event.badge === 'pending' ? palette.warning : palette.success }} />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>{formatRelative(event.occurred_at)}</Typography>
        </Stack>
        {event.badge === 'pending' ? (
          <Chip label="Pending" size="small" sx={{ bgcolor: 'rgba(245, 158, 11, 0.16)', color: palette.warning, fontWeight: 600, fontSize: '0.68rem', height: 18 }} />
        ) : null}
      </Stack>
    </Box>
  );
}

function SelectedPartnerSidebar({ partner, onInvite }: { partner: PartnerOverviewRow; onInvite: () => void }) {
  const color = colorForKey(partner.id);
  const vis = {
    accessLevel: partner.access_level === 'full' ? 'Full Access' : partner.access_level === 'limited' ? 'Limited Access' : partner.access_level === 'custom' ? 'Custom Access' : 'View Only',
    dataResidency: 'EU/EEA',
    profiles: partner.perms.profiles ? 'All profiles' : 'No access',
    selftapes: partner.perms.selftapes ? 'All self-tapes' : 'No access',
    auditionInvites: partner.perms.auditions ? 'View & Send' : 'No access',
    workshops: partner.perms.workshops ? 'View only' : 'No access',
  };
  return (
    <Box sx={{ ...cardSx, position: 'sticky', top: 16 }}>
      <Stack direction="row" spacing={1.4} alignItems="center" sx={{ mb: 2 }}>
        <Avatar sx={{ width: 48, height: 48, bgcolor: `${color}28`, color, fontWeight: 700, fontSize: '1rem', border: `1px solid ${color}44` }}>
          {partner.initials}
        </Avatar>
        <Box>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>{partner.display_name}</Typography>
          <Chip label={partner.role_label} size="small" sx={{ mt: 0.4, bgcolor: 'rgba(168, 85, 247, 0.12)', color: palette.accentBright, fontWeight: 600, fontSize: '0.7rem', height: 20 }} />
        </Box>
      </Stack>

      <Stack spacing={1.2} sx={{ mb: 2.4 }}>
        {partner.location ? <ContactRow Icon={LocationOnOutlinedIcon} text={partner.location} /> : null}
        {partner.email ? <ContactRow Icon={EmailOutlinedIcon} text={partner.email} /> : null}
        {partner.website ? <ContactRow Icon={PublicIcon} text={partner.website} /> : null}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>Visibility &amp; Access</Typography>
      </Stack>
      <Stack spacing={1.2} sx={{ mb: 2.4 }}>
        <VisRow Icon={ShieldIcon} label="Access Level" value={vis.accessLevel} highlight />
        <VisRow Icon={PublicIcon} label="Data Residency" value={vis.dataResidency} />
        <VisRow Icon={PersonOutlineIcon} label="Profiles" value={vis.profiles} />
        <VisRow Icon={PlayCircleOutlineIcon} label="Self-Tapes" value={vis.selftapes} />
        <VisRow Icon={EventNoteOutlinedIcon} label="Audition Invites" value={vis.auditionInvites} />
        <VisRow Icon={SchoolOutlinedIcon} label="Workshops" value={vis.workshops} />
      </Stack>

      <Stack spacing={1}>
        <Button startIcon={<LockOutlinedIcon />} onClick={onInvite} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.88rem', py: 1.2, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff', '&:hover': { filter: 'brightness(1.08)' }, boxShadow: '0 6px 18px rgba(168, 85, 247, 0.32)' }}>
          Edit Access
        </Button>
        <Button startIcon={<PersonAddAltOutlinedIcon />} onClick={onInvite} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', py: 1.1, borderRadius: radius.sm, color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`, '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.08)' } }}>
          Send Invite
        </Button>
        <Button startIcon={<GroupIcon />} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', py: 1.1, borderRadius: radius.sm, color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`, '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.08)' } }}>
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

function VisRow({ Icon, label, value, highlight = false }: { Icon: React.ComponentType<{ sx?: object }>; label: string; value: string; highlight?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" spacing={1} alignItems="center">
        <Icon sx={{ color: palette.textMuted, fontSize: 15 }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem' }}>{label}</Typography>
      </Stack>
      <Typography sx={{ color: highlight ? palette.accentBright : palette.textPrimary, fontSize: '0.82rem', fontWeight: highlight ? 700 : 500 }}>{value}</Typography>
    </Stack>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tom-tilstand komponenter
// ──────────────────────────────────────────────────────────────────

function NoProfileState({ onCreated }: { onCreated: () => void }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    const result = await roleRoomTalentsService.createMyTalent({});
    setCreating(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onCreated();
  };
  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Box sx={cardSx}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.4rem', mb: 1 }}>
          Du har ikke en talent-profil ennå
        </Typography>
        <Typography sx={{ color: palette.textSecondary, lineHeight: 1.6, mb: 2.4 }}>
          For å invitere partnere må vi opprette en talent-profil. Du eier all data og bestemmer hvem som ser den.
        </Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Button onClick={() => void handleCreate()} disabled={creating} startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />} sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, py: 1.1, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}>
          Opprett talent-profil
        </Button>
      </Box>
    </Box>
  );
}

function EmptyTabState({ onInvite, hasAnyPartners }: { onInvite: () => void; hasAnyPartners: boolean }) {
  return (
    <Box sx={{ ...cardSx, textAlign: 'center', py: 6, mb: 3 }}>
      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.1rem', mb: 0.8 }}>
        {hasAnyPartners ? 'Ingen partnere i denne kategorien ennå' : 'Du har ikke invitert noen partnere ennå'}
      </Typography>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mb: 2 }}>
        Inviter Stella Casting, Norsk Skuespillersenter, eller en produsent for å begynne å samarbeide.
      </Typography>
      <Button startIcon={<PersonAddAltOutlinedIcon />} onClick={onInvite} sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, py: 1.1, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}>
        Inviter en partner
      </Button>
    </Box>
  );
}

function InvitationsTab({ onChanged }: { onChanged: () => void }) {
  const [invites, setInvites] = useState<RoleRoomPartnerInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await roleRoomTalentsService.fetchPartnerInvites();
    setInvites(list);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Avbryt denne invitasjonen?')) return;
    await roleRoomTalentsService.cancelPartnerInvite(id);
    void reload();
    onChanged();
  };

  if (loading) return <Box sx={cardSx}><CircularProgress size={20} sx={{ color: palette.accentBright }} /></Box>;
  if (invites.length === 0) {
    return (
      <Box sx={{ ...cardSx, textAlign: 'center', py: 4 }}>
        <Typography sx={{ color: palette.textSecondary }}>Ingen invitasjoner sendt ennå.</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ ...cardSx, mb: 3 }}>
      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 2 }}>Invitasjoner ({invites.length})</Typography>
      <Stack spacing={1}>
        {invites.map((inv) => (
          <Box key={inv.id} sx={{ p: 1.4, borderRadius: radius.sm, border: `1px solid ${palette.borderSubtle}`, bgcolor: palette.bgCardElevated, display: 'grid', gridTemplateColumns: '1fr 120px 100px 36px', gap: 1, alignItems: 'center' }}>
            <Box>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem' }}>{inv.partner_display_name || inv.partner_email}</Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{inv.partner_email} · {inv.partner_type}</Typography>
            </Box>
            <Chip
              label={inv.status}
              size="small"
              sx={{
                bgcolor: inv.status === 'pending' ? 'rgba(245, 158, 11, 0.16)' : inv.status === 'accepted' ? 'rgba(34, 197, 94, 0.16)' : 'rgba(148, 163, 184, 0.16)',
                color: inv.status === 'pending' ? palette.warning : inv.status === 'accepted' ? palette.success : palette.textMuted,
                fontWeight: 600,
                fontSize: '0.72rem',
                height: 22,
                textTransform: 'capitalize',
              }}
            />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{formatRelative(inv.created_at)}</Typography>
            {inv.status === 'pending' ? (
              <IconButton size="small" sx={{ color: palette.danger }} onClick={() => void handleCancel(inv.id)}>
                <MoreHorizIcon />
              </IconButton>
            ) : <Box />}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function InvitePartnerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<{
    partner_type: RoleRoomTalentPartnerType;
    partner_email: string;
    partner_display_name: string;
    scopes: RoleRoomTalentConsentScope[];
    message: string;
  }>({
    partner_type: 'stella_casting',
    partner_email: '',
    partner_display_name: '',
    scopes: ['basic_profile', 'media_portfolio'],
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<RoleRoomPartnerInvite | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    const result = await roleRoomTalentsService.createPartnerInvite(form);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setCreatedInvite(result);
  };

  const reset = () => {
    setForm({ partner_type: 'stella_casting', partner_email: '', partner_display_name: '', scopes: ['basic_profile', 'media_portfolio'], message: '' });
    setError(null);
    setCreatedInvite(null);
  };

  const handleClose = () => {
    reset();
    onClose();
    if (createdInvite) onCreated();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: `1px solid ${palette.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800, color: palette.textPrimary, borderBottom: `1px solid ${palette.borderSubtle}` }}>
        {createdInvite ? 'Invitasjon opprettet' : 'Invite Partner'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2.4 }}>
        {createdInvite ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="success" sx={{ bgcolor: 'rgba(34, 197, 94, 0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.success } }}>
              Invite sendt til <strong>{createdInvite.maskedEmail || createdInvite.partner_email}</strong>. Kopier lenken under og send den manuelt hvis du foretrekker det.
            </Alert>
            <Box sx={{ p: 1.4, borderRadius: radius.sm, bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flexGrow: 1, color: palette.textSecondary, fontSize: '0.82rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {createdInvite.acceptUrl}
              </Typography>
              <IconButton size="small" onClick={() => navigator.clipboard.writeText(createdInvite.acceptUrl || '')} sx={{ color: palette.accentBright }}>
                <ContentCopyOutlinedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
              Inviter en partner til å se profilen din. Partneren får en lenke å akseptere — du bestemmer hvilke data de får tilgang til.
            </Typography>
            <TextField select label="Partner-type" value={form.partner_type} onChange={(e) => setForm({ ...form, partner_type: e.target.value as RoleRoomTalentPartnerType })} fullWidth size="small" sx={{ '& .MuiInputBase-input': { color: palette.textPrimary } }}>
              <MenuItem value="stella_casting">Stella Casting</MenuItem>
              <MenuItem value="skuespillersenter">Norsk Skuespillersenter</MenuItem>
              <MenuItem value="production_company">Produksjonsselskap</MenuItem>
              <MenuItem value="caster_individual">Individuell caster</MenuItem>
              <MenuItem value="workshop_provider">Workshop-arrangør</MenuItem>
            </TextField>
            <TextField label="Partner-e-post" value={form.partner_email} onChange={(e) => setForm({ ...form, partner_email: e.target.value })} fullWidth size="small" placeholder="kari@stellacasting.no" sx={{ '& .MuiInputBase-input': { color: palette.textPrimary } }} />
            <TextField label="Visningsnavn (valgfritt)" value={form.partner_display_name} onChange={(e) => setForm({ ...form, partner_display_name: e.target.value })} fullWidth size="small" placeholder="Stella Casting AS" sx={{ '& .MuiInputBase-input': { color: palette.textPrimary } }} />
            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>Hva får de tilgang til?</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {([
                  ['basic_profile', 'Basis'],
                  ['media_portfolio', 'Media'],
                  ['contact_info', 'Kontakt'],
                  ['demographics', 'Demografi'],
                  ['availability', 'Tilgjengelighet'],
                  ['audition_invitations', 'Audition-invites'],
                  ['self_tape_review', 'Self-tape'],
                ] as Array<[RoleRoomTalentConsentScope, string]>).map(([scope, label]) => {
                  const selected = form.scopes.includes(scope);
                  return (
                    <Chip
                      key={scope}
                      label={label}
                      onClick={() => setForm({ ...form, scopes: selected ? form.scopes.filter((s) => s !== scope) : [...form.scopes, scope] })}
                      sx={{
                        bgcolor: selected ? 'rgba(168, 85, 247, 0.24)' : 'rgba(168, 85, 247, 0.08)',
                        color: selected ? palette.accentBright : palette.textSecondary,
                        border: selected ? `1px solid ${palette.borderStrong}` : `1px solid ${palette.borderSubtle}`,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
            <TextField label="Personlig melding (valgfritt)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} fullWidth size="small" multiline minRows={2} sx={{ '& .MuiInputBase-input': { color: palette.textPrimary } }} />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
        <Button onClick={handleClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>
          {createdInvite ? 'Ferdig' : 'Avbryt'}
        </Button>
        {!createdInvite ? (
          <Button onClick={() => void handleSubmit()} disabled={saving || !form.partner_email} startIcon={saving ? <CircularProgress size={14} /> : <PersonAddAltOutlinedIcon />} sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}>
            Send invitasjon
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
