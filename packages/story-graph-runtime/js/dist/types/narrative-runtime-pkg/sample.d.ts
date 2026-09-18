/**
 * Eksempelprosjekt for runtime-pakken. Dekker det dokumenterte arcscript-
 * DELSETTET som C#-/GDScript-lasterne implementerer: tilordning, if/elseif/
 * else/endif rundt prose, sammenligning, and/or/not, visits(), forgrening med
 * else-betingelse, jumper, etikett-skript ved valg.
 *
 * Eksporteres til packages/story-graph-runtime/fixtures/sample-project.json
 * (Arcweave project.json) + sample-project.expected.txt av byggeskriptet.
 */
import type { ExportGraph } from '../narrative-format/types';
export declare const SAMPLE_GRAPH: ExportGraph;
