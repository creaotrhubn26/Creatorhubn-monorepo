// client/src/components/notes/TranscriptionPanel.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Stack,
  LinearProgress,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  TextField,
  Tooltip,
  Badge,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Mic,
  MicOff,
  PlayArrowArrow,
  Pause,
  Stop,
  VolumeUpUp,
  VolumeOff,
  Settings,
  Help,
  History,
  AutoAwesome,
  List as ListIcon,
  Search,
  Edit,
  FormatFormatBold,
  FormatFormatItalic,
  FormatFormatUnderlinedd,
  NavigateNext,
  NavigateBefore,
  Save,
  Share,
  Psychology,
  Timeline,
  Speed,
  RecordVoiceOver,
  VoiceOverOff,
  Translate,
  Summarize,
  Refresh,
  Clear,
  CheckCircle,
  Cancel,
  Warning,
  Info,
  TrendingUp,
  BoxChart,
  School,
  Lightbulb,
  Code,
  Notes,
  Person,
  Folder,
  Description,
  Api,
  Article,
} from '@mui/icons-material';
import type { 
  SpeechConfig, 
  SpeechRecognitionResult, 
  VoiceCommand, 
  VoiceCommandResult,
  VoiceWritingSession,
  VoiceWritingContext,
  VoiceInfo 
} from '@/services/SpeechService';
import SpeechService from '@/services/SpeechService';
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
  variant?: 'sidebar' | 'floating' | 'embedded'
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
}: TranscriptionPanelProps) {
  const [isListening, setIsListening] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recognitionResults, setRecognitionResults] = useState<SpeechRecognitionResult[]>([]);
  const [voiceCommands, setVoiceCommands] = useState<VoiceCommand[]>([]);
  const [commandResults, setCommandResults] = useState<VoiceCommandResult[]>([]);
  const [currentSession, setCurrentSession] = useState<VoiceWritingSession | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [config, setConfig] = useState<SpeechConfig>(SpeechService.getInstance().getConfig());
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [voiceHistory, setVoiceHistory] = useState<string[]>([]);
  
  const speechService = SpeechService.getInstance();
  const recognitionTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize voice writing session
  useEffect(() => {
    const context: VoiceWritingContext = {
      currentText: content,
      cursorPosition,
      selectedText,
      documentType: 'note',
      writingStyle: 'casual',
      targetAudience: 'general',
      language: 'no',
      voiceHistory: voiceHistory,
  };

    const session = speechService.startVoiceWritingSession(context);
    setCurrentSession(session);

    return () => {
      speechService.endVoiceWritingSession();
  };
}, []);

  // Update context when content changes
  useEffect(() => {
    speechService.updateWritingContext({
      currentText: content,
      cursorPosition,
      selectedText,
  });
}, [content, cursorPosition, selectedText]);

  // Load available voices
  useEffect(() => {
    const voices = speechService.getAvailableVoices();
    setAvailableVoices(voices);
}, []);

  // Load voice commands
  useEffect(() => {
    const commands = speechService.getVoiceCommands();
    setVoiceCommands(commands);
}, []);

  // Set up event listeners
  useEffect(() => {
    const handleListeningStarted = () => {
      setIsListening(true);
      setLastError(null);
  };

    const handleListeningEnded = () => {
      setIsListening(false);
  };

    const handleRecognitionResult = (results: SpeechRecognitionResult[]) => {
      setRecognitionResults(prev => [...prev, ...results]);
      setVoiceHistory(prev => [...prev, ...results.map(r => r.transcript)]);
  };

    const handleVoiceCommand = (result: VoiceCommandResult) => {
      setCommandResults(prev => [result, ...prev.slice(0, 19)]); // Keep last 20
      handleVoiceCommandResult(result);
  };

    const handleSpeakingStarted = () => {
      setIsSpeaking(true);
      setIsPaused(false);
  };

    const handleSpeakingEnded = () => {
      setIsSpeaking(false);
      setIsPaused(false);
  };

    const handleSpeakingPaused = () => {
      setIsPaused(true);
  };

    const handleSpeakingResumed = () => {
      setIsPaused(false);
  };

    const handleError = (error: string) => {
      setLastError(error);
      setIsListening(false);
      setIsProcessing(false);
};

    speechService.addEventListener('listeningStarted', handleListeningStarted);
    speechService.addEventListener('listeningEnded', handleListeningEnded);
    speechService.addEventListener('recognitionResult', handleRecognitionResult);
    speechService.addEventListener('voiceCommand', handleVoiceCommand);
    speechService.addEventListener('speakingStarted', handleSpeakingStarted);
    speechService.addEventListener('speakingEnded', handleSpeakingEnded);
    speechService.addEventListener('speakingPaused', handleSpeakingPaused);
    speechService.addEventListener('speakingResumed', handleSpeakingResumed);
    speechService.addEventListener('recognitionError', handleError);

    return () => {
      speechService.removeEventListener('listeningStarted', handleListeningStarted);
      speechService.removeEventListener('listeningEnded', handleListeningEnded);
      speechService.removeEventListener('recognitionResult', handleRecognitionResult);
      speechService.removeEventListener('voiceCommand', handleVoiceCommand);
      speechService.removeEventListener('speakingStarted', handleSpeakingStarted);
      speechService.removeEventListener('speakingEnded', handleSpeakingEnded);
      speechService.removeEventListener('speakingPaused', handleSpeakingPaused);
      speechService.removeEventListener('speakingResumed', handleSpeakingResumed);
      speechService.removeEventListener('recognitionError', handleError);
  };
}, []);

  const handleVoiceCommandResult = useCallback((result: VoiceCommandResult) => {
    if (!result.executed || !result.result) return;

    const { action, type, suggestions, tocItems, mentions, section, message } = result.result;

    switch (action) {
      case 'ai':
        if (suggestions && suggestions.length > 0) {
          // Show AI suggestions
          console.log('AI Suggestions: ', suggestions);
      }
        break;

      case 'toc':
        if (type === 'navigate' && section) {
          onTOCNavigate(section);
      } else if (tocItems) {
          console.log('TOC Items:', tocItems);
      }
        break;

      case 'mention':
        if (mentions && mentions.length > 0) {
          console.log('Mentions:', mentions);
      }
        break;

      case 'navigate':
        if (type === 'paragraph') {
          // Handle sx={{ mb: 2 }} navigation
          console.log('Navigate paragraph:', result.result);
      }
        break;

      case 'edit':
        if (type === 'newline') {
          onTextChange(content + '\n');
      } else if (type === 'delete') {
          // Handle text deletion
          console.log('Delete text:', result.result);
      }
        break;

      case 'format':
        // Handle text formatting
        console.log('Format text:', result.result);
        break;

      case 'system':
        if (type === 'save') {
          // Trigger save
          console.log('Save document');
      }
        break;
  }

    if (message) {
      // Speak the message
      speechService.speak(message);
  }
}, [content, onTextChange, onTOCNavigate, speechService]);

  const startListening = async () => {
    try {
      setIsProcessing(true);
      await speechService.startListening();
  } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
      setIsProcessing(false);
  }
};

  const stopListening = () => {
    speechService.stopListening();
};

  const startSpeaking = async (text?: string) => {
    const textToSpeak = text || selectedText || content;
    if (!textToSpeak.trim()) return;

    try {
      setIsProcessing(true);
      const processedText = speechService.processTextForSpeech(textToSpeak);
      await speechService.speak(processedText);
  } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
      setIsProcessing(false);
  }
};

  const stopSpeaking = () => {
    speechService.stopSpeaking();
};

  const pauseSpeaking = () => {
    speechService.pauseSpeaking();
};

  const resumeSpeaking = () => {
    speechService.resumeSpeaking();
};

  const updateConfig = (newConfig: Partial<SpeechConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    speechService.updateConfig(updatedConfig);
};

  const getCommandIcon = (category: string) => {
    switch (category) {
      case 'ai': return <Psychology />;
      case 'toc': return <ListIcon />;
      case 'mention': return theming.getThemedIcon(', ');
      case 'navigation': return <NavigateNext />;
      case 'editing': return theming.getThemedIcon('edit');
      case 'formatting': return <FormatBold />;
      case 'system': return theming.getThemedIcon('settings');
      default: return <Help />;
}
};

  const getCommandColor = (category: string) => {
    switch (category) {
      case 'ai': return 'primary';
      case 'toc': return 'info';
      case 'mention': return 'success';
      case 'navigation': return 'warning';
      case 'editing': return 'secondary';
      case 'formatting': return 'default';
      case 'system': return 'error';
      default: return 'default';
}
};

  const renderRecognitionResults = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Gjenkjenningsresultater
      </Typography>
      {recognitionResults.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen resultater ennå
        </Typography>
      ) : (
        <List dense>
          {recognitionResults.slice(-5).map((result, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <Badge
                  badgeContent={Math.round(result.confidence * 100)}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16,} }}
                >
                  {theming.getThemedIcon('mic')}
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={result.transcript}
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {result.isFinal ? 'Final' : 'Interim'} • {result.timestamp.toLocaleTimeString()}
                    </Typography>
                    {result.alternatives && result.alternatives.length > 1 && (
                      <Box sx={{ mt: 0.5}}>
                        {result.alternatives.slice(1, 3).map((alt, altIndex) => (
                          <Chip
                            key={altIndex}
                            size="small"
                            label={alt}
                            variant="outlined"
                            sx={{ mr: 0, .fontSize: '0.65rem', height: 20}}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
              }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  const renderCommandResults = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Stemmekommandoer
      </Typography>
      {commandResults.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen kommandoer utført ennå
        </Typography>
      ) : (
        <List dense>
          {commandResults.slice(0, 10).map((result, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                {result.executed ? (
                  <CheckCircle color="success" />
                ) : (
                  <Cancel color="error" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box>
                    <Typography variant="body2">
                      {result.transcript}
                    </Typography>
                    <Chip
                      size="small"
                      label={result.command.description}
                      icon={getCommandIcon(result.command.category)}
                      color={getCommandColor(result.command.category) as any}
                      sx={{ fontSize: '0.65rem', height:  20, mt: 0.5}}
                    />
                  </Box>
              }
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Konfidens: {Math.round(result.confidence * 10)}%
                    </Typography>
                    {result.error && (
                      <Typography variant="caption" color="error" display="block">
                        Feil: {result.error}
                      </Typography>
                    )}
                    {result.result?.message && (
                      <Typography variant="caption" color="primary" display="block">
                        {result.result.message}
                      </Typography>
                    )}
                  </Box>
              }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  const renderVoiceCommands = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Tilgjengelige kommandoer
      </Typography>
      <List dense>
        {voiceCommands.map((command) => (
          <ListItem key={command.id}>
            <ListItemIcon>
              {getCommandIcon(command.category)}
            </ListItemIcon>
            <ListItemText
              primary={command.description}
              secondary={
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {command.pattern}
                  </Typography>
                  <Chip
                    size="small"
                    label={command.category}
                    color={getCommandColor(command.category) as any}
                    sx={{ fontSize: '0.65rem', height:  20, ml:  1 }}
                  />
                </Box>
            }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const renderSessionStats = () => {
    if (!currentSession) return null;

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Skrivesesjon statistikk
        </Typography>
        <Stack spacing={1}>
          <Box>
            <Typography variant="body2">
              Ord skrevet: {currentSession.totalWords}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (currentSession.totalWords / 1000) * 100)}
              sx={{ height:  4, borderRadius: 2mt: 0.5}}
            />
          </Box>
          <Box>
            <Typography variant="body2">
              Kommandoer: {currentSession.totalCommands}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2">
              Gjennomsnittlig konfidens: {Math.round(currentSession.averageConfidence * 10)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={currentSession.averageConfidence * 100}
              color="info"
              sx={{ height:  4, borderRadius: 2mt: 0.5}}
            />
          </Box>
          <Box>
            <Typography variant="body2">
              TOC navigasjoner: {currentSession.tocNavigations}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2">
              Nevnt: {currentSession.mentionsUsed}
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
};

  return (
    <>
      <Paper
        className={className}
        elevation={variant === 'floating' ? 8 : 2}
        sx={{
          maxHeight,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...(variant === 'floating' && {
            position: 'fixed',
            top:  20,
            left:  20,
            zIndex: 10,
            minWidth: 40,
            maxWidth: 50,
        })}}
       sx={theming.getThemedCardSx()}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RecordVoiceOver color="primary" />
              <Typography variant="h6" component="h2" sx={{ color: theming.colors.primary }}>
                Stemme & Transkripsjon
              </Typography>
              {isProcessing && <CircularProgress size={20} />}
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Innstillinger">
                <IconButton size="small" onClick={() => setShowSettings(true)}>
                  {theming.getThemedIcon('settings')}
                </IconButton>
              </Tooltip>
              <Tooltip title="Hjelp">
                <IconButton size="small" onClick={() => setShowHelp(true)}>
                  <Help />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Error Alert */}
          {lastError && (
            <Alert severity="error" sx={{ mt:  1 }} onClose={() => setLastError(null)}>
              <AlertTitle>Feil</AlertTitle>
              {lastError}
            </Alert>
          )}

          {/* Control Buttons */}
          <Stack direction="row" spacing={1} sx={{ mt:  2 }}>
            <Button
              variant={isListening ? 'contained' : 'outlined'}
              color={isListening ? 'error' : 'primary'}
              startIcon={isListening ? theming.getThemedIcon('micOff') : theming.getThemedIcon('mic')}
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
            >
              {isListening ? 'Stopp' : 'Start'} Lytte
            </Button>

            <Button
              variant={isSpeaking ? 'contained' : 'outlined'}
              color={isSpeaking ? 'error' : 'secondary'}
              startIcon={isSpeaking ? theming.getThemedIcon('stop') : theming.getThemedIcon('play')}
              onClick={isSpeaking ? stopSpeaking : () => startSpeaking()}
              disabled={isProcessing}
            >
              {isSpeaking ? 'Stopp' : 'Les'} Opp
            </Button>

            {isSpeaking && (
              <IconButton
                onClick={isPaused ? resumeSpeaking : pauseSpeaking}
                color="primary"
              >
                {isPaused ? theming.getThemedIcon('play') : theming.getThemedIcon('pause')}
              </IconButton>
            )}
          </Stack>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto'}}>
          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
            <Tab label="Resultater" />
            <Tab label="Kommandoer" />
            <Tab label="Hjelp" />
            <Tab label="Statistikk" />
          </Tabs>

          <Box sx={{ p:  2 }}>
            {activeTab === 0 && renderRecognitionResults()}
            {activeTab === 1 && renderCommandResults()}
            {activeTab === 2 && renderVoiceCommands()}
            {activeTab === 3 && renderSessionStats()}
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider'}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {isListening ? 'Lytter...' : isSpeaking ? 'Leser...' : 'Klar'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {voiceHistory.length} uttrykk
            </Typography>
          </Stack>
        </Box>
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="md" fullWidth>
        <DialogTitle>Stemmeinnstillinger</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Stemme
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Stemme</InputLabel>
                <Select
                  value={config.voice}
                  onChange={(e) => updateConfig({ voice: e.target.value })}
                >
                  {availableVoices.map((voice) => (
                    <MenuItem key={voice.name} value={voice.name}>
                      <Box>
                        <Typography variant="body2">{voice.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {voice.language} • {voice.gender} • {voice.quality}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Talehastighet: {config.rate}
              </Typography>
              <Slider
                value={config.rate}
                onChange={(_, value) => updateConfig({ rate: value as number })}
                min={0.5}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, .label: '0.5x',},
                  { value: 1, label: '1x',},
                  { value: 2, label: '2x',},
                ]}
              />
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Tonehøyde: {config.pitch}
              </Typography>
              <Slider
                value={config.pitch}
                onChange={(_, value) => updateConfig({ pitch: value as number })}
                min={0.5}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, .label: 'Lav',},
                  { value: 1, label: 'Normal',},
                  { value: 2, label: 'Høy',},
                ]}
              />
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Volum: {config.volume}
              </Typography>
              <Slider
                value={config.volume}
                onChange={(_, value) => updateConfig({ volume: value as number })}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0%',},
                  { value: 0, .label: '50%',},
                  { value: 1, label:'100%',},
                ]}
              />
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Avanserte innstillinger
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableContinuousListening}
                      onChange={(e) => updateConfig({ enableContinuousListening: e.target.checked })}
                    />
                }
                  label="Kontinuerlig lytte"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableVoiceCommands}
                      onChange={(e) => updateConfig({ enableVoiceCommands: e.target.checked })}
                    />
                }
                  label="Aktiver stemmekommandoer"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableAutoPunctuation}
                      onChange={(e) => updateConfig({ enableAutoPunctuation: e.target.checked })}
                    />
                }
                  label="Automatisk tegnsetting"
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>Stemmekommandoer Hjelp</DialogTitle>
        <DialogContent>
          {renderVoiceCommands()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
