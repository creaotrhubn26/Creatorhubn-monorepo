/**
 * OnboardingStep Component
 * 
 * Individual step in the onboarding flow with memoization
 */

import React, { memo } from 'react';
import { Box, Typography, Button, Step, StepLabel, StepContent } from '@mui/material';
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
                <CheckCircle color="success" fontSize="small" />
                <Typography variant="body2">{item}</Typography>
              </Box>
            ))}
          </Box>
        );

      case 'text':
      default:
        return (
          <Typography variant="body1" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
            {step.content.text || step.description}
          </Typography>
        );
    }
  };

  return (
    <Step completed={isCompleted}>
      <StepLabel>
        <Typography variant="h6">{step.title}</Typography>
      </StepLabel>
      <StepContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
          >
            {isCompleted ? 'Fullført' : 'Neste'}
          </Button>
          {showPrevious && onPrevious && (
            <Button onClick={onPrevious} aria-label="Gå til forrige steg">
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

