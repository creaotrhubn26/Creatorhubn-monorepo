import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import type {
  WorkspaceParticipantCompensation,
  WorkspaceParticipantCompensationSplitSheetStatus,
  WorkspaceParticipantCompensationStatus,
  WorkspaceParticipantCompensationType,
} from "@shared/workspace-participant-compensation";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { ws } from "../workspaceTheme";
import { WsTag } from "../ui";
import { makeT, type WsDict, useWsLocale, wsDateLocale } from "../wsLocale";
import {
  workspaceParticipantCompensationApi,
  workspaceParticipantCompensationError,
} from "./workspaceParticipantCompensationApi";
import {
  buildWorkspaceParticipantCompensationRequest,
  calculateWorkspaceParticipantHourlyEstimate,
  EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
  newWorkspaceParticipantCompensationIdempotencyKey,
  type WorkspaceParticipantCompensationDraft,
  type WorkspaceParticipantCompensationValidationCode,
} from "./workspaceParticipantCompensationModel";

const T: WsDict = {
  title: { no: "Honorar & timesats", en: "Compensation & hourly rate" },
  subtitle: { no: "Versjonerte vilkår for", en: "Versioned terms for" },
  permission: {
    no: "Honorar er sensitivt og kan bare åpnes av en prosjektadministrator med administrasjonstilgang.",
    en: "Compensation is sensitive and can only be opened by a project administrator with management access.",
  },
  configurationPermission: {
    no: "Du kan lese honorarstatus og historikk. Bare prosjekteier eller Enterprise-admin kan opprette nye vilkår.",
    en: "You can view compensation status and history. Only the project owner or an Enterprise admin can create new terms.",
  },
  loading: { no: "Laster honorar…", en: "Loading compensation…" },
  retry: { no: "Prøv igjen", en: "Try again" },
  close: { no: "Lukk", en: "Close" },
  current: { no: "Gjeldende vilkår", en: "Current terms" },
  none: {
    no: "Ingen honorarvilkår er registrert ennå.",
    en: "No compensation terms have been recorded yet.",
  },
  history: { no: "Versjonshistorikk", en: "Version history" },
  noHistory: { no: "Ingen tidligere versjoner.", en: "No earlier versions." },
  newVersion: { no: "Ny versjon", en: "New version" },
  editHeading: { no: "Opprett nye vilkår", en: "Create new terms" },
  type: { no: "Honorartype", en: "Compensation type" },
  hourly: { no: "Timesats", en: "Hourly" },
  fixed: { no: "Fast honorar", en: "Fixed fee" },
  unpaid: { no: "Ubetalt", en: "Unpaid" },
  dayRate: { no: "Dagsats", en: "Day rate" },
  share: { no: "Andel", en: "Share" },
  hourlyRate: { no: "Timesats (NOK)", en: "Hourly rate (NOK)" },
  estimatedHours: { no: "Estimerte timer", en: "Estimated hours" },
  fixedAmount: { no: "Fast beløp (NOK)", en: "Fixed amount (NOK)" },
  estimatedTotal: { no: "Beregnet total", en: "Estimated total" },
  note: {
    no: "Merknad i avtalen (vises til medvirkende)",
    en: "Agreement note (visible to participant)",
  },
  noteHelp: {
    no: "Denne teksten blir en del av kontraktens honorarvilkår. Ikke skriv intern informasjon her.",
    en: "This text becomes part of the contract compensation terms. Do not enter internal information here.",
  },
  agreementNote: { no: "Merknad i avtalen", en: "Agreement note" },
  unpaidInfo: {
    no: "Denne versjonen registrerer at oppdraget er ubetalt. Det opprettes ikke et split sheet.",
    en: "This version records an unpaid engagement. No split sheet will be created.",
  },
  immutableInfo: {
    no: "Lagring oppretter en ny, sporbar versjon. Gjeldende versjon blir erstattet.",
    en: "Saving creates a new auditable version. The current version is superseded.",
  },
  cancel: { no: "Avbryt", en: "Cancel" },
  save: { no: "Lagre ny versjon", en: "Save new version" },
  saving: { no: "Lagrer…", en: "Saving…" },
  saved: {
    no: "Ny honorarversjon er lagret.",
    en: "New compensation version saved.",
  },
  replayed: {
    no: "Lagringen var allerede mottatt og er trygt gjenbrukt.",
    en: "The save had already been received and was safely replayed.",
  },
  rosterRefreshFailed: {
    no: "Vilkårene er lagret, men klarstatusen kunne ikke oppdateres automatisk. Oppdater listen.",
    en: "The terms were saved, but readiness could not refresh automatically. Refresh the roster.",
  },
  conflict: {
    no: "Vilkårene ble endret et annet sted. Gjeldende versjon er lastet på nytt; kontroller feltene før du prøver igjen.",
    en: "The terms changed elsewhere. The current version was reloaded; review the fields before trying again.",
  },
  inactive: {
    no: "Nye honorarvilkår kan ikke opprettes for en arkivert eller avbrutt medvirkende.",
    en: "New compensation terms cannot be created for an archived or cancelled participant.",
  },
  invalidRate: {
    no: "Timesatsen må være større enn 0 og ha maksimalt to desimaler.",
    en: "The hourly rate must be above 0 with no more than two decimals.",
  },
  invalidHours: {
    no: "Estimerte timer må være større enn 0 og ha maksimalt to desimaler.",
    en: "Estimated hours must be above 0 with no more than two decimals.",
  },
  invalidFixed: {
    no: "Det faste beløpet må være større enn 0 og ha maksimalt to desimaler.",
    en: "The fixed amount must be above 0 with no more than two decimals.",
  },
  invalidKey: {
    no: "Nettleseren kunne ikke opprette en sikker lagringsnøkkel. Last siden på nytt.",
    en: "The browser could not create a secure save key. Reload the page.",
  },
  noteTooLong: {
    no: "Notatet kan ikke være lengre enn 2000 tegn.",
    en: "The note cannot exceed 2,000 characters.",
  },
  noteContainsHtml: {
    no: "Merknaden kan ikke inneholde HTML-koder.",
    en: "The agreement note cannot contain HTML tags.",
  },
  version: { no: "Versjon", en: "Version" },
  created: { no: "Opprettet", en: "Created" },
  splitSheet: { no: "Privat honorarark", en: "Private compensation sheet" },
  splitSheetAcceptance: {
    no: "Vilkårene aksepteres i den sikre kontraktportalen.",
    en: "The terms are accepted in the secure contract portal.",
  },
  noSplitSheet: { no: "Ingen split sheet", en: "No split sheet" },
};

