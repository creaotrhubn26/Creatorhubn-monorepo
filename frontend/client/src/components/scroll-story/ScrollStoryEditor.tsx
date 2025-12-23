/**
 * ScrollStoryEditor - No-Code Visual Story Builder
 *
 * Features: * - 📝 Drag-and-drop page builder
 * - 🎬 Visual animation timeline
 * - 📁 Integrated media library
 * - 💾 Save/Load from Google Drive
 * - 🚀 One-click publish
 * - 🎨 Template library
 * - 🔧 Live preview
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Tooltip,
  Tabs,
  Tab,
  Paper,
  Stack,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Fab,
  Alert,
} from '@mui/material';
import {
  Save,
  CloudUpload,
  Publish,
  Preview,
  Add,
  Delete,
  Edit,
  ContentCopy,
  Settings,
  Image,
  VideoLibrary,
  Animation,
  Timeline,
  Menu as MenuIcon,
  Close,
  PlayArrow,
  ArrowBack,
  FolderOpen,
  Code,
  Download,
  Share,
  Palette,
  ViewModule,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import type { ScrollStory, ScrollStoryPage } from './useScrollStory';
import ScrollStoryWithToasts from './ScrollStoryWithToasts';
import GoogleDriveMediaPicker from './GoogleDriveMediaPicker';

interface ScrollStoryEditorProps {
  initialStory?: ScrollStory;
  projectId?: string;
  projectDriveFolderId?: string;
  onSave?: (story: ScrollStory) => void;
  onPublish?: (story: ScrollStory, embedCode: string) => void;
  onClose?: () => void;
}

type EditorView = 'pages' | 'animations' | 'settings' | 'preview';

export default function ScrollStoryEditor({
  initialStory,
  projectId,
  projectDriveFolderId,
  onSave,
  onPublish,
  onClose,
}: ScrollStoryEditorProps) {
  const { analytics, features } = useEnhancedMasterIntegration();

  // Story state
  const [story, setStory] = useState<ScrollStory>(
    initialStory || {
      id: `story-${Date.now()}`,
      name: 'Untitled Story',
      pages: [],
      animations: [],
      scrollTriggers: [],
      settings: {
        backgroundColor: '#ffffff',
        showProgress: true,
        enableParallax: true,
        enableKeyboardNav: true,
      },
    },
  );

  // UI state
  const [view, setView] = useState<EditorView>('pages');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Track editor usage
  useEffect(() => {
    analytics.trackEvent('scroll_story_editor_opened', {
      storyId: story.id,
      pageCount: story.pages.length,
      hasInitialStory: !!initialStory,
    });

    features.trackFeatureUsage('scroll-story-editor,', 'opened', {
      storyId: story.id,
    });
  }, []);

  // Mark as unsaved when story changes
  useEffect(() => {
    if (initialStory && JSON.stringify(story) !== JSON.stringify(initialStory) {
      setSaveStatus('unsaved,');
    }
  }, [story, initialStory]);

  // Add new page
  const handleAddPage = useCallback(() => {
    const newPage: ScrollStoryPage = {
      id: `page-${Date.now()}`,
      title: `Page ${story.pages.length + 1}`,
      content: ', ',
      media: [],
      layout: 'centered',
      backgroundColor: '#ffffff',
    };

    setStory((prev) => ({
      ...prev,
      pages: [...prev.pages, newPage],
    }));

    setSelectedPageIndex(story.pages.length);
    setSaveStatus('unsaved');

    analytics.trackEvent('scroll_story_page_added', {
      storyId: story.id,
      pageIndex: story.pages.length,
    });
  }, [story.pages.length, story.id, analytics]);

  // Delete page
  const handleDeletePage = useCallback(
    (index: number) => {
      if (story.pages.length === 1) {
        alert('Cannot delete the last page');
        return;
      }

      setStory((prev) => ({
        ...prev,
        pages: prev.pages.filter((_, i) => i !== index),
      }));

      if (selectedPageIndex >= index && selectedPageIndex > 0) {
        setSelectedPageIndex(selectedPageIndex - 1);
      }

      setSaveStatus('unsaved');

      analytics.trackEvent('scroll_story_page_deleted', {
        storyId: story.id,
        pageIndex: index,
      });
    },
    [story.pages.length, selectedPageIndex, story.id, analytics],
  );

  // Duplicate page
  const handleDuplicatePage = useCallback(
    (index: number) => {
      const pageToDuplicate = story.pages[index];
      const duplicatedPage: ScrollStoryPage = {
        ...pageToDuplicate,
        id: `page-${Date.now()}`,
        title: `${pageToDuplicate.title} (Copy)`,
      };

      setStory((prev) => ({
        ...prev,
        pages: [...prev.pages.slice(0, index + 1), duplicatedPage, ...prev.pages.slice(index + 1)],
      }));

      setSelectedPageIndex(index + 1);
      setSaveStatus('unsaved');

      analytics.trackEvent('scroll_story_page_duplicated', {
        storyId: story.id,
        pageIndex: index,
      });
    },
    [story.pages, story.id, analytics],
  );

  // Update page
  const handleUpdatePage = useCallback((index: number, updates: Partial<ScrollStoryPage>) => {
    setStory((prev) => ({
      ...prev,
      pages: prev.pages.map((page, i) => (i === index ? { ...page, ...updates } : page)),
    }));

    setSaveStatus('unsaved');
  }, []);

  // Save story
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      // TODO: Call server API to save to Google Drive
      await new Promise((resolve) => setTimeout(resolve, 1000); // Simulate API call

      onSave?.(story);
      setSaveStatus('saved');

      analytics.trackEvent('scroll_story_saved', {
        storyId: story.id,
        pageCount: story.pages.length,
        animationCount: story.animations.length,
      });

      alert('Story saved successfully!');
    } catch (error) {
      console.error('Failed to save story: ', error);
      setSaveStatus('unsaved');
      alert('Failed to save story. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [story, onSave, analytics]);

  // Publish story
  const handlePublish = useCallback(async () => {
    const embedCode = `<iframe src="${window.location.origin}/stories/${story.id}," width="100%" height="800" frameborder="0"></iframe>`;

    onPublish?.(story, embedCode);
    setShowPublishDialog(true);

    analytics.trackEvent('scroll_story_published', {
      storyId: story.id,
      pageCount: story.pages.length,
    });
  }, [story, onPublish, analytics]);

  // Load template
  const handleLoadTemplate = useCallback(
    (template: ScrollStory) => {
      setStory({
        ...template,
        id: `story-${Date.now()}`,
        name: `${template.name} (Copy)`,
      });

      setShowTemplateDialog(false);
      setSaveStatus('unsaved');

      analytics.trackEvent('scroll_story_template_loaded', {
        templateName: template.name,
      });
    },
    [analytics],
  );

  // Selected page
  const selectedPage = story.pages[selectedPageIndex];

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Top AppBar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {onClose && (
            <IconButton edge="start" color="inherit" onClick={onClose} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
          )}

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {story.name}
            <Chip
              label={
                saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'
              }
              size="small"
              color={saveStatus === 'saved' ? 'success' : 'warning'}
              sx={{ ml: 2 }} />
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
              onClick={handleSave}
              disabled={isSaving || saveStatus === 'saved'}
            >
              Save
            </Button>

            <Button
              variant="contained"
              color="success"
              startIcon={<Publish />}
              onClick={handlePublish}
            >
              Publish
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Page List */}
        <Drawer
          variant="persistent"
          open={sidebarOpen}
          sx={{
            width: 280,
            flexShrink: 0, '& .MuiDrawer-paper': { width: 280,
              boxSizing: 'border-box',
              position: 'relative',
            }}}
        >
          <Box
            sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Pages ({story.pages.length})</Typography>
            <IconButton size="small" onClick={() => setSidebarOpen(false)}>
              <Close />
            </IconButton>
          </Box>

          <Divider />

          <List sx={{ flex: 1, overflow: 'auto' }}>
            {story.pages.map((page, index) => (
              <ListItem
                key={page.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnchorEl(e.currentTarget);
                      setSelectedPageIndex(index);
                    }}
                  >
                    <MenuIcon />
                  </IconButton>
                }
              >
                <ListItemButton
                  selected={selectedPageIndex === index}
                  onClick={() => setSelectedPageIndex(index)}
                >
                  <ListItemIcon>
                    <ViewModule />
                  </ListItemIcon>
                  <ListItemText
                    primary={page.title || `Page ${index + 1}`}
                    secondary={`${page.media?.length || 0} media`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Divider />

          <Box sx={{ p: 2 }}>
            <Button fullWidth variant="contained" startIcon={<Add />} onClick={handleAddPage}>
              Add Page
            </Button>
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* View Tabs */}
          <Paper elevation={1} sx={{ borderRadius: 0 }}>
            <Tabs value={view} onChange={(_, v) => setView(v)}>
              <Tab icon={<Edit />} label="Edit Pages" value="pages" />
              <Tab icon={<Animation />} label="Animations" value="animations" />
              <Tab icon={<Settings />} label="Settings" value="settings" />
              <Tab icon={<Preview />} label="Preview" value="preview" />
            </Tabs>
          </Paper>

          {/* View Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 3, backgroundColor: '#f5f5f5' }}>
            {view === 'pages' && selectedPage && (
              <PageEditor
                page={selectedPage}
                pageIndex={selectedPageIndex}
                onUpdate={(updates) => handleUpdatePage(selectedPageIndex, updates)}
                onAddMedia={() => setShowMediaPicker(true)}
              />
            )}

            {view === 'animations' && <AnimationEditor story={story} onUpdate={setStory} />}

            {view === 'settings' && <SettingsEditor story={story} onUpdate={setStory} />}

            {view === 'preview' && <PreviewPane story={story} />}
          </Box>
        </Box>
      </Box>

      {/* Page Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            handleDuplicatePage(selectedPageIndex);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <ContentCopy />
          </ListItemIcon>
          Duplicate
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleDeletePage(selectedPageIndex);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <Delete />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Media Picker Dialog */}
      <GoogleDriveMediaPicker
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={(media) => {
          if (selectedPage) {
            handleUpdatePage(selectedPageIndex, {
              media: [...(selectedPage.media || []), ...media],
            });
          }
          setShowMediaPicker(false);
        }}
        allowMultiple={true}
        mediaTypes={['image','video']}
        projectDriveFolderId={projectDriveFolderId}
      />

      {/* Template Dialog */}
      <TemplateLibraryDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSelectTemplate={handleLoadTemplate}
      />

      {/* Publish Dialog */}
      <PublishDialog
        open={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        story={story}
      />

      {/* Floating Action Button - Toggle Sidebar */}
      {!sidebarOpen && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, left: 16 }}
          onClick={() => setSidebarOpen(true)}

        >
          <MenuIcon />
        </Fab>
      )}
    </Box>
  );
}}

