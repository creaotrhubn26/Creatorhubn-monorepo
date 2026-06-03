/**
 * Email Designer - Visual email template builder
 * Feature: email-designer (Pro plan)
 * Dependencies: email-marketing-manager
 * Related: branded-email-templates (Pro plan)
 * Toast System: Uses ToastDesigner for all notifications
 */
import React, { useState, useCallback, useReducer, useEffect } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTheming } from '@/utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import RichTextEditor from '@/components/RichTextEditor';
import DOMPurify from 'dompurify';
import { analyzeText } from '@/components/admin/Creatorhubnotesnew';
import EmailContentAnalyzer from './EmailContentAnalyzer';
import EmailSpamChecker from './EmailSpamChecker';
import EmailNorwegianSpellCheck from './EmailNorwegianSpellCheck';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Alert,
  Tooltip,
  Divider,
  Chip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid2,
  Switch,
  FormControlLabel,
  Snackbar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Preview as PreviewIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  Code as CodeIcon,
  PhoneAndroid as MobileIcon,
  Computer as DesktopIcon,
  Laptop as TabletIcon,
  ViewColumn as ColumnIcon,
  VideoLibrary as VideoIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import type { DropResult } from '@hello-pangea/dnd';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ComponentStyles {
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold' | '600';
  fontSize?: number;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  width?: string;
  height?: string | number;
}

interface ComponentContent {
  text?: string;
  src?: string;
  alt?: string;
  url?: string;
  videoUrl?: string;
  columns?: Array<{ content: string }>;
}

interface EmailComponent {
  id: string;
  type: 'header' | 'text' | 'button' | 'image' | 'divider' | 'footer' | 'social' | 'spacer' | 'video' | 'columns';
  content: ComponentContent;
  styles: ComponentStyles;
}

interface GlobalStyles {
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  containerWidth: number;
}

interface EmailTemplate {
  id?: string;
  name: string;
  category: string;
  subject: string;
  preheader: string;
  components: EmailComponent[];
  globalStyles: GlobalStyles;
}

interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  category: 'user' | 'project' | 'business' | 'custom';
  defaultValue: string;
  example: string;
}

interface EmailDesignerState {
  components: EmailComponent[];
  history: EmailComponent[][];
  historyIndex: number;
  selectedComponent: EmailComponent | null;
  globalStyles: GlobalStyles;
  templateName: string;
  subject: string;
  preheader: string;
  customVariables: Record<string, string>;
  showVariablesPanel: boolean;
  previewMode: 'desktop' | 'tablet' | 'mobile';
  lastSaved: Date | null;
  isDirty: boolean;
}

interface EmailDesignerCompleteProps {
  context?: 'general' | 'moderation' | 'showcase';
  profession?: string;
  userId?: string;
  onSave?: (template: { subject: string; html: string; body: string }) => void;
}

// ============================================================================
// REDUCER
// ============================================================================

type Action =
  | { type: 'ADD_COMPONENT'; component: EmailComponent }
  | { type: 'UPDATE_COMPONENT'; id: string; updates: Partial<EmailComponent> }
  | { type: 'DELETE_COMPONENT'; id: string }
  | { type: 'REORDER_COMPONENTS'; components: EmailComponent[] }
  | { type: 'SELECT_COMPONENT'; component: EmailComponent | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'UPDATE_GLOBAL_STYLES'; styles: Partial<GlobalStyles> }
  | { type: 'SET_TEMPLATE_META'; field: 'templateName' | 'subject' | 'preheader'; value: string }
  | { type: 'LOAD_TEMPLATE'; template: EmailTemplate }
  | { type: 'SET_CUSTOM_VARIABLE'; key: string; value: string }
  | { type: 'TOGGLE_VARIABLES_PANEL' }
  | { type: 'SET_PREVIEW_MODE'; mode: 'desktop' | 'tablet' | 'mobile' }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' };

