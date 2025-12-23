/**
 * LayoutComposer Component
 * Provides layout composition tools: grid overlay, templates, positioning, and alignment
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Paper,
  Stack,
} from '@mui/material';
import {
  GridOn,
  GridOff,
  ViewModule,
  ViewQuilt,
  ViewStream,
  ViewColumn,
  DashboardCustomize,
  ContentCopy,
  CheckCircle,
} from '@mui/icons-material';
import { useVisualEditor } from './VisualEditorContext';

// Local type definitions
interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  structure: {
    rows: number;
    columns: number;
    areas: Array<{ name: string; startRow: number; endRow: number; startCol: number; endCol: number }>;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  metadata?: Record<string, any>;
}

// Local grid state management
interface GridState {
  visible: boolean;
  columns: number;
  snapToGrid: boolean;
  breakpoints: Record<string, number>;
}

export const LayoutComposer: React.FC = () => {
  const { state, dispatch } = useVisualEditor();

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [layoutTemplates, setLayoutTemplates] = useState<LayoutTemplate[]>([]);
  
  // Local grid state since context doesn't provide it
  const [gridSystem, setGridSystem] = useState<GridState>({
    visible: true,
    columns: 12,
    snapToGrid: true,
    breakpoints: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 }
  });
  
  // Local spacing scale
  const spacingScale: Record<string, number> = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  };
  
  // Grid config setters
  const setGridConfig = (config: Partial<GridState>) => {
    setGridSystem(prev => ({ ...prev, ...config }));
  };
  
  const toggleGridVisibility = () => {
    setGridSystem(prev => ({ ...prev, visible: !prev.visible }));
  };
  
  const addLayoutTemplate = (template: Omit<LayoutTemplate, 'id' | 'metadata'>): LayoutTemplate => {
    const newTemplate: LayoutTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      metadata: { createdAt: new Date().toISOString() }
    };
    setLayoutTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  };

  // Predefined layout templates
  const builtInTemplates: Array<Omit<LayoutTemplate, 'id' | 'metadata'>> = [
    {
      name: 'Hero Section',
      description: 'Full-width hero with centered content',
      category: 'hero',
      structure: {
        rows: 1,
        columns: 1,
        areas: [{ name: 'hero', startRow: 1, endRow: 2, startCol: 1, endCol: 2 }],
      },
      spacing: { xs: 16, sm: 24, md: 32, lg: 48, xl: 64 },
    },
    {
      name: 'Card Grid (3 columns)',
      description: '3-column responsive card grid',
      category: 'grid',
      structure: {
        rows: 2,
        columns: 3,
        areas: [
          { name: 'card1', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
          { name: 'card2', startRow: 1, endRow: 2, startCol: 2, endCol: 3 },
          { name: 'card3', startRow: 1, endRow: 2, startCol: 3, endCol: 4 },
        ],
      },
      spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
    },
    {
      name: 'Timeline Vertical',
      description: 'Vertical timeline layout',
      category: 'timeline',
      structure: {
        rows: 4,
        columns: 2,
        areas: [
          { name: 'timeline-left-1', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
          { name: 'timeline-right-1', startRow: 2, endRow: 3, startCol: 2, endCol: 3 },
          { name: 'timeline-left-2', startRow: 3, endRow: 4, startCol: 1, endCol: 2 },
          { name: 'timeline-right-2', startRow: 4, endRow: 5, startCol: 2, endCol: 3 },
        ],
      },
      spacing: { xs: 12, sm: 16, md: 24, lg: 32, xl: 40 },
    },
    {
      name: 'Sidebar Left',
      description: 'Left sidebar with main content area',
      category: 'sidebar',
      structure: {
        rows: 1,
        columns: 4,
        areas: [
          { name: 'sidebar', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
          { name: 'main', startRow: 1, endRow: 2, startCol: 2, endCol: 5 },
        ],
      },
      spacing: { xs: 8, sm: 16, md: 24, lg: 32, xl: 40 },
    },
    {
      name: 'Split Screen',
      description: 'Equal 50/50 split layout',
      category: 'split',
      structure: {
        rows: 1,
        columns: 2,
        areas: [
          { name: 'left', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
          { name: 'right', startRow: 1, endRow: 2, startCol: 2, endCol: 3 },
        ],
      },
      spacing: { xs: 16, sm: 24, md: 32, lg: 40, xl: 48 },
    },
  ];

  const handleApplyTemplate = (template: Omit<LayoutTemplate, 'id' | 'metadata'>) => {
    const newTemplate = addLayoutTemplate(template);
    setSelectedTemplate(newTemplate.id);
  };

  const handleGridColumnsChange = (_event: Event, value: number | number[]) => {
    setGridConfig({ columns: value as number });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hero': return <ViewQuilt />;
      case 'grid': return <ViewModule />;
      case 'timeline': return <ViewStream />;
      case 'sidebar': return <ViewColumn />;
      case 'split': return <DashboardCustomize />;
      default: return <ViewModule />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardCustomize /> Layout Composer
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Configure grid system, apply layout templates, and manage positioning
        </Typography>
      </Box>

      {/* Grid System Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {gridSystem.visible ? <GridOn color="primary" /> : <GridOff />}
              Grid System
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={gridSystem.visible}
                  onChange={() => toggleGridVisibility()}
                  color="primary"
                />
              }
              label="Show Grid"
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Grid Columns */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              Grid Columns: {gridSystem.columns}
            </Typography>
            <Slider
              value={gridSystem.columns}
              onChange={handleGridColumnsChange}
              min={1}
              max={24}
              step={1}
              marks={[
                { value: 4, label: '4' },
                { value: 8, label: '8' },
                { value: 12, label: '12' },
                { value: 16, label: '16' },
                { value: 24, label: '24' },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Snap to Grid */}
          <FormControlLabel
            control={
              <Switch
                checked={gridSystem.snapToGrid}
                onChange={(e) => setGridConfig({ snapToGrid: e.target.checked })}
                color="primary"
              />
            }
            label="Snap to Grid"
          />

          {/* Alignment Guides */}
          <FormControlLabel
            control={
              <Switch
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                color="primary"
              />
            }
            label="Show Alignment Guides"
          />
        </CardContent>
      </Card>

      {/* Layout Templates */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewModule /> Layout Templates
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Choose a predefined layout template to get started quickly
          </Typography>

          <Grid container spacing={2}>
            {builtInTemplates.map((template, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: 2,
                    borderColor: selectedTemplate === template.name ? 'primary.main' : 'transparent',
                    '&:hover': {
                      borderColor: 'primary.light',
                      bgcolor: 'action.hover',
                    },
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleApplyTemplate(template)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getCategoryIcon(template.category)}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {template.name}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ display: 'block', mb: 1 }}>
                    {template.description}
                  </Typography>
                  <Chip
                    label={template.category}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ textTransform: 'capitalize' }} />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Spacing Scale Reference */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Spacing Scale
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Use consistent spacing values across your layout
          </Typography>

          <Stack spacing={1}>
            {Object.entries(spacingScale).map(([size, value]) => (
              <Box
                key={size}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}>
                <Chip label={size.toUpperCase()} size="small" sx={{ minWidth: 50 }} />
                <Box
                  sx={{
                    width: value,
                    height: 24,
                    bgcolor: 'primary.main',
                    borderRadius: 0.5
                  }} />
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {value}px
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Breakpoints Info */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Responsive Breakpoints
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Layouts adapt to these screen sizes
          </Typography>

          <Grid container spacing={2}>
            {Object.entries(gridSystem.breakpoints).map(([size, value]) => (
              <Grid item xs={12} sm={6} md={4} key={size}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="caption" color="textSecondary">
                    {size.toUpperCase()}
                  </Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                    {value}px+
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};
