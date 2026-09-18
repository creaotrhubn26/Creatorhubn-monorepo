import { type ReactNode, useMemo, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FullscreenExitOutlinedIcon from "@mui/icons-material/FullscreenExitOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";

import { WorkspaceRichTextCanvas } from "./WorkspaceRichTextCanvas";

type EditorMode = "write" | "split" | "preview";

export interface DocumentSectionFocus {
  start: number;
  end: number;
  label: string;
}

export interface DocumentNavigationTarget {
  position: number;
  length?: number;
  requestId: number;
  heading?: string;
  sectionHeading?: string;
}

export interface DocumentTextSelection {
  text: string;
  from: number;
  to: number;
}

interface WorkspaceDocumentEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  focusMode: boolean;
  onToggleFocus: () => void;
  sectionFocus?: DocumentSectionFocus | null;
  onExitSectionFocus?: () => void;
  navigationTarget?: DocumentNavigationTarget | null;
  onCursorChange?: (position: number) => void;
  onTextSelection?: (selection: DocumentTextSelection | null) => void;
  onCommentRequest?: () => void;
  inlineAssistant?: ReactNode;
}

interface OutlineItem {
  level: number;
  title: string;
  position: number;
}

const PAPER = {
  background: "#fffdf8",
  backgroundMuted: "#f7f2e9",
  border: "#ddd4c7",
  text: "#241d2b",
  muted: "#746b78",
  accent: "#6d28d9",
  accentSoft: "#ede9fe",
};

const inlinePattern =
  /(\[MÅ FYLLES UT\]|\*\*[^*\n]+\*\*|_[^_\n]+_|\x60[^\x60\n]+\x60|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/gu;

function renderInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    const token = match[0];
    if (index > cursor) result.push(text.slice(cursor, index));

    if (token === "[MÅ FYLLES UT]") {
      result.push(
        <Box
          component="mark"
          key={index}
          sx={{
            bgcolor: "#fef3c7",
            color: "#92400e",
            borderRadius: 0.75,
            px: 0.6,
            py: 0.15,
            fontWeight: 750,
          }}
        >
          Må fylles ut
        </Box>,
      );
    } else if (token.startsWith("**")) {
      result.push(
        <Box component="strong" key={index}>
          {token.slice(2, -2)}
        </Box>,
      );
    } else if (token.startsWith("_")) {
      result.push(
        <Box component="em" key={index}>
          {token.slice(1, -1)}
        </Box>,
      );
    } else if (token.charCodeAt(0) === 96) {
      result.push(
        <Box
          component="code"
          key={index}
          sx={{ bgcolor: PAPER.backgroundMuted, borderRadius: 0.5, px: 0.5 }}
        >
          {token.slice(1, -1)}
        </Box>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/u);
      result.push(
        linkMatch ? (
          <Box
            component="a"
            key={index}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            sx={{ color: PAPER.accent, textDecorationColor: "#c4b5fd" }}
          >
            {linkMatch[1]}
          </Box>
        ) : (
          token
        ),
      );
    }
    cursor = index + token.length;
  }

  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}
interface PreviewTableData {
  headers: string[];
  rows: string[][];
  endIndex: number;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

function collectPreviewTables(lines: string[]): {
  starts: Map<number, PreviewTableData>;
  covered: Set<number>;
} {
  const starts = new Map<number, PreviewTableData>();
  const covered = new Set<number>();

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = parseTableRow(lines[index]);
    const separator = parseTableRow(lines[index + 1]);
    const isTable =
      headers.length > 1 &&
      separator.length === headers.length &&
      separator.every((cell) => /^:?-{3,}:?$/u.test(cell));
    if (!isTable) continue;

    const rows: string[][] = [];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].includes("|")) {
      const row = parseTableRow(lines[cursor]);
      if (row.length !== headers.length) break;
      rows.push(row);
      cursor += 1;
    }
    starts.set(index, { headers, rows, endIndex: cursor - 1 });
    for (let hidden = index + 1; hidden < cursor; hidden += 1) {
      covered.add(hidden);
    }
    index = cursor - 1;
  }

  return { starts, covered };
}

