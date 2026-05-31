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
    full:      { label: 'Full tilgang',     fg: '#4ade80', Icon: CheckCircleIcon },
    limited:   { label: 'Begrenset',        fg: '#fbbf24', Icon: HourglassEmptyIcon },
    custom:    { label: 'Tilpasset',        fg: '#c084fc', Icon: ShieldIcon },
    view_only: { label: 'Kun visning',      fg: '#7dd3fc', Icon: VisibilityOutlinedIcon },
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
  const [editPartner, setEditPartner] = useState<PartnerOverviewRow | null>(null);

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
        const labels: Record<keyof PartnerOverviewRow['perms'], string> = {
          profiles: 'profil',
          selftapes: 'self-tapes',
          workshops: 'workshops',
          auditions: 'audition-invites',
        };
        const action = next[key] ? 'kan nå se' : 'ser ikke lenger';
        setSnack(`${row.display_name} ${action} ${labels[key]}`);
        await reload();
      }
    },
    [reload, demoMode],
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
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.85rem', flexGrow: 1 }}>
              Du ser et eksempel — Ingrid Nilsen sin profil. Ingen handlinger lagres.
            </Typography>
            <Button
              href="/talents/partners"
              size="small"
              sx={{ textTransform: 'none', color: palette.accentBright, fontWeight: 600, fontSize: '0.82rem' }}
            >
              Gå til min ekte profil →
            </Button>
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
              Partnere
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 0.6, maxWidth: 720 }}>
              Du eier profilen din. Velg hvilke casting-byråer, sentre og produsenter som får se hva.
              Du kan trekke tilgangen når som helst.
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
            Inviter partner
          </Button>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}

        {/* ─── 3 stat-cards (fjernet Shared Talent Pools — ikke implementert) ─── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          <StatCard label="Aktive partnere" value={String(overview.stats.activePartners)} desc="Har tilgang til profilen din" Icon={GroupIcon} />
          <StatCard label="Ventende invitasjoner" value={String(overview.stats.pendingRequests)} desc="Sendt, ikke svart ennå" Icon={HourglassEmptyIcon} />
          <StatCard label="GDPR-trygg" value={`${overview.stats.gdprCompliantPercent}%`} desc="All datatilgang er styrt av samtykke" Icon={ShieldIcon} />
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
            <Tab label={`Alle (${overview.partners.length})`} />
            <Tab label="Casting-byråer" />
            <Tab label="Sentre & skoler" />
            <Tab label={`Invitasjoner${overview.stats.pendingRequests ? ` (${overview.stats.pendingRequests})` : ''}`} />
          </Tabs>
          <Stack direction="row" spacing={1.2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.6, py: 0.7, bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, borderRadius: radius.sm, minWidth: 240 }}>
              <SearchIcon sx={{ color: palette.textMuted, fontSize: 18 }} />
              <InputBase placeholder="Søk i partnere…" sx={{ flexGrow: 1, color: palette.textPrimary, fontSize: '0.85rem' }} />
            </Box>
            <Tooltip title="Filtre kommer i neste oppdatering">
              <span>
                <Button startIcon={<TuneIcon />} disabled sx={{ textTransform: 'none', color: palette.textPrimary, bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, borderRadius: radius.sm, px: 1.6, fontWeight: 600, fontSize: '0.85rem', '&.Mui-disabled': { color: palette.textMuted, opacity: 0.6 } }}>
                  Filtre
                </Button>
              </span>
            </Tooltip>
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
                <Box>Type</Box>
                <Box>Tilgang</Box>
                <Box>Sist sett</Box>
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
                      <Tooltip title={p.role_label === 'Casting Partner' ? 'Caster roller for film/TV/teater' : 'Tilbyr workshops, etterutdanning eller catalog'}>
                        <Chip label={p.role_label === 'Casting Partner' ? 'Casting' : 'Senter'} size="small" sx={{ bgcolor: 'rgba(168, 85, 247, 0.12)', color: palette.accentBright, fontWeight: 600, fontSize: '0.72rem', height: 22, cursor: 'help' }} />
                      </Tooltip>
                    </Box>
                    <Box>{accessChip(p.access_level)}</Box>
                    <Stack direction="row" alignItems="center" spacing={0.7}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: palette.success }} />
                      <Typography sx={{ color: palette.textSecondary, fontSize: '0.83rem' }}>{formatRelative(p.last_activity)}</Typography>
                    </Stack>
                    <PartnerRowMenu
                      partner={p}
                      demoMode={demoMode}
                      onChanged={() => { void reload(); }}
                      onSnack={(msg) => setSnack(msg)}
                    />

                  </Box>
                );
              })}
              {filteredPartners.length > 0 ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.6, borderTop: `1px solid ${palette.borderSubtle}` }}>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                    {filteredPartners.length} {filteredPartners.length === 1 ? 'partner' : 'partnere'}
                  </Typography>
                  {filteredPartners.length > 25 ? (
                    <Stack direction="row" spacing={0.6}>
                      <PageBtn><ChevronLeftIcon sx={{ fontSize: 16 }} /></PageBtn>
                      <PageBtn active>1</PageBtn>
                      <PageBtn><ChevronRightIcon sx={{ fontSize: 16 }} /></PageBtn>
                    </Stack>
                  ) : null}
                </Stack>
              ) : null}
            </Box>

            {/* Permissions Matrix */}
            <Box sx={cardSx}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>
                  Tilgangs-matrise
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 2 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                  Hva hver partner kan se. Klikk en celle for å endre.
                </Typography>
                <Tooltip title="Profil = headshot, bio, skills. Self-tapes = videoer du har lastet opp. Workshops = arrangementer du har deltatt på. Auditions = direkte rolle-invitasjoner.">
                  <InfoOutlinedIcon sx={{ color: palette.textMuted, fontSize: 14, cursor: 'help' }} />
                </Tooltip>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: '60px repeat(4, 1fr)', gap: 0, rowGap: 1.2, alignItems: 'center' }}>
                <Box />
                <MatrixHeader Icon={PersonOutlineIcon} label="Profil" />
                <MatrixHeader Icon={PlayCircleOutlineIcon} label="Self-tape" />
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
                <Tooltip title="Lag forhåndsdefinerte tilgangsmaler — kommer i neste oppdatering">
                  <span>
                    <Button endIcon={<ChevronRightIcon />} disabled sx={{ textTransform: 'none', color: palette.accentBright, fontWeight: 600, fontSize: '0.85rem', pl: 0, '&.Mui-disabled': { color: palette.textMuted, opacity: 0.6 } }}>
                      Tilgangsmaler (kommer)
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        )}

        {/* ─── Aktivitet-feed ─── */}
        <Box sx={cardSx}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>Aktivitet</Typography>
          </Stack>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 2 }}>Hva partnerne dine har gjort siste 30 dager</Typography>
          {overview.feed.length === 0 ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', py: 2 }}>
              Ingen aktivitet ennå. Når en partner ser profilen din, dukker det opp her.
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
        {selected ? <SelectedPartnerSidebar partner={selected} onInvite={() => {
          if (demoMode) { setSnack('Demo-modus er read-only'); return; }
          setInviteOpen(true);
        }} onEdit={() => {
          if (demoMode) { setSnack('Demo-modus er read-only'); return; }
          setEditPartner(selected);
        }} /> : null}
      </Box>

      <EditAccessDialog
        partner={editPartner}
        onClose={() => setEditPartner(null)}
        onSaved={() => { setEditPartner(null); setSnack('Tilgang oppdatert'); void reload(); }}
      />

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

function SelectedPartnerSidebar({ partner, onInvite, onEdit }: { partner: PartnerOverviewRow; onInvite: () => void; onEdit: () => void }) {
  const color = colorForKey(partner.id);
  const vis = {
    accessLevel: partner.access_level === 'full' ? 'Full tilgang' : partner.access_level === 'limited' ? 'Begrenset' : partner.access_level === 'custom' ? 'Tilpasset' : 'Kun visning',
    dataResidency: 'EU/EEA',
    profiles: partner.perms.profiles ? 'Ja' : 'Nei',
    selftapes: partner.perms.selftapes ? 'Ja' : 'Nei',
    auditionInvites: partner.perms.auditions ? 'Ja, kan også sende' : 'Nei',
    workshops: partner.perms.workshops ? 'Kun visning' : 'Nei',
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
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>Hva ser de?</Typography>
      </Stack>
      <Stack spacing={1.2} sx={{ mb: 2.4 }}>
        <VisRow Icon={ShieldIcon} label="Tilgangsnivå" value={vis.accessLevel} highlight />
        <VisRow Icon={PublicIcon} label="Datalagring" value={vis.dataResidency} />
        <VisRow Icon={PersonOutlineIcon} label="Profil" value={vis.profiles} />
        <VisRow Icon={PlayCircleOutlineIcon} label="Self-tapes" value={vis.selftapes} />
        <VisRow Icon={EventNoteOutlinedIcon} label="Audition-invites" value={vis.auditionInvites} />
        <VisRow Icon={SchoolOutlinedIcon} label="Workshops" value={vis.workshops} />
      </Stack>

      <Stack spacing={1}>
        <Button startIcon={<LockOutlinedIcon />} onClick={onEdit} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.88rem', py: 1.2, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff', '&:hover': { filter: 'brightness(1.08)' }, boxShadow: '0 6px 18px rgba(168, 85, 247, 0.32)' }}>
          Endre tilgang
        </Button>
        <Button startIcon={<PersonAddAltOutlinedIcon />} onClick={onInvite} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', py: 1.1, borderRadius: radius.sm, color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`, '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.08)' } }}>
          Inviter ny partner
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
// PartnerRowMenu — 3-dots-meny per partner-row
// ──────────────────────────────────────────────────────────────────

