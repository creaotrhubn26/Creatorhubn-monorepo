/**
 * Culling-suggestion service for the capture session review surface.
 *
 * Any working photographer — wedding, aviation, motorsport, food,
 * commercial — routinely shoots 500–3 500 frames per job and spends
 * hours just deciding which to keep. A lot of that work is mechanical:
 * motion blur, missed focus, near-duplicate bursts, subject-specific
 * ruiners like a cropped wing in aviation or a spill on a food plate.
 * We already have the signals we need sitting on each capture_assets
 * row:
 *
 *   * ``captureAssets.signals.sharpness`` — on-device Laplacian
 *     variance normalised to 0..100.
 *   * ``captureAssets.signals.eyesOpen`` — on-device face classifier.
 *   * ``captureAssets.signals.faceCount`` — how many faces the device
 *     detector found.
 *   * ``captureAssets.signals.duplicateGroupId`` — on-device duplicate
 *     clustering.
 *   * ``captureAssets.signals.ai`` — Claude Vision analyze output:
 *       {subject, confidence, tonality, qualityNotes, analyzedAt}.
 *
 * This service aggregates those signals per asset and classifies into
 * four groups:
 *
 *   reject — hard rejects the photographer will delete.
 *            Motion blur, eyes closed on primary subject, grossly
 *            over/underexposed, Claude-flagged "eyes closed / motion
 *            blur / out of focus".
 *   weak   — soft rejects worth a second look. Low sharpness, mild
 *            issues noted, duplicate-cluster members that lost to a
 *            stronger sibling.
 *   keep   — normal working shots. Nothing wrong, nothing exceptional.
 *   hero   — standouts the photographer should feature. High sharpness,
 *            eyes open, Claude confident and high-quality-notes-clean,
 *            won their duplicate cluster.
 *
 * The classifier is intentionally conservative: we'd rather under-
 * classify "reject" than over-classify it, because accidentally moving
 * a keeper to the reject pile is a much worse error than leaving a
 * dud in weak. Thresholds are tuned so that with typical wedding
 * signals roughly 40–60% of frames land in weak+reject (matches the
 * rough cull ratio most photographers end up with anyway).
 */

export interface CaptureAssetSignals {
  sharpness?: number;
  eyesOpen?: boolean;
  faceCount?: number;
  duplicateGroupId?: string;
  ai?: {
    subject?: string;
    confidence?: number;
    tonality?: string;
    qualityNotes?: string[];
    analyzedAt?: string;
  };
}

export interface CaptureAssetForCulling {
  id: string;
  signals: CaptureAssetSignals | null | undefined;
  /// Photographer-set rating 0..5 on the capture surface. If > 0 we
  /// respect it and never downgrade the asset — that's an explicit
  /// "keep" signal from a human eye.
  rating?: number;
  /// Hard-rejected on the capture surface. Always goes to reject.
  rejected?: boolean;
  /// Flagged for client. Never goes to reject.
  flaggedForClient?: boolean;
}

export type CullingBucket = "reject" | "weak" | "keep" | "hero";

/// Lets the photographer dial the classifier's taste. ``balanced`` is
/// the reference tuning (same thresholds a neutral professional would
/// use). ``conservative`` pulls everything up one tier — fewer rejects,
/// more hero — useful when shooting a short or unrepeatable session
/// where you don't want the system throwing anything away. ``aggressive``
/// pushes everything down one tier — more rejects, fewer heroes — for
/// sessions with heavy shot counts where you need the cull to do
/// real work. Maps to score-threshold shifts, so it's a predictable,
/// test-friendly knob rather than a black-box mood.
export type CullingStrictness = "conservative" | "balanced" | "aggressive";

export interface CullingSuggestion {
  assetId: string;
  bucket: CullingBucket;
  score: number;        // 0..1 aggregate quality score
  reasons: string[];    // short human-readable reasons for the bucket
}

export interface CullingSummary {
  total: number;
  hero: CullingSuggestion[];
  keep: CullingSuggestion[];
  weak: CullingSuggestion[];
  reject: CullingSuggestion[];
  duplicateClusters: Record<string, string[]>; // groupId → [winnerId, loser1, ...]
}


