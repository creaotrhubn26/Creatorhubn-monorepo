/**
 * VisualPageBuilder - Standalone No-Code Page Builder
 *
 * A reusable, framework-agnostic page builder that can be used for: * - ScrollStories
 * - Landing pages
 * - Email templates
 * - Marketing pages
 * - Blog posts
 * - Any content creation
 *
 * Features: * - 📦 Component library with drag-and-drop
 * - 🎨 Live canvas editing
 * - 🔧 Property inspector
 * - 📐 Grid-based layout system
 * - 💾 JSON export/import
 * - 🎯 Responsive design controls
 * - 🖱️ Inline editing
 */

import React, { useState, useCallback, DragEvent } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  IconButton,
  Divider,
  TextField,
  Stack,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Tabs,
  Tab,
  Slider,
  Switch,
  FormControlLabel,
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
  Add,
  Delete,
  DragIndicator,
  ContentCopy,
  ArrowUpward,
  ArrowDownward,
  Code,
  Devices,
  Palette,
  Edit,
} from '@mui/icons-material';

// Types
export interface PageBlock {
  id: string;
  type: | 'heading'
    | 'paragraph'
    | 'image'
    | 'video'
    | 'button'
    | 'spacer'
    | 'divider'
    | 'section'
    | 'grid'
    | 'columns';
  content?: string;
  styles?: BlockStyles;
  media?: MediaConfig;
  children?: PageBlock[];
  gridColumns?: number;
  columnCount?: number;
}

export interface BlockStyles {
  // Typography
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  letterSpacing?: string;
  textDecoration?: string;
  color?: string;

  // Spacing
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

  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;

  // Border
  border?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;

  // Layout
  width?: string;
  height?: string;
  maxWidth?: string;
  minHeight?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;

