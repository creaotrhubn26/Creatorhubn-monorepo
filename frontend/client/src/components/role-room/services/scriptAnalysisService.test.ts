import { describe, expect, it } from 'vitest';

import {
  analyzeScript,
  analyzeScriptExtended,
} from './scriptAnalysisService';

describe('presis manus-analyse', () => {
  it('bruker karaktermarkører og teller faktiske dialoglinjer', () => {
    const content = [
      'INT. STUE - DAG', '',
      'NORA', 'Hei.', '(lavt)', 'Er du der?', '',
      'Et CANON-kamera ligger på bordet.', '',
      'APPLE IPAD PRO 11', '',
    ].join('\n');
    const analysis = analyzeScript(content);

    expect(analysis.stats.totalCharacters).toBe(1);
    expect(analysis.stats.totalDialogueLines).toBe(2);
    expect(analysis.characterConflicts).toEqual([]);
  });

  it('antar ikke at rekkefølgen DAG/NATT er en tidslinjefeil', () => {
    const content = [
      'INT. GATE - NATT', 'Hun venter.', '',
      'EXT. FJELL - MORNING', 'Solen står opp.', '',
      'INT. HYTTE - DAY', 'En klokke tikker.',
    ].join('\n');

    expect(analyzeScript(content).consistencyIssues).toEqual([]);
  });

  it('rapporterer ikke en karakter som feil bare fordi den har én replikk', () => {
    const content = ['INT. ROM - DAG', '', 'VAKT', 'Stans!', ''].join('\n');
    expect(analyzeScript(content).characterConflicts).toEqual([]);
  });

  it('viser bare en navnevariant ved asymmetrisk og konkret én-bokstav-evidens', () => {
    const possibleTypo = [
      'INT. ROM - DAG', '',
      'NORA', 'En.', '',
      'NORA', 'To.', '',
      'NORA', 'Tre.', '',
      'NORAH', 'Fire.',
    ].join('\n');
    const twoRecurringPeople = `${possibleTypo}\n\nNORAH\nFem.`;

    expect(analyzeScript(possibleTypo).characterConflicts).toEqual([
      expect.objectContaining({ type: 'name_similar', severity: 'info', confidence: 'medium' }),
    ]);
    expect(analyzeScript(twoRecurringPeople).characterConflicts).toEqual([]);
  });

  it('dikter ikke akt, sekvens, klimaks eller pacingproblemer uten eksplisitte markører', () => {
    const content = [
      'INT. ROM - DAG', '', 'NORA', 'Dette er sannheten.', '',
      'EXT. SKOG - NATT', 'Hun løper.',
    ].join('\n');
    const analysis = analyzeScriptExtended(content);

    expect(analysis.actStructure).toEqual([]);
    expect(analysis.sequences).toEqual([]);
    expect(analysis.numberedScenes.every((scene) => scene.purpose == null)).toBe(true);
    expect(analysis.pacingAnalysis.actPacing).toEqual([]);
    expect(analysis.pacingAnalysis.pacingIssues).toEqual([]);
  });

  it('leser struktur og sceneformål når forfatteren har markert dem eksplisitt', () => {
    const content = [
      '# AKT 1 - Oppsett',
      '## SEKVENS: Åpning',
      'INT. ROM - DAG',
      '[[formål: konflikt]]',
      'De krangler.', '',
      '# AKT 2 - Konsekvens',
      'EXT. SKOG - NATT',
      'Hun går alene.',
    ].join('\n');
    const analysis = analyzeScriptExtended(content);

    expect(analysis.actStructure).toHaveLength(2);
    expect(analysis.actStructure[0]).toMatchObject({ name: 'Oppsett', startScene: 1, endScene: 1 });
    expect(analysis.sequences).toHaveLength(1);
    expect(analysis.sequences[0]).toMatchObject({ name: 'Åpning', purpose: 'conflict' });
    expect(analysis.numberedScenes[0].purpose).toBe('conflict');
  });
});
