/**
 * Beskytter mot drift mellom Director-system-prompten og tilgjengelige
 * tool-domener. Hvis vi legger til nye tool-kategorier må prompten
 * mentionere dem, ellers vil ikke autoloopen velge dem av seg selv.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPT_FILE = resolvePath(
  __dirname,
  "../src/components/MultiAgentDirectorDialog.tsx",
);

function extractPrompt(): string {
  const source = readFileSync(PROMPT_FILE, "utf8");
  const match = source.match(/const DIRECTOR_SYSTEM_PROMPT = `([\s\S]*?)`;/);
  if (!match) throw new Error("Klarte ikke finne DIRECTOR_SYSTEM_PROMPT");
  return match[1];
}

test.describe("Director system-prompt dekker nye tool-domener", () => {
  const prompt = extractPrompt();

  test("Prompten nevner Resolve native AI som førstevalg", () => {
    expect(prompt).toMatch(/Resolve 21 native/i);
    expect(prompt).toMatch(/SMART ROUTING/);
  });

  test("Prompten dekker introspeksjons-strategi (snapshot-first)", () => {
    expect(prompt).toMatch(/KARTLEGG state FØR/);
    expect(prompt).toMatch(/full settings-dict|snapshot/i);
  });

  test("Prompten mentionerer voice isolation", () => {
    expect(prompt).toMatch(/voice_set_isolation_state|Voice Isolation/i);
  });

  test("Prompten mentionerer page-navigation", () => {
    expect(prompt).toMatch(/page_open|page_current/);
  });

  test("Prompten mentionerer clip-color workflow-merking", () => {
    expect(prompt).toMatch(/clip_set_color|workflow-organisering|workflow.organis/i);
  });

  test("Prompten mentionerer timecode-navigation", () => {
    expect(prompt).toMatch(/timeline_get_current_timecode|timeline_set_current_timecode/);
  });

  test("Prompten mentionerer settings-bro (project/timeline)", () => {
    expect(prompt).toMatch(/project_get_setting|timeline_get_setting/);
  });

  test("Prompten mentionerer subtitle-import", () => {
    expect(prompt).toMatch(/subtitle_import_from_file/);
  });

  test("Prompten mentionerer slate + intellisearch analyze", () => {
    expect(prompt).toMatch(/slate_analyze/);
    expect(prompt).toMatch(/intellisearch_analyze/);
  });

  test("Prompten mentionerer gallery import", () => {
    expect(prompt).toMatch(/gallery_import_stills/);
  });

  test("Prompten advarer om string-only settings", () => {
    expect(prompt).toMatch(/string|kun strings|godtar KUN/i);
  });

  test("Prompten holder norsk dialog", () => {
    expect(prompt).toMatch(/Hold tone.*norsk/);
  });

  test("Prompten har minst 8 tool-domener under TOOL-DOMENER", () => {
    const domains = (prompt.match(/^\s+• [A-ZÆØÅ ]+:/gm) || []).length;
    expect(domains).toBeGreaterThanOrEqual(8);
  });

  test("Prompten har konkrete hybrid-flyt eksempler", () => {
    expect(prompt).toMatch(/HYBRID/);
    expect(prompt).toMatch(/exportBack|export_back|openLatest|open_latest/);
  });

  test("Prompten nevner history.snapshot for tryggere eksperimenter", () => {
    expect(prompt).toMatch(/history_snapshot|history.snapshot/i);
  });
});
