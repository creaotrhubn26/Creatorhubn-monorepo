/**
 * InnstillingerTab — «Innstillinger»-flaten i AdminWorkspace.
 *
 * EmptyState-en foreslo «en gruppert settings-flate som peker til
 * eksisterende modul-innstillinger» — altså en lenkesamling. Det er for
 * lite: spørsmålet man faktisk kommer hit med er «hva er koblet på, og
 * virker det». Backend (/api/admin-room/workspace/settings) sjekker
 * derfor status på integrasjonene live, og lagrer workspace-preferanser
 * i admin_workspace_settings (migrasjon 0350).
 *
 * Preferansene styrer ekte oppførsel i flaten (default-produkt, om
 * teamchat-kolonnen er åpen, polling-intervall) — ikke lagrede verdier
 * ingenting leser.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import {
  workspaceModulesApi,
  type WorkspaceIntegrationStatus,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import { PanelError, PanelLoading, SectionHeading } from './panelKit';

/**
 * Workspace-preferanser. Nøkkelen `workspace_prefs` speiles i
 * localStorage av AdminWorkspace, slik at oppstart ikke må vente på et
 * nettverkskall før layouten settes.
 */
export interface WorkspacePrefs {
  defaultProduct: 'roleroom' | 'leadgrid';
  teamchatOpenByDefault: boolean;
  notificationPollSeconds: number;
}

export const WORKSPACE_PREFS_KEY = 'workspace_prefs';
export const WORKSPACE_PREFS_STORAGE_KEY = 'admin_workspace_prefs';

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  defaultProduct: 'roleroom',
  teamchatOpenByDefault: false,
  notificationPollSeconds: 60,
};

export function normalizeWorkspacePrefs(raw: unknown): WorkspacePrefs {
  const v = (raw ?? {}) as Partial<WorkspacePrefs>;
  const poll = Number(v.notificationPollSeconds);
  return {
    defaultProduct: v.defaultProduct === 'leadgrid' ? 'leadgrid' : 'roleroom',
    teamchatOpenByDefault: v.teamchatOpenByDefault === true,
    notificationPollSeconds:
      Number.isFinite(poll) && poll >= 15 && poll <= 600 ? Math.round(poll) : 60,
  };
}

/** Leser speilet fra localStorage — brukes ved oppstart, før API-svaret. */
export function readStoredWorkspacePrefs(): WorkspacePrefs {
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACE_PREFS;
    return normalizeWorkspacePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_WORKSPACE_PREFS;
  }
}

const STATUS_VISUAL: Record<
  WorkspaceIntegrationStatus['status'],
  { color: string; icon: JSX.Element; label: string }
> = {
  connected: {
    color: '#22c55e',
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
    label: 'Koblet til',
  },
  disconnected: {
    color: BRAND.textDim,
    icon: <HighlightOffIcon sx={{ fontSize: 16 }} />,
    label: 'Ikke koblet',
  },
  unknown: {
    color: '#fbbf24',
    icon: <HelpOutlineIcon sx={{ fontSize: 16 }} />,
    label: 'Ukjent',
  },
};

const POLL_OPTIONS = [30, 60, 120, 300];

interface InnstillingerTabProps {
  onPrefsChange: (prefs: WorkspacePrefs) => void;
}

