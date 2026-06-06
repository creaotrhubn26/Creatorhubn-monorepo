/**
 * AnnotateCategoryToolsPanel — CATEGORY TOOLS-panel i DanceAnnotate-mockup.
 *
 * Nå dynamisk via dance-annotation-catalog (migrasjon 217). 5 defaults
 * (steps/arms/body/jumps/turns) auto-seedes ved første access; brukeren
 * kan legge til, redigere navn/farge, og slette egne (defaults er
 * server-side protected).
 *
 * Klikk på rad: aktiver kategori for neste annotation.
 * Hover/right-click på rad: 'Rediger'-ikon vises (åpner dialog).
 * '+ Add Category': åpner dialog i create-modus.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';

import type { AnnotationCategoryRecord } from './danceAnnotationCatalogService';
import AnnotateCategoryDialog from './AnnotateCategoryDialog';
import { danceFlowColors } from './danceFlowTheme';

export interface AnnotateCategoryToolsPanelProps {
  categories: readonly AnnotationCategoryRecord[];
  activeCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onCreate: (input: {
    name: string;
    color: string;
    shortcut: string | null;
  }) => Promise<void>;
  onPatch: (id: string, patch: {
    name?: string;
    color?: string;
    shortcut?: string | null;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  /** Read-only-modus skjuler edit/add/delete. */
  readOnly?: boolean;
}

export default function AnnotateCategoryToolsPanel({
  categories,
  activeCategoryId,
  onSelectCategory,
  onCreate,
  onPatch,
  onDelete,
  readOnly = false,
}: AnnotateCategoryToolsPanelProps): React.ReactElement {
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
  const [editing, setEditing] = React.useState<AnnotationCategoryRecord | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  // '+ Add Track'-knappen i AnnotationTimeline (under timeline-tracks) er
  // funksjonelt det samme som '+ Add Category'-knappen i denne panelet —
  // begge oppretter en ny kategori (= track). Vi lytter på dance:add-track
  // og åpner samme dialog så bruker-flowen er konsistent.
  React.useEffect(() => {
    if (readOnly) return;
    const handler = (): void => {
      setEditing(null);
      setDialogOpen(true);
    };
    window.addEventListener('dance:add-track', handler);
    return () => window.removeEventListener('dance:add-track', handler);
  }, [readOnly]);

  const existingShortcuts = React.useMemo(
    () => categories.map((c) => c.shortcut),
    [categories],
  );

  const openCreate = (): void => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: AnnotationCategoryRecord): void => {
    setEditing(c); setDialogOpen(true);
  };

  const handleSave = async (input: {
    name: string; color: string; shortcut: string | null;
  }): Promise<void> => {
    if (editing) {
      await onPatch(editing.id, input);
    } else {
      await onCreate(input);
    }
  };

  const handleDeleteFromDialog = editing && !editing.isDefault
    ? async (): Promise<void> => { await onDelete(editing.id); }
    : undefined;

  return (
    <Box data-testid="annotate-category-tools">
      <Typography
        variant="overline"
        sx={{
          display: 'block', mb: 1,
          color: danceFlowColors.textMuted,
          fontWeight: 700, letterSpacing: 1.2, fontSize: 11,
        }}
      >
        Category Tools
      </Typography>
      <Stack spacing={0.5}>
        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          const isHover = hoverId === cat.id;
          return (
            <Box
              key={cat.id}
              data-testid={`annotate-category-${cat.id}`}
              onMouseEnter={() => setHoverId(cat.id)}
              onMouseLeave={() => setHoverId((cur) => (cur === cat.id ? null : cur))}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.25, py: 0.75,
                borderRadius: 1,
                bgcolor: isActive ? `${cat.color}1f` : 'rgba(255,255,255,0.03)',
                color: isActive ? cat.color : danceFlowColors.textSecondary,
                transition: 'background-color 120ms',
                '&:hover': {
                  bgcolor: `${cat.color}14`,
                },
              }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => onSelectCategory(isActive ? null : cat.id)}
                aria-pressed={isActive}
                sx={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 1,
                  border: 'none', bgcolor: 'transparent',
                  cursor: 'pointer', font: 'inherit',
                  color: 'inherit',
                  textAlign: 'left',
                  '&:focus-visible': {
                    outline: `2px solid ${cat.color}`,
                    outlineOffset: 1,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: cat.color, flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                  {cat.name}
                </Box>
              </Box>

              {!readOnly && isHover ? (
                <Tooltip title={cat.isDefault ? 'Rediger navn/farge (default kan ikke slettes)' : 'Rediger'}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                    data-testid={`annotate-category-${cat.id}-edit`}
                    sx={{
                      p: 0.25,
                      color: danceFlowColors.textMuted,
                      '&:hover': { color: cat.color },
                    }}
                  >
                    <EditIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              ) : null}

              {cat.shortcut ? (
                <Box
                  sx={{
                    fontSize: 10, fontWeight: 700,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: danceFlowColors.textMuted,
                    px: 0.75, py: 0.125,
                    borderRadius: 0.5, fontFamily: 'ui-monospace, monospace',
                    minWidth: 18, textAlign: 'center',
                  }}
                >
                  {cat.shortcut}
                </Box>
              ) : null}
            </Box>
          );
        })}

        {!readOnly ? (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={openCreate}
            data-testid="annotate-category-add"
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
            Add Category
          </Button>
        ) : null}
      </Stack>

      <AnnotateCategoryDialog
        open={dialogOpen}
        editing={editing}
        existingShortcuts={existingShortcuts}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDeleteFromDialog}
      />
    </Box>
  );
}
