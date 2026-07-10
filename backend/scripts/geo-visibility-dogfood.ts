/**
 * geo-visibility-dogfood.ts
 *
 * Kjører hele GEO Visibility-pipeline-en (docs/integration-audit/08)
 * ende-til-ende UTEN database — for dogfooding/lokal testing før deploy.
 *
 *   npx tsx scripts/geo-visibility-dogfood.ts \
 *     [--brand Leadgrid] [--industry "..."] [--prompts 10]
 *
 * Krever ANTHROPIC_API_KEY i miljøet (OPENAI_API_KEY/PERPLEXITY_API_KEY
 * plukkes opp automatisk hvis satt — motorer uten nøkkel hoppes over,
 * akkurat som i prod-runneren).
 *
 * Output: menneskelesbar rapport til stdout + markdown-fil hvis
 * --out <sti> er satt. Alle tall er syntetiske målinger (isEstimated).
 */

import { generatePromptsViaClaude } from "../server/market-intelligence/geo-prompt-set-service.js";
import { getGeoProbeEngines } from "../server/market-intelligence/geo-probe-engines.js";
import {
  aggregateToSignals,
  citesDomain,
  extractBrandMentions,
  extractUrls,
  type ProbeResultForAggregation,
} from "../server/market-intelligence/geo-probe-runner-service.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const CONFIG = {
  targetBrand: arg("brand", "Leadgrid"),
  targetDomain: arg("domain", "theroleroom.com"),
  industry: arg(
    "industry",
    "leadgenerering, feltsalg og kundeoppfølging for småbedrifter og håndverkere",
  ),
  region: arg("region", "Norge"),
  competitorBrands: ["HubSpot", "Pipedrive", "SuperOffice", "Salesforce"],
  promptCount: Number(arg("prompts", "10")),
  out: arg("out", ""),
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY mangler i miljøet.");
    process.exit(1);
  }

  console.log(`\n══ GEO dogfood: ${CONFIG.targetBrand} (${CONFIG.region}) ══\n`);
  console.log(`Bransje: ${CONFIG.industry}`);
  console.log(`Konkurrenter: ${CONFIG.competitorBrands.join(", ")}\n`);

  // 1. Generer prompts (samme vei som prod)
  console.log(`[1/3] Genererer ${CONFIG.promptCount} testspørsmål via Claude …`);
  const prompts = await generatePromptsViaClaude({
    industry: CONFIG.industry,
    region: CONFIG.region,
    targetBrand: CONFIG.targetBrand,
    competitorBrands: CONFIG.competitorBrands,
    count: CONFIG.promptCount,
  });
  if (prompts.length === 0) {
    console.error("Prompt-generering ga ingen gyldige spørsmål.");
    process.exit(1);
  }
  for (const p of prompts) console.log(`   [${p.topic}/${p.intent}] ${p.text}`);

  // 2. Probe konfigurerte motorer
  const engines = getGeoProbeEngines();
  const configured = engines.filter((e) => e.isConfigured());
  const skipped = engines.filter((e) => !e.isConfigured()).map((e) => e.engineId);
  console.log(
    `\n[2/3] Prober ${configured.map((e) => e.engineId).join(", ")}` +
      (skipped.length ? ` (hoppet over uten nøkkel: ${skipped.join(", ")})` : "") +
      ` — ${prompts.length} spørsmål × ${configured.length} motor(er) …`,
  );

  const allBrands = [CONFIG.targetBrand, ...CONFIG.competitorBrands];
  const results: ProbeResultForAggregation[] = [];
  const perPrompt: Array<{
    prompt: string;
    topic: string;
    engine: string;
    brands: string;
    targetHit: boolean;
    excerpt: string;
  }> = [];
  let failures = 0;

  for (const prompt of prompts) {
    for (const engine of configured) {
      const answer = await engine.ask(prompt.text);
      if (answer === null) {
        failures++;
        continue;
      }
      const mentioned = extractBrandMentions(answer, allBrands);
      const urls = extractUrls(answer);
      const targetHit = mentioned.some((m) => m.name === CONFIG.targetBrand);
      results.push({
        promptTopic: prompt.topic,
        engine: engine.engineId,
        mentionedBrands: mentioned,
        targetCited: citesDomain(urls, CONFIG.targetDomain),
      });
      perPrompt.push({
        prompt: prompt.text,
        topic: prompt.topic,
        engine: engine.engineId,
        brands: mentioned.map((m) => `${m.rank}.${m.name}`).join(" ") || "(ingen kjente)",
        targetHit,
        excerpt: answer.slice(0, 160).replace(/\s+/g, " "),
      });
      process.stdout.write(targetHit ? "✓" : "·");
    }
  }
  console.log(` (${results.length} svar, ${failures} feilet)\n`);

  // 3. Aggreger + rapport (samme aggregator som prod; dummy org-id)
  console.log("[3/3] Aggregerer …\n");
  const now = new Date().toISOString();
  const signals = aggregateToSignals(results, {
    organizationId: "00000000-0000-4000-8000-000000000001",
    workspaceId: "dogfood",
    runId: "dogfood-local",
    targetBrand: CONFIG.targetBrand,
    competitorBrands: CONFIG.competitorBrands,
    region: CONFIG.region,
    periodStart: now,
    periodEnd: now,
    collectedAt: now,
  });

  const totalMentions = results.reduce((s, r) => s + r.mentionedBrands.length, 0);
  const lines: string[] = [];
  const log = (s: string) => {
    lines.push(s);
    console.log(s);
  };

  log(`# GEO dogfood-rapport: ${CONFIG.targetBrand}`);
  log("");
  log(`> SYNTETISK måling (${results.length} AI-svar via offisielle APIer, ${now.slice(0, 10)}).`);
  log(`> Motorer: ${configured.map((e) => e.engineId).join(", ")}${skipped.length ? ` — hoppet over: ${skipped.join(", ")}` : ""}. Estimat, ikke reelle brukertall.`);
  log("");
  log("## Share-of-voice");
  log("");
  for (const brand of allBrands) {
    const mentions = results.filter((r) => r.mentionedBrands.some((m) => m.name === brand)).length;
    const brandTotal = results.flatMap((r) => r.mentionedBrands).filter((m) => m.name === brand).length;
    const share = totalMentions > 0 ? Math.round((brandTotal / totalMentions) * 1000) / 10 : 0;
    const marker = brand === CONFIG.targetBrand ? " ← deg" : "";
    log(`- **${brand}**: nevnt i ${mentions}/${results.length} svar (${share} % share-of-voice)${marker}`);
  }
  log("");

  const topicMap = new Map<string, { total: number; targetHit: boolean }>();
  for (const r of results) {
    const t = topicMap.get(r.promptTopic) ?? { total: 0, targetHit: false };
    t.total++;
    if (r.mentionedBrands.some((m) => m.name === CONFIG.targetBrand)) t.targetHit = true;
    topicMap.set(r.promptTopic, t);
  }
  const missing = [...topicMap.entries()].filter(([, t]) => !t.targetHit);
  log(`## Temaer der ${CONFIG.targetBrand} IKKE nevnes (${missing.length}/${topicMap.size})`);
  log("");
  for (const [topic, t] of missing) log(`- ${topic} (${t.total} svar)`);
  log("");

  const citations = results.filter((r) => r.targetCited).length;
  log(`## Siteringer av ${CONFIG.targetDomain}: ${citations}/${results.length} svar`);
  log("");
  log("## Per spørsmål");
  log("");
  for (const p of perPrompt) {
    log(`- ${p.targetHit ? "✅" : "❌"} [${p.topic}/${p.engine}] «${p.prompt}»`);
    log(`  Nevnt: ${p.brands}`);
  }
  log("");
  log(`_${signals.length} NormalizedSignals generert (alle isEstimated=true) — i prod lagres disse i normalized_signals._`);

  if (CONFIG.out) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(CONFIG.out, lines.join("\n"), "utf8");
    console.log(`\nRapport skrevet til ${CONFIG.out}`);
  }
}

main().catch((err) => {
  console.error("Dogfood feilet:", err);
  process.exit(1);
});
