/**
 * CreatorHub Notes - Complete Feature Set
 * 
 * Features:
 * - Rich text editing with Quill
 * - Interactive Docs Reader (Markdown/PDF)
 * - Full QuillBot-style AI tools suite
 * - Google Drive/Docs integration
 * - Smart tasks and analysis
 * - EnhancedMasterIntegration
 * - DOMPurify sanitization
 * - Debounced search
 * - Accessibility support
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Box,
  Stack,
  Grid,
  Tabs,
  Tab,
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
  ListItemAvatar,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Card,
  CardHeader,
  CardContent,
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fab,
  Badge,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// MUI Icons
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import IosShareIcon from '@mui/icons-material/IosShare';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TransformIcon from '@mui/icons-material/Transform';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import SubjectIcon from '@mui/icons-material/Subject';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TranslateIcon from '@mui/icons-material/Translate';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import ArticleIcon from '@mui/icons-material/Article';
import BookIcon from '@mui/icons-material/Book';
import EmailIcon from '@mui/icons-material/Email';
import WorkIcon from '@mui/icons-material/Work';
import TitleIcon from '@mui/icons-material/Title';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NotesIcon from '@mui/icons-material/Notes';
import EditIcon from '@mui/icons-material/Edit';
import CloudIcon from '@mui/icons-material/Cloud';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import SpeedIcon from '@mui/icons-material/Speed';
import BugReportIcon from '@mui/icons-material/BugReport';
import TimelineIcon from '@mui/icons-material/Timeline';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import RichTextEditor from '../RichTextEditor';
import GoogleDriveDocsBridge from './GoogleDriveDocsBridge';
import NorwegianDictionaryPanel from './NorwegianDictionaryPanel';
import ContextualWordSuggestions from './ContextualWordSuggestions';
import 'quill/dist/quill.snow.css';
import { quillModules, quillFormats, EMPTY_HTML } from '../notes/constants';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type NoteStatus = 'draft' | 'active' | 'archived';
export type NoteCategory = 'all' | 'ideas' | 'docs' | 'tasks' | 'research' | 'project' | 'meeting';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  status: NoteStatus;
  tags?: string[];
  updatedAt: string;
  createdAt: string;
  isShared?: boolean;
  googleDocsId?: string;
}

export interface DatabaseAnalysis {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    relations: string[];
  }>;
  patterns: string[];
  suggestions: string[];
}

export interface CodebaseAnalysis {
  components: string[];
  patterns: string[];
  apiEndpoints: string[];
  commonStructures: string[];
}

export interface APIDiscovery {
  name: string;
  category: string;
  description: string;
  auth: 'none' | 'key' | 'oauth' | 'bearer';
  pricing: 'free' | 'freemium' | 'paid';
  endpoints: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description?: string;
  }>;
  norwegianSupport: boolean;
}

export interface GeneratedCode {
  react?: string;
  typescript?: string;
  css?: string;
  html?: string;
  api?: string;
  db?: string;
}

export interface ImprovementTask {
  id: string;
  title: string;
  description: string;
  done: boolean;
  priority?: 'low' | 'medium' | 'high';
}

interface AIContextState {
  databaseSchema: DatabaseAnalysis;
  codebasePatterns: CodebaseAnalysis;
  apis: APIDiscovery[];
  generated: GeneratedCode;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function analyzeText(text: string) {
  const trimmed = (text || '').trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const sentences = trimmed ? (trimmed.match(/[.!?]+\s|.$/g)?.length ?? 0) : 0;
  const paragraphs = trimmed ? trimmed.split(/\n{2,}/).length : 0;
  const charactersNoSpaces = trimmed.replace(/\s/g, ',').length;
  const characters = trimmed.length;
  const readingTime = Math.ceil(words / 200);
  const averageWordsPerSentence = sentences > 0 ? Math.round(words / sentences) : 0;
  
  return { words, sentences, paragraphs, charactersNoSpaces, characters, readingTime, averageWordsPerSentence };
}

function useDebouncedValue<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

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
  return s.replace(/[&<>, ", ']/g, (c) => ({ '&': '&amp;','<': '&lt;','>':'&gt;','"':'&quot;', "'" : '&#39;' }[c] as string));
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
  if (typeof document === 'undefined') return html;
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

// Quill configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreatorHubNotesInner() {
  const qc = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  const theming = useTheming(currentProfession);
  const themeColors = { ...theming.colors, primary: '#ff8c00' };

  // 🔥 Enhanced Master Integration - FULL UTILIZATION
  const {
    communication,
    analytics,
    lifecycle,
    auth,
    features,
    performance: perf,
    health,
    debugging
  } = useEnhancedMasterIntegration();
  
  // 🔐 User Context
  const userProfile = auth.getUserProfile();
  const userId = userProfile?.id || 'anonymous';
  const isAuthenticated = auth.state.isAuthenticated;

  // Main UI state
  const [mainTab, setMainTab] = useState<'notes' | 'docs' | 'ai-tools'>('notes');
  const [category, setCategory] = useState<NoteCategory>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editorHTML, setEditorHTML] = useState('');
  const [preview, setPreview] = useState(false);
  
  // 🔗 Documentation Browser Integration
  const [showDocBrowser, setShowDocBrowser] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState<string[]>([]); // Docs referenced in current note
  const [docSuggestions, setDocSuggestions] = useState<any[]>([]); // AI-suggested relevant docs
  
  // 📖 Norwegian Dictionary Integration
  const [showDictionary, setShowDictionary] = useState(false);
  const [selectedTextForDict, setSelectedTextForDict] = useState('');
  const [dictionaryHistory, setDictionaryHistory] = useState<any[]>([]);
  const [dictionaryBookmarks, setDictionaryBookmarks] = useState<any[]>([]);
  
  // 💡 Contextual Word Suggestions
  const [showWordSuggestions, setShowWordSuggestions] = useState(true); // Auto-enabled
  const [wordSuggestionsCount, setWordSuggestionsCount] = useState(0);

  // Google integration
  const [googleDriveFolder, setGoogleDriveFolder] = useState<string | null>(null);
  const [openExportDialog, setOpenExportDialog] = useState(false);
  const [shareWithEmail, setShareWithEmail] = useState('');

  // AI Context
  const [aiContext, setAiContext] = useState<AIContextState>({
    databaseSchema: { tables: [], patterns: [], suggestions: [] },
    codebasePatterns: { components: [], patterns: [], apiEndpoints: [], commonStructures: [] },
    apis: [],
    generated: {},
  });
  const [aiBusy, setAiBusy] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // 🎯 Feature Access Control
  const aiToolsAccess = features.checkFeatureAccess('ai-tools', userProfile?.role);
  const googleDriveAccess = features.checkFeatureAccess('google-drive-integration', userProfile?.role);
  const canUseAI = aiToolsAccess.hasAccess;
  const canUseGoogleDrive = googleDriveAccess.hasAccess;
  
  // 🐛 Debug Mode
  const [debugMode, setDebugMode] = useState(false);
  useEffect(() => {
    debugging.enableDebugMode(debugMode);
  }, [debugMode, debugging]);

  // Docs mode state
  const [docHTML, setDocHTML] = useState('');
  const [docTOC, setDocTOC] = useState<Array<{ id: string; text: string; level: number }>>([]);
  const [docSearch, setDocSearch] = useState('');
  const docSearchDebounced = useDebouncedValue(docSearch, 250);
  const [docSections, setDocSections] = useState<Array<{ id: string; level: number; title: string; html: string }>>([]);
  const [aiAnswer, setAiAnswer] = useState<string>('');

  // QuillBot-style tools state
  const [showParaphraser, setShowParaphraser] = useState(false);
  const [showGrammarChecker, setShowGrammarChecker] = useState(false);
  const [showSummarizer, setShowSummarizer] = useState(false);
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [showTranslator, setShowTranslator] = useState(false);
  const [showCitationGen, setShowCitationGen] = useState(false);
  const [showContentGen, setShowContentGen] = useState(false);
  const [showAIDetector, setShowAIDetector] = useState(false);
  const [showWordCounter, setShowWordCounter] = useState(false);

  // Tool inputs/outputs
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paraphraseMode, setParaphraseMode] = useState('standard');
  const [selectedLanguage, setSelectedLanguage] = useState('nb');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [citationStyle, setCitationStyle] = useState('apa');
  const [summaryFormat, setSummaryFormat] = useState('bullets');
  const [contentType, setContentType] = useState('paragraph');

  // 🔄 Register component & setup communication
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'creatorhub-notes',
      type: 'admin',
      version: '2.0.0',
      capabilities: {
        data: ['notes','docs','ai-context'],
        events: ['note-saved','doc-uploaded','ai-processed'],
        actions: ['create','edit','delete','ai-analyze'],
        ui: ['editor','preview','docs-reader'],
        system: ['google-integration','ai-tools']
      },
      dependencies: ['quill','dompurify','google-apis'],
      lastActive: Date.now(),
      performance: { renderCount: 0, avgRenderTime: 0, memoryUsage: 0 }
    });
    
    // 📢 Subscribe to cross-component events
    const unsubscribeProject = communication.onMessageType('project-selected', (message) => {
      debugging.logIntegration('info', 'Project selected event received', message.data);
      if (message.data?.projectName) {
        setSnack({ 
          open: true, 
          message: `Ready to create note, for: ${message.data.projectName}`,
          severity: 'info' 
        });
      }
    });
    
    const unsubscribeClient = communication.onMessageType('client-added', (message) => {
      debugging.logIntegration('info','Client added event received', message.data);
    });
    
    const unsubscribeTask = communication.onMessageType('task-completed', (message) => {
      debugging.logIntegration('info','Task completed event received', message.data);
    });
    
    // 🚀 Listen for "Journey Saved" events for auto-documentation and bi-directional sync
    const unsubscribeJourneySaved = communication.onMessageType('journey-saved-for-note', (message) => {
      const { 
        journeyName, 
        journeyDescription, 
        stageCount, 
        touchpointCount, 
        personaCount,
        linkedNoteId,
        fullJourneyData
      } = message.data;
      
      debugging.logIntegration('info','Journey saved - handling sync/documentation', message.data);
      
      // 🔗 Bi-Directional Sync: Update linked note if it exists
      if (linkedNoteId) {
        const linkedNote = notes.find((n: any) => n.id === linkedNoteId);
        if (linkedNote) {
          // Auto-update note with journey summary
          const updatedContent = `
            <div style="border: 2px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 16px 0; background: #eff6ff;">
              <h3 style="color: #3b82f6; margin-top: 0;">🗺️ Linked Journey: ${journeyName}</h3>
              <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
              <ul>
                <li><strong>Stages:</strong> ${stageCount}</li>
                <li><strong>Touchpoints:</strong> ${touchpointCount}</li>
                <li><strong>Personas:</strong> ${personaCount}</li>
              </ul>
              <p><em>This journey is linked to this note. Changes sync automatically.</em></p>
            </div>
            ${linkedNote.content}
          `;
          
          // Update the note silently
          updateNote.mutate({
            id: linkedNoteId,
            payload: { content: updatedContent }
          });
          
          setSnack({
            open: true,
            message: `🔗 Linked note, updated: "${linkedNote.title},"`,
            severity: 'success'
          });
          
          return; // Don't create new note if linked
        }
      }
      
      // 📝 Auto-Documentation: Show notification with option to create doc
      setSnack({
        open: true,
        message: `Journey "${journeyName}" saved! View in Customer Journey Builder.`,
        severity: 'info'
      });
      
      // Log auto-doc opportunity
      analytics.trackEvent('journey_saved_notification', {
        journeyName,
        stageCount,
        touchpointCount,
        userId
      });
    });

    return () => {
      lifecycle.unregisterComponent('creatorhub-notes');
      unsubscribeProject();
      unsubscribeClient();
      unsubscribeTask();
      unsubscribeJourneySaved();
    };
  }, [lifecycle, communication, debugging]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA FETCHING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 📝 Fetch notes with authentication
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['notes', userId],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/notes', { headers });
      return response as Note[];
    },
    enabled: isAuthenticated,
    staleTime: 15000,
  });

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  const filteredNotes = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return notes
      .filter((n) => (category === 'all' ? true : n.category === category))
      .filter((n) => (!q ? true : n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes, category, debouncedSearch]);

  const stats = useMemo(() => analyzeText(editorHTML), [editorHTML]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MUTATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const createNote = useMutation({
    mutationFn: async (payload: Partial<Note>) => {
      const endTiming = perf.startTiming('note_create');
      try {
        const headers = await auth.getAuthHeader();
        return await apiRequest('/api/notes', { 
          method: 'POST', 
          body: JSON.stringify({ ...payload, userId }), 
          headers 
        });
      } finally {
        endTiming();
      }
    },
    onSuccess: (n: Note) => {
      setSnack({ open: true, message: 'Note created', severity: 'success' });
      qc.invalidateQueries({ queryKey: ['notes', userId] });
      setSelectedNoteId(n.id);
      setEditorHTML(n.content);
      
      // 🎯 Enhanced tracking
      analytics.trackEvent('note_created', { category: n.category, userId });
      features.trackFeatureUsage('notes','create', { category: n.category });
      
      // 📢 Broadcast event
      communication.sendBroadcast('note-created', { 
        noteId: n.id, 
        category: n.category, 
        title: n.title 
      }, 'medium');
    },
    onError: (e: any) => setSnack({ open: true, message: String(e.message || e), severity: 'error' }),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Note> }) => {
      const endTiming = perf.startTiming('note_update');
      try {
        const headers = await auth.getAuthHeader();
        return await apiRequest(`/api/notes/${id}`, { 
          method: 'PUT', 
          body: JSON.stringify(payload), 
          headers 
        });
      } finally {
        endTiming();
      }
    },
    onSuccess: () => {
      setSnack({ open: true, message: 'Note saved', severity: 'success' });
      qc.invalidateQueries({ queryKey: ['notes', userId] });
      
      // 🎯 Enhanced tracking
      analytics.trackEvent('note_updated', { noteId: selectedNoteId, userId });
      features.trackFeatureUsage('notes','update', { noteId: selectedNoteId });
      
      // 📢 Broadcast event
      communication.sendBroadcast('note-updated', { 
        noteId: selectedNoteId 
      }, 'low');
    },
    onError: (e: any) => setSnack({ open: true, message: String(e.message || e), severity: 'error' }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const endTiming = perf.startTiming('note_delete');
      try {
        const headers = await auth.getAuthHeader();
        return await apiRequest(`/api/notes/${id}`, { method: 'DELETE', headers });
      } finally {
        endTiming();
      }
    },
    onSuccess: () => {
      setSnack({ open: true, message: 'Note deleted', severity: 'success' });
      qc.invalidateQueries({ queryKey: ['notes', userId] });
      setSelectedNoteId(null);
      setEditorHTML('');
      
      // 🎯 Enhanced tracking
      analytics.trackEvent('note_deleted', { userId });
      features.trackFeatureUsage('notes','delete', {});
      
      // 📢 Broadcast event
      communication.sendBroadcast('note-deleted', { 
        noteId: selectedNoteId 
      }, 'low');
    },
    onError: (e: any) => setSnack({ open: true, message: String(e.message || e), severity: 'error' }),
  });

  const askAIAboutSection = useMutation({
    mutationFn: async (payload: { title: string; html: string }) => {
      // 🔐 Check AI access
      if (!canUseAI) {
        throw new Error(aiToolsAccess.reason);
      }
      
      const endTiming = perf.startTiming('ai_doc_qa');
      try {
        const headers = await auth.getAuthHeader();
        return await apiRequest('/api/ai/ask-doc', { 
          method: 'POST', 
          body: JSON.stringify({ ...payload, userId }), 
          headers 
        });
      } finally {
        endTiming();
      }
    },
    onSuccess: (r: { answer: string }) => {
      setAiAnswer(r.answer || '');
      setSnack({ open: true, message: 'AI answered', severity: 'success' });
      
      // 🎯 Track AI usage
      features.trackFeatureUsage('ai-tools','document-qa', { 
        answerLength: r.answer?.length || 0 
      });
    },
    onError: (e: any) => setSnack({ open: true, message: String(e.message || e), severity: 'error' }),
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleSelectNote = (note: Note) => {
    setSelectedNoteId(note.id);
    setEditorHTML(note.content);
    setPreview(false);
  };

  const handleSave = () => {
    if (!selectedNote) return;
    updateNote.mutate({
      id: selectedNote.id,
      payload: { ...selectedNote, content: editorHTML, updatedAt: new Date().toISOString() }
    });
  };

  const handleCreate = () => {
    const now = new Date().toISOString();
    createNote.mutate({
      id: crypto.randomUUID(),
      title: 'Untitled',
      content: EMPTY_HTML,
      category: 'ideas',
      status: 'draft',
      createdAt: now,
      updatedAt: now
    });
  };

  const handleExportToGoogleDoc = async () => {
    if (!selectedNote) return;
    
    // 🔐 Check Google Drive access
    if (!canUseGoogleDrive) {
      setSnack({ open: true, message: googleDriveAccess.reason, severity: 'warning' });
      return;
    }
    
    const endTiming = perf.startTiming('google_docs_export');
    
    try {
      const headers = await auth.getAuthHeader();
      const created = await apiRequest('/api/google/docs/create', {
        method: 'POST',
        body: JSON.stringify({
          title: selectedNote.title,
          html: selectedNote.content,
          folderId: googleDriveFolder,
          userId
        }),
        headers
      });
      
      if (shareWithEmail) {
        await apiRequest('/api/google/drive/share', {
          method: 'POST',
          body: JSON.stringify({
            fileId: created.docId,
            email: shareWithEmail,
            role: 'writer'
          }),
          headers
        });
      }
      
      setSnack({ open: true, message: 'Exported to Google Docs', severity: 'success' });
      setOpenExportDialog(false);
      
      // 🎯 Enhanced tracking
      analytics.trackEvent('note_exported_to_gdocs', { noteId: selectedNote.id, userId });
      features.trackFeatureUsage('google-drive-integration','export-doc', { 
        noteId: selectedNote.id,
        shared: !!shareWithEmail
      });
      
      // 📢 Broadcast event
      communication.sendBroadcast('note-exported', { 
        noteId: selectedNote.id, 
        docId: created.docId 
      }, 'medium');
    } catch (e: any) {
      setSnack({ open: true, message: `Export, failed: ${String(e.message || e)}`, severity: 'error' });
    } finally {
      endTiming();
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AI PIPELINE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const analyzeDatabase = async (): Promise<DatabaseAnalysis> => {
    const endTiming = perf.startTiming('ai_database_analysis');
    try {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/analyze-database', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers
      });
      return result as DatabaseAnalysis;
    } finally {
      endTiming();
    }
  };

  const analyzeCodebase = async (): Promise<CodebaseAnalysis> => {
    const endTiming = perf.startTiming('ai_codebase_analysis');
    try {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/analyze-codebase', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers
      });
      return result as CodebaseAnalysis;
    } finally {
      endTiming();
    }
  };

  const performWebSearch = async (query: string): Promise<string[]> => {
    const endTiming = perf.startTiming('ai_web_search');
    try {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/web-search', {
        method: 'POST',
        body: JSON.stringify({ query, userId }),
        headers
      });
      return result as string[];
    } finally {
      endTiming();
    }
  };

  const discoverAPIs = async (): Promise<APIDiscovery[]> => {
    const endTiming = perf.startTiming('ai_api_discovery');
    try {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/discover-apis', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers
      });
      return result as APIDiscovery[];
    } finally {
      endTiming();
    }
  };

  const generateCode = async (ctx: AIContextState): Promise<GeneratedCode> => {
    const endTiming = perf.startTiming('ai_code_generation');
    try {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ ...ctx, userId }),
        headers
      });
      return result as GeneratedCode;
    } finally {
      endTiming();
    }
  };

  const runFullAIAnalysis = async () => {
    if (aiBusy) return;
    
    // 🔐 Check AI access
    if (!canUseAI) {
      setSnack({ open: true, message: aiToolsAccess.reason, severity: 'warning' });
      return;
    }
    
    setAiBusy(true);
    const endTiming = perf.startTiming('ai_full_analysis');
    
    try {
      const db = await analyzeDatabase();
      setAiContext((p) => ({ ...p, databaseSchema: db }));
      
      const code = await analyzeCodebase();
      setAiContext((p) => ({ ...p, codebasePatterns: code }));
      
      await performWebSearch('project relevant search');
      
      const apis = await discoverAPIs();
      setAiContext((p) => ({ ...p, apis }));
      
      const gen = await generateCode({
        databaseSchema: db,
        codebasePatterns: code,
        apis,
        generated: {}
      });
      setAiContext((p) => ({ ...p, generated: gen }));
      
      setSnack({ open: true, message: 'AI analysis complete', severity: 'success' });
      
      // 🎯 Enhanced tracking
      analytics.trackEvent('ai_analysis_complete', { userId });
      features.trackFeatureUsage('ai-tools','full-analysis', {
        tablesAnalyzed: db.tables.length,
        componentsFound: code.components.length,
        apisDiscovered: apis.length
      });
      
      // 📢 Broadcast event
      communication.sendBroadcast('ai-analysis-complete', { 
        databaseTables: db.tables.length, 
        components: code.components.length 
      }, 'high');
    } catch (e: any) {
      setSnack({ open: true, message: `AI, failed: ${String(e.message || e)}`, severity: 'error' });
    } finally {
      setAiBusy(false);
      endTiming();
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // QUILLBOT-STYLE AI TOOLS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // 🔥 AI Operation Wrapper - Adds feature gating, auth, and performance tracking
  const runAIOperation = async <T,>(
    operationName: string,
    apiPath: string,
    payload: any,
    featureAction: string
  ): Promise<T> => {
    // 🔐 Check AI access
    if (!canUseAI) {
      throw new Error(aiToolsAccess.reason);
    }
    
    const endTiming = perf.startTiming(`ai_${operationName}`);
    
    try {
      const headers = await auth.getAuthHeader();
      const result = await apiRequest(apiPath, {
        method: 'POST',
        body: JSON.stringify({ ...payload, userId }),
        headers
      });
      
      // 🎯 Track feature usage
      features.trackFeatureUsage('ai-tools', featureAction, {
        inputLength: payload.text?.length || 0,
        userId
      });
      
      return result as T;
    } finally {
      endTiming();
    }
  };
  
  // 🚀 Convert Note to Customer Journey
  const handleConvertToJourney = async () => {
    if (!selectedNote) return;
    
    // 🔐 Check access
    if (!canUseAI) {
      setSnack({ open: true, message: aiToolsAccess.reason, severity: 'warning' });
      return;
    }
    
    setIsProcessing(true);
    const endTiming = perf.startTiming('note_to_journey_conversion');
    
    try {
      const headers = await auth.getAuthHeader();
      
      // 🤖 AI analyzes note and extracts journey structure
      const journeyStructure = await apiRequest('/api/ai/extract-journey', {
        method: 'POST',
        body: JSON.stringify({
          noteTitle: selectedNote.title,
          noteContent: selectedNote.content,
          userId
        }),
        headers
      });
      
      // 📢 Broadcast to Customer Journey Builder
      communication.sendBroadcast('create-journey-from-note', {
        noteId: selectedNote.id,
        noteTitle: selectedNote.title,
        journeyStructure,
        userId
      }, 'high');
      
      setSnack({ 
        open: true, 
        message: 'Journey created! Switch to Customer Journey Builder to view.', 
        severity: 'success' 
      });
      
      // 🎯 Track conversion
      analytics.trackEvent('note_converted_to_journey', { 
        noteId: selectedNote.id, 
        userId 
      });
      features.trackFeatureUsage('notes','convert-to-journey', {
        noteId: selectedNote.id,
        contentLength: selectedNote.content.length
      });
    } catch (e: any) {
      setSnack({ 
        open: true, 
        message: `Conversion, failed: ${String(e.message || e)}`,
        severity: 'error' 
      });
    } finally {
      setIsProcessing(false);
      endTiming();
    }
  };
  
  // 🔗 Link Documentation to Note
  const handleLinkDoc = useCallback((docPath: string) => {
    if (!selectedNote) return;
    
    // Add doc reference to note content
    const docName = docPath.split('/').pop();
    const docLink = `
      <div style="border: 2px solid #2196f3; padding: 12px; border-radius: 8px; margin: 8px 0; background: #e3f2fd;">
        <strong>📚 Referenced Doc:</strong> 
        <a href="#" data-doc-path="${docPath}" style="color: #1976d2; text-decoration: none;">
          ${docName}
        </a>
        <br/>
        <small style="color: #666;">${docPath}</small>
      </div>
    `;
    
    setEditorHTML(prev => prev + docLink);
    setLinkedDocs(prev => [...new Set([...prev, docPath])]);
    
    setSnack({
      open: true,
      message: `Doc "${docName}" linked to note`,
      severity: 'success'
    });
    
    analytics.trackEvent('doc_linked_to_note', {
      noteId: selectedNote.id,
      docPath,
      userId
    });
  }, [selectedNote, analytics, userId]);
  
  // 🤖 Get AI-Suggested Documentation
  const getSuggestedDocs = useCallback(async () => {
    if (!selectedNote || !canUseAI) return;
    
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/docs/suggest', {
        method: 'POST',
        body: JSON.stringify({
          noteTitle: selectedNote.title,
          noteContent: selectedNote.content,
          userId
        }),
        headers
      });
      
      setDocSuggestions(response.suggestions || []);
      
      analytics.trackEvent('doc_suggestions_fetched', {
        noteId: selectedNote.id,
        suggestionsCount: response.suggestions?.length || 0,
        userId
      });
    } catch (e) {
      console.warn('Failed to get doc suggestions: ', e);
    }
  }, [selectedNote, canUseAI, auth, analytics, userId]);
  
  // Auto-suggest docs when note is selected
  useEffect(() => {
    if (selectedNote && canUseAI) {
      getSuggestedDocs();
    }
  }, [selectedNote?.id, canUseAI]);

  const paraphraseModes = [
    { value: 'standard', label: 'Standard', description: 'Balanced rewriting' },
    { value: 'fluency', label: 'Fluency', description: 'Improves flow and readability' },
    { value: 'creative', label: 'Creative', description: 'Creative and original' },
    { value: 'formal', label: 'Formal', description: 'Professional and formal' },
    { value: 'shorten', label: 'Shorten', description: 'Condense text' },
    { value: 'expand', label: 'Expand', description: 'Expand text' },
  ];

  const languages = [
    { code: 'nb', name: 'Norsk (Bokmål)' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'sv', name: 'Svenska' },
    { code: 'da', name: 'Dansk' },
  ];

  const citationStyles = [
    { value: 'apa', label: 'APA 7th Edition' },
    { value: 'mla', label: 'MLA 9th Edition' },
    { value: 'chicago', label: 'Chicago 17th' },
    { value: 'harvard', label: 'Harvard Style' },
  ];

  const handleParaphrase = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ paraphrased: string }>(
        'paraphrase',
        '/api/ai/paraphrase',
        { text: inputText, mode: paraphraseMode },
        'paraphrase'
      );
      setOutputText(response.paraphrased || '');
      setSnack({ open: true, message: 'Text paraphrased', severity: 'success' });
      analytics.trackEvent('text_paraphrased', { mode: paraphraseMode, userId });
    } catch (e: any) {
      setDocHTML('');
    setDocTOC([]);
    setDocSections([]);
    setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGrammarCheck = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ corrected: string; corrections: any[] }>(
        'grammar',
        '/api/ai/grammar',
        { text: inputText },
        'grammar-check'
      );
      setOutputText(response.corrected || '');
      setSnack({ open: true, message: `Fixed ${response.corrections?.length || 0} errors`, severity: 'success' });
      analytics.trackEvent('grammar_checked', { userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSummarize = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ summary: string }>(
        'summarize',
        '/api/ai/summarize',
        { text: inputText, format: summaryFormat },
        'summarize'
      );
      setOutputText(response.summary || '');
      setSnack({ open: true, message: 'Summary generated', severity: 'success' });
      analytics.trackEvent('text_summarized', { format: summaryFormat, userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHumanize = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ humanized: string }>(
        'humanize',
        '/api/ai/humanize',
        { text: inputText },
        'humanize'
      );
      setOutputText(response.humanized || '');
      setSnack({ open: true, message: 'Text humanized', severity: 'success' });
      analytics.trackEvent('text_humanized', { userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ translated: string }>(
        'translate',
        '/api/ai/translate',
        { text: inputText, from: selectedLanguage, to: targetLanguage },
        'translate'
      );
      setOutputText(response.translated || '');
      setSnack({ open: true, message: 'Text translated', severity: 'success' });
      analytics.trackEvent('text_translated', { from: selectedLanguage, to: targetLanguage, userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateCitation = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ citation: string }>(
        'citation',
        '/api/ai/citation',
        { text: inputText, style: citationStyle },
        'citation-generate'
      );
      setOutputText(response.citation || ', ');
      setSnack({ open: true, message: 'Citation generated', severity: 'success' });
      analytics.trackEvent('citation_generated', { style: citationStyle, userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ generated: string }>(
        'generate_content',
        '/api/ai/generate-content',
        { prompt: inputText, type: contentType },
        'content-generate'
      );
      setOutputText(response.generated || ', ');
      setSnack({ open: true, message: `${contentType} generated`, severity: 'success' });
      analytics.trackEvent('content_generated', { type: contentType, userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDetectAI = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await runAIOperation<{ probability: number; analysis: string }>(
        'detect',
        '/api/ai/detect',
        { text: inputText },
        'ai-detect'
      );
      setOutputText(`AI Probability: ${response.probability}%\n\nAnalysis:\n${response.analysis || ''}`);
      setSnack({ open: true, message: 'AI detection complete', severity: 'success' });
      analytics.trackEvent('ai_detected', { userId });
    } catch (e: any) {
      setSnack({ open: true, message: String(e.message || e), severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOCS MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const onUploadDoc = async (file: File) => {
    try {
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.md') || ext.endsWith('.markdown')) {
        const text = await file.text();
        const rawHtml = simpleMarkdownToHTML(text);
        const cleanHtml = DOMPurify.sanitize(rawHtml);
        const toc = buildTOCFromHTML(cleanHtml);
        const withIds = injectHeaderIds(cleanHtml, toc);
        setDocHTML(withIds);
        setDocTOC(toc);
        setDocSections(buildSectionsFromHTML(withIds));
        setSnack({ open: true, message: 'Document uploaded', severity: 'success' });
        analytics.trackEvent('doc_uploaded', { type: 'markdown' });
      } else if (ext.endsWith('.pdf')) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/docs/parse-pdf', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`PDF parse failed: ${res.status}`);
        const data = await res.json();
        const cleanHtml = DOMPurify.sanitize(String(data.html || ', '));
        const toc = buildTOCFromHTML(cleanHtml);
        const withIds = injectHeaderIds(cleanHtml, toc);
        setDocHTML(withIds);
        setDocTOC(toc);
        setDocSections(buildSectionsFromHTML(withIds));
        setSnack({ open: true, message: 'PDF uploaded', severity: 'success' });
        analytics.trackEvent('doc_uploaded', { type: 'pdf' });
      } else {
        setSnack({ open: true, message: 'Unsupported file type. Use .md or .pdf', severity: 'warning' });
      }
    } catch (e: any) {
      setSnack({ open: true, message: `Import, failed: ${String(e.message || e)}`, severity: 'error' });
    }
  };

  const highlightSearch = (html: string, q: string) => {
    if (!q) return html;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
  };

  const copyCodeBlocks = async () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = docHTML;
    const blocks = tmp.querySelectorAll('pre > code');
    let copied = 0;
    for (const b of Array.from(blocks)) { const text = (b.textContent || ', ').trim();
      if (text) {
        await navigator.clipboard.writeText(text);
        copied++;
      } }
    setSnack({ open: true, message: `Copied ${copied} code block(s)`, severity: 'success' });
  };

  // Google folder init
  useEffect(() => {
    (async () => {
      try {
        if (googleDriveFolder) return;
        const r = await apiRequest('/api/google/drive/create-folder', {
          method: 'POST',
          body: JSON.stringify({ name: 'CreatorHub Notes' })
        });
        setGoogleDriveFolder(r.id);
      } catch (e: any) {
        setSnack({ open: true, message: `Drive init, failed: ${String(e.message || e)}`, severity: 'warning' });
      }
    })();
  }, [googleDriveFolder]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Grid container spacing={2} sx={{ p: 2, height: '100vh' }}>
      {/* 🎯 Main Header with Profession Branding */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {professionIcon && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: professionColor,
                    fontSize: '1.5rem'
                  }}
                >
                  {professionIcon}
                </Box>
              )}
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                {enhancedProfessionConfig?.displayName ? `${enhancedProfessionConfig.displayName} Notes` : 'CreatorHub Notes'}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Grid>

      {/* 🎯 System Status Bar */}
      <Grid item xs={12}>
        <Paper sx={{ p: 1, bgcolor: 'background.default', mb: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Health Status */}
              <Chip 
                label={`System: ${health.status}`}
                size="small"
                color={health.status === 'healthy' ? 'success' : health.status === 'degraded' ? 'warning' : 'error'}
                icon={health.status === 'healthy' ? <CheckCircleIcon /> : <WarningIcon />}
              />
              
              {/* User Status */}
              {isAuthenticated && userProfile && (
                <Chip 
                  label={`${userProfile.name} (${userProfile.role})`}
                  size="small"
                  color="primary"
                  avatar={<Avatar sx={{ width: 24, height: 24 }}>{userProfile.name[0]}</Avatar>}
                />
              )}
              
              {/* Feature Access */}
              <Tooltip title={canUseAI ? 'AI Tools Enabled' : aiToolsAccess.reason}>
                <Chip 
                  label="AI Tools"
                  size="small"
                  color={canUseAI ? 'success' : 'default'}
                  icon={<SmartToyIcon />}
                />
              </Tooltip>
              
              <Tooltip title={canUseGoogleDrive ? 'Google Drive Enabled' : googleDriveAccess.reason}>
                <Chip 
                  label="Google Drive"
                  size="small"
                  color={canUseGoogleDrive ? 'success' : 'default'}
                  icon={<CloudIcon />}
                />
              </Tooltip>
            </Stack>
            
            <Stack direction="row" spacing={1}>
              {/* Performance Metrics */}
              <Tooltip title="View Performance Metrics">
                <IconButton size="small" onClick={() => console.log(perf.getPerformanceMetrics())}>
                  <SpeedIcon />
                </IconButton>
              </Tooltip>
              
              {/* Debug Mode Toggle (Admin only) */}
              {auth.hasRole('admin') && (
                <Tooltip title={debugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}>
                  <IconButton 
                    size="small" 
                    color={debugMode ? 'primary' : 'default'}
                    onClick={() => setDebugMode(!debugMode)}
                  >
                    <BugReportIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Grid>
      
      {/* Main Tabs */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
          <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} aria-label="main tabs">
            <Tab value="notes" label="Notes" icon={<NotesIcon />} />
            <Tab value="docs" label="Docs Reader" icon={<ArticleIcon />} />
            <Tab 
              value="ai-tools" 
              label="AI Tools" 
              icon={<SmartToyIcon />}
              disabled={!canUseAI}
            />
          </Tabs>
        </Paper>
      </Grid>

      {/* NOTES MODE */}
      {mainTab === 'notes' && (
        <>
          {/* LEFT: Sidebar */}
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ p: 2, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
              <Stack spacing={2}>
                <TextField
                  size="small"
                  placeholder="Search notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
                        <SearchIcon fontSize="small" />
                      </Box>
                    )
                  }}
                />

                <Tabs
                  value={category}
                  onChange={(_, v) => setCategory(v)}
                  orientation="vertical"
                  variant="scrollable"
                  aria-label="note categories"
                >
                  {(['all','ideas','docs','tasks','research','project','meeting'] as NoteCategory[]).map((c) => (
                    <Tab key={c} value={c} label={c.toUpperCase()} sx={{ alignItems: 'flex-start' }} />
                  ))}
                </Tabs>

                <Divider />

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                    aria-label="create note"
                    size="small"
                    fullWidth
                  >
                    New
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SmartToyIcon />}
                    onClick={runFullAIAnalysis}
                    disabled={aiBusy}
                    aria-label="run ai analysis"
                    size="small"
                  >
                    {aiBusy ? 'AI…' : 'AI'}
                  </Button>
                </Stack>

                <List dense>
                  {notesLoading ? (
                    <ListItem>
                      <CircularProgress size={16} />
                    </ListItem>
                  ) : (
                    filteredNotes.map((n) => (
                      <ListItem
                        key={n.id}
                        disablePadding
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label="delete note"
                            onClick={() => deleteNote.mutate(n.id)}
                            size="small"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemButton selected={selectedNoteId === n.id} onClick={() => handleSelectNote(n)}>
                          <ListItemAvatar>
                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                              {n.title.slice(0, 1).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={n.title || 'Untitled'}
                            secondary={new Date(n.updatedAt).toLocaleString('nb-NO')}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))
                  )}
                </List>
              </Stack>
            </Paper>
          </Grid>

          {/* RIGHT: Editor */}
          <Grid item xs={12} md={9}>
            <Card>
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {professionIcon && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          color: professionColor,
                          fontSize: '1.2rem'
                        }}
                      >
                        {professionIcon}
                      </Box>
                    )}
                    <Typography component="span">
                      {selectedNote ? selectedNote.title : enhancedProfessionConfig?.displayName ? `Welcome to ${enhancedProfessionConfig.displayName} Notes` : 'Welcome to CreatorHub Notes'}
                    </Typography>
                  </Box>
                }
                subheader={
                  selectedNote ? (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip label={selectedNote.category} size="small" />
                      <Chip
                        label={selectedNote.status}
                        size="small"
                        color={selectedNote.status === 'active' ? 'success' : 'default'}
                      />
                      <Chip label={`Words: ${stats.words}`} size="small" />
                      <Chip label={`~${stats.readingTime} min read`} size="small" />
                    </Stack>
                  ) : (
                    'Create or select a note to begin.'
                  )
                }
                action={
                  selectedNote && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => setPreview((p) => !p)}
                        aria-label="toggle preview"
                        size="small"
                      >
                        {preview ? 'Edit' : 'Preview'}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        aria-label="save note"
                        disabled={!selectedNote}
                        size="small"
                      >
                        Save
                      </Button>
                      <Tooltip title={!canUseGoogleDrive ? googleDriveAccess.reason : 'Export to Google Docs'}>
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<IosShareIcon />}
                            onClick={() => setOpenExportDialog(true)}
                            aria-label="export to google docs"
                            size="small"
                            disabled={!canUseGoogleDrive}
                          >
                            Export
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={!canUseAI ? aiToolsAccess.reason : 'Convert note to visual customer journey'}>
                        <span>
                          <Button
                            variant="contained"
                            startIcon={<TimelineIcon />}
                            onClick={handleConvertToJourney}
                            aria-label="convert to journey"
                            size="small"
                            disabled={!canUseAI || isProcessing}
                            color="success"
                          >
                            {isProcessing ? 'Converting...' : 'To Journey'}
                          </Button>
                        </span>
                      </Tooltip>
                      <Button
                        variant="outlined"
                        startIcon={<BookIcon />}
                        onClick={() => setShowDocBrowser(!showDocBrowser)}
                        aria-label="browse documentation"
                        size="small"
                        color={showDocBrowser ? 'primary' : 'inherit'}
                      >
                        Docs
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<TranslateIcon />}
                        onClick={() => {
                          setShowDictionary(!showDictionary);
                          if (showDictionary) setShowWordSuggestions(false);
                        }}
                        aria-label="norwegian dictionary"
                        size="small"
                        color={showDictionary ? 'primary' : 'inherit'}
                      >
                        Dict
                      </Button>
                      <Tooltip title={!canUseAI ? aiToolsAccess.reason : 'AI suggests better words'}>
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={
                              <Badge badgeContent={wordSuggestionsCount} color="warning">
                                <LightbulbIcon />
                              </Badge>
                            }
                            onClick={() => {
                              setShowWordSuggestions(!showWordSuggestions);
                              if (showWordSuggestions) setShowDictionary(false);
                            }}
                            aria-label="word suggestions"
                            size="small"
                            color={showWordSuggestions ? 'warning' : 'inherit'}
                            disabled={!canUseAI}
                          >
                            Suggest
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  )
                }
              />
              <CardContent sx={{ height: 'calc(100vh - 350px)', overflow: 'auto' }}>
                {!selectedNote ? (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <NotesIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                    <Typography color="text.secondary">Select a note to edit its content.</Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {/* Main Editor */}
                    <Grid item xs={showDocBrowser || showDictionary || showWordSuggestions ? 8 : 12}>
                      {preview ? (
                        <Box sx={{ p: 1 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editorHTML || EMPTY_HTML) }} />
                      ) : (
                        <Box
                          onMouseUp={() => {
                            const selection = window.getSelection();
                            const text = selection?.toString().trim();
                            if (text && text.length > 2 && text.length < 50) {
                              setSelectedTextForDict(text);
                            }
                          }}
                        >
                          <RichTextEditor
                            theme="snow"
                            value={editorHTML}
                            onChange={setEditorHTML}
                            modules={quillModules}
                            formats={quillFormats}
                          />
                        </Box>
                      )}
                    </Grid>
                    
                    {/* Documentation Browser Sidebar */}
                    {showDocBrowser && !showDictionary && (
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            📚 Documentation Reference
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          
                          {/* AI-Suggested Docs */}
                          {canUseAI && docSuggestions.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Stack direction="row" alignItems="center" spacing={0.5} mb={1}>
                                <SmartToyIcon fontSize="small" color="success" />
                                <Typography variant="caption" fontWeight="bold" color="success.main">
                                  AI Suggestions
                                </Typography>
                              </Stack>
                              <Stack spacing={0.5}>
                                {docSuggestions.slice(0, 5).map((doc, idx) => (
                                  <Button
                                    key={idx}
                                    size="small"
                                    fullWidth
                                    variant="outlined"
                                    onClick={() => handleLinkDoc(doc.path)}
                                    sx={{ 
                                      justifyContent: 'flex-start',
                                      textAlign: 'left',
                                      fontSize: '0.75rem',
                                      py: 0.5
                                    }}
                                  >
                                    {doc.name}
                                  </Button>
                                ))}
                              </Stack>
                              <Divider sx={{ my: 1.5 }} />
                            </Box>
                          )}
                          
                          {/* Popular Docs */}
                          <Box>
                            <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                              🔥 Popular Docs
                            </Typography>
                            <Stack spacing={0.5}>
                              <Button
                                size="small"
                                fullWidth
                                variant="text"
                                onClick={() => handleLinkDoc('02-features/ADVANCED_JOURNEY_FEATURES.md')}
                                sx={{ justifyContent: 'flex-start', fontSize: '0.7rem' }}
                              >
                                Journey Builder
                              </Button>
                              <Button
                                size="small"
                                fullWidth
                                variant="text"
                                onClick={() => handleLinkDoc('03-integrations/seo/SEO_LAUNCH_CHECKLIST.md')}
                                sx={{ justifyContent: 'flex-start', fontSize: '0.7rem' }}
                              >
                                SEO Checklist
                              </Button>
                              <Button
                                size="small"
                                fullWidth
                                variant="text"
                                onClick={() => handleLinkDoc('03-integrations/GOOGLE_OAUTH_SETUP_GUIDE.md')}
                                sx={{ justifyContent: 'flex-start', fontSize: '0.7rem' }}
                              >
                                Google OAuth
                              </Button>
                            </Stack>
                          </Box>
                          
                          {/* Linked Docs in Current Note */}
                          {linkedDocs.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Divider sx={{ my: 1.5 }} />
                              <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                                🔗 Linked in This Note
                              </Typography>
                              <Stack spacing={0.5}>
                                {linkedDocs.map((docPath, idx) => (
                                  <Chip
                                    key={idx}
                                    label={docPath.split('/').pop()}
                                    size="small"
                                    onDelete={() => setLinkedDocs(prev => prev.filter(p => p !== docPath))}
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          )}
                          
                          {/* Google Drive Bridge */}
                          <Box sx={{ mt: 2 }}>
                            <Divider sx={{ my: 1.5 }} />
                            <GoogleDriveDocsBridge
                              currentNoteId={selectedNote.id}
                              onDocImported={(path, content) => {
                                // Add imported doc reference to note
                                const docLink = `
                                  <div style="border: 2px solid #4caf50; padding: 12px; border-radius: 8px; margin: 8px 0; background: #e8f5e9;">
                                    <strong>☁️ Imported from Drive:</strong> 
                                    <a href="#" data-doc-path="${path}" style="color: #2e7d32; text-decoration: none;">
                                      ${path.split('/').pop()}
                                    </a>
                                  </div>
                                `;
                                setEditorHTML(prev => prev + docLink);
                              }}
                              onDriveFileLinked={(fileId, fileName) => {
                                // Add Drive file link to note
                                const driveLink = `
                                  <div style="border: 2px solid #ff9800; padding: 12px; border-radius: 8px; margin: 8px 0; background: #fff3e0;">
                                    <strong>🔗 Google Drive File:</strong> 
                                    <a href="https://drive.google.com/file/d/${fileId}" target="_blank" style="color: #e65100; text-decoration: none;">
                                      ${fileName}
                                    </a>
                                  </div>
                                `;
                                setEditorHTML(prev => prev + driveLink);
                                setSnack({
                                  open: true,
                                  message: `Drive file "${fileName}" linked!`,
                                  severity: 'success'
                                });
                              }}
                            />
                          </Box>
                        </Paper>
                      </Grid>
                    )}
                    
                    {/* Norwegian Dictionary Sidebar */}
                    {showDictionary && !showDocBrowser && (
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                          <NorwegianDictionaryPanel
                            selectedText={selectedTextForDict}
                            autoLookup={true}
                            onWordSelected={(word, translation) => {
                              // Insert translation into editor
                              const translationHTML = `
                                <span style="background: #fff3cd; padding: 2px 6px; border-radius: 4px; border-bottom: 2px solid #ffc107;">
                                  ${word}
                                </span>
                                <span style="color: #666; font-size: 0.9em;"> (${translation})</span>
                              `;
                              setEditorHTML(prev => prev + ' ' + translationHTML + ',');
                              
                              setSnack({
                                open: true,
                                message: `Translation, inserted: ${word} → ${translation}`,
                                severity: 'success'
                              });
                              
                              analytics.trackEvent('dictionary_translation_inserted', {
                                word,
                                translation,
                                noteId: selectedNote?.id,
                                userId
                              });
                            }}
                          />
                          
                          {/* Quick Actions */}
                          <Box sx={{ mt: 2 }}>
                            <Divider sx={{ my: 1.5 }} />
                            <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                              💡 Quick Tips
                            </Typography>
                            <Alert severity="info" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                              • Select text in editor for instant lookup
                              • Click translations to insert into note
                              • Bookmark frequently used words
                              • View search history below
                            </Alert>
                          </Box>
                        </Paper>
                      </Grid>
                    )}
                    
                    {/* Contextual Word Suggestions Sidebar */}
                    {showWordSuggestions && !showDocBrowser && !showDictionary && (
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                          <ContextualWordSuggestions
                            noteContent={editorHTML}
                            noteTitle={selectedNote?.title}
                            noteCategory={selectedNote?.category}
                            autoAnalyze={true}
                            maxSuggestions={5}
                            onReplace={(original, suggested, position) => {
                              // Replace word in editor
                              const cleanText = editorHTML.replace(/<[^>]*>/g, '');
                              const newHTML = editorHTML.replace(
                                new RegExp(`\\b${original}\\b`, 'gi'),
                                `<span style="background: #c8e6c9; padding: 2px 4px; border-radius: 3px;">${suggested}</span>`
                              );
                              setEditorHTML(newHTML);
                              
                              setSnack({
                                open: true,
                                message: `Replaced "${original}" → "${suggested}"`,
                                severity: 'success'
                              });
                              
                              // Update badge count
                              setWordSuggestionsCount(prev => Math.max(0, prev - 1));
                            }}
                            onDismiss={(suggestion) => {
                              setWordSuggestionsCount(prev => Math.max(0, prev - 1));
                            }}
                          />
                          
                          {/* Quick Info */}
                          <Box sx={{ mt: 2 }}>
                            <Divider sx={{ my: 1.5 }} />
                            <Alert severity="success" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                              <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                                ✨ Writing Assistant Active
                              </Typography>
                              <Typography variant="caption" component="div">
                                AI analyzes your writing and suggests:
                                <br/>• More professional words
                                <br/>• Better clarity
                                <br/>• Stronger impact
                                <br/>• Domain-specific terminology
                              </Typography>
                            </Alert>
                          </Box>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </>
      )}

      {/* DOCS MODE */}
      {mainTab === 'docs' && (
        <>
          <Grid item xs={12} md={9}>
            <Card>
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {professionIcon && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          color: professionColor,
                          fontSize: '1.2rem'
                        }}
                      >
                        {professionIcon}
                      </Box>
                    )}
                    <Typography component="span">
                      {enhancedProfessionConfig?.displayName ? `${enhancedProfessionConfig.displayName} Documentation Reader` : 'Interactive Documentation Reader'}
                    </Typography>
                  </Box>
                }
                subheader="Upload Markdown or PDF. Navigate with TOC. Search highlights. Collapsible sections. Ask AI per section."
              />
              <CardContent sx={{ height: 'calc(100vh - 300px)', overflow: 'auto' }}>
                {!docHTML ? (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <UploadFileIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      Upload a .md or .pdf file to begin.
                    </Typography>
                    <Button component="label" variant="contained" startIcon={<UploadFileIcon />} sx={{ mt: 2 }}>
                      Upload Document
                      <input
                        type="file"
                        hidden
                        accept=".md,.markdown,.pdf"
                        onChange={(e) => e.target.files && onUploadDoc(e.target.files[0])}
                      />
                    </Button>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {docSections.map((sec) => (
                      <Paper key={sec.id} variant="outlined" sx={{ p: 2 }} id={sec.id}>
                        <SectionItem
                          title={sec.title}
                          level={sec.level}
                          html={highlightSearch(sec.html, docSearchDebounced)}
                          onAskAI={() => askAIAboutSection.mutate({ title: sec.title, html: sec.html })}
                          isProcessing={askAIAboutSection.isPending}
                        />
                      </Paper>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Stack spacing={2} sx={{ position: 'sticky', top: 16 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Button
                    component="label"
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    aria-label="upload documentation"
                    fullWidth
                  >
                    Upload MD / PDF
                    <input
                      type="file"
                      hidden
                      accept=".md,.markdown,.pdf"
                      onChange={(e) => e.target.files && onUploadDoc(e.target.files[0])}
                    />
                  </Button>
                  <TextField
                    size="small"
                    placeholder="Search in document…"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
                          <SearchIcon fontSize="small" />
                        </Box>
                      )
                    }}
                  />
                  <Button variant="outlined" onClick={copyCodeBlocks} startIcon={<ContentCopyIcon />} fullWidth>
                    Copy all code
                  </Button>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Table of Contents
                </Typography>
                <List dense sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                  {docTOC.map((t) => (
                    <ListItem key={t.id} sx={{ pl: (t.level - 1) * 1.5 }}>
                      <ListItemButton
                        onClick={() =>
                          document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      >
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={t.text} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  AI Answer
                </Typography>
                {!aiAnswer && !askAIAboutSection.isPending && (
                  <Typography color="text.secondary" variant="body2">
                    Select a section and click the robot button to ask.
                  </Typography>
                )}
                {askAIAboutSection.isPending && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2">Thinking…</Typography>
                  </Stack>
                )}
                {!!aiAnswer && !askAIAboutSection.isPending && (
                  <Box sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{aiAnswer}</Box>
                )}
              </Paper>
            </Stack>
          </Grid>
        </>
      )}

      {/* AI TOOLS MODE */}
      {mainTab === 'ai-tools' && (
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: themeColors.primary }}>
                  {professionIcon && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: professionColor,
                        fontSize: '1.2rem'
                      }}
                    >
                      {professionIcon}
                    </Box>
                  )}
                  <SmartToyIcon />
                  {enhancedProfessionConfig?.displayName ? `${enhancedProfessionConfig.displayName} AI Tools Suite` : 'AI Tools Suite'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  QuillBot-style AI tools for text enhancement, translation, and generation
                </Typography>
              </Box>
              
              {/* 🎯 Feature Access Indicator */}
              {!canUseAI && (
                <Alert severity="warning" sx={{ maxWidth: 400 }}>
                  <Typography variant="body2">
                    {aiToolsAccess.reason}
                  </Typography>
                </Alert>
              )}
            </Stack>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              {/* Text Enhancement Tools */}
              <Grid item xs={12} md={6} lg={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Text Enhancement
                    </Typography>
                    <Stack spacing={1}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<TransformIcon />}
                        onClick={() => setShowParaphraser(true)}
                      >
                        Paraphraser
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<SpellcheckIcon />}
                        onClick={() => setShowGrammarChecker(true)}
                      >
                        Grammar Checker
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<SubjectIcon />}
                        onClick={() => setShowSummarizer(true)}
                      >
                        Summarizer
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<PsychologyIcon />}
                        onClick={() => setShowHumanizer(true)}
                      >
                        AI Humanizer
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Content Generation */}
              <Grid item xs={12} md={6} lg={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Content Generation
                    </Typography>
                    <Stack spacing={1}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ArticleIcon />}
                        onClick={() => {
                          setContentType('paragraph');
                          setShowContentGen(true);
                        }}
                      >
                        Paragraph Generator
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<BookIcon />}
                        onClick={() => {
                          setContentType('story');
                          setShowContentGen(true);
                        }}
                      >
                        Story Generator
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<EmailIcon />}
                        onClick={() => {
                          setContentType('email');
                          setShowContentGen(true);
                        }}
                      >
                        Email Writer
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<TitleIcon />}
                        onClick={() => {
                          setContentType('title');
                          setShowContentGen(true);
                        }}
                      >
                        Title Generator
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Utilities */}
              <Grid item xs={12} md={6} lg={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Utilities
                    </Typography>
                    <Stack spacing={1}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<TranslateIcon />}
                        onClick={() => setShowTranslator(true)}
                      >
                        Translator
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<FormatQuoteIcon />}
                        onClick={() => setShowCitationGen(true)}
                      >
                        Citation Generator
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<PsychologyIcon />}
                        onClick={() => setShowAIDetector(true)}
                      >
                        AI Detector
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<AssignmentIcon />}
                        onClick={() => setShowWordCounter(true)}
                      >
                        Word Counter
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* AI Generated Output */}
            {(aiContext.generated.react || aiContext.generated.api) && (
              <Card sx={{ mt: 2 }}>
                <CardHeader title="AI Generated Output" />
                <CardContent>
                  {aiContext.generated.react && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">React/TS</Typography>
                      <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {aiContext.generated.react}
                      </Paper>
                    </Box>
                  )}
                  {aiContext.generated.api && (
                    <Box>
                      <Typography variant="subtitle2">API</Typography>
                      <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {aiContext.generated.api}
                      </Paper>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </Paper>
        </Grid>
      )}

      {/* Export Dialog */}
      <Dialog open={openExportDialog} onClose={() => setOpenExportDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          Export to Google Docs
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Share with (email, optional)"
              value={shareWithEmail}
              onChange={(e) => setShareWithEmail(e.target.value)}
              type="email"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExportDialog(false)}>Cancel</Button>
          <Button onClick={handleExportToGoogleDoc} variant="contained">
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          AI TOOLS DIALOGS
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* Paraphraser */}
      <Dialog open={showParaphraser} onClose={() => setShowParaphraser(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <TransformIcon color="primary" />
          Paraphraser
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Mode</InputLabel>
              <Select value={paraphraseMode} label="Mode" onChange={(e) => setParaphraseMode(e.target.value)}>
                {paraphraseModes.map((mode) => (
                  <MenuItem key={mode.value} value={mode.value}>
                    {mode.label} - {mode.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Original Text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text to paraphrase..."
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Paraphrased Text"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowParaphraser(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleParaphrase}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <TransformIcon />}
          >
            {isProcessing ? 'Processing...' : 'Paraphrase'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Grammar Checker */}
      <Dialog open={showGrammarChecker} onClose={() => setShowGrammarChecker(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <SpellcheckIcon color="primary" />
          Grammar Checker
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Text to Check"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text to check grammar..."
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Corrected Text"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGrammarChecker(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleGrammarCheck}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <SpellcheckIcon />}
          >
            {isProcessing ? 'Checking...' : 'Check Grammar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Summarizer */}
      <Dialog open={showSummarizer} onClose={() => setShowSummarizer(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <SubjectIcon color="primary" />
          Summarizer
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Format</InputLabel>
              <Select value={summaryFormat} label="Format" onChange={(e) => setSummaryFormat(e.target.value)}>
                <MenuItem value="bullets">Bullet Points</MenuItem>
                <MenuItem value="paragraph">Paragraph</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={5}
              label="Text to Summarize"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter long text to summarize..."
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Summary"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSummarizer(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleSummarize}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <SubjectIcon />}
          >
            {isProcessing ? 'Summarizing...' : 'Summarize'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Humanizer */}
      <Dialog open={showHumanizer} onClose={() => setShowHumanizer(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <PsychologyIcon color="primary" />
          AI Humanizer
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">Make AI-generated text sound more natural and human</Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="AI Text to Humanize"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste AI-generated text..."
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Humanized Text"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHumanizer(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleHumanize}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <PsychologyIcon />}
          >
            {isProcessing ? 'Humanizing...' : 'Humanize'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Translator */}
      <Dialog open={showTranslator} onClose={() => setShowTranslator(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <TranslateIcon color="primary" />
          Translator
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>From</InputLabel>
                <Select value={selectedLanguage} label="From" onChange={(e) => setSelectedLanguage(e.target.value)}>
                  {languages.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>To</InputLabel>
                <Select value={targetLanguage} label="To" onChange={(e) => setTargetLanguage(e.target.value)}>
                  {languages.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Text to Translate"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text to translate..."
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Translated Text"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTranslator(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleTranslate}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <TranslateIcon />}
          >
            {isProcessing ? 'Translating...' : 'Translate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Citation Generator */}
      <Dialog open={showCitationGen} onClose={() => setShowCitationGen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          <FormatQuoteIcon color="primary" />
          Citation Generator
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Citation Style</InputLabel>
              <Select value={citationStyle} label="Citation Style" onChange={(e) => setCitationStyle(e.target.value)}>
                {citationStyles.map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    {style.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Source Information"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter author, title, URL, or other source info..."
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Generated Citation"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCitationGen(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateCitation}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <FormatQuoteIcon />}
          >
            {isProcessing ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Content Generator */}
      <Dialog open={showContentGen} onClose={() => setShowContentGen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <ArticleIcon color="primary" />
          Content Generator - {contentType}
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Prompt or Topic"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Describe what you want to generate...`}
            />
            <TextField
              fullWidth
              multiline
              rows={6}
              label={`Generated ${contentType}`}
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContentGen(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateContent}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <ArticleIcon />}
          >
            {isProcessing ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Detector */}
      <Dialog open={showAIDetector} onClose={() => setShowAIDetector(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <PsychologyIcon color="primary" />
          AI Content Detector
          {isProcessing && (
            <CircularProgress size={24} sx={{ position: 'absolute', right: 16, top: 16 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">Analyze text to detect AI-generated content</Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Text to Analyze"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste text to check for AI content..."
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Detection Result"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAIDetector(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleDetectAI}
            disabled={!inputText.trim() || isProcessing}
            startIcon={isProcessing ? <CircularProgress size={16} /> : <PsychologyIcon />}
          >
            {isProcessing ? 'Analyzing...' : 'Detect AI'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Word Counter */}
      <Dialog open={showWordCounter} onClose={() => setShowWordCounter(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <AssignmentIcon color="primary" />
          Word Counter & Statistics
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={5}
              label="Text to Analyze"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value.trim()) {
                  const stats = analyzeText(e.target.value);
                  setOutputText(`
📊 TEXT STATISTICS:
• Words: ${stats.words}
• Characters: ${stats.characters}
• Characters (no spaces): ${stats.charactersNoSpaces}
• Sentences: ${stats.sentences}
• Paragraphs: ${stats.paragraphs}
• Avg words per sentence: ${stats.averageWordsPerSentence}
• Reading time: ${stats.readingTime} minutes
                  `.trim());
                } else {
                  setOutputText(', ');
                }
              }}
              placeholder="Enter text to analyze..."
            />
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Statistics"
              value={outputText}
              InputProps={{ readOnly: true }}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', fontFamily: 'monospace' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWordCounter(false)}>Close</Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              await navigator.clipboard.writeText(outputText);
              setSnack({ open: true, message: 'Copied to clipboard', severity: 'success' });
            }}
            disabled={!outputText}
          >
            Copy Stats
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>

      {/* 🐛 Debug Panel (Admin only) */}
      {debugMode && auth.hasRole('admin') && (
        <Paper 
          sx={{ 
            position: 'fixed', 
            bottom: 80, 
            right: 24, 
            p: 2, 
            maxWidth: 400,
            maxHeight: 300,
            overflow: 'auto',
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            zIndex: 999}}
        >
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
            🐛 Debug Info
          </Typography>
          <Divider sx={{ my: 1, bgcolor: 'grey.700' }} />
          <Stack spacing={1} sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
            <Box>User: {userProfile?.name} ({userProfile?.role})</Box>
            <Box>User ID: {userId}</Box>
            <Box>Health: {health.status}</Box>
            <Box>Components: {health.components.active}/{health.components.total}</Box>
            <Box>Avg Response: {health.performance.avgResponseTime.toFixed(2)}ms</Box>
            <Box>Memory: {health.performance.memoryUsage.toFixed(2)}MB</Box>
            <Box>Error Rate: {(health.performance.errorRate * 100).toFixed(1)}%</Box>
            <Box>AI Tools: {canUseAI ? '✅ Enabled' : '❌ Disabled'}</Box>
            <Box>Google Drive: {canUseGoogleDrive ? '✅ Enabled' : '❌ Disabled'}</Box>
            <Box>Notes Loaded: {notes.length}</Box>
            <Divider sx={{ my: 1, bgcolor: 'grey.700' }} />
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => console.log(debugging.getDebugInfo())}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Log Full Debug Info
            </Button>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => console.log(perf.getPerformanceMetrics())}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Log Performance Metrics
            </Button>
          </Stack>
        </Paper>
      )}

      {/* AI Tools Floating Action Button */}
      {mainTab === 'notes' && canUseAI && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setMainTab('ai-tools')}
          aria-label="AI Tools"
        >
          <SmartToyIcon />
        </Fab>
      )}
    </Grid>
    </ThemeProvider>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION ITEM COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SectionItem({
  title,
  level,
  html,
  onAskAI,
  isProcessing
}: {
  title: string;
  level: number;
  html: string;
  onAskAI: () => void;
  isProcessing?: boolean;
}) {
  const [open, setOpen] = useState(true);
  
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton aria-label="toggle section" onClick={() => setOpen((o) => !o)} size="small">
            <ChevronRightIcon
              sx={{
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s'
              }}
            />
          </IconButton>
          <Typography variant={level === 1 ? 'h5' : level === 2 ? 'h6': 'subtitle1'}>{title}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Ask AI about this section">
            <Button size="small" variant="outlined" onClick={onAskAI} disabled={isProcessing}>
              {isProcessing ? <CircularProgress size={16} /> : <SmartToyIcon fontSize="small" />}
            </Button>
          </Tooltip>
          <Tooltip title="Copy code blocks in section">
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const blocks = tmp.querySelectorAll('pre > code');
                let copied = 0;
                for (const b of Array.from(blocks)) { const text = (b.textContent ||', ').trim();
                  if (text) {
                    await navigator.clipboard.writeText(text);
                    copied++;
                  } }
                console.log(`Copied ${copied} code block(s)`);
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </Collapse>
    </Box>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CreatorHubNotes() {
  return <CreatorHubNotesInner />;
}

// Optional test harness
export function CreatorHubNotesWithProvider() {
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });
  return (
    <QueryClientProvider client={client}>
      <CreatorHubNotesInner />
    </QueryClientProvider>
  );
}
