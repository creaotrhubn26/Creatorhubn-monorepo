import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Stop from "@mui/icons-material/Stop";
import Refresh from "@mui/icons-material/Refresh";
import CameraAlt from "@mui/icons-material/CameraAlt";
import {
  CaptureEventPayload,
  CaptureSessionSummary,
  CaptureSubscriberStateEvent,
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

export default function CaptureMirrorSection() {
  const [sessions, setSessions] = useState<CaptureSessionSummary[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [subState, setSubState] = useState<Record<string, string>>({});
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, a] = await Promise.all([
        listCaptureSessions(),
        listActiveCaptureSubscriptions(),
      ]);
      setSessions(s);
      setActive(new Set(a));
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

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Subscriber til iPad-sessionens WebSocket-strøm. F6a viser bare
          live-events; F6b kopierer assets til lokal RAID når de uploades.
        </Typography>

        {sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            Ingen capture sessions funnet for dette prosjektet.
          </Typography>
        ) : (
          <List dense>
            {sessions.map((s) => {
              const isActive = active.has(s.id);
              const state = subState[s.id];
              return (
                <ListItem
                  key={s.id}
                  secondaryAction={
                    isActive ? (
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
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {s.name || s.id.slice(0, 8)}
                        </Typography>
                        {s.is_active && <Chip size="small" color="success" label="aktiv" />}
                        {state && (
                          <Chip
                            size="small"
                            label={state}
                            color={
                              state === "connected"
                                ? "success"
                                : state === "error"
                                ? "error"
                                : "default"
                            }
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      s.starts_at
                        ? `Startet ${new Date(s.starts_at).toLocaleString("nb-NO")}`
                        : "Ikke startet"
                    }
                  />
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
