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
import { GoProAdapter, requestGoProDevice, isWebBluetoothAvailable as isWebBluetoothAvailableForGoPro } from "./cameras/gopro-adapter";
import { discoverBridgedCameras, getIpadBridge } from "./cameras/ipad-bridge-adapter";
import type { CameraAdapter, CameraVendor } from "./cameras/types";
import { useT } from '../../../i18n';

interface CameraPairingDialogProps {
  open: boolean;
  onClose: () => void;
  onPaired: (adapter: CameraAdapter) => void;
}

const VENDOR_LABELS: Record<Exclude<CameraVendor, "mock" | "red" | "dji">, string> = {
  canon: "Canon",
  blackmagic: "Blackmagic",
  sony: "Sony",
  arri: "ARRI",
  zcam: "Z CAM",
  gopro: "GoPro",
};

// Spesial-tab for iPad-bridge (ikke en CameraVendor — meta-pattern)
type TabKey = keyof typeof VENDOR_LABELS | "ipad-bridge";

const ALL_TAB_LABELS: Record<TabKey, string> = {
  ...VENDOR_LABELS,
  "ipad-bridge": "iPad-bridge",
};

// SupportedVendor brukes ikke direkte etter at vi byttet til TabKey, men
// holdes som type-alias for konsistens i kommende kode.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _SupportedVendor = keyof typeof VENDOR_LABELS;

// ─────────────────────────────────────────────────────────────────────
// Canon-form: IP + scan
// ─────────────────────────────────────────────────────────────────────

function CanonForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t('camPair.scanFailed'));
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
      setError(err instanceof Error ? err.message : t('camPair.connectFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.canonIntro')}
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          label={t('camPair.ipAddressLabel')}
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
          {t('camPair.connectButton')}
        </Button>
      </Stack>

      <Button
        variant="outlined"
        size="small"
        startIcon={scanning ? <CircularProgress size={14} /> : <SearchIcon />}
        onClick={handleScan}
        disabled={scanning}
      >
        {scanning ? t('camPair.scanningButton') : t('camPair.scanButton')}
      </Button>

      {scanResults.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {t('camPair.foundOnNetwork')}
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
                {t('camPair.connectButton')}
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
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t('camPair.connectFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.sonyIntro')}
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label={t('camPair.ipAddressLabel')}
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="192.168.122.1"
        />
        <TextField
          size="small"
          label={t('camPair.portLabel')}
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
        {t('camPair.connectSonyButton')}
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ARRI-form
// ─────────────────────────────────────────────────────────────────────

function ArriForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t('camPair.connectFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.arriIntro')}
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label={t('camPair.ipAddressLabel')}
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="192.168.0.10"
        />
        <TextField
          size="small"
          label={t('camPair.portLabel')}
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
        {t('camPair.connectArriButton')}
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Z CAM-form
// ─────────────────────────────────────────────────────────────────────

function ZcamForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t('camPair.connectFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.zcamIntro')}
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label={t('camPair.ipAddressLabel')}
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="10.98.32.1"
        />
        <TextField
          size="small"
          label={t('camPair.portLabel')}
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
        {t('camPair.connectZcamButton')}
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Blackmagic-form: Web Bluetooth
// ─────────────────────────────────────────────────────────────────────

function BlackmagicForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t('camPair.blePairingCancelled'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.blackmagicIntro')}
      </Typography>

      {!available && (
        <Alert severity="warning">
          {t('camPair.webBluetoothUnavailableBlackmagic')}
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
        {busy ? t('camPair.searchingButton') : t('camPair.searchBlackmagicButton')}
      </Button>

      <Typography variant="caption" color="text.secondary">
        {t('camPair.blackmagicHint')}
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GoPro-form: Web Bluetooth (Open GoPro)
// ─────────────────────────────────────────────────────────────────────

function GoProForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const { t } = useT();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const available = isWebBluetoothAvailableForGoPro();

  const handlePair = async () => {
    setBusy(true);
    setError(null);
    try {
      const device = await requestGoProDevice();
      const adapter = new GoProAdapter(device);
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('camPair.blePairingCancelled'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.goproIntro')}
      </Typography>

      {!available && (
        <Alert severity="warning">
          {t('camPair.webBluetoothUnavailableGopro')}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={busy ? <CircularProgress size={14} /> : <BluetoothIcon />}
        onClick={handlePair}
        disabled={busy || !available}
        sx={{
          bgcolor: "#212121",
          color: "#fff",
          "&:hover": { bgcolor: "#424242" },
        }}
      >
        {busy ? t('camPair.searchingButton') : t('camPair.searchGoproButton')}
      </Button>

      <Typography variant="caption" color="text.secondary">
        {t('camPair.goproHint')}
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// iPad-bridge-form: koble til iPad CaptureApp som agerer som proxy for
// native-SDK-vendors (RED, DJI, Panasonic, etc.)
// ─────────────────────────────────────────────────────────────────────

function IpadBridgeForm({ onPaired }: { onPaired: (adapter: CameraAdapter) => void }) {
  const { t } = useT();
  const [wsUrl, setWsUrl] = React.useState("ws://192.168.1.100:8765/bridge");
  const [authToken, setAuthToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bridgedCameras, setBridgedCameras] = React.useState<
    Array<{ adapter: CameraAdapter; label: string; vendor: string }>
  >([]);

  const handleDiscover = async () => {
    setBusy(true);
    setError(null);
    setBridgedCameras([]);
    try {
      const bridge = getIpadBridge(wsUrl, authToken || undefined);
      const adapters = await discoverBridgedCameras(bridge);
      setBridgedCameras(
        adapters.map((a) => ({ adapter: a, label: a.label, vendor: a.vendor })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('camPair.bridgeUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const handleConnectBridged = async (adapter: CameraAdapter) => {
    setBusy(true);
    setError(null);
    try {
      await adapter.connect();
      onPaired(adapter);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('camPair.connectViaBridgeFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('camPair.ipadBridgeIntro')}
      </Typography>

      <TextField
        fullWidth
        size="small"
        label={t('camPair.wsUrlLabel')}
        value={wsUrl}
        onChange={(e) => setWsUrl(e.target.value)}
        placeholder="ws://192.168.1.100:8765/bridge"
      />
      <TextField
        fullWidth
        size="small"
        label={t('camPair.authTokenLabel')}
        value={authToken}
        onChange={(e) => setAuthToken(e.target.value)}
        type="password"
      />

      <Button
        variant="outlined"
        startIcon={busy ? <CircularProgress size={14} /> : <SearchIcon />}
        onClick={handleDiscover}
        disabled={busy || !wsUrl}
      >
        {t('camPair.searchBridgedButton')}
      </Button>

      {bridgedCameras.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {t('camPair.availableViaBridge')}
          </Typography>
          {bridgedCameras.map((cam) => (
            <Stack
              key={cam.adapter.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ p: 1, bgcolor: "rgba(255,255,255,0.04)", borderRadius: 1 }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">{cam.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {cam.vendor.toUpperCase()} · via iPad
                </Typography>
              </Box>
              <Button size="small" onClick={() => handleConnectBridged(cam.adapter)} disabled={busy}>
                {t('camPair.connectButton')}
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
        {t('camPair.ipadBridgeHint')}
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────

export const CameraPairingDialog: React.FC<CameraPairingDialogProps> = ({ open, onClose, onPaired }) => {
  const { t } = useT();
  const [tab, setTab] = React.useState<TabKey>("canon");

  const handlePaired = (adapter: CameraAdapter) => {
    onPaired(adapter);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{t('camPair.dialogTitle')}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", mb: 2 }}
        >
          {(Object.keys(ALL_TAB_LABELS) as TabKey[]).map((v) => (
            <Tab key={v} value={v} label={ALL_TAB_LABELS[v]} />
          ))}
        </Tabs>

        {tab === "canon" && <CanonForm onPaired={handlePaired} />}
        {tab === "sony" && <SonyForm onPaired={handlePaired} />}
        {tab === "arri" && <ArriForm onPaired={handlePaired} />}
        {tab === "zcam" && <ZcamForm onPaired={handlePaired} />}
        {tab === "blackmagic" && <BlackmagicForm onPaired={handlePaired} />}
        {tab === "gopro" && <GoProForm onPaired={handlePaired} />}
        {tab === "ipad-bridge" && <IpadBridgeForm onPaired={handlePaired} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('camPair.closeButton')}</Button>
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
