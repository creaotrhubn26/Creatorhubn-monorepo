// fusionDemoExport — bro mellom et Demo Studio-prosjekt og Resolve/Fusion-
// scriptet `build_fusion_demo`. Mapper scener → kamerabevegelser + UI-effekter,
// persisterer scene-media til disk, og henter inn branding/logo, slik at appen
// kan bygge en KOMPLETT timeline med Fusion motion-graphics i Resolve.

import { invoke } from "@tauri-apps/api/core";
import { executeScript } from "../../api";
import type { RunSummary } from "../../types";
import { pickShot, type DemoProject, type DemoScene } from "./demoStudioModel";

// ── AI lærer: persister brukerens preferanser/tilbakemeldinger per nettsted ──
function learnKey(url: string): string {
  let host = "default";
  try { host = new URL(url).host.replace(/^www\./, ""); } catch { /* */ }
  return `trrpa.fusion_learn.${host}`;
}
export function getFusionLearnings(url: string): string[] {
  try {
    const raw = localStorage.getItem(learnKey(url));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-8) : [];
  } catch { return []; }
}
export function addFusionLearning(url: string, lesson: string): void {
  const l = lesson.trim();
  if (!l) return;
  try {
    const cur = getFusionLearnings(url).filter((x) => x !== l);
    localStorage.setItem(learnKey(url), JSON.stringify([...cur, l].slice(-12)));
  } catch { /* */ }
}

/** hex (#RRGGBB / #RGB) → [r,g,b] i 0..1 for Fusion. */
export function hexToRgb01(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Demo-format → Fusion timeline-preset. */
function platformFor(format: DemoProject["format"]): string {
  switch (format) {
    case "9:16": return "instagram_reels";
    case "1:1": return "square";
    case "4:5": return "instagram_feed_portrait";
    default: return "landing_hero"; // 16:9
  }
}

/** Persister en data-URL til disk og returner filsti (eller null). */
async function persistFrame(projectId: string, name: string, dataUrl: string | null): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  try {
    return await invoke<string>("save_demo_frame", { projectId, name, dataUrl });
  } catch {
    return null;
  }
}

/** Avled UI-effekter for en scene fra hotspot + handlingstype. */
function effectsForScene(s: DemoScene, showCursor: boolean): Array<Record<string, unknown>> {
  const fx: Array<Record<string, unknown>> = [];
  const hs = s.hotspot;
  if (hs && hs.w > 0 && hs.h > 0) {
    const rect = [hs.x, hs.y, hs.w, hs.h];
    const isCta = s.actionType === "click" || s.actionType === "highlight" || s.actionType === "hover";
    if (isCta) {
      fx.push({ type: "ctaHighlight", rect, label: s.targetLabel || "Se her", arrow: true });
      if (showCursor) {
        fx.push({ type: "cursor", from: [0.22, 0.28], to: [hs.x + hs.w / 2, hs.y + hs.h / 2], click: s.actionType !== "hover" });
      }
    } else if (s.visualInstruction || s.targetLabel) {
      fx.push({
        type: "callout",
        rect,
        text: (s.visualInstruction || s.targetLabel || "").slice(0, 48),
        side: hs.y > 0.5 ? "top" : "bottom",
      });
    } else {
      fx.push({ type: "spotlight", rect });
    }
  }
  return fx;
}

/** Bygg params til build_fusion_demo fra et prosjekt (persisterer media). */
export async function buildFusionParams(project: DemoProject): Promise<Record<string, unknown>> {
  const showCursor = project.render?.showCursor ?? true;
  const scenes: Array<Record<string, unknown>> = [];

  for (let i = 0; i < project.scenes.length; i++) {
    const s = project.scenes[i];
    let mediaPath: string | null = s.recordingPath || null;
    if (!mediaPath) {
      const shot = pickShot(project.scanShots, (s.startScrollPct ?? 0) / 100);
      mediaPath = await persistFrame(project.id, `scene_${i}`, shot);
    }
    // AI Director-planlagte effekter overstyrer hotspot-avledning når satt.
    const effects = (s.fusionEffects && s.fusionEffects.length)
      ? s.fusionEffects
      : effectsForScene(s, showCursor);
    // Auto-fokus: la kameraet følge det DETEKTERTE elementet (hotspot), ellers
    // det første effekt-rect-et. Slik «følger kamera brukerens fokus» automatisk.
    const hs = s.hotspot;
    const focusRect = (hs && hs.w > 0 && hs.h > 0)
      ? [hs.x, hs.y, hs.w, hs.h]
      : (effects.find((e) => Array.isArray((e as { rect?: number[] }).rect)) as { rect?: number[] } | undefined)?.rect;
    const sceneParams: Record<string, unknown> = {
      [s.recordingPath ? "clipPath" : "imagePath"]: mediaPath || "",
      caption: s.overlayText || s.visualInstruction || s.title || "",
      durationSec: Math.max(2, s.duration || 4),
      cameraMove: s.cameraMove || "auto",
      effects,
    };
    if (focusRect) sceneParams.focusRect = focusRect;
    scenes.push(sceneParams);
  }

  // Branding (+ logo persistert hvis data-URL)
  const b = project.branding || {};
  let logoPath: string | undefined;
  if (b.logoUrl?.startsWith("data:")) {
    logoPath = (await persistFrame(project.id, "brand_logo", b.logoUrl)) || undefined;
  } else if (b.logoUrl && (b.logoUrl.startsWith("/") || b.logoUrl.startsWith("file:"))) {
    logoPath = b.logoUrl.replace(/^file:\/\//, "");
  }

  const brand: Record<string, unknown> = {
    accent: hexToRgb01(b.brandColor, [0.231, 0.51, 0.965]),
    intro: true,
    outro: true,
    title: b.brandName || project.name,
    cta: project.goal ? project.goal.slice(0, 28) : "Book demo",
  };
  if (logoPath) brand.logoPath = logoPath;

  return {
    platform: platformFor(project.format),
    fps: 60,
    projectName: b.brandName || project.name || "Post Agent Demo",
    timelineName: `${project.name || "Demo"} – Fusion Motion`,
    brand,
    scenes,
  };
}

/** Kjør hele eksporten til Resolve/Fusion. dryRun=true gir plan uten Resolve. */
export async function exportToFusion(project: DemoProject, dryRun = false): Promise<RunSummary> {
  const params = await buildFusionParams(project);
  return executeScript("build_fusion_demo", params, dryRun);
}