const TYPE_LABELS: Record<
  WorkspaceParticipantCompensationType,
  { no: string; en: string }
> = {
  hourly: { no: "Timesats", en: "Hourly" },
  fixed: { no: "Fast honorar", en: "Fixed fee" },
  unpaid: { no: "Ubetalt", en: "Unpaid" },
  day_rate: { no: "Dagsats", en: "Day rate" },
  share: { no: "Andel", en: "Share" },
};

const STATUS_LABELS: Record<
  WorkspaceParticipantCompensationStatus,
  { no: string; en: string }
> = {
  draft: { no: "Utkast", en: "Draft" },
  active: { no: "Gjeldende", en: "Current" },
  superseded: { no: "Erstattet", en: "Superseded" },
  archived: { no: "Arkivert", en: "Archived" },
};

const STATUS_TONES: Record<
  WorkspaceParticipantCompensationStatus,
  "green" | "amber" | "neutral"
> = {
  draft: "amber",
  active: "green",
  superseded: "neutral",
  archived: "neutral",
};

const SPLIT_STATUS_LABELS: Record<
  WorkspaceParticipantCompensationSplitSheetStatus,
  { no: string; en: string }
> = {
  draft: { no: "Utkast", en: "Draft" },
  pending_signatures: {
    no: "Intern ventestatus",
    en: "Internal pending state",
  },
  completed: { no: "Fullført", en: "Completed" },
  archived: { no: "Arkivert", en: "Archived" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  participant: WorkspaceProjectParticipant | null;
  access: Pick<
    WorkspaceParticipantAccess,
    "canView" | "canManage" | "canConfigureRequirements"
  >;
  onSaved: () => void | Promise<void>;
}

function money(value: number | null, currency: string, locale: "no" | "en") {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(wsDateLocale(locale), {
    style: "currency",
    currency: currency || "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function number(value: number | null, locale: "no" | "en") {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(wsDateLocale(locale), {
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value: string, locale: "no" | "en") {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(wsDateLocale(locale), {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function termsSummary(
  item: WorkspaceParticipantCompensation,
  locale: "no" | "en",
): string {
  if (item.compensationType === "hourly") {
    return `${money(item.hourlyRate, item.currency, locale)} / ${locale === "en" ? "hour" : "time"} · ${number(item.estimatedHours, locale)} ${locale === "en" ? "hours" : "timer"} · ${money(item.estimatedAmount, item.currency, locale)}`;
  }
  if (item.compensationType === "fixed") {
    return money(
      item.fixedAmount ?? item.estimatedAmount,
      item.currency,
      locale,
    );
  }
  if (item.compensationType === "unpaid") {
    return locale === "en" ? "No payment" : "Ingen betaling";
  }
  if (item.compensationType === "day_rate") {
    return `${money(item.dayRate, item.currency, locale)} / ${locale === "en" ? "day" : "dag"}`;
  }
  return item.sharePercentage === null
    ? "—"
    : `${number(item.sharePercentage, locale)} %`;
}

function validationMessage(
  code: WorkspaceParticipantCompensationValidationCode,
  t: (key: string) => string,
): string {
  const keys: Record<WorkspaceParticipantCompensationValidationCode, string> = {
    invalid_idempotency_key: "invalidKey",
    invalid_hourly_rate: "invalidRate",
    invalid_estimated_hours: "invalidHours",
    invalid_fixed_amount: "invalidFixed",
    note_contains_html: "noteContainsHtml",
    note_too_long: "noteTooLong",
  };
  return t(keys[code]);
}

function CompensationCard(props: {
  item: WorkspaceParticipantCompensation;
  locale: "no" | "en";
  t: (key: string) => string;
}) {
  const { item, locale, t } = props;
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 2,
        border: `1px solid ${ws.borderSoft}`,
        bgcolor: ws.panel,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
          >
            <Typography sx={{ color: ws.text, fontSize: 14, fontWeight: 800 }}>
              {TYPE_LABELS[item.compensationType][locale]}
            </Typography>
            <WsTag
              label={STATUS_LABELS[item.status][locale]}
              tone={STATUS_TONES[item.status]}
            />
          </Stack>
          <Typography sx={{ color: ws.text, fontSize: 13, mt: 0.5 }}>
            {termsSummary(item, locale)}
          </Typography>
        </Box>
        <Typography sx={{ color: ws.textFaint, fontSize: 11.5 }}>
          {t("version")} {item.version} · {date(item.createdAt, locale)}
        </Typography>
      </Stack>

      {item.note && (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ color: ws.textFaint, fontSize: 10.5 }}>
            {t("agreementNote")}
          </Typography>
          <Typography sx={{ color: ws.textDim, fontSize: 12, mt: 0.25 }}>
            {item.note}
          </Typography>
        </Box>
      )}

      <Divider sx={{ borderColor: ws.borderSoft, my: 1.25 }} />
      {item.splitSheetId ? (
        <Stack spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography
                sx={{ color: ws.textDim, fontSize: 11.5, fontWeight: 700 }}
              >
                {t("splitSheet")}
              </Typography>
              {item.splitSheetStatus && (
                <WsTag
                  label={SPLIT_STATUS_LABELS[item.splitSheetStatus][locale]}
                  tone={
                    item.splitSheetStatus === "completed" ? "green" : "neutral"
                  }
                />
              )}
            </Stack>
            <Typography
              sx={{
                color: ws.textFaint,
                fontSize: 10.5,
                overflowWrap: "anywhere",
                mt: 0.35,
              }}
            >
              {item.splitSheetId}
            </Typography>
            <Typography sx={{ color: ws.textFaint, fontSize: 10.5, mt: 0.35 }}>
              {t("splitSheetAcceptance")}
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Typography sx={{ color: ws.textFaint, fontSize: 11.5 }}>
          {t("noSplitSheet")}
        </Typography>
      )}
    </Box>
  );
}

const WorkspaceParticipantCompensationDialog: React.FC<Props> = ({
  open,
  onClose,
  projectId,
  participant,
  access,
  onSaved,
}) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const loadSequence = useRef(0);
  const [current, setCurrent] =
    useState<WorkspaceParticipantCompensation | null>(null);
  const [history, setHistory] = useState<WorkspaceParticipantCompensation[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkspaceParticipantCompensationDraft>({
    ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
  });
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadRecords = useCallback(async () => {
    if (!participant || !access.canManage) return null;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError("");
    try {
      const [currentResponse, historyResponse] = await Promise.all([
        workspaceParticipantCompensationApi.current(projectId, participant.id),
        workspaceParticipantCompensationApi.history(projectId, participant.id),
      ]);
      if (sequence !== loadSequence.current) return null;
      setCurrent(currentResponse.compensation);
      setHistory(historyResponse.compensations);
      return currentResponse.compensation;
    } catch (error) {
      if (sequence === loadSequence.current) {
        setLoadError(workspaceParticipantCompensationError(error).message);
      }
      return null;
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [access.canManage, participant, projectId]);

  useEffect(() => {
    if (!open) {
      loadSequence.current += 1;
      setCurrent(null);
      setHistory([]);
      setLoadError("");
      setEditing(false);
      setDraft({ ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT });
      setExpectedVersion(null);
      setIdempotencyKey("");
      setFormError("");
      setNotice("");
      setSaving(false);
      setLoading(false);
      return;
    }
    if (participant && access.canManage) void loadRecords();
  }, [access.canManage, loadRecords, open, participant]);

  const estimate = useMemo(
    () =>
      calculateWorkspaceParticipantHourlyEstimate(
        draft.hourlyRate,
        draft.estimatedHours,
      ),
    [draft.estimatedHours, draft.hourlyRate],
  );

  const inactive =
    participant?.workflowStatus === "archived" ||
    participant?.workflowStatus === "cancelled" ||
    !!participant?.archivedAt;

  const startNewVersion = () => {
    setNotice("");
    setFormError("");
    try {
      setIdempotencyKey(newWorkspaceParticipantCompensationIdempotencyKey());
    } catch {
      setFormError(t("invalidKey"));
      setIdempotencyKey("");
    }
    setExpectedVersion(current?.version ?? null);
    setDraft({
      compensationType:
        current?.compensationType === "hourly" ||
        current?.compensationType === "fixed" ||
        current?.compensationType === "unpaid"
          ? current.compensationType
          : "hourly",
      hourlyRate:
        current?.compensationType === "hourly" && current.hourlyRate !== null
          ? String(current.hourlyRate)
          : "",
      estimatedHours:
        current?.compensationType === "hourly" &&
        current.estimatedHours !== null
          ? String(current.estimatedHours)
          : "",
      fixedAmount:
        current?.compensationType === "fixed" && current.fixedAmount !== null
          ? String(current.fixedAmount)
          : "",
      note: current?.note ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (
      !participant ||
      !access.canManage ||
      !access.canConfigureRequirements ||
      saving
    )
      return;
    const built = buildWorkspaceParticipantCompensationRequest({
      draft,
      idempotencyKey,
      expectedCurrentVersion: expectedVersion,
    });
    if (!built.ok) {
      setFormError(validationMessage(built.code, t));
      return;
    }

    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      const response = await workspaceParticipantCompensationApi.createVersion(
        projectId,
        participant.id,
        built.request,
      );
      setCurrent(response.compensation);
      setHistory((items) => [
        response.compensation,
        ...items.filter((item) => item.id !== response.compensation.id),
      ]);
      setEditing(false);
      setIdempotencyKey("");
      setNotice(response.replayed ? t("replayed") : t("saved"));

      const results = await Promise.allSettled([loadRecords(), onSaved()]);
      if (results[1].status === "rejected") {
        setNotice(t("rosterRefreshFailed"));
      }
    } catch (error) {
      const apiError = workspaceParticipantCompensationError(error);
      if (apiError.code === "version_conflict") {
        const latest = await loadRecords();
        setExpectedVersion(latest?.version ?? null);
        try {
          setIdempotencyKey(
            newWorkspaceParticipantCompensationIdempotencyKey(),
          );
        } catch {
          setIdempotencyKey("");
        }
        setFormError(t("conflict"));
      } else if (apiError.code === "idempotency_conflict") {
        try {
          setIdempotencyKey(
            newWorkspaceParticipantCompensationIdempotencyKey(),
          );
          setFormError(apiError.message);
        } catch {
          setIdempotencyKey("");
          setFormError(t("invalidKey"));
        }
      } else if (apiError.code === "participant_inactive") {
        setFormError(t("inactive"));
      } else {
        // Keep the same idempotency key for safe retry after network/service
        // failures. The backend will replay the original successful write.
        setFormError(apiError.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { bgcolor: ws.bg, backgroundImage: "none" } }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <AccountBalanceWalletOutlined sx={{ color: ws.accent }} />
          <Box>
            <Typography sx={{ color: ws.text, fontSize: 18, fontWeight: 800 }}>
              {t("title")}
            </Typography>
            <Typography sx={{ color: ws.textDim, fontSize: 12.5 }}>
              {t("subtitle")} {participant?.displayName ?? "—"}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: ws.borderSoft }}>
        {!access.canManage ? (
          <Alert severity="info" icon={<LockOutlined />}>
            {t("permission")}
          </Alert>
        ) : loading && !current && !history.length ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
            <CircularProgress size={28} />
            <Typography sx={{ color: ws.textDim, fontSize: 13 }}>
              {t("loading")}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {loadError && (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void loadRecords()}
                  >
                    {t("retry")}
                  </Button>
                }
              >
                {loadError}
              </Alert>
            )}
            {notice && <Alert severity="success">{notice}</Alert>}
            {inactive && <Alert severity="warning">{t("inactive")}</Alert>}
            {!access.canConfigureRequirements && (
              <Alert severity="info" icon={<LockOutlined />}>
                {t("configurationPermission")}
              </Alert>
            )}

            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography
                  sx={{ color: ws.text, fontSize: 14, fontWeight: 800 }}
                >
                  {t("current")}
                </Typography>
                {!editing && !inactive && access.canConfigureRequirements && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddOutlined />}
                    onClick={startNewVersion}
                    disabled={loading || !!loadError}
                    sx={{ textTransform: "none" }}
                  >
                    {t("newVersion")}
                  </Button>
                )}
              </Stack>
              {current ? (
                <CompensationCard item={current} locale={locale} t={t} />
              ) : (
                <Typography sx={{ color: ws.textDim, fontSize: 13 }}>
                  {t("none")}
                </Typography>
              )}
            </Box>

            {editing && (
              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2,
                  border: `1px solid ${ws.accentBorder}`,
                  bgcolor: ws.accentSoft,
                }}
              >
                <Typography
                  sx={{
                    color: ws.text,
                    fontSize: 14,
                    fontWeight: 800,
                    mb: 1.5,
                  }}
                >
                  {t("editHeading")}
                </Typography>
                <Stack spacing={1.5}>
                  {formError && <Alert severity="error">{formError}</Alert>}
                  <Alert severity="info">{t("immutableInfo")}</Alert>
                  <TextField
                    select
                    fullWidth
                    label={t("type")}
                    value={draft.compensationType}
                    disabled={saving}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        compensationType: event.target.value as
                          | "hourly"
                          | "fixed"
                          | "unpaid",
                      })
                    }
                  >
                    <MenuItem value="hourly">{t("hourly")}</MenuItem>
                    <MenuItem value="fixed">{t("fixed")}</MenuItem>
                    <MenuItem value="unpaid">{t("unpaid")}</MenuItem>
                  </TextField>

                  {draft.compensationType === "hourly" && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 1.5,
                      }}
                    >
                      <TextField
                        label={t("hourlyRate")}
                        value={draft.hourlyRate}
                        disabled={saving}
                        onChange={(event) =>
                          setDraft({ ...draft, hourlyRate: event.target.value })
                        }
                        inputProps={{ inputMode: "decimal" }}
                      />
                      <TextField
                        label={t("estimatedHours")}
                        value={draft.estimatedHours}
                        disabled={saving}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            estimatedHours: event.target.value,
                          })
                        }
                        inputProps={{ inputMode: "decimal" }}
                      />
                      <Box
                        sx={{
                          gridColumn: { sm: "1 / -1" },
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: ws.panel,
                          border: `1px solid ${ws.borderSoft}`,
                        }}
                      >
                        <Typography
                          sx={{ color: ws.textFaint, fontSize: 10.5 }}
                        >
                          {t("estimatedTotal")}
                        </Typography>
                        <Typography
                          sx={{ color: ws.text, fontSize: 17, fontWeight: 800 }}
                        >
                          {estimate === null
                            ? "—"
                            : money(estimate, "NOK", locale)}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {draft.compensationType === "fixed" && (
                    <TextField
                      fullWidth
                      label={t("fixedAmount")}
                      value={draft.fixedAmount}
                      disabled={saving}
                      onChange={(event) =>
                        setDraft({ ...draft, fixedAmount: event.target.value })
                      }
                      inputProps={{ inputMode: "decimal" }}
                    />
                  )}

                  {draft.compensationType === "unpaid" && (
                    <Alert severity="warning">{t("unpaidInfo")}</Alert>
                  )}

                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label={t("note")}
                    value={draft.note}
                    disabled={saving}
                    onChange={(event) =>
                      setDraft({ ...draft, note: event.target.value })
                    }
                    helperText={t("noteHelp")}
                    inputProps={{ maxLength: 2_001 }}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      onClick={() => {
                        setEditing(false);
                        setFormError("");
                        setIdempotencyKey("");
                      }}
                      disabled={saving}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => void save()}
                      disabled={saving || !idempotencyKey}
                      startIcon={
                        saving ? <CircularProgress size={16} /> : undefined
                      }
                    >
                      {saving ? t("saving") : t("save")}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            <Box>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <HistoryOutlined sx={{ color: ws.textDim, fontSize: 19 }} />
                <Typography
                  sx={{ color: ws.text, fontSize: 14, fontWeight: 800 }}
                >
                  {t("history")}
                </Typography>
              </Stack>
              {history.length ? (
                <Stack spacing={1}>
                  {history.map((item) => (
                    <CompensationCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: ws.textDim, fontSize: 13 }}>
                  {t("noHistory")}
                </Typography>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkspaceParticipantCompensationDialog;
