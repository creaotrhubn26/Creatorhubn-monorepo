import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  GraphicEq,
  SmartToy,
  RecordVoiceOver,
  MusicNote,
  Transcribe,
  Psychology,
  Person,
  CheckCircle,
} from '@mui/icons-material';
import { AIVisionService, AudioSceneAnalysis } from '@/services/ai-vision-service';

interface AudioFile {
  id: string;
  name: string;
  url: string;
  duration?: number;
}

interface AIAudioAnalysisPanelProps {
  currentAudio: AudioFile | null;
  onSpeakersDetected?: (speakers: number) => void;
  onSceneClassified?: (scene: AudioSceneAnalysis) => void;
  onTranscriptGenerated?: (transcript: string) => void;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export default function AIAudioAnalysisPanel({
  currentAudio,
  onSpeakersDetected,
  onSceneClassified,
  onTranscriptGenerated
}: AIAudioAnalysisPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioSceneAnalysis | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAnalyzeAudio = async () => {
    if (!currentAudio) return;
    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(currentAudio.url);
      const blob = await response.blob();
      const analysis = await AIVisionService.analyzeAudioScene(blob, {
        detectSpeakers: true,
        classifyMusic: true
      });

      setAudioAnalysis(analysis);
      onSceneClassified?.(analysis);
      if (analysis.speakers) {
        onSpeakersDetected?.(analysis.speakers);
      }
    } catch (err) {
      console.error('Audio analysis failed:', err);
      setError('Kunne ikke analysere lyden.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateTranscript = async () => {
    if (!currentAudio) return;
    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(currentAudio.url);
      const audioBlob = await response.blob();

      const formData = new FormData();
      formData.append('audio', audioBlob, currentAudio.name || 'audio.mp3');
      formData.append('language', audioAnalysis?.language || 'no');

      const whisperResponse = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!whisperResponse.ok) {
        const errorData = await whisperResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Transcription failed');
      }

      const responseData = await whisperResponse.json();
      const transcriptionData = responseData.data || responseData;
      const transcriptText = transcriptionData.text || '';
      const transcriptSegments = Array.isArray(transcriptionData.segments)
        ? transcriptionData.segments.map((segment: any) => ({
            start: Number(segment.start),
            end: Number(segment.end),
            text: String(segment.text || '')
          }))
        : [];

      setTranscript(transcriptText);
      setSegments(transcriptSegments);
      onTranscriptGenerated?.(transcriptText);
    } catch (err) {
      console.error('Transcript generation failed:', err);
      setError(err instanceof Error ? err.message : 'Transkripsjon feilet');
    } finally {
      setAnalyzing(false);
    }
  };

  const getSceneIcon = (type: string) => {
    switch (type) {
      case 'speech':
        return <RecordVoiceOver />;
      case 'music':
        return <MusicNote />;
      case 'mixed':
        return <GraphicEq />;
      default:
        return <GraphicEq />;
    }
  };

  const getMoodColor = (mood?: string): string => {
    const colors: Record<string, string> = {
      energetic: '#e74c3c',
      calm: '#3498db',
      emotional: '#9b59b6',
      joyful: '#f39c12'
    };
    return mood ? colors[mood] || '#95a5a6' : '#95a5a6';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartToy /> AI Audio Analysis
      </Typography>

      <Stack spacing={2}>
        {currentAudio && (
          <Card>
            <CardContent>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                {currentAudio.name}
              </Typography>
              <audio ref={audioRef} src={currentAudio.url} controls style={{ width: '100%' }} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2" fontWeight={600}>
                Analysis Tools
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<Psychology />}
                  onClick={handleAnalyzeAudio}
                  disabled={!currentAudio || analyzing}
                  sx={{ bgcolor: '#e74c3c' }}
                >
                  Analyze Audio
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Transcribe />}
                  onClick={handleGenerateTranscript}
                  disabled={!currentAudio || analyzing}
                >
                  Generate Transcript
                </Button>
              </Box>

              {analyzing && (
                <Box>
                  <LinearProgress sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Analyserer lyden...
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {error && <Alert severity="error">{error}</Alert>}

        {audioAnalysis && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Analysis Result
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  icon={getSceneIcon(audioAnalysis.type)}
                  label={`Scene: ${audioAnalysis.type}`}
                  variant="outlined"
                />
                {audioAnalysis.mood && (
                  <Chip
                    icon={<GraphicEq />}
                    label={`Mood: ${audioAnalysis.mood}`}
                    sx={{ bgcolor: getMoodColor(audioAnalysis.mood), color: '#fff' }}
                  />
                )}
                {audioAnalysis.language && (
                  <Chip icon={<RecordVoiceOver />} label={`Language: ${audioAnalysis.language}`} />
                )}
                {audioAnalysis.musicGenre && (
                  <Chip icon={<MusicNote />} label={`Genre: ${audioAnalysis.musicGenre}`} />
                )}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText
                    primary="Speakers"
                    secondary={audioAnalysis.speakers ? `${audioAnalysis.speakers} detected` : 'Not detected'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle />
                  </ListItemIcon>
                  <ListItemText
                    primary="Confidence"
                    secondary={`${Math.round(audioAnalysis.confidence * 100)}%`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        )}

        {transcript && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Transcript
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {transcript}
              </Typography>
              {segments.length > 0 && (
                <List dense sx={{ mt: 2 }}>
                  {segments.map((segment, index) => (
                    <ListItem key={`${segment.start}-${index}`}>
                      <ListItemIcon>
                        <GraphicEq />
                      </ListItemIcon>
                      <ListItemText
                        primary={segment.text}
                        secondary={`${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
