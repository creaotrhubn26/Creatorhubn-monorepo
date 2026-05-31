/**
 * PhotoshopTemplateDialog — render a `.psd` template by filling its
 * `{{key}}`-named layers with values from a form, then exporting the
 * result. The template itself is opened, mutated in-memory, exported,
 * and closed without saving — the original .psd stays untouched on disk.
 *
 * Field discovery: text-layers become string inputs, smart-object layers
 * become file pickers. Other layer kinds are surfaced as "unsupported"
 * so the user sees what is being skipped.
 */

import { useEffect, useState } from "react";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  getStatus,
  onStatus,
  photoshop,
  type ExportFormat,
  type PhotoshopBridgeStatus,
  type TemplateField,
  type TemplateRenderResult,
} from "../services/photoshopBridgeService";

interface Props {
  onClose: () => void;
}

const FORMATS: ExportFormat[] = ["jpg", "png", "psd", "tiff"];

export function PhotoshopTemplateDialog({ onClose }: Props) {
  const [status, setStatus] = useState<PhotoshopBridgeStatus | null>(null);
  const [templatePath, setTemplatePath] = useState("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [outputPath, setOutputPath] = useState("");
  const [format, setFormat] = useState<ExportFormat>("jpg");
  const [quality, setQuality] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TemplateRenderResult | null>(null);

  useEffect(() => {
    let mounted = true;
    getStatus()
      .then((s) => mounted && setStatus(s))
      .catch(() => {});
    const off = onStatus((s) => mounted && setStatus(s));
    return () => {
      mounted = false;
      off.then((fn) => fn());
    };
  }, []);

  async function pickTemplate() {
    const picked = await openFileDialog({
      multiple: false,
      filters: [{ name: "Photoshop", extensions: ["psd", "psb"] }],
    });
    if (typeof picked === "string") {
      setTemplatePath(picked);
      setFields([]);
      setValues({});
      setLastResult(null);
    }
  }

  async function scan() {
    if (!templatePath) return;
    setBusy(true);
    setError(null);
    setLastResult(null);
    try {
      const r = await photoshop.scanTemplate(templatePath);
      setFields(r.fields);
      // Reset values, preserving anything already typed for keys still present
      setValues((prev) => {
        const next: Record<string, string> = {};
        for (const f of r.fields) next[f.key] = prev[f.key] ?? "";
        return next;
      });
      if (r.fields.length === 0) {
        setError(
          'Ingen `{{key}}`-felter funnet i template. Gi text- eller smart-object-layers navn på formen `{{title}}`.',
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickValueFile(key: string) {
    const picked = await openFileDialog({ multiple: false });
    if (typeof picked === "string") {
      setValues((v) => ({ ...v, [key]: picked }));
    }
  }

  async function pickOutput() {
    const ext = format === "jpeg" ? "jpg" : format;
    const picked = await saveFileDialog({
      defaultPath: `render.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (typeof picked === "string") setOutputPath(picked);
  }

  async function render() {
    if (!templatePath || !outputPath) return;
    setBusy(true);
    setError(null);
    setLastResult(null);
    try {
      const r = await photoshop.renderTemplate({
        template_path: templatePath,
        data: values,
        output_path: outputPath,
        format,
        quality,
      });
      setLastResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const connected = !!status?.connected;
  const supportedFields = fields.filter((f) => f.type !== "unsupported");
  const unsupportedFields = fields.filter((f) => f.type === "unsupported");
  const canRender =
    connected && !busy && templatePath && outputPath && supportedFields.length > 0;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Photoshop Templates</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Fyll <code>{"{{key}}"}</code>-felter i en .psd og eksporter
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={statusBar}>
          <span
            style={{
              ...dot,
              background: connected ? "#3fb950" : "#f85149",
              boxShadow: connected ? "0 0 6px #3fb95080" : "none",
            }}
          />
          <div style={{ fontSize: 12, color: connected ? "#ddd" : "#aaa" }}>
            {connected ? "Photoshop tilkoblet" : "Plugin ikke tilkoblet"}
          </div>
        </div>

        <div style={body}>
          <section style={card}>
            <h3 style={cardTitle}>1 · Velg template</h3>
            <div style={row}>
              <input
                style={input}
                placeholder="/sti/til/template.psd"
                value={templatePath}
                onChange={(e) => setTemplatePath(e.target.value)}
              />
              <button style={secondaryBtn} onClick={pickTemplate} disabled={busy}>
                Bla…
              </button>
              <button
                style={primaryBtn}
                disabled={busy || !connected || !templatePath}
                onClick={scan}
              >
                Skann
              </button>
            </div>
          </section>

          {supportedFields.length > 0 && (
            <section style={card}>
              <h3 style={cardTitle}>
                2 · Fyll felter ({supportedFields.length})
              </h3>
              {supportedFields.map((f) => (
                <div key={f.key} style={row}>
                  <label style={labelStyle}>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: "#9aa" }}>
                      {f.key}
                    </span>
                    <span style={{ fontSize: 10, color: "#666", marginLeft: 6 }}>
                      {f.type}
                    </span>
                  </label>
                  <input
                    style={input}
                    placeholder={
                      f.type === "image" ? "/sti/til/bilde" : "tekst…"
                    }
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                  {f.type === "image" && (
                    <button
                      style={secondaryBtn}
                      onClick={() => pickValueFile(f.key)}
                      disabled={busy}
                    >
                      Bla…
                    </button>
                  )}
                </div>
              ))}
              {unsupportedFields.length > 0 && (
                <div style={warningBox}>
                  Disse {unsupportedFields.length} feltene har en layer-type vi ikke
                  støtter (gjør text-layer eller smart object):
                  <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                    {unsupportedFields.map((f) => (
                      <li key={f.key} style={{ fontFamily: "ui-monospace, monospace" }}>
                        {f.key}{" "}
                        <span style={{ color: "#666" }}>({f.kind})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {supportedFields.length > 0 && (
            <section style={card}>
              <h3 style={cardTitle}>3 · Eksport</h3>
              <div style={row}>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  style={select}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f.toUpperCase()}
                    </option>
                  ))}
                </select>
                {(format === "jpg" || format === "jpeg") && (
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    style={{ ...input, width: 70, flex: "0 0 70px" }}
                  />
                )}
                <input
                  style={input}
                  placeholder="/sti/til/output"
                  value={outputPath}
                  onChange={(e) => setOutputPath(e.target.value)}
                />
                <button style={secondaryBtn} onClick={pickOutput} disabled={busy}>
                  Bla…
                </button>
                <button style={primaryBtn} disabled={!canRender} onClick={render}>
                  {busy ? "Rendrer…" : "Render"}
                </button>
              </div>
            </section>
          )}

          {error && <div style={errorBox}>{error}</div>}

          {lastResult && (
            <section style={{ ...card, borderLeft: "3px solid #3fb950" }}>
              <h3 style={cardTitle}>Ferdig</h3>
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                Skrevet til{" "}
                <code style={{ color: "#9aa" }}>{lastResult.output_path}</code>
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                Brukt {lastResult.applied.length} felter
                {lastResult.skipped.length > 0 && (
                  <>
                    , hoppet over {lastResult.skipped.length}:{" "}
                    {lastResult.skipped
                      .map((s) => `${s.key} (${s.reason})`)
                      .join(", ")}
                  </>
                )}
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
  width: "min(720px, 95vw)",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  color: "#ddd",
  fontSize: 12,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
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

const statusBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 18px",
  background: "#181818",
  borderBottom: "1px solid #2a2a2a",
};

const dot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const body: React.CSSProperties = { padding: 16, overflowY: "auto", flex: 1 };

const card: React.CSSProperties = {
  background: "#242424",
  borderRadius: 6,
  padding: 12,
  marginBottom: 10,
};

const cardTitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  fontWeight: 600,
  color: "#bbb",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  marginBottom: 6,
};

const labelStyle: React.CSSProperties = {
  flex: "0 0 130px",
  fontSize: 11,
  display: "flex",
  alignItems: "baseline",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "inherit",
};

const select: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 12,
  flex: "0 0 80px",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "5px 12px",
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
  padding: "5px 12px",
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};

const warningBox: React.CSSProperties = {
  background: "rgba(245,158,11,0.08)",
  border: "1px solid rgba(245,158,11,0.3)",
  color: "#f59e0b",
  borderRadius: 4,
  padding: "6px 10px",
  fontSize: 11,
  marginTop: 8,
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  marginBottom: 10,
};
