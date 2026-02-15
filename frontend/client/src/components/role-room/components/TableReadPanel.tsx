/**
 * TableReadPanel - Text-to-Speech table reads for screenplay
 * 
 * Provides TTS functionality with different voices for different characters.
 * Simulates a table read with actors reading their lines.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Slider,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel,
  Avatar,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  SkipNext as NextIcon,
  SkipPrevious as PrevIcon,
  VolumeUp as VolumeIcon,
  Speed as SpeedIcon,
  RecordVoiceOver as VoiceIcon,
  Person as CharacterIcon,
  GraphicEq as WaveformIcon,
  Mic as MicIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  getCharacterVoice,
  speakText,
  stopSpeaking,
} from '../services/scriptAnalysisService';

interface DialogueLine {
  character: string;
  text: string;
  lineNumber: number;
  parenthetical?: string;
}

interface TableReadPanelProps {
  content: string;
  onLineHighlight?: (lineNumber: number) => void;
  darkMode?: boolean;
}

// Parse Fountain content to extract dialogue
function parseDialogue(content: string): DialogueLine[] {
  const lines = content.split('\n');
  const dialogueLines: DialogueLine[] = [];
  
  let currentCharacter: string | null = null;
  let currentParenthetical: string | null = null;
  let lineStart = 0;
  
  const CHARACTER_PATTERN = /^@?([A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*?)(\s*\(.*\))?$/;
  const PARENTHETICAL_PATTERN = /^\((.+)\)$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for character cue
    const charMatch = line.match(CHARACTER_PATTERN);
    if (charMatch && (i === 0 || lines[i - 1].trim() === '')) {
      currentCharacter = charMatch[1].trim();
      currentParenthetical = charMatch[2] ? charMatch[2].replace(/[()]/g, '').trim() : null;
      lineStart = i + 1;
      continue;
    }
    
    // Check for parenthetical
    const parentMatch = line.match(PARENTHETICAL_PATTERN);
    if (parentMatch && currentCharacter) {
      currentParenthetical = parentMatch[1];
      continue;
    }
    
    // Dialogue line
    if (currentCharacter && line && !line.match(/^(INT|EXT|EST|I\/E)/i)) {
      dialogueLines.push({
        character: currentCharacter,
        text: line,
        lineNumber: i + 1,
        parenthetical: currentParenthetical || undefined,
      });
      currentParenthetical = null;
    }
    
    // Reset on blank line
    if (line === '') {
      currentCharacter = null;
      currentParenthetical = null;
    }
  }
  
  return dialogueLines;
}

// Get unique characters from dialogue
function getCharacters(dialogueLines: DialogueLine[]): string[] {
  const chars = new Set<string>();
  dialogueLines.forEach(d => chars.add(d.character));
  return Array.from(chars).sort();
}

// Generate consistent colors for characters
function getCharacterColor(name: string): string {
  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export const TableReadPanel: React.FC<TableReadPanelProps> = ({
  content,
  onLineHighlight,
  darkMode = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [characterVoices, setCharacterVoices] = useState<Record<string, SpeechSynthesisVoice | null>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [skipActionLines, setSkipActionLines] = useState(true);
  
  const playingRef = useRef(false);
  const currentIndexRef = useRef(0);

  // Parse dialogue from content
  const dialogueLines = useMemo(() => parseDialogue(content), [content]);
  const characters = useMemo(() => getCharacters(dialogueLines), [dialogueLines]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis?.getVoices() || [];
      setVoices(availableVoices);
      
      // Auto-assign voices to characters
      const autoVoices: Record<string, SpeechSynthesisVoice | null> = {};
      characters.forEach(char => {
        autoVoices[char] = getCharacterVoice(char);
      });
      setCharacterVoices(autoVoices);
    };

    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, [characters]);

  // Update refs when state changes
  useEffect(() => {
    playingRef.current = isPlaying && !isPaused;
    currentIndexRef.current = currentIndex;
  }, [isPlaying, isPaused, currentIndex]);

  // Play a single line
  const playLine = useCallback(async (index: number): Promise<boolean> => {
    if (index >= dialogueLines.length) return false;
    
    const line = dialogueLines[index];
    const voice = characterVoices[line.character];
    
    // Highlight line in editor
    onLineHighlight?.(line.lineNumber);
    
    try {
      await speakText(line.text, voice, speed, 1);
      return true;
    } catch (error) {
      console.error('TTS error:', error);
      return false;
    }
  }, [dialogueLines, characterVoices, speed, onLineHighlight]);

  // Play from current position
  const play = useCallback(async () => {
    if (dialogueLines.length === 0) return;
    
    setIsPlaying(true);
    setIsPaused(false);
    playingRef.current = true;
    
    for (let i = currentIndexRef.current; i < dialogueLines.length; i++) {
      if (!playingRef.current) break;
      
      setCurrentIndex(i);
      currentIndexRef.current = i;
      
      await playLine(i);
      
      // Small pause between lines
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setIsPlaying(false);
    playingRef.current = false;
  }, [dialogueLines, playLine]);

  // Pause
  const pause = useCallback(() => {
    setIsPaused(true);
    playingRef.current = false;
    stopSpeaking();
  }, []);

  // Resume
  const resume = useCallback(() => {
    setIsPaused(false);
    play();
  }, [play]);

  // Stop
  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    playingRef.current = false;
    stopSpeaking();
  }, []);

  // Skip to next line
  const next = useCallback(() => {
    const newIndex = Math.min(currentIndex + 1, dialogueLines.length - 1);
    setCurrentIndex(newIndex);
    currentIndexRef.current = newIndex;
    onLineHighlight?.(dialogueLines[newIndex]?.lineNumber);
  }, [currentIndex, dialogueLines, onLineHighlight]);

  // Skip to previous line
  const prev = useCallback(() => {
    const newIndex = Math.max(currentIndex - 1, 0);
    setCurrentIndex(newIndex);
    currentIndexRef.current = newIndex;
    onLineHighlight?.(dialogueLines[newIndex]?.lineNumber);
  }, [currentIndex, dialogueLines, onLineHighlight]);

  // Change voice for character
  const handleVoiceChange = (character: string, voiceName: string) => {
    const voice = voices.find(v => v.name === voiceName) || null;
    setCharacterVoices(prev => ({ ...prev, [character]: voice }));
  };

  const currentLine = dialogueLines[currentIndex];
  const progress = dialogueLines.length > 0 ? (currentIndex / dialogueLines.length) * 100 : 0;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: darkMode ? '#1a1a2e' : '#f8f9fa',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: darkMode ? 'rgba(30,30,50,0.9)' : 'rgba(255,255,255,0.95)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <MicIcon color="primary" />
          <Typography variant="h6" sx={{ flex: 1 }}>
            Table Read
          </Typography>
          <Chip
            label={`${dialogueLines.length} replikker`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Tooltip title="Innstillinger">
            <IconButton onClick={() => setShowSettings(!showSettings)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Progress Bar */}
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {currentIndex + 1} / {dialogueLines.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(progress)}%
            </Typography>
          </Stack>
        </Box>

        {/* Playback Controls */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ mt: 2 }}
        >
          <IconButton onClick={prev} disabled={currentIndex === 0}>
            <PrevIcon />
          </IconButton>
          
          {isPlaying && !isPaused ? (
            <IconButton onClick={pause} color="primary" size="large">
              <PauseIcon fontSize="large" />
            </IconButton>
          ) : (
            <IconButton onClick={isPaused ? resume : play} color="primary" size="large">
              <PlayIcon fontSize="large" />
            </IconButton>
          )}
          
          <IconButton onClick={stop} disabled={!isPlaying && !isPaused}>
            <StopIcon />
          </IconButton>
          
          <IconButton onClick={next} disabled={currentIndex >= dialogueLines.length - 1}>
            <NextIcon />
          </IconButton>
        </Stack>

        {/* Speed & Volume */}
        <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
            <SpeedIcon fontSize="small" color="action" />
            <Slider
              value={speed}
              onChange={(_, v) => setSpeed(v as number)}
              min={0.5}
              max={2}
              step={0.1}
              size="small"
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}x`}
            />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
            <VolumeIcon fontSize="small" color="action" />
            <Slider
              value={volume}
              onChange={(_, v) => setVolume(v as number)}
              min={0}
              max={1}
              step={0.1}
              size="small"
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Settings Panel */}
      {showSettings && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            bgcolor: darkMode ? 'rgba(25,25,45,0.9)' : 'rgba(250,250,252,0.95)',
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            <VoiceIcon sx={{ mr: 1, fontSize: 18, verticalAlign: 'middle' }} />
            Stemmetildeling
          </Typography>
          
          <Stack spacing={1.5}>
            {characters.map(char => (
              <Stack key={char} direction="row" alignItems="center" spacing={2}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: getCharacterColor(char),
                    fontSize: '0.8rem',
                  }}
                >
                  {char.charAt(0)}
                </Avatar>
                <Typography variant="body2" sx={{ minWidth: 100, fontWeight: 500 }}>
                  {char}
                </Typography>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <Select
                    value={characterVoices[char]?.name || ''}
                    onChange={(e) => handleVoiceChange(char, e.target.value)}
                    displayEmpty
                    sx={{ fontSize: '0.85rem' }}
                  >
                    <MenuItem value="">
                      <em>Auto</em>
                    </MenuItem>
                    {voices.map(voice => (
                      <MenuItem key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={skipActionLines}
                onChange={(e) => setSkipActionLines(e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="body2">Hopp over handlingslinjer</Typography>}
          />
        </Paper>
      )}

      {/* Current Line Display */}
      {currentLine && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mx: 2,
            mt: 2,
            bgcolor: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
            borderLeft: `3px solid ${getCharacterColor(currentLine.character)}`,
            borderRadius: 1,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <CharacterIcon sx={{ color: getCharacterColor(currentLine.character) }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {currentLine.character}
            </Typography>
            {currentLine.parenthetical && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontStyle: 'italic' }}
              >
                ({currentLine.parenthetical})
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Chip
              label={`Linje ${currentLine.lineNumber}`}
              size="small"
              variant="outlined"
            />
          </Stack>
          <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
            {currentLine.text}
          </Typography>
          {isPlaying && !isPaused && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WaveformIcon sx={{ color: 'primary.main', animation: 'pulse 1s infinite' }} />
              <Typography variant="caption" color="primary">
                Spiller av...
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Dialogue List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <List dense>
          {dialogueLines.map((line, idx) => (
            <ListItem
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                currentIndexRef.current = idx;
                onLineHighlight?.(line.lineNumber);
              }}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                cursor: 'pointer',
                bgcolor: idx === currentIndex
                  ? darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'
                  : 'transparent',
                '&:hover': {
                  bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                },
                borderLeft: `3px solid ${idx === currentIndex ? getCharacterColor(line.character) : 'transparent'}`,
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: getCharacterColor(line.character),
                    fontSize: '0.7rem',
                  }}
                >
                  {line.character.charAt(0)}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 80 }}>
                      {line.character}
                    </Typography>
                    {line.parenthetical && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                      >
                        ({line.parenthetical})
                      </Typography>
                    )}
                  </Stack>
                }
                secondary={
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                    }}
                  >
                    {line.text}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        {dialogueLines.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              opacity: 0.5,
            }}
          >
            <VoiceIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography>Ingen dialog funnet</Typography>
            <Typography variant="caption">
              Skriv dialog i manuset for table read
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TableReadPanel;
