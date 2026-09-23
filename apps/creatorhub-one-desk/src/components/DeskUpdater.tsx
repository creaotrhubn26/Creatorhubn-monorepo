import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  Badge,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DownloadDoneOutlinedIcon from "@mui/icons-material/DownloadDoneOutlined";
import { getPrefs, saveUpdaterPrefs } from "../api";
import {
  parseUpdaterNotes,
  releaseHistory,
  releaseNoteForVersion,
  type ReleaseNote,
} from "../releaseNotes";
import UpdaterDialog, {
  type UpdateSettings,
  type UpdaterStage,
} from "./UpdaterDialog";

interface PendingUpdate {
  version: string;
  release: ReleaseNote;
  download: (onProgress: (fraction: number) => void) => Promise<void>;
  install: () => Promise<void>;
}

const DEFAULT_SETTINGS: UpdateSettings = {
  autoCheck: true,
  autoDownload: false,
  skippedVersion: null,
  remindAfterMs: null,
  lastCheckedAtMs: null,
};

const INITIAL_CHECK_DELAY_MS = 4_000;
const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const FOCUS_RECHECK_INTERVAL_MS = 60 * 60 * 1_000;
const REMIND_LATER_MS = 24 * 60 * 60 * 1_000;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Ukjent feil";
}

