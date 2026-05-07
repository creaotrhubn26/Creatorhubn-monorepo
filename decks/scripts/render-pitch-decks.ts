/**
 * render-pitch-decks.ts
 *
 * For each persona deck, builds an HTML document that mimics the
 * reference deck styling (dark + purple, slide-number prefix, hero
 * imagery), embeds the captured screenshots as base64 data-URIs, and
 * uses Playwright to print a 14-page PDF (one slide per page).
 *
 * Run:
 *   npx tsx decks/scripts/render-pitch-decks.ts
 */

import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  ALL_DECKS,
  type DeckSlide,
  type PersonaDeck,
} from "../content/personas.js";

const REPO_ROOT = process.cwd();
const OUT_DIR = join(REPO_ROOT, "decks", "output");

// ─────────────────────────────────────────────────────────
// Inline CSS — mimics reference deck (dark + purple, slide prefix).
// ─────────────────────────────────────────────────────────

const CSS = `
:root {
  --bg: #0a0617;
  --bg-card: #120a26;
  --bg-card-2: #1a1133;
  --text: #e2e8f0;
  --text-dim: rgba(226, 232, 240, 0.65);
  --accent: #a855f7;
  --accent-bright: #c084fc;
  --accent-dim: rgba(168, 85, 247, 0.18);
  --border: rgba(168, 85, 247, 0.22);
  --green: #34d399;
  --red: #f87171;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

@page { size: 1600px 900px; margin: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

.slide {
  width: 1600px;
  height: 900px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.10), transparent 60%),
    radial-gradient(ellipse at bottom left, rgba(168, 85, 247, 0.06), transparent 60%),
    var(--bg);
  page-break-after: always;
  padding: 64px 72px;
  display: flex;
  flex-direction: column;
}
.slide:last-child { page-break-after: auto; }

.slide-number {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  font-weight: 600;
}
.slide-number .num { color: var(--accent-bright); margin-right: 14px; }

.brand-mark {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}
.brand-mark .logo {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--accent), var(--accent-bright));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.5px;
  box-shadow: 0 0 28px rgba(168, 85, 247, 0.45);
}
.brand-mark .name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text);
  text-transform: uppercase;
}

h1 { font-size: 64px; line-height: 1.1; font-weight: 700; letter-spacing: -1.5px; }
h1 .accent { color: var(--accent-bright); }
h2 { font-size: 44px; line-height: 1.15; font-weight: 700; letter-spacing: -0.8px; }
.body-text { font-size: 18px; color: var(--text-dim); line-height: 1.55; max-width: 780px; }

.bullet-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
.bullet-list li { font-size: 17px; display: flex; gap: 14px; align-items: flex-start; }
.bullet-list .icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--accent-bright);
  font-weight: 700;
  line-height: 1.4;
  min-width: 18px;
}
.bullet-list .icon.x { color: var(--red); }
.bullet-list .label { color: var(--text); font-weight: 500; }
.bullet-list .sub { display: block; color: var(--text-dim); font-size: 14px; margin-top: 2px; font-weight: 400; }

/* COVER SLIDE */
.cover {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  height: 100%;
}
.cover .left { display: flex; flex-direction: column; justify-content: space-between; }
.cover .right {
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(168, 85, 247, 0.25);
  border: 1px solid var(--border);
  background: var(--bg-card);
}
.cover .right img { width: 100%; height: 100%; object-fit: cover; }
.cover .url { color: var(--accent-bright); font-size: 14px; }

/* SCREENSHOT SLIDE — split layout */
.split-layout {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 48px;
  flex: 1;
  margin-top: 40px;
  align-items: stretch;
}
.split-layout .copy { display: flex; flex-direction: column; gap: 22px; justify-content: center; }
.split-layout .visual {
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.split-layout .visual img { width: 100%; height: 100%; object-fit: cover; }
.split-layout .visual .caption {
  position: absolute;
  bottom: 14px;
  left: 16px;
  background: rgba(10, 6, 23, 0.85);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-dim);
  border: 1px solid var(--border);
}

/* FEATURE GRID */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 32px;
}
.feature-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(168, 85, 247, 0.06), transparent);
}
.feature-card .icon-large {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--accent-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 14px;
}
.feature-card .feature-label { font-size: 17px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.feature-card .feature-sub { font-size: 13px; color: var(--text-dim); line-height: 1.45; }

/* COMPETITION TABLE */
.competition-table {
  width: 100%;
  margin-top: 32px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 16px;
}
.competition-table thead th {
  text-align: left;
  padding: 14px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-right: none;
  color: var(--accent-bright);
  font-weight: 700;
}
.competition-table thead th:first-child { border-radius: 12px 0 0 0; }
.competition-table thead th:last-child { border-radius: 0 12px 0 0; border-right: 1px solid var(--border); }
.competition-table tbody td {
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-top: none;
  border-right: none;
  text-align: left;
}
.competition-table tbody td:last-child { border-right: 1px solid var(--border); }
.competition-table tbody tr.us td {
  background: rgba(168, 85, 247, 0.10);
  color: var(--text);
  font-weight: 600;
}
.cell-yes { color: var(--green); font-size: 22px; }
.cell-no { color: var(--red); font-size: 22px; }
.cell-partial { color: var(--accent-bright); font-size: 22px; }

/* MARKET — donut */
.market-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  margin-top: 40px;
  flex: 1;
}
.donut-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut {
  width: 320px;
  height: 320px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut::before {
  content: "";
  position: absolute;
  inset: 60px;
  border-radius: 50%;
  background: var(--bg);
}
.donut .center {
  position: relative;
  z-index: 1;
  text-align: center;
}
.donut .center .value { font-size: 38px; font-weight: 700; color: var(--accent-bright); }
.donut .center .label { font-size: 11px; color: var(--text-dim); margin-top: 4px; max-width: 140px; }
.market-segments { display: flex; flex-direction: column; gap: 12px; align-self: center; font-size: 15px; }
.market-segments .seg { display: flex; align-items: center; gap: 12px; color: var(--text); }
.market-segments .swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.market-segments .pct { color: var(--text-dim); margin-left: auto; }

/* METRICS */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-top: 28px;
}
.metric-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px 22px;
  background: var(--bg-card);
}
.metric-card .value { font-size: 44px; font-weight: 700; color: var(--accent-bright); letter-spacing: -1px; }
.metric-card .label { font-size: 13px; color: var(--text-dim); margin-top: 6px; }

/* ASK */
.ask-layout { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 16px; flex: 1; }
.ask-amount { font-size: 120px; font-weight: 800; color: var(--accent-bright); letter-spacing: -3px; line-height: 1; }
.ask-bullets { margin-top: 32px; max-width: 700px; }

/* TWO-COLUMN BODY */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  flex: 1;
  margin-top: 32px;
}

/* HEADER ROW (slide title + number) */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}

.section-line {
  width: 56px;
  height: 4px;
  background: var(--accent);
  border-radius: 2px;
  margin-top: 16px;
}
`;

