import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Extension, type Editor as TiptapEditor } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { BubbleMenu } from "@tiptap/react/menus";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import FormatBoldOutlinedIcon from "@mui/icons-material/FormatBoldOutlined";
import FormatItalicOutlinedIcon from "@mui/icons-material/FormatItalicOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import FormatListNumberedOutlinedIcon from "@mui/icons-material/FormatListNumberedOutlined";
import FormatQuoteOutlinedIcon from "@mui/icons-material/FormatQuoteOutlined";
import FormatStrikethroughOutlinedIcon from "@mui/icons-material/FormatStrikethroughOutlined";
import FormatUnderlinedOutlinedIcon from "@mui/icons-material/FormatUnderlinedOutlined";
import HorizontalRuleOutlinedIcon from "@mui/icons-material/HorizontalRuleOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import RedoOutlinedIcon from "@mui/icons-material/RedoOutlined";
import InsertPageBreakOutlinedIcon from "@mui/icons-material/InsertPageBreakOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";

import type {
  DocumentNavigationTarget,
  DocumentTextSelection,
} from "./WorkspaceDocumentEditor";

const PAPER = {
  background: "#fffdf8",
  backgroundMuted: "#f7f2e9",
  border: "#ddd4c7",
  text: "#241d2b",
  muted: "#746b78",
  accent: "#6d28d9",
};

const OPEN_FIELD_MARKER = "[MÅ FYLLES UT]";
const PAGE_BREAK_MARKER = "[SIDESKIFT]";
const openFieldPluginKey = new PluginKey<DecorationSet>(
  "workspace-open-field-highlights",
);

function openFieldDecorations(
  doc: TiptapEditor["state"]["doc"],
): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    let offset = node.text.indexOf(OPEN_FIELD_MARKER);
    while (offset >= 0) {
      decorations.push(
        Decoration.inline(
          position + offset,
          position + offset + OPEN_FIELD_MARKER.length,
          { class: "workspace-open-field" },
        ),
      );
      offset = node.text.indexOf(OPEN_FIELD_MARKER, offset + 1);
    }
    let pageOffset = node.text.indexOf(PAGE_BREAK_MARKER);
    while (pageOffset >= 0) {
      decorations.push(
        Decoration.inline(
          position + pageOffset,
          position + pageOffset + PAGE_BREAK_MARKER.length,
          { class: "workspace-page-break" },
        ),
      );
      pageOffset = node.text.indexOf(PAGE_BREAK_MARKER, pageOffset + 1);
    }
  });
  return DecorationSet.create(doc, decorations);
}

const OpenFieldHighlight = Extension.create({
  name: "workspaceOpenFieldHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: openFieldPluginKey,
        state: {
          init: (_config, state) => openFieldDecorations(state.doc),
          apply: (transaction, current) =>
            transaction.docChanged
              ? openFieldDecorations(transaction.doc)
              : current,
        },
        props: {
          decorations: (state) => openFieldPluginKey.getState(state),
        },
      }),
    ];
  },
});

export interface WorkspaceRichTextCanvasProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  focusMode: boolean;
  globalOffset: number;
  navigationTarget?: DocumentNavigationTarget | null;
  onCursorChange?: (position: number) => void;
  onTextSelection?: (selection: DocumentTextSelection | null) => void;
  onCommentRequest?: () => void;
  inlineAssistant?: ReactNode;
}

function cleanHeading(value: string): string {
  return value.replace(/^#{1,6}\s+/u, "").trim();
}

function findHeadingPosition(
  editor: TiptapEditor,
  heading: string,
): { from: number; to: number } | null {
  const expected = cleanHeading(heading);
  let result: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (
      !result &&
      node.type.name === "heading" &&
      node.textContent.trim() === expected
    ) {
      result = {
        from: position + 1,
        to: position + 1 + node.content.size,
      };
    }
  });
  return result;
}

function findTextOccurrence(
  editor: TiptapEditor,
  needle: string,
  occurrence: number,
): { from: number; to: number } | null {
  if (!needle) return null;
  let seen = 0;
  let result: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (result || !node.isText || !node.text) return;
    let offset = node.text.indexOf(needle);
    while (offset >= 0) {
      if (seen === occurrence) {
        result = {
          from: position + offset,
          to: position + offset + needle.length,
        };
        return;
      }
      seen += 1;
      offset = node.text.indexOf(needle, offset + needle.length);
    }
  });
  return result;
}

