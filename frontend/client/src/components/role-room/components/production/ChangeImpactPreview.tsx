/**
 * Hva flyttingen koster, vist før valget tas.
 *
 * Henter /production-days/:dayId/impact og tegner resultatet. Komponenten
 * eier ingen mutasjon — den forteller bare hva som skjer, og sier fra til
 * dialogen når noe blokkerer, slik at lagreknappen kan stenges før feilen i
 * stedet for å forklare den etterpå.
 *
 * Alle states er tegnet: laster, uendret dato, ingen påvirkning, funn,
 * lesning som feiler, og dagen som ble flyttet av noen andre mens dialogen
 * sto åpen. De to siste er viktigst — uten dem ville en feilet spørring sett
 * ut som «ingen påvirkning», og et foreldet skjema ville overskrevet en
 * kollegas endring.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import UpdateIcon from '@mui/icons-material/Update';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import authSessionService from '../../services/authSessionService';

export type ImpactSeverity = 'blocking' | 'warning' | 'info';

export interface ChangeImpact {
  area: string;
  severity: ImpactSeverity;
  summary: string;
  action?: string;
  count: number;
}

interface ImpactResponse {
  from: string;
  to: string;
  impacts: ChangeImpact[];
  blocking: boolean;
  unchanged: boolean;
}

export interface ChangeImpactPreviewProps {
  projectId: string;
  dayId: string | null;
  /** Datoen dagen har i dag. Tom for en ny dag som ennå ikke er lagret. */
  currentDate: string | null;
  /** Datoen brukeren har skrevet inn. */
  targetDate: string;
  /** Sier fra når noe må ryddes før lagring er forsvarlig. */
  onBlockingChange?: (blocking: boolean) => void;
}

const SEVERITY_STYLE: Record<ImpactSeverity, { color: string; label: string }> = {
  blocking: { color: '#f87171', label: 'Må ryddes' },
  warning: { color: '#fbbf24', label: 'Sjekk' },
  info: { color: '#60a5fa', label: 'Til info' },
};

function SeverityIcon({ severity }: { severity: ImpactSeverity }) {
  const sx = { fontSize: 18, color: SEVERITY_STYLE[severity].color };
  if (severity === 'blocking') return <BlockIcon sx={sx} />;
  if (severity === 'warning') return <WarningAmberIcon sx={sx} />;
  return <InfoOutlinedIcon sx={sx} />;
}

export function ChangeImpactPreview({
  projectId,
  dayId,
  currentDate,
  targetDate,
  onBlockingChange,
}: ChangeImpactPreviewProps): JSX.Element | null {
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const shouldAsk = Boolean(dayId)
    && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    && targetDate !== (currentDate ?? '');

  const load = useCallback(async () => {
    if (!dayId || !shouldAsk) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/role-room/projects/${encodeURIComponent(projectId)}`
        + `/production-days/${encodeURIComponent(dayId)}/impact`
        + `?date=${encodeURIComponent(targetDate)}`,
        { headers: authSessionService.getAuthHeadersSync() },
      );
      if (!response.ok) throw new Error(String(response.status));
      setData(await response.json() as ImpactResponse);
    } catch {
      setFailed(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, dayId, targetDate, shouldAsk]);

  useEffect(() => {
    if (!shouldAsk) {
      setData(null);
      setFailed(false);
      return;
    }
    // Liten forsinkelse: datofeltet fyrer mens brukeren skriver.
    const timer = window.setTimeout(() => { void load(); }, 300);
    return () => window.clearTimeout(timer);
  }, [shouldAsk, load]);

  useEffect(() => {
    // En feilet lesning teller som blokkerende: vi vet ikke hva som brekker,
    // og da skal ingen kunne lagre i blinde. Det samme gjelder en dag som har
    // flyttet seg under føttene på oss — da bygger skjemaet på en dato som
    // ikke lenger finnes.
    const stale = Boolean(data && currentDate && data.from !== currentDate);
    onBlockingChange?.(failed || stale || Boolean(data?.blocking));
  }, [failed, data, currentDate, onBlockingChange]);

  // Serveren svarer med datoen dagen faktisk har nå. Er den en annen enn den
  // skjemaet ble åpnet med, har noen andre flyttet dagen i mellomtiden.
  const staleFrom = data && currentDate && data.from !== currentDate ? data.from : null;

  if (!shouldAsk) return null;

  if (loading && !data) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
        <CircularProgress size={14} sx={{ color: '#ce93d8' }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Sjekker hva flyttingen påvirker…
        </Typography>
      </Stack>
    );
  }

  if (failed) {
    return (
      <Alert severity="error" icon={<BlockIcon fontSize="small" />} sx={{ mt: 1 }}>
        Kunne ikke sjekke hva flyttingen påvirker. Lagring er stengt til vi vet
        konsekvensen.
      </Alert>
    );
  }

  if (staleFrom) {
    return (
      <Alert severity="warning" icon={<UpdateIcon fontSize="small" />} sx={{ mt: 1 }}>
        Dagen ble flyttet til {staleFrom} av noen andre mens dette skjemaet sto
        åpent. Lukk og åpne dagen på nytt, så du ikke overskriver endringen.
      </Alert>
    );
  }

  if (!data || data.unchanged) return null;

  if (data.impacts.length === 0) {
    return (
      <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="small" />} sx={{ mt: 1 }}>
        Ingenting annet henger på {data.from}. Flyttingen berører bare dagen selv.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, border: '1px solid rgba(255,255,255,0.12)' }}>
      <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
        Flytting fra {data.from} til {data.to} påvirker:
      </Typography>
      <Stack spacing={1}>
        {data.impacts.map((impact) => (
          <Stack key={`${impact.area}-${impact.severity}`} direction="row" spacing={1} alignItems="flex-start">
            <SeverityIcon severity={impact.severity} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {impact.summary}
              </Typography>
              {impact.action && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  {impact.action}
                </Typography>
              )}
            </Box>
            <Chip
              size="small"
              label={SEVERITY_STYLE[impact.severity].label}
              sx={{
                bgcolor: 'transparent',
                border: `1px solid ${SEVERITY_STYLE[impact.severity].color}`,
                color: SEVERITY_STYLE[impact.severity].color,
              }}
            />
          </Stack>
        ))}
      </Stack>
      {data.blocking && (
        <Typography variant="caption" sx={{ color: '#f87171', display: 'block', mt: 1.5 }}>
          Lagring er stengt til punktene merket «Må ryddes» er håndtert.
        </Typography>
      )}
    </Box>
  );
}

export default ChangeImpactPreview;
