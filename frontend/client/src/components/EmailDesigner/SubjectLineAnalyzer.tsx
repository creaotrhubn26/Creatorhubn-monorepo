import React, { useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Chip,
  LinearProgress,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandIcon,
  Psychology as AIIcon,
  TrendingUp as TrendIcon,
  EmojiEmotions as EmojiIcon,
} from '@mui/icons-material';

interface SubjectLineAnalyzerProps {
  subject: string;
  onSubjectChange: (newSubject: string) => void;
}

interface SubjectAnalysis {
  length: number;
  lengthScore: number;
  wordCount: number;
  hasEmoji: boolean;
  hasPersonalization: boolean;
  hasUrgency: boolean;
  hasNumbers: boolean;
  capsPercentage: number;
  estimatedOpenRate: number;
  strengths: string[];
  weaknesses: string[];
  aiSuggestions: Array<{
    text: string;
    reason: string;
    predictedOpenRate: number;
  }>;
}

const PERSONALIZATION_TOKENS = ['{{user_first_name}}', '{{user_name}}', '{{user_last_name}}'];
const URGENCY_WORDS = [
  'siste','nå','idag','haster','begrenset','snart','slutt','last','now','today','urgent','limited','soon','ending','hurry',
];
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

export default function SubjectLineAnalyzer({
  subject,
  onSubjectChange,
}: SubjectLineAnalyzerProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const analysis = useMemo((): SubjectAnalysis => {
    const length = subject.length;
    const words = subject.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Length score (ideal: 40-60 chars)
    let lengthScore = 100;
    if (length < 20) lengthScore = 30;
    else if (length < 30) lengthScore = 60;
    else if (length <= 60) lengthScore = 100;
    else if (length <= 70) lengthScore = 80;
    else lengthScore = 50;

    // Check for emoji
    const hasEmoji = EMOJI_REGEX.test(subject);

    // Check for personalization
    const hasPersonalization = PERSONALIZATION_TOKENS.some((token) => subject.includes(token));

    // Check for urgency
    const hasUrgency = URGENCY_WORDS.some((word) => subject.toLowerCase().includes(word));

    // Check for numbers
    const hasNumbers = /\d/.test(subject);

    // Caps percentage
    const capsCount = (subject.match(/[A-ZÆØÅ]/g) || []).length;
    const capsPercentage = subject.length > 0 ? (capsCount / subject.length) * 100 : 0;

    // Analyze strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (length >= 40 && length <= 60) {
      strengths.push('Optimal lengde (40-60 tegn)');
    }
    if (hasEmoji) {
      strengths.push('Inneholder emoji (øker synlighet)');
    }
    if (hasPersonalization) {
      strengths.push('Personalisert med variabel, ');
    }
    if (hasNumbers) {
      strengths.push('Inneholder tall (spesifikt)');
    }
    if (wordCount >= 4 && wordCount <= 7) {
      strengths.push('God ordtelling (4-7 ord)');
    }

    if (length < 30) {
      weaknesses.push('For kort emnelinje, ');
    } else if (length > 70) {
      weaknesses.push('For lang emnelinje (kuttes av på mobil)');
    }
    if (!hasEmoji && length < 50) {
      weaknesses.push('Vurder å legge til emoji for mer synlighet, ');
    }
    if (!hasPersonalization) {
      weaknesses.push('Mangler personalisering (bruk {{user_first_name})');
    }
    if (capsPercentage > 30) {
      weaknesses.push('For mange store bokstaver');
    }
    if (wordCount < 3) {
      weaknesses.push('For få ord (minst 3-4 anbefalt)');
    }
    if (!hasUrgency && !hasNumbers) {
      weaknesses.push('Mangler konkret verdi eller hasteelment');
    }

    // Estimate open rate based on factors
    let estimatedOpenRate = 20; // base rate
    if (length >= 40 && length <= 60) estimatedOpenRate += 5;
    if (hasEmoji) estimatedOpenRate += 3;
    if (hasPersonalization) estimatedOpenRate += 8;
    if (hasNumbers) estimatedOpenRate += 2;
    if (hasUrgency) estimatedOpenRate += 3;
    if (capsPercentage < 10) estimatedOpenRate += 2;
    if (wordCount >= 4 && wordCount <= 7) estimatedOpenRate += 3;

    // Generate AI suggestions
    const aiSuggestions = generateAISuggestions(subject, {
      hasEmoji,
      hasPersonalization,
      hasUrgency,
      hasNumbers,
      length,
    });

    return {
      length,
      lengthScore,
      wordCount,
      hasEmoji,
      hasPersonalization,
      hasUrgency,
      hasNumbers,
      capsPercentage,
      estimatedOpenRate: Math.min(45, estimatedOpenRate),
      strengths,
      weaknesses,
      aiSuggestions,
    };
  }, [subject]);

  const handleCopySuggestion = (text: string) => {
    onSubjectChange(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
          ✉️ Emnelinje-Analyse
        </Typography>
        <Chip
          label={`${Math.round(analysis.estimatedOpenRate)}% åpningsrate`}
          size="small"
          color={
            analysis.estimatedOpenRate > 30
              ? 'success'
              : analysis.estimatedOpenRate > 20
                ? 'warning'
                : 'error'
          }
          icon={<TrendIcon />}
        />
      </Box>

      {/* Length analysis */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Lengde: {analysis.length} tegn
          </Typography>
          <Typography
            variant="caption"
            color={analysis.length >= 40 && analysis.length <= 60 ? 'success.main' : 'warning.main'}
          >
            {analysis.wordCount} ord
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(analysis.length / 70) * 100}
          color={
            analysis.lengthScore > 80 ? 'success' : analysis.lengthScore > 50 ? 'warning' : 'error'
          }
          sx={{ height: 6, borderRadius: 3 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Ideelt: 40-60 tegn for best åpningsrate
        </Typography>
      </Box>

      {/* Feature indicators */}
      <Stack direction="row" spacing={1}, sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Chip
          label="Emoji"
          size="small"
          color={analysis.hasEmoji ? 'success' : 'default'}
          icon={analysis.hasEmoji ? <CheckIcon /> : <WarningIcon />}
        />
        <Chip
          label="Personalisering"
          size="small"
          color={analysis.hasPersonalization ? 'success' : 'default'}
          icon={analysis.hasPersonalization ? <CheckIcon /> : <WarningIcon />}
        />
        <Chip
          label="Hastelement"
          size="small"
          color={analysis.hasUrgency ? 'success' : 'default'}
          icon={analysis.hasUrgency ? <CheckIcon /> : <WarningIcon />}
        />
        <Chip
          label="Tall"
          size="small"
          color={analysis.hasNumbers ? 'success' : 'default'}
          icon={analysis.hasNumbers ? <CheckIcon /> : <WarningIcon />}
        />
      </Stack>

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="success.main"
            sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            ✓ Styrker
          </Typography>
          <Stack spacing={0.5}>
            {analysis.strengths.map((strength, index) => (
              <Typography
                key={index}
                variant="caption"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckIcon fontSize="inherit" color="success" /> {strength}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      {/* Weaknesses */}
      {analysis.weaknesses.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="warning.main"
            sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            ⚠ Forbedringsområder
          </Typography>
          <Stack spacing={0.5}>
            {analysis.weaknesses.map((weakness, index) => (
              <Typography
                key={index}
                variant="caption"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WarningIcon fontSize="inherit" color="warning" /> {weakness}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      {/* AI Suggestions */}
      <Box>
        <Button
          fullWidth
          size="small"
          startIcon={<AIIcon />}
          endIcon={
            <ExpandIcon
              sx={{ transform: showSuggestions ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
          }
          onClick={() => setShowSuggestions(!showSuggestions)}
          sx={{ mb: 1, justifyContent: 'space-between' }}>
          AI-Forslag ({analysis.aiSuggestions.length})
        </Button>

        <Collapse in={showSuggestions}>
          <List dense>
            {analysis.aiSuggestions.map((suggestion, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <Tooltip title={copied === suggestion.text ? 'Kopiert!' : 'Bruk dette'}>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleCopySuggestion(suggestion.text)}
                      color={copied === suggestion.text ? 'success' : 'default'}
                    >
                      {copied === suggestion.text ? <CheckIcon /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                }
                sx={{
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'divider'}}>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ pr: 4 }}>
                      {suggestion.text}
                    </Typography>
                  }
                  secondary={
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {suggestion.reason}
                      </Typography>
                      <Chip
                        label={`~${suggestion.predictedOpenRate}%`}
                        size="small"
                        sx={{ height: 18, fontSize: 10 }}
                        color={suggestion.predictedOpenRate > 30 ? 'success' : 'warning'}
                      />
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </Box>

      {/* Tips */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
          💡 Beste praksis
        </Typography>
        <Typography variant="caption" component="div">
          • 📏 Hold 40-60 tegn for best resultat
          <br />
          • 😊 Bruk 1 emoji for økt synlighet
          <br />
          • 👤 Personaliser med navn
          <br />
          • 🎯 Vær spesifikk (bruk tall)
          <br />
          • ⏰ Skape hastelement når relevant
          <br />• ✅ Test med A/B testing
        </Typography>
      </Box>
    </Paper>
  );
}

// Generate AI-powered suggestions based on current subject
function generateAISuggestions(
  subject: string,
  features: {
    hasEmoji: boolean;
    hasPersonalization: boolean;
    hasUrgency: boolean;
    hasNumbers: boolean;
    length: number;
  },
): Array<{ text: string; reason: string; predictedOpenRate: number }> {
  const suggestions = [];

  // If too short, suggest longer version
  if (features.length < 30) {
    suggestions.push({
      text: `${subject} - Se dine fantastiske bilder nå! 📸`,
      reason: 'Utvidet med emoji og call-to-action',
      predictedOpenRate: 32,
    });
  }

  // If no emoji, add one
  if (!features.hasEmoji) {
    const emojis = ['📸', '✨','🎉''💫', '🌟'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    suggestions.push({
      text: `${randomEmoji} ${subject}`,
      reason: 'Lagt til emoji for økt synlighet',
      predictedOpenRate: 28,
    });
  }

  // If no personalization, add it
  if (!features.hasPersonalization && subject.length < 50) {
    suggestions.push({
      text: `{{user_first_name}, ${subject.toLowerCase()}`,
      reason: 'Lagt til personalisering',
      predictedOpenRate: 35,
    });
  }

  // Add urgency if missing
  if (!features.hasUrgency) {
    suggestions.push({
      text: subject.length > 40 ? `${subject} - Siste sjanse!` : `${subject} - Tilgjengelig nå!`,
      reason: 'Lagt til hastelement',
      predictedOpenRate: 30,
    });
  }

  // Add numbers if missing
  if (!features.hasNumbers) {
    suggestions.push({
      text: `Se dine 50+ bilder fra ${subject.toLowerCase()}`,
      reason: 'Lagt til spesifikt tall',
      predictedOpenRate: 29,
    });
  }

  // Always include a "best practices" version
  suggestions.push({
    text: `📸 {{user_first_name}, dine bilder er klare!`,
    reason: 'Følger alle beste praksiser',
    predictedOpenRate: 38,
  });

  // Norwegian-specific suggestions
  suggestions.push({
    text: `Hei {{user_first_name}! Ditt bildegalleri er klart 🎉`,
    reason: 'Vennlig tone på norsk med personalisering',
    predictedOpenRate: 36,
  });

  return suggestions.slice(0, 5); // Return max 5 suggestions
}
