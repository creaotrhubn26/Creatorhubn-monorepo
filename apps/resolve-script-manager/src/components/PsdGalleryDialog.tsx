/**
 * PsdGalleryDialog — visuelt galleri over alle .psd/.psb-filer i en
 * valgt mappe. Genererer thumbnails fra PSD-binær via Rust-side
 * (psd-crate) UTEN å åpne Photoshop, så det fungerer selv om
 * Photoshop ikke er installert.
 *
 * Klikk på en entry for å åpne fila i sin assosierte app (Photoshop).
 */

import { useCallback, useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { indexDirectory, type PsdEntry } from "../services/psdIndexerService";

interface Props {
  onClose: () => void;
}

export function PsdGalleryDialog({ onClose }: Props) {
  const [dir, setDir] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [entries, setEntries] = useState<PsdEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickDir = useCallback(async () => {
    const picked = await openFileDialog({ directory: true, multiple: false });
    if (typeof picked === "string") setDir(picked);
  }, []);

  const scan = useCallback(async () => {
    if (!dir) return;
    setBusy(true);
    setError(null);
    setEntries([]);
    try {
      const r = await indexDirectory(dir, recursive ? 6 : 1);
      setEntries(r);
      if (r.length === 0) {
        setError(`Ingen .psd/.psb-filer funnet i ${dir}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [dir, recursive]);

  // Auto-scan ved valg av mappe
  useEffect(() => {
    if (dir) void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, recursive]);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>PSD-galleri</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Thumbnails fra .psd/.psb uten å åpne Photoshop
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={controlBar}>
          <input
            style={input}
            placeholder="/sti/til/mappe"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
          />
          <button style={secondaryBtn} onClick={pickDir} disabled={busy}>
            Bla…
          </button>
          <label style={checkbox}>
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
            />
            Inkluder sub-mapper
          </label>
          <button style={primaryBtn} onClick={scan} disabled={busy || !dir}>
            {busy ? "Skanner…" : "Skann"}
          </button>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={gridArea}>
          {entries.length === 0 && !busy && !error && (
            <div style={emptyState}>
              Velg en mappe over for å se thumbnails av PSD-filene i den.
            </div>
          )}
          <div style={grid}>
            {entries.map((entry) => (
              <div
                key={entry.path}
                style={tile}
                onClick={() => void openPath(entry.path).catch(console.warn)}
                title={`${entry.path}\n${entry.layer_count} layers · ${(entry.file_size / 1024 / 1024).toFixed(1)} MB`}
              >
                <div style={thumbBox}>
                  {entry.thumbnail_b64 ? (
                    <img
                      src={`data:image/png;base64,${entry.thumbnail_b64}`}
                      alt={entry.name}
                      style={thumbImg}
                    />
                  ) : (
                    <div style={thumbPlaceholder}>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>PSD</div>
                      {entry.error && (
                        <div style={{ fontSize: 9, color: "#f85149", marginTop: 4 }}>
                          {entry.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={tileLabel}>
                  <div style={tileName}>{entry.name}</div>
                  <div style={tileMeta}>
                    {entry.width}×{entry.height} · {entry.layer_count}L
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {entries.length > 0 && (
          <footer style={footerBar}>
            {entries.length} fil{entries.length === 1 ? "" : "er"} ·{" "}
            {entries.filter((e) => e.thumbnail_b64).length} med thumbnail ·{" "}
            klikk på en for å åpne i Photoshop
          </footer>
        )}
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
  width: "min(900px, 96vw)",
  maxHeight: "92vh",
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

const controlBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "12px 18px",
  borderBottom: "1px solid #2a2a2a",
  background: "#181818",
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
};

const checkbox: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  color: "#aaa",
  whiteSpace: "nowrap",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "5px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  color: "#ddd",
  border: "1px solid #3a3a3a",
  borderRadius: 4,
  padding: "5px 12px",
  fontSize: 12,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  margin: "10px 18px 0",
};

const gridArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
};

const emptyState: React.CSSProperties = {
  textAlign: "center",
  color: "#666",
  fontStyle: "italic",
  padding: "40px 20px",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
};

const tile: React.CSSProperties = {
  background: "#242424",
  borderRadius: 6,
  overflow: "hidden",
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "border-color 0.1s",
};

const thumbBox: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  background: "#141414",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const thumbImg: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
  display: "block",
};

const thumbPlaceholder: React.CSSProperties = {
  color: "#555",
  textAlign: "center",
  padding: 8,
};

const tileLabel: React.CSSProperties = {
  padding: "8px 10px",
};

const tileName: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tileMeta: React.CSSProperties = {
  fontSize: 10,
  color: "#888",
  marginTop: 2,
};

const footerBar: React.CSSProperties = {
  padding: "10px 18px",
  borderTop: "1px solid #2a2a2a",
  background: "#181818",
  fontSize: 11,
  color: "#888",
};
