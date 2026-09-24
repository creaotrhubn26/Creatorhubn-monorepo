import React from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import CloudDownloadOutlined from '@mui/icons-material/CloudDownloadOutlined';
import LockClockOutlined from '@mui/icons-material/LockClockOutlined';
import { apiFetch, apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';

type MediaAccess = {
  state: 'active' | 'download_only' | 'expired';
  canCreate: boolean;
  canDownload: boolean;
  retentionGuaranteed: true;
  automaticDeletion: false;
  downloadOnlyUntil: string | null;
  daysRemaining: number | null;
  canExport?: boolean;
  canManageSubscription?: boolean;
};

export default function CreatorHubMediaAccessBanner({ projectId }: { projectId: string }) {
  const [access, setAccess] = React.useState<MediaAccess | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-access`)
      .then((value) => { if (live) setAccess(value as MediaAccess); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [projectId]);

  if (!access) return null;

  const deadline = access.downloadOnlyUntil
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(access.downloadOnlyUntil))
    : null;

  const downloadManifest = async () => {
    setDownloading(true); setError(null);
    try {
      const response = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/media-export/manifest`, { method: 'POST' });
      if (!response.ok) throw new Error(response.status === 403 ? 'Nedlastingsvinduet er utløpt.' : `Eksport feilet (HTTP ${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `creatorhub-${projectId}-media-manifest.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke laste ned medieregisteret.');
    } finally { setDownloading(false); }
  };

  if (access.state === 'active') {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between" spacing={1} sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 1.5,
          bgcolor: 'rgba(34,197,94,.055)', border: '1px solid rgba(34,197,94,.17)' }}>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: ws.text }}>CreatorHub medieregister er aktivt</Typography>
          <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>Stabile fil-ID-er, checksum og nedlastingssti · ingen automatisk sletting</Typography>
          {error && <Typography sx={{ color: '#fca5a5', fontSize: 12, mt: .5 }}>{error}</Typography>}
        </Box>
        {access.canExport !== false && (
          <Button size="small" variant="text" startIcon={<CloudDownloadOutlined />} disabled={downloading}
            onClick={() => void downloadManifest()} sx={{ color: ws.text, whiteSpace: 'nowrap' }}>
            {downloading ? 'Forbereder…' : 'Eksporter register'}
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Alert severity={access.state === 'expired' ? 'error' : 'warning'} icon={<LockClockOutlined />}
      sx={{ mb: 2, bgcolor: access.state === 'expired' ? 'rgba(239,68,68,.09)' : 'rgba(245,158,11,.09)', border: `1px solid ${access.state === 'expired' ? 'rgba(239,68,68,.28)' : 'rgba(245,158,11,.28)'}` }}
      action={<Stack direction="row" spacing={1}>
        {access.canExport !== false && <Button size="small" variant="outlined" startIcon={<CloudDownloadOutlined />} disabled={!access.canDownload || downloading}
          onClick={() => void downloadManifest()} sx={{ color: ws.text, borderColor: ws.border }}>
          {downloading ? 'Forbereder…' : 'Last ned medieregister'}
        </Button>}
        {access.canManageSubscription && <Button size="small" variant="contained" href="/pricing" sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>Reaktiver</Button>}
      </Stack>}>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>
          {access.state === 'expired' ? 'Nedlastingsvinduet er utløpt' : `${access.daysRemaining ?? 0} dager igjen til å laste ned`}
        </Typography>
        <Typography sx={{ fontSize: 12.5 }}>
          {access.state === 'expired'
            ? 'Mediene er fortsatt trygt lagret og slettes ikke automatisk. Reaktiver CreatorHub for å åpne dem igjen.'
            : `Nye opplastinger og endringer er satt på pause. Alt kan lastes ned frem til ${deadline}. Mediene slettes ikke automatisk.`}
        </Typography>
        {error && <Typography sx={{ color: '#fca5a5', fontSize: 12, mt: .5 }}>{error}</Typography>}
      </Box>
    </Alert>
  );
}
