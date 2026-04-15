// @ts-nocheck
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
import NotebookLmWorkspaceCard from '@/components/meetings/NotebookLmWorkspaceCard';
import { notebookLmWorkspaceService } from '@/services/notebookLmWorkspaceService';

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
  meetingTitle?: string;
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

interface MeetingProjectContext {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  description: string;
  location?: string;
  eventDate?: string;
  briefSummary?: string;
  inquirySummary?: string;
  specialRequests?: string;
  inquiryLocation?: string;
  inquiryEventDate?: string;
  inquiryTimeframe?: string;
}

interface TimelineContext {
  id: string;
  title: string;
  weddingDate?: string;
  venue?: string;
  coupleName?: string;
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

type WritingAssistState = Record<VisibilityMode, string[]>;
type InlineCompletionState = Record<VisibilityMode, string>;

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

function parseMeetingProjectContext(raw: unknown): MeetingProjectContext | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = asString(raw.id).trim();
  const title = asString(raw.title || raw.name).trim();
  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    clientName: asString(raw.clientName).trim(),
    clientEmail: asString(raw.clientEmail).trim() || undefined,
    description: asString(raw.description).trim(),
    location: asString(raw.location).trim() || undefined,
    eventDate: asString(raw.eventDate).trim() || undefined,
    briefSummary: asString(raw.briefSummary).trim() || undefined,
    inquirySummary: asString(raw.inquirySummary).trim() || undefined,
    specialRequests: asString(raw.specialRequests).trim() || undefined,
    inquiryLocation: asString(raw.inquiryLocation).trim() || undefined,
    inquiryEventDate: asString(raw.inquiryEventDate).trim() || undefined,
    inquiryTimeframe: asString(raw.inquiryTimeframe).trim() || undefined,
  };
}

function parseTimelineContext(raw: unknown): TimelineContext | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = asString(raw.id).trim();
  if (!id) {
    return null;
  }

  return {
    id,
    title: asString(raw.title).trim() || 'Evendi-tidslinje',
    weddingDate: asString(raw.weddingDate).trim() || undefined,
    venue: asString(raw.venue).trim() || undefined,
    coupleName: asString(raw.coupleName).trim() || undefined,
  };
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
    meetingTitle: 'Møtenotat',
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
    meetingTitle: asString(raw.meetingTitle) || undefined,
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

interface LocalSuggestionContext {
  projectTitle?: string;
  clientName?: string;
  meetingTitle?: string;
  projectDescription?: string;
  inquirySummary?: string;
  specialRequests?: string;
  location?: string;
  eventDate?: string;
  inquiryTimeframe?: string;
}

function firstContextValue(...values: Array<string | undefined>): string {
  return values.map((value) => value?.trim() || '').find(Boolean) || '';
}

