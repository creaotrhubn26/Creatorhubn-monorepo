/**
 * WhatsNewTab — Admin Room CRUD for "Hva er nytt"-oppføringer per Role
 * Room-modus. Vises i HelpButton-modalen i hver workspace.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import {
  whatsNewApi,
  WHATS_NEW_MODES,
  WHATS_NEW_KIND_LABELS,
  type WhatsNewEntry,
  type WhatsNewEntryInput,
  type WhatsNewKind,
} from '../../../../services/adminRoomApi';

const KIND_COLORS: Record<WhatsNewKind, string> = {
  feature: '#F5B82E',
  improvement: '#7DD3FC',
  fix: '#86EFAC',
};

const EMPTY_FORM: WhatsNewEntryInput = {
  mode: 'dance',
  kind: 'feature',
  date: new Date().toISOString().slice(0, 10),
  title: '',
  description: '',
  published: true,
  displayOrder: 0,
};

export function WhatsNewTab(): JSX.Element {
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<string>('');
  const [editing, setEditing] = useState<WhatsNewEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<WhatsNewEntryInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await whatsNewApi.listAdmin(modeFilter || undefined);
      setEntries(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [modeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, WhatsNewEntry[]>();
    for (const e of entries) {
      const list = map.get(e.mode) ?? [];
      list.push(e);
      map.set(e.mode, list);
    }
    return map;
  }, [entries]);

  const openCreate = (): void => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, mode: modeFilter || 'dance' });
    setDialogOpen(true);
  };

  const openEdit = (entry: WhatsNewEntry): void => {
    setEditing(entry);
    setForm({
      mode: entry.mode,
      kind: entry.kind,
      date: entry.date,
      title: entry.title,
      description: entry.description,
      published: entry.published,
      displayOrder: entry.displayOrder,
    });
    setDialogOpen(true);
  };

  const closeDialog = (): void => {
    setDialogOpen(false);
    setEditing(null);
  };

  const submit = async (): Promise<void> => {
    if (!form.title?.trim()) {
      setError('Tittel er påkrevd');
      return;
    }
    if (!form.mode) {
      setError('Modus er påkrevd');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await whatsNewApi.patch(editing.id, form);
      } else {
        await whatsNewApi.create(form);
      }
      closeDialog();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (!window.confirm('Slett denne oppføringen?')) return;
    try {
      await whatsNewApi.remove(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const modeLabel = (slug: string): string =>
    WHATS_NEW_MODES.find((m) => m.slug === slug)?.label ?? slug;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
            Hva er nytt
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.85rem' }}>
            Vises i HelpButton-modalen i hver workspace. Filtreres per modus.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel sx={{ color: 'rgba(226,232,240,0.7)' }}>Modus-filter</InputLabel>
            <Select
              label="Modus-filter"
              value={modeFilter}
              onChange={(e) => setModeFilter(String(e.target.value))}
              sx={{ color: '#fff' }}
            >
              <MenuItem value="">Alle modi</MenuItem>
              {WHATS_NEW_MODES.map((m) => (
                <MenuItem key={m.slug} value={m.slug}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={{ bgcolor: '#a78bfa' }}>
            Ny oppføring
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : entries.length === 0 ? (
        <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)' }}>
            Ingen oppføringer ennå. Klikk "Ny oppføring" for å legge til den første.
          </Typography>
        </Paper>
      ) : (
        Array.from(grouped.entries()).map(([mode, list]) => (
          <Paper key={mode} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.92rem', letterSpacing: 0.5 }}>
                {modeLabel(mode).toUpperCase()} · {list.length}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.6)' }}>Type</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.6)' }}>Dato</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.6)' }}>Tittel</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.6)' }}>Synlig</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.6)' }} align="right">Sort</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>
                        <Chip
                          label={WHATS_NEW_KIND_LABELS[entry.kind] ?? entry.kind}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: `${KIND_COLORS[entry.kind] ?? '#888'}22`,
                            color: KIND_COLORS[entry.kind] ?? '#ccc',
                            border: `1px solid ${KIND_COLORS[entry.kind] ?? '#888'}55`,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.78)' }}>
                        {entry.date ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#fff' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {entry.title}
                          </Typography>
                          {entry.description && (
                            <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)', display: 'block' }}>
                              {entry.description.length > 80
                                ? entry.description.slice(0, 80) + '…'
                                : entry.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: entry.published ? '#86EFAC' : 'rgba(226,232,240,0.4)' }}>
                        {entry.published ? 'Publisert' : 'Skjult'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                        {entry.displayOrder}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(entry)} sx={{ color: '#a78bfa' }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => remove(entry.id)} sx={{ color: '#f87171' }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {editing ? 'Rediger oppføring' : 'Ny oppføring'}
          <IconButton onClick={closeDialog} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Modus</InputLabel>
              <Select
                label="Modus"
                value={form.mode ?? ''}
                onChange={(e) => setForm({ ...form, mode: String(e.target.value) })}
              >
                {WHATS_NEW_MODES.map((m) => (
                  <MenuItem key={m.slug} value={m.slug}>{m.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={form.kind ?? 'feature'}
                onChange={(e) => setForm({ ...form, kind: e.target.value as WhatsNewKind })}
              >
                <MenuItem value="feature">Nytt</MenuItem>
                <MenuItem value="improvement">Forbedret</MenuItem>
                <MenuItem value="fix">Fikset</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label="Dato (YYYY-MM-DD)"
              value={form.date ?? ''}
              onChange={(e) => setForm({ ...form, date: e.target.value || null })}
              placeholder="2026-05-29"
            />
            <TextField
              size="small"
              fullWidth
              label="Tittel"
              value={form.title ?? ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={3}
              label="Beskrivelse"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              size="small"
              type="number"
              label="Sorteringsorden (høyest = øverst)"
              value={form.displayOrder ?? 0}
              onChange={(e) => setForm({ ...form, displayOrder: Number.parseInt(e.target.value, 10) || 0 })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.published ?? true}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                />
              }
              label="Publisert (synlig i HelpButton)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Avbryt</Button>
          <Button onClick={submit} variant="contained" disabled={saving} sx={{ bgcolor: '#a78bfa' }}>
            {saving ? 'Lagrer…' : editing ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default WhatsNewTab;
