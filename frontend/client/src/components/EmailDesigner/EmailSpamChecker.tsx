import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface EmailTemplate {
  subject: string;
  preheader: string;
  components: Array<{
    type: string;
    content: {
      text?: string;
      url?: string;
    };
  }>;
}

interface SpamTrigger {
  type: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
}

interface SpamAnalysis {
  score: number; // 0-100 (lower is better, 0 = no spam indicators)
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  triggers: SpamTrigger[];
}

const SPAM_KEYWORDS = [
  'GRATIS', 'VINN', 'GARANTERT', 'KLIKK HER', 'KJØP NÅ', 'BEGRENSET TILBUD', 'SISTE SJANSE', '100%', 'RISIKOFO FRI', 'PENGER TILBAKE', 'INGEN RISIKO', 'FREE', 'WIN', 'GUARANTEED', 'CLICK HERE', 'BUY NOW', 'LIMITED OFFER', 'LAST CHANCE', 'MONEY BACK', 'NO RISK', 'ACT NOW', 'URGENT', 'CONGRATULATIONS',
];

const SUSPICIOUS_PHRASES = [
  'nigeriansk prins', 'nigerian prince', 'arv', 'inheritance', 'vunnet', 'won', 'lotteri', 'lottery', 'casino', 'viagra', 'kredittkort', 'credit card', 'bank account', 'bankkonto',
];

