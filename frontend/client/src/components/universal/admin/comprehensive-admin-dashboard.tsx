import { useTheming } from '../../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card as MuiCard,
  CardContent,
  Typography,
  Switch,
  Button,
  Tabs,
  Tab,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import {
  Dashboard,
  People,
  Settings,
  BarChart as BoxChart,
  Security,
  Edit,
  Visibility,
  VisibilityOff,
  AddCircle as Add,
  Build,
  CloudDone,
  Notifications,
  TrendingUp,
  PhotoCamera as PhotoCameraAlt,
  Videocam as Videocamcam,
  LibraryMusic as LibraryMusicNote,
  Store,
  Warning,
  CheckCircle,
  ExpandMore,
  Code,
  Palette,
  Language,
  Speed as Speed,
  Storage,
  NetworkCheck,
  Email,
  Payment,
  Analytics,
} from '@mui/icons-material';

// Import the advanced CMS interface and analytics dashboard
import AdvancedCMSInterface from './advanced-cms-interface';
import GoogleAnalyticsDashboard from './google-analytics-dashboard';
import ProfessionCMSManager from '../../admin/ProfessionCMSManager';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Import dynamic profession system
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';

interface AdminDashboardProps {
  userRole?: 'super_admin' | 'admin' | 'editor';
}

interface SystemComponent {
  id: string;
  name: string;
  type: 'page' | 'component' | 'feature';
  status: 'active' | 'inactive' | 'maintenance';
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'all' | 'enterprise';
  lastModified: string;
  usage: number
}

interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  systemHealth: number;
  serverUptime: string;
  storageUsed: number;
  apiCalls: number;
  errorRate: number
}

