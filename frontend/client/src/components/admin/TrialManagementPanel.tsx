// client/src/components/admin/TrialManagementPanel.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
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
  Switch,
  FormControlLabel,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Edit,
  Delete,
  Add,
  Refresh,
  TrendingUp,
  People,
  Timer,
  CheckCircle,
  Cancel,
  Visibility,
  Settings,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface TrialFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  trialDuration: number;
  upgradeRequired: boolean;
  icon: string;
  color: string;
  targetComponents: string[];
}

interface TrialStatus {
  id: string;
  featureId: string;
  userId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageCount: number;
  lastUsed: string;
  endedReason?: string;
  featureName?: string;
  featureCategory?: string;
}

interface TrialAnalytics {
  featureId: string;
  featureName: string;
  totalTrials: number;
  activeTrials: number;
  convertedTrials: number;
  avgUsage: number;
  lastTrial: string;
}

// Integration props for unified workflow connectivity
interface TrialManagementPanelProps {
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

export default function TrialManagementPanel({
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
}: TrialManagementPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<TrialFeature | null>(null);
  const [showFeatureDialog, setShowFeatureDialog] = useState(false);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [endTrialConfirmId, setEndTrialConfirmId] = useState<string | null>(null);
  
  // Feature form state
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureCategory, setFeatureCategory] = useState('showcase');
  const [trialDuration, setTrialDuration] = useState(14);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  
  // Filtering state
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  // Theming system
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();

