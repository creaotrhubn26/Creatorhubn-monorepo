/**
 * AnnotationDetailsPanel — DanceAnnotate-paritet "Selected Annotation"-panel.
 *
 * Viser detaljene for valgt annotation: label/body, time range, dancer,
 * category, confidence, notes. Edit-modus åpner et structured form.
 * Delete-knapp + edit-knapp øverst.
 */

import React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Tooltip, TextField, Button, MenuItem } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import type { VideoAnnotation, AnnotationStatus } from './danceVideoService';
import { categoryById, DANCE_MOVEMENT_CATEGORIES } from './danceMovementCategories';
import { formatTimecode, parseTimecode } from './timecode';

const PURPLE_LIGHT = '#a78bfa';
const TEXT_DIM = 'rgba(229,231,235,0.55)';

export interface AnnotationDetailsPanelProps {
  annotation: VideoAnnotation;
  dancerOptions: Array<{ id: string; label: string }>;
  fps?: number;
  onClose: () => void;
  onDelete: () => void;
  onPatch: (patch: { body?: string; category?: string | null; targetDancerIds?: string[] }) => void;
}

export function AnnotationDetailsPanel({
  annotation,
  dancerOptions,
  fps = 30,
  onClose,
  onDelete,
  onPatch,
}: AnnotationDetailsPanelProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draftBody, setDraftBody] = React.useState(annotation.body);
  const [draftCategory, setDraftCategory] = React.useState<string | null>(annotation.category);
  const [draftDancer, setDraftDancer] = React.useState<string>(annotation.targetDancerIds[0] ?? '');

  React.useEffect(() => {
    setDraftBody(annotation.body);
    setDraftCategory(annotation.category);
    setDraftDancer(annotation.targetDancerIds[0] ?? '');
    setEditing(false);
  }, [annotation.id, annotation.body, annotation.category, annotation.targetDancerIds]);

  const cat = categoryById(annotation.category);
  const endTc = annotation.endSec != null
    ? formatTimecode(annotation.endSec, fps)
    : formatTimecode(annotation.timestampSec + 2, fps);

  const save = (): void => {
    onPatch({
      body: draftBody.trim() || annotation.body,
      category: draftCategory,
      targetDancerIds: draftDancer ? [draftDancer] : [],
    });
    setEditing(false);
  };

  return (
    <Box
      data-testid="annotation-details-panel"
      sx={{ p: 1.5, borderTop: '1px solid rgba(139,92,246,0.18)', bgcolor: '#0d0f14' }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 10, letterSpacing: 1.8, color: PURPLE_LIGHT, fontWeight: 700, flex: 1 }}>
          SELECTED ANNOTATION
        </Typography>
        <Tooltip title="Rediger">
          <IconButton
            size="small"
            onClick={() => setEditing((v) => !v)}
            data-testid="annotation-details-edit"
            sx={{ color: editing ? '#34d399' : PURPLE_LIGHT, p: 0.5 }}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Slett">
          <IconButton
            size="small"
            onClick={onDelete}
            data-testid="annotation-details-delete"
            sx={{ color: '#9ca3af', p: 0.5, '&:hover': { color: '#f87171' } }}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Lukk">
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: '#9ca3af', p: 0.5 }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {editing ? (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Label"
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            inputProps={{ 'data-testid': 'annotation-details-label-input' }}
            fullWidth
            sx={{ '& .MuiInputBase-input': { fontSize: 12, color: '#e5e7eb' } }}
          />
          <TextField
            select
            size="small"
            label="Kategori"
            value={draftCategory ?? ''}
            onChange={(e) => setDraftCategory(e.target.value || null)}
            inputProps={{ 'data-testid': 'annotation-details-category-select' }}
            fullWidth
            sx={{ '& .MuiInputBase-input': { fontSize: 12, color: '#e5e7eb' } }}
          >
            <MenuItem value="">— ingen —</MenuItem>
            {DANCE_MOVEMENT_CATEGORIES.map((c) => (
              <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>{c.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Danser"
            value={draftDancer}
            onChange={(e) => setDraftDancer(e.target.value)}
            inputProps={{ 'data-testid': 'annotation-details-dancer-select' }}
            fullWidth
            sx={{ '& .MuiInputBase-input': { fontSize: 12, color: '#e5e7eb' } }}
          >
            <MenuItem value="">— ingen —</MenuItem>
            {dancerOptions.map((d) => (
              <MenuItem key={d.id} value={d.id} sx={{ fontSize: 12 }}>{d.label}</MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
            onClick={save}
            data-testid="annotation-details-save"
            sx={{ bgcolor: '#8b5cf6', textTransform: 'none', '&:hover': { bgcolor: '#7c3aed' } }}
          >
            Lagre
          </Button>
        </Stack>
      ) : (
        <Stack spacing={0.5}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {cat ? (
              <Chip
                size="small"
                label={cat.label}
                sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}55` }}
              />
            ) : null}
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {annotation.body || '(uten tekst)'}
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 11, color: TEXT_DIM, fontFamily: 'monospace' }}>
            {formatTimecode(annotation.timestampSec, fps)} – {endTc}
          </Typography>
          {annotation.targetDancerIds.length > 0 ? (
            <Typography sx={{ fontSize: 11, color: '#e5e7eb' }}>
              <Box component="span" sx={{ color: TEXT_DIM }}>Dancer: </Box>
              {annotation.targetDancerIds
                .map((id) => dancerOptions.find((d) => d.id === id)?.label ?? id)
                .join(', ')}
            </Typography>
          ) : null}
          {cat ? (
            <Typography sx={{ fontSize: 11, color: '#e5e7eb' }}>
              <Box component="span" sx={{ color: TEXT_DIM }}>Category: </Box>{cat.label}
            </Typography>
          ) : null}
          {annotation.confidence != null ? (
            <Typography
              sx={{ fontSize: 11, color: '#e5e7eb' }}
              data-testid="annotation-details-confidence"
            >
              <Box component="span" sx={{ color: TEXT_DIM }}>Confidence: </Box>
              {annotation.confidence.toFixed(2)}
            </Typography>
          ) : null}
          {annotation.body ? (
            <Typography sx={{ fontSize: 11, color: '#e5e7eb', mt: 0.5 }}>
              <Box component="span" sx={{ color: TEXT_DIM }}>Notes: </Box>{annotation.body}
            </Typography>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}

export default AnnotationDetailsPanel;
