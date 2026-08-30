/**
 * Standalone Enterprise roster for project extras and other on-camera
 * participants. The module is intentionally isolated from Role Room and from
 * project team seats: every request goes to the Workspace participant API.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
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
  InputAdornment,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArchiveOutlined from "@mui/icons-material/ArchiveOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import ContentPasteGoOutlined from "@mui/icons-material/ContentPasteGoOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import Groups2Outlined from "@mui/icons-material/Groups2Outlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import MoreVert from "@mui/icons-material/MoreVert";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import PersonOutline from "@mui/icons-material/PersonOutline";
import Search from "@mui/icons-material/Search";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import WorkspacePremiumOutlined from "@mui/icons-material/WorkspacePremiumOutlined";
import type {
  WorkspaceParticipantAccess,
  WorkspaceParticipantCreateInput,
  WorkspaceParticipantEngagementType,
  WorkspaceParticipantRequirementStatus,
  WorkspaceParticipantSummary,
  WorkspaceParticipantType,
  WorkspaceParticipantWorkflowStatus,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { ws } from "../workspaceTheme";
import {
  WsCard,
  WsErrorState,
  WsPageTitle,
  WsPills,
  WsStat,
  WsTag,
} from "../ui";
import { makeT, type WsDict, useWsLocale } from "../wsLocale";
import {
  workspaceParticipantsApi,
  workspaceParticipantsError,
} from "../participants/workspaceParticipantsApi";
import type { WorkspaceParticipantsAccessState } from "../participants/useWorkspaceParticipantsAccess";
import {
  parseWorkspaceParticipantPaste,
  workspaceParticipantReadinessCells,
  type WorkspaceParticipantCellState,
} from "../participants/workspaceParticipantsModel";
import WorkspaceParticipantDocumentsDialog from "../participants/WorkspaceParticipantDocumentsDialog";
import WorkspaceParticipantCompensationDialog from "../participants/WorkspaceParticipantCompensationDialog";
import WorkspaceParticipantWorkPermitDialog from "../participants/WorkspaceParticipantWorkPermitDialog";

const T: WsDict = {
  title: { no: "Statister & medvirkende", en: "Extras & participants" },
  subtitle: {
    no: "Eksterne prosjektdeltakere uten teamsete eller tilgang til workspacet.",
    en: "External project participants without a team seat or workspace access.",
  },
  addOne: { no: "Legg til person", en: "Add participant" },
  bulkAdd: { no: "Lim inn flere", en: "Paste multiple" },
  total: { no: "Totalt", en: "Total" },
  ready: { no: "Klar til opptak", en: "Ready for shoot" },
  blocked: { no: "Mangler noe", en: "Blocked" },
  minors: { no: "Mindreårige", en: "Minors" },
  all: { no: "Alle", en: "All" },
  notReady: { no: "Ikke klare", en: "Not ready" },
  search: {
    no: "Søk navn, e-post eller rolle",
    en: "Search name, email or role",
  },
  searchRestricted: { no: "Søk navn eller rolle", en: "Search name or role" },
  participant: { no: "Medvirkende", en: "Participant" },
  contact: { no: "Kontakt", en: "Contact" },
  contract: { no: "Kontrakt", en: "Contract" },
  mediaConsent: { no: "Mediesamtykke", en: "Media consent" },
  guardian: { no: "Foresatt / tillatelse", en: "Guardian / permit" },
  compensation: { no: "Honorar", en: "Compensation" },
  readiness: { no: "Klarstatus", en: "Readiness" },
  actions: { no: "Handlinger", en: "Actions" },
  statusReady: { no: "Avklart", en: "Complete" },
  statusMissing: { no: "Mangler", en: "Missing" },
  statusPending: { no: "Venter", en: "Pending" },
  statusRejected: { no: "Avvist", en: "Rejected" },
  statusHidden: { no: "Skjult", en: "Hidden" },
  statusNotRequired: { no: "Ikke påkrevd", en: "Not required" },
  emptyTitle: {
    no: "Ingen medvirkende er lagt til",
    en: "No participants added",
  },
  emptyBody: {
    no: "Legg til en person eller lim inn en liste fra regnearket ditt. De opprettes uten CreatorHub-konto og uten tilgang til prosjektet.",
    en: "Add one participant or paste a spreadsheet list. They are created without a CreatorHub account or project access.",
  },
  noResults: {
    no: "Ingen medvirkende matcher filteret.",
    en: "No participants match the filter.",
  },
  viewOnly: {
    no: "Du har lesetilgang. En prosjektadministrator må gjøre endringer i rosteren.",
    en: "You have view access. A project administrator must change the roster.",
  },
  upgradeTitle: {
    no: "Enterprise-funksjon for foto og video",
    en: "Enterprise feature for photo and video",
  },
  upgradeBody: {
    no: "Statister og medvirkende kan administreres av Enterprise-organisasjoner. Personene blir ikke teammedlemmer og bruker ingen teamseter.",
    en: "Extras and participants can be managed by Enterprise organizations. They do not become team members or consume team seats.",
  },
  seeEnterprise: { no: "Se Enterprise", en: "View Enterprise" },
  permissionTitle: {
    no: "Du har ikke tilgang til denne funksjonen",
    en: "You do not have access to this feature",
  },
  permissionBody: {
    no: "Be organisasjonens administrator om tilgang til medvirkende i dette prosjektet.",
    en: "Ask your organization administrator for access to participants in this project.",
  },
  sampleTitle: { no: "Velg et ekte prosjekt", en: "Choose a real project" },
  sampleBody: {
    no: "Eksempelprosjektet lagrer ikke statister eller medvirkende.",
    en: "The sample project does not store extras or participants.",
  },
  loadError: {
    no: "Kunne ikke laste statister og medvirkende. Sjekk tilkoblingen og prøv igjen.",
    en: "Could not load extras and participants. Check the connection and try again.",
  },
  edit: { no: "Rediger", en: "Edit" },
  documents: { no: "Dokumenter", en: "Documents" },
  compensationAction: {
    no: "Honorar / timesats",
    en: "Compensation / hourly rate",
  },
  workPermitAction: {
    no: "Arbeidstillatelse",
    en: "Work permit",
  },
  archive: { no: "Arkiver", en: "Archive" },
  saved: { no: "Medvirkende lagret.", en: "Participant saved." },
  archived: { no: "Medvirkende arkivert.", en: "Participant archived." },
  bulkSaved: { no: "Listen er importert.", en: "The list was imported." },
  dialogAdd: { no: "Legg til medvirkende", en: "Add participant" },
  dialogEdit: { no: "Rediger medvirkende", en: "Edit participant" },
  name: { no: "Fullt navn", en: "Full name" },
  email: { no: "E-post", en: "Email" },
  phone: { no: "Telefon", en: "Phone" },
  role: { no: "Rolle i produksjonen", en: "Production role" },
  participantType: { no: "Type medvirkende", en: "Participant type" },
  engagementType: { no: "Engasjement", en: "Engagement" },
  workflowStatus: { no: "Arbeidsflytstatus", en: "Workflow status" },
  minor: { no: "Personen er mindreårig", en: "Participant is a minor" },
  requirements: { no: "Påkrevde avklaringer", en: "Required clearances" },
  requirementsReadOnly: {
    no: "Kun prosjekteier eller Enterprise-admin kan endre hvilke avklaringer som kreves.",
    en: "Only the project owner or an Enterprise admin can change which clearances are required.",
  },
  requiresContract: { no: "Kontrakt", en: "Contract" },
  requiresConsent: { no: "Mediesamtykke", en: "Media consent" },
  requiresCompensation: { no: "Honoraravtale", en: "Compensation agreement" },
  guardianStatus: { no: "Foresattstatus", en: "Guardian status" },
  guardianAcceptedAssurance: {
    no: "Akseptert via e-postlenke – identitet ikke eID-verifisert",
    en: "Accepted via email link – identity not eID-verified",
  },
  permitStatus: { no: "Arbeidstillatelse", en: "Work permit" },
  notes: { no: "Interne notater", en: "Internal notes" },
  cancel: { no: "Avbryt", en: "Cancel" },
  save: { no: "Lagre", en: "Save" },
  saving: { no: "Lagrer…", en: "Saving…" },
  archiveTitle: { no: "Arkiver medvirkende?", en: "Archive participant?" },
  archiveBody: {
    no: "Personen fjernes fra den aktive prosjektlisten. Historikken beholdes.",
    en: "The participant is removed from the active project list. History is retained.",
  },
  bulkTitle: { no: "Lim inn liste", en: "Paste list" },
  bulkHelp: {
    no: "Lim inn fra Excel, Numbers eller Google Sheets. Standard rekkefølge: navn, e-post, telefon, rolle. Du kan også bruke en overskriftsrad.",
    en: "Paste from Excel, Numbers or Google Sheets. Default order: name, email, phone, role. A header row is also supported.",
  },
  bulkPlaceholder: {
    no: "Navn\tE-post\tTelefon\tRolle\nKari Nordmann\tkari@eksempel.no\t+47 900 00 000\tStatist",
    en: "Name\tEmail\tPhone\tRole\nAlex Smith\talex@example.com\t+47 900 00 000\tExtra",
  },
  import: { no: "Importer", en: "Import" },
  validRows: { no: "gyldige rader", en: "valid rows" },
  invalidRows: {
    no: "ugyldige rader blir hoppet over",
    en: "invalid rows will be skipped",
  },
  maxRows: {
    no: "Maksimalt 100 personer kan importeres om gangen.",
    en: "A maximum of 100 participants can be imported at a time.",
  },
  missingName: { no: "Navn er påkrevd.", en: "Name is required." },
  invalidEmail: {
    no: "Skriv inn en gyldig e-postadresse.",
    en: "Enter a valid email address.",
  },
  conflict: {
    no: "Opplysningene ble endret et annet sted. Listen er oppdatert; åpne personen og prøv igjen.",
    en: "The participant was changed elsewhere. The list was refreshed; open the participant and try again.",
  },
  contractCompensationStale: {
    no: "Kontrakten må signeres på nytt etter endrede honorarvilkår",
    en: "The contract must be signed again after compensation terms changed",
  },
};

const PARTICIPANT_TYPE_LABELS: Record<
  WorkspaceParticipantType,
  { no: string; en: string }
> = {
  extra: { no: "Statist", en: "Extra" },
  model: { no: "Modell", en: "Model" },
  featured: { no: "Fremhevet medvirkende", en: "Featured participant" },
  interviewee: { no: "Intervjuobjekt", en: "Interviewee" },
  other: { no: "Annet", en: "Other" },
};

const ENGAGEMENT_LABELS: Record<
  WorkspaceParticipantEngagementType,
  { no: string; en: string }
> = {
  undecided: { no: "Ikke avklart", en: "Undecided" },
  employee: { no: "Arbeidstaker", en: "Employee" },
  contractor: { no: "Oppdragstaker", en: "Contractor" },
  agency: { no: "Via byrå", en: "Via agency" },
  volunteer: { no: "Frivillig", en: "Volunteer" },
};

const WORKFLOW_LABELS: Record<
  WorkspaceParticipantWorkflowStatus,
  { no: string; en: string }
> = {
  draft: { no: "Utkast", en: "Draft" },
  invited: { no: "Invitert", en: "Invited" },
  confirmed: { no: "Bekreftet", en: "Confirmed" },
  completed: { no: "Fullført", en: "Completed" },
  cancelled: { no: "Avlyst", en: "Cancelled" },
  archived: { no: "Arkivert", en: "Archived" },
};

const REQUIREMENT_LABELS: Record<
  WorkspaceParticipantRequirementStatus,
  { no: string; en: string }
> = {
  not_required: { no: "Ikke påkrevd", en: "Not required" },
  required: { no: "Påkrevd", en: "Required" },
  pending: { no: "Venter", en: "Pending" },
  approved: { no: "Godkjent", en: "Approved" },
  rejected: { no: "Avvist", en: "Rejected" },
};

const WORKFLOW_TONE: Record<
  WorkspaceParticipantWorkflowStatus,
  "green" | "amber" | "red" | "blue" | "neutral"
> = {
  draft: "neutral",
  invited: "blue",
  confirmed: "green",
  completed: "green",
  cancelled: "red",
  archived: "neutral",
};

interface WorkspaceParticipantsTabProps {
  projectId: string;
  /**
   * TeamWorkspacePage supplies its project-bound access query. When omitted,
   * the tab resolves the same endpoint itself (useful for isolated rendering).
   */
  accessState?: WorkspaceParticipantsAccessState;
}

type GateState =
  | "loading"
  | "allowed"
  | "upgrade"
  | "permission"
  | "sample"
  | "error";
type ListFilter = "all" | "ready" | "blocked" | "minor";

interface ParticipantFormState {
  displayName: string;
  email: string;
  phone: string;
  roleLabel: string;
  participantType: WorkspaceParticipantType;
  engagementType: WorkspaceParticipantEngagementType;
  workflowStatus: WorkspaceParticipantWorkflowStatus;
  isMinor: boolean;
  guardianStatus: WorkspaceParticipantRequirementStatus;
  workPermitStatus: WorkspaceParticipantRequirementStatus;
  requiresContract: boolean;
  requiresMediaConsent: boolean;
  requiresCompensation: boolean;
  notes: string;
}

const EMPTY_FORM: ParticipantFormState = {
  displayName: "",
  email: "",
  phone: "",
  roleLabel: "",
  participantType: "extra",
  engagementType: "undecided",
  workflowStatus: "draft",
  isMinor: false,
  guardianStatus: "not_required",
  workPermitStatus: "not_required",
  requiresContract: true,
  requiresMediaConsent: true,
  requiresCompensation: true,
  notes: "",
};

const formFromParticipant = (
  participant: WorkspaceProjectParticipant,
): ParticipantFormState => ({
  displayName: participant.displayName,
  email: participant.email || "",
  phone: participant.phone || "",
  roleLabel: participant.roleLabel || "",
  participantType: participant.participantType,
  engagementType: participant.engagementType,
  workflowStatus: participant.workflowStatus,
  isMinor: participant.isMinor,
  guardianStatus: participant.guardianStatus,
  workPermitStatus: participant.workPermitStatus,
  requiresContract: participant.requiresContract,
  requiresMediaConsent: participant.requiresMediaConsent,
  requiresCompensation: participant.requiresCompensation,
  notes: participant.notes || "",
});

