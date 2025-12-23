/**
 * Trial to Payment Bridge Service
 * Connects trial expiration to payment/subscription flow
 */

import { TrialFeatureManager, TrialStatus } from './TrialFeatureManager';
import { GooglePayService } from './GooglePayService';
import { apiRequest } from '../lib/queryClient';
import { trialToAdminPanelsBridge } from './TrialToAdminPanelsBridge';

export interface TrialConversionOptions {
  featureId: string;
  userId: string;
  selectedPlan: 'monthly' | 'annual';
  paymentMethod: 'google-pay' | 'stripe' | 'vipps';
}

export interface TrialConversionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  requiresPaymentAction?: boolean;
  paymentIntentClientSecret?: string;
}

export class TrialToPaymentBridge {
  private static instance: TrialToPaymentBridge;
  private trialManager: TrialFeatureManager;
  private googlePayService: GooglePayService;

  private constructor() {
    this.trialManager = TrialFeatureManager.getInstance();
    this.googlePayService = new GooglePayService();
  }

  static getInstance(): TrialToPaymentBridge {
    if (!this.instance) {
      this.instance = new TrialToPaymentBridge();
    }
    return this.instance;
  }

  /**
   * Check if trial has expired and handle conversion flow
   */
  async checkTrialExpirationAndPrompt(
    featureId: string,
    userId: string
  ): Promise<{
    isExpired: boolean;
    trialStatus: TrialStatus | null;
    shouldShowUpgrade: boolean;
  }> {
    const trialStatus = await this.trialManager.getTrialStatus(featureId, userId);

    if (!trialStatus) {
      return { isExpired: false, trialStatus: null, shouldShowUpgrade: false };
    }

    const isExpired = trialStatus.hasExpired || new Date() > trialStatus.endDate;

    if (isExpired && trialStatus.isActive) {
      // Update trial status to expired
      trialStatus.isActive = false;
      trialStatus.hasExpired = true;
      trialStatus.canUpgrade = true;

      // Track trial expiration
      this.trackTrialExpiration(featureId, userId);
    }

    return {
      isExpired,
      trialStatus,
      shouldShowUpgrade: isExpired,
    };
  }

