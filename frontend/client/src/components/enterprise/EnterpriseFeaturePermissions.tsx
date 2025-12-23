/**
 * Enterprise Feature Permissions
 * Allows enterprise admins to configure which features team members can access
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Alert,
  Grid,
  Divider,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  alpha,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Security,
  ExpandMore,
  CheckCircle,
  Cancel,
  AdminPanelSettings,
  People,
  Visibility,
  Lock,
  LockOpen,
  Settings,
  Info,
  Save,
  Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getAllProfessionFeatures } from '@shared/profession-feature-matrix';

interface FeaturePermission {
  featureId: string;
  permissionLevel: 'all' | 'admin_only' | 'admin_member' | 'disabled';
  allowedRoles: string[];
}

interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions_config: any;
  is_default: boolean;
  is_system: boolean;
}

interface EnterpriseFeaturePermissionsProps {
  organizationId: string;
  profession: string;
  onSave?: () => void;
}

const ROLE_LABELS = {
  admin: { label: 'Admin', color: '#9c27b0', icon: <AdminPanelSettings fontSize="small" /> },
  member: { label: 'Medlem', color: '#2196f3', icon: <People fontSize="small" /> },
  viewer: { label: 'Leser', color: '#4caf50', icon: <Visibility fontSize="small" /> },
};

const PERMISSION_LEVELS = {
  all: { label: 'Alle', description: 'Alle teammedlemmer har tilgang', color: '#4caf50' },
  admin_member: { label: 'Admin + Medlem', description: 'Admin og medlemmer har tilgang', color: '#2196f3' },
  admin_only: { label: 'Kun Admin', description: 'Kun administratorer har tilgang', color: '#ff9800' },
  disabled: { label: 'Deaktivert', description: 'Ingen har tilgang til denne funksjonen', color: '#f44336' },
};

export default function EnterpriseFeaturePermissions({
  organizationId,
  profession,
  onSave,
}: EnterpriseFeaturePermissionsProps) {
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [adminOnlyFeatures, setAdminOnlyFeatures] = useState<string[]>([]);
  const [disabledFeatures, setDisabledFeatures] = useState<string[]>([]);
  const [customPermissions, setCustomPermissions] = useState<Record<string, FeaturePermission>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | false>('core');

  // Fetch presets
  const { data: presetsData, isLoading: presetsLoading } = useQuery({
    queryKey: ['/api/enterprise/feature-permissions/presets,'],
    queryFn: () => apiRequest('/api/enterprise/feature-permissions/presets'),
  });

  // Fetch current permissions
  const { data: permissionsData, isLoading: permissionsLoading, refetch } = useQuery({
    queryKey: ['/api/enterprise/feature-permissions', organizationId],
    queryFn: () => apiRequest(`/api/enterprise/feature-permissions/${organizationId}`),
    enabled: !!organizationId,
  });

  // Get all features for the profession
  const allFeatures = useMemo(() => {
    const features = getAllProfessionFeatures(profession);
    if (!features || !Array.isArray(features)) return [];
    return features.filter((f: any) => f.enabled !== false);
  }, [profession]);

  // Group features by category
  const featuresByCategory = useMemo(() => {
    const categories: Record<string, any[]> = {
      core: [],
      billing: [],
      clients: [],
      projects: [],
      content: [],
      integrations: [],
      ai: [],
      other: [],
    };

    allFeatures.forEach((feature: any) => {
      const id = feature.featureId || feature.id || ', ';
      if (id.includes('billing') || id.includes('invoice') || id.includes('payment')) {
        categories.billing.push(feature);
      } else if (id.includes('client') || id.includes('customer') || id.includes('crm')) {
        categories.clients.push(feature);
      } else if (id.includes('project') || id.includes('task') || id.includes('workflow')) {
        categories.projects.push(feature);
      } else if (id.includes('content') || id.includes('media') || id.includes('gallery')) {
        categories.content.push(feature);
      } else if (id.includes('integration') || id.includes('google') || id.includes('sync')) {
        categories.integrations.push(feature);
      } else if (id.includes('ai') || id.includes('smart') || id.includes('auto')) {
        categories.ai.push(feature);
      } else if (feature.plan === 'basic' || feature.required) {
        categories.core.push(feature);
      } else {
        categories.other.push(feature);
      }
    });

    return categories;
  }, [allFeatures]);

  // Category labels
  const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    core: { label: 'Kjernefunksjoner', icon: <Settings /> },
    billing: { label: 'Fakturering & Økonomi', icon: <Security /> },
    clients: { label: 'Kunder & CRM', icon: <People /> },
    projects: { label: 'Prosjekter & Oppgaver', icon: <CheckCircle /> },
    content: { label: 'Innhold & Media', icon: <Visibility /> },
    integrations: { label: 'Integrasjoner', icon: <Lock /> },
    ai: { label: 'AI & Automatisering', icon: <Settings /> },
    other: { label: 'Andre funksjoner', icon: <Settings /> },
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/enterprise/feature-permissions/${organizationId}`, {
        method: 'POST',
        body: JSON.stringify({
          presetId: selectedPreset,
          adminOnlyFeatures,
          disabledFeatures,
          customPermissions,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/feature-permissions', organizationId] });
      setHasChanges(false);
      onSave?.();
    },
  });

  // Initialize from saved settings
  React.useEffect(() => {
    if (permissionsData?.settings) {
      const settings = permissionsData.settings;
      setSelectedPreset(settings.default_permission_preset_id);
      setAdminOnlyFeatures(settings.admin_only_features || []);
      setDisabledFeatures(settings.disabled_features || []);
      setCustomPermissions(settings.custom_permissions || {});
    }
  }, [permissionsData]);

  const getFeaturePermissionLevel = (featureId: string): 'all' | 'admin_only' | 'admin_member' | 'disabled' => {
    if (disabledFeatures.includes(featureId)) return 'disabled';
    if (adminOnlyFeatures.includes(featureId)) return 'admin_only';
    if (customPermissions[featureId]?.permissionLevel) return customPermissions[featureId].permissionLevel;
    return 'all';
  };

  const setFeaturePermission = (featureId: string, level: 'all' | 'admin_only' | 'admin_member' | 'disabled') => {
    setHasChanges(true);

    // Remove from all lists first
    setAdminOnlyFeatures(prev => prev.filter(f => f !== featureId));
    setDisabledFeatures(prev => prev.filter(f => f !== featureId));

    if (level === 'admin_only') {
      setAdminOnlyFeatures(prev => [...prev, featureId]);
    } else if (level === 'disabled') {
      setDisabledFeatures(prev => [...prev, featureId]);
    } else if (level === 'admin_member') {
      setCustomPermissions(prev => ({
        ...prev,
        [featureId]: { featureId, permissionLevel: 'admin_member', allowedRoles: ['admin', 'member'] },
      }));
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = presetsData?.presets?.find((p: PermissionPreset) => p.id === presetId);
    if (!preset) return;

    setSelectedPreset(presetId);
    setHasChanges(true);

    // Reset to defaults based on preset
    const config = preset.permissions_config;
    const newAdminOnly: string[] = [];
    const newDisabled: string[] = [];

    Object.entries(config).forEach(([key, value]: [string, any]) => {
      if (key === 'default') return;
      if (value.permission_level === 'admin_only') {
        newAdminOnly.push(key);
      } else if (value.permission_level === 'disabled') {
        newDisabled.push(key);
      }
    });

    setAdminOnlyFeatures(newAdminOnly);
    setDisabledFeatures(newDisabled);
  };

  if (presetsLoading || permissionsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const presets: PermissionPreset[] = presetsData?.presets || [];

  return (
    <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security color="primary" />
            Funksjonstilganger for teamet
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton size="small" onClick={() => refetch()}>
              <Refresh />
            </IconButton>
            <Button
              variant="contained"
              size="small"
              startIcon={<Save />}
              disabled={!hasChanges || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Lagrer...' : 'Lagre endringer'}
            </Button>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Konfigurer hvilke funksjoner teammedlemmene dine har tilgang til.
            Som administrator har du alltid full tilgang.
          </Typography>
        </Alert>

        {/* Preset selector */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Velg forhåndskonfigurering:</Typography>
          <Grid container spacing={1}>
            {presets.map((preset) => (
              <Grid item key={preset.id}>
                <Chip
                  label={preset.name}
                  onClick={() => applyPreset(preset.id)}
                  color={selectedPreset === preset.id ? 'primary' : 'default'}
                  variant={selectedPreset === preset.id ? 'filled' : 'outlined'}
                  icon={preset.is_default ? <CheckCircle /> : undefined}
                />
              </Grid>
            ))}
          </Grid>
          {selectedPreset && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {presets.find(p => p.id === selectedPreset)?.description}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Feature categories */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Tilpass tilganger per funksjon:</Typography>

        {Object.entries(featuresByCategory).map(([category, features]) => {
          if (features.length === 0) return null;
          const categoryConfig = CATEGORY_LABELS[category] || { label: category, icon: <Settings /> };

          return (
            <Accordion
              key={category}
              expanded={expandedCategory === category}
              onChange={(_, expanded) => setExpandedCategory(expanded ? category : false)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {categoryConfig.icon}
                  <Typography fontWeight={500}>{categoryConfig.label}</Typography>
                  <Chip label={features.length} size="small" sx={{ height: 20 }} />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense disablePadding>
                  {features.map((feature: any) => {
                    const featureId = feature.featureId || feature.id;
                    const currentLevel = getFeaturePermissionLevel(featureId);
                    const levelConfig = PERMISSION_LEVELS[currentLevel];

                    return (
                      <ListItem
                        key={featureId}
                        sx={{
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          py: 1}}
                      >
                        <ListItemText
                          primary={feature.name || featureId}
                          secondary={feature.description}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500}}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <ListItemSecondaryAction>
                          <ToggleButtonGroup
                            size="small"
                            value={currentLevel}
                            exclusive
                            onChange={(_, newLevel) => newLevel && setFeaturePermission(featureId, newLevel)}
                          >
                            <ToggleButton value="all" sx={{ px: 1 }}>
                              <Tooltip title="Alle har tilgang">
                                <LockOpen fontSize="small" sx={{ color: currentLevel === 'all' ? '#4caf50' : 'inherit' }} />
                              </Tooltip>
                            </ToggleButton>
                            <ToggleButton value="admin_member" sx={{ px: 1 }}>
                              <Tooltip title="Admin + Medlem">
                                <People fontSize="small" sx={{ color: currentLevel === 'admin_member' ? '#2196f3' : 'inherit' }} />
                              </Tooltip>
                            </ToggleButton>
                            <ToggleButton value="admin_only" sx={{ px: 1 }}>
                              <Tooltip title="Kun Admin">
                                <AdminPanelSettings fontSize="small" sx={{ color: currentLevel === 'admin_only' ? '#ff9800' : 'inherit' }} />
                              </Tooltip>
                            </ToggleButton>
                            <ToggleButton value="disabled" sx={{ px: 1 }}>
                              <Tooltip title="Deaktivert">
                                <Lock fontSize="small" sx={{ color: currentLevel === 'disabled' ? '#f44336' : 'inherit' }} />
                              </Tooltip>
                            </ToggleButton>
                          </ToggleButtonGroup>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Summary */}
        <Box sx={{ mt: 2, p: 2, bgcolor: alpha('#9c27b0', 0.05), borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Oppsummering:</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<LockOpen />}
              label={`${allFeatures.length - adminOnlyFeatures.length - disabledFeatures.length} åpne`}
              size="small"
              sx={{ bgcolor: alpha('#4caf50', 0.1) }}
            />
            <Chip
              icon={<AdminPanelSettings />}
              label={`${adminOnlyFeatures.length} kun admin`}
              size="small"
              sx={{ bgcolor: alpha('#ff9800', 0.1) }}
            />
            <Chip
              icon={<Lock />}
              label={`${disabledFeatures.length} deaktivert`}
              size="small"
              sx={{ bgcolor: alpha('#f44336', 0.1) }}
            />
          </Box>
        </Box>

        {hasChanges && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Du har ulagrede endringer. Klikk"Lagre endringer" for å aktivere dem.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

