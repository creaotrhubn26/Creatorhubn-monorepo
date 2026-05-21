/**
 * BriefReferenceMoodboard — drag-drop-moodboard for referansesteget i
 * Creative Space Sync.
 *
 * Klienten kan lime inn lenker, legge til en kort tekst-bildetekst per
 * referanse, og dra for å prioritere rekkefølgen. Verdiene serialiseres
 * tilbake til den eksisterende line-separerte `referenceLinks`-stringen
 * slik at backend-koden i role-room-routes.ts ikke trenger å endres.
 *
 * Serialisering:
 *   - Hver linje = én referanse
 *   - Format: `<url>` eller `<url> | <bildetekst>`
 *   - Linjer som ikke matcher beholdes som "lenker uten parsing" og
 *     vises som no-thumbnail-kort (forhindrer datatap fra eldre brief).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, TextField, Tooltip, Chip, Card, CardContent,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  OpenInNew as OpenIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import {
  DragDropContext, Droppable, Draggable, type DropResult,
} from '@hello-pangea/dnd';

interface BriefReference {
  id: string;
  url: string;
  caption: string;
}

interface BriefReferenceMoodboardProps {
  /** Line-separated referansestring (kompatibel med dagens reference_links-felt). */
  value: string;
  onChange: (value: string) => void;
  /** Skjul tittel + add-knappens helper-tekst (brukes i kompakt mobil-modus). */
  dense?: boolean;
}

function parseValue(raw: string): BriefReference[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, idx) => {
      const [urlPart, ...captionParts] = line.split(' | ');
      return {
        id: `ref-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        url: urlPart.trim(),
        caption: captionParts.join(' | ').trim(),
      };
    });
}

function serializeValue(refs: BriefReference[]): string {
  return refs
    .filter((r) => r.url.trim().length > 0)
    .map((r) => (r.caption.trim() ? `${r.url.trim()} | ${r.caption.trim()}` : r.url.trim()))
    .join('\n');
}

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

function faviconFor(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

export const BriefReferenceMoodboard: React.FC<BriefReferenceMoodboardProps> = ({
  value, onChange, dense = false,
}) => {
  // Vi parser stringen ved render og holder kun "draft URL"-state lokalt.
  // På den måten unngår vi divergerende state hvis parent reseter feltet
  // (f.eks. ved første gangs lasting fra server).
  const refs = useMemo(() => parseValue(value), [value]);
  const [draftUrl, setDraftUrl] = useState('');

  const commit = useCallback((next: BriefReference[]) => {
    onChange(serializeValue(next));
  }, [onChange]);

  const handleAdd = () => {
    const trimmed = draftUrl.trim();
    if (!trimmed) return;
    const next = [...refs, {
      id: `ref-new-${Math.random().toString(36).slice(2, 8)}`,
      url: trimmed,
      caption: '',
    }];
    commit(next);
    setDraftUrl('');
  };

  const handleDelete = (id: string) => {
    commit(refs.filter((r) => r.id !== id));
  };

  const handleCaptionChange = (id: string, caption: string) => {
    commit(refs.map((r) => (r.id === id ? { ...r, caption } : r)));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...refs];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    commit(next);
  };

  const handlePasteOnEmptyDraft = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Tillat klienten å lime inn flere URL-er på én gang (én per linje).
    const text = e.clipboardData.getData('text');
    if (!text || !text.includes('\n')) return;
    e.preventDefault();
    const additions = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((url) => ({
        id: `ref-paste-${Math.random().toString(36).slice(2, 8)}`,
        url,
        caption: '',
      }));
    if (additions.length === 0) return;
    commit([...refs, ...additions]);
    setDraftUrl('');
  };

  return (
    <Box>
      {!dense && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          Lim inn lenker til film, bilder eller eksempler dere liker. Dra for å prioritere.
        </Typography>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="https://..."
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          onPaste={handlePasteOnEmptyDraft}
        />
        <Tooltip title="Legg til">
          <span>
            <IconButton
              color="primary"
              onClick={handleAdd}
              disabled={draftUrl.trim().length === 0}
              aria-label="Legg til referanse"
            >
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {refs.length === 0 ? (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1.5,
            p: 2,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <ImageIcon sx={{ fontSize: 32, opacity: 0.4, mb: 0.5 }} />
          <Typography variant="body2">Ingen referanser enda</Typography>
          <Typography variant="caption">Lim inn lenker over for å starte moodboarden.</Typography>
        </Box>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="brief-references" direction="vertical">
            {(droppableProvided) => (
              <Stack
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                spacing={1}
              >
                {refs.map((ref, index) => (
                  <Draggable key={ref.id} draggableId={ref.id} index={index}>
                    {(draggableProvided, snapshot) => (
                      <Card
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        sx={{
                          bgcolor: snapshot.isDragging ? 'rgba(245, 184, 46, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: '1px solid',
                          borderColor: snapshot.isDragging ? 'rgba(245, 184, 46, 0.4)' : 'divider',
                          transition: 'box-shadow 120ms ease',
                          boxShadow: snapshot.isDragging
                            ? '0 8px 24px rgba(0,0,0,0.3)'
                            : 'none',
                        }}
                      >
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              {...draggableProvided.dragHandleProps}
                              sx={{
                                color: 'text.disabled',
                                cursor: 'grab',
                                display: 'flex',
                                alignItems: 'center',
                                '&:hover': { color: 'text.primary' },
                              }}
                              aria-label="Dra for å reordne"
                            >
                              <DragIcon fontSize="small" />
                            </Box>
                            {faviconFor(ref.url) && (
                              <Box
                                component="img"
                                src={faviconFor(ref.url) ?? ''}
                                alt=""
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                sx={{ width: 20, height: 20, borderRadius: 0.5, flexShrink: 0 }}
                              />
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                                <Chip
                                  label={hostnameFor(ref.url)}
                                  size="small"
                                  sx={{ height: 20, fontSize: 11, maxWidth: 200 }}
                                />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {ref.url}
                                </Typography>
                              </Stack>
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="Hva liker dere ved denne? (valgfritt)"
                                value={ref.caption}
                                onChange={(e) => handleCaptionChange(ref.id, e.target.value)}
                                variant="standard"
                                sx={{
                                  mt: 0.25,
                                  '& .MuiInput-input': { fontSize: 13, py: 0.5 },
                                }}
                              />
                            </Box>
                            <Tooltip title="Åpne lenke">
                              <IconButton
                                size="small"
                                component="a"
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Åpne i ny fane"
                              >
                                <OpenIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Fjern">
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(ref.id)}
                                aria-label="Fjern referanse"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {droppableProvided.placeholder}
              </Stack>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </Box>
  );
};

export default BriefReferenceMoodboard;
