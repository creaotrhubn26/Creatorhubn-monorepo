import { useCallback, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Reparér — «Resolve gjør dette dårlig»-løsere samlet:
 *  1) Missing LUT: skann → finn .cube på disk → fiks noden.
 *  2) Manglende media: skann offline klipp → Spotlight → relink.
 *  3) Offline-diagnose: per-klipp årsaks-analyse (read-only).
 *  4) Batch root-remap: bytt felles sti-prefiks for hele disk-flytt.
 *  5) Smart relink: innholds-skåret kandidat-matching per offline klipp.
 *  6) Dubletter: finn klipp med samme sti / disk-kopier.
 * Mønster: Skann → liste (hva mangler + funnet sted) → Fiks/Relink (per / alle / velg fil).
 */
interface MissingLut { lut: string; name: string; clipCount: number; foundAt: string[]; autoFixable: boolean; }
interface OfflineClip { name: string; oldPath: string; foundAt: string[]; autoFixable: boolean; }

// ── offline_diagnose ──
type DiagCause = "online" | "path_missing" | "cloud_placeholder" | "codec_or_attr";
interface DiagItem { name: string; path: string; cause: DiagCause; suggestion: string; }
interface DiagResult {
  clips: number;
  counts: { online: number; path_missing: number; cloud_placeholder: number; codec_or_attr: number };
  items: DiagItem[];
  note: string;
}
const CAUSE_COLOR: Record<DiagCause, string> = {
  online: "#4ad48a",
  cloud_placeholder: "#f5b50b",
  codec_or_attr: "#ff9b3a",
  path_missing: "#ef4f6f",
};
const CAUSE_LABEL: Record<DiagCause, string> = {
  online: "Online",
  cloud_placeholder: "Sky-plassholder",
  codec_or_attr: "Codec/attributt",
  path_missing: "Sti mangler",
};

// ── batch_root_remap ──
interface RemapGroup {
  oldPrefix: string;
  suggestedNewPrefix: string;
  confident: boolean;
  clipCount: number;
  sampleOld: string;
  sampleFound: string;
}
interface RemapScan { groups: RemapGroup[]; note?: string }
interface RemapApply { remapped: number; failed: number; failedPaths?: string[]; wouldRemap?: string[] }

// ── smart_relink ──
interface SmartCandidate { path: string; score: number; why: string }
interface SmartItem {
  name: string;
  oldPath: string;
  known?: Record<string, unknown>;
  candidates: SmartCandidate[];
  autoMatch?: string | null;
}
interface SmartScan {
  clips: number; online: number; offline: number;
  ffprobe: boolean; autoMatchable: number;
  items: SmartItem[]; needsSearchRoots?: boolean; note?: string;
}
interface SmartApply { relinked: number; failed: number; failedPaths?: string[] }

// ── find_duplicate_clips ──
interface DupGroup { path: string; count: number; names: string[]; binLocations: string[] }
interface DupSameName { basename: string; paths: string[] }
interface DupResult {
  totalClips: number; uniquePaths: number; redundantEntries: number;
  duplicateGroups: DupGroup[]; sameNameDiffPath: DupSameName[]; note: string;
}

