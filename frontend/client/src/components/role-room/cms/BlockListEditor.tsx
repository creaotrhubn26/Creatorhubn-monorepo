/**
 * BlockListEditor.tsx
 *
 * Admin-editor for block-basert CMS. Lar produkt-eier:
 *   - Legge til nye blokker via dropdown (Hero, RichText, FAQ, ...)
 *   - Reordne blokker opp/ned
 *   - Slette blokker
 *   - Redigere felter inne i hver blokk
 *
 * Reuser MUI TextField/Select. Drag-drop kommer i Fase 4.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RichTextEditor as TipTapRichTextEditor } from '../components/RichTextEditor';
import { applyLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from './blockSchema';
import type {
  Block,
  BlockKind,
  ComparisonBlock,
  ComparisonSupport,
  CtaBlock,
  FaqBlock,
  FeatureListBlock,
  HeroBlock,
  ImageBlock,
  RelatedStudiesBlock,
  RichTextBlock,
  UsageExamplesBlock,
} from './blockSchema';
import { BLOCK_LABELS, createBlock } from './blockSchema';

interface BlockListEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function BlockListEditor({ blocks, onChange }: BlockListEditorProps) {
  const [newType, setNewType] = useState<BlockKind>('richText');
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = () => {
    onChange([...blocks, createBlock(newType)]);
  };

  const handleDelete = (idx: number) => {
    const next = blocks.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    onChange(arrayMove(blocks, idx, target));
  };

  // I locale-mode 'en': beregn diff fra kanonisk blokk og skriv kun
  // endrede felter til i18n.en. Tomme felter trekkes ut (slettes fra
  // override-objektet) så de faller tilbake til norsk.
  const handleUpdate = (idx: number, updated: Block) => {
    const next = blocks.slice();
    const canonical = blocks[idx];
    if (locale === DEFAULT_LOCALE) {
      next[idx] = { ...updated, i18n: canonical.i18n };
    } else {
      const overrides: Record<string, unknown> = {};
      const canonicalRecord = canonical as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(updated)) {
        if (key === 'id' || key === 'type' || key === 'i18n') continue;
        const canonicalValue = canonicalRecord[key];
        const isEmpty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
        if (isEmpty) continue;
        if (JSON.stringify(value) === JSON.stringify(canonicalValue)) continue;
        overrides[key] = value;
      }
      next[idx] = {
        ...canonical,
        i18n: {
          ...(canonical.i18n ?? {}),
          en: Object.keys(overrides).length > 0 ? overrides : undefined,
        },
      };
    }
    onChange(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(blocks, oldIdx, newIdx));
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        sx={{ p: 1.2, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.16)', bgcolor: 'rgba(2,6,23,0.34)' }}
      >
        <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem', fontWeight: 600 }}>
          Språk
        </Typography>
        <Stack direction="row" spacing={0.6}>
          {SUPPORTED_LOCALES.map((loc) => {
            const active = locale === loc;
            return (
              <Button
                key={loc}
                size="small"
                onClick={() => setLocale(loc)}
                sx={{
                  bgcolor: active ? 'rgba(167,139,250,0.16)' : 'transparent',
                  color: active ? '#ddd6fe' : 'rgba(203,213,225,0.78)',
                  border: active ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(148,163,184,0.24)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  minWidth: 56,
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.08)' },
                }}
              >
                {loc === 'no' ? '🇳🇴 NO' : '🇬🇧 EN'}
              </Button>
            );
          })}
        </Stack>
        <Typography sx={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.72rem', flex: 1 }}>
          {locale === DEFAULT_LOCALE
            ? 'Norsk er kanonisk. Endringer skrives til hovedfeltene.'
            : 'Engelsk-overrides. Tomme felter beholder norsk verdi. Slett tekst for å fjerne override.'}
        </Typography>
      </Stack>

      {blocks.length === 0 ? (
        <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.92rem', fontStyle: 'italic' }}>
          Ingen blokker. Velg type under og klikk "Legg til" for å starte.
        </Typography>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1.5}>
              {blocks.map((block, idx) => (
                <BlockCard
                  key={block.id}
                  block={applyLocale(block, locale)}
                  index={idx}
                  total={blocks.length}
                  onUpdate={(b) => handleUpdate(idx, b)}
                  onDelete={() => handleDelete(idx)}
                  onMove={(dir) => handleMove(idx, dir)}
                  locale={locale}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <Card sx={{ bgcolor: 'rgba(167,139,250,0.06)', border: '1px dashed rgba(167,139,250,0.32)' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
              <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>Ny blokk-type</InputLabel>
              <Select
                label="Ny blokk-type"
                value={newType}
                onChange={(e) => setNewType(e.target.value as BlockKind)}
                sx={{ color: '#e2e8f0' }}
              >
                {(Object.keys(BLOCK_LABELS) as BlockKind[]).map((k) => (
                  <MenuItem key={k} value={k}>{BLOCK_LABELS[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              onClick={handleAdd}
              variant="contained"
              startIcon={<AddIcon />}
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              Legg til
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

interface BlockCardProps {
  block: Block;
  index: number;
  total: number;
  onUpdate: (b: Block) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  locale: Locale;
}

function BlockCard({ block, index, total, onUpdate, onDelete, onMove, locale }: BlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        sx={{
          bgcolor: 'rgba(2,6,23,0.42)',
          border: isDragging ? '1px solid rgba(167,139,250,0.6)' : '1px solid rgba(148,163,184,0.16)',
          boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <IconButton
              size="small"
              {...attributes}
              {...listeners}
              sx={{
                color: 'rgba(203,213,225,0.6)',
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
                touchAction: 'none',
              }}
              aria-label="Dra for å reordne"
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
            <Chip
              label={BLOCK_LABELS[block.type]}
              size="small"
              sx={{ bgcolor: 'rgba(167,139,250,0.16)', color: '#ddd6fe', fontWeight: 700, height: 22 }}
            />
            <Typography sx={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.74rem', fontFamily: 'monospace' }}>
              #{index + 1}
            </Typography>
            {locale !== DEFAULT_LOCALE ? (
              <Chip
                label={locale.toUpperCase()}
                size="small"
                sx={{ bgcolor: 'rgba(96,165,250,0.16)', color: '#bfdbfe', fontWeight: 700, height: 20, fontSize: '0.66rem' }}
              />
            ) : null}
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => onMove(-1)} disabled={index === 0} sx={{ color: 'rgba(203,213,225,0.78)' }} aria-label="Flytt opp">
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => onMove(1)} disabled={index === total - 1} sx={{ color: 'rgba(203,213,225,0.78)' }} aria-label="Flytt ned">
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onDelete} sx={{ color: '#fca5a5' }} aria-label="Slett blokk">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
          <BlockEditor block={block} onUpdate={onUpdate} />
        </CardContent>
      </Card>
    </div>
  );
}

function BlockEditor({ block, onUpdate }: { block: Block; onUpdate: (b: Block) => void }) {
  switch (block.type) {
    case 'hero':
      return <HeroEditor block={block} onUpdate={onUpdate} />;
    case 'richText':
      return <RichTextBlockEditor block={block} onUpdate={onUpdate} />;
    case 'faq':
      return <FaqEditor block={block} onUpdate={onUpdate} />;
    case 'comparison':
      return <ComparisonEditor block={block} onUpdate={onUpdate} />;
    case 'cta':
      return <CtaEditor block={block} onUpdate={onUpdate} />;
    case 'featureList':
      return <FeatureListEditor block={block} onUpdate={onUpdate} />;
    case 'relatedStudies':
      return <RelatedStudiesEditor block={block} onUpdate={onUpdate} />;
    case 'usageExamples':
      return <UsageExamplesEditor block={block} onUpdate={onUpdate} />;
    case 'image':
      return <ImageEditor block={block} onUpdate={onUpdate} />;
  }
}

// ── Field-primitive ─────────────────────────────────────────────

const FIELD_SX = {
  '& .MuiInputBase-root': { color: '#e2e8f0' },
  '& .MuiInputLabel-root': { color: 'rgba(148,163,184,0.85)' },
} as const;

function TextRow({
  label, value, onChange, multiline = false, rows = 1,
}: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number }) {
  return (
    <TextField
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      fullWidth
      multiline={multiline}
      minRows={rows}
      sx={FIELD_SX}
    />
  );
}

// ── Per-block-editor ────────────────────────────────────────────

function HeroEditor({ block, onUpdate }: { block: HeroBlock; onUpdate: (b: HeroBlock) => void }) {
  const upd = (patch: Partial<HeroBlock>) => onUpdate({ ...block, ...patch });
  return (
    <Stack spacing={1.5}>
      <TextRow label="Audience chip (valgfri)" value={block.audienceChip ?? ''} onChange={(v) => upd({ audienceChip: v })} />
      <TextRow label="H1 (tittel)" value={block.h1} onChange={(v) => upd({ h1: v })} />
      <TextRow label="Undertittel" value={block.subtitle ?? ''} onChange={(v) => upd({ subtitle: v })} multiline rows={2} />
      <TextRow label="Intro-tekst" value={block.intro ?? ''} onChange={(v) => upd({ intro: v })} multiline rows={4} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Primær CTA-label" value={block.primaryCtaLabel ?? ''} onChange={(v) => upd({ primaryCtaLabel: v })} />
        <TextRow label="Primær CTA-URL" value={block.primaryCtaUrl ?? ''} onChange={(v) => upd({ primaryCtaUrl: v })} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Sekundær CTA-label" value={block.secondaryCtaLabel ?? ''} onChange={(v) => upd({ secondaryCtaLabel: v })} />
        <TextRow label="Sekundær CTA-URL" value={block.secondaryCtaUrl ?? ''} onChange={(v) => upd({ secondaryCtaUrl: v })} />
      </Stack>
    </Stack>
  );
}

function RichTextBlockEditor({ block, onUpdate }: { block: RichTextBlock; onUpdate: (b: RichTextBlock) => void }) {
  return (
    <Stack spacing={1.5}>
      <TextRow label="Overskrift (valgfri)" value={block.heading ?? ''} onChange={(v) => onUpdate({ ...block, heading: v })} />
      <Box>
        <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.84rem', fontWeight: 600, mb: 0.8 }}>
          Brødtekst (rik tekst)
        </Typography>
        <TipTapRichTextEditor
          value={block.text}
          onChange={(v) => onUpdate({ ...block, text: v })}
          placeholder="Skriv brødtekst — bruk knappene over for bold, italic, overskrifter, lister …"
          minHeight={140}
          accentColor="#a78bfa"
        />
      </Box>
    </Stack>
  );
}

function FaqEditor({ block, onUpdate }: { block: FaqBlock; onUpdate: (b: FaqBlock) => void }) {
  const upd = (items: typeof block.items) => onUpdate({ ...block, items });
  return (
    <Stack spacing={1.5}>
      <TextRow label="Overskrift" value={block.heading ?? ''} onChange={(v) => onUpdate({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
          <Stack spacing={0.8} sx={{ flex: 1 }}>
            <TextRow label={`Spørsmål ${i + 1}`} value={it.q} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, q: v } : x))} />
            <TextRow label="Svar" value={it.a} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, a: v } : x))} multiline rows={2} />
          </Stack>
          <IconButton size="small" onClick={() => upd(block.items.filter((_, idx) => idx !== i))} sx={{ color: '#fca5a5', mt: 0.5 }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => upd([...block.items, { q: '', a: '' }])} sx={{ color: '#a78bfa', textTransform: 'none', alignSelf: 'flex-start' }}>
        Nytt spørsmål
      </Button>
    </Stack>
  );
}

function ComparisonEditor({ block, onUpdate }: { block: ComparisonBlock; onUpdate: (b: ComparisonBlock) => void }) {
  const updRows = (rows: typeof block.rows) => onUpdate({ ...block, rows });
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Overskrift" value={block.heading ?? ''} onChange={(v) => onUpdate({ ...block, heading: v })} />
        <TextRow label="Konkurrent-navn" value={block.competitorLabel} onChange={(v) => onUpdate({ ...block, competitorLabel: v })} />
      </Stack>
      {block.rows.map((row, i) => (
        <Stack key={i} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
          <TextRow label={`Funksjon ${i + 1}`} value={row.feature} onChange={(v) => updRows(block.rows.map((x, idx) => idx === i ? { ...x, feature: v } : x))} />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>The Role Room</InputLabel>
            <Select
              label="The Role Room"
              value={row.roleRoom}
              onChange={(e) => updRows(block.rows.map((x, idx) => idx === i ? { ...x, roleRoom: e.target.value as ComparisonSupport } : x))}
              sx={{ color: '#e2e8f0' }}
            >
              <MenuItem value="yes">Ja</MenuItem>
              <MenuItem value="no">Nei</MenuItem>
              <MenuItem value="partial">Delvis</MenuItem>
              <MenuItem value="unknown">Ukjent</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>Konkurrent</InputLabel>
            <Select
              label="Konkurrent"
              value={row.competitor}
              onChange={(e) => updRows(block.rows.map((x, idx) => idx === i ? { ...x, competitor: e.target.value as ComparisonSupport } : x))}
              sx={{ color: '#e2e8f0' }}
            >
              <MenuItem value="yes">Ja</MenuItem>
              <MenuItem value="no">Nei</MenuItem>
              <MenuItem value="partial">Delvis</MenuItem>
              <MenuItem value="unknown">Ukjent</MenuItem>
            </Select>
          </FormControl>
          <IconButton size="small" onClick={() => updRows(block.rows.filter((_, idx) => idx !== i))} sx={{ color: '#fca5a5' }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => updRows([...block.rows, { feature: '', roleRoom: 'yes', competitor: 'no' }])} sx={{ color: '#a78bfa', textTransform: 'none', alignSelf: 'flex-start' }}>
        Ny rad
      </Button>
    </Stack>
  );
}

function CtaEditor({ block, onUpdate }: { block: CtaBlock; onUpdate: (b: CtaBlock) => void }) {
  const upd = (patch: Partial<CtaBlock>) => onUpdate({ ...block, ...patch });
  return (
    <Stack spacing={1.5}>
      <TextRow label="Overskrift" value={block.heading} onChange={(v) => upd({ heading: v })} />
      <TextRow label="Brødtekst" value={block.body ?? ''} onChange={(v) => upd({ body: v })} multiline rows={2} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Knapp-label" value={block.buttonLabel} onChange={(v) => upd({ buttonLabel: v })} />
        <TextRow label="Knapp-URL" value={block.buttonUrl} onChange={(v) => upd({ buttonUrl: v })} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Sekundær label" value={block.secondaryLabel ?? ''} onChange={(v) => upd({ secondaryLabel: v })} />
        <TextRow label="Sekundær URL" value={block.secondaryUrl ?? ''} onChange={(v) => upd({ secondaryUrl: v })} />
      </Stack>
    </Stack>
  );
}

function FeatureListEditor({ block, onUpdate }: { block: FeatureListBlock; onUpdate: (b: FeatureListBlock) => void }) {
  const updItems = (items: string[]) => onUpdate({ ...block, items });
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Overskrift (valgfri)" value={block.heading ?? ''} onChange={(v) => onUpdate({ ...block, heading: v })} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>Stil</InputLabel>
          <Select
            label="Stil"
            value={block.style ?? 'chips'}
            onChange={(e) => onUpdate({ ...block, style: e.target.value as 'chips' | 'bullets' })}
            sx={{ color: '#e2e8f0' }}
          >
            <MenuItem value="chips">Chips</MenuItem>
            <MenuItem value="bullets">Bullets</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {block.items.map((it, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <TextRow label={`Element ${i + 1}`} value={it} onChange={(v) => updItems(block.items.map((x, idx) => idx === i ? v : x))} />
          <IconButton size="small" onClick={() => updItems(block.items.filter((_, idx) => idx !== i))} sx={{ color: '#fca5a5' }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => updItems([...block.items, ''])} sx={{ color: '#a78bfa', textTransform: 'none', alignSelf: 'flex-start' }}>
        Nytt element
      </Button>
    </Stack>
  );
}

function RelatedStudiesEditor({ block, onUpdate }: { block: RelatedStudiesBlock; onUpdate: (b: RelatedStudiesBlock) => void }) {
  const upd = (items: typeof block.items) => onUpdate({ ...block, items });
  return (
    <Stack spacing={1.5}>
      <TextRow label="Overskrift" value={block.heading ?? ''} onChange={(v) => onUpdate({ ...block, heading: v })} />
      {block.items.map((s, i) => (
        <Stack key={i} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
          <TextRow label="Studie-navn" value={s.name} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, name: v } : x))} />
          <TextRow label="Institusjon" value={s.institution} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, institution: v } : x))} />
          <TextRow label="Notat" value={s.note ?? ''} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, note: v || undefined } : x))} />
          <IconButton size="small" onClick={() => upd(block.items.filter((_, idx) => idx !== i))} sx={{ color: '#fca5a5' }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => upd([...block.items, { name: '', institution: '' }])} sx={{ color: '#a78bfa', textTransform: 'none', alignSelf: 'flex-start' }}>
        Nytt studie
      </Button>
    </Stack>
  );
}

function UsageExamplesEditor({ block, onUpdate }: { block: UsageExamplesBlock; onUpdate: (b: UsageExamplesBlock) => void }) {
  const upd = (items: typeof block.items) => onUpdate({ ...block, items });
  return (
    <Stack spacing={1.5}>
      <TextRow label="Overskrift" value={block.heading ?? ''} onChange={(v) => onUpdate({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
          <Stack spacing={0.8} sx={{ flex: 1 }}>
            <TextRow label={`Eksempel ${i + 1} — tittel`} value={it.title} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, title: v } : x))} />
            <TextRow label="Brødtekst" value={it.body} onChange={(v) => upd(block.items.map((x, idx) => idx === i ? { ...x, body: v } : x))} multiline rows={3} />
          </Stack>
          <IconButton size="small" onClick={() => upd(block.items.filter((_, idx) => idx !== i))} sx={{ color: '#fca5a5', mt: 0.5 }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => upd([...block.items, { title: '', body: '' }])} sx={{ color: '#a78bfa', textTransform: 'none', alignSelf: 'flex-start' }}>
        Nytt eksempel
      </Button>
    </Stack>
  );
}

function ImageEditor({ block, onUpdate }: { block: ImageBlock; onUpdate: (b: ImageBlock) => void }) {
  const upd = (patch: Partial<ImageBlock>) => onUpdate({ ...block, ...patch });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/cms/media/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const err = (data?.error as string | undefined) ?? `HTTP ${res.status}`;
        if (err === 'storage_not_configured') {
          setUploadError('R2 ikke konfigurert. Sett CMS_R2_* (eller R2_*)-env-vars i backend, så fungerer drag-drop.');
        } else {
          setUploadError(`Feil: ${err}${data?.detail ? ` (${data.detail})` : ''}`);
        }
        return;
      }
      const url = String(data.url ?? '').trim();
      if (!url) {
        setUploadError('Mangler URL i respons');
        return;
      }
      upd({ src: url, alt: block.alt || file.name.replace(/\.[^.]+$/, '') });
    } catch (err) {
      setUploadError(`Feil: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) await uploadFile(file);
        }}
        sx={{
          p: 2,
          borderRadius: 1.5,
          border: dragOver
            ? '2px dashed #a78bfa'
            : '2px dashed rgba(167,139,250,0.3)',
          bgcolor: dragOver ? 'rgba(167,139,250,0.08)' : 'rgba(2,6,23,0.34)',
          textAlign: 'center',
          transition: 'all 0.15s ease',
        }}
      >
        {block.src ? (
          <Stack spacing={1.5} alignItems="center">
            <Box
              component="img"
              src={block.src}
              alt={block.alt}
              sx={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 1 }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                component="label"
                size="small"
                variant="outlined"
                disabled={uploading}
                sx={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.32)', textTransform: 'none' }}
              >
                {uploading ? 'Laster opp ...' : 'Bytt bilde'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                    e.target.value = '';
                  }}
                />
              </Button>
              <Button
                size="small"
                onClick={() => upd({ src: '' })}
                sx={{ color: '#fca5a5', textTransform: 'none' }}
              >
                Fjern
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1} alignItems="center">
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem' }}>
              {dragOver ? 'Slipp bildet her' : 'Dra et bilde hit, eller'}
            </Typography>
            <Button
              component="label"
              size="small"
              variant="contained"
              disabled={uploading}
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              {uploading ? 'Laster opp ...' : 'Velg fil'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                  e.target.value = '';
                }}
              />
            </Button>
            <Typography sx={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.72rem' }}>
              Maks 10 MB. JPEG, PNG, WebP, AVIF, GIF, SVG.
            </Typography>
          </Stack>
        )}
      </Box>
      {uploadError ? (
        <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem' }}>{uploadError}</Typography>
      ) : null}
      <TextRow label="Bilde-URL (eller lim inn ekstern URL)" value={block.src} onChange={(v) => upd({ src: v })} />
      <TextRow label="Alt-tekst (a11y/SEO)" value={block.alt} onChange={(v) => upd({ alt: v })} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextRow label="Caption (valgfri)" value={block.caption ?? ''} onChange={(v) => upd({ caption: v })} />
        <TextField
          label="Maks bredde (px)"
          type="number"
          value={block.maxWidth ?? ''}
          onChange={(e) => upd({ maxWidth: e.target.value ? Number(e.target.value) : undefined })}
          size="small"
          sx={{ ...FIELD_SX, minWidth: 140 }}
        />
      </Stack>
    </Stack>
  );
}
