/**
 * creativeSuggestions — heuristikk-basert shot-foreslår + coverage-analyse.
 *
 * Designet for storyboard-artister som starter blank på en scene og
 * trenger en "hva burde jeg tegne her"-sparringspartner. Bruker scene-
 * metadata (heading, beskrivelse, characters, props, dialog-tetthet)
 * for å foreslå konkrete shot-typer med begrunnelse.
 *
 * Ikke avhengig av LLM — pure pattern matching, kan kjøres offline.
 */

import type { SceneBreakdown, DialogueLine } from '../../models/casting';

export type ShotType =
  | 'establishing'   // Bred, viser sted/atmosfære
  | 'wide'           // Inkluderer karakterer + rom
  | 'medium'         // Mid-shot, dialog-arbeidshest
  | 'two-shot'       // To karakterer i frame, dialog
  | 'ots'            // Over-the-shoulder, samtale
  | 'close-up'       // Ansikt, emosjon, reaksjon
  | 'extreme-close-up' // Detalj — øye, hånd, gjenstand
  | 'insert'         // Prop, hånd, ikke-ansiktsdetalj
  | 'pov'            // Subjektiv, hva karakter ser
  | 'tracking'       // Bevegelse — fulgt med kamera
  | 'crane'          // Vertikal kamerabevegelse, dramatisk
  | 'reaction';      // Spesifikk reaksjon mot off-screen handling

export interface ShotSuggestion {
  shotType: ShotType;
  /** Kort label for UI ("Wide etablering"). */
  label: string;
  /** Hvorfor — kobles til scene-detaljer for å lære artisten å tenke. */
  rationale: string;
  /** Bransje-referanser. */
  references?: string[];
  /** Prioritet for sortering — 'critical' = burde være med, 'try' = utforsk. */
  priority: 'critical' | 'recommended' | 'try';
}

// ============================================================================
// SHOT SUGGESTIONS
// ============================================================================

const ACTION_VERBS = [
  'løper', 'løp', 'springer', 'kjører', 'sykler', 'flykter', 'jakter',
  'hopper', 'klatrer', 'faller', 'slår', 'sparker', 'kjemper',
  'runs', 'jumps', 'climbs', 'falls', 'fights', 'chases', 'drives', 'rides',
];
const REVEAL_VERBS = [
  'oppdager', 'avslører', 'ser plutselig', 'finner', 'innser',
  'discovers', 'reveals', 'realizes', 'finds', 'sees',
];
const EMOTION_VERBS = [
  'gråter', 'ler', 'smiler', 'rødmer', 'krymper', 'fryser',
  'cries', 'laughs', 'smiles', 'stares', 'freezes', 'winces',
];
const ARRIVAL_VERBS = [
  'ankommer', 'kommer inn', 'kommer ut', 'forlater', 'går inn',
  'arrives', 'enters', 'exits', 'walks in', 'leaves',
];

/**
 * Hovedfunksjon: ta inn en scene + dialog-linjer og returner foreslåtte
 * shot-typer i prioritert rekkefølge.
 */