function markdownPositionAtSelection(
  editor: TiptapEditor,
  markdown: string,
): number {
  const { $from } = editor.state.selection;
  const blockText = $from.parent.textContent;
  const textBeforeCursor = $from.parent.textBetween(
    0,
    $from.parentOffset,
    "",
  );
  const heading = headingBeforeSelection(editor);
  const sectionStart = heading
    ? markdownHeadingPosition(markdown, heading)
    : 0;

  if (blockText) {
    const blockPosition = markdown.indexOf(blockText, sectionStart);
    if (blockPosition >= 0) {
      return blockPosition + Math.min(textBeforeCursor.length, blockText.length);
    }
  }

  const tail = textBeforeCursor.slice(-80);
  if (tail) {
    const tailPosition = markdown.indexOf(tail, sectionStart);
    if (tailPosition >= 0) return tailPosition + tail.length;
  }

  return sectionStart;
}

function markdownHeadingPosition(
  markdown: string,
  headingText: string,
): number {
  let position = 0;
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+)$/u);
    if (heading?.[1].trim() === headingText.trim()) return position;
    position += line.length + 1;
  }
  return 0;
}

function headingBeforeSelection(editor: TiptapEditor): string | null {
  const selectionPosition = editor.state.selection.from;
  let heading: string | null = null;
  editor.state.doc.descendants((node, position) => {
    if (position >= selectionPosition) return false;
    if (node.type.name === "heading") heading = node.textContent;
    return true;
  });
  return heading;
}

function normalizeLink(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//iu.test(trimmed) ? trimmed : "https://" + trimmed;
}

function normalizeWorkspaceMarkdown(value: string): string {
  return value
    .replace(/\\\[MÅ FYLLES UT\\\]/gu, OPEN_FIELD_MARKER)
    .replace(/\\\[SIDESKIFT\\\]/gu, PAGE_BREAK_MARKER)
    .replace(
      /\[([^\]\n]+@[^\]\n]+)\]\(mailto:([^)]+)\)/gu,
      (match, label: string, address: string) =>
        label === address ? label : match,
    );
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  dark?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  dark = false,
  onClick,
  children,
  testId,
}: ToolbarButtonProps) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          data-testid={testId}
          size="small"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: 34,
            height: 34,
            color: active ? "#fff" : dark ? "#f1f5f9" : "#4b4350",
            bgcolor: active ? PAPER.accent : "transparent",
            border: "1px solid",
            borderColor: active ? PAPER.accent : "transparent",
            "&:hover": {
              bgcolor: active
                ? "#5b21b6"
                : dark
                  ? "rgba(255,255,255,0.1)"
                  : "#eee8df",
              borderColor: active ? "#5b21b6" : dark ? "#62586a" : PAPER.border,
            },
            "&.Mui-disabled": { opacity: 0.35 },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function setLink(editor: TiptapEditor): void {
  const previous = String(editor.getAttributes("link").href ?? "");
  const next = window.prompt("Lim inn lenke", previous || "https://");
  if (next === null) return;
  const href = normalizeLink(next);
  if (!href) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

function FormatToolbar({ editor }: { editor: TiptapEditor }) {
  const inTable = editor.isActive("table");
  return (
    <Box
      data-testid="rich-text-format-toolbar"
      sx={{
        position: "sticky",
        top: 54,
        zIndex: 3,
        borderBottom: "1px solid " + PAPER.border,
        bgcolor: "rgba(255,253,248,0.97)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Stack
        direction="row"
        gap={0.35}
        alignItems="center"
        flexWrap="wrap"
        sx={{ px: 1.25, py: 0.8 }}
      >
        <ToolbarButton
          label="Angre"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          testId="rich-text-undo"
        >
          <UndoOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Gjør om"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          testId="rich-text-redo"
        >
          <RedoOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.4 }} />
        {[1, 2, 3].map((level) => (
          <Button
            key={level}
            size="small"
            aria-label={"Overskrift " + String(level)}
            aria-pressed={editor.isActive("heading", { level })}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHeading({ level: level as 1 | 2 | 3 })
                .run()
            }
            sx={{
              minWidth: 34,
              height: 34,
              px: 0.7,
              color: editor.isActive("heading", { level })
                ? "#fff"
                : PAPER.text,
              bgcolor: editor.isActive("heading", { level })
                ? PAPER.accent
                : "transparent",
              border: "1px solid transparent",
              textTransform: "none",
              fontWeight: 850,
              "&:hover": { bgcolor: "#eee8df", borderColor: PAPER.border },
            }}
          >
            H{level}
          </Button>
        ))}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.4 }} />
        <ToolbarButton
          label="Fet"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Kursiv"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Understreking"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <FormatUnderlinedOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Gjennomstreking"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <FormatStrikethroughOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Lenke"
          active={editor.isActive("link")}
          onClick={() => setLink(editor)}
        >
          <LinkOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.4 }} />
        <ToolbarButton
          label="Punktliste"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FormatListBulletedOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Nummerert liste"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <FormatListNumberedOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Sjekkliste"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckBoxOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Sitat"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <FormatQuoteOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Skillelinje"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <HorizontalRuleOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Sideskift"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent([
                {
                  type: "paragraph",
                  content: [{ type: "text", text: PAGE_BREAK_MARKER }],
                },
                { type: "paragraph" },
              ])
              .run()
          }
          testId="rich-text-insert-page-break"
        >
          <InsertPageBreakOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Sett inn tabell"
          active={inTable}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          testId="rich-text-insert-table"
        >
          <TableChartOutlinedIcon fontSize="small" />
        </ToolbarButton>
      </Stack>
      {inTable && (
        <Stack
          data-testid="rich-text-table-toolbar"
          direction="row"
          gap={0.6}
          alignItems="center"
          flexWrap="wrap"
          sx={{
            px: 1.5,
            py: 0.7,
            borderTop: "1px solid #eee7dc",
            bgcolor: "#f7f2e9",
          }}
        >
          <Chip size="small" label="Tabell" sx={{ fontWeight: 750 }} />
          <Button
            size="small"
            startIcon={<AddOutlinedIcon />}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            Rad
          </Button>
          <Button
            size="small"
            startIcon={<AddOutlinedIcon />}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            Kolonne
          </Button>
          <Button
            size="small"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            Fjern rad
          </Button>
          <Button
            size="small"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            Fjern kolonne
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            Slett tabell
          </Button>
        </Stack>
      )}
    </Box>
  );
}

