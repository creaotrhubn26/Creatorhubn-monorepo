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
  IconButton
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
  AutoAwesome
} from '@mui/icons-material';
import { photoCameraDiscovery, CameraDiscoveryResult } from '../../data/photo-camera-discovery';
import { PhotoCamera } from '../../data/photo-camera-database';

interface PhotoCameraDiscoveryManagerProps {
  onCameraUpdate?: (cameras: PhotoCamera[]) => void;
}

export const PhotoCameraDiscoveryManager: React.FC<PhotoCameraDiscoveryManagerProps> = ({
  onCameraUpdate
}) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [discoveryResults, setDiscoveryResults] = useState<CameraDiscoveryResult[]>([]);
  const [newCameras, setNewCameras] = useState<PhotoCamera[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<PhotoCamera[]>([]);
  const [discoveryStatus, setDiscoveryStatus] = useState<any>(null);
  const [showNewOnly, setShowNewOnly] = useState(false);

  useEffect(() => {
    // Load initial data
    loadDiscoveryData();
    
    // Subscribe to updates
    photoCameraDiscovery.onCameraUpdate(handleCameraUpdate);
    
    return () => {
      photoCameraDiscovery.offCameraUpdate(handleCameraUpdate);
  };
}, []);

  const loadDiscoveryData = () => {
    const status = photoCameraDiscovery.getDiscoveryStatus();
    setDiscoveryStatus(status);
    
    const newCams = photoCameraDiscovery.getCamerasByStatus('new');
    const recentCams = photoCameraDiscovery.getCamerasByStatus('recently-updated');
    
    setNewCameras(newCams);
    setRecentlyUpdated(recentCams);
};

  const handleCameraUpdate = (cameras: PhotoCamera[]) => {
    setNewCameras(prev => [...prev, ...cameras]);
    onCameraUpdate?.(cameras);
    loadDiscoveryData();
};

  const handleTriggerDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const results = await photoCameraDiscovery.triggerDiscovery();
      setDiscoveryResults(results);
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

  const getCameraStatusChips = (camera: PhotoCamera) => {
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
    
    if (camera.source === 'api') {
      chips.push(
        <Chip
          key="auto"
          icon={theming.getThemedIcon('autoAwesome')}}
          label="AUTO-DISCOVERED"
          color="info"
          size="small"
        />
      );
  }
    
    return chips;
};

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        📸 Photo Camera Discovery Manager
      </Typography>
      
      {/* Status Overview */}
      <Grid container spacing={3}, sx={{ mb:  3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                Total Cameras
              </Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {discoveryStatus?.totalCameras || 0}
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
                <Badge badgeContent={newCameras.length} color="primary">
                  {newCameras.length}
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
                <Badge badgeContent={recentlyUpdated.length} color="secondary">
                  {recentlyUpdated.length}
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
                {discoveryStatus?.enabledSources || 0}/{discoveryStatus?.totalSources || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Discovery Controls */}
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
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
            <Button variant="contained"
              startIcon={isDiscovering ? <CircularProgress size={20}, sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('refresh')}
              onClick={handleTriggerDiscovery}
              disabled={isDiscovering}
              sx={{ ml:  2 }}
            >
              {isDiscovering ? 'Discovering...' : 'Trigger Discovery'}
            </Button>
          </Box>
        </Box>
        
        {discoveryStatus?.lastUpdate && (
          <Typography variant="body2" color="text.secondary">
            Last Update: {formatDate(discoveryStatus.lastUpdate)}
          </Typography>
        )}
      </Paper>

      {/* Discovery Results */}
      {discoveryResults.length > 0 && (
        <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Latest Discovery Results
          </Typography>
          <List>
            {discoveryResults.map((result, index) => (
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
      )}

      {/* New Cameras */}
      {newCameras.length > 0 && (
        <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🆕 New Cameras ({newCameras.length})
          </Typography>
          <Grid container spacing={2}>
            {newCameras.map((camera) => (
              <Grid item xs={12} sm={6} md={4} key={camera.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {camera.brand} {camera.model}
                      </Typography>
                      <Box>
                        {getCameraStatusChips(camera)}
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      {camera.description}
                    </Typography>
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
            ))}
          </Grid>
        </Paper>
      )}

      {/* Recently Updated Cameras */}
      {recentlyUpdated.length > 0 && (
        <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🔄 Recently Updated Cameras ({recentlyUpdated.length})
          </Typography>
          <Grid container spacing={2}>
            {recentlyUpdated.map((camera) => (
              <Grid item xs={12} sm={6} md={4} key={camera.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {camera.brand} {camera.model}
                      </Typography>
                      <Box>
                        {getCameraStatusChips(camera)}
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      {camera.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Updated: {formatDate(camera.lastUpdated)}
                    </Typography>
                  </CardContent>
                  <CardActions sx={theming.getThemedCardSx()}>
                    <Button size="small">View Changes</Button>
                    <Button size="small">Compare</Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* No New Cameras Message */}
      {newCameras.length === 0 && recentlyUpdated.length === 0 && (
        <Paper sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
          <CameraAlt sx={{ fontSize:  64, color:'text.secondary', mb:  2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            No new or updated cameras found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            The discovery system will automatically check for new cameras periodically.
          </Typography>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('refresh')}
            onClick={handleTriggerDiscovery}
            disabled={isDiscovering}
          >
            Check Now
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default PhotoCameraDiscoveryManager;














