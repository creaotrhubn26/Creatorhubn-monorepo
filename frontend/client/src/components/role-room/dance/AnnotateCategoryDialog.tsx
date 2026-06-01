/**
 * AnnotateCategoryDialog — create/edit-modal for kategorier (DanceAnnotate).
 *
 * Felter:
 *   - Name (1-80 chars)
 *   - Color (8 lavender-aktige presets + manuell hex)
 *   - Shortcut (1 tegn, 1-9 anbefales; valgfri)
 *
 * Edit-modus: kan endre navn/farge/shortcut.
 * Create-modus: alle felt + auto-assigner neste tilgjengelige shortcut.
 *
 * Default-kategorier (steps/arms/body/jumps/turns) kan REDIGERES men ikke
 * slettes. Server håndhever delete-protection (409 default_protected).
 */
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { AnnotationCategoryRecord } from './danceAnnotationCatalogService';
import { danceFlowColors } from './danceFlowTheme';

const COLOR_PRESETS = [
  '#a78bfa', '#34d399', '#fbbf24', '#60a5fa', '#f472b6',
  '#06b6d4', '#84cc16', '#fb7185', '#c084fc', '#fcd34d',
] as const;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export interface AnnotateCategoryDialogProps {
  open: boolean;
  /** Null = create-modus. Satt = edit-modus. */
  editing: AnnotationCategoryRecord | null;
  /** Brukt for å foreslå neste ledige shortcut (1-9). */
  existingShortcuts: ReadonlyArray<string | null>;
  onClose: () => void;
  onSave: (input: {
    name: string;
    color: string;
    shortcut: string | null;
  }) => Promise<void>;
  /** Slett-handler (kun edit-modus, ikke for defaults). */
  onDelete?: () => Promise<void>;
}

function pickNextShortcut(taken: ReadonlyArray<string | null>): string {
  for (let i = 1; i <= 9; i += 1) {
    const s = String(i);
    if (!taken.includes(s)) return s;
  }
  return '';
}

export default function AnnotateCategoryDialog({
  open,
  editing,
  existingShortcuts,
  onClose,
  onSave,
  onDelete,
}: AnnotateCategoryDialogProps): React.ReactElement {
  const isEdit = editing != null;

  const [name, setName] = React.useState<string>('');
  const [color, setColor] = React.useState<string>(COLOR_PRESETS[0]);
  const [shortcut, setShortcut] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
      setShortcut(editing.shortcut ?? '');
    } else {
      setName('');
      setColor(COLOR_PRESETS[0]);
      setShortcut(pickNextShortcut(existingShortcuts));
    }
    setError(null);
    setBusy(false);
  }, [open, editing, existingShortcuts]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Navn er påkrevd'); return; }
    if (trimmedName.length > 80) { setError('Navn er for langt (maks 80 tegn)'); return; }
    if (!HEX_RE.test(color)) { setError('Farge må være hex (#rrggbb eller #rgb)'); return; }
    if (shortcut && shortcut.length > 8) { setError('Snarvei er for lang'); return; }
    if (shortcut && existingShortcuts.includes(shortcut) && shortcut !== editing?.shortcut) {
      setError(`Snarvei "${shortcut}" er allerede i bruk`);
      return;
    }
    setBusy(true);
    try {
      await onSave({
        name: trimmedName,
        color,
        shortcut: shortcut.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre kategori');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!onDelete) return;
    if (typeof window !== 'undefined' &&
        !window.confirm(`Slett kategori "${editing?.name}"?\nLabels som er bundet til denne kategorien blir også slettet.`)) {
      return;
    }
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
      data-testid="annotate-category-dialog"
      PaperProps={{
        sx: {
          bgcolor: danceFlowColors.bgPanel,
          color: danceFlowColors.textPrimary,
          border: `1px solid ${danceFlowColors.borderStrong}`,
        },
      }}
    >
      <DialogTitle sx={{ fontSize: 14, fontWeight: 700, py: 1.5 }}>
        {isEdit ? 'Rediger kategori' : 'Ny kategori'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            label="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="annotate-category-dialog-name"
            placeholder="F.eks. Floor work"
            autoFocus
            inputProps={{ maxLength: 80 }}
          />

          <Box>
            <Typography sx={{ fontSize: 11, color: danceFlowColors.textMuted, mb: 0.5 }}>
              Farge
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {COLOR_PRESETS.map((preset) => (
                <Box
                  key={preset}
                  component="button"
                  type="button"
                  data-testid={`annotate-category-dialog-color-${preset.replace('#', '')}`}
                  onClick={() => setColor(preset)}
                  aria-label={`Velg farge ${preset}`}
                  sx={{
                    width: 28, height: 28, borderRadius: '50%',
                    bgcolor: preset,
                    border: color === preset
                      ? `3px solid ${danceFlowColors.textPrimary}`
                      : `1px solid ${danceFlowColors.borderSoft}`,
                    cursor: 'pointer',
                    p: 0,
                    transition: 'border 120ms',
                  }}
                />
              ))}
            </Stack>
            <TextField
              size="small"
              label="Eller hex"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              data-testid="annotate-category-dialog-color-hex"
              placeholder="#a78bfa"
              sx={{ mt: 1, width: 140 }}
              inputProps={{ maxLength: 9 }}
            />
          </Box>

          <TextField
            size="small"
            label="Snarvei (1 tegn, valgfri)"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value.slice(0, 8))}
            data-testid="annotate-category-dialog-shortcut"
            placeholder="1-9"
            inputProps={{ maxLength: 8 }}
            sx={{ width: 200 }}
          />

          {error ? (
            <Typography
              sx={{ fontSize: 11, color: danceFlowColors.errorPrimary }}
              data-testid="annotate-category-dialog-error"
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
            data-testid="annotate-category-dialog-delete"
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
          data-testid="annotate-category-dialog-submit"
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
