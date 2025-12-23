/**
 * Academy course checkout component.
 * Shows course details and pricing, processes Google Pay payment + enrollment,
 * and records analytics events via the universal integration layer.
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Divider,
  Alert,
  Paper,
  Chip,
  CircularProgress,
} from '@mui/material';
import { CheckCircle, School, AttachMoney, Security, Info, Star } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import GooglePayButton from '@/components/payment/GooglePayButton';
import { formatNOK } from '@shared/revenue-calculator';

interface CourseEnrollmentPaymentProps {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  instructor: string;
  priceOre: number; // in øre
  videoCount: number;
  duration: string;
  rating?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const CourseEnrollmentPayment: React.FC<CourseEnrollmentPaymentProps> = ({
  courseId,
  courseTitle,
  courseDescription,
  instructor,
  priceOre,
  videoCount,
  duration,
  rating,
  onSuccess,
  onCancel,
}) => {
  const theming = useTheming('music_producer');
  const { analytics } = useEnhancedMasterIntegration();
  const queryClient = useQueryClient();

  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Enroll mutation (after successful payment)
  const enrollMutation = useMutation({
    mutationFn: (paymentData: any) =>
      apiRequest('/api/academy/enroll', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          paymentData,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/academy/enrollments'] });
      analytics.trackEvent('course_enrolled_success', {
        courseId,
        courseTitle,
        price: priceOre,
        timestamp: Date.now(),
      });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Enrollment error: ', error);
      analytics.trackEvent('course_enrollment_failed', {
        courseId,
        error: error.message,
        timestamp: Date.now(),
      });
    },
  });

  const handlePaymentSuccess = (result: any) => {
    setPaymentProcessing(true);
    analytics.trackEvent('course_payment_success', {
      courseId,
      courseTitle,
      price: priceOre,
      transactionId: result.transactionId,
      timestamp: Date.now(),
    });

    // Process enrollment
    enrollMutation.mutate(result);
  };

  const handlePaymentError = (error: string) => {
    setPaymentProcessing(false);
    analytics.trackEvent('course_payment_failed', {
      courseId,
      error,
      timestamp: Date.now(),
    });
    alert(`Betalingsfeil: ${error}`);
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Card sx={{ ...theming.getThemedCardSx(), border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2}}
            >
              <School sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
              Meld deg på kurs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Få umiddelbar tilgang etter betaling
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Course Info */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              {courseTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {courseDescription}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <Chip label={`${videoCount} videoer`} size="small" />
              <Chip label={duration} size="small" />
              {rating && (
                <Chip
                  icon={<Star sx={{ fontSize: 16 }} />}
                  label={`${rating}/5.0`}
                  size="small"
                  sx={{ bgcolor: 'warning.light' }}
                />
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Instruktør: <strong>{instructor}</strong>
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Pricing */}
          <Paper sx={{ p: 3, bgcolor: 'grey.50', mb: 3 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography variant="body1">Kurspris:</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                {formatNOK(priceOre)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Inkludert MVA (25%)
            </Typography>
          </Paper>

          {/* Payment Method */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              Betalingsmetode:
            </Typography>
            <GooglePayButton
              amount={priceOre}
              currency="NOK"
              productName={courseTitle}
              description={`${courseDescription} - ${instructor}`}
              buttonType="pay"
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={() => {
                analytics.trackEvent('course_payment_cancelled', {
                  courseId,
                  timestamp: Date.now(),
                });
              }}
              disabled={paymentProcessing || enrollMutation.isPending}
            />

            {paymentProcessing && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Behandler påmelding...</Typography>
                </Box>
              </Alert>
            )}
          </Box>

          {/* What's Included */}
          <Paper
            sx={{
              p: 2,
              bgcolor: 'info.light',
              border: '1px solid',
              borderColor: 'info.main',
              mb: 3}}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'info.dark', mb: 1 }}>
              ✅ Inkludert i kurset:
            </Typography>
            <Stack spacing={0.5}>
              <Typography
                variant="caption"
                sx={{ color: 'info.dark', display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <CheckCircle sx={{ fontSize: 14 }} /> Livstidstilgang til alle videoer
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'info.dark', display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <CheckCircle sx={{ fontSize: 14 }} /> Interaktive quizer og oppgaver
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'info.dark', display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <CheckCircle sx={{ fontSize: 14 }} /> Fullføringssertifikat
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'info.dark', display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <CheckCircle sx={{ fontSize: 14 }} /> 14 dagers pengene-tilbake-garanti
              </Typography>
            </Stack>
          </Paper>

          {/* Security & Legal */}
          <Stack spacing={1}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Security sx={{ fontSize: 14 }} />
              Sikker betaling via Stripe og Google Pay
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Info sx={{ fontSize: 14 }} />
              14 dagers angrerett i henhold til norsk forbrukerlovgivning
            </Typography>
          </Stack>

          <Divider sx={{ my: 3 }} />

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={paymentProcessing || enrollMutation.isPending}
            >
              Avbryt
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
	};

const CourseEnrollmentPaymentWithIntegration = withUniversalIntegration(CourseEnrollmentPayment, {
	  componentId: 'course-enrollment-payment',
	  componentName: 'Course Enrollment Payment',
	  componentType: 'form',
	  componentCategory: 'academy',
	  	  featureIds: ['course-enrollment', 'course-monetization', 'course-publishing','analytics-academy'],
});

export { CourseEnrollmentPaymentWithIntegration as CourseEnrollmentPayment };
export default CourseEnrollmentPaymentWithIntegration;

