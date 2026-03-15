export type AcademyPresentationTemplateId =
  | 'product-overview'
  | 'walkthrough'
  | 'onboarding-flow'
  | 'feature-explainer'
  | 'training-deep-dive';

export type AcademyPresentationVisualThemeId =
  | 'neutral-modern'
  | 'sales-command'
  | 'operations-grid'
  | 'offshore-briefing';

export type AcademyPresentationSplitLayoutVariant = 'balanced' | 'presenter-focus' | 'slide-focus';

export type AcademyPresentationDisplayMode =
  | 'picture-in-picture'
  | 'side-panel'
  | 'split-screen'
  | 'full-frame';

export type AcademyPresentationVisualType =
  | 'title'
  | 'agenda'
  | 'problem'
  | 'solution'
  | 'feature'
  | 'process'
  | 'kpi'
  | 'timeline'
  | 'roadmap'
  | 'architecture'
  | 'scenario'
  | 'knowledge-check'
  | 'comparison'
  | 'demo'
  | 'quote'
  | 'cta'
  | 'summary';

export type AcademyPresentationGraphicKind =
  | 'chart'
  | 'icon'
  | 'screenshot'
  | 'illustration'
  | 'photo'
  | 'shape'
  | 'badge';

export type AcademyPresentationSlideGrammarId =
  | 'hero'
  | 'agenda'
  | 'comparison'
  | 'decision-matrix'
  | 'before-after'
  | 'timeline'
  | 'roadmap'
  | 'architecture'
  | 'architecture-diagram'
  | 'product-architecture-flow'
  | 'org-chart'
  | 'scenario'
  | 'decision-tree'
  | 'knowledge-check'
  | 'interactive-quiz'
  | 'process'
  | 'swimlane-process'
  | 'stats'
  | 'chart'
  | 'quote'
  | 'team'
  | 'case-study'
  | 'faq'
  | 'checklist'
  | 'demo'
  | 'cta'
  | 'summary'
  | 'content-grid';

export type AcademyPresentationNarrativeRole =
  | 'hook'
  | 'setup'
  | 'problem'
  | 'solution'
  | 'walkthrough'
  | 'evidence'
  | 'proof'
  | 'decision'
  | 'close';

export type AcademyPresentationRepairActionId =
  | 'compress-title'
  | 'compress-subtitle'
  | 'trim-bullets'
  | 'trim-columns'
  | 'trim-steps'
  | 'trim-stats'
  | 'switch-grammar'
  | 'promote-bullet-to-subtitle'
  | 'extract-cta'
  | 'split-slide';

export interface AcademyPresentationBrandTokens {
  themeId: AcademyPresentationVisualThemeId;
  labelNo: string;
  labelEn: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  surfaceMuted: string;
  canvasBg: string;
  canvasCardBg: string;
  canvasCardBorder: string;
  canvasTitle: string;
  canvasText: string;
  navBg: string;
  navCardBg: string;
  navCardActiveBg: string;
  navText: string;
  navAccent: string;
  presenterBg: string;
  presenterCardBg: string;
  presenterText: string;
  chipBg: string;
  chipText: string;
  headingFont: string;
  bodyFont: string;
  spacingScale: number[];
  cornerRadius: number;
  shadowStrength: number;
  chartStyle: 'bars' | 'line' | 'cards';
  imageStyle: 'editorial' | 'clean-card' | 'technical';
}

export interface AcademyPresentationSlideBudget {
  titleMaxChars: number;
  subtitleMaxChars: number;
  maxBullets: number;
  bulletMaxChars: number;
  maxColumns: number;
  maxTimelineSteps: number;
  maxStats: number;
  maxQuoteChars: number;
  maxCtaChars: number;
}

export interface AcademyPresentationStructuredColumn {
  title: string;
  body: string;
}

export interface AcademyPresentationStructuredStep {
  title: string;
  body: string;
}

export interface AcademyPresentationStructuredStat {
  value: string;
  label: string;
  context: string;
}

export interface AcademyPresentationStructuredContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  columns: AcademyPresentationStructuredColumn[];
  steps: AcademyPresentationStructuredStep[];
  stats: AcademyPresentationStructuredStat[];
  quoteText: string;
  quoteAttribution: string;
  ctaLabel: string;
  ctaSupport: string;
  mediaIntent: string;
  emphasis: string[];
}

export interface AcademyPresentationRepairAction {
  id: AcademyPresentationRepairActionId;
  reason: string;
  from?: string;
  to?: string;
}

export interface AcademyPresentationVisualNeed {
  kind: AcademyPresentationGraphicKind;
  label: string;
  prompt: string;
  priority: 'primary' | 'secondary';
}

