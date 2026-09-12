// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import { SecondAssistantDirectorWorkspace } from './SecondAssistantDirectorWorkspace';

const { saveProductionDay } = vi.hoisted(() => ({
  saveProductionDay: vi.fn(),
}));

vi.mock('../../services/castingService', () => ({
  castingService: {
    saveProductionDay,
  },
}));

const project: CastingProject = {
  id: 'troll-project',
  name: 'Troll',
  roles: [],
  candidates: [],
  schedules: [],
  locations: [],
  props: [],
  crew: [],
};

const productionDay: ProductionDay = {
  id: 'production-day-1',
  projectId: project.id,
  date: '2026-09-14',
  scenes: [],
  crew: [],
  props: [],
  callTime: '07:00',
  status: 'planned',
  secondAd: {
    entries: [],
    notes: 'Opprinnelig dagsmerknad',
  },
};

const projectWithDay: CastingProject = {
  ...project,
  productionDays: [productionDay],
  sceneBreakdowns: [],
};

const renderWorkspace = (
  workspaceProject: CastingProject = projectWithDay,
  overrides: Partial<ComponentProps<typeof SecondAssistantDirectorWorkspace>> = {},
) => render(
  <SecondAssistantDirectorWorkspace
    project={workspaceProject}
    onOpenCallSheet={() => {}}
    onOpenSchedule={() => {}}
    onOpenLiveSet={() => {}}
    onOpenFullWorkspace={() => {}}
    {...overrides}
  />,
);

describe('SecondAssistantDirectorWorkspace', () => {
  beforeEach(() => {
    saveProductionDay.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deliveries: [] }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the production days supplied by the canonical project state', async () => {
    renderWorkspace();

    expect(await screen.findByLabelText('Felles dagsmerknad')).toHaveValue('Opprinnelig dagsmerknad');
    expect(screen.getByText('2026-09-14 · 07:00')).toBeInTheDocument();
    expect(screen.queryByText('Ingen produksjonsdag er registrert. Opprett en dag i opptaksplanen før cast movement kan føres.')).not.toBeInTheDocument();
  });

  it('shows a loading state while the parent hydrates canonical production data', () => {
    renderWorkspace(project, { dataLoading: true });
    expect(screen.getByText('Henter produksjonsdager…')).toBeInTheDocument();
  });

  it('opens the call sheet directly for the selected canonical day', async () => {
    const onOpenCallSheet = vi.fn();
    renderWorkspace(projectWithDay, { onOpenCallSheet });
    fireEvent.click(await screen.findByRole('button', { name: 'Callsheet og utsending' }));
    expect(onOpenCallSheet).toHaveBeenCalledWith(productionDay.id);
  });

  it('persists a second AD note into the canonical production day', async () => {
    saveProductionDay.mockResolvedValue(undefined);

    renderWorkspace();

    const note = await screen.findByLabelText('Felles dagsmerknad');
    fireEvent.change(note, { target: { value: 'Oppdatert av 2nd AD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre dagsstatus' }));

    await waitFor(() => {
      expect(saveProductionDay).toHaveBeenCalledWith(
        project.id,
        expect.objectContaining({
          id: productionDay.id,
          secondAd: expect.objectContaining({
            entries: [],
            notes: 'Oppdatert av 2nd AD',
          }),
        }),
      );
    });
    expect(await screen.findByText('Dagsstatusen er lagret.')).toBeInTheDocument();
  });

  it('persists individual times, transport and movement status together', async () => {
    const movementDay: ProductionDay = {
      ...productionDay,
      secondAd: {
        entries: [{
          id: 'cast:candidate-nora',
          personType: 'cast',
          personId: 'candidate-nora',
          name: 'Ada Skuespiller',
          roleName: 'NORA',
          callTime: '07:00',
          status: 'acknowledged',
        }],
      },
    };
    saveProductionDay.mockResolvedValue(undefined);

    renderWorkspace({ ...projectWithDay, productionDays: [movementDay] });

    fireEvent.change(await screen.findByLabelText('Henting'), { target: { value: '05:45' } });
    fireEvent.change(screen.getByLabelText('Call'), { target: { value: '06:15' } });
    fireEvent.change(screen.getByLabelText('Sminke'), { target: { value: '06:30' } });
    fireEvent.change(screen.getByLabelText('Kostyme'), { target: { value: '06:45' } });
    fireEvent.change(screen.getByLabelText('På sett'), { target: { value: '07:30' } });
    fireEvent.change(screen.getByLabelText('Transport / sjåfør'), { target: { value: 'Bil 2 · Ola' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Klar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lagre dagsstatus' }));

    await waitFor(() => expect(saveProductionDay).toHaveBeenCalledWith(
      project.id,
      expect.objectContaining({
        id: movementDay.id,
        secondAd: expect.objectContaining({
          entries: [expect.objectContaining({
            id: 'cast:candidate-nora',
            pickupTime: '05:45',
            callTime: '06:15',
            makeupTime: '06:30',
            wardrobeTime: '06:45',
            onSetTime: '07:30',
            transport: 'Bil 2 · Ola',
            status: 'ready',
          })],
        }),
      }),
    ));
  });

  it('shows recipient delivery states and reminds only missing acknowledgements', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deliveries: [{
          id: '11111111-1111-4111-8111-111111111111',
          revision: 2,
          createdAt: '2026-09-11T08:00:00.000Z',
          total: 3,
          sent: 2,
          failed: 1,
          acknowledged: 1,
          recipients: [
            { id: '22222222-2222-4222-8222-222222222222', name: 'Ada', email: 'ada@example.test', deliveryStatus: 'sent', acknowledgedAt: '2026-09-11T08:05:00.000Z', reminderCount: 0 },
            { id: '33333333-3333-4333-8333-333333333333', name: 'Bo', email: 'bo@example.test', deliveryStatus: 'sent', acknowledgedAt: null, reminderCount: 0 },
            { id: '44444444-4444-4444-8444-444444444444', name: 'Cam', email: 'cam@example.test', deliveryStatus: 'failed', acknowledgedAt: null, reminderCount: 0 },
          ],
        }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reminded: 1, total: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deliveries: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    renderWorkspace();

    expect(await screen.findByText('Sendt 2/3')).toBeInTheDocument();
    expect(screen.getByText('Feilet 1/3')).toBeInTheDocument();
    expect(screen.getByText('Bekreftet 1/3')).toBeInTheDocument();
    expect(screen.getByText(/Ada · ada@example\.test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Purr manglende (1)' }));

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/role-room/call-sheet-deliveries/11111111-1111-4111-8111-111111111111/remind',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipientIds: ['33333333-3333-4333-8333-333333333333'] }),
      }),
    ));
    expect(await screen.findByText('Påminnelse sendt til 1 mottaker.')).toBeInTheDocument();
  });
});
