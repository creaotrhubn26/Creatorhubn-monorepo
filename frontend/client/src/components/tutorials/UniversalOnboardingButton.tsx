import React from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button, Chip, Tooltip } from '@mui/material';
import { ArrowForward, CheckCircle, SettingsOutlined } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface UniversalOnboardingButtonProps {
  userType: 'photographer' | 'videographer' | 'music_producer' | 'northtone_vendor' | 'print_vendor';
}

interface AuthUser {
  id?: string;
}

interface OnboardingProgress {
  currentStep?: number;
  completedAt?: string | null;
}

export default function UniversalOnboardingButton({ userType }: UniversalOnboardingButtonProps): React.ReactElement {
  const [, setLocation] = useLocation();
  const theming = useTheming(userType === 'videographer' ? 'videographer' : 'photographer');

  const { data: currentUser } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        const data = await apiRequest('/api/auth/user');
        return typeof data === 'object' && data !== null ? (data as AuthUser) : null;
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const userId = currentUser?.id;

  const { data: progress } = useQuery({
    queryKey: ['onboarding-progress', userId],
    queryFn: async (): Promise<OnboardingProgress | null> => {
      if (!userId) {
        return null;
      }
      try {
        const data = await apiRequest(`/api/onboarding/progress/${userId}`);
        return typeof data === 'object' && data !== null ? (data as OnboardingProgress) : null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(userId),
    retry: false,
  });

  const isCompleted = Boolean(progress?.completedAt);
  const hasStarted = (progress?.currentStep ?? 0) > 1;

  return (
    <Tooltip title={isCompleted ? 'Onboarding fullfort' : 'Start universell oppsettveiledning'}>
      <Button
        onClick={() => setLocation('/universal-onboarding')}
        variant="outlined"
        size="small"
        sx={{
          alignItems: 'center',
          borderColor: isCompleted ? '#4caf50' : '#ff8c00',
          borderRadius: '12px',
          color: isCompleted ? '#4caf50' : '#ff8c00',
          display: 'inline-flex',
          gap: '8px',
          minHeight: 38,
          px: 1.25,
          transition: 'all 120ms ease',
          '&:hover': {
            borderColor: isCompleted ? '#4caf50' : '#ff8c00',
            boxShadow: `0 0 0 2px ${theming.colors.light}`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        {isCompleted ? <CheckCircle sx={{ fontSize: 18 }} /> : <SettingsOutlined sx={{ fontSize: 18 }} />}

        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
          {isCompleted ? 'Fullfort' : 'Oppsett'}
        </span>

        {hasStarted && !isCompleted ? <Chip size="small" label={progress?.currentStep ?? 1} /> : null}

        {!isCompleted ? <ArrowForward sx={{ fontSize: 14 }} /> : null}
      </Button>
    </Tooltip>
  );
}