  // Effects
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

// Default component library
const DEFAULT_COMPONENTS: ComponentCategory[] = [
  {
    category: 'Typography',
    items: [
      { type: 'heading', icon: <Title />, label: 'Heading', description: 'Add heading text' },
      { type: 'paragraph', icon: <TextFields />, label: 'Paragraph', description: 'Add body text' },
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
    category: 'Layout',
    items: [
      { type: 'section', icon: <ViewModule />, label: 'Section', description: 'Add container' },
      { type: 'grid', icon: <Grid />, label: 'Grid', description: 'Add grid layout' },
      { type: 'columns', icon: <ViewColumn />, label: 'Columns', description: '2-column layout' },
    ],
  },
  {
    category: 'Elements',
    items: [
      { type: 'button', icon: <Add />, label: 'Button', description: 'Add button' },
      {
        type: 'spacer',
        icon: <div style={{ width: 16, height: 16, border: '2px dashed #ccc'}} />,
        label: 'Spacer',
        description: 'Add spacing' },
      {
        type: 'divider',
        icon: <div style={{ width: 16, height: 2, backgroundColor: '#ccc'}} />,
        label: 'Divider',
        description: 'Add divider line' },
    ],
  },
];

export default function VisualPageBuilder({
  initialData,
  onChange,
  onSave,
  enableMediaUpload = true,
  onMediaSelect,
  customComponents,
}: VisualPageBuilderProps) {
  const [data, setData] = useState<PageBuilderData>(
    initialData || {
      blocks: [],
      settings: {
        backgroundColor: '#ffffff',
        maxWidth: '1200px',
        padding: '32px' },
    },
  );

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState(0);

  const components = customComponents || DEFAULT_COMPONENTS;
  const selectedBlock = data.blocks.find((b) => b.id === selectedBlockId);

  // Update data and trigger onChange
  const updateData = useCallback(
    (newData: PageBuilderData) => {
      setData(newData);
      onChange?.(newData);
    },
    [onChange],
  );

  // Handle drag start from component library
  const handleDragStart = (e: DragEvent, type: string) => {
    setDraggedBlockType(type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop on canvas
  const handleDrop = (e: DragEvent, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedBlockType) return;

    const newBlock: PageBlock = {
      id: `block-${Date.now()}`,
      type: draggedBlockType as any,
      content: getDefaultContent(draggedBlockType),
      styles: getDefaultStyles(draggedBlockType),
    };

    const newBlocks = [...data.blocks];
    if (targetIndex !== undefined) {
      newBlocks.splice(targetIndex, 0, newBlock);
    } else {
      newBlocks.push(newBlock);
    }

    updateData({ ...data, blocks: newBlocks });
    setDraggedBlockType(null);
    setSelectedBlockId(newBlock.id);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  // Get default content for block type
  const getDefaultContent = (type: string): string => {
    const defaults: Record<string, string> = {
      heading: 'New Heading',
      paragraph: 'Start writing your content here. Click to edit.',
      button: 'Click Me',
      divider: '',
      spacer: '',
    };
    return defaults[type] || '';
  };

  // Get default styles for block type
  const getDefaultStyles = (type: string): BlockStyles => {
    const defaults: Record<string, BlockStyles> = {
      heading: {
        fontSize: '36px',
        fontWeight: 'bold',
        textAlign: 'left',
        color: '#000000',
        margin: '16px 0' },
      paragraph: {
        fontSize: '16px',
        lineHeight: '1.6',
        textAlign: 'left',
        color: '#333333',
        margin: '8px 0' },
      button: {
        fontSize: '16px',
        fontWeight: 600 ',
        color: '#ffffff',
        backgroundColor: '#2196f3',
        padding: '12px 24px',
        borderRadius: '4px',
        textAlign: 'center',
        display: 'inline-block' },
      image: {
        width: '100%',
        borderRadius: '8px',
        margin: '16px 0' },
      video: {
        width: '100%',
        borderRadius: '8px',
        margin: '16px 0' },
      section: {
        padding: '32px',
        margin: '16px 0',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px' },
      spacer: {
        height: '32px',
        margin: '0' },
      divider: {
        height: '1px',
        backgroundColor: '#e0e0e0',
        margin: '24px 0' },
    };
    return defaults[type] || {};
  };

  // Update block
  const updateBlock = useCallback(
    (blockId: string, updates: Partial<PageBlock>) => {
      const newBlocks = data.blocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block,
      );
      updateData({ ...data, blocks: newBlocks });
    },
    [data, updateData],
  );

  // Delete block
  const deleteBlock = useCallback(
    (blockId: string) => {
      const newBlocks = data.blocks.filter((b) => b.id !== blockId);
      updateData({ ...data, blocks: newBlocks });
      setSelectedBlockId(null);
    },
    [data, updateData],
  );

  // Duplicate block
  const duplicateBlock = useCallback(
    (blockId: string) => {
      const block = data.blocks.find((b) => b.id === blockId);
      if (!block) return;

      const newBlock: PageBlock = {
        ...block,
        id: `block-${Date.now()}`,
      };

      const index = data.blocks.findIndex((b) => b.id === blockId);
      const newBlocks = [...data.blocks];
      newBlocks.splice(index + 1, 0, newBlock);

      updateData({ ...data, blocks: newBlocks });
      setSelectedBlockId(newBlock.id);
    },
    [data, updateData],
  );

  // Move block up
  const moveBlockUp = useCallback(
    (blockId: string) => {
      const index = data.blocks.findIndex((b) => b.id === blockId);
      if (index <= 0) return;

      const newBlocks = [...data.blocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      updateData({ ...data, blocks: newBlocks });
    },
    [data, updateData],
  );

  // Move block down
  const moveBlockDown = useCallback(
    (blockId: string) => {
      const index = data.blocks.findIndex((b) => b.id === blockId);
      if (index < 0 || index >= data.blocks.length - 1) return;

      const newBlocks = [...data.blocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      updateData({ ...data, blocks: newBlocks });
    },
    [data, updateData],
  );

  // Update block style
  const updateBlockStyle = useCallback(
    (style: string, value: unknown) => {
      if (!selectedBlockId) return;

      const block = data.blocks.find((b) => b.id === selectedBlockId);
      if (!block) return;

      updateBlock(selectedBlockId, {
        styles: { ...block.styles, [style]: value },
      });
    },
    [selectedBlockId, data.blocks, updateBlock],
  );

  // Export to JSON
  const exportJSON = useCallback(() => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page-builder-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  // Get canvas width based on view mode
  const getCanvasWidth = () => {
    switch (viewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': default: return '100%';
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: '#fafafa' }}>
      {/* Left Sidebar - Component Library */}
      <Drawer
        variant="permanent"
        sx={{
          width: 280,
          flexShrink: 0, '& .MuiDrawer-paper': { width: 280,
            boxSizing: 'border-box',
            position: 'relative',
            borderRight: '1px solid #e0e0e0',
            backgroundColor: '#ffffff' }}}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600}}>
            Components
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Drag and drop to canvas
          </Typography>
        </Box>

        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {components.map((category, idx) => (
            <Accordion
              key={idx}
              defaultExpanded
              disableGutters
              elevation={0}
              sx={{ , '&:before': { display: 'none' } }}

            >
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                  {category.category}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense disablePadding>
                  {category.items.map((item, itemIdx) => (
                    <ListItem
                      key={itemIdx}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, item.type)}
                      sx={{
                        px: 2,
                        cursor: 'grab','&:hover': {
                          backgroundColor: '#f5f5f5' }, '&:active': {
                          cursor: 'grabbing',
                          backgroundColor: '#e0e0e0' }}}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: '#666'}}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        secondary={item.description}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500}}
                        secondaryTypographyProps={{ variant: 'caption' }} />
                      <DragIndicator sx={{ color: '#ccc', fontSize: 18 }} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Code />}
            onClick={exportJSON}
            size="small"
          >
            Export JSON
          </Button>
        </Box>
      </Drawer>

      {/* Center - Canvas */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Toolbar */}
        <Box sx={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff', px: 2, py: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              size="small"
            >
              <ToggleButton value="desktop">
                <Devices fontSize="small" />
              </ToggleButton>
              <ToggleButton value="tablet">
                <Box sx={{ fontSize: 20 }}>📱</Box>
              </ToggleButton>
              <ToggleButton value="mobile">
                <Box sx={{ fontSize: 16 }}>📱</Box>
              </ToggleButton>
            </ToggleButtonGroup>

            <Chip label={`${data.blocks.length} blocks`} size="small" />

            {onSave && (
              <Button
                variant="contained"
                size="small"
                onClick={() => onSave(data)}
                sx={{ ml: 'auto' }}>
                Save
              </Button>
            )}
          </Stack>
        </Box>

        {/* Canvas */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: '#f0f0f0',
            p: 3}}
          onDrop={(e) => handleDrop(e)}
          onDragOver={handleDragOver}
        >
          <Box sx={{ mx: 'auto', maxWidth: getCanvasWidth(), transition: 'max-width 0.3s' }}>
            <Paper
              elevation={3}
              sx={{
                p: data.settings.padding || '32px',
                minHeight: 600,
                backgroundColor: data.settings.backgroundColor || '#ffffff',
                maxWidth: data.settings.maxWidth || '1200px',
                mx: 'auto' }}>
              {data.blocks.length === 0 ? (
                <Box
                  sx={{
                    height: 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed #ddd',
                    borderRadius: 2,
                    color: 'text.secondary' }}>
                  <Stack alignItems="center" spacing={1}>
                    <Typography variant="h6">Drop components here</Typography>
                    <Typography variant="body2">
                      Drag from the left sidebar to start building
                    </Typography>
                  </Stack>
                </Box>
              ) : (
                data.blocks.map((block, index) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onUpdate={(updates) => updateBlock(block.id, updates)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onMoveUp={() => moveBlockUp(block.id)}
                    onMoveDown={() => moveBlockDown(block.id)}
                    isFirst={index === 0}
                    isLast={index === data.blocks.length - 1}
                    onMediaSelect={onMediaSelect}
                  />
                ))
              )}
            </Paper>
          </Box>
        </Box>
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
            backgroundColor: '#ffffff' }}}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6" sx={{ fontWeight: 600}}>
            {selectedBlock ? 'Block Properties' : 'Page Settings'}
          </Typography>
        </Box>

        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {selectedBlock ? (
            <BlockProperties
              block={selectedBlock}
              onUpdateStyle={updateBlockStyle}
              onUpdate={(updates) => updateBlock(selectedBlock.id, updates)}
            />
          ) : (
            <PageSettings
              settings={data.settings}
              onUpdate={(settings) => updateData({ ...data, settings })}
            />
          )}
        </Box>
      </Drawer>
    </Box>
  );
}

