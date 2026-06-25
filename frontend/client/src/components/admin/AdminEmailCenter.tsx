import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import type { CommunicationMessage } from '@/integration/CrossComponentCommunication';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Typography,
  Button,
  TextField,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Badge,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Email,
  Send,
  Article,
  People,
  Announcement,
  SystemUpdate,
  CheckCircle,
  ErrorOutline,
  AttachFile,
  Science,
  Edit,
  DesignServices as DesignIcon,
  Notifications,
  NotificationsActive,
  Refresh,
} from '@mui/icons-material';
import EmailDesignerComplete from '../EmailDesigner/EmailDesignerComplete';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  description: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-email-tabpanel-${index}`}
      aria-labelledby={`admin-email-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AdminEmailCenter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Check for invitation data from query params
  const [invitationData, setInvitationData] = React.useState<any>(null);
  
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'send-invitation') {
      setInvitationData({
        action: params.get('action'),
        type: params.get('type'),
        recipientEmail: params.get('recipientEmail'),
        recipientName: params.get('recipientName'),
        profession: params.get('profession'),
        testingAreas: params.get('testingAreas') ? JSON.parse(params.get('testingAreas') || '[]') : [],
        experience: params.get('experience'),
        requestId: params.get('requestId')
      });
      
      // Auto-open compose dialog with pre-filled data
      setShowComposeDialog(true);
      setTabValue(4); // Switch to Pending Invitations tab
    }
  }, []);
  
  // Get Gmail user info from authenticated session
  const { data: gmailUserInfo } = useQuery({
    queryKey: ['/api/gmail/test-all-google-services'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/gmail/test-all-google-services', { headers });
    }
});

  // Fetch email templates
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/admin/email-templates'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/email-templates?email=user?.email', { headers });
    }
});

  // Send custom email mutation via Gmail API
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/gmail/send-api-direct', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST',
        body: JSON.stringify(emailData)
    });
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
      setShowComposeDialog(false);
      resetEmailForm();
      
      // Broadcast email sent event
      communication.sendBroadcast('admin:email:send', {
        type: 'custom-email',
        data,
        component: 'AdminEmailCenter'
    });
  }
});

  const [tabValue, setTabValue] = useState(0);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showEmailDesigner, setShowEmailDesigner] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [emailForm, setEmailForm] = useState({
    to: '',
    cc: ', ',
    bcc: '',
    subject: ', ',
    html: '',
    text: ''
});
  const [quickEmailType, setQuickEmailType] = useState('');
  const [currentInvitationForDesigner, setCurrentInvitationForDesigner] = useState<any>(null);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = user?.id || (user as { sub?: string })?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Fetch pending invitations for the new tab
  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['/api/prototype-tester-requests'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/prototype-tester-requests', { headers });
    },
    select: (data) => data.filter((req: any) => req.status === 'pending')
  });

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'AdminEmailCenter',
      name: 'Admin Email Center',
      category: 'admin',
      capabilities: ['email-management', 'template-management', 'gmail-integration']
    });

    // Set up data flow nodes
    const emailTemplatesNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'AdminEmailCenter',
      dataKey: 'email-templates'
  });

    const gmailUserInfoNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'AdminEmailCenter',
      dataKey: 'gmail-user-info'
  });

    // Listen for email events
    const refreshUnsubscribe = (communication.onMessageType as any)('admin:email:refresh', (message: CommunicationMessage) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] });
  });

    const sendUnsubscribe = (communication.onMessageType as any)('admin:email:send', (message: CommunicationMessage) => {
      if (message.data?.emailData) {
        sendEmailMutation.mutate(message.data.emailData);
    }
  });

    return () => {
      dataFlow.unregisterNode(emailTemplatesNodeId);
      dataFlow.unregisterNode(gmailUserInfoNodeId);
      if (typeof refreshUnsubscribe === 'function') refreshUnsubscribe();
      if (typeof sendUnsubscribe === 'function') sendUnsubscribe();
  };
}, [templates, gmailUserInfo, componentRegistry, dataFlow, communication, queryClient, sendEmailMutation]);

  // Send welcome email mutation
  const sendWelcomeMutation = useMutation({
    mutationFn: async (adminEmail: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/send-welcome-email?email=user?.email', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST',
        body: JSON.stringify({ adminEmail })
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
  }
});

  // Send dashboard access email mutation
  const sendDashboardAccessMutation = useMutation({
    mutationFn: async (data: { userEmail: string; dashboards: string[] }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/send-dashboard-access-email?email=user?.email', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
  }
});

  // Send feature announcement mutation
  const sendFeatureAnnouncementMutation = useMutation({
    mutationFn: async (data: { recipients: string[]; featureName: string; description: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/send-feature-announcement?email=user?.email', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
  }
});

  const resetEmailForm = () => {
    setEmailForm({
      to: '',
      cc: ', ',
      bcc: '',
      subject: ', ',
      html: '',
      text: ''
  });
    setSelectedTemplate(null);
};

  const handleSendEmail = () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.html) {
      return;
  }

    const emailData = {
      ...emailForm,
      cc: emailForm.cc ? emailForm.cc.split('').map(e => e.trim()) : undefined,
      bcc: emailForm.bcc ? emailForm.bcc.split('').map(e => e.trim()) : undefined
  };

    sendEmailMutation.mutate(emailData);
};

  const handleQuickEmail = (type: string, data: any) => {
    switch (type) {
      case 'welcome':
        sendWelcomeMutation.mutate(data.email);
        break;
      case 'dashboard_access':
        sendDashboardAccessMutation.mutate(data);
        break;
      case 'feature_announcement':
        sendFeatureAnnouncementMutation.mutate(data);
        break;
  }
};

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEmailForm(prev => ({
      ...prev,
      subject: template.subject,
      html: template.htmlTemplate
  }));
    setShowComposeDialog(true);
  };
  
  const generatePrototypeTesterInvitationHTML = (invite: any) => {
    // Generate HTML email template for prototype tester invitation
    const registrationUrl = `https://creatorhubn.com/register?invitation=token_${invite.id}`;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e65100, #ff6f00); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">CreatorHub Norge</h1>
          <p style="color: white; margin: 10px 0; font-size: 18px;">Du er godkjent som Prototype Tester!</p>
        </div>
        
        <div style="padding: 30px;">
          <h2 style="color: #1f2937;">Gratulerer, ${invite.name}!</h2>
          
          <p style="font-size: 16px;">Vi er glade for å informere deg om at din forespørsel om tilgang til CreatorHub Norge som <strong>Prototype Tester</strong> har blitt <strong>godkjent</strong>!</p>
          
          <div style="background: #f0fdf4; border: 2px solid #22c55e; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #16a34a; margin-top: 0;">Du vil, teste: ${invite.profession}</h3>
            <p style="margin: 10px 0;">Du har blitt tildelt å teste funksjoner for <strong>${invite.profession}</strong> profesjonen.</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${registrationUrl}," 
                 style="background: linear-gradient(135deg, #e65100, #ff6f00); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Opprett Min Konto
              </a>
            </div>
          </div>
          
          <h3 style="color: #1f2937;">Dine testing områder:</h3>
          <ul style="line-height: 1.6;">
            ${invite.testingAreas?.map((area: string) => `<li>${area}</li>`).join('') || '<li>All features</li>'}
          </ul>
          
          <h3 style="color: #1f2937;">Hva får du tilgang til?</h3>
          <ul style="line-height: 1.6;">
            <li>Test alle funksjoner for ${invite.profession}</li>
            <li>Rapporter bugs og gi tilbakemelding</li>
            <li>Delta i testing missions og tjen rewards</li>
            <li>Early access til beta features</li>
            <li>Direkte kommunikasjon med utviklingsteamet</li>
          </ul>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Tips:</strong> Invitasjonen er gyldig i 7 dager. Hvis du ikke oppretter kontoen innen den tid, kontakt oss på hello@creatorhubn.com.</p>
          </div>
          
          <p>Velkommen til CreatorHub Norge - vi ser frem til din feedback!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Med vennlig hilsen,<br>
              CreatorHub Norge Testing Team<br>
             daniel@creatorhubn.com
            </p>
          </div>
        </div>
      </div>
    `;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <MuiCard sx={{ mb: 3 }}>
        <MuiCardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Email sx={{ color: '#ea4335', fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                Admin E-postsenter
              </Typography>
              <Chip 
                label={gmailUserInfo?.authenticated ? `Gmail: ${gmailUserInfo?.userEmail || 'Tilkoblet'}` : "Gmail API"}
                color={gmailUserInfo?.authenticated ? "success" : "primary"}
                size="small"
                icon={gmailUserInfo?.authenticated ? <CheckCircle /> : <ErrorOutline />}
              />
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Oppdater maler">
                <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/email-templates'] })}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              {isSupported && (
                <Tooltip title="Push-varsler innstillinger">
                  <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                    {pushEnabled ? <NotificationsActive /> : <Notifications />}
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Send profesjonelle e-post via autentisert Gmail-konto med OAuth2 fra admin-dashbordet
          </Typography>
        </MuiCardContent>
      </MuiCard>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab icon={<Email />} label="Skriv E-post" />
          <Tab icon={<Article />} label="Maler" />
          <Tab icon={<People />} label="Hurtig E-post" />
          <Tab icon={<Announcement />} label="Kunngjøringer" />
          <Tab 
            icon={
              <Badge badgeContent={pendingInvitations.length} color="error">
                <SystemUpdate />
              </Badge>
            } 
            label="Pending Invitations" 
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <MuiCard>
          <MuiCardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Skriv Ny E-post</Typography>
              <Button variant="contained"
                startIcon={<Send />}
                onClick={() => setShowComposeDialog(true)}
                sx={{ bgcolor: '#ea4335', '&:hover': { bgcolor: '#d33b2c' } }}
              >
                Ny E-post
              </Button>
            </Box>

            {/* Zero Toast Compliance - Info as Typography only */}
            <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
              E-post sendes via Google Gmail API som {gmailUserInfo?.userEmail || 'user?.email'} - OAuth2 autentisert
              {gmailUserInfo?.authenticated && <CheckCircle sx={{ ml: 1, fontSize: 16 }} />}
            </Typography>

            {/* Zero Toast Compliance - Success feedback through Typography */}
            {(sendEmailMutation.isSuccess || sendWelcomeMutation.isSuccess || 
              sendDashboardAccessMutation.isSuccess || sendFeatureAnnouncementMutation.isSuccess) && (
              <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'success.contrastText' }}>
                E-post sendt via {sendEmailMutation.data?.provider || 'Gmail API'}
              </Typography>
            )}

            {/* Zero Toast Compliance - Error feedback through Typography */}
            {(sendEmailMutation.error || sendWelcomeMutation.error || 
              sendDashboardAccessMutation.error || sendFeatureAnnouncementMutation.error) && (
              <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, color: 'error.contrastText' }}>
                Feil ved sending av e-post
              </Typography>
            )}
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <MuiCard>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>E-postmaler</Typography>
            <Grid container spacing={2}>
              {templates.map((template: any) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <MuiCard sx={{ 
                    cursor: 'pointer',
                    transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
                }}>
                    <MuiCardContent onClick={() => handleTemplateSelect(template)}>
                      <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {template.description}
                      </Typography>
                      <Chip label={template.subject} size="small" variant="outlined" />
                    </MuiCardContent>
                  </MuiCard>
                </Grid>
              ))}
            </Grid>
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <MuiCard>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>Hurtig E-post</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <MuiCard sx={{ textAlign: 'center', p: 2 }}>
                  <People sx={{ fontSize: 48, color: '#60a5fa', mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Velkomst E-post</Typography>
                  <TextField
                    fullWidth
                    placeholder="admin@eksempel.no"
                    sx={{ mb: 2 }}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  />
                  <Button variant="contained"
                    fullWidth
                    onClick={() => handleQuickEmail('welcome', { email: emailForm.to })}
                    sx={theming.getThemedButtonSx()}
                    disabled={!emailForm.to || sendWelcomeMutation.isPending}
                  >
                    {sendWelcomeMutation.isPending ? <CircularProgress size={20} /> : 'Send Velkomst'}
                  </Button>
                </MuiCard>
              </Grid>

              <Grid item xs={12} md={4}>
                <MuiCard sx={{ textAlign: 'center', p: 2 }}>
                  <CheckCircle sx={{ fontSize: 48, color: '#4caf50', mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Dashboard Tilgang</Typography>
                  <TextField
                    fullWidth
                    placeholder="bruker@eksempel.no"
                    sx={{ mb: 1 }}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  />
                  <TextField
                    fullWidth
                    select
                    label="Dashboards"
                    sx={{ mb: 2 }}
                    SelectProps={{ multiple: true }}
                    value={emailForm.cc ? emailForm.cc.split('') : []}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, cc: Array.isArray(e.target.value) ? e.target.value.join(', ') : e.target.value }))}
                  >
                    <MenuItem value="photographer">{getProfessionDisplayName('photographer')}</MenuItem>
                    <MenuItem value="videographer">{getProfessionDisplayName('videographer')}</MenuItem>
                    <MenuItem value="music_producer">{getProfessionDisplayName('music_producer')}</MenuItem>
                    <MenuItem value="vendor">{getProfessionDisplayName('vendor')}</MenuItem>
                  </TextField>
                  <Button variant="contained"
                    fullWidth
                    onClick={() => handleQuickEmail('dashboard_access', {
                      userEmail: emailForm.to,
                      dashboards: emailForm.cc ? emailForm.cc.split(', ') : []
                  })}
                    sx={theming.getThemedButtonSx()}
                    disabled={!emailForm.to || !emailForm.cc || sendDashboardAccessMutation.isPending}
                  >
                    {sendDashboardAccessMutation.isPending ? <CircularProgress size={20} /> : 'Send Tilgang'}
                  </Button>
                </MuiCard>
              </Grid>

              <Grid item xs={12} md={4}>
                <MuiCard sx={{ textAlign: 'center', p: 2 }}>
                  <Announcement sx={{ fontSize: 48, color: '#ff9800', mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Funksjons-kunngjøring</Typography>
                  <TextField
                    fullWidth
                    placeholder="Mottakere (kommaseparert)"
                    sx={{ mb: 1 }}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  />
                  <TextField
                    fullWidth
                    placeholder="Funksjonsnavn"
                    sx={{ mb: 1 }}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  />
                  <TextField
                    fullWidth
                    placeholder="Beskrivelse"
                    multiline
                    rows={2}
                    sx={{ mb: 2 }}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, html: e.target.value }))}
                  />
                  <Button variant="contained"
                    fullWidth
                    onClick={() => handleQuickEmail('feature_announcement', {
                      recipients: emailForm.to ? emailForm.to.split(', ').map(e => e.trim()) : [],
                      featureName: emailForm.subject,
                      description: emailForm.html
                  })}
                    sx={theming.getThemedButtonSx()}
                    disabled={!emailForm.to || !emailForm.subject || !emailForm.html || sendFeatureAnnouncementMutation.isPending}
                  >
                    {sendFeatureAnnouncementMutation.isPending ? <CircularProgress size={20} /> : 'Send Kunngjøring'}
                  </Button>
                </MuiCard>
              </Grid>
            </Grid>
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <MuiCard>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>System Kunngjøringer</Typography>
            {/* Zero Toast Compliance - Info as Typography only */}
            <Typography variant="body2" sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
              Administrer systemkunngjøringer og oppdateringsmeldinger til alle brukere
            </Typography>
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <MuiCard>
          <MuiCardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <Science sx={{ color: '#e65100', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Pending Prototype Tester Invitations
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Send custom or standard invitation emails to approved prototype testers
                </Typography>
              </Box>
              {pendingInvitations.length > 0 && (
                <Chip 
                  label={`${pendingInvitations.length} pending`} 
                  color="error" 
                  size="small"
                />
              )}
            </Stack>

            {/* Pre-filled invitation from query params */}
            {invitationData && (
              <Typography variant="body2" sx={{ mb: 3, p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'success.contrastText' }}>
                <CheckCircle sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                Invitation pre-filled for: <strong>{invitationData.recipientName}</strong> ({invitationData.recipientEmail})
              </Typography>
            )}

            {pendingInvitations.length === 0 ? (
              <Typography variant="body2" sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
                No pending prototype tester invitations. Check back later or use admin-invite-system to approve applications.
              </Typography>
            ) : (
              <List>
                {pendingInvitations.map((invite: any) => (
                  <ListItem 
                    key={invite.id}
                    sx={{ 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 1, 
                      mb: 2,
                      bgcolor: invitationData?.requestId === invite.id.toString() ? 'primary.light' : 'background.paper'
                    }}
                  >
                    <ListItemIcon>
                      <Science sx={{ color: '#e65100' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                            {invite.name}
                          </Typography>
                          <Chip label={invite.profession} size="small" color="primary" />
                          <Chip label={invite.experience} size="small" variant="outlined" />
                        </Stack>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {invite.email}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Testing areas: {invite.testingAreas?.join('') || 'Not specified'}
                          </Typography>
                        </Box>
                      }
                    />
                    <Stack direction="column" spacing={1} sx={{ minWidth: 200 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Email />}
                        onClick={() => {
                          // Pre-fill compose dialog with standard template
                          setEmailForm({
                            to: invite.email,
                            cc: '',
                            bcc: '',
                            subject: `Velkommen til CreatorHub Norge - Prototype Tester (${invite.profession})`,
                            html: generatePrototypeTesterInvitationHTML(invite),
                            text: ', '
                          });
                          setShowComposeDialog(true);
                        }}
                        fullWidth
                      >
                        Send Standard Email
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<Edit />}
                        onClick={() => {
                          // Open EmailDesigner modal with invitation data
                          setCurrentInvitationForDesigner({
                            recipientEmail: invite.email,
                            recipientName: invite.name,
                            role: 'prototype_tester',
                            profession: invite.profession,
                            token: `token_${invite.id}`, // Generate real token in backend
                            testingAreas: invite.testingAreas || [],
                            experience: invite.experience
                          });
                          setShowEmailDesigner(true);
                        }}
                        fullWidth
                        sx={theming.getThemedButtonSx()}
                      >
                        Open Designer
                      </Button>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            )}
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Compose Email Dialog */}
      <Dialog open={showComposeDialog} onClose={() => setShowComposeDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Email sx={{ color: '#ea4335' }} />
            Skriv E-post
            {selectedTemplate && (
              <Chip label={`Mal: ${selectedTemplate.name}`} size="small" color="primary" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Til"
                value={emailForm.to}
                onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                placeholder="mottaker@eksempel.no"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="CC (valgfritt)"
                value={emailForm.cc}
                onChange={(e) => setEmailForm(prev => ({ ...prev, cc: e.target.value }))}
                placeholder="cc@eksempel.no, cc2@eksempel.no"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="BCC (valgfritt)"
                value={emailForm.bcc}
                onChange={(e) => setEmailForm(prev => ({ ...prev, bcc: e.target.value }))}
                placeholder="bcc@eksempel.no"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Emne"
                value={emailForm.subject}
                onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="HTML Innhold"
                value={emailForm.html}
                onChange={(e) => setEmailForm(prev => ({ ...prev, html: e.target.value }))}
                multiline
                rows={10}
                placeholder="HTML e-post innhold..."
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<AttachFile />}
                size="small"
                sx={{ mr: 1 }}
              >
                Legg til vedlegg
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<DesignIcon />}
                onClick={() => {
                  setCurrentInvitationForDesigner({
                    recipientEmail: emailForm.to,
                    recipientName: ', ',
                    role: 'admin',
                    profession: 'photographer',
                    token: ', ',
                    testingAreas: [],
                    experience: ''
                  });
                  setShowComposeDialog(false);
                  setShowEmailDesigner(true);
                }}
                fullWidth
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white','&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)',
                  }
                }}
              >
                Åpne Visuell E-postdesigner
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComposeDialog(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSendEmail}
            variant="contained"
            disabled={!emailForm.to || !emailForm.subject || !emailForm.html || sendEmailMutation.isPending}
            startIcon={sendEmailMutation.isPending ? <CircularProgress size={20} /> : <Send />}
            sx={{ bgcolor: '#ea4335','&:hover': { bgcolor: '#d33b2c' } }}
          >
            Send E-post
          </Button>
        </DialogActions>
      </Dialog>

      {/* EmailDesigner Modal for Custom Invitation Emails */}
      <Dialog 
        open={showEmailDesigner} 
        onClose={() => setShowEmailDesigner(false)} 
        maxWidth="xl" 
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Edit sx={{ color: '#ea4335' }} />
              <Box>
                <Typography variant="h6">
                  Email Designer - Prototype Tester Invitation
                </Typography>
                {currentInvitationForDesigner && (
                  <Typography variant="caption" color="text.secondary">
                    For: {currentInvitationForDesigner.recipientName} ({currentInvitationForDesigner.profession})
                  </Typography>
                )}
              </Box>
            </Box>
            <Button 
              variant="outlined" 
              onClick={() => setShowEmailDesigner(false)}
            >
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {currentInvitationForDesigner && (
            <EmailDesignerComplete
              context="general"
              profession={currentInvitationForDesigner.profession || 'photographer'}
              userId={user?.id}
              onSave={(template) => {
                // When designer saves, use the generated HTML for sending
                setEmailForm({
                  to: currentInvitationForDesigner.recipientEmail,
                  cc: ', ',
                  bcc: ', ',
                  subject: template.subject,
                  html: template.html,
                  text: ''
                });
                setShowEmailDesigner(false);
                setShowComposeDialog(true); // Open compose dialog with generated HTML
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
