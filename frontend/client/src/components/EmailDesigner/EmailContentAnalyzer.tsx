import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Box,
  LinearProgress,
  Tooltip,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { analyzeText } from '@/components/admin/Creatorhubnotesnew';

interface EmailTemplate {
  subject: string;
  preheader: string;
  components: Array<{
    type: string;
    content: {
      text?: string;
      url?: string;
      src?: string;
      alt?: string;
    };
  }>;
}

interface EmailContentAnalyzerProps {
  template: EmailTemplate;
}

interface EmailAnalytics {
  // Text metrics
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  readingTime: number;

  // Email-specific
  subjectLength: number;
  subjectScore: number;
  preheaderLength: number;
  preheaderScore: number;
  linkCount: number;
  imageCount: number;

  // Quality indicators
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
  }>;
}

export default function EmailContentAnalyzer({ template }: EmailContentAnalyzerProps) {
  const analytics = useMemo((): EmailAnalytics => {
    // Combine all text content
    const bodyText = template.components.map((c) => c.content.text || '').join(',');

    const textStats = analyzeText(bodyText);

    // Count links and images
    const linkCount = template.components.filter(
      (c) => c.type === 'button' || (c.type === 'text' && c.content.text?.includes('<a')),
    ).length;

    const imageCount = template.components.filter((c) => c.type === 'image').length;

    // Subject line analysis
    const subjectLength = template.subject.length;
    const idealSubjectLength = 50;
    const subjectScore =
      subjectLength >= 40 && subjectLength <= 60
        ? 100
        : Math.max(0, 100 - Math.abs(idealSubjectLength - subjectLength) * 3);

    // Preheader analysis
    const preheaderLength = template.preheader.length;
    const idealPreheaderLength = 90;
    const preheaderScore =
      preheaderLength >= 70 && preheaderLength <= 100
        ? 100
        : Math.max(0, 100 - Math.abs(idealPreheaderLength - preheaderLength) * 2);

    // Detect issues
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = [];

    if (subjectLength === 0) {
      issues.push({ type: 'error', message: 'Mangler emnelinje' });
    } else if (subjectLength < 30) {
      issues.push({ type: 'warning', message: 'Emnelinje er for kort (< 30 tegn)' });
    } else if (subjectLength > 70) {
      issues.push({ type: 'warning', message: 'Emnelinje er for lang (> 70 tegn)' });
    }

    if (preheaderLength === 0) {
      issues.push({ type: 'warning', message: 'Mangler forhåndsvisningstekst' });
    }

    if (linkCount === 0) {
      issues.push({ type: 'info', message: 'Ingen lenker i e-posten' });
    } else if (linkCount > 10) {
      issues.push({ type: 'warning', message: 'For mange lenker kan påvirke spam-score' });
    }

    if (imageCount === 0) {
      issues.push({ type: 'info', message: 'Ingen bilder i e-posten' });
    }

    // Check for missing alt text
    const imagesWithoutAlt = template.components.filter(
      (c) => c.type === 'image' && !c.content.alt,
    ).length;

    if (imagesWithoutAlt > 0) {
      issues.push({
        type: 'warning',
        message: `${imagesWithoutAlt} bilde(r) mangler alt-tekst (tilgjengelighet)`,
      });
    }

    // Check word count
    if (textStats.words > 500) {
      issues.push({ type: 'warning', message: 'E-posten er lang (> 500 ord)' });
    }

    return {
      ...textStats,
      subjectLength,
      subjectScore,
      preheaderLength,
      preheaderScore,
      linkCount,
      imageCount,
      issues,
    };
  }, [template]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getIssueIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error': return <ErrorIcon color="error" fontSize="small" />;
      case 'warning': return <WarningIcon color="warning" fontSize="small" />;
      case 'info': return <InfoIcon color="info" fontSize="small" />;
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        📊 Innholdsanalyse
      </Typography>

      {/* Main metrics */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <Tooltip title="Ideelt: 40-60 tegn for best åpningsrate">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Emnelinje
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">{analytics.subjectLength}</Typography>
                <Chip
                  label={`${Math.round(analytics.subjectScore)}%`}
                  size="small"
                  color={getScoreColor(analytics.subjectScore)}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={analytics.subjectScore}
                color={getScoreColor(analytics.subjectScore)}
                sx={{ mt: 0.5, height: 6, borderRadius: 3 }} />
            </Box>
          </Tooltip>
        </Grid>

        <Grid item xs={6}>
          <Tooltip title="Ideelt: 70-100 tegn">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Forhåndsvisning
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">{analytics.preheaderLength}</Typography>
                <Chip
                  label={`${Math.round(analytics.preheaderScore)}%`}
                  size="small"
                  color={getScoreColor(analytics.preheaderScore)}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={analytics.preheaderScore}
                color={getScoreColor(analytics.preheaderScore)}
                sx={{ mt: 0.5, height: 6, borderRadius: 3 }} />
            </Box>
          </Tooltip>
        </Grid>

        <Grid item xs={3}>
          <Typography variant="caption" color="text.secondary">
            Ord
          </Typography>
          <Typography variant="h6">{analytics.words}</Typography>
        </Grid>

        <Grid item xs={3}>
          <Typography variant="caption" color="text.secondary">
            Tegn
          </Typography>
          <Typography variant="h6">{analytics.characters}</Typography>
        </Grid>

        <Grid item xs={3}>
          <Typography variant="caption" color="text.secondary">
            Lesetid
          </Typography>
          <Typography variant="h6">{analytics.readingTime} min</Typography>
        </Grid>

        <Grid item xs={3}>
          <Typography variant="caption" color="text.secondary">
            Avsnitt
          </Typography>
          <Typography variant="h6">{analytics.paragraphs}</Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Lenker
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{analytics.linkCount}</Typography>
            {analytics.linkCount > 0 && analytics.linkCount <= 5 && (
              <CheckIcon color="success" fontSize="small" />
            )}
            {analytics.linkCount > 10 && <WarningIcon color="warning" fontSize="small" />}
          </Box>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Bilder
          </Typography>
          <Typography variant="h6">{analytics.imageCount}</Typography>
        </Grid>
      </Grid>

      {/* Issues */}
      {analytics.issues.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Anbefalinger
          </Typography>
          <Stack spacing={1}>
            {analytics.issues.map((issue, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  p: 1,
                  bgcolor: issue.type === 'error'
                      ? 'error.lighter'
                      : issue.type === 'warning'
                        ? 'warning.lighter'
                        : 'info.lighter',
                  borderRadius: 1}}>
                {getIssueIcon(issue.type)}
                <Typography variant="caption" sx={{ flex: 1 }}>
                  {issue.message}
                </Typography>
              </Box>
            ))}
          </Stack>
        </>
      )}

      {/* Overall score */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" fontWeight={600}>
            Samlet kvalitet
          </Typography>
          <Chip
            label={
              analytics.issues.filter((i) => i.type === 'error').length === 0
                ? 'God'
                : 'Trenger forbedring'
            }
            size="small"
            color={
              analytics.issues.filter((i) => i.type === 'error').length === 0
                ? 'success' : 'warning'
            }
          />
        </Box>
      </Box>
    </Paper>
  );
}