const inputFromForm = (
  form: ParticipantFormState,
): WorkspaceParticipantCreateInput => ({
  displayName: form.displayName.trim(),
  email: form.email.trim().toLocaleLowerCase("nb-NO") || null,
  phone: form.phone.trim() || null,
  roleLabel: form.roleLabel.trim() || null,
  participantType: form.participantType,
  engagementType: form.engagementType,
  isMinor: form.isMinor,
  requiresContract: form.requiresContract,
  requiresMediaConsent: form.requiresMediaConsent,
  requiresCompensation: form.requiresCompensation,
  notes: form.notes.trim() || null,
});

const workflowOptionsFor = (
  status: WorkspaceParticipantWorkflowStatus,
  allowTerminalClosure = true,
): WorkspaceParticipantWorkflowStatus[] => {
  const transitions: Record<
    WorkspaceParticipantWorkflowStatus,
    WorkspaceParticipantWorkflowStatus[]
  > = {
    draft: ["draft", "invited", "confirmed", "cancelled"],
    invited: ["invited", "confirmed", "cancelled"],
    confirmed: ["confirmed", "completed", "cancelled"],
    completed: ["completed"],
    cancelled: ["cancelled"],
    archived: ["archived"],
  };
  return transitions[status].filter(
    (value) =>
      allowTerminalClosure || value !== "cancelled" || value === status,
  );
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoadingPanel() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={54} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} variant="rounded" height={86} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={280} />
    </Stack>
  );
}

function AccessPanel(props: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <WsCard
      sx={{ maxWidth: 680, mx: "auto", mt: 6, textAlign: "center", py: 5 }}
    >
      <Box
        sx={{
          width: 54,
          height: 54,
          borderRadius: 3,
          bgcolor: ws.accentSoft,
          color: ws.accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
        }}
      >
        {props.icon}
      </Box>
      <Typography sx={{ color: ws.text, fontSize: 20, fontWeight: 800 }}>
        {props.title}
      </Typography>
      <Typography
        sx={{
          color: ws.textDim,
          fontSize: 13.5,
          maxWidth: 520,
          mx: "auto",
          mt: 1,
          mb: props.action ? 2.5 : 0,
        }}
      >
        {props.body}
      </Typography>
      {props.action}
    </WsCard>
  );
}

