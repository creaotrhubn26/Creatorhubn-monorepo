import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';

import {
  DragIndicator,
  Close,
  Add,
  Settings,
  Refresh,
  MonitorHeart,
  People,
  TrendingUp,
  ErrorOutline,
  Memory,
  Storage,
  NetworkCheck,
  Security,
  Timeline,
  Assessment,
  Speed as Speed,
  AttachMoney,
  Notifications,
  Support,
} from '@mui/icons-material';

interface Widget {
  id: string;
  type: string;
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  refreshInterval?: number;
}

interface WidgetData {
  [key: string]: any;
}

interface AdminWidgetsProps {
  userId: string;
}

const defaultWidgets: Omit<Widget, 'position'>[] = [
  {
    id: 'system-health',
    type: 'system-health',
    title: 'Systemhelse',
    icon: <MonitorHeart />,
    enabled: true,
    size: { width: 300, height: 200 },
    refreshInterval: 30
},
  {
    id: 'user-stats',
    type: 'user-stats',
    title: 'Brukerstatistikk',
    icon: <People />,
    enabled: true,
    size: { width: 300, height: 200 },
    refreshInterval: 60
},
  {
    id: 'revenue-chart',
    type: 'revenue-chart',
    title: 'Inntektsanalyse',
    icon: <TrendingUp />,
    enabled: true,
    size: { width: 400, height: 250 },
    refreshInterval: 300
},
  {
    id: 'error-log',
    type: 'error-log',
    title: 'Feillogg',
    icon: <ErrorOutline />,
    enabled: true,
    size: { width: 350, height: 200 },
    refreshInterval: 15
},
  {
    id: 'memory-usage',
    type: 'memory-usage',
    title: 'Minnebruk',
    icon: <Memory />,
    enabled: true,
    size: { width: 250, height: 150 },
    refreshInterval: 10
},
  {
    id: 'storage-usage',
    type: 'storage-usage',
    title: 'Lagringsbruk',
    icon: <Storage />,
    enabled: true,
    size: { width: 250, height: 150 },
    refreshInterval: 60
},
  {
    id: 'network-status',
    type: 'network-status',
    title: 'Nettverksstatus',
    icon: <NetworkCheck />,
    enabled: true,
    size: { width: 300, height: 180 },
    refreshInterval: 30
},
  {
    id: 'security-alerts',
    type: 'security-alerts',
    title: 'Sikkerhetsvarsler',
    icon: <Security />,
    enabled: true,
    size: { width: 350, height: 220 },
    refreshInterval: 60
},
  {
    id: 'recent-activity',
    type: 'recent-activity',
    title: 'Siste Aktivitet',
    icon: <Timeline />,
    enabled: true,
    size: { width: 400, height: 300 },
    refreshInterval: 30
},
  {
    id: 'performance-metrics',
    type: 'performance-metrics',
    title: 'Ytelsesmetrikker',
    icon: <Speed />,
    enabled: true,
    size: { width: 300, height: 200 },
    refreshInterval: 15
}
];

