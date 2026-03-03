import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoFixHigh,
  CheckCircle,
  CompareArrows,
  ContentCopy,
  Psychology,
  SpellcheckRounded,
  TuneRounded,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

type EnhancementType = 'professional' | 'concise' | 'friendly' | 'formal';

interface QuillBotEnhancerProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  onTextEnhanced: (enhancedText: string) => void;
  profession: string;
}

interface EnhancementStats {
  wordsChanged: number;
  readabilityScore: number;
  originalLength: number;
  enhancedLength: number;
}

const enhancementLabels: Record<EnhancementType, string> = {
  professional: 'Profesjonell',
  concise: 'Kortfattet',
  friendly: 'Vennlig',
  formal: 'Formell',
};

async function requestEnhancement(
  originalText: string,
  enhancementType: EnhancementType,
  profession: string,
): Promise<{ enhancedText: string; wordsChanged: number; readabilityScore: number }> {
  const response = await fetch('/api/meeting-notes/enhance-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: originalText,
      enhancementType,
      profession,
      targetAudience: 'client',
    }),
  });

  if (!response.ok) {
    throw new Error('Enhancement request failed');
  }

  const data = (await response.json()) as {
    success?: boolean;
    enhancedText?: string;
    wordsChanged?: number;
    readabilityScore?: number;
  };

  if (data.success && typeof data.enhancedText === 'string') {
    return {
      enhancedText: data.enhancedText,
      wordsChanged: Math.abs(data.wordsChanged ?? 0),
      readabilityScore: data.readabilityScore ?? 75,
    };
  }

  throw new Error('Invalid enhancement response');
}

function localFallbackEnhancement(text: string, mode: EnhancementType): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return normalized;
  }

  const lines = normalized.split('. ');
  const polished = lines.map((line) => {
    const sentence = line.trim();
    if (!sentence) return sentence;

    switch (mode) {
      case 'concise':
        return sentence
          .replace(/\bveldig\b/gi, '')
          .replace(/\bfaktisk\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      case 'friendly':
        return sentence.replace(/\bskal\b/gi, 'kan').replace(/\bmå\b/gi, 'bør');
      case 'formal':
        return sentence.replace(/\bhei\b/gi, 'god dag').replace(/\bdu\b/gi, 'De');
      case 'professional':
      default:
        return sentence
          .replace(/\bbra\b/gi, 'solid')
          .replace(/\bkult\b/gi, 'relevant')
          .trim();
    }
  });

  return polished.filter(Boolean).join('. ').trim();
}

export function QuillBotEnhancer({
  open,
  onClose,
  originalText,
  onTextEnhanced,
  profession,
}: QuillBotEnhancerProps): JSX.Element {
  const theming = useTheming('prototype_tester');
  const [enhancementType, setEnhancementType] = useState<EnhancementType>('professional');
  const [enhancedText, setEnhancedText] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EnhancementStats>({
    wordsChanged: 0,
    readabilityScore: 0,
    originalLength: 0,
    enhancedLength: 0,
  });

  const originalWordCount = useMemo(() => {
    const trimmed = originalText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [originalText]);

  const enhancedWordCount = useMemo(() => {
    const trimmed = enhancedText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [enhancedText]);

  const handleEnhance = async (): Promise<void> => {
    if (!originalText.trim()) {
      return;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      const response = await requestEnhancement(originalText, enhancementType, profession);
      setEnhancedText(response.enhancedText);
      setStats({
        wordsChanged: response.wordsChanged,
        readabilityScore: response.readabilityScore,
        originalLength: originalText.length,
        enhancedLength: response.enhancedText.length,
      });
    } catch {
      const fallback = localFallbackEnhancement(originalText, enhancementType);
      setEnhancedText(fallback);
      setStats({
        wordsChanged: Math.abs(originalWordCount - (fallback.trim() ? fallback.trim().split(/\s+/).length : 0)),
        readabilityScore: 70,
        originalLength: originalText.length,
        enhancedLength: fallback.length,
      });
      setError('Live forbedring utilgjengelig. Viste lokal fallback-forbedring i stedet.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAcceptEnhancement = (): void => {
    if (!enhancedText.trim()) {
      return;
    }

    onTextEnhanced(enhancedText);
    onClose();
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <AutoFixHigh color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Intelligent Tekstforbedring
          </Typography>
          <Chip label={profession} size="small" variant="outlined" />
        </Box>
      </DialogTitle>

      <DialogContent>
        {isEnhancing && <LinearProgress sx={{ mb: 2 }} />}

        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ color: theming.colors.primary }}>
                Original tekst
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={10}
                value={originalText}
                InputProps={{ readOnly: true }}
              />
            </CardContent>
          </Card>

          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ color: theming.colors.primary }}>
                Forbedret tekst
              </Typography>
              <TextField fullWidth multiline minRows={10} value={enhancedText} onChange={(event) => setEnhancedText(event.target.value)} />
            </CardContent>
          </Card>
        </Box>

        <Box mt={2} display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="enhancement-type-label">Forbedringsmodus</InputLabel>
            <Select
              labelId="enhancement-type-label"
              label="Forbedringsmodus"
              value={enhancementType}
              onChange={(event) => setEnhancementType(event.target.value as EnhancementType)}
            >
              {Object.entries(enhancementLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" onClick={() => void handleEnhance()} disabled={isEnhancing} startIcon={<Psychology />}>
            Forbedre tekst
          </Button>

          <Button variant="outlined" onClick={() => void copyToClipboard(enhancedText)} startIcon={<ContentCopy />} disabled={!enhancedText.trim()}>
            Kopier
          </Button>
        </Box>

        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          <Chip icon={<CompareArrows />} label={`Ord endret: ${stats.wordsChanged}`} />
          <Chip icon={<SpellcheckRounded />} label={`Lesbarhet: ${stats.readabilityScore}`} />
          <Chip icon={<TuneRounded />} label={`Lengde: ${stats.originalLength} -> ${stats.enhancedLength}`} />
          <Chip icon={<CheckCircle />} label={`Ord: ${originalWordCount} -> ${enhancedWordCount}`} />
        </Box>

        {error && (
          <Box mt={2}>
            <Typography variant="body2" color="warning.main">
              {error}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={handleAcceptEnhancement} disabled={!enhancedText.trim()}>
          Bruk forbedret tekst
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default QuillBotEnhancer;