function emailDesignerReducer(state: EmailDesignerState, action: Action): EmailDesignerState {
  switch (action.type) {
    case 'ADD_COMPONENT': const newComponents = [...state.components, action.component];
      return {
        ...state,
        components: newComponents,
        history: [...state.history.slice(0, state.historyIndex + 1), newComponents],
        historyIndex: state.historyIndex + 1,
        isDirty: true
      };

    case 'UPDATE_COMPONENT': const updatedComponents = state.components.map(c =>
        c.id === action.id ? { ...c, ...action.updates } : c
      );
      return {
        ...state,
        components: updatedComponents,
        history: [...state.history.slice(0, state.historyIndex + 1), updatedComponents],
        historyIndex: state.historyIndex + 1,
        isDirty: true
      };

    case 'DELETE_COMPONENT': const filteredComponents = state.components.filter(c => c.id !== action.id);
      return {
        ...state,
        components: filteredComponents,
        selectedComponent: state.selectedComponent?.id === action.id ? null : state.selectedComponent,
        history: [...state.history.slice(0, state.historyIndex + 1), filteredComponents],
        historyIndex: state.historyIndex + 1,
        isDirty: true
      };

    case 'REORDER_COMPONENTS': return {
        ...state,
        components: action.components,
        history: [...state.history.slice(0, state.historyIndex + 1), action.components],
        historyIndex: state.historyIndex + 1,
        isDirty: true
      };

    case 'SELECT_COMPONENT': return { ...state, selectedComponent: action.component };

    case 'UNDO': if (state.historyIndex > 0) {
        return {
          ...state,
          components: state.history[state.historyIndex - 1],
          historyIndex: state.historyIndex - 1,
          isDirty: true
        };
      }
      return state;

    case 'REDO': if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          components: state.history[state.historyIndex + 1],
          historyIndex: state.historyIndex + 1,
          isDirty: true
        };
      }
      return state;

    case 'UPDATE_GLOBAL_STYLES': return {
        ...state,
        globalStyles: { ...state.globalStyles, ...action.styles },
        isDirty: true
      };

    case 'SET_TEMPLATE_META': return { ...state, [action.field]: action.value, isDirty: true };

    case 'LOAD_TEMPLATE': return {
        ...state,
        components: action.template.components,
        globalStyles: action.template.globalStyles,
        templateName: action.template.name,
        subject: action.template.subject,
        preheader: action.template.preheader,
        history: [action.template.components],
        historyIndex: 0,
        isDirty: false
      };

    case 'SET_CUSTOM_VARIABLE': return {
        ...state,
        customVariables: { ...state.customVariables, [action.key]: action.value }
      };

    case 'TOGGLE_VARIABLES_PANEL': return { ...state, showVariablesPanel: !state.showVariablesPanel };

    case 'SET_PREVIEW_MODE': return { ...state, previewMode: action.mode };

    case 'MARK_SAVED': return { ...state, lastSaved: new Date(), isDirty: false };

    case 'MARK_DIRTY': return { ...state, isDirty: true };

    default: return state;
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.6,
  textColor: '#333333',
  linkColor: '#ff6b35',
  containerWidth: 600 };

const COMPONENT_TYPES = [
  { id: 'header', name: 'Overskrift', icon: '📝', description: 'Store overskrifter' },
  { id: 'text', name: 'Tekst', icon: '📄', description: 'Brødtekst og avsnitt' },
  { id: 'button', name: 'Knapp', icon: '🔘', description: 'Call-to-action knapp' },
  { id: 'image', name: 'Bilde', icon: '🖼️', description: 'Bilder og grafikk' },
  { id: 'video', name: 'Video', icon: '🎬', description: 'Video embeds (YouTube, Vimeo)' },
  { id: 'columns', name: 'Kolonner', icon: '📊', description: 'Todelt kolonnelayout' },
  { id: 'divider', name: 'Linje', icon: '➖', description: 'Horisontal skillelinje' },
  { id: 'social', name: 'Sosiale', icon: '📱', description: 'Sosiale medier lenker' },
  { id: 'spacer', name: 'Avstand', icon: '⬜', description: 'Vertikal spacing' },
  { id: 'footer', name: 'Footer', icon: '👣', description: 'Bunntekst' }
] as const;

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // User Variables
  { key: 'user_name', label: 'Bruker Navn', description: 'Fullt navn', category: 'user', defaultValue: 'Navn Navnesen', example: 'Ola Nordmann' },
  { key: 'user_first_name', label: 'Fornavn', description: 'Brukerens fornavn', category: 'user', defaultValue: 'Navn', example: 'Ola' },
  { key: 'user_last_name', label: 'Etternavn', description: 'Brukerens etternavn', category: 'user', defaultValue: 'Navnesen', example: 'Nordmann' },
  { key: 'user_email', label: 'E-post', description: 'Brukerens e-postadresse', category: 'user', defaultValue: 'epost@example.com', example: 'ola@example.com' },
  { key: 'user_phone', label: 'Telefon', description: 'Brukerens telefonnummer', category: 'user', defaultValue: '+47 123 45 678', example: '+47 987 65 432' },
  
  // Project Variables
  { key: 'project_name', label: 'Prosjektnavn', description: 'Navn på prosjektet', category: 'project', defaultValue: 'Mitt Prosjekt', example: 'Bryllup 2025' },
  { key: 'project_date', label: 'Prosjektdato', description: 'Dato for prosjektet', category: 'project', defaultValue: '15. Juni 2025', example: '20. August 2025' },
  { key: 'project_location', label: 'Sted', description: 'Lokasjon for prosjektet', category: 'project', defaultValue: 'Oslo', example: 'Bergen' },
  { key: 'gallery_link', label: 'Galleri-lenke', description: 'Link til bildegalleri', category: 'project', defaultValue: 'https://gallery.example.com', example: 'https://gallery.example.com/abc123' },
  
  // Business Variables
  { key: 'business_name', label: 'Bedriftsnavn', description: 'Navn på fotografbedriften', category: 'business', defaultValue: 'Mitt Fotofirma', example: 'Nordisk Foto AS' },
  { key: 'business_email', label: 'Bedrift E-post', description: 'Bedriftens e-postadresse', category: 'business', defaultValue: 'kontakt@firma.no', example: 'post@nordiskfoto.no' },
  { key: 'photographer_name', label: 'Fotograf Navn', description: 'Navnet på fotografen', category: 'business', defaultValue: 'Fotograf Fotografsen', example: 'Kari Fotograf' },
  
  // Common Phrases
  { key: 'greeting', label: 'Hilsen', description: 'Hilsen i starten', category: 'custom', defaultValue: 'Hei', example: 'Kjære' },
  { key: 'closing', label: 'Avslutning', description: 'Avslutningshilsen', category: 'custom', defaultValue: 'Med vennlig hilsen', example: 'Beste hilsener' }
];

