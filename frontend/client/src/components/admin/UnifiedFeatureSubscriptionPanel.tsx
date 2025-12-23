import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  Search,
  Save,
  Refresh,
  Settings,
  Lock,
  Star,
  Edit,
  Add,
  FilterList,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import {
  PROFESSION_FEATURE_MATRIX,
  type ProfessionFeatureConfig,
} from '@shared/profession-feature-matrix';
import { getAllProfessionTypes } from '@shared/profession-type-registry';
import { getPlanDisplayName, type PlanTier } from '@shared/subscription-plans';

interface FeatureWithMetadata extends ProfessionFeatureConfig {
  id: string;
  category?: string;
}

interface TrialConfig {
  featureId: string;
  availableInTrial: boolean;
  trialRestrictions?: {
    maxUsage?: number;
    features?: string[];
  };
}

type AvailabilityMode = 'included' | 'trial' | 'addon' | 'locked';

export default function UnifiedFeatureSubscriptionPanel() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProfession, setSelectedProfession] = useState<string>('videographer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('basic');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    featureId?: string;
    featureName?: string;
  }>({ open: false });
  const [hasChanges, setHasChanges] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, Partial<FeatureWithMetadata>>>(
    {},
  );

  const professions = getAllProfessionTypes();

  // Fetch feature configurations
  const { data: featureConfigs, isLoading } = useQuery({
    queryKey: ['/api/admin/feature-configs,', selectedProfession],
    queryFn: async () => {
      const matrix = PROFESSION_FEATURE_MATRIX[selectedProfession];
      if (!matrix) return [];

      return Object.entries(matrix.availableFeatures).map(([id, config]) => ({
        id,
        ...config,
        category: getCategoryFromFeatureId(id),
      });
    },
  });

  // Fetch trial configurations
  const { data: trialConfigs = [] } = useQuery<TrialConfig[]>({
    queryKey: ['/api/admin/trial-configs'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/trial-configs', { headers });
    },
  });

  // Fetch subscription plans with restricted features (commented out for future use)
  // const { data: subscriptionPlans = [] } = useQuery({
  //   queryKey: ['/api/admin/subscription-plans'],
  //   queryFn: () => apiRequest('/api/admin/subscription-plans'),
  // });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, Partial<FeatureWithMetadata>>) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/feature-configs/bulk-update', {
        method: 'POST',
        body: JSON.stringify({
          profession: selectedProfession,
          updates,
        }),
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-configs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/trial-configs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-plans'] });
      setHasChanges(false);
      setLocalChanges({});
    },
  });

  // Save trial restrictions mutation (commented out for future use)
  // const saveTrialRestrictions = useMutation({
  //   mutationFn: async (data: { plan: PlanTier; restrictedFeatures: string[] }) => {
  //     return apiRequest('/api/admin/trial-restrictions', {
  //       method: 'POST',
  //       body: JSON.stringify(data),
  //       headers: { , 'Content-Type': 'application/json' },
  //     });
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-plans'] });
  //     queryClient.invalidateQueries({ queryKey: ['/api/admin/trial-configs'] });
  //   },
  // });

  // Helper: Extract category from feature ID
  function getCategoryFromFeatureId(featureId: string): string {
    if (featureId.includes('chat') return 'Communication';
    if (featureId.includes('calendar') || featureId.includes('countdown') return 'Calendar';
    if (featureId.includes('analytics') || featureId.includes('dashboard') return 'Analytics';
    if (featureId.includes('contract') || featureId.includes('crm') return 'CRM';
    if (featureId.includes('wedding') return 'Wedding';
    if (featureId.includes('video') return 'Video';
    if (featureId.includes('lightroom') || featureId.includes('photo') return 'Photography';
    if (featureId.includes('email') return 'Marketing';
    if (featureId.includes('academy') || featureId.includes('learning') return 'Education';
    return 'Other';
  }

  // Helper: Get availability mode
  function getAvailabilityMode(feature: FeatureWithMetadata): AvailabilityMode {
    const trialConfig = trialConfigs.find((t) => t.featureId === feature.id);

    if (!feature.enabled && !feature.optional) return 'locked';
    if (trialConfig?.availableInTrial) return 'trial';
    if (feature.optional) return 'addon';
    return 'included';
  }

  // Handle local feature update
  const updateFeature = (featureId: string, updates: Partial<FeatureWithMetadata>) => {
    setLocalChanges((prev) => ({
      ...prev,
      [featureId]: {
        ...(prev[featureId] || {}),
        ...updates,
      },
    }));
    setHasChanges(true);
  };

  // Get merged feature (original + local changes)
  const getMergedFeature = (feature: FeatureWithMetadata): FeatureWithMetadata => {
    return {
      ...feature,
      ...(localChanges[feature.id] || {}),
    };
  };

  // Filter features
  const filteredFeatures = useMemo(() => {
    if (!featureConfigs) return [];

    return featureConfigs.filter((feature) => {
      const matchesSearch =
        feature.id.toLowerCase().includes(searchQuery.toLowerCase() ||
        feature.description?.toLowerCase().includes(searchQuery.toLowerCase();
      const matchesCategory = filterCategory === 'all' || feature.category === filterCategory;
      const matchesPlan = getMergedFeature(feature).plan === selectedPlan;

      return matchesSearch && matchesCategory && (activeTab === 0 || matchesPlan);
    });
  }, [featureConfigs, searchQuery, filterCategory, selectedPlan, activeTab, localChanges]);

  // Get unique categories
  const categories = useMemo(() => {
    if (!featureConfigs) return [];
    return ['all', ...new Set(featureConfigs.map((f) => f.category).filter(Boolean)];
  }, [featureConfigs]);

  // Statistics
  const stats = useMemo(() => {
    if (!featureConfigs) return { total: 0, enabled: 0, trial: 0, addon: 0, locked: 0 };

    return featureConfigs.reduce(
      (acc, feature) => {
        const merged = getMergedFeature(feature);
        const mode = getAvailabilityMode(merged);

        return {
          total: acc.total + 1,
          enabled: acc.enabled + (merged.enabled ? 1 : 0),
          trial: acc.trial + (mode === 'trial' ? 1 : 0),
          addon: acc.addon + (mode === 'addon' ? 1 : 0),
          locked: acc.locked + (mode === 'locked' ? 1 : 0),
        };
      },
      { total: 0, enabled: 0, trial: 0, addon: 0, locked: 0 },
    );
  }, [featureConfigs, localChanges]);

  const handleSave = () => {
    saveMutation.mutate(localChanges);
  };

  const handleReset = () => {
    setLocalChanges({});
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading feature configurations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Feature & Subscription Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Unified panel for managing features, trials, plans, and add-ons
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-configs'] })
            }
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={handleReset}
            disabled={!hasChanges}
          >
            Reset Changes
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            color="primary"
          >
            Save All Changes
          </Button>
        </Stack>
      </Box>

      {/* Change indicator */}
      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved changes ({Object.keys(localChanges).length} features modified)
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={2}, sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Features
              </Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Enabled
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.enabled}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Trial Available
              </Typography>
              <Typography variant="h4" color="info.main">
                {stats.trial}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Add-ons
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.addon}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Locked
              </Typography>
              <Typography variant="h4" color="error.main">
                {stats.locked}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="All Features" icon={<Settings />} iconPosition="start" />
          <Tab label="Plan Configuration" icon={<Star />} iconPosition="start" />
          <Tab label="Trial Settings" icon={<Lock />} iconPosition="start" />
          <Tab label="Add-on Management" icon={<Add />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Profession</InputLabel>
              <Select
                value={selectedProfession}
                onChange={(e) => setSelectedProfession(e.target.value)}
                label="Profession"
              >
                {professions.map((prof) => (
                  <MenuItem key={prof.id} value={prof.id}>
                    {prof.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                label="Category"
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {activeTab === 1 && (
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Plan Tier</InputLabel>
                <Select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value as PlanTier)}
                  label="Plan Tier"
                >
                  <MenuItem value="basic">{getPlanDisplayName('basic')}</MenuItem>
                  <MenuItem value="pro">{getPlanDisplayName('pro')}</MenuItem>
                  <MenuItem value="enterprise">{getPlanDisplayName('enterprise')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} sm={activeTab === 1 ? 12 : 4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )}} />
          </Grid>
        </Grid>
      </Paper>

      {/* Feature List */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Feature</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="center">Plan</TableCell>
              <TableCell align="center">Availability</TableCell>
              <TableCell align="center">Enabled</TableCell>
              <TableCell align="center">Optional</TableCell>
              <TableCell align="center">Impact</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFeatures.map((feature) => {
              const merged = getMergedFeature(feature);
              const mode = getAvailabilityMode(merged);
              const isChanged = localChanges[feature.id] !== undefined;

              return (
                <TableRow
                  key={feature.id}
                  sx={{
                    bgcolor: isChanged ? 'action.hover' : 'inherit', '&:hover': { bgcolor: 'action.selected' }}}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {feature.id.replace(/-/g, ', ').replace(/\b\w/g, (l) => l.toUpperCase()}
                        {isChanged && (
                          <Chip label="Modified" size="small" color="warning" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {merged.description}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip label={feature.category} size="small" />
                  </TableCell>

                  <TableCell align="center">
                    <Select
                      size="small"
                      value={merged.plan || 'basic'}
                      onChange={(e) =>
                        updateFeature(feature.id, { plan: e.target.value as PlanTier })
                      }
                      sx={{ minWidth: 100 }}>
                      <MenuItem value="basic">{getPlanDisplayName('basic')}</MenuItem>
                      <MenuItem value="pro">{getPlanDisplayName('pro')}</MenuItem>
                      <MenuItem value="enterprise">{getPlanDisplayName('enterprise')}</MenuItem>
                    </Select>
                  </TableCell>

                  <TableCell align="center">
                    <Select
                      size="small"
                      value={mode}
                      onChange={(e) => {
                        const newMode = e.target.value as AvailabilityMode;
                        updateFeature(feature.id, {
                          enabled: newMode === 'included' || newMode === 'trial',
                          optional: newMode === 'addon' || newMode === 'trial',
                        });
                      }}
                      sx={{ minWidth: 100 }}>
                      <MenuItem value="included">Included</MenuItem>
                      <MenuItem value="trial">Trial</MenuItem>
                      <MenuItem value="addon">Add-on</MenuItem>
                      <MenuItem value="locked">Locked</MenuItem>
                    </Select>
                  </TableCell>

                  <TableCell align="center">
                    <Switch
                      checked={merged.enabled}
                      onChange={(e) => updateFeature(feature.id, { enabled: e.target.checked })}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Switch
                      checked={merged.optional}
                      onChange={(e) => updateFeature(feature.id, { optional: e.target.checked })}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={merged.impact}
                      size="small"
                      color={
                        merged.impact === 'critical'
                          ? 'error'
                          : merged.impact === 'high'
                            ? 'warning'
                            : merged.impact === 'medium'
                              ? 'info'
                              : 'success'
                      }
                    />
                  </TableCell>

                  <TableCell align="center">
                    {merged.developmentStatus && (
                      <Chip
                        label={`${merged.completionPercentage || 0}%`}
                        size="small"
                        color={
                          (merged.completionPercentage || 0) === 100
                            ? 'success'
                            : (merged.completionPercentage || 0) >= 80
                              ? 'info'
                              : (merged.completionPercentage || 0) >= 60
                                ? 'warning': 'default'
                        }
                      />
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() =>
                        setEditDialog({
                          open: true,
                          featureId: feature.id,
                          featureName: feature.id,
                        })
                      }
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredFeatures.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">No features found matching your criteria</Typography>
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Feature: {editDialog.featureName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure advanced settings for this feature
          </Typography>
          {/* Add more detailed configuration options here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false })}>Cancel</Button>
          <Button variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}}
