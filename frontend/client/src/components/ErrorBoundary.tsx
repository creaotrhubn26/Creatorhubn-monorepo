// Global Error Boundary with user-friendly notifications
import { useTheming } from '../utils/theming-helper';
import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Collapse,
} from '@mui/material';
import { Error as ErrorIcon, Refresh, BugReport } from '@mui/icons-material';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isExpanded: boolean
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    errorInfo: React.ErrorInfo;
    retry: () => void;
}>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
  };
}

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
  };
}

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
  });

    // Log error for monitoring
    console.error('ErrorBoundary caught an error: ', error, errorInfo);
    
    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // In production, you would send this to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
  }
}

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
  });
};

  handleToggleDetails = () => {
    this.setState(prev => ({
      isExpanded: !prev.isExpanded,
  }));
};

  getUserFriendlyMessage = (error: Error): string => {
    const message = error.message.toLowerCase();
    // Theming system
    const theming = useTheming('photographer');
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Nettverksfeil - sjekk internettforbindelsen din og prøv igjen.';
}
    
    if (message.includes('timeout')) {
      return 'Forespørselen tok for lang tid. Prøv igjen senere.';
  }
    
    if (message.includes('permission') || message.includes('auth')) {
      return 'Du har ikke tilgang til denne ressursen. Logg inn på nytt.';
  }
    
    if (message.includes('file') || message.includes('upload')) {
      return 'Feil ved filopplasting. Sjekk filstørrelse og format.';
  }
    
    if (message.includes('memory') || message.includes('size')) {
      return 'Utilstrekkelig minne. Prøv med færre eller mindre filer.';
  }

    return 'En uventet feil oppstod. Prøv igjen eller kontakt support hvis problemet vedvarer.';
};

  getErrorCode = (error: Error): string => {
    // Extract or generate error code for support reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const errorType = error.constructor.name;
    return `${errorType}-${timestamp}`;
};

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      
      if (this.props.fallback && error && errorInfo) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo}
            retry={this.handleRetry}
          />
        );
    }

      const userMessage = error ? this.getUserFriendlyMessage(error) : 'En ukjent feil oppstod';
      const errorCode = error ? this.getErrorCode(error) : 'UNKNOWN';

      return (
        <Box sx={{ p:  3, maxWidth: 60, mx: 'auto', mt:  4 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack spacing={3}>
                <Alert severity="error" icon={<ErrorIcon />}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Oops! Noe gikk galt
                  </Typography>
                  <Typography variant="body2">
                    {userMessage}
                  </Typography>
                </Alert>

                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button variant="contained"
                    startIcon={theming.getThemedIcon('refresh')}
                    onClick={this.handleRetry}
                    color="primary"
                   sx={theming.getThemedButtonSx()}>
                    Prøv igjen
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<BugReport />}
                    onClick={this.handleToggleDetails}
                    color="inherit"
                  >
                    {this.state.isExpanded ? 'Skjul' : 'Vis'} detaljer
                  </Button>
                </Stack>

                <Collapse in={this.state.isExpanded}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Feilkode: {errorCode}
                      </Typography>
                      
                      {error && (
                        <Box sx={{ mt:  2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Tekniske detaljer: </Typography>
                          <Box
                            component="pre"
                            sx={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              backgroundColor: 'grey.10',
                              p:  2,
                              borderRadius:  1,
                              overflow: 'auto',
                              maxHeight: 20}}
                          >
                            {error.stack || error.message}
                          </Box>
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block'}}>
                        Hvis problemet vedvarer, kontakt support med feilkoden over.
                      </Typography>
                    </CardContent>
                  </Card>
                </Collapse>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      );
  }

    return this.props.children;
}
}

// Hook for programmatically triggering error boundary
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    // Re-throw error to trigger error boundary
    throw error;
};
};

export default ErrorBoundary;