// Pre-built templates
const PREBUILT_TEMPLATES: EmailTemplate[] = [
  {
    name: 'Galleri klar',
    category: 'notification',
    subject: 'Dine bilder er klare! 📸',
    preheader: 'Se dine fantastiske bilder nå',
    components: [
      {
        id: '1',
        type: 'header',
        content: { text: 'Hei {{user_first_name}! 👋' },
        styles: { fontSize: 28, textAlign: 'center', color: '#ff6b35' }
      },
      {
        id: '2',
        type: 'text',
        content: { text: 'Dine bilder fra {{project_name} er nå klare for visning!' },
        styles: { fontSize: 16, textAlign: 'center' }
      },
      {
        id: '3',
        type: 'button',
        content: { text: 'Se bildene', url: '{{gallery_link}' },
        styles: { backgroundColor: '#ff6b35', color: '#ffffff', textAlign: 'center' }
      },
      {
        id: '4',
        type: 'footer',
        content: { text: '{{closing}\n{{photographer_name},' },
        styles: { fontSize: 12, textAlign: 'center', color: '#666', }
      }
    ],
    globalStyles: DEFAULT_GLOBAL_STYLES
  },
  {
    name: 'Påminnelse',
    category: 'reminder',
    subject: 'Påminnelse: {{project_name} - {{project_date}, ',
    preheader: 'Gleder oss til å se deg!',
    components: [
      {
        id: '1',
        type: 'header',
        content: { text: '{{greeting} {{user_first_name}!' },
        styles: { fontSize: 24, textAlign: 'left' }
      },
      {
        id: '2',
        type: 'text',
        content: { text: 'Dette er en påminnelse om vårt kommende, prosjekt:\n\n📅 Dato: {{project_date}\n📍 Sted: {{project_location}\n\nVi gleder oss!' },
        styles: { fontSize: 14 }
      },
      {
        id: '3',
        type: 'divider',
        content: {},
        styles: { backgroundColor: 'rgba(255,255,255,0.10)', height: 1 }
      },
      {
        id: '4',
        type: 'footer',
        content: { text: '{{business_name}\n{{business_email},' },
        styles: { fontSize: 11, textAlign: 'center', color: '#999', }
      }
    ],
    globalStyles: DEFAULT_GLOBAL_STYLES
  }
];

// ============================================================================
// UTILITIES
// ============================================================================

