import React, { useState } from 'react';
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
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Button,
  Grid
} from '@mui/material';
import {
  Visibility as ViewIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Delete as DeleteIcon,
  FileDownload as ExportIcon
} from '@mui/icons-material';
import { WireMockTestResult } from './WireMockResponseViewer';

interface WireMockTestHistoryTableProps {
  history: WireMockTestResult[];
  onViewResult: (result: WireMockTestResult) => void;
  onClearHistory: () => void;
  onExportHistory: () => void;
  getSuccessRate: () => number;
  getAverageResponseTime: () => number;
}

export const WireMockTestHistoryTable: React.FC<WireMockTestHistoryTableProps> = ({
  history,
  onViewResult,
  onClearHistory,
  onExportHistory,
  getSuccessRate,
  getAverageResponseTime
}) => {
  const [filterApi, setFilterApi] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Get unique API names
  const uniqueApis = Array.from(new Set(history.map(r => r.apiName))).sort();

  // Filter history
  const filteredHistory = history.filter(result => {
    if (filterApi !== 'all' && result.apiName !== filterApi) return false;
    if (filterStatus !== 'all' && result.status !== filterStatus) return false;
    return true;
  });

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (result: WireMockTestResult) => {
    if (result.status === 'success') {
      if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
        return 'success';
      }
      return 'warning';
    }
    return 'error';
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            🧪 WireMock Test History
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={onExportHistory}
              disabled={history.length === 0}
            >
              Export
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onClearHistory}
              disabled={history.length === 0}
            >
              Clear
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="primary.contrastText">
                {history.length}
              </Typography>
              <Typography variant="body2" color="primary.contrastText">
                Total Tests
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="success.contrastText">
                {getSuccessRate()}%
              </Typography>
              <Typography variant="body2" color="success.contrastText">
                Success Rate
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="info.contrastText">
                {getAverageResponseTime()}ms
              </Typography>
              <Typography variant="body2" color="info.contrastText">
                Avg Response Time
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Filters */}
        <Box display="flex" gap={2} mb={2}>
          <TextField
            select
            size="small"
            label="Filter by API"
            value={filterApi}
            onChange={(e) => setFilterApi(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All APIs</MenuItem>
            {uniqueApis.map(api => (
              <MenuItem key={api} value={api}>{api}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="success">Success</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </TextField>
        </Box>

        {/* Table */}
        {filteredHistory.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>No test results yet. Run a WireMock test to see results here.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>API</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Response Time</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.map((result) => (
                  <TableRow key={result.id} hover>
                    <TableCell>{formatTime(result.timestamp)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {result.apiName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={result.method} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={result.status === 'success' ? <SuccessIcon /> : <ErrorIcon />}
                        label={result.statusCode || result.status}
                        size="small"
                        color={getStatusColor(result)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {result.responseTime ? `${result.responseTime}ms` :'-'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => onViewResult(result)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

