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
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  AddCircle as AddIcon,
  Search as SearchIcon,
  VideoCall,
  Task as TaskIcon,
  WorkOutline,
  Add,
  Schedule,
  Assessment as AssessmentIcon,
  AccountBalance as SplitSheetIcon,
  Description as ContractIcon,
} from '@mui/icons-material';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '../../hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import BusinessIntelligenceDashboard from '../business-intelligence/BusinessIntelligenceDashboard';
import GoogleTasksIntegration from '../google-tasks/GoogleTasksIntegration';
import { alpha } from '@mui/material/styles';

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
  customFields: Record<string, unknown>;
}

interface GooglePeopleContact {
  id: string;
  email: string;
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
  const { user } = useAuth();
  const { professionConfigs } = useProfessionConfigs();
  
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
  const resolvedUserId = user?.id || user?.email || queryClient.getQueryData<{ id?: string; email?: string }>(['user'])?.id || queryClient.getQueryData<{ id?: string; email?: string }>(['user'])?.email || 'default';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<UniversalCustomer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<UniversalCustomer | null>(null);
  const [showBIDialog, setShowBIDialog] = useState(false);
  const [showTasksDialog, setShowTasksDialog] = useState(false);

  // Link to event dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkRole, setLinkRole] = useState<string>('Client');
  const [linkNotes, setLinkNotes] = useState<string>('');
  const [showContractsDialog, setShowContractsDialog] = useState(false);
  const [customerContracts, setCustomerContracts] = useState<any[]>([]);
  const [meetingForm, setMeetingForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 60,
    description: '',
  });

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
      userId: resolvedUserId
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
  }, [communication, dataFlow, features, currentProfession, resolvedUserId]);

  // Use profession from props or context with dynamic fallback
  const activeProfession = profession || currentProfession || getCurrentUserProfession();
  const availableProfessionConfigs = Object.entries(professionConfigs || {});
  const professionPreset =
    professionConfigs?.[activeProfession] ||
    availableProfessionConfigs.find(([professionId, config]) => {
      const normalizedActiveProfession = activeProfession.toLowerCase();
      return (
        professionId === activeProfession ||
        config.name.toLowerCase() === normalizedActiveProfession ||
        config.displayName.toLowerCase() === normalizedActiveProfession
      );
    })?.[1];
  const professionIcon = getProfessionIcon(activeProfession);
  const enabledCRMFeatures = [
    { label: 'CRM', access: crmDashboardAccess },
    { label: 'Kunder', access: customerManagementAccess },
    { label: 'Leads', access: leadManagementAccess },
    { label: 'Prosjekter', access: projectManagementAccess },
    { label: 'Kontakter', access: contactManagementAccess },
    { label: 'Analyse', access: crmAnalyticsAccess },
    { label: 'Salg', access: salesTrackingAccess },
    { label: 'Kommunikasjon', access: communicationTrackingAccess },
  ];

  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'universal-crm-dashboard',
      name: 'Universal CRM Dashboard',
      type: 'dashboard',
      category: 'crm',
      profession: activeProfession,
      capabilities: ['crm:manage', 'customer:manage', 'project:create', 'meeting:schedule', 'analytics:view'],
      dependencies: ['communication', 'data-flow', 'feature-access'],
      props: ['profession', 'selectedProject', 'eventContext'],
      events: ['customer:selected', 'project:selected', 'meeting:scheduled', 'crm:customer:update'],
      dataKeys: ['universal-crm-dashboard:customers', 'universal-crm-dashboard:projects', 'universal-crm-dashboard:meetings'],
      features: ['universal-crm', 'customer-management', 'project-management', 'communication-tracking'],
      version: '1.0.0',
      description: 'CRM-arbeidsflate for kunder, prosjekter, møter og kontrakter.',
    });

    integration.emit('crm:dashboard:opened', {
      profession: activeProfession,
      userId: resolvedUserId,
      selectedProjectId: selectedProject?.id || null,
    });

    return () => {
      componentRegistry.unregisterComponent('universal-crm-dashboard');
      integration.emit('crm:dashboard:closed', {
        profession: activeProfession,
        userId: resolvedUserId,
      });
    };
  }, [activeProfession, componentRegistry, integration, resolvedUserId, selectedProject?.id]);

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

  useEffect(() => {
    if (!selectedCustomer || !showMeetingDialog) {
      return;
    }

    setMeetingForm({
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 60,
      description: `Kundemøte for ${selectedCustomer.projectType || selectedProject?.projectType || 'prosjekt'}${selectedProject?.name ? ` • ${selectedProject.name}` : ''}`,
    });
  }, [selectedCustomer, selectedProject, showMeetingDialog]);

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
          const contacts = await apiRequest(
            `/api/google/people/search-contacts?q=${encodeURIComponent(email)}&userId=${encodeURIComponent(resolvedUserId)}`,
          ) as GooglePeopleContact[];
          const foundId = contacts.find((contact) => contact.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
          if (!foundId) {
            await apiRequest('/api/google/people/create-contact', {
              method: 'POST',
              body: {
                firstName,
                lastName: lastName || '-',
                email,
                phone,
                companyName,
                profession: activeProfession,
                notes: 'Created from Universal CRM',
                userId: resolvedUserId,
              },
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
      } catch (error) {
        console.warn('Could not broadcast updated customer:', error);
      }
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
  const filteredCustomers = React.useMemo(
    () => customers.filter((customer: UniversalCustomer) => !statusFilter || customer.status === statusFilter),
    [customers, statusFilter],
  );
  const heroSummary = [
    `${stats.total || 0} kontakter totalt`,
    `${stats.byStatus?.active || 0} aktive`,
    `${stats.byStatus?.lead || 0} nye henvendelser`,
  ];
  const primaryMetrics = [
    {
      label: 'Kontakter',
      value: stats.total || 0,
      description: 'samlet kundeoversikt',
      tone: 'linear-gradient(135deg, #0f766e 0%, #34d399 100%)',
    },
    {
      label: terminology.projects || 'Prosjekter',
      value: stats.byStatus?.active || 0,
      description: 'aktive leveranser',
      tone: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    },
    {
      label: 'Leads',
      value: stats.byStatus?.lead || 0,
      description: 'venter oppfølging',
      tone: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    },
    {
      label: 'Siste uke',
      value: stats.recentlyAdded || 0,
      description: 'nye registreringer',
      tone: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    },
  ];
  const surfaceBorder = `1px solid ${alpha(colors.primary, 0.12)}`;
  const surfaceShadow = `0 18px 42px ${alpha('#0f172a', 0.08)}`;

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
    const normalizedWebsite = /^https?:\/\//i.test(w) ? w : `https://${w}`;
    try {
      return new URL(normalizedWebsite).hostname;
    } catch (error) {
      console.warn('Invalid customer website, skipping logo lookup:', web, error);
    }
    return '';
  };

  const getCompanyLogoFromWebsite = (website?: string): string | undefined => {
    const domain = getDomainFromWebsite(website);
    return domain ? `https://logo.clearbit.com/${domain}` : undefined;
  };

  const getCustomerWebsite = (customer: UniversalCustomer) => {
    const websiteValue = customer.customFields?.website;
    return typeof websiteValue === 'string' ? websiteValue : '';
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
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ');
      const companyName = customer.company || '';
      const phone = customer.phone || '';

      const contacts = await apiRequest(
        `/api/google/people/search-contacts?q=${encodeURIComponent(customer.email)}&userId=${encodeURIComponent(resolvedUserId)}`,
      ) as GooglePeopleContact[];
      let contactId: string | null =
        contacts.find((contact) => contact.email?.toLowerCase() === customer.email.toLowerCase())?.id ?? null;

      if (contactId) {
        await apiRequest(`/api/google/people/update-contact/${encodeURIComponent(contactId)}`, {
          method: 'PUT',
          body: {
            firstName: firstName || '-',
            lastName: lastName || '-',
            email: customer.email,
            phone,
            profession: activeProfession,
            companyName,
            notes: customer.notes || '',
            userId: resolvedUserId,
          },
        });
      } else {
        const created = await apiRequest('/api/google/people/create-contact', {
          method: 'POST',
          body: {
            firstName: firstName || '-',
            lastName: lastName || '-',
            email: customer.email,
            phone,
            profession: activeProfession,
            companyName,
            notes: customer.notes || 'Created from Universal CRM',
            userId: resolvedUserId,
          },
        });
        contactId = typeof created?.contactId === 'string' ? created.contactId : null;
      }

      // Set contact photo only if company website is provided
      if (contactId) {
        const website = getCustomerWebsite(customer);
        if (website) {
          try {
            const domain = getDomainFromWebsite(website);
            if (domain) {
              await apiRequest(`/api/google/people/set-contact-photo/${encodeURIComponent(contactId)}`, {
                method: 'POST',
                body: {
                  photoUrl: `https://logo.clearbit.com/${domain}`,
                  userId: resolvedUserId,
                },
              });
            }
          } catch (error) {
            console.warn('Could not update Google contact photo:', error);
          }
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
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 4,
            border: surfaceBorder,
            boxShadow: surfaceShadow,
            background: `linear-gradient(135deg, ${alpha(colors.primary, 0.12)} 0%, rgba(255,255,255,0.98) 42%, ${alpha(colors.secondary, 0.08)} 100%)`,
          }}
        >
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={2.5}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', lg: 'center' }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  sx={{
                    width: 54,
                    height: 54,
                    bgcolor: alpha(colors.primary, 0.12),
                    color: colors.primary,
                    border: `1px solid ${alpha(colors.primary, 0.18)}`,
                  }}
                >
                  {professionIcon}
                </Avatar>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                    <Typography variant="h4" sx={{ fontWeight: 800, color: theming.colors.primary, lineHeight: 1.1 }}>
                      {adaptDashboardTitle(terminology.customerManagement || 'Kundestyring')}
                    </Typography>
                    {activeProfession && (
                      <Chip
                        label={professionPreset?.name || terminology.professionName}
                        size="small"
                        sx={{
                          bgcolor: colors.primary,
                          color: 'white',
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                    {crmDashboardAccess.hasAccess
                      ? `Samle leads, kunder, kontrakter og ${terminology.projects.toLowerCase()} i én rolig arbeidsflate med tydelig neste steg.`
                      : crmDashboardAccess.reason}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {heroSummary.map((summaryItem) => (
                      <Chip
                        key={summaryItem}
                        label={summaryItem}
                        variant="outlined"
                        size="small"
                        sx={{
                          borderColor: alpha(colors.primary, 0.2),
                          bgcolor: alpha('#ffffff', 0.72),
                        }}
                      />
                    ))}
                    <Chip
                      label={`${enabledCRMFeatures.filter(({ access }) => access.hasAccess).length} moduler aktive`}
                      size="small"
                      sx={{
                        bgcolor: alpha(colors.primary, 0.12),
                        color: colors.primary,
                        fontWeight: 700,
                      }}
                    />
                  </Stack>
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', lg: 'auto' } }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddForm((current) => !current)}
                  disabled={!customerManagementAccess.hasAccess}
                  sx={{
                    minWidth: 156,
                    bgcolor: colors.primary,
                    color: '#fff',
                    boxShadow: `0 14px 32px ${alpha(colors.primary, 0.26)}`,
                    '&:hover': { bgcolor: colors.secondary },
                  }}
                >
                  {showAddForm ? 'Skjul skjema' : 'Ny kunde'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => setShowBIDialog(true)}
                  disabled={!crmAnalyticsAccess.hasAccess}
                  sx={{
                    minWidth: 176,
                    borderColor: alpha(colors.primary, 0.25),
                    color: colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': {
                      borderColor: colors.secondary,
                      bgcolor: alpha(colors.primary, 0.08),
                    },
                  }}
                >
                  Business Intelligence
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TaskIcon />}
                  onClick={() => setShowTasksDialog(true)}
                  sx={{
                    minWidth: 150,
                    borderColor: alpha(colors.primary, 0.25),
                    color: colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': {
                      borderColor: colors.secondary,
                      bgcolor: alpha(colors.primary, 0.08),
                    },
                  }}
                >
                  Google Tasks
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {enabledCRMFeatures.map(({ label, access }) => (
                <Chip
                  key={label}
                  size="small"
                  label={label}
                  variant={access.hasAccess ? 'filled' : 'outlined'}
                  sx={
                    access.hasAccess
                      ? {
                          bgcolor: alpha(colors.primary, 0.12),
                          color: colors.primary,
                          fontWeight: 600,
                        }
                      : {
                          borderColor: alpha('#64748b', 0.18),
                          color: 'text.secondary',
                        }
                  }
                />
              ))}
              <Chip
                label={`Adopsjon ${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ borderColor: alpha(colors.primary, 0.2), bgcolor: alpha('#fff', 0.72) }}
              />
            </Stack>
          </Stack>
        </Paper>

        {(selectedProject || eventContext) && (
          <Grid container spacing={2}>
            {selectedProject && (
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 3,
                    border: surfaceBorder,
                    background: alpha(colors.primary, 0.05),
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(colors.primary, 0.12), color: colors.primary }}>
                      <WorkOutline />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Aktivt prosjekt
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedProject.name || selectedProject.title || selectedProject.id}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            )}
            {eventContext && (
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 3,
                    border: surfaceBorder,
                    background: alpha('#0ea5e9', 0.05),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Event-kontekst
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {eventContext.name}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={() => setShowLinkDialog(true)}>
                      Link kontakt
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}

        <Grid container spacing={2}>
          {primaryMetrics.map((metric) => (
            <Grid item xs={12} sm={6} md={3} key={metric.label}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  minHeight: 176,
                  borderRadius: 3.5,
                  color: 'white',
                  background: metric.tone,
                  boxShadow: `0 20px 44px ${alpha('#0f172a', 0.14)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="overline" sx={{ opacity: 0.82, letterSpacing: 0.8 }}>
                  {metric.label}
                </Typography>
                <Box>
                  <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1, mb: 1 }}>
                    {metric.value}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {metric.description}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}

          {isMusicProducer && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.25, borderRadius: 3, border: `1px solid ${alpha('#9f7aea', 0.2)}`, bgcolor: alpha('#9f7aea', 0.06) }}>
                  <Typography variant="overline" sx={{ color: '#7c3aed' }}>Split Sheets</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#7c3aed' }}>{splitSheetStats.total || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">aktive fordelingsark</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.25, borderRadius: 3, border: `1px solid ${alpha('#f59e0b', 0.2)}`, bgcolor: alpha('#f59e0b', 0.06) }}>
                  <Typography variant="overline" sx={{ color: '#d97706' }}>Venter signatur</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#d97706' }}>{splitSheetStats.pendingSignatures || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">må følges opp</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.25, borderRadius: 3, border: `1px solid ${alpha('#22c55e', 0.2)}`, bgcolor: alpha('#22c55e', 0.06) }}>
                  <Typography variant="overline" sx={{ color: '#16a34a' }}>Total inntekt</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#16a34a' }}>
                    {splitSheetStats.totalRevenue ? `${splitSheetStats.totalRevenue.toLocaleString('nb-NO')} kr` : '0 kr'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">registrert i split sheets</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.25, borderRadius: 3, border: `1px solid ${alpha('#8b5cf6', 0.2)}`, bgcolor: alpha('#8b5cf6', 0.06) }}>
                  <Typography variant="overline" sx={{ color: '#7c3aed' }}>Fullført</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#7c3aed' }}>{splitSheetStats.completed || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">klare arkivklare avtaler</Typography>
                </Paper>
              </Grid>
            </>
          )}
        </Grid>

        <Paper
          elevation={0}
          sx={{
            p: 2.25,
            borderRadius: 3.5,
            border: surfaceBorder,
            boxShadow: `0 14px 28px ${alpha('#0f172a', 0.05)}`,
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', xl: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', xl: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flex: 1 }}>
                <TextField
                  placeholder="Søk etter navn, e-post eller firma"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 320 }, flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl sx={{ minWidth: { xs: '100%', md: 190 } }}>
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
                    <MenuItem value="archived">Arkivert</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={`${filteredCustomers.length} synlige kunder`}
                  sx={{ bgcolor: alpha(colors.primary, 0.08), color: colors.primary, fontWeight: 700 }}
                />
                {statusFilter && (
                  <Button size="small" onClick={() => setStatusFilter('')}>
                    Nullstill filter
                  </Button>
                )}
              </Stack>
            </Stack>

            {selectedProject && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Nye kunder, møter og prosjektopprettelser kobles mot <strong>{selectedProject.name || selectedProject.title}</strong> når det er relevant.
              </Alert>
            )}
          </Stack>
        </Paper>

        {showAddForm && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 3.5,
              border: surfaceBorder,
              boxShadow: `0 18px 40px ${alpha('#0f172a', 0.06)}`,
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 0.75 }}>
                  Legg til ny kunde
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Opprett en kontakt med riktig prosjektkontekst fra start, så blir CRM, tilbud, kontrakt og kommunikasjon synket videre.
                </Typography>
              </Box>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateCustomer(new FormData(e.currentTarget));
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField name="name" label="Navn *" fullWidth required />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField name="email" label="E-post *" type="email" fullWidth required />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField name="phone" label="Telefon" fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField name="company" label="Firma" fullWidth />
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
                    <TextField name="budget" label="Budsjett (NOK)" type="number" fullWidth />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField name="notes" label="Notater" multiline rows={4} fullWidth />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Button type="button" onClick={() => setShowAddForm(false)}>
                        Avbryt
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={createCustomerMutation.isPending}
                        sx={{
                          backgroundColor: colors.primary,
                          '&:hover': { backgroundColor: colors.secondary },
                          ...theming.getThemedButtonSx(),
                        }}
                      >
                        {createCustomerMutation.isPending ? 'Lagrer...' : 'Lagre kunde'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </Stack>
          </Paper>
        )}

        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                Kundeoversikt
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Prioriter leads, følg opp aktive kunder og gå videre til møter, prosjekter og kontrakter uten å miste kontekst.
              </Typography>
            </Box>
          </Stack>

          {isLoading ? (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: surfaceBorder }}>
              <Typography>Laster kunder...</Typography>
            </Paper>
          ) : error ? (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: surfaceBorder }}>
              <Typography color="error">Feil ved lasting av kunder</Typography>
            </Paper>
          ) : filteredCustomers.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 3.5,
                border: `1px dashed ${alpha(colors.primary, 0.22)}`,
                bgcolor: alpha(colors.primary, 0.03),
              }}
            >
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Ingen kunder matcher filtrene
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prøv et annet søk, nullstill filteret eller opprett en ny kontakt direkte herfra.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {statusFilter && (
                    <Button variant="outlined" onClick={() => setStatusFilter('')}>
                      Nullstill filter
                    </Button>
                  )}
                  <Button variant="contained" onClick={() => setShowAddForm(true)} sx={{ bgcolor: colors.primary }}>
                    Ny kunde
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ) : (
            <Grid container spacing={2.25}>
              {filteredCustomers.map((customer: UniversalCustomer) => {
                const customerProjectIds = Array.isArray(customer.customFields?.projectIds)
                  ? (customer.customFields.projectIds as string[])
                  : [];
                const customerSplitSheetsList = isMusicProducer
                  ? customerProjectIds.flatMap((pid: string) => customerSplitSheets[pid] || [])
                  : [];
                const completedCount = customerSplitSheetsList.filter((ss: any) => ss.status === 'completed').length;
                const pendingCount = customerSplitSheetsList.filter((ss: any) => ss.status === 'pending_signatures').length;
                const linkedToEvent = eventContext ? linkedCustomersForEvent.includes(customer.email) : false;

                return (
                  <Grid item xs={12} md={6} xl={4} key={customer.id}>
                    <Card
                      elevation={0}
                      sx={{
                        height: '100%',
                        borderRadius: 3.5,
                        border: `1px solid ${alpha(colors.primary, 0.12)}`,
                        boxShadow: `0 18px 36px ${alpha('#0f172a', 0.06)}`,
                        cursor: onCustomerSelect ? 'pointer' : 'default',
                        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                        '&:hover': onCustomerSelect
                          ? {
                              transform: 'translateY(-2px)',
                              boxShadow: `0 22px 42px ${alpha('#0f172a', 0.09)}`,
                              borderColor: alpha(colors.primary, 0.28),
                            }
                          : undefined,
                      }}
                      onClick={() => onCustomerSelect?.(customer)}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack spacing={2}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Avatar
                              src={getCompanyLogoFromWebsite(getCustomerWebsite(customer))}
                              sx={{
                                width: 44,
                                height: 44,
                                bgcolor: alpha(colors.primary, 0.12),
                                color: colors.primary,
                              }}
                            >
                              {(customer.name || '').slice(0, 1)}
                            </Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                                  {customer.name}
                                </Typography>
                                <Chip
                                  label={customer.status}
                                  size="small"
                                  sx={{
                                    bgcolor: alpha(getStatusColor(customer.status), 0.12),
                                    color: getStatusColor(customer.status),
                                    fontWeight: 700,
                                    textTransform: 'capitalize',
                                  }}
                                />
                              </Stack>
                              {customer.company && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                  {customer.company}
                                </Typography>
                              )}
                            </Box>
                          </Stack>

                          <Stack spacing={1}>
                            <Typography variant="body2" color="text.secondary">
                              {customer.email}
                            </Typography>
                            {customer.phone && (
                              <Typography variant="body2" color="text.secondary">
                                {customer.phone}
                              </Typography>
                            )}
                          </Stack>

                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {customer.projectType && (
                              <Chip
                                label={customer.projectType}
                                size="small"
                                variant="outlined"
                                sx={{ borderColor: alpha(colors.primary, 0.24), color: colors.primary }}
                              />
                            )}
                            {customer.budget != null && (
                              <Chip
                                label={`${customer.budget.toLocaleString('nb-NO')} kr`}
                                size="small"
                                sx={{ bgcolor: alpha(colors.primary, 0.08), color: colors.primary, fontWeight: 700 }}
                              />
                            )}
                            {linkedToEvent && <Chip label="Linket til event" size="small" color="success" />}
                            {customer.tags?.slice(0, 2).map((tag) => (
                              <Chip key={tag} label={tag} size="small" variant="outlined" />
                            ))}
                          </Stack>

                          {customer.notes?.trim() && (
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: alpha(colors.primary, 0.05),
                                border: `1px solid ${alpha(colors.primary, 0.08)}`,
                              }}
                            >
                              <Typography variant="body2" color="text.secondary">
                                {customer.notes.length > 120 ? `${customer.notes.slice(0, 120)}...` : customer.notes}
                              </Typography>
                            </Box>
                          )}

                          {isMusicProducer && customerSplitSheetsList.length > 0 && (
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <SplitSheetIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                                  Split sheets {customerSplitSheetsList.length}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {completedCount > 0 && (
                                  <Chip label={`${completedCount} fullført`} size="small" sx={{ bgcolor: '#4caf50', color: 'white' }} />
                                )}
                                {pendingCount > 0 && (
                                  <Chip label={`${pendingCount} venter`} size="small" sx={{ bgcolor: '#ff9800', color: 'white' }} />
                                )}
                              </Stack>
                            </Stack>
                          )}

                          <Divider />

                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                                Link event
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VideoCall />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                                setShowMeetingDialog(true);
                              }}
                              disabled={customer.status === 'archived' || !communicationTrackingAccess.hasAccess}
                            >
                              Møte
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={theming.getThemedIcon('add')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                                setShowProjectDialog(true);
                              }}
                              disabled={customer.status === 'archived' || !projectManagementAccess.hasAccess}
                              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                            >
                              Prosjekt
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<WorkOutline />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onCustomerSelect?.(customer);
                              }}
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
                            >
                              Rediger
                            </Button>
                            {isMusicProducer && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<SplitSheetIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    communication.sendMessage({
                                      from: 'universal-crm-dashboard',
                                      to: 'split-sheet-manager',
                                      type: 'view-customer-split-sheets',
                                      data: {
                                        customerId: customer.id,
                                        customerName: customer.name,
                                        projectIds: customerProjectIds,
                                      },
                                      priority: 'medium',
                                    });
                                  } catch (err) {
                                    console.warn('Could not send message to split-sheet-manager:', err);
                                  }
                                }}
                                sx={{
                                  color: '#7c3aed',
                                  borderColor: alpha('#7c3aed', 0.36),
                                  '&:hover': {
                                    borderColor: '#7c3aed',
                                    bgcolor: alpha('#7c3aed', 0.08),
                                  },
                                }}
                              >
                                Split Sheet
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ContractIcon />}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                                try {
                                  const contracts = await apiRequest(`/api/contracts?clientId=${customer.id}`);
                                  setCustomerContracts(contracts.contracts || []);
                                  setShowContractsDialog(true);
                                } catch (fetchError) {
                                  console.error('Error fetching contracts:', fetchError);
                                  setCustomerContracts([]);
                                  setShowContractsDialog(true);
                                }
                              }}
                              sx={{ borderColor: alpha('#f57c00', 0.4), color: '#f57c00' }}
                            >
                              Kontrakter
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Stack>
      </Stack>

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
                <React.Fragment key={contract.id}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#f57c0020', color: '#f57c00' }}>
                      <ContractIcon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
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
                <Divider component="li" />
                </React.Fragment>
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
            <Schedule color="primary" />
            Planlegg møte med {selectedCustomer?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2,mt: 1 }}>
            <TextField
              label="Møtetittel"
              value={`Møte med ${selectedCustomer?.name}${selectedProject?.name ? ` • ${selectedProject.name}` : ''}`}
              fullWidth
              disabled
            />
            <TextField
              label="Dato"
              type="date"
              value={meetingForm.date}
              onChange={(event) => setMeetingForm((current) => ({ ...current, date: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Tid"
              type="time"
              value={meetingForm.time}
              onChange={(event) => setMeetingForm((current) => ({ ...current, time: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Varighet (minutter)"
              type="number"
              value={meetingForm.duration}
              onChange={(event) => setMeetingForm((current) => ({ ...current, duration: Number(event.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              multiline
              rows={3}
              value={meetingForm.description}
              onChange={(event) => setMeetingForm((current) => ({ ...current, description: event.target.value }))}
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
                date: meetingForm.date,
                time: meetingForm.time,
                duration: meetingForm.duration,
                description: meetingForm.description,
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
            {selectedProject && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Prosjektet kobles mot valgt dashboard-kontekst: <strong>{selectedProject.name || selectedProject.title}</strong>.
              </Alert>
            )}
            <TextField
              label="Prosjektnavn"
              value={`${selectedCustomer?.name} - ${selectedCustomer?.projectType || selectedProject?.projectType || 'Prosjekt'}`}
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
                } catch (error) {
                  console.warn('Could not link customer to event via communication bus:', error);
                }
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
            width: 'min(1500px, 96vw)',
            height: 'min(92vh, 1100px)',
            maxHeight: '92vh',
            borderRadius: 4,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
            boxShadow: '0 32px 80px rgba(15, 23, 42, 0.18)',
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          py: 2.25,
          borderBottom: `1px solid ${colors.primary}22`,
          background: `linear-gradient(135deg, ${colors.primary}14 0%, rgba(255,255,255,0.92) 58%, ${colors.primary}08 100%)`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ color: colors.primary }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Business Intelligence Dashboard</Typography>
          </Box>
          <Button onClick={() => setShowBIDialog(false)}>Lukk</Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', bgcolor: 'transparent' }}>
          <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 3 } }}>
            <BusinessIntelligenceDashboard
              userId={resolvedUserId}
              profession={activeProfession}
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showTasksDialog}
        onClose={() => setShowTasksDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            width: 'min(1200px, 94vw)',
            height: 'min(88vh, 980px)',
            maxHeight: '88vh',
            borderRadius: 4,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          py: 2.25,
          borderBottom: `1px solid ${colors.primary}22`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TaskIcon sx={{ color: colors.primary }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Google Tasks
            </Typography>
          </Box>
          <Button onClick={() => setShowTasksDialog(false)}>Lukk</Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <GoogleTasksIntegration
            profession={activeProfession}
            userId={resolvedUserId}
            projectId={typeof selectedProject?.id === 'string' ? selectedProject.id : undefined}
          />
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
