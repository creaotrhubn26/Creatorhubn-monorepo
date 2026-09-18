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
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SourceOutlinedIcon from "@mui/icons-material/SourceOutlined";

import {
  workspaceDocumentsApi,
  type WorkspaceDocumentContextPreview,
  type WorkspaceDocumentContextSource,
  type WorkspaceDocumentContextSuggestion,
} from "../../services/adminRoomApi";
import type { DocumentTextSelection } from "./WorkspaceDocumentEditor";

const COLORS = {
  border: "rgba(109,40,217,0.22)",
  surface: "rgba(255,253,248,0.98)",
  surfaceSoft: "#f3e8ff",
  text: "#241d2b",
  muted: "#746b78",
  dim: "#928998",
  accent: "#6d28d9",
  green: "#166534",
};

type ContextInsertMode = "text" | "bullets" | "source_card";

interface SmartDocumentContextPanelProps {
  documentId: string;
  documentTitle: string;
  content: string;
  cursorPosition: number;
  selection: DocumentTextSelection | null;
  sectionHeading?: string | null;
  disabled?: boolean;
  onInsert: (
    text: string,
    suggestion: WorkspaceDocumentContextSuggestion,
    mode: ContextInsertMode,
  ) => void;
  onSourcesChanged?: () => void;
}

