/**
 * ClientAdsDeploymentPanel.tsx
 *
 * N2-B5 — Frontend for tracking-deployment per metode.
 *
 * Lar produsenten velge én av 5 deployment-methods og få:
 *   - Klare copy-paste-snippets (gtag, GTM JSON, WP-config-URL)
 *   - eller proxy-token + curl-eksempel
 *   - eller "Deploy via API"-knapp (GTM API)
 *
 * Etter applied: "Marker som deployet"-knapp setter tracking_deployed_at
 * + "Verifiser deployment"-knapp henter klientens HTML og rapporterer
 * om gtag faktisk landet.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';

type TrackingMethod = 'pending' | 'proxy' | 'gtag_snippets' | 'gtm_api' | 'wordpress_plugin' | 'manual';

interface Snippet {
  location: string;
  description: string;
  code: string;
  language: string;
}

interface DeploymentPayload {
  method: TrackingMethod;
  ready: boolean;
  instructions: string[];
  snippets?: Snippet[];
  apiCalls?: Array<{ description: string; method: string; endpoint: string; note?: string }>;
  proxyConfig?: {
    proxyToken: string;
    trackEndpointUrl: string;
    examplePayload: Record<string, unknown>;
  };
  warnings?: string[];
}

interface ValidationResult {
  ok: boolean;
  conversionIdFound: boolean;
  actionsFound: string[];
  actionsMissing: string[];
  fetchedAt: string;
  url: string;
  statusCode?: number;
  error?: string;
}

const METHOD_META: Record<TrackingMethod, { label: string; description: string; color: string }> = {
  pending: { label: 'Ikke valgt', description: 'Velg en metode først', color: '#8b7ec4' },
  gtag_snippets: { label: 'gtag-snippets', description: 'Lim-inn-koden er enkelest for de fleste', color: '#c084fc' },
  gtm_api: { label: 'GTM API', description: 'Vi sender tags via API til klientens GTM', color: '#60a5fa' },
  proxy: { label: 'Server-side proxy', description: 'Mest sikkert — token aldri i browser', color: '#34d399' },
  wordpress_plugin: { label: 'WordPress-plugin', description: 'Vår plugin pull-er config automatisk', color: '#fbbf24' },
  manual: { label: 'Manuell', description: 'For custom-stacks vi ikke kan automatisere', color: '#fb923c' },
};

const palette = {
  bg: '#150b2e',
  bgSubtle: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#c084fc',
};

export default function ClientAdsDeploymentPanel({
  configId,
}: { configId: string }) {
  const [selectedMethod, setSelectedMethod] = useState<TrackingMethod>('gtag_snippets');
  const [payload, setPayload] = useState<DeploymentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingDeployed, setMarkingDeployed] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchPayload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(
        `/api/role-room/ads-configs/${configId}/deployment-payload?method=${selectedMethod}`,
        { credentials: 'include' },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      setPayload(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [configId, selectedMethod]);

  useEffect(() => { fetchPayload(); }, [fetchPayload]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // noop
    }
  };

  const markDeployed = async () => {
    setMarkingDeployed(true);
    try {
      await fetch(`/api/role-room/ads-configs/${configId}/mark-deployed`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: selectedMethod }),
      });
      await fetchPayload();
    } finally {
      setMarkingDeployed(false);
    }
  };

  const validate = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const r = await fetch(`/api/role-room/ads-configs/${configId}/validate-deployment`, {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) setValidation(await r.json());
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2.4 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 1.4,
            bgcolor: 'rgba(168,85,247,0.12)',
            border: `1px solid ${palette.borderStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RocketLaunchOutlinedIcon sx={{ color: palette.accent, fontSize: 22 }} />
          </Box>
          <Stack>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: palette.textPrimary }}>
              Deploy tracking
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
              Velg metoden som passer klientens stack
            </Typography>
          </Stack>
        </Stack>

        {/* Method-tabs */}
        <Tabs
          value={selectedMethod}
          onChange={(_, v) => setSelectedMethod(v as TrackingMethod)}
          variant="scrollable" scrollButtons="auto"
          sx={{
            mb: 2, minHeight: 36,
            '& .MuiTab-root': {
              color: palette.textMuted, fontSize: '0.76rem', fontWeight: 700,
              textTransform: 'none', minHeight: 36, p: '6px 12px',
            },
            '& .Mui-selected': { color: `${palette.accent} !important` },
            '& .MuiTabs-indicator': { bgcolor: palette.accent },
          }}
        >
          {(Object.keys(METHOD_META) as TrackingMethod[])
            .filter((m) => m !== 'pending')
            .map((m) => (
              <Tab key={m} label={METHOD_META[m].label} value={m} />
            ))}
        </Tabs>

        {/* Beskrivelse av valgt metode */}
        <Box sx={{
          p: 1.6, mb: 2, borderRadius: 1.4,
          bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack>
              <Typography sx={{ fontWeight: 700, color: palette.textPrimary, fontSize: '0.94rem' }}>
                {METHOD_META[selectedMethod].label}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                {METHOD_META[selectedMethod].description}
              </Typography>
            </Stack>
            {payload?.ready ? (
              <Chip
                size="small" icon={<CheckCircleOutlineIcon sx={{ color: '#34d399 !important', fontSize: 14 }} />}
                label="KLAR"
                sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700, fontSize: '0.68rem' }}
              />
            ) : (
              <Chip
                size="small" icon={<ErrorOutlineOutlinedIcon sx={{ color: '#fbbf24 !important', fontSize: 14 }} />}
                label="MANGLER OPPSETT"
                sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 700, fontSize: '0.68rem' }}
              />
            )}
          </Stack>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} sx={{ color: palette.accent }} />
          </Box>
        ) : error || !payload ? (
          <Alert severity="warning">{error ?? 'Ingen data'}</Alert>
        ) : (
          <Stack spacing={2}>
            {/* Warnings */}
            {payload.warnings?.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ fontSize: '0.82rem' }}>{w}</Alert>
            ))}

            {/* Instructions */}
            {payload.instructions.length > 0 && (
              <Box sx={{ p: 1.6, borderRadius: 1.4, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: palette.textPrimary, mb: 1 }}>
                  Slik gjør du
                </Typography>
                <Stack spacing={0.6}>
                  {payload.instructions.map((step, i) => (
                    <Typography key={i} sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                      {step}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Proxy config — token + endpoint */}
            {payload.proxyConfig && (
              <Box sx={{
                p: 1.6, borderRadius: 1.4,
                bgcolor: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.28)',
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', color: '#34d399', mb: 1.2 }}>
                  Proxy-token (KUN i klient-backend, IKKE eksponer i browser)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                  <Box sx={{
                    flex: 1, p: 0.8, borderRadius: 0.8,
                    bgcolor: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '0.76rem',
                    color: '#f5f3ff', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {payload.proxyConfig.proxyToken}
                  </Box>
                  <Tooltip title={copiedKey === 'token' ? 'Kopiert!' : 'Kopier token'}>
                    <IconButton size="small" onClick={() => copyToClipboard(payload.proxyConfig!.proxyToken, 'token')} sx={{ color: palette.accent }}>
                      {copiedKey === 'token' ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                  Endpoint: <code style={{ color: palette.accent }}>{payload.proxyConfig.trackEndpointUrl}</code>
                </Typography>
              </Box>
            )}

            {/* Snippets */}
            {payload.snippets?.map((s, i) => (
              <Box key={i} sx={{
                p: 1.6, borderRadius: 1.4,
                bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
              }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Chip
                      size="small" label={s.location}
                      sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent, fontSize: '0.66rem', fontWeight: 700, height: 18 }}
                    />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', color: palette.textPrimary }}>
                      {s.description}
                    </Typography>
                  </Stack>
                  <Tooltip title={copiedKey === `s${i}` ? 'Kopiert!' : 'Kopier'}>
                    <IconButton size="small" onClick={() => copyToClipboard(s.code, `s${i}`)} sx={{ color: palette.accent }}>
                      {copiedKey === `s${i}` ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Box sx={{
                  p: 1, borderRadius: 0.8,
                  bgcolor: 'rgba(0,0,0,0.4)', fontFamily: 'monospace', fontSize: '0.7rem',
                  color: '#f5f3ff', overflowX: 'auto', whiteSpace: 'pre',
                  maxHeight: 200,
                }}>
                  {s.code}
                </Box>
              </Box>
            ))}

            {/* Action-knapper */}
            <Stack direction="row" spacing={1.2}>
              <Button
                variant="contained" onClick={markDeployed}
                disabled={!payload.ready || markingDeployed}
                startIcon={markingDeployed ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                sx={{
                  bgcolor: palette.accent, fontWeight: 700, fontSize: '0.82rem',
                  '&:hover': { bgcolor: palette.accent, filter: 'brightness(0.9)' },
                }}
              >
                Marker som deployet
              </Button>
              <Button
                variant="outlined" onClick={validate}
                disabled={validating}
                startIcon={validating ? <CircularProgress size={14} /> : <VerifiedOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  color: palette.accent, borderColor: palette.borderStrong,
                  fontWeight: 700, fontSize: '0.82rem',
                  '&:hover': { borderColor: palette.accent, bgcolor: 'rgba(168,85,247,0.06)' },
                }}
              >
                Verifiser
              </Button>
            </Stack>

            {/* Validation-resultat */}
            {validation && (
              <Box sx={{
                p: 1.6, borderRadius: 1.4,
                bgcolor: validation.ok ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
                border: `1px solid ${validation.ok ? 'rgba(52,211,153,0.28)' : 'rgba(251,191,36,0.28)'}`,
              }}>
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                  {validation.ok
                    ? <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18 }} />
                    : <ErrorOutlineOutlinedIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
                  }
                  <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: palette.textPrimary }}>
                    {validation.ok ? 'Deployment verifisert' : 'Mangler fortsatt deler'}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                  Conversion-ID: {validation.conversionIdFound ? '✓ funnet' : '✗ mangler'} ·
                  Actions: {validation.actionsFound.length} OK / {validation.actionsMissing.length} mangler ·
                  URL: <code style={{ color: palette.accent }}>{validation.url}</code>
                </Typography>
                {validation.actionsMissing.length > 0 && (
                  <Typography sx={{ fontSize: '0.74rem', color: '#fbbf24', mt: 0.6 }}>
                    Mangler: {validation.actionsMissing.join(', ')}
                  </Typography>
                )}
                {validation.error && (
                  <Typography sx={{ fontSize: '0.74rem', color: '#f87171', mt: 0.6 }}>
                    Feil: {validation.error}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
