// @ts-nocheck
/**
 * VisualPageBuilder - Drag-and-drop editor for Scroll Story pages.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignRight as FormatAlignRightIcon,
  GridOn as GridOnIcon,
  Image as ImageIcon,
  TextFields as TextFieldsIcon,
  Title as TitleIcon,
  VideoLibrary as VideoLibraryIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';
import type { ScrollStoryPage } from './useScrollStory';

type BlockType = 'heading' | 'paragraph' | 'image' | 'video' | 'section' | 'grid';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  styles: {
    fontSize?: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
  };
  mediaUrl?: string;
}

interface VisualPageBuilderProps {
  page: ScrollStoryPage;
  onUpdate: (updates: Partial<ScrollStoryPage>) => void;
  onAddMedia: () => void;
}

const LIBRARY = [
  {
    category: 'Typography',
    items: [
      { type: 'heading' as const, label: 'Heading', icon: <TitleIcon />, description: 'Add headline text' },
      { type: 'paragraph' as const, label: 'Paragraph', icon: <TextFieldsIcon />, description: 'Add body text' },
    ],
  },
  {
    category: 'Media',
    items: [
      { type: 'image' as const, label: 'Image', icon: <ImageIcon />, description: 'Add image block' },
      { type: 'video' as const, label: 'Video', icon: <VideoLibraryIcon />, description: 'Add video block' },
    ],
  },
  {
    category: 'Layout',
    items: [
      { type: 'section' as const, label: 'Section', icon: <ViewModuleIcon />, description: 'Add section container' },
      { type: 'grid' as const, label: 'Grid', icon: <GridOnIcon />, description: 'Add grid placeholder' },
    ],
  },
];

const makeId = () => `scroll-block-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const createBlock = (type: BlockType): Block => {
  if (type === 'heading') {
    return {
      id: makeId(),
      type,
      content: 'New Heading',
      styles: { fontSize: '42px', fontWeight: '700', textAlign: 'left', color: '#111827', margin: '0 0 12px 0' },
    };
  }

  if (type === 'paragraph') {
    return {
      id: makeId(),
      type,
      content: 'Write your story content here.',
      styles: { fontSize: '17px', textAlign: 'left', color: '#374151', margin: '0 0 14px 0' },
    };
  }

  if (type === 'image') {
    return {
      id: makeId(),
      type,
      content: 'Image block',
      mediaUrl: 'https://placehold.co/1200x600?text=Image',
      styles: { borderRadius: '12px', margin: '0 0 16px 0' },
    };
  }

  if (type === 'video') {
    return {
      id: makeId(),
      type,
      content: 'Video block',
      mediaUrl: '',
      styles: { borderRadius: '12px', margin: '0 0 16px 0' },
    };
  }

  if (type === 'section') {
    return {
      id: makeId(),
      type,
      content: 'Section container',
      styles: { backgroundColor: '#f9fafb', padding: '24px', borderRadius: '12px', margin: '0 0 16px 0' },
    };
  }

  return {
    id: makeId(),
    type,
    content: 'Grid layout',
    styles: { margin: '0 0 16px 0' },
  };
};

const stylesToSx = (styles: Block['styles']) => ({
  fontSize: styles.fontSize,
  fontWeight: styles.fontWeight,
  textAlign: styles.textAlign,
  color: styles.color,
  backgroundColor: styles.backgroundColor,
  padding: styles.padding,
  margin: styles.margin,
  borderRadius: styles.borderRadius,
});

function deriveBlocksFromPage(page: ScrollStoryPage): Block[] {
  const blocks: Block[] = [];

  blocks.push(createBlock('heading'));
  blocks[0].content = page.title || 'Story Title';

  blocks.push(createBlock('paragraph'));
  blocks[1].content = page.content || 'Start writing your story...';

  page.media.forEach((mediaItem) => {
    const type: BlockType = mediaItem.type === 'image' ? 'image' : mediaItem.type === 'video' ? 'video' : 'paragraph';
    const block = createBlock(type);
    if (type === 'paragraph') {
      block.content = mediaItem.url;
    } else {
      block.mediaUrl = mediaItem.url;
      block.content = `${mediaItem.type.toUpperCase()} block`;
    }
    blocks.push(block);
  });

  return blocks;
}

function toPageUpdates(blocks: Block[]): Partial<ScrollStoryPage> {
  const heading = blocks.find((block) => block.type === 'heading');
  const paragraphs = blocks.filter((block) => block.type === 'paragraph').map((block) => block.content.trim()).filter(Boolean);
  const media = blocks
    .filter((block) => (block.type === 'image' || block.type === 'video') && typeof block.mediaUrl === 'string' && block.mediaUrl.length > 0)
    .map((block) => ({
      type: block.type as 'image' | 'video' | 'audio',
      url: block.mediaUrl as string,
      thumbnail: block.type === 'image' ? block.mediaUrl : undefined,
    }));

  return {
    title: heading?.content || '',
    content: paragraphs.join('\n\n'),
    media,
  };
}

export default function VisualPageBuilder({ page, onUpdate, onAddMedia }: VisualPageBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => deriveBlocksFromPage(page));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [inspectorTab, setInspectorTab] = useState(0);

  const selectedBlock = useMemo(() => blocks.find((block) => block.id === selectedBlockId) || null, [blocks, selectedBlockId]);

  useEffect(() => {
    const nextBlocks = deriveBlocksFromPage(page);
    setBlocks(nextBlocks);
    setSelectedBlockId(nextBlocks[0]?.id ?? null);
  }, [page]);

  const emitUpdate = useCallback(
    (nextBlocks: Block[]) => {
      setBlocks(nextBlocks);
      onUpdate(toPageUpdates(nextBlocks));
    },
    [onUpdate],
  );

  const addBlock = useCallback(
    (type: BlockType) => {
      const block = createBlock(type);
      const next = [...blocks, block];
      emitUpdate(next);
      setSelectedBlockId(block.id);
    },
    [blocks, emitUpdate],
  );

  const updateBlock = useCallback(
    (blockId: string, updates: Partial<Block>) => {
      const next = blocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block));
      emitUpdate(next);
    },
    [blocks, emitUpdate],
  );

  const updateBlockStyle = useCallback(
    (blockId: string, key: keyof Block['styles'], value: string) => {
      const block = blocks.find((item) => item.id === blockId);
      if (!block) return;

      updateBlock(blockId, {
        styles: {
          ...block.styles,
          [key]: value,
        },
      });
    },
    [blocks, updateBlock],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      const next = blocks.filter((block) => block.id !== blockId);
      emitUpdate(next);
      if (selectedBlockId === blockId) {
        setSelectedBlockId(next[0]?.id ?? null);
      }
    },
    [blocks, emitUpdate, selectedBlockId],
  );

  const moveBlock = useCallback(
    (blockId: string, direction: 'up' | 'down') => {
      const index = blocks.findIndex((block) => block.id === blockId);
      if (index < 0) return;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= blocks.length) return;

      const next = [...blocks];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      emitUpdate(next);
    },
    [blocks, emitUpdate],
  );

  const onCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedType) return;
    addBlock(draggedType);
    setDraggedType(null);
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: 280,
          '& .MuiDrawer-paper': {
            width: 280,
            position: 'relative',
            borderRight: '1px solid #e5e7eb',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Components
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag or click to add blocks
          </Typography>
        </Box>
        <Divider />

        <List sx={{ overflowY: 'auto', flex: 1 }}>
          {LIBRARY.map((category) => (
            <Accordion key={category.category} defaultExpanded disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {category.category}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={0.5}>
                  {category.items.map((item) => (
                    <ListItem key={`${category.category}-${item.type}`} disablePadding>
                      <ListItemButton
                        draggable
                        onDragStart={() => setDraggedType(item.type)}
                        onClick={() => addBlock(item.type)}
                      >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} secondary={item.description} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </List>

        <Divider />
        <Box sx={{ p: 2 }}>
          <Button fullWidth variant="outlined" onClick={onAddMedia}>
            Open Media Picker
          </Button>
        </Box>
      </Drawer>

      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f3f4f6' }} onDrop={onCanvasDrop} onDragOver={(event) => event.preventDefault()}>
        <Box sx={{ p: 2 }}>
          <Paper sx={{ p: 2, minHeight: 560 }}>
            <Stack spacing={1.2}>
              {blocks.map((block, index) => (
                <Paper
                  key={block.id}
                  variant="outlined"
                  sx={{ p: 1.5, borderColor: selectedBlockId === block.id ? '#2563eb' : '#e5e7eb' }}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <DragIndicatorIcon fontSize="small" color="disabled" />
                    <Chip label={block.type} size="small" variant="outlined" />
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="small" disabled={index === 0} onClick={() => moveBlock(block.id, 'up')}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 'down')}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => deleteBlock(block.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Box sx={stylesToSx(block.styles)}>
                    {block.type === 'heading' ? <Typography variant="h4">{block.content}</Typography> : null}
                    {block.type === 'paragraph' ? <Typography>{block.content}</Typography> : null}
                    {block.type === 'image' ? (
                      <Box component="img" src={block.mediaUrl || 'https://placehold.co/1200x400?text=Image'} alt="Story media" sx={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 1.5 }} />
                    ) : null}
                    {block.type === 'video' ? (
                      <Box sx={{ width: '100%', height: 280, border: '1px dashed #9ca3af', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography color="text.secondary">{block.mediaUrl ? 'Video URL configured' : 'No video URL'}</Typography>
                      </Box>
                    ) : null}
                    {block.type === 'section' ? <Typography variant="subtitle1">{block.content}</Typography> : null}
                    {block.type === 'grid' ? (
                      <Grid container spacing={1}>
                        {Array.from({ length: 3 }).map((_, cell) => (
                          <Grid item xs={4} key={`${block.id}-cell-${cell}`}>
                            <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                              <Typography variant="caption">Cell {cell + 1}</Typography>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    ) : null}
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Drawer
        anchor="right"
        variant="permanent"
        sx={{
          width: 320,
          '& .MuiDrawer-paper': {
            width: 320,
            position: 'relative',
            borderLeft: '1px solid #e5e7eb',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Inspector
          </Typography>
        </Box>
        <Divider />

        <Tabs value={inspectorTab} onChange={(_, value) => setInspectorTab(value)}>
          <Tab label="Content" />
          <Tab label="Style" />
        </Tabs>

        <Divider />

        <Box sx={{ p: 2, overflowY: 'auto' }}>
          {selectedBlock ? (
            inspectorTab === 0 ? (
              <Stack spacing={2}>
                <TextField label="Block type" value={selectedBlock.type} size="small" fullWidth InputProps={{ readOnly: true }} />
                <TextField
                  label="Content"
                  value={selectedBlock.content}
                  onChange={(event) => updateBlock(selectedBlock.id, { content: event.target.value })}
                  size="small"
                  fullWidth
                  multiline
                  minRows={selectedBlock.type === 'paragraph' ? 4 : 2}
                />
                {(selectedBlock.type === 'image' || selectedBlock.type === 'video') ? (
                  <TextField
                    label="Media URL"
                    value={selectedBlock.mediaUrl || ''}
                    onChange={(event) => updateBlock(selectedBlock.id, { mediaUrl: event.target.value })}
                    size="small"
                    fullWidth
                  />
                ) : null}
              </Stack>
            ) : (
              <Stack spacing={2}>
                <TextField
                  label="Font size"
                  value={selectedBlock.styles.fontSize || '16px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'fontSize', event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Font weight"
                  value={selectedBlock.styles.fontWeight || '400'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'fontWeight', event.target.value)}
                  size="small"
                  fullWidth
                />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Text alignment
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={selectedBlock.styles.textAlign || 'left'}
                    onChange={(_, value) => {
                      if (!value) return;
                      updateBlockStyle(selectedBlock.id, 'textAlign', value);
                    }}
                  >
                    <ToggleButton value="left"><FormatAlignLeftIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="center"><FormatAlignCenterIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="right"><FormatAlignRightIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="justify"><FormatAlignJustifyIcon fontSize="small" /></ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <TextField
                  label="Text color"
                  type="color"
                  value={selectedBlock.styles.color || '#111827'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'color', event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Background"
                  type="color"
                  value={selectedBlock.styles.backgroundColor || '#ffffff'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'backgroundColor', event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Padding"
                  value={selectedBlock.styles.padding || '0px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'padding', event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Margin"
                  value={selectedBlock.styles.margin || '0px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'margin', event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Border radius"
                  value={selectedBlock.styles.borderRadius || '0px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'borderRadius', event.target.value)}
                  size="small"
                  fullWidth
                />
                {selectedBlock.type === 'grid' ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Grid density preview
                    </Typography>
                    <Slider value={3} min={2} max={6} step={1} disabled />
                  </Box>
                ) : null}
              </Stack>
            )
          ) : (
            <Typography color="text.secondary">Select a block to edit.</Typography>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
