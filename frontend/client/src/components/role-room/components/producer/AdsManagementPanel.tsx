import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  PauseCircle as PauseIcon,
  PlayCircle as PlayIcon,
  StopCircle as StopIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomAdsCampaign,
  type RoleRoomAdsCampaignStatus,
  type RoleRoomMetaAdAccount,
} from '../../services/roleRoomAgentService';

/**
 * Producer-facing campaign management: see all campaigns (status, budget),
 * pause/resume/end, and create a new Meta campaign. Backed by /ads/* routes.
 * Write paths require Meta App Review (ads_management) in production.
 */

const CARD_SX = {
  p: 1.6,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;
const LABEL = { color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' } as const;
const SUBTLE = { color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' } as const;

const nok = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n);

const STATUS_META: Record<RoleRoomAdsCampaignStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Aktiv', color: '#86efac', bg: 'rgba(134,239,172,0.12)' },
  paused: { label: 'Pauset', color: '#fcd34d', bg: 'rgba(252,211,77,0.12)' },
  draft: { label: 'Utkast', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)' },
  ended: { label: 'Avsluttet', color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.12)' },
  failed: { label: 'Feilet', color: '#fca5a5', bg: 'rgba(252,165,165,0.12)' },
};

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC', label: 'Trafikk' },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_SALES', label: 'Salg' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engasjement' },
  { value: 'OUTCOME_AWARENESS', label: 'Kjennskap' },
];