export interface AcademyPresentationGraphicSlot {
  id: string;
  kind: AcademyPresentationGraphicKind;
  label: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AcademyPresentationContinuationPlan {
  title: string;
  subtitle: string;
  bullets: string[];
  grammarId: AcademyPresentationSlideGrammarId;
}

export interface AcademyPresentationGrammarPlan {
  grammarId: AcademyPresentationSlideGrammarId;
  narrativeRole: AcademyPresentationNarrativeRole;
  recommendedLayout: AcademyPresentationDisplayMode;
  contentBudget: AcademyPresentationSlideBudget;
  structuredContent: AcademyPresentationStructuredContent;
  repairActions: AcademyPresentationRepairAction[];
  visualNeeds: AcademyPresentationVisualNeed[];
  graphicSlots: AcademyPresentationGraphicSlot[];
}

export const academyPresentationNormalizeToken = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const trimWhitespace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();

const shortSentence = (value: string, maxChars: number): string => {
  const trimmed = trimWhitespace(value);
  if (!trimmed) return '';
  if (trimmed.length <= maxChars) return trimmed;

  const soft = trimmed
    .replace(/\b(veldig|svært|actually|really|basically|simply|just)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (soft.length <= maxChars) return soft;

  const punctuationCut = soft.slice(0, maxChars).replace(/[,:;\-–]\s*[^,:;\-–]*$/, '').trim();
  if (punctuationCut.length >= Math.max(18, Math.floor(maxChars * 0.55))) {
    return `${punctuationCut}…`;
  }

  const spaceCut = soft.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  if (spaceCut.length >= Math.max(18, Math.floor(maxChars * 0.55))) {
    return `${spaceCut}…`;
  }

  return `${soft.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
};

const splitIntoSentences = (value: string): string[] =>
  String(value || '')
    .split(/(?:\n|•|\r|\.\s+|;\s+|\|)/g)
    .map((entry) => trimWhitespace(entry))
    .filter(Boolean);

const splitTitleBody = (value: string): { title: string; body: string } => {
  const raw = trimWhitespace(value);
  if (!raw) return { title: '', body: '' };
  const colonIndex = raw.indexOf(':');
  if (colonIndex > 0 && colonIndex < 42) {
    return {
      title: trimWhitespace(raw.slice(0, colonIndex)),
      body: trimWhitespace(raw.slice(colonIndex + 1)),
    };
  }
  const dashMatch = raw.match(/^(.{1,36}?)[-–]\s+(.+)$/);
  if (dashMatch) {
    return { title: trimWhitespace(dashMatch[1]), body: trimWhitespace(dashMatch[2]) };
  }
  return { title: shortSentence(raw, 34), body: shortSentence(raw, 88) };
};

const extractNumberToken = (value: string): string => {
  const match = String(value || '').match(/(?:[+-]?\d+[\d\s.,]*%?|\bQ[1-4]\b|\b\d+x\b)/i);
  return trimWhitespace(match?.[0] || '');
};

const extractLabelWithoutNumber = (value: string): string => {
  const raw = trimWhitespace(value);
  const number = extractNumberToken(raw);
  if (!number) return shortSentence(raw, 34);
  const label = trimWhitespace(raw.replace(number, '').replace(/^[-:–\s]+|[-:–\s]+$/g, ''));
  return shortSentence(label || raw, 34);
};

const hasTeamSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(team|rolle|role|owner|ansvarlig|stakeholder|crew|regissor|fotograf|producer)/i.test(source);
};

const hasCaseStudySignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(case|kundecase|customer story|scenario|eksempel|brukstilfelle)/i.test(source);
};

const hasBeforeAfterSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(before|after|for etter|foer etter|as is|to be|na situasjon|onsket situasjon|current state|future state)/i.test(source);
};

const hasFaqSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(faq|q a|q&a|frequently asked|vanlige sporsmal|sporsmal og svar|questions and answers)/i.test(source);
};

const hasChecklistSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(checklist|sjekkliste|kontrolliste|must do|remember|husk|do not forget|kontrollpunkt)/i.test(source);
};

const hasRoadmapSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(roadmap|release plan|milepæl|milepael|quarter plan|phase plan|neste fase|next phase)/i.test(source);
};

const hasDecisionMatrixSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(decision matrix|prioriteringsmatrise|prioritization matrix|impact effort|effort impact|scorecard|criteria matrix|weighted criteria|tradeoff matrix)/i.test(source);
};

const hasArchitectureSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(architecture|arkitektur|system map|systemkart|components|komponenter|layers|lag|stack|integration map)/i.test(source);
};

const hasDataFlowSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(data flow|data pipeline|integration flow|request response|event flow|payload flow|source destination|frontend backend data|api flow|sync flow|ingestion)/i.test(source);
};

const hasOrgChartSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(org chart|organization chart|organisasjonskart|team structure|reporting line|lederlinje|ansvarsstruktur)/i.test(source);
};

const hasSwimlaneSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(swimlane|lane|handoff|cross functional|tvers|owner lane|role lane|ansvarslinje|workflow by role|team handoff)/i.test(source);
};

const hasScenarioSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(scenario|situasjon|use case|brukstilfelle|case flow|spill ut|role play|rollespill|case exercise)/i.test(source);
};

const hasKnowledgeCheckSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(knowledge check|quiz|check your understanding|refleksjon|spørsmål|sporsmal|test deg selv|multiple choice)/i.test(source);
};

const hasQuoteSignals = (title: string, lines: string[]): boolean => {
  const source = `${title} ${lines.join(' ')}`;
  return /["“”]/.test(source) || /(quote|testimonial|sitat|feedback)/i.test(source);
};

const hasChartSignals = (title: string, lines: string[]): boolean => {
  const source = academyPresentationNormalizeToken(`${title} ${lines.join(' ')}`);
  return /(chart|graf|trend|fordeling|breakdown|segment|share)/i.test(source);
};

const maxByGrammar: Record<AcademyPresentationSlideGrammarId, AcademyPresentationSlideBudget> = {
  hero: { titleMaxChars: 60, subtitleMaxChars: 100, maxBullets: 3, bulletMaxChars: 82, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 44 },
  agenda: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 5, bulletMaxChars: 72, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  comparison: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 2, bulletMaxChars: 78, maxColumns: 2, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'decision-matrix': { titleMaxChars: 56, subtitleMaxChars: 92, maxBullets: 3, bulletMaxChars: 64, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'before-after': { titleMaxChars: 56, subtitleMaxChars: 88, maxBullets: 2, bulletMaxChars: 74, maxColumns: 2, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  timeline: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 0, bulletMaxChars: 0, maxColumns: 0, maxTimelineSteps: 5, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  roadmap: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 0, bulletMaxChars: 0, maxColumns: 0, maxTimelineSteps: 6, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  architecture: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 2, bulletMaxChars: 74, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'architecture-diagram': { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 2, bulletMaxChars: 74, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'product-architecture-flow': { titleMaxChars: 56, subtitleMaxChars: 92, maxBullets: 3, bulletMaxChars: 72, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'org-chart': { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 1, bulletMaxChars: 68, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  scenario: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 2, bulletMaxChars: 74, maxColumns: 3, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'decision-tree': { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 1, bulletMaxChars: 72, maxColumns: 3, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'knowledge-check': { titleMaxChars: 56, subtitleMaxChars: 96, maxBullets: 0, bulletMaxChars: 0, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'interactive-quiz': { titleMaxChars: 56, subtitleMaxChars: 96, maxBullets: 0, bulletMaxChars: 0, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  process: { titleMaxChars: 56, subtitleMaxChars: 90, maxBullets: 0, bulletMaxChars: 0, maxColumns: 0, maxTimelineSteps: 5, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'swimlane-process': { titleMaxChars: 56, subtitleMaxChars: 92, maxBullets: 3, bulletMaxChars: 64, maxColumns: 3, maxTimelineSteps: 5, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  stats: { titleMaxChars: 52, subtitleMaxChars: 82, maxBullets: 2, bulletMaxChars: 72, maxColumns: 0, maxTimelineSteps: 0, maxStats: 4, maxQuoteChars: 0, maxCtaChars: 40 },
  chart: { titleMaxChars: 52, subtitleMaxChars: 82, maxBullets: 3, bulletMaxChars: 68, maxColumns: 0, maxTimelineSteps: 0, maxStats: 3, maxQuoteChars: 0, maxCtaChars: 40 },
  quote: { titleMaxChars: 52, subtitleMaxChars: 68, maxBullets: 0, bulletMaxChars: 0, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 220, maxCtaChars: 40 },
  team: { titleMaxChars: 52, subtitleMaxChars: 84, maxBullets: 0, bulletMaxChars: 0, maxColumns: 3, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  'case-study': { titleMaxChars: 56, subtitleMaxChars: 96, maxBullets: 3, bulletMaxChars: 74, maxColumns: 3, maxTimelineSteps: 0, maxStats: 2, maxQuoteChars: 0, maxCtaChars: 40 },
  faq: { titleMaxChars: 56, subtitleMaxChars: 88, maxBullets: 0, bulletMaxChars: 0, maxColumns: 4, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  checklist: { titleMaxChars: 56, subtitleMaxChars: 88, maxBullets: 5, bulletMaxChars: 76, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
  demo: { titleMaxChars: 56, subtitleMaxChars: 92, maxBullets: 4, bulletMaxChars: 82, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 44 },
  cta: { titleMaxChars: 54, subtitleMaxChars: 78, maxBullets: 2, bulletMaxChars: 68, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 44 },
  summary: { titleMaxChars: 56, subtitleMaxChars: 92, maxBullets: 4, bulletMaxChars: 80, maxColumns: 0, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 44 },
  'content-grid': { titleMaxChars: 56, subtitleMaxChars: 92, maxBullets: 4, bulletMaxChars: 82, maxColumns: 3, maxTimelineSteps: 0, maxStats: 0, maxQuoteChars: 0, maxCtaChars: 40 },
};

export const ACADEMY_PRESENTATION_GRAMMAR_BUDGETS = maxByGrammar;

export const ACADEMY_PRESENTATION_THEME_TOKENS: Record<
  AcademyPresentationVisualThemeId,
  AcademyPresentationBrandTokens
> = {
  'neutral-modern': {
    themeId: 'neutral-modern',
    labelNo: 'Neutral Modern',
    labelEn: 'Neutral Modern',
    primary: '#315bff',
    secondary: '#5eb7ff',
    accent: '#0fc4a8',
    surface: 'rgba(255,255,255,0.84)',
    surfaceMuted: 'rgba(235,241,251,0.92)',
    canvasBg: 'linear-gradient(180deg, rgba(248,250,255,0.99), rgba(237,243,252,0.99))',
    canvasCardBg: 'rgba(255,255,255,0.82)',
    canvasCardBorder: 'rgba(88,112,162,0.16)',
    canvasTitle: '#10213d',
    canvasText: '#41516f',
    navBg: 'linear-gradient(180deg, rgba(15,23,41,0.96), rgba(9,15,28,0.98))',
    navCardBg: 'rgba(255,255,255,0.04)',
    navCardActiveBg: 'rgba(49,91,255,0.22)',
    navText: '#edf3ff',
    navAccent: '#7aa0ff',
    presenterBg: 'linear-gradient(180deg, rgba(8,14,24,0.3), rgba(7,12,20,0.46))',
    presenterCardBg: 'rgba(11,16,28,0.56)',
    presenterText: '#e6efff',
    chipBg: 'rgba(49,91,255,0.16)',
    chipText: '#dce7ff',
    headingFont: '"Sora", "Segoe UI", sans-serif',
    bodyFont: '"Manrope", "Segoe UI", sans-serif',
    spacingScale: [4, 8, 12, 16, 24, 32],
    cornerRadius: 16,
    shadowStrength: 0.18,
    chartStyle: 'line',
    imageStyle: 'clean-card',
  },
  'sales-command': {
    themeId: 'sales-command',
    labelNo: 'Sales Command',
    labelEn: 'Sales Command',
    primary: '#f8b321',
    secondary: '#ffde7f',
    accent: '#ff7a59',
    surface: 'rgba(255,255,255,0.82)',
    surfaceMuted: 'rgba(252,239,215,0.96)',
    canvasBg: 'linear-gradient(180deg, rgba(255,248,236,0.98), rgba(252,239,215,0.98))',
    canvasCardBg: 'rgba(255,255,255,0.82)',
    canvasCardBorder: 'rgba(166,108,26,0.26)',
    canvasTitle: '#5f2d08',
    canvasText: '#6a3b17',
    navBg: 'linear-gradient(180deg, rgba(48,24,18,0.9), rgba(18,12,8,0.92))',
    navCardBg: 'rgba(29,16,10,0.56)',
    navCardActiveBg: 'rgba(248,179,33,0.35)',
    navText: '#ffeccc',
    navAccent: '#f8b321',
    presenterBg: 'linear-gradient(180deg, rgba(37,20,12,0.4), rgba(20,12,8,0.48))',
    presenterCardBg: 'rgba(35,18,10,0.55)',
    presenterText: '#ffe8c1',
    chipBg: 'rgba(248,179,33,0.22)',
    chipText: '#fff0cf',
    headingFont: '"Sora", "Segoe UI", sans-serif',
    bodyFont: '"Manrope", "Segoe UI", sans-serif',
    spacingScale: [4, 8, 12, 16, 24, 32],
    cornerRadius: 16,
    shadowStrength: 0.24,
    chartStyle: 'bars',
    imageStyle: 'editorial',
  },
  'operations-grid': {
    themeId: 'operations-grid',
    labelNo: 'Operations Grid',
    labelEn: 'Operations Grid',
    primary: '#3ab0ff',
    secondary: '#7ee8b3',
    accent: '#98f5ff',
    surface: 'rgba(236,247,251,0.82)',
    surfaceMuted: 'rgba(223,240,246,0.94)',
    canvasBg: 'linear-gradient(180deg, rgba(236,247,251,0.98), rgba(219,235,242,0.98))',
    canvasCardBg: 'rgba(255,255,255,0.82)',
    canvasCardBorder: 'rgba(38,113,140,0.22)',
    canvasTitle: '#133747',
    canvasText: '#335665',
    navBg: 'linear-gradient(180deg, rgba(8,26,34,0.94), rgba(7,16,24,0.96))',
    navCardBg: 'rgba(8,38,44,0.48)',
    navCardActiveBg: 'rgba(58,176,255,0.22)',
    navText: '#dff8ff',
    navAccent: '#7fe1ff',
    presenterBg: 'linear-gradient(180deg, rgba(7,18,24,0.44), rgba(7,14,19,0.52))',
    presenterCardBg: 'rgba(10,23,31,0.54)',
    presenterText: '#dcfbff',
    chipBg: 'rgba(58,176,255,0.18)',
    chipText: '#d8f2ff',
    headingFont: '"Space Grotesk", "Segoe UI", sans-serif',
    bodyFont: '"Manrope", "Segoe UI", sans-serif',
    spacingScale: [4, 8, 12, 16, 24, 32],
    cornerRadius: 14,
    shadowStrength: 0.18,
    chartStyle: 'cards',
    imageStyle: 'technical',
  },
  'offshore-briefing': {
    themeId: 'offshore-briefing',
    labelNo: 'Offshore Briefing',
    labelEn: 'Offshore Briefing',
    primary: '#54d2ff',
    secondary: '#ffda6b',
    accent: '#7ee8b3',
    surface: 'rgba(238,245,250,0.82)',
    surfaceMuted: 'rgba(226,235,244,0.95)',
    canvasBg: 'linear-gradient(180deg, rgba(235,242,248,0.99), rgba(220,230,239,0.99))',
    canvasCardBg: 'rgba(255,255,255,0.8)',
    canvasCardBorder: 'rgba(74,116,145,0.22)',
    canvasTitle: '#14324a',
    canvasText: '#375066',
    navBg: 'linear-gradient(180deg, rgba(10,21,34,0.96), rgba(6,14,22,0.98))',
    navCardBg: 'rgba(17,28,40,0.5)',
    navCardActiveBg: 'rgba(84,210,255,0.18)',
    navText: '#e6f4ff',
    navAccent: '#8ddcff',
    presenterBg: 'linear-gradient(180deg, rgba(9,16,25,0.42), rgba(7,13,21,0.56))',
    presenterCardBg: 'rgba(12,20,31,0.58)',
    presenterText: '#e8f4ff',
    chipBg: 'rgba(84,210,255,0.16)',
    chipText: '#dff3ff',
    headingFont: '"IBM Plex Sans", "Segoe UI", sans-serif',
    bodyFont: '"Inter", "Segoe UI", sans-serif',
    spacingScale: [4, 8, 12, 16, 24, 32],
    cornerRadius: 14,
    shadowStrength: 0.2,
    chartStyle: 'line',
    imageStyle: 'technical',
  },
};

export const academyPresentationThemeTokens = (
  themeId: AcademyPresentationVisualThemeId,
): AcademyPresentationBrandTokens => ACADEMY_PRESENTATION_THEME_TOKENS[themeId];

const inferGrammarFromVisualType = (
  visualType: AcademyPresentationVisualType,
  title: string,
  lines: string[],
): AcademyPresentationSlideGrammarId => {
  if (visualType === 'title') return 'hero';
  if (visualType === 'agenda') return 'agenda';
  if (visualType === 'timeline') return 'timeline';
  if (visualType === 'roadmap') return 'roadmap';
  if (visualType === 'comparison' && hasDecisionMatrixSignals(title, lines)) return 'decision-matrix';
  if (visualType === 'architecture' && hasDataFlowSignals(title, lines)) return 'product-architecture-flow';
  if (visualType === 'architecture') return 'architecture-diagram';
  if (visualType === 'scenario') return 'decision-tree';
  if (visualType === 'knowledge-check') return 'interactive-quiz';
  if (visualType === 'process' && hasSwimlaneSignals(title, lines)) return 'swimlane-process';
  if (visualType === 'process') return 'process';
  if (visualType === 'comparison') return hasBeforeAfterSignals(title, lines) ? 'before-after' : 'comparison';
  if (visualType === 'kpi') return hasChartSignals(title, lines) ? 'chart' : 'stats';
  if (visualType === 'quote' || hasQuoteSignals(title, lines)) return 'quote';
  if (visualType === 'demo') return 'demo';
  if (visualType === 'cta') return 'cta';
  if (visualType === 'summary') return 'summary';
  if (hasRoadmapSignals(title, lines)) return 'roadmap';
  if (hasDecisionMatrixSignals(title, lines)) return 'decision-matrix';
  if (hasOrgChartSignals(title, lines)) return 'org-chart';
  if (hasDataFlowSignals(title, lines)) return 'product-architecture-flow';
  if (hasArchitectureSignals(title, lines)) return 'architecture-diagram';
  if (hasSwimlaneSignals(title, lines)) return 'swimlane-process';
  if (hasScenarioSignals(title, lines)) return 'decision-tree';
  if (hasKnowledgeCheckSignals(title, lines)) return 'interactive-quiz';
  if (hasBeforeAfterSignals(title, lines)) return 'before-after';
  if (hasFaqSignals(title, lines)) return 'faq';
  if (hasChecklistSignals(title, lines)) return 'checklist';
  if (hasTeamSignals(title, lines)) return 'team';
  if (hasCaseStudySignals(title, lines)) return 'case-study';
  return 'content-grid';
};

const inferNarrativeRole = (
  visualType: AcademyPresentationVisualType,
  index: number,
  totalSlides: number,
): AcademyPresentationNarrativeRole => {
  if (index === 0 || visualType === 'title') return 'hook';
  if (visualType === 'agenda') return 'setup';
  if (visualType === 'problem') return 'problem';
  if (visualType === 'solution') return 'solution';
  if (visualType === 'demo' || visualType === 'process') return 'walkthrough';
  if (visualType === 'kpi' || visualType === 'comparison') return 'evidence';
  if (visualType === 'quote') return 'proof';
  if (visualType === 'cta') return 'decision';
  if (index >= totalSlides - 1 || visualType === 'summary') return 'close';
  return 'setup';
};

export const academyPresentationLayoutForGrammar = (
  grammarId: AcademyPresentationSlideGrammarId,
): AcademyPresentationDisplayMode => {
  if (grammarId === 'hero') return 'full-frame';
  if (
    grammarId === 'agenda' ||
    grammarId === 'summary' ||
    grammarId === 'faq' ||
    grammarId === 'checklist' ||
    grammarId === 'knowledge-check' ||
    grammarId === 'interactive-quiz'
  ) {
    return 'side-panel';
  }
  if (grammarId === 'cta' || grammarId === 'quote') return 'picture-in-picture';
  return 'split-screen';
};

const buildDefaultStructuredContent = (
  title: string,
  lines: string[],
): AcademyPresentationStructuredContent => ({
  eyebrow: '',
  title,
  subtitle: '',
  bullets: lines,
  columns: [],
  steps: [],
  stats: [],
  quoteText: '',
  quoteAttribution: '',
  ctaLabel: '',
  ctaSupport: '',
  mediaIntent: '',
  emphasis: [],
});

const buildContinuation = (
  title: string,
  subtitle: string,
  leftoverBullets: string[],
  grammarId: AcademyPresentationSlideGrammarId,
  useNorwegian: boolean,
): AcademyPresentationContinuationPlan | null => {
  if (leftoverBullets.length === 0) return null;
  return {
    title: `${shortSentence(title, 46)} ${useNorwegian ? 'fortsetter' : 'continued'}`,
    subtitle: shortSentence(subtitle, 92),
    bullets: leftoverBullets.slice(0, 6).map((entry) => shortSentence(entry, 82)),
    grammarId,
  };
};

const buildStatsFromLines = (lines: string[]): AcademyPresentationStructuredStat[] =>
  lines
    .map((line) => ({
      value: shortSentence(extractNumberToken(line) || shortSentence(line, 12), 16),
      label: shortSentence(extractLabelWithoutNumber(line), 28),
      context: shortSentence(line, 72),
    }))
    .filter((entry) => entry.value && entry.label);

const buildColumnsFromLines = (lines: string[]): AcademyPresentationStructuredColumn[] =>
  lines.map((line, index) => {
    const split = splitTitleBody(line);
    return {
      title: split.title || `Item ${index + 1}`,
      body: split.body || shortSentence(line, 78),
    };
  });

const buildStepsFromLines = (lines: string[]): AcademyPresentationStructuredStep[] =>
  lines.map((line, index) => {
    const split = splitTitleBody(line);
    return {
      title: split.title || `Step ${index + 1}`,
      body: split.body || shortSentence(line, 80),
    };
  });

const buildVisualNeeds = (
  grammarId: AcademyPresentationSlideGrammarId,
  title: string,
  mediaIntent: string,
): AcademyPresentationVisualNeed[] => {
  const basePrompt = shortSentence(mediaIntent || title || 'slide visual', 120);
  if (grammarId === 'hero') {
    return [
      { kind: 'photo', label: 'Hero visual', prompt: `${basePrompt} hero visual`, priority: 'primary' },
    ];
  }
  if (grammarId === 'demo') {
    return [
      { kind: 'screenshot', label: 'Product screenshot', prompt: `${basePrompt} interface screenshot`, priority: 'primary' },
      { kind: 'badge', label: 'Callout badge', prompt: `${basePrompt} callout badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'stats' || grammarId === 'chart') {
    return [
      { kind: 'chart', label: 'Chart', prompt: `${basePrompt} data chart`, priority: 'primary' },
      { kind: 'badge', label: 'Metric badge', prompt: `${basePrompt} metric badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'timeline' || grammarId === 'process') {
    return [
      { kind: 'illustration', label: 'Flow visual', prompt: `${basePrompt} flow diagram`, priority: 'primary' },
      { kind: 'icon', label: 'Stage icon', prompt: `${basePrompt} stage icon`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'roadmap') {
    return [
      { kind: 'illustration', label: 'Roadmap visual', prompt: `${basePrompt} roadmap timeline`, priority: 'primary' },
      { kind: 'badge', label: 'Milestone badge', prompt: `${basePrompt} milestone badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'architecture-diagram') {
    return [
      { kind: 'shape', label: 'Architecture diagram', prompt: `${basePrompt} architecture diagram`, priority: 'primary' },
      { kind: 'icon', label: 'System icon', prompt: `${basePrompt} system icon`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'product-architecture-flow') {
    return [
      { kind: 'shape', label: 'Data flow architecture', prompt: `${basePrompt} product architecture data flow`, priority: 'primary' },
      { kind: 'badge', label: 'Flow badge', prompt: `${basePrompt} data flow badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'org-chart') {
    return [
      { kind: 'shape', label: 'Org chart', prompt: `${basePrompt} org chart`, priority: 'primary' },
      { kind: 'badge', label: 'Role badge', prompt: `${basePrompt} role badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'architecture') {
    return [
      { kind: 'shape', label: 'Architecture board', prompt: `${basePrompt} architecture diagram`, priority: 'primary' },
      { kind: 'icon', label: 'System icon', prompt: `${basePrompt} system icon`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'decision-tree') {
    return [
      { kind: 'shape', label: 'Decision tree', prompt: `${basePrompt} decision tree`, priority: 'primary' },
      { kind: 'badge', label: 'Decision badge', prompt: `${basePrompt} decision badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'decision-matrix') {
    return [
      { kind: 'shape', label: 'Decision matrix', prompt: `${basePrompt} decision matrix`, priority: 'primary' },
      { kind: 'badge', label: 'Criteria badge', prompt: `${basePrompt} criteria badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'scenario') {
    return [
      { kind: 'shape', label: 'Scenario cards', prompt: `${basePrompt} scenario cards`, priority: 'primary' },
      { kind: 'badge', label: 'Decision badge', prompt: `${basePrompt} decision badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'interactive-quiz') {
    return [
      { kind: 'shape', label: 'Quiz board', prompt: `${basePrompt} answer options`, priority: 'primary' },
      { kind: 'badge', label: 'Quiz badge', prompt: `${basePrompt} answer badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'swimlane-process') {
    return [
      { kind: 'shape', label: 'Swimlane process', prompt: `${basePrompt} swimlane process`, priority: 'primary' },
      { kind: 'badge', label: 'Owner badge', prompt: `${basePrompt} owner badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'knowledge-check') {
    return [
      { kind: 'shape', label: 'Knowledge check cards', prompt: `${basePrompt} question options`, priority: 'primary' },
      { kind: 'badge', label: 'Answer badge', prompt: `${basePrompt} answer badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'comparison') {
    return [
      { kind: 'shape', label: 'Comparison cards', prompt: `${basePrompt} comparison cards`, priority: 'primary' },
    ];
  }
  if (grammarId === 'before-after') {
    return [
      { kind: 'shape', label: 'Before/after cards', prompt: `${basePrompt} before after comparison`, priority: 'primary' },
      { kind: 'badge', label: 'Impact badge', prompt: `${basePrompt} improvement badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'quote') {
    return [
      { kind: 'photo', label: 'Portrait', prompt: `${basePrompt} portrait`, priority: 'primary' },
    ];
  }
  if (grammarId === 'team') {
    return [
      { kind: 'photo', label: 'Team portraits', prompt: `${basePrompt} team portraits`, priority: 'primary' },
    ];
  }
  if (grammarId === 'faq') {
    return [
      { kind: 'icon', label: 'FAQ icon', prompt: `${basePrompt} FAQ icon`, priority: 'primary' },
      { kind: 'shape', label: 'Answer cards', prompt: `${basePrompt} answer cards`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'checklist') {
    return [
      { kind: 'illustration', label: 'Checklist visual', prompt: `${basePrompt} checklist visual`, priority: 'primary' },
      { kind: 'badge', label: 'Checklist badge', prompt: `${basePrompt} completion badge`, priority: 'secondary' },
    ];
  }
  if (grammarId === 'cta') {
    return [
      { kind: 'illustration', label: 'Action visual', prompt: `${basePrompt} action visual`, priority: 'primary' },
    ];
  }
  return [
    { kind: 'illustration', label: 'Supporting visual', prompt: `${basePrompt} supporting visual`, priority: 'primary' },
    { kind: 'icon', label: 'Support icon', prompt: `${basePrompt} support icon`, priority: 'secondary' },
  ];
};

export const academyPresentationGraphicSlotsForGrammar = (
  slideId: string,
  grammarId: AcademyPresentationSlideGrammarId,
  title: string,
  mediaIntent: string,
): AcademyPresentationGraphicSlot[] => {
  const needs = buildVisualNeeds(grammarId, title, mediaIntent);
  const createSlot = (
    suffix: string,
    kind: AcademyPresentationGraphicKind,
    label: string,
    prompt: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): AcademyPresentationGraphicSlot => ({
    id: `${slideId}-${suffix}`,
    kind,
    label,
    prompt,
    x,
    y,
    width,
    height,
  });

  if (grammarId === 'hero') {
    return [createSlot('hero', needs[0].kind, needs[0].label, needs[0].prompt, 4, 8, 92, 84)];
  }
  if (grammarId === 'agenda' || grammarId === 'summary') {
    return [createSlot('agenda', 'shape', 'Agenda rail', `${title} agenda rail`, 58, 14, 34, 68)];
  }
  if (grammarId === 'comparison') {
    return [
      createSlot('comparison-left', 'shape', 'Left card', `${title} left card`, 54, 16, 19, 64),
      createSlot('comparison-right', 'shape', 'Right card', `${title} right card`, 75, 16, 19, 64),
    ];
  }
  if (grammarId === 'decision-matrix') {
    return [
      createSlot('decision-matrix-board', 'shape', 'Decision matrix', `${title} decision matrix`, 54, 16, 40, 60),
      createSlot('decision-matrix-badge', 'badge', 'Criteria badge', `${title} criteria badge`, 58, 78, 18, 10),
    ];
  }
  if (grammarId === 'before-after') {
    return [
      createSlot('before-card', 'shape', 'Before card', `${title} before card`, 54, 16, 19, 56),
      createSlot('after-card', 'shape', 'After card', `${title} after card`, 75, 16, 19, 56),
      createSlot('impact-badge', 'badge', 'Impact badge', `${title} improvement badge`, 63, 74, 22, 10),
    ];
  }
  if (grammarId === 'timeline' || grammarId === 'process') {
    return [
      createSlot('flow', needs[0].kind, needs[0].label, needs[0].prompt, 54, 14, 40, 68),
      createSlot('flow-chip', 'badge', 'Milestone badge', `${title} milestone badge`, 58, 18, 16, 9),
    ];
  }
  if (grammarId === 'roadmap') {
    return [
      createSlot('roadmap-main', 'illustration', 'Roadmap visual', `${title} roadmap timeline`, 54, 14, 40, 68),
      createSlot('roadmap-badge', 'badge', 'Milestone badge', `${title} milestone badge`, 58, 18, 16, 9),
    ];
  }
  if (grammarId === 'architecture-diagram') {
    return [
      createSlot('architecture-diagram', 'shape', 'Architecture diagram', `${title} architecture diagram`, 54, 16, 40, 60),
    ];
  }
  if (grammarId === 'product-architecture-flow') {
    return [
      createSlot('product-architecture-flow', 'shape', 'Product architecture flow', `${title} data flow architecture`, 54, 16, 40, 60),
      createSlot('product-architecture-badge', 'badge', 'Flow badge', `${title} data flow badge`, 58, 78, 18, 10),
    ];
  }
  if (grammarId === 'org-chart') {
    return [
      createSlot('org-chart', 'shape', 'Org chart', `${title} org chart`, 54, 16, 40, 60),
    ];
  }
  if (grammarId === 'architecture') {
    return [
      createSlot('architecture-board', 'shape', 'Architecture board', `${title} architecture board`, 54, 16, 40, 60),
    ];
  }
  if (grammarId === 'decision-tree') {
    return [
      createSlot('decision-tree', 'shape', 'Decision tree', `${title} decision tree`, 54, 16, 40, 60),
    ];
  }
  if (grammarId === 'scenario') {
    return [
      createSlot('scenario-board', 'shape', 'Scenario board', `${title} scenario board`, 54, 16, 40, 60),
    ];
  }
  if (grammarId === 'interactive-quiz') {
    return [
      createSlot('interactive-quiz', 'shape', 'Interactive quiz', `${title} quiz board`, 54, 18, 40, 60),
    ];
  }
  if (grammarId === 'swimlane-process') {
    return [
      createSlot('swimlane-process', 'shape', 'Swimlane process', `${title} swimlane process`, 54, 14, 40, 62),
      createSlot('swimlane-badge', 'badge', 'Owner badge', `${title} owner badge`, 58, 78, 18, 10),
    ];
  }
  if (grammarId === 'knowledge-check') {
    return [
      createSlot('knowledge-board', 'shape', 'Knowledge check board', `${title} answer options`, 54, 18, 40, 60),
    ];
  }
  if (grammarId === 'stats' || grammarId === 'chart') {
    return [
      createSlot('chart', needs[0].kind, needs[0].label, needs[0].prompt, 54, 14, 40, 44),
      createSlot('badge', 'badge', 'KPI badge', `${title} KPI badge`, 56, 62, 18, 10),
      createSlot('badge-2', 'badge', 'Delta badge', `${title} delta badge`, 76, 62, 18, 10),
    ];
  }
  if (grammarId === 'quote') {
    return [
      createSlot('portrait', 'photo', 'Portrait', `${title} portrait`, 62, 16, 24, 24),
      createSlot('quote-card', 'shape', 'Quote card', `${title} quote card`, 54, 44, 40, 28),
    ];
  }
  if (grammarId === 'team') {
    return [
      createSlot('team-1', 'photo', 'Team member 1', `${title} team portrait 1`, 54, 16, 12, 18),
      createSlot('team-2', 'photo', 'Team member 2', `${title} team portrait 2`, 69, 16, 12, 18),
      createSlot('team-3', 'photo', 'Team member 3', `${title} team portrait 3`, 84, 16, 12, 18),
    ];
  }
  if (grammarId === 'case-study') {
    return [
      createSlot('case-photo', 'photo', 'Case visual', `${title} case visual`, 56, 14, 38, 40),
      createSlot('case-badge', 'badge', 'Result badge', `${title} result badge`, 58, 58, 18, 10),
    ];
  }
  if (grammarId === 'faq') {
    return [
      createSlot('faq-icon', 'icon', 'FAQ icon', `${title} FAQ icon`, 57, 16, 12, 12),
      createSlot('faq-card-1', 'shape', 'Question card 1', `${title} question card 1`, 54, 32, 18, 20),
      createSlot('faq-card-2', 'shape', 'Question card 2', `${title} question card 2`, 75, 32, 18, 20),
      createSlot('faq-card-3', 'shape', 'Question card 3', `${title} question card 3`, 64.5, 56, 18, 20),
    ];
  }
  if (grammarId === 'checklist') {
    return [
      createSlot('checklist-visual', 'illustration', 'Checklist visual', `${title} checklist visual`, 54, 16, 40, 54),
      createSlot('checklist-badge', 'badge', 'Checklist badge', `${title} checklist badge`, 58, 72, 18, 10),
    ];
  }
  if (grammarId === 'demo') {
    return [
      createSlot('demo', 'screenshot', 'Demo frame', `${title} interface screenshot`, 54, 14, 40, 58),
      createSlot('demo-badge', 'badge', 'Callout badge', `${title} callout badge`, 58, 74, 18, 10),
    ];
  }
  if (grammarId === 'cta') {
    return [
      createSlot('cta', 'illustration', 'CTA visual', `${title} CTA illustration`, 54, 14, 40, 56),
      createSlot('cta-badge', 'badge', 'Action badge', `${title} action badge`, 58, 72, 20, 10),
    ];
  }
  return [
    createSlot('main', 'illustration', 'Main visual', `${title} supporting visual`, 54, 14, 40, 58),
    createSlot('support', 'icon', 'Support icon', `${title} support icon`, 58, 74, 14, 10),
  ];
};

export const academyPresentationBuildGrammarPlan = ({
  slideId,
  title,
  bodyLines,
  visualType,
  index,
  totalSlides,
  useNorwegian,
  preferredGrammarId,
  preferredSubtitle,
  preferredBullets,
  preferredQuoteText,
  preferredQuoteAttribution,
  preferredCtaLabel,
  preferredCtaSupport,
  preferredMediaIntent,
}: {
  slideId: string;
  title: string;
  bodyLines: string[];
  visualType: AcademyPresentationVisualType;
  index: number;
  totalSlides: number;
  useNorwegian: boolean;
  preferredGrammarId?: AcademyPresentationSlideGrammarId | null;
  preferredSubtitle?: string;
  preferredBullets?: string[];
  preferredQuoteText?: string;
  preferredQuoteAttribution?: string;
  preferredCtaLabel?: string;
  preferredCtaSupport?: string;
  preferredMediaIntent?: string;
}): AcademyPresentationGrammarPlan & { continuation: AcademyPresentationContinuationPlan | null } => {
  const cleanTitle = trimWhitespace(title) || (useNorwegian ? `Slide ${index + 1}` : `Slide ${index + 1}`);
  const preferredLines = Array.isArray(preferredBullets) && preferredBullets.length > 0 ? preferredBullets : bodyLines;
  const cleanLines = preferredLines
    .flatMap((line) => splitIntoSentences(line))
    .map((line) => shortSentence(line, 140))
    .filter(Boolean);

  let grammarId = preferredGrammarId || inferGrammarFromVisualType(visualType, cleanTitle, cleanLines);
  const narrativeRole = inferNarrativeRole(visualType, index, totalSlides);
  let budget = maxByGrammar[grammarId];
  const repairActions: AcademyPresentationRepairAction[] = [];
  const structured = buildDefaultStructuredContent(shortSentence(cleanTitle, budget.titleMaxChars), cleanLines);
  let continuation: AcademyPresentationContinuationPlan | null = null;

  if (preferredSubtitle) {
    structured.subtitle = shortSentence(preferredSubtitle, budget.subtitleMaxChars);
  }
  if (preferredQuoteText) {
    structured.quoteText = shortSentence(preferredQuoteText, budget.maxQuoteChars || 220);
  }
  if (preferredQuoteAttribution) {
    structured.quoteAttribution = shortSentence(preferredQuoteAttribution, 44);
  }
  if (preferredCtaLabel) {
    structured.ctaLabel = shortSentence(preferredCtaLabel, budget.maxCtaChars || 44);
  }
  if (preferredCtaSupport) {
    structured.ctaSupport = shortSentence(preferredCtaSupport, 72);
  }
  if (preferredMediaIntent) {
    structured.mediaIntent = shortSentence(preferredMediaIntent, 120);
  }

  const maybePromoteFirstLineToSubtitle = () => {
    const firstLine = structured.bullets[0] || '';
    if (!structured.subtitle && firstLine && firstLine.length <= budget.subtitleMaxChars) {
      structured.subtitle = shortSentence(firstLine, budget.subtitleMaxChars);
      structured.bullets = structured.bullets.slice(1);
      repairActions.push({ id: 'promote-bullet-to-subtitle', reason: 'Promoted first supporting line to subtitle for hierarchy.' });
    }
  };

  if (grammarId === 'hero') {
    maybePromoteFirstLineToSubtitle();
    const kept = structured.bullets.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    const leftover = structured.bullets.slice(budget.maxBullets);
    structured.bullets = kept;
    structured.mediaIntent = cleanTitle;
    if (leftover.length > 0) {
      continuation = buildContinuation(cleanTitle, structured.subtitle, leftover, 'content-grid', useNorwegian);
      repairActions.push({ id: 'split-slide', reason: 'Hero slide exceeded bullet budget and was split into a continuation slide.' });
    }
  } else if (grammarId === 'agenda' || grammarId === 'summary' || grammarId === 'content-grid' || grammarId === 'checklist') {
    maybePromoteFirstLineToSubtitle();
    const kept = structured.bullets.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    const leftover = structured.bullets.slice(budget.maxBullets);
    structured.bullets = kept;
    if (cleanLines.length >= 3 && cleanLines.length <= 4 && grammarId === 'content-grid') {
      structured.columns = buildColumnsFromLines(cleanLines.slice(0, Math.min(3, budget.maxColumns))).map((entry) => ({
        title: shortSentence(entry.title, 26),
        body: shortSentence(entry.body, budget.bulletMaxChars),
      }));
      structured.bullets = [];
    }
    if (leftover.length > 0) {
      continuation = buildContinuation(cleanTitle, structured.subtitle, leftover, grammarId, useNorwegian);
      repairActions.push({ id: 'split-slide', reason: 'Content overflow created a continuation slide.' });
    }
  } else if (grammarId === 'before-after') {
    const explicitBefore = cleanLines.find((line) => /^(before|for|foer|na situasjon|current state)\b/i.test(line));
    const explicitAfter = cleanLines.find((line) => /^(after|etter|onsket situasjon|future state|to be)\b/i.test(line));
    const selectedLines = explicitBefore && explicitAfter ? [explicitBefore, explicitAfter] : cleanLines.slice(0, 2);
    if (selectedLines.length < 2) {
      grammarId = 'comparison';
      budget = maxByGrammar[grammarId];
      structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      structured.columns = [];
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Before/after slide did not have two distinct states.',
        from: 'before-after',
        to: 'comparison',
      });
    } else {
      structured.columns = selectedLines.map((entry, index) => {
        const split = splitTitleBody(entry);
        return {
          title: shortSentence(
            split.title ||
              (index === 0 ? (useNorwegian ? 'For' : 'Before') : useNorwegian ? 'Etter' : 'After'),
            24,
          ),
          body: shortSentence(split.body || entry, 74),
        };
      });
      structured.subtitle = cleanLines.length > 2 ? shortSentence(cleanLines[2], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = cleanLines.slice(3, 3 + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'comparison') {
    const comparisonColumns = buildColumnsFromLines(cleanLines.length >= 2 ? cleanLines.slice(0, 2) : [cleanTitle, ...cleanLines].slice(0, 2));
    if (comparisonColumns.length < 2) {
      grammarId = 'content-grid';
      budget = maxByGrammar[grammarId];
      structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      structured.columns = [];
      repairActions.push({ id: 'switch-grammar', reason: 'Not enough symmetric content for comparison slide.', from: 'comparison', to: 'content-grid' });
    } else {
      structured.columns = comparisonColumns.slice(0, budget.maxColumns).map((entry) => ({
        title: shortSentence(entry.title, 24),
        body: shortSentence(entry.body, 76),
      }));
      structured.subtitle = cleanLines.length > 2 ? shortSentence(cleanLines[2], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = [];
    }
  } else if (grammarId === 'decision-matrix') {
    const matrixColumns = buildColumnsFromLines(cleanLines.slice(0, budget.maxColumns));
    if (matrixColumns.length < 2) {
      grammarId = 'comparison';
      budget = maxByGrammar[grammarId];
      structured.columns = buildColumnsFromLines(cleanLines.slice(0, 2)).map((entry) => ({
        title: shortSentence(entry.title, 24),
        body: shortSentence(entry.body, 76),
      }));
      structured.subtitle = cleanLines.length > 2 ? shortSentence(cleanLines[2], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = cleanLines.slice(3, 3 + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Decision matrix needs at least two options or paths to compare.',
        from: 'decision-matrix',
        to: 'comparison',
      });
    } else {
      structured.columns = matrixColumns.map((entry) => ({
        title: shortSentence(entry.title, 20),
        body: shortSentence(entry.body, 44),
      }));
      const remainingLines = cleanLines.slice(matrixColumns.length);
      structured.subtitle = remainingLines[0] ? shortSentence(remainingLines[0], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = remainingLines.slice(1, 1 + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'timeline' || grammarId === 'process' || grammarId === 'roadmap') {
    structured.steps = buildStepsFromLines(cleanLines)
      .slice(0, budget.maxTimelineSteps)
      .map((entry) => ({ title: shortSentence(entry.title, 26), body: shortSentence(entry.body, 82) }));
    structured.subtitle = cleanLines.length > 0 ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : '';
    if (cleanLines.length > budget.maxTimelineSteps) {
      const leftover = cleanLines.slice(budget.maxTimelineSteps).map((entry) => shortSentence(entry, 82));
      continuation = buildContinuation(cleanTitle, structured.subtitle, leftover, grammarId, useNorwegian);
      repairActions.push({ id: 'split-slide', reason: 'Timeline/process content exceeded max steps and was split.' });
    }
  } else if (grammarId === 'swimlane-process') {
    const laneColumns = buildColumnsFromLines(cleanLines.slice(0, budget.maxColumns));
    if (laneColumns.length < 2) {
      grammarId = 'process';
      budget = maxByGrammar[grammarId];
      structured.steps = buildStepsFromLines(cleanLines)
        .slice(0, budget.maxTimelineSteps)
        .map((entry) => ({ title: shortSentence(entry.title, 26), body: shortSentence(entry.body, 82) }));
      structured.subtitle = cleanLines[0] ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : structured.subtitle;
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Swimlane process needs at least two lanes or owners.',
        from: 'swimlane-process',
        to: 'process',
      });
    } else {
      structured.columns = laneColumns.map((entry) => ({
        title: shortSentence(entry.title, 22),
        body: shortSentence(entry.body, 42),
      }));
      const stepLines = cleanLines.slice(laneColumns.length);
      structured.steps = buildStepsFromLines(stepLines)
        .slice(0, budget.maxTimelineSteps)
        .map((entry) => ({ title: shortSentence(entry.title, 22), body: shortSentence(entry.body, 64) }));
      structured.subtitle = stepLines[0] ? shortSentence(stepLines[0], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = stepLines.slice(structured.steps.length, structured.steps.length + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'architecture' || grammarId === 'architecture-diagram') {
    const architectureColumns = buildColumnsFromLines(cleanLines.slice(0, budget.maxColumns));
    if (architectureColumns.length < 2) {
      grammarId = 'content-grid';
      budget = maxByGrammar[grammarId];
      structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Architecture slide needs at least two layers/components.',
        from: 'architecture',
        to: 'content-grid',
      });
    } else {
      structured.columns = architectureColumns.map((entry) => ({
        title: shortSentence(entry.title, 22),
        body: shortSentence(entry.body, 68),
      }));
      structured.subtitle = cleanLines[0] ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = cleanLines.slice(budget.maxColumns, budget.maxColumns + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'product-architecture-flow') {
    const flowColumns = buildColumnsFromLines(cleanLines.slice(0, budget.maxColumns));
    if (flowColumns.length < 2) {
      grammarId = 'architecture-diagram';
      budget = maxByGrammar[grammarId];
      structured.columns = buildColumnsFromLines(cleanLines.slice(0, budget.maxColumns)).map((entry) => ({
        title: shortSentence(entry.title, 22),
        body: shortSentence(entry.body, 68),
      }));
      structured.subtitle = cleanLines[0] ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = cleanLines.slice(budget.maxColumns, budget.maxColumns + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Product architecture flow needs at least two connected components.',
        from: 'product-architecture-flow',
        to: 'architecture-diagram',
      });
    } else {
      structured.columns = flowColumns.map((entry) => ({
        title: shortSentence(entry.title, 22),
        body: shortSentence(entry.body, 54),
      }));
      const remainingLines = cleanLines.slice(flowColumns.length);
      structured.subtitle = remainingLines[0] ? shortSentence(remainingLines[0], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = remainingLines.slice(1, 1 + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'org-chart') {
    const orgColumns = buildColumnsFromLines(cleanLines.slice(0, budget.maxColumns));
    if (orgColumns.length < 2) {
      grammarId = 'content-grid';
      budget = maxByGrammar[grammarId];
      structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Org chart slide needs at least a lead node and one reporting node.',
        from: 'org-chart',
        to: 'content-grid',
      });
    } else {
      structured.columns = orgColumns.map((entry) => ({
        title: shortSentence(entry.title, 22),
        body: shortSentence(entry.body, 58),
      }));
      structured.subtitle = cleanLines[0] ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : structured.subtitle;
      structured.bullets = cleanLines.slice(budget.maxColumns, budget.maxColumns + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'scenario' || grammarId === 'decision-tree') {
    const scenarioLabels = useNorwegian
      ? ['Situasjon', 'Handling', 'Utfall']
      : ['Situation', 'Action', 'Outcome'];
    const scenarioColumns = cleanLines.slice(0, 3).map((line, index) => {
      const split = splitTitleBody(line);
      return {
        title: shortSentence(split.title || scenarioLabels[index] || `Step ${index + 1}`, 24),
        body: shortSentence(split.body || line, 74),
      };
    });
    if (scenarioColumns.length < 2) {
      grammarId = 'content-grid';
      budget = maxByGrammar[grammarId];
        structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
        repairActions.push({
          id: 'switch-grammar',
          reason: 'Scenario slide needs at least a context and an action/outcome.',
          from: grammarId,
          to: 'content-grid',
        });
      } else {
        structured.columns = scenarioColumns;
        structured.subtitle = cleanLines.length > 3 ? shortSentence(cleanLines[3], budget.subtitleMaxChars) : structured.subtitle;
        structured.bullets = cleanLines.slice(4, 4 + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      }
  } else if (grammarId === 'knowledge-check' || grammarId === 'interactive-quiz') {
    structured.subtitle = shortSentence(cleanLines[0] || structured.subtitle, budget.subtitleMaxChars);
    const optionLines = cleanLines.slice(1, 1 + budget.maxColumns);
    if (optionLines.length < 2) {
      grammarId = 'content-grid';
      budget = maxByGrammar[grammarId];
      structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      repairActions.push({
        id: 'switch-grammar',
        reason: 'Knowledge-check slide needs a question and at least two answer options.',
        from: grammarId,
        to: 'content-grid',
      });
    } else {
      structured.columns = optionLines.map((line, index) => ({
        title: shortSentence(
          useNorwegian ? `Alternativ ${index + 1}` : `Option ${index + 1}`,
          18,
        ),
        body: shortSentence(line, 74),
      }));
      structured.bullets = [];
      structured.ctaLabel = shortSentence(
        useNorwegian ? 'Svar og reflekter' : 'Answer and reflect',
        budget.maxCtaChars,
      );
      structured.ctaSupport = shortSentence(
        cleanLines[1 + optionLines.length] || '',
        72,
      );
    }
  } else if (grammarId === 'stats' || grammarId === 'chart') {
    const stats = buildStatsFromLines(cleanLines).slice(0, budget.maxStats);
    if (stats.length < 2) {
      const previousGrammar = grammarId;
      grammarId = 'content-grid';
      budget = maxByGrammar[grammarId];
      structured.bullets = cleanLines.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
      repairActions.push({ id: 'switch-grammar', reason: 'Not enough numeric signals for stats/chart slide.', from: previousGrammar, to: 'content-grid' });
    } else {
      structured.stats = stats.map((entry) => ({
        value: shortSentence(entry.value, 16),
        label: shortSentence(entry.label, 22),
        context: shortSentence(entry.context, 64),
      }));
      structured.subtitle = cleanLines.find((line) => !extractNumberToken(line))
        ? shortSentence(cleanLines.find((line) => !extractNumberToken(line)) || '', budget.subtitleMaxChars)
        : '';
      structured.bullets = cleanLines
        .filter((line) => !structured.stats.some((stat) => line.includes(stat.value)))
        .slice(0, Math.min(2, budget.maxBullets))
        .map((entry) => shortSentence(entry, budget.bulletMaxChars));
    }
  } else if (grammarId === 'quote') {
    const quoteSource = cleanLines.join(' ');
    structured.quoteText = shortSentence(quoteSource || cleanTitle, budget.maxQuoteChars);
    structured.quoteAttribution = cleanLines[1] ? shortSentence(cleanLines[1], 44) : (useNorwegian ? 'Instruktør eller kunde' : 'Instructor or customer');
    structured.subtitle = cleanLines[0] ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : '';
    structured.bullets = [];
  } else if (grammarId === 'team') {
    structured.columns = buildColumnsFromLines(cleanLines)
      .slice(0, budget.maxColumns)
      .map((entry) => ({ title: shortSentence(entry.title, 24), body: shortSentence(entry.body, 74) }));
    structured.subtitle = shortSentence(cleanLines[0] || '', budget.subtitleMaxChars);
    if (cleanLines.length > budget.maxColumns) {
      repairActions.push({ id: 'trim-columns', reason: 'Team slide was capped to three people/cards.' });
    }
  } else if (grammarId === 'case-study') {
    maybePromoteFirstLineToSubtitle();
    structured.columns = buildColumnsFromLines(cleanLines.slice(0, Math.min(3, Math.max(0, budget.maxColumns)))).map((entry) => ({
      title: shortSentence(entry.title, 24),
      body: shortSentence(entry.body, 72),
    }));
    structured.stats = buildStatsFromLines(cleanLines).slice(0, Math.min(2, budget.maxStats));
    structured.bullets = structured.bullets.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
  } else if (grammarId === 'faq') {
    structured.columns = buildColumnsFromLines(cleanLines)
      .slice(0, budget.maxColumns)
      .map((entry, index) => ({
        title: shortSentence(entry.title || (useNorwegian ? `Sporsmal ${index + 1}` : `Question ${index + 1}`), 38),
        body: shortSentence(entry.body, 90),
      }));
    structured.subtitle = structured.columns.length > 0 ? structured.subtitle : shortSentence(cleanLines[0] || '', budget.subtitleMaxChars);
    structured.bullets = [];
    if (cleanLines.length > budget.maxColumns) {
      repairActions.push({ id: 'trim-columns', reason: 'FAQ slide was capped to four question cards.' });
    }
  } else if (grammarId === 'demo') {
    maybePromoteFirstLineToSubtitle();
    structured.bullets = structured.bullets.slice(0, budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    structured.mediaIntent = cleanTitle;
    if (cleanLines.length > budget.maxBullets + (structured.subtitle ? 1 : 0)) {
      const leftover = cleanLines.slice(structured.subtitle ? budget.maxBullets + 1 : budget.maxBullets);
      continuation = buildContinuation(cleanTitle, structured.subtitle, leftover, 'content-grid', useNorwegian);
      repairActions.push({ id: 'split-slide', reason: 'Demo notes exceeded safe text budget and were split.' });
    }
  } else if (grammarId === 'cta') {
    structured.subtitle = cleanLines[0] ? shortSentence(cleanLines[0], budget.subtitleMaxChars) : structured.subtitle;
    structured.ctaLabel = shortSentence(cleanLines[1] || (useNorwegian ? 'Fortsett til neste steg' : 'Continue to the next step'), budget.maxCtaChars);
    structured.ctaSupport = shortSentence(cleanLines[2] || '', 72);
    structured.bullets = cleanLines.slice(3, 3 + budget.maxBullets).map((entry) => shortSentence(entry, budget.bulletMaxChars));
    structured.mediaIntent = cleanTitle;
  }

  structured.title = shortSentence(structured.title, budget.titleMaxChars);
  structured.subtitle = shortSentence(structured.subtitle, budget.subtitleMaxChars);
  structured.ctaLabel = shortSentence(structured.ctaLabel, budget.maxCtaChars);
  structured.ctaSupport = shortSentence(structured.ctaSupport, 72);
  structured.bullets = structured.bullets.map((entry) => shortSentence(entry, budget.bulletMaxChars)).slice(0, budget.maxBullets);

  const visualNeeds = buildVisualNeeds(grammarId, structured.title, structured.mediaIntent || structured.subtitle || structured.title);
  const graphicSlots = academyPresentationGraphicSlotsForGrammar(
    slideId,
    grammarId,
    structured.title,
    structured.mediaIntent || structured.subtitle || structured.title,
  );

  return {
    grammarId,
    narrativeRole,
    recommendedLayout: academyPresentationLayoutForGrammar(grammarId),
    contentBudget: budget,
    structuredContent: structured,
    repairActions,
    visualNeeds,
    graphicSlots,
    continuation,
  };
};
