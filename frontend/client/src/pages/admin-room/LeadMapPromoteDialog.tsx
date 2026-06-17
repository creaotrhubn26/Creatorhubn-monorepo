/**
 * LeadMapPromoteDialog.tsx
 *
 * Forfremmelses-wizard. 3 steg:
 *   1. Velg ny rolle → vis permission-diff
 *   2. Tittel + team-overgang
 *   3. Kvote + bekreft + grunn (audit-log)
 *
 * Bruker /promotion-preview-endepunktet for å beregne diff og
 * lese rolle-mal-forslag før POST /promote committer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, MenuItem, Select, Stack, Step,
  StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';

interface Props {
  open: boolean;
  organizationId: string | null;
  member: {
    user_id: string;
    role: string;
    user_email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    title?: string | null;
    sales_team_id?: string | null;
  } | null;
  teams: Array<{ id: string; name: string }>;
  onClose: () => void;
  onPromoted?: () => void;
}

interface PreviewResponse {
  from_role: string;
  to_role: string;
  change_type: 'promotion' | 'demotion' | 'lateral';
  permissions_gained: Array<{ key: string; category: string; description: string }>;
  permissions_lost: Array<{ key: string; category: string; description: string }>;
  suggestion: { title?: string; quota_nok?: number };
}

const ROLE_OPTIONS = [
  { key: 'salgssjef', label: 'Salgssjef', color: '#f97316', description: 'Leder hele salgsorganisasjonen' },
  { key: 'teamleder', label: 'Teamleder', color: '#fbbf24', description: 'Leder ett salgs-team' },
  { key: 'salgskonsulent', label: 'Salgskonsulent', color: '#34d399', description: 'Selger leads i ditt team' },
  { key: 'promotor', label: 'Promotør', color: '#60a5fa', description: 'Promoterer på event/feltarbeid' },
  { key: 'member', label: 'Medlem', color: '#a78bfa', description: 'Standard skrive-tilgang' },
  { key: 'viewer', label: 'Leser', color: '#9ca3af', description: 'Kun lese-tilgang' },
];

const STEPS = ['Velg ny rolle', 'Tittel & team', 'Kvote & bekreft'];

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

export default function LeadMapPromoteDialog({
  open, organizationId, member, teams, onClose, onPromoted,
}: Props) {
  const [step, setStep] = useState(0);
  const [toRole, setToRole] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [teamTransition, setTeamTransition] = useState<'kept' | 'left' | 'reassigned'>('kept');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newQuota, setNewQuota] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo<HeadersInit>(
    () => ({ Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' }),
    [],
  );

  // Reset state ved hver opening
  useEffect(() => {
    if (open) {
      setStep(0);
      setToRole('');
      setPreview(null);
      setNewTitle('');
      setTeamTransition('kept');
      setNewTeamId('');
      setNewQuota('');
      setReason('');
      setError(null);
    }
  }, [open]);

  // Hent preview når rolle velges
  useEffect(() => {
    if (!toRole || !organizationId || !member) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    (async () => {
      try {
        const r = await fetch(
          `/api/admin-room/lead-map/organizations/${organizationId}/members/${member.user_id}/promotion-preview?to_role=${toRole}`,
          { headers },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setPreview(j);
        // Pre-fyll forslag
        setNewTitle(j.suggestion?.title ?? member.title ?? '');
        if (j.suggestion?.quota_nok) {
          setNewQuota(String(j.suggestion.quota_nok));
        }
      } catch (err) {
        setError(`Preview feilet: ${String(err)}`);
      } finally { setLoadingPreview(false); }
    })();
  }, [toRole, organizationId, member, headers]);

  const submit = useCallback(async () => {
    if (!organizationId || !member || !toRole) return;
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        to_role: toRole,
        team_transition: teamTransition,
      };
      if (newTitle.trim()) body.new_title = newTitle.trim();
      if (teamTransition === 'reassigned') body.new_sales_team_id = newTeamId;
      if (newQuota) body.new_quota_nok = Number(newQuota);
      if (reason.trim()) body.reason = reason.trim();

      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${organizationId}/members/${member.user_id}/promote`,
        { method: 'POST', headers, body: JSON.stringify(body) },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      onPromoted?.();
      onClose();
    } catch (err) {
      setError(`Lagring feilet: ${String(err)}`);
    } finally { setSaving(false); }
  }, [organizationId, member, toRole, teamTransition, newTitle, newQuota, newTeamId, reason, headers, onPromoted, onClose]);

  if (!member) return null;
  const targetMeta = ROLE_OPTIONS.find((r) => r.key === toRole);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar src={member.avatar_url ?? undefined}>
            {(member.display_name ?? member.user_email ?? '?')[0]}
          </Avatar>
          <Box>
            <Typography variant="h6">
              Endre rolle for {member.display_name ?? member.user_email}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Bruker beholder alle leads + historikk + audit-log automatisk
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

        {step === 0 && (
          <Step0
            currentRole={member.role}
            toRole={toRole}
            setToRole={setToRole}
            preview={preview}
            loadingPreview={loadingPreview}
          />
        )}
        {step === 1 && preview && (
          <Step1
            currentTitle={member.title ?? ''}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            currentTeamId={member.sales_team_id ?? null}
            teamTransition={teamTransition}
            setTeamTransition={setTeamTransition}
            newTeamId={newTeamId}
            setNewTeamId={setNewTeamId}
            teams={teams}
            suggestion={preview.suggestion}
          />
        )}
        {step === 2 && preview && (
          <Step2
            preview={preview}
            newTitle={newTitle}
            newQuota={newQuota}
            setNewQuota={setNewQuota}
            reason={reason}
            setReason={setReason}
            teamTransition={teamTransition}
            newTeamName={teams.find((t) => t.id === newTeamId)?.name ?? null}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Box flexGrow={1} />
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Tilbake</Button>}
        {step < 2 && (
          <Button
            variant="contained"
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? !toRole || !preview : false}
            sx={{ bgcolor: targetMeta?.color, '&:hover': { bgcolor: targetMeta?.color } }}
          >
            Neste
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="contained"
            onClick={submit}
            disabled={saving}
            startIcon={preview?.change_type === 'promotion' ? <ArrowUpwardOutlinedIcon /> : preview?.change_type === 'demotion' ? <ArrowDownwardOutlinedIcon /> : <SwapHorizOutlinedIcon />}
            sx={{ bgcolor: targetMeta?.color, '&:hover': { bgcolor: targetMeta?.color } }}
          >
            {saving ? 'Lagrer…' : preview?.change_type === 'promotion' ? 'Forfremmer' : preview?.change_type === 'demotion' ? 'Endre rolle' : 'Bytt rolle'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Step0({ currentRole, toRole, setToRole, preview, loadingPreview }: {
  currentRole: string;
  toRole: string;
  setToRole: (v: string) => void;
  preview: PreviewResponse | null;
  loadingPreview: boolean;
}) {
  const currentMeta = ROLE_OPTIONS.find((r) => r.key === currentRole);
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary">Nåværende rolle</Typography>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: currentMeta?.color ?? '#9ca3af' }} />
          <Typography variant="h6">{currentMeta?.label ?? currentRole}</Typography>
        </Stack>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">Ny rolle</Typography>
        <Select
          value={toRole}
          onChange={(e) => setToRole(e.target.value)}
          fullWidth
          displayEmpty
        >
          <MenuItem value="">Velg ny rolle…</MenuItem>
          {ROLE_OPTIONS.filter((r) => r.key !== currentRole).map((r) => (
            <MenuItem key={r.key} value={r.key}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color }} />
                <Stack>
                  <Typography variant="body2">{r.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.description}</Typography>
                </Stack>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </Box>

      {loadingPreview && <Typography color="text.secondary">Beregner permission-diff…</Typography>}

      {preview && <PermissionDiffPanel preview={preview} />}
    </Stack>
  );
}

function PermissionDiffPanel({ preview }: { preview: PreviewResponse }) {
  const Icon = preview.change_type === 'promotion'
    ? ArrowUpwardOutlinedIcon
    : preview.change_type === 'demotion'
      ? ArrowDownwardOutlinedIcon
      : SwapHorizOutlinedIcon;
  const color = preview.change_type === 'promotion'
    ? '#34d399'
    : preview.change_type === 'demotion'
      ? '#f87171'
      : '#9ca3af';
  const label = preview.change_type === 'promotion'
    ? 'Forfremmelse'
    : preview.change_type === 'demotion'
      ? 'Degradering'
      : 'Lateral overgang';

  // Gruppér per kategori for tydelig oversikt
  const gainedByCat: Record<string, string[]> = {};
  const lostByCat: Record<string, string[]> = {};
  for (const p of preview.permissions_gained) {
    if (!gainedByCat[p.category]) gainedByCat[p.category] = [];
    gainedByCat[p.category].push(p.description);
  }
  for (const p of preview.permissions_lost) {
    if (!lostByCat[p.category]) lostByCat[p.category] = [];
    lostByCat[p.category].push(p.description);
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Icon sx={{ color }} />
        <Chip label={label} size="small" sx={{ bgcolor: `${color}22`, color, fontWeight: 700 }} />
        <Chip label={`+${preview.permissions_gained.length} tillatelser`} size="small"
          sx={{ bgcolor: '#34d39922', color: '#34d399' }} />
        <Chip label={`−${preview.permissions_lost.length} tillatelser`} size="small"
          sx={{ bgcolor: '#f8717122', color: '#f87171' }} />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box flex={1}>
          <Typography variant="subtitle2" sx={{ color: '#34d399', mb: 1 }}>
            ✓ Får tilgang til
          </Typography>
          {Object.entries(gainedByCat).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{cat}</Typography>
              {items.map((d, i) => (
                <Stack key={i} direction="row" spacing={0.5} alignItems="center" sx={{ pl: 1 }}>
                  <CheckCircleOutlinedIcon sx={{ fontSize: 14, color: '#34d399' }} />
                  <Typography variant="caption">{d}</Typography>
                </Stack>
              ))}
            </Box>
          ))}
          {preview.permissions_gained.length === 0 && (
            <Typography variant="caption" color="text.secondary">Ingen nye tillatelser</Typography>
          )}
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box flex={1}>
          <Typography variant="subtitle2" sx={{ color: '#f87171', mb: 1 }}>
            ✗ Mister tilgang til
          </Typography>
          {Object.entries(lostByCat).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{cat}</Typography>
              {items.map((d, i) => (
                <Stack key={i} direction="row" spacing={0.5} alignItems="center" sx={{ pl: 1 }}>
                  <BlockOutlinedIcon sx={{ fontSize: 14, color: '#f87171' }} />
                  <Typography variant="caption">{d}</Typography>
                </Stack>
              ))}
            </Box>
          ))}
          {preview.permissions_lost.length === 0 && (
            <Typography variant="caption" color="text.secondary">Mister ingen tillatelser</Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function Step1({
  currentTitle, newTitle, setNewTitle,
  currentTeamId, teamTransition, setTeamTransition, newTeamId, setNewTeamId, teams,
  suggestion,
}: {
  currentTitle: string;
  newTitle: string;
  setNewTitle: (v: string) => void;
  currentTeamId: string | null;
  teamTransition: 'kept' | 'left' | 'reassigned';
  setTeamTransition: (v: 'kept' | 'left' | 'reassigned') => void;
  newTeamId: string;
  setNewTeamId: (v: string) => void;
  teams: Array<{ id: string; name: string }>;
  suggestion: PreviewResponse['suggestion'];
}) {
  const currentTeamName = teams.find((t) => t.id === currentTeamId)?.name ?? 'Ingen team';
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary">Stillingstittel</Typography>
        <TextField
          fullWidth
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={suggestion?.title ?? 'f.eks. Salgssjef Nord-Norge'}
          helperText={
            currentTitle && currentTitle !== newTitle
              ? `Var: ${currentTitle}`
              : suggestion?.title && newTitle !== suggestion.title
                ? `Forslag: ${suggestion.title}`
                : ''
          }
        />
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">Salgs-team</Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Nåværende: {currentTeamName}
        </Typography>
        <Select
          value={teamTransition}
          onChange={(e) => setTeamTransition(e.target.value as 'kept' | 'left' | 'reassigned')}
          fullWidth
          sx={{ mt: 1 }}
        >
          <MenuItem value="kept">Behold nåværende team ({currentTeamName})</MenuItem>
          <MenuItem value="left">Forlat teamet — uten team</MenuItem>
          <MenuItem value="reassigned" disabled={teams.length === 0}>
            Flytt til annet team…
          </MenuItem>
        </Select>
        {teamTransition === 'reassigned' && (
          <Select
            value={newTeamId}
            onChange={(e) => setNewTeamId(e.target.value)}
            fullWidth
            displayEmpty
            sx={{ mt: 1 }}
          >
            <MenuItem value="">Velg team…</MenuItem>
            {teams.filter((t) => t.id !== currentTeamId).map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        )}
      </Box>
    </Stack>
  );
}

function Step2({
  preview, newTitle, newQuota, setNewQuota, reason, setReason,
  teamTransition, newTeamName,
}: {
  preview: PreviewResponse;
  newTitle: string;
  newQuota: string;
  setNewQuota: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  teamTransition: 'kept' | 'left' | 'reassigned';
  newTeamName: string | null;
}) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary">Månedlig kvote</Typography>
        <TextField
          fullWidth
          type="number"
          value={newQuota}
          onChange={(e) => setNewQuota(e.target.value)}
          placeholder={preview.suggestion?.quota_nok ? String(preview.suggestion.quota_nok) : '0'}
          helperText={
            preview.suggestion?.quota_nok
              ? `Forslag fra rolle-mal: ${preview.suggestion.quota_nok.toLocaleString('nb-NO')} kr`
              : 'Inneværende måned. La være tom for å beholde nåværende.'
          }
          InputProps={{
            endAdornment: <Typography variant="caption" color="text.secondary">kr</Typography>,
          }}
        />
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">Grunn for endring (audit-log)</Typography>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="f.eks. 'Bevist høy ytelse Q1 — fortjent Salgssjef-rollen'"
        />
      </Box>

      <Alert severity="info" icon={false}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Sammendrag</Typography>
          <Typography variant="body2">
            Endrer {preview.from_role} → <strong>{preview.to_role}</strong>
          </Typography>
          {newTitle && <Typography variant="body2">Tittel: <strong>{newTitle}</strong></Typography>}
          <Typography variant="body2">
            Team: {teamTransition === 'kept' ? 'beholder' : teamTransition === 'left' ? 'forlater' : `flytter til ${newTeamName}`}
          </Typography>
          {newQuota && <Typography variant="body2">Kvote: <strong>{Number(newQuota).toLocaleString('nb-NO')} kr</strong></Typography>}
          <Typography variant="body2" color="text.secondary">
            +{preview.permissions_gained.length} / −{preview.permissions_lost.length} tillatelser
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ✓ Alle leads, won/lost-historikk, audit-log og per-bruker-permission-overstyringer beholdes
          </Typography>
        </Stack>
      </Alert>
    </Stack>
  );
}
