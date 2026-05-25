import { useEffect, useRef } from "react";
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

function formatTime(ts?: number): string {
  if (!ts) return "";
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function LogPanel({ events, onClear }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <>
      <div className="log-panel-header">
        <h3 className="section-title" style={{ margin: 0 }}>
          Logs <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{events.length}</span>
        </h3>
        <button className="small ghost" onClick={onClear} disabled={events.length === 0}>
          Clear
        </button>
      </div>
      <div className="log-panel-body" ref={bodyRef}>
        {events.length === 0 ? (
          <div className="empty">Run a script to see logs here.</div>
        ) : (
          events.map((event, idx) => {
            const cls = `log-line ${event.type}${
              event.type === "finished"
                ? event.succeeded
                  ? " success"
                  : " failure"
                : ""
            }`;
            return (
              <div key={idx} className={cls}>
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