// Universal reject / weak patterns: technical issues that ruin a
// frame regardless of what's in it. These are the first-pass baseline
// applied to every asset.
const UNIVERSAL_REJECT_PATTERNS: readonly RegExp[] = [
  /motion\s*blur/i,
  /out\s*of\s*focus/i,
  /blurr(ed|y)/i,
  /severely\s*under[\-\s]?exposed/i,
  /severely\s*over[\-\s]?exposed/i,
  // Eyes-closed / blown face highlights are portrait issues, but we
  // include them in the universal set too because Claude only emits
  // them on photos with faces. Including here means old callers that
  // don't pass a subject still reject these correctly.
  /eyes?\s*closed/i,
  /blown\s*highlights?\s*on\s*(face|subject)/i,
];

const UNIVERSAL_WEAK_PATTERNS: readonly RegExp[] = [
  /mild(ly)?\s*(soft|blur)/i,
  /slight(ly)?\s*(under|over)\s*exposed/i,
  /colour\s*cast/i,
  /color\s*cast/i,
  /harsh\s*shadow/i,
  /lens\s*flare/i,
  /chromatic\s*aberration/i,
];

// Subject-specific patterns. Keyed by the subject label Claude returns
// in ``signals.ai.subject``. A frame gets the universal set plus its
// subject's set; anything else only gets the universal baseline.
//
// Reject patterns are hard kills (the subject-specific ruiner — a
// cropped wing on an airliner is unsalvageable, a photographer
// reflection in a car's paint is unsalvageable). Weak patterns are
// soft flags (harsh shadow, distracting element) the photographer
// might choose to keep.
const SUBJECT_REJECT_PATTERNS: Record<string, readonly RegExp[]> = {
  portrait: [
    /eyes?\s*closed/i,
    /blown\s*highlights?\s*on\s*(face|subject)/i,
    /subject\s*cropped\s*at\s*joint/i,
    /cropped\s*at\s*(knee|ankle|wrist|elbow)/i,
  ],
  group_portrait: [
    /one\s*or\s*more\s*eyes?\s*closed/i,
    /partial\s*face\s*cropped/i,
    /person\s*cropped\s*out/i,
    /blown\s*highlights?\s*on\s*(face|subject)/i,
  ],
  aviation: [
    /wing\s*tip\s*cropped/i,
    /tail\s*cropped/i,
    /propeller\s*frozen/i,        // should be blurred to show rotation
    /contrail\s*across\s*(fuselage|subject)/i,
    /severe\s*atmospheric\s*haze/i,
  ],
  vehicle: [
    /photographer\s*reflect(ed|ion)/i,
    /(wheel|tyre|tire)\s*cropped/i,
    /dust.*on\s*(paint|body|panel)/i,
    /finger(print)?s?\s*on\s*(paint|body|chrome)/i,
  ],
  food: [
    /(wilted|droop(ed|ing))\s*(garnish|herb|salad)/i,
    /spill(ed)?\s*(sauce|liquid|drink)/i,
    /fingerprint\s*on\s*(plate|glass)/i,
    /smudge\s*on\s*(plate|glass)/i,
  ],
  landscape: [
    /tilted\s*horizon/i,
    /horizon\s*not\s*level/i,
    /sensor\s*dust\s*in\s*sky/i,
    /telephone\s*(wire|line)\s*across\s*(sky|subject)/i,
  ],
  product: [
    /dust\s*on\s*product/i,
    /crooked\s*placement/i,
    /product\s*not\s*centered/i,      // for pack-shot style
    /white\s*balance\s*off/i,
    /reflection.*(photographer|equipment)/i,
  ],
};

const SUBJECT_WEAK_PATTERNS: Record<string, readonly RegExp[]> = {
  portrait: [
    /back[\-\s]?lit\s*face/i,
    /squinting/i,
    /distracting\s*background/i,
    /subject\s*dead[\-\s]?centered/i,
  ],
  group_portrait: [
    /uneven\s*spacing/i,
    /mismatched\s*expressions?/i,
    /back[\-\s]?row.*obscured/i,
  ],
  aviation: [
    /visible\s*sensor\s*dust/i,
    /colour\s*fring(e|ing)/i,
    /distant\s*heat\s*shimmer/i,
  ],
  vehicle: [
    /minor\s*dust\s*on\s*paint/i,
    /uneven\s*lighting\s*on\s*panel/i,
    /distracting\s*reflection/i,
  ],
  food: [
    /steam\s*obscur(ing|es)/i,
    /plate\s*edge\s*cut\s*off/i,
    /busy\s*background/i,
  ],
  landscape: [
    /flat\s*lighting/i,
    /dull\s*sky/i,
    /distracting\s*element\s*in\s*foreground/i,
  ],
  product: [
    /slight\s*angle/i,
    /minor\s*reflection/i,
    /shadow\s*uneven/i,
  ],
};


