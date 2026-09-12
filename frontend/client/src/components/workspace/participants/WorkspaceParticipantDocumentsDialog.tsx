import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FamilyRestroomOutlined from "@mui/icons-material/FamilyRestroomOutlined";
import GavelOutlined from "@mui/icons-material/GavelOutlined";
import PolicyOutlined from "@mui/icons-material/PolicyOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import type {
  WorkspaceParticipantDocumentIssueInput,
  WorkspaceParticipantDocumentStatus,
  WorkspaceParticipantDocumentSummary,
  WorkspaceParticipantDocumentType,
} from "@shared/workspace-participant-documents";
import type { WorkspaceParticipantCompensation } from "@shared/workspace-participant-compensation";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { ws } from "../workspaceTheme";
import { WsTag } from "../ui";
import { makeT, type WsDict, useWsLocale, wsDateLocale } from "../wsLocale";
import {
  canReissueWorkspaceParticipantDocument,
  optionalDocumentText,
  parseWorkspaceParticipantDocumentList,
} from "./workspaceParticipantDocumentModel";
import {
  workspaceParticipantDocumentsApi,
  workspaceParticipantDocumentsError,
} from "./workspaceParticipantDocumentsApi";
import {
  workspaceParticipantCompensationApi,
  workspaceParticipantCompensationError,
} from "./workspaceParticipantCompensationApi";

