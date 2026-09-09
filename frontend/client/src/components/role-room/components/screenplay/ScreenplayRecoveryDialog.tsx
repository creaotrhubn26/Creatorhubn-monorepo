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
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';

import type { ScreenplayRecoveryPoint, ScreenplayRecoveryStore } from './screenplayRecovery';

interface RecoveryEntry extends ScreenplayRecoveryPoint {
  isDraft?: boolean;
}

interface ScreenplayRecoveryDialogProps {
  open: boolean;
  store: ScreenplayRecoveryStore | null;
  currentContent: string;
  onClose: () => void;
  onCreatePoint: () => void;
  onRestore: (entry: RecoveryEntry) => void;
}

const REASON_LABELS: Record<ScreenplayRecoveryPoint['reason'], string> = {
  opened: 'Da manuset ble åpnet',
  autosave: 'Automatisk sikkerhetspunkt',
  manual: 'Manuelt punkt',
  before_restore: 'Før gjenoppretting',
};

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ukjent tidspunkt';
  return date.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'medium' });
};

const contentStats = (content: string) => ({
  characters: content.length,
  words: content.trim() ? content.trim().split(/\s+/).length : 0,
  lines: content.split('\n').length,
});

export function ScreenplayRecoveryDialog({
  open,
  store,
  currentContent,
  onClose,
  onCreatePoint,
  onRestore,
}: ScreenplayRecoveryDialogProps) {
  const entries = useMemo<RecoveryEntry[]>(() => {
    if (!store) return [];
    return [
      {
        id: `draft:${store.draft.updatedAt}`,
        createdAt: store.draft.updatedAt,
        content: store.draft.content,
        reason: 'autosave',
        isDraft: true,
      },
      ...store.points,
    ];
  }, [store]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setSelectedId(entries[0]?.id ?? '');
  }, [entries, open]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedStats = contentStats(selected?.content ?? '');
  const currentStats = contentStats(currentContent);
  const isCurrent = selected?.content === currentContent;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon color="primary" />
        Lokal gjenopprettingshistorikk
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Punktene lagres lokalt i denne nettleseren. Formelle revisjoner ligger fortsatt i Revisjoner-fanen.
        </Alert>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} minHeight={360}>
          <Box sx={{ width: { xs: '100%', md: 290 }, flexShrink: 0 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onCreatePoint}
              sx={{ mb: 1 }}
            >
              Opprett punkt nå
            </Button>
            <List dense disablePadding aria-label="Gjenopprettingspunkter">
              {entries.map((entry) => (
                <ListItemButton
                  key={entry.id}
                  selected={entry.id === selectedId}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <ListItemText
                    primary={entry.isDraft ? 'Lokalt utkast' : REASON_LABELS[entry.reason]}
                    secondary={formatTimestamp(entry.createdAt)}
                  />
                </ListItemButton>
              ))}
              {entries.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Ingen lokale punkter ennå.
                </Typography>
              )}
            </List>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selected ? (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip size="small" label={`${selectedStats.words} ord`} />
                  <Chip size="small" label={`${selectedStats.lines} linjer`} />
                  <Chip
                    size="small"
                    color={selectedStats.characters === currentStats.characters ? 'default' : 'warning'}
                    label={`${selectedStats.characters - currentStats.characters >= 0 ? '+' : ''}${selectedStats.characters - currentStats.characters} tegn mot nå`}
                  />
                  {isCurrent && <Chip size="small" color="success" label="Gjeldende tekst" />}
                </Stack>
                <Box
                  component="pre"
                  aria-label="Forhåndsvisning av gjenopprettingspunkt"
                  sx={{
                    m: 0,
                    p: 2,
                    minHeight: 280,
                    maxHeight: 420,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    fontFamily: 'Courier Prime, Courier New, monospace',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    bgcolor: 'rgba(0,0,0,0.22)',
                    borderRadius: 1,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {selected.content || '(Tomt manus)'}
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">Velg et gjenopprettingspunkt.</Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        <Button
          variant="contained"
          startIcon={<RestoreIcon />}
          disabled={!selected || isCurrent}
          onClick={() => selected && onRestore(selected)}
        >
          Gjenopprett valgt
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ScreenplayRecoveryDialog;
