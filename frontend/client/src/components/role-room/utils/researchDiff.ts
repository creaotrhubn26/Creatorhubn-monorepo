/**
 * Research diff vs. previous bootstrap — item #9.
 *
 * Persists a small subset of the previous research result in localStorage
 * (per project) and computes a structured diff against the current one.
 * "Small subset" because a full bootstrap result is 50–200 kB and we
 * don't want to fill the user's localStorage quota with rerun history.
 * We keep only the fields that meaningfully change between research
 * runs: company classification, audience, competitors, social profiles,
 * local opportunities, merch suppliers, brand palette.
 *
 * No DB, no backend changes. The trade-off vs. server-side persistence:
 *   - works offline / before backend rollout
 *   - per-browser (won't follow user to another device)
 *   - falls back to "first research" silently if localStorage breaks
 * Server-side diff would replace this with a `role_room_research_snapshots`
 * table; the diff structure (this file's output) would stay the same.
 */

import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

const SNAPSHOT_KEY_PREFIX = 'roleRoom.researchSnapshot.';

/** Lightweight projection of the bootstrap result. Anything we don't
 *  need for diffing is dropped — keeps the localStorage payload small
 *  and avoids "stale references to long strings" eating quota. */
interface ResearchSnapshot {
  researchId: string | null;
  capturedAt: string;
  industry: string;
  subIndustry: string;
  businessModel: string;
  targetAudience: string[];
  tone: string[];
  competitorNames: string[];
  socialProfileUrls: string[];
  localOpportunityNames: string[];
  merchSupplierNames: string[];
  brandColors: string[];
}

function toSnapshot(result: RoleRoomAgentProducerBootstrapResult): ResearchSnapshot {
  return {
    researchId: result.researchId ?? null,
    capturedAt: result.bootstrapFinishedAt ?? result.generatedAt ?? new Date().toISOString(),
    industry: result.companyProfile?.industry ?? '',
    subIndustry: result.companyProfile?.subIndustry ?? '',
    businessModel: result.companyProfile?.businessModel ?? '',
    targetAudience: result.companyProfile?.targetAudience ?? [],
    tone: result.companyProfile?.toneAndBrandSignals ?? [],
    competitorNames: (result.competitorAnalysis?.competitors ?? [])
      .map((c) => c.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
    socialProfileUrls: (result.socialProfileCandidates ?? [])
      .filter((c) => c.status !== 'rejected')
      .map((c) => c.canonicalUrl || c.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0),
    localOpportunityNames: (result.localPresencePlan?.nearbyOpportunities ?? [])
      .map((o) => o.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
    merchSupplierNames: (result.merchSuppliers?.suppliers ?? [])
      .map((s) => s.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
    brandColors: (result.planningDraft?.brandGuide?.colors ?? [])
      .map((c) => c.hex)
      .filter((hex): hex is string => typeof hex === 'string' && hex.length > 0),
  };
}

interface StringFieldChange {
  from: string;
  to: string;
}

interface ListFieldDiff {
  added: string[];
  removed: string[];
  unchanged: number;
}

export interface ResearchDiff {
  /** No previous snapshot existed for this project. */
  isFirst: boolean;
  /** Same researchId — user reopened an existing result, nothing new
   *  to compare. UI hides the diff section in this case. */
  isSameResearch: boolean;
  /** ISO timestamp of the previous research run. */
  previousCapturedAt: string | null;
  /** A scalar field is "changed" when the trimmed string differs. */
  industry: StringFieldChange | null;
  subIndustry: StringFieldChange | null;
  businessModel: StringFieldChange | null;
  targetAudience: ListFieldDiff;
  tone: ListFieldDiff;
  competitors: ListFieldDiff;
  socialProfiles: ListFieldDiff;
  localOpportunities: ListFieldDiff;
  merchSuppliers: ListFieldDiff;
  brandColors: ListFieldDiff;
  /** True if NO field has any change — UI can render "Identisk med
   *  forrige research" instead of empty diff sections. */
  hasAnyChange: boolean;
}

function emptyListDiff(): ListFieldDiff {
  return { added: [], removed: [], unchanged: 0 };
}

function diffLists(previous: string[], current: string[]): ListFieldDiff {
  const prevSet = new Set(previous.map((v) => v.trim().toLowerCase()).filter(Boolean));
  const currSet = new Set(current.map((v) => v.trim().toLowerCase()).filter(Boolean));
  // Walk current values to find added; keep the original casing.
  const added = current.filter((v) => !prevSet.has(v.trim().toLowerCase()));
  const removed = previous.filter((v) => !currSet.has(v.trim().toLowerCase()));
  // unchanged: members present in both sets
  let unchanged = 0;
  for (const v of currSet) if (prevSet.has(v)) unchanged += 1;
  return { added, removed, unchanged };
}

function diffStringField(previous: string, current: string): StringFieldChange | null {
  const a = (previous || '').trim();
  const b = (current || '').trim();
  if (!a && !b) return null;
  if (a.toLowerCase() === b.toLowerCase()) return null;
  return { from: a || '(tom)', to: b || '(tom)' };
}

/** Returns the previous snapshot for the project, or null. Tolerates
 *  legacy/malformed payloads — returns null instead of throwing. */
function loadSnapshot(projectId: string): ResearchSnapshot | null {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_KEY_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ResearchSnapshot;
  } catch {
    return null;
  }
}

/** Persists the snapshot for this project, overwriting any prior. Only
 *  the most recent result is kept — older history would need a real DB. */
export function saveResearchSnapshot(
  projectId: string | null | undefined,
  result: RoleRoomAgentProducerBootstrapResult | null,
): void {
  if (!projectId || !result) return;
  try {
    const snap = toSnapshot(result);
    localStorage.setItem(`${SNAPSHOT_KEY_PREFIX}${projectId}`, JSON.stringify(snap));
  } catch {
    // quota exceeded or storage disabled — silent skip
  }
}

/** Computes the diff. Returns isFirst=true the very first time we see
 *  a result for the project. Save BEFORE rendering the next overlay
 *  by calling saveResearchSnapshot. The overlay calls compute first
 *  (so the diff reflects the previous run) THEN saves the current
 *  result for the next diff. */
export function computeResearchDiff(
  projectId: string | null | undefined,
  result: RoleRoomAgentProducerBootstrapResult | null,
): ResearchDiff | null {
  if (!projectId || !result) return null;
  const previous = loadSnapshot(projectId);
  const current = toSnapshot(result);
  if (!previous) {
    return {
      isFirst: true,
      isSameResearch: false,
      previousCapturedAt: null,
      industry: null,
      subIndustry: null,
      businessModel: null,
      targetAudience: emptyListDiff(),
      tone: emptyListDiff(),
      competitors: emptyListDiff(),
      socialProfiles: emptyListDiff(),
      localOpportunities: emptyListDiff(),
      merchSuppliers: emptyListDiff(),
      brandColors: emptyListDiff(),
      hasAnyChange: false,
    };
  }
  if (previous.researchId && previous.researchId === current.researchId) {
    return {
      isFirst: false,
      isSameResearch: true,
      previousCapturedAt: previous.capturedAt,
      industry: null,
      subIndustry: null,
      businessModel: null,
      targetAudience: emptyListDiff(),
      tone: emptyListDiff(),
      competitors: emptyListDiff(),
      socialProfiles: emptyListDiff(),
      localOpportunities: emptyListDiff(),
      merchSuppliers: emptyListDiff(),
      brandColors: emptyListDiff(),
      hasAnyChange: false,
    };
  }
  const industry = diffStringField(previous.industry, current.industry);
  const subIndustry = diffStringField(previous.subIndustry, current.subIndustry);
  const businessModel = diffStringField(previous.businessModel, current.businessModel);
  const targetAudience = diffLists(previous.targetAudience, current.targetAudience);
  const tone = diffLists(previous.tone, current.tone);
  const competitors = diffLists(previous.competitorNames, current.competitorNames);
  const socialProfiles = diffLists(previous.socialProfileUrls, current.socialProfileUrls);
  const localOpportunities = diffLists(previous.localOpportunityNames, current.localOpportunityNames);
  const merchSuppliers = diffLists(previous.merchSupplierNames, current.merchSupplierNames);
  const brandColors = diffLists(previous.brandColors, current.brandColors);

  const hasAnyChange = Boolean(
    industry
      || subIndustry
      || businessModel
      || targetAudience.added.length || targetAudience.removed.length
      || tone.added.length || tone.removed.length
      || competitors.added.length || competitors.removed.length
      || socialProfiles.added.length || socialProfiles.removed.length
      || localOpportunities.added.length || localOpportunities.removed.length
      || merchSuppliers.added.length || merchSuppliers.removed.length
      || brandColors.added.length || brandColors.removed.length,
  );

  return {
    isFirst: false,
    isSameResearch: false,
    previousCapturedAt: previous.capturedAt,
    industry,
    subIndustry,
    businessModel,
    targetAudience,
    tone,
    competitors,
    socialProfiles,
    localOpportunities,
    merchSuppliers,
    brandColors,
    hasAnyChange,
  };
}
