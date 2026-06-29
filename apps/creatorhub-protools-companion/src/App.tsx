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
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import * as api from "./api";
import type { AppState, TrackInfo, ActivityEntry } from "./api";

const ORANGE = "#ff8c00";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  // Pairing
  const [code, setCode] = useState("");
  const [apiBase, setApiBase] = useState("");

  // Session setup
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [trackId, setTrackId] = useState("");
  const [name, setName] = useState("");
  const [infoPath, setInfoPath] = useState<string | null>(null);
  const [bounceDir, setBounceDir] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getState();
      setState(s);
      setApiBase((prev) => prev || s.api_base);
      if (s.session_info_path) setInfoPath(s.session_info_path);
      if (s.bounce_dir) setBounceDir(s.bounce_dir);
      if (s.paired && !s.session_id) {
        try { setTracks(await api.listTracks()); } catch { /* */ }
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const un = listen<{ kind: ActivityEntry["kind"]; message: string }>("companion://activity", (e) => {
      const entry: ActivityEntry = { ts: new Date().toISOString(), kind: e.payload.kind, message: e.payload.message };
      setActivity((a) => [entry, ...a].slice(0, 200));
      // Aktivitet kan endre sesjons-status (ny bounce / markører) → refresh lett
      if (e.payload.kind === "bounce") refresh();
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
      logLocal("marker", `Synket ${r.markers_stored} markører → ${r.sections_synced} seksjoner`);
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
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
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
              inputProps={{ inputMode: "numeric", style: { letterSpacing: 6, fontSize: 22, fontWeight: 700 } }} fullWidth />
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
            <TextField label="Sesjonsnavn" value={name} onChange={(e) => setName(e.target.value)} fullWidth placeholder="f.eks. Running Home — Mix" />
            <TextField select label="Koble til EaseVerse-låt (Sound Room)" value={trackId} onChange={(e) => setTrackId(e.target.value)} fullWidth
              helperText="Markører og bounces havner i denne låtens Sound Room.">
              <MenuItem value="">— ikke koble —</MenuItem>
              {tracks.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.title}{t.artist ? ` · ${t.artist}` : ""}{t.review_id ? " ✓ Sound Room" : ""}</MenuItem>
              ))}
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={state.audio_room_id ? "Koblet til Sound Room" : "Ikke koblet til låt"} sx={{ bgcolor: state.audio_room_id ? "rgba(95,184,138,0.16)" : "rgba(255,255,255,0.06)", color: state.audio_room_id ? "#5fb88a" : "text.secondary" }} />
              <Chip size="small" label={state.watching ? "Overvåker" : "Pauset"} sx={{ bgcolor: state.watching ? "rgba(255,140,0,0.16)" : "rgba(255,255,255,0.06)", color: state.watching ? ORANGE : "text.secondary" }} />
            </Stack>
            <Row label="Session Info" value={state.session_info_path} />
            <Row label="Bounced Files" value={state.bounce_dir} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={state.watching ? <Stop /> : <PlayArrow />} onClick={toggleWatch} disabled={busy}
                sx={{ bgcolor: state.watching ? "#e0606a" : ORANGE, fontWeight: 700, "&:hover": { bgcolor: state.watching ? "#c84f58" : "#e07e00" } }}>
                {state.watching ? "Stopp overvåking" : "Start overvåking"}</Button>
              <Button variant="outlined" startIcon={<Sync />} onClick={syncNow} disabled={busy || !state.session_info_path}
                sx={{ color: ORANGE, borderColor: "rgba(255,140,0,0.5)" }}>Synk nå</Button>
            </Stack>
          </Stack>
        </Panel>
      )}

      {/* ───────── AKTIVITET ───────── */}
      <Panel title="Aktivitet">
        {activity.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Ingen aktivitet ennå.</Typography>
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 280, overflowY: "auto" }}>
            {activity.map((a, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="baseline">
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
      <Stack direction="row" alignItems="center" spacing={1.25}>
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
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography sx={{ fontSize: 11.5, color: "text.secondary", minWidth: 96 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "—"}</Typography>
    </Stack>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>{children}</Box>;
}
