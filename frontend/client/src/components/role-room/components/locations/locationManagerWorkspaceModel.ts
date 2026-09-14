import type {
  CastingProject,
  Location,
  LocationClearanceGate,
  LocationDecisionCriterion,
  LocationDecisionSignoff,
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

export const DEFAULT_DECISION_CRITERIA: ReadonlyArray<Omit<LocationDecisionCriterion, 'mediaIds'>> = [
  { id: 'creative_fit', label: 'Kreativ og dramaturgisk match', required: true, status: 'unknown' },
  { id: 'camera_light', label: 'Kamera og lys', required: true, status: 'unknown' },
  { id: 'sound', label: 'Lydforhold', required: true, status: 'unknown' },
  { id: 'access_logistics', label: 'Adkomst og logistikk', required: true, status: 'unknown' },
  { id: 'owner_permits', label: 'Eier og tillatelser', required: true, status: 'unknown' },
  { id: 'safety', label: 'Sikkerhet', required: true, status: 'unknown' },
  { id: 'schedule', label: 'Dato og opptaksplan', required: true, status: 'unknown' },
  { id: 'budget', label: 'Budsjett', required: true, status: 'unknown' },
];

export const DEFAULT_DECISION_SIGNOFFS: ReadonlyArray<LocationDecisionSignoff> = [
  { role: 'director', status: 'pending' },
  { role: 'cinematographer', status: 'pending' },
  { role: 'producer', status: 'pending' },
];

function buildDecisionCriteria(existing?: LocationDecisionCriterion[]): LocationDecisionCriterion[] {
  const existingById = new Map((existing ?? []).map((criterion) => [criterion.id, criterion]));
  return DEFAULT_DECISION_CRITERIA.map((criterion) => ({
    ...criterion,
    ...existingById.get(criterion.id),
    label: criterion.label,
    required: criterion.required,
    mediaIds: existingById.get(criterion.id)?.mediaIds ?? [],
  }));
}

function buildDecisionSignoffs(existing?: LocationDecisionSignoff[]): LocationDecisionSignoff[] {
  const existingByRole = new Map((existing ?? []).map((signoff) => [signoff.role, signoff]));
  return DEFAULT_DECISION_SIGNOFFS.map((signoff) => ({ ...signoff, ...existingByRole.get(signoff.role) }));
}

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
    decisionReview: {
      criteria: buildDecisionCriteria(),
      signoffs: buildDecisionSignoffs(),
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
    decisionReview: {
      ...initial.decisionReview,
      ...existing.decisionReview,
      criteria: buildDecisionCriteria(existing.decisionReview?.criteria),
      signoffs: buildDecisionSignoffs(existing.decisionReview?.signoffs),
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

  // This is workflow completion, not a prediction of whether the location is
  // suitable. Only explicitly verified terminal states count; entered text,
  // scheduled work and an empty risk register never create positive points.
  const completionChecks = [
    operations.ownerCommunication.status === 'agreed',
    operations.dateAvailability.status === 'verified',
    operations.recce.status === 'completed',
    ...mandatory.map((gate) => gate.status === 'verified'),
  ];
  const score = completionChecks.length > 0
    ? Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)
    : 0;

  const nextAction = operations.nextAction?.trim()
    || blockers[0]
    || warnings[0]
    || (score === 100 ? 'Alle registrerte arbeidssteg er eksplisitt verifisert.' : 'Kontroller neste uferdige klareringspunkt.');
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

export interface LocationDecisionSummary {
  evidenceScore: number;
  verifiedCriteria: number;
  totalRequiredCriteria: number;
  blockers: string[];
  lockReasons: string[];
  approvals: number;
  requiredApprovals: number;
  explicitCost: number;
  locked: boolean;
  canLock: boolean;
}

const hasDecisionEvidence = (criterion: LocationDecisionCriterion): boolean =>
  Boolean(criterion.evidence?.trim()) || criterion.mediaIds.length > 0;

/**
 * Conservative decision state. It never infers a pass from free text, uploaded media,
 * address analysis or a partly completed workflow; only an explicit result with an
 * attached evidence reference counts.
 */
export function locationDecisionSummary(operations: LocationManagerOperations): LocationDecisionSummary {
  const requiredCriteria = operations.decisionReview.criteria.filter((criterion) => criterion.required);
  const verifiedCriteria = requiredCriteria.filter((criterion) => (
    criterion.status !== 'unknown'
    && criterion.status !== 'not_applicable'
    && hasDecisionEvidence(criterion)
  ));
  const passedCriteria = requiredCriteria.filter((criterion) => criterion.status === 'pass' && hasDecisionEvidence(criterion));
  const evidenceScore = requiredCriteria.length > 0
    ? Math.round((passedCriteria.length / requiredCriteria.length) * 100)
    : 0;

  const blockers: string[] = [];
  requiredCriteria
    .filter((criterion) => criterion.status === 'blocker')
    .forEach((criterion) => blockers.push(`${criterion.label} er blokkert`));
  operations.clearanceGates
    .filter((gate) => gate.mandatory && gate.status === 'blocked')
    .forEach((gate) => blockers.push(`${gate.title} er blokkert`));
  if (operations.ownerCommunication.status === 'declined') blockers.push('Eier har avslått forespørselen');
  if (operations.dateAvailability.status === 'blocked') blockers.push('Opptaksdatoene er blokkert');
  operations.risks
    .filter((risk) => risk.status !== 'resolved' && risk.severity === 'critical')
    .forEach((risk) => blockers.push(risk.title));

  const lockReasons: string[] = [];
  requiredCriteria.forEach((criterion) => {
    if (criterion.status !== 'pass') lockReasons.push(`${criterion.label} er ikke godkjent`);
    else if (!hasDecisionEvidence(criterion)) lockReasons.push(`${criterion.label} mangler evidens`);
  });
  operations.clearanceGates
    .filter((gate) => gate.mandatory && gate.status !== 'verified')
    .forEach((gate) => lockReasons.push(`${gate.title} er ikke verifisert`));
  if (operations.ownerCommunication.status !== 'agreed') lockReasons.push('Eieravtalen er ikke bekreftet');
  if (operations.dateAvailability.status !== 'verified' || operations.dateAvailability.confirmedDates.length === 0) {
    lockReasons.push('Opptaksdato er ikke verifisert');
  }
  if (operations.recce.status !== 'completed') lockReasons.push('Teknisk recce er ikke godkjent');
  if (!['approved', 'settled'].includes(operations.finance.status)) lockReasons.push('Lokasjonskostnaden er ikke godkjent');
  if (!operations.backupLocationId) lockReasons.push('Backup-lokasjon er ikke valgt');
  const requiredApprovals = operations.decisionReview.signoffs.length;
  const approvals = operations.decisionReview.signoffs.filter((signoff) => signoff.status === 'approved').length;
  operations.decisionReview.signoffs
    .filter((signoff) => signoff.status !== 'approved')
    .forEach((signoff) => lockReasons.push(`${signoff.role} har ikke godkjent`));
  blockers.forEach((blocker) => lockReasons.push(blocker));

  const uniqueLockReasons = [...new Set(lockReasons)];
  return {
    evidenceScore,
    verifiedCriteria: verifiedCriteria.length,
    totalRequiredCriteria: requiredCriteria.length,
    blockers: [...new Set(blockers)],
    lockReasons: uniqueLockReasons,
    approvals,
    requiredApprovals,
    explicitCost: operations.finance.locationFee + operations.finance.permitFees + operations.finance.restorationReserve,
    locked: Boolean(operations.decisionReview.lockedAt),
    canLock: uniqueLockReasons.length === 0 && !operations.decisionReview.lockedAt,
  };
}
