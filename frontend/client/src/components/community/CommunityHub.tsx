/**
 * CreatorHub Norge Community Hub
 * 
 * Main entry point for the community system
 * Handles onboarding flow and community access
 * Integrates Direct Messaging with UniversalChatWidget
 */

import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import CommunityLandingPage from './CommunityLandingPage';
import CommunityPage from './CommunityPage';
import { CommunityDMProvider } from './CommunityDMProvider';

interface CommunityHubProps {
  userId: string;
  userEmail?: string;
  profession: string;
}

export default function CommunityHub({ userId, userEmail, profession }: CommunityHubProps) {
  const { user } = useEnhancedMasterIntegration();
  // Use provided email or fallback to user context
  const currentUserEmail = userEmail || user?.email;
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, [userId]);

  const checkOnboardingStatus = async () => {
    try {
      setLoading(true);

      // Check if user has completed onboarding
      const response = await apiRequest(`/api/community/user/${userId}/onboarding-status`, {
        method: 'GET',
      }) as { success: boolean; completed: boolean; hasAccess: boolean };

      if (response.success) {
        if (!response.hasAccess) {
          // User not yet onboarded to community
          setShowLanding(true);
          setHasCompletedOnboarding(false);
        } else if (!response.completed) {
          // User has access but hasn't completed onboarding
          setShowLanding(true);
          setHasCompletedOnboarding(false);
        } else {
          // User has completed onboarding
          setShowLanding(false);
          setHasCompletedOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Error checking onboarding status: ', error);
      // Default to showing community page on error
      setShowLanding(false);
      setHasCompletedOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    setShowLanding(false);
  };

  const handleSkipOnboarding = () => {
    setShowLanding(false);
    setHasCompletedOnboarding(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Box sx={{ textAlign:'center' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Laster community...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (showLanding && !hasCompletedOnboarding) {
    return (
      <CommunityLandingPage
        userId={userId}
        profession={profession}
        onComplete={handleOnboardingComplete}
        onSkip={handleSkipOnboarding}
      />
    );
  }

  return (
    <CommunityDMProvider
      currentUserId={userId}
      currentUserEmail={currentUserEmail}
      profession={profession}
    >
      <CommunityPage userId={userId} profession={profession} />
    </CommunityDMProvider>
  );
}