function ReadinessTag(props: {
  state: WorkspaceParticipantCellState;
  t: (key: string) => string;
}) {
  const config: Record<
    WorkspaceParticipantCellState,
    {
      label: string;
      tone: "green" | "amber" | "red" | "neutral";
    }
  > = {
    ready: { label: props.t("statusReady"), tone: "green" },
    missing: { label: props.t("statusMissing"), tone: "amber" },
    pending: { label: props.t("statusPending"), tone: "amber" },
    rejected: { label: props.t("statusRejected"), tone: "red" },
    hidden: { label: props.t("statusHidden"), tone: "neutral" },
    not_required: { label: props.t("statusNotRequired"), tone: "neutral" },
  };
  return (
    <WsTag label={config[props.state].label} tone={config[props.state].tone} />
  );
}

function ParticipantRequirementGrid(props: {
  participant: WorkspaceProjectParticipant;
  t: (key: string) => string;
  contactVisible: boolean;
}) {
  const cells = workspaceParticipantReadinessCells(props.participant, {
    contactVisible: props.contactVisible,
  });
  const rows = [
    [props.t("contact"), cells.contact],
    [props.t("contract"), cells.contract],
    [props.t("mediaConsent"), cells.mediaConsent],
    [props.t("guardian"), cells.guardian],
    [props.t("compensation"), cells.compensation],
  ] as const;
  return (
    <Box
      sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mt: 1.5 }}
    >
      {rows.map(([label, state]) => (
        <Box key={label}>
          <Typography sx={{ color: ws.textFaint, fontSize: 10.5, mb: 0.4 }}>
            {label}
          </Typography>
          <ReadinessTag state={state} t={props.t} />
        </Box>
      ))}
    </Box>
  );
}

