/**
 * Communication Hub V2 - Bidirectional Multi-Panel Layout
 *
 * Features:
 * - No tab switching - everything opens as panels/overlays
 * - Bidirectional navigation - access any feature from any view
 * - Multi-panel support - email + notes + chat simultaneously
 * - Context preservation - main view never disappears
 * - Smart pre-filling - cross-linking between features
 * - Advanced notes with AI tools, categories, tags
 * - Integrated with SmartEmailComposer, SmartMeetingPreparation, UniversalChatWidget
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Avatar,
  Divider,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stack,
  Tooltip,
  Drawer,
  Badge,
  Fab,
  AppBar,
  Toolbar,
  Slide,
  Collapse,
  Snackbar,
} from '@mui/material';
import {
  Email as EmailIcon,
  Event as MeetingIcon,
  Notes as NotesIcon,
  Chat as ChatIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Inbox as InboxIcon,
  Send as SendIcon,
  Star as StarIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  CalendarToday as CalendarIcon,
  VideoCall as VideoIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Folder as FolderIcon,
  Label as LabelIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Phone as PhoneIcon,
  Check as CheckIcon,
  MoreVert as MoreIcon,
  Schedule as ScheduleIcon,
  Drafts as DraftsIcon,
  AttachFile as AttachIcon,
  Link as LinkIcon,
  SmartToy as AIIcon,
  Cloud as CloudIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  Description as DocIcon,
  Psychology as BrainIcon,
  Translate as TranslateIcon,
  Spellcheck as SpellcheckIcon,
  ContentCopy as CopyIcon,
  FormatQuote as QuoteIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingIcon,
  Lightbulb as IdeaIcon,
  Assignment as TaskIcon,
  Book as BookIcon,
  School as ResearchIcon,
  Work as ProjectIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useTheming } from '@/utils/theming-helper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import SmartEmailComposer from '../email/SmartEmailComposer';
import SmartMeetingPreparation from '../meet/SmartMeetingPreparation';
import UniversalChatWidget from '../chat/UniversalChatWidget';
import GoogleDriveDocsBridge from '../admin/GoogleDriveDocsBridge';
import NorwegianDictionaryPanel from '../admin/NorwegianDictionaryPanel';
import RichTextEditor from '../RichTextEditor';
import TextSelectionContextMenu from '../notes/TextSelectionContextMenu';
import Grid from '@mui/material/Grid2';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface CommunicationHubV2Props {
  userId: string;
  profession: string;
}

type Theming = ReturnType<typeof useTheming>;

// Panel types for multi-panel layout
type PanelType = 'email-detail' | 'email-compose' | 'note-editor' | 'meeting-detail' | 'meeting-schedule' | 'chat' | null;

interface Panel {
  id: string;
  type: PanelType;
  title: string;
  data?: PanelData;
  position: 'right' | 'bottom' | 'fullscreen';
  width?: string | number;
}

interface EmailComposeData {
  to?: string;
  subject?: string;
  replyTo?: Email;
  forward?: Email;
}

type PanelData = Email | Meeting | Note | EmailComposeData | Record<string, unknown>;

type ChatContext = {
  type: 'email' | 'meeting' | 'note';
  id: string;
  title: string;
};

// Email interfaces
interface EmailInbox {
  id: string;
  name: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'other';
  unreadCount: number;
  isDefault: boolean;
}

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments: boolean;
  inboxId: string;
}

// Meeting interfaces
interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  attendees: string[];
  location: string;
  type: 'in-person' | 'video' | 'phone';
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  preparationStatus: 'not-started' | 'in-progress' | 'ready';
}

// Advanced Note interfaces (from Creatorhubnotesnew.tsx)
export type NoteStatus = 'draft' | 'active' | 'archived';
export type NoteCategory = 'all' | 'ideas' | 'docs' | 'tasks' | 'research' | 'project' | 'meeting' | 'email' | 'personal';

interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  status: NoteStatus;
  tags: string[];
  linkedTo?: {
    type: 'email' | 'meeting' | 'project';
    id: string;
    title?: string;
  };
  linkedDocs?: string[]; // Documentation references
  googleDocsId?: string;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
}

// AI Tool types
interface AIToolState {
  paraphraseMode: 'standard' | 'fluency' | 'creative' | 'formal' | 'shorten' | 'expand';
  selectedLanguage: string;
  targetLanguage: string;
  citationStyle: 'apa' | 'mla' | 'chicago' | 'harvard';
  summaryFormat: 'bullets' | 'paragraph' | 'key-points';
  contentType: 'paragraph' | 'email' | 'article' | 'social-post';
}

export default function CommunicationHubV2({ userId, profession }: CommunicationHubV2Props) {
  const theming = useTheming(profession);
  const queryClient = useQueryClient();

  // Enhanced Master Integration for AI tools and features
  const masterIntegration = useEnhancedMasterIntegration();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STATE MANAGEMENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Multi-panel state
  const [panels, setPanels] = useState<Panel[]>([]);
  const [mainView, setMainView] = useState<'email' | 'meetings' | 'notes'>('email');

  // Email state
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedInbox, setSelectedInbox] = useState<string>('all');
  const [emailFilter, setEmailFilter] = useState<'all' | 'unread' | 'starred' | 'sent' | 'drafts'>('all');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');

  // Meeting state
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingFilter, setMeetingFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming');

  // Advanced Notes state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('all');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [showAITools, setShowAITools] = useState(false);
  const [aiToolState, setAiToolState] = useState<AIToolState>({
    paraphraseMode: 'standard',
    selectedLanguage: 'nb',
    targetLanguage: 'en',
    citationStyle: 'apa',
    summaryFormat: 'bullets',
    contentType: 'paragraph',
  });

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  // Google Drive & Dictionary state
  const [showGoogleDrive, setShowGoogleDrive] = useState(false);
  const [showDictionary, setShowDictionary] = useState(false);
  const [selectedTextForDict, setSelectedTextForDict] = useState('');

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PANEL MANAGEMENT - Bidirectional Navigation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const isEmail = (data: PanelData | undefined): data is Email =>
    !!data && typeof (data as Email).subject === 'string' && typeof (data as Email).from === 'string';

  const isMeeting = (data: PanelData | undefined): data is Meeting =>
    !!data && typeof (data as Meeting).title === 'string' && Array.isArray((data as Meeting).attendees);

  const isNote = (data: PanelData | undefined): data is Note =>
    !!data && typeof (data as Note).title === 'string' && typeof (data as Note).content === 'string';

  const isEmailComposeData = (data: PanelData | undefined): data is EmailComposeData =>
    !!data &&
    !isEmail(data) &&
    !isMeeting(data) &&
    !isNote(data) &&
    ('to' in data || 'subject' in data || 'replyTo' in data || 'forward' in data);

  const buildNotePayload = (data: PanelData | undefined): Note => {
    if (isNote(data)) {
      return {
        ...data,
        title: noteTitle,
        content: noteContent,
        tags: noteTags,
        category: noteCategory,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      id: `note_${Date.now()}`,
      title: noteTitle,
      content: noteContent,
      category: noteCategory,
      status: 'draft',
      tags: noteTags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const openPanel = useCallback((type: PanelType, data?: PanelData, position: 'right' | 'bottom' | 'fullscreen' = 'right') => {
    const newPanel: Panel = {
      id: `${type}-${Date.now()}`,
      type,
      title: getPanelTitle(type, data),
      data,
      position,
      width: position === 'right' ? 500 : '100%',
    };
    setPanels((prev) => [...prev, newPanel]);
  }, []);

  const closePanel = useCallback((panelId: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
  }, []);

  const getPanelTitle = (type: PanelType, data?: PanelData): string => {
    switch (type) {
      case 'email-detail':
        return isEmail(data) ? data.subject : 'Email';
      case 'email-compose':
        return 'Ny E-post';
      case 'note-editor':
        return isNote(data) ? data.title : 'Nytt Notat';
      case 'meeting-detail':
        return isMeeting(data) ? data.title : 'Møte';
      case 'meeting-schedule':
        return 'Planlegg Møte';
      case 'chat':
        return 'Chat';
      default:
        return 'Panel';
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BIDIRECTIONAL ACTIONS - Access any feature from any view
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // From Email → Create Note
  const createNoteFromEmail = useCallback((email: Email) => {
    const noteData: Partial<Note> = {
      title: `Note: ${email.subject}`,
      content: `<h3>Email from ${email.from}</h3><p>${email.body}</p>`,
      category: 'email',
      linkedTo: {
        type: 'email',
        id: email.id,
        title: email.subject,
      },
      tags: ['email','imported'],
    };
    openPanel('note-editor', noteData, 'right');
  }, [openPanel]);

  // From Email → Schedule Meeting
  const scheduleMeetingFromEmail = useCallback((email: Email) => {
    const meetingData: Partial<Meeting> = {
      title: `Meeting: ${email.subject}`,
      attendees: [email.from],
      notes: `Regarding, email: ${email.subject}`,
    };
    openPanel('meeting-schedule', meetingData, 'right');
  }, [openPanel]);

  // From Email → Open Chat
  const chatAboutEmail = useCallback((email: Email) => {
    setChatContext({ type: 'email', id: email.id, title: email.subject });
    setChatOpen(true);
  }, []);

  // From Meeting → Create Note
  const createNoteFromMeeting = useCallback((meeting: Meeting) => {
    const noteData: Partial<Note> = {
      title: `Meeting Notes: ${meeting.title}`,
      content: `<h3>${meeting.title}</h3><p><strong>Date:</strong> ${meeting.date} ${meeting.time}</p><p><strong>Attendees:</strong> ${meeting.attendees.join('')}</p>`,
      category: 'meeting',
      linkedTo: {
        type: 'meeting',
        id: meeting.id,
        title: meeting.title,
      },
      tags: ['meeting', meeting.type],
    };
    openPanel('note-editor', noteData, 'right');
  }, [openPanel]);

  // From Meeting → Send Email
  const emailMeetingAttendees = useCallback((meeting: Meeting) => {
    const emailData = {
      to: meeting.attendees.join(''),
      subject: `Re: ${meeting.title}`,
      initialBody: `Regarding our meeting on ${meeting.date} at ${meeting.time}`,
    };
    openPanel('email-compose', emailData, 'right');
  }, [openPanel]);

  // From Meeting → Open Chat
  const chatAboutMeeting = useCallback((meeting: Meeting) => {
    setChatContext({ type: 'meeting', id: meeting.id, title: meeting.title });
    setChatOpen(true);
  }, []);

  // From Note → Send Email
  const emailFromNote = useCallback((note: Note) => {
    const emailData = {
      subject: note.title,
      initialBody: note.content,
    };
    openPanel('email-compose', emailData, 'right');
  }, [openPanel]);

  // From Note → Schedule Meeting
  const scheduleMeetingFromNote = useCallback((note: Note) => {
    const meetingData: Partial<Meeting> = {
      title: note.title,
      notes: note.content,
    };
    openPanel('meeting-schedule', meetingData, 'right');
  }, [openPanel]);

  // From Note → Open Chat
  const chatAboutNote = useCallback((note: Note) => {
    setChatContext({ type: 'note', id: note.id, title: note.title });
    setChatOpen(true);
  }, []);

  // From Chat → Create Note
  const createNoteFromChat = useCallback((chatMessage: string) => {
    const noteData: Partial<Note> = {
      title: 'Chat Note',
      content: `<p>${chatMessage}</p>`,
      category: 'personal',
      tags: ['chat'],
    };
    openPanel('note-editor', noteData, 'right');
  }, [openPanel]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA FETCHING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Fetch inboxes
  const { data: inboxes = [] } = useQuery<EmailInbox[]>({
    queryKey: [`/api/communication/inboxes/${userId}`],
    queryFn: () => apiRequest(`/api/communication/inboxes/${userId}`),
  });

  // Fetch emails
  const { data: emails = [], refetch: refetchEmails } = useQuery<Email[]>({
    queryKey: [`/api/communication/emails/${userId}`, selectedInbox, emailFilter],
    queryFn: () => apiRequest(`/api/communication/emails/${userId}?inbox=${selectedInbox}&filter=${emailFilter}`),
  });

  // Fetch meetings
  const { data: meetings = [], refetch: refetchMeetings } = useQuery<Meeting[]>({
    queryKey: [`/api/communication/meetings/${userId}`, meetingFilter],
    queryFn: () => apiRequest(`/api/communication/meetings/${userId}?filter=${meetingFilter}`),
  });

  // Fetch notes
  const { data: notes = [], refetch: refetchNotes } = useQuery<Note[]>({
    queryKey: [`/api/communication/notes/${userId}`, noteCategory],
    queryFn: () => apiRequest(`/api/communication/notes/${userId}?category=${noteCategory}`),
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MUTATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Email mutations
  const markAsReadMutation = useMutation({
    mutationFn: (emailId: string) => apiRequest(`/api/communication/emails/${emailId}/read`, { method: 'PUT' }),
    onSuccess: () => refetchEmails(),
  });

  const toggleStarMutation = useMutation({
    mutationFn: (emailId: string) => apiRequest(`/api/communication/emails/${emailId}/star`, { method: 'PUT' }),
    onSuccess: () => refetchEmails(),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: (emailId: string) => apiRequest(`/api/communication/emails/${emailId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refetchEmails();
      setSelectedEmail(null);
      setPanels((prev) => prev.filter((p) => p.type !== 'email-detail'));
    },
  });

  // Note mutations
  const saveNoteMutation = useMutation({
    mutationFn: (note: Partial<Note>) =>
      apiRequest(`/api/communication/notes`, {
        method: 'POST',
        body: JSON.stringify({ ...note, userId }),
      }),
    onSuccess: () => {
      refetchNotes();
      setSnackbar({ open: true, message: 'Note saved successfully', severity: 'success' });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: Partial<Note> }) =>
      apiRequest(`/api/communication/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(note),
      }),
    onSuccess: () => {
      refetchNotes();
      setSnackbar({ open: true, message: 'Note updated successfully', severity: 'success' });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiRequest(`/api/communication/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refetchNotes();
      setSelectedNote(null);
      setPanels((prev) => prev.filter((p) => p.type !== 'note-editor'));
    },
  });

  // Meeting mutations
  const createMeetingMutation = useMutation({
    mutationFn: (meeting: Partial<Meeting>) =>
      apiRequest(`/api/communication/meetings`, {
        method: 'POST',
        body: { ...meeting, userId },
      }),
    onSuccess: () => {
      refetchMeetings();
      setSnackbar({ open: true, message: 'Meeting created successfully', severity: 'success' });
    },
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AI TOOLS & AUTO-SAVE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // AI Operation Wrapper - Connects to backend AI endpoints
  const runAIOperation = async <T,>(
    operationName: string,
    apiPath: string,
    payload: Record<string, unknown>
  ): Promise<T> => {
    try {
      const response = await apiRequest(apiPath, {
        method: 'POST',
        body: payload,
      });
      return response as T;
    } catch (error) {
      console.error(`AI Operation ${operationName} failed:`, error);
      setSnackbar({
        open: true,
        message: `AI ${operationName} failed. Please try again.`,
        severity: 'error'
      });
      throw error;
    }
  };

  // Auto-save for notes (debounced)
  useEffect(() => {
    if (!noteContent || !noteTitle) return;

    const autoSaveTimer = setTimeout(() => {
      setIsSaving(true);
      saveNoteMutation.mutate({
        title: noteTitle,
        content: noteContent,
        category: noteCategory,
        tags: noteTags,
        status: 'draft',
      });
      setLastSaved(new Date());
      setIsSaving(false);
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [noteContent, noteTitle, noteCategory, noteTags]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER - Multi-Panel Layout
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }} role="main" aria-label="Kommunikasjonshub V2">
      {/* Top Navigation Bar */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: theming.colors.primary }} component="header">
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, color: 'white' }}>
            Kommunikasjonshub
          </Typography>

          {/* Quick Actions - Always Accessible */}
          <Stack direction="row" spacing={1} role="group" aria-label="Hurtighandlinger">
            <Tooltip title="Skriv e-post">
              <IconButton
                color="inherit"
                onClick={() => openPanel('email-compose', {}, 'right')}
                aria-label={`Skriv e-post, ${inboxes.reduce((sum, inbox) => sum + inbox.unreadCount, 0)} uleste`}
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'common.white',
                    outlineOffset: '2px',
                  }}}
              >
                <Badge badgeContent={inboxes.reduce((sum, inbox) => sum + inbox.unreadCount, 0)} color="error">
                  <EmailIcon aria-hidden="true" />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Planlegg møte">
              <IconButton
                color="inherit"
                onClick={() => openPanel('meeting-schedule', {}, 'right')}
                aria-label="Planlegg nytt møte"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'common.white',
                    outlineOffset: '2px',
                  }}}
              >
                <MeetingIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Nytt notat">
              <IconButton
                color="inherit"
                onClick={() => openPanel('note-editor', {}, 'right')}
                aria-label="Opprett nytt notat"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'common.white',
                    outlineOffset: '2px',
                  }}}
              >
                <NotesIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Åpne chat">
              <IconButton
                color="inherit"
                onClick={() => setChatOpen(true)}
                aria-label="Åpne chat-vindu"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'common.white',
                    outlineOffset: '2px',
                  }}}
              >
                <ChatIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Oppdater">
              <IconButton
                color="inherit"
                onClick={() => {
                  refetchEmails();
                  refetchMeetings();
                  refetchNotes();
                }}
                aria-label="Oppdater alle data"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'common.white',
                    outlineOffset: '2px',
                  }}}
              >
                <RefreshIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Innstillinger">
              <IconButton
                color="inherit"
                aria-label="Åpne innstillinger"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'common.white',
                    outlineOffset: '2px',
                  }}}
              >
                <SettingsIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - View Selector */}
        <Paper
          component="nav"
          elevation={2}
          aria-label="Hovednavigasjon"
          sx={{
            width: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            gap: 2,
            borderRight: `1px solid ${theming.colors.primary}20`}}
        >
          <Tooltip title="E-post" placement="right">
            <IconButton
              onClick={() => setMainView('email')}
              aria-label={`E-post, ${inboxes.reduce((sum, inbox) => sum + inbox.unreadCount, 0)} uleste`}
              aria-pressed={mainView === 'email'}
              sx={{
                bgcolor: mainView === 'email' ? `${theming.colors.primary}20` : 'transparent','&:hover': { bgcolor: `${theming.colors.primary}10` }, '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              <Badge badgeContent={inboxes.reduce((sum, inbox) => sum + inbox.unreadCount, 0)} color="error">
                <EmailIcon aria-hidden="true" sx={{ color: mainView === 'email' ? theming.colors.primary : 'text.secondary' }} />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Møter" placement="right">
            <IconButton
              onClick={() => setMainView('meetings')}
              aria-label={`Møter, ${meetings.filter((m) => m.status === 'upcoming').length} kommende`}
              aria-pressed={mainView === 'meetings'}
              sx={{
                bgcolor: mainView === 'meetings' ? `${theming.colors.primary}20` : 'transparent','&:hover': { bgcolor: `${theming.colors.primary}10` }, '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              <Badge badgeContent={meetings.filter((m) => m.status === 'upcoming').length} color="primary">
                <MeetingIcon aria-hidden="true" sx={{ color: mainView === 'meetings' ? theming.colors.primary : 'text.secondary' }} />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Notater" placement="right">
            <IconButton
              onClick={() => setMainView('notes')}
              aria-label={`Notater, ${notes.length} totalt`}
              aria-pressed={mainView === 'notes'}
              sx={{
                bgcolor: mainView === 'notes' ? `${theming.colors.primary}20` : 'transparent','&:hover': { bgcolor: `${theming.colors.primary}10` }, '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              <Badge badgeContent={notes.length} color="primary">
                <NotesIcon aria-hidden="true" sx={{ color: mainView === 'notes' ? theming.colors.primary : 'text.secondary' }} />
              </Badge>
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Main View Area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {mainView === 'email' && (
            <EmailListView
              emails={emails}
              inboxes={inboxes}
              selectedInbox={selectedInbox}
              setSelectedInbox={setSelectedInbox}
              emailFilter={emailFilter}
              setEmailFilter={setEmailFilter}
              emailSearchQuery={emailSearchQuery}
              setEmailSearchQuery={setEmailSearchQuery}
              onEmailClick={(email) => {
                setSelectedEmail(email);
                openPanel('email-detail', email, 'right');
              }}
              onCreateNote={createNoteFromEmail}
              onScheduleMeeting={scheduleMeetingFromEmail}
              onOpenChat={chatAboutEmail}
              onStar={toggleStarMutation.mutate}
              onMarkAsRead={markAsReadMutation.mutate}
              theming={theming}
            />
          )}

          {mainView === 'meetings' && (
            <MeetingListView
              meetings={meetings}
              meetingFilter={meetingFilter}
              setMeetingFilter={setMeetingFilter}
              onMeetingClick={(meeting) => {
                setSelectedMeeting(meeting);
                openPanel('meeting-detail', meeting, 'right');
              }}
              onCreateNote={createNoteFromMeeting}
              onSendEmail={emailMeetingAttendees}
              onOpenChat={chatAboutMeeting}
              theming={theming}
            />
          )}

          {mainView === 'notes' && (
            <NotesGridView
              notes={notes}
              noteCategory={noteCategory}
              setNoteCategory={setNoteCategory}
              noteSearchQuery={noteSearchQuery}
              setNoteSearchQuery={setNoteSearchQuery}
              onNoteClick={(note) => {
                setSelectedNote(note);
                setNoteTitle(note.title);
                setNoteContent(note.content);
                setNoteTags(note.tags);
                openPanel('note-editor', note, 'right');
              }}
              onSendEmail={emailFromNote}
              onScheduleMeeting={scheduleMeetingFromNote}
              onOpenChat={chatAboutNote}
              onDelete={deleteNoteMutation.mutate}
              theming={theming}
            />
          )}
        </Box>

        {/* Right Panels - Stacked */}
        {panels.filter((p) => p.position === 'right').map((panel, index) => (
          <Slide key={panel.id} direction="left" in={true} mountOnEnter unmountOnExit>
            <Paper
              elevation={4}
              role="region"
              aria-label={panel.title}
              sx={{
                width: panel.width,
                height: '100%',
                overflow: 'auto',
                borderLeft: `1px solid ${theming.colors.primary}20`,
                position: 'relative',
                zIndex: 1000 + index}}
            >
              {/* Panel Header */}
              <Box
                sx={{
                  p: 2,
                  borderBottom: `1px solid ${theming.colors.primary}20`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: `${theming.colors.primary}05`}}
              >
                <Typography variant="h6" component="h2" id={`panel-title-${panel.id}`} sx={{ color: theming.colors.primary }}>
                  {panel.title}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => closePanel(panel.id)}
                  aria-label={`Lukk ${panel.title}`}
                  sx={{
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  <CloseIcon aria-hidden="true" />
                </IconButton>
              </Box>

              {/* Panel Content */}
              <Box sx={{ p: 2 }}>
                {panel.type === 'email-detail' && isEmail(panel.data) && (
                  <EmailDetailPanel
                    email={panel.data}
                    onReply={() => openPanel('email-compose', { replyTo: panel.data }, 'right')}
                    onForward={() => openPanel('email-compose', { forward: panel.data }, 'right')}
                    onDelete={() => deleteEmailMutation.mutate(panel.data.id)}
                    onCreateNote={() => createNoteFromEmail(panel.data)}
                    onScheduleMeeting={() => scheduleMeetingFromEmail(panel.data)}
                    onOpenChat={() => chatAboutEmail(panel.data)}
                    theming={theming}
                  />
                )}

                {panel.type === 'email-compose' && (
                  <SmartEmailComposer
                    open={true}
                    onClose={() => closePanel(panel.id)}
                    profession={profession}
                    userId={userId}
                    initialTo={isEmailComposeData(panel.data) ? panel.data.to : undefined}
                    initialSubject={isEmailComposeData(panel.data) ? panel.data.subject : undefined}
                    replyToEmail={isEmailComposeData(panel.data) ? panel.data.replyTo : undefined}
                  />
                )}

                {panel.type === 'note-editor' && (
                  <NoteEditorPanel
                    note={panel.data}
                    noteTitle={noteTitle}
                    setNoteTitle={setNoteTitle}
                    noteContent={noteContent}
                    setNoteContent={setNoteContent}
                    noteTags={noteTags}
                    setNoteTags={setNoteTags}
                    noteCategory={noteCategory}
                    setNoteCategory={setNoteCategory}
                    onSave={() => {
                      if (isNote(panel.data) && panel.data.id) {
                        updateNoteMutation.mutate({
                          id: panel.data.id,
                          note: { title: noteTitle, content: noteContent, tags: noteTags, category: noteCategory },
                        });
                      } else {
                        saveNoteMutation.mutate({
                          title: noteTitle,
                          content: noteContent,
                          tags: noteTags,
                          category: noteCategory,
                          status: 'active',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        });
                      }
                    }}
                    onSendEmail={() => emailFromNote(buildNotePayload(panel.data))}
                    onScheduleMeeting={() => scheduleMeetingFromNote(buildNotePayload(panel.data))}
                    onOpenChat={() => chatAboutNote(buildNotePayload(panel.data))}
                    showAITools={showAITools}
                    setShowAITools={setShowAITools}
                    aiToolState={aiToolState}
                    setAiToolState={setAiToolState}
                    runAIOperation={runAIOperation}
                    showGoogleDrive={showGoogleDrive}
                    setShowGoogleDrive={setShowGoogleDrive}
                    showDictionary={showDictionary}
                    setShowDictionary={setShowDictionary}
                    selectedTextForDict={selectedTextForDict}
                    setSelectedTextForDict={setSelectedTextForDict}
                    isSaving={isSaving}
                    lastSaved={lastSaved}
                    theming={theming}
                    userId={userId}
                    profession={profession}
                    projectId="default"
                    onWorklogCreated={(entry) => {
                      setSnackbar({ open: true, message: `✅ "${entry.title}" lagt til i worklog!`, severity: 'success' });
                    }}
                    onTaskCreated={(task) => {
                      setSnackbar({ open: true, message: `✅ Google Task "${task.title}" opprettet!`, severity: 'success' });
                    }}
                  />
                )}

                {panel.type === 'meeting-detail' && panel.data && (
                  <MeetingDetailPanel
                    meeting={panel.data}
                    onCreateNote={() => createNoteFromMeeting(panel.data)}
                    onSendEmail={() => emailMeetingAttendees(panel.data)}
                    onOpenChat={() => chatAboutMeeting(panel.data)}
                    onPrepare={() => {
                      // Open SmartMeetingPreparation
                    }}
                    theming={theming}
                  />
                )}

                {panel.type === 'meeting-schedule' && (
                  <SmartMeetingPreparation
                    open={true}
                    onClose={() => closePanel(panel.id)}
                    profession={profession}
                    userId={userId}
                    meetingData={panel.data}
                  />
                )}
              </Box>
            </Paper>
          </Slide>
        ))}
      </Box>

      {/* Floating Chat Widget */}
      {chatOpen && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: 400,
            height: 600,
            zIndex: 200,
            boxShadow: 4,
            borderRadius: 2,
            overflow: 'hidden'}}
        >
          <UniversalChatWidget
            userId={userId}
            profession={profession}
            context={chatContext}
            onClose={() => setChatOpen(false)}
            onCreateNote={createNoteFromChat}
          />
        </Box>
      )}

      {/* Snackbar */}
      {snackbar.open && (
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ position: 'fixed', bottom: 20, left: 20, zIndex: 3000}}
        >
          {snackbar.message}
        </Alert>
      )}
    </Box>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS - Email List View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EmailListViewProps {
  emails: Email[];
  inboxes: EmailInbox[];
  selectedInbox: string;
  setSelectedInbox: (inbox: string) => void;
  emailFilter: 'all' | 'unread' | 'starred' | 'sent' | 'drafts';
  setEmailFilter: (filter: 'all' | 'unread' | 'starred' | 'sent' | 'drafts') => void;
  emailSearchQuery: string;
  setEmailSearchQuery: (query: string) => void;
  onEmailClick: (email: Email) => void;
  onCreateNote: (email: Email) => void;
  onScheduleMeeting: (email: Email) => void;
  onOpenChat: (email: Email) => void;
  onStar: (emailId: string) => void;
  onMarkAsRead: (emailId: string) => void;
  theming: Theming;
}

function EmailListView({
  emails,
  inboxes,
  selectedInbox,
  setSelectedInbox,
  emailFilter,
  setEmailFilter,
  emailSearchQuery,
  setEmailSearchQuery,
  onEmailClick,
  onCreateNote,
  onScheduleMeeting,
  onOpenChat,
  onStar,
  onMarkAsRead,
  theming,
}: EmailListViewProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const emailFilters: EmailListViewProps['emailFilter'][] = ['all', 'unread', 'starred', 'sent', 'drafts'];

  const filteredEmails = emails.filter((email) => {
    if (emailSearchQuery) {
      const query = emailSearchQuery.toLowerCase();
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <Grid container spacing={2}>
      {/* Left: Inbox Selector & Filters */}
      <Grid size={{ xs: 12, md: 3 }}>
        <Card sx={theming.getThemedCardSx()} role="region" aria-label="Innbokser og filtre">
          <CardContent>
            <Typography variant="h6" component="h2" id="inboxes-heading" sx={{ mb: 2, color: theming.colors.primary }}>
              Innbokser
            </Typography>
            <List dense aria-labelledby="inboxes-heading" role="listbox">
              <ListItemButton
                selected={selectedInbox === 'all'}
                onClick={() => setSelectedInbox('all')}
                aria-selected={selectedInbox === 'all'}
                role="option"
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': { bgcolor: `${theming.colors.primary}20` }, '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  }}}
              >
                <ListItemIcon>
                  <InboxIcon aria-hidden="true" sx={{ color: theming.colors.primary }} />
                </ListItemIcon>
                <ListItemText primary="Alle innbokser" />
                <Chip
                  label={inboxes.reduce((sum, inbox) => sum + inbox.unreadCount, 0)}
                  size="small"
                  aria-label={`${inboxes.reduce((sum, inbox) => sum + inbox.unreadCount, 0)} uleste`}
                  sx={{ bgcolor: `${theming.colors.primary}20`, color: theming.colors.primary }}
                />
              </ListItemButton>
              {inboxes.map((inbox) => (
                <ListItemButton
                  key={inbox.id}
                  selected={selectedInbox === inbox.id}
                  onClick={() => setSelectedInbox(inbox.id)}
                  aria-selected={selectedInbox === inbox.id}
                  role="option"
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    '&.Mui-selected': { bgcolor: `${theming.colors.primary}20` }, '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  <ListItemIcon>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: theming.colors.primary }} aria-hidden="true">
                      {inbox.name[0]}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText primary={inbox.name} secondary={inbox.email} />
                  {inbox.unreadCount > 0 && (
                    <Chip
                      label={inbox.unreadCount}
                      size="small"
                      aria-label={`${inbox.unreadCount} uleste`}
                      sx={{ bgcolor: `${theming.colors.primary}20`, color: theming.colors.primary }}
                    />
                  )}
                </ListItemButton>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" component="h3" id="filters-heading" sx={{ mb: 1, color: theming.colors.primary }}>
              Filtre
            </Typography>
            <Stack spacing={0.5} role="group" aria-labelledby="filters-heading">
              {emailFilters.map((filter) => (
                <Button
                  key={filter}
                  fullWidth
                  variant={emailFilter === filter ? 'contained' : 'text'}
                  startIcon={
                    filter === 'all' ? <InboxIcon aria-hidden="true" /> :
                    filter === 'unread' ? <EmailIcon aria-hidden="true" /> :
                    filter === 'starred' ? <StarIcon aria-hidden="true" /> :
                    filter === 'sent' ? <SendIcon aria-hidden="true" /> :
                    <DraftsIcon aria-hidden="true" />
                  }
                  onClick={() => setEmailFilter(filter)}
                  aria-pressed={emailFilter === filter}
                  sx={{
                    justifyContent: 'flex-start',
                    color: emailFilter === filter.value ? 'white' : theming.colors.primary,
                    bgcolor: emailFilter === filter.value ? theming.colors.primary : 'transparent','&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  {filter === 'all'
                    ? 'All e-post'
                    : filter === 'unread'
                    ? 'Ulest'
                    : filter === 'starred'
                    ? 'Stjernemerket'
                    : filter === 'sent'
                    ? 'Sendt'
                    : 'Utkast'}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Right: Email List */}
      <Grid size={{ xs: 12, md: 9 }}>
        <Card sx={theming.getThemedCardSx()} role="region" aria-label="E-postliste">
          <CardContent>
            <TextField
              fullWidth
              placeholder="Søk i e-poster..."
              value={emailSearchQuery}
              onChange={(e) => setEmailSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon aria-hidden="true" />
                  </InputAdornment>
                )}}
              inputProps={{
                'aria-label' : 'Søk i e-poster'}}
              sx={{
                mb: 2, '& .MuiOutlinedInput-root': {
                  '&:focus-within': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  },
                }}}
            />

            <List aria-label="E-poster" role="list">
              {filteredEmails.map((email, index) => (
                <React.Fragment key={email.id}>
                  <ListItemButton
                    onClick={() => onEmailClick(email)}
                    aria-label={`${email.isRead ? '' : 'Ulest: '}${email.subject} fra ${email.from}`}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: email.isRead ? 'transparent' : `${theming.colors.primary}05`, '&:hover': { bgcolor: `${theming.colors.primary}10` }, '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: theming.colors.primary }} aria-hidden="true">{email.from[0]}</Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}>
                            {email.from}
                          </Typography>
                          {email.hasAttachments && <AttachIcon fontSize="small" aria-label="Har vedlegg" />}
                          {email.labels.map((label) => (
                            <Chip key={label} label={label} size="small" sx={{ height: 20 }} />
                          ))}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}>
                            {email.subject}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {email.body.substring(0, 100)}...
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {new Date(email.date).toLocaleDateString('nb-NO')}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStar(email.id);
                          }}
                          aria-label={email.isStarred ? 'Fjern stjerne' : 'Legg til stjerne'}
                          aria-pressed={email.isStarred}
                          sx={{
                            '&:focus-visible': {
                              outline: '3px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: '2px',
                            }}}
                        >
                          <StarIcon aria-hidden="true" sx={{ color: email.isStarred ? '#FFD700' : 'text.secondary' }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmail(email);
                            setAnchorEl(e.currentTarget);
                          }}
                          aria-label="Flere handlinger"
                          aria-haspopup="menu"
                          sx={{
                            '&:focus-visible': {
                              outline: '3px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: '2px',
                            }}}
                        >
                          <MoreIcon aria-hidden="true" />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                  {index < filteredEmails.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        aria-label="E-post handlinger"
      >
        {selectedEmail && (
          <>
            <MenuItem
              onClick={() => {
                onMarkAsRead(selectedEmail.id);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <CheckIcon aria-hidden="true" />
              </ListItemIcon>
              Merk som {selectedEmail.isRead ? 'ulest' : 'lest'}
            </MenuItem>
            <MenuItem
              onClick={() => {
                onCreateNote(selectedEmail);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <NotesIcon aria-hidden="true" />
              </ListItemIcon>
              Opprett notat
            </MenuItem>
            <MenuItem
              onClick={() => {
                onScheduleMeeting(selectedEmail);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <MeetingIcon aria-hidden="true" />
              </ListItemIcon>
              Planlegg møte
            </MenuItem>
            <MenuItem
              onClick={() => {
                onOpenChat(selectedEmail);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <ChatIcon aria-hidden="true" />
              </ListItemIcon>
              Diskuter i chat
            </MenuItem>
          </>
        )}
      </Menu>
    </Grid>
  );
}



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS - Meeting List View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MeetingListViewProps {
  meetings: Meeting[];
  meetingFilter: 'upcoming' | 'all' | 'completed';
  setMeetingFilter: (filter: 'upcoming' | 'all' | 'completed') => void;
  onMeetingClick: (meeting: Meeting) => void;
  onCreateNote: (meeting: Meeting) => void;
  onSendEmail: (meeting: Meeting) => void;
  onOpenChat: (meeting: Meeting) => void;
  theming: Theming;
}

function MeetingListView({
  meetings,
  meetingFilter,
  setMeetingFilter,
  onMeetingClick,
  onCreateNote,
  onSendEmail,
  onOpenChat,
  theming,
}: MeetingListViewProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const meetingFilters: MeetingListViewProps['meetingFilter'][] = ['upcoming', 'all', 'completed'];

  const filteredMeetings = meetings.filter((meeting) => {
    if (meetingFilter === 'upcoming') return meeting.status === 'upcoming';
    if (meetingFilter === 'completed') return meeting.status === 'completed';
    return true;
  });

  const getMeetingIcon = (type: Meeting['type']) => {
    switch (type) {
      case 'video':
        return <VideoIcon aria-hidden="true" />;
      case 'phone':
        return <PhoneIcon aria-hidden="true" />;
      case 'in-person':
        return <PersonIcon aria-hidden="true" />;
    }
  };

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'upcoming':
        return theming.colors.primary;
      case 'in-progress':
        return '#4caf50';
      case 'completed':
        return '#9e9e9e';
      case 'cancelled':
        return '#f44336';
    }
  };

  return (
    <Box role="region" aria-label="Møteoversikt">
      {/* Filter Buttons */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} role="group" aria-label="Møtefiltre">
        {meetingFilters.map((filter) => (
          <Button
            key={filter}
            variant={meetingFilter === filter ? 'contained' : 'outlined'}
            onClick={() => setMeetingFilter(filter)}
            startIcon={<MeetingIcon aria-hidden="true" />}
            aria-pressed={meetingFilter === filter}
            sx={{
              bgcolor: meetingFilter === filter ? theming.colors.primary : 'transparent',
              color: meetingFilter === filter ? 'white' : theming.colors.primary, '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            {filter === 'upcoming'
              ? `Kommende (${meetings.filter((m) => m.status === 'upcoming').length})`
              : filter === 'all'
              ? `Alle møter (${meetings.length})`
              : `Fullført (${meetings.filter((m) => m.status === 'completed').length})`}
          </Button>
        ))}
      </Stack>

      {/* Meeting Grid */}
      <Grid container spacing={2} role="list" aria-label="Møteliste">
        {filteredMeetings.map((meeting) => (
          <Grid key={meeting.id} size={{ xs: 12, md: 6, lg: 4 }} role="listitem">
            <Card
              sx={{
                ...theming.getThemedCardSx(),
                cursor: 'pointer','&:hover': { boxShadow: 4 },
                borderLeft: `4px solid ${getStatusColor(meeting.status)}`, '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
              onClick={() => onMeetingClick(meeting)}
              tabIndex={0}
              role="article"
              aria-label={`${meeting.title}, ${meeting.date} kl. ${meeting.time}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onMeetingClick(meeting);
                }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getMeetingIcon(meeting.type)}
                    <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                      {meeting.title}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMeeting(meeting);
                      setAnchorEl(e.currentTarget);
                    }}
                    aria-label="Flere handlinger"
                    aria-haspopup="menu"
                    sx={{
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    <MoreIcon aria-hidden="true" />
                  </IconButton>
                </Box>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon fontSize="small" color="action" aria-hidden="true" />
                    <Typography variant="body2">
                      {meeting.date} kl. {meeting.time}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon fontSize="small" color="action" aria-hidden="true" />
                    <Typography variant="body2">{meeting.duration} minutter</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon fontSize="small" color="action" aria-hidden="true" />
                    <Typography variant="body2">{meeting.attendees.length} deltakere</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={meeting.status === 'upcoming' ? 'Kommende' : meeting.status === 'completed' ? 'Fullført' : meeting.status === 'in-progress' ? 'Pågår' : 'Avlyst'}
                      size="small"
                      sx={{
                        bgcolor: `${getStatusColor(meeting.status)}20`,
                        color: getStatusColor(meeting.status)}}
                    />
                    <Chip
                      label={meeting.preparationStatus === 'ready' ? 'Klar' : meeting.preparationStatus === 'in-progress' ? 'Pågår' : 'Ikke startet'}
                      size="small"
                      icon={
                        meeting.preparationStatus === 'ready' ? (
                          <CheckIcon aria-hidden="true" />
                        ) : meeting.preparationStatus === 'in-progress' ? (
                          <TimelineIcon aria-hidden="true" />
                        ) : (
                          <ScheduleIcon aria-hidden="true" />
                        )
                      }
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} aria-label="Møtehandlinger">
        {selectedMeeting && (
          <>
            <MenuItem
              onClick={() => {
                onCreateNote(selectedMeeting);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <NotesIcon aria-hidden="true" />
              </ListItemIcon>
              Opprett møtenotater
            </MenuItem>
            <MenuItem
              onClick={() => {
                onSendEmail(selectedMeeting);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <EmailIcon aria-hidden="true" />
              </ListItemIcon>
              Send e-post til deltakere
            </MenuItem>
            <MenuItem
              onClick={() => {
                onOpenChat(selectedMeeting);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <ChatIcon aria-hidden="true" />
              </ListItemIcon>
              Diskuter i chat
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS - Notes Grid View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NotesGridViewProps {
  notes: Note[];
  noteCategory: NoteCategory;
  setNoteCategory: (category: NoteCategory) => void;
  noteSearchQuery: string;
  setNoteSearchQuery: (query: string) => void;
  onNoteClick: (note: Note) => void;
  onSendEmail: (note: Note) => void;
  onScheduleMeeting: (note: Note) => void;
  onOpenChat: (note: Note) => void;
  onDelete: (noteId: string) => void;
  theming: Theming;
}

function NotesGridView({
  notes,
  noteCategory,
  setNoteCategory,
  noteSearchQuery,
  setNoteSearchQuery,
  onNoteClick,
  onSendEmail,
  onScheduleMeeting,
  onOpenChat,
  onDelete,
  theming,
}: NotesGridViewProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const filteredNotes = notes.filter((note) => {
    if (noteCategory !== 'all' && note.category !== noteCategory) return false;
    if (noteSearchQuery) {
      const query = noteSearchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const getCategoryIcon = (category: NoteCategory) => {
    switch (category) {
      case 'ideas':
        return <IdeaIcon aria-hidden="true" />;
      case 'docs':
        return <DocIcon aria-hidden="true" />;
      case 'tasks':
        return <TaskIcon aria-hidden="true" />;
      case 'research':
        return <ResearchIcon aria-hidden="true" />;
      case 'project':
        return <ProjectIcon aria-hidden="true" />;
      case 'meeting':
        return <MeetingIcon aria-hidden="true" />;
      case 'email':
        return <EmailIcon aria-hidden="true" />;
      case 'personal':
        return <PersonIcon aria-hidden="true" />;
      default:
        return <NotesIcon aria-hidden="true" />;
    }
  };

  const getCategoryColor = (category: NoteCategory) => {
    const colors: Record<NoteCategory, string> = {
      all: theming.colors.primary,
      ideas: '#FFD700',
      docs: '#4CAF50',
      tasks: '#2196F3',
      research: '#9C27B0',
      project: '#FF9800',
      meeting: '#00BCD4',
      email: '#F44336',
      personal: '#795548',
    };
    return colors[category] || theming.colors.primary;
  };

  const categoryLabels: Record<NoteCategory, string> = {
    all: 'Alle',
    ideas: 'Ideer',
    docs: 'Dokumenter',
    tasks: 'Oppgaver',
    research: 'Forskning',
    project: 'Prosjekt',
    meeting: 'Møte',
    email: 'E-post',
    personal: 'Personlig',
  };

  return (
    <Box role="region" aria-label="Notatoversikt">
      {/* Category Filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }} role="group" aria-label="Kategorifiltre">
        {(['all','ideas','docs','tasks','research','project','meeting','email','personal'] as NoteCategory[]).map((category) => (
          <Chip
            key={category}
            label={categoryLabels[category]}
            icon={getCategoryIcon(category)}
            onClick={() => setNoteCategory(category)}
            aria-pressed={noteCategory === category}
            sx={{
              bgcolor: noteCategory === category ? getCategoryColor(category) : `${getCategoryColor(category)}20`,
              color: noteCategory === category ? 'white' : getCategoryColor(category),
              fontWeight: noteCategory === category ? 'bold' : 'normal','&:hover': {
                bgcolor: noteCategory === category ? getCategoryColor(category) : `${getCategoryColor(category)}30`,
              }, '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          />
        ))}
      </Stack>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Søk i notater etter tittel, innhold eller tagger..."
        value={noteSearchQuery}
        onChange={(e) => setNoteSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon aria-hidden="true" />
            </InputAdornment>
          )}}
        inputProps={{
          'aria-label' : 'Søk i notater'}}
        sx={{
          mb: 3, '& .MuiOutlinedInput-root': {
            '&:focus-within': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            },
          }}}
      />

      {/* Notes Grid */}
      <Grid container spacing={2} role="list" aria-label="Notatliste">
        {filteredNotes.map((note) => (
          <Grid key={note.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }} role="listitem">
            <Card
              sx={{
                ...theming.getThemedCardSx(),
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column','&:hover': { boxShadow: 4 },
                borderTop: `4px solid ${getCategoryColor(note.category)}`, '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
              onClick={() => onNoteClick(note)}
              tabIndex={0}
              role="article"
              aria-label={`${note.title}, kategori: ${categoryLabels[note.category]}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNoteClick(note);
                }
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getCategoryIcon(note.category)}
                    <Chip
                      label={categoryLabels[note.category]}
                      size="small"
                      sx={{
                        bgcolor: `${getCategoryColor(note.category)}20`,
                        color: getCategoryColor(note.category),
                        height: 20}}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNote(note);
                      setAnchorEl(e.currentTarget);
                    }}
                    aria-label="Flere handlinger"
                    aria-haspopup="menu"
                    sx={{
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    <MoreIcon aria-hidden="true" />
                  </IconButton>
                </Box>

                {/* Title */}
                <Typography variant="h6" component="h3" sx={{ mb: 1, color: theming.colors.primary, fontWeight: 'bold' }}>
                  {note.title}
                </Typography>

                {/* Content Preview */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'}}
                  dangerouslySetInnerHTML={{
                    __html: note.content.replace(/<[^>]*>/g, ' ').substring(0, 150) + '...'}}
                />

                {/* Tags */}
                {note.tags.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }} role="list" aria-label="Tagger">
                    {note.tags.slice(0, 3).map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        icon={<TagIcon aria-hidden="true" />}
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: `${theming.colors.primary}10`,
                          color: theming.colors.primary}}
                      />
                    ))}
                    {note.tags.length > 3 && (
                      <Chip
                        label={`+${note.tags.length - 3}`}
                        size="small"
                        aria-label={`${note.tags.length - 3} flere tagger`}
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: `${theming.colors.primary}10`,
                          color: theming.colors.primary}}
                      />
                    )}
                  </Stack>
                )}

                {/* Linked To */}
                {note.linkedTo && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LinkIcon fontSize="small" color="action" aria-hidden="true" />
                    <Typography variant="caption" color="text.secondary">
                      Koblet til {note.linkedTo.type === 'email' ? 'e-post' : note.linkedTo.type === 'meeting' ? 'møte' : 'prosjekt'}: {note.linkedTo.title}
                    </Typography>
                  </Box>
                )}

                {/* Google Docs */}
                {note.googleDocsId && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <CloudIcon fontSize="small" color="action" aria-hidden="true" />
                    <Typography variant="caption" color="text.secondary">
                      Synkronisert med Google Docs
                    </Typography>
                  </Box>
                )}

                {/* Footer */}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(note.updatedAt).toLocaleDateString('nb-NO')}
                  </Typography>
                  <Chip
                    label={note.status === 'active' ? 'Aktiv' : note.status === 'draft' ? 'Utkast' : 'Arkivert'}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      bgcolor:
                        note.status === 'active'
                          ? '#4caf5020'
                          : note.status === 'draft'
                            ? '#ff980020'
                            : '#9e9e9e20',
                      color:
                        note.status === 'active'
                          ? '#4caf50'
                          : note.status === 'draft'
                            ? '#ff9800'
                            : '#9e9e9e'}}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} aria-label="Notathandlinger">
        {selectedNote && (
          <>
            <MenuItem
              onClick={() => {
                onNoteClick(selectedNote);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <EditIcon aria-hidden="true" />
              </ListItemIcon>
              Rediger notat
            </MenuItem>
            <MenuItem
              onClick={() => {
                onSendEmail(selectedNote);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <EmailIcon aria-hidden="true" />
              </ListItemIcon>
              Send som e-post
            </MenuItem>
            <MenuItem
              onClick={() => {
                onScheduleMeeting(selectedNote);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <MeetingIcon aria-hidden="true" />
              </ListItemIcon>
              Planlegg møte
            </MenuItem>
            <MenuItem
              onClick={() => {
                onOpenChat(selectedNote);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <ChatIcon aria-hidden="true" />
              </ListItemIcon>
              Diskuter i chat
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                onDelete(selectedNote.id);
                setAnchorEl(null);
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteIcon color="error" aria-hidden="true" />
              </ListItemIcon>
              Slett notat
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DETAIL PANELS - Email Detail
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EmailDetailPanelProps {
  email: Email;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  onCreateNote: () => void;
  onScheduleMeeting: () => void;
  onOpenChat: () => void;
  theming: Theming;
}

function EmailDetailPanel({
  email,
  onReply,
  onForward,
  onDelete,
  onCreateNote,
  onScheduleMeeting,
  onOpenChat,
  theming,
}: EmailDetailPanelProps) {
  return (
    <Box role="article" aria-label={`E-post: ${email.subject}`}>
      {/* Email Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 2, color: theming.colors.primary, fontWeight: 'bold' }}>
          {email.subject}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: theming.colors.primary }} aria-hidden="true">{email.from[0]}</Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {email.from}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              til {email.to}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {new Date(email.date).toLocaleString('nb-NO')}
          </Typography>
        </Box>

        {email.labels.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} role="list" aria-label="Etiketter">
            {email.labels.map((label) => (
              <Chip key={label} label={label} size="small" icon={<LabelIcon aria-hidden="true" />} />
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Email Body */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {email.body}
        </Typography>
      </Box>

      {/* Actions */}
      <Stack spacing={2}>
        <Typography variant="subtitle2" component="h3" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
          Hurtighandlinger
        </Typography>

        <Grid container spacing={2} role="group" aria-label="E-posthandlinger">
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ReplyIcon aria-hidden="true" />}
              onClick={onReply}
              sx={{
                bgcolor: theming.colors.primary,
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Svar
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ForwardIcon aria-hidden="true" />}
              onClick={onForward}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Videresend
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<NotesIcon aria-hidden="true" />}
              onClick={onCreateNote}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Opprett notat
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<MeetingIcon aria-hidden="true" />}
              onClick={onScheduleMeeting}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Planlegg møte
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ChatIcon aria-hidden="true" />}
              onClick={onOpenChat}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Diskuter i chat
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon aria-hidden="true" />}
              onClick={onDelete}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'error.main',
                  outlineOffset: '2px',
                }}}
            >
              Slett
            </Button>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DETAIL PANELS - Meeting Detail
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MeetingDetailPanelProps {
  meeting: Meeting;
  onCreateNote: () => void;
  onSendEmail: () => void;
  onOpenChat: () => void;
  onPrepare: () => void;
  theming: Theming;
}

function MeetingDetailPanel({
  meeting,
  onCreateNote,
  onSendEmail,
  onOpenChat,
  onPrepare,
  theming,
}: MeetingDetailPanelProps) {
  const getMeetingIcon = (type: Meeting['type']) => {
    switch (type) {
      case 'video':
        return <VideoIcon aria-hidden="true" />;
      case 'phone':
        return <PhoneIcon aria-hidden="true" />;
      case 'in-person':
        return <PersonIcon aria-hidden="true" />;
    }
  };

  const getStatusLabel = (status: Meeting['status']) => {
    switch (status) {
      case 'upcoming':
        return 'Kommende';
      case 'in-progress':
        return 'Pågår';
      case 'completed':
        return 'Fullført';
      case 'cancelled':
        return 'Avlyst';
    }
  };

  const getPrepStatusLabel = (status: Meeting['preparationStatus']) => {
    switch (status) {
      case 'ready':
        return 'Klar';
      case 'in-progress':
        return 'Pågår';
      case 'not-started':
        return 'Ikke startet';
    }
  };

  return (
    <Box role="article" aria-label={`Møte: ${meeting.title}`}>
      {/* Meeting Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {getMeetingIcon(meeting.type)}
          <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
            {meeting.title}
          </Typography>
        </Box>

        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarIcon color="action" aria-hidden="true" />
            <Typography variant="body1">
              <strong>Dato:</strong> {meeting.date}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon color="action" aria-hidden="true" />
            <Typography variant="body1">
              <strong>Tid:</strong> {meeting.time} ({meeting.duration} minutter)
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon color="action" aria-hidden="true" />
            <Box>
              <Typography variant="body1">
                <strong>Deltakere:</strong>
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }} role="list" aria-label="Deltakerliste">
                {meeting.attendees.map((attendee) => (
                  <Chip key={attendee} label={attendee} size="small" avatar={<Avatar aria-hidden="true">{attendee[0]}</Avatar>} />
                ))}
              </Stack>
            </Box>
          </Box>

          {meeting.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon color="action" aria-hidden="true" />
              <Typography variant="body1">
                <strong>Sted:</strong> {meeting.location}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={getStatusLabel(meeting.status)}
              size="medium"
              sx={{
                bgcolor:
                  meeting.status === 'upcoming'
                    ? `${theming.colors.primary}20`
                    : meeting.status === 'in-progress'
                      ? '#4caf5020'
                      : meeting.status === 'completed'
                        ? '#9e9e9e20'
                        : '#f4433620',
                color:
                  meeting.status === 'upcoming'
                    ? theming.colors.primary
                    : meeting.status === 'in-progress'
                      ? '#4caf50'
                      : meeting.status === 'completed'
                        ? '#9e9e9e'
                        : '#f44336'}}
            />
            <Chip
              label={`Forberedelse: ${getPrepStatusLabel(meeting.preparationStatus)}`}
              size="medium"
              icon={
                meeting.preparationStatus === 'ready' ? (
                  <CheckIcon aria-hidden="true" />
                ) : meeting.preparationStatus === 'in-progress' ? (
                  <TimelineIcon aria-hidden="true" />
                ) : (
                  <ScheduleIcon aria-hidden="true" />
                )
              }
            />
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Meeting Notes */}
      {meeting.notes && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
            Notater:
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {meeting.notes}
          </Typography>
        </Box>
      )}

      {/* Actions */}
      <Stack spacing={2}>
        <Typography variant="subtitle2" component="h3" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
          Hurtighandlinger
        </Typography>

        <Grid container spacing={2} role="group" aria-label="Møtehandlinger">
          <Grid size={{ xs: 12 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<BrainIcon aria-hidden="true" />}
              onClick={onPrepare}
              sx={{
                bgcolor: theming.colors.primary,
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Forbered møtemateriell
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<NotesIcon aria-hidden="true" />}
              onClick={onCreateNote}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Opprett notater
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<EmailIcon aria-hidden="true" />}
              onClick={onSendEmail}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Send e-post til deltakere
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ChatIcon aria-hidden="true" />}
              onClick={onOpenChat}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Diskuter i chat
            </Button>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DETAIL PANELS - Note Editor with AI Tools
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NoteEditorPanelProps {
  note: Partial<Note> | null;
  noteTitle: string;
  setNoteTitle: (title: string) => void;
  noteContent: string;
  setNoteContent: (content: string) => void;
  noteTags: string[];
  setNoteTags: (tags: string[]) => void;
  noteCategory: NoteCategory;
  setNoteCategory: (category: NoteCategory) => void;
  onSave: () => void;
  onSendEmail: () => void;
  onScheduleMeeting: () => void;
  onOpenChat: () => void;
  showAITools: boolean;
  setShowAITools: (show: boolean) => void;
  aiToolState: AIToolState;
  setAiToolState: (state: AIToolState) => void;
  runAIOperation: <T,>(operationName: string, apiPath: string, payload: Record<string, unknown>) => Promise<T>;
  showGoogleDrive: boolean;
  setShowGoogleDrive: (show: boolean) => void;
  showDictionary: boolean;
  setShowDictionary: (show: boolean) => void;
  selectedTextForDict: string;
  setSelectedTextForDict: (text: string) => void;
  isSaving: boolean;
  lastSaved: Date | null;
  theming: Theming;
  // Worklog context menu props
  userId: string;
  profession: string;
  projectId?: string;
  onWorklogCreated?: (entry: Record<string, unknown>) => void;
  onTaskCreated?: (task: Record<string, unknown>) => void;
}

function NoteEditorPanel({
  note,
  noteTitle,
  setNoteTitle,
  noteContent,
  setNoteContent,
  noteTags,
  setNoteTags,
  noteCategory,
  setNoteCategory,
  onSave,
  onSendEmail,
  onScheduleMeeting,
  onOpenChat,
  showAITools,
  setShowAITools,
  aiToolState,
  setAiToolState,
  runAIOperation,
  showGoogleDrive,
  setShowGoogleDrive,
  showDictionary,
  setShowDictionary,
  selectedTextForDict,
  setSelectedTextForDict,
  isSaving,
  lastSaved,
  theming,
  userId,
  profession,
  projectId,
  onWorklogCreated,
  onTaskCreated,
}: NoteEditorPanelProps) {
  const [newTag, setNewTag] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Ref for text selection context menu
  const editorContainerRef = React.useRef<HTMLDivElement>(null);

  // Snackbar state for notifications
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const getCategoryIcon = (category: NoteCategory) => {
    switch (category) {
      case 'ideas':
        return <IdeaIcon aria-hidden="true" />;
      case 'docs':
        return <DocIcon aria-hidden="true" />;
      case 'tasks':
        return <TaskIcon aria-hidden="true" />;
      case 'research':
        return <ResearchIcon aria-hidden="true" />;
      case 'project':
        return <ProjectIcon aria-hidden="true" />;
      case 'meeting':
        return <MeetingIcon aria-hidden="true" />;
      case 'email':
        return <EmailIcon aria-hidden="true" />;
      case 'personal':
        return <PersonIcon aria-hidden="true" />;
      default:
        return <NotesIcon aria-hidden="true" />;
    }
  };

  const categoryLabels: Record<NoteCategory, string> = {
    all: 'Alle',
    ideas: 'Ideer',
    docs: 'Dokumenter',
    tasks: 'Oppgaver',
    research: 'Forskning',
    project: 'Prosjekt',
    meeting: 'Møte',
    email: 'E-post',
    personal: 'Personlig',
  };

  const handleAddTag = () => {
    if (newTag.trim() && !noteTags.includes(newTag.trim())) {
      setNoteTags([...noteTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNoteTags(noteTags.filter((tag) => tag !== tagToRemove));
  };

  // AI Tool Handlers - Connected to backend
  const handleParaphrase = async () => {
    if (!noteContent) return;
    setAiLoading(true);
    try {
      const response = await runAIOperation<{ paraphrased: string }>(
        'paraphrase','/api/ai/paraphrase',
        { text: noteContent, mode: aiToolState.paraphraseMode }
      );
      setNoteContent(response.paraphrased);
    } catch (error) {
      console.error('Paraphrase failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGrammarCheck = async () => {
    if (!noteContent) return;
    setAiLoading(true);
    try {
      const response = await runAIOperation<{ corrected: string; corrections: Record<string, unknown>[] }>(
        'grammar','/api/ai/grammar',
        { text: noteContent }
      );
      setNoteContent(response.corrected);
    } catch (error) {
      console.error('Grammar check failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!noteContent) return;
    setAiLoading(true);
    try {
      const response = await runAIOperation<{ summary: string }>(
        'summarize','/api/ai/summarize',
        { text: noteContent, format: aiToolState.summaryFormat }
      );
      setNoteContent(response.summary);
    } catch (error) {
      console.error('Summarize failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!noteContent) return;
    setAiLoading(true);
    try {
      const response = await runAIOperation<{ translated: string }>(
        'translate','/api/ai/translate',
        { text: noteContent, from: aiToolState.selectedLanguage, to: aiToolState.targetLanguage }
      );
      setNoteContent(response.translated);
    } catch (error) {
      console.error('Translate failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Box role="form" aria-label="Notatredigering">
      {/* Note Header */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Notattittel"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          variant="outlined"
          aria-required="true"
          inputProps={{
            'aria-label' : 'Notattittel'}}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': { borderColor: theming.colors.primary }, '&:focus-within': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
            }}}
        />

        {/* Category Selector */}
        <Box>
          <Typography variant="subtitle2" component="label" id="category-label" sx={{ mb: 1, color: theming.colors.primary }}>
            Kategori
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }} role="radiogroup" aria-labelledby="category-label">
            {(['ideas','docs','tasks','research','project','meeting','email','personal'] as NoteCategory[]).map((category) => (
              <Chip
                key={category}
                label={categoryLabels[category]}
                icon={getCategoryIcon(category)}
                onClick={() => setNoteCategory(category)}
                aria-pressed={noteCategory === category}
                sx={{
                  bgcolor: noteCategory === category ? theming.colors.primary : `${theming.colors.primary}20`,
                  color: noteCategory === category ? 'white' : theming.colors.primary, '&:hover': {
                    bgcolor: noteCategory === category ? theming.colors.primary : `${theming.colors.primary}30`,
                  }, '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  }}}
              />
            ))}
          </Stack>
        </Box>

        {/* Tags */}
        <Box>
          <Typography variant="subtitle2" component="label" id="tags-label" sx={{ mb: 1, color: theming.colors.primary }}>
            Tagger
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }} role="list" aria-labelledby="tags-label">
            {noteTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => handleRemoveTag(tag)}
                size="small"
                icon={<TagIcon aria-hidden="true" />}
                deleteIcon={<CloseIcon aria-label={`Fjern tagg ${tag}`} />}
                sx={{ bgcolor: `${theming.colors.primary}10`, color: theming.colors.primary }}
              />
            ))}
          </Stack>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Legg til tagg..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              inputProps={{
                'aria-label' : 'Ny tagg'}}
              sx={{
                flex: 1, '& .MuiOutlinedInput-root': {
                  '&:focus-within': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  },
                }}}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddTag}
              startIcon={<AddIcon aria-hidden="true" />}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Legg til
            </Button>
          </Box>
        </Box>

        {/* Linked To */}
        {note?.linkedTo && (
          <Alert severity="info" icon={<LinkIcon aria-hidden="true" />}>
            Koblet til {note.linkedTo.type === 'email' ? 'e-post' : note.linkedTo.type === 'meeting' ? 'møte' : 'prosjekt'}: {note.linkedTo.title}
          </Alert>
        )}
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* AI Tools Toggle */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" component="h3" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
          Innholdsredigering
        </Typography>
        <Button
          variant={showAITools ? 'contained' : 'outlined'}
          size="small"
          startIcon={<AIIcon aria-hidden="true" />}
          onClick={() => setShowAITools(!showAITools)}
          aria-expanded={showAITools}
          aria-controls="ai-tools-panel"
          sx={{
            bgcolor: showAITools ? theming.colors.primary : 'transparent', '&:focus-visible': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            }}}
        >
          AI-verktøy
        </Button>
      </Box>

      {/* AI Tools Panel */}
      <Collapse in={showAITools}>
        <Card id="ai-tools-panel" sx={{ mb: 2, bgcolor: `${theming.colors.primary}05`, border: `1px solid ${theming.colors.primary}20` }}>
          <CardContent>
            <Typography variant="subtitle2" component="h4" sx={{ mb: 2, color: theming.colors.primary, fontWeight: 'bold' }}>
              <AIIcon aria-hidden="true" sx={{ mr: 1, verticalAlign: 'middle' }} />
              AI-skriveassistent
            </Typography>

            <Grid container spacing={2} role="group" aria-label="AI-verktøy">
              {/* Paraphrase */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<CopyIcon aria-hidden="true" />}
                  onClick={handleParaphrase}
                  disabled={aiLoading}
                  aria-busy={aiLoading}
                  sx={{
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  Omskriv
                </Button>
              </Grid>

              {/* Grammar Check */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<SpellcheckIcon aria-hidden="true" />}
                  onClick={handleGrammarCheck}
                  disabled={aiLoading}
                  aria-busy={aiLoading}
                  sx={{
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  Grammatikksjekk
                </Button>
              </Grid>

              {/* Summarize */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<QuoteIcon aria-hidden="true" />}
                  onClick={handleSummarize}
                  disabled={aiLoading}
                  aria-busy={aiLoading}
                  sx={{
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  Oppsummer
                </Button>
              </Grid>

              {/* Translate */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<TranslateIcon aria-hidden="true" />}
                  onClick={handleTranslate}
                  disabled={aiLoading}
                  aria-busy={aiLoading}
                  sx={{
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '2px',
                    }}}
                >
                  Oversett
                </Button>
              </Grid>
            </Grid>

            {aiLoading && (
              <Box sx={{ mt: 2, textAlign: 'center' }} role="status" aria-live="polite">
                <Typography variant="caption" color="text.secondary">
                  AI behandler...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Collapse>

      {/* Rich Text Editor with Context Menu */}
      <Box
        ref={editorContainerRef}
        sx={{ mb: 3, border: `1px solid ${theming.colors.primary}20`, borderRadius: 1, overflow: 'hidden', position: 'relative' }}
        role="region"
        aria-label="Tekstredigering"
      >
        <RichTextEditor value={noteContent} onChange={setNoteContent} />

        {/* Text Selection Context Menu for Worklog/Tasks */}
        <TextSelectionContextMenu
          containerRef={editorContainerRef}
          projectId={projectId || 'default'}
          userId={userId}
          profession={profession as 'photographer' | 'videographer' | 'musicproducer' | 'vendor'}
          onWorklogCreated={(entry) => {
            setSnackbar({ open: true, message: 'Lagt til i worklog!', severity: 'success' });
            onWorklogCreated?.(entry);
          }}
          onTaskCreated={(task) => {
            setSnackbar({ open: true, message: 'Google Task opprettet!', severity: 'success' });
            onTaskCreated?.(task);
          }}
          onHighlight={(text, color) => {
            // Insert highlighted text back into editor
            const highlightedHtml = `<mark style="background-color: ${color}; padding: 2px 4px; border-radius: 2px;">${text}</mark>`;
            const newContent = noteContent.replace(text, highlightedHtml);
            setNoteContent(newContent);
            setSnackbar({ open: true, message: 'Tekst markert!', severity: 'info' });
          }}
          onActionItemCreated={() => {
            setSnackbar({ open: true, message: 'Kopiert som action item!', severity: 'info' });
          }}
        />
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} role="status">
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Auto-save Status */}
      {isSaving && (
        <Alert severity="info" sx={{ mb: 2 }} role="status" aria-live="polite">
          Lagrer...
        </Alert>
      )}
      {lastSaved && !isSaving && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }} role="status">
          Sist lagret: {lastSaved.toLocaleTimeString('nb-NO')}
        </Typography>
      )}

      {/* Action Buttons */}
      <Stack spacing={2}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<SaveIcon aria-hidden="true" />}
          onClick={onSave}
          sx={{
            bgcolor: theming.colors.primary, '&:focus-visible': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            }}}
        >
          Lagre notat
        </Button>

        <Typography variant="subtitle2" component="h3" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
          Hurtighandlinger
        </Typography>

        <Grid container spacing={2} role="group" aria-label="Notathandlinger">
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<EmailIcon aria-hidden="true" />}
              onClick={onSendEmail}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Send som e-post
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<MeetingIcon aria-hidden="true" />}
              onClick={onScheduleMeeting}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Planlegg møte
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<ChatIcon aria-hidden="true" />}
              onClick={onOpenChat}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Diskuter i chat
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<CloudIcon aria-hidden="true" />}
              onClick={() => setShowGoogleDrive(!showGoogleDrive)}
              aria-expanded={showGoogleDrive}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Google Drive
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<BookIcon aria-hidden="true" />}
              onClick={() => setShowDictionary(!showDictionary)}
              aria-expanded={showDictionary}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Norsk ordbok
            </Button>
          </Grid>
        </Grid>
      </Stack>

      {/* Google Drive Integration */}
      {showGoogleDrive && note?.id && (
        <Box sx={{ mt: 3 }} role="region" aria-label="Google Drive-integrasjon">
          <Divider sx={{ my: 2 }} />
          <GoogleDriveDocsBridge
            currentNoteId={note.id}
            onDocImported={(path: string, content: string) => {
              // Add imported doc reference to note
              const docLink = `
                <div style="border: 2px solid #4caf50; padding: 12px; border-radius: 8px; margin: 8px 0; background: #e8f5e9;">
                  <strong>Importert fra Google Drive:</strong> ${path}
                </div>
              `;
              setNoteContent(noteContent + docLink + content);
            }}
          />
        </Box>
      )}

      {/* Norwegian Dictionary */}
      {showDictionary && (
        <Box sx={{ mt: 3 }} role="region" aria-label="Norsk ordbok">
          <Divider sx={{ my: 2 }} />
          <NorwegianDictionaryPanel
            selectedText={selectedTextForDict}
            autoLookup={true}
            onWordSelected={(word, translation) => {
              // Insert translation into editor
              const translationHTML = `
                <span style="background: #fff9c4; padding: 2px 6px; border-radius: 4px;">
                  ${word} → ${translation}
                </span>
              `;
              setNoteContent(noteContent + '' + translationHTML);
            }}
          />
        </Box>
      )}
    </Box>
  );
}

