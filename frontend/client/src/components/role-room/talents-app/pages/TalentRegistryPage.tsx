/**
 * TalentRegistryPage.tsx — pixel-implementasjon av mockup #2.
 *
 * For agency-brukere (Stella, NSF, produsenter) som søker etter talents
 * de har consent fra. KUN consent-filtrerte resultater (GDPR-trygt).
 *
 * 7 regioner:
 *   1. Page header + Grid/List toggle
 *   2. Advanced Filters card (2 rader × 5 felter + More filters)
 *   3. Featured Talents karusell
 *   4. Talent-grid (4-kolonner) eller list-view
 *   5. Right sidebar: Saved Searches
 *   6. Registry Overview-card
 *   7. Save new search-knapp
 */

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FilterListIcon from '@mui/icons-material/FilterListOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import ViewListIcon from '@mui/icons-material/ViewList';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type RegistryOverview,
  type SavedSearch,
  type TalentProposal,
  type TalentSearchFilters,
  type TalentSearchHit,
} from '../../services/roleRoomTalentsService';
import ProposeNewTalentDialog from '../components/ProposeNewTalentDialog';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import { palette, radius } from '../theme';

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: palette.textPrimary,
    bgcolor: palette.bgCardElevated,
    borderRadius: radius.sm,
    '& fieldset': { borderColor: palette.borderSubtle },
    '&:hover fieldset': { borderColor: palette.borderStrong },
  },
  '& .MuiInputLabel-root': { color: palette.textMuted, fontSize: '0.8rem' },
  '& .MuiSvgIcon-root.MuiSelect-icon': { color: palette.textMuted },
};

const SKILL_OPTIONS = [
  'Drama', 'Comedy', 'Acting', 'Stunts', 'Combat', 'Dance', 'Singing',
  'Voice', 'Improvisation', 'Modeling', 'Piano', 'Director', 'Narration',
];
const LANGUAGE_OPTIONS = ['Norsk', 'English', 'Svensk', 'Dansk', 'German', 'French', 'Spanish'];
const DIALECT_OPTIONS = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Trøndersk', 'Nordnorsk', 'Sørlandsk'];
const NORWEGIAN_CITIES = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Tromsø', 'Drammen', 'Kristiansand'];

interface TalentRegistryPageProps {
  demoMode?: boolean;
}

