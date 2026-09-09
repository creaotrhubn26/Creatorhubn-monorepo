import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/queryClient';
import { PrototypeTesterInviteDialog } from './RoleRoomTesterInviteDialog';

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

describe('PrototypeTesterInviteDialog', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('uses the authenticated CreatorHub invite contract and shows real delivery status', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      id: 'invite-id',
      token: 'invite-token',
      inviteUrl: 'https://creatorhubn.com/prototype-tester/accept-invite?token=invite-token',
      emailDelivery: {
        sent: true,
        provider: 'resend',
        messageId: 'message-id',
      },
    });

    render(<PrototypeTesterInviteDialog open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Navn'), {
      target: { value: 'Direkte Tester' },
    });
    fireEvent.change(screen.getByLabelText('E-post'), {
      target: { value: 'tester@example.com' },
    });
    fireEvent.click(screen.getByText('Story Arc Studio'));
    fireEvent.click(screen.getByRole('button', { name: 'Send invitasjon' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites', {
        method: 'POST',
        body: {
          email: 'tester@example.com',
          name: 'Direkte Tester',
          profession: undefined,
          company: undefined,
          organizationNumber: undefined,
          testingAreas: ['Story Arc Studio'],
          personalMessage: undefined,
        },
      });
    });

    expect(
      await screen.findByText(
        'Invitasjon opprettet og e-post sendt til tester@example.com.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/prototype-tester\/accept-invite/)).toBeInTheDocument();
  });

  it('searches BRREG and sends the selected legal identity in the invite contract', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (String(path).includes('/brreg/search')) {
        return {
          companies: [{
            organizationNumber: '937518684',
            name: 'CREATORHUB AS',
            organizationForm: 'Aksjeselskap',
            primaryIndustryCode: '59.200',
            primaryIndustryDescription:
              'Produksjon og utgivelse av musikk- og lydopptak',
            recommendedProfession: 'music_producer',
            businessAddress: 'Søsterveien 11, 1474 LØRENSKOG',
            operationalStatus: 'active',
          }],
        };
      }
      return {
        id: 'invite-id',
        token: 'invite-token',
        inviteUrl: 'https://creatorhubn.com/prototype-tester/accept-invite?token=invite-token',
        emailDelivery: { sent: true, provider: 'resend' },
        verifiedCompany: {
          organizationNumber: '937518684',
          name: 'CREATORHUB AS',
          businessAddress: 'Søsterveien 11, 1474 LØRENSKOG',
        },
      };
    });

    render(<PrototypeTesterInviteDialog open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Navn'), {
      target: { value: 'CreatorHub E2E Tester' },
    });
    fireEvent.change(screen.getByLabelText('E-post'), {
      target: { value: 'daniel@creatorhubn.com' },
    });
    const companySearch = screen.getByRole('combobox', {
      name: 'Søk bedrift i Brønnøysundregistrene',
    });
    fireEvent.focus(companySearch);
    fireEvent.change(companySearch, { target: { value: 'Creatorhub' } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        '/api/prototype-tester-invites/brreg/search?q=Creatorhub',
      );
    });
    fireEvent.click(await screen.findByRole('option', { name: /CREATORHUB AS/ }));
    expect(
      screen.getByRole('combobox', { name: 'Profesjon (valgfri)' }),
    ).toHaveTextContent('Musikkprodusent');
    expect(
      screen.getByText(/BRREG foreslår «Musikkprodusent»/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('CreatorHub-dashboard'));
    fireEvent.click(screen.getByRole('button', { name: 'Send invitasjon' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/prototype-tester-invites', {
        method: 'POST',
        body: {
          email: 'daniel@creatorhubn.com',
          name: 'CreatorHub E2E Tester',
          profession: 'music_producer',
          company: 'CREATORHUB AS',
          organizationNumber: '937518684',
          testingAreas: ['CreatorHub-dashboard'],
          personalMessage: undefined,
        },
      });
    });
    expect(await screen.findByText(/BRREG-verifisert · Org.nr. 937518684/)).toBeInTheDocument();
  });
});
