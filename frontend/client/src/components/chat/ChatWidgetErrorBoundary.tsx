import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { logChatWidgetEvent } from './chat-widget-logger';

interface ChatWidgetErrorBoundaryProps {
  children: React.ReactNode;
  widgetName: string;
}

interface ChatWidgetErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ChatWidgetErrorBoundary extends React.Component<
  ChatWidgetErrorBoundaryProps,
  ChatWidgetErrorBoundaryState
> {
  state: ChatWidgetErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ChatWidgetErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unknown rendering error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logChatWidgetEvent(this.props.widgetName, 'error', 'Render failure in chat widget', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 1.5 }}>
          Det oppstod en feil i chat-modulen.
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {this.state.errorMessage}
        </Typography>
        <Button variant="outlined" onClick={this.handleReset}>
          Prøv igjen
        </Button>
      </Box>
    );
  }
}

