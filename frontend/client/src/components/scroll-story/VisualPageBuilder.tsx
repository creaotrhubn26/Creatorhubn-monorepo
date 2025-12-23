/**
 * VisualPageBuilder - Drag-and-Drop No-Code Page Builder
 *
 * Design inspired by modern website builders like Framer, Webflow
 * Features: * - 📦 Component library sidebar
 * - 🎨 Live canvas editing
 * - 🔧 Property inspector
 * - 📐 Grid-based layout system
 * - 🖱️ Drag and drop blocks
 * - 👁️ Real-time preview
 */

import React, { useState, useCallback, DragEvent } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  IconButton,
  Divider,
  TextField,
  Stack,
  Button,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardMedia,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
} from '@mui/material';
import {
  ExpandMore,
  Title,
  TextFields,
  Image,
  VideoLibrary,
  GridOn,
  ViewColumn,
  ViewModule,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  Add,
  Delete,
  DragIndicator,
  Settings,
  Palette,
  Edit,
} from '@mui/icons-material';
import type { ScrollStoryPage } from './useScrollStory';

interface Block {
  id: string;
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'grid' | 'section';
  content?: string;
  styles?: {
    fontSize?: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
  };
  media?: {
    url?: string;
    alt?: string;
    width?: string;
    height?: string;
  };
  children?: Block[];
  gridColumns?: number;
}

interface VisualPageBuilderProps {
  page: ScrollStoryPage;
  onUpdate: (updates: Partial<ScrollStoryPage>) => void;
  onAddMedia: () => void;
}

const COMPONENT_LIBRARY = [
  {
    category: 'Typography',
    items: [
      { type: 'heading', icon: <Title />, label: 'Heading', description: 'Add heading' },
      {
        type: 'paragraph',
        icon: <TextFields />,
        label: 'Paragraph',
        description: 'Add text block',
      },
    ],
  },
  {
    category: 'Media',
    items: [
      { type: 'image', icon: <Image />, label: 'Image', description: 'Add image' },
      { type: 'video', icon: <VideoLibrary />, label: 'Video', description: 'Add video' },
    ],
  },
  {
    category: 'Layouts',
    items: [
      { type: 'section', icon: <ViewModule />, label: 'Section', description: 'Add section' },
      { type: 'grid', icon: <Grid />, label: 'Grid', description: 'Add grid layout' },
      { type: 'columns', icon: <ViewColumn />, label: 'Columns', description: 'Add columns' },
    ],
  },
];

