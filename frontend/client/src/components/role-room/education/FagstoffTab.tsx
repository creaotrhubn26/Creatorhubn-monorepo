/**
 * FagstoffTab.tsx — «Fagstoff»-flaten (opplæringslag 3: fag-bibliotek).
 *
 * Faglærer kurerer korte «hvordan»-leksjoner gruppert etter produksjonssteg.
 * Kuraterte startforslag kan legges til med ett klikk. Owner-scopet.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, TextField,
  IconButton, Chip, CircularProgress, Alert, MenuItem, Link, Divider,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, MenuBook as LibraryIcon,
  OpenInNew as LinkIcon, AutoAwesome as SuggestIcon,
} from '@mui/icons-material';
import {
  educationResourcesService, RESOURCE_CATEGORIES, SUGGESTED_RESOURCES,
  type Resource, type ResourceCategory,
} from './educationResourcesService';

const ACCENT = '#8B5CF6';
const categoryLabel = (key: string) => RESOURCE_CATEGORIES.find((c) => c.key === key)?.label ?? 'Generelt';

export function FagstoffTab() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('idea');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResources(await educationResourcesService.listResources());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente fagstoff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const resource = await educationResourcesService.createResource({
        title: title.trim(), category,
        description: description.trim() || undefined,
        url: url.trim() || undefined,
      });
      setResources((prev) => [...prev, resource]);
      setTitle(''); setDescription(''); setUrl(''); setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke legge til fagstoff');
    } finally {
      setBusy(false);
    }
  };

  const handleAddSuggestion = async (s: typeof SUGGESTED_RESOURCES[number]) => {
    try {
      const resource = await educationResourcesService.createResource({
        title: s.title, category: s.category, description: s.description,
      });
      setResources((prev) => [...prev, resource]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke legge til forslag');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await educationResourcesService.deleteResource(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke slette');
    }
  };

  // Grupper etter kategori i produksjonsflyt-rekkefølge.
  const grouped = useMemo(() => {
    return RESOURCE_CATEGORIES
      .map((c) => ({ ...c, items: resources.filter((r) => r.category === c.key) }))
      .filter((g) => g.items.length > 0);
  }, [resources]);

  const existingTitles = useMemo(() => new Set(resources.map((r) => r.title)), [resources]);
  const suggestions = SUGGESTED_RESOURCES.filter((s) => !existingTitles.has(s.title));

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Fagstoff</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Korte leksjoner gruppert etter produksjonssteg — lær faget mens dere bruker verktøyet.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT, opacity: 0.9 }, whiteSpace: 'nowrap' }}>
          Nytt fagstoff
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {creating && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)' }}>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label="Tittel" size="small" value={title} onChange={(e) => setTitle(e.target.value)}
              autoFocus required placeholder="Hva er en call sheet?" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField label="Produksjonssteg" size="small" select value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)} fullWidth>
                {RESOURCE_CATEGORIES.map((c) => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
              </TextField>
              <TextField label="Lenke (video/artikkel, valgfritt)" size="small" value={url}
                onChange={(e) => setUrl(e.target.value)} fullWidth placeholder="https://…" />
            </Stack>
            <TextField label="Beskrivelse (valgfritt)" size="small" value={description}
              onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)} disabled={busy}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!title.trim() || busy}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}>
                {busy ? 'Legger til…' : 'Legg til'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : (
        <>
          {grouped.length === 0 && (
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(139,92,246,0.3)' }}>
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <LibraryIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Ingen fagstoff enda. Legg til egne leksjoner, eller start med et av forslagene under.</Typography>
              </CardContent>
            </Card>
          )}

          {grouped.map((g) => (
            <Box key={g.key}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.75 }}>{g.label}</Typography>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {g.items.map((r, i) => (
                  <Box key={r.id}>
                    {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ px: 2, py: 1.25 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{r.title}</Typography>
                          {r.url && (
                            <Link href={r.url} target="_blank" rel="noopener" sx={{ color: ACCENT, display: 'inline-flex' }} aria-label="Åpne lenke">
                              <LinkIcon sx={{ fontSize: 15 }} />
                            </Link>
                          )}
                        </Stack>
                        {r.description && <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>{r.description}</Typography>}
                      </Box>
                      <IconButton size="small" onClick={() => handleDelete(r.id)} sx={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Slett fagstoff">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}
              </Card>
            </Box>
          ))}

          {suggestions.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <SuggestIcon sx={{ fontSize: 18, color: ACCENT }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Forslag å legge til</Typography>
              </Stack>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
                {suggestions.map((s) => (
                  <Card key={s.title} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Chip size="small" label={categoryLabel(s.category)} sx={{ height: 18, fontSize: 9.5, mb: 0.5, bgcolor: 'rgba(139,92,246,0.18)', color: '#e9d5ff' }} />
                          <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{s.title}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.description}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => handleAddSuggestion(s)} sx={{ color: ACCENT }} aria-label={`Legg til ${s.title}`}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default FagstoffTab;
