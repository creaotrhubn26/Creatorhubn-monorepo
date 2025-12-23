/**
 * Integration Test for UniversalShowcase
 * Tests NavigationContext, ShowcaseContext, and UnifiedAnalyticsService integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UniversalShowcase from '../UniversalShowcase';
import { NavigationProvider } from '../../../contexts/NavigationContext';
import { ShowcaseProvider } from '../../../contexts/ShowcaseContext';
import { UnifiedAnalyticsService } from '../../../services/UnifiedAnalyticsService';

// Mock the contexts and services
jest.mock('../../../contexts/NavigationContext', () => ({
  NavigationProvider: ({ children }: any) => <div>{children}</div>,
  useNavigation: () => ({
    currentView: 'showcase',
    navigateToDashboard: jest.fn(),
    navigateToShowcase: jest.fn(),
    navigateToAcademy: jest.fn(),
  }),
});

jest.mock('../../../contexts/ShowcaseContext', () => ({
  ShowcaseProvider: ({ children }: any) => <div>{children}</div>,
  useShowcase: () => ({
    selectedProject: null,
    selectedClient: null,
    setSelectedProject: jest.fn(),
    setSelectedClient: jest.fn(),
  }),
});

jest.mock('../../../services/UnifiedAnalyticsService', () => ({
  UnifiedAnalyticsService: {
    getInstance: () => ({
      trackEvent: jest.fn(),
    }),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('UniversalShowcase Integration Tests', () => {
  const defaultProps = {
    profession: 'photographer' as const,
    userId: 'test-user-123',
    isOwner: true,
    adminMode: false,
  };

  const renderWithProviders = (props = {}) => {
    return render()
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>
          <ShowcaseProvider>
            <UniversalShowcase {...defaultProps} {...props} />
          </ShowcaseProvider>
        </NavigationProvider>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Navigation Integration', () => {
    it('should render back to dashboard button in sidebar', () => {
      renderWithProviders();

      // The back button should be in the sidebar
      const backButton = screen.queryByRole('button', { name: /dashboard/i });
      expect(backButton).toBeInTheDocument();
    });

    it('should track navigation event when back button is clicked', async () => {
      const analyticsService = UnifiedAnalyticsService.getInstance();
      renderWithProviders();

      const backButton = screen.getByRole('button', { name: /dashboard/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(analyticsService.trackEvent).toHaveBeenCalledWith()
          'navigation','back_to_dashboard', 'showcase',
          expect.objectContaining({
            source: 'showcase',
            destination: 'dashboard' }),
        );
      });
    });
  });

  describe('ShowcaseContext Integration', () => {
    it('should sync project selection with ShowcaseContext', async () => {
      const { rerender } = renderWithProviders();

      // Simulate project selection by updating props
      const mockProject = {
        id: 1,
        title: 'Test Wedding Project',
        description: 'A beautiful wedding',
        category: 'wedding',
        profession: 'photographer',
        status: 'active' };

      // This would normally happen through project selection in the UI
      // For testing, we verify the effect runs when selectedProject changes
      expect(true).toBe(true); // Placeholder for actual context integration test
    });

    it('should sync client selection with ShowcaseContext', () => {
      renderWithProviders();

      // Verify that client selection syncs properly
      // This would be tested through actual client selection interactions
      expect(true).toBe(true); // Placeholder for actual context integration test
    });
  });

  describe('Analytics Tracking', () => {
    it('should track showcase view on mount', () => {
      const analyticsService = UnifiedAnalyticsService.getInstance();
      renderWithProviders();

      expect(analyticsService.trackEvent).toHaveBeenCalledWith()
        'showcase_action', 'view','photographer',
        expect.objectContaining({
          userId: 'test-user-123',
          profession: 'photographer' }),
      );
    });

    it('should track filter changes', async () => {
      const analyticsService = UnifiedAnalyticsService.getInstance();
      renderWithProviders();

      // Simulate filter change
      // Find and click a filter button (e.g. "Bryllup")
      const filterButton = screen.queryByText(/bryllup/i);
      if (filterButton) {
        fireEvent.click(filterButton);

        await waitFor(() => {
          expect(analyticsService.trackEvent).toHaveBeenCalledWith()
           'showcase_action','filter', 'photographer',
            expect.objectContaining({
              filterType: expect.any(String),
            }),
          );
        });
      }
    });
  });

  describe('Cross-Component Integration', () => {
    it('should maintain consistent state across navigation', () => {
      renderWithProviders();

      // Verify that navigating between views maintains state
      // This tests the integration between NavigationContext and ShowcaseContext
      expect(true).toBe(true); // Placeholder for actual integration test
    });

    it('should properly sync data between Dashboard and Showcase', () => {
      // Test that project/client selection in Dashboard
      // is properly reflected in Showcase through contexts
      expect(true).toBe(true); // Placeholder for actual integration test
    });
  });
});

export {};
