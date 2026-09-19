import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTalentRequest,
  projectTalentRequests,
  searchProjectTalents,
} from '../../services/roleRoomPartnershipsService';
import { TalentSourcingPanel } from './TalentSourcingPanel';

vi.mock('../../services/roleRoomPartnershipsService', () => ({
  cancelTalentRequest: vi.fn(),
  createTalentRequest: vi.fn(),
  projectTalentRequests: vi.fn(),
  searchProjectTalents: vi.fn(),
}));

vi.mock('../IncomingTalentProposalsList', () => ({
  default: () => <div data-testid="incoming-proposals" />,
}));

const mockedSearch = vi.mocked(searchProjectTalents);
const mockedRequests = vi.mocked(projectTalentRequests);
const mockedCreateRequest = vi.mocked(createTalentRequest);

describe('TalentSourcingPanel', () => {
  beforeEach(() => {
    mockedSearch.mockReset();
    mockedRequests.mockReset();
    mockedCreateRequest.mockReset();
    mockedRequests.mockResolvedValue({ requests: [] });
  });

  it('shows only the masked project-scoped fields returned by the server', async () => {
    mockedSearch.mockResolvedValue({
      project_id: 'project-1',
      query: '',
      role_id: null,
      can_manage_partnerships: false,
      sources: [{
        invitation_id: 'invitation-1',
        agency_id: 'agency-1',
        agency_name: 'Nordic Talent',
        agency_logo_url: null,
        agency_verified: true,
        role_ids: null,
        expires_at: null,
        visible_talent_count: 1,
        pending_proposal_count: 0,
        open_request_count: 0,
      }],
      talents: [{
        id: 'talent-1',
        display_name: 'Ada Skuespiller',
        city: 'Oslo',
        country: 'NO',
        headshot_url: null,
        playing_age_min: null,
        playing_age_max: null,
        gender: null,
        availability_status: 'open',
        agency_id: 'agency-1',
        agency_name: 'Nordic Talent',
        agency_logo_url: null,
        agency_verified: true,
        invitation_id: 'invitation-1',
        granted_scopes: ['basic_profile', 'availability'],
        already_proposed: false,
        already_candidate: false,
        active_request_id: null,
        active_request_status: null,
      }],
    });

    render(
      <TalentSourcingPanel
        projectId="project-1"
        roles={[{ id: 'role-1', name: 'NORA' }]}
        onCandidatesChanged={() => {}}
        onOpenCandidates={() => {}}
      />,
    );

    expect(await screen.findByText('Ada Skuespiller')).toBeInTheDocument();
    expect(screen.getByText(/kontaktdata og utvidet materiale/i)).toBeInTheDocument();
    expect(screen.getByTestId('incoming-proposals')).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenCalledWith('project-1', { q: undefined, roleId: undefined, limit: 50 });
  });

  it('applies an explicit search without mutating the role list', async () => {
    mockedSearch.mockResolvedValue({
      project_id: 'project-1',
      query: '',
      role_id: null,
      can_manage_partnerships: false,
      sources: [],
      talents: [],
    });

    render(
      <TalentSourcingPanel
        projectId="project-1"
        roles={[{ id: 'role-1', name: 'NORA' }]}
        onCandidatesChanged={() => {}}
        onOpenCandidates={() => {}}
      />,
    );
    await screen.findByText(/ingen godkjente partnerbyråer/i);

    fireEvent.change(screen.getByLabelText('Søk etter navn eller sted'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Søk' }));

    await waitFor(() => expect(mockedSearch).toHaveBeenLastCalledWith(
      'project-1',
      { q: 'Ada', roleId: undefined, limit: 50 },
    ));
  });

  it('sends a traceable role request instead of creating a candidate directly', async () => {
    mockedSearch.mockResolvedValue({
      project_id: 'project-1',
      query: '',
      role_id: null,
      can_manage_partnerships: false,
      sources: [{
        invitation_id: '11111111-1111-4111-8111-111111111111',
        agency_id: 'agency-1',
        agency_name: 'Nordic Talent',
        agency_logo_url: null,
        agency_verified: true,
        role_ids: ['role-1'],
        expires_at: null,
        visible_talent_count: 1,
        pending_proposal_count: 0,
        open_request_count: 0,
      }],
      talents: [{
        id: '22222222-2222-4222-8222-222222222222',
        display_name: 'Ada Skuespiller',
        city: 'Oslo',
        country: 'NO',
        headshot_url: null,
        playing_age_min: null,
        playing_age_max: null,
        gender: null,
        availability_status: 'open',
        agency_id: 'agency-1',
        agency_name: 'Nordic Talent',
        agency_logo_url: null,
        agency_verified: true,
        invitation_id: '11111111-1111-4111-8111-111111111111',
        granted_scopes: ['basic_profile'],
        already_proposed: false,
        already_candidate: false,
        active_request_id: null,
        active_request_status: null,
      }],
    });
    mockedCreateRequest.mockResolvedValue({ request: {} as never });

    render(
      <TalentSourcingPanel
        projectId="project-1"
        roles={[{ id: 'role-1', name: 'NORA' }]}
        onCandidatesChanged={() => {}}
        onOpenCandidates={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Be byrået foreslå' }));
    fireEvent.change(await screen.findByLabelText(/Castingbrief/), { target: { value: 'Sterk match for scenene på fjellet.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send forespørsel' }));

    await waitFor(() => expect(mockedCreateRequest).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        invitation_id: '11111111-1111-4111-8111-111111111111',
        talent_id: '22222222-2222-4222-8222-222222222222',
        casting_role_id: 'role-1',
        brief: 'Sterk match for scenene på fjellet.',
      }),
    ));
  });
});