export default function VisualPageBuilder({ page, onUpdate, onAddMedia }: VisualPageBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>([
    {
      id: 'block-1',
      type: 'heading',
      content: page.title || 'Your Story Title',
      styles: {
        fontSize: '48px',
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#000000',
      },
    },
    {
      id: 'block-2',
      type: 'paragraph',
      content: page.content || 'Start writing your story here...',
      styles: {
        fontSize: '18px',
        textAlign: 'left',
        color: '#333333',
      },
    },
  ]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  // Handle drag start from component library
  const handleDragStart = (e: DragEvent, type: string) => {
    setDraggedBlockType(type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop on canvas
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!draggedBlockType) return;

    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type: draggedBlockType as any,
      content: getDefaultContent(draggedBlockType),
      styles: getDefaultStyles(draggedBlockType),
    };

    setBlocks((prev) => [...prev, newBlock]);
    setDraggedBlockType(null);
    setSelectedBlockId(newBlock.id);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  // Get default content for block type
  const getDefaultContent = (type: string): string => {
    switch (type) {
      case 'heading': return 'New Heading';
      case 'paragraph': return 'Start writing your content here...';
      default: return '';
    }
  };

  // Get default styles for block type
  const getDefaultStyles = (type: string) => {
    switch (type) {
      case 'heading': return {
          fontSize: '36px',
          fontWeight: 'bold',
          textAlign: 'left' as const,
          color: '#000000',
        };
      case 'paragraph': return {
          fontSize: '16px',
          textAlign: 'left' as const,
          color: '#333333',
        };
      case 'image': return {
          borderRadius: '8px',
        };
      default: return {};
    }
  };

  // Update block
  const updateBlock = (blockId: string, updates: Partial<Block>) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, ...updates } : block)),
    );

    // Update page content
    const content = blocks.map((b) => b.content).join('\n\n');
    onUpdate({ content });
  };

  // Delete block
  const deleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setSelectedBlockId(null);
  };

  // Update block style
  const updateBlockStyle = (style: string, value: unknown) => {
    if (!selectedBlockId) return;

    const block = blocks.find((b) => b.id === selectedBlockId);
    if (!block) return;

    updateBlock(selectedBlockId, {
      styles: { ...block.styles, [style]: value },
    });
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
      {/* Left Sidebar - Component Library */}
      <Drawer
        variant="permanent"
        sx={{
          width: 280,
          flexShrink: 0, '& .MuiDrawer-paper': { width: 280,
            boxSizing: 'border-box',
            position: 'relative',
            borderRight: '1px solid #e0e0e0',
          }}}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Components
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Drag and drop to add
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {COMPONENT_LIBRARY.map((category, idx) => (
            <Accordion key={idx} defaultExpanded disableGutters elevation={0}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2">{category.category}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense>
                  {category.items.map((item, itemIdx) => (
                    <ListItem
                      key={itemIdx}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, item.type)}
                      sx={{
                        cursor: 'grab', '&:hover': {
                          backgroundColor: '#f5f5f5',
                        }, '&:active': {
                          cursor: 'grabbing',
                        }}}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        secondary={item.description}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }} />
                      <DragIndicator sx={{ color: 'text.disabled' }} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>

      {/* Center - Canvas */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f8f9fa',
          p: 3}}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Paper
          elevation={3}
          sx={{
            maxWidth: 1000,
            mx: 'auto',
            p: 4,
            minHeight: 600,
            backgroundColor: page.backgroundColor || '#ffffff'}}>
          {blocks.length === 0 ? (
            <Box
              sx={{
                height: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #ddd',
                borderRadius: 2}}>
              <Typography variant="body1" color="text.secondary">
                Drag components here to start building
              </Typography>
            </Box>
          ) : (
            blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => setSelectedBlockId(block.id)}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onDelete={() => deleteBlock(block.id)}
              />
            ))
          )}
        </Paper>
      </Box>

      {/* Right Sidebar - Properties Inspector */}
      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: 320,
          flexShrink: 0, '& .MuiDrawer-paper': { width: 320,
            boxSizing: 'border-box',
            position: 'relative',
            borderLeft: '1px solid #e0e0e0',
          }}}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {selectedBlock ? 'Properties' : 'Page Settings'}
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
          {selectedBlock ? (
            <BlockProperties
              block={selectedBlock}
              onUpdateStyle={updateBlockStyle}
              onUpdate={(updates) => updateBlock(selectedBlock.id, updates)}
            />
          ) : (
            <PageProperties page={page} onUpdate={onUpdate} onAddMedia={onAddMedia} />
          )}
        </Box>
      </Drawer>
    </Box>
  );
}

// Block Renderer Component
interface BlockRendererProps {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Block>) => void;
  onDelete: () => void;
}

