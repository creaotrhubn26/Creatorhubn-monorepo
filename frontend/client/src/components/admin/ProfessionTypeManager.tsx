/**
 * Profession Type Manager
 * Allows platform admins to add, configure, and manage profession types dynamically
 * Similar to VendorTypeManager but for service professions
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Add,
  Settings,
  Category,
  CheckCircle,
  RadioButtonUnchecked,
  Lightbulb,
  Extension,
  Info,
  Edit,
  Delete,
  Preview,
  ExpandMore,
  Star,
  TrendingUp,
  Business,
  People,
  AttachMoney,
  Event
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ProfessionTypeConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  color: string;
  iconColor: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  
  // Market data
  businessModel: string;
  marketSize: 'small' | 'medium' | 'large';
  averageProjectValue: string;
  
  // Norwegian market
  ssbIndustryCode: string;
  proffIndustry: string;
  demand: 'high' | 'medium' | 'low';
  competition: 'high' | 'medium' | 'low';
  pricingRange: string;
  seasonality: string[];
  
  // Features & capabilities
  equipmentFocus: string[];
  workEnvironment: string[];
  typicalProjects: string[];
  targetClients: string[];
  skills: string[];
  challenges: string[];
  opportunities: string[];
  
  // Dashboard components
  components: {
    overview: string[];
    projects: string[];
    pricing: string[];
    contracts: string[];
    clients: string[];
    equipment: string[];
    files: string[];
    email: string[];
    worklog: string[];
    settings: string[];
    showcase: string[];
    timeline: string[];
    communication: string[];
  };
}

export default function ProfessionTypeManager() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProfession, setSelectedProfession] = useState<ProfessionTypeConfig | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const theming = useTheming('admin, ');
  const { analytics, performance, debugging, lifecycle, features, auth } = useEnhancedMasterIntegration();

  // Dynamic tab filtering using feature access
  const activeProfessionsAccess = features.checkFeatureAccess('admin-active-professions,');
  const templatesAccess = features.checkFeatureAccess('admin-profession-templates,');
  const ssbDataAccess = features.checkFeatureAccess('admin-ssb-proff-data, ');
  const createProfessionAccess = features.checkFeatureAccess('admin-create-profession');
  
  // Build dynamic tab configuration
  const availableTabs = React.useMemo(() => {
    const tabs: Array<{ id: string; label: string; count?: number; access: boolean }> = [];
    
    if (activeProfessionsAccess.hasAccess) {
      tabs.push({
        id: 'active',
        label: 'Aktive Profesjoner',
        access: true
      });
    }
    
    if (templatesAccess.hasAccess) {
      tabs.push({
        id: 'templates',
        label: 'Tilgjengelige Maler',
        access: true
      });
    }
    
    if (ssbDataAccess.hasAccess) {
      tabs.push({
        id: 'ssb-data',
        label: 'SSB/Proff.no Data',
        access: true
      });
    }
    
    return tabs;
  }, [activeProfessionsAccess.hasAccess, templatesAccess.hasAccess, ssbDataAccess.hasAccess]);

  // Register component with Master Integration
  React.useEffect(() => {
    lifecycle.registerComponent({
      id: 'ProfessionTypeManager',
      name: 'Profession Type Manager',
      version: '1.0.0',
      status: 'active',
      capabilities: {
        data: ['profession_types','ssb_data','proff_data'],
        events: ['profession_created','profession_updated','profession_deleted'],
        actions: ['create_profession','update_profession','delete_profession','toggle_profession'],
        ui: ['profession_list','create_form','edit_form','preview'],
        system: ['ssb_integration','proff_integration']
      }
    });

    analytics.trackEvent('profession_type_manager_opened', {
      timestamp: new Date().toISOString(),
      availableTabs: availableTabs.length,
      accessibleFeatures: {
        activeProfessions: activeProfessionsAccess.hasAccess,
        templates: templatesAccess.hasAccess,
        ssbData: ssbDataAccess.hasAccess,
        createProfession: createProfessionAccess.hasAccess
      }
    });

    // Track feature usage
    features.trackFeatureUsage('admin-profession-type-manager','opened', {
      tabCount: availableTabs.length
    });

    return () => {
      lifecycle.unregisterComponent('ProfessionTypeManager');
    };
  }, [availableTabs.length]);

  // Track tab changes with feature access
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    const selectedTabConfig = availableTabs[newValue];
    
    if (selectedTabConfig) {
      analytics.trackEvent('profession_manager_tab_changed', {
        tabId: selectedTabConfig.id,
        tabLabel: selectedTabConfig.label,
        tabIndex: newValue
      });
      
      features.trackFeatureUsage(`admin-profession-tab-${selectedTabConfig.id}`, 'viewed', {
        tabIndex: newValue
      });
    }
    
    setSelectedTab(newValue);
  };

  // Fetch active professions
  const { data: activeProfessions, isLoading: loadingActive } = useQuery({
    queryKey: ['/api/admin/profession-types'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/profession-types', { headers });
    },
    staleTime: 5 * 60 * 1000
  });

  // Fetch available profession templates
  const { data: availableTemplates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['/api/admin/profession-types/templates'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/profession-types/templates', { headers });
    },
    staleTime: 10 * 60 * 1000
  });

  // Create profession mutation
  const createProfessionMutation = useMutation({
    mutationFn: async (professionData: Partial<ProfessionTypeConfig>) => {
      const perfMarker = performance.markStart('create_profession');

      try {
        const headers = await auth.getAuthHeader();
        const result = await apiRequest('/api/admin/profession-types', {
          method: 'POST',
          body: JSON.stringify(professionData),
          headers: {
            ...headers, 'Content-Type': 'application/json'
          }
        });

        performance.markEnd('create_profession', perfMarker);
        analytics.trackEvent('profession_created', {
          professionId: result.id,
          professionName: result.displayName,
          category: result.category
        });

        return result;
      } catch (error) {
        debugging.logError('profession_creation_failed', error as Error, {
          professionData
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types/templates'] });
      setCreateDialogOpen(false);
    }
  });

  // Update profession mutation
  const updateProfessionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProfessionTypeConfig> }) => {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest(`/api/admin/profession-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });

      analytics.trackEvent('profession_updated', {
        professionId: id,
        changes: Object.keys(data)
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types'] });
      setEditDialogOpen(false);
    }
  });

  // Toggle profession active status
  const toggleProfessionMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/profession-types/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types'] });
    }
  });

  // Activate template mutation
  const activateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest(`/api/admin/profession-types/templates/${templateId}/activate`, {
        method: 'POST',
        headers
      });

      analytics.trackEvent('profession_template_activated', {
        templateId,
        professionName: result.displayName
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types/templates'] });
    }
  });

  const handleCreateProfession = (template: ProfessionTypeConfig) => {
    setSelectedProfession(template);
    setCreateDialogOpen(true);
  };

  const handleEditProfession = (profession: ProfessionTypeConfig) => {
    setSelectedProfession(profession);
    setEditDialogOpen(true);
  };

  const handlePreview = (profession: ProfessionTypeConfig) => {
    setSelectedProfession(profession);
    setPreviewDialogOpen(true);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      creative: '#e91e63',
      technology: '#2196f3',
      service: '#ff9800',
      education: '#4caf50',
      health: '#f44336',
      lifestyle: '#9c27b0',
      business: '#607d8b',
      entertainment: '#ff5722'
    };
    return colors[category] || '#9e9e9e';
  };

  const getDemandChipColor = (demand: string) => {
    switch (demand) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'error';
      default: return 'default';
    }
  };

  const getCompetitionChipColor = (competition: string) => {
    switch (competition) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ 
        p: 3, 
        mb: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 60, height: 60 }}>
              <Category sx={{ fontSize: 30, color: 'white' }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 700}}>
                Profession Type Manager
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Administrer og utvid profesjoner dynamisk
              </Typography>
            </Box>
          </Box>
          
          {createProfessionAccess.hasAccess && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                analytics.trackEvent('create_profession_button_clicked', {
                  hasAccess: createProfessionAccess.hasAccess
                });
                setCreateDialogOpen(true);
              }}
              sx={{
                bgcolor: 'white',
                color: '#667eea', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
              }}
            >
              Ny Profesjon
            </Button>
          )}
          
          {!createProfessionAccess.hasAccess && (
            <Chip
              label={`Tilgang nektet: ${createProfessionAccess.reason || 'Mangler rettigheter'}`}
              icon={<Info />}
              color="warning"
              size="small"
            />
          )}
        </Box>
      </Paper>

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary">
                Aktive Profesjoner
              </Typography>
              <Typography variant="h3" sx={{ color: '#4caf50', fontWeight: 700}}>
                {activeProfessions?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary">
                Tilgjengelige Maler
              </Typography>
              <Typography variant="h3" sx={{ color: '#2196f3', fontWeight: 700}}>
                {availableTemplates?.count || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary">
                Totale Brukere
              </Typography>
              <Typography variant="h3" sx={{ color: '#ff9800', fontWeight: 700}}>
                {activeProfessions?.totalUsers || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary">
                SSB Integrasjoner
              </Typography>
              <Typography variant="h3" sx={{ color: '#9c27b0', fontWeight: 700}}>
                {activeProfessions?.ssbConnected || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dynamic Tabs with Feature Access */}
      <Paper sx={{ mb: 3 }}>
        {availableTabs.length > 0 ? (
          <Tabs 
            value={selectedTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {availableTabs.map((tab, index) => (
              <Tab 
                key={tab.id}
                label={
                  tab.id === 'active' 
                    ? `${tab.label} (${activeProfessions?.total || 0})`
                    : tab.id === 'templates'
                    ? `${tab.label} (${availableTemplates?.count || 0})`
                    : tab.label
                }
                icon={
                  tab.id === 'active' ? <CheckCircle fontSize="small" /> :
                  tab.id === 'templates' ? <Extension fontSize="small" /> :
                  <Info fontSize="small" />
                }
                iconPosition="start"
              />
            ))}
          </Tabs>
        ) : (
          <Alert severity="warning" sx={{ m: 2 }}>
            <Typography variant="body2">
              Ingen tilgjengelige faner. Kontakt administrator for tilgang.
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Active Professions */}
      {selectedTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <CheckCircle sx={{ mr: 2, color: 'success.main' }} />
            Aktive Profesjoner
          </Typography>
          
          <Grid container spacing={2}>
            {activeProfessions?.professions?.map((profession: ProfessionTypeConfig) => (
              <Grid item xs={12} sm={6} md={4} key={profession.id}>
                <Card sx={{ 
                  height: '100%',
                  border: `2px solid ${profession.iconColor}30`, '&:hover': { 
                    borderColor: profession.iconColor,
                    boxShadow: `0 4px 20px ${profession.iconColor}40`
                  }
                }}>
                  <CardContent>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: profession.iconColor }}>
                        <Business />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600}}>
                          {profession.displayName}
                        </Typography>
                        <Chip 
                          label={profession.category}
                          size="small"
                          sx={{ 
                            bgcolor: getCategoryColor(profession.category),
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                      <Switch
                        checked={profession.isActive}
                        onChange={() => toggleProfessionMutation.mutate({
                          id: profession.id,
                          isActive: !profession.isActive
                        })}
                        size="small"
                      />
                    </Box>
                    
                    {/* Description */}
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, height: 40, overflow: 'hidden' }}>
                      {profession.description}
                    </Typography>
                    
                    {/* Market indicators */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`Etterspørsel: ${profession.demand.toUpperCase()}`}
                        size="small"
                        color={getDemandChipColor(profession.demand) as any}
                        icon={<TrendingUp />}
                      />
                      <Chip 
                        label={`Konkurranse: ${profession.competition.toUpperCase()}`}
                        size="small"
                        color={getCompetitionChipColor(profession.competition) as any}
                      />
                    </Box>
                    
                    {/* SSB/Proff data indicator */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip 
                        label={`SSB: ${profession.ssbIndustryCode}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem' }}
                      />
                      <Chip 
                        label="Proff.no ✓"
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem' }}
                      />
                    </Box>
                    
                    {/* Pricing */}
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                      💰 {profession.pricingRange}
                    </Typography>
                    
                    {/* Users count */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <People sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="textSecondary">
                        {profession.users || 0} brukere
                      </Typography>
                    </Box>
                    
                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Preview />}
                        onClick={() => handlePreview(profession)}
                        sx={{ flex: 1 }}
                      >
                        Forhåndsvisning
                      </Button>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditProfession(profession)}
                        sx={{ color: profession.iconColor }}
                      >
                        <Edit />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Available Templates */}
      {selectedTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <Extension sx={{ mr: 2, color: 'primary.main' }} />
            Tilgjengelige Profesjonsmaler
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Disse profesjonene kan aktiveres med ett klikk. Hver mal inkluderer ferdigkonfigurerte funksjoner, 
              SSB/Proff.no integrasjon, og bransjespesifikke verktøy.
            </Typography>
          </Alert>
          
          <Grid container spacing={2}>
            {availableTemplates?.templates?.map((template: ProfessionTypeConfig) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card sx={{ 
                  height: '100%',
                  border: `2px dashed ${template.iconColor}50`, '&:hover': { 
                    borderColor: template.iconColor,
                    borderStyle: 'solid',
                    boxShadow: `0 4px 20px ${template.iconColor}40`
                  }
                }}>
                  <CardContent>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: `${template.iconColor}20`, color: template.iconColor }}>
                        <Business />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600}}>
                          {template.displayName}
                        </Typography>
                        <Chip 
                          label={template.category}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: getCategoryColor(template.category),
                            color: getCategoryColor(template.category),
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                    </Box>
                    
                    {/* Description */}
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {template.description}
                    </Typography>
                    
                    {/* Market data */}
                    <Accordion sx={{ mb: 2, boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="caption" sx={{ fontWeight: 600}}>
                          Markedsdata
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Chip 
                            label={`Etterspørsel: ${template.demand.toUpperCase()}`}
                            size="small"
                            color={getDemandChipColor(template.demand) as any}
                          />
                          <Chip 
                            label={`Konkurranse: ${template.competition.toUpperCase()}`}
                            size="small"
                            color={getCompetitionChipColor(template.competition) as any}
                          />
                          <Typography variant="caption" sx={{ mt: 1 }}>
                            💰 {template.pricingRange}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            📊 SSB: {template.ssbIndustryCode}
                          </Typography>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                    
                    {/* Typical projects */}
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      Typiske prosjekter:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      {template.typicalProjects.slice(0, 3).map(project => (
                        <Chip 
                          key={project}
                          label={project}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem' }}
                        />
                      ))}
                      {template.typicalProjects.length > 3 && (
                        <Chip 
                          label={`+${template.typicalProjects.length - 3} more`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem' }}
                        />
                      )}
                    </Box>
                    
                    {/* Action buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => activateTemplateMutation.mutate(template.id)}
                        disabled={activateTemplateMutation.isPending}
                        sx={{
                          bgcolor: template.iconColor,
                          '&:hover': { bgcolor: template.iconColor, opacity: 0.9 }
                        }}
                      >
                        Aktiver
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => handlePreview(template)}
                        sx={{ minWidth: 'auto', px: 2 }}
                      >
                        <Preview />
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* SSB/Proff.no Data Tab */}
      {selectedTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600}}>
            SSB og Proff.no Integrasjon
          </Typography>
          
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Alle profesjoner henter automatisk reelle norske markedsdata fra Statistisk Sentralbyrå (SSB) 
              og Proff.no for å gi brukere pålitelig informasjon.
            </Typography>
          </Alert>
          
          <Grid container spacing={2}>
            {activeProfessions?.professions?.map((profession: ProfessionTypeConfig) => (
              <Grid item xs={12} md={6} key={profession.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: profession.iconColor }}>
                      {profession.displayName}
                    </Typography>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    {/* SSB Data */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      📊 SSB (Statistisk Sentralbyrå)
                    </Typography>
                    <Box sx={{ pl: 2, mb: 2 }}>
                      <Typography variant="caption" display="block">
                        Næringskode: {profession.ssbIndustryCode}
                      </Typography>
                      <Typography variant="caption" display="block" color="textSecondary">
                        Status: {profession.ssbData ? '✓ Tilkoblet' : '⏳ Henter data...'}
                      </Typography>
                    </Box>
                    
                    {/* Proff.no Data */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      🏢 Proff.no
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" display="block">
                        Bransje: {profession.proffIndustry}
                      </Typography>
                      <Typography variant="caption" display="block" color="textSecondary">
                        Status: {profession.proffData ? '✓ Tilkoblet' : '⏳ Henter data...'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Preview Dialog */}
      <Dialog 
        open={previewDialogOpen} 
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: selectedProfession?.iconColor }}>
              <Business />
            </Avatar>
            <Box>
              <Typography variant="h6">{selectedProfession?.displayName}</Typography>
              <Typography variant="caption" color="textSecondary">
                Forhåndsvisning av profesjonsdetaljer
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedProfession && (
            <Box>
              {/* Basic info */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Grunnleggende Informasjon
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">ID:</Typography>
                  <Typography variant="body2">{selectedProfession.id}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Kategori:</Typography>
                  <Typography variant="body2">{selectedProfession.category}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Forretningsmodell:</Typography>
                  <Typography variant="body2">{selectedProfession.businessModel}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Markedsstørrelse:</Typography>
                  <Typography variant="body2">{selectedProfession.marketSize}</Typography>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Norwegian market */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Norsk Marked
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Chip 
                    label={`Etterspørsel: ${selectedProfession.demand.toUpperCase()}`}
                    color={getDemandChipColor(selectedProfession.demand) as any}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Chip 
                    label={`Konkurranse: ${selectedProfession.competition.toUpperCase()}`}
                    color={getCompetitionChipColor(selectedProfession.competition) as any}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Prisklasse:</Typography>
                  <Typography variant="body2">{selectedProfession.pricingRange}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">SSB Næringskode:</Typography>
                  <Typography variant="body2">{selectedProfession.ssbIndustryCode}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Proff.no Bransje:</Typography>
                  <Typography variant="body2">{selectedProfession.proffIndustry}</Typography>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Typical projects */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Typiske Prosjekter
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3 }}>
                {selectedProfession.typicalProjects.map(project => (
                  <Chip key={project} label={project} size="small" variant="outlined" />
                ))}
              </Box>
              
              {/* Target clients */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Målgruppe
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3 }}>
                {selectedProfession.targetClients.map(client => (
                  <Chip key={client} label={client} size="small" variant="outlined" />
                ))}
              </Box>
              
              {/* Seasonality */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Sesongvariasjon
              </Typography>
              <List dense>
                {selectedProfession.seasonality.map((season, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <Event sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={season}
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={createDialogOpen || editDialogOpen} 
        onClose={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6">
            {createDialogOpen ? 'Opprett Ny Profesjon' : 'Rediger Profesjon'}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Dette er en kraftig funksjon som lar deg legge til helt nye profesjoner til CreatorHub Norge.
            Systemet vil automatisk hente SSB og Proff.no data basert på næringskoden du oppgir.
          </Alert>
          
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Funksjonalitet kommer snart! For nå, bruk tilgjengelige maler i fanen "Tilgjengelige Maler".
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
          }}>
            Avbryt
          </Button>
          <Button variant="contained" disabled>
            {createDialogOpen ? 'Opprett' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
