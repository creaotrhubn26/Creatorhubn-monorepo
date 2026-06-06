/**
 * DancerProfileGrid — toolbar + responsivt grid av DancerProfileCard.
 *
 * Henter profiler via dancerProfileService ved mount og når projectId
 * endres. Viser også dansere uten profil enda (placeholder-card med
 * "Opprett profil"-knapp).
 *
 * Filter: alle / med profil / mangler / skadet
 * Søk:    case-insensitive på navn
 * Sort:   navn / sist oppdatert / primær stil
 */

import { danceFlowColors } from './danceFlowTheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { DancerProfileCard } from './DancerProfileCard';
import { DancerProfileEditor } from './DancerProfileEditor';
import {
  listDancerProfiles,
  type DancerProfile,
} from './dancerProfileService';
import type { Dancer } from './formationTypes';

type FilterMode = 'all' | 'with_profile' | 'missing' | 'injured';
type SortMode = 'name' | 'updated' | 'style';

// ─── Props ──────────────────────────────────────────────────────────────

export interface DancerStatsSnapshot {
  formationsCount: number;
  rehearsalsCount: number;
  annotationsCount: number;
}

export interface DancerProfileGridProps {
  /** Liste av dansere som skal vises (typisk DEMO_DANCERS eller fra crew). */
  dancers: readonly Dancer[];
  /** Valgfri prosjekt-scoping. */
  projectId?: string;
  /** Kalles når brukeren trykker "Legg til danser" (åpner ekstern modal). */
  onAddDancer?: () => void;
  /** F6-2: per-danser-statistikk. Hvis satt, rendres stats-chips på hvert kort. */
  statsByDancerId?: ReadonlyMap<string, DancerStatsSnapshot>;
}

// ─── Komponent ──────────────────────────────────────────────────────────

