/**
 * PhotoshopBridgeDialog — dev/test-panel for Post Agent ↔ Photoshop
 * UXP-bridge. Viser live tilkoblings-status og lar deg fyre av hvert
 * v1-kommando manuelt for å verifisere ende-til-ende-broen mot en
 * faktisk Photoshop-instans.
 *
 * Bridge-en eier en lokal WS-server (port 1733) i Tauri-backenden;
 * UXP-pluginen "Post Agent Bridge" kobler seg til som klient.
 */

import { useEffect, useRef, useState } from "react";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  getStatus,
  onEvent,
  onStatus,
  photoshop,
  type ExportFormat,
  type PhotoshopBridgeEvent,
  type PhotoshopBridgeStatus,
} from "../services/photoshopBridgeService";

interface Props {
  onClose: () => void;
}

interface LogRow {
  id: number;
  ts: string;
  label: string;
  ok: boolean;
  detail: string;
}

const FORMATS: ExportFormat[] = ["jpg", "png", "psd", "tiff"];

export function PhotoshopBridgeDialog({ onClose }: Props) {
  const [status, setStatus] = useState<PhotoshopBridgeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const logCounter = useRef(0);

  // Form fields
  const [openPath, setOpenPath] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpg");
  const [exportQuality, setExportQuality] = useState(10);
  const [smartLayerName, setSmartLayerName] = useState("");
  const [smartFilePath, setSmartFilePath] = useState("");
  const [textLayerName, setTextLayerName] = useState("");
  const [textContents, setTextContents] = useState("");
  const [toggleLayerName, setToggleLayerName] = useState("");
  const [toggleVisible, setToggleVisible] = useState(true);

  useEffect(() => {
    let mounted = true;
    getStatus()
      .then((s) => mounted && setStatus(s))
      .catch((err) => append("status", false, String(err)));

    const statusOff = onStatus((s) => mounted && setStatus(s));
    const eventOff = onEvent((evt: PhotoshopBridgeEvent) =>
      append(`event: ${evt.event}`, true, JSON.stringify(evt.data)),
    );
    return () => {
      mounted = false;
      statusOff.then((fn) => fn());
      eventOff.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function append(label: string, ok: boolean, detail: string) {
    logCounter.current += 1;
    const row: LogRow = {
      id: logCounter.current,
      ts: new Date().toLocaleTimeString(),
      label,
      ok,
      detail: detail.length > 600 ? detail.slice(0, 600) + "…" : detail,
    };
    setLog((prev) => [row, ...prev].slice(0, 80));
  }

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(true);
    try {
      const result = await fn();
      append(label, true, JSON.stringify(result));
    } catch (err) {
      append(label, false, String(err));
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(setter: (p: string) => void) {
    const picked = await openFileDialog({ multiple: false });
    if (typeof picked === "string") setter(picked);
  }

  async function pickSavePath() {
    const picked = await saveFileDialog({
      defaultPath: `export.${exportFormat === "jpeg" ? "jpg" : exportFormat}`,
    });
    if (typeof picked === "string") setExportPath(picked);
  }

  const connected = !!status?.connected;
  const dotColor = connected ? "#3fb950" : "#f85149";

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Photoshop Bridge</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Test-panel for UXP-broen
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <section style={statusBar}>
          <span
            style={{
              ...dot,
              background: dotColor,
              boxShadow: connected ? "0 0 6px #3fb95080" : "none",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>
              {connected ? "Tilkoblet" : "Plugin ikke tilkoblet"}
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              {status
                ? `ws://localhost:${status.port}${
                    status.plugin_version
                      ? ` · plugin v${status.plugin_version}`
                      : ""
                  }${
                    status.photoshop_version
                      ? ` · PS ${status.photoshop_version}`
                      : ""
                  }`
                : "Henter status…"}
            </div>
          </div>
          <button
            disabled={busy}
            style={primaryBtn}
            onClick={() => run("ping", () => photoshop.ping())}
          >
            Ping
          </button>
          <button
            disabled={busy || !connected}
            style={secondaryBtn}
            onClick={() => run("app.info", () => photoshop.appInfo())}
          >
            App info
          </button>
        </section>

        <div style={body}>
          <section style={card}>
            <h3 style={cardTitle}>Åpne dokument</h3>
            <div style={row}>
              <input
                style={input}
                placeholder="/sti/til/fil.psd"
                value={openPath}
                onChange={(e) => setOpenPath(e.target.value)}
              />
              <button style={secondaryBtn} onClick={() => pickFile(setOpenPath)}>
                Bla…
              </button>
              <button
                disabled={busy || !connected || !openPath}
                style={primaryBtn}
                onClick={() =>
                  run("doc.open", () => photoshop.openDocument(openPath))
                }
              >
                Åpne
              </button>
            </div>
          </section>

          <section style={card}>
            <h3 style={cardTitle}>Lagre / eksporter</h3>
            <div style={row}>
              <button
                disabled={busy || !connected}
                style={secondaryBtn}
                onClick={() => run("doc.save", () => photoshop.saveDocument())}
              >
                Lagre
              </button>
            </div>
            <div style={row}>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                style={select}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
              {(exportFormat === "jpg" || exportFormat === "jpeg") && (
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={exportQuality}
                  onChange={(e) => setExportQuality(Number(e.target.value))}
                  style={{ ...input, width: 70, flex: "0 0 70px" }}
                />
              )}
              <input
                style={input}
                placeholder="/sti/til/export"
                value={exportPath}
                onChange={(e) => setExportPath(e.target.value)}
              />
              <button style={secondaryBtn} onClick={pickSavePath}>
                Bla…
              </button>
              <button
                disabled={busy || !connected || !exportPath}
                style={primaryBtn}
                onClick={() =>
                  run("doc.export", () =>
                    photoshop.exportDocument({
                      path: exportPath,
                      format: exportFormat,
                      quality: exportQuality,
                    }),
                  )
                }
              >
                Eksporter
              </button>
            </div>
          </section>

          <section style={card}>
            <h3 style={cardTitle}>Smart object replace</h3>
            <div style={row}>
              <input
                style={input}
                placeholder="layer-navn"
                value={smartLayerName}
                onChange={(e) => setSmartLayerName(e.target.value)}
              />
              <input
                style={input}
                placeholder="ny fil-sti"
                value={smartFilePath}
                onChange={(e) => setSmartFilePath(e.target.value)}
              />
              <button
                style={secondaryBtn}
                onClick={() => pickFile(setSmartFilePath)}
              >
                Bla…
              </button>
              <button
                disabled={busy || !connected || !smartLayerName || !smartFilePath}
                style={primaryBtn}
                onClick={() =>
                  run("smartObject.replace", () =>
                    photoshop.replaceSmartObject({
                      layer_name: smartLayerName,
                      file_path: smartFilePath,
                    }),
                  )
                }
              >
                Bytt
              </button>
            </div>
          </section>

          <section style={card}>
            <h3 style={cardTitle}>Sett text-layer innhold</h3>
            <div style={row}>
              <input
                style={input}
                placeholder="layer-navn"
                value={textLayerName}
                onChange={(e) => setTextLayerName(e.target.value)}
              />
              <input
                style={{ ...input, flex: 2 }}
                placeholder="ny tekst"
                value={textContents}
                onChange={(e) => setTextContents(e.target.value)}
              />
              <button
                disabled={busy || !connected || !textLayerName}
                style={primaryBtn}
                onClick={() =>
                  run("text.setContents", () =>
                    photoshop.setTextContents({
                      layer_name: textLayerName,
                      contents: textContents,
                    }),
                  )
                }
              >
                Sett
              </button>
            </div>
          </section>

          <section style={card}>
            <h3 style={cardTitle}>Skru layer av/på</h3>
            <div style={row}>
              <input
                style={input}
                placeholder="layer-navn"
                value={toggleLayerName}
                onChange={(e) => setToggleLayerName(e.target.value)}
              />
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#ddd",
                }}
              >
                <input
                  type="checkbox"
                  checked={toggleVisible}
                  onChange={(e) => setToggleVisible(e.target.checked)}
                />
                synlig
              </label>
              <button
                disabled={busy || !connected || !toggleLayerName}
                style={primaryBtn}
                onClick={() =>
                  run("layer.toggle", () =>
                    photoshop.toggleLayer({
                      layer_name: toggleLayerName,
                      visible: toggleVisible,
                    }),
                  )
                }
              >
                Toggle
              </button>
            </div>
          </section>

          <section style={{ ...card, marginBottom: 0 }}>
            <h3 style={cardTitle}>Log</h3>
            <div style={logBox}>
              {log.length === 0 && (
                <div style={{ color: "#666", fontStyle: "italic" }}>
                  Ingen kall enda. Kjør en kommando over.
                </div>
              )}
              {log.map((r) => (
                <div key={r.id} style={logRow}>
                  <span style={{ color: "#666", marginRight: 8 }}>{r.ts}</span>
                  <span
                    style={{
                      color: r.ok ? "#3fb950" : "#f85149",
                      marginRight: 6,
                    }}
                  >
                    {r.ok ? "✓" : "✗"}
                  </span>
                  <span style={{ color: "#ddd", marginRight: 6 }}>{r.label}</span>
                  <span style={{ color: "#888" }}>{r.detail}</span>
                </div>
              ))}
            </div>
          </section>
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
  width: "min(820px, 95vw)",
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
  padding: "12px 18px",
  background: "#181818",
  borderBottom: "1px solid #2a2a2a",
};

const dot: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  flexShrink: 0,
};

const body: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
  flex: 1,
};

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

const logBox: React.CSSProperties = {
  background: "#141414",
  borderRadius: 4,
  padding: "8px 10px",
  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
  fontSize: 11,
  lineHeight: 1.5,
  maxHeight: 180,
  overflowY: "auto",
};

const logRow: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
