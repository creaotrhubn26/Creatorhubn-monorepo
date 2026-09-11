// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallSheetGenerator } from '../CallSheetGenerator';

const {
  getProject,
  getCandidates,
  getRoles,
  getCrew,
  getLocations,
  getProductionDays,
  getSceneBreakdowns,
  getMyTabs,
} = vi.hoisted(() => ({
  getProject: vi.fn(),
  getCandidates: vi.fn(),
  getRoles: vi.fn(),
  getCrew: vi.fn(),
  getLocations: vi.fn(),
  getProductionDays: vi.fn(),
  getSceneBreakdowns: vi.fn(),
  getMyTabs: vi.fn(),
}));

vi.mock('../../services/castingService', () => ({
  castingService: {
    getProject,
    getCandidates,
    getRoles,
    getCrew,
    getLocations,
    getProductionDays,
    getSceneBreakdowns,
  },
}));
vi.mock('../../services/roleRoomProjectTabConfigService', () => ({
  roleRoomProjectTabConfigService: { getMyTabs },
}));
vi.mock('../../services/roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-token' }),
}));
vi.mock('../../hooks/useProjectMemberAvailability', () => ({
  useProjectMemberAvailability: () => ({ availabilityByUser: new Map(), emailToUser: new Map() }),
}));

describe('CallSheetGenerator recipient confirmation', () => {
  beforeEach(() => {
    getProject.mockResolvedValue({ id: 'project-1', name: 'Troll' });
    getCandidates.mockResolvedValue([{
      id: 'candidate-nora', name: 'Ada Skuespiller', contactInfo: { email: 'ada@example.test' },
    }]);
    getRoles.mockResolvedValue([{
      id: 'role-nora', name: 'NORA', assignedCandidateId: 'candidate-nora',
    }]);
    getCrew.mockResolvedValue([{
      id: 'crew-1', name: 'Kari Foto', role: 'DOP', department: 'Foto',
      contactInfo: { email: 'kari@example.test' },
    }]);
    getLocations.mockResolvedValue([]);
    getProductionDays.mockResolvedValue([{
      id: 'day-1', projectId: 'project-1', date: '2026-09-12', callTime: '07:00',
      scenes: ['scene-1'], crew: ['crew-1'], props: [], status: 'planned',
      secondAd: { entries: [{
        id: 'cast:candidate-nora', personType: 'cast', personId: 'candidate-nora',
        name: 'Ada Skuespiller', roleName: 'NORA', callTime: '06:15', makeupTime: '06:30',
        wardrobeTime: '06:45', onSetTime: '07:30', transport: 'Bil 2 · Ola', status: 'ready',
      }] },
    }]);
    getSceneBreakdowns.mockResolvedValue([{
      id: 'scene-1', sceneNumber: 1, sceneHeading: 'INT. ROM - DAG', characters: ['role-nora'],
    }]);
    getMyTabs.mockResolvedValue({ tabAccess: null, source: 'default', role: 'second_ad', tabValues: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1, total: 1 }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not send on the first click and only sends the checked recipients after confirmation', async () => {
    const onDeliverySent = vi.fn();
    render(<CallSheetGenerator projectId="project-1" productionDayId="day-1" onDeliverySent={onDeliverySent} />);

    const previewButton = await screen.findByRole('button', { name: 'Kontroller mottakere' });
    await waitFor(() => expect(previewButton).toBeEnabled());
    fireEvent.click(previewButton);

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('call-sheet-recipient-preview')).toBeInTheDocument();
    expect(screen.getByText('ada@example.test · Cast')).toBeInTheDocument();
    expect(screen.getByText('kari@example.test · Crew')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Kari Foto/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send til 1 mottakere' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(request?.body));
    expect(payload).toMatchObject({ projectId: 'project-1', productionDayId: 'day-1' });
    expect(payload.recipients).toEqual([{ name: 'Ada Skuespiller', email: 'ada@example.test' }]);
    expect(payload.html).toContain('Kostyme');
    expect(payload.html).toContain('06:45');
    expect(payload.html).toContain('Bil 2 · Ola');
    expect(onDeliverySent).toHaveBeenCalledTimes(1);
  });

  it('applies updated 2AD times immediately from the canonical production-day prop', async () => {
    const baseDay = (await getProductionDays())?.[0];
    const sharedProps = {
      projectId: 'project-1',
      scenes: await getSceneBreakdowns(),
      crew: await getCrew(),
      locations: await getLocations(),
    };
    const { rerender } = render(<CallSheetGenerator {...sharedProps} productionDay={baseDay} />);

    expect(await screen.findByText('06:15')).toBeInTheDocument();
    const updatedDay = {
      ...baseDay,
      secondAd: {
        ...baseDay.secondAd,
        entries: baseDay.secondAd.entries.map((entry: Record<string, unknown>) => ({ ...entry, callTime: '05:55', transport: 'Bil 4 · Liv' })),
      },
    };
    rerender(<CallSheetGenerator {...sharedProps} productionDay={updatedDay} />);

    expect(await screen.findByText('05:55')).toBeInTheDocument();
    expect(screen.getByText('Bil 4 · Liv')).toBeInTheDocument();
  });

  it('keeps the call sheet visible but disables distribution for the default director role', async () => {
    getMyTabs.mockResolvedValue({ tabAccess: null, source: 'default', role: 'director', tabValues: null });

    render(<CallSheetGenerator projectId="project-1" productionDayId="day-1" />);

    const readOnlyButton = await screen.findByRole('button', { name: 'Kun lesetilgang' });
    expect(readOnlyButton).toBeDisabled();
    expect(await screen.findByText('Ada Skuespiller')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
