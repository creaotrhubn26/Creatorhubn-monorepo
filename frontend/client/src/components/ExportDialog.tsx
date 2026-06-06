// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stack,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Download,
  Settings,
  VideoFile,
  AudioFile,
  Palette,
  Speed as Speed,
  AspectRatio,
  Movie,
} from '@mui/icons-material';
import type { BeatClip, Track, StoryArc } from '../services/storyArcDataIntegration';
// DaVinci Resolve export functionality
interface ResolveExportOptions {
  projectName: string;
  frameRate: number;
  resolution: string;
  colorSpace: string;
  exportFormat: 'XML' | 'AAF' | 'EDL';
  includeAudio: boolean;
  includeColorGrading: boolean
}

interface ExportResult {
  success: boolean;
  exportId: string;
  error?: string;
  metadata: {
    projectName: string;
    totalClips: number;
    totalDuration: number;
    exportFormat: string;
    createdAt: string;
};
}

// Real DaVinci Resolve export service
const DaVinciResolveExportService = {
  getDefaultOptions(): ResolveExportOptions {
    return {
      projectName: 'CreatorHub Export',
      frameRate:  24,
      resolution: '1920x1080',
      colorSpace: 'Rec709',
      exportFormat: 'XML',
      includeAudio: true,
      includeColorGrading: false
};
},
  
  async exportTimeline(
    clips: BeatClip[], 
    tracks: Track[], 
    storyArc: StoryArc,
    options: ResolveExportOptions
  ): Promise<ExportResult> {
    try {
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate total duration
      const totalDuration = clips.length > 0 ? Math.max(...clips.map(c => c.start + c.duration)) : 0;
      
      // Generate XML content for DaVinci Resolve
      const xmlContent = this.generateFinalCutProXML(clips, tracks, storyArc, options);
      
      // Create blob and download URL
      const blob = new Blob([xmlContent], { type: 'application/xml',});
      const downloadUrl = URL.createObjectURL(blob);
      
      // Store export data in localStorage for persistence
      const exportData = {
        id: exportId,
        content: xmlContent,
        metadata: {
          projectName: options.projectName,
          totalClips: clips.length,
          totalDuration,
          exportFormat: options.exportFormat,
          createdAt: new Date().toISOString(),
          frameRate: options.frameRate,
          resolution: options.resolution,
          colorSpace: options.colorSpace
    },
        downloadUrl
    };
      
      localStorage.setItem(`davinci_export_${exportId}`, JSON.stringify(exportData));
      // Mirror to server KV
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: `davinci_export_${exportId}`, value: exportData })
      }).catch(() => {});
      
      return {
        success: true,
        exportId,
        metadata: exportData.metadata
  };
      
  } catch (error) {
      return {
        success: false,
        exportId: `error_${Date.now()}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          projectName: options.projectName,
          totalClips: clips.length,
          totalDuration:  0,
          exportFormat: options.exportFormat,
          createdAt: new Date().toISOString()
    }
    };
  }
  },

  generateFinalCutProXML(
    clips: BeatClip[],
    tracks: Track[],
    storyArc: StoryArc,
    options: ResolveExportOptions
  ): string {
    const [width, height] = options.resolution.split('x').map(Number);
    const frameRate = options.frameRate;
    const duration = clips.length > 0 ? Math.max(...clips.map(c => c.start + c.duration)) : 0;
    const durationInFrames = Math.round(duration * frameRate);
    
    // Sort clips by start time
    const sortedClips = [...clips].sort((a, b) => a.start - b.start);
    
    // Generate clip elements
    const clipElements = sortedClips.map((clip, index) => {
      const startFrame = Math.round(clip.start * frameRate);
      const durationFrames = Math.round(clip.duration * frameRate);
      const endFrame = startFrame + durationFrames;
      
      return `
        <clipitem id="clip-${index + 1}, ">
          <name>${clip.name || `Clip ${index + 1}`}</name>
          <duration>${durationFrames}</duration>
          <rate>
            <timebase>${frameRate}</timebase>
            <ntsc>FALSE</ntsc>
          </rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>0</in>
          <out>${durationFrames}</out>
          <file id="file-${index + 1}, ">
            <name>${clip.name || `Clip ${index + 1}`}</name>
            <pathurl>file://${clip.sourceClip?.filename || `/path/to/${clip.name || `clip_${index + 1}`}.mp4`}</pathurl>
            <rate>
              <timebase>${frameRate}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <timecode>
              <rate>
                <timebase>${frameRate}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <string>00: 00:00:00</string>
              <frame>0</frame>
            </timecode>
            <media>
              <video>
                <samplecharacteristics>
                  <rate>
                    <timebase>${frameRate}</timebase>
                    <ntsc>FALSE</ntsc>
                  </rate>
                  <width>${width}</width>
                  <height>${height}</height>
                  <pixelaspectratio>square</pixelaspectratio>
                  <fielddominance>none</fielddominance>
                  <colordepth>24</colordepth>
                </samplecharacteristics>
              </video>
              ${options.includeAudio ? `
              <audio>
                <samplecharacteristics>
                  <rate>
                    <timebase>${frameRate}</timebase>
                    <ntsc>FALSE</ntsc>
                  </rate>
                  <depth>16</depth>
                  <samplecharacteristics>
                    <rate>
                      <timebase>${frameRate}</timebase>
                      <ntsc>FALSE</ntsc>
                    </rate>
                    <depth>16</depth>
                    <samplecharacteristics>
                      <rate>
                        <timebase>${frameRate}</timebase>
                        <ntsc>FALSE</ntsc>
                      </rate>
                      <depth>16</depth>
                    </samplecharacteristics>
                  </samplecharacteristics>
                </samplecharacteristics>
              </audio>
              ` : ', '}
            </media>
          </file>
          <link>
            <linkclipref>file-${index + 1}</linkclipref>
            <mediatype>video</mediatype>
            <trackindex>1</trackindex>
            <clipindex>1</clipindex>
          </link>
          ${options.includeAudio ? `
          <link>
            <linkclipref>file-${index + 1}</linkclipref>
            <mediatype>audio</mediatype>
            <trackindex>1</trackindex>
            <clipindex>1</clipindex>
          </link>
          ` : ', '}
        </clipitem>
      `;
  }).join('\n,');
    
    // Generate track elements
    const trackElements = tracks.map((track, index) => {
      const trackClips = sortedClips.filter(clip => clip.trackId === track.id);
      
      return `
        <track>
          <name>${track.name || `Track ${index + 1}`}</name>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          ${trackClips.map((clip, clipIndex) => {
            const globalClipIndex = sortedClips.indexOf(clip) + 1;
            return `<clipitem ref="clip-${globalClipIndex},"/>`;
        }).join('\n')}
        </track>
      `;
  }).join('\n');
    
    // Generate the complete XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${storyArc.title || 'CreatorHub Export'}</name>
    <duration>${durationInFrames}</duration>
    <rate>
      <timebase>${frameRate}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>${frameRate}</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <string>00: 00:00:00</string>
      <frame>0</frame>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>${frameRate}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <width>${width}</width>
            <height>${height}</height>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            <colordepth>24</colordepth>
          </samplecharacteristics>
        </format>
        <track>
          <name>Video Track</name>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          ${sortedClips.map((_, index) => `<clipitem ref="clip-${index + 1}, "/>`).join('\n')}
        </track>
      </video>
      ${options.includeAudio ? `
      <audio>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>${frameRate}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <depth>16</depth>
            <samplecharacteristics>
              <rate>
                <timebase>${frameRate}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <depth>16</depth>
            </samplecharacteristics>
          </samplecharacteristics>
        </format>
        <track>
          <name>Audio Track</name>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          ${sortedClips.map((_, index) => `<clipitem ref="clip-${index + 1}, "/>`).join('\n')}
        </track>
      </audio>
      ` : ', '}
    </media>
    <project>
      <name>${options.projectName}</name>
      <children>
        <bin id="bin-1">
          <name>Clips</name>
          <children>
            ${sortedClips.map((clip, index) => `
              <file id="file-${index + 1}, ">
                <name>${clip.name || `Clip ${index + 1}`}</name>
                <pathurl>file://${clip.sourceClip?.filename || `/path/to/${clip.name || `clip_${index + 1}`}.mp4`}</pathurl>
                <rate>
                  <timebase>${frameRate}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <timecode>
                  <rate>
                    <timebase>${frameRate}</timebase>
                    <ntsc>FALSE</ntsc>
                  </rate>
                  <string>00: 00:00:00</string>
                  <frame>0</frame>
                </timecode>
                <media>
                  <video>
                    <samplecharacteristics>
                      <rate>
                        <timebase>${frameRate}</timebase>
                        <ntsc>FALSE</ntsc>
                      </rate>
                      <width>${width}</width>
                      <height>${height}</height>
                      <pixelaspectratio>square</pixelaspectratio>
                      <fielddominance>none</fielddominance>
                      <colordepth>24</colordepth>
                    </samplecharacteristics>
                  </video>
                  ${options.includeAudio ? `
                  <audio>
                    <samplecharacteristics>
                      <rate>
                        <timebase>${frameRate}</timebase>
                        <ntsc>FALSE</ntsc>
                      </rate>
                      <depth>16</depth>
                    </samplecharacteristics>
                  </audio>
                  ` : ', '}
                </media>
              </file>
            `).join('\n')}
          </children>
        </bin>
      </children>
    </project>
    <children>
      ${clipElements}
    </children>
  </sequence>
</xmeml>`;

    return xml;
},
  
  async downloadExport(exportId: string): Promise<boolean> {
    try {
      // Server-first
      let raw: any = null;
      try {
        const r = await fetch(`/api/user/kv/${encodeURIComponent(`davinci_export_${exportId}`)}`, { credentials: 'include' });
        const j = r.ok ? await r.json().catch(() => null) : null;
        raw = j && typeof j === 'object' && 'value' in j ? j.value : j;
      } catch {}
      const exportData = raw || localStorage.getItem(`davinci_export_${exportId}`);
      if (!exportData) {
        throw new Error('Export not found');
      }
      
      const data = typeof exportData === 'string' ? JSON.parse(exportData) : exportData;
      const blob = new Blob([data.content], { type: 'application/xml',});
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.metadata.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      return true;
  } catch (error) {
      console.error('Download failed: ', error);
      return false;
  }
}
};

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  clips: BeatClip[];
  tracks: Track[];
  storyArc?: StoryArc;
}

