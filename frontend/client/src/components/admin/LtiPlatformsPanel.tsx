/**
 * LtiPlatformsPanel.tsx — super-admin: registrer LMS-plattformer for LTI 1.3.
 *
 * Viser vår tool-config (det du limer inn i Canvas/saLTIre) + skjema for å
 * registrere en plattform (Canvas-instans / saLTIre) hos oss. Kaller
 * /api/role-room/lti/{config,platforms} via apiFetch (admin-Bearer → super-
 * admin-gated backend).
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Stack, Chip,
  IconButton, Alert, Divider, CircularProgress, Tooltip,
} from '@mui/material';
import {
  Hub as LtiIcon, ContentCopy as CopyIcon, Check as CheckIcon,
  Add as AddIcon, OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { apiFetch } from '@/lib/queryClient';

interface ToolConfig {
  title: string;
  oidc_initiation_url: string;
  target_link_uri: string;
  public_jwk_url: string;
  scopes: string[];
}
interface Platform {
  id: string; name: string | null; issuer: string; client_id: string; created_at: string;
  status?: string; product_family?: string; registered_via?: string;
}

const EMPTY_FORM = { name: '', issuer: '', client_id: '', deployment_id: '', auth_login_url: '', token_url: '', jwks_url: '' };

export default function LtiPlatformsPanel() {
  const [config, setConfig] = useState<ToolConfig | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cfgRes, platRes] = await Promise.all([
        apiFetch('/api/role-room/lti/config'),
        apiFetch('/api/role-room/lti/platforms'),
      ]);
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (platRes.ok) { const d = await platRes.json(); setPlatforms(d.platforms ?? []); }
      else if (platRes.status === 403) setError('Krever super-admin (daniel@creatorhubn.com).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste LTI-konfig');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch { /* no-op */ }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const approvePlatform = async (id: string) => {
    await apiFetch(`/api/role-room/lti/platforms/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    await load();
  };
  const rejectPlatform = async (id: string) => {
    await apiFetch(`/api/role-room/lti/platforms/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const register = async () => {
    if (busy) return;
    for (const req of ['issuer', 'client_id', 'auth_login_url', 'token_url', 'jwks_url'] as const) {
      if (!form[req].trim()) { setError(`Mangler felt: ${req}`); return; }
    }
    setBusy(true); setError(null);
    try {
      const res = await apiFetch('/api/role-room/lti/platforms', { method: 'POST', body: form });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error || `HTTP ${res.status}`); return; }
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke registrere');
    } finally {
      setBusy(false);
    }
  };

  const ConfigRow = ({ label, value, k }: { label: string; value: string; k: string }) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ py: 0.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</Typography>
      </Box>
      <Tooltip title={copied === k ? 'Kopiert' : 'Kopier'}>
        <IconButton size="small" onClick={() => copy(k, value)}>{copied === k ? <CheckIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}</IconButton>
      </Tooltip>
    </Stack>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <LtiIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>LTI 1.3 — LMS-plattformer</Typography>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Tool-config: det du limer inn i Canvas/saLTIre */}
      {config && (
        <Card variant="outlined">
          <CardContent>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Vår tool-konfigurasjon</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.5 }}>
              Lim disse inn når du registrerer The Role Room som eksternt verktøy i Canvas / saLTIre.
            </Typography>
            <ConfigRow label="OIDC login-initiering (Redirect Login URL)" value={config.oidc_initiation_url} k="oidc" />
            <ConfigRow label="Target link URI (Launch URL)" value={config.target_link_uri} k="target" />
            <ConfigRow label="Public JWKS URL" value={config.public_jwk_url} k="jwks" />
            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>AGS-scopes (grade-passback)</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {config.scopes.map((s) => <Chip key={s} size="small" label={s.split('/').pop()} sx={{ fontSize: 10 }} />)}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Registration — Moodle/Canvas-admin limer denne inn */}
      <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Selvbetjent registrering (Moodle / Canvas)</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          LMS-admin limer denne URL-en inn i «External tool → LTI Advantage → Dynamic registration».
          Plattformen dukker opp som «Venter godkjenning» under.
        </Typography>
        <TextField size="small" fullWidth value={`${window.location.origin}/api/role-room/lti/register`} InputProps={{ readOnly: true }} />
      </Box>

      {/* Registrer plattform */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'grid', gap: 1.5 }}>
          <Typography sx={{ fontWeight: 700 }}>Registrer plattform (Canvas / saLTIre)</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Hentes fra LMS-en etter at du har registrert oss der (issuer/client_id + endepunkt-URLer).
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField label="Navn (valgfritt)" size="small" fullWidth value={form.name} onChange={set('name')} placeholder="Canvas – Filmskolen (test)" />
            <TextField label="Deployment ID (valgfritt)" size="small" fullWidth value={form.deployment_id} onChange={set('deployment_id')} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField label="Issuer *" size="small" fullWidth value={form.issuer} onChange={set('issuer')} placeholder="https://canvas.instructure.com" />
            <TextField label="Client ID *" size="small" fullWidth value={form.client_id} onChange={set('client_id')} />
          </Stack>
          <TextField label="Auth login URL *" size="small" fullWidth value={form.auth_login_url} onChange={set('auth_login_url')} placeholder="https://…/api/lti/authorize_redirect" />
          <TextField label="Token URL * (OAuth2 for AGS)" size="small" fullWidth value={form.token_url} onChange={set('token_url')} placeholder="https://…/login/oauth2/token" />
          <TextField label="JWKS URL *" size="small" fullWidth value={form.jwks_url} onChange={set('jwks_url')} placeholder="https://…/api/lti/security/jwks" />
          <Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={register} disabled={busy}>
              {busy ? 'Registrerer…' : 'Registrer plattform'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Registrerte plattformer */}
      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Registrerte plattformer ({platforms.length})</Typography>
          {platforms.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', fontSize: 13.5 }}>Ingen enda. Registrer Canvas-testinstansen eller saLTIre over.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {platforms.map((p) => (
                <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{p.name || p.issuer}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>{p.issuer} · {p.client_id}</Typography>
                  </Box>
                  <Box>
                    <Chip size="small" label={p.status === 'approved' ? 'Godkjent' : 'Venter godkjenning'}
                      color={p.status === 'approved' ? 'success' : 'warning'} variant="outlined" sx={{ mr: 1 }} />
                    {p.product_family && <Chip size="small" label={p.product_family} variant="outlined" sx={{ mr: 1 }} />}
                    {p.status !== 'approved' && (
                      <Button size="small" variant="contained" onClick={() => approvePlatform(p.id)} sx={{ mr: 1 }}>Godkjenn</Button>
                    )}
                    <Button size="small" color="error" onClick={() => rejectPlatform(p.id)}>Fjern</Button>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Alert severity="info" icon={<OpenIcon />}>
        Rask validering uten Canvas: bruk <b>saLTIre</b> (saltire.lti.app) — en gratis LTI 1.3-referanseplattform. Registrer tool-konfigen over der, og legg saLTIres issuer/client_id/URLer inn her.
      </Alert>
    </Box>
  );
}
