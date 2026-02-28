import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  LinearProgress,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import { Close, Subtitles } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface CaptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

interface CaptionsResponse {
  captions: CaptionSegment[];
  formats: {
    srt: string;
    vtt: string;
  };
  language: string;
}

interface TranscriptionJobResponse {
  success: boolean;
  job_id?: string;
}

interface TranscriptionJobStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: {
    transcription?: {
      language?: string;
      segments?: Array<{
        id?: number;
        start?: number;
        end?: number;
        text?: string;
        confidence?: number;
      }>;
    };
  };
  error?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toCaptionTimestamp = (seconds: number, decimalSeparator: '.' | ','): string => {
  const normalized = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMilliseconds = Math.round(normalized * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const millis = totalMilliseconds % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}${decimalSeparator}${String(millis).padStart(3, '0')}`;
};

const exportToSRT = (captions: CaptionSegment[]): string => {
  return captions
    .map(
      (caption, index) =>
        `${index + 1}\n${toCaptionTimestamp(caption.start, ',')} --> ${toCaptionTimestamp(
          caption.end,
          ','
        )}\n${caption.text.trim()}\n`
    )
    .join('\n');
};

const exportToVTT = (captions: CaptionSegment[]): string => {
  const body = captions
    .map(
      (caption) =>
        `${toCaptionTimestamp(caption.start, '.')} --> ${toCaptionTimestamp(
          caption.end,
          '.'
        )}\n${caption.text.trim()}\n`
    )
    .join('\n');
  return `WEBVTT\n\n${body}`;
};

const normalizeCaptionSegments = (rawSegments: unknown): CaptionSegment[] => {
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments
    .map((segment, index) => {
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null;
      const confidenceRaw = Number(segment?.confidence);
      const confidence = Number.isFinite(confidenceRaw)
        ? Math.max(0, Math.min(1, confidenceRaw))
        : 1;
      return {
        id: Number.isFinite(Number(segment?.id)) ? Number(segment?.id) : index + 1,
        start,
        end: end >= start ? end : start,
        text,
        confidence,
      };
    })
    .filter((segment): segment is CaptionSegment => Boolean(segment));
};

const AutoCaptionService = {
  generateViaCompatibilityRoute: async (videoPath: string, language: string): Promise<CaptionsResponse> => {
    const response = await apiRequest('/api/video/generate-captions', {
      method: 'POST',
      body: { videoPath, language },
    });

    if (!Array.isArray(response?.captions) || !response?.formats?.srt || !response?.formats?.vtt) {
      throw new Error('Caption service returned an invalid payload');
    }

    return {
      captions: response.captions as CaptionSegment[],
      formats: {
        srt: String(response.formats.srt),
        vtt: String(response.formats.vtt),
      },
      language: typeof response.language === 'string' ? response.language : language,
    };
  },
};

const resolveCaptionVideoPath = async (videoPath: string): Promise<string> => {
  const trimmedPath = videoPath.trim();
  if (!trimmedPath) {
    return '';
  }

  const normalizedPath = trimmedPath.toLowerCase();
  const isBlobSource = normalizedPath.startsWith('blob:');
  const shouldProxyViaUploadEndpoint =
    isBlobSource ||
    normalizedPath.startsWith('data:') ||
    normalizedPath.startsWith('http://') ||
    normalizedPath.startsWith('https://') ||
    normalizedPath.startsWith('/api/') ||
    normalizedPath.startsWith('/uploads/') ||
    normalizedPath.startsWith('/media/');

  if (!shouldProxyViaUploadEndpoint) {
    return trimmedPath;
  }

  const sourceResponse = await fetch(trimmedPath, {
    credentials: 'include',
  });
  if (!sourceResponse.ok) {
    throw new Error(`Unable to read selected video source (${sourceResponse.status})`);
  }

  const sourceContentType = (sourceResponse.headers.get('content-type') || '').toLowerCase();
  if (
    !isBlobSource &&
    (sourceContentType.includes('application/json') ||
      sourceContentType.includes('text/html') ||
      sourceContentType.includes('text/plain'))
  ) {
    throw new Error('Selected clip source is not a direct media file');
  }

  const videoBlob = await sourceResponse.blob();
  if (videoBlob.size === 0) {
    throw new Error('Selected video source is empty');
  }

  const formData = new FormData();
  const extensionFromPathMatch = trimmedPath.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  const extensionFromPath = extensionFromPathMatch ? extensionFromPathMatch[1].toLowerCase() : '';
  const extensionFromMime = (() => {
    const type = (videoBlob.type || sourceContentType || '').toLowerCase();
    if (type.includes('webm')) return 'webm';
    if (type.includes('quicktime')) return 'mov';
    if (type.includes('x-matroska')) return 'mkv';
    if (type.includes('wav')) return 'wav';
    if (type.includes('mp3') || type.includes('mpeg')) return 'mp3';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('aac')) return 'aac';
    if (type.includes('flac')) return 'flac';
    return 'mp4';
  })();
  const extension = extensionFromPath || extensionFromMime;
  formData.append('video', videoBlob, `storyarc-caption-source-${Date.now()}.${extension}`);

  const uploadResponse = await fetch('/api/video-analysis/upload-source', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const payload = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !payload?.success || typeof payload?.video_path !== 'string') {
    const message =
      typeof payload?.error === 'string' ? payload.error : 'Failed to prepare video for captions';
    throw new Error(message);
  }

  return payload.video_path;
};

const resolveCaptionVideoFile = async (sourceFile: File): Promise<string> => {
  if (!(sourceFile instanceof File)) {
    throw new Error('Selected caption source file is invalid');
  }

  if (sourceFile.size === 0) {
    throw new Error(`Selected caption source file is empty (${sourceFile.name || 'unnamed'})`);
  }

  const formData = new FormData();
  formData.append('video', sourceFile, sourceFile.name || `storyarc-caption-source-${Date.now()}.mp4`);

  const uploadResponse = await fetch('/api/video-analysis/upload-source', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const payload = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !payload?.success || typeof payload?.video_path !== 'string') {
    const message =
      typeof payload?.error === 'string' ? payload.error : 'Failed to prepare video for captions';
    throw new Error(message);
  }

  return payload.video_path;
};

interface AutoCaptionsPanelProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  sourceVideoFile?: File | null;
  fallbackVideoPaths?: string[];
  fallbackVideoFiles?: File[];
  onCaptionsGenerated: (captions: CaptionSegment[], srt: string, vtt: string) => void;
}

export default function AutoCaptionsPanel({
  open,
  onClose,
  videoPath,
  sourceVideoFile = null,
  fallbackVideoPaths = [],
  fallbackVideoFiles = [],
  onCaptionsGenerated
}: AutoCaptionsPanelProps) {
  const [language, setLanguage] = useState('en');
  const [style, setStyle] = useState('modern');

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'no', name: 'Norwegian' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' }
  ];

  const styles = ['modern', 'minimal', 'bold', 'elegant'];

  const transcribeResolvedVideoPath = async (
    resolvedVideoPath: string,
    requestedLanguage: string
  ): Promise<CaptionsResponse> => {
    try {
      const response = (await apiRequest('/api/video-analysis/transcribe', {
        method: 'POST',
        body: {
          video_path: resolvedVideoPath,
          language: requestedLanguage,
          model_size: 'base',
          word_timestamps: true,
        },
      })) as TranscriptionJobResponse;

      if (!response.success || !response.job_id) {
        throw new Error('Could not start transcription job');
      }

      const maxAttempts = 120;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await delay(1500);
        const statusResponse = (await apiRequest(
          `/api/video-analysis/transcribe/${response.job_id}`
        )) as TranscriptionJobStatusResponse;

        if (statusResponse.status === 'completed') {
          const transcription = statusResponse.result?.transcription;
          const captions = normalizeCaptionSegments(transcription?.segments);
          if (captions.length === 0) {
            throw new Error('Transcription completed, but no caption segments were returned');
          }

          return {
            captions,
            formats: {
              srt: exportToSRT(captions),
              vtt: exportToVTT(captions),
            },
            language:
              typeof transcription?.language === 'string' && transcription.language.length > 0
                ? transcription.language
                : requestedLanguage,
          };
        }

        if (statusResponse.status === 'failed') {
          throw new Error(statusResponse.error || 'Transcription failed');
        }
      }

      throw new Error('Transcription timed out');
    } catch (error) {
      console.warn('Primary transcription route failed, trying compatibility route:', error);
    }

    return AutoCaptionService.generateViaCompatibilityRoute(resolvedVideoPath, requestedLanguage);
  };

  const generateMutation = useMutation({
    mutationFn: async (): Promise<CaptionsResponse> => {
      const candidateFiles = [sourceVideoFile, ...fallbackVideoFiles]
        .filter((candidate): candidate is File => candidate instanceof File)
        .filter((candidate, index, all) => {
          const key = `${candidate.name}:${candidate.size}:${candidate.lastModified}`;
          return (
            all.findIndex(
              (entry) => `${entry.name}:${entry.size}:${entry.lastModified}` === key
            ) === index
          );
        });

      const candidatePaths = [videoPath, ...fallbackVideoPaths]
        .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
        .filter(Boolean);

      if (candidateFiles.length === 0 && candidatePaths.length === 0) {
        throw new Error('No video source selected. Add/select a clip first.');
      }

      const requestedLanguage = language === 'auto' ? 'no' : language;
      let lastError: Error | null = null;

      for (const candidateFile of candidateFiles) {
        const fileLabel = candidateFile.name || `file-${candidateFile.size}`;
        try {
          const resolvedVideoPath = await resolveCaptionVideoFile(candidateFile);
          return await transcribeResolvedVideoPath(resolvedVideoPath, requestedLanguage);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          lastError = new Error(`${normalizedError.message} (source file: ${fileLabel})`);
          console.warn('Caption source file candidate failed:', fileLabel, normalizedError.message);
        }
      }

      for (const candidatePath of candidatePaths) {
        try {
          const resolvedVideoPath = await resolveCaptionVideoPath(candidatePath);
          return await transcribeResolvedVideoPath(resolvedVideoPath, requestedLanguage);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          lastError = new Error(`${normalizedError.message} (source: ${candidatePath})`);
          console.warn('Caption source candidate failed:', candidatePath, normalizedError.message);
        }
      }

      throw (
        lastError ||
        new Error('No usable video source selected. Add/select a clip with a direct media source.')
      );
    },
    onSuccess: (data) => {
      onCaptionsGenerated(data.captions, data.formats.srt, data.formats.vtt);
      onClose();
    },
  });

  const errorMessage =
    generateMutation.error instanceof Error
      ? generateMutation.error.message
      : generateMutation.isError
        ? 'Caption generation failed'
        : '';

  const hasVideoSource =
    sourceVideoFile instanceof File ||
    [videoPath, ...fallbackVideoPaths].some(
      (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="auto-captions-dialog">
      <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" justifyContent="space-between">
          <Box>
            <Typography variant="h6">Auto-Captions</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>OpenAI Whisper - 80+ languages</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            AI will transcribe your video and generate word-level captions automatically.
          </Typography>
        </Alert>

        {!hasVideoSource && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Select a video clip before generating captions.
          </Alert>
        )}

        {generateMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Language</InputLabel>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} label="Language">
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>{lang.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Style</InputLabel>
          <Select value={style} onChange={(e) => setStyle(e.target.value)} label="Style">
            {styles.map((s) => (
              <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {generateMutation.isPending && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Generating captions...</Typography>
            <LinearProgress />
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Chip label="Word-level timestamps" size="small" />
          <Chip label="SRT/VTT export" size="small" />
          <Chip label="On-screen text OCR" size="small" />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          data-testid="auto-captions-generate"
          variant="contained"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || !hasVideoSource}
          startIcon={<Subtitles />}
        >
          Generate Captions
        </Button>
      </DialogActions>
    </Dialog>
  );
}
