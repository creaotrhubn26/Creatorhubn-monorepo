// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Help,
  History,
  Mic,
  MicOff,
  Pause,
  PlayArrow,
  RecordVoiceOver,
  VolumeOff,
  VolumeUp,
  Warning,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import type { WritingSuggestion } from '@/services/AIWritingSuggestionsService';
import type { TOCItem } from '@/services/TableOfContentsService';
import type { MentionSuggestion } from '@/services/MentionService';

interface TranscriptionPanelProps {
  content: string;
  cursorPosition: number;
  selectedText?: string;
  onTextChange: (text: string) => void;
  onCursorChange: (position: number) => void;
  onSelectionChange: (text: string) => void;
  onAISuggestionAccept: (suggestion: WritingSuggestion) => void;
  onTOCNavigate: (item: TOCItem) => void;
  onMentionSelect: (mention: MentionSuggestion) => void;
  className?: string;
  maxHeight?: number;
  variant?: 'sidebar' | 'floating' | 'embedded';
}

interface SpeechConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  enableVoiceCommands: boolean;
  autoPunctuation: boolean;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
}

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
  alternatives: string[];
}

type VoiceCommandCategory = 'edit' | 'navigation' | 'ai' | 'mention' | 'system';

interface VoiceCommand {
  id: string;
  trigger: string;
  description: string;
  category: VoiceCommandCategory;
}

interface VoiceCommandRun {
  id: string;
  transcript: string;
  command: VoiceCommand;
  executed: boolean;
  message: string;
  timestamp: Date;
}

interface VoiceWritingSession {
  startedAt: Date;
  totalWords: number;
  totalCommands: number;
  averageConfidence: number;
  commandHistory: VoiceCommandRun[];
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultListLike;
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const customWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return customWindow.SpeechRecognition ?? customWindow.webkitSpeechRecognition ?? null;
}

function getDefaultCommands(): VoiceCommand[] {
  return [
    { id: 'newline', trigger: 'new line', description: 'Insert line break', category: 'edit' },
    { id: 'ny-linje', trigger: 'ny linje', description: 'Insert line break (NO)', category: 'edit' },
    { id: 'period', trigger: 'period', description: 'Insert period', category: 'edit' },
    { id: 'punktum', trigger: 'punktum', description: 'Insert period (NO)', category: 'edit' },
    { id: 'go-top', trigger: 'go to top', description: 'Move cursor to top', category: 'navigation' },
    { id: 'ga-toppen', trigger: 'gå til toppen', description: 'Move cursor to top (NO)', category: 'navigation' },
    { id: 'go-bottom', trigger: 'go to bottom', description: 'Move cursor to end', category: 'navigation' },
    { id: 'ga-slutten', trigger: 'gå til slutten', description: 'Move cursor to end (NO)', category: 'navigation' },
    { id: 'ai-summarize', trigger: 'summarize', description: 'Create AI summary suggestion', category: 'ai' },
    { id: 'ai-oppsummer', trigger: 'oppsummer', description: 'Create AI summary suggestion (NO)', category: 'ai' },
    { id: 'mention', trigger: 'mention', description: 'Mention resource', category: 'mention' },
  ];
}

function createTOCItem(title: string, position: number): TOCItem {
  return {
    id: `voice-toc-${Date.now()}`,
    title,
    level: 1,
    anchor: `voice-anchor-${position}`,
    children: [],
    position,
    wordCount: title.split(/\s+/).filter((token) => token.length > 0).length,
    readingTime: 1,
    isVisible: true,
  };
}

function createMentionSuggestion(raw: string): MentionSuggestion {
  return {
    resource: {
      id: `mention-${Date.now()}`,
      type: 'note',
      title: raw,
      description: `Voice mention: ${raw}`,
      isActive: true,
    },
    matchScore: 1,
    highlightedTitle: raw,
    context: 'voice-command',
  };
}

function normalizeSelection(text: string | undefined): string {
  return text?.trim() ?? '';
}

