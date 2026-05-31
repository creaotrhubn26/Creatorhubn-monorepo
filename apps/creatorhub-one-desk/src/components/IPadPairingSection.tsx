import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import LinkOff from "@mui/icons-material/LinkOff";
import Tablet from "@mui/icons-material/Tablet";
import {
  cancelPairingPin,
  confirmPairIpad,
  currentPairingPin,
  DiscoveredIpad,
  generatePairingPin,
  listDiscoveredIpads,
  listPairedIpads,
  PairedIpad,
  PairResultEvent,
  PendingPin,
  unpairIpad,
} from "../api";

export default function IPadPairingSection() {
  const [discovered, setDiscovered] = useState<DiscoveredIpad[]>([]);
  const [paired, setPaired] = useState<PairedIpad[]>([]);
  const [pin, setPin] = useState<PendingPin | null>(null);
  const [pinDialogTarget, setPinDialogTarget] = useState<DiscoveredIpad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairProgress, setPairProgress] = useState<"idle" | "waiting" | "failed">("idle");
  const [pairError, setPairError] = useState<string | null>(null);

  const refreshAll = async () => {
    try {
      const [d, p, pn] = await Promise.all([
        listDiscoveredIpads(),
        listPairedIpads(),
        currentPairingPin(),
      ]);
      setDiscovered(d);
      setPaired(p);
      setPin(pn);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  useEffect(() => {
    void refreshAll();
    const unlisteners: UnlistenFn[] = [];
    void listen<DiscoveredIpad[]>("ipads-discovered", (e) => setDiscovered(e.payload)).then(
      (un) => unlisteners.push(un),
    );
    // F5c auto-pair: når iPad svarer OK eller ERR, Rust-side emit'er
    // 'pair-result'. Frontend lukker dialogen + refresher paired-listen
    // ved success, viser feil-melding ved fail (manuell fallback fortsatt
    // tilgjengelig).
    void listen<PairResultEvent>("pair-result", (e) => {
      if (e.payload.success) {
        setPairProgress("idle");
        setPinDialogTarget(null);
        setPin(null);
        setPairError(null);
        void listPairedIpads().then(setPaired);
      } else {
        setPairProgress("failed");
        setPairError(e.payload.error ?? "Ukjent feil");
      }
    }).then((un) => unlisteners.push(un));
    const tick = window.setInterval(() => {
      void currentPairingPin().then(setPin);
    }, 1500);
    return () => {
      for (const un of unlisteners) un();
      window.clearInterval(tick);
    };
  }, []);

  const handleStartPair = async (ipad: DiscoveredIpad) => {
    setError(null);
    setPairError(null);
    setPairProgress("waiting");
    setPinDialogTarget(ipad);
    try {
      const newPin = await generatePairingPin({
        fullname: ipad.fullname,
        deviceName: ipad.device_name,
      });
      setPin(newPin);
    } catch (e) {
      setPairProgress("failed");
      setPairError(typeof e === "string" ? e : String(e));
    }
  };

  const handleCancelPin = async () => {
    await cancelPairingPin();
    setPin(null);
    setPinDialogTarget(null);
    setPairProgress("idle");
    setPairError(null);
  };

  const handleConfirmPair = async (ipad: DiscoveredIpad) => {
    if (!ipad.device_id) {
      setError("iPad mangler device_id i Bonjour-TXT — kan ikke pares før CaptureApp er oppdatert");
      return;
    }
    try {
      const list = await confirmPairIpad({
        deviceId: ipad.device_id,
        deviceName: ipad.device_name,
      });
      setPaired(list);
      await cancelPairingPin();
      setPin(null);
      setPinDialogTarget(null);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  const handleUnpair = async (deviceId: string) => {
    try {
      const list = await unpairIpad(deviceId);
      setPaired(list);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  const isPaired = (deviceId: string | null) =>
    deviceId !== null && paired.some((p) => p.device_id === deviceId);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            <Tablet sx={{ verticalAlign: "middle", mr: 1, fontSize: 20 }} />
            iPad-paring ({discovered.length} oppdaget · {paired.length} paret)
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Oppdagede iPad-er (CaptureApp på samme LAN):
          </Typography>
          {discovered.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              Ingen iPad-er funnet. Start CaptureApp på en iPad på samme nettverk.
            </Typography>
          ) : (
            <List dense>
              {discovered.map((d) => {
                const paired = isPaired(d.device_id);
                return (
                  <ListItem
                    key={d.fullname}
                    secondaryAction={
                      paired ? (
                        <Chip size="small" color="success" label="Paret" />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<LinkIcon />}
                          onClick={() => handleStartPair(d)}
                        >
                          Par
                        </Button>
                      )
                    }
                  >
                    <ListItemText
                      primary={d.device_name}
                      secondary={
                        <>
                          {d.addresses[0] || "?"}:{d.port}
                          {d.app_version ? ` · CaptureApp ${d.app_version}` : ""}
                          {!d.device_id ? " · ⚠ mangler device_id" : ""}
                        </>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>

        {paired.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Parede iPad-er:
            </Typography>
            <List dense>
              {paired.map((p) => (
                <ListItem
                  key={p.device_id}
                  secondaryAction={
                    <Button
                      size="small"
                      color="error"
                      startIcon={<LinkOff />}
                      onClick={() => handleUnpair(p.device_id)}
                    >
                      Koble fra
                    </Button>
                  }
                >
                  <ListItemText
                    primary={p.device_name}
                    secondary={`Paret ${new Date(p.paired_at_iso).toLocaleString("nb-NO")}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Dialog open={pinDialogTarget !== null && pin !== null} maxWidth="xs" fullWidth>
          <DialogTitle>Par med {pinDialogTarget?.device_name}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Sjekk at PIN-en under matcher det iPad-en viser, og trykk "Godta paring" der.
              </Typography>
              <Typography
                variant="h2"
                sx={{ fontFamily: "monospace", letterSpacing: 8, fontWeight: 700 }}
              >
                {pin?.pin}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Utløper {pin ? new Date(pin.expires_at_unix_ms).toLocaleTimeString("nb-NO") : ""}
              </Typography>
              {pairProgress === "waiting" && (
                <Alert severity="info" sx={{ mt: 1, width: "100%" }}>
                  Venter på bekreftelse på iPad…
                </Alert>
              )}
              {pairProgress === "failed" && pairError && (
                <Alert severity="warning" sx={{ mt: 1, width: "100%" }}>
                  Auto-paring feilet ({pairError}). Du kan bruke "Bekreft manuelt"
                  nedenfor hvis iPad-en likevel viser PIN-prompten.
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelPin}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={() => pinDialogTarget && handleConfirmPair(pinDialogTarget)}
              disabled={!pinDialogTarget?.device_id}
            >
              Bekreft manuelt
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
