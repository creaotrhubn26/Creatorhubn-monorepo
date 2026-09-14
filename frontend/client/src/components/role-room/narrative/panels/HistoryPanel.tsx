/**
 * HistoryPanel — prosjekthistorikk: ta snapshot, list revisjoner, gjenopprett
 * (ikke-destruktivt: nåværende graf lagres først som ny revisjon).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, List, ListItem, ListItemText, Stack, TextField, Typography,
} from '@mui/material';
import { Save as SaveIcon, History as RestoreIcon } from '@mui/icons-material';
import * as api from '../narrativeService';
import type { NarrativeGraph, NarrativeRevisionMeta } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

export interface HistoryPanelProps {
  projectId: string;
  onRestored: (graph: NarrativeGraph) => void;
  onError: (message: string) => void;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function HistoryPanel({ projectId, onRestored, onError }: HistoryPanelProps) {
  const [revisions, setRevisions] = useState<NarrativeRevisionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRevisions(await api.listRevisions(projectId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Kunne ikke laste historikk.');
    } finally {
      setLoading(false);
    }
  }, [projectId, onError]);

  useEffect(() => { void load(); }, [load]);

  const snapshot = async () => {
    setBusy(true);
    try {
      await api.createRevision(projectId, label.trim() || null);
      setLabel('');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Kunne ikke lagre versjon.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (rev: NarrativeRevisionMeta) => {
    if (!window.confirm(`Gjenopprette versjonen fra ${formatDate(rev.createdAt)}? Nåværende graf lagres først som egen versjon.`)) return;
    setBusy(true);
    try {
      const result = await api.restoreRevision(projectId, rev.id);
      onRestored(result.graph);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Kunne ikke gjenopprette.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2, color: narrativeColors.text, maxWidth: 820 }} data-testid="narrative-history-panel">
      <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mb: 2 }}>
        Hver versjon er et fullstendig snapshot av grafen. Gjenoppretting er ikke-destruktiv.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" label="Etikett (valgfri)" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ ...fieldSx, flex: 1 }} inputProps={{ 'data-testid': 'narrative-revision-label' }} />
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={busy}
          onClick={() => void snapshot()}
          sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}
          data-testid="narrative-revision-create"
        >
          Lagre versjon
        </Button>
      </Stack>
      {loading ? (
        <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Laster…</Typography>
      ) : (
        <List dense>
          {revisions.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen versjoner ennå.</Typography>
          ) : null}
          {revisions.map((rev) => (
            <ListItem
              key={rev.id}
              sx={{ border: `1px solid ${narrativeColors.borderStrong}`, borderRadius: 1, mb: 1, bgcolor: narrativeColors.bgPanel }}
              secondaryAction={
                <Button size="small" startIcon={<RestoreIcon />} disabled={busy} onClick={() => void restore(rev)} sx={{ color: narrativeColors.accent }}>
                  Gjenopprett
                </Button>
              }
            >
              <ListItemText
                primary={rev.label || 'Uten etikett'}
                secondary={`${formatDate(rev.createdAt)} · ${rev.counts.boards} brett · ${rev.counts.elements} elementer · ${rev.counts.connections} koblinger · ${rev.counts.components} komponenter`}
                primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: narrativeColors.text }}
                secondaryTypographyProps={{ fontSize: 11, color: narrativeColors.textDim }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