export default function DeskUpdater() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [stage, setStage] = useState<UpdaterStage>("idle");
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settings, setSettings] = useState<UpdateSettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const checkInFlightRef = useRef<Promise<void> | null>(null);
  const settingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persistSettings = useCallback((next: UpdateSettings) => {
    settingsRef.current = next;
    setSettings(next);
    settingsSaveQueueRef.current = settingsSaveQueueRef.current
      .catch(() => undefined)
      .then(() => saveUpdaterPrefs(next))
      .catch((saveError) => {
        console.warn("[updater] kunne ikke lagre innstillinger:", saveError);
        setToast("Kunne ikke lagre oppdateringsinnstillingene.");
      });
  }, []);

  useEffect(() => {
    void Promise.all([getVersion(), getPrefs()])
      .then(([version, prefs]) => {
        setCurrentVersion(version);
        const stored: UpdateSettings = {
          autoCheck: prefs.updater_auto_check,
          autoDownload: prefs.updater_auto_download,
          skippedVersion: prefs.updater_skipped_version,
          remindAfterMs: prefs.updater_remind_after_ms,
          lastCheckedAtMs: prefs.updater_last_checked_at_ms,
        };
        settingsRef.current = stored;
        setSettings(stored);
      })
      .catch((loadError) => {
        console.warn("[updater] kunne ikke laste innstillinger:", loadError);
        void getVersion().then(setCurrentVersion).catch(() => setCurrentVersion(""));
      })
      .finally(() => setSettingsReady(true));
  }, []);

  const downloadUpdate = useCallback(async (
    update: PendingUpdate,
    installAfter: boolean,
    showDialog = true,
  ) => {
    if (showDialog) setDialogOpen(true);
    setStage("downloading");
    setProgress(0);
    setError(null);
    try {
      await update.download(setProgress);
      setProgress(1);
      setStage("downloaded");
      if (installAfter) {
        setStage("installing");
        await update.install();
        setStage("installed");
      }
    } catch (downloadError) {
      console.warn("[updater] nedlasting/installasjon feilet:", downloadError);
      setError(`Kunne ikke oppdatere: ${errorMessage(downloadError)}`);
      setStage("error");
    }
  }, []);

  const checkForUpdates = useCallback(
    (manual: boolean) => {
      if (checkInFlightRef.current) return checkInFlightRef.current;

      const task = (async () => {
        setStage("checking");
        setError(null);
        try {
          const updater = await import("@tauri-apps/plugin-updater");
          const update = await updater.check();
          const checkedAt = Date.now();
          const checkedSettings = { ...settingsRef.current, lastCheckedAtMs: checkedAt };

          if (!update) {
            setPendingUpdate(null);
            setStage("up-to-date");
            persistSettings({
              ...checkedSettings,
              skippedVersion: null,
              remindAfterMs: null,
            });
            if (manual) setToast("CreatorHub One Desk er oppdatert.");
            return;
          }

          const release = parseUpdaterNotes(update.body ?? null, update.version);
          const nextUpdate: PendingUpdate = {
            version: update.version,
            release,
            download: async (onProgress) => {
              let total = 0;
              let downloaded = 0;
              await update.download((event) => {
                if (event.event === "Started") {
                  total = event.data.contentLength ?? 0;
                  onProgress(0);
                } else if (event.event === "Progress") {
                  downloaded += event.data.chunkLength;
                  if (total > 0) onProgress(Math.min(1, downloaded / total));
                } else if (event.event === "Finished") {
                  onProgress(1);
                }
              });
            },
            install: () => update.install(),
          };

          const staleSkip =
            checkedSettings.skippedVersion !== null &&
            checkedSettings.skippedVersion !== update.version;
          const unskippedSettings = staleSkip
            ? { ...checkedSettings, skippedVersion: null, remindAfterMs: null }
            : checkedSettings;
          const nextSettings = release.critical
            ? { ...unskippedSettings, skippedVersion: null, remindAfterMs: null }
            : unskippedSettings;
          const skipped = nextSettings.skippedVersion === update.version && !release.critical;
          const reminderActive = Boolean(
            nextSettings.remindAfterMs &&
              nextSettings.remindAfterMs > checkedAt &&
              !release.critical,
          );

          persistSettings(nextSettings);
          setPendingUpdate(nextUpdate);
          setStage("available");

          if (manual || release.critical || (!skipped && !reminderActive)) {
            setDialogOpen(true);
          }
          if (nextSettings.autoDownload && !skipped) {
            await downloadUpdate(nextUpdate, false, false);
          }
        } catch (checkError) {
          const checkedAt = Date.now();
          persistSettings({ ...settingsRef.current, lastCheckedAtMs: checkedAt });
          console.warn("[updater] kunne ikke kontrollere oppdateringer:", checkError);
          setError("Kunne ikke søke etter oppdateringer. Kontroller nettet og prøv igjen.");
          setStage("error");
          if (manual) setDialogOpen(true);
        } finally {
          checkInFlightRef.current = null;
        }
      })();

      checkInFlightRef.current = task;
      return task;
    },
    [downloadUpdate, persistSettings],
  );

  useEffect(() => {
    if (!settingsReady || !settings.autoCheck) return;
    const initialTimer = window.setTimeout(() => {
      void checkForUpdates(false);
    }, INITIAL_CHECK_DELAY_MS);
    const periodicTimer = window.setInterval(() => {
      void checkForUpdates(false);
    }, PERIODIC_CHECK_INTERVAL_MS);
    const handleFocus = () => {
      const lastChecked = settingsRef.current.lastCheckedAtMs;
      if (!lastChecked || Date.now() - lastChecked >= FOCUS_RECHECK_INTERVAL_MS) {
        void checkForUpdates(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(periodicTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkForUpdates, settings.autoCheck, settingsReady]);

  const handleInstall = useCallback(async () => {
    if (!pendingUpdate) return;
    setStage("installing");
    setError(null);
    try {
      await pendingUpdate.install();
      setStage("installed");
    } catch (installError) {
      setError(`Kunne ikke installere: ${errorMessage(installError)}`);
      setStage("error");
    }
  }, [pendingUpdate]);

  const handleRemindLater = () => {
    persistSettings({
      ...settingsRef.current,
      skippedVersion: null,
      remindAfterMs: Date.now() + REMIND_LATER_MS,
    });
    setDialogOpen(false);
  };

  const handleSkip = () => {
    if (!pendingUpdate) return;
    persistSettings({
      ...settingsRef.current,
      skippedVersion: pendingUpdate.version,
      remindAfterMs: null,
    });
  };

  const handleResume = () => {
    persistSettings({
      ...settingsRef.current,
      skippedVersion: null,
      remindAfterMs: null,
    });
  };

  const buttonLabel =
    stage === "checking"
      ? "Søker…"
      : stage === "available" && pendingUpdate
        ? `v${pendingUpdate.version} tilgjengelig`
        : stage === "downloading"
          ? `Laster ned ${Math.round(progress * 100)}%`
          : stage === "downloaded"
            ? "Klar til installasjon"
            : stage === "installed"
              ? "Start appen på nytt"
              : "Oppdateringer";

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
          borderColor: stage === "available" || stage === "downloaded" ? "primary.main" : "divider",
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
              {currentVersion ? `v${currentVersion} · stabil` : "Sikker oppdateringskanal"}
            </Typography>
          </Stack>
          <Badge
            color="primary"
            variant="dot"
            invisible={stage !== "available" && stage !== "downloaded"}
          >
            <Button
              size="small"
              variant={stage === "available" || stage === "downloaded" ? "contained" : "outlined"}
              color={stage === "error" ? "error" : "primary"}
              startIcon={
                stage === "checking" || stage === "downloading" || stage === "installing" ? (
                  <CircularProgress size={15} color="inherit" />
                ) : stage === "downloaded" || stage === "installed" ? (
                  <DownloadDoneOutlinedIcon fontSize="small" />
                ) : stage === "up-to-date" ? (
                  <CheckCircleOutlineIcon fontSize="small" />
                ) : (
                  <AutoAwesomeIcon fontSize="small" />
                )
              }
              onClick={() => setDialogOpen(true)}
            >
              {buttonLabel}
            </Button>
          </Badge>
        </Stack>
      </Paper>

      <UpdaterDialog
        open={dialogOpen}
        currentVersion={currentVersion}
        stage={stage}
        availableRelease={pendingUpdate?.release ?? null}
        currentRelease={releaseNoteForVersion(currentVersion)}
        history={releaseHistory}
        settings={settings}
        progress={progress}
        error={error}
        onCheck={() => void checkForUpdates(true)}
        onDownloadAndInstall={() =>
          pendingUpdate && void downloadUpdate(pendingUpdate, true)
        }
        onInstall={() => void handleInstall()}
        onRemindLater={handleRemindLater}
        onSkipVersion={handleSkip}
        onResumeVersion={handleResume}
        onChangeSettings={persistSettings}
        onDismiss={() => setDialogOpen(false)}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={5_000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
