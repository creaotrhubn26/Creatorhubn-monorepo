// @ts-nocheck
/**
 * SupportTicketsPanel — admin-kø for support-tickets (support_tickets).
 *
 * Leser GET /api/support/tickets (admin-gated) og triagerer via
 * PATCH /api/support/tickets/:id (status/tildeling/løsningsnotat). Dette er
 * admin-siden av support-løsningen: workspace-brukere sender inn via
 * SupportDialog, produsent/casting via RoleRoomFeedbackFab — begge lander her.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiRequest } from '@/lib/queryClient';

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'Åpen', color: '#d97706' },
  in_progress: { label: 'Under arbeid', color: '#2563eb' },
  resolved: { label: 'Løst', color: '#16a34a' },
  closed: { label: 'Lukket', color: '#6b7280' },
};
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low: { label: 'Lav', color: '#6b7280' },
  medium: { label: 'Middels', color: '#2563eb' },
  high: { label: 'Høy', color: '#d97706' },
  critical: { label: 'Kritisk', color: '#dc2626' },
};
const CATEGORY_LABEL: Record<string, string> = {
  bug: 'Feil', feature: 'Ønske', question: 'Spørsmål', other: 'Annet',
};
const FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Åpne' },
  { key: 'in_progress', label: 'Under arbeid' },
  { key: 'resolved', label: 'Løst' },
  { key: 'closed', label: 'Lukket' },
  { key: 'all', label: 'Alle' },
];

const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return s || ''; }
};

const SupportTicketsPanel: React.FC<{
  endpoint?: string;
  title?: string;
  subtitle?: string;
}> = ({
  endpoint = '/api/support/tickets',
  title = 'Kundestøtte',
  subtitle = 'Support-tickets fra workspace og produktet.',
}) => {
  const [filter, setFilter] = useState('open');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = filter === 'all' ? '?limit=200' : `?status=${filter}&limit=200`;
      const rows = await apiRequest(`${endpoint}${qs}`);
      setTickets(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste tickets. (Krever admin-innlogging.)');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filter, endpoint]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tickets.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tickets]);

  const patch = async (patchBody: Record<string, unknown>) => {
    if (!sel) return;
    setSaving(true); setSaveErr(null);
    try {
      const updated = await apiRequest(`${endpoint}/${sel.id}`, { method: 'PATCH', body: patchBody });
      // Oppdater lokalt + reflow liste (statusfilter kan skjule den nå).
      setSel((s: any) => ({ ...s, ...normalize(updated) }));
      await load();
    } catch (e: any) {
      setSaveErr(e?.message || 'Kunne ikke lagre.');
    } finally {
      setSaving(false);
    }
  };

  // GET returnerer camelCase; PATCH returnerer RETURNING * (snake_case). Slå sammen.
  const normalize = (r: any) => r ? {
    ...r,
    status: r.status,
    assignedTo: r.assignedTo ?? r.assigned_to ?? null,
    resolutionNote: r.resolutionNote ?? r.resolution_note ?? '',
    createdAt: r.createdAt ?? r.created_at,
    context: r.context ?? {},
  } : r;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
            {FILTERS.map((f) => (
              <ToggleButton key={f.key} value={f.key} sx={{ textTransform: 'none' }}>
                {f.label}{counts[f.key] != null && f.key !== 'all' ? ` (${counts[f.key]})` : ''}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Tooltip title="Oppdater"><span><Button size="small" onClick={load} startIcon={<RefreshIcon />} disabled={loading}>Oppdater</Button></span></Tooltip>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : tickets.length === 0 ? (
        <Card variant="outlined"><CardContent><Typography color="text.secondary">Ingen tickets i denne visningen.</Typography></CardContent></Card>
      ) : (
        <Stack spacing={1.25}>
          {tickets.map((tk) => {
            const st = STATUS_META[tk.status] || { label: tk.status, color: '#6b7280' };
            const pr = PRIORITY_META[tk.priority] || { label: tk.priority, color: '#6b7280' };
            return (
              <Card key={tk.id} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => { setSel(normalize(tk)); setSaveErr(null); }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                    <Chip size="small" label={st.label} sx={{ bgcolor: st.color, color: '#fff', fontWeight: 600 }} />
                    <Chip size="small" variant="outlined" label={pr.label} sx={{ borderColor: pr.color, color: pr.color }} />
                    <Chip size="small" variant="outlined" label={CATEGORY_LABEL[tk.category] || tk.category} />
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="caption" color="text.secondary">{fmtDate(tk.createdAt)}</Typography>
                  </Stack>
                  <Typography sx={{ fontWeight: 600 }}>{tk.title}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{tk.description}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tk.userName || tk.userEmail || tk.userId || 'anonym'}
                    {tk.context?.source ? ` · ${tk.context.source}` : ''}
                    {tk.assignedTo ? ` · tildelt ${tk.assignedTo}` : ''}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <TicketDetailDialog sel={sel} onClose={() => setSel(null)} onPatch={patch} saving={saving} saveErr={saveErr} />
    </Box>
  );
};

const TicketDetailDialog: React.FC<{ sel: any; onClose: () => void; onPatch: (b: any) => void; saving: boolean; saveErr: string | null }> = ({ sel, onClose, onPatch, saving, saveErr }) => {
  const [status, setStatus] = useState('open');
  const [assignedTo, setAssignedTo] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    if (sel) {
      setStatus(sel.status || 'open');
      setAssignedTo(sel.assignedTo || '');
      setResolutionNote(sel.resolutionNote || '');
    }
  }, [sel?.id]);

  if (!sel) return null;
  const st = STATUS_META[sel.status] || { label: sel.status, color: '#6b7280' };
  const ctx = sel.context || {};

  const save = () => {
    const body: Record<string, unknown> = {};
    if (status !== sel.status) body.status = status;
    if ((assignedTo || '') !== (sel.assignedTo || '')) body.assignedTo = assignedTo.trim() || null;
    if ((resolutionNote || '') !== (sel.resolutionNote || '')) body.resolutionNote = resolutionNote;
    if (Object.keys(body).length === 0) { onClose(); return; }
    onPatch(body);
  };

  return (
    <Dialog open={!!sel} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip size="small" label={st.label} sx={{ bgcolor: st.color, color: '#fff', fontWeight: 600 }} />
        {sel.title}
      </DialogTitle>
      <DialogContent dividers>
        {saveErr && <Alert severity="error" sx={{ mb: 2 }}>{saveErr}</Alert>}
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{sel.description}</Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Fra: {sel.userName || '—'} {sel.userEmail ? `<${sel.userEmail}>` : ''} · {fmtDate(sel.createdAt)}
        </Typography>
        {(ctx.url || ctx.tabLabel || ctx.projectName) && (
          <Box sx={{ mt: 1, mb: 2, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Kontekst</Typography>
            {ctx.source && <Typography variant="caption" sx={{ display: 'block' }}>Kilde: {ctx.source}</Typography>}
            {ctx.tabLabel && <Typography variant="caption" sx={{ display: 'block' }}>Fane: {ctx.tabLabel}</Typography>}
            {ctx.projectName && <Typography variant="caption" sx={{ display: 'block' }}>Prosjekt: {ctx.projectName}</Typography>}
            {ctx.url && <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-all' }}>URL: {ctx.url}</Typography>}
            {(ctx.viewportWidth || ctx.viewportHeight) && <Typography variant="caption" sx={{ display: 'block' }}>Viewport: {ctx.viewportWidth}×{ctx.viewportHeight}</Typography>}
            {ctx.lastConsoleError && <Typography variant="caption" sx={{ display: 'block', color: 'error.main' }}>Konsollfeil: {ctx.lastConsoleError}</Typography>}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          <TextField select fullWidth size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_META).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Tildelt (admin-e-post)" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="ingen" />
          <TextField fullWidth size="small" multiline minRows={2} label="Løsningsnotat" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Notat ved løsning/lukking" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Lukk</Button>
        <Button onClick={save} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={15} /> : undefined}>Lagre</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SupportTicketsPanel;
