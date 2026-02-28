/**
 * CreatorHub Norge - Google Pay Service
 * Integration with Google Pay API for payment processing
 */

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  productName: string;
  description: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  paymentData?: any;
}

export interface GooglePayConfiguration {
  environment: 'TEST' | 'PRODUCTION';
  apiVersion: number;
  apiVersionMinor: number;
  merchantInfo: {
    merchantId: string;
    merchantName: string;
  };
  allowedPaymentMethods: GooglePaymentMethod[]; 
}

export interface GooglePaymentMethod {
  type: 'CARD';
  parameters: {
    allowedAuthMethods: string[];
    allowedCardNetworks: string[];
    billingAddressRequired: boolean;
    billingAddressParameters: {
      format: string;
      phoneNumberRequired: boolean;
    };
  };
  tokenizationSpecification: {
    type: 'PAYMENT_GATEWAY';
    parameters: {
      gateway: string;
      gatewayMerchantId: string;
    };
  };
}

export interface GooglePayPaymentData {
  apiVersionMinor: number;
  apiVersion: number;
  paymentMethodData: {
    description: string;
    tokenizationData: {
      token: string;
      type: string;
    };
    type: string;
    info: {
      cardDetails: string;
      cardNetwork: string;
      billingAddress?: any;
    };
  };
  shippingAddress?: any;
  email?: string;
}

export class GooglePayService {
  private static instance: GooglePayService;
  private paymentsClient: any = null;
  private isReady = false;
  private configuration: GooglePayConfiguration | null = null;

  static getInstance(): GooglePayService {
    if (!this.instance) {
      this.instance = new GooglePayService();
    }
    return this.instance;
  }

  constructor() {
    this.initializeGooglePay();
}

  // Initialize Google Pay SDK
  private async initializeGooglePay(): Promise<void> {
    if (typeof window === 'undefined') return;
    const googlePayEnabled =
      import.meta.env.PROD || String(import.meta.env.VITE_ENABLE_GOOGLE_PAY).toLowerCase() === 'true';
    if (!googlePayEnabled) {
      this.isReady = false;
      return;
    }

    try {
      // Load Google Pay script if not already loaded
      if (!(window as any).google) {
        await this.loadGooglePayScript();
      }

      // Wait for Google Pay to be available
      await this.waitForGooglePay();

      this.configuration = this.getGooglePayConfiguration();
      this.paymentsClient = new (window as any).google.payments.api.PaymentsClient({
        environment: this.configuration.environment
      });

      this.isReady = true;
      console.log('Google Pay initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Pay: ', error);
      this.isReady = false;
    }
  }

