import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Error as ErrorIcon,
  NewReleases,
  PhotoCamera,
  Refresh,
  Update,
  Videocam,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import {
  photoCameraDiscovery,
  type CameraDiscoveryResult,
  type CameraDiscoveryStatus,
} from '../../data/photo-camera-discovery';
import {
  videoCameraDiscovery,
  type VideoCameraDiscoveryResult,
  type VideoCameraDiscoveryStatus,
} from '../../data/video-camera-discovery';
import type { PhotoCamera as PhotoCameraType } from '../../data/photo-camera-database';
import type { Camera as VideoCameraType } from '../../data/video-camera-database';
import { AdminCard, AdminButton, StatusChip, AdminEmpty } from './design-system';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`camera-tabpanel-${index}`}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface CombinedCameraDiscoveryManagerProps {
  onVideoCameraUpdate?: (cameras: VideoCameraType[]) => void;
  onPhotoCameraUpdate?: (cameras: PhotoCameraType[]) => void;
}

const emptyVideoStatus: VideoCameraDiscoveryStatus = {
  totalSources: 0,
  enabledSources: 0,
  lastUpdate: '',
  totalCameras: 0,
  newCameras: 0,
  recentlyUpdated: 0,
  inserted: 0,
  updated: 0,
  rejected: 0,
  conflicts: 0,
  logFormats: [],
  brands: [],
};

const emptyPhotoStatus: CameraDiscoveryStatus = {
  totalSources: 0,
  enabledSources: 0,
  lastUpdate: '',
  totalCameras: 0,
  newCameras: 0,
  recentlyUpdated: 0,
  inserted: 0,
  updated: 0,
  rejected: 0,
  conflicts: 0,
};

const formatDate = (value?: string): string => {
  if (!value) return 'Aldri';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Aldri';
  return parsed.toLocaleString('nb-NO');
};

