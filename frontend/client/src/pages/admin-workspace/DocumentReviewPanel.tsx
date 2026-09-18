import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type {
  WorkspaceDocument,
  WorkspaceDocumentComment,
  WorkspaceDocumentCommentInput,
  WorkspaceDocumentFile,
  WorkspaceDocumentLink,
} from "../../services/adminRoomApi";
import { analyzeOppstartApplication } from "./oppstartApplicationModel";
import type { DocumentTextSelection } from "./WorkspaceDocumentEditor";

const PANEL = {
  border: "rgba(167, 139, 250, 0.2)",
  muted: "rgba(241,245,249,0.6)",
  surface: "rgba(11,5,24,0.5)",
};

interface Props {
  document: WorkspaceDocument;
  comments: WorkspaceDocumentComment[];
  files: WorkspaceDocumentFile[];
  links: WorkspaceDocumentLink[];
  selection: DocumentTextSelection | null;
  isOppstartApplication: boolean;
  busy: boolean;
  onCreateComment: (input: WorkspaceDocumentCommentInput) => Promise<void>;
  onUpdateComment: (
    comment: WorkspaceDocumentComment,
    input: { status?: "open" | "resolved"; assignee?: string | null },
  ) => Promise<void>;
  onDeleteComment: (comment: WorkspaceDocumentComment) => Promise<void>;
  onNavigateComment: (comment: WorkspaceDocumentComment) => void;
  onAcceptSuggestion: (comment: WorkspaceDocumentComment) => Promise<void>;
  onInsertEvidence: (label: string, url: string | null) => void;
}

interface ReviewCheck {
  label: string;
  detail: string;
  passed: boolean;
  warning?: boolean;
}

function buildChecks(
  document: WorkspaceDocument,
  comments: WorkspaceDocumentComment[],
  files: WorkspaceDocumentFile[],
  links: WorkspaceDocumentLink[],
  isOppstart: boolean,
): ReviewCheck[] {
  const openFields = (document.content.match(/\[MÅ FYLLES UT\]/gu) || [])
    .length;
  const openComments = comments.filter((item) => item.status === "open").length;
  const checks: ReviewCheck[] = [
    {
      label: "Åpne felt",
      detail: openFields ? `${openFields} felt gjenstår` : "Alt er besvart",
      passed: openFields === 0,
    },
    {
      label: "Merknader",
      detail: openComments
        ? `${openComments} åpne merknader`
        : "Gjennomgang ferdig",
      passed: openComments === 0,
    },
    {
      label: "Dokumentasjon",
      detail: `${files.length} vedlegg · ${links.length} koblinger`,
      passed: files.length + links.length > 0,
      warning: true,
    },
    {
      label: "Frist og neste handling",
      detail:
        document.due_date && document.next_action
          ? `${document.due_date} · ${document.next_action}`
          : "Må kontrolleres",
      passed: Boolean(document.due_date && document.next_action),
      warning: true,
    },
  ];
  if (isOppstart) {
    const sections = analyzeOppstartApplication(document.content);
    const missing = sections.filter((section) => !section.present).length;
    const long = sections.filter(
      (section) =>
        section.present && section.characters > section.workingCharacterLimit,
    ).length;
    checks.unshift({
      label: "Søknadsstruktur",
      detail: missing
        ? `${missing} deler mangler`
        : "Alle ni arbeidsdeler finnes",
      passed: missing === 0,
    });
    checks.push({
      label: "Arbeidsgrenser",
      detail: long
        ? `${long} deler er for lange`
        : "Alle deler er innenfor arbeidsgrensene",
      passed: long === 0,
      warning: true,
    });
  }
  return checks;
}

