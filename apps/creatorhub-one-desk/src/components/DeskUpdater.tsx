import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Alert, Button, CircularProgress, Paper, Snackbar, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import UpdaterDialog from "./UpdaterDialog";

type CheckState = "idle" | "checking" | "up-to-date" | "available" | "installed" | "error";

interface PendingUpdate {
  version: string;
  notes: string | null;
  runDownload: (
    onProgress: (fraction: number, status: "downloading" | "finished") => void,
  ) => Promise<void>;
}

const INITIAL_CHECK_DELAY_MS = 4_000;
const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const FOCUS_RECHECK_INTERVAL_MS = 60 * 60 * 1_000;

export default function DeskUpdater() {
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(
    null,
  );
  const checkInFlightRef = useRef<Promise<void> | null>(null);
  const lastCheckedAtRef = useRef(0);

  useEffect(() => {
    void getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion(""));
  }, []);

  const checkForUpdates = useCallback((manual: boolean) => {
    if (checkInFlightRef.current) return checkInFlightRef.current;

    const task = (async () => {
      setCheckState("checking");
      try {
        const updater = await import("@tauri-apps/plugin-updater");
        const update = await updater.check();
        lastCheckedAtRef.current = Date.now();

        if (!update) {
          setPendingUpdate(null);
          setCheckState("up-to-date");
          if (manual) {
            setMessage({ severity: "success", text: "CreatorHub One Desk er oppdatert." });
          }
          return;
        }

        const nextUpdate: PendingUpdate = {
          version: update.version,
          notes: update.body ?? null,
          runDownload: async (onProgress) => {
            let total = 0;
            let downloaded = 0;
            await update.downloadAndInstall((event) => {
              if (event.event === "Started") {
                total = event.data.contentLength ?? 0;
                onProgress(0, "downloading");
              } else if (event.event === "Progress") {
                downloaded += event.data.chunkLength;
                if (total > 0) onProgress(downloaded / total, "downloading");
              } else if (event.event === "Finished") {
                onProgress(1, "finished");
              }
            });
          },
        };

        setPendingUpdate(nextUpdate);
        setCheckState("available");
        setDialogOpen(true);
      } catch (error) {
        lastCheckedAtRef.current = Date.now();
        setCheckState("error");
        console.warn("[updater] kunne ikke kontrollere oppdateringer:", error);
        if (manual) {
          setMessage({
            severity: "error",
            text: "Kunne ikke søke etter oppdateringer. Kontroller nettet og prøv igjen.",
          });
        }
      } finally {
        checkInFlightRef.current = null;
      }
    })();

    checkInFlightRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void checkForUpdates(false);
    }, INITIAL_CHECK_DELAY_MS);
    const periodicTimer = window.setInterval(() => {
      void checkForUpdates(false);
    }, PERIODIC_CHECK_INTERVAL_MS);

    const handleFocus = () => {
      if (
        lastCheckedAtRef.current > 0 &&
        Date.now() - lastCheckedAtRef.current >= FOCUS_RECHECK_INTERVAL_MS
      ) {
        void checkForUpdates(false);
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(periodicTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkForUpdates]);

  const handleManualCheck = () => {
    if (checkState === "available" && pendingUpdate) {
      setDialogOpen(true);
      return;
    }
    void checkForUpdates(true);
  };

  const handleInstalled = () => {
    setCheckState("installed");
  };

  const buttonLabel =
    checkState === "checking"
      ? "Søker…"
      : checkState === "available" && pendingUpdate
        ? `Versjon ${pendingUpdate.version} tilgjengelig`
        : checkState === "installed"
          ? "Oppdatering installert"
          : "Søk etter oppdateringer";

  return (
    <>
      <Paper
        component="aside"
        aria-label="CreatorHub Desk-oppdateringer"
        elevation={8}
        sx={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: (theme) => theme.zIndex.appBar,
          px: 1.25,
          py: 0.75,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              CreatorHub One Desk
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              {currentVersion ? `v${currentVersion}` : "Sikker oppdateringskanal"}
            </Typography>
          </Stack>
          <Button
            size="small"
            variant={checkState === "available" ? "contained" : "outlined"}
            color={checkState === "error" ? "error" : "primary"}
            startIcon={
              checkState === "checking" ? (
                <CircularProgress size={15} color="inherit" />
              ) : checkState === "available" || checkState === "installed" ? (
                <SystemUpdateAltIcon fontSize="small" />
              ) : (
                <RefreshIcon fontSize="small" />
              )
            }
            onClick={handleManualCheck}
            disabled={checkState === "checking" || checkState === "installed"}
          >
            {buttonLabel}
          </Button>
        </Stack>
      </Paper>

      {pendingUpdate && dialogOpen && (
        <UpdaterDialog
          version={pendingUpdate.version}
          notes={pendingUpdate.notes}
          onDownload={pendingUpdate.runDownload}
          onInstalled={handleInstalled}
          onDismiss={() => setDialogOpen(false)}
        />
      )}

      <Snackbar
        open={message !== null}
        autoHideDuration={5_000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={message?.severity ?? "success"}
          variant="filled"
          onClose={() => setMessage(null)}
          sx={{ width: "100%" }}
        >
          {message?.text}
        </Alert>
      </Snackbar>
    </>
  );
}
