import React, { useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  HorizontalRule,
  Preview,
  Save,
  Settings,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

type ComponentType = 'text' | 'button' | 'image' | 'divider';

type PageStatus = 'draft' | 'published' | 'archived';

interface CMSComponent {
  id: string;
  type: ComponentType;
  label: string;
  props: {
    text?: string;
    src?: string;
    alt?: string;
    href?: string;
  };
  style: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    padding?: number;
  };
}

interface CMSPage {
  id: string;
  name: string;
  route: string;
  status: PageStatus;
  components: CMSComponent[];
  updatedAt: string;
}

const EMPTY_PAGE = (): CMSPage => ({
  id: nanoid(),
  name: 'Untitled Page',
  route: '/new-page',
  status: 'draft',
  components: [],
  updatedAt: new Date().toISOString(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizePage = (value: unknown): CMSPage | null => {
  if (!isRecord(value)) {
    return null;
  }

  const data = value as Partial<CMSPage>;
  if (!data.id || !data.name || !data.route) {
    return null;
  }

  return {
    id: String(data.id),
    name: String(data.name),
    route: String(data.route),
    status:
      data.status === 'published' || data.status === 'archived' || data.status === 'draft'
        ? data.status
        : 'draft',
    components: Array.isArray(data.components)
      ? data.components
          .map((component) => {
            if (!component || typeof component !== 'object') {
              return null;
            }
            const typed = component as Partial<CMSComponent>;
            if (!typed.id || !typed.type || !typed.label) {
              return null;
            }
            if (typed.type !== 'text' && typed.type !== 'button' && typed.type !== 'image' && typed.type !== 'divider') {
              return null;
            }
            return {
              id: String(typed.id),
              type: typed.type,
              label: String(typed.label),
              props: typed.props ?? {},
              style: typed.style ?? {},
            };
          })
          .filter((component): component is CMSComponent => component !== null)
      : [],
    updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString(),
  };
};

const createComponentTemplate = (type: ComponentType): CMSComponent => {
  switch (type) {
    case 'button':
      return {
        id: nanoid(),
        type,
        label: 'Button',
        props: { text: 'Click me', href: '#' },
        style: { backgroundColor: '#1976d2', color: '#ffffff', padding: 10 },
      };
    case 'image':
      return {
        id: nanoid(),
        type,
        label: 'Image',
        props: { src: '/placeholder.svg', alt: 'Image' },
        style: { padding: 6 },
      };
    case 'divider':
      return {
        id: nanoid(),
        type,
        label: 'Divider',
        props: {},
        style: { padding: 8 },
      };
    case 'text':
    default:
      return {
        id: nanoid(),
        type: 'text',
        label: 'Text',
        props: { text: 'Editable text block' },
        style: { fontSize: 16, color: '#111827', padding: 4 },
      };
  }
};

const renderComponentPreview = (component: CMSComponent) => {
  switch (component.type) {
    case 'button':
      return (
        <Button
          variant="contained"
          href={component.props.href}
          sx={{
            color: component.style.color,
            backgroundColor: component.style.backgroundColor,
            px: Math.max(1, (component.style.padding ?? 8) / 8),
          }}
        >
          {component.props.text ?? 'Button'}
        </Button>
      );
    case 'image':
      return (
        <Box
          component="img"
          src={component.props.src ?? '/placeholder.svg'}
          alt={component.props.alt ?? 'Image'}
          sx={{
            maxWidth: '100%',
            maxHeight: 220,
            borderRadius: 1,
            border: '1px solid rgba(148,163,184,0.5)',
          }}
        />
      );
    case 'divider':
      return <Divider sx={{ my: 1 }} />;
    case 'text':
    default:
      return (
        <Typography
          sx={{
            fontSize: component.style.fontSize,
            color: component.style.color,
            p: component.style.padding,
          }}
        >
          {component.props.text ?? 'Text'}
        </Typography>
      );
  }
};

export default function UniversalVisualCMS() {
  const theming = useTheming('photographer');

  const [currentPage, setCurrentPage] = useState<CMSPage>(EMPTY_PAGE());
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [showPageDialog, setShowPageDialog] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPageRoute, setNewPageRoute] = useState('');

  const { data: pages = [] } = useQuery<CMSPage[]>({
    queryKey: ['/api/cms/pages'],
    queryFn: async () => {
      const response: unknown = await apiRequest('/api/cms/pages', { method: 'GET' });
      const raw: unknown[] = Array.isArray(response)
        ? response
        : isRecord(response) && Array.isArray(response.pages)
          ? response.pages
          : [];
      const normalized = raw.map(normalizePage).filter((item): item is CMSPage => item !== null);
      return normalized;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (page: CMSPage) => {
      await apiRequest(`/api/cms/pages/${encodeURIComponent(page.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      });
    },
  });

  const selectedComponent = useMemo(() => {
    if (!selectedComponentId) {
      return null;
    }
    return currentPage.components.find((component) => component.id === selectedComponentId) ?? null;
  }, [currentPage.components, selectedComponentId]);

  const handleAddComponent = (type: ComponentType) => {
    const component = createComponentTemplate(type);
    setCurrentPage((previous) => ({
      ...previous,
      components: [...previous.components, component],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedComponentId(component.id);
  };

  const handleDeleteComponent = (componentId: string) => {
    setCurrentPage((previous) => ({
      ...previous,
      components: previous.components.filter((component) => component.id !== componentId),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedComponentId === componentId) {
      setSelectedComponentId(null);
    }
  };

  const handleSavePage = async () => {
    await saveMutation.mutateAsync(currentPage);
  };

  const handleCreatePage = () => {
    const created: CMSPage = {
      ...EMPTY_PAGE(),
      name: newPageName.trim() || 'Untitled Page',
      route: newPageRoute.trim() || `/page-${Date.now()}`,
    };
    setCurrentPage(created);
    setSelectedComponentId(null);
    setShowPageDialog(false);
    setNewPageName('');
    setNewPageRoute('');
  };

  const patchSelectedComponent = (patch: Partial<CMSComponent>) => {
    if (!selectedComponentId) {
      return;
    }

    setCurrentPage((previous) => ({
      ...previous,
      components: previous.components.map((component) => {
        if (component.id !== selectedComponentId) {
          return component;
        }
        return {
          ...component,
          ...patch,
          props: { ...component.props, ...patch.props },
          style: { ...component.style, ...patch.style },
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, mr: 1 }}>
            Universal Visual CMS
          </Typography>

          <Button startIcon={<Add />} onClick={() => setShowPageDialog(true)}>
            New Page
          </Button>
          <Button
            startIcon={<Save />}
            variant="contained"
            onClick={() => {
              void handleSavePage();
            }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={currentPage.status}
              onChange={(event) =>
                setCurrentPage((previous) => ({
                  ...previous,
                  status: event.target.value as PageStatus,
                }))
              }
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
            <Tooltip title="Toggle preview mode">
              <IconButton onClick={() => setPreviewMode((state) => !state)}>
                {previewMode ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>
            <Chip label={previewMode ? 'Preview' : 'Edit'} color={previewMode ? 'success' : 'default'} size="small" />
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Drawer variant="permanent" anchor="left" PaperProps={{ sx: { position: 'relative', width: 260 } }}>
          <Toolbar />
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Pages
            </Typography>
            <List dense>
              {pages.map((page: CMSPage) => (
                <ListItemButton
                  key={page.id}
                  selected={page.id === currentPage.id}
                  onClick={() => {
                    setCurrentPage(page);
                    setSelectedComponentId(null);
                  }}
                >
                  <ListItemText
                    primary={page.name}
                    secondary={`${page.route} • ${page.status}`}
                    primaryTypographyProps={{ noWrap: true }}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Divider />
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Add component
            </Typography>
            <Stack spacing={0.75}>
              <Button size="small" onClick={() => handleAddComponent('text')} startIcon={<Edit />}>
                Text
              </Button>
              <Button size="small" onClick={() => handleAddComponent('button')} startIcon={<Add />}>
                Button
              </Button>
              <Button size="small" onClick={() => handleAddComponent('image')} startIcon={<Preview />}>
                Image
              </Button>
              <Button size="small" onClick={() => handleAddComponent('divider')} startIcon={<HorizontalRule />}>
                Divider
              </Button>
            </Stack>
          </Box>
        </Drawer>

        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          <TextField
            fullWidth
            label="Page Name"
            value={currentPage.name}
            onChange={(event) =>
              setCurrentPage((previous) => ({
                ...previous,
                name: event.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            label="Route"
            value={currentPage.route}
            onChange={(event) =>
              setCurrentPage((previous) => ({
                ...previous,
                route: event.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
            sx={{ mb: 2 }}
          />

          {currentPage.components.length === 0 ? (
            <Alert severity="info">No components on this page yet. Add one from the left panel.</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {currentPage.components.map((component) => (
                <Grid key={component.id} item xs={12}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderColor: component.id === selectedComponentId ? 'primary.main' : undefined,
                    }}
                  >
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                      <Box sx={{ flex: 1 }} onClick={() => setSelectedComponentId(component.id)}>
                        <Typography variant="caption" color="text.secondary">
                          {component.type.toUpperCase()} · {component.label}
                        </Typography>
                        <Box sx={{ mt: 0.75 }}>{renderComponentPreview(component)}</Box>
                      </Box>
                      {!previewMode && (
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteComponent(component.id)}
                          aria-label={`Delete ${component.label}`}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        <Drawer variant="permanent" anchor="right" PaperProps={{ sx: { position: 'relative', width: 300 } }}>
          <Toolbar />
          <Box sx={{ px: 1.5, py: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Settings fontSize="small" /> Component Settings
            </Typography>

            {!selectedComponent ? (
              <Alert severity="info">Select a component to edit its properties.</Alert>
            ) : (
              <Stack spacing={1.25}>
                <TextField
                  label="Label"
                  value={selectedComponent.label}
                  onChange={(event) => patchSelectedComponent({ label: event.target.value })}
                />

                {selectedComponent.type !== 'divider' && (
                  <TextField
                    label="Text"
                    value={selectedComponent.props.text ?? ''}
                    onChange={(event) => patchSelectedComponent({ props: { text: event.target.value } })}
                  />
                )}

                {selectedComponent.type === 'image' && (
                  <>
                    <TextField
                      label="Image URL"
                      value={selectedComponent.props.src ?? ''}
                      onChange={(event) => patchSelectedComponent({ props: { src: event.target.value } })}
                    />
                    <TextField
                      label="Alt text"
                      value={selectedComponent.props.alt ?? ''}
                      onChange={(event) => patchSelectedComponent({ props: { alt: event.target.value } })}
                    />
                  </>
                )}

                <TextField
                  type="number"
                  label="Font size"
                  value={selectedComponent.style.fontSize ?? 16}
                  onChange={(event) =>
                    patchSelectedComponent({ style: { fontSize: Number(event.target.value) || 16 } })
                  }
                />

                <TextField
                  label="Text color"
                  value={selectedComponent.style.color ?? '#111827'}
                  onChange={(event) => patchSelectedComponent({ style: { color: event.target.value } })}
                />

                <TextField
                  label="Background color"
                  value={selectedComponent.style.backgroundColor ?? ''}
                  onChange={(event) =>
                    patchSelectedComponent({ style: { backgroundColor: event.target.value || undefined } })
                  }
                />

                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Preview Mode</Typography>
                  <Switch checked={previewMode} onChange={() => setPreviewMode((state) => !state)} />
                </Stack>
              </Stack>
            )}
          </Box>
        </Drawer>
      </Box>

      <Dialog open={showPageDialog} onClose={() => setShowPageDialog(false)}>
        <DialogTitle>Create page</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ minWidth: 320, pt: 0.5 }}>
            <TextField
              label="Page name"
              value={newPageName}
              onChange={(event) => setNewPageName(event.target.value)}
            />
            <TextField
              label="Route"
              placeholder="/landing"
              value={newPageRoute}
              onChange={(event) => setNewPageRoute(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPageDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePage}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
