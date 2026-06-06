/**
 * AlternativeStoryDialog — modal som lar brukeren be Claude om en
 * alternativ vinkel på historien.
 *
 * Flyt:
 *   1. Brukeren skriver hva de ønsker å endre (fri tekst, valgfri).
 *   2. Dialogen viser segmentene (picks) som kontekst.
 *   3. Klikk "Generer historie" → Claude kalles med ønske + segmenter.
 *   4. Claude returnerer { title, summary, recommendations[] } som
 *      vises inline. Brukeren kan ta i bruk forslaget eller forkaste.
 *
 * Test-bypass: `window.__POST_AGENT_DISABLE_CLAUDE__ = true` hopper
 * Claude-kallet og bruker `__POST_AGENT_TEST_ALT_RESPONSE__` direkte.
 */

import { useState } from "react";
import type { NarrativePick } from "../../hooks/useNarrativeStructure";
import type { StoryRecommendation } from "../../hooks/useStoryRecommendations";
import { claudeProxyService } from "../../services/claudeProxyService";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

export interface AlternativeStoryResult {
  title: string;
  summary: string;
  recommendations: StoryRecommendation[];
}

interface Props {
  open: boolean;
  picks: NarrativePick[];
  projectBrief?: { type: string; intent?: string };
  onClose: () => void;
  /** Når brukeren klikker "Bruk dette forslaget" → parent erstatter rec-state. */
  onApply: (result: AlternativeStoryResult) => void;
}

export function AlternativeStoryDialog({ open, picks, projectBrief, onClose, onApply }: Props) {
  const [wish, setWish] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AlternativeStoryResult | null>(null);

  if (!open) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const text = await callClaudeForAlternative({ picks, projectBrief, wish });
      const parsed = parseAlternativeResponse(text);
      if (parsed) {
        setResult(parsed);
      } else {
        setError("Klarte ikke tolke Claude-respons — prøv å skrive ønsket litt annerledes.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      onClose();
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div style={backdrop} data-testid="alternative-story-dialog">
      <div style={dialog}>
        <header style={dialogHeader}>
          <div style={dialogTitle}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
            <span>Generer alternativ historie</span>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Lukk" data-testid="alt-close">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </header>

        {!result && (
          <div style={dialogBody}>
            <label style={fieldLabel}>
              Er det noe spesielt du ønsker å endre på?
              <span style={fieldHint}>Beskriv kort hva du tenker. La feltet stå tomt for et åpent forslag.</span>
            </label>
            <textarea
              data-testid="alt-wish-input"
              style={textarea}
              rows={4}
              placeholder='F.eks. "Vil ha mer fokus på reaksjon fra foreldre" eller "kortere intro"'
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              disabled={loading}
            />

            <div style={segmentsHeader}>Segmenter i historien</div>
            <div style={segmentList} data-testid="alt-segment-list">
              {picks.map((p) => (
                <div key={p.index} style={segmentRow} data-testid={`alt-segment-${p.index}`}>
                  <span style={segmentIndex}>#{p.index}</span>
                  <span style={segmentChapter}>{p.chapter ?? "—"}</span>
                  <span style={segmentTime}>
                    {formatTime(p.startSec)}–{formatTime(p.endSec)}
                  </span>
                </div>
              ))}
              {picks.length === 0 && (
                <div style={segmentEmpty}>Ingen segmenter ennå.</div>
              )}
            </div>

            {error && (
              <div style={errorBox} data-testid="alt-error">
                {error}
              </div>
            )}

            <footer style={dialogFooter}>
              <button style={secondaryBtn} onClick={onClose} disabled={loading}>
                Avbryt
              </button>
              <button
                style={primaryBtn}
                onClick={handleGenerate}
                disabled={loading}
                data-testid="alt-generate"
              >
                {loading ? "Claude jobber…" : "Generer historie"}
              </button>
            </footer>
          </div>
        )}

        {result && (
          <div style={dialogBody} data-testid="alt-result">
            <div style={resultTitle}>{result.title}</div>
            <div style={resultSummary}>{result.summary}</div>

            <div style={segmentsHeader}>Foreslåtte endringer</div>
            <div style={recList}>
              {result.recommendations.map((rec) => (
                <article
                  key={rec.id}
                  style={recCard}
                  data-testid={`alt-rec-${rec.id}`}
                >
                  <div style={recTitle}>{rec.title}</div>
                  <p style={recBody}>{rec.body}</p>
                  {rec.pickIndices && rec.pickIndices.length > 0 && (
                    <div style={recPicks}>
                      Picks: {rec.pickIndices.map((i) => `#${i}`).join(", ")}
                    </div>
                  )}
                </article>
              ))}
            </div>

            <footer style={dialogFooter}>
              <button style={secondaryBtn} onClick={handleReset} data-testid="alt-try-again">
                Prøv igjen
              </button>
              <button
                style={primaryBtn}
                onClick={handleApply}
                data-testid="alt-apply"
              >
                Bruk dette forslaget
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

async function callClaudeForAlternative({
  picks,
  projectBrief,
  wish,
}: {
  picks: NarrativePick[];
  projectBrief?: { type: string; intent?: string };
  wish: string;
}): Promise<string> {
  // Test-bypass: hvis Claude er disablet, returner mock-respons
  if (typeof window !== "undefined") {
    const flag = (window as { __POST_AGENT_DISABLE_CLAUDE__?: boolean })
      .__POST_AGENT_DISABLE_CLAUDE__;
    if (flag) {
      const mock = (window as { __POST_AGENT_TEST_ALT_RESPONSE__?: string })
        .__POST_AGENT_TEST_ALT_RESPONSE__;
      return mock ?? JSON.stringify({
        title: "Mock alternativ",
        summary: "Test-summary",
        recommendations: [
          {
            id: "mock-rec",
            title: "Mock-anbefaling",
            body: "Mock-body",
            category: "structure",
            pickIndices: picks.length > 0 ? [picks[0].index] : [],
          },
        ],
      });
    }
  }

  const picksList = picks
    .map(
      (p) =>
        `  #${p.index}: ${p.chapter ?? "—"} (${formatTime(p.startSec)}–${formatTime(p.endSec)}, score ${p.score.toFixed(2)})`,
    )
    .join("\n");

  const userMessage = [
    `Prosjekt-type: ${projectBrief?.type ?? "ukjent"}`,
    projectBrief?.intent ? `Intent: ${projectBrief.intent}` : "",
    "",
    "Brukerens ønske:",
    wish.trim() || "(ingen spesifikk ønske — gi din egen alternative vinkel)",
    "",
    "Segmenter:",
    picksList,
    "",
    "Foreslå en ALTERNATIV vinkel på historien — én tittel, en kort beskrivelse av vinkelen, og 2-3 konkrete anbefalinger med pickIndices.",
  ]
    .filter(Boolean)
    .join("\n");

  return await claudeProxyService.send({
    systemPrompt: ALTERNATIVE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1200,
  });
}

const ALTERNATIVE_SYSTEM_PROMPT = `Du er Story Director for Post Agent. Du foreslår en ALTERNATIV vinkel på en allerede klippet historie — basert på brukerens ønske og segmentene de har valgt.

Du svarer ALLTID med gyldig JSON i dette skjemaet, uten markdown-kode-fence:

{
  "title": "kort tittel (3-6 ord) som beskriver vinkelen",
  "summary": "1-2 setninger om hva som er ANNERLEDES i denne versjonen",
  "recommendations": [
    {
      "id": "stable-slug",
      "title": "kort tittel (3-5 ord)",
      "body": "1-2 setninger om HVA + HVORFOR",
      "category": "emotion" | "variety" | "structure" | "ending" | "pacing",
      "pickIndices": [pick-indekser fra prompten som anbefalingen gjelder]
    }
  ]
}

Skriv på norsk bokmål. Aldri inkluder backticks, kode-fence eller forklaring utenfor JSON.`;

function parseAlternativeResponse(raw: string): AlternativeStoryResult | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as {
      title?: string;
      summary?: string;
      recommendations?: Array<{
        id?: string;
        title?: string;
        body?: string;
        category?: string;
        pickIndices?: unknown;
      }>;
    };
    if (!parsed.title || !Array.isArray(parsed.recommendations)) return null;
    const recs: StoryRecommendation[] = parsed.recommendations
      .filter((r) => r.title && r.body)
      .slice(0, 4)
      .map((r, i) => {
        const pickIndices = Array.isArray(r.pickIndices)
          ? (r.pickIndices.filter((v) => typeof v === "number") as number[])
          : undefined;
        return {
          id: r.id?.trim() || `alt-${i}`,
          title: String(r.title),
          body: String(r.body),
          category: normalizeCategory(r.category),
          pickIndices,
          actionCount: pickIndices?.length,
        };
      });
    if (recs.length === 0) return null;
    return {
      title: String(parsed.title),
      summary: parsed.summary?.trim() || "",
      recommendations: recs,
    };
  } catch {
    return null;
  }
}

function normalizeCategory(raw: string | undefined): StoryRecommendation["category"] {
  const c = (raw ?? "").toLowerCase();
  if (c === "emotion" || c === "variety" || c === "structure" || c === "ending" || c === "pacing") {
    return c as StoryRecommendation["category"];
  }
  return "structure";
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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
  width: "min(640px, 92vw)",
  maxHeight: "min(85vh, 800px)",
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

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#9ca3af",
  cursor: "pointer",
  padding: 4,
  borderRadius: 6,
  display: "inline-flex",
};

const dialogBody: React.CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflowY: "auto",
};

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#cbcbd5",
  gap: 4,
};

const fieldHint: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: "#9ca3af",
};

