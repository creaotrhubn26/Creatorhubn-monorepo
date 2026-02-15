/**
 * Tools Panel - Unified access to all Visual Editor tools
 * Provides tabs for all available tools and dashboards
 */

import React, { useState } from 'react';
import {
  Box,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  IconButton,
  Typography,
  Divider,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Close,
  Dashboard,
  Animation,
  BarChart,
  Psychology,
  CloudSync,
  Group,
  Palette,
  Extension,
  SmartToy,
  Code,
  Note,
  Layers,
  ViewModule,
  TrendingUp,
  Settings as SettingsIcon,
  Science,
} from '@mui/icons-material';

// Import all tool components
import { AdvancedTools } from './AdvancedTools';
import { NoteEditorPanel } from './NoteEditorPanel';
import { AnimationTools } from './AnimationTools';
import { AnimationDashboard } from './AnimationDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AIIntegrationDashboard } from './AIIntegrationDashboard';
import { AIAssistanceDashboard } from './AIAssistanceDashboard';
import { CollaborationDashboard } from './CollaborationDashboard';
import { CollaborationTools } from './CollaborationTools';
import { ComponentLibraryDashboard } from './ComponentLibraryDashboard';
import { DesignSystemDashboard } from './DesignSystemDashboard';
import { ExportDashboard } from './ExportDashboard';
import { ExportPresetsDashboard } from './ExportPresetsDashboard';
import { DashboardIntegrationPanel } from './DashboardIntegrationPanel';
import { DashboardComponentManager } from './DashboardComponentManager';
import { useVisualEditor } from './VisualEditorContext';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'drawer' | 'dialog';
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: unknown) => void;
  onNotificationCreate?: (notification: unknown) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tools-tabpanel-${index}`}
      aria-labelledby={`tools-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'auto' }}>
      {value === index && <Box sx={{ p: 2, height: '100%' }}>{children}</Box>}
    </div>
  );
}

