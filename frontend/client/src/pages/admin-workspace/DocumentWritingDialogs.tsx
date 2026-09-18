import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import InsertLinkOutlinedIcon from "@mui/icons-material/InsertLinkOutlined";
import PrivacyTipOutlinedIcon from "@mui/icons-material/PrivacyTipOutlined";

import {
  WORKSPACE_DOCUMENT_LINK_LABELS,
  type WorkspaceDocumentFile,
  type WorkspaceDocumentLink,
  type WorkspaceDocumentVersionDetail,
} from "../../services/adminRoomApi";
import {
  analyzeOppstartApplication,
  type OppstartApplicationSectionAnalysis,
} from "./oppstartApplicationModel";

const PAPER = {
  background: "#fffdf8",
  backgroundMuted: "#f7f2e9",
  border: "#ddd4c7",
  text: "#241d2b",
  muted: "#746b78",
};

export type LocalWritingAction =
  | "make_concrete"
  | "shorten"
  | "improve_clarity"
  | "find_evidence_gaps";

interface LocalWritingReview {
  suggestion: string;
  notes: string[];
}

const WRITING_ACTIONS: Array<{
  value: LocalWritingAction;
  label: string;
  description: string;
}> = [
  {
    value: "make_concrete",
    label: "Gjør mer konkret",
    description:
      "Strammer inn vage formuleringer og peker ut påstander som trenger bevis.",
  },
  {
    value: "shorten",
    label: "Kort ned",
    description: "Fjerner fyllord og lange standardfraser uten å endre fakta.",
  },
  {
    value: "improve_clarity",
    label: "Forbedre klarhet",
    description: "Forenkler tungt språk og gjør setningene mer direkte.",
  },
  {
    value: "find_evidence_gaps",
    label: "Finn dokumentasjonsgap",
    description:
      "Finner tall, superlativer og markedsutsagn som mangler en synlig kilde.",
  },
];

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/på nåværende tidspunkt/giu, "nå"],
  [/på grunn av det faktum at/giu, "fordi"],
  [/med hensyn til/giu, "om"],
  [/har mulighet til å/giu, "kan"],
  [/i den forbindelse/giu, "derfor"],
  [/det er viktig å (?:påpeke|understreke) at\s*/giu, ""],
  [/i forhold til/giu, "for"],
  [/som et resultat av/giu, "derfor"],
];

const VAGUE_PATTERN =
  /\b(unikt|unik|betydelig|stort|stor|enormt|enorm|ledende|revolusjonerende|mange|raskt|vesentlig bedre|best)\b/giu;
const EVIDENCE_PATTERN =
  /(?:\b\d+(?:[.,]\d+)?\s*(?:%|prosent|kr|kroner|millioner|milliarder)?\b|\b(markedet|kundene|bransjen)\s+(?:vil|ønsker|trenger|har)|\b(unikt|ledende|best|betydelig marked)\b)/giu;

function applyPhraseReplacements(value: string): string {
  return PHRASE_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/ +\n/gu, "\n");
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [
    ...new Set([...value.matchAll(pattern)].map((match) => match[0].trim())),
  ];
}

export function createLocalWritingReview(
  text: string,
  action: LocalWritingAction,
): LocalWritingReview {
  const vague = uniqueMatches(text, VAGUE_PATTERN);
  const evidenceClaims = text
    .split(/(?<=[.!?])\s+/u)
    .filter(
      (sentence) =>
        new RegExp(EVIDENCE_PATTERN.source, "iu").test(sentence) &&
        !/\]\(https?:\/\//u.test(sentence),
    )
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
  VAGUE_PATTERN.lastIndex = 0;

  if (action === "find_evidence_gaps") {
    return {
      suggestion: text,
      notes: evidenceClaims.length
        ? evidenceClaims.map(
            (claim) =>
              "Dokumenter eller kvalifiser: «" + claim.slice(0, 180) + "»",
          )
        : [
            "Fant ingen tydelige tall-, superlativ- eller markedsutsagn uten synlig lenke.",
          ],
    };
  }

  const suggestion = applyPhraseReplacements(text);
  const notes: string[] = [];
  if (suggestion !== text) {
    notes.push(
      "Standardfraser og fyllord er strammet inn uten å endre tall eller navn.",
    );
  }
  if (vague.length) {
    notes.push(
      "Konkretiser eller dokumenter: " + vague.slice(0, 6).join(", ") + ".",
    );
  }
  if (action === "make_concrete" && evidenceClaims.length) {
    notes.push(
      String(evidenceClaims.length) +
        " påstand(er) ser ut til å trenge kundegrunnlag, tall eller kilde.",
    );
  }
  if (action === "shorten") {
    notes.push(
      suggestion.length < text.length
        ? "Forslaget er " +
            String(text.length - suggestion.length) +
            " tegn kortere."
        : "Ingen trygge standardfraser kunne fjernes automatisk.",
    );
  }
  if (!notes.length) notes.push("Ingen sikre lokale forbedringer ble funnet.");
  return { suggestion, notes };
}

