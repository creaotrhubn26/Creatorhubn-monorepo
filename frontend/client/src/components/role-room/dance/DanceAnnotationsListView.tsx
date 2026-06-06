/**
 * DanceAnnotationsListView — tabell over ALLE annotations på tvers av clips
 * i et prosjekt. Rute fra nav-item 'Annotations' i DanceAnnotateLayout.
 *
 * Funksjonalitet:
 *   - Sort på Clip, Start-tid, Kategori, Label, Dancer (klikk-på-header)
 *   - Filter via søk (label + notes) + dropdown (kategori) + dropdown (clip)
 *   - Sammendrag-bar: total / synlige (filtrert) / pågående kategori-filter
 *   - Klikk-på-rad navigerer til Annotate-flate med valgt clip + selectedId
 *
 * Tom-state: 'Ingen annotations ennå' med CTA tilbake til Annotate-flaten.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';

import { useDanceAnnotationsAggregate, type AggregatedAnnotation } from './useDanceAnnotationsAggregate';
import { useDanceAnnotationCatalog } from './useDanceAnnotationCatalog';
import { formatTimecode } from './timecode';
import { danceFlowColors } from './danceFlowTheme';

export interface DanceAnnotationsListViewProps {
  projectId: string | null;
  dancerOptions: Array<{ id: string; label: string }>;
  /** Kalt når brukeren klikker rad — navigerer til Annotate-flate. */
  onOpenAnnotation: (clipId: string, annotationId: string, clipTitle: string, durationSec: number) => void;
}

type SortKey = 'clip' | 'start' | 'category' | 'label' | 'dancer';

interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const HEADERS: ReadonlyArray<{ key: SortKey; label: string; width?: string }> = [
  { key: 'clip', label: 'Clip', width: '20%' },
  { key: 'start', label: 'Start', width: '12%' },
  { key: 'category', label: 'Category', width: '15%' },
  { key: 'label', label: 'Label', width: '23%' },
  { key: 'dancer', label: 'Dancer', width: '15%' },
];

function compareSort(
  a: AggregatedAnnotation,
  b: AggregatedAnnotation,
  key: SortKey,
  dancerLabel: (id: string) => string,
): number {
  switch (key) {
    case 'clip':
      return a.clipTitle.localeCompare(b.clipTitle);
    case 'start':
      return a.timestampSec - b.timestampSec;
    case 'category':
      return (a.category ?? '').localeCompare(b.category ?? '');
    case 'label':
      return a.body.localeCompare(b.body);
    case 'dancer': {
      const aD = a.targetDancerIds[0] ? dancerLabel(a.targetDancerIds[0]) : '';
      const bD = b.targetDancerIds[0] ? dancerLabel(b.targetDancerIds[0]) : '';
      return aD.localeCompare(bD);
    }
    default:
      return 0;
  }
}

