/**
 * AiImageDialog — generer et bilde fra et prompt via Flux 1.1 Pro.
 * Phase 2-MVP av AI Creative Director-pipelinen: la Irlin teste
 * image-generation isolert før vi wirer det inn i full e2e-flow.
 *
 * Bildet lagres automatisk til Library/.../generated-images/ og kan
 * brukes som smart-object i template.scaffold.
 */

import { useCallback, useState } from "react";
import {
  generateImage,
  type AiImageResult,
  type AiImageSize,
} from "../services/aiImageService";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";

interface Props {
  onClose: () => void;
}

const SIZES: { value: AiImageSize; label: string }[] = [
  { value: "square_hd", label: "Square HD (1024×1024)" },
  { value: "portrait_16_9", label: "Portrait 9:16" },
  { value: "landscape_16_9", label: "Landscape 16:9" },
  { value: "portrait_4_3", label: "Portrait 3:4" },
  { value: "landscape_4_3", label: "Landscape 4:3" },
];

const PROMPT_EXAMPLES = [
  "Dramatisk kontemporær danser i blå spotlight, svart bakgrunn, fotojournalistisk stil",
  "Ballerina silhuett i daggry, gylden bakgrunn, varmt naturlig lys",
  "Hip hop-danser i bevegelse, urban gatebakgrunn, energetisk og rå",
  "Studio-portrett av jazz-danser, minimalistisk, hvit bakgrunn, redaksjonell stil",
];

export function AiImageDialog({ onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<AiImageSize>("square_hd");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiImageResult | null>(null);
  const [history, setHistory] = useState<AiImageResult[]>([]);

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await generateImage({ prompt: prompt.trim(), image_size: size });
      setResult(r);
      setHistory((prev) => [r, ...prev].slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [prompt, size]);

  const copyPath = useCallback((path: string) => {
    void navigator.clipboard.writeText(path);
  }, []);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AutoAwesomeIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
              AI image generation
            </h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Flux 1.1 Pro via Role Room — bildet lagres lokalt og kan brukes som smart-object
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={body}>
          <section style={card}>
            <label style={fieldLabel}>Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Beskriv bildet du vil ha…"
              rows={3}
              style={textarea}
              disabled={busy}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {PROMPT_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  style={chipBtn}
                  disabled={busy}
                >
                  {ex.slice(0, 60)}…
                </button>
              ))}
            </div>

            <div style={{ ...row, marginTop: 12 }}>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as AiImageSize)}
                style={select}
                disabled={busy}
              >
                {SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                onClick={run}
                disabled={busy || !prompt.trim()}
                style={primaryBtn}
              >
                <RocketLaunchIcon sx={{ fontSize: 14, marginRight: "6px", verticalAlign: "text-bottom" }} />
                {busy ? "Genererer…" : "Generer bilde"}
              </button>
            </div>
          </section>

          {error && (
            <div style={errorBox}>
              <strong>Feil:</strong> {error}
              {error.includes("not_configured") && (
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  Backend mangler <code>FAL_KEY</code>-env-var. Sett den på Render og restart.
                </div>
              )}
            </div>
          )}

          {result && (
            <section style={{ ...card, borderLeft: "3px solid #3fb950" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <img
                  src={convertFileSrc(result.image_path)}
                  alt="Generert"
                  style={resultImg}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    ✓ Bilde generert
                  </div>
                  <div style={resultMeta}>
                    {result.width}×{result.height} · {result.model}
                    {result.seed != null && ` · seed=${result.seed}`}
                  </div>
                  <div style={pathBox}>
                    <code style={pathCode}>{result.image_path}</code>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => copyPath(result.image_path)}
                      style={secondaryBtn}
                    >
                      <ContentCopyIcon sx={{ fontSize: 12, marginRight: "4px", verticalAlign: "text-bottom" }} />
                      Kopier sti
                    </button>
                    <button
                      onClick={() => void openPath(result.image_path).catch(() => {})}
                      style={secondaryBtn}
                    >
                      <OpenInNewIcon sx={{ fontSize: 12, marginRight: "4px", verticalAlign: "text-bottom" }} />
                      Åpne
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 8, lineHeight: 1.5 }}>
                    <strong>Neste:</strong> Bruk stien som <code>file_path</code> i{" "}
                    <code>image_placeholder</code>-felt når du kaller{" "}
                    <code>template.scaffold</code> for å embedde bildet som
                    smart-object.
                  </div>
                </div>
              </div>
            </section>
          )}

          {history.length > 1 && (
            <section style={card}>
              <h3 style={cardTitle}>Tidligere genererte ({history.length - 1})</h3>
              <div style={historyGrid}>
                {history.slice(1).map((h, i) => (
                  <img
                    key={i}
                    src={convertFileSrc(h.image_path)}
                    alt={`Tidligere ${i}`}
                    style={historyTile}
                    onClick={() => setResult(h)}
                    title={h.image_path}
                  />
                ))}
              </div>
            </section>
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

const row: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const select: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 12,
  flex: 1,
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "8px 18px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
};

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  color: "#ddd",
  border: "1px solid #3a3a3a",
  borderRadius: 4,
  padding: "5px 10px",
  fontSize: 11,
  cursor: "pointer",
};

const resultImg: React.CSSProperties = {
  width: 160,
  height: 160,
  objectFit: "cover",
  borderRadius: 6,
  background: "#141414",
};

const resultMeta: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  marginBottom: 6,
  fontFamily: "ui-monospace, monospace",
};

const pathBox: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 4,
  padding: "4px 8px",
};

const pathCode: React.CSSProperties = {
  fontSize: 10.5,
  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
  color: "#aaa",
  wordBreak: "break-all",
};

const historyGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
  gap: 6,
};

const historyTile: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover",
  borderRadius: 4,
  cursor: "pointer",
  border: "1px solid transparent",
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 12,
  marginBottom: 10,
};
