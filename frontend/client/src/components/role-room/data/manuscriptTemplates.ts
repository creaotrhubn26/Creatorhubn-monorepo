/**
 * Manuscript template models + seed data used by manuscriptTemplateService.
 */

export type TemplateType =
  | 'full-manuscript'
  | 'scene'
  | 'character'
  | 'dialogue'
  | 'action';

export interface Template {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  content: string;
  tags: string[];
  icon?: string;
  preview?: string;
  isUserTemplate?: boolean;
  createdAt?: string;
  usageCount?: number;
}

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  templates: Template[];
}

export interface TemplateLibrary {
  categories: TemplateCategory[];
  userTemplates: Template[];
  recentlyUsed: Template[];
}

export interface AutoCompleteSuggestion {
  value: string;
  label: string;
  description?: string;
}

export interface StructureBeat {
  name: string;
  description: string;
  page: number | { min: number; max: number };
}

export interface StructureTemplate {
  id: string;
  name: string;
  description: string;
  totalPages: number;
  beats: StructureBeat[];
}

const CORE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'scene-building',
    name: 'Scenes',
    icon: 'Movie',
    templates: [
      {
        id: 'scene-int-day',
        name: 'INT. Location - DAY',
        description: 'Standard interior scene heading starter.',
        type: 'scene',
        icon: 'MovieCreation',
        tags: ['scene', 'heading', 'interior'],
        content: [
          'INT. [LOCATION] - DAY',
          '',
          '[ACTION LINES - WHAT DO WE SEE?]',
          '',
          '[CHARACTER NAME]',
          '[DIALOGUE]',
        ].join('\n'),
        preview: 'INT. [LOCATION] - DAY',
      },
      {
        id: 'scene-ext-night',
        name: 'EXT. Location - NIGHT',
        description: 'Standard exterior scene heading starter.',
        type: 'scene',
        icon: 'VideoLibrary',
        tags: ['scene', 'heading', 'exterior'],
        content: [
          'EXT. [LOCATION] - NIGHT',
          '',
          '[ACTION LINES - WHAT DO WE SEE?]',
          '',
          '[CHARACTER NAME]',
          '[DIALOGUE]',
        ].join('\n'),
        preview: 'EXT. [LOCATION] - NIGHT',
      },
    ],
  },
  {
    id: 'dialogue',
    name: 'Dialogue',
    icon: 'ChatBubble',
    templates: [
      {
        id: 'dialogue-basic',
        name: 'Character Dialogue',
        description: 'Character cue with parenthetical and line.',
        type: 'dialogue',
        icon: 'ChatBubble',
        tags: ['dialogue', 'character'],
        content: ['[CHARACTER NAME]', '(optional parenthetical)', '[DIALOGUE]'].join('\n'),
        preview: '[CHARACTER NAME]\n(optional parenthetical)\n[DIALOGUE]',
      },
      {
        id: 'dialogue-phone',
        name: 'Phone Dialogue',
        description: 'Split style template for call scenes.',
        type: 'dialogue',
        icon: 'Phone',
        tags: ['dialogue', 'phone'],
        content: [
          'INTERCUT - PHONE CONVERSATION',
          '',
          '[CHARACTER A]',
          '[DIALOGUE]',
          '',
          '[CHARACTER B] (ON PHONE)',
          '[DIALOGUE]',
        ].join('\n'),
        preview: 'INTERCUT - PHONE CONVERSATION',
      },
    ],
  },
  {
    id: 'character',
    name: 'Character',
    icon: 'Person',
    templates: [
      {
        id: 'character-intro',
        name: 'Character Introduction',
        description: 'Uppercase first appearance with brief trait.',
        type: 'character',
        icon: 'PersonOutline',
        tags: ['character', 'intro'],
        content: '[CHARACTER NAME], [AGE], [A SHARP DEFINING TRAIT], enters.',
        preview: '[CHARACTER NAME], [AGE], [TRAIT], enters.',
      },
    ],
  },
  {
    id: 'action',
    name: 'Action',
    icon: 'FlashOn',
    templates: [
      {
        id: 'action-beat',
        name: 'Action Beat',
        description: 'Compact action paragraph with visual emphasis.',
        type: 'action',
        icon: 'FlashOn',
        tags: ['action', 'pacing'],
        content: [
          '[VISUAL ACTION IN PRESENT TENSE.]',
          '[SOUND/REACTION.]',
          '[COMPLICATION OR TURN.]',
        ].join('\n'),
        preview: '[VISUAL ACTION IN PRESENT TENSE.]',
      },
    ],
  },
  {
    id: 'full-docs',
    name: 'Full Draft',
    icon: 'Description',
    templates: [
      {
        id: 'full-feature-starter',
        name: 'Feature Starter',
        description: 'Minimal full manuscript skeleton.',
        type: 'full-manuscript',
        icon: 'Description',
        tags: ['full-manuscript', 'starter', 'feature'],
        content: [
          'Title: [PROJECT TITLE]',
          'Author: [AUTHOR]',
          '',
          'FADE IN:',
          '',
          'ACT I',
          'INT. [OPENING LOCATION] - DAY',
          '[OPENING IMAGE]',
          '',
          'ACT II',
          'EXT. [MIDPOINT LOCATION] - NIGHT',
          '[MIDPOINT REVERSAL]',
          '',
          'ACT III',
          'INT. [FINAL LOCATION] - NIGHT',
          '[CLIMAX AND RESOLUTION]',
          '',
          'FADE OUT.',
        ].join('\n'),
        preview: 'Title: [PROJECT TITLE]\nAuthor: [AUTHOR]\n\nFADE IN:',
      },
    ],
  },
];

