import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  Snackbar,
} from '@mui/material';
import {
  TrendingUp,
  Assignment,
  Phone,
  Email,
  AttachMoney,
  Person,
  Business,
  EventNote,
  StarRate,
  VideoCall,
  Add,
  Schedule,
  WorkOutline,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface SalesAnalytics {
  totalLeads: number;
  activeDeals: number;
  conversionRate: number;
  totalValue: number;
  averageDealSize: number;
  salesCycle: number;
  closedDeals: number;
  monthlyTarget: number;
  topSources: Array<{ source: string; leads: number; conversion: number }>;
}

interface SalesLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  projectType: string;
  status: string;
  source: string;
  value: number;
  probability: number;
  timeline?: string;
  lastContact: string;
  nextFollow: string;
  customerType?: string;
  estimatedValue?: number;
  eventDate?: string;
  location?: string;
  notes?: string;
}

const PIPELINE_STAGES = [
  { key: 'cold', label: 'Kald Lead', color: '#9e9e9e' },
  { key: 'warm', label: 'Varm Lead', color: '#ff9800' },
  { key: 'hot', label: 'Het Lead', color: '#f44336' },
  { key: 'qualified', label: 'Kvalifisert', color: '#2196f3' },
  { key: 'proposal', label: 'Tilbud Sendt', color: '#9c27b0' },
  { key: 'negotiation', label: 'Forhandling', color: '#ff5722' },
  { key: 'closed', label: 'Avsluttet Won', color: '#4caf50' },
  { key: 'lost', label: 'Avsluttet Lost', color: '#607d8b' }
];

interface CentralizedSalesHubProps {
  profession?: string;
  userId?: string;
  onLeadConverted?: (lead: SalesLead, projectData: any) => void;
  onMeetingScheduled?: (lead: SalesLead, meetingData: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void
}

export default function CentralizedSalesHub({ 
  profession = 'photographer,', 
  userId = 'current_user',
  onLeadConverted,
  onMeetingScheduled,
  selectedProject,
  onProjectSelect,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: CentralizedSalesHubProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('all,');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const queryClient = useQueryClient();
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Notification state
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'info',
  });
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  // Client service pricing service integration (for future use)
  // const { formatCurrency: formatCurrencyFromService } = useClientServicePricing();