interface WritingReviewDialogProps {
  open: boolean;
  section: OppstartApplicationSectionAnalysis | null;
  onClose: () => void;
  onApply: (suggestion: string) => void;
}

export function WritingReviewDialog({
  open,
  section,
  onClose,
  onApply,
}: WritingReviewDialogProps) {
  const [action, setAction] = useState<LocalWritingAction>("make_concrete");

  useEffect(() => {
    if (open) setAction("make_concrete");
  }, [open, section?.heading]);

  const review = useMemo(
    () => createLocalWritingReview(section?.body ?? "", action),
    [action, section?.body],
  );
  const changed = Boolean(section && review.suggestion !== section.body);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        Lokal skrivekontroll — {section?.label ?? "søknadsdel"}
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" icon={<PrivacyTipOutlinedIcon />} sx={{ mb: 2 }}>
          Teksten behandles lokalt i nettleseren og sendes ikke til en ekstern
          AI-leverandør.
        </Alert>
        <TextField
          select
          label="Kontroll"
          value={action}
          onChange={(event) =>
            setAction(event.target.value as LocalWritingAction)
          }
          fullWidth
          sx={{ mb: 2 }}
        >
          {WRITING_ACTIONS.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              <Box>
                <Typography fontWeight={750}>{item.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </TextField>

        <Box
          data-testid="writing-review-comparison"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            border: "1px solid " + PAPER.border,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          {[
            ["Nåværende tekst", section?.body ?? ""],
            ["Forslag", review.suggestion],
          ].map(([label, value], index) => (
            <Box
              key={label}
              sx={{
                minWidth: 0,
                borderLeft: { lg: index ? "1px solid " + PAPER.border : 0 },
                borderTop: {
                  xs: index ? "1px solid " + PAPER.border : 0,
                  lg: 0,
                },
              }}
            >
              <Typography
                sx={{
                  px: 1.5,
                  py: 1,
                  bgcolor: PAPER.backgroundMuted,
                  color: PAPER.muted,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {label}
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  minHeight: 320,
                  maxHeight: 520,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  bgcolor: PAPER.background,
                  color: PAPER.text,
                  fontFamily:
                    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  fontSize: 13.5,
                  lineHeight: 1.7,
                }}
              >
                {value}
              </Box>
            </Box>
          ))}
        </Box>

        <Stack gap={0.6} mt={2}>
          {review.notes.map((note, index) => (
            <Stack
              key={String(index) + note}
              direction="row"
              gap={1}
              alignItems="flex-start"
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "#f59e0b",
                  mt: 0.8,
                }}
              />
              <Typography variant="body2">{note}</Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avvis</Button>
        <Button
          data-testid="apply-writing-review"
          variant="contained"
          startIcon={<CheckOutlinedIcon />}
          disabled={!changed}
          onClick={() => onApply(review.suggestion)}
        >
          Godkjenn forslag
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface SourceBankDialogProps {
  open: boolean;
  sectionLabel: string | null;
  links: WorkspaceDocumentLink[];
  files: WorkspaceDocumentFile[];
  onClose: () => void;
  onInsert: (citation: string) => void;
}

export function SourceBankDialog({
  open,
  sectionLabel,
  links,
  files,
  onClose,
  onInsert,
}: SourceBankDialogProps) {
  const total = links.length + files.length;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Kildebank{sectionLabel ? " — " + sectionLabel : ""}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Sett inn en sporbar kildehenvisning i den aktive søknadsdelen. Vedlegg
          uten offentlig URL henvises med filnavn.
        </Typography>
        {!total ? (
          <Alert severity="info">
            Koble et vedlegg eller arbeidselement til dokumentet først.
          </Alert>
        ) : (
          <Stack gap={1}>
            {files.map((file) => {
              const citation = file.external_url
                ? "[" + file.file_name + "](" + file.external_url + ")"
                : "Vedlegg: **" + file.file_name + "**";
              return (
                <Stack
                  key={file.id}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ sm: "center" }}
                  gap={1}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Box>
                    <Typography fontWeight={750}>{file.file_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {file.source_kind === "upload"
                        ? "Opplastet vedlegg"
                        : "Dokumentlenke"}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<InsertLinkOutlinedIcon />}
                    onClick={() => onInsert(citation)}
                  >
                    Sett inn
                  </Button>
                </Stack>
              );
            })}
            {links.map((link) => {
              const citation =
                WORKSPACE_DOCUMENT_LINK_LABELS[link.entity_type] +
                ": **" +
                link.title +
                "**";
              return (
                <Stack
                  key={link.link_id}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ sm: "center" }}
                  gap={1}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Box>
                    <Typography fontWeight={750}>{link.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {WORKSPACE_DOCUMENT_LINK_LABELS[link.entity_type]}
                      {link.subtitle ? " · " + link.subtitle : ""}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<InsertLinkOutlinedIcon />}
                    onClick={() => onInsert(citation)}
                  >
                    Sett inn
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ferdig</Button>
      </DialogActions>
    </Dialog>
  );
}

function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value);
}

function downloadText(value: string, filename: string): void {
  const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

interface PortalExportDialogProps {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export function PortalExportDialog({
  open,
  title,
  content,
  onClose,
}: PortalExportDialogProps) {
  const sections = useMemo(
    () => analyzeOppstartApplication(content),
    [content],
  );
  const exportText = sections
    .filter((section) => section.present)
    .map((section) => section.label + "\n\n" + section.body)
    .join("\n\n---\n\n");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Portaleksport — Oppstartstilskudd 1</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Dette er en kopieringsflate, ikke en direkte innsending. Sammenlign
          navn, rekkefølge og tegnbegrensninger med de gjeldende feltene på Min
          side.
        </Alert>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1} mb={2}>
          <Button
            data-testid="copy-all-portal-fields"
            variant="contained"
            startIcon={<ContentCopyOutlinedIcon />}
            onClick={() => void copyText(exportText)}
          >
            Kopier alle felt
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() =>
              downloadText(
                exportText,
                title.replace(/[^a-z0-9æøå]+/giu, "-").replace(/^-|-$/gu, "") +
                  "-portaleksport.txt",
              )
            }
          >
            Last ned tekstfil
          </Button>
        </Stack>
        <Stack gap={1.25}>
          {sections.map((section, index) => (
            <Box
              key={section.heading}
              data-testid={"portal-field-" + String(index + 1)}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ sm: "center" }}
                gap={1}
                sx={{ px: 1.5, py: 1, bgcolor: "action.hover" }}
              >
                <Box>
                  <Typography fontWeight={800}>
                    {String(index + 1)}. {section.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {section.characters.toLocaleString("nb-NO")} tegn ·
                    arbeidsmål{" "}
                    {section.workingCharacterLimit.toLocaleString("nb-NO")}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.75}>
                  {section.remaining > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      label={String(section.remaining) + " åpne felt"}
                    />
                  )}
                  <Button
                    size="small"
                    startIcon={<ContentCopyOutlinedIcon />}
                    disabled={!section.present}
                    onClick={() => void copyText(section.body)}
                  >
                    Kopier
                  </Button>
                </Stack>
              </Stack>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  maxHeight: 240,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {section.present
                  ? section.body
                  : "Seksjonen mangler i dokumentet."}
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}

type DiffKind = "same" | "changed" | "removed" | "added";
interface DiffRow {
  oldLine: string;
  newLine: string;
  kind: DiffKind;
}

function alignLines(oldText: string, newText: string): DiffRow[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  if (oldLines.length * newLines.length > 180_000) {
    const length = Math.max(oldLines.length, newLines.length);
    return Array.from({ length }, (_, index) => ({
      oldLine: oldLines[index] ?? "",
      newLine: newLines[index] ?? "",
      kind:
        oldLines[index] === undefined
          ? "added"
          : newLines[index] === undefined
            ? "removed"
            : oldLines[index] === newLines[index]
              ? "same"
              : "changed",
    }));
  }

  const matrix = Array.from(
    { length: oldLines.length + 1 },
    () => new Uint32Array(newLines.length + 1),
  );
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      matrix[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? matrix[oldIndex + 1][newIndex + 1] + 1
          : Math.max(
              matrix[oldIndex + 1][newIndex],
              matrix[oldIndex][newIndex + 1],
            );
    }
  }

  const rows: DiffRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      rows.push({
        oldLine: oldLines[oldIndex],
        newLine: newLines[newIndex],
        kind: "same",
      });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      newIndex < newLines.length &&
      (oldIndex >= oldLines.length ||
        matrix[oldIndex][newIndex + 1] >= matrix[oldIndex + 1][newIndex])
    ) {
      rows.push({ oldLine: "", newLine: newLines[newIndex], kind: "added" });
      newIndex += 1;
    } else {
      rows.push({ oldLine: oldLines[oldIndex], newLine: "", kind: "removed" });
      oldIndex += 1;
    }
  }
  return rows;
}

