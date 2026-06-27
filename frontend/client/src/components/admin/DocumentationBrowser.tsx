/**
 * Documentation Browser Component
 * 
 * Uses CreatorHub Notes Docs Reader functionality to browse all .md documentation
 * Automatically loads and displays organized documentation from docs/ folder
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Stack,
  Grid,
  Paper,
  Typography,
  TextField,
  IconButton,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Card,
  CardHeader,
  CardContent,
  Tooltip,
  Collapse,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  ContentCopy as ContentCopyIcon,
  ChevronRight as ChevronRightIcon,
  SmartToy as SmartToyIcon,
  Folder as _FolderIcon,
  Description as DescriptionIcon,
  ExpandMore as _ExpandMoreIcon,
  Home as HomeIcon,
  Article as ArticleIcon,
  MenuBook as _MenuBookIcon,
  Refresh as RefreshIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  History as HistoryIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Sort as _SortIcon,
  TrendingUp as _TrendingUpIcon,
  Share as _ShareIcon,
  GetApp as GetAppIcon,
  Lightbulb as LightbulbIcon,
  QuestionAnswer as QuestionAnswerIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { AdminCard, AdminButton, StatusChip, AdminLoading, AdminEmpty, AdminError, AdminTableContainer, adminTokens } from './design-system';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DocFile {
  path: string;
  name: string;
  category: string;
  content?: string;
  html?: string;
  toc?: Array<{ id: string; text: string; level: number }>;
  sections?: Array<{ id: string; level: number; title: string; html: string }>;
}

interface DocCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  fileCount: number;
  subcategories?: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES (from CreatorHub Notes)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function simpleMarkdownToHTML(md: string): string {
  let html = md || '';
  html = html.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${escapeHtml(p1)}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^######\s?(.*)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s?(.*)$/gm, '<h5>$1</h5>')
    .replace(/^####\s?(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s?(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s?(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s?(.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/^(?!<h\d|<ul|<pre|<li|<\/li|<\/ul|<pre)(.+)$/gm, '<p>$1</p>');
  return html;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>" , ']/g, (c) => ({ '&': '&amp;','<': '&lt;','>':'&gt;','"':'&quot;', "'" : '&#39;' }[c] as string));
}

function buildTOCFromHTML(html: string): Array<{ id: string; text: string; level: number }> {
  const container = document.createElement('div');
  container.innerHTML = html;
  const headers = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLHeadingElement[];
  return headers.map((h, i) => {
    const id = h.id || `doc-h-${i}`;
    h.id = id;
    return { id, text: h.textContent || `Section ${i + 1}`, level: Number(h.tagName.substring(1)) };
  });
}

function injectHeaderIds(html: string, toc: Array<{ id: string; text: string; level: number }>) {
  const container = document.createElement('div');
  container.innerHTML = html;
  let idx = 0;
  container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    const t = toc[idx++];
    if (t && !h.id) (h as HTMLHeadingElement).id = t.id;
  });
  return container.innerHTML;
}

function buildSectionsFromHTML(html: string): Array<{ id: string; level: number; title: string; html: string }> {
  const root = document.createElement('div');
  root.innerHTML = html;
  const headers = Array.from(root.querySelectorAll('h1,h2,h3')) as HTMLHeadingElement[];
  if (headers.length === 0) return [{ id: 'doc', level: 1, title: 'Document', html }];
  
  const sections: Array<{ id: string; level: number; title: string; html: string }> = [];
  headers.forEach((h, i) => {
    const id = h.id || `sec-${i}`;
    const level = Number(h.tagName.substring(1));
    const title = h.textContent || `Section ${i + 1}`;
    const range = document.createElement('div');
    let cursor: ChildNode | null = h;
    const next = headers[i + 1];
    while (cursor) {
      range.appendChild(cursor.cloneNode(true));
      cursor = cursor.nextSibling as ChildNode;
      if (next && cursor && cursor.isSameNode && cursor.isSameNode(next)) break;
      if (next && cursor === next) break;
    }
    sections.push({ id, level, title, html: range.innerHTML });
  });
  return sections;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOCUMENTATION CATEGORIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: '01-getting-started',
    name: 'Getting Started',
    icon: '🚀',
    description: 'Installation, setup, quick start guides',
    fileCount: 14
  },
  {
    id: '02-features',
    name: 'Features',
    icon: '✨',
    description: 'Feature documentation & user guides',
    fileCount: 63,
    subcategories: ['video-editor']
  },
  {
    id: '03-integrations',
    name: 'Integrations',
    icon: '🔗',
    description: 'Third-party service integrations',
    fileCount: 116,
    subcategories: ['seo']
  },
  {
    id: '04-admin',
    name: 'Admin',
    icon: '👨‍💼',
    description: 'Admin panel documentation',
    fileCount: 51,
    subcategories: ['prototype-testing']
  },
  {
    id: '05-development',
    name: 'Development',
    icon: '💻',
    description: 'Developer docs & technical specs',
    fileCount: 54
  },
  {
    id: '06-deployment',
    name: 'Deployment',
    icon: '🚢',
    description: 'Production deployment guides',
    fileCount: 19
  },
  {
    id: '07-ai-ml',
    name: 'AI & ML',
    icon: '🤖',
    description: 'AI features & machine learning',
    fileCount: 24
  },
  {
    id: '08-api',
    name: 'API',
    icon: '📡',
    description: 'API reference & specifications',
    fileCount: 6
  },
  {
    id: '09-guides',
    name: 'Guides',
    icon: '📖',
    description: 'Tutorials & step-by-step guides',
    fileCount: 32
  },
  {
    id: '10-troubleshooting',
    name: 'Troubleshooting',
    icon: '🔧',
    description: 'Problem solving & debugging',
    fileCount: 19
  },
  {
    id: '11-archive',
    name: 'Archive',
    icon: '📦',
    description: 'Historical & deprecated docs',
    fileCount: 247
  },
  {
    id: 'visual-guides',
    name: 'Visual Guides',
    icon: '🎨',
    description: 'Diagrams & visual documentation',
    fileCount: 9
  }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DocumentationBrowser() {
  const { analytics, performance, auth, features } = useEnhancedMasterIntegration();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(['Home']);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [_sortBy, _setSortBy] = useState<'name' | 'recent' | 'category'>('name');
  const [recentDocs, setRecentDocs] = useState<string[]>([]);
  const [bookmarkedDocs, setBookmarkedDocs] = useState<string[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<DocFile[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [activeTab, setActiveTab] = useState<'overview' | 'recent' | 'bookmarks' | 'search'>('overview');
  
  // 🎯 Feature Access
  const userProfile = auth.getUserProfile();
  const userId = userProfile?.id || 'anonymous';
  const aiAccess = features.checkFeatureAccess('ai-tools', userProfile?.role);
  const canUseAI = aiAccess.hasAccess;
  
  // Fetch documentation file list from API
  const { data: docFiles = [], isLoading } = useQuery({
    queryKey: ['documentation-files', selectedCategory],
    queryFn: async () => {
      const endTiming = performance.startTiming('fetch_docs');
      try {
        const headers = await auth.getAuthHeader();
        const result = await apiRequest(`/api/docs/list?category=${selectedCategory || 'all'}`, { headers });
        return result as DocFile[];
      } finally {
        endTiming();
      }
    },
    select: (data) => (Array.isArray(data) ? data : []),
  });
  
  // Filter docs by search
  const filteredDocs = useMemo(() => {
    if (!searchQuery) return docFiles;
    const q = searchQuery.toLowerCase();
    return docFiles.filter(doc => 
      doc.name.toLowerCase().includes(q) || 
      doc.path.toLowerCase().includes(q)
    );
  }, [docFiles, searchQuery]);
  
  // Load document content with enhancements
  const loadDocument = useCallback(async (file: DocFile) => {
    const endTiming = performance.startTiming('load_doc');
    
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(`/api/docs/content?path=${encodeURIComponent(file.path)}`, { headers });
      const markdown = response.content;
      
      // Convert markdown to HTML (using CreatorHub Notes logic)
      const rawHtml = simpleMarkdownToHTML(markdown);
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      const toc = buildTOCFromHTML(cleanHtml);
      const withIds = injectHeaderIds(cleanHtml, toc);
      const sections = buildSectionsFromHTML(withIds);
      
      setSelectedFile({
        ...file,
        content: markdown,
        html: withIds,
        toc,
        sections
      });
      
      // Update breadcrumbs
      const pathParts = file.path.split('/');
      setBreadcrumbs(['Home', ...pathParts.slice(0, -1), file.name]);
      
      // 📚 Add to recent docs
      setRecentDocs(prev => {
        const updated = [file.path, ...prev.filter(p => p !== file.path)].slice(0, 10);
        // Persist server-first
        fetch('/api/user/kv', {
          method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
          body: JSON.stringify({ key: 'recentDocs', value: updated })
        }).catch(() => {});
        localStorage.setItem('recentDocs', JSON.stringify(updated));
        return updated;
      });
      
      // 🤖 Find related docs using AI
      if (canUseAI) {
        findRelatedDocs(file);
      }
      
      // Track
      analytics.trackEvent('doc_viewed', { 
        path: file.path, 
        category: file.category,
        userId 
      });
      features.trackFeatureUsage('documentation', 'view-doc', {
        category: file.category
      });
    } catch (e: any) {
      console.error('Failed to load doc: ', e);
    } finally {
      endTiming();
    }
  }, [analytics, performance, auth, features, userId, canUseAI]);
  
  // 🤖 Find related documentation using AI
  const findRelatedDocs = useCallback(async (file: DocFile) => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/docs/related', {
        method: 'POST',
        body: JSON.stringify({
          path: file.path,
          content: file.content?.substring(0, 1000), // First 1000 chars for context
          userId
        }),
        headers
      });
      setRelatedDocs(Array.isArray(response.related) ? response.related : []);
    } catch (e) {
      console.warn('Failed to find related docs:', e);
    }
  }, [auth, userId]);
  
  // 🔖 Toggle bookmark
  const toggleBookmark = useCallback((path: string) => {
    setBookmarkedDocs(prev => {
      const updated = prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path];
      // Persist server-first
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'bookmarkedDocs', value: updated })
      }).catch(() => {});
      localStorage.setItem('bookmarkedDocs', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  // 🤖 Ask AI about entire document
  const askAIAboutDoc = useCallback(async (question: string) => {
    if (!selectedFile || !canUseAI) return;
    
    setShowAIPanel(true);
    const endTiming = performance.startTiming('ai_doc_qa');
    
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/ai/ask-doc', {
        method: 'POST',
        body: JSON.stringify({
          title: selectedFile.name,
          html: selectedFile.html,
          question,
          userId
        }),
        headers
      });
      
      setAiAnswer(response.answer || ', ');
      analytics.trackEvent('ai_doc_question', { docPath: selectedFile.path, userId });
    } catch (e: any) {
      setAiAnswer(`Error: ${e.message || e}`);
    } finally {
      endTiming();
    }
  }, [selectedFile, canUseAI, performance, auth, analytics, userId]);
  
  // Load recent docs server-first (fallback to localStorage)
  useEffect(() => {
    (async () => {
      try {
        const r1 = await fetch('/api/user/kv/recentDocs', { credentials: 'include' });
        const j1 = r1.ok ? await r1.json().catch(() => null) : null;
        const v1 = j1 && typeof j1 === 'object' && 'value' in j1 ? j1.value : j1;
        if (Array.isArray(v1)) setRecentDocs(v1);
      } catch {
        const stored = localStorage.getItem('recentDocs');
        if (stored) setRecentDocs(JSON.parse(stored));
      }
      try {
        const r2 = await fetch('/api/user/kv/bookmarkedDocs', { credentials: 'include' });
        const j2 = r2.ok ? await r2.json().catch(() => null) : null;
        const v2 = j2 && typeof j2 === 'object' && 'value' in j2 ? j2.value : j2;
        if (Array.isArray(v2)) setBookmarkedDocs(v2);
      } catch {
        const bookmarks = localStorage.getItem('bookmarkedDocs');
        if (bookmarks) setBookmarkedDocs(JSON.parse(bookmarks));
      }
    })();
  }, []);
  
  // Highlight search results
  const highlightSearch = (html: string, q: string) => {
    if (!q) return html;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${safe})`, 'gi'), '<mark style="background: yellow; padding: 2px 4px; border-radius: 2px;">$1</mark>');
  };
  
  // Copy all code blocks
  const copyCodeBlocks = () => {
    if (!selectedFile?.html) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = selectedFile.html;
    const blocks = tmp.querySelectorAll('pre > code');
    let copied = 0;
    blocks.forEach((b) => {
      const text = (b.textContent || '').trim();
      if (text) {
        navigator.clipboard.writeText(text);
        copied++;
      }
    });
    setSnackbar({ open: true, message: `Copied ${copied} code block(s) to clipboard`, severity: 'success' });
  };
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  return (
    <Grid container spacing={2} sx={{ p: 2, height: '100vh' }}>
      {/* Enhanced Header with Quick Stats */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                📚 Documentation Browser
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {DOC_CATEGORIES.reduce((sum, cat) => sum + cat.fileCount, 0)} docs
                </Typography>
                <Chip 
                  label={`${recentDocs.length} recent`}
                  size="small"
                  icon={<HistoryIcon />}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
                <Chip 
                  label={`${bookmarkedDocs.length} bookmarked`}
                  size="small"
                  icon={<BookmarkIcon />}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
                {canUseAI && (
                  <Chip 
                    label="AI Enabled"
                    size="small"
                    icon={<SmartToyIcon />}
                    sx={{ bgcolor: 'rgba(76,175,80,0.3)', color: 'white' }}
                  />
                )}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="View Mode">
                <IconButton
                  aria-label="Bytt visningsmodus"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  sx={{ color: 'white' }}
                >
                  {viewMode === 'grid' ? <ViewListIcon /> : <ViewModuleIcon />}
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Grid>
      
      {/* Breadcrumbs */}
      {selectedFile && (
        <Grid item xs={12}>
          <Paper sx={{ p: 1.5 }}>
            <Breadcrumbs>
              <Link 
                component="button" 
                underline="hover" 
                onClick={() => {
                  setSelectedFile(null);
                  setSelectedCategory(null);
                  setBreadcrumbs(['Home']);
                }}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <HomeIcon fontSize="small" />
                Home
              </Link>
              {breadcrumbs.slice(1).map((crumb, idx) => (
                <Typography key={idx} color="text.primary">
                  {crumb}
                </Typography>
              ))}
            </Breadcrumbs>
          </Paper>
        </Grid>
      )}
      
      {/* Main Content */}
      {!selectedFile ? (
        /* Category Overview */
        <>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              aria-label="Søk i dokumentasjon"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setActiveTab('search');
              }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          
          {/* Tabs for different views */}
          <Grid item xs={12}>
            <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Overview" value="overview" />
                <Tab label={`Recent (${recentDocs.length})`} value="recent" />
                <Tab label={`Bookmarks (${bookmarkedDocs.length})`} value="bookmarks" />
                {searchQuery && <Tab label="Search Results" value="search" />}
              </Tabs>
            </Paper>
          </Grid>
          
          {/* Tab Content: Recent Docs */}
          {activeTab === 'recent' && recentDocs.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <HistoryIcon color="primary" />
                  <Typography variant="h6">Recently Viewed</Typography>
                </Stack>
                <List dense>
                  {recentDocs.map((docPath) => (
                    <ListItem key={docPath} disablePadding>
                      <ListItemButton
                        onClick={() => {
                          const file = docFiles.find(f => f.path === docPath);
                          if (file) loadDocument(file);
                        }}
                      >
                        <ListItemIcon>
                          <DescriptionIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={docPath.split('/').pop()}
                          secondary={docPath}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          )}
          
          {/* Tab Content: Bookmarked Docs */}
          {activeTab === 'bookmarks' && bookmarkedDocs.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <BookmarkIcon color="warning" />
                  <Typography variant="h6">Bookmarks</Typography>
                </Stack>
                <List dense>
                  {bookmarkedDocs.map((docPath) => (
                    <ListItem 
                      key={docPath} 
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          aria-label="Fjern bokmerke"
                          onClick={() => toggleBookmark(docPath)}
                        >
                          <BookmarkIcon fontSize="small" color="warning" />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        onClick={() => {
                          const file = docFiles.find(f => f.path === docPath);
                          if (file) loadDocument(file);
                        }}
                      >
                        <ListItemIcon>
                          <DescriptionIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={docPath.split('/').pop()}
                          secondary={docPath}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          )}
          
          {/* Tab Content: Overview - Category Cards */}
          {activeTab === 'overview' && (
            <>
              <Grid item xs={12}>
                <Grid container spacing={2}>
                  {DOC_CATEGORIES.map((category) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={category.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.2s', '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4
                      }
                    }}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setBreadcrumbs(['Home', category.name]);
                      analytics.trackEvent('doc_category_selected', { category: category.id, userId });
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="h3" sx={{ fontSize: '2rem' }}>
                          {category.icon}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {category.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                          {category.description}
                        </Typography>
                        <Chip 
                          label={`${category.fileCount} files`} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                        {category.subcategories && category.subcategories.length > 0 && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {category.subcategories.map(sub => (
                              <Chip 
                                key={sub}
                                label={sub} 
                                size="small" 
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
          
          {/* Quick Links */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                🔥 Popular Documentation
              </Typography>
              <Stack spacing={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ArticleIcon />}
                  onClick={() => {
                    setSelectedCategory('02-features');
                    setBreadcrumbs(['Home','Features']);
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Customer Journey Builder (4 guides)
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ArticleIcon />}
                  onClick={() => {
                    setSelectedCategory('03-integrations');
                    setBreadcrumbs(['Home','Integrations','SEO']);
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  SEO Services (10 guides)
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ArticleIcon />}
                  onClick={() => {
                    setSelectedCategory('03-integrations');
                    setBreadcrumbs(['Home','Integrations']);
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Google Workspace (40+ guides)
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ArticleIcon />}
                  onClick={() => {
                    setSelectedCategory('07-ai-ml');
                    setBreadcrumbs(['Home','AI & ML']);
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  AI Features (24 guides)
                </Button>
              </Stack>
            </Paper>
          </Grid>
            </>
          )}
          
          {/* Tab Content: Search Results */}
          {activeTab === 'search' && searchQuery && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Search Results for "{searchQuery}"
                </Typography>
                <List>
                  {filteredDocs.length > 0 ? (
                    filteredDocs.map((doc) => (
                      <ListItem key={doc.path} disablePadding>
                        <ListItemButton onClick={() => loadDocument(doc)}>
                          <ListItemIcon>
                            <DescriptionIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={doc.name}
                            secondary={doc.path}
                            primaryTypographyProps={{ fontWeight: 500 }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      No results found for "{searchQuery}"
                    </Typography>
                  )}
                </List>
              </Paper>
            </Grid>
          )}
        </>
      ) : selectedCategory && !selectedFile ? (
        /* File List for Category */
        <>
          <Grid item xs={12}>
            <Button
              startIcon={<ChevronRightIcon sx={{ transform: 'rotate(180deg)' }} />}
              onClick={() => {
                setSelectedCategory(null);
                setBreadcrumbs(['Home']);
              }}
            >
              Back to Categories
            </Button>
          </Grid>
          
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {DOC_CATEGORIES.find(c => c.id === selectedCategory)?.icon}{', '}
                {DOC_CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {DOC_CATEGORIES.find(c => c.id === selectedCategory)?.description}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              {isLoading ? (
                <AdminLoading />
              ) : (
                <List>
                  {filteredDocs.map((doc) => (
                    <ListItem key={doc.path} disablePadding>
                      <ListItemButton onClick={() => loadDocument(doc)}>
                        <ListItemIcon>
                          <DescriptionIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={doc.name}
                          secondary={doc.path}
                          primaryTypographyProps={{ fontWeight: 500}}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </>
      ) : (
        /* Document Viewer (using CreatorHub Notes logic) */
        <>
          <Grid item xs={12} md={9}>
            <Card>
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6">{selectedFile?.name || 'Documentation'}</Typography>
                    <Tooltip title={bookmarkedDocs.includes(selectedFile?.path || '') ? 'Remove bookmark' : 'Bookmark this doc'}>
                      <IconButton
                        size="small"
                        aria-label={bookmarkedDocs.includes(selectedFile?.path || '') ? 'Fjern bokmerke' : 'Bokmerk dette dokumentet'}
                        onClick={() => selectedFile && toggleBookmark(selectedFile.path)}
                      >
                        {bookmarkedDocs.includes(selectedFile?.path || '') ? (
                          <BookmarkIcon color="warning" />
                        ) : (
                          <BookmarkBorderIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
                subheader={
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip label={selectedFile?.category} size="small" />
                    <Chip 
                      label={`${selectedFile?.sections?.length || 0} sections`} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      label={`${selectedFile?.toc?.length || 0} headings`} 
                      size="small" 
                      variant="outlined"
                    />
                  </Stack>
                }
                action={
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={<ChevronRightIcon sx={{ transform: 'rotate(180deg)' }} />}
                      onClick={() => {
                        setSelectedFile(null);
                        setBreadcrumbs(['Home', DOC_CATEGORIES.find(c => c.id === selectedCategory)?.name || ',']);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ContentCopyIcon />}
                      onClick={copyCodeBlocks}
                    >
                      Copy Code
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<GetAppIcon />}
                      onClick={() => {
                        if (!selectedFile?.content) return;
                        const blob = new Blob([selectedFile.content], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = selectedFile.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download
                    </Button>
                    {canUseAI && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SmartToyIcon />}
                        onClick={() => setShowAIPanel(!showAIPanel)}
                        color={showAIPanel ? 'success' : 'primary'}
                      >
                        AI Q&A
                      </Button>
                    )}
                  </Stack>
                }
              />
              <CardContent sx={{ height: 'calc(100vh - 300px)', overflow: 'auto' }}>
                {selectedFile?.sections ? (
                  <Stack spacing={2}>
                    {selectedFile.sections.map((sec) => (
                      <Paper key={sec.id} variant="outlined" sx={{ p: 2 }} id={sec.id}>
                        <SectionItem
                          title={sec.title}
                          level={sec.level}
                          html={highlightSearch(sec.html, docSearch)}
                          canUseAI={canUseAI}
                          onCopyCode={(message) => setSnackbar({ open: true, message, severity: 'success' })}
                        />
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <AdminLoading />
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Sidebar: TOC & Search */}
          <Grid item xs={12} md={3}>
            <Stack spacing={2} sx={{ position: 'sticky', top: 16 }}>
              <Paper sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  aria-label="Søk i dokumentet"
                  placeholder="Search in document..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
                  }}
                />
              </Paper>
              
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  📑 Table of Contents
                </Typography>
                <Divider sx={{ my: 1 }} />
                <List dense sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                  {selectedFile?.toc?.map((t) => (
                    <ListItem key={t.id} sx={{ pl: (t.level - 1) * 1.5 }}>
                      <ListItemButton
                        onClick={() =>
                          document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      >
                        <ListItemText 
                          primaryTypographyProps={{ variant: 'body2', fontSize: '0.875rem' }} 
                          primary={t.text} 
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
              
              {/* AI Q&A Panel */}
              {canUseAI && showAIPanel && (
                <Paper sx={{ p: 2, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main' }}>
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <QuestionAnswerIcon color="success" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        Ask AI About This Doc
                      </Typography>
                    </Stack>
                    <TextField
                      fullWidth
                      size="small"
                      aria-label="Still et spørsmål om dokumentet"
                      placeholder="What would you like to know?"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const question = (e.target as HTMLInputElement).value;
                          if (question.trim()) {
                            askAIAboutDoc(question);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    {aiAnswer && (
                      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {aiAnswer}
                        </Typography>
                      </Box>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        fullWidth
                        variant="outlined"
                        onClick={() => askAIAboutDoc('Summarize this document')}
                      >
                        Summarize
                      </Button>
                      <Button
                        size="small"
                        fullWidth
                        variant="outlined"
                        onClick={() => askAIAboutDoc('What are the key points?')}
                      >
                        Key Points
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              
              {/* Related Documents */}
              {relatedDocs.length > 0 && (
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <LightbulbIcon color="info" />
                    <Typography variant="subtitle2" fontWeight="bold">
                      Related Documentation
                    </Typography>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <List dense>
                    {relatedDocs.slice(0, 5).map((doc) => (
                      <ListItem key={doc.path} disablePadding>
                        <ListItemButton onClick={() => loadDocument(doc)}>
                          <ListItemIcon>
                            <DescriptionIcon fontSize="small" color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary={doc.name}
                            primaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
              
              {/* Document Info */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  📊 Document Info
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">Category:</Typography>
                    <Chip label={selectedFile?.category} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">Sections:</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {selectedFile?.sections?.length || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">TOC Items:</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {selectedFile?.toc?.length || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">Size:</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {selectedFile?.content ? `${(selectedFile.content.length / 1024).toFixed(1)} KB` : 'N/A'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        </>
      )}

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Grid>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION ITEM (from CreatorHub Notes)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SectionItem({
  title,
  level,
  html,
  canUseAI,
  onCopyCode
}: {
  title: string;
  level: number;
  html: string;
  canUseAI?: boolean;
  onCopyCode?: (message: string) => void;
}) {
  const [open, setOpen] = useState(true);
  
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton aria-label={open ? 'Skjul seksjon' : 'Vis seksjon'} onClick={() => setOpen((o) => !o)} size="small">
            <ChevronRightIcon
              sx={{
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s'
              }}
            />
          </IconButton>
          <Typography variant={level === 1 ? 'h5' : level === 2 ? 'h6' : 'subtitle1'} fontWeight="bold">
            {title}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {canUseAI && (
            <Tooltip title="Ask AI about this section">
              <IconButton size="small" aria-label="Spør AI om denne seksjonen">
                <SmartToyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Copy code blocks">
            <IconButton
              size="small"
              aria-label="Kopier kodeblokker"
              onClick={() => {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const blocks = tmp.querySelectorAll('pre > code');
                let copied = 0;
                blocks.forEach((b) => {
                  const text = (b.textContent || '').trim();
                  if (text) {
                    navigator.clipboard.writeText(text);
                    copied++;
                  }
                });
                if (copied > 0 && onCopyCode) {
                  onCopyCode(`Copied ${copied} code block(s)`);
                }
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box 
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
          sx={{
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              mt: 2,
              mb: 1,
              fontWeight: 'bold'
            }, '& p': {
              mb: 1
            }, '& ul, & ol': {
              pl: 3,
              mb: 1
            }, '& code': {
              bgcolor: 'grey.100',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.875em'
            },
            '& pre': {
              bgcolor: 'grey.900',
              color: 'white',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              '& code': {
                bgcolor: 'transparent',
                color: 'inherit',
                p: 0
              }
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
              mb: 2
            },
            '& th, & td': {
              border: '1px solid',
              borderColor: 'divider',
              p: 1,
              textAlign: 'left'
            },
            '& th': {
              bgcolor: 'grey.100',
              fontWeight: 'bold'
            }
          }}
        />
      </Collapse>
    </Box>
  );
}