function PreviewTable({ table }: { table: PreviewTableData }) {
  return (
    <TableContainer
      sx={{
        my: 2.25,
        border: "1px solid " + PAPER.border,
        borderRadius: 1.5,
        overflowX: "auto",
        boxShadow: "0 8px 24px rgba(36,29,43,0.06)",
      }}
    >
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            {table.headers.map((cell, index) => (
              <TableCell
                key={String(index) + cell}
                sx={{
                  bgcolor: PAPER.backgroundMuted,
                  color: PAPER.text,
                  borderColor: PAPER.border,
                  fontWeight: 800,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  whiteSpace: "normal",
                }}
              >
                {renderInline(cell)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {table.rows.map((row, rowIndex) => (
            <TableRow key={String(rowIndex) + row.join("|")}>
              {row.map((cell, cellIndex) => (
                <TableCell
                  key={String(cellIndex) + cell}
                  sx={{
                    color: PAPER.text,
                    borderColor: PAPER.border,
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    verticalAlign: "top",
                    bgcolor: rowIndex % 2 === 0 ? PAPER.background : "#fbf8f2",
                  }}
                >
                  {renderInline(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DocumentPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const tables = collectPreviewTables(lines);
  const firstSectionIndex = lines.findIndex((line) => /^##\s+/u.test(line));

  return (
    <Box
      data-testid="document-preview"
      sx={{
        minHeight: 720,
        bgcolor: "#e9e3da",
        color: PAPER.text,
        p: { xs: 1, sm: 2, lg: 3 },
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <Box
        data-testid="document-preview-page"
        sx={{
          minHeight: 720,
          maxWidth: 840,
          width: "100%",
          boxSizing: "border-box",
          mx: "auto",
          px: { xs: 2.5, sm: 5, lg: 7 },
          py: { xs: 3.5, sm: 5.5 },
          bgcolor: PAPER.background,
          border: "1px solid " + PAPER.border,
          borderTop: "4px solid " + PAPER.accent,
          borderRadius: 0.75,
          boxShadow: "0 22px 55px rgba(36,29,43,0.13)",
        }}
      >
        {lines.map((line, index) => {
          const table = tables.starts.get(index);
          if (table) return <PreviewTable key={index} table={table} />;
          if (tables.covered.has(index)) return null;

          if (/^\\?\[SIDESKIFT\\?\]$/u.test(line.trim())) {
            return (
              <Stack
                key={index}
                direction="row"
                alignItems="center"
                gap={1.5}
                data-testid="document-preview-page-break"
                sx={{ my: 4 }}
              >
                <Divider
                  sx={{
                    flex: 1,
                    borderStyle: "dashed",
                    borderColor: PAPER.border,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: PAPER.muted, fontWeight: 700 }}
                >
                  Sideskift
                </Typography>
                <Divider
                  sx={{
                    flex: 1,
                    borderStyle: "dashed",
                    borderColor: PAPER.border,
                  }}
                />
              </Stack>
            );
          }
          const metadata =
            firstSectionIndex > 0 && index < firstSectionIndex
              ? line.match(/^\*\*([^*]+):\*\*\s*(.*)$/u)
              : null;
          if (metadata) {
            return (
              <Box
                key={index}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "170px 1fr" },
                  gap: { xs: 0.2, sm: 2 },
                  py: 0.75,
                  borderBottom: "1px solid #eee7dc",
                }}
              >
                <Typography
                  sx={{ color: PAPER.muted, fontSize: 12.5, fontWeight: 750 }}
                >
                  {metadata[1]}
                </Typography>
                <Typography sx={{ color: PAPER.text, fontSize: 13.5 }}>
                  {renderInline(metadata[2].trim())}
                </Typography>
              </Box>
            );
          }

          const heading = line.match(/^(#{1,3})\s+(.+)$/u);
          if (heading) {
            const level = heading[1].length;
            return (
              <Typography
                key={index}
                component={level === 1 ? "h1" : level === 2 ? "h2" : "h3"}
                sx={{
                  fontSize:
                    level === 1 ? "2rem" : level === 2 ? "1.45rem" : "1.1rem",
                  lineHeight: 1.25,
                  fontWeight: level === 1 ? 850 : 780,
                  letterSpacing: level === 1 ? "-0.035em" : "-0.015em",
                  mt: level === 1 ? 0 : level === 2 ? 4 : 2.5,
                  mb: 1.25,
                  pb: level === 2 ? 0.75 : 0,
                  borderBottom: level === 2 ? "1px solid " + PAPER.border : 0,
                  color: level === 3 ? "#4c1d95" : PAPER.text,
                }}
              >
                {renderInline(heading[2])}
              </Typography>
            );
          }

          const checkbox = line.match(/^\s*- \[([ xX])\]\s+(.+)$/u);
          if (checkbox) {
            const checked = checkbox[1].toLowerCase() === "x";
            return (
              <Stack
                key={index}
                direction="row"
                gap={1.15}
                alignItems="flex-start"
                sx={{ my: 0.65, pl: 0.5 }}
              >
                <Box
                  sx={{
                    mt: 0.25,
                    width: 18,
                    height: 18,
                    borderRadius: 0.6,
                    border:
                      "1.5px solid " + (checked ? PAPER.accent : "#a8a0aa"),
                    bgcolor: checked ? PAPER.accent : "transparent",
                    color: "#fff",
                    fontSize: 12,
                    lineHeight: "15px",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {checked ? "✓" : ""}
                </Box>
                <Typography
                  sx={{
                    lineHeight: 1.7,
                    color: checked ? PAPER.muted : PAPER.text,
                  }}
                >
                  {renderInline(checkbox[2])}
                </Typography>
              </Stack>
            );
          }

          const bullet = line.match(/^\s*[-*]\s+(.+)$/u);
          if (bullet) {
            return (
              <Stack
                key={index}
                direction="row"
                gap={1.2}
                alignItems="flex-start"
                sx={{ my: 0.5, pl: 1 }}
              >
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    mt: 1.2,
                    borderRadius: "50%",
                    bgcolor: PAPER.accent,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ lineHeight: 1.75 }}>
                  {renderInline(bullet[1])}
                </Typography>
              </Stack>
            );
          }

          const numbered = line.match(/^\s*(\d+)\.\s+(.+)$/u);
          if (numbered) {
            return (
              <Stack
                key={index}
                direction="row"
                gap={1}
                alignItems="flex-start"
                sx={{ my: 0.5, pl: 0.5 }}
              >
                <Typography
                  sx={{
                    minWidth: 24,
                    color: PAPER.accent,
                    fontWeight: 750,
                    lineHeight: 1.75,
                  }}
                >
                  {numbered[1]}.
                </Typography>
                <Typography sx={{ lineHeight: 1.75 }}>
                  {renderInline(numbered[2])}
                </Typography>
              </Stack>
            );
          }

          const quote = line.match(/^>\s?(.*)$/u);
          if (quote) {
            return (
              <Box
                key={index}
                sx={{
                  borderLeft: "3px solid #c4b5fd",
                  pl: 2,
                  py: 0.5,
                  my: 1.5,
                  color: PAPER.muted,
                  fontStyle: "italic",
                }}
              >
                {renderInline(quote[1])}
              </Box>
            );
          }

          if (/^\s*---+\s*$/u.test(line)) {
            return (
              <Divider key={index} sx={{ my: 3, borderColor: PAPER.border }} />
            );
          }
          if (!line.trim()) return <Box key={index} sx={{ height: 10 }} />;

          return (
            <Typography
              key={index}
              component="p"
              sx={{ lineHeight: 1.8, my: 0.7 }}
            >
              {renderInline(line)}
            </Typography>
          );
        })}
      </Box>
    </Box>
  );
}

export function WorkspaceDocumentEditor({
  value,
  onChange,
  disabled = false,
  focusMode,
  onToggleFocus,
  sectionFocus = null,
  onExitSectionFocus,
  navigationTarget = null,
  onCursorChange,
  onTextSelection,
  onCommentRequest,
  inlineAssistant,
}: WorkspaceDocumentEditorProps) {
  const [mode, setMode] = useState<EditorMode>("write");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineNavigationTarget, setOutlineNavigationTarget] =
    useState<DocumentNavigationTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const globalOffset = sectionFocus?.start ?? 0;
  const editorValue = sectionFocus
    ? value.slice(sectionFocus.start, sectionFocus.end)
    : value;
  const searchMatches = useMemo(() => {
    const matches: number[] = [];
    const needle = searchQuery.trim();
    if (!needle) return matches;
    const haystack = editorValue.toLocaleLowerCase("nb-NO");
    const normalizedNeedle = needle.toLocaleLowerCase("nb-NO");
    let from = 0;
    while (from <= haystack.length - normalizedNeedle.length) {
      const position = haystack.indexOf(normalizedNeedle, from);
      if (position < 0) break;
      matches.push(position);
      from = position + Math.max(1, normalizedNeedle.length);
    }
    return matches;
  }, [editorValue, searchQuery]);

  const commitEditorValue = (nextValue: string) => {
    if (!sectionFocus) {
      onChange(nextValue);
      return;
    }
    const suffix = value.slice(sectionFocus.end);
    const needsBoundary =
      nextValue.length > 0 &&
      suffix.length > 0 &&
      !nextValue.endsWith("\n") &&
      !suffix.startsWith("\n");
    const replacement = needsBoundary ? nextValue + "\n\n" : nextValue;
    onChange(value.slice(0, sectionFocus.start) + replacement + suffix);
  };

  const navigateSearch = (step: number) => {
    if (!searchMatches.length) return;
    const next =
      (searchIndex + step + searchMatches.length) % searchMatches.length;
    setSearchIndex(next);
    setMode("write");
    setOutlineNavigationTarget({
      position: globalOffset + searchMatches[next],
      length: searchQuery.trim().length,
      requestId: Date.now(),
    });
  };

  const replaceCurrent = () => {
    if (!searchMatches.length || disabled) return;
    const safeIndex = Math.min(searchIndex, searchMatches.length - 1);
    const position = searchMatches[safeIndex];
    const needleLength = searchQuery.trim().length;
    commitEditorValue(
      editorValue.slice(0, position) +
        replacement +
        editorValue.slice(position + needleLength),
    );
  };

  const replaceAll = () => {
    const needle = searchQuery.trim();
    if (!needle || !searchMatches.length || disabled) return;
    let cursor = 0;
    let nextValue = "";
    for (const position of searchMatches) {
      nextValue += editorValue.slice(cursor, position) + replacement;
      cursor = position + needle.length;
    }
    commitEditorValue(nextValue + editorValue.slice(cursor));
    setSearchIndex(0);
  };

  useEffect(() => {
    setOutlineOpen(focusMode);
  }, [focusMode]);

  useEffect(() => {
    if (!navigationTarget) return;
    setMode("write");
    setOutlineNavigationTarget(null);
  }, [navigationTarget]);

  const activeNavigationTarget = outlineNavigationTarget ?? navigationTarget;

  const outline = useMemo<OutlineItem[]>(() => {
    const items: OutlineItem[] = [];
    const expression = /^(#{1,3})\s+(.+)$/gmu;
    for (const match of editorValue.matchAll(expression)) {
      items.push({
        level: match[1].length,
        title: match[2].replace(/\*\*/gu, "").trim(),
        position: match.index ?? 0,
      });
    }
    return items;
  }, [editorValue]);

  const stats = useMemo(() => {
    const plainText = editorValue
      .replace(/^#{1,6}\s+/gmu, "")
      .replace(/\[MÅ FYLLES UT\]/gu, "")
      .replace(/[\x60*_>[\]()#-]/gu, " ");
    const words = plainText.trim() ? plainText.trim().split(/\s+/u).length : 0;
    return {
      words,
      characters: editorValue.length,
      readingMinutes: Math.max(1, Math.ceil(words / 220)),
      openFields: (editorValue.match(/\[MÅ FYLLES UT\]/gu) || []).length,
    };
  }, [editorValue]);

  const goToHeading = (item: OutlineItem) => {
    setMode("write");
    setOutlineNavigationTarget({
      position: globalOffset + item.position,
      requestId: Date.now(),
      heading: item.title,
    });
  };

  const showEditor = mode === "write" || mode === "split";
  const showPreview = mode === "preview" || mode === "split";

  return (
    <Box
      data-testid="document-writing-workspace"
      onKeyDownCapture={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "f"
        ) {
          event.preventDefault();
          setSearchOpen(true);
        }
      }}
      sx={{
        mt: 2,
        border: "1px solid rgba(167, 139, 250, 0.26)",
        borderRadius: 2.5,
        overflow: "clip",
        bgcolor: "rgba(9, 4, 19, 0.72)",
        boxShadow: focusMode ? "0 28px 80px rgba(0, 0, 0, 0.35)" : "none",
      }}
    >
      {sectionFocus && (
        <Stack
          data-testid="document-section-focus-banner"
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          gap={0.75}
          sx={{
            px: 1.5,
            py: 1,
            bgcolor: "rgba(249,115,22,0.12)",
            borderBottom: "1px solid rgba(249,115,22,0.24)",
          }}
        >
          <Box>
            <Typography
              sx={{
                color: "#fdba74",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              Seksjonsfokus
            </Typography>
            <Typography
              sx={{ color: "#f1f5f9", fontSize: 13, fontWeight: 750 }}
            >
              {sectionFocus.label}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={onExitSectionFocus}
            sx={{
              borderColor: "rgba(249,115,22,0.34)",
              color: "#fed7aa",
              textTransform: "none",
            }}
          >
            Vis hele dokumentet
          </Button>
        </Stack>
      )}
      <Stack
        data-testid="document-editor-toolbar"
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        gap={1}
        sx={{
          px: 1.25,
          py: 1,
          borderBottom: "1px solid rgba(167, 139, 250, 0.18)",
          position: "sticky",
          top: 0,
          zIndex: 4,
          bgcolor: "rgba(16, 7, 29, 0.98)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            label="Visuell redigering"
            sx={{
              bgcolor: "rgba(124,58,237,0.28)",
              color: "#ede9fe",
              border: "1px solid rgba(196,181,253,0.22)",
              fontWeight: 800,
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "rgba(241,245,249,0.58)" }}
          >
            Formater direkte på arket – som i et vanlig dokumentprogram
          </Typography>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          justifyContent="space-between"
        >
          <Button
            data-testid="document-search-toggle"
            size="small"
            variant={searchOpen ? "contained" : "text"}
            onClick={() => setSearchOpen((current) => !current)}
            sx={{ color: "#ddd6fe", textTransform: "none" }}
          >
            Søk
          </Button>
          <Button
            data-testid="document-outline-toggle"
            size="small"
            variant={outlineOpen ? "contained" : "text"}
            onClick={() => setOutlineOpen((current) => !current)}
            sx={{
              color: "#ddd6fe",
              textTransform: "none",
              bgcolor: outlineOpen ? "rgba(124,58,237,0.45)" : "transparent",
            }}
          >
            Struktur
          </Button>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_event, nextMode: EditorMode | null) => {
              if (nextMode) setMode(nextMode);
            }}
            sx={{
              "& .MuiToggleButton-root": {
                color: "rgba(241,245,249,0.7)",
                borderColor: "rgba(167, 139, 250, 0.22)",
                textTransform: "none",
                px: 1.1,
              },
              "& .Mui-selected": {
                color: "#fff !important",
                bgcolor: "rgba(124,58,237,0.45) !important",
              },
            }}
          >
            <ToggleButton data-testid="editor-mode-write" value="write">
              <EditOutlinedIcon sx={{ fontSize: 16, mr: 0.6 }} />
              Skriv
            </ToggleButton>
            <ToggleButton data-testid="editor-mode-split" value="split">
              <ViewColumnOutlinedIcon sx={{ fontSize: 16, mr: 0.6 }} />
              Delt
            </ToggleButton>
            <ToggleButton data-testid="editor-mode-preview" value="preview">
              <MenuBookOutlinedIcon sx={{ fontSize: 16, mr: 0.6 }} />
              Les
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={focusMode ? "Avslutt fokusmodus" : "Åpne fokusmodus"}>
            <IconButton
              data-testid="document-focus-toggle"
              size="small"
              onClick={onToggleFocus}
              sx={{ color: focusMode ? "#c4b5fd" : "rgba(241,245,249,0.72)" }}
            >
              {focusMode ? (
                <FullscreenExitOutlinedIcon />
              ) : (
                <CenterFocusStrongOutlinedIcon />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {searchOpen && (
        <Stack
          data-testid="document-search-panel"
          direction={{ xs: "column", lg: "row" }}
          gap={0.75}
          alignItems={{ lg: "center" }}
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: "1px solid rgba(167,139,250,0.18)",
            bgcolor: "rgba(25,12,42,0.98)",
          }}
        >
          <TextField
            autoFocus
            size="small"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchIndex(0);
            }}
            placeholder="Finn i dokumentet"
            inputProps={{ "aria-label": "Finn i dokumentet" }}
            sx={{ minWidth: 220, "& input": { color: "#f1f5f9" } }}
          />
          <TextField
            size="small"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            placeholder="Erstatt med"
            inputProps={{ "aria-label": "Erstatt med" }}
            sx={{ minWidth: 190, "& input": { color: "#f1f5f9" } }}
          />
          <Typography
            variant="caption"
            sx={{ color: "rgba(241,245,249,0.58)", minWidth: 72 }}
          >
            {searchMatches.length
              ? `${Math.min(searchIndex + 1, searchMatches.length)} av ${searchMatches.length}`
              : "0 treff"}
          </Typography>
          <Button
            size="small"
            disabled={!searchMatches.length}
            onClick={() => navigateSearch(-1)}
          >
            Forrige
          </Button>
          <Button
            size="small"
            disabled={!searchMatches.length}
            onClick={() => navigateSearch(1)}
          >
            Neste
          </Button>
          <Button
            size="small"
            disabled={!searchMatches.length || disabled}
            onClick={replaceCurrent}
          >
            Erstatt
          </Button>
          <Button
            size="small"
            disabled={!searchMatches.length || disabled}
            onClick={replaceAll}
          >
            Erstatt alle
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={() => setSearchOpen(false)}
          >
            Lukk
          </Button>
        </Stack>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: outlineOpen
            ? {
                xs: "1fr",
                lg: focusMode ? "210px minmax(0, 1fr)" : "185px minmax(0, 1fr)",
              }
            : "1fr",
          minWidth: 0,
        }}
      >
        <Box
          data-testid="document-outline"
          component="nav"
          aria-label="Dokumentstruktur"
          sx={{
            display: outlineOpen ? "block" : "none",
            borderRight: "1px solid rgba(167, 139, 250, 0.16)",
            p: 1.5,
            maxHeight: 820,
            overflowY: "auto",
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: "rgba(241,245,249,0.45)", letterSpacing: "0.12em" }}
          >
            Dokumentstruktur
          </Typography>
          <Stack gap={0.25} mt={0.75}>
            {outline.length ? (
              outline.map((item, index) => (
                <Button
                  key={String(item.position) + "-" + String(index)}
                  size="small"
                  onClick={() => goToHeading(item)}
                  sx={{
                    justifyContent: "flex-start",
                    color:
                      item.level === 1 ? "#f1f5f9" : "rgba(241,245,249,0.68)",
                    textTransform: "none",
                    textAlign: "left",
                    lineHeight: 1.3,
                    fontSize: item.level === 1 ? "0.78rem" : "0.73rem",
                    fontWeight: item.level === 1 ? 750 : 550,
                    pl: 0.75 + (item.level - 1) * 1.25,
                    py: 0.6,
                    minWidth: 0,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </Box>
                </Button>
              ))
            ) : (
              <Typography
                variant="caption"
                sx={{ color: "rgba(241,245,249,0.45)", lineHeight: 1.5 }}
              >
                Bruk H1–H3 for å bygge en navigerbar struktur.
              </Typography>
            )}
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            bgcolor: mode === "write" ? "#e9e3da" : "transparent",
            p: mode === "write" ? { xs: 1, sm: 2, lg: 3 } : 0,
            gridTemplateColumns:
              mode === "split" && focusMode
                ? { xs: "1fr", xl: "1fr 1fr" }
                : "1fr",
            minWidth: 0,
          }}
        >
          {showEditor && (
            <WorkspaceRichTextCanvas
              value={editorValue}
              onChange={commitEditorValue}
              disabled={disabled}
              focusMode={focusMode}
              globalOffset={globalOffset}
              navigationTarget={activeNavigationTarget}
              onCursorChange={onCursorChange}
              onTextSelection={onTextSelection}
              onCommentRequest={onCommentRequest}
              inlineAssistant={inlineAssistant}
            />
          )}
          {showPreview && (
            <Box
              sx={{
                borderLeft: mode === "split" ? "1px solid " + PAPER.border : 0,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <DocumentPreview content={editorValue} />
            </Box>
          )}
        </Box>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        gap={0.75}
        sx={{
          px: 1.75,
          py: 1,
          borderTop: "1px solid rgba(167, 139, 250, 0.16)",
        }}
      >
        <Typography variant="caption" sx={{ color: "rgba(241,245,249,0.48)" }}>
          {sectionFocus ? "Seksjonsfokus" : "Hele dokumentet"} · autosave er
          aktiv · vanlige tastatursnarveier fungerer
        </Typography>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          {stats.openFields > 0 && (
            <Chip
              size="small"
              label={String(stats.openFields) + " åpne felt"}
              sx={{ color: "#fbbf24", bgcolor: "rgba(245,158,11,0.12)" }}
            />
          )}
          <Typography
            variant="caption"
            sx={{ color: "rgba(241,245,249,0.58)" }}
          >
            {stats.words.toLocaleString("nb-NO")} ord ·{" "}
            {stats.characters.toLocaleString("nb-NO")} tegn · ca.{" "}
            {stats.readingMinutes} min lesetid
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
