/**
 * Contract Sync Status Indicator
 * Shows real-time Google Drive upload status for contracts with retry/cancel options
 */

import React, { useState, useEffect } from 'react';
import type { SyncJob } from '../../services/contract-drive-sync';
import { contractDriveSync } from '../../services/contract-drive-sync';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  IconButton,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error,
  Refresh,
  Close,
  ExpandMore,
  ExpandLess,
  CloudDone,
} from '@mui/icons-material';

interface ContractSyncStatusProps {
  projectId?: string;
  compact?: boolean;
}

export const ContractSyncStatus: React.FC<ContractSyncStatusProps> = ({
  projectId,
  compact = false,
}) => {
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [expanded, setExpanded] = useState(true);

  // Subscribe to sync job updates
  useEffect(() => {
    const unsubscribe = contractDriveSync.subscribe((jobs) => {
      // Filter jobs by projectId if provided
      const filteredJobs = projectId ? jobs.filter((job) => job.projectId === projectId) : jobs;
      setSyncJobs(filteredJobs);
    });

    return unsubscribe;
  }, [projectId]);

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      case 'uploading': return '#2196f3';
      case 'pending': return '#ff9800';
      default: return '#757575';
    }
  };

  const getSyncStatusIcon = (job: SyncJob) => {
    switch (job.status) {
      case 'success': return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'error': return <Error sx={{ color: '#f44336' }} />;
      case 'uploading': return <CloudUpload sx={{ color: '#2196f3' }} />;
      case 'pending': return <CloudUpload sx={{ color: '#ff9800' }} />;
      default: return <CloudUpload sx={{ color: '#757575' }} />;
    }
  };

  const getSyncStatusText = (job: SyncJob) => {
    switch (job.status) {
      case 'success': return 'Uploaded to Drive';
      case 'error': return `Failed: ${job.error}`;
      case 'uploading': return `Uploading... ${job.progress}%`;
      case 'pending': return job.retryCount > 0
          ? `Retrying (${job.retryCount}/${job.maxRetries})...`
          : 'Queued for upload';
      default: return 'Unknown status';
    }
  };

  // Don't render if no jobs
  if (syncJobs.length === 0) {
    return null;
  }

  // Compact view - just a badge/chip
  if (compact) {
    const uploadingCount = syncJobs.filter(
      (j) => j.status === 'uploading' || j.status === 'pending',
    ).length;
    const errorCount = syncJobs.filter((j) => j.status === 'error').length;
    const successCount = syncJobs.filter((j) => j.status === 'success').length;

    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {uploadingCount > 0 && (
          <Chip
            size="small"
            icon={<CloudUpload />}
            label={`${uploadingCount} uploading`}
            color="primary"
            variant="outlined"
          />
        )}
        {errorCount > 0 && (
          <Chip
            size="small"
            icon={<Error />}
            label={`${errorCount} failed`}
            color="error"
            variant="outlined"
          />
        )}
        {successCount > 0 && uploadingCount === 0 && errorCount === 0 && (
          <Chip
            size="small"
            icon={<CloudDone />}
            label={`${successCount} synced`}
            color="success"
            variant="outlined"
          />
        )}
      </Box>
    );
  }

  // Full view - expanded status panel
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2}}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600}}>
            Contract Sync Status
          </Typography>
          <Chip size="small" label={syncJobs.length} color="primary" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => contractDriveSync.clearCompleted()}
            sx={{ textTransform: 'none' }}>
            Clear Completed
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <List sx={{ pt: 0 }}>
          {syncJobs.map((job) => (
            <ListItem
              key={job.id}
              sx={{
                bgcolor: job.status === 'error' ? 'error.lighter' : 'transparent',
                borderRadius: 1,
                mb: 1,
                border: '1px solid',
                borderColor: getSyncStatusColor(job.status) + '30'}}
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {job.status === 'error' && (
                    <Tooltip title="Retry upload">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => contractDriveSync.retryJob(job.id)}
                        sx={{ color: 'primary.main' }}>
                        <Refresh />
                      </IconButton>
                    </Tooltip>
                  )}
                  {job.status !== 'success' && (
                    <Tooltip title="Cancel upload">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => contractDriveSync.cancelJob(job.id)}
                        sx={{ color: 'error.main' }}>
                        <Close />
                      </IconButton>
                    </Tooltip>
                  )}
                  {job.status === 'success' && job.webViewLink && (
                    <Button
                      size="small"
                      variant="outlined"
                      href={job.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                      View in Drive
                    </Button>
                  )}
                </Box>
              }
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{getSyncStatusIcon(job)}</ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 500}}>
                    {job.file.name}
                  </Typography>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {getSyncStatusText(job)}
                    </Typography>
                    {job.status === 'uploading' && (
                      <LinearProgress
                        variant="determinate"
                        value={job.progress}
                        sx={{
                          mt: 0.5
                         , height: 4,
                          borderRadius: 2,
                          bgcolor: 'grey.300' }} />
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>

        {/* Summary */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider' }}>
          <Chip
            size="small"
            icon={<CloudUpload />}
            label={`${syncJobs.filter((j) => j.status === 'uploading' || j.status === 'pending').length} uploading`}
            color="primary"
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<CheckCircle />}
            label={`${syncJobs.filter((j) => j.status === 'success').length} completed`}
            color="success"
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<Error />}
            label={`${syncJobs.filter((j) => j.status ==='error').length} failed`}
            color="error"
            variant="outlined"
          />
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ContractSyncStatus;