  // Load Google Pay script
  private loadGooglePayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.payments) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://pay.google.com/gp/p/js/pay.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Pay script'));
      document.head.appendChild(script);
    });
  }

  // Wait for Google Pay to be available
  private waitForGooglePay(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkGooglePay = () => {
        if ((window as any).google?.payments?.api?.PaymentsClient) {
          resolve();
        } else {
          setTimeout(checkGooglePay, 100);
        }
      };
      checkGooglePay();
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Google Pay timeout'));
      }, 10000);
    });
  }

  // Get Google Pay configuration
  private getGooglePayConfiguration(): GooglePayConfiguration {
    const environment = import.meta.env.PROD ? 'PRODUCTION' : 'TEST';
    
    return {
      environment,
      apiVersion:  2,
      apiVersionMinor:  0,
      merchantInfo: {
        merchantId: '7115-4985-802', // CreatorHub Norge Payments Profile ID
        merchantName: 'CreatorHub Norge',
      },
      allowedPaymentMethods: [
        {
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY','CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['MASTERCARD', 'VISA'],
            billingAddressRequired: true,
            billingAddressParameters: {
              format: 'FULL',
              phoneNumberRequired: true,
            },
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: 'stripe',
              gatewayMerchantId: '7115-4985-802',
            },
          },
        },
      ],
    };
  }

  // Check if Google Pay is available
  async isGooglePayAvailable(): Promise<boolean> {
    if (!this.isReady) {
      await this.initializeGooglePay();
    }

    if (!this.paymentsClient || !this.configuration) {
      return false;
    }

    try {
      const isReadyToPay = await this.paymentsClient.isReadyToPay({
        apiVersion: this.configuration.apiVersion,
        apiVersionMinor: this.configuration.apiVersionMinor,
        allowedPaymentMethods: this.configuration.allowedPaymentMethods,
      });

      return isReadyToPay.result;
    } catch (error) {
      console.error('Error checking Google Pay availability:', error);
      return false;
    }
  }

  // Create payment data request
  private createPaymentDataRequest(
    paymentIntent: PaymentIntent,
    options?: {
      requestEmail?: boolean;
      requestShipping?: boolean;
      shippingAddressRequired?: boolean;
  }
  ) {
    if (!this.configuration) {
      throw new Error('Google Pay not initialized');
    }

    return {
      apiVersion: this.configuration.apiVersion,
      apiVersionMinor: this.configuration.apiVersionMinor,
      allowedPaymentMethods: this.configuration.allowedPaymentMethods,
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: (paymentIntent.amount / 100).toFixed(2),
        currencyCode: paymentIntent.currency,
        countryCode: 'NO', // Norway
      },
      merchantInfo: this.configuration.merchantInfo,
      ...(options?.requestEmail && { emailRequired: true }),
      ...(options?.requestShipping && {
        shippingAddressRequired: options.shippingAddressRequired || false,
        shippingAddressParameters: {
          phoneNumberRequired: true,
        },
      }),
    };
  }

  // Process payment with Google Pay
  async processPayment(
    paymentIntent: PaymentIntent,
    options?: {
      requestEmail?: boolean;
      requestShipping?: boolean;
      shippingAddressRequired?: boolean;
    }
  ): Promise<PaymentResult> {
    if (!this.isReady) {
      await this.initializeGooglePay();
    }

    if (!this.paymentsClient) {
      return {
        success: false,
        error: 'Google Pay not initialized'
      };
    }

    try {
      // Check if Google Pay is available
      const isAvailable = await this.isGooglePayAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Google Pay is not available on this device'
        };
      }

      // Create payment data request
      const paymentDataRequest = this.createPaymentDataRequest(paymentIntent, options);

      // Load payment data
      const paymentData = await this.paymentsClient.loadPaymentData(paymentDataRequest);

      // Process payment with backend
      const result = await this.processGooglePayPayment(paymentData, paymentIntent);

      return result;
    } catch (error: any) {
      console.error('Google Pay payment error:', error);
      
      // Handle specific Google Pay errors
      if (error.statusCode === 'CANCELED') {
        return {
          success: false,
          error: 'Payment was cancelled by user'
        };
      } else if (error.statusCode === 'DEVELOPER_ERROR') {
        return {
          success: false,
          error: 'Google Pay configuration error'
        };
      } else if (error.statusCode === 'MERCHANT_ERROR') {
        return {
          success: false,
          error: 'Merchant configuration error'
        };
      } else {
        return {
          success: false,
          error: error.message || 'Google Pay payment failed'
        };
      }
    }
  }

  // Process subscription payment
  async processSubscriptionPayment(
    paymentIntent: PaymentIntent,
    subscriptionDetails: {
      recurringInterval: 'monthly' | 'yearly';
      trialPeriod?: number; // days
    },
    options?: {
      requestEmail?: boolean;
      requestShipping?: boolean;
      shippingAddressRequired?: boolean;
    }
  ): Promise<PaymentResult> {
    if (!this.isReady) {
      await this.initializeGooglePay();
    }

    if (!this.paymentsClient) {
      return {
        success: false,
        error: 'Google Pay not initialized'
      };
    }

    try {
      // Check if Google Pay is available
      const isAvailable = await this.isGooglePayAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Google Pay is not available on this device'
        };
      }

      // Create subscription payment data request
      const paymentDataRequest = {
        ...this.createPaymentDataRequest(paymentIntent, options),
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: (paymentIntent.amount / 100).toFixed(2),
          currencyCode: paymentIntent.currency,
          countryCode: 'NO',
          displayItems: [
            {
              label: paymentIntent.productName,
              price: (paymentIntent.amount / 100).toFixed(2),
              type: 'SUBTOTAL',
            },
            {
              label: `Fakturering ${subscriptionDetails.recurringInterval === 'monthly' ? 'månedlig' : 'årlig'}`,
              price: '0.00',
              type: 'TAX',
            },
          ],
        },
      };

      // Add trial information if applicable
      if (subscriptionDetails.trialPeriod && subscriptionDetails.trialPeriod > 0) {
        paymentDataRequest.transactionInfo.displayItems.push({
          label: `Gratis prøveperiode (${subscriptionDetails.trialPeriod} dager)`,
          price: '0.00',
          type: 'DISCOUNT',
        });
      }

      // Load payment data
      const paymentData = await this.paymentsClient.loadPaymentData(paymentDataRequest);

      // Process subscription payment with backend
      const result = await this.processGooglePayPayment(paymentData, paymentIntent);

      return result;
    } catch (error: any) {
      console.error('Google Pay subscription payment error:', error);
      
      if (error.statusCode === 'CANCELED') {
        return {
          success: false,
          error: 'Subscription payment was cancelled by user'
        };
      } else {
        return {
          success: false,
          error: error.message || 'Google Pay subscription payment failed'
        };
      }
    }
  }

  // Process Google Pay payment with backend
  private async processGooglePayPayment(
    paymentData: GooglePayPaymentData,
    paymentIntent: PaymentIntent
  ): Promise<PaymentResult> {
    try {
      const response = await fetch('/api/google-pay/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          paymentData,
          paymentIntent,
        }),
      });

      if (!response.ok) {
        throw new Error('Payment processing failed');
      }

      const result = await response.json();
      return {
        success: true,
        transactionId: result.transactionId,
        paymentData: result.paymentData,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment processing failed',
      };
    }
  }

  // Get Google Pay button configuration
  getButtonConfiguration(buttonType: 'pay' | 'book' | 'buy' | 'donate' | 'checkout' | 'order' | 'subscribe' = 'pay') {
    return {
      buttonType,
      buttonColor: 'default', // 'default' | 'black' | 'white'
      buttonSizeMode: 'fill', // 'fill' | 'static'
      buttonLocale: 'no', // Norwegian locale
    };
  }

  // Create Google Pay button element
  createButton(
    containerId: string,
    onClick: () => void,
    buttonType: 'pay' | 'book' | 'buy' | 'donate' | 'checkout' | 'order' | 'subscribe' = 'pay'
  ): HTMLElement | null {
    if (!this.paymentsClient) {
      console.error('Google Pay not initialized');
      return null;
    }

    try {
      const button = this.paymentsClient.createButton({
        ...this.getButtonConfiguration(buttonType),
        onClick,
      });

      const container = document.getElementById(containerId);
      if (container) {
        container.appendChild(button);
        return button;
      } else {
        console.error(`Container with id '${containerId}' not found`);
        return null;
      }
    } catch (error) {
      console.error('Error creating Google Pay button:', error);
      return null;
    }
  }

  // Prefetch payment data for better performance
  async prefetchPaymentData(paymentIntent: PaymentIntent): Promise<void> {
    if (!this.isReady) {
      await this.initializeGooglePay();
    }

    if (!this.paymentsClient) {
      return;
    }

    try {
      const paymentDataRequest = this.createPaymentDataRequest(paymentIntent);
      await this.paymentsClient.prefetchPaymentData(paymentDataRequest);
    } catch (error) {
      console.error('Error prefetching payment data:', error);
    }
  }

  // Get supported payment methods
  getSupportedPaymentMethods(): string[] {
    return this.configuration?.allowedPaymentMethods.map(method => method.type) || [];
}

  // Get supported card networks
  getSupportedCardNetworks(): string[] {
    const cardMethod = this.configuration?.allowedPaymentMethods.find(method => method.type === 'CARD');
    return cardMethod?.parameters.allowedCardNetworks || [];
}

  // Get supported auth methods
  getSupportedAuthMethods(): string[] {
    const cardMethod = this.configuration?.allowedPaymentMethods.find(method => method.type ==='CARD');
    return cardMethod?.parameters.allowedAuthMethods || [];
}

  // Validate payment data
  validatePaymentData(paymentData: GooglePayPaymentData): boolean {
    try {
      // Basic validation
      if (!paymentData.paymentMethodData) {
        return false;
      }

      if (!paymentData.paymentMethodData.tokenizationData) {
        return false;
      }

      if (!paymentData.paymentMethodData.tokenizationData.token) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating payment data:', error);
      return false;
    }
  }

  // Get payment method info from payment data
  getPaymentMethodInfo(paymentData: GooglePayPaymentData) {
    if (!paymentData.paymentMethodData) {
      return null;
    }

    return {
      type: paymentData.paymentMethodData.type,
      cardNetwork: paymentData.paymentMethodData.info?.cardNetwork,
      cardDetails: paymentData.paymentMethodData.info?.cardDetails,
      billingAddress: paymentData.paymentMethodData.info?.billingAddress,
      email: paymentData.email,
      shippingAddress: paymentData.shippingAddress,
    };
  }

  // Get Google Pay configuration for external use
  getGooglePayConfig() {
    return this.configuration;
  }
}

export const googlePayService = GooglePayService.getInstance();
















