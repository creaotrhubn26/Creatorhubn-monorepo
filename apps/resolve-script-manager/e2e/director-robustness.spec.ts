/**
 * Robustness-guards for Director-embed-stacken. Statisk grep slik at vi
 * fanger drift uten å trenge live Photoshop/Resolve. Hver test peker på
 * konkret robustness-egenskap som var et identifisert gap pre-PR-R.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function read(rel: string): string {
  return readFileSync(resolvePath(__dirname, rel), "utf8");
}

test.describe("claudeProxyService støtter AbortSignal", () => {
  const svc = read("../src/services/claudeProxyService.ts");

  test("sendRaw opts har signal-felt", () => {
    expect(svc).toMatch(/signal\?:\s*AbortSignal/);
  });

  test("fetch får signal videresendt", () => {
    expect(svc).toMatch(/signal:\s*opts\.signal/);
  });
});

test.describe("useDirectorLoop avbryt + cleanup-livssyklus", () => {
  const hook = read("../src/lib/useDirectorLoop.ts");

  test("Lager AbortController per Start", () => {
    expect(hook).toMatch(/new AbortController/);
    expect(hook).toMatch(/abortControllerRef\.current\s*=\s*controller/);
  });

  test("Sender signal med claudeProxyService.sendRaw", () => {
    expect(hook).toMatch(/signal:\s*controller\.signal/);
  });

  test("Stop() aborter inflight fetch", () => {
    expect(hook).toMatch(/const stop = useCallback/);
    expect(hook).toMatch(/abortControllerRef\.current\?\.abort\(\)/);
  });

  test("Unmount cleanup setter mounted=false + aborter", () => {
    expect(hook).toMatch(/mountedRef\.current\s*=\s*false/);
    expect(hook).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*?abort\(\)/);
  });

  test("Loop sjekker mounted+stop mellom await-er", () => {
    const checks = hook.match(/stopRef\.current\s*\|\|\s*!mountedRef\.current/g) ?? [];
    expect(checks.length).toBeGreaterThanOrEqual(3);
  });

  test("AbortError håndteres som rolig avbrudd, ikke feil", () => {
    expect(hook).toMatch(/DOMException && err\.name === "AbortError"/);
    expect(hook).toMatch(/if \(!isAbort\)/);
  });

  test("contextProvider wrappet i try-catch (knust provider ≠ run-fail)", () => {
    expect(hook).toMatch(/try \{[\s\S]*?contextProviderRef\.current\?\.\(\)[\s\S]*?\} catch/);
  });

  test("Duplikat Start-klikk er no-op (runningRef-guard)", () => {
    expect(hook).toMatch(/if \(runningRef\.current\) return;/);
  });

  test("safeSet wrapper guarder setState mot unmount", () => {
    expect(hook).toMatch(/const safeSet = useCallback/);
    expect(hook).toMatch(/if \(mountedRef\.current\) setter/);
  });

  test("start-callback har stable deps (ingen goal i deps)", () => {
    // goal håndteres via goalRef. Hvis goal kommer tilbake i deps blir
    // start-identiteten ustabil og forårsaker re-renders i konsumenter.
    expect(hook).toMatch(/\}, \[systemPrompt, addStep, safeSet\]\);/);
  });
});

test.describe("DirectorPanel context-preview", () => {
  const panel = read("../src/components/DirectorPanel.tsx");

  test("Preview-effect avhenger IKKE av loop.goal (ingen churn per tegn)", () => {
    expect(panel).toMatch(/\[showContextPreview, contextProvider, loop\.completed\]/);
    expect(panel).not.toMatch(/\[showContextPreview, contextProvider, loop\.goal/);
  });

  test("Preview-effect har try-catch så provider-feil ikke krasjer panel", () => {
    expect(panel).toMatch(/try \{[\s\S]*?setContextPreview\(contextProvider\(\)[\s\S]*?\} catch/);
  });
});

test.describe("CreativeEditorView wrapper-robustness", () => {
  const view = read("../src/components/CreativeEditorView.tsx");

  test("ErrorBoundary importert + wrapper rundt DirectorPanel", () => {
    expect(view).toMatch(/import \{ ErrorBoundary \} from "\.\/ErrorBoundary"/);
    expect(view).toMatch(
      /<ErrorBoundary label="Director Panel">[\s\S]*?<DirectorPanel[\s\S]*?<\/ErrorBoundary>/,
    );
  });

  test("directorPanelOpen persistes til localStorage", () => {
    expect(view).toMatch(/DIRECTOR_PANEL_KEY\s*=\s*"ce\.directorPanelOpen"/);
    expect(view).toMatch(/window\.localStorage\.setItem\(DIRECTOR_PANEL_KEY/);
    expect(view).toMatch(/window\.localStorage\.getItem\(DIRECTOR_PANEL_KEY/);
  });

  test("localStorage-tilgang try-catched (private mode safe)", () => {
    expect(view).toMatch(
      /try\s*\{\s*window\.localStorage\.setItem\(DIRECTOR_PANEL_KEY/,
    );
  });

  test("Default = false hvis localStorage ikke kan leses", () => {
    expect(view).toMatch(
      /try\s*\{\s*return window\.localStorage\.getItem\(DIRECTOR_PANEL_KEY\) === "1";\s*\} catch \{\s*return false;/,
    );
  });
});

test.describe("ErrorBoundary-komponenten", () => {
  const eb = read("../src/components/ErrorBoundary.tsx");

  test("Eksporterer som class-component", () => {
    expect(eb).toMatch(/export class ErrorBoundary extends Component/);
  });

  test("getDerivedStateFromError + componentDidCatch implementert", () => {
    expect(eb).toMatch(/static getDerivedStateFromError/);
    expect(eb).toMatch(/componentDidCatch/);
  });

  test("Logger til console.error med label-kontekst", () => {
    expect(eb).toMatch(/console\.error/);
    expect(eb).toMatch(/this\.props\.label/);
  });

  test("Har retry-knapp i default fallback", () => {
    expect(eb).toMatch(/data-testid="error-boundary-fallback"/);
    expect(eb).toMatch(/Prøv på nytt/);
  });

  test("Støtter custom fallback-render", () => {
    expect(eb).toMatch(/fallback\?:\s*\(err: Error, reset: \(\) => void\) => ReactNode/);
  });
});
