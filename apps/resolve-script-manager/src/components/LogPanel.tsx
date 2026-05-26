import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScriptEvent } from "../types";
import { IconWarning, IconX, IconCheck, IconPlay } from "./Icons";

interface Props {
  events: ScriptEvent[];
  onClear: () => void;
}

const ICONS: Record<string, React.ReactNode> = {
  log: "•",
  warn: <IconWarning />,
  error: <IconX />,
  stderr: <IconX />,
  result: <IconCheck />,
  started: <IconPlay />,
  finished: "■",
};

// #249 — color-code per level (overrides CSS class colors so user
// gets a stronger visual signal at a glance).
const LEVEL_BG: Record<string, string> = {
  log: "transparent",
  warn: "rgba(240,176,48,0.08)",
  error: "rgba(239,79,111,0.10)",
  stderr: "rgba(239,79,111,0.10)",
  result: "rgba(63,199,127,0.08)",
  started: "rgba(160,48,192,0.08)",
  finished: "transparent",
};

const LEVEL_FG: Record<string, string> = {
  log: "var(--text)",
  warn: "#f0b030",
  error: "#ef4f6f",
  stderr: "#ef4f6f",
  result: "#3fc77f",
  started: "#a030c0",
  finished: "var(--text)",
};

function formatTime(ts?: number): string {
  if (!ts) return "";
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function eventToText(event: ScriptEvent): string {
  const time = formatTime(event.ts);
  if (event.type === "result") {
    return `[${time}] result\n${JSON.stringify(event.value, null, 2)}`;
  }
  if (event.type === "started") {
    return `[${time}] started ${event.scriptId}${event.dryRun ? " (dry run)" : ""}`;
  }
  if (event.type === "finished") {
    return `[${time}] finished ${event.succeeded ? "✓" : "✕"} exit=${event.exitCode ?? "?"}`;
  }
  return `[${time}] ${event.type}: ${event.message ?? ""}`;
}

export function LogPanel({ events, onClear }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterLevel, setFilterLevel] = useState<"all" | "warn" | "error">("all");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // #245 — Cmd+F focuses the search input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        // Only intercept if the panel is visible (heuristic: skip when an
        // input is already focused elsewhere)
        const tag = (e.target as HTMLElement | null)?.tagName?.toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setShowSearch(true);
        // Defer focus until input is rendered
        setTimeout(() => searchInputRef.current?.focus(), 30);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearch("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSearch]);

  // #246 — Auto-scroll: respect toggle + detect manual scroll-up
  useEffect(() => {
    if (!autoScroll) return;
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  // If user scrolls up manually, pause auto-scroll until they scroll to bottom
  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    setAutoScroll(atBottom);
  }, []);

  const filtered = useMemo(() => {
    let list = events;
    if (filterLevel === "warn") list = list.filter((e) => e.type === "warn" || e.type === "error" || e.type === "stderr");
    if (filterLevel === "error") list = list.filter((e) => e.type === "error" || e.type === "stderr");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => eventToText(e).toLowerCase().includes(q));
    }
    return list;
  }, [events, filterLevel, search]);

  // #247 — copy all visible events to clipboard
  const copyAll = useCallback(async () => {
    const text = filtered.map(eventToText).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`Copied ${filtered.length} events`);
    } catch {
      setCopyFeedback("Copy failed");
    }
    setTimeout(() => setCopyFeedback(null), 2000);
  }, [filtered]);

  // #248 — download visible events as .txt
  const exportTxt = useCallback(() => {
    const text = filtered.map(eventToText).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = url;
    a.download = `post-agent-logs-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <>
      <div className="log-panel-header" style={{ flexWrap: "wrap", gap: 6 }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          Logs <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
            {filtered.length}{filtered.length !== events.length ? ` / ${events.length}` : ""}
          </span>
        </h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            className="small ghost"
            onClick={() => { setShowSearch((s) => !s); setTimeout(() => searchInputRef.current?.focus(), 30); }}
            title="Cmd+F"
          >
            🔍
          </button>
          <select
            className="small"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as "all" | "warn" | "error")}
            style={{ fontSize: 11 }}
          >
            <option value="all">All</option>
            <option value="warn">Warn+</option>
            <option value="error">Error only</option>
          </select>
          <button
            className="small ghost"
            onClick={() => setAutoScroll((s) => !s)}
            title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            style={{ opacity: autoScroll ? 1 : 0.5 }}
          >
            ↓
          </button>
          <button className="small ghost" onClick={copyAll} disabled={filtered.length === 0} title="Copy">
            ⧉
          </button>
          <button className="small ghost" onClick={exportTxt} disabled={filtered.length === 0} title="Export .txt">
            ⤓
          </button>
          <button className="small ghost" onClick={onClear} disabled={events.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {showSearch && (
        <div style={{
          padding: "6px 12px", borderBottom: "1px solid var(--border)",
          background: "rgba(0,0,0,0.2)",
        }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search logs… (Esc to close)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "4px 8px",
              background: "#0a0518", border: "1px solid #2c1860",
              color: "#f0eaff", borderRadius: 4, fontSize: 12,
            }}
          />
        </div>
      )}

      {copyFeedback && (
        <div style={{
          padding: "4px 12px", background: "rgba(63,199,127,0.15)",
          color: "#3fc77f", fontSize: 11, borderBottom: "1px solid var(--border)",
        }}>{copyFeedback}</div>
      )}

      <div className="log-panel-body" ref={bodyRef} onScroll={onScroll}>
        {filtered.length === 0 ? (
          <div className="empty">
            {events.length === 0
              ? "Run a script to see logs here."
              : `No events match filter${search ? ` "${search}"` : ""}`}
          </div>
        ) : (
          filtered.map((event, idx) => {
            const cls = `log-line ${event.type}${
              event.type === "finished"
                ? event.succeeded ? " success" : " failure"
                : ""
            }`;
            const style: React.CSSProperties = {
              background: LEVEL_BG[event.type] ?? "transparent",
              color: LEVEL_FG[event.type] ?? "var(--text)",
            };
            return (
              <div key={idx} className={cls} style={style}>
                <span className="time">{formatTime(event.ts)}</span>
                <span className="icon">{ICONS[event.type] ?? "·"}</span>
                <div className="body">
                  {renderEventBody(event)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function renderEventBody(event: ScriptEvent): React.ReactNode {
  if (event.type === "result") {
    return (
      <>
        <div>result</div>
        <pre className="result-payload">{JSON.stringify(event.value, null, 2)}</pre>
      </>
    );
  }
  if (event.type === "started") {
    return <>started · {event.scriptId}{event.dryRun ? " (dry run)" : ""}</>;
  }
  if (event.type === "finished") {
    return (
      <>
        finished {event.succeeded ? <IconCheck /> : <IconX />} exit={event.exitCode ?? "?"}
      </>
    );
  }
  return <>{event.message}</>;
}
