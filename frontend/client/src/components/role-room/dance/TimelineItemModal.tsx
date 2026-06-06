/**
 * TimelineItemModal — opprett / redigér / slett time-anchored note eller
 * movement på koreografi-timelinen. Workflow-audit G18.
 *
 * Tre modi:
 *   - 'create': dialog tom, viser 'Legg til' knapp
 *   - 'edit': dialog forhåndsfylt fra eksisterende item, viser 'Lagre' + 'Slett'
 *   - null: ikke vist
 *
 * Felter: kind (note/movement-toggle) · label (multi-line text) ·
 * startSec/endSec (HH:MM:SS:FF eller numeric). Validering: endSec > startSec.
 */
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  type TimelineItemKind,
  type TimelineItemRecord,
} from './danceTimelineItemService';
import { formatTimecode, parseTimecode } from './timecode';
import { danceFlowColors } from './danceFlowTheme';

export interface TimelineItemModalProps {
  open: boolean;
  /** Når satt, eksisterende item som redigeres. Null = create-modus. */
  editing: TimelineItemRecord | null;
  /** Default start-tid for create-modus (e.g. fra right-click-posisjon). */
  defaultStartSec?: number;
  /** Default end-tid for create-modus. Default = startSec + 4. */
  defaultEndSec?: number;
  /** Project-scope for nye items. */
  projectId: string | null;
  onClose: () => void;
  onCreate: (input: {
    kind: TimelineItemKind;
    label: string;
    startSec: number;
    endSec: number;
    projectId: string | null;
  }) => Promise<void>;
  onUpdate: (id: string, patch: {
    kind?: TimelineItemKind;
    label?: string;
    startSec?: number;
    endSec?: number;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function TimelineItemModal({
  open,
  editing,
  defaultStartSec = 0,
  defaultEndSec,
  projectId,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: TimelineItemModalProps): React.ReactElement {
  const isEdit = editing != null;
  const [kind, setKind] = React.useState<TimelineItemKind>(editing?.kind ?? 'note');
  const [label, setLabel] = React.useState<string>(editing?.label ?? '');
  const [startStr, setStartStr] = React.useState<string>(
    formatTimecode(editing?.startSec ?? defaultStartSec),
  );
  const [endStr, setEndStr] = React.useState<string>(
    formatTimecode(editing?.endSec ?? defaultEndSec ?? defaultStartSec + 4),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);

  // Reset state når modalen åpnes med ny editing eller defaults.
  React.useEffect(() => {
    if (!open) return;
    setKind(editing?.kind ?? 'note');
    setLabel(editing?.label ?? '');
    setStartStr(formatTimecode(editing?.startSec ?? defaultStartSec));
    setEndStr(formatTimecode(editing?.endSec ?? defaultEndSec ?? defaultStartSec + 4));
    setError(null);
    setBusy(false);
  }, [open, editing, defaultStartSec, defaultEndSec]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const start = parseTimecode(startStr);
    const end = parseTimecode(endStr);
    if (start == null) { setError('Start-tid har ugyldig format'); return; }
    if (end == null) { setError('Slutt-tid har ugyldig format'); return; }
    if (end <= start) { setError('Slutt må være etter start'); return; }
    if (!label.trim()) { setError('Beskrivelse mangler'); return; }
    setBusy(true);
    try {
      if (editing) {
        await onUpdate(editing.id, {
          kind, label: label.trim(), startSec: start, endSec: end,
        });
      } else {
        await onCreate({
          kind, label: label.trim(), startSec: start, endSec: end, projectId,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!editing) return;
    if (typeof window !== 'undefined' && !window.confirm('Slett denne noten?')) return;
    setBusy(true);
    try {
      await onDelete(editing.id);
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
      data-testid="timeline-item-modal"
      PaperProps={{
        sx: {
          bgcolor: danceFlowColors.bgPanel,
          color: danceFlowColors.textPrimary,
          border: `1px solid ${danceFlowColors.borderStrong}`,
        },
      }}
    >
      <DialogTitle sx={{ fontSize: 14, fontWeight: 700, py: 1.5 }}>
        {isEdit ? 'Rediger ' : 'Legg til '}
        {kind === 'note' ? 'note' : 'bevegelse'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <ToggleButtonGroup
            size="small"
            value={kind}
            exclusive
            onChange={(_, v: TimelineItemKind | null) => v && setKind(v)}
            data-testid="timeline-item-modal-kind"
            sx={{
              '& .MuiToggleButton-root': {
                fontSize: 11, textTransform: 'none',
                color: danceFlowColors.textMuted,
                borderColor: danceFlowColors.borderStrong,
                '&.Mui-selected': {
                  color: danceFlowColors.lavender,
                  bgcolor: 'rgba(167,139,250,0.12)',
                },
              },
            }}
          >
            <ToggleButton value="note">Note</ToggleButton>
            <ToggleButton value="movement">Bevegelse</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small"
            label="Beskrivelse"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            placeholder={kind === 'note' ? 'F.eks. "Watch D2 & D4 cross"' : 'F.eks. "Walk", "Reach", "Body roll"'}
            data-testid="timeline-item-modal-label"
            autoFocus
            inputProps={{ maxLength: 500 }}
          />

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Start"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              placeholder="00:00:24:00"
              data-testid="timeline-item-modal-start"
              sx={{ flex: 1, '& .MuiInputBase-input': { fontVariantNumeric: 'tabular-nums', fontSize: 12 } }}
            />
            <TextField
              size="small"
              label="Slutt"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              placeholder="00:00:28:00"
              data-testid="timeline-item-modal-end"
              sx={{ flex: 1, '& .MuiInputBase-input': { fontVariantNumeric: 'tabular-nums', fontSize: 12 } }}
            />
          </Stack>

          {error ? (
            <Typography sx={{ fontSize: 11, color: danceFlowColors.errorPrimary }} data-testid="timeline-item-modal-error">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {isEdit ? (
          <Button
            size="small"
            color="error"
            onClick={handleDelete}
            disabled={busy}
            data-testid="timeline-item-modal-delete"
            sx={{ mr: 'auto', textTransform: 'none' }}
          >
            Slett
          </Button>
        ) : null}
        <Button
          size="small"
          onClick={onClose}
          disabled={busy}
          data-testid="timeline-item-modal-cancel"
          sx={{ textTransform: 'none', color: danceFlowColors.textMuted }}
        >
          Avbryt
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => { void handleSubmit(); }}
          disabled={busy || !label.trim()}
          data-testid="timeline-item-modal-submit"
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