export default function ComprehensiveAdminDashboard({ userRole = 'super_admin,' }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedComponent, setSelectedComponent] = useState<SystemComponent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [cmsMode, setCmsMode] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Dynamic profession system
  const { professionConfigs } = useDynamicProfessions();

  // Real-time platform metrics
  const { data: metrics = {} as PlatformMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/metrics', ],
    refetchInterval: 5000 // Real-time updates every 5 seconds
});

  // System components list
  const { data: components = [] as SystemComponent[], isLoading: componentsLoading } = useQuery({
    queryKey: ['/api/admin/components']
});

  // User management data
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users']
});

  // Component toggle mutation
  const toggleComponentMutation = useMutation({
    mutationFn: async ({ , idstatus }: { id: string; status: string }) => {
      const response = await fetch(`/api/admin/components/${id}/toggle`, {
        method: 'PU',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ status })
    });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/components', ],});
  }
});

  const handleComponentToggle = (componentId: string, newStatus: string) => {
    toggleComponentMutation.mutate({ id: componentd, status: newStatus });
};

  // Define admin tabs with profession management
  const tabs = [
    { icon: <Dashboard />, label: 'Oversikt',},
    { icon: theming.getThemedIcon(''), label: 'Komponenter',},
    { icon: theming.getThemedIcon(''), label: 'Brukere',},
    { icon: theming.getThemedIcon(''), label: 'Innstillinger',},
    { icon: theming.getThemedIcon(', '), label: 'Profesjonsadmin',},
    { icon: <BarChart />, label: 'CMS',},
    { icon: theming.getThemedIcon(', '), label: 'Analytikk',},
    { icon: theming.getThemedIcon(', '), label: 'Sikkerhet',}
  ];

  // Real-time system status
  const getStatusColor = (health: number) => {
    if (health >= 95) return '#4caf50'; // Green
    if (health >= 80) return '#ff9800'; // Orange
    return '#f44336'; // Red
};

  const renderOverviewTab = () => (
    <Box>
      {/* Real-time Platform Status */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid item xs={12} md={3}>
          <MuiCard sx={{ 
            background: `linear-gradient(135deg, ${getStatusColor(metrics.systemHealth || 0)} 0%, ${getStatusColor(metrics.systemHealth || 0)}88 100%)`,
            color: 'white'
      }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Speed sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {metrics.systemHealth || 0}%
              </Typography>
              <Typography variant="body2">System Helse</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8}}>
                Oppetid: {metrics.serverUptime || '0'}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
            color: 'white'
      }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <People sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {metrics.totalUsers || 0}
              </Typography>
              <Typography variant="body2">Totale Brukere</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8}}>
                {metrics.activeUsers || 0} aktive nå
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
            color: 'white'
      }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <PhotoCamera sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {metrics.totalProjects || 0}
              </Typography>
              <Typography variant="body2">Aktive Prosjekter</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8}}>
                Alle profesjoner
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
            color: 'white'
      }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Storage sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {Math.round((metrics.storageUsed || 0) / 1024)}GB
              </Typography>
              <Typography variant="body2">Lagring Brukt</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8}}>
                Google Drive Sync
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <MuiCard sx={{ mb:  3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Hurtighandlinger
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('add')}
                sx={{ background: 'linear-gradient(135deg, #4caf50, #81c784)' }}
                onClick={() => setCmsMode(true)}
              >
                Ny Side/Komponent
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('edit')}
                sx={{ background: 'linear-gradient(135deg, #2196F3, #21CBF3)' }}
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? 'Avslutt Redigering' : 'CMS Modus'}
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('analytics')}
                sx={{ background: 'linear-gradient(135deg, #ff9800, #ffb74d)' }}
               sx={theming.getThemedButtonSx()}>
                Generer Rapport
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('security')}
                sx={{ background: 'linear-gradient(135deg, #f44336, #ef5350)' }}
               sx={theming.getThemedButtonSx()}>
                Sikkerhetskontroll
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>

      {/* System Alerts */}
      {metrics.errorRate > 5 && (
        <Alert severity="warning" sx={{ mb:  3 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Høy feilrate detektert: {metrics.errorRate}%
          </Typography>
          <Typography>
            Systemet opplever økt antall feil. Sjekk serverlogger for detaljer.
          </Typography>
        </Alert>
      )}
    </Box>
  );

  const renderComponentsTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>
          Komponent- og Sidestyring
        </Typography>
        <Box>
          <Button startIcon={theming.getThemedIcon('add')}
            variant="contained"
            sx={{ mr: 2, background: 'linear-gradient(135deg, #4caf50, #81c784)' }}
           sx={theming.getThemedButtonSx()}>
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

      <Grid container spacing={3}>
        {/* Dynamic Profession Components */}
        {Object.values(professionConfigs).map((professionConfig) => (
          <Grid item key={professionConfig.name} item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  {professionConfig.name === 'photographer' ? theming.getThemedIcon('photoCamera') :
                   professionConfig.name === 'videographer' ? theming.getThemedIcon('videocam') :
                   professionConfig.name === 'music_producer' ? theming.getThemedIcon('libraryMusic') :
                   professionConfig.name === 'vendor' ? theming.getThemedIcon('store') : theming.getThemedIcon('build')}
                  {professionConfig.displayName} Komponenter
                </Typography>
                <List>
                  {components
                    .filter(c => c.profession === professionConfig.name || c.profession === 'all')
                    .map((component) => (
                      <ListItem key={component.id}>
                        <ListItemIcon>
                          {component.type === 'page' ? <Code /> : 
                           component.type === 'component' ? theming.getThemedIcon('build') : theming.getThemedIcon('palette')}
                        </ListItemIcon>
                        <ListItemText
                          primary={component.name}
                          secondary={`Sist endret: ${component.lastModified}`}
                        />
                        <Chip
                          label={component.status}
                          color={component.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                        {editMode && (
                          <Switch
                            checked={component.status === 'active'}
                            onChange={(e) => 
                              handleComponentToggle(component.id, e.target.checked ? 'active' : 'inactive')
                          }
                          />
                        )}
                      </ListItem>
                    ))
                }
                </List>
              </CardContent>
            </MuiCard>
          </Grid>
        ))}
      </Grid>

        {/* Videographer Components */}
        <Grid item xs={12} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('videocam')}
                Videograf Komponenter
              </Typography>
              <List>
                {components
                  .filter(c => c.profession === 'videographer' || c.profession === 'all')
                  .map((component) => (
                    <ListItem key={component.id}>
                      <ListItemIcon>
                        {component.type === 'page' ? <Code /> : 
                         component.type === 'component' ? theming.getThemedIcon('build') : theming.getThemedIcon('palette')}
                      </ListItemIcon>
                      <ListItemText
                        primary={component.name}
                        secondary={`Brukt av: ${component.usage} brukere`}
                      />
                      <Chip
                        label={component.status}
                        color={component.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                      {editMode && (
                        <Switch
                          checked={component.status === 'active'}
                          onChange={(e) => 
                            handleComponentToggle(component.id, e.target.checked ? 'active' : 'inactive')
                        }
                        />
                      )}
                    </ListItem>
                  ))
              }
              </List>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Music Producer Components */}
        <Grid item xs={12} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('libraryMusic')}
                Musikkprodusent Komponenter
              </Typography>
              <List>
                {components
                  .filter(c => c.profession === 'music_producer' || c.profession === 'all')
                  .map((component) => (
                    <ListItem key={component.id}>
                      <ListItemIcon>
                        {component.type === 'page' ? <Code /> : 
                         component.type === 'component' ? theming.getThemedIcon('build') : theming.getThemedIcon('palette')}
                      </ListItemIcon>
                      <ListItemText
                        primary={component.name}
                        secondary={`Type: ${component.type}`}
                      />
                      <Chip
                        label={component.status}
                        color={component.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                      {editMode && (
                        <Switch
                          checked={component.status === 'active'}
                          onChange={(e) => 
                            handleComponentToggle(component.id, e.target.checked ? 'active' : 'inactive')
                        }
                        />
                      )}
                    </ListItem>
                  ))
              }
              </List>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Vendor Components */}
        <Grid item xs={12} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('store')}
                Leverandør Komponenter
              </Typography>
              <List>
                {components
                  .filter(c => c.profession === 'vendor' || c.profession === 'all')
                  .map((component) => (
                    <ListItem key={component.id}>
                      <ListItemIcon>
                        {component.type === 'page' ? <Code /> : 
                         component.type === 'component' ? theming.getThemedIcon('build') : theming.getThemedIcon('palette')}
                      </ListItemIcon>
                      <ListItemText
                        primary={component.name}
                        secondary={`Status: ${component.status}`}
                      />
                      <Chip
                        label={component.status}
                        color={component.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                      {editMode && (
                        <Switch
                          checked={component.status === 'active'}
                          onChange={(e) => 
                            handleComponentToggle(component.id, e.target.checked ? 'active' : 'inactive')
                        }
                        />
                      )}
                    </ListItem>
                  ))
              }
              </List>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>
    </Box>
  );

  const renderUsersTab = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Brukerstyring
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Aktive Brukere
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Navn</TableCell>
                      <TableCell>Profesjon</TableCell>
                      <TableCell>Sist Aktiv</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.slice(0, 10).map((user: any) => (
                      <TableRow key={user.d}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Avatar src={user.avatar} />
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {user.name || 'Ukjent Bruker'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {user.email || 'ingen@email.com'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.profession || 'Ikke satt'} 
                            size="small"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>
                          {user.lastActive || 'I dag'}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.status || 'aktiv'} 
                            color="success" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small">
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                          <IconButton size="small">
                            {theming.getThemedIcon('security')}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <MuiCard sx={{ mb:  2 }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Brukerstatistikk
              </Typography>
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" color="text.secondary">
                  Fotografer
                </Typography>
                <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                  {Math.floor((metrics.totalUsers || 0) * 0.4)}
                </Typography>
              </Box>
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" color="text.secondary">
                  Videografer
                </Typography>
                <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                  {Math.floor((metrics.totalUsers || 0) * 0.3)}
                </Typography>
              </Box>
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" color="text.secondary">
                  Musikkprodusenter
                </Typography>
                <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                  {Math.floor((metrics.totalUsers || 0) * 0.2)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Leverandører
                </Typography>
                <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                  {Math.floor((metrics.totalUsers || 0) * 0.1)}
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>

          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Hurtighandlinger
              </Typography>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('add')}
                sx={{ mb: 1, background: 'linear-gradient(135deg, #4caf50, #81c784)' }}
               sx={theming.getThemedButtonSx()}>
                Opprett Bruker
              </Button>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('email')}
                sx={{ mb: 1, background: 'linear-gradient(135deg, #2196F3, #21CBF3)' }}
               sx={theming.getThemedButtonSx()}>
                Send Masseepost
              </Button>
              <Button fullWidth
                variant="contained"
                startIcon={theming.getThemedIcon('security')}
                sx={{ background: 'linear-gradient(135deg, #ff9800, #ffb74d)' }}
               sx={theming.getThemedButtonSx()}>
                Rolle Management
              </Button>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>
    </Box>
  );

  // Mock data removed - using database connection

  return (
    <Box sx={{ p:  3, maxWidth: 140, mx: 'auto'}}>
      <Typography variant="h3" gutterBottom sx={{ 
        color: '#2196F0',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap:  2,
        mb: 4  }}>
        <Dashboard sx={{ fontSize: 48}} />
        CreatorHub Norge - Administrasjon
      </Typography>

      {/* Edit Mode Indicator */}
      {editMode && (
        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            CMS-modus aktivert
          </Typography>
          <Typography>
            Du kan nå redigere alle komponenter og sider direkte. Toggle funksjonalitet er tilgjengelig.
          </Typography>
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
              sx={{ minHeight: 64}}
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && renderOverviewTab()}
      {activeTab === 1 && renderComponentsTab()}
      {activeTab === 2 && renderUsersTab()}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>Systemkonfigurasjon</Typography>
          <Typography>Avanserte systemkonfigurasjoner kommer her...</Typography>
        </Box>
      )}
      {activeTab === 4 && <ProfessionCMSManager />}
      {activeTab === 5 && <AdvancedCMSInterface />}
      {activeTab === 6 && <GoogleAnalyticsDashboard />}
      {activeTab === 7 && (
        <Box>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>Sikkerhet</Typography>
          <Typography>Sikkerhetskontroller og systemlogger kommer her...</Typography>
        </Box>
      )}
    </Box>
  );
}