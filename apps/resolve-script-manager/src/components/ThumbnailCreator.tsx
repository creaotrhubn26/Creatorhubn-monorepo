/**
 * ThumbnailCreator — design + rediger thumbnails for sosial feed.
 *
 * Funksjoner:
 *   - Pick frame fra source-video som bakgrunn (timeline-scrubber)
 *   - 6 layout-templates (hero/quote/bold/split/frame/gradient)
 *   - Editable text (title + CTA) med drag-positioning
 *   - Brand colors fra valgt jobb eller manuelt
 *   - Logo-plassering (top/bottom × left/right/center)
 *   - Aspect-ratio toggle (1:1 / 9:16 / 4:5)
 *   - Auto-generate via Python-batch
 *   - Manual-edit via HTML/CSS-overlay
 *   - Export PNG → save lokalt + push til Role Room
 *
 * Auto-pilot bruker også samme Python-script under panseret slik at
 * thumbnails auto-genereres etter render. Bjarne kan deretter åpne dem
 * her for å tweake.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { executeScript } from "../api";
import { feedPlanThumbnailService } from "../services/feedPlanThumbnailService";
import { PhoneMockup } from "./PhoneMockup";
import { DEVICES, PLATFORMS, platformsForAspect } from "../lib/devicePresets";
import type { DeviceId, PlatformId } from "../lib/devicePresets";
import { BrandAssetLibrary } from "./BrandAssetLibrary";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CloseIcon from "@mui/icons-material/Close";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ImageIcon from "@mui/icons-material/Image";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import BrushIcon from "@mui/icons-material/Brush";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import NorthWestIcon from "@mui/icons-material/NorthWest";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import SouthEastIcon from "@mui/icons-material/SouthEast";
import RemoveIcon from "@mui/icons-material/Remove";

export type LayoutTemplate = "free" | "hero" | "quote" | "bold" | "split" | "frame" | "gradient";

export type BackgroundSource = "video-frame" | "image";

/** Fri-form element — tekst ELLER bilde, plassert med prosent-koordinater
 * over bakgrunnen. Render-rekkefølgen i listen styrer z-order: senere
 * elementer ligger over tidligere. */
export type FreeElement = FreeTextEl | FreeImageEl;

interface FreeBase {
  id: string;
  type: "text" | "image";
  /** Sentrum-x i prosent (0–100). */
  xPct: number;
  /** Sentrum-y i prosent (0–100). */
  yPct: number;
  /** Bredde i prosent (for tekst: wrap-bredde, for bilde: render-bredde). */
  widthPct: number;
}

export interface FreeTextEl extends FreeBase {
  type: "text";
  text: string;
  /** Font-størrelse som prosent av content-høyden (typisk 3–12). */
  sizePct: number;
  color: string;
  weight: 400 | 700 | 900;
  align: "left" | "center" | "right";
  /** Drop-shadow for kontrast på lyse bg. */
  shadow: boolean;
}

export interface FreeImageEl extends FreeBase {
  type: "image";
  src: string;
  /** Opacity 0–1. */
  opacity: number;
}

function newTextElement(): FreeTextEl {
  return {
    id: `t-${Math.random().toString(36).slice(2, 9)}`,
    type: "text",
    text: "Ny tekst",
    xPct: 50, yPct: 50, widthPct: 70, sizePct: 6,
    color: "#ffffff", weight: 700, align: "center",
    shadow: true,
  };
}

function newImageElement(src: string): FreeImageEl {
  return {
    id: `i-${Math.random().toString(36).slice(2, 9)}`,
    type: "image",
    src,
    xPct: 50, yPct: 50, widthPct: 40,
    opacity: 1,
  };
}
export type ThumbAspect = "1:1" | "9:16" | "4:5" | "16:9";

function aspectFromPlatform(p: PlatformId): ThumbAspect {
  const cssAspect = PLATFORMS[p].cssAspect.replace(/\s/g, "");
  if (cssAspect === "1/1") return "1:1";
  if (cssAspect === "9/16") return "9:16";
  if (cssAspect === "4/5") return "4:5";
  if (cssAspect === "16/9") return "16:9";
  return "1:1";
}

function defaultPlatformForAspect(a: ThumbAspect): PlatformId {
  return platformsForAspect(a)[0];
}

interface BrandSnapshot {
  companyName?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  logoUrl?: string | null;
  toneOfVoice?: string | null;
}

export type LogoPlacement =
  | "top-left" | "top-right"
  | "bottom-left" | "bottom-right"
  | "center" | "none";

interface ThumbnailCandidate {
  layout: LayoutTemplate;
  path: string;
  fileName: string;
  sourceFrameSec: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sourceVideoPath: string;
  /** Pre-fyller text + branding fra valgt feed-plan-job. */
  initialTitle?: string;
  initialCta?: string;
  initialBrand?: BrandSnapshot;
  initialAspect?: ThumbAspect;
  /** Optional: push generert PNG til Role Room feed-plan-post. */
  feedPlanContext?: {
    projectId: string;
    platform: string;
    postId: string;
  };
}

const ASPECT_DIMS: Record<ThumbAspect, { w: number; h: number; cssAspect: string }> = {
  "1:1":  { w: 1080, h: 1080, cssAspect: "1 / 1" },
  "9:16": { w: 1080, h: 1920, cssAspect: "9 / 16" },
  "4:5":  { w: 1080, h: 1350, cssAspect: "4 / 5" },
  "16:9": { w: 1920, h: 1080, cssAspect: "16 / 9" },
};

const LAYOUT_LABELS: Record<LayoutTemplate, string> = {
  free: "Fri-form",
  hero: "Hero",
  quote: "Quote",
  bold: "Bold",
  split: "Split",
  frame: "Frame",
  gradient: "Gradient",
};

