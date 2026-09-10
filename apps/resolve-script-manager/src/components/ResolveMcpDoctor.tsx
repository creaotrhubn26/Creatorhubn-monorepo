import { useCallback, useEffect, useMemo, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import TroubleshootIcon from "@mui/icons-material/Troubleshoot";
import {
  applyResolveMcpPlan,
  createResolveMcpPlan,
  getLatestResolveMcpPlan,
  getResolveMcpIntelligence,
  getResolveMcpStatus,
  listResolveMcpSkills,
  rollbackResolveMcpPlan,
  runResolveMcpSkill,
} from "../api";
import type {
  ResolveMcpDoctorReport,
  ResolveMcpIntelligence,
  ResolveMcpSkillDefinition,
  ResolveMcpSkillReport,
  ResolveMcpStatus,
  ResolveMcpWorkflowPlan,
} from "../types";

type SkillReport = ResolveMcpSkillReport | ResolveMcpDoctorReport;

const findingColor: Record<string, string> = {
  ok: "#4ad48a",
  info: "#4a90e2",
  warning: "#f0a500",
  error: "#ef4f6f",
};

const valueText = (value: unknown, suffix = "") => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return `${value.toLocaleString("nb-NO")}${suffix}`;
  return `${String(value)}${suffix}`;
};

