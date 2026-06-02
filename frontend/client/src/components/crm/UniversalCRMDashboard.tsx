// @ts-nocheck
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
  DeleteOutline as DeleteIcon,
  Archive as ArchiveIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  RequestQuote as QuoteIcon,
  ReceiptLong as InvoiceIcon,
  ViewKanban as KanbanIcon,
  ViewList as ListIcon,
  MailOutline as MailIcon,
  ArrowForward as NextStepIcon,
  StarBorder as ReviewIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import CustomerDetailDrawer from './CustomerDetailDrawer';
import CrmTaskInbox from './CrmTaskInbox';
import DealsPipelineBoard from './DealsPipelineBoard';
import CrmActionQueue from './CrmActionQueue';
import CrmReports from './CrmReports';
import CrmImportDialog from './CrmImportDialog';
import CrmDuplicatesDialog from './CrmDuplicatesDialog';
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

// Single source of truth for status labels so card-chips, filter and edit
// dialog never disagree (gap #23). Pipeline order drives the board view (#2)
// and the "Neste steg"-action (#20/#26).
const STATUS_LABELS: Record<string, string> = {
  lead: 'Henvendelse',
  prospect: 'Potensiell',
  active: 'Aktiv',
  completed: 'Fullført',
  archived: 'Arkivert',
};
const PIPELINE_ORDER: Array<'lead' | 'prospect' | 'active' | 'completed'> = [
  'lead',
  'prospect',
  'active',
  'completed',
];
const statusLabel = (status: string): string => STATUS_LABELS[status] || status;
const nextStatus = (status: string): 'prospect' | 'active' | 'completed' | null => {
  const i = PIPELINE_ORDER.indexOf(status as any);
  if (i < 0 || i >= PIPELINE_ORDER.length - 1) return null;
  return PIPELINE_ORDER[i + 1] as 'prospect' | 'active' | 'completed';
};

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
  const { toast } = useToast();
  // Sync helper — every CRM mutation announces itself on the integration bus
  // AND broadcasts, so UniversalDashboard and any registered component stay in
  // step with what just happened in the CRM ("alt synker med hverandre").
  const emitCrmChange = React.useCallback((type: string, data: any) => {
    try { integration.emit(type, { ...data, source: 'universal-crm-dashboard' }); } catch { /* bus best-effort */ }
    try { communication.sendBroadcast(type, data); } catch { /* bus best-effort */ }
  }, [integration, communication]);
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
  // CRM workflow gaps — see docs/UNIVERSAL-CRM-WORKFLOW-GAPS.md
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list'); // #2 pipeline-board
  const [customerToDelete, setCustomerToDelete] = useState<UniversalCustomer | null>(null); // #41 slett/arkiver
  const [meetingResult, setMeetingResult] = useState<{ meetLink?: string | null; webViewUrl?: string | null } | null>(null); // #5/#29 vis Meet-lenke
  const [showFollowUpFor, setShowFollowUpFor] = useState<UniversalCustomer | null>(null); // #38 etter-levering
  const [detailCustomer, setDetailCustomer] = useState<UniversalCustomer | null>(null); // #2 kontaktdetalj-drawer
  const [showTaskInbox, setShowTaskInbox] = useState(false); // #5 task-inbox
  const [showActionQueue, setShowActionQueue] = useState(false); // #24 action queue
  const [showReports, setShowReports] = useState(false); // Wave 3 reports
  const [showImport, setShowImport] = useState(false); // Wave 3b CSV import
  const [showDuplicates, setShowDuplicates] = useState(false); // #33 dedupe-merge
  // #42 — controlled edit-form so empty fields never corrupt into ', '
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'lead',
    notes: '',
  });
  // #4 — contract form (event date/location/type/deposit) instead of one-click.
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractForm, setContractForm] = useState({
    contractType: '',
    eventDate: '',
    eventLocation: '',
    totalAmount: '',
    depositAmount: '',
  });
  // #9/#10 — invoices dialog state
  const [showInvoicesDialog, setShowInvoicesDialog] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ description: '', totalAmount: '', depositAmount: '', dueDate: '' });
  // Slice 9X.8 — per-client galleries dialog. Opens when photographer
  // clicks "Galleri-historikk" on a customer card; lists every gallery
  // belonging to that customer with full status, share-link, and
  // mark-complete action.
  const [showGalleriesDialog, setShowGalleriesDialog] = useState(false);
  const [customerContracts, setCustomerContracts] = useState<any[]>([]);
  const [meetingForm, setMeetingForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 60,
    location: '',
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
      location: (selectedCustomer.customFields?.location as string) || '',
      description: `Kundemøte for ${selectedCustomer.projectType || selectedProject?.projectType || 'prosjekt'}${selectedProject?.name ? ` • ${selectedProject.name}` : ''}`,
    });
  }, [selectedCustomer, selectedProject, showMeetingDialog]);

  // #42 — hydrate the controlled edit-form when the dialog opens.
  useEffect(() => {
    if (!editingCustomer || !showEditDialog) return;
    setEditForm({
      name: editingCustomer.name || '',
      email: editingCustomer.email || '',
      phone: editingCustomer.phone || '',
      company: editingCustomer.company || '',
      status: editingCustomer.status || 'lead',
      notes: editingCustomer.notes || '',
    });
  }, [editingCustomer, showEditDialog]);

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
    queryKey: ['universal-crm-customers', activeProfession, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeProfession) params.append('profession', activeProfession);
      if (searchTerm) params.append('search', searchTerm);
      // #22/#14 — push status to the server so the count is truthful and we
      // are not just filtering the first loaded page client-side.
      if (statusFilter) params.append('status', statusFilter);

      // Via apiRequest so the Bearer token is attached (raw fetch was 401-ing).
      return apiRequest(`/api/universal-crm/customers?${params.toString()}`);
  }
});

  // Fetch CRM statistics
  const { data: statsData } = useQuery({
    queryKey: ['universal-crm-stats', activeProfession],
    queryFn: async () => {
      const params = activeProfession ? `?profession=${activeProfession}` : '';
      return apiRequest(`/api/universal-crm/stats${params}`);
  }
});

  // Slice 9X.16 — fetch ALL photographer galleries once and group by
  // clientEmail so every customer card can surface "X galleries · Y
  // selected · Z paid". Uses the same /api/photographer/galleries
  // endpoint ClientGalleriesManager + ProjectTimeline already poll, so
  // React Query caches the response across the dashboard.
  const { data: galleriesData } = useQuery<{ galleries: Array<{
    id: string;
    clientEmail: string;
    status: string;
    completedAt?: string | null;
    imageCount: number;
    selectionCount: number;
    paidCount: number;
    favoriteCount?: number;
    commentCount?: number;
    createdAt: string;
    shareUrl: string;
    projectTitle: string | null;
    linkedProjectTitle?: string | null;
  }> }>({
    queryKey: ['/api/photographer/galleries'],
    queryFn: async () => {
      try { return await apiRequest('/api/photographer/galleries'); }
      catch { return { galleries: [] }; }
    },
    refetchInterval: 30_000,
  });
  const galleriesByClient = React.useMemo(() => {
    const m = new Map<string, {
      count: number;
      activeCount: number;
      completedCount: number;
      totalSelections: number;
      totalPaid: number;
      lastActivity: string | null;
      latestShareUrl: string | null;
      latestProjectTitle: string | null;
    }>();
    for (const g of galleriesData?.galleries ?? []) {
      const key = (g.clientEmail || '').toLowerCase().trim();
      if (!key) continue;
      const existing = m.get(key) ?? {
        count: 0,
        activeCount: 0,
        completedCount: 0,
        totalSelections: 0,
        totalPaid: 0,
        lastActivity: null as string | null,
        latestShareUrl: null as string | null,
        latestProjectTitle: null as string | null,
      };
      existing.count += 1;
      if (g.status === 'completed' || g.completedAt) existing.completedCount += 1;
      else existing.activeCount += 1;
      existing.totalSelections += g.selectionCount || 0;
      existing.totalPaid += g.paidCount || 0;
      const stamp = g.completedAt ?? g.createdAt;
      if (!existing.lastActivity || (stamp && stamp > existing.lastActivity)) {
        existing.lastActivity = stamp;
        existing.latestShareUrl = g.shareUrl;
        existing.latestProjectTitle = g.linkedProjectTitle ?? g.projectTitle;
      }
      m.set(key, existing);
    }
    return m;
  }, [galleriesData]);

  // Slice 9X.16+ — projects-per-customer aggregation. Same backend
  // endpoint UniversalDashboard already polls; React Query caches
  // across the dashboard so no extra hit. Map keyed on lowercased
  // clientEmail so it joins cleanly with customer.email regardless of
  // case differences between sources.
  const { data: projectsList } = useQuery<Array<{
    id: string;
    name: string;
    title: string;
    clientEmail: string;
    status: string;
    budget: number | null;
    eventDate: string | null;
    createdAt: string;
  }>>({
    queryKey: ['/api/projects', user?.id, 'crm-aggregation'],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      try {
        const arr = await apiRequest(`/api/projects?userId=${encodeURIComponent(String(user?.id ?? ''))}`);
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    },
  });
  const projectsByClient = React.useMemo(() => {
    const m = new Map<string, {
      count: number;
      activeCount: number;
      completedCount: number;
      draftCount: number;
      totalBudget: number;
      lastEventDate: string | null;
      latestProjectId: string | null;
      latestProjectName: string | null;
    }>();
    for (const p of projectsList ?? []) {
      const key = (p.clientEmail || '').toLowerCase().trim();
      if (!key) continue;
      const existing = m.get(key) ?? {
        count: 0,
        activeCount: 0,
        completedCount: 0,
        draftCount: 0,
        totalBudget: 0,
        lastEventDate: null as string | null,
        latestProjectId: null as string | null,
        latestProjectName: null as string | null,
      };
      existing.count += 1;
      if (p.status === 'completed') existing.completedCount += 1;
      else if (p.status === 'draft') existing.draftCount += 1;
      else existing.activeCount += 1;
      if (p.budget && p.budget > 0) existing.totalBudget += p.budget;
      const stamp = p.eventDate || p.createdAt;
      if (!existing.lastEventDate || (stamp && stamp > existing.lastEventDate)) {
        existing.lastEventDate = stamp;
        existing.latestProjectId = p.id;
        existing.latestProjectName = p.title || p.name;
      }
      m.set(key, existing);
    }
    return m;
  }, [projectsList]);

  // Fetch split sheet statistics (only for music producers)
  const isMusicProducer = activeProfession === 'music_producer';
  const { data: splitSheetStatsData } = useQuery({
    queryKey: ['split-sheets-crm-stats', activeProfession],
    queryFn: async () => apiRequest(`/api/split-sheets/stats?profession=${activeProfession}`),
    enabled: isMusicProducer,
  });

  const splitSheetStats = splitSheetStatsData?.data || {};

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: Partial<UniversalCustomer>) => {
      return apiRequest('/api/universal-crm/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...customerData,
          profession: activeProfession,
          status: customerData.status || 'lead',
        }),
      });
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
      const createdName = created?.name || created?.customer?.name || 'Kunden';
      emitCrmChange('customer:created', created?.customer || created);
      toast({ title: 'Kunde lagret', description: `${createdName} er lagt til i CRM.`, variant: 'success' });
      setShowAddForm(false);
    },
    onError: (err: any) => {
      // #18/#40 — keep the form open with its data so nothing is lost.
      toast({
        title: 'Kunne ikke lagre kunden',
        description: err?.message || 'Sjekk nettforbindelsen og prøv igjen — skjemaet er beholdt.',
        variant: 'destructive',
      });
    },
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UniversalCustomer> }) => {
      return apiRequest(`/api/universal-crm/customers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (updated) => {
      try {
        communication.sendBroadcast('customer:updated', updated);
      } catch (error) {
        console.warn('Could not broadcast updated customer:', error);
      }
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      toast({ title: 'Kunde oppdatert', variant: 'success' });
      setShowEditDialog(false);
      setEditingCustomer(null);
    },
    onError: (err: any) => {
      // #21/#42 — surface failures; do NOT close the dialog so edits survive.
      toast({
        title: 'Kunne ikke oppdatere kunden',
        description: err?.message || 'Endringene ble ikke lagret. Prøv igjen.',
        variant: 'destructive',
      });
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
      // Backend cascades customer.status → 'active' on project creation.
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      // Notify parent component
      if (onProjectCreate) {
        onProjectCreate(data.customer, data.project);
      }
      toast({
        title: 'Prosjekt opprettet',
        description: `${data.customer?.name || 'Kunden'} er nå satt som aktiv.`,
        variant: 'success',
      });
      setShowProjectDialog(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Kunne ikke opprette prosjekt',
        description: err?.message || 'Prøv igjen.',
        variant: 'destructive',
      });
    },
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
      // #29 — surface the Meet link instead of throwing it away. Keep the
      // dialog open so the photographer can copy/open it.
      const meeting = data.meeting || {};
      setMeetingResult({ meetLink: meeting.meetLink ?? null, webViewUrl: meeting.webViewUrl ?? null });

      // #7 — persist to the CRM agenda so "kommende møter" can list it.
      recordMeetingMutation.mutate({
        customerId: data.customer?.id,
        title: `Møte med ${data.customer?.name || 'kunde'}`,
        description: meetingForm.description,
        location: meetingForm.location,
        meetLink: meeting.meetLink ?? null,
        webViewUrl: meeting.webViewUrl ?? null,
        scheduledAt: meetingForm.date ? `${meetingForm.date}T${meetingForm.time || '10:00'}:00` : null,
        durationMinutes: meetingForm.duration,
        profession: activeProfession,
      });

      // #26 — a scheduled meeting advances a raw lead one step.
      if (data.customer?.id && data.customer.status === 'lead') {
        updateCustomerMutation.mutate({ id: data.customer.id, updates: { status: 'prospect' } });
      }
      queryClient.invalidateQueries({ queryKey: ['crm-meetings'] });
      emitCrmChange('meeting:created', { meeting: data.meeting, customerId: data.customer?.id });
      toast({
        title: 'Møte planlagt',
        description: meeting.meetLink ? 'Google Meet-lenke er klar nedenfor.' : `Møte med ${data.customer?.name || 'kunden'} er opprettet.`,
        variant: 'success',
      });
    },
    onError: (err: any) => {
      // #28 — a missing Google connection returns 400; tell the user how to fix it.
      const msg = String(err?.message || '');
      const needsGoogle = /google|connect|not connected|401|400/i.test(msg);
      toast({
        title: 'Kunne ikke planlegge møtet',
        description: needsGoogle
          ? 'Koble Google-kontoen din i Innstillinger først, så fungerer Meet-lenker.'
          : (msg || 'Prøv igjen.'),
        variant: 'destructive',
        duration: 7000,
      });
    },
  });

  // #4/#13/#39 — contract create as a real mutation: carries event date,
  // location, type and deposit; gives feedback; flips lead/prospect → active.
  const createContractMutation = useMutation({
    mutationFn: async ({ customer, form }: { customer: UniversalCustomer; form: typeof contractForm }) => {
      const contractData = {
        clientName: customer.name,
        clientEmail: customer.email,
        clientId: customer.id,
        projectDescription: `${customer.name} - ${customer.projectType || 'Prosjekt'}`,
        contractType: form.contractType || customer.projectType || 'general',
        totalAmount: Number(form.totalAmount) || customer.budget || 0,
        depositAmount: Number(form.depositAmount) || 0,
        eventDate: form.eventDate || (customer.customFields?.eventDate as string) || null,
        eventLocation: form.eventLocation || (customer.customFields?.location as string) || null,
        status: 'draft',
        profession: activeProfession,
      };
      const response = await apiRequest('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractData),
      });
      const contracts = await apiRequest(`/api/contracts?clientId=${encodeURIComponent(customer.id)}`);
      return { response, contracts, customer };
    },
    onSuccess: ({ contracts, customer }) => {
      setCustomerContracts(contracts.contracts || []);
      setShowContractForm(false);
      // #26 — a contract means the deal is real: advance the customer.
      if (customer.status === 'lead' || customer.status === 'prospect') {
        updateCustomerMutation.mutate({ id: customer.id, updates: { status: 'active' } });
      }
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      emitCrmChange('contract:created', { customerId: customer.id, customerName: customer.name });
      toast({ title: 'Kontrakt opprettet', description: 'Utkast lagret. Send til signering når du er klar.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke opprette kontrakt', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  // #34/#44 — mark gallery delivered with real feedback + idempotent handling.
  const markGalleryCompleteMutation = useMutation({
    mutationFn: async (galleryId: string) => {
      return apiRequest(`/api/photographer/galleries/${galleryId}/mark-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
      emitCrmChange('gallery:changed', { reason: 'completed' });
      toast({
        title: res?.alreadyCompleted ? 'Galleriet var allerede levert' : 'Galleri markert som levert',
        variant: 'success',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke markere som levert', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  // #33 — email the client the gallery share-link straight from the CRM.
  const notifyClientMutation = useMutation({
    mutationFn: async (galleryId: string) => {
      return apiRequest(`/api/photographer/galleries/${galleryId}/notify-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      toast({ title: 'Galleri sendt til klient', description: 'Klienten har fått e-post med lenken.', variant: 'success' });
    },
    onError: (err: any) => {
      const msg = String(err?.message || '');
      toast({
        title: 'Kunne ikke sende til klient',
        description: /503|email|smtp|mail/i.test(msg) ? 'E-posttjenesten er ikke konfigurert ennå.' : (msg || 'Prøv igjen.'),
        variant: 'destructive',
      });
    },
  });

  // #36 — create a fresh gallery for a customer from the card.
  const createGalleryMutation = useMutation({
    mutationFn: async (customer: UniversalCustomer) => {
      return apiRequest('/api/photographer/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: customer.name,
          clientEmail: customer.email,
          projectTitle: `${customer.name} - ${customer.projectType || 'Galleri'}`,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
      emitCrmChange('gallery:changed', { reason: 'created' });
      toast({ title: 'Nytt galleri opprettet', description: 'Last opp bilder og send til klient når du er klar.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke opprette galleri', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  // #3/#24 — "Tilbud" creates a real CRM deal in the proposal stage. This both
  // gives Simen a proposal record AND populates the deal pipeline the /stats
  // revenue KPI reads (previously a permanent 0 because nothing wrote deals).
  const createDealMutation = useMutation({
    mutationFn: async (customer: UniversalCustomer) => {
      return apiRequest('/api/universal-crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          title: `Tilbud: ${customer.name} – ${customer.projectType || 'Prosjekt'}`,
          value: customer.budget || 0,
          currency: 'NOK',
          stage: 'proposal',
          serviceType: customer.projectType || null,
          notes: customer.notes || null,
        }),
      });
    },
    onSuccess: (_res, customer) => {
      // A sent proposal moves a raw lead to prospect.
      if (customer.status === 'lead') {
        updateCustomerMutation.mutate({ id: customer.id, updates: { status: 'prospect' } });
      }
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-deals'] });
      // UniversalDashboard already listens for quote:created.
      emitCrmChange('quote:created', { customerId: customer.id, customerName: customer.name });
      emitCrmChange('crm:deal:created', { customerId: customer.id });
      toast({ title: 'Tilbud opprettet', description: `Lagt i pipeline for ${customer.name}.`, variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke opprette tilbud', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  // #41 — delete / archive a customer with confirmation + feedback.
  const deleteCustomerMutation = useMutation({
    mutationFn: async ({ id, hard }: { id: string; hard?: boolean }) => {
      // #15 — soft-delete by default; hard=true is an irreversible GDPR erasure.
      return apiRequest(`/api/universal-crm/customers/${encodeURIComponent(id)}${hard ? '?hard=true' : ''}`, { method: 'DELETE' });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      emitCrmChange('customer:deleted', { id: customerToDelete?.id });
      toast({ title: res?.erased ? 'Alle data slettet' : 'Kunde slettet', variant: 'success' });
      setCustomerToDelete(null);
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke slette kunden', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  // #9/#10 — invoices for the open customer.
  const { data: invoicesData } = useQuery<{ invoices: any[] }>({
    queryKey: ['universal-crm-invoices', selectedCustomer?.id],
    enabled: Boolean(selectedCustomer?.id) && showInvoicesDialog,
    queryFn: async () => {
      try { return await apiRequest(`/api/universal-crm/invoices?customer_id=${encodeURIComponent(selectedCustomer!.id)}`); }
      catch { return { invoices: [] }; }
    },
  });
  const customerInvoices = invoicesData?.invoices || [];

  const createInvoiceMutation = useMutation({
    mutationFn: async ({ customer, form }: { customer: UniversalCustomer; form: typeof invoiceForm }) => {
      return apiRequest('/api/universal-crm/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          description: form.description || `${customer.name} – ${customer.projectType || 'oppdrag'}`,
          totalAmount: Number(form.totalAmount) || customer.budget || 0,
          depositAmount: Number(form.depositAmount) || 0,
          dueDate: form.dueDate || null,
          profession: activeProfession,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universal-crm-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      emitCrmChange('invoice:created', { customerId: selectedCustomer?.id });
      setShowInvoiceForm(false);
      setInvoiceForm({ description: '', totalAmount: '', depositAmount: '', dueDate: '' });
      toast({ title: 'Faktura opprettet', description: 'Markert som sendt. Registrer betaling når den kommer.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke opprette faktura', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ invoice, kind }: { invoice: any; kind: 'deposit' | 'full' }) => {
      const paidAmount = kind === 'full' ? invoice.totalAmount : (invoice.depositAmount || 0);
      return apiRequest(`/api/universal-crm/invoices/${encodeURIComponent(invoice.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universal-crm-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      emitCrmChange('invoice:paid', { customerId: selectedCustomer?.id });
      toast({ title: 'Betaling registrert', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Kunne ikke registrere betaling', description: err?.message || 'Prøv igjen.', variant: 'destructive' });
    },
  });

  // #27 — book an invoice into PowerOffice (accounting).
  const bookInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) =>
      apiRequest(`/api/universal-crm/invoices/${encodeURIComponent(invoiceId)}/book`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['universal-crm-invoices'] });
      toast({
        title: 'Bokført i PowerOffice',
        description: r?.sendError ? `Salgsordre opprettet (sending: ${r.sendError})` : `Salgsordre ${r?.salesOrderNumber ?? ''} opprettet`.trim(),
        variant: 'success',
      });
    },
    onError: (err: any) => {
      const msg = String(err?.message || '');
      toast({
        title: 'Kunne ikke bokføre',
        description: /412|ikke koblet|ikke aktiv/i.test(msg) ? 'Koble PowerOffice i innstillinger først.' : (msg || 'Prøv igjen.'),
        variant: 'destructive', duration: 7000,
      });
    },
  });

  // #7 — record each scheduled meeting so the agenda has something to list.
  const recordMeetingMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest('/api/universal-crm/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-meetings'] });
    },
  });

  // #7 — upcoming meetings agenda.
  const { data: upcomingMeetingsData } = useQuery<{ meetings: any[] }>({
    queryKey: ['crm-meetings', 'upcoming'],
    queryFn: async () => {
      try { return await apiRequest('/api/universal-crm/meetings?upcoming=true'); }
      catch { return { meetings: [] }; }
    },
  });
  const upcomingMeetings = upcomingMeetingsData?.meetings || [];

  const customers = customersData?.customers || [];
  const stats = statsData?.stats || { total: 0, byStatus: {}, recentlyAdded: 0, deals: { totalValue: 0, won: 0 }, tasks: {} };
  // #22/#14 — status is now filtered server-side, so the rendered list IS the
  // filtered list. totalMatching is the true count from the server (not just
  // the loaded page), so "synlige kunder" no longer lies.
  const filteredCustomers = customers;
  const totalMatching = typeof customersData?.total === 'number' ? customersData.total : customers.length;
  const loadedIsCapped = customers.length < totalMatching;
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
      label: 'Avtalt verdi',
      // #11 — profession-agnostic revenue KPI from the deal pipeline the
      // backend already sums; no longer hidden behind the music-producer branch.
      value: `${Math.round(stats.deals?.totalValue || 0).toLocaleString('nb-NO')} kr`,
      // #10 — surface outstanding accounts-receivable from invoices.
      description: `Utestående: ${Math.round(stats.invoices?.outstanding || 0).toLocaleString('nb-NO')} kr`,
      tone: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)',
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

      let result: any;
      try { result = await apiRequest(`/api/split-sheets?project_id=${projectIds.join('')}`); }
      catch { return {}; }

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
    // #19 — empty website must be '', never the literal ',' that corrupted customFields.
    const website = ((formData.get('website') as string) || '').trim();
    const source = ((formData.get('source') as string) || 'manual').trim();
    const customerData: Partial<UniversalCustomer> = {
      name: (formData.get('name') as string)?.trim(),
      email: (formData.get('email') as string)?.trim(),
      phone: (formData.get('phone') as string)?.trim(),
      company: (formData.get('company') as string)?.trim(),
      projectType: (formData.get('projectType') as string)?.trim(),
      budget: parseFloat(formData.get('budget') as string) || undefined,
      notes: (formData.get('notes') as string) || '',
      status: (formData.get('status') as string) || 'lead',
      source, // #17 — capture lead source for ROI reporting
      // only persist website when actually provided
      customFields: website ? { website } : {},
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
                {/* #28 — import existing client list (biggest adoption blocker). */}
                <Button
                  variant="outlined"
                  startIcon={<CopyIcon />}
                  onClick={() => setShowImport(true)}
                  disabled={!customerManagementAccess.hasAccess}
                  sx={{
                    minWidth: 130,
                    borderColor: alpha(colors.primary, 0.25),
                    color: colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': { borderColor: colors.secondary, bgcolor: alpha(colors.primary, 0.08) },
                  }}
                >
                  Importer
                </Button>
                {/* #33 — duplicate detection + merge. */}
                <Button
                  variant="outlined"
                  onClick={() => setShowDuplicates(true)}
                  disabled={!customerManagementAccess.hasAccess}
                  sx={{
                    minWidth: 120,
                    borderColor: alpha(colors.primary, 0.25),
                    color: colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': { borderColor: colors.secondary, bgcolor: alpha(colors.primary, 0.08) },
                  }}
                >
                  Dubletter
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
                {/* Wave 3 — revenue intelligence reports + CSV export. */}
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => setShowReports(true)}
                  sx={{
                    minWidth: 140,
                    borderColor: alpha(colors.primary, 0.25),
                    color: colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': { borderColor: colors.secondary, bgcolor: alpha(colors.primary, 0.08) },
                  }}
                >
                  Rapporter
                </Button>
                {/* #24 — daily action queue (rebook/dormant/review/overdue). */}
                <Button
                  variant="outlined"
                  startIcon={<NextStepIcon />}
                  onClick={() => setShowActionQueue(true)}
                  sx={{
                    minWidth: 140,
                    borderColor: alpha(colors.primary, 0.25),
                    color: colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': { borderColor: colors.secondary, bgcolor: alpha(colors.primary, 0.08) },
                  }}
                >
                  Handlinger
                </Button>
                {/* #5/#37 — CRM task inbox with overdue badge. */}
                <Button
                  variant="outlined"
                  startIcon={<TaskIcon />}
                  onClick={() => setShowTaskInbox(true)}
                  sx={{
                    minWidth: 140,
                    borderColor: (stats.tasks?.overdue || 0) > 0 ? '#d32f2f' : alpha(colors.primary, 0.25),
                    color: (stats.tasks?.overdue || 0) > 0 ? '#d32f2f' : colors.primary,
                    bgcolor: alpha('#fff', 0.86),
                    '&:hover': { borderColor: colors.secondary, bgcolor: alpha(colors.primary, 0.08) },
                  }}
                >
                  Oppgaver{(stats.tasks?.pending || 0) > 0 ? ` (${stats.tasks.pending})` : ''}
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

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip
                  label={
                    loadedIsCapped
                      ? `Viser ${customers.length} av ${totalMatching}`
                      : `${totalMatching} ${statusFilter ? statusLabel(statusFilter).toLowerCase() + '-kunder' : 'kunder'}`
                  }
                  sx={{ bgcolor: alpha(colors.primary, 0.08), color: colors.primary, fontWeight: 700 }}
                />
                {statusFilter && (
                  <Button size="small" onClick={() => setStatusFilter('')}>
                    Nullstill filter
                  </Button>
                )}
                {/* #2 — switch between flat list and a pipeline board. */}
                <Button
                  size="small"
                  variant={viewMode === 'list' ? 'contained' : 'outlined'}
                  startIcon={<ListIcon />}
                  onClick={() => setViewMode('list')}
                  sx={viewMode === 'list' ? { bgcolor: colors.primary } : undefined}
                >
                  Liste
                </Button>
                <Button
                  size="small"
                  variant={viewMode === 'board' ? 'contained' : 'outlined'}
                  startIcon={<KanbanIcon />}
                  onClick={() => { setViewMode('board'); setStatusFilter(''); }}
                  sx={viewMode === 'board' ? { bgcolor: colors.primary } : undefined}
                >
                  Pipeline
                </Button>
              </Stack>
            </Stack>

            {selectedProject && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Nye kunder, møter og prosjektopprettelser kobles mot <strong>{selectedProject.name || selectedProject.title}</strong> når det er relevant.
              </Alert>
            )}
          </Stack>
        </Paper>

        {/* #7 — upcoming meetings agenda so scheduled meetings don't vanish. */}
        {upcomingMeetings.length > 0 && (
          <Paper elevation={0} sx={{ p: 2.25, borderRadius: 3.5, border: surfaceBorder }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Schedule sx={{ color: colors.primary }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Kommende møter</Typography>
              <Chip size="small" label={upcomingMeetings.length} sx={{ bgcolor: alpha(colors.primary, 0.12), color: colors.primary, fontWeight: 700 }} />
            </Stack>
            <Stack spacing={1}>
              {upcomingMeetings.slice(0, 5).map((m: any) => (
                <Stack key={m.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{m.title || 'Møte'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Ukjent tid'}
                      {m.location ? ` • ${m.location}` : ''}
                    </Typography>
                  </Box>
                  {m.meet_link && (
                    <Button size="small" startIcon={<VideoCall />} onClick={() => window.open(m.meet_link, '_blank')}>
                      Bli med
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

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
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Kilde</InputLabel>
                      <Select name="source" label="Kilde" defaultValue="manual">
                        <MenuItem value="manual">Lagt inn manuelt</MenuItem>
                        <MenuItem value="website">Nettside</MenuItem>
                        <MenuItem value="referral">Anbefaling</MenuItem>
                        <MenuItem value="instagram">Instagram</MenuItem>
                        <MenuItem value="facebook">Facebook</MenuItem>
                        <MenuItem value="email">E-post</MenuItem>
                        <MenuItem value="other">Annet</MenuItem>
                      </Select>
                    </FormControl>
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
          ) : viewMode === 'board' ? (
            /* #3/#19 — real pipeline: board operates on DEALS, not customer.status.
               Shown before the empty-customer gate so it works even with 0 customers. */
            <DealsPipelineBoard profession={activeProfession} brandColor={colors.primary} />
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
              {/* Slice 9X.81 — Skill mellom "ingen kunder ennå" og "ingen treff på filter" */}
              {customers.length === 0 ? (
                <Stack spacing={1.5} alignItems="flex-start">
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Du har ingen kunder ennå
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Opprett den første kunden manuelt, eller la dem komme inn automatisk via kundeforespørsels-skjemaet på nettsiden din.
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => setShowAddForm(true)}
                      sx={{ bgcolor: colors.primary }}
                    >
                      Opprett første kunde
                    </Button>
                    {/* #16 — real embeddable lead form, not an empty promise. */}
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<CopyIcon />}
                      onClick={async () => {
                        try {
                          const r = await apiRequest(`/api/universal-crm/lead-form-token?profession=${encodeURIComponent(activeProfession)}`);
                          const url = `${window.location.origin}/lead/${r.token}`;
                          await navigator.clipboard?.writeText(url);
                          toast({ title: 'Skjema-lenke kopiert', description: url, variant: 'success', duration: 8000 });
                        } catch (e: any) {
                          toast({ title: 'Kunne ikke hente skjema-lenke', description: e?.message || 'Prøv igjen.', variant: 'destructive' });
                        }
                      }}
                    >
                      Kopier skjema-lenke for nettsiden
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={1.5} alignItems="flex-start">
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Ingen kunder matcher filtrene
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Du har {customers.length} {customers.length === 1 ? 'kunde' : 'kunder'} totalt — prøv et annet søk eller nullstill filtrene.
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
              )}
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
                // Slice 9X.16 — gallery aggregation for this customer.
                const galleryAgg = customer.email
                  ? galleriesByClient.get(customer.email.toLowerCase().trim())
                  : null;
                // Slice 9X.16+ — projects aggregation for this customer.
                const projectAgg = customer.email
                  ? projectsByClient.get(customer.email.toLowerCase().trim())
                  : null;

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
                                  label={statusLabel(customer.status)}
                                  size="small"
                                  sx={{
                                    bgcolor: alpha(getStatusColor(customer.status), 0.12),
                                    color: getStatusColor(customer.status),
                                    fontWeight: 700,
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

                          {/* Slice 9X.16 — galleri-aggregation per kunde.
                              Surfacer hvor mange galleries denne klienten
                              har, hvor mange er levert, og samlet valg/
                              betalingsaktivitet. Klikk-to-open går til
                              det nyeste galleriet. */}
                          {galleryAgg && (
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" sx={{ fontWeight: 700, color: colors.primary }}>
                                  Klient-galleri {galleryAgg.count}
                                </Typography>
                                {galleryAgg.latestProjectTitle && (
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                                    Nyeste: {galleryAgg.latestProjectTitle}
                                  </Typography>
                                )}
                              </Stack>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {galleryAgg.activeCount > 0 && (
                                  <Chip
                                    label={`${galleryAgg.activeCount} aktive`}
                                    size="small"
                                    sx={{ bgcolor: alpha(colors.primary, 0.12), color: colors.primary, fontWeight: 700 }}
                                  />
                                )}
                                {galleryAgg.completedCount > 0 && (
                                  <Chip label={`${galleryAgg.completedCount} levert`} size="small" sx={{ bgcolor: '#4caf50', color: 'white' }} />
                                )}
                                {galleryAgg.totalSelections > 0 && (
                                  <Chip label={`${galleryAgg.totalSelections} valg`} size="small" variant="outlined" />
                                )}
                                {galleryAgg.totalPaid > 0 && (
                                  <Chip label={`${galleryAgg.totalPaid} bildekjøp`} size="small" sx={{ bgcolor: '#ff9800', color: 'white' }} />
                                )}
                                {galleryAgg.latestShareUrl && (
                                  <Chip
                                    label="Forhåndsvis"
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (galleryAgg.latestShareUrl) {
                                        window.open(galleryAgg.latestShareUrl, '_blank');
                                      }
                                    }}
                                  />
                                )}
                              </Stack>
                            </Stack>
                          )}

                          {/* Slice 9X.16+ — projects-aggregation per
                              kunde. Surfacer status-fordeling +
                              klikkbar chip til siste prosjekt. */}
                          {projectAgg && (
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0288d1' }}>
                                  Prosjekt {projectAgg.count}
                                </Typography>
                                {projectAgg.latestProjectName && (
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                                    Nyeste: {projectAgg.latestProjectName}
                                  </Typography>
                                )}
                              </Stack>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {projectAgg.activeCount > 0 && (
                                  <Chip
                                    label={`${projectAgg.activeCount} aktive`}
                                    size="small"
                                    sx={{ bgcolor: alpha('#0288d1', 0.12), color: '#0288d1', fontWeight: 700 }}
                                  />
                                )}
                                {projectAgg.draftCount > 0 && (
                                  <Chip
                                    label={`${projectAgg.draftCount} utkast`}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                                {projectAgg.completedCount > 0 && (
                                  <Chip
                                    label={`${projectAgg.completedCount} fullført`}
                                    size="small"
                                    sx={{ bgcolor: '#4caf50', color: 'white' }}
                                  />
                                )}
                                {projectAgg.totalBudget > 0 && (
                                  <Chip
                                    label={`Σ ${projectAgg.totalBudget.toLocaleString('nb-NO')} kr`}
                                    size="small"
                                    variant="outlined"
                                  />
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
                            {/* #20/#26 — advance the customer one pipeline step inline. */}
                            {nextStatus(customer.status) && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<NextStepIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const ns = nextStatus(customer.status);
                                  if (ns) updateCustomerMutation.mutate({ id: customer.id, updates: { status: ns } });
                                }}
                                disabled={updateCustomerMutation.isPending || !customerManagementAccess.hasAccess}
                                sx={{ borderColor: alpha('#0288d1', 0.4), color: '#0288d1' }}
                              >
                                {`→ ${statusLabel(nextStatus(customer.status) as string)}`}
                              </Button>
                            )}
                            {/* #3 — send a proposal (creates a deal in the pipeline). */}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<QuoteIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                createDealMutation.mutate(customer);
                              }}
                              disabled={customer.status === 'archived' || createDealMutation.isPending || !salesTrackingAccess.hasAccess}
                              sx={{ borderColor: alpha('#7c3aed', 0.4), color: '#7c3aed' }}
                            >
                              Tilbud
                            </Button>
                            {/* #9 — invoicing from the card. */}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<InvoiceIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                                setShowInvoiceForm(false);
                                setShowInvoicesDialog(true);
                              }}
                              disabled={!salesTrackingAccess.hasAccess}
                              sx={{ borderColor: alpha('#16a34a', 0.4), color: '#16a34a' }}
                            >
                              Faktura
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VideoCall />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                                setMeetingResult(null);
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
                                setDetailCustomer(customer); // #2 open the detail drawer
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
                            {/* Slice 9X.8 — open per-client gallery list. */}
                            {galleryAgg && galleryAgg.count > 0 && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCustomer(customer);
                                  setShowGalleriesDialog(true);
                                }}
                                sx={{ borderColor: alpha(colors.primary, 0.4), color: colors.primary }}
                              >
                                Galleri-historikk ({galleryAgg.count})
                              </Button>
                            )}
                            {/* #36 — create a gallery even when none exists yet. */}
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                createGalleryMutation.mutate(customer);
                              }}
                              disabled={customer.status === 'archived' || createGalleryMutation.isPending}
                              sx={{ borderColor: alpha(colors.primary, 0.4), color: colors.primary }}
                            >
                              Nytt galleri
                            </Button>
                            {/* #38 — after-delivery follow-up (review / thanks / rebook). */}
                            {(customer.status === 'active' || customer.status === 'completed') && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ReviewIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFollowUpFor(customer);
                                }}
                                sx={{ borderColor: alpha('#e91e63', 0.4), color: '#e91e63' }}
                              >
                                Oppfølging
                              </Button>
                            )}
                            {/* #41 — delete / archive with confirmation. */}
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomerToDelete(customer);
                              }}
                              sx={{ ml: 'auto' }}
                            >
                              Slett
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

      {/* Slice 9X.8 — per-client gallery-historikk dialog. Filtrerer
          galleries fetched i top-level useQuery på selectedCustomer.email
          så ingen ekstra backend-call. */}
      <Dialog
        open={showGalleriesDialog}
        onClose={() => setShowGalleriesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">
              Galleri-historikk for {selectedCustomer?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {(() => {
            const list = (galleriesData?.galleries ?? []).filter(
              (g) => (g.clientEmail || '').toLowerCase().trim() === (selectedCustomer?.email || '').toLowerCase().trim(),
            );
            if (list.length === 0) {
              return (
                <Typography color="text.secondary">
                  Ingen galleries for denne klienten ennå.
                </Typography>
              );
            }
            return (
              <Stack spacing={1.5}>
                {list
                  .slice()
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((g) => {
                    const isCompleted = g.status === 'completed' || Boolean(g.completedAt);
                    return (
                      <Card key={g.id} variant="outlined">
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" spacing={2} alignItems="flex-start">
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                {g.linkedProjectTitle || g.projectTitle || 'Galleri'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Opprettet {new Date(g.createdAt).toLocaleDateString('nb-NO')}
                                {g.completedAt
                                  ? ` · Levert ${new Date(g.completedAt).toLocaleDateString('nb-NO')}`
                                  : ''}
                              </Typography>
                              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                                <Chip
                                  size="small"
                                  label={isCompleted ? 'Levert' : 'Aktiv'}
                                  sx={{
                                    bgcolor: isCompleted ? '#4caf50' : alpha(colors.primary, 0.12),
                                    color: isCompleted ? 'white' : colors.primary,
                                    fontWeight: 700,
                                  }}
                                />
                                <Chip size="small" variant="outlined" label={`${g.imageCount} bilder`} />
                                {g.selectionCount > 0 && (
                                  <Chip size="small" variant="outlined" label={`${g.selectionCount} valg`} />
                                )}
                                {g.paidCount > 0 && (
                                  <Chip size="small" sx={{ bgcolor: '#ff9800', color: 'white' }} label={`${g.paidCount} bildekjøp`} />
                                )}
                                {(g.favoriteCount ?? 0) > 0 && (
                                  <Chip size="small" variant="outlined" sx={{ borderColor: '#e91e63', color: '#e91e63' }} label={`${g.favoriteCount} favoritter`} />
                                )}
                                {(g.commentCount ?? 0) > 0 && (
                                  <Chip size="small" variant="outlined" label={`${g.commentCount} kommentarer`} />
                                )}
                              </Stack>
                            </Box>
                            <Stack spacing={1}>
                              {/* #37 — admin management vs the client-facing preview. */}
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                onClick={() => window.open(`/photographer/galleries/${g.id}`, '_blank')}
                              >
                                Administrer
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => window.open(g.shareUrl, '_blank')}
                              >
                                Forhåndsvis som klient
                              </Button>
                              {/* #33 — email the share link to the client. */}
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<MailIcon />}
                                disabled={notifyClientMutation.isPending}
                                onClick={() => notifyClientMutation.mutate(g.id)}
                              >
                                Send til klient
                              </Button>
                              {/* #34/#44 — mark delivered via mutation (feedback + idempotent). */}
                              {!isCompleted && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  disabled={markGalleryCompleteMutation.isPending}
                                  onClick={() => markGalleryCompleteMutation.mutate(g.id)}
                                >
                                  {markGalleryCompleteMutation.isPending ? 'Markerer…' : 'Marker ferdig'}
                                </Button>
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGalleriesDialog(false)}>Lukk</Button>
        </DialogActions>
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
              onClick={() => {
                // #4 — open a real form instead of a one-click empty draft.
                setContractForm({
                  contractType: selectedCustomer?.projectType || '',
                  eventDate: (selectedCustomer?.customFields?.eventDate as string) || '',
                  eventLocation: (selectedCustomer?.customFields?.location as string) || '',
                  totalAmount: selectedCustomer?.budget ? String(selectedCustomer.budget) : '',
                  depositAmount: '',
                });
                setShowContractForm((v) => !v);
              }}
              sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' } }}
            >
              {showContractForm ? 'Skjul skjema' : 'Ny kontrakt'}
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* #4 — contract form: type, event date, location, amount + deposit. */}
          {showContractForm && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Type kontrakt"
                    value={contractForm.contractType}
                    onChange={(e) => setContractForm((c) => ({ ...c, contractType: e.target.value }))}
                    fullWidth placeholder="bryllup, portrett, konsert…"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Dato for oppdrag"
                    type="date"
                    value={contractForm.eventDate}
                    onChange={(e) => setContractForm((c) => ({ ...c, eventDate: e.target.value }))}
                    fullWidth InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Sted"
                    value={contractForm.eventLocation}
                    onChange={(e) => setContractForm((c) => ({ ...c, eventLocation: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Totalbeløp (NOK)"
                    type="number"
                    value={contractForm.totalAmount}
                    onChange={(e) => setContractForm((c) => ({ ...c, totalAmount: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Depositum (NOK)"
                    type="number"
                    value={contractForm.depositAmount}
                    onChange={(e) => setContractForm((c) => ({ ...c, depositAmount: e.target.value }))}
                    fullWidth
                    helperText="Booking bekreftes når depositum er innbetalt + kontrakt signert"
                  />
                </Grid>
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    disabled={createContractMutation.isPending || !selectedCustomer}
                    onClick={() => selectedCustomer && createContractMutation.mutate({ customer: selectedCustomer, form: contractForm })}
                    sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' } }}
                  >
                    {createContractMutation.isPending ? 'Oppretter…' : 'Opprett kontraktutkast'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          {customerContracts.length === 0 ? (
            <Alert severity="info">
              Ingen kontrakter funnet for denne kunden.
            </Alert>
          ) : (
            <List>
              {customerContracts.map((contract: any) => {
                const sigStatus = contract.signature_status || contract.signatureStatus;
                return (
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
                          Status: {contract.status} • Beløp: NOK {Number(contract.totalAmount || 0).toLocaleString('nb-NO')}
                          {contract.depositAmount ? ` • Depositum: NOK ${Number(contract.depositAmount).toLocaleString('nb-NO')}` : ''}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Opprettet: {new Date(contract.createdAt).toLocaleDateString('no-NO')}
                          {contract.eventDate ? ` • Oppdrag: ${new Date(contract.eventDate).toLocaleDateString('no-NO')}` : ''}
                        </Typography>
                      </Box>
                    }
                  />
                  <Stack spacing={0.5} alignItems="flex-end">
                    <Chip
                      label={contract.status}
                      size="small"
                      color={contract.status === 'active' ? 'success' : contract.status === 'draft' ? 'warning' : 'default'}
                    />
                    {sigStatus && (
                      <Chip label={`Signatur: ${sigStatus}`} size="small" variant="outlined" />
                    )}
                    {/* #25 — send draft to e-signing via the Contract hub. */}
                    {contract.status === 'draft' && (
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<OpenInNewIcon />}
                        onClick={() => window.open(`/contracts/${contract.id}`, '_blank')}
                      >
                        Send til signering
                      </Button>
                    )}
                  </Stack>
                </ListItem>
                <Divider component="li" />
                </React.Fragment>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowContractsDialog(false); setShowContractForm(false); }}>Lukk</Button>
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
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().split('T')[0] }}
              helperText={meetingForm.date && meetingForm.date < new Date().toISOString().split('T')[0] ? 'Datoen er i fortiden' : ' '}
              error={Boolean(meetingForm.date) && meetingForm.date < new Date().toISOString().split('T')[0]}
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
            {/* #8 — location so the shoot/meeting has a place attached. */}
            <TextField
              label="Sted / lokasjon"
              value={meetingForm.location}
              onChange={(event) => setMeetingForm((current) => ({ ...current, location: event.target.value }))}
              fullWidth
              placeholder="f.eks. studio, Vigeland­sparken, kundens adresse"
            />
            <TextField
              label="Beskrivelse"
              multiline
              rows={3}
              value={meetingForm.description}
              onChange={(event) => setMeetingForm((current) => ({ ...current, description: event.target.value }))}
              fullWidth
            />
            {/* #29 — the generated Meet link is shown, copyable and openable. */}
            {meetingResult && (
              <Alert severity="success" sx={{ alignItems: 'center' }}>
                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Møtet er opprettet{meetingResult.meetLink ? ' — Google Meet-lenke:' : '.'}
                  </Typography>
                  {meetingResult.meetLink && (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{meetingResult.meetLink}</Typography>
                      <Button
                        size="small"
                        startIcon={<CopyIcon />}
                        onClick={() => {
                          navigator.clipboard?.writeText(meetingResult.meetLink || '');
                          toast({ title: 'Lenke kopiert', variant: 'success' });
                        }}
                      >
                        Kopier
                      </Button>
                      <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => window.open(meetingResult.meetLink || '', '_blank')}>
                        Åpne
                      </Button>
                      {meetingResult.webViewUrl && (
                        <Button size="small" onClick={() => window.open(meetingResult.webViewUrl || '', '_blank')}>
                          Åpne i kalender
                        </Button>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowMeetingDialog(false); setMeetingResult(null); }}>
            {meetingResult ? 'Lukk' : 'Avbryt'}
          </Button>
          <Button variant="contained"
            onClick={() => selectedCustomer && scheduleMeetingMutation.mutate({
              customer: selectedCustomer,
              meetingData: {
                date: meetingForm.date,
                time: meetingForm.time,
                duration: meetingForm.duration,
                location: meetingForm.location,
                meetingLocation: meetingForm.location,
                description: meetingForm.description,
              }
            })}
            disabled={
              scheduleMeetingMutation.isPending ||
              !meetingForm.date ||
              meetingForm.date < new Date().toISOString().split('T')[0]
            }
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
            onClick={async () => {
              if (!selectedCustomer || !eventContext) return;
              if (onLinkToEvent) {
                onLinkToEvent(selectedCustomer, { role: linkRole, notes: linkNotes });
                setShowLinkDialog(false);
                return;
              }
              // #15 — persist to the real relations endpoint and only confirm on
              // a verified write (no more false-positive "linked" toast).
              try {
                await apiRequest(`/api/events/${encodeURIComponent(eventContext.id)}/relations`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customerId: selectedCustomer.id,
                    customerEmail: selectedCustomer.email,
                    role: linkRole,
                    notes: linkNotes,
                  }),
                });
                try {
                  communication.sendMessage('event:link-customer', {
                    eventId: eventContext.id,
                    customer: selectedCustomer,
                    role: linkRole,
                    notes: linkNotes,
                  });
                } catch { /* bus best-effort */ }
                toast({ title: 'Kontakt koblet til event', variant: 'success' });
                setShowLinkDialog(false);
              } catch (error: any) {
                toast({
                  title: 'Kunne ikke koble til event',
                  description: error?.message || 'Prøv igjen.',
                  variant: 'destructive',
                });
              }
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
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  label="Navn" fullWidth required
                  error={!editForm.name.trim()}
                  helperText={!editForm.name.trim() ? 'Navn er påkrevd' : ' '}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  label="E-post" type="email" fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  label="Telefon" fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  value={editForm.company}
                  onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                  label="Firma" fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    label="Status"
                  >
                    {PIPELINE_ORDER.concat('archived' as any).map((s) => (
                      <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  label="Notater" multiline rows={3} fullWidth
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={updateCustomerMutation.isPending || !editForm.name.trim()}
            onClick={() => {
              if (!editingCustomer) return;
              // #42 — controlled values; empty optional fields become '' (never ', ').
              updateCustomerMutation.mutate({
                id: editingCustomer.id,
                updates: {
                  name: editForm.name.trim(),
                  email: editForm.email.trim(),
                  phone: editForm.phone.trim(),
                  company: editForm.company.trim(),
                  status: editForm.status,
                  notes: editForm.notes,
                },
              });
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

      {/* #9/#10 — invoices: list, create, record payment */}
      <Dialog open={showInvoicesDialog} onClose={() => { setShowInvoicesDialog(false); setShowInvoiceForm(false); }} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InvoiceIcon sx={{ color: '#16a34a' }} />
              <Typography variant="h6">Fakturaer for {selectedCustomer?.name}</Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setInvoiceForm({
                  description: `${selectedCustomer?.name} – ${selectedCustomer?.projectType || 'oppdrag'}`,
                  totalAmount: selectedCustomer?.budget ? String(selectedCustomer.budget) : '',
                  depositAmount: '',
                  dueDate: '',
                });
                setShowInvoiceForm((v) => !v);
              }}
              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
            >
              {showInvoiceForm ? 'Skjul skjema' : 'Ny faktura'}
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {showInvoiceForm && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField label="Beskrivelse" value={invoiceForm.description} onChange={(e) => setInvoiceForm((f) => ({ ...f, description: e.target.value }))} fullWidth />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Totalbeløp (NOK)" type="number" value={invoiceForm.totalAmount} onChange={(e) => setInvoiceForm((f) => ({ ...f, totalAmount: e.target.value }))} fullWidth />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Depositum (NOK)" type="number" value={invoiceForm.depositAmount} onChange={(e) => setInvoiceForm((f) => ({ ...f, depositAmount: e.target.value }))} fullWidth />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Forfall" type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    disabled={createInvoiceMutation.isPending || !selectedCustomer}
                    onClick={() => selectedCustomer && createInvoiceMutation.mutate({ customer: selectedCustomer, form: invoiceForm })}
                    sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                  >
                    {createInvoiceMutation.isPending ? 'Oppretter…' : 'Opprett faktura'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          {customerInvoices.length === 0 ? (
            <Alert severity="info">Ingen fakturaer for denne kunden ennå.</Alert>
          ) : (
            <List>
              {customerInvoices.map((inv: any) => {
                const statusColor = inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : inv.status === 'overdue' ? 'error' : 'default';
                return (
                  <React.Fragment key={inv.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={`${inv.invoiceNumber} — ${inv.description || 'Faktura'}`}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Total: NOK {Number(inv.totalAmount).toLocaleString('nb-NO')} • Betalt: NOK {Number(inv.paidAmount).toLocaleString('nb-NO')} • Utestående: NOK {Number(inv.balanceDue).toLocaleString('nb-NO')}
                            </Typography>
                            {inv.dueDate && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                Forfall: {new Date(inv.dueDate).toLocaleDateString('no-NO')}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Stack spacing={0.5} alignItems="flex-end">
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {inv.externalInvoiceId && (
                            <Chip size="small" color="success" variant="outlined" icon={<InvoiceIcon />} label="Bokført" />
                          )}
                          <Chip label={inv.status} size="small" color={statusColor as any} />
                        </Stack>
                        {inv.status !== 'paid' && (
                          <Stack direction="row" spacing={0.5}>
                            {inv.depositAmount > 0 && inv.paidAmount < inv.depositAmount && (
                              <Button size="small" disabled={recordPaymentMutation.isPending} onClick={() => recordPaymentMutation.mutate({ invoice: inv, kind: 'deposit' })}>
                                Depositum betalt
                              </Button>
                            )}
                            <Button size="small" variant="outlined" disabled={recordPaymentMutation.isPending} onClick={() => recordPaymentMutation.mutate({ invoice: inv, kind: 'full' })}>
                              Marker betalt
                            </Button>
                          </Stack>
                        )}
                        {/* #27 — book to PowerOffice (accounting). */}
                        {!inv.externalInvoiceId && (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Button size="small" variant="text" disabled={bookInvoiceMutation.isPending} onClick={() => bookInvoiceMutation.mutate(inv.id)}>
                              Bokfør i PowerOffice
                            </Button>
                            {/* Midlertidig: PowerOffice kjører mot demo-miljø til produksjons-
                                tilgang er på plass (partnerskap). Fjern når live. */}
                            <Chip size="small" variant="outlined" color="warning" label="Demo · under utvikling" sx={{ height: 20, fontSize: '0.65rem' }} />
                          </Stack>
                        )}
                      </Stack>
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowInvoicesDialog(false); setShowInvoiceForm(false); }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* #41 — delete / archive confirmation */}
      <Dialog open={Boolean(customerToDelete)} onClose={() => setCustomerToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Slett kunde?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            <strong>Slett</strong> skjuler <strong>{customerToDelete?.name}</strong> men beholder historikken (kan gjenopprettes i databasen).
            <strong> Arkiver</strong> beholder kunden synlig som arkivert. <strong>Slett alle data</strong> fjerner alt permanent (GDPR).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          <Button onClick={() => setCustomerToDelete(null)}>Avbryt</Button>
          <Button
            startIcon={<ArchiveIcon />}
            disabled={updateCustomerMutation.isPending}
            onClick={() => {
              if (!customerToDelete) return;
              updateCustomerMutation.mutate({ id: customerToDelete.id, updates: { status: 'archived' } });
              setCustomerToDelete(null);
            }}
          >
            Arkiver
          </Button>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            disabled={deleteCustomerMutation.isPending}
            onClick={() => customerToDelete && deleteCustomerMutation.mutate({ id: customerToDelete.id })}
          >
            {deleteCustomerMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteCustomerMutation.isPending}
            onClick={() => customerToDelete && deleteCustomerMutation.mutate({ id: customerToDelete.id, hard: true })}
          >
            Slett alle data (GDPR)
          </Button>
        </DialogActions>
      </Dialog>

      {/* #38 — after-delivery follow-up: review / thank-you / rebook */}
      <Dialog open={Boolean(showFollowUpFor)} onClose={() => setShowFollowUpFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReviewIcon color="primary" />
            Oppfølging — {showFollowUpFor?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Alert severity="info">
              Lukk sløyfa etter levering: be om en anmeldelse, send takk, eller planlegg gjenbestilling.
            </Alert>
            {[
              { key: 'review', label: 'Be om anmeldelse', subject: 'Vi hadde glede av å jobbe med deg!', body: 'Kan du legge igjen en kort anmeldelse? Det betyr mye for et lite fotograffirma.' },
              { key: 'thanks', label: 'Send takk', subject: 'Tusen takk!', body: 'Tusen takk for at vi fikk ta bildene dine. Håper du blir like glad i dem som vi er.' },
              { key: 'rebook', label: 'Planlegg gjenbestilling om 1 år', subject: 'På tide med nye bilder?', body: 'Det har snart gått en stund — skal vi sette opp en ny fotografering?' },
            ].map((tpl) => (
              <Button
                key={tpl.key}
                variant="outlined"
                startIcon={<MailIcon />}
                onClick={() => {
                  const to = showFollowUpFor?.email || '';
                  // Opens the user's mail client prefilled; works without extra backend.
                  window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(tpl.subject)}&body=${encodeURIComponent(tpl.body)}`, '_blank');
                  // Log it as a CRM activity so the timeline reflects the touch.
                  if (showFollowUpFor?.id) {
                    apiRequest('/api/universal-crm/activities', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerId: showFollowUpFor.id, type: 'email', subject: tpl.label, direction: 'outbound' }),
                    }).catch(() => { /* best effort */ });
                  }
                  toast({ title: `${tpl.label} klargjort`, variant: 'success' });
                }}
              >
                {tpl.label}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFollowUpFor(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* #2 — contact detail drawer (record + timeline + quick-log) */}
      <CustomerDetailDrawer
        open={Boolean(detailCustomer)}
        customerId={detailCustomer?.id || null}
        customerName={detailCustomer?.name}
        onClose={() => setDetailCustomer(null)}
        brandColor={colors.primary}
      />

      {/* #5 — task inbox */}
      <CrmTaskInbox open={showTaskInbox} onClose={() => setShowTaskInbox(false)} brandColor={colors.primary} />

      {/* #24 — action queue */}
      <CrmActionQueue
        open={showActionQueue}
        onClose={() => setShowActionQueue(false)}
        onOpenCustomer={(id, name) => setDetailCustomer({ id, name } as any)}
        brandColor={colors.primary}
      />

      {/* Wave 3 — reports */}
      <CrmReports open={showReports} onClose={() => setShowReports(false)} brandColor={colors.primary} />

      {/* Wave 3b — CSV import */}
      <CrmImportDialog open={showImport} onClose={() => setShowImport(false)} brandColor={colors.primary} />

      {/* #33 — dedupe / merge */}
      <CrmDuplicatesDialog open={showDuplicates} onClose={() => setShowDuplicates(false)} brandColor={colors.primary} />
    </Box>
  );
}
