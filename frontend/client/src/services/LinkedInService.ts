/**
 * LinkedIn Integration Service
 * Handles OAuth authentication and profile data syncing
 */

export interface LinkedInCredentials {
  clientId: string;
  redirectUri: string;
  scope: string[];
}

export interface LinkedInAccessToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface LinkedInExperience {
  id: string;
  title: string;
  companyName: string;
  startDate?: { year: number; month?: number };
  endDate?: { year: number; month?: number };
  description?: string;
  location?: string;
}

export interface LinkedInEducation {
  id: string;
  schoolName: string;
  fieldOfStudy?: string;
  degreeType?: string;
  startDate?: { year: number };
  endDate?: { year: number };
}

export interface LinkedInSkill {
  name: string;
  endorsements?: number;
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  summary?: string;
  location?: {
    country?: { code: string };
    city?: string;
  };
  profilePicture?: string;
  experience?: LinkedInExperience[];
  education?: LinkedInEducation[];
  skills?: LinkedInSkill[];
}

/**
 * LinkedIn OAuth Service
 */
export class LinkedInService {
  private clientId: string;
  private redirectUri: string;
  private scope: string[];
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
    this.redirectUri = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || `${window.location.origin}/auth/linkedin/callback`;
    this.scope = [
      'openid',
      'profile',
      'email',
      'w_member_social',
    ];

    // Try to load token from session storage
    const storedToken = sessionStorage.getItem('linkedin_access_token');
    if (storedToken) {
      const parsed = JSON.parse(storedToken);
      this.accessToken = parsed.token;
      this.tokenExpiresAt = parsed.expiresAt;
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope.join(' '),
      state: this.generateState(),
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<LinkedInAccessToken> {
    try {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '',
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`LinkedIn token exchange failed: ${error.error_description || error.error}`);
      }

      const data = await response.json() as LinkedInAccessToken;
      
      // Store token in session storage
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
      
      sessionStorage.setItem('linkedin_access_token', JSON.stringify({
        token: this.accessToken,
        expiresAt: this.tokenExpiresAt,
      }));

      return data;
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn profile using OpenID Connect
   */
  async getProfile(): Promise<LinkedInProfile> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    if (this.tokenExpiresAt < Date.now()) {
      throw new Error('LinkedIn access token expired');
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          throw new Error('LinkedIn session expired. Please log in again.');
        }
        throw new Error(`Failed to fetch LinkedIn profile: ${response.statusText}`);
      }

      return await response.json() as LinkedInProfile;
    } catch (error) {
      console.error('Failed to fetch LinkedIn profile:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn profile picture URL
   */
  async getProfilePicture(): Promise<string | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/me?projection=(profilePicture(displayImage))', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.profilePicture?.displayImage || null;
    } catch (error) {
      console.error('Failed to fetch LinkedIn profile picture:', error);
      return null;
    }
  }

  /**
   * Get LinkedIn work experience
   */
  async getExperience(): Promise<LinkedInExperience[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/me?projection=(positionHistory(id,title,companyName,startDate,endDate,description,location))', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch experience: ${response.statusText}`);
      }

      const data = await response.json();
      return data.positionHistory || [];
    } catch (error) {
      console.error('Failed to fetch LinkedIn experience:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn education
   */
  async getEducation(): Promise<LinkedInEducation[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/me?projection=(educationHistory(id,schoolName,fieldOfStudy,degreeType,startDate,endDate))', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch education: ${response.statusText}`);
      }

      const data = await response.json();
      return data.educationHistory || [];
    } catch (error) {
      console.error('Failed to fetch LinkedIn education:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn skills
   */
  async getSkills(): Promise<LinkedInSkill[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    try {
      const response = await fetch('https://api.linkedin.com/v2/me?projection=(skillsHistory(name))', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch skills: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.skillsHistory || []).map((skill: any) => ({
        name: skill.name,
        endorsements: 0,
      }));
    } catch (error) {
      console.error('Failed to fetch LinkedIn skills:', error);
      throw error;
    }
  }

  /**
   * Get complete profile data
   */
  async getCompleteProfile(): Promise<{
    profile: LinkedInProfile;
    experience: LinkedInExperience[];
    education: LinkedInEducation[];
    skills: LinkedInSkill[];
  }> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    try {
      const [profile, experience, education, skills] = await Promise.all([
        this.getProfile(),
        this.getExperience().catch(() => []),
        this.getEducation().catch(() => []),
        this.getSkills().catch(() => []),
      ]);

      return { profile, experience, education, skills };
    } catch (error) {
      console.error('Failed to fetch complete LinkedIn profile:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken && this.tokenExpiresAt > Date.now();
  }

  /**
   * Clear stored token
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    sessionStorage.removeItem('linkedin_access_token');
  }

  /**
   * Generate state for OAuth
   */
  private generateState(): string {
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('linkedin_oauth_state', state);
    return state;
  }

  /**
   * Verify state from callback
   */
  verifyState(state: string): boolean {
    const storedState = sessionStorage.getItem('linkedin_oauth_state');
    sessionStorage.removeItem('linkedin_oauth_state');
    return state === storedState;
  }
}

// Singleton instance
export const linkedInService = new LinkedInService();
