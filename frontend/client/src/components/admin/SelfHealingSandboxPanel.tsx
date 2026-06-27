import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  Grid,
} from '@mui/material';
import {
  AutoFixHigh as AutoFixIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
  Delete as ClearIcon,
  Visibility as ViewIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import type { RecordedCall, WireMockMapping } from '../../utils/selfHealingSandbox';
import { selfHealingSandbox } from '../../utils/selfHealingSandbox';
import { toast } from '../../hooks/use-toast';
import { AdminButton, StatusChip, AdminTableContainer, AdminEmpty } from './design-system';

export const SelfHealingSandboxPanel: React.FC = () => {
  const [autoConvertEnabled, setAutoConvertEnabled] = useState(false);
  const [recordedCalls, setRecordedCalls] = useState<RecordedCall[]>([]);
  const [stats, setStats] = useState({
    totalRecorded: 0,
    byMethod: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    avgResponseTime: 0
  });
  const [selectedCall, setSelectedCall] = useState<RecordedCall | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<WireMockMapping | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setRecordedCalls(selfHealingSandbox.getRecordedCalls());
      setStats(selfHealingSandbox.getStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleAutoConvert = (enabled: boolean) => {
    setAutoConvertEnabled(enabled);
    
    if (enabled) {
      selfHealingSandbox.enableAutoConvert((mapping) => {
        toast({
          title: '🔧 Auto-Mapping Created',
          description: `Created WireMock mapping for ${mapping.request.method} ${mapping.request.urlPath || mapping.request.urlPathPattern}`,
          variant: 'default'
        });
      });
      
      toast({
        title: '✅ Self-Healing Enabled',
        description: 'Missing API calls will be automatically recorded and converted to WireMock mappings',
        variant: 'default'
      });
    } else {
      selfHealingSandbox.disableAutoConvert();
      
      toast({
        title: '⏸️ Self-Healing Disabled',
        description: 'Auto-conversion stopped',
        variant: 'default'
      });
    }
  };

  const handleSaveMapping = async (call: RecordedCall) => {
    const mapping = selfHealingSandbox.convertToWireMockMapping(call);
    const success = await selfHealingSandbox.saveMappingToWireMock(mapping);
    
    if (success) {
      toast({
        title: '✅ Mapping Saved',
        description: `WireMock mapping created for ${call.request.method} ${call.request.url}`,
        variant: 'default'
      });
    } else {
      toast({
        title: '❌ Save Failed',
        description: 'Could not save mapping to WireMock',
        variant: 'destructive'
      });
    }
  };

  const handleExport = () => {
    selfHealingSandbox.exportMappings(`wiremock-mappings-${Date.now()}.json`);
    toast({
      title: '📥 Mappings Exported',
      description: `Exported ${recordedCalls.length} mappings`,
      variant: 'default'
    });
  };

  const handleClear = () => {
    selfHealingSandbox.clearRecordedCalls();
    setRecordedCalls([]);
    setSelectedCall(null);
    setSelectedMapping(null);
  };

  const handleViewMapping = (call: RecordedCall) => {
    const mapping = selfHealingSandbox.convertToWireMockMapping(call);
    setSelectedCall(call);
    setSelectedMapping(mapping);
  };

  const formatTime = (ms: number): string => {
    return `${ms.toFixed(0)} ms`;
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <AutoFixIcon aria-hidden />
            <Typography variant="h6">
              🔧 Self-Healing Sandbox
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={autoConvertEnabled}
                onChange={(e) => handleToggleAutoConvert(e.target.checked)}
                color="primary"
              />
            }
            label="Auto-Convert"
          />
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            When enabled, the sandbox will automatically record live API calls when WireMock stubs are missing
            and convert them to WireMock mappings. This builds your sandbox as you use it!
          </Typography>
        </Alert>

        {/* Statistics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="primary.contrastText">
                {stats.totalRecorded}
              </Typography>
              <Typography variant="caption" color="primary.contrastText">
                Recorded Calls
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="success.contrastText">
                {stats.byStatus['2xx'] || 0}
              </Typography>
              <Typography variant="caption" color="success.contrastText">
                Success (2xx)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="error.contrastText">
                {(stats.byStatus['4xx'] || 0) + (stats.byStatus['5xx'] || 0)}
              </Typography>
              <Typography variant="caption" color="error.contrastText">
                Errors (4xx/5xx)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h5" color="info.contrastText">
                {formatTime(stats.avgResponseTime)}
              </Typography>
              <Typography variant="caption" color="info.contrastText">
                Avg Response
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Actions */}
        <Box display="flex" gap={1} mb={2} sx={{ flexWrap: 'wrap' }}>
          <AdminButton
            tone="secondary"
            startIcon={<ExportIcon />}
            onClick={handleExport}
            disabled={recordedCalls.length === 0}
          >
            Export Mappings
          </AdminButton>
          <AdminButton
            tone="danger"
            startIcon={<ClearIcon />}
            onClick={handleClear}
            disabled={recordedCalls.length === 0}
          >
            Clear
          </AdminButton>
        </Box>

        {/* Recorded Calls Table */}
        {recordedCalls.length === 0 ? (
          <AdminEmpty
            title="No calls recorded yet"
            description={autoConvertEnabled ? 'Make API calls to see them here.' : 'Enable auto-convert to start recording.'}
          />
        ) : (
          <AdminTableContainer ariaLabel="Recorded API calls" sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Response Time</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recordedCalls.map((call) => (
                  <TableRow key={call.id} hover>
                    <TableCell>
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <StatusChip tone="brand" label={call.request.method} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={call.request.url}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {call.request.url}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        label={String(call.response.status)}
                        tone={call.response.status >= 200 && call.response.status < 300 ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatTime(call.responseTime)}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Mapping">
                        <IconButton size="small" aria-label="Vis mapping" onClick={() => handleViewMapping(call)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Save to WireMock">
                        <IconButton size="small" aria-label="Lagre til WireMock" onClick={() => handleSaveMapping(call)} color="success">
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableContainer>
        )}

        {/* Mapping Preview */}
        {selectedMapping && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Generated WireMock Mapping:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: 'grey.900',
                color: 'grey.100',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 300,
                fontSize: '0.875rem'
              }}
            >
              {JSON.stringify(selectedMapping, null, 2)}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

