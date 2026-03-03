import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Code as CodeIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Devices as DevicesIcon,
  DragIndicator as DragIndicatorIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignRight as FormatAlignRightIcon,
  GridOn as GridOnIcon,
  Image as ImageIcon,
  Palette as PaletteIcon,
  TextFields as TextFieldsIcon,
  Title as TitleIcon,
  VideoLibrary as VideoLibraryIcon,
  ViewColumn as ViewColumnIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';

export interface PageBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'button' | 'spacer' | 'divider' | 'section' | 'grid' | 'columns';
  content?: string;
  styles?: BlockStyles;
  media?: MediaConfig;
  children?: PageBlock[];
  gridColumns?: number;
  columnCount?: number;
}

export interface BlockStyles {
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  letterSpacing?: string;
  textDecoration?: string;
  color?: string;
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  border?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  minHeight?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  boxShadow?: string;
  opacity?: string;
  transform?: string;
  transition?: string;
}

export interface MediaConfig {
  url?: string;
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
}

export interface PageBuilderData {
  blocks: PageBlock[];
  settings: {
    backgroundColor?: string;
    maxWidth?: string;
    padding?: string;
  };
}

interface VisualPageBuilderProps {
  initialData?: PageBuilderData;
  onChange?: (data: PageBuilderData) => void;
  onSave?: (data: PageBuilderData) => void;
  enableMediaUpload?: boolean;
  onMediaSelect?: () => void;
  customComponents?: ComponentCategory[];
}

export interface ComponentCategory {
  category: string;
  items: ComponentItem[];
}

