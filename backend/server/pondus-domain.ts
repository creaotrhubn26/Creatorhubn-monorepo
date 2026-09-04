export const PONDUS_ANALYSIS_RUBRIC_VERSION = 'pondus-rubric-2026-09-1';
export const PONDUS_QUIZ_SCORING_VERSION = 'pondus-quiz-2026-09-1';

export const PONDUS_KINDS = new Set([
  'telephone', 'video', 'email', 'meeting', 'field',
]);

export type PondusValidationIssue = {
  path: string;
  message: string;
};

export type PondusStepInput = {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  prompt: string | null;
  minLength: number | null;
  maxLength: number | null;
  order: number;
};

export type PondusObjectionInput = {
  id: string;
  prompt: string;
  response: string;
};

export type PondusTemplateInput = {
  name?: string;
  description?: string | null;
  category?: string;
  kind?: string;
  steps?: PondusStepInput[];
  objections?: PondusObjectionInput[];
  expectedVersion?: number;
};

type ParseResult =
  | { ok: true; value: PondusTemplateInput }
  | { ok: false; issues: PondusValidationIssue[] };

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedString(
  value: unknown,
  path: string,
  maxLength: number,
  issues: PondusValidationIssue[],
  options: { required?: boolean; trim?: boolean } = {},
): string | null {
  if (typeof value !== 'string') {
    if (options.required) issues.push({ path, message: 'Feltet er påkrevd.' });
    return null;
  }
  const normalized = options.trim === false ? value : value.trim();
  if (options.required && normalized.length === 0) {
    issues.push({ path, message: 'Feltet kan ikke være tomt.' });
  }
  if (normalized.length > maxLength) {
    issues.push({ path, message: `Maksimal lengde er ${maxLength} tegn.` });
  }
  return normalized;
}

function optionalInteger(
  value: unknown,
  path: string,
  min: number,
  max: number,
  issues: PondusValidationIssue[],
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    issues.push({ path, message: `Må være et heltall mellom ${min} og ${max}.` });
    return null;
  }
  return Number(value);
}

function parseSteps(value: unknown, issues: PondusValidationIssue[]): PondusStepInput[] {
  if (!Array.isArray(value)) {
    issues.push({ path: 'steps', message: 'Steg må være en liste.' });
    return [];
  }
  if (value.length > 30) {
    issues.push({ path: 'steps', message: 'En mal kan ha maksimalt 30 steg.' });
  }
  const seen = new Set<string>();
  return value.slice(0, 30).flatMap((raw, index) => {
    const row = recordValue(raw);
    const root = `steps.${index}`;
    if (!row) {
      issues.push({ path: root, message: 'Steget må være et objekt.' });
      return [];
    }
    const id = boundedString(row.id, `${root}.id`, 60, issues, { required: true });
    const title = boundedString(row.title, `${root}.title`, 120, issues, { required: true });
    const subtitle = row.subtitle == null
      ? null
      : boundedString(row.subtitle, `${root}.subtitle`, 500, issues, { trim: false });
    const icon = row.icon == null
      ? null
      : boundedString(row.icon, `${root}.icon`, 80, issues);
    const prompt = row.prompt == null
      ? null
      : boundedString(row.prompt, `${root}.prompt`, 4_000, issues, { trim: false });
    const minLength = optionalInteger(row.minLength ?? row.min_length, `${root}.minLength`, 0, 4_000, issues);
    const maxLength = optionalInteger(row.maxLength ?? row.max_length, `${root}.maxLength`, 1, 4_000, issues);
    const order = optionalInteger(row.order, `${root}.order`, 0, 99, issues) ?? index;
    if (id && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
      issues.push({ path: `${root}.id`, message: 'Steg-ID kan bare inneholde bokstaver, tall, _ og -.' });
    }
    if (id && seen.has(id)) {
      issues.push({ path: `${root}.id`, message: 'Steg-ID må være unik i malen.' });
    }
    if (id) seen.add(id);
    if (minLength != null && maxLength != null && minLength > maxLength) {
      issues.push({ path: `${root}.minLength`, message: 'Minimumslengde kan ikke være større enn maksimumslengde.' });
    }
    if (!id || !title) return [];
    return [{ id, title, subtitle, icon, prompt, minLength, maxLength, order }];
  });
}

