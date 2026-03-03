/**
 * Google Drive Media Picker for ScrollStory
 * Allows users to select images, videos, and audio from Google Drive.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AudioFile,
  CheckCircle,
  CloudUpload,
  Close,
  Folder,
  Image as ImageIcon,
  Search,
  VideoLibrary,
} from '@mui/icons-material';

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

interface SelectedMediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
  driveFileId: string;
  name: string;
}

interface GoogleDriveMediaPickerProps {
  open: boolean;
  onClose: () => void;
  onMediaSelected: (media: SelectedMediaItem[]) => void;
  allowMultiple?: boolean;
  mediaTypes?: Array<'image' | 'video' | 'audio'>;
  projectDriveFolderId?: string;
}

interface GoogleDriveListResponse {
  files?: GoogleDriveFile[];
}

function mediaTypeFromMime(mimeType: string): 'image' | 'video' | 'audio' | 'folder' | 'other' {
  if (mimeType === 'application/vnd.google-apps.folder') {
    return 'folder';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return 'other';
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return 'Unknown size';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function tabIndexToMediaType(index: number): 'image' | 'video' | 'audio' {
  if (index === 1) {
    return 'video';
  }
  if (index === 2) {
    return 'audio';
  }
  return 'image';
}

export default function GoogleDriveMediaPicker({
  open,
  onClose,
  onMediaSelected,
  allowMultiple = true,
  mediaTypes = ['image', 'video', 'audio'],
  projectDriveFolderId,
}: GoogleDriveMediaPickerProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(projectDriveFolderId ?? null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const activeType = tabIndexToMediaType(activeTab);

  const effectiveTabs = useMemo(() => {
    const tabs: Array<'image' | 'video' | 'audio'> = [];
    if (mediaTypes.includes('image')) {
      tabs.push('image');
    }
    if (mediaTypes.includes('video')) {
      tabs.push('video');
    }
    if (mediaTypes.includes('audio')) {
      tabs.push('audio');
    }
    return tabs;
  }, [mediaTypes]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!effectiveTabs.includes(activeType)) {
      const firstIndex = ['image', 'video', 'audio'].indexOf(effectiveTabs[0] ?? 'image');
      setActiveTab(Math.max(0, firstIndex));
      return;
    }

    const controller = new AbortController();

    const loadFiles = async () => {
      setLoading(true);
      setError(null);

      const folderQuery = currentFolderId ? `'${currentFolderId}' in parents` : "'root' in parents";
      const mediaQuery = `mimeType contains '${activeType}/'`;
      const escapedSearch = searchQuery.replace(/'/g, "\\'");
      const nameQuery = escapedSearch ? `and name contains '${escapedSearch}'` : '';
      const query = `${folderQuery} and (${mediaQuery} or mimeType = 'application/vnd.google-apps.folder') ${nameQuery} and trashed = false`;

      try {
        const response = await fetch('/api/google-drive/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            fields:
              'files(id,name,mimeType,thumbnailLink,webContentLink,webViewLink,size,modifiedTime,iconLink)',
            orderBy: 'modifiedTime desc',
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Drive request failed (${response.status})`);
        }

        const data = (await response.json()) as GoogleDriveListResponse;
        setFiles(Array.isArray(data.files) ? data.files : []);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load files from Google Drive');
        setFiles([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFiles();

    return () => {
      controller.abort();
    };
  }, [open, activeType, currentFolderId, searchQuery, effectiveTabs]);

  const toggleSelection = (fileId: string) => {
    setSelectedFileIds((previous) => {
      const next = new Set(previous);
      if (next.has(fileId)) {
        next.delete(fileId);
        return next;
      }

      if (!allowMultiple) {
        next.clear();
      }

      next.add(fileId);
      return next;
    });
  };

  const getShareableLink = async (fileId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/google-drive/files/${fileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { webContentLink?: string; webViewLink?: string };
      return payload.webContentLink ?? payload.webViewLink ?? null;
    } catch {
      return null;
    }
  };

  const handleConfirmSelection = async () => {
    const selectedFiles = files.filter((file) => selectedFileIds.has(file.id));

    const media = await Promise.all(
      selectedFiles
        .filter((file) => mediaTypeFromMime(file.mimeType) !== 'folder')
        .map(async (file) => {
          const mediaType = mediaTypeFromMime(file.mimeType);
          const link =
            (await getShareableLink(file.id)) ??
            file.webContentLink ??
            file.webViewLink ??
            file.thumbnailLink ??
            '';

          return {
            type: mediaType as 'image' | 'video' | 'audio',
            url: link,
            thumbnail: file.thumbnailLink ?? file.iconLink,
            driveFileId: file.id,
            name: file.name,
          } satisfies SelectedMediaItem;
        }),
    );

    onMediaSelected(media.filter((item) => item.url.length > 0));
    handleClose();
  };

  const handleClose = () => {
    setSelectedFileIds(new Set());
    setSearchQuery('');
    setError(null);
    onClose();
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath((previous) => [...previous, { id: folderId, name: folderName }]);
    setSelectedFileIds(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setCurrentFolderId(null);
      setFolderPath([]);
      return;
    }

    const nextPath = folderPath.slice(0, index + 1);
    setFolderPath(nextPath);
    setCurrentFolderId(nextPath[nextPath.length - 1]?.id ?? null);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload fontSize="small" />
            <Typography variant="h6">Select Media from Google Drive</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search files"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {folderPath.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="Root" icon={<Folder />} size="small" onClick={() => handleBreadcrumbClick(-1)} />
            {folderPath.map((folder, index) => (
              <Chip
                key={folder.id}
                label={folder.name}
                icon={<Folder />}
                size="small"
                onClick={() => handleBreadcrumbClick(index)}
              />
            ))}
          </Box>
        )}

        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
          <Tab disabled={!mediaTypes.includes('image')} icon={<ImageIcon />} iconPosition="start" label="Images" />
          <Tab disabled={!mediaTypes.includes('video')} icon={<VideoLibrary />} iconPosition="start" label="Videos" />
          <Tab disabled={!mediaTypes.includes('audio')} icon={<AudioFile />} iconPosition="start" label="Audio" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {selectedFileIds.size > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedFileIds.size} file{selectedFileIds.size > 1 ? 's' : ''} selected
            {!allowMultiple ? ' (single selection mode)' : ''}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
            <Typography color="text.secondary">No files found</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {files.map((file) => {
              const isFolder = mediaTypeFromMime(file.mimeType) === 'folder';
              const isSelected = selectedFileIds.has(file.id);
              const thumbnail = file.thumbnailLink ?? file.iconLink;

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                  <Card
                    sx={{
                      position: 'relative',
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (isFolder) {
                        handleFolderClick(file.id, file.name);
                      } else {
                        toggleSelection(file.id);
                      }
                    }}
                  >
                    {isSelected && (
                      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                        <CheckCircle color="primary" fontSize="small" />
                      </Box>
                    )}

                    {isFolder ? (
                      <Box
                        sx={{
                          height: 140,
                          bgcolor: 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Folder sx={{ fontSize: 48, color: 'text.secondary' }} />
                      </Box>
                    ) : (
                      <CardMedia
                        component="img"
                        height="140"
                        image={thumbnail}
                        alt={file.name}
                        sx={{ objectFit: 'cover', bgcolor: 'grey.100' }}
                      />
                    )}

                    <CardContent sx={{ pb: '12px !important' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        {!isFolder && (
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => toggleSelection(file.id)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap title={file.name} sx={{ fontWeight: 600 }}>
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(file.size)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Box sx={{ width: '100%', px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {allowMultiple ? 'Select one or more files' : 'Select one file'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              disabled={selectedFileIds.size === 0}
              onClick={handleConfirmSelection}
              startIcon={<CheckCircle fontSize="small" />}
            >
              Add {selectedFileIds.size > 0 ? `(${selectedFileIds.size})` : ''}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