function headingAtPosition(content: string, cursorPosition: number): string | null {
  const before = content.slice(0, Math.max(0, Math.min(cursorPosition, content.length)));
  const headings = [...before.matchAll(/^#{1,4}\s+(.+)$/gmu)];
  return headings.at(-1)?.[1]?.replaceAll("**", "").trim() ?? null;
}

function sourceLocation(suggestion: WorkspaceDocumentContextSuggestion): string {
  const details = [suggestion.sectionLabel];
  if (suggestion.pageNumber) details.push(`side ${suggestion.pageNumber}`);
  return details.filter(Boolean).join(" · ");
}

function suggestionSourceId(suggestion: WorkspaceDocumentContextSuggestion): string | null {
  return suggestion.sourceProjectFileId ?? suggestion.sourceFileId ?? suggestion.sourceDocumentId;
}

function sourceTypeLabel(source: WorkspaceDocumentContextSource): string {
  if (source.source_type === "project_file") return "Prosjektfil";
  if (source.source_type === "file") return "Fil";
  return "Dokument";
}

function bulletText(value: string): string {
  const sentences = value
    .replace(/^…|…$/gu, "")
    .split(/(?:\n+|(?<=[.!?])\s+)/u)
    .map((line) => line.replace(/^[-*•]\s*/u, "").trim())
    .filter((line) => line.length > 2)
    .slice(0, 8);
  return sentences.map((line) => `- ${line}`).join("\n");
}

function safeSourceMarkdown(value: string): string {
  return value
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/gu, (full, label: string, url: string) =>
      /^https?:\/\//iu.test(url) ? full : label,
    )
    .replace(/</gu, "\\<");
}

function insertionText(
  suggestion: WorkspaceDocumentContextSuggestion,
  mode: ContextInsertMode,
): string {
  const body = safeSourceMarkdown(suggestion.suggestedText.trim());
  if (mode === "bullets") return `\n\n${bulletText(body)}\n\n`;
  if (mode === "source_card") {
    const location = sourceLocation(suggestion);
    const label = location
      ? `${suggestion.sourceTitle} · ${location}`
      : suggestion.sourceTitle;
    const quoted = body.split("\n").map((line) => `> ${line}`).join("\n");
    return `\n\n> 🔎 **Kilde: ${label.replaceAll("[", "").replaceAll("]", "")}**\n>\n${quoted}\n\n`;
  }
  return `\n\n${body}\n\n`;
}

function sourceStatus(source: WorkspaceDocumentContextSource): {
  label: string;
  color: "success" | "warning" | "error" | "default" | "info";
} {
  if (source.source_type === "workspace_document") return { label: "Klar", color: "success" };
  switch (source.extraction_status) {
    case "ready": return { label: "Klar", color: "success" };
    case "processing": return { label: "Leser fil", color: "info" };
    case "pending": return { label: "Må indekseres", color: "warning" };
    case "failed": return { label: "Kunne ikke lese", color: "error" };
    case "unsupported": return { label: "Ikke støttet", color: "default" };
    default: return { label: "Kun lenke", color: "default" };
  }
}

export function SmartDocumentContextPanel({
  documentId,
  documentTitle,
  content,
  cursorPosition,
  selection,
  sectionHeading,
  disabled = false,
  onInsert,
  onSourcesChanged,
}: SmartDocumentContextPanelProps) {
  const [automatic, setAutomatic] = useState(true);
  const [suggestions, setSuggestions] = useState<WorkspaceDocumentContextSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [library, setLibrary] = useState<WorkspaceDocumentContextSource[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [preview, setPreview] = useState<WorkspaceDocumentContextPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const requestRef = useRef(0);

  const resolvedSection = sectionHeading ?? headingAtPosition(content, cursorPosition);
  const nearbyText = useMemo(
    () => content.slice(Math.max(0, cursorPosition - 1_200), Math.min(content.length, cursorPosition + 1_200)),
    [content, cursorPosition],
  );

  const loadSuggestions = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const response = await workspaceDocumentsApi.contextSuggestions(documentId, {
        cursorPosition,
        sectionHeading: resolvedSection,
        selectedText: selection?.text ?? null,
        nearbyText,
        limit: 8,
      });
      if (requestRef.current !== requestId) return;
      setSuggestions(response.items);
      setSourceCount(response.context.sourceCount);
      setActiveSection(response.context.sectionHeading);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError((err as Error).message || "Kunne ikke hente kildeforslag");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [cursorPosition, documentId, nearbyText, resolvedSection, selection?.text]);

  useEffect(() => {
    setDismissed(new Set());
    setSuggestions([]);
    setSourceCount(0);
  }, [documentId]);

  useEffect(() => {
    if (!automatic || disabled) return;
    const timer = window.setTimeout(() => void loadSuggestions(), 750);
    return () => window.clearTimeout(timer);
  }, [automatic, disabled, loadSuggestions]);

  const visibleSuggestions = suggestions.filter((item) => !dismissed.has(item.id));

  const openLibrary = async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    setError(null);
    try {
      setLibrary(await workspaceDocumentsApi.contextLibrary(documentId));
    } catch (err) {
      setError((err as Error).message || "Kunne ikke hente kildebiblioteket");
    } finally {
      setLibraryLoading(false);
    }
  };

  const refreshLibrary = async () => {
    setLibraryLoading(true);
    try {
      setLibrary(await workspaceDocumentsApi.contextLibrary(documentId));
      onSourcesChanged?.();
      await loadSuggestions();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke oppdatere kildebiblioteket");
    } finally {
      setLibraryLoading(false);
    }
  };

  const toggleSource = async (source: WorkspaceDocumentContextSource) => {
    if (source.intrinsic) return;
    setLibraryLoading(true);
    setError(null);
    try {
      if (source.source_type === "project_file") {
        await workspaceDocumentsApi.setProjectFileContextEnabled(
          documentId,
          source.source_id,
          !source.connected,
        );
      } else if (source.connected && source.connection_id) {
        await workspaceDocumentsApi.removeContextSource(documentId, source.connection_id);
      } else {
        await workspaceDocumentsApi.addContextSource(documentId, source.source_type, source.source_id);
      }
      await refreshLibrary();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke endre kildekoblingen");
      setLibraryLoading(false);
    }
  };

  const reindexSource = async (source: WorkspaceDocumentContextSource) => {
    if (source.source_type !== "file" || !source.source_document_id) return;
    setLibraryLoading(true);
    setError(null);
    try {
      await workspaceDocumentsApi.reindexFile(source.source_document_id, source.source_id);
      await refreshLibrary();
    } catch (err) {
      setError((err as Error).message || "Kunne ikke indeksere filen");
      await refreshLibrary();
    }
  };

  const openPreview = async (
    sourceType: WorkspaceDocumentContextSource["source_type"],
    sourceId: string,
  ) => {
    setPreviewLoading(true);
    setError(null);
    try {
      setPreview(await workspaceDocumentsApi.contextPreview(documentId, sourceType, sourceId));
    } catch (err) {
      setError((err as Error).message || "Kunne ikke vise kilden");
    } finally {
      setPreviewLoading(false);
    }
  };

  const insert = async (
    suggestion: WorkspaceDocumentContextSuggestion,
    mode: ContextInsertMode,
  ) => {
    const text = insertionText(suggestion, mode);
    const sourceId = suggestionSourceId(suggestion);
    if (!sourceId) {
      setError("Forslaget mangler en gyldig kilde");
      return;
    }
    onInsert(text, suggestion, mode);
    setDismissed((current) => new Set(current).add(suggestion.id));
    try {
      await workspaceDocumentsApi.recordContextUsage(documentId, {
        sourceType: suggestion.sourceType,
        sourceId,
        suggestionId: suggestion.id,
        insertMode: mode,
        insertedText: text,
      });
    } catch (err) {
      setError((err as Error).message || "Teksten ble satt inn, men kildeloggen kunne ikke lagres");
    }
  };

  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLocaleLowerCase("nb-NO");
    if (!query) return library;
    return library.filter((source) =>
      `${source.title} ${source.subtitle ?? ""}`.toLocaleLowerCase("nb-NO").includes(query),
    );
  }, [library, libraryQuery]);

  const suggestion = visibleSuggestions[0];
  const dismissSuggestion = () => {
    if (!suggestion) return;
    setDismissed((current) => new Set(current).add(suggestion.id));
  };

  return (
    <Box
      data-testid="smart-document-context"
      sx={{
        position: "relative",
        pointerEvents: "none",
        "& button, & input, & [role='switch']": { pointerEvents: "auto" },
      }}
    >
      <Box
        data-testid="smart-context-inline"
        role="complementary"
        aria-label="Smart skriveassistent ved markøren"
        sx={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 2,
          bgcolor: COLORS.surface,
          overflow: "hidden",
          boxShadow: "0 16px 42px rgba(36,29,43,0.2)",
          backdropFilter: "blur(12px)",
          "&::before": {
            content: '""',
            position: "absolute",
            top: -5,
            left: 17,
            width: 9,
            height: 9,
            transform: "rotate(45deg)",
            bgcolor: COLORS.surface,
            borderTop: `1px solid ${COLORS.border}`,
            borderLeft: `1px solid ${COLORS.border}`,
          },
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap={1}
          sx={{ px: 1.25, py: 0.9, bgcolor: "rgba(243,232,255,0.42)" }}
        >
          <Stack direction="row" gap={0.8} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 27,
              height: 27,
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              bgcolor: COLORS.surfaceSoft,
              color: COLORS.accent,
              flex: "0 0 auto",
            }}
          >
            {loading ? <CircularProgress size={15} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={0.65} alignItems="center" flexWrap="wrap">
              <Typography sx={{ color: COLORS.text, fontWeight: 850, fontSize: 13 }}>
                Relevant mens du skriver
              </Typography>
              {sourceCount > 0 && <Chip
                size="small"
                label={`${sourceCount} ${sourceCount === 1 ? "kilde" : "kilder"}`}
                sx={{ height: 19, fontSize: 10.5, color: COLORS.accent, bgcolor: COLORS.surfaceSoft }}
              />}
              {selection?.text && (
                <Chip size="small" label="Markert tekst" color="secondary" sx={{ height: 19, fontSize: 10.5 }} />
              )}
            </Stack>
            <Typography noWrap variant="caption" sx={{ color: COLORS.muted, display: "block", maxWidth: 285, fontSize: 10.5 }}>
              {activeSection || resolvedSection
                ? `Ved «${activeSection || resolvedSection}»`
                : `I «${documentTitle}»`}
            </Typography>
          </Box>
          </Stack>
          <Stack direction="row" gap={0.1} alignItems="center">
          <Tooltip title="Oppdater forslag">
            <span>
              <IconButton
                data-testid="smart-context-refresh"
                size="small"
                disabled={loading || disabled}
                onClick={() => void loadSuggestions()}
                sx={{ color: COLORS.accent, p: 0.65 }}
              >
                <RefreshOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Kilder">
            <IconButton
            data-testid="smart-context-library-open"
            size="small"
            aria-label="Kilder"
            onClick={() => void openLibrary()}
            sx={{ color: COLORS.accent, p: 0.65 }}
          >
              <SourceOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          {suggestion && (
            <Tooltip title="Skjul dette forslaget">
              <IconButton
                size="small"
                aria-label="Skjul forslag"
                onClick={dismissSuggestion}
                sx={{ color: COLORS.dim, p: 0.65 }}
              >
                <CloseOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

        <Box data-testid="smart-context-suggestions">
          {error && <Alert severity="warning" sx={{ m: 1, py: 0 }}>{error}</Alert>}
          {!suggestion && (
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ px: 1.25, py: 1 }}>
              <Typography variant="body2" sx={{ color: COLORS.muted, fontSize: 12.5, lineHeight: 1.45 }}>
                {loading
                  ? "Søker i dokumentene dine …"
                  : sourceCount === 0
                    ? "Koble en CV eller et annet dokument for forslag akkurat her."
                    : "Ingen tydelig kilde passer her ennå. Fortsett å skrive eller flytt markøren."}
              </Typography>
              {sourceCount === 0 && !loading && (
                <Button size="small" variant="contained" onClick={() => void openLibrary()} sx={{ whiteSpace: "nowrap", textTransform: "none" }}>
                  Koble kilder
                </Button>
              )}
            </Stack>
          )}

          {suggestion && (
            <Box key={suggestion.id} data-testid="smart-context-suggestion" sx={{ px: 1.25, pt: 1, pb: 1.15 }}>
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={0.65} alignItems="center" flexWrap="wrap">
                    <Typography sx={{ color: COLORS.text, fontWeight: 820, fontSize: 12.75 }}>
                      Fra {suggestion.sourceTitle}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${Math.round(suggestion.relevance * 100)} %`}
                      sx={{ height: 19, fontSize: 10.5, color: COLORS.green, bgcolor: "#dcfce7" }}
                    />
                  </Stack>
                  <Typography variant="caption" sx={{ color: COLORS.dim, fontSize: 10.5 }}>
                    {suggestion.originDocumentTitle}
                    {sourceLocation(suggestion) ? ` · ${sourceLocation(suggestion)}` : ""}
                  </Typography>
                </Box>
                {visibleSuggestions.length > 1 && (
                  <Button size="small" onClick={dismissSuggestion} sx={{ minWidth: 0, px: 0.7, fontSize: 11, textTransform: "none" }}>
                    Neste
                  </Button>
                )}
              </Stack>
              <Typography
                sx={{
                  mt: 0.75,
                  color: COLORS.text,
                  fontSize: 12.5,
                  lineHeight: 1.52,
                  whiteSpace: "pre-line",
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {suggestion.excerpt}
              </Typography>
              <Typography variant="caption" sx={{ mt: 0.45, color: COLORS.muted, display: "block", fontSize: 10.5 }}>
                {suggestion.reason}
              </Typography>
              <Stack direction="row" gap={0.35} mt={0.9} alignItems="center" flexWrap="wrap">
                <Button
                  data-testid="smart-context-insert-text"
                  size="small"
                  variant="contained"
                  disabled={disabled}
                  startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />}
                  onClick={() => void insert(suggestion, "text")}
                  sx={{ textTransform: "none", fontSize: 11.5 }}
                >
                  Sett inn
                </Button>
                <Button
                  size="small"
                  disabled={disabled}
                  startIcon={<FormatListBulletedOutlinedIcon sx={{ fontSize: 15 }} />}
                  onClick={() => void insert(suggestion, "bullets")}
                  sx={{ color: COLORS.accent, textTransform: "none", fontSize: 11.5 }}
                >
                  Punkter
                </Button>
                <Button
                  size="small"
                  disabled={disabled}
                  startIcon={<LinkOutlinedIcon sx={{ fontSize: 15 }} />}
                  onClick={() => void insert(suggestion, "source_card")}
                  sx={{ color: COLORS.accent, textTransform: "none", fontSize: 11.5 }}
                >
                  Kildekort
                </Button>
                <Tooltip title="Åpne originalkilden">
                  <IconButton
                    size="small"
                    aria-label="Vis kilde"
                    onClick={() => {
                      const sourceId = suggestionSourceId(suggestion);
                      if (sourceId) void openPreview(suggestion.sourceType, sourceId);
                    }}
                    sx={{ color: COLORS.muted }}
                  >
                    <MenuBookOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          )}
        </Box>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.35, borderTop: `1px solid ${COLORS.border}` }}>
          <Stack direction="row" gap={0.1} alignItems="center">
            <Switch size="small" checked={automatic} onChange={(_event, checked) => setAutomatic(checked)} />
            <Typography variant="caption" sx={{ color: COLORS.muted, fontSize: 10.5 }}>Automatisk</Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: COLORS.dim, fontSize: 10 }}>
            Du godkjenner før innsetting
          </Typography>
        </Stack>
      </Box>

      <Dialog open={libraryOpen} onClose={() => setLibraryOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Kontekstbibliotek</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Koble dokumenter og ferdig indekserte filer. Filer fra adminprosjektet blir automatisk tilgjengelige når dokumentet er koblet til prosjektet. Eksterne lenker hentes ikke automatisk av sikkerhetsgrunner.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Søk etter CV, søknad, budsjett eller annet dokument"
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> }}
            sx={{ mb: 2 }}
          />
          {libraryLoading && <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>}
          {!libraryLoading && !filteredLibrary.length && <Alert severity="info">Ingen tilgjengelige kilder matcher søket.</Alert>}
          <Stack gap={1} data-testid="smart-context-library">
            {!libraryLoading && filteredLibrary.map((source) => {
              const status = sourceStatus(source);
              const ready = source.source_type === "workspace_document" || source.extraction_status === "ready";
              return (
                <Stack
                  key={`${source.source_type}:${source.source_id}`}
                  data-source-id={source.source_id}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ sm: "center" }}
                  gap={1}
                  sx={{ p: 1.4, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" gap={0.7} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={750}>{source.title}</Typography>
                      <Chip size="small" label={sourceTypeLabel(source)} />
                      {source.scope === "project" && <Chip size="small" label="Delt i prosjektet" color="secondary" variant="outlined" />}
                      <Chip size="small" label={status.label} color={status.color} variant="outlined" />
                      {source.intrinsic && <Chip size="small" label="Vedlegg her" color="secondary" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {source.subtitle || "Workspace"}{source.character_count ? ` · ${source.character_count.toLocaleString("nb-NO")} tegn` : ""}
                    </Typography>
                    {source.extraction_error && <Typography variant="caption" color="error" display="block">{source.extraction_error}</Typography>}
                  </Box>
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {ready && (
                      <Button size="small" onClick={() => void openPreview(source.source_type, source.source_id)}>
                        Forhåndsvis
                      </Button>
                    )}
                    {source.source_type === "file" && ["pending", "failed"].includes(source.extraction_status) && (
                      <Button size="small" onClick={() => void reindexSource(source)}>Indekser</Button>
                    )}
                    <Button
                      data-testid="smart-context-source-toggle"
                      size="small"
                      variant={source.connected ? "outlined" : "contained"}
                      disabled={source.intrinsic || !ready}
                      onClick={() => void toggleSource(source)}
                    >
                      {source.intrinsic ? "Aktiv" : source.connected ? "Ikke bruk her" : "Bruk her"}
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void refreshLibrary()} disabled={libraryLoading}>Oppdater</Button>
          <Button variant="contained" onClick={() => setLibraryOpen(false)}>Ferdig</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(preview) || previewLoading} onClose={() => setPreview(null)} fullWidth maxWidth="md">
        <DialogTitle>{preview?.title || "Leser kilde …"}</DialogTitle>
        <DialogContent dividers>
          {previewLoading && <Box display="flex" justifyContent="center" py={5}><CircularProgress /></Box>}
          {preview && (
            <Stack gap={1.5}>
              {preview.originDocumentTitle && <Typography variant="caption" color="text.secondary">Fra {preview.originDocumentTitle}</Typography>}
              {preview.segments.map((segment, index) => (
                <Box key={String(segment.chunkIndex ?? segment.chunk_index ?? index)} sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1.5 }}>
                  {(segment.sectionLabel || segment.section_label || segment.pageNumber || segment.page_number) && (
                    <Typography variant="caption" color="secondary" fontWeight={700}>
                      {[segment.sectionLabel || segment.section_label, (segment.pageNumber || segment.page_number) ? `side ${segment.pageNumber || segment.page_number}` : null].filter(Boolean).join(" · ")}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5, lineHeight: 1.65 }}>{segment.content}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setPreview(null)}>Lukk</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
