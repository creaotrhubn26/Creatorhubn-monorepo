import React, { useCallback, useEffect, useRef, useState } from "react";
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
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import type {
  WorkspaceParticipantWorkPermitClearanceResponse,
  WorkspaceParticipantWorkPermitClearanceStatus,
} from "@shared/workspace-participant-clearance";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { ws } from "../workspaceTheme";
import { WsTag } from "../ui";
import { makeT, type WsDict, useWsLocale, wsDateLocale } from "../wsLocale";
import {
  workspaceParticipantClearanceApi,
  workspaceParticipantClearanceError,
} from "./workspaceParticipantClearanceApi";
import {
  buildWorkspaceParticipantClearanceRequest,
  type WorkspaceParticipantClearanceValidationCode,
} from "./workspaceParticipantClearanceModel";

const T: WsDict = {
  title: { no: "Arbeidstillatelse", en: "Work permit" },
  subtitle: { no: "Juridisk avklaring for", en: "Legal clearance for" },
  permission: {
    no: "Kun prosjekteier eller Enterprise-admin kan se bevis og behandle arbeidstillatelse.",
    en: "Only the project owner or an Enterprise admin can view evidence and manage work permits.",
  },
  notMinor: {
    no: "Arbeidstillatelse kan bare behandles for en mindreårig.",
    en: "A work permit can only be managed for a minor.",
  },
  loading: { no: "Laster avklaring…", en: "Loading clearance…" },
  retry: { no: "Prøv igjen", en: "Retry" },
  close: { no: "Lukk", en: "Close" },
  current: { no: "Gjeldende status", en: "Current status" },
  status: { no: "Ny status", en: "New status" },
  pending: { no: "Venter", en: "Pending" },
  approved: { no: "Godkjent", en: "Approved" },
  rejected: { no: "Avvist", en: "Rejected" },
  notRequired: { no: "Ikke påkrevd", en: "Not required" },
  required: { no: "Påkrevd", en: "Required" },
  evidence: {
    no: "Sikker bevisreferanse",
    en: "Secure evidence reference",
  },
  evidenceHelp: {
    no: "Bruk en HTTPS-lenke uten brukernavn/passord, eller creatorhub-document:/workspace-file: etterfulgt av UUID.",
    en: "Use an HTTPS URL without credentials, or creatorhub-document:/workspace-file: followed by a UUID.",
  },
  note: { no: "Internt notat", en: "Internal note" },
  save: { no: "Lagre avklaring", en: "Save clearance" },
  saving: { no: "Lagrer…", en: "Saving…" },
  saved: { no: "Arbeidstillatelsen er oppdatert.", en: "Work permit updated." },
  refreshFailed: {
    no: "Avklaringen er lagret, men rosteren kunne ikke oppdateres automatisk.",
    en: "The clearance was saved, but the roster could not refresh automatically.",
  },
  history: { no: "Historikk", en: "History" },
  noHistory: {
    no: "Ingen statusendringer ennå.",
    en: "No status changes yet.",
  },
  changed: { no: "Endret", en: "Changed" },
  evidenceRequired: {
    no: "Godkjent arbeidstillatelse krever en bevisreferanse.",
    en: "An approved work permit requires an evidence reference.",
  },
  invalidEvidence: {
    no: "Bruk en gyldig HTTPS-lenke eller intern CreatorHub-referanse.",
    en: "Use a valid HTTPS URL or internal CreatorHub reference.",
  },
  noteTooLong: {
    no: "Notatet kan ikke være lengre enn 2 000 tegn.",
    en: "The note cannot exceed 2,000 characters.",
  },
  invalidText: {
    no: "Feltet inneholder ugyldige kontrolltegn.",
    en: "The field contains invalid control characters.",
  },
  conflict: {
    no: "Medvirkende ble endret et annet sted. Nyeste status er lastet inn; kontroller og prøv igjen.",
    en: "The participant changed elsewhere. The latest status was loaded; review and retry.",
  },
};

const EDITABLE_STATUSES: WorkspaceParticipantWorkPermitClearanceStatus[] = [
  "pending",
  "approved",
  "rejected",
  "not_required",
];

