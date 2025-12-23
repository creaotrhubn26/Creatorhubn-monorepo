/**
 * VideoExportPanel - UI for exporting animations to video
 * 
 * Features:
 * - Format selection (WebM/MP4)
 * - Resolution presets
 * - Quality settings
 * - Progress visualization
 * - Download management
 * - Export presets for social platforms
 * - Google Drive upload integration
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  TextField,
  LinearProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActionArea,
  Switch,
  FormControlLabel,
  Stack,
} from '@mui/material';
import {
  Download,
  VideoFile,
  Settings,
  PlayArrow,
  Stop,
  Refresh,
  Check,
  Error,
  FolderOpen,
  Image,
  HighQuality,
  Sd,
  Hd,
  FourK,
  Instagram,
  YouTube,
  AspectRatio,
  Speed,
  Timer,
  Storage,
  CloudUpload,
  Tune,
  AutoAwesome,
} from '@mui/icons-material';
import {
  videoExportService,
  VideoExportConfig,
  ExportProgress,
  ExportResult,
  RESOLUTION_PRESETS,
  QUALITY_PRESETS,
  FPS_PRESETS,
} from '../../core/animation/VideoExportService';
import {
  googleDriveExportService,
  EXPORT_PRESETS,
  ExportPreset,
  GoogleDriveUploadProgress,
} from '../../core/animation/GoogleDriveExportService';

// ============================================================================
// Types
// ============================================================================

interface VideoExportPanelProps {
  duration: number;
  userId?: string;
  projectId?: string;
  projectName?: string;
  onFrameRender?: (time: number, frameIndex: number) => void;
  onExportStart?: () => void;
  onExportComplete?: (result: ExportResult) => void;
  onDriveUploadComplete?: (result: { fileId: string; webViewLink: string }) => void;
}

type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;
type QualityPreset = keyof typeof QUALITY_PRESETS;
type ExportTab = 'presets' | 'custom' | 'drive';

// ============================================================================
// Resolution Icon Component
// ============================================================================

function ResolutionIcon({ preset }: { preset: ResolutionPreset }) {
  switch (preset) {
    case '480p':
      return <Sd />;
    case '720p':
    case '1080p':
      return <Hd />;
    case '1440p':
    case '4K':
      return <FourK />;
    case 'Instagram':
    case 'InstagramStory':
      return <Instagram />;
    case 'YouTube':
    case 'YouTubeShorts':
    case 'TikTok':
      return <YouTube />;
    default:
      return <AspectRatio />;
  }
}

// ============================================================================
// Export History Item
// ============================================================================

interface ExportHistoryItem {
  id: string;
  filename: string;
  timestamp: Date;
  duration: number;
  fileSize: number;
  url: string;
  format: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function VideoExportPanel({
  duration,
  userId,
  projectId,
  projectName,
  onFrameRender,
  onExportStart,
  onExportComplete,
  onDriveUploadComplete,
}: VideoExportPanelProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ExportTab>('presets');
  const [selectedPreset, setSelectedPreset] = useState<ExportPreset | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  // Config state
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm');
  const [resolution, setResolution] = useState<ResolutionPreset>('1080p');
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [fps, setFps] = useState<number>(30);
  const [customWidth, setCustomWidth] = useState<number>(1920);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  const [useCustomResolution, setUseCustomResolution] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Google Drive state
  const [driveConnected, setDriveConnected] = useState(false);
  const [uploadToDrive, setUploadToDrive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<GoogleDriveUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [projectFolders, setProjectFolders] = useState<Array<{ id: string; name: string; webViewLink: string }>>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Check Google Drive status
  useEffect(() => {
    if (userId) {
      googleDriveExportService.checkDriveStatus(userId).then((status) => {
        setDriveConnected(status.connected && status.oauthAvailable);
      });
      googleDriveExportService.getProjectFolders(userId).then(setProjectFolders);
    }
  }, [userId]);

  // Get filtered presets
  const filteredPresets = platformFilter === 'all'
    ? EXPORT_PRESETS
    : EXPORT_PRESETS.filter((p) => p.platform === platformFilter);

  const platforms = googleDriveExportService.getAllPlatforms();

  // Get current dimensions
  const currentDimensions = useCustomResolution
    ? { width: customWidth, height: customHeight }
    : RESOLUTION_PRESETS[resolution];

  // Estimated file size
  const estimatedSize = videoExportService.estimateFileSize({
    format,
    width: currentDimensions.width,
    height: currentDimensions.height,
    fps,
    bitrate: QUALITY_PRESETS[quality].bitrate,
    duration,
    quality,
  });

  // Handle export with preset or custom config
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress(null);
    setLastResult(null);
    onExportStart?.();

    // Use preset config or custom config
    const exportConfig: VideoExportConfig = selectedPreset
      ? {
          format: selectedPreset.config.format,
          width: selectedPreset.config.width,
          height: selectedPreset.config.height,
          fps: selectedPreset.config.fps,
          bitrate: selectedPreset.config.bitrate,
          duration,
          quality: 'high',
        }
      : {
          format,
          width: currentDimensions.width,
          height: currentDimensions.height,
          fps,
          bitrate: QUALITY_PRESETS[quality].bitrate,
          duration,
          quality,
        };

    const result = await videoExportService.exportVideo(
      exportConfig,
      setProgress,
      onFrameRender
    );

    setIsExporting(false);
    setLastResult(result);
    onExportComplete?.(result);

    // Add to history if successful
    if (result.success && result.url && result.filename) {
      setExportHistory((prev) => [
        {
          id: Date.now().toString(),
          filename: result.filename!,
          timestamp: new Date(),
          duration,
          fileSize: result.fileSize || 0,
          url: result.url!,
          format: exportConfig.format,
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);

      // Upload to Google Drive if enabled
      if (uploadToDrive && userId && driveConnected) {
        handleDriveUpload(result);
      }
    }
  }, [format, currentDimensions, fps, quality, duration, onFrameRender, onExportStart, onExportComplete, selectedPreset, uploadToDrive, userId, driveConnected]);

  // Handle Google Drive upload
  const handleDriveUpload = useCallback(async (exportResult: ExportResult) => {
    if (!userId || !exportResult.success) return;

    setIsUploading(true);
    setUploadProgress(null);

    const uploadResult = await googleDriveExportService.uploadVideo(
      exportResult,
      {
        userId,
        projectId,
        projectName,
        folderId: selectedFolderId || undefined,
        createFolder: !selectedFolderId && !!projectName,
      },
      setUploadProgress
    );

    setIsUploading(false);

    if (uploadResult.success && uploadResult.webViewLink) {
      onDriveUploadComplete?.({
        fileId: uploadResult.fileId!,
        webViewLink: uploadResult.webViewLink,
      });
    }
  }, [userId, projectId, projectName, selectedFolderId, onDriveUploadComplete]);

  // Apply preset
  const handleApplyPreset = useCallback((preset: ExportPreset) => {
    setSelectedPreset(preset);
    setFormat(preset.config.format);
    setFps(preset.config.fps);
    // Map to closest resolution preset
    const presetKey = Object.entries(RESOLUTION_PRESETS).find(
      ([, dims]) => dims.width === preset.config.width && dims.height === preset.config.height
    )?.[0];
    if (presetKey) {
      setResolution(presetKey as ResolutionPreset);
      setUseCustomResolution(false);
    } else {
      setCustomWidth(preset.config.width);
      setCustomHeight(preset.config.height);
      setUseCustomResolution(true);
    }
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    videoExportService.cancelExport();
    setIsExporting(false);
  }, []);

  // Handle download
  const handleDownload = useCallback((result: ExportResult) => {
    videoExportService.downloadVideo(result);
  }, []);

  // Handle download from history
  const handleDownloadFromHistory = useCallback((item: ExportHistoryItem) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Handle export single frame
  const handleExportFrame = useCallback(() => {
    const result = videoExportService.exportFrame(
      currentDimensions.width,
      currentDimensions.height'png'
    );

    if (result.success && result.url && result.filename) {
      videoExportService.downloadVideo(result as ExportResult);
    }
  }, [currentDimensions]);

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VideoFile />
        Video Export
      </Typography>

      {/* Quick info */}
      <Alert severity="info" sx={{ mb: 2 }}>
        Export your animation as video. Duration: {videoExportService.formatDuration(duration)}
        {selectedPreset && ` • Using ${selectedPreset.name} preset`}
      </Alert>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2 }}
      >
        <Tab value="presets" icon={<AutoAwesome />} iconPosition="start" label="Presets" />
        <Tab value="custom" icon={<Tune />} iconPosition="start" label="Custom" />
        <Tab value="drive" icon={<CloudUpload />} iconPosition="start" label="Google Drive" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <Box>
            {/* Platform filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Platform</InputLabel>
              <Select
                value={platformFilter}
                label="Platform"
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <MenuItem value="all">All Platforms</MenuItem>
                {platforms.map((p) => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Preset cards */}
            <Grid container spacing={1}>
              {filteredPresets.map((preset) => (
                <Grid item xs={6} key={preset.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selectedPreset?.id === preset.id ? '2px solid #2196f3' : '1px solid #333',
                      backgroundColor: selectedPreset?.id === preset.id ? '#2196f322' : 'transparent'}}
                  >
                    <CardActionArea onClick={() => handleApplyPreset(preset)}>
                      <CardContent sx={{ p: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="h6" sx={{ fontSize: 20 }}>
                            {preset.icon}
                          </Typography>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {preset.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {preset.config.width}×{preset.config.height} • {preset.config.fps}fps
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 10 }}>
                          {preset.description}
                        </Typography>
                        {selectedPreset?.id === preset.id && (
                          <Box sx={{ mt: 1 }}>
                            {preset.tips.map((tip, i) => (
                              <Typography key={i} variant="caption" display="block" color="primary.light" sx={{ fontSize: 9 }}>
                                • {tip}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Export with preset */}
            {selectedPreset && (
              <Paper sx={{ p: 2, mt: 2, backgroundColor: '#1a2a1a' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Ready to export with {selectedPreset.name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip label={`${selectedPreset.config.width}×${selectedPreset.config.height}`} size="small" />
                  <Chip label={`${selectedPreset.config.fps} fps`} size="small" />
                  <Chip label={selectedPreset.config.format.toUpperCase()} size="small" />
                  <Chip label={selectedPreset.config.aspectRatio} size="small" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Est. size: ~{videoExportService.formatFileSize(
                    Math.ceil((selectedPreset.config.bitrate * duration) / 8)
                  )}
                </Typography>
              </Paper>
            )}
          </Box>
        )}

        {/* Custom Tab */}
        {activeTab === 'custom' && (
          <Paper sx={{ p: 2, backgroundColor: '#1a1a2a' }}>
        <Typography variant="subtitle2" gutterBottom>
          Format & Resolution
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Format</InputLabel>
              <Select
                value={format}
                label="Format"
                onChange={(e) => setFormat(e.target.value as 'webm, ' | 'mp4')}
                disabled={isExporting}
              >
                <MenuItem value="webm">WebM (VP9)</MenuItem>
                <MenuItem value="mp4">MP4 (H.264)*</MenuItem>
              </Select>
            </FormControl>
            {format === 'mp4' && (
              <Typography variant="caption" color="warning.main">
                *MP4 may fall back to WebM
              </Typography>
            )}
          </Grid>
          
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Resolution</InputLabel>
              <Select
                value={resolution}
                label="Resolution"
                onChange={(e) => {
                  setResolution(e.target.value as ResolutionPreset);
                  setUseCustomResolution(false);
                }}
                disabled={isExporting}
              >
                {Object.entries(RESOLUTION_PRESETS).map(([key, dims]) => (
                  <MenuItem key={key} value={key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ResolutionIcon preset={key as ResolutionPreset} />
                      {key} ({dims.width}×{dims.height})
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Quality & FPS */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Quality</InputLabel>
              <Select
                value={quality}
                label="Quality"
                onChange={(e) => setQuality(e.target.value as QualityPreset)}
                disabled={isExporting}
              >
                {Object.entries(QUALITY_PRESETS).map(([key, info]) => (
                  <MenuItem key={key} value={key}>
                    <Box>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {key}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {info.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Frame Rate</InputLabel>
              <Select
                value={fps}
                label="Frame Rate"
                onChange={(e) => setFps(e.target.value as number)}
                disabled={isExporting}
              >
                {FPS_PRESETS.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f} fps
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Estimated info */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<Timer />}
            label={`${videoExportService.formatDuration(duration)}`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<AspectRatio />}
            label={`${currentDimensions.width}×${currentDimensions.height}`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Speed />}
            label={`${fps} fps`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Storage />}
            label={`~${videoExportService.formatFileSize(estimatedSize)}`}
            size="small"
            variant="outlined"
          />
        </Box>
          </Paper>
        )}

        {/* Google Drive Tab */}
        {activeTab === 'drive' && (
          <Box>
            {/* Connection Status */}
            <Paper sx={{ p: 2, mb: 2, backgroundColor: driveConnected ? '#1a2a1a' : '#2a1a1a' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {driveConnected ? (
                  <>
                    <Check color="success" />
                    <Typography variant="subtitle2" color="success.main">
                      Google Drive Connected
                    </Typography>
                  </>
                ) : (
                  <>
                    <Error color="warning" />
                    <Typography variant="subtitle2" color="warning.main">
                      Google Drive Not Connected
                    </Typography>
                  </>
                )}
              </Box>
              {!driveConnected && (
                <Typography variant="body2" color="text.secondary">
                  Connect your Google Drive in the settings to enable automatic upload.
                </Typography>
              )}
            </Paper>

            {driveConnected && (
              <>
                {/* Auto-upload toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={uploadToDrive}
                      onChange={(e) => setUploadToDrive(e.target.checked)}
                    />
                  }
                  label="Auto-upload after export"
                  sx={{ mb: 2 }}
                />

                {/* Folder selection */}
                {uploadToDrive && (
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Target Folder</InputLabel>
                    <Select
                      value={selectedFolderId}
                      label="Target Folder"
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Create new folder for {projectName || 'project'}</em>
                      </MenuItem>
                      {projectFolders.map((folder) => (
                        <MenuItem key={folder.id} value={folder.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FolderOpen fontSize="small" />
                            {folder.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Upload progress */}
                {isUploading && uploadProgress && (
                  <Paper sx={{ p: 2, mb: 2, backgroundColor: '#1a2a1a' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CloudUpload color="primary" />
                      <Typography variant="subtitle2">
                        Uploading to Google Drive...
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress.percentage}
                      sx={{ height: 8, borderRadius: 4, mb: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {uploadProgress.status === 'complete'
                        ? 'Upload complete!'
                        : `${uploadProgress.percentage.toFixed(1)}% • ${videoExportService.formatFileSize(uploadProgress.bytesUploaded)} / ${videoExportService.formatFileSize(uploadProgress.totalBytes)}`}
                    </Typography>
                  </Paper>
                )}

                {/* Manual upload for last export */}
                {lastResult?.success && !isUploading && (
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<CloudUpload />}
                    onClick={() => handleDriveUpload(lastResult)}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    Upload Last Export to Drive
                  </Button>
                )}

                {/* Project folders list */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Your Project Folders
                </Typography>
                <List dense>
                  {projectFolders.slice(0, 5).map((folder) => (
                    <ListItem
                      key={folder.id}
                      sx={{
                        backgroundColor: '#1a1a2a',
                        borderRadius: 1,
                        mb: 0.5,
                        cursor: 'pointer', '&:hover': { backgroundColor: '#2a2a3a' }}}
                      onClick={() => window.open(folder.webViewLink'_blank')}
                    >
                      <ListItemIcon>
                        <FolderOpen />
                      </ListItemIcon>
                      <ListItemText primary={folder.name} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Progress */}
      {isExporting && progress && (
        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#1a2a1a' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {progress.status === 'rendering' && <CircularProgress size={16} />}
              {progress.status === 'encoding' && <CircularProgress size={16} color="secondary" />}
              {progress.status === 'complete' && <Check color="success" />}
              {progress.status === 'error' && <Error color="error" />}
              {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}...
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {progress.percentage.toFixed(1)}%
            </Typography>
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={progress.percentage}
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Frame {progress.currentFrame} / {progress.totalFrames}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ETA: {videoExportService.formatDuration(progress.estimatedTimeRemaining)}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Result */}
      {lastResult && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            backgroundColor: lastResult.success ? '#1a2a1a' : '#2a1a1a'}}
        >
          {lastResult.success ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Check color="success" />
                <Typography variant="subtitle2" color="success.main">
                  Export Complete!
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {lastResult.filename} ({videoExportService.formatFileSize(lastResult.fileSize || 0)})
              </Typography>
              <Button
                variant="contained"
                color="success"
                startIcon={<Download />}
                onClick={() => handleDownload(lastResult)}
                fullWidth
              >
                Download Video
              </Button>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Error color="error" />
                <Typography variant="subtitle2" color="error.main">
                  Export Failed
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {lastResult.error}
              </Typography>
            </>
          )}
        </Paper>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {!isExporting ? (
          <>
            <Button
              variant="contained"
              color="primary"
              startIcon={<VideoFile />}
              onClick={handleExport}
              fullWidth
              disabled={duration <= 0}
            >
              Export Video
            </Button>
            <Tooltip title="Export Current Frame">
              <IconButton onClick={handleExportFrame}>
                <Image />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Stop />}
            onClick={handleCancel}
            fullWidth
          >
            Cancel Export
          </Button>
        )}
      </Box>

      {/* Export History */}
      {exportHistory.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Recent Exports
          </Typography>
          <List dense>
            {exportHistory.slice(0, 5).map((item) => (
              <ListItem
                key={item.id}
                sx={{
                  backgroundColor: '#1a1a2a',
                  borderRadius: 1,
                  mb: 0.5}}
              >
                <ListItemIcon>
                  <VideoFile />
                </ListItemIcon>
                <ListItemText
                  primary={item.filename}
                  secondary={`${videoExportService.formatFileSize(item.fileSize)} • ${item.timestamp.toLocaleTimeString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleDownloadFromHistory(item)}
                  >
                    <Download />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
}

export default VideoExportPanel;

