import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { PlanFeaturePreview } from '../subscription/PlanFeaturePreview';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { TableVirtuoso } from 'react-virtuoso';
import type { TableHeadProps } from '@mui/material/TableHead';
import { styled } from '@mui/material/styles';
import {
  Assessment,
  Business,
  CheckCircle,
  Cancel,
  Flag,
  Email,
  Visibility,
  TrendingUp,
  Group,
  Schedule,
  Warning,
  AccountBalance,
  PersonAdd,
  Assignment,
  HowToReg,
  Verified,
  CreditCard,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import FikenIntegrationRequestsPanel from './FikenIntegrationRequestsPanel';
import { AdminButton, useIsMobile } from './design-system';

// Custom styled connector for journey stepper
const JourneyConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #ff6b35 0%, #ff8c00 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #4caf50 0%, #66bb6a 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderRadius: 1,
  },
}));

// User journey status type
type UserJourneyStatus = 'request_submitted' | 'under_review' | 'invite_sent' | 'account_created' | 'onboarding_started' | 'onboarding_completed' | 'active';

interface InviteRequest {
  id: string;
  businessName: string;
  orgNumber: string;
  contactName: string;
  contactEmail: string;
  profession: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  hasGoogleWorkspace: boolean;
  redFlagAnalysis?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: Array<{
      category: string;
      severity: 'warning' | 'danger' | 'critical';
      message: string;
}>;
    score: number;
    recommendation: 'approve' | 'review' | 'reject';
};
  createdAt: string;
  reviewedAt?: string;
  inviteSentAt?: string;
  registeredAt?: string;
  // Subscription plan info
  selectedPlan?: string;
  planName?: string;
  planPrice?: number;
  // User journey tracking
  userJourneyStatus?: UserJourneyStatus;
  inviteSentCount?: number;
  inviteEmailOpenedAt?: string;
  inviteLinkClickedAt?: string;
  onboardingStartedAt?: string;
  onboardingCompletedAt?: string;
  onboardingStep?: number;
}

interface InviteStats {
  totalRequests: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  converted: number;
  conversionRate: number;
  averageReviewTime: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const normalizePlan = (plan?: string): 'basic' | 'pro' | 'enterprise' | null => {
  if (plan === 'basic' || plan === 'pro' || plan === 'enterprise') {
    return plan;
  }
  return 'basic';
};

export default function InviteManagementDashboard() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const isMobile = useIsMobile();

  // Theming system
  const theming = useTheming('prototype_tester');
  // Lys oransje aksent på mørk bakgrunn (matcher admin-skallet).
  const themeColors = { ...theming.colors, primary: '#ff8c00' };

  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  // Fetch invite requests
  const { data: inviteData, isLoading } = useQuery({
    queryKey: ['/api/invites/admin/requests'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/invites/admin/requests', { headers });
  },
    refetchInterval: 30000
});

  const invitations = Array.isArray(inviteData?.invitations) ? inviteData.invitations : [];
  const stats = inviteData?.stats || {};

