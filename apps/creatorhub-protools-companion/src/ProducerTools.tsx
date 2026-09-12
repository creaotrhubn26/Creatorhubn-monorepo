import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, MenuItem,
  Stack, TextField, Typography,
} from "@mui/material";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import CameraOutlined from "@mui/icons-material/CameraOutlined";
import AutoFixHighOutlined from "@mui/icons-material/AutoFixHighOutlined";
import FolderOpen from "@mui/icons-material/FolderOpen";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "./api";
import type { AppState, AudioQcReport, DeliveryJob, DeliveryOutput, SessionSnapshot } from "./api";

const ORANGE = "#ff8c00";
const OUTPUT_LIBRARY = [
  { kind: "master", label: "Master", suffix: "MASTER" },
  { kind: "instrumental", label: "Instrumental", suffix: "INSTRUMENTAL" },
  { kind: "acapella", label: "Acapella", suffix: "ACAPELLA" },
  { kind: "clean", label: "Clean", suffix: "CLEAN" },
  { kind: "tv", label: "TV-miks", suffix: "TV" },
] as const;

export function ProducerTools({ state, report, refreshState }: {
  state: AppState;
  report: (kind: "info" | "marker" | "bounce" | "error", message: string) => void;
  refreshState: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [sources, setSources] = useState<Array<{ name: string; sourceType: string }>>([]);
  const [reviewSource, setReviewSource] = useState("");
  const [reviewName, setReviewName] = useState(`${sanitize(state.session_name || "Mix")} Review.wav`);
  const [lastQc, setLastQc] = useState<AudioQcReport | null>(null);
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([]);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [deliveryDir, setDeliveryDir] = useState(state.bounce_dir || "");
  const [preset, setPreset] = useState("label");
  const [selectedKinds, setSelectedKinds] = useState<string[]>(["master", "instrumental", "acapella", "clean", "tv"]);
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>({});

  const reloadHistory = async () => {
    const [nextSnapshots, nextJobs] = await Promise.all([
      api.listSessionSnapshots().catch(() => []), api.listDeliveryJobs().catch(() => []),
    ]);
    setSnapshots(nextSnapshots); setJobs(nextJobs);
  };

  useEffect(() => {
    if (state.ptsl.state === "connected") {
      void api.listExportSources().then((value) => {
        setSources(value.sources || []);
        if (!reviewSource && value.sources?.length) setReviewSource(value.sources[0].name);
      }).catch((error) => report("error", `Kunne ikke lese eksportkilder: ${error}`));
    }
    void reloadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session_id, state.ptsl.state]);

  const selectedOutputs = useMemo<DeliveryOutput[]>(() => {
    const baseName = sanitize(state.session_name || "Session");
    if (preset === "stems") {
      return sources.map((source) => ({
        kind: "stem",
        fileName: `${baseName} STEM ${sanitize(source.name)}.wav`,
        source: source.name,
      }));
    }
    return OUTPUT_LIBRARY
      .filter((item) => selectedKinds.includes(item.kind))
      .flatMap((item) => {
        const source = sourceOverrides[item.kind] || bestSource(sources, item.kind);
        return source ? [{ kind: item.kind, fileName: `${baseName} ${item.suffix}.wav`, source }] : [];
      });
  }, [preset, selectedKinds, sourceOverrides, sources, state.session_name]);

  const missingSourceCount = preset === "stems"
    ? 0
    : Math.max(0, selectedKinds.length - selectedOutputs.length);

  const sendReview = async () => {
    setBusy("review");
    try {
      const result = await api.sendToReview(reviewName, reviewSource || null);
      setLastQc(result.qc_report);
      report("bounce", result.version_number ? `Review publisert som Mix V${result.version_number}` : "Review publisert");
      await Promise.all([reloadHistory(), refreshState()]);
    } catch (error) { report("error", `Review-publisering feilet: ${error}`); }
    finally { setBusy(null); }
  };

  const capture = async () => {
    setBusy("snapshot");
    try { await api.captureSessionSnapshot(); report("info", "Session Snapshot lagret"); await reloadHistory(); }
    catch (error) { report("error", `Snapshot feilet: ${error}`); }
    finally { setBusy(null); }
  };

  const recall = async (snapshot: SessionSnapshot) => {
    setBusy(`recall:${snapshot.id}`);
    try {
      const preview = await api.previewSessionRecall(snapshot);
      const changedTracks = preview.changes.reduce((sum, change) => sum + change.trackCount, 0);
      if (!changedTracks) {
        report("info", `«${snapshot.session_name || state.session_name || "Sesjonen"}» matcher allerede snapshotet`);
        return;
      }
      const missing = preview.missingTracks.length
        ? ` ${preview.missingTracks.length} spor finnes ikke lenger og hoppes over.`
        : "";
      const confirmed = window.confirm(
        `Gjenopprett ${changedTracks} sporstatus-endringer i åpen Pro Tools-sesjon?${missing}\n\nCompanion lagrer automatisk et recovery-snapshot først.`,
      );
      if (!confirmed) return;
      const result = await api.recallSessionSnapshot(snapshot);
      report("info", `Session Recall fullført for ${result.matchedTracks} spor${result.recoverySnapshotId ? " · recovery-snapshot ✓" : ""}`);
      if (result.postRecallSnapshotError) report("error", `Recall ble utført, men kontrollsnapshot feilet: ${result.postRecallSnapshotError}`);
      await Promise.all([reloadHistory(), refreshState()]);
    } catch (error) { report("error", `Session Recall feilet: ${error}`); }
    finally { setBusy(null); }
  };

  const introCopy = async () => {
    const folder = await open({ directory: true, multiple: false, title: "Velg mappe for Intro-sikker kopi" });
    if (typeof folder !== "string") return;
    setBusy("intro");
    try {
      await api.makeIntroCopy(folder, `${sanitize(state.session_name || "Session")} — Intro Safe`);
      report("info", "Intro-sikker kopi opprettet. Originalen er ikke endret.");
      await reloadHistory();
    } catch (error) { report("error", `Intro-kopi feilet: ${error}`); }
    finally { setBusy(null); }
  };

  const chooseDeliveryDir = async () => {
    const folder = await open({ directory: true, multiple: false, title: "Velg leveransemappe" });
    if (typeof folder === "string") setDeliveryDir(folder);
  };

  const deliver = async () => {
    if (!deliveryDir || !selectedOutputs.length) { report("error", "Velg leveransemappe og minst én fil"); return; }
    setBusy("delivery");
    try {
      const result = await api.runDelivery(preset, deliveryDir, selectedOutputs);
      report("bounce", `${result.outputs.length} filer QC-godkjent og samlet i leveransemanifest`);
      setLastQc(result.outputs[result.outputs.length - 1]?.qc_report || null);
      await reloadHistory();
    } catch (error) { report("error", `Leveransen ble stoppet: ${error}`); await reloadHistory(); }
    finally { setBusy(null); }
  };

  return (
    <Stack spacing={2}>
      {state.ptsl.state !== "connected" && <Alert severity="warning">Start Pro Tools og åpne en sesjon. Direkte eksport, recall og Intro-kopi krever PTSL.</Alert>}

      <ToolCard title="Ett trykk til review" icon={<CloudUploadOutlined />}>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Tar snapshot, eksporterer 24-bit WAV, kjører EBU R128/true-peak-QC, laster opp og oppretter neste Sound Room-versjon.</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.2 }}>
          <TextField size="small" label="Filnavn" value={reviewName} onChange={(event) => setReviewName(event.target.value)} fullWidth />
          <TextField size="small" select label="Mikskilde" value={reviewSource} onChange={(event) => setReviewSource(event.target.value)} sx={{ minWidth: 220 }}>
            {sources.map((source) => <MenuItem key={`${source.sourceType}-${source.name}`} value={source.name}>{source.name}</MenuItem>)}
          </TextField>
          <Button variant="contained" disabled={busy != null || state.ptsl.state !== "connected" || !reviewName.trim()} onClick={() => void sendReview()}
            sx={{ bgcolor: ORANGE, whiteSpace: "nowrap", fontWeight: 800, "&:hover": { bgcolor: "#e07e00" } }}>Send til review</Button>
        </Stack>
        {busy === "review" && <LinearProgress sx={{ mt: 1 }} />}
        {lastQc && <QcSummary report={lastQc} />}
      </ToolCard>

      <ToolCard title="Session Snapshot / Recall" icon={<CameraOutlined />}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography sx={{ fontSize: 12, color: "text.secondary", flex: 1 }}>Dokumenterer sporstatus, playlists, routing, bouncekilder, samplerate og bitdybde. Recall gjenoppretter trygt mute, solo, aktiv/inaktiv, synlighet og åpne mapper; recovery-snapshot tas alltid først.</Typography>
          <Button variant="outlined" onClick={() => void capture()} disabled={busy != null || state.ptsl.state !== "connected"} sx={{ color: ORANGE, borderColor: ORANGE }}>Ta snapshot</Button>
        </Stack>
        {snapshots.slice(0, 5).map((snapshot) => (
          <Stack key={snapshot.id} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1, alignItems: { sm: "center" } }}>
            <Chip size="small" label={snapshot.review_version_id ? "Versjonskoblet" : snapshot.reason.replace("_", " ")} sx={{ color: snapshot.review_version_id ? "#5fb88a" : "#8ea0b8" }} />
            <Typography sx={{ fontSize: 12, flex: 1 }}>{snapshot.session_name || state.session_name} · {snapshot.track_count} spor · {snapshot.sample_rate || "?"} Hz</Typography>
            <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>{new Date(snapshot.created_at).toLocaleString("nb-NO")}</Typography>
            <Button size="small" startIcon={<RestoreOutlined />} onClick={() => void recall(snapshot)}
              disabled={busy != null || state.ptsl.state !== "connected"} sx={{ color: ORANGE, whiteSpace: "nowrap" }}>
              {busy === `recall:${snapshot.id}` ? "Recall …" : "Recall"}
            </Button>
          </Stack>
        ))}
      </ToolCard>

      {state.protools_tier === "intro" && (
        <ToolCard title="Gjør sesjonen klar for Pro Tools Intro" icon={<AutoFixHighOutlined />}>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Lager først en ny PTX-kopi. Bare kopien tilpasses: overskytende audio-, instrument-, MIDI- og aux-spor settes inaktive.</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.2, alignItems: "center" }}>
            <Chip size="small" label={state.intro_preflight?.compatible ? "Allerede Intro-klar" : `${state.intro_preflight?.violations.length || 0} avvik`} sx={{ color: state.intro_preflight?.compatible ? "#5fb88a" : "#e0606a" }} />
            <Button variant="outlined" onClick={() => void introCopy()} disabled={busy != null || state.ptsl.state !== "connected"} sx={{ ml: "auto!important", color: ORANGE, borderColor: ORANGE }}>Lag sikker kopi</Button>
          </Stack>
        </ToolCard>
      )}

      <ToolCard title="Stem- og leveransefabrikk" icon={<Inventory2Outlined />}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField select size="small" label="Leveranseprofil" value={preset} onChange={(event) => setPreset(event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="label">Label</MenuItem><MenuItem value="sync">Film / sync</MenuItem><MenuItem value="stems">Stems</MenuItem><MenuItem value="custom">Egendefinert</MenuItem>
          </TextField>
          <TextField size="small" label="Leveransemappe" value={deliveryDir} onChange={(event) => setDeliveryDir(event.target.value)} fullWidth />
          <Button startIcon={<FolderOpen />} onClick={() => void chooseDeliveryDir()} sx={{ color: ORANGE }}>Velg</Button>
        </Stack>
        {preset === "stems" ? (
          <Alert severity={sources.length ? "info" : "warning"} sx={{ mt: 1 }}>
            {sources.length ? `Eksporterer alle ${sources.length} oppdagede fysiske utganger og busser som separate stems.` : "Ingen eksportkilder ble funnet i Pro Tools."}
          </Alert>
        ) : (
          <Stack spacing={.8} sx={{ mt: 1 }}>
            {OUTPUT_LIBRARY.map((item) => {
              const selected = selectedKinds.includes(item.kind);
              const source = sourceOverrides[item.kind] || bestSource(sources, item.kind) || "";
              return (
                <Stack key={item.kind} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                  <FormControlLabel sx={{ minWidth: 145, m: 0 }} control={<Checkbox size="small" checked={selected}
                    onChange={(event) => setSelectedKinds((current) => event.target.checked ? [...current, item.kind] : current.filter((kind) => kind !== item.kind))} />}
                    label={<Typography sx={{ fontSize: 12 }}>{item.label}</Typography>} />
                  <TextField select size="small" label="Eksportkilde" value={source} disabled={!selected} fullWidth
                    onChange={(event) => setSourceOverrides((current) => ({ ...current, [item.kind]: event.target.value }))}>
                    {sources.map((entry) => <MenuItem key={`${item.kind}-${entry.sourceType}-${entry.name}`} value={entry.name}>{entry.name} · {entry.sourceType === "EMSType_Bus" ? "buss" : "utgang"}</MenuItem>)}
                  </TextField>
                </Stack>
              );
            })}
            {missingSourceCount > 0 && <Alert severity="warning">Velg en eksplisitt Pro Tools-kilde for {missingSourceCount} valgte leveranser. Companion bruker aldri masteren som skjult reserve for instrumental, acapella eller TV-miks.</Alert>}
          </Stack>
        )}
        <Button variant="contained" onClick={() => void deliver()} disabled={busy != null || state.ptsl.state !== "connected" || !selectedOutputs.length || !deliveryDir || missingSourceCount > 0}
          sx={{ mt: 1, bgcolor: ORANGE, fontWeight: 800, "&:hover": { bgcolor: "#e07e00" } }}>Kjør QC-sikret leveranse</Button>
        {busy === "delivery" && <LinearProgress sx={{ mt: 1 }} />}
        {jobs.slice(0, 4).map((job) => (
          <Stack key={job.id} direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
            <Chip size="small" label={job.status} color={job.status === "completed" ? "success" : job.status === "failed" ? "error" : "default"} />
            <Typography sx={{ fontSize: 12, flex: 1 }}>{job.preset} · {job.requested_outputs.length} filer</Typography>
            <Typography sx={{ fontSize: 11 }}>{job.progress}%{job.manifest_id ? " · manifest ✓" : ""}</Typography>
          </Stack>
        ))}
      </ToolCard>
    </Stack>
  );
}

