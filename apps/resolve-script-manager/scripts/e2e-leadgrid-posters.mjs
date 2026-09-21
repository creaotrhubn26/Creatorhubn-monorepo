#!/usr/bin/env node
/**
 * E2E: load the generated Leadgrid poster projects into Mockup Studio and prove
 * they actually render — not just that the JSON matches the schema.
 *
 *   node scripts/e2e-leadgrid-posters.mjs --dir <mappe-med-prosjekt-json>
 *
 * Per project it asserts: the doc survives setDocument() round-trip, every text
 * and image slot is still there, no image slot resolved to a broken source, the
 * canvas painted something, and the browser logged no errors. Screenshots land
 * in docs/role-room/e2e-evidence/leadgrid-posters/.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(appDir, "../..");
const port = Number(process.env.MOCKUP_E2E_PORT || 5191);
const baseUrl = `http://127.0.0.1:${port}`;

const dirArg = process.argv.indexOf("--dir");
const projectDir = dirArg > -1 ? path.resolve(process.argv[dirArg + 1]) : null;
if (!projectDir) {
  console.error("bruk: node scripts/e2e-leadgrid-posters.mjs --dir <mappe>");
  process.exit(2);
}
const evidenceDir = path.join(repoDir, "docs/role-room/e2e-evidence/leadgrid-posters");

// The built app is a static SPA, so it is served with python's http.server
// rather than `vite preview` — one less moving part, and it starts reliably
// in CI-ish sandboxes where vite preview sometimes never binds the port.
const server = spawn(
  "python3",
  ["-m", "http.server", String(port), "--bind", "127.0.0.1"],
  { cwd: path.join(appDir, "dist"), stdio: ["ignore", "ignore", "pipe"] },
);
let serverError = "";
server.stderr.on("data", (chunk) => { serverError += String(chunk).slice(-2000); });

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* still booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite startet ikke: ${serverError}`);
}

let browser;
const results = [];
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });

  const files = (await readdir(projectDir))
    .filter((f) => f.startsWith("leadgrid-") && f.endsWith(".json")
                   && !f.includes("alle-prosjekter"))
    .sort();
  if (!files.length) throw new Error(`fant ingen prosjekt-json i ${projectDir}`);

  // This sandbox ships a pinned Chromium that may not match the browser build
  // @playwright/test wants, so point at the installed binary instead of
  // downloading one. CHROMIUM_PATH overrides it elsewhere.
  const chromiumPath = process.env.CHROMIUM_PATH
    || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    executablePath: existsSync(chromiumPath) ? chromiumPath : undefined,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1,
  });
  await page.addInitScript(() => {
    // boots App + MockupStudioShell straight into the editor view
    window.__BROWSER_TEST__ = true;
    localStorage.setItem("trrpa.firstRunComplete", "true");
    localStorage.setItem("trrpa.photoshopTourCompleted", "true");
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__mockupStore), null, { timeout: 30_000 });

  // The app tries to reach the Creatorhub backend on boot; offline that raises a
  // login dialog over the canvas. Dismiss it so the evidence shows the document.
  const dismiss = page.getByRole("button", { name: "Lukk", exact: true });
  if (await dismiss.count()) await dismiss.first().click().catch(() => {});

  for (const file of files) {
    const doc = JSON.parse(await readFile(path.join(projectDir, file), "utf8"));
    const errorsBefore = pageErrors.length;

    const verdict = await page.evaluate(async (incoming) => {
      const store = window.__mockupStore;
      store.getState().setDocument(incoming);
      await new Promise((r) => setTimeout(r, 400));
      const doc = store.getState().doc;

      // every image slot must resolve to real pixels
      const probes = await Promise.all((doc.images ?? []).map((slot) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ id: slot.id, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ id: slot.id, w: 0, h: 0 });
        img.src = slot.image;
      })));

      // the canvas must have painted something other than a flat fill
      const canvas = document.querySelector("canvas");
      let painted = 0;
      if (canvas && canvas.width && canvas.height) {
        const ctx = canvas.getContext("2d");
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const seen = new Set();
        for (let i = 0; i < data.length; i += 4 * 997) {
          seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
          if (seen.size > 12) break;
        }
        painted = seen.size;
      }

      return {
        id: doc.id,
        name: doc.name,
        canvas: `${doc.canvas.w}x${doc.canvas.h}`,
        texts: doc.texts.length,
        images: (doc.images ?? []).length,
        emptyTexts: doc.texts.filter((t) => !t.text || !t.text.trim()).map((t) => t.id),
        offCanvas: [...doc.texts, ...(doc.images ?? [])]
          .filter((s) => s.x < 0 || s.y < 0 || s.x > doc.canvas.w || s.y > doc.canvas.h)
          .map((s) => s.id),
        brokenImages: probes.filter((p) => !p.w || !p.h).map((p) => p.id),
        distinctColours: painted,
        hasCanvas: Boolean(canvas),
      };
    }, doc);

    const shot = path.join(evidenceDir, `${doc.id}.png`);
    const stage = page.locator("canvas").first();
    await stage.screenshot({ path: shot });

    const problems = [];
    if (verdict.id !== doc.id) problems.push("doc-id endret seg i storen");
    if (verdict.texts !== doc.texts.length) problems.push("tekstlag forsvant");
    if (verdict.images !== (doc.images ?? []).length) problems.push("bildelag forsvant");
    if (verdict.emptyTexts.length) problems.push(`tomme tekstlag: ${verdict.emptyTexts}`);
    if (verdict.offCanvas.length) problems.push(`lag utenfor lerretet: ${verdict.offCanvas}`);
    if (verdict.brokenImages.length) problems.push(`bilder lastet ikke: ${verdict.brokenImages}`);
    if (!verdict.hasCanvas) problems.push("fant ingen canvas");
    if (verdict.distinctColours < 4) problems.push("lerretet ser tomt ut");
    const fresh = pageErrors.slice(errorsBefore);
    if (fresh.length) problems.push(`browser-feil: ${fresh.join(" | ")}`);

    results.push({ ...verdict, file, screenshot: path.relative(repoDir, shot), problems });
    console.log(`${problems.length ? "FEIL " : "ok   "} ${doc.id}  ` +
      `${verdict.canvas}  ${verdict.texts} tekst / ${verdict.images} bilde` +
      (problems.length ? `\n       ${problems.join("\n       ")}` : ""));
  }

  const failed = results.filter((r) => r.problems.length);
  await writeFile(path.join(evidenceDir, "resultat.json"),
    JSON.stringify({ ranAt: new Date().toISOString(), total: results.length,
                     failed: failed.length, results }, null, 2), "utf8");
  console.log(`\n${results.length - failed.length}/${results.length} prosjekter rendret uten feil`);
  console.log(`bevis: ${path.relative(repoDir, evidenceDir)}`);
  if (failed.length) process.exitCode = 1;
} catch (error) {
  console.error("E2E feilet:", error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
