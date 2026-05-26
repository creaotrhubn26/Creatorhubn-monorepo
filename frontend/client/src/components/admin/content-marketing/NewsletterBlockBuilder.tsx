import { useEffect, useMemo, useState } from 'react';
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
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TitleIcon from '@mui/icons-material/Title';
import NotesIcon from '@mui/icons-material/Notes';
import ImageIcon from '@mui/icons-material/Image';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { newsletterAiApi, type NewsletterAiContentScore, type NewsletterAiSubject, type NewsletterAudienceFilter, type NewsletterBlock } from '../../../services/adminRoomApi';

/**
 * Pikselperfekt block-builder for Norwegian Casting Brief.
 * Inspirert av Beehiiv/Substack-pattern men spisset for vår use case.
 *
 * 3-kolonne-layout:
 *   Venstre: block-palette (6 typer)
 *   Senter:  drag-sortable blocks med inline-edit
 *   Høyre:   AI Assist-panel (Claude) + content stats
 */

interface BuilderProps {
  initialBlocks: NewsletterBlock[];
  title: string;
  subject: string;
  preheader: string;
  audienceFilter: NewsletterAudienceFilter;
  onChange: (blocks: NewsletterBlock[]) => void;
  onTitleChange: (next: string) => void;
  onSubjectChange: (next: string) => void;
  onPreheaderChange: (next: string) => void;
  onAudienceFilterChange: (next: NewsletterAudienceFilter) => void;
}

const PALETTE: Array<{ type: NewsletterBlock['type']; label: string; icon: React.ReactElement }> = [
  { type: 'header', label: 'Header', icon: <TitleIcon fontSize="small" /> },
  { type: 'text', label: 'Text', icon: <NotesIcon fontSize="small" /> },
  { type: 'image', label: 'Image', icon: <ImageIcon fontSize="small" /> },
  { type: 'cta', label: 'CTA Button', icon: <TouchAppIcon fontSize="small" /> },
  { type: 'quote', label: 'Quote', icon: <FormatQuoteIcon fontSize="small" /> },
  { type: 'divider', label: 'Divider', icon: <HorizontalRuleIcon fontSize="small" /> },
];

function genId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function blankBlock(type: NewsletterBlock['type']): NewsletterBlock {
  const id = genId();
  switch (type) {
    case 'header': return { id, type, level: 2, text: 'Ny seksjon' };
    case 'text': return { id, type, markdown: 'Skriv tekst her …' };
    case 'image': return { id, type, url: '', alt: '' };
    case 'cta': return { id, type, label: 'Les mer', url: 'https://theroleroom.com', align: 'center' };
    case 'quote': return { id, type, text: 'Sitat fra en bransje-stemme.' };
    case 'divider': return { id, type };
  }
}

