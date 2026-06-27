import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Tooltip,
  Alert,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { AdminButton } from './design-system';

export interface WireMockTestResult {
  id: string;
  timestamp: Date;
  apiName: string;
  endpoint: string;
  method: string;
  status: 'success' | 'error';
  statusCode?: number;
  responseTime?: number;
  request?: {
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    headers?: Record<string, string>;
    body?: any;
  };
  error?: {
    message: string;
    stack?: string;
    type?: string;
  };
}

interface WireMockResponseViewerProps {
  open: boolean;
  onClose: () => void;
  result: WireMockTestResult | null;
}

export const WireMockResponseViewer: React.FC<WireMockResponseViewerProps> = ({
  open,
  onClose,
  result
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatJSON = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const getStatusColor = () => {
    if (result.status === 'success') {
      if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
        return 'success';
      }
      return 'warning';
    }
    return 'error';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">🧪 WireMock Test Result</Typography>
            <Chip
              icon={result.status === 'success' ? <SuccessIcon /> : <ErrorIcon />}
              label={result.status.toUpperCase()}
              color={getStatusColor()}
              size="small"
            />
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Lukk">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Test Metadata */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Test Details
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2} mt={1}>
            <Chip label={`API: ${result.apiName}`} size="small" />
            <Chip label={`Method: ${result.method}`} size="small" color="primary" />
            {result.statusCode && (
              <Chip label={`Status: ${result.statusCode}`} size="small" color={getStatusColor()} />
            )}
            {result.responseTime && (
              <Chip
                icon={<TimeIcon />}
                label={`${result.responseTime}ms`}
                size="small"
                color="info"
              />
            )}
            <Chip
              label={new Date(result.timestamp).toLocaleString()}
              size="small"
              variant="outlined"
            />
          </Box>
          <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
            {result.endpoint}
          </Typography>
        </Box>

        {/* Error Alert */}
        {result.status === 'error' && result.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {result.error.type || 'Error'}
            </Typography>
            <Typography variant="body2">{result.error.message}</Typography>
          </Alert>
        )}

        {/* Tabs for Request/Response */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Response" />
            <Tab label="Request" />
            {result.error?.stack && <Tab label="Error Stack" />}
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <Box sx={{ mt: 2 }}>
          {/* Response Tab */}
          {tabValue === 0 && (
            <Box>
              {result.response ? (
                <>
                  {/* Response Headers */}
                  {result.response.headers && (
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Response Headers
                        </Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy headers'}>
                          <IconButton
                            size="small"
                            aria-label="Kopier response-headere"
                            onClick={() => handleCopy(formatJSON(result.response?.headers))}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'grey.900',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: 'grey.100',
                          overflow: 'auto',
                          maxHeight: 200
                        }}
                      >
                        <pre style={{ margin: 0 }}>{formatJSON(result.response.headers)}</pre>
                      </Box>
                    </Box>
                  )}

                  {/* Response Body */}
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Response Body
                      </Typography>
                      <Tooltip title={copied ? 'Copied!' : 'Copy response'}>
                        <IconButton
                          size="small"
                          aria-label="Kopier response-body"
                          onClick={() => handleCopy(formatJSON(result.response?.body))}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'grey.900',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        color: 'grey.100',
                        overflow: 'auto',
                        maxHeight: 400
                      }}
                    >
                      <pre style={{ margin: 0 }}>{formatJSON(result.response.body)}</pre>
                    </Box>
                  </Box>
                </>
              ) : (
                <Alert severity="info">No response data available</Alert>
              )}
            </Box>
          )}

          {/* Request Tab */}
          {tabValue === 1 && (
            <Box>
              {result.request ? (
                <>
                  {/* Request Headers */}
                  {result.request.headers && (
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Request Headers
                        </Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy headers'}>
                          <IconButton
                            size="small"
                            aria-label="Kopier request-headere"
                            onClick={() => handleCopy(formatJSON(result.request?.headers))}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'grey.900',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: 'grey.100',
                          overflow: 'auto',
                          maxHeight: 200
                        }}
                      >
                        <pre style={{ margin: 0 }}>{formatJSON(result.request.headers)}</pre>
                      </Box>
                    </Box>
                  )}

                  {/* Request Body */}
                  {result.request.body && (
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Request Body
                        </Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy request'}>
                          <IconButton
                            size="small"
                            aria-label="Kopier request-body"
                            onClick={() => handleCopy(formatJSON(result.request?.body))}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'grey.900',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: 'grey.100',
                          overflow: 'auto',
                          maxHeight: 400
                        }}
                      >
                        <pre style={{ margin: 0 }}>{formatJSON(result.request.body)}</pre>
                      </Box>
                    </Box>
                  )}
                </>
              ) : (
                <Alert severity="info">No request data available</Alert>
              )}
            </Box>
          )}

          {/* Error Stack Tab */}
          {tabValue === 2 && result.error?.stack && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Error Stack Trace
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy stack trace'}>
                  <IconButton
                    size="small"
                    aria-label="Kopier stack trace"
                    onClick={() => handleCopy(result.error?.stack || '')}
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.900',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: 'error.light',
                  overflow: 'auto',
                  maxHeight: 400
                }}
              >
                <pre style={{ margin: 0 }}>{result.error.stack}</pre>
              </Box>
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <AdminButton tone="ghost" onClick={onClose}>
            Close
          </AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<CopyIcon />}
            onClick={() => handleCopy(formatJSON(result))}
          >
            Copy All Data
          </AdminButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};