  // Update invite status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ inviteId, status, notes }: { inviteId: string; status: string; notes: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/invites/admin/requests/${inviteId}/status`, {
        method: 'PUT',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ status, adminNotes: notes })
      });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invites/admin/requests'] });
      setShowReviewDialog(false);
      setSelectedInvite(null);
      setAdminNotes('');
  }
});

  const [mainView, setMainView] = useState<'invites' | 'fiken'>('invites');
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedInvite, setSelectedInvite] = useState<InviteRequest | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Send invite email mutation
  const sendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/invites/admin/requests/${inviteId}/send-invite`, {
        method: 'POST',
        headers
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invites/admin/requests'] });
  }
});

  const handleReviewInvite = (invite: InviteRequest) => {
    setSelectedInvite(invite);
    setReviewStatus(invite.status);
    setAdminNotes(', ');
    setShowReviewDialog(true);
};

  const handleUpdateStatus = () => {
    if (selectedInvite) {
      updateStatusMutation.mutate({
        inviteId: selectedInvite.id,
        status: reviewStatus,
        notes: adminNotes
  });
  }
};

  const handleSendInvite = (inviteId: string) => {
    sendInviteMutation.mutate(inviteId);
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'under_review': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
}
};

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
}
};

  const getProfessionLabel = (profession: string) => {
    return getProfessionDisplayName(profession);
  };

  // User journey status helpers
  const journeySteps = [
    { key: 'request_submitted', label: 'Søknad sendt', icon: <Assignment /> },
    { key: 'under_review', label: 'Under vurdering', icon: <Visibility /> },
    { key: 'invite_sent', label: 'Invitasjon sendt', icon: <Email /> },
    { key: 'account_created', label: 'Konto opprettet', icon: <PersonAdd /> },
    { key: 'onboarding_started', label: 'Onboarding startet', icon: <HowToReg /> },
    { key: 'onboarding_completed', label: 'Onboarding fullført', icon: <CheckCircle /> },
    { key: 'active', label: 'Aktiv bruker', icon: <Verified /> },
  ];

  const getJourneyStepIndex = (status?: UserJourneyStatus): number => {
    if (!status) return 0;
    const index = journeySteps.findIndex(s => s.key === status);
    return index >= 0 ? index : 0;
  };

  const getJourneyStatusLabel = (status?: UserJourneyStatus): string => {
    const step = journeySteps.find(s => s.key === status);
    return step?.label || 'Ukjent';
  };

  const getJourneyStatusColor = (status?: UserJourneyStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'request_submitted': return 'default';
      case 'under_review': return 'warning';
      case 'invite_sent': return 'info';
      case 'account_created': return 'primary';
      case 'onboarding_started': return 'secondary';
      case 'onboarding_completed': return 'success';
      case 'active': return 'success';
      default: return 'default';
    }
  };

  const filteredInvitations = invitations.filter((invite: any) => {
    switch (currentTab) {
      case 1: return invite.status === 'pending';
      case 2: return invite.status === 'under_review';
      case 3: return invite.status === 'approved';
      case 4: return invite.status === 'rejected';
      default: return true;
}
});

  if (isLoading) {
    return (
      <ThemeProvider theme={adminDarkTheme}>
        <Box sx={{ p: 3 }}>
          <LinearProgress />
          <Typography sx={{ mt: 2, textAlign: 'center' }}>
            Laster invitasjonsdata...
          </Typography>
        </Box>
      </ThemeProvider>
    );
}

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h2" sx={{ mb: 3, color: themeColors.primary }}>
        Invitasjonshåndtering
      </Typography>

      {/* Main View Tabs - Invites vs Fiken */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={mainView}
          onChange={(_, v) => setMainView(v)}
          sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontWeight: 500,
            }
          }}
        >
          <Tab
            value="invites"
            label="Invitasjonsforespørsler"
            icon={<Group />}
            iconPosition="start"
          />
          <Tab
            value="fiken"
            label="Fiken-integrasjon"
            icon={<AccountBalance />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Fiken Integration Panel */}
      {mainView === 'fiken' && (
        <FikenIntegrationRequestsPanel />
      )}

      {/* Invites Panel */}
      {mainView === 'invites' && (
        <>
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <MuiCard sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Group sx={{ color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: themeColors.primary }}>{stats.totalRequests || 0}</Typography>
                  <Typography variant="body2">Totale søknader</Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <MuiCard sx={{ backgroundColor: 'rgba(255, 1520.1)' }}>
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: themeColors.primary }}>{stats.pendingReview || 0}</Typography>
                  <Typography variant="body2">Venter på godkjenning</Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MuiCard sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: themeColors.primary }}>{stats.approved || 0}</Typography>
                  <Typography variant="body2">Godkjente</Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MuiCard sx={{ backgroundColor: 'rgba(255, 107, 53, 0.1)' }}>
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp sx={{ color: '#ff6b35', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: themeColors.primary }}>{Math.round(stats.conversionRate || 0)}%</Typography>
                  <Typography variant="body2">Konverteringsrate</Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Tabs for filtering */}
      <Paper sx={{ mb: 3 }} >
        <Tabs 
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              color: 'text.secondary','&.Mui-selected': {
                color: '#ff6b35'
          }
          }, '& .MuiTabs-indicator': {
              backgroundColor: '#ff6b35'
        }
        }}
        >
          <Tab label={`Alle (${invitations.length})`} />
          <Tab label={`Venter (${invitations.filter((i: any) => i.status === 'pending').length})`} />
          <Tab label={`Under vurdering (${invitations.filter((i: any) => i.status === 'under_review').length})`} />
          <Tab label={`Godkjent (${invitations.filter((i: any) => i.status === 'approved').length})`} />
          <Tab label={`Avvist (${invitations.filter((i: any) => i.status === 'rejected').length})`} />
        </Tabs>
      </Paper>

      {/* Invitations Table */}
      <Paper style={{ height: 600, width: '100%' }}>
        {/*
          Virtualisert tabell (react-virtuoso) – rendrer kun synlige rader, så
          DOM-en holder seg lett uansett hvor mange invitasjoner som vises.
          Samme mønster som RefundRequestsTable/PaymentMethodsTable.
        */}
        <TableVirtuoso
          data={filteredInvitations}
          components={{
            Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
              <TableContainer component={Paper} {...props} ref={ref} />
            )),
            Table: (props) => (
              <Table {...props} sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }} />
            ),
            TableHead: React.forwardRef<HTMLTableSectionElement, TableHeadProps>((props, ref) => (
              <TableHead {...props} ref={ref} />
            )),
            TableRow: ({ item: _item, ...props }) => <TableRow {...props} hover />,
            TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
              <TableBody {...props} ref={ref} />
            )),
          }}
          fixedHeaderContent={() => (
            <TableRow>
              <TableCell sx={{ width: 200, fontWeight: 600 }}>Bedrift</TableCell>
              <TableCell sx={{ width: 200, fontWeight: 600 }}>Kontakt</TableCell>
              <TableCell sx={{ width: 130, fontWeight: 600 }}>Profesjon</TableCell>
              <TableCell sx={{ width: 140, fontWeight: 600 }}>Abonnement</TableCell>
              <TableCell sx={{ width: 120, fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ width: 150, fontWeight: 600 }}>Brukerreise</TableCell>
              <TableCell sx={{ width: 110, fontWeight: 600 }}>Risiko</TableCell>
              <TableCell sx={{ width: 110, fontWeight: 600 }}>Dato</TableCell>
              <TableCell sx={{ width: 110, fontWeight: 600 }}>Handlinger</TableCell>
            </TableRow>
          )}
          itemContent={(_index, invite: any) => (
            <>
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {invite.businessName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {invite.orgNumber}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell>
                  <Box>
                    <Typography variant="body2">{invite.contactName}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {invite.contactEmail}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell>
                  <Chip
                    label={getProfessionLabel(invite.profession)}
                    variant="outlined"
                    size="small"
                  />
                  {(() => {
                    // Team-forespørsel? Parses fra «[Team: N medlemmer]» i meldingen.
                    // Ved godkjenning settes prototype-master + max_team_size = N.
                    const msg = String((invite as any).message || "");
                    const m = msg.match(/\[Team:\s*(\d+)\s*medlemmer?\]/i);
                    return m ? (
                      <Chip
                        label={`👥 Team (${m[1]})`}
                        size="small"
                        color="info"
                        sx={{ ml: 0.5, fontWeight: 700 }}
                      />
                    ) : null;
                  })()}
                </TableCell>

                {/* Subscription Plan */}
                <TableCell>
                  {invite.planName ? (
                    <Tooltip title={invite.planPrice ? `${invite.planPrice} kr/mnd` : ', '}>
                      <Chip
                        label={invite.planName}
                        icon={<CreditCard />}
                        variant="outlined"
                        size="small"
                        color="primary"
                      />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="textSecondary">-</Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Chip
                    label={invite.status}
                    color={getStatusColor(invite.status)}
                    size="small"
                  />
                </TableCell>

                {/* User Journey Status */}
                <TableCell>
                  <Tooltip title={`Steg ${getJourneyStepIndex(invite.userJourneyStatus) + 1} av ${journeySteps.length}`}>
                    <Chip
                      label={getJourneyStatusLabel(invite.userJourneyStatus)}
                      color={getJourneyStatusColor(invite.userJourneyStatus)}
                      size="small"
                      variant="filled"
                    />
                  </Tooltip>
                </TableCell>

                <TableCell>
                  {invite.redFlagAnalysis && (
                    <Tooltip title={`Score: ${invite.redFlagAnalysis.score}/100`}>
                      <Chip
                        label={invite.redFlagAnalysis.riskLevel}
                        color={getRiskColor(invite.redFlagAnalysis.riskLevel)}
                        size="small"
                        icon={invite.redFlagAnalysis.flags.length > 0 ? <Flag /> : undefined}
                      />
                    </Tooltip>
                  )}
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {new Date(invite.createdAt).toLocaleDateString('nb-NO')}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Se detaljer">
                      <IconButton
                        size="small"
                        aria-label="Se detaljer"
                        onClick={() => handleReviewInvite(invite)}
                      >
                        {theming.getThemedIcon('visibility')}
                      </IconButton>
                    </Tooltip>

                    {invite.status === 'approved' && !invite.inviteSentAt && (
                      <Tooltip title="Send invitasjon">
                        <IconButton
                          size="small"
                          aria-label="Send invitasjon"
                          onClick={() => handleSendInvite(invite.id)}
                          disabled={sendInviteMutation.isPending}
                        >
                          {theming.getThemedIcon('email')}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
            </>
          )}
        />
      </Paper>

      {/* Review Dialog */}
      <Dialog
        open={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Vurder invitasjon - {selectedInvite?.businessName}
        </DialogTitle>
        
        <DialogContent>
          {selectedInvite && (
            <Box sx={{ pt: 2 }}>
              {/* User Journey Stepper */}
              <MuiCard sx={{ mb: 3, backgroundColor: 'rgba(255,107,53,0.05)' }}>
                <CardContent>
                  <Typography variant="h6" component="h3" sx={{ mb: 2, color: themeColors.primary }}>
                    Brukerreise
                  </Typography>
                  <Stepper
                    activeStep={getJourneyStepIndex(selectedInvite.userJourneyStatus)}
                    alternativeLabel
                    connector={<JourneyConnector />}
                  >
                    {journeySteps.map((step, index) => (
                      <Step key={step.key} completed={index < getJourneyStepIndex(selectedInvite.userJourneyStatus)}>
                        <StepLabel
                          StepIconComponent={() => (
                            <Box sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: index <= getJourneyStepIndex(selectedInvite.userJourneyStatus)
                                ? (index < getJourneyStepIndex(selectedInvite.userJourneyStatus) ? '#4caf50' : '#ff6b35')
                                : 'rgba(0,0,0,0.1)',
                              color: index <= getJourneyStepIndex(selectedInvite.userJourneyStatus) ? 'white' : 'text.disabled'
                            }}>
                              {step.icon}
                            </Box>
                          )}
                        >
                          <Typography variant="caption" sx={{
                            color: index <= getJourneyStepIndex(selectedInvite.userJourneyStatus) ? 'text.primary' : 'text.disabled'
                          }}>
                            {step.label}
                          </Typography>
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>

                  {/* Journey timestamps */}
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {selectedInvite.inviteSentAt && (
                      <Chip
                        size="small"
                        label={`Invitasjon sendt: ${new Date(selectedInvite.inviteSentAt).toLocaleDateString('nb-NO')}`}
                        icon={<Email />}
                      />
                    )}
                    {selectedInvite.onboardingStartedAt && (
                      <Chip
                        size="small"
                        label={`Onboarding startet: ${new Date(selectedInvite.onboardingStartedAt).toLocaleDateString('nb-NO')}`}
                        icon={<HowToReg />}
                      />
                    )}
                    {selectedInvite.onboardingCompletedAt && (
                      <Chip
                        size="small"
                        label={`Onboarding fullført: ${new Date(selectedInvite.onboardingCompletedAt).toLocaleDateString('nb-NO')}`}
                        icon={<CheckCircle />}
                        color="success"
                      />
                    )}
                  </Box>
                </CardContent>
              </MuiCard>

              {/* Subscription Plan Info */}
              {selectedInvite.planName && (
                <MuiCard sx={{ mb: 3, backgroundColor: 'rgba(33,150,243,0.05)' }}>
                  <CardContent>
                    <Typography variant="h6" component="h3" sx={{ mb: 2, color: themeColors.primary }}>
                      Valgt abonnement
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CreditCard sx={{ color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {selectedInvite.planName}
                        </Typography>
                        {selectedInvite.planPrice && (
                          <Typography variant="body2" color="textSecondary">
                            {selectedInvite.planPrice} kr/mnd
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </MuiCard>
              )}

              {/* Business Information */}
              <MuiCard sx={{ mb: 3, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <CardContent>
                  <Typography variant="h6" component="h3" sx={{ mb: 2, color: themeColors.primary }}>
                    Bedriftsinformasjon
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Bedriftsnavn: </Typography>
                      <Typography variant="body1">{selectedInvite.businessName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Org.nr: </Typography>
                      <Typography variant="body1">{selectedInvite.orgNumber}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Kontaktperson: </Typography>
                      <Typography variant="body1">{selectedInvite.contactName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">E-post: </Typography>
                      <Typography variant="body1">{selectedInvite.contactEmail}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </MuiCard>

              {/* Plan Feature Preview - Shows what features this user will get */}
              {selectedInvite.profession && (
                <MuiCard sx={{ mb: 3, backgroundColor: 'rgba(255,138,0,0.05)' }}>
                  <CardContent>
                    <Typography variant="h6" component="h3" sx={{ mb: 2, color: themeColors.primary }}>
                      📦 Funksjoner for denne brukeren
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Basert på yrke ({selectedInvite.profession}) og valgt plan ({selectedInvite.selectedPlan || 'basic'})
                    </Typography>
                    <PlanFeaturePreview
                      profession={selectedInvite.profession}
                      selectedPlan={normalizePlan(selectedInvite.selectedPlan)}
                      showLocked={true}
                      showDetails={true}
                      maxFeatures={10}
                    />
                  </CardContent>
                </MuiCard>
              )}

              {/* Red Flag Analysis */}
              {selectedInvite.redFlagAnalysis && (
                <MuiCard sx={{ mb: 3, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <CardContent>
                    <Typography variant="h6" component="h3" sx={{ mb: 2, color: themeColors.primary }}>
                      Risikoanalyse
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Chip
                        label={`${selectedInvite.redFlagAnalysis.riskLevel} risiko`}
                        color={getRiskColor(selectedInvite.redFlagAnalysis.riskLevel)}
                      />
                      <Typography sx={{ ml: 2 }}>
                        Score: {selectedInvite.redFlagAnalysis.score}/100
                      </Typography>
                    </Box>

                    {selectedInvite.redFlagAnalysis.flags.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Red flags: </Typography>
                        {selectedInvite.redFlagAnalysis.flags.map((flag, index) => (
                          <Alert
                            key={index}
                            severity={flag.severity === 'critical' ? 'error' : 'warning'}
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="body2">
                              <strong>{flag.category}:</strong> {flag.message}
                            </Typography>
                          </Alert>
                        ))}
                      </>
                    )}
                  </CardContent>
                </MuiCard>
              )}

              {/* Review Controls */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="pending">Venter</MenuItem>
                  <MenuItem value="under_review">Under vurdering</MenuItem>
                  <MenuItem value="approved">Godkjent</MenuItem>
                  <MenuItem value="rejected">Avvist</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Admin notater"
                multiline
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Legg til notater om vurderingen..."
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setShowReviewDialog(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleUpdateStatus}
            loading={updateStatusMutation.isPending}
          >
            Oppdater status
          </AdminButton>
        </DialogActions>
      </Dialog>
        </>
      )}
    </Box>
    </ThemeProvider>
  );
}
