import { useEffect, useState, useCallback } from "react";
import {
  Box, Stack, Typography, Button, TextField, MenuItem, Chip, Divider,
  CircularProgress, IconButton, Tooltip, LinearProgress,
} from "@mui/material";
import GraphicEq from "@mui/icons-material/GraphicEq";
import FolderOpen from "@mui/icons-material/FolderOpen";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Stop from "@mui/icons-material/Stop";
import Sync from "@mui/icons-material/Sync";
import LinkOff from "@mui/icons-material/LinkOff";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import TaskAlt from "@mui/icons-material/TaskAlt";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import * as api from "./api";
import type { AppState, TrackInfo, ActivityEntry, FeedbackInbox } from "./api";

const ORANGE = "#ff8c00";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackInbox | null>(null);

  // Pairing
  const [code, setCode] = useState("");
  const [apiBase, setApiBase] = useState("");

  // Session setup
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [trackId, setTrackId] = useState("");
  const [name, setName] = useState("");
  const [infoPath, setInfoPath] = useState<string | null>(null);
  const [bounceDir, setBounceDir] = useState<string | null>(null);
  const [proToolsTier, setProToolsTier] = useState<AppState["protools_tier"]>("intro");

  const refresh = useCallback(async () => {
    try {
      const s = await api.getState();
      setState(s);
      setApiBase((prev) => prev || s.api_base);
      if (s.session_info_path) setInfoPath(s.session_info_path);
      if (s.bounce_dir) setBounceDir(s.bounce_dir);
      if (s.easeverse_track_id) setTrackId((previous) => previous || s.easeverse_track_id || "");
      if (s.suggested_project_name) setName((previous) => previous || `${s.suggested_project_name} — Mix`);
      setProToolsTier(s.protools_tier || "intro");
      if (s.paired && !s.session_id) {
        try { setTracks(await api.listTracks()); } catch { /* */ }
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshFeedback = useCallback(async () => {
    if (!state?.session_id || !state.audio_room_id) return;
    try { setFeedback(await api.getFeedback()); }
    catch (error) { logLocal("error", `Feedback kunne ikke hentes: ${error}`); }
  }, [state?.session_id, state?.audio_room_id]);

  useEffect(() => {
    if (!state?.session_id || !state.audio_room_id) return;
    void refreshFeedback();
    const timer = window.setInterval(() => {
      void refreshFeedback();
      void api.processCommands().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [state?.session_id, state?.audio_room_id, refreshFeedback]);

  useEffect(() => {
    if (!state?.session_id || !state.audio_room_id || !state.api_base) return;
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    const connect = async () => {
      try {
        const issued = await api.createRealtimeTicket();
        if (closed) return;
        const url = new URL(issued.websocketPath, state.api_base);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.searchParams.set("ticket", issued.ticket);
        socket = new WebSocket(url.toString());
        socket.onmessage = (message) => {
          try {
            const frame = JSON.parse(String(message.data));
            if (frame?.type !== "user_event" || frame?.event?.kind !== "sound-room.updated") return;
            if (issued.workspaceProjectId && frame.event.projectId !== issued.workspaceProjectId) return;
            void refreshFeedback();
            void api.processCommands().then((result) => {
              if (result.processed > 0) void refresh();
            }).catch((error) => logLocal("error", `Pro Tools-kommando kunne ikke kjøres: ${error}`));
          } catch { /* ignore unknown protocol frames */ }
        };
        socket.onclose = () => {
          if (!closed) reconnectTimer = window.setTimeout(() => void connect(), 2_000);
        };
      } catch (error) {
        if (!closed) reconnectTimer = window.setTimeout(() => void connect(), 5_000);
      }
    };
    void connect();
    void api.processCommands().catch(() => undefined);
    return () => {
      closed = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [state?.session_id, state?.audio_room_id, state?.api_base, refreshFeedback, refresh]);

  useEffect(() => {
    const un = listen<{ kind: ActivityEntry["kind"]; message: string }>("companion://activity", (e) => {
      const entry: ActivityEntry = { ts: new Date().toISOString(), kind: e.payload.kind, message: e.payload.message };
      setActivity((a) => [entry, ...a].slice(0, 200));
      // Alle backend-aktiviteter kan endre den varige køen eller PTSL-statusen.
      // Oppdater også etter restart-reconciliation, ikke bare etter ny bounce.
      void refresh();
    });
    return () => { un.then((f) => f()); };
  }, [refresh]);

  const logLocal = (kind: ActivityEntry["kind"], message: string) =>
    setActivity((a) => [{ ts: new Date().toISOString(), kind, message }, ...a].slice(0, 200));

  const doPair = async () => {
    if (!/^\d{6}$/.test(code.trim())) { logLocal("error", "Koden må være 6 siffer"); return; }
    setBusy(true);
    try {
      const r = await api.pair(code.trim(), apiBase.trim());
      logLocal("info", `Koblet til som ${r.user_email}`);
      setCode("");
      await refresh();
    } catch (e: any) { logLocal("error", `Paring feilet: ${e}`); }
    finally { setBusy(false); }
  };

  const pickInfo = async () => {
    const f = await open({ multiple: false, filters: [{ name: "Session Info", extensions: ["txt"] }] });
    if (typeof f === "string") setInfoPath(f);
  };
  const pickBounce = async () => {
    const d = await open({ directory: true, multiple: false });
    if (typeof d === "string") setBounceDir(d);
  };

  const doSetup = async () => {
    if (!name.trim()) { logLocal("error", "Gi sesjonen et navn"); return; }
    setBusy(true);
    try {
      const track = tracks.find((t) => t.id === trackId);
      const r = await api.setupSession({
        name: name.trim(),
        sessionType: "mixing",
        easeverseTrackId: trackId || null,
        audioRoomId: track?.review_id || null,
        sessionInfoPath: infoPath,
        bounceDir,
        proToolsTier,
      });
      logLocal("info", r.linked_review ? `Sesjon koblet til Sound Room` : `Sesjon opprettet (ikke koblet til track)`);
      await refresh();
    } catch (e: any) { logLocal("error", `Kunne ikke opprette sesjon: ${e}`); }
    finally { setBusy(false); }
  };

  const toggleWatch = async () => {
    setBusy(true);
    try {
      if (state?.watching) { await api.stopWatching(); logLocal("info", "Overvåking stoppet"); }
      else { await api.startWatching(); logLocal("info", "Overvåker Pro Tools-eksporter…"); }
      await refresh();
    } catch (e: any) { logLocal("error", `${e}`); }
    finally { setBusy(false); }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const r = await api.syncSessionInfo();
      const easeVerseStatus = r.easeverse_synced
        ? " · EaseVerse synket"
        : state?.easeverse_track_id ? " · Sound Room lagret; EaseVerse-synk ikke bekreftet" : "";
      logLocal("marker", `Synket ${r.markers_stored} markører → ${r.sections_synced} seksjoner${easeVerseStatus}`);
    } catch (e: any) { logLocal("error", `Synk feilet: ${e}`); }
    finally { setBusy(false); }
  };

  const doUnpair = async () => {
    setBusy(true);
    try { await api.unpair(); setState(null); await refresh(); logLocal("info", "Frakoblet"); }
    finally { setBusy(false); }
  };

  if (loading) return <Center><CircularProgress sx={{ color: ORANGE }} /></Center>;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary", p: 3 }}>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, alignItems: "center" }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(255,140,0,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GraphicEq sx={{ color: ORANGE }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Pro Tools Companion</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>CreatorHub · EaseVerse / Sound Room</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {state?.paired && (
          <Tooltip title="Koble fra denne maskinen">
            <IconButton onClick={doUnpair} disabled={busy} sx={{ color: "text.secondary" }}><LinkOff /></IconButton>
          </Tooltip>
        )}
      </Stack>

      {busy && <LinearProgress sx={{ mb: 2, "& .MuiLinearProgress-bar": { bgcolor: ORANGE } }} />}

      {/* ───────── PARING ───────── */}
      {!state?.paired && (
        <Panel title="Koble til CreatorHub">
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
            Åpne Sound Room → «Pro Tools Companion» i CreatorHub og lag en paringskode. Skriv den inn her.
          </Typography>
          <Stack spacing={1.5}>
            <TextField label="Paringskode (6 siffer)" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              slotProps={{ htmlInput: { inputMode: "numeric", style: { letterSpacing: 6, fontSize: 22, fontWeight: 700 } } }} fullWidth />
            <TextField label="API-adresse" value={apiBase} onChange={(e) => setApiBase(e.target.value)} fullWidth size="small" />
            <Button variant="contained" onClick={doPair} disabled={busy || code.length !== 6}
              sx={{ bgcolor: ORANGE, fontWeight: 700, "&:hover": { bgcolor: "#e07e00" } }}>Koble til</Button>
          </Stack>
        </Panel>
      )}

      {/* ───────── SESJON-OPPSETT ───────── */}
      {state?.paired && !state?.session_id && (
        <Panel title="Sett opp sesjon">
          <Stack spacing={1.5}>
            <Chip label={`Innlogget: ${state.user_email || "ukjent"}`} size="small" sx={{ alignSelf: "flex-start", bgcolor: "rgba(255,140,0,0.12)", color: ORANGE }} />
            {state.workspace_project_id && (
              <Chip label="Åpnet fra CreatorHub Workspace" size="small" sx={{ alignSelf: "flex-start", bgcolor: "rgba(95,184,138,0.14)", color: "#5fb88a" }} />
            )}
            <TextField label="Sesjonsnavn" value={name} onChange={(e) => setName(e.target.value)} fullWidth placeholder="f.eks. Running Home — Mix" />
            <TextField select label="Koble til EaseVerse-låt (Sound Room)" value={trackId} onChange={(e) => setTrackId(e.target.value)} fullWidth
              helperText={state.easeverse_track_id ? "Forhåndsvalgt fra Sound Room-pairingen. Markører og bounces havner i samme prosjekt." : "Markører og bounces havner i denne låtens Sound Room."}>
              <MenuItem value="">— ikke koble —</MenuItem>
              {tracks.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.title}{t.artist ? ` · ${t.artist}` : ""}{t.review_id ? " ✓ Sound Room" : ""}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Pro Tools-utgave" value={proToolsTier} onChange={(e) => setProToolsTier(e.target.value as AppState["protools_tier"])} fullWidth>
              <MenuItem value="intro">Pro Tools Intro</MenuItem>
              <MenuItem value="artist">Pro Tools Artist</MenuItem>
              <MenuItem value="studio">Pro Tools Studio</MenuItem>
              <MenuItem value="flex">Pro Tools Ultimate / Flex</MenuItem>
            </TextField>
            <FilePick icon={<DescriptionOutlined />} label="«Session Info»-tekstfil" value={infoPath} onPick={pickInfo}
              hint="Pro Tools → File → Export → Session Info as Text. Velg den eksporterte .txt-fila." />
            <FilePick icon={<FolderOpen />} label="«Bounced Files»-mappe" value={bounceDir} onPick={pickBounce}
              hint="Mappen Pro Tools bouncer til. Nye WAV-er blir nye review-versjoner." />
            <Button variant="contained" onClick={doSetup} disabled={busy || !name.trim()}
              sx={{ bgcolor: ORANGE, fontWeight: 700, "&:hover": { bgcolor: "#e07e00" } }}>Opprett kobling</Button>
          </Stack>
        </Panel>
      )}

      {/* ───────── DASHBOARD ───────── */}
      {state?.paired && state?.session_id && (
        <Panel title={state.session_name || "Sesjon"}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip size="small" label={state.audio_room_id ? "Koblet til Sound Room" : "Ikke koblet til låt"} sx={{ bgcolor: state.audio_room_id ? "rgba(95,184,138,0.16)" : "rgba(255,255,255,0.06)", color: state.audio_room_id ? "#5fb88a" : "text.secondary" }} />
              <Chip size="small" label={state.watching ? "Overvåker" : "Pauset"} sx={{ bgcolor: state.watching ? "rgba(255,140,0,0.16)" : "rgba(255,255,255,0.06)", color: state.watching ? ORANGE : "text.secondary" }} />
              {state.auto_watch && <Chip size="small" label="Gjenopptas etter omstart" sx={{ bgcolor: "rgba(95,184,138,0.14)", color: "#5fb88a" }} />}
              <Chip size="small" label={state.ptsl.state === "connected" ? "PTSL direkte" : state.ptsl.server_detected ? "PTSL-bro mangler" : "Filmodus"}
                sx={{ bgcolor: state.ptsl.state === "connected" ? "rgba(95,184,138,0.16)" : "rgba(255,255,255,0.06)", color: state.ptsl.state === "connected" ? "#5fb88a" : "text.secondary" }} />
              {state.protools_tier === "intro" && state.intro_preflight && (
                <Chip size="small" label={state.intro_preflight.compatible ? "Intro-klar" : `${state.intro_preflight.violations.length} Intro-avvik`}
                  sx={{ bgcolor: state.intro_preflight.compatible ? "rgba(95,184,138,0.16)" : "rgba(224,96,106,0.16)", color: state.intro_preflight.compatible ? "#5fb88a" : "#e0606a" }} />
              )}
              {(state.pending_bounces > 0 || state.pending_session_info) && (
                <Chip size="small" label={`${state.pending_bounces + (state.pending_session_info ? 1 : 0)} i synk-kø`} sx={{ bgcolor: "rgba(63,167,214,0.14)", color: "#3fa7d6" }} />
              )}
            </Stack>
            <Row label="Session Info" value={state.session_info_path} />
            <Row label="Bounced Files" value={state.bounce_dir} />
            <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{state.ptsl.message}</Typography>
            {state.watching && <Typography sx={{ fontSize: 11.5, color: "#5fb88a" }}>Du kan la Companion stå i bakgrunnen. Nye bounces, markører og kommandoer synkroniseres automatisk, og den varige køen fortsetter etter neste oppstart.</Typography>}
            {state.protools_tier === "intro" && state.intro_preflight && !state.intro_preflight.compatible && (
              <Stack spacing={0.5} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: "rgba(224,96,106,0.08)" }}>
                {state.intro_preflight.violations.map((violation) => (
                  <Typography key={violation.category} sx={{ fontSize: 11.5, color: "#e9a1a7" }}>
                    {violation.category}: {violation.actual}/{violation.limit} · {violation.recommendation}
                  </Typography>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1}>
              {state.workspace_project_id && <Chip size="small" label="Workspace-koblet" sx={{ bgcolor: "rgba(63,167,214,0.14)", color: "#3fa7d6" }} />}
              <Button variant="contained" startIcon={state.watching ? <Stop /> : <PlayArrow />} onClick={toggleWatch} disabled={busy}
                sx={{ bgcolor: state.watching ? "#e0606a" : ORANGE, fontWeight: 700, "&:hover": { bgcolor: state.watching ? "#c84f58" : "#e07e00" } }}>
                {state.watching ? "Stopp overvåking" : "Start overvåking"}</Button>
              <Button variant="outlined" startIcon={<Sync />} onClick={syncNow} disabled={busy || !state.session_info_path}
                sx={{ color: ORANGE, borderColor: "rgba(255,140,0,0.5)" }}>Synk nå</Button>
            </Stack>
          </Stack>
        </Panel>
      )}

      {state?.paired && state?.session_id && state.audio_room_id && (
        <Panel title="Sound Room-feedback">
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "center" }}>
            <ForumOutlined sx={{ color: ORANGE, fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, flex: 1 }}>
              {feedback?.version ? `${feedback.version.version_label} · ${feedback.project?.status || feedback.version.status}` : "Ingen review-versjon ennå"}
            </Typography>
            <Button size="small" onClick={() => void refreshFeedback()} sx={{ color: ORANGE }}>Oppdater</Button>
          </Stack>
          {!feedback || (!feedback.comments.length && !feedback.approvals.length && !feedback.tasks.length) ? (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Ingen kommentarer, godkjenninger eller oppgaver ennå.</Typography>
          ) : (
            <Stack spacing={1.2}>
              {feedback.approvals.slice(0, 3).map((approval) => (
                <FeedbackRow key={approval.id} color="#5fb88a" title={approval.approval_type.replace(/_/g, " ")} body={approval.note || `Fra ${approval.approved_by || "reviewer"}`} />
              ))}
              {feedback.tasks.filter((task) => task.status !== "done").slice(0, 5).map((task) => (
                <FeedbackRow key={task.id} color="#3fa7d6" title={task.status === "in_progress" ? "Pågår" : "Oppgave"} body={task.title} icon={<TaskAlt sx={{ fontSize: 16 }} />} />
              ))}
              {feedback.comments.slice(0, 8).map((comment) => (
                <FeedbackRow key={comment.id} color={comment.is_decision ? "#5fb88a" : ORANGE} title={`${formatTimecode(comment.timecode_seconds)} · ${comment.author || "Reviewer"}`} body={comment.body}
                  actions={<>
                    <Button size="small" onClick={() => void api.locateFeedback(comment.timecode_seconds).catch((error) => logLocal("error", `Kunne ikke flytte playhead: ${error}`))} sx={{ color: ORANGE, minWidth: 0, p: 0 }}>Finn i PT</Button>
                    <Button size="small" disabled={comment.status === "resolved"} onClick={() => void api.resolveFeedback(comment.id).then(refreshFeedback).catch((error) => logLocal("error", `Kunne ikke løse kommentar: ${error}`))} sx={{ color: "#5fb88a", minWidth: 0, p: 0 }}>Løst</Button>
                    <Button size="small" onClick={() => { const body = window.prompt("Svar i Sound Room"); if (body?.trim()) void api.replyFeedback(comment.id, body.trim()).then(refreshFeedback).catch((error) => logLocal("error", `Svar feilet: ${error}`)); }} sx={{ color: "#3fa7d6", minWidth: 0, p: 0 }}>Svar</Button>
                  </>} />
              ))}
            </Stack>
          )}
          {feedback?.brief && (
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: "rgba(255,140,0,0.07)", border: "1px solid rgba(255,140,0,0.22)" }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: ORANGE }}>{feedback.brief.title}</Typography>
              <Typography sx={{ fontSize: 11.5, color: "text.secondary", my: 0.5 }}>{feedback.brief.summary}</Typography>
              {feedback.brief.priorities.slice(0, 5).map((priority, index) => (
                <Typography key={`${priority.title}-${index}`} sx={{ fontSize: 11.5, mt: 0.4 }}><strong>{index + 1}. {priority.title}</strong> · {priority.detail}</Typography>
              ))}
            </Box>
          )}
          {(feedback?.decisions?.length || feedback?.signoffs?.length) ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
              {feedback.decisions.map((decision) => <Chip key={decision.id} size="small" label={`${decision.status === "open" ? "Avstemning åpen" : "Avstemning lukket"} · ${decision.vote_count || 0} stemmer`} sx={{ color: decision.status === "open" ? ORANGE : "#5fb88a" }} />)}
              {feedback.signoffs.map((signoff) => <Chip key={signoff.id} size="small" label={`${signoff.member_name || "Reviewer"}: ${signoff.stage} ${signoff.status}`} sx={{ color: signoff.status === "approved" ? "#5fb88a" : "text.secondary" }} />)}
            </Stack>
          ) : null}
        </Panel>
      )}

      {/* ───────── AKTIVITET ───────── */}
      <Panel title="Aktivitet">
        {activity.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Ingen aktivitet ennå.</Typography>
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 280, overflowY: "auto" }}>
            {activity.map((a, i) => (
              <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                <Typography sx={{ fontSize: 10.5, color: "text.secondary", minWidth: 60, fontVariantNumeric: "tabular-nums" }}>{new Date(a.ts).toLocaleTimeString()}</Typography>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", mt: 0.6, flexShrink: 0, bgcolor: a.kind === "error" ? "#e0606a" : a.kind === "bounce" ? "#5fb88a" : a.kind === "marker" ? ORANGE : "#3fa7d6" }} />
                <Typography sx={{ fontSize: 12.5 }}>{a.message}</Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Panel>
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "background.paper", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 2.5, p: 2.5, mb: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</Typography>
      {children}
    </Box>
  );
}

function FilePick({ icon, label, value, hint, onPick }: { icon: React.ReactNode; label: string; value: string | null; hint: string; onPick: () => void }) {
  return (
    <Box sx={{ border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: ORANGE }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || hint}</Typography>
        </Box>
        <Button size="small" onClick={onPick} sx={{ color: ORANGE }}>Velg</Button>
      </Stack>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontSize: 11.5, color: "text.secondary", minWidth: 96 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "—"}</Typography>
    </Stack>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>{children}</Box>;
}

function FeedbackRow({ color, title, body, icon, actions }: { color: string; title: string; body: string; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.1} sx={{ p: 1.1, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.025)", alignItems: "flex-start" }}>
      <Box sx={{ color, mt: 0.1 }}>{icon || <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, mt: 0.7 }} />}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10.5, color, textTransform: "uppercase", fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{body}</Typography>
        {actions && <Stack direction="row" spacing={1.25} sx={{ mt: 0.5 }}>{actions}</Stack>}
      </Box>
    </Stack>
  );
}

function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}