const WorkspaceParticipantsTab: React.FC<WorkspaceParticipantsTabProps> = ({
  projectId,
  accessState,
}) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [gate, setGate] = useState<GateState>("loading");
  const [gateReason, setGateReason] = useState("");
  const [access, setAccess] = useState<WorkspaceParticipantAccess | null>(null);
  const [participants, setParticipants] = useState<
    WorkspaceProjectParticipant[]
  >([]);
  const [summary, setSummary] = useState<WorkspaceParticipantSummary>({
    total: 0,
    ready: 0,
    blocked: 0,
    archived: 0,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceProjectParticipant | null>(
    null,
  );
  const [form, setForm] = useState<ParticipantFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [archiveTarget, setArchiveTarget] =
    useState<WorkspaceProjectParticipant | null>(null);
  const [documentsTarget, setDocumentsTarget] =
    useState<WorkspaceProjectParticipant | null>(null);
  const [compensationTarget, setCompensationTarget] =
    useState<WorkspaceProjectParticipant | null>(null);
  const [workPermitTarget, setWorkPermitTarget] =
    useState<WorkspaceProjectParticipant | null>(null);
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    participant: WorkspaceProjectParticipant;
  } | null>(null);
  const hasProvidedAccessState = accessState !== undefined;
  const providedAccess = accessState?.access ?? null;
  const providedAccessError = accessState?.error ?? null;
  const providedAccessLoading = accessState?.loading ?? false;

  const applyList = useCallback(
    (response: {
      participants: WorkspaceProjectParticipant[];
      summary: WorkspaceParticipantSummary;
      access: WorkspaceParticipantAccess;
    }) => {
      setParticipants(response.participants);
      setSummary(response.summary);
      setAccess(response.access);
    },
    [],
  );

  const refreshList = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await workspaceParticipantsApi.list(projectId);
      applyList(response);
    } finally {
      setRefreshing(false);
    }
  }, [applyList, projectId]);

  const load = useCallback(async () => {
    if (!projectId || projectId === "sample") {
      setGate("sample");
      return;
    }
    if (providedAccessLoading) {
      setGate("loading");
      return;
    }
    if (providedAccessError) {
      setGateReason(providedAccessError.message);
      if (providedAccessError.code === "enterprise_required")
        setGate("upgrade");
      else if (
        providedAccessError.code === "project_access_denied" ||
        providedAccessError.code === "participant_manage_denied" ||
        providedAccessError.code === "auth_required" ||
        providedAccessError.status === 401 ||
        providedAccessError.status === 403
      )
        setGate("permission");
      else setGate("error");
      return;
    }

    setGate("loading");
    setGateReason("");
    try {
      const projectAccess = hasProvidedAccessState
        ? providedAccess
        : await workspaceParticipantsApi.getAccess(projectId);
      if (!projectAccess) {
        setGateReason("Kunne ikke verifisere prosjekttilgangen.");
        setGate("error");
        return;
      }
      if (!projectAccess.canView) {
        setAccess(projectAccess);
        setGate("permission");
        return;
      }
      const response = await workspaceParticipantsApi.list(projectId);
      applyList(response);
      setGate("allowed");
    } catch (error) {
      const apiError = workspaceParticipantsError(error);
      setGateReason(apiError.message);
      if (apiError.code === "enterprise_required") setGate("upgrade");
      else if (
        apiError.code === "project_access_denied" ||
        apiError.code === "participant_manage_denied" ||
        apiError.code === "auth_required" ||
        apiError.status === 401 ||
        apiError.status === 403
      )
        setGate("permission");
      else setGate("error");
    }
  }, [
    applyList,
    hasProvidedAccessState,
    projectId,
    providedAccess,
    providedAccessError,
    providedAccessLoading,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const minorCount = useMemo(
    () => participants.filter((participant) => participant.isMinor).length,
    [participants],
  );

  const visibleParticipants = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase(locale === "en" ? "en-GB" : "nb-NO");
    return participants.filter((participant) => {
      if (filter === "ready" && !participant.readiness.ready) return false;
      if (filter === "blocked" && participant.readiness.ready) return false;
      if (filter === "minor" && !participant.isMinor) return false;
      if (!query) return true;
      const searchableValues = [participant.displayName, participant.roleLabel];
      if (access?.canManage) {
        searchableValues.push(participant.email, participant.phone);
      }
      return searchableValues.some((value) =>
        value
          ?.toLocaleLowerCase(locale === "en" ? "en-GB" : "nb-NO")
          .includes(query),
      );
    });
  }, [access?.canManage, filter, locale, participants, search]);

  const bulkResult = useMemo(
    () => parseWorkspaceParticipantPaste(bulkText),
    [bulkText],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setEditorOpen(true);
  };

  const openEdit = (participant: WorkspaceProjectParticipant) => {
    setEditing(participant);
    setForm(formFromParticipant(participant));
    setFormError("");
    setEditorOpen(true);
  };

  const setMinor = (isMinor: boolean) => {
    setForm((current) => ({
      ...current,
      isMinor,
      guardianStatus: isMinor
        ? current.guardianStatus === "not_required"
          ? "required"
          : current.guardianStatus
        : "not_required",
      workPermitStatus: isMinor
        ? current.workPermitStatus === "not_required"
          ? "required"
          : current.workPermitStatus
        : "not_required",
    }));
  };

  const saveParticipant = async () => {
    const input = inputFromForm(form);
    if (!input.displayName) {
      setFormError(t("missingName"));
      return;
    }
    if (input.email && !EMAIL_PATTERN.test(input.email)) {
      setFormError(t("invalidEmail"));
      return;
    }

    setSaving(true);
    setFormError("");
    setMutationError("");
    try {
      if (editing) {
        // Guardian/permit approvals are legal workflow state. The generic
        // roster editor must not transition them; dedicated legal clearance
        // commands own those fields.
        const {
          requiresContract,
          requiresMediaConsent,
          requiresCompensation,
          ...editableInput
        } = input;
        await workspaceParticipantsApi.update(projectId, editing.id, {
          ...editableInput,
          ...(access?.canConfigureRequirements
            ? {
                requiresContract,
                requiresMediaConsent,
                requiresCompensation,
              }
            : {}),
          workflowStatus: form.workflowStatus,
          version: editing.version,
        });
      } else {
        const {
          requiresContract,
          requiresMediaConsent,
          requiresCompensation,
          ...defaultInput
        } = input;
        await workspaceParticipantsApi.create(projectId, {
          ...defaultInput,
          ...(access?.canConfigureRequirements
            ? {
                requiresContract,
                requiresMediaConsent,
                requiresCompensation,
              }
            : {}),
        });
      }
      await refreshList();
      setEditorOpen(false);
      setNotice(t("saved"));
    } catch (error) {
      const apiError = workspaceParticipantsError(error);
      if (apiError.code === "version_conflict") {
        await refreshList().catch(() => undefined);
        setFormError(t("conflict"));
      } else {
        setFormError(apiError.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const importParticipants = async () => {
    if (!bulkResult.participants.length || bulkResult.participants.length > 100)
      return;
    setSaving(true);
    setMutationError("");
    try {
      const result = await workspaceParticipantsApi.bulkCreate(
        projectId,
        bulkResult.participants,
      );
      await refreshList();
      setBulkOpen(false);
      setBulkText("");
      const detail = result.existingCount
        ? " " + result.existingCount + " eksisterende ble ikke duplisert."
        : "";
      setNotice(t("bulkSaved") + detail);
    } catch (error) {
      setMutationError(workspaceParticipantsError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const archiveParticipant = async () => {
    if (!archiveTarget || !access?.canConfigureRequirements) return;
    setSaving(true);
    setMutationError("");
    try {
      await workspaceParticipantsApi.archive(
        projectId,
        archiveTarget.id,
        archiveTarget.version,
      );
      await refreshList();
      setArchiveTarget(null);
      setNotice(t("archived"));
    } catch (error) {
      const apiError = workspaceParticipantsError(error);
      if (apiError.code === "version_conflict") {
        await refreshList().catch(() => undefined);
        setArchiveTarget(null);
        setMutationError(t("conflict"));
      } else {
        setMutationError(apiError.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (gate === "loading") return <LoadingPanel />;
  if (gate === "sample") {
    return (
      <AccessPanel
        icon={<PersonOutline />}
        title={t("sampleTitle")}
        body={t("sampleBody")}
      />
    );
  }
  if (gate === "upgrade") {
    return (
      <AccessPanel
        icon={<WorkspacePremiumOutlined />}
        title={t("upgradeTitle")}
        body={t("upgradeBody")}
        action={
          <Button
            variant="contained"
            onClick={() => {
              window.location.href = "/pricing";
            }}
            sx={{
              bgcolor: ws.accent,
              color: ws.accentContrast,
              fontWeight: 800,
              textTransform: "none",
              "&:hover": { bgcolor: ws.accentHover },
            }}
          >
            {t("seeEnterprise")}
          </Button>
        }
      />
    );
  }
  if (gate === "permission") {
    return (
      <AccessPanel
        icon={<LockOutlined />}
        title={t("permissionTitle")}
        body={gateReason || t("permissionBody")}
      />
    );
  }
  if (gate === "error") {
    return (
      <WsErrorState message={t("loadError")} onRetry={() => void load()} />
    );
  }

  const canManage = !!access?.canManage;

  return (
    <Stack spacing={2}>
      <WsPageTitle
        icon={<Groups2Outlined sx={{ color: "#fff" }} />}
        title={t("title")}
        sub={t("subtitle")}
        actions={
          canManage ? (
            <>
              <Button
                startIcon={<ContentPasteGoOutlined />}
                onClick={() => {
                  setMutationError("");
                  setBulkOpen(true);
                }}
                sx={{
                  color: ws.textDim,
                  border: "1px solid " + ws.border,
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                {t("bulkAdd")}
              </Button>
              <Button
                variant="contained"
                startIcon={<PersonAddAltOutlined />}
                onClick={openCreate}
                sx={{
                  bgcolor: ws.accent,
                  color: ws.accentContrast,
                  textTransform: "none",
                  fontWeight: 800,
                  "&:hover": { bgcolor: ws.accentHover },
                }}
              >
                {t("addOne")}
              </Button>
            </>
          ) : undefined
        }
      />

      {notice && (
        <Alert severity="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      {mutationError && (
        <Alert severity="error" onClose={() => setMutationError("")}>
          {mutationError}
        </Alert>
      )}
      {!canManage && (
        <Alert severity="info" icon={<LockOutlined />}>
          {t("viewOnly")}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        <WsStat
          icon={<Groups2Outlined />}
          label={t("total")}
          value={summary.total}
          tone={ws.accentSoft}
        />
        <WsStat
          icon={<CheckCircleOutline />}
          label={t("ready")}
          value={summary.ready}
          tone={ws.greenSoft}
        />
        <WsStat
          icon={<WarningAmberOutlined />}
          label={t("blocked")}
          value={summary.blocked}
          tone={ws.amberSoft}
        />
        <WsStat
          icon={<PersonOutline />}
          label={t("minors")}
          value={minorCount}
          tone={ws.blueSoft}
        />
      </Box>

      <WsCard pad={1.5}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <WsPills
            value={filter}
            onChange={(value) => setFilter(value as ListFilter)}
            items={[
              { key: "all", label: t("all") },
              { key: "ready", label: t("ready") },
              { key: "blocked", label: t("notReady") },
              { key: "minor", label: t("minors") },
            ]}
          />
          <Stack direction="row" alignItems="center" spacing={1}>
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={canManage ? t("search") : t("searchRestricted")}
              inputProps={{
                "aria-label": canManage ? t("search") : t("searchRestricted"),
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: ws.textFaint, fontSize: 19 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: "100%", md: 300 } }}
            />
            {refreshing && (
              <CircularProgress size={18} sx={{ color: ws.accent }} />
            )}
          </Stack>
        </Stack>
      </WsCard>

      {!participants.length ? (
        <WsCard sx={{ textAlign: "center", py: 6 }}>
          <Groups2Outlined sx={{ color: ws.textFaint, fontSize: 46 }} />
          <Typography
            sx={{ color: ws.text, fontSize: 17, fontWeight: 800, mt: 1 }}
          >
            {t("emptyTitle")}
          </Typography>
          <Typography
            sx={{
              color: ws.textDim,
              fontSize: 13,
              maxWidth: 540,
              mx: "auto",
              mt: 0.75,
            }}
          >
            {t("emptyBody")}
          </Typography>
          {canManage && (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              sx={{ mt: 2.5 }}
            >
              <Button onClick={openCreate} startIcon={<PersonAddAltOutlined />}>
                {t("addOne")}
              </Button>
              <Button
                onClick={() => setBulkOpen(true)}
                startIcon={<ContentPasteGoOutlined />}
              >
                {t("bulkAdd")}
              </Button>
            </Stack>
          )}
        </WsCard>
      ) : !visibleParticipants.length ? (
        <WsCard sx={{ textAlign: "center", py: 4 }}>
          <Typography sx={{ color: ws.textDim, fontSize: 13 }}>
            {t("noResults")}
          </Typography>
        </WsCard>
      ) : (
        <>
          <TableContainer
            component={WsCard as React.ElementType}
            sx={{
              display: { xs: "none", md: "block" },
              p: "0 !important",
              overflowX: "auto",
            }}
          >
            <Table size="small" sx={{ minWidth: 1110 }}>
              <TableHead>
                <TableRow>
                  {[
                    t("participant"),
                    t("contact"),
                    t("contract"),
                    t("mediaConsent"),
                    t("guardian"),
                    t("compensation"),
                    t("readiness"),
                    t("actions"),
                  ].map((heading) => (
                    <TableCell
                      key={heading}
                      sx={{
                        color: ws.textDim,
                        borderColor: ws.borderSoft,
                        fontSize: 11,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleParticipants.map((participant) => {
                  const cells = workspaceParticipantReadinessCells(
                    participant,
                    {
                      contactVisible: canManage,
                    },
                  );
                  const blockers = participant.readiness.blockers
                    .map((blocker) =>
                      blocker === "contract_compensation_stale"
                        ? t("contractCompensationStale")
                        : blocker,
                    )
                    .join(", ");
                  return (
                    <TableRow key={participant.id} hover>
                      <TableCell
                        sx={{ borderColor: ws.borderSoft, minWidth: 220 }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.1}
                          alignItems="center"
                        >
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              bgcolor: ws.accentSoft,
                              color: ws.accent,
                              fontSize: 13,
                            }}
                          >
                            {participant.displayName.slice(0, 1).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              noWrap
                              sx={{
                                color: ws.text,
                                fontSize: 13,
                                fontWeight: 750,
                              }}
                            >
                              {participant.displayName}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.6}
                              alignItems="center"
                            >
                              <Typography
                                noWrap
                                sx={{ color: ws.textFaint, fontSize: 10.5 }}
                              >
                                {participant.roleLabel ||
                                  PARTICIPANT_TYPE_LABELS[
                                    participant.participantType
                                  ][locale]}
                              </Typography>
                              <WsTag
                                label={
                                  WORKFLOW_LABELS[participant.workflowStatus][
                                    locale
                                  ]
                                }
                                tone={WORKFLOW_TONE[participant.workflowStatus]}
                              />
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <Tooltip
                          title={
                            canManage
                              ? participant.email || participant.phone || ""
                              : ""
                          }
                        >
                          <span>
                            <ReadinessTag state={cells.contact} t={t} />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <ReadinessTag state={cells.contract} t={t} />
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <ReadinessTag state={cells.mediaConsent} t={t} />
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <Tooltip
                          title={
                            participant.isMinor
                              ? (participant.guardianStatus === "approved"
                                  ? t("guardianAcceptedAssurance")
                                  : REQUIREMENT_LABELS[
                                      participant.guardianStatus
                                    ][locale]) +
                                " / " +
                                REQUIREMENT_LABELS[
                                  participant.workPermitStatus
                                ][locale]
                              : ""
                          }
                        >
                          <span>
                            <ReadinessTag state={cells.guardian} t={t} />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <ReadinessTag state={cells.compensation} t={t} />
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <Tooltip title={blockers}>
                          <span>
                            <WsTag
                              label={
                                participant.readiness.ready
                                  ? t("ready")
                                  : t("notReady")
                              }
                              tone={
                                participant.readiness.ready ? "green" : "amber"
                              }
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ borderColor: ws.borderSoft }}>
                        <IconButton
                          size="small"
                          aria-label={
                            t("actions") + ": " + participant.displayName
                          }
                          onClick={(event) =>
                            setMenu({
                              anchor: event.currentTarget,
                              participant,
                            })
                          }
                          sx={{ color: ws.textDim }}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack spacing={1.25} sx={{ display: { xs: "flex", md: "none" } }}>
            {visibleParticipants.map((participant) => (
              <WsCard key={participant.id} pad={1.6}>
                <Stack direction="row" alignItems="flex-start" spacing={1.2}>
                  <Avatar sx={{ bgcolor: ws.accentSoft, color: ws.accent }}>
                    {participant.displayName.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{ color: ws.text, fontSize: 14, fontWeight: 800 }}
                    >
                      {participant.displayName}
                    </Typography>
                    <Typography sx={{ color: ws.textDim, fontSize: 11.5 }}>
                      {participant.roleLabel ||
                        PARTICIPANT_TYPE_LABELS[participant.participantType][
                          locale
                        ]}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.5 }}
                    >
                      <WsTag
                        label={
                          WORKFLOW_LABELS[participant.workflowStatus][locale]
                        }
                        tone={WORKFLOW_TONE[participant.workflowStatus]}
                      />
                      <WsTag
                        label={
                          participant.readiness.ready
                            ? t("ready")
                            : t("notReady")
                        }
                        tone={participant.readiness.ready ? "green" : "amber"}
                      />
                    </Stack>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={t("actions") + ": " + participant.displayName}
                    onClick={(event) =>
                      setMenu({
                        anchor: event.currentTarget,
                        participant,
                      })
                    }
                    sx={{ color: ws.textDim }}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Stack>
                <ParticipantRequirementGrid
                  participant={participant}
                  t={t}
                  contactVisible={canManage}
                />
              </WsCard>
            ))}
          </Stack>
        </>
      )}

      <Menu
        anchorEl={menu?.anchor ?? null}
        open={!!menu}
        onClose={() => setMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (menu) setDocumentsTarget(menu.participant);
            setMenu(null);
          }}
        >
          <DescriptionOutlined fontSize="small" sx={{ mr: 1 }} />
          {t("documents")}
        </MenuItem>
        {canManage && (
          <MenuItem
            onClick={() => {
              if (menu) setCompensationTarget(menu.participant);
              setMenu(null);
            }}
          >
            <PaymentsOutlined fontSize="small" sx={{ mr: 1 }} />
            {t("compensationAction")}
          </MenuItem>
        )}
        {!!access?.canConfigureRequirements && menu?.participant.isMinor && (
          <MenuItem
            onClick={() => {
              if (menu) setWorkPermitTarget(menu.participant);
              setMenu(null);
            }}
          >
            <FactCheckOutlined fontSize="small" sx={{ mr: 1 }} />
            {t("workPermitAction")}
          </MenuItem>
        )}
        {canManage && (
          <MenuItem
            onClick={() => {
              if (menu) openEdit(menu.participant);
              setMenu(null);
            }}
          >
            <EditOutlined fontSize="small" sx={{ mr: 1 }} />
            {t("edit")}
          </MenuItem>
        )}
        {!!access?.canConfigureRequirements && (
          <MenuItem
            onClick={() => {
              if (menu) setArchiveTarget(menu.participant);
              setMenu(null);
            }}
          >
            <ArchiveOutlined fontSize="small" sx={{ mr: 1 }} />
            {t("archive")}
          </MenuItem>
        )}
      </Menu>

      <WorkspaceParticipantDocumentsDialog
        open={!!documentsTarget}
        onClose={() => setDocumentsTarget(null)}
        projectId={projectId}
        participant={documentsTarget}
        access={{
          canView: !!access?.canView,
          canManage,
          canConfigureRequirements: !!access?.canConfigureRequirements,
        }}
      />

      <WorkspaceParticipantCompensationDialog
        open={!!compensationTarget}
        onClose={() => setCompensationTarget(null)}
        projectId={projectId}
        participant={compensationTarget}
        access={{
          canView: !!access?.canView,
          canManage,
          canConfigureRequirements: !!access?.canConfigureRequirements,
        }}
        onSaved={refreshList}
      />

      <WorkspaceParticipantWorkPermitDialog
        open={!!workPermitTarget}
        onClose={() => setWorkPermitTarget(null)}
        projectId={projectId}
        participant={workPermitTarget}
        access={{
          canConfigureRequirements: !!access?.canConfigureRequirements,
        }}
        onSaved={refreshList}
      />

      <Dialog
        open={editorOpen}
        onClose={() => {
          if (!saving) setEditorOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{editing ? t("dialogEdit") : t("dialogAdd")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              autoFocus
              required
              label={t("name")}
              value={form.displayName}
              onChange={(event) =>
                setForm({ ...form, displayName: event.target.value })
              }
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
                type="email"
                label={t("email")}
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
              <TextField
                label={t("phone")}
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
              <TextField
                label={t("role")}
                value={form.roleLabel}
                onChange={(event) =>
                  setForm({ ...form, roleLabel: event.target.value })
                }
              />
              <TextField
                select
                label={t("participantType")}
                value={form.participantType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    participantType: event.target
                      .value as WorkspaceParticipantType,
                  })
                }
              >
                {(
                  Object.keys(
                    PARTICIPANT_TYPE_LABELS,
                  ) as WorkspaceParticipantType[]
                ).map((value) => (
                  <MenuItem key={value} value={value}>
                    {PARTICIPANT_TYPE_LABELS[value][locale]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t("engagementType")}
                value={form.engagementType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    engagementType: event.target
                      .value as WorkspaceParticipantEngagementType,
                  })
                }
              >
                {(
                  Object.keys(
                    ENGAGEMENT_LABELS,
                  ) as WorkspaceParticipantEngagementType[]
                ).map((value) => (
                  <MenuItem key={value} value={value}>
                    {ENGAGEMENT_LABELS[value][locale]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t("workflowStatus")}
                value={form.workflowStatus}
                disabled={!editing}
                onChange={(event) =>
                  setForm({
                    ...form,
                    workflowStatus: event.target
                      .value as WorkspaceParticipantWorkflowStatus,
                  })
                }
              >
                {(editing
                  ? workflowOptionsFor(
                      editing.workflowStatus,
                      !!access?.canConfigureRequirements,
                    )
                  : (["draft"] as WorkspaceParticipantWorkflowStatus[])
                ).map((value) => (
                  <MenuItem key={value} value={value}>
                    {WORKFLOW_LABELS[value][locale]}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.isMinor}
                  onChange={(event) => setMinor(event.target.checked)}
                />
              }
              label={t("minor")}
            />
            {form.isMinor && (
              <Alert severity="warning">
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800 }}>
                      {t("guardianStatus")}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5 }}>
                      {form.guardianStatus === "approved"
                        ? t("guardianAcceptedAssurance")
                        : REQUIREMENT_LABELS[form.guardianStatus][locale]}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800 }}>
                      {t("permitStatus")}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5 }}>
                      {REQUIREMENT_LABELS[form.workPermitStatus][locale]}
                    </Typography>
                  </Box>
                </Stack>
              </Alert>
            )}

            <Box>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 0.5 }}
              >
                <DescriptionOutlined sx={{ color: ws.textDim, fontSize: 18 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                  {t("requirements")}
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.requiresContract}
                      disabled={!access?.canConfigureRequirements}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          requiresContract: event.target.checked,
                        })
                      }
                    />
                  }
                  label={t("requiresContract")}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.requiresMediaConsent}
                      disabled={!access?.canConfigureRequirements}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          requiresMediaConsent: event.target.checked,
                        })
                      }
                    />
                  }
                  label={t("requiresConsent")}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.requiresCompensation}
                      disabled={!access?.canConfigureRequirements}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          requiresCompensation: event.target.checked,
                        })
                      }
                    />
                  }
                  label={t("requiresCompensation")}
                />
              </Stack>
              {!access?.canConfigureRequirements && (
                <Typography sx={{ color: ws.textFaint, fontSize: 11.5 }}>
                  {t("requirementsReadOnly")}
                </Typography>
              )}
            </Box>

            <TextField
              label={t("notes")}
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveParticipant()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onClose={() => {
          if (!saving) setBulkOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{t("bulkTitle")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info">{t("bulkHelp")}</Alert>
            {mutationError && <Alert severity="error">{mutationError}</Alert>}
            <TextField
              autoFocus
              multiline
              minRows={10}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={t("bulkPlaceholder")}
              inputProps={{ "aria-label": t("bulkTitle") }}
              fullWidth
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <WsTag
                label={bulkResult.participants.length + " " + t("validRows")}
                tone={bulkResult.participants.length ? "green" : "neutral"}
              />
              {!!bulkResult.issues.length && (
                <WsTag
                  label={bulkResult.issues.length + " " + t("invalidRows")}
                  tone="amber"
                />
              )}
            </Stack>
            {bulkResult.participants.length > 100 && (
              <Alert severity="error">{t("maxRows")}</Alert>
            )}
            {!!bulkResult.issues.length && (
              <Box sx={{ maxHeight: 120, overflowY: "auto" }}>
                {bulkResult.issues.slice(0, 8).map((issue) => (
                  <Typography
                    key={issue.line}
                    sx={{ color: ws.textDim, fontSize: 11.5 }}
                  >
                    Linje {issue.line}:{" "}
                    {issue.reason === "missing_name"
                      ? t("missingName")
                      : t("invalidEmail")}
                  </Typography>
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => void importParticipants()}
            disabled={
              saving ||
              !bulkResult.participants.length ||
              bulkResult.participants.length > 100
            }
            startIcon={
              saving ? (
                <CircularProgress size={16} />
              ) : (
                <ContentPasteGoOutlined />
              )
            }
          >
            {saving ? t("saving") : t("import")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!archiveTarget}
        onClose={() => {
          if (!saving) setArchiveTarget(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("archiveTitle")}</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ color: ws.textDim, fontSize: 13.5 }}>
            {archiveTarget?.displayName}: {t("archiveBody")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveTarget(null)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => void archiveParticipant()}
            disabled={saving}
          >
            {t("archive")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default WorkspaceParticipantsTab;
