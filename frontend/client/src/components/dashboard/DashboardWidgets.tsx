import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardHeader,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  MoreVert,
  Close,
  AddCircle as Add,
  Dashboard,
  Analytics,
  Schedule,
  Notifications,
  CloudUpload,
  Memory,
  Settings,
  CameraAlt,
  VideoCall as VideocamCall,
  LibraryMusic as LibraryMusicNote,
  Business as DirectionsBusiness,
  Chat,
  Assessment,
  ContentCopy as DescriptionContentCopy,
  Event,
  AccountCircle,
  Storage,
  Build,
  Security,
  TrendingUp,
  Assignment,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

// Widget types definition
interface Widget {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  category: 'overview' | 'projects' | 'clients' | 'analytics' | 'tools' | 'communication';
  profession?: string[];
  minWidth?: number;
  minHeight?: number;
  defaultSize?: 'small' | 'medium' | 'large'
}

// Widget components
const OverviewWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Oversikt
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Hurtig oversikt over dine prosjekter og aktiviteter
    </Typography>
  </Box>
);

const AnalyticsWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Analyse
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Se detaljert statistikk og rapporter
    </Typography>
  </Box>
);

const UpcomingEventsWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Kommende hendelser
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Dine neste møter og deadlines
    </Typography>
  </Box>
);

const NotificationsWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Varsler
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Viktige meldinger og oppdateringer
    </Typography>
  </Box>
);

const FileUploadWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Filopplasting
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Last opp filer til Google Drive
    </Typography>
  </Box>
);

const MemoryCardWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Minnekort
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Administrer minnekort og backup
    </Typography>
  </Box>
);

const ProjectsWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Prosjekter
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Dine aktive prosjekter og fremgang
    </Typography>
  </Box>
);

const ClientsWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Kunder
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Kundeoversikt og kontaktinformasjon
    </Typography>
  </Box>
);

const EquipmentWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Utstyr
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Administrer ditt fotografiske utstyr
    </Typography>
  </Box>
);

const ChatWidget = () => (
  <Box sx={{ p:  2 }}>
    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
      Chat
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Kommuniker med team og kunder
    </Typography>
  </Box>
);

// Available widgets registry
const availableWidgets: Widget[] = [
  {
    id: 'overview',
    title: 'Oversikt',
    icon: <Dashboard />,
    component: OverviewWidget,
    category: 'overview',
    defaultSize: 'large' },
  {
    id: 'analytics',
    title: 'Analyse',
    icon: theming.getThemedIcon(''),
    component: AnalyticsWidget,
    category: 'analytics',
    defaultSize: 'medium' },
  {
    id: 'upcoming-events',
    title: 'Kommende hendelser',
    icon: theming.getThemedIcon(''),
    component: UpcomingEventsWidget,
    category: 'overview',
    defaultSize: 'medium' },
  {
    id: 'notifications',
    title: 'Varsler',
    icon: theming.getThemedIcon(''),
    component: NotificationsWidget,
    category: 'communication',
    defaultSize: 'small' },
  {
    id: 'file-upload',
    title: 'Filopplasting',
    icon: theming.getThemedIcon(''),
    component: FileUploadWidget,
    category: 'tools',
    defaultSize: 'medium' },
  {
    id: 'memory-card',
    title: 'Minnekort',
    icon: <Memory />,
    component: MemoryCardWidget,
    category: 'tools',
    profession: ['photographer','videographer'], // TODO: Make dynamic based on profession features
    defaultSize: 'medium' },
  {
    id: 'projects',
    title: 'Prosjekter',
    icon: theming.getThemedIcon(', '),
    component: ProjectsWidget,
    category: 'projects',
    defaultSize: 'large' },
  {
    id: 'clients',
    title: 'Kunder',
    icon: theming.getThemedIcon(', '),
    component: ClientsWidget,
    category: 'clients',
    defaultSize: 'medium' },
  {
    id: 'equipment',
    title: 'Utstyr',
    icon: <CameraAlt />,
    component: EquipmentWidget,
    category: 'tools',
    profession: ['photographer','videographer'], // TODO: Make dynamic based on profession features
    defaultSize: 'medium' },
  {
    id: 'chat',
    title: 'Chat',
    icon: theming.getThemedIcon(', '),
    component: ChatWidget,
    category: 'communication',
    defaultSize: 'small' },
];

interface DashboardWidget {
  id: string;
  widgetId: string;
  position: number;
  size: 'small' | 'medium' | 'large';
  enabled: boolean
}

interface DashboardWidgetsProps {
  profession: string
}

