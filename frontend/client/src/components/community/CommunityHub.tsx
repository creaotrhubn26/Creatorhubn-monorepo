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
  const { auth } = useEnhancedMasterIntegration();
  // Use provided email or fallback to user context
  const currentUserEmail = userEmail || auth.state.user?.email;
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
          // User not yet onboarded to community - show onboarding
          setShowLanding(true);
          setHasCompletedOnboarding(false);
        } else if (!response.completed) {
          // User has access but hasn't completed onboarding - show onboarding
          setShowLanding(true);
          setHasCompletedOnboarding(false);
        } else {
          // User has completed onboarding - show community page
          setShowLanding(false);
          setHasCompletedOnboarding(true);
        }
      } else {
        // API returned success: false - show onboarding to be safe
        console.warn('Onboarding status check returned success: false');
        setShowLanding(true);
        setHasCompletedOnboarding(false);
      }
    } catch (error) {
      console.error('Error checking onboarding status: ', error);
      // On error, show onboarding to be safe (better than blocking access)
      // This ensures users can still complete onboarding even if status check fails
      setShowLanding(true);
      setHasCompletedOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    // Re-check status to ensure it's properly saved
    try {
      await checkOnboardingStatus();
    } catch (error) {
      console.error('Error re-checking onboarding status after completion: ', error);
      // Still update local state even if re-check fails
      setHasCompletedOnboarding(true);
      setShowLanding(false);
    }
  };

  const handleSkipOnboarding = async () => {
    // When skipping, we should still mark as complete in backend if possible
    try {
      await apiRequest('/api/community/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          profession,
        }),
      });
    } catch (error) {
      console.error('Error marking onboarding as skipped: ', error);
      // Continue anyway
    }
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
