/**
 * Visual Editor Dashboard Example
 * Demonstrates dashboard navigation over the shared visual-editor context.
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useMemo, useState } from 'react';
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
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Stack,
} from '@mui/material';
import {
  Dashboard,
  Description as Template,
  Group,
  Analytics,
  CloudSync,
  Animation,
  Brush as Design,
  Extension as Plugin,
  FileDownload as Export,
  History as VersionControl,
  AccountTree as Workflow,
  AutoAwesome as AI,
  ModelTraining as ML,
  AttachMoney as Revenue,
  Person as Client,
  SettingsApplications as System,
  Monitor,
  FactCheck as Audit,
} from '@mui/icons-material';

import { useVisualEditor } from './VisualEditorContext';

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

type DashboardEntry = {
  id: string;
  name: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
};

const VisualEditorDashboardExample: React.FC = () => {
  const theming = useTheming('prototype_tester');
  const { state, addElement, addNotification, setActiveTab, createTemplate } = useVisualEditor();
  const [activeDashboard, setActiveDashboard] = useState<string>('overview');
  const noop = () => undefined;

  const dashboards = useMemo<DashboardEntry[]>(
    () => [
      { id: 'overview', name: 'Overview', icon: <Dashboard />, render: () => null },
      { id: 'templates', name: 'Templates', icon: <Template />, render: () => <TemplateDashboard /> },
      {
        id: 'collaboration',
        name: 'Team Collaboration',
        icon: <Group />,
        render: () => (
          <TeamCollaborationDashboard
            onSettingsClick={noop}
            onMembersClick={noop}
            onWorkloadClick={noop}
            onSessionsClick={noop}
            onMobileClick={noop}
            onAnalyticsClick={noop}
          />
        ),
      },
      { id: 'analytics', name: 'Analytics', icon: <Analytics />, render: () => <AnalyticsDashboard /> },
      { id: 'cloudsync', name: 'Cloud Sync', icon: <CloudSync />, render: () => <CloudSyncDashboard /> },
      { id: 'animation', name: 'Animation', icon: <Animation />, render: () => <AnimationDashboard /> },
      { id: 'design', name: 'Design System', icon: <Design />, render: () => <DesignSystemDashboard /> },
      { id: 'plugins', name: 'Plugins', icon: <Plugin />, render: () => <PluginDashboard /> },
      { id: 'export', name: 'Export', icon: <Export />, render: () => <ExportDashboard /> },
      {
        id: 'version',
        name: 'Version Control',
        icon: <VersionControl />,
        render: () => <VersionControlDashboard />,
      },
      {
        id: 'workflow',
        name: 'Workflow',
        icon: <Workflow />,
        render: () => <WorkflowAutomationDashboard />,
      },
      { id: 'ai', name: 'AI Integration', icon: <AI />, render: () => <AIIntegrationDashboard /> },
      {
        id: 'ml',
        name: 'ML Optimization',
        icon: <ML />,
        render: () => (
          <MLOptimizationDashboard
            onSettingsClick={noop}
            onModelsClick={noop}
            onPredictionsClick={noop}
            onOptimizationsClick={noop}
            onAnalyticsClick={noop}
            onTrainingClick={noop}
          />
        ),
      },
      {
        id: 'revenue',
        name: 'Revenue',
        icon: <Revenue />,
        render: () => (
          <RevenueOptimizationDashboard
            onSettingsClick={noop}
            onPricingClick={noop}
            onUpsellingClick={noop}
            onForecastingClick={noop}
            onAnalysisClick={noop}
            onMarketRatesClick={noop}
          />
        ),
      },
      {
        id: 'client',
        name: 'Client Communication',
        icon: <Client />,
        render: () => (
          <ClientCommunicationDashboard
            onSettingsClick={noop}
            onTemplatesClick={noop}
            onSegmentsClick={noop}
            onAutomationClick={noop}
            onAnalyticsClick={noop}
            onDeadlinesClick={noop}
          />
        ),
      },
      {
        id: 'system',
        name: 'System Management',
        icon: <System />,
        render: () => <SystemManagementDashboard />,
      },
      { id: 'monitor', name: 'Monitoring', icon: <Monitor />, render: () => <MonitoringDashboard /> },
      { id: 'audit', name: 'Audit', icon: <Audit />, render: () => <AuditDashboard /> },
    ],
    [],
  );

  const elementCount = useMemo(() => {
    if (Array.isArray(state.elements)) {
      return state.elements.length;
    }

    if (state.elements && typeof state.elements === 'object') {
      return Object.keys(state.elements).length;
    }

    return 0;
  }, [state.elements]);

  const handleDashboardClick = (dashboardId: string) => {
    setActiveDashboard(dashboardId);
    setActiveTab(dashboardId);

    const dashboardName = dashboards.find((entry) => entry.id === dashboardId)?.name ?? dashboardId;
    addNotification({
      type: 'info',
      title: 'Dashboard Switched',
      message: `Switched to ${dashboardName}`,
      read: false,
    });
  };

  const handleCreateElement = (type: 'button' | 'text' | 'image') => {
    addElement({
      type,
      x: Math.round(Math.random() * 400),
      y: Math.round(Math.random() * 240),
      width: type === 'text' ? 160 : 140,
      height: type === 'text' ? 44 : 90,
      styles: {
        backgroundColor: type === 'image' ? '#e8e8e8' : '#1976d2',
        color: '#ffffff',
        borderRadius: '6px',
        padding: '8px',
      },
      props:
        type === 'text'
          ? { text: 'Sample text' }
          : type === 'button'
            ? { text: 'Click me' }
            : { src: 'https://via.placeholder.com/320x180' },
    });

    addNotification({
      type: 'success',
      title: 'Element Created',
      message: `${type} element added to canvas`,
      read: false,
    });
  };

  const handleCreateTemplate = () => {
    createTemplate({
      name: 'Sample Template',
      description: 'Created from current editor state',
      category: 'project',
      elements: state.elements,
      tags: ['sample', 'demo'],
    });

    addNotification({
      type: 'success',
      title: 'Template Created',
      message: 'Template was created from current state',
      read: false,
    });
  };

  const renderOverview = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Visual Editor Dashboard Overview
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        All dashboard modules share one context, so state changes propagate in real time.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Current State
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">Selected: {String(state.selectedElement ?? 'None')}</Typography>
                <Typography variant="body2">Elements: {elementCount}</Typography>
                <Typography variant="body2">Templates: {state.templates.length}</Typography>
                <Typography variant="body2">Active Tab: {state.activeTab}</Typography>
                <Typography variant="body2">Notifications: {state.notifications.length}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Quick Actions
              </Typography>
              <Stack spacing={1}>
                <Button variant="outlined" onClick={() => handleCreateElement('button')} fullWidth>
                  Add Button
                </Button>
                <Button variant="outlined" onClick={() => handleCreateElement('text')} fullWidth>
                  Add Text
                </Button>
                <Button variant="outlined" onClick={() => handleCreateElement('image')} fullWidth>
                  Add Image
                </Button>
                <Button variant="contained" onClick={handleCreateTemplate} fullWidth sx={theming.getThemedButtonSx()}>
                  Create Template
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderActiveDashboard = () => {
    const dashboard = dashboards.find((entry) => entry.id === activeDashboard);
    if (!dashboard || dashboard.id === 'overview') {
      return renderOverview();
    }

    return dashboard.render();
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Paper sx={{ width: 280, p: 2, overflow: 'auto', ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Dashboards
        </Typography>

        <List dense>
          {dashboards.map((dashboard) => (
            <ListItemButton
              key={dashboard.id}
              selected={activeDashboard === dashboard.id}
              onClick={() => handleDashboardClick(dashboard.id)}
            >
              <ListItemIcon>{dashboard.icon}</ListItemIcon>
              <ListItemText primary={dashboard.name} />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Context Status
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <Chip label={`${elementCount} Elements`} size="small" />
          <Chip label={`${state.templates.length} Templates`} size="small" />
          <Chip label={`${state.notifications.length} Notifications`} size="small" />
        </Box>
      </Paper>

      <Box sx={{ flex: 1, overflow: 'auto' }}>{renderActiveDashboard()}</Box>
    </Box>
  );
};

export default VisualEditorDashboardExample;
