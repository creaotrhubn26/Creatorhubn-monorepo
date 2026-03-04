/**
 * CreatorHub Norge - Integration Error Boundary
 * Robust error handling for integration components
 */

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import {
  Box,
  Alert,
  Button,
  Typography,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';

interface MonitoringPayload {
  error: string;
  stack?: string;
  componentStack?: string;
  section: string;
  errorId: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

interface MonitoringClient {
  logError: (payload: MonitoringPayload) => void;
}

declare global {
  interface Window {
    monitoring?: MonitoringClient;
  }
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

const SUPPORT_PANEL_SX = {
  bgcolor: 'grey.100',
  p: 1,
  borderRadius: 1,
  overflow: 'auto',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
};

function createErrorId(): string {
  return `error-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default class IntegrationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: createErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    console.error('Integration Error Boundary caught an error:', error, errorInfo);

    if (typeof window !== 'undefined' && window.monitoring) {
      window.monitoring.logError({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack ?? undefined,
        section: this.props.section ?? 'integration-panel',
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    }

    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                color="inherit"
                size="small"
                onClick={this.handleRetry}
                startIcon={<RefreshIcon />}
              >
                Prøv igjen
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={this.handleReload}
                variant="outlined"
              >
                Last siden på nytt
              </Button>
            </Box>
          }
        >
          <Typography variant="h6" gutterBottom>
            Noe gikk galt med integrasjonspanelet
          </Typography>
          <Typography variant="body2">
            {this.props.section
              ? `En feil oppstod i ${this.props.section}-seksjonen. `
              : 'En uventet feil oppstod. '}
            Prøv å laste siden på nytt, eller kontakt support hvis problemet vedvarer.
          </Typography>
        </Alert>

        <Card sx={{ mt: 2 }} variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BugIcon color="error" />
              <Typography variant="h6">Feildetaljer</Typography>
              <Chip label={`ID: ${this.state.errorId}`} size="small" variant="outlined" />
            </Box>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography variant="subtitle2">
                  Tekniske detaljer (for utviklere)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Feilmelding:
                  </Typography>
                  <Typography variant="body2" component="pre" sx={SUPPORT_PANEL_SX}>
                    {this.state.error?.message ?? 'Ukjent feil'}
                  </Typography>
                </Box>

                {this.state.error?.stack && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Stack trace:
                    </Typography>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ ...SUPPORT_PANEL_SX, maxHeight: 200 }}
                    >
                      {this.state.error.stack}
                    </Typography>
                  </Box>
                )}

                {this.state.errorInfo?.componentStack && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Component stack:
                    </Typography>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ ...SUPPORT_PANEL_SX, maxHeight: 200 }}
                    >
                      {this.state.errorInfo.componentStack}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="caption" color="info.contrastText">
                    <strong>Tips:</strong> Del denne informasjonen med support-teamet for raskere
                    feilsøking. Feil-ID: {this.state.errorId}
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      </Box>
    );
  }
}
