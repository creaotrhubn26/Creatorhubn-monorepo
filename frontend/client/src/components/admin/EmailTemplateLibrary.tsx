import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid2,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CalendarMonth,
  ContentCopy,
  Delete,
  Email,
  Favorite,
  FavoriteBorder,
  Notifications,
  PersonAdd,
  Search,
  TrendingUp,
  Visibility,
} from '@mui/icons-material';
import { QUERY_KEYS } from '../../lib/queryKeys';
import { useToast } from '../../hooks/use-toast';
import { AdminButton, AdminEmpty } from './design-system';

type SortBy = 'recent' | 'popular' | 'name';
type CategoryValue =
  | 'all'
  | 'newsletter'
  | 'promotional'
  | 'transactional'
  | 'event'
  | 'engagement'
  | 'welcome'
  | 'update';

interface EmailComponentStyles {
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

interface EmailComponentContent {
  text?: string;
  src?: string;
  alt?: string;
}

interface EmailTemplateComponent {
  type: 'header' | 'text' | 'button' | 'image' | 'divider' | string;
  styles?: EmailComponentStyles;
  content?: EmailComponentContent;
}

interface EmailGlobalStyles {
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  preheader: string;
  thumbnail?: string;
  components: EmailTemplateComponent[];
  globalStyles: EmailGlobalStyles;
  isFavorite?: boolean;
  isDefault?: boolean;
  usageCount?: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

interface EmailTemplateLibraryProps {
  onSelectTemplate?: (template: EmailTemplate) => void;
}

type CategoryConfig = {
  value: CategoryValue;
  label: string;
  icon: React.ElementType;
};

const CATEGORIES: CategoryConfig[] = [
  { value: 'all', label: 'All Templates', icon: Email },
  { value: 'newsletter', label: 'Newsletter', icon: Email },
  { value: 'promotional', label: 'Promotional', icon: TrendingUp },
  { value: 'transactional', label: 'Transactional', icon: Notifications },
  { value: 'event', label: 'Event', icon: CalendarMonth },
  { value: 'engagement', label: 'Engagement', icon: Favorite },
  { value: 'welcome', label: 'Welcome', icon: PersonAdd },
  { value: 'update', label: 'Update', icon: TrendingUp },
];

const sortTemplates = (templates: EmailTemplate[], sortBy: SortBy): EmailTemplate[] => {
  const sorted = [...templates];
  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }
  if (sortBy === 'popular') {
    sorted.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    return sorted;
  }
  sorted.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return sorted;
};

export default function EmailTemplateLibrary({
  onSelectTemplate,
}: EmailTemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: templates = [],
    isLoading,
    isError,
    error,
  } = useQuery<EmailTemplate[]>({
    queryKey: [...QUERY_KEYS.EMAIL_TEMPLATES, selectedCategory, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      params.append('sortBy', sortBy);

      const response = await fetch(`/api/email-templates?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      return response.json() as Promise<EmailTemplate[]>;
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({
      templateId,
      isFavorite,
    }: {
      templateId: string;
      isFavorite: boolean;
    }) => {
      const response = await fetch(`/api/email-templates/${templateId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite }),
      });
      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EMAIL_TEMPLATES });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/email-templates/${templateId}/duplicate`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to duplicate template');
      }
      return response.json() as Promise<EmailTemplate>;
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EMAIL_TEMPLATES });
      toast({
        title: 'Template duplicated',
        description: `${newTemplate.name} has been created.`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/email-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete template');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EMAIL_TEMPLATES });
      toast({
        title: 'Template deleted',
        description: 'The template has been removed.',
      });
    },
  });

  const filteredTemplates = useMemo(() => {
    const filtered = (Array.isArray(templates) ? templates : []).filter((template) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        template.name.toLowerCase().includes(query) ||
        template.subject.toLowerCase().includes(query);
      const matchesFavorites = !showFavoritesOnly || template.isFavorite;
      return matchesSearch && matchesFavorites;
    });

    return sortTemplates(filtered, sortBy);
  }, [templates, searchQuery, showFavoritesOnly, sortBy]);

  const handleUseTemplate = (template: EmailTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      return;
    }
    window.location.href = `/admin/email-designer?template=${template.id}`;
  };

  const executeDelete = () => {
    if (!deleteConfirmId) return;
    deleteMutation.mutate(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const getCategoryConfig = (category: string): CategoryConfig => {
    return (
      CATEGORIES.find((entry) => entry.value === category) ?? {
        value: 'all',
        label: category,
        icon: Email,
      }
    );
  };

  const renderTemplatePreview = (template: EmailTemplate) => {
    const previewHtml = template.components
      .map((component) => {
        switch (component.type) {
          case 'header':
            return `<h1 style="text-align:center;color:${component.styles?.color ?? '#000'}">${
              component.content?.text ?? ''
            }</h1>`;
          case 'text':
            return `<p style="color:${component.styles?.color ?? '#000'}">${
              component.content?.text ?? ''
            }</p>`;
          case 'button':
            return `<div style="text-align:center"><button style="background:${
              component.styles?.backgroundColor ?? '#1976d2'
            };color:${component.styles?.color ?? '#fff'};padding:10px 20px;border-radius:${
              component.styles?.borderRadius ?? 4
            }px;border:none;">${component.content?.text ?? 'Button'}</button></div>`;
          case 'image':
            return `<img src="${component.content?.src ?? '/placeholder.png'}" alt="${
              component.content?.alt ?? ''
            }" style="max-width:100%;height:auto;" />`;
          case 'divider':
            return '<hr style="border:0;border-top:1px solid #ddd;margin:20px 0;" />';
          default:
            return '';
        }
      })
      .join('');

    return (
      <Box
        sx={{
          backgroundColor: template.globalStyles.backgroundColor ?? '#f5f5f5',
          p: 2.5,
          fontFamily: template.globalStyles.fontFamily ?? 'Arial, sans-serif',
          fontSize: `${template.globalStyles.fontSize ?? 14}px`,
          lineHeight: template.globalStyles.lineHeight ?? 1.6,
          borderRadius: 1,
        }}
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    );
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Email Template Library
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse and select from your email templates.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          fullWidth
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl sx={{ minWidth: 180 }}>
          <Select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            displayEmpty
          >
            <MenuItem value="recent">Most Recent</MenuItem>
            <MenuItem value="popular">Most Popular</MenuItem>
            <MenuItem value="name">Name (A-Z)</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant={showFavoritesOnly ? 'contained' : 'outlined'}
          onClick={() => setShowFavoritesOnly((previous) => !previous)}
          startIcon={showFavoritesOnly ? <Favorite /> : <FavoriteBorder />}
        >
          Favorites
        </Button>
      </Stack>

      <Tabs
        value={selectedCategory}
        onChange={(_event, value: CategoryValue) => setSelectedCategory(value)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <Tab
              key={category.value}
              value={category.value}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Icon fontSize="small" />
                  <span>{category.label}</span>
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      {isLoading && <LinearProgress />}
      {isError && (
        <Alert severity="error">
          {(error as Error)?.message || 'Failed to load email templates'}
        </Alert>
      )}

      {!isLoading && filteredTemplates.length === 0 ? (
        <AdminEmpty
          icon={<Email sx={{ fontSize: 48 }} />}
          title="No templates found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <Grid2 container spacing={2}>
          {filteredTemplates.map((template) => {
            const category = getCategoryConfig(template.category);
            const CategoryIcon = category.icon;

            return (
              <Grid2 key={template.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card>
                  <CardHeader
                    title={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6">{template.name}</Typography>
                        {template.isDefault && (
                          <Chip label="Default" size="small" color="primary" />
                        )}
                      </Stack>
                    }
                    subheader={template.subject}
                    action={
                      <IconButton
                        aria-label="Toggle favorite"
                        onClick={() =>
                          toggleFavoriteMutation.mutate({
                            templateId: template.id,
                            isFavorite: !template.isFavorite,
                          })
                        }
                      >
                        {template.isFavorite ? (
                          <Favorite color="error" />
                        ) : (
                          <FavoriteBorder />
                        )}
                      </IconButton>
                    }
                  />

                  <CardContent>
                    <Box
                      sx={{
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        height: 180,
                        mb: 2,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {template.thumbnail ? (
                        <Box
                          component="img"
                          src={template.thumbnail}
                          alt={template.name}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Email sx={{ fontSize: 40, color: 'text.secondary' }} />
                      )}
                    </Box>

                    <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
                      <Chip
                        size="small"
                        icon={<CategoryIcon />}
                        label={category.label}
                        variant="outlined"
                      />
                      {template.tags?.slice(0, 2).map((tag) => (
                        <Chip key={tag} size="small" label={tag} />
                      ))}
                    </Stack>

                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      color="text.secondary"
                      mb={2}
                    >
                      <Typography variant="caption">
                        Used {template.usageCount ?? 0} times
                      </Typography>
                      <Typography variant="caption">
                        {template.lastUsed
                          ? `Last used ${new Date(template.lastUsed).toLocaleDateString()}`
                          : 'Never used'}
                      </Typography>
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Tooltip title="Preview template">
                      <IconButton onClick={() => setPreviewTemplate(template)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate template">
                      <IconButton onClick={() => duplicateMutation.mutate(template.id)}>
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    {!template.isDefault && (
                      <Tooltip title="Delete template">
                        <IconButton onClick={() => setDeleteConfirmId(template.id)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <AdminButton tone="primary" onClick={() => handleUseTemplate(template)}>
                      Use Template
                    </AdminButton>
                  </CardActions>
                </Card>
              </Grid2>
            );
          })}
        </Grid2>
      )}

      <Dialog
        open={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{previewTemplate?.name ?? 'Template Preview'}</DialogTitle>
        <DialogContent dividers>
          {previewTemplate && (
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Subject: {previewTemplate.subject}
              </Typography>
              {renderTemplatePreview(previewTemplate)}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setPreviewTemplate(null)}>
            Close
          </AdminButton>
          {previewTemplate && (
            <>
              <AdminButton
                tone="secondary"
                startIcon={<ContentCopy />}
                onClick={() => duplicateMutation.mutate(previewTemplate.id)}
              >
                Duplicate
              </AdminButton>
              <AdminButton
                tone="primary"
                onClick={() => handleUseTemplate(previewTemplate)}
              >
                Use Template
              </AdminButton>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this template? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </AdminButton>
          <AdminButton tone="danger" onClick={executeDelete}>
            Delete
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
