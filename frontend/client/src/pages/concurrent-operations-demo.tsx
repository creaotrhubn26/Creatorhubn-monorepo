// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Queue,
  PlayArrow as PlayArrowArrow,
  Pause,
  CheckCircle,
  Error as ErrorIcon,
  SwapVert,
  Speed as Speed,
} from '@mui/icons-material';
import backgroundUploadService from '@/services/BackgroundUploadService';
import { backgroundDownloadService } from '@/services/BackgroundDownloadService';

export default function ConcurrentOperationsDemo() {
  const [uploadStats, setUploadStats] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [stats, setStats] = useState({
    totalTasks:  0,
    activeTasks:  0,
    completedTasks:  0,
    failedTasks:  0,
    totalUploaded:  0,
    overallProgress:  0,
    uploadedBytes:  0,
    totalBytes:  0,
    averageSpeed:  0,
});

  const [downloadStats, setDownloadStats] = useState({
    totalTasks:  0,
    activeTasks:  0,
    completedTasks:  0,
    failedTasks:  0,
    totalDownloaded:  0,
    averageSpeed:  0,
});

  const [queueInfo, setQueueInfo] = useState({
    uploadQueue:  0,
    downloadQueue:  0,
    activeUploads:  0,
    activeDownloads:  0,
    maxConcurrentUploads:  3,
    maxConcurrentDownloads:  3,
});

  // Update data every second
  useEffect(() => {
    const updateData = () => {
      // Upload stats
      const uploadStatsData = backgroundUploadService.getStats();
      setUploadStats(uploadStatsData);

      // Download stats
      const downloadStatsData = backgroundDownloadService.getStats();
      setDownloadStats(downloadStatsData);

      // Queue information
      const uploadTasks = backgroundUploadService.getAllTasks();
      const downloadTasks = backgroundDownloadService.getAllTasks();

      setQueueInfo({
        uploadQueue: uploadTasks.filter((t) => t.status === 'queued').length,
        downloadQueue: downloadTasks.filter((t) => t.status === 'pending').length,
        activeUploads: uploadTasks.filter((t) => t.status === 'uploading').length,
        activeDownloads: downloadTasks.filter((t) => t.status === 'downloading').length,
        maxConcurrentUploads:  3,
        maxConcurrentDownloads:  3,
    });
  };

    updateData();
    const interval = setInterval(updateData, 1000);

    // Listen to service events
    const handleUploadUpdate = () => updateData();
    backgroundUploadService.on('taskStarted', handleUploadUpdate);
    backgroundUploadService.on('taskCompleted', handleUploadUpdate);
    backgroundUploadService.on('taskFailed', handleUploadUpdate);

    const unsubscribeDownload = backgroundDownloadService.addGlobalListener(() => {
      updateData();
  });

    return () => {
      clearInterval(interval);
      backgroundUploadService.removeAllListeners();
      unsubscribeDownload();
  };
}, []);

  // Generate multiple test files
  const generateTestFiles = (count: number): File[] => {
    const files: File[] = [];
    for (let i = 1; i <= count; i++) {
      const size = Math.floor(Math.random() * 5 * 1024 * 1024) + 1024 * 1024; // 1-5MB
      const content = new Array(size).fill('x').join(', ');
      const blob = new Blob([content], { type: 'text/plain',});
      const file = new File([blob], `test-file-${i}.txt`, {
        type: 'text/plain',
    });
      files.push(file);
  }
    return files;
};

  const startMassiveUpload = (fileCount: number) => {
    const files = generateTestFiles(fileCount);

    files.forEach((file) => {
      backgroundUploadService.addTask({
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        fileName: file.name,
        fileSize: file.size,
        uploadUrl: '/api/test/upload',
        status: 'queued',
        progress:  0,
        retryCount:  0,
        maxRetries:  3,
        profession: 'photographer',
        category: 'concurrent-test',
    });
  });
};

  const startMassiveDownload = (fileCount: number) => {
    const testFiles = [
      'sample-document.pdf','sample-video.mp4','sample-audio.mp3','sample-image.jpg',
    ];

    for (let i = 1; i <= fileCount; i++) {
      const fileName = testFiles[i % testFiles.length];
      const downloadFileName = `${fileName.split('.')[0]}-${i}.${fileName.split('.')[1]}`;

      backgroundDownloadService.startDownload(`/api/test/download/${fileName}`, downloadFileName, {
        profession: 'photographer',
        category: 'concurrent-test',
        maxRetries:  2,
    });
  }
};

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B','KB','MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ', ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number): string => {
    return `${formatFileSize(bytesPerSec)}/s`;
};

  return (
    <Box sx={{ p:  3, maxWidth: 140, mx: 'auto',}}>
      <Typography variant="h4"
        gutterBottom
        sx={{ 
          display: 'flex',
          alignItems: 'center',
          color: theming.colors.primary }}>
        <SwapVert sx={{ mr:  2 }} />
        Concurrent Operations Demo - Queue Management
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          🚀 Advanced Queue Management System
        </Typography>
        Demonstrerer hvordan systemet håndterer flere operasjoner samtidig: <br />• <strong>3 uploads samtidig</strong> + 3 downloads samtidig = 6 totale operasjoner
        <br />• Automatisk kø-prosessering når en operasjon fullføres
        <br />• Uavhengige køer for uploads og downloads
        <br />• Smart prioritering (små filer først for uploads)
        <br />• Real-time queue monitoring og statistikk
      </Alert>

      {/* Queue Status Overview , *, /}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6"
                gutterBottom
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  color: theming.colors.primary }}>
                <CloudUpload sx={{ mr:  1 }} />
                Upload Queue Status
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap',}}>
                <Chip
                  label={`${queueInfo.activeUploads}/${queueInfo.maxConcurrentUploads} Aktive`}
                  color={queueInfo.activeUploads > 0 ? 'primary' : 'default'}
                  icon={{theming.getThemedIcon('play')}}
                />
                <Chip
                  label={`${queueInfo.uploadQueue} i kø`}
                  color={queueInfo.uploadQueue > 0 ? 'warning' : 'default'}
                  icon={<Queue />}
                />
                <Chip
                  label={`${uploadStats.completedTasks} fullført`}
                  color="success"
                  icon={{theming.getThemedIcon('checkCircle')}}
                />
                {uploadStats.averageSpeed > 0 && (
                  <Chip
                    label={formatSpeed(uploadStats.averageSpeed)}
                    icon={{theming.getThemedIcon('speed')}}
                    variant="outlined"
                  />
                )}
              </Box>

              {uploadStats.overallProgress > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total progress: {uploadStats.overallProgress}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={uploadStats.overallProgress}
                    sx={{ height:  8, borderRadius:  4 }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6"
                gutterBottom
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  color: theming.colors.primary }}>
                <Download sx={{ mr:  1 }} />
                Download Queue Status
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap',}}>
                <Chip
                  label={`${queueInfo.activeDownloads}/${queueInfo.maxConcurrentDownloads} Aktive`}
                  color={queueInfo.activeDownloads > 0 ? 'primary' : 'default'}
                  icon={{theming.getThemedIcon('play')}}
                />
                <Chip
                  label={`${queueInfo.downloadQueue} i kø`}
                  color={queueInfo.downloadQueue > 0 ? 'warning' : 'default'}
                  icon={<Queue />}
                />
                <Chip
                  label={`${downloadStats.completedTasks} fullført`}
                  color="success"
                  icon={{theming.getThemedIcon('checkCircle')}}
                />
                {downloadStats.averageSpeed > 0 && (
                  <Chip
                    label={formatSpeed(downloadStats.averageSpeed)}
                    icon={{theming.getThemedIcon('speed')}}
                    variant="outlined"
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test Controls */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Test Massive Upload Queue
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Start flere uploads samtidig for å teste kø-systemet
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained"
                  onClick={() => startMassiveUpload(5)}
                  sx={{ backgroundColor: '#FF6B35' }}
                >
                  5 filer
                </Button>
                <Button variant="contained"
                  onClick={() => startMassiveUpload(10)}
                  sx={{ backgroundColor: '#FF6B35',}}
                >
                  10 filer
                </Button>
                <Button variant="contained"
                  onClick={() => startMassiveUpload(20)}
                  sx={{ backgroundColor: '#FF6B35',}}
                >
                  20 filer
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Test Massive Download Queue
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Start flere downloads samtidig for å teste kø-systemet
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap',}}>
                <Button variant="contained"
                  onClick={() => startMassiveDownload(5)}
                  sx={{ backgroundColor: '#4ECDC4',}}
                >
                  5 filer
                </Button>
                <Button variant="contained"
                  onClick={() => startMassiveDownload(10)}
                  sx={{ backgroundColor: '#4ECDC4',}}
                >
                  10 filer
                </Button>
                <Button variant="contained"
                  onClick={() => startMassiveDownload(20)}
                  sx={{ backgroundColor: '#4ECDC4',}}
                >
                  20 filer
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Live Statistics Table */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Live Queue Statistics
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Operasjon</TableCell>
                  <TableCell align="right">Aktive</TableCell>
                  <TableCell align="right">I kø</TableCell>
                  <TableCell align="right">Fullført</TableCell>
                  <TableCell align="right">Feilet</TableCell>
                  <TableCell align="right">Hastighet</TableCell>
                  <TableCell align="right">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center',}}>
                      <CloudUpload sx={{ mr: 1, color: '#FF6B35',}} />
                      Uploads
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${queueInfo.activeUploads}/${queueInfo.maxConcurrentUploads}`}
                      size="small"
                      color={queueInfo.activeUploads > 0 ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={queueInfo.uploadQueue}
                      size="small"
                      color={queueInfo.uploadQueue > 0 ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={uploadStats.completedTasks} size="small" color="success" />
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={uploadStats.failedTasks}
                      size="small"
                      color={uploadStats.failedTasks > 0 ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {uploadStats.averageSpeed > 0 ? formatSpeed(uploadStats.averageSpeed) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {queueInfo.activeUploads > 0 ? (
                      <Chip label="Aktiv" size="small" color="primary" />
                    ) : queueInfo.uploadQueue > 0 ? (
                      <Chip label="Venter" size="small" color="warning" />
                    ) : (
                      <Chip label="Inaktiv" size="small" />
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center',}}>
                      <Download sx={{ mr: 1, color: '#4ECDC4',}} />
                      Downloads
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${queueInfo.activeDownloads}/${queueInfo.maxConcurrentDownloads}`}
                      size="small"
                      color={queueInfo.activeDownloads > 0 ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={queueInfo.downloadQueue}
                      size="small"
                      color={queueInfo.downloadQueue > 0 ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={downloadStats.completedTasks} size="small" color="success" />
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={downloadStats.failedTasks}
                      size="small"
                      color={downloadStats.failedTasks > 0 ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {downloadStats.averageSpeed > 0 ? formatSpeed(downloadStats.averageSpeed) :'—'}
                  </TableCell>
                  <TableCell align="right">
                    {queueInfo.activeDownloads > 0 ? (
                      <Chip label="Aktiv" size="small" color="primary" />
                    ) : queueInfo.downloadQueue > 0 ? (
                      <Chip label="Venter" size="small" color="warning" />
                    ) : (
                      <Chip label="Inaktiv" size="small" />
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Alert severity="success" sx={{ mt:  3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Slik fungerer systemet: </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText primary="Maks 3 uploads + 3 downloads kan kjøre samtidig (totalt 6 operasjoner)" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText primary="Når en operasjon fullføres, starter neste automatisk fra køen" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText primary="Uploads og downloads har uavhengige køer og tellemåte" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="success" />
            </ListItemIcon>
            <ListItemText primary="Unified widget viser all aktivitet i real-time" />
          </ListItem>
        </List>
      </Alert>
    </Box>
  );
}
