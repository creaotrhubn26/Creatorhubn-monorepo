/**
 * Asset Management Component
 * Extracted from CreatorhubVisualEditor.tsx for better organization
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '../../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { apiRequest } from '../../../lib/queryClient';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  LinearProgress,
  CircularProgress,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tabs,
  Tab,
  ListItem,
  List,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import {
  Folder,
  FileUpload as UploadIcon,
  CloudUpload,
  VideoLibrary,
  Image as ImageIcon,
} from '@mui/icons-material';
import { FileUpload } from '@/lib/upload';

interface Asset {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedAt: string;
  index?: number;
}

interface MediaAssets {
  images: Asset[];
  videos: Asset[];
  audio: Asset[];
  documents: Asset[];
}

interface AssetManagerProps {
  selectedProject?: { id: string; name?: string };
  onFileUpload?: (file: File | Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void; 
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  selectedProject,
  onFileUpload,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Asset state management
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAssets>({
    images: [],
    videos: [],
    audio: [],
    documents: [],
  });
  
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [mediaImportProgress, setMediaImportProgress] = useState(0);

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('asset_manager_render,');

    lifecycle.registerComponent({
      id: 'AssetManager',
      type: 'asset-manager',
      version: '1.0.0',
      capabilities: {
        data: ['asset:read','asset:write','file:upload','media:manage'],
        events: ['asset:uploaded','asset:deleted','media:filtered'],
        actions: ['file:upload','asset:delete','media:filter','crop:image'],
        ui: ['asset:display','upload:interface','media:gallery'],
        system: ['performance:monitor','analytics:track','debug:log'],
      },
      dependencies: ['@mui/material', 'EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('asset_manager_mounted', {
      componentId: 'AssetManager',
      projectId: selectedProject?.id,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AssetManager component mounted', {
      componentId: 'AssetManager',
      projectId: selectedProject?.id,
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('AssetManager');
      analytics.trackEvent('asset_manager_unmounted', {
        componentId: 'AssetManager',
        timestamp: Date.now(),
      });
    };
  }, [analytics, lifecycle, performance, debugging, selectedProject?.id]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'images' | 'videos' | 'audio' | 'documents'>('all');
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const headers = await auth.getAuthHeader();
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', selectedProject?.id || 'default');

        const result = await apiRequest('/api/assets/upload', {
          headers,
          method: 'POST',
          body: formData,
        });

        const progressInterval = setInterval(() => {
          setUploadProgress(prev => prev + (100 / files.length / 10));
        }, 100);

        clearInterval(progressInterval);

        return result;
      });

      const results = await Promise.all(uploadPromises);

      setUploadedAssets(prev => [...prev, ...results]);

      onNotificationCreate?.({
        id: `assets_uploaded_${Date.now()}`,
        type: 'asset_uploaded',
        title: 'Assets Uploaded',
        message: `${results.length} files uploaded successfully`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'asset_manager',
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload assets';
      debugging.logIntegration('error', 'Asset upload failed', { error: errorMessage, projectId: selectedProject?.id });
      onNotificationCreate?.({
        id: `upload_error_${Date.now()}`,
        type: 'error',
        title: 'Upload Failed',
        message: errorMessage,
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'asset_manager',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedProject?.id, onFileUpload, onNotificationCreate]);

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const files = event.dataTransfer.files;
    handleFileUpload(files);
  }, [handleFileUpload]);

  // Asset preview
  const handlePreviewAsset = useCallback((asset: Asset) => {
    setPreviewAsset(asset);
  }, []);

  // Organize media by type
  const organizeMediaByType = useCallback((assets: Asset[]) => {
    const organized: MediaAssets = {
      images: [],
      videos: [],
      audio: [],
      documents: [],
    };

    assets.forEach((asset, index) => {
      if (asset.type?.includes('image')) {
        organized.images.push({ ...asset, index });
      } else if (asset.type?.includes('video')) {
        organized.videos.push({ ...asset, index });
      } else if (asset.type?.includes('audio')) {
        organized.audio.push({ ...asset, index });
      } else {
        organized.documents.push({ ...asset, index });
      }
    });

    return organized;
  }, []);

  // Handle media import
  const handleImportMedia = useCallback(async () => {
    setIsProcessingMedia(true);
    setMediaImportProgress(0);

    try {
      const organized = organizeMediaByType(uploadedAssets);
      setMediaAssets(organized);

      // Simulate processing progress
      const totalSteps = 100;
      for (let i = 0; i < totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        setMediaImportProgress(((i + 1) / totalSteps) * 100);
      }

      analytics.trackEvent('media_imported', {
        totalAssets: uploadedAssets.length,
        images: organized.images.length,
        videos: organized.videos.length,
        audio: organized.audio.length,
        documents: organized.documents.length,
        projectId: selectedProject?.id,
      });

      onNotificationCreate?.({
        id: `media_imported_${Date.now()}`,
        type: 'success',
        title: 'Media Imported',
        message: `${uploadedAssets.length} assets organized and imported`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'asset_manager',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import media';
      debugging.logIntegration('error', 'Media import failed', { error: errorMessage });
    } finally {
      setIsProcessingMedia(false);
      setMediaImportProgress(0);
    }
  }, [uploadedAssets, organizeMediaByType, analytics, debugging, onNotificationCreate, selectedProject?.id]);

  // Filter assets by type and search query
  const filteredAssets = uploadedAssets.filter(asset => {
    const matchesType = selectedMediaType === 'all' || asset.type?.includes(selectedMediaType.slice(0, -1));
    const matchesSearch = searchQuery === '' || asset.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        {theming.getThemedIcon('folder')}
        Asset Manager
      </Typography>

      {/* Upload Area */}
      <Paper
        sx={{
          ...theming.getThemedCardSx(),
          p: 3,
          border: `2px dashed ${dragOver ? 'primary.main' : 'grey.300'}`,
          backgroundColor: dragOver ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          mb: 2}}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Grid container direction="column" alignItems="center" spacing={2}>
          <Grid item>
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          </Grid>
          <Grid item>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Drag & drop files here or click to upload
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={theming.getThemedIcon('cloudUpload')}
              disabled={isUploading}
              sx={theming.getThemedButtonSx()}
            >
              Select Files
            </Button>
          </Grid>
        </Grid>

        <input
          id="file-input"
          type="file"
          multiple
          hidden
          aria-label="File upload input"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        />

        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="caption">
              Uploading: {Math.round(uploadProgress)}%
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Asset Library */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
          <TextField
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flex: 1, maxWidth: 300 }}
          />
          <Tabs value={selectedMediaType} onChange={(_, newValue) => setSelectedMediaType(newValue)}>
            <Tab label="All Assets" value="all" />
            <Tab label="Images" value="images" />
            <Tab label="Videos" value="videos" />
            <Tab label="Audio" value="audio" />
            <Tab label="Documents" value="documents" />
          </Tabs>

          <IconButton 
            onClick={() => setUploadDialogOpen(true)}
            title="Open asset panel"
          >
            <Folder />
          </IconButton>
        </Box>

        {filteredAssets.length > 0 ? (
          <ImageList sx={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {filteredAssets.map((asset, index) => (
              <ImageListItem key={`${asset.id}-${index}`}>
                {asset.type?.includes('image') ? (
                  <img src={asset.url} alt={asset.name} />
                ) : (
                  <Box
                    sx={{
                      height: 100,
                      backgroundColor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    {asset.type?.includes('video') ? (
                      <VideoLibrary sx={{ fontSize: 40, color: 'primary.main' }} />
                    ) : (
                      <Folder sx={{ fontSize: 40, color: 'primary.main' }} />
                    )}
                  </Box>
                )}
                <ImageListItemBar
                  title={asset.name}
                  subtitle={`${(asset.size / 1024).toFixed(1)} KB`}
                  actionIcon={
                    <IconButton onClick={() => handlePreviewAsset(asset)}>
                      <Typography variant="caption">Preview</Typography>
                    </IconButton>
                  }
                />
              </ImageListItem>
            ))}
          </ImageList>
        ) : (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              color: 'text.secondary'}}
          >
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              No assets found
            </Typography>
            <Typography variant="body2">
              Upload files or drag & drop to get started
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Media Import Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CloudUpload />
            Media Import
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" gutterBottom>
              Organize and import your uploaded assets
            </Typography>
            {isProcessingMedia && (
              <Box sx={{ mt: 2 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <CircularProgress size={30} variant="determinate" value={mediaImportProgress} />
                  <Typography variant="body2">
                    Processing: {Math.round(mediaImportProgress)}%
                  </Typography>
                </Box>
              </Box>
            )}
            {mediaAssets.images.length > 0 || mediaAssets.videos.length > 0 || mediaAssets.audio.length > 0 || mediaAssets.documents.length > 0 ? (
              <List sx={{ mt: 2 }}>
                {mediaAssets.images.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <ImageIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Images" 
                      secondary={`${mediaAssets.images.length} image(s)`}
                    />
                  </ListItem>
                )}
                {mediaAssets.videos.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <VideoLibrary />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Videos" 
                      secondary={`${mediaAssets.videos.length} video(s)`}
                    />
                  </ListItem>
                )}
                {mediaAssets.audio.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <CloudUpload />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Audio" 
                      secondary={`${mediaAssets.audio.length} audio file(s)`}
                    />
                  </ListItem>
                )}
                {mediaAssets.documents.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <Folder />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Documents" 
                      secondary={`${mediaAssets.documents.length} document(s)`}
                    />
                  </ListItem>
                )}
              </List>
            ) : (
              <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                No media imported yet
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleImportMedia}
            disabled={isProcessingMedia || uploadedAssets.length === 0}
          >
            Import Media
          </Button>
        </DialogActions>
      </Dialog>

      {/* Asset Preview Dialog */}
      <Dialog
        open={!!previewAsset}
        onClose={() => setPreviewAsset(null)}
        maxWidth="lg"
        fullWidth
      >
        {previewAsset && (
          <>
            <DialogTitle>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>{previewAsset.name}</Typography>
                <Chip label={previewAsset.type} color="primary" size="small" />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  {previewAsset.type?.includes('image') ? (
                    <Box
                      component="img"
                      src={previewAsset.url}
                      alt={previewAsset.name}
                      sx={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: '8px'}}
                    />
                  ) : previewAsset.type?.includes('video') ? (
                    <Box
                      component="video"
                      src={previewAsset.url}
                      controls
                      sx={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: '8px'}}
                    />
                  ) : previewAsset.type?.includes('audio') ? (
                    <Box
                      component="audio"
                      src={previewAsset.url}
                      controls
                      sx={{ width: '100%' }}
                    />
                  ) : (
                    <Paper sx={{ ...theming.getThemedCardSx(), p: 4, textAlign: 'center' }}>
                      <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                        Preview not available
                      </Typography>
                    </Paper>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="File name" 
                        secondary={previewAsset.name} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="File type" 
                        secondary={previewAsset.type} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="File size" 
                        secondary={`${(previewAsset.size / 1024).toFixed(1)} KB`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Upload date" 
                        secondary={new Date(previewAsset.uploadedAt).toLocaleDateString()} 
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreviewAsset(null)}>Close</Button>
              <Button variant="contained" startIcon={<UploadIcon />}>
                Use in Project
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AssetManager;