function QcSummary({ report }: { report: AudioQcReport }) {
  return (
    <Box sx={{ mt: 1.2, p: 1.2, borderRadius: 1.5, bgcolor: report.passed ? "rgba(95,184,138,.08)" : "rgba(224,96,106,.08)" }}>
      <Stack direction="row" spacing={.7} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Chip size="small" label={report.passed ? "QC bestått" : "QC-avvik"} color={report.passed ? "success" : "error"} />
        <Chip size="small" label={`${report.integrated_lufs ?? "—"} LUFS-I`} />
        <Chip size="small" label={`${report.true_peak_dbtp ?? "—"} dBTP`} />
        <Chip size="small" label={`${report.sample_rate ?? "—"} Hz · ${report.bit_depth ?? "—"}-bit`} />
      </Stack>
      {report.issues.map((issue) => <Typography key={issue.code} sx={{ mt: .5, fontSize: 11.5, color: issue.severity === "error" ? "#e9a1a7" : "#e1b85a" }}>{issue.message}</Typography>)}
    </Box>
  );
}

function ToolCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Box sx={{ p: 1.6, borderRadius: 2, border: "1px solid rgba(255,255,255,.08)", bgcolor: "rgba(255,255,255,.018)" }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>{<Box sx={{ color: ORANGE }}>{icon}</Box>}<Typography sx={{ fontSize: 13, fontWeight: 800 }}>{title}</Typography></Stack>
    {children}
  </Box>;
}

function sanitize(value: string) { return value.replace(/[^A-Za-z0-9ÆØÅæøå ._-]/g, "_").trim(); }
function bestSource(sources: Array<{ name: string }>, kind: string): string | undefined {
  const patterns: Record<string, RegExp> = {
    master: /(master|main|mix|out 1-2)/i, instrumental: /(instrumental|inst)/i,
    acapella: /(acapella|a cappella|vocal)/i, clean: /(clean)/i, tv: /(tv|music.?effects|m&e)/i,
  };
  return sources.find((source) => patterns[kind]?.test(source.name))?.name;
}
