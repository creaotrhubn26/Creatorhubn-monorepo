/**
 * FagstoffTab.tsx — «Fagstoff» (redesign, CMS-koblet).
 *
 * Faglærer kurerer korte «hvordan»-leksjoner gruppert etter produksjonssteg.
 * Design speiler mockup: KPI-kort, filter-bar og ressurs-kort gruppert per
 * kategori m/ type-merke (VIDEO/PDF/ARTIKKEL/LENKE). Ekte data + CRUD via
 * educationResourcesService + ett-klikks kuraterte startforslag. Visnings-/
 * fullført-tall er statiske «kommer».
 *
 * 🔑 CMS: stabile data-edit-id (edu-fs-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Collapse, TextField, MenuItem,
  CircularProgress, Alert, InputBase, Select,
} from '@mui/material';
import {
  MenuBook as LibraryIcon, Add as AddIcon, UploadFile as UploadIcon,
  Delete as DeleteIcon, OpenInNew as LinkIcon, AutoAwesome as SuggestIcon,
  Videocam as VideoIcon, Article as ArticleIcon, PictureAsPdf as PdfIcon,
  Link as GenericLinkIcon, Search as SearchIcon, KeyboardArrowDown as CaretIcon,
  Visibility as ViewsIcon, TaskAlt as DoneIcon,
} from '@mui/icons-material';
import {
  educationResourcesService, RESOURCE_CATEGORIES, SUGGESTED_RESOURCES,
  type Resource, type ResourceCategory,
} from './educationResourcesService';
import { ACCENT, Panel, T } from './_eduUi';

const categoryLabel = (key: string) => RESOURCE_CATEGORIES.find((c) => c.key === key)?.label ?? 'Generelt';

/** Utleder type-merke fra ressursens innhold. */
function resourceType(r: Resource): { label: string; icon: React.ReactNode; color: string } {
  const u = (r.url || '').toLowerCase();
  if (/youtu|vimeo|\.mp4|video/.test(u)) return { label: 'VIDEO', icon: <VideoIcon sx={{ fontSize: 15 }} />, color: '#ec4899' };
  if (/\.pdf/.test(u)) return { label: 'PDF', icon: <PdfIcon sx={{ fontSize: 15 }} />, color: '#f59e0b' };
  if (r.body) return { label: 'ARTIKKEL', icon: <ArticleIcon sx={{ fontSize: 15 }} />, color: '#38bdf8' };
  if (r.url) return { label: 'LENKE', icon: <GenericLinkIcon sx={{ fontSize: 15 }} />, color: '#c4b5fd' };
  return { label: 'NOTAT', icon: <ArticleIcon sx={{ fontSize: 15 }} />, color: 'rgba(255,255,255,0.75)' };
}

