/**
 * PluginDashboard Component
 * Plugin system dashboard with management and monitoring
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  Tooltip, 
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import {
  Extension,
  Settings,
  CheckCircle,
  Error,
  Warning,
  KeyboardArrowDown
} from '@mui/icons-material';
import { usePlugins, UsePluginsOptions } from '../../../hooks/usePlugins';
import { PluginConfig, Plugin, PluginHook, PluginComponent, PluginUtility, PluginTheme, PluginIntegration } from '../../../utils/pluginManager';

interface PluginDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showHooks?: boolean;
  showComponents?: boolean;
  showUtilities?: boolean;
  showThemes?: boolean;
  showIntegrations?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onHooksClick?: () => void;
  onComponentsClick?: () => void;
  onUtilitiesClick?: () => void;
  onThemesClick?: () => void;
  onIntegrationsClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const PluginDashboard: React.FC<PluginDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showHooks = true,
  showComponents = true,
  showUtilities = true,
  showThemes = true,
  showIntegrations = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onHooksClick,
  onComponentsClick,
  onUtilitiesClick,
  onThemesClick,
  onIntegrationsClick,
  className,
  style
}) => {
  const [showPluginDialog, setShowPluginDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showHooksDialog, setShowHooksDialog] = useState(false);
  const [showComponentsDialog, setShowComponentsDialog] = useState(false);
  const [showUtilitiesDialog, setShowUtilitiesDialog] = useState(false);
  const [showThemesDialog, setShowThemesDialog] = useState(false);
  const [showIntegrationsDialog, setShowIntegrationsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  // Plugin options
  const pluginOptions: UsePluginsOptions = useMemo(() => ({
    onPluginInstalled: (data: { plugin: Plugin }) => {
      // Handle plugin installed
  },
    onPluginRemoved: (data: { plugin: Plugin }) => {
      // Handle plugin removed
  },
    onPluginLoaded: (data: { plugin: Plugin }) => {
      // Handle plugin loaded
  },
    onPluginUnloaded: (data: { plugin: Plugin }) => {
      // Handle plugin unloaded
  },
    onPluginEnabled: (data: { plugin: Plugin }) => {
      // Handle plugin enabled
  },
    onPluginDisabled: (data: { plugin: Plugin }) => {
      // Handle plugin disabled
  },
    onPluginInstallFailed: (data: { plugin: Plugin; error: string }) => {
      console.error('Plugin install failed:', data.error);
  },
    onPluginRemoveFailed: (data: { plugin: Plugin; error: string }) => {
      console.error('Plugin remove failed:', data.error);
  },
    onPluginLoadFailed: (data: { plugin: Plugin; error: string }) => {
      console.error('Plugin load failed:', data.error);
  },
    onPluginUnloadFailed: (data: { plugin: Plugin; error: string }) => {
      console.error('Plugin unload failed:', data.error);
  },
    onError: (error: string) => {
      console.error('Plugin error:', error);
  },
    onInitialized: () => {
      // Handle initialized
}
}), []);

  // Use plugins hook
  const {
    installPlugin,
    removePlugin,
    loadPlugin,
    unloadPlugin,
    enablePlugin,
    disablePlugin,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    plugins,
    activePlugins,
    hooks,
    components,
    utilities,
    themes,
    integrations,
    totalPlugins,
    activePluginsCount,
    loadingPluginsCount,
    errorPluginsCount,
    disabledPluginsCount,
    totalHooks,
    totalComponents,
    totalUtilities,
    totalThemes,
    totalIntegrations,
    averageLoadTime,
    averageRenderTime,
    averageExecutionTime,
    averageMemoryUsage,
    averageCpuUsage,
    totalErrors,
    totalUsage
} = usePlugins(pluginOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle management click
  const handleManagementClick = useCallback(() => {
    if (onManagementClick) {
      onManagementClick();
  } else {
      setShowManagementDialog(true);
  }
}, [onManagementClick]);

  // Handle monitoring click
  const handleMonitoringClick = useCallback(() => {
    if (onMonitoringClick) {
      onMonitoringClick();
  } else {
      setShowMonitoringDialog(true);
  }
}, [onMonitoringClick]);

  // Handle hooks click
  const handleHooksClick = useCallback(() => {
    if (onHooksClick) {
      onHooksClick();
  } else {
      setShowHooksDialog(true);
  }
}, [onHooksClick]);

  // Handle components click
  const handleComponentsClick = useCallback(() => {
    if (onComponentsClick) {
      onComponentsClick();
  } else {
      setShowComponentsDialog(true);
  }
}, [onComponentsClick]);

  // Handle utilities click
  const handleUtilitiesClick = useCallback(() => {
    if (onUtilitiesClick) {
      onUtilitiesClick();
  } else {
      setShowUtilitiesDialog(true);
  }
}, [onUtilitiesClick]);

  // Handle themes click
  const handleThemesClick = useCallback(() => {
    if (onThemesClick) {
      onThemesClick();
  } else {
      setShowThemesDialog(true);
  }
}, [onThemesClick]);

  // Handle integrations click
  const handleIntegrationsClick = useCallback(() => {
    if (onIntegrationsClick) {
      onIntegrationsClick();
  } else {
      setShowIntegrationsDialog(true);
  }
}, [onIntegrationsClick]);

  // Handle install plugin
  const handleInstallPlugin = useCallback(async () => {
    try {
      const pluginData: Partial<Plugin> = {
        name: 'Sample Plugin',
        version: '1.0.0',
        description: 'A sample plugin for testing',
        author: 'Sample Author',
        license: 'MI',
        category: 'utility',
        type: 'utility',
        permissions: ['read', 'write'],
        hooks:  [],
        components:  [],
        utilities:  [],
        themes:  [],
        integrations: []
  };
      await installPlugin(pluginData);
  } catch (error) {
      console.error('Failed to install plugin:', error);
  }
}, [installPlugin]);

  // Handle remove plugin
  const handleRemovePlugin = useCallback(async (pluginId: string) => {
    try {
      await removePlugin(pluginId);
} catch (error) {
      console.error('Failed to remove plugin:', error);
  }
}, [removePlugin]);

  // Handle enable plugin
  const handleEnablePlugin = useCallback(async (pluginId: string) => {
    try {
      await enablePlugin(pluginId);
} catch (error) {
      console.error('Failed to enable plugin:', error);
  }
}, [enablePlugin]);

  // Handle disable plugin
  const handleDisablePlugin = useCallback(async (pluginId: string) => {
    try {
      await disablePlugin(pluginId);
} catch (error) {
      console.error('Failed to disable plugin:', error);
  }
}, [disablePlugin]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <Extension />;
    return theming.getThemedIcon('warning');
}, [hasError, isInitialized, isEnabled]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Disabled';
}, [hasError, isInitialized, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,  };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Plugins: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalPlugins}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowPluginDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ ...theming.getThemedCardSx(), p: 1, minWidth: 200 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowPluginDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {totalPlugins} plugins
          </Typography>
          {activePluginsCount > 0 && (
            <Typography variant="caption" color="success.main" sx={{ ml:  1 }}>
              {activePluginsCount} active
            </Typography>
          )}
          {errorPluginsCount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {errorPluginsCount} errors
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 2, minWidth: 300 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Extension color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Plugins
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleInstallPlugin}
            variant="outlined"
            size="small"
          >
            Install
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Plugins
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalPlugins}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Active
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {activePluginsCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Errors
                    </Typography>
                    <Typography variant="h4" color={errorPluginsCount > 0 ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                      {errorPluginsCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
      </Grid>
      
      {totalUsage > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Total usage: {totalUsage} times
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Plugin Dialog */}
      <Dialog open={showPluginDialog} onClose={() => setShowPluginDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Extension />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Plugin Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Management" />
            <Tab label="Monitoring" />
            <Tab label="Hooks" />
            <Tab label="Components" />
            <Tab label="Utilities" />
            <Tab label="Themes" />
            <Tab label="Integrations" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Plugins
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalPlugins}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Active
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {activePluginsCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Errors
                    </Typography>
                    <Typography variant="h4" color={errorPluginsCount > 0 ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                      {errorPluginsCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Management
              </Typography>
              <List>
                {plugins.map((plugin) => (
                  <ListItem key={plugin.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Extension />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={plugin.name}
                      secondary={`${plugin.version} • ${plugin.author} • ${plugin.status}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => handleEnablePlugin(plugin.id)}
                          disabled={plugin.status === 'active'}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          Enable
                        </Button>
                        <Button
                          onClick={() => handleDisablePlugin(plugin.id)}
                          disabled={plugin.status === 'inactive'}
                          startIcon={theming.getThemedIcon('stop')}
                        >
                          Disable
                        </Button>
                        <Button
                          onClick={() => handleRemovePlugin(plugin.id)}
                          startIcon={theming.getThemedIcon('delete')}
                          color="error"
                        >
                          Remove
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Average Load Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageLoadTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Average Render Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageRenderTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Average Memory Usage
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageMemoryUsage.toFixed(2)}MB
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Usage
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {totalUsage}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Hooks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total hooks: {totalHooks}
              </Typography>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Components
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total components: {totalComponents}
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Utilities
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total utilities: {totalUtilities}
              </Typography>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Themes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total themes: {totalThemes}
              </Typography>
            </Box>
          )}
          
          {activeTab === 7 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Plugin Integrations
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total integrations: {totalIntegrations}
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowPluginDialog(false)}>
            Close
          </Button>
          <Button
            onClick={handleInstallPlugin}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            sx={theming.getThemedButtonSx()}
          >
            Install Plugin
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Plugin Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePlugins}
                    onChange={(e) => updateConfig({ enablePlugins: e.target.checked })}
                  />
              }
                label="Enable Plugins"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableHotReload}
                    onChange={(e) => updateConfig({ enableHotReload: e.target.checked })}
                  />
              }
                label="Enable Hot Reload"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSandboxing}
                    onChange={(e) => updateConfig({ enableSandboxing: e.target.checked })}
                  />
              }
                label="Enable Sandboxing"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePermissions}
                    onChange={(e) => updateConfig({ enablePermissions: e.target.checked })}
                  />
              }
                label="Enable Permissions"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableValidation}
                    onChange={(e) => updateConfig({ enableValidation: e.target.checked })}
                  />
              }
                label="Enable Validation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCaching}
                    onChange={(e) => updateConfig({ enableCaching: e.target.checked })}
                  />
              }
                label="Enable Caching"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableVersioning}
                    onChange={(e) => updateConfig({ enableVersioning: e.target.checked })}
                  />
              }
                label="Enable Versioning"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBackup}
                    onChange={(e) => updateConfig({ enableBackup: e.target.checked })}
                  />
              }
                label="Enable Backup"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLogging}
                    onChange={(e) => updateConfig({ enableLogging: e.target.checked })}
                  />
              }
                label="Enable Logging"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableMetrics}
                    onChange={(e) => updateConfig({ enableMetrics: e.target.checked })}
                  />
              }
                label="Enable Metrics"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

PluginDashboard.displayName ='PluginDashboard';

export default PluginDashboard;
