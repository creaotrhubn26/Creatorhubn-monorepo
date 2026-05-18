// @ts-nocheck
/**
 * AssistantRolodexPage — Slice 9X.47
 *
 * Stine ser alle assistenter hun tidligere har samarbeidet med (på tvers av
 * bryllup), med reliability-score, sist-samarbeid-dato, sum-oppdrag og
 * quick-invite-knapp som re-inviterer til et nytt bryllup med forhåndsutfylte
 * verdier fra siste samarbeid.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  Box,
  Button,
  Chip,
  Avatar,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  PeopleAlt as TeamIcon,
  Search as SearchIcon,
  PersonAdd as InviteIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Cancel as DeclinedIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface RolodexEntry {
  contactKey: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  internalUserId: string | null;
  totalJobs: number;
  confirmedJobs: number;
  declinedJobs: number;
  lastRole: string;
  lastCompensationType: string;
  lastCompensationValue: number | null;
  lastSharePct: number | null;
  lastCollaborationAt: string | null;
  reliabilityScore: number | null;
}

interface WeddingOption {
  id: string;
  coupleName: string | null;
  weddingDate: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  primary: 'Hovedfotograf',
  assistant: 'Assistent',
  second_shooter: 'Second shooter',
  video: 'Video',
  misc: 'Annet',
};

const COMP_LABELS: Record<string, string> = {
  hourly: 'Pr. time',
  fixed: 'Fast sum',
  percentage: 'Prosent',
};

const initials = (e: RolodexEntry): string => {
  const src = (e.name || e.email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

const reliabilityColor = (score: number | null): 'success' | 'warning' | 'error' | 'default' => {
  if (score === null) return 'default';
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
};

const AssistantRolodexPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [list, setList] = useState<RolodexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [reInviteFor, setReInviteFor] = useState<RolodexEntry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await apiRequest('/api/photographer/assistants/history');
      setList(r.assistants || []);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste historikk');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.phone || '').toLowerCase().includes(q),
    );
  }, [list, filter]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/photographer-dashboard-material')} size="small">
          <BackIcon />
        </IconButton>
        <TeamIcon color="primary" />
        <Typography variant="h5">Assistent-rolodex</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Alle assistent-fotografer du har samarbeidet med tidligere. Klikk «Re-inviter» for å hente en til et nytt bryllup med ferdig-utfylt rolle og kompensasjon.
      </Typography>

      <TextField
        size="small"
        fullWidth
        placeholder="Søk på navn, e-post eller telefon"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ mb: 2 }}
      />

      {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <Alert severity="info">
          {filter.trim() ? 'Ingen treff på søket.' : 'Du har ikke samarbeidet med noen assistenter ennå. Inviter første via "Assistenter"-panelet på et bryllup.'}
        </Alert>
      )}

      <Stack spacing={1.5}>
        {filtered.map((e) => (
          <Card key={e.contactKey} variant="outlined">
            <CardContent sx={{ pb: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>{initials(e)}</Avatar>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1"><b>{e.name || e.email || 'Uten navn'}</b></Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {e.email}{e.phone ? ` · ${e.phone}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={`${e.confirmedJobs}/${e.totalJobs} jobber`}
                      icon={<CheckIcon fontSize="small" />}
                    />
                    {e.declinedJobs > 0 && (
                      <Chip size="small" color="default" icon={<DeclinedIcon fontSize="small" />} label={`${e.declinedJobs} avslag`} variant="outlined" />
                    )}
                    {e.reliabilityScore !== null && (
                      <Tooltip title="Andel inviterte oppdrag som ble akseptert">
                        <Chip
                          size="small"
                          color={reliabilityColor(e.reliabilityScore)}
                          label={`${e.reliabilityScore}% pålitelighet`}
                        />
                      </Tooltip>
                    )}
                    <Chip size="small" variant="outlined" label={`Sist: ${ROLE_LABELS[e.lastRole] || e.lastRole}`} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {e.lastCollaborationAt && `Siste samarbeid: ${new Date(e.lastCollaborationAt).toLocaleDateString('nb-NO')} · `}
                    {COMP_LABELS[e.lastCompensationType] || e.lastCompensationType}
                    {e.lastCompensationType === 'percentage'
                      ? `: ${e.lastSharePct ?? '?'}%`
                      : `: ${e.lastCompensationValue ?? '?'} kr${e.lastCompensationType === 'hourly' ? '/t' : ''}`}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={<InviteIcon />}
                  onClick={() => setReInviteFor(e)}
                  disabled={!e.email}
                >
                  Re-inviter
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <ReInviteDialog
        entry={reInviteFor}
        onClose={() => setReInviteFor(null)}
        onInvited={() => { setReInviteFor(null); }}
      />
    </Container>
  );
};

/* ─── Re-invite-dialog ──────────────────────────────────────────── */

