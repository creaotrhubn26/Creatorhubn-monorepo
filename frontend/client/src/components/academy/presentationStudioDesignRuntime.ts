import {
  type AcademyPresentationBrandTokens,
  type AcademyPresentationGraphicKind,
  type AcademyPresentationGraphicSlot,
  type AcademyPresentationSlideBudget,
  type AcademyPresentationSlideGrammarId,
  type AcademyPresentationStructuredContent,
  type AcademyPresentationVisualNeed,
} from '@shared/academy-presentation-design-system';

export type PresentationRuntimeElementType = 'text' | 'shape' | 'image' | 'video';

export interface PresentationRuntimeSceneElement {
  id: string;
  type: PresentationRuntimeElementType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role?: string;
  graphicKind?: AcademyPresentationGraphicKind;
  assetDataUrl?: string;
}

export interface PresentationDesignFinding {
  id: string;
  slideId?: string;
  severity: 'warning' | 'error';
  category: 'timing' | 'content' | 'hierarchy' | 'visual' | 'balance' | 'grammar';
  penalty: number;
  messageNo: string;
  messageEn: string;
}

export interface PresentationSlideDesignEvaluation {
  slideId: string;
  overall: number;
  content: number;
  hierarchy: number;
  balance: number;
  visuals: number;
  grammar: number;
  findings: PresentationDesignFinding[];
}

export interface PresentationDeckDesignEvaluation {
  overall: number;
  content: number;
  hierarchy: number;
  balance: number;
  visuals: number;
  grammar: number;
  slides: PresentationSlideDesignEvaluation[];
  findings: PresentationDesignFinding[];
}

