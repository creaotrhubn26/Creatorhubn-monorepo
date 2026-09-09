import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiFetch, apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { PrototypeTesterInviteDialog } from '../invite/RoleRoomTesterInviteDialog';
import { ws } from '../workspace/workspaceTheme';

interface PrototypeTesterAdminInvite {
  id: string;
  name: string;
  email: string;
  status: string;
  inviteRequestId?: string | null;
  inviteUrl: string;
  createdAt?: string | null;
  acceptedAt?: string | null;
  signatureMethod?: string | null;
  emailVerifiedAt?: string | null;
  signingReceiptId?: string | null;
  emailOpenedAt?: string | null;
  inviteLinkClickedAt?: string | null;
  accountProvisioningComplete: boolean;
  soloProActive: boolean;
  emailDelivery?: {
    sent: boolean;
    sentAt?: string | null;
    provider?: string | null;
    reason?: string | null;
  } | null;
  receiptEmailDelivery?: {
    sent: boolean;
    sentAt?: string | null;
    provider?: string | null;
    reason?: string | null;
  } | null;
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function PrototypeTesterAdminPanel() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [receiptDownloadId, setReceiptDownloadId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const queryKey = ['/api/prototype-tester-invites'];
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/prototype-tester-invites', { headers });
    },
    refetchInterval: 30_000,
  });
  const invites: PrototypeTesterAdminInvite[] = Array.isArray(data?.invites)
    ? data.invites
    : [];

  const downloadReceipt = async (invite: PrototypeTesterAdminInvite) => {
    if (!invite.signingReceiptId) return;
    setReceiptDownloadId(invite.id);
    setReceiptError(null);
    try {
      const response = await apiFetch(
        `/api/prototype-tester-agreements/${encodeURIComponent(invite.signingReceiptId)}/receipt.pdf`,
        { headers: { Accept: 'application/pdf' } },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Kunne ikke laste ned signeringskvitteringen.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `creatorhub-signeringskvittering-${invite.signingReceiptId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setReceiptError(cause instanceof Error
        ? cause.message
        : 'Kunne ikke laste ned signeringskvitteringen.');
    } finally {
      setReceiptDownloadId(null);
    }
  };

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 4 }} data-testid="prototype-tester-admin-panel">
      <Card sx={{ bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ color: ws.text, fontWeight: 800 }}>
                Prototype-testere og direkte invitasjoner
              </Typography>
              <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>
                Verifiserbar flyt for e-postkode, fire avtaler, signeringskvittering,
                konto og faktisk solo_pro-tilgang.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.25}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setInviteOpen(true)}
                sx={{ bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800, '&:hover': { bgcolor: ws.accentHover } }}
              >
                Inviter ny tester
              </Button>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                href="/admin-invite-system"
                sx={{ color: ws.accent, borderColor: ws.accentBorder }}
              >
                Full søknadsflate
              </Button>
            </Stack>
          </Box>

          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            Invitasjonslenken varer i 14 dager. Tilgang aktiveres først når
            programvilkår, NDA, databehandleravtale og intensjonsavtale er akseptert
            med kode sendt til den inviterte e-posten.
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : 'Kunne ikke hente prototypeinvitasjoner.'}
            </Alert>
          )}
          {receiptError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setReceiptError(null)}>
              {receiptError}
            </Alert>
          )}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : invites.length === 0 ? (
            <Alert severity="info" variant="outlined">
              Ingen prototypeinvitasjoner er opprettet ennå.
            </Alert>
          ) : (
            <TableContainer sx={{ border: `1px solid ${ws.border}`, borderRadius: `${ws.radiusSm}px` }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tester</TableCell>
                    <TableCell>Kilde</TableCell>
                    <TableCell>E-postløp</TableCell>
                    <TableCell>Avtale og tilgang</TableCell>
                    <TableCell>Opprettet</TableCell>
                    <TableCell align="right">Lenke</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id} hover data-testid={`prototype-tester-invite-${invite.id}`}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: ws.text }}>
                          {invite.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: ws.textDim }}>
                          {invite.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={invite.inviteRequestId ? 'Søknad' : 'Direkte'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                          <Chip size="small" label="Sendt" color={invite.emailDelivery?.sent ? 'success' : 'default'} />
                          <Chip size="small" label="Åpnet" color={invite.emailOpenedAt ? 'success' : 'default'} />
                          <Chip size="small" label="Klikket" color={invite.inviteLinkClickedAt ? 'success' : 'default'} />
                        </Stack>
                        {invite.emailDelivery?.reason && (
                          <Typography variant="caption" color="error.main">
                            {invite.emailDelivery.reason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                          <Chip size="small" label="4 avtaler" color={invite.acceptedAt ? 'success' : 'default'} />
                          <Chip size="small" label="E-postkode" color={invite.emailVerifiedAt ? 'success' : 'default'} />
                          <Chip size="small" label="PDF-kvittering" color={invite.signingReceiptId ? 'success' : 'default'} />
                          <Chip size="small" label="Kvittering sendt" color={invite.receiptEmailDelivery?.sent ? 'success' : 'default'} />
                          <Chip size="small" label="Konto" color={invite.accountProvisioningComplete ? 'success' : 'default'} />
                          <Chip size="small" label="solo_pro" color={invite.soloProActive ? 'success' : 'default'} />
                          {invite.status === 'expired' && <Chip size="small" label="Utløpt" color="warning" />}
                        </Stack>
                        {invite.receiptEmailDelivery?.reason && (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                            Kvittering: {invite.receiptEmailDelivery.reason}
                          </Typography>
                        )}
                        {invite.emailVerifiedAt && (
                          <Typography variant="caption" sx={{ display: 'block', color: ws.textDim, mt: 0.5 }}>
                            E-post verifisert {formatTimestamp(invite.emailVerifiedAt)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatTimestamp(invite.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                          {invite.signingReceiptId && (
                            <Button
                              size="small"
                              startIcon={<DownloadOutlinedIcon />}
                              disabled={receiptDownloadId === invite.id}
                              onClick={() => void downloadReceipt(invite)}
                              data-testid={`admin-download-receipt-${invite.id}`}
                            >
                              {receiptDownloadId === invite.id ? 'Laster…' : 'Kvittering'}
                            </Button>
                          )}
                          <Button size="small" component="a" href={invite.inviteUrl} target="_blank" rel="noreferrer">
                            Åpne
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
            <Button size="small" onClick={() => void refetch()} disabled={isLoading}>
              Oppdater status
            </Button>
          </Box>
        </CardContent>
      </Card>

      <PrototypeTesterInviteDialog
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          void queryClient.invalidateQueries({ queryKey });
        }}
        endpoint="/api/prototype-tester-invites"
      />
    </Box>
  );
}
