/**
 * AnnotateCategoryToolsPanel — CATEGORY TOOLS-panel i DanceAnnotate-mockup.
 *
 * Liste over de 5 kategoriene (Steps/Arms/Body/Jumps/Turns) med keybind-
 * snarvei (1-5) + "+ Add Category"-knapp. Klikk aktiverer kategori for
 * neste annotation som lages.
 *
 * Categories er definert i danceMovementCategories.ts. Add Category er
 * UI-stub inntil prosjekt-spesifikke kategorier får migrasjon.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Add as AddIcon } from '@mui/icons-material';

import { DANCE_MOVEMENT_CATEGORIES } from './danceMovementCategories';
import { danceFlowColors } from './danceFlowTheme';

export interface AnnotateCategoryToolsPanelProps {
  activeCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  /** Stub-handler inntil add-category-flyt er bygd. */
  onAddCategory?: () => void;
}

export default function AnnotateCategoryToolsPanel({
  activeCategoryId,
  onSelectCategory,
  onAddCategory,
}: AnnotateCategoryToolsPanelProps): React.ReactElement {
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
        {DANCE_MOVEMENT_CATEGORIES.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          return (
            <Box
              key={cat.id}
              component="button"
              type="button"
              data-testid={`annotate-category-${cat.id}`}
              aria-pressed={isActive}
              onClick={() => onSelectCategory(isActive ? null : cat.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.25, py: 0.75,
                border: 'none', borderRadius: 1,
                cursor: 'pointer', font: 'inherit', width: '100%',
                bgcolor: isActive ? `${cat.color}1f` : 'rgba(255,255,255,0.03)',
                color: isActive ? cat.color : danceFlowColors.textSecondary,
                transition: 'background-color 120ms',
                '&:hover': {
                  bgcolor: `${cat.color}14`,
                },
                '&:focus-visible': {
                  outline: `2px solid ${cat.color}`,
                  outlineOffset: 1,
                },
              }}
            >
              {/* Color-dot */}
              <Box
                sx={{
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: cat.color, flexShrink: 0,
                }}
              />
              <Box sx={{
                flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600,
              }}>
                {cat.label}
              </Box>
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
            </Box>
          );
        })}
        <Button
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={onAddCategory}
          disabled={!onAddCategory}
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
      </Stack>
    </Box>
  );
}
