// @ts-nocheck
/**
 * ScrollStoryEditor - no-code visual story builder
 * Functional editor with pages, templates, media picker, preview and publish dialog
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Add,
  ArrowBack,
  CloudUpload,
  ContentCopy,
  Delete,
  Download,
  FolderOpen,
  Image,
  Menu as MenuIcon,
  PlayArrow,
  Publish,
  Save,
  Settings,
  Share,
  VideoLibrary,
} from '@mui/icons-material';
import type { ScrollStory, ScrollStoryPage } from './useScrollStory';
import GoogleDriveMediaPicker from './GoogleDriveMediaPicker';

interface ScrollStoryEditorProps {
  initialStory?: ScrollStory;
  projectId?: string;
  projectDriveFolderId?: string;
  onSave?: (story: ScrollStory) => void;
  onPublish?: (story: ScrollStory, embedCode: string) => void;
  onClose?: () => void;
}

type EditorView = 'pages' | 'settings' | 'preview';

type StoryPageLayout = 'centered' | 'split' | 'full-bleed';

interface StoryMediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
}

const buildEmptyPage = (index: number): ScrollStoryPage => ({
  id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  title: `Page ${index + 1}`,
  content: '',
  media: [],
  animations: [],
  triggers: [],
  order: index,
});

const buildDefaultStory = (): ScrollStory => {
  const firstPage = buildEmptyPage(0);
  return {
    id: `story-${Date.now()}`,
    name: 'Untitled Story',
    description: '',
    pages: [firstPage],
    scrollTriggers: [],
    animations: [],
    settings: {
      theme: 'light',
      autoplay: false,
      loop: false,
      showProgress: true,
      showControls: true,
      transitionDuration: 800,
      easing: 'ease-in-out',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const buildTemplateStories = (): ScrollStory[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'template-product-launch',
      name: 'Product Launch',
      description: 'Narrative launch page with highlights and CTA.',
      pages: [
        {
          ...buildEmptyPage(0),
          id: 'tpl-launch-1',
          title: 'Opening',
          content: 'Introduce the product story and audience pain-point.',
        },
        {
          ...buildEmptyPage(1),
          id: 'tpl-launch-2',
          title: 'Feature Highlights',
          content: 'Show key moments with supporting visuals and stats.',
          order: 1,
        },
        {
          ...buildEmptyPage(2),
          id: 'tpl-launch-3',
          title: 'Call to Action',
          content: 'Close with a clear CTA and social proof.',
          order: 2,
        },
      ],
      scrollTriggers: [],
      animations: [],
      settings: {
        theme: 'light',
        autoplay: false,
        loop: false,
        showProgress: true,
        showControls: true,
        transitionDuration: 700,
        easing: 'ease-in-out',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'template-documentary',
      name: 'Documentary Arc',
      description: 'Chronological story with evidence and voice-over blocks.',
      pages: [
        {
          ...buildEmptyPage(0),
          id: 'tpl-doc-1',
          title: 'Context',
          content: 'Set historical or project context with opening visuals.',
        },
        {
          ...buildEmptyPage(1),
          id: 'tpl-doc-2',
          title: 'Conflict',
          content: 'Describe challenge and stakes through media and text.',
          order: 1,
        },
        {
          ...buildEmptyPage(2),
          id: 'tpl-doc-3',
          title: 'Resolution',
          content: 'Summarize outcome and next steps.',
          order: 2,
        },
      ],
      scrollTriggers: [],
      animations: [],
      settings: {
        theme: 'dark',
        autoplay: true,
        loop: false,
        showProgress: true,
        showControls: true,
        transitionDuration: 900,
        easing: 'ease-in-out',
      },
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const generateEmbedCode = (storyId: string): string => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `<iframe src="${base}/stories/${storyId}" width="100%" height="800" frameborder="0" allowfullscreen></iframe>`;
};

export default function ScrollStoryEditor({
  initialStory,
  projectDriveFolderId,
  onSave,
  onPublish,
  onClose,
}: ScrollStoryEditorProps): React.ReactElement {
  const [story, setStory] = useState<ScrollStory>(initialStory ?? buildDefaultStory());
  const [view, setView] = useState<EditorView>('pages');
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const templates = useMemo(() => buildTemplateStories(), []);

  const selectedPage = story.pages[selectedPageIndex] ?? null;

  const updateStory = (patch: Partial<ScrollStory>): void => {
    setStory((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
    setSaveStatus('unsaved');
  };

  const updatePage = (index: number, patch: Partial<ScrollStoryPage>): void => {
    setStory((prev) => {
      const pages = prev.pages.map((page, pageIndex) =>
        pageIndex === index ? { ...page, ...patch } : page,
      );
      return {
        ...prev,
        pages,
        updatedAt: new Date().toISOString(),
      };
    });
    setSaveStatus('unsaved');
  };

  const addPage = (): void => {
    setStory((prev) => {
      const newPage = buildEmptyPage(prev.pages.length);
      return {
        ...prev,
        pages: [...prev.pages, newPage],
        updatedAt: new Date().toISOString(),
      };
    });
    setSelectedPageIndex(story.pages.length);
    setSaveStatus('unsaved');
  };

  const duplicatePage = (index: number): void => {
    const source = story.pages[index];
    if (!source) {
      return;
    }

    const duplicated: ScrollStoryPage = {
      ...source,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${source.title} (Copy)`,
      order: index + 1,
    };

    setStory((prev) => {
      const pages = [...prev.pages.slice(0, index + 1), duplicated, ...prev.pages.slice(index + 1)].map(
        (page, pageIndex) => ({ ...page, order: pageIndex }),
      );
      return {
        ...prev,
        pages,
        updatedAt: new Date().toISOString(),
      };
    });
    setSelectedPageIndex(index + 1);
    setSaveStatus('unsaved');
  };

  const deletePage = (index: number): void => {
    if (story.pages.length <= 1) {
      return;
    }

    setStory((prev) => {
      const pages = prev.pages
        .filter((_, pageIndex) => pageIndex !== index)
        .map((page, pageIndex) => ({ ...page, order: pageIndex }));
      return {
        ...prev,
        pages,
        updatedAt: new Date().toISOString(),
      };
    });

    setSelectedPageIndex((prev) => Math.max(0, Math.min(prev, story.pages.length - 2)));
    setSaveStatus('unsaved');
  };

  const handleMediaSelected = (items: StoryMediaItem[]): void => {
    if (!selectedPage) {
      return;
    }

    updatePage(selectedPageIndex, {
      media: [...selectedPage.media, ...items],
    });
    setShowMediaPicker(false);
  };

  const removeMedia = (mediaIndex: number): void => {
    if (!selectedPage) {
      return;
    }

    updatePage(selectedPageIndex, {
      media: selectedPage.media.filter((_, index) => index !== mediaIndex),
    });
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      onSave?.(story);
      setSaveStatus('saved');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = (): void => {
    const embedCode = generateEmbedCode(story.id);
    onPublish?.(story, embedCode);
    setShowPublishDialog(true);
  };

  const loadTemplate = (template: ScrollStory): void => {
    const now = new Date().toISOString();
    const clone: ScrollStory = {
      ...template,
      id: `story-${Date.now()}`,
      name: `${template.name} (Copy)`,
      pages: template.pages.map((page, index) => ({
        ...page,
        id: `page-${Date.now()}-${index}`,
        order: index,
      })),
      createdAt: now,
      updatedAt: now,
    };

    setStory(clone);
    setSelectedPageIndex(0);
    setSaveStatus('unsaved');
    setShowTemplateDialog(false);
  };

  const layoutFromPage = (page: ScrollStoryPage): StoryPageLayout => {
    const value = page.data?.layout;
    return value === 'split' || value === 'full-bleed' ? value : 'centered';
  };

  const setLayoutForPage = (index: number, layout: StoryPageLayout): void => {
    const page = story.pages[index];
    if (!page) {
      return;
    }
    updatePage(index, {
      data: {
        ...(page.data ?? {}),
        layout,
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {onClose ? (
            <IconButton edge="start" color="inherit" onClick={onClose} sx={{ mr: 1 }}>
              <ArrowBack />
            </IconButton>
          ) : null}

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {story.name}
            <Chip
              label={saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
              size="small"
              color={saveStatus === 'saved' ? 'success' : 'warning'}
              sx={{ ml: 1 }}
            />
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<FolderOpen />}
              onClick={() => setShowTemplateDialog(true)}
            >
              Templates
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<Save />}
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving}
            >
              Save
            </Button>
            <Button variant="contained" color="secondary" startIcon={<Publish />} onClick={handlePublish}>
              Publish
            </Button>

            <IconButton color="inherit" onClick={(event) => setMenuAnchor(event.currentTarget)}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setSidebarOpen((prev) => !prev);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>{sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            void handleSave();
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <CloudUpload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save Story</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setShowPublishDialog(true);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Share fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share Link</ListItemText>
        </MenuItem>
      </Menu>

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Drawer
          variant="persistent"
          anchor="left"
          open={sidebarOpen}
          sx={{
            width: 300,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 300,
              boxSizing: 'border-box',
              position: 'relative',
              height: '100%',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Story Pages
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Add />} variant="contained" size="small" onClick={addPage}>
                Add
              </Button>
              <Button
                startIcon={<ContentCopy />}
                variant="outlined"
                size="small"
                disabled={!selectedPage}
                onClick={() => {
                  if (selectedPage) {
                    duplicatePage(selectedPageIndex);
                  }
                }}
              >
                Duplicate
              </Button>
              <Button
                startIcon={<Delete />}
                color="error"
                variant="outlined"
                size="small"
                disabled={story.pages.length <= 1}
                onClick={() => deletePage(selectedPageIndex)}
              >
                Delete
              </Button>
            </Stack>
          </Box>
          <Divider />
          <List sx={{ overflow: 'auto' }}>
            {story.pages.map((page, index) => (
              <ListItemButton
                key={page.id}
                selected={selectedPageIndex === index}
                onClick={() => setSelectedPageIndex(index)}
              >
                <ListItemIcon>
                  <Chip label={index + 1} size="small" />
                </ListItemIcon>
                <ListItemText
                  primary={page.title}
                  secondary={`${page.media.length} assets`}
                  primaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        </Drawer>

        <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
          <Tabs value={view} onChange={(_event, nextView: EditorView) => setView(nextView)}>
            <Tab value="pages" label="Pages" />
            <Tab value="settings" label="Settings" />
            <Tab value="preview" label="Preview" icon={<PlayArrow />} iconPosition="end" />
          </Tabs>

          {view === 'pages' ? (
            selectedPage ? (
              <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Story Name"
                    value={story.name}
                    onChange={(event) => updateStory({ name: event.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="Page Title"
                    value={selectedPage.title}
                    onChange={(event) => updatePage(selectedPageIndex, { title: event.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="Page Content"
                    value={selectedPage.content}
                    onChange={(event) => updatePage(selectedPageIndex, { content: event.target.value })}
                    multiline
                    rows={6}
                    fullWidth
                  />

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2">Layout</Typography>
                    <Button
                      size="small"
                      variant={layoutFromPage(selectedPage) === 'centered' ? 'contained' : 'outlined'}
                      onClick={() => setLayoutForPage(selectedPageIndex, 'centered')}
                    >
                      Centered
                    </Button>
                    <Button
                      size="small"
                      variant={layoutFromPage(selectedPage) === 'split' ? 'contained' : 'outlined'}
                      onClick={() => setLayoutForPage(selectedPageIndex, 'split')}
                    >
                      Split
                    </Button>
                    <Button
                      size="small"
                      variant={layoutFromPage(selectedPage) === 'full-bleed' ? 'contained' : 'outlined'}
                      onClick={() => setLayoutForPage(selectedPageIndex, 'full-bleed')}
                    >
                      Full Bleed
                    </Button>
                  </Stack>

                  <Divider />

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">Media Assets</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Image />}
                      onClick={() => setShowMediaPicker(true)}
                    >
                      Add from Drive
                    </Button>
                  </Stack>

                  {selectedPage.media.length === 0 ? (
                    <Alert severity="info">No media attached to this page yet.</Alert>
                  ) : (
                    <Stack spacing={1.25}>
                      {selectedPage.media.map((media, mediaIndex) => (
                        <Paper key={`${media.url}-${mediaIndex}`} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center">
                              {media.type === 'video' ? <VideoLibrary fontSize="small" /> : <Image fontSize="small" />}
                              <Box>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 540 }}>
                                  {media.url}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {media.type}
                                </Typography>
                              </Box>
                            </Stack>
                            <Button size="small" color="error" onClick={() => removeMedia(mediaIndex)}>
                              Remove
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Select a page to edit.
              </Alert>
            )
          ) : null}

          {view === 'settings' ? (
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Story Settings</Typography>
                <TextField
                  label="Description"
                  value={story.description}
                  onChange={(event) => updateStory({ description: event.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Theme:</Typography>
                  {(['light', 'dark', 'auto'] as const).map((theme) => (
                    <Button
                      key={theme}
                      size="small"
                      variant={story.settings.theme === theme ? 'contained' : 'outlined'}
                      onClick={() =>
                        updateStory({
                          settings: {
                            ...story.settings,
                            theme,
                          },
                        })
                      }
                    >
                      {theme}
                    </Button>
                  ))}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Transition:</Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={story.settings.transitionDuration}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (!Number.isNaN(parsed)) {
                        updateStory({
                          settings: { ...story.settings, transitionDuration: parsed },
                        });
                      }
                    }}
                    sx={{ maxWidth: 140 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    ms
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant={story.settings.autoplay ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateStory({
                        settings: { ...story.settings, autoplay: !story.settings.autoplay },
                      })
                    }
                  >
                    Autoplay {story.settings.autoplay ? 'On' : 'Off'}
                  </Button>
                  <Button
                    variant={story.settings.loop ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateStory({ settings: { ...story.settings, loop: !story.settings.loop } })
                    }
                  >
                    Loop {story.settings.loop ? 'On' : 'Off'}
                  </Button>
                  <Button
                    variant={story.settings.showProgress ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateStory({
                        settings: {
                          ...story.settings,
                          showProgress: !story.settings.showProgress,
                        },
                      })
                    }
                  >
                    Progress {story.settings.showProgress ? 'On' : 'Off'}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ) : null}

          {view === 'preview' ? (
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
              {story.pages.length === 0 ? (
                <Alert severity="warning">No pages available for preview.</Alert>
              ) : (
                <Stack spacing={2}>
                  {story.pages.map((page, index) => (
                    <Paper key={page.id} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1">
                        {index + 1}. {page.title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {page.content || 'No content'}
                      </Typography>
                      {page.media.length > 0 ? (
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                          {page.media.map((media, mediaIndex) => (
                            <Chip
                              key={`${page.id}-${mediaIndex}`}
                              icon={media.type === 'video' ? <VideoLibrary /> : <Image />}
                              label={media.type}
                              size="small"
                            />
                          ))}
                        </Stack>
                      ) : null}
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          ) : null}
        </Box>
      </Box>

      <GoogleDriveMediaPicker
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
        allowMultiple
        mediaTypes={['image', 'video', 'audio']}
        projectDriveFolderId={projectDriveFolderId}
      />

      <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Choose Template</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            {templates.map((template) => (
              <Paper key={template.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box>
                    <Typography variant="subtitle1">{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.description}
                    </Typography>
                  </Box>
                  <Button variant="contained" onClick={() => loadTemplate(template)}>
                    Use
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPublishDialog} onClose={() => setShowPublishDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Story Published</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="success">Story is ready to share.</Alert>
            <TextField
              label="Share URL"
              value={typeof window !== 'undefined' ? `${window.location.origin}/stories/${story.id}` : ''}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Embed Code"
              value={generateEmbedCode(story.id)}
              fullWidth
              multiline
              rows={3}
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPublishDialog(false)}>Close</Button>
          <Button
            startIcon={<Download />}
            onClick={() => {
              const content = JSON.stringify(story, null, 2);
              const blob = new Blob([content], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `${story.name.replace(/\s+/g, '_').toLowerCase()}-story.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
          <Button
            variant="contained"
            startIcon={<Share />}
            onClick={() => {
              const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/stories/${story.id}` : '';
              void navigator.clipboard.writeText(shareUrl);
            }}
          >
            Copy URL
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
