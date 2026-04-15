// @ts-nocheck
import { useTheming } from '../../../utils/theming-helper';
import { useAuth } from '../../../hooks/useAuth';
import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AutoMode,
  BugReport,
  CameraAlt,
  CameraOutdoor as CameraStand,
  CheckCircle,
  CloudSync,
  FlashOn,
  History,
  Lens,
  Lightbulb,
  LinearScale,
  MusicNote,
  NewReleases,
  NotificationImportant,
  Schedule,
  SdCard,
  Security,
  Star,
  SystemUpdateAlt,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FirmwareUpdateManagerProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  mode?: 'standalone' | 'integrated';
  onUpdateComplete?: (updateData: any) => void;
}

interface FirmwareUpdate {
  id: string;
  deviceBrand: string;
  deviceModel: string;
  deviceType:
    | 'camera'
    | 'lens'
    | 'audio'
    | 'software'
    | 'accessory'
    | 'lighting'
    | 'memory'
    | 'tripod'
    | 'slider'
    | 'flash';
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  updateSize: number | null; // MB
  description: string;
  releaseNotes: string[];
  bugFixes: string[];
  newFeatures: string[];
  securityUpdates: string[];
  compatibility: string[];
  downloadUrl: string;
  installationTime: number | null; // minutes
  status: 'available' | 'downloading' | 'installing' | 'completed' | 'failed';
  autoUpdate: boolean;
  backupRequired: boolean;
  restartRequired: boolean
}

interface DeviceInfo {
  id: string | number;
  brand: string;
  model: string;
  type:
    | 'camera'
    | 'lens'
    | 'audio'
    | 'software'
    | 'accessory'
    | 'lighting'
    | 'memory'
    | 'tripod'
    | 'slider'
    | 'flash';
  currentFirmware: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  lastChecked?: string | null;
  autoUpdateEnabled?: boolean;
  updateChannel?: 'stable' | 'beta' | 'alpha';
  criticalUpdatesOnly?: boolean;
  maintenanceMode?: boolean;
}

interface FirmwareUpdateHistory {
  id: string;
  deviceBrand: string;
  deviceModel: string;
  deviceType: FirmwareUpdate['deviceType'];
  currentVersion: string;
  latestVersion: string;
  priority: FirmwareUpdate['priority'];
  description: string;
  completedAt: string;
  duration: number | null;
}

type FirmwarePriority = FirmwareUpdate['priority'];
type PriorityColor = 'error' | 'warning' | 'info' | 'success';