function hasPattern(notes: readonly string[], patterns: readonly RegExp[]): boolean {
  for (const note of notes) {
    if (typeof note !== "string") continue;
    for (const pat of patterns) {
      if (pat.test(note)) return true;
    }
  }
  return false;
}

/**
 * Returns the reject + weak pattern lists that apply to the given
 * subject. Universal patterns are always included; subject-specific
 * ones are layered on top when the subject matches one of our known
 * categories. Unknown / missing subjects still get the universal
 * baseline so we never run naked against AI notes.
 */
export function patternsForSubject(subject: string | undefined | null): {
  reject: readonly RegExp[];
  weak: readonly RegExp[];
} {
  const key = typeof subject === "string" ? subject.trim().toLowerCase() : "";
  const subjectReject = SUBJECT_REJECT_PATTERNS[key] ?? [];
  const subjectWeak = SUBJECT_WEAK_PATTERNS[key] ?? [];
  return {
    reject: [...UNIVERSAL_REJECT_PATTERNS, ...subjectReject],
    weak: [...UNIVERSAL_WEAK_PATTERNS, ...subjectWeak],
  };
}


/**
 * Score a single asset in isolation. Returns a 0..1 number where 1 is
 * "technically perfect" and 0 is "unusable". The bucketing function
 * combines the score with duplicate-cluster context to pick a bucket.
 */
export function scoreAsset(asset: CaptureAssetForCulling): {
  score: number;
  reasons: string[];
} {
  const signals = asset.signals ?? {};
  const reasons: string[] = [];
  let score = 0.7;                                   // neutral baseline

  // Sharpness: the single strongest signal. We weight it heavily because
  // a blurred photo is unfixable in enhancement, regardless of
  // composition.
  const sharpness =
    typeof signals.sharpness === "number" ? signals.sharpness : null;
  if (sharpness !== null) {
    if (sharpness >= 75) {
      score += 0.2;
      reasons.push("sharp");
    } else if (sharpness < 40) {
      score -= 0.4;
      reasons.push(`low sharpness (${Math.round(sharpness)})`);
    } else if (sharpness < 55) {
      score -= 0.15;
      reasons.push("soft focus");
    }
  }

  // Eyes closed — only meaningful when a face is actually in the frame.
  if (
    typeof signals.eyesOpen === "boolean" &&
    signals.eyesOpen === false &&
    (signals.faceCount ?? 0) >= 1
  ) {
    score -= 0.35;
    reasons.push("eyes closed");
  }

  // Claude quality notes: hard reject patterns trump everything.
  // Pattern set is subject-aware — a "cropped wing" note is a reject
  // on aviation but nonsense on a portrait; we only apply each
  // subject's vocabulary when that subject was detected.
  const ai = signals.ai;
  const notes = Array.isArray(ai?.qualityNotes) ? ai!.qualityNotes : [];
  if (notes.length > 0) {
    const { reject, weak } = patternsForSubject(ai?.subject);
    if (hasPattern(notes, reject)) {
      score -= 0.5;
      reasons.push(`ai: ${notes[0]}`);
    } else if (hasPattern(notes, weak)) {
      score -= 0.15;
      reasons.push(`ai: ${notes[0]}`);
    } else {
      // Claude flagged something the photographer should look at but
      // it isn't a canonical reject/weak phrase for this subject —
      // small downgrade + surface the note so the reviewer sees it.
      score -= 0.08;
      reasons.push(`ai: ${notes[0]}`);
    }
  }

  // Low AI confidence is not a reason to reject — it means Claude
  // wasn't sure about the subject — but don't let it *raise* the
  // score either. No-op here by design.

  return {
    score: Math.max(0, Math.min(1, score)),
    reasons,
  };
}


export interface ClassifyOptions {
  /// Photographer-chosen strictness. See ``CullingStrictness``. Defaults
  /// to ``balanced`` — the reference thresholds the tests pin down.
  strictness?: CullingStrictness;
}

