/**
 * InfographicTemplatesTab — admin-UI for infografikk-maler som DATA.
 *
 * Legg til / rediger maler UTEN app-deploy: lim inn mal-HTML (__CFG__/setProgress-
 * kontrakt) + velg kategori → lagres i DB → dukker umiddelbart opp i CMS-mal-velgeren,
 * render.png og auto-velg. Innebygde maler (is_builtin) kan deaktiveres, ikke slettes.
 */
import React from 'react';
import {
  Box, Button, Card, CardContent, Chip, FormControlLabel, MenuItem, Stack,
  Switch, TextField, Typography, Divider, Alert,
} from '@mui/material';

interface TemplateRow {
  id: string; label: string; category: string; autoPriority: number;
  accentDefault: string | null; isBuiltin: boolean; active: boolean; workspaceId: string | null;
}

// Workspaces (produkt/merkevare). Tom = Global (delt av alle).
const WORKSPACES = [
  { value: '', label: 'Global (delt av alle)' },
  { value: 'creatorhub', label: 'CreatorHub' },
  { value: 'theroleroom', label: 'The Role Room' },
  { value: 'leadgrid', label: 'Leadgrid' },
];

const CATEGORIES = [
  { value: 'single', label: 'Enkelt tall' },
  { value: 'percent', label: 'Prosent / andel' },
  { value: 'kpis', label: 'Flere KPI-er' },
  { value: 'comparison', label: 'Sammenligning (før/etter)' },
  { value: 'timeline', label: 'Tidslinje / steg' },
  { value: 'other', label: 'Annet' },
];

// Eksempeldata per kategori → forhåndsvisning treffer riktig mal-form.
const SAMPLE_BY_CATEGORY: Record<string, unknown> = {
  single: { value: '128', label: 'Fornøyde brukere' },
  percent: { value: '87%', label: 'Fullført' },
  kpis: { title: 'Q3', cards: [{ value: '124', label: 'Leads' }, { value: '87%', label: 'Konv.' }, { value: '4.8', label: 'Score' }] },
  comparison: { title: 'Vekst', before: { value: '1.2', label: 'Q1' }, after: { value: '1.8', label: 'Q2' } },
  timeline: { title: 'Veikart', steps: [{ value: '2024', label: 'Start', desc: 'MVP' }, { value: '2025', label: 'Vekst', desc: '10k' }] },
  other: { value: '42', label: 'Eksempel' },
};

const EMPTY = { id: '', label: '', category: 'single', accent: '#2f6df0', autoPriority: 0, active: true, html: '', workspace: '' };

