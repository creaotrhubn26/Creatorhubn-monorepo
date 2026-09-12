import { describe, expect, it } from "vitest";

import {
  buildInstallInstructions,
  detectTechStack,
  stackFromKey,
} from "./tech-stack-detect.js";

describe("detectTechStack (evidensbasert fingeravtrykk)", () => {
  it("Lovable gjenkjennes på gptengineer-scriptet og bærer evidensen", () => {
    const stack = detectTechStack(`<html><head><script src="https://cdn.gpteng.co/gptengineer.js"></script></head><div id="root"></div></html>`);
    expect(stack.key).toBe("lovable");
    expect(stack.category).toBe("ai_builder");
    expect(stack.evidence[0]).toContain("gptengineer");
  });

  it("Webflow, WordPress og Next.js på sine signaturer; Wix via headere", () => {
    expect(detectTechStack(`<html data-wf-domain="x.webflow.io">`).key).toBe("webflow");
    expect(detectTechStack(`<link href="/wp-content/themes/x/style.css">`).key).toBe("wordpress");
    expect(detectTechStack(`<script id="__NEXT_DATA__">{}</script>`).key).toBe("nextjs");
    expect(detectTechStack("<html></html>", { "x-wix-request-id": "abc" }).key).toBe("wix");
  });

  it("uten treff: ærlig unknown med tom evidens", () => {
    const stack = detectTechStack("<html><body>Hei</body></html>");
    expect(stack).toMatchObject({ key: "unknown", category: "unknown", evidence: [] });
  });

  it("presedens: Lovable-app bygget på Vite matcher Lovable, ikke vite_spa", () => {
    const html = `<script src="https://cdn.gpteng.co/gptengineer.js"></script><script src="/assets/index-abc123.js"></script><div id="root"></div>`;
    expect(detectTechStack(html).key).toBe("lovable");
  });
});

describe("buildInstallInstructions (kanal følger plattform)", () => {
  const SNIPPET = "<script>/* consent-gatet bootstrap */</script>";

  it("AI-bygger → ferdig builder-prompt med snippeten innbakt", () => {
    const instr = buildInstallInstructions(stackFromKey("lovable"), { snippet: SNIPPET });
    expect(instr.channel).toBe("builder_prompt");
    expect(instr.builderPrompt).toContain(SNIPPET);
    expect(instr.builderPrompt).toContain("Ikke endre noe av innholdet");
    expect(instr.builderPrompt).toContain("window.applyConsent");
  });

  it("site-bygger → klikk-sti til Custom code, ingen prompt", () => {
    const instr = buildInstallInstructions(stackFromKey("squarespace"), { snippet: SNIPPET });
    expect(instr.channel).toBe("settings_ui");
    expect(instr.builderPrompt).toBeNull();
    expect(instr.steps.some((s) => s.includes("Code injection"))).toBe(true);
  });

  it("WordPress → plugin/hook-instruks; Next.js → layout/_document; alle ender i audit-kvittering", () => {
    const wp = buildInstallInstructions(stackFromKey("wordpress"), { snippet: SNIPPET });
    expect(wp.steps.some((s) => s.includes("insert headers"))).toBe(true);
    const next = buildInstallInstructions(stackFromKey("nextjs"), { snippet: SNIPPET });
    expect(next.steps[0]).toContain("layout");
    for (const instr of [wp, next]) {
      expect(instr.steps.some((s) => s.includes("site-auditen"))).toBe(true);
    }
  });

  it("GSC-metatag kan følge med i samme leveranse", () => {
    const instr = buildInstallInstructions(stackFromKey("lovable"), {
      snippet: SNIPPET,
      gscMetaTag: '<meta name="google-site-verification" content="abc" />',
    });
    expect(instr.builderPrompt).toContain("google-site-verification");
    expect(instr.builderPrompt).toContain("metatag og script-blokk");
  });
});
