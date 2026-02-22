import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  LibraryMusic,
  CloudDone,
  Settings,
  CheckCircle,
  Warning,
  Sync,
  Security,
  Download,
  Update,
  Extension,
  Group,
  CloudSync,
} from '@mui/icons-material';

interface PluginVendor {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'pending';
  plugins: number;
  lastSync: Date;
  autoConnect: boolean
}

interface Plugin {
  id: string;
  name: string;
  vendor: string;
  version: string;
  installed: boolean;
  licensed: boolean;
  lastUpdate: Date
}

interface MusicProductionToolsProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void
}

const MusicProductionTools: React.FC<MusicProductionToolsProps> = ({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}) => {
  const [selectedTab, setSelectedTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [connectDialog, setConnectDialog] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);

  const vendors: PluginVendor[] = [
    {
      id: 'native-instruments',
      name: 'Native Instruments',
      status: 'connected',
      plugins:  47,
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 100),
      autoConnect: true
},
    {
      id: 'izotope',
      name: 'iZotope',
      status: 'connected',
      plugins:  23,
      lastSync: new Date(Date.now() - 4 * 60 * 60 * 100),
      autoConnect: true
},
    {
      id: 'splice',
      name: 'Splice Sounds',
      status: 'connected',
      plugins:  15,
      lastSync: new Date(Date.now() - 1 * 60 * 60 * 100),
      autoConnect: true
},
    {
      id: 'fabfilter',
      name: 'FabFilter',
      status: 'disconnected',
      plugins:  12,
      lastSync: new Date(Date.now() - 24 * 60 * 60 * 100),
      autoConnect: false
},
    {
      id: 'waves',
      name: 'Waves',
      status: 'pending',
      plugins:  89,
      lastSync: new Date(Date.now() - 6 * 60 * 60 * 100),
      autoConnect: true
},
    {
      id: 'output',
      name: 'Output',
      status: 'connected',
      plugins:  8,
      lastSync: new Date(Date.now() - 30 * 60 * 100),
      autoConnect: true
},
    {
      id: 'celemony',
      name: 'Celemony',
      status: 'connected',
      plugins:  3,
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 100),
      autoConnect: true
},
    {
      id: 'soundtoys',
      name: 'Soundtoys',
      status: 'disconnected',
      plugins:  21,
      lastSync: new Date(Date.now() - 48 * 60 * 60 * 100),
      autoConnect: false
},
    {
      id: 'xln-audio',
      name: 'XLN Audio',
      status: 'connected',
      plugins:  7,
      lastSync: new Date(Date.now() - 1 * 60 * 60 * 100),
      autoConnect: true
},
    {
      id: 'steinberg',
      name: 'Steinberg',
      status: 'connected',
      plugins:  34,
      lastSync: new Date(Date.now() - 3 * 60 * 60 * 100),
      autoConnect: true
}
  ];

  const samplePlugins: Plugin[] = [
    {
      id: 'kontakt-',
      name: 'Kontakt 7',
      vendor: 'Native Instruments',
      version: '7.8.',
      installed: true,
      licensed: true,
      lastUpdate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
},
    {
      id: 'ozone-1',
      name: 'Ozone 1',
      vendor: 'iZotope',
      version: '11.0.',
      installed: true,
      licensed: true,
      lastUpdate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
},
    {
      id: 'arcade',
      name: 'Arcade',
      vendor: 'Output',
      version: '1.7.',
      installed: true,
      licensed: true,
      lastUpdate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
}
  ];

  const handleAutoConnect = () => {
    setAutoConnecting(true);
    setTimeout(() => {
      setAutoConnecting(false);
      setConnectDialog(false);
      
      // Trigger unified workflow callbacks
      const connectedVendors = vendors.filter(v => v.status === 'connected');
      onProjectUpdate?.({
        type: 'music_plugins_connected',
        vendors: connectedVendors,
        totalPlugins: connectedVendors.reduce((sum, v) => sum + v.plugins, 0),
        timestamp: new Date().toISOString()
  });
      onNotificationCreate?.({
        type: 'plugins_connected',
        message: `Connected to ${connectedVendors.length} music plugin vendors`,
        timestamp: new Date().toISOString()
  });
  }, 3000);
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'pending': return 'warning';
      case 'disconnected': return 'error';
      default: return 'default';
}
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return theming.getThemedIcon(', ');
      case 'pending': return theming.getThemedIcon('warning');
      case 'disconnected': return theming.getThemedIcon('warning');
      default: return theming.getThemedIcon(', ');
  }
};

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        {theming.getThemedIcon('libraryMusic')}
        Music Production Tools
      </Typography>

      <Grid container spacing={3}>
        {/* Plugin Vendor Overview */}
        <Grid size={{ xs: 12 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <Extension />
                  Plugin Leverandører (10/10 OAuth Integrert)
                </Typography>
                <Button variant="contained"
                  startIcon={<CloudSync />}
                  onClick={() => setConnectDialog(true)}
                >
                  Auto-koble til alle 10 OAuth leverandører
                </Button>
              </Box>

              <Grid container spacing={2}>
                {vendors.map((vendor) => (
                  <Grid size={{ xs: 12 }} sm={6} md={4} lg={3} key={vendor.id}>
                    <Card variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
                          <Typography variant="subtitle1">{vendor.name}</Typography>
                          <Chip
                            icon={getStatusIcon(vendor.status)}
                            label={vendor.status}
                            color={getStatusColor(vendor.status)}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {vendor.plugins} plugins tilgjengelig
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sist synk: {vendor.lastSync.toLocaleTimeString(', ')}
                        </Typography>
                        <FormControlLabel
                          control={<Switch checked={vendor.autoConnect} size="small" />}
                          label="Auto-koble"
                          sx={{ mt:  1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Plugin Management */}
        <Grid size={{ xs: 12 }} md={8}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                {theming.getThemedIcon('libraryMusic')}
                Plugin Administrasjon
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Plugin</TableCell>
                      <TableCell>Leverandør</TableCell>
                      <TableCell>Versjon</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {samplePlugins.map((plugin) => (
                      <TableRow key={plugin.id}>
                        <TableCell>{plugin.name}</TableCell>
                        <TableCell>{plugin.vendor}</TableCell>
                        <TableCell>{plugin.version}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap:  1 }}>
                            <Chip
                              label={plugin.installed ? 'Installert' : 'Ikke installert'}
                              color={plugin.installed ? 'success' : 'default'}
                              size="small"
                            />
                            <Chip
                              label={plugin.licensed ? 'Lisensiert' : 'Ikke lisensiert'}
                              color={plugin.licensed ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button
                            startIcon={<Update />}
                            size="small"
                            variant="outlined"
                          >
                            Oppdater
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12 }} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                {theming.getThemedIcon('settings')}
                Hurtighandlinger
              </Typography>

              <List>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('sync')}
                  </ListItemIcon>
                  <ListItemText
                    primary="Synkroniser alle plugins"
                    secondary="Sjekk for oppdateringer"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('download')}
                  </ListItemIcon>
                  <ListItemText
                    primary="Installer ventende oppdateringer"
                    secondary="3 oppdateringer tilgjengelig"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('security')}
                  </ListItemIcon>
                  <ListItemText
                    primary="Valider lisenser"
                    secondary="Kontroller alle lisenser"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('group')}
                  </ListItemIcon>
                  <ListItemText
                    primary="Grupper administrasjon"
                    secondary="Håndter teamtilgang"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* System Status */}
        <Grid size={{ xs: 12 }}>
          <Alert severity="success">
            <Typography variant="body1">
              Single Sign-On (SSO) System for Plugin Vendors aktivt! 
              Automatisk tilkobling til alle 10 støttede leverandører med Google OAuth 2.0.
            </Typography>
          </Alert>
        </Grid>
      </Grid>

      {/* Auto Connect Dialog */}
      <Dialog open={connectDialog} onClose={() => setConnectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Auto-koble til alle 10 OAuth leverandører</DialogTitle>
        <DialogContent>
          {autoConnecting ? (
            <Box sx={{ textAlign: 'center', py:  3 }}>
              <LinearProgress sx={{ mb:  2 }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kobler til leverandører...</Typography>
              <Typography variant="body2" color="text.secondary">
                Autentiserer med Google OAuth og kobler til alle plugin leverandører
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body1" sx={{ mb:  2 }}>
                Denne funksjonen vil automatisk koble deg til alle 10 støttede plugin leverandører 
                ved hjelp av din Google OAuth autentisering.
              </Typography>
              
              <Typography variant="subtitle2" sx={{ mb:  1 }}>Leverandører som vil bli koblet til: </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                {vendors.map((vendor) => (
                  <Chip key={vendor.id} label={vendor.name} size="small" />
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectDialog(false)} disabled={autoConnecting}>
            Avbryt
          </Button>
          <Button onClick={handleAutoConnect} variant="contained" disabled={autoConnecting} sx={theming.getThemedButtonSx()}>
            Start Auto-kobling
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MusicProductionTools;