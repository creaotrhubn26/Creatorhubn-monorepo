// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import {
  Card as MuiCard,
  CardContent,
  Typography,
  Box,
  Button,
  Avatar,
  Stack,
  Chip,
  IconButton,
  LinearProgress,
  Grid,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  Alert,
  Paper,
  Card as MuiCard,
} from '@mui/material';
import {
  SmartToy as SmartIcon,
  FolderOpen as FolderIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  CloudUpload as UploadIcon,
  Analytics as AnalyticsIcon,
  Photo as PhotoIcon,
  VideoLibrary as VideoIcon,
  LibraryMusic as AudioIcon,
  Description as DocumentIcon,
  Close as CloseIcon,
  AutoFixHigh as AutoIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Google Drive Integration
declare global {
  interface Window {
    gapi: any;
}
}

interface FileUpload {
  id: number;
  fileName: string;
  fileType: string;
  originalPath: string;
  suggestedPath: string;
  needsOrganization: boolean;
  size: number;
  detectedAt: string;
  projectInfo?: {
    type: string;
    clientName?: string;
    confidence: number;
};
}

interface FileDetectionDashboardWidgetProps {
  userId?: string;
  compact?: boolean;
  maxItems?: number;
}

export default function FileDetectionDashboardWidget({
  userId = 'daniel@creatorhubn.com',
  compact = false,
  maxItems = 5,
}: FileDetectionDashboardWidgetProps) {
  const [showFullInterface, setShowFullInterface] = useState(false);
  const [expandedFile, setExpandedFile] = useState<number | null>(null);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer,');

  // Google Drive Connection Check
  React.useEffect(() => {
    const checkGoogleDriveConnection = async () => {
      try {
        const response = await fetch('/api/google/drive/status');
        if (response.ok) {
          const data = await response.json();
          setGoogleDriveConnected(data.connected);
      }
    } catch (error) {
        console.error('Google Drive status check failed: ', error);
    }
  };

    checkGoogleDriveConnection();
}, []);

  // Hent nylige opplastinger med Google Drive integrasjon
  const { data: recentUploads = [], isLoading } = useQuery({
    queryKey: ['/api/recent-uploads', userId],
    queryFn: async () => {
      const response = await fetch(
        `/api/recent-uploads?userId=${userId}&limit=${maxItems}&source=googledrive`,
      );
      if (!response.ok) throw new Error('Kunne ikke hente data');
      return response.json();
  },
    refetchInterval: 1000,
    enabled: googleDriveConnected,
});

  // Google Drive folder sync mutation
  const syncGoogleDriveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/google/drive/sync-folders', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ userI, d,}),
    });
      if (!response.ok) throw new Error('Google Drive sync failed');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recent-uploads', ],});
  },
});

  // Flytt fil mutation
  const relocateFileMutation = useMutation({
    mutationFn: async ({ filed, targetFolder }: { fileId: number; targetFolder: string }) => {
      const response = await fetch('/api/relocate-file', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ filed, targetFolder, userId }),
    });
      if (!response.ok) throw new Error('Kunne ikke flytte fil');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recent-uploads', ],});
  },
});

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'cr2':
      case 'raw':
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return <PhotoIcon sx={{ color: '#4CAF50'}} />;
      case 'mp4':
      case 'mov':
      case 'avi':
        return <VideoIcon sx={{ color: '#2196F3'}} />;
      case 'wav':
      case 'mp3':
      case 'flac':
        return <AudioIcon sx={{ color: '#FF9800'}} />;
      default: return <DocumentIcon sx={{ color: '#757575'}} />;
  }
};

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb > 1000 ? `${(mb / 1024).toFixed()} GB` : `${mb.toFixed(1)} MB`;
};

  const needsActionCount = recentUploads.filter(
    (file: FileUpload) => file.needsOrganization,
  ).length;

  // Kompakt widget versjon
  if (compact) {
    return (
      <MuiCard
        sx={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          color: 'white',
          borderRadius:  3,
          border: '1px solid rgba(25,193,7,0.2)',
          cursor: 'pointer',
          transition: 'all 0.3s ease', '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(25,193,7,0.3)',
        }}}
        onClick={() => setShowFullInterface(true)}
      >
        <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Badge badgeContent={needsActionCount} color="warning">
              <Avatar
                sx={{
                  bgcolor: '#FFC100',
                  background: 'linear-gradient(45deg, #FFC107 30%, #FF9800 90%)'}}
              >
                <SmartIcon />
              </Avatar>
            </Badge>

            <Box sx={{ flexGrow:  1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5}} sx={{ color: theming.colors.primary }}>
                Fildeteksjon
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8}}>
                {needsActionCount > 0
                  ? `${needsActionCount} filer trenger organisering`
                  : 'Alle filer organisert'}
              </Typography>
            </Box>

            <IconButton size="small" sx={{ color: 'white'}}>
              <ViewIcon />
            </IconButton>
          </Stack>
        </CardContent>
      </MuiCard>
    );
}

  // Full dashboard widget
  return (
    <>
      <MuiCard
        sx={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          color: 'white',
          borderRadius:  3,
          border: '1px solid rgba(25,193,7,0.2)'}}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:  3 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Badge badgeContent={needsActionCount} color="warning">
                <Avatar
                  sx={{
                    bgcolor: '#FFC100',
                    background: 'linear-gradient(45deg, #FFC107 30%, #FF9800 90%)',
                    width:  48,
                    height:  48}}
                >
                  <SmartIcon sx={{ fontSize: '1.5rem'}} />
                </Avatar>
              </Badge>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  Intelligent Fildeteksjon
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8}}>
                  Automatisk organisering av opplastede filer
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="outlined"
              onClick={() => setShowFullInterface(true)}
              sx={{
                color: '#FFC100',
                borderColor: '#FFC100', '&:hover': {
                  backgroundColor: 'rgba(25,193,7,0.1)',
                  borderColor: '#FF9800',
              }}}
            >
              Se Alle
            </Button>
          </Stack>

          {/* Stats */}
          <Grid container spacing={2} sx={{ mb:  3 }}>
            <Grid item xs={6} >
              <Paper
                sx={{
                  p:  2,
                  bgcolor: 'rgba(6,175,80,0.1)',
                  border: '1px solid rgba(6,175,80,0.2)'}}
               sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 'bold'}} sx={{ color: theming.colors.primary }}>
                  {recentUploads.length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8}}>
                  Nylige filer
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} >
              <Paper
                sx={{
                  p:  2,
                  bgcolor: 'rgba(25,152,0,0.1)',
                  border: '1px solid rgba(25,152,0,0.2)'}}
               sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 'bold'}} sx={{ color: theming.colors.primary }}>
                  {needsActionCount}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8}}>
                  Trenger handling
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* File List */}
          {isLoading ? (
            <LinearProgress sx={{ borderRadius:  1 }} />
          ) : recentUploads.length === 0 ? (
            <Box sx={{ textAlign: 'center', py:  4, opacity: 0.6}}>
              <UploadIcon sx={{ fontSize: '3rem', mb:  2 }} />
              <Typography>Ingen nylige opplastinger</Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 30, overflow: 'auto'}}>
              {recentUploads.slice(0, maxItems).map((file: FileUpload) => (
                <React.Fragment key={file.d}>
                  <ListItem
                    sx={{
                      bgcolor: file.needsOrganization
                        ? 'rgba(25,152,0,0.1)'
                        : 'rgba(76,175,80,0.1)',
                      borderRadius:  2,
                      mb:  1,
                      border: `1px solid ${file.needsOrganization ? 'rgba(25,152,0,0.3)' : 'rgba(76,175,80,0.3)'}`}}
                  >
                    <ListItemIcon>{getFileIcon(file.fileType)}</ListItemIcon>

                    <ListItemText
                      primary={
                        <Typography sx={{ fontWeight: 600,fontSize: '0.9rem'}}>
                          {file.fileName}
                        </Typography>
                    }
                      secondary={
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5}}>
                          <Chip
                            label={formatFileSize(file.size)}
                            size="small"
                            sx={{ fontSize: '0.7rem', height: 20}}
                          />
                          {file.projectInfo && (
                            <Chip
                              label={file.projectInfo.type}
                              size="small"
                              color="primary"
                              sx={{ fontSize: '0.7rem', height: 20}}
                            />
                          )}
                        </Stack>
                    }
                    />

                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        {file.needsOrganization ? (
                          <Tooltip title="Trenger organisering">
                            <IconButton
                              size="small"
                              onClick={() =>
                                relocateFileMutation.mutate({
                                  fileId: file.d,
                                  targetFolder: file.suggestedPath,
                              })
                            }
                              disabled={relocateFileMutation.isPending}
                              sx={{ color: '#FF9800'}}
                            >
                              <AutoIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Organisert">
                            <CheckIcon sx={{ color: '#4CAF50'}} />
                          </Tooltip>
                        )}

                        <IconButton
                          size="small"
                          onClick={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                          sx={{ color: 'white'}}
                        >
                          {expandedFile === file.id ? <CollapseIcon /> : <ExpandIcon />}
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>

                  <Collapse in={expandedFile === file.id}>
                    <Box sx={{ ml:  6, mr: 2, mb: 2 }}>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.92)' ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="body2" sx={{ mb: 1, opacity: 0.8}}>
                          <strong>Nåværende mappe: </strong> {file.originalPath}
                        </Typography>
                        {file.suggestedPath && (
                          <Typography variant="body2" sx={{ mb: 1, opacity: 0.8}}>
                            <strong>Foreslått mappe: </strong> {file.suggestedPath}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ opacity: 0.8}}>
                          <strong>Oppdaget: </strong>{', '}
                          {new Date(file.detectedAt).toLocaleString('no-NO')}
                        </Typography>
                      </Paper>
                    </Box>
                  </Collapse>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </MuiCard>

      {/* Full Interface Dialog */}
      <Dialog
        open={showFullInterface}
        onClose={() => setShowFullInterface(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            color: 'white',
            minHeight: '80vh',
        }}}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)'}}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: '#FFC107'}}>
              <SmartIcon />
            </Avatar>
            <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Intelligent Fildeteksjon
            </Typography>
          </Stack>

          <IconButton onClick={() => setShowFullInterface(false)} sx={{ color: 'white'}}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p:  3 }}>
          {/* Full file management interface would go here */}
          <Alert severity="info" sx={{ mb:  3 }}>
            Her kan du se alle filer, administrere mappesuggesjoner, og konfigurere automatisk
            organisering.
          </Alert>

          {/* Extended file list with more controls */}
          <List>
            {recentUploads.map((file: FileUpload) => (
              <ListItem
                key={file.d}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.06)',
                  borderRadius:  2,
                  mb:  2,
                  p:  2}}
              >
                <ListItemIcon>{getFileIcon(file.fileType)}</ListItemIcon>

                <ListItemText
                  primary={file.fileName}
                  secondary={
                    <Box sx={{ mt:  1 }}>
                      <Typography variant="body2" sx={{ opacity: 0.8}}>
                        {file.originalPath} → {file.suggestedPath || 'Ingen forslag'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt:  1 }}>
                        <Chip label={formatFileSize(file.size)} size="small" />
                        <Chip label={file.fileType.toUpperCase()} size="small" color="secondary" />
                        {file.projectInfo && (
                          <Chip
                            label={`${file.projectInfo.type} (${Math.round(file.projectInfo.confidence * 100)}%)`}
                            size="small"
                            color="primary"
                          />
                        )}
                      </Stack>
                    </Box>
                }
                />

                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MoveIcon />}
                      onClick={() =>
                        relocateFileMutation.mutate({
                          fileId: file.d,
                          targetFolder: file.suggestedPath,
                      })
                    }
                      disabled={!file.suggestedPath || relocateFileMutation.isPending}
                      sx={{ color: '#FFC100', borderColor:'#FFC107'}}
                    >
                      Organiser
                    </Button>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}