const T: WsDict = {
  title: { no: "Dokumenter", en: "Documents" },
  subtitle: {
    no: "Kontrakt og mediesamtykke for",
    en: "Contract and media consent for",
  },
  viewOnly: {
    no: "Du kan lese dokumentstatus. Bare en prosjektadministrator kan utstede dokumenter eller sende nye lenker.",
    en: "You can view document status. Only a project administrator can issue documents or send new links.",
  },
  contract: { no: "Kontrakt", en: "Contract" },
  consent: { no: "Mediesamtykke", en: "Media consent" },
  issueContract: { no: "Utsted kontrakt", en: "Issue contract" },
  issueConsent: { no: "Utsted mediesamtykke", en: "Issue media consent" },
  empty: {
    no: "Ingen dokumenter er utstedt for denne personen.",
    en: "No documents have been issued for this participant.",
  },
  loading: { no: "Laster dokumenter…", en: "Loading documents…" },
  retry: { no: "Prøv igjen", en: "Try again" },
  close: { no: "Lukk", en: "Close" },
  cancel: { no: "Avbryt", en: "Cancel" },
  issue: { no: "Utsted dokument", en: "Issue document" },
  issuing: { no: "Utsteder…", en: "Issuing…" },
  renew: { no: "Send ny sikker lenke", en: "Send new secure link" },
  renewing: { no: "Sender…", en: "Sending…" },
  secureDeliveryInfo: {
    no: "Den personlige signeringslenken sendes direkte til den registrerte e-postadressen og vises aldri i workspace. CreatorHub verifiserer ikke mottakerens juridiske identitet.",
    en: "The personal signing link is sent directly to the registered email address and is never shown in the workspace. CreatorHub does not verify the recipient's legal identity.",
  },
  deliverySucceeded: {
    no: "En sikker signeringslenke ble sendt direkte til den registrerte e-postadressen. Av sikkerhetsgrunner vises lenken aldri her.",
    en: "A secure signing link was sent directly to the registered email address. For security reasons, the link is never shown here.",
  },
  deliveryFailed: {
    no: "Kunne ikke sende den sikre lenken. Kontroller mottakerens e-post eller e-postoppsettet, og prøv å sende en ny sikker lenke.",
    en: "The secure link could not be sent. Check the recipient's email or the email setup, then send a new secure link.",
  },
  deliveryFailedStatus: {
    no: "E-postlevering feilet – send en ny sikker lenke.",
    en: "Email delivery failed – send a new secure link.",
  },
  delivered: { no: "Levert via e-post", en: "Delivered by email" },
  signer: { no: "Mottaker", en: "Recipient" },
  issuedAt: { no: "Utstedt", en: "Issued" },
  expiresAt: { no: "Lenke utløper", en: "Link expires" },
  signedAt: { no: "Signert", en: "Signed" },
  documentTitle: {
    no: "Dokumenttittel (valgfritt)",
    en: "Document title (optional)",
  },
  expiry: { no: "Lenken er gyldig i dager", en: "Link valid for days" },
  workDescription: { no: "Beskrivelse av oppdraget", en: "Work description" },
  role: { no: "Rolle", en: "Role" },
  startsOn: { no: "Startdato", en: "Start date" },
  endsOn: { no: "Sluttdato", en: "End date" },
  compensation: {
    no: "Kanoniske honorarvilkår",
    en: "Canonical compensation terms",
  },
  compensationLoading: {
    no: "Laster gjeldende honorarvilkår…",
    en: "Loading current compensation terms…",
  },
  compensationNone: {
    no: "Ingen gjeldende honorarvilkår.",
    en: "No current compensation terms.",
  },
  compensationConfigureFirst: {
    no: "Konfigurer honorar først. Deltakeren krever gjeldende honorarvilkår før kontrakten kan utstedes.",
    en: "Configure compensation first. This participant requires current compensation terms before a contract can be issued.",
  },
  compensationRetry: {
    no: "Kunne ikke kontrollere honorarvilkårene. Prøv igjen før kontrakten utstedes.",
    en: "Could not verify the compensation terms. Retry before issuing the contract.",
  },
  compensationVersion: { no: "Versjon", en: "Version" },
  compensationAgreementNote: {
    no: "Merknad i avtalen (vises til medvirkende)",
    en: "Agreement note (visible to participant)",
  },
  cancellation: { no: "Avbestillingsvilkår", en: "Cancellation terms" },
  safety: { no: "Sikkerhetsvilkår", en: "Safety terms" },
  confidentiality: { no: "Konfidensialitet", en: "Confidentiality" },
  additional: { no: "Andre vilkår", en: "Additional terms" },
  mediaTypes: { no: "Medietyper", en: "Media types" },
  photo: { no: "Foto", en: "Photo" },
  video: { no: "Video", en: "Video" },
  audio: { no: "Lyd", en: "Audio" },
  purposes: {
    no: "Formål (én per linje eller kommaseparert)",
    en: "Purposes (one per line or comma-separated)",
  },
  channels: {
    no: "Kanaler (én per linje eller kommaseparert)",
    en: "Channels (one per line or comma-separated)",
  },
  territory: { no: "Geografisk område", en: "Territory" },
  duration: { no: "Varighet for bruk", en: "Usage duration" },
  retention: { no: "Lagring og sletting", en: "Retention and deletion" },
  editingAllowed: { no: "Redigering er tillatt", en: "Editing is allowed" },
  paidMediaAllowed: {
    no: "Betalt annonsering er tillatt",
    en: "Paid media is allowed",
  },
  withdrawalContact: {
    no: "Kontaktpunkt for tilbaketrekking",
    en: "Withdrawal contact",
  },
  guardianHeading: {
    no: "Foresatt må motta og signere",
    en: "A guardian must receive and sign",
  },
  guardianName: { no: "Foresattes navn", en: "Guardian name" },
  guardianEmail: { no: "Foresattes e-post", en: "Guardian email" },
  relationship: {
    no: "Relasjon til den mindreårige",
    en: "Relationship to minor",
  },
  requiredFields: {
    no: "Fyll ut alle obligatoriske felt.",
    en: "Complete all required fields.",
  },
  invalidDates: {
    no: "Sluttdato kan ikke være før startdato.",
    en: "End date cannot be before start date.",
  },
  mediaRequired: {
    no: "Velg minst én medietype, ett formål og én kanal.",
    en: "Select at least one media type, purpose, and channel.",
  },
};

const STATUS_LABELS: Record<
  WorkspaceParticipantDocumentStatus,
  { no: string; en: string }
> = {
  draft: { no: "Utkast", en: "Draft" },
  issued: { no: "Utstedt", en: "Issued" },
  viewed: { no: "Åpnet", en: "Viewed" },
  signed: { no: "Signert", en: "Signed" },
  declined: { no: "Avvist", en: "Declined" },
  withdrawn: { no: "Trukket tilbake", en: "Withdrawn" },
  expired: { no: "Utløpt", en: "Expired" },
  superseded: { no: "Erstattet", en: "Superseded" },
};

const STATUS_TONE: Record<
  WorkspaceParticipantDocumentStatus,
  "green" | "amber" | "red" | "blue" | "neutral"
