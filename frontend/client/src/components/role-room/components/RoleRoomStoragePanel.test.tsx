import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RoleRoomStoragePanel from './RoleRoomStoragePanel';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('RoleRoomStoragePanel affiliate Connect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows KYC, payout balance and a protected Stripe onboarding action for an affiliate org admin', async () => {
    localStorage.setItem('rr_bearer', 'role-room-token');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/storage/billing/context')) {
        return jsonResponse({
          organization: {
            id: ORGANIZATION_ID,
            name: 'Nordic Casting AS',
            membershipRole: 'admin',
            canAdminister: true,
          },
          storage: {
            storageAccountId: '22222222-2222-4222-8222-222222222222',
            ownerType: 'organization',
            planKey: 'agency',
            usedBytes: 0,
            quotaBytes: 250 * 1024 ** 3,
            fileCount: 0,
            percentageUsed: 0,
            status: 'active',
            billing: {
              subscriptionId: null,
              subscriptionStatus: null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              graceUntil: null,
            },
          },
          checkoutAvailability: { extra100Gib: true, extra1Tib: false, billingPortal: false },
          pricing: {
            currency: 'NOK',
            taxBehavior: 'exclusive',
            interval: 'month',
            addOns: {
              extra100Gib: { amount: 129, bytes: 100 * 1024 ** 3 },
              extra1Tib: { amount: 799, bytes: 1024 ** 4 },
            },
          },
        });
      }
      if (url.includes('/storage/objects')) return jsonResponse({ objects: [] });
      if (url.includes('/affiliate/connect/status')) {
        return jsonResponse({
          partner: {
            id: '33333333-3333-4333-8333-333333333333',
            organizationId: ORGANIZATION_ID,
            referralCode: 'NORDIC15',
            status: 'active',
            minimumPayoutMinor: 100_000,
            payoutCurrency: 'nok',
          },
          connect: {
            accountId: null,
            onboardingStatus: 'not_started',
            detailsSubmitted: false,
            payoutsEnabled: false,
            transfersStatus: null,
            requirements: {},
          },
          balance: {
            currency: 'nok',
            accruedMinor: 123_456,
            adjustmentMinor: 0,
            reservedOrTransferredMinor: 0,
            availableMinor: 123_456,
            nextMaturityAt: null,
          },
        });
      }
      if (url.endsWith('/affiliate/connect/onboarding') && init?.method === 'POST') {
        return jsonResponse({ onboardingUrl: 'https://not-stripe.example/onboarding' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoleRoomStoragePanel organizationId={ORGANIZATION_ID} />);

    expect(await screen.findByText('Affiliateutbetaling')).toBeTruthy();
    const onboardingButton = screen.getByRole('button', { name: 'Start Stripe-verifisering' });
    fireEvent.click(onboardingButton);

    expect(await screen.findByText('Stripe returnerte en ugyldig onboarding-lenke. Prøv igjen.')).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/storage/affiliate/connect/onboarding',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ organizationId: ORGANIZATION_ID }),
      }),
    ));
  });
});