function parseObjections(value: unknown, issues: PondusValidationIssue[]): PondusObjectionInput[] {
  if (!Array.isArray(value)) {
    issues.push({ path: 'objections', message: 'Innvendinger må være en liste.' });
    return [];
  }
  if (value.length > 50) {
    issues.push({ path: 'objections', message: 'En mal kan ha maksimalt 50 innvendinger.' });
  }
  const seen = new Set<string>();
  return value.slice(0, 50).flatMap((raw, index) => {
    const row = recordValue(raw);
    const root = `objections.${index}`;
    if (!row) {
      issues.push({ path: root, message: 'Innvendingen må være et objekt.' });
      return [];
    }
    const id = boundedString(row.id, `${root}.id`, 80, issues, { required: true });
    const prompt = boundedString(row.prompt, `${root}.prompt`, 500, issues, { required: true, trim: false });
    const response = boundedString(row.response, `${root}.response`, 4_000, issues, { required: true, trim: false });
    if (id && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
      issues.push({ path: `${root}.id`, message: 'Innvending-ID kan bare inneholde bokstaver, tall, _ og -.' });
    }
    if (id && seen.has(id)) {
      issues.push({ path: `${root}.id`, message: 'Innvending-ID må være unik i malen.' });
    }
    if (id) seen.add(id);
    if (!id || !prompt || !response) return [];
    return [{ id, prompt, response }];
  });
}

