/**
 * LeadMapEntitlementsAdminPanel.tsx
 *
 * Admin-administrasjon av Lead Map module-entitlements.
 *
 * Liste over alle (aktive + revoked) entitlements med producer/config-info.
 * Grant nytt (3 tier, valgfrie notater). Revoke aktivt.
 *
 * Mountes som sub-seksjon i UserManagementPanel (AdminDashboard →
 * Brukere & Roller).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, ThemeProvider, Paper,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { TableVirtuoso } from 'react-virtuoso';
import type { TableHeadProps } from '@mui/material/TableHead';
import {
  Verified as VerifiedIcon,
  Block as RevokeIcon,
  AddCircleOutline as GrantIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface EntitlementRow {
  id: string;
  config_id: string;
  producer_user_id: string;
  tier: 'discover' | 'pro' | 'agency';
  status: 'trial' | 'active' | 'expired' | 'revoked';
  source: string;
  trial_ends_at: string | null;
  expires_at: string | null;
  granted_at: string;
  revoked_at: string | null;
  leads_per_month_limit: number | null;
  ai_pitches_per_month_limit: number | null;
  stripe_subscription_id: string | null;
  notes: string | null;
  producer_email: string | null;
  producer_first_name: string | null;
  producer_last_name: string | null;
  config_client_name: string | null;
}

const TIER_META = {
  discover: { label: 'Discover', color: '#60a5fa', priceNok: 299 },
  pro:      { label: 'Pro',      color: '#a78bfa', priceNok: 599 },
  agency:   { label: 'Agency',   color: '#fbbf24', priceNok: 1490 },
};

const STATUS_META = {
  active:  { label: 'Aktiv',   color: 'success' as const },
  trial:   { label: 'Trial',   color: 'info' as const },
  expired: { label: 'Utløpt',  color: 'warning' as const },
  revoked: { label: 'Revokert', color: 'error' as const },
};

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rr_bearer') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function LeadMapEntitlementsAdminPanel() {
  const [rows, setRows] = useState<EntitlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  // Grant dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({
    configId: '', producerUserId: '',
    tier: 'pro' as 'discover'|'pro'|'agency',
    notes: '',
  });
  const [granting, setGranting] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<EntitlementRow | null>(null);
  const [revokeNotes, setRevokeNotes] = useState('');
  const [revoking, setRevoking] = useState(false);

  const fetchEntitlements = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/admin/lead-map/entitlements', {
        credentials: 'include', headers: authHeaders(),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setRows(Array.isArray(body.entitlements) ? body.entitlements : []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntitlements(); }, [fetchEntitlements]);

  const handleGrant = async () => {
    setGranting(true);
    try {
      const r = await fetch('/api/admin/lead-map/entitlements/grant', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(grantForm),
      });
      const body = await r.json();
      if (!r.ok) {
        setSnackbar(`Feil: ${body.error || `HTTP ${r.status}`}`);
      } else {
        setSnackbar(`Entitlement grantet (${grantForm.tier})`);
        setGrantOpen(false);
        setGrantForm({ configId: '', producerUserId: '', tier: 'pro', notes: '' });
        await fetchEntitlements();
      }
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const r = await fetch(`/api/admin/lead-map/entitlements/${revokeTarget.id}/revoke`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ notes: revokeNotes }),
      });
      const body = await r.json();
      if (!r.ok) {
        setSnackbar(`Feil: ${body.error || `HTTP ${r.status}`}`);
      } else {
        setSnackbar('Entitlement revokert');
        setRevokeTarget(null);
        setRevokeNotes('');
        await fetchEntitlements();
      }
    } finally {
      setRevoking(false);
    }
  };

  const filteredRows = showRevoked ? rows : rows.filter((r) => !r.revoked_at);

  // Sammenfatning
  const totalActive = rows.filter((r) => r.status === 'active' && !r.revoked_at).length;
  const totalTrial = rows.filter((r) => r.status === 'trial' && !r.revoked_at).length;
  const monthlyRevenue = rows
    .filter((r) => r.status === 'active' && !r.revoked_at)
    .reduce((s, r) => s + (TIER_META[r.tier]?.priceNok ?? 0), 0);

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <VerifiedIcon sx={{ color: '#fbbf24' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Lead Map module-entitlements
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small" variant="outlined"
            onClick={() => setShowRevoked((s) => !s)}
          >
            {showRevoked ? 'Skjul revokerte' : 'Vis revokerte'}
          </Button>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchEntitlements}>
            Oppdater
          </Button>
          <Button
            size="small" variant="contained" startIcon={<GrantIcon />}
            onClick={() => setGrantOpen(true)}
            sx={{ bgcolor: '#fbbf24', color: '#0a0a0f', '&:hover': { bgcolor: '#f59e0b' } }}
          >
            Grant entitlement
          </Button>
        </Stack>
      </Stack>

      {/* KPI-kort */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Aktive</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#34d399' }}>{totalActive}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">I trial</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#60a5fa' }}>{totalTrial}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">MRR (NOK)</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fbbf24' }}>
              {monthlyRevenue.toLocaleString('nb-NO')}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredRows.length === 0 ? (
        <Alert severity="info">Ingen entitlements ennå. Grant en for å komme i gang.</Alert>
      ) : (
        <Paper style={{ height: 600, width: '100%' }}>
          {/*
            Virtualisert tabell (react-virtuoso) – rendrer kun synlige rader,
            så DOM-en holder seg lett selv med tusenvis av entitlements.
            Samme komponent-mønster som RefundRequestsTable/PaymentMethodsTable.
          */}
          <TableVirtuoso
            data={filteredRows}
            components={{
              Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
                <TableContainer component={Card} {...props} ref={ref} />
              )),
              Table: (props) => (
                <Table {...props} size="small" sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }} />
              ),
              TableHead: React.forwardRef<HTMLTableSectionElement, TableHeadProps>((props, ref) => (
                <TableHead {...props} ref={ref} />
              )),
              TableRow: ({ item, ...props }) => (
                <TableRow {...props} sx={{ opacity: item?.revoked_at ? 0.5 : 1 }} />
              ),
              TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
                <TableBody {...props} ref={ref} />
              )),
            }}
            fixedHeaderContent={() => (
              <TableRow>
                <TableCell sx={{ width: 240, fontWeight: 600 }}>Producer / Klient</TableCell>
                <TableCell sx={{ width: 130, fontWeight: 600 }}>Tier</TableCell>
                <TableCell sx={{ width: 120, fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ width: 160, fontWeight: 600 }}>Kilde</TableCell>
                <TableCell sx={{ width: 150, fontWeight: 600 }}>Quota</TableCell>
                <TableCell sx={{ width: 110, fontWeight: 600 }}>Grantet</TableCell>
                <TableCell align="right" sx={{ width: 130, fontWeight: 600 }}>Handling</TableCell>
              </TableRow>
            )}
            itemContent={(_index, r) => {
              const tierMeta = TIER_META[r.tier];
              const statusMeta = STATUS_META[r.status];
              const producerName = r.producer_first_name && r.producer_last_name
                ? `${r.producer_first_name} ${r.producer_last_name}`
                : r.producer_email ?? r.producer_user_id;
              return (
                <>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {producerName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.config_client_name ?? `config: ${r.config_id.slice(0, 8)}…`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={tierMeta?.label ?? r.tier}
                      sx={{ bgcolor: `${tierMeta?.color}33`, color: tierMeta?.color, fontWeight: 700 }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.4 }}>
                      {tierMeta?.priceNok ? `${tierMeta.priceNok} kr/mnd` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={statusMeta?.label ?? r.status} color={statusMeta?.color} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{r.source}</Typography>
                    {r.trial_ends_at && (
                      <Typography variant="caption" color="text.secondary">
                        Trial → {new Date(r.trial_ends_at).toLocaleDateString('nb-NO')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {r.leads_per_month_limit ?? '∞'} leads/mnd
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.ai_pitches_per_month_limit ?? '∞'} AI/mnd
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(r.granted_at).toLocaleDateString('nb-NO')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {!r.revoked_at ? (
                      <Button
                        size="small" color="error"
                        startIcon={<RevokeIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setRevokeTarget(r)}
                      >
                        Revoker
                      </Button>
                    ) : (
                      <Typography variant="caption" color="error">
                        Revokert {new Date(r.revoked_at).toLocaleDateString('nb-NO')}
                      </Typography>
                    )}
                  </TableCell>
                </>
              );
            }}
          />
        </Paper>
      )}

      {/* Grant-dialog */}
      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Grant Lead Map-entitlement (admin)</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            Admin-grant = gratis tilgang uten Stripe. Bruk f.eks. til oppgrade,
            kompansasjon eller utviklings-tilgang. Logges i audit (notes).
          </Alert>
          <Stack spacing={2}>
            <TextField
              label="Config ID (client_ads_configs.id)" fullWidth required
              value={grantForm.configId}
              onChange={(e) => setGrantForm({ ...grantForm, configId: e.target.value })}
              helperText="UUID fra client_ads_configs-tabellen"
            />
            <TextField
              label="Producer User ID" fullWidth required
              value={grantForm.producerUserId}
              onChange={(e) => setGrantForm({ ...grantForm, producerUserId: e.target.value })}
              helperText="users.id for produsenten som eier configen"
            />
            <Select
              fullWidth value={grantForm.tier}
              onChange={(e) => setGrantForm({ ...grantForm, tier: e.target.value as 'discover'|'pro'|'agency' })}
            >
              <MenuItem value="discover">Discover (50 leads, 299 kr/mnd verdi)</MenuItem>
              <MenuItem value="pro">Pro (250 leads + 50 AI, 599 kr/mnd verdi)</MenuItem>
              <MenuItem value="agency">Agency (ubegrenset, 1490 kr/mnd verdi)</MenuItem>
            </Select>
            <TextField
              label="Notater (audit-trail)" fullWidth multiline rows={2}
              value={grantForm.notes}
              onChange={(e) => setGrantForm({ ...grantForm, notes: e.target.value })}
              placeholder="F.eks. 'Lansering — Pilot-byrå Q3 2026'"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantOpen(false)}>Avbryt</Button>
          <Button
            variant="contained" onClick={handleGrant} disabled={granting}
            startIcon={granting ? <CircularProgress size={14} /> : <GrantIcon />}
          >
            Grant
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke-dialog */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Revoker entitlement</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
            Klienten mister umiddelbart tilgang til Lead Map. Stripe-abonnement
            kanselleres IKKE automatisk — gjør det separat i Stripe Dashboard
            hvis nødvendig.
          </Alert>
          {revokeTarget && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>{revokeTarget.producer_email}</strong> · {revokeTarget.tier} · {revokeTarget.config_client_name ?? revokeTarget.config_id.slice(0,8)}
            </Typography>
          )}
          <TextField
            label="Grunn til revoke (audit)" fullWidth multiline rows={2}
            value={revokeNotes}
            onChange={(e) => setRevokeNotes(e.target.value)}
            placeholder="F.eks. 'Mistanke om misbruk', 'Pilot avsluttet'"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Avbryt</Button>
          <Button
            variant="contained" color="error" onClick={handleRevoke} disabled={revoking}
            startIcon={revoking ? <CircularProgress size={14} /> : <RevokeIcon />}
          >
            Revoker
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar} autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
    </ThemeProvider>
  );
}
