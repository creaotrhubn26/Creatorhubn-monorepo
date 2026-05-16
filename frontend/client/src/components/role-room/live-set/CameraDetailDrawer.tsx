/**
 * CameraDetailDrawer.tsx
 *
 * Right-side drawer som viser alle paired-kameraer med expandable detail-
 * cards. Hver card eksponerer:
 *   - Header: vendor-label, online-status, recording-indicator
 *   - Stats: battery, storage, temperature, firmware
 *   - Current settings (FPS, shutter, ISO, WB, iris)
 *   - Vendor-extra: vendor-spesifikk debug-info
 *   - Actions: Trigger shutter (Canon), Start/Stop record, Disconnect
 */

import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import StopIcon from "@mui/icons-material/Stop";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import SdStorageIcon from "@mui/icons-material/SdStorage";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import RouterIcon from "@mui/icons-material/Router";
import type { ConnectedCamera } from "./cameras/useMultiVendorCameras";
import type { CameraVendor } from "./cameras/types";

interface CameraDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  cameras: ConnectedCamera[];
  onRemove: (cameraId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

// Vendor-spesifikk farge for branding
const VENDOR_COLORS: Record<CameraVendor, string> = {
  canon: "#cc0000",
  blackmagic: "#0288d1",
  sony: "#000000",
  arri: "#f5a623",
  zcam: "#9c27b0",
  gopro: "#212121",
  red: "#dc2626",
  dji: "#37474f",
  mock: "#666",
};

const VENDOR_NAMES: Record<CameraVendor, string> = {
  canon: "Canon",
  blackmagic: "Blackmagic",
  sony: "Sony",
  arri: "ARRI",
  zcam: "Z CAM",
  gopro: "GoPro",
  red: "RED",
  dji: "DJI",
  mock: "Mock",
};

function StatChip({
  icon,
  label,
  value,
  warning,
  critical,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warning?: boolean;
  critical?: boolean;
}) {
  const color = critical ? "#fca5a5" : warning ? "#fbbf24" : "#86efac";
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        bgcolor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 0.5,
        px: 1,
        py: 0.5,
        flex: "1 1 auto",
        minWidth: 0,
      }}
    >
      <Box sx={{ color, display: "flex", alignItems: "center" }}>{icon}</Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "#fff", fontFamily: "monospace", lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function SettingRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 11, color: "#fff", fontFamily: "monospace" }}>
        {String(value)}
      </Typography>
    </Stack>
  );
}

