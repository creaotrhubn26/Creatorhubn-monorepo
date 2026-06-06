/**
 * Static-source guard for DirectorPanel-integrasjonen i CreativeEditorView.
 * Beskytter mot at noen "lett" fjerner Director-toggle eller
 * contextProvider-wiring uten å oppdatere sjekkene.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function read(relative: string): string {
  return readFileSync(resolvePath(__dirname, relative), "utf8");
}

test.describe("DirectorPanel wired into CreativeEditorView", () => {
  const view = read("../src/components/CreativeEditorView.tsx");

  test("CreativeEditorView importerer DirectorPanel", () => {
    expect(view).toMatch(/import\s*\{\s*DirectorPanel\s*\}\s*from\s*"\.\/DirectorPanel"/);
  });

  test("CreativeEditorView har Director toggle-state", () => {
    expect(view).toMatch(/directorPanelOpen/);
    expect(view).toMatch(/setDirectorPanelOpen/);
  });

  test("CreativeEditorView har Director-toggle-knapp med data-testid", () => {
    expect(view).toMatch(/data-testid="ce-director-toggle"/);
  });

  test("CreativeEditorView mounter DirectorPanel når toggle aktiv", () => {
    expect(view).toMatch(/data-testid="ce-director-panel-mount"/);
    expect(view).toMatch(/<DirectorPanel[\s\S]*?contextProvider=\{directorContextProvider\}/);
  });

  test("DirectorPanel mountes med compact + showContextPreview", () => {
    expect(view).toMatch(/compact[\s\n]*showContextPreview/);
  });

  test("contextProvider inkluderer aktiv pick", () => {
    expect(view).toMatch(/directorContextProvider/);
    expect(view).toMatch(/Aktiv pick:/);
    expect(view).toMatch(/Total picks:/);
  });

  test("contextProvider inkluderer signals fra fokuspick", () => {
    expect(view).toMatch(/focusedPick\.signals/);
  });
});

test.describe("DirectorPanel-komponenten har riktige test-ids", () => {
  const panel = read("../src/components/DirectorPanel.tsx");

  test("Eksporterer DirectorPanel", () => {
    expect(panel).toMatch(/export function DirectorPanel/);
  });

  test("Bruker useDirectorLoop", () => {
    expect(panel).toMatch(/useDirectorLoop/);
  });

  test("Har data-testid markører for kritisk wiring", () => {
    expect(panel).toMatch(/data-testid="director-panel"/);
    expect(panel).toMatch(/data-testid="director-goal-input"/);
    expect(panel).toMatch(/data-testid="director-start"/);
  });

  test("Støtter compact prop", () => {
    expect(panel).toMatch(/compact[?:]/);
    expect(panel).toMatch(/compactStyles/);
  });

  test("Støtter contextProvider prop", () => {
    expect(panel).toMatch(/contextProvider[?:]/);
  });
});

test.describe("MultiAgentDirectorDialog er nå thin wrapper", () => {
  const dlg = read("../src/components/MultiAgentDirectorDialog.tsx");

  test("Importerer DirectorPanel (ikke duplisert loop)", () => {
    expect(dlg).toMatch(/import\s*\{\s*DirectorPanel\s*\}\s*from\s*"\.\/DirectorPanel"/);
  });

  test("Wrapper er liten — ikke ~500 linjer lenger", () => {
    const lines = dlg.split("\n").length;
    expect(lines).toBeLessThan(150);
  });

  test("Renderer <DirectorPanel /> inni modal", () => {
    expect(dlg).toMatch(/<DirectorPanel\s*\/>/);
  });

  test("Beholder eksisterende data-testid for App-shell modal", () => {
    expect(dlg).toMatch(/data-testid="multi-agent-director-dialog"/);
    expect(dlg).toMatch(/data-testid="mad-close"/);
  });
});

test.describe("useDirectorLoop pre-pender contextProvider-snapshot", () => {
  const hook = read("../src/lib/useDirectorLoop.ts");

  test("contextProvider-snapshot kalles én gang per Start", () => {
    expect(hook).toMatch(/contextProviderRef\.current\?\.\(\)/);
  });

  test("Snapshot prepends til goal med separator", () => {
    // PR R bytte til goalRef → currentGoal for stable callback-identitet.
    expect(hook).toMatch(/ctx\s*\?\s*`\$\{ctx\}\\n\\n---\\n\\n\$\{currentGoal\.trim\(\)\}`/);
  });

  test("Snapshot exposes via lastContextSnapshot for UI", () => {
    expect(hook).toMatch(/lastContextSnapshot/);
    expect(hook).toMatch(/setLastContextSnapshot/);
  });
});
