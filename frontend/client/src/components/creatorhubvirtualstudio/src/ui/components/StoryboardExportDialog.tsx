/**
 * StoryboardExportDialog - UI for exporting storyboards to various formats
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Slider,
  LinearProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import {
  PictureAsPdf,
  Image,
  Movie,
  GridView,
  Download,
  Close,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  storyboardExportService,
  ExportFormat,
  ExportOptions,
  ExportProgress,
  ExportResult,
} from '../../core/storyboard/StoryboardExportService';
import { useCurrentStoryboard, Storyboard } from '../../state/storyboardStore';
import { useAnnounce } from '../../providers/AccessibilityProvider';

// =============================================================================
// Types
// =============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

interface StoryboardExportDialogProps {
  open: boolean;
  onClose: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

export const StoryboardExportDialog: React.FC<StoryboardExportDialogProps> = ({
  open,
  onClose,
}) => {
  const storyboard = useCurrentStoryboard();
  const { announce } = useAnnounce();
  
  // State
  const [activeTab, setActiveTab] = useState(0);

  // Announce dialog open
  useEffect(() => {
    if (open) {
      announce('Export dialog opened. Choose export format: PDF, Image, or Video.');
    }
  }, [open, announce]);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  // PDF Options
  const [pdfLayout, setPdfLayout] = useState<'grid' | 'single' | 'technical'>('grid');
  const [pdfPageSize, setPdfPageSize] = useState<'A4' | 'Letter' | 'A3'>('A4');
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [includeTechnicalInfo, setIncludeTechnicalInfo] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);

  // PNG Options
  const [contactSheetColumns, setContactSheetColumns] = useState(4);
  const [exportAsSingleImages, setExportAsSingleImages] = useState(false);

  // Video Options
  const [videoWidth, setVideoWidth] = useState(1920);
  const [videoHeight, setVideoHeight] = useState(1080);
  const [videoFps, setVideoFps] = useState(24);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high' | 'max'>('high');
  const [transitionType, setTransitionType] = useState<'cut' | 'fade' | 'dissolve'>('cut');
  const [transitionDuration, setTransitionDuration] = useState(0.5);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setResult(null);
      setProgress(null);
      setIsExporting(false);
    }
  }, [open]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!storyboard) return;

    setIsExporting(true);
    setResult(null);
    setProgress({ stage: 'preparing', progress: 0 });

    const format: ExportFormat = activeTab === 0 ? 'pdf' : activeTab === 1 ? (exportAsSingleImages ? 'png' : 'png-contact') : 'video';
    const formatName = format === 'pdf' ? 'PDF' : format.includes('png') ? 'Image' : 'Video';
    
    announce(`Starting ${formatName} export...`);

    const options: ExportOptions = {
      format,
      // PDF
      pdfLayout,
      pdfPageSize,
      pdfOrientation,
      includeTechnicalInfo,
      includeNotes,
      includeTimecodes: true,
      // PNG
      contactSheetColumns,
      pngScale: 1,
      pngQuality: 0.9,
      // Video
      videoWidth,
      videoHeight,
      videoFps,
      videoQuality,
      transitionType,
      transitionDuration,
    };

    try {
      const exportResult = await storyboardExportService.export(
        storyboard,
        options,
        (p) => {
          setProgress(p);
          // Announce progress milestones
          if (p.progress === 25 || p.progress === 50 || p.progress === 75) {
            announce(`Export ${p.progress}% complete`);
          }
        }
      );

      setResult(exportResult);

      if (exportResult.success) {
        announce(`${formatName} export completed successfully. Download starting.`);
        storyboardExportService.downloadResult(exportResult);
      } else {
        announce(`Export failed: ${exportResult.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      announce(`Export error: ${errorMessage}`);
      setResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    announce,
    storyboard,
    activeTab,
    pdfLayout,
    pdfPageSize,
    pdfOrientation,
    includeTechnicalInfo,
    includeNotes,
    exportAsSingleImages,
    contactSheetColumns,
    videoWidth,
    videoHeight,
    videoFps,
    videoQuality,
    transitionType,
    transitionDuration,
  ]);

  if (!storyboard) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Export Storyboard</Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Storyboard Info */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Exporting:
          </Typography>
          <Typography variant="body1" fontWeight={600}>
            {storyboard.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip label={`${storyboard.frames.length} frames`} size="small" />
            <Chip label={storyboard.aspectRatio} size="small" />
          </Stack>
        </Box>

        {/* Format Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<PictureAsPdf />} label="PDF" />
          <Tab icon={<Image />} label="Images" />
          <Tab icon={<Movie />} label="Video" />
        </Tabs>

        {/* PDF Options */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Layout</InputLabel>
              <Select
                value={pdfLayout}
                onChange={(e) => setPdfLayout(e.target.value as typeof pdfLayout)}
                label="Layout"
              >
                <MenuItem value="grid">Grid (3x3 per page)</MenuItem>
                <MenuItem value="single">Single Frame per Page</MenuItem>
                <MenuItem value="technical">Technical Details</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Page Size</InputLabel>
                <Select
                  value={pdfPageSize}
                  onChange={(e) => setPdfPageSize(e.target.value as typeof pdfPageSize)}
                  label="Page Size"
                >
                  <MenuItem value="A4">A4</MenuItem>
                  <MenuItem value="Letter">US Letter</MenuItem>
                  <MenuItem value="A3">A3</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Orientation</InputLabel>
                <Select
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value as typeof pdfOrientation)}
                  label="Orientation"
                >
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="landscape">Landscape</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={includeTechnicalInfo}
                  onChange={(e) => setIncludeTechnicalInfo(e.target.checked)}
                />
              }
              label="Include camera settings & technical info"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
              }
              label="Include frame notes & descriptions"
            />
          </Stack>
        </TabPanel>

        {/* Image Options */}
        <TabPanel value={activeTab} index={1}>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportAsSingleImages}
                  onChange={(e) => setExportAsSingleImages(e.target.checked)}
                />
              }
              label="Export as individual images (ZIP)"
            />

            {!exportAsSingleImages && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Contact Sheet Columns: {contactSheetColumns}
                </Typography>
                <Slider
                  value={contactSheetColumns}
                  onChange={(_, v) => setContactSheetColumns(v as number)}
                  min={2}
                  max={6}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>
            )}

            <Alert severity="info">
              {exportAsSingleImages
                ? 'Images will be exported as PNG files in a ZIP archive.'
                : 'All frames will be arranged on a single contact sheet image.'}
            </Alert>
          </Stack>
        </TabPanel>

        {/* Video Options */}
        <TabPanel value={activeTab} index={2}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Resolution</InputLabel>
                <Select
                  value={`${videoWidth}x${videoHeight}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    setVideoWidth(w);
                    setVideoHeight(h);
                  }}
                  label="Resolution"
                >
                  <MenuItem value="1920x1080">1080p (1920×1080)</MenuItem>
                  <MenuItem value="1280x720">720p (1280×720)</MenuItem>
                  <MenuItem value="3840x2160">4K (3840×2160)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Frame Rate</InputLabel>
                <Select
                  value={videoFps}
                  onChange={(e) => setVideoFps(e.target.value as number)}
                  label="Frame Rate"
                >
                  <MenuItem value={24}>24 fps (Film)</MenuItem>
                  <MenuItem value={25}>25 fps (PAL)</MenuItem>
                  <MenuItem value={30}>30 fps (NTSC)</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Quality</InputLabel>
              <Select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as typeof videoQuality)}
                label="Quality"
              >
                <MenuItem value="low">Low (fast export)</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="max">Maximum</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Transition</InputLabel>
              <Select
                value={transitionType}
                onChange={(e) => setTransitionType(e.target.value as typeof transitionType)}
                label="Transition"
              >
                <MenuItem value="cut">Cut (instant)</MenuItem>
                <MenuItem value="fade">Fade to Black</MenuItem>
                <MenuItem value="dissolve">Dissolve</MenuItem>
              </Select>
            </FormControl>

            {transitionType !== 'cut' && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Transition Duration: {transitionDuration}s
                </Typography>
                <Slider
                  value={transitionDuration}
                  onChange={(_, v) => setTransitionDuration(v as number)}
                  min={0.1}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
              </Box>
            )}

            <Alert severity="info">
              Video will be exported as WebM format (VP9 codec).
            </Alert>
          </Stack>
        </TabPanel>

        {/* Progress */}
        {isExporting && progress && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress.progress}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {progress.message || `${progress.stage}...`}
              {progress.currentFrame && progress.totalFrames && (
                <> (Frame {progress.currentFrame}/{progress.totalFrames})</>
              )}
            </Typography>
          </Box>
        )}

        {/* Result */}
        {result && (
          <Box sx={{ mt: 2 }}>
            {result.success ? (
              <Alert
                severity="success"
                icon={<CheckCircle />}
                action={
                  result.url && (
                    <Button
                      size="small"
                      startIcon={<Download />}
                      onClick={() => storyboardExportService.downloadResult(result)}
                    >
                      Download Again
                    </Button>
                  )
                }
              >
                Export complete! Your file has been downloaded.
              </Alert>
            ) : (
              <Alert severity="error" icon={<ErrorIcon />}>
                {result.error || 'Export failed'}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleExport}
          disabled={isExporting || storyboard.frames.length === 0}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoryboardExportDialog;

