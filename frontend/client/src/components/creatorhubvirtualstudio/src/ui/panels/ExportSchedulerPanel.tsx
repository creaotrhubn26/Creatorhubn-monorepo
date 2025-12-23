/**
 * ExportSchedulerPanel - UI for managing export queue and scheduling
 * 
 * Features:
 * - Queue visualization
 * - Scheduled exports
 * - Batch export wizard
 * - Progress monitoring
 * - History view
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Stack,
  Divider,
  Badge,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActionArea,
} from '@mui/material';
import {
  Queue,
  Schedule,
  PlayArrow,
  Pause,
  Cancel,
  Delete,
  History,
  Add,
  CloudUpload,
  Check,
  Error,
  Warning,
  MoreVert,
  DragIndicator,
  Refresh,
  Download,
  FolderOpen,
  Timer,
  Speed,
  HighQuality,
  VideoFile,
  Layers,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import {
  exportScheduler,
  ExportJob,
  ExportJobPriority,
  ExportJobStatus,
  SchedulerState,
  BatchExportConfig,
} from '../../core/animation/ExportScheduler';
import { EXPORT_PRESETS, ExportPreset } from '../../core/animation/GoogleDriveExportService';
import { videoExportService } from '../../core/animation/VideoExportService';

// ============================================================================
// Types
// ============================================================================

interface ExportSchedulerPanelProps {
  duration: number;
  userId?: string;
  projectId?: string;
  projectName?: string;
  onFrameRender?: (time: number, frameIndex: number) => void;
}

type TabValue = 'queue' | 'schedule' | 'batch' | 'history';

// ============================================================================
// Status Colors and Icons
// ============================================================================

const STATUS_CONFIG: Record<ExportJobStatus, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: '#9e9e9e', icon: <Timer />, label: 'Pending' },
  scheduled: { color: '#2196f3', icon: <Schedule />, label: 'Scheduled' },
  queued: { color: '#ff9800', icon: <Queue />, label: 'Queued' },
  exporting: { color: '#4caf50', icon: <VideoFile />, label: 'Exporting' },
  uploading: { color: '#9c27b0', icon: <CloudUpload />, label: 'Uploading' },
  complete: { color: '#4caf50', icon: <Check />, label: 'Complete' },
  failed: { color: '#f44336', icon: <Error />, label: 'Failed' },
  cancelled: { color: '#9e9e9e', icon: <Cancel />, label: 'Cancelled' },
};

const PRIORITY_CONFIG: Record<ExportJobPriority, { color: 'default' | 'primary' | 'secondary' | 'error';, label: string }> = {
  low: { color: 'default', label: 'Low' },
  normal: { color: 'primary', label: 'Normal' },
  high: { color: 'secondary', label: 'High' },
  urgent: { color: 'error', label: 'Urgent' },
};

// ============================================================================
// Job Card Component
// ============================================================================

interface JobCardProps {
  job: ExportJob;
  onCancel: () => void;
  onChangePriority: (priority: ExportJobPriority) => void;
  onDownload?: () => void;
}

function JobCard({ job, onCancel, onChangePriority, onDownload }: JobCardProps) {
  const statusConfig = STATUS_CONFIG[job.status];
  const priorityConfig = PRIORITY_CONFIG[job.priority];

  const progress = job.status === 'exporting'
    ? job.exportProgress?.percentage || 0
    : job.status === 'uploading'
      ? job.uploadProgress?.percentage || 0
      : job.status === 'complete'
        ? 100
        : 0;

  const estimatedWait = exportScheduler.getEstimatedWaitTime(job.id);

  return (
    <Paper
      sx={{
        p: 2,
        mb: 1,
        backgroundColor: '#1a1a2a',
        borderLeft: `4px solid ${statusConfig.color}`}}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        {/* Status Icon */}
        <Box sx={{ color: statusConfig.color, mt: 0.5 }}>
          {statusConfig.icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {job.name}
            </Typography>
            <Chip
              size="small"
              label={priorityConfig.label}
              color={priorityConfig.color}
              sx={{ height: 20 }}
            />
            {job.preset && (
              <Chip
                size="small"
                label={job.preset.platform}
                variant="outlined"
                sx={{ height: 20 }}
              />
            )}
          </Box>

          {/* Details */}
          <Typography variant="caption" color="text.secondary" display="block">
            {job.config.width}×{job.config.height} • {job.config.fps}fps • {videoExportService.formatDuration(job.config.duration)}
          </Typography>

          {/* Scheduled time */}
          {job.status === 'scheduled' && job.scheduledTime && (
            <Typography variant="caption" color="info.main" display="block">
              Scheduled: {job.scheduledTime.toLocaleString()}
            </Typography>
          )}

          {/* Wait time */}
          {job.status === 'queued' && estimatedWait > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Est. wait: {exportScheduler.formatWaitTime(estimatedWait)}
            </Typography>
          )}

          {/* Progress */}
          {(job.status === 'exporting' || job.status === 'uploading') && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {job.status === 'exporting' && job.exportProgress
                    ? `Frame ${job.exportProgress.currentFrame}/${job.exportProgress.totalFrames}`
                    : job.status === 'uploading' && job.uploadProgress
                      ? `${videoExportService.formatFileSize(job.uploadProgress.bytesUploaded)} / ${videoExportService.formatFileSize(job.uploadProgress.totalBytes)}`
                      : ''
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {progress.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          )}

          {/* Error */}
          {job.status === 'failed' && job.error && (
            <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
              Error: {job.error}
            </Typography>
          )}

          {/* Drive result */}
          {job.driveResult && (
            <Chip
              size="small"
              icon={<CloudUpload />}
              label="Uploaded to Drive"
              color="success"
              sx={{ mt: 1, height: 20 }}
              onClick={() => window.open(job.driveResult!.webViewLink , '_blank')}
            />
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(job.status === 'queued' || job.status === 'scheduled') && (
            <>
              <Tooltip title="Increase Priority">
                <IconButton
                  size="small"
                  onClick={() => {
                    const priorities: ExportJobPriority[] = ['low','normal','high','urgent'];
                    const currentIndex = priorities.indexOf(job.priority);
                    if (currentIndex < priorities.length - 1) {
                      onChangePriority(priorities[currentIndex + 1]);
                    }
                  }}
                  disabled={job.priority === 'urgent'}
                >
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton size="small" onClick={onCancel} color="error">
                  <Cancel fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {job.status === 'exporting' && (
            <Tooltip title="Cancel">
              <IconButton size="small" onClick={onCancel} color="error">
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {job.status === 'complete' && job.result?.url && (
            <Tooltip title="Download">
              <IconButton size="small" onClick={onDownload} color="primary">
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function ExportSchedulerPanel({
  duration,
  userId,
  projectId,
  projectName,
  onFrameRender,
}: ExportSchedulerPanelProps) {
  // State
  const [activeTab, setActiveTab] = useState<TabValue>('queue');
  const [schedulerState, setSchedulerState] = useState<SchedulerState>(exportScheduler.getState());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // Add job form state
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [jobName, setJobName] = useState('');
  const [priority, setPriority] = useState<ExportJobPriority>('normal');
  const [scheduleType, setScheduleType] = useState<'now' | 'delay' | 'time'>('now');
  const [delayMinutes, setDelayMinutes] = useState(5);
  const [scheduledTime, setScheduledTime] = useState('');
  const [uploadToDrive, setUploadToDrive] = useState(false);

  // Batch export state
  const [batchName, setBatchName] = useState('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [batchUploadToDrive, setBatchUploadToDrive] = useState(false);

  // Subscribe to scheduler state
  useEffect(() => {
    const unsubscribe = exportScheduler.subscribe(setSchedulerState);
    return unsubscribe;
  }, []);

  // Set frame render callback
  useEffect(() => {
    if (onFrameRender) {
      exportScheduler.setFrameRenderCallback(onFrameRender);
    }
  }, [onFrameRender]);

  // Handlers
  const handleAddJob = useCallback(() => {
    if (!selectedPreset) return;

    const job = exportScheduler.createJobFromPreset(selectedPreset, duration, {
      name: jobName || undefined,
      priority,
      uploadToDrive,
      driveConfig: uploadToDrive && userId ? { userId, projectId, projectName } : undefined,
    });

    if (!job) return;

    if (scheduleType === 'now') {
      exportScheduler.addToQueue(job);
    } else if (scheduleType === 'delay') {
      exportScheduler.scheduleJobWithDelay(job, delayMinutes * 60);
    } else if (scheduleType === 'time' && scheduledTime) {
      exportScheduler.scheduleJob(job, new Date(scheduledTime));
    }

    // Reset form
    setAddDialogOpen(false);
    setSelectedPreset(', ');
    setJobName(', ');
    setPriority('normal');
    setScheduleType('now');
    setDelayMinutes(5);
    setScheduledTime(', ');
    setUploadToDrive(false);
  }, [selectedPreset, duration, jobName, priority, uploadToDrive, userId, projectId, projectName, scheduleType, delayMinutes, scheduledTime]);

  const handleBatchExport = useCallback(() => {
    if (selectedPresets.length === 0) return;

    const batchConfig: BatchExportConfig = {
      name: batchName || 'Batch Export',
      presets: selectedPresets,
      uploadToDrive: batchUploadToDrive,
      driveConfig: batchUploadToDrive && userId ? { userId, projectId, projectName } : undefined,
    };

    exportScheduler.createBatchExport(duration, batchConfig);

    // Reset form
    setBatchDialogOpen(false);
    setBatchName(', ');
    setSelectedPresets([]);
    setBatchUploadToDrive(false);
  }, [selectedPresets, batchName, batchUploadToDrive, userId, projectId, projectName, duration]);

  const handleCancelJob = useCallback((jobId: string) => {
    exportScheduler.cancelJob(jobId);
  }, []);

  const handleChangePriority = useCallback((jobId: string, priority: ExportJobPriority) => {
    exportScheduler.reorderJob(jobId, priority);
  }, []);

  const handleDownload = useCallback((job: ExportJob) => {
    if (job.result?.url && job.result?.filename) {
      const a = document.createElement('a');
      a.href = job.result.url;
      a.download = job.result.filename;
      a.click();
    }
  }, []);

  // Group presets by platform for batch selection
  const presetsByPlatform = EXPORT_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.platform]) acc[preset.platform] = [];
    acc[preset.platform].push(preset);
    return acc;
  }, {} as Record<string, ExportPreset[]>);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Queue />
          Export Scheduler
          <Badge badgeContent={schedulerState.queue.length} color="primary" sx={{ ml: 1 }} />
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Layers />}
            onClick={() => setBatchDialogOpen(true)}
          >
            Batch
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Export
          </Button>
        </Stack>
      </Box>

      {/* Stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip
          icon={<Queue />}
          label={`Queue: ${schedulerState.queue.filter((j) => j.status === 'queued').length}`}
          variant="outlined"
        />
        <Chip
          icon={<Schedule />}
          label={`Scheduled: ${schedulerState.queue.filter((j) => j.status === 'scheduled').length}`}
          variant="outlined"
        />
        <Chip
          icon={<Check />}
          label={`Completed: ${schedulerState.totalExported}`}
          color="success"
          variant="outlined"
        />
        {schedulerState.totalFailed > 0 && (
          <Chip
            icon={<Error />}
            label={`Failed: ${schedulerState.totalFailed}`}
            color="error"
            variant="outlined"
          />
        )}
      </Stack>

      {/* Currently Processing */}
      {schedulerState.currentJob && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow color="success" />
            Currently Processing
          </Typography>
          <JobCard
            job={schedulerState.currentJob}
            onCancel={() => handleCancelJob(schedulerState.currentJob!.id)}
            onChangePriority={() => {}}
          />
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2 }}
      >
        <Tab value="queue" icon={<Queue />} iconPosition="start" label="Queue" />
        <Tab value="schedule" icon={<Schedule />} iconPosition="start" label="Scheduled" />
        <Tab value="history" icon={<History />} iconPosition="start" label="History" />
      </Tabs>

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <Box>
          {schedulerState.queue.filter((j) => j.status === 'queued').length === 0 ? (
            <Alert severity="info">
              No exports in queue. Click "Add Export" to get started.
            </Alert>
          ) : (
            schedulerState.queue
              .filter((j) => j.status === 'queued')
              .map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={() => handleCancelJob(job.id)}
                  onChangePriority={(p) => handleChangePriority(job.id, p)}
                />
              ))
          )}
          {schedulerState.queue.filter((j) => j.status === 'queued').length > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => exportScheduler.clearQueue()}
              sx={{ mt: 1 }}
            >
              Clear Queue
            </Button>
          )}
        </Box>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'schedule' && (
        <Box>
          {schedulerState.queue.filter((j) => j.status === 'scheduled').length === 0 ? (
            <Alert severity="info">
              No scheduled exports. Add an export with a scheduled time.
            </Alert>
          ) : (
            schedulerState.queue
              .filter((j) => j.status === 'scheduled')
              .map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={() => handleCancelJob(job.id)}
                  onChangePriority={(p) => handleChangePriority(job.id, p)}
                />
              ))
          )}
        </Box>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Box>
          {schedulerState.history.length === 0 ? (
            <Alert severity="info">
              No export history yet.
            </Alert>
          ) : (
            <>
              {schedulerState.history.slice(0, 20).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={() => {}}
                  onChangePriority={() => {}}
                  onDownload={() => handleDownload(job)}
                />
              ))}
              {schedulerState.history.length > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => exportScheduler.clearHistory()}
                  sx={{ mt: 1 }}
                >
                  Clear History
                </Button>
              )}
            </>
          )}
        </Box>
      )}

      {/* Add Export Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Export to Queue</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Preset Selection */}
            <FormControl fullWidth size="small">
              <InputLabel>Export Preset</InputLabel>
              <Select
                value={selectedPreset}
                label="Export Preset"
                onChange={(e) => setSelectedPreset(e.target.value)}
              >
                {EXPORT_PRESETS.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>{preset.icon}</Typography>
                      <Box>
                        <Typography variant="body2">{preset.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {preset.config.width}×{preset.config.height} • {preset.config.fps}fps
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Job Name */}
            <TextField
              label="Export Name (optional)"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              size="small"
              fullWidth
            />

            {/* Priority */}
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as ExportJobPriority)}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>

            {/* Scheduling */}
            <FormControl fullWidth size="small">
              <InputLabel>When</InputLabel>
              <Select
                value={scheduleType}
                label="When"
                onChange={(e) => setScheduleType(e.target.value as 'now' | 'delay' | 'time')}
              >
                <MenuItem value="now">Add to Queue Now</MenuItem>
                <MenuItem value="delay">Delay Start</MenuItem>
                <MenuItem value="time">Schedule Time</MenuItem>
              </Select>
            </FormControl>

            {scheduleType === 'delay' && (
              <TextField
                label="Delay (minutes)"
                type="number"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 5)}
                size="small"
                fullWidth
              />
            )}

            {scheduleType === 'time' && (
              <TextField
                label="Scheduled Time"
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            )}

            {/* Google Drive */}
            {userId && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={uploadToDrive}
                    onChange={(e) => setUploadToDrive(e.target.checked)}
                  />
                }
                label="Upload to Google Drive after export"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddJob}
            disabled={!selectedPreset}
          >
            Add to Queue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Export Dialog */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Batch Export</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Export to multiple platforms at once. All exports will be queued.
            </Alert>

            {/* Batch Name */}
            <TextField
              label="Batch Name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              size="small"
              fullWidth
            />

            {/* Preset Selection by Platform */}
            <Typography variant="subtitle2">Select Presets</Typography>
            <Grid container spacing={1}>
              {Object.entries(presetsByPlatform).map(([platform, presets]) => (
                <Grid item xs={12} key={platform}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    {platform}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {presets.map((preset) => (
                      <Chip
                        key={preset.id}
                        label={`${preset.icon} ${preset.name}`}
                        onClick={() => {
                          if (selectedPresets.includes(preset.id)) {
                            setSelectedPresets(selectedPresets.filter((p) => p !== preset.id));
                          } else {
                            setSelectedPresets([...selectedPresets, preset.id]);
                          }
                        }}
                        color={selectedPresets.includes(preset.id) ? 'primary' : 'default'}
                        variant={selectedPresets.includes(preset.id) ? 'filled' : 'outlined'}
                        sx={{ mb: 0.5 }}
                      />
                    ))}
                  </Stack>
                </Grid>
              ))}
            </Grid>

            {/* Quick Select */}
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSelectedPresets(EXPORT_PRESETS.map((p) => p.id))}
              >
                Select All
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSelectedPresets([])}
              >
                Clear
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSelectedPresets(['youtube_1080p','instagram_reels','tiktok'])}
              >
                Popular
              </Button>
            </Stack>

            {/* Google Drive */}
            {userId && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={batchUploadToDrive}
                    onChange={(e) => setBatchUploadToDrive(e.target.checked)}
                  />
                }
                label="Upload all exports to Google Drive"
              />
            )}

            {/* Summary */}
            {selectedPresets.length > 0 && (
              <Alert severity="success">
                {selectedPresets.length} export{selectedPresets.length > 1 ? 's' : ','} will be queued
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBatchExport}
            disabled={selectedPresets.length === 0}
          >
            Queue {selectedPresets.length} Export{selectedPresets.length !== 1 ? 's' :','}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ExportSchedulerPanel;