export function parsePondusTemplateInput(
  raw: unknown,
  options: { partial?: boolean } = {},
): ParseResult {
  const body = recordValue(raw);
  if (!body) return { ok: false, issues: [{ path: 'body', message: 'Ugyldig request-body.' }] };
  const partial = options.partial === true;
  const issues: PondusValidationIssue[] = [];
  const value: PondusTemplateInput = {};

  if (!partial || body.name !== undefined) {
    const name = boundedString(body.name, 'name', 160, issues, { required: true });
    if (name != null) value.name = name;
  }
  if (!partial || body.description !== undefined) {
    if (body.description === null || body.description === undefined || body.description === '') {
      value.description = null;
    } else {
      value.description = boundedString(body.description, 'description', 2_000, issues, { trim: false });
    }
  }
  if (!partial || body.category !== undefined) {
    const category = boundedString(body.category ?? 'custom', 'category', 60, issues, { required: true });
    if (category && !/^[a-z][a-z0-9_-]*$/.test(category)) {
      issues.push({ path: 'category', message: 'Kategori må være en stabil liten bokstav-nøkkel.' });
    }
    if (category != null) value.category = category;
  }
  if (!partial || body.kind !== undefined) {
    const kind = boundedString(body.kind ?? 'telephone', 'kind', 20, issues, { required: true });
    if (kind && !PONDUS_KINDS.has(kind)) {
      issues.push({ path: 'kind', message: 'Ugyldig kanal.' });
    }
    if (kind != null) value.kind = kind;
  }
  if (!partial || body.steps !== undefined) value.steps = parseSteps(body.steps ?? [], issues);
  if (!partial || body.objections !== undefined) value.objections = parseObjections(body.objections ?? [], issues);

  const expectedVersionRaw = body.expected_version ?? body.expectedVersion;
  if (expectedVersionRaw !== undefined) {
    const expectedVersion = optionalInteger(expectedVersionRaw, 'expected_version', 1, 1_000_000, issues);
    if (expectedVersion != null) value.expectedVersion = expectedVersion;
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

export type PondusAnalysis = {
  authority: number;
  clarity: number;
  trust: number;
  safety: number;
  momentum: number;
};

export type PondusAnalysisMeta = {
  rubric_version: string;
  confidence: number;
  evidence: Record<keyof PondusAnalysis, string[]>;
  recommendations: string[];
};

export type PondusAnalysisResult = {
  score: number;
  analysis: PondusAnalysis;
  analysis_meta: PondusAnalysisMeta;
};

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

function occurrences(text: string, expressions: RegExp[]): number {
  return expressions.reduce((sum, expression) => sum + (text.match(expression)?.length ?? 0), 0);
}

function axisResult(
  initial: number,
  positiveCount: number,
  negativeCount: number,
  positiveEvidence: string,
  negativeEvidence: string,
): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  if (positiveCount > 0) evidence.push(positiveEvidence);
  if (negativeCount > 0) evidence.push(negativeEvidence);
  if (evidence.length === 0) evidence.push('Ingen tydelige signaler i innholdet.');
  return {
    score: clamp(initial + Math.min(positiveCount, 4) * 9 - Math.min(negativeCount, 4) * 8),
    evidence,
  };
}

export function analyzePondusTemplate(input: PondusTemplateInput): PondusAnalysisResult {
  const steps = input.steps ?? [];
  const objections = input.objections ?? [];
  const content = [
    input.name ?? '', input.description ?? '',
    ...steps.flatMap((step) => [step.title, step.subtitle ?? '', step.prompt ?? '']),
    ...objections.flatMap((objection) => [objection.prompt, objection.response]),
  ].join(' ').toLocaleLowerCase('nb-NO');

  const authority = axisResult(
    48,
    occurrences(content, [/\bvi hjelper\b/g, /\bvi har\b/g, /\bdokumentert\b/g, /\bkonkret\b/g, /\bresultat\b/g]),
    occurrences(content, [/\bkanskje\b/g, /\bmuligens\b/g, /\btror vi\b/g, /\bhåper\b/g]),
    'Bruker tydelig og resultatorientert språk.',
    'Inneholder forbehold som svekker eierskap.',
  );
  const clarity = axisResult(
    steps.length >= 3 && steps.length <= 10 ? 58 : 46,
    occurrences(content, [/\bformål\b/g, /\bneste steg\b/g, /\bkort\b/g, /\bett\b/g, /\bminutt/g]),
    occurrences(content, [/\balt\b/g, /\bmange\b/g, /\bosv\b/g]),
    'Har struktur, tidsramme eller ett tydelig neste poeng.',
    'Har brede formuleringer som kan gjøre budskapet uklart.',
  );
  const trust = axisResult(
    45,
    occurrences(content, [/\bkunde\b/g, /\bcase\b/g, /\bpilot\b/g, /\bmålbar/g, /\bærlig\b/g, /\bvet ikke\b/g, /\b\d+[ %]/g]),
    occurrences(content, [/\bgaranter/g, /\balltid\b/g, /\baldri\b/g, /\bbest\b/g]),
    'Underbygger påstander med kunde-, pilot- eller målingssignal.',
    'Har absolutte påstander som bør dokumenteres.',
  );
  const safety = axisResult(
    objections.length > 0 ? 55 : 45,
    occurrences(content, [/\bspør\b/g, /\bhva\b/g, /\brespekter/g, /\bforstår\b/g, /\bskjønner\b/g, /\brolig\b/g]),
    occurrences(content, [/\bfor enhver pris\b/g, /\bmå kjøpe\b/g, /\bpress\b/g, /\bkonkurrenten er dårlig/g]),
    'Bruker utforskende og respektfull respons.',
    'Har pressende eller unødvendig konfronterende språk.',
  );
  const momentum = axisResult(
    43,
    occurrences(content, [/\bneste steg\b/g, /\bdato\b/g, /\bkalender\b/g, /\bdenne uken\b/g, /\bneste uke\b/g, /\bavtale\b/g, /\bmøte\b/g]),
    occurrences(content, [/\bhøres vi\b/g, /\bta kontakt\b/g, /\ben gang\b/g, /\btenke på det\b/g]),
    'Avslutter med konkret fremdrift eller tidsforankring.',
    'Neste handling er åpen eller overlates til kunden.',
  );

  const analysis: PondusAnalysis = {
    authority: authority.score,
    clarity: clarity.score,
    trust: trust.score,
    safety: safety.score,
    momentum: momentum.score,
  };
  const entries = Object.entries(analysis) as Array<[keyof PondusAnalysis, number]>;
  const score = clamp(entries.reduce((sum, [, value]) => sum + value, 0) / entries.length);
  const labels: Record<keyof PondusAnalysis, string> = {
    authority: 'autoritet', clarity: 'klarhet', trust: 'troverdighet',
    safety: 'trygghet', momentum: 'fremdrift',
  };
  const recommendations = entries
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([key, value]) => `Styrk ${labels[key]} (${value}/100) med mer konkret og etterprøvbart språk.`);
  const usefulCharacters = content.replace(/\s/g, '').length;
  const confidence = clamp(35 + Math.min(steps.length, 8) * 6 + Math.min(usefulCharacters, 1_500) / 50) / 100;

  return {
    score,
    analysis,
    analysis_meta: {
      rubric_version: PONDUS_ANALYSIS_RUBRIC_VERSION,
      confidence,
      evidence: {
        authority: authority.evidence,
        clarity: clarity.evidence,
        trust: trust.evidence,
        safety: safety.evidence,
        momentum: momentum.evidence,
      },
      recommendations,
    },
  };
}

