#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(appDir, "../..");
const port = Number(process.env.MOCKUP_E2E_PORT || 5188);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = path.join(repoDir, "docs/role-room/e2e-evidence");

const server = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["exec", "vite", "--", "preview", "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: appDir, stdio: ["ignore", "ignore", "pipe"] },
);
let serverError = "";
server.stderr.on("data", (chunk) => { serverError += String(chunk).slice(-2_000); });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite startet ikke: ${serverError}`);
}

function asDataUrl(bytes) {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

let browser;
try {
  await waitForServer();
  const [femaleBytes, maleBytes] = await Promise.all([
    readFile(path.join(repoDir, "docs/role-room/e2e-fixtures/medside-cinematic-clinician-female-v1.png")),
    readFile(path.join(repoDir, "docs/role-room/e2e-fixtures/medside-cinematic-clinician-male-v1.png")),
  ]);
  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  const page = await browser.newPage({ viewport: { width: 1480, height: 1040 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    localStorage.setItem("trrpa.firstRunComplete", "true");
    localStorage.setItem("trrpa.photoshopTourCompleted", "true");
    localStorage.setItem("trrpa.settings", JSON.stringify({
      RR_BEARER_TOKEN: "e2e-ui-only",
      RR_POST_AGENT_BASE_URL: "http://127.0.0.1:9/api/post-agent",
    }));
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/?e2e=figure-eight`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__mockupStore));
  await page.evaluate(({ female, male }) => {
    const store = window.__mockupStore;
    const current = store.getState().doc;
    const qa = (score) => ({
      status: "passed", score, checkedAt: new Date().toISOString(),
      pixel: { width: 1024, height: 1536, transparentRatio: .46, visibleRatio: .51, brandPixelRatio: .08, touchesEdge: false, passed: true, checks: [] },
      semantic: { score, summary: "Anatomi, hender, identitet og brandharmoni bestått.", model: "gpt-5-mini", checks: [] },
      checks: ["resolution", "alpha", "silhouette", "safe-crop", "brand-colour", "anatomy", "hands", "symmetry", "collisions", "identity-continuity"].map((id) => ({ id, passed: true, score, detail: `${id} bestått` })),
    });
    const variantFemale = { id: "figure-female", label: "Presenterer · varm", kind: "pose", image: female, assetHash: "a".repeat(64), poseId: "presenting", expressionId: "warm", generatedAt: "2026-09-06T00:00:00.000Z", providerMode: "reference-edit", qa: qa(96) };
    const variantMale = { id: "figure-male", label: "Lytter · rolig", kind: "pose", image: male, assetHash: "b".repeat(64), poseId: "listening", expressionId: "calm", generatedAt: "2026-09-06T00:01:00.000Z", providerMode: "reference-edit", qa: qa(94) };
    const image = {
      id: "e2e-cinematic-clinician", image: female, x: 550, y: 120, w: 430, h: 820,
      radius: 0, fit: "contain", rotation: 0, shadow: false,
      illustration: "person-laptop", altText: "Representativ MedSide-kliniker",
      personStyle: { presentation: "female", ageRange: "adult", faceShape: "balanced", skin: "#D9A17D", hair: "#352923", hairStyle: "kort", shirt: "#102A43", accent: "#2CB1A6", outfit: "legefrakk", accessory: "stetoskop", scenario: "presenter", fidelity: "cinematic" },
      mediaProvenance: { source: "generated", disclosure: "representative-concept-illustration", consistencyKey: "medside-clinician-v1", model: "gpt-image-2", assetHash: variantFemale.assetHash },
      sprite: { frames: [female, male], fps: 1, interpolation: "crossfade", labels: ["Presenterer", "Lytter"], packageId: "medside-sprite-v1", layerManifest: ["contact-shadow", "legs-body", "left-arm-hand", "right-arm-hand", "head-face", "eyes-mouth", "hair", "prop"].map((id, z) => ({ id, label: id, z: z * 10 })) },
      figureGeneration: {
        qualityTarget: "cinematic-feature-animation", renderMode: "generated-raster", presentation: "female", status: "generated", provider: "gpt-image-2", model: "gpt-image-2", providerMode: "reference-edit", prompt: "MedSide clinician", negativePrompt: "malformed hands", seed: 220491, consistencyKey: "medside-clinician-v1", fallback: "cinematic-3d-canvas-v1", poseId: "presenting", expressionId: "warm", assetHash: variantFemale.assetHash,
        appearance: { ageRange: "adult", skinTone: "#D9A17D", hairColor: "#352923", hairStyle: "short", faceShape: "balanced" },
        compositing: { contactShadow: .72, rimLight: .36, ambientMatch: .28, depthBlur: 0, perspective: 0, groundOffset: .93 },
        variants: [variantFemale, variantMale], visualQa: variantFemale.qa,
        characterMaster: { id: "master-medside", consistencyKey: "medside-clinician-v1", approvedView: "three-quarter", views: { front: { ...variantFemale, id: "master-front", label: "Master · Front", kind: "master-view", view: "front" }, "three-quarter": { ...variantFemale, id: "master-three-quarter", label: "Master · Tre kvart", kind: "master-view", view: "three-quarter" }, profile: { ...variantMale, id: "master-profile", label: "Master · Profil", kind: "master-view", view: "profile" } }, locks: { face: true, hair: true, outfit: true, palette: true }, createdAt: "2026-09-06T00:00:00.000Z" },
      },
    };
    store.getState().setDocument({ ...current, id: "e2e-figure-eight", name: "MedSide · high-end figurkontroll", canvas: { ...current.canvas, w: 1080, h: 1080, background: "light", accent: "#2CB1A6", accent2: "#102A43" }, devices: [], texts: [], images: [image] });
    store.getState().select({ kind: "image", id: image.id });
  }, { female: asDataUrl(femaleBytes), male: asDataUrl(maleBytes) });

  const requiredSections = [
    "figure-pose-expression-library", "figure-motion-presets",
    "figure-character-master", "figure-sprite-package",
    "figure-compositing-controls", "figure-variant-history", "figure-visual-qa",
  ];
  for (const testId of requiredSections) {
    if (!(await page.getByTestId(testId).isVisible())) throw new Error(`${testId} er ikke synlig.`);
  }

  await page.screenshot({ path: path.join(evidenceDir, "06-medside-high-end-figure-studio.png"), fullPage: true });
  await page.getByTestId("figure-pose-expression-library").getByRole("button", { name: "Peker", exact: true }).click();
  await page.getByTestId("figure-pose-expression-library").getByRole("button", { name: "Fokusert", exact: true }).click();
  await page.getByTestId("figure-motion-presets").getByRole("button", { name: "Vennlig vink", exact: true }).click();
  const compositor = page.getByTestId("figure-compositing-controls");
  const rimSlider = compositor.locator('input[type="range"]').nth(1);
  await rimSlider.fill("0.64");

  const history = page.getByTestId("figure-variant-history");
  const compareBoxes = history.getByRole("checkbox");
  await compareBoxes.nth(0).check();
  await compareBoxes.nth(1).check();
  if (!(await page.getByTestId("figure-variant-comparison").isVisible())) {
    throw new Error("Side-ved-side-sammenligning ble ikke synlig.");
  }

  const stateEvidence = await page.evaluate(() => {
    const state = window.__mockupStore.getState();
    const figure = state.doc.images.find((item) => item.id === "e2e-cinematic-clinician");
    return {
      poseId: figure.figureGeneration.poseId,
      expressionId: figure.figureGeneration.expressionId,
      rimLight: figure.figureGeneration.compositing.rimLight,
      motionChannels: Object.keys(figure.kf || {}),
      layerCount: figure.sprite?.layerManifest?.length || 0,
      variantCount: figure.figureGeneration.variants.length,
      qaStatus: figure.figureGeneration.visualQa.status,
    };
  });
  if (stateEvidence.poseId !== "pointing" || stateEvidence.expressionId !== "focused") throw new Error("Pose-/uttrykksdata ble ikke lagret.");
  if (stateEvidence.rimLight !== .64) throw new Error("Compositing-verdien ble ikke lagret.");
  if (!stateEvidence.motionChannels.includes("armSwing")) throw new Error("Motion-presetet opprettet ikke keyframes.");
  if (stateEvidence.layerCount !== 8 || stateEvidence.variantCount !== 2 || stateEvidence.qaStatus !== "passed") throw new Error("Figurpakken mangler lag, varianter eller QA.");
  if ((await page.getByText("IK venstre hånd · X", { exact: true }).count()) < 1) throw new Error("Manuelle IK-kontroller mangler.");

  await page.getByTestId("figure-variant-comparison").screenshot({ path: path.join(evidenceDir, "07-medside-figure-variant-comparison.png") });
  await page.getByTestId("figure-visual-qa").screenshot({ path: path.join(evidenceDir, "08-medside-figure-visual-qa.png") });
  if (pageErrors.length) throw new Error(`Browser-feil: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, stateEvidence, screenshots: 3 }));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