function timeTextToSeconds(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (parts.length > 3 || parts.some(part => !Number.isFinite(part))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function parseReviewNotes(text: string) {
  return text.split("\n").map((line, index) => {
    const [time, ...noteParts] = line.split("|");
    const timeSec = timeTextToSeconds(time || "");
    const note = noteParts.join("|").trim();
    return timeSec === null || !note
      ? null
      : { timeSec, name: `Review ${index + 1}`, note, color: "Purple" };
  }).filter((note): note is NonNullable<typeof note> => Boolean(note));
}

function parseTranscriptSelects(text: string) {
  return text.split("\n").map(line => {
    const [clipId, start, end] = line.split("|").map(value => value.trim());
    const startFrame = Number(start);
    const endFrame = Number(end);
    return !clipId || !Number.isFinite(startFrame) || !Number.isFinite(endFrame)
      ? null
      : { clipId, startFrame, endFrame };
  }).filter((selection): selection is NonNullable<typeof selection> => Boolean(selection));
}

function reportSummary(report: SkillReport): Array<[string, string]> {
  if (!("summary" in report)) {
    return [
      ["Prosjekt", report.project?.name || "—"],
      ["Timeline", report.timeline?.name || "—"],
      ["Media Pool", `${report.mediaPool.clipCount} klipp`],
      ["Videoinnhold", `${report.timeline?.itemCounts.video ?? 0} elementer`],
      ["Lydinnhold", `${report.timeline?.itemCounts.audio ?? 0} elementer`],
      ["Format", report.settings.timelineResolutionWidth && report.settings.timelineResolutionHeight
        ? `${report.settings.timelineResolutionWidth}×${report.settings.timelineResolutionHeight}`
        : "—"],
    ];
  }

  const summary = report.summary;
  if (report.skillId === "resolve-timeline-qc") {
    return [
      ["Videoklipp", valueText(summary.videoItems)],
      ["Gap", valueText(summary.gaps)],
      ["Deaktivert", valueText(summary.disabledItems)],
      ["Tomme spor", valueText(summary.emptyTracks)],
      ["Overlapp", valueText(summary.overlaps)],
      ["Audiospor", valueText(summary.audioTracks)],
    ];
  }
  if (report.skillId === "resolve-media-health") {
    return [
      ["Medieklipp", valueText(summary.totalClips)],
      ["Offline", valueText(summary.offlineClips)],
      ["Med proxy", valueText(summary.clipsWithProxy)],
      ["Duplikatkilder", valueText(summary.duplicateSourceGroups)],
      ["Mapper", valueText(summary.totalFolders)],
      ["Uten kildebane", valueText(summary.missingSourcePaths)],
    ];
  }
  if (report.skillId === "resolve-delivery-qc") {
    const resolution = summary.outputWidth && summary.outputHeight
      ? `${summary.outputWidth}×${summary.outputHeight}`
      : "—";
    return [
      ["Output", resolution],
      ["Framerate", valueText(summary.timelineFrameRate, " fps")],
      ["Audio", valueText(summary.audioSampleRate, " Hz")],
      ["Videoklipp", valueText(summary.videoItems)],
      ["Audiospor", valueText(summary.audioTracks)],
      ["Renderkø", valueText(summary.renderQueueCount)],
    ];
  }
  return Object.entries(summary).slice(0, 6).map(([key, value]) => [key, valueText(value)]);
}

export function ResolveMcpSkills() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ResolveMcpStatus | null>(null);
  const [skills, setSkills] = useState<ResolveMcpSkillDefinition[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("resolve-project-doctor");
  const [checking, setChecking] = useState(false);
  const [syncingIntelligence, setSyncingIntelligence] = useState(false);
  const [intelligence, setIntelligence] = useState<ResolveMcpIntelligence | null>(null);
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null);
  const [report, setReport] = useState<SkillReport | null>(null);
  const [plan, setPlan] = useState<ResolveMcpWorkflowPlan | null>(null);
  const [approved, setApproved] = useState(false);
  const [binNames, setBinNames] = useState("01_FOOTAGE, 02_AUDIO, 03_MUSIC, 04_GFX, 05_TIMELINES, 06_EXPORTS");
  const [reviewNotes, setReviewNotes] = useState("");
  const [transcriptSelects, setTranscriptSelects] = useState("");
  const [multicamSync, setMulticamSync] = useState<"timecode" | "audio">("timecode");
  const [voiceAmount, setVoiceAmount] = useState(50);
  const [lookPreset, setLookPreset] = useState("warm-wedding");
  const [renderBaseName, setRenderBaseName] = useState("Post Agent Master");
  const [renderProfiles, setRenderProfiles] = useState([
    "prores-422-hq",
    "h265-4k",
    "h264-proxy",
  ]);
  const [renamePrefix, setRenamePrefix] = useState("SHOT");
  const [renameStart, setRenameStart] = useState(1);
  const [renamePadding, setRenamePadding] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const [nextStatus, nextSkills, latestPlan] = await Promise.all([
        getResolveMcpStatus(),
        listResolveMcpSkills(),
        getLatestResolveMcpPlan().catch(() => null),
      ]);
      setStatus(nextStatus);
      setSkills(nextSkills);
      if (latestPlan) {
        setPlan(latestPlan);
        setReport(latestPlan.preflight);
        setSelectedSkillId(latestPlan.skillId);
      }
      setSelectedSkillId(current => nextSkills.some(skill => skill.id === current)
        ? current
        : nextSkills[0]?.id || "resolve-project-doctor");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, refresh]);

  const selectedSkill = useMemo(
    () => skills.find(skill => skill.id === selectedSkillId) || null,
    [selectedSkillId, skills],
  );
  const availableCount = skills.filter(skill => skill.status === "available").length;
  const plannedCount = skills.filter(skill => skill.status === "planned").length;
  const canRun = Boolean(
    selectedSkill?.status === "available"
    && (selectedSkill.readOnly || selectedSkill.supportsPlan)
    && status?.resolveReachable,
  );

  const planInput = (): Record<string, unknown> => {
    switch (selectedSkill?.id) {
      case "resolve-project-organizer":
        return { binNames: binNames.split(",").map(name => name.trim()).filter(Boolean) };
      case "resolve-transcript-editor":
        return { timelineName: "Post Agent Selects", selections: parseTranscriptSelects(transcriptSelects) };
      case "resolve-multicam-director":
        return { name: "Post Agent Multicam", syncMode: multicamSync };
      case "resolve-audio-post":
        return { enabled: true, amount: voiceAmount };
      case "resolve-color-guardian":
        return { preset: lookPreset };
      case "resolve-review-notes":
        return { notes: parseReviewNotes(reviewNotes) };
      case "resolve-batch-render-planner":
        return { profileIds: renderProfiles, baseName: renderBaseName };
      case "resolve-v1-clip-renamer":
        return { prefix: renamePrefix, startNumber: renameStart, padding: renamePadding };
      default:
        return {};
    }
  };

  const runSelectedSkill = async () => {
    if (!selectedSkill || !canRun) return;
    setRunningSkillId(selectedSkill.id);
    setReport(null);
    setPlan(null);
    setApproved(false);
    setError(null);
    try {
      if (!selectedSkill.readOnly) {
        const nextPlan = await createResolveMcpPlan(selectedSkill.id, planInput());
        setPlan(nextPlan);
        setReport(nextPlan.preflight);
        setStatus(await getResolveMcpStatus());
        return;
      }
      const summary = await runResolveMcpSkill(selectedSkill.id);
      const errorEvent = summary.events.find(event => event.type === "error");
      const resultEvent = summary.events.find(event => event.type === "result");
      if (!summary.succeeded || !resultEvent?.value) {
        throw new Error(errorEvent?.message || `${selectedSkill.name} returnerte ingen rapport`);
      }
      setReport(resultEvent.value as SkillReport);
      setStatus(await getResolveMcpStatus());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningSkillId(null);
    }
  };

  const applyPlan = async () => {
    if (!plan || !approved || !plan.executable) return;
    setRunningSkillId(plan.skillId);
    setError(null);
    try {
      setPlan(await applyResolveMcpPlan(plan.planId, plan.confirmationToken));
      setApproved(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningSkillId(null);
    }
  };

  const rollbackPlan = async () => {
    if (!plan || plan.state !== "applied") return;
    setRunningSkillId(plan.skillId);
    setError(null);
    try {
      setPlan(await rollbackResolveMcpPlan(plan.planId, plan.confirmationToken));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningSkillId(null);
    }
  };

  const syncIntelligence = async () => {
    setSyncingIntelligence(true);
    setError(null);
    try {
      setIntelligence(await getResolveMcpIntelligence());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncingIntelligence(false);
    }
  };

  const stateColor = status?.resolveReachable
    ? "#4ad48a"
    : status?.available
      ? "#f0a500"
      : "#8674a8";
  const planPreview = plan?.preview ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Allowlistede Post Agent-skills via Resolve 21.1 MCP"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 11px", borderRadius: 999,
          border: "1px solid rgba(160,48,192,0.45)",
          background: "rgba(160,48,192,0.10)", color: "var(--text)",
          fontSize: 11, cursor: "pointer",
        }}
      >
        <TroubleshootIcon sx={{ fontSize: 15, color: "#c674e8" }} />
        12 Resolve-skills
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 4000,
            background: "rgba(4,5,9,0.78)", backdropFilter: "blur(10px)",
            display: "grid", placeItems: "center", padding: 24,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-skills-title"
            style={{
              width: "min(940px, 96vw)", maxHeight: "90vh", overflowY: "auto",
              borderRadius: 14, border: "1px solid rgba(160,48,192,0.32)",
              background: "linear-gradient(145deg, #151720, #0d0f15)",
              boxShadow: "0 26px 90px rgba(0,0,0,0.55)", padding: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flex: "0 0 auto",
                display: "grid", placeItems: "center",
                background: "linear-gradient(135deg, #6e3fc7, #a030c0)",
              }}>
                <TroubleshootIcon sx={{ fontSize: 22, color: "white" }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 id="mcp-skills-title" style={{ margin: 0, fontSize: 18 }}>
                  Resolve Skills
                </h2>
                <p style={{ margin: "5px 0 0", fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                  Fire analyser og åtte godkjente workflows bruker Resolve 21.1 MCP gjennom Post Agents
                  plan-, kontroll- og rollback-lag.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Lukk"
                style={{ border: 0, background: "transparent", color: "var(--text-2)", cursor: "pointer" }}
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </button>
            </div>

            <div style={{
              marginTop: 18, padding: 13, borderRadius: 9,
              border: `1px solid ${stateColor}55`, background: `${stateColor}12`,
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: stateColor }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {checking ? "Kontrollerer MCP …"
                    : status?.resolveReachable ? `Resolve ${status.serverVersion || "21.1"} er klar`
                    : status?.available ? "MCP installert — Resolve er ikke tilgjengelig"
                    : status?.installed ? "MCP-binary kunne ikke startes"
                    : "Resolve MCP ble ikke funnet"}
                </div>
                <div style={{ marginTop: 3, fontSize: 10, color: "var(--text-2)" }}>
                  {skills.length > 0
                    ? `${availableCount} klare · ${plannedCount} planlagt · ${status?.toolCount ?? 0} MCP-verktøy`
                    : "Laster skill-katalog …"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={checking || Boolean(runningSkillId)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--bg-3)", color: "var(--text)",
                  padding: "6px 9px", fontSize: 10.5, cursor: "pointer",
                }}
              >
                <RefreshIcon sx={{ fontSize: 14 }} /> Oppdater
              </button>
            </div>

            {status && !status.resolveReachable && (
              <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                Start Resolve Studio, åpne et prosjekt og kjør <strong>File → Setup AI Assistants</strong>.
                Start deretter Post Agent på nytt hvis Resolve ber om det.
              </div>
            )}

            {error && (
              <div role="alert" style={{
                marginTop: 14, padding: 11, borderRadius: 7,
                background: "rgba(239,79,111,0.10)", border: "1px solid rgba(239,79,111,0.35)",
                color: "#ff8ba2", fontSize: 11, lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <div style={{
              marginTop: 16, display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 8,
            }}>
              {skills.map((skill) => {
                const selected = skill.id === selectedSkillId;
                const available = skill.status === "available";
                return (
                  <button
                    key={skill.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedSkillId(skill.id);
                      setReport(null);
                      setPlan(null);
                      setApproved(false);
                      setError(null);
                    }}
                    style={{
                      padding: 12, borderRadius: 9, textAlign: "left", cursor: "pointer",
                      border: selected ? "1px solid rgba(198,116,232,0.8)" : "1px solid rgba(255,255,255,0.08)",
                      background: selected ? "rgba(160,48,192,0.13)" : "rgba(255,255,255,0.028)",
                      color: "var(--text)", opacity: available ? 1 : 0.68,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ flex: 1, fontSize: 11.5 }}>{skill.name}</strong>
                      <span style={{
                        padding: "2px 6px", borderRadius: 999, fontSize: 8.5, fontWeight: 700,
                        color: available ? "#4ad48a" : "#b6a9ca",
                        background: available ? "rgba(74,212,138,0.10)" : "rgba(134,116,168,0.12)",
                      }}>
                        {available ? (skill.readOnly ? "ANALYSE" : "PLAN + APPLY") : "PLANLAGT"}
                      </span>
                    </span>
                    <span style={{ display: "block", marginTop: 5, fontSize: 10, lineHeight: 1.4, color: "var(--text-2)" }}>
                      {skill.description}
                    </span>
                    <span style={{ display: "block", marginTop: 7, fontSize: 9, color: "var(--text-3)" }}>
                      {skill.readOnly ? "Read-only" : "Krever plan, snapshot og godkjenning"}
                      {skill.requiresTimeline ? " · timeline påkrevd" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedSkill && !selectedSkill.readOnly && (
              <div style={{ marginTop: 14, padding: 13, borderRadius: 9, border: "1px solid rgba(198,116,232,0.22)", background: "rgba(160,48,192,0.05)" }}>
                {selectedSkill.id === "resolve-project-organizer" && (
                  <label style={{ display: "grid", gap: 6, fontSize: 10, color: "var(--text-2)" }}>
                    Bins som skal finnes i roten
                    <input value={binNames} onChange={event => setBinNames(event.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }} />
                  </label>
                )}
                {selectedSkill.id === "resolve-transcript-editor" && (
                  <label style={{ display: "grid", gap: 6, fontSize: 10, color: "var(--text-2)" }}>
                    Selects — én per linje: clipId | startFrame | endFrame
                    <textarea value={transcriptSelects} onChange={event => setTranscriptSelects(event.target.value)} rows={3} placeholder="clip-uuid | 100 | 250" style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)", resize: "vertical" }} />
                  </label>
                )}
                {selectedSkill.id === "resolve-multicam-director" && (
                  <label style={{ display: "grid", gap: 6, fontSize: 10, color: "var(--text-2)" }}>
                    Synkronisering — bruker valgte klipp i Resolve Media Pool
                    <select value={multicamSync} onChange={event => setMulticamSync(event.target.value as "timecode" | "audio")} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }}>
                      <option value="timecode">Timecode</option>
                      <option value="audio">Waveform / audio</option>
                    </select>
                  </label>
                )}
                {selectedSkill.id === "resolve-audio-post" && (
                  <label style={{ display: "grid", gap: 6, fontSize: 10, color: "var(--text-2)" }}>
                    Voice Isolation: {voiceAmount}% på aktive audiospor
                    <input type="range" min={0} max={100} value={voiceAmount} onChange={event => setVoiceAmount(Number(event.target.value))} />
                  </label>
                )}
                {selectedSkill.id === "resolve-color-guardian" && (
                  <label style={{ display: "grid", gap: 6, fontSize: 10, color: "var(--text-2)" }}>
                    Look-oppskrift
                    <select value={lookPreset} onChange={event => setLookPreset(event.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }}>
                      <option value="warm-wedding">Warm Wedding</option>
                      <option value="clean-commercial">Clean Commercial</option>
                      <option value="music-teal">Music Teal</option>
                    </select>
                  </label>
                )}
                {selectedSkill.id === "resolve-review-notes" && (
                  <label style={{ display: "grid", gap: 6, fontSize: 10, color: "var(--text-2)" }}>
                    Review-notater — én per linje: tidskode | kommentar
                    <textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} rows={4} placeholder={"00:12 | Kort ned åpningen\n01:08 | Bruk alternativt nærbilde"} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)", resize: "vertical" }} />
                  </label>
                )}
                {selectedSkill.id === "resolve-batch-render-planner" && (
                  <div style={{ display: "grid", gap: 10, fontSize: 10, color: "var(--text-2)" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      Filnavnbase
                      <input value={renderBaseName} maxLength={100} onChange={event => setRenderBaseName(event.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }} />
                    </label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {[
                        ["prores-422-hq", "ProRes 422 HQ"],
                        ["h265-4k", "H.265 4K"],
                        ["h264-proxy", "H.264 1080p proxy"],
                      ].map(([id, label]) => (
                        <label key={id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={renderProfiles.includes(id)}
                            onChange={event => setRenderProfiles(current => event.target.checked
                              ? [...current, id]
                              : current.filter(profile => profile !== id))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <span style={{ color: "var(--text-3)" }}>
                      Kømål: Filmer/Post Agent Exports. Rendering startes aldri automatisk.
                    </span>
                  </div>
                )}
                {selectedSkill.id === "resolve-v1-clip-renamer" && (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 9, fontSize: 10, color: "var(--text-2)" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      Prefiks
                      <input value={renamePrefix} maxLength={80} onChange={event => setRenamePrefix(event.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }} />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Startnummer
                      <input type="number" min={1} max={999999} value={renameStart} onChange={event => setRenameStart(Number(event.target.value))} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }} />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Siffer
                      <select value={renamePadding} onChange={event => setRenamePadding(Number(event.target.value))} style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text)" }}>
                        {[2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            {selectedSkill && (
              <div style={{
                marginTop: 14, padding: 13, borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{selectedSkill.name}</div>
                  <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-2)" }}>
                    {selectedSkill.status === "available"
                      ? selectedSkill.readOnly
                        ? "Fast, allowlistet MCP-analyse. Resultatet logges i kjøringshistorikken."
                        : "Først opprettes en låst plan. Ingen Resolve-data endres før du godkjenner den."
                      : "Denne skillen kan ikke kjøres før trygg godkjenning og rollback er implementert."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runSelectedSkill()}
                  disabled={!canRun || Boolean(runningSkillId) || checking}
                  style={{
                    border: 0, borderRadius: 7, padding: "9px 14px",
                    background: "linear-gradient(135deg, #6e3fc7, #a030c0)",
                    color: "white", fontSize: 11.5, fontWeight: 700,
                    cursor: runningSkillId ? "wait" : canRun ? "pointer" : "not-allowed",
                    opacity: canRun ? 1 : 0.45,
                  }}
                >
                  {runningSkillId === selectedSkill.id ? "Analyserer …"
                    : selectedSkill.status === "planned" ? "Ikke aktivert"
                    : selectedSkill.readOnly ? `Kjør ${selectedSkill.name}` : `Lag plan for ${selectedSkill.name}`}
                </button>
              </div>
            )}

            {plan && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 9, border: "1px solid rgba(74,212,138,0.25)", background: "rgba(74,212,138,0.045)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <strong style={{ fontSize: 12 }}>Godkjenningsplan</strong>
                  <span style={{ fontSize: 9, color: plan.state === "applied" ? "#4ad48a" : "var(--text-3)", textTransform: "uppercase" }}>{plan.state}</span>
                </div>
                <p style={{ margin: "7px 0", fontSize: 10.5, color: "var(--text-2)" }}>{plan.operationSummary}</p>
                <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>
                  Mål: {plan.target.projectName}{plan.target.timelineName ? ` · ${plan.target.timelineName}` : ""}
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {plan.steps.map(step => (
                    <div key={step.id} style={{ padding: 8, borderRadius: 6, background: "rgba(255,255,255,0.03)", fontSize: 10 }}>
                      <strong>{step.label}</strong><span style={{ color: "var(--text-2)" }}> — {step.detail}</span>
                    </div>
                  ))}
                  {plan.warnings.map(warning => <div key={warning} style={{ color: "#f0a500", fontSize: 10 }}>{warning}</div>)}
                </div>
                {planPreview && planPreview.items.length > 0 && (
                  <div data-testid="resolve-plan-preview" style={{ marginTop: 11, padding: 10, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.14)" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 750, textTransform: "uppercase", color: "var(--text-3)" }}>
                      Forhåndsvisning · {planPreview.items.length} elementer
                    </div>
                    {planPreview.destination && (
                      <div style={{ marginTop: 5, fontSize: 9.5, color: "var(--text-2)", overflowWrap: "anywhere" }}>
                        Målmappe: {planPreview.destination}
                      </div>
                    )}
                    <div style={{ display: "grid", gap: 5, marginTop: 7, maxHeight: 190, overflowY: "auto" }}>
                      {planPreview.items.slice(0, 100).map((item, index) => (
                        <div key={item.id || `${item.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 1fr) minmax(120px, 2fr)", gap: 8, padding: "6px 7px", borderRadius: 5, background: "rgba(255,255,255,0.025)", fontSize: 9.5 }}>
                          <strong>{item.label || item.before || `Element ${index + 1}`}</strong>
                          <span style={{ color: "var(--text-2)" }}>
                            {planPreview.kind === "rename-v1"
                              ? `${item.before} → ${item.after}`
                              : `${item.format} · ${item.codec} · ${item.resolution} · ${item.outputName}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {plan.state === "planned" && plan.executable && (
                  <div style={{ marginTop: 11, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 10.5 }}>
                      <input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} />
                      Jeg godkjenner {plan.confirmationToken}
                    </label>
                    <button type="button" disabled={!approved || Boolean(runningSkillId)} onClick={() => void applyPlan()} style={{ border: 0, borderRadius: 6, padding: "8px 11px", background: "#4ad48a", color: "#08110c", fontWeight: 750, fontSize: 10.5, opacity: approved ? 1 : 0.45 }}>
                      {plan.skillId === "resolve-batch-render-planner"
                        ? "Godkjenn og legg i kø"
                        : plan.skillId === "resolve-v1-clip-renamer"
                          ? "Godkjenn nye navn"
                          : "Godkjenn og utfør"}
                    </button>
                  </div>
                )}
                {plan.state === "applied" && (
                  <div style={{ marginTop: 11, display: "flex", gap: 9, alignItems: "center" }}>
                    <span style={{ color: plan.verification?.ok ? "#4ad48a" : "#f0a500", fontSize: 10.5 }}>
                      {plan.verification?.ok ? "Verifisert i Resolve" : "Utført — kontroller resultatet"}
                    </span>
                    {plan.rollbackAvailable && (
                      <button type="button" onClick={() => void rollbackPlan()} disabled={Boolean(runningSkillId)} style={{ borderRadius: 6, padding: "7px 10px", border: "1px solid rgba(239,79,111,0.45)", background: "rgba(239,79,111,0.08)", color: "#ff8ba2", fontSize: 10 }}>
                        Rollback
                      </button>
                    )}
                  </div>
                )}
                {plan.state === "rolled-back" && <div style={{ marginTop: 10, color: "#4ad48a", fontSize: 10.5 }}>Endringen er rullet tilbake.</div>}
              </div>
            )}

            {report && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8 }}>
                  Resultat · {report.project?.name || "Ingen aktivt prosjekt"}
                  {report.timeline?.name ? ` · ${report.timeline.name}` : ""}
                </div>
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
                  gap: 8,
                }}>
                  {reportSummary(report).map(([label, value]) => (
                    <div key={label} style={{
                      padding: 10, borderRadius: 7, background: "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                      <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {label}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 650 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 7 }}>
                  {report.findings.map((finding) => {
                    const color = findingColor[finding.severity] || "#8674a8";
                    return (
                      <div key={finding.code} style={{
                        padding: 10, borderRadius: 7,
                        border: `1px solid ${color}44`, background: `${color}0f`,
                      }}>
                        <div style={{ color, fontWeight: 700, fontSize: 11 }}>{finding.title}</div>
                        <div style={{ marginTop: 3, color: "var(--text-2)", fontSize: 10, lineHeight: 1.45 }}>
                          {finding.detail}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", fontSize: 9.5, color: "var(--text-3)" }}>
              <span style={{ flex: 1, minWidth: 260 }}>
                Skills bruker sandboxet <code>run_script</code> eller avgrensede LUT-verktøy. <code>run_script_unsafe</code> eksponeres aldri.
              </span>
              {intelligence && (
                <span style={{ color: "#4ad48a" }}>
                  API {intelligence.resolveVersion || "21.1"} · {Object.keys(intelligence.apiEvidence).length} domener synkronisert
                </span>
              )}
              <button type="button" onClick={() => void syncIntelligence()} disabled={syncingIntelligence || !status?.resolveReachable} style={{ borderRadius: 6, padding: "6px 9px", border: "1px solid var(--border)", background: "var(--bg-3)", color: "var(--text-2)", fontSize: 9.5, opacity: status?.resolveReachable ? 1 : 0.45 }}>
                {syncingIntelligence ? "Synkroniserer API …" : "Synk API + What's New"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

// Midlertidig alias for eksisterende imports mens Project Doctor utvikles til skill-huben.
export const ResolveMcpDoctor = ResolveMcpSkills;