function statusLabel(status: string, locale: "no" | "en"): string {
  const labels: Record<string, { no: string; en: string }> = {
    required: { no: "Påkrevd", en: "Required" },
    pending: { no: "Venter", en: "Pending" },
    approved: { no: "Godkjent", en: "Approved" },
    rejected: { no: "Avvist", en: "Rejected" },
    not_required: { no: "Ikke påkrevd", en: "Not required" },
  };
  return labels[status]?.[locale] ?? status;
}

function statusTone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "approved" || status === "not_required") return "green";
  if (status === "rejected") return "red";
  if (status === "pending" || status === "required") return "amber";
  return "neutral";
}

function dateLabel(value: string, locale: "no" | "en"): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString(wsDateLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function validationMessage(
  code: WorkspaceParticipantClearanceValidationCode,
  t: (key: string) => string,
): string {
  const keys: Record<WorkspaceParticipantClearanceValidationCode, string> = {
    invalid_version: "conflict",
    evidence_required: "evidenceRequired",
    invalid_evidence: "invalidEvidence",
    note_too_long: "noteTooLong",
    control_characters: "invalidText",
  };
  return t(keys[code]);
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  participant: WorkspaceProjectParticipant | null;
  access: Pick<WorkspaceParticipantAccess, "canConfigureRequirements">;
  onSaved: () => void | Promise<void>;
}

export default function WorkspaceParticipantWorkPermitDialog({
  open,
  onClose,
  projectId,
  participant,
  access,
  onSaved,
}: Props) {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const loadSequence = useRef(0);
  const [data, setData] =
    useState<WorkspaceParticipantWorkPermitClearanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] =
    useState<WorkspaceParticipantWorkPermitClearanceStatus>("pending");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const applyData = useCallback(
    (response: WorkspaceParticipantWorkPermitClearanceResponse) => {
      setData(response);
      setStatus(
        EDITABLE_STATUSES.includes(
          response.clearance
            .status as WorkspaceParticipantWorkPermitClearanceStatus,
        )
          ? (response.clearance
              .status as WorkspaceParticipantWorkPermitClearanceStatus)
          : "pending",
      );
      setEvidenceReference(
        response.clearance.latestChange?.evidenceReference ?? "",
      );
      setNote(response.clearance.latestChange?.note ?? "");
    },
    [],
  );

  const load = useCallback(async () => {
    if (!participant?.isMinor || !access.canConfigureRequirements) return null;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await workspaceParticipantClearanceApi.get(
        projectId,
        participant.id,
      );
      if (sequence !== loadSequence.current) return null;
      applyData(response);
      return response;
    } catch (error) {
      if (sequence === loadSequence.current) {
        setLoadError(workspaceParticipantClearanceError(error).message);
      }
      return null;
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [access.canConfigureRequirements, applyData, participant, projectId]);

  useEffect(() => {
    if (!open) {
      loadSequence.current += 1;
      setData(null);
      setLoading(false);
      setLoadError("");
      setStatus("pending");
      setEvidenceReference("");
      setNote("");
      setFormError("");
      setNotice("");
      setSaving(false);
      return;
    }
    if (participant?.isMinor && access.canConfigureRequirements) void load();
  }, [access.canConfigureRequirements, load, open, participant]);

  const save = async () => {
    if (
      !participant ||
      !participant.isMinor ||
      !access.canConfigureRequirements ||
      !data ||
      saving
    ) {
      return;
    }
    const built = buildWorkspaceParticipantClearanceRequest({
      version: data.clearance.participantVersion,
      status,
      evidenceReference,
      note,
    });
    if (!built.ok) {
      setFormError(validationMessage(built.code, t));
      return;
    }

    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      const response = await workspaceParticipantClearanceApi.update(
        projectId,
        participant.id,
        built.request,
      );
      setData((current) =>
        current
          ? {
              clearance: response.clearance,
              history: [
                response.change,
                ...current.history.filter(
                  (change) => change.id !== response.change.id,
                ),
              ],
              access: response.access,
            }
          : current,
      );
      setEvidenceReference(response.change.evidenceReference ?? "");
      setNote(response.change.note ?? "");
      setStatus(response.change.status);
      setNotice(t("saved"));
      try {
        await onSaved();
      } catch {
        setNotice(t("refreshFailed"));
      }
    } catch (error) {
      const apiError = workspaceParticipantClearanceError(error);
      if (apiError.code === "version_conflict") {
        await load();
        setFormError(t("conflict"));
      } else {
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
      maxWidth="sm"
    >
      <DialogTitle>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <FactCheckOutlined sx={{ color: ws.accent }} />
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 850 }}>
              {t("title")}
            </Typography>
            <Typography sx={{ color: ws.textDim, fontSize: 12.5 }}>
              {t("subtitle")} {participant?.displayName ?? "—"}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {!access.canConfigureRequirements ? (
          <Alert severity="info" icon={<LockOutlined />}>
            {t("permission")}
          </Alert>
        ) : participant && !participant.isMinor ? (
          <Alert severity="warning">{t("notMinor")}</Alert>
        ) : loading && !data ? (
          <Stack alignItems="center" spacing={1.25} sx={{ py: 5 }}>
            <CircularProgress size={26} />
            <Typography sx={{ color: ws.textDim, fontSize: 13 }}>
              {t("loading")}
            </Typography>
          </Stack>
        ) : loadError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void load()}>
                {t("retry")}
              </Button>
            }
          >
            {loadError}
          </Alert>
        ) : data ? (
          <Stack spacing={2}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {notice && <Alert severity="success">{notice}</Alert>}

            <Box>
              <Typography sx={{ color: ws.textFaint, fontSize: 11, mb: 0.5 }}>
                {t("current")}
              </Typography>
              <WsTag
                label={statusLabel(data.clearance.status, locale)}
                tone={statusTone(data.clearance.status)}
              />
            </Box>

            <TextField
              select
              label={t("status")}
              value={status}
              disabled={saving}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as WorkspaceParticipantWorkPermitClearanceStatus,
                )
              }
            >
              <MenuItem value="pending">{t("pending")}</MenuItem>
              <MenuItem value="approved">{t("approved")}</MenuItem>
              <MenuItem value="rejected">{t("rejected")}</MenuItem>
              <MenuItem value="not_required">{t("notRequired")}</MenuItem>
            </TextField>
            <TextField
              required={status === "approved"}
              label={t("evidence")}
              value={evidenceReference}
              disabled={saving}
              onChange={(event) => setEvidenceReference(event.target.value)}
              helperText={t("evidenceHelp")}
              inputProps={{ maxLength: 1_025 }}
              fullWidth
            />
            <TextField
              label={t("note")}
              value={note}
              disabled={saving}
              onChange={(event) => setNote(event.target.value)}
              inputProps={{ maxLength: 2_001 }}
              multiline
              minRows={2}
              fullWidth
            />

            <Divider sx={{ borderColor: ws.borderSoft }} />
            <Stack direction="row" spacing={0.75} alignItems="center">
              <HistoryOutlined sx={{ color: ws.textDim, fontSize: 19 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 850 }}>
                {t("history")}
              </Typography>
            </Stack>
            {data.history.length ? (
              <Stack spacing={1}>
                {data.history.map((change) => (
                  <Box
                    key={change.id}
                    sx={{
                      p: 1.25,
                      border: "1px solid " + ws.borderSoft,
                      borderRadius: 1.5,
                      bgcolor: ws.panelAlt,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={0.75}
                      justifyContent="space-between"
                    >
                      <WsTag
                        label={statusLabel(change.status, locale)}
                        tone={statusTone(change.status)}
                      />
                      <Typography sx={{ color: ws.textFaint, fontSize: 10.5 }}>
                        {t("changed")} {dateLabel(change.occurredAt, locale)}
                      </Typography>
                    </Stack>
                    {change.evidenceReference && (
                      <Typography
                        sx={{
                          color: ws.textDim,
                          fontSize: 11,
                          mt: 0.75,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {t("evidence")}: {change.evidenceReference}
                      </Typography>
                    )}
                    {change.note && (
                      <Typography
                        sx={{ color: ws.textDim, fontSize: 11.5, mt: 0.5 }}
                      >
                        {change.note}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ color: ws.textDim, fontSize: 12.5 }}>
                {t("noHistory")}
              </Typography>
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("close")}
        </Button>
        {access.canConfigureRequirements && participant?.isMinor && data && (
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
