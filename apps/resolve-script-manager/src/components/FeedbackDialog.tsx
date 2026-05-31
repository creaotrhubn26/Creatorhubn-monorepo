/**
 * FeedbackDialog — la brukeren rapportere bug eller feedback uten å
 * forlate appen. Bygger en pre-utfylt mailto:-lenke til Daniel med
 * diagnostikk-info så vi ikke må be om grunnleggende kontekst etterpå.
 *
 * Inkluderer automatisk:
 *   - App-versjon (fra package.json via fetch hvis tilgjengelig)
 *   - OS + browser-info (userAgent)
 *   - Photoshop bridge-status
 *   - Brukermelding + valgfri kategori
 *
 * Bevisst valg: mailto: framfor backend-route — null infrastruktur,
 * fungerer offline, gir mottakeren rik kontekst direkte i innboksen.
 */

import { useCallback, useEffect, useState } from "react";
import { getStatus, type PhotoshopBridgeStatus } from "../services/photoshopBridgeService";
import { loadSettings } from "./SettingsModal";

interface Props {
  onClose: () => void;
}

type Category = "bug" | "feature_request" | "question" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "Bug — noe fungerer ikke" },
  { value: "feature_request", label: "Forslag til ny funksjon" },
  { value: "question", label: "Spørsmål om hvordan noe gjøres" },
  { value: "other", label: "Annet" },
];

const FEEDBACK_EMAIL = "daniel@creatorhubn.com";

export function FeedbackDialog({ onClose }: Props) {
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [psStatus, setPsStatus] = useState<PhotoshopBridgeStatus | null>(null);

  useEffect(() => {
    getStatus().then(setPsStatus).catch(() => {});
  }, []);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const sendFeedback = useCallback(async () => {
    const s = loadSettings();
    const token = s.RR_BEARER_TOKEN?.trim();
    if (!token) {
      setSendError("Du må være logget inn med Role Room for å sende feedback. Logg inn fra tannhjul → Settings.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const base = (s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent").replace(/\/$/, "");
      const res = await fetch(`${base}/feedback`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          message,
          bridge_status: psStatus,
          platform: navigator.platform,
          user_agent: navigator.userAgent,
          client_version: "0.2.5",
        }),
      });
      if (!res.ok) {
        // Backend ikke deployet enda — fall tilbake til mailto
        if (res.status === 404) {
          fallbackToMailto();
          return;
        }
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [category, message, psStatus, onClose]);

  const fallbackToMailto = useCallback(() => {
    const psSummary = psStatus
      ? `Photoshop bridge: ${psStatus.connected ? "tilkoblet" : "frakoblet"}${
          psStatus.plugin_version ? ` (plugin v${psStatus.plugin_version})` : ""
        }${psStatus.photoshop_version ? `, PS ${psStatus.photoshop_version}` : ""}`
      : "Photoshop bridge: status ukjent";
    const subject = `Post Agent feedback — ${CATEGORIES.find((c) => c.value === category)?.label}`;
    const body = `${message}

—
Sendt fra Post Agent (fallback fra in-app)
${psSummary}
Plattform: ${navigator.platform}
Tidspunkt: ${new Date().toISOString()}`;
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTimeout(onClose, 500);
  }, [category, message, psStatus, onClose]);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Send feedback til Daniel</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Bug, forslag, eller spørsmål? Skriv inn så åpner vi e-post med diagnostikk-info ferdigfylt.
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={body}>
          <label style={fieldLabel}>Type tilbakemelding</label>
          <div style={catGrid}>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  ...catBtn,
                  ...(category === c.value ? catBtnActive : null),
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <label style={fieldLabel}>Din melding</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              category === "bug"
                ? "Beskriv hva som skjedde + hva du forventet skulle skje. Skjermbilde kan legges til i selve e-posten."
                : category === "feature_request"
                ? "Hva ville hjulpet deg å gjøre jobben bedre?"
                : "Hva lurer du på?"
            }
            rows={8}
            style={textarea}
          />

          <div style={infoBox}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Vi sender automatisk med:</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#aaa", lineHeight: 1.5 }}>
              <li>Photoshop bridge-status (tilkoblet/frakoblet, versjon)</li>
              <li>Plattform + browser-info</li>
              <li>Tidspunkt</li>
            </ul>
            <div style={{ marginTop: 8, color: "#888", fontSize: 11 }}>
              Skjermbilde kan du dra inn i e-posten etter at den åpner seg.
            </div>
          </div>
        </div>

        {sendError && (
          <div style={{
            background: "rgba(248,81,73,0.1)",
            border: "1px solid rgba(248,81,73,0.4)",
            color: "#f85149",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            margin: "0 18px 8px",
          }}>
            {sendError}
          </div>
        )}
        {sent && (
          <div style={{
            background: "rgba(74,212,138,0.12)",
            border: "1px solid rgba(74,212,138,0.4)",
            color: "#4ad48a",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            margin: "0 18px 8px",
            fontWeight: 600,
          }}>
            ✓ Sendt! Vi får e-post med diagnostikk og svarer så raskt vi kan.
          </div>
        )}
        <footer style={footerBar}>
          <div style={{ fontSize: 11, color: "#888" }}>
            Sender direkte til {FEEDBACK_EMAIL} via backend
          </div>
          <button
            onClick={sendFeedback}
            disabled={!message.trim() || sending || sent}
            style={primaryBtn}
          >
            {sending ? "Sender…" : sent ? "✓ Sendt" : "Send feedback"}
          </button>
        </footer>
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
  width: "min(560px, 95vw)",
  maxHeight: "90vh",
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
  gap: 12,
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

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#bbb",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 6,
  marginTop: 8,
};

const catGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
  marginBottom: 4,
};

const catBtn: React.CSSProperties = {
  background: "#242424",
  border: "1px solid #333",
  color: "#aaa",
  padding: "8px 12px",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
  textAlign: "left",
};

const catBtnActive: React.CSSProperties = {
  background: "rgba(59,130,246,0.18)",
  border: "1px solid #3b82f6",
  color: "#dbeafe",
};

const textarea: React.CSSProperties = {
  width: "100%",
  resize: "vertical",
  minHeight: 100,
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const infoBox: React.CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  background: "#181818",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  fontSize: 11,
};

const footerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 18px",
  borderTop: "1px solid #2a2a2a",
  background: "#181818",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