export default function EmailSpamChecker({ template }: { template: EmailTemplate }) {
  const analysis = useMemo((): SpamAnalysis => {
    const triggers: SpamTrigger[] = [];
    let score = 0;

    // Combine all text
    const allText = [
      template.subject,
      template.preheader,
      ...template.components.map((c) => c.content.text || ''),
    ].join('');

    const upperText = allText.toUpperCase();

    // 1. Excessive caps (CRITICAL)
    const capsRatio = (allText.match(/[A-ZÆØÅ]/g) || []).length / allText.length;
    if (capsRatio > 0.3) {
      score += 25;
      triggers.push({
        type: 'critical',
        message: `${Math.round(capsRatio * 100)}% av teksten er store bokstaver`,
        suggestion: 'Bruk normal setningsoppbygging. For mye bruk av store bokstaver trigge spam-filtre.',
      });
    } else if (capsRatio > 0.15) {
      score += 10;
      triggers.push({
        type: 'medium',
        message: `${Math.round(capsRatio * 100)}% av teksten er store bokstaver`,
        suggestion: 'Reduser bruken av store bokstaver for bedre leveringsrate.',
      });
    }

    // 2. Excessive exclamation marks
    const exclamationCount = (allText.match(/!/g) || []).length;
    if (exclamationCount > 5) {
      score += 15;
      triggers.push({
        type: 'high',
        message: `${exclamationCount} utropstegn i e-posten`,
        suggestion: 'Bruk maksimalt 1-2 utropstegn. For mange virker desperat og spam-aktig.',
      });
    } else if (exclamationCount > 3) {
      score += 5;
      triggers.push({
        type: 'medium',
        message: `${exclamationCount} utropstegn i e-posten`,
        suggestion: 'Reduser antall utropstegn til 1-2.',
      });
    }

    // 3. Spam keywords
    const foundKeywords = SPAM_KEYWORDS.filter((keyword) => upperText.includes(keyword));
    if (foundKeywords.length > 0) {
      score += foundKeywords.length * 8;
      triggers.push({
        type: foundKeywords.length > 2 ? 'critical' : 'high',
        message: `Spam-nøkkelord, funnet: ${foundKeywords.slice(0, 3).join(', ')}${foundKeywords.length > 3 ? '...' : ','}`,
        suggestion: 'Unngå typiske markedsføringsord som "GRATIS","VINN""GARANTERT" osv.',
      });
    }

    // 4. Suspicious phrases
    const foundSuspicious = SUSPICIOUS_PHRASES.filter((phrase) =>
      upperText.includes(phrase.toUpperCase())
    );
    if (foundSuspicious.length > 0) {
      score += 30;
      triggers.push({
        type: 'critical',
        message: 'Mistenkelige fraser funnet',
        suggestion: 'Fjern fraser som er assosiert med svindel og phishing.',
      });
    }

    // 5. No unsubscribe link
    const hasUnsubscribe =
      allText.toLowerCase().includes('avmeld') || allText.toLowerCase().includes('unsubscribe');
    if (!hasUnsubscribe) {
      score += 20;
      triggers.push({
        type: 'high',
        message: 'Mangler avmeldingslenke',
        suggestion: 'Legg til en avmeldingslenke i bunnen. Dette er lovpålagt for markedsførings-e-post.',
      });
    }

    // 6. Too many links
    const linkCount = template.components.filter(
      (c) => c.type === 'button' || c.content.url,
    ).length;
    if (linkCount > 10) {
      score += 15;
      triggers.push({
        type: 'high',
        message: `${linkCount} lenker i e-posten`,
        suggestion: 'Reduser antall lenker til 5-8 for bedre deliverability.',
      });
    } else if (linkCount > 15) {
      score += 25;
      triggers.push({
        type: 'critical',
        message: `${linkCount} lenker i e-posten (ekstremt høyt)`,
        suggestion: 'For mange lenker er et sterkt spam-signal. Begrens til maksimalt 10.',
      });
    }

    // 7. Subject line issues
    const subjectCapsRatio =
      (template.subject.match(/[A-ZÆØÅ]/g) || []).length / template.subject.length;
    if (subjectCapsRatio > 0.5) {
      score += 20;
      triggers.push({
        type: 'critical',
        message: 'Emnelinje med for mange store bokstaver',
        suggestion: 'Skriv emnelinje med normal setningsoppbygging.',
      });
    }

    // 8. Excessive numbers and special characters
    const numbersAndSpecial = (allText.match(/[0-9$£€%@#]/g) || []).length;
    const numbersRatio = numbersAndSpecial / allText.length;
    if (numbersRatio > 0.1) {
      score += 10;
      triggers.push({
        type: 'medium',
        message: 'Mange tall og spesialtegn',
        suggestion: 'Reduser bruk av tall, valutasymboler og spesialtegn.',
      });
    }

    // 9. URL shorteners (suspicious)
    const hasShortener = allText.match(/bit\.ly|tinyurl|goo\.gl|t\.co/i);
    if (hasShortener) {
      score += 15;
      triggers.push({
        type: 'high',
        message: 'URL-forkortere funnet (bit.ly, tinyurl osv)',
        suggestion: 'Bruk fulle, synlige URL-er. Forkortere er ofte assosiert med phishing.',
      });
    }

    // 10. Multiple currencies or prices
    const currencyCount = (allText.match(/kr|nok|\$|€|£/gi) || []).length;
    if (currencyCount > 5) {
      score += 8;
      triggers.push({
        type: 'medium',
        message: `${currencyCount} prisreferanser funnet`,
        suggestion: 'For mange priser kan virke spam-aktig. Fokuser på verdi, ikke bare pris.',
      });
    }

    // Cap score at 100
    score = Math.min(100, score);

    // Determine rating
    let rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    if (score <= 10) rating = 'excellent';
    else if (score <= 25) rating = 'good';
    else if (score <= 50) rating = 'fair';
    else if (score <= 75) rating = 'poor';
    else rating = 'critical';

    return { score, rating, triggers };
  }, [template]);

  const getRatingColor = (
    rating: string,
  ): 'success' | 'warning' | 'error' | 'info' => {
    switch (rating) {
      case 'excellent': return 'success';
      case 'good': return 'success';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      case 'critical': return 'error';
      default: return 'info';
    }
  };

  const getRatingText = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'Utmerket';
      case 'good': return 'God';
      case 'fair': return 'Middels';
      case 'poor': return 'Dårlig';
      case 'critical': return 'Kritisk';
      default: return 'Ukjent';
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'critical': return <ErrorIcon color="error" />;
      case 'high': return <WarningIcon color="error" />;
      case 'medium': return <WarningIcon color="warning" />;
      case 'low': return <InfoIcon color="info" />;
      default: return <InfoIcon />;
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        🛡️ Spam-Analyse
      </Typography>

      {/* Spam Score */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Spam-Score
          </Typography>
          <Chip
            label={getRatingText(analysis.rating)}
            size="small"
            color={getRatingColor(analysis.rating)}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 600}}>
            {analysis.score}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={analysis.score}
              color={getRatingColor(analysis.rating)}
              sx={{ height: 8, borderRadius: 4 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Lavere er bedre (0 = perfekt)
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Overall Status */}
      {analysis.score === 0 ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>
            Gratulerer! 🎉
          </Typography>
          <Typography variant="caption">
            Ingen spam-indikatorer funnet. E-posten har best mulig sjanse for levering.
          </Typography>
        </Alert>
      ) : analysis.score <= 25 ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>
            God leveringsrate forventet ✓
          </Typography>
          <Typography variant="caption">
            Få spam-indikatorer. E-posten bør leveres uten problemer.
          </Typography>
        </Alert>
      ) : analysis.score <= 50 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>
            Moderat risiko ⚠️
          </Typography>
          <Typography variant="caption">
            Noen spam-indikatorer funnet. Anbefaler forbedringer før utsendelse.
          </Typography>
        </Alert>
      ) : (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>
            Høy spam-risiko 🚨
          </Typography>
          <Typography variant="caption">
            Mange spam-indikatorer. E-posten vil sannsynligvis bli blokkert eller havne i
            spam-mappe.
          </Typography>
        </Alert>
      )}

      {/* Triggers */}
      {analysis.triggers.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            Funnet {analysis.triggers.length} problem{analysis.triggers.length !== 1 ? 'er' : ', '}
          </Typography>

          <List dense>
            {analysis.triggers.map((trigger, index) => (
              <ListItem
                key={index}
                sx={{
                  px: 0,
                  borderLeft: `3px solid`,
                  borderColor: trigger.type === 'critical'
                      ? 'error.main'
                      : trigger.type === 'high'
                        ? 'error.light'
                        : trigger.type === 'medium'
                          ? 'warning.main'
                          : 'info.main',
                  pl: 2,
                  mb: 1,
                  bgcolor: trigger.type === 'critical'
                      ? 'error.lighter'
                      : trigger.type === 'high'
                        ? 'error.lighter'
                        : trigger.type === 'medium'
                          ? 'warning.lighter' : 'info.lighter',
                  borderRadius: '0 4px 4px 0'}}>
                <ListItemIcon sx={{ minWidth: 36 }}>{getTriggerIcon(trigger.type)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {trigger.message}
                    </Typography>
                  }
                  secondary={<Typography variant="caption">💡 {trigger.suggestion}</Typography>}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Tips */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
          💡 Tips for god levering
        </Typography>
        <Typography variant="caption" component="div">
          • Bruk personens navn i emne og innhold
          <br />
          • Inkluder alltid avmeldingslenke
          <br />
          • Hold emnelinje under 60 tegn
          <br />
          • Unngå spam-ord som"GRATIS""VINN" osv
          <br />
          • Test e-posten før masseutsendelse
          <br />• Bruk autentisert domene (SPF, DKIM, DMARC)
        </Typography>
      </Box>
    </Paper>
  );
}
