/**
 * verify-sfx-match.ts — engangs-verifikasjon: laster CLAP text-
 * embedder, embedder noen test-prompts, og finner top-3 matches mot
 * det bygde biblioteket. Brukes for å verifisere at hele pipelinen
 * virker uten å starte hele backend-serveren.
 */

import fs from 'node:fs';
import path from 'node:path';

interface Sample {
  id: string;
  title: string;
  categoryId: string;
  embedding: number[];
}

function cosine(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const libPath = path.resolve(process.cwd(), 'data', 'sfx-library.json');
  const lib = JSON.parse(fs.readFileSync(libPath, 'utf-8'));
  console.log(`[verify] library: ${lib.samples.length} samples, model=${lib.embeddingModel}`);

  console.log('[verify] laster CLAP text-encoder…');
  const transformers = await import('@xenova/transformers');
  const { AutoTokenizer, ClapTextModelWithProjection } = transformers as any;
  const tokenizer = await AutoTokenizer.from_pretrained('Xenova/clap-htsat-unfused');
  const model = await ClapTextModelWithProjection.from_pretrained('Xenova/clap-htsat-unfused');
  console.log('[verify] CLAP klar');

  const testPrompts = [
    'sound of door slamming, loud',
    'sound of rain falling',
    'sound of phone ringing',
    'sound of footsteps walking',
    'sound of gunshot',
    'sound of thunder',
    'sound of glass breaking',
    'sound of laughing',  // ikke i biblioteket — sjekk om vi får "least-bad" match
  ];

  for (const prompt of testPrompts) {
    const inputs = tokenizer(prompt, { padding: true, truncation: true });
    const out = await model(inputs);
    const queryEmb = out.text_embeds.data.slice(0, 512);

    const matches = (lib.samples as Sample[])
      .map((s) => ({ id: s.id, title: s.title, score: cosine(queryEmb, s.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    console.log(`\n"${prompt}":`);
    for (const m of matches) {
      console.log(`  ${(m.score * 100).toFixed(1)}%  ${m.id}`);
    }
  }
}

main().catch((err) => {
  console.error('[verify] feilet:', err);
  process.exit(1);
});