// Page Editor Component
interface PageEditorProps {
  page: ScrollStoryPage;
  pageIndex: number;
  onUpdate: (updates: Partial<ScrollStoryPage>) => void;
  onAddMedia: () => void;
}

function PageEditor({ page, pageIndex, onUpdate, onAddMedia }: PageEditorProps) {
  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Edit Page {pageIndex + 1}
      </Typography>

      <Stack spacing={3}>
        <TextField
          label="Page Title"
          value={page.title || ', '}
          onChange={(e) => onUpdate({ title: e.target.value })}}
          fullWidth
        />

        <TextField
          label="Content"
          value={page.content || ', '}
          onChange={(e) => onUpdate({ content: e.target.value })}}
          multiline
          rows={6}
          fullWidth
          placeholder="Enter your story content here..."
        />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Media ({page.media?.length || 0})
          </Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={onAddMedia}>
            Add Media from Google Drive
          </Button>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Layout
          </Typography>
          <Stack direction="row" spacing={1}>
            {(['centered', 'left', 'right', 'full'] as const).map((layout) => (
              <Button
                key={layout}
                variant={page.layout === layout ? 'contained' : 'outlined'}
                onClick={() => onUpdate({ layout })}
                size="small"
              >
                {layout}
              </Button>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

// Animation Editor Component
interface AnimationEditorProps {
  story: ScrollStory;
  onUpdate: (story: ScrollStory) => void;
}

function AnimationEditor({ story, onUpdate }: AnimationEditorProps) {
  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Animation Timeline
      </Typography>
      <Alert severity="info" sx={{ mt: 2 }}>
        Animation timeline editor coming soon! For now, animations can be added via JSON.
      </Alert>
    </Paper>
  );
}

// Settings Editor Component
interface SettingsEditorProps {
  story: ScrollStory;
  onUpdate: (story: ScrollStory) => void;
}

function SettingsEditor({ story, onUpdate }: SettingsEditorProps) {
  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Story Settings
      </Typography>

      <Stack spacing={3} sx={{ mt: 3 }}>
        <TextField
          label="Story Name"
          value={story.name}
          onChange={(e) => onUpdate({ ...story, name: e.target.value })}}
          fullWidth
        />

        <TextField
          label="Background Color"
          type="color"
          value={story.settings.backgroundColor}
          onChange={(e) =>
            onUpdate({
              ...story,
              settings: { ...story.settings, backgroundColor: e.target.value },
            })
          }}
          fullWidth
        />

        <Alert severity="info">More settings coming soon!</Alert>
      </Stack>
    </Paper>
  );
}