export const AUTO_COMPLETE_SUGGESTIONS: Record<
  'SCENE_HEADING' | 'TIME_OF_DAY' | 'TRANSITIONS',
  AutoCompleteSuggestion[]
> = {
  SCENE_HEADING: [
    { value: 'INT.', label: 'INT.', description: 'Interior location' },
    { value: 'EXT.', label: 'EXT.', description: 'Exterior location' },
    { value: 'INT./EXT.', label: 'INT./EXT.', description: 'Mixed interior/exterior' },
  ],
  TIME_OF_DAY: [
    { value: 'DAY', label: 'DAY' },
    { value: 'NIGHT', label: 'NIGHT' },
    { value: 'DUSK', label: 'DUSK' },
    { value: 'DAWN', label: 'DAWN' },
    { value: 'LATER', label: 'LATER' },
    { value: 'CONTINUOUS', label: 'CONTINUOUS' },
  ],
  TRANSITIONS: [
    { value: 'CUT TO:', label: 'CUT TO:' },
    { value: 'SMASH CUT TO:', label: 'SMASH CUT TO:' },
    { value: 'DISSOLVE TO:', label: 'DISSOLVE TO:' },
    { value: 'MATCH CUT TO:', label: 'MATCH CUT TO:' },
    { value: 'FADE OUT.', label: 'FADE OUT.' },
  ],
};

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    id: 'three-act',
    name: 'Three-Act Structure',
    description: 'Classic setup, confrontation, and resolution.',
    totalPages: 110,
    beats: [
      { name: 'Opening Image', description: 'Define tone and world.', page: 1 },
      { name: 'Inciting Incident', description: 'Story engine starts.', page: 12 },
      { name: 'Break Into Act II', description: 'Protagonist commits.', page: 25 },
      { name: 'Midpoint', description: 'Major reversal or revelation.', page: 55 },
      { name: 'Break Into Act III', description: 'Final approach.', page: 85 },
      { name: 'Climax', description: 'Core conflict resolves.', page: 100 },
      { name: 'Final Image', description: 'Echo/contrast opening.', page: 110 },
    ],
  },
  {
    id: 'mini-series-6',
    name: '6-Episode Mini Series',
    description: 'Serialized arc with escalating episode turns.',
    totalPages: 360,
    beats: [
      { name: 'Episode 1 Hook', description: 'Define mystery and stakes.', page: { min: 1, max: 60 } },
      { name: 'Episode 2 Escalation', description: 'Complications spread.', page: { min: 61, max: 120 } },
      { name: 'Episode 3 Pivot', description: 'Major reveal shifts goals.', page: { min: 121, max: 180 } },
      { name: 'Episode 4 Fallout', description: 'Consequences tighten pressure.', page: { min: 181, max: 240 } },
      { name: 'Episode 5 Breakpoint', description: 'Characters cornered.', page: { min: 241, max: 300 } },
      { name: 'Episode 6 Resolution', description: 'Payoff and thematic close.', page: { min: 301, max: 360 } },
    ],
  },
];

/**
 * Manuscript scaffold templates — applied at manuscript-creation time.
 *
 * Unlike snippet templates (inserted into the editor) or structure templates
 * (beat-sheet references), a scaffold template materializes as a series of
 * empty scenes when a new manuscript is created. The writer opens each scene
 * and fills in the actual content — but the structural slots are visible
 * from the start. See ai-prinsipper.md, cold-start pattern #2.
 *
 * The scaffold is intentionally minimal: only structural intent is pre-filled
 * (via `sceneIntent`), never content (action, dialogue, descriptions).
 */