export interface PresentationDeckDesignEvaluationInput {
  maxTimeline: number;
  themeTokens: AcademyPresentationBrandTokens;
  slides: Array<{
    slideId: string;
    title: string;
    startTime: number;
    duration: number;
    overlapSeconds: number;
    elements: PresentationRuntimeSceneElement[];
    grammarId: AcademyPresentationSlideGrammarId;
    contentBudget: AcademyPresentationSlideBudget;
    structuredContent: AcademyPresentationStructuredContent;
    visualNeeds: AcademyPresentationVisualNeed[];
  }>;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const alphaHex = (hex: string, opacity: number): string => {
  const normalized = String(hex || '').trim();
  const target = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  const expanded =
    target.length === 3
      ? target
          .split('')
          .map((entry) => `${entry}${entry}`)
          .join('')
      : target;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return hex;
  }
  const safeOpacity = clamp(opacity, 0, 1);
  const alphaChannel = Math.round(safeOpacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${expanded}${alphaChannel}`;
};

const escapeSvgText = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const encodeSvgToDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const shortText = (value: string, maxChars: number): string => {
  const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxChars) return trimmed;
  const soft = trimmed.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  if (!soft) return trimmed.slice(0, Math.max(0, maxChars - 1)).trim();
  return `${soft}...`;
};

const keywordHash = (value: string): number => {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const splitLines = (value: string, maxChars: number, maxLines: number): string[] => {
  const sentence = String(value || '').replace(/\s+/g, ' ').trim();
  if (!sentence) return [];
  const words = sentence.split(' ');
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) lines.push(current);
  return lines.slice(0, maxLines).map((line) => shortText(line, maxChars));
};

const monogram = (value: string): string => {
  const parts = String(value || '')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'AI';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

type PresentationChartVariant = 'bars' | 'line' | 'cards';
type PresentationGraphicRenderVariant =
  | 'hero-photo'
  | 'portrait-photo'
  | 'team-photo'
  | 'editorial-photo'
  | 'dashboard-screenshot'
  | 'workflow-screenshot'
  | 'timeline-infographic'
  | 'roadmap-infographic'
  | 'process-infographic'
  | 'swimlane-process-board'
  | 'checklist-infographic'
  | 'support-infographic'
  | 'comparison-board'
  | 'decision-matrix-board'
  | 'before-after-board'
  | 'architecture-board'
  | 'product-architecture-flow-board'
  | 'org-chart-board'
  | 'scenario-board'
  | 'decision-tree-board'
  | 'knowledge-check-board'
  | 'interactive-quiz-board'
  | 'faq-board'
  | 'agenda-board'
  | 'case-study-board'
  | 'support-board'
  | 'badge'
  | 'icon'
  | 'shape'
  | 'chart';

export interface PresentationGraphicPlan {
  renderVariant: PresentationGraphicRenderVariant;
  chartVariant: PresentationChartVariant;
  prefersReferenceAsset: boolean;
  referenceQueries: string[];
  preferredSources: string[];
}

const normalizeSearchToken = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueQueries = (values: string[]): string[] => {
  const seen = new Set<string>();
  const results: string[] = [];
  values.forEach((value) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(normalized);
  });
  return results;
};

const hasAnySignal = (source: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(source));

const buildGraphicSearchContext = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
): string =>
  normalizeSearchToken(
    [
      slot.label,
      slot.prompt,
      structuredContent.title,
      structuredContent.subtitle,
      structuredContent.mediaIntent,
      structuredContent.quoteAttribution,
      ...structuredContent.bullets,
      ...structuredContent.emphasis,
      ...structuredContent.columns.flatMap((entry) => [entry.title, entry.body]),
      ...structuredContent.steps.flatMap((entry) => [entry.title, entry.body]),
      ...structuredContent.stats.flatMap((entry) => [entry.value, entry.label, entry.context]),
    ].join(' '),
  );

const buildSearchPhrases = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  variants: string[],
): string[] => {
  const title = shortText(
    structuredContent.mediaIntent ||
      structuredContent.title ||
      structuredContent.subtitle ||
      slot.prompt ||
      slot.label,
    80,
  );
  const secondary = shortText(
    structuredContent.subtitle ||
      structuredContent.columns[0]?.title ||
      structuredContent.steps[0]?.title ||
      structuredContent.quoteAttribution ||
      slot.label,
    72,
  );
  return uniqueQueries([
    ...variants.map((variant) => `${title} ${variant}`.trim()),
    `${title} ${secondary}`.trim(),
    title,
  ]).slice(0, 4);
};

const inferChartVariant = (
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
): PresentationChartVariant => {
  const stats = structuredContent.stats.slice(0, 4);
  const tokenSource = normalizeSearchToken(
    `${structuredContent.title} ${structuredContent.subtitle} ${stats.map((entry) => `${entry.value} ${entry.label}`).join(' ')}`,
  );
  const looksSequential = /(jan|feb|mar|apr|mai|jun|jul|aug|sep|oct|okt|nov|dec|q1|q2|q3|q4|week|uke|month|maned|year|trend|trajectory|utvikling)/i.test(
    tokenSource,
  );
  if (theme.chartStyle === 'cards' && stats.length <= 3) return 'cards';
  if (looksSequential || theme.chartStyle === 'line') return 'line';
  if (stats.length <= 2 && theme.chartStyle === 'cards') return 'cards';
  return 'bars';
};

export const buildPresentationGraphicPlan = ({
  slot,
  structuredContent,
  theme,
  grammarId,
}: {
  slot: AcademyPresentationGraphicSlot;
  structuredContent: AcademyPresentationStructuredContent;
  theme: AcademyPresentationBrandTokens;
  grammarId?: AcademyPresentationSlideGrammarId;
}): PresentationGraphicPlan => {
  const source = buildGraphicSearchContext(slot, structuredContent);
  const teamSignals = hasAnySignal(source, [/\b(team|crew|owner|ansvarlig|rolle|stakeholder)\b/i]);
  const portraitSignals = hasAnySignal(source, [/\b(quote|testimonial|portrait|kunde|speaker|instructor|instruktor)\b/i]);
  const dashboardSignals = hasAnySignal(source, [/\b(app|platform|dashboard|product|ui|grensesnitt|screen|demo|flow|portal|workspace)\b/i]);
  const processSignals = hasAnySignal(source, [/\b(process|prosess|workflow|flow|step|stage|runbook|operasjon|pipeline)\b/i]);
  const timelineSignals = hasAnySignal(source, [/\b(timeline|roadmap|quarter|mile|phase|milestone|release)\b/i]);
  const faqSignals = hasAnySignal(source, [/\b(faq|question|sporsmal|svar|answer)\b/i]);
  const checklistSignals = hasAnySignal(source, [/\b(checklist|sjekkliste|remember|must|kontrollpunkt|verify|compliance)\b/i]);
  const comparisonSignals = hasAnySignal(source, [/\b(compare|comparison|versus|vs|option|alternativ)\b/i]);
  const beforeAfterSignals = hasAnySignal(source, [/\b(before|after|for|etter|current state|future state|as is|to be)\b/i]);
  const caseSignals = hasAnySignal(source, [/\b(case|scenario|kundecase|result|outcome|proof)\b/i]);

  if (slot.kind === 'chart') {
    return {
      renderVariant: 'chart',
      chartVariant: inferChartVariant(structuredContent, theme),
      prefersReferenceAsset: false,
      referenceQueries: [],
      preferredSources: [],
    };
  }

  if (slot.kind === 'screenshot') {
    return {
      renderVariant: dashboardSignals ? 'dashboard-screenshot' : 'workflow-screenshot',
      chartVariant: inferChartVariant(structuredContent, theme),
      prefersReferenceAsset: true,
      referenceQueries: buildSearchPhrases(
        slot,
        structuredContent,
        dashboardSignals
          ? ['product dashboard screenshot', 'saas ui screen', 'analytics workspace']
          : ['workflow screenshot', 'product walkthrough screen', 'interface step view'],
      ),
      preferredSources: ['resource', 'video-poster', 'lesson-thumbnail', 'course-thumbnail'],
    };
  }

  if (slot.kind === 'photo') {
    const renderVariant =
      teamSignals || grammarId === 'team'
        ? 'team-photo'
        : portraitSignals || grammarId === 'quote'
          ? 'portrait-photo'
          : grammarId === 'case-study'
            ? 'editorial-photo'
            : 'hero-photo';
    const variants =
      renderVariant === 'team-photo'
        ? ['team collaboration office', 'professional team portrait']
        : renderVariant === 'portrait-photo'
          ? ['professional portrait studio', 'speaker portrait soft light']
          : renderVariant === 'editorial-photo'
            ? ['editorial workplace photo', 'customer success office']
            : ['editorial hero image', 'cinematic workspace professional'];
    return {
      renderVariant,
      chartVariant: inferChartVariant(structuredContent, theme),
      prefersReferenceAsset: true,
      referenceQueries: buildSearchPhrases(slot, structuredContent, variants),
      preferredSources: ['unsplash', 'pexels', 'pixabay'],
    };
  }

  if (slot.kind === 'illustration') {
    let renderVariant: PresentationGraphicRenderVariant = 'support-infographic';
    if (grammarId === 'timeline' || timelineSignals) renderVariant = 'timeline-infographic';
    else if (grammarId === 'roadmap') renderVariant = 'roadmap-infographic';
    else if (grammarId === 'process' || processSignals) renderVariant = 'process-infographic';
    else if (grammarId === 'checklist' || checklistSignals) renderVariant = 'checklist-infographic';
    return {
      renderVariant,
      chartVariant: inferChartVariant(structuredContent, theme),
      prefersReferenceAsset: false,
      referenceQueries: [],
      preferredSources: [],
    };
  }

  if (slot.kind === 'shape') {
    let renderVariant: PresentationGraphicRenderVariant = 'support-board';
    if (grammarId === 'comparison' || comparisonSignals) renderVariant = 'comparison-board';
    else if (grammarId === 'decision-matrix') renderVariant = 'decision-matrix-board';
    else if (grammarId === 'before-after' || beforeAfterSignals) renderVariant = 'before-after-board';
    else if (grammarId === 'architecture' || grammarId === 'architecture-diagram') renderVariant = 'architecture-board';
    else if (grammarId === 'product-architecture-flow') renderVariant = 'product-architecture-flow-board';
    else if (grammarId === 'org-chart') renderVariant = 'org-chart-board';
    else if (grammarId === 'scenario') renderVariant = 'scenario-board';
    else if (grammarId === 'decision-tree') renderVariant = 'decision-tree-board';
    else if (grammarId === 'knowledge-check') renderVariant = 'knowledge-check-board';
    else if (grammarId === 'interactive-quiz') renderVariant = 'interactive-quiz-board';
    else if (grammarId === 'swimlane-process') renderVariant = 'swimlane-process-board';
    else if (grammarId === 'faq' || faqSignals) renderVariant = 'faq-board';
    else if (grammarId === 'agenda' || grammarId === 'summary') renderVariant = 'agenda-board';
    else if (grammarId === 'case-study' || caseSignals) renderVariant = 'case-study-board';
    return {
      renderVariant,
      chartVariant: inferChartVariant(structuredContent, theme),
      prefersReferenceAsset: false,
      referenceQueries: [],
      preferredSources: [],
    };
  }

  if (slot.kind === 'badge') {
    return {
      renderVariant: 'badge',
      chartVariant: inferChartVariant(structuredContent, theme),
      prefersReferenceAsset: false,
      referenceQueries: [],
      preferredSources: [],
    };
  }

  return {
    renderVariant: 'icon',
    chartVariant: inferChartVariant(structuredContent, theme),
    prefersReferenceAsset: false,
    referenceQueries: [],
    preferredSources: [],
  };
};

export const buildPresentationReferenceQueries = ({
  slot,
  structuredContent,
  theme,
  grammarId,
}: {
  slot: AcademyPresentationGraphicSlot;
  structuredContent: AcademyPresentationStructuredContent;
  theme: AcademyPresentationBrandTokens;
  grammarId?: AcademyPresentationSlideGrammarId;
}): string[] =>
  buildPresentationGraphicPlan({
    slot,
    structuredContent,
    theme,
    grammarId,
  }).referenceQueries;

const renderChartAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
  chartVariant: PresentationChartVariant,
): string => {
  const stats = structuredContent.stats.slice(0, 4);
  const values = stats.map((entry, index) => {
    const match = String(entry.value || '').match(/-?\d+(?:[.,]\d+)?/);
    const numeric = match ? Number(match[0].replace(',', '.')) : 20 + index * 10;
    return Number.isFinite(numeric) ? Math.abs(numeric) : 20 + index * 10;
  });
  const maxValue = Math.max(1, ...values);
  const chartBars = stats
    .map((entry, index) => {
      const barHeight = Math.max(18, Math.round((values[index] / maxValue) * 98));
      const x = 26 + index * 74;
      const y = 146 - barHeight;
      const fill = index % 2 === 0 ? theme.primary : theme.secondary;
      return `
        <rect x="${x}" y="${y}" width="40" height="${barHeight}" rx="12" fill="${fill}" opacity="0.92" />
        <text x="${x + 20}" y="166" text-anchor="middle" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14" font-weight="700">${escapeSvgText(shortText(entry.label || `Stat ${index + 1}`, 10))}</text>
        <text x="${x + 20}" y="${y - 8}" text-anchor="middle" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.value || '0', 10))}</text>`;
    })
    .join('');
  const linePoints = stats
    .map((entry, index) => {
      const x = 54 + index * (stats.length <= 1 ? 0 : 500 / Math.max(1, stats.length - 1));
      const y = 244 - (values[index] / maxValue) * 124;
      return { x: Math.round(x), y: Math.round(y), entry };
    });
  const linePath = linePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const lineMarkup = `
    <path d="${linePath}" fill="none" stroke="${theme.primary}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
    ${linePoints
      .map(
        (point) => `
          <circle cx="${point.x}" cy="${point.y}" r="8" fill="${theme.secondary}" stroke="${theme.canvasBg}" stroke-width="4" />
          <text x="${point.x}" y="${point.y - 16}" text-anchor="middle" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="16" font-weight="800">${escapeSvgText(shortText(point.entry.value || '0', 10))}</text>
          <text x="${point.x}" y="286" text-anchor="middle" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14" font-weight="700">${escapeSvgText(shortText(point.entry.label || '', 12))}</text>`,
      )
      .join('')}
  `;
  const cardsMarkup = stats
    .map((entry, index) => {
      const x = 34 + (index % 2) * 286;
      const y = 112 + Math.floor(index / 2) * 96;
      const fill = index % 2 === 0 ? alphaHex(theme.primary, 0.12) : alphaHex(theme.secondary, 0.12);
      return `
        <rect x="${x}" y="${y}" width="256" height="78" rx="20" fill="${fill}" stroke="${alphaHex(theme.canvasCardBorder, 0.92)}" />
        <text x="${x + 18}" y="${y + 32}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="28" font-weight="900">${escapeSvgText(shortText(entry.value || '0', 12))}</text>
        <text x="${x + 18}" y="${y + 56}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="15" font-weight="700">${escapeSvgText(shortText(entry.label || `Metric ${index + 1}`, 26))}</text>`;
    })
    .join('');
  const chartMarkup =
    chartVariant === 'line'
      ? lineMarkup
      : chartVariant === 'cards'
        ? cardsMarkup
        : chartBars;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="chartBg-${escapeSvgText(slot.id)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.surface}" />
          <stop offset="100%" stop-color="${theme.surfaceMuted}" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="32" fill="url(#chartBg-${escapeSvgText(slot.id)})" />
      <rect x="22" y="22" width="596" height="316" rx="26" fill="${alphaHex(theme.canvasCardBg, 0.96)}" stroke="${alphaHex(theme.canvasCardBorder, 0.8)}" />
      <text x="34" y="58" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="28" font-weight="800">${escapeSvgText(shortText(structuredContent.title || slot.label, 36))}</text>
      <text x="34" y="86" fill="${alphaHex(theme.canvasText, 0.86)}" font-family="${theme.bodyFont}" font-size="16">${escapeSvgText(shortText(structuredContent.subtitle || structuredContent.mediaIntent || slot.prompt, 70))}</text>
      ${
        chartVariant !== 'cards'
          ? `<line x1="34" y1="284" x2="606" y2="284" stroke="${alphaHex(theme.canvasText, 0.2)}" stroke-width="2" />`
          : ''
      }
      ${chartMarkup}
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

const renderScreenshotAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
  renderVariant: PresentationGraphicRenderVariant,
): string => {
  const panels = (
    structuredContent.bullets.length > 0
      ? structuredContent.bullets
      : structuredContent.steps.map((entry) => `${entry.title}: ${entry.body}`.trim())
  ).slice(0, 3);
  const rows = panels.map((entry, index) => {
    const y = 112 + index * 56;
    return `
      <rect x="188" y="${y}" width="344" height="42" rx="12" fill="${alphaHex(theme.canvasBg, 0.9)}" />
      <rect x="206" y="${y + 12}" width="${252 - index * 18}" height="10" rx="5" fill="${alphaHex(theme.canvasText, 0.22)}" />
      <rect x="206" y="${y + 27}" width="${166 - index * 12}" height="7" rx="4" fill="${alphaHex(theme.canvasText, 0.12)}" />
      <text x="68" y="${y + 25}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="16" font-weight="700">${index + 1}</text>
      <text x="96" y="${y + 25}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="15" font-weight="700">${escapeSvgText(shortText(entry, 30))}</text>`;
  }).join('');
  const metricCards = structuredContent.stats
    .slice(0, 2)
    .map((entry, index) => {
      const x = 188 + index * 176;
      return `
        <rect x="${x}" y="82" width="156" height="42" rx="12" fill="${alphaHex(index === 0 ? theme.primary : theme.secondary, 0.14)}" />
        <text x="${x + 16}" y="100" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.value, 12))}</text>
        <text x="${x + 16}" y="116" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="11" font-weight="700">${escapeSvgText(shortText(entry.label, 18))}</text>`;
    })
    .join('');
  const browserTabs =
    renderVariant === 'dashboard-screenshot'
      ? `
        <rect x="188" y="52" width="88" height="18" rx="9" fill="${alphaHex(theme.primary, 0.16)}" />
        <rect x="282" y="52" width="74" height="18" rx="9" fill="${alphaHex(theme.canvasText, 0.12)}" />
        <rect x="362" y="52" width="68" height="18" rx="9" fill="${alphaHex(theme.canvasText, 0.12)}" />`
      : '';
  const mainChart =
    renderVariant === 'dashboard-screenshot'
      ? `
        <rect x="370" y="82" width="162" height="128" rx="16" fill="${alphaHex(theme.surfaceMuted, 0.98)}" />
        <polyline points="386,188 416,154 446,162 478,130 512,114" fill="none" stroke="${theme.primary}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="416" cy="154" r="5" fill="${theme.secondary}" />
        <circle cx="478" cy="130" r="5" fill="${theme.secondary}" />
        <circle cx="512" cy="114" r="5" fill="${theme.secondary}" />`
      : `
        <rect x="370" y="82" width="162" height="128" rx="16" fill="${alphaHex(theme.surfaceMuted, 0.98)}" />
        <rect x="388" y="102" width="126" height="12" rx="6" fill="${alphaHex(theme.canvasText, 0.16)}" />
        <rect x="388" y="124" width="98" height="10" rx="5" fill="${alphaHex(theme.canvasText, 0.1)}" />
        <rect x="388" y="154" width="108" height="36" rx="10" fill="${alphaHex(theme.primary, 0.12)}" />`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="32" fill="${theme.surface}" />
      <rect x="28" y="24" width="584" height="312" rx="28" fill="${theme.canvasBg}" stroke="${alphaHex(theme.primary, 0.24)}" />
      <rect x="28" y="24" width="584" height="34" rx="28" fill="${alphaHex(theme.primary, 0.16)}" />
      <circle cx="58" cy="41" r="6" fill="${alphaHex(theme.primary, 0.7)}" />
      <circle cx="80" cy="41" r="6" fill="${alphaHex(theme.secondary, 0.66)}" />
      <circle cx="102" cy="41" r="6" fill="${alphaHex(theme.accent, 0.7)}" />
      <rect x="48" y="78" width="104" height="214" rx="18" fill="${alphaHex(theme.surfaceMuted, 0.92)}" />
      <rect x="60" y="98" width="80" height="18" rx="9" fill="${alphaHex(theme.primary, 0.14)}" />
      <rect x="60" y="126" width="64" height="12" rx="6" fill="${alphaHex(theme.canvasText, 0.12)}" />
      <rect x="60" y="154" width="64" height="12" rx="6" fill="${alphaHex(theme.canvasText, 0.12)}" />
      <rect x="60" y="198" width="80" height="22" rx="11" fill="${alphaHex(theme.secondary, 0.18)}" />
      <text x="188" y="92" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="24" font-weight="800">${escapeSvgText(shortText(structuredContent.title || slot.label, 34))}</text>
      <text x="188" y="116" fill="${alphaHex(theme.canvasText, 0.82)}" font-family="${theme.bodyFont}" font-size="15">${escapeSvgText(shortText(structuredContent.subtitle || structuredContent.mediaIntent || slot.prompt, 58))}</text>
      ${browserTabs}
      ${metricCards}
      ${mainChart}
      ${rows}
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

const renderBadgeAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
): string => {
  const label = shortText(
    structuredContent.stats[0]?.value ||
      structuredContent.ctaLabel ||
      structuredContent.emphasis[0] ||
      structuredContent.bullets[0] ||
      slot.label,
    24,
  );
  const support = shortText(
    structuredContent.stats[0]?.label || structuredContent.ctaSupport || structuredContent.subtitle || slot.prompt,
    28,
  );
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">
      <rect width="320" height="160" rx="26" fill="${alphaHex(theme.accent, 0.18)}" stroke="${alphaHex(theme.accent, 0.48)}" />
      <rect x="16" y="16" width="54" height="54" rx="18" fill="${theme.accent}" opacity="0.92" />
      <text x="43" y="51" text-anchor="middle" fill="#0d1017" font-family="${theme.headingFont}" font-size="22" font-weight="800">${escapeSvgText(monogram(label))}</text>
      <text x="88" y="56" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="28" font-weight="800">${escapeSvgText(label)}</text>
      <text x="88" y="86" fill="${alphaHex(theme.canvasText, 0.82)}" font-family="${theme.bodyFont}" font-size="17">${escapeSvgText(support)}</text>
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

const renderIconAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
): string => {
  const label = shortText(structuredContent.emphasis[0] || structuredContent.title || slot.label, 20);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="0 0 280 200">
      <defs>
        <linearGradient id="iconBg-${escapeSvgText(slot.id)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.primary}" />
          <stop offset="100%" stop-color="${theme.secondary}" />
        </linearGradient>
      </defs>
      <rect width="280" height="200" rx="28" fill="${alphaHex(theme.surface, 0.98)}" />
      <circle cx="88" cy="96" r="52" fill="url(#iconBg-${escapeSvgText(slot.id)})" opacity="0.96" />
      <circle cx="88" cy="96" r="32" fill="${alphaHex(theme.canvasBg, 0.2)}" />
      <text x="88" y="104" text-anchor="middle" fill="#f6f9ff" font-family="${theme.headingFont}" font-size="30" font-weight="900">${escapeSvgText(monogram(slot.prompt))}</text>
      <text x="154" y="88" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="24" font-weight="800">${escapeSvgText(label)}</text>
      <text x="154" y="116" fill="${alphaHex(theme.canvasText, 0.82)}" font-family="${theme.bodyFont}" font-size="15">${escapeSvgText(shortText(structuredContent.subtitle || slot.prompt, 34))}</text>
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

const renderIllustrationAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
  renderVariant: PresentationGraphicRenderVariant,
): string => {
  const steps = (
    structuredContent.steps.length > 0
      ? structuredContent.steps.map((entry) => entry.title)
      : structuredContent.bullets.length > 0
        ? structuredContent.bullets
        : structuredContent.columns.map((entry) => entry.title)
  ).slice(0, 4);
  const nodes = steps
    .map((entry, index) => {
      const x = 92 + index * 144;
      const y =
        renderVariant === 'timeline-infographic' || renderVariant === 'roadmap-infographic'
          ? 160
          : 178;
      return `
        <circle cx="${x}" cy="${y}" r="34" fill="${index % 2 === 0 ? alphaHex(theme.primary, 0.9) : alphaHex(theme.secondary, 0.9)}" />
        <text x="${x}" y="${y + 8}" text-anchor="middle" fill="#f5f8ff" font-family="${theme.headingFont}" font-size="16" font-weight="800">${escapeSvgText(monogram(entry))}</text>
        <text x="${x}" y="${y + 58}" text-anchor="middle" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14" font-weight="700">${escapeSvgText(shortText(entry, 16))}</text>`;
    })
    .join('');
  const connectors = steps
    .slice(0, -1)
    .map((_, index) => {
      const x1 = 126 + index * 144;
      const x2 = 202 + index * 144;
      const y =
        renderVariant === 'timeline-infographic' || renderVariant === 'roadmap-infographic'
          ? 160
          : 178;
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${alphaHex(theme.canvasText, 0.28)}" stroke-width="8" stroke-linecap="round" />`;
    })
    .join('');
  const topRail =
    renderVariant === 'timeline-infographic' || renderVariant === 'roadmap-infographic'
      ? `
        <rect x="48" y="106" width="544" height="10" rx="5" fill="${alphaHex(theme.canvasText, 0.12)}" />
        ${steps
          .map((_, index) => {
            const x = 92 + index * 144;
            return `<circle cx="${x}" cy="111" r="10" fill="${index % 2 === 0 ? theme.primary : theme.secondary}" />`;
          })
          .join('')}`
      : '';
  const checklistRows =
    renderVariant === 'checklist-infographic'
      ? steps
          .map((entry, index) => {
            const y = 126 + index * 48;
            return `
              <circle cx="72" cy="${y}" r="13" fill="${alphaHex(theme.accent, 0.86)}" />
              <path d="M64 ${y}l6 6 12-14" fill="none" stroke="#0c121b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <rect x="98" y="${y - 15}" width="434" height="30" rx="12" fill="${alphaHex(theme.surface, 0.84)}" stroke="${alphaHex(theme.canvasCardBorder, 0.8)}" />
              <text x="118" y="${y + 5}" fill="${theme.canvasTitle}" font-family="${theme.bodyFont}" font-size="16" font-weight="700">${escapeSvgText(shortText(entry, 46))}</text>`;
          })
          .join('')
      : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="28" fill="${theme.surfaceMuted}" />
      <rect x="20" y="20" width="600" height="320" rx="24" fill="${alphaHex(theme.canvasBg, 0.9)}" stroke="${alphaHex(theme.primary, 0.2)}" />
      <text x="34" y="58" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="28" font-weight="800">${escapeSvgText(shortText(structuredContent.title || slot.label, 34))}</text>
      <text x="34" y="86" fill="${alphaHex(theme.canvasText, 0.82)}" font-family="${theme.bodyFont}" font-size="16">${escapeSvgText(shortText(structuredContent.subtitle || slot.prompt, 66))}</text>
      ${renderVariant === 'checklist-infographic' ? checklistRows : `${topRail}${connectors}${nodes}`}
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

const renderPhotoAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
  renderVariant: PresentationGraphicRenderVariant,
): string => {
  const hash = keywordHash(slot.prompt || structuredContent.title);
  const accent = hash % 2 === 0 ? theme.primary : theme.secondary;
  const subtitleLines = splitLines(structuredContent.subtitle || slot.prompt, 34, 2);
  const profileCards =
    renderVariant === 'team-photo'
      ? [0, 1, 2]
          .map((index) => {
            const x = 54 + index * 182;
            return `
              <circle cx="${x + 58}" cy="138" r="36" fill="${alphaHex(index % 2 === 0 ? theme.primary : theme.secondary, 0.9)}" />
              <circle cx="${x + 58}" cy="126" r="18" fill="${alphaHex(theme.canvasBg, 0.92)}" />
              <path d="M${x + 28} 178c10-24 26-38 44-38 18 0 34 14 44 38" fill="${alphaHex(theme.canvasBg, 0.92)}" />
              <rect x="${x}" y="210" width="116" height="58" rx="16" fill="${alphaHex(theme.surface, 0.64)}" />
              <text x="${x + 14}" y="236" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="16" font-weight="800">${escapeSvgText(shortText(structuredContent.columns[index]?.title || `Role ${index + 1}`, 16))}</text>
              <text x="${x + 14}" y="256" fill="${alphaHex(theme.canvasText, 0.84)}" font-family="${theme.bodyFont}" font-size="12">${escapeSvgText(shortText(structuredContent.columns[index]?.body || structuredContent.bullets[index] || 'Owner', 20))}</text>`;
          })
          .join('')
      : '';
  const portraitMarkup =
    renderVariant === 'portrait-photo'
      ? `
        <circle cx="176" cy="160" r="92" fill="${alphaHex(theme.surface, 0.46)}" />
        <circle cx="176" cy="142" r="42" fill="${alphaHex(theme.canvasBg, 0.94)}" />
        <path d="M94 272c20-54 50-82 82-82 32 0 62 28 82 82" fill="${alphaHex(theme.canvasBg, 0.94)}" />`
      : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <defs>
        <linearGradient id="photoBg-${escapeSvgText(slot.id)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="${theme.surfaceMuted}" />
        </linearGradient>
      </defs>
      <rect width="640" height="420" rx="34" fill="url(#photoBg-${escapeSvgText(slot.id)})" />
      ${
        renderVariant === 'team-photo'
          ? profileCards
          : renderVariant === 'portrait-photo'
            ? portraitMarkup
            : `
              <circle cx="332" cy="168" r="88" fill="${alphaHex(theme.surface, 0.42)}" />
              <circle cx="332" cy="144" r="42" fill="${alphaHex(theme.canvasBg, 0.88)}" />
              <path d="M236 308c22-54 58-84 96-84s74 30 96 84" fill="${alphaHex(theme.canvasBg, 0.88)}" />`
      }
      <rect x="46" y="286" width="548" height="88" rx="22" fill="${alphaHex(theme.surface, 0.58)}" />
      <text x="68" y="324" fill="#f8fbff" font-family="${theme.headingFont}" font-size="26" font-weight="800">${escapeSvgText(shortText(structuredContent.title || slot.label, 34))}</text>
      ${subtitleLines
        .map(
          (line, index) =>
            `<text x="68" y="${352 + index * 20}" fill="${alphaHex('#f8fbff', 0.88)}" font-family="${theme.bodyFont}" font-size="16">${escapeSvgText(line)}</text>`,
        )
        .join('')}
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

const renderShapeAsset = (
  slot: AcademyPresentationGraphicSlot,
  structuredContent: AcademyPresentationStructuredContent,
  theme: AcademyPresentationBrandTokens,
  renderVariant: PresentationGraphicRenderVariant,
): string => {
  const columns = (structuredContent.columns.length > 0
    ? structuredContent.columns
    : structuredContent.bullets.map((entry) => ({
        title: shortText(entry, 20),
        body: shortText(structuredContent.subtitle || slot.prompt, 42),
      }))).slice(0, 4);
  const cards = columns
    .slice(0, 3)
    .map((entry, index) => {
      const x = 34 + index * 190;
      return `
        <rect x="${x}" y="124" width="156" height="112" rx="20" fill="${index % 2 === 0 ? alphaHex(theme.primary, 0.18) : alphaHex(theme.secondary, 0.16)}" stroke="${alphaHex(theme.canvasCardBorder, 0.86)}" />
        <text x="${x + 18}" y="164" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.title, 16))}</text>
        <text x="${x + 18}" y="192" fill="${alphaHex(theme.canvasText, 0.82)}" font-family="${theme.bodyFont}" font-size="14">${escapeSvgText(shortText(entry.body, 26))}</text>`;
    })
    .join('');
  const beforeAfterCards =
    renderVariant === 'before-after-board'
      ? columns
          .slice(0, 2)
          .map((entry, index) => {
            const x = 52 + index * 276;
            const tone = index === 0 ? alphaHex(theme.primary, 0.12) : alphaHex(theme.secondary, 0.12);
            const label = index === 0 ? 'Before' : 'After';
            return `
              <rect x="${x}" y="118" width="240" height="136" rx="22" fill="${tone}" stroke="${alphaHex(theme.canvasCardBorder, 0.86)}" />
              <text x="${x + 18}" y="148" fill="${index === 0 ? theme.primary : theme.secondary}" font-family="${theme.headingFont}" font-size="16" font-weight="900">${label}</text>
              <text x="${x + 18}" y="176" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="22" font-weight="800">${escapeSvgText(shortText(entry.title, 20))}</text>
              <text x="${x + 18}" y="206" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="15">${escapeSvgText(shortText(entry.body, 34))}</text>`;
          })
          .join('')
      : '';
  const decisionMatrixBoard =
    renderVariant === 'decision-matrix-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            const x = 170 + (index % 2) * 214;
            const y = 118 + Math.floor(index / 2) * 92;
            return `
              <rect x="${x}" y="${y}" width="188" height="76" rx="18" fill="${alphaHex(index % 2 === 0 ? theme.primary : theme.secondary, 0.13)}" stroke="${alphaHex(theme.canvasCardBorder, 0.86)}" />
              <text x="${x + 16}" y="${y + 28}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="16" font-weight="800">${escapeSvgText(shortText(entry.title, 18))}</text>
              <text x="${x + 16}" y="${y + 52}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="13">${escapeSvgText(shortText(entry.body, 30))}</text>`;
          })
          .join('') +
        (structuredContent.bullets.length > 0
          ? structuredContent.bullets
              .slice(0, 3)
              .map((entry, index) => {
                const y = 130 + index * 48;
                return `
                  <circle cx="68" cy="${y}" r="11" fill="${alphaHex(theme.accent, 0.84)}" />
                  <text x="90" y="${y + 5}" fill="${theme.canvasTitle}" font-family="${theme.bodyFont}" font-size="13" font-weight="700">${escapeSvgText(shortText(entry, 22))}</text>`;
              })
              .join('')
          : '')
      : '';
  const faqCards =
    renderVariant === 'faq-board'
      ? columns
          .slice(0, 3)
          .map((entry, index) => {
            const x = index === 2 ? 190 : 34 + index * 286;
            const y = index === 2 ? 218 : 118;
            return `
              <rect x="${x}" y="${y}" width="${index === 2 ? 260 : 252}" height="84" rx="18" fill="${alphaHex(theme.surface, 0.82)}" stroke="${alphaHex(theme.canvasCardBorder, 0.82)}" />
              <text x="${x + 16}" y="${y + 28}" fill="${theme.primary}" font-family="${theme.headingFont}" font-size="16" font-weight="900">Q</text>
              <text x="${x + 40}" y="${y + 28}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="17" font-weight="800">${escapeSvgText(shortText(entry.title, 28))}</text>
              <text x="${x + 40}" y="${y + 54}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14">${escapeSvgText(shortText(entry.body, 42))}</text>`;
          })
          .join('')
      : '';
  const architectureBoard =
    renderVariant === 'architecture-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            const x = index % 2 === 0 ? 36 : 338;
            const y = index < 2 ? 120 : 216;
            return `
              <rect x="${x}" y="${y}" width="266" height="74" rx="18" fill="${alphaHex(index % 2 === 0 ? theme.primary : theme.secondary, 0.12)}" stroke="${alphaHex(theme.canvasCardBorder, 0.9)}" />
              <text x="${x + 16}" y="${y + 28}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.title, 24))}</text>
              <text x="${x + 16}" y="${y + 52}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="13">${escapeSvgText(shortText(entry.body, 40))}</text>`;
          })
          .join('')
      : '';
  const productArchitectureFlowBoard =
    renderVariant === 'product-architecture-flow-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            const x = 40 + index * 144;
            const y = index % 2 === 0 ? 124 : 220;
            const connectorY = index % 2 === 0 ? 160 : 236;
            const nextX = x + 144;
            return `
              <rect x="${x}" y="${y}" width="122" height="70" rx="18" fill="${alphaHex(index % 2 === 0 ? theme.primary : theme.secondary, 0.14)}" stroke="${alphaHex(theme.canvasCardBorder, 0.86)}" />
              <text x="${x + 14}" y="${y + 28}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="15" font-weight="800">${escapeSvgText(shortText(entry.title, 16))}</text>
              <text x="${x + 14}" y="${y + 50}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="12">${escapeSvgText(shortText(entry.body, 24))}</text>
              ${
                index < Math.min(columns.length, 4) - 1
                  ? `<path d="M${x + 122} ${connectorY} C ${x + 134} ${connectorY}, ${nextX - 20} ${connectorY}, ${nextX - 8} ${index % 2 === 0 ? connectorY + 76 : connectorY - 76}" fill="none" stroke="${alphaHex(theme.accent, 0.52)}" stroke-width="4" stroke-linecap="round" />`
                  : ''
              }`;
          })
          .join('')
      : '';
  const orgChartBoard =
    renderVariant === 'org-chart-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            if (index === 0) {
              return `
                <rect x="212" y="112" width="216" height="72" rx="18" fill="${alphaHex(theme.primary, 0.14)}" stroke="${alphaHex(theme.canvasCardBorder, 0.9)}" />
                <text x="228" y="142" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.title, 22))}</text>
                <text x="228" y="166" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="13">${escapeSvgText(shortText(entry.body, 34))}</text>
                <line x1="320" y1="184" x2="320" y2="212" stroke="${alphaHex(theme.canvasText, 0.3)}" stroke-width="5" stroke-linecap="round" />`;
            }
            const childIndex = index - 1;
            const x = 52 + childIndex * 176;
            return `
              <line x1="320" y1="212" x2="${x + 80}" y2="212" stroke="${alphaHex(theme.canvasText, 0.22)}" stroke-width="4" stroke-linecap="round" />
              <line x1="${x + 80}" y1="212" x2="${x + 80}" y2="226" stroke="${alphaHex(theme.canvasText, 0.22)}" stroke-width="4" stroke-linecap="round" />
              <rect x="${x}" y="226" width="160" height="82" rx="18" fill="${alphaHex(childIndex % 2 === 0 ? theme.secondary : theme.accent, 0.14)}" stroke="${alphaHex(theme.canvasCardBorder, 0.88)}" />
              <text x="${x + 16}" y="256" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="16" font-weight="800">${escapeSvgText(shortText(entry.title, 18))}</text>
              <text x="${x + 16}" y="280" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="13">${escapeSvgText(shortText(entry.body, 28))}</text>`;
          })
          .join('')
      : '';
  const swimlaneProcessBoard =
    renderVariant === 'swimlane-process-board'
      ? columns
          .slice(0, 3)
          .map((entry, index) => {
            const y = 118 + index * 70;
            const steps = structuredContent.steps.slice(0, 3).map((step) => step.title);
            return `
              <rect x="34" y="${y}" width="110" height="52" rx="16" fill="${alphaHex(index % 2 === 0 ? theme.primary : theme.secondary, 0.16)}" stroke="${alphaHex(theme.canvasCardBorder, 0.82)}" />
              <text x="50" y="${y + 30}" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="15" font-weight="800">${escapeSvgText(shortText(entry.title, 14))}</text>
              ${steps
                .map((stepTitle, stepIndex) => {
                  const cellX = 168 + stepIndex * 146;
                  return `
                    <rect x="${cellX}" y="${y + 6}" width="128" height="40" rx="14" fill="${alphaHex(theme.surface, 0.82)}" stroke="${alphaHex(theme.canvasCardBorder, 0.72)}" />
                    <text x="${cellX + 12}" y="${y + 30}" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="12" font-weight="700">${escapeSvgText(shortText(stepTitle, 18))}</text>`;
                })
                .join('')}`;
          })
          .join('')
      : '';
  const scenarioBoard =
    renderVariant === 'scenario-board'
      ? columns
          .slice(0, 3)
          .map((entry, index) => {
            const x = index === 0 ? 34 : index === 1 ? 218 : 402;
            return `
              <rect x="${x}" y="126" width="170" height="132" rx="20" fill="${alphaHex(index === 0 ? theme.primary : index === 1 ? theme.secondary : theme.accent, 0.14)}" stroke="${alphaHex(theme.canvasCardBorder, 0.88)}" />
              <text x="${x + 14}" y="156" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.title, 18))}</text>
              <text x="${x + 14}" y="186" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14">${escapeSvgText(shortText(entry.body, 34))}</text>`;
          })
          .join('')
      : '';
  const decisionTreeBoard =
    renderVariant === 'decision-tree-board'
      ? columns
          .slice(0, 3)
          .map((entry, index) => {
            if (index === 0) {
              return `
                <rect x="220" y="110" width="200" height="70" rx="18" fill="${alphaHex(theme.primary, 0.14)}" stroke="${alphaHex(theme.canvasCardBorder, 0.9)}" />
                <text x="238" y="138" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.title, 20))}</text>
                <text x="238" y="162" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="13">${escapeSvgText(shortText(entry.body, 30))}</text>
                <line x1="320" y1="180" x2="214" y2="238" stroke="${alphaHex(theme.secondary, 0.48)}" stroke-width="5" stroke-linecap="round" />
                <line x1="320" y1="180" x2="426" y2="238" stroke="${alphaHex(theme.accent, 0.48)}" stroke-width="5" stroke-linecap="round" />`;
            }
            const x = index === 1 ? 70 : 390;
            const fill = index === 1 ? alphaHex(theme.secondary, 0.14) : alphaHex(theme.accent, 0.14);
            const decision = index === 1 ? 'Ja' : 'Nei';
            return `
              <rect x="${x}" y="238" width="180" height="92" rx="18" fill="${fill}" stroke="${alphaHex(theme.canvasCardBorder, 0.88)}" />
              <text x="${x + 16}" y="266" fill="${index === 1 ? theme.secondary : theme.accent}" font-family="${theme.headingFont}" font-size="14" font-weight="900">${decision}</text>
              <text x="${x + 16}" y="292" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="18" font-weight="800">${escapeSvgText(shortText(entry.title, 18))}</text>
              <text x="${x + 16}" y="316" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="13">${escapeSvgText(shortText(entry.body, 30))}</text>`;
          })
          .join('')
      : '';
  const knowledgeBoard =
    renderVariant === 'knowledge-check-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            const y = 118 + index * 44;
            return `
              <rect x="42" y="${y}" width="556" height="34" rx="17" fill="${alphaHex(theme.surface, 0.84)}" stroke="${alphaHex(theme.canvasCardBorder, 0.82)}" />
              <circle cx="64" cy="${y + 17}" r="11" fill="${alphaHex(theme.primary, 0.18)}" />
              <text x="64" y="${y + 22}" text-anchor="middle" fill="${theme.primary}" font-family="${theme.headingFont}" font-size="12" font-weight="900">${String.fromCharCode(65 + index)}</text>
              <text x="88" y="${y + 22}" fill="${theme.canvasTitle}" font-family="${theme.bodyFont}" font-size="14" font-weight="700">${escapeSvgText(shortText(entry.body || entry.title, 64))}</text>`;
          })
          .join('')
      : '';
  const interactiveQuizBoard =
    renderVariant === 'interactive-quiz-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            const y = 120 + index * 40;
            const activeFill =
              index === 0
                ? alphaHex(theme.primary, 0.16)
                : index === 1
                  ? alphaHex(theme.secondary, 0.14)
                  : alphaHex(theme.surfaceMuted, 0.88);
            return `
              <rect x="42" y="${y}" width="556" height="30" rx="15" fill="${activeFill}" stroke="${alphaHex(theme.canvasCardBorder, 0.82)}" />
              <circle cx="66" cy="${y + 15}" r="10" fill="${index < 2 ? alphaHex(theme.primary, 0.22) : alphaHex(theme.canvasText, 0.16)}" />
              <text x="66" y="${y + 20}" text-anchor="middle" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="11" font-weight="900">${String.fromCharCode(65 + index)}</text>
              <text x="88" y="${y + 20}" fill="${theme.canvasTitle}" font-family="${theme.bodyFont}" font-size="14" font-weight="700">${escapeSvgText(shortText(entry.body || entry.title, 66))}</text>`;
          })
          .join('')
      : '';
  const agendaRail =
    renderVariant === 'agenda-board'
      ? columns
          .slice(0, 4)
          .map((entry, index) => {
            const y = 120 + index * 44;
            return `
              <circle cx="64" cy="${y}" r="12" fill="${index === 0 ? theme.primary : alphaHex(theme.canvasText, 0.18)}" />
              <text x="64" y="${y + 5}" text-anchor="middle" fill="${index === 0 ? '#f6fbff' : theme.canvasText}" font-family="${theme.headingFont}" font-size="12" font-weight="900">${index + 1}</text>
              <rect x="92" y="${y - 16}" width="430" height="32" rx="16" fill="${alphaHex(theme.surface, 0.78)}" stroke="${alphaHex(theme.canvasCardBorder, 0.72)}" />
              <text x="112" y="${y + 5}" fill="${theme.canvasTitle}" font-family="${theme.bodyFont}" font-size="15" font-weight="700">${escapeSvgText(shortText(entry.title, 42))}</text>`;
          })
          .join('')
      : '';
  const caseBoard =
    renderVariant === 'case-study-board'
      ? `
        <rect x="42" y="112" width="214" height="148" rx="22" fill="${alphaHex(theme.primary, 0.12)}" stroke="${alphaHex(theme.canvasCardBorder, 0.9)}" />
        <text x="60" y="144" fill="${theme.primary}" font-family="${theme.headingFont}" font-size="15" font-weight="900">CASE</text>
        <text x="60" y="174" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="22" font-weight="800">${escapeSvgText(shortText(columns[0]?.title || structuredContent.title, 18))}</text>
        <text x="60" y="204" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14">${escapeSvgText(shortText(columns[0]?.body || structuredContent.subtitle, 44))}</text>
        ${structuredContent.stats
          .slice(0, 2)
          .map((entry, index) => {
            const x = 292 + index * 150;
            return `
              <rect x="${x}" y="136" width="132" height="108" rx="20" fill="${alphaHex(index === 0 ? theme.secondary : theme.accent, 0.16)}" />
              <text x="${x + 16}" y="176" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="28" font-weight="900">${escapeSvgText(shortText(entry.value, 10))}</text>
              <text x="${x + 16}" y="204" fill="${theme.canvasText}" font-family="${theme.bodyFont}" font-size="14">${escapeSvgText(shortText(entry.label, 18))}</text>`;
          })
          .join('')}`
      : '';
  const boardMarkup =
    renderVariant === 'before-after-board'
      ? beforeAfterCards
      : renderVariant === 'decision-matrix-board'
        ? decisionMatrixBoard
      : renderVariant === 'architecture-board'
        ? architectureBoard
        : renderVariant === 'product-architecture-flow-board'
          ? productArchitectureFlowBoard
        : renderVariant === 'org-chart-board'
          ? orgChartBoard
          : renderVariant === 'swimlane-process-board'
            ? swimlaneProcessBoard
          : renderVariant === 'scenario-board'
            ? scenarioBoard
            : renderVariant === 'decision-tree-board'
              ? decisionTreeBoard
              : renderVariant === 'knowledge-check-board'
                ? knowledgeBoard
                : renderVariant === 'interactive-quiz-board'
                  ? interactiveQuizBoard
                  : renderVariant === 'faq-board'
                    ? faqCards
                    : renderVariant === 'agenda-board'
                      ? agendaRail
                      : renderVariant === 'case-study-board'
                        ? caseBoard
                        : cards;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" rx="30" fill="${theme.surface}" />
      <text x="34" y="58" fill="${theme.canvasTitle}" font-family="${theme.headingFont}" font-size="28" font-weight="800">${escapeSvgText(shortText(structuredContent.title || slot.label, 34))}</text>
      <text x="34" y="88" fill="${alphaHex(theme.canvasText, 0.82)}" font-family="${theme.bodyFont}" font-size="16">${escapeSvgText(shortText(structuredContent.subtitle || slot.prompt, 62))}</text>
      ${boardMarkup}
    </svg>`;
  return encodeSvgToDataUrl(svg);
};

export const buildPresentationGraphicAsset = ({
  slot,
  structuredContent,
  theme,
  grammarId,
}: {
  slot: AcademyPresentationGraphicSlot;
  structuredContent: AcademyPresentationStructuredContent;
  theme: AcademyPresentationBrandTokens;
  grammarId?: AcademyPresentationSlideGrammarId;
}): string => {
  const plan = buildPresentationGraphicPlan({
    slot,
    structuredContent,
    theme,
    grammarId,
  });
  if (slot.kind === 'chart') {
    return renderChartAsset(slot, structuredContent, theme, plan.chartVariant);
  }
  if (slot.kind === 'screenshot') {
    return renderScreenshotAsset(slot, structuredContent, theme, plan.renderVariant);
  }
  if (slot.kind === 'badge') {
    return renderBadgeAsset(slot, structuredContent, theme);
  }
  if (slot.kind === 'icon') {
    return renderIconAsset(slot, structuredContent, theme);
  }
  if (slot.kind === 'photo') {
    return renderPhotoAsset(slot, structuredContent, theme, plan.renderVariant);
  }
  if (slot.kind === 'shape') {
    return renderShapeAsset(slot, structuredContent, theme, plan.renderVariant);
  }
  return renderIllustrationAsset(slot, structuredContent, theme, plan.renderVariant);
};

const contrastRatio = (foreground: string, background: string): number | null => {
  const parse = (value: string): [number, number, number] | null => {
    const normalized = String(value || '').trim();
    const target = normalized.startsWith('#') ? normalized.slice(1) : normalized;
    const expanded =
      target.length === 3
        ? target
            .split('')
            .map((entry) => `${entry}${entry}`)
            .join('')
        : target.length === 8
          ? target.slice(0, 6)
          : target;
    if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [number, number, number];
  };
  const luminance = (value: string): number | null => {
    const rgb = parse(value);
    if (!rgb) return null;
    const [r, g, b] = rgb.map((entry) => {
      const channel = entry / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const fg = luminance(foreground);
  const bg = luminance(background);
  if (fg === null || bg === null) return null;
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

const average = (values: number[]): number => {
  if (values.length === 0) return 100;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const evaluatePresentationDeckDesign = (
  input: PresentationDeckDesignEvaluationInput,
): PresentationDeckDesignEvaluation => {
  const deckFindings: PresentationDesignFinding[] = [];
  const slideEvaluations = input.slides.map((slide) => {
    const findings: PresentationDesignFinding[] = [];
    const textElements = slide.elements.filter((element) => element.type === 'text');
    const mediaElements = slide.elements.filter(
      (element) => element.type === 'image' || element.type === 'video' || element.type === 'shape',
    );
    const headline = textElements.find((element) => element.role === 'headline');
    const subtitle = textElements.find((element) => element.role === 'subtitle');
    const bulletCount = textElements.filter((element) => element.role === 'bullet').length;
    const stepCount = textElements.filter((element) => element.role === 'step-title').length;
    const statCount = textElements.filter((element) => element.role === 'stat-value').length;
    const columnCount = textElements.filter((element) => element.role === 'column-title').length;
    const titleLength = String(headline?.text || slide.title || '').trim().length;
    const subtitleLength = String(subtitle?.text || '').trim().length;
    const mediaArea = mediaElements.reduce((sum, element) => sum + element.width * element.height, 0);
    const textArea = textElements.reduce((sum, element) => sum + element.width * element.height, 0);
    const hasPrimaryVisualNeed = slide.visualNeeds.some((entry) => entry.priority === 'primary');
    const hasResolvedAsset = mediaElements.some((element) => Boolean(element.assetDataUrl));

    if (slide.duration < 3) {
      findings.push({
        id: `short-duration-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'timing',
        penalty: 8,
        messageNo: `"${slide.title}" har for kort varighet (< 3s).`,
        messageEn: `"${slide.title}" has a very short duration (< 3s).`,
      });
    }

    if (slide.startTime + slide.duration > input.maxTimeline + 0.001) {
      findings.push({
        id: `out-of-bounds-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'error',
        category: 'timing',
        penalty: 16,
        messageNo: `"${slide.title}" går utenfor total tidslinje.`,
        messageEn: `"${slide.title}" exceeds the total timeline.`,
      });
    }

    if (slide.overlapSeconds > 0) {
      findings.push({
        id: `overlap-${slide.slideId}`,
        slideId: slide.slideId,
        severity: slide.overlapSeconds > 0.6 ? 'error' : 'warning',
        category: 'timing',
        penalty: slide.overlapSeconds > 0.6 ? 18 : 10,
        messageNo: `"${slide.title}" overlapper andre slides (${slide.overlapSeconds.toFixed(1)}s).`,
        messageEn: `"${slide.title}" overlaps other slides (${slide.overlapSeconds.toFixed(1)}s).`,
      });
    }

    slide.elements.forEach((element) => {
      if (element.x < 0 || element.y < 0 || element.x + element.width > 100 || element.y + element.height > 100) {
        findings.push({
          id: `bounds-${slide.slideId}-${element.id}`,
          slideId: slide.slideId,
          severity: 'warning',
          category: 'balance',
          penalty: 7,
          messageNo: `"${slide.title}" har element utenfor safe bounds.`,
          messageEn: `"${slide.title}" has an element outside safe bounds.`,
        });
      }
      if (element.type === 'text' && String(element.text || '').trim().length > 130) {
        findings.push({
          id: `mobile-text-${slide.slideId}-${element.id}`,
          slideId: slide.slideId,
          severity: 'warning',
          category: 'content',
          penalty: 8,
          messageNo: `"${slide.title}" har tekst som er for lang for mobil.`,
          messageEn: `"${slide.title}" has text that is too long for mobile.`,
        });
      }
    });

    if (!headline) {
      findings.push({
        id: `missing-headline-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'error',
        category: 'hierarchy',
        penalty: 18,
        messageNo: `"${slide.title}" mangler tydelig hovedoverskrift.`,
        messageEn: `"${slide.title}" is missing a clear headline.`,
      });
    }

    if (titleLength > slide.contentBudget.titleMaxChars) {
      findings.push({
        id: `title-overflow-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'content',
        penalty: 10,
        messageNo: `"${slide.title}" har for lang tittel for valgt slide-type.`,
        messageEn: `"${slide.title}" has a headline that is too long for the selected slide type.`,
      });
    }

    if (subtitleLength > slide.contentBudget.subtitleMaxChars) {
      findings.push({
        id: `subtitle-overflow-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'content',
        penalty: 8,
        messageNo: `"${slide.title}" har for lang undertekst.`,
        messageEn: `"${slide.title}" has a subtitle that is too long.`,
      });
    }

    if (
      slide.grammarId === 'hero' ||
      slide.grammarId === 'agenda' ||
      slide.grammarId === 'summary' ||
      slide.grammarId === 'content-grid' ||
      slide.grammarId === 'checklist'
    ) {
      if (bulletCount > slide.contentBudget.maxBullets) {
        findings.push({
          id: `bullet-overflow-${slide.slideId}`,
          slideId: slide.slideId,
          severity: 'warning',
          category: 'content',
          penalty: 9,
          messageNo: `"${slide.title}" har for mange punkter for valgt slide-type.`,
          messageEn: `"${slide.title}" has too many bullets for the selected slide type.`,
        });
      }
    }

    if (
      (slide.grammarId === 'timeline' ||
        slide.grammarId === 'process' ||
        slide.grammarId === 'roadmap' ||
        slide.grammarId === 'swimlane-process') &&
      stepCount < 2
    ) {
      findings.push({
        id: `missing-steps-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'grammar',
        penalty: 10,
        messageNo: `"${slide.title}" mangler tydelige steg for timeline/process.`,
        messageEn: `"${slide.title}" is missing clear steps for a timeline/process slide.`,
      });
    }

    if ((slide.grammarId === 'stats' || slide.grammarId === 'chart') && statCount < 2) {
      findings.push({
        id: `missing-stats-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'grammar',
        penalty: 11,
        messageNo: `"${slide.title}" mangler nok tallgrunnlag for stats/chart.`,
        messageEn: `"${slide.title}" is missing enough numeric content for a stats/chart slide.`,
      });
    }

    if (
      (slide.grammarId === 'comparison' ||
        slide.grammarId === 'decision-matrix' ||
        slide.grammarId === 'before-after' ||
        slide.grammarId === 'team' ||
        slide.grammarId === 'case-study' ||
        slide.grammarId === 'architecture' ||
        slide.grammarId === 'architecture-diagram' ||
        slide.grammarId === 'product-architecture-flow' ||
        slide.grammarId === 'org-chart' ||
        slide.grammarId === 'swimlane-process' ||
        slide.grammarId === 'scenario' ||
        slide.grammarId === 'decision-tree' ||
        slide.grammarId === 'knowledge-check' ||
        slide.grammarId === 'interactive-quiz') &&
      columnCount < 2
    ) {
      findings.push({
        id: `missing-columns-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'grammar',
        penalty: 9,
        messageNo: `"${slide.title}" mangler nok kort/kolonner for valgt slide-type.`,
        messageEn: `"${slide.title}" is missing enough cards/columns for the selected slide type.`,
      });
    }

    if (slide.grammarId === 'faq' && columnCount < 2) {
      findings.push({
        id: `missing-faq-cards-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'grammar',
        penalty: 10,
        messageNo: `"${slide.title}" mangler nok sporsmal/svar-kort for FAQ-slide.`,
        messageEn: `"${slide.title}" is missing enough question-answer cards for an FAQ slide.`,
      });
    }

    if (hasPrimaryVisualNeed && mediaElements.length === 0) {
      findings.push({
        id: `missing-visual-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'visual',
        penalty: 12,
        messageNo: `"${slide.title}" mangler primærvisual.`,
        messageEn: `"${slide.title}" is missing a primary visual.`,
      });
    }

    if (hasPrimaryVisualNeed && mediaElements.length > 0 && !hasResolvedAsset) {
      findings.push({
        id: `unresolved-visual-${slide.slideId}`,
        slideId: slide.slideId,
        severity: 'warning',
        category: 'visual',
        penalty: 8,
        messageNo: `"${slide.title}" har visual-slot uten generert asset.`,
        messageEn: `"${slide.title}" has a visual slot without a generated asset.`,
      });
    }

    if (mediaArea > 0 && textArea > 0) {
      const ratio = mediaArea / Math.max(1, textArea);
      if (ratio < 0.24 || ratio > 4.6) {
        findings.push({
          id: `balance-${slide.slideId}`,
          slideId: slide.slideId,
          severity: 'warning',
          category: 'balance',
          penalty: 9,
          messageNo: `"${slide.title}" har ubalanse mellom tekst og visual.`,
          messageEn: `"${slide.title}" has an imbalanced text-to-visual ratio.`,
        });
      }
    }

    const contentPenalty = findings
      .filter((entry) => entry.category === 'content' || entry.category === 'timing')
      .reduce((sum, entry) => sum + entry.penalty, 0);
    const hierarchyPenalty = findings
      .filter((entry) => entry.category === 'hierarchy')
      .reduce((sum, entry) => sum + entry.penalty, 0);
    const balancePenalty = findings
      .filter((entry) => entry.category === 'balance')
      .reduce((sum, entry) => sum + entry.penalty, 0);
    const visualPenalty = findings
      .filter((entry) => entry.category === 'visual')
      .reduce((sum, entry) => sum + entry.penalty, 0);
    const grammarPenalty = findings
      .filter((entry) => entry.category === 'grammar')
      .reduce((sum, entry) => sum + entry.penalty, 0);

    const evaluation: PresentationSlideDesignEvaluation = {
      slideId: slide.slideId,
      overall: Math.round(clamp(100 - average([contentPenalty, hierarchyPenalty, balancePenalty, visualPenalty, grammarPenalty]), 0, 100)),
      content: Math.round(clamp(100 - contentPenalty, 0, 100)),
      hierarchy: Math.round(clamp(100 - hierarchyPenalty, 0, 100)),
      balance: Math.round(clamp(100 - balancePenalty, 0, 100)),
      visuals: Math.round(clamp(100 - visualPenalty, 0, 100)),
      grammar: Math.round(clamp(100 - grammarPenalty, 0, 100)),
      findings,
    };

    deckFindings.push(...findings);
    return evaluation;
  });

  const ratio = contrastRatio(input.themeTokens.canvasText, input.themeTokens.canvasBg);
  if (ratio !== null && ratio < 3.5) {
    deckFindings.push({
      id: 'contrast-canvas',
      severity: 'warning',
      category: 'visual',
      penalty: 7,
      messageNo: 'Kontrast i canvas kan være for lav.',
      messageEn: 'Canvas contrast may be too low.',
    });
  }

  return {
    overall: Math.round(average(slideEvaluations.map((slide) => slide.overall))),
    content: Math.round(average(slideEvaluations.map((slide) => slide.content))),
    hierarchy: Math.round(average(slideEvaluations.map((slide) => slide.hierarchy))),
    balance: Math.round(average(slideEvaluations.map((slide) => slide.balance))),
    visuals: Math.round(average(slideEvaluations.map((slide) => slide.visuals))),
    grammar: Math.round(average(slideEvaluations.map((slide) => slide.grammar))),
    slides: slideEvaluations,
    findings: deckFindings,
  };
};
