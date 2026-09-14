import { describe, expect, it } from 'vitest';
import type { CastingProject, LocationManagerOperations } from '../../models/casting';
import {
  buildLocationManagerOperations,
  locationDecisionSummary,
  locationReadiness,
  portfolioReadiness,
  verifiedScoutEvidence,
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
    expect(operations.decisionReview.criteria).toHaveLength(8);
    expect(locationDecisionSummary(operations)).toEqual(expect.objectContaining({ evidenceScore: 0, verifiedCriteria: 0, canLock: false }));
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

  it('does not inflate workflow progress from free text, planned work or an empty risk register', () => {
    const operations = buildLocationManagerOperations(project.locations![0], project);
    operations.ownerCommunication.status = 'negotiating';
    operations.dateAvailability.status = 'requested';
    operations.recce.status = 'scheduled';
    operations.logistics = {
      unitBase: 'Detaljert baseplan', crewParking: 'P2', loadInRoute: 'Nordport',
      nearestHospital: 'Dombås', emergencyAccess: 'Sørport',
    };
    operations.risks = [];
    operations.clearanceGates = operations.clearanceGates.map((gate) => ({ ...gate, status: 'in_progress' }));

    expect(locationReadiness(operations).score).toBe(0);
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

  it('only exposes explicitly verified observations as factual analysis evidence', () => {
    const operations = buildLocationManagerOperations(project.locations![0], project);
    operations.scoutCapture.observations = [
      { id: 'unknown', category: 'power', status: 'unknown', value: 'Mulig uttak', source: 'manual', observedAt: '2026-09-13T10:00:00Z', mediaIds: [], sceneIds: [] },
      { id: 'seen', category: 'noise', status: 'observed', value: 'Trafikk hørt', source: 'field_observation', observedAt: '2026-09-13T10:01:00Z', mediaIds: [], sceneIds: [] },
      { id: 'meter', category: 'noise', status: 'verified', value: '62 dBA', source: 'measurement', observedAt: '2026-09-13T10:02:00Z', mediaIds: ['audio-1'], sceneIds: ['12A'] },
    ];
    expect(verifiedScoutEvidence(operations)).toEqual([
      expect.objectContaining({ id: 'meter', value: '62 dBA' }),
    ]);
  });

  it('counts only explicit pass results with evidence and explains every missing lock requirement', () => {
    const operations = buildLocationManagerOperations(project.locations![0], project);
    operations.decisionReview.criteria = operations.decisionReview.criteria.map((criterion, index) => index === 0
      ? { ...criterion, status: 'pass', evidence: 'Godkjent moodboard-referanse SC-12.' }
      : criterion);
    const summary = locationDecisionSummary(operations);
    expect(summary.evidenceScore).toBe(13);
    expect(summary.verifiedCriteria).toBe(1);
    expect(summary.lockReasons).toContain('Kamera og lys er ikke godkjent');
    expect(summary.lockReasons).toContain('Backup-lokasjon er ikke valgt');
  });
});
