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
import { ThemeProvider } from '@mui/material/styles';
import { apiFetch, apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { PrototypeTesterInviteDialog } from '../invite/RoleRoomTesterInviteDialog';
import { workspaceDarkTheme, ws } from '../workspace/workspaceTheme';

interface PrototypeTesterAdminInvite {
  id: string;
  name: string;
  email: string;
  memberCompany?: string | null;
  memberOrganizationNumber?: string | null;
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

function formatOrganizationNumber(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{9}$/.test(digits)
    ? digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
    : null;
}

function LifecycleChip({ label, active }: { label: string; active: boolean }) {
  return (
    <Chip
      size="small"
      label={label}
      data-state={active ? 'complete' : 'pending'}
      sx={{
        height: 26,
        bgcolor: active ? ws.greenSoft : ws.panelInput,
        color: active ? ws.green : ws.textDim,
        border: `1px solid ${active ? 'rgba(52,211,153,0.38)' : ws.border}`,
        fontWeight: 700,
        '& .MuiChip-label': { px: 1.1 },
      }}
    />
  );
}

const bodyCellSx = {
  color: ws.text,
  borderColor: ws.borderSoft,
  verticalAlign: 'top',
  py: 1.5,
} as const;

const actionButtonSx = {
  minHeight: 36,
  color: ws.accent,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: ws.accentSoft },
  '&:focus-visible': {
    outline: `2px solid ${ws.accent}`,
    outlineOffset: 2,
  },
} as const;

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
    <ThemeProvider theme={workspaceDarkTheme}>
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 4 }} data-testid="prototype-tester-admin-panel">
      <Card sx={{ bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ minWidth: 0, flex: '1 1 360px' }}>
              <Typography variant="h5" sx={{ color: ws.text, fontWeight: 800 }}>
                Prototype-testere og direkte invitasjoner
              </Typography>
              <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5, lineHeight: 1.55 }}>
                Verifiserbar flyt for e-postkode, fire avtaler, signeringskvittering,
                konto og faktisk solo_pro-tilgang.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              sx={{ width: { xs: '100%', sm: 'auto' }, '& .MuiButton-root': { minHeight: 44 } }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setInviteOpen(true)}
                sx={{
                  bgcolor: ws.accent,
                  color: ws.accentContrast,
                  fontWeight: 800,
                  '&:hover': { bgcolor: ws.accentHover },
                  '&:focus-visible': { outline: `2px solid ${ws.text}`, outlineOffset: 2 },
                }}
              >
                Inviter ny tester
              </Button>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                href="/admin-invite-system"
                sx={{
                  color: ws.accent,
                  borderColor: ws.accentBorder,
                  fontWeight: 800,
                  '&:hover': { borderColor: ws.accent, bgcolor: ws.accentSoft },
                  '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 2 },
                }}
              >
                Full søknadsflate
              </Button>
            </Stack>
          </Box>

          <Alert
            severity="info"
            variant="outlined"
            sx={{
              mb: 2,
              bgcolor: ws.blueSoft,
              color: ws.text,
              borderColor: 'rgba(96,165,250,0.42)',
              lineHeight: 1.55,
              '& .MuiAlert-icon': { color: ws.blue },
            }}
          >
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
            <Alert
              severity="info"
              variant="outlined"
              sx={{ color: ws.text, bgcolor: ws.blueSoft, borderColor: 'rgba(96,165,250,0.42)' }}
            >
              Ingen prototypeinvitasjoner er opprettet ennå.
            </Alert>
          ) : (
            <TableContainer
              sx={{
                border: `1px solid ${ws.border}`,
                borderRadius: `${ws.radiusSm}px`,
                bgcolor: ws.panelInput,
                overflowX: 'auto',
                scrollbarColor: `${ws.textFaint} transparent`,
              }}
            >
              <Table size="small" aria-label="Status for prototype-testere" sx={{ minWidth: 1040 }}>
                <TableHead>
                  <TableRow>
                    {['Tester', 'Kilde', 'E-postløp', 'Avtale og tilgang', 'Opprettet', 'Handlinger'].map((label, index) => (
                      <TableCell
                        key={label}
                        align={index === 5 ? 'right' : 'left'}
                        sx={{
                          bgcolor: ws.panelSolid,
                          color: ws.textDim,
                          borderColor: ws.border,
                          py: 1.25,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow
                      key={invite.id}
                      hover
                      data-testid={`prototype-tester-invite-${invite.id}`}
                      sx={{
                        '&:last-child td': { borderBottom: 0 },
                        '&.MuiTableRow-hover:hover': { bgcolor: ws.panelAlt },
                      }}
                    >
                      <TableCell sx={{ ...bodyCellSx, minWidth: 220 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: ws.text }}>
                          {invite.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: ws.textDim, overflowWrap: 'anywhere' }}>
                          {invite.email}
                        </Typography>
                        {invite.memberCompany && (
                          <Typography variant="caption" sx={{ color: ws.textDim, display: 'block', mt: 0.4 }}>
                            {invite.memberCompany}
                            {formatOrganizationNumber(invite.memberOrganizationNumber)
                              ? ` · Org.nr. ${formatOrganizationNumber(invite.memberOrganizationNumber)}`
                              : ''}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Chip
                          size="small"
                          label={invite.inviteRequestId ? 'Søknad' : 'Direkte'}
                          variant="outlined"
                          sx={{ color: ws.blue, borderColor: 'rgba(96,165,250,0.42)', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 150 }}>
                        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                          <LifecycleChip label="Sendt" active={Boolean(invite.emailDelivery?.sent)} />
                          <LifecycleChip label="Åpnet" active={Boolean(invite.emailOpenedAt)} />
                          <LifecycleChip label="Klikket" active={Boolean(invite.inviteLinkClickedAt)} />
                        </Stack>
                        {invite.emailDelivery?.reason && (
                          <Typography variant="caption" sx={{ color: ws.red, display: 'block', mt: 0.75 }}>
                            {invite.emailDelivery.reason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 330 }}>
                        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                          <LifecycleChip label="4 avtaler" active={Boolean(invite.acceptedAt)} />
                          <LifecycleChip label="E-postkode" active={Boolean(invite.emailVerifiedAt)} />
                          <LifecycleChip label="PDF-kvittering" active={Boolean(invite.signingReceiptId)} />
                          <LifecycleChip label="Kvittering sendt" active={Boolean(invite.receiptEmailDelivery?.sent)} />
                          <LifecycleChip label="Konto" active={invite.accountProvisioningComplete} />
                          <LifecycleChip label="solo_pro" active={invite.soloProActive} />
                          {invite.status === 'expired' && (
                            <Chip
                              size="small"
                              label="Utløpt"
                              sx={{ color: ws.amber, bgcolor: ws.amberSoft, border: '1px solid rgba(251,191,36,0.38)', fontWeight: 700 }}
                            />
                          )}
                        </Stack>
                        {invite.receiptEmailDelivery?.reason && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: ws.red }}>
                            Kvittering: {invite.receiptEmailDelivery.reason}
                          </Typography>
                        )}
                        {invite.emailVerifiedAt && (
                          <Typography variant="caption" sx={{ display: 'block', color: ws.textDim, mt: 0.5 }}>
                            E-post verifisert {formatTimestamp(invite.emailVerifiedAt)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 120, color: ws.textDim }}>
                        {formatTimestamp(invite.createdAt)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...bodyCellSx, minWidth: 160 }}>
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                          {invite.signingReceiptId && (
                            <Button
                              size="small"
                              startIcon={<DownloadOutlinedIcon />}
                              disabled={receiptDownloadId === invite.id}
                              onClick={() => void downloadReceipt(invite)}
                              data-testid={`admin-download-receipt-${invite.id}`}
                              sx={actionButtonSx}
                            >
                              {receiptDownloadId === invite.id ? 'Laster…' : 'Kvittering'}
                            </Button>
                          )}
                          <Button
                            size="small"
                            component="a"
                            href={invite.inviteUrl}
                            target="_blank"
                            rel="noreferrer"
                            sx={actionButtonSx}
                          >
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
            <Button size="small" onClick={() => void refetch()} disabled={isLoading} sx={actionButtonSx}>
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
    </ThemeProvider>
  );
}