const DEVICE_CATEGORIES = {
  photographer: [
    {
      type: 'camera',
      brands: [
        'Alpa',
        'Canon',
        'Fujifilm',
        'GoPro',
        'Hasselblad',
        'Leica',
        'Nikon',
        'OM SYSTEM',
        'Panasonic Lumix',
        'Pentax',
        'Phase One',
        'Polaroid',
        'Ricoh',
        'Sigma',
        'Sony',
        'Zeiss',
      ],
    },
    {
      type: 'lens',
      brands: [
        'Canon',
        'Fujinon',
        'Irix',
        'Laowa',
        'Leica',
        'Lensbaby',
        'Meike',
        'Nikon',
        'Samyang',
        'Schneider-Kreuznach',
        'Sigma',
        'Sirui',
        'Sony',
        'Tamron',
        'Tokina',
        'Viltrox',
        'Voigtländer',
        'Zeiss',
      ],
    },
    {
      type: 'software',
      brands: ['Adobe', 'Capture One', 'Luminar', 'ON1', 'Skylum', 'DxO'],
    },
    {
      type: 'flash',
      brands: [
        'Broncolor',
        'Canon Speedlite',
        'Elinchrom',
        'Godox',
        'Hensel',
        'Interfit',
        'Jinbei',
        'Metz',
        'Neewer',
        'Nikon Speedlight',
        'Nissin',
        'OM SYSTEM',
        'Pentax',
        'Phottix',
        'Profoto',
        'Sony HVL',
        'Visico',
        'Westcott',
      ],
    },
    {
      type: 'lighting',
      brands: [
        'Aladdin',
        'Aputure',
        'Astera',
        'Creamsource',
        'Dedolight',
        'Dracast',
        'FalconEyes',
        'Fiilex',
        'Godox',
        'GVM',
        'Kino Flo',
        'Lupo',
        'Luxli',
        'Nanlite',
        'Neewer',
        'Rotolight',
        'SmallRig',
        'Westcott',
        'Zhiyun',
        'Quasar Science',
        'COLBOR',
      ],
    },
    {
      type: 'memory',
      brands: [
        'ADAT',
        'Angelbird',
        'Delkin Devices',
        'Gigastone',
        'Hoodman',
        'Integral',
        'Kioxia',
        'Kingston',
        'Lexar',
        'Panasonic',
        'Patriot',
        'PNY',
        'ProGrade Digital',
        'Samsung',
        'SanDisk',
        'Silicon Power',
        'Sony',
        'Team Group',
        'Transcend',
        'Verbatim',
        'Wise Advanced',
      ],
    },
    {
      type: 'tripod',
      brands: [
        '3 Legged Thing',
        'Benro',
        'Cullmann',
        'Feisol',
        'Gitzo',
        'Joby',
        'K&F Concept',
        'Leofoto',
        'Manfrotto',
        'Neewer',
        'Peak Design',
        'Really Right Stuff',
        'Rollei',
        'Sirui',
        'SmallRig',
        'Ulanzi',
        'Vanguard',
        'Velbon',
      ],
    },
    {
      type: 'accessory',
      brands: ['Manfrotto', 'Peak Design', 'SmallRig', 'Really Right Stuff', 'K&F Concept', 'Ulanzi'],
    },
  ],
  videographer: [
    {
      type: 'camera',
      brands: [
        'ARR',
        'AJA Video Systems',
        'Atomos',
        'Blackmagic Design',
        'Canon Cinema EOS',
        'DJI',
        'Ikegami',
        'JVC',
        'Kinefinity',
        'Panasonic',
        'RED Digital Cinema',
        'Sharp',
        'SmallHD',
        'Sony',
        'Z CAM',
      ],
    },
    {
      type: 'lens',
      brands: [
        'Angénieux',
        'ARRI',
        'Atlas Lens Co.',
        'Canon',
        'Cooke',
        'DZOFilm',
        'Fujinon',
        'Laowa',
        'Leica',
        'Samyang',
        'Sigma',
        'Sony',
        'Tokina',
        'Vazen',
        'Zeiss',
      ],
    },
    {
      type: 'audio',
      brands: [
        'AK',
        'Audio-Technica',
        'BOYA',
        'Countryman',
        'Deity',
        'DJI',
        'DPA Microphones',
        'Hollyland',
        'K-Tek',
        'Lectrosonics',
        'Movo',
        'Neumann',
        'RØDE',
        'Rycote',
        'Sanken',
        'Sennheiser',
        'Shure',
        'Schoeps',
        'Sound Devices',
        'Sony',
        'Tascam',
        'Tentacle Sync',
        'Zoom',
        'Zaxcom',
        'Ambient Recording',
      ],
    },
    {
      type: 'software',
      brands: ['Adobe', 'DaVinci Resolve', 'Final Cut Pro', 'Avid', 'Grass Valley'],
    },
    {
      type: 'lighting',
      brands: [
        'Aladdin',
        'Aputure',
        'ARRI',
        'Astera',
        'Creamsource',
        'Dedolight',
        'Dracast',
        'FalconEyes',
        'Fiilex',
        'Godox',
        'GVM',
        'Kino Flo',
        'Lupo',
        'Luxli',
        'Nanlite',
        'Neewer',
        'Rotolight',
        'SmallRig',
        'Westcott',
        'Zhiyun',
        'Quasar Science',
        'COLBOR',
      ],
    },
    {
      type: 'slider',
      brands: [
        'Edelkrone',
        'GVM',
        'iFootage',
        'Kessler',
        'Konova',
        'Manfrotto',
        'Moza',
        'Neewer',
        'Rhino',
        'Smartta',
        'YC Onion',
        'Zeapon',
        'Cinevate',
      ],
    },
    {
      type: 'tripod',
      brands: [
        '3 Legged Thing',
        'Benro',
        'Cartoni',
        'Cullmann',
        'E-Image',
        'Feisol',
        'Gitzo',
        'iFootage',
        'K&F Concept',
        'Leofoto',
        'Libec',
        'Manfrotto',
        'Miller',
        'Neewer',
        'OConnor',
        'Sachtler',
        'Sirui',
        'SmallRig',
        'Ulanzi',
        'Vinten',
      ],
    },
    {
      type: 'memory',
      brands: [
        'ADAT',
        'Angelbird',
        'Delkin Devices',
        'Gigastone',
        'Hoodman',
        'Integral',
        'Kioxia',
        'Kingston',
        'Lexar',
        'Panasonic',
        'Patriot',
        'PNY',
        'ProGrade Digital',
        'Samsung',
        'SanDisk',
        'Silicon Power',
        'Sony',
        'Team Group',
        'Transcend',
        'Verbatim',
        'Wise Advanced',
      ],
    },
  ],
  musicproducer: [
    {
      type: 'audio',
      brands: [
        'AK',
        'Audio-Technica',
        'DPA Microphones',
        'Focusrite',
        'Neumann',
        'PreSonus',
        'RME',
        'RØDE',
        'Sennheiser',
        'Shure',
        'Sound Devices',
        'Steinberg',
        'Universal Audio',
        'MOTU',
        'Zoom',
        'Tascam',
      ],
    },
    {
      type: 'software',
      brands: [
        'Ableton',
        'Logic Pro',
        'Pro Tools',
        'Cubase',
        'FL Studio',
        'Reaper',
        'Steinberg',
        'Native Instruments',
      ],
    },
    {
      type: 'accessory',
      brands: [
        'Akai',
        'Native Instruments',
        'Novation',
        'Arturia',
        'Roland',
        'Focusrite',
        'PreSonus',
        'Universal Audio',
        'MOTU',
      ],
    },
  ],
  vendor: [
    {
      type: 'software',
      brands: ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Salesforce'],
    },
    {
      type: 'accessory',
      brands: ['Zebra', 'Honeywell', 'Datalogic', 'Cognex', 'Symbol'],
    },
    {
      type: 'memory',
      brands: [
        'ADAT',
        'Angelbird',
        'Delkin Devices',
        'Kingston',
        'Lexar',
        'ProGrade Digital',
        'Samsung',
        'SanDisk',
        'Sony',
        'Transcend',
        'Wise Advanced',
      ],
    },
  ],
};