function SelectionBubble({
  editor,
  onCommentRequest,
}: {
  editor: TiptapEditor;
  onCommentRequest?: () => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ state }) => !state.selection.empty}
    >
      <Stack
        data-testid="rich-text-selection-menu"
        direction="row"
        gap={0.3}
        sx={{
          p: 0.5,
          borderRadius: 1.5,
          bgcolor: "#241d2b",
          boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
        }}
      >
        <ToolbarButton
          label="Fet"
          dark
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Kursiv"
          dark
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Understreking"
          dark
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <FormatUnderlinedOutlinedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          label="Lenke"
          dark
          active={editor.isActive("link")}
          onClick={() => setLink(editor)}
        >
          <LinkOutlinedIcon fontSize="small" />
        </ToolbarButton>
        {onCommentRequest && (
          <ToolbarButton
            label="Kommenter"
            dark
            onClick={onCommentRequest}
            testId="rich-text-add-comment"
          >
            <AddCommentOutlinedIcon fontSize="small" />
          </ToolbarButton>
        )}
      </Stack>
    </BubbleMenu>
  );
}

export function WorkspaceRichTextCanvas({
  value,
  onChange,
  disabled = false,
  focusMode,
  globalOffset,
  navigationTarget = null,
  onCursorChange,
  onTextSelection,
  onCommentRequest,
  inlineAssistant,
}: WorkspaceRichTextCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const assistantRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedMarkdownRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const updatesEnabledRef = useRef(false);
  const hasInlineAssistant = Boolean(inlineAssistant);
  const [slashOpen, setSlashOpen] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState({
    left: 48,
    top: 150,
    placement: "below" as "above" | "below",
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          enableClickSelection: true,
          defaultProtocol: "https",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({
        table: {
          resizable: true,
          lastColumnResizable: true,
        },
      }),
      Placeholder.configure({
        placeholder: "Begynn å skrive, eller bruk verktøylinjen …",
      }),
      OpenFieldHighlight,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: false },
      }),
    ],
    content: value,
    contentType: "markdown",
    editable: !disabled,
    onUpdate: ({ editor: updatedEditor }) => {
      const { $from } = updatedEditor.state.selection;
      const beforeCursor = $from.parent.textBetween(0, $from.parentOffset, " ");
      setSlashOpen(beforeCursor.trim() === "/");
      if (!updatesEnabledRef.current) return;
      const markdown = normalizeWorkspaceMarkdown(updatedEditor.getMarkdown());
      lastEmittedMarkdownRef.current = markdown;
      onChange(markdown);
    },
    onSelectionUpdate: ({ editor: updatedEditor }) => {
      onCursorChange?.(
        globalOffset +
          markdownPositionAtSelection(updatedEditor, valueRef.current),
      );
      const { from, to, empty } = updatedEditor.state.selection;
      if (empty) {
        onTextSelection?.(null);
        return;
      }
      const text = updatedEditor.state.doc.textBetween(from, to, " ").trim();
      const markdownPosition = text ? valueRef.current.indexOf(text) : -1;
      onTextSelection?.(
        text && markdownPosition >= 0
          ? {
              text,
              from: globalOffset + markdownPosition,
              to: globalOffset + markdownPosition + text.length,
            }
          : null,
      );
    },
  });

  const updateAssistantPosition = useCallback(() => {
    if (!editor || !canvasRef.current || !hasInlineAssistant) return;
    const frame = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas || editor.isDestroyed) return;
      try {
        const caret = editor.view.coordsAtPos(editor.state.selection.to);
        const bounds = canvas.getBoundingClientRect();
        const availableWidth = Math.max(0, bounds.width - 32);
        const assistantWidth = Math.min(448, availableWidth);
        const desiredLeft = caret.left - bounds.left;
        const left = Math.max(
          16,
          Math.min(desiredLeft, Math.max(16, bounds.width - assistantWidth - 16)),
        );
        const assistantHeight = assistantRef.current?.getBoundingClientRect().height ?? 0;
        const below = caret.bottom - bounds.top + 10;
        const hasRoomBelow = below + assistantHeight <= bounds.height - 42;
        const nextPosition = {
          left: Math.round(left),
          top: Math.round(Math.max(
            92,
            hasRoomBelow
              ? below
              : caret.top - bounds.top - assistantHeight - 10,
          )),
          placement: hasRoomBelow ? "below" : "above",
        } as const;
        setAssistantPosition((current) =>
          current.left === nextPosition.left &&
          current.top === nextPosition.top &&
          current.placement === nextPosition.placement
            ? current
            : nextPosition,
        );
      } catch {
        // The selection can briefly point to a replaced node while content reloads.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editor, hasInlineAssistant]);

  useEffect(() => {
    if (!editor || !hasInlineAssistant) return;
    const update = () => updateAssistantPosition();
    update();
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [editor, hasInlineAssistant, updateAssistantPosition]);

  useEffect(() => {
    if (!editor) return;
    lastEmittedMarkdownRef.current = valueRef.current;
    const enableUpdates = window.requestAnimationFrame(() => {
      updatesEnabledRef.current = true;
    });
    return () => {
      window.cancelAnimationFrame(enableUpdates);
      updatesEnabledRef.current = false;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value === lastEmittedMarkdownRef.current) return;
    if (normalizeWorkspaceMarkdown(editor.getMarkdown()) === value) {
      lastEmittedMarkdownRef.current = value;
      return;
    }
    editor.commands.setContent(value, {
      contentType: "markdown",
      emitUpdate: false,
    });
    lastEmittedMarkdownRef.current = value;
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !navigationTarget) return;
    const localPosition = Math.max(0, navigationTarget.position - globalOffset);
    let range: { from: number; to: number } | null = null;

    if (navigationTarget.length) {
      const needle = value.slice(
        localPosition,
        localPosition + navigationTarget.length,
      );
      const prefix = value.slice(0, localPosition);
      const occurrence = needle ? prefix.split(needle).length - 1 : 0;
      range = findTextOccurrence(editor, needle, occurrence);
    }
    if (!range) {
      const heading =
        navigationTarget.heading ?? navigationTarget.sectionHeading;
      range = heading ? findHeadingPosition(editor, heading) : null;
    }
    if (!range) return;
    editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    onCursorChange?.(navigationTarget.position);
  }, [editor, globalOffset, navigationTarget, onCursorChange, value]);

  const runSlashCommand = (
    command: "h1" | "h2" | "bullet" | "task" | "quote" | "table" | "page",
  ) => {
    if (!editor) return;
    const cursor = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: Math.max(1, cursor - 1), to: cursor })
      .run();
    if (command === "h1")
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    if (command === "h2")
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    if (command === "bullet") editor.chain().focus().toggleBulletList().run();
    if (command === "task") editor.chain().focus().toggleTaskList().run();
    if (command === "quote") editor.chain().focus().toggleBlockquote().run();
    if (command === "table") {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    }
    if (command === "page") {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: "paragraph",
            content: [{ type: "text", text: PAGE_BREAK_MARKER }],
          },
          { type: "paragraph" },
        ])
        .run();
    }
    setSlashOpen(false);
  };
  if (!editor) {
    return (
      <Box
        data-testid="document-content-editor"
        sx={{ minHeight: 1123, bgcolor: PAPER.background }}
      />
    );
  }

  return (
    <Box
      ref={canvasRef}
      data-testid="document-content-editor"
      sx={{
        width: "100%",
        maxWidth: 794,
        mx: "auto",
        position: "relative",
        border: "1px solid " + PAPER.border,
        borderTop: "4px solid " + PAPER.accent,
        borderRadius: 0.75,
        overflow: "clip",
        bgcolor: PAPER.background,
        boxShadow: "0 18px 48px rgba(36,29,43,0.13)",
      }}
    >
      <FormatToolbar editor={editor} />
      <SelectionBubble editor={editor} onCommentRequest={onCommentRequest} />
      {inlineAssistant && !disabled && (
        <Box
          ref={assistantRef}
          data-testid="document-inline-assistant-anchor"
          data-caret-position={editor.state.selection.to}
          data-placement={assistantPosition.placement}
          onMouseDown={(event) => event.stopPropagation()}
          sx={{
            position: "absolute",
            left: assistantPosition.left,
            top: assistantPosition.top,
            zIndex: 12,
            width: "min(448px, calc(100% - 32px))",
            pointerEvents: "none",
            transition: "left 120ms ease, top 120ms ease",
            '&[data-placement="above"] [data-testid="smart-context-inline"]::before': {
              top: "auto",
              bottom: -5,
              transform: "rotate(225deg)",
            },
          }}
        >
          {inlineAssistant}
        </Box>
      )}
      {slashOpen && !disabled && (
        <Box
          data-testid="rich-text-slash-menu"
          sx={{
            position: "absolute",
            top: 104,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 8,
            width: "min(560px, calc(100% - 32px))",
            p: 1,
            border: "1px solid " + PAPER.border,
            borderRadius: 2,
            bgcolor: PAPER.background,
            boxShadow: "0 18px 45px rgba(36,29,43,0.22)",
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: PAPER.muted, fontWeight: 800 }}
          >
            Sett inn med /
          </Typography>
          <Stack direction="row" gap={0.5} flexWrap="wrap" mt={0.75}>
            {(
              [
                ["h1", "Tittel"],
                ["h2", "Overskrift"],
                ["bullet", "Punktliste"],
                ["task", "Sjekkliste"],
                ["quote", "Sitat"],
                ["table", "Tabell"],
                ["page", "Sideskift"],
              ] as const
            ).map(([command, label]) => (
              <Button
                key={command}
                size="small"
                variant="outlined"
                onClick={() => runSlashCommand(command)}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Box>
      )}
      <Box
        data-testid="document-rich-text-surface"
        sx={{
          "& .tiptap": {
            boxSizing: "border-box",
            minHeight: 1123,
            height: "auto",
            overflowY: "visible",
            outline: "none",
            px: {
              xs: "24px",
              sm: "48px",
              xl: focusMode ? "64px" : "48px",
            },
            py: { xs: "32px", sm: "48px" },
            color: PAPER.text,
            caretColor: PAPER.accent,
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: "1rem",
            lineHeight: 1.8,
            "& > *:first-of-type": { mt: 0 },
            "& p": { my: 0.75 },
            "& h1": {
              mt: 0,
              mb: 2,
              fontSize: { xs: "1.75rem", sm: "2.15rem" },
              lineHeight: 1.18,
              letterSpacing: "-0.04em",
              fontWeight: 850,
            },
            "& h2": {
              mt: 4,
              mb: 1.25,
              pb: 0.75,
              borderBottom: "1px solid " + PAPER.border,
              fontSize: { xs: "1.3rem", sm: "1.5rem" },
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              fontWeight: 820,
            },
            "& h3": {
              mt: 2.5,
              mb: 0.75,
              color: "#4c1d95",
              fontSize: "1.08rem",
              lineHeight: 1.35,
              fontWeight: 780,
            },
            "& strong": { fontWeight: 800 },
            "& a": {
              color: PAPER.accent,
              textDecorationColor: "#c4b5fd",
              textUnderlineOffset: "3px",
            },
            "& blockquote": {
              my: 1.5,
              mx: 0,
              pl: 2,
              py: 0.4,
              borderLeft: "3px solid #c4b5fd",
              color: PAPER.muted,
              fontStyle: "italic",
            },
            "& ul, & ol": { pl: 3.2, my: 1.1 },
            "& li": { mb: 0.45 },
            '& ul[data-type="taskList"]': {
              pl: 0,
              listStyle: "none",
            },
            '& ul[data-type="taskList"] li': {
              display: "flex",
              gap: 1,
              alignItems: "flex-start",
            },
            '& ul[data-type="taskList"] li > label': {
              mt: "4px",
              userSelect: "none",
            },
            '& ul[data-type="taskList"] li > div': { flex: 1 },
            "& hr": {
              my: 3,
              border: 0,
              borderTop: "1px solid " + PAPER.border,
            },
            "& code": {
              px: 0.55,
              py: 0.15,
              borderRadius: 0.5,
              bgcolor: PAPER.backgroundMuted,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.9em",
            },
            "& .tableWrapper": { my: 2.25, overflowX: "auto" },
            "& table": {
              width: "100%",
              minWidth: 560,
              borderCollapse: "collapse",
              tableLayout: "fixed",
            },
            "& th, & td": {
              position: "relative",
              minWidth: 100,
              border: "1px solid " + PAPER.border,
              px: 1.25,
              py: 1,
              verticalAlign: "top",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.55,
            },
            "& th": {
              bgcolor: PAPER.backgroundMuted,
              fontWeight: 800,
            },
            "& tr:nth-of-type(even) td": { bgcolor: "#fbf8f2" },
            "& .selectedCell::after": {
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              content: '""',
              bgcolor: "rgba(109,40,217,0.12)",
            },
            "& .column-resize-handle": {
              position: "absolute",
              top: 0,
              right: "-2px",
              bottom: "-2px",
              width: "4px",
              bgcolor: PAPER.accent,
              pointerEvents: "none",
            },
            "&.resize-cursor": { cursor: "col-resize" },
            "& .workspace-open-field": {
              px: 0.45,
              py: 0.1,
              borderRadius: 0.6,
              bgcolor: "#fef3c7",
              color: "#92400e",
              fontWeight: 800,
              boxDecorationBreak: "clone",
            },
            "& .workspace-page-break": {
              display: "block",
              my: 6,
              mx: { xs: "-24px", sm: "-48px" },
              height: 34,
              borderTop: "10px solid #e9e3da",
              borderBottom: "1px dashed #b8adbf",
              color: PAPER.muted,
              fontSize: 11,
              lineHeight: "22px",
              textAlign: "center",
              letterSpacing: "0.08em",
              breakAfter: "page",
              pageBreakAfter: "always",
            },
            "& p.is-editor-empty:first-of-type::before": {
              content: "attr(data-placeholder)",
              float: "left",
              height: 0,
              color: "#a8a0aa",
              pointerEvents: "none",
            },
            "& ::selection": {
              bgcolor: "rgba(109,40,217,0.2)",
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{
          px: 1.5,
          py: 0.8,
          borderTop: "1px solid " + PAPER.border,
          bgcolor: PAPER.backgroundMuted,
        }}
      >
        <Typography variant="caption" sx={{ color: PAPER.muted }}>
          Visuell redigering · Markdown lagres automatisk i bakgrunnen
        </Typography>
        <Chip
          size="small"
          label={disabled ? "Kun lesing" : "WYSIWYG"}
          color={disabled ? "default" : "secondary"}
          variant="outlined"
        />
      </Stack>
    </Box>
  );
}