export function suggestShotsForScene(
  scene: SceneBreakdown,
  dialogue: DialogueLine[] = [],
): ShotSuggestion[] {
  const text = `${scene.description ?? ''} ${scene.heading ?? ''} ${scene.sceneHeading ?? ''}`.toLowerCase();
  const characters = scene.characters ?? [];
  const props = scene.propsNeeded ?? [];
  const sceneDialogue = dialogue.filter((d) => d.sceneId === scene.id);
  const dialogueLineCount = sceneDialogue.length;
  const hasMultipleSpeakers = new Set(sceneDialogue.map((d) => d.characterName)).size >= 2;

  const suggestions: ShotSuggestion[] = [];

  // 1. ESTABLISHING — alle scener trenger kontekst, EXT spesielt
  if (scene.intExt === 'EXT' || scene.intExt === 'INT/EXT' || scene.intExt === 'I/E') {
    suggestions.push({
      shotType: 'establishing',
      label: 'Etablerende vidvinkel',
      rationale: `EXT ${scene.timeOfDay ?? ''}-scene — etabler stedet før vi går inn på karakterene.`.trim(),
      references: ['Blade Runner 2049 — etablerende landskap', 'There Will Be Blood — vidvinkel i innledning'],
      priority: 'critical',
    });
  } else if (scene.intExt === 'INT') {
    suggestions.push({
      shotType: 'wide',
      label: 'Wide av rommet',
      rationale: 'INT-scene — vis rommet og karakterenes plassering i det før close-up arbeidet.',
      references: ['The Master — wide-room geometri', 'No Country for Old Men — romlig komposisjon'],
      priority: 'critical',
    });
  }

  // 2. DIALOG — flere talere = OTS + 2-shot + CU per karakter
  if (hasMultipleSpeakers || dialogueLineCount >= 4) {
    suggestions.push({
      shotType: 'two-shot',
      label: 'Two-shot for å etablere relasjonen',
      rationale: `${dialogueLineCount} dialog-linjer mellom flere talere — vis dem sammen i frame før du klipper.`,
      references: ['Before Sunrise — vandring i 2-shot', 'Heat — diner-samtalen'],
      priority: 'critical',
    });
    suggestions.push({
      shotType: 'ots',
      label: 'OTS — over-the-shoulder',
      rationale: 'Dialog-utveksling — OTS for hver side gir intimitet og blikkretning.',
      references: ['Marriage Story — OTS-rytme i kjøkken-scenen'],
      priority: 'critical',
    });
    suggestions.push({
      shotType: 'close-up',
      label: 'CU på lytteren under nøkkellinjer',
      rationale: 'Den som ikke snakker fortjener kameraet når replikken treffer hardt.',
      references: ['Sopranos — Tony lytter', 'The Wire — McNulty\'s subtekst'],
      priority: 'recommended',
    });
  } else if (dialogueLineCount > 0) {
    // Solo monolog / voiceover
    suggestions.push({
      shotType: 'medium',
      label: 'Medium på taler',
      rationale: 'Monolog / kort dialog — medium gir tekst plass uten å være distansert.',
      priority: 'recommended',
    });
  }

  // 3. ACTION — løper, slåss, kjører
  const isAction = ACTION_VERBS.some((verb) => text.includes(verb));
  if (isAction) {
    suggestions.push({
      shotType: 'tracking',
      label: 'Tracking — følg bevegelsen',
      rationale: 'Action-verb i beskrivelsen — tracking-shot opprettholder energi og rom-orientering.',
      references: ['Children of Men — single-take tracking', 'Bourne-serien — håndholdt forfølgelse'],
      priority: 'critical',
    });
    suggestions.push({
      shotType: 'wide',
      label: 'Wide for å vise hele bevegelsen',
      rationale: 'Når noen løper/jakter — wide gir publikum rom-forståelse.',
      priority: 'recommended',
    });
  }

  // 4. REVEAL — "oppdager", "avslører"
  const isReveal = REVEAL_VERBS.some((verb) => text.includes(verb));
  if (isReveal) {
    suggestions.push({
      shotType: 'reaction',
      label: 'Reaction shot — CU FØR vi ser hva',
      rationale: 'Avsløring — vis karakterens ansikt før vi klipper til det de ser. Spielberg-regelen.',
      references: ['Jaws — Brodys "we\'re gonna need a bigger boat"', 'Schindler\'s List — den røde frakken'],
      priority: 'critical',
    });
    suggestions.push({
      shotType: 'pov',
      label: 'POV på det som avsløres',
      rationale: 'Etter reaction-shot — vis publikum nøyaktig hva karakteren ser.',
      priority: 'critical',
    });
  }

  // 5. EMOSJONELL — gråter, ler
  const isEmotion = EMOTION_VERBS.some((verb) => text.includes(verb));
  if (isEmotion) {
    suggestions.push({
      shotType: 'close-up',
      label: 'CU for emosjon',
      rationale: 'Emosjonell beat — CU er minimumskravet. Vurder ECU på øye/tåre for ekstrem intimitet.',
      references: ['Bergman — Persona-CUer', 'A24 — Florence Pugh i Midsommar'],
      priority: 'critical',
    });
  }

  // 6. ARRIVAL/EXIT — "ankommer", "går inn"
  const isArrival = ARRIVAL_VERBS.some((verb) => text.includes(verb));
  if (isArrival && characters.length > 0) {
    suggestions.push({
      shotType: 'wide',
      label: 'Wide som karakteren går inn i',
      rationale: 'Ankomst-beat — la rommet være ferdig komponert før karakteren trer inn.',
      priority: 'recommended',
    });
  }

  // 7. PROPS / INSERT — viktig prop i scenen
  if (props.length > 0) {
    suggestions.push({
      shotType: 'insert',
      label: `Insert av nøkkel-prop${props.length > 1 ? 's' : ''}`,
      rationale: `Prop${props.length > 1 ? 'er' : ''}: ${props.slice(0, 3).join(', ')}. Insert-shot gjør publikum til medskyldig.`,
      references: ['Hitchcock — ringen i Notorious', 'Tarantino — kofferten i Pulp Fiction'],
      priority: 'recommended',
    });
  }

  // 8. NIGHT-mood
  if (scene.timeOfDay === 'NIGHT' || scene.timeOfDay === 'DUSK') {
    suggestions.push({
      shotType: 'medium',
      label: 'Lavt nøkkellys + medium komposisjon',
      rationale: `${scene.timeOfDay}-scene — moodyt nøkkellys. Hold framing romlig så lyset får jobbe.`,
      references: ['Roger Deakins — night scenes', 'Gordon Willis — Godfather-mørket'],
      priority: 'try',
    });
  }

  // 9. SOLO scene uten dialog — kontemplativ
  if (characters.length === 1 && dialogueLineCount === 0) {
    suggestions.push({
      shotType: 'medium',
      label: 'Medium kontemplativ',
      rationale: 'Solo, ingen dialog — gi karakteren rom. Eventuelt long take.',
      references: ['Lost in Translation — Bill Murray i hotellrommet'],
      priority: 'try',
    });
  }

  // 10. Hvis vi har null suggestions: gi default "start her"
  if (suggestions.length === 0) {
    suggestions.push({
      shotType: 'wide',
      label: 'Start med etablerende wide',
      rationale: 'Når i tvil — wide først. Etabler hvor vi er, så lukk inn på karakter/handling.',
      priority: 'recommended',
    });
  }

  return suggestions.sort(byPriority);
}