import { Menu, MenuItem as MuiMenuItem, ListItemIcon } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

function PartnerRowMenu({ partner, demoMode, onChanged, onSnack }: {
  partner: PartnerOverviewRow;
  demoMode: boolean;
  onChanged: () => void;
  onSnack: (msg: string) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleRevokeAll = async () => {
    setAnchorEl(null);
    if (demoMode) { onSnack('Demo-modus er read-only'); return; }
    if (!window.confirm(`Trekke ALL tilgang fra ${partner.display_name}? Dette kan ikke angres uten å invitere på nytt.`)) return;
    const result = await roleRoomTalentsService.bulkSetConsents({
      partner_type: partner.partner_type,
      partner_ref: partner.id,
      partner_display_name: partner.display_name,
      perms: { profiles: false, selftapes: false, workshops: false, auditions: false },
    });
    if ('error' in result) { onSnack(`Feil: ${result.error}`); return; }
    onSnack(`${partner.display_name} har ikke lenger tilgang`);
    onChanged();
  };

  const handlePause30 = async () => {
    setAnchorEl(null);
    if (demoMode) { onSnack('Demo-modus er read-only'); return; }
    const result = await roleRoomTalentsService.pausePartnerAccess({
      partner_type: partner.partner_type,
      partner_ref: partner.id,
      days: 30,
    });
    if (!result.ok) { onSnack(`Feil: ${result.error}`); return; }
    onSnack(`Tilgangen til ${partner.display_name} er pauset i 30 dager`);
    onChanged();
  };
  return (
    <>
      <IconButton size="small" sx={{ color: palette.textMuted }} onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}>
        <MoreHorizIcon />
      </IconButton>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: palette.bgCard, border: `1px solid ${palette.border}` } }}
      >
        <MuiMenuItem
          onClick={() => void handleRevokeAll()}
          sx={{ color: '#f87171', fontSize: '0.88rem' }}
        >
          <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: '#f87171' }} /></ListItemIcon>
          Trekk all tilgang
        </MuiMenuItem>
        <MuiMenuItem
          onClick={() => void handlePause30()}
          sx={{ color: palette.textPrimary, fontSize: '0.88rem' }}
        >
          <ListItemIcon><PauseCircleOutlineIcon fontSize="small" sx={{ color: palette.warning }} /></ListItemIcon>
          Pause tilgang i 30 dager
        </MuiMenuItem>
        {partner.website ? (
          <MuiMenuItem
            onClick={() => { setAnchorEl(null); window.open(partner.website!.startsWith('http') ? partner.website! : `https://${partner.website}`, '_blank'); }}
            sx={{ color: palette.textPrimary, fontSize: '0.88rem' }}
          >
            <ListItemIcon><OpenInNewIcon fontSize="small" sx={{ color: palette.textSecondary }} /></ListItemIcon>
            Åpne {partner.website}
          </MuiMenuItem>
        ) : null}
      </Menu>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// EditAccessDialog — ekte scope-editor for eksisterende partner
