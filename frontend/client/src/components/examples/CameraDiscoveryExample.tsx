import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Badge,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Videocam,
  PhotoCamera,
  Refresh,
  NewReleases,
  Update
} from '@mui/icons-material';
import { useCameraDiscovery } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { Camera } from '../../data/video-camera-database';
import { PhotoCamera as PhotoCameraType } from '../../data/photo-camera-database';

/**
 * Example component showing how to use the Camera Discovery System
 * integrated with EnhancedMasterIntegrationProvider
 */
export const CameraDiscoveryExample: React.FC = () => {
  const cameraDiscovery = useCameraDiscovery();
  
  // Theming system
  const theming = useTheming('photographer');
  const [isLoading, setIsLoading] = useState(false);
  const [videoCameras, setVideoCameras] = useState<Camera[]>([]);
  const [photoCameras, setPhotoCameras] = useState<PhotoCameraType[]>([]);
  const [newVideoCameras, setNewVideoCameras] = useState<Camera[]>([]);
  const [newPhotoCameras, setNewPhotoCameras] = useState<PhotoCameraType[]>([]);
  const [discoveryStatus, setDiscoveryStatus] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    loadCameraData();
}, []);

  // Subscribe to camera updates
  useEffect(() => {
    const handleVideoUpdate = (cameras: Camera[]) => {
      setNewVideoCameras(prev => [...prev, ...cameras]);
      loadCameraData(); // Refresh the full list
  };

    const handlePhotoUpdate = (cameras: PhotoCameraType[]) => {
      setNewPhotoCameras(prev => [...prev, ...cameras]);
      loadCameraData(); // Refresh the full list
  };

    cameraDiscovery.video.onCameraUpdate(handleVideoUpdate);
    cameraDiscovery.photo.onCameraUpdate(handlePhotoUpdate);

    return () => {
      cameraDiscovery.video.offCameraUpdate(handleVideoUpdate);
      cameraDiscovery.photo.offCameraUpdate(handlePhotoUpdate);
  };
}, [cameraDiscovery]);

  const loadCameraData = () => {
    setVideoCameras(cameraDiscovery.video.getCameras());
    setPhotoCameras(cameraDiscovery.photo.getCameras());
    setNewVideoCameras(cameraDiscovery.video.getNewCameras());
    setNewPhotoCameras(cameraDiscovery.photo.getNewCameras());
    setDiscoveryStatus({
      video: cameraDiscovery.video.getDiscoveryStatus(),
      photo: cameraDiscovery.photo.getDiscoveryStatus()
  ,});
};

  const handleTriggerDiscovery = async () => {
    setIsLoading(true);
    try {
      const results = await cameraDiscovery.triggerFullDiscovery();
      console.log('Discovery results:', results);
      loadCameraData();
  } catch (error) {
      console.error('Discovery failed: ', error);
  } finally {
      setIsLoading(false);
  }
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
          sx={{ mr:  1 }}
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
          sx={{ mr:  1 }}
        />
      );
  }
    
    return chips;
};

  const renderCameraCard = (camera: Camera | PhotoCameraType, isVideo: boolean) => (
    <Grid item xs={2} sm={6} md={4} key={camera.id}>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isVideo ? <Videocam color="primary" sx={{ mr:  1 }} /> : <PhotoCamera color="secondary" sx={{ mr:  1 }} />}
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {camera.brand} {camera.model}
              </Typography>
            </Box>
            <Box>
              {getCameraStatusChips(camera)}
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
            {camera.description}
          </Typography>
          {isVideo && 'logFormats' in camera && camera.logFormats.length > 0 && (
            <Box sx={{ mb:  1 }}>
              <Typography variant="caption" color="text.secondary">
                LOG: {camera.logFormats.join(', ')}
              </Typography>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">
            Added: {new Date(camera.addedDate).toLocaleDateString()}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        📸🎬 Camera Discovery System Example
      </Typography>
      
      {/* Status Overview */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                Total Cameras
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {videoCameras.length + photoCameras.length}
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
                <Badge badgeContent={newVideoCameras.length + newPhotoCameras.length} color="primary">
                  {newVideoCameras.length + newPhotoCameras.length}
                </Badge>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="info.main" sx={{ color: theming.colors.primary }}>
                Video Cameras
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {videoCameras.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="secondary.main" sx={{ color: theming.colors.primary }}>
                Photo Cameras
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {photoCameras.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Discovery Controls */}
      <Box sx={{ mb:  3 }}>
        <Button variant="contained"
          startIcon={isLoading ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('refresh')}
          onClick={handleTriggerDiscovery}
          disabled={isLoading}
          sx={{ mr:  2 }}
        >
          {isLoading ? 'Discovering...' : 'Trigger Discovery'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={loadCameraData}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Discovery Status */}
      {discoveryStatus && (
        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="body2">
            <strong>Video Sources: </strong> {discoveryStatus.video?.enabledSources || 0}/{discoveryStatus.video?.totalSources || 0} | 
            <strong> Photo Sources: </strong> {discoveryStatus.photo?.enabledSources || 0}/{discoveryStatus.photo?.totalSources || 0}
          </Typography>
        </Alert>
      )}

      {/* New Video Cameras */}
      {newVideoCameras.length > 0 && (
        <Box sx={{ mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🆕 New Video Cameras ({newVideoCameras.length})
          </Typography>
          <Grid container spacing={2}>
            {newVideoCameras.map((camera) => renderCameraCard(camera, true))}
          </Grid>
        </Box>
      )}

      {/* New Photo Cameras */}
      {newPhotoCameras.length > 0 && (
        <Box sx={{ mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🆕 New Photo Cameras ({newPhotoCameras.length})
          </Typography>
          <Grid container spacing={2}>
            {newPhotoCameras.map((camera) => renderCameraCard(camera, false))}
          </Grid>
        </Box>
      )}

      {/* All Cameras */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          All Cameras ({videoCameras.length + photoCameras.length})
        </Typography>
        <Grid container spacing={2}>
          {videoCameras.map((camera) => renderCameraCard(camera, true))}
          {photoCameras.map((camera) => renderCameraCard(camera, false))}
        </Grid>
      </Box>
    </Box>
  );
};

export default CameraDiscoveryExample;