> = {
  draft: "neutral",
  issued: "blue",
  viewed: "amber",
  signed: "green",
  declined: "red",
  withdrawn: "red",
  expired: "neutral",
  superseded: "neutral",
};

type MediaType = "photo" | "video" | "audio";
type ContractForm = {
  title: string;
  expiryDays: string;
  workDescription: string;
  role: string;
  startsOn: string;
  endsOn: string;
  cancellationTerms: string;
  safetyTerms: string;
  confidentialityTerms: string;
  additionalTerms: string;
};
type ConsentForm = {
  title: string;
  expiryDays: string;
  mediaTypes: MediaType[];
  purposes: string;
  channels: string;
  territory: string;
  duration: string;
  retention: string;
  editingAllowed: boolean;
  paidMediaAllowed: boolean;
  withdrawalContact: string;
  additionalTerms: string;
};
type GuardianForm = { name: string; email: string; relationship: string };

const EMPTY_CONTRACT: ContractForm = {
  title: "",
  expiryDays: "30",
  workDescription: "",
  role: "",
  startsOn: "",
  endsOn: "",
  cancellationTerms: "",
  safetyTerms: "",
  confidentialityTerms: "",
  additionalTerms: "",
};
const EMPTY_CONSENT: ConsentForm = {
  title: "",
  expiryDays: "30",
  mediaTypes: ["photo", "video"],
  purposes: "",
  channels: "",
  territory: "Norge",
  duration: "",
  retention: "",
  editingAllowed: true,
  paidMediaAllowed: false,
  withdrawalContact: "",
  additionalTerms: "",
};
const EMPTY_GUARDIAN: GuardianForm = { name: "", email: "", relationship: "" };

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  participant: WorkspaceProjectParticipant | null;
  access: Pick<
    WorkspaceParticipantAccess,
    "canView" | "canManage" | "canConfigureRequirements"
  >;
}

