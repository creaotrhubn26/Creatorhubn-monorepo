import { useEffect, useMemo, useState } from "react";
import {
  Add as AddIcon,
  AlbumOutlined as RecordingIcon,
  ArrowBack as FullWorkspaceIcon,
  DownloadOutlined as ExportIcon,
  DeleteOutline as DeleteIcon,
  InsertDriveFileOutlined as FileIcon,
  LinkOutlined as LinkIcon,
  OpenInNewOutlined as OpenIcon,
  GraphicEqOutlined as TakesIcon,
  HeadphonesOutlined as SoundIcon,
  MicExternalOnOutlined as SetupIcon,
  SaveOutlined as SaveIcon,
  SendOutlined as HandoffIcon,
  UploadFileOutlined as UploadIcon,
  WarningAmberOutlined as WarningIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type {
  CastingProject,
  ProductionDay,
  ProductionSoundAdditionalRecording,
  ProductionSoundIssue,
  ProductionSoundMedia,
  ProductionSoundOperations,
  ProductionSoundQuality,
  ProductionSoundRecordingStatus,
  ProductionSoundRecordingType,
  ProductionSoundSourceType,
  ProductionSoundTakeReport,
  ProductionSoundTrackStatus,
} from "../../models/casting";
import {
  MOBILE_TOUCH_TARGET_SIZE,
  TOUCH_TARGET_SIZE,
  focusVisibleStyles,
} from "../../constants/accessibility";
import { useBeforeUnloadIfDirty } from "../../hooks/useBeforeUnloadIfDirty";
import {
  productionSoundService,
  ProductionSoundConflictError,
} from "../../services/productionSoundService";
import { roleTokens } from "../../theme/roleTokens";
import { useScreenTier } from "../production/useScreenTier";
import {
  PRODUCTION_SOUND_SURFACES,
  buildProductionSoundCsv,
  buildProductionSoundDayBrief,
  canonicalTakesForDay,
  createEmptyProductionSoundOperations,
  createProductionSoundId,
  mergeProductionSoundOperations,
  sceneLabel,
  upsertProductionSoundTakeReport,
  type ProductionSoundSurface,
} from "./productionSoundWorkspaceModel";

interface Props {
  project: CastingProject;
  activeSurface: ProductionSoundSurface;
  readOnly?: boolean;
  dataLoading?: boolean;
  onNavigate: (surface: ProductionSoundSurface) => void;
  onOpenContinuity: () => void;
  onOpenSchedule: () => void;
  onOpenFullWorkspace: () => void;
  onSaved?: (day: ProductionDay) => void;
}

const SURFACE_META: Record<
  ProductionSoundSurface,
  { label: string; icon: typeof SoundIcon }
> = {
  overview: { label: "Dagen", icon: SoundIcon },
  setup: { label: "Oppsett", icon: SetupIcon },
  takes: { label: "Takes", icon: TakesIcon },
  additional: { label: "Ekstraopptak", icon: RecordingIcon },
  handoff: { label: "Handoff", icon: HandoffIcon },
};
const QUALITY_LABELS: Record<ProductionSoundQuality, string> = {
  clean: "Ren",
  usable: "Brukbar",
  compromised: "Kompromittert",
  unusable: "Ubrukelig",
};
const ISSUE_LABELS: Record<ProductionSoundIssue, string> = {
  clothing_rustle: "Klesstøy",
  radio_hit: "Radiohit",
  boom_shadow: "Boomskygge",
  handling_noise: "Håndteringsstøy",
  background_noise: "Bakgrunnsstøy",
  distortion: "Forvrengning",
  sync: "Sync",
  other: "Annet",
};
const SOURCE_LABELS: Record<ProductionSoundSourceType, string> = {
  boom: "Boom",
  lav: "Lav",
  plant: "Plant",
  mix: "Mix",
  other: "Annet",
};
const TRACK_STATUS_LABELS: Record<ProductionSoundTrackStatus, string> = {
  ready: "Klar",
  active: "Aktiv",
  issue: "Problem",
  off: "Av",
};
const RECORDING_TYPE_LABELS: Record<ProductionSoundRecordingType, string> = {
  room_tone: "Room tone",
  wild_track: "Wild track",
  ambience: "Atmosfære",
  sfx: "SFX",
};
const RECORDING_STATUS_LABELS: Record<ProductionSoundRecordingStatus, string> =
  { planned: "Planlagt", recorded: "Tatt opp", delivered: "Levert" };
const FRAME_RATES = [
  "23.976",
  "24",
  "25",
  "29.97",
  "29.97DF",
  "30",
  "30DF",
  "50",
  "59.94",
  "60",
];
const panelSx = {
  bgcolor: "rgba(7,16,24,.9)",
  borderColor: "rgba(56,189,248,.2)",
  color: roleTokens.text,
};
const fieldSx = {
  "& .MuiInputBase-root": {
    color: roleTokens.text,
    bgcolor: "rgba(255,255,255,.025)",
    minHeight: TOUCH_TARGET_SIZE,
  },
  "& .MuiInputLabel-root": { color: "rgba(226,232,240,.68)" },
  "& fieldset": { borderColor: "rgba(56,189,248,.24)" },
};

function draftKey(projectId: string, dayId: string): string {
  return `role-room:production-sound:${projectId}:${dayId}`;
}

function saveDraft(
  projectId: string,
  dayId: string,
  version: number,
  operations: ProductionSoundOperations,
): void {
  try {
    localStorage.setItem(
      draftKey(projectId, dayId),
      JSON.stringify({ version, operations }),
    );
  } catch {
    /* storage is best-effort */
  }
}

function clearDraft(projectId: string, dayId: string): void {
  try {
    localStorage.removeItem(draftKey(projectId, dayId));
  } catch {
    /* storage is best-effort */
  }
}

function downloadCsv(project: CastingProject, day: ProductionDay): void {
  const blob = new Blob([`\uFEFF${buildProductionSoundCsv(project, day)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    `${project.name || "production"}-${day.date || day.id}-sound-report.csv`.replace(
      /[^a-z0-9._-]+/gi,
      "-",
    );
  link.click();
  URL.revokeObjectURL(url);
}

export function ProductionSoundWorkspace({
  project,
  activeSurface,
  readOnly = false,
  dataLoading = false,
  onNavigate,
  onOpenContinuity,
  onOpenSchedule,
  onOpenFullWorkspace,
  onSaved,
}: Props) {
  const { isMobile } = useScreenTier();
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const days = useMemo(
    () =>
      [...(project.productionDays ?? [])].sort((a, b) =>
        String(a.date ?? "").localeCompare(String(b.date ?? "")),
      ),
    [project.productionDays],
  );
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? "");
  const selectedDay =
    days.find((day) => day.id === selectedDayId) ?? days[0] ?? null;
  const [operations, setOperations] = useState<ProductionSoundOperations>(
    createEmptyProductionSoundOperations,
  );
  const [baseVersion, setBaseVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [conflictDay, setConflictDay] = useState<ProductionDay | null>(null);
  const [soundMedia, setSoundMedia] = useState<ProductionSoundMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reconcilingMediaId, setReconcilingMediaId] = useState<string | null>(
    null,
  );
  const [deleteCandidate, setDeleteCandidate] =
    useState<ProductionSoundMedia | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [reconcileTargets, setReconcileTargets] = useState<
    Record<string, string>
  >({});
  const { confirmIfDirty } = useBeforeUnloadIfDirty({
    isDirty: dirty,
    message: "Lydrapporten har ulagrede endringer. Vil du forlate den?",
  });

  useEffect(() => {
    if (!selectedDay && days[0]) setSelectedDayId(days[0].id);
  }, [days, selectedDay]);

  useEffect(() => {
    if (!selectedDay) return;
    const serverOperations = mergeProductionSoundOperations(
      selectedDay.productionSound,
    );
    const serverVersion = Number(selectedDay.soundVersion ?? 0);
    let restored = false;
    try {
      const raw = localStorage.getItem(draftKey(project.id, selectedDay.id));
      const draft = raw
        ? (JSON.parse(raw) as {
            version?: number;
            operations?: ProductionSoundOperations;
          })
        : null;
      if (!readOnly && draft?.version === serverVersion && draft.operations) {
        setOperations(mergeProductionSoundOperations(draft.operations));
        setDirty(true);
        setFeedback({
          type: "warning",
          text: "Et lokalt utkast ble gjenopprettet på denne enheten.",
        });
        restored = true;
      } else if (draft && draft.version !== serverVersion) {
        setFeedback({
          type: "warning",
          text: "Et eldre lokalt utkast finnes, men serverversjonen er nyere. Ingen data ble overskrevet.",
        });
      }
    } catch {
      /* malformed drafts are ignored */
    }
    if (!restored) {
      setOperations(serverOperations);
      setDirty(false);
    }
    setBaseVersion(serverVersion);
    setConflictDay(null);
  }, [project.id, readOnly, selectedDay]);

  const activeDayId = selectedDay?.id;
  useEffect(() => {
    if (!activeDayId) return undefined;
    let active = true;
    setMediaLoading(true);
    productionSoundService
      .listMedia(project.id, activeDayId)
      .then((media) => {
        if (!active) return;
        setSoundMedia(media);
        setReconcileTargets((current) => ({
          ...current,
          ...Object.fromEntries(
            media.flatMap((item) =>
              item.continuityTakeId ? [[item.id, item.continuityTakeId]] : [],
            ),
          ),
        }));
      })
      .catch((error) => {
        if (active)
          setFeedback({
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Kunne ikke hente recorderfiler.",
          });
      })
      .finally(() => {
        if (active) setMediaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [project.id, activeDayId]);

  const brief = useMemo(
    () =>
      selectedDay
        ? buildProductionSoundDayBrief(project, {
            ...selectedDay,
            productionSound: operations,
          })
        : null,
    [operations, project, selectedDay],
  );
  const takes = useMemo(() => canonicalTakesForDay(selectedDay), [selectedDay]);
  const reportByTake = useMemo(
    () =>
      new Map(
        operations.takeReports.map((report) => [
          report.continuityTakeId,
          report,
        ]),
      ),
    [operations.takeReports],
  );
  const unmatchedMedia = useMemo(
    () =>
      soundMedia.filter((media) => media.reconciliationStatus === "unmatched"),
    [soundMedia],
  );
  const unresolvedFileCount =
    unmatchedMedia.length + operations.unmatchedRecordings.length;

  const update = (
    updater: (current: ProductionSoundOperations) => ProductionSoundOperations,
  ) => {
    if (readOnly || !selectedDay) return;
    setOperations((current) => {
      const next = updater(current);
      saveDraft(project.id, selectedDay.id, baseVersion, next);
      return next;
    });
    setDirty(true);
    setConflictDay(null);
    setFeedback(null);
  };

  const selectDay = (dayId: string) => {
    if (dayId === selectedDay?.id || !confirmIfDirty()) return;
    setSelectedDayId(dayId);
  };

  const save = async () => {
    if (!selectedDay || readOnly || saving || !dirty) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await productionSoundService.save(
        project.id,
        selectedDay.id,
        baseVersion,
        operations,
      );
      clearDraft(project.id, selectedDay.id);
      setOperations(mergeProductionSoundOperations(updated.productionSound));
      setBaseVersion(Number(updated.soundVersion ?? baseVersion + 1));
      setDirty(false);
      setConflictDay(null);
      setFeedback({
        type: "success",
        text: `Lydrapporten er synkronisert som versjon ${updated.soundVersion ?? baseVersion + 1}.`,
      });
      onSaved?.(updated);
    } catch (error) {
      if (error instanceof ProductionSoundConflictError) {
        setConflictDay(error.productionDay);
        setFeedback({ type: "warning", text: error.message });
      } else {
        setFeedback({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Kunne ikke lagre lydrapporten.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const loadServerVersion = () => {
    if (!selectedDay || !conflictDay) return;
    clearDraft(project.id, selectedDay.id);
    setOperations(mergeProductionSoundOperations(conflictDay.productionSound));
    setBaseVersion(Number(conflictDay.soundVersion ?? 0));
    setDirty(false);
    setConflictDay(null);
    setFeedback({ type: "success", text: "Serverversjonen er lastet." });
    onSaved?.(conflictDay);
  };

  const updateTakeReport = (
    takeId: string,
    patch: Partial<ProductionSoundTakeReport>,
  ) => {
    const existing = reportByTake.get(takeId) ?? {
      id: createProductionSoundId("take-report"),
      continuityTakeId: takeId,
      trackIds: [],
      quality: "usable" as const,
      issueTags: [],
      needsAdr: false,
    };
    update((current) =>
      upsertProductionSoundTakeReport(current, {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    );
  };

  const addTrack = () =>
    update((current) => ({
      ...current,
      tracks: [
        ...current.tracks,
        {
          id: createProductionSoundId("track"),
          trackName: `Track ${current.tracks.length + 1}`,
          sourceType: "boom",
          status: "ready",
        },
      ],
    }));

  const addAdditional = (type: ProductionSoundRecordingType) =>
    update((current) => ({
      ...current,
      additionalRecordings: [
        ...current.additionalRecordings,
        {
          id: createProductionSoundId("recording"),
          type,
          name: RECORDING_TYPE_LABELS[type],
          status: "planned",
          sceneId: selectedDay?.scenes?.[0],
        },
      ],
    }));

  const suggestedTakeId = (media: ProductionSoundMedia): string | undefined => {
    const rawTake = media.recorderMetadata.ixml?.take?.trim();
    const rawScene = media.recorderMetadata.ixml?.scene
      ?.trim()
      .toLocaleLowerCase("nb-NO");
    if (!rawTake || !/^\d+$/.test(rawTake) || !rawScene) return undefined;
    const takeNumber = Number(rawTake);
    const matches = takes.filter(
      (take) =>
        take.takeNumber === takeNumber &&
        String(take.slate ?? "")
          .trim()
          .toLocaleLowerCase("nb-NO") === rawScene,
    );
    return matches.length === 1 ? matches[0].id : undefined;
  };

  const uploadRecorderFile = async (file: File) => {
    if (!selectedDay || readOnly || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    setFeedback(null);
    try {
      const media = await productionSoundService.uploadRecorderFile(
        project.id,
        selectedDay.id,
        file,
        setUploadProgress,
      );
      setSoundMedia((current) => [
        media,
        ...current.filter((item) => item.id !== media.id),
      ]);
      const suggestion = suggestedTakeId(media);
      if (suggestion)
        setReconcileTargets((current) => ({
          ...current,
          [media.id]: suggestion,
        }));
      setFeedback({
        type:
          media.recorderMetadata.warnings.length > 0 ? "warning" : "success",
        text:
          media.recorderMetadata.warnings.length > 0
            ? `${media.displayName} er lastet opp. Kontroller metadataadvarslene før avstemming.`
            : `${media.displayName} er analysert og klar for eksplisitt avstemming.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kunne ikke laste opp recorderfilen.",
      });
    } finally {
      setUploading(false);
    }
  };

  const reconcileMedia = async (
    media: ProductionSoundMedia,
    target: string | null,
  ) => {
    if (!selectedDay || readOnly || reconcilingMediaId) return;
    if (dirty) {
      setFeedback({
        type: "warning",
        text: "Lagre det lokale utkastet før recorderfilen avstemmes.",
      });
      return;
    }
    if (target !== null && !target) {
      setFeedback({
        type: "warning",
        text: "Velg en continuity-take før du kobler filen.",
      });
      return;
    }
    setReconcilingMediaId(media.id);
    setFeedback(null);
    try {
      const result = await productionSoundService.reconcileMedia(
        project.id,
        selectedDay.id,
        media.id,
        baseVersion,
        target,
      );
      setOperations(
        mergeProductionSoundOperations(result.productionDay.productionSound),
      );
      setBaseVersion(
        Number(result.productionDay.soundVersion ?? baseVersion + 1),
      );
      setSoundMedia((current) =>
        current.map((item) =>
          item.id === result.media.id ? result.media : item,
        ),
      );
      setReconcileTargets((current) => ({
        ...current,
        [media.id]: result.media.continuityTakeId ?? "",
      }));
      setFeedback({
        type: "success",
        text: target
          ? `${media.displayName} er koblet til continuity-taken.`
          : `Take-koblingen er fjernet fra ${media.displayName}.`,
      });
      onSaved?.(result.productionDay);
    } catch (error) {
      if (error instanceof ProductionSoundConflictError) {
        setConflictDay(error.productionDay);
        setFeedback({ type: "warning", text: error.message });
      } else {
        setFeedback({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Kunne ikke avstemme recorderfilen.",
        });
      }
    } finally {
      setReconcilingMediaId(null);
    }
  };

  const openMedia = async (media: ProductionSoundMedia) => {
    if (!selectedDay) return;
    try {
      const url = await productionSoundService.getMediaUrl(
        project.id,
        selectedDay.id,
        media.id,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error ? error.message : "Kunne ikke åpne lydfilen.",
      });
    }
  };

  const requestDeleteRecorderMedia = (media: ProductionSoundMedia) => {
    if (media.reconciliationStatus === "matched") {
      setFeedback({
        type: "warning",
        text: "Fjern koblingen til continuity-taken før recorderfilen slettes.",
      });
      return;
    }
    setDeleteCandidate(media);
  };

  const deleteRecorderMedia = async () => {
    if (!selectedDay || !deleteCandidate || readOnly || deletingMediaId) return;
    if (deleteCandidate.reconciliationStatus === "matched") {
      setFeedback({
        type: "warning",
        text: "Fjern koblingen til continuity-taken før recorderfilen slettes.",
      });
      setDeleteCandidate(null);
      return;
    }
    setDeletingMediaId(deleteCandidate.id);
    setFeedback(null);
    try {
      await productionSoundService.deleteMedia(
        project.id,
        selectedDay.id,
        deleteCandidate.id,
      );
      setSoundMedia((current) =>
        current.filter((item) => item.id !== deleteCandidate.id),
      );
      setReconcileTargets((current) => {
        const next = { ...current };
        delete next[deleteCandidate.id];
        return next;
      });
      setFeedback({
        type: "success",
        text: `${deleteCandidate.displayName} er slettet permanent fra privat lagring.`,
      });
      setDeleteCandidate(null);
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Recorderfilen kunne ikke slettes.",
      });
    } finally {
      setDeletingMediaId(null);
    }
  };

  if (dataLoading)
    return (
      <Box
        data-testid="production-sound-loading"
        sx={{
          minHeight: "100%",
          display: "grid",
          placeItems: "center",
          bgcolor: "#071018",
          color: roleTokens.text,
        }}
      >
        <CircularProgress aria-label="Laster lyddata" />
      </Box>
    );

  if (!selectedDay)
    return (
      <Box
        data-testid="production-sound-empty"
        sx={{
          minHeight: "100%",
          p: 3,
          bgcolor: "#071018",
          color: roleTokens.text,
        }}
      >
        <Alert severity="info">
          Ingen produksjonsdager finnes ennå. Opprett en produksjonsdag før
          lydoppsettet planlegges.
        </Alert>
        <Button
          sx={{ mt: 2, minHeight: targetSize }}
          variant="outlined"
          onClick={onOpenSchedule}
        >
          Åpne opptaksplan
        </Button>
      </Box>
    );

  const renderOverview = () => (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2,minmax(0,1fr))",
            md: "repeat(4,minmax(0,1fr))",
          },
          gap: 1,
        }}
      >
        {[
          {
            label: "Takes rapportert",
            value: `${brief?.reportedTakeCount ?? 0}/${brief?.takeCount ?? 0}`,
          },
          { label: "Lydproblemer", value: brief?.compromisedTakeCount ?? 0 },
          { label: "ADR-flagg", value: brief?.adrTakeCount ?? 0 },
          { label: "Uavstemte filer", value: unresolvedFileCount },
        ].map((metric) => (
          <Card key={metric.label} variant="outlined" sx={panelSx}>
            <CardContent sx={{ p: 1.5 }}>
              <Typography
                sx={{
                  fontSize: { xs: "1.35rem", md: "1.8rem" },
                  fontWeight: 820,
                }}
              >
                {metric.value}
              </Typography>
              <Typography
                sx={{ color: roleTokens.textMuted, fontSize: ".74rem" }}
              >
                {metric.label}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Card variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 780 }}>
            Neste kritiske handlinger
          </Typography>
          <Stack spacing={1} sx={{ mt: 1.25 }}>
            {takes.length === 0 ? (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={onOpenContinuity}
                  >
                    Åpne continuity
                  </Button>
                }
              >
                Ingen kanoniske takes er registrert. Lyd kan klargjøre oppsett
                og ekstraopptak, mens take-ID opprettes i continuity-loggen.
              </Alert>
            ) : null}
            {(brief?.missingRoomToneSceneCount ?? 0) > 0 ? (
              <Alert severity="warning">
                {brief?.missingRoomToneSceneCount} scener mangler registrert
                room tone.
              </Alert>
            ) : null}
            {unresolvedFileCount > 0 ? (
              <Alert severity="warning">
                {unresolvedFileCount} recorderfiler venter på avstemming. De er
                ikke behandlet som takes.
              </Alert>
            ) : null}
            {brief?.handoffReady ? (
              <Alert severity="success">
                Dagens lydrapport er klar for review og eksport.
              </Alert>
            ) : (
              <Alert severity="info">
                Handoff står som utkast. Kontroller take-dekning og ekstraopptak
                før review.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
          gap: 1,
        }}
      >
        {days.map((day) => {
          const dayBrief = buildProductionSoundDayBrief(
            project,
            day.id === selectedDay.id
              ? { ...day, productionSound: operations }
              : day,
          );
          const dayUnresolved =
            day.id === selectedDay.id
              ? unresolvedFileCount
              : dayBrief.unresolvedFileCount;
          return (
            <Card
              key={day.id}
              variant="outlined"
              sx={{
                ...panelSx,
                borderColor:
                  day.id === selectedDay.id
                    ? "rgba(56,189,248,.58)"
                    : panelSx.borderColor,
              }}
            >
              <CardActionArea
                onClick={() => selectDay(day.id)}
                sx={{ minHeight: targetSize, ...focusVisibleStyles }}
              >
                <CardContent>
                  <Typography sx={{ fontWeight: 760 }}>
                    {dayBrief.label}
                  </Typography>
                  <Typography
                    sx={{
                      color: roleTokens.textMuted,
                      fontSize: ".73rem",
                      mt: 0.35,
                    }}
                  >
                    {dayBrief.sceneCount} scener · {dayBrief.reportedTakeCount}/
                    {dayBrief.takeCount} takes · {dayUnresolved} uavstemte
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Stack>
  );

  const renderSetup = () => (
    <Stack spacing={1.5}>
      <Card variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 780, mb: 1.5 }}>
            Recorder, sync og akustisk plan
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2,minmax(0,1fr))",
                lg: "repeat(4,minmax(0,1fr))",
              },
              gap: 1,
            }}
          >
            <TextField
              label="Recorder"
              value={operations.setup.recorder ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  setup: { ...current.setup, recorder: event.target.value },
                }))
              }
              disabled={readOnly}
              inputProps={{ maxLength: 160 }}
              sx={fieldSx}
            />
            <TextField
              label="Sound roll"
              value={operations.setup.soundRoll ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  setup: { ...current.setup, soundRoll: event.target.value },
                }))
              }
              disabled={readOnly}
              inputProps={{ maxLength: 80 }}
              sx={fieldSx}
            />
            <FormControl sx={fieldSx} disabled={readOnly}>
              <InputLabel id="sound-sample-rate-label">Sample rate</InputLabel>
              <Select
                id="sound-sample-rate"
                labelId="sound-sample-rate-label"
                label="Sample rate"
                value={operations.setup.sampleRate}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    setup: {
                      ...current.setup,
                      sampleRate: Number(event.target.value) as 48000 | 96000,
                    },
                  }))
                }
              >
                <MenuItem value={48000}>48 kHz</MenuItem>
                <MenuItem value={96000}>96 kHz</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={fieldSx} disabled={readOnly}>
              <InputLabel id="sound-bit-depth-label">Bit depth</InputLabel>
              <Select
                id="sound-bit-depth"
                labelId="sound-bit-depth-label"
                label="Bit depth"
                value={operations.setup.bitDepth}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    setup: {
                      ...current.setup,
                      bitDepth: Number(event.target.value) as 24 | 32,
                    },
                  }))
                }
              >
                <MenuItem value={24}>24-bit</MenuItem>
                <MenuItem value={32}>32-bit float</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={fieldSx} disabled={readOnly}>
              <InputLabel id="sound-frame-rate-label">Frame rate</InputLabel>
              <Select
                id="sound-frame-rate"
                labelId="sound-frame-rate-label"
                label="Frame rate"
                value={operations.setup.frameRate ?? ""}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    setup: {
                      ...current.setup,
                      frameRate: event.target.value || undefined,
                    },
                  }))
                }
              >
                <MenuItem value="">
                  <em>Ikke satt</em>
                </MenuItem>
                {FRAME_RATES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={fieldSx} disabled={readOnly}>
              <InputLabel id="sound-timecode-mode-label">Timecode</InputLabel>
              <Select
                id="sound-timecode-mode"
                labelId="sound-timecode-mode-label"
                label="Timecode"
                value={operations.setup.timecodeMode}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    setup: {
                      ...current.setup,
                      timecodeMode: event.target
                        .value as ProductionSoundOperations["setup"]["timecodeMode"],
                    },
                  }))
                }
              >
                <MenuItem value="free_run">Free run</MenuItem>
                <MenuItem value="record_run">Record run</MenuItem>
                <MenuItem value="external">Ekstern master</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Timecode-kilde"
              value={operations.setup.timecodeSource ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  setup: {
                    ...current.setup,
                    timecodeSource: event.target.value,
                  },
                }))
              }
              disabled={readOnly}
              inputProps={{ maxLength: 160 }}
              sx={fieldSx}
            />
            <FormControl sx={fieldSx} disabled={readOnly}>
              <InputLabel id="sound-day-status-label">Dagsstatus</InputLabel>
              <Select
                id="sound-day-status"
                labelId="sound-day-status-label"
                label="Dagsstatus"
                value={operations.dayStatus}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    dayStatus: event.target
                      .value as ProductionSoundOperations["dayStatus"],
                  }))
                }
              >
                <MenuItem value="setup">Rigging</MenuItem>
                <MenuItem value="recording">Opptak</MenuItem>
                <MenuItem value="wrapped">Wrapped</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" },
              gap: 1,
              mt: 1,
            }}
          >
            <TextField
              label="Akustiske risikoer"
              value={operations.setup.acousticRisks ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  setup: {
                    ...current.setup,
                    acousticRisks: event.target.value,
                  },
                }))
              }
              disabled={readOnly}
              multiline
              minRows={3}
              inputProps={{ maxLength: 5000 }}
              sx={fieldSx}
            />
            <TextField
              label="Opptaksplan / avtaler med andre avdelinger"
              value={operations.setup.planNotes ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  setup: { ...current.setup, planNotes: event.target.value },
                }))
              }
              disabled={readOnly}
              multiline
              minRows={3}
              inputProps={{ maxLength: 5000 }}
              sx={fieldSx}
            />
          </Box>
        </CardContent>
      </Card>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box>
          <Typography component="h2" sx={{ fontWeight: 780 }}>
            Spor og kilder
          </Typography>
          <Typography sx={{ color: roleTokens.textMuted, fontSize: ".74rem" }}>
            Navnene følger lydrapporten videre til post.
          </Typography>
        </Box>
        {!readOnly ? (
          <Button
            startIcon={<AddIcon />}
            onClick={addTrack}
            variant="outlined"
            sx={{
              minHeight: targetSize,
              color: "#7dd3fc",
              borderColor: "rgba(56,189,248,.38)",
            }}
          >
            Legg til spor
          </Button>
        ) : null}
      </Box>
      {operations.tracks.length === 0 ? (
        <Alert severity="info">
          Ingen spor er definert. Legg inn mix, boom, lav eller plant før
          opptak.
        </Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2,minmax(0,1fr))" },
            gap: 1,
          }}
        >
          {operations.tracks.map((track) => (
            <Card key={track.id} variant="outlined" sx={panelSx}>
              <CardContent sx={{ p: 1.5 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "minmax(0,1fr) 120px 120px",
                    },
                    gap: 1,
                  }}
                >
                  <TextField
                    label="Spornavn"
                    value={track.trackName}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        tracks: current.tracks.map((item) =>
                          item.id === track.id
                            ? { ...item, trackName: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    disabled={readOnly}
                    inputProps={{ maxLength: 80 }}
                    size="small"
                    sx={fieldSx}
                  />
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}>
                    <InputLabel id={`sound-track-source-${track.id}-label`}>
                      Kilde
                    </InputLabel>
                    <Select
                      id={`sound-track-source-${track.id}`}
                      labelId={`sound-track-source-${track.id}-label`}
                      label="Kilde"
                      value={track.sourceType}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          tracks: current.tracks.map((item) =>
                            item.id === track.id
                              ? {
                                  ...item,
                                  sourceType: event.target
                                    .value as ProductionSoundSourceType,
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}>
                    <InputLabel id={`sound-track-status-${track.id}-label`}>
                      Status
                    </InputLabel>
                    <Select
                      id={`sound-track-status-${track.id}`}
                      labelId={`sound-track-status-${track.id}-label`}
                      label="Status"
                      value={track.status}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          tracks: current.tracks.map((item) =>
                            item.id === track.id
                              ? {
                                  ...item,
                                  status: event.target
                                    .value as ProductionSoundTrackStatus,
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      {Object.entries(TRACK_STATUS_LABELS).map(
                        ([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(3,minmax(0,1fr))",
                    },
                    gap: 1,
                    mt: 1,
                  }}
                >
                  <TextField
                    label="Person / kilde"
                    value={track.subject ?? ""}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        tracks: current.tracks.map((item) =>
                          item.id === track.id
                            ? { ...item, subject: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    disabled={readOnly}
                    size="small"
                    sx={fieldSx}
                  />
                  <TextField
                    label="Kanal / sender"
                    value={track.channel ?? ""}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        tracks: current.tracks.map((item) =>
                          item.id === track.id
                            ? { ...item, channel: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    disabled={readOnly}
                    size="small"
                    sx={fieldSx}
                  />
                  <TextField
                    label="Frekvens"
                    value={track.frequency ?? ""}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        tracks: current.tracks.map((item) =>
                          item.id === track.id
                            ? { ...item, frequency: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    disabled={readOnly}
                    size="small"
                    sx={fieldSx}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Stack>
  );

  const renderTakes = () =>
    takes.length === 0 ? (
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" onClick={onOpenContinuity}>
            Åpne continuity
          </Button>
        }
      >
        Take-listen er tom. Oppsett og room tone kan forberedes nå;
        take-rapportering starter når continuity har opprettet take-ID-er.
      </Alert>
    ) : (
      <Stack spacing={1}>
        {takes.map((take) => {
          const report = reportByTake.get(take.id);
          const linkedMedia = soundMedia.filter(
            (media) => media.continuityTakeId === take.id,
          );
          return (
            <Card
              key={take.id}
              variant="outlined"
              sx={{
                ...panelSx,
                borderColor:
                  report?.quality === "unusable"
                    ? "rgba(248,113,113,.45)"
                    : panelSx.borderColor,
              }}
            >
              <CardContent sx={{ p: { xs: 1.25, sm: 1.75 } }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Chip
                        label={`${sceneLabel(project, take.sceneId)} · Take ${take.takeNumber}`}
                        size="small"
                        sx={{
                          color: "#bae6fd",
                          bgcolor: "rgba(14,165,233,.12)",
                        }}
                      />
                      {take.circled ? (
                        <Chip
                          label="Sirklet"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : null}
                      <Chip
                        label={
                          take.soundRoll ||
                          operations.setup.soundRoll ||
                          "Ingen sound roll"
                        }
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography
                      sx={{
                        color: roleTokens.textMuted,
                        fontSize: ".7rem",
                        mt: 0.6,
                      }}
                    >
                      {[
                        take.slate,
                        take.timecodeStart,
                        take.durationSeconds !== undefined
                          ? `${take.durationSeconds}s`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Ingen slate/timecode fra continuity"}
                    </Typography>
                  </Box>
                  <FormControl
                    size="small"
                    sx={{ ...fieldSx, minWidth: 170 }}
                    disabled={readOnly}
                  >
                    <InputLabel id={`sound-take-quality-${take.id}-label`}>
                      Lydkvalitet
                    </InputLabel>
                    <Select
                      id={`sound-take-quality-${take.id}`}
                      labelId={`sound-take-quality-${take.id}-label`}
                      label="Lydkvalitet"
                      value={report?.quality ?? "usable"}
                      onChange={(event) =>
                        updateTakeReport(take.id, {
                          quality: event.target.value as ProductionSoundQuality,
                        })
                      }
                    >
                      {Object.entries(QUALITY_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                {linkedMedia.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={0.65}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 1 }}
                  >
                    {linkedMedia.map((media) => (
                      <Chip
                        key={media.id}
                        icon={<FileIcon />}
                        label={media.displayName}
                        onClick={() => void openMedia(media)}
                        clickable
                        variant="outlined"
                        sx={{
                          minHeight: TOUCH_TARGET_SIZE,
                          color: "#bae6fd",
                          borderColor: "rgba(56,189,248,.3)",
                        }}
                      />
                    ))}
                  </Stack>
                ) : null}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "220px minmax(0,1fr)",
                    },
                    gap: 1,
                    mt: 1,
                  }}
                >
                  <TextField
                    label="Lydfil"
                    value={report?.fileName ?? ""}
                    onChange={(event) =>
                      updateTakeReport(take.id, {
                        fileName: event.target.value,
                      })
                    }
                    disabled={readOnly}
                    size="small"
                    inputProps={{ maxLength: 255 }}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Lydnotat til post"
                    value={report?.notes ?? ""}
                    onChange={(event) =>
                      updateTakeReport(take.id, { notes: event.target.value })
                    }
                    disabled={readOnly}
                    size="small"
                    multiline
                    maxRows={4}
                    inputProps={{ maxLength: 5000 }}
                    sx={fieldSx}
                  />
                </Box>
                <Stack
                  direction="row"
                  spacing={0.5}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mt: 1 }}
                >
                  {Object.entries(ISSUE_LABELS).map(([value, label]) => {
                    const checked =
                      report?.issueTags.includes(
                        value as ProductionSoundIssue,
                      ) ?? false;
                    return (
                      <Chip
                        key={value}
                        label={label}
                        clickable={!readOnly}
                        variant={checked ? "filled" : "outlined"}
                        onClick={
                          readOnly
                            ? undefined
                            : () =>
                                updateTakeReport(take.id, {
                                  issueTags: checked
                                    ? (report?.issueTags ?? []).filter(
                                        (tag) => tag !== value,
                                      )
                                    : [
                                        ...(report?.issueTags ?? []),
                                        value as ProductionSoundIssue,
                                      ],
                                })
                        }
                        sx={{
                          minHeight: TOUCH_TARGET_SIZE,
                          color: checked ? "#fecaca" : roleTokens.textMuted,
                          bgcolor: checked
                            ? "rgba(239,68,68,.12)"
                            : "transparent",
                        }}
                      />
                    );
                  })}
                </Stack>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 1,
                    mt: 0.75,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={report?.needsAdr ?? false}
                        onChange={(event) =>
                          updateTakeReport(take.id, {
                            needsAdr: event.target.checked,
                          })
                        }
                        disabled={readOnly}
                      />
                    }
                    label="Foreslå ADR"
                  />
                  <FormControl
                    size="small"
                    sx={{ ...fieldSx, minWidth: 220 }}
                    disabled={readOnly}
                  >
                    <InputLabel id={`sound-take-tracks-${take.id}-label`}>
                      Spor i opptaket
                    </InputLabel>
                    <Select
                      id={`sound-take-tracks-${take.id}`}
                      labelId={`sound-take-tracks-${take.id}-label`}
                      multiple
                      label="Spor i opptaket"
                      value={report?.trackIds ?? []}
                      renderValue={(ids) =>
                        ids
                          .map(
                            (id) =>
                              operations.tracks.find((track) => track.id === id)
                                ?.trackName ?? id,
                          )
                          .join(", ")
                      }
                      onChange={(event) =>
                        updateTakeReport(take.id, {
                          trackIds:
                            typeof event.target.value === "string"
                              ? event.target.value.split(",")
                              : event.target.value,
                        })
                      }
                    >
                      {operations.tracks.map((track) => (
                        <MenuItem key={track.id} value={track.id}>
                          <Checkbox
                            checked={
                              report?.trackIds.includes(track.id) ?? false
                            }
                          />
                          {track.trackName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    );

  const updateAdditional = (
    recording: ProductionSoundAdditionalRecording,
    patch: Partial<ProductionSoundAdditionalRecording>,
  ) =>
    update((current) => ({
      ...current,
      additionalRecordings: current.additionalRecordings.map((item) =>
        item.id === recording.id
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  const renderAdditional = () => (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box>
          <Typography component="h2" sx={{ fontWeight: 780 }}>
            Room tone, wild tracks og atmosfære
          </Typography>
          <Typography sx={{ color: roleTokens.textMuted, fontSize: ".74rem" }}>
            Separate opptak beholdes tydelig adskilt fra kanoniske takes.
          </Typography>
        </Box>
        {!readOnly ? (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {(["room_tone", "wild_track", "ambience"] as const).map((type) => (
              <Button
                key={type}
                variant="outlined"
                onClick={() => addAdditional(type)}
                sx={{
                  minHeight: targetSize,
                  color: "#7dd3fc",
                  borderColor: "rgba(56,189,248,.35)",
                }}
              >
                {RECORDING_TYPE_LABELS[type]}
              </Button>
            ))}
          </Stack>
        ) : null}
      </Box>
      {operations.additionalRecordings.length === 0 ? (
        <Alert severity="info">
          Ingen ekstraopptak er planlagt. Legg minst inn room tone per relevant
          scene.
        </Alert>
      ) : (
        <Stack spacing={1}>
          {operations.additionalRecordings.map((recording) => (
            <Card key={recording.id} variant="outlined" sx={panelSx}>
              <CardContent sx={{ p: 1.5 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "150px minmax(0,1fr) 180px 150px",
                    },
                    gap: 1,
                  }}
                >
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}>
                    <InputLabel
                      id={`sound-recording-type-${recording.id}-label`}
                    >
                      Type
                    </InputLabel>
                    <Select
                      id={`sound-recording-type-${recording.id}`}
                      labelId={`sound-recording-type-${recording.id}-label`}
                      label="Type"
                      value={recording.type}
                      onChange={(event) =>
                        updateAdditional(recording, {
                          type: event.target
                            .value as ProductionSoundRecordingType,
                        })
                      }
                    >
                      {Object.entries(RECORDING_TYPE_LABELS).map(
                        ([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Beskrivelse"
                    value={recording.name}
                    onChange={(event) =>
                      updateAdditional(recording, { name: event.target.value })
                    }
                    disabled={readOnly}
                    size="small"
                    sx={fieldSx}
                  />
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}>
                    <InputLabel
                      id={`sound-recording-scene-${recording.id}-label`}
                    >
                      Scene
                    </InputLabel>
                    <Select
                      id={`sound-recording-scene-${recording.id}`}
                      labelId={`sound-recording-scene-${recording.id}-label`}
                      label="Scene"
                      value={recording.sceneId ?? ""}
                      onChange={(event) =>
                        updateAdditional(recording, {
                          sceneId: event.target.value || undefined,
                        })
                      }
                    >
                      <MenuItem value="">
                        <em>Hele dagen</em>
                      </MenuItem>
                      {selectedDay.scenes.map((sceneId) => (
                        <MenuItem key={sceneId} value={sceneId}>
                          {sceneLabel(project, sceneId)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}>
                    <InputLabel
                      id={`sound-recording-status-${recording.id}-label`}
                    >
                      Status
                    </InputLabel>
                    <Select
                      id={`sound-recording-status-${recording.id}`}
                      labelId={`sound-recording-status-${recording.id}-label`}
                      label="Status"
                      value={recording.status}
                      onChange={(event) =>
                        updateAdditional(recording, {
                          status: event.target
                            .value as ProductionSoundRecordingStatus,
                        })
                      }
                    >
                      {Object.entries(RECORDING_STATUS_LABELS).map(
                        ([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "220px 160px minmax(0,1fr)",
                    },
                    gap: 1,
                    mt: 1,
                  }}
                >
                  <TextField
                    label="Filnavn"
                    value={recording.fileName ?? ""}
                    onChange={(event) =>
                      updateAdditional(recording, {
                        fileName: event.target.value,
                      })
                    }
                    disabled={readOnly}
                    size="small"
                    sx={fieldSx}
                  />
                  <TextField
                    label="Varighet (sek)"
                    type="number"
                    value={recording.durationSeconds ?? ""}
                    onChange={(event) =>
                      updateAdditional(recording, {
                        durationSeconds:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                    disabled={readOnly}
                    size="small"
                    inputProps={{ min: 0, max: 86400 }}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Notat"
                    value={recording.notes ?? ""}
                    onChange={(event) =>
                      updateAdditional(recording, { notes: event.target.value })
                    }
                    disabled={readOnly}
                    size="small"
                    sx={fieldSx}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <Card variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box>
              <Typography component="h2" sx={{ fontWeight: 780 }}>
                BWF/iXML-import
              </Typography>
              <Typography
                sx={{
                  color: roleTokens.textMuted,
                  fontSize: ".74rem",
                  mt: 0.25,
                }}
              >
                Filen går direkte til privat Role Room-S3. SHA-256,
                WAVE-struktur, bext og iXML kontrolleres før den blir
                tilgjengelig.
              </Typography>
            </Box>
            {!readOnly ? (
              <Button
                component="label"
                variant="contained"
                startIcon={
                  uploading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <UploadIcon />
                  )
                }
                disabled={uploading}
                sx={{
                  minHeight: targetSize,
                  bgcolor: "#0284c7",
                  "&:hover": { bgcolor: "#0369a1" },
                }}
              >
                {uploading
                  ? `Laster opp ${uploadProgress}%`
                  : "Importer BWF/WAV"}
                <input
                  hidden
                  type="file"
                  accept=".wav,.wave,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadRecorderFile(file);
                  }}
                />
              </Button>
            ) : null}
          </Box>
          {uploading ? (
            <Box sx={{ mt: 1.5 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography
                sx={{ color: roleTokens.textMuted, fontSize: ".7rem", mt: 0.5 }}
              >
                {uploadProgress < 10
                  ? "Beregner checksum lokalt"
                  : uploadProgress < 96
                    ? "Direkte S3-opplasting"
                    : "Verifiserer BWF/iXML på server"}
              </Typography>
            </Box>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 780 }}>
            Recorderfiler og avstemming
          </Typography>
          <Typography
            sx={{ color: roleTokens.textMuted, fontSize: ".74rem", mt: 0.25 }}
          >
            Metadata kan foreslå en take, men koblingen utføres bare når du
            bekrefter. Ingen recorderfil oppretter en ny take-identitet.
          </Typography>
          {mediaLoading ? (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 96 }}>
              <CircularProgress size={24} aria-label="Laster recorderfiler" />
            </Box>
          ) : soundMedia.length === 0 &&
            operations.unmatchedRecordings.length === 0 ? (
            <Typography sx={{ color: "#86efac", fontSize: ".78rem", mt: 1.25 }}>
              Ingen recorderfiler er importert.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1.25 }}>
              {soundMedia.map((media) => {
                const metadata = media.recorderMetadata;
                const suggestion = suggestedTakeId(media);
                const target =
                  reconcileTargets[media.id] ??
                  suggestion ??
                  media.continuityTakeId ??
                  "";
                const linkedTake = takes.find(
                  (take) => take.id === media.continuityTakeId,
                );
                return (
                  <Box
                    key={media.id}
                    data-testid={`production-sound-media-${media.id}`}
                    sx={{
                      p: { xs: 1.1, sm: 1.4 },
                      borderRadius: 1.5,
                      border: `1px solid ${media.reconciliationStatus === "matched" ? "rgba(34,197,94,.26)" : "rgba(251,191,36,.24)"}`,
                      bgcolor:
                        media.reconciliationStatus === "matched"
                          ? "rgba(34,197,94,.045)"
                          : "rgba(251,191,36,.045)",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        justifyContent: "space-between",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={0.65}
                          useFlexGap
                          flexWrap="wrap"
                          alignItems="center"
                        >
                          <FileIcon sx={{ fontSize: 18, color: "#7dd3fc" }} />
                          <Typography
                            sx={{ fontWeight: 760, overflowWrap: "anywhere" }}
                          >
                            {media.displayName}
                          </Typography>
                          <Chip
                            size="small"
                            label={
                              media.reconciliationStatus === "matched"
                                ? "Avstemt"
                                : "Venter"
                            }
                            color={
                              media.reconciliationStatus === "matched"
                                ? "success"
                                : "warning"
                            }
                            variant="outlined"
                          />
                          {suggestion &&
                          media.reconciliationStatus === "unmatched" ? (
                            <Chip
                              size="small"
                              label="Eksakt metadataforslag"
                              sx={{ color: "#bae6fd" }}
                            />
                          ) : null}
                        </Stack>
                        <Typography
                          sx={{
                            color: roleTokens.textMuted,
                            fontSize: ".72rem",
                            mt: 0.55,
                          }}
                        >
                          {[
                            metadata.ixml?.scene
                              ? `Scene ${metadata.ixml.scene}`
                              : undefined,
                            metadata.ixml?.take
                              ? `Take ${metadata.ixml.take}`
                              : undefined,
                            metadata.ixml?.tape
                              ? `Roll ${metadata.ixml.tape}`
                              : undefined,
                            metadata.timecodeStart,
                            metadata.durationSeconds !== undefined
                              ? `${metadata.durationSeconds}s`
                              : undefined,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Ingen scene/take-metadata i filen"}
                        </Typography>
                        <Typography
                          sx={{
                            color: roleTokens.textMuted,
                            fontSize: ".68rem",
                            mt: 0.35,
                          }}
                        >
                          {metadata.sampleRate / 1000} kHz · {metadata.bitDepth}
                          -bit · {metadata.channels} kanaler ·{" "}
                          {(media.sizeBytes / 1024 / 1024).toFixed(1)} MB
                        </Typography>
                        {linkedTake ? (
                          <Typography
                            sx={{
                              color: "#86efac",
                              fontSize: ".72rem",
                              mt: 0.45,
                            }}
                          >
                            Koblet til {sceneLabel(project, linkedTake.sceneId)}{" "}
                            · Take {linkedTake.takeNumber}
                          </Typography>
                        ) : null}
                        {metadata.warnings.map((warning) => (
                          <Typography
                            key={warning}
                            sx={{
                              color: "#fcd34d",
                              fontSize: ".68rem",
                              mt: 0.35,
                            }}
                          >
                            {warning}
                          </Typography>
                        ))}
                      </Box>
                      <Stack
                        direction={{ xs: "row", md: "column" }}
                        spacing={0.5}
                        alignItems={{ md: "stretch" }}
                      >
                        <Button
                          variant="text"
                          startIcon={<OpenIcon />}
                          onClick={() => void openMedia(media)}
                          sx={{
                            minHeight: targetSize,
                            color: "#7dd3fc",
                          }}
                        >
                          Åpne fil
                        </Button>
                        {!readOnly ? (
                          <Button
                            variant="text"
                            color="error"
                            startIcon={
                              deletingMediaId === media.id ? (
                                <CircularProgress size={15} color="inherit" />
                              ) : (
                                <DeleteIcon />
                              )
                            }
                            aria-label={`Slett ${media.displayName} permanent`}
                            title={
                              media.reconciliationStatus === "matched"
                                ? "Fjern take-koblingen før filen slettes"
                                : "Slett recorderfil permanent"
                            }
                            disabled={Boolean(deletingMediaId)}
                            onClick={() => requestDeleteRecorderMedia(media)}
                            sx={{ minHeight: targetSize }}
                          >
                            Slett fil
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                    {!readOnly ? (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "minmax(0,1fr) auto auto",
                          },
                          gap: 0.75,
                          mt: 1,
                        }}
                      >
                        <FormControl
                          size="small"
                          sx={fieldSx}
                          disabled={dirty || takes.length === 0}
                        >
                          <InputLabel
                            id={`sound-media-target-${media.id}-label`}
                          >
                            Continuity-take
                          </InputLabel>
                          <Select
                            id={`sound-media-target-${media.id}`}
                            labelId={`sound-media-target-${media.id}-label`}
                            label="Continuity-take"
                            value={target}
                            onChange={(event) =>
                              setReconcileTargets((current) => ({
                                ...current,
                                [media.id]: event.target.value,
                              }))
                            }
                          >
                            <MenuItem value="">
                              <em>Velg take</em>
                            </MenuItem>
                            {takes.map((take) => (
                              <MenuItem key={take.id} value={take.id}>
                                {sceneLabel(project, take.sceneId)} · Take{" "}
                                {take.takeNumber}
                                {take.slate ? ` · ${take.slate}` : ""}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          variant="outlined"
                          startIcon={
                            reconcilingMediaId === media.id ? (
                              <CircularProgress size={15} color="inherit" />
                            ) : (
                              <LinkIcon />
                            )
                          }
                          disabled={
                            dirty || !target || Boolean(reconcilingMediaId)
                          }
                          onClick={() => void reconcileMedia(media, target)}
                          sx={{
                            minHeight: targetSize,
                            color: "#7dd3fc",
                            borderColor: "rgba(56,189,248,.35)",
                          }}
                        >
                          {media.reconciliationStatus === "matched"
                            ? "Flytt kobling"
                            : "Koble"}
                        </Button>
                        {media.reconciliationStatus === "matched" ? (
                          <Button
                            variant="text"
                            disabled={dirty || Boolean(reconcilingMediaId)}
                            onClick={() => void reconcileMedia(media, null)}
                            sx={{ minHeight: targetSize, color: "#fca5a5" }}
                          >
                            Fjern kobling
                          </Button>
                        ) : null}
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
              {operations.unmatchedRecordings.map((recording) => (
                <Box
                  key={recording.id}
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    border: "1px solid rgba(148,163,184,.2)",
                    bgcolor: "rgba(148,163,184,.04)",
                  }}
                >
                  <Typography sx={{ fontWeight: 720 }}>
                    {recording.fileName}
                  </Typography>
                  <Typography
                    sx={{ color: roleTokens.textMuted, fontSize: ".7rem" }}
                  >
                    Eldre metadataoppføring uten S3-media ·{" "}
                    {[
                      recording.sceneLabel,
                      recording.takeLabel,
                      recording.timecodeStart,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "mangler scene/take"}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
          {dirty ? (
            <Alert severity="info" sx={{ mt: 1.25 }}>
              Lagre lydrapporten før du endrer take-koblinger. Det hindrer at en
              eldre lokal versjon overskriver avstemmingen.
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Stack>
  );

  const renderHandoff = () => (
    <Stack spacing={1.5}>
      <Card variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box>
              <Typography component="h2" sx={{ fontWeight: 780 }}>
                Daglig sound report til post
              </Typography>
              <Typography
                sx={{
                  color: roleTokens.textMuted,
                  fontSize: ".74rem",
                  mt: 0.25,
                }}
              >
                Eksporten bruker continuity-scene/take, recorder-metadata, spor,
                kvalitetsflagg og ADR—noter.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={() =>
                downloadCsv(project, {
                  ...selectedDay,
                  productionSound: operations,
                })
              }
              sx={{
                minHeight: targetSize,
                color: "#7dd3fc",
                borderColor: "rgba(56,189,248,.38)",
              }}
            >
              Eksporter CSV
            </Button>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3,minmax(0,1fr))" },
              gap: 1,
              mt: 1.5,
            }}
          >
            {[
              {
                label: "Take-dekning",
                value: `${brief?.reportedTakeCount ?? 0}/${brief?.takeCount ?? 0}`,
              },
              {
                label: "Room tone mangler",
                value: brief?.missingRoomToneSceneCount ?? 0,
              },
              { label: "ADR-flagg", value: brief?.adrTakeCount ?? 0 },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  p: 1.3,
                  borderRadius: 1.5,
                  bgcolor: "rgba(255,255,255,.025)",
                  border: "1px solid rgba(255,255,255,.07)",
                }}
              >
                <Typography sx={{ fontSize: "1.45rem", fontWeight: 820 }}>
                  {item.value}
                </Typography>
                <Typography
                  sx={{ color: roleTokens.textMuted, fontSize: ".72rem" }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
      <Card variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 780, mb: 1.5 }}>
            Overlevering
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "180px minmax(0,1fr) minmax(0,1fr)",
              },
              gap: 1,
            }}
          >
            <FormControl sx={fieldSx} disabled={readOnly}>
              <InputLabel id="sound-handoff-status-label">Status</InputLabel>
              <Select
                id="sound-handoff-status"
                labelId="sound-handoff-status-label"
                label="Status"
                value={operations.handoff.status}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    handoff: {
                      ...current.handoff,
                      status: event.target
                        .value as ProductionSoundOperations["handoff"]["status"],
                      updatedAt: new Date().toISOString(),
                    },
                  }))
                }
              >
                <MenuItem value="draft">Utkast</MenuItem>
                <MenuItem value="ready_for_review">Klar for review</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Mottaker"
              value={operations.handoff.recipient ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  handoff: {
                    ...current.handoff,
                    recipient: event.target.value,
                  },
                }))
              }
              disabled={readOnly}
              inputProps={{ maxLength: 160 }}
              sx={fieldSx}
            />
            <TextField
              label="Mediedestinasjon / mappe"
              value={operations.handoff.mediaDestination ?? ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  handoff: {
                    ...current.handoff,
                    mediaDestination: event.target.value,
                  },
                }))
              }
              disabled={readOnly}
              inputProps={{ maxLength: 500 }}
              sx={fieldSx}
            />
          </Box>
          <TextField
            label="Notat til DIT / klipp / postlyd"
            value={operations.handoff.notes ?? ""}
            onChange={(event) =>
              update((current) => ({
                ...current,
                handoff: { ...current.handoff, notes: event.target.value },
              }))
            }
            disabled={readOnly}
            multiline
            minRows={4}
            inputProps={{ maxLength: 5000 }}
            fullWidth
            sx={{ ...fieldSx, mt: 1 }}
          />
          <Alert
            severity={
              brief?.takeCount === brief?.reportedTakeCount &&
              unresolvedFileCount === 0
                ? "success"
                : "warning"
            }
            sx={{ mt: 1.25 }}
          >
            {brief?.takeCount === brief?.reportedTakeCount &&
            unresolvedFileCount === 0
              ? "Alle kanoniske takes har lydstatus, og avstemmingskøen er tom."
              : "Kontroller take-dekning og uavstemte filer før overlevering."}
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );

  return (
    <Box
      component="section"
      aria-labelledby="production-sound-title"
      data-testid="production-sound-workspace"
      sx={{
        minHeight: "100%",
        overflowY: "auto",
        bgcolor: "#071018",
        color: roleTokens.text,
        p: { xs: 1.25, sm: 2, lg: 3 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 1540, mx: "auto" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            alignItems: { lg: "center" },
            justifyContent: "space-between",
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box>
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              flexWrap="wrap"
              sx={{ mb: 0.5 }}
            >
              <Chip
                label="PRODUCTION SOUND"
                size="small"
                sx={{
                  color: "#bae6fd",
                  bgcolor: "rgba(14,165,233,.12)",
                  border: "1px solid rgba(56,189,248,.28)",
                  fontWeight: 820,
                  letterSpacing: 0.7,
                }}
              />
              {readOnly ? (
                <Chip label="Skrivebeskyttet" size="small" variant="outlined" />
              ) : null}
              {dirty ? (
                <Chip
                  label="Lokalt utkast"
                  size="small"
                  sx={{ color: "#fde68a", bgcolor: "rgba(245,158,11,.12)" }}
                />
              ) : (
                <Chip
                  label={`Synkronisert · v${baseVersion}`}
                  size="small"
                  sx={{ color: "#86efac", bgcolor: "rgba(34,197,94,.1)" }}
                />
              )}
            </Stack>
            <Typography
              id="production-sound-title"
              component="h1"
              sx={{
                fontSize: { xs: "1.45rem", md: "1.9rem" },
                fontWeight: 820,
              }}
            >
              {project.name}
            </Typography>
            <Typography
              sx={{ color: roleTokens.textMuted, mt: 0.25, maxWidth: 860 }}
            >
              Fra akustisk plan og track assignment til take-kvalitet, room tone
              og sporbar post-handoff.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <FormControl
              size="small"
              sx={{ ...fieldSx, minWidth: { sm: 240 } }}
            >
              <InputLabel id="sound-production-day-label">
                Produksjonsdag
              </InputLabel>
              <Select
                id="sound-production-day"
                labelId="sound-production-day-label"
                label="Produksjonsdag"
                value={selectedDay.id}
                onChange={(event) => selectDay(event.target.value)}
              >
                {days.map((day) => (
                  <MenuItem key={day.id} value={day.id}>
                    {buildProductionSoundDayBrief(project, day).label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FullWorkspaceIcon />}
              onClick={() => {
                if (confirmIfDirty()) onOpenFullWorkspace();
              }}
              sx={{
                minHeight: targetSize,
                color: roleTokens.text,
                borderColor: roleTokens.border,
              }}
            >
              Hele prosjektet
            </Button>
            {!readOnly ? (
              <Button
                data-testid="production-sound-save"
                variant="contained"
                startIcon={
                  saving ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SaveIcon />
                  )
                }
                disabled={!dirty || saving || Boolean(conflictDay)}
                onClick={() => void save()}
                sx={{
                  minHeight: targetSize,
                  bgcolor: "#0284c7",
                  "&:hover": { bgcolor: "#0369a1" },
                }}
              >
                Lagre
              </Button>
            ) : null}
          </Stack>
        </Box>
        {feedback ? (
          <Alert
            severity={feedback.type}
            sx={{ mb: 1.5 }}
            action={
              conflictDay ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={loadServerVersion}
                >
                  Last serverversjon
                </Button>
              ) : undefined
            }
          >
            {feedback.text}
          </Alert>
        ) : null}
        {conflictDay ? (
          <Alert icon={<WarningIcon />} severity="warning" sx={{ mb: 1.5 }}>
            Serveren er på versjon {conflictDay.soundVersion ?? 0}. Det lokale
            utkastet er beholdt og må avklares eksplisitt.
          </Alert>
        ) : null}
        <Box
          component="nav"
          aria-label="Production Sound arbeidsflater"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2,minmax(0,1fr))",
              md: `repeat(${PRODUCTION_SOUND_SURFACES.length},minmax(0,1fr))`,
            },
            gap: 0.75,
            p: 0.75,
            mb: 2,
            border: `1px solid ${roleTokens.border}`,
            bgcolor: "rgba(7,16,24,.96)",
            borderRadius: 2,
          }}
        >
          {PRODUCTION_SOUND_SURFACES.map((surface) => {
            const meta = SURFACE_META[surface];
            const Icon = meta.icon;
            const active = surface === activeSurface;
            return (
              <Button
                key={surface}
                startIcon={<Icon sx={{ fontSize: 19 }} />}
                onClick={() => onNavigate(surface)}
                aria-current={active ? "page" : undefined}
                sx={{
                  minHeight: targetSize,
                  justifyContent: "flex-start",
                  color: active ? "#bae6fd" : roleTokens.textMuted,
                  bgcolor: active ? "rgba(14,165,233,.13)" : "transparent",
                  border: `1px solid ${active ? "rgba(56,189,248,.32)" : "transparent"}`,
                  ...focusVisibleStyles,
                }}
              >
                {meta.label}
              </Button>
            );
          })}
        </Box>
        {activeSurface === "overview" ? renderOverview() : null}
        {activeSurface === "setup" ? renderSetup() : null}
        {activeSurface === "takes" ? renderTakes() : null}
        {activeSurface === "additional" ? renderAdditional() : null}
        {activeSurface === "handoff" ? renderHandoff() : null}
      </Box>
      <Dialog
        open={Boolean(deleteCandidate)}
        onClose={
          deletingMediaId ? undefined : () => setDeleteCandidate(null)
        }
        aria-labelledby="delete-sound-media-title"
        aria-describedby="delete-sound-media-description"
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: "#0b1722",
            color: roleTokens.text,
            border: "1px solid rgba(248,113,113,.28)",
          },
        }}
      >
        <DialogTitle id="delete-sound-media-title">
          Slett recorderfil permanent?
        </DialogTitle>
        <DialogContent>
          <DialogContentText
            id="delete-sound-media-description"
            sx={{ color: roleTokens.textMuted }}
          >
            {deleteCandidate?.displayName} fjernes fra prosjektet og den private
            S3-lagringen. Handlingen kan ikke angres.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 0.75 }}>
          <Button
            onClick={() => setDeleteCandidate(null)}
            disabled={Boolean(deletingMediaId)}
            sx={{ minHeight: targetSize, color: roleTokens.text }}
          >
            Avbryt
          </Button>
          <Button
            data-testid="production-sound-delete-confirm"
            variant="contained"
            color="error"
            startIcon={
              deletingMediaId ? (
                <CircularProgress size={15} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
            disabled={Boolean(deletingMediaId)}
            onClick={() => void deleteRecorderMedia()}
            sx={{ minHeight: targetSize }}
          >
            Slett permanent
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProductionSoundWorkspace;
