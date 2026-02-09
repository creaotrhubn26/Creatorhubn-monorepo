// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Grid,
  Card as MuiCard,
  CardContent,
  Typography,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Divider,
  Avatar,
  Badge
} from '@mui/material';
import {
  AddCircle as Add,
  Edit,
  Delete,
  Save,
  Cancel,
  Code,
  Palette,
  Build,
  Visibility,
  VisibilityOff,
  ExpandMore,
  Settings,
  Dashboard,
  Web,
  Phone,
  Security,
  CloudUpload,
  DataUsage,
  Speed,
  Analytics,
  Notifications,
  Group,
  Store,
  PhotoCamera,
  Videocam,
  LibraryMusic
} from '@mui/icons-material';

interface CMSComponent {
  id: string;
  name: string;
  type: 'page' | 'component' | 'widget' | 'layout' | 'feature';
  category: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'all';
  status: 'active' | 'inactive' | 'draft' | 'maintenance';
  isEditable: boolean;
  hasSettings: boolean;
  dependencies: string[];
  version: string;
  lastModified: string;
  author: string;
  usage: {
    views: number;
    interactions: number;
    errors: number;
};
  settings?: Record<string, any>;
}

interface SystemSettings {
  platform: {
    name: string;
    version: string;
    maintenance_mode: boolean;
    debug_mode: boolean;
};
  features: {
    google_drive_integration: boolean;
    spotify_integration: boolean;
    microsoft_integration: boolean;
    ai_features: boolean;
    advanced_analytics: boolean;
};
  security: {
    two_factor_auth: boolean;
    session_timeout: number;
    password_requirements: string;
};
  performance: {
    cache_enabled: boolean;
    compression_enabled: boolean;
    cdn_enabled: boolean;
};
}