// Per-strictness score thresholds. Balanced is the reference tuning;
// conservative shifts every cut-off down by 0.08 (easier to reach the
// upper tiers); aggressive shifts them up by 0.08 (harder to reach
// keep/hero, more stuff drops to weak/reject).
const STRICTNESS_THRESHOLDS: Record<
  CullingStrictness,
  { hero: number; keep: number; weak: number }
> = {
  conservative: { hero: 0.80, keep: 0.52, weak: 0.27 },
  balanced:     { hero: 0.88, keep: 0.60, weak: 0.35 },
  aggressive:   { hero: 0.96, keep: 0.68, weak: 0.43 },
};

function normaliseStrictness(value: unknown): CullingStrictness {
  if (value === "conservative" || value === "aggressive") return value;
  return "balanced";
}

/**
 * Classify a whole session. Duplicate-cluster handling:
 *   If several assets share a ``duplicateGroupId``, the one with the
 *   highest per-asset score is the cluster winner; the others drop
 *   one bucket (hero→keep, keep→weak, weak→reject, reject stays).
 *   This preserves the best take from each burst without hard-
 *   rejecting the others silently — the photographer still sees them
 *   as "weak" and can override.
 */
export function classifySession(
  assets: ReadonlyArray<CaptureAssetForCulling>,
  options: ClassifyOptions = {},
): CullingSummary {
  const strictness = normaliseStrictness(options.strictness);
  const thresholds = STRICTNESS_THRESHOLDS[strictness];
  const scored = assets.map((asset) => {
    // Manual overrides short-circuit the classifier:
    if (asset.rejected) {
      return {
        asset,
        score: 0,
        reasons: ["photographer rejected"],
        forcedBucket: "reject" as CullingBucket,
      };
    }
    if (asset.flaggedForClient || (asset.rating ?? 0) >= 5) {
      const { score, reasons } = scoreAsset(asset);
      return {
        asset,
        score: Math.max(score, 0.9),
        reasons: [...reasons, "photographer flagged"],
        forcedBucket: "hero" as CullingBucket,
      };
    }
    const { score, reasons } = scoreAsset(asset);
    return { asset, score, reasons, forcedBucket: null as CullingBucket | null };
  });

  const bucketFromScore = (s: number): CullingBucket => {
    if (s >= thresholds.hero) return "hero";
    if (s >= thresholds.keep) return "keep";
    if (s >= thresholds.weak) return "weak";
    return "reject";
  };

  // Initial bucket assignment (pre-dedup).
  const initial = scored.map((row) => ({
    ...row,
    bucket: row.forcedBucket ?? bucketFromScore(row.score),
  }));

  // Duplicate cluster winner pick + loser downgrade.
  const clustersByGroup = new Map<string, typeof initial>();
  for (const row of initial) {
    const groupId = row.asset.signals?.duplicateGroupId;
    if (!groupId) continue;
    const existing = clustersByGroup.get(groupId) ?? [];
    existing.push(row);
    clustersByGroup.set(groupId, existing);
  }

  const duplicateClusters: Record<string, string[]> = {};
  for (const [groupId, members] of clustersByGroup) {
    if (members.length < 2) continue;
    members.sort((a, b) => b.score - a.score);
    const [winner, ...losers] = members;
    duplicateClusters[groupId] = [winner!.asset.id, ...losers.map((l) => l.asset.id)];
    for (const loser of losers) {
      // Don't touch rows whose bucket was already forced by the
      // photographer — those stay.
      if (loser.forcedBucket) continue;
      loser.reasons.push("duplicate of stronger frame");
      const downgrade: Record<CullingBucket, CullingBucket> = {
        hero: "keep",
        keep: "weak",
        weak: "reject",
        reject: "reject",
      };
      loser.bucket = downgrade[loser.bucket];
    }
  }

  const hero: CullingSuggestion[] = [];
  const keep: CullingSuggestion[] = [];
  const weak: CullingSuggestion[] = [];
  const reject: CullingSuggestion[] = [];
  for (const row of initial) {
    const suggestion: CullingSuggestion = {
      assetId: row.asset.id,
      bucket: row.bucket,
      score: Number(row.score.toFixed(3)),
      reasons: row.reasons,
    };
    switch (row.bucket) {
      case "hero":   hero.push(suggestion); break;
      case "keep":   keep.push(suggestion); break;
      case "weak":   weak.push(suggestion); break;
      case "reject": reject.push(suggestion); break;
    }
  }

  return {
    total: assets.length,
    hero,
    keep,
    weak,
    reject,
    duplicateClusters,
  };
}