export default function TranscriptionPanel({
  content,
  cursorPosition,
  selectedText,
  onTextChange,
  onCursorChange,
  onSelectionChange,
  onAISuggestionAccept,
  onTOCNavigate,
  onMentionSelect,
  className,
  maxHeight = 600,
  variant = 'sidebar',
}: TranscriptionPanelProps): JSX.Element {
  const theming = useTheming('photographer');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionConstructorRef = useRef<SpeechRecognitionConstructor | null>(null);
  const speakingUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [config, setConfig] = useState<SpeechConfig>({
    language: 'nb-NO',
    continuous: true,
    interimResults: true,
    enableVoiceCommands: true,
    autoPunctuation: true,
    speechRate: 1,
    speechPitch: 1,
    speechVolume: 1,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionItems, setRecognitionItems] = useState<SpeechRecognitionResultItem[]>([]);
  const [commandRuns, setCommandRuns] = useState<VoiceCommandRun[]>([]);
  const [lastError, setLastError] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [session, setSession] = useState<VoiceWritingSession>({
    startedAt: new Date(),
    totalWords: 0,
    totalCommands: 0,
    averageConfidence: 0,
    commandHistory: [],
  });

  const voiceCommands = useMemo(() => getDefaultCommands(), []);

  const supportsRecognition = useMemo(() => getSpeechRecognitionConstructor() !== null, []);
  const supportsSpeechSynthesis = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, []);

  const runCommand = useCallback(
    (transcript: string, confidence: number): VoiceCommandRun | null => {
      const normalized = transcript.trim().toLowerCase();
      const command = voiceCommands.find((item) =>
        normalized === item.trigger || normalized.startsWith(`${item.trigger} `)
      );

      if (!command) {
        return null;
      }

      let executed = true;
      let message = '';

      if (command.id === 'newline' || command.id === 'ny-linje') {
        const updated = `${content.slice(0, cursorPosition)}\n${content.slice(cursorPosition)}`;
        onTextChange(updated);
        onCursorChange(cursorPosition + 1);
        message = 'Inserted new line.';
      } else if (command.id === 'period' || command.id === 'punktum') {
        const updated = `${content.slice(0, cursorPosition)}.${content.slice(cursorPosition)}`;
        onTextChange(updated);
        onCursorChange(cursorPosition + 1);
        message = 'Inserted period.';
      } else if (command.id === 'go-top' || command.id === 'ga-toppen') {
        onCursorChange(0);
        onTOCNavigate(createTOCItem('Top of document', 0));
        message = 'Moved cursor to top.';
      } else if (command.id === 'go-bottom' || command.id === 'ga-slutten') {
        onCursorChange(content.length);
        onTOCNavigate(createTOCItem('Bottom of document', content.length));
        message = 'Moved cursor to bottom.';
      } else if (command.id === 'ai-summarize' || command.id === 'ai-oppsummer') {
        const suggestion: WritingSuggestion = {
          id: `voice-suggestion-${Date.now()}`,
          type: 'improvement',
          text: content.slice(0, 200),
          originalText: content,
          confidence,
          reason: 'Voice command requested summary suggestion',
          category: 'flow',
          position: {
            start: 0,
            end: Math.min(content.length, 200),
          },
          alternatives: [
            content.slice(0, 120),
            `${normalizeSelection(selectedText) || 'Selected section'} (summary candidate)`,
          ],
          metadata: {
            context: 'voice-command',
          },
        };
        onAISuggestionAccept(suggestion);
        message = 'AI suggestion generated.';
      } else if (command.id === 'mention') {
        const mentionTarget = normalized.replace('mention', '').trim();
        if (mentionTarget.length === 0) {
          executed = false;
          message = 'Mention target missing.';
        } else {
          onMentionSelect(createMentionSuggestion(mentionTarget));
          message = `Mentioned ${mentionTarget}.`;
        }
      } else {
        executed = false;
        message = 'Unsupported command.';
      }

      return {
        id: `command-run-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        transcript,
        command,
        executed,
        message,
        timestamp: new Date(),
      };
    },
    [content, cursorPosition, onAISuggestionAccept, onCursorChange, onMentionSelect, onTOCNavigate, onTextChange, selectedText, voiceCommands]
  );

  const appendRecognitionItem = useCallback(
    (item: SpeechRecognitionResultItem) => {
      setRecognitionItems((previous) => [item, ...previous.slice(0, 49)]);

      setSession((previous) => {
        const words = item.transcript.split(/\s+/).filter((token) => token.length > 0).length;
        const count = previous.totalWords + words;
        const sampleSize = previous.commandHistory.length + 1;
        const avg = ((previous.averageConfidence * (sampleSize - 1)) + item.confidence) / sampleSize;
        return {
          ...previous,
          totalWords: count,
          averageConfidence: avg,
        };
      });

      if (!item.isFinal) {
        return;
      }

      if (config.enableVoiceCommands) {
        const commandRun = runCommand(item.transcript, item.confidence);
        if (commandRun) {
          setCommandRuns((previous) => [commandRun, ...previous.slice(0, 29)]);
          setSession((previous) => ({
            ...previous,
            totalCommands: previous.totalCommands + 1,
            commandHistory: [commandRun, ...previous.commandHistory].slice(0, 30),
          }));
          return;
        }
      }

      const punctuation = config.autoPunctuation ? ' ' : '';
      const insertion = `${item.transcript}${punctuation}`;
      const nextText = `${content.slice(0, cursorPosition)}${insertion}${content.slice(cursorPosition)}`;
      onTextChange(nextText);
      onCursorChange(cursorPosition + insertion.length);
      onSelectionChange(item.transcript);
    },
    [config.autoPunctuation, config.enableVoiceCommands, content, cursorPosition, onCursorChange, onSelectionChange, onTextChange, runCommand]
  );

  const initializeRecognition = useCallback(() => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    if (!recognitionConstructorRef.current) {
      recognitionConstructorRef.current = getSpeechRecognitionConstructor();
    }

    if (!recognitionConstructorRef.current) {
      return null;
    }

    const recognition = new recognitionConstructorRef.current();
    recognition.continuous = config.continuous;
    recognition.interimResults = config.interimResults;
    recognition.lang = config.language;

    recognition.onstart = () => {
      setIsListening(true);
      setLastError('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsProcessing(false);
    };

    recognition.onerror = (event) => {
      setLastError(event.error ?? 'Speech recognition failed.');
      setIsListening(false);
      setIsProcessing(false);
    };

    recognition.onresult = (event) => {
      const mapped: SpeechRecognitionResultItem[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const primary = result[0];
        const alternatives: string[] = [];

        for (let altIndex = 1; altIndex < result.length; altIndex += 1) {
          const alt = result[altIndex];
          alternatives.push(alt.transcript);
        }

        mapped.push({
          transcript: primary.transcript,
          confidence: primary.confidence,
          isFinal: result.isFinal,
          timestamp: new Date(),
          alternatives,
        });
      }

      mapped.forEach((item) => appendRecognitionItem(item));
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [appendRecognitionItem, config.continuous, config.interimResults, config.language]);

  const startListening = useCallback(() => {
    const recognition = initializeRecognition();
    if (!recognition) {
      setLastError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      setIsProcessing(true);
      recognition.start();
    } catch {
      setIsProcessing(false);
      setLastError('Unable to start speech recognition.');
    }
  }, [initializeRecognition]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  const speakText = useCallback(
    (overrideText?: string) => {
      if (!supportsSpeechSynthesis) {
        setLastError('Speech synthesis is not supported in this browser.');
        return;
      }

      const text = (overrideText ?? normalizeSelection(selectedText) || content).trim();
      if (text.length === 0) {
        setLastError('Nothing to speak.');
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = config.language;
      utterance.rate = config.speechRate;
      utterance.pitch = config.speechPitch;
      utterance.volume = config.speechVolume;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsSpeechPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
        setLastError('Speech playback failed.');
      };

      speakingUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [config.language, config.speechPitch, config.speechRate, config.speechVolume, content, selectedText, supportsSpeechSynthesis]
  );

  const pauseSpeaking = useCallback(() => {
    if (!supportsSpeechSynthesis) {
      return;
    }
    window.speechSynthesis.pause();
    setIsSpeechPaused(true);
  }, [supportsSpeechSynthesis]);

  const resumeSpeaking = useCallback(() => {
    if (!supportsSpeechSynthesis) {
      return;
    }
    window.speechSynthesis.resume();
    setIsSpeechPaused(false);
  }, [supportsSpeechSynthesis]);

  const stopSpeaking = useCallback(() => {
    if (!supportsSpeechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsSpeechPaused(false);
  }, [supportsSpeechSynthesis]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (supportsSpeechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supportsSpeechSynthesis]);

  const sessionDurationMinutes = useMemo(() => {
    const elapsedMs = Date.now() - session.startedAt.getTime();
    return Math.max(1, Math.round(elapsedMs / 60000));
  }, [session.startedAt]);

  const wordsPerMinute = useMemo(() => {
    return Math.round(session.totalWords / sessionDurationMinutes);
  }, [session.totalWords, sessionDurationMinutes]);

  const commandSuccessRate = useMemo(() => {
    if (commandRuns.length === 0) {
      return 0;
    }
    const success = commandRuns.filter((run) => run.executed).length;
    return Math.round((success / commandRuns.length) * 100);
  }, [commandRuns]);

  return (
    <>
      <Paper
        className={className}
        elevation={variant === 'floating' ? 8 : 2}
        sx={{
          maxHeight,
          minHeight: 360,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...(variant === 'floating'
            ? {
                position: 'fixed',
                top: 20,
                right: 20,
                width: 420,
                zIndex: 30,
              }
            : {}),
          ...theming.getThemedCardSx(),
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RecordVoiceOver color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Transcription
              </Typography>
              <Badge color={isListening ? 'success' : 'default'} variant="dot">
                <Chip size="small" label={isListening ? 'Listening' : 'Idle'} />
              </Badge>
            </Stack>

            <Stack direction="row" spacing={0.5}>
              <Tooltip title={isListening ? 'Stop listening' : 'Start listening'}>
                <IconButton onClick={isListening ? stopListening : startListening} color={isListening ? 'error' : 'primary'}>
                  {isListening ? <MicOff /> : <Mic />}
                </IconButton>
              </Tooltip>

              <Tooltip title={isSpeaking ? 'Stop speaking' : 'Read text'}>
                <IconButton onClick={isSpeaking ? stopSpeaking : () => speakText()}>
                  {isSpeaking ? <VolumeOff /> : <VolumeUp />}
                </IconButton>
              </Tooltip>

              <Tooltip title={isSpeechPaused ? 'Resume speaking' : 'Pause speaking'}>
                <span>
                  <IconButton onClick={isSpeechPaused ? resumeSpeaking : pauseSpeaking} disabled={!isSpeaking}>
                    {isSpeechPaused ? <PlayArrow /> : <Pause />}
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Help">
                <IconButton onClick={() => setShowHelp(true)}>
                  <Help />
                </IconButton>
              </Tooltip>

              <Tooltip title="History">
                <IconButton onClick={() => setShowHistory(true)}>
                  <History />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {isProcessing ? <LinearProgress sx={{ mt: 1 }} /> : null}
          {lastError ? (
            <Alert severity="error" sx={{ mt: 1 }} icon={<Warning />} onClose={() => setLastError('')}>
              {lastError}
            </Alert>
          ) : null}
        </Box>

        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="fullWidth">
          <Tab label="Live" />
          <Tab label="Commands" />
          <Tab label="Settings" />
        </Tabs>

        <Box sx={{ p: 1.5, overflow: 'auto', flex: 1 }}>
          {activeTab === 0 ? (
            <Stack spacing={1.5}>
              <Card>
                <Box sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Session Stats
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={`Words: ${session.totalWords}`} />
                    <Chip size="small" label={`WPM: ${wordsPerMinute}`} />
                    <Chip size="small" label={`Commands: ${session.totalCommands}`} />
                    <Chip size="small" label={`Confidence: ${Math.round(session.averageConfidence * 100)}%`} />
                  </Stack>
                </Box>
              </Card>

              <Typography variant="subtitle2">Recognition</Typography>
              <List dense>
                {recognitionItems.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No recognition yet." secondary="Start listening to populate transcript." />
                  </ListItem>
                ) : (
                  recognitionItems.slice(0, 15).map((item) => (
                    <ListItem key={`${item.timestamp.getTime()}-${item.transcript}`} divider>
                      <ListItemText
                        primary={item.transcript}
                        secondary={`${item.isFinal ? 'Final' : 'Interim'} • ${Math.round(item.confidence * 100)}% • ${item.timestamp.toLocaleTimeString()}`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Stack>
          ) : null}

          {activeTab === 1 ? (
            <Stack spacing={1.5}>
              <Card>
                <Box sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Command Runs
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label={`Executed: ${commandRuns.length}`} />
                    <Chip size="small" label={`Success: ${commandSuccessRate}%`} color={commandSuccessRate >= 70 ? 'success' : 'warning'} />
                  </Stack>
                </Box>
              </Card>

              <List dense>
                {commandRuns.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No command runs yet." secondary="Say commands like: new line, summarize, go to top" />
                  </ListItem>
                ) : (
                  commandRuns.map((run) => (
                    <ListItem key={run.id} divider>
                      <ListItemText
                        primary={run.transcript}
                        secondary={`${run.command.description} • ${run.executed ? 'executed' : 'failed'} • ${run.timestamp.toLocaleTimeString()}`}
                      />
                      {run.executed ? <CheckCircle color="success" fontSize="small" /> : <Warning color="warning" fontSize="small" />}
                    </ListItem>
                  ))
                )}
              </List>

              <Alert severity="info">
                Available commands: {voiceCommands.map((command) => command.trigger).join(', ')}
              </Alert>
            </Stack>
          ) : null}

          {activeTab === 2 ? (
            <Stack spacing={2}>
              <FormControlLabel
                control={<Switch checked={config.enableVoiceCommands} onChange={(event) => setConfig((previous) => ({ ...previous, enableVoiceCommands: event.target.checked }))} />}
                label="Enable voice commands"
              />

              <FormControlLabel
                control={<Switch checked={config.autoPunctuation} onChange={(event) => setConfig((previous) => ({ ...previous, autoPunctuation: event.target.checked }))} />}
                label="Auto punctuation"
              />

              <FormControlLabel
                control={<Switch checked={config.continuous} onChange={(event) => setConfig((previous) => ({ ...previous, continuous: event.target.checked }))} />}
                label="Continuous recognition"
              />

              <TextField
                label="Language"
                value={config.language}
                onChange={(event) => setConfig((previous) => ({ ...previous, language: event.target.value }))}
                helperText="Examples: nb-NO, en-US"
              />

              <Box>
                <Typography variant="body2">Speech rate: {config.speechRate.toFixed(1)}</Typography>
                <Slider value={config.speechRate} min={0.5} max={2} step={0.1} onChange={(_, value) => setConfig((previous) => ({ ...previous, speechRate: value as number }))} />
              </Box>

              <Box>
                <Typography variant="body2">Speech pitch: {config.speechPitch.toFixed(1)}</Typography>
                <Slider value={config.speechPitch} min={0.5} max={2} step={0.1} onChange={(_, value) => setConfig((previous) => ({ ...previous, speechPitch: value as number }))} />
              </Box>

              <Box>
                <Typography variant="body2">Speech volume: {config.speechVolume.toFixed(1)}</Typography>
                <Slider value={config.speechVolume} min={0} max={1} step={0.05} onChange={(_, value) => setConfig((previous) => ({ ...previous, speechVolume: value as number }))} />
              </Box>

              <Alert severity={supportsRecognition ? 'success' : 'warning'}>
                Recognition support: {supportsRecognition ? 'available' : 'not available'}
              </Alert>
              <Alert severity={supportsSpeechSynthesis ? 'success' : 'warning'}>
                Speech synthesis support: {supportsSpeechSynthesis ? 'available' : 'not available'}
              </Alert>
            </Stack>
          ) : null}
        </Box>
      </Paper>

      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Voice Help</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Use commands in Norwegian or English while listening is enabled.
          </Typography>
          <List dense>
            {voiceCommands.map((command) => (
              <ListItem key={`help-${command.id}`}>
                <ListItemText primary={command.trigger} secondary={command.description} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Voice History</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Session started: {session.startedAt.toLocaleString()}
          </Typography>
          <List dense>
            {session.commandHistory.length === 0 ? (
              <ListItem>
                <ListItemText primary="No commands in this session." />
              </ListItem>
            ) : (
              session.commandHistory.map((run) => (
                <ListItem key={`history-${run.id}`}>
                  <ListItemText
                    primary={run.transcript}
                    secondary={`${run.message} • ${run.timestamp.toLocaleTimeString()}`}
                  />
                </ListItem>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCommandRuns([]);
              setSession((previous) => ({ ...previous, commandHistory: [], totalCommands: 0 }));
            }}
            color="error"
          >
            Clear
          </Button>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
