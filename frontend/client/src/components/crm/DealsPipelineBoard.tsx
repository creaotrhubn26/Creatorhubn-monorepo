// Wave 1 (#3/#19/#32/#46) — a real sales pipeline: the board operates on DEALS
// (value, probability, stage), not on customer.status. A repeat client becomes
// two distinct opportunities; the customer record persists across them.
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Box, Paper, Stack, Typography, Chip, Button, Card, CardContent, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Menu,
  CircularProgress, Alert,
} from '@mui/material';
import {
  Add as AddIcon, MoreVert as MoreIcon, ArrowForward as MoveIcon,
  DeleteOutline as DeleteIcon, EmojiEvents as WonIcon, Cancel as LostIcon,
} from '@mui/icons-material';
import { BrandScope } from './crm-brand';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'prospecting', label: 'Prospektering', color: '#64748b' },
  { key: 'qualified', label: 'Kvalifisert', color: '#0288d1' },
  { key: 'proposal', label: 'Tilbud', color: '#7c3aed' },
  { key: 'negotiation', label: 'Forhandling', color: '#f59e0b' },
  { key: 'closed_won', label: 'Vunnet', color: '#16a34a' },
  { key: 'closed_lost', label: 'Tapt', color: '#9ca3af' },
];
const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label || k;
const stageColor = (k: string) => STAGES.find((s) => s.key === k)?.color || '#64748b';
const nok = (v: any) => `${Math.round(Number(v) || 0).toLocaleString('nb-NO')} kr`;

const emptyForm = { id: '', customerId: '', title: '', value: '', probability: '50', stage: 'prospecting', expectedCloseDate: '' };

export default function DealsPipelineBoard({ profession, brandColor }: { profession?: string; brandColor?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuDeal, setMenuDeal] = useState<any>(null);

  const { data, isLoading, error } = useQuery<{ deals: any[] }>({
    queryKey: ['universal-crm-deals', 'board'],
    queryFn: () => apiRequest('/api/universal-crm/deals?limit=200'),
  });
  const { data: custData } = useQuery<any>({
    queryKey: ['universal-crm-customers', profession, '', ''],
    queryFn: () => apiRequest(`/api/universal-crm/customers${profession ? `?profession=${encodeURIComponent(profession)}` : ''}`),
  });
  const customers = custData?.customers || [];
  const deals = data?.deals || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['universal-crm-deals'] });
    queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId: form.customerId || null,
        title: form.title.trim(),
        value: Number(form.value) || 0,
        probability: Number(form.probability) || 0,
        stage: form.stage,
        expected_close_date: form.expectedCloseDate || null,
      };
      if (form.id) return apiRequest(`/api/universal-crm/deals/${encodeURIComponent(form.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      return apiRequest('/api/universal-crm/deals', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: form.id ? 'Deal oppdatert' : 'Deal opprettet', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Kunne ikke lagre deal', description: e?.message, variant: 'destructive' }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) =>
      apiRequest(`/api/universal-crm/deals/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ stage }) }),
    onSuccess: (_r, v) => { invalidate(); toast({ title: `Flyttet til ${stageLabel(v.stage)}`, variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Kunne ikke flytte deal', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/universal-crm/deals/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast({ title: 'Deal slettet', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Kunne ikke slette deal', description: e?.message, variant: 'destructive' }),
  });

  const openCreate = (stage: string) => { setForm({ ...emptyForm, stage }); setDialogOpen(true); };
  const openEdit = (d: any) => {
    setForm({
      id: d.id, customerId: d.customer_id || '', title: d.title || '', value: d.value != null ? String(d.value) : '',
      probability: d.probability != null ? String(d.probability) : '50', stage: d.stage || 'prospecting',
      expectedCloseDate: d.expected_close_date ? String(d.expected_close_date).slice(0, 10) : '',
    });
    setDialogOpen(true);
    setMenuEl(null);
  };

  if (isLoading) return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>;
  if (error) return <Alert severity="error">Kunne ikke laste pipeline.</Alert>;

  return (
    <BrandScope brandColor={brandColor}>
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {deals.length} deals · åpen verdi {nok(deals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + (Number(d.value) || 0), 0))}
        </Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openCreate('prospecting')}>Ny deal</Button>
      </Stack>

      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
        {STAGES.map((stage) => {
          const inStage = deals.filter((d) => (d.stage || 'prospecting') === stage.key);
          const sum = inStage.reduce((s, d) => s + (Number(d.value) || 0), 0);
          return (
            <Paper key={stage.key} elevation={0} sx={{ minWidth: 260, flex: '0 0 260px', borderRadius: 3, border: `1px solid ${stage.color}40`, bgcolor: `${stage.color}08`, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: stage.color }}>{stage.label}</Typography>
                <Chip size="small" label={inStage.length} sx={{ bgcolor: `${stage.color}22`, color: stage.color, fontWeight: 700 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{nok(sum)}</Typography>
              <Stack spacing={1}>
                {inStage.length === 0 ? (
                  <Button size="small" startIcon={<AddIcon />} onClick={() => openCreate(stage.key)} sx={{ color: stage.color, justifyContent: 'flex-start' }}>Legg til</Button>
                ) : inStage.map((d) => (
                  <Card key={d.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="body2" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => openEdit(d)}>{d.title}</Typography>
                        <IconButton size="small" onClick={(e) => { setMenuEl(e.currentTarget); setMenuDeal(d); }}><MoreIcon fontSize="small" /></IconButton>
                      </Stack>
                      {d.customer_name && <Typography variant="caption" color="text.secondary" display="block">{d.customer_name}</Typography>}
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={nok(d.value)} sx={{ bgcolor: `${stage.color}14`, color: stage.color, fontWeight: 700 }} />
                        {d.probability != null && <Chip size="small" variant="outlined" label={`${d.probability}%`} />}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Paper>
          );
        })}
      </Box>

      {/* Per-deal action menu: move / won / lost / edit / delete */}
      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
        {STAGES.filter((s) => s.key !== menuDeal?.stage).map((s) => (
          <MenuItem key={s.key} onClick={() => { moveMutation.mutate({ id: menuDeal.id, stage: s.key }); setMenuEl(null); }}>
            {s.key === 'closed_won' ? <WonIcon fontSize="small" sx={{ mr: 1, color: '#16a34a' }} /> : s.key === 'closed_lost' ? <LostIcon fontSize="small" sx={{ mr: 1, color: '#9ca3af' }} /> : <MoveIcon fontSize="small" sx={{ mr: 1 }} />}
            Flytt til {s.label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => openEdit(menuDeal)}>Rediger…</MenuItem>
        <MenuItem onClick={() => { deleteMutation.mutate(menuDeal.id); setMenuEl(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Slett
        </MenuItem>
      </Menu>

      {/* Create / edit deal dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Rediger deal' : 'Ny deal'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Tittel" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} fullWidth required />
            <TextField select label="Kunde" value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} fullWidth>
              <MenuItem value="">— ingen —</MenuItem>
              {customers.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField label="Verdi (NOK)" type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} fullWidth />
              <TextField label="Sannsynlighet %" type="number" value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField select label="Stadium" value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} fullWidth>
                {STAGES.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
              </TextField>
              <TextField label="Forventet lukking" type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" disabled={!form.title.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Lagrer…' : form.id ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </BrandScope>
  );
}
