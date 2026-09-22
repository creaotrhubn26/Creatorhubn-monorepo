import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TalentRequest } from '../../services/roleRoomPartnershipsService';
import AgencyTalentRequestsPanel from './AgencyTalentRequestsPanel';

const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const summary = {
  open: 1,
  unacknowledged: 1,
  due_within_48h: 0,
  overdue: 0,
  oldest_unacknowledged_hours: 1,
};

const request: TalentRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  invitation_id: '22222222-2222-4222-8222-222222222222',
  talent_id: '33333333-3333-4333-8333-333333333333',
  casting_role_id: 'role-1',
  requested_by_user_id: 'casting-user',
  brief: 'Vurder erfaring med fysisk krevende fjellscener.',
  response_deadline: futureDeadline,
  status: 'pending',
  response_note: null,
  acknowledged_at: null,
  responded_at: null,
  responded_by_user_id: null,
  fulfilled_proposal_id: null,
  created_at: '2026-09-19T12:00:00.000Z',
  updated_at: '2026-09-19T12:00:00.000Z',
  talent_display_name: 'Ada Skuespiller',
  role_name: 'NORA',
  agency_name: 'Nordic Talent',
  project_id: 'project-1',
  project_name: 'Troll',
  production_name: 'Troll Produksjon',
};

describe('AgencyTalentRequestsPanel', () => {
  it('lets the agency acknowledge or fulfil without exposing a direct candidate action', () => {
    const onRespond = vi.fn().mockResolvedValue(undefined);
    render(<AgencyTalentRequestsPanel requests={[request]} summary={summary} busy={false} onRespond={onRespond} />);

    expect(screen.getByText('Ada Skuespiller · NORA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /opprett kandidat/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marker mottatt' }));
    expect(onRespond).toHaveBeenCalledWith(request.id, 'acknowledge');

    fireEvent.change(screen.getByLabelText('Kommentar til produksjonen'), {
      target: { value: 'Talentet ønsker å bli foreslått.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send som forslag' }));
    expect(onRespond).toHaveBeenCalledWith(request.id, 'fulfill', 'Talentet ønsker å bli foreslått.');
  });

  it('requires a reason before declining', () => {
    const onRespond = vi.fn().mockResolvedValue(undefined);
    render(<AgencyTalentRequestsPanel requests={[request]} summary={summary} busy={false} onRespond={onRespond} />);

    const decline = screen.getByRole('button', { name: 'Avslå' });
    expect(decline).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Kommentar til produksjonen'), { target: { value: 'Ikke tilgjengelig.' } });
    expect(decline).toBeEnabled();
  });
});