export function NewsletterBlockBuilder(props: BuilderProps) {
  const { initialBlocks, title, subject, preheader, audienceFilter, onChange, onTitleChange, onSubjectChange, onPreheaderChange, onAudienceFilterChange } = props;
  const [blocks, setBlocks] = useState<NewsletterBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiDialog, setAiDialog] = useState<null | 'first-draft' | 'subject-lines' | 'rewrite' | 'content-score'>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sync external when blocks change
  useEffect(() => { onChange(blocks); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [blocks]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function addBlock(type: NewsletterBlock['type']) {
    const newBlock = blankBlock(type);
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }

  function updateBlock(id: string, patch: Partial<NewsletterBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as NewsletterBlock) : b)));
  }

  function deleteBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const wordCount = useMemo(() => {
    return blocks
      .map((b) => {
        if (b.type === 'header') return b.text;
        if (b.type === 'text') return b.markdown;
        if (b.type === 'quote') return `${b.text} ${b.attribution ?? ''}`;
        if (b.type === 'cta') return b.label;
        return '';
      })
      .join(' ')
      .split(/\s+/)
      .filter(Boolean).length;
  }, [blocks]);

  const flattenedText = useMemo(() => blocks.map((b) => {
    if (b.type === 'header') return `# ${b.text}`;
    if (b.type === 'text') return b.markdown;
    if (b.type === 'quote') return `> ${b.text}`;
    if (b.type === 'cta') return `[${b.label}](${b.url})`;
    return '';
  }).join('\n\n'), [blocks]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {aiError ? <Alert severity="error" sx={{ m: 1 }} onClose={() => setAiError(null)}>{aiError}</Alert> : null}

      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(148,163,184,0.08)', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField size="small" label="Tittel" value={title} onChange={(e) => onTitleChange(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
        <TextField size="small" label="Subject" value={subject} onChange={(e) => onSubjectChange(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
        <TextField size="small" label="Preheader" value={preheader} onChange={(e) => onPreheaderChange(e.target.value)} sx={{ flex: 1.5, minWidth: 200 }} />
        <Select
          size="small"
          value={audienceFilter}
          onChange={(e) => onAudienceFilterChange(e.target.value as NewsletterAudienceFilter)}
          sx={{ minWidth: 200 }}
          renderValue={(v) => (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(203,213,225,0.7)' }}>Send til:</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff' }}>
                {v === 'all' ? 'Alle confirmed' : v === 'tier1-advocates' ? 'T1 Advocates' : v === 'tier1-engaged' ? 'T1 Engaged' : String(v)}
              </Typography>
            </Stack>
          )}
        >
          <MenuItem value="all">Alle confirmed subscribers</MenuItem>
          <MenuItem value="tier1-engaged">T1 Engaged (CRM)</MenuItem>
          <MenuItem value="tier1-advocates">T1 Advocates (CRM) — eksklusiv</MenuItem>
          <MenuItem value="source-casting-scam-signs">Source: Trust pillar</MenuItem>
          <MenuItem value="source-child-consent-film">Source: Compliance pillar</MenuItem>
          <MenuItem value="source-casting-report-2026">Source: Casting Report</MenuItem>
          <MenuItem value="source-founder-pov">Source: Founder POV</MenuItem>
          <MenuItem value="source-selvtape-tips">Source: How-To pillar</MenuItem>
        </Select>
      </Box>

      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px 1fr 280px' }, overflow: 'hidden' }}>
        {/* ── Venstre: palette ── */}
        <Box sx={{ borderRight: { md: '1px solid rgba(148,163,184,0.08)' }, p: 1.5, overflow: 'auto' }}>
          <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.25 }}>
            Insert blocks
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: '1fr 1fr' }, gap: 0.75 }}>
            {PALETTE.map((p) => (
              <Button
                key={p.type}
                onClick={() => addBlock(p.type)}
                variant="outlined"
                sx={{
                  flexDirection: 'column',
                  gap: 0.5,
                  py: 1.25,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  color: '#c4b5fd',
                  borderColor: 'rgba(148,163,184,0.18)',
                  '&:hover': { bgcolor: 'rgba(139,92,246,0.1)', borderColor: 'rgba(167,139,250,0.5)' },
                }}
              >
                {p.icon}
                {p.label}
              </Button>
            ))}
          </Box>

          <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mt: 3, mb: 1.25 }}>
            AI Assist
          </Typography>
          <Stack spacing={0.5}>
            <Button size="small" startIcon={<AutoAwesomeIcon fontSize="small" />} onClick={() => setAiDialog('first-draft')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#a78bfa', fontWeight: 600, fontSize: '0.78rem' }}>
              Førsteutkast
            </Button>
            <Button size="small" startIcon={<AutoAwesomeIcon fontSize="small" />} onClick={() => setAiDialog('subject-lines')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#a78bfa', fontWeight: 600, fontSize: '0.78rem' }}>
              Subject lines (×5)
            </Button>
            <Button size="small" startIcon={<AutoAwesomeIcon fontSize="small" />} onClick={() => setAiDialog('content-score')} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#a78bfa', fontWeight: 600, fontSize: '0.78rem' }}>
              Content score
            </Button>
          </Stack>

          <Box sx={{ mt: 3, p: 1.25, borderRadius: 1, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)' }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.7rem' }}>{wordCount} ord · {blocks.length} blokker</Typography>
          </Box>
        </Box>

        {/* ── Senter: canvas ── */}
        <Box sx={{ p: 3, overflow: 'auto', bgcolor: '#0a0a0f' }}>
          <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2, mb: 3 }}>
              <Typography sx={{ color: '#8b5cf6', fontFamily: '"Courier New", monospace', fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>
                Norwegian Casting Brief
              </Typography>
            </Box>

            {blocks.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed rgba(148,163,184,0.25)', borderRadius: 2 }}>
                <Typography sx={{ color: 'rgba(203,213,225,0.6)', mb: 1 }}>Tom utgave</Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.45)', fontSize: '0.82rem' }}>
                  Klikk en blokk i venstre meny, eller "Førsteutkast" for AI-assistert oppstart.
                </Typography>
              </Box>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onUpdate={(patch) => updateBlock(block.id, patch)}
                      onDelete={() => deleteBlock(block.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </Box>
        </Box>

        {/* ── Høyre: settings + AI ── */}
        <Box sx={{ borderLeft: { md: '1px solid rgba(148,163,184,0.08)' }, p: 1.5, overflow: 'auto', bgcolor: 'rgba(2,6,23,0.4)' }}>
          {selectedId ? (
            <BlockSettings
              block={blocks.find((b) => b.id === selectedId)!}
              onUpdate={(patch) => updateBlock(selectedId, patch)}
              onRewrite={async (tone) => {
                const block = blocks.find((b) => b.id === selectedId);
                if (!block || (block.type !== 'text' && block.type !== 'header' && block.type !== 'quote')) return;
                const text = block.type === 'text' ? block.markdown : block.type === 'header' ? block.text : block.text;
                try {
                  const r = await newsletterAiApi.rewriteBlock(text, tone);
                  if (block.type === 'text') updateBlock(selectedId, { markdown: r.rewritten } as Partial<NewsletterBlock>);
                  else if (block.type === 'header') updateBlock(selectedId, { text: r.rewritten } as Partial<NewsletterBlock>);
                  else updateBlock(selectedId, { text: r.rewritten } as Partial<NewsletterBlock>);
                } catch (err) {
                  setAiError((err as Error).message);
                }
              }}
            />
          ) : (
            <Box sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.78rem', textAlign: 'center', py: 4 }}>
              Velg en blokk for innstillinger
            </Box>
          )}
        </Box>
      </Box>

      <AiAssistDialog
        kind={aiDialog}
        onClose={() => setAiDialog(null)}
        flattenedContent={flattenedText}
        title={title}
        subject={subject}
        onInsertBlocks={(newBlocks, newTitle) => {
          setBlocks(newBlocks);
          if (newTitle) onTitleChange(newTitle);
          setAiDialog(null);
        }}
        onPickSubject={(subj) => { onSubjectChange(subj); setAiDialog(null); }}
        onError={setAiError}
      />
    </Box>
  );
}

// ── Sortable wrapper rundt hver blokk ──────────────────────────────────

interface SortableBlockProps {
  block: NewsletterBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<NewsletterBlock>) => void;
  onDelete: () => void;
}

function SortableBlock({ block, isSelected, onSelect, onUpdate, onDelete }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={onSelect}
      sx={{
        position: 'relative',
        mb: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        border: `1px solid ${isSelected ? 'rgba(167,139,250,0.6)' : 'transparent'}`,
        bgcolor: isSelected ? 'rgba(139,92,246,0.06)' : 'transparent',
        cursor: 'pointer',
        '&:hover': { bgcolor: isSelected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)' },
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5, opacity: isSelected ? 1 : 0, transition: '0.15s', '.MuiBox-root:hover > &': { opacity: 1 } }}>
        <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab', p: 0.5 }}>
          <DragIndicatorIcon fontSize="small" sx={{ color: 'rgba(203,213,225,0.6)' }} />
        </IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }} sx={{ p: 0.5 }}>
          <DeleteIcon fontSize="small" sx={{ color: 'rgba(248,113,113,0.7)' }} />
        </IconButton>
      </Box>
      <BlockInlineEditor block={block} onUpdate={onUpdate} />
    </Box>
  );
}

