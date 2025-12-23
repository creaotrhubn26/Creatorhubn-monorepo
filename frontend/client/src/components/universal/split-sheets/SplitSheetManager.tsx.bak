/**
 * Split Sheet Manager
 * Main component for managing split sheets for music producers
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../../utils/theming-helper';
import { useAuth } from '@/hooks/useAuth';
import { useUniversalDashboard } from '../UniversalDashboardContext';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Paper,
  Tabs,
  Tab,
  alpha,
  useTheme,
  TabPanel as MuiTabPanel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
  AccountBalance as SplitSheetIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Draft as DraftIcon,
  Archive as ArchiveIcon,
  LibraryMusic as MusicIcon
} from '@mui/icons-material';
import SplitSheetEditor from './SplitSheetEditor';
import SplitSheetViewer from './SplitSheetViewer';
import SplitSheetList from './SplitSheetList';
import SplitSheetRevenueTracker from './SplitSheetRevenueTracker';
import SplitSheetPaymentHistory from './SplitSheetPaymentHistory';
import SplitSheetTemplates from './SplitSheetTemplates';
import SplitSheetComments from './SplitSheetComments';
import SplitSheetAnalytics from './SplitSheetAnalytics';
import SplitSheetCollaborationProvider from './SplitSheetCollaborationProvider';
import SplitSheetBillingPanel from './SplitSheetBillingPanel';
import SplitSheetReports from './SplitSheetReports';
import ContractEditingInterface from '../../contracts/ContractEditingInterface';
import type { 
  SplitSheet, 
  SplitSheetStatus, 
  STATUS_DISPLAY_NAMES, 
  STATUS_COLORS 
} from './types';
import { STATUS_DISPLAY_NAMES as STATUS_NAMES, STATUS_COLORS as STATUS_COL } from './types';

interface SplitSheetManagerProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId?: string;
  projectId?: string;
  trackId?: string;
  onSplitSheetCreated?: (splitSheet: SplitSheet) => void;
}

export default function SplitSheetManager({
  profession = 'music_producer,',
  userId,
  projectId,
  trackId,
  onSplitSheetCreated
}: SplitSheetManagerProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const theming = useTheming(profession);
  const queryClient = useQueryClient();
  
  // Wire up profession-specific hooks for dynamic behavior
  const { professionConfigs: dashboardConfigs, isLoading: configsLoading } = useProfessionConfigs();
  const { 
    profession: userProfession, 
    adaptTabLabels, 
    hasFeature, 
    getProjectTypes,
    adaptDashboardTitle 
  } = useProfessionAdapter();
  const { 
    professionConfigs, 
    getUserProfessionColor, 
    getProfessionDisplayName,
    professionSupports,
    getProfessionCategory 
  } = useDynamicProfessions();
  
  // Get profession-specific styling
  const professionColor = getUserProfessionColor(profession);
  const professionDisplayName = getProfessionDisplayName(profession);
  const professionIcon = getProfessionIcon(profession);
  const professionCategory = getProfessionCategory(profession);
  
  // Get profession-specific labels
  const tabLabels = adaptTabLabels();
  
  // Check if split sheets feature is supported for this profession
  const splitSheetsSupported = professionSupports(profession, 'split_sheets,') || 
    profession === 'music_producer' || 
    profession === 'photographer' || 
    profession === 'videographer';
  
  // Get profession-specific terminology
  const getProfessionTerminology = () => {
    switch (profession) {
      case 'music_producer':
        return {
          itemName: 'låt',
          itemNamePlural: 'låter',
          projectLabel: 'musikkprosjekt',
          description: 'Administrer eierskapsfordeling og royalty-splitt for dine musikkprosjekter',
          emptyStateText: 'Opprett din første split sheet for å administrere rettigheter og royalties',
        };
      case 'photographer':
        return {
          itemName: 'prosjekt',
          itemNamePlural: 'prosjekter',
          projectLabel: 'fotoprosjekt',
          description: 'Administrer inntektsfordeling og samarbeidsavtaler for dine fotoprosjekter',
          emptyStateText: 'Opprett din første split sheet for å dele inntekter med samarbeidspartnere',
        };
      case 'videographer':
        return {
          itemName: 'produksjon',
          itemNamePlural: 'produksjoner',
          projectLabel: 'videoproduksjon',
          description: 'Administrer inntektsfordeling og samarbeidsavtaler for dine videoproduksjoner',
          emptyStateText: 'Opprett din første split sheet for å dele inntekter med crew og samarbeidspartnere',
        };
      default:
        return {
          itemName: 'prosjekt',
          itemNamePlural: 'prosjekter',
          projectLabel: 'prosjekt',
          description: 'Administrer inntektsfordeling og samarbeidsavtaler',
          emptyStateText: 'Opprett din første split sheet for å komme i gang',
        };
    }
  };
  
  const terminology = getProfessionTerminology();
  
  const [selectedSplitSheet, setSelectedSplitSheet] = useState<SplitSheet | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [statusFilter, setStatusFilter] = useState<SplitSheetStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'templates' | 'analytics' | 'billing' | 'reports'>('list');

  const effectiveUserId = userId || user?.id;
  
  // UniversalDashboard context for data synchronization
  const { dataFlow, communication } = useUniversalDashboard();

  // Fetch split sheets
  const { data: splitSheetsData, isLoading, error } = useQuery({
    queryKey: ['split-sheets', effectiveUserId, projectId, trackId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      if (trackId) params.append('track_id', trackId);
      
      const response = await apiRequest(`/api/split-sheets?${params.toString()}`);
      return response;
    },
    enabled: !!effectiveUserId
  });

  const splitSheets: SplitSheet[] = splitSheetsData?.data || [];

  // Filter and search split sheets
  const filteredSplitSheets = useMemo(() => {
    let filtered = splitSheets;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ss => ss.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ss => 
        ss.title.toLowerCase().includes(query) ||
        ss.description?.toLowerCase().includes(query) ||
        ss.contributors?.some(c => 
          c.name.toLowerCase().includes(query) || 
          c.email?.toLowerCase().includes(query)
        )
      );
    }

    return filtered;
  }, [splitSheets, statusFilter, searchQuery]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/split-sheets/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-sheets'] });
      setSelectedSplitSheet(null);
    }
  });

  const handleCreateNew = () => {
    setSelectedSplitSheet(null);
    setShowEditor(true);
  };

  const handleEdit = (splitSheet: SplitSheet) => {
    setSelectedSplitSheet(splitSheet);
    setShowEditor(true);
  };

  const handleView = (splitSheet: SplitSheet) => {
    setSelectedSplitSheet(splitSheet);
    setShowViewer(true);
  };

  const handleDelete = async (splitSheet: SplitSheet) => {
    if (window.confirm(`Er du sikker på at du vil slette "${splitSheet.title},"?`)) {
      if (splitSheet.id) {
        deleteMutation.mutate(splitSheet.id);
      }
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setSelectedSplitSheet(null);
  };

  const handleEditorSave = (splitSheet: SplitSheet) => {
    queryClient.invalidateQueries({ queryKey: ['split-sheets'] });
    
    // Sync to UniversalDashboard
    if (dataFlow) {
      dataFlow.syncData('universal-dashboard:split-sheets', {
        action: 'updated',
        splitSheet: splitSheet,
        timestamp: Date.now()
      });
    }
    
    setShowEditor(false);
    setSelectedSplitSheet(null);
    if (onSplitSheetCreated) {
      onSplitSheetCreated(splitSheet);
    }
  };

  const handleViewerClose = () => {
    setShowViewer(false);
    setSelectedSplitSheet(null);
  };

  // Statistics
  const stats = useMemo(() => {
    const total = splitSheets.length;
    const draft = splitSheets.filter(ss => ss.status === 'draft').length;
    const pending = splitSheets.filter(ss => ss.status === 'pending_signatures').length;
    const completed = splitSheets.filter(ss => ss.status === 'completed').length;
    
    return { total, draft, pending, completed };
  }, [splitSheets]);

  // Sync split sheet data to UniversalDashboard
  useEffect(() => {
    if (!dataFlow || !splitSheets) return;

    // Sync split sheet list
    dataFlow.syncData('universal-dashboard:split-sheets', {
      splitSheets: splitSheets,
      stats: stats,
      lastUpdated: Date.now()
    });

    // Sync selected split sheet if any
    if (selectedSplitSheet) {
      dataFlow.syncData('universal-dashboard:selectedSplitSheet', selectedSplitSheet);
    }
  }, [splitSheets, stats, selectedSplitSheet, dataFlow]);

  // Listen for data sync events from UniversalDashboard
  useEffect(() => {
    if (!communication) return;

    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'data:sync' && message.data?.dataKey === 'universal-dashboard:split-sheets') {
        // Refresh split sheets when synced from overview
        queryClient.invalidateQueries({ queryKey: ['split-sheets', effectiveUserId] });
      }
      if (message.type === 'data:sync' && message.data?.dataKey === 'universal-dashboard:selectedSplitSheet') {
        // Update selected split sheet
        if (message.data?.data) {
          setSelectedSplitSheet(message.data.data);
          setShowViewer(true);
        }
      }
      if (message.type === 'action:create-split-sheet') {
        // Create new split sheet from overview action
        handleCreateNew();
      }
      if (message.type === 'contract:created' && message.data) {
        console.log('🎵 Split Sheet Manager: Contract created event received, ', message.data);
        // Could refresh related contracts if viewing a split sheet with project_id
        if (selectedSplitSheet?.project_id) {
          queryClient.invalidateQueries({ queryKey: ['split-sheets', effectiveUserId] });
        }
      }
      if (message.type === 'quote:created' && message.data) {
        console.log('🎵 Split Sheet Manager: Quote created event received', message.data);
        // Could show notification
      }
      if (message.type === 'split-sheet:create-from-quote' && message.data) {
        console.log('🎵 Split Sheet Manager: Create split sheet from quote event received', message.data);
        // Open split sheet editor with quote data
        setSelectedSplitSheet(null);
        setShowEditor(true);
      }
      if (message.type === 'project:selected' && message.data) {
        console.log('🎵 Split Sheet Manager: Project selected event received', message.data);
        // Could filter split sheets by project
      }
    });

    return unsubscribe;
  }, [communication, queryClient, effectiveUserId, selectedSplitSheet]);

  // Register component with UniversalDashboard
  useEffect(() => {
    if (!communication) return;

    communication.registerComponent('split-sheet-manager', {
      componentId: 'split-sheet-manager',
      dataKey: 'split-sheets:data',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    return () => {
      communication.unregisterComponent('split-sheet-manager');
    };
  }, [communication]);

  // Check if split sheets are not supported for this profession
  if (!splitSheetsSupported) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionIcon}
            <span>Split Sheets er ikke tilgjengelig for {professionDisplayName.toLowerCase()}.</span>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header - Profession-specific styling */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 70, mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              color: professionColor,
              '& svg': { fontSize: 32 }
            }}>
              {professionIcon}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SplitSheetIcon sx={{ color: professionColor, fontSize: 28 }} />
              Split Sheets
            </Box>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {terminology.description}
          </Typography>
          <Chip 
            label={professionCategory} 
            size="small" 
            sx={{ 
              mt: 1, 
              bgcolor: alpha(professionColor, 0.1), 
              color: professionColor,
              fontWeight: 50
            }} 
          />
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
          sx={{
            bgcolor: professionColor, '&:hover': { bgcolor: alpha(professionColor, 0.85) }
          }}
        >
          Ny Split Sheet
        </Button>
      </Box>

      {/* Statistics Cards - with profession-themed accent */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderTop: `3px solid ${professionColor}` }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Totalt
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 70, color: professionColor }}>
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Utkast
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 70, color: STATUS_COL.draft }}>
                {stats.draft}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Venter på signaturer
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 70, color: STATUS_COL.pending_signatures }}>
                {stats.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Fullført
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 70, color: STATUS_COL.completed }}>
                {stats.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Søk split sheets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ flexGrow: 1 }}
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as SplitSheetStatus | 'all')}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="draft">Utkast</MenuItem>
              <MenuItem value="pending_signatures">Venter på signaturer</MenuItem>
              <MenuItem value="completed">Fullført</MenuItem>
              <MenuItem value="archived">Arkivert</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* View Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeView === 'list' ? 0 : activeView === 'templates' ? 1 : activeView === 'analytics' ? 2 : activeView === 'billing' ? 3 : 4} onChange={(_, v) => {
          if (v === 0) setActiveView('list');
          else if (v === 1) setActiveView('templates');
          else if (v === 2) setActiveView('analytics');
          else if (v === 3) setActiveView('billing');
          else setActiveView('reports');
        }}>
          <Tab label={`Split Sheets (${filteredSplitSheets.length})`} />
          <Tab label="Maler" />
          <Tab label="Analytics" />
          <Tab label="Fakturering" />
          <Tab label="Rapporter" />
        </Tabs>
      </Paper>

      {/* Templates View */}
      {activeView === 'templates' && (
        <SplitSheetTemplates
          profession={profession}
          onSelectTemplate={(template) => {
            // Create split sheet from template
            setSelectedSplitSheet({
              title: '',
              description: ', ',
              status: 'draft',
              contributors: template.contributors.map((c, index) => ({
                ...c,
                name: c.name || ', ',
                email: c.email || ', ',
                percentage: c.percentage,
                role: c.role,
                order_index: index
              }))
            } as SplitSheet);
            setShowEditor(true);
            setActiveView('list');
          }}
        />
      )}

      {/* Analytics View */}
      {activeView === 'analytics' && (
        <SplitSheetAnalytics userId={effectiveUserId || ', '} profession={profession} />
      )}

      {/* Billing View */}
      {activeView === 'billing' && (
        <SplitSheetBillingPanel userId={effectiveUserId || ', '} profession={profession} />
      )}

      {/* Reports View */}
      {activeView === 'reports' && (
        <SplitSheetReports userId={effectiveUserId || ', '} profession={profession} />
      )}

      {/* Split Sheets List */}
      {activeView === 'list' && isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">
          Feil ved lasting av split sheets. Prøv igjen.
        </Alert>
      ) : filteredSplitSheets.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ 
              color: alpha(professionColor, 0.5), 
              mb: 2, '& svg': { fontSize: 64 }
            }}>
              {professionIcon}
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Ingen split sheets funnet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchQuery || statusFilter !== 'all' 
                ? 'Prøv å justere søkekriteriene dine'
                : terminology.emptyStateText}
            </Typography>
            {!searchQuery && statusFilter === 'all' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateNew}
                sx={{ 
                  bgcolor: professionColor,
                  '&:hover': { bgcolor: alpha(professionColor, 0.85) }
                }}
              >
                Opprett Split Sheet
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <SplitSheetList
          splitSheets={filteredSplitSheets}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          profession={profession}
        />
      )}

      {/* Editor Dialog with Collaboration */}
      <Dialog
        open={showEditor}
        onClose={handleEditorClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle>
          {selectedSplitSheet ? 'Rediger Split Sheet' : 'Opprett Ny Split Sheet'}
        </DialogTitle>
        <DialogContent>
          {selectedSplitSheet?.id ? (
            <SplitSheetCollaborationProvider splitSheetId={selectedSplitSheet.id}>
              <SplitSheetEditor
                splitSheet={selectedSplitSheet}
                projectId={projectId}
                trackId={trackId}
                profession={profession}
                onSave={handleEditorSave}
                onCancel={handleEditorClose}
              />
            </SplitSheetCollaborationProvider>
          ) : (
            <SplitSheetEditor
              splitSheet={selectedSplitSheet}
              projectId={projectId}
              trackId={trackId}
              profession={profession}
              onSave={handleEditorSave}
              onCancel={handleEditorClose}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Viewer Dialog */}
      <Dialog
        open={showViewer}
        onClose={handleViewerClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedSplitSheet?.title || 'Split Sheet'}
        </DialogTitle>
        <DialogContent>
          {selectedSplitSheet && (
          <SplitSheetViewer
            splitSheet={selectedSplitSheet}
            onClose={handleViewerClose}
            profession={profession}
            onViewContract={(contract) => {
              // Emit event to open contract in contract hub
              if (communication) {
                communication.sendMessage({
                  from: 'split-sheet-manager',
                  to: 'contract-hub',
                  type: 'contract:view',
                  data: { contractId: contract.id },
                });
              }
            }}
            onCreateContract={() => {
              // Pre-populate contract from split sheet
              if (selectedSplitSheet) {
                const totalRevenue = selectedSplitSheet.contributors?.reduce(
                  (sum: number, c: any) => sum + (c.percentage || 0),
                  0
                ) || 0;
                const clientContributor = selectedSplitSheet.contributors?.find(
                  (c: any) => c.role === 'client' || c.role === 'artist');
                
                setContractEditorData({
                  clientName: clientContributor?.name || 'Klient',
                  clientEmail: clientContributor?.email || '',
                  projectDescription: selectedSplitSheet.title || selectedSplitSheet.description || ', ',
                  totalAmount: totalRevenue || selectedSplitSheet.total_revenue || 0,
                  status: 'draft',
                  projectId: selectedSplitSheet.project_id,
                });
                setShowContractEditor(true);
                setShowViewer(false);
                
                // Emit event
                if (communication) {
                  communication.sendMessage({
                    from: 'split-sheet-manager',
                    to: 'contract-hub',
                    type: 'contract:create-from-split-sheet',
                    data: {
                      splitSheetId: selectedSplitSheet.id,
                      projectId: selectedSplitSheet.project_id,
                    },
                  });
                }
              }
            }}
          />
          )}
        </DialogContent>
      </Dialog>

    </Box>
  );
}




