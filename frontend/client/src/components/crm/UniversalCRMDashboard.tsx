/**
 * Universal CRM Dashboard - Integrates with UniversalDashboard and ProfessionAdapter
 * Works across all professions (photographer, videographer, music producer, etc.)
 */

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { Box, Typography, Grid, Card, CardContent, Button, Chip, TextField, FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Alert, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider } from '@mui/material';
import { AddCircle as AddIcon, Search as SearchIcon, Business as BusinessIcon, VideoCall, WorkOutline, Add, Schedule, Assessment as AssessmentIcon, AccountBalance as SplitSheetIcon, Description as ContractIcon } from '@mui/icons-material';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '../../hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import BusinessIntelligenceDashboard from '../business-intelligence/BusinessIntelligenceDashboard';

interface UniversalCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  profession?: string;
  projectType?: string;
  budget?: number;
  status: 'lead' | 'prospect' | 'active' | 'completed' | 'archived';
  tags: string[];
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, any>;
}

interface EventContext {
  id: string;
  name: string;
}

interface CRMDashboardProps {
  profession?: string;
  onCustomerSelect?: (customer: UniversalCustomer) => void;
  onProjectCreate?: (customer: UniversalCustomer, projectData: any) => void;
  onMeetingSchedule?: (customer: UniversalCustomer, meetingData: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  eventContext?: EventContext;
  linkedCustomersForEvent?: string[];
  onLinkToEvent?: (customer: UniversalCustomer, opts: { role: string; notes?: string }) => void;
}

export default function UniversalCRMDashboard({ 
  profession, 
  onCustomerSelect,
  onProjectCreate,
  onMeetingSchedule,
  selectedProject,
  onProjectSelect,
  eventContext,
  linkedCustomersForEvent = [],
  onLinkToEvent,
}: CRMDashboardProps) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession || 'photographer,');
  
  // Comprehensive Feature System for Universal CRM Dashboard
  const crmDashboardAccess = features.checkFeatureAccess('universal-crm,');
  const customerManagementAccess = features.checkFeatureAccess('customer-management, ');
  const leadManagementAccess = features.checkFeatureAccess('lead-management');
  const projectManagementAccess = features.checkFeatureAccess('project-management');
  const contactManagementAccess = features.checkFeatureAccess('contact-management');
  const crmAnalyticsAccess = features.checkFeatureAccess('crm-analytics');
  const salesTrackingAccess = features.checkFeatureAccess('sales-tracking');
  const communicationTrackingAccess = features.checkFeatureAccess('communication-tracking');

  const queryClient = useQueryClient();
  const { profession: currentProfession, adaptTabLabels, adaptDashboardTitle } = useProfessionAdapter();
  const { getCurrentUserProfession, getProfessionDisplayName, getUserProfessionColor } = useDynamicProfessions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<UniversalCustomer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<UniversalCustomer | null>(null);
  const [showBIDialog, setShowBIDialog] = useState(false);

  // Link to event dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkRole, setLinkRole] = useState<string>('Client');
  const [linkNotes, setLinkNotes] = useState<string>('');
  const [showContractsDialog, setShowContractsDialog] = useState(false);
  const [customerContracts, setCustomerContracts] = useState<any[]>([]);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('universal-crm-dashboard','dashboard', [
      'data: read','data: write','event: emit','event: listen','ui: update','crm: manage','customer: manage','project: manage','meeting: manage','analytics: track','notification: manage'
    ]);

    // Track feature usage
    features.trackFeatureUsage('universal-crm', 'opened', {
      timestamp: Date.now(),
      component: 'UniversalCRMDashboard',
      profession: currentProfession,
      userId: userId
});

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-crm-dashboard',
      dataKey: 'universal-crm-dashboard:customers',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now()})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-crm-dashboard',
      dataKey: 'universal-crm-dashboard:projects',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now()})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-crm-dashboard',
      dataKey: 'universal-crm-dashboard:meetings',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now()})
    });

    return () => {
      communication.unregisterComponent('universal-crm-dashboard');
    };
  }, [communication, dataFlow]);

  // Listen to global events
  useEffect(() => {
    const unsubscribe = communication.onMessage(async (message: any) => {
      if (message.type === 'project:selected' && message.data) {
        if (onProjectSelect) {
          onProjectSelect(message.data);
        }
      }
      if ((message.type === 'customer: selected' || message.type === 'customer:selected') && message.data) {
        if (onCustomerSelect) {
          onCustomerSelect(message.data);
        }
      }
      // When any customer update event is emitted, sync with Google Contacts
      if (
        (message.type === 'customer:updated' ||
          message.type === 'customer:changed' ||
          message.type === 'crm:customer:update') &&
        message.data
      ) {
        await syncCustomerToGoogle(message.data as UniversalCustomer);
      }
      if (message.type === 'data: sync' && message.data?.dataKey === 'universal-crm-dashboard:customers') {
        // Optional: bulk sync could be added here if needed
      }
    });
    return unsubscribe;
  }, [communication, onProjectSelect, onCustomerSelect, activeProfession]);

  // Use profession from props or context with dynamic fallback
  const activeProfession = profession || currentProfession || getCurrentUserProfession();
  const tabLabels = adaptTabLabels();
  
  // Define terminology based on profession using dynamic system
  const terminology = {
    customerManagement: getCustomerManagementLabel(activeProfession),
    projects: tabLabels.projects,
    project: getProjectLabel(activeProfession),
    professionName: getProfessionDisplayName(activeProfession)
};

  // Dynamic helper functions for profession-specific terminology
  function getCustomerManagementLabel(profession: string): string {
    const labelMap: Record<string, string> = {
      photographer: 'Kundestyring',
      videographer: 'Kundestyring',
      music_producer: 'Artiststyring',
      vendor: 'Bestillingstyring'
};
    return labelMap[profession] || 'Kundestyring';
}

  function getProjectLabel(profession: string): string {
    const labelMap: Record<string, string> = {
      photographer: 'Prosjekt',
      videographer: 'Video',
      music_producer: 'Lå',
      vendor: 'Produkt'
};
    return labelMap[profession] || 'Prosjekt';
}
  
  const colors = {
    primary: getUserProfessionColor(activeProfession),
    secondary: getUserProfessionColor(activeProfession) // Using dynamic color system
};

  // Fetch customers for the current profession
  const { data: customersData, isLoading, error } = useQuery({
    queryKey: ['universal-crm-customers', activeProfession, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeProfession) params.append('profession', activeProfession);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/universal-crm/customers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
  }
});

  // Fetch CRM statistics
  const { data: statsData } = useQuery({
    queryKey: ['universal-crm-stats', activeProfession],
    queryFn: async () => {
      const params = activeProfession ? `?profession=${activeProfession}` : '';
      const response = await fetch(`/api/universal-crm/stats${params}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
  }
});

  // Fetch split sheet statistics (only for music producers)
  const isMusicProducer = activeProfession === 'music_producer';
  const { data: splitSheetStatsData } = useQuery({
    queryKey: ['split-sheets-crm-stats', activeProfession],
    queryFn: async () => {
      const response = await fetch(`/api/split-sheets/stats?profession=${activeProfession}`);
      if (!response.ok) throw new Error('Failed to fetch split sheet stats');
      return response.json();
    },
    enabled: isMusicProducer,
  });

  const splitSheetStats = splitSheetStatsData?.data || {};

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: Partial<UniversalCustomer>) => {
      const response = await fetch(`/api/universal-crm/customers`, {
        headers: {
          'Content-Type' : 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          ...customerData,
          profession: activeProfession,
          status: customerData.status || 'lead'
        })
      });
      if (!response.ok) throw new Error('Failed to create customer');
      return response.json();
    },
    onSuccess: async (created) => {
      // Sync to Google Contacts (create if missing)
      try {
        const name: string = created?.name || created?.customer?.name || '';
        const [firstName, ...rest] = name.split(' ');
        const lastName = rest.join(' ');
        const email: string = created?.email || created?.customer?.email || '';
        const phone: string = created?.phone || created?.customer?.phone || '';
        const companyName: string = created?.company || created?.customer?.company || '';
        if (email) {
          // Search existing
          const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(email)}`);
          let foundId: string | null = null;
          if (searchRes.ok) {
            const contacts = await searchRes.json();
            const found = contacts.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
            if (found?.id) foundId = found.id;
          }
          if (!foundId) {
            await fetch('/api/google/people/create-contact', {
              method: 'POST',
              headers: { 'Content-Type' : 'application/json' },
              body: JSON.stringify({ firstName, lastName: lastName || '-', email, phone, companyName, profession: activeProfession, notes: 'Created from Universal CRM' })
            });
          }
        }
      } catch (e) {
        console.warn('Google Contacts sync skipped: ', e);
      }
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      setShowAddForm(false);
    }
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UniversalCustomer> }) => {
      const response = await fetch(`/api/universal-crm/customers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    },
    onSuccess: (updated) => {
      try {
        communication.sendBroadcast('customer:updated', updated);
      } catch {}
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      setShowEditDialog(false);
      setEditingCustomer(null);
    },
  });

  // Create project from customer mutation
  const createProjectMutation = useMutation({
    mutationFn: async (customer: UniversalCustomer) => {
      const projectData = {
        projectName: `${customer.name} - ${customer.projectType || 'Prosjekt'}`,
        clientName: customer.name,
        clientEmail: customer.email,
        projectType: customer.projectType || 'wedding',
        totalBudget: customer.budget || 0,
        eventDate: customer.customFields?.eventDate || '',
        location: customer.customFields?.location || '',
        notes: customer.notes,
        source: 'crm_customer',
        customerId: customer.id,
        profession: activeProfession
  };
      
      const response = await apiRequest('/api/projects', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(projectData)
  });
      
      return { project: response, customer };
  },
    onSuccess: (data) => {
      // Update customer status to 'active'
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers', ],});
      
      // Notify parent component
      if (onProjectCreate) {
        onProjectCreate(data.customer, data.project);
    }
      
      setShowProjectDialog(false);
  }
});

  // Schedule meeting with customer mutation
  const scheduleMeetingMutation = useMutation({
    mutationFn: async ({ customer, meetingData }: { customer: UniversalCustomer; meetingData: any }) => {
      const meetingPayload = {
        title: `Møte med ${customer.name}`,
        description: `Kundemøte for ${customer.projectType || 'prosjekt'}`,
        participants: [customer.email],
        type: 'client_meeting',
        projectType: customer.projectType,
        customerId: customer.id,
        profession: activeProfession,
        ...meetingData
    };
      
      const response = await apiRequest('/api/google-meet/create', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(meetingPayload)
  });
      
      return { meeting: response, customer };
  },
    onSuccess: (data) => {
      // Notify parent component
      if (onMeetingSchedule) {
        onMeetingSchedule(data.customer, data.meeting);
    }
      
      setShowMeetingDialog(false);
  }
});

  const customers = customersData?.customers || [];
  const stats = statsData?.stats || { total: 0, byStatus: {}, recentlyAdded: 0 };

  // Fetch split sheets for each customer (only for music producers)
  const { data: customerSplitSheetsData } = useQuery({
    queryKey: ['split-sheets-by-customer', customers.map(c => c.id).join(',')],
    queryFn: async () => {
      // Fetch split sheets for all customers' projects
      const projectIds = customers
        .filter(c => c.customFields?.projectIds)
        .flatMap(c => c.customFields.projectIds);
      
      if (projectIds.length === 0) return {};

      const response = await fetch(`/api/split-sheets?project_id=${projectIds.join('')}`);
      if (!response.ok) return {};
      const result = await response.json();
      
      // Group by customer (via project relationship)
      const grouped: Record<string, any[]> = {};
      result.data?.forEach((ss: any) => {
        if (ss.project_id) {
          if (!grouped[ss.project_id]) grouped[ss.project_id] = [];
          grouped[ss.project_id].push(ss);
        }
      });
      return grouped;
    },
    enabled: isMusicProducer && customers.length > 0,
  });

  const customerSplitSheets = customerSplitSheetsData || {};

  const getDomainFromWebsite = (web?: string) => {
    const w = (web || '').trim();
    if (!w) return '';
    try { return new URL(w).hostname; } catch {}
    try { return new URL(`https://${w}`).hostname; } catch {}
    return '';
  };

  const getCompanyLogoFromWebsite = (website?: string): string | undefined => {
    const domain = getDomainFromWebsite(website);
    return domain ? `https://logo.clearbit.com/${domain}` : undefined;
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      lead: '#ff9800',
      prospect: '#2196f3',
      active: '#4caf50',
      completed: '#9c27b0',
      archived: '#757575'
};
    return statusColors[status] || '#757575';
};

  // Sync a CRM customer to Google Contacts
  const syncCustomerToGoogle = async (customer: UniversalCustomer) => {
    try {
      if (!customer?.email) return;
      const name = customer.name || '';
      const [firstName, ...rest] = name.split('');
      const lastName = rest.join('');
      const companyName = customer.company || '';
      const phone = customer.phone || '';

      // Search existing contact by email
      const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(customer.email)}`);
      let contactId: string | null = null;
      if (searchRes.ok) {
        const contacts = await searchRes.json();
        const found = contacts.find((c: any) => c.email?.toLowerCase() === customer.email.toLowerCase());
        if (found?.id) contactId = found.id;
      }

      if (contactId) {
        // Update existing contact
        await fetch(`/api/google/people/update-contact/${encodeURIComponent(contactId)}`, {
          method: 'PUT',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            firstName: firstName || '-',
            lastName: lastName || '-',
            email: customer.email,
            phone,
            profession: activeProfession,
            companyName,
            notes: customer.notes || ''
          })
        });
      } else {
        // Create new contact
        const createResp = await fetch('/api/google/people/create-contact', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            firstName: firstName || '-',
            lastName: lastName || '-',
            email: customer.email,
            phone,
            profession: activeProfession,
            companyName,
            notes: customer.notes || 'Created from Universal CRM'
          })
        });
        if (createResp.ok) {
          const created = await createResp.json();
          contactId = created.contactId;
        }
      }

      // Set contact photo only if company website is provided
      if (contactId) {
        const website = (customer as any)?.customFields?.website || '';
        if (website) {
          try {
            const domain = getDomainFromWebsite(website);
            if (domain) {
              await fetch(`/api/google/people/set-contact-photo/${encodeURIComponent(contactId)}`, {
                method: 'POST',
                headers: { 'Content-Type' : 'application/json' },
                body: JSON.stringify({ photoUrl: `https://logo.clearbit.com/${domain}` })
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Google Contacts sync (update) skipped:', e);
    }
  };

  const handleCreateCustomer = (formData: FormData) => {
    const website = (formData.get('website') as string) || ',';
    const customerData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      company: formData.get('company') as string,
      projectType: formData.get('projectType') as string,
      budget: parseFloat(formData.get('budget') as string) || undefined,
      notes: formData.get('notes') as string,
      status: formData.get('status') as string || 'lead',
      customFields: { website }
};
    
    createCustomerMutation.mutate(customerData);
};

  return (
    <Box sx={{ p: 2 }}>
      {/* Header with profession-specific styling */}
      <Box sx={{ 
        mb: 3, 
        p: 2,
        background: `linear-gradient(135deg, ${colors.primary}15, ${colors.secondary}15)`,
        borderRadius: 2,
        border: `1px solid ${colors.primary}30`
      }}>
        <Box>
          <Typography variant="h5" sx={{ 
            fontWeight: 'bold', 
            color: theming.colors.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <BusinessIcon />
            {terminology.customerManagement || 'Kundestyring'}
            {activeProfession && (
              <Chip 
                label={terminology.professionName}
                sx={{ 
                  backgroundColor: colors.primary, 
                  color: 'white',
                  fontSize: '0.75rem'
            }}
              />
            )}
          </Typography>
          
          {/* Feature Analytics Display */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            mt: 1
      }}>
            <Typography variant="caption" color="text.secondary">
              Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
            </Typography>
            <Chip 
              label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Event Context Bar */}
      {eventContext && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <strong>Event-kontekst:</strong> {eventContext.name}
            </Box>
            <Box>
              <Button size="small" variant="outlined" onClick={() => setShowLinkDialog(true)}>
                Link kontakt til event
              </Button>
            </Box>
          </Alert>
        </Box>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color={colors.primary} sx={{ ...{}, color: theming.colors.primary }}>
                {stats.total}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Totalt antall kunder
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="#4caf50" sx={{ ...{}, color: theming.colors.primary }}>
                {stats.byStatus?.active || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Aktive {terminology.projects?.toLowerCase() || 'prosjekter'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="#ff9800" sx={{ ...{}, color: theming.colors.primary }}>
                {stats.byStatus?.lead || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Nye henvendelser
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="#2196f3" sx={{ ...{}, color: theming.colors.primary }}>
                {stats.recentlyAdded}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Siste uke
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Split Sheet Statistics - Only for Music Producers */}
        {isMusicProducer && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...theming.getThemedCardSx(), border: '1px solid', borderColor: '#9f7aea30' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="#9f7aea" sx={{ fontWeight: 600}}>
                    {splitSheetStats.total || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Split Sheets
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...theming.getThemedCardSx(), border: '1px solid', borderColor: '#ff980030' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="#ff9800" sx={{ fontWeight: 600}}>
                    {splitSheetStats.pendingSignatures || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Venter signaturer
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...theming.getThemedCardSx(), border: '1px solid', borderColor: '#4caf5030' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="#4caf50" sx={{ fontWeight: 600}}>
                    {splitSheetStats.totalRevenue ? `${splitSheetStats.totalRevenue.toLocaleString('nb-NO')} kr` : '0 kr'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total inntekt
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...theming.getThemedCardSx(), border: '1px solid', borderColor: '#9f7aea30' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="#9f7aea" sx={{ fontWeight: 600}}>
                    {splitSheetStats.completed || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Fullførte split sheets
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* Search and Filter Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          placeholder="Søk etter kunder..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ minWidth: 250 }}
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">Alle</MenuItem>
            <MenuItem value="lead">Henvendelser</MenuItem>
            <MenuItem value="prospect">Potensielle</MenuItem>
            <MenuItem value="active">Aktive</MenuItem>
            <MenuItem value="completed">Fullført</MenuItem>
          </Select>
        </FormControl>
        
        <Button variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddForm(!showAddForm)}
          sx={{
            backgroundColor: colors.primary, '&:hover': { backgroundColor: colors.secondary }
          }}
        >
          Ny kunde
        </Button>

        <Button
          variant="outlined"
          startIcon={<AssessmentIcon />}
          onClick={() => setShowBIDialog(true)}
          sx={{
            borderColor: colors.primary,
            color: colors.primary,
            '&:hover': {
              borderColor: colors.secondary,
              backgroundColor: `${colors.primary}10`
            }
          }}
        >
          Business Intelligence
        </Button>
      </Box>

      {/* Add Customer Form */}
      {showAddForm && (
        <Card sx={{ mb: 3, border: `1px solid ${colors.primary}30`, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
              Legg til ny kunde
            </Typography>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateCustomer(new FormData(e.currentTarget));
          }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="name"
                    label="Navn *"
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="email"
                    label="E-post *"
                    type="email"
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="phone"
                    label="Telefon"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="company"
                    label="Firma"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="website"
                    label="Nettside (https://...)"
                    placeholder="https://firma.no"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="projectType"
                    label={`Type ${terminology.project?.toLowerCase() || 'prosjekt'}`}
                    fullWidth
                    placeholder="f.eks. bryllup, portrett, konsert"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="budget"
                    label="Budsjett (NOK)"
                    type="number"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="notes"
                    label="Notater"
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2,justifyContent: 'flex-end'}}>
                    <Button 
                      type="button" 
                      onClick={() => setShowAddForm(false)}
                    >
                      Avbryt
                    </Button>
                    <Button type="submit" 
                      variant="contained"
                      disabled={createCustomerMutation.isPending}
                      sx={{ 
                        backgroundColor: colors.primary,
                        '&:hover': { backgroundColor: colors.secondary },
                        ...theming.getThemedButtonSx()
                      }}>
                      {createCustomerMutation.isPending ? 'Lagrer...' : 'Lagre kunde'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Customer List */}
      {isLoading ? (
        <Typography>Laster kunder...</Typography>
      ) : error ? (
        <Typography color="error">Feil ved lasting av kunder</Typography>
      ) : (
        <Grid container spacing={2}>
          {customers
            .filter(customer => !statusFilter || customer.status === statusFilter)
            .map((customer: UniversalCustomer) => (
              <Grid item xs={12} sm={6} md={4} key={customer.id}>
                <Card 
                  sx={{ 
                    cursor: onCustomerSelect ? 'pointer' : 'default','&:hover': onCustomerSelect ? { 
                      boxShadow: 4,
                      borderColor: colors.primary 
                } : {},
                    border: `1px solid ${colors.primary}20`
                }}
                  onClick={() => onCustomerSelect?.(customer)}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar src={getCompanyLogoFromWebsite((customer as any)?.customFields?.website)} sx={{ width: 28, height: 28, mr: 1 }}>
                        {(customer.name || '').slice(0,1)}
                      </Avatar>
                      <Typography variant="h6" sx={{ flexGrow: 1, color: theming.colors.primary }}>
                        {customer.name}
                      </Typography>
                      <Chip
                        label={customer.status}
                        size="small"
                        sx={{ 
                          backgroundColor: getStatusColor(customer.status),
                          color: 'white',
                          fontSize: '0.7rem'
                    }}
                      />
                    </Box>
                    
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      {customer.email}
                    </Typography>
                    
                    {customer.phone && (
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        📞 {customer.phone}
                      </Typography>
                    )}
                    
                    {customer.company && (
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        🏢 {customer.company}
                      </Typography>
                    )}
                    
                    {customer.projectType && (
                      <Chip
                        label={customer.projectType}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          mr: 1,
                          mb: 1,
                          borderColor: colors.primary,
                          color: colors.primary
                    }}
                      />
                    )}
                    
                    {customer.budget && (
                      <Typography variant="body2" color={colors.primary} sx={{ fontWeight: 600 }}>
                        {customer.budget.toLocaleString('nb-NO')} kr
                      </Typography>
                    )}

                    {/* Split Sheet Information - Only for Music Producers */}
                    {isMusicProducer && (() => {
                      // Find split sheets for this customer's projects
                      const customerProjectIds = customer.customFields?.projectIds || [];
                      const customerSplitSheetsList = customerProjectIds.flatMap((pid: string) => customerSplitSheets[pid] || []);
                      
                      if (customerSplitSheetsList.length > 0) {
                        const completedCount = customerSplitSheetsList.filter((ss: any) => ss.status === 'completed').length;
                        const pendingCount = customerSplitSheetsList.filter((ss: any) => ss.status === 'pending_signatures').length;
                        
                        return (
                          <Box sx={{ mt: 1, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <SplitSheetIcon sx={{ fontSize: 16, color: '#9f7aea' }} />
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#9f7aea' }}>
                                Split Sheets: {customerSplitSheetsList.length}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {completedCount > 0 && (
                                <Chip
                                  label={`${completedCount} fullført`}
                                  size="small"
                                  sx={{ 
                                    bgcolor: '#4caf50', 
                                    color: 'white',
                                    fontSize: '0.65rem',
                                    height: 20
                                  }}
                                />
                              )}
                              {pendingCount > 0 && (
                                <Chip
                                  label={`${pendingCount} venter`}
                                  size="small"
                                  sx={{ 
                                    bgcolor: '#ff9800', 
                                    color: 'white',
                                    fontSize: '0.65rem',
                                    height: 20
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Relations Chip */}
                    {eventContext && (
                      <Chip
                        label={linkedCustomersForEvent.includes(customer.email) ? 'Linket til event' : 'Ikke linket'}
                        size="small"
                        color={linkedCustomersForEvent.includes(customer.email) ? 'success' : 'default'}
                        sx={{ mr: 1 }}
                      />
                    )}
                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1,mt: 2,justifyContent: 'flex-end'}}>
                      {eventContext && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(customer);
                            setLinkRole('Client');
                            setLinkNotes('');
                            setShowLinkDialog(true);
                          }}
                        >
                          Link til event
                        </Button>
                      )}
                      <Button 
                        size="small" 
                        variant="outlined"
                        startIcon={theming.getThemedIcon('videoCall')}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowMeetingDialog(true);
                      }}
                        disabled={customer.status === 'archived'}
                        sx={{ fontSize: '0.75rem'}}
                      >
                        Møte
                      </Button>
                      <Button size="small" 
                        variant="contained"
                        startIcon={theming.getThemedIcon('add')}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowProjectDialog(true);
                        }}
                        disabled={customer.status === 'archived'}
                        sx={{ 
                          fontSize: '0.75rem',
                          bgcolor: '#4caf50','&:hover': { bgcolor: '#45a049' } 
                        }}
                      >
                        Prosjekt
                      </Button>
                      {/* Split Sheet Quick Action - Only for Music Producers */}
                      {isMusicProducer && (
                        <Button 
                          size="small" 
                          variant="outlined"
                          startIcon={<SplitSheetIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Send message to split-sheet-manager to create/view split sheets
                            try {
                              communication.sendMessage({
                                from: 'universal-crm-dashboard',
                                to: 'split-sheet-manager',
                                type: 'view-customer-split-sheets',
                                data: { 
                                  customerId: customer.id,
                                  customerName: customer.name,
                                  projectIds: customer.customFields?.projectIds || []
                                },
                                priority: 'medium'
                              });
                            } catch (err) {
                              console.warn('Could not send message to split-sheet-manager:', err);
                            }
                          }}
                          sx={{ 
                            fontSize: '0.75rem',
                            color: '#9f7aea',
                            borderColor: '#9f7aea','&:hover': {
                              borderColor: '#9f7aea',
                              bgcolor: '#9f7aea10'
                            }
                          }}
                        >
                          Split Sheet
                        </Button>
                      )}
                      <Button 
                        size="small" 
                        variant="outlined"
                        startIcon={<WorkOutline />}
                        onClick={() => onCustomerSelect?.(customer)}
                        sx={{ fontSize: '0.75rem'}}
                      >
                        Detaljer
                      </Button>
                      <Button 
                        size="small"
                        variant="text"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCustomer(customer);
                          setShowEditDialog(true);
                        }}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        Rediger
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined"
                        startIcon={<ContractIcon />}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSelectedCustomer(customer);
                          // Fetch contracts for this customer
                          try {
                            const contracts = await apiRequest(`/api/contracts?clientId=${customer.id}`);
                            setCustomerContracts(contracts.contracts || []);
                            setShowContractsDialog(true);
                          } catch (error) {
                            console.error('Error fetching contracts:', error);
                            setCustomerContracts([]);
                            setShowContractsDialog(true);
                          }
                        }}
                        sx={{ fontSize: '0.75rem', borderColor: '#f57c00', color: '#f57c00' }}
                      >
                        Kontrakter
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}

      {/* Customer Contracts Dialog */}
      <Dialog open={showContractsDialog} onClose={() => setShowContractsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ContractIcon color="primary" />
              <Typography variant="h6">
                Kontrakter for {selectedCustomer?.name}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={async () => {
                // Create contract from customer
                try {
                  const contractData = {
                    clientName: selectedCustomer?.name,
                    clientEmail: selectedCustomer?.email,
                    clientId: selectedCustomer?.id,
                    projectDescription: `${selectedCustomer?.name} - ${selectedCustomer?.projectType || 'Prosjekt'}`,
                    totalAmount: selectedCustomer?.budget || 0,
                    status: 'draft',
                    profession: activeProfession,
                  };
                  
                  const response = await apiRequest('/api/contracts', {
                    method: 'POST',
                    headers: { 'Content-Type' : 'application/json' },
                    body: JSON.stringify(contractData),
                  });
                  
                  if (response.success || response.contract) {
                    // Refresh contracts list
                    const contracts = await apiRequest(`/api/contracts?clientId=${selectedCustomer?.id}`);
                    setCustomerContracts(contracts.contracts || []);
                  }
                } catch (error) {
                  console.error('Error creating contract:', error);
                }
              }}
              sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' } }}
            >
              Opprett kontrakt
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {customerContracts.length === 0 ? (
            <Alert severity="info">
              Ingen kontrakter funnet for denne kunden.
            </Alert>
          ) : (
            <List>
              {customerContracts.map((contract: any) => (
                <ListItem key={contract.id} divider>
                  <ListItemText
                    primary={contract.projectDescription || 'Kontrakt'}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          Status: {contract.status} • Beløp: NOK {contract.totalAmount || 0}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Opprettet: {new Date(contract.createdAt).toLocaleDateString('no-NO')}
                        </Typography>
                      </Box>
                    }
                  />
                  <Chip
                    label={contract.status}
                    size="small"
                    color={contract.status === 'active' ? 'success' : contract.status === 'draft' ? 'warning' : 'default'}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContractsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Meeting Scheduling Dialog */}
      <Dialog open={showMeetingDialog} onClose={() => setShowMeetingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideoCall color="primary" />
            Planlegg møte med {selectedCustomer?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2,mt: 1 }}>
            <TextField
              label="Møtetittel"
              value={`Møte med ${selectedCustomer?.name}`}
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
              value="10: 00"
              onChange={(e) => {/* Handle time change , *, /}}
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
              value={`Kundemøte for ${selectedCustomer?.projectType || 'prosjekt'}`}
              onChange={(e) => {/* Handle description change */}}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMeetingDialog(false)}>Avbryt</Button>
          <Button variant="contained"
            onClick={() => selectedCustomer && scheduleMeetingMutation.mutate({
              customer: selectedCustomer,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Add color="success" />
            Opprett prosjekt for kunde: {selectedCustomer?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2,mt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Dette vil opprette et nytt prosjekt basert på kundeinformasjonen og oppdatere kundestatusen til "Aktiv".
            </Alert>
            <TextField
              label="Prosjektnavn"
              value={`${selectedCustomer?.name} - ${selectedCustomer?.projectType || 'Prosjekt'}`}
              fullWidth
              disabled
            />
            <TextField
              label="Klientnavn"
              value={selectedCustomer?.name}
              fullWidth
              disabled
            />
            <TextField
              label="E-post"
              value={selectedCustomer?.email}
              fullWidth
              disabled
            />
            <TextField
              label="Prosjekttype"
              value={selectedCustomer?.projectType || 'wedding'}
              fullWidth
              disabled
            />
            <TextField
              label="Estimert budsjett"
              value={selectedCustomer?.budget ? `${selectedCustomer.budget.toLocaleString('nb-NO')} kr` : 'Ikke spesifisert'}
              fullWidth
              disabled
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectDialog(false)}>Avbryt</Button>
          <Button variant="contained"
            onClick={() => selectedCustomer && createProjectMutation.mutate(selectedCustomer)}
            disabled={createProjectMutation.isPending}
            sx={{ bgcolor: '#4caf50' }}
          >
            {createProjectMutation.isPending ? 'Oppretter...' : 'Opprett prosjekt'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Link to Event Dialog */}
      <Dialog open={showLinkDialog} onClose={() => setShowLinkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link kontakt til event</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info">{selectedCustomer?.name} → {eventContext?.name}</Alert>
            <FormControl fullWidth>
              <InputLabel>Rolle</InputLabel>
              <Select value={linkRole} label="Rolle" onChange={(e) => setLinkRole(e.target.value)}>
                <MenuItem value="Client">Kunde</MenuItem>
                <MenuItem value="Sponsor">Sponsor</MenuItem>
                <MenuItem value="Vendor">Leverandør</MenuItem>
                <MenuItem value="Speaker">Foredragsholder</MenuItem>
                <MenuItem value="Staff">Stab</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notater (valgfritt)"
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLinkDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedCustomer || !eventContext) return;
              if (onLinkToEvent) {
                onLinkToEvent(selectedCustomer, { role: linkRole, notes: linkNotes });
              } else {
                try {
                  communication.sendMessage('event:link-customer', {
                    eventId: eventContext.id,
                    customer: selectedCustomer,
                    role: linkRole,
                    notes: linkNotes,
                  });
                } catch {}
              }
              setShowLinkDialog(false);
            }}
          >
            Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rediger kunde</DialogTitle>
        <DialogContent>
          <Box component="form" id="edit-customer-form" sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField defaultValue={editingCustomer?.name || ', '} name="name" label="Navn" fullWidth />
              </Grid>
              <Grid item xs={12}>
                <TextField defaultValue={editingCustomer?.email || ', '} name="email" label="E-post" type="email" fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField defaultValue={editingCustomer?.phone || ', '} name="phone" label="Telefon" fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField defaultValue={editingCustomer?.company || ', '} name="company" label="Firma" fullWidth />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select defaultValue={editingCustomer?.status || 'lead'} name="status" label="Status">
                    <MenuItem value="lead">Henvendelser</MenuItem>
                    <MenuItem value="prospect">Potensielle</MenuItem>
                    <MenuItem value="active">Aktive</MenuItem>
                    <MenuItem value="completed">Fullført</MenuItem>
                    <MenuItem value="archived">Arkivert</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField defaultValue={editingCustomer?.notes || ', '} name="notes" label="Notater" multiline rows={3} fullWidth />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={updateCustomerMutation.isPending}
            onClick={() => {
              if (!editingCustomer) return;
              const form = document.getElementById('edit-customer-form') as HTMLFormElement;
              const fd = new FormData(form);
              const updates = {
                name: (fd.get('name') as string) || editingCustomer.name,
                email: (fd.get('email') as string) || editingCustomer.email,
                phone: (fd.get('phone') as string) || editingCustomer.phone,
                company: (fd.get('company') as string) || editingCustomer.company,
                status: (fd.get('status') as string) || editingCustomer.status,
                notes: (fd.get('notes') as string) || editingCustomer.notes,
              };
              updateCustomerMutation.mutate({ id: editingCustomer.id, updates });
            }}
            sx={{ bgcolor: '#2196f3' }}
          >
            {updateCustomerMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Business Intelligence Dialog */}
      <Dialog
        open={showBIDialog}
        onClose={() => setShowBIDialog(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `2px solid ${colors.primary}`,
          pb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ color: colors.primary }} />
            <Typography variant="h6">Business Intelligence Dashboard</Typography>
          </Box>
          <Button onClick={() => setShowBIDialog(false)}>Lukk</Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            <BusinessIntelligenceDashboard
              userId={queryClient.getQueryData(['user'])?.id || 'default'}
              profession={activeProfession}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Customer Contracts Dialog */}
      <Dialog open={showContractsDialog} onClose={() => setShowContractsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ContractIcon color="primary" />
              <Typography variant="h6">
                Kontrakter for {selectedCustomer?.name}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={async () => {
                // Create contract from customer
                try {
                  const contractData = {
                    clientName: selectedCustomer?.name,
                    clientEmail: selectedCustomer?.email,
                    clientId: selectedCustomer?.id,
                    projectDescription: `${selectedCustomer?.name} - ${selectedCustomer?.projectType || 'Prosjekt'}`,
                    totalAmount: selectedCustomer?.budget || 0,
                    status: 'draft',
                    profession: activeProfession,
                  };
                  
                  const response = await apiRequest('/api/contracts', {
                    method: 'POST',
                    headers: { 'Content-Type' : 'application/json' },
                    body: JSON.stringify(contractData),
                  });
                  
                  if (response.success || response.contract) {
                    // Refresh contracts list
                    const contracts = await apiRequest(`/api/contracts?clientId=${selectedCustomer?.id}`);
                    setCustomerContracts(contracts.contracts || []);
                  }
                } catch (error) {
                  console.error('Error creating contract:', error);
                }
              }}
              sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' } }}
            >
              Opprett kontrakt
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {customerContracts.length === 0 ? (
            <Alert severity="info">
              Ingen kontrakter funnet for denne kunden.
            </Alert>
          ) : (
            <List>
              {customerContracts.map((contract: any) => (
                <ListItem key={contract.id} divider>
                  <ListItemText
                    primary={contract.projectDescription || 'Kontrakt'}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          Status: {contract.status} • Beløp: NOK {contract.totalAmount || 0}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Opprettet: {new Date(contract.createdAt).toLocaleDateString('no-NO')}
                        </Typography>
                      </Box>
                    }
                  />
                  <Chip
                    label={contract.status}
                    size="small"
                    color={contract.status === 'active' ? 'success' : contract.status === 'draft' ? 'warning': 'default'}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContractsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
