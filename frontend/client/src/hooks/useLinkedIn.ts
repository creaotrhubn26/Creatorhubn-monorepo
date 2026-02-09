/**
 * useLinkedIn Hook
 * Manages LinkedIn OAuth and data synchronization
 */

import { useState, useCallback, useEffect } from 'react';
import { linkedInService, LinkedInProfile, LinkedInExperience, LinkedInEducation, LinkedInSkill } from '@/services/LinkedInService';

export interface LinkedInState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  profile: LinkedInProfile | null;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: LinkedInSkill[];
}

export const useLinkedIn = () => {
  const [state, setState] = useState<LinkedInState>({
    isAuthenticated: linkedInService.isAuthenticated(),
    isLoading: false,
    error: null,
    profile: null,
    experience: [],
    education: [],
    skills: [],
  });

  // Check authentication on mount
  useEffect(() => {
    const isAuth = linkedInService.isAuthenticated();
    if (isAuth) {
      // Try to load cached profile
      const cachedProfile = sessionStorage.getItem('linkedin_profile_cache');
      if (cachedProfile) {
        try {
          const data = JSON.parse(cachedProfile);
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            profile: data.profile,
            experience: data.experience,
            education: data.education,
            skills: data.skills,
          }));
        } catch (error) {
          console.error('Failed to load cached LinkedIn profile:', error);
        }
      }
    }
  }, []);

  // LinkedIn login
  const login = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID;
      if (!clientId) {
        throw new Error('LinkedIn Client ID not configured');
      }

      const authUrl = linkedInService.getAuthorizationUrl();
      window.location.href = authUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'LinkedIn login failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      console.error('LinkedIn login error:', error);
    }
  }, []);

  // LinkedIn logout
  const logout = useCallback(async () => {
    linkedInService.clearToken();
    sessionStorage.removeItem('linkedin_profile_cache');
    setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      profile: null,
      experience: [],
      education: [],
      skills: [],
    });
  }, []);

  // Sync LinkedIn profile
  const syncProfile = useCallback(async (): Promise<LinkedInProfile | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const completeProfile = await linkedInService.getCompleteProfile();
      
      // Cache the profile data
      sessionStorage.setItem('linkedin_profile_cache', JSON.stringify(completeProfile));

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        profile: completeProfile.profile,
        experience: completeProfile.experience,
        education: completeProfile.education,
        skills: completeProfile.skills,
      }));

      return completeProfile.profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync LinkedIn profile';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false,
      }));
      console.error('LinkedIn sync error:', error);
      return null;
    }
  }, []);

  // Handle OAuth callback
  const handleAuthCallback = useCallback(async (code: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await linkedInService.exchangeCodeForToken(code);
      const completeProfile = await linkedInService.getCompleteProfile();
      
      // Cache the profile data
      sessionStorage.setItem('linkedin_profile_cache', JSON.stringify(completeProfile));

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        profile: completeProfile.profile,
        experience: completeProfile.experience,
        education: completeProfile.education,
        skills: completeProfile.skills,
      }));

      return completeProfile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      console.error('OAuth callback error:', error);
      throw error;
    }
  }, []);

  return {
    state,
    login,
    logout,
    syncProfile,
    handleAuthCallback,
    isAuthenticated: state.isAuthenticated,
    profile: state.profile,
    experience: state.experience,
    education: state.education,
    skills: state.skills,
  };
};