export function RepairPanel({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ cur: number; total: number; msg: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [lut, setLut] = useState<{ referencedLuts: number; presentLuts: number; missing: MissingLut[]; note: string } | null>(null);
  const [media, setMedia] = useState<{ clips: number; online: number; offline: number; items: OfflineClip[]; note: string } | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({}); // key -> valgt fil
  const [roots, setRoots] = useState<string[]>([]); // kilde-plassering(er) du velger FØR skann
  // offline_diagnose
  const [diag, setDiag] = useState<DiagResult | null>(null);
  // batch_root_remap
  const [remap, setRemap] = useState<RemapScan | null>(null);
  const [remapEdits, setRemapEdits] = useState<Record<string, string>>({}); // oldPrefix -> newPrefix (editert)
  const [remapPreview, setRemapPreview] = useState<RemapApply | null>(null);
  const [remapDone, setRemapDone] = useState<RemapApply | null>(null);
  // smart_relink
  const [smart, setSmart] = useState<SmartScan | null>(null);
  const [smartPick, setSmartPick] = useState<Record<string, string>>({}); // oldPath -> newPath
  const [smartDone, setSmartDone] = useState<SmartApply | null>(null);
  const [smartMaxCand, setSmartMaxCand] = useState<number>(25);
  const [smartAutoScore, setSmartAutoScore] = useState<number>(0.6);
  const [smartDry, setSmartDry] = useState<boolean>(true);
  const [smartAdv, setSmartAdv] = useState<boolean>(false);
  // find_duplicate_clips
  const [dup, setDup] = useState<DupResult | null>(null);

  const run = useCallback(async (id: string, params: Record<string, unknown>, label: string) => {
    setBusy(label); setProgress(null); setLog((l) => [`▶ ${label}`, ...l].slice(0, 60));
    const un = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "progress") setProgress({ cur: e.current ?? 0, total: e.total ?? 0, msg: e.message ?? "" });
      if (e.type === "log" || e.type === "warn" || e.type === "error")
        setLog((l) => [...l, `${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`].slice(-200));
    });
    try {
      const s = await executeScript(id, params, false);
      return { ok: s.succeeded, value: s.events.find((e) => e.type === "result")?.value as any };
    } finally { un(); setBusy(null); setProgress(null); }
  }, []);

  const scanLut = useCallback(async () => { const r = await run("fix_missing_luts", { mode: "scan" }, "Skanner LUT-er…"); if (r.ok) setLut(r.value); }, [run]);
  const scanMedia = useCallback(async () => { const r = await run("relink_missing_media", { mode: "scan", searchRoots: roots }, "Skanner media + lyd…"); if (r.ok) setMedia(r.value); }, [run, roots]);

  const addRoot = useCallback(async () => {
    const p = await openDialog({ directory: true, multiple: true });
    const arr = Array.isArray(p) ? p : typeof p === "string" ? [p] : [];
    if (arr.length) setRoots((r) => Array.from(new Set([...r, ...arr])));
  }, []);

  const pickFile = useCallback(async (key: string) => {
    const p = await openDialog({ multiple: false, defaultPath: roots[0] });
    if (typeof p === "string") setPicked((m) => ({ ...m, [key]: p }));
  }, [roots]);

  const fixLut = useCallback(async (m: MissingLut) => {
    const src = picked[m.lut] || m.foundAt[0];
    if (!src) { setLog((l) => [...l, "Velg en .cube-fil først."]); return; }
    const r = await run("fix_missing_luts", { mode: "fix", lutRef: m.lut, sourcePath: src }, `Fikser ${m.name}…`);
    if (r.ok) await scanLut();
  }, [run, picked, scanLut]);

  const relink = useCallback(async (c: OfflineClip) => {
    const np = picked[c.oldPath] || c.foundAt[0];
    if (!np) { setLog((l) => [...l, "Velg fil først."]); return; }
    const r = await run("relink_missing_media", { mode: "relink", relinks: [{ oldPath: c.oldPath, newPath: np }] }, `Relinker ${c.name}…`);
    if (r.ok) await scanMedia();
  }, [run, picked, scanMedia]);

  const relinkAuto = useCallback(async () => { const r = await run("relink_missing_media", { mode: "relink", auto: true }, "Relinker alle (ett-treff)…"); if (r.ok) await scanMedia(); }, [run, scanMedia]);

  // ── offline_diagnose (read-only) ──
  const scanDiag = useCallback(async () => { const r = await run("offline_diagnose", { mode: "scan" }, "Diagnostiserer offline-klipp…"); if (r.ok) setDiag(r.value); }, [run]);

  // ── batch_root_remap ──
  const remapMappings = useCallback((): Array<{ oldPrefix: string; newPrefix: string }> => {
    if (!remap) return [];
    return remap.groups
      .map((g) => ({ oldPrefix: g.oldPrefix, newPrefix: (remapEdits[g.oldPrefix] ?? g.suggestedNewPrefix).trim() }))
      .filter((m) => m.newPrefix.length > 0);
  }, [remap, remapEdits]);
  const scanRemap = useCallback(async () => {
    setRemapPreview(null); setRemapDone(null); setRemapEdits({});
    const r = await run("batch_root_remap", { mode: "scan" }, "Skanner sti-prefikser…");
    if (r.ok) setRemap(r.value);
  }, [run]);
  const previewRemap = useCallback(async () => {
    const mappings = remapMappings();
    if (!mappings.length) { setLog((l) => [...l, "Fyll inn minst ett nytt prefiks først."]); return; }
    setRemapDone(null);
    const r = await run("batch_root_remap", { mode: "apply", mappings, dryRun: true }, "Forhåndsviser remap…");
    if (r.ok) setRemapPreview(r.value);
  }, [run, remapMappings]);
  const applyRemap = useCallback(async () => {
    const mappings = remapMappings();
    if (!mappings.length) { setLog((l) => [...l, "Fyll inn minst ett nytt prefiks først."]); return; }
    const r = await run("batch_root_remap", { mode: "apply", mappings }, "Utfører remap…");
    if (r.ok) { setRemapDone(r.value); setRemapPreview(null); await scanRemap(); }
  }, [run, remapMappings, scanRemap]);

  // ── smart_relink ──
  const scanSmart = useCallback(async () => {
    setSmartDone(null); setSmartPick({});
    const r = await run("smart_relink", { mode: "scan", searchRoots: roots, maxCandidatesPerRoot: smartMaxCand, autoScore: smartAutoScore }, "Smart skann (innhold)…");
    if (r.ok) {
      const v = r.value as SmartScan;
      setSmart(v);
      // pre-velg autoMatch
      const pre: Record<string, string> = {};
      (v?.items || []).forEach((it) => { if (it.autoMatch) pre[it.oldPath] = it.autoMatch; });
      setSmartPick(pre);
    }
  }, [run, roots, smartMaxCand, smartAutoScore]);
  const relinkSmart = useCallback(async (dryRun: boolean) => {
    const relinks = Object.entries(smartPick).map(([oldPath, newPath]) => ({ oldPath, newPath })).filter((r) => r.newPath);
    if (!relinks.length) { setLog((l) => [...l, "Velg minst én kandidat først."]); return; }
    const r = await run("smart_relink", { mode: "apply", relinks }, dryRun ? "Forhåndsviser relink…" : "Relinker valgte…");
    if (r.ok) { setSmartDone(r.value); if (!dryRun) await scanSmart(); }
  }, [run, smartPick, scanSmart]);

  // ── find_duplicate_clips (read-only) ──
  const scanDup = useCallback(async () => { const r = await run("find_duplicate_clips", { mode: "scan" }, "Skanner etter dubletter…"); if (r.ok) setDup(r.value); }, [run]);

  const foundCount = useMemo(() => (media?.items || []).filter((c) => c.foundAt.length > 0 || !!picked[c.oldPath]).length, [media, picked]);

  return (
    <div style={{ padding: 20, color: "#eee", maxWidth: 920, margin: "0 auto" }}>
      <style>{`@keyframes svbspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Reparér</h2><button onClick={onClose} style={btnSm}>Lukk</button>
      </div>
      <p style={{ opacity: 0.7, fontSize: 13 }}>Finn og fiks det Resolve håndterer dårlig: manglende LUT-er og offline media. Skann → finn på disk → fiks.</p>
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

      {/* MISSING LUT */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Missing LUT</b>
          <button onClick={scanLut} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann LUT-er</button>
        </div>
        {lut && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {lut.referencedLuts} referert · {lut.presentLuts} finnes ·{" "}
            <b style={{ color: lut.missing.length ? "#ff9b8a" : "#9f9" }}>{lut.missing.length} mangler</b>
            {lut.missing.map((m, i) => (
              <div key={i} style={{ ...sub, borderColor: "#c0392b" }}>
                <div><b>{m.name}</b> · {m.clipCount} klipp · ref: <span style={{ opacity: 0.6 }}>{m.lut}</span></div>
                <div style={{ fontSize: 11, opacity: 0.85, margin: "3px 0" }}>
                  {m.foundAt.length ? `Funnet: ${m.foundAt[0]}` : (picked[m.lut] ? `Valgt: ${picked[m.lut]}` : "⚠️ ikke funnet automatisk")}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => pickFile(m.lut)} disabled={!!busy} style={btnSm}>Velg .cube…</button>
                  <button onClick={() => fixLut(m)} disabled={!!busy || !(m.foundAt[0] || picked[m.lut])} style={(!!busy || !(m.foundAt[0] || picked[m.lut])) ? btnDis : btnPrimary}>Fiks node(r)</button>
                </div>
              </div>
            ))}
            {!lut.missing.length && <div style={{ color: "#9f9", marginTop: 4 }}>✓ {lut.note}</div>}
          </div>
        )}
      </div>

      {/* MANGLENDE MEDIA + LYD */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Manglende media & lyd (offline)</b>
          <div style={{ display: "flex", gap: 6 }}>
            {media && media.offline > 0 && <button onClick={relinkAuto} disabled={!!busy} style={busy ? btnDis : btnSm}>Relink alle (ett-treff)</button>}
            <button onClick={scanMedia} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann media & lyd</button>
          </div>
        </div>
        {/* Kilde-plassering: velg FØR skann hvor media/lyd ligger (eks. ekstern disk) */}
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ opacity: 0.75 }}>Kilde-plassering (hvor media & lyd ligger){roots.length ? "" : " — valgfritt, Spotlight søker uansett"}</span>
            <button onClick={addRoot} disabled={!!busy} style={btnSm}>Legg til mappe…</button>
          </div>
          {roots.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#101015", border: "1px solid #2a2a33", borderRadius: 6, padding: "4px 8px", marginTop: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r}</span>
              <button onClick={() => setRoots((x) => x.filter((_, j) => j !== i))} disabled={!!busy} style={{ ...btnSm, padding: "2px 8px" }}>×</button>
            </div>
          ))}
        </div>
        {media && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {media.clips} klipp · {media.online} online ·{" "}
            <b style={{ color: media.offline ? "#ff9b8a" : "#9f9" }}>{media.offline} offline</b>
            {media.offline > 0 && <> · <b style={{ color: "#9f9" }}>{foundCount} funnet på disk</b>{foundCount < media.offline ? <span style={{ color: "#ff9b8a" }}> · {media.offline - foundCount} mangler</span> : null}</>}
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {media.items.map((c, i) => {
                const has = c.foundAt.length > 0 || !!picked[c.oldPath];
                return (
                <div key={i} style={{ ...sub, borderColor: has ? "#2e7d32" : "#b8860b" }}>
                  <div><span style={{ marginRight: 6 }}>{has ? "✅" : "⚠️"}</span><b>{c.name}</b></div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{c.oldPath}</div>
                  <div style={{ fontSize: 11, opacity: 0.85, margin: "3px 0" }}>
                    {c.foundAt.length ? `Funnet: ${c.foundAt[0]}${c.foundAt.length > 1 ? ` (+${c.foundAt.length - 1})` : ""}` : (picked[c.oldPath] ? `Valgt: ${picked[c.oldPath]}` : "ikke funnet — velg kilde-mappe og skann på nytt, eller velg fil manuelt")}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => pickFile(c.oldPath)} disabled={!!busy} style={btnSm}>Velg fil…</button>
                    <button onClick={() => relink(c)} disabled={!!busy || !(c.foundAt[0] || picked[c.oldPath])} style={(!!busy || !(c.foundAt[0] || picked[c.oldPath])) ? btnDis : btnPrimary}>Relink</button>
                  </div>
                </div>
                );
              })}
            </div>
            {!media.offline && <div style={{ color: "#9f9", marginTop: 4 }}>✓ {media.note}</div>}
          </div>
        )}
      </div>

      {/* OFFLINE-DIAGNOSE (read-only) */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Offline-diagnose</b>
          <button onClick={scanDiag} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Kjør diagnose</button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>Kun lesing — finner hvorfor hvert klipp er offline. Ingen endring gjøres.</p>
        {diag && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {/* fargede tellere per årsak */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <span style={{ opacity: 0.7 }}>{diag.clips} klipp m/ sti ·</span>
              {(["online", "cloud_placeholder", "codec_or_attr", "path_missing"] as DiagCause[]).map((c) => (
                <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: CAUSE_COLOR[c] }} />
                  <span style={{ color: CAUSE_COLOR[c], fontWeight: 600 }}>{diag.counts[c]}</span>
                  <span style={{ opacity: 0.65 }}>{CAUSE_LABEL[c]}</span>
                </span>
              ))}
            </div>
            {diag.note && <div style={{ ...banner }}>{diag.note}</div>}
            {(() => {
              const probs = diag.items.filter((i) => i.cause !== "online");
              if (!probs.length) return <div style={{ color: "#9f9", marginTop: 4 }}>✓ Alle klipp er online.</div>;
              return (
                <div style={{ maxHeight: 280, overflow: "auto", marginTop: 6 }}>
                  <table style={tbl}>
                    <thead><tr><th style={th}>Navn</th><th style={th}>Sti</th><th style={th}>Årsak</th><th style={th}>Forslag</th></tr></thead>
                    <tbody>
                      {probs.map((it, i) => (
                        <tr key={i}>
                          <td style={td}><b>{it.name}</b></td>
                          <td style={{ ...td, opacity: 0.6, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.path}>{it.path}</td>
                          <td style={td}><span style={badge(CAUSE_COLOR[it.cause])}>{CAUSE_LABEL[it.cause]}</span></td>
                          <td style={{ ...td, opacity: 0.85 }}>{it.suggestion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {diag.counts.path_missing > 0 && (
                    <div style={{ ...banner, borderColor: "#ef4f6f", marginTop: 6 }}>
                      {diag.counts.path_missing} klipp har manglende sti — bruk «Manglende media & lyd» / «Smart relink» over for å relinke disse.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* BATCH ROOT-REMAP */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Batch sti-remap (flyttet disk)</b>
          <button onClick={scanRemap} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann</button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>Når en hel mappe/disk er flyttet: bytt felles sti-prefiks for alle klipp på én gang.</p>
        {remap && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {remap.note && <div style={{ ...banner }}>{remap.note}</div>}
            {!remap.groups.length && <div style={{ color: "#9f9", marginTop: 4 }}>✓ Ingen prefiks-grupper med problem.</div>}
            {remap.groups.map((g, i) => {
              const val = remapEdits[g.oldPrefix] ?? g.suggestedNewPrefix;
              return (
                <div key={i} style={{ ...sub, borderColor: g.confident ? "#2e7d32" : "#c0392b", background: "#16161b" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={badge(g.confident ? "#4ad48a" : "#ef4f6f")}>{g.confident ? "Sikker" : "Usikker"}</span>
                    <span style={{ opacity: 0.7 }}>{g.clipCount} klipp</span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, margin: "4px 0" }}>Gammelt prefiks: <code>{g.oldPrefix}</code></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ opacity: 0.7 }}>→</span>
                    <input
                      value={val}
                      onChange={(e) => setRemapEdits((m) => ({ ...m, [g.oldPrefix]: e.target.value }))}
                      placeholder="Nytt prefiks (la stå tomt for å hoppe over)"
                      disabled={!!busy}
                      style={input}
                    />
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }} title={`${g.sampleOld} → ${g.sampleFound}`}>
                    {g.sampleOld} → {g.sampleFound}
                  </div>
                </div>
              );
            })}
            {remap.groups.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={previewRemap} disabled={!!busy || !remapMappings().length} style={(!!busy || !remapMappings().length) ? btnDis : btnSm}>Forhåndsvis (dry-run)</button>
                <button onClick={applyRemap} disabled={!!busy || !remapMappings().length} style={(!!busy || !remapMappings().length) ? btnDis : btnPrimary}>Utfør remap</button>
              </div>
            )}
            {remapPreview && (
              <div style={{ ...banner, marginTop: 6 }}>
                Forhåndsvisning: {remapPreview.wouldRemap?.length ?? remapPreview.remapped} vil bli remappet{remapPreview.failed ? ` · ${remapPreview.failed} feiler` : ""}.
              </div>
            )}
            {remapDone && (
              <div style={{ ...banner, borderColor: remapDone.failed ? "#f5b50b" : "#4ad48a", marginTop: 6 }}>
                ✓ {remapDone.remapped} remappet{remapDone.failed ? ` · ⚠ ${remapDone.failed} feilet` : ""}.
                {remapDone.failedPaths && remapDone.failedPaths.length > 0 && (
                  <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
                    Trenger manuell relink:
                    {remapDone.failedPaths.map((p, i) => <div key={i} style={{ opacity: 0.7 }}>{p}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SMART RELINK */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Smart relink (innholds-matching)</b>
          <button onClick={scanSmart} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann (innhold)</button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>Bruk «Kilde-plassering»-mappene over som søke-røtter. Rangerer kandidater på innhold + filnavn.</p>
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setSmartAdv((s) => !s)} style={{ ...btnSm, padding: "3px 8px" }}>{smartAdv ? "Skjul avansert" : "Avansert…"}</button>
          {smartAdv && (
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 5, alignItems: "center" }}>Maks kandidater/rot
                <input type="number" value={smartMaxCand} onChange={(e) => setSmartMaxCand(Number(e.target.value) || 0)} disabled={!!busy} style={{ ...input, width: 70 }} />
              </label>
              <label style={{ display: "flex", gap: 5, alignItems: "center" }}>Auto-skår
                <input type="number" step="0.05" value={smartAutoScore} onChange={(e) => setSmartAutoScore(Number(e.target.value) || 0)} disabled={!!busy} style={{ ...input, width: 70 }} />
              </label>
            </div>
          )}
        </div>
        {smart && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {smart.needsSearchRoots && <div style={{ ...banner, borderColor: "#f5b50b" }}>Velg minst én søke-mappe under «Kilde-plassering» over og skann på nytt.</div>}
            {smart.ffprobe === false && <div style={{ ...banner, borderColor: "#f5b50b" }}>⚠ ffmpeg/ffprobe mangler — matching faller tilbake til kun filendelse. Installer med <code>brew install ffmpeg</code> for innholds-skåring.</div>}
            {!smart.needsSearchRoots && (
              <div style={{ opacity: 0.7, marginBottom: 4 }}>
                {smart.clips} klipp · {smart.online} online · <b style={{ color: smart.offline ? "#ff9b8a" : "#9f9" }}>{smart.offline} offline</b> · {smart.autoMatchable} auto-matchbar
              </div>
            )}
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {(smart.items || []).map((it, i) => (
                <div key={i} style={{ ...sub, background: "#16161b", borderColor: smartPick[it.oldPath] ? "#2e7d32" : "#444" }}>
                  <div><b>{it.name}</b></div>
                  <div style={{ fontSize: 11, opacity: 0.55 }}>{it.oldPath}</div>
                  {it.known && Object.keys(it.known).length > 0 && (
                    <div style={{ fontSize: 10, opacity: 0.6, margin: "3px 0" }}>
                      {Object.entries(it.known).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                    </div>
                  )}
                  {it.candidates.length === 0 && <div style={{ fontSize: 11, color: "#ff9b8a" }}>Ingen kandidater funnet.</div>}
                  {it.candidates.map((c, j) => {
                    const chosen = smartPick[it.oldPath] === c.path;
                    return (
                      <div key={j} onClick={() => setSmartPick((m) => ({ ...m, [it.oldPath]: c.path }))}
                        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 6px", borderRadius: 5, marginTop: 3, background: chosen ? "rgba(124,92,255,0.18)" : "transparent", border: `1px solid ${chosen ? "#7c5cff" : "transparent"}` }}>
                        <span style={{ width: 14 }}>{chosen ? "●" : "○"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.path}>{c.path}</div>
                          <div style={{ fontSize: 10, opacity: 0.6 }}>{c.why}</div>
                        </div>
                        <div style={{ width: 70 }}>
                          <div style={{ height: 5, background: "#26262e", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.round(Math.max(0, Math.min(1, c.score)) * 100)}%`, background: c.score >= smartAutoScore ? "#4ad48a" : "#f5b50b" }} />
                          </div>
                          <div style={{ fontSize: 9, opacity: 0.6, textAlign: "right" }}>{Math.round(c.score * 100)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {(smart.items || []).length > 0 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                  <input type="checkbox" checked={smartDry} onChange={(e) => setSmartDry(e.target.checked)} disabled={!!busy} /> Dry-run
                </label>
                <button onClick={() => void relinkSmart(smartDry)} disabled={!!busy || !Object.keys(smartPick).length} style={(!!busy || !Object.keys(smartPick).length) ? btnDis : btnPrimary}>Relink valgte</button>
              </div>
            )}
            {smartDone && (
              <div style={{ ...banner, borderColor: smartDone.failed ? "#f5b50b" : "#4ad48a", marginTop: 6 }}>
                ✓ {smartDone.relinked} relinket{smartDone.failed ? ` · ⚠ ${smartDone.failed} feilet` : ""}.
                {smartDone.failedPaths && smartDone.failedPaths.length > 0 && smartDone.failedPaths.map((p, i) => <div key={i} style={{ fontSize: 11, opacity: 0.7 }}>{p}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DUBLETTER */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Dubletter</b>
          <button onClick={scanDup} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Skann</button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 11, margin: "4px 0 0" }}>Kun lesing — finner klipp som peker på samme fil, og mulige disk-kopier.</p>
        {dup && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {dup.note && <div style={{ ...banner }}>{dup.note}</div>}
            <div style={{ opacity: 0.75, marginBottom: 6 }}>
              {dup.totalClips} klipp · {dup.uniquePaths} unike stier · <b style={{ color: dup.redundantEntries ? "#ff9b8a" : "#9f9" }}>{dup.redundantEntries} overflødige</b>
            </div>
            {dup.duplicateGroups.length > 0 && (
              <div style={{ maxHeight: 260, overflow: "auto" }}>
                {dup.duplicateGroups.map((g, i) => (
                  <div key={i} style={{ ...sub, background: "#16161b", borderColor: "#b8860b" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={badge("#f5b50b")}>{g.count}×</span>
                      <span style={{ fontSize: 11, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.path}>{g.path}</span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                      {g.names.map((n, j) => (
                        <div key={j}><b>{n}</b>{g.binLocations[j] ? <span style={{ opacity: 0.6 }}> — {g.binLocations[j]}</span> : null}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {dup.sameNameDiffPath.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ opacity: 0.7, marginBottom: 4 }}>Mulige disk-kopier (samme navn, ulik sti):</div>
                {dup.sameNameDiffPath.map((s, i) => (
                  <div key={i} style={{ ...sub, background: "#16161b", borderColor: "#444" }}>
                    <div><b>{s.basename}</b></div>
                    {s.paths.map((p, j) => <div key={j} style={{ fontSize: 10, opacity: 0.6 }}>{p}</div>)}
                  </div>
                ))}
              </div>
            )}
            {!dup.duplicateGroups.length && !dup.sameNameDiffPath.length && <div style={{ color: "#9f9" }}>✓ Ingen dubletter funnet.</div>}
            <div style={{ marginTop: 8 }}>
              <button disabled style={{ ...btnDis }} title="Kommer senere — sletting er en framtidig handling">Slett duplikater (kommer)</button>
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

function Spinner() {
  return <span style={{ display: "inline-block", width: 15, height: 15, border: "2px solid #4a3f7a", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "svbspin 0.7s linear infinite" }} />;
}
const card: React.CSSProperties = { background: "#16161b", border: "1px solid #2a2a33", borderRadius: 8, padding: 12, marginBottom: 10 };
const sub: React.CSSProperties = { background: "#1c1410", border: "1px solid #444", borderRadius: 6, padding: 8, marginTop: 6 };
const btnPrimary: React.CSSProperties = { padding: "6px 12px", background: "#7c5cff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const btnSm: React.CSSProperties = { padding: "5px 10px", background: "#26262e", color: "#ddd", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const btnDis: React.CSSProperties = { ...btnPrimary, background: "#333", color: "#888", cursor: "not-allowed" };
const banner: React.CSSProperties = { background: "#101015", border: "1px solid #2a2a33", borderLeft: "3px solid #7c5cff", borderRadius: 6, padding: "6px 10px", fontSize: 12, marginTop: 4 };
const input: React.CSSProperties = { flex: 1, background: "#101015", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "5px 8px", fontSize: 12 };
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #2a2a33", opacity: 0.6, fontWeight: 600, position: "sticky", top: 0, background: "#16161b" };
const td: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #20202a", verticalAlign: "top" };
function badge(color: string): React.CSSProperties {
  return { display: "inline-block", padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, color, background: `${color}22`, border: `1px solid ${color}55` };
}
