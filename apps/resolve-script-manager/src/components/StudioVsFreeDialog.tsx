/**
 * StudioVsFreeDialog — vises når vi detekterer Resolve Free.
 *
 * Forklarer hva som er lavt-hengende frukt med Studio og hvilke
 * auto-pilot-features som er låst i Free.
 *
 * "Vis ikke igjen"-toggle lagres i localStorage så dialog ikke spammer.
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "trrpa.studioInfoDialog.dismissedAt";
// Re-vis dialogen hvis det er gått 30 dager siden brukeren dismisset
const REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

interface Props {
  open: boolean;
  productName?: string | null;
  onClose: () => void;
}

interface FeatureRow {
  feature: string;
  free: string | false;
  studio: string;
  category: "color" | "audio" | "ai" | "render" | "automation";
}

const COMPARISON: FeatureRow[] = [
  // Color
  { feature: "Color page — antall noder per clip", free: "Ubegrenset", studio: "Ubegrenset", category: "color" },
  { feature: "Auto LUT på SetLUT-API", free: false, studio: "Ja — full LUT-applikasjon programmatisk", category: "color" },
  { feature: "Qualifier-node (skin-tone-keying)", free: false, studio: "Ja — ekte skin-tone-isolation på Hue 0-25°", category: "color" },
  { feature: "Magic Mask (AI-objekt-isolation)", free: false, studio: "Ja — auto-isoler brud/brudgom for retusj", category: "color" },
  { feature: "Auto-color-balance (AI)", free: false, studio: "Ja — auto-eksponerings-match på tvers av shots", category: "color" },
  { feature: "DCTL custom-shaders", free: "Begrenset", studio: "Full custom-pipeline", category: "color" },

  // Audio
  { feature: "VST/AU plugin-load via API", free: false, studio: "Ja — auto-pilot kan laste FabFilter Pro-L 2 eller deesser-plugin", category: "audio" },
  { feature: "Fairlight FX (innebygde plugins)", free: "Begrenset", studio: "Full plugin-suite (EQ, dynamic, deesser, reverb)", category: "audio" },
  { feature: "Track-level automation programmatisk", free: false, studio: "Ja — auto-pilot kan tegne volume-automation for ducking", category: "audio" },
  { feature: "Voice Isolation (AI dialog-cleanup)", free: false, studio: "Ja — fjern bakgrunns-støy fra speeches automatisk", category: "audio" },
  { feature: "Auto Loudness (LUFS-normalisering)", free: false, studio: "Ja — innebygd LUFS-meter + auto-norm", category: "audio" },

  // AI
  { feature: "Speech-to-Text (auto-captions)", free: false, studio: "Ja — burnable subtitles på 19+ språk", category: "ai" },
  { feature: "Detect People (face-tracking)", free: false, studio: "Ja — auto-pilot kan smart-crop til 9:16", category: "ai" },
  { feature: "Magic Mask Smart Reframe", free: false, studio: "Ja — vertical/social-crop som holder brud sentrert", category: "ai" },
  { feature: "AI Audio Transcription", free: false, studio: "Ja — auto-pilot kan finne speech-quotes til captions", category: "ai" },

  // Render
  { feature: "Render-resolusjon", free: "UHD (3840×2160) max", studio: "8K (7680×4320)", category: "render" },
  { feature: "10-bit / 12-bit color depth", free: false, studio: "Ja — proper delivery-grade", category: "render" },
  { feature: "ProRes 4444 export", free: false, studio: "Ja — arkiv-master quality", category: "render" },
  { feature: "Hardware encoder (AV1/HEVC)", free: "Begrenset", studio: "Full GPU-acceleration", category: "render" },

  // Automation
  { feature: "Scripting API — alle endepunkter", free: "Begrenset", studio: "Full API-overflate", category: "automation" },
  { feature: "Auto-pilot Fairlight-automation", free: false, studio: "Ja — Claude's ducking-direction skrives som faktisk volume-automation", category: "automation" },
];

const CATEGORY_LABELS: Record<FeatureRow["category"], { label: string; color: string }> = {
  color: { label: "🎨 Color page", color: "#c850e0" },
  audio: { label: "🎵 Audio / Fairlight", color: "#4ad48a" },
  ai: { label: "✨ AI-features", color: "#a030c0" },
  render: { label: "📤 Render / Delivery", color: "#f0a500" },
  automation: { label: "🤖 Auto-pilot / API", color: "#8674a8" },
};

export function StudioVsFreeDialog({ open, productName, onClose }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Group by category
  const byCategory: Record<string, FeatureRow[]> = {};
  for (const row of COMPARISON) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push(row);
  }

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8, 4, 20, 0.78)",
        backdropFilter: "blur(8px)",
        zIndex: 6000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #1a0d45 0%, #0a0518 100%)",
          border: "1px solid rgba(160,48,192,0.4)",
          borderRadius: 12,
          maxWidth: 920,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          color: "var(--text-1)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.7)",
        }}
        className="anim-pop-in"
      >
        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* DaVinci Resolve "spinning rectangles" logo (inline SVG) */}
              <div style={{ flexShrink: 0,
                              width: 48, height: 48,
                              borderRadius: 8,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.10)" }}>
                <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
                     aria-label="DaVinci Resolve">
                  {/* Tilnærming av Resolve "spinner"-merket — 3 roterte rektangler */}
                  <rect x="22" y="42" width="56" height="16" rx="3"
                        transform="rotate(-30 50 50)"
                        fill="#e0334a" fillOpacity="0.85" />
                  <rect x="22" y="42" width="56" height="16" rx="3"
                        transform="rotate(30 50 50)"
                        fill="#f29329" fillOpacity="0.85" />
                  <rect x="22" y="42" width="56" height="16" rx="3"
                        transform="rotate(90 50 50)"
                        fill="#8d3aa9" fillOpacity="0.85" />
                  <circle cx="50" cy="50" r="11" fill="#0a0518" />
                  <circle cx="50" cy="50" r="6" fill="white" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  ⭐ Resolve Studio låser opp mer auto-pilot
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  Du kjører {productName ?? "DaVinci Resolve Free"}. Noen auto-pilot-features er
                  begrenset til Studio. Her er hva du går glipp av:
                </div>
              </div>
            </div>
            <button onClick={handleClose}
                    style={{
                      background: "transparent", border: 0, color: "var(--text-2)",
                      cursor: "pointer", fontSize: 22, padding: 4,
                    }}>✕</button>
          </div>
        </div>

        {/* Feature comparison per category */}
        <div style={{ padding: "16px 28px" }}>
          {Object.entries(byCategory).map(([cat, rows]) => {
            const meta = CATEGORY_LABELS[cat as FeatureRow["category"]];
            return (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: meta.color,
                  marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                }}>
                  {meta.label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.4fr) 1fr 1.4fr",
                                gap: 0, fontSize: 11.5 }}>
                  {/* Header row */}
                  <div style={{ padding: "6px 10px", color: "var(--text-3)",
                                  borderBottom: "1px solid var(--border)" }}>Feature</div>
                  <div style={{ padding: "6px 10px", color: "var(--text-3)",
                                  borderBottom: "1px solid var(--border)" }}>Free</div>
                  <div style={{ padding: "6px 10px", color: "#f0a500",
                                  borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                    ⭐ Studio
                  </div>
                  {rows.map((row, i) => (
                    <>
                      <div key={`${i}-f`} style={{ padding: "8px 10px",
                                                     background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                        {row.feature}
                      </div>
                      <div key={`${i}-fr`} style={{ padding: "8px 10px",
                                                       background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                                                       color: row.free ? "var(--text-2)" : "var(--danger)",
                                                       fontWeight: row.free ? 400 : 600 }}>
                        {row.free === false ? "✕ Ikke tilgjengelig" : row.free}
                      </div>
                      <div key={`${i}-s`} style={{ padding: "8px 10px",
                                                      background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                                                      color: "#4ad48a" }}>
                        ✓ {row.studio}
                      </div>
                    </>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5,
                            color: "var(--text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={dontShowAgain}
                   onChange={(e) => setDontShowAgain(e.target.checked)} />
            Vis ikke igjen
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleClose}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid var(--border)",
                      color: "var(--text-1)", borderRadius: 6,
                      padding: "8px 16px", fontSize: 12, cursor: "pointer",
                    }}>
              Fortsett med Free
            </button>
            <a href="https://www.blackmagicdesign.com/products/davinciresolve"
               target="_blank" rel="noopener noreferrer"
               onClick={handleClose}
               style={{
                 background: "linear-gradient(135deg, #f0a500, #f0c500)",
                 color: "#0a0518",
                 borderRadius: 6,
                 padding: "8px 18px", fontSize: 12, fontWeight: 700,
                 textDecoration: "none",
                 display: "inline-flex", alignItems: "center", gap: 6,
               }}>
              ⭐ Oppgrader til Studio (~$295 engang)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sjekker om dialogen skal vises basert på localStorage. */
export function shouldShowStudioDialog(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return true;
    const ts = parseInt(dismissed, 10);
    if (!Number.isFinite(ts)) return true;
    return (Date.now() - ts) > REMINDER_INTERVAL_MS;
  } catch {
    return true;
  }
}

/** Hook som automatisk styrer dialog basert på Resolve-detection. */
export function useStudioVsFreeAutoShow(isConnected: boolean, isStudio: boolean | undefined): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Vis bare hvis tilkoblet OG bekreftet Free OG ikke nylig dismissed
    if (!isConnected) return;
    if (isStudio !== false) return;  // unknown eller true → ikke vis
    if (!shouldShowStudioDialog()) return;
    // Liten delay så det ikke føles påtrengende
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, [isConnected, isStudio]);
  return [open, () => setOpen(false)];
}

export default StudioVsFreeDialog;
