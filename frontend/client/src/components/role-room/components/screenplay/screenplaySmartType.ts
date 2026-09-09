export type ScreenplaySmartTypeSource = 'script' | 'role' | 'project';

export interface ScreenplayCharacterSuggestion {
  value: string;
  sources: ScreenplaySmartTypeSource[];
  sourceLabel: string;
  reason: string;
}

interface BuildCharacterSuggestionsInput {
  scriptCharacters: string[];
  roleNames: string[];
  projectCharacters: string[];
}

interface RankCharacterSuggestionsInput {
  suggestions: ScreenplayCharacterSuggestion[];
  partial: string;
  recentCharacters?: string[];
  limit?: number;
}

const SOURCE_ORDER: ScreenplaySmartTypeSource[] = ['script', 'role', 'project'];

export const normalizeSmartTypeName = (value: string): string => value
  .replace(/^@/, '')
  .replace(/\s*\^\s*$/, '')
  .replace(/\s*\(.*\)\s*$/, '')
  .trim()
  .toLocaleUpperCase('nb-NO');

const isUsableName = (value: string): boolean => {
  const normalized = normalizeSmartTypeName(value);
  return normalized.length > 0 && normalized.length <= 80;
};

const sourceLabel = (sources: ScreenplaySmartTypeSource[]): string => sources
  .map((source) => {
    if (source === 'script') return 'I manuset';
    if (source === 'role') return 'Rolle';
    return 'Prosjektkarakter';
  })
  .join(' · ');

export function buildCharacterSmartTypeSuggestions({
  scriptCharacters,
  roleNames,
  projectCharacters,
}: BuildCharacterSuggestionsInput): ScreenplayCharacterSuggestion[] {
  const candidates = new Map<string, { value: string; sources: Set<ScreenplaySmartTypeSource> }>();

  const add = (values: string[], source: ScreenplaySmartTypeSource) => {
    values.forEach((value) => {
      if (!isUsableName(value)) return;
      const normalized = normalizeSmartTypeName(value);
      const existing = candidates.get(normalized);
      if (existing) {
        existing.sources.add(source);
        return;
      }
      candidates.set(normalized, {
        value: normalized,
        sources: new Set([source]),
      });
    });
  };

  add(scriptCharacters, 'script');
  add(roleNames, 'role');
  add(projectCharacters, 'project');

  return Array.from(candidates.values())
    .map(({ value, sources }) => {
      const orderedSources = SOURCE_ORDER.filter((source) => sources.has(source));
      return {
        value,
        sources: orderedSources,
        sourceLabel: sourceLabel(orderedSources),
        reason: orderedSources.includes('script')
          ? 'Brukt i manuset'
          : orderedSources.includes('role')
            ? 'Registrert rolle'
            : 'Registrert i prosjektet',
      };
    })
    .sort((left, right) => left.value.localeCompare(right.value, 'nb-NO'));
}

export function rankCharacterSmartTypeSuggestions({
  suggestions,
  partial,
  recentCharacters = [],
  limit = 10,
}: RankCharacterSuggestionsInput): ScreenplayCharacterSuggestion[] {
  const normalizedPartial = normalizeSmartTypeName(partial);
  const normalizedRecent = recentCharacters
    .map(normalizeSmartTypeName)
    .filter(Boolean);
  const lastSpeaker = normalizedRecent.at(-1) ?? '';
  const likelyReply = [...normalizedRecent].reverse().find((name) => name !== lastSpeaker) ?? '';
  const sceneCharacters = new Set(normalizedRecent);

  const scored = suggestions
    .filter((suggestion) => suggestion.value.startsWith(normalizedPartial))
    .map((suggestion) => {
      let score = 0;
      if (suggestion.value === normalizedPartial) score += 200;
      if (suggestion.value === likelyReply) score += 90;
      if (sceneCharacters.has(suggestion.value)) score += 50;
      if (suggestion.sources.includes('script')) score += 30;
      if (suggestion.sources.includes('role')) score += 20;
      if (suggestion.sources.includes('project')) score += 10;
      score -= suggestion.value.length / 100;

      const reason = suggestion.value === likelyReply
        ? 'Sannsynlig svar i dialogen'
        : sceneCharacters.has(suggestion.value)
          ? 'Brukt i denne scenen'
          : suggestion.reason;

      return { suggestion: { ...suggestion, reason }, score };
    });

  return scored
    .sort((left, right) => (
      right.score - left.score
      || left.suggestion.value.localeCompare(right.suggestion.value, 'nb-NO')
    ))
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}
