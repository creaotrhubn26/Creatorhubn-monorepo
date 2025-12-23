/**
 * Trial to Admin Panels Bridge
 * Connects trial-to-payment conversions with admin panels
 */

import { apiRequest } from '../lib/queryClient';
import type { TrialConversionResult } from './TrialToPaymentBridge';

export interface AdminPanelIntegration {
  // Billing Management
  createInvoice: (data: InvoiceData) => Promise<any>;
  recordSubscription: (data: SubscriptionData) => Promise<any>;
  applyCoupon: (code: string, userId: string) => Promise<any>;
  
  // Google Wallet Membership
  createMembershipCard: (data: MembershipCardData) => Promise<any>;
  sendToWallet: (cardId: string, userId: string) => Promise<any>;
  
  // User Management
  verifyPayment: (userId: string, transactionId: string) => Promise<any>;
  approveUser: (userId: string) => Promise<any>;
  grantPermissions: (userId: string, featureId: string) => Promise<any>;
}

export interface InvoiceData {
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  featureId: string;
  description: string;
  paymentMethod: string;
  transactionId: string;
  conversionSource: 'trial';
}

export interface SubscriptionData {
  userId: string;
  planId: string;
  planType: 'monthly' | 'annual';
  featureId: string;
  startDate: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  currency: string;
  paymentMethod: string;
  convertedFromTrial: true;
  trialFeatureId: string;
}

export interface MembershipCardData {
  userId: string;
  organizationName: string;
  membershipType: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  planId: string;
  featureId: string;
  benefits: string[];
}

export class TrialToAdminPanelsBridge {
  private static instance: TrialToAdminPanelsBridge;

  private constructor() {}

  static getInstance(): TrialToAdminPanelsBridge {
    if (!this.instance) {
      this.instance = new TrialToAdminPanelsBridge();
    }
    return this.instance;
  }

  /**
   * Handle complete post-conversion workflow
   * Integrates with all 3 admin panels
   */
  async handleTrialConversion(
    conversionResult: TrialConversionResult & {
      userId: string;
      featureId: string;
      planType: 'monthly' | 'annual';
      paymentMethod: string;
      transactionId: string;
      amount: number;
      currency: string;
    }
  ): Promise<{
    billing: any;
    membership: any;
    userApproval: any;
  }> {
    const {
      userId,
      featureId,
      planType,
      paymentMethod,
      transactionId,
      amount,
      currency,
      subscriptionId,
    } = conversionResult;

    try {
      // 1. BILLING MANAGEMENT: Create invoice and record subscription
      console.log('🧾 Creating invoice in BillingManagementPanel...');
      const billingResult = await this.processBilling({
        userId,
        planId: subscriptionId || `plan_${featureId}`,
        amount,
        currency,
        featureId,
        description: `Trial conversion: ${featureId} - ${planType}`,
        paymentMethod,
        transactionId,
        conversionSource: 'trial',
      });

      // 2. GOOGLE WALLET: Create membership card
      console.log('🎫 Creating membership card in GoogleWalletMembershipManager...');
      const membershipResult = await this.createMembershipCard({
        userId,
        organizationName: 'CreatorHub Norge',
        membershipType: this.getProfessionFromFeature(featureId),
        tier: this.getTierFromPlan(planType, amount),
        planId: subscriptionId || `plan_${featureId}`,
        featureId,
        benefits: this.getBenefitsForFeature(featureId, planType),
      });

      // 3. USER MANAGEMENT: Verify payment and approve user
      console.log('👤 Verifying payment and approving user in UserManagementPanel...');
      const userApprovalResult = await this.approveUserAfterPayment({
        userId,
        transactionId,
        featureId,
        membershipCardId: membershipResult.cardId,
      });

      // Track complete integration
      this.trackAdminPanelIntegration(userId, featureId, {
        billing: billingResult.success,
        membership: membershipResult.success,
        userApproval: userApprovalResult.success,
      });

      return {
        billing: billingResult,
        membership: membershipResult,
        userApproval: userApprovalResult,
      };
    } catch (error) {
      console.error('Error in trial-to-admin-panels integration: ', error);
      throw error;
    }
  }

