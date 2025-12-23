// @ts-nocheck
// Universal Contract Hub - Main contract management component
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  AddCircle as AddIcon,
  List as ListIcon,
  Settings as SettingsIcon,
  Description as DescriptionIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  Launch as LaunchIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import UniversalContractDesigner from '../../unused/contracts/PhotographerContractDesigner';
import SignatureStatusOverview from '../signatures/SignatureStatusOverview';
import ContractAmendmentHistory from '../../contracts/ContractAmendmentHistory';
import ContractSyncStatus from '../../contract-designer/ContractSyncStatus';
import { DriveFilesPanel } from '../../contract-designer/DriveFilesPanel';
import ContractTemplateSelector from '../../contracts/ContractTemplateSelector';
import ContractEditingInterface from '../../contracts/ContractEditingInterface';
import ContractComparison from './ContractComparison';
import ContractCard from './ContractCard';
import SplitSheetViewer from '../split-sheets/SplitSheetViewer';
import SplitSheetEditor from '../split-sheets/SplitSheetEditor';
import RelatedSplitSheetsSection from './RelatedSplitSheetsSection';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';

interface UniversalContractHubProps {
  profession: string; // Accept any profession string for auto-scalability
  userId?: string;
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
}

export default function UniversalContractHub({ 
  profession,
  userId: propsUserId,
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
  selectedClient
}: UniversalContractHubProps) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Master Integration System
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming(profession);
  
  // Profession adapter and dynamic professions for auto-scalability
  const { getContractTemplates, config: professionAdapterConfig } = useProfessionAdapter();
  const { getProfessionDisplayName, getUserProfessionColor } = useDynamicProfessions();
  
  const [showDesigner, setShowDesigner] = useState(false);
  const queryClient = useQueryClient();
  
  // Get authenticated user
  const { user } = useAuth();
  const userId = user?.id || propsUserId || 'guest';
  
  // Notification state
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'info',
  });
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [contractStatus, setContractStatus] = useState<string>('');
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);
  
  // Contract details modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedContractForDetails, setSelectedContractForDetails] = useState<any>(null);
  
  // Bulk actions state
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [bulkActionMenuAnchor, setBulkActionMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Template selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Edit interface state
  const [showEditInterface, setShowEditInterface] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  
  // Contract comparison state
  const [showComparison, setShowComparison] = useState(false);
  
  // Split sheet integration state
  const [showSplitSheetViewer, setShowSplitSheetViewer] = useState(false);
  const [selectedSplitSheet, setSelectedSplitSheet] = useState<any>(null);
  const [showSplitSheetEditor, setShowSplitSheetEditor] = useState(false);
  const [splitSheetEditorProjectId, setSplitSheetEditorProjectId] = useState<string | null>(null);

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'client' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get contracts for current user
  const { data: contracts, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/contracts,', userId, statusFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status, ', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      return apiRequest(`/api/contracts?${params.toString()}`);
    },
    retry: false,
    enabled: !!userId && userId !== 'guest',
  });
  
  // Filter and sort contracts client-side
  const filteredAndSortedContracts = React.useMemo(() => {
    if (!contracts?.contracts) return [];
    
    let filtered = contracts.contracts;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((contract: any) =>
        (contract.clientName || '').toLowerCase().includes(query) ||
        (contract.projectDescription || '').toLowerCase().includes(query) ||
        (contract.contractNumber || '').toLowerCase().includes(query)
      );
    }
    
    // Apply status filter (if not already filtered by API)
    if (statusFilter !== 'all') {
      filtered = filtered.filter((contract: any) => contract.status === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a: any, b: any) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        case 'amount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case 'client':
          aValue = (a.clientName || ', ').toLowerCase();
          bValue = (b.clientName || ', ').toLowerCase();
          break;
        case 'status':
          aValue = a.status || 'draft';
          bValue = b.status || 'draft';
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  }, [contracts?.contracts, searchQuery, statusFilter, sortBy, sortOrder]);

  // Build contract-specific config using profession adapter and dynamic professions
  // This makes ContractHub auto-scalable - new professions added via ProfessionTypeManager will automatically work
  const config = useMemo(() => {
    // Get contract templates from profession adapter (already uses useDynamicProfessions internally)
    const contractTemplates = getContractTemplates();
    
    // Get profession display name and color from dynamic professions
    const displayName = getProfessionDisplayName(profession);
    const professionColor = getUserProfessionColor(profession);
    
    // Try to get description from profession adapter config or use default
    const description = professionAdapterConfig?.description 
      ? `Administrer alle ${displayName.toLowerCase()}kontrakter`
      : `Administrer kontrakter for ${displayName.toLowerCase()}`;
    
    // Use contract templates from adapter, or fallback to typical projects if available
    const templates = contractTemplates.length > 0 
      ? contractTemplates.map(t => {
          // Convert template keys to display names (e.g.'wedding_photo' -> 'Bryllup')
          const templateMap: Record<string, string> = {
            'wedding_photo':'Bryllup','wedding_video':'Bryllupsvideo','portrait_session':'Portrett','portrait_video':'Portrettvideo','corporate_photo':'Bedriftsfoto','corporate_video':'Bedriftsvideo','commercial_photo':'Kommersiell foto','commercial_video':'Kommersiell video','music_production':'Musikkproduksjon','recording_session':'Opptak','mixing_mastering':'Miksing & Mastering','vendor_service':'Leverandørtjeneste','product_delivery':'Produktleveranse','service_agreement' : 'Tjenesteavtale',
          };
          return templateMap[t] || t.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(',');
        })
      : [];
    
    return {
      title: `${displayName} Kontrakter`,
      color: professionColor,
      description,
      templates,
    };
  }, [profession, getContractTemplates, getProfessionDisplayName, getUserProfessionColor, professionAdapterConfig]);

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleContractCreated = (contractId: string) => {
    console.log(`New contract created: ${contractId}`);
    queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
    setShowDesigner(false);
    setActiveTab(1); // Switch to contracts list
    showNotification('Kontrakt opprettet!','success');
    
    // Emit contract created event
    emitContractEvent('contract:created', { contractId, userId });
    
    // Sync data with other components
    dataFlow.syncData('contract-hub:contracts', { contractId, action: 'created' });
    
    // Call integration callbacks
    if (onProjectUpdate && selectedProject) {
      onProjectUpdate({ ...selectedProject, contractId });
    }
  };

  // E-signature creation mutation
  const createESignatureMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return await apiRequest(`/api/contracts/${contractId}/google-esignature`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      showNotification('Signaturdokument opprettet! Klienten vil motta en e-post med lenke til signering.','success');
    },
    onError: (error: any) => {
      console.error('Error creating e-signature: ', error);
      showNotification(
        error?.message || 'Kunne ikke opprette signaturdokument. Prøv igjen.','error'
      );
    },
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ contractId, status }: { contractId: string; status: string }) => {
      return await apiRequest(`/api/contracts/${contractId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      setEditDialogOpen(false);
      showNotification('Kontraktstatus oppdatert!','success');
      emitContractEvent('contract:updated', { contractId: editingContract?.id, status: contractStatus });
      dataFlow.syncData('contract-hub:contracts', { contractId: editingContract?.id, action: 'updated' });
    },
    onError: (error: any) => {
      showNotification(
        error?.message || 'Kunne ikke oppdatere kontraktstatus.','error'
      );
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return await apiRequest(`/api/contracts/${contractId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      setDeleteDialogOpen(false);
      setDeletingContractId(null);
      showNotification('Kontrakt slettet!','success');
    },
    onError: (error: any) => {
      showNotification(
        error?.message || 'Kunne ikke slette kontrakt.','error'
      );
    },
  });

  const handleEdit = (contract: any) => {
    setEditingContract(contract);
    setContractStatus(contract.status || 'draft');
    setEditDialogOpen(true);
  };

  const handleSaveStatus = () => {
    if (editingContract) {
      updateStatusMutation.mutate({
        contractId: editingContract.id,
        status: contractStatus,
      });
    }
  };

  const handleDelete = (contractId: string) => {
    setDeletingContractId(contractId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingContractId) {
      deleteMutation.mutate(deletingContractId);
    }
  };

  const handleDownloadPDF = async (contractId: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ', '}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract-${contractId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification('PDF lastet ned!','success');
      } else {
        showNotification('Kunne ikke laste ned PDF. Endpoint kan være utilgjengelig.','warning');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showNotification('Kunne ikke laste ned PDF.','error');
    }
  };

  const formatContractNumber = (contractId: string) => {
    // Format UUID to readable format (first 8 chars)
    return contractId.substring(0, 8).toUpperCase();
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('no-NO', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  // Register component with Master Integration System
  useEffect(() => {
    communication.registerComponent('contract-hub','contracts', [
      'data:read','data:write','event:emit','event:listen','ui:update','contract:manage','contract:create','contract:update','contract:sign'
    ]);

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'contract-hub',
      dataKey: 'contract-hub:contracts',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'contract-hub',
      dataKey: 'contract-hub:selectedContract',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    // Listen for contract-related messages
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'contract:created' && message.data) {
        queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
        showNotification('Ny kontrakt mottatt!','success');
      }
      if (message.type === 'contract:updated' && message.data) {
        queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      }
      if (message.type === 'contract:signed' && message.data) {
        queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
        showNotification('Kontrakt signert!','success');
      }
      if (message.type === 'project:selected' && message.data) {
        // Could filter contracts by project here
      }
      if (message.type === 'client:selected' && message.data) {
        // Could filter contracts by client here
      }
    });

    return () => {
      communication.unregisterComponent('contract-hub');
      unsubscribe();
    };
  }, [communication, dataFlow, queryClient, userId]);

  // Emit contract events
  const emitContractEvent = (type: string, data: any) => {
    communication.sendMessage({
      type,
      from: 'contract-hub',
      to: '*',
      data,
      timestamp: Date.now()
    });
  };

  if (showDesigner) {
    return (
      <UniversalContractDesigner 
        profession={profession}
        onContractCreated={handleContractCreated}
        initialClient={selectedClient ? { name: selectedClient?.name || selectedClient?.clientName, email: selectedClient?.email } : null}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
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
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 4 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <GavelIcon sx={{ mr: 2, color: config.color, fontSize: 32 }} />
          <Box>
            <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
              {config.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {config.description} - Tvers på alle dashboards
            </Typography>
          </Box>
        </Box>
        
        <Button 
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowDesigner(true)}
          sx={{ 
            bgcolor: config.color, '&:hover': { bgcolor: config.color + 'dd' }}}
        >
          Ny Kontrakt
        </Button>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <Tabs 
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<SettingsIcon />} label="System Status" />
          <Tab icon={<ListIcon />} label="Mine Kontrakter" />
          <Tab icon={<GavelIcon />} label="Kontrakt Designer" />
          <Tab icon={<DescriptionIcon />} label="E-Signaturer" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <SecurityIcon sx={{ mr: 2, color: config.color, fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                EU eIDAS Kontraktsystem Status
              </Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              ✅ Kontraktsystem er aktivt og koblet til alle dashboards via profesjonsadapteren
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  📋 Tilgjengelige Templates
                </Typography>
                <List dense>
                  {config.templates?.map((template: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon sx={{ color: config.color, fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary={template} />
                    </ListItem>
                  ))}
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  ⚙️ Systemfunksjoner
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <DescriptionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Kontraktopprettelse"
                      secondary="Norsk MVA-beregning inkludert"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <SecurityIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="EU eIDAS Digital Signering"
                      secondary="Juridisk bindende signaturer"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <DescriptionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Google Docs E-Signatur"
                      secondary="Signerbare dokumenter via Google Drive"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AssignmentIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Google Drive Backup"
                      secondary="Automatisk sikkerhetskopi"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="BRREG Integration"
                      secondary="Norske organisasjonsnummer"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                </List>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f0', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                🔗 Tverrfaglig Integrasjon: 
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kontraktsystemet fungerer "tvers på alle dashbordene og koblet til profesjonsadapteren" - 
                samme grunnleggende system med automatisk tilpasning til fotografer, videographere, 
                musikprodusenter og leverandører.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Kontrakt Oversikt
                </Typography>
                {selectedContracts.size > 0 && (
                  <Chip
                    label={`${selectedContracts.size} valgt`}
                    onDelete={() => setSelectedContracts(new Set())}
                    color="primary"
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {selectedContracts.size > 0 && (
                  <>
                    {selectedContracts.size >= 2 && selectedContracts.size <= 3 && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CompareIcon />}
                        onClick={() => setShowComparison(true)}
                        sx={{ borderColor: '#9c27b0', color: '#9c27b0' }}
                      >
                        Sammenlign ({selectedContracts.size})
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => setBulkActionMenuAnchor(e.currentTarget)}
                    >
                      Bulk Handlinger ({selectedContracts.size})
                    </Button>
                    <Menu
                      anchorEl={bulkActionMenuAnchor}
                      open={Boolean(bulkActionMenuAnchor)}
                      onClose={() => setBulkActionMenuAnchor(null)}
                    >
                      <MenuItem
                        onClick={async () => {
                          // Bulk status update
                          const promises = Array.from(selectedContracts).map((id) =>
                            apiRequest(`/api/contracts/${id}/status`, {
                              method: 'PUT',
                              body: JSON.stringify({ status: 'active' }),
                            })
                          );
                         await Promise.all(promises);
                         queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
                         setSelectedContracts(new Set());
                         setBulkActionMenuAnchor(null);
                         showNotification(`${selectedContracts.size} kontrakter oppdatert!`, 'success');
                       }}
                     >
                       Sett status til Aktiv
                     </MenuItem>
                      <MenuItem
                        onClick={async () => {
                          // Bulk delete
                          if (window.confirm(`Er du sikker på at du vil slette ${selectedContracts.size} kontrakter?`)) {
                            const promises = Array.from(selectedContracts).map((id) =>
                              apiRequest(`/api/contracts/${id}`, { method: 'DELETE' })
                            );
                           await Promise.all(promises);
                           queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
                           setSelectedContracts(new Set());
                           setBulkActionMenuAnchor(null);
                           showNotification(`${selectedContracts.size} kontrakter slettet!`, 'success');
                         }
                       }}
                     >
                       Slett valgte kontrakter
                     </MenuItem>
                      <MenuItem
                        onClick={async () => {
                          // Bulk PDF export
                          try {
                            const promises = Array.from(selectedContracts).map(async (id) => {
                              const response = await fetch(`/api/contracts/${id}/pdf`, {
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('token') || ', '}`,
                                },
                              });
                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `contract-${id}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              }
                            });
                            await Promise.all(promises);
                            showNotification('PDF-er lastet ned!','success');
                          } catch (error) {
                            showNotification('Feil ved nedlasting av PDF-er','error');
                          }
                        }}
                      >
                        Last ned PDF-er
                      </MenuItem>
                    </Menu>
                  </>
                )}
                <TextField
                  size="small"
                  placeholder="Søk kontrakter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">Alle</MenuItem>
                    <MenuItem value="draft">Utkast</MenuItem>
                    <MenuItem value="active">Aktiv</MenuItem>
                    <MenuItem value="completed">Fullført</MenuItem>
                    <MenuItem value="cancelled">Kansellert</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Sorter</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sorter"
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <MenuItem value="date">Dato</MenuItem>
                    <MenuItem value="amount">Beløp</MenuItem>
                    <MenuItem value="client">Klient</MenuItem>
                    <MenuItem value="status">Status</MenuItem>
                  </Select>
                </FormControl>
                <IconButton
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  size="small"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </IconButton>
              </Box>
            </Box>
            
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Feil ved lasting av kontrakter. Prøv å oppdatere siden.
                <Button size="small" onClick={() => refetch()} sx={{ ml: 2 }}>
                  Prøv igjen
                </Button>
              </Alert>
            )}

            {!isLoading && !error && filteredAndSortedContracts && filteredAndSortedContracts.length > 0 ? (
              <Grid container spacing={2}>
                {filteredAndSortedContracts.map((contract: any) => (
                  <Grid item xs={12} md={6} key={contract.id}>
                    <ContractCard
                      contract={contract}
                      theming={theming}
                      config={config}
                      onViewDetails={(c) => {
                        setSelectedContractForDetails(c);
                        setDetailsModalOpen(true);
                      }}
                      onEdit={(c) => {
                        setEditingContractId(c.id);
                        setShowEditInterface(true);
                        setActiveTab(2);
                      }}
                      onDelete={handleDelete}
                      onDownloadPDF={handleDownloadPDF}
                      onCreateESignature={(id) => createESignatureMutation.mutate(id)}
                      isCreatingESignature={createESignatureMutation.isPending}
                      formatDate={formatDate}
                      formatContractNumber={formatContractNumber}
                      onProjectSelect={(projectId) => {
                        if (onProjectSelect) {
                          onProjectSelect({ id: projectId });
                        }
                        emitContractEvent('project:select', { projectId });
                      }}
                      onClientSelect={(clientId, clientName) => {
                        if (onClientSelect) {
                          onClientSelect({ id: clientId, name: clientName });
                        }
                        emitContractEvent('client:select', { clientId });
                      }}
                      isSelected={selectedContracts.has(contract.id)}
                      onToggleSelect={(contractId) => {
                        const newSet = new Set(selectedContracts);
                        if (newSet.has(contractId)) {
                          newSet.delete(contractId);
                        } else {
                          if (newSet.size < 3) {
                            newSet.add(contractId);
                          }
                        }
                        setSelectedContracts(newSet);
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : !isLoading && !error ? (
              <Alert severity="info">
                Ingen kontrakter funnet. Opprett din første kontrakt ved å klikke "Ny Kontrakt".
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            {showTemplateSelector ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Velg Kontraktmal
                  </Typography>
                  <Button onClick={() => setShowTemplateSelector(false)}>Tilbake</Button>
                </Box>
                <ContractTemplateSelector
                  profession={profession}
                  onTemplateSelect={(template) => {
                    setSelectedTemplate(template);
                    setShowTemplateSelector(false);
                    setShowDesigner(true);
                  }}
                />
              </Box>
            ) : showEditInterface ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {editingContractId ? 'Rediger Kontrakt' : 'Opprett Ny Kontrakt'}
                  </Typography>
                  <Button onClick={() => {
                    setShowEditInterface(false);
                    setEditingContractId(null);
                  }}>Tilbake</Button>
                </Box>
                <ContractEditingInterface
                  contractId={editingContractId || undefined}
                  onSave={(contract) => {
                    queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
                    setShowEditInterface(false);
                    setEditingContractId(null);
                    setActiveTab(1);
                    showNotification('Kontrakt lagret!','success');
                  }}
                  onCancel={() => {
                    setShowEditInterface(false);
                    setEditingContractId(null);
                  }}
                />
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Opprett Ny Kontrakt
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Velg en metode for å opprette kontrakt:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined" sx={{ cursor: 'pointer','&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Fra Mal
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Velg fra forhåndsdefinerte maler eller opprett din egen
                        </Typography>
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => setShowTemplateSelector(true)}
                          sx={{ bgcolor: config.color }}
                        >
                          Velg Mal
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined" sx={{ cursor: 'pointer','&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Kontraktdesigner
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Bruk vår avanserte kontraktdesigner med steg-for-steg veiledning
                        </Typography>
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => setShowDesigner(true)}
                          sx={{ bgcolor: config.color }}
                        >
                          Start Designer
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined" sx={{ cursor: 'pointer','&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Manuell Redigering
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Opprett kontrakt manuelt med full kontroll over alle felter
                        </Typography>
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => {
                            setEditingContractId(null);
                            setShowEditInterface(true);
                          }}
                          sx={{ borderColor: config.color, color: config.color }}
                        >
                          Start Redigering
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* E-Signatures Tab - Shows all pending signatures across all document types */}
      {activeTab === 3 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <DescriptionIcon sx={{ mr: 2, color: config.color, fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                    E-Signaturer
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Oversikt over alle ventende signaturer på kontrakter, tilbud, split sheets og fakturaer
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 3 }} />
              
              <SignatureStatusOverview />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Edit Status Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Rediger Kontraktstatus
          <IconButton
            aria-label="close"
            onClick={() => setEditDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Status"
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="draft">Utkast</MenuItem>
            <MenuItem value="active">Aktiv</MenuItem>
            <MenuItem value="completed">Fullført</MenuItem>
            <MenuItem value="cancelled">Kansellert</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button 
            onClick={handleSaveStatus} 
            variant="contained"
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? <CircularProgress size={20} /> : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil slette denne kontrakten? Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button 
            onClick={confirmDelete} 
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <CircularProgress size={20} /> : 'Slett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contract Details Modal */}
      <Dialog 
        open={detailsModalOpen} 
        onClose={() => setDetailsModalOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5">
              Kontraktdetaljer
            </Typography>
            <IconButton onClick={() => setDetailsModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedContractForDetails && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Kontraktinformasjon
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Klient:</strong> {selectedContractForDetails.clientName || 'Ukjent'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Beskrivelse:</strong> {selectedContractForDetails.projectDescription || 'Ingen beskrivelse'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Beløp:</strong> NOK {selectedContractForDetails.totalAmount || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Status:</strong> {selectedContractForDetails.status || 'draft'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Opprettet:</strong> {formatDate(selectedContractForDetails.createdAt)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        E-Signatur Status
                      </Typography>
                      {selectedContractForDetails.google_doc_id ? (
                        <Box>
                          <Chip
                            label={selectedContractForDetails.signature_status === 'signed' ? 'Signert' : 'Venter'}
                            color={selectedContractForDetails.signature_status === 'signed' ? 'success': 'warning'}
                            sx={{ mb: 2 }}
                          />
                          {selectedContractForDetails.google_doc_url && (
                            <Button
                              variant="outlined"
                              startIcon={<LaunchIcon />}
                              href={selectedContractForDetails.google_doc_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              fullWidth
                            >
                              Åpne i Google Docs
                            </Button>
                          )}
                        </Box>
                      ) : (
                        <Alert severity="info">
                          Ingen signaturdokument opprettet ennå.
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Contract Amendment History - Only if projectId exists */}
                {selectedContractForDetails.projectId && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Kontraktshistorikk
                    </Typography>
                    <ContractAmendmentHistory
                      open={true}
                      onClose={() => {}}
                      projectId={selectedContractForDetails.projectId}
                      projectTitle={selectedContractForDetails.projectDescription}
                    />
                  </Grid>
                )}
                
                {/* Google Drive Integration - Only if projectId exists */}
                {selectedContractForDetails.projectId && (
                  <>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                        Synkroniseringsstatus
                      </Typography>
                      <ContractSyncStatus
                        projectId={selectedContractForDetails.projectId}
                        compact={false}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                        Google Drive Filer
                      </Typography>
                      <DriveFilesPanel
                        projectId={selectedContractForDetails.projectId}
                        onFileShared={(fileId) => {
                          showNotification('Fil delt med klient!','success');
                        }}
                      />
                    </Grid>
                    
                    {/* Related Split Sheets - For all professions except vendor */}
                    {profession !== 'vendor' && (
                      <Grid item xs={12}>
                        <RelatedSplitSheetsSection 
                          projectId={selectedContractForDetails.projectId}
                          contractId={selectedContractForDetails.id}
                          profession={profession}
                          onViewSplitSheet={(splitSheet) => {
                            setSelectedSplitSheet(splitSheet);
                            setShowSplitSheetViewer(true);
                            setDetailsModalOpen(false);
                          }}
                          onCreateSplitSheet={() => {
                            // Pre-populate split sheet from contract
                            const contract = selectedContractForDetails;
                            setSplitSheetEditorProjectId(contract.projectId);
                            // Store contract data for pre-population
                            setSelectedContractForDetails(contract);
                            setShowSplitSheetEditor(true);
                            setDetailsModalOpen(false);
                            // Emit event
                            emitContractEvent('split-sheet:create-from-contract', {
                              contractId: contract.id,
                              projectId: contract.projectId,
                            });
                          }}
                        />
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsModalOpen(false)}>Lukk</Button>
        </DialogActions>
          </Dialog>

      {/* Contract Comparison Dialog */}
      <Dialog
        open={showComparison}
        onClose={() => setShowComparison(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Sammenlign Kontrakter</Typography>
            <IconButton onClick={() => setShowComparison(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <ContractComparison
            contracts={(filteredAndSortedContracts || []).filter((c: any) => selectedContracts.has(c.id))}
            onClose={() => {
              setShowComparison(false);
              setSelectedContracts(new Set());
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparison(false)}>Lukk</Button>
        </DialogActions>
          </Dialog>

      {/* Split Sheet Viewer Dialog */}
      {showSplitSheetViewer && selectedSplitSheet && (
        <Dialog
          open={showSplitSheetViewer}
          onClose={() => {
            setShowSplitSheetViewer(false);
            setSelectedSplitSheet(null);
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0 }}>
            <SplitSheetViewer
              splitSheet={selectedSplitSheet}
              onClose={() => {
                setShowSplitSheetViewer(false);
                setSelectedSplitSheet(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Split Sheet Editor Dialog */}
      {showSplitSheetEditor && (
        <Dialog
          open={showSplitSheetEditor}
          onClose={() => {
            setShowSplitSheetEditor(false);
            setSplitSheetEditorProjectId(null);
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0 }}>
            <SplitSheetEditor
              projectId={splitSheetEditorProjectId || undefined}
              initialContributors={
                selectedContractForDetails
                  ? [
                      {
                        name: selectedContractForDetails.clientName || 'Klient',
                        email: selectedContractForDetails.clientEmail || ', ',
                        role:'client' as any,
                        percentage: 0,
                        order_index: 0,
                        custom_fields: {},
                      },
                    ]
                  : undefined
              }
              onSave={(splitSheet) => {
                queryClient.invalidateQueries({ queryKey: ['split-sheets'] });
                queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
                setShowSplitSheetEditor(false);
                setSplitSheetEditorProjectId(null);
                showNotification('Split Sheet opprettet!', 'success');
                emitContractEvent('split-sheet:created', { splitSheetId: splitSheet.id, projectId: splitSheetEditorProjectId });
              }}
              onCancel={() => {
                setShowSplitSheetEditor(false);
                setSplitSheetEditorProjectId(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}




