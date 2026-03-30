/**
 * Component Library - Save and reuse editor snapshots as components
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Close,
  Code,
  ContentCopy,
  Delete,
  Download,
  Edit,
  Folder,
  MoreVert,
  Search,
  Share,
  Star,
  StarBorder,
  ViewList,
  ViewModule,
  Visibility,
} from '@mui/icons-material';
import type { EditorDesignTokenMap, EditorElement, EditorStyleClassMap } from './VisualEditorContext';
import { getElementClassNames } from './visualEditorModel';

type ComponentCategory =
  | 'Buttons'
  | 'Forms'
  | 'Cards'
  | 'Navigation'
  | 'Layout'
  | 'Custom';

export interface ComponentLibrarySnapshot {
  rootElementIds: string[];
  elements: EditorElement[];
  styleClasses: EditorStyleClassMap;
  designTokens: EditorDesignTokenMap;
}

export interface LibraryComponent {
  id: string;
  familyId: string;
  variantName: string;
  name: string;
  description: string;
  category: ComponentCategory;
  code: {
    html?: string;
    react?: string;
    css?: string;
  };
  preview?: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  props?: Record<string, unknown>;
  snapshot?: ComponentLibrarySnapshot;
}

interface ComponentLibraryProps {
  open: boolean;
  onClose: () => void;
  onUseComponent?: (component: LibraryComponent) => void;
  selectionSnapshot?: ComponentLibrarySnapshot | null;
}

const STORAGE_KEY = 'visual-editor-components';

const CATEGORY_OPTIONS: ComponentCategory[] = [
  'Buttons',
  'Forms',
  'Cards',
  'Navigation',
  'Layout',
  'Custom',
];

const createSnapshotCode = (snapshot: ComponentLibrarySnapshot | undefined) => {
  if (!snapshot) {
    return {
      html: '<div><!-- No snapshot attached --></div>',
      react: 'export default function Component() {\n  return <div />;\n}\n',
      css: '',
    };
  }

  const rootCount = snapshot.rootElementIds.length;
  const layerCount = snapshot.elements.length;
  const classCount = Object.keys(snapshot.styleClasses).length;
  const tokenCount = Object.keys(snapshot.designTokens ?? {}).length;

  return {
    html: `<!-- Snapshot component: ${rootCount} root${rootCount === 1 ? '' : 's'}, ${layerCount} layer${layerCount === 1 ? '' : 's'}, ${tokenCount} token${tokenCount === 1 ? '' : 's'} -->`,
    react: `export default function SnapshotComponent() {\n  return (\n    <div data-roots="${rootCount}" data-layers="${layerCount}" data-shared-classes="${classCount}" data-design-tokens="${tokenCount}">\n      {/* Generated from visual editor snapshot */}\n    </div>\n  );\n}\n`,
    css: classCount > 0
      ? `/* Snapshot references ${classCount} shared class${classCount === 1 ? '' : 'es'} */`
      : tokenCount > 0
        ? `/* Snapshot references ${tokenCount} design token${tokenCount === 1 ? '' : 's'} */`
        : '/* Snapshot contains only instance styles */',
  };
};

const cloneSnapshot = (snapshot: ComponentLibrarySnapshot): ComponentLibrarySnapshot => ({
  rootElementIds: [...snapshot.rootElementIds],
  elements: snapshot.elements.map((element) => ({
    ...element,
    styles: { ...element.styles },
    props: { ...element.props },
    children: [...(element.children ?? [])],
    responsive: element.responsive
      ? {
          tablet: element.responsive.tablet
            ? {
                ...element.responsive.tablet,
                styles: { ...(element.responsive.tablet.styles ?? {}) },
              }
            : undefined,
          mobile: element.responsive.mobile
            ? {
                ...element.responsive.mobile,
                styles: { ...(element.responsive.mobile.styles ?? {}) },
              }
            : undefined,
        }
      : undefined,
  })),
  styleClasses: Object.entries(snapshot.styleClasses).reduce<EditorStyleClassMap>((acc, [name, styleClass]) => {
    acc[name] = {
      name: styleClass.name,
      styles: { ...styleClass.styles },
      responsive: styleClass.responsive
        ? {
            tablet: styleClass.responsive.tablet
              ? { ...styleClass.responsive.tablet }
              : undefined,
            mobile: styleClass.responsive.mobile
              ? { ...styleClass.responsive.mobile }
              : undefined,
          }
        : undefined,
    };
    return acc;
  }, {}),
  designTokens: Object.entries(snapshot.designTokens ?? {}).reduce<EditorDesignTokenMap>((acc, [name, token]) => {
    acc[name] = {
      name: token.name,
      value: token.value,
      type: token.type,
      description: token.description,
    };
    return acc;
  }, {}),
});

const createDefaultComponents = (): LibraryComponent[] => {
  const primaryButtonSnapshot: ComponentLibrarySnapshot = {
    rootElementIds: ['button-root'],
    elements: [
      {
        id: 'button-root',
        type: 'button',
        x: 0,
        y: 0,
        width: 220,
        height: 56,
        styles: {
          backgroundColor: '#111827',
          color: '#ffffff',
          borderRadius: '999px',
          fontSize: '16px',
          fontWeight: '700',
          boxShadow: '0 18px 30px rgba(17, 24, 39, 0.18)',
        },
        props: { text: 'Primary action' },
        name: 'Primary Button',
      },
    ],
    styleClasses: {},
    designTokens: {},
  };

  const cardSnapshot: ComponentLibrarySnapshot = {
    rootElementIds: ['card-root'],
    elements: [
      {
        id: 'card-root',
        type: 'container',
        x: 0,
        y: 0,
        width: 360,
        height: 280,
        styles: {
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
        props: {},
        name: 'Feature Card',
        children: ['card-title', 'card-body', 'card-button'],
      },
      {
        id: 'card-title',
        type: 'text',
        x: 0,
        y: 0,
        width: 312,
        height: 42,
        styles: {
          color: '#111827',
          fontSize: '32px',
          fontWeight: '700',
          lineHeight: '1.1',
        },
        props: { text: 'Card headline' },
        name: 'Card Title',
        parent: 'card-root',
      },
      {
        id: 'card-body',
        type: 'text',
        x: 0,
        y: 0,
        width: 312,
        height: 72,
        styles: {
          color: '#4b5563',
          fontSize: '16px',
          lineHeight: '1.6',
        },
        props: { text: 'Use this block for feature callouts, pricing details or project summaries.' },
        name: 'Card Body',
        parent: 'card-root',
      },
      {
        id: 'card-button',
        type: 'button',
        x: 0,
        y: 0,
        width: 180,
        height: 48,
        styles: {
          backgroundColor: '#ff6b35',
          color: '#ffffff',
          borderRadius: '999px',
          fontSize: '15px',
          fontWeight: '700',
        },
        props: { text: 'Explore more' },
        name: 'Card Button',
        parent: 'card-root',
      },
    ],
    styleClasses: {},
    designTokens: {},
  };

  const inputSnapshot: ComponentLibrarySnapshot = {
    rootElementIds: ['field-root'],
    elements: [
      {
        id: 'field-root',
        type: 'container',
        x: 0,
        y: 0,
        width: 320,
        height: 132,
        styles: {
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        },
        props: {},
        name: 'Input Field',
        children: ['field-label', 'field-shell', 'field-help'],
      },
      {
        id: 'field-label',
        type: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 22,
        styles: {
          color: '#111827',
          fontSize: '14px',
          fontWeight: '700',
        },
        props: { text: 'Email address' },
        name: 'Field Label',
        parent: 'field-root',
      },
      {
        id: 'field-shell',
        type: 'container',
        x: 0,
        y: 0,
        width: 320,
        height: 52,
        styles: {
          backgroundColor: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '16px',
          padding: '14px 16px',
          boxShadow: 'inset 0 1px 1px rgba(15, 23, 42, 0.04)',
        },
        props: {},
        name: 'Field Shell',
        parent: 'field-root',
      },
      {
        id: 'field-help',
        type: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 20,
        styles: {
          color: '#6b7280',
          fontSize: '13px',
        },
        props: { text: 'We will only use this to send project updates.' },
        name: 'Field Help',
        parent: 'field-root',
      },
    ],
    styleClasses: {},
    designTokens: {},
  };

  const components: Array<Omit<LibraryComponent, 'code'>> = [
    {
      id: 'default-button',
      familyId: 'default-button',
      variantName: 'Default',
      name: 'Primary Button',
      description: 'A high-contrast CTA button with rounded geometry.',
      category: 'Buttons',
      tags: ['button', 'cta', 'primary'],
      favorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      props: { text: 'Primary action' },
      snapshot: primaryButtonSnapshot,
    },
    {
      id: 'default-card',
      familyId: 'default-card',
      variantName: 'Default',
      name: 'Feature Card',
      description: 'A reusable card section with headline, body and CTA.',
      category: 'Cards',
      tags: ['card', 'feature', 'layout'],
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshot: cardSnapshot,
    },
    {
      id: 'default-input',
      familyId: 'default-input',
      variantName: 'Default',
      name: 'Input Field',
      description: 'A form field shell with label and helper text.',
      category: 'Forms',
      tags: ['form', 'input', 'field'],
      favorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshot: inputSnapshot,
    },
  ];

  return components.map((component) => ({
    ...component,
    code: createSnapshotCode(component.snapshot),
  }));
};

const parseStoredComponents = (value: string | null): LibraryComponent[] | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }

      const candidate = entry as Partial<LibraryComponent>;
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
        return [];
      }

      const snapshot = candidate.snapshot
        && Array.isArray(candidate.snapshot.elements)
        && Array.isArray(candidate.snapshot.rootElementIds)
        ? cloneSnapshot(candidate.snapshot as ComponentLibrarySnapshot)
        : undefined;

      return [{
        id: candidate.id,
        familyId: typeof candidate.familyId === 'string' && candidate.familyId.trim()
          ? candidate.familyId
          : candidate.id,
        variantName: typeof candidate.variantName === 'string' && candidate.variantName.trim()
          ? candidate.variantName
          : 'Default',
        name: candidate.name,
        description: typeof candidate.description === 'string' ? candidate.description : '',
        category: CATEGORY_OPTIONS.includes(candidate.category as ComponentCategory)
          ? candidate.category as ComponentCategory
          : 'Custom',
        code: candidate.code ?? createSnapshotCode(snapshot),
        preview: typeof candidate.preview === 'string' ? candidate.preview : undefined,
        tags: Array.isArray(candidate.tags)
          ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        favorite: Boolean(candidate.favorite),
        createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
        updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
        props: candidate.props && typeof candidate.props === 'object'
          ? candidate.props as Record<string, unknown>
          : undefined,
        snapshot,
      }];
    });
  } catch {
    return null;
  }
};

const buildSnapshotSummary = (snapshot: ComponentLibrarySnapshot | undefined) => {
  if (!snapshot) {
    return 'Code-only component';
  }

  const layerCount = snapshot.elements.length;
  const classCount = Object.values(snapshot.styleClasses).length;
  const tokenCount = Object.values(snapshot.designTokens ?? {}).length;
  const usedClasses = new Set(
    snapshot.elements.flatMap((element) => getElementClassNames(element.className)),
  );

  return `${layerCount} layer${layerCount === 1 ? '' : 's'} • ${snapshot.rootElementIds.length} root${snapshot.rootElementIds.length === 1 ? '' : 's'} • ${Math.max(classCount, usedClasses.size)} shared class${Math.max(classCount, usedClasses.size) === 1 ? '' : 'es'} • ${tokenCount} token${tokenCount === 1 ? '' : 's'}`;
};

const createEmptyComponentDraft = (): Partial<LibraryComponent> => ({
  name: '',
  description: '',
  category: 'Custom',
  tags: [],
  favorite: false,
  familyId: '',
  variantName: 'Default',
});

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  open,
  onClose,
  onUseComponent,
  selectionSnapshot,
}) => {
  const [components, setComponents] = useState<LibraryComponent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [previewComponentId, setPreviewComponentId] = useState<string | null>(null);
  const [componentDraft, setComponentDraft] = useState<Partial<LibraryComponent>>(createEmptyComponentDraft);
  const [anchorEl, setAnchorEl] = useState<{ element: HTMLElement; componentId: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = parseStoredComponents(localStorage.getItem(STORAGE_KEY));
    setComponents(stored ?? createDefaultComponents());
  }, []);

  const persistComponents = (nextComponents: LibraryComponent[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextComponents));
    setComponents(nextComponents);
  };

  const filteredComponents = useMemo(
    () => components.filter((component) => {
      const matchesSearch =
        component.name.toLowerCase().includes(searchQuery.toLowerCase())
        || component.description.toLowerCase().includes(searchQuery.toLowerCase())
        || component.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || component.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }),
    [components, searchQuery, selectedCategory],
  );

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(components.map((component) => component.category)))],
    [components],
  );

  const activePreviewComponent = useMemo(
    () => components.find((component) => component.id === previewComponentId) ?? null,
    [components, previewComponentId],
  );
  const activeEditingComponent = useMemo(
    () => components.find((component) => component.id === editingComponentId) ?? null,
    [components, editingComponentId],
  );
  const componentFamilies = useMemo(
    () => Array.from(
      components.reduce<Map<string, string>>((acc, component) => {
        if (!acc.has(component.familyId)) {
          acc.set(component.familyId, component.name);
        }
        return acc;
      }, new Map()),
    ),
    [components],
  );
  const selectionSummary = selectionSnapshot ? buildSnapshotSummary(selectionSnapshot) : null;
  const canPersistSelection = Boolean(selectionSnapshot && selectionSnapshot.rootElementIds.length > 0);

  const openCreateDialog = () => {
    setEditingComponentId(null);
    setComponentDraft(createEmptyComponentDraft());
    setShowSaveDialog(true);
  };

  const openEditDialog = (component: LibraryComponent) => {
    setEditingComponentId(component.id);
    setComponentDraft({
      familyId: component.familyId,
      variantName: component.variantName,
      name: component.name,
      description: component.description,
      category: component.category,
      tags: [...component.tags],
      favorite: component.favorite,
    });
    setShowSaveDialog(true);
    setAnchorEl(null);
  };

  const handleSaveComponent = () => {
    if (!componentDraft.name?.trim()) {
      return;
    }

    const sourceSnapshot = canPersistSelection && selectionSnapshot
      ? cloneSnapshot(selectionSnapshot)
      : activeEditingComponent?.snapshot
        ? cloneSnapshot(activeEditingComponent.snapshot)
        : undefined;

    if (!sourceSnapshot) {
      return;
    }

    const nextId = activeEditingComponent?.id ?? `component-${Date.now()}`;
    const nextFamilyId = componentDraft.familyId?.trim() || activeEditingComponent?.familyId || nextId;
    const nextVariantName = componentDraft.variantName?.trim() || activeEditingComponent?.variantName || 'Default';

    const nextComponent: LibraryComponent = {
      id: nextId,
      familyId: nextFamilyId,
      variantName: nextVariantName,
      name: componentDraft.name.trim(),
      description: componentDraft.description?.trim() || 'Reusable visual editor component',
      category: (componentDraft.category as ComponentCategory) || 'Custom',
      code: createSnapshotCode(sourceSnapshot),
      preview: activeEditingComponent?.preview,
      tags: componentDraft.tags ?? [],
      favorite: componentDraft.favorite ?? activeEditingComponent?.favorite ?? false,
      createdAt: activeEditingComponent?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      props: activeEditingComponent?.props,
      snapshot: sourceSnapshot,
    };

    if (activeEditingComponent) {
      persistComponents(components.map((component) => (
        component.id === activeEditingComponent.id ? nextComponent : component
      )));
    } else {
      persistComponents([...components, nextComponent]);
    }

    setComponentDraft(createEmptyComponentDraft());
    setEditingComponentId(null);
    setShowSaveDialog(false);
  };

  const handleDeleteComponent = (id: string) => {
    persistComponents(components.filter((component) => component.id !== id));
    setAnchorEl(null);
  };

  const handleToggleFavorite = (id: string) => {
    persistComponents(components.map((component) => (
      component.id === id
        ? { ...component, favorite: !component.favorite, updatedAt: Date.now() }
        : component
    )));
  };

  const handleDuplicateComponent = (component: LibraryComponent) => {
    const duplicate: LibraryComponent = {
      ...component,
      id: `component-${Date.now()}`,
      name: `${component.name} Copy`,
      variantName: `${component.variantName} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshot: component.snapshot ? cloneSnapshot(component.snapshot) : undefined,
    };

    persistComponents([...components, duplicate]);
    setAnchorEl(null);
  };

  const handleExportComponent = (component: LibraryComponent) => {
    const blob = new Blob([JSON.stringify(component, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${component.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setAnchorEl(null);
  };

  const handleShareComponent = async (component: LibraryComponent) => {
    const payload = JSON.stringify(component, null, 2);

    try {
      await navigator.clipboard.writeText(payload);
      setShareMessage(`Copied ${component.name} JSON to clipboard.`);
    } catch {
      setShareMessage(`Unable to copy ${component.name}.`);
    }

    setAnchorEl(null);
  };

  const handleUseComponent = (component: LibraryComponent) => {
    onUseComponent?.(component);
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 520, md: 640 } } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              bgcolor: '#f7f3ef',
              borderBottom: '1px solid #eadfd4',
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Folder color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Component Library
              </Typography>
              <Chip label={components.length} size="small" color="primary" />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                startIcon={<Add />}
                variant="contained"
                size="small"
                onClick={openCreateDialog}
              >
                New
              </Button>
              <IconButton onClick={onClose} aria-label="Close component library">
                <Close />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eadfd4', bgcolor: 'rgba(255,255,255,0.75)' }}>
            {selectionSummary ? (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Current selection ready to save: {selectionSummary}
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Select one or more layers on the canvas to save a reusable component snapshot.
              </Alert>
            )}
            {shareMessage && (
              <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setShareMessage(null)}>
                {shareMessage}
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                size="small"
                onChange={(_, value: 'grid' | 'list' | null) => value && setViewMode(value)}
              >
                <ToggleButton value="grid" aria-label="Grid view">
                  <ViewModule fontSize="small" />
                </ToggleButton>
                <ToggleButton value="list" aria-label="List view">
                  <ViewList fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>

          <Tabs
            value={selectedCategory}
            onChange={(_, value) => setSelectedCategory(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            {categories.map((category) => (
              <Tab key={category} label={category} value={category} />
            ))}
          </Tabs>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {filteredComponents.length === 0 ? (
              <Alert severity="info">No components match this filter yet.</Alert>
            ) : (
              <Grid container spacing={2}>
                {filteredComponents.map((component) => (
                  <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} key={component.id}>
                    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flex: 1 }}>
                        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {component.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {component.description}
                            </Typography>
                          </Box>
                          <Box>
                            <Tooltip title={component.favorite ? 'Remove favorite' : 'Add favorite'}>
                              <IconButton
                                size="small"
                                onClick={() => handleToggleFavorite(component.id)}
                                aria-label={component.favorite ? `Unfavorite ${component.name}` : `Favorite ${component.name}`}
                              >
                                {component.favorite ? (
                                  <Star sx={{ color: '#ffa726' }} fontSize="small" />
                                ) : (
                                  <StarBorder fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <IconButton
                              size="small"
                              aria-label={`Open actions for ${component.name}`}
                              onClick={(event) => setAnchorEl({ element: event.currentTarget, componentId: component.id })}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.25 }}>
                          <Chip label={component.category} size="small" color="primary" variant="outlined" />
                          <Chip label={`Variant ${component.variantName}`} size="small" variant="outlined" />
                          {component.tags.slice(0, 3).map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                          ))}
                        </Box>

                        <Box
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            bgcolor: '#f8fafc',
                            border: '1px solid #e5e7eb',
                            minHeight: 96,
                          }}
                        >
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.75 }}>
                            Snapshot Summary
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {buildSnapshotSummary(component.snapshot)}
                          </Typography>
                          <Typography
                            variant="caption"
                            component="pre"
                            sx={{
                              mt: 1,
                              mb: 0,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace',
                              color: 'text.secondary',
                            }}
                          >
                            {component.code.react?.slice(0, 160)}
                            {(component.code.react?.length ?? 0) > 160 ? '...' : ''}
                          </Typography>
                        </Box>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                          <Button
                            size="small"
                            startIcon={<Visibility />}
                            variant="outlined"
                            fullWidth
                            onClick={() => setPreviewComponentId(component.id)}
                          >
                            Preview
                          </Button>
                          <Button
                            size="small"
                            startIcon={<Add />}
                            onClick={() => handleUseComponent(component)}
                            fullWidth
                            variant="contained"
                          >
                            Use
                          </Button>
                        </Stack>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Drawer>

      <Menu
        anchorEl={anchorEl?.element}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            const component = components.find((entry) => entry.id === anchorEl?.componentId);
            if (component) {
              openEditDialog(component);
            }
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit metadata</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const component = components.find((entry) => entry.id === anchorEl?.componentId);
            if (component) {
              handleDuplicateComponent(component);
            }
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const component = components.find((entry) => entry.id === anchorEl?.componentId);
            if (component) {
              void handleShareComponent(component);
            }
          }}
        >
          <ListItemIcon>
            <Share fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy JSON</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const component = components.find((entry) => entry.id === anchorEl?.componentId);
            if (component) {
              handleExportComponent(component);
            }
          }}
        >
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export JSON</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => anchorEl && handleDeleteComponent(anchorEl.componentId)}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {activeEditingComponent ? `Edit ${activeEditingComponent.name}` : 'Save Component Snapshot'}
        </DialogTitle>
        <DialogContent>
          {!canPersistSelection && !activeEditingComponent?.snapshot ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Select one or more layers before saving a new component. Existing components can still be renamed here.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>
              {canPersistSelection
                ? `The current selection will ${activeEditingComponent ? 'replace the existing snapshot for' : 'be saved as'} this component.`
                : 'This dialog will keep the existing snapshot and update only metadata.'}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Component Name"
            fullWidth
            value={componentDraft.name ?? ''}
            onChange={(event) => setComponentDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={componentDraft.description ?? ''}
            onChange={(event) => setComponentDraft((prev) => ({ ...prev, description: event.target.value }))}
          />
          <TextField
            margin="dense"
            label="Variant Name"
            fullWidth
            value={componentDraft.variantName ?? 'Default'}
            onChange={(event) => setComponentDraft((prev) => ({ ...prev, variantName: event.target.value }))}
          />
          <TextField
            margin="dense"
            label="Component Family"
            fullWidth
            select
            value={componentDraft.familyId ?? ''}
            onChange={(event) => setComponentDraft((prev) => ({
              ...prev,
              familyId: event.target.value,
            }))}
            helperText="Use an existing family to save a new variant."
          >
            <MenuItem value="">Create new family</MenuItem>
            {componentFamilies.map(([familyId, familyName]) => (
              <MenuItem key={familyId} value={familyId}>
                {familyName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Category"
            fullWidth
            select
            value={componentDraft.category ?? 'Custom'}
            onChange={(event) => setComponentDraft((prev) => ({
              ...prev,
              category: event.target.value as ComponentCategory,
            }))}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Tags (comma-separated)"
            fullWidth
            placeholder="button, hero, marketing"
            value={(componentDraft.tags ?? []).join(', ')}
            onChange={(event) => setComponentDraft((prev) => ({
              ...prev,
              tags: event.target.value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            }))}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingComponentId(null);
              setComponentDraft(createEmptyComponentDraft());
              setShowSaveDialog(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveComponent}
            variant="contained"
            disabled={!componentDraft.name?.trim() || (!canPersistSelection && !activeEditingComponent?.snapshot)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(activePreviewComponent)}
        onClose={() => setPreviewComponentId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{activePreviewComponent?.name ?? 'Component Preview'}</DialogTitle>
        <DialogContent dividers>
          {activePreviewComponent && (
            <Stack spacing={2}>
              <Alert severity="info">{buildSnapshotSummary(activePreviewComponent.snapshot)}</Alert>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e5e7eb',
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activePreviewComponent.description}
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#111827',
                  color: '#f9fafb',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Code fontSize="small" />
                  <Typography variant="subtitle2" sx={{ color: 'inherit' }}>
                    Snapshot Code Hint
                  </Typography>
                </Stack>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {activePreviewComponent.code.react}
                </pre>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {activePreviewComponent && (
            <Button variant="contained" onClick={() => handleUseComponent(activePreviewComponent)}>
              Use Component
            </Button>
          )}
          <Button onClick={() => setPreviewComponentId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
