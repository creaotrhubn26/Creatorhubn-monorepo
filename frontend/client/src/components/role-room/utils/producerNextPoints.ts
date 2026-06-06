/**
 * producerNextPoints.ts — rene derive-funksjoner for «neste punkter med tall»-
 * modalene. Tallene kommer fra ekte data (producer delivery manifest), aldri
 * gjetting. Testbare uten React.
 */

export type NextPointTone = 'action' | 'waiting' | 'done' | 'info';

export interface NextPoint {
  key: string;
  count: number | null; // null = ikke et tall (en melding)
  label: string;
  tone: NextPointTone;
}

export interface NextPointsResult {
  openCount: number;
  points: NextPoint[];
}

// ── Content Logic ──────────────────────────────────────────────────────────
export interface ContentLogicInput {
  objective?: string;
  audience?: string;
  hook?: string;
  coreMessage?: string;
  callToAction?: string;
  distributionPlan?: string;
  proofPoints?: string[];
  successSignals?: string[];
}

const CONTENT_LOGIC_FIELDS: Array<{ key: keyof ContentLogicInput; label: string }> = [
  { key: 'objective', label: 'mål' },
  { key: 'audience', label: 'publikum' },
  { key: 'hook', label: 'hook' },
  { key: 'coreMessage', label: 'kjernebudskap' },
  { key: 'callToAction', label: 'call to action' },
  { key: 'distributionPlan', label: 'distribusjonsplan' },
];

/**
 * Samlet sjekkliste for Content Logic: hvilke kjernefelt som mangler + om
 * proof points / success signals er lagt inn.
 */
export function deriveContentLogicPoints(input: ContentLogicInput | null | undefined): NextPointsResult {
  const c = input ?? {};
  const missing = CONTENT_LOGIC_FIELDS.filter(({ key }) => {
    const v = c[key];
    return !(typeof v === 'string' && v.trim().length > 0);
  });
  const proofCount = Array.isArray(c.proofPoints) ? c.proofPoints.filter((p) => p && p.trim()).length : 0;
  const signalCount = Array.isArray(c.successSignals) ? c.successSignals.filter((p) => p && p.trim()).length : 0;

  const points: NextPoint[] = [];
  if (missing.length > 0) {
    points.push({ key: 'missing-fields', count: missing.length, label: `kjernefelt mangler (${missing.map((m) => m.label).join(', ')})`, tone: 'action' });
  }
  points.push(proofCount > 0
    ? { key: 'proof', count: proofCount, label: 'proof points lagt inn', tone: 'done' }
    : { key: 'proof', count: null, label: 'Ingen proof points lagt inn ennå', tone: 'action' });
  points.push(signalCount > 0
    ? { key: 'signals', count: signalCount, label: 'success signals definert', tone: 'done' }
    : { key: 'signals', count: null, label: 'Ingen success signals definert ennå', tone: 'action' });

  if (missing.length === 0 && proofCount > 0 && signalCount > 0) {
    return { openCount: 0, points: [{ key: 'complete', count: null, label: 'Content Logic er komplett', tone: 'done' }] };
  }
  const openCount = missing.length + (proofCount === 0 ? 1 : 0) + (signalCount === 0 ? 1 : 0);
  return { openCount, points };
}

// ── Konto-/social-tilgang ────────────────────────────────────────────────────
export interface AccountAccessInput {
  requiredPlatformCount?: number;
  connectedCount?: number;
  clientActionCount?: number;
  inviteSentCount?: number;
}

/**
 * Tilgangspunkter fra konto-tilgang-sammendraget: hvor mange kontoer mangler
 * tilgang, venter på klient, eller har invitasjon sendt.
 */
export function deriveAccessPoints(input: AccountAccessInput | null | undefined): NextPointsResult {
  const a = input ?? {};
  const required = Math.max(0, a.requiredPlatformCount ?? 0);
  const connected = Math.max(0, a.connectedCount ?? 0);
  const clientAction = Math.max(0, a.clientActionCount ?? 0);
  const inviteSent = Math.max(0, a.inviteSentCount ?? 0);
  const missing = Math.max(0, required - connected);

  const points: NextPoint[] = [];
  if (required === 0) {
    return { openCount: 0, points: [{ key: 'none-required', count: null, label: 'Ingen kontoer krever tilgang for dette prosjektet', tone: 'info' }] };
  }
  if (clientAction > 0) {
    points.push({ key: 'client-action', count: clientAction, label: 'kontoer venter på at klienten gir tilgang', tone: 'waiting' });
  }
  if (inviteSent > 0) {
    points.push({ key: 'invite-sent', count: inviteSent, label: 'invitasjoner sendt (venter på svar)', tone: 'waiting' });
  }
  if (missing > 0) {
    points.push({ key: 'missing', count: missing, label: 'kontoer mangler tilgang', tone: 'action' });
  }
  points.push({ key: 'connected', count: connected, label: `av ${required} kontoer er tilkoblet`, tone: connected >= required ? 'done' : 'info' });

  if (missing === 0 && clientAction === 0 && inviteSent === 0) {
    return { openCount: 0, points: [{ key: 'all-connected', count: connected, label: `Alle ${required} kontoer har tilgang`, tone: 'done' }] };
  }
  return { openCount: missing, points };
}