// ── Inline-redigering for hver blokk-type ────────────────────────────

function BlockInlineEditor({ block, onUpdate }: { block: NewsletterBlock; onUpdate: (patch: Partial<NewsletterBlock>) => void }) {
  if (block.type === 'header') {
    const level = block.level ?? 2;
    const fontSize = level === 1 ? '1.8rem' : level === 2 ? '1.3rem' : '1.05rem';
    return (
      <TextField
        fullWidth
        variant="standard"
        value={block.text}
        onChange={(e) => onUpdate({ text: e.target.value } as Partial<NewsletterBlock>)}
        InputProps={{ disableUnderline: true, sx: { color: '#fff', fontWeight: 800, fontSize, lineHeight: 1.3 } }}
      />
    );
  }
  if (block.type === 'text') {
    return (
      <TextField
        fullWidth
        multiline
        minRows={2}
        variant="standard"
        value={block.markdown}
        onChange={(e) => onUpdate({ markdown: e.target.value } as Partial<NewsletterBlock>)}
        InputProps={{ disableUnderline: true, sx: { color: 'rgba(229,231,235,0.85)', fontSize: '0.95rem', lineHeight: 1.7 } }}
      />
    );
  }
  if (block.type === 'image') {
    return (
      <Stack spacing={1}>
        <TextField fullWidth size="small" placeholder="Bilde-URL" value={block.url} onChange={(e) => onUpdate({ url: e.target.value } as Partial<NewsletterBlock>)} />
        {block.url ? (
          <Box component="img" src={block.url} alt={block.alt ?? ''} sx={{ maxWidth: '100%', borderRadius: 1 }} />
        ) : (
          <Box sx={{ height: 120, border: '1px dashed rgba(148,163,184,0.25)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.78rem' }}>Bilde-URL …</Typography>
          </Box>
        )}
      </Stack>
    );
  }
  if (block.type === 'cta') {
    return (
      <Box sx={{ textAlign: block.align ?? 'center', py: 1 }}>
        <Box sx={{ display: 'inline-block', bgcolor: '#8b5cf6', borderRadius: 1, p: '8px 16px' }}>
          <TextField
            variant="standard"
            value={block.label}
            onChange={(e) => onUpdate({ label: e.target.value } as Partial<NewsletterBlock>)}
            InputProps={{ disableUnderline: true, sx: { color: '#fff', fontWeight: 700, fontSize: '0.92rem', minWidth: 100 } }}
          />
        </Box>
      </Box>
    );
  }
  if (block.type === 'quote') {
    return (
      <Box sx={{ borderLeft: '3px solid #8b5cf6', pl: 2 }}>
        <TextField
          fullWidth
          multiline
          variant="standard"
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value } as Partial<NewsletterBlock>)}
          InputProps={{ disableUnderline: true, sx: { color: 'rgba(229,231,235,0.85)', fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.6 } }}
        />
        <TextField
          fullWidth
          variant="standard"
          placeholder="— Attribusjon (valgfri)"
          value={block.attribution ?? ''}
          onChange={(e) => onUpdate({ attribution: e.target.value } as Partial<NewsletterBlock>)}
          InputProps={{ disableUnderline: true, sx: { color: 'rgba(203,213,225,0.6)', fontSize: '0.82rem', mt: 1 } }}
        />
      </Box>
    );
  }
  if (block.type === 'divider') {
    return <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.12)', my: 2 }} />;
  }
  return null;
}

