import type { Consent, ConsentType, ConsentSignatureData } from '../models/casting';
import { castingService } from './castingService';
import { authSessionService } from './authSessionService';

function normalizeConsent(consent: Consent, projectId: string, candidateId: string): Consent {
  const now = new Date().toISOString();
  return {
    ...consent,
    candidateId,
    candidate_id: candidateId,
    projectId,
    project_id: projectId,
    createdAt: consent.createdAt || now,
    updatedAt: now,
  };
}

export const consentService = {
  async getConsents(projectId: string, candidateId: string): Promise<Consent[]> {
    try {
      const consents = await castingService.getConsents(projectId, candidateId);
      return Array.isArray(consents) ? consents : [];
    } catch (error) {
      console.warn('Unable to load consents from project data:', error);
      return [];
    }
  },

  async getConsent(projectId: string, candidateId: string, consentId: string): Promise<Consent | null> {
    const consents = await this.getConsents(projectId, candidateId);
    return consents.find(c => c.id === consentId) || null;
  },

  async createConsent(projectId: string, candidateId: string, type: ConsentType, title?: string): Promise<Consent | null> {
    try {
      const consent: Consent = normalizeConsent({
        id: `consent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        candidateId,
        projectId,
        type,
        title,
        signed: false,
        invitationStatus: 'not_sent',
      }, projectId, candidateId);

      await castingService.saveConsent(projectId, candidateId, consent);
      return consent;
    } catch (error) {
      console.error('Error creating consent:', error);
      return null;
    }
  },

  async updateConsent(projectId: string, candidateId: string, consent: Consent): Promise<boolean> {
    try {
      await castingService.saveConsent(projectId, candidateId, normalizeConsent(consent, projectId, candidateId));
      return true;
    } catch (error) {
      console.error('Error updating consent:', error);
      return false;
    }
  },

  async signConsent(projectId: string, candidateId: string, consentId: string, signatureData?: ConsentSignatureData): Promise<boolean> {
    const consent = await this.getConsent(projectId, candidateId, consentId);
    if (!consent) return false;

    consent.signed = true;
    consent.date = new Date().toISOString();
    consent.invitationStatus = 'signed';
    if (signatureData) {
      consent.signatureData = signatureData;
    }

    return await this.updateConsent(projectId, candidateId, consent);
  },

  async deleteConsent(projectId: string, candidateId: string, consentId: string): Promise<boolean> {
    try {
      await castingService.deleteConsent(projectId, candidateId, consentId);
      return true;
    } catch (error) {
      console.error('Error deleting consent:', error);
      return false;
    }
  },

  async generateAccessCode(
    consent: Consent,
    options?: { pin?: string; password?: string; expiresDays?: number; candidateName?: string; projectName?: string },
  ): Promise<string | null> {
    try {
      const response = await fetch('/api/consent/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authSessionService.getAuthHeadersSync(),
        },
        body: JSON.stringify({
          consentId: consent.id,
          projectId: consent.projectId || consent.project_id,
          candidateId: consent.candidateId || consent.candidate_id,
          type: consent.type,
          title: consent.title,
          description: consent.description,
          document: consent.document,
          candidateName: options?.candidateName,
          projectName: options?.projectName,
          pin: options?.pin || undefined,
          password: options?.password || undefined,
          expiresDays: options?.expiresDays,
        }),
      });
      if (!response.ok) {
        console.error('Failed to issue consent access code:', response.status);
        return null;
      }
      const data = await response.json();
      return typeof data?.accessCode === 'string' ? data.accessCode : null;
    } catch (error) {
      console.error('Error issuing consent access code:', error);
      return null;
    }
  },

  async hasAllRequiredConsents(projectId: string, candidateId: string, requiredTypes: ConsentType[]): Promise<boolean> {
    const consents = await this.getConsents(projectId, candidateId);
    const signedConsents = consents.filter(c => c.signed);
    return requiredTypes.every(type => signedConsents.some(c => c.type === type));
  },

  async getMissingConsents(projectId: string, candidateId: string, requiredTypes: ConsentType[]): Promise<ConsentType[]> {
    const consents = await this.getConsents(projectId, candidateId);
    const signedTypes = consents.filter(c => c.signed).map(c => c.type);
    return requiredTypes.filter(type => !signedTypes.includes(type));
  },

  async getConsentStatus(projectId: string, candidateId: string): Promise<{
    total: number;
    signed: number;
    pending: number;
    missing: ConsentType[];
  }> {
    const consents = await this.getConsents(projectId, candidateId);
    const signed = consents.filter(c => c.signed).length;
    const pending = consents.filter(c => !c.signed).length;

    return {
      total: consents.length,
      signed,
      pending,
      missing: [],
    };
  },
};