const CombinedCameraDiscoveryManager: React.FC<CombinedCameraDiscoveryManagerProps> = ({
  onVideoCameraUpdate,
  onPhotoCameraUpdate,
}) => {
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState(0);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);

  const [videoResults, setVideoResults] = useState<VideoCameraDiscoveryResult[]>([]);
  const [photoResults, setPhotoResults] = useState<CameraDiscoveryResult[]>([]);
  const [videoStatus, setVideoStatus] = useState<VideoCameraDiscoveryStatus>(emptyVideoStatus);
  const [photoStatus, setPhotoStatus] = useState<CameraDiscoveryStatus>(emptyPhotoStatus);
  const [videoNew, setVideoNew] = useState<VideoCameraType[]>([]);
  const [videoRecent, setVideoRecent] = useState<VideoCameraType[]>([]);
  const [photoNew, setPhotoNew] = useState<PhotoCameraType[]>([]);
  const [photoRecent, setPhotoRecent] = useState<PhotoCameraType[]>([]);

  const loadDiscoveryData = useCallback(() => {
    const nextVideoStatus = videoCameraDiscovery.getDiscoveryStatus();
    const nextPhotoStatus = photoCameraDiscovery.getDiscoveryStatus();

    setVideoStatus(nextVideoStatus);
    setPhotoStatus(nextPhotoStatus);

    setVideoNew(videoCameraDiscovery.getCamerasByStatus('new'));
    setVideoRecent(videoCameraDiscovery.getCamerasByStatus('recently-updated'));
    setPhotoNew(photoCameraDiscovery.getCamerasByStatus('new'));
    setPhotoRecent(photoCameraDiscovery.getCamerasByStatus('recently-updated'));
  }, []);

  useEffect(() => {
    const handleVideoUpdate = (cameras: VideoCameraType[]) => {
      onVideoCameraUpdate?.(cameras);
      loadDiscoveryData();
    };

    const handlePhotoUpdate = (cameras: PhotoCameraType[]) => {
      onPhotoCameraUpdate?.(cameras);
      loadDiscoveryData();
    };

    videoCameraDiscovery.onCameraUpdate(handleVideoUpdate);
    photoCameraDiscovery.onCameraUpdate(handlePhotoUpdate);
    loadDiscoveryData();

    return () => {
      videoCameraDiscovery.offCameraUpdate(handleVideoUpdate);
      photoCameraDiscovery.offCameraUpdate(handlePhotoUpdate);
    };
  }, [loadDiscoveryData, onPhotoCameraUpdate, onVideoCameraUpdate]);

  const handleTriggerDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const [nextVideoResults, nextPhotoResults] = await Promise.all([
        videoCameraDiscovery.triggerDiscovery(),
        photoCameraDiscovery.triggerDiscovery(),
      ]);
      setVideoResults(nextVideoResults);
      setPhotoResults(nextPhotoResults);
      loadDiscoveryData();
    } finally {
      setIsDiscovering(false);
    }
  };

  const renderDiscoveryResults = (
    results: Array<VideoCameraDiscoveryResult | CameraDiscoveryResult>,
    title: string
  ) => {
    if (results.length === 0) return null;

    return (
      <AdminCard title={title} sx={{ mb: 3 }}>
        <List>
          {results.map((result, index) => (
            <ListItem key={`${result.source}-${result.timestamp}-${index}`}>
              <ListItemIcon>
                {result.success ? <CheckCircle color="success" /> : <ErrorIcon color="error" />}
              </ListItemIcon>
              <ListItemText
                primary={result.source}
                secondary={
                  result.success
                    ? `Inn: ${result.inserted ?? 0}, Oppdatert: ${result.updated ?? 0}, Avvist: ${result.rejected ?? 0}, Konflikter: ${result.conflicts ?? 0}`
                    : `Feil: ${result.error ?? 'Ukjent feil'}`
                }
              />
              <StatusChip
                tone={result.success ? 'success' : 'error'}
                label={result.success ? 'Synk fullført' : 'Synk feilet'}
              />
            </ListItem>
          ))}
        </List>
      </AdminCard>
    );
  };

  const renderCameraCard = (
    camera: VideoCameraType | PhotoCameraType,
    isVideo: boolean
  ) => {
    const addedLabel = camera.addedDate ? formatDate(camera.addedDate) : formatDate(camera.lastSeenAt);

    return (
      <Grid item xs={12} sm={6} md={4} key={camera.id}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {isVideo ? <Videocam color="primary" /> : <PhotoCamera color="secondary" />}
              <Typography variant="subtitle1" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
                {camera.brand} {camera.model}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {camera.description}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {camera.isNew && <Chip size="small" icon={<NewReleases />} label="Ny" color="primary" />}
              {camera.isRecentlyUpdated && <Chip size="small" icon={<Update />} label="Oppdatert" color="secondary" />}
              {camera.source && camera.source !== 'manual' && (
                <Chip size="small" icon={<AutoAwesome />} label={camera.source.toUpperCase()} variant="outlined" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Sist sett: {formatDate(camera.lastSeenAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Lagt til: {addedLabel}
            </Typography>
          </CardContent>
          <CardActions sx={theming.getThemedCardSx()}>
            <Button size="small">Detaljer</Button>
          </CardActions>
        </Card>
      </Grid>
    );
  };

  const filteredVideoCameras = useMemo(() => {
    if (!showNewOnly) return videoCameraDiscovery.getCamerasByStatus('all').slice(0, 120);
    const recentById = new Set(videoRecent.map((camera) => camera.id));
    return [...videoNew, ...videoRecent.filter((camera) => !recentById.has(camera.id))];
  }, [showNewOnly, videoNew, videoRecent]);

  const filteredPhotoCameras = useMemo(() => {
    if (!showNewOnly) return photoCameraDiscovery.getCamerasByStatus('all').slice(0, 120);
    const recentById = new Set(photoRecent.map((camera) => camera.id));
    return [...photoNew, ...photoRecent.filter((camera) => !recentById.has(camera.id))];
  }, [showNewOnly, photoNew, photoRecent]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h2" gutterBottom sx={{ color: theming.colors.primary }}>
        Combined Camera Discovery Manager
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                Total Cameras
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {videoStatus.totalCameras + photoStatus.totalCameras}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                Inserted
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {videoStatus.inserted + photoStatus.inserted}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                Updated
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {videoStatus.updated + photoStatus.updated}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                Rejected/Conflicts
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {videoStatus.rejected + photoStatus.rejected + videoStatus.conflicts + photoStatus.conflicts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AdminCard
        title="Discovery Controls (Admin)"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Switch checked={showNewOnly} onChange={(event) => setShowNewOnly(event.target.checked)} />}
              label="Only New/Updated"
            />
            <AdminButton
              tone="primary"
              loading={isDiscovering}
              startIcon={<Refresh />}
              onClick={handleTriggerDiscovery}
              disabled={isDiscovering}
              sx={{ ml: 2 }}
            >
              {isDiscovering ? 'Syncing...' : 'Run Discovery Sync'}
            </AdminButton>
          </Box>
        }
        sx={{ mb: 3 }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Video last sync: {formatDate(videoStatus.lastUpdate)}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Photo last sync: {formatDate(photoStatus.lastUpdate)}
            </Typography>
          </Grid>
        </Grid>
      </AdminCard>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, value: number) => setActiveTab(value)}>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Videocam sx={{ mr: 1 }} />
                Video Cameras
                <Badge badgeContent={videoNew.length} color="primary" sx={{ ml: 1 }} />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PhotoCamera sx={{ mr: 1 }} />
                Photo Cameras
                <Badge badgeContent={photoNew.length} color="primary" sx={{ ml: 1 }} />
              </Box>
            }
          />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {renderDiscoveryResults(videoResults, 'Latest Video Discovery Result')}
        {filteredVideoCameras.length === 0 ? (
          <AdminEmpty
            icon={<Videocam sx={{ fontSize: 48 }} />}
            title="Ingen videokamera-data tilgjengelig."
          />
        ) : (
          <Grid container spacing={2}>
            {filteredVideoCameras.map((camera) => renderCameraCard(camera, true))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderDiscoveryResults(photoResults, 'Latest Photo Discovery Result')}
        {filteredPhotoCameras.length === 0 ? (
          <AdminEmpty
            icon={<PhotoCamera sx={{ fontSize: 48 }} />}
            title="Ingen fotokamera-data tilgjengelig."
          />
        ) : (
          <Grid container spacing={2}>
            {filteredPhotoCameras.map((camera) => renderCameraCard(camera, false))}
          </Grid>
        )}
      </TabPanel>
    </Box>
  );
};

export default CombinedCameraDiscoveryManager;
