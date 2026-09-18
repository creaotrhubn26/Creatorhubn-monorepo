import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import CloudQueueOutlinedIcon from "@mui/icons-material/CloudQueueOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RestoreFromTrashOutlinedIcon from "@mui/icons-material/RestoreFromTrashOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";

import {
  activityLogApi,
  WORKSPACE_DOCUMENT_LINK_LABELS,
  WORKSPACE_DOCUMENT_STATUS_LABELS,
  WORKSPACE_DOCUMENT_TYPE_LABELS,
  workspaceDocumentsApi,
  type ActivityLogEntry,
  type WorkspaceDocument,
  type WorkspaceDocumentComment,
  type WorkspaceDocumentCommentInput,
  type WorkspaceDocumentContextSuggestion,
  type WorkspaceDocumentFile,
  type WorkspaceDocumentInput,
  type WorkspaceDocumentLink,
  type WorkspaceDocumentLinkOption,
  type WorkspaceDocumentLinkType,
  type WorkspaceDocumentStatus,
  type WorkspaceDocumentTemplate,
  type WorkspaceDocumentType,
  type WorkspaceDocumentVersion,
  type WorkspaceDocumentVersionDetail,
} from "../../services/adminRoomApi";
import { SmartDocumentContextPanel } from "./SmartDocumentContextPanel";
import {
  PortalExportDialog,
  SourceBankDialog,
  VersionCompareDialog,
  WritingReviewDialog,
} from "./DocumentWritingDialogs";
import { DocumentReviewPanel } from "./DocumentReviewPanel";
import {
  OppstartApplicationWorkbench,
  type ApplicationNavigationTarget,
} from "./OppstartApplicationWorkbench";
import {
  analyzeOppstartApplication,
  getOppstartSectionRange,
  replaceOppstartSection,
  type OppstartApplicationSectionAnalysis,
} from "./oppstartApplicationModel";
import {
  WorkspaceDocumentEditor,
  type DocumentSectionFocus,
  type DocumentNavigationTarget,
  type DocumentTextSelection,
} from "./WorkspaceDocumentEditor";

const BRAND = {
  panelBg: "rgba(26, 10, 46, 0.72)",
  panelSolid: "#1a0a2e",
  surface: "rgba(11, 5, 24, 0.5)",
  accent: "#a78bfa",
  accentStrong: "#7c3aed",
  border: "rgba(167, 139, 250, 0.2)",
  borderHover: "rgba(167, 139, 250, 0.42)",
  text: "#f1f5f9",
  textMuted: "rgba(241, 245, 249, 0.76)",
  textDim: "rgba(241, 245, 249, 0.52)",
  hoverBg: "rgba(167, 139, 250, 0.08)",
  selectedBg: "rgba(167, 139, 250, 0.15)",
};

const STATUS_COLORS: Record<WorkspaceDocumentStatus, string> = {
  draft: "#94a3b8",
  in_review: "#f59e0b",
  approved: "#22c55e",
  sent: "#38bdf8",
  signed: "#a78bfa",
  archived: "#64748b",
};

const LINK_ROUTES: Record<WorkspaceDocumentLinkType, string> = {
  workspace_project: "projects",
  workspace_case: "cases",
  funding_app: "funding",
  industry_target: "industry-crm",
  leadgrid_lead: "marketing-cockpit",
  investor: "investors",
  partner: "partners",
};

const fieldSx = {
  "& .MuiInputBase-root": { color: BRAND.text },
  "& .MuiInputLabel-root": { color: BRAND.textDim },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: BRAND.border },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: BRAND.borderHover,
  },
  "& .MuiSvgIcon-root": { color: BRAND.textDim },
};

interface DocumentsTabProps {
  parentProduct: "roleroom" | "leadgrid";
}

interface CreateDraft {
  templateId: string;
  title: string;
  productKey: "role_room" | "leadgrid" | "internal";
  documentType: WorkspaceDocumentType;
  dueDate: string;
}

interface ExternalFileDraft {
  fileName: string;
  externalUrl: string;
  sourceKind: "google_drive" | "external";
}

interface LocalDocumentBackup {
  documentId: string;
  title: string;
  summary: string | null;
  content: string;
  tagsText: string;
  fingerprint: string;
  savedAt: string;
}

function contextProduct(
  parentProduct: DocumentsTabProps["parentProduct"],
): "role_room" | "leadgrid" {
  return parentProduct === "roleroom" ? "role_room" : "leadgrid";
}

function productLabel(value: WorkspaceDocument["product_key"]): string {
  if (value === "role_room") return "The Role Room";
  if (value === "leadgrid") return "Leadgrid";
  return "Creatorhub / internt";
}