// Block Renderer Component
interface BlockRendererProps {
  block: PageBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<PageBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  onMediaSelect?: () => void;
}

function BlockRenderer({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onMediaSelect,
}: BlockRendererProps) {
  const blockStyles: React.CSSProperties = {
    ...block.styles,
    outline: isSelected ? '2px solid #2196f3' : '1px solid transparent',
    cursor: 'pointer',
    position: 'relative',
    transition: 'outline 0.2s' };

  return (
    <Box onClick={onSelect} sx={blockStyles}>
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: -36,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
            backgroundColor: '#2196f3',
            borderRadius: '4px 4px 0 0',
            padding: '4px 8px',
            zIndex: 1}}>
          <Chip
            label={block.type}
            size="small"
            sx={{
              color: 'white',
              backgroundColor: 'rgba(2, 5, 5,255,255,0.2)',
              fontSize: '11px',
              height: 24}} />

          <Box sx={{ flex: 1 }} />

          {!isFirst && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              sx={{ color: 'white', p: 0.5 }}>
              <ArrowUpward fontSize="small" />
            </IconButton>
          )}
          {!isLast && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              sx={{ color: 'white', p: 0.5 }}>
              <ArrowDownward fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            sx={{ color: 'white', p: 0.5 }}>
            <ContentCopy fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            sx={{ color: 'white', p: 0.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      )}

      {block.type === 'heading' && (
        <Typography
          variant="h3"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ content: e.currentTarget.textContent || ',' })}
          sx={{
            ...block.styles,
            outline: 'none','&:focus': {
              outline: 'none' }}}
        >
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
            ...block.styles,
            outline: 'none','&:focus': {
              outline: 'none' }}}
        >
          {block.content}
        </Typography>
      )}

      {block.type === 'button' && (
        <Button
          variant="contained"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ content: e.currentTarget.textContent || ', ' })}
          sx={{
            ...block.styles'&:focus': {
              outline: 'none' }}}
        >
          {block.content}
        </Button>
      )}

      {block.type === 'image' && (
        <Box
          component="img"
          src={block.media?.url || 'https://via.placeholder.com/800x400?text=Click+to+add+image'}
          alt={block.media?.alt || 'Image'}
          onClick={(e) => {
            e.stopPropagation();
            onMediaSelect?.();
          }}
          sx={{
            ...block.styles,
            cursor: 'pointer', '&:hover': {
              opacity: 0.8 }}}
        />
      )}

      {block.type === 'video' && (
        <Box
          component="video"
          src={block.media?.url}
          controls
          sx={{
            ...block.styles}} />
      )}

      {block.type === 'spacer' && (
        <Box sx={{ ...block.styles, backgroundColor: isSelected ? '#f0f0f0' : 'transparent' }} />
      )}

      {block.type === 'divider' && <Box sx={{ ...block.styles }} />}

      {block.type === 'section' && (
        <Box sx={{ ...block.styles }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Section Container
          </Typography>
        </Box>
      )}

      {block.type === 'grid' && (
        <Grid container spacing={2} sx={{ ...block.styles }}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={4} key={i}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>Grid Item {i}</Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {block.type === 'columns' && (
        <Grid container spacing={2} sx={{ ...block.styles }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>Column 1</Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>Column 2</Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

// Block Properties Inspector
interface BlockPropertiesProps {
  block: PageBlock;
  onUpdateStyle: (style: string, value: unknown) => void;
  onUpdate: (updates: Partial<PageBlock>) => void;
}

function BlockProperties({ block, onUpdateStyle, onUpdate }: BlockPropertiesProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Style" />
        <Tab label="Layout" />
      </Tabs>

      <Box sx={{ p: 2 }}>
        {activeTab === 0 && (
          <Stack spacing={3}>
            {/* Typography */}
            {(block.type === 'heading' ||
              block.type === 'paragraph' ||
              block.type === 'button') && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                  Typography
                </Typography>

                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Font Size</InputLabel>
                    <Select
                      value={block.styles?.fontSize || '16px'}
                      onChange={(e) => onUpdateStyle('fontSize', e.target.value)}
                    >
                      <MenuItem value="12px">12px</MenuItem>
                      <MenuItem value="14px">14px</MenuItem>
                      <MenuItem value="16px">16px</MenuItem>
                      <MenuItem value="18px">18px</MenuItem>
                      <MenuItem value="24px">24px</MenuItem>
                      <MenuItem value="32px">32px</MenuItem>
                      <MenuItem value="48px">48px</MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
                    <Typography variant="caption" display="block" gutterBottom>
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
                    label="Text Color"
                    type="color"
                    value={block.styles?.color || '#000000'}
                    onChange={(e) => onUpdateStyle('color', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
              </Box>
            )}

            {/* Background */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
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

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                Border & Radius
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Border Radius"
                  value={block.styles?.borderRadius || '0px'}
                  onChange={(e) => onUpdateStyle('borderRadius', e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., 8px"
                />
              </Stack>
            </Box>
          </Stack>
        )}

        {activeTab === 1 && (
          <Stack spacing={3}>
            {/* Spacing */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                Spacing
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Padding"
                  value={block.styles?.padding || '0px'}
                  onChange={(e) => onUpdateStyle('padding', e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., 16px, 1rem"
                />

                <TextField
                  label="Margin"
                  value={block.styles?.margin || '0px'}
                  onChange={(e) => onUpdateStyle('margin', e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., 8px 0"
                />
              </Stack>
            </Box>

            {/* Dimensions */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                Dimensions
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Width"
                  value={block.styles?.width || 'auto'}
                  onChange={(e) => onUpdateStyle('width', e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., 100%, 500px"
                />

                <TextField
                  label="Height"
                  value={block.styles?.height || 'auto'}
                  onChange={(e) => onUpdateStyle('height', e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., 400px, auto"
                />
              </Stack>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

// Page Settings
interface PageSettingsProps {
  settings: PageBuilderData['settings'];
  onUpdate: (settings: PageBuilderData['settings']) => void;
}

function PageSettings({ settings, onUpdate }: PageSettingsProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        <TextField
          label="Background Color"
          type="color"
          value={settings.backgroundColor || '#ffffff'}
          onChange={(e) => onUpdate({ ...settings, backgroundColor: e.target.value })}}
          fullWidth
          size="small"
        />

        <TextField
          label="Max Width"
          value={settings.maxWidth || '1200px'}
          onChange={(e) => onUpdate({ ...settings, maxWidth: e.target.value })}}
          fullWidth
          size="small"
          placeholder="e.g., 1200px, 100%"
        />

        <TextField
          label="Padding"
          value={settings.padding ||'32px'}
          onChange={(e) => onUpdate({ ...settings, padding: e.target.value })}}
          fullWidth
          size="small"
          placeholder="e.g., 32px, 2rem"
        />
      </Stack>
    </Box>
  );
}}
