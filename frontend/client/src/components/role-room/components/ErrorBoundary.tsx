import React, { ReactNode, ReactElement } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactElement;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Error Boundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback || (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
              gap: 2,
            }}
          >
            <Paper
              sx={{
                p: 3,
                textAlign: 'center',
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                borderColor: '#d32f2f',
                borderWidth: 1,
                borderStyle: 'solid',
                maxWidth: 500,
                width: '100%',
              }}
            >
              <ErrorIcon sx={{ fontSize: 48, color: '#d32f2f', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, color: '#d32f2f' }}>
                Noe gikk galt
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                {this.state.error.message}
              </Typography>
              <Button
                variant="contained"
                onClick={this.handleReset}
                sx={{ backgroundColor: '#d32f2f' }}
              >
                Prøv igjen
              </Button>
            </Paper>
          </Box>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