  /**
   * Convert expired trial to paid subscription
   */
  async convertTrialToSubscription(
    options: TrialConversionOptions
  ): Promise<TrialConversionResult> {
    try {
      const { featureId, userId, selectedPlan, paymentMethod } = options;

      // Get trial status
      const trialStatus = await this.trialManager.getTrialStatus(featureId, userId);
      if (!trialStatus || !trialStatus.hasExpired) {
        return {
          success: false,
          error: 'Trial is not expired or does not exist',
        };
      }

      // Route to appropriate payment method
      switch (paymentMethod) {
        case 'google-pay':
          return await this.handleGooglePayConversion(options, trialStatus);
        case 'stripe':
          return await this.handleStripeConversion(options, trialStatus);
        case 'vipps':
          return await this.handleVippsConversion(options, trialStatus);
        default:
          return {
            success: false,
            error: 'Unsupported payment method',
          };
      }
    } catch (error) {
      console.error('Error converting trial to subscription: ', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle Google Pay conversion
   */
  private async handleGooglePayConversion(
    options: TrialConversionOptions,
    trialStatus: TrialStatus
  ): Promise<TrialConversionResult> {
    const { featureId, userId, selectedPlan } = options;

    // Get pricing for the feature
    const pricing = await this.getFeaturePricing(featureId, selectedPlan);

    // Create Google Pay payment request
    const googlePayRequest = {
      id: `trial-conversion-${featureId}-${Date.now()}`,
      amount: pricing.amount,
      currency: pricing.currency,
      productName: `Feature: ${featureId}`,
      description: `${selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} subscription`,
    };

    // Process Google Pay payment
    const paymentResult = await this.googlePayService.processPayment(googlePayRequest);

    if (paymentResult.success && paymentResult.transactionId) {
      // Create subscription in backend
      const subscription = await this.createSubscription({
        userId,
        featureId,
        planType: selectedPlan,
        paymentMethod: 'google-pay',
        paymentTransactionId: paymentResult.transactionId,
        trialStatusId: trialStatus.featureId, // Link to trial
      });

      if (subscription.success) {
        // Grant feature access
        await this.grantFeatureAccess(userId, featureId);

        // Track conversion
        this.trackTrialConversion(featureId, userId, selectedPlan 'google-pay');

        // 🔗 INTEGRATE WITH ADMIN PANELS
        await this.integrateWithAdminPanels({
          userId,
          featureId,
          planType: selectedPlan,
          paymentMethod: 'google-pay',
          transactionId: paymentResult.transactionId!,
          subscriptionId: subscription.subscriptionId!,
          amount: pricing.amount,
          currency: pricing.currency,
        });

        return {
          success: true,
          subscriptionId: subscription.subscriptionId,
        };
      }
    }

    return {
      success: false,
      error: 'Google Pay payment failed',
    };
  }

  /**
   * Handle Stripe conversion
   */
  private async handleStripeConversion(
    options: TrialConversionOptions,
    trialStatus: TrialStatus
  ): Promise<TrialConversionResult> {
    const { featureId, userId, selectedPlan } = options;

    try {
      const response = await apiRequest('/api/subscriptions/create-from-trial', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          featureId,
          planType: selectedPlan,
          paymentMethod: 'stripe',
          trialFeatureId: trialStatus.featureId,
        }),
      });

      if (response.success) {
        // Grant feature access
        await this.grantFeatureAccess(userId, featureId);

        // Track conversion
        this.trackTrialConversion(featureId, userId, selectedPlan, 'stripe');

        // 🔗 INTEGRATE WITH ADMIN PANELS
        await this.integrateWithAdminPanels({
          userId,
          featureId,
          planType: selectedPlan,
          paymentMethod: 'stripe',
          transactionId: response.transactionId || response.subscriptionId,
          subscriptionId: response.subscriptionId,
          amount: (await this.getFeaturePricing(featureId, selectedPlan)).amount,
          currency: (await this.getFeaturePricing(featureId, selectedPlan)).currency,
        });

        return {
          success: true,
          subscriptionId: response.subscriptionId,
          requiresPaymentAction: response.requiresPaymentAction,
          paymentIntentClientSecret: response.clientSecret,
        };
      }

      return {
        success: false,
        error: response.error || 'Stripe payment failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stripe payment failed',
      };
    }
  }

