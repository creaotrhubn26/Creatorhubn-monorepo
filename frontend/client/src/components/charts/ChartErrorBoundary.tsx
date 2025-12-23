/**
 * Chart Error Boundary
 * Catches errors in chart rendering and displays fallback UI
 */

import React, { Component, ReactNode } from 'react';
import { Alert, Box, Button, Skeleton } from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showSkeleton?: boolean;
  width?: number | string;
  height?: number | string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart rendering error: ', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="error"
            action={
              <Button size="small" startIcon={<Refresh />} onClick={this.handleReset}>
                Prøv igjen
              </Button>
            }
          >
            Kunne ikke laste diagrammet. {this.state.error?.message}
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Loading skeleton for charts
 */
export const ChartSkeleton: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = '100%',
  height = 300,
}) => <Skeleton variant="rectangular" width={width} height={height} sx={{ borderRadius: 2 }} />;

/**
 * Empty state for charts with no data
 */
export const ChartEmptyState: React.FC<{ message?: string }> = ({
  message = 'Ingen data tilgjengelig',
}) => (
  <Box sx={{ p: 4, textAlign: 'center' }}>
    <Alert severity="info">{message}</Alert>
  </Box>
);

/**
 * HOC to wrap charts with error boundary and loading state
 */
export function withChartProtection<P extends object>(
  ChartComponent: React.ComponentType<P>,
  displayName?: string,
) {
  const ProtectedChart: React.FC<P & { isLoading?: boolean; hasData?: boolean }> = ({
    isLoading,
    hasData = true,
    ...props
  }) => {
    if (isLoading) {
      return <ChartSkeleton />;
    }

    if (!hasData) {
      return <ChartEmptyState />;
    }

    return (
      <ChartErrorBoundary>
        <ChartComponent {...(props as P)} />
      </ChartErrorBoundary>
    );
  };

  ProtectedChart.displayName = `withChartProtection(${displayName || ChartComponent.displayName ||'Chart'})`;

  return ProtectedChart;
}

export default ChartErrorBoundary;
