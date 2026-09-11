// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import { SecondAssistantDirectorWorkspace } from './SecondAssistantDirectorWorkspace';

const { getProductionDays, getSceneBreakdowns, saveProductionDay } = vi.hoisted(() => ({
  getProductionDays: vi.fn(),
  getSceneBreakdowns: vi.fn(),
  saveProductionDay: vi.fn(),
}));

vi.mock('../../services/castingService', () => ({
  castingService: {
    getProductionDays,
    getSceneBreakdowns,
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

const renderWorkspace = () => render(
  <SecondAssistantDirectorWorkspace
    project={project}
    onOpenCallSheet={() => {}}
    onOpenSchedule={() => {}}
    onOpenLiveSet={() => {}}
    onOpenFullWorkspace={() => {}}
  />,
);

describe('SecondAssistantDirectorWorkspace', () => {
  beforeEach(() => {
    getProductionDays.mockReset();
    getSceneBreakdowns.mockReset().mockResolvedValue([]);
    saveProductionDay.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deliveries: [] }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads canonical production days when the project shell has none', async () => {
    getProductionDays.mockResolvedValue([productionDay]);

    renderWorkspace();

    expect(screen.getByText('Henter produksjonsdager…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Felles dagsmerknad')).toHaveValue('Opprinnelig dagsmerknad');
    expect(screen.getByText('2026-09-14 · 07:00')).toBeInTheDocument();
    expect(screen.queryByText('Ingen produksjonsdag er registrert. Opprett en dag i opptaksplanen før cast movement kan føres.')).not.toBeInTheDocument();
    expect(getProductionDays).toHaveBeenCalledWith(project.id);
  });

  it('persists a second AD note into the fetched production day', async () => {
    getProductionDays.mockResolvedValue([productionDay]);
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
    getProductionDays.mockResolvedValue([movementDay]);
    saveProductionDay.mockResolvedValue(undefined);

    renderWorkspace();

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
});