export default function TalentRegistryPage({ demoMode = false }: TalentRegistryPageProps) {
  const [filters, setFilters] = useState<TalentSearchFilters>({ sort: 'recent', limit: 50 });
  const [searchResult, setSearchResult] = useState<{ total: number; talents: TalentSearchHit[] } | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [overview, setOverview] = useState<RegistryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [error, setError] = useState<string | null>(null);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposals, setProposals] = useState<TalentProposal[]>([]);
  const [showProposals, setShowProposals] = useState(false);

  const runSearch = useCallback(async (f: TalentSearchFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomTalentsService.searchTalents(f);
      setSearchResult({ total: result.total, talents: result.talents });
    } catch (err) {
      setError(`Søk feilet: ${err instanceof Error ? err.message : 'ukjent'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger søk når filters endres (debounce ~250ms)
  useEffect(() => {
    const t = setTimeout(() => void runSearch(filters), 250);
    return () => clearTimeout(t);
  }, [filters, runSearch]);

  // Last saved searches + overview + proposals én gang
  const reloadProposals = useCallback(async () => {
    setProposals(await roleRoomTalentsService.fetchAgencyProposals());
  }, []);

  useEffect(() => {
    void roleRoomTalentsService.fetchSavedSearches().then(setSavedSearches);
    void roleRoomTalentsService.fetchRegistryOverview().then(setOverview);
    void reloadProposals();
  }, [reloadProposals]);

  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending').length;

  const featured = useMemo(() => (searchResult?.talents ?? []).slice(0, 5), [searchResult]);
  const allTalents = searchResult?.talents ?? [];

  const handleApplySearch = (s: SavedSearch) => setFilters({ ...s.filters });

  return (
    <Box sx={{ display: 'flex', minWidth: 0 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
        {/* ─── Header + Foreslå + Grid/List toggle ─── */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15 }}>
              Talent-register
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 0.6 }}>
              Finn og koble deg til skuespillere over hele Norge.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.4} alignItems="center">
            <Button
              startIcon={<PersonAddOutlinedIcon />}
              onClick={() => setProposeOpen(true)}
              disabled={demoMode}
              sx={{
                textTransform: 'none', fontWeight: 700, px: 2.4, py: 1.1, borderRadius: radius.sm,
                background: palette.accentGradient, color: '#fff',
                '&:hover': { filter: 'brightness(1.08)' },
                boxShadow: '0 8px 24px rgba(168,85,247,0.28)',
              }}
            >
              Foreslå ny skuespiller
            </Button>
            <ToggleButtonGroup
              value={showProposals ? 'proposals' : view}
              exclusive
              onChange={(_, v) => {
                if (!v) return;
                if (v === 'proposals') setShowProposals(true);
                else { setShowProposals(false); setView(v); }
              }}
              sx={{
                bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`,
                borderRadius: radius.pill, p: 0.4,
                '& .MuiToggleButton-root': {
                  border: 'none', borderRadius: radius.pill, px: 2, py: 0.6,
                  color: palette.textMuted, textTransform: 'none', fontSize: '0.85rem',
                  '&.Mui-selected': { bgcolor: palette.accent, color: '#fff' },
                },
              }}
            >
              <ToggleButton value="grid"><GridViewIcon sx={{ mr: 0.6, fontSize: 18 }} /> Rutenett</ToggleButton>
              <ToggleButton value="list"><ViewListIcon sx={{ mr: 0.6, fontSize: 18 }} /> Liste</ToggleButton>
              <ToggleButton value="proposals">
                Forslag{pendingProposalsCount ? ` (${pendingProposalsCount})` : ''}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}

        {/* Hvis "Forslag"-tab er aktiv, vis proposals-list og hopp over resten */}
        {showProposals ? (
          <ProposalsView proposals={proposals} onChanged={reloadProposals} demoMode={demoMode} />
        ) : (<>

        {/* ─── Advanced Filters ─── */}
        <Box sx={{ ...cardSx, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: palette.accentBright, fontSize: 20 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1rem' }}>Avanserte filtre</Typography>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 1.4 }}>
            <FilterField label="By" value={filters.location || ''} onChange={(v) => setFilters({ ...filters, location: v || undefined })} options={['', ...NORWEGIAN_CITIES]} placeholder="Alle byer" />
            <PlayingAgeField filters={filters} onChange={(f) => setFilters({ ...filters, ...f })} />
            <MultiField label="Språk" values={filters.languages} options={LANGUAGE_OPTIONS} onChange={(v) => setFilters({ ...filters, languages: v.length ? v : undefined })} />
            <MultiField label="Dialekter" values={filters.dialects} options={DIALECT_OPTIONS} onChange={(v) => setFilters({ ...filters, dialects: v.length ? v : undefined })} />
            <MultiField label="Ferdigheter" values={filters.skills} options={SKILL_OPTIONS} onChange={(v) => setFilters({ ...filters, skills: v.length ? v : undefined })} />
            <FilterField label="Kjønn" value={filters.gender || ''} onChange={(v) => setFilters({ ...filters, gender: v || undefined })} options={['', 'female', 'male', 'non-binary', 'other']} optionsLabel={{ '': 'Alle', 'female': 'Kvinne', 'male': 'Mann', 'non-binary': 'Ikke-binær', 'other': 'Annet' }} placeholder="Alle" />
            <FilterField label="Tilgjengelighet" value={filters.availability || ''} onChange={(v) => setFilters({ ...filters, availability: v || undefined })} options={['', 'open', 'limited', 'unavailable']} optionsLabel={{ '': 'Alle', 'open': 'Tilgjengelig', 'limited': 'Begrenset', 'unavailable': 'Ikke tilgjengelig' }} placeholder="Alle" />
            <FilterField label="Representasjon" value={filters.representation || ''} onChange={(v) => setFilters({ ...filters, representation: (v as TalentSearchFilters['representation']) || undefined })} options={['', 'represented', 'independent']} optionsLabel={{ '': 'Alle', 'represented': 'Med agent', 'independent': 'Uten agent' }} placeholder="Alle" />
            <FilterField label="Self-tape" value={filters.has_selftape ? 'yes' : ''} onChange={(v) => setFilters({ ...filters, has_selftape: v === 'yes' || undefined })} options={['', 'yes']} optionsLabel={{ '': 'Alle', 'yes': 'Har self-tape' }} placeholder="Alle" />
            <Button
              startIcon={<FilterListIcon />}
              onClick={() => setFilters({ sort: 'recent', limit: 50 })}
              sx={{
                color: palette.textPrimary, textTransform: 'none', borderRadius: radius.sm,
                bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`,
                '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
                fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              Nullstill filtre
            </Button>
          </Box>
        </Box>

        {/* ─── Featured Talents karusell ─── */}
        {featured.length > 0 ? (
          <Box sx={{ ...cardSx, mb: 3, position: 'relative' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <AutoAwesomeIcon sx={{ color: palette.accentBright, fontSize: 20 }} />
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1rem' }}>Fremhevede talenter</Typography>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.4 }}>
              {featured.map((t) => <FeaturedCard key={t.id} talent={t} />)}
            </Box>
          </Box>
        ) : null}

        {/* ─── Results-header ─── */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ color: palette.textPrimary, fontSize: '1rem' }}>
            <strong>{loading ? '…' : (searchResult?.total ?? 0).toLocaleString('nb-NO')}</strong>{' '}
            <Box component="span" sx={{ color: palette.textMuted }}>talenter matcher filtrene</Box>
          </Typography>
          <Stack direction="row" spacing={1.4} alignItems="center">
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>Sortér etter</Typography>
            <Select
              value={filters.sort ?? 'recent'}
              size="small"
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as TalentSearchFilters['sort'] })}
              sx={{ color: palette.textPrimary, fontSize: '0.85rem', minWidth: 160, bgcolor: palette.bgCard, ...fieldSx['& .MuiOutlinedInput-root'] }}
            >
              <MenuItem value="recent">Nylig aktive</MenuItem>
              <MenuItem value="available_first">Tilgjengelig først</MenuItem>
              <MenuItem value="name">Navn (A-Å)</MenuItem>
            </Select>
          </Stack>
        </Stack>

        {/* ─── Talent grid eller list ─── */}
        {loading && allTalents.length === 0 ? (
          <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.4 }}>
            <CircularProgress size={20} sx={{ color: palette.accentBright }} />
            <Typography sx={{ color: palette.textSecondary }}>Søker…</Typography>
          </Box>
        ) : allTalents.length === 0 ? (
          <Box sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 0.8 }}>
              {filters.q || filters.location || filters.gender ? 'Ingen treff på filtrene' : 'Ingen talents har gitt din agency tilgang ennå'}
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
              {filters.q ? 'Prøv å justere filtrene eller fjern noen.' : 'Be talents invitere din agency for å fylle registeret.'}
            </Typography>
          </Box>
        ) : view === 'grid' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.6 }}>
            {allTalents.map((t) => <TalentCard key={t.id} talent={t} />)}
          </Box>
        ) : (
          <Stack spacing={1}>
            {allTalents.map((t) => <TalentListRow key={t.id} talent={t} />)}
          </Stack>
        )}
        </>)}
      </Box>

      {/* ─── Right sidebar ─── */}
      <Box sx={{ width: 320, flexShrink: 0, p: 3, pl: 0, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 2 }}>
        {/* Lagrede søk */}
        <Box sx={cardSx}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1rem' }}>Lagrede søk</Typography>
            <Button sx={{ color: palette.accentBright, fontSize: '0.82rem', textTransform: 'none', minWidth: 0, p: 0 }}>Se alle</Button>
          </Stack>
          {savedSearches.length === 0 ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 2 }}>
              Ingen lagrede søk ennå. Bygg et søk og klikk "Lagre nytt søk" under.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {savedSearches.slice(0, 6).map((s) => (
                <SavedSearchRow key={s.id} search={s} onApply={() => handleApplySearch(s)} onDelete={async () => {
                  await roleRoomTalentsService.deleteSavedSearch(s.id);
                  setSavedSearches(await roleRoomTalentsService.fetchSavedSearches());
                }} />
              ))}
            </Stack>
          )}
          <Button
            fullWidth
            startIcon={<BookmarkAddOutlinedIcon />}
            onClick={() => setSaveSearchOpen(true)}
            disabled={demoMode}
            sx={{
              textTransform: 'none', fontWeight: 700, py: 1.2, borderRadius: radius.sm,
              border: `1px dashed ${palette.borderStrong}`, color: palette.accentBright,
              '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
            }}
          >
            Lagre nytt søk
          </Button>
        </Box>

        {/* Register-oversikt */}
        {overview ? (
          <Box sx={cardSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1rem' }}>Register-oversikt</Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>Dette view ▾</Typography>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography sx={{ color: palette.textPrimary, fontSize: '2.2rem', fontWeight: 800, lineHeight: 1 }}>
                  {overview.total_visible.toLocaleString('nb-NO')}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.4 }}>Synlige talenter</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#ec4899', fontSize: '1.4rem', fontWeight: 800, lineHeight: 1 }}>
                  +{overview.new_30d}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.4 }}>Nye registreringer<br />siste 30 dager</Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 2, height: 60, borderRadius: radius.sm, bgcolor: 'rgba(168,85,247,0.04)', position: 'relative', overflow: 'hidden' }}>
              <Sparkline color={palette.accent} data={overview.sparkline ?? []} />
            </Box>
            {(overview.sparkline ?? []).length > 0 ? (
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.68rem' }}>
                  {new Date(overview.sparkline![0].day).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.68rem' }}>
                  I dag
                </Typography>
              </Stack>
            ) : null}
          </Box>
        ) : null}
      </Box>

      <SaveSearchDialog
        open={saveSearchOpen}
        filters={filters}
        currentCount={searchResult?.total ?? 0}
        onClose={() => setSaveSearchOpen(false)}
        onSaved={async () => {
          setSaveSearchOpen(false);
          setSavedSearches(await roleRoomTalentsService.fetchSavedSearches());
        }}
      />

      <ProposeNewTalentDialog
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        onCreated={async () => {
          await reloadProposals();
        }}
      />
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// ProposalsView — viser Stellas pending/accepted/declined proposals med status-badges
// ──────────────────────────────────────────────────────────────────

function ProposalsView({ proposals, onChanged, demoMode }: { proposals: TalentProposal[]; onChanged: () => Promise<void>; demoMode: boolean }) {
  if (proposals.length === 0) {
    return (
      <Box sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 0.8 }}>
          Ingen forslag sendt ennå
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
          Klikk "Foreslå ny skuespiller" øverst for å sende et forslag. De får e-post og må eksplisitt godkjenne før de havner i registeret.
        </Typography>
      </Box>
    );
  }
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: 'Venter på svar', color: palette.warning, bg: 'rgba(245,158,11,0.16)' },
      accepted: { label: 'Godkjent', color: palette.success, bg: 'rgba(34,197,94,0.16)' },
      declined: { label: 'Avslått', color: '#f87171', bg: 'rgba(239,68,68,0.16)' },
      expired: { label: 'Utløpt', color: palette.textMuted, bg: 'rgba(148,163,184,0.16)' },
      cancelled: { label: 'Avbrutt', color: palette.textMuted, bg: 'rgba(148,163,184,0.16)' },
    };
    const s = map[status] ?? map.cancelled;
    return <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600 }} />;
  };
  return (
    <Stack spacing={1.4}>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 0.8 }}>
        {proposals.length} forslag — kun de som har godkjent vises i selve registeret. Forslag utløper etter 30 dager.
      </Typography>
      {proposals.map((p) => (
        <Box key={p.id} sx={{ ...cardSx, p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Stack spacing={0.4} sx={{ flexGrow: 1 }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.95rem' }}>
                {p.proposed_display_name || p.proposed_email}
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem' }}>{p.proposed_email}</Typography>
              {p.context_role ? (
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', mt: 0.6 }}>
                  Rolle: {p.context_role}
                </Typography>
              ) : null}
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
                {p.requested_scopes.slice(0, 5).map((s) => (
                  <Chip key={s} label={s} size="small" sx={{ bgcolor: 'rgba(168,85,247,0.10)', color: palette.textMuted, height: 18, fontSize: '0.7rem' }} />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={0.8} alignItems="flex-end">
              {statusBadge(p.status)}
              <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>
                Sendt {new Date(p.created_at).toLocaleDateString('nb-NO')}
              </Typography>
              {p.status === 'pending' && !demoMode ? (
                <Button
                  size="small"
                  onClick={async () => {
                    if (!window.confirm('Avbryt forslaget?')) return;
                    await roleRoomTalentsService.cancelAgencyProposal(p.id);
                    await onChanged();
                  }}
                  sx={{ color: '#f87171', textTransform: 'none', fontSize: '0.78rem' }}
                >
                  Avbryt
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function FilterField({ label, value, onChange, options, placeholder, optionsLabel }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  optionsLabel?: Record<string, string>;
}) {
  return (
    <Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 0.5 }}>{label}</Typography>
      <Select
        fullWidth
        size="small"
        value={value}
        displayEmpty
        onChange={(e) => onChange(e.target.value)}
        renderValue={(v) => (v ? (optionsLabel?.[v] ?? v) : (placeholder || 'Alle'))}
        sx={{ color: palette.textPrimary, fontSize: '0.85rem', bgcolor: palette.bgCardElevated, borderRadius: radius.sm, ...fieldSx['& .MuiOutlinedInput-root'] }}
      >
        {options.map((opt) => (
          <MenuItem key={opt || '__empty__'} value={opt}>
            {opt ? (optionsLabel?.[opt] ?? opt) : (placeholder || 'Alle')}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

function PlayingAgeField({ filters, onChange }: { filters: TalentSearchFilters; onChange: (f: Partial<TalentSearchFilters>) => void }) {
  const range = filters.age_min && filters.age_max ? `${filters.age_min}–${filters.age_max}` : filters.age_min ? `${filters.age_min}+` : '18–60+';
  return (
    <Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 0.5 }}>Spille-alder</Typography>
      <Select
        fullWidth size="small"
        value={range}
        renderValue={() => range}
        onChange={(e) => {
          const v = e.target.value as string;
          if (v === '18–60+') return onChange({ age_min: undefined, age_max: undefined });
          const [lo, hi] = v.split('–').map((x) => parseInt(x, 10));
          onChange({ age_min: lo || undefined, age_max: hi || undefined });
        }}
        sx={{ color: palette.textPrimary, fontSize: '0.85rem', bgcolor: palette.bgCardElevated, borderRadius: radius.sm, ...fieldSx['& .MuiOutlinedInput-root'] }}
      >
        <MenuItem value="18–60+">18–60+</MenuItem>
        <MenuItem value="16–25">16–25</MenuItem>
        <MenuItem value="20–30">20–30</MenuItem>
        <MenuItem value="25–35">25–35</MenuItem>
        <MenuItem value="30–45">30–45</MenuItem>
        <MenuItem value="40–60">40–60</MenuItem>
        <MenuItem value="50–80">50–80</MenuItem>
      </Select>
    </Box>
  );
}

function MultiField({ label, values, options, onChange }: { label: string; values: string[] | undefined; options: string[]; onChange: (v: string[]) => void }) {
  return (
    <Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 0.5 }}>{label}</Typography>
      <Select
        multiple fullWidth size="small"
        value={values || []}
        displayEmpty
        renderValue={(selected) => {
          const s = selected as string[];
          if (s.length === 0) return 'Alle';
          if (s.length === 1) return s[0];
          return `${s.length} valgt`;
        }}
        onChange={(e) => onChange(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
        sx={{ color: palette.textPrimary, fontSize: '0.85rem', bgcolor: palette.bgCardElevated, borderRadius: radius.sm, ...fieldSx['& .MuiOutlinedInput-root'] }}
      >
        {options.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
      </Select>
    </Box>
  );
}

function FeaturedCard({ talent }: { talent: TalentSearchHit }) {
  const age = talent.playing_age_min && talent.playing_age_max ? `${talent.playing_age_min}–${talent.playing_age_max}` : null;
  const langs = (talent.languages ?? []).map((l) => l.label).slice(0, 2).join(', ');
  return (
    <Box sx={{ p: 1.2, borderRadius: radius.md, bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`, display: 'flex', gap: 1.2 }}>
      <Avatar src={talent.headshot_url ?? undefined} sx={{ width: 56, height: 56, borderRadius: 1, bgcolor: 'rgba(168,85,247,0.18)' }}>
        {!talent.headshot_url ? <PersonOutlineIcon /> : null}
      </Avatar>
      <Stack spacing={0.2} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.88rem' }}>{talent.display_name}</Typography>
        {age ? <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>{age}</Typography> : null}
        {talent.city ? <Typography noWrap sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>{talent.city}</Typography> : null}
        {langs ? <Typography noWrap sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>{langs}</Typography> : null}
        {talent.availability_status === 'open' ? (
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 0.6 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: palette.success }} />
            <Typography sx={{ color: palette.success, fontSize: '0.72rem', fontWeight: 600 }}>Tilgjengelig</Typography>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function TalentCard({ talent }: { talent: TalentSearchHit }) {
  const age = talent.playing_age_min && talent.playing_age_max ? `${talent.playing_age_min}–${talent.playing_age_max}` : null;
  const langs = (talent.languages ?? []).map((l) => l.label).slice(0, 2).join(', ');
  const skills = (talent.skills ?? []).slice(0, 3);
  return (
    <Box sx={{ borderRadius: radius.lg, bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'relative', aspectRatio: '1 / 1', bgcolor: 'rgba(168,85,247,0.08)' }}>
        {talent.headshot_url ? (
          <Box component="img" src={talent.headshot_url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={talent.display_name} />
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonOutlineIcon sx={{ fontSize: 80, color: palette.textMuted }} />
          </Box>
        )}
        <IconButton sx={{ position: 'absolute', top: 8, right: 8, color: palette.accentBright, bgcolor: 'rgba(15,7,33,0.7)', '&:hover': { bgcolor: 'rgba(168,85,247,0.3)' } }}>
          <BookmarkIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ p: 1.4, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.95rem' }}>{talent.display_name}</Typography>
        <Stack direction="row" spacing={1.2} alignItems="center">
          {age ? <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{age}</Typography> : null}
          {talent.city ? (
            <Stack direction="row" spacing={0.4} alignItems="center">
              <LocationOnOutlinedIcon sx={{ color: palette.textMuted, fontSize: 14 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{talent.city}{talent.country && talent.country !== 'NO' ? `, ${talent.country}` : ', Norge'}</Typography>
            </Stack>
          ) : null}
        </Stack>
        {langs ? <Typography sx={{ color: palette.textMuted, fontSize: '0.75rem' }}>{langs}</Typography> : null}
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
          {skills.map((s, i) => (
            <Chip key={i} label={typeof s === 'string' ? s : s.label} size="small" sx={{ bgcolor: 'rgba(168,85,247,0.12)', color: palette.accentBright, fontSize: '0.7rem', height: 20 }} />
          ))}
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        {talent.availability_status === 'open' ? (
          <Stack direction="row" alignItems="center" spacing={0.6}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: palette.success }} />
            <Typography sx={{ color: palette.success, fontSize: '0.74rem', fontWeight: 600 }}>Tilgjengelig</Typography>
          </Stack>
        ) : talent.availability_status ? (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 500 }}>{talent.availability_status}</Typography>
        ) : null}
      </Box>
      <Stack direction="row" sx={{ borderTop: `1px solid ${palette.borderSubtle}` }}>
        <IconButton sx={{ flexGrow: 1, color: palette.textMuted, borderRadius: 0 }}><BookmarkAddOutlinedIcon fontSize="small" /></IconButton>
        <IconButton sx={{ flexGrow: 1, color: palette.textMuted, borderRadius: 0, borderLeft: `1px solid ${palette.borderSubtle}` }} disabled={!talent.has_showreel}><PlayCircleOutlineIcon fontSize="small" /></IconButton>
        <IconButton sx={{ flexGrow: 1, color: palette.textMuted, borderRadius: 0, borderLeft: `1px solid ${palette.borderSubtle}` }}><VisibilityIcon fontSize="small" /></IconButton>
      </Stack>
    </Box>
  );
}

function TalentListRow({ talent }: { talent: TalentSearchHit }) {
  return (
    <Box sx={{ ...cardSx, p: 1.4, display: 'flex', gap: 1.4, alignItems: 'center' }}>
      <Avatar src={talent.headshot_url ?? undefined} sx={{ width: 48, height: 48 }}>{!talent.headshot_url ? <PersonOutlineIcon /> : null}</Avatar>
      <Stack spacing={0.2} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>{talent.display_name}</Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>{talent.city || '—'} · {(talent.languages ?? []).map((l) => l.label).join(', ') || 'Ingen språk'}</Typography>
      </Stack>
      {talent.availability_status === 'open' ? <Chip label="Tilgjengelig" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.16)', color: palette.success }} /> : null}
      <IconButton sx={{ color: palette.textMuted }}><VisibilityIcon fontSize="small" /></IconButton>
    </Box>
  );
}

function SavedSearchRow({ search, onApply, onDelete }: { search: SavedSearch; onApply: () => void; onDelete: () => void }) {
  const desc = useMemo(() => {
    const parts: string[] = [];
    if (search.filters.location) parts.push(search.filters.location);
    if (search.filters.age_min || search.filters.age_max) parts.push(`${search.filters.age_min ?? ''}–${search.filters.age_max ?? ''}`);
    if (search.filters.skills?.length) parts.push(search.filters.skills.slice(0, 2).join('/'));
    if (search.filters.languages?.length) parts.push(search.filters.languages.slice(0, 2).join('/'));
    return parts.length ? parts.join(' · ') : 'Alle';
  }, [search.filters]);
  return (
    <Box onClick={onApply} sx={{ p: 1.2, borderRadius: radius.sm, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' }, display: 'grid', gridTemplateColumns: '32px 1fr 24px', gap: 1, alignItems: 'center' }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SearchIcon sx={{ color: palette.accentBright, fontSize: 16 }} />
      </Box>
      <Stack spacing={0.1} sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.85rem' }}>{search.name}</Typography>
        <Typography noWrap sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>{desc}</Typography>
        {search.estimated_count != null ? (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>{search.estimated_count} talents</Typography>
        ) : null}
      </Stack>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }} sx={{ color: palette.textMuted, '&:hover': { color: '#f87171' } }}>
        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}

function SaveSearchDialog({ open, filters, currentCount, onClose, onSaved }: { open: boolean; filters: TalentSearchFilters; currentCount: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    const r = await roleRoomTalentsService.createSavedSearch({ name, filters, shared, estimated_count: currentCount });
    setSaving(false);
    if ('error' in r) { setError(r.error); return; }
    setName(''); setShared(false);
    onSaved();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: `1px solid ${palette.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Lagre søk</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1.2 }}>
          <TextField autoFocus label="Navn" fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eks: Oslo 20–30 Drama" />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>
            Treff nå: <strong>{currentCount}</strong> talents
          </Typography>
          <FormControlLabel
            control={<Switch checked={shared} onChange={(e) => setShared(e.target.checked)} />}
            label="Del med alle i agency"
            sx={{ color: palette.textPrimary }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4 }}>
        <Button onClick={onClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>Avbryt</Button>
        <Button onClick={() => void handleSave()} disabled={saving || !name.trim()} startIcon={saving ? <CircularProgress size={14} /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}>
          Lagre søk
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Sparkline({ color, data }: { color: string; data: Array<{ day: string; n: number }> }) {
  // Ekte dynamisk sparkline med 30 datapunkter fra /agency/registry-overview.
  // Y-skala normaliseres til max-verdien i dataen (min 1 for å unngå div/0).
  const width = 320;
  const height = 60;
  const paddingTop = 6;
  const paddingBottom = 4;
  const usableHeight = height - paddingTop - paddingBottom;

  if (!data || data.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <text x={width / 2} y={height / 2} textAnchor="middle" fill={palette.textMuted} fontSize="11" fontFamily="sans-serif">
          Ingen aktivitet siste 30 dager
        </text>
      </svg>
    );
  }

  const maxVal = Math.max(1, ...data.map((d) => d.n));
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((d, i) => {
    const x = i * stepX;
    const y = height - paddingBottom - (d.n / maxVal) * usableHeight;
    return { x, y, val: d.n, day: d.day };
  });
  const polyPoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lastPt = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sl-fill-dyn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${polyPoints} ${width},${height}`} fill="url(#sl-fill-dyn)" />
      <polyline points={polyPoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="3" fill={color} />
      <title>
        {pts.map((p) => `${new Date(p.day).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}: ${p.val}`).join('\n')}
      </title>
    </svg>
  );
}
