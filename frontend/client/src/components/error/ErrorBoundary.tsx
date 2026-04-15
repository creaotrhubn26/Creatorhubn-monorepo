// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Paper,
  Stack,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  ErrorOutline,
  Refresh,
  BugReport,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  profession?: string
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
  };
}

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
  };
}

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
  });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error: ', error, errorInfo);
  }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
  }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendErrorToService(error, errorInfo);
  }
}

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
  });
};

  handleReload = () => {
    window.location.reload();
};

  toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
  }));
};

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
    }

      const { error, errorInfo, showDetails } = this.state;
      const { profession = 'unknown' } = this.props;

      return (
        <Box sx={{ p:  3, maxWidth: 80, mx: 'auto' }}>
          <Paper elevation={3} sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Stack spacing={3}>
              <Alert severity="error" icon={<ErrorOutline />}>
                <AlertTitle>
                  Oops! Noe gikk galt i{', '}
                  {profession === 'photographer'
                    ? 'fotograf'
                    : profession === 'videographer'
                      ? 'videograf'
                      : profession === 'music_producer'
                        ? 'musikkprodusent'
                        : profession === 'vendor'
                          ? 'leverandør'
                          : profession === 'admin'
                            ? 'administrasjon'
                            : 'systemet'}
                </AlertTitle>
                Det oppstod en uventet feil. Dette har blitt logget og vi jobber med å fikse det.
              </Alert>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Hva kan du gjøre?
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button variant="contained" startIcon={theming.getThemedIcon('refresh')} onClick={this.handleRetry} sx={theming.getThemedButtonSx()}>
                    Prøv igjen
                  </Button>
                  <Button variant="outlined" onClick={this.handleReload}>
                    Last siden på nytt
                  </Button>
                </Stack>
              </Box>

              {process.env.NODE_ENV === 'development' && (
                <Box>
                  <Button
                    startIcon={<BugReport />}
                    endIcon={showDetails ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
                    onClick={this.toggleDetails}
                    variant="text"
                    size="small"
                  >
                    {showDetails ? 'Skjul' : 'Vis'} feildetaljer
                  </Button>

                  <Collapse in={showDetails}>
                    <Paper variant="outlined" sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Feilmelding: </Typography>
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          backgroundColor: 'grey.10',
                          p:  1,
                          borderRadius:  1,
                          overflow: 'auto',
                          maxHeight: 20}}
                      >
                        {error?.toString()}
                      </Typography>

                      {errorInfo && (
                        <>
                          <Typography variant="subtitle2" gutterBottom sx={{ mt:  2 }}>
                            Komponent Stack: </Typography>
                          <Typography
                            variant="body2"
                            component="pre"
                            sx={{
                              backgroundColor: 'grey.10',
                              p:  1,
                              borderRadius:  1,
                              overflow: 'auto',
                              maxHeight: 20,
                              fontSize: '0.75rem' }}
                          >
                            {errorInfo.componentStack}
                          </Typography>
                        </>
                      )}
                    </Paper>
                  </Collapse>
                </Box>
              )}
            </Stack>
          </Paper>
        </Box>
      );
  }

    return this.props.children;
}
}

// Hook for functional components to handle errors
export const useErrorHandler = (
): { handleError: (error: Error, errorInfo?: unknown) => void } => {
  const theming = useTheming('photographer');

  const handleError = (error: Error, errorInfo?: unknown) => {
    console.error('Error caught by useErrorHandler: ', error, errorInfo);

    // You can add additional error handling logic here
    // For example, sending to an error reporting service

    if (process.env.NODE_ENV === 'production') {
      // Example: sendErrorToService(error, errorInfo);
      void theming;
    }
  };

  return { handleError };
};

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<>,
  errorBoundaryProps?: Partial<Props>,
) => {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

// Specific error boundaries for different parts of the app
export const DashboardErrorBoundary = (props: Props) => (
  <ErrorBoundary
    {...props}
    profession={props.profession}
    fallback={
      <Box sx={{ p:  3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Dashboard feil
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Det oppstod en feil i dashbordet. Prøv å laste siden på nytt.
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Last på nytt
        </Button>
      </Box>
  }
  />
);

export const ShowcaseErrorBoundary = (props: Props) => (
  <ErrorBoundary
    {...props}
    profession={props.profession}
    fallback={
      <Box sx={{ p:  3, textAlign:'center' }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Showcase feil
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Det oppstod en feil ved lasting av showcase. Prøv igjen senere.
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Prøv igjen
        </Button>
      </Box>
  }
  />
);