interface ReInviteDialogProps {
  entry: RolodexEntry | null;
  onClose: () => void;
  onInvited: () => void;
}

const ReInviteDialog: React.FC<ReInviteDialogProps> = ({ entry, onClose, onInvited }) => {
  const [weddings, setWeddings] = useState<WeddingOption[]>([]);
  const [weddingId, setWeddingId] = useState('');
  const [role, setRole] = useState('assistant');
  const [compType, setCompType] = useState<'hourly' | 'fixed' | 'percentage'>('fixed');
  const [compValue, setCompValue] = useState('');
  const [sharePct, setSharePct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setError(null); setInviteUrl(null);
    setRole(entry.lastRole || 'assistant');
    setCompType((entry.lastCompensationType as any) || 'fixed');
    setCompValue(entry.lastCompensationValue != null ? String(entry.lastCompensationValue) : '');
    setSharePct(entry.lastSharePct != null ? String(entry.lastSharePct) : '');
    setWeddingId('');
    apiRequest('/api/photographer/weddings/upcoming')
      .then((r: any) => setWeddings(r.weddings || []))
      .catch(() => setWeddings([]));
  }, [entry]);

  if (!entry) return null;

  const handleSubmit = async () => {
    if (!weddingId) { setError('Velg bryllup'); return; }
    if (!entry.email) { setError('Mangler e-post'); return; }
    setBusy(true); setError(null);
    try {
      const r: any = await apiRequest('/api/photographer/assistants/quick-invite', {
        method: 'POST',
        body: {
          weddingId,
          fromEmail: entry.email,
          role,
          compensationType: compType,
          compensationValue: compType !== 'percentage' && compValue ? parseFloat(compValue) : undefined,
          sharePct: compType === 'percentage' && sharePct ? parseFloat(sharePct) : undefined,
        },
      });
      const url = r.inviteUrl ? `${window.location.origin}${r.inviteUrl}` : null;
      setInviteUrl(url);
      if (!url) onInvited();
    } catch (e: any) {
      setError(e?.message || 'Re-invite feilet');
    } finally { setBusy(false); }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* ignore */ }
    onInvited();
  };

  return (
    <Dialog open={!!entry} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Re-inviter {entry.name || entry.email}</DialogTitle>
      <DialogContent dividers>
        {!inviteUrl ? (
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary">
              Vilkår er pre-fylt fra siste samarbeid — juster om nødvendig.
            </Typography>
            <TextField
              select
              size="small"
              label="Bryllup"
              value={weddingId}
              onChange={(e) => setWeddingId(e.target.value)}
              fullWidth
              required
              helperText={weddings.length === 0 ? 'Ingen kommende bryllup funnet' : undefined}
            >
              {weddings.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.coupleName || 'Uten navn'}{w.weddingDate ? ` · ${new Date(w.weddingDate).toLocaleDateString('nb-NO')}` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select size="small" label="Rolle" value={role} onChange={(e) => setRole(e.target.value)} fullWidth
            >
              {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'primary').map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </TextField>
            <TextField
              select size="small" label="Kompensasjon" value={compType} onChange={(e) => setCompType(e.target.value as any)} fullWidth
            >
              {Object.entries(COMP_LABELS).map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </TextField>
            {compType === 'percentage' ? (
              <TextField size="small" label="% av netto" type="number" value={sharePct} onChange={(e) => setSharePct(e.target.value)} fullWidth InputProps={{ endAdornment: '%' }} />
            ) : (
              <TextField size="small" label={compType === 'hourly' ? 'Timesats (kr)' : 'Fast sum (kr)'} type="number" value={compValue} onChange={(e) => setCompValue(e.target.value)} fullWidth />
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="success">Invitasjon opprettet! Send lenken:</Alert>
            <TextField fullWidth size="small" value={inviteUrl} InputProps={{ readOnly: true }} />
            <Button startIcon={<CopyIcon />} variant="contained" onClick={handleCopy}>Kopier lenke</Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{inviteUrl ? 'Ferdig' : 'Avbryt'}</Button>
        {!inviteUrl && (
          <Button variant="contained" onClick={handleSubmit} disabled={busy || !weddingId}>
            {busy ? 'Sender…' : 'Send invitasjon'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AssistantRolodexPage;