const textarea: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  color: "#e5e5ea",
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  resize: "vertical",
  minHeight: 80,
};

const segmentsHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  textTransform: "uppercase",
  marginTop: 4,
};

const segmentList: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: "6px 4px",
  maxHeight: 180,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};

const segmentRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "40px 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "6px 10px",
  fontSize: 11.5,
};

const segmentIndex: React.CSSProperties = {
  color: "#a78bfa",
  fontWeight: 600,
  fontFamily: "ui-monospace, monospace",
};

const segmentChapter: React.CSSProperties = {
  color: "#cbcbd5",
};

const segmentTime: React.CSSProperties = {
  color: "#7b7b8d",
  fontFamily: "ui-monospace, monospace",
};

const segmentEmpty: React.CSSProperties = {
  padding: "12px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 11,
};

const errorBox: React.CSSProperties = {
  fontSize: 11.5,
  color: "#fda4af",
  background: "#3f1d1d",
  border: "1px solid #5a2a2a",
  borderRadius: 6,
  padding: "8px 10px",
};

const dialogFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 4,
};

const secondaryBtn: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

const resultTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#e5e5ea",
};

const resultSummary: React.CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "#a8a8b8",
};

const recList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const recCard: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: "10px 12px",
};

const recTitle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "#e5e5ea",
  marginBottom: 4,
};

const recBody: React.CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "#a8a8b8",
};

const recPicks: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#a78bfa",
  fontFamily: "ui-monospace, monospace",
};