export function ThumbnailCreator({
  open, onClose, sourceVideoPath,
  initialTitle = "", initialCta = "", initialBrand,
  initialAspect = "1:1", feedPlanContext,
}: Props) {
  const [platform, setPlatform] = useState<PlatformId>(defaultPlatformForAspect(initialAspect));
  const aspect: ThumbAspect = aspectFromPlatform(platform);
  const [device, setDevice] = useState<DeviceId>("iphone-15-pro");
  const [showPlatformUI, setShowPlatformUI] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [cta, setCta] = useState(initialCta);
  const [companyName, setCompanyName] = useState(initialBrand?.companyName ?? "");
  const [accentColor, setAccentColor] = useState(initialBrand?.accentColor ?? "#a030c0");
  const [textColor, setTextColor] = useState(initialBrand?.textColor ?? "#ffffff");
  const [backgroundColor, setBackgroundColor] = useState(initialBrand?.backgroundColor ?? "#0a0518");
  const [logoUrl, setLogoUrl] = useState(initialBrand?.logoUrl ?? "");
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>("top-right");
  const [logoSizePct, setLogoSizePct] = useState(0.12);
  // Bakgrunns-kilde — video-frame som default, eller egen bilde-URL
  const [backgroundSource, setBackgroundSource] = useState<BackgroundSource>("video-frame");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [bgLibraryOpen, setBgLibraryOpen] = useState(false);
  // Fri-form tekst-element. Disse legges over bakgrunnen og kan dras
  // rundt inne i mocken. Funker på toppen av enhver layout-mal,
  // ikke bare "free".
  const [freeElements, setFreeElements] = useState<FreeElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [frameSec, setFrameSec] = useState(5);
  const [layout, setLayout] = useState<LayoutTemplate>("hero");
  const [candidates, setCandidates] = useState<ThumbnailCandidate[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoSrc = useMemo(() => sourceVideoPath ? convertFileSrc(sourceVideoPath) : "", [sourceVideoPath]);
  const dims = ASPECT_DIMS[aspect];

  // Reset state ved åpning
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setCta(initialCta);
      setAccentColor(initialBrand?.accentColor ?? "#a030c0");
      setTextColor(initialBrand?.textColor ?? "#ffffff");
      setCompanyName(initialBrand?.companyName ?? "");
      setPlatform(defaultPlatformForAspect(initialAspect));
      setCandidates([]);
      setError(null);
    }
  }, [open, initialTitle, initialCta, initialBrand, initialAspect]);

  const generateAll = async () => {
    if (!sourceVideoPath) return;
    setGenerating(true);
    setError(null);
    try {
      const summary = await executeScript("generate_designed_thumbnails", {
        videoPath: sourceVideoPath,
        bestFrameSeconds: [frameSec, frameSec + 7, frameSec + 14, frameSec + 21, frameSec + 28, frameSec + 35],
        postInfo: { title, caption: title, callToAction: cta },
        brandSnapshot: {
          companyName, accentColor, backgroundColor, textColor,
          logoUrl: logoUrl || null,
          logoPlacement: logoPlacement === "none" ? null : logoPlacement,
          logoSizePct,
        },
        aspectRatio: aspect,
        // Custom background overstyrer video-frame hvis satt
        backgroundImageUrl: backgroundSource === "image" && backgroundImageUrl
          ? backgroundImageUrl : null,
        // Fri-form text-elementer som rendres over bakgrunnen
        freeformElements: freeElements,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as { candidates?: ThumbnailCandidate[] } | undefined;
      setCandidates(v?.candidates ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const pickCandidate = async (cand: ThumbnailCandidate) => {
    setUploadError(null);
    // Uten feed-plan-context: bare lukk (Bjarne brukte CE standalone)
    if (!feedPlanContext) {
      onClose();
      return;
    }
    // Push valgt PNG til Role Room feed-plan-post som customImageUrl
    setUploading(cand.path);
    try {
      await feedPlanThumbnailService.upload({
        projectId: feedPlanContext.projectId,
        platform: feedPlanContext.platform,
        postId: feedPlanContext.postId,
        filePath: cand.path,
        fileName: cand.fileName,
        sourceLayout: cand.layout,
        sourceFrameSec: cand.sourceFrameSec,
      });
      onClose();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(null);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 5500,
        background: "rgba(8,4,20,0.92)", backdropFilter: "blur(10px)",
        display: "flex", flexDirection: "column",
      }}
      onClick={onClose}
    >
      {/* Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #1a0d45 0%, #0a0518 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)",
                          display: "inline-flex", alignItems: "center", gap: 8 }}>
            <BrushIcon fontSize="small" />
            Thumbnail Creator
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
            {feedPlanContext
              ? `For ${feedPlanContext.platform} · post-ID ${feedPlanContext.postId.slice(0, 8)}`
              : "Lag og rediger thumbnails for sosial feed"}
          </div>
        </div>
        <button onClick={onClose}
                style={{ background: "transparent", border: 0, color: "var(--text-2)",
                          cursor: "pointer", padding: 4,
                          display: "inline-flex", alignItems: "center",
                          justifyContent: "center" }}>
            <CloseIcon fontSize="medium" />
          </button>
      </div>

      {/* Main area: 3 columns */}
      <div onClick={(e) => e.stopPropagation()}
           style={{ flex: 1, display: "grid",
                     gridTemplateColumns: "260px 1fr 260px",
                     overflow: "hidden", color: "var(--text-1)" }}>

        {/* LEFT: video frame picker */}
        <div style={{ background: "var(--bg-1)", borderRight: "1px solid var(--border)",
                        padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "var(--text-2)" }}>
            BAKGRUNN-FRAME
          </div>
          {videoSrc && (
            <video
              ref={videoRef}
              src={videoSrc}
              style={{ width: "100%", aspectRatio: dims.cssAspect, objectFit: "cover",
                        borderRadius: 4, marginBottom: 8 }}
              muted
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = frameSec;
              }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <input type="range" min={0} max={300} step={0.5}
                   value={frameSec}
                   onChange={(e) => {
                     const v = parseFloat(e.target.value);
                     setFrameSec(v);
                     if (videoRef.current) videoRef.current.currentTime = v;
                   }}
                   style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "var(--text-3)", minWidth: 36 }}>
              {frameSec.toFixed(1)}s
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 16 }}>
            Auto-genereringen sampler 6 frames startende her (hver 7. sek).
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "var(--text-2)" }}>
            PLATTFORM
          </div>
          {(Object.keys(PLATFORMS) as PlatformId[]).map(p => {
            const spec = PLATFORMS[p];
            return (
              <button key={p}
                      onClick={() => setPlatform(p)}
                      title={spec.uiDescription}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        background: platform === p ? accentColor : "rgba(255,255,255,0.04)",
                        color: platform === p ? "#fff" : "var(--text-1)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, padding: "6px 10px", marginBottom: 4,
                        fontSize: 11, cursor: "pointer", lineHeight: 1.3,
                      }}>
                <div style={{ fontWeight: 600 }}>{spec.name}</div>
                <div style={{ fontSize: 9.5, opacity: 0.75 }}>
                  {spec.exportPx.w}×{spec.exportPx.h} px
                </div>
              </button>
            );
          })}

          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 8,
                          color: "var(--text-2)" }}>
            TELEFON-PREVIEW
          </div>
          {(Object.keys(DEVICES) as DeviceId[]).map(d => (
            <button key={d}
                    onClick={() => setDevice(d)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: device === d ? accentColor : "rgba(255,255,255,0.04)",
                      color: device === d ? "#fff" : "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, padding: "5px 10px", marginBottom: 3,
                      fontSize: 11, cursor: "pointer",
                    }}>
              {DEVICES[d].name}
              <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>
                {DEVICES[d].pointSize.w}×{DEVICES[d].pointSize.h}
              </span>
            </button>
          ))}

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6,
                              fontSize: 11, color: "var(--text-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={showPlatformUI}
                     onChange={e => setShowPlatformUI(e.target.checked)} />
              Plattform-UI overlay
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6,
                              fontSize: 11, color: "var(--text-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={showSafeArea}
                     onChange={e => setShowSafeArea(e.target.checked)} />
              Safe-area-guides
            </label>
          </div>
        </div>

        {/* CENTER: live preview + layout-picker */}
        <div style={{ background: "var(--bg-0)", padding: 24,
                        display: "flex", flexDirection: "column", overflow: "auto" }}>
          {/* Preview — design rendres inne i telefon-mockup med riktige
              dimensjoner og plattform-UI-safe-zones synlig */}
          <div style={{ display: "flex", justifyContent: "center", flex: 1,
                          alignItems: "center" }}>
            <PhoneMockup
              deviceId={device}
              platformId={platform}
              maxWidth={420}
              maxHeight={600}
              showPlatformUI={showPlatformUI}
              showSafeArea={showSafeArea}
            >
              <ThumbnailDesignOverlay
                layout={layout}
                title={title} cta={cta} companyName={companyName}
                accentColor={accentColor} textColor={textColor}
                backgroundColor={backgroundColor}
                videoSrc={videoSrc}
                frameSec={frameSec}
                logoUrl={logoUrl}
                logoPlacement={logoPlacement}
                logoSizePct={logoSizePct}
                backgroundSource={backgroundSource}
                backgroundImageUrl={backgroundImageUrl}
                freeElements={freeElements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onElementChange={(id, patch) => setFreeElements(prev =>
                  prev.map(el => el.id === id
                    ? ({ ...el, ...patch } as FreeElement)
                    : el))}
              />
            </PhoneMockup>
          </div>

          {/* Layout-picker bar */}
          <div style={{ display: "flex", gap: 6, marginTop: 16, justifyContent: "center" }}>
            {(Object.keys(LAYOUT_LABELS) as LayoutTemplate[]).map(l => (
              <button key={l}
                      onClick={() => setLayout(l)}
                      style={{
                        background: layout === l ? accentColor : "rgba(255,255,255,0.05)",
                        color: layout === l ? "#fff" : "var(--text-1)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, padding: "8px 14px",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                      }}>
                {LAYOUT_LABELS[l]}
              </button>
            ))}
          </div>

          {/* Generated candidates */}
          {candidates.length > 0 && (
            <div style={{ marginTop: 24, padding: "12px 0",
                            borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)",
                              marginBottom: 8 }}>
                {candidates.length} GENERERTE KANDIDATER (klikk for å velge)
              </div>
              <div style={{ display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                              gap: 8 }}>
                {candidates.map((c, i) => (
                  <button key={i}
                          onClick={() => void pickCandidate(c)}
                          disabled={uploading !== null}
                          title={feedPlanContext
                            ? `${c.layout} · frame ${c.sourceFrameSec}s — klikk for å pushe til feed-post`
                            : `${c.layout} · frame ${c.sourceFrameSec}s`}
                          style={{
                            aspectRatio: dims.cssAspect,
                            background: "var(--bg-2)",
                            border: uploading === c.path
                              ? `2px solid ${accentColor}`
                              : "1px solid var(--border)",
                            borderRadius: 4, overflow: "hidden",
                            cursor: uploading ? "wait" : "pointer", padding: 0,
                            opacity: uploading && uploading !== c.path ? 0.4 : 1,
                            position: "relative",
                          }}>
                    <img src={convertFileSrc(c.path)}
                         style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {uploading === c.path && (
                      <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(0,0,0,0.55)", color: "#fff",
                        fontSize: 10, fontWeight: 600,
                      }}>Sender…</div>
                    )}
                  </button>
                ))}
              </div>
              {uploadError && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 4,
                                background: "rgba(239,79,111,0.10)",
                                color: "#ef4f6f", fontSize: 11 }}>
                  Kunne ikke pushe til feed-plan: {uploadError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: text + brand */}
        <div style={{ background: "var(--bg-1)", borderLeft: "1px solid var(--border)",
                        padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "var(--text-2)" }}>
            TEKST
          </div>
          <input value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Tittel / hook …"
                 style={inputStyle} />
          <input value={cta}
                 onChange={(e) => setCta(e.target.value)}
                 placeholder="Call-to-action (LES MER, KJØP NÅ, …)"
                 style={{ ...inputStyle, marginTop: 6 }} />
          <input value={companyName}
                 onChange={(e) => setCompanyName(e.target.value)}
                 placeholder="Brand / klient-navn"
                 style={{ ...inputStyle, marginTop: 6 }} />

          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8,
                          color: "var(--text-2)" }}>
            BRAND COLORS
          </div>
          <ColorRow label="Accent" value={accentColor} onChange={setAccentColor} />
          <ColorRow label="Bakgrunn" value={backgroundColor} onChange={setBackgroundColor} />
          <ColorRow label="Tekst" value={textColor} onChange={setTextColor} />

          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8,
                          color: "var(--text-2)",
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center" }}>
            <span>LOGO</span>
            {feedPlanContext && (
              <button onClick={() => setLibraryOpen(true)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "var(--text-2)", borderRadius: 4,
                        padding: "2px 8px", fontSize: 10,
                        cursor: "pointer", fontWeight: 500,
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                <PhotoLibraryIcon sx={{ fontSize: 12 }} />Bibliotek
              </button>
            )}
          </div>
          {logoUrl && (
            <div style={{
              marginBottom: 6, padding: 6, borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <img src={logoUrl} alt=""
                   style={{ width: 32, height: 32, objectFit: "contain",
                             background: "repeating-conic-gradient(#1a1a25 0% 25%, #14141e 0% 50%) 50% / 8px 8px",
                             borderRadius: 2 }} />
              <div style={{ flex: 1, fontSize: 10, color: "var(--text-3)",
                             overflow: "hidden", textOverflow: "ellipsis",
                             whiteSpace: "nowrap" }}>
                Logo aktiv
              </div>
              <button onClick={() => setLogoUrl("")}
                      title="Fjern logo"
                      style={{ background: "transparent", border: 0,
                                color: "var(--text-3)", cursor: "pointer",
                                fontSize: 12 }}>✕</button>
            </div>
          )}
          <input value={logoUrl}
                 onChange={(e) => setLogoUrl(e.target.value)}
                 placeholder="Logo-URL (https:// eller data:image/…)"
                 style={inputStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 4, marginTop: 6 }}>
            {([
              { v: "top-left", I: NorthWestIcon },
              { v: "top-right", I: NorthEastIcon },
              { v: "none", I: RemoveIcon },
              { v: "bottom-left", I: SouthWestIcon },
              { v: "bottom-right", I: SouthEastIcon },
              { v: "center", I: RadioButtonUncheckedIcon },
            ] as Array<{ v: LogoPlacement; I: typeof NorthWestIcon }>).map(o => (
              <button key={o.v}
                      onClick={() => setLogoPlacement(o.v)}
                      title={o.v}
                      style={{
                        background: logoPlacement === o.v
                          ? accentColor : "rgba(255,255,255,0.04)",
                        color: logoPlacement === o.v ? "#fff" : "var(--text-1)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, padding: "6px 0",
                        cursor: "pointer",
                        display: "inline-flex", alignItems: "center",
                        justifyContent: "center",
                      }}>
                <o.I sx={{ fontSize: 14 }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6,
                          marginTop: 8, fontSize: 10.5,
                          color: "var(--text-2)" }}>
            <span style={{ minWidth: 40 }}>Størrelse</span>
            <input type="range" min={0.06} max={0.30} step={0.01}
                   value={logoSizePct}
                   onChange={e => setLogoSizePct(parseFloat(e.target.value))}
                   style={{ flex: 1 }} />
            <span style={{ minWidth: 30, textAlign: "right" }}>
              {(logoSizePct * 100).toFixed(0)}%
            </span>
          </div>

          {/* BAKGRUNN-velger */}
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6,
                          color: "var(--text-2)" }}>
            BAKGRUNN
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <button onClick={() => setBackgroundSource("video-frame")}
                    style={{
                      flex: 1, fontSize: 11, padding: "6px 8px",
                      background: backgroundSource === "video-frame"
                        ? accentColor : "rgba(255,255,255,0.04)",
                      color: backgroundSource === "video-frame" ? "#fff" : "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, cursor: "pointer",
                    }}>Video-frame</button>
            <button onClick={() => setBackgroundSource("image")}
                    style={{
                      flex: 1, fontSize: 11, padding: "6px 8px",
                      background: backgroundSource === "image"
                        ? accentColor : "rgba(255,255,255,0.04)",
                      color: backgroundSource === "image" ? "#fff" : "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, cursor: "pointer",
                    }}>Bilde</button>
          </div>
          {backgroundSource === "image" && (
            <>
              <input value={backgroundImageUrl}
                     onChange={e => setBackgroundImageUrl(e.target.value)}
                     placeholder="Bilde-URL eller data:image/…"
                     style={inputStyle} />
              {feedPlanContext && (
                <button onClick={() => setBgLibraryOpen(true)}
                        style={{
                          marginTop: 6, width: "100%", fontSize: 11,
                          background: "transparent",
                          color: "var(--text-2)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 4, padding: "5px 10px",
                          cursor: "pointer",
                          display: "inline-flex", alignItems: "center",
                          justifyContent: "center", gap: 6,
                        }}>
                  <PhotoLibraryIcon sx={{ fontSize: 13 }} />Velg fra bibliotek
                </button>
              )}
            </>
          )}

          {/* FRI-TEKST/BILDE-ELEMENTER */}
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6,
                          color: "var(--text-2)",
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center" }}>
            <span>ELEMENTER OVER BAKGRUNN</span>
            <span style={{ fontSize: 9.5, color: "var(--text-3)", fontWeight: 500 }}>
              {freeElements.length}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <button onClick={() => {
                      const el = newTextElement();
                      setFreeElements(prev => [...prev, el]);
                      setSelectedElementId(el.id);
                    }}
                    style={{
                      flex: 1, fontSize: 11, padding: "6px 8px",
                      background: accentColor, color: "#fff",
                      border: 0, borderRadius: 4, cursor: "pointer",
                      fontWeight: 600,
                      display: "inline-flex", alignItems: "center",
                      justifyContent: "center", gap: 4,
                    }}>
              <AddIcon sx={{ fontSize: 13 }} />Tekst
            </button>
            <button onClick={() => {
                      // For nå: spør om URL. Senere kan vi knytte til bibliotek.
                      const url = window.prompt(
                        "Bilde-URL eller data:image/… (lim inn fra bibliotek)",
                      );
                      if (!url) return;
                      const el = newImageElement(url);
                      setFreeElements(prev => [...prev, el]);
                      setSelectedElementId(el.id);
                    }}
                    style={{
                      flex: 1, fontSize: 11, padding: "6px 8px",
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, cursor: "pointer",
                      fontWeight: 500,
                      display: "inline-flex", alignItems: "center",
                      justifyContent: "center", gap: 4,
                    }}>
              <AddIcon sx={{ fontSize: 13 }} />Bilde
            </button>
          </div>

          {/* Liste over elementer i z-order (nederst i lista = bakerst) */}
          {freeElements.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {freeElements.slice().reverse().map((el, revIdx) => {
                const realIdx = freeElements.length - 1 - revIdx;
                const isSel = selectedElementId === el.id;
                return (
                  <div key={el.id}
                       onClick={() => setSelectedElementId(el.id)}
                       style={{
                         display: "flex", alignItems: "center", gap: 4,
                         padding: "4px 6px", marginBottom: 2,
                         background: isSel ? "rgba(160,48,192,0.18)"
                                          : "rgba(255,255,255,0.03)",
                         border: isSel ? "1px solid rgba(160,48,192,0.4)"
                                       : "1px solid transparent",
                         borderRadius: 4, fontSize: 10.5, cursor: "pointer",
                       }}>
                    <span style={{ width: 14, display: "flex",
                                     alignItems: "center", justifyContent: "center" }}>
                      {el.type === "text"
                        ? <TextFieldsIcon sx={{ fontSize: 13 }} />
                        : <ImageIcon sx={{ fontSize: 13 }} />}
                    </span>
                    <span style={{ flex: 1,
                                     overflow: "hidden", textOverflow: "ellipsis",
                                     whiteSpace: "nowrap",
                                     color: "var(--text-2)" }}>
                      {el.type === "text" ? (el.text || "(tom)") : "Bilde"}
                    </span>
                    {/* Bring forward / send backward */}
                    <button onClick={(e) => {
                              e.stopPropagation();
                              if (realIdx >= freeElements.length - 1) return;
                              setFreeElements(prev => {
                                const next = [...prev];
                                [next[realIdx], next[realIdx + 1]] =
                                  [next[realIdx + 1], next[realIdx]];
                                return next;
                              });
                            }}
                            disabled={realIdx >= freeElements.length - 1}
                            title="Bring fremover"
                            style={miniBtn}>
                      <ArrowUpwardIcon sx={{ fontSize: 13 }} />
                    </button>
                    <button onClick={(e) => {
                              e.stopPropagation();
                              if (realIdx <= 0) return;
                              setFreeElements(prev => {
                                const next = [...prev];
                                [next[realIdx], next[realIdx - 1]] =
                                  [next[realIdx - 1], next[realIdx]];
                                return next;
                              });
                            }}
                            disabled={realIdx <= 0}
                            title="Send bakover"
                            style={miniBtn}>
                      <ArrowDownwardIcon sx={{ fontSize: 13 }} />
                    </button>
                    <button onClick={(e) => {
                              e.stopPropagation();
                              setFreeElements(prev =>
                                prev.filter(x => x.id !== el.id));
                              if (selectedElementId === el.id)
                                setSelectedElementId(null);
                            }}
                            title="Slett element"
                            style={{ ...miniBtn, color: "#ef4f6f" }}>
                      <CloseIcon sx={{ fontSize: 13 }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Editor for valgt element */}
          {selectedElementId && (() => {
            const sel = freeElements.find(e => e.id === selectedElementId);
            if (!sel) return null;
            return (
              <SelectedElementEditor
                element={sel}
                accentColor={accentColor}
                onChange={(patch) => setFreeElements(prev =>
                  prev.map(e => e.id === sel.id
                    ? ({ ...e, ...patch } as FreeElement) : e))}
              />
            );
          })()}

          {error && (
            <div style={{ marginTop: 12, padding: 8, borderRadius: 4,
                            background: "rgba(239,79,111,0.10)", color: "#ef4f6f",
                            fontSize: 11, lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          {/* Generate batch */}
          <button onClick={() => void generateAll()}
                  disabled={generating || !sourceVideoPath}
                  style={{
                    marginTop: 16, width: "100%",
                    background: generating ? "var(--bg-2)" : accentColor,
                    color: "#fff", border: 0, borderRadius: 4,
                    padding: "10px 12px", fontSize: 12, fontWeight: 700,
                    cursor: generating ? "wait" : "pointer",
                  }}>
            {generating ? (
              "Genererer 6 …"
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center",
                              gap: 6, justifyContent: "center" }}>
                <AutoFixHighIcon sx={{ fontSize: 14 }} />Generer 6 kandidater
              </span>
            )}
          </button>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6,
                          textAlign: "center" }}>
            Lager design med alle 6 layout-templates + samplede frames
          </div>
        </div>
      </div>

      {/* Brand asset-bibliotek for logo */}
      {feedPlanContext && (
        <BrandAssetLibrary
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          projectId={feedPlanContext.projectId}
          kind="logo"
          accentColor={accentColor}
          onPick={(asset) => setLogoUrl(asset.dataUrl)}
        />
      )}
      {/* Brand asset-bibliotek for bakgrunns-bilder (template-bg-kind) */}
      {feedPlanContext && (
        <BrandAssetLibrary
          open={bgLibraryOpen}
          onClose={() => setBgLibraryOpen(false)}
          projectId={feedPlanContext.projectId}
          kind="template-bg"
          accentColor={accentColor}
          onPick={(asset) => setBackgroundImageUrl(asset.dataUrl)}
        />
      )}
    </div>
  );
}

/**
 * ThumbnailDesignOverlay — selve design-laget som rendres inne i
 * telefon-mockup-skjermen. Bruker container-queries (cqw/cqh) så
 * fontene skalerer fra content-slot-størrelsen, ikke viewporten.
 *
 * Editing-prinsipp: alle posisjoner og størrelser er prosent av
 * containeren. Når Bjarne drar et tekst-element flyttes det inne i
 * mocken og holder den samme prosent-posisjonen i eksport-PNG-en.
 */
function ThumbnailDesignOverlay({
  layout, title, cta, companyName,
  accentColor, textColor, backgroundColor,
  videoSrc, frameSec,
  logoUrl, logoPlacement, logoSizePct,
  backgroundSource, backgroundImageUrl,
  freeElements, selectedElementId,
  onSelectElement, onElementChange,
}: {
  layout: LayoutTemplate;
  title: string; cta: string; companyName: string;
  accentColor: string; textColor: string; backgroundColor: string;
  videoSrc: string; frameSec: number;
  logoUrl: string; logoPlacement: LogoPlacement; logoSizePct: number;
  backgroundSource: BackgroundSource;
  backgroundImageUrl: string;
  freeElements: FreeElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onElementChange: (id: string, patch: Partial<FreeElement>) => void;
}) {
  // I "free"-modus: ingen template-bakgrunn, kun custom bg + frie tekst-element
  const isFree = layout === "free";
  const bg = isFree ? "#0a0518" : (layout === "bold" ? accentColor : backgroundColor);
  const showVideoBackground = !isFree && layout !== "bold"
    && backgroundSource === "video-frame" && videoSrc;
  const showImageBackground = backgroundSource === "image" && backgroundImageUrl;

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: bg,
        containerType: "size",
      } as React.CSSProperties}
      onClick={(e) => {
        // Klikk på tom flate = avmark valgt element
        if (e.target === e.currentTarget) onSelectElement(null);
      }}
    >
      {showVideoBackground && (
        <video
          src={videoSrc}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "cover",
          }}
          muted
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = frameSec; }}
        />
      )}
      {showImageBackground && (
        <img src={backgroundImageUrl} alt=""
             style={{
               position: "absolute", inset: 0,
               width: "100%", height: "100%", objectFit: "cover",
             }} />
      )}
      {layout === "hero" && (
        <>
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: "50%",
            background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))",
          }} />
          <div style={{
            position: "absolute", left: "5%", right: "5%", bottom: "10%",
            color: textColor,
          }}>
            <div style={{ fontSize: "7cqh", fontWeight: 800, lineHeight: 1.1 }}>
              {title || "Tittel her"}
            </div>
            {cta && (
              <div style={{ fontSize: "3.5cqh", marginTop: "1.5cqh",
                              color: accentColor, fontWeight: 600 }}>
                {cta}
              </div>
            )}
          </div>
        </>
      )}
      {layout === "quote" && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: "45%", background: "#faf8f6",
          padding: "5%", color: "#14141e",
        }}>
          <div style={{ fontSize: "10cqh", color: accentColor,
                          fontWeight: 800, lineHeight: 0.6 }}>"</div>
          <div style={{ fontSize: "4cqh", fontWeight: 700, marginTop: "1cqh" }}>
            {title || "Sitatet"}
          </div>
          <div style={{ position: "absolute", bottom: "5%",
                          fontSize: "2.5cqh",
                          color: accentColor, fontWeight: 600 }}>
            — {(companyName || "STUDIO").toUpperCase()}
          </div>
        </div>
      )}
      {layout === "bold" && (
        <div style={{
          position: "absolute", inset: 0, padding: "5%",
          color: "#fff",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: "7cqh", fontWeight: 900,
                          textTransform: "uppercase", lineHeight: 1.1 }}>
            {(cta || title || "Hook!").toUpperCase()}
          </div>
          <div style={{ fontSize: "2.8cqh", maxWidth: "80%" }}>
            {title !== cta ? title : ""}
          </div>
        </div>
      )}
      {layout === "split" && (
        <>
          <div style={{
            position: "absolute", left: "50%", top: 0, bottom: 0,
            width: "50%", background: backgroundColor,
          }} />
          <div style={{
            position: "absolute", left: "55%", top: "10%", width: "40%",
            color: textColor, fontSize: "4.5cqh", fontWeight: 800,
            lineHeight: 1.1,
          }}>
            {title || "Tittel"}
          </div>
          {cta && (
            <div style={{ position: "absolute", left: "55%", bottom: "8%",
                            color: accentColor, fontWeight: 700,
                            fontSize: "2.5cqh", textTransform: "uppercase" }}>
              {cta}
            </div>
          )}
        </>
      )}
      {layout === "frame" && (
        <>
          <div style={{
            position: "absolute", inset: 0,
            border: `6cqh solid ${backgroundColor}`,
            boxSizing: "border-box",
          }} />
          <div style={{
            position: "absolute", top: "3%", left: "8%", right: "8%",
            color: textColor, fontSize: "5cqh", fontWeight: 800,
          }}>
            {title || "Tittel"}
          </div>
          {cta && (
            <div style={{
              position: "absolute", bottom: "5%", right: "10%",
              background: accentColor, color: "#fff",
              padding: "1cqh 2cqh", borderRadius: 999,
              fontSize: "3cqh", fontWeight: 700,
              textTransform: "uppercase",
            }}>
              {cta}
            </div>
          )}
        </>
      )}
      {layout === "gradient" && (
        <>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85))",
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "1cqh", background: accentColor,
          }} />
          <div style={{
            position: "absolute", left: "5%", right: "5%", bottom: "10%",
            color: "#fff",
          }}>
            <div style={{ fontSize: "6.5cqh", fontWeight: 800, lineHeight: 1.1 }}>
              {title || "Tittel"}
            </div>
          </div>
          <div style={{
            position: "absolute", top: "5%", left: "5%",
            color: accentColor, fontSize: "2.2cqh",
            fontWeight: 700, textTransform: "uppercase",
          }}>
            {companyName || "Studio"}
          </div>
        </>
      )}
      {/* Fri-form elementer — render i array-rekkefølge (senere = på toppen).
          Bjarne kan dra dem rundt og endre z-order. */}
      {freeElements.map(el => (
        <FreeElementRenderer
          key={el.id}
          element={el}
          selected={selectedElementId === el.id}
          onSelect={() => onSelectElement(el.id)}
          onChange={(patch) => onElementChange(el.id, patch)}
        />
      ))}
      {/* Logo-overlay — rendres på toppen av alt annet */}
      {logoUrl && logoPlacement !== "none" && (
        <LogoOverlay url={logoUrl} placement={logoPlacement} sizePct={logoSizePct} />
      )}
    </div>
  );
}

