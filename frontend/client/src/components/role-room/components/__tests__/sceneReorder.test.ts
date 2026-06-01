import { describe, expect, it } from 'vitest';
import {
  reorderScenesInContent,
  reorderScenesWithLineMap,
  buildLineCommentAnchor,
  resolveLineCommentAnchor,
} from '../SceneNavigatorSidebar';

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

describe('scene-relativ kommentar-forankring (ingen drift)', () => {
  it('bygger et scene-relativt anker for en linje inne i en scene', () => {
    // Linje 10 = "Handling C." i scene 2 (heading på linje 9) → offset 1.
    const anchor = buildLineCommentAnchor(CONTENT, 'm1', 10);
    expect(anchor).toMatch(/^m1#s:.+:1$/);
  });

  it('round-trip: anker løser tilbake til samme linje i uendret innhold', () => {
    const anchor = buildLineCommentAnchor(CONTENT, 'm1', 10);
    expect(resolveLineCommentAnchor(CONTENT, 'm1', anchor)).toBe(10);
  });

  it('ankeret FØLGER scenen ved reorder (ingen drift)', () => {
    const anchor = buildLineCommentAnchor(CONTENT, 'm1', 10); // "Handling C." i scene 2
    const reordered = reorderScenesInContent(CONTENT, 2, 0);   // flytt scene 2 → først
    const newLine = resolveLineCommentAnchor(reordered, 'm1', anchor);
    expect(newLine).toBe(4); // "Handling C." er nå på linje 4
    expect(reordered.split('\n')[newLine! - 1]).toBe('Handling C.');
  });

  it('gir null når scenen er slettet (foreldreløst anker)', () => {
    const anchor = buildLineCommentAnchor(CONTENT, 'm1', 10);
    // Fjern scene 2-blokken helt
    const withoutBil = CONTENT.split('\n').slice(0, 7).join('\n');
    expect(resolveLineCommentAnchor(withoutBil, 'm1', anchor)).toBeNull();
  });

  it('preamble-linjer får absolutt fallback-anker', () => {
    const anchor = buildLineCommentAnchor(CONTENT, 'm1', 1); // "Title: Test" (preamble)
    expect(anchor).toBe('m1#L:1');
    expect(resolveLineCommentAnchor(CONTENT, 'm1', anchor)).toBe(1);
  });
});