  /**
   * Handle Vipps conversion
   */
  private async handleVippsConversion(
    options: TrialConversionOptions,
    trialStatus: TrialStatus
  ): Promise<TrialConversionResult> {
    const { featureId, userId, selectedPlan } = options;

    try {
      const response = await apiRequest('/api/subscriptions/create-from-trial', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          featureId,
          planType: selectedPlan,
          paymentMethod: 'vipps',
          trialFeatureId: trialStatus.featureId,
        }),
      });

      if (response.success) {
        // Grant feature access
        await this.grantFeatureAccess(userId, featureId);

        // Track conversion
        this.trackTrialConversion(featureId, userId, selectedPlan, 'vipps');

        // 🔗 INTEGRATE WITH ADMIN PANELS
        await this.integrateWithAdminPanels({
          userId,
          featureId,
          planType: selectedPlan,
          paymentMethod: 'vipps',
          transactionId: response.transactionId || response.subscriptionId,
          subscriptionId: response.subscriptionId,
          amount: (await this.getFeaturePricing(featureId, selectedPlan)).amount,
          currency: (await this.getFeaturePricing(featureId, selectedPlan)).currency,
        });

        return {
          success: true,
          subscriptionId: response.subscriptionId,
          requiresPaymentAction: response.requiresPaymentAction,
        };
      }

      return {
        success: false,
        error: response.error || 'Vipps payment failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vipps payment failed',
      };
    }
  }

  /**
   * Get feature pricing
   */
  private async getFeaturePricing(
    featureId: string,
    planType: 'monthly' | 'annual'
  ): Promise<{ amount: number; currency: string }> {
    try {
      const response = await apiRequest(`/api/features/${featureId}/pricing`, {
        method: 'GET',
      });

      if (response.success && response.pricing) {
        return {
          amount: planType === 'monthly' ? response.pricing.monthly : response.pricing.annual,
          currency: response.pricing.currency || 'NOK',
        };
      }

      // Default pricing if API fails
      return {
        amount: planType === 'monthly' ? 299 : 2990, // NOK
        currency: 'NOK',
      };
    } catch (error) {
      console.error('Error fetching feature pricing:', error);
      return {
        amount: planType === 'monthly' ? 299 : 2990,
        currency: 'NOK',
      };
    }
  }

  /**
   * Create subscription in backend
   */
  private async createSubscription(data: {
    userId: string;
    featureId: string;
    planType: 'monthly' | 'annual';
    paymentMethod: string;
    paymentTransactionId: string;
    trialStatusId: string;
  }): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      const response = await apiRequest('/api/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          convertedFromTrial: true,
          conversionDate: new Date().toISOString(),
        }),
      });

      return {
        success: response.success,
        subscriptionId: response.subscriptionId,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      };
    }
  }

  /**
   * Grant feature access to user
   */
  private async grantFeatureAccess(userId: string, featureId: string): Promise<void> {
    try {
      await apiRequest('/api/features/grant-access', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          featureId,
          source: 'trial_conversion',
        }),
      });
    } catch (error) {
      console.error('Error granting feature access:', error);
    }
  }

  /**
   * Track trial expiration event
   */
  private trackTrialExpiration(featureId: string, userId: string): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'trial_expired', {
        feature_id: featureId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Also send to backend analytics
    apiRequest('/api/analytics/trial-expiration', {
      method: 'POST',
      body: JSON.stringify({
        featureId,
        userId,
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error);
  }

  /**
   * Track trial conversion event
   */
  private trackTrialConversion(
    featureId: string,
    userId: string,
    planType: string,
    paymentMethod: string
  ): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'trial_converted', {
        feature_id: featureId,
        user_id: userId,
        plan_type: planType,
        payment_method: paymentMethod,
        timestamp: new Date().toISOString(),
      });
    }

    // Also send to backend analytics
    apiRequest('/api/analytics/trial-conversion', {
      method: 'POST',
      body: JSON.stringify({
        featureId,
        userId,
        planType,
        paymentMethod,
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error);
  }

  /**
   * Integrate with Admin Panels after successful payment
   */
  private async integrateWithAdminPanels(data: {
    userId: string;
    featureId: string;
    planType: 'monthly' | 'annual';
    paymentMethod: string;
    transactionId: string;
    subscriptionId: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    try {
      console.log('🔗 Integrating with admin panels...', data);

      const result = await trialToAdminPanelsBridge.handleTrialConversion({
        ...data,
        success: true,
      });

      console.log('✅ Admin panels integration complete:', result);

      // Track integration success
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'admin_panels_integrated', {
          user_id: data.userId,
          feature_id: data.featureId,
          billing_success: result.billing.success,
          membership_success: result.membership.success,
          user_approval_success: result.userApproval.success,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('❌ Error integrating with admin panels:', error);
      // Don't throw - payment already succeeded, this is just post-processing
    }
  }

  /**
   * Get conversion options for a feature
   */
  async getConversionOptions(featureId: string): Promise<{
    plans: Array<{
      type: 'monthly' | 'annual';
      price: number;
      currency: string;
      savings?: string;
    }>;
    paymentMethods: Array<{
      type: 'google-pay' | 'stripe' | 'vipps';
      name: string;
      available: boolean;
    }>;
  }> {
    try {
      const response = await apiRequest(`/api/features/${featureId}/conversion-options`, {
        method: 'GET',
      });

      if (response.success) {
        return response.options;
      }

      // Return defaults if API fails
      return this.getDefaultConversionOptions();
    } catch (error) {
      console.error('Error fetching conversion options:', error);
      return this.getDefaultConversionOptions();
    }
  }

  /**
   * Get default conversion options
   */
  private getDefaultConversionOptions() {
    return {
      plans: [
        { type: 'monthly' as const, price: 299, currency: 'NOK' },
        {
          type: 'annual' as const,
          price: 2990,
          currency: 'NOK',
          savings: 'Spar 598 kr/år',
        },
      ],
      paymentMethods: [
        { type: 'google-pay' as const, name: 'Google Pay', available: true },
        { type: 'stripe' as const, name: 'Kort', available: true },
        { type: 'vipps' as const, name:'Vipps', available: true },
      ],
    };
  }
}

export const trialToPaymentBridge = TrialToPaymentBridge.getInstance();

