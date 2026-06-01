/**
 * AnnotateCommonLabelsPanel — COMMON LABELS-panel i DanceAnnotate.
 *
 * Nå dynamisk via dance-annotation-catalog. Labels-bibliotek lagres per
 * (owner, project, optional category). Defaults seedes IKKE — brukeren
 * legger til ved behov. Søk-filter på navn.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

import type {
  AnnotationLabelRecord,
  AnnotationCategoryRecord,
} from './danceAnnotationCatalogService';
import AnnotateLabelDialog from './AnnotateLabelDialog';
import { danceFlowColors } from './danceFlowTheme';

export interface AnnotateCommonLabelsPanelProps {
  categories: readonly AnnotationCategoryRecord[];
  labels: readonly AnnotationLabelRecord[];
  /** Aktiv kategori — filtrerer label-listen. */
  activeCategoryId: string | null;
  activeLabel: string | null;
  onSelectLabel: (label: string | null) => void;
  onCreate: (input: { name: string; categoryId: string | null }) => Promise<void>;
  onPatch: (id: string, patch: { name?: string; categoryId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export default function AnnotateCommonLabelsPanel({
  categories,
  labels,
  activeCategoryId,
  activeLabel,
  onSelectLabel,
  onCreate,
  onPatch,
  onDelete,
  readOnly = false,
}: AnnotateCommonLabelsPanelProps): React.ReactElement {
  const [search, setSearch] = React.useState<string>('');
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
  const [editing, setEditing] = React.useState<AnnotationLabelRecord | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    // Hvis activeCategoryId er satt, vis labels for den kategorien + globale.
    // Ellers vis alle.
    const inScope = activeCategoryId
      ? labels.filter((l) => l.categoryId === activeCategoryId || l.categoryId == null)
      : labels;
    if (!q) return inScope;
    return inScope.filter((l) => l.name.toLowerCase().includes(q));
  }, [labels, search, activeCategoryId]);

  const activeCat = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId) ?? null
    : null;

  const openCreate = (): void => { setEditing(null); setDialogOpen(true); };
  const openEdit = (l: AnnotationLabelRecord): void => {
    setEditing(l); setDialogOpen(true);
  };

  const handleSave = async (input: {
    name: string; categoryId: string | null;
  }): Promise<void> => {
    if (editing) {
      await onPatch(editing.id, input);
    } else {
      await onCreate(input);
    }
  };

  const handleDeleteFromDialog = editing
    ? async (): Promise<void> => { await onDelete(editing.id); }
    : undefined;

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
            {labels.length === 0
              ? 'Ingen labels ennå. Trykk + Add Label for å legge til.'
              : search
                ? `Ingen labels matchet «${search}».`
                : 'Ingen labels for valgt kategori.'}
          </Typography>
        ) : (
          filtered.map((label) => {
            const isActive = activeLabel === label.name;
            const cat = label.categoryId
              ? categories.find((c) => c.id === label.categoryId) ?? null
              : activeCat;
            const isHover = hoverId === label.id;
            return (
              <Box
                key={label.id}
                data-testid={`annotate-label-${label.name.replace(/\s+/g, '-').toLowerCase()}`}
                onMouseEnter={() => setHoverId(label.id)}
                onMouseLeave={() => setHoverId((cur) => (cur === label.id ? null : cur))}
                sx={{
                  display: 'flex', alignItems: 'center',
                  px: 1.25, py: 0.75, borderRadius: 1,
                  bgcolor: isActive
                    ? (cat ? `${cat.color}26` : 'rgba(167,139,250,0.18)')
                    : 'transparent',
                  color: isActive
                    ? (cat?.color ?? danceFlowColors.lavender)
                    : danceFlowColors.textSecondary,
                  transition: 'background-color 120ms',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => onSelectLabel(isActive ? null : label.name)}
                  aria-pressed={isActive}
                  sx={{
                    flex: 1, textAlign: 'left',
                    border: 'none', bgcolor: 'transparent',
                    cursor: 'pointer', font: 'inherit',
                    color: 'inherit',
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    '&:focus-visible': {
                      outline: `2px solid ${danceFlowColors.lavender}`,
                      outlineOffset: 1,
                    },
                  }}
                >
                  {label.name}
                </Box>
                {!readOnly && isHover ? (
                  <Tooltip title="Rediger label">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openEdit(label); }}
                      data-testid={`annotate-label-${label.id}-edit`}
                      sx={{
                        p: 0.25,
                        color: danceFlowColors.textMuted,
                        '&:hover': { color: cat?.color ?? danceFlowColors.lavender },
                      }}
                    >
                      <EditIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
            );
          })
        )}

        {!readOnly ? (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={openCreate}
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
        ) : null}
      </Stack>

      <AnnotateLabelDialog
        open={dialogOpen}
        editing={editing}
        defaultCategoryId={activeCategoryId}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDeleteFromDialog}
      />
    </Box>
  );
}
