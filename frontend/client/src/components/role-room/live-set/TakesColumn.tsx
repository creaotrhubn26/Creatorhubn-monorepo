/**
 * TakesColumn.tsx
 *
 * Venstre kolonne i LIVE-mode med takes-/notes-tabs, filter, og take-cards.
 * Speiler livesetmode.md §16.2.
 *
 * Bruker eksisterende useTakes-hook for real data — så LIVE SET PRO og
 * scene-edit-dialogen ser samme takes-state. UI-stil er PRO-tilpasset
 * (dark theme, kompakt layout).
 */

import React from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import { useTakes } from '../hooks/useTakes';
import type { CastingTake, ProcessingStatus } from '../services/takesClient';

// PRO-stil status-mapping
const STATUS_DISPLAY: Record<
  ProcessingStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: 'KLAR FOR ROLL', bg: 'rgba(220,38,38,0.18)', color: '#fca5a5' },
  queued: { label: 'I KØ', bg: 'rgba(100,116,139,0.18)', color: '#94a3b8' },
  processing: { label: 'PROSESSERER', bg: 'rgba(245,158,11,0.18)', color: '#fbbf24' },
  analyzed: { label: 'GODKJENT', bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
  failed: { label: 'PICKUP', bg: 'rgba(59,130,246,0.18)', color: '#93c5fd' },
};

interface TakesColumnProps {
  projectId: string;
  sceneId: string;
  selectedTakeId: string | null;
  onTakeSelect: (take: CastingTake) => void;
  onAddTake?: () => void;
}

type FilterOption = 'all' | 'circled' | 'pickup' | 'cam-a' | 'cam-b' | 'cam-c' | 'cam-d';

const FILTER_LABELS: Record<FilterOption, string> = {
  all: 'Alle takes',
  circled: 'Bare circled',
  pickup: 'Bare pickup',
  'cam-a': 'Bare Cam A',
  'cam-b': 'Bare Cam B',
  'cam-c': 'Bare Cam C',
  'cam-d': 'Bare Cam D',
};

function formatTimecode(durationSec: number | null): string {
  if (durationSec == null) return '00:00';
  const total = Math.round(durationSec);
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function TakeCard({
  take,
  selected,
  noteCount,
  onClick,
}: {
  take: CastingTake;
  selected: boolean;
  noteCount: number;
  onClick: () => void;
}) {
  const statusMeta = STATUS_DISPLAY[take.processingStatus];
  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: selected ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
        border: '1px solid',
        borderColor: selected ? '#dc2626' : 'rgba(255,255,255,0.06)',
        borderRadius: 1,
        p: 1.25,
        cursor: 'pointer',
        transition: 'all 120ms',
        '&:hover': {
          bgcolor: selected ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
          borderColor: selected ? '#dc2626' : 'rgba(255,255,255,0.12)',
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>
          TAKE {take.takeNumber.toString().padStart(2, '0')}
        </Typography>
        <Chip
          label={statusMeta.label}
          size="small"
          sx={{
            bgcolor: statusMeta.bg,
            color: statusMeta.color,
            fontSize: 9,
            fontWeight: 700,
            height: 18,
            letterSpacing: 0.5,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
        <span>Cam A</span>
        <span>·</span>
        <span>24mm</span>
        <span>·</span>
        <span>1.85:1</span>
        {noteCount > 0 && (
          <>
            <span>·</span>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <StickyNote2Icon sx={{ fontSize: 12 }} />
              <span>{noteCount}</span>
            </Stack>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
          {formatTimecode(take.durationSec)}
        </Typography>
      </Stack>
    </Box>
  );
}

export const TakesColumn: React.FC<TakesColumnProps> = ({
  projectId,
  sceneId,
  selectedTakeId,
  onTakeSelect,
  onAddTake,
}) => {
  const [tab, setTab] = React.useState<'takes' | 'notes'>('takes');
  const [filter, setFilter] = React.useState<FilterOption>('all');
  const { takes, loading } = useTakes(projectId, sceneId);

  // Klient-side filtrering (kan flyttes til server senere)
  const visible = takes.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'circled') return t.markedCircled;
    return true; // andre filtre venter på cam-tagging-feature
  });

  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: '#0a0a0a',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: 36,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          '& .MuiTab-root': {
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            minHeight: 36,
            py: 0.5,
          },
          '& .Mui-selected': { color: '#dc2626 !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#dc2626' },
        }}
      >
        <Tab value="takes" label="TAKES" />
        <Tab value="notes" label="NOTES" />
      </Tabs>

      {/* Filter */}
      <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1, alignItems: 'center' }}>
        <Select
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
          variant="outlined"
          sx={{
            flexGrow: 1,
            fontSize: 11,
            color: 'rgba(255,255,255,0.8)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
            '& .MuiSelect-select': { py: 0.5, px: 1 },
          }}
        >
          {(Object.keys(FILTER_LABELS) as FilterOption[]).map((k) => (
            <MenuItem key={k} value={k} sx={{ fontSize: 12 }}>
              Vis: {FILTER_LABELS[k]}
            </MenuItem>
          ))}
        </Select>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}>
          <FilterListIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Take cards */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5, py: 0.5 }}>
        {tab === 'takes' ? (
          loading && visible.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', py: 3 }}>
              Laster takes…
            </Typography>
          ) : visible.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', py: 3 }}>
              Ingen takes ennå
            </Typography>
          ) : (
            <Stack spacing={1}>
              {visible.map((take, idx) => (
                <TakeCard
                  key={take.id}
                  take={take}
                  selected={take.id === selectedTakeId}
                  noteCount={idx === 0 ? 2 : idx === 2 ? 1 : 0}
                  onClick={() => onTakeSelect(take)}
                />
              ))}
            </Stack>
          )
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', py: 3 }}>
            Notes-fanen kommer
          </Typography>
        )}
      </Box>

      {/* New take button */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onAddTake}
          sx={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.8)',
            borderColor: 'rgba(255,255,255,0.15)',
            '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
          }}
        >
          NYTT TAKE
        </Button>
      </Box>
    </Box>
  );
};

export default TakesColumn;
