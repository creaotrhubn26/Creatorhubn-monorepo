import type {
  CastingProject,
  Location,
  LocationClearanceGate,
  LocationManagerOperations,
} from '../../models/casting';

const nowIso = () => new Date().toISOString();

const DEFAULT_GATES: ReadonlyArray<Omit<LocationClearanceGate, 'updatedAt'>> = [
  { id: 'owner-permission', category: 'owner', title: 'Eieravtale og signatur', status: 'missing', mandatory: true },
  { id: 'public-permit', category: 'permit', title: 'Myndighetstillatelser', status: 'missing', mandatory: true },
  { id: 'insurance', category: 'insurance', title: 'Forsikring og ansvar', status: 'missing', mandatory: true },
  { id: 'technical-recce', category: 'technical', title: 'Teknisk recce godkjent', status: 'missing', mandatory: true },
  { id: 'access-plan', category: 'access', title: 'Adkomst, parkering og unit base', status: 'missing', mandatory: true },
  { id: 'safety-plan', category: 'safety', title: 'Sikkerhet og nødadkomst', status: 'missing', mandatory: true },
  { id: 'neighbors', category: 'community', title: 'Naboer og støyvarsling', status: 'not_required', mandatory: false },
  { id: 'restoration', category: 'restoration', title: 'Tilbakestilling og overlevering', status: 'not_required', mandatory: false },
];

const DEFAULT_SCOUT_CHECKS: LocationManagerOperations['scoutCapture']['checks'] = [
  { id: 'access-load-in', title: 'Adkomst og load-in', status: 'unchecked' },
  { id: 'parking-unit-base', title: 'Parkering og unit base', status: 'unchecked' },
  { id: 'power', title: 'Strømkapasitet', status: 'unchecked' },
  { id: 'sound', title: 'Støy og lydforhold', status: 'unchecked' },
  { id: 'facilities', title: 'Toalett og crew-fasiliteter', status: 'unchecked' },
  { id: 'accessibility', title: 'Tilgjengelighet', status: 'unchecked' },
  { id: 'safety', title: 'Sikkerhet og nødadkomst', status: 'unchecked' },
  { id: 'light', title: 'Solretning og dagslys', status: 'unchecked' },
];

function initialGateStatus(location: Location, gateId: string): LocationClearanceGate['status'] {
  if (gateId === 'owner-permission' && location.contactInfo?.name) return 'requested';
  if (gateId === 'access-plan' && location.accessNotes?.trim()) return 'in_progress';
  if (gateId === 'technical-recce' && location.propertyAnalysis) return 'in_progress';
  return DEFAULT_GATES.find((gate) => gate.id === gateId)?.status ?? 'missing';
}

export function buildLocationManagerOperations(
  location: Location,
  project?: Pick<CastingProject, 'currency'>,
): LocationManagerOperations {
  const existing = location.locationOperations;
  const timestamp = nowIso();
  const availabilityHasData = Boolean(location.availability && Object.keys(location.availability).length > 0);
  const initial: LocationManagerOperations = {
    stage: 'need',
    decisionStatus: 'undecided',
    ownerCommunication: {
      status: location.contactInfo?.name ? 'contacted' : 'not_started',
      contactName: location.contactInfo?.name,
    },
    dateAvailability: {
      status: availabilityHasData ? 'in_progress' : 'missing',
      confirmedDates: [],
    },
    recce: {
      status: 'not_started',
      attendees: [],
    },
    clearanceGates: DEFAULT_GATES.map((gate) => ({
      ...gate,
      status: initialGateStatus(location, gate.id),
      updatedAt: timestamp,
    })),
    logistics: {
      technicalNotes: location.accessNotes || location.notes,
    },
    finance: {
      currency: project?.currency || 'NOK',
      locationFee: 0,
      permitFees: 0,
      restorationReserve: 0,
      status: 'estimate',
    },
    risks: [],
    scoutCapture: {
      conditions: {
        ambientNoise: 'unknown',
        mobileSignal: 'unknown',
        power: 'unknown',
      },
      checks: DEFAULT_SCOUT_CHECKS.map((check) => ({ ...check })),
      observations: [],
      pins: [],
    },
    nextAction: location.contactInfo?.name
      ? 'Følg opp eier og avklar tilgjengelige opptaksdatoer.'
      : 'Finn eier eller rettighetshaver og start dialogen.',
    activity: [],
  };
  if (!existing) return initial;
  return {
    ...initial,
    ...existing,
    ownerCommunication: { ...initial.ownerCommunication, ...existing.ownerCommunication },
    dateAvailability: { ...initial.dateAvailability, ...existing.dateAvailability },
    recce: { ...initial.recce, ...existing.recce },
    logistics: { ...initial.logistics, ...existing.logistics },
    finance: { ...initial.finance, ...existing.finance },
    scoutCapture: {
      ...initial.scoutCapture,
      ...existing.scoutCapture,
      conditions: {
        ...initial.scoutCapture.conditions,
        ...existing.scoutCapture?.conditions,
      },
      checks: existing.scoutCapture?.checks?.length
        ? existing.scoutCapture.checks
        : initial.scoutCapture.checks,
      observations: existing.scoutCapture?.observations ?? initial.scoutCapture.observations,
      pins: existing.scoutCapture?.pins ?? initial.scoutCapture.pins,
    },
  };
}

