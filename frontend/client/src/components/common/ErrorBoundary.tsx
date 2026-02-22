/**
 * Error Boundary Component with Sentry Integration
 * Catches JavaScript errors anywhere in the child component tree
 * and reports them to Sentry for production error tracking
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Chip,
} from '@mui/material';
import {
  ErrorOutline,
  Refresh,
  ExpandMore,
  ExpandLess,
  BugReport,
  CloudUpload,
} from '@mui/icons-material';
import { captureErrorToSentry, addSentryBreadcrumb } from '../../utils/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  /** Component name for better error tracking */
  componentName?: string;
  /** Additional context to send to Sentry */
  context?: Record<string, any>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  eventId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error: ', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Capture error to Sentry with additional context
    const eventId = captureErrorToSentry(error, {
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName || 'Unknown Component',
      ...this.props.context,
    });

    this.setState({ eventId });

    // Add breadcrumb for error boundary catch
    addSentryBreadcrumb({
      category: 'error-boundary',
      message: `Error caught in ${this.props.componentName || 'ErrorBoundary'}`,
      level: 'error',
      data: {
        errorMessage: error.message,
        errorName: error.name,
      },
    });
  }

  handleReset = () => {
    // Add breadcrumb for error recovery attempt
    addSentryBreadcrumb({
      category: 'error-boundary',
      message: 'User attempted to recover from error',
      level: 'info',
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      eventId: null,
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            p: 3}}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 600,
              width: '100%',
              p: 4}}
          >
            <Stack spacing={3} alignItems="center">
              <ErrorOutline sx={{ fontSize: 64, color: 'error.main' }} />
              
              <Typography variant="h5" fontWeight="bold" textAlign="center">
                Oops! Something went wrong
              </Typography>
              
              <Typography variant="body1" color="text.secondary" textAlign="center">
                We're sorry for the inconvenience. The application encountered an unexpected error.
              </Typography>

              <Alert severity="error" sx={{ width: '100%' }}>
                <AlertTitle>Error Details</AlertTitle>
                {this.state.error?.message || 'Unknown error occurred'}
              </Alert>

              {this.state.eventId && (
                <Chip
                  icon={<CloudUpload />}
                  label={`Error ID: ${this.state.eventId.substring(0, 8)}`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                />
              )}

              {this.props.showDetails && this.state.errorInfo && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={this.toggleDetails}
                    endIcon={this.state.showDetails ? <ExpandLess /> : <ExpandMore />}
                    startIcon={<BugReport />}
                  >
                    {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
                  </Button>

                  <Collapse in={this.state.showDetails} sx={{ width: '100%' }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: 'grey.50',
                        maxHeight: 200,
                        overflow: 'auto'}}
                    >
                      <Typography
                        variant="caption"
                        component="pre"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          whiteSpace: 'pre-wrap',
                          wordBreak:'break-word'}}
                      >
                        {this.state.errorInfo.componentStack}
                      </Typography>
                    </Paper>
                  </Collapse>
                </>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleReset}
                >
                  Try Again
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

