/**
 * HelpDialog — in-app hjelp slik at Irlin slipper å bytte til GitHub
 * for å lese setup-guide / templates-cookbook / agent-prompts.
 *
 * Renderer markdown-filer fra docs/post-agent/ direkte i appen.
 * Foreløpig embedded som strings (hentes ved build); senere kan vi
 * hente live via Tauri-resource API når docs er bundlet.
 */

import { useState } from "react";
import SETUP_GUIDE from "../docs/setup-guide-irene.md?raw";
import TEMPLATES_COOKBOOK from "../docs/photoshop-templates-cookbook.md?raw";
import AGENT_PROMPTS from "../docs/photoshop-agent-prompts.md?raw";

interface Props {
  onClose: () => void;
  initialDoc?: DocKey;
}

type DocKey = "setup" | "templates" | "prompts";

const DOCS: Record<DocKey, { title: string; emoji: string; body: string }> = {
  setup: {
    title: "Kom i gang",
    emoji: "🚀",
    body: SETUP_GUIDE,
  },
  templates: {
    title: "Lag templater",
    emoji: "📄",
    body: TEMPLATES_COOKBOOK,
  },
  prompts: {
    title: "Agent-prompts",
    emoji: "🎨",
    body: AGENT_PROMPTS,
  },
};

export function HelpDialog({ onClose, initialDoc = "setup" }: Props) {
  const [active, setActive] = useState<DocKey>(initialDoc);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Hjelp</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Alt du trenger for å komme i gang med Photoshop-koblingen
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={tabBar}>
          {(Object.keys(DOCS) as DocKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              style={{
                ...tab,
                ...(active === key ? tabActive : null),
              }}
            >
              <span style={{ marginRight: 6 }}>{DOCS[key].emoji}</span>
              {DOCS[key].title}
            </button>
          ))}
        </div>

        <div style={body}>
          <MarkdownView text={DOCS[active].body} />
        </div>
      </div>
    </div>
  );
}

/**
 * Enkel markdown-renderer — vi har ikke en full library her, men de
 * vanligste elementene (h2, lists, code, paragraphs) håndteres
 * fornuftig nok for hjelpe-tekst. For mer komplekse docs kan vi
 * senere bytte til en ekte markdown-renderer som react-markdown.
 */
function MarkdownView({ text }: { text: string }) {
  const blocks = parseSimpleMarkdown(text);
  return (
    <div style={mdBody}>
      {blocks.map((b, i) => {
        if (b.kind === "h1") return <h1 key={i} style={mdH1}>{b.text}</h1>;
        if (b.kind === "h2") return <h2 key={i} style={mdH2}>{b.text}</h2>;
        if (b.kind === "h3") return <h3 key={i} style={mdH3}>{b.text}</h3>;
        if (b.kind === "code") return <pre key={i} style={mdPre}>{b.text}</pre>;
        if (b.kind === "list")
          return (
            <ul key={i} style={mdList}>
              {b.items.map((it, j) => (
                <li key={j} style={mdLi}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} style={mdP}>
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; items: string[] };

function parseSimpleMarkdown(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) { blocks.push({ kind: "h1", text: line.slice(2) }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ kind: "h2", text: line.slice(3) }); i++; continue; }
    if (line.startsWith("### ")) { blocks.push({ kind: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]); i++;
      }
      i++;
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      continue;
    }
    if (line.match(/^[-*] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    // Collect paragraph lines
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^(#|```|[-*] )/)) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode {
  // Match `code`, **bold**, *italic*, [link](url)
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text))) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    const t = match[0];
    if (t.startsWith("`")) {
      parts.push(<code key={key++} style={mdCode}>{t.slice(1, -1)}</code>);
    } else if (t.startsWith("**")) {
      parts.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("*")) {
      parts.push(<em key={key++}>{t.slice(1, -1)}</em>);
    } else {
      const linkMatch = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={mdLink}>
            {linkMatch[1]}
          </a>,
        );
      } else {
        parts.push(t);
      }
    }
    lastIdx = match.index + t.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
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
  width: "min(720px, 96vw)",
  height: "min(85vh, 800px)",
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

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "10px 18px 0",
  borderBottom: "1px solid #2a2a2a",
};

const tab: React.CSSProperties = {
  background: "transparent",
  border: 0,
  borderBottom: "2px solid transparent",
  color: "#888",
  padding: "8px 14px",
  fontSize: 12,
  cursor: "pointer",
};

const tabActive: React.CSSProperties = {
  color: "#ddd",
  borderBottom: "2px solid #3b82f6",
};

const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "18px 24px",
};

const mdBody: React.CSSProperties = {
  maxWidth: 720,
  lineHeight: 1.6,
  fontSize: 13,
};

const mdH1: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginTop: 0,
  marginBottom: 16,
};

const mdH2: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  marginTop: 22,
  marginBottom: 10,
  color: "#e8e8e8",
};

const mdH3: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginTop: 16,
  marginBottom: 8,
  color: "#bbb",
};

const mdP: React.CSSProperties = {
  margin: "0 0 10px",
  color: "#ccc",
};

const mdPre: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 11.5,
  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
  overflowX: "auto",
  marginBottom: 12,
};

const mdCode: React.CSSProperties = {
  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
  background: "rgba(255,255,255,0.06)",
  padding: "1px 5px",
  borderRadius: 3,
  fontSize: 11.5,
};

const mdList: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  paddingLeft: 22,
};

const mdLi: React.CSSProperties = {
  marginBottom: 4,
  color: "#ccc",
};

const mdLink: React.CSSProperties = {
  color: "#60a5fa",
  textDecoration: "none",
};
