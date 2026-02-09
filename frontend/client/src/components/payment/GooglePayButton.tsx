/**
 * CreatorHub Norge - Google Pay Button Component
 * React wrapper for Google Pay integration
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { googlePayService } from '@/services/GooglePayService';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

export interface GooglePayButtonProps {
  amount: number; // Amount in øre (100 = 1 NOK)
  currency?: string;
  productName: string;
  description?: string;
  userId?: string;
  buttonType?: 'pay' | 'book' | 'buy' | 'donate' | 'checkout' | 'order' | 'subscribe';
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function GooglePayButton({
  amount,
  currency = 'NOK',
  productName,
  description,
  userId,
  buttonType = 'subscribe',
  onSuccess,
  onError,
  onCancel,
  disabled = false
}: GooglePayButtonProps) {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Master Integration for analytics
  const { analytics, features } = useEnhancedMasterIntegration();

  // Check Google Pay availability
  useEffect(() => {
    async function checkAvailability() {
      try {
        const available = await googlePayService.isGooglePayAvailable();
        setIsAvailable(available);
        
        if (available) {
          analytics.trackEvent('google_pay_available, ', {
            amount,
            currency,
            productName
          });
        } else {
          analytics.trackEvent('google_pay_unavailable,', {
            reason: 'not_supported_on_device'
          });
        }
      } catch (error) {
        console.error('Error checking Google Pay availability: ', error);
        setIsAvailable(false);
      }
    }
    
    checkAvailability();
  }, []);

  // Create Google Pay button
  useEffect(() => {
    if (!buttonContainerRef.current || !isAvailable || disabled) {
      return;
    }

    const containerId = `google-pay-button-${Date.now()}`;
    buttonContainerRef.current.id = containerId;

    const handlePayment = async () => {
      setIsProcessing(true);
      setError(null);

      // Track payment attempt
      features.trackFeatureUsage('google-pay-integration', 'payment_initiated', {
        timestamp: Date.now(),
        amount,
        currency,
        productName
      });

      try {
        const result = await googlePayService.processPayment({
          id: `intent_${Date.now()}`,
          amount,
          currency,
          productName,
          description: description || productName,
          userId,
          metadata: {
            source: 'google-pay-button',
            timestamp: Date.now()
          }
        });

        if (result.success) {
          // Track successful payment
          features.trackFeatureUsage('google-pay-integration','payment_succeeded', {
            timestamp: Date.now(),
            transactionId: result.transactionId,
            amount,
            currency
          });

          analytics.trackEvent('google_pay_payment_success', {
            transactionId: result.transactionId,
            amount,
            currency,
            productName
          });

          if (onSuccess) {
            onSuccess(result);
          }
        } else {
          throw new Error(result.error || 'Payment failed');
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Payment processing failed';
        setError(errorMessage);

        // Track payment failure
        features.trackFeatureUsage('google-pay-integration', 'payment_failed', {
          timestamp: Date.now(),
          error: errorMessage,
          amount,
          currency
        });

        analytics.trackEvent('google_pay_payment_error', {
          error: errorMessage,
          amount,
          currency,
          productName
        });

        if (error.message?.includes('cancel')) {
          if (onCancel) {
            onCancel();
          }
        } else if (onError) {
          onError(errorMessage);
        }
      } finally {
        setIsProcessing(false);
      }
    };

    try {
      const button = googlePayService.createButton(
        containerId,
        handlePayment,
        buttonType
      );

      if (button) {
        setIsReady(true);
        
        analytics.trackEvent('google_pay_button_rendered', {
          amount,
          currency,
          productName,
          buttonType
        });
      } else {
        setError('Failed to create Google Pay button');
      }
    } catch (error: any) {
      console.error('Error creating Google Pay button: ', error);
      setError(error.message || 'Failed to initialize Google Pay');
    }

    return () => {
      // Cleanup if needed
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = ', ';
      }
    };
  }, [isAvailable, disabled, amount, currency, productName]);

  // Show loading state while checking availability
  if (isAvailable === null) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Sjekker Google Pay tilgjengelighet...
        </Typography>
      </Box>
    );
  }

  // Show message if Google Pay is not available
  if (isAvailable === false) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        <Typography variant="body2">
          Google Pay er ikke tilgjengelig på denne enheten. Vennligst bruk kort eller annen betalingsmetode.
        </Typography>
      </Alert>
    );
  }

  // Show error if button creation failed
  if (error && !isProcessing) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        <Typography variant="body2">
          <strong>Feil:</strong> {error}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Google Pay Button Container */}
      <div 
        ref={buttonContainerRef}
        style={{
          minHeight: '48px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      />
      
      {/* Processing Overlay */}
      {isProcessing && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 1,
            zIndex: 1}}
        >
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Behandler betaling...
          </Typography>
        </Box>
      )}
      
      {/* Disabled Overlay */}
      {disabled && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: 1,
            cursor:'not-allowed',
            zIndex: 1}}
        />
      )}
    </Box>
  );
}

export default GooglePayButton;

