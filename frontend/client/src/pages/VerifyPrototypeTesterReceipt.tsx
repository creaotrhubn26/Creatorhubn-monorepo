import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { apiRequest } from '@/lib/queryClient';
import { ThemeProvider } from '@mui/material/styles';
import { workspaceDarkTheme, ws } from '@/components/workspace/workspaceTheme';

type VerificationResult = {
  valid: true;
  receiptId: string;
  acceptedAt: string;
  signatureMethod: string;
  emailVerified: boolean;
  archiveFormat: string;
  documentCount: number;
  documents: Array<{
    key: string;
    title: string;
    version: string;
    bindingNature: 'binding' | 'non_binding';
  }>;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Ikke registrert'
    : new Intl.DateTimeFormat('nb-NO', {
        dateStyle: 'long',
        timeStyle: 'medium',
      }).format(date);
}

export default function VerifyPrototypeTesterReceipt() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receipt = params.get('receipt') || '';
    const digest = params.get('digest') || '';
    if (!receipt || !digest) {
      setError('Kontrollreferansen mangler. Skann QR-koden i kvitteringen på nytt.');
      return;
    }
    void apiRequest(
      `/api/prototype-tester-agreements/receipts/${encodeURIComponent(receipt)}/verify?digest=${encodeURIComponent(digest)}`,
    )
      .then((payload) => {
        if (payload?.valid !== true) throw new Error('Kvitteringen kunne ikke verifiseres.');
        setResult(payload as VerificationResult);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Kvitteringen kunne ikke verifiseres.');
      });
  }, []);

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: ws.bg, color: ws.text, py: { xs: 4, md: 8 } }}>
        <Container maxWidth="sm">
          <Box component="img" src="/creatorhub-wordmark-light.png" alt="CreatorHub Norge" sx={{ width: 190, maxWidth: '65%', mb: 4 }} />
          <Card sx={{ bgcolor: ws.panelSolid, border: `1px solid ${ws.border}`, borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 }, '&:last-child': { pb: { xs: 2.5, sm: 4 } } }}>
              {!result && !error && (
                <Stack alignItems="center" spacing={2} sx={{ py: 5 }}>
                  <CircularProgress size={32} />
                  <Typography sx={{ color: ws.textDim }}>Kontrollerer signeringsbeviset…</Typography>
                </Stack>
              )}
              {error && <Alert severity="error">{error}</Alert>}
              {result && (
                <Stack spacing={3}>
                  <Box>
                    <CheckCircleOutlineIcon sx={{ color: ws.green, fontSize: 42, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 850, color: ws.text }}>
                      Kvitteringen er gyldig
                    </Typography>
                    <Typography sx={{ color: ws.textDim, mt: 1, lineHeight: 1.6 }}>
                      Kontrollsummen samsvarer med CreatorHubs låste avtaleversjon.
                      Siden viser ingen personopplysninger.
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, bgcolor: ws.panelInput, border: `1px solid ${ws.border}`, borderRadius: 2 }}>
                    <Stack spacing={1.25}>
                      <Typography variant="caption" sx={{ color: ws.textDim }}>KVITTERINGS-ID</Typography>
                      <Typography sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{result.receiptId}</Typography>
                      <Typography variant="body2" sx={{ color: ws.textDim }}>
                        Akseptert {formatTimestamp(result.acceptedAt)}
                      </Typography>
                      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                        <Chip icon={<VerifiedUserOutlinedIcon />} label={result.emailVerified ? 'E-post verifisert' : 'Eldre aksept'} size="small" />
                        <Chip label={result.archiveFormat} size="small" />
                        <Chip label={`${result.documentCount} dokumenter`} size="small" />
                      </Stack>
                    </Stack>
                  </Box>
                  <Stack spacing={1}>
                    {result.documents.map((document) => (
                      <Box key={document.key} sx={{ p: 1.5, border: `1px solid ${ws.border}`, borderRadius: 1.5 }}>
                        <Typography sx={{ fontWeight: 750 }}>{document.title}</Typography>
                        <Typography variant="caption" sx={{ color: ws.textDim }}>
                          Versjon {document.version} · {document.bindingNature === 'non_binding' ? 'Ikke-bindende' : 'Bindende'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
