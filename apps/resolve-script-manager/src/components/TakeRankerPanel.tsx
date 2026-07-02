import { useCallback, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Take-rangering (menneske-i-loop). AI stabler kandidat-takes, transkriberer,
 * skiller barn/voksen på grunntone og coaching/performance på kontekst, og
 * rangerer med begrunnelse — men mennesket velger selv. Kaller `take_ranker`.
 */

interface Take {
  path: string; name: string; text: string; score: number; f0_hz: number | null;
  voice: string; clarity: number; snr_db: number; dur_s: number;
  text_match: number | null; reasons: string[]; flags: string[];
}
interface Result { ranked: Take[]; expect_text: string | null; expect_child: boolean | null }

export function TakeRankerPanel() {
  const [folder, setFolder] = useState("");
  const [expectText, setExpectText] = useState("");
  const [expectChild, setExpectChild] = useState<"" | "ja" | "nei">("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [res, setRes] = useState<Result | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const pickFolder = useCallback(async () => {
    const f = await openDialog({ directory: true, multiple: false });
    if (typeof f === "string") setFolder(f);
  }, []);

  const rank = useCallback(async () => {
    if (!folder) { setLog(["Velg en mappe med takes først"]); return; }
    setBusy(true); setRes(null); setPicked(null); setLog(["▶ Rangerer takes…"]);
    const un = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "log" || e.type === "warn" || e.type === "error")
        setLog((l) => [`${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`, ...l].slice(0, 40));
    });
    try {
      const params: Record<string, unknown> = { folder };
      if (expectText.trim()) params.expect_text = expectText.trim();
      if (expectChild) params.expect_child = expectChild === "ja";
      const s = await executeScript("take_ranker", params, false);
      const v = s.events.find((ev) => ev.type === "result")?.value as Result | undefined;
      if (s.succeeded && v) setRes(v);
    } finally { un(); setBusy(false); }
  }, [folder, expectText, expectChild]);

  return (
    <div style={{ border: "1px solid #2a2340", borderRadius: 10, padding: 14, background: "#181328", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#e6ddf5" }}>Take-rangering</h3>
        <span style={{ fontSize: 12, color: "#8674a8" }}>· AI rangerer, du velger</span>
      </div>
      <p style={{ fontSize: 11, color: "#8674a8", margin: "0 0 10px" }}>
        AI stabler kandidat-takes og forklarer hvorfor (tekst-treff, klarhet, barn/voksen, støy) — men velger aldri selv.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={pickFolder} style={{ background: "#2a2340", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Velg mappe med takes…</button>
        <span style={{ fontSize: 12, color: "#8674a8", alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{folder ? folder.split("/").pop() : "ingen valgt"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input value={expectText} onChange={(e) => setExpectText(e.target.value)} placeholder="Forventet replikk (valgfritt)"
          style={{ flex: 1, minWidth: 180, background: "#0f0b1c", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 6, padding: "6px 10px", fontSize: 12 }} />
        <select value={expectChild} onChange={(e) => setExpectChild(e.target.value as "" | "ja" | "nei")}
          style={{ background: "#0f0b1c", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
          <option value="">stemme: valgfri</option>
          <option value="ja">barnestemme</option>
          <option value="nei">voksenstemme</option>
        </select>
        <button onClick={rank} disabled={busy} style={{ background: "#ff8c00", border: "none", color: "#1a1400", borderRadius: 8, padding: "6px 14px", cursor: busy ? "default" : "pointer", fontSize: 12, fontWeight: 700 }}>{busy ? "Rangerer…" : "Ranger takes"}</button>
      </div>

      {res && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflow: "auto" }}>
          {res.ranked.map((t, i) => (
            <div key={t.path} onClick={() => setPicked(t.path)} style={{
              cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: picked === t.path ? "#241f3a" : "#0f0b1c",
              border: `1px solid ${picked === t.path ? "#ff8c00" : "#2a2340"}`,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: i === 0 ? "#ff8c00" : "#8674a8", fontWeight: 700, minWidth: 20 }}>#{i + 1}</span>
                <span style={{ color: "#e6ddf5", fontSize: 12, flex: 1 }}>{t.name}</span>
                {picked === t.path && <span style={{ color: "#ff8c00", fontSize: 11, fontWeight: 700 }}>✓ valgt</span>}
                <span style={{ color: "#8674a8", fontSize: 11 }}>score {t.score}</span>
              </div>
              <div style={{ color: "#a394c4", fontSize: 11, margin: "2px 0 0 28px" }}>«{t.text}»</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "3px 0 0 28px" }}>
                {t.reasons.map((r, j) => <span key={j} style={{ fontSize: 10, color: "#8674a8", background: "#181328", borderRadius: 4, padding: "1px 6px" }}>{r}</span>)}
                {t.flags.map((f, j) => <span key={"f" + j} style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.1)", borderRadius: 4, padding: "1px 6px" }}>⚠ {f}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
      {picked && <div style={{ fontSize: 11, color: "#4ad48a", marginTop: 8 }}>Valgt: {picked.split("/").pop()} — dra denne inn på timelinen din.</div>}
      {log.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 60, overflow: "auto", fontSize: 11, color: "#8674a8", fontFamily: "monospace" }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