export function mergeLocationOperations(
  location: Location,
  operations: LocationManagerOperations,
  version: number,
  updatedAt?: string,
  updatedBy?: string,
): Location {
  return {
    ...location,
    locationOperations: operations,
    locationOperationsVersion: version,
    locationOperationsUpdatedAt: updatedAt,
    locationOperationsUpdatedBy: updatedBy,
  };
}

/** The only scout observations safe to pass on as factual analysis context. */
export function verifiedScoutEvidence(operations: LocationManagerOperations) {
  return operations.scoutCapture.observations.filter((observation) => observation.status === 'verified');
}

export interface LocationReadiness {
  score: number;
  blockers: string[];
  warnings: string[];
  verifiedGates: number;
  totalMandatoryGates: number;
  nextAction: string;
}

export function locationReadiness(operations: LocationManagerOperations): LocationReadiness {
  const mandatory = operations.clearanceGates.filter((gate) => gate.mandatory && gate.status !== 'not_required');
  const verified = mandatory.filter((gate) => gate.status === 'verified');
  const blockedGates = mandatory.filter((gate) => gate.status === 'blocked');
  const missingGates = mandatory.filter((gate) => gate.status === 'missing');
  const blockers = [
    ...blockedGates.map((gate) => `${gate.title} er blokkert`),
    ...missingGates.map((gate) => `${gate.title} mangler`),
  ];
  if (operations.ownerCommunication.status === 'declined') blockers.unshift('Eier har avslått forespørselen');
  if (operations.dateAvailability.status === 'blocked') blockers.unshift('Opptaksdatoene er blokkert');
  operations.risks
    .filter((risk) => risk.status !== 'resolved' && risk.severity === 'critical')
    .forEach((risk) => blockers.push(risk.title));

  const warnings: string[] = [];
  if (operations.decisionStatus === 'primary' && !operations.backupLocationId) warnings.push('Primærlokasjonen mangler backup');
  if (!operations.nextAction?.trim()) warnings.push('Neste handling er ikke satt');
  if (operations.recce.status === 'changes_required') warnings.push('Teknisk recce krever endringer');
  operations.risks
    .filter((risk) => risk.status !== 'resolved' && risk.severity === 'high')
    .forEach((risk) => warnings.push(risk.title));

  const ownerScore = operations.ownerCommunication.status === 'agreed' ? 15
    : ['contacted', 'awaiting_reply', 'negotiating'].includes(operations.ownerCommunication.status) ? 7 : 0;
  const dateScore = operations.dateAvailability.status === 'verified' ? 15
    : ['requested', 'in_progress'].includes(operations.dateAvailability.status) ? 7 : 0;
  const recceScore = operations.recce.status === 'completed' ? 20
    : ['scheduled', 'in_progress'].includes(operations.recce.status) ? 10 : 0;
  const gateScore = mandatory.length > 0 ? Math.round((verified.length / mandatory.length) * 30) : 30;
  const logisticsFields = Object.values(operations.logistics).filter((value) => typeof value === 'string' && value.trim()).length;
  const logisticsScore = Math.min(10, logisticsFields * 2);
  const unresolvedHighRisk = operations.risks.filter((risk) => risk.status !== 'resolved' && ['high', 'critical'].includes(risk.severity)).length;
  const riskScore = Math.max(0, 10 - unresolvedHighRisk * 5);
  const score = Math.max(0, Math.min(100, ownerScore + dateScore + recceScore + gateScore + logisticsScore + riskScore));

  const nextAction = operations.nextAction?.trim()
    || blockers[0]
    || warnings[0]
    || (score === 100 ? 'Lokasjonen er klar for opptak.' : 'Kontroller neste uferdige klareringspunkt.');
  return {
    score,
    blockers,
    warnings,
    verifiedGates: verified.length,
    totalMandatoryGates: mandatory.length,
    nextAction,
  };
}

export function portfolioReadiness(locations: Location[]) {
  const states = locations.map((location) => locationReadiness(buildLocationManagerOperations(location)));
  return {
    total: locations.length,
    shootReady: locations.filter((location) => location.locationOperations?.stage === 'shoot_ready').length,
    blocked: states.filter((state) => state.blockers.length > 0).length,
    expiringHolds: locations.filter((location) => {
      const expires = location.locationOperations?.dateAvailability.holdExpiresAt;
      if (!expires) return false;
      const difference = new Date(expires).getTime() - Date.now();
      return difference >= 0 && difference <= 72 * 60 * 60 * 1000;
    }).length,
    averageScore: states.length > 0
      ? Math.round(states.reduce((sum, state) => sum + state.score, 0) / states.length)
      : 0,
  };
}
