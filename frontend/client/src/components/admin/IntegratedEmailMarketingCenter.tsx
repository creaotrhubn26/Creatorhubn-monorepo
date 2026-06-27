import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Campaign,
  ContactMail,
  Mail,
  Notifications,
  NotificationsActive,
  People,
  Send,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useTheming } from '../../utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';
import { AdminButton, StatusChip, useIsMobile } from './design-system';

interface EmailContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  company?: string;
  status: 'lead' | 'prospect' | 'customer' | 'inactive';
  createdAt: string;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  totalSent?: number;
  totalOpen?: number;
}

interface EmailList {
  id: string;
  name: string;
  description?: string;
  contactCount?: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category?: string;
}

interface EmailAnalytics {
  totalCampaigns: number;
  totalContacts: number;
  totalEmailsSent: number;
  averageOpenRate: number;
}

interface ContactFormState {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  status: EmailContact['status'];
}

interface QuickEmailState {
  to: string;
  subject: string;
  body: string;
}

function buildUrl(path: string, email?: string): string {
  if (!email) {
    return path;
  }
  const search = new URLSearchParams({ email });
  return `${path}?${search.toString()}`;
}

function ensureArray<T>(payload: unknown, key?: string): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && typeof payload === 'object' && key) {
    const candidate = (payload as Record<string, unknown>)[key];
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }
  return [];
}

function normalizeAnalytics(payload: unknown): EmailAnalytics {
  if (payload && typeof payload === 'object') {
    const source = payload as Record<string, unknown>;
    return {
      totalCampaigns: Number(source.totalCampaigns ?? 0),
      totalContacts: Number(source.totalContacts ?? 0),
      totalEmailsSent: Number(source.totalEmailsSent ?? 0),
      averageOpenRate: Number(source.averageOpenRate ?? 0),
    };
  }
  return {
    totalCampaigns: 0,
    totalContacts: 0,
    totalEmailsSent: 0,
    averageOpenRate: 0,
  };
}

interface TabPanelProps {
  index: number;
  value: number;
  children: React.ReactNode;
}

function TabPanel({ index, value, children }: TabPanelProps): JSX.Element {
  if (value !== index) {
    return <></>;
  }
  return <Box sx={{ p: 3 }}>{children}</Box>;
}

