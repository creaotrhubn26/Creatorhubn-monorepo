/**
 * StoryboardRefineDialog — «Forbedre shot»: gi tilbakemelding på ETT enkelt
 * storyboard-bilde og regenerer kun det. Velg problem-tagger og/eller skriv
 * fritt → regenerer → sammenlign FØR/ETTER → behold nytt / forrige / prøv igjen.
 *
 * Kostnad per regenerering vises hele veien (FalCostBadge), og forbruket for
 * dette shot-et akkumuleres. Reuser fix_prompt-mekanikken fra QC-løkka.
 */

import { useCallback, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RefreshIcon from "@mui/icons-material/Refresh";
import FalCostBadge from "./FalCostBadge";
import { opCost } from "../services/falPricing";
import {
  REFINE_ISSUES,
  composeFix,
  regenerateShot,
  type ShotVariant,
} from "../services/adFilmShots";

interface Props {
  specPath: string;
  shotId: string;
  shotLabel: string; // f.eks. "reveal wide-to-medium"
  /** Nåværende bilde-sti. */
  currentImage: string;
  onClose: () => void;
  /** Kalles når bruker beholder et nytt bilde. */
  onAccept: (imagePath: string) => void;
}

const COST = opCost("edit"); // continuity-edit per regenerering

export function StoryboardRefineDialog({
  specPath,
  shotId,
  shotLabel,
  currentImage,
  onClose,
  onAccept,
}: Props) {
  const [issues, setIssues] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prev, setPrev] = useState<string>(currentImage);
  const [next, setNext] = useState<ShotVariant | null>(null);
  const [attempts, setAttempts] = useState(0);

  const toggle = (id: string) =>
    setIssues((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const canRun = issues.length > 0 || freeText.trim().length > 0;

  const run = useCallback(async () => {
    if (!canRun) return;
    setBusy(true);
    setError(null);
    try {
      const v = await regenerateShot({ specPath, shotId, fix: composeFix(issues, freeText) });
      // forrige "etter" blir "før" ved neste forsøk
      if (next) setPrev(next.image_path);
      setNext(v);
      setAttempts((a) => a + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [canRun, specPath, shotId, issues, freeText, next]);

  const spent = attempts * COST;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AutoFixHighIcon sx={{ fontSize: 18, color: "#c084fc" }} />
              Forbedre shot — {shotId.toUpperCase()}
            </h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {shotLabel} · velg hva som er galt eller skriv fritt. Regenererer KUN dette bildet.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {attempts > 0 && (
              <FalCostBadge usd={spent} tone="spent" label={`Dette shot-et (${attempts})`} />
            )}
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </header>

        <div style={body}>
          {/* problem-tagger */}
          <div style={sectionLabel}>Hva er galt?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {REFINE_ISSUES.map((it) => {
              const on = issues.includes(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => toggle(it.id)}
                  disabled={busy}
                  style={{
                    ...chip,
                    background: on ? "#a936c5" : "#28242f",
                    color: on ? "#fff" : "#c4c2cf",
                    borderColor: on ? "#a936c5" : "#3a3646",
                  }}
                >
                  {on ? "✓ " : ""}
                  {it.label}
                </button>
              );
            })}
          </div>

          {/* fritekst */}
          <div style={{ ...sectionLabel, marginTop: 16 }}>Eller beskriv med egne ord</div>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="F.eks. «Hun holder nettbrettet opp mot kamera — vil ha ekte over-skulder og matt skjerm uten speiling.»"
            rows={3}
            style={textarea}
            disabled={busy}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <FalCostBadge usd={COST} tone="estimate" />
            <button onClick={run} disabled={busy || !canRun} style={{ ...primaryBtn, opacity: canRun ? 1 : 0.5 }}>
              <RefreshIcon sx={{ fontSize: 15, marginRight: "6px", verticalAlign: "text-bottom" }} />
              {busy ? "Regenererer…" : attempts > 0 ? "Prøv igjen" : "Regenerer bildet"}
            </button>
          </div>

          {error && <div style={errorBox}>{error}</div>}

          {/* FØR / ETTER */}
          <div style={{ ...sectionLabel, marginTop: 18 }}>
            {next ? "Før → etter (behold det du liker)" : "Nåværende"}
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <figure style={figure}>
              <img src={convertFileSrc(next ? prev : currentImage)} alt="Før" style={img} />
              <figcaption style={cap}>{next ? "Før" : "Nåværende"}</figcaption>
            </figure>
            {next && (
              <figure style={{ ...figure, borderColor: "#a936c5" }}>
                <img src={convertFileSrc(next.image_path)} alt="Etter" style={img} />
                <figcaption style={{ ...cap, color: "#c084fc" }}>Etter (nytt)</figcaption>
              </figure>
            )}
          </div>

          {next && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{ ...primaryBtn, flex: 1 }} onClick={() => onAccept(next.image_path)}>
                ✓ Behold nytt
              </button>
              <button style={{ ...ghostBtn, flex: 1 }} onClick={onClose}>
                ← Behold forrige
              </button>
              <button style={{ ...ghostBtn, flex: 1 }} onClick={run} disabled={busy}>
                ↻ Prøv igjen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100,
};
const modal: React.CSSProperties = {
  background: "#1b1922", borderRadius: 10, width: "min(760px, 96vw)", maxHeight: "92vh",
  display: "flex", flexDirection: "column", color: "#ddd", fontSize: 12,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};
const header: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  padding: "14px 18px", borderBottom: "1px solid #2a2733",
};
const closeBtn: React.CSSProperties = {
  background: "transparent", border: 0, color: "#888", fontSize: 18, cursor: "pointer", padding: 4,
};
const body: React.CSSProperties = { padding: 18, overflowY: "auto", flex: 1 };
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#c084fc", textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 8,
};
const chip: React.CSSProperties = {
  border: "1px solid", borderRadius: 999, padding: "6px 13px", fontSize: 12,
  fontWeight: 600, cursor: "pointer",
};
const textarea: React.CSSProperties = {
  width: "100%", resize: "vertical", minHeight: 66, background: "#0f0d13",
  border: "1px solid #3a3646", color: "#ddd", padding: "9px 11px", borderRadius: 8,
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #c084fc, #a936c5)", color: "white", border: 0,
  borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  background: "#28242f", color: "#c4c2cf", border: "1px solid #3a3646",
  borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const figure: React.CSSProperties = {
  margin: 0, flex: 1, border: "2px solid #3a3646", borderRadius: 10, overflow: "hidden",
  position: "relative", background: "#0f0d13",
};
const img: React.CSSProperties = { width: "100%", height: 220, objectFit: "cover", display: "block" };
const cap: React.CSSProperties = {
  position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#fff",
  fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
};
const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.4)", color: "#f85149",
  borderRadius: 8, padding: "9px 13px", fontSize: 12, marginTop: 10,
};

export default StoryboardRefineDialog;
