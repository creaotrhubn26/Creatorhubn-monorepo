/**
 * MulticamSyncStudio — Role Room-brandet multi-cam sync-editor.
 *
 * Workflow:
 *   1. Add 2+ kamera-klipp (file-picker, multi-select)
 *   2. Hver klipp får auto waveform-data + duration
 *   3. Velg "reference"-klipp (default: lengste). Andre kameraer
 *      synkes mot denne.
 *   4. Klikk "Auto-sync" → sync_multicam_audio.py kjøres
 *   5. Detekterte offsets vises som tids-tekst + waveform-strip
 *      med offset-shift
 *   6. Manual finetune-slider per klipp (-3s til +3s)
 *   7. Save → group persisteres i Role Room
 *
 * Brukes for å produsere ferdig synkede multicam-grupper som kan
 * importeres i Resolve via XML handoff.
 */

import { useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import VideocamIcon from "@mui/icons-material/Videocam";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SaveIcon from "@mui/icons-material/Save";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { executeScript } from "../api";
import { multicamService } from "../services/multicamService";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";
import {
  effectiveOffset, newClient as newClientId,
} from "../lib/multicamTypes";
import type { MulticamClip, MulticamGroup } from "../lib/multicamTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agentKind?: string;
}

interface SyncResult {
  clipIndex: number;
  filePath: string;
  isReference: boolean;
  offsetSec: number;
  confidence: number;
  durationSec: number;
}

