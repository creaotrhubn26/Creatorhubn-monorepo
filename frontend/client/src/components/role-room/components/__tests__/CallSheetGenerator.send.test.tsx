// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CallSheetGenerator,
  describeCallSheetRevisionChanges,
  selectAffectedCallSheetRecipients,
  type CallSheetRevisionSnapshot,
} from '../CallSheetGenerator';

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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/call-sheet-deliveries?')) {
        return { ok: true, json: async () => ({ deliveries: [] }) };
      }
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ sent: 1, total: 1, revision: 1 }) };
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
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

    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    expect(screen.getByTestId('call-sheet-recipient-preview')).toBeInTheDocument();
    expect(screen.getByText('ada@example.test · Cast')).toBeInTheDocument();
    expect(screen.getByText('kari@example.test · Crew')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Kari Foto/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publiser til 1 mottakere' }));

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1));
    const [, request] = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!;
    const payload = JSON.parse(String(request?.body));
    expect(payload).toMatchObject({ projectId: 'project-1', productionDayId: 'day-1' });
    expect(payload).not.toHaveProperty('revision');
    expect(payload.snapshot).toMatchObject({ schemaVersion: 1, recipientEmails: ['ada@example.test', 'kari@example.test'] });
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

  it('uses canonical project data without refetching the same call-sheet sources', async () => {
    const productionDay = (await getProductionDays())?.[0];
    const secondDay = { ...productionDay, id: 'day-2', date: '2026-09-13' };
    const project = {
      id: 'project-1',
      name: 'Troll',
      productionDays: [productionDay, secondDay],
      sceneBreakdowns: await getSceneBreakdowns(),
      candidates: await getCandidates(),
      roles: await getRoles(),
      crew: await getCrew(),
      locations: await getLocations(),
    };
    getProject.mockClear();
    getCandidates.mockClear();
    getRoles.mockClear();
    getCrew.mockClear();
    getLocations.mockClear();
    getProductionDays.mockClear();
    getSceneBreakdowns.mockClear();

    render(
      <CallSheetGenerator
        projectId="project-1"
        project={project}
        canonicalDataReady
        productionDay={productionDay}
        productionDayId="day-1"
      />,
    );

    expect(await screen.findByText('Ada Skuespiller')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Kontroller mottakere' })).toBeEnabled();
    expect(getProject).not.toHaveBeenCalled();
    expect(getCandidates).not.toHaveBeenCalled();
    expect(getRoles).not.toHaveBeenCalled();
    expect(getCrew).not.toHaveBeenCalled();
    expect(getLocations).not.toHaveBeenCalled();
    expect(getProductionDays).not.toHaveBeenCalled();
    expect(getSceneBreakdowns).not.toHaveBeenCalled();
  });

  it('keeps the call sheet visible but disables distribution for the default director role', async () => {
    getMyTabs.mockResolvedValue({ tabAccess: null, source: 'default', role: 'director', tabValues: null });

    render(<CallSheetGenerator projectId="project-1" productionDayId="day-1" />);

    const readOnlyButton = await screen.findByRole('button', { name: 'Kun lesetilgang' });
    expect(readOnlyButton).toBeDisabled();
    expect(await screen.findByText('Ada Skuespiller')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });
});

describe('call sheet revision planning', () => {
  const snapshot = (overrides: Partial<CallSheetRevisionSnapshot> = {}): CallSheetRevisionSnapshot => ({
    schemaVersion: 1,
    general: { callTime: '07:00' },
    locations: [],
    scenes: [],
    cast: [],
    crew: [],
    instructions: { specialInstructions: '', notes: '', emergencyContacts: [], weatherForecast: null },
    recipientEmails: ['ada@example.test'],
    ...overrides,
  });

  it('distinguishes content changes from recipient-only changes', () => {
    expect(describeCallSheetRevisionChanges(snapshot(), snapshot({ recipientEmails: ['ada@example.test', 'kari@example.test'] }))).toEqual({
      labels: ['Mottakerliste'],
      contentChanged: false,
      recipientsChanged: true,
    });
    expect(describeCallSheetRevisionChanges(snapshot(), snapshot({ general: { callTime: '08:00' } }))).toMatchObject({
      labels: ['Dato og tider'],
      contentChanged: true,
    });
  });

  it('selects everyone for content changes, otherwise only new and previously failed recipients', () => {
    const previous = {
      recipients: [
        { id: '1', email: 'ada@example.test', deliveryStatus: 'sent' },
        { id: '2', email: 'kari@example.test', deliveryStatus: 'failed' },
      ],
    };
    const current = ['ada@example.test', 'kari@example.test', 'new@example.test'];
    expect(selectAffectedCallSheetRecipients(current, previous, { contentChanged: false })).toEqual(['kari@example.test', 'new@example.test']);
    expect(selectAffectedCallSheetRecipients(current, previous, { contentChanged: true })).toEqual(current);
  });
});
