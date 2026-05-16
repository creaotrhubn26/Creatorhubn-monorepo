/**
 * CameraPairingDialog.tsx
 *
 * Multi-vendor pairing-dialog. Brukeren velger vendor og fyller ut
 * vendor-spesifikk paring-info. Dialog kaller riktig adapter-factory og
 * returnerer ferdig CameraAdapter til caller.
 *
 * Vendor-flows:
 *   Canon  — IP-entry + valgfri subnet-scan
 *   Sony   — IP-entry (port 8080 default)
 *   ARRI   — IP-entry (port 80 default)
 *   Blackmagic — Web Bluetooth user-gesture (åpner browser-native dialog)
 */

import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import LinkIcon from "@mui/icons-material/Link";
import {
  BlackmagicCameraAdapter,
  isWebBluetoothAvailable,
  requestBlackmagicCameraDevice,
} from "./cameras/blackmagic-adapter";
import { CanonCcapiAdapter } from "./cameras/canon-adapter";
import { SonyWifiAdapter } from "./cameras/sony-adapter";
import { ArriWebAdapter } from "./cameras/arri-adapter";
import { ZcamAdapter } from "./cameras/zcam-adapter";
import type { CameraAdapter, CameraVendor } from "./cameras/types";

interface CameraPairingDialogProps {
  open: boolean;
  onClose: () => void;
  onPaired: (adapter: CameraAdapter) => void;
}

const VENDOR_LABELS: Record<Exclude<CameraVendor, "mock" | "red" | "gopro" | "dji">, string> = {
  canon: "Canon",
  blackmagic: "Blackmagic",
  sony: "Sony",
  arri: "ARRI",
  zcam: "Z CAM",
};

type SupportedVendor = keyof typeof VENDOR_LABELS;

// ─────────────────────────────────────────────────────────────────────
// Canon-form: IP + scan
// ─────────────────────────────────────────────────────────────────────

function CanonForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const [ipAddress, setIpAddress] = React.useState("192.168.1.2");
  const [busy, setBusy] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [scanResults, setScanResults] = React.useState<Array<{ ipAddress: string; model?: string }>>([]);
  const [error, setError] = React.useState<string | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setScanResults([]);
    try {
      const response = await fetch("/api/ccapi/discover?scan=true&scanDuration=2000", {
        headers: { "x-role-room-user-id": getUserIdHeader() },
      });
      const body = await response.json();
      if (Array.isArray(body.cameras)) {
        setScanResults(body.cameras.map((c: { ipAddress: string; modelName: string }) => ({
          ipAddress: c.ipAddress,
          model: c.modelName,
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skann feilet");
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (ip: string) => {
    setBusy(true);
    setError(null);
    try {
      const adapter = new CanonCcapiAdapter(ip);
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect feilet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Canon-kameraer i AP-modus annonserer typisk på 192.168.1.2 (default).
        Hvis kameraet er på et regulært nettverk, oppgi IP-adressen manuelt
        eller kjør subnet-skann.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          label="IP-adresse"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="192.168.1.2"
        />
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={14} /> : <LinkIcon />}
          onClick={() => handleConnect(ipAddress)}
          disabled={busy || !ipAddress}
        >
          Koble til
        </Button>
      </Stack>

      <Button
        variant="outlined"
        size="small"
        startIcon={scanning ? <CircularProgress size={14} /> : <SearchIcon />}
        onClick={handleScan}
        disabled={scanning}
      >
        {scanning ? "Skanner subnet..." : "Skann etter kameraer"}
      </Button>

      {scanResults.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Funnet på nettverket:
          </Typography>
          {scanResults.map((cam) => (
            <Stack
              key={cam.ipAddress}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ p: 1, bgcolor: "rgba(255,255,255,0.04)", borderRadius: 1 }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">{cam.model ?? "Canon Camera"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {cam.ipAddress}
                </Typography>
              </Box>
              <Button size="small" onClick={() => handleConnect(cam.ipAddress)} disabled={busy}>
                Koble til
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sony-form
// ─────────────────────────────────────────────────────────────────────

function SonyForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const [ipAddress, setIpAddress] = React.useState("");
  const [port, setPort] = React.useState("8080");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const adapter = new SonyWifiAdapter(ipAddress, parseInt(port, 10) || 8080);
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect feilet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Sony FX9/FX6/FX3/alpha-serie støtter Camera Remote API på port 8080
        (default). Venice + andre pro-kameraer kan kreve egen Content
        Browser Mobile-protokoll og er ikke fullt støttet ennå.
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label="IP-adresse"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="192.168.122.1"
        />
        <TextField
          size="small"
          label="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          sx={{ width: 100 }}
        />
      </Stack>

      <Button
        variant="contained"
        startIcon={busy ? <CircularProgress size={14} /> : <LinkIcon />}
        onClick={handleConnect}
        disabled={busy || !ipAddress}
      >
        Koble til Sony
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ARRI-form
// ─────────────────────────────────────────────────────────────────────

function ArriForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const [ipAddress, setIpAddress] = React.useState("");
  const [port, setPort] = React.useState("80");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const adapter = new ArriWebAdapter(ipAddress, parseInt(port, 10) || 80);
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect feilet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        ARRI Web Remote støttes på Alexa Mini LF og Alexa 35 (firmware 7.x+).
        Web Remote må være aktivert i kameraets meny først (System → API).
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label="IP-adresse"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="192.168.0.10"
        />
        <TextField
          size="small"
          label="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          sx={{ width: 100 }}
        />
      </Stack>

      <Button
        variant="contained"
        startIcon={busy ? <CircularProgress size={14} /> : <LinkIcon />}
        onClick={handleConnect}
        disabled={busy || !ipAddress}
      >
        Koble til ARRI
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Z CAM-form
// ─────────────────────────────────────────────────────────────────────

function ZcamForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const [ipAddress, setIpAddress] = React.useState("");
  const [port, setPort] = React.useState("80");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const adapter = new ZcamAdapter(ipAddress, parseInt(port, 10) || 80);
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect feilet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Z CAM-modeller (E2, E2-M4, F8, F6, ZF) eksponerer et åpent HTTP-API på
        port 80. Kameraet må være i Wi-Fi STA- eller AP-modus. Sjekk
        kamerameny → Network for IP-adresse.
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label="IP-adresse"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="10.98.32.1"
        />
        <TextField
          size="small"
          label="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          sx={{ width: 100 }}
        />
      </Stack>

      <Button
        variant="contained"
        startIcon={busy ? <CircularProgress size={14} /> : <LinkIcon />}
        onClick={handleConnect}
        disabled={busy || !ipAddress}
      >
        Koble til Z CAM
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Blackmagic-form: Web Bluetooth
// ─────────────────────────────────────────────────────────────────────

function BlackmagicForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const available = isWebBluetoothAvailable();

  const handlePair = async () => {
    setBusy(true);
    setError(null);
    try {
      const device = await requestBlackmagicCameraDevice();
      const adapter = new BlackmagicCameraAdapter(device);
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Web Bluetooth pairing avbrutt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Blackmagic-kameraer (URSA Mini, Pocket Cinema, URSA Broadcast) styres
        via Bluetooth LE direkte fra nettleseren. Krever Chromium-browser
        (Chrome, Edge, Opera) og HTTPS — fungerer ikke i Safari eller på iOS.
      </Typography>

      {!available && (
        <Alert severity="warning">
          Web Bluetooth API er ikke tilgjengelig i denne nettleseren. Bruk
          Chrome/Edge på desktop, eller åpne LIVE SET PRO i iPad CaptureApp
          som har native Bluetooth-støtte.
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={busy ? <CircularProgress size={14} /> : <BluetoothIcon />}
        onClick={handlePair}
        disabled={busy || !available}
        sx={{
          bgcolor: "#0288d1",
          "&:hover": { bgcolor: "#0277bd" },
        }}
      >
        {busy ? "Søker..." : "Søk etter Blackmagic-kameraer"}
      </Button>

      <Typography variant="caption" color="text.secondary">
        Browser åpner sin egen paring-dialog. Plassér kameraet i nærheten
        og slå på Bluetooth i kameraets meny.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────

export const CameraPairingDialog: React.FC<CameraPairingDialogProps> = ({ open, onClose, onPaired }) => {
  const [vendor, setVendor] = React.useState<SupportedVendor>("canon");

  const handlePaired = (adapter: CameraAdapter) => {
    onPaired(adapter);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Koble til kamera</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Tabs
          value={vendor}
          onChange={(_, v) => setVendor(v)}
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", mb: 2 }}
        >
          {(Object.keys(VENDOR_LABELS) as SupportedVendor[]).map((v) => (
            <Tab key={v} value={v} label={VENDOR_LABELS[v]} />
          ))}
        </Tabs>

        {vendor === "canon" && <CanonForm onPaired={handlePaired} />}
        {vendor === "sony" && <SonyForm onPaired={handlePaired} />}
        {vendor === "arri" && <ArriForm onPaired={handlePaired} />}
        {vendor === "zcam" && <ZcamForm onPaired={handlePaired} />}
        {vendor === "blackmagic" && <BlackmagicForm onPaired={handlePaired} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

function getUserIdHeader(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("role-room-user-id");
    if (stored) return stored;
  }
  return "dev-user";
}

export default CameraPairingDialog;
