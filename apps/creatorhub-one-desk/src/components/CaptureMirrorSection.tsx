import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Stop from "@mui/icons-material/Stop";
import Refresh from "@mui/icons-material/Refresh";
import CameraAlt from "@mui/icons-material/CameraAlt";
import CloudSync from "@mui/icons-material/CloudSync";
import {
  CaptureEventPayload,
  CaptureMirrorEvent,
  CaptureSessionSummary,
  CaptureSubscriberStateEvent,
  disableMirrorForSession,
  DitDestination,
  enableMirrorForSession,
  enabledMirrorSessions,
  listActiveCaptureSubscriptions,
  listCaptureSessions,
  startCaptureSubscription,
  stopCaptureSubscription,
} from "../api";

interface LogLine {
  ts: number;
  text: string;
}

const MAX_LOG_LINES = 50;

interface Props {
  plannedDestinations: DitDestination[];
}

export default function CaptureMirrorSection({ plannedDestinations }: Props) {
  const [sessions, setSessions] = useState<CaptureSessionSummary[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [mirrorEnabled, setMirrorEnabled] = useState<Set<string>>(new Set());
  const [subState, setSubState] = useState<Record<string, string>>({});
  const [mirroredCounts, setMirroredCounts] = useState<Record<string, number>>({});
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, a, m] = await Promise.all([
        listCaptureSessions(),
        listActiveCaptureSubscriptions(),
        enabledMirrorSessions(),
      ]);
      setSessions(s);
      setActive(new Set(a));
      setMirrorEnabled(new Set(m));
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const unlisteners: UnlistenFn[] = [];
    listen<CaptureSubscriberStateEvent>("capture-subscriber-state", (e) => {
      setSubState((prev) => ({ ...prev, [e.payload.session_id]: e.payload.state }));
      setLog((prev) =>
        [
          { ts: Date.now(), text: `[${e.payload.session_id.slice(0, 8)}] state: ${e.payload.state}${e.payload.message ? ` (${e.payload.message})` : ""}` },
          ...prev,
        ].slice(0, MAX_LOG_LINES),
      );
      if (e.payload.state === "stopped") {
        setActive((prev) => {
          const next = new Set(prev);
          next.delete(e.payload.session_id);
          return next;
        });
      }
    }).then((un) => unlisteners.push(un));

    listen<CaptureEventPayload>("capture-event", (e) => {
      const raw = e.payload.raw as Record<string, unknown> | null;
      const eventType = raw && typeof raw === "object" ? String(raw.type ?? "unknown") : "unknown";
      setLog((prev) =>
        [
          { ts: Date.now(), text: `[${e.payload.session_id.slice(0, 8)}] ${eventType}` },
          ...prev,
        ].slice(0, MAX_LOG_LINES),
      );
    }).then((un) => unlisteners.push(un));

    listen<CaptureMirrorEvent>("capture-mirror-event", (e) => {
      const label = e.payload.filename || e.payload.asset_id.slice(0, 8);
      setLog((prev) =>
        [
          {
            ts: Date.now(),
            text: `[mirror ${e.payload.session_id.slice(0, 8)}] ${e.payload.state} ${label}${
              e.payload.error ? ` — ${e.payload.error}` : ""
            }`,
          },
          ...prev,
        ].slice(0, MAX_LOG_LINES),
      );
      if (e.payload.state === "done") {
        setMirroredCounts((prev) => ({
          ...prev,
          [e.payload.session_id]: (prev[e.payload.session_id] ?? 0) + 1,
        }));
      }
    }).then((un) => unlisteners.push(un));

    return () => {
      for (const un of unlisteners) un();
    };
  }, []);

  const handleStart = async (sessionId: string) => {
    try {
      await startCaptureSubscription(sessionId);
      setActive((prev) => new Set(prev).add(sessionId));
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  const handleStop = async (sessionId: string) => {
    try {
      await stopCaptureSubscription(sessionId);
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  const mirrorReady = plannedDestinations.filter(
    (d) => d.path && d.destination_type !== "original",
  );

  const handleToggleMirror = async (sessionId: string, on: boolean) => {
    try {
      if (on) {
        await enableMirrorForSession({
          sessionId,
          destinations: mirrorReady.map((d) => ({
            id: d.id,
            label: d.label,
            path: d.path!,
          })),
        });
        setMirrorEnabled((prev) => new Set(prev).add(sessionId));
      } else {
        await disableMirrorForSession(sessionId);
        setMirrorEnabled((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            <CameraAlt sx={{ verticalAlign: "middle", mr: 1, fontSize: 20 }} />
            Live Capture Mirror ({sessions.length} sessions · {active.size} aktive)
          </Typography>
          <IconButton size="small" onClick={refresh} disabled={loading}>
            <Refresh fontSize="small" />
          </IconButton>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Token-expired-banner: vises hvis NOEN session ble droppet pga
            ugyldig helper-token. Reconnect-loopen stopper for å unngå spam
            — Fredrik må generere ny token i Admin Room. */}
        {Object.values(subState).some((s) => s === "auth_expired") && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            <strong>Helper-token er avvist av backend.</strong> Live-mirror
            stoppet for å unngå spam. Generér ny token i CreatorHub Admin
            Room → DIT Helper Tokens, og lim inn i One Desk for å fortsette.
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Subscriber til iPad-sessionens WebSocket-strøm. Når mirror er PÅ,
          lastes hver nye asset ned via signed R2-URL og kopieres til{" "}
          {mirrorReady.length} backend-tracked destinasjon
          {mirrorReady.length === 1 ? "" : "er"} med xxHash64-verify.
        </Typography>

        {sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            Ingen capture sessions funnet for dette prosjektet.
          </Typography>
        ) : (
          <List dense>
            {sessions.map((s) => {
              const isActive = active.has(s.id);
              const isMirrorOn = mirrorEnabled.has(s.id);
              const state = subState[s.id];
              const mirrored = mirroredCounts[s.id] ?? 0;
              return (
                <ListItem
                  key={s.id}
                  sx={{ flexDirection: "column", alignItems: "flex-start" }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", width: "100%", mb: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
                      {s.name || s.id.slice(0, 8)}
                    </Typography>
                    {s.is_active && <Chip size="small" color="success" label="aktiv" />}
                    {state && (
                      <Chip
                        size="small"
                        label={state === "auth_expired" ? "token utløpt" : state}
                        color={
                          state === "connected"
                            ? "success"
                            : state === "error"
                            ? "error"
                            : state === "auth_expired"
                            ? "warning"
                            : "default"
                        }
                      />
                    )}
                    {mirrored > 0 && (
                      <Chip
                        size="small"
                        icon={<CloudSync sx={{ fontSize: 14 }} />}
                        label={`${mirrored} mirrored`}
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {isActive ? (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<Stop />}
                        onClick={() => handleStop(s.id)}
                      >
                        Stopp
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PlayArrow />}
                        onClick={() => handleStart(s.id)}
                      >
                        Lytt
                      </Button>
                    )}
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", width: "100%", pl: 0.5 }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                      {s.starts_at
                        ? `Startet ${new Date(s.starts_at).toLocaleString("nb-NO")}`
                        : "Ikke startet"}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={isMirrorOn}
                          onChange={(e) => handleToggleMirror(s.id, e.target.checked)}
                          disabled={mirrorReady.length === 0}
                        />
                      }
                      label={
                        <Typography variant="caption">
                          Mirror til {mirrorReady.length} dest
                        </Typography>
                      }
                    />
                  </Stack>
                </ListItem>
              );
            })}
          </List>
        )}

        {log.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Event-log (siste {log.length}):
            </Typography>
            <Box
              sx={{
                maxHeight: 200,
                overflowY: "auto",
                p: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                fontFamily: "monospace",
                fontSize: 11,
                background: "rgba(0,0,0,0.02)",
              }}
            >
              {log.map((l, i) => (
                <div key={i}>
                  <span style={{ color: "#888" }}>
                    {new Date(l.ts).toLocaleTimeString("nb-NO")}
                  </span>{" "}
                  {l.text}
                </div>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
