import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import NewReleasesOutlinedIcon from "@mui/icons-material/NewReleasesOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import type { ReleaseNote, ReleaseSectionKind } from "../releaseNotes";
import { formatReleaseDate } from "../releaseNotes";

export type UpdaterStage =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "error";

export interface UpdateSettings {
  autoCheck: boolean;
  autoDownload: boolean;
  skippedVersion: string | null;
  remindAfterMs: number | null;
  lastCheckedAtMs: number | null;
}

interface Props {
  open: boolean;
  currentVersion: string;
  stage: UpdaterStage;
  availableRelease: ReleaseNote | null;
  currentRelease: ReleaseNote | null;
  history: ReleaseNote[];
  settings: UpdateSettings;
  progress: number;
  error: string | null;
  onCheck: () => void;
  onDownloadAndInstall: () => void;
  onInstall: () => void;
  onRemindLater: () => void;
  onSkipVersion: () => void;
  onResumeVersion: () => void;
  onChangeSettings: (next: UpdateSettings) => void;
  onDismiss: () => void;
}

const sectionVisual: Record<
  ReleaseSectionKind,
  { icon: typeof AutoAwesomeIcon; color: "primary" | "success" | "info" | "warning" }
> = {
  new: { icon: NewReleasesOutlinedIcon, color: "primary" },
  improved: { icon: TuneIcon, color: "info" },
  fixed: { icon: BugReportOutlinedIcon, color: "success" },
  security: { icon: SecurityOutlinedIcon, color: "warning" },
};