export function InnstillingerTab({ onPrefsChange }: InnstillingerTabProps) {
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_WORKSPACE_PREFS);
  const [integrations, setIntegrations] = useState<WorkspaceIntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await workspaceModulesApi.settings();
        if (cancelled) return;
        const next = normalizeWorkspacePrefs(data.settings?.[WORKSPACE_PREFS_KEY]);
        setPrefs(next);
        setIntegrations(data.integrations ?? []);
        onPrefsChange(next);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Kunne ikke laste innstillinger');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onPrefsChange er stabil (useCallback i parent) — bevisst utelatt
    // for å unngå re-fetch ved hver render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    async (next: WorkspacePrefs) => {
      setPrefs(next);
      onPrefsChange(next);
      // Speil lokalt med én gang så neste oppstart ikke venter på nettet.
      try {
        localStorage.setItem(WORKSPACE_PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      try {
        await workspaceModulesApi.saveSetting(
          WORKSPACE_PREFS_KEY,
          next as unknown as Record<string, unknown>,
        );
        setSavedAt(Date.now());
        setError(null);
      } catch (err) {
        setError((err as Error).message || 'Kunne ikke lagre innstillingen');
      }
    },
    [onPrefsChange],
  );

  if (loading) return <PanelLoading />;

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      {error ? <PanelError message={error} onClose={() => setError(null)} /> : null}

      {/* Integrasjoner */}
      <Box>
        <SectionHeading icon={<HubOutlinedIcon />} label="Integrasjoner" />
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.8rem', mb: 1.5 }}>
          Live status lest fra databasen — ikke en statisk liste.
        </Typography>
        <Stack spacing={0.75}>
          {integrations.map((i) => {
            const visual = STATUS_VISUAL[i.status];
            return (
              <Stack
                key={i.key}
                direction="row"
                alignItems="center"
                spacing={1.25}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: BRAND.panelBg,
                  border: `1px solid ${BRAND.border}`,
                }}
              >
                <Box sx={{ color: visual.color, display: 'flex' }}>{visual.icon}</Box>
                <Typography sx={{ flex: 1, color: BRAND.text, fontSize: '0.86rem' }}>
                  {i.label}
                </Typography>
                {i.detail ? (
                  <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
                    {i.detail}
                  </Typography>
                ) : null}
                <Chip
                  label={visual.label}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    bgcolor: `${visual.color}22`,
                    color: visual.color,
                  }}
                />
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: BRAND.border }} />

      {/* Preferanser */}
      <Box>
        <SectionHeading icon={<TuneOutlinedIcon />} label="Workspace-preferanser" />

        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: BRAND.text, fontSize: '0.88rem', fontWeight: 600 }}>
                Standard produkt
              </Typography>
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
                Hvilket produkt workspacet åpner i når URL-en ikke sier noe annet.
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              value={prefs.defaultProduct}
              onChange={(e) =>
                void persist({
                  ...prefs,
                  defaultProduct: e.target.value as WorkspacePrefs['defaultProduct'],
                })
              }
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="roleroom">The Role Room</MenuItem>
              <MenuItem value="leadgrid">Leadgrid</MenuItem>
            </TextField>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: BRAND.text, fontSize: '0.88rem', fontWeight: 600 }}>
                Åpne teamchat-kolonnen
              </Typography>
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
                Kolonnen tar 320 px. Av som standard; skru på hvis du bruker den daglig.
              </Typography>
            </Box>
            <Switch
              checked={prefs.teamchatOpenByDefault}
              onChange={(e) =>
                void persist({ ...prefs, teamchatOpenByDefault: e.target.checked })
              }
              inputProps={{ 'aria-label': 'Åpne teamchat-kolonnen som standard' }}
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: BRAND.text, fontSize: '0.88rem', fontWeight: 600 }}>
                Varsel-oppdatering
              </Typography>
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
                Hvor ofte innboksen henter nye varsler.
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              value={prefs.notificationPollSeconds}
              onChange={(e) =>
                void persist({ ...prefs, notificationPollSeconds: Number(e.target.value) })
              }
              sx={{ minWidth: 160 }}
            >
              {POLL_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s < 60 ? `${s} sekunder` : `${s / 60} minutt${s === 60 ? '' : 'er'}`}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>

        {savedAt ? (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 2 }}>
            <CheckCircleOutlineIcon sx={{ color: '#22c55e', fontSize: 16 }} />
            <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>Lagret</Typography>
          </Stack>
        ) : null}
      </Box>

      <Divider sx={{ borderColor: BRAND.border }} />

      <Box>
        <SectionHeading icon={<SettingsOutlinedIcon />} label="Modul-innstillinger" />
        <Typography sx={{ color: BRAND.textMuted, fontSize: '0.82rem' }}>
          Innstillinger som gjelder ett produkt — klientportal, godkjenninger, onboarding,
          varslingsmaler — bor i modulen de tilhører, siden de er en del av arbeidsflyten der.
          Denne flaten dekker workspacet selv og tilstanden på integrasjonene.
        </Typography>
      </Box>
    </Stack>
  );
}

export default InnstillingerTab;
