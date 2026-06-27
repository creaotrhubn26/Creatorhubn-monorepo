import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CameraAlt,
  CheckCircle,
  Error as ErrorIcon,
  NewReleases,
  Refresh,
  Update,
} from '@mui/icons-material';
import type { PhotoCamera } from '../../data/photo-camera-database';
import type { CameraDiscoveryResult} from '../../data/photo-camera-discovery';
import { photoCameraDiscovery } from '../../data/photo-camera-discovery';
import { AdminButton, AdminCard } from './design-system';

interface PhotoCameraDiscoveryManagerProps {
  onCameraUpdate?: (cameras: PhotoCamera[]) => void;
}

interface DiscoveryStatus {
  totalSources: number;
  enabledSources: number;
  lastUpdate: string;
  totalCameras: number;
  newCameras: number;
  recentlyUpdated: number;
}

function normalizeDiscoveryStatus(raw: unknown): DiscoveryStatus {
  if (typeof raw !== 'object' || raw === null) {
    return {
      totalSources: 0,
      enabledSources: 0,
      lastUpdate: '',
      totalCameras: 0,
      newCameras: 0,
      recentlyUpdated: 0,
    };
  }

  const record = raw as Record<string, unknown>;
  const getNumber = (key: string): number => {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };

  return {
    totalSources: getNumber('totalSources'),
    enabledSources: getNumber('enabledSources'),
    lastUpdate: typeof record.lastUpdate === 'string' ? record.lastUpdate : '',
    totalCameras: getNumber('totalCameras'),
    newCameras: getNumber('newCameras'),
    recentlyUpdated: getNumber('recentlyUpdated'),
  };
}

function formatDate(value: string): string {
  if (!value) {
    return 'Ikke tilgjengelig';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Ikke tilgjengelig';
  }

  return parsed.toLocaleString();
}

function sourceLabel(camera: PhotoCamera): string {
  if (camera.source === 'api') {
    return 'API';
  }

  if (camera.source === 'discovery') {
    return 'Discovery';
  }

  return 'Manual';
}

export const PhotoCameraDiscoveryManager: React.FC<PhotoCameraDiscoveryManagerProps> = ({
  onCameraUpdate,
}) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<CameraDiscoveryResult[]>([]);
  const [newCameras, setNewCameras] = useState<PhotoCamera[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<PhotoCamera[]>([]);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [status, setStatus] = useState<DiscoveryStatus>(() =>
    normalizeDiscoveryStatus(photoCameraDiscovery.getDiscoveryStatus()),
  );

  const refreshData = useCallback(() => {
    setStatus(normalizeDiscoveryStatus(photoCameraDiscovery.getDiscoveryStatus()));
    setNewCameras(photoCameraDiscovery.getCamerasByStatus('new'));
    setRecentlyUpdated(photoCameraDiscovery.getCamerasByStatus('recently-updated'));
  }, []);

  const handleCameraUpdate = useCallback(
    (cameras: PhotoCamera[]) => {
      setNewCameras((previous) => {
        const previousIds = new Set(previous.map((camera) => camera.id));
        const merged = [...previous];

        cameras.forEach((camera) => {
          if (!previousIds.has(camera.id)) {
            merged.push(camera);
            previousIds.add(camera.id);
          }
        });

        return merged;
      });

      onCameraUpdate?.(cameras);
      refreshData();
    },
    [onCameraUpdate, refreshData],
  );

  useEffect(() => {
    refreshData();
    photoCameraDiscovery.onCameraUpdate(handleCameraUpdate);

    return () => {
      photoCameraDiscovery.offCameraUpdate(handleCameraUpdate);
    };
  }, [handleCameraUpdate, refreshData]);

  const triggerDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const results = await photoCameraDiscovery.triggerDiscovery();
      setDiscoveryResults(results);
      refreshData();
    } finally {
      setIsDiscovering(false);
    }
  };

  const visibleCameras = useMemo(() => {
    if (showNewOnly) {
      const updatedIds = new Set(recentlyUpdated.map((camera) => camera.id));
      return [...newCameras, ...recentlyUpdated.filter((camera) => !updatedIds.has(camera.id))];
    }

    const all = photoCameraDiscovery.getCamerasByStatus('all');
    return all.slice(0, 80);
  }, [newCameras, recentlyUpdated, showNewOnly]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
        Photo Camera Discovery Manager
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Cameras
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {status.totalCameras}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                New Cameras
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                <Badge badgeContent={status.newCameras} color="primary">
                  {status.newCameras}
                </Badge>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Recently Updated
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                <Badge badgeContent={status.recentlyUpdated} color="secondary">
                  {status.recentlyUpdated}
                </Badge>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Sources
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {status.enabledSources}/{status.totalSources}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack>
            <Typography variant="subtitle1" fontWeight={600}>
              Discovery Controls
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last update: {formatDate(status.lastUpdate)}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={<Switch checked={showNewOnly} onChange={(event) => setShowNewOnly(event.target.checked)} />}
              label="Show New/Updated only"
            />
            <AdminButton
              tone="primary"
              loading={isDiscovering}
              startIcon={<Refresh />}
              disabled={isDiscovering}
              onClick={() => void triggerDiscovery()}
            >
              {isDiscovering ? 'Discovering...' : 'Trigger Discovery'}
            </AdminButton>
          </Stack>
        </Stack>
      </Paper>

      {discoveryResults.length > 0 && (
        <AdminCard title="Latest Discovery Results" sx={{ mb: 2 }}>
          <List dense>
            {discoveryResults.map((result, index) => (
              <ListItem key={`${result.source}-${result.timestamp}-${index}`}>
                {result.success ? <CheckCircle color="success" sx={{ mr: 1 }} aria-hidden /> : <ErrorIcon color="error" sx={{ mr: 1 }} aria-hidden />}
                <ListItemText
                  primary={`${result.source}: ${result.success ? 'OK' : 'Failed'}`}
                  secondary={`Found ${result.cameras.length} cameras at ${formatDate(result.timestamp)}`}
                />
              </ListItem>
            ))}
          </List>
        </AdminCard>
      )}

      <AdminCard title={`Cameras (${visibleCameras.length})`}>
        {visibleCameras.length === 0 && (
          <Alert severity="info">Ingen kameraer å vise ennå. Kjør discovery for å hente nye modeller.</Alert>
        )}

        <List dense>
          {visibleCameras.map((camera) => (
            <ListItem key={camera.id} divider>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <CameraAlt fontSize="small" aria-hidden />
                    <Typography variant="body2" fontWeight={600}>
                      {camera.brand} {camera.model}
                    </Typography>
                    {camera.isNew && <Chip icon={<NewReleases />} label="New" size="small" color="primary" />}
                    {camera.isRecentlyUpdated && (
                      <Chip icon={<Update />} label="Updated" size="small" color="secondary" />
                    )}
                    {camera.source !== 'manual' && (
                      <Chip icon={<AutoAwesome />} label={sourceLabel(camera)} size="small" variant="outlined" />
                    )}
                  </Stack>
                }
                secondary={
                  <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    <Typography variant="caption">{camera.category}</Typography>
                    <Typography variant="caption">{camera.megapixels} MP</Typography>
                    <Typography variant="caption">Released: {camera.releaseDate}</Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      </AdminCard>
    </Box>
  );
};

export default PhotoCameraDiscoveryManager;
