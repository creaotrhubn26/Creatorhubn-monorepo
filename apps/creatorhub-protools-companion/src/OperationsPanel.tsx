import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";
import UpdateOutlined from "@mui/icons-material/UpdateOutlined";
import ContentCopy from "@mui/icons-material/ContentCopy";
import * as api from "./api";
import type { AppState } from "./api";

const ORANGE = "#ff8c00";

export function OperationsPanel({ state, report }: {
  state: AppState;
  report: (kind: "info" | "marker" | "bounce" | "error", message: string) => void;
}) {
  const [autostart, setAutostart] = useState(false);
  const [update, setUpdate] = useState<{ available: boolean; current_version: string; version: string | null; notes: string | null } | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void api.autostartStatus().then(setAutostart).catch(() => undefined); }, []);

  const toggleAutostart = async (enabled: boolean) => {
    try { setAutostart(await api.setAutostart(enabled)); report("info", enabled ? "Companion starter nå med maskinen" : "Automatisk oppstart er slått av"); }
    catch (error) { report("error", `Oppstartsinnstilling feilet: ${error}`); }
  };

  const checkUpdate = async () => {
    setBusy(true);
    try { const result = await api.checkForUpdate(); setUpdate(result); report("info", result.available ? `Versjon ${result.version} er klar` : "Du har nyeste Companion-versjon"); }
    catch (error) { report("error", `Oppdateringssjekk feilet: ${error}`); }
    finally { setBusy(false); }
  };

  const install = async () => {
    setBusy(true);
    try { await api.installUpdate(); report("info", "Signert oppdatering er installert. Start appen på nytt."); }
    catch (error) { report("error", `Oppdatering feilet: ${error}`); }
    finally { setBusy(false); }
  };

  const loadDiagnostics = async () => {
    const result = await api.diagnostics(); setDiagnostics(result);
  };

  const copyDiagnostics = async () => {
    if (!diagnostics) return;
    try { await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)); report("info", "Diagnostikk kopiert uten tokens eller passord"); }
    catch (error) { report("error", `Kunne ikke kopiere diagnostikk: ${error}`); }
  };

  return <Stack spacing={2}>
    <Box sx={{ p: 1.6, borderRadius: 2, border: "1px solid rgba(255,255,255,.08)" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><SecurityOutlined sx={{ color: ORANGE }} /><Typography sx={{ fontWeight: 800, fontSize: 13 }}>Sikker drift</Typography></Stack>
      <Stack direction="row" spacing={.7} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
        <Chip size="small" label="Device-token i OS-nøkkelring" color="success" />
        <Chip size="small" label={state.local_ipc.listening ? `AAX IPC · localhost:${state.local_ipc.port}` : "AAX IPC utilgjengelig"} color={state.local_ipc.listening ? "success" : "error"} />
        <Chip size="small" label="Streng CSP" color="success" />
        <Chip size="small" label={state.auto_watch ? "Varig filkø aktiv" : "Filkø pauset"} />
      </Stack>
      {state.local_ipc.last_error && <Alert severity="error" sx={{ mt: 1 }}>{state.local_ipc.last_error}</Alert>}
      <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={autostart} onChange={(event) => void toggleAutostart(event.target.checked)} />}
        label={<Typography sx={{ fontSize: 12.5 }}>Start Companion ved innlogging</Typography>} />
      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Lukk-knappen skjuler appen i systemstatusfeltet. Overvåking, offline-kø og lokale Review Console-kall fortsetter.</Typography>
    </Box>

    <Box sx={{ p: 1.6, borderRadius: 2, border: "1px solid rgba(255,255,255,.08)" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><UpdateOutlined sx={{ color: ORANGE }} /><Typography sx={{ fontWeight: 800, fontSize: 13 }}>Signerte oppdateringer</Typography></Stack>
      <Typography sx={{ mt: .7, fontSize: 12, color: "text.secondary" }}>Oppdateringspakken verifiseres kryptografisk før installasjon.</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="outlined" disabled={busy} onClick={() => void checkUpdate()} sx={{ color: ORANGE, borderColor: ORANGE }}>Se etter oppdatering</Button>
        {update?.available && <Button variant="contained" disabled={busy} onClick={() => void install()} sx={{ bgcolor: ORANGE }}>Installer {update.version}</Button>}
      </Stack>
      {update && !update.available && <Alert severity="success" sx={{ mt: 1 }}>Versjon {update.current_version} er oppdatert.</Alert>}
    </Box>

    <Box sx={{ p: 1.6, borderRadius: 2, border: "1px solid rgba(255,255,255,.08)" }}>
      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Synk og diagnostikk</Typography>
      <Typography sx={{ mt: .7, fontSize: 12, color: "text.secondary" }}>
        Siste feedbacksynk: {formatEpoch(state.last_feedback_sync_at)} · siste session fingerprint: {state.last_session_fingerprint?.slice(0, 12) || "ingen"}
      </Typography>
      {state.last_feedback_sync_error && <Alert severity="warning" sx={{ mt: 1 }}>Offline-cache brukes: {state.last_feedback_sync_error}</Alert>}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="outlined" onClick={() => void loadDiagnostics()} sx={{ color: ORANGE, borderColor: ORANGE }}>Vis diagnostikk</Button>
        {diagnostics && <Button startIcon={<ContentCopy />} onClick={() => void copyDiagnostics()} sx={{ color: ORANGE }}>Kopier</Button>}
      </Stack>
      {diagnostics && <Box component="pre" sx={{ fontSize: 10.5, p: 1, mt: 1, maxHeight: 240, overflow: "auto", bgcolor: "#08111f", borderRadius: 1.5 }}>{JSON.stringify(diagnostics, null, 2)}</Box>}
    </Box>
  </Stack>;
}

function formatEpoch(value: string | null) {
  if (!value) return "aldri";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Date(numeric * 1000).toLocaleString("nb-NO") : value;
}
