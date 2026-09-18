/**
 * Paritet mellom kilden (shared/narrative-runtime-pkg) og den committede
 * pakkebundelen (packages/story-graph-runtime/js/dist) + fixture-transkriptet
 * som C#-/GDScript-lasterne sjekkes mot. Rød test = kjør
 * `npm run build:narrative-runtime-pkg` og commit dist/fixtures på nytt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadArcweaveProject, playTranscript, sampleArcweaveProject } from '../narrative-runtime-pkg';

const PKG = path.resolve(__dirname, '../../../packages/story-graph-runtime');
const read = (rel: string) => readFileSync(path.join(PKG, rel), 'utf8');

describe('story-graph-runtime — pakke-paritet', () => {
  it('fixture project.json er eksporten av SAMPLE_GRAPH', () => {
    expect(JSON.parse(read('fixtures/sample-project.json'))).toEqual(JSON.parse(JSON.stringify(sampleArcweaveProject())));
  });

  it('kilde-transkript == expected.txt (referanse for C#/GDScript)', () => {
    const { graph, warnings } = loadArcweaveProject(sampleArcweaveProject());
    expect(warnings).toEqual([]);
    expect(playTranscript(graph)).toBe(read('fixtures/sample-project.expected.txt'));
  });

  it('dist/index.js (ESM-bundel) gir samme transkript som kilden', async () => {
    const mod = await import(/* @vite-ignore */ path.join(PKG, 'js/dist/index.js')) as typeof import('../narrative-runtime-pkg');
    const project = JSON.parse(read('fixtures/sample-project.json'));
    expect(mod.playTranscript(mod.loadArcweaveProject(project).graph)).toBe(read('fixtures/sample-project.expected.txt'));
    expect(typeof mod.createSessionFromArcweave).toBe('function');
  });

  it('transkriptet dekker delsettet: tilordning, if/elseif/else, visits(), forgrening, jumper, etikett-skript', () => {
    const { graph } = loadArcweaveProject(sampleArcweaveProject());
    const t = playTranscript(graph);
    expect(t).toContain('Kjøpmannen smiler.');          // if gold >= 10 and not visits(@[rich])
    expect(t).toContain('vars: brave=true gold=10');    // gold += 10 ved start
    expect(t).toContain('@ ');                           // elementer
    // Alltid første valg: Torget → Markedet → Handle (gold -= 10) → forgrening c_poor (gold 0) → Fattig → jumper → Torget (visits 2 → gold 10-5)
    expect(t).toContain('Pungen er lettere denne gangen.');
    expect(t).toContain('vars: brave=true gold=5');
    // Ikke-første valg: alltid hjem
    expect(t).toContain('@ end | Slutt');                // forgrening «gir opp» når gold < 0
    expect(t.trim().endsWith('vars: brave=true gold=-5')).toBe(true);
    expect(playTranscript(graph, { pick: (n) => n - 1 })).toContain('> choose 2\n@ end | Slutt');
  });
});