// ─────────────────────────────────────────────────────────
// Image embedding — convert paths to base64 data URLs
// ─────────────────────────────────────────────────────────

async function embedImage(relativePath: string): Promise<string> {
  const fullPath = join(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    console.warn(`  ⚠ missing image: ${relativePath}`);
    return "";
  }
  const buf = await readFile(fullPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ─────────────────────────────────────────────────────────
// Slide HTML builders
// ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderBullets(bullets?: DeckSlide["bullets"], iconClass = ""): string {
  if (!bullets) return "";
  return `
    <ul class="bullet-list">
      ${bullets
        .map(
          (b) => `
        <li>
          <span class="icon ${iconClass}">${b.icon ? escapeHtml(b.icon) : "•"}</span>
          <div>
            <span class="label">${escapeHtml(b.label)}</span>
            ${b.sub ? `<span class="sub">${escapeHtml(b.sub)}</span>` : ""}
          </div>
        </li>
      `,
        )
        .join("")}
    </ul>`;
}

function renderHeader(slide: DeckSlide): string {
  return `
    <div class="header-row">
      <div class="slide-number"><span class="num">${slide.number}</span>${escapeHtml(slide.label)}</div>
    </div>`;
}

function renderBrandMark(persona: PersonaDeck): string {
  return `
    <div class="brand-mark">
      <div class="logo">R</div>
      <div class="name">The Role Room</div>
    </div>
    <div class="body-text" style="font-size:13px;color:var(--text-dim);margin-top:-4px;">
      ${escapeHtml(persona.audience)}
    </div>`;
}

async function renderSlide(slide: DeckSlide, persona: PersonaDeck): Promise<string> {
  const screenshotData = slide.screenshot ? await embedImage(slide.screenshot) : "";

  switch (slide.kind) {
    case "cover": {
      return `
        <section class="slide">
          ${renderBrandMark(persona)}
          <div class="cover" style="margin-top:48px;">
            <div class="left">
              <div>
                <h1>${escapeHtml(slide.title.split(" ").slice(0, -2).join(" "))}
                  <span class="accent">${escapeHtml(slide.title.split(" ").slice(-2).join(" "))}</span>
                </h1>
                <div class="section-line"></div>
                <p class="body-text" style="margin-top:32px;">${escapeHtml(slide.body ?? "")}</p>
              </div>
              <div class="url">therole.room</div>
            </div>
            <div class="right">
              ${screenshotData ? `<img src="${screenshotData}" alt="" />` : ""}
            </div>
          </div>
        </section>`;
    }

    case "screenshot": {
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="split-layout">
            <div class="copy">
              ${renderBullets(slide.bullets)}
            </div>
            <div class="visual">
              ${screenshotData ? `<img src="${screenshotData}" alt="" />` : ""}
              ${
                slide.screenshotCaption
                  ? `<div class="caption">${escapeHtml(slide.screenshotCaption)}</div>`
                  : ""
              }
            </div>
          </div>
        </section>`;
    }

    case "feature-grid": {
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="feature-grid">
            ${(slide.bullets ?? [])
              .map(
                (b) => `
              <div class="feature-card">
                <div class="icon-large">${b.icon ?? "•"}</div>
                <div class="feature-label">${escapeHtml(b.label)}</div>
                ${b.sub ? `<div class="feature-sub">${escapeHtml(b.sub)}</div>` : ""}
              </div>`,
              )
              .join("")}
          </div>
        </section>`;
    }

    case "problem":
    case "solution":
    case "vision":
    case "business-model":
    case "team": {
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="section-line"></div>
          <div style="margin-top:32px;display:flex;flex-direction:column;gap:24px;flex:1;">
            ${slide.body ? `<p class="body-text">${escapeHtml(slide.body)}</p>` : ""}
            ${renderBullets(slide.bullets, slide.kind === "problem" ? "x" : "")}
          </div>
        </section>`;
    }

    case "market": {
      const segs = slide.marketDonut?.segments ?? [];
      const colors = ["#a855f7", "#7c3aed", "#5b21b6", "#9333ea", "#c084fc", "#6d28d9"];
      let cum = 0;
      const gradientStops = segs
        .map((s, i) => {
          const start = cum;
          cum += s.pct;
          return `${colors[i % colors.length]} ${start}% ${cum}%`;
        })
        .join(", ");
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="market-layout">
            <div class="donut-wrap">
              <div class="donut" style="background: conic-gradient(${gradientStops});">
                <div class="center">
                  <div class="value">${escapeHtml(slide.marketDonut?.center ?? "")}</div>
                  <div class="label">${escapeHtml(slide.marketDonut?.label ?? "")}</div>
                </div>
              </div>
            </div>
            <div class="market-segments">
              ${segs
                .map(
                  (s, i) => `
                <div class="seg">
                  <span class="swatch" style="background:${colors[i % colors.length]};"></span>
                  ${escapeHtml(s.name)}
                  <span class="pct">${s.pct}%</span>
                </div>`,
                )
                .join("")}
              <div style="margin-top:24px;">${renderBullets(slide.bullets)}</div>
            </div>
          </div>
        </section>`;
    }

    case "competition": {
      const cellGlyph = (c: "yes" | "no" | "partial") =>
        c === "yes"
          ? '<span class="cell-yes">✓</span>'
          : c === "no"
          ? '<span class="cell-no">✕</span>'
          : '<span class="cell-partial">◐</span>';
      const rows = (slide.competitionRows ?? [])
        .map((r, i, arr) => {
          const isUs = i === arr.length - 1;
          return `
            <tr${isUs ? ' class="us"' : ""}>
              <td>${escapeHtml(r.name)}</td>
              ${r.cells.map((c) => `<td>${cellGlyph(c)}</td>`).join("")}
            </tr>`;
        })
        .join("");
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          ${slide.body ? `<p class="body-text" style="margin-top:14px;">${escapeHtml(slide.body)}</p>` : ""}
          <table class="competition-table">
            <thead>
              <tr>${(slide.competitionColumns ?? []).map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    }

    case "traction": {
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="metric-grid">
            ${(slide.metrics ?? [])
              .map(
                (m) => `
              <div class="metric-card">
                <div class="value">${escapeHtml(m.value)}</div>
                <div class="label">${escapeHtml(m.label)}</div>
              </div>`,
              )
              .join("")}
          </div>
          <div style="margin-top:36px;">${renderBullets(slide.bullets)}</div>
        </section>`;
    }

    case "ask":
    case "cta": {
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <div class="ask-layout">
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div class="body-text" style="font-size:24px;color:var(--text);">${escapeHtml(slide.title)}</div>
              <div class="ask-amount">${escapeHtml(slide.body ?? "")}</div>
            </div>
            <div class="ask-bullets">${renderBullets(slide.bullets)}</div>
          </div>
        </section>`;
    }

    default:
      return `
        <section class="slide">
          ${renderHeader(slide)}
          <h2>${escapeHtml(slide.title)}</h2>
          <p class="body-text" style="margin-top:20px;">${escapeHtml(slide.body ?? "")}</p>
          ${renderBullets(slide.bullets)}
        </section>`;
  }
}

async function buildHtml(persona: PersonaDeck): Promise<string> {
  const slidesHtml = (
    await Promise.all(persona.slides.map((s) => renderSlide(s, persona)))
  ).join("\n");
  return `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8" />
  <title>The Role Room — ${persona.audience}</title>
  <style>${CSS}</style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  for (const persona of ALL_DECKS) {
    console.log(`\nBuilding ${persona.persona} deck (${persona.slides.length} slides)`);
    const html = await buildHtml(persona);
    const htmlPath = join(OUT_DIR, `role-room-${persona.persona}.html`);
    await writeFile(htmlPath, html);

    // Render PDF — one slide per page at 1600x900
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800); // let fonts settle
    const pdfPath = join(OUT_DIR, `role-room-${persona.persona}.pdf`);
    await page.pdf({
      path: pdfPath,
      width: "1600px",
      height: "900px",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    await context.close();

    console.log(`  → ${htmlPath}`);
    console.log(`  → ${pdfPath}`);
  }
  await browser.close();

  console.log("\nDone. 3 decks rendered in", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
