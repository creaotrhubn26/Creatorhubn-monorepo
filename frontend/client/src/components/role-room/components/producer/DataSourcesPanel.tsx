/**
 * DataSourcesPanel — Datakilder-fanen i Creative Sync Workspace.
 *
 * Sentralt sted der markedsføreren ser hvilke OAuth-koblinger + KPI-
 * konfigurasjoner finnes per prosjekt. Hver kilde rendres som et kort med:
 *   - Status-indikator (grønn=verified, gul=mangler config/test, rød=feil)
 *   - Connection-info (sist refreshed, scopes, profile)
 *   - Configs (property-id, location-id, etc.) som kan edits inline
 *   - Én-klikks-CTA basert på state: Koble / Refresh / Konfigurer / Test
 *
 * Robust mot manglende data: hvert kort behandler null-cases (ingen
 * connection, ingen configs) som "not_connected" og viser passende CTA.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as VerifiedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  MailOutline as MailIcon,
} from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';
import ClientRequestModal from './ClientRequestModal';
import ClientRequestsThread from './ClientRequestsThread';
import { LoadingSkeleton, ErrorAlert } from './ui';
import type { DataSourcePlatformKey } from '../../utils/dataSourceClientOnboarding';

type DataSourcesPayload = NonNullable<Awaited<ReturnType<typeof roleRoomAgentService.fetchDataSources>>>;
type DataSource = DataSourcesPayload['sources'][number];

interface DataSourcesPanelProps {
  projectId: string;
}

const STATE_META: Record<DataSource['state'], { color: string; bg: string; label: string; Icon: React.ElementType }> = {
  not_connected: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Ikke koblet', Icon: LinkIcon },
  connected: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Koblet', Icon: LinkIcon },
  expired: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', label: 'Token utløpt', Icon: ErrorIcon },
  needs_config: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: 'Mangler config', Icon: WarningIcon },
  needs_test: { color: '#a5b4fc', bg: 'rgba(167,139,250,0.12)', label: 'Ikke testet', Icon: WarningIcon },
  test_failed: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', label: 'Test feilet', Icon: ErrorIcon },
  verified: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', label: 'Verifisert', Icon: VerifiedIcon },
};

const GROUP_LABEL: Record<DataSource['group'], string> = {
  social: 'Sosiale medier',
  analytics: 'Analytics',
  local: 'Lokal-søk',
  video: 'Video',
  professional: 'Profesjonell',
};

// Config-keys med visningsnavn + placeholder + valideringshjelp per platform.
const CONFIG_KEY_META: Record<string, { label: string; placeholder: string; helperText: string }> = {
  property_id: {
    label: 'GA4 Property ID',
    placeholder: 'f.eks. 378451237',
    helperText: 'Finnes i Google Analytics → Admin → Property Settings (9-sifret).',
  },
  location_id: {
    label: 'Google Business location-ID',
    placeholder: 'f.eks. accounts/123/locations/456',
    helperText: 'Finnes i Google Business Profile Performance → API-info.',
  },
  site_url: {
    label: 'Search Console domene',
    placeholder: 'sc-domain:dittfirma.no eller https://dittfirma.no/',
    helperText: 'Akkurat slik det vises i Search Console (med protokoll eller sc-domain:-prefix).',
  },
  channel_id: {
    label: 'YouTube Channel ID',
    placeholder: 'f.eks. UCdQw4w9WgXcQ-LeKwUtUVzg',
    helperText: 'YouTube Studio → Innstillinger → Kanal → Advanced — "Channel ID".',
  },
  page_id: {
    label: 'Facebook Page ID',
    placeholder: 'f.eks. 123456789012345',
    helperText: 'Facebook Page → About → Page ID.',
  },
};

const DataSourcesPanel: React.FC<DataSourcesPanelProps> = ({ projectId }) => {
  const [data, setData] = useState<DataSourcesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [configDialog, setConfigDialog] = useState<{ source: DataSource; configKey: string } | null>(null);
  const [configValue, setConfigValue] = useState('');
  const [configLabel, setConfigLabel] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  // Picker-data fra Google discover-API
  const [pickerCandidates, setPickerCandidates] = useState<Array<{ id: string; label: string; meta?: Record<string, string> }> | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  // Klient-forespørsel-modal — åpnes fra kort-knappen "Be klient om tilgang"
  const [requestModal, setRequestModal] = useState<{
    open: boolean;
    platformKey: DataSourcePlatformKey | null;
    sourceLabel: string;
  }>({ open: false, platformKey: null, sourceLabel: '' });
  // Hver gang en request opprettes refresher vi tråden under hver source
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomAgentService.fetchDataSources(projectId);
      setData(result);
      if (!result) setError('Kunne ikke laste datakilder.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleTest = useCallback(async (sourceKey: string): Promise<void> => {
    setTestingKey(sourceKey);
    try {
      const result = await roleRoomAgentService.testDataSource(projectId, sourceKey);
      if (!result) {
        setError(`Test av ${sourceKey} returnerte ingen respons.`);
      } else if (!result.success) {
        setError(`Test av ${sourceKey} feilet: ${result.error ?? 'ukjent feil'}`);
      }
      await load();
    } finally {
      setTestingKey(null);
    }
  }, [projectId, load]);

  const openConfigDialog = useCallback(async (source: DataSource, configKey: string): Promise<void> => {
    const existing = source.configs.find((c) => c.configKey === configKey);
    setConfigDialog({ source, configKey });
    setConfigValue(existing?.configValue ?? '');
    setConfigLabel(existing?.displayLabel ?? '');
    setPickerCandidates(null);
    setPickerError(null);

    // Hvis dette er en Google-platform, hent picker-kandidater
    const googlePlatforms: DataSource['key'][] = ['google_analytics', 'google_business', 'google_search_console', 'youtube'];
    if (googlePlatforms.includes(source.key)) {
      setPickerLoading(true);
      try {
        const result = await roleRoomAgentService.discoverGoogleProperties(source.key as any);
        if (result?.items) {
          setPickerCandidates(result.items);
        } else if (result?.error) {
          setPickerError(result.error);
        }
      } finally {
        setPickerLoading(false);
      }
    }
  }, []);

  const handleSaveConfig = useCallback(async (): Promise<void> => {
    if (!configDialog) return;
    if (!configValue.trim()) {
      setError('Verdi kan ikke være tom.');
      return;
    }
    setSavingConfig(true);
    try {
      const ok = await roleRoomAgentService.configureDataSource({
        projectId,
        platform: configDialog.source.key,
        configKey: configDialog.configKey,
        configValue: configValue.trim(),
        displayLabel: configLabel.trim() || undefined,
      });
      if (!ok) {
        setError('Kunne ikke lagre konfigurasjon.');
        return;
      }
      setConfigDialog(null);
      await load();
    } finally {
      setSavingConfig(false);
    }
  }, [configDialog, configValue, configLabel, projectId, load]);

  const grouped = useMemo(() => {
    if (!data) return new Map<DataSource['group'], DataSource[]>();
    const out = new Map<DataSource['group'], DataSource[]>();
    for (const s of data.sources) {
      const list = out.get(s.group) ?? [];
      list.push(s);
      out.set(s.group, list);
    }
    return out;
  }, [data]);

  if (loading && !data) {
    return <LoadingSkeleton variant="list" />;
  }

  if (!data) {
    return (
      <ErrorAlert
        message={error ?? 'Kunne ikke laste datakilder.'}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <Box>
      {/* Bridge til Kontoer-fanen — datakilder håndterer KPI-henting,
          mens den juridiske konto-tilgangen (OAuth-invite, business
          manager-tildeling) bor i Kontoer-fanen. To-stegs-modell.       */}
      <Alert
        severity="info"
        icon={false}
        sx={{
          mb: 1.4,
          py: 0.7,
          bgcolor: 'rgba(96,165,250,0.08)',
          border: '1px solid rgba(96,165,250,0.2)',
          color: 'rgba(226,232,240,0.78)',
          fontSize: '0.78rem',
          '& .MuiAlert-message': { py: 0.4 },
        }}
      >
        <strong style={{ color: '#bfdbfe' }}>To-stegs-modell:</strong> Først kobler du klient-konto
        i <strong>Kontoer-fanen</strong> (OAuth-invite, business manager). Her i Datakilder
        konfigurerer du KPI-henting (property-ID-er, OAuth-scopes for analytics) — én plattform kan
        ha begge deler.
      </Alert>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
        <Stack spacing={0.2}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>
            Datakilder
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.84rem' }}>
            {data.verifiedCount} av {data.sourceCount} kilder er verifisert og klare for KPI-henting.
          </Typography>
        </Stack>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          sx={{ textTransform: 'none', color: '#cbd5e1' }}
        >
          Oppdater
        </Button>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mb: 1.4, bgcolor: 'rgba(251,191,36,0.1)' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {/* Klient-korrespondanse-tråd: viser pending requests for hele Datakilder-fanen */}
      <Box key={`thread-${threadRefreshKey}`} sx={{ mb: 1.6, p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.15)' }}>
        <ClientRequestsThread projectId={projectId} contextArea="data_sources" emptyMode="hide" />
      </Box>

      <Stack spacing={2}>
        {(['social', 'analytics', 'local', 'video', 'professional'] as const).map((group) => {
          const sources = grouped.get(group);
          if (!sources || sources.length === 0) return null;
          return (
            <Box key={group}>
              <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                {GROUP_LABEL[group]}
              </Typography>
              <Stack spacing={0.8}>
                {sources.map((source) => (
                  <DataSourceCard
                    key={source.key}
                    source={source}
                    testing={testingKey === source.key}
                    onTest={() => void handleTest(source.key)}
                    onConfigure={(configKey) => openConfigDialog(source, configKey)}
                    onRequestClientAccess={() => setRequestModal({
                      open: true,
                      platformKey: mapToOnboardingKey(source.key),
                      sourceLabel: source.label,
                    })}
                  />
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      {requestModal.platformKey ? (
        <ClientRequestModal
          open={requestModal.open}
          onClose={() => setRequestModal((p) => ({ ...p, open: false }))}
          projectId={projectId}
          kind="data_source_access"
          contextArea="data_sources"
          contextKey={requestModal.platformKey}
          platformKey={requestModal.platformKey}
          onCreated={() => setThreadRefreshKey((k) => k + 1)}
        />
      ) : null}

      {/* Config-dialog */}
      <Dialog
        open={configDialog !== null}
        onClose={() => setConfigDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0b1226', color: '#f8fafc' } }}
      >
        <DialogTitle>
          Konfigurer {configDialog?.source.label}
        </DialogTitle>
        <DialogContent>
          {configDialog ? (() => {
            const meta = CONFIG_KEY_META[configDialog.configKey] ?? {
              label: configDialog.configKey,
              placeholder: '',
              helperText: '',
            };
            return (
              <Stack spacing={1.6} sx={{ mt: 0.6 }}>
                {/* Hvis picker har kandidater, vis dropdown; ellers text-input fallback */}
                {pickerLoading ? (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                    <CircularProgress size={16} />
                    <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.84rem' }}>
                      Henter tilgjengelige {meta.label.toLowerCase()}…
                    </Typography>
                  </Stack>
                ) : pickerCandidates && pickerCandidates.length > 0 ? (
                  <>
                    <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.82rem' }}>
                      Velg fra Google-kontoer du har tilgang til:
                    </Typography>
                    <Select
                      value={configValue}
                      onChange={(e) => setConfigValue(String(e.target.value))}
                      fullWidth
                      displayEmpty
                      sx={{
                        color: '#f8fafc',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
                      }}
                    >
                      <MenuItem value="" disabled>Velg…</MenuItem>
                      {pickerCandidates.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          <Stack>
                            <Typography sx={{ fontWeight: 600 }}>{c.label}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                              ID: {c.id}
                              {c.meta?.subscribers ? ` · ${Number(c.meta.subscribers).toLocaleString('nb-NO')} subs` : ''}
                            </Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                    <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem' }}>
                      Eller skriv inn ID-en manuelt nedenfor.
                    </Typography>
                  </>
                ) : pickerError ? (
                  <Alert
                    severity="warning"
                    sx={{ bgcolor: 'rgba(251,191,36,0.1)' }}
                  >
                    <strong>Picker utilgjengelig:</strong> {pickerError}
                    <Typography sx={{ fontSize: '0.78rem', mt: 0.4 }}>
                      Du kan fortsatt skrive inn ID-en manuelt under.
                    </Typography>
                  </Alert>
                ) : null}

                <TextField
                  label={meta.label}
                  placeholder={meta.placeholder}
                  helperText={meta.helperText}
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  fullWidth
                  autoFocus={!pickerCandidates}
                  variant="outlined"
                  sx={{
                    '& .MuiInputBase-input': { color: '#f8fafc' },
                    '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
                    '& .MuiFormHelperText-root': { color: 'rgba(226,232,240,0.55)' },
                  }}
                />
                <TextField
                  label="Visningslabel (valgfri)"
                  placeholder="f.eks. 'Hovednettside' eller 'Oslo-restauranten'"
                  value={configLabel}
                  onChange={(e) => setConfigLabel(e.target.value)}
                  fullWidth
                  variant="outlined"
                  sx={{
                    '& .MuiInputBase-input': { color: '#f8fafc' },
                    '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
                  }}
                />
              </Stack>
            );
          })() : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialog(null)} sx={{ color: '#cbd5e1' }}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveConfig()}
            disabled={savingConfig || !configValue.trim()}
            startIcon={savingConfig ? <CircularProgress size={12} /> : null}
            sx={{ background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)' }}
          >
            {savingConfig ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Per-source kort
// ─────────────────────────────────────────────────────────────────────

interface DataSourceCardProps {
  source: DataSource;
  testing: boolean;
  onTest: () => void;
  onConfigure: (configKey: string) => void;
  onRequestClientAccess: () => void;
}

/** Map source.key (DataSource['key']) til DataSourcePlatformKey-typen
 *  som dataSourceClientOnboarding.ts forventer. Returnerer null for
 *  platforms vi ennå ikke har e-post-mal for. */
function mapToOnboardingKey(sourceKey: string): DataSourcePlatformKey | null {
  const allowed: DataSourcePlatformKey[] = [
    'google_analytics', 'google_business', 'google_search_console',
    'youtube', 'instagram', 'facebook', 'linkedin', 'tiktok',
  ];
  return allowed.includes(sourceKey as DataSourcePlatformKey)
    ? (sourceKey as DataSourcePlatformKey)
    : null;
}

const DataSourceCard: React.FC<DataSourceCardProps> = ({ source, testing, onTest, onConfigure, onRequestClientAccess }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = STATE_META[source.state];
  const Icon = meta.Icon;

  const handleAction = useCallback((): void => {
    switch (source.nextAction.type) {
      case 'connect_oauth':
        try {
          window.open(source.nextAction.url, '_blank', 'width=600,height=720,noopener');
        } catch {
          // popup blocked
        }
        break;
      case 'refresh_token':
        // Re-trigger OAuth — typisk samme URL
        // (vi har ikke denne i state ennå, så bruker connected-state-link)
        break;
      case 'test_connection':
        onTest();
        break;
      case 'configure':
        if (source.nextAction.missingKeys[0]) {
          onConfigure(source.nextAction.missingKeys[0]);
        }
        break;
      default:
        break;
    }
  }, [source, onTest, onConfigure]);

  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 2,
        border: `1px solid ${meta.color}33`,
        bgcolor: 'rgba(15,23,42,0.5)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: meta.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color: meta.color, fontSize: 18 }} />
        </Box>
        <Stack spacing={0.1} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.6}>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
              {source.label}
            </Typography>
            <Chip
              size="small"
              label={meta.label}
              sx={{
                bgcolor: meta.bg,
                color: meta.color,
                height: 18,
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            />
          </Stack>
          {source.connection?.profile?.name || source.connection?.profile?.email ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem' }}>
              Koblet som {source.connection.profile.name ?? source.connection.profile.email}
            </Typography>
          ) : source.errorMessage ? (
            <Typography sx={{ color: '#fca5a5', fontSize: '0.74rem' }}>
              {source.errorMessage}
            </Typography>
          ) : null}
        </Stack>

        {/* Hovedhandling */}
        {source.nextAction.type === 'none' ? (
          <Tooltip title="Test forbindelsen igjen">
            <Button
              size="small"
              startIcon={testing ? <CircularProgress size={12} /> : <RefreshIcon fontSize="small" />}
              onClick={onTest}
              disabled={testing}
              sx={{ textTransform: 'none', color: '#cbd5e1', fontSize: '0.76rem' }}
            >
              Test
            </Button>
          </Tooltip>
        ) : (
          <Button
            size="small"
            variant="outlined"
            onClick={handleAction}
            disabled={testing}
            startIcon={testing && source.nextAction.type === 'test_connection' ? <CircularProgress size={12} /> : null}
            sx={{
              textTransform: 'none',
              fontSize: '0.78rem',
              color: meta.color,
              borderColor: `${meta.color}66`,
              '&:hover': { borderColor: meta.color, bgcolor: meta.bg },
            }}
          >
            {testing && source.nextAction.type === 'test_connection'
              ? 'Tester…'
              : source.nextAction.type === 'refresh_token'
                ? 'Re-autoriser'
                : source.nextAction.label}
          </Button>
        )}

        {/* "Be klient om tilgang" — vises kun for sources som har e-post-mal og som
            er i en state der klienten faktisk må gjøre noe. */}
        {mapToOnboardingKey(source.key) && source.state !== 'verified' ? (
          <Tooltip title="Send ferdig norsk e-post med trinnvise instrukser til klienten">
            <Button
              size="small"
              startIcon={<MailIcon fontSize="small" />}
              onClick={onRequestClientAccess}
              sx={{
                textTransform: 'none',
                fontSize: '0.74rem',
                color: '#22d3ee',
                '&:hover': { bgcolor: 'rgba(34,211,238,0.08)' },
              }}
            >
              Be klient
            </Button>
          </Tooltip>
        ) : null}

        {/* Expand-knapp */}
        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ color: 'rgba(226,232,240,0.5)' }}
        >
          <ExpandMoreIcon
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </IconButton>
      </Stack>

      {/* Expanded detaljer: scopes, configs, last sync */}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ mt: 1.4, pl: 5.2 }}>
          {source.connection?.scopes && source.connection.scopes.length > 0 ? (
            <Box sx={{ mb: 0.8 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem', mb: 0.3 }}>
                OAuth-scopes:
              </Typography>
              <Stack direction="row" spacing={0.3} flexWrap="wrap" useFlexGap>
                {source.connection.scopes.map((scope) => (
                  <Chip
                    key={scope}
                    size="small"
                    label={scope.replace(/^https?:\/\/[^/]+\//, '')}
                    sx={{ height: 16, fontSize: '0.64rem', bgcolor: 'rgba(148,163,184,0.14)', color: 'rgba(226,232,240,0.7)', fontFamily: 'monospace' }}
                  />
                ))}
              </Stack>
            </Box>
          ) : null}

          {source.configs.length > 0 ? (
            <Box sx={{ mb: 0.8 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem', mb: 0.3 }}>
                Konfigurasjon:
              </Typography>
              <Stack spacing={0.4}>
                {source.configs.map((c) => {
                  const m = CONFIG_KEY_META[c.configKey];
                  return (
                    <Stack
                      key={c.id}
                      direction="row"
                      alignItems="center"
                      spacing={0.6}
                      sx={{
                        p: 0.5,
                        borderRadius: 1,
                        bgcolor: 'rgba(15,23,42,0.7)',
                      }}
                    >
                      <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ color: '#cbd5e1', fontSize: '0.74rem', fontWeight: 600 }}>
                          {m?.label ?? c.configKey}
                          {c.displayLabel ? <Typography component="span" sx={{ color: 'rgba(226,232,240,0.5)', fontWeight: 400, fontSize: '0.7rem' }}> · {c.displayLabel}</Typography> : null}
                        </Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.configValue}
                        </Typography>
                      </Stack>
                      {c.validatedAt ? (
                        <Tooltip title={`Verifisert ${new Date(c.validatedAt).toLocaleString('nb-NO')}`}>
                          <VerifiedIcon sx={{ color: '#34d399', fontSize: 14 }} />
                        </Tooltip>
                      ) : c.lastTestResult && !c.lastTestResult.success ? (
                        <Tooltip title={c.lastTestResult.error ?? 'Test feilet'}>
                          <ErrorIcon sx={{ color: '#f87171', fontSize: 14 }} />
                        </Tooltip>
                      ) : null}
                      <IconButton size="small" onClick={() => onConfigure(c.configKey)} sx={{ color: 'rgba(226,232,240,0.5)' }}>
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          ) : null}

          {source.connection?.lastRefreshedAt ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
              Token refreshed: {new Date(source.connection.lastRefreshedAt).toLocaleString('nb-NO')}
            </Typography>
          ) : null}
          {source.connection?.expiresAt ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
              Utløper: {new Date(source.connection.expiresAt).toLocaleString('nb-NO')}
            </Typography>
          ) : null}
        </Box>
      </Collapse>
    </Box>
  );
};

export default DataSourcesPanel;