  // Fetch trial features
  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ['/api/admin/trial-features', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/trial-features', { headers });
    },
    select: (d) => (Array.isArray(d) ? d : []),
});

  // Fetch trial statuses
  const { data: trialStatuses = [], isLoading: statusesLoading } = useQuery({
    queryKey: ['/api/admin/trial-statuses', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/trial-statuses', { headers });
    },
    select: (d) => (Array.isArray(d) ? d : []),
});

  // Fetch trial analytics
  const { data: analytics = [], isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/trials/analytics/overview', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/trials/analytics/overview', { headers });
    },
    select: (d) => (Array.isArray(d) ? d : []),
});

  // Toggle feature mutation
  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ featureId, enabled }: { featureId: string; enabled: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/trial-features/${featureId}/toggle`, {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    });
  },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/trial-features', ],});
      
      // Integration: Update settings when feature is toggled
      if (onSettingsUpdate) {
        onSettingsUpdate({
          featureId: variables.featureId,
          enabled: variables.enabled,
          timestamp: new Date().toISOString()
        });
      }
      
      // Integration: Create notification about feature change
      if (onNotificationCreate) {
        const feature = features.find((f: TrialFeature) => f.id === variables.featureId);
        onNotificationCreate({
          message: `Trial feature "${feature?.name || variables.featureId}" ${variables.enabled ? 'enabled' : 'disabled'}`,
          type: 'info',
          timestamp: new Date().toISOString()
        });
      }
  },
});

  // End trial mutation
  const endTrialMutation = useMutation({
    mutationFn: async (trialId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/trials/${trialId}/end`, {
        headers: {
          ...headers, "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({ reason: 'admin_ended',}),
    });
  },
    onSuccess: (data, trialId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/trial-statuses', ],});
      
      // Integration: Update project if trial belongs to selected project
      if (onProjectUpdate && selectedProject) {
        const trial = trialStatuses.find((t: TrialStatus) => t.id === trialId);
        if (trial) {
          onProjectUpdate({
            ...selectedProject,
            trialEnded: {
              featureId: trial.featureId,
              userId: trial.userId,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
      
      // Integration: Create notification about trial ending
      if (onNotificationCreate) {
        const trial = trialStatuses.find((t: TrialStatus) => t.id === trialId);
        onNotificationCreate({
          message: `Trial for "${trial?.featureName || 'feature'}" has been ended`,
          type: 'warning',
          userId: trial?.userId,
          timestamp: new Date().toISOString()
        });
      }
  },
});

  const handleToggleFeature = (featureId: string, enabled: boolean) => {
    toggleFeatureMutation.mutate({ featureId, enabled });
};

  const handleEndTrial = (trialId: string) => {
    setEndTrialConfirmId(trialId);
  };

  const executeEndTrial = () => {
    if (endTrialConfirmId) {
      endTrialMutation.mutate(endTrialConfirmId);
      setEndTrialConfirmId(null);
    }
  };

  const getStatusColor = (status: TrialStatus) => {
    if (status.isActive) return 'success';
    if (status.endedReason === 'upgraded') return 'primary';
    if (status.endedReason === 'expired') return 'warning';
    return 'default';
};

  const getStatusLabel = (status: TrialStatus) => {
    if (status.isActive) return 'Aktiv';
    if (status.endedReason === 'upgraded') return 'Oppgradert';
    if (status.endedReason === 'expired') return 'Utløpt';
    return 'Avsluttet';
};

  const renderFeaturesTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Trial-funksjoner</Typography>
        {selectedProject && (
          <Chip 
            label={`Prosjekt: ${selectedProject.title || selectedProject.name}`} 
            color="primary" 
            variant="outlined"
            sx={{ mr: 2 }}
          />
        )}
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => {
            setShowFeatureDialog(true);
            // Integration: Notify when creating new feature dialog
            if (onNotificationCreate) {
              onNotificationCreate({
                message: 'Opening feature creation dialog',
                type: 'info',
                timestamp: new Date().toISOString()
              });
            }
          }}
        >
          Legg til funksjon
        </Button>
      </Box>

      <Grid container spacing={3}>
        {features.map((feature: TrialFeature) => (
          <Grid item xs={12} key={feature.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                  <Box
                    sx={{
                      width:  40,
                      height:  40,
                      borderRadius:  1,
                      bgcolor: feature.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      mr:  2}}
                  >
                    {feature.icon}
                  </Box>
                  <Box sx={{ flex:  1 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{feature.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.category}
                    </Typography>
                  </Box>
                  <Switch
                    checked={true} // This should come from the feature data
                    onChange={(e) => handleToggleFeature(feature.id, e.target.checked)}
                  />
                </Box>

                <Typography variant="body2" sx={{ mb:  2 }}>
                  {feature.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  2 }}>
                  <Chip label={`${feature.trialDuration} dager`} size="small" />
                  <Chip label={feature.category} size="small" color="primary" variant="outlined" />
                  {feature.upgradeRequired && (
                    <Chip label="Oppgradering påkrevd" size="small" color="warning" variant="outlined" />
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap:  1 }}>
                  <Button
                    size="small"
                    startIcon={theming.getThemedIcon('edit')}
                    onClick={() => {
                      setSelectedFeature(feature);
                      setShowFeatureDialog(true);
                  }}
                  >
                    Rediger
                  </Button>
                  <Button
                    size="small"
                    startIcon={theming.getThemedIcon('visibility')}
                    onClick={() => setShowAnalyticsDialog(true)}
                  >
                    Analytics
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderTrialsTab = () => {
    // Filter trials based on filters
    const filteredTrials = trialStatuses.filter((trial: TrialStatus) => {
      if (statusFilter !== 'all' && statusFilter !== (trial.isActive ? 'active' : 'inactive')) {
        return false;
      }
      if (clientFilter && !trial.userId.toLowerCase().includes(clientFilter.toLowerCase())) {
        return false;
      }
      if (selectedClient && trial.userId !== selectedClient.id) {
        return false;
      }
      return true;
    });
    
    return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Aktive Prøveperioder</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Client Filter */}
          <TextField
            size="small"
            placeholder="Søk bruker..."
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              // Integration: When filtering by client, trigger client select
              if (onClientSelect && e.target.value) {
                const matchedTrial = trialStatuses.find((t: TrialStatus) => 
                  t.userId.toLowerCase().includes(e.target.value.toLowerCase())
                );
                if (matchedTrial) {
                  onClientSelect({ id: matchedTrial.userId });
                }
              }
            }}
            InputProps={{
              startAdornment: <People sx={{ mr: 1, color: 'action.active' }} />
            }}
          />
          
          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="active"><CheckCircle sx={{ mr: 1, fontSize: 16 }} />Aktive</MenuItem>
              <MenuItem value="inactive"><Cancel sx={{ mr: 1, fontSize: 16 }} />Inaktive</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/admin/trial-statuses', ],});
              if (onNotificationCreate) {
                onNotificationCreate({
                  message: 'Trial data refreshed',
                  type: 'info',
                  timestamp: new Date().toISOString()
                });
              }
            }}
          >
            Oppdater
          </Button>
        </Box>
      </Box>

      {/* Display active filters */}
      {(clientFilter || statusFilter !== 'all' || selectedClient) && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">Aktive filtre:</Typography>
          {clientFilter && (
            <Chip 
              label={`Bruker: ${clientFilter}`} 
              size="small" 
              onDelete={() => setClientFilter('')}
            />
          )}
          {statusFilter !== 'all' && (
            <Chip 
              label={`Status: ${statusFilter === 'active' ? 'Aktive' : 'Inaktive'}`} 
              size="small" 
              onDelete={() => setStatusFilter('all')}
            />
          )}
          {selectedClient && (
            <Chip 
              label={`Klient: ${selectedClient.name || selectedClient.id}`} 
              size="small" 
              color="primary"
              onDelete={() => onClientSelect && onClientSelect(null)}
            />
          )}
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bruker</TableCell>
              <TableCell>Funksjon</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>Slutt</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Bruk</TableCell>
              <TableCell>Sist brukt</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTrials.map((trial: TrialStatus) => (
              <TableRow key={trial.id}>
                <TableCell>{trial.userId}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    <Typography variant="body2">{trial.featureName}</Typography>
                    <Chip label={trial.featureCategory} size="small" variant="outlined" />
                  </Box>
                </TableCell>
                <TableCell>{new Date(trial.startDate).toLocaleDateString('no')}</TableCell>
                <TableCell>{new Date(trial.endDate).toLocaleDateString('no')}</TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(trial)}
                    color={getStatusColor(trial)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{trial.usageCount}</TableCell>
                <TableCell>
                  {trial.lastUsed ? new Date(trial.lastUsed).toLocaleDateString('no') : '-'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {trial.isActive && (
                      <>
                        <Tooltip title="Avslutt prøveperiode">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleEndTrial(trial.id)}
                          >
                            <Stop />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Vis detaljer">
                          <IconButton
                            size="small"
                            onClick={() => {
                              // Integration: Create worklog when viewing trial details
                              if (onWorklogCreate) {
                                onWorklogCreate({
                                  action: 'viewed_trial_details',
                                  trialId: trial.id,
                                  userId: trial.userId,
                                  timestamp: new Date().toISOString()
                                });
                              }
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Innstillinger">
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (onSettingsUpdate) {
                                onSettingsUpdate({
                                  trialId: trial.id,
                                  action: 'modify_trial_settings',
                                  timestamp: new Date().toISOString()
                                });
                              }
                            }}
                          >
                            <Settings />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    
                    {!trial.isActive && (
                      <Tooltip title="Slett trial">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            // Integration: File upload for trial archive
                            if (onFileUpload) {
                              onFileUpload({
                                type: 'trial_archive',
                                trialId: trial.id,
                                timestamp: new Date().toISOString()
                              });
                            }
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
    );
  };

  const renderAnalyticsTab = () => (
    <Box>
      <Typography variant="h5" sx={{  mb:  3  }}>
        Trial Analytics
      </Typography>

      <Grid container spacing={3}>
        {analytics.map((stat: TrialAnalytics) => (
          <Grid item xs={12} key={stat.featureId}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  {stat.featureName}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                  <Typography variant="body2">Totale prøveperioder: </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stat.totalTrials}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                  <Typography variant="body2">Aktive prøveperioder: </Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {stat.activeTrials}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                  <Typography variant="body2">Oppgraderinger: </Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary.main">
                    {stat.convertedTrials}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  2 }}>
                  <Typography variant="body2">Gjennomsnittlig bruk: </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {Math.round(stat.avgUsage)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                  <Typography variant="body2">Konverteringsrate: </Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary.main">
                    {stat.totalTrials > 0 
                      ? `${Math.round((stat.convertedTrials / stat.totalTrials) * 10)}%`
                      : '0%'
                  }
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  if (featuresLoading || statusesLoading || analyticsLoading) {
    return <LinearProgress />;
}

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Trial Management</Typography>
        
        {/* Integration Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedProject && (
            <>
              <Tooltip title="Download trial report">
                <IconButton
                  size="small"
                  onClick={() => {
                    if (onFileDownload) {
                      onFileDownload({
                        type: 'trial_report',
                        projectId: selectedProject.id,
                        timestamp: new Date().toISOString()
                      });
                    }
                  }}
                >
                  <Visibility />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Schedule trial review meeting">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => {
                    if (onMeetingCreate) {
                      onMeetingCreate({
                        title: `Trial Review - ${selectedProject.title || selectedProject.name}`,
                        type: 'trial_review',
                        projectId: selectedProject.id,
                        timestamp: new Date().toISOString()
                      });
                    }
                  }}
                >
                  <Timer />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Update project with trial data">
                <IconButton
                  size="small"
                  onClick={() => {
                    if (onProjectUpdate && onProjectSelect) {
                      const projectTrials = trialStatuses.filter((t: TrialStatus) => 
                        selectedProject && t.userId === selectedProject.userId
                      );
                      onProjectUpdate({
                        ...selectedProject,
                        trials: projectTrials,
                        lastUpdated: new Date().toISOString()
                      });
                    }
                  }}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
            </>
          )}
          
          {selectedClient && (
            <Tooltip title="Update client trial status">
              <IconButton
                size="small"
                color="secondary"
                onClick={() => {
                  if (onClientUpdate) {
                    const clientTrials = trialStatuses.filter((t: TrialStatus) => 
                      t.userId === selectedClient.id
                    );
                    onClientUpdate({
                      ...selectedClient,
                      activeTrials: clientTrials.filter((t: TrialStatus) => t.isActive).length,
                      totalTrials: clientTrials.length,
                      lastUpdated: new Date().toISOString()
                    });
                  }
                }}
              >
                <People />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Funksjoner" />
          <Tab 
            label={
              <Badge badgeContent={trialStatuses.filter((t: TrialStatus) => t.isActive).length} color="primary">
                Prøveperioder
              </Badge>
          }
          />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {activeTab === 0 && renderFeaturesTab()}
      {activeTab === 1 && renderTrialsTab()}
      {activeTab === 2 && renderAnalyticsTab()}

      {/* Feature Dialog */}
      <Dialog open={showFeatureDialog} onClose={() => setShowFeatureDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Add />
            {selectedFeature ? 'Rediger funksjon' : 'Legg til funksjon'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Funksjonsnavn"
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              fullWidth
              required
              placeholder="f.eks. Advanced Showcase"
            />
            
            <TextField
              label="Beskrivelse"
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Detaljert beskrivelse av funksjonen..."
            />
            
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={featureCategory}
                label="Kategori"
                onChange={(e) => setFeatureCategory(e.target.value)}
              >
                <MenuItem value="showcase">Showcase</MenuItem>
                <MenuItem value="collaboration">Collaboration</MenuItem>
                <MenuItem value="analytics">Analytics</MenuItem>
                <MenuItem value="integration">Integration</MenuItem>
                <MenuItem value="ai">AI Features</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Prøveperiode (dager)"
              type="number"
              value={trialDuration}
              onChange={(e) => setTrialDuration(parseInt(e.target.value))}
              fullWidth
              InputProps={{ inputProps: { min: 1, max: 90 } }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={upgradeRequired}
                  onChange={(e) => setUpgradeRequired(e.target.checked)}
                />
              }
              label="Oppgradering påkrevd etter prøveperiode"
            />
            
            <Alert severity="info">
              Denne funksjonen vil være tilgjengelig i {trialDuration} dager for brukere som starter prøveperioden.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowFeatureDialog(false);
            setFeatureName('');
            setFeatureDescription('');
            setFeatureCategory('showcase');
            setTrialDuration(14);
            setUpgradeRequired(false);
          }}>
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            sx={theming.getThemedButtonSx()}
            onClick={() => {
              // Integration: Create showcase when feature is created
              if (onShowcaseCreate && featureCategory === 'showcase') {
                onShowcaseCreate({
                  name: featureName,
                  description: featureDescription,
                  trialDuration,
                  timestamp: new Date().toISOString()
                });
              }
              
              // Integration: Create notification
              if (onNotificationCreate) {
                onNotificationCreate({
                  message: `New trial feature "${featureName}" created`,
                  type: 'success',
                  timestamp: new Date().toISOString()
                });
              }
              
              setShowFeatureDialog(false);
            }}
          >
            <Add sx={{ mr: 1 }} />
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={showAnalyticsDialog} onClose={() => setShowAnalyticsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp />
            Detaljert Analytics
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Quick Stats */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Trials</Typography>
                      <Typography variant="h4">{trialStatuses.length}</Typography>
                    </Box>
                    <PlayArrow color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Active Now</Typography>
                      <Typography variant="h4" color="success.main">
                        {trialStatuses.filter((t: TrialStatus) => t.isActive).length}
                      </Typography>
                    </Box>
                    <Timer color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Converted</Typography>
                      <Typography variant="h4" color="primary.main">
                        {trialStatuses.filter((t: TrialStatus) => t.endedReason === 'upgraded').length}
                      </Typography>
                    </Box>
                    <CheckCircle color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Users</Typography>
                      <Typography variant="h4">
                        {new Set(trialStatuses.map((t: TrialStatus) => t.userId)).size}
                      </Typography>
                    </Box>
                    <People color="action" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Detailed Stats */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Feature Performance</Typography>
                  {analytics.map((stat: TrialAnalytics) => (
                    <Box key={stat.featureId} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1">{stat.featureName}</Typography>
                        <Chip 
                          label={`${stat.totalTrials > 0 ? Math.round((stat.convertedTrials / stat.totalTrials) * 100) : 0}%`}
                          color="primary"
                          size="small"
                        />
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={stat.totalTrials > 0 ? (stat.convertedTrials / stat.totalTrials) * 100 : 0}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            startIcon={<Refresh />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/trials/analytics/overview'] });
              if (onNotificationCreate) {
                onNotificationCreate({
                  message: 'Analytics data refreshed',
                  type: 'info',
                  timestamp: new Date().toISOString()
                });
              }
            }}
          >
            Refresh
          </Button>
          <Button onClick={() => setShowAnalyticsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* End Trial Confirmation Dialog */}
      <Dialog open={!!endTrialConfirmId} onClose={() => setEndTrialConfirmId(null)}>
        <DialogTitle>Avslutt prøveperiode</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil avslutte denne prøveperioden?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndTrialConfirmId(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={executeEndTrial}>Avslutt</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