export function FagstoffTab() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', category: 'idea' as ResourceCategory, description: '', url: '' });
  const [query, setQuery] = useState('');
  const [stegFilter, setStegFilter] = useState<'all' | ResourceCategory>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const setField = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setResources(await educationResourcesService.listResources()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente fagstoff'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!f.title.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await educationResourcesService.createResource({ title: f.title.trim(), category: f.category, description: f.description.trim() || undefined, url: f.url.trim() || undefined });
      setF({ title: '', category: 'idea', description: '', url: '' }); setCreating(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette ressurs'); }
    finally { setBusy(false); }
  };
  const handleAddSuggested = async (s: { category: ResourceCategory; title: string; description: string }) => {
    setBusy(true);
    try { await educationResourcesService.createResource({ title: s.title, category: s.category, description: s.description }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke legge til'); }
    finally { setBusy(false); }
  };
  const handleDelete = async (id: string) => {
    try { await educationResourcesService.deleteResource(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke slette'); }
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cats = stegFilter === 'all' ? RESOURCE_CATEGORIES : RESOURCE_CATEGORIES.filter((c) => c.key === stegFilter);
    return cats.map((cat) => ({
      cat,
      items: resources.filter((r) => r.category === cat.key
        && (!q || r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q))
        && (typeFilter === 'all' || resourceType(r).label === typeFilter)),
    })).filter((g) => g.items.length > 0);
  }, [resources, query, stegFilter, typeFilter]);
  const anyFilter = query.trim() !== '' || stegFilter !== 'all' || typeFilter !== 'all';
  const existingTitles = useMemo(() => new Set(resources.map((r) => r.title.toLowerCase())), [resources]);
  const suggestions = SUGGESTED_RESOURCES.filter((s) => !existingTitles.has(s.title.toLowerCase())).slice(0, 4);

  const videoCount = resources.filter((r) => resourceType(r).label === 'VIDEO').length;
  const stegDekket = new Set(resources.map((r) => r.category)).size;
  const medLenke = resources.filter((r) => r.url).length;
  const kpis = [
    { id: 'leksjoner', label: 'Leksjoner', value: resources.length, hint: `På tvers av ${grouped.length || RESOURCE_CATEGORIES.length} produksjonssteg`, icon: <LibraryIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
    { id: 'video', label: 'Videoleksjoner', value: videoCount, hint: 'Korte «hvordan»-videoer', icon: <VideoIcon />, bg: 'rgba(236,72,153,0.16)', c: '#ec4899' },
    { id: 'steg', label: 'Produksjonssteg dekket', value: `${stegDekket}/${RESOURCE_CATEGORIES.length}`, hint: 'Steg med fagstoff', icon: <ViewsIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8' },
    { id: 'lenker', label: 'Med lenke/ressurs', value: medLenke, hint: 'Video, PDF eller artikkel', icon: <DoneIcon />, bg: 'rgba(16,185,129,0.16)', c: '#34d399' },
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 300px' }, gap: 2.75, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
        {/* Header */}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
          <Stack direction="row" spacing={1.75} alignItems="flex-start">
            <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><LibraryIcon /></Box>
            <Box>
              <T eid="edu-fs-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Fagstoff</T>
              <T eid="edu-fs-subtitle" sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 13.5, mt: 0.4 }}>Korte «hvordan»-leksjoner gruppert etter produksjonssteg — lær faget mens dere bruker verktøyet.</T>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<UploadIcon />} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
              <T eid="edu-fs-btn-upload" component="span" sx={{ fontWeight: 600 }}>Last opp ressurs</T>
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              <T eid="edu-fs-btn-new" component="span" sx={{ fontWeight: 700 }}>Ny leksjon</T>
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        <Collapse in={creating}>
          <Panel sx={{ border: '1px solid rgba(139,92,246,0.35)' }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField size="small" label="Tittel" value={f.title} onChange={(e) => setField('title', e.target.value)} fullWidth />
                <TextField size="small" select label="Produksjonssteg" value={f.category} onChange={(e) => setField('category', e.target.value as ResourceCategory)} sx={{ minWidth: 190 }}>
                  {RESOURCE_CATEGORIES.map((c) => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField size="small" label="Beskrivelse" value={f.description} onChange={(e) => setField('description', e.target.value)} fullWidth />
              <TextField size="small" label="Lenke (video / PDF / artikkel — valgfritt)" value={f.url} onChange={(e) => setField('url', e.target.value)} fullWidth />
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={() => setCreating(false)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
                <Button variant="contained" onClick={handleCreate} disabled={!f.title.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>{busy ? 'Lagrer…' : 'Legg til leksjon'}</Button>
              </Stack>
            </Stack>
          </Panel>
        </Collapse>

        {/* KPI-kort */}
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {kpis.map((k) => (
            <Panel key={k.id} sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <T eid={`edu-fs-kpi-${k.id}-label`} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>{k.label}</T>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.c, '& svg': { fontSize: 19 } }}>{k.icon}</Box>
              </Stack>
              <Typography sx={{ fontSize: 25, fontWeight: 700, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
              <T eid={`edu-fs-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', mt: 0.75 }}>{k.hint}</T>
            </Panel>
          ))}
        </Box>

        {/* Filter-bar */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Select value={stegFilter} onChange={(e) => setStegFilter(e.target.value as 'all' | ResourceCategory)} size="small" IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, minWidth: 160, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.72)' } }}>
            <MenuItem value="all" sx={{ fontSize: 12.5 }}>Alle produksjonssteg</MenuItem>
            {RESOURCE_CATEGORIES.map((c) => <MenuItem key={c.key} value={c.key} sx={{ fontSize: 12.5 }}>{c.label}</MenuItem>)}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} size="small" IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, minWidth: 120, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.72)' } }}>
            {['all', 'VIDEO', 'PDF', 'ARTIKKEL', 'LENKE', 'NOTAT'].map((t) => <MenuItem key={t} value={t} sx={{ fontSize: 12.5 }}>{t === 'all' ? 'Alle typer' : t}</MenuItem>)}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
            <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.75)' }} />
            <InputBase placeholder="Søk i fagstoff" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ color: '#fff', fontSize: 12.5, width: 150, '& input::placeholder': { color: 'rgba(255,255,255,0.75)', opacity: 1 } }} />
          </Stack>
        </Stack>

        {/* Ressurser gruppert per kategori */}
        {grouped.length === 0 ? (
          <Panel><T eid="edu-fs-empty" sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13.5, py: 3, display: 'block' }}>{anyFilter ? 'Ingen leksjoner matcher filteret.' : 'Ingen leksjoner ennå — legg til en, eller bruk et startforslag fra høyre.'}</T></Panel>
        ) : grouped.map((g) => (
          <Box key={g.cat.key}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.72)', mb: 1.25 }}>{g.cat.label}</Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {g.items.map((r) => {
                const t = resourceType(r);
                return (
                  <Panel key={r.id} sx={{ p: 2, position: 'relative', '&:hover': { borderColor: 'rgba(139,92,246,0.4)' } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.35, borderRadius: 1.5, bgcolor: `${t.color}22`, color: t.color, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{t.icon}{t.label}</Box>
                    </Stack>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 700, pr: 3 }}>{r.title}</Typography>
                    {r.description && <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5, lineHeight: 1.45 }}>{r.description}</Typography>}
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.25 }}>
                      {r.url && <Button size="small" href={r.url} target="_blank" rel="noopener" startIcon={<LinkIcon sx={{ fontSize: '14px !important' }} />} sx={{ color: '#c4b5fd', textTransform: 'none', fontSize: 12 }}>Åpne</Button>}
                    </Stack>
                    <IconButton size="small" onClick={() => handleDelete(r.id)} sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.3)' }}><DeleteIcon fontSize="small" /></IconButton>
                  </Panel>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Høyre skinne — startforslag */}
      <Stack spacing={2}>
        <Panel sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.28)' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <SuggestIcon sx={{ fontSize: 18, color: '#c4b5fd' }} />
            <T eid="edu-fs-rail-sugg-title" sx={{ fontWeight: 700, fontSize: 14.5 }}>Kuraterte startforslag</T>
          </Stack>
          <T eid="edu-fs-rail-sugg-body" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', mb: 1.5 }}>Ett-klikks leksjoner knyttet til ekte Role Room-funksjoner.</T>
          {suggestions.length === 0 ? (
            <T eid="edu-fs-sugg-empty" sx={{ fontSize: 12.5, color: 'text.secondary' }}>Alle forslag er lagt til 🎬</T>
          ) : suggestions.map((s, i) => (
            <Box key={i} sx={{ py: 1, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{categoryLabel(s.category)}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.25 }}>{s.title}</Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}>{s.description}</Typography>
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />} onClick={() => handleAddSuggested(s)} disabled={busy} sx={{ color: '#c4b5fd', textTransform: 'none', fontSize: 12, mt: 0.5, px: 0 }}>Legg til</Button>
            </Box>
          ))}
        </Panel>
        <Panel sx={{ bgcolor: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.26)' }}>
          <T eid="edu-fs-tips-title" sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.75 }}>Tips</T>
          <T eid="edu-fs-tips-body" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.76)', lineHeight: 1.5 }}>Hold leksjonene korte (3–6 min) og knytt dem til steget studentene er i akkurat nå.</T>
        </Panel>
      </Stack>
    </Box>
  );
}

export default FagstoffTab;
