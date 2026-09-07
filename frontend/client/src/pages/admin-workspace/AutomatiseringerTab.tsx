/**
 * AutomatiseringerTab — «Automatiseringer»-flaten i AdminWorkspace.
 *
 * EmptyState-en sa «administreres via GitHub Actions og Render» og
 * foreslo enten en n8n-lignende builder eller en lese-skjerm. Den
 * antakelsen var utdatert: tabellene `automations` og `automation_runs`
 * finnes (migrasjon 245), og /api/admin/automations har allerede
 * list/toggle/run/runs. Flaten kobler seg derfor rett på dem.
 *
 * Vi bygger ikke en trigger→handling-builder her. Å skru av/på, kjøre
 * manuelt og se hvorfor siste kjøring feilet er det som faktisk trengs
 * i drift; å definere nye automatiseringer er en sjeldnere handling som
 * fortsatt hører hjemme i kode.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';

import {
  workspaceAutomationsApi,
  type WorkspaceAutomation,
  type WorkspaceAutomationRun,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import { PanelEmpty, PanelError, PanelLoading, formatDateTime } from './panelKit';

const TRIGGER_LABEL: Record<string, string> = {
  cron: 'Tidsplan',
  webhook: 'Webhook',
  event: 'Hendelse',
  manual: 'Manuell',
};

const STATUS_COLOR: Record<string, string> = {
  success: '#22c55e',
  failed: '#ef4444',
  running: '#22d3ee',
};

function triggerSummary(a: WorkspaceAutomation): string {
  const cfg = a.triggerConfig ?? {};
  if (a.triggerType === 'cron' && typeof cfg.schedule === 'string') return cfg.schedule;
  if (a.triggerType === 'event' && typeof cfg.eventType === 'string') return cfg.eventType;
  return TRIGGER_LABEL[a.triggerType] ?? a.triggerType;
}

export function AutomatiseringerTab() {
  const [items, setItems] = useState<WorkspaceAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, WorkspaceAutomationRun[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await workspaceAutomationsApi.list());
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste automatiseringer');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = useCallback(async (a: WorkspaceAutomation) => {
    setBusyId(a.id);
    // Optimistisk — en bryter som henger til serveren svarer føles ødelagt.
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, isEnabled: !x.isEnabled } : x)));
    try {
      await workspaceAutomationsApi.toggle(a.id);
    } catch (err) {
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, isEnabled: a.isEnabled } : x)));
      setError((err as Error).message || 'Kunne ikke endre status');
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleRun = useCallback(async (a: WorkspaceAutomation) => {
    setBusyId(a.id);
    try {
      await workspaceAutomationsApi.run(a.id);
      await load();
      // Er historikken åpen skal den vise kjøringen du nettopp startet.
      if (expandedId === a.id) {
        const fresh = await workspaceAutomationsApi.runs(a.id);
        setRuns((prev) => ({ ...prev, [a.id]: fresh }));
      }
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke kjøre automatiseringen');
    } finally {
      setBusyId(null);
    }
  }, [load, expandedId]);

  const handleExpand = useCallback(async (a: WorkspaceAutomation) => {
    if (expandedId === a.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(a.id);
    if (!runs[a.id]) {
      try {
        const fresh = await workspaceAutomationsApi.runs(a.id);
        setRuns((prev) => ({ ...prev, [a.id]: fresh }));
      } catch (err) {
        setError((err as Error).message || 'Kunne ikke hente kjørings-historikk');
      }
    }
  }, [expandedId, runs]);

  if (loading) return <PanelLoading />;

  return (
    <Stack spacing={2}>
      {error ? <PanelError message={error} onClose={() => setError(null)} /> : null}

      {items.length === 0 ? (
        <PanelEmpty
          icon={<AutoFixHighOutlinedIcon />}
          title="Ingen automatiseringer registrert"
          description="Automatiseringer defineres i kode og lagres i automations-tabellen. Når de finnes kan du skru dem av og på, kjøre dem manuelt og se historikken her."
        />
      ) : (
        <Stack spacing={1}>
          {items.map((a) => {
            const expanded = expandedId === a.id;
            const successRate =
              a.totalRuns > 0 ? Math.round((a.successfulRuns / a.totalRuns) * 100) : null;
            return (
              <Box
                key={a.id}
                sx={{
                  borderRadius: 2,
                  bgcolor: BRAND.panelBg,
                  border: `1px solid ${BRAND.border}`,
                  borderLeft: `3px solid ${a.isEnabled ? '#22c55e' : 'rgba(241,245,249,0.2)'}`,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.75 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                      <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
                        {a.name}
                      </Typography>
                      <Chip
                        icon={
                          a.triggerType === 'cron' ? (
                            <ScheduleOutlinedIcon sx={{ fontSize: 12 }} />
                          ) : (
                            <BoltOutlinedIcon sx={{ fontSize: 12 }} />
                          )
                        }
                        label={triggerSummary(a)}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.64rem',
                          bgcolor: 'rgba(167,139,250,0.14)',
                          color: '#ddd6fe',
                          fontFamily: a.triggerType === 'cron' ? 'monospace' : undefined,
                        }}
                      />
                      {a.lastRunStatus ? (
                        <Chip
                          label={a.lastRunStatus}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.64rem',
                            bgcolor: `${STATUS_COLOR[a.lastRunStatus] ?? BRAND.textDim}22`,
                            color: STATUS_COLOR[a.lastRunStatus] ?? BRAND.textMuted,
                          }}
                        />
                      ) : null}
                    </Stack>

                    {a.description ? (
                      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.8rem', mt: 0.25 }}>
                        {a.description}
                      </Typography>
                    ) : null}

                    <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                      <Typography sx={{ color: BRAND.textDim, fontSize: '0.74rem' }}>
                        {a.totalRuns} kjøringer
                      </Typography>
                      {successRate !== null ? (
                        <Typography
                          sx={{
                            color: successRate >= 90 ? BRAND.textDim : '#fcd34d',
                            fontSize: '0.74rem',
                          }}
                        >
                          {successRate}% vellykket
                        </Typography>
                      ) : null}
                      {a.lastRunAt ? (
                        <Typography sx={{ color: BRAND.textDim, fontSize: '0.74rem' }}>
                          Sist {formatDateTime(a.lastRunAt)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>

                  <Tooltip title="Kjør nå">
                    <span>
                      <IconButton
                        size="small"
                        disabled={busyId === a.id}
                        onClick={() => void handleRun(a)}
                        sx={{ color: BRAND.accent }}
                      >
                        {busyId === a.id ? (
                          <CircularProgress size={16} sx={{ color: BRAND.accent }} />
                        ) : (
                          <PlayArrowOutlinedIcon sx={{ fontSize: 19 }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip title={a.isEnabled ? 'Skru av' : 'Skru på'}>
                    <Switch
                      size="small"
                      checked={a.isEnabled}
                      onChange={() => void handleToggle(a)}
                      inputProps={{ 'aria-label': `Skru ${a.isEnabled ? 'av' : 'på'} ${a.name}` }}
                    />
                  </Tooltip>

                  <IconButton
                    size="small"
                    onClick={() => void handleExpand(a)}
                    aria-label="Vis historikk"
                    sx={{
                      color: BRAND.textDim,
                      transform: expanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms',
                    }}
                  >
                    <ExpandMoreIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>

                <Collapse in={expanded} unmountOnExit>
                  <Box sx={{ px: 1.75, pb: 1.75, borderTop: `1px solid ${BRAND.border}`, pt: 1.25 }}>
                    {!runs[a.id] ? (
                      <Stack alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={16} sx={{ color: BRAND.accent }} />
                      </Stack>
                    ) : runs[a.id].length === 0 ? (
                      <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
                        Ingen kjøringer registrert.
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {runs[a.id].slice(0, 10).map((run) => (
                          <Stack
                            key={run.id}
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ fontSize: '0.76rem' }}
                          >
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: STATUS_COLOR[run.status] ?? BRAND.textDim,
                                flexShrink: 0,
                              }}
                            />
                            <Typography sx={{ color: BRAND.textMuted, fontSize: '0.76rem', minWidth: 130 }}>
                              {formatDateTime(run.startedAt)}
                            </Typography>
                            <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem', minWidth: 60 }}>
                              {run.durationMs !== null ? `${run.durationMs} ms` : '—'}
                            </Typography>
                            {run.errorMessage ? (
                              <Typography
                                sx={{
                                  color: '#fca5a5',
                                  fontSize: '0.76rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={run.errorMessage}
                              >
                                {run.errorMessage}
                              </Typography>
                            ) : null}
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default AutomatiseringerTab;
