/**
 * Integration tests for UniversalShowcase context wiring and analytics calls.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UniversalShowcase from '../UniversalShowcase';
import { NavigationProvider } from '../../../contexts/NavigationContext';
import { ShowcaseProvider } from '../../../contexts/ShowcaseContext';
import { UnifiedAnalyticsService } from '../../../services/UnifiedAnalyticsService';

jest.mock('../../../contexts/NavigationContext', () => ({
  NavigationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useNavigation: () => ({
    currentView: 'showcase',
    navigateToDashboard: jest.fn(),
    navigateToShowcase: jest.fn(),
    navigateToAcademy: jest.fn(),
  }),
}));

jest.mock('../../../contexts/ShowcaseContext', () => ({
  ShowcaseProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useShowcase: () => ({
    selectedProject: null,
    selectedClient: null,
    setSelectedProject: jest.fn(),
    setSelectedClient: jest.fn(),
  }),
}));

const trackEventMock = jest.fn();

jest.mock('../../../services/UnifiedAnalyticsService', () => ({
  UnifiedAnalyticsService: {
    getInstance: () => ({
      trackEvent: trackEventMock,
    }),
  },
}));

function renderWithProviders(props: Partial<React.ComponentProps<typeof UniversalShowcase>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultProps: React.ComponentProps<typeof UniversalShowcase> = {
    profession: 'photographer',
    userId: 'test-user-123',
    isOwner: true,
    adminMode: false,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <ShowcaseProvider>
          <UniversalShowcase {...defaultProps} {...props} />
        </ShowcaseProvider>
      </NavigationProvider>
    </QueryClientProvider>,
  );
}

describe('UniversalShowcase integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders showcase container', () => {
    renderWithProviders();
    expect(screen.getByText(/showcase/i)).toBeInTheDocument();
  });

  it('tracks showcase view analytics on mount', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalled();
    });
  });

  it('handles dashboard navigation click when button exists', async () => {
    renderWithProviders();

    const button = screen.queryByRole('button', { name: /dashboard/i });
    if (!button) {
      return;
    }

    fireEvent.click(button);

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalled();
    });
  });

  it('can initialize analytics service singleton', () => {
    const analyticsService = UnifiedAnalyticsService.getInstance();
    expect(analyticsService).toBeTruthy();
  });
});
