/**
 * AI Prompt Templates
 * System for creating, saving, and using custom prompt templates
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Divider,
  Alert,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ContentCopy,
  Star,
  StarBorder,
  Code,
  Psychology,
  Description,
  Close,
  Save,
  Category,
} from '@mui/icons-material';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'component' | 'refactor' | 'bug-fix' | 'optimization' | 'custom';
  template: string;
  variables: string[]; // e.g., ['componentName','description','features']
  isFavorite: boolean;
  createdAt: number;
  usageCount: number;
}

interface AIPromptTemplatesProps {
  open: boolean;
  onClose: () => void;
  onUseTemplate: (template: PromptTemplate, variables: Record<string, string>) => void;
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'default-1',
    name: 'React Component',
    description: 'Generate a modern React component with TypeScript',
    category: 'component',
    template: `Generate a React component named {{componentName} that {{description}.

Requirements:
- Use TypeScript with proper types
- Include {{features}
- Follow React best practices
- Make it responsive and accessible
- Add PropTypes or TypeScript interfaces

Return complete, production-ready code.`,
    variables: ['componentName','description','features'],
    isFavorite: true,
    createdAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'default-2',
    name: 'Performance Optimization',
    description: 'Optimize code for better performance',
    category: 'optimization',
    template: `Analyze and optimize this code for, performance: \`\`\`{{language}
{{code}
\`\`\`

Focus on:
- {{optimizationFocus}
- Reduce unnecessary re-renders
- Optimize algorithms and data structures
- Improve memory usage

Provide optimized code with explanations.`,
    variables: ['language','code','optimizationFocus'],
    isFavorite: false,
    createdAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'default-3',
    name: 'Bug Fix',
    description: 'Identify and fix bugs in code',
    category: 'bug-fix',
    template: `Identify and fix bugs in this, code: \`\`\`{{language}
{{code}
\`\`\`

Error message: {{errorMessage}

Please:
1. Identify the root cause
2. Provide fixed code
3. Explain what was wrong
4. Suggest tests to prevent this bug`,
    variables: ['language','code','errorMessage'],
    isFavorite: true,
    createdAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'default-4',
    name: 'Code Refactoring',
    description: 'Refactor code for better maintainability',
    category: 'refactor',
    template: `Refactor this code to improve {{refactorGoal}: \`\`\`{{language}
{{code}
\`\`\`

Guidelines:
- Follow {{framework} best practices
- Improve readability and maintainability
- Add proper error handling
- Extract reusable logic

Provide refactored code with explanations.`,
    variables: ['refactorGoal','language','code','framework'],
    isFavorite: false,
    createdAt: Date.now(),
    usageCount: 0,
  },
];

export default function AIPromptTemplates({
  open,
  onClose,
  onUseTemplate,
}: AIPromptTemplatesProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<PromptTemplate> | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });

  // Load templates from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai_prompt_templates');
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } else {
      setTemplates(DEFAULT_TEMPLATES);
    }
  }, []);

  // Save templates to localStorage
  const saveTemplates = useCallback((newTemplates: PromptTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('ai_prompt_templates', JSON.stringify(newTemplates));
  }, []);

  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setSelectedTemplate(template);
    // Initialize variables
    const initialValues: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialValues[v] = '';
    });
    setVariableValues(initialValues);
  }, []);

  const handleUseTemplate = useCallback(() => {
    if (!selectedTemplate) return;

    // Update usage count
    const updatedTemplates = templates.map((t) =>
      t.id === selectedTemplate.id ? { ...t, usageCount: t.usageCount + 1 } : t,
    );
    saveTemplates(updatedTemplates);

    onUseTemplate(selectedTemplate, variableValues);
    setSelectedTemplate(null);
    setVariableValues({});
  }, [selectedTemplate, variableValues, templates, saveTemplates, onUseTemplate]);

  const handleCreateNew = useCallback(() => {
    setEditingTemplate({
      id: `custom-${Date.now()}`,
      name: '',
      description: '',
      category: 'custom',
      template: '',
      variables: [],
      isFavorite: false,
      createdAt: Date.now(),
      usageCount: 0,
    });
    setEditDialogOpen(true);
  }, []);

  const handleEditTemplate = useCallback((template: PromptTemplate) => {
    setEditingTemplate(template);
    setEditDialogOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(() => {
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.template) return;

    const template = editingTemplate as PromptTemplate;
    const existingIndex = templates.findIndex((t) => t.id === template.id);

    if (existingIndex >= 0) {
      // Update existing
      const updated = [...templates];
      updated[existingIndex] = template;
      saveTemplates(updated);
    } else {
      // Add new
      saveTemplates([...templates, template]);
    }

    setEditDialogOpen(false);
    setEditingTemplate(null);
  }, [editingTemplate, templates, saveTemplates]);

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      if (id.startsWith('default-')) {
        setSnackbar({ open: true, message: 'Cannot delete default templates', severity: 'warning' });
        return;
      }
      saveTemplates(templates.filter((t) => t.id !== id));
    },
    [templates, saveTemplates],
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      const updated = templates.map((t) => (t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
      saveTemplates(updated);
    },
    [templates, saveTemplates],
  );

  const handleDuplicateTemplate = useCallback(
    (template: PromptTemplate) => {
      const duplicate: PromptTemplate = {
        ...template,
        id: `custom-${Date.now()}`,
        name: `${template.name} (Copy)`,
        createdAt: Date.now(),
        usageCount: 0,
      };
      saveTemplates([...templates, duplicate]);
    },
    [templates, saveTemplates],
  );

  const filteredTemplates =
    filterCategory === 'all' ? templates : templates.filter((t) => t.category === filterCategory);

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.usageCount - a.usageCount;
  });

  if (!open) return null;

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: 1200,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 150,
          borderRadius: 2,
          overflow: 'hidden'}}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            bgcolor: 'primary.main',
            color: 'white'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description />
            <Typography variant="h6" fontWeight={600}>
              Prompt Templates
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={handleCreateNew}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              New Template
            </Button>
            <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Template List */}
          <Box
            sx={{
              width: 400,
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column'}}>
            {/* Filter */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Templates</MenuItem>
                  <MenuItem value="component">Components</MenuItem>
                  <MenuItem value="refactor">Refactoring</MenuItem>
                  <MenuItem value="bug-fix">Bug Fixes</MenuItem>
                  <MenuItem value="optimization">Optimization</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* List */}
            <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              {sortedTemplates.map((template) => (
                <ListItem key={template.id} disablePadding sx={{ mb: 1 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      width: '100%',
                      cursor: 'pointer',
                      border: selectedTemplate?.id === template.id ? 2 : 1,
                      borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider'}}
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          mb: 1}}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {template.name}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(template.id);
                          }}
                        >
                          {template.isFavorite ? (
                            <Star fontSize="small" color="primary" />
                          ) : (
                            <StarBorder fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mb: 1 }}>
                        {template.description}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        <Chip label={template.category} size="small" variant="outlined" />
                        <Chip label={`Used ${template.usageCount}x`} size="small" />
                      </Stack>
                    </CardContent>
                    <CardActions sx={{ pt: 0, px: 2, pb: 1, gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(template);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateTemplate(template);
                        }}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                      {!template.id.startsWith('default-') && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </CardActions>
                  </Card>
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Template Details & Variables */}
          <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
            {selectedTemplate ? (
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    {selectedTemplate.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {selectedTemplate.description}
                  </Typography>
                </Box>

                <Divider />

                {/* Template Preview */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Template: </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: '#f5f5f5',
                      fontFamily: 'Monaco, Consolas, monospace',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 200,
                      overflow: 'auto'}}>
                    {selectedTemplate.template}
                  </Paper>
                </Box>

                <Divider />

                {/* Variables */}
                {selectedTemplate.variables.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                      Fill in Variables: </Typography>
                    <Stack spacing={2}>
                      {selectedTemplate.variables.map((variable) => (
                        <TextField
                          key={variable}
                          label={variable}
                          fullWidth
                          multiline
                          rows={2}
                          value={variableValues[variable] || ', '}
                          onChange={(e) =>
                            setVariableValues((prev) => ({
                              ...prev,
                              [variable]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${variable}...`}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Use Button */}
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Psychology />}
                  onClick={handleUseTemplate}
                  disabled={selectedTemplate.variables.some((v) => !variableValues[v]?.trim())}
                  fullWidth
                >
                  Use Template with AI
                </Button>
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Description sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Select a Template
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a template from the left to get started
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTemplate?.id?.startsWith('custom-') ? 'New Template' : 'Edit Template'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              fullWidth
              value={editingTemplate?.name || ''}
              onChange={(e) => setEditingTemplate((prev) => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={editingTemplate?.description || ''}
              onChange={(e) =>
                setEditingTemplate((prev) => ({ ...prev, description: e.target.value }))
              }
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
                <Select
                  value={editingTemplate?.category || 'custom'}
                  onChange={(e) =>
                    setEditingTemplate((prev) => {
                      const value = e.target.value;
                      const category: PromptTemplate['category'] =
                        value === 'component' ||
                        value === 'refactor' ||
                        value === 'bug-fix' ||
                        value === 'optimization' ||
                        value === 'custom'
                          ? value
                          : 'custom';
                      return {
                        ...prev,
                        category,
                      };
                    })
                  }
                  label="Category"
                >
                <MenuItem value="component">Component</MenuItem>
                <MenuItem value="refactor">Refactoring</MenuItem>
                <MenuItem value="bug-fix">Bug Fix</MenuItem>
                <MenuItem value="optimization">Optimization</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Template (use {{variableName} for variables)"
              fullWidth
              multiline
              rows={10}
              value={editingTemplate?.template || ''}
              onChange={(e) => {
                const template = e.target.value;
                // Extract variables from template
                const variables = Array.from(template.matchAll(/\{\{(\w+)\}\}/g)).map(
                  (match) => match[1],
                );
                const uniqueVariables = [...new Set(variables)];

                setEditingTemplate((prev) => ({
                  ...prev,
                  template,
                  variables: uniqueVariables,
                }));
              }}
              helperText="Use {{variableName} syntax for variables. They will be auto-detected."
            />
            {editingTemplate?.variables && editingTemplate.variables.length > 0 && (
              <Alert severity="info">
                Detected variables: {editingTemplate.variables.join(', ')}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSaveTemplate}
            disabled={!editingTemplate?.name || !editingTemplate?.template}
          >
            Save Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
