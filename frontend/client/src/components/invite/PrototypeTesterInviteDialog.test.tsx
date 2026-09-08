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
});