export interface ScaffoldBeat {
  beatName: string;
  sceneIntent: string;
  suggestedIntExt?: 'INT' | 'EXT' | 'INT/EXT';
  suggestedTimeOfDay?:
    | 'DAY'
    | 'NIGHT'
    | 'DAWN'
    | 'DUSK'
    | 'CONTINUOUS'
    | 'LATER'
    | 'MORNING'
    | 'EVENING';
}

export interface ManuscriptScaffoldTemplate {
  id: string;
  name: string;
  description: string;
  recommendedFormat?: 'fountain' | 'final-draft' | 'markdown';
  beats: ScaffoldBeat[];
}

export const MANUSCRIPT_SCAFFOLD_TEMPLATES: ManuscriptScaffoldTemplate[] = [
  {
    id: 'blank',
    name: 'Tom struktur',
    description: 'Ingen forhåndsdefinerte scener. Du bygger strukturen selv.',
    beats: [],
  },
  {
    id: 'kortfilm-3akt',
    name: 'Kortfilm — 3-akts',
    description: '6 strukturelle beats for 10–15 minutters kortfilm.',
    beats: [
      { beatName: 'Hook', sceneIntent: 'Etablér verden og hovedperson — gi seeren grunn til å bli sittende.' },
      { beatName: 'Inciting incident', sceneIntent: 'Noe forandres for hovedpersonen. Det normale opphører.' },
      { beatName: 'Eskalering', sceneIntent: 'Hovedpersonen prøver, og det blir verre.' },
      { beatName: 'Vendepunkt', sceneIntent: 'Største nederlag eller åpenbaring. Alt står på spill.' },
      { beatName: 'Klimaks', sceneIntent: 'Konfrontasjon — alt avgjøres.' },
      { beatName: 'Resolusjon', sceneIntent: 'Ny normal. Hva har forandret seg?' },
    ],
  },
  {
    id: 'reklame-30s',
    name: 'Reklame — 30 sek',
    description: 'Hook → problem → løsning → CTA for kort kommersiell.',
    beats: [
      { beatName: 'Hook', sceneIntent: 'Stopp scroll i 2 sekunder.' },
      { beatName: 'Problem', sceneIntent: 'Hvilket problem løser produktet?' },
      { beatName: 'Løsning', sceneIntent: 'Produktet i bruk.' },
      { beatName: 'CTA', sceneIntent: 'Hva skal seeren gjøre nå?' },
    ],
  },
  {
    id: 'reklame-60s-narrativ',
    name: 'Reklame — 60 sek narrativ',
    description: 'Karakterdrevet reklame med emosjonell bue og brand reveal.',
    beats: [
      { beatName: 'Karakter i hverdagen', sceneIntent: 'Hvem er denne personen før produktet?' },
      { beatName: 'Friksjon eller behov', sceneIntent: 'Hva mangler eller plager?' },
      { beatName: 'Møte med produktet', sceneIntent: 'Hvordan introduseres løsningen?' },
      { beatName: 'Forvandling', sceneIntent: 'Hva endrer seg synlig?' },
      { beatName: 'Brand reveal + CTA', sceneIntent: 'Logo, claim, kall til handling.' },
    ],
  },
  {
    id: 'musikkvideo-narrativ',
    name: 'Musikkvideo — narrativ',
    description: 'Visuell historie som matcher låtens emosjonelle bue.',
    beats: [
      { beatName: 'Anslag', sceneIntent: 'Visuelt motiv som setter tonen.' },
      { beatName: 'Karakter introdusert', sceneIntent: 'Hvem følger vi gjennom låten?' },
      { beatName: 'Konflikt eller spenning', sceneIntent: 'Hva er drivkraften — internt eller eksternt?' },
      { beatName: 'Bro — visuelt skifte', sceneIntent: 'Tilsvarer låtens bro. Bryt med etablerte rytmer.' },
      { beatName: 'Klimaks med refreng', sceneIntent: 'Størst emosjonelt øyeblikk synker sammen med musikken.' },
      { beatName: 'Outro', sceneIntent: 'Hvor står karakteren nå? Ekko av åpningen?' },
    ],
  },
];

export function buildTemplateLibrary(): TemplateLibrary {
  // Return fresh arrays to keep caller-side mutations isolated.
  return {
    categories: CORE_CATEGORIES.map(category => ({
      ...category,
      templates: category.templates.map(template => ({ ...template })),
    })),
    userTemplates: [],
    recentlyUsed: [],
  };
}