/**
 * FreeElementRenderer — én tekst/bilde inne i mock-skjermen. Bruker
 * pointer-events for å la Bjarne dra elementet rundt med musen.
 * xPct/yPct = sentrum-koordinater så elementet sentreres naturlig.
 */
function FreeElementRenderer({ element, selected, onSelect, onChange }: {
  element: FreeElement;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<FreeElement>) => void;
}) {
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
    const slot = e.currentTarget.parentElement;
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startXPct = element.xPct, startYPct = element.yPct;
    e.currentTarget.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startY) / rect.height) * 100;
      onChange({
        xPct: Math.max(0, Math.min(100, startXPct + dxPct)),
        yPct: Math.max(0, Math.min(100, startYPct + dyPct)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${element.xPct}%`,
    top: `${element.yPct}%`,
    transform: "translate(-50%, -50%)",
    cursor: "move",
    userSelect: "none",
    touchAction: "none",
    outline: selected ? "1.5px dashed rgba(160,48,192,0.85)" : "none",
    outlineOffset: 2,
  };

  if (element.type === "text") {
    return (
      <div onPointerDown={handlePointerDown}
           style={{
             ...baseStyle,
             width: `${element.widthPct}%`,
             fontSize: `${element.sizePct}cqh`,
             color: element.color,
             fontWeight: element.weight,
             textAlign: element.align,
             lineHeight: 1.15,
             textShadow: element.shadow
               ? "0 1px 4px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.5)"
               : undefined,
             whiteSpace: "pre-wrap",
             wordBreak: "break-word",
           }}>
        {element.text || " "}
      </div>
    );
  }

  // Image element
  return (
    <img src={element.src} alt=""
         onPointerDown={handlePointerDown}
         draggable={false}
         style={{
           ...baseStyle,
           width: `${element.widthPct}%`,
           height: "auto",
           opacity: element.opacity,
           pointerEvents: "auto",
         }} />
  );
}

function LogoOverlay({ url, placement, sizePct }: {
  url: string; placement: LogoPlacement; sizePct: number;
}) {
  // 4 % padding fra hjørnet (matches PIL-versjonen)
  const pad = "4%";
  const w = `${sizePct * 100}%`;
  const base: React.CSSProperties = {
    position: "absolute", width: w, height: "auto",
    pointerEvents: "none",
    // drop-shadow så logoer på lyse bakgrunner fortsatt har kontrast
    filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.35))",
  };
  let pos: React.CSSProperties;
  switch (placement) {
    case "top-left":     pos = { top: pad, left: pad }; break;
    case "top-right":    pos = { top: pad, right: pad }; break;
    case "bottom-left":  pos = { bottom: pad, left: pad }; break;
    case "bottom-right": pos = { bottom: pad, right: pad }; break;
    case "center":
      pos = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
      break;
    default: return null;
  }
  return <img src={url} alt="" style={{ ...base, ...pos }} />;
}

const miniBtn: React.CSSProperties = {
  background: "transparent", border: 0,
  color: "var(--text-2)", cursor: "pointer",
  padding: 2, lineHeight: 1, borderRadius: 3,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

function SelectedElementEditor({ element, accentColor, onChange }: {
  element: FreeElement;
  accentColor: string;
  onChange: (patch: Partial<FreeElement>) => void;
}) {
  if (element.type === "text") {
    return (
      <div style={{
        marginBottom: 8, padding: 10, borderRadius: 4,
        background: "rgba(160,48,192,0.08)",
        border: "1px solid rgba(160,48,192,0.25)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6,
                        color: accentColor, letterSpacing: 0.5 }}>
          VALGT TEKST
        </div>
        <textarea value={element.text}
                  onChange={e => onChange({ text: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, fontSize: 11, resize: "vertical",
                            minHeight: 40 }} />
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {([400, 700, 900] as const).map(w => (
            <button key={w}
                    onClick={() => onChange({ weight: w })}
                    style={{
                      flex: 1, fontSize: 10, padding: "4px 0",
                      fontWeight: w,
                      background: element.weight === w
                        ? accentColor : "rgba(255,255,255,0.04)",
                      color: element.weight === w ? "#fff" : "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, cursor: "pointer",
                    }}>{w === 400 ? "Regular" : w === 700 ? "Bold" : "Black"}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {([
            { v: "left" as const, I: FormatAlignLeftIcon },
            { v: "center" as const, I: FormatAlignCenterIcon },
            { v: "right" as const, I: FormatAlignRightIcon },
          ]).map(o => (
            <button key={o.v}
                    onClick={() => onChange({ align: o.v })}
                    style={{
                      flex: 1, padding: "4px 0",
                      background: element.align === o.v
                        ? accentColor : "rgba(255,255,255,0.04)",
                      color: element.align === o.v ? "#fff" : "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
              <o.I sx={{ fontSize: 14 }} />
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
                        marginTop: 8, fontSize: 10.5, color: "var(--text-2)" }}>
          <span style={{ minWidth: 40 }}>Størrelse</span>
          <input type="range" min={2} max={14} step={0.5}
                 value={element.sizePct}
                 onChange={e => onChange({ sizePct: parseFloat(e.target.value) })}
                 style={{ flex: 1 }} />
          <span style={{ minWidth: 30, textAlign: "right" }}>
            {element.sizePct.toFixed(1)}%
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
                        marginTop: 6, fontSize: 10.5, color: "var(--text-2)" }}>
          <span style={{ minWidth: 40 }}>Bredde</span>
          <input type="range" min={20} max={100} step={1}
                 value={element.widthPct}
                 onChange={e => onChange({ widthPct: parseFloat(e.target.value) })}
                 style={{ flex: 1 }} />
          <span style={{ minWidth: 30, textAlign: "right" }}>
            {element.widthPct.toFixed(0)}%
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <input type="color" value={element.color}
                 onChange={e => onChange({ color: e.target.value })}
                 style={{ width: 24, height: 24, border: 0, borderRadius: 4,
                           cursor: "pointer", padding: 0, background: "transparent" }} />
          <span style={{ fontSize: 10.5, color: "var(--text-2)", flex: 1 }}>
            Tekstfarge
          </span>
          <label style={{ display: "inline-flex", alignItems: "center",
                            gap: 4, fontSize: 10.5, color: "var(--text-2)",
                            cursor: "pointer" }}>
            <input type="checkbox" checked={element.shadow}
                   onChange={e => onChange({ shadow: e.target.checked })} />
            Skygge
          </label>
        </div>
      </div>
    );
  }
  // image
  return (
    <div style={{
      marginBottom: 8, padding: 10, borderRadius: 4,
      background: "rgba(160,48,192,0.08)",
      border: "1px solid rgba(160,48,192,0.25)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6,
                      color: accentColor, letterSpacing: 0.5 }}>
        VALGT BILDE
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6,
                      fontSize: 10.5, color: "var(--text-2)" }}>
        <span style={{ minWidth: 40 }}>Bredde</span>
        <input type="range" min={5} max={100} step={1}
               value={element.widthPct}
               onChange={e => onChange({ widthPct: parseFloat(e.target.value) })}
               style={{ flex: 1 }} />
        <span style={{ minWidth: 30, textAlign: "right" }}>
          {element.widthPct.toFixed(0)}%
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6,
                      fontSize: 10.5, color: "var(--text-2)" }}>
        <span style={{ minWidth: 40 }}>Opacity</span>
        <input type="range" min={0.1} max={1} step={0.05}
               value={element.opacity}
               onChange={e => onChange({ opacity: parseFloat(e.target.value) })}
               style={{ flex: 1 }} />
        <span style={{ minWidth: 30, textAlign: "right" }}>
          {(element.opacity * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <input type="color" value={value}
             onChange={(e) => onChange(e.target.value)}
             style={{ width: 28, height: 28, border: 0, borderRadius: 4,
                       cursor: "pointer", padding: 0, background: "transparent" }} />
      <span style={{ fontSize: 10.5, color: "var(--text-2)", flex: 1 }}>{label}</span>
      <input value={value}
             onChange={(e) => onChange(e.target.value)}
             style={{ ...inputStyle, marginTop: 0, width: 80, fontSize: 10 }} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4, padding: "6px 8px",
  color: "var(--text-1)", fontSize: 11,
};

export default ThumbnailCreator;
