import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import {
  SCREENPLAY_SHORTCUT_COMMANDS,
  findScreenplayShortcutConflicts,
  getScreenplayShortcutBinding,
  screenplayShortcutLabel,
  type ScreenplayPlatform,
  type ScreenplayShortcutBinding,
  type ScreenplayShortcutId,
  type ScreenplayShortcutOverrides,
} from './screenplayElementShortcuts';

interface ScreenplayShortcutSettingsDialogProps {
  open: boolean;
  platform: ScreenplayPlatform;
  overrides: ScreenplayShortcutOverrides;
  onClose: () => void;
  onSave: (overrides: ScreenplayShortcutOverrides) => void | Promise<void>;
}

const keyLabelFromEvent = (event: React.KeyboardEvent): string => {
  if (event.code.startsWith('Digit')) return event.code.slice('Digit'.length);
  if (event.code.startsWith('Key')) return event.code.slice('Key'.length);
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
};

const bindingFromEvent = (
  event: React.KeyboardEvent,
  platform: ScreenplayPlatform,
): ScreenplayShortcutBinding | null => {
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return null;
  const modifiers: ScreenplayShortcutBinding['modifiers'] = [];

  if (platform === 'mac' && event.metaKey) modifiers.push('primary');
  if (platform === 'windows' && event.ctrlKey) modifiers.push('primary');
  if (platform === 'mac' && event.ctrlKey) modifiers.push('control');
  if (event.shiftKey) modifiers.push('shift');
  if (event.altKey) modifiers.push('alt');
  if (modifiers.length === 0) return null;

  return {
    code: event.code,
    keyLabel: keyLabelFromEvent(event),
    modifiers,
  };
};

export function ScreenplayShortcutSettingsDialog({
  open,
  platform,
  overrides,
  onClose,
  onSave,
}: ScreenplayShortcutSettingsDialogProps) {
  const [draft, setDraft] = useState<ScreenplayShortcutOverrides>(overrides);
  const [capturing, setCapturing] = useState<ScreenplayShortcutId | null>(null);
  const [captureError, setCaptureError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft(overrides);
    setCapturing(null);
    setCaptureError('');
  }, [open, overrides]);

  const conflicts = useMemo(
    () => findScreenplayShortcutConflicts(draft, platform),
    [draft, platform],
  );
  const isCustom = Object.keys(draft).length > 0;

  const handleCapture = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    shortcutId: ScreenplayShortcutId,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCapturing(null);
      setCaptureError('');
      return;
    }
    const binding = bindingFromEvent(event, platform);
    if (!binding) {
      if (!['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        setCaptureError('Hurtigtasten må inneholde Cmd eller Ctrl.');
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDraft((current) => ({ ...current, [shortcutId]: binding }));
    setCapturing(null);
    setCaptureError('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <KeyboardIcon color="primary" />
        Hurtigtaster for manuskript
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography fontWeight={700}>Oppsett</Typography>
              <Typography variant="body2" color="text.secondary">
                Klikk en hurtigtast og trykk den nye tastekombinasjonen.
              </Typography>
            </Box>
            <Chip
              color={isCustom ? 'secondary' : 'primary'}
              label={isCustom ? 'Tilpasset' : 'Final Draft'}
              size="small"
            />
          </Stack>

          {(captureError || conflicts.length > 0) && (
            <Alert severity="warning">
              {captureError || `Konflikt: ${conflicts.join(', ')}`}
            </Alert>
          )}

          <Stack divider={<Divider flexItem />}>
            {SCREENPLAY_SHORTCUT_COMMANDS.map((command) => {
              const binding = getScreenplayShortcutBinding(command.id, platform, draft);
              return (
                <Stack
                  key={command.id}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 1 }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{command.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {command.id === 'general' ? 'Generelt tekstelement' : `Manuselement: ${command.element.replace(/_/g, ' ')}`}
                    </Typography>
                  </Box>
                  <Button
                    variant={capturing === command.id ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      setCapturing(command.id);
                      setCaptureError('');
                    }}
                    onKeyDown={(event) => handleCapture(event, command.id)}
                    aria-label={`Endre hurtigtast for ${command.label}`}
                    sx={{ minWidth: 126, fontFamily: 'monospace' }}
                  >
                    {capturing === command.id
                      ? 'Trykk hurtigtast …'
                      : binding
                        ? screenplayShortcutLabel(command.id, platform, draft)
                        : 'Ikke satt'}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button
          startIcon={<RestartAltIcon />}
          onClick={() => {
            setDraft({});
            setCapturing(null);
            setCaptureError('');
          }}
        >
          Final Draft-oppsett
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={conflicts.length > 0 || Boolean(captureError)}
            onClick={() => void onSave(draft)}
          >
            Lagre
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default ScreenplayShortcutSettingsDialog;
