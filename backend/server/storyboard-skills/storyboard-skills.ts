import crypto from 'node:crypto';
import { z } from 'zod';
import {
  STORYBOARD_SKILL_DEFINITIONS,
  STORYBOARD_SKILL_IDS,
  storyboardSkillDefinition,
  type StoryboardSkillAlternative,
  type StoryboardSkillChange,
  type StoryboardSkillContext,
  type StoryboardSkillEvidence,
  type StoryboardSkillFrame,
  type StoryboardSkillFramePatch,
  type StoryboardSkillId,
  type StoryboardSkillResult,
} from '../../../frontend/shared/storyboard-skills.js';
import type { AIAgent, AIAgentInput } from '../ai-suggestion-service.js';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional();

const framePatchSchema = z.object({
  description: optionalText(2_000),
  notes: optionalText(2_000),
  shotType: optionalText(120),
  cameraAngle: optionalText(120),
  movement: optionalText(160),
  lensMm: z.number().int().min(1).max(2_000).optional(),
  duration: z.number().min(0.25).max(600).optional(),
  transition: optionalText(160),
  focusDepth: optionalText(160),
  location: optionalText(500),
  timeOfDay: optionalText(100),
  weather: optionalText(160),
  screenDirection: z.enum(['left-to-right', 'right-to-left', 'static']).optional(),
  beatTag: optionalText(120),
  continuityNotes: optionalText(2_000),
  productionNotes: optionalText(2_000),
  vfxNotes: optionalText(2_000),
  tags: z.array(text(100)).max(30).optional(),
  revisionStatus: z.enum(['current', 'stale', 'unmapped']).optional(),
  revisionReason: optionalText(2_000),
}).strict();

const productionMarkSchema = z.object({
  strokeId: text(200),
  kind: text(64),
  direction: z.object({
    dx: z.number().finite().min(-1).max(1),
    dy: z.number().finite().min(-1).max(1),
    angleDegrees: z.number().finite().min(-360).max(360),
  }).strict().nullable().optional(),
  stamp: z.object({
    variantName: optionalText(100),
    depth: z.enum(['foreground', 'midground', 'background']).optional(),
    continuityId: text(120).nullable().optional(),
    parameters: z.record(z.string().max(40), z.string().max(80)).optional(),
  }).strict().nullable().optional(),
}).strict();

const frameSchema = framePatchSchema.extend({
  id: text(200).min(1),
  shotNumber: text(40),
  description: text(2_000),
  imageUrl: optionalText(8_000),
  scriptLineRange: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
  ]).optional(),
  productionMarks: z.array(productionMarkSchema).max(200).optional(),
}).strict();

export const storyboardSkillContextSchema = z.object({
  project: z.object({
    id: text(200).min(1),
    title: optionalText(300),
    cinemaFormat: optionalText(40),
  }).strict(),
  scene: z.object({
    id: text(200).min(1),
    heading: text(500),
    action: optionalText(4_000),
    intExt: optionalText(40),
    location: optionalText(500),
    timeOfDay: optionalText(100),
    characters: z.array(text(200).min(1)).max(80).optional(),
    dialogue: z.array(z.object({
      lineNumber: z.number().int().nonnegative().optional(),
      characterName: optionalText(200),
      text: text(2_000),
    }).strict()).max(500).optional(),
  }).strict(),
  frames: z.array(frameSchema).max(500),
  activeFrameId: optionalText(200),
  userIntent: optionalText(1_200),
  revisionBaseline: z.object({
    snapshotHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    scene: z.object({
      id: text(200).min(1),
      heading: text(500),
      action: optionalText(4_000),
      dialogue: z.array(z.object({
        lineNumber: z.number().int().nonnegative().optional(),
        characterName: optionalText(200),
        text: text(2_000),
      }).strict()).max(500).optional(),
    }).strict(),
    frames: z.array(frameSchema).max(500),
  }).strict().optional(),
}).strict();

export const storyboardSkillRunBodySchema = z.object({
  context: storyboardSkillContextSchema,
}).strict();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function storyboardSkillContextFingerprint(context: StoryboardSkillContext): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(context)))
    .digest('hex');
}

export function storyboardSkillAgentName(skillId: StoryboardSkillId): string {
  return `storyboard.${skillId.replaceAll('_', '-')}`;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('nb-NO');
}

function frameText(frame: StoryboardSkillFrame): string {
  return normalize([
    frame.description,
    frame.notes,
    frame.continuityNotes,
    frame.productionNotes,
    frame.vfxNotes,
    ...(frame.tags ?? []),
  ].filter(Boolean).join(' '));
}