export default function AdsManagementPanel({ projectId }: { projectId: string }) {
  const [campaigns, setCampaigns] = useState<RoleRoomAdsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [adAccounts, setAdAccounts] = useState<RoleRoomMetaAdAccount[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [form, setForm] = useState({ adAccountId: '', name: '', objective: 'OUTCOME_TRAFFIC', dailyBudgetNok: '' });
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await roleRoomAgentService.listAdsCampaigns({ projectId }));
    } catch {
      setError('Klarte ikke å hente kampanjer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const act = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    setError(null);
    const res = await fn();
    if (!res.ok) setError(res.error || 'Handlingen feilet.');
    await refresh();
    setBusyId(null);
  };

  const openCreate = async () => {
    setCreateOpen((v) => !v);
    if (adAccounts.length === 0) {
      const res = await roleRoomAgentService.listMetaAdAccounts();
      if ('error' in res) setAccountError(res.error);
      else {
        setAdAccounts(res.accounts);
        if (res.accounts[0]) setForm((f) => ({ ...f, adAccountId: res.accounts[0].id }));
      }
    }
  };

  const submitCreate = async () => {
    if (!form.adAccountId || !form.name.trim()) return;
    setCreating(true);
    setError(null);
    const res = await roleRoomAgentService.createMetaCampaign({
      projectId,
      adAccountId: form.adAccountId,
      name: form.name.trim(),
      objective: form.objective,
      dailyBudgetNok: form.dailyBudgetNok ? Number(form.dailyBudgetNok) : undefined,
    });
    if ('error' in res) setError(res.error);
    else {
      setCreateOpen(false);
      setForm({ adAccountId: form.adAccountId, name: '', objective: 'OUTCOME_TRAFFIC', dailyBudgetNok: '' });
      await refresh();
    }
    setCreating(false);
  };

  const activeCount = campaigns.filter((c) => c.status === 'active').length;

  return (
    <Stack spacing={1.2} sx={CARD_SX}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CampaignIcon sx={{ fontSize: 20, color: '#f0abfc' }} />
        <Typography sx={LABEL}>Annonser</Typography>
        {campaigns.length > 0 && (
          <Chip
            size="small"
            label={`${activeCount} aktive / ${campaigns.length} totalt`}
            sx={{ fontWeight: 700, color: '#e2e8f0', bgcolor: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.2)' }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ textTransform: 'none', color: '#f0abfc', fontWeight: 700 }}
        >
          Ny kampanje
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>{error}</Alert>}

      {/* Opprett-kampanje-skjema */}
      <Collapse in={createOpen} unmountOnExit>
        <Stack spacing={1} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.16)' }}>
          {accountError ? (
            <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
              {accountError} — koble Meta først.
            </Alert>
          ) : (
            <>
              <TextField
                select size="small" label="Annonsekonto" value={form.adAccountId}
                onChange={(e) => setForm({ ...form, adAccountId: e.target.value })}
                sx={fieldSx}
              >
                {adAccounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.name} ({a.currency})</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Kampanjenavn" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} sx={fieldSx} />
              <Stack direction="row" spacing={1}>
                <TextField select size="small" label="Mål" value={form.objective}
                  onChange={(e) => setForm({ ...form, objective: e.target.value })} sx={{ ...fieldSx, flex: 1 }}>
                  {OBJECTIVES.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
                <TextField size="small" type="number" label="Dagsbudsjett NOK" value={form.dailyBudgetNok}
                  onChange={(e) => setForm({ ...form, dailyBudgetNok: e.target.value })} sx={{ ...fieldSx, maxWidth: 150 }} />
              </Stack>
              <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>
                Kampanjen opprettes som <strong>pauset</strong> — start den når den er klar.
              </Typography>
              <Button variant="contained" size="small" disabled={creating || !form.adAccountId || !form.name.trim()}
                onClick={submitCreate} sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}>
                {creating ? 'Oppretter…' : 'Opprett kampanje'}
              </Button>
            </>
          )}
        </Stack>
      </Collapse>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
          <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
          <Typography sx={SUBTLE}>Henter kampanjer …</Typography>
        </Stack>
      ) : campaigns.length === 0 ? (
        <Typography sx={SUBTLE}>Ingen kampanjer ennå. Opprett én med «Ny kampanje».</Typography>
      ) : (
        <Stack spacing={0.75}>
          {campaigns.map((c) => {
            const sm = STATUS_META[c.status];
            const busy = busyId === c.id;
            return (
              <Stack
                key={c.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.16)' }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                    {c.goal || c.externalCampaignId || c.id}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem' }} noWrap>
                    {c.platform} · dagsbudsjett {nok(c.dailyBudgetNok)}
                  </Typography>
                </Box>
                <Chip size="small" label={sm.label} sx={{ fontWeight: 700, color: sm.color, bgcolor: sm.bg, border: `1px solid ${sm.color}55` }} />
                {busy ? (
                  <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
                ) : c.platform !== 'meta' ? (
                  // Google/LinkedIn er foreløpig kun rapportering — ingen styring ennå.
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem' }}>
                    Kun rapportering
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={0.5}>
                    {c.status === 'active' && (
                      <Button size="small" startIcon={<PauseIcon sx={{ fontSize: 16 }} />}
                        onClick={() => act(c.id, () => roleRoomAgentService.pauseAdsCampaign(c.id))}
                        sx={{ textTransform: 'none', color: '#fcd34d', minWidth: 0 }}>Pause</Button>
                    )}
                    {(c.status === 'paused' || c.status === 'draft') && (
                      <Button size="small" startIcon={<PlayIcon sx={{ fontSize: 16 }} />}
                        onClick={() => act(c.id, () => roleRoomAgentService.resumeAdsCampaign(c.id))}
                        sx={{ textTransform: 'none', color: '#86efac', minWidth: 0 }}>Start</Button>
                    )}
                    {c.status !== 'ended' && (
                      <Button size="small" startIcon={<StopIcon sx={{ fontSize: 16 }} />}
                        onClick={() => { if (window.confirm('Avslutte kampanjen permanent?')) void act(c.id, () => roleRoomAgentService.endAdsCampaign(c.id)); }}
                        sx={{ textTransform: 'none', color: '#fca5a5', minWidth: 0 }}>Avslutt</Button>
                    )}
                  </Stack>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

const fieldSx = {
  '& .MuiInputBase-input': { color: '#e2e8f0' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.6)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
  '& .MuiSvgIcon-root': { color: 'rgba(226,232,240,0.6)' },
} as const;
