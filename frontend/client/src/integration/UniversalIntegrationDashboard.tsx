/**
 * Universal Integration Dashboard
 * Shows all 700+ integrated components and their connections
 * Provides real-time monitoring of the entire platform
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Stack,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Search,
  Refresh,
  Settings,
  Visibility,
  VisibilityOff,
  PlayArrow,
  Pause,
  Stop,
  FilterList,
  Sort,
  Info,
  Warning,
  Error,
  CheckCircle,
  Dashboard,
  Widgets,
  Pages,
  Edit,
  ShowChart,
  Chat,
  Storage,
  Security,
  Business,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store
} from '@mui/icons-material';
import { useIntegratedComponents } from './UniversalIntegrationSystem';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';

interface ComponentStatus {
  id: string;
  name: string;
  type: string;
  category: string;
  profession?: string;
  status: 'active' | 'inactive' | 'error' | 'loading';
  lastSeen: number;
  capabilities: string[];
  connections: number;
  messages: number;
  errors: number;
}

const UniversalIntegrationDashboard: React.FC = () => {
  const { 
    getAllComponents, 
    getComponentsByType, 
    getComponentsByCategory, 
    searchComponents,
    getComponentHealth,
    broadcastToAll,
    broadcastToType,
    broadcastToCategory
} = useIntegratedComponents();
  
	  const { integration, communication, dataFlow, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all, ');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  
	  const [components, setComponents] = useState<ComponentStatus[]>([]);
	  const [health, setHealth] = useState({ total: 0, active: 0, inactive: 0, error: 0 });

		  // Enhanced diagnostics from master integration (registry + feature coverage)
		  let debugInfo: any = null;
		  try {
		    debugInfo = debugging?.getDebugInfo?.();
		  } catch (error) {
		    console.error('Error getting integration debug info: ', error);
		  }

			  const missingPropsComponents = debugInfo?.registry?.missingPropsComponents ?? [];
			  const rawIntegrationGaps = debugInfo?.integrationGaps ?? null;
			  const autoIntegrationGaps = debugInfo?.autoIntegrationGaps ?? null;
			  const effectiveIntegrationGaps = autoIntegrationGaps || rawIntegrationGaps;
			  const missingPropsPreview = missingPropsComponents.slice(0, 10);
			  const totalMissingProps = missingPropsComponents.length;
			  const featureStatusList = Array.isArray(effectiveIntegrationGaps?.features)
			    ? effectiveIntegrationGaps.features
			    : [];
			  const mappedFeatureCount = featureStatusList.filter((f: any) => f?.status && f.status !== 'unmapped').length;
			  const unmappedFeatureCount =
			    featureStatusList.filter((f: any) => f?.status === 'unmapped').length ||
			    (effectiveIntegrationGaps?.unmappedMatrixFeatures?.length ?? 0);

			  // Focused view of Academy-related features with metadata & coverage
			  const academyFeatureStatusList = featureStatusList.filter((f: any) => {
			    const category = f?.metadata?.category;
			    if (category === 'Academy') return true;
			    const id = String(f?.featureId || ', ');
			    if (!id) return false;
			    return (
			      id.includes('academy') ||
			      id.includes('course') ||
			      id.includes('lesson') ||
			      id.includes('module') ||
			      id.includes('student')
			    );
			  });

			  const academyFeatureCounts = academyFeatureStatusList.reduce(
			    (acc: any, f: any) => {
			      if (f.status === 'implemented') acc.implemented += 1;
			      else if (f.status === 'partial') acc.partial += 1;
			      else if (f.status === 'missing') acc.missing += 1;
			      else acc.unmapped += 1;
			      return acc;
			    },
			    { implemented: 0, partial: 0, missing: 0, unmapped: 0 }
			  );

				  // Focused view of Accounting-related features (e.g. receipts, VAT, Fiken integration)
				  const accountingFeatureStatusList = featureStatusList.filter((f: any) => {
				    const category = f?.metadata?.category;
				    if (category === 'Accounting') return true;
				    const id = String(f?.featureId || ', ');
				    if (!id) return false;
				    return (
				      id.includes('accounting') ||
				      id.includes('receipt') ||
				      id.includes('vat') ||
				      id.includes('fiken')
				    );
				  });

				  const accountingFeatureCounts = accountingFeatureStatusList.reduce(
				    (acc: any, f: any) => {
				      if (f.status === 'implemented') acc.implemented += 1;
				      else if (f.status === 'partial') acc.partial += 1;
				      else if (f.status === 'missing') acc.missing += 1;
				      else acc.unmapped += 1;
				      return acc;
				    },
				    { implemented: 0, partial: 0, missing: 0, unmapped: 0 }
				  );

  // Load components data
  const loadComponents = async () => {
    setIsRefreshing(true);
    try {
      const allComponents = getAllComponents();
      const healthData = getComponentHealth();
      
      const componentStatuses: ComponentStatus[] = allComponents.map((comp: any) => ({
        id: comp.id,
        name: comp.name,
        type: comp.type,
        category: comp.category,
        profession: comp.profession,
        status: comp.status,
        lastSeen: comp.lastSeen,
        capabilities: comp.capabilities,
        connections: Math.floor(Math.random() * 10), // Mock data
        messages: Math.floor(Math.random() * 100),
        errors: Math.floor(Math.random() * 5)
    }));
      
      setComponents(componentStatuses);
      setHealth(healthData);
  } catch (error) {
      console.error('Error loading components:', error);
  } finally {
      setIsRefreshing(false);
  }
};

  // Load components on mount
  useEffect(() => {
    loadComponents();
}, []);

  // Set up real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      loadComponents();
  }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
}, [realTimeUpdates]);

  // Filter and sort components
  const filteredComponents = components
    .filter(comp => {
      if (!showInactive && comp.status === 'inactive') return false;
      if (filterType !== 'all' && comp.type !== filterType) return false;
      if (filterCategory !== 'all' && comp.category !== filterCategory) return false;
      if (searchQuery && !comp.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
  })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'type': return a.type.localeCompare(b.type);
        case 'category': return a.category.localeCompare(b.category);
        case 'status': return a.status.localeCompare(b.status);
        case 'lastSeen': return b.lastSeen - a.lastSeen;
        default: return 0;
    }
  });

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle color="success" />;
      case 'inactive': return <Pause color="warning" />;
      case 'error': return <Error color="error" />;
      case 'loading': return <CircularProgress size={20} />;
      default: return <Info color="info" />;
	  }
	};

	  const toTitleCase = (id: string) =>
	    String(id)
	      .replace(/-/g , ', ')
	      .replace(/\s+/g, ', ')
	      .trim()
	      .replace(/\b\w/g, (c) => c.toUpperCase());

	  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dashboard': return <Dashboard />;
      case 'widget': return <Widgets />;
      case 'page': return <Pages />;
      case 'editor': return <Edit />;
      case 'chart': return <ShowChart />;
      case 'chat': return <Chat />;
      case 'storage': return <Storage />;
      case 'security': return <Security />;
      case 'business': return <Business />;
      case 'photography': return <PhotoCamera />;
      case 'videography': return <Videocam />;
      case 'music': return <LibraryMusic />;
      case 'vendor': return <Store />;
      default: return <Widgets />;
  }
};

  // Handle component selection
  const handleComponentSelect = (component: ComponentStatus) => {
    setSelectedComponent(component);
};

  // Handle broadcast to all components
  const handleBroadcastToAll = () => {
    broadcastToAll('test: message', { 
      message: 'Test message from Universal Integration Dashboard',
      timestamp: Date.now()
  });
};

  // Handle broadcast to component type
  const handleBroadcastToType = (type: string) => {
    broadcastToType(type, 'test: message', {
      message: `Test message for ${type} components`,
      timestamp: Date.now()
  });
};

  // Handle broadcast to category
  const handleBroadcastToCategory = (category: string) => {
    broadcastToCategory(category, 'test: message', {
      message: `Test message for ${category} components`,
      timestamp: Date.now()
  });
};

	  const componentNameById = new Map<string, string>();
	  components.forEach((c) => {
	    componentNameById.set(c.id, c.name || c.id);
	  });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Universal Integration Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary" gutterBottom>
          Monitor and control all {health.total} integrated components across the platform
        </Typography>
        
        {/* Health Overview */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Total Components</Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>{health.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Active</Typography>
                <Typography variant="h4" color="success.main">{health.active}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Inactive</Typography>
                <Typography variant="h4" color="warning.main">{health.inactive}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Errors</Typography>
                <Typography variant="h4" color="error.main">{health.error}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
	
	        {debugInfo && (
	          <Alert severity="info" sx={{ mb: 3 }}>
	            <Stack direction="row" spacing={2} flexWrap="wrap">
	              <Typography variant="body2">
	                Components missing props: <strong>{totalMissingProps}</strong>
	              </Typography>
	              <Typography variant="body2">
	                Mapped features: <strong>{mappedFeatureCount}</strong>
	              </Typography>
	              <Typography variant="body2">
	                Matrix features without mappings: <strong>{unmappedFeatureCount}</strong>
	              </Typography>
	            </Stack>
	          </Alert>
	        )}
	
	        {totalMissingProps > 0 && (
	          <Paper sx={{ p: 2, mb: 3 }}>
	            <Typography
	              variant="h6"
	              gutterBottom
	              sx={{ color: theming.colors.primary }}
	            >
	              Components missing prop metadata ({totalMissingProps})
	            </Typography>
	            <List dense>
	              {missingPropsPreview.map((comp: any) => (
	                <ListItem key={comp.id}>
	                  <ListItemText
	                    primary={comp.name || comp.id}
	                    secondary={`${comp.type || 'component'}  ${comp.category || 'uncategorized'}`}
	                  />
	                </ListItem>
	              ))}
	            </List>
	            {totalMissingProps > missingPropsPreview.length && (
	              <Typography variant="caption" color="textSecondary">
	                Showing first {missingPropsPreview.length} of {totalMissingProps} components missing props.
	              </Typography>
	            )}
	          </Paper>
	        )}
			
		        {academyFeatureStatusList.length > 0 && (
		          <Paper sx={{ p: 2, mb: 3 }}>
		            <Typography
		              variant="h6"
		              gutterBottom
		              sx={{ color: theming.colors.primary }}
		            >
		              Academy feature coverage
		            </Typography>
		            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
		              Shows which Academy features are available, their implementation status, and which components implement them.
		            </Typography>
		            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
		              <Chip size="small" label={`Total: ${academyFeatureStatusList.length}`} />
		              <Chip size="small" color="success" label={`Implemented: ${academyFeatureCounts.implemented}`} />
		              <Chip size="small" color="warning" label={`Partial: ${academyFeatureCounts.partial}`} />
		              <Chip size="small" color="error" label={`Missing: ${academyFeatureCounts.missing}`} />
		              <Chip size="small" variant="outlined" label={`Unmapped: ${academyFeatureCounts.unmapped}`} />
		            </Stack>
		            <List dense>
		              {academyFeatureStatusList
		                .slice()
		                .sort((a: any, b: any) => String(a.featureId).localeCompare(String(b.featureId)))
		                .slice(0, 25)
		                .map((f: any) => {
		                  const featureId = String(f.featureId);
		                  const metadata = f.metadata as any;
		                  const baseNameId = metadata?.aliasOf || featureId;
		                  const name = toTitleCase(baseNameId);
		                  const description = metadata?.description || 'No description available yet.';
		                  const statusColor =
		                    f.status === 'implemented'
		                      ? 'success'
		                      : f.status === 'partial'
		                      ? 'warning'
		                      : f.status === 'missing'
		                      ? 'error'
		                      : 'default';
		                  const componentNames = (f.mappedComponentIds || []).map((id: string) =>
		                    componentNameById.get(id) || id
		                  );
		
		                  return (
		                    <ListItem key={featureId} alignItems="flex-start">
		                      <ListItemText
		                        primary={
		                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
		                            <Chip size="small" color={statusColor as any} label={f.status} />
		                            <Typography variant="subtitle2">{name}</Typography>
		                          </Box>
		                        }
		                        secondary={
		                          <>
		                            <Typography variant="body2" color="textSecondary">
		                              {description}
		                            </Typography>
		                            {componentNames.length > 0 && (
		                              <Typography variant="caption" color="textSecondary">
		                                Implemented by: {componentNames.join('')}
		                              </Typography>
		                            )}
		                          </>
		                        }
		                      />
		                    </ListItem>
		                  );
		                })}
		            </List>
		            {academyFeatureStatusList.length > 25 && (
		              <Typography variant="caption" color="textSecondary">
		                Showing first 25 Academy features out of {academyFeatureStatusList.length}.
		              </Typography>
		            )}
		          </Paper>
		        )}
		
		        {accountingFeatureStatusList.length > 0 && (
		          <Paper sx={{ p: 2, mb: 3 }}>
		            <Typography
		              variant="h6"
		              gutterBottom
		              sx={{ color: theming.colors.primary }}
		            >
		              Accounting feature coverage
		            </Typography>
		            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
		              Shows which accounting features (e.g. receipt capture, registration, VAT handling, Fiken
		              integration) are available, their implementation status, and which components implement them.
		            </Typography>
		            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
		              <Chip size="small" label={`Total: ${accountingFeatureStatusList.length}`} />
		              <Chip
		                size="small"
		                color="success"
		                label={`Implemented: ${accountingFeatureCounts.implemented}`}
		              />
		              <Chip
		                size="small"
		                color="warning"
		                label={`Partial: ${accountingFeatureCounts.partial}`}
		              />
		              <Chip
		                size="small"
		                color="error"
		                label={`Missing: ${accountingFeatureCounts.missing}`}
		              />
		              <Chip
		                size="small"
		                variant="outlined"
		                label={`Unmapped: ${accountingFeatureCounts.unmapped}`}
		              />
		            </Stack>
		            <List dense>
		              {accountingFeatureStatusList
		                .slice()
		                .sort((a: any, b: any) => String(a.featureId).localeCompare(String(b.featureId)))
		                .slice(0, 25)
		                .map((f: any) => {
		                  const featureId = String(f.featureId);
		                  const metadata = f.metadata as any;
		                  const baseNameId = metadata?.aliasOf || featureId;
		                  const name = toTitleCase(baseNameId);
		                  const description = metadata?.description || 'No description available yet.';
		                  const statusColor =
		                    f.status === 'implemented'
		                      ? 'success'
		                      : f.status === 'partial'
		                      ? 'warning'
		                      : f.status === 'missing'
		                      ? 'error'
		                      : 'default';
		                  const componentNames = (f.mappedComponentIds || []).map((id: string) =>
		                    componentNameById.get(id) || id
		                  );
		
		                  return (
		                    <ListItem key={featureId} alignItems="flex-start">
		                      <ListItemText
		                        primary={
		                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
		                            <Chip size="small" color={statusColor as any} label={f.status} />
		                            <Typography variant="subtitle2">{name}</Typography>
		                          </Box>
		                        }
		                        secondary={
		                          <>
		                            <Typography variant="body2" color="textSecondary">
		                              {description}
		                            </Typography>
		                            {componentNames.length > 0 && (
		                              <Typography variant="caption" color="textSecondary">
		                                Implemented by: {componentNames.join('')}
		                              </Typography>
		                            )}
		                          </>
		                        }
		                      />
		                    </ListItem>
		                  );
		                })}
		            </List>
		            {accountingFeatureStatusList.length > 25 && (
		              <Typography variant="caption" color="textSecondary">
		                Showing first 25 accounting features out of {accountingFeatureStatusList.length}.
		              </Typography>
		            )}
		          </Paper>
		        )}
		
		        {/* Controls */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
              }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                select
                label="Type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="all">All Types</option>
                <option value="dashboard">Dashboard</option>
                <option value="widget">Widget</option>
                <option value="page">Page</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                select
                label="Category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="all">All Categories</option>
                <option value="administration">Administration</option>
                <option value="analytics">Analytics</option>
                <option value="communication">Communication</option>
                <option value="equipment">Equipment</option>
                <option value="project">Project</option>
                <option value="showcase">Showcase</option>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={isRefreshing ? <CircularProgress size={20} /> : <Refresh />}
                onClick={loadComponents}
                disabled={isRefreshing}
              >
                Refresh
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant={realTimeUpdates ? "contained" : "outlined"}
                startIcon={realTimeUpdates ? <Pause /> : <PlayArrow />}
                onClick={() => setRealTimeUpdates(!realTimeUpdates)}
              >
                {realTimeUpdates ? 'Pause' : 'Resume'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
            <Tab label={`All Components (${filteredComponents.length})`} />
            <Tab label={`Active (${health.active})`} />
            <Tab label={`Inactive (${health.inactive})`} />
            <Tab label={`Errors (${health.error})`} />
          </Tabs>
        </Box>

        {/* Components Grid */}
        <Grid container spacing={2}>
          {filteredComponents.map((component) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={component.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { boxShadow: 4 },
                  border: component.status === 'error' ? 2 : 0,
                  borderColor: component.status === 'error' ? 'error.main' : 'transparent'
              }}
                onClick={() => handleComponentSelect(component)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {getTypeIcon(component.type)}
                    <Box sx={{ ml: 1, flexGrow: 1 }}>
                      <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                        {component.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {component.type} • {component.category}
                      </Typography>
                    </Box>
                    {getStatusIcon(component.status)}
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Chip 
                      label={component.status} 
                      size="small" 
                      color={component.status === 'active' ? 'success' : component.status === 'error' ? 'error' : 'warning'}
                    />
                    {component.profession && (
                      <Chip 
                        label={component.profession} 
                        size="small" 
                        variant="outlined" 
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Capabilities: {component.capabilities.length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Connections: {component.connections}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Messages: {component.messages}
                    </Typography>
                  </Box>

                  <LinearProgress 
                    variant="determinate" 
                    value={(component.connections / 10) * 100} 
                    sx={{ mb: 1 }}
                  />
                </CardContent>
                
                <CardActions>
                  <Button size="small" onClick={() => handleComponentSelect(component)}>
                    View Details
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => handleBroadcastToType(component.type)}
                  >
                    Test
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Component Details Dialog */}
        <Dialog 
          open={!!selectedComponent} 
          onClose={() => setSelectedComponent(null)}
          maxWidth="md"
          fullWidth
        >
          {selectedComponent && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getTypeIcon(selectedComponent.type)}
                  <Box sx={{ ml: 1 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedComponent.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedComponent.type} • {selectedComponent.category}
                    </Typography>
                  </Box>
                </Box>
              </DialogTitle>
              
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Status</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {getStatusIcon(selectedComponent.status)}
                      <Typography sx={{ ml: 1 }}>{selectedComponent.status}</Typography>
                    </Box>
                    
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Capabilities</Typography>
                    <Box sx={{ display: 'flex', flexWrap:'wrap', gap: 1, mb: 2 }}>
                      {selectedComponent.capabilities.map((capability) => (
                        <Chip key={capability} label={capability} size="small" />
                      ))}
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Statistics</Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText primary="Connections" secondary={selectedComponent.connections} />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="Messages" secondary={selectedComponent.messages} />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="Errors" secondary={selectedComponent.errors} />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Last Seen" 
                          secondary={new Date(selectedComponent.lastSeen).toLocaleString()} 
                        />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </DialogContent>
              
              <DialogActions>
                <Button onClick={() => setSelectedComponent(null)}>Close</Button>
                <Button variant="contained" 
                  onClick={() => handleBroadcastToType(selectedComponent.type)}
                >
                  Send Test Message
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </Container>
  );
};

export default UniversalIntegrationDashboard;




