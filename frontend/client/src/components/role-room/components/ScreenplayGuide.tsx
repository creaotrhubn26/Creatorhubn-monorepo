/**
 * ScreenplayGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Screenplay Editor + Navigator.
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot placeholders
 *
 * Screenshot placeholders are <ScreenshotPlaceholder label="…" /> boxes.
 * Replace each one with a real <img> or <video> when assets are ready.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Paper,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  CheckCircleOutline as DoneIcon,
  Description as DescriptionIcon,
  Movie as SceneIcon,
  Person as CharacterIcon,
  FormatQuote as DialogueIcon,
  AccountTree as NavigatorIcon,
  ViewModule as BeatBoardIcon,
  RecordVoiceOver as TableReadIcon,
  Analytics as AnalysisIcon,
  Lock as LockIcon,
  Download as ExportIcon,
  Spellcheck as SpellcheckIcon,
  Keyboard as KeyboardIcon,
  AutoStories as StoryboardNavIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { useVisualEditor } from './admin/visual-editor/VisualEditorContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  sections: StepSection[];
}

interface StepSection {
  heading: string;
  body: React.ReactNode;
  screenshot?: string;
  screenshotLabel: string;
}

// ─── Screenshot Placeholder ───────────────────────────────────────────────────

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 200,
        border: '2px dashed rgba(255,255,255,0.12)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.02)',
        my: 2,
        py: 3,
        cursor: 'default',
      }}
    >
      <ImageIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.15)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        📸 Screenshot placeholder — {label}
      </Typography>
    </Box>
  );
}
// ─── Video Placeholder ───────────────────────────────────────────────────────

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 130,
        border: '2px dashed rgba(255,255,255,0.09)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.01)',
        my: 1,
        py: 2.5,
        cursor: 'default',
      }}
    >
      <VideoIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.12)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        🎬 Video placeholder — {label}
      </Typography>
    </Box>
  );
}

// ─── Callout Box ─────────────────────────────────────────────────────────────

function Callout({
  color = '#3b82f6',
  children,
}: {
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderLeft: `3px solid ${color}`,
        bgcolor: `${color}12`,
        borderRadius: '0 8px 8px 0',
        px: 2,
        py: 1.25,
        my: 1.5,
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ─── Keyboard Key ─────────────────────────────────────────────────────────────

function Key({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.2)',
        bgcolor: 'rgba(255,255,255,0.07)',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'text.primary',
        lineHeight: 1.4,
        mx: 0.25,
      }}
    >
      {children}
    </Box>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <DescriptionIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Screenplay Editor?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Screenplay Editor</strong> is a professional script-writing
              environment built on the <strong>Fountain</strong> plain-text format — the
              open standard used by Final Draft, Highland, and most screenwriting apps.
              Write in plain text and the editor automatically styles every line as a scene
              heading, action, character, dialogue, parenthetical, or transition.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              The <strong>Navigator</strong> sidebar lists every scene in your script with an
              instant-jump link. The right-side panel area gives you access to Beat Board,
              Table Read, Script Analysis, Story Structure, Grammar Check, and Storyboard
              integration — all without leaving the editor.
            </Typography>
            <Callout color="#6366f1">
              💡 Your script is auto-saved continuously. A status badge in the top-right
              of the editor shows <em>Saved</em>, <em>Saving…</em>, or <em>Unsaved</em>
              so you always know the sync state.
            </Callout>
          </>
        ),
        screenshotLabel: 'Screenplay editor – full layout overview',
      },
      {
        heading: 'Layout at a glance',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The editor window has three zones:
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Scene Navigator (left)', 'Collapsible sidebar listing every scene. Click a scene to jump to it in the editor.'],
                ['Editor (centre)', 'The main writing area with Fountain syntax highlighting, line numbers, and a formatting toolbar.'],
                ['Right panel (right)', 'Swappable panel: Analysis, Beat Board, Table Read, Story Structure, Grammar, or Storyboard.'],
              ].map(([zone, desc]) => (
                <Box key={zone} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{zone}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Three-zone layout diagram',
      },
    ],
  },
  {
    id: 'fountain-elements',
    label: 'Fountain Elements',
    icon: <SceneIcon fontSize="small" />,
    sections: [
      {
        heading: 'How Fountain auto-detection works',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The editor parses your script in real time. It looks at the content of each
              line — and the lines before and after — to decide what type it is. No
              explicit markup is required in most cases.
            </Typography>
            <Callout color="#fbbf24">
              The parser runs on every keystroke. Syntax is applied immediately, so you
              always see a formatted screenplay as you write.
            </Callout>
          </>
        ),
        screenshotLabel: 'Live Fountain parsing with colour-coded elements',
      },
      {
        heading: 'Element types & colours',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Each element has its own colour in the editor:
            </Typography>

            {/* Character + Dialogue visual snippet */}
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#0d0d1a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 1.5,
                px: 2,
                py: 1.5,
                mb: 1.5,
                fontFamily: 'monospace',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <CharacterIcon sx={{ fontSize: 15, color: '#60a5fa', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#60a5fa', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>
                  JOHN
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 3 }}>
                <DialogueIcon sx={{ fontSize: 15, color: 'rgba(245,245,245,0.65)', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: 'rgba(245,245,245,0.65)', fontFamily: 'monospace' }}>
                  I never expected to see you here.
                </Typography>
              </Box>
            </Paper>

            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                ['Scene Heading', '#fbbf24 (amber)', 'Starts with INT., EXT., or forced with a leading dot .'],
                ['Action', 'Light grey #e5e5e5', 'Any prose description line (default)'],
                ['Character', '#60a5fa (blue)', 'All-caps name on its own line followed by dialogue'],
                ['Dialogue', 'Off-white #f5f5f5', 'Lines following a character line'],
                ['Parenthetical', '#a78bfa (lavender)', 'Lines wrapped in (parentheses) inside a dialogue block'],
                ['Transition', '#f472b6 (pink)', 'All-caps lines ending with a colon e.g. CUT TO:'],
                ['Centered', '#34d399 (green)', 'Lines wrapped in >angle brackets<'],
                ['Section', '#f97316 (orange)', 'Lines starting with # or ## for acts'],
                ['Synopsis', 'Muted grey', 'Lines starting with = (a single equals sign)'],
                ['Page Break', 'Dashed divider', 'Three or more === on one line'],
              ].map(([type, color, rule]) => (
                <Box key={type} component="li" sx={{ mb: 0.6 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{type}</strong>{' '}
                    <Box component="span" sx={{ opacity: 0.6, fontSize: '0.78rem' }}>
                      ({color})
                    </Box>{' '}
                    — {rule}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Each element type highlighted in the editor',
      },
    ],
  },
  {
    id: 'keyboard',
    label: 'Keyboard Shortcuts',
    icon: <KeyboardIcon fontSize="small" />,
    sections: [
      {
        heading: 'Tab cycling (Final Draft style)',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Press <Key>Tab</Key> to advance the current line forward through the element
              cycle. Press <Key>Shift</Key>+<Key>Tab</Key> to go backward.
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                'Action → Character',
                'Character → Parenthetical',
                'Parenthetical → Dialogue',
                'Dialogue → Action',
                'Scene Heading → Action',
                'Transition → Action',
              ].map((cycle) => (
                <Box key={cycle} component="li" sx={{ mb: 0.3 }}>
                  <Typography variant="body2">{cycle}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#6366f1">
              The Tab cycle mirrors Final Draft's behaviour so muscle memory from
              professional industry tools transfers directly.
            </Callout>
          </>
        ),
        screenshotLabel: 'Tab cycle diagram Action → Character → Parenthetical → Dialogue',
      },
      {
        heading: 'Undo / Redo & other shortcuts',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Standard editing shortcuts:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                [['Ctrl', 'Z'], 'Undo last change'],
                [['Ctrl', 'Shift', 'Z'], 'Redo'],
                [['Ctrl', 'B'], 'Bold the selected text'],
                [['Ctrl', 'I'], 'Italicise the selected text'],
                [['Escape'], 'Exit fullscreen mode'],
              ].map(([keys, desc]) => (
                <Box key={(keys as string[]).join('+')} component="li" sx={{ mb: 0.6 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap' }}>
                    {(keys as string[]).map((k: string, i: number) => (
                      <React.Fragment key={i}>
                        <Key>{k}</Key>
                        {i < (keys as string[]).length - 1 && (
                          <Box component="span" sx={{ mx: 0.25, opacity: 0.5 }}>+</Box>
                        )}
                      </React.Fragment>
                    ))}
                    <Box component="span" sx={{ ml: 0.5 }}>— {desc}</Box>
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Toolbar buttons matching keyboard shortcuts',
      },
      {
        heading: 'Autocomplete',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The editor shows context-sensitive autocomplete suggestions:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                ['Character names', 'After a blank line + all-caps input, existing character names appear'],
                ['Scene prefixes', 'INT., EXT., INT./EXT., I/E. shown when starting a new scene heading'],
                ['Locations', 'After a scene prefix, previously used locations are suggested'],
                ['Transitions', 'Common transitions (CUT TO:, DISSOLVE TO:, …) shown in all-caps context'],
              ].map(([type, desc]) => (
                <Box key={type} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{type}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
              Navigate suggestions with <Key>↑</Key> <Key>↓</Key> and confirm with{' '}
              <Key>Enter</Key> or <Key>Tab</Key>. Press <Key>Escape</Key> to dismiss.
            </Typography>
          </>
        ),
        screenshotLabel: 'Autocomplete dropdown for character names',
      },
    ],
  },
  {
    id: 'navigator',
    label: 'Scene Navigator',
    icon: <NavigatorIcon fontSize="small" />,
    sections: [
      {
        heading: 'Using the Scene Navigator sidebar',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The left sidebar lists all scene headings parsed from your script. Each entry
              shows the scene number, heading text (INT./EXT. + location + time of day),
              and a colour-coded INT/EXT badge.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Click any scene to jump the editor cursor directly to that line. The
              corresponding line in the editor is briefly highlighted in amber so you can
              see where you landed.
            </Typography>
            <Callout color="#6366f1">
              On mobile the sidebar is hidden by default and accessible via the
              <strong> ☰ hamburger</strong> icon in the toolbar, which opens it as a
              slide-in drawer without losing your place in the script.
            </Callout>
          </>
        ),
        screenshotLabel: 'Scene Navigator sidebar with scene list and jump highlight',
      },
      {
        heading: 'Database scenes vs. parsed scenes',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            The navigator works in two modes. When <code>scenes</code> props are provided
            (from the database — e.g., the Troll project), they display alongside parsed
            scenes. When no database scenes exist, the navigator parses the script text
            directly. Both modes update in real time as you type.
          </Typography>
        ),
        screenshotLabel: 'Navigator showing both database and parsed scenes',
      },
    ],
  },
  {
    id: 'beat-board',
    label: 'Beat Board',
    icon: <BeatBoardIcon fontSize="small" />,
    sections: [
      // ── 1 ── Overview ──────────────────────────────────────────────────
      {
        heading: 'What is the Beat Board?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>Beat Board</strong> icon in the right-panel toggle group to
              open the story-card view. Each scene in your script becomes a card on the
              board, grouped into Act I, Act II, and Act III columns.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Clicking a beat card jumps the editor cursor to the corresponding line in
              the script. Cards can be colour-tagged, annotated with notes, reordered by
              drag-and-drop, duplicated, locked, or deleted.
            </Typography>
            <Callout color="#8b5cf6">
              The Beat Board is ideal during outlining — use it to visualise story
              structure before filling in all the dialogue.
            </Callout>
          </>
        ),
        screenshotLabel: 'Beat Board with story cards arranged in Act I / II / III columns',
      },
      // ── 2 ── Beat-type hierarchy ────────────────────────────────────────
      {
        heading: 'Beat types & visual hierarchy',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Every card has a <strong>beat type</strong>. Click the type chip on a card
              to choose from 17 structural types:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, columns: 2 }}>
              {[
                'Scene', 'Sequence', 'Act Break', 'Inciting Incident',
                'Catalyst', 'Midpoint', 'Turning Point', 'Dark Night',
                'Reversal', 'Climax', 'Resolution', 'Subplot',
                'Character Moment', 'Transition', 'Montage', 'Open', 'Other',
              ].map(t => (
                <Box key={t} component="li" sx={{ mb: 0.25 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.8rem' }}>{t}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              High-weight types (Climax, Midpoint, Reversal) render with a coloured
              glow and bolder typography so they stand out at a glance.
            </Typography>
            <Callout color="#8b5cf6">
              💡 Assign beat types consistently — the Dramaturgical Analysis panel reads
              them to flag structural issues.
            </Callout>
          </>
        ),
        screenshotLabel: 'Beat type chip menu open on a Climax card with glow effect',
      },
      // ── 3 ── Compact vs Expanded ────────────────────────────────────────
      {
        heading: 'Compact and expanded views',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The toolbar toggle switches between two density modes:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Compact (default)', 'Shows beat text in 2 lines max — ideal for an overview of a long script. Characters, tension bar, and linked scene chip are hidden.'],
                ['Expanded', 'Full beat text, character chips, tension indicator, and linked scene number all visible on each card.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Side-by-side compact vs expanded card density',
      },
      // ── 4 ── Act Balance indicator ──────────────────────────────────────
      {
        heading: 'Act Balance bar',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The bar directly below the toolbar shows what percentage of beats fall in
              each act as a colour-coded progress bar (blue = Act I, purple = Act II,
              green = Act III).
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              An amber warning icon appears when:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0.5 }}>
              {[
                'Act II exceeds 55 % of total beats (bloated middle)',
                'Act III is below 10 % of total beats (rushed ending)',
              ].map(t => (
                <Box key={t} component="li" sx={{ mb: 0.25 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{t}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#8b5cf6">
              A balanced three-act script typically aims for roughly 25 % / 50 % / 25 %.
            </Callout>
          </>
        ),
        screenshotLabel: 'Act Balance bar showing Act I / II / III percentages',
      },
      // ── 5 ── Story Threads ──────────────────────────────────────────────
      {
        heading: 'Story Threads sidebar',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>Threads</strong> button in the toolbar to open the Story
              Threads sidebar. You can assign each beat to an A, B, or C story thread.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              While a thread filter is active, all cards not belonging to that thread are
              dimmed, making it easy to read the A-story or subplot in isolation. Each
              thread also shows a density heatmap bar so you can see where it is most
              active in the script.
            </Typography>
          </>
        ),
        screenshotLabel: 'Story Threads sidebar with A-thread isolated and B/C dimmed',
      },
      // ── 6 ── Character Arc filter ───────────────────────────────────────
      {
        heading: 'Character Arc filter',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The character icon in the toolbar opens a menu listing every character
              extracted from the script. Select a character to filter the board — cards
              not featuring that character are dimmed.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              This is useful for tracing a single character's journey across all three
              acts without reading every scene description.
            </Typography>
            <Callout color="#8b5cf6">
              Characters are pulled automatically from the Fountain parser. If a
              character name is missing, check that the scene uses proper Fountain
              CHARACTER formatting.
            </Callout>
          </>
        ),
        screenshotLabel: 'Character filter menu open with one character selected and others dimmed',
      },
      // ── 7 ── Dramaturgical Analysis + Room Mode + Shortcuts ─────────────
      {
        heading: 'Dramaturgical analysis, Room Mode & shortcuts',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 0.5 }}>
              <strong>Dramaturgical analysis</strong> (toolbar checklist icon) runs
              seven structural rules against your beat types and tension values, and
              highlights issues in a collapsible panel:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Flat Act II — more than 55 % of beats in Act II',
                'Compressed Act III — less than 10 % of beats in Act III',
                'Missing midpoint (no midpoint beat in a 8+ beat story)',
                'Missing catalyst (no catalyst beat in a 5+ beat story)',
                'Abrupt tension jump (consecutive cards differ by > 4 points)',
                'Too few reversals (< 2 turning points in a 10+ beat story)',
                "Character disappears (gap of 5+ consecutive beats without a character)",
              ].map(t => (
                <Box key={t} component="li" sx={{ mb: 0.25 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.8rem' }}>{t}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              <strong>Room Mode</strong> (fullscreen icon) enters a projector-friendly
              full-screen view showing one beat at a time in large type — ideal for
              script meetings. Use <Key>←</Key> <Key>→</Key> or <Key>Space</Key> to
              navigate, <Key>Esc</Key> to exit.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 0.5 }}>
              <strong>Keyboard shortcuts</strong> (when the Beat Board is focused):
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Enter', 'Add a new beat'],
                ['⌘ D', 'Duplicate selected beat(s)'],
                ['⌘ A', 'Select all beats'],
                ['⌘ → / ↓', 'Move selected beat to the next act'],
                ['⌘ ↑', 'Move selected beat to the previous act'],
                ['Esc', 'Deselect all'],
              ].map(([key, desc]) => (
                <Box key={key as string} component="li" sx={{ mb: 0.25, display: 'flex', gap: 1 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.8rem' }}>
                    <strong>{key}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Dramaturgical analysis panel open with warning cards + Room Mode full-screen view',
      },
    ],
  },
  {
    id: 'table-read',
    label: 'Table Read',
    icon: <TableReadIcon fontSize="small" />,
    sections: [
      {
        heading: 'Table Read (text-to-speech)',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Table Read</strong> panel uses text-to-speech to read your script
              aloud, assigning different voices to different characters. It follows the parsed
              character names automatically — no manual voice assignment needed.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Controls include play/pause, speed adjustment, and line-by-line stepping. The
              current line being read is highlighted in the editor so you can follow along.
            </Typography>
            <Callout color="#10b981">
              💡 Table Read requires the <code>canTableRead</code> permission. Roles with
              restricted access will see a "permission required" message instead of the
              controls.
            </Callout>
          </>
        ),
        screenshotLabel: 'Table Read panel playing with current line highlighted',
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Script Analysis',
    icon: <AnalysisIcon fontSize="small" />,
    sections: [
      {
        heading: 'Character conflict & consistency checks',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Analysis</strong> panel runs a suite of automated checks on your
              script as you write:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                ['Character conflicts', 'Same character appearing in two overlapping scenes'],
                ['Consistency issues', 'Location references that change unexpectedly across scenes'],
                ['Scene count', 'Total parsed scenes and page estimate'],
                ['Character list', 'All speaking characters extracted from the script'],
              ].map(([check, desc]) => (
                <Box key={check} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{check}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
              The issue count is shown as a red badge on the Analysis button so you can
              spot problems at a glance.
            </Typography>
          </>
        ),
        screenshotLabel: 'Analysis panel with issue list and character extract',
      },
      {
        heading: 'Grammar Check',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            The <strong>Grammar</strong> panel checks action lines and dialogue for common
            writing issues: passive voice, repeated words, missing punctuation, and overlong
            sentences. Results link back to the line in the editor. Toggle it from the
            right-panel button group (<SpellcheckIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />{' '}
            spellcheck icon).
          </Typography>
        ),
        screenshotLabel: 'Grammar Check panel with flagged issues',
      },
    ],
  },
  {
    id: 'lock-roles',
    label: 'Locking & Roles',
    icon: <LockIcon fontSize="small" />,
    sections: [
      {
        heading: 'Script lock states',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The lock button in the toolbar cycles through three states:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                ['Unlocked 🔓', 'Script is freely editable by authorised users'],
                ['Locked 🔒', 'Editing is disabled — useful during production when the script is distributed'],
                ['Final ✅', 'Marks the script as locked in its final form — strongest protection'],
              ].map(([state, desc]) => (
                <Box key={state} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{state}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#ef4444">
              Only users with the <code>canLockScript</code> permission can change the lock
              state. Attempting to lock without permission shows a warning snackbar.
            </Callout>
          </>
        ),
        screenshotLabel: 'Lock state toggle with three states illustrated',
      },
      {
        heading: 'Role-based permissions',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Access is controlled by the <code>currentUserRole</code> prop. The three
              permission flags checked on mount are:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                ['canEdit', 'Permission to type in the editor (if false, editor is read-only)'],
                ['canLock', 'Permission to lock/unlock/finalise the script'],
                ['canTableRead', 'Permission to run the TTS Table Read'],
              ].map(([flag, desc]) => (
                <Box key={flag} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <code>{flag}</code> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Read-only editor with locked badge visible',
      },
    ],
  },
  {
    id: 'export',
    label: 'Export & Fullscreen',
    icon: <ExportIcon fontSize="small" />,
    sections: [
      {
        heading: 'Exporting the script',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>Export</strong> icon (toolbar, top-right) to download your
              script. Export options available:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {[
                ['.fountain', 'Plain-text Fountain format — opens in Final Draft, Highland, etc.'],
                ['PDF', 'Formatted screenplay PDF via ScreenplayPDFExport — maintains standard margins and fonts'],
                ['FDX', 'Final Draft XML — for full round-trip compatibility with Final Draft'],
              ].map(([fmt, desc]) => (
                <Box key={fmt} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{fmt}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Export menu showing Fountain, PDF, and FDX options',
      },
      {
        heading: 'Fullscreen writing mode',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>⛶ Fullscreen</strong> button (available in both the editor
              toolbar and the outer navigator) to enter a distraction-free writing mode.
              The UI chrome disappears and only the script text and a minimal toolbar are
              shown.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Press <Key>Escape</Key> or click the fullscreen-exit icon to return to the
              normal layout.
            </Typography>
            <Callout color="#6366f1">
              In fullscreen the background changes to a dark navy (<code>#1a1a2e</code>)
              for reduced eye strain during long writing sessions.
            </Callout>
          </>
        ),
        screenshotLabel: 'Fullscreen writing mode with minimal chrome',
      },
    ],
  },
  {
    id: 'storyboard',
    label: 'Storyboard Link',
    icon: <StoryboardNavIcon fontSize="small" />,
    sections: [
      {
        heading: 'Storyboard integration',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>Storyboard</strong> icon in the right-panel button group to
              open the Storyboard Integration View. When you click a scene in the Navigator,
              the storyboard panel automatically loads the storyboard frames for that scene.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              This two-way link means you can write a scene, immediately view its
              storyboard, and navigate to adjacent scenes — all without switching tabs.
            </Typography>
            <Callout color="#f59e0b">
              💡 If a scene does not yet have storyboard frames, the panel shows an
              empty-state prompt with a "Create frames" shortcut button.
            </Callout>
          </>
        ),
        screenshotLabel: 'Storyboard panel open alongside editor for a selected scene',
      },
      {
        heading: 'Story Structure panel',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            The <strong>Story Structure</strong> panel maps your scenes onto classic
            three-act (or custom) structure frameworks. It colour-codes the beat
            cards by act and shows where plot points fall relative to the overall
            page count. Switch to it via the Timeline icon in the right-panel group.
          </Typography>
        ),
        screenshotLabel: 'Story Structure panel showing three-act beat mapping',
      },
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

interface ScreenplayGuideProps {
  open: boolean;
  onClose: () => void;
  initialStepId?: string;
}

export const ScreenplayGuide: React.FC<ScreenplayGuideProps> = ({
  open,
  onClose,
  initialStepId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig  = getGuideConfig('screenplay');
  const activeIds    = getActiveStepIds('screenplay');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => STEPS.find(s => s.id === id)).filter(Boolean) as Step[])
    : STEPS;

  const initialIndex = initialStepId
    ? Math.max(0, visibleSteps.findIndex((s) => s.id === initialStepId))
    : 0;

  const [activeStep, setActiveStep] = useState(initialIndex);
  const contentRef = useRef<HTMLDivElement>(null);

  const step = visibleSteps[activeStep] ?? visibleSteps[0];
  const stepOverride = getStepOverride('screenplay', step?.id ?? '');

  const scrollToTop = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);

  const handleStepClick = useCallback(
    (index: number) => {
      setActiveStep(index);
      scrollToTop();
    },
    [scrollToTop],
  );

  const handlePrev = useCallback(() => {
    setActiveStep((prev) => {
      const next = Math.max(0, prev - 1);
      scrollToTop();
      return next;
    });
  }, [scrollToTop]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => {
      const next = Math.min(visibleSteps.length - 1, prev + 1);
      scrollToTop();
      return next;
    });
  }, [scrollToTop, visibleSteps.length]);

  const isFirst = activeStep === 0;
  const isLast  = activeStep === visibleSteps.length - 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#12121e',
          color: 'text.primary',
        },
      }}
    >
      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          py: 1.5,
          px: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon sx={{ color: '#6366f1' }} />
          <Typography variant="h6" fontWeight={700}>
            Screenplay Editor Guide
          </Typography>
          <Chip
            label={`${activeStep + 1} / ${visibleSteps.length}`}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
          />
        </Box>
        <Tooltip title="Close guide">
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      {/* ── Admin intro banner ────────────────────────────────────────── */}
      {guideConfig.introBanner && (
        <Box sx={{ px: 2.5, py: 1, bgcolor: `${guideConfig.introBannerColor ?? '#6366f1'}20`, borderBottom: `1px solid ${guideConfig.introBannerColor ?? '#6366f1'}40` }}>
          <Typography variant="body2" sx={{ color: guideConfig.introBannerColor ?? '#a5b4fc' }}>
            {guideConfig.introBanner}
          </Typography>
        </Box>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <DialogContent
        sx={{ p: 0, display: 'flex', overflow: 'hidden', flex: 1 }}
      >
        {/* Left nav — hidden on mobile */}
        {!isMobile && (
          <Box
            sx={{
              width: 200,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflowY: 'auto',
            }}
          >
            <Typography
              variant="overline"
              sx={{
                px: 2,
                pt: 2,
                pb: 0.5,
                fontSize: '0.65rem',
                color: 'text.disabled',
                letterSpacing: '0.1em',
              }}
            >
              Sections
            </Typography>
            <List dense disablePadding>
              {visibleSteps.map((s, idx) => {
                const ov = getStepOverride('screenplay', s.id);
                return (
                  <ListItemButton
                    key={s.id}
                    selected={idx === activeStep}
                    onClick={() => handleStepClick(idx)}
                    sx={{
                      px: 2,
                      py: 0.75,
                      gap: 1,
                      borderRadius: 1,
                      mx: 0.5,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(99,102,241,0.15)',
                        '&:hover': { bgcolor: 'rgba(99,102,241,0.2)' },
                      },
                    }}
                  >
                    <Box sx={{ color: idx === activeStep ? '#a5b4fc' : 'text.secondary', display: 'flex' }}>
                      {s.icon}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <span>{ov.labelOverride ?? s.label}</span>
                          {ov.badge && (
                            <Chip label={ov.badge} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(99,102,241,0.3)', color: '#c7d2fe' }} />
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{
                        fontSize: '0.8rem',
                        fontWeight: idx === activeStep ? 600 : 400,
                        color: idx === activeStep ? '#e0e7ff' : 'text.secondary',
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {/* Right scrollable content */}
        <Box
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2, sm: 4 },
            py: 3,
          }}
        >
          {/* Mobile step chips */}
          {isMobile && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.75,
                flexWrap: 'wrap',
                mb: 2.5,
              }}
            >
              {visibleSteps.map((s, idx) => {
                const ov = getStepOverride('screenplay', s.id);
                return (
                  <Chip
                    key={s.id}
                    label={ov.labelOverride ?? s.label}
                    size="small"
                    onClick={() => handleStepClick(idx)}
                    color={idx === activeStep ? 'primary' : 'default'}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
          )}

          {/* Step heading */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: 'rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a5b4fc',
                flexShrink: 0,
              }}
            >
              {step.icon}
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {step.label}
            </Typography>
          </Box>

          {/* Sections */}
          {step.sections.map((section, idx) => (
            <Box key={idx} sx={{ mb: 4 }}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ mb: 1.5, color: guideConfig.accentColorOverride ?? '#a5b4fc' }}
              >
                {section.heading}
              </Typography>
              <Box sx={{ mb: 1 }}>{section.body}</Box>
              {stepOverride.videoUrl ? (
                <Box sx={{ width: '100%', my: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <video src={stepOverride.videoUrl} controls style={{ width: '100%', display: 'block' }} />
                </Box>
              ) : stepOverride.screenshotUrl ? (
                <Box sx={{ width: '100%', my: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={stepOverride.screenshotUrl} alt={section.screenshotLabel} style={{ width: '100%', display: 'block' }} />
                </Box>
              ) : (
                <>
                  <ScreenshotPlaceholder label={section.screenshotLabel} />
                  <VideoPlaceholder label={section.screenshotLabel} />
                </>
              )}
              {idx < step.sections.length - 1 && (
                <Divider sx={{ mt: 3, borderColor: 'rgba(255,255,255,0.06)' }} />
              )}
            </Box>
          ))}
          {stepOverride.adminNote && (
            <Box sx={{ mt: 3, p: 2, borderRadius: 2, border: `1px solid ${stepOverride.adminNoteColor ?? '#6366f1'}40`, bgcolor: `${stepOverride.adminNoteColor ?? '#6366f1'}15` }}>
              <Typography variant="caption" sx={{ color: stepOverride.adminNoteColor ?? '#a5b4fc', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Admin Note
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{stepOverride.adminNote}</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          px: 2.5,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {/* Step dots */}
        <Box sx={{ display: 'flex', gap: 0.6, flex: 1, flexWrap: 'wrap' }}>
          {visibleSteps.map((_, idx) => (
            <Box
              key={idx}
              onClick={() => handleStepClick(idx)}
              sx={{
                width: idx === activeStep ? 20 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: idx === activeStep
                  ? '#6366f1'
                  : idx < activeStep
                  ? 'rgba(99,102,241,0.4)'
                  : 'rgba(255,255,255,0.12)',
                cursor: 'pointer',
                transition: 'width 0.2s ease, background-color 0.2s ease',
              }}
            />
          ))}
        </Box>

        <Button
          variant="outlined"
          size="small"
          onClick={handlePrev}
          disabled={isFirst}
          sx={{ minWidth: 80, borderColor: 'rgba(255,255,255,0.12)' }}
        >
          ← Prev
        </Button>

        {isLast ? (
          <Button
            variant="contained"
            size="small"
            onClick={onClose}
            startIcon={<DoneIcon />}
            sx={{ minWidth: 90, bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            Done
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            onClick={handleNext}
            sx={{ minWidth: 80, bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            Next →
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ScreenplayGuide;