function dateLabel(value: string | null, locale: "no" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(wsDateLocale(locale), {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function compensationMoney(
  value: number | null,
  currency: string,
  locale: "no" | "en",
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(wsDateLocale(locale), {
    style: "currency",
    currency: currency || "NOK",
    maximumFractionDigits: 2,
  }).format(value);
}

function canonicalCompensationLabel(
  compensation: WorkspaceParticipantCompensation,
  locale: "no" | "en",
): string {
  if (compensation.compensationType === "hourly") {
    const hours = compensation.estimatedHours ?? 0;
    return `${compensationMoney(compensation.hourlyRate, compensation.currency, locale)} / ${locale === "en" ? "hour" : "time"} · ${hours} ${locale === "en" ? "hours" : "timer"} · ${compensationMoney(compensation.estimatedAmount, compensation.currency, locale)}`;
  }
  if (compensation.compensationType === "fixed") {
    return compensationMoney(
      compensation.fixedAmount ?? compensation.estimatedAmount,
      compensation.currency,
      locale,
    );
  }
  if (compensation.compensationType === "unpaid") {
    return locale === "en" ? "Unpaid engagement" : "Ubetalt oppdrag";
  }
  if (compensation.compensationType === "day_rate") {
    return `${compensationMoney(compensation.dayRate, compensation.currency, locale)} / ${locale === "en" ? "day" : "dag"}`;
  }
  return compensation.sharePercentage === null
    ? "—"
    : `${compensation.sharePercentage} %`;
}

export default function WorkspaceParticipantDocumentsDialog({
  open,
  onClose,
  projectId,
  participant,
  access,
}: Props) {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [documents, setDocuments] = useState<
    WorkspaceParticipantDocumentSummary[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [currentCompensation, setCurrentCompensation] =
    useState<WorkspaceParticipantCompensation | null>(null);
  const [compensationLoading, setCompensationLoading] = useState(false);
  const [compensationLoaded, setCompensationLoaded] = useState(false);
  const [compensationLoadError, setCompensationLoadError] = useState("");
  const [issueType, setIssueType] =
    useState<WorkspaceParticipantDocumentType | null>(null);
  const [contract, setContract] = useState<ContractForm>(EMPTY_CONTRACT);
  const [consent, setConsent] = useState<ConsentForm>(EMPTY_CONSENT);
  const [guardian, setGuardian] = useState<GuardianForm>(EMPTY_GUARDIAN);
  const [busy, setBusy] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<boolean | null>(
    null,
  );

  const clearTransientState = useCallback(() => {
    setIssueType(null);
    setDeliveryFeedback(null);
  }, []);

  const closeDialog = () => {
    clearTransientState();
    onClose();
  };

  const loadDocuments = useCallback(async () => {
    if (!participant || !access.canView) return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await workspaceParticipantDocumentsApi.list(
        projectId,
        participant.id,
      );
      setDocuments(response.documents);
    } catch (error) {
      setLoadError(workspaceParticipantDocumentsError(error).message);
    } finally {
      setLoading(false);
    }
  }, [access.canView, participant, projectId]);

  const loadCompensation = useCallback(async () => {
    if (!participant || !access.canManage) return;
    setCompensationLoading(true);
    setCompensationLoadError("");
    setCompensationLoaded(false);
    try {
      const response = await workspaceParticipantCompensationApi.current(
        projectId,
        participant.id,
      );
      setCurrentCompensation(response.compensation);
    } catch (error) {
      setCurrentCompensation(null);
      setCompensationLoadError(
        workspaceParticipantCompensationError(error).message,
      );
    } finally {
      setCompensationLoading(false);
      setCompensationLoaded(true);
    }
  }, [access.canManage, participant, projectId]);

  useEffect(() => {
    if (!open) {
      clearTransientState();
      setCurrentCompensation(null);
      setCompensationLoading(false);
      setCompensationLoaded(false);
      setCompensationLoadError("");
      return;
    }
    clearTransientState();
    setMutationError("");
    if (access.canView) void loadDocuments();
    if (access.canManage) void loadCompensation();
  }, [
    access.canManage,
    access.canView,
    clearTransientState,
    loadCompensation,
    loadDocuments,
    open,
  ]);

  const startIssue = (type: WorkspaceParticipantDocumentType) => {
    if (!access.canConfigureRequirements) return;
    setMutationError("");
    setDeliveryFeedback(null);
    setGuardian({ ...EMPTY_GUARDIAN });
    if (type === "contract") {
      setContract({ ...EMPTY_CONTRACT, role: participant?.roleLabel ?? "" });
    } else {
      setConsent({ ...EMPTY_CONSENT });
    }
    setIssueType(type);
  };

  const buildIssueInput = (): WorkspaceParticipantDocumentIssueInput | null => {
    if (!participant || !issueType) return null;
    const expiryDays = Number(
      issueType === "contract" ? contract.expiryDays : consent.expiryDays,
    );
    const title =
      issueType === "contract"
        ? optionalDocumentText(contract.title)
        : optionalDocumentText(consent.title);
    const common = {
      ...(title ? { title } : {}),
      invitationExpiresInDays: expiryDays,
      ...(participant.isMinor
        ? {
            guardian: {
              name: guardian.name.trim(),
              email: guardian.email.trim(),
              relationship: guardian.relationship.trim(),
            },
          }
        : {}),
    };

    if (issueType === "contract") {
      return {
        ...common,
        documentType: "contract",
        terms: {
          workDescription: contract.workDescription.trim(),
          role: contract.role.trim(),
          startsOn: optionalDocumentText(contract.startsOn),
          endsOn: optionalDocumentText(contract.endsOn),
          cancellationTerms: optionalDocumentText(contract.cancellationTerms),
          safetyTerms: optionalDocumentText(contract.safetyTerms),
          confidentialityTerms: optionalDocumentText(
            contract.confidentialityTerms,
          ),
          additionalTerms: optionalDocumentText(contract.additionalTerms),
        },
      };
    }
    return {
      ...common,
      documentType: "media_consent",
      terms: {
        mediaTypes: consent.mediaTypes,
        purposes: parseWorkspaceParticipantDocumentList(consent.purposes),
        channels: parseWorkspaceParticipantDocumentList(consent.channels),
        territory: consent.territory.trim(),
        duration: consent.duration.trim(),
        retention: consent.retention.trim(),
        editingAllowed: consent.editingAllowed,
        paidMediaAllowed: consent.paidMediaAllowed,
        withdrawalContact: consent.withdrawalContact.trim(),
        additionalTerms: optionalDocumentText(consent.additionalTerms),
      },
    };
  };

  const validateIssue = (
    input: WorkspaceParticipantDocumentIssueInput,
  ): string | null => {
    const expiry = input.invitationExpiresInDays ?? 0;
    if (!Number.isInteger(expiry) || expiry < 1 || expiry > 90)
      return t("requiredFields");
    if (
      participant?.isMinor &&
      (!guardian.name.trim() ||
        !guardian.email.trim() ||
        !guardian.relationship.trim())
    )
      return t("requiredFields");
    if (input.documentType === "contract") {
      if (!input.terms.workDescription || !input.terms.role)
        return t("requiredFields");
      if (
        input.terms.startsOn &&
        input.terms.endsOn &&
        input.terms.endsOn < input.terms.startsOn
      )
        return t("invalidDates");
      return null;
    }
    if (
      !input.terms.mediaTypes.length ||
      !input.terms.purposes.length ||
      !input.terms.channels.length
    )
      return t("mediaRequired");
    if (
      !input.terms.territory ||
      !input.terms.duration ||
      !input.terms.retention ||
      !input.terms.withdrawalContact
    )
      return t("requiredFields");
    return null;
  };

  const issueDocument = async () => {
    if (!participant || !access.canConfigureRequirements) return;
    if (
      issueType === "contract" &&
      participant.requiresCompensation &&
      (!compensationLoaded ||
        compensationLoadError ||
        currentCompensation?.status !== "active")
    ) {
      setMutationError(
        compensationLoadError
          ? t("compensationRetry")
          : t("compensationConfigureFirst"),
      );
      return;
    }
    const input = buildIssueInput();
    if (!input) return;
    const validationError = validateIssue(input);
    if (validationError) {
      setMutationError(validationError);
      return;
    }
    setBusy(true);
    setMutationError("");
    try {
      const result = await workspaceParticipantDocumentsApi.issue(
        projectId,
        participant.id,
        input,
      );
      setDeliveryFeedback(result.delivery.sent);
      setIssueType(null);
      await loadDocuments();
    } catch (error) {
      setMutationError(workspaceParticipantDocumentsError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const renewLink = async (document: WorkspaceParticipantDocumentSummary) => {
    if (!participant || !access.canConfigureRequirements) return;
    setBusyDocumentId(document.id);
    setMutationError("");
    try {
      const result = await workspaceParticipantDocumentsApi.reissueLink(
        projectId,
        participant.id,
        document.id,
      );
      setDeliveryFeedback(result.delivery.sent);
      await loadDocuments();
    } catch (error) {
      setMutationError(workspaceParticipantDocumentsError(error).message);
    } finally {
      setBusyDocumentId(null);
    }
  };

  const toggleMediaType = (type: MediaType) => {
    setConsent((current) => ({
      ...current,
      mediaTypes: current.mediaTypes.includes(type)
        ? current.mediaTypes.filter((entry) => entry !== type)
        : [...current.mediaTypes, type],
    }));
  };

  const title = issueType
    ? issueType === "contract"
      ? t("issueContract")
      : t("issueConsent")
    : t("title") + " · " + (participant?.displayName ?? "");
  const compensationBlocksContract =
    issueType === "contract" &&
    !!participant?.requiresCompensation &&
    (!compensationLoaded ||
      !!compensationLoadError ||
      currentCompensation?.status !== "active");

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy && !busyDocumentId) closeDialog();
      }}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 850, fontSize: 18 }}>
            {title}
          </Typography>
          {!issueType && participant && (
            <Typography sx={{ color: ws.textDim, fontSize: 12 }}>
              {t("subtitle") + " " + participant.displayName}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label={t("close")}
          onClick={closeDialog}
          disabled={busy || !!busyDocumentId}
        >
          <CloseOutlined />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!access.canView ? (
          <Alert severity="warning">{t("viewOnly")}</Alert>
        ) : issueType ? (
          <Stack spacing={2}>
            {mutationError && <Alert severity="error">{mutationError}</Alert>}
            <Alert severity="info">{t("secureDeliveryInfo")}</Alert>
            {issueType === "contract" ? (
              <>
                <TextField
                  label={t("documentTitle")}
                  value={contract.title}
                  onChange={(event) =>
                    setContract({ ...contract, title: event.target.value })
                  }
                  fullWidth
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    required
                    label={t("role")}
                    value={contract.role}
                    onChange={(event) =>
                      setContract({ ...contract, role: event.target.value })
                    }
                  />
                  <TextField
                    required
                    type="number"
                    label={t("expiry")}
                    value={contract.expiryDays}
                    inputProps={{ min: 1, max: 90 }}
                    onChange={(event) =>
                      setContract({
                        ...contract,
                        expiryDays: event.target.value,
                      })
                    }
                  />
                </Box>
                <TextField
                  required
                  label={t("workDescription")}
                  value={contract.workDescription}
                  onChange={(event) =>
                    setContract({
                      ...contract,
                      workDescription: event.target.value,
                    })
                  }
                  multiline
                  minRows={3}
                  fullWidth
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    type="date"
                    label={t("startsOn")}
                    value={contract.startsOn}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) =>
                      setContract({ ...contract, startsOn: event.target.value })
                    }
                  />
                  <TextField
                    type="date"
                    label={t("endsOn")}
                    value={contract.endsOn}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) =>
                      setContract({ ...contract, endsOn: event.target.value })
                    }
                  />
                </Box>
                <Box
                  sx={{
                    border: "1px solid " + ws.border,
                    borderRadius: 2,
                    bgcolor: ws.panelAlt,
                    p: 1.5,
                  }}
                >
                  <Typography sx={{ fontSize: 12.5, fontWeight: 850, mb: 0.8 }}>
                    {t("compensation")}
                  </Typography>
                  {compensationLoading || !compensationLoaded ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography sx={{ color: ws.textDim, fontSize: 12 }}>
                        {t("compensationLoading")}
                      </Typography>
                    </Stack>
                  ) : compensationLoadError ? (
                    <Alert
                      severity="error"
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => void loadCompensation()}
                        >
                          {t("retry")}
                        </Button>
                      }
                    >
                      {t("compensationRetry")}
                    </Alert>
                  ) : currentCompensation ? (
                    <Stack spacing={0.5}>
                      <Typography
                        sx={{ color: ws.text, fontSize: 13.5, fontWeight: 800 }}
                      >
                        {canonicalCompensationLabel(
                          currentCompensation,
                          locale,
                        )}
                      </Typography>
                      <Typography sx={{ color: ws.textFaint, fontSize: 11 }}>
                        {t("compensationVersion")} {currentCompensation.version}
                      </Typography>
                      {currentCompensation.note && (
                        <Box>
                          <Typography
                            sx={{ color: ws.textFaint, fontSize: 10.5 }}
                          >
                            {t("compensationAgreementNote")}
                          </Typography>
                          <Typography
                            sx={{ color: ws.textDim, fontSize: 11.5 }}
                          >
                            {currentCompensation.note}
                          </Typography>
                        </Box>
                      )}
                      {participant?.requiresCompensation &&
                        currentCompensation.status !== "active" && (
                          <Alert severity="warning" sx={{ mt: 0.5 }}>
                            {t("compensationConfigureFirst")}
                          </Alert>
                        )}
                    </Stack>
                  ) : (
                    <Alert
                      severity={
                        participant?.requiresCompensation ? "warning" : "info"
                      }
                    >
                      {participant?.requiresCompensation
                        ? t("compensationConfigureFirst")
                        : t("compensationNone")}
                    </Alert>
                  )}
                </Box>
                {[
                  ["cancellationTerms", t("cancellation")],
                  ["safetyTerms", t("safety")],
                  ["confidentialityTerms", t("confidentiality")],
                  ["additionalTerms", t("additional")],
                ].map(([field, label]) => (
                  <TextField
                    key={field}
                    label={label}
                    value={contract[field as keyof ContractForm]}
                    onChange={(event) =>
                      setContract({ ...contract, [field]: event.target.value })
                    }
                    multiline
                    minRows={2}
                    fullWidth
                  />
                ))}
              </>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    label={t("documentTitle")}
                    value={consent.title}
                    onChange={(event) =>
                      setConsent({ ...consent, title: event.target.value })
                    }
                  />
                  <TextField
                    required
                    type="number"
                    label={t("expiry")}
                    value={consent.expiryDays}
                    inputProps={{ min: 1, max: 90 }}
                    onChange={(event) =>
                      setConsent({ ...consent, expiryDays: event.target.value })
                    }
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, mb: 0.5 }}>
                    {t("mediaTypes")}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap">
                    {(["photo", "video", "audio"] as MediaType[]).map(
                      (type) => (
                        <FormControlLabel
                          key={type}
                          control={
                            <Checkbox
                              checked={consent.mediaTypes.includes(type)}
                              onChange={() => toggleMediaType(type)}
                            />
                          }
                          label={t(type)}
                        />
                      ),
                    )}
                  </Stack>
                </Box>
                <TextField
                  required
                  label={t("purposes")}
                  value={consent.purposes}
                  onChange={(event) =>
                    setConsent({ ...consent, purposes: event.target.value })
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  required
                  label={t("channels")}
                  value={consent.channels}
                  onChange={(event) =>
                    setConsent({ ...consent, channels: event.target.value })
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    required
                    label={t("territory")}
                    value={consent.territory}
                    onChange={(event) =>
                      setConsent({ ...consent, territory: event.target.value })
                    }
                  />
                  <TextField
                    required
                    label={t("duration")}
                    value={consent.duration}
                    onChange={(event) =>
                      setConsent({ ...consent, duration: event.target.value })
                    }
                  />
                </Box>
                <TextField
                  required
                  label={t("retention")}
                  value={consent.retention}
                  onChange={(event) =>
                    setConsent({ ...consent, retention: event.target.value })
                  }
                  fullWidth
                />
                <Stack direction={{ xs: "column", sm: "row" }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={consent.editingAllowed}
                        onChange={(event) =>
                          setConsent({
                            ...consent,
                            editingAllowed: event.target.checked,
                          })
                        }
                      />
                    }
                    label={t("editingAllowed")}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={consent.paidMediaAllowed}
                        onChange={(event) =>
                          setConsent({
                            ...consent,
                            paidMediaAllowed: event.target.checked,
                          })
                        }
                      />
                    }
                    label={t("paidMediaAllowed")}
                  />
                </Stack>
                <TextField
                  required
                  label={t("withdrawalContact")}
                  value={consent.withdrawalContact}
                  onChange={(event) =>
                    setConsent({
                      ...consent,
                      withdrawalContact: event.target.value,
                    })
                  }
                  fullWidth
                />
                <TextField
                  label={t("additional")}
                  value={consent.additionalTerms}
                  onChange={(event) =>
                    setConsent({
                      ...consent,
                      additionalTerms: event.target.value,
                    })
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
              </>
            )}

            {participant?.isMinor && (
              <Box
                sx={{
                  p: 2,
                  border: "1px solid " + ws.amber,
                  bgcolor: ws.amberSoft,
                  borderRadius: 2,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 1.5 }}
                >
                  <FamilyRestroomOutlined sx={{ color: ws.amber }} />
                  <Typography sx={{ fontWeight: 850, fontSize: 13.5 }}>
                    {t("guardianHeading")}
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    required
                    label={t("guardianName")}
                    value={guardian.name}
                    onChange={(event) =>
                      setGuardian({ ...guardian, name: event.target.value })
                    }
                  />
                  <TextField
                    required
                    type="email"
                    label={t("guardianEmail")}
                    value={guardian.email}
                    onChange={(event) =>
                      setGuardian({ ...guardian, email: event.target.value })
                    }
                  />
                  <TextField
                    required
                    label={t("relationship")}
                    value={guardian.relationship}
                    onChange={(event) =>
                      setGuardian({
                        ...guardian,
                        relationship: event.target.value,
                      })
                    }
                    sx={{ gridColumn: { sm: "1 / -1" } }}
                  />
                </Box>
              </Box>
            )}
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {!access.canConfigureRequirements && (
              <Alert severity="info">{t("viewOnly")}</Alert>
            )}
            {mutationError && <Alert severity="error">{mutationError}</Alert>}
            {deliveryFeedback !== null && (
              <Alert severity={deliveryFeedback ? "success" : "warning"}>
                {deliveryFeedback
                  ? t("deliverySucceeded")
                  : t("deliveryFailed")}
              </Alert>
            )}
            {loading ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
                <CircularProgress size={28} />
                <Typography sx={{ color: ws.textDim, fontSize: 13 }}>
                  {t("loading")}
                </Typography>
              </Stack>
            ) : loadError ? (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void loadDocuments()}
                  >
                    {t("retry")}
                  </Button>
                }
              >
                {loadError}
              </Alert>
            ) : !documents.length ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <DescriptionOutlined
                  sx={{ color: ws.textFaint, fontSize: 40 }}
                />
                <Typography sx={{ color: ws.textDim, fontSize: 13, mt: 1 }}>
                  {t("empty")}
                </Typography>
              </Box>
            ) : (
              documents.map((document) => {
                return (
                  <Box
                    key={document.id}
                    sx={{
                      border: "1px solid " + ws.border,
                      borderRadius: 2,
                      p: 1.75,
                      bgcolor: ws.panelAlt,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          {document.documentType === "contract" ? (
                            <GavelOutlined
                              sx={{ color: ws.accent, fontSize: 19 }}
                            />
                          ) : (
                            <PolicyOutlined
                              sx={{ color: ws.blue, fontSize: 19 }}
                            />
                          )}
                          <Typography
                            sx={{
                              color: ws.text,
                              fontWeight: 850,
                              fontSize: 14,
                            }}
                          >
                            {document.title}
                          </Typography>
                          <WsTag
                            label={STATUS_LABELS[document.status][locale]}
                            tone={STATUS_TONE[document.status]}
                          />
                          <Typography
                            sx={{ color: ws.textFaint, fontSize: 10.5 }}
                          >
                            {"v" + document.version}
                          </Typography>
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={2}
                          flexWrap="wrap"
                          sx={{ mt: 0.8 }}
                        >
                          <Typography
                            sx={{ color: ws.textDim, fontSize: 11.5 }}
                          >
                            {t("signer") + ": " + document.signer.name}
                          </Typography>
                          <Typography
                            sx={{ color: ws.textDim, fontSize: 11.5 }}
                          >
                            {t("issuedAt") +
                              ": " +
                              dateLabel(document.issuedAt, locale)}
                          </Typography>
                          {document.expiresAt && (
                            <Typography
                              sx={{ color: ws.textDim, fontSize: 11.5 }}
                            >
                              {t("expiresAt") +
                                ": " +
                                dateLabel(document.expiresAt, locale)}
                            </Typography>
                          )}
                          {document.signedAt && (
                            <Typography
                              sx={{ color: ws.textDim, fontSize: 11.5 }}
                            >
                              {t("signedAt") +
                                ": " +
                                dateLabel(document.signedAt, locale)}
                            </Typography>
                          )}
                        </Stack>
                        {document.delivery.status && (
                          <Typography
                            sx={{
                              color:
                                document.delivery.status === "sent"
                                  ? ws.green
                                  : ws.textFaint,
                              fontSize: 10.5,
                              mt: 0.6,
                            }}
                          >
                            {document.delivery.status === "sent"
                              ? t("delivered")
                              : t("deliveryFailedStatus")}
                          </Typography>
                        )}
                      </Box>
                      {access.canConfigureRequirements &&
                        canReissueWorkspaceParticipantDocument(
                          document.status,
                        ) && (
                          <Button
                            size="small"
                            startIcon={
                              busyDocumentId === document.id ? (
                                <CircularProgress size={14} />
                              ) : (
                                <RefreshOutlined />
                              )
                            }
                            onClick={() => void renewLink(document)}
                            disabled={!!busyDocumentId || busy}
                            sx={{
                              alignSelf: { sm: "flex-start" },
                              textTransform: "none",
                            }}
                          >
                            {busyDocumentId === document.id
                              ? t("renewing")
                              : t("renew")}
                          </Button>
                        )}
                    </Stack>
                  </Box>
                );
              })
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {issueType ? (
          <>
            <Button onClick={() => setIssueType(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={() => void issueDocument()}
              disabled={
                busy ||
                !access.canConfigureRequirements ||
                compensationBlocksContract
              }
              startIcon={busy ? <CircularProgress size={16} /> : undefined}
            >
              {busy ? t("issuing") : t("issue")}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={closeDialog}>{t("close")}</Button>
            {access.canConfigureRequirements && (
              <>
                <Button
                  startIcon={<GavelOutlined />}
                  onClick={() => startIssue("contract")}
                >
                  {t("issueContract")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PolicyOutlined />}
                  onClick={() => startIssue("media_consent")}
                >
                  {t("issueConsent")}
                </Button>
              </>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