function CameraCard({
  camera,
  onRemove,
  onRefresh,
}: {
  camera: ConnectedCamera;
  onRemove: (cameraId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const adapter = camera.adapter;
  const state = camera.state;
  const vendorColor = VENDOR_COLORS[adapter.vendor];
  const vendorName = VENDOR_NAMES[adapter.vendor];

  const handleAction = async (action: () => Promise<void>, label: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const isBleTransport = adapter.transport === "ble";
  const isHttpTransport = adapter.transport.includes("https") || adapter.transport.includes("http");

  // Battery-warning ved < 20%
  const batteryWarning = state?.batteryPercent !== undefined && state.batteryPercent < 30;
  const batteryCritical = state?.batteryPercent !== undefined && state.batteryPercent < 15;
  const tempWarning = state?.temperatureStatus === "warning";
  const tempCritical = state?.temperatureStatus === "critical";

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isOpen) => setExpanded(isOpen)}
      sx={{
        bgcolor: "rgba(255,255,255,0.02)",
        borderLeft: "3px solid",
        borderLeftColor: vendorColor,
        "&:before": { display: "none" },
        "& .MuiAccordionSummary-root": { px: 1.5, py: 0.75, minHeight: "auto !important" },
        "& .MuiAccordionDetails-root": { px: 1.5, pb: 1.5, pt: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "rgba(255,255,255,0.5)" }} />}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              bgcolor: vendorColor,
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              flexShrink: 0,
            }}
          >
            {vendorName.toUpperCase()}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, color: "#fff", fontWeight: 600, lineHeight: 1.2 }}>
              {state?.label ?? adapter.id}
            </Typography>
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.2 }} noWrap>
              {state?.model ?? adapter.id}
            </Typography>
          </Box>
          {/* Status-indikatorer */}
          <Stack direction="row" spacing={0.5}>
            {isBleTransport && (
              <Tooltip title="Bluetooth LE">
                <BluetoothIcon sx={{ fontSize: 14, color: "#0288d1" }} />
              </Tooltip>
            )}
            {isHttpTransport && (
              <Tooltip title="HTTP/HTTPS">
                <RouterIcon sx={{ fontSize: 14, color: "#86efac" }} />
              </Tooltip>
            )}
            {state?.recording && (
              <Tooltip title="Rolling">
                <FiberManualRecordIcon sx={{ fontSize: 14, color: "#dc2626" }} />
              </Tooltip>
            )}
            {state?.online === false && (
              <Tooltip title="Offline">
                <VideocamOffIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }} />
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </AccordionSummary>

      <AccordionDetails>
        <Stack spacing={1.5}>
          {/* Stat-row */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {state?.batteryPercent !== undefined && (
              <StatChip
                icon={<BatteryFullIcon sx={{ fontSize: 14 }} />}
                label="Battery"
                value={`${state.batteryPercent}%`}
                warning={batteryWarning}
                critical={batteryCritical}
              />
            )}
            {state?.storageFreeGb !== undefined && (
              <StatChip
                icon={<SdStorageIcon sx={{ fontSize: 14 }} />}
                label="Storage"
                value={
                  state.storageTotalGb
                    ? `${state.storageFreeGb}/${state.storageTotalGb} GB`
                    : `${state.storageFreeGb} GB`
                }
              />
            )}
            {state?.temperatureStatus && (
              <StatChip
                icon={<ThermostatIcon sx={{ fontSize: 14 }} />}
                label="Temp"
                value={state.temperatureStatus}
                warning={tempWarning}
                critical={tempCritical}
              />
            )}
          </Stack>

          {/* Settings */}
          {state?.settings && (
            <Box>
              <Typography
                sx={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  mb: 0.5,
                }}
              >
                Current settings
              </Typography>
              <Box
                sx={{
                  bgcolor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 0.5,
                  px: 1,
                  py: 0.5,
                }}
              >
                <SettingRow label="FPS" value={state.settings.fps} />
                <SettingRow label="Shutter" value={state.settings.shutterSpeed ?? (state.settings.shutterAngle ? `${state.settings.shutterAngle}°` : undefined)} />
                <SettingRow label="ISO" value={state.settings.iso} />
                <SettingRow label="Iris" value={state.settings.iris} />
                <SettingRow label="WB" value={state.settings.whiteBalanceK ? `${state.settings.whiteBalanceK}K` : undefined} />
                <SettingRow label="Focus" value={state.settings.focusMode} />
                <SettingRow label="Resolution" value={state.settings.resolution} />
                <SettingRow label="Codec" value={state.settings.codec} />
              </Box>
            </Box>
          )}

          {/* Camera info */}
          {(state?.firmwareVersion || state?.serialNumber) && (
            <Box>
              <Typography
                sx={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  mb: 0.5,
                }}
              >
                Identity
              </Typography>
              <Box
                sx={{
                  bgcolor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 0.5,
                  px: 1,
                  py: 0.5,
                }}
              >
                <SettingRow label="ID" value={adapter.id} />
                <SettingRow label="Transport" value={adapter.transport} />
                <SettingRow label="Firmware" value={state.firmwareVersion} />
                <SettingRow label="Serial" value={state.serialNumber} />
              </Box>
            </Box>
          )}

          {/* Vendor-extra */}
          {state?.vendorExtra && Object.keys(state.vendorExtra).length > 0 && (
            <Accordion
              sx={{
                bgcolor: "rgba(0,0,0,0.3)",
                "&:before": { display: "none" },
                boxShadow: "none",
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }} />}
                sx={{ minHeight: "auto !important", py: 0.5, px: 1 }}
              >
                <Typography
                  sx={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Vendor extra ({Object.keys(state.vendorExtra).length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 1, py: 0.5 }}>
                <Box
                  component="pre"
                  sx={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "monospace",
                    overflowX: "auto",
                    m: 0,
                    maxHeight: 120,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {JSON.stringify(state.vendorExtra, null, 2)}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Action-knapper */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {!state?.recording && (
              <Tooltip title="Start opptak">
                <Button
                  size="small"
                  startIcon={<VideocamIcon />}
                  disabled={busy}
                  onClick={() => handleAction(() => adapter.startRecording(), "Start record")}
                  sx={{
                    bgcolor: "rgba(220,38,38,0.15)",
                    color: "#fca5a5",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    "&:hover": { bgcolor: "rgba(220,38,38,0.25)" },
                  }}
                >
                  ROLL
                </Button>
              </Tooltip>
            )}
            {state?.recording && (
              <Tooltip title="Stopp opptak">
                <Button
                  size="small"
                  startIcon={<StopIcon />}
                  disabled={busy}
                  onClick={() => handleAction(() => adapter.stopRecording(), "Stop record")}
                  sx={{
                    bgcolor: "rgba(220,38,38,0.3)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    "&:hover": { bgcolor: "rgba(220,38,38,0.4)" },
                  }}
                >
                  CUT
                </Button>
              </Tooltip>
            )}
            {adapter.triggerShutter && (
              <Tooltip title="Ta enkeltbilde">
                <Button
                  size="small"
                  startIcon={<PhotoCameraIcon />}
                  disabled={busy}
                  onClick={() => handleAction(() => adapter.triggerShutter!(), "Shutter")}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 10,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                >
                  Shutter
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Hent fresh state">
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                disabled={busy}
                onClick={() => handleAction(onRefresh, "Refresh")}
                sx={{
                  bgcolor: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 10,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                Oppdater
              </Button>
            </Tooltip>
            <Tooltip title="Koble fra kamera">
              <Button
                size="small"
                startIcon={<LinkOffIcon />}
                disabled={busy}
                onClick={() => handleAction(() => onRemove(adapter.id), "Disconnect")}
                sx={{
                  bgcolor: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 10,
                  ml: "auto",
                  "&:hover": { color: "#fca5a5", bgcolor: "rgba(220,38,38,0.1)" },
                }}
              >
                Koble fra
              </Button>
            </Tooltip>
          </Stack>

          {actionError && (
            <Alert severity="error" sx={{ py: 0.25 }} onClose={() => setActionError(null)}>
              <Typography sx={{ fontSize: 10 }}>{actionError}</Typography>
            </Alert>
          )}

          {/* Last fetched-timestamp */}
          {state?.fetchedAt && (
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "right" }}>
              Sist oppdatert: {new Date(state.fetchedAt).toLocaleTimeString("no-NO")}
            </Typography>
          )}

          {busy && <LinearProgress sx={{ height: 2 }} />}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export const CameraDetailDrawer: React.FC<CameraDetailDrawerProps> = ({
  open,
  onClose,
  cameras,
  onRemove,
  onRefresh,
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 400,
          bgcolor: "#0a0a0a",
          color: "#fff",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
        },
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
            TILKOBLEDE KAMERAER ({cameras.length})
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.5)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
        {cameras.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Ingen kameraer paired
            </Typography>
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", mt: 0.5 }}>
              Klikk settings-cog i top-bar for å koble til
            </Typography>
          </Box>
        ) : (
          <Stack spacing={0.5} sx={{ px: 0.5 }}>
            {cameras.map((cam) => (
              <CameraCard
                key={cam.adapter.id}
                camera={cam}
                onRemove={onRemove}
                onRefresh={onRefresh}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

export default CameraDetailDrawer;
