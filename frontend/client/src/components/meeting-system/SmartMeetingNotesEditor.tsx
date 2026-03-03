import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Assignment,
  AutoFixHigh,
  CloudSync,
  Event,
  Save,
  SmartToy,
  Timeline,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
type VisibilityMode = 'personal' | 'client';
type WritingStructure = 'bullet' | 'paragraph' | 'numbered';
type FormalityLevel = 'casual' | 'professional' | 'formal';
type AiMode = 'full' | 'summarize';

interface SmartMeetingNotesEditorProps {
  meetingId: string;
  profession: Profession;
  projectId?: string;
  weddingTimelineId?: string;
  onNotesChange?: (notes: MeetingNotesPayload) => void;
}

interface TextVisibilityItem {
  text: string;
  visibility: VisibilityMode;
}

interface ActionVisibilityItem {
  task: string;
  assignedTo: string;
  dueDate: string;
  visibility: VisibilityMode;
}

interface TimelineVisibilityItem {
  event: string;
  date: string;
  notes: string;
  visibility: VisibilityMode;
}

interface StructuredNotes {
  keyPoints: TextVisibilityItem[];
  actionItems: ActionVisibilityItem[];
  decisions: TextVisibilityItem[];
  nextSteps: TextVisibilityItem[];
  clientRequests: string[];
  timeline: TimelineVisibilityItem[];
  personalReminders: string[];
  technicalNotes: string[];
}

interface MeetingNotes {
  id: string;
  meetingId: string;
  projectId?: string;
  weddingTimelineId?: string;
  content: string;
  personalNotes: string;
  clientVisibleNotes: string;
  structuredNotes: StructuredNotes;
  aiSummary: {
    full: string;
    clientVersion: string;
  };
  tags: string[];
  attendees: string[];
  meetingDate: string;
  meetingType: string;
  visibility: {
    defaultMode: VisibilityMode;
    clientCanView: boolean;
    sharedSections: string[];
  };
  googleDriveBackup: {
    enabled: boolean;
    lastBackup: string;
    documentId?: string;
    folderPath: string;
  };
  weddingTimelineIntegration: {
    enabled: boolean;
    syncedSections: string[];
    lastSync: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface MeetingNotesPayload {
  personalNotes: string;
  clientVisibleNotes: string;
  content: string;
  structuredNotes: StructuredNotes;
  visibility: {
    defaultMode: VisibilityMode;
    clientCanView: boolean;
    sharedSections: string[];
  };
  googleDriveBackupEnabled: boolean;
  weddingTimelineIntegrationEnabled: boolean;
  tags: string[];
  attendees: string[];
  updatedAt: string;
}

interface WritingStats {
  wordsPerMinute: number;
  commonPhrases: string[];
  preferredStructure: WritingStructure;
  formalityLevel: FormalityLevel;
}

interface WritingAssistResponse {
  suggestions: string[];
  completion: string;
}

interface TimelineSyncSelection {
  keyPoints: boolean;
  actionItems: boolean;
  decisions: boolean;
  nextSteps: boolean;
  clientRequests: boolean;
  timeline: boolean;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseTextVisibilityItems(raw: unknown): TextVisibilityItem[] {
  return asArray(raw)
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const text = asString(item.text);
      const visibility = asString(item.visibility) === 'client' ? 'client' : 'personal';
      return text ? { text, visibility } : null;
    })
    .filter((item): item is TextVisibilityItem => item !== null);
}

function parseActionItems(raw: unknown): ActionVisibilityItem[] {
  return asArray(raw)
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const task = asString(item.task);
      if (!task) {
        return null;
      }
      const assignedTo = asString(item.assignedTo, 'Owner');
      const dueDate = asString(item.dueDate);
      const visibility = asString(item.visibility) === 'client' ? 'client' : 'personal';
      return { task, assignedTo, dueDate, visibility };
    })
    .filter((item): item is ActionVisibilityItem => item !== null);
}

function parseTimelineItems(raw: unknown): TimelineVisibilityItem[] {
  return asArray(raw)
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const event = asString(item.event);
      if (!event) {
        return null;
      }
      const date = asString(item.date);
      const notes = asString(item.notes);
      const visibility = asString(item.visibility) === 'client' ? 'client' : 'personal';
      return { event, date, notes, visibility };
    })
    .filter((item): item is TimelineVisibilityItem => item !== null);
}

