/**
 * ClientGoogleSuitePanel.tsx
 *
 * Wrapper-kort for hele Google-suiten per klient: GA4, GSC, GTM.
 * Vises i AgentAdsPanel etter at config er lagret + approval er sendt.
 *
 * Hver seksjon er kollapsibel og viser status (oppsatt / ikke oppsatt / feil).
 *
 * Backend-endepunkter (alle bak producer-session):
 *   GET  /api/admin-room/agent/ads/ga4/accounts
 *   POST /api/admin-room/agent/ads/configs/:id/ga4/provision
 *
 *   GET  /api/admin-room/agent/ads/configs/:id/gsc/diagnose
 *   POST /api/admin-room/agent/ads/configs/:id/gsc/verify?step=token|verify
 *   POST /api/admin-room/agent/ads/configs/:id/gsc/sitemap
 *   GET  /api/admin-room/agent/ads/configs/:id/gsc/status
 *
 *   GET  /api/admin-room/agent/ads/gtm/accounts
 *   POST /api/admin-room/agent/ads/configs/:id/gtm/provision
 *   POST /api/admin-room/agent/ads/configs/:id/gtm/import-tags
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, IconButton, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

const palette = {
  bgCard: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  borderSubtle: 'rgba(168,85,247,0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface DiagnoseCheck {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'info';
  message: string;
  detail?: any;
}

export default function ClientGoogleSuitePanel({
  configId,
  clientName,
  clientWebsiteUrl,
}: {
  configId: string;
  clientName: string;
  clientWebsiteUrl: string;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState<'ga4' | 'gsc' | 'gtm' | null>('gsc');
  const [diagnosing, setDiagnosing] = useState(false);
  const [checks, setChecks] = useState<DiagnoseCheck[] | null>(null);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);

  const runFullDiagnose = async () => {
    setDiagnosing(true);
    setDiagnoseError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/setup/diagnose`, {
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setChecks(data.checks ?? []);
    } catch (err) {
      setDiagnoseError(err instanceof Error ? err.message : t('googleSuite.s008'));
    } finally {
      setDiagnosing(false);
    }
  };

  const groupedChecks = checks ? groupChecks(t, checks) : null;

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', mb: 0.6 }}>
          {t('googleSuite.s012')}
        </Typography>
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', mb: 1.6 }}>
          {t('googleSuite.s011')}
        </Typography>

        {/* Full-stack diagnose */}
        <Box sx={{
          mb: 2,
          p: 1.4,
          bgcolor: 'rgba(168,85,247,0.04)',
          border: `1px solid ${palette.border}`,
          borderRadius: 1.4,
        }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: checks ? 1.2 : 0 }}>
            <Button
              onClick={runFullDiagnose}
              disabled={diagnosing}
              startIcon={diagnosing ? <CircularProgress size={14} /> : <HealthAndSafetyOutlinedIcon fontSize="small" />}
              sx={{
                background: palette.accentGradient,
                color: '#fff', textTransform: 'none', fontWeight: 700,
                '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
              }}
            >
              {diagnosing ? t('googleSuite.s036') : checks ? t('googleSuite.s022') : t('googleSuite.s034')}
            </Button>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', flex: 1 }}>
              {t('googleSuite.s035')}
            </Typography>
          </Stack>
          {diagnoseError ? <Alert severity="error" onClose={() => setDiagnoseError(null)}>{diagnoseError}</Alert> : null}
          {groupedChecks ? (
            <Stack spacing={1.4}>
              {groupedChecks.map((group) => (
                <Box key={group.title}>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.6 }}>
                    {group.title}
                  </Typography>
                  <Stack spacing={0.7}>
                    {group.checks.map((c) => <DiagnoseRow key={c.id} check={c} />)}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Box>

        <Stack spacing={1.2}>
          <Ga4Section
            configId={configId}
            clientName={clientName}
            expanded={expanded === 'ga4'}
            onToggle={() => setExpanded(expanded === 'ga4' ? null : 'ga4')}
          />
          <GscSection
            configId={configId}
            clientWebsiteUrl={clientWebsiteUrl}
            expanded={expanded === 'gsc'}
            onToggle={() => setExpanded(expanded === 'gsc' ? null : 'gsc')}
          />
          <GtmSection
            configId={configId}
            clientName={clientName}
            expanded={expanded === 'gtm'}
            onToggle={() => setExpanded(expanded === 'gtm' ? null : 'gtm')}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GA4
// ─────────────────────────────────────────────────────────────────────

function Ga4Section({
  configId, clientName, expanded, onToggle,
}: { configId: string; clientName: string; expanded: boolean; onToggle: () => void }) {
  const { t } = useT();
  const [accounts, setAccounts] = useState<Array<{ name: string; displayName: string }>>([]);
  const [accountName, setAccountName] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<{ measurementId: string; propertyId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setError(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/ga4/accounts', { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) setAccountName(data.accounts[0].name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente GA4-kontoer');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const provision = async () => {
    if (!accountName) return;
    setProvisioning(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/ga4/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setResult({ measurementId: data.measurementId, propertyId: data.propertyId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning feilet');
    } finally {
      setProvisioning(false);
    }
  };

  useEffect(() => {
    if (expanded && accounts.length === 0) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <SectionFrame
      icon={<AnalyticsOutlinedIcon sx={{ color: '#fbbf24' }} />}
      title="GA4 — Google Analytics 4"
      subtitle={t('googleSuite.s027')}
      expanded={expanded}
      onToggle={onToggle}
      status={result ? 'ok' : 'pending'}
    >
      <Stack spacing={1.4}>
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            {t('googleSuite.s044')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={loadingAccounts || accounts.length === 0}
              displayEmpty
              sx={{ minWidth: 280, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value="">
                <em style={{ color: palette.textMuted }}>
                  {loadingAccounts ? t('googleSuite.s014') : accounts.length === 0 ? t('googleSuite.s021') : t('googleSuite.s046')}
                </em>
              </MenuItem>
              {accounts.map((a) => (
                <MenuItem key={a.name} value={a.name}>{a.displayName} ({a.name})</MenuItem>
              ))}
            </Select>
            <Button onClick={loadAccounts} size="small" sx={{ color: palette.accent, textTransform: 'none' }}>
              {t('googleSuite.s024')}
            </Button>
          </Stack>
        </Box>

        <Button
          onClick={provision}
          disabled={!accountName || provisioning || !!result}
          startIcon={provisioning ? <CircularProgress size={14} /> : <SaveOutlinedIcon fontSize="small" />}
          sx={{
            background: palette.accentGradient,
            color: '#fff', textTransform: 'none', fontWeight: 700,
            alignSelf: 'flex-start',
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
          }}
        >
          {provisioning ? t('googleSuite.s028') : t('googleSuite.p01', { v0: clientName })}
        </Button>

        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

        {result ? (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            {t('googleSuite.j00a')}&nbsp;
            <strong style={{ fontFamily: 'monospace' }}>{result.measurementId}</strong>
            &nbsp;{t('googleSuite.j00b')}
            <CopyButton text={result.measurementId} />
          </Alert>
        ) : null}
      </Stack>
    </SectionFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GSC — med Diagnose-knapp
// ─────────────────────────────────────────────────────────────────────

function GscSection({
  configId, clientWebsiteUrl, expanded, onToggle,
}: { configId: string; clientWebsiteUrl: string; expanded: boolean; onToggle: () => void }) {
  const { t } = useT();
  const [verifying, setVerifying] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [metaTag, setMetaTag] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);
  const [sitemapResult, setSitemapResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const getToken = async () => {
    setVerifying(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/gsc/verify?step=token`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setToken(data.token);
      setMetaTag(data.metaTag);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('googleSuite.s042'));
    } finally {
      setVerifying(false);
    }
  };

  const runVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/gsc/verify?step=verify`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('googleSuite.s049'));
    } finally {
      setVerifying(false);
    }
  };

  const submitSitemap = async () => {
    setSubmittingSitemap(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/gsc/sitemap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setSitemapResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('googleSuite.s033'));
    } finally {
      setSubmittingSitemap(false);
    }
  };

  return (
    <SectionFrame
      icon={<SearchOutlinedIcon sx={{ color: '#60a5fa' }} />}
      title={t('googleSuite.s031')}
      subtitle={t('googleSuite.s040')}
      expanded={expanded}
      onToggle={onToggle}
      status={verified || sitemapResult?.success ? 'ok' : 'pending'}
    >
      <Stack spacing={1.4}>
        {/* Verifisering */}
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            {t('googleSuite.s037')}
          </Typography>
          {!token ? (
            <Button
              onClick={getToken}
              disabled={verifying}
              startIcon={verifying ? <CircularProgress size={14} /> : null}
              sx={{ border: `1px solid ${palette.borderStrong}`, color: palette.accent, textTransform: 'none' }}
            >
              {verifying ? t('googleSuite.s014') : t('googleSuite.s013')}
            </Button>
          ) : (
            <Box>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', mb: 0.6 }}>
                {t('googleSuite.s025')} <code style={{ color: palette.accent }}>&lt;head&gt;</code> {t('googleSuite.s051')} {clientWebsiteUrl}{t('googleSuite.s000')}
              </Typography>
              <Box sx={{
                bgcolor: '#0a0a1a',
                border: `1px solid ${palette.borderStrong}`,
                borderRadius: 1,
                p: 1.2,
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                color: '#a5f3fc',
                wordBreak: 'break-all',
                mb: 1,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}>
                <Box sx={{ flex: 1 }}>{metaTag || `<meta name="google-site-verification" content="${token}" />`}</Box>
                <CopyButton text={metaTag || `<meta name="google-site-verification" content="${token}" />`} />
              </Box>
              {!verified ? (
                <Button
                  onClick={runVerify}
                  disabled={verifying}
                  startIcon={verifying ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon fontSize="small" />}
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff', textTransform: 'none', fontWeight: 700,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  }}
                >
                  {verifying ? t('googleSuite.s048') : t('googleSuite.s047')}
                </Button>
              ) : (
                <Alert severity="success">{t('googleSuite.s032')}</Alert>
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: palette.borderSubtle }} />

        {/* Sitemap */}
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            {t('googleSuite.s038')}
          </Typography>
          <Button
            onClick={submitSitemap}
            disabled={submittingSitemap || !verified}
            startIcon={submittingSitemap ? <CircularProgress size={14} /> : <SearchOutlinedIcon fontSize="small" />}
            sx={{
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              color: '#0a0a1a', textTransform: 'none', fontWeight: 800,
            }}
          >
            {submittingSitemap ? t('googleSuite.s039') : t('googleSuite.s004')}
          </Button>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.6 }}>
            {t('googleSuite.s050')} <code>Sitemap:</code>{t('googleSuite.s001')}
          </Typography>
          {sitemapResult ? (
            <Box sx={{ mt: 1.2 }}>
              <Alert severity={sitemapResult.success ? 'success' : 'warning'}>
                {t('googleSuite.s009')} <strong>{sitemapResult.discoverySource}</strong> {t('googleSuite.s054')}{' '}
                <strong>{sitemapResult.discovered?.length ?? 0}</strong> {t('googleSuite.s052')} <strong>{sitemapResult.submitted?.filter((s: any) => s.ok).length ?? 0}/{sitemapResult.submitted?.length ?? 0}</strong>.
              </Alert>
              {sitemapResult.indexing?.results?.length > 0 ? (
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem', mt: 0.6 }}>
                  {t('googleSuite.s019')} {sitemapResult.indexing.results.filter((r: any) => r.ok).length}/
                  {sitemapResult.indexing.results.length} {t('googleSuite.s043')}
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </Box>

        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      </Stack>
    </SectionFrame>
  );
}

/** Grupperer diagnose-checks i seksjoner så UI'et kan vise dem ryddig. */
function groupChecks(t: TFn, checks: DiagnoseCheck[]): Array<{ title: string; checks: DiagnoseCheck[] }> {
  const groups: Record<string, { title: string; checks: DiagnoseCheck[]; order: number }> = {
    tracking: { title: 'Tracking & tags', checks: [], order: 1 },
    consent: { title: t('googleSuite.s030'), checks: [], order: 2 },
    seo: { title: t('googleSuite.s029'), checks: [], order: 3 },
    search: { title: 'Search Console', checks: [], order: 4 },
    other: { title: t('googleSuite.s003'), checks: [], order: 5 },
  };
  const map: Record<string, keyof typeof groups> = {
    'html-fetch': 'tracking',
    'ga4-tag': 'tracking',
    'ads-tag': 'tracking',
    'gtm-snippet': 'tracking',
    'consent-mode': 'consent',
    'seo-basics': 'seo',
    'noindex': 'seo',
    'structured-data': 'seo',
    'robots': 'search',
    'sitemap-found': 'search',
    'verification': 'search',
    'gsc-property': 'search',
    'gsc-sitemap': 'search',
    'url-inspection': 'search',
    'other-pixels': 'other',
    'auth': 'other',
  };
  for (const c of checks) {
    const key = map[c.id] ?? 'other';
    groups[key].checks.push(c);
  }
  return Object.values(groups).filter((g) => g.checks.length > 0).sort((a, b) => a.order - b.order);
}

function DiagnoseRow({ check }: { check: DiagnoseCheck }) {
  const iconMap = {
    ok: <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18 }} />,
    warning: <WarningAmberIcon sx={{ color: '#fbbf24', fontSize: 18 }} />,
    error: <ErrorOutlineOutlinedIcon sx={{ color: '#f87171', fontSize: 18 }} />,
    info: <InfoOutlinedIcon sx={{ color: '#60a5fa', fontSize: 18 }} />,
  };
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box sx={{ mt: 0.2 }}>{iconMap[check.status]}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ color: palette.textPrimary, fontSize: '0.84rem', fontWeight: 700 }}>
          {check.label}
        </Typography>
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem' }}>
          {check.message}
        </Typography>
        {check.detail?.sitemaps?.length ? (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', mt: 0.3, fontFamily: 'monospace' }}>
            {check.detail.sitemaps.slice(0, 3).map((s: any) => typeof s === 'string' ? s : s.path).join(', ')}
            {check.detail.sitemaps.length > 3 ? ` …+${check.detail.sitemaps.length - 3}` : ''}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GTM
// ─────────────────────────────────────────────────────────────────────

function GtmSection({
  configId, clientName, expanded, onToggle,
}: { configId: string; clientName: string; expanded: boolean; onToggle: () => void }) {
  const { t } = useT();
  const [accounts, setAccounts] = useState<Array<{ accountId: string; name: string }>>([]);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [importingTags, setImportingTags] = useState(false);
  const [container, setContainer] = useState<{ publicId: string; containerId: string } | null>(null);
  const [tagImportResult, setTagImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/gtm/accounts', { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) setAccountId(data.accounts[0].accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('googleSuite.s023'));
    } finally {
      setLoading(false);
    }
  };

  const provision = async () => {
    if (!accountId) return;
    setProvisioning(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/gtm/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setContainer({ publicId: data.publicId, containerId: data.containerId });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('googleSuite.s006'));
    } finally {
      setProvisioning(false);
    }
  };

  const importTags = async () => {
    setImportingTags(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/gtm/import-tags`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setTagImportResult({ imported: data.imported, failed: data.failed });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('googleSuite.s041'));
    } finally {
      setImportingTags(false);
    }
  };

  useEffect(() => {
    if (expanded && accounts.length === 0) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <SectionFrame
      icon={<LocalOfferOutlinedIcon sx={{ color: '#34d399' }} />}
      title="Google Tag Manager"
      subtitle={t('googleSuite.s026')}
      expanded={expanded}
      onToggle={onToggle}
      status={container && tagImportResult ? 'ok' : container ? 'partial' : 'pending'}
    >
      <Stack spacing={1.4}>
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            {t('googleSuite.s045')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={loading || accounts.length === 0 || !!container}
              displayEmpty
              sx={{ minWidth: 280, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value="">
                <em style={{ color: palette.textMuted }}>
                  {loading ? t('googleSuite.s014') : accounts.length === 0 ? t('googleSuite.s020') : t('googleSuite.s046')}
                </em>
              </MenuItem>
              {accounts.map((a) => (
                <MenuItem key={a.accountId} value={a.accountId}>{a.name}</MenuItem>
              ))}
            </Select>
            <Button onClick={loadAccounts} size="small" sx={{ color: palette.accent, textTransform: 'none' }}>
              {t('googleSuite.s024')}
            </Button>
          </Stack>
        </Box>

        <Button
          onClick={provision}
          disabled={!accountId || provisioning || !!container}
          startIcon={provisioning ? <CircularProgress size={14} /> : <SaveOutlinedIcon fontSize="small" />}
          sx={{
            background: palette.accentGradient,
            color: '#fff', textTransform: 'none', fontWeight: 700,
            alignSelf: 'flex-start',
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
          }}
        >
          {provisioning ? t('googleSuite.s028') : t('googleSuite.p02', { v0: clientName })}
        </Button>

        {container ? (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            {t('googleSuite.s005')} <strong style={{ fontFamily: 'monospace' }}>{container.publicId}</strong>
            <CopyButton text={container.publicId} />
          </Alert>
        ) : null}

        {container ? (
          <Box>
            <Divider sx={{ borderColor: palette.borderSubtle, mb: 1.4 }} />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
              {t('googleSuite.s017')}
            </Typography>
            <Button
              onClick={importTags}
              disabled={importingTags || !!tagImportResult}
              startIcon={importingTags ? <CircularProgress size={14} /> : <LocalOfferOutlinedIcon fontSize="small" />}
              sx={{
                background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                color: '#0a0a1a', textTransform: 'none', fontWeight: 800,
              }}
            >
              {importingTags ? t('googleSuite.s018') : t('googleSuite.s016')}
            </Button>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.6 }}>
              {t('googleSuite.s010')}
            </Typography>
            {tagImportResult ? (
              <Alert severity={tagImportResult.failed > 0 ? 'warning' : 'success'} sx={{ mt: 1 }}>
                {tagImportResult.imported} {t('googleSuite.s053')}
                {tagImportResult.failed > 0 ? t('googleSuite.p00', { v0: tagImportResult.failed }) : t('googleSuite.s002')}
              </Alert>
            ) : null}
          </Box>
        ) : null}

        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      </Stack>
    </SectionFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Felles ramme-komponent
// ─────────────────────────────────────────────────────────────────────

function SectionFrame({
  icon, title, subtitle, expanded, onToggle, status, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  status: 'ok' | 'partial' | 'pending';
  children: React.ReactNode;
}) {
  const { t } = useT();
  const statusChip = status === 'ok'
    ? { label: 'OK', color: '#34d399', bg: 'rgba(52,211,153,0.18)' }
    : status === 'partial'
      ? { label: t('googleSuite.s007'), color: '#fbbf24', bg: 'rgba(251,191,36,0.18)' }
      : { label: t('googleSuite.s015'), color: palette.textMuted, bg: 'rgba(148,163,184,0.18)' };

  return (
    <Box sx={{
      border: `1px solid ${palette.border}`,
      borderRadius: 1.4,
      bgcolor: expanded ? 'rgba(168,85,247,0.04)' : 'transparent',
    }}>
      <Box
        onClick={onToggle}
        sx={{ p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2, cursor: 'pointer' }}
      >
        <Box sx={{
          width: 32, height: 32, borderRadius: 1,
          bgcolor: 'rgba(168,85,247,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
            {title}
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            {subtitle}
          </Typography>
        </Box>
        <Chip
          label={statusChip.label}
          size="small"
          sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 700 }}
        />
        <IconButton size="small" sx={{ color: palette.textMuted }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      {expanded ? <Box sx={{ p: 1.4, pt: 0 }}>{children}</Box> : null}
    </Box>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      size="small"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      sx={{ color: copied ? '#34d399' : palette.accent, ml: 0.6 }}
    >
      {copied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
    </IconButton>
  );
}
