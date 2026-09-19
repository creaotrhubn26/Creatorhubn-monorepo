import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CableOutlined from "@mui/icons-material/CableOutlined";
import RadioOutlined from "@mui/icons-material/RadioOutlined";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";
import {
  BlackmagicProbe,
  BridgeCapability,
  BridgePreviewStatus,
  BridgeStatus,
  ObsProbe,
  getBridgeStatus,
  getBridgePreviewStatus,
  getNdiPreviewStatus,
  discoverNdiSources,
  NdiDiscoveryResult,
  NdiPreviewStatus,
  probeBlackmagicCamera,
  probeObs,
  runObsAction,
  saveBridgePreviewSources,
  setBlackmagicRecording,
  startNdiPreview,
  stopNdiPreview,
} from "../api";

const availabilityLabel: Record<BridgeCapability["availability"], string> = {
  ready: "Klar",
  runtime_required: "Runtime mangler",
  tool_required: "Verktøy mangler",
  sdk_required: "SDK mangler",
  device_required: "Koble til enhet",
};

const availabilityColor = (availability: BridgeCapability["availability"]) =>
  availability === "ready" ? "success" : availability === "device_required" ? "info" : "warning";

function CapabilityList({ title, items }: { title: string; items: BridgeCapability[] }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {items.map((item) => (
          <Box
            key={item.id}
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.default",
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                {item.label}
              </Typography>
              <Chip
                size="small"
                color={availabilityColor(item.availability)}
                label={availabilityLabel[item.availability]}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {item.detail}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default function BridgeSection() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [previewStatus, setPreviewStatus] = useState<BridgePreviewStatus | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [obsEndpoint, setObsEndpoint] = useState("ws://127.0.0.1:4455");
  const [obsPassword, setObsPassword] = useState("");
  const [obs, setObs] = useState<ObsProbe | null>(null);
  const [obsScene, setObsScene] = useState("");

  const [blackmagicUrl, setBlackmagicUrl] = useState("http://blackmagic-camera.local");
  const [blackmagicClipName, setBlackmagicClipName] = useState("");
  const [blackmagic, setBlackmagic] = useState<BlackmagicProbe | null>(null);
  const [multiviewUrl, setMultiviewUrl] = useState("");
  const [cameraUrl, setCameraUrl] = useState("");
  const [ndi, setNdi] = useState<NdiDiscoveryResult | null>(null);
  const [ndiPreview, setNdiPreview] = useState<NdiPreviewStatus | null>(null);

  useEffect(() => {
    void getBridgeStatus().then(setStatus).catch((error) => setGlobalError(String(error)));
    void getBridgePreviewStatus()
      .then((result) => {
        setPreviewStatus(result);
        setMultiviewUrl(
          result.sources.find((source) => source.role === "multiview")?.playback_url ?? "",
        );
        setCameraUrl(
          result.sources.find((source) => source.role === "camera")?.playback_url ?? "",
        );
      })
      .catch((error) => setGlobalError(String(error)));
    void getNdiPreviewStatus().then(setNdiPreview).catch((error) => setGlobalError(String(error)));
  }, []);

  useEffect(() => {
    if (!ndiPreview || !["starting", "running"].includes(ndiPreview.phase)) return;
    const timer = window.setInterval(() => {
      void getNdiPreviewStatus().then(setNdiPreview).catch(() => undefined);
      void getBridgePreviewStatus().then(setPreviewStatus).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ndiPreview?.phase]);

  const savePreview = async () => {
    setBusy("preview-save");
    setGlobalError(null);
    try {
      const sources = [
        multiviewUrl.trim()
          ? {
              id: "multiview",
              label: "Bridge multiview",
              role: "multiview" as const,
              playback_url: multiviewUrl.trim(),
              quality_label: "Oversikt",
            }
          : null,
        cameraUrl.trim()
          ? {
              id: "camera-follow",
              label: "Valgt kamera",
              role: "camera" as const,
              playback_url: cameraUrl.trim(),
              quality_label: "Høy kvalitet",
            }
          : null,
      ].filter((source): source is NonNullable<typeof source> => source !== null);
      setPreviewStatus(await saveBridgePreviewSources(sources));
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
    } finally {
      setBusy(null);
    }
  };

  const scanNdi = async () => {
    setBusy("ndi-scan");
    setGlobalError(null);
    try {
      setNdi(await discoverNdiSources());
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
    } finally {
      setBusy(null);
    }
  };

  const startNdi = async (source: NdiDiscoveryResult["sources"][number]) => {
    setBusy("ndi-start");
    setGlobalError(null);
    try {
      setNdiPreview(await startNdiPreview(source));
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
    } finally {
      setBusy(null);
    }
  };

  const stopNdi = async () => {
    setBusy("ndi-stop");
    setGlobalError(null);
    try {
      setNdiPreview(await stopNdiPreview());
      setPreviewStatus(await getBridgePreviewStatus());
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
    } finally {
      setBusy(null);
    }
  };

  const testObs = async () => {
    setBusy("obs-probe");
    setGlobalError(null);
    try {
      const result = await probeObs({ endpoint: obsEndpoint, password: obsPassword });
      setObs(result);
      setObsScene(result.current_program_scene ?? result.scenes[0] ?? "");
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
    } finally {
      setBusy(null);
    }
  };

  const obsAction = async (
    action: "start_record" | "stop_record" | "set_current_program_scene",
  ) => {
    setBusy(`obs-${action}`);
    setGlobalError(null);
    try {
      await runObsAction({
        endpoint: obsEndpoint,
        password: obsPassword,
        action,
        sceneName: action === "set_current_program_scene" ? obsScene : null,
      });
      await testObs();
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
      setBusy(null);
    }
  };

  const testBlackmagic = async () => {
    setBusy("blackmagic-probe");
    setGlobalError(null);
    try {
      setBlackmagic(await probeBlackmagicCamera(blackmagicUrl));
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
    } finally {
      setBusy(null);
    }
  };

  const blackmagicRecord = async (recording: boolean) => {
    setBusy(recording ? "blackmagic-start" : "blackmagic-stop");
    setGlobalError(null);
    try {
      await setBlackmagicRecording({
        baseUrl: blackmagicUrl,
        recording,
        clipName: recording ? blackmagicClipName : null,
      });
      await testBlackmagic();
    } catch (error) {
      setGlobalError(typeof error === "string" ? error : String(error));
      setBusy(null);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <CableOutlined color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            CreatorHub Bridge
          </Typography>
          <Chip size="small" label="Lokal-first" color="success" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Lokal monitorering og kontroll fortsetter uten CreatorHub-skyen. Video og kontroll er
          separate signalveier: OBS/ATEM styrer produksjonen, mens UVC/NDI bærer bildet.
        </Typography>

        {globalError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGlobalError(null)}>
            {globalError}
          </Alert>
        )}

        {status && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <CapabilityList title="VIDEOKILDER" items={status.video_sources} />
            <CapabilityList title="KAMERAKONTROLL" items={status.camera_controls} />
            <CapabilityList title="PRODUKSJONSKONTROLL" items={status.production_controls} />
          </Box>
        )}

        <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
            <VideocamOutlined fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
              Lokal preview til iPad
            </Typography>
            <Chip
              size="small"
              color={previewStatus?.running ? "success" : "warning"}
              label={previewStatus?.running ? `Bonjour · port ${previewStatus.port}` : "Ikke startet"}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Legg inn lokale HLS-playlister produsert av Bridge-adapteren. Kun parede iPader får
            manifestet; videodata går direkte på lokalnettet og bruker ikke CreatorHub-skyen.
          </Typography>
          <Stack spacing={1.25}>
            <TextField
              size="small"
              label="Multiview HLS"
              placeholder="http://127.0.0.1:8090/multiview.m3u8"
              value={multiviewUrl}
              onChange={(event) => setMultiviewUrl(event.target.value)}
              helperText="Én samlet oversiktsstrøm for kameraene"
            />
            <TextField
              size="small"
              label="Valgt kamera HLS"
              placeholder="http://127.0.0.1:8090/camera-a.m3u8"
              value={cameraUrl}
              onChange={(event) => setCameraUrl(event.target.value)}
              helperText="Høyere kvalitet for iPaden som følger ett kamera"
            />
            <Button
              variant="outlined"
              onClick={savePreview}
              disabled={busy !== null}
              sx={{ alignSelf: "flex-start" }}
            >
              Lagre lokale preview-kilder
            </Button>
            {previewStatus?.last_error && (
              <Alert severity="warning">{previewStatus.last_error}</Alert>
            )}
          </Stack>
        </Box>

        <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <RadioOutlined fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
              NDI discovery
            </Typography>
            <Button size="small" onClick={scanNdi} disabled={busy !== null}>
              Søk etter NDI-kilder
            </Button>
          </Stack>
          {ndi ? (
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">
                {ndi.runtime_version} · {ndi.sources.length} kilder funnet
              </Typography>
              {ndi.sources.length === 0 ? (
                <Alert severity="info">
                  SDK/runtime er lastet korrekt. Ingen fysisk NDI-sender er synlig på lokalnettet nå.
                </Alert>
              ) : (
                ndi.sources.map((source) => {
                  const active = ndiPreview?.source_name === source.name
                    && ["starting", "running"].includes(ndiPreview.phase);
                  return (
                    <Stack
                      key={`${source.name}-${source.url_address ?? "discovered"}`}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ alignItems: { sm: "center" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {source.name}
                        </Typography>
                        {source.url_address && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {source.url_address}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        variant={active ? "contained" : "outlined"}
                        disabled={busy !== null || active}
                        onClick={() => void startNdi(source)}
                      >
                        {active ? "Sender til iPad" : "Start lokal preview"}
                      </Button>
                    </Stack>
                  );
                })
              )}
              {ndiPreview && ndiPreview.phase !== "idle" && (
                <Alert
                  severity={ndiPreview.phase === "failed" ? "error" : ndiPreview.phase === "running" ? "success" : "info"}
                  action={
                    ["starting", "running"].includes(ndiPreview.phase) ? (
                      <Button color="inherit" size="small" onClick={() => void stopNdi()} disabled={busy !== null}>
                        Stopp
                      </Button>
                    ) : undefined
                  }
                >
                  {ndiPreview.phase === "starting" && "Kobler NDI-kilden til lokal HLS …"}
                  {ndiPreview.phase === "running" && (
                    <>
                      Lokal preview kjører · {ndiPreview.width}×{ndiPreview.height}
                      {ndiPreview.frames_per_second
                        ? ` · ${ndiPreview.frames_per_second.toFixed(2)} fps`
                        : ""}
                      {` · ${ndiPreview.frames_received} rammer`}
                    </>
                  )}
                  {ndiPreview.phase === "failed" && (ndiPreview.last_error ?? "NDI preview feilet")}
                  {ndiPreview.phase === "stopped" && "NDI preview er stoppet."}
                </Alert>
              )}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Leser NDI-kilder direkte fra den installerte NDI 6-runtime-en.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Lokal preview sender foreløpig NDI-video til iPad. NDI-lyd beholdes som neste separate
            monitoreringsleveranse.
          </Typography>
        </Box>

        <Divider sx={{ my: 2.5 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <RadioOutlined fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                OBS-kontroll
              </Typography>
              {obs && (
                <Chip
                  size="small"
                  color={obs.recording ? "error" : "success"}
                  label={obs.recording ? "REC" : "Tilkoblet"}
                />
              )}
            </Stack>
            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="WebSocket-adresse"
                value={obsEndpoint}
                onChange={(event) => setObsEndpoint(event.target.value)}
                helperText="OBS 28+ bruker normalt ws://127.0.0.1:4455"
              />
              <TextField
                size="small"
                label="Passord"
                type="password"
                autoComplete="off"
                value={obsPassword}
                onChange={(event) => setObsPassword(event.target.value)}
                helperText="Brukes kun for denne handlingen og lagres ikke"
              />
              <Button
                variant="outlined"
                onClick={testObs}
                disabled={busy !== null || !obsEndpoint.trim()}
              >
                Test OBS
              </Button>
              {obs && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    OBS {obs.obs_studio_version ?? "?"} · WebSocket {obs.obs_websocket_version ?? "?"}
                  </Typography>
                  <TextField
                    select
                    size="small"
                    label="Programscene"
                    value={obsScene}
                    onChange={(event) => setObsScene(event.target.value)}
                  >
                    {obs.scenes.map((scene) => (
                      <MenuItem key={scene} value={scene}>
                        {scene}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      onClick={() => obsAction("set_current_program_scene")}
                      disabled={busy !== null || !obsScene}
                    >
                      Sett scene
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => obsAction(obs.recording ? "stop_record" : "start_record")}
                      disabled={busy !== null}
                    >
                      {obs.recording ? "Stopp OBS-opptak" : "Start OBS-opptak"}
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </Box>

          <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <VideocamOutlined fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Blackmagic Camera REST
              </Typography>
              {blackmagic && (
                <Chip
                  size="small"
                  color={blackmagic.recording ? "error" : "success"}
                  label={blackmagic.recording ? "REC" : "Tilkoblet"}
                />
              )}
            </Stack>
            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Kameraadresse"
                value={blackmagicUrl}
                onChange={(event) => setBlackmagicUrl(event.target.value)}
                helperText="Lokal IP eller Bonjour .local-navn fra Camera Setup"
              />
              <TextField
                size="small"
                label="Klippenavn (valgfritt)"
                value={blackmagicClipName}
                onChange={(event) => setBlackmagicClipName(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 128 } }}
              />
              <Button
                variant="outlined"
                onClick={testBlackmagic}
                disabled={busy !== null || !blackmagicUrl.trim()}
              >
                Test kamera
              </Button>
              {blackmagic && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {blackmagic.product.device_name ?? blackmagic.product.product_name ?? "Blackmagic-kamera"}
                    {blackmagic.product.software_version
                      ? ` · ${blackmagic.product.software_version}`
                      : ""}
                    {` · ${blackmagic.clip_count} klipp`}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => blackmagicRecord(!blackmagic.recording)}
                    disabled={busy !== null}
                  >
                    {blackmagic.recording ? "Stopp kameraopptak" : "Start kameraopptak"}
                  </Button>
                </>
              )}
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
