/**
 * PostAgentErrorBoundary — isolates Post Agent UI components so a render
 * crash (bad data shape from backend, undefined access on partial response)
 * doesn't take down the whole Role Room dashboard. Renders a small inline
 * fallback instead.
 */

import React from 'react';
import { Alert, Box, Typography } from '@mui/material';

interface State {
  hasError: boolean;
  message: string;
}

export class PostAgentErrorBoundary extends React.Component<{ children: React.ReactNode; label?: string }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown): void {
    // Best-effort log — visible in browser console for debugging.
    // eslint-disable-next-line no-console
    console.warn('[post-agent] component crashed', this.props.label || '', err);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box sx={{ my: 2 }}>
          <Alert severity="warning" variant="outlined">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {this.props.label || 'Post Agent-komponent'} kunne ikke vises
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Resten av dashboardet fungerer fortsatt. Refresh siden hvis problemet vedvarer.
            </Typography>
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default PostAgentErrorBoundary;