function truncateContextSnippet(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function resolveMeetingBrief(context: LocalSuggestionContext): string {
  return firstContextValue(
    context.specialRequests,
    context.inquirySummary,
    context.projectDescription,
  );
}

function inferMeetingFocus(brief: string, profession: Profession): string {
  const lowerBrief = brief.toLowerCase();

  if (/bryllup|vielse|forlovelse|first look|seremoni/u.test(lowerBrief)) {
    return 'vielse, portretter og familieøyeblikk';
  }
  if (/dokumentar|naturlig|autentisk/u.test(lowerBrief)) {
    return 'det dokumentariske uttrykket kunden har bedt om';
  }
  if (/drone|highlight|teaser|film/u.test(lowerBrief)) {
    return 'opptaksplan, leveranseformat og kritiske shots';
  }
  if (/branding|portrett|bedrift|profil/u.test(lowerBrief)) {
    return profession === 'photographer'
      ? 'portrettstil, locations og ønskede motiv'
      : 'budskap, scener og leveranseformat';
  }
  if (/barn|familie|gruppe|gjester/u.test(lowerBrief)) {
    return 'familiekonstellasjoner, gruppebilder og logistikk';
  }

  if (profession === 'photographer') return 'lys, lokasjon og motivprioriteringer';
  if (profession === 'videographer') return 'opptaksrekkefølge og leveranser';
  if (profession === 'music_producer') return 'arrangement, leveranser og revisjoner';
  if (profession === 'vendor') return 'leveranser, logistikk og oppfølging';
  return 'beslutninger, ansvar og neste steg';
}

function deriveLocalSuggestions(
  profession: Profession,
  mode: VisibilityMode,
  structure: WritingStructure,
  context: LocalSuggestionContext,
): string[] {
  const projectLabel = firstContextValue(context.projectTitle, context.clientName, 'prosjektet');
  const brief = resolveMeetingBrief(context);
  const briefSnippet = brief ? truncateContextSnippet(brief) : '';
  const focus = inferMeetingFocus(brief, profession);
  const location = firstContextValue(context.location);
  const meetingTitle = firstContextValue(context.meetingTitle);
  const eventDate = firstContextValue(context.eventDate);
  const timeframe = firstContextValue(context.inquiryTimeframe);

  const suggestions = [
    mode === 'client'
      ? `Oppsummer tydelig hva kunden skal sitte igjen med etter møtet for ${projectLabel}.`
      : `Legg inn et konkret neste steg med ansvar og tidspunkt for ${projectLabel}.`,
    briefSnippet
      ? mode === 'client'
        ? `Bekreft at notatet svarer på forespørselen: ${briefSnippet}`
        : `Bryt forespørselen ned i beslutninger og avklaringer: ${briefSnippet}`
      : mode === 'client'
        ? `Få tydelig fram hva kunden faktisk har bedt om i ${projectLabel}.`
        : `Skriv eksplisitt hva teamet må følge opp etter denne gjennomgangen.`,
    `Bruk notatet til å avklare ${focus}.`,
    location
      ? `Ta med logistikk, tidsbuffer og nøkkelpunkter rundt ${location}.`
      : 'Legg inn lokasjon, tidsbuffer og praktiske rammer hvis de er avklart.',
    meetingTitle
      ? `Koble notatet tydelig til målet for "${meetingTitle}".`
      : 'Gi møtet en tydelig retning med oppsummering, beslutninger og neste steg.',
    eventDate || timeframe
      ? `Fang opp dato, frist eller tidsvindu${eventDate ? ` rundt ${eventDate}` : ''}${timeframe ? ` (${timeframe})` : ''}.`
      : 'Skriv tidspunkt eller frist som eget punkt, så det er lett å finne igjen.',
    structure === 'bullet'
      ? 'Hold hvert punkt kort og handlingsorientert.'
      : 'Del notatet i korte avsnitt for oppsummering, beslutninger og neste steg.',
  ];

  const formatted = suggestions.slice(0, 6).map((line, index) => {
    if (structure === 'numbered') {
      return `${index + 1}. ${line}`;
    }
    if (structure === 'bullet') {
      return `• ${line}`;
    }
    return line;
  });

  return Array.from(new Set(formatted));
}

function createInitialWritingAssistState(): WritingAssistState {
  return {
    personal: [],
    client: [],
  };
}

function createInitialInlineCompletionState(): InlineCompletionState {
  return {
    personal: '',
    client: '',
  };
}

function buildInlineCompletionSuffix(text: string, completion: string): string {
  const source = text.replace(/\s+$/u, '');
  const suggestion = completion.trim();

  if (!source || !suggestion) {
    return '';
  }

  const sourceLower = source.toLowerCase();
  const suggestionLower = suggestion.toLowerCase();
  if (suggestionLower.startsWith(sourceLower)) {
    return completion.slice(source.length);
  }

  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || '';
  const lastLineLower = lastLine.toLowerCase();
  if (lastLineLower && suggestionLower.startsWith(lastLineLower)) {
    return suggestion.slice(lastLine.length);
  }

  return source.endsWith('\n') || source.endsWith(' ') ? suggestion : ` ${suggestion}`;
}

function appendInlineCompletionText(text: string, completionSuffix: string): string {
  if (!completionSuffix.trim()) {
    return text;
  }

  if (!text) {
    return completionSuffix.trimStart();
  }

  return `${text}${completionSuffix}`;
}

function previewInlineCompletion(completionSuffix: string, maxLength = 120): string {
  const normalized = completionSuffix.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
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
  const [writingSuggestions, setWritingSuggestions] = useState<WritingAssistState>(createInitialWritingAssistState);
  const [inlineCompletions, setInlineCompletions] = useState<InlineCompletionState>(createInitialInlineCompletionState);
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

  const resolvedProjectId = useMemo(() => {
    const rawProjectId = [projectId, notesQuery.data?.projectId]
      .map((value) => value?.trim() || '')
      .find(Boolean);
    return rawProjectId || undefined;
  }, [projectId, notesQuery.data?.projectId]);

  const projectQuery = useQuery<MeetingProjectContext | null>({
    queryKey: ['meeting-notes-project-context', resolvedProjectId],
    enabled: Boolean(resolvedProjectId),
    queryFn: async () => {
      if (!resolvedProjectId) {
        return null;
      }

      const response = await apiRequest(`/api/projects/${resolvedProjectId}`);
      return parseMeetingProjectContext(response);
    },
  });

  const localSuggestionContext = useMemo<LocalSuggestionContext>(
    () => ({
      projectTitle: projectQuery.data?.title,
      clientName: projectQuery.data?.clientName,
      meetingTitle: notesQuery.data?.meetingTitle,
      projectDescription: projectQuery.data?.description,
      inquirySummary: projectQuery.data?.inquirySummary,
      specialRequests: projectQuery.data?.specialRequests,
      location: projectQuery.data?.inquiryLocation || projectQuery.data?.location,
      eventDate: projectQuery.data?.inquiryEventDate || projectQuery.data?.eventDate,
      inquiryTimeframe: projectQuery.data?.inquiryTimeframe,
    }),
    [
      notesQuery.data?.meetingTitle,
      projectQuery.data?.title,
      projectQuery.data?.clientName,
      projectQuery.data?.description,
      projectQuery.data?.inquirySummary,
      projectQuery.data?.specialRequests,
      projectQuery.data?.inquiryLocation,
      projectQuery.data?.location,
      projectQuery.data?.inquiryEventDate,
      projectQuery.data?.eventDate,
      projectQuery.data?.inquiryTimeframe,
    ],
  );

  const projectBrief = useMemo(
    () => resolveMeetingBrief(localSuggestionContext),
    [localSuggestionContext],
  );

  const timelineQuery = useQuery<TimelineContext | null>({
    queryKey: ['evendi-timeline-context', weddingTimelineId || resolvedProjectId || 'none'],
    enabled: Boolean(weddingTimelineId || resolvedProjectId),
    queryFn: async () => {
      const endpoint = weddingTimelineId
        ? `/api/wedding-timeline/timelines/${weddingTimelineId}`
        : resolvedProjectId
          ? `/api/wedding/timeline/project/${resolvedProjectId}`
          : null;

      if (!endpoint) {
        return null;
      }

      try {
        const response = await apiRequest(endpoint);
        return parseTimelineContext(response);
      } catch {
        return null;
      }
    },
  });

  const resolvedTimelineId = useMemo(
    () => {
      const candidate = [weddingTimelineId, timelineQuery.data?.id]
        .map((value) => value?.trim() || '')
        .find(Boolean);
      return candidate || undefined;
    },
    [timelineQuery.data?.id, weddingTimelineId],
  );

  const notebookWorkspaceScope = useMemo(
    () => ({
      meetingId,
      projectId: resolvedProjectId,
      profession,
      latestMeetingTitle: notesQuery.data?.meetingTitle,
    }),
    [meetingId, resolvedProjectId, profession, notesQuery.data?.meetingTitle],
  );

  const notebookWorkspaceQuery = useQuery({
    queryKey: ['notebooklm-workspace', 'smart-editor', notebookWorkspaceScope],
    queryFn: () => notebookLmWorkspaceService.getStatus(notebookWorkspaceScope),
    enabled: meetingId.trim().length > 0 || Boolean(resolvedProjectId),
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
            projectId: resolvedProjectId,
            weddingTimelineId,
            ...payload,
          },
        });
      }
    },
    onSuccess: () => {
      setStatusMessage('Notater lagret');
      void queryClient.invalidateQueries({ queryKey: ['meeting-notes', meetingId] });
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
    },
  });

  const aiMutation = useMutation<MeetingNotesPayload, Error, AiMode>({
    mutationFn: async (mode) => {
      const response = await apiRequest('/api/meeting-notes/ai-process', {
        method: 'POST',
        body: {
          meetingId,
          projectId: resolvedProjectId,
          weddingTimelineId,
          profession,
          mode,
          meetingTitle: notesQuery.data?.meetingTitle,
          projectTitle: projectQuery.data?.title,
          clientName: projectQuery.data?.clientName,
          projectBrief,
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
        const summary = `${personalNotes}\n\nOppsummering:\n${personalNotes.slice(0, 500)}`;
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
      setStatusMessage('AI-behandling fullført');
    },
    onError: (error) => {
      setStatusMessage(error.message || 'AI-forbedring feilet');
    },
  });

  const backupMutation = useMutation<unknown, Error, void>({
    mutationFn: async () =>
      apiRequest('/api/meeting-notes/google-backup', {
        method: 'POST',
        body: {
          meetingId,
          projectId: resolvedProjectId,
          profession,
          notes: savePayload,
        },
      }),
    onSuccess: () => {
      setStatusMessage('Google Drive-backup fullført');
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
    },
  });

  const timelineMutation = useMutation<unknown, Error, TimelineSyncSelection>({
    mutationFn: async (selection) =>
      apiRequest('/api/wedding-timeline/sync-meeting-notes', {
        method: 'POST',
        body: {
          weddingTimelineId: resolvedTimelineId,
          meetingId,
          meetingTitle: notesQuery.data?.meetingTitle,
          meetingDate: notesQuery.data?.meetingDate,
          projectId: resolvedProjectId,
          baseMode: currentMode,
          selection,
          structuredNotes: structuredDraft,
          projectContext: {
            projectTitle: projectQuery.data?.title,
            clientName: projectQuery.data?.clientName,
            clientEmail: projectQuery.data?.clientEmail,
            briefSummary: projectQuery.data?.briefSummary,
            inquirySummary: projectQuery.data?.inquirySummary,
            specialRequests: projectQuery.data?.specialRequests,
            location: projectQuery.data?.inquiryLocation || projectQuery.data?.location,
            eventDate: projectQuery.data?.inquiryEventDate || projectQuery.data?.eventDate,
            inquiryTimeframe: projectQuery.data?.inquiryTimeframe,
            timelineTitle: timelineQuery.data?.title,
            timelineVenue: timelineQuery.data?.venue,
            coupleName: timelineQuery.data?.coupleName,
          },
        },
      }),
    onSuccess: () => {
      setStatusMessage('Evendi-synk fullført');
      setShowTimelineDialog(false);
      void queryClient.invalidateQueries({ queryKey: ['evendi-timeline-context'] });
      void queryClient.invalidateQueries({ queryKey: ['meeting-notes', meetingId] });
    },
  });

  const writingAssistMutation = useMutation<WritingAssistResponse, Error, { text: string; mode: VisibilityMode }>({
    mutationFn: async ({ text, mode }) => {
      const fallbackSuggestions = deriveLocalSuggestions(
        profession,
        mode,
        writingStats.preferredStructure,
        localSuggestionContext,
      );
      if (!autoCompleteEnabled || text.trim().length < (projectBrief ? 4 : 12)) {
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
            projectId: resolvedProjectId,
            profession,
            mode,
            text,
            meetingTitle: notesQuery.data?.meetingTitle,
            projectTitle: projectQuery.data?.title,
            clientName: projectQuery.data?.clientName,
            projectBrief,
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
    onSuccess: (data, variables) => {
      const mergedSuggestions = data.completion.length > 0 && !data.suggestions.includes(data.completion)
        ? [data.completion, ...data.suggestions]
        : data.suggestions;
      setWritingSuggestions((previous) => ({
        ...previous,
        [variables.mode]: mergedSuggestions.slice(0, 8),
      }));
      setInlineCompletions((previous) => ({
        ...previous,
        [variables.mode]: buildInlineCompletionSuffix(variables.text, data.completion),
      }));
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
    setTimelineIntegrationEnabled(
      notesQuery.data.weddingTimelineIntegration.enabled || Boolean(resolvedTimelineId),
    );
  }, [notesQuery.data, resolvedTimelineId]);

  useEffect(() => {
    setWritingStats(analyzeWritingStats(currentMode === 'personal' ? personalNotes : clientNotes));
  }, [personalNotes, clientNotes, currentMode]);

  useEffect(() => {
    if (!showWritingAssistant) {
      return;
    }

    const sourceText = currentMode === 'personal' ? personalNotes : clientNotes;
    if (sourceText.trim().length < 10) {
      setWritingSuggestions((previous) => ({
        ...previous,
        [currentMode]: deriveLocalSuggestions(
          profession,
          currentMode,
          writingStats.preferredStructure,
          localSuggestionContext,
        ),
      }));
      setInlineCompletions((previous) => ({
        ...previous,
        [currentMode]: '',
      }));
      return;
    }

    const timer = window.setTimeout(() => {
      writingAssistMutation.mutate({ text: sourceText, mode: currentMode });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    personalNotes,
    clientNotes,
    currentMode,
    profession,
    projectBrief,
    showWritingAssistant,
    writingStats.preferredStructure,
    localSuggestionContext,
  ]);

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
  const activeSuggestions = writingSuggestions[currentMode] || [];
  const activeInlineCompletion = inlineCompletions[currentMode] || '';

  const applySuggestion = (suggestion: string, mode: VisibilityMode = currentMode) => {
    if (mode === 'personal') {
      setPersonalNotes((previous) => `${previous.trim()}${previous.trim().length > 0 ? '\n' : ''}${suggestion}`);
    } else {
      setClientNotes((previous) => `${previous.trim()}${previous.trim().length > 0 ? '\n' : ''}${suggestion}`);
    }
    setCurrentMode(mode);
  };

  const applyInlineCompletion = (mode: VisibilityMode) => {
    const completionSuffix = inlineCompletions[mode];
    if (!completionSuffix.trim()) {
      return;
    }

    if (mode === 'personal') {
      setPersonalNotes((previous) => appendInlineCompletionText(previous, completionSuffix));
    } else {
      setClientNotes((previous) => appendInlineCompletionText(previous, completionSuffix));
    }

    setInlineCompletions((previous) => ({
      ...previous,
      [mode]: '',
    }));
    setCurrentMode(mode);
  };

  const clearInlineCompletion = (mode: VisibilityMode) => {
    setInlineCompletions((previous) => ({
      ...previous,
      [mode]: '',
    }));
  };

  const handleEditorKeyDown = (mode: VisibilityMode, event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab' && !event.shiftKey && inlineCompletions[mode]?.trim()) {
      event.preventDefault();
      applyInlineCompletion(mode);
      return;
    }

    if (event.key === 'Escape' && inlineCompletions[mode]?.trim()) {
      event.preventDefault();
      clearInlineCompletion(mode);
    }
  };

  const renderInlineAssist = (mode: VisibilityMode) => {
    if (!showWritingAssistant) {
      return null;
    }

    const completion = inlineCompletions[mode];
    const suggestions = writingSuggestions[mode] || [];
    const preview = previewInlineCompletion(completion);

    return (
      <Box
        sx={{
          mt: 1.25,
          p: 1.5,
          borderRadius: 2,
          border: '1px solid rgba(139, 107, 63, 0.16)',
          bgcolor: 'rgba(250, 246, 238, 0.96)',
          display: 'grid',
          gap: 1,
        }}
      >
        {autoCompleteEnabled && preview ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Chip size="small" label="Tab" color="warning" variant="outlined" />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#5f471f' }}>
              Inline forslag
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 220 }}>
              {preview}
            </Typography>
            <Button size="small" variant="text" onClick={() => applyInlineCompletion(mode)}>
              Bruk forslag
            </Button>
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {suggestions.slice(0, 4).map((suggestion) => (
            <Chip
              key={`${mode}-${suggestion}`}
              label={suggestion}
              onClick={() => applySuggestion(suggestion, mode)}
              clickable
              variant="outlined"
              size="small"
              sx={{ maxWidth: '100%' }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  const handleManualSave = () => {
    saveMutation.mutate(savePayload);
  };

  const handleAiProcess = (mode: AiMode) => {
    aiMutation.mutate(mode);
  };

  const handleBackup = () => {
    if (!googleBackupEnabled) {
      setStatusMessage('Aktiver Google Drive-backup først');
      return;
    }
    backupMutation.mutate();
  };

  const handleTimelineSync = () => {
    if (!timelineIntegrationEnabled || !resolvedTimelineId) {
      setStatusMessage('Aktiver Evendi-integrasjon og velg prosjekt med tidslinje først');
      return;
    }
    timelineMutation.mutate(timelineSelection);
  };

  const notebookWorkspaceSyncMutation = useMutation({
    mutationFn: () => notebookLmWorkspaceService.sync(notebookWorkspaceScope),
    onSuccess: () => {
      setStatusMessage('NotebookLM workspace synket');
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
      void queryClient.invalidateQueries({ queryKey: ['meeting-notes', meetingId] });
    },
  });

  return (
    <Card>
      <CardHeader
        title="Smart møteeditor"
        subheader="Personlige og klientvendte notater med AI-støtte, autolagring, Drive-backup og Evendi-synk"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="primary" onClick={handleManualSave} disabled={saveMutation.isPending} aria-label="Lagre notater">
              <Save />
            </IconButton>
            <IconButton
              color="primary"
              onClick={() => handleAiProcess('full')}
              disabled={aiMutation.isPending || (!personalNotes.trim() && !clientNotes.trim())}
              aria-label="AI-behandle notater"
            >
              <AutoFixHigh />
            </IconButton>
            <IconButton color="primary" onClick={handleBackup} disabled={backupMutation.isPending} aria-label="Ta backup til Google Drive">
              <CloudSync />
            </IconButton>
            {resolvedTimelineId ? (
              <IconButton color="primary" onClick={() => setShowTimelineDialog(true)} aria-label="Åpne tidslinjesynk">
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
              label="Autolagring"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={googleBackupEnabled} onChange={(event) => setGoogleBackupEnabled(event.target.checked)} />}
              label="Google Drive-backup"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={timelineIntegrationEnabled} onChange={(event) => setTimelineIntegrationEnabled(event.target.checked)} />}
              label="Evendi-integrasjon"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={<Switch checked={showWritingAssistant} onChange={(event) => setShowWritingAssistant(event.target.checked)} />}
              label="Skriveassistent"
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip size="small" icon={<Assignment />} label={`Visning: ${currentMode === 'client' ? 'klient' : 'personlig'}`} color={currentMode === 'personal' ? 'primary' : 'secondary'} />
          <Chip size="small" icon={<Event />} label={`Ord/min: ${writingStats.wordsPerMinute}`} variant="outlined" />
          <Chip size="small" icon={<SmartToy />} label={`Stil: ${writingStats.formalityLevel}`} variant="outlined" />
          {statusMessage ? <Chip size="small" label={statusMessage} color="success" /> : null}
        </Box>

        {projectQuery.data ? (
          <Box
            sx={{
              mb: 2,
              p: 2.25,
              borderRadius: 3,
              border: '1px solid rgba(245, 158, 11, 0.18)',
              bgcolor: 'rgba(255, 249, 237, 0.95)',
            }}
          >
            <Typography variant="overline" sx={{ color: 'warning.dark', fontWeight: 700, letterSpacing: 1.1 }}>
              Aktivt prosjekt
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700 }}>
              {projectQuery.data.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {[
                projectQuery.data.clientName || null,
                projectQuery.data.inquiryLocation || projectQuery.data.location || null,
                projectQuery.data.inquiryEventDate || projectQuery.data.eventDate || null,
              ]
                .filter(Boolean)
                .join(' • ') || 'Prosjektkobling aktiv'}
            </Typography>
            {projectBrief ? (
              <Typography variant="body2" sx={{ mt: 1.25, color: 'text.primary' }}>
                {truncateContextSnippet(projectBrief, 220)}
              </Typography>
            ) : null}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              <Chip size="small" color="warning" variant="filled" label="NotebookLM-kilde aktiv" />
              {projectQuery.data.clientName ? (
                <Chip size="small" variant="outlined" label={`Kunde: ${projectQuery.data.clientName}`} />
              ) : null}
              {projectQuery.data.inquiryTimeframe ? (
                <Chip size="small" variant="outlined" label={`Tidsrom: ${projectQuery.data.inquiryTimeframe}`} />
              ) : null}
            </Box>
          </Box>
        ) : null}

        <Box
          sx={{
            mb: 2,
            p: 2.25,
            borderRadius: 3,
            border: '1px solid rgba(16, 185, 129, 0.16)',
            bgcolor: timelineIntegrationEnabled
              ? 'rgba(236, 253, 245, 0.96)'
              : 'rgba(248, 250, 252, 0.96)',
          }}
        >
          <Typography variant="overline" sx={{ color: timelineIntegrationEnabled ? 'success.dark' : 'text.secondary', fontWeight: 700, letterSpacing: 1.1 }}>
            Evendi-integrasjon
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 0.3, fontWeight: 700 }}>
            {resolvedTimelineId
              ? `${timelineQuery.data?.title || 'Evendi-tidslinje'} er klar for møtesynk`
              : 'Ingen Evendi-tidslinje koblet ennå'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65 }}>
            {resolvedTimelineId
              ? 'Når du synker herfra, sendes møtenotat, brief, klientønsker og neste steg inn i Evendi-konteksten for prosjektet.'
              : 'Velg eller opprett et prosjekt med Evendi-tidslinje først. Da kan møtenotatet gi Evendi den samme prosjekt- og forespørselskonteksten.'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
            <Chip
              size="small"
              color={resolvedTimelineId ? 'success' : 'default'}
              variant={resolvedTimelineId ? 'filled' : 'outlined'}
              label={resolvedTimelineId ? 'Evendi koblet' : 'Ingen Evendi-tidslinje'}
            />
            {timelineQuery.data?.venue ? (
              <Chip size="small" variant="outlined" label={`Venue: ${timelineQuery.data.venue}`} />
            ) : null}
            {projectBrief ? (
              <Chip size="small" variant="outlined" label={`Brief aktiv: ${truncateContextSnippet(projectBrief, 44)}`} />
            ) : null}
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <NotebookLmWorkspaceCard
            status={notebookWorkspaceQuery.data}
            loading={notebookWorkspaceQuery.isLoading}
            syncing={notebookWorkspaceSyncMutation.isPending}
            profession={profession}
            onSync={() => {
              notebookWorkspaceSyncMutation.mutate();
            }}
          />
        </Box>

        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: resolvedProjectId ? 'rgba(245, 158, 11, 0.28)' : 'rgba(59, 130, 246, 0.22)',
            bgcolor: resolvedProjectId ? 'rgba(255, 247, 237, 0.92)' : 'rgba(239, 246, 255, 0.92)',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            {resolvedProjectId
              ? `Dette notatet er koblet til ${projectQuery.data?.title || 'prosjektets'} NotebookLM-workspace`
              : 'Dette notatet er foreløpig internt'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {resolvedProjectId
              ? 'Fordi møtet er koblet til et prosjekt, blir notatet lagret som møtenotat, kan synkes til Google Drive og brukes som kilde i prosjektets NotebookLM-workspace.'
              : 'Dette notatet kan fortsatt lagres og sikkerhetskopieres, men NotebookLM-workspace bygges først når notatet er koblet til et prosjekt eller en klient.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
            <Chip
              size="small"
              color={resolvedProjectId ? 'warning' : 'primary'}
              variant={resolvedProjectId ? 'filled' : 'outlined'}
              label={resolvedProjectId ? 'Synk: Google Drive + NotebookLM' : 'Synk: internt notat'}
            />
            {projectQuery.data?.title ? (
              <Chip size="small" variant="outlined" label={`Prosjekt: ${projectQuery.data.title}`} />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={clientCanView ? 'Klientsynlighet: på' : 'Klientsynlighet: av'}
            />
            <Chip
              size="small"
              variant="outlined"
              label={currentMode === 'client' ? 'Du skriver klientnotater' : 'Du skriver personlige notater'}
            />
          </Box>
        </Box>

        {isBusy ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 3 }}>
            <CircularProgress size={22} />
            <Typography>Laster notater...</Typography>
          </Box>
        ) : null}

        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label="Personlig" />
          <Tab label="Klient" />
          <Tab label="Struktur" />
          <Tab label="Assistent" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <TextField
            label="Personlige notater"
            value={personalNotes}
            onChange={(event) => {
              setCurrentMode('personal');
              setPersonalNotes(event.target.value);
              clearInlineCompletion('personal');
            }}
            onFocus={() => setCurrentMode('personal')}
            onKeyDown={(event) => handleEditorKeyDown('personal', event)}
            multiline
            minRows={12}
            fullWidth
            placeholder="Interne tekniske notater, påminnelser og produksjonsdetaljer"
          />
          {renderInlineAssist('personal')}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button onClick={() => handleAiProcess('full')} disabled={aiMutation.isPending}>
              AI-forbedre
            </Button>
            <Button onClick={() => handleAiProcess('summarize')} disabled={aiMutation.isPending || personalNotes.trim().length < 40}>
              Oppsummer
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <TextField
            label="Klientsynlige notater"
            value={clientNotes}
            onChange={(event) => {
              setCurrentMode('client');
              setClientNotes(event.target.value);
              clearInlineCompletion('client');
            }}
            onFocus={() => setCurrentMode('client')}
            onKeyDown={(event) => handleEditorKeyDown('client', event)}
            multiline
            minRows={12}
            fullWidth
            placeholder="Ren oppsummering som kan brukes i kommunikasjon med klient"
          />
          {renderInlineAssist('client')}
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={<Switch checked={clientCanView} onChange={(event) => setClientCanView(event.target.checked)} />}
              label="Klienten kan se denne notatstrømmen"
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Hovedpunkter
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
                Oppgaver
              </Typography>
              <List dense>
                {structuredDraft.actionItems.slice(0, 8).map((item, index) => (
                  <ListItem key={`${item.task}-${index}`}>
                    <ListItemText primary={item.task} secondary={`${item.assignedTo} • ${item.dueDate || 'Ingen dato'}`} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Klientønsker: {structuredDraft.clientRequests.length} • Tidslinjepunkter: {structuredDraft.timeline.length}
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <FormControlLabel
              control={<Switch checked={autoCompleteEnabled} onChange={(event) => setAutoCompleteEnabled(event.target.checked)} />}
              label="Autofullføring"
            />

            {projectQuery.data ? (
              <Alert severity="info" variant="outlined">
                Forslagene bruker prosjektet <strong>{projectQuery.data.title}</strong>
                {projectBrief ? ` og forespørselen «${truncateContextSnippet(projectBrief, 120)}»` : ''}
                {' '}som kontekst.
              </Alert>
            ) : null}

            {writingAssistMutation.isPending ? <Typography variant="body2">Genererer forslag...</Typography> : null}

            {writingStats.commonPhrases.length > 0 ? (
              <Alert severity="info">Vanlige formuleringer: {writingStats.commonPhrases.join(', ')}</Alert>
            ) : null}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {activeSuggestions.slice(0, 8).map((suggestion) => (
                <Chip key={`${currentMode}-${suggestion}`} label={suggestion} onClick={() => applySuggestion(suggestion)} clickable />
              ))}
            </Box>

            {activeInlineCompletion ? (
              <Alert severity="success" variant="outlined">
                Trykk <strong>Tab</strong> i tekstfeltet for å bruke inline forslaget raskt.
              </Alert>
            ) : null}
          </Box>
        </TabPanel>

        {saveMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Kunne ikke lagre notatene.</Alert> : null}
        {aiMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>AI-behandling feilet.</Alert> : null}
        {backupMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Google Drive-backup feilet.</Alert> : null}
        {timelineMutation.isError ? <Alert severity="error" sx={{ mt: 2 }}>Tidslinjesynk feilet.</Alert> : null}
      </CardContent>

      <Dialog open={showTimelineDialog} onClose={() => setShowTimelineDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Synk notater til Evendi</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Velg hvilke deler av notatet som skal sendes inn i Evendi-tidslinjen. Prosjektbrief og kundeønsker følger med som kontekst for tolkning og videre planlegging.
          </Typography>

          {projectQuery.data ? (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              <strong>{projectQuery.data.title}</strong>
              {projectBrief ? ` · ${truncateContextSnippet(projectBrief, 140)}` : ''}
            </Alert>
          ) : null}

          <TextField
            select
            label="Hvilken notatstrøm skal Evendi bruke som utgangspunkt"
            value={currentMode}
            onChange={(event) => setCurrentMode(event.target.value === 'client' ? 'client' : 'personal')}
            fullWidth
            sx={{ mb: 2 }}
          >
            <MenuItem value="personal">Personlig</MenuItem>
            <MenuItem value="client">Klient</MenuItem>
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
                  label={
                    section === 'keyPoints'
                      ? 'Hovedpunkter'
                      : section === 'actionItems'
                        ? 'Oppgaver'
                        : section === 'decisions'
                          ? 'Beslutninger'
                          : section === 'nextSteps'
                            ? 'Neste steg'
                            : section === 'clientRequests'
                              ? 'Kundeønsker'
                              : 'Tidslinjepunkter'
                  }
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTimelineDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleTimelineSync} disabled={timelineMutation.isPending}>
            Synk til Evendi
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default SmartMeetingNotesEditor;