export default function FirmwareUpdateManager({
  profession = 'photographer',
  mode = 'standalone',
  onUpdateComplete,
}: FirmwareUpdateManagerProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [activeTab, setActiveTab] = useState(0);
  const [selectedUpdate, setSelectedUpdate] = useState<FirmwareUpdate | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [releaseNotesDialogOpen, setReleaseNotesDialogOpen] = useState(false);
  const [currentReleaseNotes, setCurrentReleaseNotes] = useState<FirmwareUpdate | null>(null);
  const queryClient = useQueryClient();
  const isIntegrated = mode === 'integrated';
  
  // Theming system
  const theming = useTheming(profession);

  const professionColors = {
    photographer: '#ff8c00',
    videographer: '#e74c30',
    musicproducer: '#9b59b0',
    vendor: '#27ae60',
  };

  const color = professionColors[profession] ?? '#ff8c00';

  // Firmware updates query
  const { data: availableUpdates = [], isLoading: isLoadingFirmware } = useQuery<
    FirmwareUpdate[]
  >({
    queryKey: ['/api/firmware/updates', profession, userId],
    queryFn: async () =>
      (await apiRequest(
        `/api/firmware/updates?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId ?? '')}`
      )) as FirmwareUpdate[],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: devices = [], isLoading: isLoadingDevices } = useQuery<DeviceInfo[]>({
    queryKey: ['/api/firmware/devices', profession, userId],
    queryFn: async () =>
      (await apiRequest(
        `/api/firmware/devices?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId ?? '')}`
      )) as DeviceInfo[],
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: updateHistory = [] } = useQuery<FirmwareUpdateHistory[]>({
    queryKey: ['/api/firmware/history', profession, userId],
    queryFn: async () =>
      (await apiRequest(
        `/api/firmware/history?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId ?? '')}`
      )) as FirmwareUpdateHistory[],
    staleTime: 1000 * 60 * 10,
  });

  // Update priority mapping
  const priorityConfig: Record<
    FirmwarePriority,
    { color: PriorityColor; icon: React.ReactNode; urgency: string }
  > = {
    critical: {
      color: 'error',
      icon: theming.getThemedIcon('error'),
      urgency: 'Kritisk - Installer umiddelbart',
    },
    high: {
      color: 'warning',
      icon: theming.getThemedIcon('warning'),
      urgency: 'Høy - Installer innen 24 timer',
    },
    medium: {
      color: 'info',
      icon: theming.getThemedIcon('info'),
      urgency: 'Middels - Installer innen en uke',
    },
    low: {
      color: 'success',
      icon: theming.getThemedIcon('checkCircle'),
      urgency: 'Lav - Installer ved bekvemmelighet',
    },
  };

  const lastCheckedLabel = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleDateString('no-NO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Ikke sjekket enda';

  const isLoadingData = isLoadingFirmware || isLoadingDevices;

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      if (!userId) {
        throw new Error('Missing user ID for firmware check');
      }
      const result = await apiRequest('/api/firmware/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profession, userId }),
      });

      if (result?.updates) {
        queryClient.setQueryData(
          ['/api/firmware/updates', profession, userId],
          result.updates
        );
      }
      if (result?.devices) {
        queryClient.setQueryData(
          ['/api/firmware/devices', profession, userId],
          result.devices
        );
      }
      if (result?.history) {
        queryClient.setQueryData(
          ['/api/firmware/history', profession, userId],
          result.history
        );
      }
      if (result?.checkedAt) {
        setLastCheckedAt(result.checkedAt);
      }
    } catch (error) {
      console.error('Error checking for updates: ', error);
    } finally {
      setIsChecking(false);
    }
  };

  const startUpdate = async (update: FirmwareUpdate) => {
    setIsUpdating(true);
    try {
      if (!userId) {
        throw new Error('Missing user ID for firmware update');
      }
      const result = await apiRequest('/api/firmware/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateId: update.id, userId, profession }),
      });

      queryClient.invalidateQueries({ queryKey: ['/api/firmware/updates', profession, userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/firmware/devices', profession, userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/firmware/history', profession, userId] });

      if (onUpdateComplete && result?.update) {
        onUpdateComplete(result.update);
      }

      setUpdateDialogOpen(false);
    } catch (error) {
      console.error('Error during update:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const showReleaseNotes = (update: FirmwareUpdate) => {
    setCurrentReleaseNotes(update);
    setReleaseNotesDialogOpen(true);
};

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const renderUpdateChecker = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <SystemUpdateAlt sx={{ color }} />
        Automatisk oppdatering
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={autoUpdateEnabled}
                onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                color="primary"
              />
          }
            label="Automatiske oppdateringer"
            sx={{ mb:  2 }}
          />

          <Button fullWidth
            variant="contained"
            onClick={checkForUpdates}
            disabled={isChecking || isLoadingData}
            startIcon={
              isChecking ? (
                <CircularProgress size={20} sx={theming.getThemedButtonSx()} />
              ) : (
                theming.getThemedIcon('refresh')
              )
            }
            sx={{
              bgcolor: color,
              '&:hover': { bgcolor: color },
              mb:  2,
            }}
          >
            {isChecking ? 'Sjekker...' : 'Sjekk etter oppdateringer'}
          </Button>

          <Alert severity="info" sx={{ mb:  2 }}>
            <Typography variant="body2">
              Siste sjekk: {lastCheckedLabel}
            </Typography>
          </Alert>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Oppdateringsstatistikk
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'error.light',
                color: 'error.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {availableUpdates.filter((u) => u.priority === 'critical').length}
              </Typography>
              <Typography variant="body2">Kritiske</Typography>
            </Box>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {availableUpdates.filter((u) => u.priority === 'high').length}
              </Typography>
              <Typography variant="body2">Høy prioritet</Typography>
            </Box>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'success.light',
                color: 'success.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {availableUpdates.filter((u) => u.status === 'completed').length}
              </Typography>
              <Typography variant="body2">Fullført</Typography>
            </Box>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'info.light',
                color: 'info.contrastText',
                borderRadius:  1,
                textAlign: 'center',
              }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600 }}>
                {devices.length}
              </Typography>
              <Typography variant="body2">Enheter</Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {availableUpdates.length > 0 && (
        <Box sx={{ mt:  3 }}>
          <Divider sx={{ mb:  2 }} />
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Tilgjengelige oppdateringer
          </Typography>

          <List>
            {availableUpdates.map((update) => (
              <ListItem
                key={update.id}
                sx={{
                  border:  1,
                  borderColor: 'divider',
                  borderRadius:  1,
                  mb:  1}}
              >
                <ListItemIcon>
                  <Avatar
                    sx={{
                      bgcolor: `${priorityConfig[update.priority].color}.main`}}
                  >
                    {update.deviceType === 'camera' ? (
                      <CameraAlt />
                    ) : update.deviceType === 'lens' ? (
                      <Lens />
                    ) : update.deviceType === 'software' ? (
                      theming.getThemedIcon('settings')
                    ) : update.deviceType === 'audio' ? (
                      <MusicNote />
                    ) : update.deviceType === 'lighting' ? (
                      <Lightbulb />
                    ) : update.deviceType === 'flash' ? (
                      <FlashOn />
                    ) : update.deviceType === 'memory' ? (
                      <SdCard />
                    ) : update.deviceType === 'tripod' ? (
                      <CameraStand />
                    ) : update.deviceType === 'slider' ? (
                      <LinearScale />
                    ) : (
                      theming.getThemedIcon('business')
                    )}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Typography variant="subtitle1">
                        {update.deviceBrand} {update.deviceModel}
                      </Typography>
                      <Chip
                        size="small"
                        label={update.priority.toUpperCase()}
                        color={priorityConfig[update.priority].color}
                        icon={priorityConfig[update.priority].icon}
                      />
                      {update.securityUpdates.length > 0 && (
                        <Chip
                          size="small"
                          label="SIKKERHET"
                          color="error"
                          icon={theming.getThemedIcon('security')}
                        />
                      )}
                    </Box>
                }
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        {update.currentVersion} → {update.latestVersion}{' '}
                        {update.updateSize !== null ? `(${update.updateSize} MB)` : '(Ukjent størrelse)'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {update.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {priorityConfig[update.priority].urgency}
                      </Typography>
                    </Box>
                }
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => showReleaseNotes(update)}
                    startIcon={theming.getThemedIcon('info')}
                  >
                    Detaljer
                  </Button>
                  <Button size="small"
                    variant="contained"
                    onClick={() => {
                      setSelectedUpdate(update);
                      setUpdateDialogOpen(true);
                  }}
                    disabled={update.status === 'completed' || isUpdating}
                    startIcon={update.status === 'completed' ? theming.getThemedIcon('checkCircle') : theming.getThemedIcon('download')}
                    sx={{ bgcolor: color, '&:hover': { bgcolor: color } }}
                  >
                    {update.status === 'completed' ? 'Fullført' : 'Installer'}
                  </Button>
                </Box>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );

  const renderUpdatePrioritization = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Star sx={{ color }} />
        Oppdateringsprioritet
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Prioritetsnivåer
          </Typography>

          <List>
            {Object.entries(priorityConfig).map(([level, config]) => (
              <ListItem
                key={level}
                sx={{
                  border:  1,
                  borderColor: 'divider',
                  borderRadius:  1,
                  mb:  1}}
              >
                <ListItemIcon>
                  <Box sx={{ color: `${config.color}.main` }}>{config.icon}</Box>
                </ListItemIcon>
                <ListItemText
                  primary={level.charAt(0).toUpperCase() + level.slice(1)}
                  secondary={config.urgency}
                />
                <Chip
                  size="small"
                  label={availableUpdates.filter((u) => u.priority === level).length}
                  color={config.color}
                />
              </ListItem>
            ))}
          </List>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Automatiseringsregler
          </Typography>

          <FormControlLabel
            control={<Switch defaultChecked color="error" />}
            label="Installer kritiske oppdateringer automatisk"
            sx={{ display: 'block', mb:  1 }}
          />

          <FormControlLabel
            control={<Switch defaultChecked={false} color="warning" />}
            label="Installer sikkerhetsoppdateringer automatisk"
            sx={{ display: 'block', mb:  1 }}
          />

          <FormControlLabel
            control={<Switch defaultChecked={false} />}
            label="Installer funksjonsoppdateringer automatisk"
            sx={{ display: 'block', mb:  1 }}
          />

          <Alert severity="warning" sx={{ mt:  2 }}>
            <Typography variant="body2">
              Kritiske oppdateringer installeres utenfor arbeidstid (22: 00-06:00) for å unngå
              avbrudd
            </Typography>
          </Alert>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ mb:  2 }}>
        Planlegging av oppdateringer
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Foretrukket tid</InputLabel>
            <Select defaultValue="night" label="Foretrukket tid">
              <MenuItem value="immediate">Umiddelbart</MenuItem>
              <MenuItem value="night">Natt (22: 00-06:00)</MenuItem>
              <MenuItem value="weekend">Helger</MenuItem>
              <MenuItem value="manual">Manuell bekreftelse</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Maksimal nedtid</InputLabel>
            <Select defaultValue="30" label="Maksimal nedtid">
              <MenuItem value="15">15 minutter</MenuItem>
              <MenuItem value="30">30 minutter</MenuItem>
              <MenuItem value="60">1 time</MenuItem>
              <MenuItem value="120">2 timer</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Oppdateringskanal</InputLabel>
            <Select defaultValue="stable" label="Oppdateringskanal">
              <MenuItem value="stable">Stabil</MenuItem>
              <MenuItem value="beta">Beta</MenuItem>
              <MenuItem value="alpha">Alpha (kun testing)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderUpdateAutomation = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <AutoMode sx={{ color }} />
        Oppdateringsautomatisering
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Automatiseringsregler
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Typography variant="subtitle2">Kritiske oppdateringer</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FormControlLabel
                  control={<Switch defaultChecked color="error" />}
                  label="Automatisk nedlasting"
                />
                <FormControlLabel
                  control={<Switch defaultChecked color="error" />}
                  label="Automatisk installasjon"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Opprett sikkerhetskopi før installasjon"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Send varsling etter fullføring"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Typography variant="subtitle2">Sikkerhetsoppdateringer</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Automatisk nedlasting"
                />
                <FormControlLabel
                  control={<Switch defaultChecked={false} />}
                  label="Automatisk installasjon"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Krev godkjenning før installasjon"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Typography variant="subtitle2">Funksjonsoppdateringer</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Automatisk nedlasting"
                />
                <FormControlLabel
                  control={<Switch defaultChecked={false} />}
                  label="Automatisk installasjon"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Test i sandkasse-miljø først"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Monteringsfilter
          </Typography>

          <List>
            {DEVICE_CATEGORIES[profession].map((category, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {category.type === 'camera' ? (
                    <CameraAlt />
                  ) : category.type === 'lens' ? (
                    <Lens />
                  ) : category.type === 'software' ? (
                    theming.getThemedIcon('settings')
                  ) : category.type === 'audio' ? (
                    <MusicNote />
                  ) : category.type === 'lighting' ? (
                    <Lightbulb />
                  ) : category.type === 'flash' ? (
                    <FlashOn />
                  ) : category.type === 'memory' ? (
                    <SdCard />
                  ) : category.type === 'tripod' ? (
                    <CameraStand />
                  ) : category.type === 'slider' ? (
                    <LinearScale />
                  ) : (
                    theming.getThemedIcon('business')
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={category.type.charAt(0).toUpperCase() + category.type.slice(1)}
                  secondary={`${category.brands.length} merker støttet`}
                />
                <Switch defaultChecked />
              </ListItem>
            ))}
          </List>

          <Alert severity="info" sx={{ mt:  2 }}>
            <Typography variant="body2">
              Kun enheter fra godkjente merker vil bli automatisk oppdatert
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderUpdateHistory = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <History sx={{ color }} />
        Oppdateringshistorikk
      </Typography>

      {updateHistory.length > 0 ? (
        <Timeline>
          {updateHistory.map((update, index) => (
            <TimelineItem key={update.id}>
              <TimelineOppositeContent>
                <Typography variant="body2" color="text.secondary">
                  {new Date(update.completedAt).toLocaleDateString('no-NO')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(update.completedAt).toLocaleTimeString('no-NO')}
                </Typography>
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot color={priorityConfig[update.priority].color}>
                  {theming.getThemedIcon('checkCircle')}
                </TimelineDot>
                {index < updateHistory.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  {update.deviceBrand} {update.deviceModel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {update.currentVersion} → {update.latestVersion}
                </Typography>
                <Typography variant="body2">{update.description}</Typography>
                <Box sx={{ mt:  1 }}>
                  <Chip
                    size="small"
                    label={
                      update.duration !== null
                        ? `${update.duration} min`
                        : 'Ukjent tid'
                    }
                    icon={theming.getThemedIcon('schedule')}
                  />
                  <Chip
                    size="small"
                    label={update.priority}
                    color={priorityConfig[update.priority].color}
                    sx={{ ml:  1 }}
                  />
                </Box>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">Ingen oppdateringshistorikk ennå</Typography>
        </Alert>
      )}
    </Paper>
  );

  // Auto-check for updates on component mount
  useEffect(() => {
    if (!userId) return;
    checkForUpdates();

    // Set up periodic checks
    const interval = setInterval(checkForUpdates, 1000 * 60 * 30); // 30 minutes
    return () => clearInterval(interval);
  }, [userId, profession]);

  return (
    <Box sx={{ width: '100%' }}>
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb:  2}}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <SystemUpdateAlt sx={{ color, fontSize: 32}} />
              <Box>
                <Typography variant="h5" sx={{  color, fontWeight: 600}}>
                  Firmware-oppdateringsadministrasjon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatisk sjekking og prioritering av oppdateringer for
                  {profession === 'photographer'
                    ? 'fotografer'
                    : profession === 'videographer'
                      ? 'videografer'
                      : profession === 'musicproducer'
                        ? 'musikkprodusenter'
                        : 'leverandører'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Chip
                icon={<CloudSync />}
                label={autoUpdateEnabled ? 'Auto' : 'Manuell'}
                color={autoUpdateEnabled ? 'success' : 'default'}
                size="small"
              />
              <Chip
                icon={<NotificationImportant />}
                label={`${availableUpdates.filter((u) => u.priority === 'critical').length} kritiske`}
                color={
                  availableUpdates.filter((u) => u.priority === 'critical').length > 0
                    ? 'error'
                    : 'success'
              }
                size="small"
              />
              {isIntegrated && <Chip label="Integrert" size="small" />}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
          },
          '& .Mui-selected': {
            color: `${color} !important`,
          },
          '& .MuiTabs-indicator': {
            backgroundColor: color,
          },
        }}
      >
        <Tab icon={<SystemUpdateAlt />} iconPosition="start" label="Oppdateringsjekk" />
        <Tab icon={theming.getThemedIcon('star')} iconPosition="start" label="Prioritering" />
        <Tab icon={<AutoMode />} iconPosition="start" label="Automatisering" />
        <Tab icon={<History />} iconPosition="start" label="Historikk" />
      </Tabs>

      {activeTab === 0 && renderUpdateChecker()}
      {activeTab === 1 && renderUpdatePrioritization()}
      {activeTab === 2 && renderUpdateAutomation()}
      {activeTab === 3 && renderUpdateHistory()}

      {/* Update Installation Dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={() => !isUpdating && setUpdateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <SystemUpdateAlt sx={{ color }} />
            Installer oppdatering
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUpdate && (
            <Box>
              <Typography variant="h6" sx={{  mb:  2  }}>
                {selectedUpdate.deviceBrand} {selectedUpdate.deviceModel}
              </Typography>

              <Grid container spacing={2} sx={{ mb:  3 }}>
                <Grid item xs={6} >
                  <Typography variant="body2" color="text.secondary">
                    Nåværende versjon
                  </Typography>
                  <Typography variant="body1">{selectedUpdate.currentVersion}</Typography>
                </Grid>
                <Grid item xs={6} >
                  <Typography variant="body2" color="text.secondary">
                    Ny versjon
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600,color }}>
                    {selectedUpdate.latestVersion}
                  </Typography>
                </Grid>
                <Grid item xs={6} >
                  <Typography variant="body2" color="text.secondary">
                    Nedlastingsstørrelse
                  </Typography>
                  <Typography variant="body1">
                    {selectedUpdate.updateSize !== null
                      ? `${selectedUpdate.updateSize} MB`
                      : 'Ukjent'}
                  </Typography>
                </Grid>
                <Grid item xs={6} >
                  <Typography variant="body2" color="text.secondary">
                    Estimert tid
                  </Typography>
                  <Typography variant="body1">
                    {selectedUpdate.installationTime !== null
                      ? `${selectedUpdate.installationTime} minutter`
                      : 'Ukjent'}
                  </Typography>
                </Grid>
              </Grid>

              {selectedUpdate.backupRequired && (
                <Alert severity="warning" sx={{ mb:  2 }}>
                  <Typography variant="body2">
                    Denne oppdateringen krever sikkerhetskopi. All data vil bli sikkerhetskopiert
                    automatisk.
                  </Typography>
                </Alert>
              )}

              {selectedUpdate.restartRequired && (
                <Alert severity="info" sx={{ mb:  2 }}>
                  <Typography variant="body2">
                    Enheten vil starte på nytt etter installasjon.
                  </Typography>
                </Alert>
              )}

              {isUpdating && (
                <Box sx={{ mt:  2 }}>
                  <LinearProgress sx={{ mb:  2 }} />
                  <Typography variant="body2" color="text.secondary" align="center">
                    Installerer oppdatering...
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialogOpen(false)} disabled={isUpdating}>
            Avbryt
          </Button>
          <Button
            onClick={() => selectedUpdate && startUpdate(selectedUpdate)}
            variant="contained"
            disabled={isUpdating}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color } }}
          >
            {isUpdating ? 'Installerer...' : 'Start installasjon'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Release Notes Dialog */}
      <Dialog
        open={releaseNotesDialogOpen}
        onClose={() => setReleaseNotesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <NewReleases sx={{ color }} />
            Versjonsnotater
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentReleaseNotes && (
            <Box>
              <Typography variant="h6" sx={{  mb:  2  }}>
                {currentReleaseNotes.deviceBrand} {currentReleaseNotes.deviceModel} v
                {currentReleaseNotes.latestVersion}
              </Typography>

              <Typography variant="body1" sx={{ mb:  3 }}>
                {currentReleaseNotes.description}
              </Typography>

              {currentReleaseNotes.newFeatures.length > 0 && (
                <Box sx={{ mb:  3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mb:  1,
                      display: 'flex',
                      alignItems: 'center',
                      gap:  1}}
                  >
                    <NewReleases sx={{ color: 'success.main' }} />
                    Nye funksjoner
                  </Typography>
                  <List dense>
                    {currentReleaseNotes.newFeatures.map((feature, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle sx={{ color: 'success.main', fontSize: 16}} />
                        </ListItemIcon>
                        <ListItemText primary={feature} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {currentReleaseNotes.bugFixes.length > 0 && (
                <Box sx={{ mb:  3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mb:  1,
                      display: 'flex',
                      alignItems: 'center',
                      gap:  1}}
                  >
                    <BugReport sx={{ color: 'warning.main' }} />
                    Feilrettinger
                  </Typography>
                  <List dense>
                    {currentReleaseNotes.bugFixes.map((fix, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle sx={{ color: 'warning.main', fontSize: 16}} />
                        </ListItemIcon>
                        <ListItemText primary={fix} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {currentReleaseNotes.securityUpdates.length > 0 && (
                <Box sx={{ mb:  3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mb:  1,
                      display: 'flex',
                      alignItems: 'center',
                      gap:  1}}
                  >
                    <Security sx={{ color: 'error.main' }} />
                    Sikkerhetsoppdateringer
                  </Typography>
                  <List dense>
                    {currentReleaseNotes.securityUpdates.map((security, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Security sx={{ color:'error.main', fontSize: 16}} />
                        </ListItemIcon>
                        <ListItemText primary={security} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReleaseNotesDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
