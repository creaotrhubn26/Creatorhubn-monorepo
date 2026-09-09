import { describe, expect, it } from 'vitest';

import {
  buildCharacterSmartTypeSuggestions,
  rankCharacterSmartTypeSuggestions,
} from './screenplaySmartType';

describe('screenplay SmartType', () => {
  it('uses only explicit screenplay character sources and explains each source', () => {
    const suggestions = buildCharacterSmartTypeSuggestions({
      scriptCharacters: ['NORA'],
      roleNames: ['Nora', 'ANDREAS'],
      projectCharacters: ['ZELDA'],
    });

    expect(suggestions.map((suggestion) => suggestion.value)).toEqual(['ANDREAS', 'NORA', 'ZELDA']);
    expect(suggestions.find((suggestion) => suggestion.value === 'NORA')).toMatchObject({
      sources: ['script', 'role'],
      sourceLabel: 'I manuset · Rolle',
    });
    expect(suggestions.some((suggestion) => suggestion.value.includes('CANON'))).toBe(false);
  });

  it('prefers the likely dialogue partner and removes stale script-only names on rebuild', () => {
    const suggestions = buildCharacterSmartTypeSuggestions({
      scriptCharacters: ['NORA', 'ANDREAS', 'OLD TYPO'],
      roleNames: [],
      projectCharacters: [],
    });

    const ranked = rankCharacterSmartTypeSuggestions({
      suggestions,
      partial: '',
      recentCharacters: ['ANDREAS', 'NORA'],
    });
    expect(ranked[0]).toMatchObject({ value: 'ANDREAS', reason: 'Sannsynlig svar i dialogen' });

    const rebuilt = buildCharacterSmartTypeSuggestions({
      scriptCharacters: ['NORA', 'ANDREAS'],
      roleNames: [],
      projectCharacters: [],
    });
    expect(rebuilt.some((suggestion) => suggestion.value === 'OLD TYPO')).toBe(false);
  });
});
