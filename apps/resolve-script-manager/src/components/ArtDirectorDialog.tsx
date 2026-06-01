/**
 * ArtDirectorDialog — Phase 3+4 light av AI-to-editable-PSD-pipelinen.
 *
 * Bruker skriver: "Lag plakat for Vinterforestillingen, mørk stemning"
 * → Claude returnerer en JSON-spec
 * → Vi viser spec'en pent
 * → "Generer alle bilder + bygg PSD"-knapp kjører Phase 2 + Phase 1 i ett
 * → Bruker får ferdig PSD-fil hun kan åpne i Photoshop
 *
 * Hvert ledd er åpent for inspeksjon (spec-JSON, image-paths) så
 * Irlin kan iterere på enkelt-deler uten å starte fra scratch.
 */

import { useCallback, useState } from "react";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  generateTemplateSpec,
  type TemplateSpec,
  type ImageSize,
} from "../agents/templateArtDirector";
import { generateImage, type AiImageResult } from "../services/aiImageService";
import { photoshop } from "../services/photoshopBridgeService";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CircularProgress from "@mui/material/CircularProgress";

interface Props {
  onClose: () => void;
}

type Stage =
  | { kind: "input" }
  | { kind: "asking-claude" }
  | { kind: "question"; question: string }
  | { kind: "spec"; spec: TemplateSpec }
  | { kind: "generating-images"; spec: TemplateSpec; progress: Record<string, "pending" | "done" | "failed"> }
  | { kind: "images-ready"; spec: TemplateSpec; images: Record<string, AiImageResult>; failed: string[] }
  | { kind: "scaffolding"; spec: TemplateSpec; images: Record<string, AiImageResult> }
  | { kind: "done"; spec: TemplateSpec; images: Record<string, AiImageResult>; psd_path: string }
  | { kind: "error"; message: string };

const EXAMPLES = [
  "Lag plakat for vinterforestillingen vår — mørk stemning, fokus på solo-dansere",
  "Audition-flyer for kontemporær produksjon, ungdommelig look, sterke farger",
  "Time-plan-kort til Instagram for neste uke, klassisk ballet-vibb",
];

