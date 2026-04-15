// @ts-nocheck
/**
 * TextSelectionContextMenu - Floating context menu for text selection in notes
 *
 * Features:
 * - Detects text selection in notes editor
 * - Shows floating menu with options:
 *   - Add to Worklog
 *   - Create Google Task
 *   - Copy as Action Item
 *   - Highlight text
 *   - Send as Email
 *   - Create Calendar Event
 *   - AI Actions (Summarize, Expand, Rephrase)
 *   - Translate NO↔EN
 *   - Add to Quote
 *   - Add to Client Notes (CRM)
 *   - Set Reminder
 *   - Convert to Checklist
 *   - Search Google Drive
 *   - Read Aloud
 * - Integrates with UniversalWorklog, Google Tasks, Calendar, Email, AI, CRM
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Chip,
  alpha,
  useTheme,
  CircularProgress,
  Autocomplete,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  WorkOutline as WorklogIcon,
  CheckCircle as TaskIcon,
  ContentCopy as CopyIcon,
  Highlight as HighlightIcon,
  FormatListBulleted as ActionItemIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Event as CalendarIcon,
  AutoAwesome as AIIcon,
  Summarize as SummarizeIcon,
  Expand as ExpandIcon,
  Refresh as RephraseIcon,
  Translate as TranslateIcon,
  RequestQuote as QuoteIcon,
  Person as ClientIcon,
  NotificationsActive as ReminderIcon,
  Checklist as ChecklistIcon,
  VolumeUp as ReadAloudIcon,
  MoreVert as MoreIcon,
  DriveFileMove as DriveIcon,
  LocationOn as LocationIcon,
  Videocam as VideocamIcon,
  Group as GroupIcon,
  Notifications as NotificationIcon,
  Repeat as RepeatIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import ExternalDataService, { type KartverketPlaceName } from '@/services/ExternalDataService';

interface TextSelectionContextMenuProps {
  containerRef: React.RefObject<HTMLElement>;
  projectId?: string;
  userId: string;
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  onWorklogCreated?: (entry: any) => void;
  onTaskCreated?: (task: any) => void;
  onHighlight?: (text: string, color: string) => void;
  onActionItemCreated?: (item: any) => void;
  onEmailCreated?: (email: any) => void;
  onCalendarEventCreated?: (event: any) => void;
  onQuoteItemAdded?: (item: any) => void;
  onClientNoteAdded?: (note: any) => void;
  onReminderCreated?: (reminder: any) => void;
  onChecklistCreated?: (checklist: string[]) => void;
  onTextProcessed?: (originalText: string, processedText: string, action: string) => void;
  clients?: Array<{ id: string; name: string; email?: string }>;
}

interface SelectionPosition {
  x: number;
  y: number;
  text: string;
}

// Worklog categories per profession
const worklogCategories = {
  photographer: [
    { value: 'shooting', label: 'Fotografering' },
    { value: 'editing', label: 'Redigering' },
    { value: 'client_meeting', label: 'Kundemøte' },
    { value: 'planning', label: 'Planlegging' },
    { value: 'general', label: 'Generelt' },
  ],
  videographer: [
    { value: 'filming', label: 'Filming' },
    { value: 'editing', label: 'Redigering' },
    { value: 'planning', label: 'Planlegging' },
    { value: 'general', label: 'Generelt' },
  ],
  musicproducer: [
    { value: 'writing', label: 'Låtskriving' },
    { value: 'recording', label: 'Innspilling' },
    { value: 'mixing', label: 'Miksing' },
    { value: 'general', label: 'Generelt' },
  ],
  vendor: [
    { value: 'sales', label: 'Salg' },
    { value: 'customer_service', label: 'Kundeservice' },
    { value: 'marketing', label: 'Markedsføring' },
    { value: 'general', label: 'Generelt' },
  ],
};

const highlightColors = [
  { value: '#ffeb3b', label: 'Gul' },
  { value: '#4caf50', label: 'Grønn' },
  { value: '#2196f3', label: 'Blå' },
  { value: '#ff9800', label: 'Oransje' },
  { value: '#e91e63', label: 'Rosa' },
  { value: '#9c27b0', label: 'Lilla' },
];

// Reminder time options
const reminderOptions = [
  { value: 15, label: 'Om 15 minutter' },
  { value: 30, label: 'Om 30 minutter' },
  { value: 60, label: 'Om 1 time' },
  { value: 180, label: 'Om 3 timer' },
  { value: 1440, label: 'I morgen' },
  { value: 10080, label: 'Neste uke' },
];

// Google Calendar color options (matches Google Calendar API color IDs)
const calendarColors = [
  { id: '1', color: '#7986CB', label: 'Lavendel' },
  { id: '2', color: '#33B679', label: 'Salvie' },
  { id: '3', color: '#8E24AA', label: 'Drue' },
  { id: '4', color: '#E67C73', label: 'Flamingo' },
  { id: '5', color: '#F6BF26', label: 'Banan' },
  { id: '6', color: '#F4511E', label: 'Mandarin' },
  { id: '7', color: '#039BE5', label: 'Fredfull' },
  { id: '8', color: '#616161', label: 'Grafitt' },
  { id: '9', color: '#3F51B5', label: 'Blåbær' },
  { id: '10', color: '#0B8043', label: 'Basilikum' },
  { id: '11', color: '#D50000', label: 'Tomat' },
];

// Calendar reminder options (in minutes before event)
const calendarReminderOptions = [
  { value: 0, label: 'Ingen påminnelse' },
  { value: 5, label: '5 minutter før' },
  { value: 10, label: '10 minutter før' },
  { value: 15, label: '15 minutter før' },
  { value: 30, label: '30 minutter før' },
  { value: 60, label: '1 time før' },
  { value: 120, label: '2 timer før' },
  { value: 1440, label: '1 dag før' },
  { value: 2880, label: '2 dager før' },
  { value: 10080, label: '1 uke før' },
];

// Recurrence options
const recurrenceOptions = [
  { value: 'none', label: 'Ikke gjenta' },
  { value: 'daily', label: 'Daglig' },
  { value: 'weekly', label: 'Ukentlig' },
  { value: 'monthly', label: 'Månedlig' },
];

export default function TextSelectionContextMenu({
  containerRef,
  projectId = 'default',
  userId,
  profession = 'photographer',
  onWorklogCreated,
  onTaskCreated,
  onHighlight,
  onActionItemCreated,
  onEmailCreated,
  onCalendarEventCreated,
  onQuoteItemAdded,
  onClientNoteAdded,
  onReminderCreated,
  onChecklistCreated,
  onTextProcessed,
  clients = [],
}: TextSelectionContextMenuProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Selection state
  const [selection, setSelection] = useState<SelectionPosition | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Dialog states
  const [worklogDialogOpen, setWorklogDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [highlightMenuAnchor, setHighlightMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<null | HTMLElement>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [clientNoteDialogOpen, setClientNoteDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [translationDialogOpen, setTranslationDialogOpen] = useState(false);

  // Form data - Worklog & Task (existing)
  const [worklogTitle, setWorklogTitle] = useState('');
  const [worklogCategory, setWorklogCategory] = useState('general,');
  const [worklogTimeSpent, setWorklogTimeSpent] = useState(30);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Form data - Email
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Form data - Calendar Event (Enhanced)
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventAttendees, setEventAttendees] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventAddGoogleMeet, setEventAddGoogleMeet] = useState(false);
  const [eventReminder, setEventReminder] = useState(30);
  const [eventRecurrence, setEventRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [eventColor, setEventColor] = useState<string>('');
  const [eventAllDay, setEventAllDay] = useState(false);

  // Form data - Quote
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteQuantity, setQuoteQuantity] = useState(1);

  // Form data - Client Note
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientNote, setClientNote] = useState('');

  // Form data - Reminder
  const [reminderText, setReminderText] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(30);

  // AI Processing states
  const [aiProcessing, setAiProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [translationDirection, setTranslationDirection] = useState<'no-en' | 'en-no'>('no-en');

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Text-to-speech state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Location autocomplete state (Kartverket integration)
  const [locationSuggestions, setLocationSuggestions] = useState<KartverketPlaceName[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationInputValue, setLocationInputValue] = useState('');

  // External data service instance
  const externalDataService = React.useMemo(() => new ExternalDataService(), []);

  // Get categories for current profession
  const categories = worklogCategories[profession] || worklogCategories.photographer;

  // Detect text selection
  const handleMouseUp = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      setMenuOpen(false);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      setSelection(null);
      setMenuOpen(false);
      return;
    }

    // Check if selection is within our container
    if (containerRef.current) {
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Verify selection is within container
      if (
        rect.top >= containerRect.top &&
        rect.bottom <= containerRect.bottom &&
        rect.left >= containerRect.left &&
        rect.right <= containerRect.right
      ) {
        setSelection({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          text: selectedText,
        });
        setMenuOpen(true);
      }
    }
  }, [containerRef]);

  // Add event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleMouseUp);
    
    // Close menu on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpen && selection) {
        const target = e.target as HTMLElement;
        if (!target.closest('.selection-context-menu')) {
          setSelection(null);
          setMenuOpen(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, handleMouseUp, menuOpen, selection]);

  // Fetch location suggestions from Kartverket
  const fetchLocationSuggestions = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setLocationSuggestions([]);
        return;
      }

      setLocationLoading(true);
      try {
        const results = await externalDataService.searchKartverketPlaceNames(query, 8);
        setLocationSuggestions(results);
      } catch (error) {
        console.warn('Failed to fetch location suggestions: ', error);
        setLocationSuggestions([]);
      } finally {
        setLocationLoading(false);
      }
    },
    [externalDataService]
  );

  // Debounced location search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (locationInputValue) {
        fetchLocationSuggestions(locationInputValue);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [locationInputValue, fetchLocationSuggestions]);

  // Create worklog entry mutation
  const createWorklogMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/projects/${projectId}/worklog`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          ...data,
          userId,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      onWorklogCreated?.(data);
      setWorklogDialogOpen(false);
      resetWorklogForm();
    },
  });

  // Create Google Task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/google-tasks/tasks`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          ...data,
          userId,
          projectId,
          profession,
        }),
      });
    },
    onSuccess: (data) => {
      onTaskCreated?.(data);
      setTaskDialogOpen(false);
      resetTaskForm();
    },
  });

  // Send Email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      onEmailCreated?.(data);
      setEmailDialogOpen(false);
      resetEmailForm();
      setSnackbar({ open: true, message: 'E-post sendt!', severity: 'success' });
    },
  });

  // Create Calendar Event mutation
  const createCalendarEventMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      onCalendarEventCreated?.(data);
      setCalendarDialogOpen(false);
      resetCalendarForm();
      setSnackbar({ open: true, message: 'Kalenderhendelse opprettet!', severity: 'success' });
    },
  });

  // Add Quote Item mutation
  const addQuoteItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/quotes/items', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      onQuoteItemAdded?.(data);
      setQuoteDialogOpen(false);
      resetQuoteForm();
      setSnackbar({ open: true, message: 'Lagt til i tilbud!', severity: 'success' });
    },
  });

  // Add Client Note mutation
  const addClientNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/crm/clients/${data.clientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ note: data.note }),
      });
    },
    onSuccess: (data) => {
      onClientNoteAdded?.(data);
      setClientNoteDialogOpen(false);
      resetClientNoteForm();
      setSnackbar({ open: true, message: 'Notat lagt til kunde!', severity: 'success' });
    },
  });

  // Create Reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      onReminderCreated?.(data);
      setReminderDialogOpen(false);
      resetReminderForm();
      setSnackbar({ open: true, message: 'Påminnelse satt!', severity: 'success' });
    },
  });

  // AI Process mutation
  const aiProcessMutation = useMutation({
    mutationFn: async (data: { text: string; action: 'summarize' | 'expand' | 'rephrase' | 'translate'; direction?: 'no-en' | 'en-no' }) => {
      return apiRequest('/api/ai/process-text', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data, variables) => {
      onTextProcessed?.(variables.text, data.result, variables.action);
      if (variables.action === 'translate') {
        setTranslatedText(data.result);
      } else {
        navigator.clipboard.writeText(data.result);
        setSnackbar({ open: true, message: `Tekst ${variables.action === 'summarize' ? 'oppsummert' : variables.action === 'expand' ? 'utvidet' : 'omformulert'} og kopiert!`, severity: 'success' });
      }
      setAiProcessing(false);
    },
    onError: () => {
      setAiProcessing(false);
      setSnackbar({ open: true, message: 'AI-behandling feilet', severity: 'error' });
    },
  });

  // Search Google Drive mutation
  const searchDriveMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest(`/api/google-drive/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
      });
    },
    onSuccess: (data) => {
      if (data.files && data.files.length > 0) {
        window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(selection?.text || '')}`,'_blank');
      } else {
        setSnackbar({ open: true, message: 'Ingen filer funnet', severity: 'info' });
      }
    },
  });

  const resetWorklogForm = () => {
    setWorklogTitle('');
    setWorklogCategory('general');
    setWorklogTimeSpent(30);
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDueDate('');
    setTaskPriority('medium');
  };

  const resetEmailForm = () => {
    setEmailTo('');
    setEmailSubject('');
    setEmailBody('');
  };

  const resetCalendarForm = () => {
    setEventTitle('');
    setEventStart('');
    setEventEnd('');
    setEventAttendees('');
    setEventLocation('');
    setEventDescription('');
    setEventAddGoogleMeet(false);
    setEventReminder(30);
    setEventRecurrence('none');
    setEventColor('');
    setEventAllDay(false);
  };

  const resetQuoteForm = () => {
    setQuoteDescription('');
    setQuotePrice('');
    setQuoteQuantity(1);
  };

  const resetClientNoteForm = () => {
    setSelectedClientId('');
    setClientNote('');
  };

  const resetReminderForm = () => {
    setReminderText('');
    setReminderMinutes(30);
  };

  // Action handlers - Original
  const handleAddToWorklog = () => {
    if (selection) {
      setWorklogTitle(selection.text.substring(0, 100));
      setWorklogDialogOpen(true);
      setMenuOpen(false);
    }
  };

  const handleCreateTask = () => {
    if (selection) {
      setTaskTitle(selection.text.substring(0, 100));
      setTaskDialogOpen(true);
      setMenuOpen(false);
    }
  };

  const handleHighlight = (color: string) => {
    if (selection && onHighlight) {
      onHighlight(selection.text, color);
    }
    setHighlightMenuAnchor(null);
    setSelection(null);
    setMenuOpen(false);
  };

  const handleCopyAsActionItem = () => {
    if (selection) {
      const actionItem = `☐ ${selection.text}`;
      navigator.clipboard.writeText(actionItem);
      onActionItemCreated?.({ text: selection.text, copied: true });
      setSnackbar({ open: true, message: 'Kopiert som handlingspunkt!', severity: 'success' });
      setSelection(null);
      setMenuOpen(false);
    }
  };

  // New Action handlers
  const handleSendEmail = () => {
    if (selection) {
      setEmailBody(selection.text);
      setEmailDialogOpen(true);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleCreateCalendarEvent = () => {
    if (selection) {
      setEventTitle(selection.text.substring(0, 100));
      setEventDescription(selection.text);
      // Set default start time to next hour
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
      setEventStart(now.toISOString().slice(0, 16));
      setEventEnd(endTime.toISOString().slice(0, 16));
      setCalendarDialogOpen(true);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleAiSummarize = () => {
    if (selection) {
      setAiProcessing(true);
      aiProcessMutation.mutate({ text: selection.text, action: 'summarize' });
      setAiMenuAnchor(null);
      setMenuOpen(false);
    }
  };

  const handleAiExpand = () => {
    if (selection) {
      setAiProcessing(true);
      aiProcessMutation.mutate({ text: selection.text, action: 'expand' });
      setAiMenuAnchor(null);
      setMenuOpen(false);
    }
  };

  const handleAiRephrase = () => {
    if (selection) {
      setAiProcessing(true);
      aiProcessMutation.mutate({ text: selection.text, action: 'rephrase' });
      setAiMenuAnchor(null);
      setMenuOpen(false);
    }
  };

  const handleTranslate = () => {
    if (selection) {
      setTranslatedText('');
      setTranslationDialogOpen(true);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleDoTranslate = () => {
    if (selection) {
      setAiProcessing(true);
      aiProcessMutation.mutate({ text: selection.text, action: 'translate', direction: translationDirection });
    }
  };

  const handleAddToQuote = () => {
    if (selection) {
      setQuoteDescription(selection.text);
      setQuoteDialogOpen(true);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleAddClientNote = () => {
    if (selection) {
      setClientNote(selection.text);
      setClientNoteDialogOpen(true);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleSetReminder = () => {
    if (selection) {
      setReminderText(selection.text.substring(0, 200));
      setReminderDialogOpen(true);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleConvertToChecklist = () => {
    if (selection) {
      const lines = selection.text.split(/[\n\r]+/).filter(line => line.trim());
      const checklist = lines.map(line => `☐ ${line.trim()}`);
      navigator.clipboard.writeText(checklist.join('\n'));
      onChecklistCreated?.(lines);
      setSnackbar({ open: true, message: `${lines.length} elementer konvertert til sjekkliste og kopiert!`, severity: 'success' });
      setSelection(null);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleSearchDrive = () => {
    if (selection) {
      searchDriveMutation.mutate(selection.text.substring(0, 100));
      setSelection(null);
      setMenuOpen(false);
      setMoreMenuAnchor(null);
    }
  };

  const handleReadAloud = () => {
    if (selection && 'speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(selection.text);
        utterance.lang = 'nb-NO'; // Norwegian Bokmål
        utterance.rate = 0.9;
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    }
  };

  const handleSaveWorklog = () => {
    if (!worklogTitle.trim()) return;

    createWorklogMutation.mutate({
      day: new Date().getDate(),
      title: worklogTitle,
      description: selection?.text || '',
      timeSpent: worklogTimeSpent,
      category: worklogCategory,
      date: new Date().toISOString(),
      isPrivate: false,
    });
  };

  const handleSaveTask = () => {
    if (!taskTitle.trim()) return;

    createTaskMutation.mutate({
      title: taskTitle,
      notes: selection?.text || '',
      due: taskDueDate || undefined,
      status: 'needsAction',
      priority: taskPriority,
    });
  };

  const handleSaveEmail = () => {
    if (!emailTo.trim() || !emailBody.trim()) return;
    sendEmailMutation.mutate({
      to: emailTo,
      subject: emailSubject,
      body: emailBody,
      projectId,
    });
  };

  const handleSaveCalendarEvent = () => {
    if (!eventTitle.trim() || (!eventAllDay && (!eventStart || !eventEnd))) return;
    const attendees = eventAttendees
      ? eventAttendees.split(',').map((entry) => ({ email: entry.trim() })).filter((attendee) => attendee.email)
      : [];

    // Build recurrence rule if needed
    let recurrence: string[] | undefined;
    if (eventRecurrence !== 'none') {
      const rruleMap = {
        daily: 'RRULE:FREQ=DAILY',
        weekly: 'RRULE:FREQ=WEEKLY',
        monthly: 'RRULE:FREQ=MONTHLY',
      };
      recurrence = [rruleMap[eventRecurrence]];
    }

    // Build reminders
    const reminders = eventReminder > 0 ? {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: eventReminder },
        { method: 'popup', minutes: eventReminder },
      ],
    } : { useDefault: true };

    createCalendarEventMutation.mutate({
      summary: eventTitle,
      description: eventDescription || selection?.text || '',
      location: eventLocation || undefined,
      start: eventAllDay
        ? { date: eventStart.split('T')[0], timeZone: 'Europe/Oslo' }
        : { dateTime: eventStart, timeZone: 'Europe/Oslo' },
      end: eventAllDay
        ? { date: eventEnd.split('T')[0], timeZone: 'Europe/Oslo' }
        : { dateTime: eventEnd, timeZone: 'Europe/Oslo' },
      attendees: attendees.length > 0 ? attendees : undefined,
      colorId: eventColor || undefined,
      recurrence,
      reminders,
      conferenceData: eventAddGoogleMeet ? {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      } : undefined,
    });
  };

  const handleSaveQuoteItem = () => {
    if (!quoteDescription.trim()) return;
    addQuoteItemMutation.mutate({
      description: quoteDescription,
      unitPrice: parseFloat(quotePrice) || 0,
      quantity: quoteQuantity,
      projectId,
    });
  };

  const handleSaveClientNote = () => {
    if (!selectedClientId || !clientNote.trim()) return;
    addClientNoteMutation.mutate({
      clientId: selectedClientId,
      note: clientNote,
    });
  };

  const handleSaveReminder = () => {
    if (!reminderText.trim()) return;
    const reminderTime = new Date(Date.now() + reminderMinutes * 60 * 1000);
    createReminderMutation.mutate({
      text: reminderText,
      remindAt: reminderTime.toISOString(),
      projectId,
      userId,
    });
  };

  if (!selection || !menuOpen) return null;

  return (
    <>
      {/* Floating Context Menu */}
      <Paper
        className="selection-context-menu"
        elevation={8}
        sx={{
          position: 'fixed',
          left: selection.x,
          top: selection.y,
          transform: 'translate(-50%, -100%)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.15)}`, '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: 8,
            borderStyle: 'solid',
            borderColor: `${theme.palette.background.paper} transparent transparent transparent`,
          }}}
      >
        {/* Primary Actions */}
        <Tooltip title="Legg til i Worklog">
          <IconButton
            size="small"
            onClick={handleAddToWorklog}
            sx={{
              color: theme.palette.primary.main, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }}}
          >
            <WorklogIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Opprett Google Task">
          <IconButton
            size="small"
            onClick={handleCreateTask}
            sx={{
              color: theme.palette.success.main,
              '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1) }}}
          >
            <TaskIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Kopier som Action Item">
          <IconButton
            size="small"
            onClick={handleCopyAsActionItem}
            sx={{
              color: theme.palette.info.main,
              '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.1) }}}
          >
            <ActionItemIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* AI Actions */}
        <Tooltip title="AI-verktøy">
          <IconButton
            size="small"
            onClick={(e) => setAiMenuAnchor(e.currentTarget)}
            disabled={aiProcessing}
            sx={{
              color: '#9c27b0','&:hover': { bgcolor: alpha('#9c27b0', 0.1) }}}
          >
            {aiProcessing ? <CircularProgress size={18} /> : <AIIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Oversett">
          <IconButton
            size="small"
            onClick={handleTranslate}
            sx={{
              color: '#00bcd4','&:hover': { bgcolor: alpha('#00bcd4', 0.1) }}}
          >
            <TranslateIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Highlight & Read Aloud */}
        <Tooltip title="Marker tekst">
          <IconButton
            size="small"
            onClick={(e) => setHighlightMenuAnchor(e.currentTarget)}
            sx={{
              color: theme.palette.warning.main,
              '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.1) }}}
          >
            <HighlightIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={isSpeaking ? 'Stopp opplesing' : 'Les høyt'}>
          <IconButton
            size="small"
            onClick={handleReadAloud}
            sx={{
              color: isSpeaking ? theme.palette.error.main : '#607d8b','&:hover': { bgcolor: alpha('#607d8b', 0.1) }}}
          >
            <ReadAloudIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* More Options */}
        <Tooltip title="Flere valg">
          <IconButton
            size="small"
            onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
            sx={{
              color: 'text.secondary','&:hover': { bgcolor: alpha(theme.palette.text.secondary, 0.1) }}}
          >
            <MoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Lukk">
          <IconButton
            size="small"
            onClick={() => { setSelection(null); setMenuOpen(false); }}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Highlight Color Menu */}
      <Menu
        anchorEl={highlightMenuAnchor}
        open={Boolean(highlightMenuAnchor)}
        onClose={() => setHighlightMenuAnchor(null)}
      >
        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
          Velg farge
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, px: 1, pb: 1 }}>
          {highlightColors.map((color) => (
            <IconButton
              key={color.value}
              size="small"
              onClick={() => handleHighlight(color.value)}
              sx={{
                bgcolor: color.value,
                width: 28,
                height: 28,
                '&:hover': { bgcolor: color.value, opacity: 0.8 }}}
            />
          ))}
        </Box>
      </Menu>

      {/* AI Actions Menu */}
      <Menu
        anchorEl={aiMenuAnchor}
        open={Boolean(aiMenuAnchor)}
        onClose={() => setAiMenuAnchor(null)}
      >
        <MenuItem onClick={handleAiSummarize}>
          <ListItemIcon><SummarizeIcon fontSize="small" sx={{ color: '#9c27b0' }} /></ListItemIcon>
          <ListItemText>Oppsummer</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAiExpand}>
          <ListItemIcon><ExpandIcon fontSize="small" sx={{ color: '#9c27b0' }} /></ListItemIcon>
          <ListItemText>Utvid tekst</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAiRephrase}>
          <ListItemIcon><RephraseIcon fontSize="small" sx={{ color: '#9c27b0' }} /></ListItemIcon>
          <ListItemText>Omformuler</ListItemText>
        </MenuItem>
      </Menu>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
      >
        <MenuItem onClick={handleSendEmail}>
          <ListItemIcon><EmailIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText>Send som e-post</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCreateCalendarEvent}>
          <ListItemIcon><CalendarIcon fontSize="small" color="secondary" /></ListItemIcon>
          <ListItemText>Opprett kalenderhendelse</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleAddToQuote}>
          <ListItemIcon><QuoteIcon fontSize="small" sx={{ color: '#ff9800' }} /></ListItemIcon>
          <ListItemText>Legg til i tilbud</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddClientNote}>
          <ListItemIcon><ClientIcon fontSize="small" sx={{ color: '#2196f3' }} /></ListItemIcon>
          <ListItemText>Legg til kundenotat</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSetReminder}>
          <ListItemIcon><ReminderIcon fontSize="small" sx={{ color: '#f44336' }} /></ListItemIcon>
          <ListItemText>Sett påminnelse</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleConvertToChecklist}>
          <ListItemIcon><ChecklistIcon fontSize="small" sx={{ color: '#4caf50' }} /></ListItemIcon>
          <ListItemText>Konverter til sjekkliste</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSearchDrive}>
          <ListItemIcon><DriveIcon fontSize="small" sx={{ color: '#34a853' }} /></ListItemIcon>
          <ListItemText>Søk i Google Drive</ListItemText>
        </MenuItem>
      </Menu>

      {/* Worklog Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={worklogDialogOpen}
        onClose={() => setWorklogDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="worklog-dialog-title"
        aria-describedby="worklog-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="worklog-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <WorklogIcon color="primary" aria-hidden="true" />
          <span>Legg til i Worklog</span>
        </DialogTitle>
        <DialogContent id="worklog-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for arbeidslogg"
          >
            <TextField
              label="Tittel"
              fullWidth
              required
              value={worklogTitle}
              onChange={(e) => setWorklogTitle(e.target.value)}
              placeholder="Hva jobbet du med?"
              inputProps={{
                'aria-label':'Tittel på arbeidslogg (påkrevd)','aria-required' : 'true'}}
              error={!worklogTitle.trim() && worklogTitle !== ''}
              helperText={!worklogTitle.trim() && worklogTitle !== '' ? 'Tittel er påkrevd' : ','}
            />

            <FormControl fullWidth>
              <InputLabel id="worklog-category-label">Kategori</InputLabel>
              <Select
                labelId="worklog-category-label"
                id="worklog-category-select"
                value={worklogCategory}
                label="Kategori"
                onChange={(e) => setWorklogCategory(e.target.value)}
                inputProps={{
                  'aria-label' : 'Velg kategori for arbeidslogg'}}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Tid brukt (minutter)"
              type="number"
              fullWidth
              value={worklogTimeSpent}
              onChange={(e) => setWorklogTimeSpent(parseInt(e.target.value) || 0)}
              inputProps={{
                'aria-label' : 'Tid brukt i minutter',
                min: 0}}
            />

            {selection && (
              <Box
                sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}
                role="region"
                aria-label="Forhåndsvisning av markert tekst"
              >
                <Typography variant="caption" color="text.secondary" component="span" id="selected-text-label">
                  Markert tekst:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, fontStyle: 'italic' }}
                  aria-labelledby="selected-text-label"
                >
                  &ldquo;{selection.text.substring(0, 200)}{selection.text.length > 200 ? '...' : ','}&rdquo;
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setWorklogDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveWorklog}
            disabled={!worklogTitle.trim() || createWorklogMutation.isPending}
            startIcon={<AddIcon aria-hidden="true" />}
            aria-label={createWorklogMutation.isPending ? 'Lagrer arbeidslogg' : 'Legg til arbeidslogg'}
            aria-busy={createWorklogMutation.isPending}
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            {createWorklogMutation.isPending ? 'Lagrer...' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Google Task Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="task-dialog-title"
        aria-describedby="task-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="task-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <TaskIcon color="success" aria-hidden="true" />
          <span>Opprett Google Task</span>
        </DialogTitle>
        <DialogContent id="task-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for Google Task"
          >
            <TextField
              label="Oppgave"
              fullWidth
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Hva skal gjøres?"
              inputProps={{
                'aria-label':'Oppgavetittel (påkrevd)','aria-required' : 'true'}}
              error={!taskTitle.trim() && taskTitle !== ''}
              helperText={!taskTitle.trim() && taskTitle !== '' ? 'Oppgavetittel er påkrevd' : ','}
            />

            <TextField
              label="Frist"
              type="date"
              fullWidth
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                'aria-label' : 'Velg frist for oppgaven'}}
            />

            <FormControl fullWidth>
              <InputLabel id="task-priority-label">Prioritet</InputLabel>
              <Select
                labelId="task-priority-label"
                id="task-priority-select"
                value={taskPriority}
                label="Prioritet"
                onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                inputProps={{
                  'aria-label' : 'Velg prioritet for oppgaven'}}
              >
                <MenuItem value="low">Lav</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">Høy</MenuItem>
              </Select>
            </FormControl>

            {selection && (
              <Box
                sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}
                role="region"
                aria-label="Forhåndsvisning av markert tekst som legges til som notat"
              >
                <Typography variant="caption" color="text.secondary" component="span" id="task-selected-text-label">
                  Markert tekst (legges til som notat):
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, fontStyle: 'italic' }}
                  aria-labelledby="task-selected-text-label"
                >
                  &ldquo;{selection.text.substring(0, 200)}{selection.text.length > 200 ? '...' : ','}&rdquo;
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setTaskDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSaveTask}
            disabled={!taskTitle.trim() || createTaskMutation.isPending}
            startIcon={<TaskIcon aria-hidden="true" />}
            aria-label={createTaskMutation.isPending ? 'Oppretter oppgave' : 'Opprett Google Task'}
            aria-busy={createTaskMutation.isPending}
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'success.main',
                outlineOffset: '2px',
              }}}
          >
            {createTaskMutation.isPending ? 'Oppretter...' : 'Opprett Task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="email-dialog-title"
        aria-describedby="email-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="email-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <EmailIcon color="primary" aria-hidden="true" />
          <span>Send som e-post</span>
        </DialogTitle>
        <DialogContent id="email-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for å sende e-post"
          >
            <TextField
              label="Til"
              type="email"
              fullWidth
              required
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="epost@eksempel.no"
              inputProps={{
                'aria-label':'Mottakers e-postadresse (påkrevd)','aria-required' : 'true'}}
              error={!emailTo.trim() && emailTo !== ''}
              helperText={!emailTo.trim() && emailTo !== '' ? 'E-postadresse er påkrevd' : ','}
            />
            <TextField
              label="Emne"
              fullWidth
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              inputProps={{
                'aria-label' : 'E-postens emne'}}
            />
            <TextField
              label="Innhold"
              fullWidth
              required
              multiline
              rows={6}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              inputProps={{
                'aria-label':'E-postens innhold (påkrevd)','aria-required' : 'true'}}
              error={!emailBody.trim() && emailBody !== ''}
              helperText={!emailBody.trim() && emailBody !== '' ? 'Innhold er påkrevd' : ','}
            />
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setEmailDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEmail}
            disabled={!emailTo.trim() || !emailBody.trim() || sendEmailMutation.isPending}
            startIcon={<EmailIcon aria-hidden="true" />}
            aria-label={sendEmailMutation.isPending ? 'Sender e-post' : 'Send e-post'}
            aria-busy={sendEmailMutation.isPending}
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            {sendEmailMutation.isPending ? 'Sender...' : 'Send e-post'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Calendar Event Dialog - Enhanced with WCAG 2.2 Compliance */}
      <Dialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="calendar-dialog-title"
        aria-describedby="calendar-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="calendar-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'secondary.main', color: 'white' }}
        >
          <CalendarIcon aria-hidden="true" />
          <span>Opprett kalenderhendelse</span>
        </DialogTitle>
        <DialogContent id="calendar-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}
            role="form"
            aria-label="Skjema for å opprette kalenderhendelse"
          >
            {/* Title - WCAG 2.2: Clear label, required indicator */}
            <TextField
              label="Tittel"
              fullWidth
              required
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="Hva handler hendelsen om?"
              inputProps={{
                'aria-label':'Hendelsens tittel (påkrevd)','aria-required' : 'true'}}
              error={!eventTitle.trim() && eventTitle !== ''}
              helperText={!eventTitle.trim() && eventTitle !== '' ? 'Tittel er påkrevd' : ','}
            />

            {/* All Day Toggle & Color - WCAG 2.2: Proper labels and focus indicators */}
            <Box
              sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}
              role="group"
              aria-label="Hendelsesinnstillinger"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={eventAllDay}
                    onChange={(e) => setEventAllDay(e.target.checked)}
                    color="secondary"
                    inputProps={{
                      'aria-label' : 'Sett som heldagshendelse',
                      role: 'switch'}}
                  />
                }
                label="Heldagshendelse"
              />
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}
                role="group"
                aria-label="Velg farge for hendelsen"
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="span"
                  id="color-picker-label"
                >
                  Farge:
                </Typography>
                <Box
                  sx={{ display: 'flex', gap: 0.5 }}
                  role="radiogroup"
                  aria-labelledby="color-picker-label"
                >
                  {calendarColors.slice(0, 6).map((c) => (
                    <IconButton
                      key={c.id}
                      size="small"
                      onClick={() => setEventColor(c.id)}
                      aria-label={`Velg ${c.label} farge`}
                      aria-pressed={eventColor === c.id}
                      role="radio"
                      aria-checked={eventColor === c.id}
                      tabIndex={eventColor === c.id ? 0 : -1}
                      sx={{
                        bgcolor: c.color,
                        width: 28,
                        height: 28,
                        border: eventColor === c.id ? '3px solid #000' : '2px solid transparent','&:hover': { bgcolor: c.color, opacity: 0.8 }, '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: '2px',
                        }}}
                    />
                  ))}
                </Box>
              </Box>
            </Box>

            {/* Date/Time Row - WCAG 2.2: Clear labels, required indicators */}
            <Box
              sx={{ display: 'flex', gap: 2 }}
              role="group"
              aria-label="Dato og tid for hendelsen"
            >
              <TextField
                label={eventAllDay ? 'Startdato' : 'Starttidspunkt'}
                type={eventAllDay ? 'date' : 'datetime-local'}
                fullWidth
                required
                value={eventAllDay ? eventStart.split('T')[0] : eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  'aria-label': eventAllDay ? 'Startdato (påkrevd)' : 'Starttidspunkt (påkrevd)','aria-required' : 'true'}}
              />
              <TextField
                label={eventAllDay ? 'Sluttdato' : 'Sluttidspunkt'}
                type={eventAllDay ? 'date' : 'datetime-local'}
                fullWidth
                required
                value={eventAllDay ? eventEnd.split('T')[0] : eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  'aria-label': eventAllDay ? 'Sluttdato (påkrevd)' : 'Sluttidspunkt (påkrevd)','aria-required' : 'true'}}
              />
            </Box>

            {/* Location & Google Meet - WCAG 2.2 Compliant */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Autocomplete
                freeSolo
                fullWidth
                options={locationSuggestions}
                getOptionLabel={(option) =>
                  typeof option === 'string'
                    ? option
                    : `${option.name}${option.municipality ? `, ${option.municipality}` : ''}`
                }
                loading={locationLoading}
                inputValue={locationInputValue}
                onInputChange={(_, newValue) => {
                  setLocationInputValue(newValue);
                  setEventLocation(newValue);
                }}
                onChange={(_, newValue) => {
                  if (typeof newValue === 'string') {
                    setEventLocation(newValue);
                  } else if (newValue) {
                    const locationString = `${newValue.name}${newValue.municipality ? `, ${newValue.municipality}` : ''}`;
                    setEventLocation(locationString);
                    setLocationInputValue(locationString);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sted"
                    placeholder="Søk etter adresse eller sted (Kartverket)"
                    helperText="Begynn å skrive for å søke i Kartverket"
                    inputProps={{
                      ...params.inputProps,
                      'aria-label':'Søk etter sted eller adresse','aria-describedby' : 'location-helper-text'}}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <LocationIcon fontSize="small" color="action" aria-hidden="true" />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                      endAdornment: (
                        <>
                          {locationLoading ? (
                            <CircularProgress
                              color="inherit"
                              size={20}
                              aria-label="Laster stedforslag"
                            />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      )}}
                    FormHelperTextProps={{
                      id: 'location-helper-text'}}
                  />
                )}
                renderOption={(props, option) => (
                  <li
                    {...props}
                    key={`${option.name}-${option.coordinates?.lat}-${option.coordinates?.lng}`}
                    role="option"
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body1" component="span">
                        {option.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="span">
                        {[option.type, option.municipality, option.county]
                          .filter(Boolean)
                          .join(' • ')}
                      </Typography>
                    </Box>
                  </li>
                )}
                noOptionsText={locationInputValue.length < 2 ? 'Skriv minst 2 tegn for å søke' : 'Ingen steder funnet'}
                loadingText="Søker i Kartverket..."
                aria-label="Stedsøk med Kartverket"
                ListboxProps={{
                  'aria-label' : 'Stedforslag fra Kartverket',
                  role: 'listbox'}}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={eventAddGoogleMeet}
                    onChange={(e) => setEventAddGoogleMeet(e.target.checked)}
                    color="primary"
                    inputProps={{
                      'aria-label' : 'Legg til Google Meet videokonferanse',
                      role: 'switch'}}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <VideocamIcon fontSize="small" color="primary" aria-hidden="true" />
                    <span>Google Meet</span>
                  </Box>
                }
                sx={{ minWidth: 160, ml: 1 }}
              />
            </Box>

            {/* Attendees - WCAG 2.2: Clear label and helper text */}
            <TextField
              label="Deltakere"
              fullWidth
              value={eventAttendees}
              onChange={(e) => setEventAttendees(e.target.value)}
              placeholder="person1@eksempel.no, person2@eksempel.no"
              helperText="Skriv inn e-postadresser separert med komma"
              inputProps={{
                'aria-label':'Legg til deltakere med e-postadresser','aria-describedby' : 'attendees-helper-text'}}
              FormHelperTextProps={{
                id: 'attendees-helper-text'}}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <GroupIcon fontSize="small" color="action" aria-hidden="true" />
                  </InputAdornment>
                )}}
            />

            {/* Description - WCAG 2.2: Clear label */}
            <TextField
              label="Beskrivelse"
              fullWidth
              multiline
              rows={3}
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Legg til mer informasjon om hendelsen..."
              inputProps={{
                'aria-label' : 'Beskrivelse av hendelsen'}}
            />

            {/* Reminder & Recurrence Row - WCAG 2.2: Clear labels and accessible select */}
            <Box
              sx={{ display: 'flex', gap: 2 }}
              role="group"
              aria-label="Påminnelse og gjentakelse innstillinger"
            >
              <FormControl fullWidth>
                <InputLabel id="reminder-select-label">Påminnelse</InputLabel>
                <Select
                  labelId="reminder-select-label"
                  id="reminder-select"
                  value={eventReminder}
                  label="Påminnelse"
                  onChange={(e) => setEventReminder(Number(e.target.value))}
                  startAdornment={
                    <InputAdornment position="start">
                      <NotificationIcon fontSize="small" color="action" aria-hidden="true" />
                    </InputAdornment>
                  }
                  inputProps={{
                    'aria-label' : 'Velg påminnelse tidspunkt'}}
                >
                  {calendarReminderOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="recurrence-select-label">Gjenta</InputLabel>
                <Select
                  labelId="recurrence-select-label"
                  id="recurrence-select"
                  value={eventRecurrence}
                  label="Gjenta"
                  onChange={(e) => setEventRecurrence(e.target.value as 'none' | 'daily' | 'weekly' | 'monthly')}
                  startAdornment={
                    <InputAdornment position="start">
                      <RepeatIcon fontSize="small" color="action" aria-hidden="true" />
                    </InputAdornment>
                  }
                  inputProps={{
                    'aria-label' : 'Velg gjentakelsesfrekvens'}}
                >
                  {recurrenceOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Summary Box - WCAG 2.2: Live region for dynamic content */}
            <Box
              sx={{ p: 2, bgcolor: alpha('#9c27b0', 0.08), borderRadius: 2, border: '1px solid', borderColor: 'secondary.light' }}
              role="region"
              aria-label="Oppsummering av hendelsesinnstillinger"
              aria-live="polite"
            >
              <Typography
                variant="subtitle2"
                color="secondary.main"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                component="h3"
              >
                <ListIcon fontSize="small" aria-hidden="true" />
                <span>Oppsummering</span>
              </Typography>
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
                role="list"
                aria-label="Valgte innstillinger"
              >
                {eventAddGoogleMeet && (
                  <Chip
                    size="small"
                    icon={<VideocamIcon fontSize="small" aria-hidden="true" />}
                    label="Google Meet"
                    color="primary"
                    variant="outlined"
                    role="listitem"
                    aria-label="Google Meet videokonferanse er aktivert"
                  />
                )}
                {eventLocation && (
                  <Chip
                    size="small"
                    icon={<LocationIcon fontSize="small" aria-hidden="true" />}
                    label={eventLocation.substring(0, 20) + (eventLocation.length > 20 ? '...' : ',')}
                    variant="outlined"
                    role="listitem"
                    aria-label={`Sted: ${eventLocation}`}
                  />
                )}
                {eventAttendees && (
                  <Chip
                    size="small"
                    icon={<GroupIcon fontSize="small" aria-hidden="true" />}
                    label={`${eventAttendees.split('').filter(e => e.trim()).length} deltaker(e)`}
                    variant="outlined"
                    role="listitem"
                    aria-label={`${eventAttendees.split('').filter(e => e.trim()).length} deltakere invitert`}
                  />
                )}
                {eventReminder > 0 && (
                  <Chip
                    size="small"
                    icon={<NotificationIcon fontSize="small" aria-hidden="true" />}
                    label={calendarReminderOptions.find(o => o.value === eventReminder)?.label}
                    variant="outlined"
                    role="listitem"
                    aria-label={`Påminnelse: ${calendarReminderOptions.find(o => o.value === eventReminder)?.label}`}
                  />
                )}
                {eventRecurrence !== 'none' && (
                  <Chip
                    size="small"
                    icon={<RepeatIcon fontSize="small" aria-hidden="true" />}
                    label={recurrenceOptions.find(o => o.value === eventRecurrence)?.label}
                    color="secondary"
                    variant="outlined"
                    role="listitem"
                    aria-label={`Gjentakelse: ${recurrenceOptions.find(o => o.value === eventRecurrence)?.label}`}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ px: 3, pb: 2 }}
          role="group"
          aria-label="Dialoghandlinger"
        >
          <Button
            onClick={() => setCalendarDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSaveCalendarEvent}
            disabled={!eventTitle.trim() || (!eventAllDay && (!eventStart || !eventEnd)) || createCalendarEventMutation.isPending}
            startIcon={createCalendarEventMutation.isPending ? <CircularProgress size={16} color="inherit" aria-hidden="true" /> : <CalendarIcon aria-hidden="true" />}
            size="large"
            aria-label={createCalendarEventMutation.isPending ? 'Oppretter hendelse, vennligst vent' : 'Opprett kalenderhendelse'}
            aria-busy={createCalendarEventMutation.isPending}
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            {createCalendarEventMutation.isPending ? 'Oppretter...' : 'Opprett hendelse'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quote Item Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={quoteDialogOpen}
        onClose={() => setQuoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="quote-dialog-title"
        aria-describedby="quote-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="quote-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <QuoteIcon sx={{ color: '#ff9800' }} aria-hidden="true" />
          <span>Legg til i tilbud</span>
        </DialogTitle>
        <DialogContent id="quote-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for tilbudspost"
          >
            <TextField
              label="Beskrivelse"
              fullWidth
              required
              multiline
              rows={3}
              value={quoteDescription}
              onChange={(e) => setQuoteDescription(e.target.value)}
              inputProps={{
                'aria-label':'Beskrivelse av tilbudspost (påkrevd)','aria-required' : 'true'}}
              error={!quoteDescription.trim() && quoteDescription !== ''}
              helperText={!quoteDescription.trim() && quoteDescription !== '' ? 'Beskrivelse er påkrevd' : ','}
            />
            <Box
              sx={{ display: 'flex', gap: 2 }}
              role="group"
              aria-label="Pris og antall"
            >
              <TextField
                label="Enhetspris (NOK)"
                type="number"
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
                sx={{ flex: 2 }}
                inputProps={{
                  'aria-label' : 'Enhetspris i norske kroner',
                  min: 0,
                  step: 0.01}}
              />
              <TextField
                label="Antall"
                type="number"
                value={quoteQuantity}
                onChange={(e) => setQuoteQuantity(parseInt(e.target.value) || 1)}
                sx={{ flex: 1 }}
                inputProps={{
                  'aria-label' : 'Antall enheter',
                  min: 1}}
              />
            </Box>
            {quotePrice && quoteQuantity && (
              <Typography
                variant="body2"
                color="text.secondary"
                role="status"
                aria-live="polite"
                aria-label={`Total pris: ${(parseFloat(quotePrice) * quoteQuantity).toLocaleString('nb-NO')} kroner`}
              >
                Total: kr {(parseFloat(quotePrice) * quoteQuantity).toLocaleString('nb-NO')}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setQuoteDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#ff9800','&:hover': { bgcolor: '#f57c00' }, '&:focus-visible': {
                outline: '3px solid',
                outlineColor: '#ff9800',
                outlineOffset: '2px',
              }}}
            onClick={handleSaveQuoteItem}
            disabled={!quoteDescription.trim() || addQuoteItemMutation.isPending}
            startIcon={<QuoteIcon aria-hidden="true" />}
            aria-label={addQuoteItemMutation.isPending ? 'Legger til tilbudspost' : 'Legg til i tilbud'}
            aria-busy={addQuoteItemMutation.isPending}
          >
            {addQuoteItemMutation.isPending ? 'Legger til...' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Note Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={clientNoteDialogOpen}
        onClose={() => setClientNoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="client-note-dialog-title"
        aria-describedby="client-note-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="client-note-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <ClientIcon sx={{ color: '#2196f3' }} aria-hidden="true" />
          <span>Legg til kundenotat</span>
        </DialogTitle>
        <DialogContent id="client-note-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for kundenotat"
          >
            <FormControl fullWidth required>
              <InputLabel id="client-select-label">Velg kunde</InputLabel>
              <Select
                labelId="client-select-label"
                id="client-select"
                value={selectedClientId}
                label="Velg kunde"
                onChange={(e) => setSelectedClientId(e.target.value)}
                inputProps={{
                  'aria-label':'Velg kunde fra listen (påkrevd)','aria-required' : 'true'}}
                error={!selectedClientId && selectedClientId !== ', '}
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name} {client.email && `(${client.email})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notat"
              fullWidth
              required
              multiline
              rows={4}
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              inputProps={{
                'aria-label':'Notat om kunden (påkrevd)','aria-required' : 'true'}}
              error={!clientNote.trim() && clientNote !== ', '}
              helperText={!clientNote.trim() && clientNote !== ', ' ? 'Notat er påkrevd' : ', '}
            />
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setClientNoteDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#2196f3','&:focus-visible': {
                outline: '3px solid',
                outlineColor: '#2196f3',
                outlineOffset: '2px',
              }}}
            onClick={handleSaveClientNote}
            disabled={!selectedClientId || !clientNote.trim() || addClientNoteMutation.isPending}
            startIcon={<ClientIcon aria-hidden="true" />}
            aria-label={addClientNoteMutation.isPending ? 'Lagrer kundenotat' : 'Lagre kundenotat'}
            aria-busy={addClientNoteMutation.isPending}
          >
            {addClientNoteMutation.isPending ? 'Lagrer...' : 'Lagre notat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reminder Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={reminderDialogOpen}
        onClose={() => setReminderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="reminder-dialog-title"
        aria-describedby="reminder-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="reminder-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <ReminderIcon sx={{ color: '#f44336' }} aria-hidden="true" />
          <span>Sett påminnelse</span>
        </DialogTitle>
        <DialogContent id="reminder-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for påminnelse"
          >
            <TextField
              label="Påminnelsestekst"
              fullWidth
              required
              multiline
              rows={2}
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              inputProps={{
                'aria-label':'Påminnelsestekst (påkrevd)','aria-required' : 'true'}}
              error={!reminderText.trim() && reminderText !== ', '}
              helperText={!reminderText.trim() && reminderText !== ', ' ? 'Påminnelsestekst er påkrevd' : ', '}
            />
            <FormControl fullWidth>
              <InputLabel id="reminder-time-label">Når</InputLabel>
              <Select
                labelId="reminder-time-label"
                id="reminder-time-select"
                value={reminderMinutes}
                label="Når"
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                inputProps={{
                  'aria-label' : 'Velg når påminnelsen skal utløses'}}
              >
                {reminderOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setReminderDialogOpen(false)}
            aria-label="Avbryt og lukk dialogen"
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#f44336', '&:hover': { bgcolor: '#d32f2f' }, '&:focus-visible': {
                outline: '3px solid',
                outlineColor: '#f44336',
                outlineOffset: '2px',
              }}}
            onClick={handleSaveReminder}
            disabled={!reminderText.trim() || createReminderMutation.isPending}
            startIcon={<ReminderIcon aria-hidden="true" />}
            aria-label={createReminderMutation.isPending ? 'Setter påminnelse' : 'Sett påminnelse'}
            aria-busy={createReminderMutation.isPending}
          >
            {createReminderMutation.isPending ? 'Setter...' : 'Sett påminnelse'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Translation Dialog - WCAG 2.2 Compliant */}
      <Dialog
        open={translationDialogOpen}
        onClose={() => setTranslationDialogOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="translation-dialog-title"
        aria-describedby="translation-dialog-description"
        role="dialog"
      >
        <DialogTitle
          id="translation-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <TranslateIcon sx={{ color: '#00bcd4' }} aria-hidden="true" />
          <span>Oversett tekst</span>
        </DialogTitle>
        <DialogContent id="translation-dialog-description">
          <Box
            component="form"
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            role="form"
            aria-label="Skjema for oversettelse"
          >
            <FormControl fullWidth>
              <InputLabel id="translation-direction-label">Retning</InputLabel>
              <Select
                labelId="translation-direction-label"
                id="translation-direction-select"
                value={translationDirection}
                label="Retning"
                onChange={(e) => setTranslationDirection(e.target.value as 'no-en' | 'en-no')}
                inputProps={{
                  'aria-label' : 'Velg oversettelsesretning'}}
              >
                <MenuItem value="no-en">Norsk til Engelsk</MenuItem>
                <MenuItem value="en-no">Engelsk til Norsk</MenuItem>
              </Select>
            </FormControl>

            <Box
              sx={{ display: 'flex', gap: 2 }}
              role="group"
              aria-label="Tekster for sammenligning"
            >
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                  component="label"
                  id="original-text-label"
                >
                  Original tekst:
                </Typography>
                <Box
                  sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, minHeight: 100 }}
                  role="region"
                  aria-labelledby="original-text-label"
                >
                  <Typography variant="body2">
                    {selection?.text || ''}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                  component="label"
                  id="translated-text-label"
                >
                  Oversatt tekst:
                </Typography>
                <Box
                  sx={{ p: 2, bgcolor: alpha('#00bcd4', 0.1), borderRadius: 1, minHeight: 100 }}
                  role="region"
                  aria-labelledby="translated-text-label"
                  aria-live="polite"
                  aria-busy={aiProcessing}
                >
                  {aiProcessing ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} aria-hidden="true" />
                      <Typography variant="body2" role="status">Oversetter...</Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2">
                      {translatedText || 'Klikk "Oversett" for å starte'}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => setTranslationDialogOpen(false)}
            aria-label="Lukk dialogen"
          >
            Lukk
          </Button>
          {translatedText && (
            <Button
              onClick={() => {
                navigator.clipboard.writeText(translatedText);
                setSnackbar({ open: true, message: 'Oversettelse kopiert!', severity: 'success' });
              }}
              startIcon={<CopyIcon aria-hidden="true" />}
              aria-label="Kopier oversatt tekst til utklippstavlen"
            >
              Kopier
            </Button>
          )}
          <Button
            variant="contained"
            sx={{
              bgcolor: '#00bcd4', '&:hover': { bgcolor: '#0097a7' }, '&:focus-visible': {
                outline: '3px solid',
                outlineColor: '#00bcd4',
                outlineOffset: '2px',
              }}}
            onClick={handleDoTranslate}
            disabled={aiProcessing}
            startIcon={aiProcessing ? <CircularProgress size={16} color="inherit" aria-hidden="true" /> : <TranslateIcon aria-hidden="true" />}
            aria-label={aiProcessing ? 'Oversetter tekst, vennligst vent' : 'Start oversettelse'}
            aria-busy={aiProcessing}
          >
            {aiProcessing ? 'Oversetter...' : 'Oversett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width:'100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
