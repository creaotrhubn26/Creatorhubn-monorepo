/**
 * PhotoshopAgentDialog — MVP av "AI Creative Director" mot Photoshop.
 *
 * Demonstrerer agentic loop:
 *   1. Bruker skriver et naturlig-språk prompt
 *   2. Sendes til Claude med PHOTOSHOP_TOOLS som verktøy
 *   3. Hvis Claude svarer med tool_use → kjør tools mot UXP-broen
 *   4. Send tool_results tilbake og loop til Claude er ferdig
 *
 * Viktigste sikkerhet: MAX_TURNS hindrer infinite loops. Hver tool-
 * eksekvering vises i UI så bruker ser hva Claude gjør i sanntid.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import {
  PHOTOSHOP_TOOLS,
  runAllPhotoshopTools,
  type ClaudeToolUseBlock,
  type ClaudeToolResultBlock,
} from "../agents/photoshopTools";
import {
  getStatus,
  onStatus,
  type PhotoshopBridgeStatus,
} from "../services/photoshopBridgeService";

const MAX_TURNS = 10;

interface Props {
  onClose: () => void;
}

interface TextBlock {
  type: "text";
  text: string;
}
type ContentBlock = TextBlock | ClaudeToolUseBlock | ClaudeToolResultBlock;

interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

interface ClaudeResponse {
  id: string;
  model: string;
  content: ContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

const SYSTEM_PROMPT = `Du er AI Creative Director for Post Agent. Du har tilgang til Adobe Photoshop via UXP-broen og kan utføre operasjoner direkte ved å kalle photoshop_*-tools.

Retningslinjer:
- Spør brukeren om presise fil-stier og layer-navn hvis de mangler — gjett aldri.
- Kall photoshop_scan_template før photoshop_render_template så du vet hvilke {{key}}-felter som finnes.
- Forklar kort hva du gjør før hvert tool-kall (1 setning).
- Når du er ferdig, oppsummer hva du faktisk gjorde og pek bruker mot resultatet.`;

export function PhotoshopAgentDialog({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PhotoshopBridgeStatus | null>(null);
  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getStatus().then((s) => mounted && setStatus(s)).catch(() => {});
    const off = onStatus((s) => mounted && setStatus(s));
    return () => {
      mounted = false;
      off.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const connected = !!status?.connected;

  const runAgentLoop = useCallback(
    async (initialMessages: Message[]) => {
      cancelRef.current = false;
      setBusy(true);
      setError(null);
      let convo = initialMessages;
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          if (cancelRef.current) break;
          const response = await invoke<ClaudeResponse>("claude_chat", {
            messages: convo,
            system: SYSTEM_PROMPT,
            model: "claude-opus-4-7",
            maxTokens: 2048,
            tools: PHOTOSHOP_TOOLS,
          });

          const assistantMsg: Message = {
            role: "assistant",
            content: response.content,
          };
          convo = [...convo, assistantMsg];
          setMessages(convo);

          // Hvis Claude ikke ba om tools, er turnen ferdig
          const toolUses = response.content.filter(
            (b): b is ClaudeToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
            break;
          }

          if (cancelRef.current) break;
          const results = await runAllPhotoshopTools(response.content);
          const toolResultMsg: Message = {
            role: "user",
            content: results,
          };
          convo = [...convo, toolResultMsg];
          setMessages(convo);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const sendPrompt = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const userMsg: Message = {
      role: "user",
      content: [{ type: "text", text }],
    };
    const next = [...messages, userMsg];
    setMessages(next);
    await runAgentLoop(next);
  }, [input, messages, runAgentLoop]);

  const cancel = () => {
    cancelRef.current = true;
  };

  const reset = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Photoshop Agent</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              AI Creative Director — Claude med Photoshop-tools
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={reset} style={secondaryBtn} disabled={busy}>
              Nullstill
            </button>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </header>

        <div style={statusBar}>
          <span
            style={{
              ...dot,
              background: connected ? "#3fb950" : "#f85149",
            }}
          />
          <span>
            {connected
              ? `Photoshop tilkoblet${status?.photoshop_version ? ` (v${status.photoshop_version})` : ""}`
              : "Photoshop ikke tilkoblet — agentens tool-kall vil feile"}
          </span>
        </div>

        <div ref={scrollRef} style={threadBox}>
          {messages.length === 0 && !busy && (
            <div style={emptyState}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                Eksempler du kan be agenten gjøre:
              </div>
              <ul style={{ paddingLeft: 18, margin: 0, color: "#aaa", lineHeight: 1.7 }}>
                <li>"Åpne /Users/.../template.psd og fortell meg hva som er der"</li>
                <li>"Skann /Users/.../poster.psd, sett title til 'Norefjell 2026' og eksporter som JPG"</li>
                <li>"Skru av layer 'watermark' i aktivt dokument og lagre"</li>
              </ul>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBlock key={i} message={m} />
          ))}
          {busy && (
            <div style={spinnerRow}>
              <span style={spinnerDot} />
              Agent jobber…
              <button onClick={cancel} style={cancelBtnInline}>
                Avbryt
              </button>
            </div>
          )}
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <div style={inputBar}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void sendPrompt();
              }
            }}
            placeholder="Be agenten om å gjøre noe i Photoshop… (Cmd+Enter for å sende)"
            rows={2}
            style={textarea}
            disabled={busy}
          />
          <button
            onClick={sendPrompt}
            disabled={busy || !input.trim() || !connected}
            style={primaryBtn}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div style={{ ...msgRow, justifyContent: "flex-end" }}>
        <div style={{ ...msgBubble, background: "#2a4a6f", maxWidth: "75%" }}>
          {message.content.map((b, i) => {
            if (b.type === "text") return <div key={i}>{b.text}</div>;
            if (b.type === "tool_result") return <ToolResultBlock key={i} block={b} />;
            return null;
          })}
        </div>
      </div>
    );
  }
  return (
    <div style={msgRow}>
      <div style={{ ...msgBubble, background: "#242424", maxWidth: "85%" }}>
        {message.content.map((b, i) => {
          if (b.type === "text") return <div key={i}>{b.text}</div>;
          if (b.type === "tool_use") return <ToolUseBlock key={i} block={b} />;
          return null;
        })}
      </div>
    </div>
  );
}

function ToolUseBlock({ block }: { block: ClaudeToolUseBlock }) {
  return (
    <div style={toolCardUse}>
      <div style={toolHeader}>
        <span style={{ color: "#a78bfa", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <BuildOutlinedIcon sx={{ fontSize: 14 }} /> {block.name}
        </span>
      </div>
      <pre style={toolJson}>{JSON.stringify(block.input, null, 2)}</pre>
    </div>
  );
}

function ToolResultBlock({ block }: { block: ClaudeToolResultBlock }) {
  const isErr = !!block.is_error;
  return (
    <div
      style={{
        ...toolCardResult,
        borderLeft: `3px solid ${isErr ? "#f85149" : "#3fb950"}`,
      }}
    >
      <div style={toolHeader}>
        <span
          style={{
            color: isErr ? "#f85149" : "#3fb950",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isErr ? (
            <>
              <ErrorOutlineIcon sx={{ fontSize: 14 }} /> tool error
            </>
          ) : (
            <>
              <CheckCircleOutlinedIcon sx={{ fontSize: 14 }} /> tool result
            </>
          )}
        </span>
      </div>
      <pre style={toolJson}>{block.content}</pre>
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
  height: "min(82vh, 800px)",
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
  gap: 8,
  padding: "8px 18px",
  background: "#181818",
  borderBottom: "1px solid #2a2a2a",
  fontSize: 11,
  color: "#aaa",
};

const dot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};

const threadBox: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const emptyState: React.CSSProperties = {
  color: "#888",
  fontSize: 12,
  textAlign: "left",
  margin: "auto",
  padding: 24,
};

const msgRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
};

const msgBubble: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  color: "#ddd",
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const toolCardUse: React.CSSProperties = {
  marginTop: 6,
  background: "rgba(167,139,250,0.08)",
  border: "1px solid rgba(167,139,250,0.25)",
  borderRadius: 6,
  padding: "6px 10px",
};

const toolCardResult: React.CSSProperties = {
  marginTop: 6,
  background: "rgba(255,255,255,0.04)",
  borderRadius: 6,
  padding: "6px 10px",
};

const toolHeader: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  marginBottom: 4,
};

const toolJson: React.CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  fontFamily: "ui-monospace, monospace",
  color: "#bbb",
  background: "#141414",
  padding: "6px 8px",
  borderRadius: 4,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 200,
  overflowY: "auto",
};

const spinnerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 11,
  color: "#888",
  padding: "6px 0",
};

const spinnerDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#3b82f6",
  animation: "pulse 1.2s ease-in-out infinite",
};

const cancelBtnInline: React.CSSProperties = {
  marginLeft: 12,
  background: "transparent",
  color: "#f85149",
  border: "1px solid #f85149",
  borderRadius: 4,
  padding: "2px 8px",
  fontSize: 11,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  margin: "0 18px 8px",
};

const inputBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "12px 18px",
  borderTop: "1px solid #2a2a2a",
  background: "#181818",
};

const textarea: React.CSSProperties = {
  flex: 1,
  resize: "none",
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "0 18px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  alignSelf: "stretch",
};

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  color: "#ddd",
  border: "1px solid #3a3a3a",
  borderRadius: 4,
  padding: "4px 12px",
  fontSize: 11,
  cursor: "pointer",
};