export function ArtDirectorDialog({ onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "input" });

  const askClaude = useCallback(async (textPrompt: string) => {
    setStage({ kind: "asking-claude" });
    try {
      const r = await generateTemplateSpec(textPrompt);
      if (r.kind === "spec") setStage({ kind: "spec", spec: r.spec });
      else setStage({ kind: "question", question: r.text });
    } catch (e) {
      setStage({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const runFullPipeline = useCallback(async (spec: TemplateSpec) => {
    const imageFields = spec.fields.filter(
      (f) => f.type === "image_placeholder" && f.image_prompt,
    );
    const initialProgress: Record<string, "pending" | "done" | "failed"> = {};
    for (const f of imageFields) initialProgress[f.key] = "pending";
    setStage({ kind: "generating-images", spec, progress: { ...initialProgress } });

    const images: Record<string, AiImageResult> = {};
    const failed: string[] = [];
    const progressCopy = { ...initialProgress };

    for (const f of imageFields) {
      try {
        const r = await generateImage({
          prompt: f.image_prompt!,
          image_size: (f.image_size as ImageSize) ?? "square_hd",
        });
        images[f.key] = r;
        progressCopy[f.key] = "done";
      } catch (e) {
        progressCopy[f.key] = "failed";
        failed.push(f.key);
        console.warn(`Image generation failed for ${f.key}:`, e);
      }
      setStage({ kind: "generating-images", spec, progress: { ...progressCopy } });
    }

    // Be brukeren velge output-path før vi scaffolder
    setStage({ kind: "images-ready", spec, images, failed });
  }, []);

  const scaffoldPsd = useCallback(
    async (spec: TemplateSpec, images: Record<string, AiImageResult>) => {
      const safeName = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const picked = await saveFileDialog({
        defaultPath: `${safeName}.psd`,
        filters: [{ name: "Photoshop", extensions: ["psd"] }],
      });
      if (typeof picked !== "string") return;
      setStage({ kind: "scaffolding", spec, images });
      try {
        await photoshop.scaffoldTemplate({
          output_path: picked,
          spec: {
            name: spec.name,
            width: spec.width,
            height: spec.height,
            background_color: spec.background_color,
            fields: spec.fields.map((f) => ({
              key: f.key,
              type: f.type,
              hint: f.hint,
              x: f.x,
              y: f.y,
              font_size: f.font_size,
              file_path: images[f.key]?.image_path,
            })),
          },
        });
        setStage({ kind: "done", spec, images, psd_path: picked });
      } catch (e) {
        setStage({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [],
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AutoAwesomeIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
              AI Creative Director
            </h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Beskriv hva du vil ha — vi lager en redigerbar PSD med text-layers + AI-genererte bilder
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={body}>
          {(stage.kind === "input" || stage.kind === "question" || stage.kind === "error") && (
            <section style={card}>
              <label style={fieldLabel}>Hva vil du lage?</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Lag plakat for forestillingen vår…"
                rows={3}
                style={textarea}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    style={chipBtn}
                  >
                    {ex.slice(0, 60)}…
                  </button>
                ))}
              </div>
              {stage.kind === "question" && (
                <div style={questionBox}>
                  <strong>Claude spør:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{stage.question}</div>
                </div>
              )}
              {stage.kind === "error" && (
                <div style={errorBox}>
                  <strong>Feil:</strong> {stage.message}
                </div>
              )}
              <button
                onClick={() => askClaude(prompt.trim())}
                disabled={!prompt.trim()}
                style={{ ...primaryBtn, marginTop: 12 }}
              >
                <RocketLaunchIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom" }} />
                Generer spec
              </button>
            </section>
          )}

          {stage.kind === "asking-claude" && (
            <section style={progressCard}>
              <CircularProgress size={20} sx={{ color: "#a78bfa" }} />
              <div>Claude tenker som art director…</div>
            </section>
          )}

          {(stage.kind === "spec" ||
            stage.kind === "generating-images" ||
            stage.kind === "images-ready" ||
            stage.kind === "scaffolding" ||
            stage.kind === "done") && (
            <>
              <section style={card}>
                <h3 style={cardTitle}>1 · Spec generert</h3>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{stage.spec.name}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 10, fontStyle: "italic" }}>
                  {stage.spec.rationale}
                </div>
                <div style={metaGrid}>
                  <div><strong>{stage.spec.width}×{stage.spec.height}</strong></div>
                  <div style={paletteRow}>
                    {[stage.spec.palette.primary, stage.spec.palette.secondary, stage.spec.palette.accent].map((c, i) => (
                      <span key={i} style={{ ...swatchStyle, background: c }} title={c} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {stage.spec.fonts.heading} / {stage.spec.fonts.body}
                  </div>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 11, color: "#888" }}>
                    Se {stage.spec.fields.length} felter (text + bilder)
                  </summary>
                  <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18, fontSize: 11, fontFamily: "ui-monospace, monospace", lineHeight: 1.6 }}>
                    {stage.spec.fields.map((f) => (
                      <li key={f.key} style={{ color: "#bbb" }}>
                        {`{{${f.key}}}`} <span style={{ color: "#666" }}>({f.type})</span>
                        {f.type === "text" && f.hint && <span style={{ color: "#888" }}> — "{f.hint}"</span>}
                        {f.type === "image_placeholder" && f.image_prompt && (
                          <div style={{ color: "#888", marginLeft: 12, fontSize: 10.5 }}>
                            prompt: {f.image_prompt.slice(0, 90)}…
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </section>

              {stage.kind === "spec" && (
                <button
                  onClick={() => void runFullPipeline(stage.spec)}
                  style={{ ...primaryBtn, width: "100%", padding: "12px" }}
                >
                  <RocketLaunchIcon sx={{ fontSize: 16, marginRight: 6, verticalAlign: "text-bottom" }} />
                  Generer alle bilder + bygg PSD
                </button>
              )}

              {(stage.kind === "generating-images" ||
                stage.kind === "images-ready" ||
                stage.kind === "scaffolding" ||
                stage.kind === "done") && (
                <section style={card}>
                  <h3 style={cardTitle}>
                    2 · AI-genererte bilder
                  </h3>
                  {(() => {
                    const progress =
                      stage.kind === "generating-images"
                        ? stage.progress
                        : Object.fromEntries(
                            stage.spec.fields
                              .filter((f) => f.type === "image_placeholder")
                              .map((f) => [
                                f.key,
                                stage.kind === "scaffolding" ||
                                stage.kind === "done" ||
                                (stage.kind === "images-ready" && stage.images[f.key])
                                  ? "done"
                                  : "failed",
                              ]),
                          );
                    return (
                      <div style={imageGrid}>
                        {Object.entries(progress).map(([key, status]) => {
                          const img =
                            (stage.kind === "images-ready" ||
                              stage.kind === "scaffolding" ||
                              stage.kind === "done") &&
                            stage.images[key];
                          return (
                            <div key={key} style={imageTile}>
                              {img && img.image_path ? (
                                <img
                                  src={convertFileSrc(img.image_path)}
                                  alt={key}
                                  style={imageThumb}
                                />
                              ) : (
                                <div style={imagePlaceholder}>
                                  {status === "pending" && <CircularProgress size={16} sx={{ color: "#a78bfa" }} />}
                                  {status === "failed" && <span style={{ color: "#f85149" }}>!</span>}
                                </div>
                              )}
                              <div style={imageKey}>{`{{${key}}}`}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </section>
              )}

              {stage.kind === "images-ready" && (
                <button
                  onClick={() => void scaffoldPsd(stage.spec, stage.images)}
                  style={{ ...primaryBtn, width: "100%", padding: "12px" }}
                >
                  Velg hvor PSD-en skal lagres + bygg
                </button>
              )}

              {stage.kind === "scaffolding" && (
                <section style={progressCard}>
                  <CircularProgress size={20} sx={{ color: "#a78bfa" }} />
                  <div>Bygger PSD i Photoshop…</div>
                </section>
              )}

              {stage.kind === "done" && (
                <section style={{ ...card, borderLeft: "3px solid #3fb950" }}>
                  <h3 style={cardTitle}>
                    <CheckCircleOutlinedIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom", color: "#3fb950" }} />
                    Ferdig
                  </h3>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                    Lagret som <code style={{ color: "#aaa" }}>{stage.psd_path}</code>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
                    Hver layer er navngitt med <code>{"{{key}}"}</code>. Åpne i Photoshop og rediger
                    fritt — tekstene, smart-objects (du kan bytte AI-bildene til egne), farger osv.
                  </div>
                  <button
                    onClick={() => void openPath(stage.psd_path).catch(() => {})}
                    style={secondaryBtn}
                  >
                    <OpenInNewIcon sx={{ fontSize: 12, marginRight: 4, verticalAlign: "text-bottom" }} />
                    Åpne i Photoshop
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modal: React.CSSProperties = {
  background: "#1f1f1f",
  borderRadius: 8,
  width: "min(720px, 96vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  color: "#ddd",
  fontSize: 12,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #2a2a2a",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#888",
  fontSize: 18,
  cursor: "pointer",
  padding: 4,
};

const body: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
  flex: 1,
};

const card: React.CSSProperties = {
  background: "#242424",
  borderRadius: 6,
  padding: 14,
  marginBottom: 10,
};

const cardTitle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#bbb",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#bbb",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 6,
};

const textarea: React.CSSProperties = {
  width: "100%",
  resize: "vertical",
  minHeight: 70,
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const chipBtn: React.CSSProperties = {
  background: "#181818",
  border: "1px solid #2a2a2a",
  color: "#999",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 10.5,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  color: "white",
  border: 0,
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  color: "#ddd",
  border: "1px solid #3a3a3a",
  borderRadius: 4,
  padding: "6px 12px",
  fontSize: 11,
  cursor: "pointer",
};

const progressCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#181818",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  padding: 14,
  marginBottom: 10,
  fontSize: 12,
  color: "#aaa",
};

const metaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 12,
  fontSize: 12,
  color: "#bbb",
};

const paletteRow: React.CSSProperties = {
  display: "flex",
  gap: 4,
};

const swatchStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.1)",
};

const imageGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 8,
};

const imageTile: React.CSSProperties = {
  background: "#181818",
  borderRadius: 4,
  overflow: "hidden",
};

const imageThumb: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover",
  display: "block",
};

const imagePlaceholder: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  background: "#141414",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const imageKey: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
  color: "#888",
  padding: "4px 6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const questionBox: React.CSSProperties = {
  background: "rgba(167,139,250,0.10)",
  border: "1px solid rgba(167,139,250,0.30)",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 12,
  marginTop: 10,
  color: "#d8c8ff",
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  marginTop: 10,
};
