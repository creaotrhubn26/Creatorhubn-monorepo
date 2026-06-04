/**
 * MultiAgentDirectorDialog — modal-wrapper rundt DirectorPanel.
 *
 * Logikken (Claude tool-use-loop, presets, progress-rendering) bor i
 * DirectorPanel + useDirectorLoop. Denne komponenten holder kun
 * backdrop, header og close-knapp så den kan åpnes fra App-shellen.
 *
 * Embedded variant (CreativeEditorView) bruker DirectorPanel direkte
 * uten modal-wrapping.
 */

import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { DirectorPanel } from "./DirectorPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MultiAgentDirectorDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div style={backdrop} data-testid="multi-agent-director-dialog">
      <div style={dialog}>
        <header style={dialogHeader}>
          <div style={dialogTitle}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
            <span>Multi-Agent Creative Director</span>
            <span style={betaBadge}>BETA</span>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Lukk" data-testid="mad-close">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </header>

        <div style={body}>
          <DirectorPanel />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// modal-shell styles
// ──────────────────────────────────────────────────────────────

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
  width: "min(720px, 96vw)",
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
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
};

const betaBadge: React.CSSProperties = {
  fontSize: 9,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "1px 6px",
  borderRadius: 6,
  fontWeight: 600,
  letterSpacing: 0.4,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#9ca3af",
  cursor: "pointer",
  padding: 4,
  display: "inline-flex",
};

const body: React.CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflowY: "auto",
  flex: 1,
};