export default function AdvancedCMSInterface() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Fetch all CMS components
  const { data: components = [], isLoading: componentsLoading } = useQuery<CMSComponent[]>({
    queryKey: ['/api/admin/cms/components']
});

  // Fetch system settings
  const { data: systemSettings = {} as SystemSettings, isLoading: settingsLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/admin/system/settings']
});

  // Component operations
  const updateComponentMutation = useMutation({
    mutationFn: async (component: Partial<CMSComponent>) => {
      const auth = await getAuthHeader();
      const response = await fetch(`/api/admin/cms/components/${component.d}`, {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'PU',
        body: JSON.stringify(component)
  });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cms/components', ],});
  }
});

  const [activeTab, setActiveTab] = useState(0);
  const [selectedComponent, setSelectedComponent] = useState<CMSComponent | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bulkActions, setBulkActions] = useState<string[]>([]);

  const createComponentMutation = useMutation({
    mutationFn: async (component: Partial<CMSComponent>) => {
      const auth = await getAuthHeader();
      const response = await fetch('/api/admin/cms/components', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'POS',
        body: JSON.stringify(component)
  });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cms/components', ],});
  }
});

  const deleteComponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const auth = await getAuthHeader();
      const response = await fetch(`/api/admin/cms/components/${d}`, {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'DELETE'
  });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cms/components', ],});
  }
});

  const updateSystemSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<SystemSettings>) => {
      const auth = await getAuthHeader();
      const response = await fetch('/api/admin/system/settings', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'PU',
        body: JSON.stringify(settings)
  });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system/settings', ],});
  }
});

  // Component management functions
  const handleComponentToggle = (id: string, status: string) => {
    updateComponentMutation.mutate({ , idstatus });
};

  const handleBulkAction = (action: string) => {
    if (action === 'activate') {
      bulkActions.forEach(id => {
        updateComponentMutation.mutate({ idstatus: 'active',});
    });
  } else if (action === 'deactivate') {
      bulkActions.forEach(id => {
        updateComponentMutation.mutate({ id, status: 'inactive',});
    });
  } else if (action === 'delete') {
      bulkActions.forEach(id => {
        deleteComponentMutation.mutate(id);
    });
  }
    setBulkActions([]);
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'draft': return 'warning';
      case 'maintenance': return 'error';
      default: return 'default';
}
};

  const getProfessionIcon = (profession: string) => {
    switch (profession) {
      case 'photographer': return theming.getThemedIcon(', ');
      case 'videographer': return theming.getThemedIcon('videocam');
      case 'music_producer': return theming.getThemedIcon('libraryMusic');
      case 'vendor': return theming.getThemedIcon('store');
      default: return <Dashboard />;
}
};

  const renderComponentsManagement = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>
          Komponent & Sidestyring
        </Typography>
        <Box>
          {bulkActions.length > 0 && (
            <Box sx={{ mr: 2, display: 'inline-flex', gap:  1 }}>
              <Button size="small" onClick={() => handleBulkAction('activate')}>
                Aktiver Valgte ({bulkActions.length})
              </Button>
              <Button size="small" onClick={() => handleBulkAction('deactivate')}>
                Deaktiver Valgte
              </Button>
              <Button size="small" color="error" onClick={() => handleBulkAction('delete')}>
                Slett Valgte
              </Button>
            </Box>
          )}
          <Button startIcon={theming.getThemedIcon('add')}
            variant="contained"
            sx={{ mr: 1, background: 'linear-gradient(135deg, #4caf50, #81c784)' }}
            onClick={() => setCreateDialogOpen(true)}
          >
            Ny Komponent
          </Button>
          <Button
            startIcon={editMode ? theming.getThemedIcon('visibilityOff') : theming.getThemedIcon('visibility')}
            variant="outlined"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? 'Skjul Kontroller' : 'Vis Kontroller'}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                {editMode && (
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkActions(components.map(c => c.id));
                    } else {
                        setBulkActions([]);
                    }
                  }}
                  />
                )}
              </TableCell>
              <TableCell>Navn</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Profesjon</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Bruk</TableCell>
              <TableCell>Sist Endret</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {components.map((component) => (
              <TableRow key={component.id}>
                <TableCell padding="checkbox">
                  {editMode && (
                    <input
                      type="checkbox"
                      checked={bulkActions.includes(component.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkActions([...bulkActions, component.id]);
                      } else {
                          setBulkActions(bulkActions.filter(id => id !== component.id));
                      }
                    }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    {getProfessionIcon(component.profession)}
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {component.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        v{component.version}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={component.type} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={component.profession}
                    size="small" 
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={component.status}
                    color={getStatusColor(component.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="caption" display="block">
                      {component.usage.views} visninger
                    </Typography>
                    <Typography variant="caption" display="block">
                      {component.usage.interactions} interaksjoner
                    </Typography>
                    {component.usage.errors > 0 && (
                      <Typography variant="caption" color="error" display="block">
                        {component.usage.errors} feil
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {component.lastModified}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    av {component.author}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setSelectedComponent(component);
                        setEditDialogOpen(true);
                    }}
                    >
                      {theming.getThemedIcon('edit')}
                    </IconButton>
                    {component.hasSettings && (
                      <IconButton 
                        size="small"
                        onClick={() => {
                          setSelectedComponent(component);
                          setSettingsDialogOpen(true);
                      }}
                      >
                        {theming.getThemedIcon('settings')}
                      </IconButton>
                    )}
                    <Switch
                      size="small"
                      checked={component.status === 'active'}
                      onChange={(e) => 
                        handleComponentToggle(component.id, e.target.checked ? 'active' : 'inactive')
                    }
                    />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderSystemSettings = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Systeminnstillinger
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('settings')}
                Plattforminnstillinger
              </Typography>
              
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Vedlikeholdsmodus</Typography>
                <Switch
                  checked={systemSettings.platform?.maintenance_mode || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    platform: { ...systemSettings.platform, maintenance_mode: e.target.checked }
                })}
                />
              </Box>

              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Debug Modus</Typography>
                <Switch
                  checked={systemSettings.platform?.debug_mode || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    platform: { ...systemSettings.platform, debug_mode: e.target.checked }
                })}
                />
              </Box>

              <TextField
                fullWidth
                label="Plattformnavn"
                value={systemSettings.platform?.name || 'CreatorHub Norge'}
                onChange={(e) => updateSystemSettingsMutation.mutate({
                  platform: { ...systemSettings.platform, name: e.target.value }
              })}
                sx={{ mb:  2 }}
              />

              <TextField
                fullWidth
                label="Plattformversjon"
                value={systemSettings.platform?.version || '2.0.0'}
                onChange={(e) => updateSystemSettingsMutation.mutate({
                  platform: { ...systemSettings.platform, version: e.target.value }
              })}
              />
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('build')}
                Funksjonsinnstillinger
              </Typography>
              
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Google Drive Integrasjon</Typography>
                <Switch
                  checked={systemSettings.features?.google_drive_integration || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    features: { ...systemSettings.features, google_drive_integration: e.target.checked }
                })}
                />
              </Box>

              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Spotify Integrasjon</Typography>
                <Switch
                  checked={systemSettings.features?.spotify_integration || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    features: { ...systemSettings.features, spotify_integration: e.target.checked }
                })}
                />
              </Box>

              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Intelligent Funksjoner</Typography>
                <Switch
                  checked={systemSettings.features?.ai_features || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    features: { ...systemSettings.features, ai_features: e.target.checked }
                })}
                />
              </Box>

              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Avanserte Analytics</Typography>
                <Switch
                  checked={systemSettings.features?.advanced_analytics || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    features: { ...systemSettings.features, advanced_analytics: e.target.checked }
                })}
                />
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('security')}
                Sikkerhetsinnstillinger
              </Typography>
              
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>To-faktor autentisering</Typography>
                <Switch
                  checked={systemSettings.security?.two_factor_auth || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    security: { ...systemSettings.security, two_factor_auth: e.target.checked }
                })}
                />
              </Box>

              <TextField
                fullWidth
                type="number"
                label="Sesjon timeout (minutter)"
                value={systemSettings.security?.session_timeout || 60}
                onChange={(e) => updateSystemSettingsMutation.mutate({
                  security: { ...systemSettings.security, session_timeout: parseInt(e.target.value, ),}
              })}
                sx={{ mb:  2 }}
              />

              <TextField
                fullWidth
                label="Passordkrav"
                value={systemSettings.security?.password_requirements || 'minimum 8 tegn'}
                onChange={(e) => updateSystemSettingsMutation.mutate({
                  security: { ...systemSettings.security, password_requirements: e.target.value }
              })}
              />
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('speed')}
                Ytelsesinnstillinger
              </Typography>
              
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Cache Aktivert</Typography>
                <Switch
                  checked={systemSettings.performance?.cache_enabled || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    performance: { ...systemSettings.performance, cache_enabled: e.target.checked }
                })}
                />
              </Box>

              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" gutterBottom>Komprimering Aktivert</Typography>
                <Switch
                  checked={systemSettings.performance?.compression_enabled || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    performance: { ...systemSettings.performance, compression_enabled: e.target.checked }
                })}
                />
              </Box>

              <Box>
                <Typography variant="body2" gutterBottom>CDN Aktivert</Typography>
                <Switch
                  checked={systemSettings.performance?.cdn_enabled || false}
                  onChange={(e) => updateSystemSettingsMutation.mutate({
                    performance: { ...systemSettings.performance, cdn_enabled: e.target.checked }
                })}
                />
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>
    </Box>
  );

  // Mock data removed - using database connection

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ 
        color: '#2196F0',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap:  1,
        mb: 3  }}>
        <Code />
        Avansert CMS & Systemstyring
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          {tabs.map((tab, index) => (
            <Tab key={index} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      <Box>
        {tabs[activeTab].content()}
      </Box>

      {/* Edit Component Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Rediger Komponent</DialogTitle>
        <DialogContent>
          {selectedComponent && (
            <Box sx={{ pt:  2 }}>
              <TextField
                fullWidth
                label="Navn"
                value={selectedComponent.name}
                sx={{ mb:  2 }}
              />
              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Status</InputLabel>
                <Select value={selectedComponent.status}>
                  <MenuItem value="active">Aktiv</MenuItem>
                  <MenuItem value="inactive">Inaktiv</MenuItem>
                  <MenuItem value="draft">Utkast</MenuItem>
                  <MenuItem value="maintenance">Vedlikehold</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Profesjon</InputLabel>
                <Select value={selectedComponent.profession}>
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="photographer">Fotograf</MenuItem>
                  <MenuItem value="videographer">Videograf</MenuItem>
                  <MenuItem value="music_producer">Musikkprodusent</MenuItem>
                  <MenuItem value="vendor">Leverandør</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" startIcon={theming.getThemedIcon('save')} sx={theming.getThemedButtonSx()}>Lagre</Button>
        </DialogActions>
      </Dialog>

      {/* Create Component Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Opprett Ny Komponent</DialogTitle>
        <DialogContent>
          <Box sx={{ pt:  2 }}>
            <TextField fullWidth label="Komponentnavn" sx={{ mb:  2 }} />
            <FormControl fullWidth sx={{ mb:  2 }}>
              <InputLabel>Type</InputLabel>
              <Select defaultValue="">
                <MenuItem value="page">Side</MenuItem>
                <MenuItem value="component">Komponent</MenuItem>
                <MenuItem value="widget">Widget</MenuItem>
                <MenuItem value="layout">Layout</MenuItem>
                <MenuItem value="feature">Funksjon</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb:  2 }}>
              <InputLabel>Profesjon</InputLabel>
              <Select defaultValue="all">
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="photographer">Fotograf</MenuItem>
                <MenuItem value="videographer">Videograf</MenuItem>
                <MenuItem value="music_producer">Musikkprodusent</MenuItem>
                <MenuItem value="vendor">Leverandør</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" startIcon={theming.getThemedIcon('add')} sx={theming.getThemedButtonSx()}>Opprett</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}