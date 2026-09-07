/**
 * panelKit — små delte byggeklosser for AdminWorkspace-flatene.
 *
 * Poenget er konsistent tilstands-håndtering: alle flatene skiller
 * eksplisitt mellom «laster», «feilet», «kilde utilgjengelig» og
 * «faktisk tomt». Det var mangelen på nettopp det skillet som gjorde at
 * innboksen kunne påstå «Alt klart» mens backend var nede.
 */

import type { ReactNode } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { BRAND } from './brand';

export function PanelLoading() {
  return (
    <Stack alignItems="center" sx={{ py: 8 }}>
      <CircularProgress sx={{ color: BRAND.accent }} />
    </Stack>
  );
}

export function PanelError({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <Alert
      severity="error"
      onClose={onClose}
      sx={{
        bgcolor: 'rgba(220, 38, 38, 0.16)',
        color: '#fecaca',
        border: '1px solid rgba(220, 38, 38, 0.4)',
      }}
    >
      {message}
    </Alert>
  );
}

/**
 * Kilder som ikke kunne spørres (tabell mangler i dette miljøet).
 * Vises som en egen melding, aldri som en tom liste — brukeren skal vite
 * at noe MANGLER, ikke tro at det ikke finnes noe.
 */
export function UnavailableSources({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null;
  return (
    <Alert
      icon={<InfoOutlinedIcon fontSize="small" />}
      severity="warning"
      sx={{
        bgcolor: 'rgba(251, 191, 36, 0.12)',
        color: '#fde68a',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        fontSize: '0.82rem',
      }}
    >
      Kunne ikke lese {sources.length === 1 ? 'kilden' : 'kildene'}{' '}
      <code>{sources.join(', ')}</code> — listen under er ufullstendig. Kjør migrasjonene
      for dette miljøet.
    </Alert>
  );
}

export function PanelEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 8, textAlign: 'center' }}>
      <Box sx={{ color: BRAND.accent, opacity: 0.6, '& svg': { fontSize: 40 } }}>{icon}</Box>
      <Typography sx={{ color: BRAND.text, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.84rem', maxWidth: 460 }}>
        {description}
      </Typography>
      {action}
    </Stack>
  );
}

export function SectionHeading({ icon, label, count }: { icon?: ReactNode; label: string; count?: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
      {icon ? <Box sx={{ color: BRAND.accent, display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box> : null}
      <Typography
        sx={{
          color: BRAND.textMuted,
          fontWeight: 700,
          fontSize: '0.76rem',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Typography>
      {typeof count === 'number' ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.74rem' }}>{count}</Typography>
      ) : null}
    </Stack>
  );
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
