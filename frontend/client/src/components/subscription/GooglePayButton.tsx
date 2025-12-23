/**
 * CreatorHub Norge - Google Pay Button Component
 * Renders a Google Pay button with proper branding and configuration
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useToast } from '@/hooks/use-toast';
import { googlePayService, PaymentIntent } from '@/services/GooglePayService';

// Google Pay API types
declare global {
  interface Window {
    google?: {
      payments?: {
        api?: {
          PaymentsClient: new (options: PaymentOptions) => PaymentsClient;
        };
      };
    };
  }
}

interface PaymentOptions {
  environment: 'TEST' | 'PRODUCTION';
  merchantInfo?: MerchantInfo;
  paymentDataCallbacks?: PaymentDataCallbacks;
}

interface MerchantInfo {
  merchantName: string;
  merchantId?: string;
}

interface PaymentDataCallbacks {
  onPaymentDataChanged?: (intermediatePaymentData: unknown) => Promise<any>;
  onPaymentAuthorized?: (paymentData: unknown) => Promise<any>;
}

interface PaymentsClient {
  isReadyToPay(request: IsReadyToPayRequest): Promise<IsReadyToPayResponse>;
  loadPaymentData(request: PaymentDataRequest): Promise<PaymentData>;
  createButton(options: ButtonOptions): HTMLElement;
  prefetchPaymentData(request: PaymentDataRequest): void;
}

interface IsReadyToPayRequest {
  apiVersion: number;
  apiVersionMinor: number;
  allowedPaymentMethods: PaymentMethod[];
  existingPaymentMethodRequired?: boolean;
}

interface IsReadyToPayResponse {
  result: boolean;
  paymentMethodPresent?: boolean;
}

interface PaymentMethod {
  type: string;
  parameters: {
    allowedAuthMethods: string[];
    allowedCardNetworks: string[];
    allowPrepaidCards?: boolean;
    allowCreditCards?: boolean;
    assuranceDetailsRequired?: boolean;
    billingAddressRequired?: boolean;
    billingAddressParameters?: BillingAddressParameters;
  };
  tokenizationSpecification?: TokenizationSpecification;
}

interface BillingAddressParameters {
  format?: 'MIN' | 'FULL';
  phoneNumberRequired?: boolean;
}

interface TokenizationSpecification {
  type: string;
  parameters: {
    gateway?: string;
    gatewayMerchantId?: string;
  };
}

interface TransactionInfo {
  currencyCode: string;
  countryCode: string;
  transactionId?: string;
  totalPriceStatus: 'ESTIMATED' | 'FINAL';
  totalPrice: string;
  totalPriceLabel?: string;
  checkoutOption: 'DEFAULT' | 'COMPLETE_IMMEDIATE_PURCHASE';
  displayItems?: DisplayItem[];
}

interface DisplayItem {
  label: string;
  type: 'LINE_ITEM' | 'SUBTOTAL' | 'TAX' | 'SHIPPING_OPTION' | 'DISCOUNT';
  price: string;
  status?: 'FINAL' | 'PENDING';
}

interface PaymentDataRequest {
  apiVersion: number;
  apiVersionMinor: number;
  merchantInfo: MerchantInfo;
  allowedPaymentMethods: PaymentMethod[];
  transactionInfo: TransactionInfo;
  emailRequired?: boolean;
  shippingAddressRequired?: boolean;
  callbackIntents?: string[];
}

interface PaymentData {
  apiVersion: number;
  apiVersionMinor: number;
  paymentMethodData: {
    type: string;
    description: string;
    info: {
      cardNetwork: string;
      cardDetails: string;
    };
    tokenizationData: {
      type: string;
      token: string;
    };
  };
  email?: string;
  shippingAddress?: any;
}

interface ButtonOptions {
  buttonColor?: 'default' | 'black' | 'white';
  buttonType?: 'book' | 'buy' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe';
  buttonRadius?: number;
  buttonLocale?: string;
  buttonSizeMode?: 'static' | 'fill';
  onClick: () => void;
  allowedPaymentMethods?: PaymentMethod[];
}

interface GooglePayButtonProps {
  planName?: string;
  planPrice: number;
  currency?: string;
  countryCode?: string;
  merchantName?: string;
  merchantId?: string;
  environment?: 'TEST' | 'PRODUCTION';
  onPaymentSuccess?: (paymentData: PaymentData) => void;
  onPaymentError?: (error: Error) => void;
  buttonColor?: 'default' | 'black' | 'white';
  buttonType?: 'book' | 'buy' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe';
  buttonLocale?: string;
}

export default function GooglePayButton({
  planName =  'CreatorHub Subscription',
  planPrice,
  currency = 'NOK',
  countryCode = 'NO',
  merchantName = 'CreatorHub Norge',
  merchantId = '10329268575898064320',
  environment = 'TEST',
  onPaymentSuccess,
  onPaymentError,
  buttonColor = 'white',
  buttonType = 'subscribe',
  buttonLocale = 'no',
}: GooglePayButtonProps) {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const { toast } = useToast();

  // Initialize Google Pay using the service
  useEffect(() => {
    checkGooglePayAvailability();
  }, []);

  const checkGooglePayAvailability = async () => {
    try {
      const available = await googlePayService.isGooglePayAvailable();
      setIsReady(available);

      if (available && buttonContainerRef.current) {
        // Clear and add button
        buttonContainerRef.current.innerHTML = '';
        const containerId = `google-pay-button-${Date.now()}`;
        buttonContainerRef.current.id = containerId;

        googlePayService.createButton(containerId, handleGooglePayClick, buttonType);
      }
    } catch (error) {
      console.error('Error checking Google Pay availability: ', error);
      onPaymentError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGooglePayClick = async () => {
    try {
      // Create payment intent
      const paymentIntent: PaymentIntent = {
        id: `intent_${Date.now()}`,
        amount: Math.round(planPrice * 100), // Convert to cents
        currency: currency,
        productName: planName,
        description: `Subscription for ${planName}`,
        metadata: {
          planName,
          buttonType,
        },
      };

      // Process payment through the service
      const result = await googlePayService.processPayment(paymentIntent, {
        requestEmail: true,
        requestShipping: false,
      });

      if (result.success && result.paymentData) {
        console.log('Payment successful: ', result);

        // Call success callback with converted data
        onPaymentSuccess?.({
          apiVersion: 2,
          apiVersionMinor: 0,
          paymentMethodData: result.paymentData.paymentMethodData || {
            type: 'CARD',
            description: 'Payment Card',
            info: {
              cardNetwork: 'UNKNOWN',
              cardDetails: '****',
            },
            tokenizationData: {
              type: 'PAYMENT_GATEWAY',
              token: result.transactionId || '',
            },
          },
          email: result.paymentData.email,
          shippingAddress: result.paymentData.shippingAddress,
        });

        toast({
          title: 'Betaling vellykket',
          description: `Din ${planName} abonnement er aktivert`,
          variant: 'default',
        });
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error: unknown) {
      console.error('Payment failed:', error);

      if (error.message?.includes('cancelled') || error.message?.includes('canceled') {
        toast({
          title: 'Betaling avbrutt',
          description: 'Du avbrøt betalingen',
          variant: 'default',
        });
      } else {
        onPaymentError?.(error);
        toast({
          title: 'Betalingsfeil',
          description: error.message || 'Kunne ikke fullføre betalingen',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} sx={{ color: '#ff8c00' }} />
        <Typography variant="body2" sx={{ ml: 2, color: '#666'}}>
          Laster Google Pay...
        </Typography>
      </Box>
    );
  }

  if (!isReady) {
    return (
      <Box sx={{ py: 1, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#666'}}>
          Google Pay er ikke tilgjengelig på denne enheten
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={buttonContainerRef}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '48px', '& > button': {
          minWidth:'200px',
        }}}
    />
  );
}
