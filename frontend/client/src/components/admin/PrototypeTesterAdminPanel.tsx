import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { ThemeProvider } from '@mui/material/styles';
import { apiFetch, apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { PrototypeTesterInviteDialog } from '../invite/RoleRoomTesterInviteDialog';
import { workspaceDarkTheme, ws } from '../workspace/workspaceTheme';

type LifecycleState = 'complete' | 'failed' | 'pending';
type RetryStep = 'invite_email' | 'account' | 'access_email' | 'receipt_email';

interface LifecycleItem {
  key: string;
  label: string;
  status: LifecycleState;
  at?: string | null;
  detail?: string | null;
  retryStep?: RetryStep | null;
}

interface PrototypeTesterAdminInvite {
  id: string;
  name: string;
  email: string;
  memberCompany?: string | null;
  memberOrganizationNumber?: string | null;
  memberProfession?: string | null;
  testingAreas?: string[];
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
  emailDelivery?: Delivery | null;
  accessEmailDelivery?: Delivery | null;
  receiptEmailDelivery?: Delivery | null;
  operationalAttempts?: {
    inviteEmail: number;
    account: number;
    accessEmail: number;
    receiptEmail: number;
  };
  lifecycle?: LifecycleItem[];
}

interface Delivery {
  sent: boolean;
  sentAt?: string | null;
  provider?: string | null;
  reason?: string | null;
}

const PROFESSION_LABELS: Record<string, string> = {
  photographer: 'Fotograf',
  videographer: 'Videograf',
  music_producer: 'Musikkprodusent',
  vendor: 'Leverandør',
};

function formatTimestamp(value?: string | null) {
  if (!value) return 'Ikke registrert';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Ikke registrert'
    : new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatOrganizationNumber(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{9}$/.test(digits) ? digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : null;
}

function stateColors(state: LifecycleState) {
  if (state === 'complete') return { foreground: ws.green, background: ws.greenSoft, border: 'rgba(52,211,153,0.38)' };
  if (state === 'failed') return { foreground: ws.red, background: ws.redSoft, border: 'rgba(248,113,113,0.42)' };
  return { foreground: ws.textDim, background: ws.panelInput, border: ws.border };
}

function lifecycleFallback(invite: PrototypeTesterAdminInvite): LifecycleItem[] {
  return [
    { key: 'created', label: 'Invitasjon opprettet', status: 'complete', at: invite.createdAt },
    { key: 'invite_email', label: 'Invitasjon sendt', status: invite.emailDelivery?.sent ? 'complete' : invite.emailDelivery?.reason ? 'failed' : 'pending', at: invite.emailDelivery?.sentAt, detail: invite.emailDelivery?.reason, retryStep: invite.emailDelivery?.sent ? null : 'invite_email' },
    { key: 'opened', label: 'E-post åpnet', status: invite.emailOpenedAt ? 'complete' : 'pending', at: invite.emailOpenedAt },
    { key: 'clicked', label: 'Invitasjonslenke åpnet', status: invite.inviteLinkClickedAt ? 'complete' : 'pending', at: invite.inviteLinkClickedAt },
    { key: 'email_verified', label: 'E-post bekreftet med kode', status: invite.emailVerifiedAt ? 'complete' : 'pending', at: invite.emailVerifiedAt },
    { key: 'agreements', label: 'Fire avtaler akseptert', status: invite.acceptedAt ? 'complete' : 'pending', at: invite.acceptedAt },
    { key: 'account', label: 'Konto opprettet', status: invite.accountProvisioningComplete ? 'complete' : 'pending', retryStep: invite.acceptedAt && !invite.accountProvisioningComplete ? 'account' : null },
    { key: 'solo_pro', label: 'solo_pro aktiv', status: invite.soloProActive ? 'complete' : 'pending' },
    { key: 'receipt', label: 'PDF-kvittering tilgjengelig', status: invite.signingReceiptId ? 'complete' : 'pending' },
    { key: 'receipt_email', label: 'Kvittering sendt', status: invite.receiptEmailDelivery?.sent ? 'complete' : invite.receiptEmailDelivery?.reason ? 'failed' : 'pending', at: invite.receiptEmailDelivery?.sentAt, detail: invite.receiptEmailDelivery?.reason, retryStep: invite.signingReceiptId && !invite.receiptEmailDelivery?.sent ? 'receipt_email' : null },
  ];
}

function statusLabel(invite: PrototypeTesterAdminInvite) {
  if (invite.status === 'expired') return 'Utløpt';
  if (invite.soloProActive) return 'Tilgang aktiv';
  if (invite.acceptedAt && !invite.accountProvisioningComplete) return 'Konto må repareres';
  if (invite.acceptedAt) return 'Avtaler akseptert';
  if (invite.inviteLinkClickedAt) return 'Invitasjon åpnet';
  return 'Venter på tester';
}

export default function PrototypeTesterAdminPanel() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'attention'>('all');
  const [receiptDownloadId, setReceiptDownloadId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const queryKey = ['/api/prototype-tester-invites'];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/prototype-tester-invites', { headers });
    },
    refetchInterval: 30_000,
  });
  const invites = useMemo<PrototypeTesterAdminInvite[]>(
    () => (Array.isArray(data?.invites) ? data.invites : []),
    [data?.invites],
  );

  const filteredInvites = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('nb-NO');
    return invites.filter((invite) => {
      const lifecycle = invite.lifecycle || lifecycleFallback(invite);
      const attention = lifecycle.some((item) => item.status === 'failed');
      const matchesFilter = filter === 'all'
        || (filter === 'pending' && invite.status === 'pending')
        || (filter === 'active' && invite.soloProActive)
        || (filter === 'attention' && attention);
      const haystack = [invite.name, invite.email, invite.memberCompany, invite.memberOrganizationNumber].filter(Boolean).join(' ').toLocaleLowerCase('nb-NO');
      return matchesFilter && (!term || haystack.includes(term));
    });
  }, [filter, invites, search]);

  const downloadReceipt = async (invite: PrototypeTesterAdminInvite) => {
    if (!invite.signingReceiptId) return;
    setReceiptDownloadId(invite.id);
    setActionError(null);
    try {
      const response = await apiFetch(`/api/prototype-tester-agreements/${encodeURIComponent(invite.signingReceiptId)}/receipt.pdf`, { headers: { Accept: 'application/pdf' } });
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
      setActionError(cause instanceof Error ? cause.message : 'Kunne ikke laste ned signeringskvitteringen.');
    } finally {
      setReceiptDownloadId(null);
    }
  };

  const retryStep = async (invite: PrototypeTesterAdminInvite, step: RetryStep) => {
    const key = `${invite.id}:${step}`;
    setRetryKey(key);
    setActionError(null);
    setActionNotice(null);
    try {
      const headers = await auth.getAuthHeader();
      await apiRequest(`/api/prototype-tester-invites/${encodeURIComponent(invite.id)}/retry`, { method: 'POST', headers, body: { step } });
      setActionNotice(`${invite.name}: steget ble fullført og status er oppdatert.`);
      await queryClient.invalidateQueries({ queryKey });
      await refetch();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Steget kunne ikke prøves på nytt.');
    } finally {
      setRetryKey(null);
    }
  };

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 4 }} data-testid="prototype-tester-admin-panel">
        <Card sx={{ bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} gap={2} sx={{ mb: 2.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ color: ws.text, fontWeight: 850 }}>Prototype-testere</Typography>
                <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5, lineHeight: 1.55 }}>Én lesbar livssyklus fra invitasjon til avtaler, kvittering, konto og reell solo_pro-tilgang.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)} sx={{ minHeight: 44, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800 }}>Inviter ny tester</Button>
                <Button variant="outlined" startIcon={<OpenInNewIcon />} href="/admin-invite-system" sx={{ minHeight: 44, color: ws.accent, borderColor: ws.accentBorder, fontWeight: 800 }}>Søknader</Button>
              </Stack>
            </Stack>

            <Alert severity="info" variant="outlined" sx={{ mb: 2.5, bgcolor: ws.blueSoft, color: ws.text, borderColor: 'rgba(96,165,250,0.42)' }}>
              Tilgang aktiveres først etter e-postkode og aksept av programvilkår, NDA, databehandleravtale og intensjonsavtale. Alle reparasjoner gjenbruker samme invitasjon.
            </Alert>
            {(error || actionError) && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError || (error instanceof Error ? error.message : 'Kunne ikke hente prototypeinvitasjoner.')}</Alert>}
            {actionNotice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionNotice(null)}>{actionNotice}</Alert>}

            <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
              <TextField
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Søk navn, e-post, bedrift eller org.nr."
                inputProps={{ 'aria-label': 'Søk i prototype-testere' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: ws.textDim }} /></InputAdornment>, sx: { bgcolor: ws.panelInput } }}
                sx={{ flex: 1, minWidth: { md: 320 } }}
              />
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} aria-label="Filtrer prototype-testere">
                {([
                  ['all', `Alle ${invites.length}`],
                  ['pending', 'Venter'],
                  ['active', 'Aktive'],
                  ['attention', 'Krever tiltak'],
                ] as const).map(([value, label]) => <Chip key={value} label={label} onClick={() => setFilter(value)} color={filter === value ? 'primary' : 'default'} variant={filter === value ? 'filled' : 'outlined'} />)}
              </Stack>
            </Stack>

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={30} /></Box>
            ) : filteredInvites.length === 0 ? (
              <Alert severity="info" variant="outlined">Ingen invitasjoner matcher søket eller filteret.</Alert>
            ) : (
              <Stack spacing={1.25} aria-label="Status for prototype-testere">
                {filteredInvites.map((invite) => {
                  const lifecycle = invite.lifecycle || lifecycleFallback(invite);
                  const expanded = expandedId === invite.id;
                  const completed = lifecycle.filter((item) => item.status === 'complete').length;
                  const failed = lifecycle.filter((item) => item.status === 'failed').length;
                  const orgNumber = formatOrganizationNumber(invite.memberOrganizationNumber);
                  return (
                    <Card key={invite.id} data-testid={`prototype-tester-invite-${invite.id}`} sx={{ bgcolor: ws.panelInput, border: `1px solid ${failed ? 'rgba(248,113,113,0.45)' : ws.border}`, borderRadius: 2, boxShadow: 'none' }}>
                      <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, '&:last-child': { pb: { xs: 1.75, sm: 2.25 } } }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={2}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} alignItems="center">
                              <Typography sx={{ color: ws.text, fontWeight: 800 }}>{invite.name}</Typography>
                              <Chip size="small" label={invite.inviteRequestId ? 'Søknad' : 'Direkte'} variant="outlined" />
                              <Chip size="small" label={statusLabel(invite)} sx={{ color: failed ? ws.red : invite.soloProActive ? ws.green : ws.amber, bgcolor: failed ? ws.redSoft : invite.soloProActive ? ws.greenSoft : ws.amberSoft, fontWeight: 750 }} />
                            </Stack>
                            <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.6, overflowWrap: 'anywhere' }}>{invite.email}</Typography>
                            {invite.memberCompany && <Typography variant="caption" sx={{ color: ws.textDim, display: 'block', mt: 0.4 }}>{invite.memberCompany}{orgNumber ? ` · Org.nr. ${orgNumber}` : ''}{invite.memberProfession ? ` · ${PROFESSION_LABELS[invite.memberProfession] || invite.memberProfession}` : ''}</Typography>}
                          </Box>
                          <Box sx={{ minWidth: { md: 250 } }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                              <Typography variant="caption" sx={{ color: ws.textDim }}>{completed} av {lifecycle.length} steg</Typography>
                              {failed > 0 && <Typography variant="caption" sx={{ color: ws.red, fontWeight: 750 }}>{failed} feil</Typography>}
                            </Stack>
                            <Box sx={{ height: 7, borderRadius: 99, bgcolor: ws.panelAlt, overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${Math.round((completed / Math.max(lifecycle.length, 1)) * 100)}%`, bgcolor: failed ? ws.red : ws.green, borderRadius: 99 }} />
                            </Box>
                          </Box>
                          <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} justifyContent={{ md: 'flex-end' }}>
                            {invite.signingReceiptId && <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={receiptDownloadId === invite.id} onClick={() => void downloadReceipt(invite)} data-testid={`admin-download-receipt-${invite.id}`}>{receiptDownloadId === invite.id ? 'Laster…' : 'PDF'}</Button>}
                            <Button size="small" component="a" href={invite.inviteUrl} target="_blank" rel="noreferrer">Åpne</Button>
                            <Button size="small" endIcon={<ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />} onClick={() => setExpandedId(expanded ? null : invite.id)} aria-expanded={expanded}>{expanded ? 'Skjul' : 'Detaljer'}</Button>
                          </Stack>
                        </Stack>

                        <Collapse in={expanded} timeout="auto" unmountOnExit>
                          <Divider sx={{ my: 2, borderColor: ws.border }} />
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
                            {lifecycle.map((item, index) => {
                              const colors = stateColors(item.status);
                              const retry = item.retryStep;
                              const key = retry ? `${invite.id}:${retry}` : null;
                              return (
                                <Box key={item.key} data-state={item.status} sx={{ display: 'flex', gap: 1.25, p: 1.4, border: `1px solid ${colors.border}`, bgcolor: colors.background, borderRadius: 1.5 }}>
                                  <Box sx={{ width: 25, height: 25, flex: '0 0 25px', display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: colors.foreground, color: ws.bg, fontSize: '0.72rem', fontWeight: 850 }}>{item.status === 'complete' ? '✓' : item.status === 'failed' ? '!' : index + 1}</Box>
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="body2" sx={{ color: ws.text, fontWeight: 750 }}>{item.label}</Typography>
                                    <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>{item.at ? formatTimestamp(item.at) : item.status === 'pending' ? 'Venter' : 'Ikke registrert'}</Typography>
                                    {item.detail && <Typography variant="caption" sx={{ color: item.status === 'failed' ? ws.red : ws.textDim, display: 'block', mt: 0.4, overflowWrap: 'anywhere' }}>{item.detail}</Typography>}
                                    {retry && (
                                      <Button size="small" startIcon={retryKey === key ? <CircularProgress size={14} /> : <AutorenewIcon />} disabled={Boolean(retryKey)} onClick={() => void retryStep(invite, retry)} sx={{ mt: 0.6, color: colors.foreground }}>
                                        Prøv steget igjen
                                      </Button>
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                            <Chip size="small" label={`Opprettet ${formatTimestamp(invite.createdAt)}`} variant="outlined" />
                            {invite.testingAreas?.map((area) => <Chip key={area} size="small" label={area} variant="outlined" />)}
                          </Stack>
                        </Collapse>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
              <Button size="small" startIcon={<AutorenewIcon />} onClick={() => void refetch()} disabled={isLoading}>Oppdater status</Button>
            </Box>
          </CardContent>
        </Card>
        <PrototypeTesterInviteDialog open={inviteOpen} onClose={() => { setInviteOpen(false); void queryClient.invalidateQueries({ queryKey }); }} endpoint="/api/prototype-tester-invites" />
      </Box>
    </ThemeProvider>
  );
}