export default function IntegratedEmailMarketingCenter(): JSX.Element {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');
  const isMobile = useIsMobile();

  const currentUser = auth.state.user;
  const adminEmail = currentUser?.email;
  const userId = currentUser?.id || '';

  const [tabValue, setTabValue] = useState(0);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [quickEmailOpen, setQuickEmailOpen] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormState>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    status: 'lead',
  });
  const [quickEmail, setQuickEmail] = useState<QuickEmailState>({
    to: '',
    subject: '',
    body: '',
  });

  const { pushEnabled, isSupported } = usePushNotifications(userId);

  const contactsQuery = useQuery<EmailContact[]>({
    queryKey: ['/api/email-marketing/contacts', { email: adminEmail }],
    enabled: Boolean(adminEmail),
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(buildUrl('/api/email-marketing/contacts', adminEmail), { headers });
      return ensureArray<EmailContact>(response, 'contacts');
    },
  });

  const campaignsQuery = useQuery<EmailCampaign[]>({
    queryKey: ['/api/email-marketing/campaigns', { email: adminEmail }],
    enabled: Boolean(adminEmail),
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(buildUrl('/api/email-marketing/campaigns', adminEmail), { headers });
      return ensureArray<EmailCampaign>(response, 'campaigns');
    },
  });

  const listsQuery = useQuery<EmailList[]>({
    queryKey: ['/api/email-marketing/lists', { email: adminEmail }],
    enabled: Boolean(adminEmail),
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(buildUrl('/api/email-marketing/lists', adminEmail), { headers });
      return ensureArray<EmailList>(response, 'lists');
    },
  });

  const templatesQuery = useQuery<EmailTemplate[]>({
    queryKey: ['/api/email-marketing/templates', { email: adminEmail }],
    enabled: Boolean(adminEmail),
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(buildUrl('/api/email-marketing/templates', adminEmail), { headers });
      return ensureArray<EmailTemplate>(response, 'templates');
    },
  });

  const analyticsQuery = useQuery<EmailAnalytics>({
    queryKey: ['/api/email-marketing/analytics', { email: adminEmail }],
    enabled: Boolean(adminEmail),
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(buildUrl('/api/email-marketing/analytics', adminEmail), { headers });
      return normalizeAnalytics(response);
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (payload: ContactFormState) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/email-marketing/contacts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: {
          ...payload,
          adminEmail,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-marketing/contacts'] });
      setContactDialogOpen(false);
      setContactForm({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        status: 'lead',
      });
    },
  });

  const sendQuickEmailMutation = useMutation({
    mutationFn: async (payload: QuickEmailState) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/email-marketing/send-single', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: {
          ...payload,
          adminEmail,
        },
      });
    },
    onSuccess: () => {
      setQuickEmailOpen(false);
      setQuickEmail({ to: '', subject: '', body: '' });
    },
  });

  const contacts = contactsQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const lists = listsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const activeLeads = useMemo(
    () => contacts.filter((contact) => contact.status === 'lead' || contact.status === 'prospect').length,
    [contacts]
  );

  const isLoading =
    contactsQuery.isLoading ||
    campaignsQuery.isLoading ||
    listsQuery.isLoading ||
    templatesQuery.isLoading ||
    analyticsQuery.isLoading;

  const handleCreateContact = (): void => {
    if (!contactForm.firstName.trim() || !contactForm.email.trim()) {
      return;
    }
    createContactMutation.mutate(contactForm);
  };

  const handleSendQuickEmail = (): void => {
    if (!quickEmail.to.trim() || !quickEmail.subject.trim() || !quickEmail.body.trim()) {
      return;
    }
    sendQuickEmailMutation.mutate(quickEmail);
  };

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2 }}>
      <Paper
        sx={{
          borderRadius: '16px 16px 0 0',
          p: 3,
          mb: 0,
          ...theming.getThemedCardSx(),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
              Integrert E-postmarkedsføring & CRM
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Kontaktadministrasjon, kampanjer, lister, maler og analyse i ett panel.
            </Typography>
          </Box>
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton
                aria-label="Push-varsler innstillinger"
                onClick={() => setPushSettingsOpen(true)}
                sx={{ color: pushEnabled ? theming.colors.primary : 'text.secondary' }}
              >
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue: number) => setTabValue(newValue)}>
          <Tab label="CRM Kontakter" icon={<ContactMail />} iconPosition="start" />
          <Tab label="E-postkampanjer" icon={<Campaign />} iconPosition="start" />
          <Tab label="Kampanjelister" icon={<People />} iconPosition="start" />
          <Tab label="E-postmaler" icon={<Mail />} iconPosition="start" />
          <Tab label="Analyse" icon={<Campaign />} iconPosition="start" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" component="h3" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
            CRM Kontakter
          </Typography>
          <Button variant="contained" onClick={() => setContactDialogOpen(true)} sx={theming.getThemedButtonSx()}>
            Ny kontakt
          </Button>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Totale kontakter
                </Typography>
                <Typography variant="h4">{contacts.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Aktive leads
                </Typography>
                <Typography variant="h4">{activeLeads}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Kunder
                </Typography>
                <Typography variant="h4">{contacts.filter((contact) => contact.status === 'customer').length}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper sx={{ mt: 3, p: 2, ...theming.getThemedCardSx() }}>
          {contactsQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : contacts.length === 0 ? (
            <Typography color="text.secondary">Ingen kontakter funnet.</Typography>
          ) : (
            <Grid container spacing={1}>
              {contacts.map((contact) => (
                <Grid key={contact.id} size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {contact.firstName} {contact.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {contact.email || 'Ingen e-post'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {contact.company || 'Ingen bedrift'}
                    </Typography>
                    <StatusChip status={contact.status} sx={{ mt: 1 }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h5" component="h3" sx={{ color: theming.colors.primary, fontWeight: 700, mb: 2 }}>
          E-postkampanjer
        </Typography>
        {campaignsQuery.isLoading ? (
          <CircularProgress />
        ) : (
          <Grid container spacing={2}>
            {campaigns.map((campaign) => (
              <Grid key={campaign.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6">{campaign.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {campaign.subject}
                    </Typography>
                    <StatusChip status={campaign.status} />
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="body2">Sendt: {campaign.totalSent ?? 0}</Typography>
                    <Typography variant="body2">Åpnet: {campaign.totalOpen ?? 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h5" component="h3" sx={{ color: theming.colors.primary, fontWeight: 700, mb: 2 }}>
          Kampanjelister
        </Typography>
        <Grid container spacing={2}>
          {lists.map((list) => (
            <Grid key={list.id} size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6">{list.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {list.description || 'Ingen beskrivelse'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Kontakter: {list.contactCount ?? 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Typography variant="h5" component="h3" sx={{ color: theming.colors.primary, fontWeight: 700, mb: 2 }}>
          E-postmaler
        </Typography>
        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid key={template.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6">{template.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {template.subject}
                  </Typography>
                  {template.category && <Chip sx={{ mt: 1 }} size="small" label={template.category} />}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Typography variant="h5" component="h3" sx={{ color: theming.colors.primary, fontWeight: 700, mb: 2 }}>
          Kampanjeanalyse
        </Typography>
        {analytics ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Totale kampanjer
                  </Typography>
                  <Typography variant="h4">{analytics.totalCampaigns}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Totale kontakter
                  </Typography>
                  <Typography variant="h4">{analytics.totalContacts}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Sendte e-poster
                  </Typography>
                  <Typography variant="h4">{analytics.totalEmailsSent}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Åpningsrate
                  </Typography>
                  <Typography variant="h4">{analytics.averageOpenRate.toFixed(1)}%</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Typography color="text.secondary">Ingen analysedata tilgjengelig.</Typography>
        )}
      </TabPanel>

      <Fab
        color="primary"
        aria-label="Send hurtig e-post"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setQuickEmailOpen(true)}
      >
        <Send />
      </Fab>

      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Opprett ny kontakt</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            fullWidth
            label="Fornavn"
            value={contactForm.firstName}
            onChange={(event) => setContactForm((prev) => ({ ...prev, firstName: event.target.value }))}
          />
          <TextField
            margin="dense"
            fullWidth
            label="Etternavn"
            value={contactForm.lastName}
            onChange={(event) => setContactForm((prev) => ({ ...prev, lastName: event.target.value }))}
          />
          <TextField
            margin="dense"
            fullWidth
            label="E-post"
            type="email"
            value={contactForm.email}
            onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <TextField
            margin="dense"
            fullWidth
            label="Bedrift"
            value={contactForm.company}
            onChange={(event) => setContactForm((prev) => ({ ...prev, company: event.target.value }))}
          />
          <TextField
            margin="dense"
            fullWidth
            label="Status (lead/prospect/customer/inactive)"
            value={contactForm.status}
            onChange={(event) =>
              setContactForm((prev) => ({
                ...prev,
                status: (event.target.value as EmailContact['status']) || 'lead',
              }))
            }
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setContactDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton tone="primary" onClick={handleCreateContact} loading={createContactMutation.isPending}>
            Opprett
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={quickEmailOpen} onClose={() => setQuickEmailOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>Send hurtig e-post</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            fullWidth
            label="Til"
            type="email"
            value={quickEmail.to}
            onChange={(event) => setQuickEmail((prev) => ({ ...prev, to: event.target.value }))}
          />
          <TextField
            margin="dense"
            fullWidth
            label="Emne"
            value={quickEmail.subject}
            onChange={(event) => setQuickEmail((prev) => ({ ...prev, subject: event.target.value }))}
          />
          <TextField
            margin="dense"
            fullWidth
            multiline
            minRows={6}
            label="Melding"
            value={quickEmail.body}
            onChange={(event) => setQuickEmail((prev) => ({ ...prev, body: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setQuickEmailOpen(false)}>Avbryt</AdminButton>
          <AdminButton tone="primary" onClick={handleSendQuickEmail} loading={sendQuickEmailMutation.isPending}>
            Send
          </AdminButton>
        </DialogActions>
      </Dialog>

      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <AdminButton tone="ghost" onClick={() => setPushSettingsOpen(false)}>Lukk</AdminButton>
          </DialogActions>
        </Dialog>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={18} />
        </Box>
      )}
    </Box>
  );
}