const PRIORITY_ORDER: Record<ShotSuggestion['priority'], number> = {
  critical: 0,
  recommended: 1,
  try: 2,
};

function byPriority(a: ShotSuggestion, b: ShotSuggestion): number {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

// ============================================================================
// COVERAGE ANALYSIS
// ============================================================================

export interface SceneCoverageReport {
  sceneId: string;
  sceneNumber?: number | string;
  sceneLabel: string;
  framesCount: number;
  /** Approx ord-tetthet — flere ord = mer komplekse scener fortjener flere frames. */
  wordCount: number;
  /** Ord-til-frame-ratio (lavere = bedre coverage). */
  wordsPerFrame: number | null;
  /** Vurdert mangler basert på heuristikk. */
  gaps: CoverageGap[];
  severity: 'critical' | 'warning' | 'ok';
}

export interface CoverageGap {
  kind:
    | 'no-frames'
    | 'under-covered'
    | 'no-establishing'
    | 'no-close-up'
    | 'no-coverage-variation';
  message: string;
}

/**
 * Tar inn alle scener og returnerer per-scene coverage-rapport. Brukes til
 * å overflate "hvilken scene fortjener neste innsats" for artisten.
 */
export function analyzeCoverage(scenes: SceneBreakdown[]): SceneCoverageReport[] {
  // Beregner referanse-ratio fra scener som ER tegnet, så vi sammenligner
  // mot prosjektets egen baseline (ikke en fiktiv standard).
  const drawnScenes = scenes.filter((s) => (s.storyboardFrames?.length ?? 0) > 0);
  const referenceWordsPerFrame = drawnScenes.length > 0
    ? drawnScenes.reduce((sum, s) => sum + (countWords(s.description ?? '') / Math.max(1, s.storyboardFrames!.length)), 0) / drawnScenes.length
    : 60; // fallback baseline

  return scenes.map((scene) => {
    const frames = scene.storyboardFrames ?? [];
    const wordCount = countWords(scene.description ?? '');
    const wordsPerFrame = frames.length > 0 ? wordCount / frames.length : null;
    const gaps: CoverageGap[] = [];

    if (frames.length === 0) {
      gaps.push({ kind: 'no-frames', message: 'Ingen frames tegnet for denne scenen.' });
    } else {
      // Under-covered: 2x prosjektets baseline
      if (wordsPerFrame !== null && wordsPerFrame > referenceWordsPerFrame * 2) {
        gaps.push({
          kind: 'under-covered',
          message: `${Math.round(wordsPerFrame)} ord/frame, baseline er ~${Math.round(referenceWordsPerFrame)}. Vurder flere frames.`,
        });
      }

      const shotTypes = collectShotTypes(frames);
      if (!hasEstablishing(shotTypes, scene)) {
        gaps.push({
          kind: 'no-establishing',
          message: 'Ingen wide/etablerende shot — start scenen med kontekst.',
        });
      }
      if (!hasCloseUp(shotTypes) && wordCount > 50) {
        gaps.push({
          kind: 'no-close-up',
          message: 'Ingen close-up — emosjonelle øyeblikk fortjener nærhet.',
        });
      }
      if (frames.length >= 3 && shotTypes.size < 2) {
        gaps.push({
          kind: 'no-coverage-variation',
          message: `${frames.length} frames i samme shot-type. Varier framing for visuell rytme.`,
        });
      }
    }

    const severity: SceneCoverageReport['severity'] = gaps.some((g) => g.kind === 'no-frames')
      ? 'critical'
      : gaps.length >= 2
        ? 'warning'
        : gaps.length === 1
          ? 'warning'
          : 'ok';

    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      sceneLabel: scene.sceneHeading || scene.sceneName || scene.heading || `Scene ${scene.sceneNumber ?? scene.id}`,
      framesCount: frames.length,
      wordCount,
      wordsPerFrame,
      gaps,
      severity,
    };
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function collectShotTypes(frames: Array<{ description?: string; shotNumber?: string }>): Set<string> {
  const types = new Set<string>();
  for (const f of frames) {
    const t = `${f.description ?? ''} ${f.shotNumber ?? ''}`.toLowerCase();
    if (/wide|establish|wt\b|ws\b/.test(t)) types.add('wide');
    if (/medium|mid|ms\b|mt\b/.test(t)) types.add('medium');
    if (/close.?up|cu\b|ecu\b|insert|extreme/.test(t)) types.add('close-up');
    if (/ots|over.?the.?shoulder|two.?shot/.test(t)) types.add('ots');
    if (/pov|subjective/.test(t)) types.add('pov');
    if (/track|dolly|crane/.test(t)) types.add('tracking');
  }
  return types;
}

function hasEstablishing(types: Set<string>, scene: SceneBreakdown): boolean {
  if (types.has('wide')) return true;
  // INT-scener tolereres uten etablerende hvis det er en kort beat
  return scene.intExt === 'INT' && (scene.description?.length ?? 0) < 80;
}

function hasCloseUp(types: Set<string>): boolean {
  return types.has('close-up');
}

// ============================================================================
// REFERENCE INSPIRATIONS
// ============================================================================

export interface ReferenceInspiration {
  title: string;
  filmmaker?: string;
  why: string;
  tags: string[];
}

const REFERENCE_LIBRARY: ReferenceInspiration[] = [
  { title: 'Blade Runner 2049', filmmaker: 'Roger Deakins (DP)', why: 'Atmosfærisk wide-rom i golvet av lyssetting', tags: ['ext', 'night', 'sci-fi', 'establishing'] },
  { title: 'Children of Men', filmmaker: 'Emmanuel Lubezki (DP)', why: 'Long-take tracking gjennom kaos', tags: ['action', 'tracking', 'long-take'] },
  { title: 'Jaws', filmmaker: 'Spielberg', why: 'Reaction før reveal — viser hvordan karakterens ansikt selger trusselen', tags: ['reveal', 'reaction'] },
  { title: 'The Master', filmmaker: 'Paul Thomas Anderson', why: 'Romlig geometri og symmetrisk komposisjon i interiør', tags: ['int', 'wide', 'composition'] },
  { title: 'Marriage Story', filmmaker: 'Noah Baumbach', why: 'OTS-rytme i krangel-scener — hvert klipp endrer maktbalansen', tags: ['dialogue', 'ots', 'two-shot'] },
  { title: 'Lost in Translation', filmmaker: 'Sofia Coppola', why: 'Solo, kontemplativ, lar rom og stillhet bære scenen', tags: ['solo', 'contemplative', 'medium'] },
  { title: 'Mad Max: Fury Road', filmmaker: 'John Seale (DP)', why: 'Sentrert action — øyet finner alltid hovedhandlingen', tags: ['action', 'tracking', 'composition'] },
  { title: 'No Country for Old Men', filmmaker: 'Coen Brothers', why: 'Wide statisk komposisjon — la rommet komme til deg', tags: ['int', 'wide', 'static'] },
  { title: 'A Ghost Story', filmmaker: 'David Lowery', why: 'Lang single-shot, tid som visuelt verktøy', tags: ['contemplative', 'long-take'] },
  { title: 'Atomic Blonde', filmmaker: 'David Leitch', why: 'Faux-oner: tracking som ser sømløs ut', tags: ['action', 'tracking'] },
  { title: 'Schindler\'s List — den røde frakken', filmmaker: 'Spielberg', why: 'Selektiv farge i monokrom — én ting trekker hele blikket', tags: ['reveal', 'color'] },
  { title: 'Hitchcock — ringen i Notorious', filmmaker: 'Hitchcock', why: 'Insert-shot som dreier hele scenen', tags: ['insert', 'prop'] },
];

/**
 * Foreslår 3-5 referanser basert på scene-egenskaper. Matcher mot tag-bag.
 */
export function suggestReferences(scene: SceneBreakdown, limit = 4): ReferenceInspiration[] {
  const targetTags = new Set<string>();
  if (scene.intExt === 'EXT') targetTags.add('ext');
  if (scene.intExt === 'INT') targetTags.add('int');
  if (scene.timeOfDay === 'NIGHT' || scene.timeOfDay === 'DUSK') targetTags.add('night');
  const text = `${scene.description ?? ''}`.toLowerCase();
  if (ACTION_VERBS.some((v) => text.includes(v))) targetTags.add('action');
  if (REVEAL_VERBS.some((v) => text.includes(v))) targetTags.add('reveal');
  if (EMOTION_VERBS.some((v) => text.includes(v))) targetTags.add('emotional');
  if ((scene.characters?.length ?? 0) === 1) targetTags.add('solo');

  const scored = REFERENCE_LIBRARY.map((ref) => ({
    ref,
    score: ref.tags.filter((tag) => targetTags.has(tag)).length,
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // Returnerer noen "always-good" defaults så panelet aldri er tomt.
    return REFERENCE_LIBRARY.slice(0, limit);
  }
  return scored.slice(0, limit).map((entry) => entry.ref);
}