function formatDate(value: string | null): string {
  if (!value) return "Ingen frist";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function extractionLabel(file: WorkspaceDocumentFile): string {
  if (file.source_kind !== "upload" || file.extraction_status === "external") return "Kun dokumentlenke";
  if (file.extraction_status === "ready") return file.context_enabled ? "Aktiv kontekstkilde" : "Kontekst slått av";
  if (file.extraction_status === "processing") return "Leser innhold";
  if (file.extraction_status === "pending") return "Må indekseres";
  if (file.extraction_status === "unsupported") return "Kan ikke leses som tekst";
  return "Tekstuttrekk feilet";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(value: number | string | null): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dueColor(value: string | null): string {
  if (!value) return BRAND.textDim;
  const due = new Date(`${value.slice(0, 10)}T23:59:59`).getTime();
  if (due < Date.now()) return "#f87171";
  if (due - Date.now() < 7 * 86_400_000) return "#fbbf24";
  return BRAND.textMuted;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function inputFromDocument(
  document: WorkspaceDocument,
  tagsText: string,
): WorkspaceDocumentInput {
  return {
    title: document.title,
    summary: document.summary || null,
    content: document.content,
    documentType: document.document_type,
    status: document.status,
    productKey: document.product_key,
    dueDate: document.due_date?.slice(0, 10) || null,
    nextAction: document.next_action || null,
    tags: tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function fingerprint(document: WorkspaceDocument, tagsText: string): string {
  return JSON.stringify(inputFromDocument(document, tagsText));
}

function localBackupKey(documentId: string): string {
  return "admin-workspace:document-draft:" + documentId;
}

function readLocalBackup(documentId: string): LocalDocumentBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(localBackupKey(documentId)) || "null",
    ) as Partial<LocalDocumentBackup> | null;
    if (
      !parsed ||
      parsed.documentId !== documentId ||
      typeof parsed.content !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.tagsText !== "string" ||
      typeof parsed.fingerprint !== "string" ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }
    return {
      documentId,
      title: parsed.title,
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      content: parsed.content,
      tagsText: parsed.tagsText,
      fingerprint: parsed.fingerprint,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function writeLocalBackup(backup: LocalDocumentBackup): void {
  try {
    window.localStorage.setItem(
      localBackupKey(backup.documentId),
      JSON.stringify(backup),
    );
  } catch {
    // Autosave mot server fortsetter selv om nettleserlagring er blokkert eller full.
  }
}

function clearLocalBackup(documentId: string): void {
  try {
    window.localStorage.removeItem(localBackupKey(documentId));
  } catch {
    // Ingen handling nødvendig.
  }
}

function newCreateDraft(
  parentProduct: DocumentsTabProps["parentProduct"],
): CreateDraft {
  return {
    templateId: "",
    title: "",
    productKey: contextProduct(parentProduct),
    documentType: "other",
    dueDate: "",
  };
}

const CONTEXT_COPY = {
  roleroom: {
    heading: "Dokumenter — The Role Room",
    description:
      "Arbeidsdokumenter for marked, castingbyråer, partnerskap, støttearbeid og beslutninger. Castingproduksjoner hører fortsatt hjemme i Role Room.",
    empty:
      "Start med et castingbyrå-møtekort, partnerforslag eller en støttesøknad.",
  },
  leadgrid: {
    heading: "Dokumenter — Leadgrid",
    description:
      "Arbeidsdokumenter for pilotkunder, partnerløp, salg, støttearbeid og interne beslutninger. Leads og kundedata forblir i Leadgrid.",
    empty: "Start med et pilotforslag, partnerbrief eller en støttesøknad.",
  },
} as const;

export function DocumentsTab({ parentProduct }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return new URLSearchParams(window.location.search).get("document");
    } catch {
      return null;
    }
  });
  const [draft, setDraft] = useState<WorkspaceDocument | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [links, setLinks] = useState<WorkspaceDocumentLink[]>([]);
  const [files, setFiles] = useState<WorkspaceDocumentFile[]>([]);
  const [versions, setVersions] = useState<WorkspaceDocumentVersion[]>([]);
  const [comments, setComments] = useState<WorkspaceDocumentComment[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [templates, setTemplates] = useState<WorkspaceDocumentTemplate[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [editorCursorPosition, setEditorCursorPosition] = useState(0);
  const [editorNavigation, setEditorNavigation] =
    useState<DocumentNavigationTarget | null>(null);
  const [focusedApplicationSection, setFocusedApplicationSection] = useState<
    string | null
  >(null);
  const [writingReviewSection, setWritingReviewSection] =
    useState<OppstartApplicationSectionAnalysis | null>(null);
  const [sourceSection, setSourceSection] =
    useState<OppstartApplicationSectionAnalysis | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [portalExportOpen, setPortalExportOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonVersion, setComparisonVersion] =
    useState<WorkspaceDocumentVersionDetail | null>(null);
  const [recoveryBackup, setRecoveryBackup] =
    useState<LocalDocumentBackup | null>(null);
  const [textSelection, setTextSelection] =
    useState<DocumentTextSelection | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<
    "context" | "all" | "internal"
  >("context");
  const [statusFilter, setStatusFilter] = useState<
    "all" | WorkspaceDocumentStatus
  >("all");
  const [typeFilter, setTypeFilter] = useState<"all" | WorkspaceDocumentType>(
    "all",
  );
  const [trash, setTrash] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(() =>
    newCreateDraft(parentProduct),
  );
  const [versionOpen, setVersionOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkOptions, setLinkOptions] = useState<WorkspaceDocumentLinkOption[]>(
    [],
  );
  const [linkQuery, setLinkQuery] = useState("");
  const [linkType, setLinkType] = useState<"all" | WorkspaceDocumentLinkType>(
    "all",
  );
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalDraft, setExternalDraft] = useState<ExternalFileDraft>({
    fileName: "",
    externalUrl: "",
    sourceKind: "google_drive",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const backupTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef("");
  const latestFingerprintRef = useRef("");
  const activeDocumentRef = useRef<string | null>(null);
  const navigationRequestRef = useRef(0);
  const serverUpdatedAtRef = useRef<Map<string, string>>(new Map());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const copy = CONTEXT_COPY[parentProduct];

  const refreshDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await workspaceDocumentsApi.list({
        ...(productFilter === "context"
          ? { product: contextProduct(parentProduct) }
          : productFilter === "internal"
            ? { product: "internal" as const }
            : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(typeFilter !== "all" ? { documentType: typeFilter } : {}),
        trash,
      });
      setDocuments(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current))
          return current;
        return items[0]?.id ?? null;
      });
    } catch (err) {
      setError((err as Error).message || "Kunne ikke hente dokumentene");
    } finally {
      setLoading(false);
    }
  }, [parentProduct, productFilter, statusFilter, trash, typeFilter]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setError(null);
      activeDocumentRef.current = id;
      try {
        const [detail, activity] = await Promise.all([
          workspaceDocumentsApi.get(id, trash),
          activityLogApi.list({
            entityType: "workspace_document",
            entityId: id,
            limit: 100,
          }),
        ]);
        if (activeDocumentRef.current !== id) return;
        setDraft(detail.item);
        const tags = detail.item.tags.join(", ");
        const serverFingerprint = fingerprint(detail.item, tags);
        setTagsText(tags);
        lastSavedRef.current = serverFingerprint;
        latestFingerprintRef.current = serverFingerprint;
        setLastSavedAt(detail.item.updated_at);
        serverUpdatedAtRef.current.set(id, detail.item.updated_at);
        const localBackup = readLocalBackup(detail.item.id);
        const backupTime = localBackup
          ? new Date(localBackup.savedAt).getTime()
          : 0;
        const serverTime = new Date(detail.item.updated_at).getTime();
        if (
          localBackup &&
          localBackup.fingerprint !== serverFingerprint &&
          Number.isFinite(backupTime) &&
          backupTime > serverTime
        ) {
          setRecoveryBackup(localBackup);
        } else {
          setRecoveryBackup(null);
          if (localBackup) clearLocalBackup(detail.item.id);
        }
        setLinks(detail.links);
        setFiles(detail.files);
        setVersions(detail.versions);
        setComments(detail.comments ?? []);
        setActivities(activity);
        setFocusedApplicationSection(null);
        setEditorCursorPosition(0);
        setEditorNavigation(null);
        setWritingReviewSection(null);
        setSourceOpen(false);
        setPortalExportOpen(false);
        setComparisonOpen(false);
        setComparisonVersion(null);
        setTextSelection(null);
        setConflictOpen(false);
        setSaveState("idle");
      } catch (err) {
        setError((err as Error).message || "Kunne ikke hente dokumentet");
      } finally {
        if (activeDocumentRef.current === id) setDetailLoading(false);
      }
    },
    [trash],
  );

  const persistDraft = useCallback(
    (document: WorkspaceDocument, currentTags: string): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const savingFingerprint = fingerprint(document, currentTags);
        if (savingFingerprint === lastSavedRef.current) {
          setSaveState("saved");
          return true;
        }
        setSaveState("saving");
        try {
          const updated = await workspaceDocumentsApi.update(document.id, {
            ...inputFromDocument(document, currentTags),
            expectedUpdatedAt:
              serverUpdatedAtRef.current.get(document.id) ??
              document.updated_at,
          });
          if (activeDocumentRef.current === document.id) {
            lastSavedRef.current = savingFingerprint;
            setLastSavedAt(updated.updated_at);
            serverUpdatedAtRef.current.set(document.id, updated.updated_at);
            setSaveState("saved");
            setConflictOpen(false);
            setDraft((current) =>
              current?.id === updated.id
                ? {
                    ...current,
                    updated_at: updated.updated_at,
                    version_no: updated.version_no,
                  }
                : current,
            );
            if (updated.version_no !== document.version_no) {
              void workspaceDocumentsApi
                .get(document.id)
                .then((detail) => {
                  if (activeDocumentRef.current === document.id)
                    setVersions(detail.versions);
                })
                .catch(() => undefined);
            }
            if (latestFingerprintRef.current === savingFingerprint) {
              clearLocalBackup(document.id);
              setRecoveryBackup(null);
            }
          }
          setDocuments((items) =>
            items.map((item) =>
              item.id === updated.id ? { ...item, ...updated } : item,
            ),
          );
          return true;
        } catch (err) {
          const message =
            (err as Error).message || "Kunne ikke lagre dokumentet";
          if (activeDocumentRef.current === document.id) setSaveState("error");
          if (message.includes("HTTP 409")) {
            setConflictOpen(true);
            setError(null);
          } else {
            setError(message);
          }
          return false;
        }
      };
      const result = saveQueueRef.current.then(run, run);
      saveQueueRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [],
  );

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    setCreateDraft(newCreateDraft(parentProduct));
  }, [parentProduct]);

  useEffect(() => {
    if (!selectedId) {
      activeDocumentRef.current = null;
      setDraft(null);
      setLinks([]);
      setFiles([]);
      setVersions([]);
      setComments([]);
      setActivities([]);
      setRecoveryBackup(null);
      setFocusedApplicationSection(null);
      setEditorNavigation(null);
      setTextSelection(null);
      setConflictOpen(false);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!draft || trash || activeDocumentRef.current !== draft.id) return;
    const currentFingerprint = fingerprint(draft, tagsText);
    if (currentFingerprint === lastSavedRef.current) return;
    setSaveState("pending");
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft(draft, tagsText);
    }, 900);
    return () => {
      if (autosaveTimerRef.current)
        window.clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, persistDraft, tagsText, trash]);

  useEffect(() => {
    if (!draft || trash || activeDocumentRef.current !== draft.id) return;
    const currentFingerprint = fingerprint(draft, tagsText);
    latestFingerprintRef.current = currentFingerprint;
    if (currentFingerprint === lastSavedRef.current) return;
    if (backupTimerRef.current) window.clearTimeout(backupTimerRef.current);
    backupTimerRef.current = window.setTimeout(() => {
      writeLocalBackup({
        documentId: draft.id,
        title: draft.title,
        summary: draft.summary,
        content: draft.content,
        tagsText,
        fingerprint: currentFingerprint,
        savedAt: new Date().toISOString(),
      });
    }, 250);
    return () => {
      if (backupTimerRef.current) window.clearTimeout(backupTimerRef.current);
    };
  }, [draft, tagsText, trash]);

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("nb-NO");
    if (!normalized) return documents;
    return documents.filter(
      (item) =>
        item.title.toLocaleLowerCase("nb-NO").includes(normalized) ||
        (item.summary || "").toLocaleLowerCase("nb-NO").includes(normalized) ||
        item.tags.join(" ").toLocaleLowerCase("nb-NO").includes(normalized),
    );
  }, [documents, query]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: documents.length,
      review: documents.filter((item) => item.status === "in_review").length,
      dueSoon: documents.filter((item) => {
        if (!item.due_date) return false;
        const due = new Date(
          `${item.due_date.slice(0, 10)}T23:59:59`,
        ).getTime();
        return due >= now && due - now < 7 * 86_400_000;
      }).length,
      linked: documents.reduce(
        (sum, item) => sum + Number(item.link_count || 0),
        0,
      ),
    };
  }, [documents]);

  const openCreate = async () => {
    setCreateDraft(newCreateDraft(parentProduct));
    setCreateOpen(true);
    try {
      setTemplates(
        await workspaceDocumentsApi.templates(contextProduct(parentProduct)),
      );
    } catch (err) {
      setError((err as Error).message || "Kunne ikke hente maler");
    }
  };

  const selectTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    setCreateDraft((current) => ({
      ...current,
      templateId,
      ...(template
        ? {
            title: template.title_template,
            documentType: template.document_type,
            productKey: template.product_key || current.productKey,
          }
        : {}),
    }));
  };

  const createDocument = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const item = await workspaceDocumentsApi.create({
        ...(createDraft.templateId
          ? { templateId: createDraft.templateId }
          : {}),
        productKey:
          createDraft.productKey === "internal" ? null : createDraft.productKey,
        title: createDraft.title || undefined,
        documentType: createDraft.documentType,
        dueDate: createDraft.dueDate || null,
      });
      setCreateOpen(false);
      await refreshDocuments();
      setSelectedId(item.id);
      setTab(0);
    } catch (err) {
      setError((err as Error).message || "Kunne ikke opprette dokumentet");
    } finally {
      setActionLoading(false);
    }
  };

  const saveNow = async (): Promise<boolean> => {
    if (!draft) return false;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    return persistDraft(draft, tagsText);
  };

  const chooseDocument = async (id: string) => {
    if (
      draft &&
      !trash &&
      fingerprint(draft, tagsText) !== lastSavedRef.current
    ) {
      await saveNow();
    }
    setSelectedId(id);
    setTab(0);
    setFocusMode(false);
    setFocusedApplicationSection(null);
    setEditorNavigation(null);
    setRecoveryBackup(null);
  };

  const saveVersion = async () => {
    if (!draft) return;
    setActionLoading(true);
    try {
      if (!(await saveNow())) return;
      await workspaceDocumentsApi.createVersion(
        draft.id,
        changeNote || undefined,
      );
      setVersionOpen(false);
      setChangeNote("");
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke lagre versjonen");
    } finally {
      setActionLoading(false);
    }
  };

  const restoreVersion = async (version: WorkspaceDocumentVersion) => {
    if (
      !draft ||
      !window.confirm(
        `Gjenopprett innholdet fra versjon ${version.version_number}? Det lagres som en ny versjon.`,
      )
    )
      return;
    setActionLoading(true);
    try {
      await workspaceDocumentsApi.restoreVersion(draft.id, version.id);
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke gjenopprette versjonen");
    } finally {
      setActionLoading(false);
    }
  };

  const moveToTrash = async () => {
    if (!draft || !window.confirm(`Flytt «${draft.title}» til papirkurven?`))
      return;
    setActionLoading(true);
    try {
      if (!(await saveNow())) return;
      await workspaceDocumentsApi.moveToTrash(draft.id);
      setSelectedId(null);
      await refreshDocuments();
    } catch (err) {
      setError(
        (err as Error).message ||
          "Kunne ikke flytte dokumentet til papirkurven",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const restoreFromTrash = async () => {
    if (!draft) return;
    setActionLoading(true);
    try {
      await workspaceDocumentsApi.restoreFromTrash(draft.id);
      setSelectedId(null);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke gjenopprette dokumentet");
    } finally {
      setActionLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!draft) return;
    setActionLoading(true);
    try {
      if (!trash) await saveNow();
      const blob = await workspaceDocumentsApi.exportPdf(draft.id);
      downloadBlob(blob, `${draft.title}.pdf`);
    } catch (err) {
      setError((err as Error).message || "Kunne ikke eksportere PDF");
    } finally {
      setActionLoading(false);
    }
  };

  const exportDocx = async () => {
    if (!draft) return;
    setActionLoading(true);
    try {
      if (!trash && !(await saveNow())) return;
      const blob = await workspaceDocumentsApi.exportDocx(draft.id);
      downloadBlob(blob, `${draft.title}.docx`);
    } catch (err) {
      setError((err as Error).message || "Kunne ikke eksportere DOCX");
    } finally {
      setActionLoading(false);
    }
  };

  const reloadConflictVersion = async () => {
    if (!draft) return;
    await loadDetail(draft.id);
    setConflictOpen(false);
  };

  const overwriteConflictVersion = async () => {
    if (!draft) return;
    setActionLoading(true);
    try {
      const updated = await workspaceDocumentsApi.update(
        draft.id,
        inputFromDocument(draft, tagsText),
      );
      setConflictOpen(false);
      lastSavedRef.current = fingerprint(updated, updated.tags.join(", "));
      clearLocalBackup(draft.id);
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError(
        (err as Error).message || "Kunne ikke overskrive serverversjonen",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openLinkDialog = async () => {
    if (!draft) return;
    if (!(await saveNow())) return;
    setLinkOpen(true);
    setLinkQuery("");
    setLinkType("all");
    setActionLoading(true);
    try {
      setLinkOptions(await workspaceDocumentsApi.linkOptions(draft.id));
    } catch (err) {
      setError((err as Error).message || "Kunne ikke hente koblingsvalg");
    } finally {
      setActionLoading(false);
    }
  };

  const addLink = async (option: WorkspaceDocumentLinkOption) => {
    if (!draft) return;
    setActionLoading(true);
    try {
      await workspaceDocumentsApi.addLink(
        draft.id,
        option.entity_type,
        option.entity_id,
      );
      await loadDetail(draft.id);
      await refreshDocuments();
      setLinkOptions((items) =>
        items.map((item) =>
          item.entity_type === option.entity_type &&
          item.entity_id === option.entity_id
            ? { ...item, linked: true }
            : item,
        ),
      );
    } catch (err) {
      setError((err as Error).message || "Kunne ikke legge til koblingen");
    } finally {
      setActionLoading(false);
    }
  };

  const removeLink = async (linkId: string) => {
    if (!draft) return;
    setActionLoading(true);
    try {
      await workspaceDocumentsApi.removeLink(draft.id, linkId);
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke fjerne koblingen");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!draft) return;
    setActionLoading(true);
    try {
      if (!(await saveNow())) return;
      await workspaceDocumentsApi.uploadFile(draft.id, file);
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke laste opp vedlegget");
    } finally {
      setActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addExternalFile = async () => {
    if (!draft) return;
    setActionLoading(true);
    try {
      if (!(await saveNow())) return;
      await workspaceDocumentsApi.addExternalFile(draft.id, externalDraft);
      setExternalOpen(false);
      setExternalDraft({
        fileName: "",
        externalUrl: "",
        sourceKind: "google_drive",
      });
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke koble dokumentlenken");
    } finally {
      setActionLoading(false);
    }
  };

  const openFile = async (file: WorkspaceDocumentFile) => {
    if (!draft) return;
    if (file.external_url) {
      window.open(file.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    setActionLoading(true);
    try {
      const blob = await workspaceDocumentsApi.downloadFile(draft.id, file.id);
      downloadBlob(blob, file.file_name);
    } catch (err) {
      setError((err as Error).message || "Kunne ikke laste ned vedlegget");
    } finally {
      setActionLoading(false);
    }
  };

  const removeFile = async (file: WorkspaceDocumentFile) => {
    if (!draft || !window.confirm(`Fjern vedlegget «${file.file_name}»?`))
      return;
    setActionLoading(true);
    try {
      await workspaceDocumentsApi.removeFile(draft.id, file.id);
      await loadDetail(draft.id);
      await refreshDocuments();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke fjerne vedlegget");
    } finally {
      setActionLoading(false);
    }
  };

  const reindexFile = async (file: WorkspaceDocumentFile) => {
    if (!draft || file.source_kind !== "upload") return;
    setActionLoading(true);
    setError(null);
    try {
      await workspaceDocumentsApi.reindexFile(draft.id, file.id);
      await loadDetail(draft.id);
    } catch (err) {
      setError((err as Error).message || "Kunne ikke indeksere vedlegget");
      await loadDetail(draft.id).catch(() => undefined);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleFileContext = async (file: WorkspaceDocumentFile) => {
    if (!draft || file.source_kind !== "upload") return;
    setActionLoading(true);
    setError(null);
    try {
      await workspaceDocumentsApi.setFileContextEnabled(draft.id, file.id, !file.context_enabled);
      setFiles((current) => current.map((item) =>
        item.id === file.id ? { ...item, context_enabled: !file.context_enabled } : item,
      ));
    } catch (err) {
      setError((err as Error).message || "Kunne ikke endre kontekstinnstillingen");
    } finally {
      setActionLoading(false);
    }
  };

  const createComment = async (input: WorkspaceDocumentCommentInput) => {
    if (!draft) return;
    setActionLoading(true);
    try {
      const item = await workspaceDocumentsApi.createComment(draft.id, input);
      setComments((current) => [item, ...current]);
    } catch (err) {
      setError((err as Error).message || "Kunne ikke lagre merknaden");
    } finally {
      setActionLoading(false);
    }
  };

  const updateComment = async (
    comment: WorkspaceDocumentComment,
    input: { status?: "open" | "resolved"; assignee?: string | null },
  ) => {
    if (!draft) return;
    setActionLoading(true);
    try {
      const item = await workspaceDocumentsApi.updateComment(
        draft.id,
        comment.id,
        input,
      );
      setComments((current) =>
        current.map((value) => (value.id === item.id ? item : value)),
      );
    } catch (err) {
      setError((err as Error).message || "Kunne ikke oppdatere merknaden");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteComment = async (comment: WorkspaceDocumentComment) => {
    if (!draft || !window.confirm("Slett denne merknaden?")) return;
    setActionLoading(true);
    try {
      await workspaceDocumentsApi.removeComment(draft.id, comment.id);
      setComments((current) =>
        current.filter((value) => value.id !== comment.id),
      );
    } catch (err) {
      setError((err as Error).message || "Kunne ikke slette merknaden");
    } finally {
      setActionLoading(false);
    }
  };

  const commentPosition = (comment: WorkspaceDocumentComment): number => {
    if (!draft || !comment.selected_text) return -1;
    const anchored = comment.anchor_from ?? -1;
    if (
      anchored >= 0 &&
      draft.content.slice(anchored, comment.anchor_to ?? anchored) ===
        comment.selected_text
    ) {
      return anchored;
    }
    return draft.content.indexOf(comment.selected_text);
  };

  const navigateComment = (comment: WorkspaceDocumentComment) => {
    const position = commentPosition(comment);
    if (position < 0 || !comment.selected_text) return;
    navigationRequestRef.current += 1;
    setTab(0);
    setEditorNavigation({
      position,
      length: comment.selected_text.length,
      requestId: navigationRequestRef.current,
    });
  };

  const acceptSuggestion = async (comment: WorkspaceDocumentComment) => {
    if (!draft || !comment.selected_text || comment.suggested_text === null)
      return;
    const position = commentPosition(comment);
    if (position < 0) {
      setError(
        "Fant ikke lenger den markerte teksten. Finn teksten og opprett forslaget på nytt.",
      );
      return;
    }
    setDraft({
      ...draft,
      content:
        draft.content.slice(0, position) +
        comment.suggested_text +
        draft.content.slice(position + comment.selected_text.length),
    });
    await updateComment(comment, { status: "resolved" });
  };

  const insertEvidence = (label: string, url: string | null) => {
    if (!draft) return;
    const safeLabel = label.replaceAll("[", "").replaceAll("]", "");
    const card = url
      ? `\n\n> 📎 **Vedlegg:** [${safeLabel}](${url})\n\n`
      : `\n\n> 🔎 **Kilde/vedlegg:** ${safeLabel}\n\n`;
    const position = Math.max(
      0,
      Math.min(textSelection?.to ?? draft.content.length, draft.content.length),
    );
    setDraft({
      ...draft,
      content:
        draft.content.slice(0, position) + card + draft.content.slice(position),
    });
    setTextSelection(null);
    setTab(0);
  };

  const insertContextSuggestion = (
    text: string,
    _suggestion: WorkspaceDocumentContextSuggestion,
    _mode: "text" | "bullets" | "source_card",
  ) => {
    if (!draft || trash) return;
    const preferredPosition = textSelection?.to ?? editorCursorPosition;
    const position = Math.max(
      0,
      Math.min(preferredPosition > 0 ? preferredPosition : draft.content.length, draft.content.length),
    );
    const nextContent = draft.content.slice(0, position) + text + draft.content.slice(position);
    setDraft({ ...draft, content: nextContent });
    setTextSelection(null);
    navigationRequestRef.current += 1;
    setEditorNavigation({
      position: position + Math.min(2, text.length),
      length: Math.max(0, text.trim().length),
      requestId: navigationRequestRef.current,
    });
  };

  const filteredLinkOptions = useMemo(() => {
    const normalized = linkQuery.trim().toLocaleLowerCase("nb-NO");
    return linkOptions.filter(
      (option) =>
        !option.linked &&
        (linkType === "all" || option.entity_type === linkType) &&
        (!normalized ||
          `${option.title} ${option.subtitle || ""}`
            .toLocaleLowerCase("nb-NO")
            .includes(normalized)),
    );
  }, [linkOptions, linkQuery, linkType]);

  const isOppstartApplication = Boolean(
    draft &&
    draft.document_type === "funding_application" &&
    tagsText
      .split(",")
      .map((tag) => tag.trim())
      .includes("oppstartstilskudd-1"),
  );
  const applicationSections = useMemo(
    () =>
      isOppstartApplication
        ? analyzeOppstartApplication(draft?.content ?? "")
        : [],
    [draft?.content, isOppstartApplication],
  );
  const focusedApplicationRange = useMemo<DocumentSectionFocus | null>(() => {
    if (!draft || !focusedApplicationSection) return null;
    const section = getOppstartSectionRange(
      draft.content,
      focusedApplicationSection,
    );
    return section
      ? { start: section.start, end: section.end, label: section.label }
      : null;
  }, [draft, focusedApplicationSection]);

  const handleEditorCursorChange = useCallback((position: number) => {
    setEditorCursorPosition(position);
  }, []);

  const handleApplicationNavigate = useCallback(
    (target: Omit<ApplicationNavigationTarget, "requestId">) => {
      if (
        focusedApplicationSection &&
        focusedApplicationSection !== target.sectionHeading
      ) {
        setFocusedApplicationSection(target.sectionHeading);
      }
      navigationRequestRef.current += 1;
      setEditorNavigation({
        ...target,
        requestId: navigationRequestRef.current,
      });
    },
    [focusedApplicationSection],
  );

  const handleApplicationFocus = (heading: string | null) => {
    setFocusedApplicationSection(heading);
    if (!heading) return;
    const section = applicationSections.find(
      (item) => item.heading === heading,
    );
    if (section?.present) {
      navigationRequestRef.current += 1;
      setEditorNavigation({
        position: section.start,
        sectionHeading: section.heading,
        requestId: navigationRequestRef.current,
      });
    }
  };

  const applyWritingReview = (suggestion: string) => {
    const heading = writingReviewSection?.heading;
    if (!heading) return;
    setDraft((current) => {
      if (!current) return current;
      const section = getOppstartSectionRange(current.content, heading);
      return section
        ? {
            ...current,
            content: replaceOppstartSection(
              current.content,
              section,
              suggestion,
            ),
          }
        : current;
    });
    setWritingReviewSection(null);
  };

  const insertSourceCitation = (citation: string) => {
    const heading = sourceSection?.heading;
    if (!heading) return;
    setDraft((current) => {
      if (!current) return current;
      const section = getOppstartSectionRange(current.content, heading);
      if (!section) return current;
      const separator = section.body.trim() ? "\n\n" : "";
      const nextBody =
        section.body.trimEnd() + separator + "Kilde: " + citation;
      return {
        ...current,
        content: replaceOppstartSection(current.content, section, nextBody),
      };
    });
  };

  const openVersionComparison = async (version: WorkspaceDocumentVersion) => {
    if (!draft) return;
    setComparisonOpen(true);
    setComparisonLoading(true);
    setComparisonVersion(null);
    try {
      setComparisonVersion(
        await workspaceDocumentsApi.getVersion(draft.id, version.id),
      );
    } catch (err) {
      setError((err as Error).message || "Kunne ikke hente versjonen");
      setComparisonOpen(false);
    } finally {
      setComparisonLoading(false);
    }
  };

  const restoreLocalBackup = () => {
    if (!draft || !recoveryBackup || recoveryBackup.documentId !== draft.id)
      return;
    setDraft({
      ...draft,
      title: recoveryBackup.title,
      summary: recoveryBackup.summary,
      content: recoveryBackup.content,
    });
    setTagsText(recoveryBackup.tagsText);
    setRecoveryBackup(null);
  };

  const discardLocalBackup = () => {
    if (draft) clearLocalBackup(draft.id);
    setRecoveryBackup(null);
  };

  const savedTimestamp = lastSavedAt ? formatDateTime(lastSavedAt) : null;
  const saveLabel =
    saveState === "pending"
      ? "Venter på autosave"
      : saveState === "saving"
        ? "Lagrer …"
        : saveState === "saved"
          ? savedTimestamp
            ? `Lagret ${savedTimestamp}`
            : "Lagret"
          : saveState === "error"
            ? "Lagring feilet · lokal kopi beholdt"
            : savedTimestamp
              ? `Lagret ${savedTimestamp}`
              : "Autosave aktiv";

  return (
    <Box
      data-testid="workspace-documents"
      sx={{
        p: focusMode ? { xs: 1, md: 1.5 } : { xs: 2, md: 3 },
        color: BRAND.text,
        minHeight: "100%",
        ...(focusMode
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 1500,
              bgcolor: "#090311",
              overflowY: "auto",
              overscrollBehavior: "contain",
            }
          : {}),
      }}
    >
      {!focusMode && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          gap={2}
          mb={2.5}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              {copy.heading}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: BRAND.textMuted, mt: 0.5, maxWidth: 820 }}
            >
              {copy.description}
            </Typography>
          </Box>
          <Button
            data-testid="create-document-button"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => void openCreate()}
            sx={{
              alignSelf: { xs: "stretch", md: "flex-start" },
              bgcolor: BRAND.accentStrong,
            }}
          >
            Nytt dokument
          </Button>
        </Stack>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {actionLoading && (
        <LinearProgress sx={{ mb: 2, bgcolor: BRAND.surface }} />
      )}

      {!focusMode && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            gap: 1.5,
            mb: 2,
          }}
        >
          {[
            ["Dokumenter", stats.total],
            ["Til gjennomgang", stats.review],
            ["Frist neste 7 dager", stats.dueSoon],
            ["Koblinger", stats.linked],
          ].map(([label, value]) => (
            <Box
              key={String(label)}
              sx={{
                border: `1px solid ${BRAND.border}`,
                borderRadius: 2,
                p: 1.5,
                bgcolor: BRAND.panelBg,
              }}
            >
              <Typography variant="caption" sx={{ color: BRAND.textDim }}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={800}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {!focusMode && (
        <Stack direction={{ xs: "column", lg: "row" }} gap={1.25} mb={2}>
          <TextField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søk i titler, sammendrag og tagger"
            InputProps={{
              startAdornment: (
                <SearchOutlinedIcon sx={{ mr: 1, color: BRAND.textDim }} />
              ),
            }}
            sx={{ ...fieldSx, minWidth: { lg: 300 }, flex: 1 }}
          />
          <TextField
            select
            size="small"
            label="Område"
            value={productFilter}
            onChange={(event) =>
              setProductFilter(event.target.value as typeof productFilter)
            }
            sx={{ ...fieldSx, minWidth: 165 }}
          >
            <MenuItem value="context">
              {productLabel(contextProduct(parentProduct))}
            </MenuItem>
            <MenuItem value="internal">Creatorhub / internt</MenuItem>
            <MenuItem value="all">Alle områder</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            sx={{ ...fieldSx, minWidth: 155 }}
          >
            <MenuItem value="all">Alle statuser</MenuItem>
            {Object.entries(WORKSPACE_DOCUMENT_STATUS_LABELS).map(
              ([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ),
            )}
          </TextField>
          <TextField
            select
            size="small"
            label="Type"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as typeof typeFilter)
            }
            sx={{ ...fieldSx, minWidth: 170 }}
          >
            <MenuItem value="all">Alle typer</MenuItem>
            {Object.entries(WORKSPACE_DOCUMENT_TYPE_LABELS).map(
              ([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ),
            )}
          </TextField>
          <Button
            variant={trash ? "contained" : "outlined"}
            color={trash ? "warning" : "inherit"}
            startIcon={<DeleteOutlineIcon />}
            onClick={() => {
              setTrash((current) => !current);
              setSelectedId(null);
            }}
            sx={{ borderColor: BRAND.border, whiteSpace: "nowrap" }}
          >
            Papirkurv
          </Button>
        </Stack>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: focusMode
            ? "minmax(0, 1fr)"
            : { xs: "1fr", xl: "330px minmax(0, 1fr)" },
          gap: focusMode ? 0 : 2,
          alignItems: "start",
        }}
      >
        {!focusMode && (
          <Box
            data-testid="document-list-panel"
            sx={{
              border: "1px solid " + BRAND.border,
              borderRadius: 2.5,
              bgcolor: BRAND.panelBg,
              overflow: "hidden",
              maxHeight: { xl: "calc(100vh - 300px)" },
              overflowY: "auto",
            }}
          >
            {loading ? (
              <Stack alignItems="center" py={6}>
                <CircularProgress size={28} />
              </Stack>
            ) : visibleDocuments.length === 0 ? (
              <Stack alignItems="center" textAlign="center" p={4} gap={1}>
                <DescriptionOutlinedIcon
                  sx={{ fontSize: 42, color: BRAND.textDim }}
                />
                <Typography fontWeight={700}>
                  {trash ? "Papirkurven er tom" : "Ingen dokumenter ennå"}
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.textDim }}>
                  {trash ? "Slettede dokumenter blir synlige her." : copy.empty}
                </Typography>
              </Stack>
            ) : (
              visibleDocuments.map((item, index) => (
                <Box
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void chooseDocument(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      void chooseDocument(item.id);
                  }}
                  sx={{
                    p: 1.75,
                    cursor: "pointer",
                    bgcolor:
                      selectedId === item.id ? BRAND.selectedBg : "transparent",
                    borderBottom:
                      index < visibleDocuments.length - 1
                        ? `1px solid ${BRAND.border}`
                        : 0,
                    "&:hover": {
                      bgcolor:
                        selectedId === item.id
                          ? BRAND.selectedBg
                          : BRAND.hoverBg,
                    },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Typography
                      variant="body2"
                      fontWeight={750}
                      sx={{ color: BRAND.text }}
                    >
                      {item.title}
                    </Typography>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        mt: 0.7,
                        flexShrink: 0,
                        borderRadius: "50%",
                        bgcolor: STATUS_COLORS[item.status],
                      }}
                    />
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ color: BRAND.textDim, display: "block", mt: 0.4 }}
                  >
                    {WORKSPACE_DOCUMENT_TYPE_LABELS[item.document_type]} · v
                    {item.version_no}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" mt={1}>
                    <Typography
                      variant="caption"
                      sx={{ color: dueColor(item.due_date) }}
                    >
                      {formatDate(item.due_date)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textDim }}>
                      {Number(item.link_count || 0) +
                        Number(item.file_count || 0)}{" "}
                      koblet
                    </Typography>
                  </Stack>
                </Box>
              ))
            )}
          </Box>
        )}

        <Box
          sx={{
            border: "1px solid " + BRAND.border,
            borderRadius: focusMode ? 1.5 : 2.5,
            bgcolor: BRAND.panelBg,
            minHeight: 520,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {detailLoading ? (
            <Stack alignItems="center" py={10}>
              <CircularProgress size={30} />
            </Stack>
          ) : !draft ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              minHeight={500}
              textAlign="center"
              p={4}
              gap={1}
            >
              <ArticleOutlinedIcon
                sx={{ fontSize: 48, color: BRAND.textDim }}
              />
              <Typography fontWeight={700}>Velg et dokument</Typography>
              <Typography variant="body2" sx={{ color: BRAND.textDim }}>
                Dokumentet åpnes her for redigering og oppfølging.
              </Typography>
            </Stack>
          ) : (
            <Box data-testid="document-detail">
              {recoveryBackup && !trash && (
                <Alert
                  data-testid="document-recovery-alert"
                  severity="warning"
                  sx={{ m: 2, mb: 0 }}
                  action={
                    <Stack direction="row" gap={0.5}>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={restoreLocalBackup}
                      >
                        Gjenopprett
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={discardLocalBackup}
                      >
                        Forkast
                      </Button>
                    </Stack>
                  }
                >
                  En nyere lokal arbeidskopi fra{" "}
                  {formatDateTime(recoveryBackup.savedAt)} ble funnet.
                </Alert>
              )}
              {conflictOpen && !trash && (
                <Alert
                  data-testid="document-conflict-alert"
                  severity="error"
                  sx={{ m: 2, mb: 0 }}
                  action={
                    <Stack direction="row" gap={0.5}>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => void reloadConflictVersion()}
                      >
                        Hent serverversjon
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => void overwriteConflictVersion()}
                      >
                        Behold min kopi
                      </Button>
                    </Stack>
                  }
                >
                  Dokumentet er endret i en annen økt. Velg hvilken arbeidskopi
                  som skal beholdes.
                </Alert>
              )}
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                gap={1.5}
                p={2}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {draft.title}
                  </Typography>
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    flexWrap="wrap"
                    mt={0.5}
                  >
                    <Chip
                      size="small"
                      label={WORKSPACE_DOCUMENT_STATUS_LABELS[draft.status]}
                      sx={{
                        color: STATUS_COLORS[draft.status],
                        bgcolor: `${STATUS_COLORS[draft.status]}18`,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: BRAND.textDim }}>
                      {productLabel(draft.product_key)} · v{draft.version_no}
                    </Typography>
                    {!trash && (
                      <Stack
                        data-testid="document-save-state"
                        direction="row"
                        alignItems="center"
                        gap={0.5}
                      >
                        {saveState === "saving" || saveState === "pending" ? (
                          <CloudQueueOutlinedIcon
                            sx={{ fontSize: 16, color: BRAND.textDim }}
                          />
                        ) : (
                          <CloudDoneOutlinedIcon
                            sx={{
                              fontSize: 16,
                              color:
                                saveState === "error" ? "#f87171" : "#4ade80",
                            }}
                          />
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            color:
                              saveState === "error" ? "#f87171" : BRAND.textDim,
                          }}
                        >
                          {saveLabel}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {trash ? (
                    <Button
                      startIcon={<RestoreFromTrashOutlinedIcon />}
                      variant="contained"
                      color="warning"
                      onClick={() => void restoreFromTrash()}
                    >
                      Gjenopprett
                    </Button>
                  ) : (
                    <>
                      <Tooltip title="Lagre nå">
                        <span>
                          <IconButton
                            onClick={() => void saveNow()}
                            disabled={actionLoading}
                            sx={{ color: BRAND.textMuted }}
                          >
                            <SaveOutlinedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Button
                        data-testid="save-version-button"
                        size="small"
                        variant="outlined"
                        startIcon={<HistoryOutlinedIcon />}
                        onClick={() => setVersionOpen(true)}
                        sx={{ borderColor: BRAND.border, color: BRAND.text }}
                      >
                        Lagre versjon
                      </Button>
                      <Tooltip title="Flytt til papirkurv">
                        <span>
                          <IconButton
                            onClick={() => void moveToTrash()}
                            disabled={actionLoading}
                            sx={{ color: "#f87171" }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PictureAsPdfOutlinedIcon />}
                    onClick={() => void exportPdf()}
                    sx={{ borderColor: BRAND.border, color: BRAND.text }}
                  >
                    PDF
                  </Button>
                  <Button
                    data-testid="document-export-docx"
                    size="small"
                    variant="outlined"
                    startIcon={<ArticleOutlinedIcon />}
                    onClick={() => void exportDocx()}
                    sx={{ borderColor: BRAND.border, color: BRAND.text }}
                  >
                    DOCX
                  </Button>
                </Stack>
              </Stack>
              <Divider sx={{ borderColor: BRAND.border }} />
              <Tabs
                value={tab}
                onChange={(_event, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: 1,
                  "& .MuiTab-root": { color: BRAND.textDim, minHeight: 46 },
                  "& .Mui-selected": { color: `${BRAND.accent} !important` },
                }}
              >
                <Tab label="Innhold" />
                <Tab label={`Koblinger (${links.length})`} />
                <Tab label={`Vedlegg (${files.length})`} />
                <Tab label={`Versjoner (${versions.length})`} />
                <Tab label="Aktivitet" />
                <Tab
                  label={`Gjennomgang (${comments.filter((item) => item.status === "open").length})`}
                />
              </Tabs>
              <Divider sx={{ borderColor: BRAND.border }} />

              {tab === 0 && (
                <Box
                  data-testid="document-editor-view"
                  p={focusMode ? { xs: 1, md: 1.5 } : { xs: 2, md: 2.5 }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr)",
                      gap: 2,
                      alignItems: "start",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          border: "1px solid rgba(167, 139, 250, 0.2)",
                          borderRadius: 2.5,
                          bgcolor: "rgba(11, 5, 24, 0.42)",
                          px: { xs: 2, md: 3 },
                          py: { xs: 1.5, md: 2 },
                        }}
                      >
                        <TextField
                          data-testid="document-title-input"
                          value={draft.title}
                          onChange={(event) =>
                            setDraft({ ...draft, title: event.target.value })
                          }
                          disabled={trash}
                          placeholder="Dokumenttittel"
                          variant="standard"
                          fullWidth
                          multiline
                          minRows={1}
                          maxRows={2}
                          InputProps={{ disableUnderline: true }}
                          inputProps={{ "aria-label": "Dokumenttittel" }}
                          sx={{
                            "& textarea": {
                              color: BRAND.text,
                              WebkitTextFillColor: BRAND.text,
                              fontSize: { xs: "1.45rem", md: "1.9rem" },
                              lineHeight: 1.2,
                              fontWeight: 850,
                              letterSpacing: "-0.035em",
                              py: 0.5,
                            },
                          }}
                        />
                        <TextField
                          value={draft.summary || ""}
                          onChange={(event) =>
                            setDraft({ ...draft, summary: event.target.value })
                          }
                          disabled={trash}
                          placeholder="Kort sammendrag – hva dokumentet skal oppnå"
                          variant="standard"
                          fullWidth
                          multiline
                          minRows={1}
                          maxRows={4}
                          InputProps={{ disableUnderline: true }}
                          inputProps={{ "aria-label": "Dokumentsammendrag" }}
                          sx={{
                            mt: 0.5,
                            "& textarea": {
                              color: BRAND.textMuted,
                              WebkitTextFillColor: BRAND.textMuted,
                              fontSize: "0.95rem",
                              lineHeight: 1.55,
                            },
                          }}
                        />
                      </Box>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            isOppstartApplication && focusMode
                              ? {
                                  xs: "minmax(0, 1fr)",
                                  xl: "minmax(0, 1fr) 310px",
                                }
                              : "minmax(0, 1fr)",
                          gap: isOppstartApplication ? 2 : 0,
                          alignItems: "start",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <WorkspaceDocumentEditor
                            key={draft.id}
                            value={draft.content}
                            onChange={(content) =>
                              setDraft({ ...draft, content })
                            }
                            disabled={trash}
                            focusMode={focusMode}
                            onToggleFocus={() =>
                              setFocusMode((current) => !current)
                            }
                            sectionFocus={focusedApplicationRange}
                            onExitSectionFocus={() =>
                              setFocusedApplicationSection(null)
                            }
                            navigationTarget={editorNavigation}
                            onCursorChange={handleEditorCursorChange}
                            onTextSelection={setTextSelection}
                            onCommentRequest={() => setTab(5)}
                            inlineAssistant={
                              <SmartDocumentContextPanel
                                documentId={draft.id}
                                documentTitle={draft.title}
                                content={draft.content}
                                cursorPosition={editorCursorPosition}
                                selection={textSelection}
                                sectionHeading={focusedApplicationSection}
                                disabled={trash}
                                onInsert={insertContextSuggestion}
                              />
                            }
                          />
                        </Box>

                        {isOppstartApplication && (
                          <Box sx={{ minWidth: 0, order: focusMode ? 0 : -1 }}>
                            <OppstartApplicationWorkbench
                              content={draft.content}
                              attachmentCount={files.length}
                              dueDate={draft.due_date}
                              cursorPosition={editorCursorPosition}
                              focusedSectionHeading={focusedApplicationSection}
                              onNavigate={handleApplicationNavigate}
                              onFocusSection={handleApplicationFocus}
                              onOpenWritingReview={setWritingReviewSection}
                              onOpenSources={(section) => {
                                setSourceSection(section);
                                setSourceOpen(true);
                              }}
                              onOpenPortalExport={() =>
                                setPortalExportOpen(true)
                              }
                              compact={!focusMode}
                            />
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {!focusMode && (
                      <Box
                        data-testid="document-inspector"
                        component="aside"
                        sx={{
                          border: "1px solid " + BRAND.border,
                          borderRadius: 2.5,
                          bgcolor: BRAND.surface,
                          p: 2,
                        }}
                      >
                        <Typography fontWeight={800}>
                          Dokumentkontroll
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: BRAND.textDim }}
                        >
                          Behandle status, ansvar og relasjoner uten å forstyrre
                          skriveflaten.
                        </Typography>

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "repeat(2, minmax(0, 1fr))",
                            },
                            gap: 1.5,
                            mt: 2,
                          }}
                        >
                          <TextField
                            select
                            size="small"
                            label="Status"
                            value={draft.status}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                status: event.target
                                  .value as WorkspaceDocumentStatus,
                              })
                            }
                            disabled={trash}
                            sx={fieldSx}
                          >
                            {Object.entries(
                              WORKSPACE_DOCUMENT_STATUS_LABELS,
                            ).map(([value, label]) => (
                              <MenuItem key={value} value={value}>
                                {label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="Dokumenttype"
                            value={draft.document_type}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                document_type: event.target
                                  .value as WorkspaceDocumentType,
                              })
                            }
                            disabled={trash}
                            sx={fieldSx}
                          >
                            {Object.entries(WORKSPACE_DOCUMENT_TYPE_LABELS).map(
                              ([value, label]) => (
                                <MenuItem key={value} value={value}>
                                  {label}
                                </MenuItem>
                              ),
                            )}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="Område"
                            value={draft.product_key || "internal"}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                product_key:
                                  event.target.value === "internal"
                                    ? null
                                    : (event.target.value as
                                        | "role_room"
                                        | "leadgrid"),
                              })
                            }
                            disabled={trash}
                            sx={fieldSx}
                          >
                            <MenuItem value="role_room">The Role Room</MenuItem>
                            <MenuItem value="leadgrid">Leadgrid</MenuItem>
                            <MenuItem value="internal">
                              Creatorhub / internt
                            </MenuItem>
                          </TextField>
                          <TextField
                            size="small"
                            type="date"
                            label="Frist"
                            value={draft.due_date?.slice(0, 10) || ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                due_date: event.target.value || null,
                              })
                            }
                            InputLabelProps={{ shrink: true }}
                            disabled={trash}
                            sx={fieldSx}
                          />
                          <Divider
                            sx={{
                              borderColor: BRAND.border,
                              gridColumn: { md: "1 / -1" },
                            }}
                          />
                          <TextField
                            label="Neste handling"
                            value={draft.next_action || ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                next_action: event.target.value,
                              })
                            }
                            multiline
                            minRows={2}
                            disabled={trash}
                            sx={fieldSx}
                          />
                          <TextField
                            label="Tagger"
                            value={tagsText}
                            onChange={(event) =>
                              setTagsText(event.target.value)
                            }
                            disabled={trash}
                            helperText="Skill tagger med komma"
                            sx={{
                              ...fieldSx,
                              "& .MuiFormHelperText-root": {
                                color: BRAND.textDim,
                              },
                            }}
                          />
                        </Box>

                        <Divider sx={{ borderColor: BRAND.border, my: 2 }} />
                        <Typography
                          variant="overline"
                          sx={{ color: BRAND.textDim }}
                        >
                          Dokumentpakke
                        </Typography>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          gap={0.75}
                          mt={0.5}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setTab(1)}
                            sx={{
                              justifyContent: "space-between",
                              borderColor: BRAND.border,
                              color: BRAND.text,
                            }}
                          >
                            <span>Koblet arbeid</span>
                            <Chip size="small" label={links.length} />
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setTab(2)}
                            sx={{
                              justifyContent: "space-between",
                              borderColor: BRAND.border,
                              color: BRAND.text,
                            }}
                          >
                            <span>Vedlegg</span>
                            <Chip size="small" label={files.length} />
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setTab(3)}
                            sx={{
                              justifyContent: "space-between",
                              borderColor: BRAND.border,
                              color: BRAND.text,
                            }}
                          >
                            <span>Versjoner</span>
                            <Chip size="small" label={versions.length} />
                          </Button>
                        </Stack>

                        <Box
                          sx={{
                            mt: 2,
                            p: 1.25,
                            borderRadius: 1.5,
                            bgcolor: "rgba(167, 139, 250, 0.08)",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: dueColor(draft.due_date),
                              display: "block",
                            }}
                          >
                            Frist: {formatDate(draft.due_date)}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: BRAND.textDim,
                              display: "block",
                              mt: 0.4,
                            }}
                          >
                            Arbeidskopi v{draft.version_no} · {saveLabel}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {tab === 1 && (
                <Box p={2.5}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Box>
                      <Typography fontWeight={750}>Koblet arbeid</Typography>
                      <Typography variant="body2" sx={{ color: BRAND.textDim }}>
                        Samle prosjektet, saken, søknaden og kontaktene
                        dokumentet gjelder.
                      </Typography>
                    </Box>
                    {!trash && (
                      <Button
                        startIcon={<LinkOutlinedIcon />}
                        variant="contained"
                        size="small"
                        onClick={() => void openLinkDialog()}
                      >
                        Koble til
                      </Button>
                    )}
                  </Stack>
                  {!links.length ? (
                    <Alert severity="info">
                      Dokumentet har ingen koblinger ennå.
                    </Alert>
                  ) : (
                    <Stack gap={1}>
                      {links.map((link) => (
                        <Stack
                          key={link.link_id}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                          sx={{
                            p: 1.5,
                            border: `1px solid ${BRAND.border}`,
                            borderRadius: 2,
                            bgcolor: BRAND.surface,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{ color: BRAND.accent }}
                            >
                              {WORKSPACE_DOCUMENT_LINK_LABELS[link.entity_type]}
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {link.title}
                            </Typography>
                            {link.subtitle && (
                              <Typography
                                variant="caption"
                                sx={{ color: BRAND.textDim }}
                              >
                                {link.subtitle}
                              </Typography>
                            )}
                          </Box>
                          <Stack direction="row">
                            {!link.missing && (
                              <Tooltip title="Åpne modulen">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    window.open(
                                      `/admin-workspace?view=${LINK_ROUTES[link.entity_type]}&product=${parentProduct}`,
                                      "_blank",
                                    )
                                  }
                                  sx={{ color: BRAND.textMuted }}
                                >
                                  <OpenInNewOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!trash && (
                              <Tooltip title="Fjern kobling">
                                <IconButton
                                  size="small"
                                  onClick={() => void removeLink(link.link_id)}
                                  sx={{ color: "#f87171" }}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {tab === 2 && (
                <Box p={2.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    gap={1.5}
                    mb={2}
                  >
                    <Box>
                      <Typography fontWeight={750}>
                        Vedlegg og dokumentlenker
                      </Typography>
                      <Typography variant="body2" sx={{ color: BRAND.textDim }}>
                        PDF, Office, tekst og bilder opptil 15 MB, eller en
                        lenke fra Google Drive.
                      </Typography>
                    </Box>
                    {!trash && (
                      <Stack direction="row" gap={1}>
                        <input
                          ref={fileInputRef}
                          hidden
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadFile(file);
                          }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<UploadFileOutlinedIcon />}
                          onClick={() => fileInputRef.current?.click()}
                          sx={{ borderColor: BRAND.border, color: BRAND.text }}
                        >
                          Last opp
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DriveFileMoveOutlinedIcon />}
                          onClick={() => setExternalOpen(true)}
                        >
                          Koble lenke
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                  {!files.length ? (
                    <Alert severity="info">
                      Ingen vedlegg eller dokumentlenker ennå.
                    </Alert>
                  ) : (
                    <Stack gap={1}>
                      {files.map((file) => (
                        <Stack
                          key={file.id}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                          sx={{
                            p: 1.5,
                            border: `1px solid ${BRAND.border}`,
                            borderRadius: 2,
                            bgcolor: BRAND.surface,
                          }}
                        >
                          <Stack
                            direction="row"
                            gap={1.25}
                            alignItems="center"
                            sx={{ minWidth: 0 }}
                          >
                            {file.source_kind === "upload" ? (
                              <AttachFileOutlinedIcon
                                sx={{ color: BRAND.accent }}
                              />
                            ) : (
                              <DriveFileMoveOutlinedIcon
                                sx={{ color: "#38bdf8" }}
                              />
                            )}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                noWrap
                              >
                                {file.file_name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: BRAND.textDim }}
                              >
                                {file.source_kind === "google_drive"
                                  ? "Google Drive"
                                  : file.source_kind === "external"
                                    ? "Ekstern lenke"
                                    : formatBytes(file.file_size)}{" "}
                                · {formatDateTime(file.created_at)}
                              </Typography>
                              <Stack direction="row" gap={0.5} mt={0.5} alignItems="center" flexWrap="wrap">
                                <Chip
                                  size="small"
                                  data-testid="document-file-context-status"
                                  label={extractionLabel(file)}
                                  color={
                                    file.extraction_status === "ready" && file.context_enabled
                                      ? "success"
                                      : file.extraction_status === "failed"
                                        ? "error"
                                        : "default"
                                  }
                                  variant="outlined"
                                  sx={{ height: 21 }}
                                />
                                {file.extraction_method && (
                                  <Typography variant="caption" sx={{ color: BRAND.textDim }}>
                                    {file.extraction_method}
                                  </Typography>
                                )}
                              </Stack>
                              {file.extraction_error && (
                                <Typography variant="caption" sx={{ color: "#fca5a5", display: "block", mt: 0.4 }}>
                                  {file.extraction_error}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                          <Stack direction="row" alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                            {file.source_kind === "upload" && file.extraction_status === "ready" && (
                              <Button
                                size="small"
                                data-testid="document-file-context-toggle"
                                onClick={() => void toggleFileContext(file)}
                                sx={{ color: file.context_enabled ? "#86efac" : BRAND.textMuted, textTransform: "none" }}
                              >
                                {file.context_enabled ? "Kontekst på" : "Kontekst av"}
                              </Button>
                            )}
                            {file.source_kind === "upload" && ["pending", "failed"].includes(file.extraction_status) && (
                              <Button
                                size="small"
                                data-testid="document-file-reindex"
                                onClick={() => void reindexFile(file)}
                                sx={{ color: BRAND.accent, textTransform: "none" }}
                              >
                                Indekser
                              </Button>
                            )}
                            <Tooltip
                              title={file.external_url ? "Åpne" : "Last ned"}
                            >
                              <IconButton
                                size="small"
                                onClick={() => void openFile(file)}
                                sx={{ color: BRAND.textMuted }}
                              >
                                {file.external_url ? (
                                  <OpenInNewOutlinedIcon fontSize="small" />
                                ) : (
                                  <DownloadOutlinedIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            {!trash && (
                              <Tooltip title="Fjern">
                                <IconButton
                                  size="small"
                                  onClick={() => void removeFile(file)}
                                  sx={{ color: "#f87171" }}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {tab === 3 && (
                <Box p={2.5}>
                  <Typography fontWeight={750}>Versjonshistorikk</Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: BRAND.textDim, mb: 2 }}
                  >
                    Autosave holder arbeidskopien trygg. Eksplisitte versjoner
                    er faste kontrollpunkter som kan gjenopprettes.
                  </Typography>
                  <Stack gap={1}>
                    {versions.map((version) => (
                      <Stack
                        key={version.id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        gap={1}
                        sx={{
                          p: 1.5,
                          border: `1px solid ${BRAND.border}`,
                          borderRadius: 2,
                          bgcolor: BRAND.surface,
                        }}
                      >
                        <Box>
                          <Stack direction="row" gap={1} alignItems="center">
                            <Typography variant="body2" fontWeight={750}>
                              Versjon {version.version_number}
                            </Typography>
                            {version.version_number === draft.version_no && (
                              <Chip
                                size="small"
                                label="Nåværende"
                                color="success"
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            sx={{ color: BRAND.textDim }}
                          >
                            {version.change_note || "Ingen endringsbeskrivelse"}{" "}
                            · {formatDateTime(version.created_at)}
                          </Typography>
                        </Box>
                        <Stack direction="row" gap={0.5}>
                          <Button
                            size="small"
                            onClick={() => void openVersionComparison(version)}
                          >
                            Sammenlign
                          </Button>
                          {!trash &&
                            version.version_number !== draft.version_no && (
                              <Button
                                size="small"
                                startIcon={<RestoreFromTrashOutlinedIcon />}
                                onClick={() => void restoreVersion(version)}
                              >
                                Gjenopprett
                              </Button>
                            )}
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {tab === 4 && (
                <Box p={2.5}>
                  <Typography fontWeight={750} mb={2}>
                    Dokumentaktivitet
                  </Typography>
                  {!activities.length ? (
                    <Alert severity="info">
                      Ingen registrert aktivitet ennå.
                    </Alert>
                  ) : (
                    <Stack gap={1.5}>
                      {activities.map((activity) => (
                        <Stack key={activity.id} direction="row" gap={1.5}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: BRAND.accent,
                              mt: 0.8,
                              flexShrink: 0,
                            }}
                          />
                          <Box>
                            <Typography variant="body2">
                              {activity.summary || activity.action}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: BRAND.textDim }}
                            >
                              {formatDateTime(activity.created_at)}
                            </Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
              {tab === 5 && (
                <Box p={2.5}>
                  <DocumentReviewPanel
                    document={draft}
                    comments={comments}
                    files={files}
                    links={links}
                    selection={textSelection}
                    isOppstartApplication={isOppstartApplication}
                    busy={actionLoading}
                    onCreateComment={createComment}
                    onUpdateComment={updateComment}
                    onDeleteComment={deleteComment}
                    onNavigateComment={navigateComment}
                    onAcceptSuggestion={acceptSuggestion}
                    onInsertEvidence={insertEvidence}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      <WritingReviewDialog
        open={Boolean(writingReviewSection)}
        section={writingReviewSection}
        onClose={() => setWritingReviewSection(null)}
        onApply={applyWritingReview}
      />
      <SourceBankDialog
        open={sourceOpen}
        sectionLabel={sourceSection?.label ?? null}
        links={links}
        files={files}
        onClose={() => setSourceOpen(false)}
        onInsert={insertSourceCitation}
      />
      <PortalExportDialog
        open={portalExportOpen}
        title={draft?.title ?? "Oppstartstilskudd 1"}
        content={draft?.content ?? ""}
        onClose={() => setPortalExportOpen(false)}
      />
      <VersionCompareDialog
        open={comparisonOpen}
        currentContent={draft?.content ?? ""}
        version={comparisonVersion}
        loading={comparisonLoading}
        onClose={() => {
          setComparisonOpen(false);
          setComparisonVersion(null);
        }}
      />

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: BRAND.panelSolid,
            color: BRAND.text,
            border: `1px solid ${BRAND.border}`,
          },
        }}
      >
        <DialogTitle>Nytt arbeidsdokument</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              select
              label="Mal"
              value={createDraft.templateId}
              onChange={(event) => selectTemplate(event.target.value)}
              sx={fieldSx}
            >
              <MenuItem value="">Tomt dokument</MenuItem>
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
            {createDraft.templateId && (
              <Alert severity="info">
                {
                  templates.find((item) => item.id === createDraft.templateId)
                    ?.description
                }
              </Alert>
            )}
            <TextField
              data-testid="new-document-title-input"
              label="Tittel"
              value={createDraft.title}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, title: event.target.value })
              }
              placeholder="Bruk malens forslag eller skriv egen tittel"
              sx={fieldSx}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                select
                label="Område"
                value={createDraft.productKey}
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    productKey: event.target.value as CreateDraft["productKey"],
                  })
                }
                sx={fieldSx}
              >
                <MenuItem value="role_room">The Role Room</MenuItem>
                <MenuItem value="leadgrid">Leadgrid</MenuItem>
                <MenuItem value="internal">Creatorhub / internt</MenuItem>
              </TextField>
              <TextField
                select
                label="Type"
                value={createDraft.documentType}
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    documentType: event.target.value as WorkspaceDocumentType,
                  })
                }
                sx={fieldSx}
              >
                {Object.entries(WORKSPACE_DOCUMENT_TYPE_LABELS).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ),
                )}
              </TextField>
            </Box>
            <TextField
              type="date"
              label="Frist (valgfritt)"
              value={createDraft.dueDate}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, dueDate: event.target.value })
              }
              InputLabelProps={{ shrink: true }}
              sx={fieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
          <Button
            data-testid="confirm-create-document"
            variant="contained"
            disabled={actionLoading}
            onClick={() => void createDocument()}
          >
            Opprett dokument
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: BRAND.panelSolid,
            color: BRAND.text,
            border: `1px solid ${BRAND.border}`,
          },
        }}
      >
        <DialogTitle>Lagre fast versjon</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Hva er endret?"
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="For eksempel: Klar for intern gjennomgang"
            sx={{ ...fieldSx, mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={actionLoading}
            onClick={() => void saveVersion()}
          >
            Lagre versjon
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: BRAND.panelSolid,
            color: BRAND.text,
            border: `1px solid ${BRAND.border}`,
          },
        }}
      >
        <DialogTitle>Koble dokumentet til arbeid</DialogTitle>
        <DialogContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            gap={1.5}
            mt={1}
            mb={2}
          >
            <TextField
              value={linkQuery}
              onChange={(event) => setLinkQuery(event.target.value)}
              placeholder="Søk etter prosjekt, sak, kontakt eller lead"
              InputProps={{
                startAdornment: (
                  <SearchOutlinedIcon sx={{ mr: 1, color: BRAND.textDim }} />
                ),
              }}
              sx={{ ...fieldSx, flex: 1 }}
            />
            <TextField
              select
              label="Type"
              value={linkType}
              onChange={(event) =>
                setLinkType(event.target.value as typeof linkType)
              }
              sx={{ ...fieldSx, minWidth: 180 }}
            >
              <MenuItem value="all">Alle typer</MenuItem>
              {[...new Set(linkOptions.map((item) => item.entity_type))].map(
                (type) => (
                  <MenuItem key={type} value={type}>
                    {WORKSPACE_DOCUMENT_LINK_LABELS[type]}
                  </MenuItem>
                ),
              )}
            </TextField>
          </Stack>
          {!filteredLinkOptions.length ? (
            <Alert severity="info">
              Ingen tilgjengelige arbeidselementer matcher søket.
            </Alert>
          ) : (
            <Stack gap={1} sx={{ maxHeight: 430, overflowY: "auto" }}>
              {filteredLinkOptions.map((option) => (
                <Stack
                  key={`${option.entity_type}:${option.entity_id}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={1}
                  sx={{
                    p: 1.25,
                    border: `1px solid ${BRAND.border}`,
                    borderRadius: 2,
                  }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ color: BRAND.accent }}>
                      {WORKSPACE_DOCUMENT_LINK_LABELS[option.entity_type]}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {option.title}
                    </Typography>
                    {option.subtitle && (
                      <Typography
                        variant="caption"
                        sx={{ color: BRAND.textDim }}
                      >
                        {option.subtitle}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={actionLoading}
                    onClick={() => void addLink(option)}
                  >
                    Koble til
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Ferdig</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={externalOpen}
        onClose={() => setExternalOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: BRAND.panelSolid,
            color: BRAND.text,
            border: `1px solid ${BRAND.border}`,
          },
        }}
      >
        <DialogTitle>Koble dokumentlenke</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              select
              label="Kilde"
              value={externalDraft.sourceKind}
              onChange={(event) =>
                setExternalDraft({
                  ...externalDraft,
                  sourceKind: event.target
                    .value as ExternalFileDraft["sourceKind"],
                })
              }
              sx={fieldSx}
            >
              <MenuItem value="google_drive">Google Drive</MenuItem>
              <MenuItem value="external">Annen ekstern lenke</MenuItem>
            </TextField>
            <TextField
              label="Navn"
              value={externalDraft.fileName}
              onChange={(event) =>
                setExternalDraft({
                  ...externalDraft,
                  fileName: event.target.value,
                })
              }
              placeholder="For eksempel Budsjett Q4"
              sx={fieldSx}
            />
            <TextField
              label="http(s)-lenke"
              value={externalDraft.externalUrl}
              onChange={(event) =>
                setExternalDraft({
                  ...externalDraft,
                  externalUrl: event.target.value,
                })
              }
              placeholder="https://drive.google.com/..."
              sx={fieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExternalOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={
              !externalDraft.fileName.trim() ||
              !externalDraft.externalUrl.trim() ||
              actionLoading
            }
            onClick={() => void addExternalFile()}
          >
            Koble til
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
