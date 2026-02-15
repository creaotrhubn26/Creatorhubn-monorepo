import { Consent, ConsentType, ConsentSignatureData } from '../models/casting';

const API_BASE = '/api/casting';

export const consentService = {
  async getConsents(projectId: string, candidateId: string): Promise<Consent[]> {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/candidates/${candidateId}/consents`);
      const data = await response.json();
      if (data.success) {
        return data.consents || [];
      }
      console.error('Failed to get consents:', data.error);
      return [];
    } catch (error) {
      console.error('Error fetching consents:', error);
      return [];
    }
  },

  async getConsent(projectId: string, candidateId: string, consentId: string): Promise<Consent | null> {
    const consents = await this.getConsents(projectId, candidateId);
    return consents.find(c => c.id === consentId) || null;
  },

  async createConsent(projectId: string, candidateId: string, type: ConsentType, title?: string): Promise<Consent | null> {
    try {
      const response = await fetch(`${API_BASE}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          candidateId,
          type,
          title,
          signed: false,
        }),
      });
      const data = await response.json();
      if (data.success) {
        return {
          id: data.consentId,
          candidateId,
          projectId,
          type,
          title,
          signed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      console.error('Failed to create consent:', data.error);
      return null;
    } catch (error) {
      console.error('Error creating consent:', error);
      return null;
    }
  },

  async updateConsent(projectId: string, candidateId: string, consent: Consent): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: consent.id,
          projectId,
          candidateId,
          type: consent.type,
          title: consent.title,
          description: consent.description,
          signed: consent.signed,
          date: consent.date,
          document: consent.document,
          notes: consent.notes,
          signatureData: consent.signatureData,
        }),
      });
      const data = await response.json();
      return data.success;
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
    if (signatureData) {
      consent.signatureData = signatureData;
    }
    
    return await this.updateConsent(projectId, candidateId, consent);
  },

  async deleteConsent(projectId: string, candidateId: string, consentId: string): Promise<boolean> {
    try {
      const params = new URLSearchParams({ projectId, candidateId });
      const response = await fetch(`${API_BASE}/consents/${consentId}?${params.toString()}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting consent:', error);
      return false;
    }
  },

  async generateAccessCode(consentId: string, options?: { pin?: string; password?: string; expiresDays?: number }): Promise<string | null> {
    try {
      const response = await fetch('/api/consent/generate-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentId,
          pin: options?.pin || null,
          password: options?.password || null,
          expiresDays: options?.expiresDays || 30,
        }),
      });
      const data = await response.json();
      if (data.success) {
        return data.accessCode;
      }
      console.error('Failed to generate access code:', data.error);
      return null;
    } catch (error) {
      console.error('Error generating access code:', error);
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