type QuizDimension = 'autoritet' | 'klarhet' | 'troverdighet' | 'trygghet' | 'fremdrift';
const QUIZ_BANK: Record<string, { dimension: QuizDimension; points: number[] }> = {
  q1: { dimension: 'autoritet', points: [2, 1, 4, 1] },
  q2: { dimension: 'autoritet', points: [1, 4, 2, 2] },
  q3: { dimension: 'klarhet', points: [1, 4, 2, 2] },
  q4: { dimension: 'klarhet', points: [2, 4, 1, 1] },
  q5: { dimension: 'troverdighet', points: [1, 4, 1, 3] },
  q6: { dimension: 'troverdighet', points: [1, 4, 2, 2] },
  q7: { dimension: 'trygghet', points: [1, 1, 4, 2] },
  q8: { dimension: 'trygghet', points: [4, 2, 2, 1] },
  q9: { dimension: 'trygghet', points: [2, 4, 1, 1] },
  q10: { dimension: 'fremdrift', points: [1, 4, 2, 2] },
  q11: { dimension: 'fremdrift', points: [1, 4, 3, 1] },
  q12: { dimension: 'fremdrift', points: [1, 2, 3, 4] },
};

export type PondusQuizScore = Record<QuizDimension, number> & {
  total: number;
  answers: Record<string, number>;
  scoringVersion: string;
};

export function scorePondusQuizAnswers(raw: unknown):
  | { ok: true; value: PondusQuizScore }
  | { ok: false; issues: PondusValidationIssue[] } {
  const answers = recordValue(raw);
  if (!answers) return { ok: false, issues: [{ path: 'answers', message: 'Svarene må være et objekt.' }] };
  const issues: PondusValidationIssue[] = [];
  const normalized: Record<string, number> = {};
  for (const key of Object.keys(answers)) {
    if (!QUIZ_BANK[key]) issues.push({ path: `answers.${key}`, message: 'Ukjent spørsmål.' });
  }
  for (const [questionId, config] of Object.entries(QUIZ_BANK)) {
    const answer = answers[questionId];
    if (!Number.isInteger(answer) || Number(answer) < 0 || Number(answer) >= config.points.length) {
      issues.push({ path: `answers.${questionId}`, message: 'Velg ett gyldig svaralternativ.' });
      continue;
    }
    normalized[questionId] = Number(answer);
  }
  if (issues.length > 0) return { ok: false, issues };

  const dimensions: QuizDimension[] = ['autoritet', 'klarhet', 'troverdighet', 'trygghet', 'fremdrift'];
  const scores = Object.fromEntries(dimensions.map((dimension) => {
    const points = Object.entries(QUIZ_BANK)
      .filter(([, config]) => config.dimension === dimension)
      .map(([id, config]) => config.points[normalized[id]]);
    const average = points.reduce((sum, value) => sum + value, 0) / points.length;
    return [dimension, clamp(((average - 1) / 3) * 100)];
  })) as Record<QuizDimension, number>;
  const total = clamp(dimensions.reduce((sum, dimension) => sum + scores[dimension], 0) / dimensions.length);
  return {
    ok: true,
    value: {
      ...scores,
      total,
      answers: normalized,
      scoringVersion: PONDUS_QUIZ_SCORING_VERSION,
    },
  };
}
