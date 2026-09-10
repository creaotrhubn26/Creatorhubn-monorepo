import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrototypeTesterAdminPanel from './PrototypeTesterAdminPanel';

const apiRequest = vi.fn();
const apiFetch = vi.fn();

vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

vi.mock('@/integration/EnhancedMasterIntegrationProvider', () => ({
  useEnhancedMasterIntegration: () => ({
    auth: { getAuthHeader: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-admin' }) },
  }),
}));

describe('PrototypeTesterAdminPanel', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({
      invites: [
        {
          id: 'invite-1',
          name: 'CreatorHub E2E Tester',
          email: 'tester@example.com',
          memberCompany: 'CREATORHUB AS',
          memberOrganizationNumber: '937518684',
          status: 'accepted',
          inviteRequestId: 'request-1',
          inviteUrl: 'https://creatorhubn.com/prototype-tester/accept-invite?token=redacted',
          createdAt: '2026-09-08T12:00:00.000Z',
          acceptedAt: '2026-09-08T12:05:00.000Z',
          signatureMethod: 'email_otp_typed_name',
          emailVerifiedAt: '2026-09-08T12:04:00.000Z',
          signingReceiptId: '88888888-8888-4888-8888-888888888888',
          emailOpenedAt: '2026-09-08T12:02:00.000Z',
          inviteLinkClickedAt: '2026-09-08T12:03:00.000Z',
          accountProvisioningComplete: true,
          soloProActive: true,
          emailDelivery: { sent: true, provider: 'resend' },
          receiptEmailDelivery: { sent: true, provider: 'resend' },
        },
      ],
    });
  });

  it('shows the complete prototype lifecycle inside the AdminDashboard panel', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PrototypeTesterAdminPanel />
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId('prototype-tester-invite-invite-1');
    expect(screen.getByRole('table', { name: 'Status for prototype-testere' })).toBeInTheDocument();
    expect(within(row).getByText('Søknad')).toBeInTheDocument();
    expect(within(row).getByText(/CREATORHUB AS/)).toHaveTextContent(
      'Org.nr. 937 518 684',
    );
    expect(within(row).getByText('Sendt').closest('[data-state]')).toHaveAttribute('data-state', 'complete');
    expect(within(row).getByText('Åpnet')).toBeInTheDocument();
    expect(within(row).getByText('Klikket')).toBeInTheDocument();
    expect(within(row).getByText('4 avtaler')).toBeInTheDocument();
    expect(within(row).getByText('E-postkode')).toBeInTheDocument();
    expect(within(row).getByText('PDF-kvittering')).toBeInTheDocument();
    expect(within(row).getByText('Kvittering sendt')).toBeInTheDocument();
    expect(within(row).getByText(/E-post verifisert/)).toBeInTheDocument();
    expect(within(row).getByTestId('admin-download-receipt-invite-1')).toBeInTheDocument();
    expect(within(row).getByText('Konto')).toBeInTheDocument();
    expect(within(row).getByText('solo_pro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /inviter ny tester/i }));
    expect((await screen.findAllByRole('heading', { name: /inviter prototype-tester/i })).length).toBeGreaterThan(0);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      '/api/prototype-tester-invites',
      { headers: { Authorization: 'Bearer test-admin' } },
    ));
  });

  it('marks incomplete lifecycle steps as pending without hiding their labels', async () => {
    apiRequest.mockResolvedValueOnce({
      invites: [
        {
          id: 'invite-pending',
          name: 'Pending Tester',
          email: 'pending@example.com',
          status: 'pending',
          inviteUrl: 'https://creatorhubn.com/prototype-tester/accept-invite?token=redacted',
          accountProvisioningComplete: false,
          soloProActive: false,
          emailDelivery: { sent: true, provider: 'resend' },
        },
      ],
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PrototypeTesterAdminPanel />
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId('prototype-tester-invite-invite-pending');
    expect(within(row).getByText('Sendt').closest('[data-state]')).toHaveAttribute('data-state', 'complete');
    expect(within(row).getByText('Klikket').closest('[data-state]')).toHaveAttribute('data-state', 'pending');
    expect(within(row).getByText('E-postkode').closest('[data-state]')).toHaveAttribute('data-state', 'pending');
    expect(within(row).getByText('solo_pro').closest('[data-state]')).toHaveAttribute('data-state', 'pending');
  });
});