function parseStringArray(raw: unknown): string[] {
  return asArray(raw).map((item) => asString(item)).filter((item) => item.length > 0);
}

function defaultStructuredNotes(): StructuredNotes {
  return {
    keyPoints: [],
    actionItems: [],
    decisions: [],
    nextSteps: [],
    clientRequests: [],
    timeline: [],
    personalReminders: [],
    technicalNotes: [],
  };
}

function toStructuredNotes(raw: unknown): StructuredNotes {
  if (!isRecord(raw)) {
    return defaultStructuredNotes();
  }

  return {
    keyPoints: parseTextVisibilityItems(raw.keyPoints),
    actionItems: parseActionItems(raw.actionItems),
    decisions: parseTextVisibilityItems(raw.decisions),
    nextSteps: parseTextVisibilityItems(raw.nextSteps),
    clientRequests: parseStringArray(raw.clientRequests),
    timeline: parseTimelineItems(raw.timeline),
    personalReminders: parseStringArray(raw.personalReminders),
    technicalNotes: parseStringArray(raw.technicalNotes),
  };
}

function defaultMeetingNotes(meetingId: string): MeetingNotes {
  const now = new Date().toISOString();
  return {
    id: `local-${meetingId}`,
    meetingId,
    content: '',
    personalNotes: '',
    clientVisibleNotes: '',
    structuredNotes: defaultStructuredNotes(),
    aiSummary: {
      full: '',
      clientVersion: '',
    },
    tags: [],
    attendees: [],
    meetingDate: now,
    meetingType: 'planning',
    visibility: {
      defaultMode: 'personal',
      clientCanView: false,
      sharedSections: [],
    },
    googleDriveBackup: {
      enabled: false,
      lastBackup: '',
      folderPath: '',
    },
    weddingTimelineIntegration: {
      enabled: false,
      syncedSections: [],
      lastSync: '',
    },
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMeetingNotes(raw: unknown, meetingId: string): MeetingNotes {
  const fallback = defaultMeetingNotes(meetingId);
  if (!isRecord(raw)) {
    return fallback;
  }

  const aiSummary = isRecord(raw.aiSummary) ? raw.aiSummary : {};
  const visibility = isRecord(raw.visibility) ? raw.visibility : {};
  const googleDriveBackup = isRecord(raw.googleDriveBackup) ? raw.googleDriveBackup : {};
  const weddingTimelineIntegration = isRecord(raw.weddingTimelineIntegration)
    ? raw.weddingTimelineIntegration
    : {};

  return {
    id: asString(raw.id, fallback.id),
    meetingId: asString(raw.meetingId, meetingId),
    projectId: asString(raw.projectId) || undefined,
    weddingTimelineId: asString(raw.weddingTimelineId) || undefined,
    content: asString(raw.content),
    personalNotes: asString(raw.personalNotes),
    clientVisibleNotes: asString(raw.clientVisibleNotes),
    structuredNotes: toStructuredNotes(raw.structuredNotes),
    aiSummary: {
      full: asString(aiSummary.full),
      clientVersion: asString(aiSummary.clientVersion),
    },
    tags: parseStringArray(raw.tags),
    attendees: parseStringArray(raw.attendees),
    meetingDate: asString(raw.meetingDate, fallback.meetingDate),
    meetingType: asString(raw.meetingType, fallback.meetingType),
    visibility: {
      defaultMode: asString(visibility.defaultMode) === 'client' ? 'client' : 'personal',
      clientCanView: asBoolean(visibility.clientCanView),
      sharedSections: parseStringArray(visibility.sharedSections),
    },
    googleDriveBackup: {
      enabled: asBoolean(googleDriveBackup.enabled),
      lastBackup: asString(googleDriveBackup.lastBackup),
      documentId: asString(googleDriveBackup.documentId) || undefined,
      folderPath: asString(googleDriveBackup.folderPath),
    },
    weddingTimelineIntegration: {
      enabled: asBoolean(weddingTimelineIntegration.enabled),
      syncedSections: parseStringArray(weddingTimelineIntegration.syncedSections),
      lastSync: asString(weddingTimelineIntegration.lastSync),
    },
    createdAt: asString(raw.createdAt, fallback.createdAt),
    updatedAt: asString(raw.updatedAt, fallback.updatedAt),
  };
}

function deriveLocalSuggestions(profession: Profession, mode: VisibilityMode, structure: WritingStructure): string[] {
  const bank: Record<Profession, Record<VisibilityMode, string[]>> = {
    photographer: {
      personal: [
        'Capture candid entrance reactions from family and friends.',
        'Confirm backup body and fast prime lens before ceremony.',
        'Mark low-light sections for flash/no-flash handling.',
      ],
      client: [
        'We aligned on a documentary style with natural color rendering.',
        'Family group sequence is scheduled right after ceremony.',
        'Delivery timeline and gallery access were reviewed.',
      ],
    },
    videographer: {
      personal: [
        'Record clean room tone before vows for smoother dialogue cleanup.',
        'Schedule drone window with weather fallback at golden hour.',
        'Flag B-roll priority: venue details, hands, candid interactions.',
      ],
      client: [
        'Cinematic pacing and music arc were confirmed in this meeting.',
        'Interview prompts were finalized for key participants.',
        'Delivery package includes teaser + full-length edit.',
      ],
    },
    music_producer: {
      personal: [
        'Track arrangement milestone: verse hook transition refinement.',
        'Need alt vocal takes for choruses with tighter articulation.',
        'Mix reference points selected for low-end and vocal depth.',
      ],
      client: [
        'Arrangement direction and mood board were approved.',
        'Revision rounds and turn-around expectations were clarified.',
        'Final delivery targets include streaming and social stems.',
      ],
    },
    vendor: {
      personal: [
        'Confirm inventory readiness and backup logistics route.',
        'Prepare risk notes for weather-dependent setup items.',
        'Cross-check timeline dependencies with external suppliers.',
      ],
      client: [
        'Scope, handoff checkpoints and ownership were agreed.',
        'Final quote assumptions were validated with the client.',
        'Escalation path for urgent changes was documented.',
      ],
    },
    enterprise: {
      personal: [
        'Document decision log with owner and deadline per action.',
        'Track blockers in order of downstream impact.',
        'Prepare follow-up for unresolved dependencies.',
      ],
      client: [
        'Meeting summary focuses on outcomes, owners and dates.',
        'Stakeholder approval process and sign-off criteria were confirmed.',
        'Execution timeline was aligned across teams.',
      ],
    },
  };

  const base = bank[profession][mode];
  if (structure === 'numbered') {
    return base.map((line, index) => `${index + 1}. ${line}`);
  }
  if (structure === 'bullet') {
    return base.map((line) => `• ${line}`);
  }
  return base;
}

function analyzeWritingStats(text: string): WritingStats {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const phraseCounts = new Map<string, number>();

  for (let index = 0; index < words.length - 1; index += 1) {
    const phrase = `${words[index].toLowerCase()} ${words[index + 1].toLowerCase()}`;
    phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
  }

  const commonPhrases = Array.from(phraseCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);

  const bulletCount = (text.match(/^\s*[•\-*]/gm) ?? []).length;
  const numberedCount = (text.match(/^\s*\d+\./gm) ?? []).length;

  let preferredStructure: WritingStructure = 'paragraph';
  if (bulletCount >= numberedCount && bulletCount >= 2) {
    preferredStructure = 'bullet';
  } else if (numberedCount > bulletCount && numberedCount >= 2) {
    preferredStructure = 'numbered';
  }

  const formalTokenCount = (text.match(/\b(therefore|furthermore|implement|coordinate)\b/gi) ?? []).length;
  const casualTokenCount = (text.match(/\b(husk|sjekk|quick|bare)\b/gi) ?? []).length;
  const formalityLevel: FormalityLevel = formalTokenCount > casualTokenCount * 1.5 ? 'formal' : casualTokenCount > formalTokenCount ? 'casual' : 'professional';

  return {
    wordsPerMinute: words.length,
    commonPhrases,
    preferredStructure,
    formalityLevel,
  };
}

function extractStructuredFromText(personalNotes: string, clientNotes: string): StructuredNotes {
  const personalLines = personalNotes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const clientLines = clientNotes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const keyPoints = clientLines.slice(0, 6).map((line) => ({ text: line, visibility: 'client' as const }));
  const decisions = clientLines.slice(6, 10).map((line) => ({ text: line, visibility: 'client' as const }));
  const nextSteps = personalLines.slice(0, 6).map((line) => ({ text: line, visibility: 'personal' as const }));
  const personalReminders = personalLines.slice(0, 5);
  const technicalNotes = personalLines.filter((line) => /mix|camera|audio|timeline|render|sync/i.test(line)).slice(0, 8);

  return {
    keyPoints,
    actionItems: nextSteps.slice(0, 4).map((item, index) => ({
      task: item.text,
      assignedTo: 'Owner',
      dueDate: new Date(Date.now() + (index + 1) * 86400000).toISOString().slice(0, 10),
      visibility: 'personal',
    })),
    decisions,
    nextSteps,
    clientRequests: clientLines.slice(0, 5),
    timeline: nextSteps.slice(0, 4).map((item) => ({
      event: item.text,
      date: new Date().toISOString().slice(0, 10),
      notes: 'Derived from notes',
      visibility: 'personal',
    })),
    personalReminders,
    technicalNotes,
  };
}

async function fetchMeetingNotes(meetingId: string): Promise<MeetingNotes> {
  try {
    const first = await apiRequest(`/api/meeting-notes/${meetingId}`);
    return normalizeMeetingNotes(first, meetingId);
  } catch {
    try {
      const second = await apiRequest(`/api/meeting-notes?meetingId=${meetingId}`);
      return normalizeMeetingNotes(second, meetingId);
    } catch {
      return defaultMeetingNotes(meetingId);
    }
  }
}

function TabPanel({ children, value, index }: TabPanelProps): JSX.Element {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null}
    </div>
  );
}

