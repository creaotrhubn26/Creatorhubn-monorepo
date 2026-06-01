/**
 * AnnotateCommonLabelsPanel — COMMON LABELS-panel i DanceAnnotate-mockup.
 *
 * Søk + scrollable liste over pre-definerte labels for valgt kategori
 * (Walk, Chassé, Step, Slide, Run, Kick for steps; Reach Up, Sweep, etc.
 * for arms). Klikk = aktiver label for neste annotation.
 *
 * Per-prosjekt egne labels via "+ Add Label"-knapp (stub inntil migrasjon).
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

import { commonLabelsFor, categoryById } from './danceMovementCategories';
import { danceFlowColors } from './danceFlowTheme';

export interface AnnotateCommonLabelsPanelProps {
  /** Aktiv kategori (avgjør hvilke labels som vises). Null = vis alle. */
  activeCategoryId: string | null;
  /** Aktiv label (highlight). */
  activeLabel: string | null;
  onSelectLabel: (label: string | null) => void;
  /** Stub inntil pr-prosjekt labels får migrasjon. */
  onAddLabel?: () => void;
}

const ALL_CATEGORY_IDS = ['steps', 'arms', 'body', 'jumps', 'turns'] as const;

export default function AnnotateCommonLabelsPanel({
  activeCategoryId,
  activeLabel,
  onSelectLabel,
  onAddLabel,
}: AnnotateCommonLabelsPanelProps): React.ReactElement {
  const [search, setSearch] = React.useState<string>('');

  // Hvis ingen kategori er valgt, slå sammen alle som flat-list (matcher
  // mockupens "alle labels"-visning når man ikke har låst kategori).
  const labels = React.useMemo<readonly string[]>(() => {
    if (activeCategoryId) return commonLabelsFor(activeCategoryId);
    const all: string[] = [];
    for (const cid of ALL_CATEGORY_IDS) {
      for (const l of commonLabelsFor(cid)) {
        if (!all.includes(l)) all.push(l);
      }
    }
    return all;
  }, [activeCategoryId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) => l.toLowerCase().includes(q));
  }, [labels, search]);

  const cat = categoryById(activeCategoryId);

  return (
    <Box data-testid="annotate-common-labels">
      <Typography
        variant="overline"
        sx={{
          display: 'block', mb: 1,
          color: danceFlowColors.textMuted,
          fontWeight: 700, letterSpacing: 1.2, fontSize: 11,
        }}
      >
        Common Labels
      </Typography>

      {/* Search-input */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: danceFlowColors.bgInset,
          border: `1px solid ${danceFlowColors.borderSoft}`,
          borderRadius: 1, px: 1, py: 0.25, mb: 1,
          '&:focus-within': { borderColor: danceFlowColors.lavender },
        }}
      >
        <SearchIcon sx={{ fontSize: 14, color: danceFlowColors.textDisabled, mr: 0.5 }} />
        <InputBase
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search labels…"
          data-testid="annotate-labels-search"
          sx={{
            flex: 1, fontSize: 12, color: danceFlowColors.textSecondary,
            '& input': { p: 0.5 },
            '& input::placeholder': {
              color: danceFlowColors.textDisabled, opacity: 1,
            },
          }}
        />
        {search ? (
          <IconButton
            size="small"
            onClick={() => setSearch('')}
            sx={{ p: 0.25, color: danceFlowColors.textDisabled }}
          >
            <ClearIcon sx={{ fontSize: 12 }} />
          </IconButton>
        ) : null}
      </Box>

      <Stack spacing={0.25}>
        {filtered.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled, p: 0.75 }}>
            Ingen labels matchet «{search}».
          </Typography>
        ) : (
          filtered.map((label) => {
            const isActive = activeLabel === label;
            return (
              <Box
                key={label}
                component="button"
                type="button"
                onClick={() => onSelectLabel(isActive ? null : label)}
                data-testid={`annotate-label-${label.replace(/\s+/g, '-').toLowerCase()}`}
                aria-pressed={isActive}
                sx={{
                  display: 'flex', alignItems: 'center',
                  px: 1.25, py: 0.75,
                  border: 'none', borderRadius: 1,
                  cursor: 'pointer', font: 'inherit', width: '100%',
                  bgcolor: isActive
                    ? (cat ? `${cat.color}26` : 'rgba(167,139,250,0.18)')
                    : 'transparent',
                  color: isActive
                    ? (cat?.color ?? danceFlowColors.lavender)
                    : danceFlowColors.textSecondary,
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  textAlign: 'left',
                  transition: 'background-color 120ms',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  '&:focus-visible': {
                    outline: `2px solid ${danceFlowColors.lavender}`,
                    outlineOffset: 1,
                  },
                }}
              >
                {label}
              </Box>
            );
          })
        )}
        <Button
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={onAddLabel}
          disabled={!onAddLabel}
          data-testid="annotate-label-add"
          sx={{
            mt: 0.5,
            justifyContent: 'flex-start',
            textTransform: 'none',
            color: danceFlowColors.textMuted,
            fontSize: 12, fontWeight: 600,
            border: `1px dashed ${danceFlowColors.borderStrong}`,
            borderRadius: 1,
            px: 1.25, py: 0.75,
            '&:hover': {
              color: danceFlowColors.lavender,
              borderColor: danceFlowColors.lavender,
              bgcolor: 'rgba(167,139,250,0.06)',
            },
          }}
        >
          Add Label
        </Button>
      </Stack>
    </Box>
  );
}