export default function ExportDialog({ 
  open, 
  onClose, 
  clips, 
  tracks, 
  storyArc 
}: ExportDialogProps) {
  const [options, setOptions] = useState<ResolveExportOptions>(
    DaVinciResolveExportService.getDefaultOptions()
  );
  const [isExporting, setIsExporting] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
        }
          return prev + 10;
      });
    }, 200);

      // Start export
      const result = await DaVinciResolveExportService.exportTimeline(
        clips,
        tracks,
        storyArc,
        options
      );

      // Clear progress interval
      clearInterval(progressInterval);
      setExportProgress(100);

      // Set result
      setExportResult(result);
      setIsExporting(false);
      
  } catch (error) {
      setExportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        exportId: `error_${Date.now()}`,
        metadata: {
          projectName: options.projectName,
          totalClips: clips.length,
          totalDuration:  0,
          exportFormat: options.exportFormat,
          createdAt: new Date().toISOString()
    }
    });
      setIsExporting(false);
  }
};

  const handleDownload = async () => {
    if (exportResult?.exportId) {
      const success = await DaVinciResolveExportService.downloadExport(exportResult.exportId);
      if (success) {
        onClose();
    }
  }
};

  const handleClose = () => {
    if (!isExporting) {
      setExportResult(null);
      setExportProgress(0);
      onClose();
  }
};

  const totalDuration = Math.max(...clips.map(c => c.start + c.duration));
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  return (
    <Dialog 
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'background.paper',}
    }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Movie />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Export to DaVinci Resolve
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p:  3 }}>
        {!exportResult ? (
          <Stack spacing={3}>
            {/* Project Info */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <VideoFile fontSize="small" />
                  Project Information
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2}>
                    <Chip label={`${clips.length} clips`} size="small" />
                    <Chip label={`${tracks.length} tracks`} size="small" />
                    <Chip label={formatDuration(totalDuration)} size="small" color="primary" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Story Arc: {storyArc.title} ({storyArc.type})
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {/* Export Settings */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <Settings fontSize="small" />
                Export Settings
              </Typography>
              
              <Stack spacing={2}>
                <TextField
                  label="Project Name"
                  value={options.projectName}
                  onChange={(e) => setOptions(prev => ({ ...prev, projectName: e.target.value }))}
                  fullWidth
                  size="small"
                />

                <Stack direction="row" spacing={2}>
                  <FormControl size="small" sx={{ minWidth: 120}}>
                    <InputLabel>Frame Rate</InputLabel>
                    <Select
                      value={options.frameRate}
                      onChange={(e) => setOptions(prev => ({ ...prev, frameRate: e.target.value as number }))}
                      label="Frame Rate"
                    >
                      <MenuItem value={23.976}>23.976 fps</MenuItem>
                      <MenuItem value={24}>24 fps</MenuItem>
                      <MenuItem value={25}>25 fps (PAL)</MenuItem>
                      <MenuItem value={29.97}>29.97 fps</MenuItem>
                      <MenuItem value={30}>30 fps</MenuItem>
                      <MenuItem value={50}>50 fps</MenuItem>
                      <MenuItem value={59.94}>59.94 fps</MenuItem>
                      <MenuItem value={60}>60 fps</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 140}}>
                    <InputLabel>Resolution</InputLabel>
                    <Select
                      value={options.resolution}
                      onChange={(e) => setOptions(prev => ({ ...prev, resolution: e.target.value as any }))}
                      label="Resolution"
                      startAdornment={<AspectRatio fontSize="small" sx={{ mr:  1 }} />}
                    >
                      <MenuItem value="1920x1080">1920x1080 (HD)</MenuItem>
                      <MenuItem value="2560x1440">2560x1440 (QHD)</MenuItem>
                      <MenuItem value="3840x2160">3840x2160 (4K)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120}}>
                    <InputLabel>Color Space</InputLabel>
                    <Select
                      value={options.colorSpace}
                      onChange={(e) => setOptions(prev => ({ ...prev, colorSpace: e.target.value as any }))}
                      label="Color Space"
                      startAdornment={<Palette fontSize="small" sx={{ mr:  1 }} />}
                    >
                      <MenuItem value="Rec709">Rec.709</MenuItem>
                      <MenuItem value="Rec2020">Rec.2020</MenuItem>
                      <MenuItem value="DCI-P3">DCI-P3</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction="row" spacing={2}>
                  <FormControl size="small" sx={{ minWidth: 120}}>
                    <InputLabel>Export Format</InputLabel>
                    <Select
                      value={options.exportFormat}
                      onChange={(e) => setOptions(prev => ({ ...prev, exportFormat: e.target.value as any }))}
                      label="Export Format"
                    >
                      <MenuItem value="XML">Final Cut Pro XML</MenuItem>
                      <MenuItem value="AAF">Avid AAF</MenuItem>
                      <MenuItem value="EDL">Edit Decision List</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Divider />

                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Additional Options
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={options.includeAudio}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeAudio: e.target.checked }))}
                        size="small"
                      />
                  }
                    label={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <AudioFile fontSize="small" />
                        <Typography variant="body2">Include Audio Tracks</Typography>
                      </Stack>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={options.includeColorGrading}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeColorGrading: e.target.checked }))}
                        size="small"
                      />
                  }
                    label={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Palette fontSize="small" />
                        <Typography variant="body2">Include Color Grading</Typography>
                      </Stack>
                  }
                  />
                </Stack>
              </Stack>
            </Box>
          </Stack>
        ) : (
          /* Export Result */
          <Stack spacing={3}>
            {exportResult.success ? (
              <Alert severity="success">
                <Typography variant="body2" fontWeight={500}>
                  Export completed successfully!
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt:  1 }}>
                  Project: {exportResult.metadata.projectName}
                  <br />
                  Format: {exportResult.metadata.exportFormat}
                  <br />
                  Clips: {exportResult.metadata.totalClips}
                  <br />
                  Duration: {formatDuration(exportResult.metadata.totalDuration)}
                </Typography>
              </Alert>
            ) : (
              <Alert severity="error">
                <Typography variant="body2" fontWeight={500}>
                  Export failed
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt:  1 }}>
                  {exportResult.error}
                </Typography>
              </Alert>
            )}
          </Stack>
        )}

        {/* Progress Bar */}
        {isExporting && (
          <Box sx={{ mt:  3 }}>
            <Stack spacing={1}>
              <Typography variant="body2">
                Exporting timeline to DaVinci Resolve...
              </Typography>
              <LinearProgress 
                variant={exportProgress > 0 ? "determinate" : "indeterminate"}
                value={exportProgress}
              />
              {exportProgress > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {Math.round(exportProgress)}% complete
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p:  3 }}>
        <Button 
          onClick={handleClose}
          disabled={isExporting}
        >
          {exportResult ? 'Close' : 'Cancel'}
        </Button>
        
        {exportResult?.success ? (
          <Button
            variant="contained"
            startIcon={theming.getThemedIcon('download')}
            onClick={handleDownload}
            sx={theming.getThemedButtonSx()}
          >
            Download XML
          </Button>
        ) : !isExporting && (
          <Button
            variant="contained"
            onClick={handleExport}
            startIcon={<Movie />}
          >
            Export Timeline
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}