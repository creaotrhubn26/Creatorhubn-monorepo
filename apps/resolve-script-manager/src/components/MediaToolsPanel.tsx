import React, { useCallback, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Media — bibliotek/organisering-verktøy (mer enn reparasjon):
 *  1) clip_usage_report — hvor brukes klipp + ubrukte (read-only).
 *  2) organize_media_pool — foreslå bins (type/kamera/dato) → organiser.
 *  3) consolidate_used_media — kopier kun brukte media til mål-mappe (portabel).
 *  4) robust_audio_sync — finn lyd-offset/korr/drift per kamera↔opptaker-par.
 * KUN ÉN bridge-prosess om gangen — knapper deaktiveres mens busy.
 */

// ── clip_usage_report ──
interface UsageUsedIn { timeline: string; count: number; firstTC?: string }
interface UsageRow { name: string; uses: number; usedIn: UsageUsedIn[] }
interface UsageResult {
  clips: number; used: number; unused: number; timelinesScanned: number;
  usage: UsageRow[]; unusedList: Array<{ name: string; path: string }>; note: string;
}

// ── organize_media_pool ──
type OrgBy = "type" | "camera" | "date";
interface OrgGroup { bin: string; clipCount: number; sample: string[]; binExists: boolean }
interface OrgScan { by: OrgBy; rootClips: number; alreadyBinned: number; groups: OrgGroup[] }
interface OrgApply { created: number; moved: number; groups: number; note: string }

// ── consolidate_used_media ──
interface ConsItem { name: string; path: string; bytes: number }
interface ConsScan {
  usedCount: number; totalCount: number; totalBytesEstimate: number;
  uniqueSourceFiles: number; items: ConsItem[];
}
interface ConsApply {
  copied: number; relinked: number; failed: number; destFolder: string;
  bytesCopied: number; failedPaths?: string[];
  plannedCopies?: number; bytesToCopy?: number; copies?: unknown[]; dryRun?: boolean;
}

// ── robust_audio_sync ──
interface SyncPair {
  camera: string; recorder: string; offsetSec: number; offsetFrames: number;
  corr: number; driftFrames: number; reason: string;
}
interface SyncResult {
  pairs: SyncPair[]; note: string; ffmpegAvailable: boolean;
  driftThresholdFrames?: number; guidance?: string;
}

function humanBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function MediaToolsPanel({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ cur: number; total: number; msg: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // usage
  const [usage, setUsage] = useState<UsageResult | null>(null);
  const [usageExpand, setUsageExpand] = useState<Record<string, boolean>>({});

  // organize
  const [orgBy, setOrgBy] = useState<OrgBy>("type");
  const [orgScan, setOrgScan] = useState<OrgScan | null>(null);
  const [orgApply, setOrgApply] = useState<OrgApply | null>(null);
  const [orgDry, setOrgDry] = useState<boolean>(true);

  // consolidate
  const [consScan, setConsScan] = useState<ConsScan | null>(null);
  const [consApply, setConsApply] = useState<ConsApply | null>(null);
  const [consPreview, setConsPreview] = useState<ConsApply | null>(null);
  const [destFolder, setDestFolder] = useState<string>("");
  const [consDry, setConsDry] = useState<boolean>(true);

  // audio sync
  const [syncMode, setSyncMode] = useState<"pair" | "discovery">("discovery");
  const [cameraPath, setCameraPath] = useState<string>("");
  const [audioPath, setAudioPath] = useState<string>("");
  const [syncRoots, setSyncRoots] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncAdv, setSyncAdv] = useState<boolean>(false);
  const [corrMin, setCorrMin] = useState<number>(0.45);
  const [driftFrames, setDriftFrames] = useState<number>(1.5);
  const [searchS, setSearchS] = useState<number>(90);
  const [windowS, setWindowS] = useState<number>(25);
  const [fps, setFps] = useState<number>(25);

  const run = useCallback(async (id: string, params: Record<string, unknown>, label: string, dryRun = false) => {
    setBusy(label); setProgress(null); setLog((l) => [`▶ ${label}`, ...l].slice(0, 60));
    const un = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "progress") setProgress({ cur: e.current ?? 0, total: e.total ?? 0, msg: e.message ?? "" });
      if (e.type === "log" || e.type === "warn" || e.type === "error")
        setLog((l) => [...l, `${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`].slice(-200));
    });
    try {
      const s = await executeScript(id, params, dryRun);
      return { ok: s.succeeded, value: s.events.find((e) => e.type === "result")?.value as any };
    } finally { un(); setBusy(null); setProgress(null); }
  }, []);

  // ── clip_usage_report ──
  const scanUsage = useCallback(async () => { const r = await run("clip_usage_report", { mode: "scan" }, "Skanner bruk i timelines…"); if (r.ok) setUsage(r.value); }, [run]);

  // ── organize_media_pool ──
  const previewOrg = useCallback(async () => { setOrgApply(null); const r = await run("organize_media_pool", { mode: "scan", by: orgBy }, "Forhåndsviser bins…"); if (r.ok) setOrgScan(r.value); }, [run, orgBy]);
  const applyOrg = useCallback(async () => {
    if (!orgScan || orgScan.rootClips === 0) return;
    if (!orgDry && !window.confirm(`Dette flytter klipp i Media Pool (grupper etter ${orgBy}). Fortsette?`)) return;
    const r = await run("organize_media_pool", { mode: "apply", by: orgBy, "dry-run": orgDry }, orgDry ? "Forhåndsviser organisering…" : "Organiserer Media Pool…", orgDry);
    if (r.ok) { setOrgApply(r.value); if (!orgDry) await previewOrg(); }
  }, [run, orgScan, orgBy, orgDry, previewOrg]);

  // ── consolidate_used_media ──
  const scanCons = useCallback(async () => { setConsApply(null); setConsPreview(null); const r = await run("consolidate_used_media", { mode: "scan" }, "Skanner brukte media…"); if (r.ok) setConsScan(r.value); }, [run]);
  const pickDest = useCallback(async () => {
    const p = await openDialog({ directory: true, multiple: false });
    if (typeof p === "string") setDestFolder(p);
  }, []);
  const previewCons = useCallback(async () => {
    if (!destFolder) return;
    setConsApply(null);
    const r = await run("consolidate_used_media", { mode: "apply", destFolder }, "Planlegger kopiering…", true);
    if (r.ok) setConsPreview(r.value);
  }, [run, destFolder]);
  const applyCons = useCallback(async () => {
    if (!destFolder) return;
    if (!consDry && !window.confirm(`Kopier brukte media til ${destFolder} og re-lenk klippene? Husk å lagre prosjektet etterpå.`)) return;
    const r = await run("consolidate_used_media", { mode: "apply", destFolder }, consDry ? "Planlegger kopiering…" : "Gjør portabel (kopierer)…", consDry);
    if (r.ok) { if (consDry) setConsPreview(r.value); else { setConsApply(r.value); setConsPreview(null); } }
  }, [run, destFolder, consDry]);

  // ── robust_audio_sync ──
  const addSyncRoot = useCallback(async () => {
    const p = await openDialog({ directory: true, multiple: true });
    const arr = Array.isArray(p) ? p : typeof p === "string" ? [p] : [];
    if (arr.length) setSyncRoots((r) => Array.from(new Set([...r, ...arr])));
  }, []);
  const pickCamera = useCallback(async () => { const p = await openDialog({ multiple: false }); if (typeof p === "string") setCameraPath(p); }, []);
  const pickAudio = useCallback(async () => { const p = await openDialog({ multiple: false }); if (typeof p === "string") setAudioPath(p); }, []);
  const syncParams = useCallback((): Record<string, unknown> => {
    const base: Record<string, unknown> = { corrMin, driftFrames, searchS, windowS, fps };
    if (syncMode === "pair") return { ...base, cameraPath, audioPath };
    return { ...base, searchRoots: syncRoots };
  }, [syncMode, corrMin, driftFrames, searchS, windowS, fps, cameraPath, audioPath, syncRoots]);
  const scanSync = useCallback(async () => { const r = await run("robust_audio_sync", { mode: "scan", ...syncParams() }, "Skanner lyd-sync…"); if (r.ok) setSyncResult(r.value); }, [run, syncParams]);
  const recommendSync = useCallback(async () => { const r = await run("robust_audio_sync", { mode: "apply", ...syncParams() }, "Henter fiks-anbefalinger…"); if (r.ok) setSyncResult(r.value); }, [run, syncParams]);

  const driftThr = syncResult?.driftThresholdFrames ?? 1.5;

  return (
    <div style={{ padding: 20, color: "#eee", maxWidth: 960, margin: "0 auto" }}>
      <style>{`@keyframes svbspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Media</h2><button onClick={onClose} style={btnSm}>Lukk</button>
      </div>
      <p style={{ opacity: 0.7, fontSize: 13 }}>Bibliotek- og organiserings-verktøy: hvor brukes klipp, organiser Media Pool, gjør prosjektet portabelt, og synk lyd.</p>
      {busy && (
        <div style={{ margin: "6px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Spinner /><span style={{ fontSize: 12 }}>{busy}{progress && progress.total ? ` ${progress.cur}/${progress.total}` : ""}{progress?.msg ? ` — ${progress.msg}` : ""}</span></div>
          {progress && progress.total > 0 && (
            <div style={{ height: 5, background: "#26262e", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, Math.round((progress.cur / progress.total) * 100))}%`, background: "#a78bfa" }} />
            </div>
          )}
        </div>
      )}

      {/* CLIP USAGE REPORT */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Klipp-bruk (hvor brukes / ubrukt)</b>
          <button onClick={scanUsage} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann bruk</button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>Kun lesing — skanner alle timelines og rapporterer hvor hvert klipp brukes. Sletter ingenting.</p>
        {usage && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {usage.note && <div style={banner}>{usage.note}</div>}
            <div style={{ opacity: 0.75, margin: "6px 0" }}>
              {usage.clips} klipp · <b style={{ color: "#4ad48a" }}>{usage.used} i bruk</b> · <b style={{ color: usage.unused ? "#ff9b8a" : "#9f9" }}>{usage.unused} ubrukt</b> · {usage.timelinesScanned} timelines skannet
            </div>
            {/* I BRUK */}
            <div style={{ fontWeight: 600, opacity: 0.7, margin: "8px 0 4px" }}>I bruk</div>
            <div style={{ maxHeight: 240, overflow: "auto" }}>
              <table style={tbl}>
                <thead><tr><th style={th}></th><th style={th}>Navn</th><th style={{ ...th, textAlign: "right" }}>Bruk</th></tr></thead>
                <tbody>
                  {[...usage.usage].sort((a, b) => b.uses - a.uses).map((row, i) => {
                    const open = !!usageExpand[row.name];
                    return (
                      <React.Fragment key={i}>
                        <tr onClick={() => setUsageExpand((m) => ({ ...m, [row.name]: !open }))} style={{ cursor: "pointer" }}>
                          <td style={{ ...td, width: 18 }}>{row.usedIn.length ? (open ? "▾" : "▸") : ""}</td>
                          <td style={td}><b>{row.name}</b></td>
                          <td style={{ ...td, textAlign: "right" }}>{row.uses}</td>
                        </tr>
                        {open && row.usedIn.map((u, j) => (
                          <tr key={`${i}-${j}`}>
                            <td style={td}></td>
                            <td style={{ ...td, opacity: 0.7 }} colSpan={2}>
                              {u.timeline} · {u.count}× {u.firstTC ? `· @ ${u.firstTC}` : ""}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* UBRUKT */}
            <div style={{ fontWeight: 600, opacity: 0.7, margin: "10px 0 4px" }}>Ubrukt</div>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>«Ubrukt» betyr kun at klippet ikke er på noen timeline i dette prosjektet — ingenting slettes.</div>
            <div style={{ maxHeight: 200, overflow: "auto" }}>
              <table style={tbl}>
                <thead><tr><th style={th}>Navn</th><th style={th}>Sti</th></tr></thead>
                <tbody>
                  {usage.unusedList.map((u, i) => (
                    <tr key={i}>
                      <td style={td}><b>{u.name}</b></td>
                      <td style={{ ...td, opacity: 0.6, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.path}>{u.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ORGANIZE MEDIA POOL */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Organiser Media Pool</b>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Grupper etter:</span>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
              {(["type", "camera", "date"] as OrgBy[]).map((b) => (
                <button key={b} onClick={() => setOrgBy(b)} disabled={!!busy}
                  style={{ padding: "5px 10px", fontSize: 12, border: "none", cursor: "pointer", background: orgBy === b ? "#7c5cff" : "#26262e", color: orgBy === b ? "#fff" : "#ddd" }}>
                  {b === "type" ? "Type" : b === "camera" ? "Kamera" : "Dato"}
                </button>
              ))}
            </div>
            <button onClick={previewOrg} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Forhåndsvis</button>
          </div>
        </div>
        {orgScan && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div style={{ opacity: 0.75, marginBottom: 4 }}>
              {orgScan.rootClips} klipp i roten · <span style={{ opacity: 0.6 }}>{orgScan.alreadyBinned} ligger allerede i bins og røres ikke.</span>
            </div>
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {orgScan.groups.map((g, i) => (
                <div key={i} style={{ ...sub, background: "#16161b", borderColor: g.binExists ? "#444" : "#2e7d32" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={badge("#a78bfa")}>{g.clipCount}</span>
                    <b>{g.bin}</b>
                    {g.binExists && <span style={{ fontSize: 10, opacity: 0.6 }}>(finnes)</span>}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{g.sample.slice(0, 5).join(" · ")}{g.sample.length > 5 ? " …" : ""}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                <input type="checkbox" checked={orgDry} onChange={(e) => setOrgDry(e.target.checked)} disabled={!!busy} /> Dry-run
              </label>
              <button onClick={applyOrg} disabled={!!busy || orgScan.rootClips === 0} style={(!!busy || orgScan.rootClips === 0) ? btnDis : btnPrimary}>Organiser nå</button>
            </div>
            {orgApply && (
              <div style={{ ...banner, borderLeftColor: "#4ad48a", marginTop: 6 }}>
                ✓ {orgApply.created} bins opprettet · {orgApply.moved} klipp flyttet ({orgApply.groups} grupper). {orgApply.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONSOLIDATE USED MEDIA */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Gjør portabel (konsolider brukte media)</b>
          <button onClick={scanCons} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann brukte media</button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>Kopierer kun de mediafilene som faktisk brukes, til én mål-mappe, og re-lenker klippene. Husk å lagre prosjektet etterpå.</p>
        {consScan && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div style={{ opacity: 0.85, marginBottom: 6 }}>
              <b>{consScan.usedCount}</b> av {consScan.totalCount} klipp brukes · {consScan.uniqueSourceFiles} unike kildefiler · ~<b>{humanBytes(consScan.totalBytesEstimate)}</b>
            </div>
            <div style={{ maxHeight: 220, overflow: "auto" }}>
              <table style={tbl}>
                <thead><tr><th style={th}>Navn</th><th style={{ ...th, textAlign: "right" }}>Størrelse</th></tr></thead>
                <tbody>
                  {consScan.items.map((it, i) => (
                    <tr key={i}>
                      <td style={td} title={it.path}><b>{it.name}</b></td>
                      <td style={{ ...td, textAlign: "right", opacity: 0.75 }}>{humanBytes(it.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* mål-mappe */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
              <button onClick={pickDest} disabled={!!busy} style={btnSm}>Velg mål-mappe…</button>
              <span style={{ fontSize: 11, opacity: destFolder ? 0.85 : 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{destFolder || "ingen mappe valgt"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                <input type="checkbox" checked={consDry} onChange={(e) => setConsDry(e.target.checked)} disabled={!!busy} /> Dry-run
              </label>
              <button onClick={previewCons} disabled={!!busy || !destFolder} style={(!!busy || !destFolder) ? btnDis : btnSm}>Forhåndsvis (dry-run)</button>
              <button onClick={applyCons} disabled={!!busy || !destFolder} style={(!!busy || !destFolder) ? btnDis : btnPrimary}>Gjør portabel</button>
            </div>
            {consPreview && (
              <div style={{ ...banner, marginTop: 6 }}>
                Forhåndsvisning: {consPreview.plannedCopies ?? consPreview.copies?.length ?? 0} filer vil kopieres (~{humanBytes(consPreview.bytesToCopy ?? 0)}) til {consPreview.destFolder}.
              </div>
            )}
            {consApply && (
              <div style={{ ...banner, borderLeftColor: consApply.failed ? "#f5b50b" : "#4ad48a", marginTop: 6 }}>
                ✓ {consApply.copied} kopiert · {consApply.relinked} re-lenket{consApply.failed ? ` · ⚠ ${consApply.failed} feilet` : ""} · {humanBytes(consApply.bytesCopied)} til {consApply.destFolder}.
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3 }}>Klipp-lenker ble endret — lagre prosjektet (Cmd+S) i Resolve.</div>
                {consApply.failedPaths && consApply.failedPaths.length > 0 && consApply.failedPaths.map((p, i) => <div key={i} style={{ fontSize: 11, opacity: 0.7 }}>{p}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ROBUST AUDIO SYNC */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Robust lyd-sync (offset / korr / drift)</b>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={scanSync} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann sync</button>
            <button onClick={recommendSync} disabled={!!busy} style={busy ? btnDis : btnSm}>Anbefal fiks</button>
          </div>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>«Anbefal fiks» endrer ikke timelinen — den gir lese-anbefalinger (nudge per klipp eller bruk rebuild-flyten).</p>
        {/* modus-toggle */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {(["discovery", "pair"] as const).map((m) => (
            <button key={m} onClick={() => setSyncMode(m)} disabled={!!busy}
              style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #333", borderRadius: 6, cursor: "pointer", background: syncMode === m ? "#7c5cff" : "#26262e", color: syncMode === m ? "#fff" : "#ddd" }}>
              {m === "discovery" ? "Søk i mapper" : "Eksplisitt par"}
            </button>
          ))}
        </div>
        {syncMode === "pair" ? (
          <div style={{ marginTop: 8, fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={pickCamera} disabled={!!busy} style={btnSm}>Kamera-klipp (scratch)…</button>
              <span style={{ fontSize: 11, opacity: cameraPath ? 0.85 : 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cameraPath || "ikke valgt"}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={pickAudio} disabled={!!busy} style={btnSm}>Opptaker-fil…</button>
              <span style={{ fontSize: 11, opacity: audioPath ? 0.85 : 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audioPath || "ikke valgt"}</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ opacity: 0.75 }}>Søke-mapper — velg opptak + opptaker-mappene (IKKE hele /Volumes)</span>
              <button onClick={addSyncRoot} disabled={!!busy} style={btnSm}>Legg til mappe…</button>
            </div>
            {syncRoots.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#101015", border: "1px solid #2a2a33", borderRadius: 6, padding: "4px 8px", marginTop: 4 }}>
                <span style={{ fontSize: 11, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r}</span>
                <button onClick={() => setSyncRoots((x) => x.filter((_, j) => j !== i))} disabled={!!busy} style={{ ...btnSm, padding: "2px 8px" }}>×</button>
              </div>
            ))}
          </div>
        )}
        {/* avansert */}
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setSyncAdv((s) => !s)} style={{ ...btnSm, padding: "3px 8px" }}>{syncAdv ? "Skjul avansert" : "Avansert…"}</button>
          {syncAdv && (
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, flexWrap: "wrap" }}>
              <NumField label="corrMin" value={corrMin} step={0.05} onChange={setCorrMin} busy={!!busy} />
              <NumField label="driftFrames" value={driftFrames} step={0.5} onChange={setDriftFrames} busy={!!busy} />
              <NumField label="searchS" value={searchS} step={5} onChange={setSearchS} busy={!!busy} />
              <NumField label="windowS" value={windowS} step={5} onChange={setWindowS} busy={!!busy} />
              <NumField label="fps" value={fps} step={1} onChange={setFps} busy={!!busy} />
            </div>
          )}
        </div>
        {syncResult && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {syncResult.note && <div style={{ ...banner, fontWeight: 600 }}>{syncResult.note}</div>}
            {syncResult.ffmpegAvailable === false && (
              <div style={{ ...banner, borderLeftColor: "#f5b50b", marginTop: 4 }}>⚠ ffmpeg mangler — installer med <code>brew install ffmpeg</code> for å beregne sync.</div>
            )}
            {syncResult.guidance && <div style={{ ...banner, marginTop: 4 }}>{syncResult.guidance}</div>}
            <div style={{ maxHeight: 280, overflow: "auto", marginTop: 6 }}>
              <table style={tbl}>
                <thead><tr><th style={th}>Kamera</th><th style={th}>Opptaker</th><th style={th}>Offset</th><th style={th}>Korr</th><th style={th}>Drift</th><th style={th}>Status</th></tr></thead>
                <tbody>
                  {syncResult.pairs.map((p, i) => {
                    const corrOk = p.corr >= corrMin;
                    const driftBad = Math.abs(p.driftFrames) >= driftThr;
                    const confident = /confident|sikker|ok/i.test(p.reason || "");
                    return (
                      <tr key={i}>
                        <td style={td} title={p.camera}><b>{p.camera.split("/").pop()}</b></td>
                        <td style={td} title={p.recorder}>{p.recorder.split("/").pop()}</td>
                        <td style={td}>{p.offsetSec.toFixed(3)}s <span style={{ opacity: 0.55 }}>({p.offsetFrames}f)</span></td>
                        <td style={{ ...td, color: corrOk ? "#4ad48a" : "#f5b50b", fontWeight: 600 }}>{p.corr.toFixed(2)}</td>
                        <td style={{ ...td, color: driftBad ? "#f5b50b" : "inherit" }}>{p.driftFrames.toFixed(1)}f</td>
                        <td style={td}><span style={badge(confident ? "#4ad48a" : "#f5b50b")}>{confident ? "Sikker" : "Sjekk"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...card, fontFamily: "monospace", fontSize: 11, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap" }}>
        {log.length ? log.join("\n") : "Logg vises her når du skanner."}
      </div>
    </div>
  );
}

function NumField({ label, value, step, onChange, busy }: { label: string; value: number; step: number; onChange: (n: number) => void; busy: boolean }) {
  return (
    <label style={{ display: "flex", gap: 5, alignItems: "center" }}>{label}
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} disabled={busy} style={{ ...input, width: 80 }} />
    </label>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 15, height: 15, border: "2px solid #4a3f7a", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "svbspin 0.7s linear infinite" }} />;
}
const card: React.CSSProperties = { background: "#16161b", border: "1px solid #2a2a33", borderRadius: 8, padding: 12, marginBottom: 10 };
const sub: React.CSSProperties = { background: "#1c1410", border: "1px solid #444", borderRadius: 6, padding: 8, marginTop: 6 };
const btnPrimary: React.CSSProperties = { padding: "6px 12px", background: "#7c5cff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const btnSm: React.CSSProperties = { padding: "5px 10px", background: "#26262e", color: "#ddd", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const btnDis: React.CSSProperties = { ...btnPrimary, background: "#333", color: "#888", cursor: "not-allowed" };
const banner: React.CSSProperties = { background: "#101015", border: "1px solid #2a2a33", borderLeft: "3px solid #7c5cff", borderRadius: 6, padding: "6px 10px", fontSize: 12, marginTop: 4 };
const input: React.CSSProperties = { background: "#101015", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "5px 8px", fontSize: 12 };
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #2a2a33", opacity: 0.6, fontWeight: 600, position: "sticky", top: 0, background: "#16161b" };
const td: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #20202a", verticalAlign: "top" };
function badge(color: string): React.CSSProperties {
  return { display: "inline-block", padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, color, background: `${color}22`, border: `1px solid ${color}55` };
}
