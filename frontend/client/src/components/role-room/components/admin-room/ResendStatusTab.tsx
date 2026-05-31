/**
 * ResendStatusTab — Admin Room-dashboard for Resend transactional email.
 * Viser konto-status, domeneverifisering, brukstall mot 3000/mnd-grensen,
 * og siste 50 sendinger fra transactional_email_log.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import authSessionService from '../../services/authSessionService';

interface StatusResponse {
  primaryProvider: 'resend' | 'smtp' | null;
  providers: {
    resend: {
      configured: boolean;
      apiKeyMasked: string | null;
      domains: Array<{ id: string; name: string; status: string; region: string | null }>;
      domainsOk: boolean;
      domainsError: string | null;
      fromEmail: string;
    };
    gmail: {
      configured: boolean;
      user: string | null;
    };
  };
  freeTier: { monthly: number; daily: number };
}

interface UsageResponse {
  monthly: { sent: number; failed: number; limit: number; usagePct: number; remaining: number };
  daily: { sent: number; failed: number; limit: number; usagePct: number; remaining: number };
  breakdownByProvider: { resend: number; smtp: number };
}

interface RecentItem {
  id: string;
  provider: string;
  status: string;
  messageId: string | null;
  toEmail: string;
  subject: string | null;
  kind: string | null;
  projectId: string | null;
  sentByUserId: string | null;
  errorReason: string | null;
  errorMessage: string | null;
  sentAt: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: authSessionService.getAuthHeadersSync() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.success) throw new Error(payload?.error || 'API-feil');
  return payload as T;
}

function formatNok(value: number): string {
  return value.toLocaleString('nb-NO');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusChip(value: string, error?: string | null) {
  if (value === 'sent') {
    return <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="sendt" />;
  }
  return (
    <Chip
      size="small"
      color="error"
      icon={<ErrorOutlineIcon />}
      label={error || 'feilet'}
      sx={{ maxWidth: 220 }}
    />
  );
}

function domainStatusChip(status: string) {
  if (status === 'verified') return <Chip size="small" color="success" label="verifisert" />;
  if (status === 'pending') return <Chip size="small" color="warning" label="venter på DNS" />;
  if (status === 'not_started') return <Chip size="small" color="default" label="DNS ikke satt" />;
  return <Chip size="small" color="error" label={status} />;
}

export function ResendStatusTab() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, u, r] = await Promise.all([
        fetchJson<{ success: boolean } & StatusResponse>('/api/admin/resend/status'),
        fetchJson<{ success: boolean } & UsageResponse>('/api/admin/resend/usage'),
        fetchJson<{ success: boolean; items: RecentItem[] }>('/api/admin/resend/recent?limit=50'),
      ]);
      setStatus(s);
      setUsage(u);
      setRecent(r.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !status) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Stack spacing={2}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Prøv igjen</Button>}>{error}</Alert>
      </Stack>
    );
  }

  if (!status || !usage) return null;

  const resend = status.providers.resend;
  const gmail = status.providers.gmail;
  const monthlyColor = usage.monthly.usagePct >= 90 ? 'error' : usage.monthly.usagePct >= 70 ? 'warning' : 'primary';
  const dailyColor = usage.daily.usagePct >= 90 ? 'error' : usage.daily.usagePct >= 70 ? 'warning' : 'primary';

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Resend transactional email
        </Typography>
        <Button startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading} size="small">
          Oppdater
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">Primær leverandør</Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Chip
              label={status.primaryProvider ?? 'ikke konfigurert'}
              color={status.primaryProvider === 'resend' ? 'success' : status.primaryProvider === 'smtp' ? 'warning' : 'error'}
              size="small"
            />
            {resend.configured && <Chip label={`API-key ${resend.apiKeyMasked}`} size="small" variant="outlined" />}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Fra-adresse: <code>{resend.fromEmail}</code>
          </Typography>
          {gmail.configured && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Gmail-fallback: <code>{gmail.user}</code>
            </Typography>
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">Denne måneden</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {formatNok(usage.monthly.sent)} / {formatNok(usage.monthly.limit)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={usage.monthly.usagePct}
            color={monthlyColor}
            sx={{ height: 8, borderRadius: 4, mt: 1 }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.6 }}>
            <Typography variant="caption" color="text.secondary">
              {usage.monthly.usagePct}% brukt
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatNok(usage.monthly.remaining)} igjen
            </Typography>
          </Stack>
          {usage.monthly.failed > 0 && (
            <Chip label={`${usage.monthly.failed} feilet`} size="small" color="error" sx={{ mt: 1 }} />
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">I dag</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {usage.daily.sent} / {usage.daily.limit}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={usage.daily.usagePct}
            color={dailyColor}
            sx={{ height: 8, borderRadius: 4, mt: 1 }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.6 }}>
            <Typography variant="caption" color="text.secondary">
              {usage.daily.usagePct}% brukt
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {usage.daily.remaining} igjen
            </Typography>
          </Stack>
          {usage.daily.failed > 0 && (
            <Chip label={`${usage.daily.failed} feilet`} size="small" color="error" sx={{ mt: 1 }} />
          )}
        </Paper>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Domener</Typography>
        {resend.configured && resend.domains.length === 0 && (
          <Alert severity="warning">
            Ingen domener verifisert i Resend ennå. Legg til <code>theroleroom.com</code> i Resend-dashboard og verifiser DKIM/SPF.
          </Alert>
        )}
        {!resend.configured && (
          <Alert severity="info">
            Resend ikke konfigurert. Sett env-var <code>ROLE_ROOM_RESEND_API_KEY</code> på Render. Gmail-SMTP brukes som fallback.
          </Alert>
        )}
        {resend.domainsError && (
          <Alert severity="error" sx={{ mt: 1 }}>Klarte ikke hente domener fra Resend: {resend.domainsError}</Alert>
        )}
        {resend.domains.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Domene</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Region</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resend.domains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><code>{d.name}</code></TableCell>
                    <TableCell>{domainStatusChip(d.status)}</TableCell>
                    <TableCell>{d.region ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Siste sendinger</Typography>
          <Typography variant="caption" color="text.secondary">
            Resend: {usage.breakdownByProvider.resend} · SMTP: {usage.breakdownByProvider.smtp}
          </Typography>
        </Stack>
        {recent.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Ingen sendinger registrert ennå.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tidspunkt</TableCell>
                  <TableCell>Mottaker</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Leverandør</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recent.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.sentAt)}</TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Typography variant="body2">{item.toEmail}</Typography>
                      {item.subject && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {item.subject}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.kind && <Chip size="small" label={item.kind} variant="outlined" />}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={item.provider} variant="outlined" />
                    </TableCell>
                    <TableCell>{statusChip(item.status, item.errorReason)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
}

export default ResendStatusTab;
