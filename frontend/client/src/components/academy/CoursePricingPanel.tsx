/**
 * Course Pricing Panel
 * Allows instructors to set course prices and see revenue projections
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Divider,
  Chip,
  Alert,
  Grid,
  InputAdornment,
  Slider,
  Paper,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  AttachMoney,
  TrendingUp,
  Info,
  CheckCircle,
  Warning,
  AutoAwesome,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import {
  calculateRevenueSplit,
  calculateEarningsProjection,
  formatNOK,
  nokToOre,
  oreToNok,
  suggestCoursePrice,
  InstructorPlan,
} from '@shared/revenue-calculator';

interface CoursePricingPanelProps {
  courseId: string;
  courseTitle: string;
  videoCount: number;
  totalDurationMinutes: number;
  hasQuizzes: boolean;
  hasCertificate: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  instructorPlan: InstructorPlan;
  currentPriceOre?: number;
  onSave: (priceOre: number) => void;
  onCancel: () => void;
}

const CoursePricingPanel: React.FC<CoursePricingPanelProps> = ({
  courseId,
  courseTitle,
  videoCount,
  totalDurationMinutes,
  hasQuizzes,
  hasCertificate,
  difficulty,
  instructorPlan,
  currentPriceOre,
  onSave,
  onCancel,
}) => {
  const theming = useTheming('music_producer');
  const { analytics } = useEnhancedMasterIntegration();

  const [priceNOK, setPriceNOK] = useState<number>(
    currentPriceOre ? oreToNok(currentPriceOre) : 499,
  );
  const [expectedStudents, setExpectedStudents] = useState<number>(30);
  const [showSuggestion, setShowSuggestion] = useState<boolean>(false);

  // Calculate suggested price
  const suggestion = suggestCoursePrice(
    videoCount,
    totalDurationMinutes,
    hasQuizzes,
    hasCertificate,
    difficulty,
  );

  // Calculate revenue split
  const priceOre = nokToOre(priceNOK);
  const split = calculateRevenueSplit(priceOre, instructorPlan);
  const projection = calculateEarningsProjection(priceOre, expectedStudents, instructorPlan);

  // Track panel usage
  useEffect(() => {
    analytics.trackEvent('course_pricing_panel_opened,', {
      courseId,
      currentPrice: currentPriceOre,
      instructorPlan,
      timestamp: Date.now(),
    });
  }, [courseId, currentPriceOre, instructorPlan, analytics]);

  const handlePriceChange = (value: number) => {
    setPriceNOK(value);
    analytics.trackEvent('course_price_adjusted,', {
      courseId,
      newPrice: value,
      timestamp: Date.now(),
    });
  };

  const handleUseSuggestion = () => {
    setPriceNOK(suggestion.suggestedPriceNOK);
    setShowSuggestion(false);
    analytics.trackEvent('course_price_suggestion_accepted', {
      courseId,
      suggestedPrice: suggestion.suggestedPriceNOK,
      timestamp: Date.now(),
    });
  };

  const handleSave = () => {
    onSave(priceOre);
    analytics.trackEvent('course_pricing_saved', {
      courseId,
      priceNOK,
      priceOre,
      platformFee: split.platformFeeNOK,
      instructorRevenue: split.instructorRevenueNOK,
      timestamp: Date.now(),
    });
  };

  // Check if instructor can monetize
  const canMonetize = instructorPlan === 'pro' || instructorPlan === 'enterprise';

  if (!canMonetize) {
    return (
      <Card sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <CardContent>
          <Alert severity="warning" icon={<Warning />}>
            <Typography variant="h6" gutterBottom>
              Oppgrader for å selge kurs
            </Typography>
            <Typography variant="body2">
              Du må ha Pro eller Enterprise plan for å kunne selge kurs og tjene penger. Oppgrader
              nå for å låse opp kursmonetisering!
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2, ...theming.getThemedButtonSx() }}
              href="/settings?tab=billing"
            >
              Oppgrader til Pro
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ fontWeight: 'bold', color: theming.colors.primary }}
      >
        Sett Kurspris
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {courseTitle}
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column: Price Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <AttachMoney />
                Prissetting
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* Price Input */}
              <TextField
                label="Kurspris"
                type="number"
                value={priceNOK}
                onChange={(e) => handlePriceChange(Number(e.target.value))}
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">NOK</InputAdornment>}}
                sx={{ mb: 3 }}
                helperText={`Anbefalt pris: ${suggestion.suggestedPriceNOK} NOK`}
              />

              {/* Price Slider */}
              <Typography variant="body2" gutterBottom color="text.secondary">
                Juster pris med slider:
              </Typography>
              <Slider
                value={priceNOK}
                onChange={(_, value) => handlePriceChange(value as number)}
                min={99}
                max={2999}
                step={50}
                marks={[
                  { value: 99, label: '99' },
                  { value: 499, label: '499' },
                  { value: 999, label: '999' },
                  { value: 1999, label: '1999' },
                  { value: 2999, label: '2999' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} NOK`}
                sx={{ mb: 3 }}
              />

              {/* AI Suggestion */}
              <Paper
                sx={{ p: 2, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AutoAwesome sx={{ color: 'info.dark', mr: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                    AI Prisanbefaling
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'info.dark', mb: 1 }}>
                  Basert på kursinnhold: <strong>{suggestion.suggestedPriceNOK} NOK</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mb: 2 }}>
                  {suggestion.reasoning}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleUseSuggestion}
                  sx={{ borderColor: 'info.dark', color: 'info.dark' }}
                >
                  Bruk anbefalt pris
                </Button>
              </Paper>

              {/* Expected Students */}
              <Typography variant="body2" gutterBottom color="text.secondary" sx={{ mt: 3 }}>
                Forventet antall studenter (for projeksjon):
              </Typography>
              <TextField
                type="number"
                value={expectedStudents}
                onChange={(e) => setExpectedStudents(Number(e.target.value))}
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">studenter</InputAdornment>}}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Revenue Breakdown */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.dark' }}
              >
                <TrendingUp />
                Inntektsoversikt
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* Per Student Breakdown */}
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.dark' }}>
                Per student:
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Kurspris:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {formatNOK(split.totalPrice)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    Platform Fee ({split.platformFeePercentage}%):
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    -{formatNOK(split.platformFee)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    pt: 1,
                    borderTop: '1px solid',
                    borderColor: 'success.dark'}}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                    Du tjener ({split.instructorRevenuePercentage}%):
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                    {formatNOK(split.instructorRevenue)} 💰
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Total Projection */}
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.dark' }}>
                Med {expectedStudents} studenter:
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total omsetning:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {formatNOK(projection.totalRevenue)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    Platform Fee:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    -{formatNOK(projection.totalPlatformFee)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    pt: 1,
                    borderTop: '2px solid',
                    borderColor: 'success.dark'}}
                >
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                    Din inntekt:
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                    {formatNOK(projection.totalInstructorRevenue)} 💰
                  </Typography>
                </Box>
              </Stack>

              {/* Plan Info */}
              <Paper sx={{ p: 2, mt: 3, bgcolor: 'white' }}>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mb: 1, color: 'text.secondary' }}
                >
                  <Info sx={{ fontSize: 14, mr: 0.5 }} />
                  Din {instructorPlan === 'pro' ? 'Pro' : 'Enterprise'} plan gir deg:
                </Typography>
                <Stack spacing={0.5}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                    {split.instructorRevenuePercentage}% av hver påmelding
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                    Månedlige utbetalinger
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                    Stripe Connect / Bankoverføring
                  </Typography>
                  {instructorPlan === 'enterprise' && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
                      Automatiske utbetalinger (250 NOK min.)
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </CardContent>
          </Card>

          {/* Comparison: If they upgraded */}
          {instructorPlan === 'pro' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                💡 Oppgrader til Enterprise for mer inntekt:
              </Typography>
              <Typography variant="caption">
                Med Enterprise plan (15% fee) ville du tjent{' '}
                <strong>
                  {formatNOK(calculateRevenueSplit(priceOre, 'enterprise').instructorRevenue)}
                </strong>{' '}
                per student (+{', '}
                {formatNOK(
                  calculateRevenueSplit(priceOre, 'enterprise').instructorRevenue -
                    split.instructorRevenue,
                )}{', '}
                mer!)
              </Typography>
            </Alert>
          )}
        </Grid>
      </Grid>

      {/* Course Info Summary */}
      <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Kursinformasjon
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Videoer:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {videoCount}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Varighet:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {(totalDurationMinutes / 60).toFixed(1)}h
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Vanskelighetsgrad:
              </Typography>
              <Chip
                label={difficulty}
                size="small"
                sx={{
                  bgcolor:
                    difficulty === 'expert'
                      ? 'error.light'
                      : difficulty === 'advanced'
                        ? 'warning.light': 'success.light'}}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Funksjoner:
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {hasQuizzes && <Chip label="Quiz" size="small" />}
                {hasCertificate && <Chip label="Sertifikat" size="small" />}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Legal & Policy Info */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>📋 Viktig informasjon:</strong>
        </Typography>
        <Typography variant="caption" component="div">
          • Studenter har 14 dagers angrerett (norsk forbrukerlovgivning)
        </Typography>
        <Typography variant="caption" component="div">
          • Refusjoner trekkes fra din neste utbetaling
        </Typography>
        <Typography variant="caption" component="div">
          • Du er ansvarlig for egen skatteinnberetning
        </Typography>
        <Typography variant="caption" component="div">
          • MVA (25%) håndteres automatisk av plattformen
        </Typography>
        <Typography variant="caption" component="div">
          • Utbetalinger behandles månedlig (minimum 500 NOK for Pro, 250 NOK for Enterprise)
        </Typography>
      </Alert>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ ...theming.getThemedButtonSx() }}
          startIcon={<CheckCircle />}
        >
          Lagre Pris
        </Button>
      </Stack>
    </Box>
  );
	};

const CoursePricingPanelWithIntegration = withUniversalIntegration(CoursePricingPanel, {
	  componentId: 'course-pricing-panel',
	  componentName: 'Course Pricing Panel',
	  componentType: 'form',
	  componentCategory: 'academy',
	  	  featureIds: ['course-monetization', 'analytics-academy','course-analytics-revenue'],
});

export { CoursePricingPanelWithIntegration as CoursePricingPanel };
export default CoursePricingPanelWithIntegration;