interface VersionCompareDialogProps {
  open: boolean;
  currentContent: string;
  version: WorkspaceDocumentVersionDetail | null;
  loading: boolean;
  onClose: () => void;
}

export function VersionCompareDialog({
  open,
  currentContent,
  version,
  loading,
  onClose,
}: VersionCompareDialogProps) {
  const rows = useMemo(
    () => alignLines(version?.content ?? "", currentContent),
    [currentContent, version?.content],
  );
  const changedRows = rows.filter((row) => row.kind !== "same").length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        Sammenlign versjon {version?.version_number ?? ""} med arbeidskopien
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <LinearProgress sx={{ my: 4 }} />
        ) : (
          <>
            <Stack direction="row" gap={1} mb={1.5}>
              <Chip
                size="small"
                label={String(changedRows) + " endrede linjer"}
              />
              {version?.change_note && (
                <Chip
                  size="small"
                  label={version.change_note}
                  variant="outlined"
                />
              )}
            </Stack>
            <Box
              data-testid="version-comparison"
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                border: "1px solid " + PAPER.border,
                borderRadius: 2,
                overflow: "auto",
                maxHeight: "68vh",
                bgcolor: PAPER.background,
              }}
            >
              {["Valgt versjon", "Arbeidskopi"].map((label) => (
                <Typography
                  key={label}
                  sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    px: 1.5,
                    py: 1,
                    bgcolor: PAPER.backgroundMuted,
                    color: PAPER.text,
                    fontSize: 12,
                    fontWeight: 850,
                    borderBottom: "1px solid " + PAPER.border,
                  }}
                >
                  {label}
                </Typography>
              ))}
              {rows.flatMap((row, index) => {
                const oldBg =
                  row.kind === "removed"
                    ? "#fee2e2"
                    : row.kind === "same"
                      ? "transparent"
                      : "#fff7ed";
                const newBg =
                  row.kind === "added"
                    ? "#dcfce7"
                    : row.kind === "same"
                      ? "transparent"
                      : "#f0fdf4";
                return [
                  <Box
                    component="pre"
                    key={"old-" + String(index)}
                    sx={{
                      m: 0,
                      px: 1.25,
                      py: 0.45,
                      minHeight: 28,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      bgcolor: oldBg,
                      color: PAPER.text,
                      borderRight: "1px solid " + PAPER.border,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {row.oldLine || " "}
                  </Box>,
                  <Box
                    component="pre"
                    key={"new-" + String(index)}
                    sx={{
                      m: 0,
                      px: 1.25,
                      py: 0.45,
                      minHeight: 28,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      bgcolor: newBg,
                      color: PAPER.text,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {row.newLine || " "}
                  </Box>,
                ];
              })}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}