export function SmartMeetingNotesEditor({
  meetingId,
  profession,
  projectId,
  weddingTimelineId,
  onNotesChange,
}: SmartMeetingNotesEditorProps): JSX.Element {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);
  const [personalNotes, setPersonalNotes] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [currentMode, setCurrentMode] = useState<VisibilityMode>('personal');
  const [clientCanView, setClientCanView] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [googleBackupEnabled, setGoogleBackupEnabled] = useState(true);
  const [timelineIntegrationEnabled, setTimelineIntegrationEnabled] = useState(Boolean(weddingTimelineId));
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showWritingAssistant, setShowWritingAssistant] = useState(true);
  const [autoCompleteEnabled, setAutoCompleteEnabled] = useState(true);
  const [writingSuggestions, setWritingSuggestions] = useState<string[]>([]);
  const [writingStats, setWritingStats] = useState<WritingStats>({
    wordsPerMinute: 0,
    commonPhrases: [],
    preferredStructure: 'paragraph',
    formalityLevel: 'professional',
  });
  const [timelineSelection, setTimelineSelection] = useState<TimelineSyncSelection>({
    keyPoints: true,
    actionItems: true,
    decisions: true,
    nextSteps: true,
    clientRequests: true,
    timeline: true,
  });

  const notesQuery = useQuery<MeetingNotes>({
    queryKey: ['meeting-notes', meetingId],
    enabled: meetingId.trim().length > 0,
    queryFn: async () => fetchMeetingNotes(meetingId),
  });

  const structuredDraft = useMemo(() => extractStructuredFromText(personalNotes, clientNotes), [personalNotes, clientNotes]);

  const savePayload = useMemo<MeetingNotesPayload>(
    () => ({
      personalNotes,
      clientVisibleNotes: clientNotes,
      content: personalNotes,
      structuredNotes: structuredDraft,
      visibility: {
        defaultMode: currentMode,
        clientCanView,
        sharedSections: clientCanView ? ['keyPoints', 'decisions', 'nextSteps'] : [],
      },
      googleDriveBackupEnabled: googleBackupEnabled,
      weddingTimelineIntegrationEnabled: timelineIntegrationEnabled,
      tags: notesQuery.data?.tags ?? [],
      attendees: notesQuery.data?.attendees ?? [],
      updatedAt: new Date().toISOString(),
    }),
    [personalNotes, clientNotes, structuredDraft, currentMode, clientCanView, googleBackupEnabled, timelineIntegrationEnabled, notesQuery.data?.tags, notesQuery.data?.attendees]
  );

  const saveMutation = useMutation<unknown, Error, MeetingNotesPayload>({
    mutationFn: async (payload) => {
      try {
        return await apiRequest(`/api/meeting-notes/${meetingId}`, {
          method: 'PUT',
          body: payload,
        });
      } catch {
        return apiRequest('/api/meeting-notes', {
          method: 'POST',
          body: {
            meetingId,
            projectId,
            weddingTimelineId,
            ...payload,
          },
        });
      }
    },
    onSuccess: () => {
      setStatusMessage('Notes saved');
      void queryClient.invalidateQueries({ queryKey: ['meeting-notes', meetingId] });
    },
  });

  const aiMutation = useMutation<MeetingNotesPayload, Error, AiMode>({
    mutationFn: async (mode) => {
      const response = await apiRequest('/api/meeting-notes/ai-process', {
        method: 'POST',
        body: {
          meetingId,
          projectId,
          weddingTimelineId,
          profession,
          mode,
          personalNotes,
          clientVisibleNotes: clientNotes,
          writingStats,
        },
      });

      if (isRecord(response)) {
        const suggestedPersonal = asString(response.personalNotes, personalNotes);
        const suggestedClient = asString(response.clientVisibleNotes, clientNotes);

        return {
          ...savePayload,
          personalNotes: suggestedPersonal,
          clientVisibleNotes: suggestedClient,
          content: suggestedPersonal,
          structuredNotes: toStructuredNotes(response.structuredNotes),
        };
      }

      if (mode === 'summarize') {
        const summary = `${personalNotes}\n\nSummary:\n${personalNotes.slice(0, 500)}`;
        return {
          ...savePayload,
          personalNotes: summary,
          content: summary,
        };
      }

      return savePayload;
    },
    onSuccess: (payload) => {
      setPersonalNotes(payload.personalNotes);
      setClientNotes(payload.clientVisibleNotes);
      setStatusMessage('AI processing complete');
    },
  });

  const backupMutation = useMutation<unknown, Error, void>({
    mutationFn: async () =>
      apiRequest('/api/meeting-notes/google-backup', {
        method: 'POST',
        body: {
          meetingId,
          projectId,
          profession,
          notes: savePayload,
        },
      }),
    onSuccess: () => setStatusMessage('Google Drive backup complete'),
  });

  const timelineMutation = useMutation<unknown, Error, TimelineSyncSelection>({
    mutationFn: async (selection) =>
      apiRequest('/api/wedding-timeline/sync-meeting-notes', {
        method: 'POST',
        body: {
          weddingTimelineId,
          meetingId,
          selection,
          structuredNotes: structuredDraft,
        },
      }),
    onSuccess: () => {
      setStatusMessage('Timeline sync complete');
      setShowTimelineDialog(false);
    },
  });

  const writingAssistMutation = useMutation<WritingAssistResponse, Error, string>({
    mutationFn: async (text) => {
      const fallbackSuggestions = deriveLocalSuggestions(profession, currentMode, writingStats.preferredStructure);
      if (!autoCompleteEnabled || text.trim().length < 12) {
        return {
          suggestions: fallbackSuggestions,
          completion: fallbackSuggestions[0] ?? '',
        };
      }

      try {
        const response = await apiRequest('/api/meeting-notes/writing-assist', {
          method: 'POST',
          body: {
            meetingId,
            profession,
            mode: currentMode,
            text,
            writingStats,
          },
        });

        if (!isRecord(response)) {
          return {
            suggestions: fallbackSuggestions,
            completion: fallbackSuggestions[0] ?? '',
          };
        }

        const serverSuggestions = parseStringArray(response.suggestions);
        const completion = asString(response.completion, serverSuggestions[0] ?? fallbackSuggestions[0] ?? '');

        return {
          suggestions: serverSuggestions.length > 0 ? serverSuggestions : fallbackSuggestions,
          completion,
        };
      } catch {
        return {
          suggestions: fallbackSuggestions,
          completion: fallbackSuggestions[0] ?? '',
        };
      }
    },
    onSuccess: (data) => {
      setWritingSuggestions(data.suggestions);
      if (data.completion.length > 0 && !data.suggestions.includes(data.completion)) {
        setWritingSuggestions((previous) => [data.completion, ...previous].slice(0, 8));
      }
    },
  });

  useEffect(() => {
    if (!notesQuery.data) {
      return;
    }

    setPersonalNotes(notesQuery.data.personalNotes || notesQuery.data.content);
    setClientNotes(notesQuery.data.clientVisibleNotes);
    setCurrentMode(notesQuery.data.visibility.defaultMode);
    setClientCanView(notesQuery.data.visibility.clientCanView);
    setGoogleBackupEnabled(notesQuery.data.googleDriveBackup.enabled || googleBackupEnabled);
    setTimelineIntegrationEnabled(notesQuery.data.weddingTimelineIntegration.enabled || Boolean(weddingTimelineId));
  }, [notesQuery.data, weddingTimelineId]);

  useEffect(() => {
    setWritingStats(analyzeWritingStats(currentMode === 'personal' ? personalNotes : clientNotes));
  }, [personalNotes, clientNotes, currentMode]);

  useEffect(() => {
    if (!showWritingAssistant) {
      return;
    }

    const sourceText = currentMode === 'personal' ? personalNotes : clientNotes;
    if (sourceText.trim().length < 10) {
      setWritingSuggestions(deriveLocalSuggestions(profession, currentMode, writingStats.preferredStructure));
      return;
    }

    const timer = window.setTimeout(() => {
      writingAssistMutation.mutate(sourceText);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [personalNotes, clientNotes, currentMode, profession, showWritingAssistant, writingStats.preferredStructure]);

  useEffect(() => {
    if (!autoSaveEnabled) {
      return;
    }

    if (!personalNotes.trim() && !clientNotes.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveMutation.mutate(savePayload);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, personalNotes, clientNotes, savePayload]);

  useEffect(() => {
    if (onNotesChange) {
      onNotesChange(savePayload);
    }
  }, [onNotesChange, savePayload]);

  const isBusy = notesQuery.isLoading;

  const applySuggestion = (suggestion: string) => {
    if (currentMode === 'personal') {
      setPersonalNotes((previous) => `${previous.trim()}${previous.trim().length > 0 ? '\n' : ''}${suggestion}`);
    } else {
      setClientNotes((previous) => `${previous.trim()}${previous.trim().length > 0 ? '\n' : ''}${suggestion}`);
    }
  };

  const handleManualSave = () => {
    saveMutation.mutate(savePayload);
  };

  const handleAiProcess = (mode: AiMode) => {
    aiMutation.mutate(mode);
  };

  const handleBackup = () => {
    if (!googleBackupEnabled) {
      setStatusMessage('Enable Google backup toggle first');
      return;
    }
    backupMutation.mutate();
  };

  const handleTimelineSync = () => {
    if (!timelineIntegrationEnabled || !weddingTimelineId) {
      setStatusMessage('Enable timeline integration to sync');
      return;
    }
    timelineMutation.mutate(timelineSelection);
  };

  return (
    <Card>
      <CardHeader
        title="Smart Meeting Notes"
        subheader="Split personal/client notes with AI support, autosave, backup, and timeline sync"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="primary" onClick={handleManualSave} disabled={saveMutation.isPending} aria-label="Save notes">
              <Save />
            </IconButton>
            <IconButton
              color="primary"
              onClick={() => handleAiProcess('full')}
              disabled={aiMutation.isPending || (!personalNotes.trim() && !clientNotes.trim())}
              aria-label="AI process notes"
            >
              <AutoFixHigh />
            </IconButton>
            <IconButton color="primary" onClick={handleBackup} disabled={backupMutation.isPending} aria-label="Backup to Google Drive">
              <CloudSync />
            </IconButton>
            {weddingTimelineId ? (
              <IconButton color="primary" onClick={() => setShowTimelineDialog(true)} aria-label="Open timeline sync">
                <Timeline />
              </IconButton>
            ) : null}
          </Box>
        }
      />

      <CardContent>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={autoSaveEnabled} onChange={(event) => setAutoSaveEnabled(event.target.checked)} />}
              label="Auto save"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={googleBackupEnabled} onChange={(event) => setGoogleBackupEnabled(event.target.checked)} />}
              label="Google backup"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={timelineIntegrationEnabled} onChange={(event) => setTimelineIntegrationEnabled(event.target.checked)} />}
              label="Timeline integration"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={showWritingAssistant} onChange={(event) => setShowWritingAssistant(event.target.checked)} />}
              label="Writing assistant"
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip size="small" icon={<Assignment />} label={`Mode: ${currentMode}`} color={currentMode === 'personal' ? 'primary' : 'secondary'} />
          <Chip size="small" icon={<Event />} label={`Words/min: ${writingStats.wordsPerMinute}`} variant="outlined" />
          <Chip size="small" icon={<SmartToy />} label={`Style: ${writingStats.formalityLevel}`} variant="outlined" />
          {statusMessage ? <Chip size="small" label={statusMessage} color="success" /> : null}
        </Box>

        {isBusy ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 3 }}>
            <CircularProgress size={22} />
            <Typography>Loading notes...</Typography>
          </Box>
        ) : null}

        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label="Personal" />
          <Tab label="Client" />
          <Tab label="Structured" />
          <Tab label="Assistant" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <TextField
            label="Personal Notes"
            value={personalNotes}
            onChange={(event) => {
              setCurrentMode('personal');
              setPersonalNotes(event.target.value);
            }}
            multiline
            minRows={12}
            fullWidth
            placeholder="Internal technical notes, reminders, and production details"
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button onClick={() => handleAiProcess('full')} disabled={aiMutation.isPending}>
              AI Enhance
            </Button>
            <Button onClick={() => handleAiProcess('summarize')} disabled={aiMutation.isPending || personalNotes.trim().length < 40}>
              Summarize
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <TextField
            label="Client Visible Notes"
            value={clientNotes}
            onChange={(event) => {
              setCurrentMode('client');
              setClientNotes(event.target.value);
            }}
            multiline
            minRows={12}
            fullWidth
            placeholder="Clean summary intended for client communication"
          />
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={<Switch checked={clientCanView} onChange={(event) => setClientCanView(event.target.checked)} />}
              label="Client can view this note stream"
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Key Points
              </Typography>
              <List dense>
                {structuredDraft.keyPoints.slice(0, 8).map((item, index) => (
                  <ListItem key={`${item.text}-${index}`}>
                    <ListItemText primary={item.text} secondary={item.visibility} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Action Items
              </Typography>
              <List dense>
                {structuredDraft.actionItems.slice(0, 8).map((item, index) => (
                  <ListItem key={`${item.task}-${index}`}>
                    <ListItemText primary={item.task} secondary={`${item.assignedTo} • ${item.dueDate || 'No date'}`} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Client requests: {structuredDraft.clientRequests.length} • Timeline entries: {structuredDraft.timeline.length}
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <FormControlLabel
              control={<Switch checked={autoCompleteEnabled} onChange={(event) => setAutoCompleteEnabled(event.target.checked)} />}
              label="Auto completion"
            />

            {writingAssistMutation.isPending ? <Typography variant="body2">Generating suggestions...</Typography> : null}

            {writingStats.commonPhrases.length > 0 ? (
              <Alert severity="info">Common phrases: {writingStats.commonPhrases.join(', ')}</Alert>
            ) : null}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {writingSuggestions.slice(0, 8).map((suggestion) => (
                <Chip key={suggestion} label={suggestion} onClick={() => applySuggestion(suggestion)} clickable />
              ))}
            </Box>
          </Box>
        </TabPanel>

        {saveMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Failed to save notes.</Alert> : null}
        {aiMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>AI processing failed.</Alert> : null}
        {backupMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Google backup failed.</Alert> : null}
        {timelineMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Timeline sync failed.</Alert> : null}
      </CardContent>

      <Dialog open={showTimelineDialog} onClose={() => setShowTimelineDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sync Notes to Wedding Timeline</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select sections to push into timeline planning.
          </Typography>

          <TextField
            select
            label="Default sync mode"
            value={currentMode}
            onChange={(event) => setCurrentMode(event.target.value === 'client' ? 'client' : 'personal')}
            fullWidth
            sx={{ mb: 2 }}
          >
            <MenuItem value="personal">Personal</MenuItem>
            <MenuItem value="client">Client</MenuItem>
          </TextField>

          <Grid container spacing={1}>
            {Object.entries(timelineSelection).map(([section, checked]) => (
              <Grid item xs={12} sm={6} key={section}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={checked}
                      onChange={(event) =>
                        setTimelineSelection((previous) => ({
                          ...previous,
                          [section]: event.target.checked,
                        }))
                      }
                    />
                  }
                  label={section}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTimelineDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTimelineSync} disabled={timelineMutation.isPending}>
            Sync
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default SmartMeetingNotesEditor;
