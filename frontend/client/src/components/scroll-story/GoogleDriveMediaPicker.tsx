/**
 * Google Drive Media Picker for ScrollStory
 * Allows users to select images, videos, and audio from Google Drive
 * Integrates with ScrollStory component for seamless media addition
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Checkbox,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Search,
  Image as ImageIcon,
  VideoLibrary,
  AudioFile,
  Folder,
  CloudUpload,
  Close,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  size?: number;
  modifiedTime?: string;
  iconLink?: string;
}

interface GoogleDriveMediaPickerProps {
  open: boolean;
  onClose: () => void;
  onMediaSelected: (,
    media: Array<{
      type: 'image' | 'video' | 'audio';
      url: string;
      thumbnail?: string;
      driveFileId: string;
      name: string;
    }>,
  ) => void;
  allowMultiple?: boolean;
  mediaTypes?: Array<'image' | 'video' | 'audio'>;
  projectDriveFolderId?: string;
}

export default function GoogleDriveMediaPicker({
  open,
  onClose,
  onMediaSelected,
  allowMultiple = true,
  mediaTypes = ['image','video','audio'],
  projectDriveFolderId,
}: GoogleDriveMediaPickerProps) {
  const { auth, analytics, features } = useEnhancedMasterIntegration();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set();
  const [currentFolder, setCurrentFolder] = useState<string | null>(projectDriveFolderId || null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load files from Google Drive
  useEffect(() => {
    if (open) {
      loadFiles();

      // Track feature usage
      features.trackFeatureUsage('scroll-story, ','google-drive-picker-opened, ', {
        mediaTypes,
        allowMultiple,
      });
    }
  }, [open, currentFolder, searchQuery, activeTab]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const authClient = await auth.getAuthenticatedClient();

      // Build query based on media type filter
      let mimeTypeQuery = ', ';
      const currentMediaTypes = mediaTypes;

      if (activeTab === 0 && currentMediaTypes.includes('image') {
        mimeTypeQuery = "mimeType contains 'image/', ";
      } else if (activeTab === 1 && currentMediaTypes.includes('video') {
        mimeTypeQuery = "mimeType contains 'video/', ";
      } else if (activeTab === 2 && currentMediaTypes.includes('audio') {
        mimeTypeQuery = "mimeType contains 'audio/', ";
      }

      // Build folder query
      const folderQuery = currentFolder ? `'${currentFolder},' in parents` : "'root' in parents";

      // Build search query
      const nameQuery = searchQuery ? `and name contains '${searchQuery},'` : ', ';

      const query = `${folderQuery} ${mimeTypeQuery ? `and ${mimeTypeQuery}` : ', '} ${nameQuery} and trashed=false`;

      const response = await fetch('/api/google-drive/files', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          query,
          fields: 'files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, size, modifiedTime, iconLink)',
          orderBy: 'modifiedTime desc',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load files from Google Drive');
      }

      const data = await response.json();
      setFiles(data.files || []);

      // Track analytics
      analytics.trackEvent('scroll_story_drive_files_loaded', {
        fileCount: data.files?.length || 0,
        mediaType: activeTab === 0 ? 'image' : activeTab === 1 ? 'video' : 'audio',
        hasSearch: !!searchQuery,
      });
    } catch (err) {
      console.error('Error loading files from Google Drive: ', err);
      setError('Failed to load files from Google Drive. Please try again.');

      analytics.trackEvent('scroll_story_drive_error', {
        error: err.message,
        action: 'load_files',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (fileId: string) => {
    const newSelected = new Set(selectedFiles);

    if (newSelected.has(fileId) {
      newSelected.delete(fileId);
    } else {
      if (!allowMultiple) {
        newSelected.clear();
      }
      newSelected.add(fileId);
    }

    setSelectedFiles(newSelected);
  };

  const handleConfirm = async () => {
    const selectedFileObjects = files.filter((f) => selectedFiles.has(f.id);

    const mediaItems = await Promise.all(
      selectedFileObjects.map(async (file) => {
        // Determine media type
        let type: 'image' | 'video' | 'audio';
        if (file.mimeType.startsWith('image/') {
          type = 'image';
        } else if (file.mimeType.startsWith('video/') {
          type = 'video';
        } else {
          type = 'audio';
        }

        // Get shareable link
        const url = await getShareableLink(file.id);

        return {
          type,
          url: url || file.webContentLink || file.webViewLink || ', ',
          thumbnail: file.thumbnailLink || file.iconLink,
          driveFileId: file.id,
          name: file.name,
        };
      }),
    );

    // Track selection
    analytics.trackEvent('scroll_story_media_selected_from_drive', {
      fileCount: mediaItems.length,
      mediaTypes: mediaItems.map((m) => m.type),
    });

    features.trackFeatureUsage('scroll-story', 'media-added-from-drive', {
      count: mediaItems.length,
    });

    onMediaSelected(mediaItems);
    handleClose();
  };

  const getShareableLink = async (fileId: string): Promise<string | null> => {
    try {
      // Make file publicly accessible or get a shareable link
      const response = await fetch(`/api/google-drive/files/${fileId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.webContentLink || data.webViewLink;
      }
    } catch (err) {
      console.error('Error getting shareable link:', err);
    }
    return null;
  };

  const handleClose = () => {
    setSelectedFiles(new Set();
    setSearchQuery(', ');
    setError(null);
    onClose();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSelectedFiles(new Set();
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setFolderPath([...folderPath, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root
      setCurrentFolder(null);
      setFolderPath([]);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setCurrentFolder(newPath[newPath.length - 1].id);
      setFolderPath(newPath);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024).toFixed(1)} GB`;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: {}}}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CloudUpload />
            <Typography variant="h6">Select Media from Google Drive</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Search Bar */}
        <Box mb={2}>
          <TextField
            fullWidth
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <Close />
                  </IconButton>
                </InputAdornment>
              )}}
          />
        </Box>

        {/* Breadcrumb Navigation */}
        {folderPath.length > 0 && (
          <Box mb={2} display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip
              label="Root"
              onClick={() => handleBreadcrumbClick(-1)}
              size="small"
              icon={<Folder />}
            />
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <Typography variant="body2">/</Typography>
                <Chip
                  label={folder.name}
                  onClick={() => handleBreadcrumbClick(index)}
                  size="small"
                  icon={<Folder />}
                />
              </React.Fragment>
            ))}
          </Box>
        )}

        {/* Media Type Tabs */}
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          {mediaTypes.includes('image') && (
            <Tab label="Images" icon={<ImageIcon />} iconPosition="start" />
          )}
          {mediaTypes.includes('video') && (
            <Tab label="Videos" icon={<VideoLibrary />} iconPosition="start" />
          )}
          {mediaTypes.includes('audio') && (
            <Tab label="Audio" icon={<AudioFile />} iconPosition="start" />
          )}
        </Tabs>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Info */}
        {selectedFiles.size > 0 && (
          <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
            {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ','} selected
            {!allowMultiple && ' (single selection mode)'}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        )}

        {/* Files Grid */}
        {!loading && files.length === 0 && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <Typography variant="body1" color="text.secondary">
              No files found
            </Typography>
          </Box>
        )}

        {!loading && files.length > 0 && (
          <Grid container spacing={2}>
            {files.map((file) => {
              const isSelected = selectedFiles.has(file.id);
              const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: isSelected ? 2 : 0,
                      borderColor: 'primary.main',
                      position: 'relative', '&:hover': {
                        boxShadow: 6,
                      }}}
                    onClick={() => {
                      if (isFolder) {
                        handleFolderClick(file.id, file.name);
                      } else {
                        handleFileSelect(file.id);
                      }}
                    }}
                  >
                    {isSelected && (
                      <Box position="absolute" top={8} right={8} zIndex={1}>
                        <CheckCircle color="primary" />
                      </Box>
                    )}

                    <CardMedia
                      component={isFolder ? 'div' : 'img'}
                      height="140"
                      image={file.thumbnailLink || file.iconLink}
                      alt={file.name}
                      sx={{
                        backgroundColor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'}}>
                      {isFolder && <Folder sx={{ fontSize: 64, color: 'grey.500' }} />}
                    </CardMedia>

                    <CardContent>
                      <Typography
                        variant="body2"
                        noWrap
                        title={file.name}
                        sx={{ fontWeight: sSelected ? 'bold' : 'normal' }}>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(file.size)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Box width="100%" display="flex" justifyContent="space-between" alignItems="center" px={2}>
          <Typography variant="caption" color="text.secondary">
            {allowMultiple ? 'Select multiple files' : 'Select a single file'}
          </Typography>
          <Box display="flex" gap={1}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={selectedFiles.size === 0}
              startIcon={<CheckCircle />}
            >
              Add {selectedFiles.size > 0 ? `(${selectedFiles.size})` :''}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