export function MulticamSyncStudio({ open, onClose, projectId, agentKind }: Props) {
  const [groups, setGroups] = useState<MulticamGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<MulticamGroup | null>(null);
  // Lokal state for klipp som ikke er lagret enda
  const [clips, setClips] = useState<MulticamClip[]>([]);
  const [groupName, setGroupName] = useState("Ny sync-gruppe");
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractingWaveform, setExtractingWaveform] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    refresh();
  }, [open, projectId]);

  const refresh = async () => {
    setLoaded(false);
    try {
      const list = await multicamService.list(projectId);
      setGroups(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  const startNewGroup = () => {
    setActiveGroup(null);
    setClips([]);
    setGroupName(`Sync-gruppe ${groups.length + 1}`);
  };

  const openGroup = (group: MulticamGroup) => {
    setActiveGroup(group);
    setClips(group.clips || []);
    setGroupName(group.groupName);
  };

  const handleAddClips = async () => {
    const picked = await openFileDialog({
      multiple: true,
      title: "Velg kamera-klipp",
      filters: [{ name: "Video",
                    extensions: ["mp4", "mov", "mkv", "m4v", "avi"] }],
    });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    setError(null);

    const newClips: MulticamClip[] = [];
    for (const filePath of paths) {
      if (typeof filePath !== "string") continue;
      setExtractingWaveform(filePath);
      try {
        const summary = await executeScript("extract_audio_waveform_data", {
          audioPath: filePath, bucketCount: 200,
        }, false);
        const r = summary.events.find(e => e.type === "result")?.value as {
          waveformData?: number[]; durationSec?: number;
        } | undefined;
        const waveform = r?.waveformData ?? [];
        const dur = r?.durationSec ?? 0;
        const fileName = filePath.split("/").pop() ?? "(unnamed)";
        newClips.push({
          id: newClientId(),
          filePath,
          fileName,
          isReference: clips.length === 0 && newClips.length === 0,
          detectedOffsetSec: 0,
          manualOffsetSec: 0,
          confidence: 0,
          durationSec: dur,
          waveformData: waveform,
        });
      } catch (e) {
        setError(`${filePath}: ${(e as Error).message}`);
      }
    }
    setExtractingWaveform(null);
    setClips(prev => [...prev, ...newClips]);
  };

  const handleAutoSync = async () => {
    if (clips.length < 2) {
      setError("Minst 2 klipp for å kjøre sync");
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const refIdx = clips.findIndex(c => c.isReference);
      const summary = await executeScript("sync_multicam_audio", {
        clipPaths: clips.map(c => c.filePath),
        referenceIndex: refIdx >= 0 ? refIdx : 0,
      }, false);
      const r = summary.events.find(e => e.type === "result")?.value as {
        syncResults?: SyncResult[]; method?: string;
        referenceClipIndex?: number;
      } | undefined;
      if (!r?.syncResults) throw new Error("Ingen sync-output");

      // Map results til vår clips-array
      setClips(prev => prev.map((c, i) => {
        const result = r.syncResults![i];
        if (!result) return c;
        return {
          ...c,
          isReference: result.isReference,
          detectedOffsetSec: result.offsetSec,
          confidence: result.confidence,
          durationSec: result.durationSec || c.durationSec,
        };
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetReference = (id: string) => {
    setClips(prev => prev.map(c => ({
      ...c,
      isReference: c.id === id,
      // Reset offset for ny reference
      ...(c.id === id ? { detectedOffsetSec: 0, manualOffsetSec: 0, confidence: 1.0 } : {}),
    })));
  };

  const handleRemoveClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
  };

  const handleManualOffsetChange = (id: string, offset: number) => {
    setClips(prev => prev.map(c =>
      c.id === id ? { ...c, manualOffsetSec: offset } : c));
  };

  const handleSave = async () => {
    if (clips.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const hasSyncedClips = clips.some(c => c.confidence > 0);
      const syncStatus = hasSyncedClips ? "ready" : "pending";
      if (activeGroup) {
        await multicamService.update(activeGroup.id, {
          groupName, clips, syncStatus,
        });
      } else {
        await multicamService.create({
          projectId, groupName, clips, agentKind,
        });
      }
      await refresh();
      // Behold UI åpent slik at bjarne kan fortsette å edit
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5800,
           background: "rgba(8,4,20,0.92)", backdropFilter: "blur(10px)",
           display: "flex", flexDirection: "column",
           color: ROLE_ROOM_BRAND.textPrimary,
         }}>

      {/* Header */}
      <div onClick={e => e.stopPropagation()}
           style={{
             background: ROLE_ROOM_BRAND.surfaceGradient,
             borderBottom: `1px solid rgba(160,48,192,0.20)`,
             padding: "12px 22px",
             display: "flex", alignItems: "center", justifyContent: "space-between",
           }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 6,
            background: ROLE_ROOM_BRAND.signatureGradient,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <VideocamIcon sx={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Multi-cam Sync Studio
            </div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              {groups.length} grupper · audio-waveform cross-correlation
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => void handleSave()}
                  disabled={saving || clips.length === 0}
                  style={{
                    background: saving
                      ? "rgba(110,63,199,0.20)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4,
                    cursor: saving ? "wait"
                          : clips.length === 0 ? "not-allowed" : "pointer",
                    opacity: clips.length === 0 ? 0.4 : 1,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <SaveIcon sx={{ fontSize: 13 }} />
            {saving ? "Lagrer …" : "Lagre gruppe"}
          </button>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0,
                            color: ROLE_ROOM_BRAND.textSecondary,
                            cursor: "pointer", padding: 4,
                            display: "inline-flex", alignItems: "center" }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {error && (
        <div onClick={e => e.stopPropagation()}
             style={{ padding: "8px 22px",
                       background: "rgba(239,79,111,0.15)",
                       color: "#ef4f6f", fontSize: 11 }}>{error}</div>
      )}

      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, display: "grid",
                     gridTemplateColumns: "240px 1fr", overflow: "hidden" }}>

        {/* LEFT: groups-list */}
        <div style={{ background: "rgba(255,255,255,0.02)",
                        borderRight: `1px solid rgba(160,48,192,0.18)`,
                        padding: 12, overflowY: "auto" }}>
          <button onClick={startNewGroup}
                  style={{
                    width: "100%", marginBottom: 12,
                    background: ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "8px 12px", fontSize: 11.5, fontWeight: 600,
                    borderRadius: 4, cursor: "pointer",
                    display: "inline-flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                  }}>
            <AddIcon sx={{ fontSize: 14 }} />
            Ny gruppe
          </button>
          <div style={{ fontSize: 10, fontWeight: 700,
                          color: ROLE_ROOM_BRAND.textTertiary,
                          marginBottom: 6, letterSpacing: 0.5 }}>
            EKSISTERENDE GRUPPER
          </div>
          {!loaded && (
            <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 20 }}>Laster …</div>
          )}
          {loaded && groups.length === 0 && (
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 14, lineHeight: 1.5 }}>
              Ingen lagrede grupper. Start ny og legg til kamera-klipp.
            </div>
          )}
          {groups.map(g => (
            <div key={g.id}
                 onClick={() => openGroup(g)}
                 style={{
                   padding: 8, marginBottom: 4, borderRadius: 3,
                   background: activeGroup?.id === g.id
                     ? "rgba(160,48,192,0.18)"
                     : "rgba(255,255,255,0.03)",
                   border: activeGroup?.id === g.id
                     ? `1px solid ${ROLE_ROOM_BRAND.primaryLila}55`
                     : "1px solid transparent",
                   cursor: "pointer",
                 }}>
              <div style={{ fontSize: 11, fontWeight: 600,
                              overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap" }}>
                {g.groupName}
              </div>
              <div style={{ fontSize: 9, color: ROLE_ROOM_BRAND.textTertiary,
                              marginTop: 1 }}>
                {(g.clips || []).length} klipp · {g.syncStatus}
                {g.agentKind && ` · ${g.agentKind}`}
              </div>
            </div>
          ))}
        </div>

        {/* CENTER: edit area */}
        <div style={{
          background: ROLE_ROOM_BRAND.deepNavy,
          padding: 22, overflowY: "auto",
        }}>
          {/* Group-name + toolbar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16,
                          alignItems: "center" }}>
            <input value={groupName}
                   onChange={e => setGroupName(e.target.value)}
                   placeholder="Gruppe-navn …"
                   style={{
                     flex: 1,
                     background: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(160,48,192,0.18)",
                     borderRadius: 3, padding: "7px 10px",
                     color: ROLE_ROOM_BRAND.textPrimary, fontSize: 12.5,
                     fontWeight: 600,
                   }} />
            <button onClick={() => void handleAddClips()}
                    disabled={extractingWaveform !== null}
                    style={{
                      background: "rgba(160,48,192,0.20)",
                      border: "1px solid rgba(160,48,192,0.40)",
                      color: "#fff", padding: "7px 12px", fontSize: 11.5,
                      borderRadius: 3, cursor: "pointer", fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
              <AddIcon sx={{ fontSize: 13 }} />
              {extractingWaveform ? "Henter waveform …" : "Legg til klipp"}
            </button>
            <button onClick={() => void handleAutoSync()}
                    disabled={syncing || clips.length < 2}
                    style={{
                      background: syncing
                        ? "rgba(110,63,199,0.20)"
                        : ROLE_ROOM_BRAND.signatureGradient,
                      border: 0, color: "#fff",
                      padding: "7px 12px", fontSize: 11.5, fontWeight: 600,
                      borderRadius: 3,
                      cursor: syncing ? "wait"
                            : clips.length < 2 ? "not-allowed" : "pointer",
                      opacity: clips.length < 2 ? 0.4 : 1,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
              <AutoFixHighIcon sx={{ fontSize: 13 }} />
              {syncing ? "Synker …" : "Auto-sync"}
            </button>
          </div>

          {clips.length === 0 && (
            <div style={{ textAlign: "center", padding: 80, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary,
                            lineHeight: 1.6 }}>
              Ingen klipp i denne gruppen enda.
              <br />Klikk "Legg til klipp" for å starte.
            </div>
          )}

          {/* Clip-rows med waveforms */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clips.map(clip => (
              <ClipRow key={clip.id} clip={clip}
                        onSetReference={() => handleSetReference(clip.id)}
                        onRemove={() => handleRemoveClip(clip.id)}
                        onManualOffsetChange={(v) => handleManualOffsetChange(clip.id, v)} />
            ))}
          </div>

          {clips.length >= 2 && (
            <div style={{
              marginTop: 18, padding: 12, borderRadius: 6,
              background: "rgba(74,212,138,0.06)",
              border: "1px solid rgba(74,212,138,0.20)",
              fontSize: 11, color: ROLE_ROOM_BRAND.textSecondary,
              lineHeight: 1.5,
            }}>
              <strong>Tips:</strong> Etter Auto-sync kan du fin-justere
              med slider-en hvis offset ser litt off ut. Confidence-
              score under 0.5 betyr at audio var for likt eller for lite
              karakteristisk — prøv lengre analyse-vindu, eller juster
              manuelt mot en visuell sync-cue (klapp/blink).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClipRow({ clip, onSetReference, onRemove, onManualOffsetChange }: {
  clip: MulticamClip;
  onSetReference: () => void;
  onRemove: () => void;
  onManualOffsetChange: (v: number) => void;
}) {
  const effective = effectiveOffset(clip);
  const confidenceColor = clip.confidence > 0.7 ? "#4ad48a"
    : clip.confidence > 0.4 ? "#f0a500"
    : clip.confidence > 0 ? "#ef4f6f"
    : ROLE_ROOM_BRAND.textTertiary;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: clip.isReference
        ? `1px solid rgba(160,48,192,0.45)`
        : "1px solid rgba(160,48,192,0.15)",
      borderRadius: 6, padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10,
                      marginBottom: 8 }}>
        <button onClick={onSetReference}
                title={clip.isReference ? "Reference-klipp" : "Sett som reference"}
                style={{
                  background: "transparent", border: 0,
                  cursor: "pointer", padding: 2,
                  color: clip.isReference
                    ? ROLE_ROOM_BRAND.primaryLila
                    : ROLE_ROOM_BRAND.textTertiary,
                  display: "inline-flex", alignItems: "center",
                }}>
          {clip.isReference
            ? <StarIcon sx={{ fontSize: 18 }} />
            : <StarBorderIcon sx={{ fontSize: 18 }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600,
                          color: ROLE_ROOM_BRAND.textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap" }}>
            {clip.fileName}
          </div>
          <div style={{ fontSize: 10, color: ROLE_ROOM_BRAND.textTertiary,
                          display: "flex", gap: 10 }}>
            <span>{Math.floor(clip.durationSec / 60)}:{String(Math.floor(clip.durationSec % 60)).padStart(2, "0")}</span>
            {clip.isReference && (
              <span style={{ color: ROLE_ROOM_BRAND.primaryLila,
                                fontWeight: 600 }}>REFERENCE</span>
            )}
            {!clip.isReference && clip.confidence > 0 && (
              <span style={{ color: confidenceColor, fontWeight: 600 }}>
                confidence {(clip.confidence * 100).toFixed(0)}%
              </span>
            )}
            {!clip.isReference && (
              <span>offset {effective >= 0 ? "+" : ""}{effective.toFixed(3)}s</span>
            )}
          </div>
        </div>
        <button onClick={onRemove}
                title="Fjern fra gruppe"
                style={{ background: "transparent", border: 0,
                          color: "#ef4f6f", cursor: "pointer", padding: 4,
                          display: "inline-flex", alignItems: "center" }}>
          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
        </button>
      </div>

      {/* Waveform-strip med offset-shift */}
      <WaveformStrip
        waveform={clip.waveformData}
        offsetSec={effective}
        durationSec={clip.durationSec}
        isReference={clip.isReference}
      />

      {/* Manual finetune-slider */}
      {!clip.isReference && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
                        marginTop: 8, fontSize: 10.5,
                        color: ROLE_ROOM_BRAND.textSecondary }}>
          <span style={{ minWidth: 70 }}>Finetune</span>
          <input type="range" min={-3} max={3} step={0.01}
                 value={clip.manualOffsetSec}
                 onChange={e => onManualOffsetChange(parseFloat(e.target.value))}
                 style={{ flex: 1, accentColor: ROLE_ROOM_BRAND.primaryLila }} />
          <span style={{ minWidth: 60, textAlign: "right",
                           fontWeight: 600,
                           color: clip.manualOffsetSec !== 0
                             ? ROLE_ROOM_BRAND.primaryLila
                             : ROLE_ROOM_BRAND.textPrimary }}>
            {clip.manualOffsetSec >= 0 ? "+" : ""}
            {clip.manualOffsetSec.toFixed(2)}s
          </span>
          <button onClick={() => onManualOffsetChange(0)}
                  disabled={clip.manualOffsetSec === 0}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: ROLE_ROOM_BRAND.textSecondary,
                    borderRadius: 3, padding: "2px 8px", fontSize: 10,
                    cursor: clip.manualOffsetSec === 0 ? "default" : "pointer",
                    opacity: clip.manualOffsetSec === 0 ? 0.4 : 1,
                  }}>Reset</button>
        </div>
      )}
    </div>
  );
}

function WaveformStrip({ waveform, offsetSec, durationSec, isReference }: {
  waveform: number[];
  offsetSec: number;
  durationSec: number;
  isReference: boolean;
}) {
  // Visualiser waveform med offset-shift indikert
  return (
    <div style={{
      position: "relative",
      height: 40,
      background: "rgba(0,0,0,0.4)",
      borderRadius: 3, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", height: "100%",
        // Skift waveform horisontalt basert på offset
        marginLeft: `${(offsetSec / Math.max(1, durationSec)) * 100}%`,
        transition: "margin-left 0.2s ease",
      }}>
        {waveform.map((v, i) => (
          <div key={i} style={{
            flex: 1,
            alignSelf: "center",
            height: `${Math.max(2, v * 100)}%`,
            background: isReference
              ? ROLE_ROOM_BRAND.primaryLila
              : "rgba(160,48,192,0.6)",
            opacity: 0.5 + v * 0.5,
            margin: "0 0.5px",
          }} />
        ))}
      </div>
      {/* 0-marker (reference start) */}
      <div style={{
        position: "absolute", top: 0, bottom: 0,
        left: 0, width: 1,
        background: "rgba(255,255,255,0.4)",
      }} />
    </div>
  );
}

export default MulticamSyncStudio;
