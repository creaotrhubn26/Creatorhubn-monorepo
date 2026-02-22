/**
 * Multi-Site/Space Management System
 * Multiple brands/domains in the same system with workspace isolation
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Paper,
  Stack,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  Domain,
  Add,
  Edit,
  Delete,
  Settings,
  Language,
  Palette,
  Security,
  Storage,
  CloudSync,
  Sync,
  CheckCircle,
  Error,
  Warning,
  ExpandMore,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';

// Types for multi-site management
interface Site {
  id: string;
  name: string;
  domain: string;
  subdomain?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'building';
  type: 'production' | 'staging' | 'development';
  brand: BrandConfig;
  settings: SiteSettings;
  users: SiteUser[];
  createdAt: Date;
  createdBy: string;
  lastModified: Date;
}

interface BrandConfig {
  name: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  typography: TypographyConfig;
  theme: 'light' | 'dark' | 'auto';
  customCSS?: string;
}

interface TypographyConfig {
  fontFamily: string;
  headingFont?: string;
  bodyFont?: string;
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
};
}

interface SiteSettings {
  seo: SEOSettings;
  analytics: AnalyticsSettings;
  security: SecuritySettings;
  performance: PerformanceSettings;
  integrations: IntegrationSettings;
}

interface SEOSettings {
  title: string;
  description: string;
  keywords: string[];
  favicon?: string;
  ogImage?: string;
  robotsTxt?: string;
  sitemap?: string;
}

interface AnalyticsSettings {
  googleAnalytics?: string;
  googleTagManager?: string;
  facebookPixel?: string;
  customTracking?: string;
}

interface SecuritySettings {
  https: boolean;
  csp: boolean;
  cors: boolean;
  rateLimit: boolean;
  authRequired: boolean;
  allowedDomains: string[];
}

interface PerformanceSettings {
  cdn: boolean;
  compression: boolean;
  caching: boolean;
  lazyLoading: boolean;
  minification: boolean;
}

interface IntegrationSettings {
  googleServices: boolean;
  socialMedia: boolean;
  emailMarketing: boolean;
  crm: boolean;
  payment: boolean;
}

interface SiteUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
  lastActive: Date;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  sites: string[];
  users: string[];
  owner: string;
  settings: WorkspaceSettings;
  createdAt: Date;
}

interface WorkspaceSettings {
  isolation: 'strict' | 'moderate' | 'shared';
  resourceLimits: {
    maxSites: number;
    maxUsers: number;
    maxStorage: number;
    maxBandwidth: number;
};
  features: {
    customDomains: boolean;
    ssl: boolean;
    analytics: boolean;
    backups: boolean;
    support: boolean;
};
}

interface MultiSiteManagerProps {
  onSiteUpdate: (sites: Site[]) => void;
  onWorkspaceUpdate: (workspaces: Workspace[]) => void;
}

export const MultiSiteManager: React.FC<MultiSiteManagerProps> = ({
  onSiteUpdate,
  onWorkspaceUpdate
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [activeTab, setActiveTab] = useState(0);
  const [sites, setSites] = useState<Site[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  
  const [showSiteDialog, setShowSiteDialog] = useState(false);
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Partial<Site>>({});
  const [editingWorkspace, setEditingWorkspace] = useState<Partial<Workspace>>({});
  
  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'syncing' | 'success' | 'error'>>({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Component registration
  useEffect(() => {
    lifecycle.registerComponent('multi-site-manager', {
      capabilities: [
        'site:create', 'site:update', 'site:delete', 'site:deploy', 'workspace:manage', 'brand:configure', 'domain:manage'
      ],
      metadata: {
        version: '1.0.0',
        sitesCount: sites.length,
        workspacesCount: workspaces.length
      }
    });

    // Initialize with sample data
    initializeSampleData();

    analytics.trackEvent('multi_site_manager_mounted', {
      sitesCount: sites.length,
      workspacesCount: workspaces.length,
      timestamp: Date.now()
    });

    return () => {
      lifecycle.unregisterComponent('multi-site-manager');
      analytics.trackEvent('multi_site_manager_unmounted', {
        timestamp: Date.now()
      });
    };
  }, [lifecycle, analytics, sites.length, workspaces.length]);

  const initializeSampleData = useCallback(() => {
    const sampleSites: Site[] = [
      {
        id: 'site-1',
        name: 'Main Website',
        domain: 'example.com',
        status: 'active',
        type: 'production',
        brand: {
          name: 'Example Corp',
          primaryColor: '#2196f3',
          secondaryColor: '#ff9800',
          typography: {
            fontFamily: 'Inter, sans-serif',
            fontSize: { xs: 14, sm: 16, md: 18, lg: 20, xl: 22 }
        },
          theme: 'light'
    },
        settings: {
          seo: {
            title: 'Example Corp - Professional Services',
            description: 'Leading provider of professional services',
            keywords: ['services','professional','business']
        },
          analytics: {
            googleAnalytics: 'GA-XXXXX-X'
      },
          security: {
            https: true,
            csp: true,
            cors: false,
            rateLimit: true,
            authRequired: false,
            allowedDomains: ['example.com','www.example.com']
        },
          performance: {
            cdn: true,
            compression: true,
            caching: true,
            lazyLoading: true,
            minification: true
      },
          integrations: {
            googleServices: true,
            socialMedia: true,
            emailMarketing: true,
            crm: false,
            payment: false
      }
      },
        users: [],
        createdAt: new Date(),
        createdBy: 'admin',
        lastModified: new Date()
  },
      {
        id: 'site-2',
        name: 'Staging Site',
        domain: 'staging.example.com',
        status: 'active',
        type: 'staging',
        brand: {
          name: 'Example Corp (Staging)',
          primaryColor: '#4caf50',
          secondaryColor: '#ff9800',
          typography: {
            fontFamily: 'Inter, sans-serif',
            fontSize: { xs: 14, sm: 16, md: 18, lg: 20, xl: 22 }
        },
          theme: 'light'
    },
        settings: {
          seo: {
            title: 'Example Corp - Staging',
            description: 'Staging environment',
            keywords: ['staging','test']
        },
          analytics: {},
          security: {
            https: true,
            csp: true,
            cors: false,
            rateLimit: false,
            authRequired: true,
            allowedDomains: ['staging.example.com']
      },
          performance: {
            cdn: false,
            compression: true,
            caching: true,
            lazyLoading: true,
            minification: false
      },
          integrations: {
            googleServices: false,
            socialMedia: false,
            emailMarketing: false,
            crm: false,
            payment: false
      }
      },
        users: [],
        createdAt: new Date(),
        createdBy: 'admin',
        lastModified: new Date()
  }
    ];

    const sampleWorkspaces: Workspace[] = [
      {
        id: 'workspace-1',
        name: 'Main Workspace',
        description: 'Primary workspace for main business',
        sites: ['site-1','site-2'],
        users: ['user-1','user-2'],
        owner: 'user-1',
        settings: {
          isolation: 'strict',
          resourceLimits: {
            maxSites: 10,
            maxUsers: 50,
            maxStorage: 1000, // GB
            maxBandwidth: 1000 // GB/month
      },
          features: {
            customDomains: true,
            ssl: true,
            analytics: true,
            backups: true,
            support: true
      }
      },
        createdAt: new Date()
  }
    ];

    setSites(sampleSites);
    setWorkspaces(sampleWorkspaces);
    onSiteUpdate(sampleSites);
    onWorkspaceUpdate(sampleWorkspaces);
}, [onSiteUpdate, onWorkspaceUpdate]);

  // Site management functions
  const createSite = useCallback((siteData: Partial<Site>) => {
    const endTiming = performance.startTiming('site_create');
    
    const newSite: Site = {
      id: `site_${Date.now()}`,
      name: siteData.name || 'New Site',
      domain: siteData.domain || 'example.com',
      status: 'inactive',
      type: siteData.type || 'development',
      brand: siteData.brand || {
        name: 'New Brand',
        primaryColor: '#2196f3',
        secondaryColor: '#ff9800',
        typography: {
          fontFamily: 'Inter, sans-serif',
          fontSize: { xs: 14, sm: 16, md: 18, lg: 20, xl: 22 }
      },
        theme: 'light'
  },
      settings: siteData.settings || {
        seo: { title: '', description: '', keywords: [] },
        analytics: {},
        security: {
          https: false,
          csp: false,
          cors: false,
          rateLimit: false,
          authRequired: false,
          allowedDomains: []
        },
        performance: {
          cdn: false,
          compression: false,
          caching: false,
          lazyLoading: false,
          minification: false
        },
        integrations: {
          googleServices: false,
          socialMedia: false,
          emailMarketing: false,
          crm: false,
          payment: false
        }
      },
      users: [],
      createdAt: new Date(),
      createdBy: 'current-user',
      lastModified: new Date()
};

    setSites(prev => [...prev, newSite]);
    onSiteUpdate([...sites, newSite]);
    
    analytics.trackEvent('site_created', {
      siteId: newSite.id,
      siteName: newSite.name,
      domain: newSite.domain,
      type: newSite.type,
      timestamp: Date.now()
});
    
    endTiming();
}, [sites, onSiteUpdate, performance, analytics]);

  const updateSite = useCallback((siteId: string, updates: Partial<Site>) => {
    const endTiming = performance.startTiming('site_update');
    
    setSites(prev => {
      const updated = prev.map(site => 
        site.id === siteId 
          ? { ...site, ...updates, lastModified: new Date() }
          : site
      );
      onSiteUpdate(updated);
      return updated;
  });
    
    analytics.trackEvent('site_updated', {
      siteId,
      timestamp: Date.now()
});
    
    endTiming();
}, [onSiteUpdate, performance, analytics]);

  const deploySite = useCallback(async (siteId: string) => {
    const endTiming = performance.startTiming('site_deploy');
    setSyncStatus(prev => ({ ...prev, [siteId]: 'syncing' }));
    setIsDeploying(true);
    
    try {
      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setSyncStatus(prev => ({ ...prev, [siteId]: 'success' }));
      
      // Update site status
      updateSite(siteId, { status: 'active' });
      
      analytics.trackEvent('site_deployed', {
        siteId,
        timestamp: Date.now()
  });
      
  } catch (error) {
      setSyncStatus(prev => ({ ...prev, [siteId]: 'error' }));
      
      analytics.trackEvent('site_deploy_failed', {
        siteId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
  });
  } finally {
      setIsDeploying(false);
      endTiming();
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, [siteId]: 'idle' }));
    }, 3000);
  }
}, [updateSite, performance, analytics]);

  // Workspace management functions
  const createWorkspace = useCallback((workspaceData: Partial<Workspace>) => {
    const endTiming = performance.startTiming('workspace_create');
    
    const newWorkspace: Workspace = {
      id: `workspace_${Date.now()}`,
      name: workspaceData.name || 'New Workspace',
      description: workspaceData.description || '',
      sites: [],
      users: [],
      owner: 'current-user',
      settings: workspaceData.settings || {
        isolation: 'moderate',
        resourceLimits: {
          maxSites: 5,
          maxUsers: 10,
          maxStorage: 1000,
          maxBandwidth: 100
    },
        features: {
          customDomains: false,
          ssl: true,
          analytics: false,
          backups: false,
          support: false
    }
    },
      createdAt: new Date()
};

    setWorkspaces(prev => [...prev, newWorkspace]);
    onWorkspaceUpdate([...workspaces, newWorkspace]);
    
    analytics.trackEvent('workspace_created', {
      workspaceId: newWorkspace.id,
      workspaceName: newWorkspace.name,
      timestamp: Date.now()
});
    
    endTiming();
}, [workspaces, onWorkspaceUpdate, performance, analytics]);

  // Render functions
  const renderSites = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Sites</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowSiteDialog(true)}
          sx={theming.getThemedButtonSx()}
        >
          Create Site
        </Button>
      </Box>

      <Grid container spacing={2}>
        {sites.map((site) => (
          <Grid item xs={12} md={6} lg={4} key={site.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: site.brand.primaryColor }}>
                    <Domain />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                      {site.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {site.domain}
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip 
                    size="small" 
                    label={site.status} 
                    color={getStatusColor(site.status)}
                  />
                  <Chip 
                    size="small" 
                    label={site.type} 
                    variant="outlined"
                  />
                </Stack>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={theming.getThemedIcon('visibility')}
                    onClick={() => window.open(`https://${site.domain}`, '_blank')}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={getSyncIcon(syncStatus[site.id] || 'idle')}
                    onClick={() => deploySite(site.id)}
                    disabled={isDeploying || syncStatus[site.id] === 'syncing'}
                  >
                    Deploy
                  </Button>
                  <IconButton size="small" onClick={() => setCurrentSite(site)}>
                    {theming.getThemedIcon('settings')}
                  </IconButton>
                </Box>

                {syncStatus[site.id] === 'syncing' && (
                  <LinearProgress />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderWorkspaces = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Workspaces</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowWorkspaceDialog(true)}
          sx={theming.getThemedButtonSx()}
        >
          Create Workspace
        </Button>
      </Box>

      <List>
        {workspaces.map((workspace) => (
          <ListItem key={workspace.id} divider>
            <ListItemIcon>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {theming.getThemedIcon('business')}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {workspace.name}
                  <Chip size="small" label={workspace.settings.isolation} />
                </Box>
            }
              secondary={
                <Box>
                  <Typography variant="body2">{workspace.description}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip size="small" label={`${workspace.sites.length} sites`} />
                    <Chip size="small" label={`${workspace.users.length} users`} />
                  </Box>
                </Box>
            }
            />
            <ListItemSecondaryAction>
              <IconButton onClick={() => setEditingWorkspace(workspace)}>
                {theming.getThemedIcon('edit')}
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const renderBrandManagement = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Brand Management
      </Typography>
      
      {sites.map((site) => (
        <Accordion key={site.id}>
          <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: site.brand.primaryColor }}>
                {theming.getThemedIcon('palette')}
              </Avatar>
              <Box>
                <Typography variant="subtitle1">{site.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {site.brand.name}
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Brand Name"
                  value={site.brand.name}
                  onChange={(e) => updateSite(site.id, {
                    brand: { ...site.brand, name: e.target.value }
                })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Primary Color"
                  type="color"
                  value={site.brand.primaryColor}
                  onChange={(e) => updateSite(site.id, {
                    brand: { ...site.brand, primaryColor: e.target.value }
                })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Secondary Color"
                  type="color"
                  value={site.brand.secondaryColor}
                  onChange={(e) => updateSite(site.id, {
                    brand: { ...site.brand, secondaryColor: e.target.value }
                })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={site.brand.theme}
                    onChange={(e) => updateSite(site.id, {
                      brand: { ...site.brand, theme: e.target.value as 'light' | 'dark' | 'auto' }
                  })}
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="auto">Auto</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  // Helper functions
  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'> = {
      active: 'success',
      inactive: 'default',
      maintenance: 'warning',
      building: 'info'
  };
    return colors[status] || 'default';
};

  const getSyncIcon = (status: string) => {
    switch (status) {
      case 'syncing':
        return <CircularProgress size={16} />;
      case 'success':
        return theming.getThemedIcon('checkCircle');
      case 'error':
        return theming.getThemedIcon('error');
      default: return <CloudSync />;
}
};

  return (
    <Card sx={{ height: '100%', ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: theming.colors.primary }}>
          <Domain color="primary" />
          Multi-Site Manager
        </Typography>

        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="Sites" />
          <Tab label="Workspaces" />
          <Tab label="Brands" />
        </Tabs>

        {activeTab === 0 && renderSites()}
        {activeTab === 1 && renderWorkspaces()}
        {activeTab === 2 && renderBrandManagement()}

        {/* Site Creation Dialog */}
        <Dialog open={showSiteDialog} onClose={() => setShowSiteDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Site</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site Name"
                  value={editingSite.name || ''}
                  onChange={(e) => setEditingSite(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Domain"
                  value={editingSite.domain || ''}
                  onChange={(e) => setEditingSite(prev => ({ ...prev, domain: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Site Type</InputLabel>
                  <Select
                    value={editingSite.type ||'development'}
                    onChange={(e) => setEditingSite(prev => ({ ...prev, type: e.target.value as 'production' | 'staging' | 'development' }))}
                  >
                    <MenuItem value="development">Development</MenuItem>
                    <MenuItem value="staging">Staging</MenuItem>
                    <MenuItem value="production">Production</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSiteDialog(false)}>Cancel</Button>
            <Button variant="contained" 
              onClick={() => {
                createSite(editingSite);
                setEditingSite({});
                setShowSiteDialog(false);
            }}
              sx={theming.getThemedButtonSx()}
            >
              Create Site
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MultiSiteManager;

