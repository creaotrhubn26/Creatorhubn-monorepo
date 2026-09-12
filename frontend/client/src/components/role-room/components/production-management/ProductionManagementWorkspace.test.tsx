// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import { ProductionManagementWorkspace } from './ProductionManagementWorkspace';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock('../../services/productionManagementService', () => ({
  productionManagementService: { save },
  ProductionManagementConflictError: class ProductionManagementConflictError extends Error {},
}));
vi.mock('../../services/roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
}));

const productionDay: ProductionDay = {
  id: 'day-1', projectId: 'troll', date: '2026-09-14', scenes: ['scene-1'], crew: ['crew-1'], props: [],
  callTime: '07:00', wrapTime: '18:00', status: 'planned', managementVersion: 0,
  productionManagement: {
    dayStatus: 'not_started', callSheetApproval: 'not_ready',
    crewConfirmations: [{ crewId: 'crew-1', status: 'pending' }],
    checkpoints: [{ id: 'transport', category: 'transport', title: 'Transport', status: 'not_started' }],
    issues: [], costItems: [], activity: [], notes: '',
  },
};

const project: CastingProject = {
  id: 'troll', name: 'Troll', currency: 'NOK', roles: [], candidates: [], schedules: [], locations: [], props: [],
  crew: [{ id: 'crew-1', name: 'Liv Produksjon', role: 'production_manager' }], productionDays: [productionDay],
};

const renderWorkspace = (onSaved = vi.fn()) => render(
  <ProductionManagementWorkspace
    project={project}
    onOpenCallSheet={() => {}}
    onOpenSchedule={() => {}}
    onOpenCrew={() => {}}
    onOpenFullWorkspace={() => {}}
    onSaved={onSaved}
  />,
);

describe('ProductionManagementWorkspace', () => {
  beforeEach(() => {
    save.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deliveries: [{
        id: 'delivery-1', revision: 3, status: 'published', createdAt: '2026-09-12T08:00:00Z',
        total: 4, sent: 4, failed: 0, acknowledged: 3,
      }] }),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('presents the six daily-control areas from canonical project data', async () => {
    renderWorkspace();

    expect(screen.getByTestId('production-management-workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Troll' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Callsheet og godkjenning' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crew-bekreftelser' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Logistikk' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kostnadsavvik' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Avvik og tiltak' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dagsnotat og aktivitet' })).toBeInTheDocument();
    expect(await screen.findByText(/Publisert revisjon 3/)).toBeInTheDocument();
    expect(screen.getByText('Liv Produksjon')).toBeInTheDocument();
  });

  it('saves all day-control changes through the versioned endpoint', async () => {
    const onSaved = vi.fn();
    save.mockImplementation(async (_projectId, _dayId, _version, nextOperations) => ({
      ...productionDay,
      managementVersion: 1,
      productionManagement: {
        ...nextOperations,
        activity: [{ id: 'activity-1', type: 'workspace_saved', message: 'Oppdaterte dagsnotat.', actorUserId: 'pm-1', createdAt: '2026-09-12T09:00:00Z' }],
      },
    }));
    renderWorkspace(onSaved);

    fireEvent.change(screen.getByLabelText('Produksjonsledelsens dagsnotat'), { target: { value: 'Kontrollert med avdelingslederne' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre dagskontroll' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(
      'troll',
      'day-1',
      0,
      expect.objectContaining({ notes: 'Kontrollert med avdelingslederne' }),
    ));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ managementVersion: 1 }));
    expect(await screen.findByText('Dagskontrollen er lagret som versjon 1.')).toBeInTheDocument();
  });
});