function ReleaseNoteView({ release, compact = false }: { release: ReleaseNote; compact?: boolean }) {
  return (
    <Stack spacing={compact ? 1.25 : 2}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant={compact ? "subtitle1" : "h6"} sx={{ fontWeight: 800 }}>
            {release.title}
          </Typography>
          <Chip label={`v${release.version}`} size="small" variant="outlined" />
          {release.critical && <Chip label="Kritisk" size="small" color="warning" />}
        </Stack>
        {release.publishedAt && (
          <Typography variant="caption" color="text.secondary">
            {formatReleaseDate(release.publishedAt)}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {release.summary}
        </Typography>
      </Box>

      {release.sections.length > 0 && (
        <Grid container spacing={1.25}>
          {release.sections.map((section) => {
            const visual = sectionVisual[section.kind] ?? sectionVisual.improved;
            const Icon = visual.icon;
            return (
              <Grid key={`${release.version}-${section.title}`} size={{ xs: 12, sm: compact ? 12 : 6 }}>
                <Box
                  sx={{
                    height: "100%",
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "rgba(255,255,255,0.025)",
                  }}
                >
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.75 }}>
                    <Icon color={visual.color} fontSize="small" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {section.title}
                    </Typography>
                  </Stack>
                  <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                    {section.items.map((item) => (
                      <Typography
                        component="li"
                        variant="body2"
                        color="text.secondary"
                        key={item}
                        sx={{ mb: 0.5, "&:last-child": { mb: 0 } }}
                      >
                        {item}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}

function formatLastChecked(value: number | null): string {
  if (!value) return "Ikke kontrollert ennå";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function UpdaterDialog({
  open,
  currentVersion,
  stage,
  availableRelease,
  currentRelease,
  history,
  settings,
  progress,
  error,
  onCheck,
  onDownloadAndInstall,
  onInstall,
  onRemindLater,
  onSkipVersion,
  onResumeVersion,
  onChangeSettings,
  onDismiss,
}: Props) {
  const busy = stage === "checking" || stage === "downloading" || stage === "installing";
  const skipped = availableRelease?.version === settings.skippedVersion;
  const reminderActive = Boolean(
    settings.remindAfterMs && settings.remindAfterMs > Date.now() && availableRelease,
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onDismiss} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <AutoAwesomeIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Oppdateringer
            </Typography>
            <Typography variant="caption" color="text.secondary">
              CreatorHub One Desk · stabil kanal
            </Typography>
          </Box>
          <Chip label={`Installert v${currentVersion || "…"}`} size="small" variant="outlined" />
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={3}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: availableRelease ? "primary.main" : "divider",
              bgcolor: availableRelease ? "rgba(255,140,0,0.055)" : "rgba(255,255,255,0.025)",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {stage === "checking"
                    ? "Ser etter en ny versjon…"
                    : stage === "idle"
                      ? "Klar til å se etter oppdateringer"
                      : stage === "error"
                        ? "Siste kontroll ble ikke fullført"
                    : stage === "installed"
                      ? "Oppdateringen er installert"
                      : stage === "downloaded"
                        ? "Oppdateringen er klar til installasjon"
                        : availableRelease
                          ? `Versjon ${availableRelease.version} er tilgjengelig`
                          : "Du har siste versjon"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sist kontrollert: {formatLastChecked(settings.lastCheckedAtMs)}
                </Typography>
              </Box>
              <Button
                variant={availableRelease ? "outlined" : "contained"}
                onClick={onCheck}
                disabled={busy || stage === "downloaded" || stage === "installed"}
              >
                {stage === "checking" ? "Søker…" : "Søk nå"}
              </Button>
            </Stack>

            {(stage === "downloading" || stage === "installing") && (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.75 }}>
                  <Typography variant="caption">
                    {stage === "installing" ? "Installerer…" : "Laster ned…"}
                  </Typography>
                  {stage === "downloading" && (
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(progress * 100)}%
                    </Typography>
                  )}
                </Stack>
                <LinearProgress
                  variant={stage === "installing" ? "indeterminate" : "determinate"}
                  value={Math.round(progress * 100)}
                />
              </Box>
            )}
          </Box>

          {stage === "error" && (
            <Alert severity="error">
              {error || "Kunne ikke kontrollere eller installere oppdateringen."}
            </Alert>
          )}
          {stage === "installed" && (
            <Alert severity="success">
              Lukk CreatorHub One Desk med ⌘Q og åpne appen på nytt for å bruke den nye versjonen.
            </Alert>
          )}
          {skipped && (
            <Alert severity="info" action={<Button onClick={onResumeVersion}>Vis igjen</Button>}>
              Du har valgt å hoppe over versjon {availableRelease?.version}.
            </Alert>
          )}
          {reminderActive && !skipped && (
            <Alert severity="info">Påminnelsen er utsatt i 24 timer.</Alert>
          )}

          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800 }}>
              Hva er nytt
            </Typography>
            {availableRelease ? (
              <ReleaseNoteView release={availableRelease} />
            ) : currentRelease ? (
              <ReleaseNoteView release={currentRelease} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Det finnes ingen lokal endringslogg for denne versjonen.
              </Typography>
            )}
          </Box>

          <Divider />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <SettingsOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Administrer
                  </Typography>
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoCheck}
                      onChange={(_, checked) =>
                        onChangeSettings({
                          ...settings,
                          autoCheck: checked,
                          autoDownload: checked ? settings.autoDownload : false,
                        })
                      }
                    />
                  }
                  label="Se etter oppdateringer automatisk"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoDownload}
                      disabled={!settings.autoCheck}
                      onChange={(_, checked) =>
                        onChangeSettings({ ...settings, autoDownload: checked })
                      }
                    />
                  }
                  label="Last ned automatisk"
                />
                <Typography variant="caption" color="text.secondary">
                  Automatisk nedlasting installerer aldri uten at du bekrefter det. Kritiske
                  oppdateringer merkes tydelig, men tvinges ikke mens du arbeider.
                </Typography>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <HistoryIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Versjonshistorikk
                  </Typography>
                </Stack>
                <Box sx={{ maxHeight: 230, overflowY: "auto", pr: 0.5 }}>
                  {history.map((release) => (
                    <Accordion key={release.version} disableGutters elevation={0}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            v{release.version} · {release.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatReleaseDate(release.publishedAt)}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <ReleaseNoteView release={release} compact />
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap" }}>
        <Button onClick={onDismiss} disabled={busy} sx={{ mr: "auto" }}>
          Lukk
        </Button>
        {availableRelease && stage === "available" && !skipped && (
          <>
            {!availableRelease.critical && (
              <>
                <Button onClick={onSkipVersion}>Hopp over denne</Button>
                <Button onClick={onRemindLater}>Minn meg senere</Button>
              </>
            )}
            <Button variant="contained" onClick={onDownloadAndInstall}>
              Last ned og installer
            </Button>
          </>
        )}
        {availableRelease && stage === "downloaded" && (
          <Button variant="contained" onClick={onInstall}>
            Installer nå
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