// ── Innstillinger for valgt blokk ────────────────────────────────────

function BlockSettings({ block, onUpdate, onRewrite }: { block: NewsletterBlock; onUpdate: (patch: Partial<NewsletterBlock>) => void; onRewrite: (tone: 'shorter' | 'sharper' | 'friendlier' | 'stronger_hook') => Promise<void> }) {
  const [rewriting, setRewriting] = useState<string | null>(null);
  async function handleRewrite(tone: 'shorter' | 'sharper' | 'friendlier' | 'stronger_hook') {
    setRewriting(tone);
    try { await onRewrite(tone); } finally { setRewriting(null); }
  }
  return (
    <Stack spacing={1.5}>
      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {block.type}
      </Typography>

      {block.type === 'header' ? (
        <Box>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.72rem', mb: 0.5 }}>Heading-nivå</Typography>
          <ToggleButtonGroup
            value={block.level ?? 2}
            exclusive
            size="small"
            onChange={(_e, val) => val && onUpdate({ level: val } as Partial<NewsletterBlock>)}
          >
            <ToggleButton value={1}>H1</ToggleButton>
            <ToggleButton value={2}>H2</ToggleButton>
            <ToggleButton value={3}>H3</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      ) : null}

      {block.type === 'cta' ? (
        <Stack spacing={1}>
          <TextField size="small" label="Link-URL" value={block.url} onChange={(e) => onUpdate({ url: e.target.value } as Partial<NewsletterBlock>)} />
          <Select size="small" value={block.align ?? 'center'} onChange={(e) => onUpdate({ align: e.target.value as 'left' | 'center' | 'right' } as Partial<NewsletterBlock>)}>
            <MenuItem value="left">Justert venstre</MenuItem>
            <MenuItem value="center">Sentrert</MenuItem>
            <MenuItem value="right">Justert høyre</MenuItem>
          </Select>
        </Stack>
      ) : null}

      {block.type === 'image' ? (
        <Stack spacing={1}>
          <TextField size="small" label="Alt-tekst" value={block.alt ?? ''} onChange={(e) => onUpdate({ alt: e.target.value } as Partial<NewsletterBlock>)} />
          <TextField size="small" label="Bildetekst" value={block.caption ?? ''} onChange={(e) => onUpdate({ caption: e.target.value } as Partial<NewsletterBlock>)} />
        </Stack>
      ) : null}

      {(block.type === 'text' || block.type === 'header' || block.type === 'quote') ? (
        <Box>
          <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.75, mt: 1 }}>
            AI Rewrite
          </Typography>
          <Stack spacing={0.5}>
            {(['sharper', 'shorter', 'friendlier', 'stronger_hook'] as const).map((tone) => (
              <Button
                key={tone}
                size="small"
                variant="outlined"
                disabled={rewriting !== null}
                onClick={() => handleRewrite(tone)}
                startIcon={rewriting === tone ? <CircularProgress size={12} /> : <AutoAwesomeIcon fontSize="small" />}
                sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#c4b5fd', borderColor: 'rgba(148,163,184,0.18)', fontSize: '0.72rem', fontWeight: 600 }}
              >
                {tone === 'sharper' ? 'Skarpere' : tone === 'shorter' ? 'Kortere' : tone === 'friendlier' ? 'Vennligere' : 'Sterkere hook'}
              </Button>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

// ── AI Assist dialog (førsteutkast / subjects / score) ────────────────

interface AiAssistDialogProps {
  kind: null | 'first-draft' | 'subject-lines' | 'rewrite' | 'content-score';
  onClose: () => void;
  flattenedContent: string;
  title: string;
  subject: string;
  onInsertBlocks: (blocks: NewsletterBlock[], title?: string) => void;
  onPickSubject: (subject: string) => void;
  onError: (msg: string) => void;
}

function AiAssistDialog({ kind, onClose, flattenedContent, title, subject, onInsertBlocks, onPickSubject, onError }: AiAssistDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<NewsletterAiSubject[] | null>(null);
  const [score, setScore] = useState<NewsletterAiContentScore | null>(null);

  useEffect(() => {
    if (kind === null) { setPrompt(''); setSubjects(null); setScore(null); }
  }, [kind]);

  async function handleFirstDraft() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await newsletterAiApi.firstDraft(prompt);
      onInsertBlocks(r.blocks, r.title);
    } catch (err) {
      onError((err as Error).message);
    } finally { setLoading(false); }
  }
  async function handleSubjectLines() {
    setLoading(true);
    try {
      const r = await newsletterAiApi.subjectLines({ title, summary: flattenedContent });
      setSubjects(r.subjects);
    } catch (err) {
      onError((err as Error).message);
    } finally { setLoading(false); }
  }
  async function handleContentScore() {
    setLoading(true);
    try {
      const r = await newsletterAiApi.contentScore({ title, subject, content: flattenedContent });
      setScore(r);
    } catch (err) {
      onError((err as Error).message);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (kind === 'subject-lines') void handleSubjectLines();
    if (kind === 'content-score') void handleContentScore();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [kind]);

  return (
    <Dialog open={kind !== null} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeIcon sx={{ color: '#a78bfa' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {kind === 'first-draft' ? 'AI Førsteutkast' : kind === 'subject-lines' ? 'AI Subject lines' : kind === 'content-score' ? 'AI Content score' : 'AI Assist'}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 200 }}>
        {kind === 'first-draft' ? (
          <Stack spacing={1.5}>
            <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.85rem' }}>
              Lim inn en LinkedIn-post, voice-memo-utskrift eller punkter du vil briefen skal dekke. Claude lager en strukturert utgave.
            </Typography>
            <TextField multiline minRows={6} fullWidth value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Eks: 'Denne uka fikk vi 3 svindel-rapporter, Datatilsynet varslet om økt tilsyn på barneskuespillere, og Maria fra Mer Film delte at de bruker 7 dager på casting nå …'" />
          </Stack>
        ) : null}

        {kind === 'subject-lines' && subjects ? (
          <Stack spacing={1}>
            {subjects.map((s) => (
              <Box key={s.text} onClick={() => onPickSubject(s.text)} sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.18)', cursor: 'pointer', '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(139,92,246,0.08)' } }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>{s.text}</Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>{s.rationale}</Typography>
              </Box>
            ))}
          </Stack>
        ) : null}

        {kind === 'content-score' && score ? (
          <Stack spacing={1.5}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Typography sx={{ color: score.score >= 80 ? '#22c55e' : score.score >= 60 ? '#fbbf24' : '#ef4444', fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>{score.score}</Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem' }}>av 100</Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
              {Object.entries(score.breakdown).map(([k, v]) => (
                <Chip key={k} label={`${k}: ${v}`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.15)', color: '#cbd5e1', fontWeight: 600, fontSize: '0.7rem' }} />
              ))}
            </Stack>
            {score.strengths.length > 0 ? (
              <Box>
                <Typography sx={{ color: '#22c55e', fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}>✓ Styrker</Typography>
                <Stack spacing={0.25}>{score.strengths.map((s) => <Typography key={s} sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.82rem' }}>• {s}</Typography>)}</Stack>
              </Box>
            ) : null}
            {score.improvements.length > 0 ? (
              <Box>
                <Typography sx={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}>↑ Forbedringer</Typography>
                <Stack spacing={1}>
                  {score.improvements.map((imp) => (
                    <Box key={imp.issue} sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
                      <Typography sx={{ color: '#fde68a', fontWeight: 600, fontSize: '0.78rem' }}>{imp.issue}</Typography>
                      <Typography sx={{ color: 'rgba(229,231,235,0.7)', fontSize: '0.78rem', mt: 0.25 }}>→ {imp.suggestion}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Stack>
        ) : null}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Stack alignItems="center" spacing={1}>
              <CircularProgress size={24} sx={{ color: '#a78bfa' }} />
              <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>Claude tenker …</Typography>
            </Stack>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Lukk</Button>
        {kind === 'first-draft' ? (
          <Button onClick={handleFirstDraft} variant="contained" disabled={loading || !prompt.trim()} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
            Generer utkast
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

export default NewsletterBlockBuilder;
