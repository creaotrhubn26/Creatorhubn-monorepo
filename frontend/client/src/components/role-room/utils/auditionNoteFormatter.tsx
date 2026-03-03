/**
 * auditionNoteFormatter.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Standalone renderer for the structured notes format used in audition
 * schedule cards. Extracted here so it can be:
 *  • unit-tested in isolation
 *  • re-used by other panels that display audition notes
 *
 * Supported line syntax:
 *   ―――――――――――  →  <Divider>
 *   ## Heading   →  bold amber heading
 *   • Bullet     →  dot list
 *   1. Numbered  →  numbered badge list
 *   ☐ Unchecked  →  checkbox (open)
 *   ☑ Checked    →  checkbox (ticked, strikethrough)
 *   Blank line   →  vertical spacer
 *   Plain text   →  normal body text
 *
 * Inline formatting within any line:
 *   **bold**     →  amber bold
 *   _italic_     →  italic
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { type ReactNode } from 'react';
import { Box, Typography, Divider } from '@mui/material';

// ─── Inline parser ────────────────────────────────────────────────────────────

function parseInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch  = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/_(.+?)_/);
    const boldIdx  = boldMatch  ? remaining.indexOf(boldMatch[0])  : -1;
    const italicIdx = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

    if (boldIdx === -1 && italicIdx === -1) {
      parts.push(remaining);
      break;
    }

    const useBold = boldIdx !== -1 && (italicIdx === -1 || boldIdx < italicIdx);

    if (useBold && boldMatch) {
      if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx));
      parts.push(
        <Box component="span" key={key++} sx={{ fontWeight: 700, color: '#ffb800' }}>
          {boldMatch[1]}
        </Box>,
      );
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (italicMatch) {
      if (italicIdx > 0) parts.push(remaining.slice(0, italicIdx));
      parts.push(
        <Box component="span" key={key++} sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.85)' }}>
          {italicMatch[1]}
        </Box>,
      );
      remaining = remaining.slice(italicIdx + italicMatch[0].length);
    }
  }

  return parts.length > 0 ? parts : text;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a structured notes string into a React node tree.
 * Returns `null` when `notes` is empty or only whitespace.
 */
export function formatNotesToReactNodes(notes: string): ReactNode {
  if (!notes) return null;

  return notes.split('\n').map((line, i) => {
    // Divider
    if (line.includes('―――――――――――')) {
      return (
        <Divider key={i} sx={{ my: 1.5, borderColor: 'rgba(255,193,7,0.3)', borderWidth: 2 }} />
      );
    }

    // Heading (## )
    if (line.startsWith('## ')) {
      return (
        <Typography
          key={i}
          component="div"
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1rem', sm: '1.125rem' },
            color: '#ffb800',
            mt: i > 0 ? 1.5 : 0,
            mb: 0.75,
            borderBottom: '2px solid rgba(255,184,0,0.3)',
            pb: 0.5,
          }}
        >
          {parseInline(line.slice(3))}
        </Typography>
      );
    }

    // Bullet (• )
    if (line.startsWith('• ')) {
      return (
        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ffb800', mt: 1, flexShrink: 0 }} />
          <Typography component="div" sx={{ color: '#fff', lineHeight: 1.6, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
            {parseInline(line.slice(2))}
          </Typography>
        </Box>
      );
    }

    // Numbered (1. )
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      return (
        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              minWidth: 20,
              height: 20,
              borderRadius: 1,
              bgcolor: 'rgba(255,184,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: '#ffb800',
              flexShrink: 0,
            }}
          >
            {numMatch[1]}
          </Box>
          <Typography component="div" sx={{ color: '#fff', lineHeight: 1.6, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
            {parseInline(line.slice(numMatch[0].length))}
          </Typography>
        </Box>
      );
    }

    // Checkboxes (☐ / ☑)
    const isUnchecked = line.startsWith('☐ ');
    const isChecked   = line.startsWith('☑ ');
    if (isUnchecked || isChecked) {
      return (
        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: 1,
              border: '2px solid',
              borderColor: isChecked ? '#4caf50' : 'rgba(255,255,255,0.4)',
              bgcolor: isChecked ? 'rgba(76,175,80,0.2)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            {isChecked && (
              <Typography sx={{ color: '#4caf50', fontWeight: 700, fontSize: '0.75rem' }}>✓</Typography>
            )}
          </Box>
          <Typography
            component="div"
            sx={{
              color: isChecked ? 'rgba(255,255,255,0.5)' : '#fff',
              lineHeight: 1.6,
              fontSize: { xs: '0.8rem', sm: '0.85rem' },
              textDecoration: isChecked ? 'line-through' : 'none',
            }}
          >
            {parseInline(line.slice(2))}
          </Typography>
        </Box>
      );
    }

    // Empty line spacer
    if (line.trim() === '') {
      return <Box key={i} sx={{ height: 8 }} />;
    }

    // Plain text
    return (
      <Typography key={i} component="div" sx={{ color: '#fff', lineHeight: 1.6, fontSize: { xs: '0.8rem', sm: '0.85rem' }, mb: 0.25 }}>
        {parseInline(line)}
      </Typography>
    );
  });
}
