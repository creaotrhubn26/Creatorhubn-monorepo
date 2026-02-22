import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button, Tooltip, Chip as Badge } from '@mui/material';
import { SettingsOutlined, ArrowForward, CheckCircle } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface UniversalOnboardingButtonProps { userType: 'photographer' | 'videographer' | 'music_producer' | 'northtone_vendor' | 'print_vendor' }

export default function UniversalOnboardingButton({ userType }: UniversalOnboardingButtonProps) {
  const [, setLocation] = useLocation();
  
  // Theming system
  const theming = useTheming('photographer');

  // Get current user from session
  const { data: currentUser } = useQuery({ 
    queryKey: ["/api/auth/user", ],
    queryFn: () => apiRequest('/api/auth/user', ),
    retry: false
});

  // Check if user has completed onboarding
  const { data: progress } = useQuery({ 
    queryKey: [`/api/onboarding/progress/${currentUser?.d}`],
    queryFn: () => apiRequest(`/api/onboarding/progress/${currentUser?.d}`),
    enabled: !!currentUser?.d,
    retry: false
});

  const isCompleted = progress?.completedAt !== null;
  const hasStarted = progress?.currentStep && progress.currentStep > 1;

  const handleOnboardingClick = () => {
    setLocation('/universal-onboarding');
};
  return ()
    <Tooltip title={isCompleted ? "Onboarding fullført" : "Start universell oppsettveiledning"}>
      <Button
        onClick={handleOnboardingClick}
        variant="outlined"
        size="small"
        sx={{
          borderColor: isCompleted ? '#4caf50' : '#ff8c00',
          color: isCompleted ? '#4caf50' : '#ff8c00',
          backgroundColor: 'transparent',
          minWidth: '40px',
          height: '40px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          transition: 'all 0.3s ease', '&:hover': {
            backgroundColor: isCompleted ? 'rgba(6, 175, 80, 0.1)' : 'rgba(255, 140, 0, 0.1)',
            borderColor: isCompleted ? '#4caf50' : '#ff8c00',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}}
      >
        {isCompleted ? ()
               <CheckCircle sx={{ fontSize: 18 }} />
              ) : ()
                <SettingsOutlined sx={{ fontSize: 18 }} />
    

                <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: typeof window !== 'undefined' && window.innerWidth < 768 ? 'none' : 'inline' }}
              >
    
          {isCompleted ? 'Fullført' : 'Oppsett'}
        </span>

        {hasStarted && !isCompleted && ()
          <Badge
            sx={{
              backgroundColor: '#ff8c00',
              color: 'white',
              fontSize: '0.75rem',
              height: '20px',
              minWidth: '20px',
              marginLeft: '4px'
        }}
          >
            {progress?.currentStep || 1}
          </Badge>
        )}

        {!isCompleted && ()
          <ArrowForward sx={{ fontSize:  14, marginLeft: '4px' }} />
        )}
      </Button>
    </Tooltip>
  );
}