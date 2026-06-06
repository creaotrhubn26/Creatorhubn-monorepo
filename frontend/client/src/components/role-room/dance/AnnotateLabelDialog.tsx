/**
 * AnnotateLabelDialog — create/edit-modal for labels (DanceAnnotate).
 *
 * Felter:
 *   - Name (1-120 chars) — f.eks. "Body Roll", "Chassé"
 *   - Category (dropdown med eksisterende kategorier; valgfri = global label)
 */
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type {
  AnnotationLabelRecord,
  AnnotationCategoryRecord,
} from './danceAnnotationCatalogService';
import { danceFlowColors } from './danceFlowTheme';

export interface AnnotateLabelDialogProps {
  open: boolean;
  editing: AnnotationLabelRecord | null;
  /** Forhåndsvalgt kategori for create-modus. */
  defaultCategoryId?: string | null;
  categories: readonly AnnotationCategoryRecord[];
  onClose: () => void;
  onSave: (input: {
    name: string;
    categoryId: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function AnnotateLabelDialog({
  open,
  editing,
  defaultCategoryId,
  categories,
  onClose,
  onSave,
  onDelete,
}: AnnotateLabelDialogProps): React.ReactElement {
  const isEdit = editing != null;

  const [name, setName] = React.useState<string>('');
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCategoryId(editing.categoryId ?? '');
    } else {
      setName('');
      setCategoryId(defaultCategoryId ?? '');
    }
    setError(null);
    setBusy(false);
  }, [open, editing, defaultCategoryId]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError('Navn er påkrevd'); return; }
    if (trimmed.length > 120) { setError('Navn er for langt (maks 120 tegn)'); return; }
    setBusy(true);
    try {
      await onSave({
        name: trimmed,
        categoryId: categoryId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre label');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!onDelete) return;
    if (typeof window !== 'undefined' && !window.confirm(`Slett label "${editing?.name}"?`)) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      data-testid="annotate-label-dialog"
      PaperProps={{
        sx: {
          bgcolor: danceFlowColors.bgPanel,
          color: danceFlowColors.textPrimary,
          border: `1px solid ${danceFlowColors.borderStrong}`,
        },
      }}
    >
      <DialogTitle sx={{ fontSize: 14, fontWeight: 700, py: 1.5 }}>
        {isEdit ? 'Rediger label' : 'Ny label'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            label="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="annotate-label-dialog-name"
            placeholder="F.eks. Chassé, Walk, Body Roll"
            autoFocus
            inputProps={{ maxLength: 120 }}
          />

          <TextField
            select
            size="small"
            label="Kategori (valgfri)"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            data-testid="annotate-label-dialog-category"
          >
            <MenuItem value="">— ingen (global) —</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                    bgcolor: c.color, mr: 1, verticalAlign: 'middle',
                  }}
                />
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          {error ? (
            <Typography
              sx={{ fontSize: 11, color: danceFlowColors.errorPrimary }}
              data-testid="annotate-label-dialog-error"
            >
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {isEdit && onDelete ? (
          <Button
            size="small"
            color="error"
            onClick={() => { void handleDelete(); }}
            disabled={busy}
            data-testid="annotate-label-dialog-delete"
            sx={{ mr: 'auto', textTransform: 'none' }}
          >
            Slett
          </Button>
        ) : null}
        <Button
          size="small"
          onClick={onClose}
          disabled={busy}
          sx={{ textTransform: 'none', color: danceFlowColors.textMuted }}
        >
          Avbryt
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => { void handleSubmit(); }}
          disabled={busy || !name.trim()}
          data-testid="annotate-label-dialog-submit"
          sx={{
            textTransform: 'none',
            bgcolor: danceFlowColors.lavender,
            '&:hover': { bgcolor: danceFlowColors.lavenderDark },
          }}
        >
          {isEdit ? 'Lagre' : 'Legg til'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