// ──────────────────────────────────────────────────────────────────

function EditAccessDialog({ partner, onClose, onSaved }: {
  partner: PartnerOverviewRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perms, setPerms] = useState({ profiles: false, selftapes: false, workshops: false, auditions: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (partner) setPerms(partner.perms);
  }, [partner]);

  if (!partner) return null;

  const handleSave = async () => {
    setSaving(true);
    const result = await roleRoomTalentsService.bulkSetConsents({
      partner_type: partner.partner_type,
      partner_ref: partner.id,
      partner_display_name: partner.display_name,
      perms,
    });
    setSaving(false);
    if ('error' in result) return;
    onSaved();
  };

  const scopeRows: Array<{ key: keyof typeof perms; label: string; desc: string; Icon: React.ComponentType<{ sx?: object }> }> = [
    { key: 'profiles', label: 'Profil', desc: 'Headshot, bio, by, spille-alder', Icon: PersonOutlineIcon },
    { key: 'selftapes', label: 'Self-tapes', desc: 'Videoer du har lastet opp', Icon: PlayCircleOutlineIcon },
    { key: 'workshops', label: 'Workshops', desc: 'Arrangementer du har deltatt på', Icon: SchoolOutlinedIcon },
    { key: 'auditions', label: 'Audition-invites', desc: `${partner.display_name} kan sende deg auditions direkte`, Icon: EventNoteOutlinedIcon },
  ];

  return (
    <Dialog open={!!partner} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: `1px solid ${palette.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800, borderBottom: `1px solid ${palette.borderSubtle}` }}>
        Hva skal {partner.display_name} se?
      </DialogTitle>
      <DialogContent sx={{ pt: 2.4 }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', mb: 2 }}>
          Hak av det du vil dele. Endringer lagres når du klikker Lagre.
        </Typography>
        <Stack spacing={1.2}>
          {scopeRows.map(({ key, label, desc, Icon }) => (
            <Box
              key={key}
              onClick={() => setPerms({ ...perms, [key]: !perms[key] })}
              sx={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 1.4, alignItems: 'center',
                p: 1.4, borderRadius: radius.sm, cursor: 'pointer',
                border: `1px solid ${perms[key] ? palette.borderStrong : palette.borderSubtle}`,
                bgcolor: perms[key] ? 'rgba(168,85,247,0.08)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(168,85,247,0.05)' },
              }}
            >
              <Icon sx={{ color: perms[key] ? palette.accentBright : palette.textMuted, fontSize: 22 }} />
              <Stack spacing={0.2}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.92rem' }}>{label}</Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{desc}</Typography>
              </Stack>
              <Checkbox checked={perms[key]} sx={{ color: palette.textMuted, '&.Mui-checked': { color: palette.accent } }} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
        <Button onClick={onClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>Avbryt</Button>
        <Button onClick={() => void handleSave()} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}>
          Lagre endringer
        </Button>
      </DialogActions>
    </Dialog>
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
        {createdInvite ? 'Invitasjon klar — kopier lenken' : 'Inviter partner'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2.4 }}>
        {createdInvite ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {(createdInvite as { emailSent?: boolean }).emailSent ? (
              <Alert
                severity="success"
                icon={<EmailOutlinedIcon />}
                sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.success } }}
              >
                <strong>E-post sendt til {createdInvite.maskedEmail || createdInvite.partner_email}</strong> — de får en lenke for å akseptere invitasjonen direkte.
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(245, 158, 11, 0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.warning } }}>
                <strong>E-post-tjenesten ikke konfigurert akkurat nå.</strong> Kopier lenken under og send den til {createdInvite.maskedEmail || createdInvite.partner_email} selv.
              </Alert>
            )}
            <Box sx={{ p: 1.4, borderRadius: radius.sm, bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flexGrow: 1, color: palette.textSecondary, fontSize: '0.82rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {createdInvite.acceptUrl}
              </Typography>
              <Tooltip title="Kopier lenken">
                <IconButton size="small" onClick={() => { navigator.clipboard.writeText(createdInvite.acceptUrl || ''); }} sx={{ color: palette.accentBright }}>
                  <ContentCopyOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
              Når partneren klikker lenken og logger inn, ser du dem i partner-listen din. Du får varsel her.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.4} sx={{ pt: 1 }}>
            {/* Søk eksisterende partner først */}
            <AgencySearchPicker
              currentEmail={form.partner_email}
              onPick={(agency) => {
                setForm({
                  ...form,
                  partner_type: agency.type,
                  partner_email: agency.contact_email ?? '',
                  partner_display_name: agency.name,
                });
              }}
            />

            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.4, my: -0.6 }}>
              <Box sx={{ flexGrow: 1, height: 1, bgcolor: palette.borderSubtle }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Eller fyll ut manuelt
              </Typography>
              <Box sx={{ flexGrow: 1, height: 1, bgcolor: palette.borderSubtle }} />
            </Box>

            <TextField select label="Partner-type" value={form.partner_type} onChange={(e) => setForm({ ...form, partner_type: e.target.value as RoleRoomTalentPartnerType })} fullWidth size="small">
              <MenuItem value="stella_casting">Casting-byrå</MenuItem>
              <MenuItem value="skuespillersenter">Sentre/skoler</MenuItem>
              <MenuItem value="production_company">Produksjonsselskap</MenuItem>
              <MenuItem value="caster_individual">Individuell caster</MenuItem>
              <MenuItem value="workshop_provider">Workshop-arrangør</MenuItem>
            </TextField>
            <TextField label="E-post" value={form.partner_email} onChange={(e) => setForm({ ...form, partner_email: e.target.value })} fullWidth size="small" placeholder="kari@stellacasting.no" />
            <TextField label="Visningsnavn (valgfritt)" value={form.partner_display_name} onChange={(e) => setForm({ ...form, partner_display_name: e.target.value })} fullWidth size="small" placeholder="Stella Casting AS" />

            {/* Presets */}
            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>Hva får de tilgang til?</Typography>
              <Stack direction="row" spacing={0.8} sx={{ mb: 1.4 }} flexWrap="wrap" useFlexGap>
                <ScopePresetChip
                  label="📋 Anbefalt for casting"
                  scopes={['basic_profile', 'media_portfolio', 'contact_info', 'demographics', 'audition_invitations']}
                  currentScopes={form.scopes}
                  onSet={(scopes) => setForm({ ...form, scopes })}
                />
                <ScopePresetChip
                  label="🔍 Kun forhåndsvisning"
                  scopes={['basic_profile']}
                  currentScopes={form.scopes}
                  onSet={(scopes) => setForm({ ...form, scopes })}
                />
                <ScopePresetChip
                  label="🎯 Full tilgang"
                  scopes={['full_profile']}
                  currentScopes={form.scopes}
                  onSet={(scopes) => setForm({ ...form, scopes })}
                />
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={0.8}>
                {([
                  ['basic_profile', 'Basis', 'Navn, by, bio'],
                  ['media_portfolio', 'Media', 'Headshot, showreel, CV'],
                  ['contact_info', 'Kontakt', 'E-post, telefon'],
                  ['demographics', 'Demografi', 'Alder, høyde, kjønn'],
                  ['availability', 'Tilgjengelighet', 'Når kan du jobbe'],
                  ['audition_invitations', 'Audition-invites', 'Kan sende deg roller'],
                  ['self_tape_review', 'Self-tape', 'Kan se og kommentere'],
                ] as Array<[RoleRoomTalentConsentScope, string, string]>).map(([scope, label, desc]) => {
                  const selected = form.scopes.includes(scope);
                  return (
                    <Tooltip key={scope} title={desc} placement="top">
                      <Chip
                        label={label}
                        onClick={() => setForm({ ...form, scopes: selected ? form.scopes.filter((s) => s !== scope) : [...form.scopes, scope] })}
                        sx={{
                          bgcolor: selected ? 'rgba(168, 85, 247, 0.24)' : 'rgba(168, 85, 247, 0.08)',
                          color: selected ? palette.accentBright : palette.textSecondary,
                          border: selected ? `1px solid ${palette.borderStrong}` : `1px solid ${palette.borderSubtle}`,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>

            <TextField label="Personlig melding (valgfritt)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} fullWidth size="small" multiline minRows={2} placeholder="Eks: Hei Stella, vi snakket i går — her er profilen min." />
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

// ──────────────────────────────────────────────────────────────────
// AgencySearchPicker — autocomplete blant kjente agencies
// ──────────────────────────────────────────────────────────────────

import { Autocomplete } from '@mui/material';
import type { RoleRoomAgencyOrg } from '../../services/roleRoomTalentsService';

function AgencySearchPicker({ currentEmail, onPick }: {
  currentEmail: string;
  onPick: (agency: RoleRoomAgencyOrg) => void;
}) {
  const [agencies, setAgencies] = useState<RoleRoomAgencyOrg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    roleRoomTalentsService.fetchAgencies().then((list) => {
      if (!cancelled) {
        // Filtrer demo-prefiks bort i prod-modus
        setAgencies(list.filter((a) => !a.slug.startsWith('demo-')));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>
        Søk i registrerte partnere
      </Typography>
      <Autocomplete
        options={agencies}
        getOptionLabel={(o) => o.name}
        loading={loading}
        loadingText="Henter partnere…"
        noOptionsText="Ingen partnere matcher — fyll ut manuelt under"
        onChange={(_, value) => { if (value) onPick(value); }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Eks: Stella, Norsk Skuespillersenter…"
            sx={{ '& .MuiInputBase-input': { color: palette.textPrimary } }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ width: '100%' }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(168,85,247,0.18)', color: palette.accentBright, fontSize: '0.7rem', fontWeight: 700 }}>
                {option.name.slice(0, 2).toUpperCase()}
              </Avatar>
              <Stack spacing={0} sx={{ flexGrow: 1 }}>
                <Typography sx={{ color: palette.textPrimary, fontSize: '0.88rem', fontWeight: 600 }}>{option.name}</Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>{option.contact_email || option.slug}</Typography>
              </Stack>
              {option.verified ? (
                <Chip label="✓" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: palette.success, fontWeight: 700, height: 18 }} />
              ) : null}
            </Stack>
          </Box>
        )}
      />
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// ScopePresetChip — ett-klikks preset for vanlige scope-sett
// ──────────────────────────────────────────────────────────────────

function ScopePresetChip({ label, scopes, currentScopes, onSet }: {
  label: string;
  scopes: RoleRoomTalentConsentScope[];
  currentScopes: RoleRoomTalentConsentScope[];
  onSet: (scopes: RoleRoomTalentConsentScope[]) => void;
}) {
  const matches = scopes.length === currentScopes.length && scopes.every((s) => currentScopes.includes(s));
  return (
    <Chip
      label={label}
      onClick={() => onSet(scopes)}
      sx={{
        bgcolor: matches ? palette.accent : 'rgba(168,85,247,0.08)',
        color: matches ? '#fff' : palette.accentBright,
        border: `1px solid ${matches ? palette.accent : palette.borderStrong}`,
        fontWeight: 700,
        fontSize: '0.78rem',
        cursor: 'pointer',
        '&:hover': { bgcolor: matches ? palette.accent : 'rgba(168,85,247,0.18)' },
      }}
    />
  );
}
