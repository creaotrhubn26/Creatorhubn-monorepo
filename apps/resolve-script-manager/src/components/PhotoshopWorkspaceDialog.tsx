/**
 * PhotoshopWorkspaceDialog — innebygd "Workspace" inni Post Agent med
 * live preview av aktivt Photoshop-dokument.
 *
 * Viser:
 *   - Thumbnail-preview (auto-refresh 5s + manuell refresh)
 *   - Layer-list (flat tree fra doc.listLayers)
 *   - Selection-info-badge
 *   - Aspect-ratio + dimensjoner
 *   - Hurtigknapper: Firefly, Multi-aspect, Send til Resolve
 *
 * Bruker eksisterende plugin-kommandoer — ingen nye plugin-endringer.
 * Pull-modell (interval-poll) heller enn push-events for å holde
 * scopen rimelig i V1.
 */

import { useEffect, useRef, useState } from "react";
import {
  photoshop,
  type AppInfo,
  type LayerListResult,
  type SelectionInfoResult,
  type ThumbnailResult,
} from "../services/photoshopBridgeService";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import OutboundIcon from "@mui/icons-material/Outbound";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenFireflyPrompt?: () => void;
}

const POLL_INTERVAL_MS = 5000;

export function PhotoshopWorkspaceDialog({ open, onClose, onOpenFireflyPrompt }: Props) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [layers, setLayers] = useState<LayerListResult | null>(null);
  const [selection, setSelection] = useState<SelectionInfoResult | null>(null);
  const [thumbnail, setThumbnail] = useState<ThumbnailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [i, l, s, t] = await Promise.all([
        photoshop.appInfo(),
        photoshop.listLayers().catch(() => null),
        photoshop.selectionInfo().catch(() => null),
        photoshop.captureThumbnail(512).catch(() => null),
      ]);
      setInfo(i);
      setLayers(l);
      setSelection(s);
      setThumbnail(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void refresh();
    if (!autoRefresh) {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRefresh]);

  if (!open) return null;

  const doc = info?.active_document;
  const aspect = doc ? formatAspect(doc.width, doc.height) : "—";

  return (
    <div style={backdrop} data-testid="photoshop-workspace-dialog">
      <div style={dialog}>
        <header style={dialogHeader}>
          <div style={dialogTitle}>
            <AspectRatioIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
            <span>Photoshop Workspace</span>
            {doc && (
              <span style={docNameBadge} data-testid="ws-doc-name">
                {doc.name} · {doc.width}×{doc.height} · {aspect}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={refreshBtn}
              onClick={() => setAutoRefresh((v) => !v)}
              data-testid="ws-toggle-auto"
              data-active={autoRefresh}
              title="Auto-refresh hver 5. sekund"
            >
              {autoRefresh ? "AUTO" : "MANUELL"}
            </button>
            <button
              style={refreshBtn}
              onClick={() => void refresh()}
              disabled={loading}
              data-testid="ws-refresh"
            >
              <RefreshIcon sx={{ fontSize: 14 }} />
              {loading ? "…" : "Refresh"}
            </button>
            <button style={closeBtn} onClick={onClose} data-testid="ws-close" aria-label="Lukk">
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </header>

        <div style={body}>
          {error && (
            <div style={errorBox} data-testid="ws-error">
              {error}
            </div>
          )}

          {!info && !loading && (
            <div style={emptyState}>
              Ingen tilkobling til Photoshop. Sjekk at plugin er sideloaded i UDT.
            </div>
          )}

          {info && !doc && (
            <div style={emptyState}>
              Ingen aktivt dokument i Photoshop. Åpne en fil eller bruk doc.open.
            </div>
          )}

          {doc && (
            <div style={twoCol}>
              {/* Preview-kolonne */}
              <div style={previewCol} data-testid="ws-preview-col">
                {thumbnail && thumbnail.base64 ? (
                  <img
                    src={`data:${thumbnail.mime_type};base64,${thumbnail.base64}`}
                    alt={`Preview av ${doc.name}`}
                    style={thumbImg}
                    data-testid="ws-thumbnail"
                  />
                ) : (
                  <div style={thumbPlaceholder}>Ingen preview</div>
                )}
                {selection && selection.exists && (
                  <div style={selectionBadge} data-testid="ws-selection-badge">
                    Selection {selection.width}×{selection.height} ({selection.coverage_pct}%)
                  </div>
                )}
              </div>

              {/* Info-kolonne */}
              <div style={infoCol}>
                <div style={sectionHeader}>Layers ({layers?.count ?? 0})</div>
                <div style={layerList} data-testid="ws-layers">
                  {(layers?.layers ?? []).map((l, i) => (
                    <div
                      key={i}
                      style={{ ...layerRow, opacity: l.visible ? 1 : 0.5 }}
                      data-testid={`ws-layer-${i}`}
                    >
                      <span style={layerName}>{l.name}</span>
                      <span style={layerKind}>{l.kind}</span>
                    </div>
                  ))}
                  {(!layers || layers.count === 0) && (
                    <div style={emptyHint}>Ingen layers</div>
                  )}
                </div>

                <div style={sectionHeader}>Hurtighandlinger</div>
                <div style={actionGrid}>
                  <button
                    style={actionBtn}
                    onClick={onOpenFireflyPrompt}
                    data-testid="ws-action-firefly"
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                    Firefly Prompt
                  </button>
                  <button
                    style={actionBtn}
                    onClick={async () => {
                      try {
                        await photoshop.resolveExportBack({ format: "png" });
                        await refresh();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      }
                    }}
                    data-testid="ws-action-resolve"
                  >
                    <OutboundIcon sx={{ fontSize: 14 }} />
                    Send til Resolve
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAspect(w: number, h: number): string {
  const standards: Array<[number, number]> = [
    [1, 1], [16, 9], [9, 16], [4, 5], [5, 4], [4, 3], [3, 4], [3, 2], [2, 3], [21, 9],
  ];
  const ratio = w / h;
  for (const [num, den] of standards) {
    if (Math.abs(ratio - num / den) / (num / den) < 0.03) return `${num}:${den}`;
  }
  return ratio.toFixed(2) + ":1";
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3000,
  padding: 20,
};

const dialog: React.CSSProperties = {
  background: "#15151c",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  width: "min(960px, 96vw)",
  maxHeight: "min(90vh, 900px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: "#e5e5ea",
};

const dialogHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #2a2a36",
  background: "#1c1c26",
};

const dialogTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  fontWeight: 600,
};

const docNameBadge: React.CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
  fontFamily: "ui-monospace, monospace",
  background: "#22222e",
  padding: "3px 8px",
  borderRadius: 4,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#9ca3af",
  cursor: "pointer",
  padding: 4,
  display: "inline-flex",
};

const refreshBtn: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 11,
  padding: "5px 10px",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const body: React.CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflowY: "auto",
  flex: 1,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  minHeight: 0,
};

const previewCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: 12,
};

const thumbImg: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: 400,
  objectFit: "contain",
  borderRadius: 4,
};

const thumbPlaceholder: React.CSSProperties = {
  width: "100%",
  height: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#5d5d6f",
  fontSize: 12,
};

const selectionBadge: React.CSSProperties = {
  fontSize: 10,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "2px 8px",
  borderRadius: 6,
  fontWeight: 600,
  letterSpacing: 0.4,
};

const infoCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minHeight: 0,
};

const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  textTransform: "uppercase",
};

const layerList: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 6,
  maxHeight: 240,
  overflowY: "auto",
  padding: 4,
};

const layerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "5px 8px",
  fontSize: 11,
  gap: 10,
};

const layerName: React.CSSProperties = {
  color: "#cbcbd5",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const layerKind: React.CSSProperties = {
  color: "#7b7b8d",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
  flexShrink: 0,
};

const actionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const actionBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  fontSize: 12,
  fontWeight: 600,
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  fontSize: 11.5,
  color: "#fda4af",
  background: "#3f1d1d",
  border: "1px solid #5a2a2a",
  borderRadius: 6,
  padding: "8px 10px",
};

const emptyState: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 13,
};

const emptyHint: React.CSSProperties = {
  padding: "20px 10px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 11,
};
