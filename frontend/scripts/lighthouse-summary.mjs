#!/usr/bin/env node
/**
 * Skriver ut hvilke Lighthouse-revisjoner som feilet, per URL.
 *
 * Hvorfor denne finnes: `lhci assert` sier hvilken KATEGORI som falt
 * («accessibility 0.87 mot 0.90»), men ikke hvilke regler som brøt. Det
 * står bare i rapportene, og de er 8,8 MB artefakt man må laste ned og
 * pakke ut for å lese. Resultatet er at en rød kjøring ikke forteller deg
 * hva du skal fikse — den forteller deg at du må begynne å lete.
 *
 * Kjøres etter `lhci autorun`, leser rapportene fra disk, og skriver
 * regel-id, tittel og antall treffede elementer til stdout (og til
 * GitHubs jobbsammendrag når $GITHUB_STEP_SUMMARY finnes).
 *
 * Avslutter alltid med 0. Dette er diagnostikk, ikke en portvakt —
 * `lhci assert` eier avgjørelsen om noe skal feile.
 */

import { readdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = process.argv[2] ?? "./lighthouse-reports";

/** Kategorier vi rapporterer på, i den rekkefølgen de er verdt å lese. */
const CATEGORIES = ["accessibility", "best-practices", "performance", "seo"];

function loadReports(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    console.log(`Ingen rapportmappe på ${dir} — hoppet over.`);
    return [];
  }
  return names
    .filter((n) => n.endsWith(".json") && n !== "manifest.json")
    .map((n) => {
      try {
        return JSON.parse(readFileSync(join(dir, n), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.categories && r.audits);
}

/**
 * Feilende revisjoner for én rapport.
 *
 * Filtrerer bort `notApplicable` og `informative`: en regel som ikke
 * gjelder siden er ikke et funn, og å liste den ville druknet de som er.
 */
function failuresFor(report) {
  const out = [];
  for (const key of CATEGORIES) {
    const category = report.categories[key];
    if (!category) continue;
    for (const ref of category.auditRefs) {
      const audit = report.audits[ref.id];
      if (!audit) continue;
      if (audit.scoreDisplayMode === "notApplicable") continue;
      if (audit.scoreDisplayMode === "informative") continue;
      if (audit.score === null || audit.score >= 1) continue;
      out.push({
        category: key,
        id: ref.id,
        title: audit.title,
        // Vekten avgjør hvor mye regelen trekker ned. En 0-vektet regel
        // kan være verdt å fikse, men den flytter ikke terskelen.
        weight: ref.weight ?? 0,
        nodes: audit.details?.items?.length ?? 0,
      });
    }
  }
  // Tyngst først — det er den rekkefølgen man vil jobbe i.
  return out.sort((a, b) => b.weight - a.weight);
}

const reports = loadReports(REPORT_DIR);
if (reports.length === 0) {
  console.log("Fant ingen Lighthouse-rapporter å oppsummere.");
  process.exit(0);
}

// Én URL kjøres flere ganger. Rapportene er like nok til at den første
// holder — vi er ute etter hvilke regler som brøt, ikke medianen.
const byUrl = new Map();
for (const report of reports) {
  const url = report.finalDisplayedUrl ?? report.finalUrl ?? report.requestedUrl;
  if (!byUrl.has(url)) byUrl.set(url, report);
}

const lines = [];
const say = (s = "") => {
  console.log(s);
  lines.push(s);
};

say("## Feilende Lighthouse-revisjoner");
say();

for (const [url, report] of byUrl) {
  const failures = failuresFor(report);
  const scores = CATEGORIES.filter((c) => report.categories[c])
    .map((c) => `${c} ${report.categories[c].score}`)
    .join(" · ");

  say(`### ${url}`);
  say(`_${scores}_`);
  say();

  if (failures.length === 0) {
    say("Ingen feilende revisjoner.");
    say();
    continue;
  }

  say("| Kategori | Regel | Vekt | Elementer | Tittel |");
  say("| --- | --- | ---: | ---: | --- |");
  for (const f of failures) {
    say(`| ${f.category} | \`${f.id}\` | ${f.weight} | ${f.nodes} | ${f.title} |`);
  }
  say();
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  try {
    appendFileSync(summaryPath, lines.join("\n") + "\n");
  } catch (err) {
    console.log(`Kunne ikke skrive jobbsammendrag: ${err.message}`);
  }
}
