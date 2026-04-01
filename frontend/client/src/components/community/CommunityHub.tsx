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

  const persistLocalOnboardingState = (options?: { dismissTutorial?: boolean }) => {
    try {
      localStorage.setItem(`community-onboarding-complete-${userId}`, 'true');
      if (options?.dismissTutorial) {
        localStorage.setItem('community-guide-tutorial-dismissed', 'true');
        localStorage.setItem('community-guide-completed-steps', '[]');
      }
    } catch {
      // Ignore local persistence issues.
    }
  };

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
    persistLocalOnboardingState();
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
    persistLocalOnboardingState({ dismissTutorial: true });
    setShowLanding(false);
    setHasCompletedOnboarding(true);
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background:
            'radial-gradient(circle at top right, rgba(245, 166, 35, 0.14), transparent 28%), linear-gradient(180deg, #05070b 0%, #091019 52%, #06080c 100%)',
          px: 2,
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            p: 4,
            borderRadius: 4,
            background:
              'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.36)',
          }}
        >
          <CircularProgress sx={{ color: '#f5a623' }} />
          <Typography variant="body1" sx={{ mt: 2, color: 'rgba(248, 241, 231, 0.68)' }}>
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
