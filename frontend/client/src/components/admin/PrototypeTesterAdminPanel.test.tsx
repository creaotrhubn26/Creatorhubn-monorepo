import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrototypeTesterAdminPanel from './PrototypeTesterAdminPanel';

const apiRequest = vi.fn();
const apiFetch = vi.fn();
const getAuthHeader = vi.fn().mockResolvedValue({ Authorization: 'Bearer test-admin' });

vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

vi.mock('@/integration/EnhancedMasterIntegrationProvider', () => ({
  useEnhancedMasterIntegration: () => ({ auth: { getAuthHeader } }),
}));

const completeInvite = {
  id: 'invite-1',
  name: 'CreatorHub E2E Tester',
  email: 'tester@example.com',
  memberCompany: 'CREATORHUB AS',
  memberOrganizationNumber: '937518684',
  memberProfession: 'music_producer',
  testingAreas: ['CreatorHub-dashboard'],
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
  emailDelivery: { sent: true, provider: 'resend', sentAt: '2026-09-08T12:00:00.000Z' },
  accessEmailDelivery: { sent: true, provider: 'resend', sentAt: '2026-09-08T12:06:00.000Z' },
  receiptEmailDelivery: { sent: true, provider: 'resend', sentAt: '2026-09-08T12:06:00.000Z' },
  lifecycle: [
    { key: 'created', label: 'Invitasjon opprettet', status: 'complete', at: '2026-09-08T12:00:00.000Z' },
    { key: 'invite_email', label: 'Invitasjon sendt', status: 'complete', at: '2026-09-08T12:00:00.000Z' },
    { key: 'opened', label: 'E-post åpnet', status: 'complete', at: '2026-09-08T12:02:00.000Z' },
    { key: 'clicked', label: 'Invitasjonslenke åpnet', status: 'complete', at: '2026-09-08T12:03:00.000Z' },
    { key: 'email_verified', label: 'E-post bekreftet med kode', status: 'complete', at: '2026-09-08T12:04:00.000Z' },
    { key: 'agreements', label: 'Fire avtaler akseptert', status: 'complete', at: '2026-09-08T12:05:00.000Z' },
    { key: 'account', label: 'Konto opprettet', status: 'complete', at: '2026-09-08T12:06:00.000Z' },
    { key: 'solo_pro', label: 'solo_pro aktiv', status: 'complete', at: '2026-09-08T12:06:00.000Z' },
    { key: 'access_email', label: 'Tilgangs-e-post sendt', status: 'complete', at: '2026-09-08T12:06:00.000Z' },
    { key: 'receipt', label: 'PDF-kvittering tilgjengelig', status: 'complete', at: '2026-09-08T12:05:00.000Z' },
    { key: 'receipt_email', label: 'Kvittering sendt', status: 'complete', at: '2026-09-08T12:06:00.000Z' },
  ],
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><PrototypeTesterAdminPanel /></QueryClientProvider>);
}

describe('PrototypeTesterAdminPanel', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    getAuthHeader.mockClear();
    apiRequest.mockResolvedValue({ invites: [completeInvite] });
  });

  it('shows a readable, expandable lifecycle in both admin surfaces', async () => {
    renderPanel();
    const card = await screen.findByTestId('prototype-tester-invite-invite-1');
    expect(within(card).getByText('Søknad')).toBeInTheDocument();
    expect(within(card).getByText('Tilgang aktiv')).toBeInTheDocument();
    expect(within(card).getByText(/CREATORHUB AS/)).toHaveTextContent('Org.nr. 937 518 684');
    expect(within(card).getByText('11 av 11 steg')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Detaljer' }));
    expect(await within(card).findByText('Invitasjon sendt')).toBeInTheDocument();
    expect(within(card).getByText('E-post bekreftet med kode')).toBeInTheDocument();
    expect(within(card).getByText('Fire avtaler akseptert')).toBeInTheDocument();
    expect(within(card).getByText('Konto opprettet')).toBeInTheDocument();
    expect(within(card).getByText('solo_pro aktiv')).toBeInTheDocument();
    expect(within(card).getByText('Tilgangs-e-post sendt')).toBeInTheDocument();
    expect(within(card).getByText('PDF-kvittering tilgjengelig')).toBeInTheDocument();
    expect(within(card).getByTestId('admin-download-receipt-invite-1')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Søk i prototype-testere'), { target: { value: '937518684' } });
    expect(screen.getByTestId('prototype-tester-invite-invite-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /inviter ny tester/i }));
    expect(await screen.findByRole('heading', { name: /inviter prototype-tester/i })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites', { headers: { Authorization: 'Bearer test-admin' } });
  });

  it('exposes a failed step and retries it against the same invitation id', async () => {
    const failedInvite = {
      ...completeInvite,
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Retry Tester',
      status: 'pending',
      acceptedAt: null,
      accountProvisioningComplete: false,
      soloProActive: false,
      signingReceiptId: null,
      emailDelivery: { sent: false, reason: 'provider_timeout' },
      lifecycle: [
        { key: 'created', label: 'Invitasjon opprettet', status: 'complete' },
        { key: 'invite_email', label: 'Invitasjon sendt', status: 'failed', detail: 'provider_timeout', retryStep: 'invite_email' },
        { key: 'opened', label: 'E-post åpnet', status: 'pending' },
      ],
    };
    apiRequest.mockImplementation(async (path) => {
      if (String(path).endsWith('/retry')) return { success: true };
      return { invites: [failedInvite] };
    });
    renderPanel();

    const card = await screen.findByTestId(`prototype-tester-invite-${failedInvite.id}`);
    expect(within(card).getByText('1 feil')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Detaljer' }));
    const failedStep = within(card).getByText('Invitasjon sendt').closest('[data-state]');
    expect(failedStep).toHaveAttribute('data-state', 'failed');
    expect(within(card).getByText('provider_timeout')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Prøv steget igjen' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      `/api/prototype-tester-invites/${failedInvite.id}/retry`,
      { method: 'POST', headers: { Authorization: 'Bearer test-admin' }, body: { step: 'invite_email' } },
    ));
  });
});
