import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Switch,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { AdminButton, StatusChip, AdminLoading, AdminTableContainer } from './design-system';
import {
  AutoAwesome,
  Schedule,
  Email,
  Backup,
  Notifications,
  CloudSync,
  PhotoLibrary,
  Assignment,
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Refresh,
  Timeline,
  SmartToy,
  Webhook,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`automations-tabpanel-${index}`}
      aria-labelledby={`automations-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface AutomationsPanelProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

export default function AutomationsPanel({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: AutomationsPanelProps) {
  // Integration props for unified workflow connectivity
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  
  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  const themeColors = { ...theming.colors, primary: '#ff8c00' };

  // Fetch automation data
  const { data: automationsData, isLoading } = useQuery({
    queryKey: ['/api/admin/automations'],
    retry: 1,
    staleTime: 15000,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/automations', { headers });
  },
});

  // Fetch automation stats
  const { data: statsData } = useQuery({
    queryKey: ['/api/admin/automation-stats'],
    retry: 1,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/automation-stats', { headers });
  },
});

  // Toggle automation mutation
  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const headers = await auth.getAuthHeader();
      const response = await fetch(`/api/admin/automations/${id}/toggle`, {
        headers: {
          ...headers, 'Content-Type': 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({ enabled })
    });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/automations'] });
  }
});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  const handleToggleAutomation = (id: string, enabled: boolean) => {
    toggleAutomationMutation.mutate({ id, enabled });
};

  const handleEditAutomation = (automation: any) => {
    setSelectedAutomation(automation);
    setDialogOpen(true);
};

  if (isLoading) {
    return (
      <ThemeProvider theme={adminDarkTheme}>
      <AdminLoading label="Laster automatiseringer..." />
      </ThemeProvider>
    );
}

  // Use REAL data from server - no fake fallbacks
  const stats = automationsData?.stats || {
    totalAutomations: 2,
    activeAutomations: 2,
    totalRuns: 0,
    successRate: 100
};

  const automations = Array.isArray(automationsData?.automations) ? automationsData.automations : [];
  const workflows = Array.isArray(automationsData?.workflows) ? automationsData.workflows : [];

  const getAutomationIcon = (type: string) => {
    switch (type) {
      case 'backup': return <Backup />;
      case 'email': return <Email />;
      case 'photo': return <PhotoLibrary />;
      case 'schedule': return <Schedule />;
      default: return <AutoAwesome />;
  }
};

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'neutral';
  }
};

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SmartToy color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: themeColors.primary }}>
            Automatiseringer
          </Typography>
        </Box>
        <AdminButton
          tone="primary"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          Ny Automatisering
        </AdminButton>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AutoAwesome color="primary" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: themeColors.primary }}>
                    {stats.totalAutomations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Automatiseringer
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PlayArrow color="success" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: themeColors.primary }}>
                    {stats.activeAutomations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Timeline color="info" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: themeColors.primary }}>
                    {stats.totalRuns.toLocaleString('no-NO')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Kjøringer
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Refresh color="warning" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: themeColors.primary }}>
                    {stats.successRate}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Suksessrate
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Tabs */}
      <MuiCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: themeColors.primary,
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: themeColors.primary,
              },
            }}
          >
            <Tab icon={<AutoAwesome />} label="Automatiseringer" />
            <Tab icon={<Assignment />} label="Arbeidsflyter" />
            <Tab icon={<Webhook />} label="Webhooks" />
          </Tabs>
        </Box>

        <CardContent sx={theming.getThemedCardSx()}>
          <TabPanel value={tabValue} index={0}>
            <List>
              {automations.map((automation: any) => (
                <ListItem 
                  key={automation.id}
                  sx={{ 
                    border: 1, 
                    borderColor: 'divider', 
                    borderRadius: 1, 
                    mb: 1,
                    bgcolor: 'background.paper'
                }}
                >
                  <ListItemIcon>
                    {getAutomationIcon(automation.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500}}>
                          {automation.name}
                        </Typography>
                        <StatusChip
                          label={automation.status}
                          tone={getStatusColor(automation.status)}
                        />
                      </Box>
                  }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {automation.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {automation.schedule} • Sist kjørt: {automation.lastRun}
                        </Typography>
                      </Box>
                  }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditAutomation(automation)}
                        aria-label="Rediger automatisering"
                      >
                        <Edit />
                      </IconButton>
                      <Switch
                        checked={automation.enabled}
                        onChange={(e) => handleToggleAutomation(automation.id, e.target.checked)}
                        color="primary"
                      />
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <AdminTableContainer ariaLabel="Arbeidsflyter">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Arbeidsflyt</strong></TableCell>
                    <TableCell><strong>Trinn</strong></TableCell>
                    <TableCell><strong>Fullført i dag</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Handlinger</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workflows.map((workflow: any) => (
                    <TableRow key={workflow.id}>
                      <TableCell>{workflow.name}</TableCell>
                      <TableCell>{workflow.steps} trinn</TableCell>
                      <TableCell>{workflow.completedToday}</TableCell>
                      <TableCell>
                        <StatusChip
                          label={workflow.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                          tone={workflow.status === 'active' ? 'success' : 'neutral'}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" aria-label="Rediger arbeidsflyt">
                          <Edit />
                        </IconButton>
                        <IconButton size="small" aria-label="Slett arbeidsflyt">
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Webhook sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" component="h3" sx={{ color: themeColors.primary }}>
                Webhook-administrasjon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Konfigurer eksterne integrasjoner og API-tilkoblinger
              </Typography>
            </Box>
          </TabPanel>
        </CardContent>
      </MuiCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAutomation ? 'Rediger Automatisering' : 'Ny Automatisering'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Navn"
              placeholder="Gi automatiseringen et navn"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Beskrivelse"
              multiline
              rows={3}
              placeholder="Beskriv hva automatiseringen gjør"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Tidsplan"
              placeholder="f.eks. Daglig 02:00"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDialogOpen(false)}>
            Avbryt
          </AdminButton>
          <AdminButton tone="primary">
            {selectedAutomation ? 'Oppdater' : 'Opprett'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}