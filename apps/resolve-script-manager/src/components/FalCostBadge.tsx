/**
 * FalCostBadge — liten, gjenbrukbar pille som gjør fal.ai-kostnad SYNLIG i UI.
 *
 * Tre bruksmåter:
 *  - <FalCostBadge usd={0.23} />                    // vis et estimat
 *  - <FalCostBadge estimate={estimate([...])} detailed />  // med linje-oppdeling i tooltip
 *  - <FalCostBadge usd={0.04} tone="spent" label="Brukt i økten" />
 *
 * Alltid merket som estimat (~) — faktisk fakturering skjer på fal-dashbordet.
 */

import { useState } from "react";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import { fmtUsd, fmtNok, type CostEstimate } from "../services/falPricing";

type Tone = "estimate" | "spent" | "muted";

interface Props {
  /** Direkte USD-beløp (brukes hvis `estimate` ikke er satt). */
  usd?: number;
  /** Fullt estimat med linjer — gir tooltip-oppdeling når `detailed`. */
  estimate?: CostEstimate;
  /** Vis linje-for-linje breakdown ved hover. */
  detailed?: boolean;
  tone?: Tone;
  /** Overstyr ledeteksten (default "≈ est."). */
  label?: string;
  /** Vis NOK i tillegg til USD. */
  showNok?: boolean;
}

const TONES: Record<Tone, { bg: string; border: string; fg: string; icon: string }> = {
  estimate: { bg: "rgba(124,58,237,0.14)", border: "rgba(167,139,250,0.4)", fg: "#c4b5fd", icon: "#a78bfa" },
  spent: { bg: "rgba(63,185,80,0.14)", border: "rgba(63,185,80,0.4)", fg: "#7ee787", icon: "#3fb950" },
  muted: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", fg: "#aaa", icon: "#888" },
};

export function FalCostBadge({
  usd,
  estimate,
  detailed = false,
  tone = "estimate",
  label,
  showNok = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const amount = estimate ? estimate.usd : (usd ?? 0);
  const t = TONES[tone];
  const lead = label ?? (tone === "spent" ? "" : "≈");
  const hasLines = detailed && estimate && estimate.lines.length > 0;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => hasLines && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: t.bg,
          border: `1px solid ${t.border}`,
          color: t.fg,
          borderRadius: 999,
          padding: "2px 9px",
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          cursor: hasLines ? "help" : "default",
        }}
        title={hasLines ? undefined : "Estimat — faktisk kostnad vises på fal-dashbordet"}
      >
        <PaidOutlinedIcon sx={{ fontSize: 13, color: t.icon }} />
        {lead && <span style={{ opacity: 0.85 }}>{lead}</span>}
        {fmtUsd(amount)}
        {showNok && <span style={{ opacity: 0.7, fontWeight: 500 }}>· {fmtNok(amount * 10.7)}</span>}
      </span>

      {hasLines && open && estimate && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            background: "#1b1b1f",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "10px 12px",
            minWidth: 230,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            fontSize: 11,
            color: "#ccc",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#fff" }}>Estimert kostnad</div>
          {estimate.lines.map((l) => (
            <div key={l.op} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" }}>
              <span style={{ color: "#aaa" }}>
                {l.label} <span style={{ color: "#666" }}>×{l.qty}</span>
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{fmtUsd(l.usd)}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid #333",
              marginTop: 6,
              paddingTop: 6,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            <span>Sum</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {fmtUsd(estimate.usd)} · {fmtNok(estimate.nok)}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "#777", lineHeight: 1.4 }}>
            Estimat basert på fal-modellenes enhetspris. Faktisk forbruk føres på fal-dashbordet.
          </div>
        </div>
      )}
    </span>
  );
}

export default FalCostBadge;