function useDebouncedValue<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EmailDesignerComplete({
  context = 'general',
  profession = 'photographer',
  userId,
  onSave
}: EmailDesignerCompleteProps = {}) {
  const { user } = useAuth();
  const theming = useTheming(profession);
  const queryClient = useQueryClient();
  const { analytics, lifecycle, performance: perf, debugging, features, communication } = useEnhancedMasterIntegration();

  // Toast notification system
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info'; duration: number }>>([]);

  const addToast = useCallback((toast: { message: string; type: 'success' | 'error' | 'info'; duration: number }) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss toast
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration);
  }, []);

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  const [state, dispatch] = useReducer(emailDesignerReducer, {
    components: [],
    history: [[]],
    historyIndex: 0,
    selectedComponent: null,
    globalStyles: DEFAULT_GLOBAL_STYLES,
    templateName: 'Ny mal',
    subject: '',
    preheader: '',
    customVariables: {},
    showVariablesPanel: false,
    previewMode: 'desktop',
    lastSaved: null,
    isDirty: false
  });

  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Debounced search for better performance
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // ============================================================================
  // COMPONENT LIFECYCLE & REGISTRATION
  // ============================================================================
  
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'email-designer',
      type: 'marketing-tool',
      version: '1.0.0',
      capabilities: {
        data: ['templates','variables','components','analytics'],
        events: ['template-created','template-saved','email-sent','test-sent'],
        actions: ['create','edit','preview','export','send','undo','redo'],
        ui: ['designer','preview','properties','templates','variables'],
        system: ['auto-save','undo-redo','drag-drop','responsive-preview']
      },
      dependencies: ['@hello-pangea/dnd','react-quill','dompurify'],
      lastActive: Date.now(),
      performance: { renderCount: 0, avgRenderTime: 0, memoryUsage: 0 }
    });
    
    analytics.trackEvent('email_designer_mounted', {
      userId: user?.id,
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'EmailDesigner mounted', {
      componentId: 'email-designer',
      features: ['drag-drop','undo-redo','auto-save','template-variables']
    });
    
    return () => {
      lifecycle.unregisterComponent('email-designer');
      analytics.trackEvent('email_designer_unmounted', {
        userId: user?.id,
        timestamp: Date.now()
      });
    };
  }, [lifecycle, analytics, debugging, user]);

  // ============================================================================
  // AUTO-SAVE (every 30 seconds if dirty)
  // ============================================================================

  useEffect(() => {
    if (!state.isDirty) return;

    const autoSaveTimer = setTimeout(() => {
      console.log('Auto-saving...,');
      // Save to server KV (with local fallback)
      const draft = {
        components: state.components,
        templateName: state.templateName,
        subject: state.subject,
        preheader: state.preheader,
        globalStyles: state.globalStyles
      };
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'email-designer-draft', value: draft })
      }).catch(() => {});
      localStorage.setItem('email-designer-draft', JSON.stringify(draft));
      addToast({
        message: 'Utkast lagret automatisk',
        type: 'success',
        duration: 3000 });
    }, 30000); // 30 seconds

    return () => clearTimeout(autoSaveTimer);
  }, [state.isDirty, state.components, state.templateName, state.subject, state.preheader, state.globalStyles]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
      // Ctrl/Cmd + S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveMutation.mutate();
      }
      // Delete/Backspace = Delete selected component
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedComponent) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          deleteComponent(state.selectedComponent.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [state.selectedComponent]);

  // ============================================================================
  // COMPONENT ACTIONS
  // ============================================================================

  const addComponent = useCallback((type: EmailComponent['type']) => {
    const newComponent: EmailComponent = {
      id: `component-${Date.now()}-${Math.random()}`,
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    };
    dispatch({ type: 'ADD_COMPONENT', component: newComponent });
  }, []);

  const updateComponent = useCallback((id: string, updates: Partial<EmailComponent>) => {
    dispatch({ type: 'UPDATE_COMPONENT', id, updates });
  }, []);

  const deleteComponent = useCallback((id: string) => {
    dispatch({ type: 'DELETE_COMPONENT', id });
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(state.components);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    dispatch({ type: 'REORDER_COMPONENTS', components: items });
  }, [state.components]);

  // ============================================================================
  // SAVE & EXPORT
  // ============================================================================

  const saveMutation = useMutation({
    mutationFn: async () => {
      const endTiming = perf.startTiming('email_template_save');
      try {
        const template: EmailTemplate = {
          name: state.templateName,
          category: 'custom',
          subject: state.subject,
          preheader: state.preheader,
          components: state.components,
          globalStyles: state.globalStyles
        };
        return await apiRequest('/api/email-templates', {
          method: 'POST',
          body: JSON.stringify(template)
        });
      } finally {
        endTiming();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      dispatch({ type: 'MARK_SAVED' });

      // Analytics tracking
      analytics.trackEvent('email_template_saved', {
        templateName: state.templateName,
        componentCount: state.components.length,
        hasVariables: state.components.some(c => c.content.text?.includes('{{')),
        userId: user?.id,
        timestamp: Date.now()
      });

      features.trackFeatureUsage('email-designer','save', {
        componentCount: state.components.length
      });

      // Broadcast event
      communication.sendBroadcast('email-template-saved', {
        templateName: state.templateName,
        componentCount: state.components.length
      }, 'medium');

      addToast({
        message: 'Mal lagret!',
        type: 'success',
        duration: 3000 });

      // Call onSave callback if provided (for integration with SmartEmailComposer)
      if (onSave) {
        const html = generateHTML(state.components, state.globalStyles);
        onSave({
          subject: state.subject,
          html: html,
          body: html
        });
      }
    },
    onError: () => {
      addToast({
        message: 'Kunne ikke lagre mal',
        type: 'error',
        duration: 4000 });
    }
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const html = generateHTML(state.components, state.globalStyles);
      return await apiRequest('/api/email/send-test', {
        method: 'POST',
        body: JSON.stringify({
          to: email,
          subject: state.subject,
          html
        })
      });
    },
    onSuccess: () => {
      setShowSendDialog(false);
      addToast({
        message: 'Test-epost sendt!',
        type: 'success',
        duration: 3000 });
    },
    onError: () => {
      addToast({
        message: 'Kunne ikke sende epost',
        type: 'error',
        duration: 4000 });
    }
  });

  const exportAsHTML = useCallback(() => {
    const html = generateHTML(state.components, state.globalStyles);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.templateName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.components, state.globalStyles, state.templateName]);

  const loadTemplate = useCallback((template: EmailTemplate) => {
    dispatch({ type: 'LOAD_TEMPLATE', template });
    setShowTemplatesDialog(false);
    addToast({
      message: 'Mal lastet inn!',
      type: 'success',
      duration: 3000 });
  }, [addToast]);

  // ============================================================================
  // PREVIEW WIDTH CALCULATION
  // ============================================================================

  const getPreviewWidth = () => {
    switch (state.previewMode) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      case 'desktop': return state.globalStyles.containerWidth;
      default: return state.globalStyles.containerWidth;
    }
  };

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.04)' }} role="main" aria-label="Email Designer">
      {/* Toolbar */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              📧 Email Designer
            </Typography>
            <Chip label={`${state.components.length} komponenter`} size="small" />
            {state.isDirty && <Chip label="Ikke lagret" size="small" color="warning" />}
            {state.lastSaved && <Typography variant="caption" color="text.secondary">Lagret {state.lastSaved.toLocaleTimeString()}</Typography>}
          </Stack>

          <Stack direction="row" spacing={1}>
            {/* Undo/Redo */}
            <Tooltip title="Angre (Ctrl+Z)">
              <span>
                <IconButton size="small" onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} aria-label="Angre">
                  <UndoIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Gjør om (Ctrl+Y)">
              <span>
                <IconButton size="small" onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} aria-label="Gjør om">
                  <RedoIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Preview Mode */}
            <Tooltip title="Desktop">
              <IconButton
                size="small"
                color={state.previewMode === 'desktop' ? 'primary' : 'default'}
                onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', mode: 'desktop' })}
                aria-label="Desktop forhåndsvisning"
              >
                <DesktopIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Tablet">
              <IconButton
                size="small"
                color={state.previewMode === 'tablet' ? 'primary' : 'default'}
                onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', mode: 'tablet' })}
                aria-label="Tablet forhåndsvisning"
              >
                <TabletIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Mobil">
              <IconButton
                size="small"
                color={state.previewMode === 'mobile' ? 'primary' : 'default'}
                onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', mode: 'mobile' })}
                aria-label="Mobil forhåndsvisning"
              >
                <MobileIcon />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Actions */}
            <Button
              startIcon={<PreviewIcon />}
              onClick={() => setShowTemplatesDialog(true)}
              variant="outlined"
              size="small"
            >
              Maler
            </Button>

            <Button
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate()}
              variant="contained"
              size="small"
              sx={theming.getThemedButtonSx()}
              disabled={saveMutation.isPending}
            >
              Lagre
            </Button>

            <Button
              startIcon={<SendIcon />}
              onClick={() => setShowSendDialog(true)}
              variant="outlined"
              size="small"
            >
              Send test
            </Button>

            <Button
              onClick={exportAsHTML}
              variant="outlined"
              size="small"
            >
              Eksporter
            </Button>

            <Tooltip title="Variabler">
              <IconButton
                size="small"
                onClick={() => dispatch({ type: 'TOGGLE_VARIABLES_PANEL' })}
                color={state.showVariablesPanel ? 'primary' : 'default'}
                aria-label="Vis variabler"
              >
                <CodeIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Component Palette */}
        <Paper sx={{ width: 250, p: 2, overflow: 'auto', borderRadius: 0 }} role="navigation" aria-label="Komponentpalette">
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
            Komponenter
          </Typography>
          <Stack spacing={1}>
            {COMPONENT_TYPES.map((type) => (
              <Tooltip key={type.id} title={type.description} placement="right">
                <Button
                  variant="outlined"
                  startIcon={<span role="img" aria-label={type.name}>{type.icon}</span>}
                  onClick={() => addComponent(type.id as EmailComponent['type'])}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  fullWidth
                  aria-label={`Legg til ${type.name}`}
                >
                  {type.name}
                </Button>
              </Tooltip>
            ))}
          </Stack>
        </Paper>

        {/* Canvas */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: 'rgba(255,255,255,0.10)' }} role="region" aria-label="Email canvas">
          <Paper
            sx={{
              width: getPreviewWidth(),
              mx: 'auto',
              p: 3,
              minHeight: 500,
              bgcolor: state.globalStyles.backgroundColor,
              transition: 'width 0.3s ease'
            }}
            elevation={4}
          >
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="email-components">
                {(provided: any) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {state.components.length === 0 ? (
                      <Box
                        sx={{
                          p: 4,
                          textAlign: 'center',
                          border: '2px dashed #ccc',
                          borderRadius: 2,
                          color: '#666'}}>
                        <Typography variant="body2">
                          Dra komponenter hit for å begynne 👆
                        </Typography>
                      </Box>
                    ) : (
                      state.components.map((component, index) => (
                        <Draggable
                          key={component.id}
                          draggableId={component.id}
                          index={index}
                        >
                          {(provided: any, snapshot: any) => (
                            <ComponentPreview
                              component={component}
                              provided={provided}
                              isDragging={snapshot.isDragging}
                              isSelected={state.selectedComponent?.id === component.id}
                              onSelect={() => dispatch({ type: 'SELECT_COMPONENT', component })}
                              onDelete={() => deleteComponent(component.id)}
                              theming={theming}
                            />
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          </Paper>
        </Box>

        {/* Properties Panel */}
        {state.selectedComponent && (
          <Paper sx={{ width: 320, p: 2, overflow: 'auto', borderRadius: 0 }} role="complementary" aria-label="Egenskaper">
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
              Egenskaper
            </Typography>
            <ComponentProperties
              component={state.selectedComponent}
              onUpdate={(updates: any) => updateComponent(state.selectedComponent!.id, updates)}
            />
            
            <Divider sx={{ my: 2 }} />
            
            {/* Content Analyzer */}
            <EmailContentAnalyzer
              template={{
                subject: state.subject,
                preheader: state.preheader,
                components: state.components
              }} />
            
            <Box sx={{ my: 2 }} />
            
            {/* Norwegian Spell Checker */}
            <EmailNorwegianSpellCheck
              text={state.components.map(c => c.content.text || '').join(',')}
              language="nb"
              autoCheck
            />
            
            <Box sx={{ my: 2 }} />
            
            {/* Spam Checker */}
            <EmailSpamChecker
              template={{
                subject: state.subject,
                preheader: state.preheader,
                components: state.components
              }} />
          </Paper>
        )}

        {/* Variables Panel */}
        {state.showVariablesPanel && (
          <Paper sx={{ width: 350, p: 2, overflow: 'auto', borderRadius: 0 }} role="complementary" aria-label="Variabler">
            <VariablesPanel onClose={() => dispatch({ type: 'TOGGLE_VARIABLES_PANEL' })} />
          </Paper>
        )}
      </Box>

      {/* Send Test Email Dialog */}
      <Dialog open={showSendDialog} onClose={() => setShowSendDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send test-epost</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="E-postadresse"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="din@epost.no"
            sx={{ mt: 2 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSendDialog(false)}>Avbryt</Button>
          <Button
            onClick={() => sendTestEmailMutation.mutate(testEmail)}
            variant="contained"
            disabled={!testEmail || sendTestEmailMutation.isPending}
          >
            {sendTestEmailMutation.isPending ? 'Sender...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Templates Library Dialog */}
      <Dialog open={showTemplatesDialog} onClose={() => setShowTemplatesDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Velg en mal</DialogTitle>
        <DialogContent>
          <Grid2 container spacing={2} sx={{ mt: 1 }}>
            {PREBUILT_TEMPLATES.map((template) => (
              <Grid2 size={{ xs: 12, sm: 6 }} key={template.name}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }
                  }}
                  onClick={() => loadTemplate(template)}
                >
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                    {template.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {template.components.length} komponenter
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip label={template.category} size="small" />
                  </Box>
                </Paper>
              </Grid2>
            ))}
          </Grid2>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplatesDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Toast notifications */}
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration}
          onClose={() => removeToast(toast.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => removeToast(toast.id)}
            severity={toast.type}
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ComponentPreview = React.memo(({ component, provided, isDragging, isSelected, onSelect, onDelete, theming }: any) => {
  return (
    <Paper
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      elevation={isDragging ? 8 : isSelected ? 4 : 1}
      onClick={onSelect}
      sx={{
        p: 2,
        mb: 2,
        position: 'relative',
        cursor: 'pointer',
        border: isSelected ? `2px solid ${theming.colors.primary}` : '2px solid transparent','&:hover': {
          borderColor: theming.colors.primary, '& .actions': { opacity: 1 }
        }
      }}
      role="article"
      aria-label={`Email component: ${component.type}`}
    >
      <Box className="actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s' }}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Slett komponent">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <RenderComponent component={component} />
    </Paper>
  );
});

const RenderComponent = ({ component }: { component: EmailComponent }) => {
  const hasVariables = (text: string) => /\{\{\w+\}\}/.test(text || '');
  
  const renderText = (text: string) => {
    if (hasVariables(text)) {
      return (
        <Box component="span">
          {text.split(/(\{\{\w+\}\})/).map((part, i) => {
            if (part.match(/\{\{\w+\}\}/)) {
              return (
                <Chip
                  key={i}
                  label={part}
                  size="small"
                  sx={{ fontSize: 10, height: 18, mx: 0.5 }}
                  color="primary"
                  variant="outlined"
                />
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </Box>
      );
    }
    return text;
  };

  switch (component.type) {
    case 'header': return <Typography variant="h4" style={{ ...component.styles }}>{renderText(component.content.text || 'Overskrift')}</Typography>;
    case 'text': return <Typography variant="body1" style={{ ...component.styles }}>{renderText(component.content.text || 'Tekst')}</Typography>;
    case 'button': return <Button variant="contained" style={{ ...component.styles }}>{renderText(component.content.text || 'Knapp')}</Button>;
    case 'image': return <Box component="img" src={component.content.src || '/api/placeholder/400/200'} alt={component.content.alt} style={{ ...component.styles }} />;
    case 'video': return (
        <Box sx={{ position: 'relative', paddingTop: '56.25%', bgcolor: '#000'}}>
          <Typography sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff'}}>
            🎬 Video: {component.content.videoUrl || 'Ingen URL'}
          </Typography>
        </Box>
      );
    case 'columns': return (
        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              {renderText(component.content.columns?.[0]?.content || 'Kolonne 1')}
            </Paper>
          </Grid2>
          <Grid2 size={{ xs: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              {renderText(component.content.columns?.[1]?.content || 'Kolonne 2')}
            </Paper>
          </Grid2>
        </Grid2>
      );
    case 'divider': return <Divider sx={{ ...component.styles }} />;
    case 'spacer': return <Box sx={{ height: component.styles.height || 20 }} />;
    default: return <Box>Component: {component.type}</Box>;
  }
};

const ComponentProperties = ({ component, onUpdate }: any) => {
  const [isRichTextMode, setIsRichTextMode] = useState(true);
  const [showImageSettings, setShowImageSettings] = useState(false);
  
  // Show different fields based on component type
  const hasTextContent = ['header','text','button','footer'].includes(component.type);
  const hasImageContent = component.type === 'image';
  const hasUrlContent = component.type === 'button';
  
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
        {component.type.toUpperCase()} EGENSKAPER
      </Typography>
      
      {/* Text content with RichTextEditor */}
      {hasTextContent && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Innhold</Typography>
            <Button 
              size="small" 
              onClick={() => setIsRichTextMode(!isRichTextMode)}
              sx={{ fontSize: 10 }}>
              {isRichTextMode ? 'HTML' : 'Editor'}
            </Button>
          </Box>
          
          {isRichTextMode ? (
            <RichTextEditor
              value={component.content.text || ', '}
              onChange={(value: string) => onUpdate({ content: { ...component.content, text: value } })}
              modules={{
                toolbar: [
                  ['bold','italic','underline'],
                  [{ color: [] }],
                  [{ list: 'bullet' }],
                  ['link'],
                  ['clean']
                ]
              }}
            />
          ) : (
            <TextField
              value={component.content.text || ', '}
              onChange={(e) => onUpdate({ content: { ...component.content, text: e.target.value } })}
              multiline
              rows={4}
              fullWidth
              size="small"
              sx={{ fontFamily: 'monospace', fontSize: 11 }}
              placeholder="<p>Din HTML her...</p>"
            />
          )}
        </Box>
      )}
      
      {/* URL for buttons */}
      {hasUrlContent && (
        <TextField
          label="Lenke URL"
          value={component.content.url || ', '}
          onChange={(e) => onUpdate({ content: { ...component.content, url: e.target.value } })}
          fullWidth
          size="small"
          placeholder="https://..."
        />
      )}

      {/* Image settings */}
      {hasImageContent && (
        <>
          <TextField
            label="Bilde URL"
            value={component.content.src || ', '}
            onChange={(e) => onUpdate({ content: { ...component.content, src: e.target.value } })}
            fullWidth
            size="small"
            placeholder="https://..."
          />
          <TextField
            label="Alt tekst (tilgjengelighet)"
            value={component.content.alt || ', '}
            onChange={(e) => onUpdate({ content: { ...component.content, alt: e.target.value } })}
            fullWidth
            size="small"
            placeholder="Beskriv bildet..."
            helperText="Viktig for tilgjengelighet og SEO"
          />
        </>
      )}
      
      <Divider />
      
      {/* Style settings */}
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
        STIL
      </Typography>
      
      <TextField
        label="Farge"
        type="color"
        value={component.styles.color || '#333333'}
        onChange={(e) => onUpdate({ styles: { ...component.styles, color: e.target.value } })}
        fullWidth
        size="small"
      />

      {component.type === 'button' && (
        <TextField
          label="Bakgrunnsfarge"
          type="color"
          value={component.styles.backgroundColor || '#ff6b35'}
          onChange={(e) => onUpdate({ styles: { ...component.styles, backgroundColor: e.target.value } })}
          fullWidth
          size="small"
        />
      )}

      <FormControl fullWidth size="small">
        <InputLabel>Tekstjustering</InputLabel>
        <Select
          value={component.styles.textAlign || 'left'}
          onChange={(e) => onUpdate({ styles: { ...component.styles, textAlign: e.target.value } })}
          label="Tekstjustering"
        >
          <MenuItem value="left">Venstre</MenuItem>
          <MenuItem value="center">Senter</MenuItem>
          <MenuItem value="right">Høyre</MenuItem>
        </Select>
      </FormControl>
      
      <FormControl fullWidth size="small">
        <InputLabel>Skriftvekt</InputLabel>
        <Select
          value={component.styles.fontWeight || 'normal'}
          onChange={(e) => onUpdate({ styles: { ...component.styles, fontWeight: e.target.value } })}
          label="Skriftvekt"
        >
          <MenuItem value="normal">Normal</MenuItem>
          <MenuItem value="600">Semi-Bold</MenuItem>
          <MenuItem value="bold">Bold</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
};

const VariablesPanel = ({ onClose }: { onClose: () => void }) => {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
          Template Variabler
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Lukk panel">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Alert severity="info" sx={{ fontSize: 12 }}>
        Bruk {'{{'}variabel_navn{'},'} i teksten din
      </Alert>

      {['user','project','business','custom'].map((category: string) => (
        <Box key={category}>
          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
            {category === 'user' && '👤 Bruker'}
            {category === 'project' && '📁 Prosjekt'}
            {category === 'business' && '🏢 Bedrift'}
            {category === 'custom' && '✨ Tilpasset'}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {TEMPLATE_VARIABLES.filter(v => v.category === category).map(variable => (
              <Tooltip key={variable.key} title={variable.description} placement="left">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${variable.key}}}`);
                  }}
                  sx={{ justifyContent: 'space-between', textTransform: 'none', fontSize: 11 }}
                  fullWidth
                >
                  <span>{variable.label}</span>
                  <Chip label={`{{${variable.key}}`} size="small" sx={{ fontSize: 9, height: 18 }} />
                </Button>
              </Tooltip>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultContent(type: EmailComponent['type']): ComponentContent {
  const defaults: Record<EmailComponent['type'], ComponentContent> = {
    header: { text: 'Overskrift' },
    text: { text: 'Dette er en tekstboks.' },
    button: { text: 'Klikk her', url: '#' },
    image: { src: '/api/placeholder/400/200', alt: 'Bilde' },
    video: { videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    columns: { columns: [{ content: 'Kolonne 1' }, { content: 'Kolonne 2' }] },
    divider: {},
    social: {},
    spacer: {},
    footer: { text: '© 2025 CreatorHub Norge' }
  };
  return defaults[type];
}

function getDefaultStyles(type: EmailComponent['type']): ComponentStyles {
  const defaults: Record<EmailComponent['type'], ComponentStyles> = {
    header: { color: '#333', fontSize: 24, fontWeight: 'bold', textAlign: 'left' },
    text: { color: '#333', fontSize: 14, textAlign: 'left' },
    button: { backgroundColor: '#ff6b35', color: '#ffffff', borderRadius: 8, padding: 12 },
    image: { width: '100%' },
    video: { width: '100%' },
    columns: {},
    divider: { backgroundColor: 'rgba(255,255,255,0.10)', height: 1 },
    social: {},
    spacer: { height: 20 },
    footer: { color: '#666', fontSize: 12, textAlign: 'center' }
  };
  return defaults[type];
}

function generateHTML(components: EmailComponent[], globalStyles: GlobalStyles): string {
  const componentsHTML = components.map(c => {
    // Sanitize content before rendering
    const sanitizedText = DOMPurify.sanitize(c.content.text || ', ', {
      ALLOWED_TAGS: ['strong','em','u','br','a'],
      ALLOWED_ATTR: ['href', 'style']
    });
    
    switch (c.type) {
      case 'header': return `<h1 style="color: ${c.styles.color}; text-align: ${c.styles.textAlign};">${sanitizedText}</h1>`;
      case 'text': return `<p style="color: ${c.styles.color}; text-align: ${c.styles.textAlign};">${sanitizedText}</p>`;
      case 'button': return `<a href="${c.content.url}" style="display: inline-block; background: ${c.styles.backgroundColor}; color: ${c.styles.color}; padding: 12px 24px; text-decoration: none; border-radius: 8px;">${sanitizedText}</a>`;
      case 'image': return `<img src="${c.content.src}" alt="${DOMPurify.sanitize(c.content.alt || ', ')}" style="width: 100%;, height: auto;">`;
      case'divider': return `<hr style="border: none; border-top: 1px solid ${c.styles.backgroundColor};">`;
      default: return `<div>${sanitizedText}</div>`;
    }
  }).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
  <style>
    body { font-family: ${globalStyles.fontFamily}; background-color: ${globalStyles.backgroundColor}; margin: 0; padding: 20px; }
    .container { max-width: ${globalStyles.containerWidth}px; margin: 0 auto; background: #ffffff; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    ${componentsHTML}
  </div>
</body>
</html>`;
}
