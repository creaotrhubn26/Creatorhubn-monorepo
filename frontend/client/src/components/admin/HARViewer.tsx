import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Grid,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  Delete as ClearIcon,
  Visibility as ViewIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { harRecorder, HAREntry } from '../../utils/harRecorder';

interface HARViewerProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const HARViewer: React.FC<HARViewerProps> = ({
  autoRefresh = true,
  refreshInterval = 2000
}) => {
  const [entries, setEntries] = useState<HAREntry[]>([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    totalTime: 0,
    totalSize: 0,
    avgTime: 0,
    successCount: 0,
    errorCount: 0
  });
  const [selectedEntry, setSelectedEntry] = useState<HAREntry | null>(null);

  useEffect(() => {
    const updateData = () => {
      setEntries(harRecorder.getEntries());
      setStats(harRecorder.getStats());
    };

    updateData();

    if (autoRefresh) {
      const interval = setInterval(updateData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const handleExport = () => {
    harRecorder.exportHAR(`wiremock-traffic-${Date.now()}.har`);
  };

  const handleClear = () => {
    harRecorder.clear();
    setEntries([]);
    setSelectedEntry(null);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    return 'error';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'primary';
      case 'POST': return 'success';
      case 'PUT': return 'warning';
      case 'DELETE': return 'error';
      default: return 'default';
    }
  };

  // Calculate waterfall visualization
  const maxTime = Math.max(...entries.map(e => e.time), 1);

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <TimelineIcon />
            <Typography variant="h6">
              📊 HAR Event Log & Waterfall
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExport}
              disabled={entries.length === 0}
            >
              Export HAR
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={handleClear}
              disabled={entries.length === 0}
            >
              Clear
            </Button>
          </Box>
        </Box>

        {/* Statistics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="primary.contrastText">
                {stats.totalRequests}
              </Typography>
              <Typography variant="caption" color="primary.contrastText">
                Total Requests
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="success.contrastText">
                {stats.successCount}
              </Typography>
              <Typography variant="caption" color="success.contrastText">
                Success
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="info.contrastText">
                {formatTime(stats.avgTime)}
              </Typography>
              <Typography variant="caption" color="info.contrastText">
                Avg Time
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="warning.contrastText">
                {formatSize(stats.totalSize)}
              </Typography>
              <Typography variant="caption" color="warning.contrastText">
                Total Size
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Waterfall Table */}
        {entries.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>No requests recorded yet. Run a WireMock test to see traffic here.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Method</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Time</TableCell>
                  <TableCell align="right">Size</TableCell>
                  <TableCell>Waterfall</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry, index) => {
                  const waterfallWidth = (entry.time / maxTime) * 100;
                  
                  return (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Chip
                          label={entry.request.method}
                          size="small"
                          color={getMethodColor(entry.request.method) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={entry.request.url}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {entry.request.url}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={entry.response.status}
                          size="small"
                          color={getStatusColor(entry.response.status)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatTime(entry.time)}
                      </TableCell>
                      <TableCell align="right">
                        {formatSize(entry.response.content.size)}
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Tooltip title={`${formatTime(entry.time)} - ${entry.request.method} ${entry.request.url}`}>
                          <Box sx={{ width: '100%' }}>
                            <LinearProgress
                              variant="determinate"
                              value={waterfallWidth}
                              sx={{
                                height: 20,
                                borderRadius: 1,
                                bgcolor: 'grey.200','& .MuiLinearProgress-bar': {
                                  bgcolor: entry.response.status >= 200 && entry.response.status < 300
                                    ? 'success.main' : 'error.main'
                                }
                              }}
                            />
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => setSelectedEntry(entry)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

