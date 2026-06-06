import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import {
  checkDestinationsCapacity,
  DestCapacity,
  DestinationSpec,
  DetectedMount,
  DitDestination,
  fetchDestinationsWithCreds,
  startCopySession,
} from "../api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
}

interface Props {
  open: boolean;
  mount: DetectedMount | null;
  plannedDestinations: DitDestination[];
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}

interface PendingLocalDest {
  id: string;
  label: string;
  path: string;
}

let destCounter = 0;

export default function BackupDialog({
  open: isOpen,
  mount,
  plannedDestinations,
  onClose,
  onStarted,
}: Props) {
  const [checkedPlanned, setCheckedPlanned] = useState<Set<string>>(new Set());
  const [localDests, setLocalDests] = useState<PendingLocalDest[]>([]);
  const [starting, setStarting] = useState(false);
  const [capacityWarnings, setCapacityWarnings] = useState<DestCapacity[]>([]);
  const [checkingCapacity, setCheckingCapacity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Pre-velg alle planlagte destinasjoner med en path satt (in-place "original"
  // destinasjoner uten path er ikke relevante for Desk)
  useEffect(() => {
    if (isOpen) {
      const initial = new Set(
        plannedDestinations.filter((d) => d.path && d.destination_type !== "original").map((d) => d.id),
      );
      setCheckedPlanned(initial);
    }
  }, [isOpen, plannedDestinations]);

  const reset = () => {
    setLocalDests([]);
    setCheckedPlanned(new Set());
    setStarting(false);
    setError(null);
  };

  const handleClose = () => {
    if (starting) return;
    reset();
    onClose();
  };

  /// Felles add-handler — brukes BÅDE av "Legg til mappe"-knappen og
  /// drag-drop-listener. Tar én path, validerer at den ikke allerede
  /// er lagt til (enten som planned eller local), og legger den i
  /// localDests med Finder-leaf som label.
  const addLocalPath = (path: string) => {
    // Hopp over hvis allerede lagt til som lokal mappe
    if (localDests.some((d) => d.path === path)) return;
    // Hopp også hvis matcher en planned-dest path (unngår dobbel-skriving)
    if (plannedDestinations.some((d) => d.path === path)) return;
    destCounter += 1;
    const segments = path.split("/").filter(Boolean);
    const label = segments[segments.length - 1] || path;
    setLocalDests((prev) => [
      ...prev,
      { id: `local_${destCounter}`, label, path },
    ]);
  };

  const handleAddFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Velg backup-destinasjon",
    });
    if (!selected || Array.isArray(selected)) return;
    addLocalPath(String(selected));
  };

  // Drag-drop fra Finder: Tauri 2 emit'er native drag-drop-event med
  // fil-path-er. Vi lytter når dialogen er åpen og legger hver droppet
  // folder til localDests (skipper non-directory paths og duplikater).
  // Highlighter dialog-bgcolor under drag-over for visuell feedback.
  useEffect(() => {
    if (!isOpen) return;
    let unlisten: UnlistenFn | undefined;
    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "enter" || p.type === "over") {
          setIsDragOver(true);
        } else if (p.type === "leave") {
          setIsDragOver(false);
        } else if (p.type === "drop") {
          setIsDragOver(false);
          const paths = p.paths ?? [];
          for (const path of paths) {
            // Best-effort directory-detection: bare bruk paths som ikke
            // har file-extensions etter siste "/". Robust nok for typisk
            // Finder-drag av RAID-volumer og backup-mapper.
            const leaf = path.split("/").pop() ?? "";
            const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(leaf);
            if (hasExtension) continue;
            addLocalPath(path);
          }
        }
      })
      .then((un) => {
        unlisten = un;
      });
    return () => {
      unlisten?.();
      setIsDragOver(false);
    };
  }, [isOpen, localDests, plannedDestinations]);

  const togglePlanned = (id: string, checked: boolean) => {
    setCheckedPlanned((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const removeLocal = (id: string) => {
    setLocalDests((prev) => prev.filter((d) => d.id !== id));
  };

  const finalSpecs: DestinationSpec[] = useMemo(() => {
    const planned: DestinationSpec[] = plannedDestinations
      .filter((d) => checkedPlanned.has(d.id) && d.path)
      .map((d) => ({
        id: `backend_${d.id}`,
        label: d.label,
        path: d.path!,
        backend_id: d.id,
      }));
    const local: DestinationSpec[] = localDests.map((d) => ({
      id: d.id,
      label: d.label,
      path: d.path,
      backend_id: null,
    }));
    return [...planned, ...local];
  }, [plannedDestinations, checkedPlanned, localDests]);

  // Capacity pre-flight: kjøres når destinasjonsutvalget endrer seg.
  // Sjekker hver dest mot mount's bytes-størrelse + sammenligner med
  // free space. Resultater vises som inline-Alert nederst i dialogen.
  // Debounce-merknad: useEffect-trigger reagerer på finalSpecs-endring
  // som er stabil via useMemo så vi får ikke for mange kall.
  const sourceBytes = mount ? (mount.photo_bytes ?? 0) + (mount.video_bytes ?? 0) : 0;
  useEffect(() => {
    if (!mount || finalSpecs.length === 0 || sourceBytes === 0) {
      setCapacityWarnings([]);
      return;
    }
    let cancelled = false;
    setCheckingCapacity(true);
    void checkDestinationsCapacity(
      finalSpecs.map((d) => d.path),
      sourceBytes,
    )
      .then((results) => {
        if (cancelled) return;
        // Vis bare oppføringer der det er et reelt problem (insufficient
        // eller utenfor safe margin). Disker med rikelig plass blir
        // stille — Fredrik trenger ikke se "alt OK"-spam.
        const problematic = results.filter((r) => !r.sufficient || !r.safe_margin);
        setCapacityWarnings(problematic);
      })
      .catch(() => {
        if (!cancelled) setCapacityWarnings([]);
      })
      .finally(() => {
        if (!cancelled) setCheckingCapacity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [finalSpecs, mount, sourceBytes]);

  // Block start hvis NOEN dest er hard-insufficient (less plass enn
  // trengs). Soft-margin warnings er bare info — Fredrik kan starte
  // likevel (PR #126 deaktiverer disken automatisk ved ENOSPC).
  const hasHardCapacityBlocker = capacityWarnings.some((c) => !c.sufficient);

  const handleStart = async () => {
    if (!mount || finalSpecs.length === 0) return;
    if (hasHardCapacityBlocker) return;
    setStarting(true);
    setError(null);
    try {
      // Hent dest-creds rett før start så cloud-destinations får inn
      // B2-creds in-memory. Lokale dests (uten backend_id) blir uberørt.
      let withCreds: Awaited<ReturnType<typeof fetchDestinationsWithCreds>> = [];
      try {
        withCreds = await fetchDestinationsWithCreds();
      } catch (e) {
        // Hvis with-creds-endepunktet feiler (gammel backend, ingen
        // cloud-dests, nettverksfeil) — fortsetter med lokal-only.
        console.warn("[backup] fetch-with-creds feilet, fortsetter lokal:", e);
      }

      const credsBy = new Map(withCreds.map((d) => [d.id, d]));

      const specsWithCreds: DestinationSpec[] = finalSpecs.map((spec) => {
        if (!spec.backend_id) return spec;
        const match = credsBy.get(spec.backend_id);
        if (!match || match.cloud_provider !== "b2" || !match.cloud_credentials) {
          return spec;
        }
        return {
          ...spec,
          cloud_provider: match.cloud_provider,
          cloud_bucket_id: match.cloud_bucket_id ?? null,
          cloud_credentials: match.cloud_credentials,
        };
      });

      const sessionId = await startCopySession({
        mountPath: mount.mount_path,
        volumeLabel: mount.volume_label,
        destinations: specsWithCreds,
      });
      onStarted(sessionId);
      reset();
      onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setStarting(false);
    }
  };

  const plannedWithPath = plannedDestinations.filter(
    (d) => d.path && d.destination_type !== "original",
  );

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            // Drag-over highlight: dotted primary-color outline + subtle
            // tinted bg. Gjør det åpenbart at "du kan slippe her" mens
            // Fredrik fortsatt drar fra Finder.
            transition: "outline 0.15s, background-color 0.15s",
            outline: isDragOver
              ? "3px dashed rgba(245, 166, 35, 0.7)"
              : "3px dashed transparent",
            outlineOffset: -2,
            bgcolor: isDragOver ? "rgba(245, 166, 35, 0.08)" : undefined,
          },
        },
      }}
    >
      <DialogTitle>
        Start backup
        {mount && (
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
            {mount.volume_label} · {mount.photo_count} foto · {mount.video_count} video
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Hver fil hashes med xxHash64 og verifiseres etter skriving.
              Kildens innhold endres aldri. Destinasjoner med 🔗 rapporteres
              også til CreatorHub-backend så status synes i klient-galleriet.
            </Typography>
          </Box>

          {plannedWithPath.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Planlagte destinasjoner (fra Admin Room)
              </Typography>
              <Stack spacing={0.5}>
                {plannedWithPath.map((d) => (
                  <FormControlLabel
                    key={d.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={checkedPlanned.has(d.id)}
                        onChange={(e) => togglePlanned(d.id, e.target.checked)}
                        disabled={starting}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Chip size="small" label={`🔗 ${d.destination_type}`} color="primary" />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {d.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.path}
                        </Typography>
                      </Stack>
                    }
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Divider />

          <Box>
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Ad-hoc-mapper (kun lokalt)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={handleAddFolder}
                disabled={starting}
              >
                Legg til mappe
              </Button>
            </Stack>

            {localDests.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                Ingen ad-hoc-mapper valgt. Dra en mappe fra Finder rett inn
                i dialogen, eller bruk "Legg til mappe"-knappen over.
              </Typography>
            ) : (
              <List dense>
                {localDests.map((d) => (
                  <ListItem
                    key={d.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => removeLocal(d.id)}
                        disabled={starting}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Chip size="small" label={d.label} />
                        </Stack>
                      }
                      secondary={d.path}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Capacity pre-flight: synlig før Fredrik trykker start.
              Hard-insufficient → error-Alert + start-knapp disabled.
              Innenfor 5%-margin → warning-Alert (kan starte, men risikabelt). */}
          {capacityWarnings.length > 0 && !checkingCapacity && (
            <Alert
              severity={hasHardCapacityBlocker ? "error" : "warning"}
              sx={{ mt: 1 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {hasHardCapacityBlocker
                  ? "Ikke nok plass på alle destinasjoner"
                  : "Lite plass på noen destinasjoner"}
              </Typography>
              {capacityWarnings.map((c) => (
                <Typography key={c.path} variant="caption" sx={{ display: "block" }}>
                  {c.path}: trenger {formatBytes(c.needed_bytes)}, har{" "}
                  {c.free_bytes != null ? formatBytes(c.free_bytes) : "ukjent"} ledig
                  {!c.sufficient && " — for lite!"}
                </Typography>
              ))}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={starting}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={
            starting ||
            finalSpecs.length === 0 ||
            !mount ||
            hasHardCapacityBlocker
          }
        >
          {starting
            ? "Starter…"
            : hasHardCapacityBlocker
              ? "Ikke nok plass"
              : `Start backup (${finalSpecs.length} destinasjoner)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
