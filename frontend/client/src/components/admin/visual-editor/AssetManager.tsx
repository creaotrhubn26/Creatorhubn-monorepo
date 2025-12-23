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
  Image
} from '@mui/material';
import { Folder, FileUpload as UploadIcon, CloudUpload, VideoLibrary } from '@mui/icons-material';
import { FileUpload } from '@/lib/upload';

interface AssetManagerProps {
  selectedProject?: any;
  onFileUpload?: (file: any) => void;
  onNotificationCreate?: (notification: any) => void; 
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  selectedProject,
  onFileUpload,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester, ');
  
  // Asset state management
  const [uploadedAssets, setUploadedAssets] = useState<any[]>([]);

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
  
  // Asset panel open state
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  
  // Media import state
  const [mediaAssets, setMediaAssets] = useState<{
    images: any[];
    videos: any[];
    audio: any[];
    documents: any[];
  }>({
    images: [],
    videos: [],
    audio: [],
    documents: [],
  });
  
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [mediaImportProgress, setMediaImportProgress] = useState(0);

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
      onNotificationCreate?.({
        id: `upload_error_${Date.now()}`,
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload assets',
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
  const handlePreviewAsset = useCallback((asset: any) => {
    setPreviewAsset(asset);
  }, []);

  // Filter assets by type
  const filteredAssets = uploadedAssets.filter(asset => {
    if (selectedMediaType === 'all') return true;
    return asset.type?.includes(selectedMediaType.slice(0, -1)); // Remove 's' for comparison
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Tabs value={selectedMediaType} onChange={(_, newValue) => setSelectedMediaType(newValue)}>
            <Tab label="All Assets" value="all" />
            <Tab label="Images" value="images" />
            <Tab label="Videos" value="videos" />
            <Tab label="Audio" value="audio" />
            <Tab label="Documents" value="documents" />
          </Tabs>

          <IconButton onClick={() => setAssetPanelOpen(true)}>
            <UploadIcon />
          </IconButton>
        </Box>

        {filteredAssets.length > 0 ? (
          <ImageList sx={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {filteredAssets.map((asset) => (
              <ImageListItem key={asset.id}>
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
                    {asset.type?.includes('video') ? theming.getThemedIcon('videoLibrary') : theming.getThemedIcon('folder')}
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
