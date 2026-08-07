import React from 'react';
import { Box, Button, Typography, CircularProgress, Alert, Stack, Paper } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

// Verktøy-panel som trigger de nye Google Workspace-integrasjonene ende-til-ende.
// Formål: (1) gjøre hvert forespurte OAuth-scope brukbart i appen, og (2) gi en
// synlig flate for Googles demo-video under OAuth-verifiseringen.
//   • YouTube Analytics (readonly)  → auth/yt-analytics.readonly
//   • YouTube-inntekter (monetary)  → auth/yt-analytics-monetary.readonly
//   • Drive-aktivitet               → auth/drive.activity.readonly
//   • Sheets-eksport                → auth/spreadsheets

type ToolKey = 'yt-analytics' | 'yt-revenue' | 'drive-activity' | 'sheets-export';

const TOOLS: { key: ToolKey; label: string; scope: string; run: () => Promise<unknown> }[] = [
  {
    key: 'yt-analytics',
    label: 'Hent YouTube-statistikk',
    scope: 'yt-analytics.readonly',
    run: async () => (await apiRequest('/api/youtube/analytics')).json(),
  },
  {
    key: 'yt-revenue',
    label: 'Hent YouTube-inntekter',
    scope: 'yt-analytics-monetary.readonly',
    run: async () => (await apiRequest('/api/youtube/analytics/revenue')).json(),
  },
  {
    key: 'drive-activity',
    label: 'Vis Drive-aktivitet',
    scope: 'drive.activity.readonly',
    run: async () => (await apiRequest('/api/google-workspace/drive-activity')).json(),
  },
  {
    key: 'sheets-export',
    label: 'Eksporter demo til Sheets',
    scope: 'spreadsheets',
    run: async () =>
      (
        await apiRequest('/api/google-workspace/sheets/export', {
          method: 'POST',
          body: {
            title: 'CreatorHub demo-eksport',
            rows: [
              ['Prosjekt', 'Status', 'Frist'],
              ['Kampanje vår', 'Aktiv', '2026-09-01'],
              ['Produktfilm', 'Planlagt', '2026-10-15'],
            ],
          },
        })
      ).json(),
  },
];

const GoogleWorkspaceToolsPanel: React.FC = () => {
  const [busy, setBusy] = React.useState<ToolKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<unknown>(null);

  const handleRun = async (tool: (typeof TOOLS)[number]) => {
    setBusy(tool.key);
    setError(null);
    setResult(null);
    try {
      const data = await tool.run();
      if (data && typeof data === 'object' && 'error' in data) {
        setError(String((data as { error: unknown }).error));
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil ved Google-kall.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Google Workspace-verktøy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Krever en tilkoblet Google-konto med de aktuelle tillatelsene. Hver knapp kaller det
        ekte Google-API-et for sitt scope.
      </Typography>

      <Stack spacing={1.5}>
        {TOOLS.map((tool) => (
          <Button
            key={tool.key}
            variant="outlined"
            onClick={() => handleRun(tool)}
            disabled={busy !== null}
            startIcon={busy === tool.key ? <CircularProgress size={16} /> : undefined}
            sx={{ justifyContent: 'flex-start' }}
          >
            {tool.label}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({tool.scope})
            </Typography>
          </Button>
        ))}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}

      {result !== null && (
        <Paper variant="outlined" sx={{ mt: 3, p: 2, overflowX: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>
            Resultat
          </Typography>
          <Box component="pre" sx={{ m: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result, null, 2)}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default GoogleWorkspaceToolsPanel;
