/**
 * Visual Editor Dashboard Example
 * Demonstrates how all dashboard components communicate through the shared context
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert
} from '@mui/material';
import {
  Dashboard,
  Template,
  Group,
  Analytics,
  CloudSync,
  Animation,
  Design,
  Plugin,
  Export,
  VersionControl,
  Workflow,
  AI,
  ML,
  Revenue,
  Client,
  System,
  Monitor,
  Audit
} from '@mui/icons-material';

import { useVisualEditor } from './VisualEditorContext';

// Import all dashboard components
import TemplateDashboard from './TemplateDashboard';
import TeamCollaborationDashboard from './TeamCollaborationDashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import CloudSyncDashboard from './CloudSyncDashboard';
import AnimationDashboard from './AnimationDashboard';
import DesignSystemDashboard from './DesignSystemDashboard';
import PluginDashboard from './PluginDashboard';
import ExportDashboard from './ExportDashboard';
import VersionControlDashboard from './VersionControlDashboard';
import WorkflowAutomationDashboard from './WorkflowAutomationDashboard';
import AIIntegrationDashboard from './AIIntegrationDashboard';
import MLOptimizationDashboard from './MLOptimizationDashboard';
import RevenueOptimizationDashboard from './RevenueOptimizationDashboard';
import ClientCommunicationDashboard from './ClientCommunicationDashboard';
import SystemManagementDashboard from './SystemManagementDashboard';
import MonitoringDashboard from './MonitoringDashboard';
import AuditDashboard from './AuditDashboard';

const VisualEditorDashboardExample: React.FC = (
  // Theming system
  const theming = useTheming('prototype_tester');) => {
  const {
    state,
    addElement,
    updateElement,
    deleteElement,
    selectElement,
    addNotification,
    setActiveTab,
    loadProject,
    saveProject,
    createTemplate,
    loadTemplate
} = useVisualEditor();

  const [activeDashboard, setActiveDashboard] = useState<string>('overview');

  // Dashboard configurations
  const dashboards = [
    { id: 'overview', name: 'Overview', icon: <Dashboard />, component: null },
    { id: 'templates', name: 'Templates', icon: <Template />, component: TemplateDashboard },
    { id: 'collaboration', name: 'Team Collaboration', icon: theming.getThemedIcon(', '), component: TeamCollaborationDashboard },
    { id: 'analytics', name: 'Analytics', icon: theming.getThemedIcon(', '), component: AnalyticsDashboard },
    { id: 'cloudsync', name: 'Cloud Sync', icon: <CloudSync />, component: CloudSyncDashboard },
    { id: 'animation', name: 'Animation', icon: <Animation />, component: AnimationDashboard },
    { id: 'design', name: 'Design System', icon: <Design />, component: DesignSystemDashboard },
    { id: 'plugins', name: 'Plugins', icon: <Plugin />, component: PluginDashboard },
    { id: 'export', name: 'Export', icon: <Export />, component: ExportDashboard },
    { id: 'version', name: 'Version Control', icon: <VersionControl />, component: VersionControlDashboard },
    { id: 'workflow', name: 'Workflow', icon: <Workflow />, component: WorkflowAutomationDashboard },
    { id: 'ai', name: 'AI Integration', icon: <AI />, component: AIIntegrationDashboard },
    { id: 'ml', name: 'ML Optimization', icon: <ML />, component: MLOptimizationDashboard },
    { id: 'revenue', name: 'Revenue', icon: <Revenue />, component: RevenueOptimizationDashboard },
    { id: 'client', name: 'Client Communication', icon: <Client />, component: ClientCommunicationDashboard },
    { id: 'system', name: 'System Management', icon: <System />, component: SystemManagementDashboard },
    { id: 'monitor', name: 'Monitoring', icon: <Monitor />, component: MonitoringDashboard },
    { id: 'audit', name: 'Audit', icon: <Audit />, component: AuditDashboard }
  ];

  const handleDashboardClick = (dashboardId: string) => {
    setActiveDashboard(dashboardId);
    setActiveTab(dashboardId);
    
    addNotification({
      type: 'info',
      title: 'Dashboard Switched',
      message: `Switched to ${dashboards.find(d => d.id === dashboardId)?.name} dashboard`
  });
};

  const handleCreateElement = (type: string) => {
    const newElement = {
      type: type as any,
      x: Math.random() * 40,
      y: Math.random() * 30,
      width: 10,
      height:  50,
      styles: {
        backgroundColor: '#1976d0',
        color: 'white',
        borderRadius: '4px',
        padding: '8px'
  },
      props:  , {}
  };
    
    addElement(newElement);
    
    addNotification({
      type: 'success',
      title: 'Element Created',
      message: `${type} element has been added to the canvas`
  });
};

  const handleCreateTemplate = () => {
    const templateData = {
      name: 'Sample Template',
      description: 'A sample template created from current elements',
      category: 'project' as const,
      elements: state.elements,
      tags: ['sample', 'demo']
  };
    
    createTemplate(templateData);
    
    addNotification({
      type: 'success',
      title: 'Template Created',
      message: 'Template has been created from current elements'
});
};

  const renderActiveDashboard = () => {
    const dashboard = dashboards.find(d => d.id === activeDashboard);
    if (!dashboard || !dashboard.component) {
      return (
        <Box sx={{ p:  3 }}>
          <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
            Visual Editor Dashboard Overview
          </Typography>
          
          <Alert severity="info" sx={{ mb:  3 }}>
            This is the main overview dashboard. All other dashboards are connected through the shared context.
            Changes in one dashboard will be reflected in all others.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Current State
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Selected Element" 
                        secondary={state.selectedElement || 'None'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Total Elements" 
                        secondary={state.elements.length.toString()} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Templates" 
                        secondary={state.templates.length.toString()} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Active Tab" 
                        secondary={state.activeTab} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Notifications" 
                        secondary={state.notifications.length.toString()} 
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    <Button 
                      variant="outlined" 
                      onClick={() => handleCreateElement('button')}
                      fullWidth
                    >
                      Add Button
                    </Button>
                    <Button 
                      variant="outlined" 
                      onClick={() => handleCreateElement('text')}
                      fullWidth
                    >
                      Add Text
                    </Button>
                    <Button 
                      variant="outlined" 
                      onClick={() => handleCreateElement('image')}
                      fullWidth
                    >
                      Add Image
                    </Button>
                    <Button variant="contained" 
                      onClick={handleCreateTemplate}
                      fullWidth
                     sx={theming.getThemedButtonSx()}>
                      Create Template
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Recent Notifications
                  </Typography>
                  {state.notifications.length === 0 ? (
                    <Typography color="text.secondary">
                      No notifications yet
                    </Typography>
                  ) : (
                    <List dense>
                      {state.notifications.slice(-5).map((notification) => (
                        <ListItem key={notification.id}>
                          <ListItemText
                            primary={notification.title}
                            secondary={notification.message}
                          />
                          <Chip 
                            label={notification.type} 
                            size="small" 
                            color={notification.type === 'error' ? 'error' : 
                                   notification.type === 'success' ? 'success' : 
                                   notification.type === 'warning' ? 'warning' : 'default'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      );
  }

    const DashboardComponent = dashboard.component;
    return <DashboardComponent />;
};

  return (
    <Box sx={{ display: 'flex', height: '100vh'}}>
      {/* Sidebar */}
      <Paper sx={{ width: 20, p: 2, overflow: 'auto',  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Dashboards
        </Typography>
        <List dense>
          {dashboards.map((dashboard) => (
            <ListItem 
              key={dashboard.id}
              button
              selected={activeDashboard === dashboard.id}
              onClick={() => handleDashboardClick(dashboard.id)}
            >
              <ListItemText 
                primary={dashboard.name}
                icon={dashboard.icon}
              />
            </ListItem>
          ))}
        </List>
        
        <Divider sx={{ my:  2 }} />
        
        <Typography variant="subtitle2" gutterBottom>
          Context Status
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
          <Chip label={`${state.elements.length} Elements`} size="small" />
          <Chip label={`${state.templates.length} Templates`} size="small" />
          <Chip label={`${state.notifications.length} Notifications`} size="small" />
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto'}}>
        {renderActiveDashboard()}
      </Box>
    </Box>
  );
};

export default VisualEditorDashboardExample;




