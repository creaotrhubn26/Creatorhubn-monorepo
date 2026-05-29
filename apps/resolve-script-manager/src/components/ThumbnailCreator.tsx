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

export type LayoutTemplate = "hero" | "quote" | "bold" | "split" | "frame" | "gradient";
export type ThumbAspect = "1:1" | "9:16" | "4:5";

interface BrandSnapshot {
  companyName?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  logoUrl?: string | null;
  toneOfVoice?: string | null;
}

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
};

const LAYOUT_LABELS: Record<LayoutTemplate, string> = {
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
  const [aspect, setAspect] = useState<ThumbAspect>(initialAspect);
  const [title, setTitle] = useState(initialTitle);
  const [cta, setCta] = useState(initialCta);
  const [companyName, setCompanyName] = useState(initialBrand?.companyName ?? "");
  const [accentColor, setAccentColor] = useState(initialBrand?.accentColor ?? "#a030c0");
  const [textColor, setTextColor] = useState(initialBrand?.textColor ?? "#ffffff");
  const [backgroundColor, setBackgroundColor] = useState(initialBrand?.backgroundColor ?? "#0a0518");
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
      setAspect(initialAspect);
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
        brandSnapshot: { companyName, accentColor, backgroundColor, textColor },
        aspectRatio: aspect,
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

  const previewBg = layout === "bold" ? accentColor : backgroundColor;

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
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
            🎨 Thumbnail Creator
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
            {feedPlanContext
              ? `For ${feedPlanContext.platform} · post-ID ${feedPlanContext.postId.slice(0, 8)}`
              : "Lag og rediger thumbnails for sosial feed"}
          </div>
        </div>
        <button onClick={onClose}
                style={{ background: "transparent", border: 0, color: "var(--text-2)",
                          cursor: "pointer", fontSize: 24, padding: 4 }}>✕</button>
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
            ASPECT
          </div>
          {(Object.keys(ASPECT_DIMS) as ThumbAspect[]).map(a => (
            <button key={a}
                    onClick={() => setAspect(a)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: aspect === a ? accentColor : "rgba(255,255,255,0.04)",
                      color: aspect === a ? "#fff" : "var(--text-1)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4, padding: "6px 10px", marginBottom: 4,
                      fontSize: 11, cursor: "pointer",
                    }}>
              {a} · {a === "1:1" ? "Square (IG feed)" : a === "9:16" ? "Reel/TikTok" : "Portrait (IG)"}
            </button>
          ))}
        </div>

        {/* CENTER: live preview + layout-picker */}
        <div style={{ background: "var(--bg-0)", padding: 24,
                        display: "flex", flexDirection: "column", overflow: "auto" }}>
          {/* Preview */}
          <div style={{ display: "flex", justifyContent: "center", flex: 1,
                          alignItems: "center" }}>
            <div style={{
              aspectRatio: dims.cssAspect, maxHeight: "60vh", maxWidth: "100%",
              background: previewBg,
              position: "relative", overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
              borderRadius: 4,
            }}>
              {videoSrc && (
                <video
                  src={videoSrc}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    opacity: layout === "bold" ? 0 : 1,
                  }}
                  muted
                  onLoadedMetadata={(e) => { e.currentTarget.currentTime = frameSec; }}
                />
              )}
              {/* Overlay basert på layout */}
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
                    <div style={{ fontSize: "min(7vh, 6vw)", fontWeight: 800, lineHeight: 1.1 }}>
                      {title || "Tittel her"}
                    </div>
                    {cta && (
                      <div style={{ fontSize: "min(3.5vh, 3vw)", marginTop: 12,
                                      color: accentColor, fontWeight: 600 }}>
                        {cta}
                      </div>
                    )}
                  </div>
                </>
              )}
              {layout === "quote" && (
                <>
                  <div style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    height: "45%", background: "#faf8f6",
                    padding: "5%", color: "#14141e",
                  }}>
                    <div style={{ fontSize: "min(10vh, 9vw)", color: accentColor,
                                    fontWeight: 800, lineHeight: 0.6 }}>"</div>
                    <div style={{ fontSize: "min(4vh, 3.8vw)", fontWeight: 700,
                                    marginTop: 8 }}>
                      {title || "Sitatet"}
                    </div>
                    <div style={{ position: "absolute", bottom: "5%",
                                    fontSize: "min(2.5vh, 2.2vw)",
                                    color: accentColor, fontWeight: 600 }}>
                      — {companyName.toUpperCase() || "STUDIO"}
                    </div>
                  </div>
                </>
              )}
              {layout === "bold" && (
                <div style={{
                  position: "absolute", inset: 0, padding: "5%",
                  color: "#fff",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}>
                  <div style={{ fontSize: "min(7vh, 6vw)", fontWeight: 900,
                                  textTransform: "uppercase", lineHeight: 1.1 }}>
                    {(cta || title || "Hook!").toUpperCase()}
                  </div>
                  <div style={{ fontSize: "min(2.8vh, 2.4vw)", maxWidth: "80%" }}>
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
                    color: textColor, fontSize: "min(4.5vh, 4vw)", fontWeight: 800,
                    lineHeight: 1.1,
                  }}>
                    {title || "Tittel"}
                  </div>
                  {cta && (
                    <div style={{ position: "absolute", left: "55%", bottom: "8%",
                                    color: accentColor, fontWeight: 700,
                                    fontSize: "min(2.5vh, 2.2vw)", textTransform: "uppercase" }}>
                      {cta}
                    </div>
                  )}
                </>
              )}
              {layout === "frame" && (
                <>
                  <div style={{
                    position: "absolute", inset: 0, border: `60px solid ${backgroundColor}`,
                  }} />
                  <div style={{
                    position: "absolute", top: "3%", left: "8%", right: "8%",
                    color: textColor, fontSize: "min(5vh, 4.5vw)", fontWeight: 800,
                  }}>
                    {title || "Tittel"}
                  </div>
                  {cta && (
                    <div style={{
                      position: "absolute", bottom: "5%", right: "10%",
                      background: accentColor, color: "#fff",
                      padding: "8px 18px", borderRadius: 999,
                      fontSize: "min(3vh, 2.5vw)", fontWeight: 700,
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
                    height: 8, background: accentColor,
                  }} />
                  <div style={{
                    position: "absolute", left: "5%", right: "5%", bottom: "10%",
                    color: "#fff",
                  }}>
                    <div style={{ fontSize: "min(6.5vh, 6vw)", fontWeight: 800,
                                    lineHeight: 1.1 }}>
                      {title || "Tittel"}
                    </div>
                  </div>
                  <div style={{
                    position: "absolute", top: "5%", left: "5%",
                    color: accentColor, fontSize: "min(2.2vh, 2vw)",
                    fontWeight: 700, textTransform: "uppercase",
                  }}>
                    {companyName || "Studio"}
                  </div>
                </>
              )}
            </div>
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
            {generating ? "Genererer 6 …" : "✨ Generer 6 kandidater"}
          </button>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6,
                          textAlign: "center" }}>
            Lager design med alle 6 layout-templates + samplede frames
          </div>
        </div>
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
