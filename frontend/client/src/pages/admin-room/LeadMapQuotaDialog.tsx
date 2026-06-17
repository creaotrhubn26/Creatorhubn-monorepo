/**
 * LeadMapQuotaDialog.tsx
 *
 * Admin/Salgssjef/Teamleder kan sette månedlig kvote for hver
 * salgskonsulent. Bruker selv kan også sette egen.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Select, Stack, TextField,
  Typography,
} from '@mui/material';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import CloseIcon from '@mui/icons-material/Close';

interface MemberRow {
  userId: string;
  role: string;
  displayName: string | null;
  userEmail: string | null;
  avatarUrl: string | null;
  title: string | null;
  quotaMonthlyNok: string | null;
}

interface Props {
  open: boolean;
  organizationId: string | null;
  /** Hvis satt: dialogen viser kun denne brukeren — for "min kvote" */
  onlyUserId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

function thisYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function LeadMapQuotaDialog({ open, organizationId, onlyUserId, onClose, onSaved }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [yearMonth, setYearMonth] = useState<string>(thisYearMonth());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo<HeadersInit>(
    () => ({ Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' }),
    [],
  );

  const load = useCallback(async () => {
    if (!organizationId || !open) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${organizationId}/profiles`,
        { headers },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const all: MemberRow[] = (j.profiles ?? []).map((p: Record<string, unknown>) => ({
        userId: p.user_id as string,
        role: p.role as string,
        displayName: (p.display_name as string | null) ?? null,
        userEmail: (p.user_email as string | null) ?? null,
        avatarUrl: (p.avatar_url as string | null) ?? null,
        title: (p.title as string | null) ?? null,
        quotaMonthlyNok: (p.quota_monthly_nok as string | null) ?? null,
      }));
      // Filtrer til salgskonsulent/teamleder/salgssjef/promotor
      const filtered = all.filter((m) =>
        ['salgskonsulent', 'teamleder', 'salgssjef', 'promotor'].includes(m.role)
      );
      const scoped = onlyUserId
        ? filtered.filter((m) => m.userId === onlyUserId)
        : filtered;
      setMembers(scoped);
      // Init targets fra eksisterende quota_monthly_nok
      const initTargets: Record<string, string> = {};
      for (const m of scoped) {
        initTargets[m.userId] = m.quotaMonthlyNok ?? '';
      }
      setTargets(initTargets);
    } catch (err) {
      setError(`Lasting feilet: ${String(err)}`);
    } finally { setLoading(false); }
  }, [organizationId, headers, open, onlyUserId]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (userId: string) => {
    if (!organizationId) return;
    setSaving(userId); setError(null);
    try {
      const raw = targets[userId];
      const target_nok = raw ? Number(raw) : 0;
      if (Number.isNaN(target_nok) || target_nok < 0) {
        throw new Error('Ugyldig kvote');
      }
      const r = await fetch('/api/admin-room/lead-map/me/quota', {
        method: 'POST', headers,
        body: JSON.stringify({
          organization_id: organizationId,
          target_user_id: userId,
          target_nok,
          year_month: yearMonth,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      onSaved?.();
    } catch (err) {
      setError(`Lagring feilet: ${String(err)}`);
    } finally { setSaving(null); }
  }, [organizationId, headers, targets, yearMonth, onSaved]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EmojiEventsOutlinedIcon sx={{ color: '#f97316' }} />
          <Typography variant="h6">
            {onlyUserId ? 'Min månedlige kvote' : 'Sett månedlig kvote per selger'}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>
          <Select
            size="small"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            inputProps={{ 'aria-label': 'Måned' }}
          >
            {monthOptions().map((m) => (
              <MenuItem key={m} value={m}>{labelForMonth(m)}</MenuItem>
            ))}
          </Select>

          {loading && <Typography color="text.secondary">Henter…</Typography>}
          {!loading && members.length === 0 && (
            <Alert severity="info">Ingen salgskonsulenter i org-en enda.</Alert>
          )}

          {members.map((m) => (
            <Stack key={m.userId} direction="row" alignItems="center" spacing={1.5}>
              <Avatar src={m.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                {(m.displayName ?? m.userEmail ?? '?')[0]}
              </Avatar>
              <Stack flexGrow={1}>
                <Typography variant="body2">
                  {m.displayName ?? m.userEmail}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.title ?? roleLabel(m.role)}
                </Typography>
              </Stack>
              <TextField
                size="small"
                type="number"
                value={targets[m.userId] ?? ''}
                onChange={(e) => setTargets({ ...targets, [m.userId]: e.target.value })}
                placeholder="0"
                InputProps={{
                  endAdornment: <Typography variant="caption" color="text.secondary">kr</Typography>,
                }}
                sx={{ width: 140 }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={saving === m.userId}
                onClick={() => save(m.userId)}
              >
                {saving === m.userId ? 'Lagrer…' : 'Lagre'}
              </Button>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case 'salgssjef': return 'Salgssjef';
    case 'teamleder': return 'Teamleder';
    case 'salgskonsulent': return 'Salgskonsulent';
    case 'promotor': return 'Promotør';
    default: return role;
  }
}

function monthOptions(): string[] {
  const out: string[] = [];
  const d = new Date();
  // Inneværende + 6 fremover + 3 bakover
  for (let i = -3; i <= 6; i++) {
    const m = new Date(d.getUTCFullYear(), d.getUTCMonth() + i, 1);
    out.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function labelForMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long' });
}