const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ profession }) => {
  const [userWidgets, setUserWidgets] = useState<DashboardWidget[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [widgetMenuAnchor, setWidgetMenuAnchor] = useState<{
    [key: string]: HTMLElement | null;
}>({});

  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  
  // Theming system
  const theming = useTheming('photographer');

  // Load user widgets (server first, fallback to local)
  useEffect(() => {
    fetch(`/api/user/kv/dashboard_widgets_${profession}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setUserWidgets(j.data);
        } else {
          const saved = localStorage.getItem(`dashboard_widgets_${profession}`);
          if (saved) {
            try { setUserWidgets(JSON.parse(saved)); } catch { setDefaultWidgets(); }
          } else {
            setDefaultWidgets();
          }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem(`dashboard_widgets_${profession}`);
        if (saved) {
          try { setUserWidgets(JSON.parse(saved)); } catch { setDefaultWidgets(); }
        } else {
          setDefaultWidgets();
        }
      });
  }, [profession]);

  // Set default widgets based on profession
  const setDefaultWidgets = () => {
    const defaults: DashboardWidget[] = [
      {
        id: 'default-overview',
        widgetId: 'overview',
        position:  0,
        size: 'large',
        enabled: true,
    },
      {
        id: 'default-projects',
        widgetId: 'projects',
        position:  1,
        size: 'large',
        enabled: true,
    },
      {
        id: 'default-analytics',
        widgetId: 'analytics',
        position:  2,
        size: 'medium',
        enabled: true,
    },
      {
        id: 'default-events',
        widgetId: 'upcoming-events',
        position:  3,
        size: 'medium',
        enabled: true,
    },
    ];

    // Check if profession has equipment/memory card features based on dynamic configs
    // For now, include these widgets for professions that might need them
    const professionConfig = professionConfigs?.[profession];
    const hasEquipmentFeatures =
      professionConfig || profession === 'photographer' || profession === 'videographer';

    if (hasEquipmentFeatures) {
      defaults.push(
        {
          id: 'default-memory',
          widgetId: 'memory-card',
          position:  4,
          size: 'medium',
          enabled: true,
      },
        {
          id: 'default-equipment',
          widgetId: 'equipment',
          position:  5,
          size: 'medium',
          enabled: true,
      },
      );
  }

    setUserWidgets(defaults);
    saveWidgets(defaults);
};

  // Save widgets to server + local fallback
  const saveWidgets = (widgets: DashboardWidget[]) => {
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: `dashboard_widgets_${profession}`, value: widgets })
    }).catch(() => {});
    localStorage.setItem(`dashboard_widgets_${profession}`, JSON.stringify(widgets));
};

  // Get available widgets filtered by profession
  const getAvailableWidgets = () => {
    return availableWidgets.filter((widget) => {
      // If no profession restriction, show to all
      if (!widget.profession) return true;

      // Check if current profession is allowed
      if (widget.profession.includes(profession)) return true;

      // For dynamic professions, be more permissive
      // Users can enable/disable widgets as needed
      const isDynamicProfession = professionConfigs && professionConfigs[profession];
      return isDynamicProfession; // Show all widgets to dynamic professions
  });
};

  // Get grid size for widget
  const getGridSize = (size: string) => {
    switch (size) {
      case 'small':
        return { xs: 12, sm:  6, md:  4 };
      case 'medium':
        return { xs:  12, sm:  6, md:  6 };
      case 'large':
        return { xs:  12, sm:  12, md: 12,};
      default: return { xs: 12, sm:  6, md:  6 };
  }
};

  // Add widget
  const addWidget = (widgetId: string) => {
    const widget = availableWidgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      widgetId,
      position: userWidgets.length,
      size: widget.defaultSize || 'medium',
      enabled: true,
  };

    const updatedWidgets = [...userWidgets, newWidget];
    setUserWidgets(updatedWidgets);
    saveWidgets(updatedWidgets);
    setShowAddDialog(false);
};

  // Remove widget
  const removeWidget = (widgetId: string) => {
    const updatedWidgets = userWidgets.filter((w) => w.id !== widgetId);
    setUserWidgets(updatedWidgets);
    saveWidgets(updatedWidgets);
    setWidgetMenuAnchor({ ...widgetMenuAnchor, [widgetId]: null });
};

  // Change widget size
  const changeWidgetSize = (widgetId: string, size: 'small' | 'medium' | 'large') => {
    const updatedWidgets = userWidgets.map((w) => (w.id === widgetId ? { ...w, size } : w));
    setUserWidgets(updatedWidgets);
    saveWidgets(updatedWidgets);
    setWidgetMenuAnchor({ ...widgetMenuAnchor, [widgetId]: null });
  };

  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(userWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions
    const updatedWidgets = items.map((widget, index) => ({
      ...widget,
      position: index,
  }));

    setUserWidgets(updatedWidgets);
    saveWidgets(updatedWidgets);
  };

  // Get widget component
  const getWidgetComponent = (widget: DashboardWidget) => {
    const widgetDef = availableWidgets.find((w) => w.id === widget.widgetId);
    if (!widgetDef) return null;

    const Component = widgetDef.component;
    return <Component />;
};

  return (
    <Box sx={{ p:  2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb:  3}}
      >
        <Typography variant="h5" sx={{  fontWeight: 600}}>
          Dashboard Widgets
        </Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowAddDialog(true)}
          sx={{ borderRadius:  2 }}
        >
          Legg til widget
        </Button>
      </Box>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-widgets">
          {(provided) => (
            <Grid container spacing={3} {...provided.droppableProps} ref={provided.innerRef}>
              {userWidgets
                .filter((w) => w.enabled)
                .sort((a, b) => a.position - b.position)
                .map((widget, index) => {
                  const widgetDef = availableWidgets.find((w) => w.id === widget.widgetId);
                  if (!widgetDef) return null;

                  return (
                    <Draggable key={widget.id} draggableId={widget.id} index={index}>
                      {(provided, snapshot) => (
                        <Grid item xs={12} {...getGridSize(widget.size)}
                          ref={provided.innerRef}
                          {...provided.draggableProps}>
                          <Card
                            sx={{
                              ...theming.getThemedCardSx(),
                              height: '100%',
                              transition: 'all 0.2s ease',
                              transform: snapshot.isDragging ? 'rotate(5deg)' : 'rotate(0deg)',
                              boxShadow: snapshot.isDragging ? 8 : 1,
                              '&:hover': {
                                boxShadow: 3,
                              },
                            }}
                          >
                            <CardHeader
                              {...provided.dragHandleProps}
                              avatar={widgetDef.icon}
                              title={widgetDef.title}
                              action={
                                <IconButton
                                  size="small"
                                  onClick={(e) =>
                                    setWidgetMenuAnchor({
                                      ...widgetMenuAnchor,
                                      [widget.id]: e.currentTarget,
                                    })
                                }
                                >
                                  {theming.getThemedIcon('moreVert')}
                                </IconButton>
                            }
                              sx={{
                                cursor: 'grab', '&:active': { cursor: 'grabbing' },
                                pb:  1}}
                            />
                            <CardContent sx={{ pt:  0 ,  ...theming.getThemedCardSx() }}>{getWidgetComponent(widget)}</CardContent>

                            <Menu
                              anchorEl={widgetMenuAnchor[widget.id]}
                              open={Boolean(widgetMenuAnchor[widget.id])}
                              onClose={() =>
                                setWidgetMenuAnchor({
                                  ...widgetMenuAnchor,
                                  [widget.id]: null,
                              })
                            }
                            >
                              <MenuItem onClick={() => changeWidgetSize(widget.id, 'small')}>
                                Liten størrelse
                              </MenuItem>
                              <MenuItem onClick={() => changeWidgetSize(widget.id, 'medium')}>
                                Medium størrelse
                              </MenuItem>
                              <MenuItem onClick={() => changeWidgetSize(widget.id, 'large')}>
                                Stor størrelse
                              </MenuItem>
                              <MenuItem
                                onClick={() => removeWidget(widget.id)}
                                sx={{ color: 'error.main' }}
                              >
                                Fjern widget
                              </MenuItem>
                            </Menu>
                          </Card>
                        </Grid>
                      )}
                    </Draggable>
                  );
              })}
              {provided.placeholder}
            </Grid>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Widget Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center' }}
          >
            Legg til widget
            <IconButton onClick={() => setShowAddDialog(false)}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {getAvailableWidgets().map((widget) => {
              const isAdded = userWidgets.some((w) => w.widgetId === widget.id);
              return (
                <Grid item xs={12} sm={6} md={4} key={widget.id}>
                  <Card
                    sx={{
                      cursor: isAdded ? 'not-allowed' : 'pointer',
                      opacity: isAdded ? 0.5 : 1, '&:hover': {
                        boxShadow: isAdded ? 1 : 3,
                    }}}
                    onClick={() => !isAdded && addWidget(widget.id)}
                  >
                    <CardContent sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
                      <Box sx={{ mb:  1 }}>{widget.icon}</Box>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {widget.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {widget.category}
                      </Typography>
                      {isAdded && (
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{ mt: 1, display: 'block' }}
                        >
                          Allerede lagt til
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
          })}
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DashboardWidgets;
