/**
 * QuoteBuilderPanel — The Role Room pristilbud (porter mr-pris-designet).
 * Innholdsprodusenten bygger et tilbud med linjeposter (enheter × stykkpris),
 * pakkerabatt og mva, ser live totaler, lagrer og markerer som sendt til
 * klienten. Egen Role Room-feature (mig 289).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, Chip, IconButton, TextField, CircularProgress, Tooltip, MenuItem } from '@mui/material';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import VideocamIcon from '@mui/icons-material/Videocam';
import roleRoomAgentService, {
  type RoleRoomQuote, type RoleRoomQuoteInput, type RoleRoomQuoteLineItem,
} from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const DEFAULT_ITEMS: RoleRoomQuoteLineItem[] = [
  { label: 'Reels-produksjon', detail: 'Idé, opptak og klipp', units: 0, unitLabel: 'stk', unitPriceKr: 4500 },
  { label: 'Foto til feed', detail: 'Redigert og leveranseklar', units: 0, unitLabel: 'stk', unitPriceKr: 1200 },
  { label: 'Annonsestyring', detail: 'Meta & TikTok pr. måned', units: 0, unitLabel: 'mnd', unitPriceKr: 4900 },
  { label: 'Innsiktsrapport', detail: 'Månedlig ytelse & anbefaling', units: 0, unitLabel: 'stk', unitPriceKr: 1500 },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Utkast', color: '#fde68a', bg: 'rgba(250,204,21,0.14)' },
  sent: { label: 'Sendt', color: '#a5f3fc', bg: 'rgba(34,211,238,0.14)' },
  accepted: { label: 'Akseptert', color: '#86efac', bg: 'rgba(34,197,94,0.16)' },
  declined: { label: 'Avslått', color: '#fca5a5', bg: 'rgba(239,68,68,0.14)' },
};

export interface QuoteBuilderPanelProps { projectId: string; clientName?: string | null }

function fmtKr(n: number): string { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

export default function QuoteBuilderPanel({ projectId, clientName }: QuoteBuilderPanelProps): React.ReactElement {
  const [quotes, setQuotes] = React.useState<RoleRoomQuote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<RoleRoomQuote | 'new' | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<RoleRoomQuoteInput>({ clientName: clientName ?? null, lineItems: DEFAULT_ITEMS, discountPct: 10, vatPct: 25, validUntil: null, notes: null });

  const load = React.useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    void roleRoomAgentService.listQuotes(projectId).then(setQuotes).finally(() => setLoading(false));
  }, [projectId]);
  React.useEffect(() => { load(); }, [load]);

  const openNew = (): void => {
    setForm({ clientName: clientName ?? null, lineItems: DEFAULT_ITEMS.map((i) => ({ ...i })), discountPct: 10, vatPct: 25, validUntil: null, notes: null });
    setEditing('new');
  };
  const openEdit = (q: RoleRoomQuote): void => {
    setForm({ clientName: q.client_name, lineItems: q.line_items.length ? q.line_items : DEFAULT_ITEMS.map((i) => ({ ...i })), discountPct: q.discount_pct, vatPct: q.vat_pct, validUntil: q.valid_until, notes: q.notes });
    setEditing(q);
  };

  const setItem = (idx: number, patch: Partial<RoleRoomQuoteLineItem>): void =>
    setForm((f) => ({ ...f, lineItems: f.lineItems.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const addItem = (): void => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { label: 'Ny post', detail: null, units: 1, unitLabel: 'stk', unitPriceKr: 0 }] }));
  const removeItem = (idx: number): void => setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));

  const subtotal = form.lineItems.reduce((a, i) => a + i.units * i.unitPriceKr, 0);
  const discount = subtotal * (form.discountPct / 100);
  const net = subtotal - discount;
  const vat = net * (form.vatPct / 100);
  const total = net + vat;
  const postCount = form.lineItems.filter((i) => i.units > 0).length;

  const save = async (): Promise<void> => {
    setSaving(true);
    const res = editing === 'new'
      ? await roleRoomAgentService.createQuote(projectId, form)
      : editing ? await roleRoomAgentService.updateQuote(editing.id, form) : null;
    setSaving(false);
    if (res) { setEditing(null); load(); }
  };

  const setStatus = async (q: RoleRoomQuote, status: 'sent' | 'accepted' | 'declined'): Promise<void> => {
    setBusyId(q.id);
    const ok = await roleRoomAgentService.setQuoteStatus(q.id, status);
    setBusyId(null);
    if (ok) setQuotes((prev) => prev.map((x) => x.id === q.id ? { ...x, status } : x));
  };
  const remove = async (id: string): Promise<void> => {
    if (!window.confirm('Slette dette tilbudet?')) return;
    if (await roleRoomAgentService.deleteQuote(id)) setQuotes((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <Box sx={{
      borderRadius: 3, p: { xs: 2, md: 2.4 }, mb: 1.5, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
        <Stack direction="row" alignItems="center" spacing={1.1}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD }}>
            <RequestQuoteIcon sx={{ fontSize: 17, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Pristilbud</Typography>
            <Typography sx={{ fontSize: 11.5, color: MUTED }}>Bygg og send tilbud til klienten</Typography>
          </Box>
        </Stack>
        {editing === null ? (
          <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={openNew} sx={{ textTransform: 'none', fontWeight: 700, color: ACCENT }}>Nytt tilbud</Button>
        ) : null}
      </Stack>

      {/* Builder */}
      {editing !== null ? (
        <Stack spacing={1.4}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <TextField size="small" label="Klient" fullWidth value={form.clientName ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value || null })} sx={fieldSx} />
            <TextField size="small" label="Gyldig til" type="date" InputLabelProps={{ shrink: true }} value={form.validUntil ?? ''} onChange={(e) => setForm({ ...form, validUntil: e.target.value || null })} sx={{ ...fieldSx, minWidth: 160 }} />
          </Stack>

          {/* Linjeposter */}
          <Stack spacing={0.8}>
            {form.lineItems.map((it, idx) => (
              <Box key={idx} sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', flexShrink: 0, color: ACCENT, bgcolor: 'rgba(168,85,247,0.12)' }}><VideocamIcon sx={{ fontSize: 16 }} /></Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <TextField variant="standard" fullWidth value={it.label} onChange={(e) => setItem(idx, { label: e.target.value })} InputProps={{ disableUnderline: true, sx: { fontSize: 13.5, fontWeight: 700, color: INK } }} />
                    <TextField variant="standard" fullWidth placeholder="beskrivelse" value={it.detail ?? ''} onChange={(e) => setItem(idx, { detail: e.target.value || null })} InputProps={{ disableUnderline: true, sx: { fontSize: 11.5, color: MUTED } }} />
                  </Box>
                  <TextField size="small" type="number" value={it.units} onChange={(e) => setItem(idx, { units: Math.max(0, Number(e.target.value) || 0) })} sx={{ ...fieldSx, width: 64 }} inputProps={{ style: { textAlign: 'right' } }} />
                  <TextField size="small" select value={it.unitLabel ?? 'stk'} onChange={(e) => setItem(idx, { unitLabel: e.target.value })} sx={{ ...fieldSx, width: 72 }}>
                    {['stk', 'mnd', 'time', 'dag'].map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </TextField>
                  <TextField size="small" type="number" value={it.unitPriceKr} onChange={(e) => setItem(idx, { unitPriceKr: Math.max(0, Number(e.target.value) || 0) })} sx={{ ...fieldSx, width: 96 }} inputProps={{ style: { textAlign: 'right' } }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: INK, minWidth: 78, textAlign: 'right' }}>{fmtKr(it.units * it.unitPriceKr)} kr</Typography>
                  <IconButton size="small" onClick={() => removeItem(idx)} sx={{ color: 'rgba(248,113,113,0.6)' }}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton>
                </Stack>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={addItem} sx={{ textTransform: 'none', color: ACCENT, alignSelf: 'flex-start' }}>Legg til post</Button>
          </Stack>

          {/* Rabatt + summering */}
          <Stack direction="row" spacing={1.2} alignItems="center">
            <TextField size="small" label="Rabatt %" type="number" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} sx={{ ...fieldSx, width: 110 }} />
            <TextField size="small" label="Mva %" type="number" value={form.vatPct} onChange={(e) => setForm({ ...form, vatPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} sx={{ ...fieldSx, width: 100 }} />
          </Stack>
          <Box sx={{ p: 1.4, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(167,139,250,0.24)' }}>
            {[
              { k: `Sum eks. mva`, v: `${fmtKr(subtotal)} kr` },
              { k: `Pakkerabatt · ${form.discountPct} %`, v: `− ${fmtKr(discount)} kr` },
              { k: `Mva · ${form.vatPct} %`, v: `${fmtKr(vat)} kr` },
            ].map((r) => (
              <Stack key={r.k} direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                <Typography sx={{ fontSize: 12.5, color: MUTED }}>{r.k}</Typography>
                <Typography sx={{ fontSize: 12.5, color: INK }}>{r.v}</Typography>
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.6, pt: 0.6, borderTop: '1px solid rgba(148,163,184,0.16)' }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Totalt inkl. mva · {postCount} poster</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: INK }}>{fmtKr(total)} kr</Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setEditing(null)} disabled={saving} sx={{ textTransform: 'none', color: MUTED }}>Avbryt</Button>
            <Button size="small" variant="contained" disableElevation onClick={() => void save()} disabled={saving}
              startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
              sx={{ textTransform: 'none', fontWeight: 700, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
              Lagre tilbud
            </Button>
          </Stack>
        </Stack>
      ) : loading ? (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
      ) : quotes.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: MUTED, py: 1 }}>Ingen tilbud ennå. Klikk «Nytt tilbud».</Typography>
      ) : (
        <Stack spacing={0.8}>
          {quotes.map((q) => {
            const s = STATUS_META[q.status] ?? STATUS_META.draft;
            return (
              <Stack key={q.id} direction="row" alignItems="center" spacing={1.2} sx={{ p: 1.1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: INK }}>{q.quote_number || 'Tilbud'} {q.client_name ? <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}>· {q.client_name}</Box> : null}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: MUTED }}>{fmtKr(q.total_kr)} kr inkl. mva{q.valid_until ? ` · gyldig til ${q.valid_until}` : ''}</Typography>
                </Box>
                <Chip size="small" label={s.label} sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10.5, flexShrink: 0 }} />
                {q.status === 'draft' ? (
                  <Tooltip title="Marker som sendt">
                    <span><IconButton size="small" disabled={busyId === q.id} onClick={() => void setStatus(q, 'sent')} sx={{ color: ACCENT }}>{busyId === q.id ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <SendIcon sx={{ fontSize: 16 }} />}</IconButton></span>
                  </Tooltip>
                ) : null}
                <Tooltip title="Rediger"><IconButton size="small" onClick={() => openEdit(q)} sx={{ color: 'rgba(226,232,240,0.55)' }}><EditIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                <Tooltip title="Slett"><IconButton size="small" onClick={() => void remove(q.id)} sx={{ color: 'rgba(248,113,113,0.6)' }}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': { color: '#f5f3ff', fontSize: 13, '& fieldset': { borderColor: 'rgba(167,139,250,0.3)' } },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.6)', fontSize: 13 },
} as const;
