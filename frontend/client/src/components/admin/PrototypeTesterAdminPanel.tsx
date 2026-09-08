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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { PrototypeTesterInviteDialog } from '../invite/RoleRoomTesterInviteDialog';

interface PrototypeTesterAdminInvite {
  id: string;
  name: string;
  email: string;
  status: string;
  inviteRequestId?: string | null;
  inviteUrl: string;
  createdAt?: string | null;
  acceptedAt?: string | null;
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

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 4 }} data-testid="prototype-tester-admin-panel">
      <Card sx={{ bgcolor: 'rgba(2,6,23,0.72)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                Prototype-testere og direkte invitasjoner
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.72)', mt: 0.5 }}>
                Samme verifiserbare flyt som søknadene over: e-post, fire avtaler,
                konto og faktisk solo_pro-tilgang.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.25}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setInviteOpen(true)}
                sx={{ bgcolor: '#ff8c00', color: '#111827', fontWeight: 700, '&:hover': { bgcolor: '#f59e0b' } }}
              >
                Inviter ny tester
              </Button>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                href="/admin-invite-system"
                sx={{ color: '#ffb45b', borderColor: 'rgba(255,180,91,0.5)' }}
              >
                Full søknadsflate
              </Button>
            </Stack>
          </Box>

          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            Invitasjonslenken varer i 14 dager. Tilgang aktiveres først når
            programvilkår, NDA, databehandleravtale og intensjonsavtale er akseptert.
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : 'Kunne ikke hente prototypeinvitasjoner.'}
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
            <TableContainer sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1.5 }}>
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
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                          {invite.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.68)' }}>
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
                          <Chip size="small" label="Konto" color={invite.accountProvisioningComplete ? 'success' : 'default'} />
                          <Chip size="small" label="solo_pro" color={invite.soloProActive ? 'success' : 'default'} />
                          {invite.status === 'expired' && <Chip size="small" label="Utløpt" color="warning" />}
                        </Stack>
                      </TableCell>
                      <TableCell>{formatTimestamp(invite.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" component="a" href={invite.inviteUrl} target="_blank" rel="noreferrer">
                          Åpne
                        </Button>
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