function BlockRenderer({ block, isSelected, onSelect, onUpdate, onDelete }: BlockRendererProps) {
  const blockStyles = {
    ...block.styles,
    outline: isSelected ? '2px solid #2196f3' : 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    padding: block.styles?.padding || '16px',
    margin: block.styles?.margin || '8px 0',
    borderRadius: block.styles?.borderRadius || '0px',
    backgroundColor: block.styles?.backgroundColor,
  };

  return (
    <Box onClick={onSelect} sx={blockStyles}>
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: -32,
            right: 0,
            display: 'flex',
            gap: 0.5
            backgroundColor: '#2196f3',
            borderRadius: '4px 4px 0 0',
            padding: '4px'}}>
          <Chip
            label={block.type}
            size="small"
            sx={{ color: 'white', backgroundColor: 'transparent', fontSize: '11px' }} />
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            sx={{ color: 'white' }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      )}

      {block.type === 'heading' && (
        <Typography
          variant="h3"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ content: e.currentTarget.textContent || ', ' })}
          sx={{
            fontSize: block.styles?.fontSize,
            fontWeight: lock.styles?.fontWeight,
            textAlign: block.styles?.textAlign,
            color: block.styles?.color,
            outline: 'none'}}>
          {block.content}
        </Typography>
      )}

      {block.type === 'paragraph' && (
        <Typography
          variant="body1"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ content: e.currentTarget.textContent || ', ' })}
          sx={{
            fontSize: block.styles?.fontSize,
            textAlign: block.styles?.textAlign,
            color: block.styles?.color,
            outline: 'none'}}>
          {block.content}
        </Typography>
      )}

      {block.type === 'image' && (
        <Box
          component="img"
          src={block.media?.url || 'https://via.placeholder.com/600x400?text=Click+to+add+image'}
          alt={block.media?.alt || 'Image'}
          sx={{
            width: block.media?.width || '100%',
            height: block.media?.height || 'auto',
            borderRadius: block.styles?.borderRadius}} />
      )}

      {block.type === 'grid' && (
        <Grid container spacing={2}>
          {block.children?.map((child) => (
            <Grid item xs={12} md={12 / (block.gridColumns || 2)} key={child.id}>
              <Paper sx={{ p: 2 }}>
                <Typography>Grid Item</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

// Block Properties Inspector
interface BlockPropertiesProps {
  block: Block;
  onUpdateStyle: (style: string, value: unknown) => void;
  onUpdate: (updates: Partial<Block>) => void;
}

function BlockProperties({ block, onUpdateStyle, onUpdate }: BlockPropertiesProps) {
  return (
    <Stack spacing={3}>
      {/* Typography Controls */}
      {(block.type === 'heading' || block.type === 'paragraph') && (
        <>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Typography
            </Typography>

            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Font Size</InputLabel>
                <Select
                  value={block.styles?.fontSize || '16px'}
                  onChange={(e) => onUpdateStyle('fontSize', e.target.value)}
                >
                  <MenuItem value="14px">14px</MenuItem>
                  <MenuItem value="16px">16px</MenuItem>
                  <MenuItem value="18px">18px</MenuItem>
                  <MenuItem value="24px">24px</MenuItem>
                  <MenuItem value="32px">32px</MenuItem>
                  <MenuItem value="48px">48px</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography variant="caption" gutterBottom display="block">
                  Text Align
                </Typography>
                <ToggleButtonGroup
                  value={block.styles?.textAlign || 'left'}
                  exclusive
                  onChange={(_, value) => value && onUpdateStyle('textAlign', value)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="left">
                    <FormatAlignLeft />
                  </ToggleButton>
                  <ToggleButton value="center">
                    <FormatAlignCenter />
                  </ToggleButton>
                  <ToggleButton value="right">
                    <FormatAlignRight />
                  </ToggleButton>
                  <ToggleButton value="justify">
                    <FormatAlignJustify />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <TextField
                label="Color"
                type="color"
                value={block.styles?.color || '#000000'}
                onChange={(e) => onUpdateStyle('color', e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
          </Box>

          <Divider />
        </>
      )}

      {/* Spacing */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Spacing
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Padding"
            value={block.styles?.padding || '16px'}
            onChange={(e) => onUpdateStyle('padding', e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g., 16px, 1rem"
          />

          <TextField
            label="Margin"
            value={block.styles?.margin || '8px 0'}
            onChange={(e) => onUpdateStyle('margin', e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g., 8px 0, 1rem"
          />
        </Stack>
      </Box>

      <Divider />

      {/* Backgrounds */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Background
        </Typography>

        <TextField
          label="Background Color"
          type="color"
          value={block.styles?.backgroundColor || '#ffffff'}
          onChange={(e) => onUpdateStyle('backgroundColor', e.target.value)}
          size="small"
          fullWidth
        />
      </Box>

      <Divider />

      {/* Border Radius */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Border Radius
        </Typography>

        <TextField
          label="Border Radius"
          value={block.styles?.borderRadius || '0px'}
          onChange={(e) => onUpdateStyle('borderRadius', e.target.value)}
          size="small"
          fullWidth
          placeholder="e.g., 8px, 1rem"
        />
      </Box>
    </Stack>
  );
}}

// Page Properties
interface PagePropertiesProps {
  page: ScrollStoryPage;
  onUpdate: (updates: Partial<ScrollStoryPage>) => void;
  onAddMedia: () => void;
}

function PageProperties({ page, onUpdate, onAddMedia }: PagePropertiesProps) {
  return (
    <Stack spacing={3}>
      <TextField
        label="Page Title"
        value={page.title || ''}
        onChange={(e) => onUpdate({ title: e.target.value })}}
        fullWidth
        size="small"
      />

      <TextField
        label="Background Color"
        type="color"
        value={page.backgroundColor || '#ffffff'}
        onChange={(e) => onUpdate({ backgroundColor: e.target.value })}}
        fullWidth
        size="small"
      />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Layout
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={page.layout ||'centered'}
            onChange={(e) => onUpdate({ layout: e.target.value as any })}}
          >
            <MenuItem value="centered">Centered</MenuItem>
            <MenuItem value="left">Left Aligned</MenuItem>
            <MenuItem value="right">Right Aligned</MenuItem>
            <MenuItem value="full">Full Width</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Button variant="outlined" startIcon={<Add />} onClick={onAddMedia} fullWidth>
        Add Media from Drive
      </Button>
    </Stack>
  );
}