export function DocumentReviewPanel({
  document,
  comments,
  files,
  links,
  selection,
  isOppstartApplication,
  busy,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onNavigateComment,
  onAcceptSuggestion,
  onInsertEvidence,
}: Props) {
  const [view, setView] = useState<"comments" | "control" | "evidence">(
    "comments",
  );
  const [kind, setKind] = useState<"comment" | "suggestion">("comment");
  const [body, setBody] = useState("");
  const [suggestedText, setSuggestedText] = useState("");
  const [assignee, setAssignee] = useState("");
  const checks = useMemo(
    () => buildChecks(document, comments, files, links, isOppstartApplication),
    [comments, document, files, isOppstartApplication, links],
  );
  const failed = checks.filter((check) => !check.passed);

  const submit = async () => {
    if (!body.trim()) return;
    await onCreateComment({
      kind,
      body: body.trim(),
      selectedText: selection?.text || null,
      anchorFrom: selection?.from ?? null,
      anchorTo: selection?.to ?? null,
      suggestedText: kind === "suggestion" ? suggestedText : null,
      assignee: assignee.trim() || null,
    });
    setBody("");
    setSuggestedText("");
  };

  return (
    <Box data-testid="document-review-panel">
      <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2}>
        {(["comments", "control", "evidence"] as const).map((item) => (
          <Button
            key={item}
            size="small"
            variant={view === item ? "contained" : "outlined"}
            onClick={() => setView(item)}
          >
            {item === "comments"
              ? `Kommentarer (${comments.filter((value) => value.status === "open").length})`
              : item === "control"
                ? `Sluttkontroll (${failed.length})`
                : `Kilder (${files.length + links.length})`}
          </Button>
        ))}
      </Stack>

      {view === "comments" && (
        <Stack gap={1.5}>
          {selection?.text && (
            <Alert severity="info" data-testid="document-comment-selection">
              Markert tekst: «{selection.text.slice(0, 180)}
              {selection.text.length > 180 ? "…" : ""}»
            </Alert>
          )}
          <Box
            sx={{
              p: 1.5,
              border: `1px solid ${PANEL.border}`,
              borderRadius: 2,
              bgcolor: PANEL.surface,
            }}
          >
            <Stack gap={1.25}>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                <TextField
                  select
                  size="small"
                  label="Type"
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as typeof kind)
                  }
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="comment">Kommentar</MenuItem>
                  <MenuItem value="suggestion">Tekstforslag</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  label="Ansvarlig"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  placeholder="navn eller e-post"
                  fullWidth
                />
              </Stack>
              <TextField
                data-testid="document-comment-body"
                label="Merknad"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              {kind === "suggestion" && (
                <TextField
                  data-testid="document-suggested-text"
                  label="Foreslått erstatning"
                  value={suggestedText}
                  onChange={(event) => setSuggestedText(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
              )}
              <Button
                data-testid="document-comment-submit"
                variant="contained"
                disabled={
                  busy ||
                  !body.trim() ||
                  (kind === "suggestion" && !suggestedText.trim())
                }
                onClick={() => void submit()}
                sx={{ alignSelf: "flex-start" }}
              >
                Legg til
              </Button>
            </Stack>
          </Box>
          {!comments.length ? (
            <Alert severity="info">Ingen merknader ennå.</Alert>
          ) : (
            comments.map((comment) => (
              <Box
                key={comment.id}
                sx={{
                  p: 1.5,
                  border: `1px solid ${PANEL.border}`,
                  borderRadius: 2,
                  opacity: comment.status === "resolved" ? 0.62 : 1,
                  bgcolor: PANEL.surface,
                }}
              >
                <Stack direction="row" gap={0.75} flexWrap="wrap" mb={0.75}>
                  <Chip
                    size="small"
                    label={
                      comment.kind === "suggestion" ? "Forslag" : "Kommentar"
                    }
                    color={
                      comment.kind === "suggestion" ? "secondary" : "default"
                    }
                  />
                  <Chip
                    size="small"
                    label={comment.status === "open" ? "Åpen" : "Løst"}
                    color={comment.status === "open" ? "warning" : "success"}
                    variant="outlined"
                  />
                  {comment.assignee && (
                    <Chip
                      size="small"
                      label={`Ansvarlig: ${comment.assignee}`}
                      variant="outlined"
                    />
                  )}
                </Stack>
                <Typography variant="body2">{comment.body}</Typography>
                {comment.selected_text && (
                  <Box
                    sx={{
                      my: 1,
                      p: 1,
                      borderLeft: "3px solid #a78bfa",
                      bgcolor: "rgba(167,139,250,0.08)",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: PANEL.muted }}>
                      «{comment.selected_text}»
                    </Typography>
                  </Box>
                )}
                {comment.suggested_text && (
                  <Box
                    sx={{
                      my: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "rgba(34,197,94,0.08)",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "#86efac" }}>
                      Foreslått tekst
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {comment.suggested_text}
                    </Typography>
                  </Box>
                )}
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {comment.selected_text && (
                    <Button
                      size="small"
                      onClick={() => onNavigateComment(comment)}
                    >
                      Finn i tekst
                    </Button>
                  )}
                  {comment.kind === "suggestion" &&
                    comment.status === "open" && (
                      <Button
                        size="small"
                        color="success"
                        onClick={() => void onAcceptSuggestion(comment)}
                      >
                        Bruk forslag
                      </Button>
                    )}
                  <Button
                    size="small"
                    onClick={() =>
                      void onUpdateComment(comment, {
                        status: comment.status === "open" ? "resolved" : "open",
                      })
                    }
                  >
                    {comment.status === "open" ? "Marker løst" : "Åpne igjen"}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => void onDeleteComment(comment)}
                  >
                    Slett
                  </Button>
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      )}

      {view === "control" && (
        <Stack gap={1}>
          <Alert
            severity={failed.length ? "warning" : "success"}
            data-testid="document-preflight-summary"
          >
            {failed.length
              ? `${failed.length} kontrollpunkter må gjennomgås før innsending.`
              : "Dokumentet har bestått lokal sluttkontroll."}
          </Alert>
          {checks.map((check) => (
            <Stack
              key={check.label}
              direction="row"
              justifyContent="space-between"
              gap={1}
              sx={{
                p: 1.4,
                border: `1px solid ${PANEL.border}`,
                borderRadius: 2,
                bgcolor: PANEL.surface,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={750}>
                  {check.label}
                </Typography>
                <Typography variant="caption" sx={{ color: PANEL.muted }}>
                  {check.detail}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={
                  check.passed ? "OK" : check.warning ? "Sjekk" : "Mangler"
                }
                color={
                  check.passed ? "success" : check.warning ? "warning" : "error"
                }
              />
            </Stack>
          ))}
          {isOppstartApplication && (
            <Alert severity="info">
              Maks 150 000 kroner, løpende frist og markedsavklaring er
              verifisert mot Innovasjon Norges tjenesteside. Tegngrensene er
              interne arbeidsgrenser; bekreft portalens felt ved innsending.
            </Alert>
          )}
        </Stack>
      )}

      {view === "evidence" && (
        <Stack gap={1}>
          <Typography variant="body2" sx={{ color: PANEL.muted }}>
            Sett inn sporbare referanser direkte i teksten.
          </Typography>
          {!files.length && !links.length && (
            <Alert severity="info">
              Koble et vedlegg eller arbeidselement først.
            </Alert>
          )}
          {files.map((file) => (
            <Stack
              key={file.id}
              direction="row"
              justifyContent="space-between"
              gap={1}
              sx={{
                p: 1.25,
                border: `1px solid ${PANEL.border}`,
                borderRadius: 2,
                bgcolor: PANEL.surface,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={750}>
                  {file.file_name}
                </Typography>
                <Typography variant="caption" sx={{ color: PANEL.muted }}>
                  {file.source_kind}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() =>
                  onInsertEvidence(file.file_name, file.external_url)
                }
              >
                Sett inn vedleggskort
              </Button>
            </Stack>
          ))}
          {links.map((link) => (
            <Stack
              key={link.link_id}
              direction="row"
              justifyContent="space-between"
              gap={1}
              sx={{
                p: 1.25,
                border: `1px solid ${PANEL.border}`,
                borderRadius: 2,
                bgcolor: PANEL.surface,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={750}>
                  {link.title}
                </Typography>
                <Typography variant="caption" sx={{ color: PANEL.muted }}>
                  {link.subtitle || link.entity_type}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => onInsertEvidence(link.title, null)}
              >
                Sett inn kildekort
              </Button>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