  // Fetch sales analytics
  const { data: analytics = {} as SalesAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/sales/analytics', userId],
    queryFn: () => apiRequest(`/api/sales/analytics/${userId}`),
    retry: false,
});

  // Fetch sales leads
  const { data: leadsRaw = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/sales/leads', selectedStatus, userId],
    queryFn: () => apiRequest(`/api/sales/leads/${selectedStatus}?userId=${userId}`),
    retry: false,
});
  const leads = Array.isArray(leadsRaw) ? leadsRaw : [];

  // Update lead status mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, updates }: { leadId: string; updates: any }) => {
      return apiRequest(`/api/sales/leads/${leadId}`, {
        headers: {
          "Content-Type" : "application/json"
        },
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/leads', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/sales/analytics', ],});
      setDialogOpen(false);
  }
});

  // Convert lead to project mutation
  const convertLeadToProjectMutation = useMutation({
    mutationFn: async (lead: SalesLead) => {
      const projectData = {
        projectName: `${lead.name} - ${lead.projectType || 'Prosjekt'}`,
        clientName: lead.name,
        clientEmail: lead.email,
        projectType: lead.projectType || 'wedding',
        totalBudget: lead.estimatedValue || lead.value,
        eventDate: lead.eventDate || ', ',
        location: lead.location || ', ',
        notes: lead.notes || ', ',
        source: 'sales_lead',
        leadId: lead.id,
        profession: profession
  };
      
      const response = await apiRequest('/api/projects', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(projectData)
  });
      
      return { project: response, lead };
  },
    onSuccess: (data: any) => {
      // Update lead status to 'converted'
      updateLeadMutation.mutate({
        leadId: data.lead.id,
        updates: { status: 'converted', projectId: data.project.id }
      });
      
      // Notify parent component
      if (onLeadConverted) {
        onLeadConverted(data.lead, data.project);
    }
      
      setShowProjectDialog(false);
  }
});

  // Schedule meeting mutation
  const scheduleMeetingMutation = useMutation({
    mutationFn: async ({ lead, meetingData }: { lead: SalesLead; meetingData: any }) => {
      const meetingPayload = {
        title: `Møte med ${lead.name}`,
        description: `Salgsmøte for ${lead.projectType || 'prosjekt'}`,
        participants: [lead.email],
        type: 'client_meeting',
        projectType: lead.projectType,
        leadId: lead.id,
        profession: profession,
        ...meetingData
    };
      
      const response = await apiRequest('/api/google-meet/create', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(meetingPayload)
  });
      
      return { meeting: response, lead };
  },
    onSuccess: (data: any) => {
      // Update lead status to 'meeting_scheduled'
      updateLeadMutation.mutate({
        leadId: data.lead.id,
        updates: { status: 'meeting_scheduled', meetingId: data.meeting.id }
      });
      
      // Notify parent component
      if (onMeetingScheduled) {
        onMeetingScheduled(data.lead, data.meeting);
    }
      
      setShowMeetingDialog(false);
  }
});

  const getStatusColor = (status: string) => {
    const stage = PIPELINE_STAGES.find(s => s.key === status);
    return stage?.color || '#9e9e9e';
};

  const formatCurrencyLocal = (amount: number) => {
    return new Intl.NumberFormat('no-NO', { style: 'currency', currency: 'NOK' }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary, mb: 1 }}>
          Salgsmanagement
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Komplett CRM-system for {getProfessionDisplayName(profession).toLowerCase()}er
        </Typography>
      </Box>

      {/* Analytics Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>Totale Leads</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{analytics.totalLeads || 0}</Typography>
                </Box>
                <TrendingUp color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>Aktive Deals</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{analytics.activeDeals || 0}</Typography>
                </Box>
                <Assignment color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>Konverteringsrate</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{analytics.conversionRate || 0}%</Typography>
                </Box>
                <StarRate color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>Total Verdi</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{formatCurrencyLocal(analytics.totalValue || 0)}</Typography>
                </Box>
                <AttachMoney color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progress toward monthly target */}
      {analytics.monthlyTarget > 0 && (
        <Card sx={{ mb:  4 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Månedlig Mål</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <Box sx={{ flexGrow:  1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(100, ((analytics.totalValue || 0) / analytics.monthlyTarget) * 100)}
                  sx={{ height:  10, borderRadius:  1 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {formatCurrencyLocal(analytics.totalValue || 0)} av {formatCurrencyLocal(analytics.monthlyTarget)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Box sx={{ mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Pipeline" />
          <Tab label="Leads Liste" />
          <Tab label="Statistikk" />
        </Tabs>
      </Box>

      {/* Pipeline View */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((lead: SalesLead) => lead.status === stage.key);
            const stageValue = stageLeads.reduce((sum: number, lead: SalesLead) => sum + (lead.value || 0), 0);
            
            return (
              <Grid item xs={12} md={3} key={stage.key}>
                <Card sx={{ minHeight: 400, borderTop: `4px solid ${stage.color}`, ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {stage.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {stageLeads.length} leads • {formatCurrencyLocal(stageValue)}
                    </Typography>
                    
                    <List dense>
                      {stageLeads.map((lead: SalesLead) => (
                        <ListItem 
                          key={lead.id}
                            sx={{ 
                            p: 1, mb: 1, bgcolor: 'grey.50', 
                            borderRadius: 1,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedLead(lead);
                            setDialogOpen(true);
                        }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: stage.color, width:  32, height: 32}}>
                              <Person fontSize="small" />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" noWrap>
                                {lead.name}
                              </Typography>
                          }
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {lead.projectType}
                                </Typography>
                                <Typography variant="caption" color="primary">
                                  {formatCurrencyLocal(lead.value || 0)}
                                </Typography>
                              </Box>
                          }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            );
        })}
        </Grid>
      )}

      {/* Leads List View */}
      {activeTab === 1 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Alle Leads</Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedStatus}
                  label="Status"
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  {PIPELINE_STAGES.map((stage) => (
                    <MenuItem key={stage.key} value={stage.key}>{stage.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {leadsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p:  3 }}>
                <Typography>Laster leads...</Typography>
              </Box>
            ) : leads.length === 0 ? (
              <Alert severity="info">Ingen leads funnet for valgt status</Alert>
            ) : (
              <List>
                {leads.map((lead: SalesLead) => (
                  <ListItem key={lead.id} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getStatusColor(lead.status) }}>
                        {lead.company ? theming.getThemedIcon('business') : theming.getThemedIcon('person')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                          <Typography variant="subtitle1">{lead.name}</Typography>
                          <Chip 
                            label={PIPELINE_STAGES.find(s => s.key === lead.status)?.label || lead.status}
                            size="small"
                            sx={{ bgcolor: getStatusColor(lead.status), color: 'white' }}
                          />
                        </Box>
                    }
                      secondary={
                        <Box sx={{ mt:  1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {lead.projectType} • {formatCurrencyLocal(lead.value || 0)} • {lead.probability}% sannsynlighet
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Email fontSize="small" />
                              <Typography variant="caption">{lead.email}</Typography>
                            </Box>
                            {lead.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Phone fontSize="small" />
                                <Typography variant="caption">{lead.phone}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                    }
                    />
                    <Box sx={{ display: 'flex', gap:  1 }}>
                      {lead.status === 'proposal' && (
                        <Button 
                          size="small" 
                          variant="outlined"
                          startIcon={<DescriptionIcon />}
                          onClick={async () => {
                            try {
                              // Create contract/quote from lead
                              const contractData = {
                                clientName: lead.name,
                                clientEmail: lead.email,
                                projectDescription: lead.projectType || 'Prosjekt',
                                totalAmount: lead.value || 0,
                                status: 'draft',
                                leadId: lead.id,
                                profession: profession,
                              };
                              
                              const response = await apiRequest('/api/contracts', {
                                method: 'POST',
                                headers: { 'Content-Type' : 'application/json' },
                                body: JSON.stringify(contractData),
                              });
                              
                              if (response.success || response.contract) {
                                showNotification('Kontrakt opprettet fra lead!','success');
                                // Update lead status
                                updateLeadMutation.mutate({
                                  leadId: lead.id,
                                  updates: { status: 'negotiation', contractId: response.contract?.id }
                                });
                              }
                            } catch (error: any) {
                              console.error('Error creating contract from lead: ', error);
                              showNotification('Kunne ikke opprette kontrakt. Prøv igjen.','error');
                            }
                          }}
                          sx={{ borderColor: '#9c27b0', color: '#9c27b0', '&:hover': { borderColor: '#7b1fa2', bgcolor: '#9c27b020' } }}
                        >
                          Kontrakt
                        </Button>
                      )}
                      <Button 
                        size="small" 
                        variant="outlined"
                        startIcon={<VideoCall />}
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowMeetingDialog(true);
                        }}
                        disabled={lead.status === 'closed' || lead.status === 'lost'}
                      >
                        Møte
                      </Button>
                      <Button size="small" 
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowProjectDialog(true);
                        }}
                        disabled={lead.status === 'closed' || lead.status === 'lost'}
                        sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                      >
                        Prosjekt
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => {
                          setSelectedLead(lead);
                          setDialogOpen(true);
                        }}
                      >
                        Rediger
                      </Button>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics View */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Toppkilder</Typography>
                <List>
                  {analytics.topSources?.map((source: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={source.source}
                        secondary={`${source.leads} leads • ${source.conversion.toFixed(1)}% konvertering`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Nøkkelmetrikker</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Gjennomsnittlig dealstørrelse</Typography>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{formatCurrencyLocal(analytics.averageDealSize || 0)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Salgsyklus</Typography>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{analytics.salesCycle || 0} dager</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Avsluttede deals</Typography>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{analytics.closedDeals || 0}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Lead Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rediger Lead</DialogTitle>
        <DialogContent>
          {selectedLead && (
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap:  2 }}>
              <TextField
                label="Navn"
                value={selectedLead.name}
                onChange={(e) => setSelectedLead({...selectedLead, name: e.target.value})}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedLead.status}
                  label="Status"
                  onChange={(e) => setSelectedLead({...selectedLead, status: e.target.value})}
                >
                  {PIPELINE_STAGES.map((stage) => (
                    <MenuItem key={stage.key} value={stage.key}>{stage.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Verdi (NOK)"
                type="number"
                value={selectedLead.value}
                onChange={(e) => setSelectedLead({...selectedLead, value: Number(e.target.value)})}
                fullWidth
              />
              <TextField
                label="Sannsynlighet (%)"
                type="number"
                value={selectedLead.probability}
                onChange={(e) => setSelectedLead({...selectedLead, probability: Number(e.target.value)})}
                inputProps={{ min: 0, max: 100}}
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" 
            onClick={() => selectedLead && updateLeadMutation.mutate({
              leadId: selectedLead.id,
              updates: {
                status: selectedLead.status,
                value: selectedLead.value,
                probability: selectedLead.probability
              }
            })}
            disabled={updateLeadMutation.isPending}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meeting Scheduling Dialog */}
      <Dialog open={showMeetingDialog} onClose={() => setShowMeetingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideoCall color="primary" />
            Planlegg møte med {selectedLead?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Møtetittel"
              value={`Møte med ${selectedLead?.name}`}
              fullWidth
              disabled
            />
            <TextField
              label="Dato"
              type="date"
              value={new Date().toISOString().split('T')[0]}
              onChange={(e) => {/* Handle date change */}}
              fullWidth
            />
            <TextField
              label="Tid"
              type="time"
              value="10:00"
              onChange={(e) => {/* Handle time change */}}
              fullWidth
            />
            <TextField
              label="Varighet (minutter)"
              type="number"
              value={60}
              onChange={(e) => {/* Handle duration change */}}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              multiline
              rows={3}
              value={`Salgsmøte for ${selectedLead?.projectType || 'prosjekt'}`}
              onChange={(e) => {/* Handle description change */}}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMeetingDialog(false)}>Avbryt</Button>
          <Button variant="contained"
            onClick={() => selectedLead && scheduleMeetingMutation.mutate({
              lead: selectedLead,
              meetingData: {
                date: new Date().toISOString().split('T')[0],
                time: '10:00',
                duration: 60
              }
            })}
            disabled={scheduleMeetingMutation.isPending}
            sx={{ bgcolor: '#2196f3' }}
          >
            {scheduleMeetingMutation.isPending ? 'Planlegger...' : 'Planlegg møte'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Creation Dialog */}
      <Dialog open={showProjectDialog} onClose={() => setShowProjectDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Add color="success" />
            Opprett prosjekt fra lead: {selectedLead?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info" sx={{ mb:  2 }}>
              Dette vil opprette et nytt prosjekt basert på lead-informasjonen og oppdatere lead-statusen til "Konvertert".
            </Alert>
            <TextField
              label="Prosjektnavn"
              value={`${selectedLead?.name} - ${selectedLead?.projectType || 'Prosjekt'}`}
              fullWidth
              disabled
            />
            <TextField
              label="Klientnavn"
              value={selectedLead?.name}
              fullWidth
              disabled
            />
            <TextField
              label="E-post"
              value={selectedLead?.email}
              fullWidth
              disabled
            />
            <TextField
              label="Prosjekttype"
              value={selectedLead?.projectType || 'wedding'}
              fullWidth
              disabled
            />
            <TextField
              label="Estimert verdi"
              value={formatCurrencyLocal(selectedLead?.value || 0)}
              fullWidth
              disabled
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectDialog(false)}>Avbryt</Button>
          <Button variant="contained"
            onClick={() => selectedLead && convertLeadToProjectMutation.mutate(selectedLead)}
            disabled={convertLeadToProjectMutation.isPending}
            sx={{ bgcolor: '#4caf50' }}
          >
            {convertLeadToProjectMutation.isPending ? 'Oppretter...' : 'Opprett prosjekt'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}