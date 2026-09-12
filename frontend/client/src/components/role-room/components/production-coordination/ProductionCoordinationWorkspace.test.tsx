// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import { ProductionCoordinationWorkspace } from './ProductionCoordinationWorkspace';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock('../../services/productionCoordinationService', () => ({
  productionCoordinationService: { save },
  ProductionCoordinationConflictError: class ProductionCoordinationConflictError extends Error {},
}));

const productionDay: ProductionDay = {
  id: 'day-1', projectId: 'troll', date: '2026-09-14', scenes: ['scene-1'], crew: ['crew-1'], props: [],
  callTime: '07:00', wrapTime: '18:00', status: 'planned', coordinationVersion: 0,
  productionCoordination: {
    tasks: [],
    crewFollowUps: [{ crewId: 'crew-1', status: 'pending' }],
    logistics: [{ id: 'transport', category: 'transport', title: 'Transport', status: 'not_started' }],
    documents: [],
    callSheetChecklist: [{ id: 'schedule', title: 'Tider kontrollert', status: 'not_started' }],
    escalations: [], handover: { status: 'draft' }, activity: [],
  },
};

const project: CastingProject = {
  id: 'troll', name: 'Troll', roles: [], candidates: [], schedules: [], locations: [], props: [],
  crew: [{ id: 'crew-1', name: 'Liv Koordinator', role: 'production_coordinator' }], productionDays: [productionDay],
};

describe('ProductionCoordinationWorkspace', () => {
  beforeEach(() => save.mockReset());

  it('presents the coordinator workflow without PM costs or approval controls', () => {
    render(<ProductionCoordinationWorkspace project={project} onOpenCallSheet={() => {}} onOpenSchedule={() => {}} onOpenCrew={() => {}} onOpenFullWorkspace={() => {}} />);

    expect(screen.getByTestId('production-coordination-workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Oppgaver og frister' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crew-oppfølging' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Logistikk og leverandører' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dokumentberedskap' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Callsheet-sjekk' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Varsler og eskalering' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Daglig overlevering til produksjonsleder' })).toBeInTheDocument();
    expect(screen.queryByText('Kostnadsavvik')).not.toBeInTheDocument();
    expect(screen.queryByText('Intern godkjenning')).not.toBeInTheDocument();
  });

  it('saves handover through the coordination version lane', async () => {
    const onSaved = vi.fn();
    save.mockImplementation(async (_projectId, _dayId, _version, nextOperations) => ({
      ...productionDay,
      coordinationVersion: 1,
      productionCoordination: {
        ...nextOperations,
        activity: [{ id: 'activity-1', type: 'workspace_saved', message: 'Oppdaterte overlevering.', actorUserId: 'pc-1', createdAt: '2026-09-12T09:00:00Z' }],
      },
    }));
    render(<ProductionCoordinationWorkspace project={project} onOpenCallSheet={() => {}} onOpenSchedule={() => {}} onOpenCrew={() => {}} onOpenFullWorkspace={() => {}} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Kort status'), { target: { value: 'Crew og transport fulgt opp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre koordinering' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(
      'troll',
      'day-1',
      0,
      expect.objectContaining({ handover: expect.objectContaining({ summary: 'Crew og transport fulgt opp' }) }),
    ));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ coordinationVersion: 1 }));
    expect(await screen.findByText('Koordinatorflaten er lagret som versjon 1.')).toBeInTheDocument();
  });

  it('keeps supplier and contact details in the coordination payload', async () => {
    save.mockImplementation(async (_projectId, _dayId, _version, nextOperations) => ({
      ...productionDay,
      coordinationVersion: 1,
      productionCoordination: { ...nextOperations, activity: [] },
    }));
    render(<ProductionCoordinationWorkspace project={project} onOpenCallSheet={() => {}} onOpenSchedule={() => {}} onOpenCrew={() => {}} onOpenFullWorkspace={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nytt logistikkpunkt'), { target: { value: 'Ekstra generator' } });
    fireEvent.change(screen.getByLabelText('Leverandør'), { target: { value: 'Nordlys Utleie' } });
    fireEvent.change(screen.getByLabelText('Kontakt'), { target: { value: '+47 900 00 000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Legg til logistikkpunkt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lagre koordinering' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(
      'troll',
      'day-1',
      0,
      expect.objectContaining({
        logistics: expect.arrayContaining([
          expect.objectContaining({
            title: 'Ekstra generator',
            supplier: 'Nordlys Utleie',
            contact: '+47 900 00 000',
          }),
        ]),
      }),
    ));
  });
});