export default function DanceAnnotationsListView({
  projectId,
  dancerOptions,
  onOpenAnnotation,
}: DanceAnnotationsListViewProps): React.ReactElement {
  const aggregate = useDanceAnnotationsAggregate({ projectId });
  const catalog = useDanceAnnotationCatalog({ projectId });

  const [search, setSearch] = React.useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = React.useState<string>('');
  const [filterClipId, setFilterClipId] = React.useState<string>('');
  const [sort, setSort] = React.useState<SortState>({ key: 'clip', dir: 'asc' });

  const dancerLabel = React.useCallback(
    (id: string): string => dancerOptions.find((d) => d.id === id)?.label ?? id,
    [dancerOptions],
  );

  const categoryById = React.useCallback(
    (id: string | null) => id ? catalog.categories.find((c) => c.id === id) ?? null : null,
    [catalog.categories],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = aggregate.annotations.filter((a) => {
      if (filterCategoryId && a.category !== filterCategoryId) return false;
      if (filterClipId && a.clipId !== filterClipId) return false;
      if (q && !a.body.toLowerCase().includes(q) && !a.clipTitle.toLowerCase().includes(q)) return false;
      return true;
    });
    const cmp = (a: AggregatedAnnotation, b: AggregatedAnnotation): number => {
      const v = compareSort(a, b, sort.key, dancerLabel);
      return sort.dir === 'asc' ? v : -v;
    };
    rows = [...rows].sort(cmp);
    return rows;
  }, [aggregate.annotations, search, filterCategoryId, filterClipId, sort, dancerLabel]);

  const toggleSort = (key: SortKey): void => {
    setSort((cur) => cur.key === key
      ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  return (
    <Box
      data-testid="dance-annotations-list-view"
      sx={{
        p: 2, height: '100%', minHeight: '100vh',
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textPrimary,
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
          Annotations
        </Typography>
        <Chip
          size="small"
          label={`${filtered.length} / ${aggregate.annotations.length}`}
          data-testid="dance-annotations-count-chip"
          sx={{
            mr: 1, fontWeight: 700, fontSize: 11,
            bgcolor: 'rgba(167,139,250,0.12)',
            color: danceFlowColors.lavender,
          }}
        />
        <IconButton
          size="small"
          onClick={() => { void aggregate.refresh(); }}
          disabled={aggregate.loading}
          data-testid="dance-annotations-refresh"
          sx={{ color: danceFlowColors.textMuted }}
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {/* Filter-rad */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <Box
          sx={{
            flex: 1, display: 'flex', alignItems: 'center',
            bgcolor: danceFlowColors.bgInset,
            border: `1px solid ${danceFlowColors.borderSoft}`,
            borderRadius: 1, px: 1, py: 0.25,
            '&:focus-within': { borderColor: danceFlowColors.lavender },
          }}
        >
          <SearchIcon sx={{ fontSize: 14, color: danceFlowColors.textDisabled, mr: 0.5 }} />
          <InputBase
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i label / clip-navn / notes…"
            data-testid="dance-annotations-search"
            sx={{
              flex: 1, fontSize: 12, color: danceFlowColors.textSecondary,
              '& input::placeholder': { color: danceFlowColors.textDisabled, opacity: 1 },
            }}
          />
          {search ? (
            <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.25, color: danceFlowColors.textDisabled }}>
              <ClearIcon sx={{ fontSize: 12 }} />
            </IconButton>
          ) : null}
        </Box>
        <TextField
          select
          size="small"
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          data-testid="dance-annotations-filter-category"
          sx={{
            minWidth: 160,
            '& .MuiInputBase-input': { fontSize: 12, color: danceFlowColors.textSecondary },
          }}
        >
          <MenuItem value="" sx={{ fontSize: 12 }}>Alle kategorier</MenuItem>
          {catalog.categories.map((c) => (
            <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>
              <Box
                component="span"
                sx={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  bgcolor: c.color, mr: 1, verticalAlign: 'middle',
                }}
              />
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={filterClipId}
          onChange={(e) => setFilterClipId(e.target.value)}
          data-testid="dance-annotations-filter-clip"
          sx={{
            minWidth: 180,
            '& .MuiInputBase-input': { fontSize: 12, color: danceFlowColors.textSecondary },
          }}
        >
          <MenuItem value="" sx={{ fontSize: 12 }}>Alle clips</MenuItem>
          {aggregate.clips.map((c) => (
            <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>
              {c.title}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Loading / empty / table */}
      {aggregate.loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} sx={{ color: danceFlowColors.lavender }} />
        </Stack>
      ) : aggregate.error ? (
        <Box
          data-testid="dance-annotations-error"
          sx={{
            p: 2, borderRadius: 1,
            bgcolor: 'rgba(248,113,113,0.08)',
            border: `1px solid rgba(248,113,113,0.2)`,
            color: danceFlowColors.errorPrimary,
            fontSize: 12,
          }}
        >
          {aggregate.error}
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          data-testid="dance-annotations-empty"
          sx={{
            p: 6, textAlign: 'center',
            border: `1px dashed ${danceFlowColors.borderStrong}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}
        >
          <Typography sx={{ fontSize: 14, color: danceFlowColors.textSecondary, mb: 1 }}>
            {aggregate.annotations.length === 0
              ? 'Ingen annotations ennå'
              : 'Ingen annotations matchet filtrene'}
          </Typography>
          {aggregate.annotations.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: danceFlowColors.textMuted }}>
              Velg en clip i Annotate-flaten og legg til annotations med tastatur-snarvei <strong>A</strong>.
            </Typography>
          ) : (
            <Button
              size="small"
              onClick={() => { setSearch(''); setFilterCategoryId(''); setFilterClipId(''); }}
              data-testid="dance-annotations-clear-filters"
              sx={{ textTransform: 'none', color: danceFlowColors.lavender }}
            >
              Fjern alle filtre
            </Button>
          )}
        </Box>
      ) : (
        <Box
          component="table"
          data-testid="dance-annotations-table"
          sx={{
            width: '100%', borderCollapse: 'collapse', fontSize: 12,
            bgcolor: danceFlowColors.bgPanel,
            border: `1px solid ${danceFlowColors.borderStrong}`,
            borderRadius: 1, overflow: 'hidden',
            '& th, & td': {
              padding: '8px 12px',
              borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
              textAlign: 'left',
            },
            '& th': {
              bgcolor: 'rgba(167,139,250,0.04)',
              color: danceFlowColors.textMuted,
              fontWeight: 700, letterSpacing: 0.5, fontSize: 10,
              textTransform: 'uppercase',
              cursor: 'pointer',
              userSelect: 'none',
            },
            '& tbody tr': {
              cursor: 'pointer',
              transition: 'background-color 120ms',
              '&:hover': { bgcolor: 'rgba(167,139,250,0.04)' },
            },
            '& tbody tr:last-of-type td': { borderBottom: 'none' },
          }}
        >
          <thead>
            <tr>
              {HEADERS.map((h) => {
                const isActive = sort.key === h.key;
                return (
                  <th
                    key={h.key}
                    style={{ width: h.width }}
                    onClick={() => toggleSort(h.key)}
                    data-testid={`dance-annotations-header-${h.key}`}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <span>{h.label}</span>
                      {isActive ? (
                        sort.dir === 'asc'
                          ? <ArrowUpIcon sx={{ fontSize: 12 }} />
                          : <ArrowDownIcon sx={{ fontSize: 12 }} />
                      ) : null}
                    </Stack>
                  </th>
                );
              })}
              <th style={{ width: '15%' }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const cat = categoryById(a.category);
              const duration = a.endSec != null ? a.endSec - a.timestampSec : null;
              return (
                <tr
                  key={a.id}
                  data-testid={`dance-annotations-row-${a.id}`}
                  onClick={() => onOpenAnnotation(
                    a.clipId,
                    a.id,
                    a.clipTitle,
                    a.clipDurationSec ?? 60,
                  )}
                >
                  <td style={{ color: danceFlowColors.textSecondary }}>{a.clipTitle}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', color: danceFlowColors.textSecondary }}>
                    {formatTimecode(a.timestampSec)}
                  </td>
                  <td>
                    {cat ? (
                      <Chip
                        size="small"
                        label={cat.name}
                        sx={{
                          height: 18, fontSize: 10, fontWeight: 700,
                          bgcolor: `${cat.color}22`,
                          color: cat.color,
                          border: `1px solid ${cat.color}55`,
                        }}
                      />
                    ) : (
                      <Box component="span" sx={{ color: danceFlowColors.textDisabled }}>—</Box>
                    )}
                  </td>
                  <td style={{ color: danceFlowColors.textPrimary, fontWeight: 600 }}>
                    {a.body || '—'}
                  </td>
                  <td style={{ color: danceFlowColors.textSecondary }}>
                    {a.targetDancerIds.length > 0
                      ? a.targetDancerIds.map(dancerLabel).join(', ')
                      : '—'}
                  </td>
                  <td style={{
                    fontFamily: 'ui-monospace, monospace',
                    color: danceFlowColors.textMuted,
                  }}>
                    {duration != null ? `${duration.toFixed(1)}s` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Box>
      )}
    </Box>
  );
}
