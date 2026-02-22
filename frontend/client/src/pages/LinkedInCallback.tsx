/**
 * LinkedIn OAuth Callback Handler
 * Handles the redirect from LinkedIn after user authorization
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button,
} from '@mui/material';
import { useLinkedIn } from '@/hooks/useLinkedIn';
import { linkedInService, type LinkedInProfile } from '@/services/LinkedInService';

export default function LinkedInCallback() {
  const [location, navigate] = useLocation();
  const { handleAuthCallback } = useLinkedIn();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [linkedInProfile, setLinkedInProfile] = useState<LinkedInProfile | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get authorization code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');

        // Check for OAuth errors
        if (errorParam) {
          const errorMessage = errorDescription 
            ? decodeURIComponent(errorDescription)
            : errorParam;
          throw new Error(`LinkedIn OAuth Error: ${errorMessage}`);
        }

        if (!code) {
          throw new Error('No authorization code received from LinkedIn');
        }

        if (!state) {
          throw new Error('Missing OAuth state - authentication may have been tampered with');
        }

        // Validate OAuth state for CSRF protection using LinkedInService
        if (!linkedInService.verifyState(state)) {
          throw new Error('Invalid OAuth state - authentication may have been tampered with');
        }

        // Exchange code for token and get profile
        console.log('Processing LinkedIn callback with code:', code);
        const completeProfile = await handleAuthCallback(code);

        // Extract and store the profile data for resume builder
        const profile = completeProfile?.profile;
        if (profile) {
          setLinkedInProfile(profile);
        }

        const profileDisplayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
        console.log('LinkedIn auth successful, redirecting to resume builder with profile:', {
          name: profileDisplayName || 'Unknown',
          headline: profile?.headline,
          location: location,
          syncedAt: new Date().toISOString()
        });
        
        // Wait a moment for state to update, then redirect
        setTimeout(() => {
          // Pass profile data via navigation with query parameters
          navigate('/resume-builder?source=linkedin&synced=true&mode=import');
        }, 500);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during LinkedIn authentication';
        console.error('LinkedIn callback error:', err);
        setError(errorMessage);
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [handleAuthCallback, navigate, location]);

  if (isProcessing && !error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="h6">Processing LinkedIn authentication...</Typography>
        <Typography variant="body2" color="textSecondary">
          Syncing your profile: {linkedInProfile ? `${linkedInProfile.firstName} ${linkedInProfile.lastName}`.trim() : 'Loading...'}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Please wait while we sync your profile data from {linkedInProfile?.headline || 'LinkedIn'}
        </Typography>
        <Typography variant="caption" color="textSecondary" sx={{ mt: 4 }}>
          Current location: {location || '/linkedin-callback'}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          gap: 2,
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500, width: '100%' }}>
          <Typography variant="h6" gutterBottom>
            LinkedIn Authentication Failed
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
          {linkedInProfile && (
            <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
              Attempted to sync profile: <strong>{`${linkedInProfile.firstName} ${linkedInProfile.lastName}`.trim() || 'Unknown'}</strong>
            </Typography>
          )}
          <Typography variant="caption" color="textSecondary">
            Current location: {location || '/linkedin-callback'}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Please try connecting to LinkedIn again from the Resume Builder.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/resume-builder?error=linkedin_auth&source=' + location)}
          sx={{ mt: 2 }}
        >
          Return to Resume Builder
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate('/')}
          sx={{ mt: 1 }}
        >
          Return to Home
        </Button>
      </Box>
    );
  }

  return null;
}