export default function AdminWidgets({ userId }: AdminWidgetsProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [widgetData, setWidgetData] = useState<WidgetData>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Load user's widget configuration
  const { data: userConfig, isLoading } = useQuery({
    queryKey: ['admin-widgets-config', userId],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/widgets-config/${userId}`, { headers });
    }
});

  // Save widget configuration
  const saveConfigMutation = useMutation({
    mutationFn: async (config: Widget[]) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/widgets-config', {
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify({ userId, widgets: config })
      });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-widgets-config'] });
  }
});

  // Initialize widgets
  useEffect(() => {
    if (!isLoading) {
      if (Array.isArray(userConfig?.widgets)) {
        setWidgets(userConfig.widgets);
    } else {
        // Initialize with default widgets
        const initialWidgets = defaultWidgets.map((widget, index) => ({
          ...widget,
          position: { 
            x: (index % 3) * 350, 
            y: Math.floor(index / 3) * 280 
        }
      }));
        setWidgets(initialWidgets);
        saveConfigMutation.mutate(initialWidgets);
    }
      setLoading(false);
  }
}, [userConfig, isLoading, saveConfigMutation]);

  // Fetch widget data periodically
  useEffect(() => {
    const fetchWidgetData = async () => {
      const headers = await auth.getAuthHeader();
      const enabledWidgets = widgets.filter(w => w.enabled);
      const promises = enabledWidgets.map(async (widget) => {
        try {
          const data = await apiRequest(`/api/admin/widget-data/${widget.type}`, { headers });
          return { id: widget.id, data };
      } catch (error) {
          console.error(`Error fetching data for widget ${widget.id}:`, error);
          return { id: widget.id, data: null };
      }
    });

      const results = await Promise.all(promises);
      const newWidgetData: WidgetData = {};
      results.forEach(({ id, data }) => {
        newWidgetData[id] = data;
    });
      setWidgetData(newWidgetData);
  };

    if (widgets.length > 0) {
      fetchWidgetData();
      const interval = setInterval(fetchWidgetData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
  }
}, [widgets]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.indexreorderedItem);

    setWidgets(items);
    saveConfigMutation.mutate(items);
};

  const toggleWidget = (widgetId: string) => {
    const updatedWidgets = widgets.map(widget =>
      widget.id === widgetId
        ? { ...widget, enabled: !widget.enabled }
        : widget
    );
    setWidgets(updatedWidgets);
    saveConfigMutation.mutate(updatedWidgets);
};

  const renderWidgetContent = (widget: Widget) => {
    const data = widgetData[widget.id];
    
    switch (widget.type) {
      case 'system-health':
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">CPU Bruk</Typography>
              <Typography variant="body2" fontWeight={600}>
                {data?.cpuUsage || '0'}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={data?.cpuUsage || 0}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Oppetid</Typography>
              <Typography variant="body2" fontWeight={600}>
                {data?.uptime || '99.9%'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Responstid</Typography>
              <Typography variant="body2" fontWeight={600}>
                {data?.responseTime || '45ms'}
              </Typography>
            </Box>
          </Box>
        );

      case 'user-stats':
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Aktive Brukere</Typography>
              <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                {data?.activeUsers || 0}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Nye i dag</Typography>
              <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                {data?.newToday || 0}
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="Fotografer" size="small" variant="outlined" />
              <Chip label="Videografer" size="small" variant="outlined" />
              <Chip label="Produsenter" size="small" variant="outlined" />
            </Box>
          </Box>
        );

      case 'error-log':
        return (
          <Box>
            <List dense>
              {(Array.isArray(data?.errors) ? data.errors : []).slice(0, 3).map((error: any, index: number) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemText
                    primary={error.message || 'Ukjent feil'}
                    secondary={error.timestamp || 'Nylig'}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        );

      case 'memory-usage':
        return (
          <Box sx={{ textAlign: 'center', pt: 2 }}>
            <CircularProgress
              variant="determinate"
              value={data?.memoryUsage || 0}
              size={80}
              thickness={6}
              sx={{ mb: 2 }}
            />
            <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
              {data?.memoryUsage || 0}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data?.memoryUsed || '0GB'} / {data?.memoryTotal || '0GB'}
            </Typography>
          </Box>
        );

      default: 
        return (
          <Box sx={{ textAlign: 'center', pt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Data laster...
            </Typography>
            <CircularProgress size={24} sx={{ mt: 1 }} />
          </Box>
        );
  }
};

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Laster widgets...
        </Typography>
      </Box>
    );
}

  return (
    <Box>
      {/* Widget Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
          Admin Dashboard Widgets
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            size="small"
          >
            Oppdater
          </Button>
          <Button 
            variant="contained"
            startIcon={<Settings />}
            onClick={() => setSettingsOpen(true)}
            size="small"
            sx={theming.getThemedButtonSx()}
          >
            Innstillinger
          </Button>
        </Box>
      </Box>

      {/* Widgets Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets-grid">
          {(provided) => (
            <Grid
              container
              spacing={2}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {widgets
                .filter(widget => widget.enabled)
                .map((widget, index) => (
                <Draggable key={widget.id} draggableId={widget.id} index={index}>
                  {(provided, snapshot) => (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={4}
                      lg={3}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{
                        transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                        transition: 'transform 0.2s ease'
                    }}
                    >
                      <Card
                        sx={{
                          height: widget.size.height,
                          background: alpha(theme.palette.primary.main, 0.02),
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          transition: 'all 0.3s ease', '&:hover': {
                            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
                            transform: 'translateY(-2px)'
                        },
                          ...theming.getThemedCardSx()
                      }}
                      >
                        <CardContent sx={{ pb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Box 
                              sx={{ 
                                color: theme.palette.primary.main,
                                mr: 1,
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            >
                              {widget.icon}
                            </Box>
                            <Typography variant="h6" sx={{ flex: 1, fontSize: '1rem', color: theming.colors.primary }}>
                              {widget.title}
                            </Typography>
                            <IconButton
                              size="small"
                              {...provided.dragHandleProps}
                              sx={{ cursor: 'grab' }}
                            >
                              <DragIndicator fontSize="small" />
                            </IconButton>
                          </Box>
                          {renderWidgetContent(widget)}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Grid>
          )}
        </Droppable>
      </DragDropContext>

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Widget Innstillinger
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Velg hvilke widgets som skal vises på dashboardet:
          </Typography>
          <List>
            {widgets.map(widget => (
              <ListItem key={widget.id}>
                <Box sx={{ color: theme.palette.primary.main, mr: 2 }}>
                  {widget.icon}
                </Box>
                <ListItemText 
                  primary={widget.title}
                  secondary={`Oppdateres hver ${widget.refreshInterval || 30} sekund`}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={widget.enabled}
                      onChange={() => toggleWidget(widget.id)}
                      color="primary"
                    />
                }
                  label=""
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}