  /**
   * 1. BILLING MANAGEMENT INTEGRATION
   */
  private async processBilling(data: InvoiceData): Promise<any> {
    try {
      // Create invoice in BillingManagementPanel
      const invoice = await apiRequest('/api/admin/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: data.userId,
          planId: data.planId,
          amount: data.amount,
          currency: data.currency,
          status: 'paid',
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId,
          metadata: {
            source: 'trial_conversion',
            featureId: data.featureId,
            description: data.description,
          },
        }),
      });

      // Record subscription in BillingManagementPanel
      const subscription = await apiRequest('/api/admin/billing/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          userId: data.userId,
          planId: data.planId,
          status: 'active',
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: this.calculatePeriodEnd(data.planId),
          amount: data.amount,
          currency: data.currency,
          paymentMethod: data.paymentMethod,
          metadata: {
            convertedFromTrial: true,
            trialFeatureId: data.featureId,
            transactionId: data.transactionId,
          },
        }),
      });

      return {
        success: true,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
      };
    } catch (error) {
      console.error('Error processing billing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Billing failed',
      };
    }
  }

  /**
   * 2. GOOGLE WALLET MEMBERSHIP INTEGRATION
   */
  private async createMembershipCard(data: MembershipCardData): Promise<any> {
    try {
      const card = await apiRequest('/api/google-wallet/create-membership-card', {
        method: 'POST',
        body: JSON.stringify({
          userId: data.userId,
          organizationName: data.organizationName,
          membershipType: data.membershipType,
          memberNumber: `MEM-${Date.now()}`,
          memberSince: new Date().toISOString(),
          tier: data.tier,
          benefits: data.benefits,
          renewalDate: this.calculateRenewalDate(data.planId),
          autoRenew: true,
          metadata: {
            source: 'trial_conversion',
            featureId: data.featureId,
            planId: data.planId,
          },
        }),
      });

      // Send to user's Google Wallet
      await apiRequest(`/api/google-wallet/send-to-wallet/${card.id}`, {
        method: 'POST',
        body: JSON.stringify({
          userId: data.userId,
        }),
      });

      return {
        success: true,
        cardId: card.id,
        passId: card.passId,
      };
    } catch (error) {
      console.error('Error creating membership card:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Membership card creation failed',
      };
    }
  }

  /**
   * 3. USER MANAGEMENT INTEGRATION
   */
  private async approveUserAfterPayment(data: {
    userId: string;
    transactionId: string;
    featureId: string;
    membershipCardId: string;
  }): Promise<any> {
    try {
      // Verify payment in UserManagementPanel
      const paymentVerification = await apiRequest(
        `/api/admin/users/${data.userId}/payment-status`,
        {
          method: 'POST',
          body: JSON.stringify({
            transactionId: data.transactionId,
            featureId: data.featureId,
          }),
        }
      );

      if (!paymentVerification.hasPayment || !paymentVerification.paymentCompleted) {
        throw new Error('Payment verification failed');
      }

      // Approve user in UserManagementPanel
      const approval = await apiRequest(`/api/admin/users/${data.userId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          source: 'trial_conversion',
          featureId: data.featureId,
          membershipCardId: data.membershipCardId,
        }),
      });

      // Grant feature permissions
      await apiRequest('/api/features/grant-access', {
        method: 'POST',
        body: JSON.stringify({
          userId: data.userId,
          featureId: data.featureId,
          source: 'trial_conversion',
        }),
      });

      return {
        success: true,
        approved: true,
        accessGranted: true,
      };
    } catch (error) {
      console.error('Error approving user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User approval failed',
      };
    }
  }

  /**
   * Helper: Calculate subscription period end date
   */
  private calculatePeriodEnd(planId: string): string {
    const isAnnual = planId.includes('annual') || planId.includes('year');
    const months = isAnnual ? 12 : 1;
    
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    
    return endDate.toISOString();
  }

  /**
   * Helper: Calculate membership renewal date
   */
  private calculateRenewalDate(planId: string): string {
    return this.calculatePeriodEnd(planId);
  }

  /**
   * Helper: Get profession from feature ID
   */
  private getProfessionFromFeature(featureId: string): string {
    const professionMap: Record<string, string> = {
      'advanced-analytics':'Professional', 'video-editing-pro':'Videographer','photo-editing-pro':'Photographer','audio-production':'Music Producer','client-management-pro' : 'Business',
    };

    return professionMap[featureId] || 'Professional';
  }

  /**
   * Helper: Get membership tier from plan type and amount
   */
  private getTierFromPlan(planType: string, amount: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
    if (planType === 'annual') {
      if (amount >= 5000) return 'PLATINUM';
      if (amount >= 3000) return 'GOLD';
      return 'SILVER';
    }
    
    // Monthly
    if (amount >= 500) return 'GOLD';
    if (amount >= 300) return 'SILVER';
    return 'BRONZE';
  }

  /**
   * Helper: Get benefits for feature and plan
   */
  private getBenefitsForFeature(featureId: string, planType: string): string[] {
    const baseBenefits = [
      'Full feature access','Priority support','Regular updates',
    ];

    const annualBenefits = [
      ...baseBenefits,
      '2 months free','Early access to new features','Dedicated account manager',
    ];

    return planType === 'annual' ? annualBenefits : baseBenefits;
  }

  /**
   * Track integration across admin panels
   */
  private trackAdminPanelIntegration(
    userId: string,
    featureId: string,
    results: {
      billing: boolean;
      membership: boolean;
      userApproval: boolean;
    }
  ): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'admin_panel_integration', {
        user_id: userId,
        feature_id: featureId,
        billing_success: results.billing,
        membership_success: results.membership,
        user_approval_success: results.userApproval,
        all_success: results.billing && results.membership && results.userApproval,
        timestamp: new Date().toISOString(),
      });
    }

    // Also send to backend analytics
    apiRequest('/api/analytics/admin-panel-integration', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        featureId,
        results,
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error);
  }

  /**
   * Get integration status for a user
   */
  async getIntegrationStatus(userId: string, featureId: string): Promise<{
    hasBilling: boolean;
    hasMembership: boolean;
    hasUserApproval: boolean;
    fullyIntegrated: boolean;
  }> {
    try {
      const response = await apiRequest(
        `/api/admin/integration-status/${userId}/${featureId}`,
        {
          method:'GET',
        }
      );

      return response;
    } catch (error) {
      console.error('Error getting integration status:', error);
      return {
        hasBilling: false,
        hasMembership: false,
        hasUserApproval: false,
        fullyIntegrated: false,
      };
    }
  }
}

export const trialToAdminPanelsBridge = TrialToAdminPanelsBridge.getInstance();