const TOOL_CATEGORIES = [
  {
    label: 'Advanced',
    icon: <Science fontSize="small" />,
    description: 'Quality analysis, AI insights, VR/AR preview',
    component: AdvancedTools,
  },
  {
    label: 'Animation',
    icon: <Animation fontSize="small" />,
    description: 'Animation timeline and tools',
    component: AnimationDashboard,
  },
  {
    label: 'Analytics',
    icon: <TrendingUp fontSize="small" />,
    description: 'Usage analytics and metrics',
    component: AnalyticsDashboard,
  },
  {
    label: 'AI Tools',
    icon: <SmartToy fontSize="small" />,
    description: 'AI assistance and automation',
    component: AIIntegrationDashboard,
  },
  {
    label: 'AI Assist',
    icon: <Psychology fontSize="small" />,
    description: 'AI-powered suggestions',
    component: AIAssistanceDashboard,
  },
  {
    label: 'Collaborate',
    icon: <Group fontSize="small" />,
    description: 'Team collaboration tools',
    component: CollaborationDashboard,
  },
  {
    label: 'Components',
    icon: <Extension fontSize="small" />,
    description: 'Component library management',
    component: ComponentLibraryDashboard,
  },
  {
    label: 'Design System',
    icon: <Palette fontSize="small" />,
    description: 'Design tokens and themes',
    component: DesignSystemDashboard,
  },
  {
    label: 'Export',
    icon: <CloudSync fontSize="small" />,
    description: 'Export and sync options',
    component: ExportDashboard,
  },
  {
    label: 'Dashboards',
    icon: <Dashboard fontSize="small" />,
    description: 'All dashboard integrations',
    component: DashboardIntegrationPanel,
  },
  {
    label: 'Notes',
    icon: <Note fontSize="small" />,
    description: 'Rich text notes editor',
    component: NoteEditorPanel,
  },
];

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  isOpen,
  onClose,
  mode = 'drawer',
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  // Connect to Visual Editor context
  const { state, addElement, updateElement, selectElement, addNotification, setZoom, saveProject } =
    useVisualEditor();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle tool actions that communicate with Visual Editor
  const handleToolAction = (action: string, data: unknown) => {
    switch (action) {
      case 'addElement': addElement(data);
        addNotification({
          type: 'success',
          title: 'Element Added',
          message: `Added ${data.type} to canvas`,
          read: false,
        });
        break;
      case 'updateElement': updateElement(data.id, data.updates);
        break;
      case 'selectElement': selectElement(data.id);
        break;
      case 'setZoom': setZoom(data.zoom);
        break;
      case 'saveProject': saveProject();
        addNotification({
          type: 'success',
          title: 'Project Saved',
          message: 'All changes saved successfully',
          read: false,
        });
        break;
      default: addNotification({ type: 'info', title: 'Tool Action', message: `Executed: ${action}`, read: false });
    }
  };

  const toolContent = (
    <>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'white',
          borderBottom: 1,
          borderColor: 'divider'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Editor Tools
          </Typography>
          <Badge badgeContent={TOOL_CATEGORIES.length} color="primary" />
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Box
        sx={{
          bgcolor: 'white',
          borderBottom: 1,
          borderColor: 'divider',
          overflowX: 'auto'}}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 48'& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none',
              fontSize: '0.875rem',
            }}}
        >
          {TOOL_CATEGORIES.map((tool, index) => (
            <Tab
              key={tool.label}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {tool.icon}
                  <span>{tool.label}</span>
                </Box>
              }
              id={`tools-tab-${index}`}
              aria-controls={`tools-tabpanel-${index}`}
            />
          ))}
        </Tabs>
      </Box>

      {/* Tool Description */}
      <Box sx={{ p: 2, bgcolor: '#E3F2FD', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {TOOL_CATEGORIES[activeTab]?.description}
        </Typography>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {TOOL_CATEGORIES.map((tool, index) => {
          const ToolComponent = tool.component;
          return (
            <TabPanel key={tool.label} value={activeTab} index={index}>
              <ToolComponent
                selectedProject={selectedProject || state.currentProject}
                onProjectUpdate={onProjectUpdate}
                onNotificationCreate={(notification) => {
                  if (onNotificationCreate) {
                    onNotificationCreate(notification);
                  } else {
                    addNotification(notification);
                  }
                }}
              />
            </TabPanel>
          );
        })}
      </Box>
    </>
  );

  // Render based on mode
  if (mode === 'dialog') {
    return (
      <Dialog
        open={isOpen}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: {}}}
      >
        {toolContent}
      </Dialog>
    );
  }

  // Default: drawer mode
  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600, md: 800 },
          bgcolor: '#FAFAFA',
        }}}
    >
      {toolContent}
    </Drawer>
  );
};

// Toggle button/menu component
interface ToolsPanelToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenTool?: (toolIndex: number, mode: 'drawer' | 'dialog') => void;
}

export const ToolsPanelToggle: React.FC<ToolsPanelToggleProps> = ({
  isOpen,
  onToggle,
  onOpenTool,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (onOpenTool) {
      setAnchorEl(event.currentTarget);
    } else {
      onToggle();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToolSelect = (index: number, mode: 'drawer' | 'dialog') => {
    if (onOpenTool) {
      onOpenTool(index, mode);
    }
    handleClose();
  };

  return (
    <>
      <Tooltip title={isOpen ? 'Close Tools' : 'Open Tools'} placement="left">
        <IconButton
          onClick={handleClick}
          sx={{
            position: 'fixed',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'primary.main',
            color: 'white', '&:hover': {
              bgcolor: 'primary.dark',
            },
            zIndex: 120,
            width: 48,
            height: 48}}
        >
          <Badge badgeContent={TOOL_CATEGORIES.length} color="error">
            <SettingsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Quick access menu */}
      {onOpenTool && (
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleClose}
          PaperProps={{ sx: {}}}
        >
          {TOOL_CATEGORIES.map((tool, index) => (
            <MenuItem key={tool.label} onClick={() => handleToolSelect(index, 'dialog')}>
              <ListItemIcon>{tool.icon}</ListItemIcon>
              <ListItemText
                primary={tool.label}
                secondary={tool.description}
                secondaryTypographyProps={{ variant:'caption' }} />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={onToggle}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Open All Tools" />
          </MenuItem>
        </Menu>
      )}
    </>
  );
};
