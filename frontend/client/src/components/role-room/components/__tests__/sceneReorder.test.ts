import { describe, expect, it } from 'vitest';
import { reorderScenesInContent, reorderScenesWithLineMap } from '../SceneNavigatorSidebar';

// Fountain med 3 scener + preamble (tittel-side). Linjenumre er 1-baserte.
const CONTENT = [
  'Title: Test',     // 1  (preamble)
  '',                // 2  (preamble)
  'INT. KJØKKEN - DAG', // 3  scene 0
  'Handling A.',     // 4
  '',                // 5
  'EXT. GATE - NATT', // 6  scene 1
  'Handling B.',     // 7
  '',                // 8
  'INT. BIL - DAG',  // 9  scene 2
  'Handling C.',     // 10
].join('\n');

describe('reorderScenesWithLineMap (Fountain er source-of-truth)', () => {
  it('er identitet når from === to', () => {
    const { content, mapLine } = reorderScenesWithLineMap(CONTENT, 1, 1);
    expect(content).toBe(CONTENT);
    expect(mapLine(10)).toBe(10);
  });

  it('flytter scene-blokken i teksten (scene 2 → først)', () => {
    const out = reorderScenesInContent(CONTENT, 2, 0);
    const lines = out.split('\n');
    // Preamble beholdes øverst
    expect(lines[0]).toBe('Title: Test');
    // Første scene er nå INT. BIL, og dens handling følger med
    expect(lines[2]).toBe('INT. BIL - DAG');
    expect(lines[3]).toBe('Handling C.');
    // De andre scenene finnes fortsatt
    expect(out).toContain('INT. KJØKKEN - DAG');
    expect(out).toContain('EXT. GATE - NATT');
  });

  it('mapper en kommentar-linje inne i den flyttede scenen til ny posisjon', () => {
    const { mapLine } = reorderScenesWithLineMap(CONTENT, 2, 0);
    // "Handling C." var linje 10, scene 2; etter flytting til toppen blir den linje 4.
    expect(mapLine(10)).toBe(4);
    // Preamble-linjer flyttes aldri.
    expect(mapLine(1)).toBe(1);
  });

  it('returnerer uendret innhold ved ugyldige indekser', () => {
    const { content } = reorderScenesWithLineMap(CONTENT, 0, 99);
    expect(content).toBe(CONTENT);
  });
});
