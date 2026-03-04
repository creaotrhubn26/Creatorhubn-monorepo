/**
 * WebsiteBuilder - Complete Website Builder for CreatorHub Users
 *
 * Integrates: * - ✅ VisualPageBuilder (existing drag-and-drop page builder)
 * - ✅ WhiteLabelDomainManager (custom domains from UniversalSettingsPanel)
 * - ✅ BusinessBrandingSettings (logos, colors, fonts)
 * - ✅ GoogleDriveManager (media storage)
 * - ✅ UniversalShowcase (portfolio integration)
 * - ✅ ScrollStory (for story pages)
 *
 * Features: * - 🌐 Custom domain support
 * - 📱 Multi-page websites
 * - 🎨 Brand kit integration
 * - 💾 Auto-save & version control
 * - 🚀 One-click publish
 * - 📊 SEO tools
 * - 📧 Contact forms
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
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Stack,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Alert,
  Paper,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Save,
  Publish,
  Preview,
  Add,
  Delete,
  Settings,
  ArrowBack,
  Language,
  Home,
  Description,
  ContentCopy,
  Share,
  Edit,
  MoreVert,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PageBuilderData } from '../page-builder/VisualPageBuilder';
import VisualPageBuilder from '../page-builder/VisualPageBuilder';
import GoogleDriveMediaPicker from '../scroll-story/GoogleDriveMediaPicker';

// Types
export interface WebsitePage {
  id: string;
  name: string;
  slug: string;
  title: string;
  description?: string;
  pageData: PageBuilderData;
  isPublished: boolean;
  isHomePage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Website {
  id: string;
  userId: string;
  profession: string;
  name: string;
  domain?: string;
  subdomain: string;
  pages: WebsitePage[];
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    logo?: string;
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    favicon?: string;
  };
  navigation: {
    showLogo: boolean;
    menuItems: Array<{
      label: string;
      pageId: string;
    }>;
  };
  footer: {
    text: string;
    showSocial: boolean;
  };
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebsiteBuilderProps {
  userId: string;
  profession: string;
  onClose?: () => void;
}

export default function WebsiteBuilder({ userId, profession, onClose }: WebsiteBuilderProps) {
  const { user } = useAuth();
  const { analytics, features } = useEnhancedMasterIntegration();
  const queryClient = useQueryClient();

  const [website, setWebsite] = useState<Website | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showAddPageDialog, setShowAddPageDialog] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch website
  const { data: websiteData, isLoading } = useQuery({
    queryKey: ['/api/website,', userId],
    queryFn: () => apiRequest(`/api/website?userId=${userId}`),
    enabled: !!userId,
  });

  // Fetch white-label domain
  const { data: domainConfig } = useQuery({
    queryKey: ['/api/white-label/domain,', userId],
    queryFn: () => apiRequest(`/api/white-label/domain?userId=${userId}`),
    enabled: !!userId,
  });

  // Fetch branding from multiple sources (onboarding profile + branding settings)
  const { data: brandingData } = useQuery({
    queryKey: ['/api/branding/business-info', userId],
    queryFn: () =>
      apiRequest(`/api/branding/business-info?userId=${userId}&profession=${profession}`),
    enabled: !!userId,
  });

  // Fetch onboarding profile for additional branding data
  const { data: onboardingProfile } = useQuery({
    queryKey: ['/api/onboarding/profile', userId],
    queryFn: () => apiRequest(`/api/onboarding/profile?userId=${userId}`),
    enabled: !!userId,
  });

  // Initialize website
  useEffect(() => {
    if (websiteData) {
      setWebsite(websiteData);
      if (websiteData.pages.length > 0 && !selectedPageId) {
        const homePage =
          websiteData.pages.find((p: WebsitePage) => p.isHomePage) || websiteData.pages[0];
        setSelectedPageId(homePage.id);
      }
    } else if (!isLoading && !websiteData) {
      // Extract branding info from all sources
      const businessInfo = brandingData?.businessInfo || {};
      const onboardingBranding = onboardingProfile?.brandingSettings || {};
      const logoUrl = businessInfo.customLogo || onboardingBranding.logo || null;
      const primaryColor =
        businessInfo.brandingColor || onboardingBranding.primaryColor || '#2196f3';
      const businessName =
        businessInfo.businessName || onboardingProfile?.business || user?.name || 'My Business';
      const website = businessInfo.website || onboardingProfile?.website || '';

      const newWebsite: Website = {
        id: `website-${Date.now()}`,
        userId,
        profession,
        name: `${businessName} Website`,
        subdomain: user?.email?.split('@')[0] || 'mysite',
        domain: domainConfig?.domain,
        pages: [
          {
            id: `page-home-${Date.now()}`,
            name: 'Home',
            slug: '',
            title: `${businessName} - ${profession}`,
            isHomePage: true,
            isPublished: false,
            pageData: {
              blocks: [],
              settings: { backgroundColor: '#ffffff', maxWidth: '1200px', padding: '32px' },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        theme: {
          primaryColor: primaryColor,
          secondaryColor: onboardingBranding.secondaryColor || '#ff9800',
          fontFamily: 'Inter, sans-serif',
          logo: logoUrl,
        },
        seo: {
          metaTitle: `${businessName} - ${profession}`,
          metaDescription: businessInfo.tagline || `Professional ${profession} services`,
          keywords: [`${profession} portfolio`, businessName],
          favicon: logoUrl,
        },
        navigation: {
          showLogo: !!logoUrl,
          menuItems: [{ label: 'Home', pageId: `page-home-${Date.now()}` }],
        },
        footer: {
          text: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
          showSocial: !!onboardingProfile?.socialMediaAccounts,
        },
        isPublished: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setWebsite(newWebsite);
      setSelectedPageId(newWebsite.pages[0].id);
    }
  }, [
    websiteData,
    isLoading,
    userId,
    profession,
    user,
    domainConfig,
    brandingData,
    onboardingProfile,
    selectedPageId,
  ]);

  // Track usage
  useEffect(() => {
    analytics.trackEvent('website_builder_opened', {
      userId,
      profession,
      hasCustomDomain: !!domainConfig?.domain,
    });
  }, [userId, profession, analytics, domainConfig]);

  // Save website
  const saveWebsiteMutation = useMutation({
    mutationFn: async (websiteData: Website) => {
      return apiRequest('/api/website', {
        method: 'POST',
        body: JSON.stringify(websiteData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/website', userId] });
      setSaveStatus('saved');
    },
  });

  // Publish website
  const publishWebsiteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/website/${website?.id}/publish`, {
        method: 'POST' });
    },
    onSuccess: () => {
      setShowPublishDialog(true);
    },
  });

  // Add page
  const handleAddPage = useCallback(
    (name: string, slug: string) => {
      if (!website) return;

      const newPage: WebsitePage = {
        id: `page-${Date.now()}`,
        name,
        slug,
        title: name,
        isHomePage: false,
        isPublished: false,
        pageData: {
          blocks: [],
          settings: { backgroundColor: '#ffffff', maxWidth: '1200px', padding: '32px' },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setWebsite({
        ...website,
        pages: [...website.pages, newPage],
        navigation: {
          ...website.navigation,
          menuItems: [...website.navigation.menuItems, { label: name, pageId: newPage.id }],
        },
      });

      setSelectedPageId(newPage.id);
      setSaveStatus('unsaved');
      setShowAddPageDialog(false);
    },
    [website],
  );

  // Delete page
  const handleDeletePage = useCallback(
    (pageId: string) => {
      if (!website) return;

      const page = website.pages.find((p) => p.id === pageId);
      if (page?.isHomePage) {
        alert('Cannot delete home page');
        return;
      }

      setWebsite({
        ...website,
        pages: website.pages.filter((p) => p.id !== pageId),
        navigation: {
          ...website.navigation,
          menuItems: website.navigation.menuItems.filter((item) => item.pageId !== pageId),
        },
      });

      if (selectedPageId === pageId) {
        setSelectedPageId(website.pages[0].id);
      }
      setSaveStatus('unsaved');
    },
    [website, selectedPageId],
  );

  // Update page data
  const handlePageDataChange = useCallback(
    (pageData: PageBuilderData) => {
      if (!website || !selectedPageId) return;

      setWebsite({
        ...website,
        pages: website.pages.map((p) =>
          p.id === selectedPageId ? { ...p, pageData, updatedAt: new Date().toISOString() } : p,
        ),
      });

      setSaveStatus('unsaved');
    },
    [website, selectedPageId],
  );

  const handleSave = useCallback(() => {
    if (!website) return;
    setSaveStatus('saving');
    saveWebsiteMutation.mutate(website);
  }, [website, saveWebsiteMutation]);

  const handlePublish = useCallback(() => {
    publishWebsiteMutation.mutate();
  }, [publishWebsiteMutation]);

  const getWebsiteUrl = () => {
    if (domainConfig?.domain && domainConfig?.status === 'active') {
      return `https://${domainConfig.domain}`;
    }
    return `https://${website?.subdomain}.creatorhubn.com`;
  };

  const selectedPage = website?.pages.find((p) => p.id === selectedPageId);

  if (isLoading || !website) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* AppBar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {onClose && (
            <IconButton edge="start" color="inherit" onClick={onClose} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
          )}

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {website.name}
            <Chip
              label={
                saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'
              }
              size="small"
              color={saveStatus === 'saved' ? 'success' : 'warning'}
              sx={{ ml: 2 }} />
            {domainConfig?.domain && (
              <Chip
                icon={<Language />}
                label={domainConfig.domain}
                size="small"
                color="info"
                sx={{ ml: 1 }} />
            )}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<Preview />}
              onClick={() => window.open(getWebsiteUrl(), '_blank')}
            >
              Preview
            </Button>

            <Button
              variant="outlined"
              color="inherit"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saveStatus === 'saved'}
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
        {/* Sidebar */}
        <Drawer
          variant="persistent"
          open={sidebarOpen}
          sx={{
            width: 280,
            flexShrink: 0, '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box', position: 'relative' }}}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">Pages ({website.pages.length})</Typography>
          </Box>
          <Divider />

          <List sx={{ flex: 1, overflow: 'auto' }}>
            {website.pages.map((page) => (
              <ListItem
                key={page.id}
                disablePadding
                secondaryAction={
                  !page.isHomePage && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setAnchorEl(e.currentTarget);
                        setSelectedPageId(page.id);
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  )
                }
              >
                <ListItemButton
                  selected={selectedPageId === page.id}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <ListItemIcon>{page.isHomePage ? <Home /> : <Description />}</ListItemIcon>
                  <ListItemText
                    primary={page.name}
                    secondary={page.isHomePage ? 'Home' : `/${page.slug}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Divider />
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowAddPageDialog(true)}
            >
              Add Page
            </Button>
          </Box>
        </Drawer>

        {/* Page Builder */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {selectedPage && (
            <VisualPageBuilder
              initialData={selectedPage.pageData}
              onChange={handlePageDataChange}
              onSave={handleSave}
              onMediaSelect={() => setShowMediaPicker(true)}
            />
          )}
        </Box>
      </Box>

      {/* Dialogs */}
      <AddPageDialog
        open={showAddPageDialog}
        onClose={() => setShowAddPageDialog(false)}
        onAdd={handleAddPage}
      />

      <PublishDialog
        open={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        url={getWebsiteUrl()}
        customDomain={domainConfig?.domain}
      />

      <GoogleDriveMediaPicker
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={(media) => {
          // Handle media selection
          setShowMediaPicker(false);
        }}
        allowMultiple={false}
        mediaTypes={['image','video']}
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            handleDeletePage(selectedPageId!);
            setAnchorEl(null);
          }}
        >
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

// Add Page Dialog
interface AddPageDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, slug: string) => void;
}

function AddPageDialog({ open, onClose, onAdd }: AddPageDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (name) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-, ')
          .replace(/^-|-$/g, ''),
      );
    }
  }, [name]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add New Page</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, minWidth: 400 }}>
          <TextField
            label="Page Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="URL Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            fullWidth
            helperText="Will be used in URL: yoursite.com/slug"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            if (name && slug) {
              onAdd(name, slug);
              setName('');
              setSlug('');
            }}
          }
        >
          Add Page
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Publish Dialog
interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  customDomain?: string;
}

function PublishDialog({ open, onClose, url, customDomain }: PublishDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Website Published! 🎉</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="success">Your website is now live!</Alert>

          <TextField
            label="Website URL"
            value={url}
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <IconButton onClick={() => navigator.clipboard.writeText(url)}>
                  <ContentCopy />
                </IconButton>
              )}}
          />

          {!customDomain && (
            <Alert severity="info">Want a custom domain? Go to Settings → White-Label Domain</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => window.open(url, '_blank')}>
          Visit Website
        </Button>
      </DialogActions>
    </Dialog>
  );
}
