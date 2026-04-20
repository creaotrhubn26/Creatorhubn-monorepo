/**
 * Meta App Review — attribution_read / ads_read demo panel.
 *
 * Mirrors the MetaPagePublicMetadataInspector pattern: producer
 * pastes an ad account id (numeric or act_{id}), we call Meta Graph
 * Insights API with a 7d last-click / 1d view attribution window,
 * and render impressions / clicks / spend / CPC / CPM / CTR / reach
 * inside the Ads Attribution panel so producers can benchmark paid
 * campaign performance for a client alongside the Page intelligence
 * and competitor analysis data.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, Grid, Stack, TextField, Typography,
} from '@mui/material';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import LaunchIcon from '@mui/icons-material/Launch';
import { useAuth } from '@/hooks/useAuth';
import { authSessionService } from '../../services/authSessionService';

interface AttributionResult {
  insights: {
    impressions: number | null;
    clicks: number | null;
    spend: number | null;
    cpc: number | null;
    cpm: number | null;
    ctr: number | null;
    reach: number | null;
    frequency: number | null;
    actions: Array<{ action_type?: string; value?: string }> | null;
    actionValues: Array<{ action_type?: string; value?: string }> | null;
  } | null;
  meta: {
    resolvedFrom: string;
    resolvedTo: string;
    graphVersion: string;
    datePreset: string;
    attributionWindows: string[];
  };
}

export function AdsAttributionInspector() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AttributionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectRequired, setConnectRequired] = useState(false);

  const resolveAuthToken = (): string | null => {
    try {
      const rrToken = localStorage.getItem('role_room_auth_token');
      if (rrToken) return rrToken;
      const rrSession = localStorage.getItem('role_room_auth_session');
      if (rrSession) {
        const parsed = JSON.parse(rrSession);
        const id = parsed?.adminUser?.id || parsed?.user?.id || parsed?.id;
        if (id) return id;
      }
      const chToken = localStorage.getItem('creatorhub_auth_token');
      if (chToken) return chToken;
      const chUser = localStorage.getItem('creatorhub_auth_user');
      if (chUser) {
        const id = JSON.parse(chUser)?.id;
        if (id) return id;
      }
    } catch { /* fall through */ }
    return user?.id || null;
  };

  const handleInspect = async () => {
    setLoading(true);
    setError(null);
    setConnectRequired(false);
    setResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authToken = resolveAuthToken();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const response = await fetch('/api/role-room/agent/ads-attribution-inspect', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ adAccountId: input.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.connectRequired) setConnectRequired(true);
        setError(body?.error || `HTTP ${response.status}`);
        return;
      }
      setResult(body as AttributionResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request feilet');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const headers: Record<string, string> = {};
      const authToken = resolveAuthToken();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const response = await fetch(
        `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent('ads-demo')}`,
        { headers, credentials: 'include' },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.url) {
        setError(body?.error || `Kunne ikke starte Meta OAuth (${response.status})`);
        return;
      }
      window.location.href = body.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect-feilet');
    }
  };

  const fmtNum = (n: number | null, digits = 0) =>
    typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
  const fmtCurrency = (n: number | null) =>
    typeof n === 'number' && Number.isFinite(n) ? `${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${result?.insights?.spend != null ? 'NOK' : ''}`.trim() : '—';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3} data-testid="ads-attribution-inspector-root">
        <Box>
          <Chip
            label="Meta App Review Demo"
            color="primary"
            size="small"
            sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }}
          />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Ads Attribution
          </Typography>
          <Typography variant="body1" color="text.secondary">
            CreatorHub One uses the attribution_read + ads_read permissions to let content
            producers benchmark a client&apos;s paid campaign performance — impressions, clicks,
            CPC, CPM, CTR, reach, and action attribution — using Meta&apos;s 7-day last-click +
            1-day view attribution window. Paste the client&apos;s Ad Account ID below.
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={2}>
          <TextField
            label="Ad Account ID (numeric or act_{id})"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            fullWidth
            placeholder="act_1234567890"
            inputProps={{ 'data-testid': 'ads-inspect-input' }}
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={handleInspect}
              disabled={loading || !input.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <QueryStatsIcon />}
              data-testid="ads-inspect-submit"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {loading ? 'Kaller Meta Graph API…' : 'Fetch attribution insights'}
            </Button>
            {connectRequired ? (
              <Button
                variant="outlined"
                size="large"
                onClick={handleConnect}
                startIcon={<LaunchIcon />}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Connect Facebook
              </Button>
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Calls <code>GET /act_&#123;id&#125;/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions&amp;action_attribution_windows=[&quot;7d_click&quot;,&quot;1d_view&quot;]</code>
            on Meta Graph API v21.0 with the signed-in admin&apos;s user access token
            (attribution_read + ads_read + business_management scopes).
          </Typography>
        </Stack>

        {error ? (
          <Alert severity={connectRequired ? 'warning' : 'error'}>{error}</Alert>
        ) : null}

        {result ? (
          <Box
            data-testid="ads-inspect-result"
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1.5px solid rgba(16,185,129,0.45)',
              background: 'linear-gradient(180deg, rgba(6,95,70,0.15), rgba(8,15,30,0.45))',
            }}
          >
            <Stack spacing={2}>
              <Typography variant="overline" sx={{ color: '#6ee7b7', letterSpacing: '0.22em', fontWeight: 800 }}>
                Ads Attribution — last 7 days
              </Typography>
              {result.insights ? (
                <Grid container spacing={2}>
                  {[
                    { label: 'Impressions', value: fmtNum(result.insights.impressions) },
                    { label: 'Clicks', value: fmtNum(result.insights.clicks) },
                    { label: 'Spend', value: fmtCurrency(result.insights.spend) },
                    { label: 'CPC', value: result.insights.cpc != null ? result.insights.cpc.toFixed(2) : '—' },
                    { label: 'CPM', value: result.insights.cpm != null ? result.insights.cpm.toFixed(2) : '—' },
                    { label: 'CTR %', value: result.insights.ctr != null ? result.insights.ctr.toFixed(2) : '—' },
                    { label: 'Reach', value: fmtNum(result.insights.reach) },
                    { label: 'Frequency', value: result.insights.frequency != null ? result.insights.frequency.toFixed(2) : '—' },
                  ].map((m) => (
                    <Grid item xs={6} md={3} key={m.label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.65)', letterSpacing: '0.14em' }}>
                          {m.label}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                          {m.value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  Meta Graph API returnerte ingen insights — konto kan være tom for siste 7 dager,
                  eller du mangler rolle på kontoen. Dette er fortsatt en gyldig attribution_read-kall.
                </Alert>
              )}

              <Divider sx={{ opacity: 0.3 }} />
              <Typography variant="caption" color="text.secondary">
                Resolved <code>{result.meta.resolvedFrom}</code> → <code>{result.meta.resolvedTo}</code> via
                Meta Graph API <code>{result.meta.graphVersion}</code> with attribution windows{' '}
                <code>{result.meta.attributionWindows.join(', ')}</code>. Rendered inside
                CreatorHub One&apos;s Producer workflow for per-client campaign benchmarking.
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}

export default AdsAttributionInspector;
