import { describe, expect, it } from 'vitest';
import type { CastingProject, LocationManagerOperations } from '../../models/casting';
import {
  buildLocationManagerOperations,
  locationReadiness,
  portfolioReadiness,
} from './locationManagerWorkspaceModel';

const project: CastingProject = {
  id: 'troll', name: 'Troll', currency: 'NOK', roles: [], candidates: [], schedules: [], crew: [], props: [],
  locations: [{
    id: 'dovre', name: 'Dovrefjell', address: 'Dovre', accessNotes: 'Innkjøring fra E6',
    contactInfo: { name: 'Grunneier' }, availability: { startDate: '2026-10-01' },
  }],
};

describe('locationManagerWorkspaceModel', () => {
  it('builds a conservative readiness record from known location facts only', () => {
    const operations = buildLocationManagerOperations(project.locations![0], project);
    expect(operations.ownerCommunication).toEqual(expect.objectContaining({ status: 'contacted', contactName: 'Grunneier' }));
    expect(operations.dateAvailability.status).toBe('in_progress');
    expect(operations.clearanceGates.find((gate) => gate.id === 'access-plan')?.status).toBe('in_progress');
    expect(operations.finance).toEqual(expect.objectContaining({ currency: 'NOK', locationFee: 0 }));
  });

  it('derives blockers, warnings and score without treating requested permits as complete', () => {
    const operations = buildLocationManagerOperations(project.locations![0], project);
    operations.decisionStatus = 'primary';
    operations.clearanceGates = operations.clearanceGates.map((gate) => gate.id === 'public-permit'
      ? { ...gate, status: 'requested' }
      : gate);
    const readiness = locationReadiness(operations);
    expect(readiness.blockers).toContain('Forsikring og ansvar mangler');
    expect(readiness.blockers).not.toContain('Myndighetstillatelser mangler');
    expect(readiness.warnings).toContain('Primærlokasjonen mangler backup');
    expect(readiness.score).toBeLessThan(80);
  });

  it('recognizes a fully cleared location and summarizes the portfolio', () => {
    const operations: LocationManagerOperations = {
      ...buildLocationManagerOperations(project.locations![0], project),
      stage: 'shoot_ready', decisionStatus: 'primary', backupLocationId: 'backup', nextAction: 'Møt eier ved porten.',
      ownerCommunication: { status: 'agreed' },
      dateAvailability: { status: 'verified', confirmedDates: ['2026-10-01'] },
      recce: { status: 'completed', attendees: ['DoP', '1st AD'] },
      clearanceGates: buildLocationManagerOperations(project.locations![0], project).clearanceGates.map((gate) => ({ ...gate, status: gate.mandatory ? 'verified' : 'not_required' })),
      logistics: { unitBase: 'P1', crewParking: 'P2', loadInRoute: 'Nordport', nearestHospital: 'Dombås', emergencyAccess: 'Sørport' },
    };
    expect(locationReadiness(operations)).toEqual(expect.objectContaining({ score: 100, blockers: [] }));
    expect(portfolioReadiness([{ ...project.locations![0], locationOperations: operations }])).toEqual(expect.objectContaining({ shootReady: 1, blocked: 0, averageScore: 100 }));
  });
});
