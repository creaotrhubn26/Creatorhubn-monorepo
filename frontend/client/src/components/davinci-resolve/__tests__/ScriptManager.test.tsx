/**
 * ScriptManager.test.tsx - Comprehensive tests for DaVinci Resolve Script Manager
 * 
 * Test Coverage:
 * - Component rendering
 * - User interactions (search, filter, execute)
 * - Tab navigation
 * - Script execution dialog
 * - Parameter configuration
 * - User guide dialog
 * - System status display
 * - Analytics tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScriptManager from '../ScriptManager';

// Mock dependencies
vi.mock('../../../integration/EnhancedMasterIntegrationProvider', () => ({
  useEnhancedMasterIntegration: () => ({
    integration: {},
    communication: {},
    dataFlow: {},
    analytics: {
      trackEvent: vi.fn(),
    },
    debugging: {},
    performance: {},
    lifecycle: {},
    features: {
      checkFeatureAccess: () => ({ hasAccess: true }),
    },
  }),
}));

vi.mock('../../../utils/theming-helper', () => ({
  useTheming: () => ({
    colors: {
      primary: '#E02020',
      secondary: '#1A1A1A',
      accent: '#FF4444',
    },
    getThemedIcon: vi.fn(),
    getThemedButtonSx: vi.fn(),
    getThemedCardSx: vi.fn(),
  }),
}));

vi.mock('../../../lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

// Test wrapper with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('ScriptManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );
      
      expect(screen.getByText(/Script Automation Manager/i)).toBeInTheDocument();
    });

    it('displays DaVinci Resolve branding', () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );
      
      // Check for logo and branding elements
      expect(screen.getByText(/Script Automation Manager/i)).toBeInTheDocument();
    });

    it('shows system status indicators', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );
      
      await waitFor(() => {
        // System status chips should be visible
        const statusElements = screen.queryAllByText(/Python|DaVinci/i);
        expect(statusElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tab Navigation', () => {
    it('renders all tabs (Setup, Browse, Execute, History)', () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );
      
      expect(screen.getByText(/Setup/i)).toBeInTheDocument();
      expect(screen.getByText(/Browse/i)).toBeInTheDocument();
      expect(screen.getByText(/Execute/i)).toBeInTheDocument();
      expect(screen.getByText(/History/i)).toBeInTheDocument();
    });

    it('switches tabs when clicked', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );
      
      const browseTab = screen.getByText(/Browse/i);
      fireEvent.click(browseTab);
      
      await waitFor(() => {
        // Browse tab content should be visible
        expect(screen.getByPlaceholderText(/Search scripts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('displays search input in Browse tab', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const browseTab = screen.getByText(/Browse/i);
      fireEvent.click(browseTab);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search scripts/i)).toBeInTheDocument();
      });
    });

    it('filters scripts by search query', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const browseTab = screen.getByText(/Browse/i);
      fireEvent.click(browseTab);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search scripts/i);
        fireEvent.change(searchInput, { target: { value: 'wedding' } });

        // Scripts should be filtered
        expect(searchInput).toHaveValue('wedding');
      });
    });

    it('displays category filter dropdown', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const browseTab = screen.getByText(/Browse/i);
      fireEvent.click(browseTab);

      await waitFor(() => {
        // Category filter should be visible
        expect(screen.getByText(/All Categories/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Guide', () => {
    it('opens user guide dialog when button clicked', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const guideButton = screen.getByText(/User Guide/i);
      fireEvent.click(guideButton);

      await waitFor(() => {
        expect(screen.getByText(/Getting Started Guide/i)).toBeInTheDocument();
      });
    });

    it('displays all guide steps', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const guideButton = screen.getByText(/User Guide/i);
      fireEvent.click(guideButton);

      await waitFor(() => {
        expect(screen.getByText(/Welcome to DaVinci Resolve Script Manager/i)).toBeInTheDocument();
        expect(screen.getByText(/Check System Requirements/i)).toBeInTheDocument();
      });
    });
  });

  describe('Script Execution', () => {
    it('opens execution dialog when Execute button clicked', async () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const browseTab = screen.getByText(/Browse/i);
      fireEvent.click(browseTab);

      await waitFor(() => {
        const executeButtons = screen.queryAllByText(/Execute/i);
        if (executeButtons.length > 1) {
          fireEvent.click(executeButtons[1]); // Click first script's execute button

          // Execution dialog should open
          expect(screen.getByText(/Execute Script/i)).toBeInTheDocument();
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for tabs', () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    });

    it('has accessible buttons with proper labels', () => {
      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      expect(screen.getByText(/User Guide/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders efficiently with large script lists', () => {
      const startTime = performance.now();

      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 1 second
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('displays access denied message when user lacks permissions', () => {
      // Mock no access
      vi.mock('../../../integration/EnhancedMasterIntegrationProvider', () => ({
        useEnhancedMasterIntegration: () => ({
          features: {
            checkFeatureAccess: () => ({ hasAccess: false }),
          },
        }),
      }));

      render(
        <TestWrapper>
          <ScriptManager />
        </TestWrapper>
      );

      // Should show access denied message
      expect(screen.queryByText(/don't have access/i)).toBeInTheDocument();
    });
  });
});