export const DancerProfileGrid: React.FC<DancerProfileGridProps> = ({
  dancers,
  projectId,
  onAddDancer,
  statsByDancerId,
}) => {
  const [profiles, setProfiles] = useState<Map<string, DancerProfile>>(() => new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [search, setSearch] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDancerId, setEditorDancerId] = useState<string | null>(null);

  // ─── Hent profiler ────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await listDancerProfiles(projectId);
      const m = new Map<string, DancerProfile>();
      for (const p of list) m.set(p.dancerId, p);
      setProfiles(m);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunne ikke hente profiler');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ─── Filter + sort ────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr: Dancer[] = [...dancers];

    if (q) {
      arr = arr.filter((d) => d.name.toLowerCase().includes(q));
    }

    if (filter !== 'all') {
      arr = arr.filter((d) => {
        const p = profiles.get(d.id);
        if (filter === 'with_profile') return !!p;
        if (filter === 'missing') return !p;
        if (filter === 'injured') return !!p && p.injuryStatus !== 'healthy';
        return true;
      });
    }

    arr.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'updated') {
        const pa = profiles.get(a.id);
        const pb = profiles.get(b.id);
        const ta = pa ? Date.parse(pa.updatedAt) : 0;
        const tb = pb ? Date.parse(pb.updatedAt) : 0;
        return tb - ta;
      }
      if (sortMode === 'style') {
        const pa = profiles.get(a.id);
        const pb = profiles.get(b.id);
        const sa = pa?.primaryStyle ?? '';
        const sb = pb?.primaryStyle ?? '';
        return sa.localeCompare(sb) || a.name.localeCompare(b.name);
      }
      return 0;
    });

    return arr;
  }, [dancers, profiles, filter, sortMode, search]);

  // ─── Editor handlers ──────────────────────────────
  const openEditorFor = useCallback((dancerId: string) => {
    setEditorDancerId(dancerId);
    setEditorOpen(true);
  }, []);

  const handleEditorSaved = useCallback((updated: DancerProfile) => {
    setProfiles((prev) => {
      const next = new Map(prev);
      next.set(updated.dancerId, updated);
      return next;
    });
  }, []);

  const editorDancer = useMemo(
    () => (editorDancerId ? dancers.find((d) => d.id === editorDancerId) ?? null : null),
    [editorDancerId, dancers],
  );
  const editorInitial = useMemo(
    () => (editorDancerId ? profiles.get(editorDancerId) ?? null : null),
    [editorDancerId, profiles],
  );

  // ─── Render ───────────────────────────────────────
  const totalCount = dancers.length;
  const profileCount = Array.from(profiles.values()).filter((p) =>
    dancers.some((d) => d.id === p.dancerId),
  ).length;

  return (
    <Box
      data-testid="dancer-profile-grid"
      sx={{
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textSecondary,
        minHeight: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        p: { xs: 2, md: 3 },
      }}
    >
      {/* ─── Header + toolbar ──────────────────────────── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontSize: 10, letterSpacing: 2, color: danceFlowColors.lavender, fontWeight: 700 }}>
            DANSERPROFILER
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {profileCount} av {totalCount} med profil
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Søk navn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ ...fieldSx, minWidth: 160 }}
            inputProps={{ 'data-testid': 'dancer-profile-search' }}
          />
          <TextField
            select
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterMode)}
            sx={{ ...fieldSx, minWidth: 140 }}
            inputProps={{ 'data-testid': 'dancer-profile-filter' }}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="with_profile">Med profil</MenuItem>
            <MenuItem value="missing">Mangler profil</MenuItem>
            <MenuItem value="injured">Skadet</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            sx={{ ...fieldSx, minWidth: 140 }}
            inputProps={{ 'data-testid': 'dancer-profile-sort' }}
          >
            <MenuItem value="name">Navn</MenuItem>
            <MenuItem value="updated">Sist oppdatert</MenuItem>
            <MenuItem value="style">Primær stil</MenuItem>
          </TextField>
          <Button
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
            onClick={() => void refresh()}
            disabled={loading}
            sx={{ textTransform: 'none', fontSize: 11, color: danceFlowColors.textMuted }}
          >
            Oppdater
          </Button>
          {onAddDancer && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={onAddDancer}
              data-testid="dancer-profile-add-dancer"
              sx={{
                textTransform: 'none',
                fontSize: 11,
                bgcolor: danceFlowColors.lavenderDark,
                '&:hover': { bgcolor: danceFlowColors.lavenderDeep },
              }}
            >
              Legg til danser
            </Button>
          )}
        </Stack>
      </Stack>

      {/* ─── Error / loading ───────────────────────────── */}
      {errorMsg && (
        <Typography
          sx={{ fontSize: 12, color: danceFlowColors.errorSoft, mb: 1.5 }}
          data-testid="dancer-profile-grid-error"
        >
          {errorMsg}
        </Typography>
      )}

      {loading && profiles.size === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={28} sx={{ color: danceFlowColors.lavender }} />
          <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled, mt: 1 }}>Henter profiler…</Typography>
        </Box>
      ) : dancers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontSize: 13, color: danceFlowColors.textDisabled, fontStyle: 'italic' }}>
            Ingen dansere koblet til prosjektet enda
          </Typography>
        </Box>
      ) : visible.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontSize: 12, color: danceFlowColors.textDisabled, fontStyle: 'italic' }}>
            Ingen dansere matcher filteret
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(3, 1fr)',
            },
            gap: 1.5,
          }}
        >
          {visible.map((d) => (
            <DancerProfileCard
              key={d.id}
              dancer={d}
              profile={profiles.get(d.id) ?? null}
              stats={statsByDancerId?.get(d.id)}
              onEdit={() => openEditorFor(d.id)}
            />
          ))}
        </Box>
      )}

      {/* ─── Editor-dialog ─────────────────────────────── */}
      {editorDancer && (
        <DancerProfileEditor
          open={editorOpen}
          dancer={editorDancer}
          initialProfile={editorInitial}
          projectId={projectId ?? null}
          onClose={() => setEditorOpen(false)}
          onSaved={handleEditorSaved}
        />
      )}
    </Box>
  );
};

const fieldSx = {
  '& .MuiInputBase-input': { color: danceFlowColors.textSecondary, fontSize: 11.5 },
  '& .MuiOutlinedInput-root': {
    bgcolor: danceFlowColors.bgPanel,
    '& fieldset': { borderColor: danceFlowColors.borderStrong },
    '&:hover fieldset': { borderColor: danceFlowColors.grayDark },
    '&.Mui-focused fieldset': { borderColor: danceFlowColors.lavenderDark },
  },
} as const;

export default DancerProfileGrid;
