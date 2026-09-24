import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { openUrl } from "@tauri-apps/plugin-opener";
import creatorHubLogo from "../assets/desk-icon.svg";
import lightroomClassicLogo from "../assets/lightroom-classic-logo.svg";
import {
  getLightroomIntegrationStatus,
  installLightroomPlugin,
  LightroomIntegrationStatus,
  LightroomConnectionCheck,
  testLightroomConnection,
  uninstallLightroomPlugin,
} from "../api";

function errorMessage(error: unknown): string {
  return typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "En ukjent feil oppstod.";
}

interface Props {
  compact?: boolean;
}

export default function LightroomIntegrationCard({ compact = false }: Props) {
  const [status, setStatus] = useState<LightroomIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"install" | "uninstall" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<LightroomConnectionCheck | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getLightroomIntegrationStatus());
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void getLightroomIntegrationStatus().then(setStatus).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      !status?.connected_user_email ||
      !status.classic_installed ||
      (status.plugin_installed && !status.plugin_update_required)
    ) {
      setPromptOpen(false);
      return;
    }
    const account = status.connected_user_email ?? "signed-in";
    const key = `creatorhub-lightroom-install-prompt:${account}`;
    if (window.localStorage.getItem(key) !== "dismissed") {
      setPromptOpen(true);
    }
  }, [status]);

  const install = async () => {
    setAction("install");
    setError(null);
    try {
      setStatus(await installLightroomPlugin());
      setPromptOpen(false);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setAction(null);
    }
  };

  const dismissPrompt = () => {
    const account = status?.connected_user_email ?? "signed-in";
    window.localStorage.setItem(`creatorhub-lightroom-install-prompt:${account}`, "dismissed");
    setPromptOpen(false);
  };

  const uninstall = async () => {
    setAction("uninstall");
    setError(null);
    try {
      setStatus(await uninstallLightroomPlugin());
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setAction(null);
    }
  };

  const pluginReady = Boolean(
    status?.plugin_installed &&
    status.broker_running &&
    status.plugin_runtime_active &&
    !status.plugin_update_required &&
    status.connected_user_email,
  );

  const testConnection = async (showDetails = false) => {
    setChecking(true);
    setError(null);
    try {
      const result = await testLightroomConnection();
      setConnection(result);
      if (showDetails) setDetailsOpen(true);
      await refresh();
      return result;
    } catch (nextError) {
      setError(errorMessage(nextError));
      return null;
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Dialog open={promptOpen} onClose={dismissPrompt} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              component="img"
              src={lightroomClassicLogo}
              alt="Lightroom Classic"
              sx={{ width: 38, height: 38, borderRadius: 1 }}
            />
            <span>
              {status?.plugin_installed
                ? "Oppdater CreatorHub for Lightroom Classic?"
                : "Installer CreatorHub for Lightroom Classic?"}
            </span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              Lightroom Classic er installert. CreatorHub Desk kan legge inn den nyeste pluginen
              og koble den til den verifiserte kontoen din nå.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Originaler går til privat CreatorHub S3. Google Drive brukes bare som valgfritt speil
              dersom du har koblet Drive til CreatorHub.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={dismissPrompt} disabled={action !== null}>
            Ikke nå
          </Button>
          <Button variant="contained" onClick={() => void install()} disabled={action !== null}>
            {action === "install" ? "Installerer…" : "Installer plugin"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Siste Lightroom-eksport</DialogTitle>
        <DialogContent>
          {connection?.latest_export ? (
            <Stack spacing={0.75} sx={{ pt: 0.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{connection.latest_export.filename}</Typography>
              <Typography variant="body2" color="text.secondary">
                {connection.latest_export.project_title} · {connection.latest_export.status}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {connection.latest_export.verified_at ?? connection.latest_export.created_at ?? "Tidspunkt mangler"}
              </Typography>
            </Stack>
          ) : (
            <Alert severity="info">Ingen Lightroom-eksporter er registrert ennå.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {compact ? (
        <Button
          variant="text"
          startIcon={status?.plugin_installed ? <CheckCircleIcon /> : <ExtensionOutlinedIcon />}
          onClick={() => {
            if (
              status?.connected_user_email &&
              status.classic_installed &&
              (!status.plugin_installed || status.plugin_update_required)
            ) {
              setPromptOpen(true);
            } else if (!status?.classic_installed) {
              void refresh();
            }
          }}
          disabled={
            loading ||
            action !== null ||
            (status?.plugin_installed === true && !status.plugin_update_required) ||
            !status?.connected_user_email
          }
        >
          {loading
            ? "Sjekker Lightroom Classic…"
            : !status?.connected_user_email
              ? "Logg inn for Lightroom-plugin"
              : status.plugin_installed && !status.plugin_update_required
              ? pluginReady
                ? `Lightroom-plugin ${status.plugin_version ?? ""} klar`
                : `Lightroom-plugin ${status.plugin_version ?? ""} installert`
              : status.classic_installed
                ? status.plugin_installed
                  ? "Oppdater Lightroom-plugin"
                  : "Installer Lightroom-plugin"
                : "Sjekk Lightroom Classic"}
        </Button>
      ) : (
      <Card variant="outlined">
        <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexShrink: 0 }}>
              <Box component="img" src={creatorHubLogo} alt="CreatorHub" sx={{ width: 42, height: 42 }} />
              <Typography color="text.secondary">×</Typography>
              <Box component="img" src={lightroomClassicLogo} alt="Lightroom Classic" sx={{ width: 42, height: 42, borderRadius: 1.5 }} />
            </Stack>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Lightroom Classic
                </Typography>
                {status?.plugin_installed && (
                  <Chip
                    size="small"
                    color={pluginReady ? "success" : "info"}
                    icon={<CheckCircleIcon />}
                    label={pluginReady ? "Klar" : "Installert"}
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Eksporter til CreatorHub S3, og bruk Google Drive bare når det er koblet til kontoen.
              </Typography>
            </Box>
            <Button
              size="small"
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={() => void refresh()}
              disabled={loading || action !== null}
            >
              Sjekk igjen
            </Button>
          </Stack>

          {loading && !status ? (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Ser etter Lightroom Classic…
              </Typography>
            </Stack>
          ) : status && !status.connected_user_email ? (
            <Alert severity="info">
              Logg inn med CreatorHub-kontoen din i Desk før Lightroom-pluginen kan installeres.
            </Alert>
          ) : status && !status.classic_installed ? (
            <Alert severity="info">
              Lightroom Classic ble ikke funnet i Programmer-mappen. Installer Lightroom Classic,
              og trykk deretter «Sjekk igjen».
            </Alert>
          ) : status?.plugin_installed ? (
            <Stack spacing={1.5}>
              {status.restart_required && (
                <Alert severity="success">
                  Pluginen er installert. Start Lightroom Classic på nytt for å aktivere den.
                </Alert>
              )}
              {!status.restart_required && status.plugin_update_required && (
                <Alert severity="warning">
                  Pluginen må oppdateres eller kobles til kontoen som er innlogget i CreatorHub Desk.
                </Alert>
              )}
              {!status.restart_required && !status.plugin_update_required && !pluginReady && (
                <Alert severity="info">
                  {status.broker_running
                    ? "Desk-brokeren kjører. Kontroller at pluginen er aktivert i Lightroom Classic sin Plugin Manager før første eksport."
                    : `Desk-brokeren kjører ikke${status.broker_error ? `: ${status.broker_error}` : "."}`}
                </Alert>
              )}
              {pluginReady && (
                <Alert severity="success">
                  Lightroom Classic har bekreftet at CreatorHub-pluginen er lastet og aktiv.
                </Alert>
              )}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Verifisert CreatorHub-konto
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {status.connected_user_email ?? "Innlogget i CreatorHub Desk"}
                  {status.plugin_version ? ` · plugin ${status.plugin_version}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {status.plugin_path}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Lokal broker: {status.broker_running ? status.broker_url : "stoppet"}
                </Typography>
              </Box>
              {connection && (
                <Alert severity="success">
                  Tilkoblet som {connection.account_email} · {connection.project_count} prosjekt{connection.project_count === 1 ? "" : "er"}
                  {connection.drive_available ? " · Google Drive tilgjengelig" : ""}
                </Alert>
              )}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => void testConnection()}
                  disabled={checking || action !== null || !status.broker_running}
                >
                  {checking ? "Tester…" : "Test forbindelse"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    const result = connection ?? await testConnection();
                    if (result?.photo_room_url) await openUrl(result.photo_room_url);
                  }}
                  disabled={checking || action !== null || !status.broker_running}
                >
                  Åpne Photo Room
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => void testConnection(true)}
                  disabled={checking || action !== null || !status.broker_running}
                >
                  Vis siste eksport
                </Button>
                <Button
                  variant="contained"
                  onClick={() => void install()}
                  disabled={action !== null}
                >
                  {action === "install" ? "Oppdaterer…" : "Oppdater eller reparer"}
                </Button>
                <Button
                  color="error"
                  onClick={() => void uninstall()}
                  disabled={action !== null}
                >
                  {action === "uninstall" ? "Fjerner…" : "Fjern plugin"}
                </Button>
              </Stack>
            </Stack>
          ) : status?.classic_installed ? (
            <Stack spacing={1.5}>
              <Alert severity="info">
                Lightroom Classic er funnet. Installer den personlige CreatorHub-pluginen for den
                verifiserte kontoen din.
              </Alert>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {status.classic_path}
                </Typography>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  onClick={() => void install()}
                  disabled={action !== null}
                >
                  {action === "install" ? "Installerer…" : "Installer Lightroom-plugin"}
                </Button>
              </Box>
            </Stack>
          ) : null}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
        </CardContent>
      </Card>
      )}
    </>
  );
}