export interface ComponentItem {
  type: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

const DEFAULT_COMPONENTS: ComponentCategory[] = [
  {
    category: 'Typography',
    items: [
      { type: 'heading', icon: <TitleIcon />, label: 'Heading', description: 'Add heading text' },
      { type: 'paragraph', icon: <TextFieldsIcon />, label: 'Paragraph', description: 'Add body text' },
    ],
  },
  {
    category: 'Media',
    items: [
      { type: 'image', icon: <ImageIcon />, label: 'Image', description: 'Add image block' },
      { type: 'video', icon: <VideoLibraryIcon />, label: 'Video', description: 'Add video block' },
    ],
  },
  {
    category: 'Layout',
    items: [
      { type: 'section', icon: <ViewModuleIcon />, label: 'Section', description: 'Add container section' },
      { type: 'grid', icon: <GridOnIcon />, label: 'Grid', description: 'Add grid container' },
      { type: 'columns', icon: <ViewColumnIcon />, label: 'Columns', description: 'Add responsive columns' },
    ],
  },
  {
    category: 'Elements',
    items: [
      { type: 'button', icon: <AddIcon />, label: 'Button', description: 'Add CTA button' },
      { type: 'spacer', icon: <ViewColumnIcon />, label: 'Spacer', description: 'Add vertical spacing' },
      { type: 'divider', icon: <GridOnIcon />, label: 'Divider', description: 'Add divider line' },
    ],
  },
];

const DEFAULT_DATA: PageBuilderData = {
  blocks: [
    {
      id: 'block-1',
      type: 'heading',
      content: 'Page Title',
      styles: {
        fontSize: '42px',
        fontWeight: '700',
        textAlign: 'left',
        color: '#111827',
        margin: '0 0 16px 0',
      },
    },
    {
      id: 'block-2',
      type: 'paragraph',
      content: 'Start building your page by adding and editing blocks from the left panel.',
      styles: {
        fontSize: '18px',
        textAlign: 'left',
        color: '#374151',
      },
    },
  ],
  settings: {
    backgroundColor: '#ffffff',
    maxWidth: '1200px',
    padding: '32px',
  },
};

const makeId = () => `block-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const createDefaultBlock = (type: string): PageBlock => {
  switch (type) {
    case 'heading':
      return {
        id: makeId(),
        type: 'heading',
        content: 'New Heading',
        styles: {
          fontSize: '36px',
          fontWeight: '700',
          textAlign: 'left',
          color: '#111827',
          margin: '0 0 16px 0',
        },
      };
    case 'paragraph':
      return {
        id: makeId(),
        type: 'paragraph',
        content: 'Write your paragraph text here.',
        styles: {
          fontSize: '16px',
          textAlign: 'left',
          color: '#374151',
          margin: '0 0 12px 0',
        },
      };
    case 'image':
      return {
        id: makeId(),
        type: 'image',
        media: {
          url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&auto=format&fit=crop',
          alt: 'Default image',
          objectFit: 'cover',
          width: '100%',
          height: '320px',
        },
        styles: {
          borderRadius: '12px',
          margin: '0 0 16px 0',
        },
      };
    case 'video':
      return {
        id: makeId(),
        type: 'video',
        media: {
          url: '',
          width: '100%',
          height: '320px',
          objectFit: 'cover',
        },
        styles: {
          borderRadius: '12px',
          margin: '0 0 16px 0',
        },
      };
    case 'button':
      return {
        id: makeId(),
        type: 'button',
        content: 'Call To Action',
        styles: {
          display: 'inline-flex',
          padding: '12px 20px',
          backgroundColor: '#2563eb',
          color: '#ffffff',
          borderRadius: '10px',
          fontWeight: '600',
        },
      };
    case 'spacer':
      return {
        id: makeId(),
        type: 'spacer',
        styles: {
          height: '32px',
        },
      };
    case 'divider':
      return {
        id: makeId(),
        type: 'divider',
        styles: {
          border: 'none',
          borderTop: '1px solid #e5e7eb',
          margin: '16px 0',
        },
      };
    case 'section':
      return {
        id: makeId(),
        type: 'section',
        content: 'Section Container',
        styles: {
          padding: '24px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          margin: '0 0 16px 0',
        },
      };
    case 'grid':
      return {
        id: makeId(),
        type: 'grid',
        content: 'Grid Layout',
        gridColumns: 3,
        styles: {
          display: 'grid',
          gap: '12px',
          margin: '0 0 16px 0',
        },
      };
    case 'columns':
      return {
        id: makeId(),
        type: 'columns',
        content: 'Columns Layout',
        columnCount: 2,
        styles: {
          display: 'grid',
          gap: '16px',
          margin: '0 0 16px 0',
        },
      };
    default:
      return {
        id: makeId(),
        type: 'paragraph',
        content: 'New block',
      };
  }
};

function styleToSx(styles: BlockStyles | undefined): Record<string, string | number | undefined> {
  if (!styles) return {};

  const sx: Record<string, string | number | undefined> = {
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    fontFamily: styles.fontFamily,
    textAlign: styles.textAlign,
    lineHeight: styles.lineHeight,
    letterSpacing: styles.letterSpacing,
    textDecoration: styles.textDecoration,
    color: styles.color,
    padding: styles.padding,
    paddingTop: styles.paddingTop,
    paddingRight: styles.paddingRight,
    paddingBottom: styles.paddingBottom,
    paddingLeft: styles.paddingLeft,
    margin: styles.margin,
    marginTop: styles.marginTop,
    marginRight: styles.marginRight,
    marginBottom: styles.marginBottom,
    marginLeft: styles.marginLeft,
    backgroundColor: styles.backgroundColor,
    backgroundImage: styles.backgroundImage,
    backgroundSize: styles.backgroundSize,
    backgroundPosition: styles.backgroundPosition,
    border: styles.border,
    borderRadius: styles.borderRadius,
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderStyle: styles.borderStyle,
    width: styles.width,
    height: styles.height,
    maxWidth: styles.maxWidth,
    minHeight: styles.minHeight,
    display: styles.display,
    flexDirection: styles.flexDirection,
    justifyContent: styles.justifyContent,
    alignItems: styles.alignItems,
    gap: styles.gap,
    boxShadow: styles.boxShadow,
    opacity: styles.opacity,
    transform: styles.transform,
    transition: styles.transition,
  };

  return sx;
}

export default function VisualPageBuilder({
  initialData,
  onChange,
  onSave,
  enableMediaUpload = true,
  onMediaSelect,
  customComponents,
}: VisualPageBuilderProps) {
  const [data, setData] = useState<PageBuilderData>(initialData ?? DEFAULT_DATA);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(data.blocks[0]?.id ?? null);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState(0);
  const [showCodePreview, setShowCodePreview] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setData(initialData);
    setSelectedBlockId(initialData.blocks[0]?.id ?? null);
  }, [initialData]);

  const library = useMemo(() => (customComponents && customComponents.length > 0 ? customComponents : DEFAULT_COMPONENTS), [customComponents]);

  const selectedBlock = useMemo(
    () => data.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [data.blocks, selectedBlockId],
  );

  const emitChange = useCallback(
    (nextData: PageBuilderData) => {
      setData(nextData);
      if (onChange) {
        onChange(nextData);
      }
    },
    [onChange],
  );

  const addBlock = useCallback(
    (type: string) => {
      const newBlock = createDefaultBlock(type);
      const nextData: PageBuilderData = {
        ...data,
        blocks: [...data.blocks, newBlock],
      };
      emitChange(nextData);
      setSelectedBlockId(newBlock.id);
    },
    [data, emitChange],
  );

  const updateBlock = useCallback(
    (blockId: string, updates: Partial<PageBlock>) => {
      const nextData: PageBuilderData = {
        ...data,
        blocks: data.blocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block)),
      };
      emitChange(nextData);
    },
    [data, emitChange],
  );

  const updateBlockStyle = useCallback(
    (blockId: string, styleKey: keyof BlockStyles, value: string) => {
      const block = data.blocks.find((item) => item.id === blockId);
      if (!block) return;

      updateBlock(blockId, {
        styles: {
          ...block.styles,
          [styleKey]: value,
        },
      });
    },
    [data.blocks, updateBlock],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      const nextBlocks = data.blocks.filter((block) => block.id !== blockId);
      const nextData: PageBuilderData = {
        ...data,
        blocks: nextBlocks,
      };
      emitChange(nextData);
      if (selectedBlockId === blockId) {
        setSelectedBlockId(nextBlocks[0]?.id ?? null);
      }
    },
    [data, emitChange, selectedBlockId],
  );

  const moveBlock = useCallback(
    (blockId: string, direction: 'up' | 'down') => {
      const currentIndex = data.blocks.findIndex((block) => block.id === blockId);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= data.blocks.length) return;

      const nextBlocks = [...data.blocks];
      const [moved] = nextBlocks.splice(currentIndex, 1);
      nextBlocks.splice(targetIndex, 0, moved);

      emitChange({
        ...data,
        blocks: nextBlocks,
      });
    },
    [data, emitChange],
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      const block = data.blocks.find((item) => item.id === blockId);
      if (!block) return;

      const duplicate: PageBlock = {
        ...block,
        id: makeId(),
      };

      emitChange({
        ...data,
        blocks: [...data.blocks, duplicate],
      });
      setSelectedBlockId(duplicate.id);
    },
    [data, emitChange],
  );

  const updateSettings = (updates: Partial<PageBuilderData['settings']>) => {
    emitChange({
      ...data,
      settings: {
        ...data.settings,
        ...updates,
      },
    });
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedType) return;
    addBlock(draggedType);
    setDraggedType(null);
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleSave = () => {
    if (onSave) {
      onSave(data);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 160px)', minHeight: 640 }}>
      <Drawer
        variant="permanent"
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            position: 'relative',
            borderRight: '1px solid #e5e7eb',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Component Library
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag or click components to add blocks
          </Typography>
        </Box>
        <Divider />

        <List sx={{ overflowY: 'auto', flex: 1 }}>
          {library.map((category) => (
            <Accordion key={category.category} defaultExpanded disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {category.category}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Stack spacing={1}>
                  {category.items.map((item) => (
                    <ListItem key={`${category.category}-${item.type}`} disablePadding>
                      <ListItemButton
                        draggable
                        onDragStart={() => setDraggedType(item.type)}
                        onClick={() => addBlock(item.type)}
                        sx={{ borderRadius: 1.5 }}
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
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CodeIcon />}
              onClick={() => setShowCodePreview((prev) => !prev)}
            >
              {showCodePreview ? 'Canvas' : 'JSON'}
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f3f4f6' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb', bgcolor: '#fff' }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <DevicesIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Visual Canvas
              </Typography>
              <Chip size="small" label={`${data.blocks.length} blocks`} />
            </Stack>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addBlock('section')}>
              Add Section
            </Button>
          </Stack>
        </Box>

        {showCodePreview ? (
          <Box sx={{ p: 2 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Page JSON
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={28}
                value={JSON.stringify(data, null, 2)}
                InputProps={{ readOnly: true }}
              />
            </Paper>
          </Box>
        ) : (
          <Box
            sx={{
              p: 3,
              minHeight: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            <Paper
              sx={{
                width: '100%',
                maxWidth: data.settings.maxWidth || '1200px',
                minHeight: 580,
                backgroundColor: data.settings.backgroundColor || '#ffffff',
                p: data.settings.padding || '32px',
                borderRadius: 2,
              }}
            >
              {data.blocks.length === 0 ? (
                <Box
                  sx={{
                    minHeight: 260,
                    border: '2px dashed #d1d5db',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography color="text.secondary">Drop components here to start building.</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {data.blocks.map((block, index) => {
                    const isSelected = block.id === selectedBlockId;
                    return (
                      <Paper
                        key={block.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderColor: isSelected ? '#2563eb' : '#e5e7eb',
                          boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.15)' : 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedBlockId(block.id)}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <DragIndicatorIcon fontSize="small" color="disabled" />
                          <Chip label={block.type} size="small" variant="outlined" />
                          <Box sx={{ flex: 1 }} />
                          <Tooltip title="Move up">
                            <span>
                              <IconButton size="small" onClick={() => moveBlock(block.id, 'up')} disabled={index === 0}>
                                <ArrowUpwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Move down">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => moveBlock(block.id, 'down')}
                                disabled={index === data.blocks.length - 1}
                              >
                                <ArrowDownwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Duplicate">
                            <IconButton size="small" onClick={() => duplicateBlock(block.id)}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => deleteBlock(block.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>

                        <Box sx={styleToSx(block.styles)}>
                          {block.type === 'heading' && (
                            <Typography variant="h4">{block.content || 'Heading'}</Typography>
                          )}
                          {block.type === 'paragraph' && (
                            <Typography variant="body1">{block.content || 'Paragraph text'}</Typography>
                          )}
                          {block.type === 'image' && (
                            <Box
                              component="img"
                              src={block.media?.url || 'https://placehold.co/1200x400?text=Image'}
                              alt={block.media?.alt || 'Block image'}
                              sx={{
                                width: block.media?.width || '100%',
                                height: block.media?.height || '320px',
                                objectFit: block.media?.objectFit || 'cover',
                                borderRadius: block.styles?.borderRadius || '0px',
                              }}
                            />
                          )}
                          {block.type === 'video' && (
                            <Box
                              sx={{
                                width: block.media?.width || '100%',
                                height: block.media?.height || '320px',
                                borderRadius: block.styles?.borderRadius || '0px',
                                border: '1px dashed #9ca3af',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#6b7280',
                              }}
                            >
                              <Stack alignItems="center" spacing={1}>
                                <VideoLibraryIcon />
                                <Typography variant="body2">{block.media?.url ? 'Video URL set' : 'No video URL'}</Typography>
                              </Stack>
                            </Box>
                          )}
                          {block.type === 'button' && (
                            <Button variant="contained" disableElevation>
                              {block.content || 'Button'}
                            </Button>
                          )}
                          {block.type === 'spacer' && (
                            <Box sx={{ height: block.styles?.height || '24px', border: '1px dashed #d1d5db', borderRadius: 1 }} />
                          )}
                          {block.type === 'divider' && <Divider />}
                          {block.type === 'section' && (
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {block.content || 'Section'}
                            </Typography>
                          )}
                          {block.type === 'grid' && (
                            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${block.gridColumns || 3}, minmax(0, 1fr))`, gap: 1 }}>
                              {Array.from({ length: block.gridColumns || 3 }).map((_, slotIndex) => (
                                <Paper key={`${block.id}-slot-${slotIndex}`} variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                                  <Typography variant="caption">Grid Item {slotIndex + 1}</Typography>
                                </Paper>
                              ))}
                            </Box>
                          )}
                          {block.type === 'columns' && (
                            <Grid container spacing={1}>
                              {Array.from({ length: block.columnCount || 2 }).map((_, columnIndex) => (
                                <Grid item xs={12 / (block.columnCount || 2)} key={`${block.id}-column-${columnIndex}`}>
                                  <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                                    <Typography variant="caption">Column {columnIndex + 1}</Typography>
                                  </Paper>
                                </Grid>
                              ))}
                            </Grid>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Box>
        )}
      </Box>

      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: 340,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 340,
            boxSizing: 'border-box',
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

        <Tabs value={activeInspectorTab} onChange={(_, next) => setActiveInspectorTab(next)}>
          <Tab icon={<EditIcon />} iconPosition="start" label="Content" />
          <Tab icon={<PaletteIcon />} iconPosition="start" label="Style" />
          <Tab icon={<DevicesIcon />} iconPosition="start" label="Page" />
        </Tabs>

        <Divider />

        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          {activeInspectorTab === 0 ? (
            selectedBlock ? (
              <Stack spacing={2}>
                <TextField
                  label="Type"
                  value={selectedBlock.type}
                  InputProps={{ readOnly: true }}
                  size="small"
                  fullWidth
                />

                {(selectedBlock.type === 'heading' || selectedBlock.type === 'paragraph' || selectedBlock.type === 'button' || selectedBlock.type === 'section' || selectedBlock.type === 'grid' || selectedBlock.type === 'columns') && (
                  <TextField
                    label="Content"
                    value={selectedBlock.content || ''}
                    onChange={(event) => updateBlock(selectedBlock.id, { content: event.target.value })}
                    size="small"
                    fullWidth
                    multiline
                    minRows={selectedBlock.type === 'paragraph' ? 4 : 2}
                  />
                )}

                {(selectedBlock.type === 'image' || selectedBlock.type === 'video') && (
                  <Stack spacing={1.5}>
                    <TextField
                      label="Media URL"
                      value={selectedBlock.media?.url || ''}
                      onChange={(event) =>
                        updateBlock(selectedBlock.id, {
                          media: {
                            ...selectedBlock.media,
                            url: event.target.value,
                          },
                        })
                      }
                      size="small"
                      fullWidth
                    />
                    {selectedBlock.type === 'image' ? (
                      <TextField
                        label="Alt text"
                        value={selectedBlock.media?.alt || ''}
                        onChange={(event) =>
                          updateBlock(selectedBlock.id, {
                            media: {
                              ...selectedBlock.media,
                              alt: event.target.value,
                            },
                          })
                        }
                        size="small"
                        fullWidth
                      />
                    ) : null}

                    {enableMediaUpload && onMediaSelect ? (
                      <Button variant="outlined" onClick={onMediaSelect}>
                        Open Media Picker
                      </Button>
                    ) : null}
                  </Stack>
                )}

                {selectedBlock.type === 'grid' ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Grid columns
                    </Typography>
                    <Slider
                      value={selectedBlock.gridColumns || 3}
                      min={1}
                      max={6}
                      step={1}
                      onChange={(_, value) =>
                        updateBlock(selectedBlock.id, { gridColumns: Array.isArray(value) ? value[0] : value })
                      }
                    />
                  </Box>
                ) : null}

                {selectedBlock.type === 'columns' ? (
                  <FormControl fullWidth size="small">
                    <InputLabel id="column-count-label">Columns</InputLabel>
                    <Select
                      labelId="column-count-label"
                      label="Columns"
                      value={selectedBlock.columnCount || 2}
                      onChange={(event) => updateBlock(selectedBlock.id, { columnCount: Number(event.target.value) })}
                    >
                      <MenuItem value={2}>2</MenuItem>
                      <MenuItem value={3}>3</MenuItem>
                      <MenuItem value={4}>4</MenuItem>
                    </Select>
                  </FormControl>
                ) : null}
              </Stack>
            ) : (
              <Typography color="text.secondary">Select a block to edit content.</Typography>
            )
          ) : null}

          {activeInspectorTab === 1 ? (
            selectedBlock ? (
              <Stack spacing={2}>
                <TextField
                  label="Font Size"
                  value={selectedBlock.styles?.fontSize || '16px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'fontSize', event.target.value)}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Font Weight"
                  value={selectedBlock.styles?.fontWeight || '400'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'fontWeight', event.target.value)}
                  size="small"
                  fullWidth
                />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Text alignment
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={selectedBlock.styles?.textAlign || 'left'}
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
                  label="Text Color"
                  type="color"
                  value={selectedBlock.styles?.color || '#111827'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'color', event.target.value)}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Background Color"
                  type="color"
                  value={selectedBlock.styles?.backgroundColor || '#ffffff'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'backgroundColor', event.target.value)}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Padding"
                  value={selectedBlock.styles?.padding || '0px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'padding', event.target.value)}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Margin"
                  value={selectedBlock.styles?.margin || '0px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'margin', event.target.value)}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Border Radius"
                  value={selectedBlock.styles?.borderRadius || '0px'}
                  onChange={(event) => updateBlockStyle(selectedBlock.id, 'borderRadius', event.target.value)}
                  size="small"
                  fullWidth
                />
              </Stack>
            ) : (
              <Typography color="text.secondary">Select a block to edit style.</Typography>
            )
          ) : null}

          {activeInspectorTab === 2 ? (
            <Stack spacing={2}>
              <TextField
                label="Background Color"
                type="color"
                value={data.settings.backgroundColor || '#ffffff'}
                onChange={(event) => updateSettings({ backgroundColor: event.target.value })}
                size="small"
                fullWidth
              />

              <TextField
                label="Max Width"
                value={data.settings.maxWidth || '1200px'}
                onChange={(event) => updateSettings({ maxWidth: event.target.value })}
                size="small"
                fullWidth
                placeholder="e.g. 1200px"
              />

              <TextField
                label="Canvas Padding"
                value={data.settings.padding || '32px'}
                onChange={(event) => updateSettings({ padding: event.target.value })}
                size="small"
                fullWidth
                placeholder="e.g. 32px"
              />

              <FormControlLabel
                control={<Switch checked={showCodePreview} onChange={(event) => setShowCodePreview(event.target.checked)} />}
                label="Show JSON preview"
              />
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </Box>
  );
}