function hasAny(value: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function evidence(
  id: string,
  label: string,
  detail: string,
  frameIds?: string[],
  scriptLineRange?: [number, number],
): StoryboardSkillEvidence {
  return { id, label, detail, frameIds, scriptLineRange };
}

function change(
  id: string,
  operation: StoryboardSkillChange['operation'],
  label: string,
  reason: string,
  patch: StoryboardSkillFramePatch,
  frameId?: string,
  afterFrameId?: string,
): StoryboardSkillChange {
  return { id, operation, label, reason, patch, frameId, afterFrameId };
}

function baseResult(
  skillId: StoryboardSkillId,
  context: StoryboardSkillContext,
  result: Omit<StoryboardSkillResult,
    'contractVersion' | 'skillId' | 'skillVersion' | 'contextFingerprint' | 'cost'>,
): StoryboardSkillResult {
  return {
    contractVersion: 'storyboard-skill-result-v1',
    skillId,
    skillVersion: storyboardSkillDefinition(skillId).version,
    contextFingerprint: storyboardSkillContextFingerprint(context),
    cost: { provider: 'local', estimatedUsd: 0 },
    ...result,
  };
}

function isShot(frame: StoryboardSkillFrame, values: readonly string[]): boolean {
  const shot = normalize(`${frame.shotType ?? ''} ${frame.cameraAngle ?? ''}`)
    .replaceAll(/[^a-z0-9æøå]+/g, ' ');
  return values.some((candidate) => shot.split(' ').includes(candidate));
}

function planSceneCoverage(context: StoryboardSkillContext): StoryboardSkillResult {
  const frames = context.frames;
  const sceneText = normalize(`${context.scene.heading} ${context.scene.action ?? ''}`);
  const dialogue = context.scene.dialogue ?? [];
  const dialogueText = normalize(dialogue.map((line) => line.text).join(' '));
  const combined = `${sceneText} ${dialogueText}`;
  const foundEvidence: StoryboardSkillEvidence[] = [];
  const changes: StoryboardSkillChange[] = [];

  const hasEstablishing = frames.some((frame) =>
    isShot(frame, ['ews', 'ws', 'wide', 'establishing', 'totalbilde']));
  if (!hasEstablishing) {
    foundEvidence.push(evidence(
      'coverage-no-establishing',
      'Mangler geografisk etablering',
      `Ingen av ${frames.length} shots etablerer ${context.scene.location || context.scene.heading}.`,
      frames.map((frame) => frame.id),
    ));
    changes.push(change(
      'coverage-add-establishing',
      'create-frame',
      'Legg til etableringsbilde',
      'Gir klippen geografi før nærmere dekning.',
      {
        shotType: 'WS',
        cameraAngle: 'Eye Level',
        lensMm: 24,
        movement: 'Static',
        duration: 3,
        description: `Etabler ${context.scene.location || context.scene.heading} og karakterenes plassering.`,
        beatTag: 'ESTABLISHING',
        focusDepth: 'Deep',
      },
    ));
  }

  const speakingCharacters = new Set(
    dialogue.map((line) => normalize(line.characterName)).filter(Boolean),
  );
  const hasDialogueCoverage = frames.some((frame) =>
    isShot(frame, ['ots', 'two', 'two-shot', 'cu', 'mcu', 'nærbilde']));
  if ((speakingCharacters.size >= 2 || dialogue.length >= 4) && !hasDialogueCoverage) {
    const numbered = dialogue.map((line) => line.lineNumber).filter((line): line is number => line != null);
    const range = numbered.length ? [Math.min(...numbered), Math.max(...numbered)] as [number, number] : undefined;
    foundEvidence.push(evidence(
      'coverage-dialogue',
      'Dialog mangler revers/reaksjon',
      `${speakingCharacters.size || 'Flere'} talende karakterer er dekket uten OTS, two-shot eller nær reaksjon.`,
      frames.map((frame) => frame.id),
      range,
    ));
    changes.push(change(
      'coverage-add-dialogue-reaction',
      'create-frame',
      'Legg til reaksjonsbilde',
      'Gir klipperen reaksjon og rytmisk alternativ under dialog.',
      {
        shotType: 'CU',
        cameraAngle: 'Eye Level',
        lensMm: 85,
        movement: 'Static',
        duration: 2.5,
        description: 'Nær reaksjon på scenens viktigste replikk eller avsløring.',
        beatTag: 'DIALOGUE',
        focusDepth: 'Shallow',
      },
      undefined,
      frames.at(-1)?.id,
    ));
  }

  const actionScene = hasAny(combined, [
    'løper', 'springer', 'jager', 'slåss', 'kamp', 'krasj', 'eksploder',
    'runs', 'chase', 'fight', 'crash', 'explod',
  ]);
  const hasDynamicCoverage = frames.some((frame) => hasAny(
    normalize(frame.movement), ['track', 'dolly', 'handheld', 'pan', 'crane', 'push'],
  ));
  if (actionScene && !hasDynamicCoverage) {
    foundEvidence.push(evidence(
      'coverage-action-static',
      'Action er bare statisk dekket',
      'Scenehandlingen beskriver bevegelse, men ingen shot har en tydelig kamerabevegelse.',
      frames.map((frame) => frame.id),
    ));
    changes.push(change(
      'coverage-add-action-master',
      'create-frame',
      'Legg til bevegelig action-master',
      'Bevarer geografi gjennom handlingen og gir en sikker klippebase.',
      {
        shotType: 'MWS',
        cameraAngle: 'Eye Level',
        lensMm: 35,
        movement: 'Tracking',
        duration: 4,
        description: 'Følg hovedhandlingen i ett geografisk lesbart mastershot.',
        beatTag: 'ACTION',
        focusDepth: 'Deep',
      },
      undefined,
      frames.at(-1)?.id,
    ));
  }

  const emotionalScene = hasAny(combined, [
    'innser', 'forstår', 'gråter', 'frykt', 'redd', 'smiler', 'avsløring',
    'realizes', 'fear', 'cries', 'reveal', 'smiles',
  ]);
  const hasCloseUp = frames.some((frame) => isShot(frame, ['cu', 'bcu', 'ecu', 'close-up', 'nærbilde']));
  if ((emotionalScene || dialogue.length >= 8) && !hasCloseUp) {
    foundEvidence.push(evidence(
      'coverage-no-emotional-closeup',
      'Mangler emosjonelt anker',
      'Scenen har en reaksjon eller dialogmengde som bør ha minst ett nært klippepunkt.',
      frames.map((frame) => frame.id),
    ));
    changes.push(change(
      'coverage-add-emotional-closeup',
      'create-frame',
      'Legg til emosjonelt nærbilde',
      'Lar scenens dramatiske vending leses uten å forklare den i dialog.',
      {
        shotType: 'CU',
        lensMm: 85,
        movement: 'Slow Push In',
        duration: 3,
        description: 'Hold på karakterens reaksjon gjennom scenens emosjonelle vending.',
        beatTag: 'BEAT',
        focusDepth: 'Shallow',
      },
      undefined,
      frames.at(-1)?.id,
    ));
  }

  return baseResult('plan_scene_coverage', context, {
    title: changes.length ? `${changes.length} coverage-gap funnet` : 'Scenedekningen er balansert',
    summary: changes.length
      ? 'Forslagene fyller konkrete klippebehov uten å endre eksisterende shots.'
      : 'Sekvensen har etablering, variasjon og de tydeligste nødvendige klippepunktene.',
    rationale: 'Coverage vurderes mot scenehandling, dialogmengde og variasjon i eksisterende shottyper.',
    confidence: frames.length || context.scene.action || dialogue.length ? 0.9 : 0.72,
    severity: changes.length ? 'warning' : 'info',
    evidence: foundEvidence,
    recommendedChanges: changes.slice(0, 4),
    alternatives: [],
    warnings: frames.length === 0
      ? ['Tom scene: forslagene er et startpunkt og må vurderes mot manusets blocking.']
      : [],
  });
}

function auditVisualContinuity(context: StoryboardSkillContext): StoryboardSkillResult {
  const evidenceItems: StoryboardSkillEvidence[] = [];
  const changes: StoryboardSkillChange[] = [];

  for (let index = 1; index < context.frames.length; index += 1) {
    const previous = context.frames[index - 1];
    const current = context.frames[index];
    if (
      previous.screenDirection && current.screenDirection &&
      previous.screenDirection !== 'static' && current.screenDirection !== 'static' &&
      previous.screenDirection !== current.screenDirection
    ) {
      evidenceItems.push(evidence(
        `continuity-direction-${current.id}`,
        'Mulig skjermretningsbrudd',
        `${previous.shotNumber || index} går ${previous.screenDirection}, mens ${current.shotNumber || index + 1} går ${current.screenDirection}.`,
        [previous.id, current.id],
      ));
      changes.push(change(
        `continuity-note-${current.id}`,
        'update-frame',
        `Merk retning på ${current.shotNumber || `shot ${index + 1}`}`,
        'Retningsskiftet må motiveres med en nøytral aksepassering eller et re-etableringsbilde.',
        {
          continuityNotes: [
            current.continuityNotes,
            `Kontroller akse mot ${previous.shotNumber || `shot ${index}`}; foreslått retning bryter forrige shot.`,
          ].filter(Boolean).join(' '),
        },
        current.id,
      ));
    }

    for (const [field, label] of [
      ['location', 'location'],
      ['timeOfDay', 'tid på døgnet'],
      ['weather', 'vær'],
    ] as const) {
      const before = normalize(previous[field]);
      const after = normalize(current[field]);
      if (before && after && before !== after) {
        evidenceItems.push(evidence(
          `continuity-${field}-${current.id}`,
          `Endret ${label}`,
          `${previous.shotNumber || index}: «${previous[field]}» → ${current.shotNumber || index + 1}: «${current[field]}».`,
          [previous.id, current.id],
        ));
      }
    }
  }

  const unspecified = context.frames.filter((frame) => !frame.screenDirection);
  if (context.frames.length >= 2 && unspecified.length === context.frames.length) {
    evidenceItems.push(evidence(
      'continuity-direction-unset',
      'Skjermretning er ikke definert',
      'Ingen shots har eksplisitt skjermretning, så 180°-kontrollen kan ikke avgjøres automatisk.',
      context.frames.map((frame) => frame.id),
    ));
  }

  return baseResult('audit_visual_continuity', context, {
    title: evidenceItems.length ? `${evidenceItems.length} kontinuitetspunkt` : 'Ingen tydelige kontinuitetsbrudd',
    summary: changes.length
      ? 'Retningsbrudd er markert som forslag; eksisterende blocking er urørt.'
      : 'Ingen sikre brudd ble funnet i metadataene som er satt.',
    rationale: 'Kontrollen sammenligner bare eksplisitte verdier på naboshots og rapporterer manglende data som usikkerhet.',
    confidence: context.frames.length >= 2 ? 0.87 : 0.7,
    severity: changes.length ? 'warning' : 'info',
    evidence: evidenceItems,
    recommendedChanges: changes,
    alternatives: [],
    warnings: unspecified.length
      ? [`${unspecified.length} shot mangler skjermretning; identitet og kostyme krever godkjente referanser for full kontroll.`]
      : ['Identitet og kostyme krever godkjente referanser for full kontroll.'],
  });
}

function designShotVariants(context: StoryboardSkillContext): StoryboardSkillResult {
  const frame = context.frames.find((entry) => entry.id === context.activeFrameId) ?? context.frames[0];
  if (!frame) {
    return baseResult('design_shot_variants', context, {
      title: 'Velg et shot først',
      summary: 'Skillen trenger et aktivt shot for å lage relevante alternativer.',
      rationale: 'Alternativer skal bevare shotets dramatiske funksjon og kan derfor ikke lages uten et målshot.',
      confidence: 0.7,
      severity: 'info',
      evidence: [],
      recommendedChanges: [],
      alternatives: [],
      warnings: ['Ingen frame ble sendt i konteksten.'],
    });
  }

  const baseDescription = frame.description || context.scene.action || 'Scenens sentrale handling';
  const alternatives: StoryboardSkillAlternative[] = [
    {
      id: 'geography',
      title: 'Geografi og blocking',
      tradeoff: 'Mest klippesikkert og tydelig, men mindre intimt.',
      changes: [change(
        `variant-geography-${frame.id}`,
        'update-frame',
        'Bruk geografivarianten',
        'En vid, rolig komposisjon viser relasjoner og bevegelsesretning.',
        {
          description: baseDescription,
          shotType: 'WS', cameraAngle: 'Eye Level', lensMm: 24,
          movement: 'Static', focusDepth: 'Deep', duration: Math.max(3, frame.duration ?? 0),
        },
        frame.id,
      )],
    },
    {
      id: 'subjective',
      title: 'Subjektiv nærhet',
      tradeoff: 'Sterkere emosjonelt, men skjuler deler av geografien.',
      changes: [change(
        `variant-subjective-${frame.id}`,
        'update-frame',
        'Bruk nærhetsvarianten',
        'Lengre linse og langsom innkjøring prioriterer reaksjonen.',
        {
          description: baseDescription,
          shotType: 'CU', cameraAngle: 'Eye Level', lensMm: 85,
          movement: 'Slow Push In', focusDepth: 'Shallow', duration: Math.max(2.5, frame.duration ?? 0),
        },
        frame.id,
      )],
    },
    {
      id: 'kinetic',
      title: 'Energi og nærvær',
      tradeoff: 'Mer energi og fysisk nærvær, men krever strammere blocking og operasjon.',
      changes: [change(
        `variant-kinetic-${frame.id}`,
        'update-frame',
        'Bruk energivarianten',
        'En moderat vid linse og kontrollert tracking gir bevegelse uten å miste motivet.',
        {
          description: baseDescription,
          shotType: 'MS', cameraAngle: 'Low Angle', lensMm: 35,
          movement: 'Tracking', focusDepth: 'Deep', duration: Math.max(3, frame.duration ?? 0),
        },
        frame.id,
      )],
    },
  ];

  return baseResult('design_shot_variants', context, {
    title: `Tre alternativer for ${frame.shotNumber || 'aktivt shot'}`,
    summary: 'Velg én variant; ingen av dem brukes automatisk.',
    rationale: 'Alternativene skiller bevisst mellom geografi, emosjonell nærhet og kinetisk energi.',
    confidence: frame.description ? 0.91 : 0.76,
    severity: 'info',
    evidence: [evidence(
      `variant-source-${frame.id}`,
      'Aktivt shot',
      `${frame.shotNumber || frame.id}: ${baseDescription}`,
      [frame.id],
      frame.scriptLineRange,
    )],
    recommendedChanges: [],
    alternatives,
    warnings: frame.description ? [] : ['Shotbeskrivelse mangler; variantene bygger på scenehandlingen.'],
  });
}

const MARK_INSTRUCTIONS: Record<string, string> = {
  gesture: 'Bevar gesten og håndens retning.',
  silhouette: 'Hold motivets silhuett tydelig separert fra bakgrunnen.',
  focus: 'Legg fokuspunktet ved markert motiv.',
  depth: 'Bevar markert forgrunn, mellomgrunn og bakgrunn.',
  perspective: 'Følg de markerte perspektivlinjene.',
  camera: 'Følg markert kameraakse og utsnitt.',
  motion: 'Følg bevegelsesretningen i pilen.',
  light: 'Motiver lyset fra markert retning.',
  emotion: 'Prioriter den markerte emosjonelle reaksjonen.',
  negativeSpace: 'Bevar den markerte negative plassen.',
  eyeLine: 'Bevar markert blikkretning.',
  staging: 'Bevar markert blocking og plassering.',
  continuity: 'Lås det markerte elementet gjennom naboshots.',
  storyBeat: 'La komposisjonen fremheve det markerte story beatet.',
};

function translateArtistMarks(context: StoryboardSkillContext): StoryboardSkillResult {
  const frame = context.frames.find((entry) => entry.id === context.activeFrameId) ?? context.frames[0];
  const marks = frame?.productionMarks ?? [];
  const instructions = marks.map((mark) => {
    const base = MARK_INSTRUCTIONS[mark.kind]
      ?? `Bevar produksjonsmerket «${mark.kind}» i komposisjonen.`;
    const direction = mark.direction
      ? ` Retning ${Math.round(mark.direction.angleDegrees)}°.`
      : '';
    const stamp = mark.stamp?.variantName ? ` Motiv: ${mark.stamp.variantName}.` : '';
    const depth = mark.stamp?.depth ? ` Lag: ${mark.stamp.depth}.` : '';
    return `${base}${direction}${stamp}${depth}`;
  });

  const patch = frame && instructions.length
    ? change(
      `marks-${frame.id}`,
      'update-frame',
      'Legg tolkningen i produksjonsnotater',
      'Merkenes typed data blir lesbare instruksjoner uten at originalstrekene endres.',
      {
        productionNotes: [frame.productionNotes, ...instructions].filter(Boolean).join('\n'),
      },
      frame.id,
    )
    : null;

  return baseResult('translate_artist_marks', context, {
    title: marks.length ? `${marks.length} artistmerker tolket` : 'Ingen typed artistmerker funnet',
    summary: marks.length
      ? 'Tolkningen kan brukes som produksjonsnotat; Pencil-strekene forblir urørt.'
      : 'Legg til produksjonsstempel, pil eller assist-merke i tegneflaten og kjør skillen igjen.',
    rationale: 'Bare allow-listet mark-type, geometri og stempelmetadata brukes. Fritekst fra streker blir aldri behandlet som instruksjon.',
    confidence: marks.length ? 0.94 : 0.72,
    severity: 'info',
    evidence: marks.map((mark, index) => evidence(
      `mark-${index}-${mark.strokeId}`,
      mark.kind,
      instructions[index],
      frame ? [frame.id] : undefined,
    )),
    recommendedChanges: patch ? [patch] : [],
    alternatives: [],
    warnings: marks.length ? [] : ['Eldre frie streker uten productionMark-metadata tolkes ikke automatisk.'],
  });
}

function auditBoardReadability(context: StoryboardSkillContext): StoryboardSkillResult {
  const findings: StoryboardSkillEvidence[] = [];
  const changes: StoryboardSkillChange[] = [];

  for (const frame of context.frames) {
    const missing: string[] = [];
    if (!frame.description.trim()) missing.push('handling');
    if (!frame.shotType && !frame.cameraAngle) missing.push('shotstørrelse');
    if (!frame.focusDepth) missing.push('fokusdybde');
    if (!frame.screenDirection) missing.push('skjermretning');
    if (missing.length) {
      findings.push(evidence(
        `readability-metadata-${frame.id}`,
        `${frame.shotNumber || frame.id} mangler lesesignaler`,
        `Mangler ${missing.join(', ')}.`,
        [frame.id],
      ));
    }
    if (!frame.focusDepth && (frame.shotType || frame.cameraAngle)) {
      const wide = isShot(frame, ['ews', 'ws', 'wide', 'establishing']);
      changes.push(change(
        `readability-focus-${frame.id}`,
        'update-frame',
        `Sett fokusdybde på ${frame.shotNumber || frame.id}`,
        wide ? 'Vid geografi leses sikrere med dypere fokus.' : 'Nær dekning får tydeligere prioritet med grunnere fokus.',
        { focusDepth: wide ? 'Deep' : 'Shallow' },
        frame.id,
      ));
    }
  }

  for (let index = 2; index < context.frames.length; index += 1) {
    const trio = context.frames.slice(index - 2, index + 1);
    const signatures = trio.map((frame) => normalize(frame.shotType || frame.cameraAngle));
    if (signatures[0] && signatures.every((signature) => signature === signatures[0])) {
      findings.push(evidence(
        `readability-repeat-${trio[0].id}`,
        'Tre like utsnitt på rad',
        `${trio.map((frame) => frame.shotNumber || frame.id).join(', ')} bruker samme shotstørrelse.`,
        trio.map((frame) => frame.id),
      ));
    }
  }

  return baseResult('audit_board_readability', context, {
    title: findings.length ? `${findings.length} lesbarhetspunkt` : 'Boardet har tydelige lesesignaler',
    summary: findings.length
      ? 'Forslagene kompletterer metadata og fremhever repeterende dekning; tegningen endres ikke.'
      : 'Ingen tydelige metadata- eller sekvensproblemer ble funnet.',
    rationale: 'Denne passeringen vurderer eksplisitt shotmetadata. Pikselanalyse kjøres ikke uten brukerens samtykke.',
    confidence: context.frames.length ? 0.86 : 0.7,
    severity: findings.length ? 'warning' : 'info',
    evidence: findings,
    recommendedChanges: changes,
    alternatives: [],
    warnings: ['Silhuett og faktisk fokus i rasterbildet må fortsatt vurderes visuelt av artisten.'],
  });
}

function dialogueWordsForFrame(
  frame: StoryboardSkillFrame,
  dialogue: NonNullable<StoryboardSkillContext['scene']['dialogue']>,
): number {
  if (!frame.scriptLineRange) return 0;
  const [from, to] = frame.scriptLineRange;
  return dialogue
    .filter((line) => line.lineNumber != null && line.lineNumber >= from && line.lineNumber <= to)
    .reduce((sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length, 0);
}

function buildAnimaticPass(context: StoryboardSkillContext): StoryboardSkillResult {
  const dialogue = context.scene.dialogue ?? [];
  const changes: StoryboardSkillChange[] = [];
  const evidenceItems: StoryboardSkillEvidence[] = [];

  context.frames.forEach((frame, index) => {
    const dialogueWords = dialogueWordsForFrame(frame, dialogue);
    const actionWords = frame.description.split(/\s+/).filter(Boolean).length;
    const beatHold = ['BEAT', 'TENSION', 'RESOLUTION'].includes(String(frame.beatTag ?? '').toUpperCase()) ? 0.75 : 0;
    const desired = roundHalf(clamp(
      dialogueWords > 0 ? dialogueWords / 2.5 + 0.7 + beatHold : actionWords / 3.5 + 1.2 + beatHold,
      1.5,
      12,
    ));
    const current = frame.duration ?? 2;
    const transition = frame.transition || (index === context.frames.length - 1 && frame.beatTag === 'RESOLUTION'
      ? 'Dissolve'
      : 'Cut');
    if (Math.abs(current - desired) >= 0.5 || !frame.transition) {
      changes.push(change(
        `animatic-${frame.id}`,
        'update-frame',
        `Timing ${frame.shotNumber || frame.id}: ${desired.toFixed(1)} s`,
        dialogueWords
          ? `${dialogueWords} dialogord gir lesbar spilletid med kort inn-/utpust.`
          : `${actionWords} handlingsord og beatfunksjonen styrer holdet.`,
        { duration: desired, transition },
        frame.id,
      ));
      evidenceItems.push(evidence(
        `animatic-source-${frame.id}`,
        `${frame.shotNumber || frame.id}: ${current.toFixed(1)} → ${desired.toFixed(1)} s`,
        dialogueWords ? `${dialogueWords} koblede dialogord.` : `${actionWords} ord i shotbeskrivelsen.`,
        [frame.id],
        frame.scriptLineRange,
      ));
    }
  });

  const proposedRuntime = context.frames.reduce((sum, frame) => {
    const proposal = changes.find((entry) => entry.frameId === frame.id)?.patch.duration;
    return sum + (proposal ?? frame.duration ?? 2);
  }, 0);

  return baseResult('build_animatic_pass', context, {
    title: changes.length ? `Timingpass: ${proposedRuntime.toFixed(1)} sekunder` : 'Animatic-timingen er allerede balansert',
    summary: changes.length
      ? `${changes.length} shots får foreslått varighet eller overgang.`
      : 'Ingen shot trenger en tydelig timingjustering fra tilgjengelig tekst.',
    rationale: 'Dialog beregnes konservativt rundt 2,5 ord/sekund; action får ekstra lesetid og dramatiske beats et kort hold.',
    confidence: context.frames.length ? 0.88 : 0.7,
    severity: 'info',
    evidence: evidenceItems,
    recommendedChanges: changes,
    alternatives: [],
    warnings: dialogue.some((line) => line.lineNumber == null)
      ? ['Dialog uten linjenummer kan ikke knyttes sikkert til enkeltshots.']
      : [],
  });
}

const FEASIBILITY_RULES = [
  {
    id: 'stunt', severity: 'blocking' as const,
    keywords: ['stunt', 'faller fra', 'slåss', 'fight', 'kaster seg', 'hopp fra'],
    label: 'Stunt og fysisk risiko',
    action: 'Planlegg stuntkoordinator, sikker sone og et enklere dekningalternativ.',
  },
  {
    id: 'weapon-fire', severity: 'blocking' as const,
    keywords: ['våpen', 'pistol', 'gevær', 'ild', 'flammer', 'eksplosjon', 'weapon', 'fire'],
    label: 'Våpen, ild eller pyroteknikk',
    action: 'Avklar fagansvarlig, tillatelser og VFX-/lydalternativ før shotet låses.',
  },
  {
    id: 'vehicle', severity: 'warning' as const,
    keywords: ['bil', 'tog', 'motorsykkel', 'vehicle', 'kjører', 'driving'],
    label: 'Kjøretøy i bevegelse',
    action: 'Vurder process trailer, plate-opptak eller statisk blocking før bevegelig rigg.',
  },
  {
    id: 'weather-water', severity: 'warning' as const,
    keywords: ['regn', 'snøstorm', 'storm', 'under vann', 'hav', 'rain', 'snow', 'water'],
    label: 'Vær eller vann',
    action: 'Lag værcover og kontinuitetsplan; vurder kontrollert effekt eller insert-dekning.',
  },
  {
    id: 'crowd', severity: 'warning' as const,
    keywords: ['folkemengde', 'hundrevis', 'publikum', 'crowd', 'extras'],
    label: 'Stor folkemengde',
    action: 'Planlegg bakgrunnsplater, duplisering eller strammere utsnitt med færre statister.',
  },
  {
    id: 'rig', severity: 'warning' as const,
    keywords: ['crane', 'kran', 'drone', 'aerial', 'steadicam', 'bilrigg'],
    label: 'Spesialrigg',
    action: 'Bekreft rigg, operatør, tid og en enklere kamerabevegelse som fallback.',
  },
  {
    id: 'vfx', severity: 'warning' as const,
    keywords: ['vfx', 'cgi', 'greenscreen', 'green screen', 'monster', 'troll', 'eksploder'],
    label: 'VFX-avhengighet',
    action: 'Definer plate, tracking-markører, lysreferanse og clean plate før opptak.',
  },
] as const;

function auditProductionFeasibility(context: StoryboardSkillContext): StoryboardSkillResult {
  const evidenceItems: StoryboardSkillEvidence[] = [];
  const changes: StoryboardSkillChange[] = [];
  let blocking = false;

  for (const frame of context.frames) {
    const haystack = `${normalize(context.scene.action)} ${frameText(frame)}`;
    const matches = FEASIBILITY_RULES.filter((rule) => hasAny(haystack, rule.keywords));
    if (!matches.length) continue;
    blocking ||= matches.some((match) => match.severity === 'blocking');
    for (const match of matches) {
      evidenceItems.push(evidence(
        `feasibility-${match.id}-${frame.id}`,
        match.label,
        `${frame.shotNumber || frame.id}: ${match.action}`,
        [frame.id],
      ));
    }
    const actions = [...new Set(matches.map((match) => match.action))];
    changes.push(change(
      `feasibility-note-${frame.id}`,
      'update-frame',
      `Legg produksjonsplan på ${frame.shotNumber || frame.id}`,
      'Tiltakene dokumenteres som forslag og endrer ikke den kreative løsningen.',
      { productionNotes: [frame.productionNotes, ...actions].filter(Boolean).join('\n') },
      frame.id,
    ));
  }

  return baseResult('audit_production_feasibility', context, {
    title: evidenceItems.length ? `${evidenceItems.length} produksjonspunkt` : 'Ingen tydelige gjennomføringsflagg',
    summary: evidenceItems.length
      ? 'Risikoene er koblet til konkrete shots med et gjennomførbart fallback-forslag.'
      : 'Ingen regelbaserte signaler om stunt, rigg, vær, crowd eller VFX ble funnet.',
    rationale: 'Skillen flagger bare eksplisitte ord i scene- og shotdata; den estimerer aldri kostnader uten produksjonens egne satser.',
    confidence: context.frames.length || context.scene.action ? 0.89 : 0.7,
    severity: blocking ? 'blocking' : evidenceItems.length ? 'warning' : 'info',
    evidence: evidenceItems,
    recommendedChanges: changes,
    alternatives: [],
    warnings: ['Dette er en preflight, ikke en erstatning for HMS-, stunt- eller location-fagansvarlig.'],
  });
}

function revisionFrameFingerprint(frame: StoryboardSkillFrame): string {
  const { revisionStatus: _status, revisionReason: _reason, ...source } = frame as StoryboardSkillFrame & {
    revisionStatus?: string;
    revisionReason?: string;
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(source))).digest('hex');
}

function reconcileStoryboardRevision(context: StoryboardSkillContext): StoryboardSkillResult {
  const baseline = context.revisionBaseline;
  if (!baseline) {
    return baseResult('reconcile_storyboard_revision', context, {
      title: 'Velg en review-revisjon først',
      summary: 'Revisjonsvakten trenger en uforanderlig review-runde som sammenligningsgrunnlag.',
      rationale: 'Uten en eksplisitt baseline kan skillen ikke skille en tilsiktet endring fra en uferdig tegning.',
      confidence: 1,
      severity: 'info',
      evidence: [],
      recommendedChanges: [],
      alternatives: [],
      warnings: ['Opprett eller åpne en review-runde og kjør revisjonsvakten på nytt.'],
    });
  }

  const before = new Map(baseline.frames.map((frame, index) => [frame.id, { frame, index }]));
  const after = new Map(context.frames.map((frame, index) => [frame.id, { frame, index }]));
  const evidenceItems: StoryboardSkillEvidence[] = [];
  const changes: StoryboardSkillChange[] = [];
  const scriptChanged = normalize(JSON.stringify({
    heading: baseline.scene.heading,
    action: baseline.scene.action,
    dialogue: baseline.scene.dialogue,
  })) !== normalize(JSON.stringify({
    heading: context.scene.heading,
    action: context.scene.action,
    dialogue: context.scene.dialogue,
  }));

  for (const [frameId, current] of after) {
    const previous = before.get(frameId);
    if (!previous) {
      evidenceItems.push(evidence(
        `revision-added-${frameId}`,
        'Nytt shot uten baseline',
        `${current.frame.shotNumber || frameId} finnes ikke i review-revisjonen.`,
        [frameId], current.frame.scriptLineRange,
      ));
      changes.push(change(
        `revision-mark-unmapped-${frameId}`, 'update-frame',
        `Merk ${current.frame.shotNumber || frameId} som ikke avstemt`,
        'Shotet må vurderes eksplisitt før neste sign-off.',
        { revisionStatus: 'unmapped', revisionReason: 'Nytt etter review-baseline; må avstemmes.' }, frameId,
      ));
      continue;
    }
    const contentChanged = revisionFrameFingerprint(previous.frame) !== revisionFrameFingerprint(current.frame);
    const moved = previous.index !== current.index;
    const linkedToScript = Boolean(current.frame.scriptLineRange ?? previous.frame.scriptLineRange);
    if (contentChanged || moved || (scriptChanged && linkedToScript)) {
      const reasons = [
        contentChanged ? 'shotdata er endret' : '',
        moved ? 'rekkefølgen er endret' : '',
        scriptChanged && linkedToScript ? 'tilknyttet manusområde er revidert' : '',
      ].filter(Boolean);
      evidenceItems.push(evidence(
        `revision-stale-${frameId}`,
        'Shot må avstemmes',
        `${current.frame.shotNumber || frameId}: ${reasons.join(', ')}.`,
        [frameId], current.frame.scriptLineRange ?? previous.frame.scriptLineRange,
      ));
      changes.push(change(
        `revision-mark-stale-${frameId}`, 'update-frame',
        `Merk ${current.frame.shotNumber || frameId} for ny vurdering`,
        reasons.join(', '),
        { revisionStatus: 'stale', revisionReason: reasons.join('; ') }, frameId,
      ));
    }
  }

  for (const [frameId, previous] of before) {
    if (after.has(frameId)) continue;
    evidenceItems.push(evidence(
      `revision-removed-${frameId}`,
      'Shot er fjernet siden review',
      `${previous.frame.shotNumber || frameId} finnes bare i review-revisjonen.`,
      [frameId], previous.frame.scriptLineRange,
    ));
  }

  return baseResult('reconcile_storyboard_revision', context, {
    title: evidenceItems.length ? `${evidenceItems.length} revisjonspunkt` : 'Storyboardet samsvarer med review-revisjonen',
    summary: evidenceItems.length
      ? 'Endringer er sporet mot den eksakte review-baselinen; ingenting endres før forslagene godkjennes.'
      : 'Ingen shot- eller manuskoblinger krever ny avstemming.',
    rationale: `Sammenlignet frame-ID, rekkefølge, shotdata og manuskoblinger${baseline.snapshotHash ? ` mot ${baseline.snapshotHash.slice(0, 10)}…` : ''}.`,
    confidence: 0.98,
    severity: evidenceItems.length ? 'warning' : 'info',
    evidence: evidenceItems,
    recommendedChanges: changes,
    alternatives: [],
    warnings: scriptChanged
      ? ['Manuset er endret siden baselinen. Godkjenn hvert berørt shot før ny sign-off.']
      : [],
  });
}

const RUNNERS: Record<StoryboardSkillId, (context: StoryboardSkillContext) => StoryboardSkillResult> = {
  plan_scene_coverage: planSceneCoverage,
  audit_visual_continuity: auditVisualContinuity,
  design_shot_variants: designShotVariants,
  translate_artist_marks: translateArtistMarks,
  audit_board_readability: auditBoardReadability,
  build_animatic_pass: buildAnimaticPass,
  audit_production_feasibility: auditProductionFeasibility,
  reconcile_storyboard_revision: reconcileStoryboardRevision,
};

export function runStoryboardSkill(
  skillId: StoryboardSkillId,
  input: unknown,
): StoryboardSkillResult {
  const context = storyboardSkillContextSchema.parse(input);
  return RUNNERS[skillId](context);
}

function createStoryboardSkillAgent(skillId: StoryboardSkillId): AIAgent {
  const definition = storyboardSkillDefinition(skillId);
  return {
    name: storyboardSkillAgentName(skillId),
    modelVersion: `local-rules-${definition.version}`,
    async generate(input: AIAgentInput) {
      const result = runStoryboardSkill(skillId, input.payload);
      return [{
        suggestionType: 'storyboard.skill-result',
        payload: result,
        confidence: result.confidence,
        sourceType: 'scene' as const,
        // Suggestions are always scene-scoped for persistence/listing. A
        // frame-scoped skill identifies its target inside evidence/changes.
        sourceId: input.sourceId,
      }];
    },
  };
}

export function createStoryboardSkillAgents(): AIAgent[] {
  return STORYBOARD_SKILL_IDS.map(createStoryboardSkillAgent);
}

export function storyboardSkillCatalog() {
  return STORYBOARD_SKILL_DEFINITIONS;
}
