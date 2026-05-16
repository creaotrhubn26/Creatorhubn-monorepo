// @ts-nocheck
/**
 * MoodBoardPanel — referansebilder pinnet per scene.
 *
 * Artisten samler refs (foto, malerier, screenshots) for å holde
 * stemning og palett gjennom en scene. Bilder lagres som dataURL i
 * localStorage (per sceneId) via moodBoardStore.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Paper,
  Tooltip,
  Alert,
  TextField,
  Button,
} from '@mui/material';
import {
  AddPhotoAlternate,
  DeleteOutline,
  EditOutlined,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  listMoodBoardImages,
  addMoodBoardImage,
  removeMoodBoardImage,
  updateMoodBoardImageMeta,
  getStorageUsage,
  type MoodBoardImage,
} from './moodBoardStore';

export interface MoodBoardPanelProps {
  sceneId: string;
  compact?: boolean;
}

export const MoodBoardPanel: React.FC<MoodBoardPanelProps> = ({ sceneId, compact = false }) => {
  const [images, setImages] = useState<MoodBoardImage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(() => {
    setImages(listMoodBoardImages(sceneId));
  }, [sceneId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError('Filen er ikke et bilde.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') {
          setError('Klarte ikke lese filen.');
          return;
        }
        const result = addMoodBoardImage(sceneId, {
          dataUrl,
          fileName: file.name,
        });
        if (!result.ok) {
          if (result.error === 'too-large') setError(`«${file.name}» er for stort (maks 5 MB).`);
          else if (result.error === 'invalid-data-url') setError('Bildet hadde ugyldig format.');
          else setError('Lagring feilet.');
          return;
        }
        if (result.warning === 'over-soft-limit') {
          setError(`«${file.name}» er over 2 MB — bruk gjerne mindre filer for raskere lasting.`);
        }
        refresh();
      };
      reader.onerror = () => setError('Klarte ikke lese filen.');
      reader.readAsDataURL(file);
    },
    [sceneId, refresh],
  );

  const onPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) handleFile(file);
      event.target.value = '';
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const onRemove = useCallback(
    (imageId: string) => {
      removeMoodBoardImage(sceneId, imageId);
      refresh();
    },
    [sceneId, refresh],
  );

  const onStartEdit = useCallback((image: MoodBoardImage) => {
    setEditingId(image.id);
    setEditCaption(image.caption ?? '');
    setEditTags((image.tags ?? []).join(', '));
  }, []);

  const onSaveEdit = useCallback(() => {
    if (!editingId) return;
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    updateMoodBoardImageMeta(sceneId, editingId, {
      caption: editCaption,
      tags,
    });
    setEditingId(null);
    refresh();
  }, [editingId, editCaption, editTags, sceneId, refresh]);

  const onCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const usage = getStorageUsage(sceneId);
  const padding = compact ? 1 : 2;

  return (
    <Paper
      elevation={0}
      sx={{
        p: padding,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
      data-testid="moodboard-panel"
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Mood-board
        </Typography>
        <Tooltip title="Last opp referansebilde">
          <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
            <AddPhotoAlternate fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        style={{ display: 'none' }}
        data-testid="moodboard-file-input"
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {usage.isNearLimit && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Mood-board nær lagringsgrensen — vurder å slette ubrukte refs.
        </Alert>
      )}

      <Box
        onDrop={onDrop}
        onDragOver={onDragOver}
        sx={{
          minHeight: images.length === 0 ? 80 : 'auto',
          display: 'grid',
          gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 1,
          p: images.length === 0 ? 2 : 0,
          border: images.length === 0 ? '2px dashed' : 'none',
          borderColor: 'divider',
          borderRadius: 1,
          textAlign: 'center',
        }}
      >
        {images.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
            Drag-and-drop bilder hit, eller klikk på +.
          </Typography>
        )}
        {images.map((image) => (
          <Box
            key={image.id}
            sx={{
              position: 'relative',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover .moodboard-actions': { opacity: 1 },
            }}
            data-testid={`moodboard-thumb-${image.id}`}
          >
            <img
              src={image.dataUrl}
              alt={image.caption || image.fileName || 'mood ref'}
              style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
            />
            <Stack
              direction="row"
              spacing={0.5}
              className="moodboard-actions"
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                opacity: 0,
                transition: 'opacity 0.15s',
                bgcolor: 'rgba(0,0,0,0.5)',
                borderRadius: 1,
              }}
            >
              <IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => onStartEdit(image)}>
                <EditOutlined fontSize="inherit" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'white', p: 0.25 }} onClick={() => onRemove(image.id)}>
                <DeleteOutline fontSize="inherit" />
              </IconButton>
            </Stack>
            {image.caption && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  px: 0.5,
                  py: 0.25,
                  fontSize: '0.65rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {image.caption}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {editingId && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Stack spacing={1}>
            <TextField
              label="Caption"
              size="small"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              fullWidth
            />
            <TextField
              label="Tags (kommaseparert)"
              size="small"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={onSaveEdit}>
                Lagre
              </Button>
              <Button size="small" startIcon={<CloseIcon />} onClick={onCancelEdit}>
                Avbryt
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {images.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {images.length} ref{images.length === 1 ? '' : 's'} · {(usage.totalBytes / 1024 / 1024).toFixed(1)} MB
        </Typography>
      )}
    </Paper>
  );
};

export default MoodBoardPanel;
