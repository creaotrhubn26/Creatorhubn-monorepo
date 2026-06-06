/**
 * ResolveIntellisearchPanel — viser Resolve 21 AI IntelliSearch-
 * resultater som ekstra context for Story Director. Lar Wedding-agent
 * referere til ekte face/object-data fra Resolve i stedet for kun
 * syntetiske signals.
 *
 * Tilstander:
 *   • Loading — henter data via plugin-broen
 *   • Ingen analyse — CTA for å kjøre analyze-intellisearch.lua i Resolve
 *   • Treff — viser N klipp med metadata, "siden analysert" + refresh
 *   • Feil — feilmelding + retry
 */

import { useResolveIntellisearch } from "../../hooks/useResolveIntellisearch";
import RefreshIcon from "@mui/icons-material/Refresh";
import FaceIcon from "@mui/icons-material/Face";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";

interface Props {
  /** Filtrer items på clip-navn (case-insensitive substring). */
  clipNameFilter?: string;
  /** Hent automatisk ved mount. Default true. */
  autoFetch?: boolean;
}

export function ResolveIntellisearchPanel({ clipNameFilter, autoFetch = true }: Props) {
  const { data, loading, error, refresh } = useResolveIntellisearch({
    clipNameFilter,
    autoFetch,
  });

  return (
    <section style={panel} data-testid="resolve-intellisearch-panel">
      <header style={panelHeader}>
        <div style={titleRow}>
          <FaceIcon sx={{ fontSize: 16, color: "#a78bfa" }} />
          <span style={panelTitle}>Resolve AI IntelliSearch</span>
          <span style={betaBadge}>RESOLVE 21</span>
        </div>
        <button
          style={refreshBtn}
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="resolve-is-refresh"
          title="Hent siste analyse fra Resolve"
        >
          <RefreshIcon sx={{ fontSize: 14 }} />
          {loading ? "…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div style={errorBox} data-testid="resolve-is-error">
          <WarningAmberIcon sx={{ fontSize: 14, marginRight: "6px", verticalAlign: "text-bottom" }} />
          {error}
        </div>
      )}

      {!error && data && !data.found && (
        <div style={emptyBox} data-testid="resolve-is-empty">
          <div style={emptyTitle}>Ingen analyse enda</div>
          <div style={emptyHint}>
            {data.hint || "Kjør analyze-intellisearch.lua i Resolve for å trekke ut face- og object-data per klipp."}
          </div>
          <ol style={steps}>
            <li>Resolve → Preferences → AI → IntelliSearch: last ned modellene</li>
            <li>Resolve → Workspace → Scripts → Edit → analyze-intellisearch</li>
            <li>Klikk Refresh her når analysen er ferdig</li>
          </ol>
        </div>
      )}

      {!error && data && data.found && (
        <div style={resultBlock} data-testid="resolve-is-results">
          <div style={summary}>
            <CheckCircleOutlineIcon sx={{ fontSize: 14, color: "#34d399", marginRight: "6px", verticalAlign: "text-bottom" }} />
            <strong>{data.total} klipp analysert</strong>
            <span style={metaSub}>
              {" "}— prosjekt: <code style={code}>{data.project}</code>, folder: <code style={code}>{data.folder}</code>
            </span>
          </div>
          <div style={itemList}>
            {data.items.slice(0, 8).map((item) => (
              <div key={item.media_pool_item_id} style={itemRow} data-testid={`resolve-is-item-${item.media_pool_item_id}`}>
                <span style={itemName}>{item.clip_name}</span>
                <span style={itemMeta}>
                  {item.duration_frames}f @ {Math.round(item.fps)}fps
                </span>
              </div>
            ))}
            {data.items.length > 8 && (
              <div style={moreHint}>+ {data.items.length - 8} klipp til</div>
            )}
          </div>
          <div style={dirHint}>
            Lagret: <code style={code}>{shortPath(data.file)}</code>
          </div>
        </div>
      )}

      {!error && !data && !loading && (
        <div style={emptyBox}>Trykk Refresh for å hente data fra Resolve.</div>
      )}
    </section>
  );
}

function shortPath(p: string): string {
  return p.replace(/^.*\/PostAgent\//, "~/PostAgent/");
}

const panel: React.CSSProperties = {
  background: "#15151c",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const titleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const panelTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#e5e5ea",
};

const betaBadge: React.CSSProperties = {
  fontSize: 9,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "2px 6px",
  borderRadius: 4,
  fontWeight: 700,
  letterSpacing: 0.4,
};

const refreshBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 11,
  padding: "5px 10px",
  borderRadius: 6,
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

const emptyBox: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 12,
  color: "#a8a8b8",
};

const emptyTitle: React.CSSProperties = {
  fontWeight: 600,
  color: "#e5e5ea",
  marginBottom: 6,
};

const emptyHint: React.CSSProperties = {
  fontSize: 11.5,
  color: "#a8a8b8",
  marginBottom: 8,
};

const steps: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 11,
  color: "#9ca3af",
  lineHeight: 1.6,
};

const resultBlock: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const summary: React.CSSProperties = {
  fontSize: 12.5,
  color: "#e5e5ea",
};

const metaSub: React.CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
};

const code: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  background: "#22222e",
  padding: "1px 5px",
  borderRadius: 4,
  fontSize: 10.5,
};

const itemList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 6,
  padding: 4,
  maxHeight: 200,
  overflowY: "auto",
};

const itemRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "5px 8px",
  fontSize: 11.5,
};

const itemName: React.CSSProperties = {
  color: "#cbcbd5",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemMeta: React.CSSProperties = {
  color: "#7b7b8d",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
  flexShrink: 0,
};

const moreHint: React.CSSProperties = {
  fontSize: 10,
  color: "#7b7b8d",
  textAlign: "center",
  padding: "4px 8px",
};

const dirHint: React.CSSProperties = {
  fontSize: 10,
  color: "#7b7b8d",
};
