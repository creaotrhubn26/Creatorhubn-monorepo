import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Switch,
  FormControlLabel,
  Badge,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Refresh,
  NewReleases,
  Update,
  CameraAlt,
  CheckCircle,
  Error,
  Info,
  Settings,
  AutoAwesome,
  Videocam,
  PhotoCamera,
  ExpandMore,
  TrendingUp,
  Timeline,
} from '@mui/icons-material';
import { videoCameraDiscovery, VideoCameraDiscoveryResult } from '../../data/video-camera-discovery';
import { photoCameraDiscovery, CameraDiscoveryResult } from '../../data/photo-camera-discovery';
import { Camera } from '../../data/video-camera-database';
import { PhotoCamera as PhotoCameraType } from '../../data/photo-camera-database';

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
      id={`camera-tabpanel-${index}`}
      aria-labelledby={`camera-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface CombinedCameraDiscoveryManagerProps {
  onVideoCameraUpdate?: (cameras: Camera[]) => void;
  onPhotoCameraUpdate?: (cameras: PhotoCameraType[]) => void;
}

export const CombinedCameraDiscoveryManager: React.FC<CombinedCameraDiscoveryManagerProps> = ({
  onVideoCameraUpdate,
  onPhotoCameraUpdate
}) => {
  // Theming system
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState(0);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [videoResults, setVideoResults] = useState<VideoCameraDiscoveryResult[]>([]);
  const [photoResults, setPhotoResults] = useState<CameraDiscoveryResult[]>([]);
  const [videoNewCameras, setVideoNewCameras] = useState<Camera[]>([]);
  const [photoNewCameras, setPhotoNewCameras] = useState<PhotoCameraType[]>([]);
  const [videoRecentlyUpdated, setVideoRecentlyUpdated] = useState<Camera[]>([]);
  const [photoRecentlyUpdated, setPhotoRecentlyUpdated] = useState<PhotoCameraType[]>([]);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [photoStatus, setPhotoStatus] = useState<any>(null);
  const [showNewOnly, setShowNewOnly] = useState(false);

  useEffect(() => {
    // Load initial data
    loadDiscoveryData();
    
    // Subscribe to updates if methods exist
    const videoDiscovery = videoCameraDiscovery as any;
    const photoDiscovery = photoCameraDiscovery as any;
    
    if (typeof videoDiscovery.onCameraUpdate === 'function') {
      videoDiscovery.onCameraUpdate(handleVideoCameraUpdate);
    }
    if (typeof photoDiscovery.onCameraUpdate === 'function') {
      photoDiscovery.onCameraUpdate(handlePhotoCameraUpdate);
    }
    
    return () => {
      if (typeof videoDiscovery.offCameraUpdate === 'function') {
        videoDiscovery.offCameraUpdate(handleVideoCameraUpdate);
      }
      if (typeof photoDiscovery.offCameraUpdate === 'function') {
        photoDiscovery.offCameraUpdate(handlePhotoCameraUpdate);
      }
    };
  }, []);

  const loadDiscoveryData = () => {
    const videoDiscovery = videoCameraDiscovery as any;
    const photoDiscovery = photoCameraDiscovery as any;
    
    // Get discovery status if methods exist
    const videoStatus = typeof videoDiscovery.getDiscoveryStatus === 'function' 
      ? videoDiscovery.getDiscoveryStatus() 
      : null;
    const photoStatus = typeof photoDiscovery.getDiscoveryStatus === 'function' 
      ? photoDiscovery.getDiscoveryStatus() 
      : null;
    
    setVideoStatus(videoStatus);
    setPhotoStatus(photoStatus);
    
    // Get cameras by status if methods exist
    const videoNew = typeof videoDiscovery.getCamerasByStatus === 'function'
      ? videoDiscovery.getCamerasByStatus('new,')
      : [];
    const videoRecent = typeof videoDiscovery.getCamerasByStatus === 'function'
      ? videoDiscovery.getCamerasByStatus('recently-updated')
      : [];
    const photoNew = typeof photoDiscovery.getCamerasByStatus === 'function'
      ? photoDiscovery.getCamerasByStatus('new')
      : [];
    const photoRecent = typeof photoDiscovery.getCamerasByStatus === 'function'
      ? photoDiscovery.getCamerasByStatus('recently-updated')
      : [];
    
    setVideoNewCameras(videoNew);
    setVideoRecentlyUpdated(videoRecent);
    setPhotoNewCameras(photoNew);
    setPhotoRecentlyUpdated(photoRecent);
  };

  const handleVideoCameraUpdate = (cameras: Camera[]) => {
    setVideoNewCameras(prev => [...prev, ...cameras]);
    onVideoCameraUpdate?.(cameras);
    loadDiscoveryData();
};

  const handlePhotoCameraUpdate = (cameras: PhotoCameraType[]) => {
    setPhotoNewCameras(prev => [...prev, ...cameras]);
    onPhotoCameraUpdate?.(cameras);
    loadDiscoveryData();
};

  const handleTriggerDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const videoDiscovery = videoCameraDiscovery as any;
      const photoDiscovery = photoCameraDiscovery as any;
      const promises = [];
      
      if (typeof videoDiscovery.triggerDiscovery === 'function') {
        promises.push(videoDiscovery.triggerDiscovery());
      } else {
        promises.push(Promise.resolve([]));
      }
      
      if (typeof photoDiscovery.triggerDiscovery === 'function') {
        promises.push(photoDiscovery.triggerDiscovery());
      } else {
        promises.push(Promise.resolve([]));
      }
      
      const [videoResults, photoResults] = await Promise.all(promises);
      setVideoResults(videoResults);
      setPhotoResults(photoResults);
      loadDiscoveryData();
    } catch (error) {
      console.error('Discovery failed: ', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? <CheckCircle color="success" /> : <Error color="error" />;
};

  const getStatusColor = (success: boolean) => {
    return success ? 'success' : 'error';
};

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
};

  const getCameraStatusChips = (camera: Camera | PhotoCameraType) => {
    const chips = [];
    
    if (camera.isNew) {
      chips.push(
        <Chip
          key="new"
          icon={<NewReleases />}
          label="NEW"
          color="primary"
          size="small"
          sx={{ mr: 1 }}
        />
      );
  }
    
    if (camera.isRecentlyUpdated) {
      chips.push(
        <Chip
          key="updated"
          icon={<Update />}
          label="UPDATED"
          color="secondary"
          size="small"
          sx={{ mr: 1 }}
        />
      );
  }
    
    if (camera.source === 'api') {
      chips.push(
        <Chip
          key="auto"
          icon={<AutoAwesome />}
          label="AUTO-DISCOVERED"
          color="info"
          size="small"
        />
      );
  }
    
    return chips;
};

  const renderCameraCard = (camera: Camera | PhotoCameraType, isVideo: boolean) => (
    <Grid item xs={12} sm={6} md={4} key={camera.id}>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isVideo ? <Videocam color="primary" sx={{ mr: 1 }} /> : <PhotoCamera color="secondary" sx={{ mr: 1 }} />}
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {camera.brand} {camera.model}
              </Typography>
            </Box>
            <Box>
              {getCameraStatusChips(camera)}
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {camera.description}
          </Typography>
          {isVideo && 'logFormats' in camera && camera.logFormats && camera.logFormats.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                LOG: {camera.logFormats.join(', ')}
              </Typography>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">
            Added: {formatDate(camera.addedDate)}
          </Typography>
        </CardContent>
        <CardActions sx={theming.getThemedCardSx()}>
          <Button size="small">View Details</Button>
          <Button size="small">Add to Favorites</Button>
        </CardActions>
      </Card>
    </Grid>
  );

  const renderDiscoveryResults = (results: any[], title: string) => (
    <Paper sx={{ p: 3, mb: 3 }} component="div">
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        {title}
      </Typography>
      <List>
        {results.map((result, index) => (
          <ListItem key={index}>
            <ListItemIcon>
              {getStatusIcon(result.success)}
            </ListItemIcon>
            <ListItemText
              primary={result.source}
              secondary={
                result.success 
                  ? `Found ${result.cameras.length} cameras at ${formatDate(result.timestamp)}`
                  : `Error: ${result.error}`
            }
            />
            <Chip
              label={result.success ? 'Success' : 'Failed'}
              color={getStatusColor(result.success)}
              size="small"
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        📸🎬 Combined Camera Discovery Manager
      </Typography>
      
      {/* Overall Status Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                Total Cameras
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {(videoStatus?.totalCameras || 0) + (photoStatus?.totalCameras || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                New Cameras
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                <Badge badgeContent={videoNewCameras.length + photoNewCameras.length} color="primary">
                  {videoNewCameras.length + photoNewCameras.length}
                </Badge>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                Recently Updated
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                <Badge badgeContent={videoRecentlyUpdated.length + photoRecentlyUpdated.length} color="secondary">
                  {videoRecentlyUpdated.length + photoRecentlyUpdated.length}
                </Badge>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="info.main" sx={{ color: theming.colors.primary }}>
                Data Sources
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {(videoStatus?.enabledSources || 0) + (photoStatus?.enabledSources || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Discovery Controls */}
      <Paper sx={{ p: 3, mb: 3 }} component="div">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Discovery Controls
          </Typography>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showNewOnly}
                  onChange={(e) => setShowNewOnly(e.target.checked)}
                />
            }
              label="Show New/Updated Only"
            />
            <Button
              variant="contained"
              startIcon={isDiscovering ? <CircularProgress size={20} /> : <Refresh />}
              onClick={handleTriggerDiscovery}
              disabled={isDiscovering}
              sx={{ ml: 2 }}
            >
              {isDiscovering ? 'Discovering...' : 'Trigger Discovery'}
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Video Last Update: {videoStatus?.lastUpdate ? formatDate(videoStatus.lastUpdate) : 'Never'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Photo Last Update: {photoStatus?.lastUpdate ? formatDate(photoStatus.lastUpdate) : 'Never'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs for Video and Photo */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Videocam sx={{ mr: 1 }} />
                Video Cameras
                <Badge badgeContent={videoNewCameras.length} color="primary" sx={{ ml: 1 }} />
              </Box>
          } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PhotoCamera sx={{ mr: 1 }} />
                Photo Cameras
                <Badge badgeContent={photoNewCameras.length} color="primary" sx={{ ml: 1 }} />
              </Box>
          } 
          />
        </Tabs>
      </Box>

      {/* Video Cameras Tab */}
      <TabPanel value={activeTab} index={0}>
        {videoResults.length > 0 && renderDiscoveryResults(videoResults, 'Latest Video Discovery Results')}
        
        {videoNewCameras.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }} component="div">
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              🆕 New Video Cameras ({videoNewCameras.length})
            </Typography>
            <Grid container spacing={2}>
              {videoNewCameras.map((camera) => renderCameraCard(camera, true))}
            </Grid>
          </Paper>
        )}

        {videoRecentlyUpdated.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }} component="div">
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              🔄 Recently Updated Video Cameras ({videoRecentlyUpdated.length})
            </Typography>
            <Grid container spacing={2}>
              {videoRecentlyUpdated.map((camera) => renderCameraCard(camera, true))}
            </Grid>
          </Paper>
        )}

        {videoNewCameras.length === 0 && videoRecentlyUpdated.length === 0 && (
          <Paper sx={{ p: 3, textAlign: 'center' }} component="div">
            <Videocam sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
              No new or updated video cameras found
            </Typography>
          </Paper>
        )}
      </TabPanel>

      {/* Photo Cameras Tab */}
      <TabPanel value={activeTab} index={1}>
        {photoResults.length > 0 && renderDiscoveryResults(photoResults, 'Latest Photo Discovery Results')}
        
        {photoNewCameras.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }} component="div">
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              🆕 New Photo Cameras ({photoNewCameras.length})
            </Typography>
            <Grid container spacing={2}>
              {photoNewCameras.map((camera) => renderCameraCard(camera, false))}
            </Grid>
          </Paper>
        )}

        {photoRecentlyUpdated.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }} component="div">
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              🔄 Recently Updated Photo Cameras ({photoRecentlyUpdated.length})
            </Typography>
            <Grid container spacing={2}>
              {photoRecentlyUpdated.map((camera) => renderCameraCard(camera, false))}
            </Grid>
          </Paper>
        )}

        {photoNewCameras.length === 0 && photoRecentlyUpdated.length === 0 && (
          <Paper sx={{ p: 3, textAlign: 'center' }} component="div">
            <PhotoCamera sx={{ fontSize: 64, color:'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
              No new or updated photo cameras found
            </Typography>
          </Paper>
        )}
      </TabPanel>
    </Box>
  );
};

export default CombinedCameraDiscoveryManager;