function b64url(obj: unknown): string {
  const s = JSON.stringify(obj);
  const b = btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function InfographicTemplatesTab({ workspace }: { workspace?: string } = {}) {
  // Shell-styrt workspace: filtrer lista + default nye maler til workspacet.
  const controlled = typeof workspace === 'string' && workspace.length > 0 && workspace !== 'global';
  const [rows, setRows] = React.useState<TemplateRow[]>([]);
  const [form, setForm] = React.useState({ ...EMPTY, workspace: controlled ? (workspace as string) : '' });
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewKey, setPreviewKey] = React.useState(0);

  const load = React.useCallback(() => {
    fetch('/api/admin/infographics/templates', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Kunne ikke hente maler'))))
      .then((d) => setRows(d.templates || []))
      .catch((e) => setMsg({ type: 'error', text: e.message }));
  }, []);
  React.useEffect(load, [load]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const startEdit = (row: TemplateRow) => {
    // Hent full mal (m/ html) — admin-lista har ikke html; bruk render-html-endepunktet.
    fetch(`/api/admin/infographics/templates`, { credentials: 'same-origin' }); // liste allerede lastet
    setEditingId(row.id);
    setForm({
      id: row.id, label: row.label, category: row.category, accent: row.accentDefault || '#2f6df0',
      autoPriority: row.autoPriority, active: row.active, html: '', workspace: row.workspaceId || '',
    });
    setMsg({ type: 'success', text: `Redigerer «${row.id}». La HTML-feltet stå tomt for å beholde eksisterende HTML.` });
  };

  const save = async () => {
    setMsg(null);
    const isEdit = !!editingId;
    const body: Record<string, unknown> = {
      id: form.id, label: form.label, category: form.category,
      accent: form.accent, autoPriority: Number(form.autoPriority) || 0, active: form.active,
      workspaceId: form.workspace || null,
    };
    if (form.html.trim() || !isEdit) body.html = form.html;
    // Ved redigering uten ny HTML: hent eksisterende og send med (upsert krever html).
    if (isEdit && !form.html.trim()) {
      setMsg({ type: 'error', text: 'Lim inn HTML for å lagre endringer (kan ikke oppdatere uten).' });
      return;
    }
    try {
      const url = isEdit ? `/api/admin/infographics/templates/${form.id}` : '/api/admin/infographics/templates';
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: d.error || 'Lagring feilet' }); return; }
      setMsg({ type: 'success', text: `Mal «${form.id}» lagret. Tilgjengelig i CMS + render.png umiddelbart.` });
      setForm({ ...EMPTY }); setEditingId(null); load(); setPreviewKey((k) => k + 1);
    } catch (e) {
      setMsg({ type: 'error', text: (e as Error).message });
    }
  };

  const del = async (id: string) => {
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/infographics/templates/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: d.error || 'Sletting feilet' }); return; }
      setMsg({ type: 'success', text: `Mal «${id}» slettet.` }); load();
    } catch (e) {
      setMsg({ type: 'error', text: (e as Error).message });
    }
  };

  const previewId = editingId || form.id;
  const previewSrc = previewId && /^[a-z0-9][a-z0-9-]*$/.test(previewId)
    ? `/api/infographics/render.png?tpl=${previewId}&d=${b64url(SAMPLE_BY_CATEGORY[form.category] || {})}&accent=${encodeURIComponent(form.accent)}&_=${previewKey}`
    : '';

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Infografikk-maler</Typography>
      <Typography variant="body2" color="text.secondary">
        Maler er data — lim inn HTML (kontrakt: <code>window.__CFG__</code> inn, <code>window.setProgress(p)</code> +
        element med <code>id="wrap"</code>) og de dukker opp i CMS-mal-velgeren, render.png og auto-velg <b>uten app-deploy</b>.
      </Typography>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            {editingId ? `Rediger «${editingId}»` : 'Ny mal'}
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField label="Mal-id (slug)" size="small" value={form.id} disabled={!!editingId}
                onChange={(e) => set({ id: e.target.value })} sx={{ flex: 1 }}
                helperText="små bokstaver/tall/bindestrek" />
              <TextField label="Visningsnavn" size="small" value={form.label}
                onChange={(e) => set({ label: e.target.value })} sx={{ flex: 2 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField select label="Kategori (for auto-velg)" size="small" value={form.category}
                onChange={(e) => set({ category: e.target.value })} sx={{ flex: 1 }}>
                {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
              <TextField select label="Workspace" size="small" value={form.workspace}
                onChange={(e) => set({ workspace: e.target.value })} sx={{ flex: 1 }}
                helperText="hvilket produkt malen tilhører">
                {WORKSPACES.map((w) => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
              </TextField>
              <TextField label="Aksentfarge" size="small" value={form.accent}
                onChange={(e) => set({ accent: e.target.value })} sx={{ width: 140 }} />
              <TextField label="Auto-prioritet" size="small" type="number" value={form.autoPriority}
                onChange={(e) => set({ autoPriority: Number(e.target.value) })} sx={{ width: 130 }}
                helperText="høyest vinner" />
              <FormControlLabel control={<Switch checked={form.active} onChange={(e) => set({ active: e.target.checked })} />} label="Aktiv" />
            </Stack>
            <TextField label={editingId ? 'Mal-HTML (lim inn på nytt for å endre)' : 'Mal-HTML'} size="small"
              value={form.html} onChange={(e) => set({ html: e.target.value })}
              multiline minRows={6} maxRows={16} sx={{ fontFamily: 'monospace' }}
              placeholder={'<style>#wrap{…}</style>\n<div id="wrap">…</div>\n<script> window.setProgress = function(p){…}; </script>'} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={save} disabled={!form.id || !form.label}>
                {editingId ? 'Lagre endringer' : 'Legg til mal'}
              </Button>
              {editingId && <Button onClick={() => { setForm({ ...EMPTY }); setEditingId(null); setMsg(null); }}>Avbryt</Button>}
            </Stack>
            {previewSrc && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Forhåndsvisning (eksempeldata for kategorien):</Typography>
                <Box sx={{ mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', justifyContent: 'center' }}>
                  <img src={previewSrc} alt="forhåndsvisning" style={{ maxWidth: '100%', maxHeight: 260 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </Box>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Divider />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {controlled ? `Maler for «${workspace}» + globale` : 'Alle maler'} ({(controlled ? rows.filter((r) => !r.workspaceId || r.workspaceId === workspace) : rows).length})
      </Typography>
      <Stack spacing={1}>
        {(controlled ? rows.filter((r) => !r.workspaceId || r.workspaceId === workspace) : rows).map((r) => (
          <Card key={r.id} variant="outlined">
            <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {r.label} <Typography component="span" variant="caption" color="text.secondary">({r.id})</Typography>
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Chip size="small" color={r.workspaceId ? 'secondary' : 'default'}
                      label={r.workspaceId ? (WORKSPACES.find((w) => w.value === r.workspaceId)?.label ?? r.workspaceId) : 'Global'} />
                    <Chip size="small" label={r.category} />
                    {r.isBuiltin && <Chip size="small" color="info" label="Innebygd" />}
                    {!r.active && <Chip size="small" color="warning" label="Inaktiv" />}
                    <Chip size="small" variant="outlined" label={`prio ${r.autoPriority}`} />
                  </Stack>
                </Box>
                <Button size="small" onClick={() => startEdit(r)}>Rediger</Button>
                <Button size="small" color="error" disabled={r.isBuiltin} onClick={() => del(r.id)}>Slett</Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
