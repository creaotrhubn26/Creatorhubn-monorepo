import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberListIcon,
  Title as HeadingIcon,
  HorizontalRule as DividerLineIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  FormatStrikethrough as StrikeIcon,
} from '@mui/icons-material';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number | string | Record<string, number | string>;
  accentColor?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Skriv notater her...',
  minHeight = 120,
  accentColor = '#ffc107',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  // Responsive button style with larger touch targets for tablet/desktop
  const buttonStyle = {
    color: 'rgba(255,255,255,0.87)',
    minWidth: { xs: 40, sm: 44 },
    minHeight: { xs: 40, sm: 44 },
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.15s ease',
    '&:hover': {
      color: accentColor,
      bgcolor: 'rgba(255,255,255,0.08)',
    },
    '&:active': {
      transform: 'scale(0.95)',
    },
    '&.active': {
      color: accentColor,
      bgcolor: 'rgba(255,255,255,0.12)',
    },
  };

  const iconSize = { xs: 20, sm: 22 };

  return (
    <Box
      sx={{
        border: `2px solid rgba(255,255,255,0.2)`,
        borderRadius: 2,
        overflow: 'hidden',
        '&:focus-within': {
          borderColor: accentColor,
        },
      }}
    >
      {/* Toolbar - Responsive for desktop and iPad */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: { xs: 0.5, sm: 1 },
          p: { xs: 1, sm: 1.5 },
          bgcolor: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Tooltip title="Fet (Ctrl+B)" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            sx={{ ...buttonStyle, ...(editor.isActive('bold') && buttonStyle['&.active']) }}
          >
            <BoldIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Kursiv (Ctrl+I)" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            sx={{ ...buttonStyle, ...(editor.isActive('italic') && buttonStyle['&.active']) }}
          >
            <ItalicIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Gjennomstreking" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            sx={{ ...buttonStyle, ...(editor.isActive('strike') && buttonStyle['&.active']) }}
          >
            <StrikeIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Divider
          orientation="vertical"
          flexItem
          sx={{
            mx: { xs: 0.5, sm: 1 },
            bgcolor: 'rgba(255,255,255,0.2)',
            display: { xs: 'none', sm: 'block' },
          }}
        />
        <Tooltip title="Overskrift" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            sx={{ ...buttonStyle, ...(editor.isActive('heading', { level: 2 }) && buttonStyle['&.active']) }}
          >
            <HeadingIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Punktliste" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            sx={{ ...buttonStyle, ...(editor.isActive('bulletList') && buttonStyle['&.active']) }}
          >
            <BulletListIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nummerert liste" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            sx={{ ...buttonStyle, ...(editor.isActive('orderedList') && buttonStyle['&.active']) }}
          >
            <NumberListIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Skillelinje" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            sx={buttonStyle}
          >
            <DividerLineIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Divider
          orientation="vertical"
          flexItem
          sx={{
            mx: { xs: 0.5, sm: 1 },
            bgcolor: 'rgba(255,255,255,0.2)',
            display: { xs: 'none', sm: 'block' },
          }}
        />
        <Tooltip title="Angre (Ctrl+Z)" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            sx={{ ...buttonStyle, '&.Mui-disabled': { color: 'rgba(255,255,255,0.6)' } }}
          >
            <UndoIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Gjør om (Ctrl+Y)" enterDelay={500}>
          <IconButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            sx={{ ...buttonStyle, '&.Mui-disabled': { color: 'rgba(255,255,255,0.6)' } }}
          >
            <RedoIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Editor Content - Desktop-friendly with clear, readable text */}
      <Box
        sx={{
          bgcolor: '#1a1a1a',
          '& .tiptap': {
            minHeight,
            // Generous padding for comfortable editing on desktop
            padding: { xs: 2, sm: 3, md: 4 },
            // High contrast white text for clarity
            color: '#f5f5f5',
            // Larger font sizes for desktop readability
            fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' },
            // Comfortable line height for reading/writing
            lineHeight: 1.8,
            letterSpacing: '0.01em',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            outline: 'none',
            // Smooth caret for better visibility
            caretColor: accentColor,
            // Better touch/mouse selection
            WebkitUserSelect: 'text',
            userSelect: 'text',
            WebkitTouchCallout: 'default',
            // Paragraph styling
            '& p': {
              margin: 0,
              marginBottom: '0.75em',
            },
            // Headings with accent color
            '& h2': {
              fontSize: { xs: '1.35rem', sm: '1.5rem', md: '1.65rem' },
              fontWeight: 700,
              color: accentColor,
              marginBottom: '0.6em',
              marginTop: '0.3em',
            },
            // Lists with proper spacing
            '& ul, & ol': {
              paddingLeft: '1.75em',
              marginBottom: '0.75em',
            },
            '& li': {
              marginBottom: '0.4em',
              '&::marker': {
                color: 'rgba(255,255,255,0.87)',
              },
            },
            // Bold and italic styling
            '& strong': {
              fontWeight: 700,
              color: '#fff',
            },
            '& em': {
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.95)',
            },
            // Horizontal rule
            '& hr': {
              border: 'none',
              borderTop: `2px solid ${accentColor}`,
              margin: '1.25em 0',
              opacity: 0.7,
            },
            // Placeholder styling
            '& p.is-editor-empty:first-child::before': {
              content: 'attr(data-placeholder)',
              color: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
              float: 'left',
              height: 0,
              fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}

