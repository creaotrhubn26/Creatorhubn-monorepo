/**
 * OnboardingStep Component
 * 
 * Individual step in the onboarding flow with memoization
 */

import React, { memo } from 'react';
import {
  Box,
  Typography,
  Button,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { CheckCircle, ArrowForward } from '@mui/icons-material';
import { VideoEmbed } from './VideoEmbed';
import { ImageContent } from './ImageContent';

interface OnboardingStepData {
  id: string;
  title: string;
  description: string;
  content_type: 'text' | 'video' | 'image' | 'checklist';
  content: any;
  position: number;
  is_required: boolean;
}

interface OnboardingStepProps {
  step: OnboardingStepData;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onPrevious?: () => void;
  showPrevious: boolean;
}

const OnboardingStepComponent: React.FC<OnboardingStepProps> = ({
  step,
  index,
  isActive,
  isCompleted,
  onComplete,
  onPrevious,
  showPrevious,
}) => {
  const renderStepContent = () => {
    switch (step.content_type) {
      case 'video':
        return (
          <Box sx={{ mt: 2 }}>
            <VideoEmbed videoUrl={step.content.video_url} lazy={!isActive} />
          </Box>
        );

      case 'image':
        return (
          <ImageContent
            images={step.content.image_url || step.content.images}
            alt={step.title}
            gallery={step.content.gallery || false}
          />
        );

      case 'checklist':
        return (
          <Box sx={{ mt: 2 }}>
            {step.content.items?.map((item: string, itemIndex: number) => (
              <Box key={itemIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircle sx={{ color: '#ff8c00' }} fontSize="small" />
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.82)' }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        );

      case 'text':
      default:
        return (
          <Typography
            variant="body1"
            sx={{ mt: 2, whiteSpace: 'pre-wrap', color: 'rgba(255, 255, 255, 0.82)' }}
          >
            {step.content.text || step.description}
          </Typography>
        );
    }
  };

  return (
    <Step completed={isCompleted} expanded={isActive}>
      <StepLabel
        sx={{
          '& .MuiStepLabel-label': {
            color: `${isActive || isCompleted ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.72)'} !important`,
          },
          '& .MuiStepIcon-root': {
            color: isActive || isCompleted ? '#ff8c00' : 'rgba(255,255,255,0.18)',
          },
          '& .MuiStepIcon-root.Mui-completed': {
            color: '#ff8c00',
          },
          '& .MuiStepIcon-root.Mui-active': {
            color: '#ff8c00',
          },
          '& .MuiStepIcon-text': {
            fill: '#0a0f1a',
            fontWeight: 700,
          },
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {step.title}
        </Typography>
      </StepLabel>
      <StepContent
        sx={{
          ml: 1.5,
          pl: 3,
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Typography
          variant="body2"
          sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.62)' }}
        >
          {step.description}
        </Typography>

        {renderStepContent()}

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={onComplete}
            disabled={isCompleted}
            startIcon={isCompleted ? <CheckCircle /> : <ArrowForward />}
            aria-label={isCompleted ? 'Fullført' : 'Fullfør dette steget'}
            sx={{
              borderRadius: 999,
              px: 2.25,
              background: 'linear-gradient(135deg, #ff8c00 0%, #ffd27d 100%)',
              color: '#0a0f1a',
              fontWeight: 700,
              '&:hover': {
                background: 'linear-gradient(135deg, #ffb845 0%, #ffe2a5 100%)',
              },
              '&.Mui-disabled': {
                background: 'rgba(255, 140, 0, 0.24)',
                color: 'rgba(5, 7, 11, 0.55)',
              },
            }}
          >
            {isCompleted ? 'Fullført' : 'Neste'}
          </Button>
          {showPrevious && onPrevious && (
            <Button
              onClick={onPrevious}
              aria-label="Gå til forrige steg"
              variant="outlined"
              sx={{
                borderRadius: 999,
                borderColor: 'rgba(255,255,255,0.12)',
                color: 'rgba(255, 255, 255, 0.82)',
                '&:hover': {
                  borderColor: 'rgba(255, 140, 0, 0.24)',
                  bgcolor: 'rgba(255, 140, 0, 0.08)',
                },
              }}
            >
              Tilbake
            </Button>
          )}
        </Box>
      </StepContent>
    </Step>
  );
};

// Memoize to prevent unnecessary re-renders
export const OnboardingStep = memo(OnboardingStepComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.isCompleted === nextProps.isCompleted &&
    prevProps.step.id === nextProps.step.id
  );
});

OnboardingStep.displayName = 'OnboardingStep';

export default OnboardingStep;