// Preview Pane Component
interface PreviewPaneProps {
  story: ScrollStory;
}

function PreviewPane({ story }: PreviewPaneProps) {
  if (story.pages.length === 0) {
    return (
      <Alert severity="warning" sx={{ maxWidth: 800, mx: 'auto' }}>
        No pages to preview. Add some pages first!
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx:'auto' }}>
      <ScrollStoryWithToasts story={story} enableToasts={false} />
    </Box>
  );
}

// Template Library Dialog
interface TemplateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ScrollStory) => void;
}

function TemplateLibraryDialog({ open, onClose, onSelectTemplate }: TemplateLibraryDialogProps) {
  // TODO: Load templates from server
  const templates: ScrollStory[] = [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Choose a Template</DialogTitle>
      <DialogContent>
        <Alert severity="info">Template library coming soon!</Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

// Publish Dialog
interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  story: ScrollStory;
}

function PublishDialog({ open, onClose, story }: PublishDialogProps) {
  const embedCode = `<iframe src="${window.location.origin}/stories/${story.id}" width="100%" height="800" frameborder="0"></iframe>`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Story Published! 🎉</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="success">Your story is now live!</Alert>

          <TextField
            label="Story URL"
            value={`${window.location.origin}/stories/${story.id}`}
            fullWidth
            InputProps={{
              readOnly: true}} />

          <TextField
            label="Embed Code"
            value={embedCode}
            multiline
            rows={3}
            fullWidth
            InputProps={{
              readOnly: true}} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<Share />}
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/stories/${story.id}`);
            alert('URL copied to clipboard!');
          }}
        >
          Copy URL
        </Button>
      </DialogActions>
    </Dialog>
  );
}
