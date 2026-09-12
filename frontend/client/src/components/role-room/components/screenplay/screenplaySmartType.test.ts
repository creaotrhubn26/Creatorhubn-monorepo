import { describe, expect, it } from 'vitest';

import {
  buildCharacterRenamePreview,
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
    expect(ranked[0].sourceLabel).toContain('Nylig brukt');

    const rebuilt = buildCharacterSmartTypeSuggestions({
      scriptCharacters: ['NORA', 'ANDREAS'],
      roleNames: [],
      projectCharacters: [],
    });
    expect(rebuilt.some((suggestion) => suggestion.value === 'OLD TYPO')).toBe(false);
  });

  it('previews and renames only parsed character lines while preserving Fountain syntax', () => {
    const content = [
      'INT. STUE - DAG',
      '',
      'BOB',
      'Hei.',
      '',
      '@BOB (V.O.) ^',
      'BOB', // Uppercase action in this fixture, deliberately not in the parsed index list.
    ].join('\n');

    const preview = buildCharacterRenamePreview({
      content,
      oldName: 'BOB',
      newName: 'ROBERT',
      characterLineIndexes: [2, 5],
    });

    expect(preview.occurrences.map((occurrence) => occurrence.lineNumber)).toEqual([3, 6]);
    expect(preview.content.split('\n')).toEqual([
      'INT. STUE - DAG',
      '',
      'ROBERT',
      'Hei.',
      '',
      '@ROBERT (V.O.) ^',
      'BOB',
    ]);
  });

  it('returns a no-op preview for an invalid or identical rename', () => {
    const preview = buildCharacterRenamePreview({
      content: 'BOB',
      oldName: 'BOB',
      newName: 'Bob',
      characterLineIndexes: [0],
    });

    expect(preview.occurrences).toEqual([]);
    expect(preview.content).toBe('BOB');
  });
});
